import Database from "better-sqlite3";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DB_PATH = resolve(__dirname, "kanban.db");

let _db = null;

export function getDb(dbPath = DEFAULT_DB_PATH) {
  if (_db) return _db;
  _db = new Database(dbPath);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  return _db;
}

export function initDb(dbPath = DEFAULT_DB_PATH) {
  const db = getDb(dbPath);
  const schema = readFileSync(resolve(__dirname, "init.sql"), "utf-8");
  db.exec(schema);
  return db;
}

export function seedDb(dbPath = DEFAULT_DB_PATH) {
  const db = getDb(dbPath);
  const seed = readFileSync(resolve(__dirname, "seed.sql"), "utf-8");
  db.exec(seed);
  return db;
}

export function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}

// -- Projects --

export function getAllProjects() {
  return getDb().prepare("SELECT * FROM projects ORDER BY created_at DESC").all();
}

export function getProject(projectId) {
  return getDb().prepare("SELECT * FROM projects WHERE project_id = ?").get(projectId);
}

export function createProject({ name, description, prdFilePath, deploymentProfile }) {
  const result = getDb()
    .prepare(
      "INSERT INTO projects (name, description, prd_file_path, deployment_profile) VALUES (?, ?, ?, ?)"
    )
    .run(name, description ?? null, prdFilePath, deploymentProfile ?? null);
  return result.lastInsertRowid;
}

// -- Phases --

export function getPhasesByProject(projectId) {
  return getDb()
    .prepare("SELECT * FROM phases WHERE project_id = ? ORDER BY phase_order")
    .all(projectId);
}

export function getActivePhase(projectId) {
  return getDb()
    .prepare("SELECT * FROM phases WHERE project_id = ? AND status = 'active'")
    .get(projectId);
}

export function createPhase({ projectId, phaseName, phaseOrder, status = "locked" }) {
  const result = getDb()
    .prepare(
      "INSERT INTO phases (project_id, phase_name, phase_order, status) VALUES (?, ?, ?, ?)"
    )
    .run(projectId, phaseName, phaseOrder, status);
  return result.lastInsertRowid;
}

export function updatePhaseStatus(phaseId, status) {
  getDb()
    .prepare("UPDATE phases SET status = ? WHERE phase_id = ?")
    .run(status, phaseId);
}

// -- Tasks --

export function getTasksByPhase(phaseId) {
  return getDb()
    .prepare("SELECT * FROM tasks WHERE phase_id = ? ORDER BY priority DESC, created_at")
    .all(phaseId);
}

export function getTasksByStatus(projectId, status) {
  return getDb()
    .prepare("SELECT * FROM tasks WHERE project_id = ? AND status = ?")
    .all(projectId, status);
}

export function getTask(taskId) {
  return getDb().prepare("SELECT * FROM tasks WHERE task_id = ?").get(taskId);
}

export function updateTaskStatus(taskId, status, commitHash = null) {
  const stmt = commitHash
    ? getDb().prepare("UPDATE tasks SET status = ?, git_commit_hash = ? WHERE task_id = ?")
    : getDb().prepare("UPDATE tasks SET status = ? WHERE task_id = ?");
  commitHash ? stmt.run(status, commitHash, taskId) : stmt.run(status, taskId);
}

export function createTask({ projectId, phaseId, title, description, featureArea, priority, dependencies, taskFilePath }) {
  const result = getDb()
    .prepare(
      `INSERT INTO tasks (project_id, phase_id, title, description, feature_area, priority, dependencies, task_file_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      projectId, phaseId, title, description ?? null,
      featureArea ?? null, priority ?? "medium",
      dependencies ? JSON.stringify(dependencies) : null,
      taskFilePath
    );
  return result.lastInsertRowid;
}

// -- Task History --

export function getTaskHistory(taskId) {
  return getDb()
    .prepare("SELECT * FROM task_history WHERE task_id = ? ORDER BY changed_at")
    .all(taskId);
}

// -- Backlog --

export function getBacklog(projectId) {
  return getDb()
    .prepare("SELECT * FROM backlog WHERE project_id = ? ORDER BY created_at DESC")
    .all(projectId);
}

export function createBacklogItem({ projectId, title, notes }) {
  const result = getDb()
    .prepare("INSERT INTO backlog (project_id, title, notes) VALUES (?, ?, ?)")
    .run(projectId, title, notes ?? null);
  return result.lastInsertRowid;
}

export function updateBacklogStatus(backlogId, status) {
  getDb()
    .prepare("UPDATE backlog SET status = ? WHERE backlog_id = ?")
    .run(status, backlogId);
}

// -- Board View (full board for a phase) --

export function getBoardView(phaseId) {
  const tasks = getTasksByPhase(phaseId);
  const columns = { ready: [], in_progress: [], testing: [], review: [], done: [] };
  for (const task of tasks) {
    columns[task.status].push(task);
  }
  return columns;
}
