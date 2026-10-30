/* أدوات مشتركة للسيرفر */

export class HttpError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status; this.code = code; this.extra = extra;
  }
}

export const nowIso = () => new Date().toISOString();

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

export async function readJson(req, max = 32_000) {
  const len = Number(req.headers.get("content-length") || 0);
  if (len > max) throw new HttpError(413, "too_large", "الطلب كبير جدًا");
  const text = await req.text();
  if (text.length > max) throw new HttpError(413, "too_large", "الطلب كبير جدًا");
  if (!text) return {};
  try { return JSON.parse(text); } catch { throw new HttpError(400, "bad_json", "صيغة البيانات غلط"); }
}

/** نص آمن بطول محدود */
export function cleanText(v, max = 500) {
  if (v == null) return "";
  return String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // من غير 0/O و1/I
export function randomCode(n = 6) {
  const b = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(b, x => ALPHABET[x % ALPHABET.length]).join("");
}
export function randomId(bytes = 16) {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(b, x => x.toString(16).padStart(2, "0")).join("");
}

export function clientIp(req) {
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
}

/** حد للطلبات: n طلب في windowSec لكل مفتاح */
export async function rateLimit(env, key, n, windowSec) {
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare("SELECT n, reset FROM rate WHERE k = ?").bind(key).first();
  if (!row || row.reset <= now) {
    await env.DB.prepare("INSERT INTO rate (k, n, reset) VALUES (?, 1, ?) ON CONFLICT(k) DO UPDATE SET n = 1, reset = excluded.reset")
      .bind(key, now + windowSec).run();
    return;
  }
  if (row.n >= n) throw new HttpError(429, "rate_limited", "طلبات كتير ورا بعض، استنى شوية وجرّب تاني", { retryAfter: row.reset - now });
  await env.DB.prepare("UPDATE rate SET n = n + 1 WHERE k = ?").bind(key).run();
}

/** مقارنة نصوص بوقت ثابت */
export async function safeEqual(a, b) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", crypto.getRandomValues(new Uint8Array(32)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const [x, y] = await Promise.all([crypto.subtle.sign("HMAC", key, enc.encode(String(a))), crypto.subtle.sign("HMAC", key, enc.encode(String(b)))]);
  const u = new Uint8Array(x), v = new Uint8Array(y);
  let d = 0; for (let i = 0; i < u.length; i++) d |= u[i] ^ v[i];
  return d === 0;
}

export async function hmacHex(secret, data) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, typeof data === "string" ? enc.encode(data) : data);
  return Array.from(new Uint8Array(sig), x => x.toString(16).padStart(2, "0")).join("");
}

/** إخفاء جزء من الرقم في السجلات والردود العامة */
export const maskPhone = p => (p ? p.slice(0, 4) + "•••" + p.slice(-3) : "");

/** سجل تشخيصي من غير بيانات العملاء */
export function log(level, msg, extra = {}) {
  const safe = {};
  for (const [k, v] of Object.entries(extra)) {
    if (/phone|name|token|secret|key|password|text|message/i.test(k)) continue;
    safe[k] = v;
  }
  console[level === "error" ? "error" : "log"](JSON.stringify({ level, msg, ...safe }));
}
