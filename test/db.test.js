import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { createTestDb, seedTestDb } from "./helpers.js";

describe("getPhase SQL pattern", () => {
  let db;

  before(() => {
    db = createTestDb();
    seedTestDb(db);
  });

  it("returns a phase object with correct fields for a valid phase_id", () => {
    const phase = db.prepare("SELECT * FROM phases WHERE phase_id = ?").get(1);
    assert.ok(phase, "phase should not be undefined");
    assert.equal(phase.phase_id, 1);
    assert.equal(phase.phase_name, "mvp");
    assert.equal(phase.status, "active");
    assert.equal(phase.project_id, 1);
  });

  it("returns undefined for a nonexistent phase_id", () => {
    const phase = db.prepare("SELECT * FROM phases WHERE phase_id = ?").get(9999);
    assert.equal(phase, undefined);
  });
});

describe("getTaskCountByPhase SQL pattern", () => {
  let db;

  before(() => {
    db = createTestDb();
    seedTestDb(db);
  });

  it("returns 0 when phase has no tasks", () => {
    const row = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE phase_id = ?").get(1);
    assert.equal(row.count, 0);
  });

  it("returns correct count after inserting tasks", () => {
    db.prepare(
      "INSERT INTO tasks (project_id, phase_id, title, task_file_path) VALUES (1, 1, 'Task A', './tasks/a.md')"
    ).run();
    db.prepare(
      "INSERT INTO tasks (project_id, phase_id, title, task_file_path) VALUES (1, 1, 'Task B', './tasks/b.md')"
    ).run();
    const row = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE phase_id = ?").get(1);
    assert.equal(row.count, 2);
  });
});
