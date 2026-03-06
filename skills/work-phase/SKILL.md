---
name: work-phase
description: Orchestrate execution of all tasks in a phase. Use as the team lead playbook with /team to delegate unblocked tasks to worker agents in parallel, monitor completion, and cascade through dependencies until the phase is done.
triggers:
  - work phase
  - run phase
  - execute phase
  - start phase work
argument-hint: "project_id=<id> [phase_id=<id>]"
---

# Work Phase — Orchestrator Playbook

Drive all tasks in a phase to completion by delegating unblocked tasks to parallel worker agents.

## Arguments

- `project_id` (required) — the project to work on
- `phase_id` (optional) — defaults to the active phase for the project

Parse from: $ARGUMENTS

## Orchestrator Protocol

You are the team lead. You do NOT implement tasks yourself. You delegate to worker agents and monitor progress.

### Step 1: Load Phase Context

```bash
# Get the project
node db-query.js get_project <project_id>

# Get phases (find active one if phase_id not provided)
node db-query.js get_phase <phase_id>
```

Confirm the phase status is `active`. If it is `locked` or `completed`, stop and tell the user.

### Step 2: Scan for Unblocked Tasks

```bash
# Returns ready tasks with all dependencies satisfied
curl -s http://localhost:3000/api/phases/<phase_id>/unblocked
```

If no unblocked tasks exist:
- If all tasks are `done` → phase is complete, report summary and stop
- If tasks remain but all are blocked → report the dependency deadlock and stop
- If tasks are `in_progress`/`testing`/`review` → wait for them to complete, then re-scan

### Step 3: Claim and Delegate

For each unblocked task returned:

1. **Claim it** to prevent other agents from grabbing it:
   ```bash
   curl -s -X POST http://localhost:3000/api/tasks/<task_id>/claim
   ```
   If claim returns 409 (already claimed), skip it.

2. **Delegate to a worker agent** with this prompt:

   ```
   You are a worker agent implementing a single task.

   TASK FILE: <task_file_path>
   TASK ID: <task_id>
   PROJECT ROOT: /home/nick/Development/adhd-kanban

   ## Your Protocol

   1. Read the task spec:
      node db-query.js get_task <task_id>

   2. Read the task markdown file if it exists for full requirements.

   3. Implement using TDD:
      - Write tests FIRST based on acceptance criteria and testing requirements
      - Run tests, confirm they fail
      - Write implementation to make tests pass
      - Run tests, confirm they pass

   4. Commit your work:
      Use: node db-query.js update_task_status <task_id> done

   5. All git commits MUST include [task-<task_id>] in the message.

   ## Rules — DO NOT VIOLATE

   - Tests before implementation. Always.
   - Never modify task markdown files — they are read-only specs.
   - Never transition phases — only the user does that.
   - Never write raw SQL — use db-query.js or the REST API.
   - If you hit a blocker you cannot resolve, STOP and escalate to the user.
     Do not guess. Do not work around it silently.
   - Keep changes minimal and focused on the task scope.
   ```

3. **Delegate all unblocked tasks in parallel** — do not wait for one to finish before starting the next.

### Step 4: Monitor and Cascade

After delegating, monitor worker completion. When any worker finishes:

1. Re-scan for unblocked tasks:
   ```bash
   curl -s http://localhost:3000/api/phases/<phase_id>/unblocked
   ```

2. If new tasks are now unblocked (their dependencies just completed), claim and delegate them.

3. Repeat until:
   - All phase tasks are `done` → report success
   - Remaining tasks are all blocked with no in-progress work → report deadlock
   - A worker escalates a blocker → surface it to the user

### Step 5: Phase Complete

When all tasks are done:

1. Report a summary:
   - Total tasks completed
   - Any tasks that required escalation
   - Feature areas covered

2. **Do NOT transition the phase.** Tell the user the phase is ready for their review and they can transition it when satisfied.

## Rules for the Orchestrator

- You delegate, you do not implement.
- Never claim a task you intend to work on yourself.
- Never skip TDD — if a worker skips tests, reject their work.
- Never auto-transition phases.
- All database access goes through `db-query.js` or the REST API at `http://localhost:3000`.
- If the server is not running, start it: `node server.js &`
- Escalate blockers to the user immediately. Do not retry silently.

## API Quick Reference

| Action | Method |
|--------|--------|
| Get unblocked tasks | `GET /api/phases/:id/unblocked` |
| Claim a task | `POST /api/tasks/:id/claim` |
| Get task detail | `GET /api/tasks/:id` |
| Update task status | `PATCH /api/tasks/:id/status` with `{"status":"..."}` |
| Get phase tasks | `GET /api/phases/:id/tasks` |
| Get board view | `GET /api/phases/:id/board` |
