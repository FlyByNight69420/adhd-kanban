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
  $("#backlog-form").addEventListener("submit", onBacklogSubmit);
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
  loadBacklog(projectId);
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

// -- Task lookup for dependencies --
function taskById(taskId) {
  return allTasks.find((t) => t.task_id === taskId);
}

function resolveDep(dep) {
  const match = dep.match(/TASK-(\d+)/i);
  if (!match) return { label: dep, done: false };
  const id = Number(match[1]);
  const task = taskById(id);
  if (!task) return { label: dep, done: false };
  return { label: `${dep}: ${task.title}`, done: task.status === "done" };
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
    ? `<div class="card-deps">${deps.map((d) => {
        const r = resolveDep(d);
        const cls = r.done ? "dep-done" : "dep-blocked";
        const icon = r.done ? "\u2705" : "\u26D4";
        return `<span class="dep-ref ${cls}" title="${esc(r.label)}">${icon} ${esc(d)}</span>`;
      }).join(" ")}</div>`
    : "";

  const taskLabel = `TASK-${String(task.task_id).padStart(3, "0")}`;

  return `
    <div class="card" data-task-id="${task.task_id}">
      <div class="card-header">
        <span class="card-id">${taskLabel}</span>
      </div>
      <div class="card-title">${esc(task.title)}</div>
      <div class="card-tags">
        <span class="tag tag-priority-${esc(task.priority)}">${esc(task.priority)}</span>
        ${task.feature_area ? `<span class="tag tag-area-${esc(task.feature_area)}">${esc(task.feature_area)}</span>` : ""}
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
    opts.push(`<option value="${esc(area)}">${esc(area)}</option>`);
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
  $("#modal-area").textContent = task.feature_area || "\u2014";
  $("#modal-area").className = task.feature_area ? `tag tag-area-${task.feature_area}` : "tag tag-id";
  $("#modal-status").textContent = STATUS_LABELS[task.status];
  $("#modal-status").className = "tag tag-status";
  $("#modal-description").innerHTML = task.description
    ? `<h3>Description</h3><p>${esc(task.description)}</p>`
    : "";

  // Dependencies — resolved to show titles
  const deps = parseDeps(task.dependencies);
  const depEl = $("#modal-dependencies");
  if (deps.length) {
    depEl.innerHTML = deps.map((d) => {
      const r = resolveDep(d);
      const cls = r.done ? "dep-done" : "dep-blocked";
      const icon = r.done ? "\u2705" : "\u26D4";
      return `<div class="dep-entry ${cls}">${icon} ${esc(r.label)}</div>`;
    }).join("");
  } else {
    depEl.textContent = "None";
  }

  // History
  try {
    const history = await api(`/api/tasks/${taskId}/history`);
    $("#modal-history").innerHTML = history.length
      ? history.map((h) => `
          <div class="history-entry">
            <span>${STATUS_LABELS[h.old_status] || "\u2014"}</span>
            <span class="history-arrow">&rarr;</span>
            <span>${STATUS_LABELS[h.new_status]}</span>
            <span style="margin-left:auto">${formatDate(h.changed_at)}</span>
          </div>
        `).join("")
      : "<p>No history yet</p>";
  } catch {
    $("#modal-history").innerHTML = "<p>Could not load history</p>";
  }

  $("#task-modal").classList.remove("hidden");
}

function closeModal() {
  $("#task-modal").classList.add("hidden");
}

// -- Backlog --
async function loadBacklog(projectId) {
  try {
    const items = await api(`/api/projects/${projectId}/backlog`);
    const list = $("#backlog-list");
    $("#count-backlog").textContent = items.length;
    if (items.length === 0) {
      list.innerHTML = '<div class="empty-state">No backlog items</div>';
    } else {
      list.innerHTML = items.map((item) => `
        <div class="backlog-item" data-backlog-id="${item.backlog_id}">
          <div class="backlog-content">
            <div class="backlog-title">${esc(item.title)}</div>
            ${item.notes ? `<div class="backlog-notes">${esc(item.notes)}</div>` : ""}
          </div>
          <div class="backlog-actions">
            <button class="btn-icon btn-edit" title="Edit">&#9998;</button>
            <button class="btn-icon btn-delete" title="Delete">&times;</button>
          </div>
        </div>
      `).join("");

      list.querySelectorAll(".btn-edit").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const item = btn.closest(".backlog-item");
          editBacklogItem(Number(item.dataset.backlogId), items.find((i) => i.backlog_id === Number(item.dataset.backlogId)));
        });
      });

      list.querySelectorAll(".btn-delete").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const item = btn.closest(".backlog-item");
          await fetch(`${API}/api/backlog/${item.dataset.backlogId}`, { method: "DELETE" });
          await loadBacklog(currentProjectId);
        });
      });
    }
  } catch {
    $("#backlog-list").innerHTML = '<div class="empty-state">Could not load backlog</div>';
  }
}

function editBacklogItem(backlogId, item) {
  const container = document.querySelector(`.backlog-item[data-backlog-id="${backlogId}"]`);
  if (!container) return;
  container.innerHTML = `
    <form class="backlog-edit-form">
      <input type="text" class="edit-title" value="${esc(item.title)}" required>
      <textarea class="edit-notes" rows="2">${esc(item.notes || "")}</textarea>
      <div class="backlog-edit-actions">
        <button type="submit" class="btn btn-add">Save</button>
        <button type="button" class="btn btn-cancel">Cancel</button>
      </div>
    </form>
  `;
  container.querySelector(".backlog-edit-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = container.querySelector(".edit-title").value.trim();
    if (!title) return;
    await fetch(`${API}/api/backlog/${backlogId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, notes: container.querySelector(".edit-notes").value.trim() || null }),
    });
    await loadBacklog(currentProjectId);
  });
  container.querySelector(".btn-cancel").addEventListener("click", () => loadBacklog(currentProjectId));
  container.querySelector(".edit-title").focus();
}

async function onBacklogSubmit(e) {
  e.preventDefault();
  const titleInput = $("#backlog-title");
  const notesInput = $("#backlog-notes");
  const title = titleInput.value.trim();
  if (!title || !currentProjectId) return;

  await fetch(`${API}/api/projects/${currentProjectId}/backlog`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, notes: notesInput.value.trim() || null }),
  });

  titleInput.value = "";
  notesInput.value = "";
  await loadBacklog(currentProjectId);
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
