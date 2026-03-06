-- Anti-ADHD Kanban: Database Schema
-- SQLite with WAL mode

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ============================================================
-- Tables
-- ============================================================

CREATE TABLE IF NOT EXISTS projects (
    project_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    prd_file_path TEXT NOT NULL,
    deployment_profile TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS phases (
    phase_id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(project_id),
    phase_name TEXT NOT NULL,
    phase_order INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'locked'
        CHECK (status IN ('active', 'locked', 'completed')),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
    task_id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(project_id),
    phase_id INTEGER NOT NULL REFERENCES phases(phase_id),
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'ready'
        CHECK (status IN ('ready', 'in_progress', 'testing', 'review', 'done')),
    feature_area TEXT,
    priority TEXT NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    dependencies TEXT,
    task_file_path TEXT NOT NULL,
    git_commit_hash TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME
);

CREATE TABLE IF NOT EXISTS task_history (
    history_id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL REFERENCES tasks(task_id),
    old_status TEXT,
    new_status TEXT NOT NULL,
    commit_hash TEXT,
    changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS backlog (
    backlog_id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(project_id),
    title TEXT NOT NULL,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'unprocessed'
        CHECK (status IN ('unprocessed', 'promoted', 'discarded')),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_tasks_project_phase_status
    ON tasks(project_id, phase_id, status);

CREATE INDEX IF NOT EXISTS idx_tasks_status
    ON tasks(status);

CREATE INDEX IF NOT EXISTS idx_task_history_task_id
    ON task_history(task_id);

CREATE INDEX IF NOT EXISTS idx_backlog_project_status
    ON backlog(project_id, status);

CREATE INDEX IF NOT EXISTS idx_phases_project_order
    ON phases(project_id, phase_order);

-- ============================================================
-- Triggers
-- ============================================================

-- 1. Log every status change to task_history
CREATE TRIGGER IF NOT EXISTS trg_task_status_history
AFTER UPDATE OF status ON tasks
WHEN OLD.status != NEW.status
BEGIN
    INSERT INTO task_history (task_id, old_status, new_status, commit_hash)
    VALUES (NEW.task_id, OLD.status, NEW.status, NEW.git_commit_hash);
END;

-- 2. Set started_at when task moves to in_progress for the first time
CREATE TRIGGER IF NOT EXISTS trg_task_started
AFTER UPDATE OF status ON tasks
WHEN NEW.status = 'in_progress' AND OLD.started_at IS NULL
BEGIN
    UPDATE tasks SET started_at = CURRENT_TIMESTAMP
    WHERE task_id = NEW.task_id;
END;

-- 3. Set completed_at when task moves to done
CREATE TRIGGER IF NOT EXISTS trg_task_completed
AFTER UPDATE OF status ON tasks
WHEN NEW.status = 'done'
BEGIN
    UPDATE tasks SET completed_at = CURRENT_TIMESTAMP
    WHERE task_id = NEW.task_id;
END;

-- 4. Update updated_at on projects
CREATE TRIGGER IF NOT EXISTS trg_projects_updated
AFTER UPDATE ON projects
BEGIN
    UPDATE projects SET updated_at = CURRENT_TIMESTAMP
    WHERE project_id = NEW.project_id;
END;

-- 5. Update updated_at on phases
CREATE TRIGGER IF NOT EXISTS trg_phases_updated
AFTER UPDATE ON phases
BEGIN
    UPDATE phases SET updated_at = CURRENT_TIMESTAMP
    WHERE phase_id = NEW.phase_id;
END;
