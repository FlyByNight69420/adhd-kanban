-- Seed data: 1 project, 2 phases, 5 tasks, 2 backlog items

INSERT INTO projects (name, description, prd_file_path, deployment_profile)
VALUES (
    'Anti-ADHD Kanban',
    'A focus-driven Kanban board designed for neurodivergent workflows',
    './docs/prd.md',
    'docker-compose'
);

-- Phases: MVP (active) and 1.1 (locked)
INSERT INTO phases (project_id, phase_name, phase_order, status)
VALUES
    (1, 'MVP',  1, 'active'),
    (1, '1.1',  2, 'locked');

-- Tasks with varied statuses across MVP phase
INSERT INTO tasks (project_id, phase_id, title, description, status, feature_area, priority, dependencies, task_file_path)
VALUES
    (1, 1, 'Database schema and init script',
     'Create SQLite schema with all tables, indexes, and triggers',
     'done', 'backend', 'critical', NULL,
     './tasks/mvp/001-database-schema.md'),

    (1, 1, 'REST API - project and phase endpoints',
     'CRUD endpoints for projects and phases',
     'in_progress', 'backend', 'high', '[1]',
     './tasks/mvp/002-api-projects-phases.md'),

    (1, 1, 'REST API - task endpoints',
     'CRUD and status-transition endpoints for tasks',
     'ready', 'backend', 'high', '[1]',
     './tasks/mvp/003-api-tasks.md'),

    (1, 1, 'Kanban board UI',
     'Render columns per status, cards per task, drag-and-drop',
     'ready', 'frontend', 'high', '[2, 3]',
     './tasks/mvp/004-kanban-ui.md'),

    (1, 1, 'Agent integration hook',
     'Endpoint for Claude Code agents to claim and update tasks',
     'ready', 'backend', 'medium', '[3]',
     './tasks/mvp/005-agent-hook.md');

-- Seed task_history for the tasks that have moved past 'ready'
INSERT INTO task_history (task_id, old_status, new_status)
VALUES
    (1, 'ready', 'in_progress'),
    (1, 'in_progress', 'testing'),
    (1, 'testing', 'review'),
    (1, 'review', 'done'),
    (2, 'ready', 'in_progress');

-- Phase 1.1 task
INSERT INTO tasks (project_id, phase_id, title, description, status, feature_area, priority, dependencies, task_file_path)
VALUES
    (1, 2, 'Dashboard analytics view',
     'Show velocity, burndown, and task distribution charts',
     'ready', 'frontend', 'medium', NULL,
     './tasks/1.1/001-dashboard-analytics.md');

-- Backlog items
INSERT INTO backlog (project_id, title, notes, status)
VALUES
    (1, 'Mobile-responsive layout',
     'Ensure the board works well on tablets and phones', 'unprocessed'),
    (1, 'Slack notifications on task transitions',
     'Post to a channel when tasks move to done', 'unprocessed');
