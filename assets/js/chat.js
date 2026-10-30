/* Booking assistant (website chat) — talks to /api/chat. No API keys in the browser. */
import { api, esc, waLink, t, href } from "./app.js";

const KEY = "sd-chat";
let st = { id: null, log: [] };
try { st = JSON.parse(sessionStorage.getItem(KEY)) || st; } catch {}
const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify({ id: st.id, log: st.log.slice(-40) })); } catch {} };
let box, logEl, ta, sending = false, fabRef;

function fmt(s) {
  return esc(s)
    .replace(/\b(SD-[A-Z0-9]{6})\b/g, `<a href="${href("/booking/")}?ref=$1">$1</a>`)
    .replace(/(https:\/\/wa\.me\/\d+)/g, `<a href="$1" target="_blank" rel="noopener">${t.whatsapp}</a>`)
    .replace(/(^|\s)(\/trips\/[a-z0-9]+\.html)/g, `$1<a href="${href("")}$2">${t.tripPage}</a>`);
}
function add(role, text, persist = true) {
  const d = document.createElement("div");
  d.className = "msg " + role; d.innerHTML = fmt(text);
  logEl.append(d); logEl.scrollTop = logEl.scrollHeight;
  if (persist) { st.log.push([role, text]); save(); }
}
function typing(on) {
  logEl.querySelector(".typing")?.remove();
  if (on) { logEl.insertAdjacentHTML("beforeend", `<div class="typing" aria-label="${t.chatTyping}"><i></i><i></i><i></i></div>`); logEl.scrollTop = logEl.scrollHeight; }
}
async function send(text) {
  text = text.trim(); if (!text || sending) return;
  sending = true; ta.value = ""; ta.style.height = "";
  box.querySelector(".quick")?.remove();
  add("u", text); typing(true);
  try {
    const r = await api("/api/chat", { message: text, conversationId: st.id }, { timeout: 45000 });
    st.id = r.conversationId; save();
    typing(false); add("b", r.reply);
    if (r.booking) add("sys", t.chatBooked(r.booking.ref));
    if (r.handoff || r.error) { const l = waLink(r.booking ? r.booking.ref : ""); if (l) add("sys", t.chatHuman(l)); }
  } catch (e) {
    typing(false);
    add("sys", e.status === 429 ? t.chatTooMany : `${e.message}${waLink() ? t.chatOr(waLink()) : ""}`, false);
  } finally { sending = false; ta.focus(); }
}
function build() {
  box = document.createElement("section");
  box.className = "chat"; box.setAttribute("role", "dialog"); box.setAttribute("aria-label", t.chatTitle);
  box.innerHTML = `<header><svg width="32" height="32" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="19" fill="#BE9150"/><path d="M27 6.8l1.25 3.45 3.45 1.25-3.45 1.25L27 16.2l-1.25-3.45-3.45-1.25 3.45-1.25z" fill="#13110E"/><path d="M4 28 Q12 20.5 20 25.5 T36 23.5 L36 28.5 Q30 37 20 37 Q10 37 4 28.5Z" fill="#F4EEE4"/></svg><div><b>${t.chatTitle}</b><small>${t.chatSub}</small></div><button type="button" aria-label="${t.chatClose}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button></header>
  <div class="log" aria-live="polite"></div>
  <div class="quick">${t.chatQuick.map(q => `<button type="button">${q}</button>`).join("")}</div>
  <form><textarea rows="1" placeholder="${t.chatPlaceholder}" aria-label="${t.chatYour}" maxlength="2000"></textarea><button type="submit" aria-label="${t.chatSend}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/></svg></button></form>
  <p class="fine">${t.chatFine}</p>`;
  document.body.append(box);
  logEl = box.querySelector(".log"); ta = box.querySelector("textarea");
  if (st.log.length) st.log.forEach(([r, x]) => add(r, x, false)); else add("b", t.chatHello, true);
  if (st.log.length > 1) box.querySelector(".quick")?.remove();
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
  if (!box.hidden && fab.getAttribute("aria-expanded") === "true") return close();
  box.hidden = false; fab.setAttribute("aria-expanded", "true"); fab.querySelector(".dot")?.remove();
  ta.focus();
}
