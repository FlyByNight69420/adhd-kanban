import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname, extname, join } from "path";
import { fileURLToPath } from "url";
import {
  initDb,
  getAllProjects,
  getProject,
  getPhasesByProject,
  getPhase,
  getTasksByPhase,
  getTask,
  getTaskHistory,
  updateTaskStatus,
  getBoardView,
  getBacklog,
  createBacklogItem,
  resetInProgressTasks,
  createProject,
  createPhase,
  createTask,
  getBacklogItem,
  updateBacklogItem,
  deleteBacklogItem,
  getUnblockedTasks,
} from "./db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = resolve(__dirname, "public");
const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

initDb();
resetInProgressTasks();

function json(res, data, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function notFound(res, msg = "Not found") {
  json(res, { error: msg }, 404);
}

function badRequest(res, msg) {
  json(res, { error: msg }, 400);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
  });
}

function serveStatic(res, urlPath) {
  const filePath =
    urlPath === "/" ? join(PUBLIC_DIR, "index.html") : join(PUBLIC_DIR, urlPath);

  // Prevent directory traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    notFound(res);
    return;
  }

  if (!existsSync(filePath)) {
    notFound(res);
    return;
  }

  const ext = extname(filePath);
  const mime = MIME_TYPES[ext] || "application/octet-stream";
  const content = readFileSync(filePath);
  res.writeHead(200, { "Content-Type": mime });
  res.end(content);
}

const VALID_STATUSES = ["ready", "in_progress", "testing", "review", "done"];

async function handleApi(req, res, url) {
  const parts = url.pathname.replace("/api/", "").split("/");

  // GET /api/projects
  if (req.method === "GET" && parts[0] === "projects" && parts.length === 1) {
    return json(res, getAllProjects());
  }

  // POST /api/projects
  if (req.method === "POST" && parts[0] === "projects" && parts.length === 1) {
    const body = await parseBody(req);
    if (!body.name || !body.name.trim()) {
      return badRequest(res, "Name is required");
    }
    if (!body.prd_file_path || !body.prd_file_path.trim()) {
      return badRequest(res, "prd_file_path is required");
    }
    const id = createProject({
      name: body.name.trim(),
      description: body.description || null,
      prdFilePath: body.prd_file_path.trim(),
      deploymentProfile: body.deployment_profile || null,
    });
    return json(res, { project_id: Number(id) }, 201);
  }

  // GET /api/projects/:id
  if (req.method === "GET" && parts[0] === "projects" && parts.length === 2) {
    const project = getProject(Number(parts[1]));
    return project ? json(res, project) : notFound(res, "Project not found");
  }

  // GET /api/projects/:id/phases
  if (
    req.method === "GET" &&
    parts[0] === "projects" &&
    parts[2] === "phases" &&
    parts.length === 3
  ) {
    return json(res, getPhasesByProject(Number(parts[1])));
  }

  // POST /api/projects/:id/phases
  if (
    req.method === "POST" &&
    parts[0] === "projects" &&
    parts[2] === "phases" &&
    parts.length === 3
  ) {
    const body = await parseBody(req);
    if (!body.phase_name || !body.phase_name.trim()) {
      return badRequest(res, "phase_name is required");
    }
    if (body.phase_order == null) {
      return badRequest(res, "phase_order is required");
    }
    const projectId = Number(parts[1]);
    const project = getProject(projectId);
    if (!project) return notFound(res, "Project not found");
    const validPhaseStatuses = ["active", "locked", "completed"];
    const status = body.status || "locked";
    if (!validPhaseStatuses.includes(status)) {
      return badRequest(res, `Invalid status. Must be one of: ${validPhaseStatuses.join(", ")}`);
    }
    const id = createPhase({
      projectId,
      phaseName: body.phase_name.trim(),
      phaseOrder: Number(body.phase_order),
      status,
    });
    return json(res, { phase_id: Number(id) }, 201);
  }

  // GET /api/phases/:id
  if (req.method === "GET" && parts[0] === "phases" && parts.length === 2) {
    const phase = getPhase(Number(parts[1]));
    return phase ? json(res, phase) : notFound(res, "Phase not found");
  }

  // GET /api/phases/:id/board
  if (
    req.method === "GET" &&
    parts[0] === "phases" &&
    parts[2] === "board" &&
    parts.length === 3
  ) {
    return json(res, getBoardView(Number(parts[1])));
  }

  // GET /api/phases/:id/unblocked
  if (
    req.method === "GET" &&
    parts[0] === "phases" &&
    parts[2] === "unblocked" &&
    parts.length === 3
  ) {
    const phase = getPhase(Number(parts[1]));
    if (!phase) return notFound(res, "Phase not found");
    return json(res, getUnblockedTasks(Number(parts[1])));
  }

  // GET /api/phases/:id/tasks
  if (
    req.method === "GET" &&
    parts[0] === "phases" &&
    parts[2] === "tasks" &&
    parts.length === 3
  ) {
    return json(res, getTasksByPhase(Number(parts[1])));
  }

  // POST /api/phases/:id/tasks
  if (
    req.method === "POST" &&
    parts[0] === "phases" &&
    parts[2] === "tasks" &&
    parts.length === 3
  ) {
    const body = await parseBody(req);
    if (!body.title || !body.title.trim()) {
      return badRequest(res, "Title is required");
    }
    if (!body.task_file_path) {
      return badRequest(res, "task_file_path is required");
    }
    const phaseId = Number(parts[1]);
    const phase = getPhase(phaseId);
    if (!phase) return notFound(res, "Phase not found");
    const validPriorities = ["low", "medium", "high", "critical"];
    const priority = body.priority || "medium";
    if (!validPriorities.includes(priority)) {
      return badRequest(res, `Invalid priority. Must be one of: ${validPriorities.join(", ")}`);
    }
    const id = createTask({
      projectId: phase.project_id,
      phaseId,
      title: body.title.trim(),
      description: body.description || null,
      featureArea: body.feature_area || null,
      priority,
      dependencies: body.dependencies || null,
      taskFilePath: body.task_file_path,
    });
    return json(res, getTask(Number(id)), 201);
  }

  // GET /api/tasks/:id
  if (req.method === "GET" && parts[0] === "tasks" && parts.length === 2) {
    const task = getTask(Number(parts[1]));
    return task ? json(res, task) : notFound(res, "Task not found");
  }

  // GET /api/tasks/:id/history
  if (
    req.method === "GET" &&
    parts[0] === "tasks" &&
    parts[2] === "history" &&
    parts.length === 3
  ) {
    return json(res, getTaskHistory(Number(parts[1])));
  }

  // POST /api/tasks/:id/claim
  if (
    req.method === "POST" &&
    parts[0] === "tasks" &&
    parts[2] === "claim" &&
    parts.length === 3
  ) {
    const taskId = Number(parts[1]);
    const task = getTask(taskId);
    if (!task) return notFound(res, "Task not found");
    if (task.status !== "ready") {
      return json(res, { error: `Task is '${task.status}', not 'ready'. Cannot claim.` }, 409);
    }
    updateTaskStatus(taskId, "in_progress");
    return json(res, getTask(taskId));
  }

  // PATCH /api/tasks/:id/status
  if (
    req.method === "PATCH" &&
    parts[0] === "tasks" &&
    parts[2] === "status" &&
    parts.length === 3
  ) {
    const body = await parseBody(req);
    if (!body.status || !VALID_STATUSES.includes(body.status)) {
      return badRequest(
        res,
        `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`
      );
    }
    const taskId = Number(parts[1]);
    const task = getTask(taskId);
    if (!task) return notFound(res, "Task not found");
    updateTaskStatus(taskId, body.status, body.commit_hash || null);
    return json(res, getTask(taskId));
  }

  // GET /api/projects/:id/backlog
  if (
    req.method === "GET" &&
    parts[0] === "projects" &&
    parts[2] === "backlog" &&
    parts.length === 3
  ) {
    return json(res, getBacklog(Number(parts[1])));
  }

  // POST /api/projects/:id/backlog
  if (
    req.method === "POST" &&
    parts[0] === "projects" &&
    parts[2] === "backlog" &&
    parts.length === 3
  ) {
    const body = await parseBody(req);
    if (!body.title || !body.title.trim()) {
      return badRequest(res, "Title is required");
    }
    const projectId = Number(parts[1]);
    const project = getProject(projectId);
    if (!project) return notFound(res, "Project not found");
    const id = createBacklogItem({
      projectId,
      title: body.title.trim(),
      notes: body.notes || null,
    });
    return json(res, { backlog_id: id }, 201);
  }

  // PATCH /api/backlog/:id
  if (req.method === "PATCH" && parts[0] === "backlog" && parts.length === 2) {
    const backlogId = Number(parts[1]);
    const item = getBacklogItem(backlogId);
    if (!item) return notFound(res, "Backlog item not found");
    const body = await parseBody(req);
    if (!body.title || !body.title.trim()) {
      return badRequest(res, "Title is required");
    }
    updateBacklogItem(backlogId, {
      title: body.title.trim(),
      notes: body.notes ?? item.notes,
    });
    return json(res, getBacklogItem(backlogId));
  }

  // DELETE /api/backlog/:id
  if (req.method === "DELETE" && parts[0] === "backlog" && parts.length === 2) {
    const backlogId = Number(parts[1]);
    const item = getBacklogItem(backlogId);
    if (!item) return notFound(res, "Backlog item not found");
    deleteBacklogItem(backlogId);
    return json(res, { deleted: true });
  }

  notFound(res, "Unknown API endpoint");
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // CORS for local dev
  res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
    } else {
      serveStatic(res, url.pathname);
    }
  } catch (err) {
    console.error("Server error:", err);
    json(res, { error: "Internal server error" }, 500);
  }
});

server.listen(PORT, () => {
  console.log(`Kanban server running at http://localhost:${PORT}`);
});
