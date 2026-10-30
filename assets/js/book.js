/* صفحة الحجز */
import { $, $$, getCatalog, photo, wireImages, money, onCurrency, CUR, hasApi, api, waLink, waNumber, esc, busy, toast, nf } from "./app.js";
import { normalizeParty, quote, checkDateRules, cairoToday, addDays, normalizePhone, seatsNeeded } from "../../shared/pricing.js";
import { POLICY, MONTHS } from "../../shared/catalog.js";

const qs = new URLSearchParams(location.search);
let TRIPS = [], trip;
const form = $("#bk");
const idemKey = (crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random()).toString();

/* وضع التشغيل */
const note = $("#modeNote");
note.hidden = false;
note.innerHTML = hasApi()
  ? "✓ الحجز بيتسجل فورًا في نظامنا ويوصلك رقم حجز تتابع بيه. التواريخ في التقويم بتوضح الأماكن الفاضية فعلًا."
  : "الحجز الأونلاين الكامل لسه بيتجهز: هنجهزلك رسالة الحجز تبعتها على واتساب، وفريقنا بيتأكد من التوافر ويرد عليك برقم الحجز.";
$("#bSubmit").textContent = hasApi() ? "أكّد الحجز المبدئي" : "جهّز رسالة الحجز";

/* العدّادات */
$$("[data-step]").forEach(b => b.addEventListener("click", () => {
  const i = document.getElementById(b.dataset.step);
  i.value = Math.min(+i.max, Math.max(+i.min, (+i.value || 0) + +b.dataset.d));
  i.dispatchEvent(new Event("input", { bubbles: true }));
}));

function party() {
  return normalizeParty({
    adults: +$("#bAdults").value || 1, kids: +$("#bKids").value || 0, kidsSmall: +$("#bKidsSmall").value || 0, infants: +$("#bInfants").value || 0,
    tier: $("[name=tier]:checked").value, stay: $("[name=stay]:checked").value, currency: CUR,
  });
}

/* الملخص */
let lastMedia;
function calc() {
  trip = TRIPS.find(t => t.id === $("#bTrip").value) || TRIPS[0];
  if (!trip) return;
  if (lastMedia !== trip.id) { $("#sMedia").innerHTML = photo(trip.cover, { art: trip.art, alt: trip.title }); wireImages($("#sMedia")); lastMedia = trip.id; }
  const np = party();
  $("#sTitle").textContent = trip.title;
  $("#sRoute").textContent = `${trip.dur} · ${np.ok && np.party.tier === "private" ? "رحلة خاصة" : "رحلة مجموعة"}`;
  if (!np.ok) { $("#sLines").innerHTML = `<p class="err">${esc(np.error)}</p>`; $("#sTotal").textContent = "—"; $("#sDep").textContent = "—"; return; }
  const q = quote(trip, np.party);
  if (!q) { $("#sLines").innerHTML = `<div class="line"><span>الرحلة دي بعرض سعر حسب حجم المجموعة والتصاريح</span></div>`; $("#sTotal").textContent = "عند الطلب"; $("#sDep").textContent = "بعد عرض السعر"; return; }
  $("#sLines").innerHTML = q.lines.map(l => `<div class="line"><span>${esc(l.label)}${l.unit ? ` × ${money(l.unit)}` : ""}</span><span class="num">${money(l.amount)}</span></div>`).join("");
  $("#sTotal").textContent = money(q.total); $("#sDep").textContent = money(q.deposit);
}

/* التقويم (لو السيرفر متوصل) */
let calMonth, calSeq = 0;
function monthKey(d) { return d.slice(0, 7); }
async function drawCal() {
  if (!hasApi() || !trip) return;
  $("#calWrap").hidden = false;
  const [y, m] = calMonth.split("-").map(Number);
  $("#calTitle").textContent = `${MONTHS[m - 1]} ${nf.format(y).replace(/٬/g, "")}`;
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(); // 0 = الأحد
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const head = ["ح", "ن", "ث", "ر", "خ", "ج", "س"].map(d => `<div class="h">${d}</div>`).join("");
  const cal = $("#cal");
  cal.innerHTML = head + "<div></div>".repeat(first) + Array.from({ length: days }, (_, i) => `<button type="button" disabled data-d="${calMonth}-${String(i + 1).padStart(2, "0")}">${nf.format(i + 1)}<small>…</small></button>`).join("");
  const my = ++calSeq;
  const np = party(); if (!np.ok) return;
  try {
    const r = await api("/api/calendar", { tripId: trip.id, month: calMonth, party: np.party });
    if (my !== calSeq) return;
    $$("#cal button").forEach(b => {
      const v = r.days[b.dataset.d];
      const ok = v === true || v > 0;
      b.disabled = !ok;
      b.querySelector("small").textContent = ok ? (v === true ? "متاح" : `${nf.format(v)} مكان`) : "";
      b.setAttribute("aria-pressed", String(b.dataset.d === $("#bDate").value));
      b.setAttribute("aria-label", `${b.dataset.d} ${ok ? "متاح" : "مش متاح"}`);
    });
  } catch (e) { $$("#cal small").forEach(s => (s.textContent = "")); $$("#cal button").forEach(b => (b.disabled = false)); }
}
$("#cal").addEventListener("click", e => { const b = e.target.closest("button[data-d]"); if (!b || b.disabled) return; $("#bDate").value = b.dataset.d; $$("#cal button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); checkDate(); });
const shift = n => { const [y, m] = calMonth.split("-").map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); calMonth = d.toISOString().slice(0, 7); drawCal(); };
$("#calPrev").addEventListener("click", () => shift(-1)); $("#calNext").addEventListener("click", () => shift(1));

/* التحقق من اليوم المختار */
let avSeq = 0;
async function checkDate() {
  const box = $("#bAvail"), d = $("#bDate").value; $("#eDate").textContent = "";
  if (!d || !trip) { box.hidden = true; return; }
  const r = checkDateRules(trip, d);
  box.hidden = false;
  if (!r.ok) { box.className = "avail full no"; box.textContent = "✕ " + r.error; return; }
  if (!hasApi()) { box.className = "avail full"; box.textContent = "التاريخ مناسب لموسم الرحلة — الفريق هيأكد الأماكن المتاحة."; return; }
  const np = party(); if (!np.ok) return;
  const my = ++avSeq;
  box.className = "avail full"; box.innerHTML = '<span class="spin" aria-hidden="true"></span> بنتأكد من الأماكن…';
  try {
    const a = await api("/api/availability", { tripId: trip.id, date: d, party: np.party });
    if (my !== avSeq) return;
    box.className = "avail full " + (a.available ? "ok" : "no");
    box.textContent = a.available ? (a.quoteOnly ? "✓ التاريخ مناسب — هنبعتلك عرض السعر" : `✓ متاح — فاضل ${a.seatsLeft} أماكن (حجزك محتاج ${a.seatsNeeded})`) : "✕ " + a.message;
  } catch (e) { if (my === avSeq) { box.className = "avail full no"; box.textContent = e.message; } }
}

let deb;
function onChange(e) {
  calc();
  if (e && ["bTrip"].includes(e.target.id)) { calMonth = monthKey($("#bDate").value || $("#bDate").min); }
  clearTimeout(deb); deb = setTimeout(() => { drawCal(); checkDate(); }, 250);
}
form.addEventListener("input", onChange); form.addEventListener("change", onChange);
$("#bDate").addEventListener("change", () => { if ($("#bDate").value) calMonth = monthKey($("#bDate").value); });

/* الإرسال */
function setErr(id, m) { $(id).textContent = m; return !m; }
function waMessage(np, q) {
  const p = np.party;
  return [`طلب حجز – سفرية ديزرت`, `الرحلة: ${trip.title} (${trip.dur})`, `التاريخ: ${$("#bDate").value}`,
    `النوع: ${p.tier === "private" ? "خاصة" : "مجموعة"} – الإقامة: ${p.stay === "up" ? "ترقية فاخرة" : "قياسية"}`,
    `الأفراد: ${p.adults} كبار${p.kids ? ` + ${p.kids} أطفال ٦–١١` : ""}${p.kidsSmall ? ` + ${p.kidsSmall} أطفال ٢–٥` : ""}${p.infants ? ` + ${p.infants} رضّع` : ""}`,
    `الإجمالي المتوقع: ${q ? money(q.total) : "عرض سعر"}`, q ? `المقدم: ${money(q.deposit)}` : null,
    `الاسم: ${$("#bName").value.trim()}`, `الموبايل: ${$("#bPhone").value.trim()}`, $("#bNote").value.trim() ? `ملاحظات: ${$("#bNote").value.trim()}` : null].filter(Boolean).join("\n");
}
form.addEventListener("submit", async e => {
  e.preventDefault();
  $("#bErr").hidden = true;
  const np = party();
  let ok = setErr("#eName", $("#bName").value.trim().length < 3 ? "اكتب اسمك بالكامل" : "");
  ok = setErr("#ePhone", normalizePhone($("#bPhone").value) ? "" : "اكتب رقم موبايل صحيح، مثلًا 01012345678") && ok;
  const r = $("#bDate").value ? checkDateRules(trip, $("#bDate").value) : { ok: false, error: "اختار تاريخ السفر" };
  ok = setErr("#eDate", r.ok ? "" : r.error) && ok;
  ok = setErr("#eConsent", $("#bConsent").checked ? "" : "لازم توافق على الشروط وسياسة الخصوصية") && ok;
  if (!np.ok) { $("#bErr").hidden = false; $("#bErr").textContent = np.error; ok = false; }
  if (!ok) { form.querySelector(".err:not(:empty)")?.closest(".fld, .check, .err")?.scrollIntoView({ block: "center", behavior: "smooth" }); toast("راجع البيانات المطلوبة", "bad"); return; }
  const q = quote(trip, np.party);

  if (!hasApi()) {
    const msg = waMessage(np, q), link = waLink(msg);
    $("#confirm").hidden = false;
    $("#confirm").innerHTML = `<b>رسالة طلب الحجز جاهزة</b><p>ابعتها على واتساب، وفريقنا هيتأكد من الأماكن ويرد عليك برقم الحجز وبيانات دفع المقدم. <b>الطلب مش بيتحسب حجز لحد ما الفريق يأكده.</b></p><pre>${esc(msg)}</pre>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-amber" type="button" id="copyMsg">انسخ الرسالة</button>${link ? `<a class="btn btn-wa" href="${link}" target="_blank" rel="noopener">افتح واتساب وابعت</a>` : `<a class="btn btn-ghost" href="/contact/">رقم الواتساب لسه هيتضاف — تواصل معانا</a>`}</div>`;
    $("#copyMsg").addEventListener("click", () => navigator.clipboard.writeText(msg).then(() => toast("اتنسخت الرسالة", "ok")).catch(() => toast("انسخ الرسالة يدوي")));
    $("#confirm").scrollIntoView({ block: "nearest", behavior: "smooth" });
    return;
  }

  const btn = $("#bSubmit"); busy(btn, true, "بنسجّل حجزك…");
  try {
    const res = await api("/api/bookings", { tripId: trip.id, date: $("#bDate").value, party: np.party, name: $("#bName").value.trim(), phone: $("#bPhone").value.trim(), note: $("#bNote").value.trim(), consent: true, idemKey, website: $("#bWebsite").value });
    try { sessionStorage.setItem("sd-last", JSON.stringify({ ref: res.booking.ref, phone: $("#bPhone").value.trim() })); } catch {}
    location.href = `/booking/?ref=${encodeURIComponent(res.booking.ref)}&new=1`;
  } catch (err) {
    busy(btn, false);
    $("#bErr").hidden = false;
    $("#bErr").innerHTML = esc(err.message) + (err.data?.error === "duplicate" && err.data.ref ? ` — <a href="/booking/?ref=${encodeURIComponent(err.data.ref)}">اعرض الحجز</a>` : "")
      + (err.status === 0 && waLink() ? ` — أو <a href="${waLink(waMessage(np, q))}" target="_blank" rel="noopener">ابعت الطلب على واتساب</a>` : "");
    $("#bErr").scrollIntoView({ block: "center", behavior: "smooth" });
    toast("الحجز ماتسجّلش", "bad");
    if (["full", "closed"].includes(err.data?.error)) { drawCal(); checkDate(); }
  }
});

/* البداية */
const minDate = addDays(cairoToday(), POLICY.minNoticeDays);
$("#bDate").min = minDate;
getCatalog().then(c => {
  TRIPS = c.trips;
  const sel = $("#bTrip"), want = qs.get("trip");
  sel.innerHTML = TRIPS.map(t => `<option value="${t.id}">${esc(t.title)} — ${esc(t.dur)}</option>`).join("");
  sel.value = TRIPS.some(t => t.id === want) ? want : (TRIPS.find(t => t.id === "bw2") || TRIPS[0]).id;
  if (qs.get("adults")) $("#bAdults").value = Math.min(24, Math.max(1, +qs.get("adults") || 2));
  const d = qs.get("date");
  if (d && d >= minDate) $("#bDate").value = d;
  calc();
  const t = TRIPS.find(x => x.id === sel.value);
  let start = $("#bDate").value || addDays(cairoToday(), t.leadDays || POLICY.minNoticeDays);
  // لو الشهر الحالي خارج الموسم، ابدأ التقويم من أول شهر في الموسم
  for (let i = 0; i < 12 && t.months && !t.months.includes(Number(start.slice(5, 7))); i++) start = addDays(start.slice(0, 8) + "01", 32).slice(0, 8) + "01";
  calMonth = monthKey(start);
  drawCal(); checkDate();
});
onCurrency(() => { calc(); });
