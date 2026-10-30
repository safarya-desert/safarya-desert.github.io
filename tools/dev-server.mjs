/* سيرفر تجربة محلي: بيعرض الموقع + السيرفر (Worker) على نفس الجهاز بقاعدة بيانات SQLite مؤقتة.
   التشغيل:  node --no-warnings tools/dev-server.mjs   ثم افتح http://localhost:8080
   (للتجربة بس — النشر الحقيقي على GitHub Pages + Cloudflare، شوف DEPLOY.md) */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { makeD1, makeCtx } from "../worker/test/d1shim.mjs";
import worker from "../worker/src/index.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT || 8080);
const API = process.env.NO_API ? "" : `http://localhost:${PORT}`;
const env = { DB: makeD1(join(ROOT, "worker/schema.sql")), ALLOW_LOCALHOST: "1", ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "admin-dev", SESSION_SECRET: "dev-".repeat(10), PUBLIC_WHATSAPP: process.env.WA || "201000000000", GEMINI_API_KEY: process.env.GEMINI_API_KEY || "" };
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".json": "application/json", ".xml": "application/xml", ".txt": "text/plain; charset=utf-8", ".csv": "text/csv; charset=utf-8", ".jpg": "image/jpeg", ".png": "image/png" };

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/webhooks/")) {
      const body = ["GET", "HEAD"].includes(req.method) ? undefined : await new Promise(r => { const c = []; req.on("data", d => c.push(d)); req.on("end", () => r(Buffer.concat(c))); });
      const headers = new Headers(); for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
      const r = await worker.fetch(new Request(url, { method: req.method, headers, body }), env, makeCtx());
      res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer())); return;
    }
    if (url.pathname === "/assets/js/config.js") {
      res.writeHead(200, { "content-type": TYPES[".js"], "cache-control": "no-store" });
      res.end(`export const CONFIG = { API_BASE: ${JSON.stringify(API)}, WHATSAPP: ${JSON.stringify(process.env.WA || "201000000000")} };`); return;
    }
    let p = join(ROOT, decodeURIComponent(url.pathname));
    if (!p.startsWith(ROOT)) throw Object.assign(new Error("bad path"), { code: "ENOENT" });
    if ((await stat(p).catch(() => null))?.isDirectory()) p = join(p, "index.html");
    const data = await readFile(p);
    res.writeHead(200, { "content-type": TYPES[extname(p)] || "application/octet-stream", "cache-control": "no-store" }); res.end(data);
  } catch (e) {
    const nf = await readFile(join(ROOT, "404.html")).catch(() => "404");
    res.writeHead(404, { "content-type": TYPES[".html"] }); res.end(nf);
  }
}).listen(PORT, () => console.log(`سفرية ديزرت شغال على http://localhost:${PORT}  (API: ${API || "متقفل"}) — كلمة سر الإدارة: ${env.ADMIN_PASSWORD}`));
