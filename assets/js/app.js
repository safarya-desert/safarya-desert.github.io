/* Shared code for every page */
import { CONFIG } from "./config.js";
import { IMAGES } from "./images.js";
import { artSVG } from "./art.js";
import * as CAT from "../../shared/catalog.js";
import { LANG, AR, t, href, localTrip, fmtMoney, ICON } from "./i18n.js";

export { CONFIG, IMAGES, LANG, AR, t, href, ICON };
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const nf = new Intl.NumberFormat(t.numbers);
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const hasApi = () => !!CONFIG.API_BASE;

/* ---------- currency: USD by default in English, EGP in Arabic ---------- */
const CUR_KEY = "sd-cur-" + LANG;
export let CUR = AR ? "EGP" : "USD";
try { const c = localStorage.getItem(CUR_KEY); if (c === "USD" || c === "EGP") CUR = c; } catch {}
const curListeners = [];
export const onCurrency = fn => curListeners.push(fn);
export function setCur(c) {
  CUR = c; try { localStorage.setItem(CUR_KEY, c); } catch {}
  $$("[data-cur]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.cur === c)));
  curListeners.forEach(f => f(c));
}
export const money = (v, cur = CUR) => fmtMoney(v, cur);
export const priceOf = tr => (tr.quoteOnly ? null : CUR === "EGP" ? tr.egp : tr.usd);

/* ---------- API ---------- */
export class ApiError extends Error { constructor(status, data) { super(data?.message || "Network error"); this.status = status; this.data = data || {}; } }
import { errText } from "./i18n.js";
export async function api(path, body, { method, timeout = 20000, token } = {}) {
  if (!hasApi()) throw mkErr(0, { error: "no_api", message: "الحجز الأونلاين مش متفعّل لسه" });
  const ctrl = new AbortController(); const tm = setTimeout(() => ctrl.abort(), timeout);
  try {
    const headers = {}; if (body !== undefined) headers["content-type"] = "application/json"; if (token) headers.authorization = "Bearer " + token;
    const r = await fetch(CONFIG.API_BASE.replace(/\/$/, "") + path, { method: method || (body === undefined ? "GET" : "POST"), headers, body: body === undefined ? undefined : JSON.stringify(body), signal: ctrl.signal });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw mkErr(r.status, data);
    return data;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw mkErr(0, { error: "network", message: e.name === "AbortError" ? "السيرفر اتأخر في الرد، جرّب تاني" : "مفيش اتصال بالسيرفر دلوقتي، جرّب تاني بعد شوية" });
  } finally { clearTimeout(tm); }
}
function mkErr(status, data) { const e = new ApiError(status, data); e.message = errText(data.error, data, data.message) || data.message || e.message; return e; }

/* Data: from the server when connected (so admin edits show), otherwise the static catalog */
let catalogP;
export function getCatalog() {
  if (catalogP) return catalogP;
  const local = { trips: CAT.TRIPS, reserves: CAT.RESERVES, faq: CAT.FAQ, policy: CAT.POLICY, whatsapp: null, source: "static" };
  const p = hasApi() ? api("/api/catalog", undefined, { timeout: 6000 }).then(d => ({ ...d, source: "api" })).catch(() => local) : Promise.resolve(local);
  catalogP = p.then(c => ({ ...c, trips: c.trips.map(localTrip) }));
  return catalogP;
}
export { CAT };

/* ---------- WhatsApp ---------- */
let WA = CONFIG.WHATSAPP || "";
getCatalog().then(c => { if (!WA && c.whatsapp) { WA = c.whatsapp; wireWhatsApp(); } });
export const waNumber = () => WA;
export const waLink = text => (WA ? `https://wa.me/${WA}${text ? "?text=" + encodeURIComponent(text) : ""}` : null);
export const waDisplay = () => (WA ? "+" + WA.replace(/^(\d{2})(\d{2})(\d{4})(\d+)$/, "$1 $2 $3 $4") : "");
function wireWhatsApp() {
  $$("[data-wa]").forEach(a => {
    const l = waLink(a.dataset.wa || "");
    if (l) { a.href = l; a.target = "_blank"; a.rel = "noopener"; }
    else a.href = href("/contact/");
  });
  $$("[data-wa-num]").forEach(el => { el.textContent = waDisplay() || (AR ? "هيتضاف قريب" : "coming soon"); });
}

/* ---------- photos ---------- */
const COMMONS = f => "https://commons.wikimedia.org/wiki/File:" + encodeURIComponent(f.replace(/ /g, "_"));
export function imgInfo(key) { const i = IMAGES[key]; return i && i.src && !i.pending ? i : null; }
export const placeName = key => (IMAGES[key] ? (AR ? IMAGES[key].ar : IMAGES[key].en || IMAGES[key].ar) : "");
export function photo(key, { art = "dunes", alt, eager = false, credit = true, cls = "" } = {}) {
  const i = imgInfo(key);
  const fallback = artSVG(art);
  if (!i) return `<div class="ph ${cls}">${fallback}<span class="illus">${AR ? "رسم توضيحي" : "Illustration"}</span></div>`;
  const a = esc(alt || placeName(key));
  return `<div class="ph ${cls}" data-fallback="${art}">${fallback}<img src="${esc(i.src)}" alt="${a}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" width="${i.w > i.h ? 1280 : Math.round(1280 * i.w / i.h)}" height="${i.w > i.h ? Math.round(1280 * i.h / i.w) : 1280}" referrerpolicy="no-referrer">${credit ? `<a class="credit" href="${COMMONS(i.file)}" target="_blank" rel="noopener" title="${esc(placeName(key))} — ${esc(i.author)} — ${esc(i.license)}">© ${esc(i.author)} · ${esc(i.license)}</a>` : ""}</div>`;
}
export function wireImages(root = document) {
  $$(".ph[data-art]", root).forEach(ph => { if (!ph.querySelector(".art-svg")) ph.insertAdjacentHTML("afterbegin", artSVG(ph.dataset.art)); });
  $$(".ph > img", root).forEach(img => {
    if (img.dataset.w) return; img.dataset.w = 1;
    const ok = () => img.classList.add("ok");
    const bad = () => { const ph = img.parentElement; img.remove(); ph?.querySelector(".credit")?.remove(); if (ph && !ph.querySelector(".art-svg")) ph.insertAdjacentHTML("afterbegin", artSVG(ph.dataset.fallback || "dunes")); };
    if (img.complete) { img.naturalWidth ? ok() : bad(); }
    else { img.addEventListener("load", ok, { once: true }); img.addEventListener("error", bad, { once: true }); }
  });
}

/* ---------- reveal on scroll ---------- */
const io = "IntersectionObserver" in window ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px", threshold: .08 }) : null;
export function reveal(root = document) {
  $$(".reveal:not(.in)", root).forEach((el, i) => { if (!el.style.getPropertyValue("--d")) el.style.setProperty("--d", String(i % 6)); io ? io.observe(el) : el.classList.add("in"); });
  wireImages(root);
}

/* ---------- messages ---------- */
export function toast(m, kind = "") {
  let el = $("#toast"); if (!el) { el = document.createElement("div"); el.id = "toast"; el.className = "toast"; el.setAttribute("role", "status"); document.body.append(el); }
  el.className = "toast " + kind; el.textContent = m; el.hidden = false;
  clearTimeout(toast.h); toast.h = setTimeout(() => (el.hidden = true), 2800);
}
export function busy(btn, on, label) {
  if (!btn) return;
  if (on) { btn.dataset.label = btn.innerHTML; btn.setAttribute("aria-busy", "true"); btn.innerHTML = `<span class="spin" aria-hidden="true"></span> ${esc(label || "…")}`; }
  else { btn.removeAttribute("aria-busy"); if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
}
export const state = (cls, text) => `${cls === "ok" ? ICON.check : cls === "no" ? ICON.x : ICON.info}<span>${text}</span>`;

/* ---------- trip card ---------- */
export function tripCard(tr) {
  const p = priceOf(tr), old = tr.old && CUR === "EGP" ? `<s class="num">${nf.format(tr.old)}</s>` : "";
  return `<article class="card reveal"><div class="media">${photo(tr.cover, { art: tr.art, alt: tr.title })}${tr.badge ? `<span class="badge ${tr.old ? "hot" : ""}">${esc(tr.badge)}</span>` : ""}<span class="dur">${ICON.clock} ${esc(tr.dur)}</span></div>
  <div class="card-body"><h3><a href="${href(`/trips/${tr.id}.html`)}">${esc(tr.title)}</a></h3><p class="route">${esc(tr.route)}</p><div class="inc">${(tr.inc || []).map(i => `<span>${esc(i)}</span>`).join("")}<span>${t.landCruiser}</span></div>
  <div class="card-foot"><div class="price"><small>${p == null ? t.price : t.from}</small><b class="num">${money(p)}</b>${old}</div>
  <div class="btns"><a class="btn btn-ghost" href="${href(`/trips/${tr.id}.html`)}">${t.details}</a><a class="btn btn-primary" href="${href(`/book/?trip=${tr.id}`)}">${p == null ? t.quote : t.book}</a></div></div></div></article>`;
}

/* ---------- init ---------- */
function initHeader() {
  const here = location.pathname.replace(/index\.html$/, "");
  $$("nav.main a, .mnav a").forEach(a => { const h = a.getAttribute("href"); if (h && !/^\/(ar\/)?$/.test(h) && !h.includes("#") && here.startsWith(h)) a.setAttribute("aria-current", "page"); });
  const btn = $(".menu-btn"), nav = $(".mnav");
  if (btn && nav) {
    const set = o => { nav.classList.toggle("open", o); btn.setAttribute("aria-expanded", String(o)); document.body.style.overflow = o ? "hidden" : ""; };
    btn.addEventListener("click", () => set(!nav.classList.contains("open")));
    nav.addEventListener("click", e => { if (e.target.closest("a")) set(false); });
    document.addEventListener("keydown", e => { if (e.key === "Escape") set(false); });
  }
  $$("[data-cur]").forEach(b => b.addEventListener("click", () => setCur(b.dataset.cur)));
  $$("[data-cur]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.cur === CUR)));
  // language switch keeps the same page
  $$("[data-lang-switch]").forEach(a => {
    const p = location.pathname + location.search;
    a.href = AR ? (p.replace(/^\/ar(?=\/)/, "") || "/") : "/ar" + p;
  });
}
function initChat() {
  if (!hasApi() || document.body.dataset.noChat !== undefined) return;
  const fab = document.createElement("button");
  fab.className = "chat-fab"; fab.type = "button"; fab.setAttribute("aria-label", t.chatOpen);
  fab.innerHTML = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01" stroke-width="2.6" stroke-linecap="round"/></svg><span class="dot"></span>`;
  document.body.append(fab);
  fab.addEventListener("click", async () => { const m = await import("./chat.js"); m.openChat(fab); });
}

document.documentElement.classList.remove("no-js");
initHeader(); wireWhatsApp(); reveal(); initChat();
