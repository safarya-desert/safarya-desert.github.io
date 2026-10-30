/* الكود المشترك لكل الصفحات */
import { CONFIG } from "./config.js";
import { IMAGES } from "./images.js";
import { artSVG } from "./art.js";
import * as CAT from "../../shared/catalog.js";
import { formatMoney } from "../../shared/pricing.js";

export { CONFIG, IMAGES };
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const nf = new Intl.NumberFormat("ar-EG");
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const hasApi = () => !!CONFIG.API_BASE;

/* ---------- العملة ---------- */
export let CUR = "EGP";
try { const c = localStorage.getItem("sd-cur"); if (c === "USD" || c === "EGP") CUR = c; } catch {}
const curListeners = [];
export const onCurrency = fn => curListeners.push(fn);
export function setCur(c) {
  CUR = c; try { localStorage.setItem("sd-cur", c); } catch {}
  $$("[data-cur]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.cur === c)));
  curListeners.forEach(f => f(c));
}
export const money = (v, cur = CUR) => formatMoney(v, cur);
export const priceOf = t => (t.quoteOnly ? null : CUR === "EGP" ? t.egp : t.usd);

/* ---------- الاتصال بالسيرفر ---------- */
export class ApiError extends Error { constructor(status, data) { super(data?.message || "حصلت مشكلة في الاتصال"); this.status = status; this.data = data || {}; } }
export async function api(path, body, { method, timeout = 20000, token } = {}) {
  if (!hasApi()) throw new ApiError(0, { error: "no_api", message: "الحجز الأونلاين مش متفعّل لسه" });
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const headers = {}; if (body !== undefined) headers["content-type"] = "application/json"; if (token) headers.authorization = "Bearer " + token;
    const r = await fetch(CONFIG.API_BASE.replace(/\/$/, "") + path, { method: method || (body === undefined ? "GET" : "POST"), headers, body: body === undefined ? undefined : JSON.stringify(body), signal: ctrl.signal });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new ApiError(r.status, data);
    return data;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(0, { error: "network", message: e.name === "AbortError" ? "السيرفر اتأخر في الرد، جرّب تاني" : "مفيش اتصال بالسيرفر دلوقتي، جرّب تاني بعد شوية" });
  } finally { clearTimeout(t); }
}

/* البيانات: من السيرفر لو متاح (عشان تعديلات لوحة الإدارة تظهر)، وإلا من الملف الثابت */
let catalogP;
export function getCatalog() {
  if (catalogP) return catalogP;
  const local = { trips: CAT.TRIPS, reserves: CAT.RESERVES, faq: CAT.FAQ, policy: CAT.POLICY, whatsapp: null, source: "static" };
  catalogP = hasApi() ? api("/api/catalog", undefined, { timeout: 6000 }).then(d => ({ ...d, source: "api" })).catch(() => local) : Promise.resolve(local);
  return catalogP;
}
export { CAT };

/* ---------- واتساب ---------- */
let WA = CONFIG.WHATSAPP || "";
getCatalog().then(c => { if (!WA && c.whatsapp) { WA = c.whatsapp; wireWhatsApp(); } });
export const waNumber = () => WA;
export const waLink = text => WA ? `https://wa.me/${WA}${text ? "?text=" + encodeURIComponent(text) : ""}` : null;
export const waDisplay = () => WA ? "+" + WA.replace(/^(\d{2})(\d{2})(\d{4})(\d+)$/, "$1 $2 $3 $4") : "";
function wireWhatsApp() {
  $$("[data-wa]").forEach(a => {
    const l = waLink(a.dataset.wa || "");
    if (l) { a.href = l; a.target = "_blank"; a.rel = "noopener"; a.hidden = false; }
    else if (a.dataset.waHide !== undefined) a.hidden = true;
    else a.href = "/contact/";
  });
  $$("[data-wa-num]").forEach(el => { el.textContent = waDisplay() || "هيتضاف قريب"; });
}

/* ---------- الصور ---------- */
const COMMONS = f => "https://commons.wikimedia.org/wiki/File:" + encodeURIComponent(f.replace(/ /g, "_"));
export function imgInfo(key) { const i = IMAGES[key]; return i && i.src && !i.pending ? i : null; }
/** صورة حقيقية فوق رسم توضيحي احتياطي + اسم المصوّر والترخيص */
export function photo(key, { art = "dunes", alt, eager = false, credit = true, cls = "", sizes } = {}) {
  const i = imgInfo(key);
  const fallback = artSVG(art);
  if (!i) return `<div class="ph ${cls}">${fallback}<span class="illus">رسم توضيحي</span></div>`;
  const a = esc(alt || i.ar);
  return `<div class="ph ${cls}" data-fallback="${art}">${fallback}<img src="${esc(i.src)}" alt="${a}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" width="${i.w > i.h ? 1280 : Math.round(1280 * i.w / i.h)}" height="${i.w > i.h ? Math.round(1280 * i.h / i.w) : 1280}" ${sizes ? `sizes="${sizes}"` : ""} referrerpolicy="no-referrer">${credit ? `<a class="credit" href="${COMMONS(i.file)}" target="_blank" rel="noopener" title="${esc(i.ar)} — ${esc(i.author)} — ${esc(i.license)}">© ${esc(i.author)} · ${esc(i.license)}</a>` : ""}</div>`;
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

/* ---------- الحركة: ظهور مع التمرير ---------- */
const io = "IntersectionObserver" in window ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px", threshold: .08 }) : null;
export function reveal(root = document) {
  $$(".reveal:not(.in)", root).forEach((el, i) => { if (!el.style.getPropertyValue("--d")) el.style.setProperty("--d", String(i % 6)); io ? io.observe(el) : el.classList.add("in"); });
  wireImages(root);
}

/* ---------- رسائل ---------- */
export function toast(m, kind = "") {
  let t = $("#toast"); if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role", "status"); document.body.append(t); }
  t.className = "toast " + kind; t.textContent = m; t.hidden = false;
  clearTimeout(toast.h); toast.h = setTimeout(() => (t.hidden = true), 2800);
}
export function busy(btn, on, label) {
  if (!btn) return;
  if (on) { btn.dataset.label = btn.innerHTML; btn.setAttribute("aria-busy", "true"); btn.innerHTML = `<span class="spin" aria-hidden="true"></span> ${esc(label || "لحظة…")}`; }
  else { btn.removeAttribute("aria-busy"); if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
}

/* ---------- كارت الرحلة ---------- */
export function tripCard(t) {
  const p = priceOf(t), old = t.old && CUR === "EGP" ? `<s class="num">${nf.format(t.old)}</s>` : "";
  return `<article class="card reveal"><div class="media">${photo(t.cover, { art: t.art, alt: t.title })}${t.badge ? `<span class="badge ${t.badge === "عرض الموسم" ? "hot" : ""}">${esc(t.badge)}</span>` : ""}<span class="dur">${esc(t.dur)}</span></div>
  <div class="card-body"><h3><a href="/trips/${t.id}.html">${esc(t.title)}</a></h3><p class="route">${esc(t.route)}</p><div class="inc">${(t.inc || []).map(i => `<span>${esc(i)}</span>`).join("")}<span>لاند كروزر</span></div>
  <div class="card-foot"><div class="price"><small>${p == null ? "السعر" : "يبدأ من / للفرد"}</small><b class="num">${money(p)}</b>${old}</div>
  <div class="btns"><a class="btn btn-ghost" href="/trips/${t.id}.html">التفاصيل</a><a class="btn btn-primary" href="/book/?trip=${t.id}">${p == null ? "اطلب عرض" : "احجز"}</a></div></div></div></article>`;
}

/* ---------- تشغيل مشترك ---------- */
function initHeader() {
  const here = location.pathname.replace(/index\.html$/, "");
  $$("nav.main a, .mnav a").forEach(a => { const h = a.getAttribute("href"); if (h !== "/" && here.startsWith(h)) a.setAttribute("aria-current", "page"); });
  const btn = $(".menu-btn"), nav = $(".mnav");
  if (btn && nav) {
    const set = o => { nav.classList.toggle("open", o); btn.setAttribute("aria-expanded", String(o)); document.body.style.overflow = o ? "hidden" : ""; };
    btn.addEventListener("click", () => set(!nav.classList.contains("open")));
    nav.addEventListener("click", e => { if (e.target.closest("a")) set(false); });
    document.addEventListener("keydown", e => { if (e.key === "Escape") set(false); });
  }
  $$("[data-cur]").forEach(b => b.addEventListener("click", () => setCur(b.dataset.cur)));
  $$("[data-cur]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.cur === CUR)));
}
function initChat() {
  if (!hasApi() || document.body.dataset.noChat !== undefined) return;
  const fab = document.createElement("button");
  fab.className = "chat-fab"; fab.type = "button"; fab.setAttribute("aria-label", "افتح مساعد الحجز");
  fab.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01" stroke-width="3" stroke-linecap="round"/></svg><span class="dot"></span>`;
  document.body.append(fab);
  fab.addEventListener("click", async () => { const m = await import("./chat.js"); m.openChat(fab); }, { once: false });
}

document.documentElement.classList.remove("no-js");
initHeader(); wireWhatsApp(); reveal(); initChat();
