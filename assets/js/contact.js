/* نموذج التواصل: بيتسجل في السيرفر، ولو مش متاح بيتحول لرسالة واتساب */
import { $, hasApi, api, waLink, esc, busy, toast } from "./app.js";
import { normalizePhone } from "../../shared/pricing.js";

$("#ct").addEventListener("submit", async e => {
  e.preventDefault();
  const err = $("#cErr"); err.hidden = true;
  const name = $("#cName").value.trim(), phone = $("#cPhone").value.trim(), message = $("#cMsg").value.trim();
  const problems = [name.length < 2 && "اكتب اسمك", !normalizePhone(phone) && "رقم الموبايل مش صحيح", message.length < 5 && "اكتب رسالتك", !$("#cConsent").checked && "لازم توافق على سياسة الخصوصية"].filter(Boolean);
  if (problems.length) { err.hidden = false; err.textContent = problems.join(" — "); return; }
  const text = `رسالة من الموقع\nالاسم: ${name}\nالموبايل: ${phone}\n${message}`;
  if (!hasApi()) {
    const l = waLink(text);
    if (l) { window.open(l, "_blank", "noopener"); toast("فتحنالك واتساب بالرسالة — اضغط إرسال هناك"); }
    else { err.hidden = false; err.textContent = "التواصل الأونلاين لسه بيتجهز، ورقم الواتساب هيتضاف قريب."; }
    return;
  }
  const btn = $("#cBtn"); busy(btn, true, "بنبعت…");
  try {
    await api("/api/contact", { name, phone, message, consent: true, website: $("#cWebsite").value });
    $("#ct").innerHTML = `<div class="success"><svg class="tick" viewBox="0 0 84 84" aria-hidden="true"><circle cx="42" cy="42" r="38"/><path d="M26 43l11 11 21-23"/></svg><h2 style="font-size:1.4rem">وصلتنا رسالتك</h2><p class="lead">هنرد عليك على ${esc(phone)} في أقرب وقت.</p></div>`;
  } catch (e2) {
    busy(btn, false); err.hidden = false;
    err.innerHTML = esc(e2.message) + (waLink() ? ` — <a href="${waLink(text)}" target="_blank" rel="noopener">ابعتها على واتساب بدل كده</a>` : "");
  }
});
