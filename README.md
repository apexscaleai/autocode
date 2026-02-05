<div align="center">

# AUTOCODE

**AutoCode is a lightweight meta-prompting + context engineering + spec-driven development system for Claude Code, OpenCode, Gemini CLI, and Codex CLI.**

**Forked from Get Shit Done by TÂCHES (MIT).**

[![npm version](https://img.shields.io/npm/v/autocode-ac?style=for-the-badge&logo=npm&logoColor=white&color=CB3837)](https://www.npmjs.com/package/autocode-ac)
[![npm downloads](https://img.shields.io/npm/dm/autocode-ac?style=for-the-badge&logo=npm&logoColor=white&color=CB3837)](https://www.npmjs.com/package/autocode-ac)
[![Discord](https://img.shields.io/badge/Discord-Join%20Server-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/5JJgD5svVS)
[![GitHub stars](https://img.shields.io/github/stars/apexscaleai/autocode?style=for-the-badge&logo=github&color=181717)](https://github.com/apexscaleai/autocode)
[![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)

<br>

```bash
npx autocode-ac
```

**Works on Mac, Windows, and Linux.**

<br>

![AutoCode Install](assets/terminal.svg)

<br>

[Why AutoCode](#why-autocode) · [How It Works](#how-it-works) · [Getting Started](#getting-started) · [Commands](#commands)

</div>

---

## Why AutoCode

AutoCode is maintained by **ApexScaleAI**.

It’s forked from **Get Shit Done**, originally created by **TÂCHES**, and keeps the same philosophy: the complexity lives in the system (context engineering, structured prompts, state management), not in your workflow.

---

If you know what you want, AutoCode helps you drive a CLI coding agent through a repeatable loop:

- Clarify goals and constraints
- Capture decisions in `.planning/`
- Plan into executable waves
- Execute with atomic commits and verification gates

### Upgrade From Get Shit Done (GSD)

AutoCode is a fork that adds:

- A clean `/ac:*` command namespace (and `$ac` for Codex)
- Codex CLI support (installs as a Codex skill)
- Optional Kanban UI and Autopilot loop utilities
- Installer UX and compatibility tweaks for multi-runtime installs

---

## Who This Is For

People who want to describe what they want and have it built correctly — without pretending they're running a 50-person engineering org.

---

## Getting Started

```bash
npx autocode-ac
```

The installer prompts you to choose:
1. **Runtime** — Claude Code, OpenCode, Gemini, Codex, or all
2. **Location** — Global (all projects) or local (current project only)

Verify inside your chosen runtime:
- Claude Code / Gemini: `/ac:help`
- OpenCode: `/ac-help`
- Codex: `$ac help` (restart Codex after install)

### Staying Updated

AutoCode evolves fast. Update periodically:

```bash
npx autocode-ac@latest
```

<details>
<summary><strong>Non-interactive Install (Docker, CI, Scripts)</strong></summary>

```bash
# Claude Code
npx autocode-ac --claude --global   # Install to ~/.claude/
npx autocode-ac --claude --local    # Install to ./.claude/

# OpenCode (open source, free models)
npx autocode-ac --opencode --global # Install to ~/.config/opencode/

# Gemini CLI
npx autocode-ac --gemini --global   # Install to ~/.gemini/

# Codex CLI (installs a Codex Skill)
npx autocode-ac --codex --global    # Install to ~/.codex/skills/ac/

# All runtimes
npx autocode-ac --all --global      # Install to all directories
```

Use `--global` (`-g`) or `--local` (`-l`) to skip the location prompt.
Use `--claude`, `--opencode`, `--gemini`, `--codex`, or `--all` to skip the runtime prompt.

</details>

<details>
<summary><strong>Development Installation</strong></summary>

Clone the repository and run the installer locally:

```bash
git clone https://github.com/apexscaleai/autocode.git
cd autocode
npm install
npm run build:hooks
node bin/install.js --claude --local
```

Installs to `./.claude/` for testing modifications before contributing.

</details>

### Recommended: Skip Permissions Mode

AutoCode is designed for frictionless automation. Run Claude Code with:

```bash
claude --dangerously-skip-permissions
```

> [!TIP]
> This is how AutoCode is intended to be used — stopping to approve `date` and `git commit` 50 times defeats the purpose.

<details>
<summary><strong>Alternative: Granular Permissions</strong></summary>

If you prefer not to use that flag, add this to your project's `.claude/settings.json`:

```json
{
  "permissions": {
    "allow": [
      "Bash(date:*)",
      "Bash(echo:*)",
      "Bash(cat:*)",
      "Bash(ls:*)",
      "Bash(mkdir:*)",
      "Bash(wc:*)",
      "Bash(head:*)",
      "Bash(tail:*)",
      "Bash(sort:*)",
      "Bash(grep:*)",
      "Bash(tr:*)",
      "Bash(git add:*)",
      "Bash(git commit:*)",
      "Bash(git status:*)",
      "Bash(git log:*)",
      "Bash(git diff:*)",
      "Bash(git tag:*)"
    ]
  }
}
```

</details>

---

## How It Works

> **Already have code?** Run `/ac:map-codebase` first. It spawns parallel agents to analyze your stack, architecture, conventions, and concerns. Then `/ac:new-project` knows your codebase — questions focus on what you're adding, and planning automatically loads your patterns.

### 1. Initialize Project

```
/ac:new-project
```

One command, one flow. The system:

1. **Questions** — Asks until it understands your idea completely (goals, constraints, tech preferences, edge cases)
2. **Research** — Spawns parallel agents to investigate the domain (optional but recommended)
3. **Requirements** — Extracts what's v1, v2, and out of scope
4. **Roadmap** — Creates phases mapped to requirements

You approve the roadmap. Now you're ready to build.

**Creates:** `PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`, `.planning/research/`

---

### 2. Discuss Phase

```
/ac:discuss-phase 1
```

**This is where you shape the implementation.**

Your roadmap has a sentence or two per phase. That's not enough context to build something the way *you* imagine it. This step captures your preferences before anything gets researched or planned.

The system analyzes the phase and identifies gray areas based on what's being built:

- **Visual features** → Layout, density, interactions, empty states
- **APIs/CLIs** → Response format, flags, error handling, verbosity
- **Content systems** → Structure, tone, depth, flow
- **Organization tasks** → Grouping criteria, naming, duplicates, exceptions

For each area you select, it asks until you're satisfied. The output — `CONTEXT.md` — feeds directly into the next two steps:

1. **Researcher reads it** — Knows what patterns to investigate ("user wants card layout" → research card component libraries)
2. **Planner reads it** — Knows what decisions are locked ("infinite scroll decided" → plan includes scroll handling)

The deeper you go here, the more the system builds what you actually want. Skip it and you get reasonable defaults. Use it and you get *your* vision.

**Creates:** `{phase}-CONTEXT.md`

---

### 3. Plan Phase

```
/ac:plan-phase 1
```

The system:

1. **Researches** — Investigates how to implement this phase, guided by your CONTEXT.md decisions
2. **Plans** — Creates 2-3 atomic task plans with XML structure
3. **Verifies** — Checks plans against requirements, loops until they pass

Each plan is small enough to execute in a fresh context window. No degradation, no "I'll be more concise now."

**Creates:** `{phase}-RESEARCH.md`, `{phase}-{N}-PLAN.md`

---

### 4. Execute Phase

```
/ac:execute-phase 1
```

The system:

1. **Runs plans in waves** — Parallel where possible, sequential when dependent
2. **Fresh context per plan** — 200k tokens purely for implementation, zero accumulated garbage
3. **Commits per task** — Every task gets its own atomic commit
4. **Verifies against goals** — Checks the codebase delivers what the phase promised

Walk away, come back to completed work with clean git history.

**Creates:** `{phase}-{N}-SUMMARY.md`, `{phase}-VERIFICATION.md`

---

### 5. Verify Work

```
/ac:verify-work 1
```

**This is where you confirm it actually works.**

Automated verification checks that code exists and tests pass. But does the feature *work* the way you expected? This is your chance to use it.

The system:

1. **Extracts testable deliverables** — What you should be able to do now
2. **Walks you through one at a time** — "Can you log in with email?" Yes/no, or describe what's wrong
3. **Diagnoses failures automatically** — Spawns debug agents to find root causes
4. **Creates verified fix plans** — Ready for immediate re-execution

If everything passes, you move on. If something's broken, you don't manually debug — you just run `/ac:execute-phase` again with the fix plans it created.

**Creates:** `{phase}-UAT.md`, fix plans if issues found

---

### 6. Repeat → Complete → Next Milestone

```
/ac:discuss-phase 2
/ac:plan-phase 2
/ac:execute-phase 2
/ac:verify-work 2
...
/ac:complete-milestone
/ac:new-milestone
```

Loop **discuss → plan → execute → verify** until milestone complete.

Each phase gets your input (discuss), proper research (plan), clean execution (execute), and human verification (verify). Context stays fresh. Quality stays high.

When all phases are done, `/ac:complete-milestone` archives the milestone and tags the release.

Then `/ac:new-milestone` starts the next version — same flow as `new-project` but for your existing codebase. You describe what you want to build next, the system researches the domain, you scope requirements, and it creates a fresh roadmap. Each milestone is a clean cycle: define → build → ship.

---

### Quick Mode

```
/ac:quick
```

**For ad-hoc tasks that don't need full planning.**

Quick mode gives you AutoCode guarantees (atomic commits, state tracking) with a faster path:

- **Same agents** — Planner + executor, same quality
- **Skips optional steps** — No research, no plan checker, no verifier
- **Separate tracking** — Lives in `.planning/quick/`, not phases

Use for: bug fixes, small features, config changes, one-off tasks.

```
/ac:quick
> What do you want to do? "Add dark mode toggle to settings"
```

**Creates:** `.planning/quick/001-add-dark-mode-toggle/PLAN.md`, `SUMMARY.md`

---

## Why It Works

### Context Engineering

Claude Code is incredibly powerful *if* you give it the context it needs. Most people don't.

AutoCode handles it for you:

| File | What it does |
|------|--------------|
| `PROJECT.md` | Project vision, always loaded |
| `research/` | Ecosystem knowledge (stack, features, architecture, pitfalls) |
| `REQUIREMENTS.md` | Scoped v1/v2 requirements with phase traceability |
| `ROADMAP.md` | Where you're going, what's done |
| `STATE.md` | Decisions, blockers, position — memory across sessions |
| `PLAN.md` | Atomic task with XML structure, verification steps |
| `SUMMARY.md` | What happened, what changed, committed to history |
| `todos/` | Captured ideas and tasks for later work |

Size limits based on where Claude's quality degrades. Stay under, get consistent excellence.

### XML Prompt Formatting

Every plan is structured XML optimized for Claude:

```xml
<task type="auto">
  <name>Create login endpoint</name>
  <files>src/app/api/auth/login/route.ts</files>
  <action>
    Use jose for JWT (not jsonwebtoken - CommonJS issues).
    Validate credentials against users table.
    Return httpOnly cookie on success.
  </action>
  <verify>curl -X POST localhost:3000/api/auth/login returns 200 + Set-Cookie</verify>
  <done>Valid credentials return cookie, invalid return 401</done>
</task>
```

Precise instructions. No guessing. Verification built in.

### Multi-Agent Orchestration

Every stage uses the same pattern: a thin orchestrator spawns specialized agents, collects results, and routes to the next step.

| Stage | Orchestrator does | Agents do |
|-------|------------------|-----------|
| Research | Coordinates, presents findings | 4 parallel researchers investigate stack, features, architecture, pitfalls |
| Planning | Validates, manages iteration | Planner creates plans, checker verifies, loop until pass |
| Execution | Groups into waves, tracks progress | Executors implement in parallel, each with fresh 200k context |
| Verification | Presents results, routes next | Verifier checks codebase against goals, debuggers diagnose failures |

The orchestrator never does heavy lifting. It spawns agents, waits, integrates results.

**The result:** You can run an entire phase — deep research, multiple plans created and verified, thousands of lines of code written across parallel executors, automated verification against goals — and your main context window stays at 30-40%. The work happens in fresh subagent contexts. Your session stays fast and responsive.

### Atomic Git Commits

Each task gets its own commit immediately after completion:

```bash
abc123f docs(08-02): complete user registration plan
def456g feat(08-02): add email confirmation flow
hij789k feat(08-02): implement password hashing
lmn012o feat(08-02): create registration endpoint
```

> [!NOTE]
> **Benefits:** Git bisect finds exact failing task. Each task independently revertable. Clear history for Claude in future sessions. Better observability in AI-automated workflow.

Every commit is surgical, traceable, and meaningful.

### Modular by Design

- Add phases to current milestone
- Insert urgent work between phases
- Complete milestones and start fresh
- Adjust plans without rebuilding everything

You're never locked in. The system adapts.

---

## Commands

### Core Workflow

| Command | What it does |
|---------|--------------|
| `/ac:new-project` | Full initialization: questions → research → requirements → roadmap |
| `/ac:discuss-phase [N]` | Capture implementation decisions before planning |
| `/ac:plan-phase [N]` | Research + plan + verify for a phase |
| `/ac:execute-phase <N>` | Execute all plans in parallel waves, verify when complete |
| `/ac:verify-work [N]` | Manual user acceptance testing ¹ |
| `/ac:audit-milestone` | Verify milestone achieved its definition of done |
| `/ac:complete-milestone` | Archive milestone, tag release |
| `/ac:new-milestone [name]` | Start next version: questions → research → requirements → roadmap |

### Navigation

| Command | What it does |
|---------|--------------|
| `/ac:progress` | Where am I? What's next? |
| `/ac:help` | Show all commands and usage guide |
| `/ac:update` | Update AutoCode with changelog preview |
| `/ac:join-discord` | Join the AutoCode Discord community |

### Brownfield

| Command | What it does |
|---------|--------------|
| `/ac:map-codebase` | Analyze existing codebase before new-project |

### Phase Management

| Command | What it does |
|---------|--------------|
| `/ac:add-phase` | Append phase to roadmap |
| `/ac:insert-phase [N]` | Insert urgent work between phases |
| `/ac:remove-phase [N]` | Remove future phase, renumber |
| `/ac:list-phase-assumptions [N]` | See Claude's intended approach before planning |
| `/ac:plan-milestone-gaps` | Create phases to close gaps from audit |

### Session

| Command | What it does |
|---------|--------------|
| `/ac:pause-work` | Create handoff when stopping mid-phase |
| `/ac:resume-work` | Restore from last session |

### Utilities

| Command | What it does |
|---------|--------------|
| `/ac:settings` | Configure model profile and workflow agents |
| `/ac:set-profile <profile>` | Switch model profile (quality/balanced/budget) |
| `/ac:add-todo [desc]` | Capture idea for later |
| `/ac:check-todos` | List pending todos |
| `/ac:debug [desc]` | Systematic debugging with persistent state |
| `/ac:quick` | Execute ad-hoc task with AutoCode guarantees |

<sup>¹ Contributed by reddit user OracleGreyBeard</sup>

---

## Configuration

AutoCode stores project settings in `.planning/config.json`. Configure during `/ac:new-project` or update later with `/ac:settings`.

### Core Settings

| Setting | Options | Default | What it controls |
|---------|---------|---------|------------------|
| `mode` | `yolo`, `interactive` | `interactive` | Auto-approve vs confirm at each step |
| `depth` | `quick`, `standard`, `comprehensive` | `standard` | Planning thoroughness (phases × plans) |

### Model Profiles

Control which Claude model each agent uses. Balance quality vs token spend.

| Profile | Planning | Execution | Verification |
|---------|----------|-----------|--------------|
| `quality` | Opus | Opus | Sonnet |
| `balanced` (default) | Opus | Sonnet | Sonnet |
| `budget` | Sonnet | Sonnet | Haiku |

Switch profiles:
```
/ac:set-profile budget
```

Or configure via `/ac:settings`.

### Workflow Agents

These spawn additional agents during planning/execution. They improve quality but add tokens and time.

| Setting | Default | What it does |
|---------|---------|--------------|
| `workflow.research` | `true` | Researches domain before planning each phase |
| `workflow.plan_check` | `true` | Verifies plans achieve phase goals before execution |
| `workflow.verifier` | `true` | Confirms must-haves were delivered after execution |

Use `/ac:settings` to toggle these, or override per-invocation:
- `/ac:plan-phase --skip-research`
- `/ac:plan-phase --skip-verify`

### Execution

| Setting | Default | What it controls |
|---------|---------|------------------|
| `parallelization.enabled` | `true` | Run independent plans simultaneously |
| `planning.commit_docs` | `true` | Track `.planning/` in git |

### Git Branching

Control how AutoCode handles branches during execution.

| Setting | Options | Default | What it does |
|---------|---------|---------|--------------|
| `git.branching_strategy` | `none`, `phase`, `milestone` | `none` | Branch creation strategy |
| `git.phase_branch_template` | string | `ac/phase-{phase}-{slug}` | Template for phase branches |
| `git.milestone_branch_template` | string | `ac/{milestone}-{slug}` | Template for milestone branches |

**Strategies:**
- **`none`** — Commits to current branch (default AutoCode behavior)
- **`phase`** — Creates a branch per phase, merges at phase completion
- **`milestone`** — Creates one branch for entire milestone, merges at completion

At milestone completion, AutoCode offers squash merge (recommended) or merge with history.

---

## Troubleshooting

**Commands not found after install?**
- Restart your runtime to reload commands/skills
- Verify files exist:
  - Claude Code: `~/.claude/commands/ac/` (global) or `./.claude/commands/ac/` (local)
  - OpenCode: `~/.config/opencode/command/` (global)
  - Gemini: `~/.gemini/commands/ac/` (global)
  - Codex: `~/.codex/skills/ac/` (global)

**Commands not working as expected?**
- Run `/ac:help` (Claude/Gemini) or `/ac-help` (OpenCode) or `$ac help` (Codex) to verify installation
- Re-run `npx autocode-ac` to reinstall

**Updating to the latest version?**
```bash
npx autocode-ac@latest
```

**Using Docker or containerized environments?**

If file reads fail with tilde paths (`~/.claude/...`), set `CLAUDE_CONFIG_DIR` before installing:
```bash
CLAUDE_CONFIG_DIR=/home/youruser/.claude npx autocode-ac --global
```
This ensures absolute paths are used instead of `~` which may not expand correctly in containers.

### Uninstalling

To remove AutoCode completely:

```bash
# Global installs
npx autocode-ac --claude --global --uninstall
npx autocode-ac --opencode --global --uninstall
npx autocode-ac --codex --global --uninstall

# Local installs (current project)
npx autocode-ac --claude --local --uninstall
npx autocode-ac --opencode --local --uninstall
npx autocode-ac --codex --local --uninstall
```

This removes all AutoCode commands, agents, hooks, and settings while preserving your other configurations.

---

## Community Ports

OpenCode, Gemini CLI, and Codex CLI are now natively supported via `npx autocode-ac`.

These community ports pioneered multi-runtime support:

| Project | Platform | Description |
|---------|----------|-------------|
| [ac-opencode](https://github.com/rokicool/ac-opencode) | OpenCode | Original OpenCode adaptation |
| [ac-gemini](https://github.com/uberfuzzy/ac-gemini) | Gemini CLI | Original Gemini adaptation |

---

## Star History

<a href="https://star-history.com/#apexscaleai/autocode&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=apexscaleai/autocode&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=apexscaleai/autocode&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=apexscaleai/autocode&type=Date" />
 </picture>
</a>

---

## License

MIT License. See [LICENSE](LICENSE) for details.

---

<div align="center">

**Claude Code is powerful. AutoCode makes it reliable.**

</div>
