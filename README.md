# Anti-ADHD Kanban

A Claude Code plugin that provides a full project management workflow for AI-assisted development. It takes raw ideas through PRD generation, phase-based planning, and autonomous agent execution — all tracked against a SQLite database.

Designed for neurodivergent workflows: strict phase gates, mandatory TDD, one task at a time, and agents that escalate instead of guessing.

## Quick Start

```bash
# Install dependencies
npm install

# Initialize the database
node -e "import('./db.js').then(m => { m.initDb(); console.log('Database initialized.'); m.closeDb(); })"

# (Optional) Seed with sample data
node -e "import('./db.js').then(m => { m.initDb(); m.seedDb(); console.log('Database seeded.'); m.closeDb(); })"
```

## Install as Claude Code Plugin

```bash
claude plugin add /path/to/adhd-kanban
```

## Workflow

1. **Generate PRD** — `/generate-prd "your project idea"` transforms a raw idea into a researched PRD.
2. **Split Phases** — `/phase-splitting` breaks the PRD into sequential release phases (MVP first).
3. **Generate Tasks** — `/generate-tasks project_id=1 phase_id=1` decomposes a phase into atomic task files.
4. **Work Tasks** — Agents use `/read-task` to load task specs, implement with TDD, and commit via `/git commit_task_work`.
5. **Track Progress** — `/db-query get_phase_tasks 1 1` shows task statuses. All transitions are logged automatically.

## Skills

| Skill | Purpose |
|-------|---------|
| `generate-prd` | Raw idea → complete PRD with researched tech stack |
| `phase-splitting` | PRD → sequential release phases |
| `generate-tasks` | Phase → atomic task files + database rows |
| `db-query` | CLI for all database reads and writes |
| `read-task` | Parse task markdown into structured JSON |
| `git` | Phase worktrees, task-linked commits, rollback |

See `CLAUDE.md` for detailed usage of each skill.

## Database

SQLite via `better-sqlite3`. Five tables:

- **projects** — top-level project records with PRD file paths
- **phases** — sequential release phases (MVP, 1.1, 1.2, ...)
- **tasks** — atomic work items with status, priority, dependencies
- **task_history** — automatic audit log of every status transition
- **backlog** — unprocessed ideas for future phases

Schema in `init.sql`. Sample data in `seed.sql`.

### CLI Access

All database operations go through `db-query.js`:

```bash
node db-query.js get_task 1
node db-query.js update_task_status 1 in_progress
node db-query.js get_phase_tasks 1 1
node db-query.js create_project "My App" "./projects/my-app/PRD.md"
```

## Project Structure

```
├── CLAUDE.md              # Plugin instructions for Claude Code agents
├── README.md              # This file
├── init.sql               # Database schema
├── seed.sql               # Sample data (optional)
├── db.js                  # Database access layer
├── db-query.js            # CLI wrapper for db.js
├── package.json           # Node.js project config
├── skills/                # Claude Code skills
│   ├── db-query/SKILL.md
│   ├── generate-prd/SKILL.md
│   ├── generate-tasks/SKILL.md
│   ├── git/SKILL.md
│   ├── phase-splitting/SKILL.md
│   └── read-task/SKILL.md
├── test/                  # Tests
│   ├── helpers.js
│   └── db.test.js
└── projects/              # Generated project artifacts
    └── {project-slug}/
        ├── PRD.md
        └── tasks/{phase-name}/TASK-XXX-{slug}.md
```

## Design Decisions

- **Phase transitions are manual** — users decide when to advance, never agents.
- **TDD is mandatory** — every task requires tests written before implementation.
- **Agents never write raw SQL** — all access through `db-query.js`.
- **Git commits are tagged** — every commit includes `[task-{id}]` for traceability.
- **Worktrees per phase** — agent work is isolated in `./worktrees/{phase-name}/`.
- **Task files are immutable** — once generated, agents only update DB status.
- **Rollbacks require confirmation** — no destructive git operations without user approval.

## Running Tests

```bash
npm test
```
