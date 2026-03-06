# ADHD Kanban — Agent Setup Instructions

You are an AI agent being asked to install adhd-kanban, a project management system for AI-assisted development. Follow these steps exactly.

## Step 1: Clone the repository

```bash
git clone https://github.com/FlyByNight69420/adhd-kanban.git
cd adhd-kanban
```

If the repository is already cloned, `cd` into it instead.

## Step 2: Install dependencies

```bash
npm install
```

## Step 3: Initialize the database

```bash
node -e "import('./db.js').then(m => { m.initDb(); console.log('Database initialized.'); m.closeDb(); })"
```

## Step 4: Register skills as Claude Code slash commands

The repository includes a `.claude/commands/` directory with symlinks to all skills. If the symlinks resolved correctly after cloning, you're done — the skills are already available as slash commands.

Verify by checking that these files exist and are readable:

```bash
ls -la .claude/commands/
```

You should see these commands linked to their skill files:

| Command file | Skill source |
|---|---|
| `.claude/commands/db-query.md` | `skills/db-query/SKILL.md` |
| `.claude/commands/generate-prd.md` | `skills/generate-prd/SKILL.md` |
| `.claude/commands/generate-tasks.md` | `skills/generate-tasks/SKILL.md` |
| `.claude/commands/git.md` | `skills/git/SKILL.md` |
| `.claude/commands/phase-splitting.md` | `skills/phase-splitting/SKILL.md` |
| `.claude/commands/read-task.md` | `skills/read-task/SKILL.md` |
| `.claude/commands/work-phase.md` | `skills/work-phase/SKILL.md` |

**If any symlinks are broken** (e.g. cloned on Windows or the links didn't resolve), recreate them:

```bash
mkdir -p .claude/commands
ln -sf ../../skills/db-query/SKILL.md .claude/commands/db-query.md
ln -sf ../../skills/generate-prd/SKILL.md .claude/commands/generate-prd.md
ln -sf ../../skills/generate-tasks/SKILL.md .claude/commands/generate-tasks.md
ln -sf ../../skills/git/SKILL.md .claude/commands/git.md
ln -sf ../../skills/phase-splitting/SKILL.md .claude/commands/phase-splitting.md
ln -sf ../../skills/read-task/SKILL.md .claude/commands/read-task.md
ln -sf ../../skills/work-phase/SKILL.md .claude/commands/work-phase.md
```

## Step 5: Verify

Run the test suite to confirm everything works:

```bash
npm test
```

Read the project instructions:

```bash
cat CLAUDE.md
```

The `CLAUDE.md` file contains the rules and conventions all agents must follow when working in this project.

## What you now have

After setup, the following slash commands are available in Claude Code when working in this project:

- `/generate-prd` — Transform a raw idea into a complete PRD
- `/phase-splitting` — Break a PRD into sequential release phases
- `/generate-tasks` — Decompose a phase into atomic task files
- `/db-query` — Read and update project/task/backlog state
- `/read-task` — Parse a task markdown file into structured JSON
- `/git` — Phase worktrees, task-linked commits, rollback
- `/work-phase` — Orchestrate parallel agent execution of a full phase

## Typical workflow

```
/generate-prd "your project idea here"
/phase-splitting prd_path=./projects/{slug}/PRD.md project_id=1
/generate-tasks project_id=1 phase_id=1
/work-phase project_id=1 phase_id=1
```

## Key rules

- **TDD is mandatory** — tests before implementation, always.
- **Agents never write raw SQL** — use `/db-query` or `db-query.js`.
- **Phase transitions are manual** — only the user advances phases.
- **Every commit must be tagged** with `[task-{id}]`.
- **Escalate blockers** — never guess, ask the user.

Report to the user that setup is complete and list the available slash commands.
