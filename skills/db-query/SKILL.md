---
name: db-query
description: Read and update task/backlog state in the kanban SQLite database. Use this skill whenever you need to check task status, transition tasks, or manage the backlog. Never write raw SQL — use these commands instead.
triggers:
  - query task
  - update task status
  - get backlog
  - add backlog
  - task state
  - database query
argument-hint: "<operation> [args...]"
---

# Database Query Skill

## Purpose

Provide agents with a clean, minimal interface to read and update task/backlog state in the SQLite database. Agents never write raw SQL — all interactions go through `db-query.js`.

## When to Activate

- Agent needs to check the current status of a task
- Agent needs to transition a task between statuses
- Agent needs to read or update backlog items
- Any workflow step that reads or writes task state

## Workflow

Run the operation specified by: $ARGUMENTS

All commands are executed from the project root via `node db-query.js <operation> [args...]`.

### get_task <task_id>

```bash
node db-query.js get_task <task_id>
```

Returns the full task record including status, priority, timestamps, and commit hash.

### get_phase_tasks <project_id> <phase_id> [status]

```bash
node db-query.js get_phase_tasks <project_id> <phase_id> [status]
```

Returns all tasks in a phase. Optional status filter: `ready`, `in_progress`, `testing`, `review`, `done`.

### update_task_status <task_id> <new_status> [commit_hash]

```bash
node db-query.js update_task_status <task_id> <new_status> [commit_hash]
```

Transitions a task to a new status. Valid statuses: `ready`, `in_progress`, `testing`, `review`, `done`. The database trigger automatically logs the transition to task_history. Pass a commit hash to associate the change with a git commit.

### get_backlog <project_id> [status]

```bash
node db-query.js get_backlog <project_id> [status]
```

Returns backlog items. Optional status filter: `unprocessed`, `promoted`, `discarded`.

### add_backlog_item <project_id> <title> [notes]

```bash
node db-query.js add_backlog_item <project_id> <title> [notes]
```

Creates a new backlog item. Returns the new backlog_id.

### update_backlog_status <backlog_id> <status>

```bash
node db-query.js update_backlog_status <backlog_id> <status>
```

Updates a backlog item. Valid statuses: `unprocessed`, `promoted`, `discarded`.

## Response Format

All commands return JSON:

```json
{ "ok": true, "data": { ... } }
```

On error:

```json
{ "ok": false, "error": "description of what went wrong" }
```

### get_project <project_id>

```bash
node db-query.js get_project <project_id>
```

Returns the full project record including name, description, prd_file_path, and timestamps.

### get_phase <phase_id>

```bash
node db-query.js get_phase <phase_id>
```

Returns the full phase record including phase_name, phase_order, status, and timestamps.

### create_project <name> <prd_file_path> [description] [deployment_profile]

```bash
node db-query.js create_project "<name>" "<prd_file_path>" "[description]" "[deployment_profile]"
```

Creates a new project. Returns the new project_id.

### create_phase <project_id> <phase_name> <phase_order> [status]

```bash
node db-query.js create_phase <project_id> "<phase_name>" <phase_order> [status]
```

Creates a new phase. Status defaults to `locked`. Valid statuses: `active`, `locked`, `completed`. Returns the new phase_id.

### create_task <project_id> <phase_id> <title> <priority> <task_file_path> [description] [feature_area] [dependencies_json]

```bash
node db-query.js create_task <project_id> <phase_id> "<title>" <priority> "<task_file_path>" "[description]" "[feature_area]" '[dependencies_json]'
```

Creates a new task. Valid priorities: `low`, `medium`, `high`, `critical`. Dependencies must be a JSON array string like `'["TASK-001"]'`. Returns the new task_id.

## Notes

- Always check `ok` in the response before using `data`
- Quote titles and notes that contain spaces: `node db-query.js add_backlog_item 1 "My new item" "Some notes"`
- Never bypass this skill to write raw SQL against the database
- All writes respect foreign key constraints
- `update_task_status` triggers automatic task_history logging via database trigger
