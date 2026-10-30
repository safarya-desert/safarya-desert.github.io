/* ستارفول ديزرت — السيرفر (Cloudflare Worker)
   الموقع نفسه على GitHub Pages، وده الـ API بتاعه. */
import { POLICY, RESERVES } from "../../shared/catalog.js";
import { normalizePhone, isIsoDate } from "../../shared/pricing.js";
import { json, readJson, HttpError, clientIp, rateLimit, cleanText, nowIso, log } from "./util.js";
import { listTrips, getTrip, listFaq, checkOffer, createBooking, findOwnBooking, cancelOwnBooking, publicBooking, sanitizeTrip, setStatus, addEvent, effectiveStatus, ensureSeed } from "./core.js";
import { login, requireAdmin } from "./auth.js";
import { handleMessage, getOrCreateConversation } from "./agent.js";
import { verifyChallenge, verifySignature, extractMessages, markSeen, sendText, notifyBooking, waConfigured } from "./whatsapp.js";

/* ---------- CORS: الموقع بس هو اللي يقدر يكلّم الـ API ---------- */
function allowedOrigin(req, env) {
  const origin = req.headers.get("origin");
  if (!origin) return null;
  const list = (env.ALLOWED_ORIGINS || "https://safarya-desert.github.io").split(",").map(s => s.trim());
  if (list.includes(origin)) return origin;
  if (env.ALLOW_LOCALHOST === "1" && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  return null;
}
function withCors(res, origin) {
  if (!origin) return res;
  const h = new Headers(res.headers);
  h.set("access-control-allow-origin", origin);
  h.set("vary", "origin");
  h.set("access-control-allow-headers", "content-type, authorization");
  h.set("access-control-allow-methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
  h.set("access-control-max-age", "86400");
  return new Response(res.body, { status: res.status, headers: h });
}

/* ---------- الراوتر ---------- */
const routes = [];
const route = (method, pattern, handler) => routes.push({ method, re: new RegExp("^" + pattern.replace(/:(\w+)/g, "(?<$1>[^/]+)") + "$"), handler });

route("GET", "/api/health", async (req, env) => ({ ok: true, time: nowIso(), agent: !!env.GEMINI_API_KEY, whatsapp: waConfigured(env), admin: !!(env.ADMIN_PASSWORD && env.SESSION_SECRET) }));

route("GET", "/api/catalog", async (req, env) => {
  const [trips, faq] = await Promise.all([listTrips(env), listFaq(env)]);
  return { trips: trips.map(sanitizeTrip), reserves: RESERVES, faq: faq.map(({ q, a }) => ({ q, a })), policy: POLICY, whatsapp: env.PUBLIC_WHATSAPP || null };
});

route("POST", "/api/availability", async (req, env) => {
  await rateLimit(env, "av:" + clientIp(req), 60, 60);
  const b = await readJson(req);
  const o = await checkOffer(env, { tripId: b.tripId, date: b.date, party: b.party });
  return { available: o.available, seatsLeft: o.seatsLeft ?? null, seatsNeeded: o.seats, reason: o.reason || null, message: o.message || null, quote: o.quote, quoteOnly: !!o.quoteOnly };
});

/* الأيام المتاحة لشهر كامل (للتقويم) */
route("POST", "/api/calendar", async (req, env) => {
  await rateLimit(env, "cal:" + clientIp(req), 30, 60);
  const b = await readJson(req);
  if (!/^\d{4}-\d{2}$/.test(b.month || "")) throw new HttpError(400, "bad_month", "الشهر مش صحيح");
  const trip = await getTrip(env, b.tripId);
  if (!trip) throw new HttpError(404, "trip_not_found", "الرحلة مش موجودة");
  const [y, m] = b.month.split("-").map(Number);
  const daysIn = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const out = {};
  for (let d = 1; d <= daysIn; d++) {
    const date = `${b.month}-${String(d).padStart(2, "0")}`;
    const o = await checkOffer(env, { tripId: trip.id, date, party: b.party || { adults: 1 } });
    out[date] = o.available ? (o.seatsLeft ?? true) : 0;
  }
  return { tripId: trip.id, month: b.month, days: out };
});

route("POST", "/api/bookings", async (req, env, ctx) => {
  await rateLimit(env, "bk:" + clientIp(req), 6, 600);
  const b = await readJson(req);
  if (b.website) throw new HttpError(400, "bad_request", "طلب غير صالح"); // فخ للبوتات
  if (b.consent !== true) throw new HttpError(400, "consent", "لازم توافق على الشروط وسياسة الخصوصية");
  const res = await createBooking(env, { tripId: b.tripId, date: b.date, party: b.party, name: b.name, phone: b.phone, note: b.note, idemKey: b.idemKey }, { source: "web" });
  let notify = null;
  if (!res.duplicate) {
    const row = res.row;
    // الإشعار بيتبعت في الخلفية، والحجز محفوظ مهما حصل
    const p = notifyBooking(env, { ...res.booking, phone: row.phone })
      .then(s => env.DB.prepare("UPDATE bookings SET notify_status = ? WHERE id = ?").bind(s, row.id).run().then(() => s))
      .catch(e => { log("error", "notify_failed", { err: String(e) }); return "failed"; });
    ctx.waitUntil(p);
    notify = waConfigured(env) ? "queued" : "not_configured";
  }
  return { booking: res.booking, duplicate: !!res.duplicate, notify, whatsapp: env.PUBLIC_WHATSAPP || null };
});

route("POST", "/api/bookings/lookup", async (req, env) => {
  await rateLimit(env, "lk:" + clientIp(req), 10, 60);
  const b = await readJson(req);
  const row = await findOwnBooking(env, b.ref, b.phone);
  return { booking: publicBooking(row) };
});

route("POST", "/api/bookings/cancel", async (req, env) => {
  await rateLimit(env, "cx:" + clientIp(req), 5, 600);
  const b = await readJson(req);
  if (b.confirm !== true) throw new HttpError(400, "confirm", "أكّد الإلغاء الأول");
  return cancelOwnBooking(env, b.ref, b.phone);
});

route("POST", "/api/contact", async (req, env) => {
  await rateLimit(env, "ct:" + clientIp(req), 4, 600);
  const b = await readJson(req);
  if (b.website) throw new HttpError(400, "bad_request", "طلب غير صالح");
  const name = cleanText(b.name, 80), phone = normalizePhone(String(b.phone || "")), msg = cleanText(b.message, 1500);
  if (name.length < 2) throw new HttpError(400, "bad_name", "اكتب اسمك");
  if (!phone) throw new HttpError(400, "bad_phone", "رقم الموبايل مش صحيح");
  if (msg.length < 5) throw new HttpError(400, "bad_message", "اكتب رسالتك");
  if (b.consent !== true) throw new HttpError(400, "consent", "لازم توافق على سياسة الخصوصية");
  await env.DB.prepare("INSERT INTO handoffs (kind, name, phone, reason, created_at) VALUES ('contact', ?, ?, ?, ?)").bind(name, phone, msg, nowIso()).run();
  return { ok: true };
});

route("POST", "/api/chat", async (req, env) => {
  await rateLimit(env, "chat:" + clientIp(req), 20, 60);
  const b = await readJson(req, 8000);
  const text = cleanText(b.message, 2000);
  if (!text) throw new HttpError(400, "empty", "اكتب رسالتك");
  const conv = await getOrCreateConversation(env, { id: b.conversationId, channel: "web" });
  await rateLimit(env, "chatc:" + conv.id, 60, 3600);
  const r = await handleMessage(env, { conv, text, channel: "web" });
  return { conversationId: conv.id, reply: r.reply ?? "اتحوّلت لموظف من الفريق. هيرد عليك على واتساب في أقرب وقت.", booking: r.booking ? publicBooking2(r.booking) : null, handoff: !!r.handoff, error: r.error || null, whatsapp: env.PUBLIC_WHATSAPP || null };
});
const publicBooking2 = b => { const { phone, ...rest } = b; return rest; };

/* ---------- واتساب ---------- */
route("GET", "/webhooks/whatsapp", async (req, env) => verifyChallenge(new URL(req.url), env));
route("POST", "/webhooks/whatsapp", async (req, env, ctx) => {
  const raw = await req.text();
  if (!(await verifySignature(raw, req.headers.get("x-hub-signature-256"), env))) return new Response("bad signature", { status: 401 });
  let payload; try { payload = JSON.parse(raw); } catch { return new Response("ok"); }
  // نرد على Meta بسرعة، والمعالجة في الخلفية
  ctx.waitUntil(processWhatsApp(env, payload).catch(e => log("error", "wa_process_failed", { err: String(e) })));
  return new Response("ok");
});

export async function processWhatsApp(env, payload, opts = {}) {
  const results = [];
  for (const m of extractMessages(payload)) {
    if (!(await markSeen(env, m.id))) { results.push({ id: m.id, skipped: "duplicate" }); continue; }
    const from = normalizePhone(m.from) || m.from;
    const conv = await getOrCreateConversation(env, { channel: "whatsapp", externalId: from });
    if (!m.text) {
      await sendText(env, from, "معلش، أنا بفهم الرسايل المكتوبة بس دلوقتي. اكتب طلبك وأنا معاك.");
      results.push({ id: m.id, skipped: "non_text" }); continue;
    }
    const r = await handleMessage(env, { conv, text: m.text, channel: "whatsapp", phone: from, ...opts });
    let sent = null;
    if (r.reply) sent = await sendText(env, from, r.reply);
    if (r.booking) {
      const st = sent?.ok ? "sent_in_chat" : `failed:${sent?.code || sent?.error || "unknown"}`;
      await env.DB.prepare("UPDATE bookings SET notify_status = ? WHERE ref = ?").bind(st, r.booking.ref).run();
    }
    results.push({ id: m.id, replied: !!sent?.ok, handoff: !!r.handoff });
  }
  return results;
}

/* ---------- لوحة الإدارة ---------- */
route("POST", "/api/admin/login", async (req, env) => login(req, env, await readJson(req)));

const admin = (method, pattern, fn) => route(method, pattern, async (req, env, ctx, params) => { const user = await requireAdmin(req, env); return fn(req, env, params, user, ctx); });

admin("GET", "/api/admin/stats", async (req, env) => {
  const now = nowIso();
  const r = await env.DB.prepare(`SELECT
    SUM(status='pending' AND expires_at > ?) AS pending, SUM(status='confirmed') AS confirmed, SUM(status='quote') AS quotes,
    SUM(status='cancelled') AS cancelled, SUM(status='pending' AND expires_at <= ?) AS expired,
    SUM(CASE WHEN status='confirmed' AND currency='EGP' THEN total ELSE 0 END) AS revenue_egp,
    SUM(CASE WHEN status='confirmed' AND currency='USD' THEN total ELSE 0 END) AS revenue_usd FROM bookings`).bind(now, now).first();
  const h = await env.DB.prepare("SELECT COUNT(*) AS n FROM handoffs WHERE resolved_at IS NULL").first();
  return { ...r, openHandoffs: h.n };
});

admin("GET", "/api/admin/bookings", async (req, env) => {
  const u = new URL(req.url), q = cleanText(u.searchParams.get("q"), 60), st = u.searchParams.get("status"), trip = u.searchParams.get("trip");
  const from = u.searchParams.get("from"), to = u.searchParams.get("to");
  const where = [], args = [];
  if (q) { where.push("(ref LIKE ? OR name LIKE ? OR phone LIKE ?)"); args.push(`%${q}%`, `%${q}%`, `%${q.replace(/\D/g, "") || q}%`); }
  if (st === "expired") { where.push("status = 'pending' AND expires_at <= ?"); args.push(nowIso()); }
  else if (st === "pending") { where.push("status = 'pending' AND expires_at > ?"); args.push(nowIso()); }
  else if (["confirmed", "cancelled", "completed", "quote"].includes(st)) { where.push("status = ?"); args.push(st); }
  if (trip) { where.push("trip_id = ?"); args.push(trip); }
  if (from && isIsoDate(from)) { where.push("date >= ?"); args.push(from); }
  if (to && isIsoDate(to)) { where.push("date <= ?"); args.push(to); }
  const rs = await env.DB.prepare(`SELECT * FROM bookings ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC LIMIT 300`).bind(...args).all();
  return { bookings: rs.results.map(r => ({ ...r, status_effective: effectiveStatus(r) })) };
});

admin("GET", "/api/admin/bookings/:ref", async (req, env, p) => {
  const row = await env.DB.prepare("SELECT * FROM bookings WHERE ref = ?").bind(p.ref).first();
  if (!row) throw new HttpError(404, "not_found", "الحجز مش موجود");
  const ev = await env.DB.prepare("SELECT at, actor, action, detail FROM booking_events WHERE booking_id = ? ORDER BY id").bind(row.id).all();
  return { booking: { ...row, status_effective: effectiveStatus(row) }, events: ev.results };
});

admin("PATCH", "/api/admin/bookings/:ref", async (req, env, p, user) => {
  const b = await readJson(req);
  const row = await env.DB.prepare("SELECT * FROM bookings WHERE ref = ?").bind(p.ref).first();
  if (!row) throw new HttpError(404, "not_found", "الحجز مش موجود");
  if (b.status && b.status !== row.status) {
    if (b.status === "confirmed" && row.status === "pending") {
      // قبل التأكيد: الحجز المبدئي ممكن تكون مهلته خلصت ومقاعده راحت لحد تاني
      const trip = await getTrip(env, row.trip_id, { includeInactive: true });
      if (trip && effectiveStatus(row) === "expired") {
        const o = await checkOffer(env, { tripId: row.trip_id, date: row.date, party: { adults: row.adults, kidsSmall: row.kids_small, kids: row.kids, infants: row.infants, tier: row.tier } }).catch(() => null);
        if (o && o.seatsLeft != null && o.seatsLeft < row.seats) throw new HttpError(409, "full", "مهلة الحجز خلصت والمقاعد اتحجزت لحد تاني — غيّر التاريخ أو زوّد المقاعد الأول");
      }
    }
    await setStatus(env, row, b.status, "admin", cleanText(b.reason, 200) || null, b.refundDue != null ? Math.max(0, Math.round(Number(b.refundDue) || 0)) : undefined);
  }
  if (b.adminNote !== undefined) {
    await env.DB.prepare("UPDATE bookings SET admin_note = ?, updated_at = ? WHERE id = ?").bind(cleanText(b.adminNote, 1000), nowIso(), row.id).run();
    await addEvent(env, row.id, "admin", "note", null);
  }
  if (b.date && b.date !== row.date) {
    if (!isIsoDate(b.date)) throw new HttpError(400, "bad_date", "التاريخ مش صحيح");
    const o = await checkOffer(env, { tripId: row.trip_id, date: b.date, party: { adults: row.adults, kidsSmall: row.kids_small, kids: row.kids, infants: row.infants, tier: row.tier } });
    if (!o.available && !b.force) throw new HttpError(409, o.reason || "unavailable", o.message + " (تقدر تفرض التغيير من الخيار «تجاوز»)");
    await env.DB.prepare("UPDATE bookings SET date = ?, updated_at = ? WHERE id = ?").bind(b.date, nowIso(), row.id).run();
    await addEvent(env, row.id, "admin", "date", `${row.date} → ${b.date}${b.force ? " (تجاوز)" : ""}`);
  }
  const fresh = await env.DB.prepare("SELECT * FROM bookings WHERE id = ?").bind(row.id).first();
  return { booking: { ...fresh, status_effective: effectiveStatus(fresh) } };
});

admin("POST", "/api/admin/bookings/:ref/notify", async (req, env, p) => {
  const row = await env.DB.prepare("SELECT * FROM bookings WHERE ref = ?").bind(p.ref).first();
  if (!row) throw new HttpError(404, "not_found", "الحجز مش موجود");
  const s = await notifyBooking(env, { ...publicBooking(row), phone: row.phone });
  await env.DB.prepare("UPDATE bookings SET notify_status = ? WHERE id = ?").bind(s, row.id).run();
  await addEvent(env, row.id, "admin", "notify", s);
  return { notify: s };
});

admin("GET", "/api/admin/trips", async (req, env) => ({ trips: (await listTrips(env, { includeInactive: true })).map(sanitizeTrip) }));

admin("PUT", "/api/admin/trips/:id", async (req, env, p) => {
  const t = await getTrip(env, p.id, { includeInactive: true });
  if (!t) throw new HttpError(404, "trip_not_found", "الرحلة مش موجودة");
  const b = await readJson(req, 64_000);
  const next = { ...t };
  const str = (k, n) => { if (b[k] !== undefined) next[k] = cleanText(b[k], n); };
  ["title", "titleEn", "route", "dur", "summary", "badge", "mkEgp", "mkUsd"].forEach(k => str(k, k === "summary" ? 800 : 160));
  const num = (k, min, max, nullable) => { if (b[k] === undefined) return; if (b[k] === null && nullable) { next[k] = null; return; } const v = Number(b[k]); if (!Number.isFinite(v) || v < min || v > max) throw new HttpError(400, "bad_" + k, `قيمة ${k} مش صحيحة`); next[k] = v; };
  num("egp", 0, 1e6, true); num("usd", 0, 1e5, true); num("seats", 0, 200); num("days", 1, 60); num("old", 0, 1e6, true); num("leadDays", 0, 120, true);
  if (Array.isArray(b.months)) next.months = b.months.map(Number).filter(m => m >= 1 && m <= 12);
  if (Array.isArray(b.inc)) next.inc = b.inc.map(x => cleanText(x, 60)).filter(Boolean).slice(0, 10);
  if (Array.isArray(b.itin)) next.itin = b.itin.filter(x => Array.isArray(x)).map(([d, x]) => [cleanText(d, 40), cleanText(x, 600)]).slice(0, 20);
  if (Array.isArray(b.gallery)) next.gallery = b.gallery.map(x => cleanText(x, 40)).filter(Boolean).slice(0, 10);
  if (b.cover !== undefined) next.cover = cleanText(b.cover, 40);
  if (b.quoteOnly !== undefined) next.quoteOnly = !!b.quoteOnly;
  const active = b.active === undefined ? t.active : !!b.active;
  delete next.active; delete next.sort;
  await env.DB.prepare("UPDATE trips SET data = ?, active = ?, updated_at = datetime('now') WHERE id = ?").bind(JSON.stringify(next), active ? 1 : 0, t.id).run();
  return { trip: sanitizeTrip({ ...next, active }) };
});

admin("GET", "/api/admin/departures", async (req, env) => {
  const u = new URL(req.url), trip = u.searchParams.get("trip");
  const rs = await env.DB.prepare(`SELECT * FROM departures ${trip ? "WHERE trip_id = ?" : ""} ORDER BY date`).bind(...(trip ? [trip] : [])).all();
  return { departures: rs.results };
});
admin("PUT", "/api/admin/departures", async (req, env) => {
  const b = await readJson(req);
  if (!(await getTrip(env, b.tripId, { includeInactive: true }))) throw new HttpError(404, "trip_not_found", "الرحلة مش موجودة");
  if (!isIsoDate(b.date)) throw new HttpError(400, "bad_date", "التاريخ مش صحيح");
  const seats = b.seats === null || b.seats === "" || b.seats === undefined ? null : Math.max(0, Math.min(200, Math.round(Number(b.seats))));
  await env.DB.prepare("INSERT INTO departures (trip_id, date, seats, closed, note) VALUES (?, ?, ?, ?, ?) ON CONFLICT(trip_id, date) DO UPDATE SET seats = excluded.seats, closed = excluded.closed, note = excluded.note")
    .bind(b.tripId, b.date, Number.isFinite(seats) ? seats : null, b.closed ? 1 : 0, cleanText(b.note, 200) || null).run();
  return { ok: true };
});
admin("DELETE", "/api/admin/departures", async (req, env) => {
  const u = new URL(req.url);
  await env.DB.prepare("DELETE FROM departures WHERE trip_id = ? AND date = ?").bind(u.searchParams.get("trip"), u.searchParams.get("date")).run();
  return { ok: true };
});

admin("GET", "/api/admin/faq", async (req, env) => ({ faq: await listFaq(env, { all: true }) }));
admin("POST", "/api/admin/faq", async (req, env) => {
  const b = await readJson(req); const q = cleanText(b.q, 200), a = cleanText(b.a, 2000);
  if (!q || !a) throw new HttpError(400, "bad_faq", "السؤال والإجابة مطلوبين");
  const r = await env.DB.prepare("INSERT INTO faq (q, a, sort, active) VALUES (?, ?, ?, ?)").bind(q, a, Number(b.sort) || 99, b.active === false ? 0 : 1).run();
  return { id: r.meta.last_row_id };
});
admin("PUT", "/api/admin/faq/:id", async (req, env, p) => {
  const b = await readJson(req); const q = cleanText(b.q, 200), a = cleanText(b.a, 2000);
  if (!q || !a) throw new HttpError(400, "bad_faq", "السؤال والإجابة مطلوبين");
  await env.DB.prepare("UPDATE faq SET q = ?, a = ?, sort = ?, active = ? WHERE id = ?").bind(q, a, Number(b.sort) || 0, b.active === false ? 0 : 1, Number(p.id)).run();
  return { ok: true };
});
admin("DELETE", "/api/admin/faq/:id", async (req, env, p) => { await env.DB.prepare("DELETE FROM faq WHERE id = ?").bind(Number(p.id)).run(); return { ok: true }; });

admin("GET", "/api/admin/conversations", async (req, env) => {
  const rs = await env.DB.prepare(`SELECT c.*, (SELECT COUNT(*) FROM messages m WHERE m.conv_id = c.id AND m.role = 'user') AS user_msgs FROM conversations c ORDER BY updated_at DESC LIMIT 200`).all();
  return { conversations: rs.results };
});
admin("GET", "/api/admin/conversations/:id", async (req, env, p) => {
  const c = await env.DB.prepare("SELECT * FROM conversations WHERE id = ?").bind(p.id).first();
  if (!c) throw new HttpError(404, "not_found", "المحادثة مش موجودة");
  const m = await env.DB.prepare("SELECT role, text, at FROM messages WHERE conv_id = ? AND text IS NOT NULL ORDER BY id").bind(p.id).all();
  return { conversation: c, messages: m.results };
});
admin("POST", "/api/admin/conversations/:id/status", async (req, env, p) => {
  const b = await readJson(req);
  if (!["bot", "human", "closed"].includes(b.status)) throw new HttpError(400, "bad_status", "حالة غير صحيحة");
  await env.DB.prepare("UPDATE conversations SET status = ?, updated_at = ? WHERE id = ?").bind(b.status, nowIso(), p.id).run();
  return { ok: true };
});
/* رد موظف على عميل واتساب (داخل نافذة الـ ٢٤ ساعة بس) */
admin("POST", "/api/admin/conversations/:id/reply", async (req, env, p) => {
  const b = await readJson(req); const text = cleanText(b.text, 3000);
  const c = await env.DB.prepare("SELECT * FROM conversations WHERE id = ?").bind(p.id).first();
  if (!c || c.channel !== "whatsapp") throw new HttpError(400, "not_whatsapp", "الرد المباشر متاح لمحادثات واتساب بس");
  if (!text) throw new HttpError(400, "empty", "اكتب الرد");
  if (!c.last_user_at || Date.now() - Date.parse(c.last_user_at) > 24 * 3600e3) throw new HttpError(409, "window_closed", "عدّت ٢٤ ساعة على آخر رسالة من العميل — واتساب بيسمح بقوالب معتمدة بس دلوقتي");
  const r = await sendText(env, c.external_id, text);
  if (!r.ok) throw new HttpError(502, "send_failed", "الرسالة متبعتتش: " + (r.error || ""));
  await env.DB.prepare("INSERT INTO messages (conv_id, role, text, at) VALUES (?, 'staff', ?, ?)").bind(c.id, text, nowIso()).run();
  return { ok: true };
});

admin("GET", "/api/admin/handoffs", async (req, env) => ({ handoffs: (await env.DB.prepare("SELECT * FROM handoffs ORDER BY resolved_at IS NOT NULL, created_at DESC LIMIT 200").all()).results }));
admin("POST", "/api/admin/handoffs/:id/resolve", async (req, env, p) => { await env.DB.prepare("UPDATE handoffs SET resolved_at = ? WHERE id = ?").bind(nowIso(), Number(p.id)).run(); return { ok: true }; });

/* حذف المحادثات القديمة حسب سياسة الخصوصية (بيشتغل يوميًا من Cron) */
export async function retention(env) {
  const days = Number(env.CHAT_RETENTION_DAYS || 90);
  const cut = new Date(Date.now() - days * 864e5).toISOString();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM messages WHERE conv_id IN (SELECT id FROM conversations WHERE updated_at < ?)").bind(cut),
    env.DB.prepare("DELETE FROM conversations WHERE updated_at < ?").bind(cut),
    env.DB.prepare("DELETE FROM quotes WHERE expires_at < ?").bind(nowIso()),
    env.DB.prepare("DELETE FROM wa_seen WHERE at < ?").bind(new Date(Date.now() - 7 * 864e5).toISOString()),
    env.DB.prepare("DELETE FROM rate WHERE reset < ?").bind(Math.floor(Date.now() / 1000)),
  ]);
}

/* ---------- نقطة الدخول ---------- */
export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const origin = allowedOrigin(req, env);
    if (req.method === "OPTIONS") return withCors(new Response(null, { status: origin ? 204 : 403 }), origin);
    // طلبات المتصفح من مواقع تانية مرفوضة (الـ webhook مالوش origin)
    if (req.headers.get("origin") && !origin && url.pathname.startsWith("/api/")) return json({ error: "forbidden_origin", message: "مش مسموح" }, 403);
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const m = url.pathname.match(r.re);
      if (!m) continue;
      try {
        await ensureSeed(env);
        const out = await r.handler(req, env, ctx, m.groups || {});
        return withCors(out instanceof Response ? out : json(out), origin);
      } catch (e) {
        if (e instanceof HttpError) return withCors(json({ error: e.code, message: e.message, ...e.extra }, e.status, e.status === 429 ? { "retry-after": String(e.extra.retryAfter || 60) } : {}), origin);
        log("error", "unhandled", { path: url.pathname, err: String(e).slice(0, 300) });
        return withCors(json({ error: "internal", message: "حصلت مشكلة في السيرفر، جرّب تاني بعد شوية" }, 500), origin);
      }
    }
    return withCors(json({ error: "not_found", message: "مش موجود" }, 404), origin);
  },
  async scheduled(event, env, ctx) { ctx.waitUntil(retention(env)); },
};
