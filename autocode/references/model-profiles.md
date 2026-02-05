# Model Profiles

Model profiles control which model each AutoCode agent uses. This allows balancing quality vs token spend.

## Profile Definitions

| Agent | `quality` | `balanced` | `budget` |
|-------|-----------|------------|----------|
| ac-planner | opus | opus | sonnet |
| ac-roadmapper | opus | sonnet | sonnet |
| ac-executor | opus | sonnet | sonnet |
| ac-phase-researcher | opus | sonnet | haiku |
| ac-project-researcher | opus | sonnet | haiku |
| ac-research-synthesizer | sonnet | sonnet | haiku |
| ac-debugger | opus | sonnet | sonnet |
| ac-codebase-mapper | sonnet | haiku | haiku |
| ac-verifier | sonnet | sonnet | haiku |
| ac-plan-checker | sonnet | sonnet | haiku |
| ac-integration-checker | sonnet | sonnet | haiku |

## Profile Philosophy

**quality** - Maximum reasoning power
- Opus for all decision-making agents
- Sonnet for read-only verification
- Use when: quota available, critical architecture work

**balanced** (default) - Smart allocation
- Opus only for planning (where architecture decisions happen)
- Sonnet for execution and research (follows explicit instructions)
- Sonnet for verification (needs reasoning, not just pattern matching)
- Use when: normal development, good balance of quality and cost

**budget** - Minimal Opus usage
- Sonnet for anything that writes code
- Haiku for research and verification
- Use when: conserving quota, high-volume work, less critical phases

## Resolution Logic

Orchestrators resolve model before spawning:

```
1. Read .planning/config.json
2. Get model_profile (default: "balanced")
3. Look up agent in table above
4. Pass model parameter to Task call
```

## Switching Profiles

Runtime: `/ac:set-profile <profile>`

Per-project default: Set in `.planning/config.json`:
```json
{
  "model_profile": "balanced"
}
```

## Design Rationale

**Why Opus for ac-planner?**
Planning involves architecture decisions, goal decomposition, and task design. This is where model quality has the highest impact.

**Why Sonnet for ac-executor?**
Executors follow explicit PLAN.md instructions. The plan already contains the reasoning; execution is implementation.

**Why Sonnet (not Haiku) for verifiers in balanced?**
Verification requires goal-backward reasoning - checking if code *delivers* what the phase promised, not just pattern matching. Sonnet handles this well; Haiku may miss subtle gaps.

**Why Haiku for ac-codebase-mapper?**
Read-only exploration and pattern extraction. No reasoning required, just structured output from file contents.
