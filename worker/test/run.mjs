/* اختبارات السيرفر كاملة — بتشتغل من غير إنترنت:
   node --no-warnings test/run.mjs
   قاعدة البيانات SQLite في الذاكرة، وGemini وواتساب متحاكيين (mock). */
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHmac } from "node:crypto";
import { makeD1, makeCtx } from "./d1shim.mjs";
import worker, { processWhatsApp, retention } from "../src/index.js";
import { handleMessage, getOrCreateConversation, FALLBACK_REPLY } from "../src/agent.js";
import { cairoToday, addDays } from "../../shared/pricing.js";

const here = dirname(fileURLToPath(import.meta.url));
const ORIGIN = "https://safarya-desert.github.io";
let env, ctx, ipN = 0;

function freshEnv(extra = {}) {
  env = { DB: makeD1(join(here, "..", "schema.sql")), ADMIN_PASSWORD: "test-pass-123", SESSION_SECRET: "x".repeat(40), PUBLIC_WHATSAPP: "201000000001", ...extra };
  ctx = makeCtx();
}
async function call(method, path, body, { headers = {}, ip } = {}) {
  const h = { origin: ORIGIN, "cf-connecting-ip": ip || "10.0.0." + (++ipN % 250), ...headers };
  if (body !== undefined) h["content-type"] = "application/json";
  const res = await worker.fetch(new Request("https://api.test" + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }), env, ctx);
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, headers: res.headers };
}

/* تاريخ في الموسم لكل الرحلات الشتوية، بعد أسبوعين على الأقل */
function inSeasonDate(months = [1, 2, 3, 4, 10, 11, 12], minAhead = 14) {
  let d = addDays(cairoToday(), minAhead);
  while (!months.includes(Number(d.slice(5, 7)))) d = addDays(d, 1);
  return d;
}
const D = inSeasonDate();
const D2 = addDays(D, 1), D3 = addDays(D, 2), D4 = addDays(D, 3);

const results = [];
async function test(name, fn) {
  try { await fn(); results.push(["✅", name]); }
  catch (e) { results.push(["❌", name, e.message]); }
}

freshEnv();
const mk = (o = {}) => ({ tripId: "bw2", date: D, party: { adults: 2 }, name: "أحمد محمد", phone: "01012345678", consent: true, ...o });

/* ===================== API العام ===================== */
await test("health + catalog بيرجّع ١٢ رحلة والأسئلة", async () => {
  const h = await call("GET", "/api/health"); assert.equal(h.status, 200); assert.equal(h.data.ok, true);
  const c = await call("GET", "/api/catalog"); assert.equal(c.data.trips.length, 12); assert.ok(c.data.faq.length >= 6);
  assert.equal(c.headers.get("access-control-allow-origin"), ORIGIN);
});

await test("CORS: موقع غريب مرفوض", async () => {
  const r = await call("GET", "/api/catalog", undefined, { headers: { origin: "https://evil.example" } });
  assert.equal(r.status, 403);
});

await test("حساب السعر: كبار + أطفال بأعمار مختلفة + رضيع", async () => {
  const r = await call("POST", "/api/availability", { tripId: "bw2", date: D, party: { adults: 2, kidsSmall: 1, kids: 1, infants: 1 } });
  assert.equal(r.data.available, true);
  // 6900×2 + 6900×0.25 + 6900×0.5 = 18975 — والرضيع مجانًا
  assert.equal(r.data.quote.total, 18975); assert.equal(r.data.quote.deposit, 5693);
  assert.equal(r.data.seatsNeeded, 4);
});

await test("خاصة + ترقية بالدولار", async () => {
  const r = await call("POST", "/api/availability", { tripId: "siwa3", date: inSeasonDate([1,2,3,4,5,9,10,11,12]), party: { adults: 3, tier: "private", stay: "up", currency: "USD" } });
  // 260×1.45 = 377 للفرد ×3 = 1131 + 15% = 1300.65 → 1301
  assert.equal(r.data.quote.total, 1301); assert.equal(r.data.seatsNeeded, 4);
});

await test("رفض: تاريخ قريب / خارج الموسم / رحلة مش موجودة / عدد غلط", async () => {
  let r = await call("POST", "/api/availability", { tripId: "bw2", date: addDays(cairoToday(), 1), party: { adults: 2 } });
  assert.equal(r.data.available, false); assert.equal(r.data.reason, "too_soon");
  let summer = addDays(cairoToday(), 3); while (![6,7,8].includes(Number(summer.slice(5,7)))) summer = addDays(summer, 1);
  r = await call("POST", "/api/availability", { tripId: "bw2", date: summer, party: { adults: 2 } });
  assert.equal(r.data.reason, "off_season");
  r = await call("POST", "/api/availability", { tripId: "fay2", date: summer, party: { adults: 2 } });
  assert.equal(r.data.available, true, "رحلة النجوم شغالة صيف");
  r = await call("POST", "/api/availability", { tripId: "nope", date: D, party: { adults: 2 } }); assert.equal(r.status, 404);
  r = await call("POST", "/api/availability", { tripId: "bw2", date: D, party: { adults: 0 } }); assert.equal(r.status, 400);
  r = await call("POST", "/api/availability", { tripId: "bw2", date: "2026-02-30", party: { adults: 1 } }); assert.equal(r.data.reason, "bad_date");
});

let firstRef;
await test("إنشاء حجز: رقم مرجعي + حالة مبدئية + مهلة ٤٨ ساعة", async () => {
  const r = await call("POST", "/api/bookings", mk({ idemKey: "k-1" }));
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.match(r.data.booking.ref, /^SD-[A-Z0-9]{6}$/);
  assert.equal(r.data.booking.status, "pending");
  assert.equal(r.data.booking.total, 13800);
  const hrs = (Date.parse(r.data.booking.expiresAt) - Date.now()) / 3600e3; assert.ok(hrs > 47 && hrs <= 48);
  assert.equal(r.data.notify, "not_configured");
  firstRef = r.data.booking.ref;
});

await test("نفس الطلب مرتين (idempotency) بيرجع نفس الحجز", async () => {
  const r = await call("POST", "/api/bookings", mk({ idemKey: "k-1" }));
  assert.equal(r.data.duplicate, true); assert.equal(r.data.booking.ref, firstRef);
  const n = await env.DB.prepare("SELECT COUNT(*) n FROM bookings").first(); assert.equal(n.n, 1);
});

await test("منع الحجز المكرر لنفس الرقم والرحلة واليوم", async () => {
  const r = await call("POST", "/api/bookings", mk({ idemKey: "k-2", phone: "+20 101 234 5678" }));
  assert.equal(r.status, 409); assert.equal(r.data.error, "duplicate");
});

await test("التحقق من البيانات: موافقة، اسم، موبايل، فخ البوتات", async () => {
  assert.equal((await call("POST", "/api/bookings", mk({ consent: false, phone: "01111111111" }))).status, 400);
  assert.equal((await call("POST", "/api/bookings", mk({ name: "a", phone: "01111111111" }))).data.error, "bad_name");
  assert.equal((await call("POST", "/api/bookings", mk({ phone: "0123" }))).data.error, "bad_phone");
  assert.equal((await call("POST", "/api/bookings", mk({ phone: "01111111111", website: "spam" }))).status, 400);
});

await test("السعة: لما المقاعد تخلص الحجز بيترفض ومفيش حجز مؤكد وهمي", async () => {
  await env.DB.prepare("INSERT INTO departures (trip_id, date, seats) VALUES ('bw2', ?, 4)").bind(D2).run();
  let r = await call("POST", "/api/bookings", mk({ date: D2, party: { adults: 3 }, phone: "01000000003" })); assert.equal(r.status, 200);
  r = await call("POST", "/api/bookings", mk({ date: D2, party: { adults: 2 }, phone: "01000000004" }));
  assert.equal(r.status, 409); assert.equal(r.data.error, "full"); assert.equal(r.data.seatsLeft, 1);
  r = await call("POST", "/api/bookings", mk({ date: D2, party: { adults: 1, tier: "private" }, phone: "01000000005" }));
  assert.equal(r.status, 409, "الخاصة بتاخد عربية كاملة (٤ مقاعد)");
  r = await call("POST", "/api/bookings", mk({ date: D2, party: { adults: 1 }, phone: "01000000006" })); assert.equal(r.status, 200);
  const n = await env.DB.prepare("SELECT COALESCE(SUM(seats),0) s FROM bookings WHERE trip_id='bw2' AND date=?").bind(D2).first(); assert.equal(n.s, 4);
});

await test("ضغط متزامن: ٦ طلبات على ٤ مقاعد → اتنين بس ينجحوا", async () => {
  await env.DB.prepare("INSERT INTO departures (trip_id, date, seats) VALUES ('bw2', ?, 4)").bind(D3).run();
  const rs = await Promise.all([1,2,3,4,5,6].map(i => call("POST", "/api/bookings", mk({ date: D3, party: { adults: 2 }, phone: "0100000010" + i }))));
  assert.equal(rs.filter(r => r.status === 200).length, 2); assert.equal(rs.filter(r => r.status === 409).length, 4);
});

await test("يوم مقفول من الإدارة", async () => {
  await env.DB.prepare("INSERT INTO departures (trip_id, date, closed) VALUES ('bw2', ?, 1)").bind(D4).run();
  const r = await call("POST", "/api/bookings", mk({ date: D4, phone: "01000000020" })); assert.equal(r.status, 409); assert.equal(r.data.error, "closed");
});

await test("الحجز المبدئي اللي مهلته خلصت بيرجّع المقاعد", async () => {
  await env.DB.prepare("UPDATE bookings SET expires_at = '2000-01-01T00:00:00Z' WHERE trip_id='bw2' AND date=? AND phone='201000000003'").bind(D2).run();
  const r = await call("POST", "/api/availability", { tripId: "bw2", date: D2, party: { adults: 3 } });
  assert.equal(r.data.available, true); assert.equal(r.data.seatsLeft, 3);
  const lk = await call("POST", "/api/bookings/lookup", { ref: (await env.DB.prepare("SELECT ref FROM bookings WHERE phone='201000000003'").first()).ref, phone: "01000000003" });
  assert.equal(lk.data.booking.status, "expired");
});

await test("متابعة الحجز: لازم الرقم المرجعي والموبايل يطابقوا", async () => {
  let r = await call("POST", "/api/bookings/lookup", { ref: firstRef, phone: "01099999999" }); assert.equal(r.status, 404);
  r = await call("POST", "/api/bookings/lookup", { ref: firstRef.toLowerCase(), phone: "+201012345678" }); assert.equal(r.status, 200);
  assert.equal(r.data.booking.ref, firstRef); assert.equal(r.data.booking.phone, undefined, "مابيرجعش الموبايل");
  r = await call("POST", "/api/bookings/lookup", { ref: "DROP TABLE", phone: "01012345678" }); assert.equal(r.status, 400);
});

await test("إلغاء حجز مبدئي ثم محاولة تانية", async () => {
  let r = await call("POST", "/api/bookings/cancel", { ref: firstRef, phone: "01012345678" }); assert.equal(r.status, 400, "محتاج تأكيد");
  r = await call("POST", "/api/bookings/cancel", { ref: firstRef, phone: "01012345678", confirm: true });
  assert.equal(r.data.booking.status, "cancelled");
  r = await call("POST", "/api/bookings/cancel", { ref: firstRef, phone: "01012345678", confirm: true }); assert.equal(r.data.already, true);
});

await test("سياسة الإلغاء على حجوزات مؤكدة (١٠٠٪ / ٥٠٪ / تأجيل بس)", async () => {
  const ins = async (ref, days) => env.DB.prepare(`INSERT INTO bookings (ref, trip_id, trip_title, date, adults, tier, stay, currency, total, deposit, seats, name, phone, status, source, created_at, updated_at)
    VALUES (?, 'fay2', 't', ?, 2, 'group', 'std', 'EGP', 7800, 2340, 2, 'Test User', '201055555555', 'confirmed', 'admin', 'x', 'x')`).bind(ref, addDays(cairoToday(), days)).run();
  await ins("SD-FAR001", 20); await ins("SD-MID001", 5); await ins("SD-NEAR01", 2);
  let r = await call("POST", "/api/bookings/cancel", { ref: "SD-FAR001", phone: "01055555555", confirm: true }); assert.equal(r.data.refund.amount, 2340);
  r = await call("POST", "/api/bookings/cancel", { ref: "SD-MID001", phone: "01055555555", confirm: true }); assert.equal(r.data.refund.amount, 1170);
  r = await call("POST", "/api/bookings/cancel", { ref: "SD-NEAR01", phone: "01055555555", confirm: true }); assert.equal(r.status, 409); assert.equal(r.data.postponeOnly, true);
});

await test("الجلف الكبير: طلب عرض سعر، ومهلة ٦ أسابيع", async () => {
  let r = await call("POST", "/api/bookings", mk({ tripId: "gilf", date: addDays(cairoToday(), 10), phone: "01000000030" })); assert.equal(r.status, 409); assert.equal(r.data.error, "too_soon");
  const d = inSeasonDate([1, 2, 3, 11, 12], 45);
  r = await call("POST", "/api/bookings", mk({ tripId: "gilf", date: d, party: { adults: 6 }, phone: "01000000030" }));
  assert.equal(r.status, 200); assert.equal(r.data.booking.status, "quote"); assert.equal(r.data.booking.total, null);
});

await test("حد الطلبات: الحجز السابع من نفس الجهاز في ١٠ دقايق مرفوض", async () => {
  const codes = [];
  for (let i = 0; i < 7; i++) codes.push((await call("POST", "/api/bookings", mk({ phone: "x" }), { ip: "9.9.9.9" })).status);
  assert.deepEqual(codes.slice(0, 6), [400, 400, 400, 400, 400, 400]); assert.equal(codes[6], 429);
});

await test("رسالة التواصل بتتسجل", async () => {
  const r = await call("POST", "/api/contact", { name: "منى", phone: "01222222222", message: "عايزة رحلة لشركة ٢٠ فرد", consent: true });
  assert.equal(r.status, 200);
  const h = await env.DB.prepare("SELECT * FROM handoffs WHERE kind='contact'").first(); assert.equal(h.phone, "201222222222");
});

await test("التقويم الشهري", async () => {
  const r = await call("POST", "/api/calendar", { tripId: "bw2", month: D2.slice(0, 7), party: { adults: 2 } });
  assert.equal(r.status, 200); assert.equal(r.data.days[D4], 0, "اليوم المقفول"); assert.ok(Object.keys(r.data.days).length >= 28);
});

/* ===================== لوحة الإدارة ===================== */
let token;
await test("الإدارة: من غير توكن ممنوع، وكلمة سر غلط ممنوعة", async () => {
  assert.equal((await call("GET", "/api/admin/bookings")).status, 401);
  assert.equal((await call("GET", "/api/admin/bookings", undefined, { headers: { authorization: "Bearer abc.def" } })).status, 401);
  assert.equal((await call("POST", "/api/admin/login", { password: "wrong" })).status, 401);
  const r = await call("POST", "/api/admin/login", { password: "test-pass-123" }); assert.equal(r.status, 200); token = r.data.token;
  // توكن متلاعب فيه
  const [p, s] = token.split("."); const forged = Buffer.from(JSON.stringify({ sub: "x", role: "owner", exp: 9e9 })).toString("base64url") + "." + s;
  assert.equal((await call("GET", "/api/admin/stats", undefined, { headers: { authorization: "Bearer " + forged } })).status, 401);
});
const A = () => ({ headers: { authorization: "Bearer " + token } });

await test("الإدارة: بحث وتصفية الحجوزات وتفاصيل وسجل التغييرات", async () => {
  let r = await call("GET", "/api/admin/bookings?status=cancelled", undefined, A()); assert.ok(r.data.bookings.length >= 1);
  r = await call("GET", "/api/admin/bookings?q=" + encodeURIComponent("أحمد"), undefined, A()); assert.ok(r.data.bookings.length >= 1);
  r = await call("GET", "/api/admin/bookings/" + firstRef, undefined, A()); assert.ok(r.data.events.length >= 2);
  r = await call("GET", "/api/admin/stats", undefined, A()); assert.equal(r.status, 200); assert.ok(r.data.openHandoffs >= 1);
});

await test("الإدارة: تأكيد حجز + منع انتقال غير منطقي", async () => {
  const b = await call("POST", "/api/bookings", mk({ date: D, phone: "01077777777" }));
  let r = await call("PATCH", "/api/admin/bookings/" + b.data.booking.ref, { status: "confirmed", reason: "استلمنا المقدم" }, A());
  assert.equal(r.data.booking.status, "confirmed"); assert.equal(r.data.booking.expires_at, null);
  r = await call("PATCH", "/api/admin/bookings/" + b.data.booking.ref, { status: "completed" }, A()); assert.equal(r.status, 200);
  r = await call("PATCH", "/api/admin/bookings/" + b.data.booking.ref, { status: "pending" }, A()); assert.equal(r.status, 409);
});

await test("الإدارة: تعديل السعر بيتطبق فورًا على الموقع والحساب", async () => {
  let r = await call("PUT", "/api/admin/trips/fay1", { egp: 2400, seats: 20 }, A()); assert.equal(r.data.trip.egp, 2400);
  r = await call("GET", "/api/catalog"); assert.equal(r.data.trips.find(t => t.id === "fay1").egp, 2400);
  r = await call("PUT", "/api/admin/trips/fay1", { egp: -5 }, A()); assert.equal(r.status, 400);
  r = await call("PUT", "/api/admin/trips/fay1", { active: false }, A());
  r = await call("GET", "/api/catalog"); assert.equal(r.data.trips.length, 11, "الرحلة الموقوفة مش ظاهرة");
  await call("PUT", "/api/admin/trips/fay1", { active: true }, A());
});

await test("الإدارة: الأسئلة الشائعة (إضافة/تعديل/حذف)", async () => {
  let r = await call("POST", "/api/admin/faq", { q: "فيه واي فاي؟", a: "في سيوة والبحرية بس" }, A()); const id = r.data.id;
  r = await call("GET", "/api/catalog"); assert.ok(r.data.faq.some(f => f.q === "فيه واي فاي؟"));
  await call("PUT", "/api/admin/faq/" + id, { q: "فيه واي فاي؟", a: "تعديل", active: false }, A());
  r = await call("GET", "/api/catalog"); assert.ok(!r.data.faq.some(f => f.q === "فيه واي فاي؟"));
  assert.equal((await call("DELETE", "/api/admin/faq/" + id, undefined, A())).status, 200);
});

await test("الإدارة: قفل وفتح يوم", async () => {
  await call("PUT", "/api/admin/departures", { tripId: "siwa3", date: D, closed: true, note: "عاصفة" }, A());
  let r = await call("POST", "/api/availability", { tripId: "siwa3", date: D, party: { adults: 1 } }); assert.equal(r.data.reason, "closed");
  await call("DELETE", `/api/admin/departures?trip=siwa3&date=${D}`, undefined, A());
  r = await call("POST", "/api/availability", { tripId: "siwa3", date: D, party: { adults: 1 } }); assert.equal(r.data.available, true);
});

await test("الإدارة: حد محاولات الدخول", async () => {
  const codes = []; for (let i = 0; i < 6; i++) codes.push((await call("POST", "/api/admin/login", { password: "bad" }, { ip: "7.7.7.7" })).status);
  assert.equal(codes[5], 429);
});

await test("الإدارة مش متظبطة → رسالة واضحة", async () => {
  const save = env.SESSION_SECRET; env.SESSION_SECRET = "short";
  const r = await call("POST", "/api/admin/login", { password: "x" }); assert.equal(r.status, 503);
  env.SESSION_SECRET = save;
});

/* ===================== الوكيل ===================== */
function scripted(steps) {
  let i = 0;
  const fn = async (_env, _sys, contents) => {
    const s = steps[i++];
    if (!s) throw new Error("no more steps");
    if (typeof s === "function") return s(contents);
    return s;
  };
  fn.calls = () => i;
  return fn;
}
const fc = (name, args) => ({ role: "model", parts: [{ functionCall: { name, args } }] });
const tx = t => ({ role: "model", parts: [{ text: t }] });
const lastResp = contents => contents[contents.length - 1].parts[0].functionResponse.response;

await test("الوكيل: من غير مفتاح Gemini بيرد رد مفهوم", async () => {
  const conv = await getOrCreateConversation(env, { channel: "web" });
  const r = await handleMessage(env, { conv, text: "عايز أحجز", channel: "web" });
  assert.equal(r.reply, FALLBACK_REPLY);
});

env.GEMINI_API_KEY = "test-key";
await test("الوكيل: سيناريو حجز كامل (بحث ← سعر ← موافقة ← حجز)", async () => {
  const conv = await getOrCreateConversation(env, { channel: "web" });
  let captured = {};
  const g1 = scripted([fc("search_options", { query: "سيوة" }), c => { captured.search = lastResp(c); return tx("عندنا سيوة ٣ أيام…"); }]);
  let r = await handleMessage(env, { conv, text: "عايز رحلة سيوة", channel: "web", gemini: g1 });
  assert.ok(captured.search.results.some(x => x.trip_id === "siwa3"));
  const sd = inSeasonDate([1,2,3,4,5,9,10,11,12], 20);
  const g2 = scripted([fc("calculate_price", { trip_id: "siwa3", date: sd, adults: 2, kids: 1 }), c => { captured.q = lastResp(c); return tx(captured.q.summary + "\nأأكد الحجز؟"); }]);
  r = await handleMessage(env, { conv, text: "٢ كبار وطفل ٨ سنين يوم " + sd, channel: "web", gemini: g2 });
  assert.equal(captured.q.total, 9900 * 2 + 9900 * 0.5); assert.match(r.reply, /الإجمالي/);
  // التاريخ اللي فات لازم يوصل لـ Gemini في الدورة الجاية (الـ quote_id)
  const g3 = scripted([c => { assert.ok(JSON.stringify(c).includes(captured.q.quote_id), "quote_id في التاريخ"); return fc("create_booking", { quote_id: captured.q.quote_id, name: "سارة علي", phone: "01155555555", customer_confirmed: true }); },
    c => { captured.b = lastResp(c); return tx("تم! رقم حجزك " + captured.b.booking.ref); }]);
  r = await handleMessage(env, { conv, text: "أيوه أكد، سارة علي 01155555555", channel: "web", gemini: g3 });
  assert.equal(captured.b.success, true); assert.ok(r.booking.ref);
  const row = await env.DB.prepare("SELECT * FROM bookings WHERE ref = ?").bind(r.booking.ref).first();
  assert.equal(row.source, "chat"); assert.equal(row.status, "pending"); assert.equal(row.total, 24750); assert.equal(row.conv_id, conv.id);
});

await test("الوكيل: ممنوع يحجز من غير موافقة أو من غير عرض سعر أو بعرض محادثة تانية", async () => {
  const conv = await getOrCreateConversation(env, { channel: "web" });
  const other = await env.DB.prepare("SELECT id FROM quotes LIMIT 1").first();
  const outs = [];
  const g = scripted([fc("create_booking", { quote_id: "Qfake", name: "x y z", phone: "01111111112", customer_confirmed: true }), c => { outs.push(lastResp(c)); return fc("create_booking", { quote_id: other.id, name: "x y z", phone: "01111111112", customer_confirmed: true }); },
    c => { outs.push(lastResp(c)); return fc("create_booking", { quote_id: other.id, name: "x y z", phone: "01111111112", customer_confirmed: false }); }, c => { outs.push(lastResp(c)); return tx("محتاج موافقتك"); }]);
  await handleMessage(env, { conv, text: "احجزلي", channel: "web", gemini: g });
  assert.deepEqual(outs.map(o => o.error), ["quote_not_found", "quote_not_found", "needs_confirmation"]);
});

await test("الوكيل: رحلة مش متاحة → مفيش حجز ومفيش رقم مرجعي", async () => {
  const conv = await getOrCreateConversation(env, { channel: "web" });
  let out;
  const g = scripted([fc("calculate_price", { trip_id: "bw2", date: D4, adults: 2 }), c => { out = lastResp(c); return tx("اليوم ده مقفول، تحب يوم تاني؟"); }]);
  const r = await handleMessage(env, { conv, text: "bw2 " + D4, channel: "web", gemini: g });
  assert.equal(out.available, false); assert.equal(out.quote_id, undefined); assert.equal(r.booking, null);
});

await test("الوكيل: انقطاع Gemini بيرجّع رسالة مفهومة، والمحادثة تكمل بعدها عادي", async () => {
  const conv = await getOrCreateConversation(env, { channel: "web" });
  const bad = async () => { throw new Error("network down"); };
  let r = await handleMessage(env, { conv, text: "سلام", channel: "web", gemini: bad });
  assert.equal(r.error, "agent_failed"); assert.equal(r.reply, FALLBACK_REPLY);
  // فشل في نص دورة الأدوات
  const half = scripted([fc("search_options", {}), async () => { throw new Error("timeout"); }]);
  r = await handleMessage(env, { conv, text: "رحلات؟", channel: "web", gemini: half });
  assert.equal(r.error, "agent_failed");
  const ok = scripted([c => { // التاريخ المحفوظ لازم يكون سليم (مفيش functionCall من غير رد)
    for (let i = 0; i < c.length; i++) if (c[i].parts.some(p => p.functionCall)) assert.ok(c[i + 1]?.parts.some(p => p.functionResponse), "استدعاء أداة يتيم في التاريخ");
    return tx("أهلًا!"); }]);
  r = await handleMessage(env, { conv, text: "تاني", channel: "web", gemini: ok }); assert.equal(r.reply, "أهلًا!");
});

await test("الوكيل: التحويل لموظف بيوقف الردود الآلية", async () => {
  const conv = await getOrCreateConversation(env, { channel: "web" });
  const g = scripted([fc("request_human_support", { reason: "شكوى" }), tx("حوّلتك لزميلي")]);
  let r = await handleMessage(env, { conv, text: "عايز أكلم حد", channel: "web", gemini: g });
  assert.equal(r.handoff, true);
  const g2 = scripted([]);
  const c2 = await env.DB.prepare("SELECT * FROM conversations WHERE id = ?").bind(conv.id).first();
  r = await handleMessage(env, { conv: c2, text: "فيه حد؟", channel: "web", gemini: g2 });
  assert.equal(r.reply, null); assert.equal(g2.calls(), 0);
});

await test("/api/chat endpoint بيرجع conversationId ويحافظ عليه", async () => {
  delete env.GEMINI_API_KEY;
  let r = await call("POST", "/api/chat", { message: "hi" }); assert.equal(r.status, 200); assert.match(r.data.conversationId, /^[a-f0-9]{32}$/);
  const id = r.data.conversationId;
  r = await call("POST", "/api/chat", { message: "again", conversationId: id }); assert.equal(r.data.conversationId, id);
  r = await call("POST", "/api/chat", { message: "" }); assert.equal(r.status, 400);
  env.GEMINI_API_KEY = "test-key";
});

/* ===================== واتساب ===================== */
const WA = { WA_TOKEN: "t", WA_PHONE_NUMBER_ID: "123", WA_APP_SECRET: "app-secret", WA_VERIFY_TOKEN: "verify-me" };
Object.assign(env, WA);
const sent = [];
const realFetch = globalThis.fetch;
let failSends = false;
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith("https://graph.facebook.com/")) {
    sent.push(JSON.parse(init.body));
    if (failSends) return new Response(JSON.stringify({ error: { message: "Re-engagement message", code: 131047 } }), { status: 400 });
    return new Response(JSON.stringify({ messages: [{ id: "wamid.out" + sent.length }] }), { status: 200 });
  }
  return realFetch(url, init);
};
const waPayload = (id, from, text) => ({ object: "whatsapp_business_account", entry: [{ changes: [{ value: { contacts: [{ profile: { name: "Ali" } }], messages: [{ id, from, timestamp: "1", type: "text", text: { body: text } }] } }] }] });
const sign = raw => "sha256=" + createHmac("sha256", "app-secret").update(raw).digest("hex");

await test("واتساب: تحقق الـ webhook (GET)", async () => {
  let r = await worker.fetch(new Request("https://api.test/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=42"), env, ctx);
  assert.equal(await r.text(), "42");
  r = await worker.fetch(new Request("https://api.test/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=no&hub.challenge=42"), env, ctx);
  assert.equal(r.status, 403);
});

await test("واتساب: توقيع غلط مرفوض", async () => {
  const raw = JSON.stringify(waPayload("w1", "201066666666", "hi"));
  const r = await worker.fetch(new Request("https://api.test/webhooks/whatsapp", { method: "POST", body: raw, headers: { "x-hub-signature-256": "sha256=bad" } }), env, ctx);
  assert.equal(r.status, 401);
});

await test("واتساب: رسالة موقّعة صح بتترد، والرسالة المكررة بتتجاهل", async () => {
  sent.length = 0;
  const raw = JSON.stringify(waPayload("w2", "201066666666", "سلام"));
  // نخلي الوكيل يرد بدون Gemini حقيقي
  const g = scripted([tx("أهلًا بيك في سفرية!"), tx("x")]);
  let out = await processWhatsApp(env, JSON.parse(raw), { gemini: g });
  assert.equal(out[0].replied, true); assert.equal(sent[0].to, "201066666666"); assert.equal(sent[0].text.body, "أهلًا بيك في سفرية!");
  out = await processWhatsApp(env, JSON.parse(raw), { gemini: g });
  assert.equal(out[0].skipped, "duplicate"); assert.equal(sent.length, 1);
  // نفس الـ endpoint بالتوقيع الصحيح بيرجع 200 بسرعة
  const r = await worker.fetch(new Request("https://api.test/webhooks/whatsapp", { method: "POST", body: JSON.stringify(waPayload("w3", "201066666666", "x")), headers: { "x-hub-signature-256": sign(JSON.stringify(waPayload("w3", "201066666666", "x"))) } }), env, ctx);
  assert.equal(r.status, 200); delete env.GEMINI_API_KEY; await ctx.flush(); env.GEMINI_API_KEY = "test-key";
});

await test("واتساب: حجز من المحادثة + فشل الإرسال مابيمسحش الحجز", async () => {
  sent.length = 0;
  const sd = inSeasonDate([1,2,3,4,5,9,10,11,12], 25);
  let q;
  const conv = await getOrCreateConversation(env, { channel: "whatsapp", externalId: "201088888888" });
  await handleMessage(env, { conv, text: "سعر", channel: "whatsapp", phone: "201088888888",
    gemini: scripted([fc("calculate_price", { trip_id: "siwa4", date: sd, adults: 2 }), c => { q = lastResp(c); return tx(q.summary); }]) });
  failSends = true;
  const out = await processWhatsApp(env, waPayload("w9", "201088888888", "أكد باسم كريم سامي"), {
    gemini: scripted([fc("create_booking", { quote_id: q.quote_id, name: "كريم سامي", customer_confirmed: true }), c => tx("اتحجز " + lastResp(c).booking.ref)]) });
  failSends = false;
  assert.equal(out[0].replied, false);
  const row = await env.DB.prepare("SELECT * FROM bookings WHERE phone = '201088888888'").first();
  assert.equal(row.status, "pending"); assert.equal(row.source, "whatsapp"); assert.match(row.notify_status, /^failed:131047/);
});

await test("واتساب: الإلغاء لازم يكون من نفس رقم الحجز", async () => {
  const conv = await getOrCreateConversation(env, { channel: "whatsapp", externalId: "201099999999" });
  let out;
  const ref = (await env.DB.prepare("SELECT ref FROM bookings WHERE phone = '201088888888'").first()).ref;
  await handleMessage(env, { conv, text: "الغي", channel: "whatsapp", phone: "201099999999",
    gemini: scripted([fc("cancel_booking", { ref, phone: "01088888888", customer_confirmed: true }), c => { out = lastResp(c); return tx("لازم من نفس الرقم"); }]) });
  assert.equal(out.error, "phone_mismatch");
  const row = await env.DB.prepare("SELECT status FROM bookings WHERE ref = ?").bind(ref).first(); assert.equal(row.status, "pending");
});

await test("حجز الموقع مع واتساب متظبط: الإشعار بيتبعت بقالب معتمد", async () => {
  sent.length = 0; env.WA_TEMPLATE_BOOKING = "booking_confirmation";
  const r = await call("POST", "/api/bookings", mk({ tripId: "fay2", date: D, phone: "01200000001" }));
  assert.equal(r.data.notify, "queued"); await ctx.flush();
  assert.equal(sent[0].type, "template"); assert.equal(sent[0].template.name, "booking_confirmation");
  const row = await env.DB.prepare("SELECT notify_status FROM bookings WHERE ref = ?").bind(r.data.booking.ref).first(); assert.equal(row.notify_status, "sent");
});

await test("الإدارة: رد موظف على واتساب داخل/خارج نافذة ٢٤ ساعة", async () => {
  const c = await env.DB.prepare("SELECT id FROM conversations WHERE external_id = '201066666666'").first();
  let r = await call("POST", `/api/admin/conversations/${c.id}/reply`, { text: "أهلًا، معاك منى" }, A()); assert.equal(r.status, 200);
  await env.DB.prepare("UPDATE conversations SET last_user_at = '2000-01-01T00:00:00Z' WHERE id = ?").bind(c.id).run();
  r = await call("POST", `/api/admin/conversations/${c.id}/reply`, { text: "x" }, A()); assert.equal(r.data.error, "window_closed");
  r = await call("GET", `/api/admin/conversations/${c.id}`, undefined, A()); assert.ok(r.data.messages.some(m => m.role === "staff"));
});

await test("تنظيف البيانات القديمة (Cron)", async () => {
  await env.DB.prepare("UPDATE conversations SET updated_at = '2000-01-01T00:00:00Z'").run();
  await retention(env);
  const n = await env.DB.prepare("SELECT COUNT(*) n FROM conversations").first(); assert.equal(n.n, 0);
  const b = await env.DB.prepare("SELECT COUNT(*) n FROM bookings").first(); assert.ok(b.n > 0, "الحجوزات مبتتمسحش");
});

globalThis.fetch = realFetch;

/* ===================== النتيجة ===================== */
for (const r of results) console.log(r[0], r[1], r[2] ? "\n    → " + r[2] : "");
const failed = results.filter(r => r[0] === "❌").length;
console.log(`\n${results.length - failed}/${results.length} نجح`);
process.exit(failed ? 1 : 0);
