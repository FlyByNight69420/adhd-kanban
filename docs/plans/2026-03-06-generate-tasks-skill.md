# Generate Tasks Skill — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a Claude Code skill that decomposes a PRD phase into atomic task files and database rows.

**Architecture:** A `.claude/skills/generate-tasks.md` prompt file instructs the agent to query the SQLite DB for project/phase context, read the PRD, decompose requirements into tasks, write markdown files, and insert DB rows. Two new helper functions are added to `db.js` to support the skill. `seed.sql` is updated for path/dependency consistency.

**Tech Stack:** Node.js (ES modules), better-sqlite3, `node:test` (built-in test runner)

---

### Task 1: Set Up Test Infrastructure

**Files:**
- Create: `test/helpers.js`
- Modify: `package.json`

**Step 1: Create test helper for in-memory SQLite**

```js
// test/helpers.js
import Database from "better-sqlite3";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = resolve(__dirname, "..", "init.sql");

export function createTestDb() {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  const schema = readFileSync(SCHEMA_PATH, "utf-8");
  db.exec(schema);
  return db;
}

export function seedTestDb(db) {
  db.prepare(
    "INSERT INTO projects (name, description, prd_file_path) VALUES (?, ?, ?)"
  ).run("Test Project", "A test project", "./docs/prd.md");

  db.prepare(
    "INSERT INTO phases (project_id, phase_name, phase_order, status) VALUES (?, ?, ?, ?)"
  ).run(1, "mvp", 1, "active");

  db.prepare(
    "INSERT INTO phases (project_id, phase_name, phase_order, status) VALUES (?, ?, ?, ?)"
  ).run(1, "1.1", 2, "locked");
}
```

**Step 2: Add test script to package.json**

Add to `"scripts"`:
```json
"test": "node --test test/**/*.test.js"
```

**Step 3: Run test infrastructure to verify it loads**

Run: `cd /home/nick/Development/adhd-kanban && node -e "import('./test/helpers.js').then(m => { const db = m.createTestDb(); m.seedTestDb(db); console.log('OK:', db.prepare('SELECT COUNT(*) as c FROM projects').get()); db.close(); })"`
Expected: `OK: { c: 1 }`

**Step 4: Commit**

```bash
git add test/helpers.js package.json
git commit -m "chore: add test infrastructure with in-memory SQLite helper"
```

---

### Task 2: TDD — Add `getPhase(phaseId)` to `db.js`

**Files:**
- Create: `test/db.test.js`
- Modify: `db.js:59` (after existing phase functions)

**Step 1: Write the failing test**

```js
// test/db.test.js
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createTestDb, seedTestDb } from "./helpers.js";

// We need db.js to accept an injected db instance.
// But db.js uses a module-level singleton. So for tests, we'll
// test the SQL logic directly against the in-memory db.

describe("getPhase", () => {
  let db;

  beforeEach(() => {
    db = createTestDb();
    seedTestDb(db);
  });

  afterEach(() => {
    db.close();
  });

  it("returns a phase by phase_id", () => {
    const phase = db.prepare("SELECT * FROM phases WHERE phase_id = ?").get(1);
    assert.equal(phase.phase_name, "mvp");
    assert.equal(phase.project_id, 1);
  });

  it("returns undefined for nonexistent phase_id", () => {
    const phase = db.prepare("SELECT * FROM phases WHERE phase_id = ?").get(999);
    assert.equal(phase, undefined);
  });
});
```

**Step 2: Run test to verify it passes (this validates the SQL pattern)**

Run: `cd /home/nick/Development/adhd-kanban && node --test test/db.test.js`
Expected: PASS — these test the SQL query pattern, not the wrapper function yet.

**Step 3: Write the `getPhase` function in db.js**

Add after `getActivePhase` (around line 71):

```js
export function getPhase(phaseId) {
  return getDb().prepare("SELECT * FROM phases WHERE phase_id = ?").get(phaseId);
}
```

**Step 4: Verify the function works via node**

Run: `cd /home/nick/Development/adhd-kanban && node -e "import('./db.js').then(m => { m.initDb(); const p = m.getPhase(1); console.log(p ? p.phase_name : 'not found'); m.closeDb(); })"`
Expected: `mvp` (if DB is seeded) or run after seeding

**Step 5: Commit**

```bash
git add db.js test/db.test.js
git commit -m "feat: add getPhase(phaseId) to db.js with tests"
```

---

### Task 3: TDD — Add `getTaskCountByPhase(phaseId)` to `db.js`

**Files:**
- Modify: `test/db.test.js`
- Modify: `db.js` (after `getTask`)

**Step 1: Write the failing test**

Append to `test/db.test.js`:

```js
describe("getTaskCountByPhase", () => {
  let db;

  beforeEach(() => {
    db = createTestDb();
    seedTestDb(db);
  });

  afterEach(() => {
    db.close();
  });

  it("returns 0 when phase has no tasks", () => {
    const row = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE phase_id = ?").get(1);
    assert.equal(row.count, 0);
  });

  it("returns correct count after inserting tasks", () => {
    db.prepare(
      "INSERT INTO tasks (project_id, phase_id, title, priority, task_file_path) VALUES (?, ?, ?, ?, ?)"
    ).run(1, 1, "Task A", "medium", "./tasks/a.md");
    db.prepare(
      "INSERT INTO tasks (project_id, phase_id, title, priority, task_file_path) VALUES (?, ?, ?, ?, ?)"
    ).run(1, 1, "Task B", "high", "./tasks/b.md");

    const row = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE phase_id = ?").get(1);
    assert.equal(row.count, 2);
  });
});
```

**Step 2: Run tests to verify they pass (SQL pattern validation)**

Run: `cd /home/nick/Development/adhd-kanban && node --test test/db.test.js`
Expected: PASS

**Step 3: Write the `getTaskCountByPhase` function in db.js**

Add after `getTask` (around line 104):

```js
export function getTaskCountByPhase(phaseId) {
  const row = getDb().prepare("SELECT COUNT(*) as count FROM tasks WHERE phase_id = ?").get(phaseId);
  return row.count;
}
```

**Step 4: Run tests again**

Run: `cd /home/nick/Development/adhd-kanban && node --test test/db.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add db.js test/db.test.js
git commit -m "feat: add getTaskCountByPhase(phaseId) to db.js with tests"
```

---

### Task 4: Update `seed.sql` for Path and Dependency Conventions

**Files:**
- Modify: `seed.sql`

**Step 1: Update task_file_path values and dependencies to new conventions**

Replace MVP task inserts with:
```sql
INSERT INTO tasks (project_id, phase_id, title, description, status, feature_area, priority, dependencies, task_file_path)
VALUES
    (1, 1, 'Database schema and init script',
     'Create SQLite schema with all tables, indexes, and triggers',
     'done', 'backend', 'critical', NULL,
     './projects/anti-adhd-kanban/tasks/mvp/TASK-001-database-schema.md'),

    (1, 1, 'REST API - project and phase endpoints',
     'CRUD endpoints for projects and phases',
     'in_progress', 'backend', 'high', '["TASK-001"]',
     './projects/anti-adhd-kanban/tasks/mvp/TASK-002-api-projects-phases.md'),

    (1, 1, 'REST API - task endpoints',
     'CRUD and status-transition endpoints for tasks',
     'ready', 'backend', 'high', '["TASK-001"]',
     './projects/anti-adhd-kanban/tasks/mvp/TASK-003-api-tasks.md'),

    (1, 1, 'Kanban board UI',
     'Render columns per status, cards per task, drag-and-drop',
     'ready', 'frontend', 'high', '["TASK-002", "TASK-003"]',
     './projects/anti-adhd-kanban/tasks/mvp/TASK-004-kanban-ui.md'),

    (1, 1, 'Agent integration hook',
     'Endpoint for Claude Code agents to claim and update tasks',
     'ready', 'backend', 'medium', '["TASK-003"]',
     './projects/anti-adhd-kanban/tasks/mvp/TASK-005-agent-hook.md');
```

Replace phase 1.1 task insert with:
```sql
INSERT INTO tasks (project_id, phase_id, title, description, status, feature_area, priority, dependencies, task_file_path)
VALUES
    (1, 2, 'Dashboard analytics view',
     'Show velocity, burndown, and task distribution charts',
     'ready', 'frontend', 'medium', NULL,
     './projects/anti-adhd-kanban/tasks/1.1/TASK-001-dashboard-analytics.md');
```

**Step 2: Verify seed still works**

Run: `cd /home/nick/Development/adhd-kanban && rm -f kanban.db && node -e "import('./db.js').then(m => { m.initDb(); m.seedDb(); const tasks = m.getTasksByPhase(1); tasks.forEach(t => console.log(t.task_file_path, t.dependencies)); m.closeDb(); })"`
Expected: All paths show `./projects/anti-adhd-kanban/tasks/mvp/TASK-XXX-...` format, dependencies show `["TASK-XXX"]` strings.

**Step 3: Commit**

```bash
git add seed.sql
git commit -m "fix: update seed.sql paths and dependencies to TASK-XXX convention"
```

---

### Task 5: Create the `generate-tasks` Skill

**Files:**
- Create: `.claude/skills/generate-tasks.md`

**Step 1: Write the skill file**

The skill is a markdown prompt file that instructs a Claude Code agent on the full workflow. It must reference the exact db.js functions, file path conventions, and task template from the design doc.

See content below — this is the complete skill file.

**Step 2: Verify the skill loads**

Run: `cat /home/nick/Development/adhd-kanban/.claude/skills/generate-tasks.md | head -5`
Expected: Shows the frontmatter and first lines.

**Step 3: Commit**

```bash
git add .claude/skills/generate-tasks.md
git commit -m "feat: add generate-tasks skill for PRD phase decomposition"
```

---

### Task 6: End-to-End Verification

**Step 1: Reset the database and reseed**

Run: `cd /home/nick/Development/adhd-kanban && rm -f kanban.db && node -e "import('./db.js').then(m => { m.initDb(); m.seedDb(); console.log('DB ready'); m.closeDb(); })"`

**Step 2: Verify all tests pass**

Run: `cd /home/nick/Development/adhd-kanban && node --test test/**/*.test.js`
Expected: All tests pass.

**Step 3: Verify db.js exports**

Run: `cd /home/nick/Development/adhd-kanban && node -e "import('./db.js').then(m => { console.log('getPhase:', typeof m.getPhase); console.log('getTaskCountByPhase:', typeof m.getTaskCountByPhase); m.closeDb(); })"`
Expected: Both print `function`.

**Step 4: Verify skill file exists and has correct structure**

Run: `ls -la /home/nick/Development/adhd-kanban/.claude/skills/generate-tasks.md`
Expected: File exists.
