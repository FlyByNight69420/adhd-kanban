import Database from "better-sqlite3";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const schema = readFileSync(resolve(__dirname, "../init.sql"), "utf-8");

export function createTestDb() {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(schema);
  return db;
}

export function seedTestDb(db) {
  db.prepare(
    "INSERT INTO projects (project_id, name, prd_file_path) VALUES (1, 'Test Project', './docs/prd.md')"
  ).run();
  db.prepare(
    "INSERT INTO phases (phase_id, project_id, phase_name, phase_order, status) VALUES (1, 1, 'mvp', 1, 'active')"
  ).run();
  db.prepare(
    "INSERT INTO phases (phase_id, project_id, phase_name, phase_order, status) VALUES (2, 1, '1.1', 2, 'locked')"
  ).run();
}
