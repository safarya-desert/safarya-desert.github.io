/* Manage booking: status, the success screen after booking, and cancellation by policy */
import { $, hasApi, api, money, esc, busy, toast, waLink, nf, t, href, getCatalog, AR } from "./app.js";
import { refundFor, cairoToday } from "../../shared/pricing.js";

const qs = new URLSearchParams(location.search);
const out = $("#result");
let last = null;
try { last = JSON.parse(sessionStorage.getItem("sd-last") || "null"); } catch {}
let titles = {};
getCatalog().then(c => { titles = Object.fromEntries(c.trips.map(x => [x.id, x.title])); });

if (!hasApi()) {
  $("#lNote").innerHTML = `${t.trackOff} ${waLink() ? `<a href="${waLink(AR ? "عايز أعرف حالة حجزي" : "I'd like to check my booking")}" target="_blank" rel="noopener">${t.trackWa}</a>` : `<a href="${href("/contact/")}">${t.trackContact}</a>`}.`;
  $("#lBtn").disabled = true;
}
if (qs.get("ref")) $("#lRef").value = qs.get("ref");
if (last && last.ref === qs.get("ref")) $("#lPhone").value = last.phone;

const people = p => t.people(p);
const fmtTime = iso => new Intl.DateTimeFormat(t.numbers, { timeZone: "Africa/Cairo", dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
const refundLabel = rate => t.refundLabels[rate >= 1 ? 0 : rate > 0 ? 1 : 2];

function render(b, { fresh = false, phone } = {}) {
  const burst = fresh ? Array.from({ length: 14 }, (_, i) => `<i class="sand" style="--x:${Math.round(Math.cos(i / 14 * 6.28) * 160)}px;--y:${Math.round(Math.sin(i / 14 * 6.28) * 110)}px"></i>`).join("") : "";
  const canCancel = ["pending", "confirmed", "quote", "expired"].includes(b.status);
  const rf = b.status === "confirmed" ? refundFor(b.date, cairoToday()) : null;
  const title = titles[b.tripId] || b.tripTitle;
  out.innerHTML = `<div class="panel">
    ${fresh ? `<div class="success">${burst}<svg class="tick" viewBox="0 0 84 84" aria-hidden="true"><circle cx="42" cy="42" r="38"/><path d="M26 43l11 11 21-23"/></svg>
      <h2 style="font-size:2rem">${b.status === "quote" ? t.quoteTitle : t.bookedTitle}</h2><p class="lead">${t.keepRef}</p><div class="refbox">${esc(b.ref)}</div></div>` : ""}
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><h2 style="font-size:1.6rem">${esc(title)}</h2><span class="status-pill ${b.status}">${esc(t.status[b.status] || b.statusLabel)}</span></div>
    <dl class="kv"><dt>${t.ref}</dt><dd dir="ltr" style="text-align:start">${esc(b.ref)}</dd><dt>${t.name}</dt><dd>${esc(b.name)}</dd><dt>${t.date}</dt><dd>${esc(b.date)}</dd><dt>${t.travellers}</dt><dd>${people(b.party)}</dd>
    <dt>${t.type}</dt><dd>${b.party.tier === "private" ? t.private : t.group} — ${b.party.stay === "up" ? t.premium : t.standard}</dd>
    <dt>${t.total}</dt><dd class="num">${money(b.total, b.currency)}</dd>${b.deposit != null ? `<dt>${t.deposit}</dt><dd class="num">${money(b.deposit, b.currency)}</dd>` : ""}
    ${b.expiresAt ? `<dt>${t.heldUntil}</dt><dd>${fmtTime(b.expiresAt)}</dd>` : ""}${b.refundDue != null && b.status === "cancelled" ? `<dt>${t.refund}</dt><dd class="num">${money(b.refundDue, b.currency)}</dd>` : ""}</dl>
    ${b.status === "pending" ? `<div class="alert info">${t.nextStep}${waLink() ? ` ${t.hurry} <a href="${waLink(`${t.ref} ${b.ref}`)}" target="_blank" rel="noopener">${t.sendWa}</a>.` : ""}</div>` : ""}
    ${b.status === "expired" ? `<div class="alert err">${t.expired} <a href="${href(`/book/?trip=${esc(b.tripId)}`)}">${t.bookAgain}</a></div>` : ""}
    ${canCancel ? `<details><summary>${t.cancelTitle}</summary><p>${b.status === "confirmed" ? (rf.refund > 0 ? t.cancelRefund(nf.format(rf.days), refundLabel(rf.refund), money(Math.round((b.deposit || 0) * rf.refund), b.currency)) : t.cancelLate) : t.cancelFree}</p>
      ${b.status !== "confirmed" || rf.refund > 0 ? `<button class="btn btn-ghost" type="button" id="cancelBtn" style="border-color:var(--bad);color:var(--bad);margin-bottom:14px">${t.cancelBtn}</button>` : ""}</details>` : ""}
  </div>`;
  $("#cancelBtn")?.addEventListener("click", async e => {
    if (e.target.dataset.sure !== "1") { e.target.dataset.sure = "1"; e.target.textContent = t.sure; return; }
    busy(e.target, true, t.cancelling);
    try { const r = await api("/api/bookings/cancel", { ref: b.ref, phone, confirm: true }); toast(t.cancelled, "ok"); render(r.booking, { phone }); }
    catch (err) { busy(e.target, false); toast(err.message, "bad"); $("#lErr").hidden = false; $("#lErr").textContent = err.message; }
  });
  out.scrollIntoView({ block: "start", behavior: fresh ? "auto" : "smooth" });
}

async function lookup(ref, phone, opts = {}) {
  $("#lErr").hidden = true;
  const btn = $("#lBtn"); busy(btn, true, t.lookingUp);
  try { await getCatalog(); const r = await api("/api/bookings/lookup", { ref, phone }); render(r.booking, { ...opts, phone }); }
  catch (e) { $("#lErr").hidden = false; $("#lErr").textContent = e.message; out.innerHTML = ""; }
  finally { busy(btn, false); }
}
$("#lk").addEventListener("submit", e => {
  e.preventDefault();
  const ref = $("#lRef").value.trim(), phone = $("#lPhone").value.trim();
  if (!ref || !phone) { $("#lErr").hidden = false; $("#lErr").textContent = t.enterBoth; return; }
  lookup(ref, phone);
});
if (hasApi() && qs.get("ref") && last && last.ref === qs.get("ref")) lookup(last.ref, last.phone, { fresh: qs.get("new") === "1" });
