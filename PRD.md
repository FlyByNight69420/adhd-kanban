# PRD: Anti-ADHD Kanban System

## Summary
A Claude Code plugin and companion web interface that takes raw project ideas through to shipped code via AI-assisted PRD generation, phase-based release planning, autonomous agent execution using Claude Code Agent Teams, and a real-time web Kanban board for tracking progress.

---

## User Personas and Goals

### Primary User: Solo Developer with ADHD
- Struggles to translate ideas into structured plans without losing momentum
- Needs to capture half-formed ideas instantly before they disappear
- Works best when complexity is hidden and the next action is always obvious
- Uses Claude Code as their primary development environment
- Wants agents to do the heavy lifting while staying in control of key decisions

### Goals
- Go from raw idea (one-liner or voice transcript) to a fully structured project plan without manual effort
- See exactly what agents are working on at any given moment
- Capture new ideas instantly without derailing current work
- Maintain full traceability between requirements, tasks, commits, and shipped code
- Phase releases so the MVP is always working before new features are added

---

## Core Features

### 1. PRD Generation
The user provides raw input - either a one-liner or a transcribed voice ramble. The PRD generation skill invokes Perplexity to research best practices, recommended tech stacks, and architecture patterns relevant to the described application. It synthesises this research with the user's intent to produce a complete, structured PRD markdown file. If any aspect of the input is genuinely ambiguous, the agent uses Claude Code's questions feature to ask the user before proceeding. No time estimates are included anywhere in the PRD.

### 2. Phase Splitting
The phase splitting skill reads the completed PRD and breaks it into sequential release phases. The first phase (MVP) contains only the minimum viable feature set required for the core use case to work end to end. Subsequent phases (1.1, 1.2, etc.) layer in additional features in logical dependency order. The proposed phase breakdown is presented to the user for approval before anything is written to the database. Phase transitions are always manual - triggered by the user, never by agents.

### 3. Task Generation
The task generation skill takes a project_id and phase_id, reads the PRD from the database-stored path, and decomposes the phase's requirements into individual atomic task markdown files. Each task is sized to fit within a single Claude Code context window. One markdown file is created per task following a strict template that includes: title, description, feature area, priority, dependencies, files to create or modify, acceptance criteria, testing requirements, and relevant context. All tasks are inserted into the SQLite database. The skill is re-runnable without ID collisions, supporting the addition of promoted backlog items mid-phase.

### 4. Web Kanban Board
A multi-project web interface that displays tasks in a Kanban layout with the following columns: Ready, In Progress, Testing, Review, Done. The board updates in real time as agents update task state in the database. Features include:
- Project selector dropdown to switch between projects
- Colored tags on task cards for phase, feature area, and priority
- Multiple layout views: grouped by phase, grouped by feature area, flat filtered list
- Clickable task cards showing full task detail
- Backlog panel for adding raw ideas instantly
- Phase filter to focus on tasks within a specific phase

### 5. Backlog Capture
Users can add raw, unprocessed ideas to the backlog at any time from the Kanban interface. Backlog items have a title and optional notes. They are not assigned to any phase or broken into tasks at capture time. Before starting a new phase, the system presents unprocessed backlog items to the user one at a time for review - deciding whether each item belongs in the upcoming phase, needs its own future phase, or should be discarded.

### 6. Agent Execution via Claude Code Agent Teams
The orchestration agent acts as the Claude Code Agent Teams team lead. It reads the current active phase's ready tasks from the database, checks dependencies to determine which tasks are unblocked, and delegates them to worker agents as teammates. Worker agents run in parallel, each reading their assigned task markdown file, implementing the feature using TDD (tests written first), committing work tagged with the task ID, and updating task status in the database on completion. If a worker agent encounters a blocker it cannot resolve, it escalates to the user via Claude Code's questions feature. The orchestration agent never transitions phases - that is always a manual user action.

### 7. Git Worktrees Per Phase
Each release phase has its own git worktree. Worktrees are created before any agent work begins on a phase. All commits made during a phase are tagged with the task ID in the format `[TASK-XXX] commit message`. Commit hashes are stored in the task_history table for full traceability. Rollback is supported at the task level - reverting associated commits and resetting task status - always with explicit user confirmation.

### 8. TDD on Every Task
Every task file includes a testing requirements section specifying the exact tests that must be written and passing. Tests are written before implementation on every task without exception. The testing requirements are part of the task file template and cannot be omitted during task generation.

### 9. Agent Logging
All agent actions are logged to `.claude/logs/` within the project directory. Logs capture task delegation, status transitions, questions asked, and errors encountered.

---

## Technical Architecture

### Plugin Structure
The system is distributed as a Claude Code plugin hosted on GitHub. It installs via:
```
/plugin marketplace add https://github.com/{username}/adhd-kanban
/plugin install adhd-kanban
```

### Database
- SQLite, stored at `./kanban.db` in the project root
- WAL mode enabled for concurrent read/write performance
- Foreign key enforcement enabled
- Five tables: projects, phases, tasks, task_history, backlog
- Triggers handle: task history on status change, started_at and completed_at timestamps, updated_at on projects and phases

### Skills
Six Claude Code skills stored in `.claude/skills/`:
- `prd-generation.md` - PRD generation workflow
- `phase-splitting.md` - PRD to phases workflow
- `generate-tasks.md` - phase to atomic task files, invoked as `/generate-tasks project_id=X phase_id=X`
- `db-query.md` - clean agent interface for all database reads and writes
- `task-reader.md` - reads and parses a single task markdown file into structured JSON
- `git-integration.md` - worktree management, commit tagging, rollback

### Task Files
Stored at: `./projects/{project-slug}/tasks/{phase-name}/{TASK-XXX}-{task-slug}.md`

### Web Kanban Interface
- Single-page web application
- Polls or subscribes to SQLite for real-time updates
- Served locally, no external hosting required
- Stack: to be determined by PRD generation skill based on Perplexity research at project creation time

### Agent Execution
- Claude Code Agent Teams (experimental feature, enabled via `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`)
- oh-my-claudecode plugin installed as the agent harness
- Orchestration agent is the team lead
- Worker agents are teammates spawned on demand per task

### Version Control
- Git with one worktree per phase
- All agent commits tagged `[TASK-XXX]`
- Commit hashes stored in task_history

---

## Integrations and Dependencies

- **Claude Code** - primary execution environment
- **Claude Code Agent Teams** - parallel agent execution (experimental)
- **oh-my-claudecode** - agent harness plugin
- **Perplexity** - best practices and tech stack research during PRD generation
- **SQLite** - embedded database, no server required
- **Git** - version control with worktree support

---

## Success Metrics and Acceptance Criteria

- A raw one-liner input produces a complete, coherent PRD with justified tech stack decisions
- Phase splitting produces an MVP that is genuinely minimal and independently shippable
- Task generation produces atomic tasks that agents can implement without additional clarification in the majority of cases
- The Kanban board reflects task state changes within 2 seconds of an agent updating the database
- All agent commits are tagged with task IDs and traceable through task_history
- Rollback successfully reverts task commits and resets task status to ready
- A new user can install the plugin and run the full pipeline on a new project by following the README alone
- All generated code has test coverage as defined in the task's testing requirements section

---

## Known Constraints and Limitations

- Claude Code Agent Teams is an experimental feature and may change without notice
- SQLite is suitable for local single-user use only - not designed for multi-user or hosted environments
- The web Kanban interface is local only, not accessible remotely
- Phase transitions are intentionally manual - there is no automated phase promotion
- Perplexity integration requires a valid Perplexity API key configured in the Claude Code environment
- Task file sizing is heuristic - very complex requirements may occasionally require manual task splitting

---

## Deployment Intent

Local tool. No cloud deployment required. Distributed as a Claude Code plugin installed from GitHub. Database and task files live within the user's project directory. Web Kanban interface served locally.

---

## Workflow

### First Time Setup
1. Install the plugin via Claude Code plugin marketplace
2. Run `init.sql` to create the database schema
3. Optionally run `seed.sql` to verify the setup with sample data
4. Confirm `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is set in `~/.claude/settings.json`

### Starting a New Project
1. User provides raw input - one-liner or paste a voice transcript
2. Run the PRD generation skill - agent researches via Perplexity and produces `PRD.md`
3. Review and approve the PRD
4. Run the phase splitting skill - agent proposes phase breakdown
5. Review and approve phases
6. Run `/generate-tasks project_id=X phase_id=1` to generate MVP tasks
7. Review the task summary printed by the skill

### Running a Phase
1. Open the Kanban board - confirm MVP tasks are visible in Ready column
2. Tell the orchestration agent to begin work on the active phase
3. Orchestration agent checks dependencies, delegates unblocked tasks to worker agents
4. Worker agents implement tasks using TDD, commit work tagged with task IDs, update task status
5. Monitor progress on the Kanban board in real time
6. If an agent hits a blocker, respond to its question in Claude Code
7. Once all tasks are Done and you are satisfied with the phase, manually trigger phase transition

### Adding Backlog Items
1. Click the backlog panel on the Kanban board
2. Type a title and optional note - submit
3. Item sits as unprocessed until you trigger the pre-phase backlog review

### Pre-Phase Backlog Review
1. Before starting a new phase, trigger the backlog review
2. System presents each unprocessed item one at a time
3. For each item, decide: add to upcoming phase, create its own future phase, or discard
4. Promoted items are passed to the task generation skill to be broken into tasks
5. Discarded items are marked as discarded in the database

### Rollback
1. Identify the task to roll back
2. Run the rollback operation from the git integration skill
3. Confirm when prompted - rollback always requires explicit user confirmation
4. Associated commits are reverted, task status resets to Ready
