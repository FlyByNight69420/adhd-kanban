---
name: git
description: Manage git operations for the ADHD Kanban system. Use when committing task work, creating phase worktrees, viewing task commit history, or rolling back task changes. Every agent commit must be linked to a task_id.
triggers:
  - commit task
  - phase worktree
  - init worktree
  - task commits
  - rollback task
  - git commit
argument-hint: "<operation> <args>"
---

# Git Integration

Manage git operations for the ADHD Kanban system. All commits must be linked to tasks, worktrees are per-phase, and rollbacks require user confirmation.

Run the operation specified by: $ARGUMENTS

## Prerequisites

Before any operation, check if git is initialised in the project root. If `git rev-parse --git-dir` fails, run:

```bash
git init
echo -e "node_modules/\n*.db\n.omc/\nworktrees/" > .gitignore
git add .gitignore init.sql seed.sql db.js package.json
git commit -m "[system] Initial commit - project scaffold"
```

## Operations

### init_phase_worktree <project_id> <phase_id> <phase_name>

Creates a git worktree for a phase so agent work is isolated per-phase.

Steps:
1. Ensure git is initialised (see Prerequisites).
2. Create a branch named `phase/{phase_name}` from the current HEAD:
   ```bash
   git branch phase/{phase_name}
   ```
3. Create the worktree at `./worktrees/{phase_name}/`:
   ```bash
   git worktree add ./worktrees/{phase_name} phase/{phase_name}
   ```
4. Confirm to the user that the worktree is ready and print the path.

If the branch or worktree already exists, inform the user and skip creation.

### commit_task_work <task_id> <commit_message>

Stages all changes in the current worktree and creates a commit linked to the task.

Steps:
1. Determine the current working directory to identify which worktree/branch you're in.
2. Stage all changed files:
   ```bash
   git add -A
   ```
3. Create the commit with the required message format:
   ```bash
   git commit -m "[task-{task_id}] {commit_message}"
   ```
4. Capture the commit hash:
   ```bash
   git rev-parse HEAD
   ```
5. Update the task record in the database using the `db-query.js` CLI. First get the current status, then update with the commit hash:
   ```bash
   node db-query.js update_task_status {task_id} {current_status} {commit_hash}
   ```
6. Report the commit hash to the user.

If there are no changes to commit, inform the user and do nothing.

### get_task_commits <task_id>

Returns all commits associated with a task.

Steps:
1. Query the database for the task record and its current commit hash:
   ```bash
   node db-query.js get_task {task_id}
   ```
2. Search the git log for all commits tagged with this task:
   ```bash
   git log --oneline --all --grep="\[task-{task_id}\]"
   ```
3. Present both the database record's `git_commit_hash` and the git log results to the user.

### rollback_task <task_id>

Reverts commits associated with a task. **Always asks for user confirmation before executing.**

Steps:
1. Get the task's current state:
   ```bash
   node db-query.js get_task {task_id}
   ```
2. Search the git log for all commits matching `[task-{task_id}]`:
   ```bash
   git log --oneline --all --grep="\[task-{task_id}\]"
   ```
3. Present the list of commits that will be reverted to the user.
4. **Ask the user for explicit confirmation** using the AskUserQuestion tool: "These commits for task {task_id} will be reverted: {list}. Proceed?"
5. Only if the user confirms, revert each commit (newest first) using:
   ```bash
   git revert --no-edit {commit_hash}
   ```
6. After reverting, reset the task status back to `ready` and clear its commit hash:
   ```bash
   node db-query.js update_task_status {task_id} ready
   ```
7. Report the result to the user.

If the user declines, abort and inform them nothing was changed.

## Rules

- **Every commit must include `[task-{task_id}]` in the message.** No untagged commits from agents.
- **Worktrees are created per phase** before any agent work begins on that phase.
- **Rollback always requires explicit user confirmation** via the AskUserQuestion tool.
- **Handle missing git init** - if the repo isn't initialised, run `git init` automatically (see Prerequisites).
- When working inside a worktree, all git commands operate relative to that worktree's directory.
- Never force-push or use destructive git operations without explicit user approval.
- All database operations go through `db-query.js` - never write raw SQL.
