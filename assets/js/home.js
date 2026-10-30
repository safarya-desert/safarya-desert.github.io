/* الصفحة الرئيسية: شرائح الهيرو + الرحلات + البحث */
import { $, $$, getCatalog, tripCard, reveal, onCurrency, setCur } from "./app.js";
import { cairoToday, addDays } from "../../shared/pricing.js";

/* شرائح الهيرو: كل ٦ ثواني، وتقف لو المستخدم مفضّل حركة أقل */
const slides = $$("#slides .slide"), dots = $$("#dots button"), place = $("#heroPlace");
let cur = 0, timer;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
function load(s) { const im = s.querySelector("img[data-src]"); if (im) { im.src = im.dataset.src; im.removeAttribute("data-src"); } }
function show(i) {
  const next = slides[i]; load(next);
  const go = () => {
    slides[cur].classList.remove("on"); next.classList.add("on");
    dots.forEach((d, j) => d.setAttribute("aria-current", String(j === i)));
    place.innerHTML = `${next.dataset.place} — <a href="${next.dataset.href}" target="_blank" rel="noopener">© ${next.dataset.credit}</a>`;
    cur = i; load(slides[(i + 1) % slides.length]);
  };
  const im = next.querySelector("img");
  im.complete && im.naturalWidth ? go() : im.addEventListener("load", go, { once: true });
}
function auto() { clearInterval(timer); if (!reduce) timer = setInterval(() => show((cur + 1) % slides.length), 6500); }
dots.forEach((d, i) => d.addEventListener("click", () => { show(i); auto(); }));
if (slides.length > 1) { setTimeout(() => load(slides[1]), 2500); auto(); }
document.addEventListener("visibilitychange", () => (document.hidden ? clearInterval(timer) : auto()));

/* أقل تاريخ للبحث (بتوقيت القاهرة) */
const min = addDays(cairoToday(), 3);
$("#fDate").min = min;

/* الرحلات + الفلاتر */
let FILTER = "all", TRIPS = [];
function render() {
  const list = TRIPS.filter(t => FILTER === "all" || t.cat === FILTER);
  $("#tripGrid").innerHTML = list.map(tripCard).join("") || `<div class="empty">مفيش رحلات بالاختيار ده دلوقتي.</div>`;
  reveal($("#tripGrid"));
}
$$(".chip").forEach(b => b.addEventListener("click", () => { FILTER = b.dataset.f; $$(".chip").forEach(x => x.setAttribute("aria-pressed", String(x === b))); render(); }));
getCatalog().then(c => { TRIPS = c.trips; render(); });
onCurrency(render);
