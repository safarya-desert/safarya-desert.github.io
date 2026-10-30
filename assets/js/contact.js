/* Contact form: stored on the server, or opened as a WhatsApp message when the server isn't live */
import { $, hasApi, api, waLink, esc, busy, toast, t, AR } from "./app.js";
import { normalizePhone } from "../../shared/pricing.js";

$("#ct").addEventListener("submit", async e => {
  e.preventDefault();
  const err = $("#cErr"); err.hidden = true;
  const name = $("#cName").value.trim(), phone = $("#cPhone").value.trim(), message = $("#cMsg").value.trim();
  const problems = [name.length < 2 && t.errContact.name, !normalizePhone(phone) && t.errContact.phone, message.length < 5 && t.errContact.msg, !$("#cConsent").checked && t.errContact.consent].filter(Boolean);
  if (problems.length) { err.hidden = false; err.textContent = problems.join(" — "); return; }
  const text = AR ? `رسالة من الموقع\nالاسم: ${name}\nالموبايل: ${phone}\n${message}` : `Message from the website\nName: ${name}\nPhone: ${phone}\n${message}`;
  if (!hasApi()) {
    const l = waLink(text);
    if (l) { window.open(l, "_blank", "noopener"); toast(t.contactWaOpened); }
    else { err.hidden = false; err.textContent = t.contactOff; }
    return;
  }
  const btn = $("#cBtn"); busy(btn, true, t.sending);
  try {
    await api("/api/contact", { name, phone, message, consent: true, website: $("#cWebsite").value });
    $("#ct").innerHTML = `<div class="success"><svg class="tick" viewBox="0 0 84 84" aria-hidden="true"><circle cx="42" cy="42" r="38"/><path d="M26 43l11 11 21-23"/></svg><h2 style="font-size:1.8rem">${t.contactThanks}</h2><p class="lead">${esc(t.contactReply(phone))}</p></div>`;
  } catch (e2) {
    busy(btn, false); err.hidden = false;
    err.innerHTML = esc(e2.message) + (waLink() ? ` — <a href="${waLink(text)}" target="_blank" rel="noopener">${t.sendInsteadWa}</a>` : "");
  }
});
