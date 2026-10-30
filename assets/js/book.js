/* Booking page */
import { $, $$, getCatalog, photo, wireImages, money, onCurrency, CUR, hasApi, api, waLink, esc, busy, toast, nf, t, href, state, AR, ICON } from "./app.js";
import { normalizeParty, quote, checkDateRules, cairoToday, addDays, normalizePhone } from "../../shared/pricing.js";
import { POLICY } from "../../shared/catalog.js";
import { errText, months } from "./i18n.js";

const qs = new URLSearchParams(location.search);
let TRIPS = [], trip;
const form = $("#bk");
const idemKey = (crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random()).toString();

const note = $("#modeNote");
note.hidden = false;
note.innerHTML = `${ICON.info}<span>${hasApi() ? t.modeApi : t.modeStatic}</span>`;
$("#bSubmit").textContent = hasApi() ? t.submitApi : t.submitStatic;

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
const lineLabel = l => ({ adults: t.linesAdults(l.qty), kidsSmall: t.linesKidsSmall(l.qty), kids: t.linesKids(l.qty), infants: t.linesInfants(l.qty), upgrade: t.linesUpgrade }[l.key] || l.label);

let lastMedia;
function calc() {
  trip = TRIPS.find(x => x.id === $("#bTrip").value) || TRIPS[0];
  if (!trip) return;
  if (lastMedia !== trip.id) { $("#sMedia").innerHTML = photo(trip.cover, { art: trip.art, alt: trip.title }); wireImages($("#sMedia")); lastMedia = trip.id; }
  const np = party();
  $("#sTitle").textContent = trip.title;
  $("#sRoute").textContent = `${trip.dur} · ${np.ok && np.party.tier === "private" ? t.privateTrip : t.groupTrip}`;
  if (!np.ok) { $("#sLines").innerHTML = `<p class="err">${esc(errText("bad_party", {}, np.error))}</p>`; $("#sTotal").textContent = "—"; $("#sDep").textContent = "—"; return; }
  const q = quote(trip, np.party);
  if (!q) { $("#sLines").innerHTML = `<div class="line"><span>${t.quoteNote}</span></div>`; $("#sTotal").textContent = t.onRequest; $("#sDep").textContent = t.afterQuote; return; }
  $("#sLines").innerHTML = q.lines.map(l => `<div class="line"><span>${esc(lineLabel(l))}${l.unit ? ` × ${money(l.unit)}` : ""}</span><span class="num">${money(l.amount)}</span></div>`).join("");
  $("#sTotal").textContent = money(q.total); $("#sDep").textContent = money(q.deposit);
}

/* availability calendar (when the server is connected) */
let calMonth, calSeq = 0;
const monthKey = d => d.slice(0, 7);
async function drawCal() {
  if (!hasApi() || !trip) return;
  $("#calWrap").hidden = false;
  const [y, m] = calMonth.split("-").map(Number);
  $("#calTitle").textContent = `${months[m - 1]} ${AR ? nf.format(y).replace(/٬/g, "") : y}`;
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const heads = AR ? ["ح", "ن", "ث", "ر", "خ", "ج", "س"] : ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const cal = $("#cal");
  cal.innerHTML = heads.map(d => `<div class="h">${d}</div>`).join("") + "<div></div>".repeat(first) + Array.from({ length: days }, (_, i) => `<button type="button" disabled data-d="${calMonth}-${String(i + 1).padStart(2, "0")}">${nf.format(i + 1)}<small>…</small></button>`).join("");
  const my = ++calSeq;
  const np = party(); if (!np.ok) return;
  try {
    const r = await api("/api/calendar", { tripId: trip.id, month: calMonth, party: np.party });
    if (my !== calSeq) return;
    $$("#cal button").forEach(b => {
      const v = r.days[b.dataset.d], ok = v === true || v > 0;
      b.disabled = !ok;
      b.querySelector("small").textContent = ok ? (v === true ? t.open : t.seats(v)) : "";
      b.setAttribute("aria-pressed", String(b.dataset.d === $("#bDate").value));
      b.setAttribute("aria-label", `${b.dataset.d} ${ok ? t.availDay : t.unavailDay}`);
    });
  } catch { $$("#cal small").forEach(s => (s.textContent = "")); $$("#cal button").forEach(b => (b.disabled = false)); }
}
$("#cal").addEventListener("click", e => { const b = e.target.closest("button[data-d]"); if (!b || b.disabled) return; $("#bDate").value = b.dataset.d; $$("#cal button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); checkDate(); });
const shift = n => { const [y, m] = calMonth.split("-").map(Number); calMonth = new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7); drawCal(); };
$("#calPrev").addEventListener("click", () => shift(AR ? -1 : -1)); $("#calNext").addEventListener("click", () => shift(1));

let avSeq = 0;
async function checkDate() {
  const box = $("#bAvail"), d = $("#bDate").value; $("#eDate").textContent = "";
  const set = (cls, txt) => { box.hidden = false; box.className = "avail full " + cls; box.innerHTML = cls ? state(cls, txt) : txt; };
  if (!d || !trip) { box.hidden = true; return; }
  const r = checkDateRules(trip, d);
  if (!r.ok) return set("no", esc(errText(r.code, r, r.error)));
  if (!hasApi()) return set("", t.dateOkStatic);
  const np = party(); if (!np.ok) return;
  const my = ++avSeq;
  set("", `<span class="spin" aria-hidden="true"></span> ${t.checking}`);
  try {
    const a = await api("/api/availability", { tripId: trip.id, date: d, party: np.party });
    if (my !== avSeq) return;
    a.available ? set("ok", a.quoteOnly ? t.quoteOk : t.availShort(a.seatsLeft, a.seatsNeeded)) : set("no", esc(errText(a.reason, a, a.message)));
  } catch (e) { if (my === avSeq) set("no", esc(e.message)); }
}

let deb;
function onChange(e) {
  calc();
  if (e && e.target.id === "bTrip") calMonth = monthKey($("#bDate").value || $("#bDate").min);
  clearTimeout(deb); deb = setTimeout(() => { drawCal(); checkDate(); }, 250);
}
form.addEventListener("input", onChange); form.addEventListener("change", onChange);
$("#bDate").addEventListener("change", () => { if ($("#bDate").value) calMonth = monthKey($("#bDate").value); });

function setErr(id, m) { $(id).textContent = m; return !m; }
function waMessage(np, q) {
  const p = np.party;
  const people = t.people(p);
  return [t.waMsg, `${t.waTrip}: ${trip.title} (${trip.dur})`, `${t.waDate}: ${$("#bDate").value}`,
    `${t.waType}: ${p.tier === "private" ? t.private : t.group} – ${t.waStay}: ${p.stay === "up" ? t.premium : t.standard}`, `${t.waPeople}: ${people}`,
    `${t.waTotal}: ${q ? money(q.total) : t.onRequest}`, q ? `${t.waDeposit}: ${money(q.deposit)}` : null,
    `${t.waName}: ${$("#bName").value.trim()}`, `${t.waPhone}: ${$("#bPhone").value.trim()}`, $("#bNote").value.trim() ? `${t.waNotes}: ${$("#bNote").value.trim()}` : null].filter(Boolean).join("\n");
}
form.addEventListener("submit", async e => {
  e.preventDefault();
  $("#bErr").hidden = true;
  const np = party();
  let ok = setErr("#eName", $("#bName").value.trim().length < 3 ? t.errName : "");
  ok = setErr("#ePhone", normalizePhone($("#bPhone").value) ? "" : t.errPhone) && ok;
  const r = $("#bDate").value ? checkDateRules(trip, $("#bDate").value) : { ok: false, code: "", error: t.errDate };
  ok = setErr("#eDate", r.ok ? "" : (r.code ? errText(r.code, r, r.error) : t.errDate)) && ok;
  ok = setErr("#eConsent", $("#bConsent").checked ? "" : t.errConsent) && ok;
  if (!np.ok) { $("#bErr").hidden = false; $("#bErr").textContent = errText("bad_party", {}, np.error); ok = false; }
  if (!ok) { form.querySelector(".err:not(:empty)")?.closest(".fld, .check, .err")?.scrollIntoView({ block: "center", behavior: "smooth" }); toast(t.checkFields, "bad"); return; }
  const q = quote(trip, np.party);

  if (!hasApi()) {
    const msg = waMessage(np, q), link = waLink(msg);
    $("#confirm").hidden = false;
    $("#confirm").innerHTML = `<b>${t.waReady}</b><p>${t.waReadyP}</p><pre>${esc(msg)}</pre>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-gold" type="button" id="copyMsg">${t.copyMsg}</button>${link ? `<a class="btn btn-wa" href="${link}" target="_blank" rel="noopener">${t.openWa}</a>` : `<a class="btn btn-ghost" href="${href("/contact/")}">${t.waMissing}</a>`}</div>`;
    $("#copyMsg").addEventListener("click", () => navigator.clipboard.writeText(msg).then(() => toast(t.copied, "ok")).catch(() => toast(t.copyManual)));
    $("#confirm").scrollIntoView({ block: "nearest", behavior: "smooth" });
    return;
  }

  const btn = $("#bSubmit"); busy(btn, true, t.saving);
  try {
    const res = await api("/api/bookings", { tripId: trip.id, date: $("#bDate").value, party: np.party, name: $("#bName").value.trim(), phone: $("#bPhone").value.trim(), note: $("#bNote").value.trim(), consent: true, idemKey, website: $("#bWebsite").value });
    try { sessionStorage.setItem("sd-last", JSON.stringify({ ref: res.booking.ref, phone: $("#bPhone").value.trim() })); } catch {}
    location.href = href(`/booking/?ref=${encodeURIComponent(res.booking.ref)}&new=1`);
  } catch (err) {
    busy(btn, false);
    $("#bErr").hidden = false;
    $("#bErr").innerHTML = esc(err.message) + (err.data?.error === "duplicate" && err.data.ref ? ` — <a href="${href(`/booking/?ref=${encodeURIComponent(err.data.ref)}`)}">${t.viewBooking}</a>` : "")
      + (err.status === 0 && waLink() ? ` — <a href="${waLink(waMessage(np, q))}" target="_blank" rel="noopener">${t.orWa}</a>` : "");
    $("#bErr").scrollIntoView({ block: "center", behavior: "smooth" });
    toast(t.notSaved, "bad");
    if (["full", "closed"].includes(err.data?.error)) { drawCal(); checkDate(); }
  }
});

const minDate = addDays(cairoToday(), POLICY.minNoticeDays);
$("#bDate").min = minDate;
getCatalog().then(c => {
  TRIPS = c.trips;
  const sel = $("#bTrip"), want = qs.get("trip");
  sel.innerHTML = TRIPS.map(x => `<option value="${x.id}">${esc(x.title)} — ${esc(x.dur)}</option>`).join("");
  sel.value = TRIPS.some(x => x.id === want) ? want : (TRIPS.find(x => x.id === "bw2") || TRIPS[0]).id;
  if (qs.get("adults")) $("#bAdults").value = Math.min(24, Math.max(1, +qs.get("adults") || 2));
  const d = qs.get("date");
  if (d && d >= minDate) $("#bDate").value = d;
  calc();
  const tr = TRIPS.find(x => x.id === sel.value);
  let start = $("#bDate").value || addDays(cairoToday(), tr.leadDays || POLICY.minNoticeDays);
  for (let i = 0; i < 12 && tr.months && !tr.months.includes(Number(start.slice(5, 7))); i++) start = addDays(start.slice(0, 8) + "01", 32).slice(0, 8) + "01";
  calMonth = monthKey(start);
  drawCal(); checkDate();
});
onCurrency(() => calc());
