#!/usr/bin/env node

import {
  initDb,
  closeDb,
  getTask,
  getTasksByPhase,
  updateTaskStatus,
  getBacklog,
  createBacklogItem,
  updateBacklogStatus,
  getProject,
  getPhase,
  createTask,
} from "./db.js";

const VALID_TASK_STATUSES = ["ready", "in_progress", "testing", "review", "done"];
const VALID_BACKLOG_STATUSES = ["unprocessed", "promoted", "discarded"];

function success(data) {
  console.log(JSON.stringify({ ok: true, data }, null, 2));
  process.exit(0);
}

function fail(message) {
  console.log(JSON.stringify({ ok: false, error: message }, null, 2));
  process.exit(1);
}

function requireInt(value, name) {
  const n = parseInt(value, 10);
  if (isNaN(n)) fail(`${name} must be an integer, got: ${value}`);
  return n;
}

const [, , operation, ...args] = process.argv;

if (!operation) {
  fail("No operation specified. Use: get_task, get_phase_tasks, update_task_status, get_backlog, add_backlog_item, update_backlog_status, get_project, get_phase, create_task");
}

initDb();

try {
  switch (operation) {
    case "get_task": {
      if (args.length < 1) fail("Usage: get_task <task_id>");
      const taskId = requireInt(args[0], "task_id");
      const task = getTask(taskId);
      if (!task) fail(`Task ${taskId} not found`);
      success(task);
      break;
    }

    case "get_phase_tasks": {
      if (args.length < 2) fail("Usage: get_phase_tasks <project_id> <phase_id> [status]");
      const projectId = requireInt(args[0], "project_id");
      const phaseId = requireInt(args[1], "phase_id");
      const status = args[2] || null;
      if (status && !VALID_TASK_STATUSES.includes(status)) {
        fail(`Invalid status: ${status}. Must be one of: ${VALID_TASK_STATUSES.join(", ")}`);
      }
      let tasks = getTasksByPhase(phaseId).filter(t => t.project_id === projectId);
      if (status) tasks = tasks.filter(t => t.status === status);
      success(tasks);
      break;
    }

    case "update_task_status": {
      if (args.length < 2) fail("Usage: update_task_status <task_id> <new_status> [commit_hash]");
      const taskId = requireInt(args[0], "task_id");
      const newStatus = args[1];
      const commitHash = args[2] || null;
      if (!VALID_TASK_STATUSES.includes(newStatus)) {
        fail(`Invalid status: ${newStatus}. Must be one of: ${VALID_TASK_STATUSES.join(", ")}`);
      }
      const task = getTask(taskId);
      if (!task) fail(`Task ${taskId} not found`);
      updateTaskStatus(taskId, newStatus, commitHash);
      success(getTask(taskId));
      break;
    }

    case "get_backlog": {
      if (args.length < 1) fail("Usage: get_backlog <project_id> [status]");
      const projectId = requireInt(args[0], "project_id");
      const status = args[1] || null;
      if (status && !VALID_BACKLOG_STATUSES.includes(status)) {
        fail(`Invalid status: ${status}. Must be one of: ${VALID_BACKLOG_STATUSES.join(", ")}`);
      }
      let items = getBacklog(projectId);
      if (status) items = items.filter(b => b.status === status);
      success(items);
      break;
    }

    case "add_backlog_item": {
      if (args.length < 2) fail("Usage: add_backlog_item <project_id> <title> [notes]");
      const projectId = requireInt(args[0], "project_id");
      const title = args[1];
      const notes = args[2] || null;
      if (!title.trim()) fail("Title cannot be empty");
      const id = createBacklogItem({ projectId, title, notes });
      success({ backlog_id: Number(id) });
      break;
    }

    case "update_backlog_status": {
      if (args.length < 2) fail("Usage: update_backlog_status <backlog_id> <status>");
      const backlogId = requireInt(args[0], "backlog_id");
      const status = args[1];
      if (!VALID_BACKLOG_STATUSES.includes(status)) {
        fail(`Invalid status: ${status}. Must be one of: ${VALID_BACKLOG_STATUSES.join(", ")}`);
      }
      updateBacklogStatus(backlogId, status);
      success({ backlog_id: backlogId, status });
      break;
    }

    case "get_project": {
      if (args.length < 1) fail("Usage: get_project <project_id>");
      const projectId = requireInt(args[0], "project_id");
      const project = getProject(projectId);
      if (!project) fail(`Project ${projectId} not found`);
      success(project);
      break;
    }

    case "get_phase": {
      if (args.length < 1) fail("Usage: get_phase <phase_id>");
      const phaseId = requireInt(args[0], "phase_id");
      const phase = getPhase(phaseId);
      if (!phase) fail(`Phase ${phaseId} not found`);
      success(phase);
      break;
    }

    case "create_task": {
      if (args.length < 5) fail("Usage: create_task <project_id> <phase_id> <title> <priority> <task_file_path> [description] [feature_area] [dependencies_json]");
      const projectId = requireInt(args[0], "project_id");
      const phaseId = requireInt(args[1], "phase_id");
      const title = args[2];
      const priority = args[3];
      const taskFilePath = args[4];
      const description = args[5] || null;
      const featureArea = args[6] || null;
      const dependenciesJson = args[7] || null;

      const VALID_PRIORITIES = ["low", "medium", "high", "critical"];
      if (!VALID_PRIORITIES.includes(priority)) {
        fail(`Invalid priority: ${priority}. Must be one of: ${VALID_PRIORITIES.join(", ")}`);
      }

      // Validate dependencies JSON if provided
      let dependencies = null;
      if (dependenciesJson) {
        try {
          dependencies = JSON.parse(dependenciesJson);
          if (!Array.isArray(dependencies)) fail("dependencies must be a JSON array");
        } catch (e) {
          fail(`Invalid dependencies JSON: ${e.message}`);
        }
      }

      const id = createTask({
        projectId, phaseId, title, description,
        featureArea, priority, dependencies, taskFilePath
      });
      success({ task_id: Number(id) });
      break;
    }

    default:
      fail(`Unknown operation: ${operation}. Use: get_task, get_phase_tasks, update_task_status, get_backlog, add_backlog_item, update_backlog_status, get_project, get_phase, create_task`);
  }
} finally {
  closeDb();
}
