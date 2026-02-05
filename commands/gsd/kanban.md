---
name: gsd:kanban
description: Launch a visual Kanban board for GSD todos
allowed-tools:
  - Bash
---

<objective>
Launch a lightweight local web UI to view and manage todos in:
- `.planning/todos/pending/`
- `.planning/todos/done/`

Supports drag-and-drop between lanes (moves files between folders).
</objective>

<process>

Run:

```bash
node ~/.claude/get-shit-done/tools/kanban.js --port 3333
```

If port 3333 is in use, pick another:

```bash
node ~/.claude/get-shit-done/tools/kanban.js --port 4444
```

</process>

