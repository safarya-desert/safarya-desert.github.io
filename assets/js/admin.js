/* لوحة الإدارة — كل البيانات بتيجي من السيرفر بعد تسجيل الدخول.
   الحماية الفعلية في السيرفر (كل طلب لازم توكن صحيح)، مش في إخفاء الصفحة. */
import { $, $$, hasApi, api, esc, money, toast, busy, IMAGES, nf } from "./app.js";
import { MONTHS } from "../../shared/catalog.js";

const app = $("#adminApp");
let token = null;
try { token = sessionStorage.getItem("sd-admin"); } catch {}
const A = (path, body, method) => api(path, body, { token, method }).catch(e => { if (e.status === 401) { logout(); } throw e; });
const STATUS = { pending: "في انتظار المقدم", confirmed: "مؤكد", cancelled: "ملغي", completed: "مكتمل", quote: "عرض سعر", expired: "مهلة خلصت" };
const pill = s => `<span class="status-pill ${s}">${STATUS[s] || s}</span>`;
const dt = iso => iso ? new Intl.DateTimeFormat("ar-EG", { timeZone: "Africa/Cairo", dateStyle: "short", timeStyle: "short" }).format(new Date(iso)) : "";

function logout() { token = null; try { sessionStorage.removeItem("sd-admin"); } catch {} loginView(); }

function loginView(msg = "") {
  if (!hasApi()) {
    app.innerHTML = `<div class="panel" style="max-width:520px;margin:40px auto"><h1 style="font-size:1.6rem">لوحة الإدارة</h1><div class="alert info">لوحة الإدارة محتاجة السيرفر. بعد نشره، حط رابطه في <code>assets/js/config.js</code> (API_BASE). الخطوات في DEPLOY.md.</div></div>`;
    return;
  }
  app.innerHTML = `<form class="panel" id="login" style="max-width:420px;margin:40px auto"><h1 style="font-size:1.6rem">لوحة الإدارة</h1>
    <label class="fld"><span>كلمة السر</span><input type="password" id="pw" autocomplete="current-password" required></label>
    <div class="alert err" id="le" ${msg ? "" : "hidden"}>${esc(msg)}</div><button class="btn btn-primary" id="lb">دخول</button></form>`;
  $("#pw").focus();
  $("#login").addEventListener("submit", async e => {
    e.preventDefault(); busy($("#lb"), true);
    try { const r = await api("/api/admin/login", { password: $("#pw").value }); token = r.token; try { sessionStorage.setItem("sd-admin", token); } catch {} shell(); }
    catch (err) { busy($("#lb"), false); $("#le").hidden = false; $("#le").textContent = err.message; }
  });
}

const TABS = [["bookings", "الحجوزات"], ["trips", "الرحلات والأسعار"], ["dates", "التواريخ والمقاعد"], ["faq", "الأسئلة الشائعة"], ["convos", "المحادثات"], ["handoffs", "طلبات التواصل"]];
let TRIPS = [];
async function shell(tab = "bookings") {
  app.innerHTML = `<div class="admin-top"><h1 style="font-size:1.5rem">لوحة الإدارة</h1><span class="small" id="hstat"></span><button class="btn btn-ghost" id="out" style="margin-inline-start:auto">خروج</button></div>
    <div class="stats" id="stats"></div><div class="tabs" role="tablist">${TABS.map(([k, t]) => `<button role="tab" data-t="${k}" aria-selected="${k === tab}">${t}</button>`).join("")}</div><div id="view"></div>`;
  $("#out").addEventListener("click", logout);
  $$(".tabs button").forEach(b => b.addEventListener("click", () => { $$(".tabs button").forEach(x => x.setAttribute("aria-selected", String(x === b))); VIEWS[b.dataset.t](); }));
  try {
    const [s, h, t] = await Promise.all([A("/api/admin/stats"), api("/api/health"), A("/api/admin/trips")]);
    TRIPS = t.trips;
    $("#stats").innerHTML = [["في انتظار المقدم", s.pending], ["مؤكدة", s.confirmed], ["طلبات عرض سعر", s.quotes], ["مهلتها خلصت", s.expired], ["ملغية", s.cancelled], ["إيراد مؤكد ج.م", nf.format(s.revenue_egp || 0)], ["إيراد مؤكد $", nf.format(s.revenue_usd || 0)], ["طلبات تواصل مفتوحة", s.openHandoffs]]
      .map(([l, v]) => `<div><b class="num">${typeof v === "number" ? nf.format(v || 0) : v}</b><small>${l}</small></div>`).join("");
    $("#hstat").textContent = `الوكيل الذكي: ${h.agent ? "شغال" : "مش متظبط"} · واتساب: ${h.whatsapp ? "متوصل" : "مش متوصل"}`;
  } catch (e) { toast(e.message, "bad"); }
  VIEWS[tab]();
}

/* ---------- الحجوزات ---------- */
async function bookings() {
  const v = $("#view");
  v.innerHTML = `<form class="toolbar" id="bf"><input type="search" id="q" placeholder="رقم حجز، اسم، موبايل"><select id="st"><option value="">كل الحالات</option>${Object.entries(STATUS).map(([k, t]) => `<option value="${k}">${t}</option>`).join("")}</select>
    <select id="tr"><option value="">كل الرحلات</option>${TRIPS.map(t => `<option value="${t.id}">${esc(t.title)}</option>`).join("")}</select><input type="date" id="fr" aria-label="من"><input type="date" id="to" aria-label="لحد"><button class="btn btn-primary">بحث</button></form><div id="bl" class="skel"></div>`;
  const load = async () => {
    const p = new URLSearchParams({ q: $("#q").value, status: $("#st").value, trip: $("#tr").value, from: $("#fr").value, to: $("#to").value });
    [...p.keys()].forEach(k => !p.get(k) && p.delete(k));
    try {
      const r = await A("/api/admin/bookings?" + p);
      $("#bl").className = "tbl";
      $("#bl").innerHTML = r.bookings.length ? `<table><thead><tr><th>الرقم</th><th>الحالة</th><th>الرحلة</th><th>التاريخ</th><th>العميل</th><th>الأفراد</th><th>الإجمالي</th><th>المصدر</th><th>اتعمل</th></tr></thead><tbody>${r.bookings.map(b => `<tr class="clickable" data-ref="${b.ref}"><td dir="ltr">${b.ref}</td><td>${pill(b.status_effective)}</td><td>${esc(b.trip_title)}</td><td>${b.date}</td><td>${esc(b.name)}<br><small dir="ltr">+${b.phone}</small></td><td>${b.adults + b.kids + b.kids_small}${b.infants ? "+" + b.infants : ""}${b.tier === "private" ? " خاصة" : ""}</td><td class="num">${money(b.total, b.currency)}</td><td>${b.source}</td><td class="small">${dt(b.created_at)}</td></tr>`).join("")}</tbody></table>` : `<p class="empty">مفيش حجوزات بالبحث ده</p>`;
      $$("#bl tr[data-ref]").forEach(tr => tr.addEventListener("click", () => bookingDrawer(tr.dataset.ref, load)));
    } catch (e) { $("#bl").className = ""; $("#bl").innerHTML = `<div class="alert err">${esc(e.message)}</div>`; }
  };
  $("#bf").addEventListener("submit", e => { e.preventDefault(); load(); });
  load();
}

function drawer(html) {
  $$(".drawer,.drawer-bg").forEach(x => x.remove());
  document.body.insertAdjacentHTML("beforeend", `<div class="drawer-bg"></div><aside class="drawer" role="dialog" aria-modal="true">${html}</aside>`);
  const close = () => $$(".drawer,.drawer-bg").forEach(x => x.remove());
  $(".drawer-bg").addEventListener("click", close);
  $(".drawer [data-close]")?.addEventListener("click", close);
  return { el: $(".drawer"), close };
}

async function bookingDrawer(ref, reload) {
  const { el, close } = drawer(`<div class="skel"></div>`);
  try {
    const { booking: b, events } = await A("/api/admin/bookings/" + encodeURIComponent(ref));
    const next = { pending: ["confirmed", "cancelled"], confirmed: ["completed", "cancelled", "pending"], quote: ["pending", "confirmed", "cancelled"], cancelled: ["pending"], completed: [] }[b.status] || [];
    el.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><h2 style="font-size:1.3rem" dir="ltr">${b.ref}</h2><button class="btn btn-ghost" data-close>✕</button></div>
      ${pill(b.status_effective)}
      <dl class="kv"><dt>الرحلة</dt><dd>${esc(b.trip_title)}</dd><dt>التاريخ</dt><dd>${b.date}</dd><dt>العميل</dt><dd>${esc(b.name)}</dd><dt>الموبايل</dt><dd><a dir="ltr" href="https://wa.me/${b.phone}" target="_blank" rel="noopener">+${b.phone}</a></dd>
      <dt>الأفراد</dt><dd>${b.adults} كبار، ${b.kids} أطفال ٦–١١، ${b.kids_small} أطفال ٢–٥، ${b.infants} رضّع</dd><dt>النوع</dt><dd>${b.tier === "private" ? "خاصة" : "مجموعة"} / ${b.stay === "up" ? "ترقية" : "قياسية"}</dd>
      <dt>الإجمالي</dt><dd>${money(b.total, b.currency)}</dd><dt>المقدم</dt><dd>${money(b.deposit, b.currency)}</dd>${b.refund_due != null ? `<dt>مسترد مستحق</dt><dd>${money(b.refund_due, b.currency)}</dd>` : ""}
      <dt>ملاحظات العميل</dt><dd>${esc(b.note || "—")}</dd><dt>المصدر</dt><dd>${b.source}</dd><dt>إشعار واتساب</dt><dd>${esc(b.notify_status || "—")}</dd><dt>المهلة</dt><dd>${dt(b.expires_at) || "—"}</dd></dl>
      ${next.length ? `<div class="panel"><b>تغيير الحالة</b><div style="display:flex;gap:6px;flex-wrap:wrap">${next.map(s => `<button class="btn ${s === "cancelled" ? "btn-ghost" : "btn-primary"}" data-s="${s}">${STATUS[s]}</button>`).join("")}</div><input id="why" placeholder="سبب / ملاحظة (اختياري)" class="fld" style="border:1.5px solid var(--line);border-radius:10px;padding:8px"></div>` : ""}
      <div class="panel"><b>تغيير التاريخ</b><div style="display:flex;gap:6px;flex-wrap:wrap"><input type="date" id="nd" value="${b.date}"><label class="small"><input type="checkbox" id="force"> تجاوز التوافر</label><button class="btn btn-ghost" id="saveDate">حفظ</button></div></div>
      <label class="fld"><span>ملاحظة داخلية</span><textarea id="an" rows="2">${esc(b.admin_note || "")}</textarea></label><button class="btn btn-ghost" id="saveNote">حفظ الملاحظة</button>
      <button class="btn btn-wa" id="notify">ابعت تأكيد واتساب للعميل</button>
      <div><b>السجل</b><div class="events">${events.map(e => `<div>${dt(e.at)} · ${e.actor} · ${esc(e.action)} ${esc(e.detail || "")}</div>`).join("")}</div></div>`;
    $(".drawer [data-close]").addEventListener("click", close);
    const patch = async (body, btn) => { busy(btn, true); try { await A("/api/admin/bookings/" + encodeURIComponent(ref), body, "PATCH"); toast("اتحفظ", "ok"); reload(); bookingDrawer(ref, reload); } catch (e) { busy(btn, false); toast(e.message, "bad"); } };
    $$(".drawer [data-s]").forEach(btn => btn.addEventListener("click", () => {
      const s = btn.dataset.s; const body = { status: s, reason: $("#why").value };
      if (s === "cancelled" && b.status === "confirmed") { const v = prompt("المبلغ المسترد المستحق للعميل؟", String(b.deposit || 0)); if (v === null) return; body.refundDue = Number(v); }
      patch(body, btn);
    }));
    $("#saveDate").addEventListener("click", e => patch({ date: $("#nd").value, force: $("#force").checked }, e.target));
    $("#saveNote").addEventListener("click", e => patch({ adminNote: $("#an").value }, e.target));
    $("#notify").addEventListener("click", async e => { busy(e.target, true); try { const r = await A(`/api/admin/bookings/${encodeURIComponent(ref)}/notify`, {}); toast("الإشعار: " + r.notify, r.notify === "sent" ? "ok" : "bad"); } catch (x) { toast(x.message, "bad"); } busy(e.target, false); });
  } catch (e) { el.innerHTML = `<div class="alert err">${esc(e.message)}</div><button class="btn btn-ghost" data-close>إغلاق</button>`; $(".drawer [data-close]").addEventListener("click", close); }
}

/* ---------- الرحلات ---------- */
function trips() {
  $("#view").innerHTML = `<p class="small">تعديل السعر أو المقاعد هنا بيتطبق فورًا على الحجز والشات. صفحات الرحلات الثابتة (للـ SEO) بتتحدث لما تعيد بناء الموقع.</p><div class="tbl"><table><thead><tr><th>الرحلة</th><th>ج.م</th><th>$</th><th>مقاعد/يوم</th><th>الحالة</th><th></th></tr></thead><tbody>${TRIPS.map(t => `<tr><td>${esc(t.title)}<br><small>${t.id} · ${esc(t.dur)}</small></td><td class="num">${t.egp ?? "—"}</td><td class="num">${t.usd ?? "—"}</td><td>${t.seats}</td><td>${t.active ? "ظاهرة" : "موقوفة"}</td><td><button class="btn btn-ghost" data-e="${t.id}">تعديل</button></td></tr>`).join("")}</tbody></table></div>`;
  $$("[data-e]").forEach(b => b.addEventListener("click", () => tripDrawer(TRIPS.find(t => t.id === b.dataset.e))));
}
function tripDrawer(t) {
  const keys = Object.keys(IMAGES);
  const { el, close } = drawer(`<div style="display:flex;justify-content:space-between"><h2 style="font-size:1.3rem">${esc(t.title)}</h2><button class="btn btn-ghost" data-close>✕</button></div>
  <form id="tf" style="display:grid;gap:12px">
    <div class="form-grid">
      <label class="fld"><span>الاسم</span><input name="title" value="${esc(t.title)}"></label>
      <label class="fld"><span>المدة</span><input name="dur" value="${esc(t.dur)}"></label>
      <label class="fld"><span>سعر المصري (ج.م) — فاضي = عرض سعر</span><input name="egp" type="number" min="0" value="${t.egp ?? ""}"></label>
      <label class="fld"><span>سعر الأجنبي ($)</span><input name="usd" type="number" min="0" value="${t.usd ?? ""}"></label>
      <label class="fld"><span>السعر القديم (للعروض)</span><input name="old" type="number" min="0" value="${t.old ?? ""}"></label>
      <label class="fld"><span>المقاعد في اليوم</span><input name="seats" type="number" min="0" value="${t.seats}"></label>
      <label class="fld"><span>شارة</span><input name="badge" value="${esc(t.badge || "")}"></label>
      <label class="fld"><span>الحالة</span><select name="active"><option value="1" ${t.active ? "selected" : ""}>ظاهرة</option><option value="0" ${t.active ? "" : "selected"}>موقوفة</option></select></label>
    </div>
    <label class="fld"><span>المسار</span><input name="route" value="${esc(t.route)}"></label>
    <label class="fld"><span>الوصف</span><textarea name="summary" rows="3">${esc(t.summary || "")}</textarea></label>
    <label class="fld"><span>الشامل (كل بند في سطر)</span><textarea name="inc" rows="3">${esc((t.inc || []).join("\n"))}</textarea></label>
    <label class="fld"><span>البرنامج (كل سطر: اليوم | الوصف)</span><textarea name="itin" rows="6">${esc((t.itin || []).map(x => x.join(" | ")).join("\n"))}</textarea></label>
    <div class="fld"><span>شهور التشغيل</span><div style="display:flex;flex-wrap:wrap;gap:6px">${MONTHS.map((m, i) => `<label class="small"><input type="checkbox" name="m" value="${i + 1}" ${(t.months || []).includes(i + 1) ? "checked" : ""}> ${m}</label>`).join("")}</div></div>
    <label class="fld"><span>صورة الغلاف</span><select name="cover">${keys.map(k => `<option value="${k}" ${k === t.cover ? "selected" : ""}>${esc(IMAGES[k].ar)}</option>`).join("")}</select></label>
    <div class="fld"><span>صور المعرض</span><div style="display:flex;flex-wrap:wrap;gap:6px">${keys.map(k => `<label class="small"><input type="checkbox" name="g" value="${k}" ${(t.gallery || []).includes(k) ? "checked" : ""}> ${esc(IMAGES[k].ar)}</label>`).join("")}</div>
      <p class="small">لإضافة صورة جديدة ومصدرها: ضيفها في data/images.json (رابط Commons + المصوّر + الترخيص) وشغّل node tools/build.mjs.</p></div>
    <button class="btn btn-primary">حفظ</button></form>`);
  $(".drawer [data-close]").addEventListener("click", close);
  $("#tf").addEventListener("submit", async e => {
    e.preventDefault(); const f = new FormData(e.target), btn = e.target.querySelector("button.btn-primary");
    const n = k => (f.get(k) === "" ? null : Number(f.get(k)));
    const body = { title: f.get("title"), dur: f.get("dur"), egp: n("egp"), usd: n("usd"), old: n("old"), seats: n("seats") ?? 0, badge: f.get("badge"), active: f.get("active") === "1",
      route: f.get("route"), summary: f.get("summary"), inc: String(f.get("inc")).split("\n").map(s => s.trim()).filter(Boolean),
      itin: String(f.get("itin")).split("\n").map(s => s.split("|").map(x => x.trim())).filter(x => x[0] && x[1]), months: f.getAll("m").map(Number), cover: f.get("cover"), gallery: f.getAll("g") };
    if ((body.egp == null) !== (body.usd == null)) { toast("حط السعرين أو سيبهم فاضيين الاتنين (عرض سعر)", "bad"); return; }
    body.quoteOnly = body.egp == null;
    busy(btn, true);
    try { const r = await A("/api/admin/trips/" + t.id, body, "PUT"); Object.assign(t, r.trip); toast("اتحفظت الرحلة", "ok"); close(); trips(); }
    catch (x) { busy(btn, false); toast(x.message, "bad"); }
  });
}

/* ---------- التواريخ ---------- */
async function dates() {
  const v = $("#view");
  v.innerHTML = `<form class="panel" id="df"><b>قفل يوم أو تغيير عدد المقاعد</b><div class="form-grid">
    <label class="fld"><span>الرحلة</span><select name="tripId">${TRIPS.map(t => `<option value="${t.id}">${esc(t.title)}</option>`).join("")}</select></label>
    <label class="fld"><span>التاريخ</span><input type="date" name="date" required></label>
    <label class="fld"><span>المقاعد (فاضي = الافتراضي)</span><input type="number" min="0" name="seats"></label>
    <label class="fld"><span>ملاحظة</span><input name="note"></label></div>
    <label class="check"><input type="checkbox" name="closed"> اليوم ده مقفول (مفيش رحلة)</label><button class="btn btn-primary">حفظ</button></form><div id="dl" style="margin-top:14px"></div>`;
  const load = async () => {
    const r = await A("/api/admin/departures");
    $("#dl").innerHTML = r.departures.length ? `<div class="tbl"><table><thead><tr><th>الرحلة</th><th>التاريخ</th><th>المقاعد</th><th>مقفول</th><th>ملاحظة</th><th></th></tr></thead><tbody>${r.departures.map(d => `<tr><td>${esc(TRIPS.find(t => t.id === d.trip_id)?.title || d.trip_id)}</td><td>${d.date}</td><td>${d.seats ?? "افتراضي"}</td><td>${d.closed ? "✓" : ""}</td><td>${esc(d.note || "")}</td><td><button class="btn btn-ghost" data-del="${d.trip_id}|${d.date}">حذف</button></td></tr>`).join("")}</tbody></table></div>` : `<p class="small">مفيش استثناءات — كل الأيام في الموسم متاحة بالعدد الافتراضي.</p>`;
    $$("[data-del]").forEach(b => b.addEventListener("click", async () => { const [t, d] = b.dataset.del.split("|"); await A(`/api/admin/departures?trip=${t}&date=${d}`, undefined, "DELETE"); load(); }));
  };
  $("#df").addEventListener("submit", async e => { e.preventDefault(); const f = new FormData(e.target);
    try { await A("/api/admin/departures", { tripId: f.get("tripId"), date: f.get("date"), seats: f.get("seats"), closed: !!f.get("closed"), note: f.get("note") }, "PUT"); toast("اتحفظ", "ok"); e.target.reset(); load(); } catch (x) { toast(x.message, "bad"); } });
  load().catch(e => toast(e.message, "bad"));
}

/* ---------- الأسئلة ---------- */
async function faq() {
  const r = await A("/api/admin/faq");
  $("#view").innerHTML = `<div style="display:grid;gap:10px">${[...r.faq, { id: "", q: "", a: "", sort: 99, active: 1 }].map(f => `<form class="panel" data-id="${f.id}"><label class="fld"><span>${f.id ? "السؤال" : "سؤال جديد"}</span><input name="q" value="${esc(f.q)}" required></label><label class="fld"><span>الإجابة</span><textarea name="a" rows="3" required>${esc(f.a)}</textarea></label>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><label class="small">الترتيب <input name="sort" type="number" value="${f.sort}" style="width:70px"></label><label class="small"><input type="checkbox" name="active" ${f.active ? "checked" : ""}> ظاهر</label><button class="btn btn-primary">${f.id ? "حفظ" : "إضافة"}</button>${f.id ? `<button type="button" class="btn btn-ghost" data-del>حذف</button>` : ""}</div></form>`).join("")}</div>`;
  $$("#view form").forEach(fm => {
    fm.addEventListener("submit", async e => { e.preventDefault(); const f = new FormData(fm), id = fm.dataset.id; const body = { q: f.get("q"), a: f.get("a"), sort: Number(f.get("sort")), active: !!f.get("active") };
      try { id ? await A("/api/admin/faq/" + id, body, "PUT") : await A("/api/admin/faq", body); toast("اتحفظ", "ok"); faq(); } catch (x) { toast(x.message, "bad"); } });
    fm.querySelector("[data-del]")?.addEventListener("click", async () => { if (!confirm("تحذف السؤال ده؟")) return; await A("/api/admin/faq/" + fm.dataset.id, undefined, "DELETE"); faq(); });
  });
}

/* ---------- المحادثات ---------- */
async function convos() {
  const r = await A("/api/admin/conversations");
  $("#view").innerHTML = `<p class="small">المحادثات بتتمسح تلقائيًا بعد ٩٠ يوم (سياسة الخصوصية). «موظف» يعني الوكيل وقف يرد وفي انتظار حد من الفريق.</p>
  <div class="tbl"><table><thead><tr><th>القناة</th><th>العميل</th><th>الحالة</th><th>رسايل</th><th>آخر تحديث</th></tr></thead><tbody>${r.conversations.map(c => `<tr class="clickable" data-id="${c.id}"><td>${c.channel === "whatsapp" ? "واتساب" : "الموقع"}</td><td dir="ltr">${c.external_id ? "+" + c.external_id : "زائر"}</td><td>${{ bot: "الوكيل", human: "موظف", closed: "مقفولة" }[c.status]}</td><td>${c.user_msgs}</td><td class="small">${dt(c.updated_at)}</td></tr>`).join("") || `<tr><td colspan="5">مفيش محادثات</td></tr>`}</tbody></table></div>`;
  $$("#view tr[data-id]").forEach(tr => tr.addEventListener("click", () => convoDrawer(tr.dataset.id)));
}
async function convoDrawer(id) {
  const { el, close } = drawer(`<div class="skel"></div>`);
  const r = await A("/api/admin/conversations/" + id);
  const c = r.conversation;
  el.innerHTML = `<div style="display:flex;justify-content:space-between"><h2 style="font-size:1.2rem">${c.channel === "whatsapp" ? "واتساب +" + c.external_id : "محادثة الموقع"}</h2><button class="btn btn-ghost" data-close>✕</button></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">${[["bot", "رجّعها للوكيل"], ["human", "موظف هيرد"], ["closed", "اقفلها"]].map(([s, t]) => `<button class="btn ${c.status === s ? "btn-primary" : "btn-ghost"}" data-st="${s}">${t}</button>`).join("")}</div>
    <div class="convo">${r.messages.map(m => `<div class="msg ${m.role === "user" ? "u" : m.role === "tool" ? "sys" : "b"}">${m.role === "staff" ? "👤 " : m.role === "tool" ? "⚙️ " : ""}${esc(m.text)}</div>`).join("")}</div>
    ${c.channel === "whatsapp" ? `<form id="rf" style="display:grid;gap:8px"><textarea id="rt" rows="3" placeholder="رد من الموظف (متاح لحد ٢٤ ساعة من آخر رسالة للعميل)"></textarea><button class="btn btn-wa">ابعت على واتساب</button></form>` : ""}`;
  $(".drawer [data-close]").addEventListener("click", close);
  $$(".drawer [data-st]").forEach(b => b.addEventListener("click", async () => { await A(`/api/admin/conversations/${id}/status`, { status: b.dataset.st }); toast("اتحدثت", "ok"); convoDrawer(id); convos(); }));
  $("#rf")?.addEventListener("submit", async e => { e.preventDefault(); const btn = e.target.querySelector("button"); busy(btn, true);
    try { await A(`/api/admin/conversations/${id}/reply`, { text: $("#rt").value }); toast("اتبعت", "ok"); convoDrawer(id); } catch (x) { busy(btn, false); toast(x.message, "bad"); } });
}

/* ---------- طلبات التواصل والتحويل ---------- */
async function handoffs() {
  const r = await A("/api/admin/handoffs");
  $("#view").innerHTML = `<div class="tbl"><table><thead><tr><th>النوع</th><th>الاسم</th><th>الموبايل</th><th>الرسالة / السبب</th><th>الوقت</th><th></th></tr></thead><tbody>${r.handoffs.map(h => `<tr style="${h.resolved_at ? "opacity:.5" : ""}"><td>${h.kind === "contact" ? "نموذج تواصل" : "تحويل من الوكيل"}</td><td>${esc(h.name || "—")}</td><td>${h.phone ? `<a dir="ltr" href="https://wa.me/${h.phone}" target="_blank" rel="noopener">+${h.phone}</a>` : "—"}</td><td>${esc(h.reason || "")}</td><td class="small">${dt(h.created_at)}</td><td>${h.resolved_at ? "اتحل" : `<button class="btn btn-ghost" data-r="${h.id}">اتحل</button>`}</td></tr>`).join("") || `<tr><td colspan="6">مفيش طلبات</td></tr>`}</tbody></table></div>`;
  $$("[data-r]").forEach(b => b.addEventListener("click", async () => { await A(`/api/admin/handoffs/${b.dataset.r}/resolve`, {}); handoffs(); }));
}

const VIEWS = { bookings, trips, dates, faq, convos, handoffs };
token ? shell() : loginView();
