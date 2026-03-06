# Anti-ADHD Kanban — Claude Code Plugin

A project management workflow for AI-assisted development. Takes raw ideas through PRD generation, phase-based planning, and autonomous agent execution tracked against a SQLite database.

## Available Skills

All skills are in `skills/<name>/SKILL.md`. Agents should use these instead of writing raw SQL or ad-hoc scripts.

### generate-prd
Transform a raw idea, one-liner, or voice transcript into a complete PRD with researched tech stack decisions.
```
/generate-prd "I want to build a ..."
```

### phase-splitting
Break a completed PRD into sequential release phases (MVP, 1.1, 1.2, ...). User approves before any database writes.
```
/phase-splitting prd_path=./projects/{slug}/PRD.md project_id=1
```

### generate-tasks
Decompose a PRD phase into atomic task files and database rows. Each task includes mandatory TDD requirements.
```
/generate-tasks project_id=1 phase_id=1
```

### db-query
Read and update task/backlog/project/phase state via CLI. Agents never write raw SQL.
```
/db-query get_task 1
/db-query update_task_status 1 in_progress
/db-query create_project "Name" "./path/PRD.md"
/db-query create_phase 1 "MVP" 1 active
```
Full list: `get_task`, `get_phase_tasks`, `update_task_status`, `get_backlog`, `add_backlog_item`, `update_backlog_status`, `get_project`, `get_phase`, `create_project`, `create_phase`, `create_task`.

### read-task
Parse a task markdown file into structured JSON. First thing a worker agent calls when delegated a task.
```
/read-task ./projects/{slug}/tasks/{phase}/{TASK-XXX}-{slug}.md
```

### git
Manage git operations linked to tasks. Worktrees per phase, commits tagged `[task-{id}]`, rollback with user confirmation.
```
/git init_phase_worktree 1 1 mvp
/git commit_task_work 3 "Implement REST endpoints"
/git get_task_commits 3
/git rollback_task 3
```

## Key Rules

- **Phase transitions are manual** — users trigger them, never agents.
- **TDD is mandatory** — every task requires tests written before implementation.
- **Agents never write raw SQL** — all database access goes through `db-query.js`.
- **Agents escalate blockers** — never guess, ask the user.
- **Task files are read-only** — agents update status in the database, never the markdown files.
- **Every agent commit must be tagged** with `[task-{id}]` in the message.
- **Rollbacks require user confirmation** — no destructive git operations without approval.

## Database

- Schema: `init.sql`
- Seed data: `seed.sql` (optional, for testing)
- Access layer: `db.js`
- CLI wrapper: `db-query.js`

Tables: `projects`, `phases`, `tasks`, `task_history`, `backlog`.

## Task File Convention

```
./projects/{project-slug}/tasks/{phase-name}/{TASK-XXX}-{task-slug}.md
```

Dependencies are stored as JSON string arrays: `["TASK-001", "TASK-003"]`.

## Bootstrapping

```bash
npm install
node -e "import('./db.js').then(m => { m.initDb(); m.closeDb(); })"
# Optional: seed with sample data
node -e "import('./db.js').then(m => { m.initDb(); m.seedDb(); m.closeDb(); })"
```
