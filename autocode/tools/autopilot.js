#!/usr/bin/env node
/**
 * AutoCode Autopilot
 *
 * A small orchestrator that:
 *  1) runs Codex non-interactively to implement a goal
 *  2) runs a verification command
 *  3) loops until verification passes (or max iterations reached)
 *
 * No dependencies; runs on Node 16+.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const out = {
    cwd: process.cwd(),
    verify: null,
    goal: null,
    maxIterations: 5,
    codexArgs: [],
    dangerous: false,
    model: null,
  };

  const rest = [];
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if ((a === '--cwd' || a === '-C') && argv[i + 1]) {
      out.cwd = argv[++i];
      continue;
    }
    if (a === '--verify' && argv[i + 1]) {
      out.verify = argv[++i];
      continue;
    }
    if ((a === '--max' || a === '--max-iterations') && argv[i + 1]) {
      const n = Number(argv[++i]);
      if (!Number.isFinite(n) || n <= 0) throw new Error(`Invalid max iterations: ${argv[i]}`);
      out.maxIterations = n;
      continue;
    }
    if ((a === '--model' || a === '-m') && argv[i + 1]) {
      out.model = argv[++i];
      continue;
    }
    if (a === '--dangerous') {
      out.dangerous = true;
      continue;
    }
    if (a === '--help' || a === '-h') {
      out.help = true;
      continue;
    }
    if (a === '--') {
      out.codexArgs = argv.slice(i + 1);
      break;
    }
    rest.push(a);
  }

  if (rest.length > 0) out.goal = rest.join(' ').trim();
  return out;
}

function detectVerifyCommand(root) {
  const has = (p) => fs.existsSync(path.join(root, p));
  const hasPkg = has('package.json');
  if (!hasPkg) return null;

  if (has('pnpm-lock.yaml')) return 'pnpm test';
  if (has('yarn.lock')) return 'yarn test';
  if (has('package-lock.json')) return 'npm test';
  return 'npm test';
}

function runShell(command, cwd) {
  const result = spawnSync(command, {
    cwd,
    shell: true,
    stdio: 'pipe',
    encoding: 'utf8',
    env: process.env,
  });

  return {
    code: typeof result.status === 'number' ? result.status : 1,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function clip(s, max = 6000) {
  if (!s) return '';
  if (s.length <= max) return s;
  return s.slice(0, max) + `\n…(clipped ${s.length - max} chars)…\n`;
}

function buildPrompt({ goal, verify, iteration, lastVerify }) {
  const lines = [];
  lines.push('You are AutoCode Autopilot.');
  lines.push('');
  lines.push('Goal:');
  lines.push(goal);
  lines.push('');
  lines.push('Hard requirement: verification must pass before you stop.');
  lines.push(`Verification command: ${verify}`);
  lines.push('');
  lines.push('Instructions:');
  lines.push('- Make the smallest correct change set to satisfy the goal.');
  lines.push('- Run the verification command, read failures, and iterate until it passes.');
  lines.push('- If verification is slow, still run it at least once per iteration and when you believe you are done.');
  lines.push('- Finish with a concise summary of what changed and the verification result.');
  lines.push('');
  lines.push(`Iteration: ${iteration}`);
  if (lastVerify && (lastVerify.stdout || lastVerify.stderr)) {
    lines.push('');
    lines.push('Most recent verification output (from outside this agent run):');
    lines.push('```');
    lines.push(clip((lastVerify.stdout || '') + (lastVerify.stderr || ''), 8000));
    lines.push('```');
  }
  return lines.join('\n');
}

function runCodex({ cwd, prompt, model, dangerous, extraArgs }) {
  const args = ['exec', '--full-auto', '-C', cwd];
  if (dangerous) args.push('--dangerously-bypass-approvals-and-sandbox');
  if (model) args.push('-m', model);
  if (Array.isArray(extraArgs) && extraArgs.length > 0) args.push(...extraArgs);
  args.push(prompt);

  // eslint-disable-next-line no-console
  console.log(`\n[autopilot] codex ${args.slice(0, 6).join(' ')} …\n`);
  const r = spawnSync('codex', args, { stdio: 'inherit', cwd, env: process.env });
  return typeof r.status === 'number' ? r.status : 1;
}

async function main(argv) {
  const args = parseArgs(argv);
  if (args.help || !args.goal) {
    // eslint-disable-next-line no-console
    console.log(`AutoCode Autopilot

Usage:
  node autopilot.js "<goal>" [--verify "<cmd>"] [--max 5] [--cwd <dir>] [--dangerous] [--model <model>] [-- <extra codex args>]

Examples:
  node autopilot.js "Fix failing tests" --verify "npm test"
  node autopilot.js "Upgrade deps and keep tests green" --max 8 --dangerous
`);
    if (!args.goal) process.exitCode = 2;
    return;
  }

  const cwd = path.resolve(args.cwd);
  const verify = args.verify || detectVerifyCommand(cwd);
  if (!verify) {
    // eslint-disable-next-line no-console
    console.error('No --verify command provided and no package.json detected to infer one.');
    process.exitCode = 2;
    return;
  }

  let lastVerify = null;

  for (let i = 1; i <= args.maxIterations; i++) {
    const prompt = buildPrompt({ goal: args.goal, verify, iteration: i, lastVerify });
    const codexStatus = runCodex({
      cwd,
      prompt,
      model: args.model,
      dangerous: args.dangerous,
      extraArgs: args.codexArgs,
    });
    if (codexStatus !== 0) {
      // eslint-disable-next-line no-console
      console.error(`[autopilot] codex exited with code ${codexStatus}`);
      process.exitCode = codexStatus;
      return;
    }

    // eslint-disable-next-line no-console
    console.log(`\n[autopilot] running verify: ${verify}\n`);
    lastVerify = runShell(verify, cwd);
    if (lastVerify.code === 0) {
      // eslint-disable-next-line no-console
      console.log('\n[autopilot] ✅ verification passed\n');
      process.exitCode = 0;
      return;
    }

    // eslint-disable-next-line no-console
    console.log('\n[autopilot] ❌ verification failed; looping…\n');
  }

  // eslint-disable-next-line no-console
  console.error(`[autopilot] Gave up after ${args.maxIterations} iterations; verification still failing.`);
  process.exitCode = 1;
}

module.exports = { main };

if (require.main === module) {
  main(process.argv).catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exitCode = 1;
  });
}

