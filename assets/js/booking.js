/* متابعة الحجز: عرض الحالة، شاشة النجاح بعد الحجز، والإلغاء حسب السياسة */
import { $, hasApi, api, money, esc, busy, toast, waLink, nf } from "./app.js";
import { refundFor, cairoToday } from "../../shared/pricing.js";

const qs = new URLSearchParams(location.search);
const out = $("#result");
let last = null;
try { last = JSON.parse(sessionStorage.getItem("sd-last") || "null"); } catch {}

if (!hasApi()) {
  $("#lNote").innerHTML = `متابعة الحجز أونلاين هتشتغل أول ما نظام الحجز يتفعّل. لحد دلوقتي ${waLink() ? `<a href="${waLink("عايز أعرف حالة حجزي")}" target="_blank" rel="noopener">كلّمنا على واتساب</a>` : `<a href="/contact/">تواصل معانا</a>`}.`;
  $("#lBtn").disabled = true;
}
if (qs.get("ref")) $("#lRef").value = qs.get("ref");
if (last && last.ref === qs.get("ref")) $("#lPhone").value = last.phone;

const party = p => [`${nf.format(p.adults)} كبار`, p.kids ? `${nf.format(p.kids)} أطفال ٦–١١` : "", p.kidsSmall ? `${nf.format(p.kidsSmall)} أطفال ٢–٥` : "", p.infants ? `${nf.format(p.infants)} رضّع` : ""].filter(Boolean).join(" + ");
const fmtTime = iso => new Intl.DateTimeFormat("ar-EG", { timeZone: "Africa/Cairo", dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

function render(b, { fresh = false, phone } = {}) {
  const burst = fresh ? Array.from({ length: 14 }, (_, i) => `<i class="sand" style="--x:${Math.round(Math.cos(i / 14 * 6.28) * 160)}px;--y:${Math.round(Math.sin(i / 14 * 6.28) * 110)}px"></i>`).join("") : "";
  const canCancel = ["pending", "confirmed", "quote", "expired"].includes(b.status);
  const rf = b.status === "confirmed" ? refundFor(b.date, cairoToday()) : null;
  out.innerHTML = `<div class="panel">
    ${fresh ? `<div class="success">${burst}<svg class="tick" viewBox="0 0 84 84" aria-hidden="true"><circle cx="42" cy="42" r="38"/><path d="M26 43l11 11 21-23"/></svg>
      <h2 style="font-size:1.6rem">${b.status === "quote" ? "اتسجل طلب عرض السعر" : "اتسجل حجزك المبدئي"}</h2>
      <p class="lead">احتفظ برقم الحجز ده — هتحتاجه مع رقم موبايلك لمتابعة الحجز.</p><div class="refbox">${esc(b.ref)}</div></div>` : ""}
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><h2 style="font-size:1.3rem">${esc(b.tripTitle)}</h2><span class="status-pill ${b.status}">${esc(b.statusLabel)}</span></div>
    <dl class="kv"><dt>رقم الحجز</dt><dd dir="ltr" style="text-align:right">${esc(b.ref)}</dd><dt>الاسم</dt><dd>${esc(b.name)}</dd><dt>التاريخ</dt><dd>${esc(b.date)}</dd><dt>الأفراد</dt><dd>${party(b.party)}</dd>
    <dt>النوع</dt><dd>${b.party.tier === "private" ? "خاصة" : "مجموعة"} — ${b.party.stay === "up" ? "ترقية فاخرة" : "إقامة قياسية"}</dd>
    <dt>الإجمالي</dt><dd class="num">${money(b.total, b.currency)}</dd>${b.deposit != null ? `<dt>المقدم (٣٠٪)</dt><dd class="num">${money(b.deposit, b.currency)}</dd>` : ""}
    ${b.expiresAt ? `<dt>المكان محجوز لحد</dt><dd>${fmtTime(b.expiresAt)}</dd>` : ""}${b.refundDue != null && b.status === "cancelled" ? `<dt>المبلغ المسترد</dt><dd class="num">${money(b.refundDue, b.currency)}</dd>` : ""}</dl>
    ${b.status === "pending" ? `<div class="alert info">الخطوة الجاية: فريقنا هيبعتلك بيانات دفع المقدم على واتساب. الحجز بيتأكد بعد استلامه.${waLink() ? ` تقدر تستعجلنا: <a href="${waLink(`حجز رقم ${b.ref} — عايز بيانات دفع المقدم`)}" target="_blank" rel="noopener">ابعت على واتساب</a>.` : ""}</div>` : ""}
    ${b.status === "expired" ? `<div class="alert err">مهلة الحجز المبدئي خلصت من غير دفع المقدم، والمكان ممكن يكون اتحجز. <a href="/book/?trip=${esc(b.tripId)}">احجز تاني</a> أو كلّمنا.</div>` : ""}
    ${canCancel ? `<details><summary>إلغاء الحجز</summary><p>${b.status === "confirmed" ? (rf.refund > 0 ? `فاضل ${nf.format(rf.days)} يوم على الرحلة: ${esc(rf.label)} (${money(Math.round((b.deposit || 0) * rf.refund), b.currency)}).` : "فاضل أقل من ٣ أيام: الإلغاء مش متاح أونلاين، بس تقدر تأجل لميعاد تاني خلال ٦ شهور — كلّمنا.") : "الحجز لسه مبدئي ومفيش مقدم مدفوع، فالإلغاء من غير أي رسوم."}</p>
      ${b.status !== "confirmed" || rf.refund > 0 ? `<button class="btn btn-ghost" type="button" id="cancelBtn" style="border-color:#C0392B;color:#C0392B;margin-bottom:12px">أيوه، ألغي الحجز</button>` : ""}</details>` : ""}
  </div>`;
  $("#cancelBtn")?.addEventListener("click", async e => {
    if (e.target.dataset.sure !== "1") { e.target.dataset.sure = "1"; e.target.textContent = "متأكد؟ اضغط تاني للتأكيد"; return; }
    busy(e.target, true, "بنلغي…");
    try { const r = await api("/api/bookings/cancel", { ref: b.ref, phone, confirm: true }); toast(r.message || "اتلغى الحجز", "ok"); render(r.booking, { phone }); }
    catch (err) { busy(e.target, false); toast(err.message, "bad"); $("#lErr").hidden = false; $("#lErr").textContent = err.message; }
  });
  out.scrollIntoView({ block: "start", behavior: fresh ? "auto" : "smooth" });
}

async function lookup(ref, phone, opts = {}) {
  $("#lErr").hidden = true;
  const btn = $("#lBtn"); busy(btn, true, "بندوّر…");
  try { const r = await api("/api/bookings/lookup", { ref, phone }); render(r.booking, { ...opts, phone }); }
  catch (e) { $("#lErr").hidden = false; $("#lErr").textContent = e.message; out.innerHTML = ""; }
  finally { busy(btn, false); }
}
$("#lk").addEventListener("submit", e => {
  e.preventDefault();
  const ref = $("#lRef").value.trim(), phone = $("#lPhone").value.trim();
  if (!ref || !phone) { $("#lErr").hidden = false; $("#lErr").textContent = "اكتب رقم الحجز ورقم الموبايل"; return; }
  lookup(ref, phone);
});
if (hasApi() && qs.get("ref") && last && last.ref === qs.get("ref")) lookup(last.ref, last.phone, { fresh: qs.get("new") === "1" });
