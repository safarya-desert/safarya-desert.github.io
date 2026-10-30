/* مساعد الحجز (شات الموقع) — بيكلّم /api/chat على السيرفر.
   مفيش أي مفتاح API في المتصفح. */
import { api, esc, waLink } from "./app.js";

const KEY = "sd-chat";
let state = { id: null, log: [] };
try { state = JSON.parse(sessionStorage.getItem(KEY)) || state; } catch {}
const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify({ id: state.id, log: state.log.slice(-40) })); } catch {} };

let box, logEl, ta, sending = false, fabRef;

function fmt(t) {
  return esc(t)
    .replace(/\b(SD-[A-Z0-9]{6})\b/g, '<a href="/booking/?ref=$1">$1</a>')
    .replace(/(https:\/\/wa\.me\/\d+)/g, '<a href="$1" target="_blank" rel="noopener">واتساب</a>')
    .replace(/(^|\s)(\/trips\/[a-z0-9]+\.html)/g, '$1<a href="$2">صفحة الرحلة</a>');
}
function add(role, text, persist = true) {
  const d = document.createElement("div");
  d.className = "msg " + role; d.innerHTML = fmt(text);
  logEl.append(d); logEl.scrollTop = logEl.scrollHeight;
  if (persist) { state.log.push([role, text]); save(); }
}
function typing(on) {
  logEl.querySelector(".typing")?.remove();
  if (on) { logEl.insertAdjacentHTML("beforeend", '<div class="typing" aria-label="المساعد بيكتب"><i></i><i></i><i></i></div>'); logEl.scrollTop = logEl.scrollHeight; }
}

async function send(text) {
  text = text.trim(); if (!text || sending) return;
  sending = true; ta.value = ""; ta.style.height = "";
  box.querySelector(".quick")?.remove();
  add("u", text); typing(true);
  try {
    const r = await api("/api/chat", { message: text, conversationId: state.id }, { timeout: 45000 });
    state.id = r.conversationId; save();
    typing(false);
    add("b", r.reply);
    if (r.booking) add("sys", `✓ اتسجل الحجز ${r.booking.ref} — تقدر تتابعه من صفحة «متابعة الحجز».`);
    if (r.handoff || r.error) { const l = waLink(r.booking ? `حجز رقم ${r.booking.ref}` : "محتاج مساعدة في حجز"); if (l) add("sys", `تقدر تكمل مع فريقنا على ${l}`); }
  } catch (e) {
    typing(false);
    add("sys", e.status === 429 ? "رسايل كتير ورا بعض — استنى دقيقة وجرّب تاني." : `${e.message}${waLink() ? ` — أو كلّمنا على ${waLink()}` : ""}`, false);
  } finally { sending = false; ta.focus(); }
}

function build() {
  box = document.createElement("section");
  box.className = "chat"; box.setAttribute("role", "dialog"); box.setAttribute("aria-label", "مساعد الحجز");
  box.innerHTML = `<header><svg width="30" height="30" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="19" fill="#F2B652"/><path d="M3 27 Q12 18 20 25 T37 23 L37 30 Q30 38 20 38 Q9 38 3 30Z" fill="#EFE6D2"/></svg><div><b>مساعد سفرية</b><small>بيرد فورًا · وبيحوّلك لموظف لو احتجت</small></div><button type="button" aria-label="اقفل الشات">✕</button></header>
  <div class="log" aria-live="polite"></div>
  <div class="quick">${["عايز رحلة يوم واحد", "رحلات سيوة وأسعارها", "إيه المتاح الشهر الجاي؟", "تابع حجزي"].map(q => `<button type="button">${q}</button>`).join("")}</div>
  <form><textarea rows="1" placeholder="اكتب سؤالك أو طلبك…" aria-label="رسالتك" maxlength="2000"></textarea><button type="submit" aria-label="ابعت"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="transform:scaleX(-1)"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/></svg></button></form>
  <p class="fine">المحادثات بتتحفظ لتحسين الخدمة — <a href="/privacy/">الخصوصية</a>. متكتبش بيانات بطاقات بنكية.</p>`;
  document.body.append(box);
  logEl = box.querySelector(".log"); ta = box.querySelector("textarea");
  if (state.log.length) state.log.forEach(([r, t]) => add(r, t, false));
  else add("b", "أهلًا بيك في سفرية ديزرت! 🌄 أنا مساعد الحجز. قولي رايح فين وإمتى وكام فرد، وأنا أقولك المتاح والسعر وأحجزلك.", true);
  if (state.log.length > 1) box.querySelector(".quick")?.remove();
  box.querySelector("header button").addEventListener("click", close);
  box.querySelector("form").addEventListener("submit", e => { e.preventDefault(); send(ta.value); });
  ta.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(ta.value); } });
  ta.addEventListener("input", () => { ta.style.height = "auto"; ta.style.height = Math.min(120, ta.scrollHeight) + "px"; });
  box.querySelectorAll(".quick button").forEach(b => b.addEventListener("click", () => send(b.textContent)));
  document.addEventListener("keydown", e => { if (e.key === "Escape" && box && !box.hidden) close(); });
}
function close() { box.hidden = true; fabRef?.setAttribute("aria-expanded", "false"); fabRef?.focus(); }

export function openChat(fab) {
  fabRef = fab;
  if (!box) build();
  if (!box.hidden && box.isConnected && fab.getAttribute("aria-expanded") === "true") return close();
  box.hidden = false; fab.setAttribute("aria-expanded", "true"); fab.querySelector(".dot")?.remove();
  ta.focus();
}
