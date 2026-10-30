/* محاكي بسيط لـ Cloudflare D1 فوق node:sqlite — للاختبار المحلي بس */
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

class Stmt {
  constructor(db, sql, args = []) { this.db = db; this.sql = sql; this.args = args; }
  bind(...args) { return new Stmt(this.db, this.sql, args.map(a => (a === undefined ? null : typeof a === "boolean" ? (a ? 1 : 0) : a))); }
  _p() { return this.db.prepare(this.sql); }
  async first(col) { const r = this._p().get(...this.args); if (!r) return null; const o = { ...r }; return col ? o[col] : o; }
  async all() { return { results: this._p().all(...this.args).map(r => ({ ...r })), success: true }; }
  async run() { const r = this._p().run(...this.args); return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; }
  _runSync() { const r = this._p().run(...this.args); return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; }
}

export function makeD1(schemaPath) {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(schemaPath, "utf8"));
  return {
    _db: db,
    prepare: sql => new Stmt(db, sql),
    async batch(stmts) {
      db.exec("BEGIN");
      try { const out = stmts.map(s => s._runSync()); db.exec("COMMIT"); return out; }
      catch (e) { db.exec("ROLLBACK"); throw e; }
    },
  };
}

export function makeCtx() {
  const pending = [];
  return { waitUntil: p => pending.push(p), passThroughOnException() {}, flush: () => Promise.allSettled(pending.splice(0)) };
}
