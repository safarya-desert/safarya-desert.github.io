/* منطق الحجوزات — بيستخدمه الـ API والوكيل ولوحة الإدارة.
   أي عملية بتعدّل بيانات بتمر من هنا عشان القواعد تبقى واحدة. */
import { TRIPS, FAQ, POLICY } from "../../shared/catalog.js";
import { normalizeParty, seatsNeeded, quote, checkDateRules, cairoToday, normalizePhone, refundFor, addDays } from "../../shared/pricing.js";
import { HttpError, nowIso, randomCode, cleanText, log } from "./util.js";

/* ---------- البيانات الأولية ---------- */
let seeded = false;
export async function ensureSeed(env) {
  if (seeded) return;
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM trips").first();
  if (!row || row.n === 0) {
    const stmts = TRIPS.map((t, i) => env.DB.prepare("INSERT OR IGNORE INTO trips (id, data, active, sort) VALUES (?, ?, 1, ?)").bind(t.id, JSON.stringify(t), i));
    const f = await env.DB.prepare("SELECT COUNT(*) AS n FROM faq").first();
    if (!f || f.n === 0) FAQ.forEach((x, i) => stmts.push(env.DB.prepare("INSERT INTO faq (q, a, sort) VALUES (?, ?, ?)").bind(x.q, x.a, i)));
    await env.DB.batch(stmts);
    log("info", "seeded", { trips: TRIPS.length });
  }
  seeded = true;
}

export async function listTrips(env, { includeInactive = false } = {}) {
  await ensureSeed(env);
  const rs = await env.DB.prepare(`SELECT id, data, active, sort FROM trips ${includeInactive ? "" : "WHERE active = 1"} ORDER BY sort, id`).all();
  return rs.results.map(r => ({ ...JSON.parse(r.data), id: r.id, active: !!r.active, sort: r.sort }));
}

export async function getTrip(env, id, { includeInactive = false } = {}) {
  await ensureSeed(env);
  if (typeof id !== "string" || !/^[a-z0-9-]{1,40}$/.test(id)) return null;
  const r = await env.DB.prepare("SELECT id, data, active, sort FROM trips WHERE id = ?").bind(id).first();
  if (!r || (!r.active && !includeInactive)) return null;
  return { ...JSON.parse(r.data), id: r.id, active: !!r.active, sort: r.sort };
}

export async function listFaq(env, { all = false } = {}) {
  await ensureSeed(env);
  const rs = await env.DB.prepare(`SELECT id, q, a, sort, active FROM faq ${all ? "" : "WHERE active = 1"} ORDER BY sort, id`).all();
  return rs.results;
}

/* ---------- التوافر ---------- */
const ACTIVE_HOLD = `(status = 'confirmed' OR (status = 'pending' AND expires_at > ?))`;

export async function availability(env, trip, date) {
  const dep = await env.DB.prepare("SELECT seats, closed, note FROM departures WHERE trip_id = ? AND date = ?").bind(trip.id, date).first();
  const capacity = dep?.closed ? 0 : (dep?.seats ?? trip.seats ?? 12);
  const used = await env.DB.prepare(`SELECT COALESCE(SUM(seats), 0) AS used FROM bookings WHERE trip_id = ? AND date = ? AND ${ACTIVE_HOLD}`)
    .bind(trip.id, date, nowIso()).first();
  return { capacity, used: used.used, left: Math.max(0, capacity - used.used), closed: !!dep?.closed, note: dep?.note || null };
}

/** فحص كامل: قواعد التاريخ + المقاعد + السعر. مابيكتبش أي حاجة. */
export async function checkOffer(env, { tripId, date, party: rawParty }) {
  const trip = await getTrip(env, tripId);
  if (!trip) throw new HttpError(404, "trip_not_found", "الرحلة دي مش موجودة");
  const np = normalizeParty(rawParty || {});
  if (!np.ok) throw new HttpError(400, "bad_party", np.error);
  const party = np.party;
  const rules = checkDateRules(trip, date);
  const seats = seatsNeeded(party);
  const q = quote(trip, party);
  if (!rules.ok) return { trip, party, seats, quote: q, available: false, reason: rules.code, message: rules.error, rules };
  if (trip.quoteOnly) return { trip, party, seats, quote: null, available: true, quoteOnly: true, message: "الرحلة دي بعرض سعر حسب حجم المجموعة والتصاريح" };
  const av = await availability(env, trip, date);
  if (av.closed) return { trip, party, seats, quote: q, available: false, reason: "closed", message: "الرحلة مش طالعة في اليوم ده", seatsLeft: 0 };
  if (av.left < seats) return { trip, party, seats, quote: q, available: false, reason: "full", message: av.left ? `فاضل ${av.left} أماكن بس في اليوم ده` : "اليوم ده كامل", seatsLeft: av.left };
  return { trip, party, seats, quote: q, available: true, seatsLeft: av.left };
}

/* ---------- إنشاء الحجز ---------- */
export async function createBooking(env, input, { source = "web", actor = "customer", convId = null } = {}) {
  const name = cleanText(input.name, 80);
  const phone = normalizePhone(String(input.phone || ""));
  const note = cleanText(input.note, 500);
  const idem = input.idemKey ? cleanText(input.idemKey, 64) : null;
  if (name.length < 3) throw new HttpError(400, "bad_name", "اكتب الاسم بالكامل");
  if (!phone) throw new HttpError(400, "bad_phone", "رقم الموبايل مش صحيح");

  if (idem) {
    const prev = await env.DB.prepare("SELECT * FROM bookings WHERE idem_key = ?").bind(idem).first();
    if (prev) return { booking: publicBooking(prev), duplicate: true };
  }

  const offer = await checkOffer(env, { tripId: input.tripId, date: input.date, party: input.party });
  if (!offer.available) throw new HttpError(409, offer.reason || "unavailable", offer.message, { seatsLeft: offer.seatsLeft ?? null });

  // منع الحجز المكرر لنفس الشخص ونفس الرحلة واليوم
  const dup = await env.DB.prepare(`SELECT ref FROM bookings WHERE phone = ? AND trip_id = ? AND date = ? AND (status IN ('confirmed','quote') OR (status = 'pending' AND expires_at > ?))`)
    .bind(phone, offer.trip.id, input.date, nowIso()).first();
  if (dup) throw new HttpError(409, "duplicate", `عندك حجز قائم بالفعل لنفس الرحلة واليوم (رقم ${dup.ref})`, { ref: dup.ref });

  const p = offer.party, q = offer.quote, now = nowIso();
  const status = offer.quoteOnly ? "quote" : "pending";
  const expires = offer.quoteOnly ? null : new Date(Date.now() + POLICY.holdHours * 3600e3).toISOString();
  const seats = offer.quoteOnly ? 0 : offer.seats;
  const capacityExpr = `COALESCE((SELECT CASE WHEN closed = 1 THEN 0 ELSE COALESCE(seats, ?) END FROM departures WHERE trip_id = ? AND date = ?), ?)`;
  const usedExpr = `(SELECT COALESCE(SUM(seats),0) FROM bookings WHERE trip_id = ? AND date = ? AND ${ACTIVE_HOLD})`;

  for (let attempt = 0; attempt < 3; attempt++) {
    const ref = "SD-" + randomCode(6);
    // الإدخال مشروط في نفس الجملة: لو المقاعد خلصت في اللحظة دي مش هيتسجل حاجة
    const res = await env.DB.prepare(
      `INSERT INTO bookings (ref, trip_id, trip_title, date, adults, kids_small, kids, infants, tier, stay, currency, total, deposit, seats, name, phone, note, status, source, idem_key, expires_at, conv_id, created_at, updated_at)
       SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
       WHERE (? = 0) OR (${capacityExpr} - ${usedExpr} >= ?)`
    ).bind(
      ref, offer.trip.id, offer.trip.title, input.date, p.adults, p.kidsSmall, p.kids, p.infants, p.tier, p.stay, p.currency,
      q ? q.total : null, q ? q.deposit : null, seats, name, phone, note || null, status, source, idem, expires, convId, now, now,
      seats, offer.trip.seats ?? 12, offer.trip.id, input.date, offer.trip.seats ?? 12, offer.trip.id, input.date, now, seats
    ).run().catch(e => {
      if (/UNIQUE.*ref/i.test(String(e))) return { retry: true };
      if (/UNIQUE.*idem_key/i.test(String(e))) return { idemRace: true };
      throw e;
    });
    if (res.retry) continue;
    if (res.idemRace) {
      const prev = await env.DB.prepare("SELECT * FROM bookings WHERE idem_key = ?").bind(idem).first();
      return { booking: publicBooking(prev), duplicate: true };
    }
    if (!res.meta || res.meta.changes !== 1) throw new HttpError(409, "full", "الأماكن خلصت في اللحظة دي، جرّب يوم تاني");
    const row = await env.DB.prepare("SELECT * FROM bookings WHERE ref = ?").bind(ref).first();
    await addEvent(env, row.id, actor, "created", `${status} via ${source}`);
    return { booking: publicBooking(row), row };
  }
  throw new HttpError(500, "ref_failed", "حصلت مشكلة في إنشاء رقم الحجز، جرّب تاني");
}

export async function addEvent(env, bookingId, actor, action, detail = null) {
  await env.DB.prepare("INSERT INTO booking_events (booking_id, at, actor, action, detail) VALUES (?, ?, ?, ?, ?)").bind(bookingId, nowIso(), actor, action, detail).run();
}

export const STATUS_AR = { pending: "في انتظار المقدم", confirmed: "مؤكد", cancelled: "ملغي", completed: "مكتمل", quote: "طلب عرض سعر", expired: "انتهت مهلة الحجز المبدئي" };

export function effectiveStatus(row) {
  if (row.status === "pending" && row.expires_at && row.expires_at <= nowIso()) return "expired";
  return row.status;
}

/** بيانات الحجز اللي ينفع العميل يشوفها */
export function publicBooking(row) {
  const st = effectiveStatus(row);
  return {
    ref: row.ref, status: st, statusLabel: STATUS_AR[st] || st,
    tripId: row.trip_id, tripTitle: row.trip_title, date: row.date,
    party: { adults: row.adults, kidsSmall: row.kids_small, kids: row.kids, infants: row.infants, tier: row.tier, stay: row.stay },
    currency: row.currency, total: row.total, deposit: row.deposit,
    name: row.name, expiresAt: st === "pending" ? row.expires_at : null,
    refundDue: row.refund_due ?? null, createdAt: row.created_at,
  };
}

/** البحث عن حجز برقم الحجز + رقم الموبايل (الاتنين لازم يطابقوا) */
export async function findOwnBooking(env, ref, rawPhone) {
  const r = cleanText(ref, 20).toUpperCase();
  const phone = normalizePhone(String(rawPhone || ""));
  if (!/^SD-[A-Z0-9]{5,8}$/.test(r) || !phone) throw new HttpError(400, "bad_lookup", "اكتب رقم الحجز (زي SD-AB12CD) ورقم الموبايل اللي حجزت بيه");
  const row = await env.DB.prepare("SELECT * FROM bookings WHERE ref = ?").bind(r).first();
  // نفس الرسالة في الحالتين عشان محدش يقدر يخمّن أرقام حجوزات
  if (!row || row.phone !== phone) throw new HttpError(404, "not_found", "مفيش حجز بالرقم ده والموبايل ده");
  return row;
}

export async function cancelOwnBooking(env, ref, phone, { actor = "customer" } = {}) {
  const row = await findOwnBooking(env, ref, phone);
  const st = effectiveStatus(row);
  if (st === "cancelled") return { booking: publicBooking(row), already: true, message: "الحجز ده ملغي بالفعل" };
  if (st === "completed") throw new HttpError(409, "completed", "الرحلة دي خلصت ومينفعش تتلغي");
  if (st === "pending" || st === "expired" || st === "quote") {
    await setStatus(env, row, "cancelled", actor, "إلغاء قبل دفع المقدم", 0);
    return { booking: publicBooking({ ...row, status: "cancelled", refund_due: 0 }), message: "اتلغى الحجز. مكانش فيه مقدم مدفوع." };
  }
  const rf = refundFor(row.date, cairoToday());
  if (rf.refund === 0) throw new HttpError(409, "late_cancel", `فاضل ${Math.max(rf.days, 0)} أيام على الرحلة، فالإلغاء مش متاح أونلاين — تقدر تأجل لميعاد تاني خلال ٦ شهور. كلّم فريقنا وهيظبطلك الميعاد الجديد.`, { postponeOnly: true });
  const paid = row.deposit || 0; // المقدم هو المبلغ المدفوع لحد التأكيد
  const due = Math.round(paid * rf.refund);
  await setStatus(env, row, "cancelled", actor, `${rf.label} — المسترد ${due} ${row.currency}`, due);
  return { booking: publicBooking({ ...row, status: "cancelled", refund_due: due }), refund: { rate: rf.refund, amount: due, currency: row.currency, label: rf.label }, message: `اتلغى الحجز (${rf.label}). فريقنا هيتواصل معاك لتحويل المبلغ المسترد.` };
}

const TRANSITIONS = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled", "pending"],
  quote: ["pending", "confirmed", "cancelled"],
  cancelled: ["pending"],
  completed: [],
};
export async function setStatus(env, row, to, actor, detail = null, refundDue = undefined) {
  const from = row.status;
  if (from !== to && !(TRANSITIONS[from] || []).includes(to)) throw new HttpError(409, "bad_transition", `مينفعش تغيّر الحالة من «${STATUS_AR[from]}» لـ «${STATUS_AR[to] || to}»`);
  const now = nowIso();
  // رجوع حجز لـ pending بيدّيله مهلة جديدة، والتأكيد بيلغي المهلة
  const expires = to === "pending" ? new Date(Date.now() + POLICY.holdHours * 3600e3).toISOString() : (to === "confirmed" ? null : row.expires_at);
  await env.DB.prepare(`UPDATE bookings SET status = ?, expires_at = ?, updated_at = ?${refundDue !== undefined ? ", refund_due = ?" : ""} WHERE id = ?`)
    .bind(...[to, expires, now, ...(refundDue !== undefined ? [refundDue] : []), row.id]).run();
  await addEvent(env, row.id, actor, "status", `${from} → ${to}${detail ? " — " + detail : ""}`);
}

/** تأكيد إن السيرفر مابيرجعش أي رسالة فيها أسرار */
export function sanitizeTrip(t) {
  const { id, cat, dest, art, cover, gallery, title, titleEn, route, days, dur, egp, usd, mkEgp, mkUsd, inc, badge, old, itin, summary, months, quoteOnly, leadDays, seats, active } = t;
  return { id, cat, dest, art, cover, gallery, title, titleEn, route, days, dur, egp, usd, mkEgp, mkUsd, inc, badge, old, itin, summary, months, quoteOnly, leadDays, seats, active };
}

export { addDays };
