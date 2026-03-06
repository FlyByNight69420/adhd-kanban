const API = "";
const STATUSES = ["ready", "in_progress", "testing", "review", "done"];
const STATUS_LABELS = { ready: "Ready", in_progress: "In Progress", testing: "Testing", review: "Review", done: "Done" };
let refreshTimer = null;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// -- State --
let currentProjectId = null;
let currentPhaseId = null;
let allTasks = [];
let featureAreas = new Set();

// -- Init --
document.addEventListener("DOMContentLoaded", async () => {
  await loadProjects();
  $("#project-select").addEventListener("change", onProjectChange);
  $("#phase-select").addEventListener("change", onPhaseChange);
  $("#filter-priority").addEventListener("change", renderBoard);
  $("#filter-area").addEventListener("change", renderBoard);
  $("#auto-refresh").addEventListener("change", toggleAutoRefresh);
  $(".modal-backdrop").addEventListener("click", closeModal);
  $(".modal-close").addEventListener("click", closeModal);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
  setupDragDrop();
  toggleAutoRefresh();
});

// -- Data Loading --
async function api(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function loadProjects() {
  const projects = await api("/api/projects");
  const sel = $("#project-select");
  sel.innerHTML = projects.length
    ? projects.map((p) => `<option value="${p.project_id}">${esc(p.name)}</option>`).join("")
    : '<option value="">No projects</option>';
  if (projects.length) {
    currentProjectId = projects[0].project_id;
    await loadPhases(currentProjectId);
  }
}

async function loadPhases(projectId) {
  const phases = await api(`/api/projects/${projectId}/phases`);
  const sel = $("#phase-select");
  sel.innerHTML = phases.length
    ? phases.map((p) => `<option value="${p.phase_id}">${esc(p.phase_name)} (${p.status})</option>`).join("")
    : '<option value="">No phases</option>';
  if (phases.length) {
    const active = phases.find((p) => p.status === "active") || phases[0];
    sel.value = active.phase_id;
    currentPhaseId = active.phase_id;
    await loadBoard(currentPhaseId);
  }
}

async function loadBoard(phaseId) {
  const board = await api(`/api/phases/${phaseId}/board`);
  allTasks = [];
  featureAreas = new Set();
  for (const status of STATUSES) {
    for (const task of board[status] || []) {
      allTasks.push(task);
      if (task.feature_area) featureAreas.add(task.feature_area);
    }
  }
  updateAreaFilter();
  renderBoard();
}

// -- Rendering --
function renderBoard() {
  const priorityFilter = $("#filter-priority").value;
  const areaFilter = $("#filter-area").value;

  for (const status of STATUSES) {
    const col = $(`#col-${status}`);
    const tasks = allTasks.filter((t) => {
      if (t.status !== status) return false;
      if (priorityFilter && t.priority !== priorityFilter) return false;
      if (areaFilter && t.feature_area !== areaFilter) return false;
      return true;
    });

    $(`#count-${status}`).textContent = tasks.length;

    if (tasks.length === 0) {
      col.innerHTML = '<div class="empty-state">No tasks</div>';
    } else {
      col.innerHTML = tasks.map(renderCard).join("");
    }

    // Attach click handlers
    col.querySelectorAll(".card").forEach((card) => {
      card.addEventListener("click", () => openModal(Number(card.dataset.taskId)));
    });
  }
}

function renderCard(task) {
  const deps = parseDeps(task.dependencies);
  const depsHtml = deps.length
    ? `<div class="card-deps">Depends: ${deps.join(", ")}</div>`
    : "";

  return `
    <div class="card" data-task-id="${task.task_id}" draggable="true">
      <div class="card-title">${esc(task.title)}</div>
      <div class="card-tags">
        <span class="tag tag-priority-${task.priority}">${task.priority}</span>
        ${task.feature_area ? `<span class="tag tag-area-${task.feature_area}">${task.feature_area}</span>` : ""}
      </div>
      ${depsHtml}
    </div>
  `;
}

function updateAreaFilter() {
  const sel = $("#filter-area");
  const current = sel.value;
  const opts = ['<option value="">All areas</option>'];
  for (const area of [...featureAreas].sort()) {
    opts.push(`<option value="${area}">${area}</option>`);
  }
  sel.innerHTML = opts.join("");
  if (current && featureAreas.has(current)) sel.value = current;
}

// -- Modal --
async function openModal(taskId) {
  const task = allTasks.find((t) => t.task_id === taskId);
  if (!task) return;

  $("#modal-title").textContent = task.title;
  $("#modal-task-id").textContent = `TASK-${String(taskId).padStart(3, "0")}`;
  $("#modal-task-id").className = "tag tag-id";
  $("#modal-priority").textContent = task.priority;
  $("#modal-priority").className = `tag tag-priority-${task.priority}`;
  $("#modal-area").textContent = task.feature_area || "—";
  $("#modal-area").className = task.feature_area ? `tag tag-area-${task.feature_area}` : "tag tag-id";
  $("#modal-status").textContent = STATUS_LABELS[task.status];
  $("#modal-status").className = "tag tag-status";
  $("#modal-description").innerHTML = task.description
    ? `<h3>Description</h3><p>${esc(task.description)}</p>`
    : "";

  const deps = parseDeps(task.dependencies);
  $("#modal-dependencies").textContent = deps.length ? deps.join(", ") : "None";

  // History
  try {
    const history = await api(`/api/tasks/${taskId}/history`);
    $("#modal-history").innerHTML = history.length
      ? history.map((h) => `
          <div class="history-entry">
            <span>${STATUS_LABELS[h.old_status] || "—"}</span>
            <span class="history-arrow">&rarr;</span>
            <span>${STATUS_LABELS[h.new_status]}</span>
            <span style="margin-left:auto">${formatDate(h.changed_at)}</span>
          </div>
        `).join("")
      : "<p>No history yet</p>";
  } catch {
    $("#modal-history").innerHTML = "<p>Could not load history</p>";
  }

  // Actions
  const actions = STATUSES.filter((s) => s !== task.status);
  $("#modal-actions").innerHTML = actions
    .map((s) => `<button class="btn${s === task.status ? " active" : ""}" data-status="${s}">${STATUS_LABELS[s]}</button>`)
    .join("");

  $("#modal-actions").querySelectorAll(".btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await moveTask(taskId, btn.dataset.status);
      closeModal();
    });
  });

  $("#task-modal").classList.remove("hidden");
}

function closeModal() {
  $("#task-modal").classList.add("hidden");
}

async function moveTask(taskId, newStatus) {
  await fetch(`${API}/api/tasks/${taskId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: newStatus }),
  });
  await loadBoard(currentPhaseId);
}

// -- Drag & Drop --
function setupDragDrop() {
  const board = $("#board");

  board.addEventListener("dragstart", (e) => {
    const card = e.target.closest(".card");
    if (!card) return;
    card.classList.add("dragging");
    e.dataTransfer.setData("text/plain", card.dataset.taskId);
    e.dataTransfer.effectAllowed = "move";
  });

  board.addEventListener("dragend", (e) => {
    const card = e.target.closest(".card");
    if (card) card.classList.remove("dragging");
    $$(".column").forEach((c) => c.classList.remove("drag-over"));
  });

  board.addEventListener("dragover", (e) => {
    e.preventDefault();
    const col = e.target.closest(".column");
    if (col) col.classList.add("drag-over");
  });

  board.addEventListener("dragleave", (e) => {
    const col = e.target.closest(".column");
    if (col) col.classList.remove("drag-over");
  });

  board.addEventListener("drop", async (e) => {
    e.preventDefault();
    const col = e.target.closest(".column");
    if (!col) return;
    col.classList.remove("drag-over");
    const taskId = Number(e.dataTransfer.getData("text/plain"));
    const newStatus = col.dataset.status;
    if (taskId && newStatus) {
      await moveTask(taskId, newStatus);
    }
  });
}

// -- Events --
async function onProjectChange(e) {
  currentProjectId = Number(e.target.value);
  await loadPhases(currentProjectId);
}

async function onPhaseChange(e) {
  currentPhaseId = Number(e.target.value);
  await loadBoard(currentPhaseId);
}

function toggleAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  if ($("#auto-refresh").checked && currentPhaseId) {
    refreshTimer = setInterval(() => loadBoard(currentPhaseId), 5000);
  }
}

// -- Helpers --
function esc(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function parseDeps(deps) {
  if (!deps) return [];
  try {
    const arr = JSON.parse(deps);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
