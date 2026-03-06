# Design: `generate-tasks` Skill

## Overview

A Claude Code skill that takes `project_id` and `phase_id`, reads the PRD from the database-stored path, breaks the specified phase's requirements into atomic tasks, creates one markdown file per task, inserts rows into the `tasks` table, and prints a summary.

## Invocation

```
/generate-tasks project_id=1 phase_id=1
```

Arguments: `project_id` and `phase_id` (both required). The PRD path is resolved from `projects.prd_file_path` in the database.

## Workflow

1. **Resolve context from DB** — Run SQL to get project name, `prd_file_path` from `projects` table. Get `phase_name` from `phases` table. Validate both exist and the phase belongs to the project.
2. **Read and analyze PRD** — Read the markdown file at `prd_file_path`. Identify all features and requirements belonging to the specified phase.
3. **Decompose into atomic tasks** — For each requirement, determine: title, description, feature area, priority, dependencies, files to create/modify, acceptance criteria, testing requirements, relevant context. Each task must be small enough for a single Claude Code agent to implement within one context window.
4. **Generate task IDs** — Format: `TASK-001`, `TASK-002`, etc., scoped per-phase. Query existing tasks for the phase to determine the next sequence number.
5. **Create task files** — Write each to `./projects/{project-slug}/tasks/{phase-name}/{task-id}-{task-slug}.md` using the task file template.
6. **Insert into DB** — Use `db.js` `createTask()` for each task, with `task_file_path` pointing to the created file.
7. **Print summary** — Table showing task ID, title, feature area, priority, and dependency chain.

## Task ID Format

- Structured string: `TASK-XXX` (zero-padded to 3 digits)
- Scoped per-phase: each phase starts its own sequence
- Re-runnable: query `SELECT COUNT(*) FROM tasks WHERE phase_id = ?` to find existing count, new tasks start at next number
- Dependencies stored as JSON string arrays: `["TASK-001", "TASK-003"]` — consistent in both task files and database

## Project Slug Derivation

- Lowercase the project name
- Replace spaces and special characters with hyphens
- Strip leading/trailing hyphens
- Example: "Anti-ADHD Kanban" -> `anti-adhd-kanban`

## File Structure

```
./projects/anti-adhd-kanban/tasks/mvp/TASK-001-database-schema.md
./projects/anti-adhd-kanban/tasks/mvp/TASK-002-api-projects-phases.md
./projects/anti-adhd-kanban/tasks/1.1/TASK-001-dashboard-analytics.md
```

## Task File Template

```markdown
# Task: {title}

## Task ID
{task_id}

## Phase
{phase_name}

## Feature Area
{feature_area}

## Priority
{priority}

## Dependencies
{list of TASK-XXX ids, or "None"}

## Description
{detailed description}

## Files to Create or Modify
{explicit file paths with (create) or (modify) annotations}

## Acceptance Criteria
{checklist of conditions}

## Testing Requirements
{specific tests — TDD mandatory, tests written first}

## Relevant Context
{architectural decisions, patterns, PRD references}
```

## Error Handling

- project_id not found in DB -> error message and stop
- phase_id not found or doesn't belong to project -> error message and stop
- PRD file doesn't exist at stored path -> error message and stop
- No requirements found for the phase in the PRD -> warning and stop

## Changes Required

- **New file**: `.claude/skills/generate-tasks.md` — the skill itself
- **Modify**: `seed.sql` — update `task_file_path` values to use `./projects/{slug}/tasks/{phase}/` convention and string-format dependencies

## Rules

- Every task must include a testing requirements section — TDD is mandatory
- Tasks must be atomic enough for a single Claude Code context window
- No time estimates anywhere
- Dependencies must reference valid TASK-XXX ids within the same project
- File paths must be explicit and consistent with project architecture from the PRD
- Task files are read-only once created — agents never modify them
