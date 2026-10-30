/* صفحة الرحلة: معرض الصور، الأسعار بالعملة المختارة، والتحقق من التوافر */
import { $, $$, getCatalog, photo, wireImages, money, onCurrency, CUR, hasApi, api, IMAGES, waLink } from "./app.js";
import { checkDateRules, cairoToday, addDays, quote, normalizeParty } from "../../shared/pricing.js";
import { POLICY } from "../../shared/catalog.js";

const id = document.body.dataset.trip;
let trip;

/* المعرض: انتقال ناعم بين الصور */
const main = $("#gMain"), cap = $("#gCap");
$$(".thumbs button").forEach(b => b.addEventListener("click", () => {
  const k = b.dataset.k; if (b.getAttribute("aria-pressed") === "true") return;
  $$(".thumbs button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
  const old = main.firstElementChild;
  main.insertAdjacentHTML("beforeend", photo(k, { art: trip?.art || "dunes", cls: "main" }).replace('loading="lazy"', ""));
  const nu = main.lastElementChild; nu.style.cssText = "position:absolute;inset:0";
  wireImages(main);
  cap.textContent = IMAGES[k]?.ar || "";
  const img = nu.querySelector("img");
  const done = () => setTimeout(() => old?.remove(), 650);
  img ? (img.complete ? done() : img.addEventListener("load", done, { once: true })) : done();
}));
main.style.position = "relative"; main.style.aspectRatio = "16/10"; main.style.borderRadius = "14px"; main.style.overflow = "hidden";

/* الأسعار */
function prices() {
  if (!trip) return;
  const base = trip.quoteOnly ? null : CUR === "EGP" ? trip.egp : trip.usd;
  $('[data-price="group"]').textContent = money(base);
  $('[data-price="private"]').textContent = money(base == null ? null : base * POLICY.privateMultiplier);
}

/* التوافر */
const dIn = $("#sDate"), pIn = $("#sPax"), box = $("#sAvail"), bookA = $("#sBook");
function setBox(cls, html) { box.className = "avail " + cls; box.innerHTML = html; }
let seq = 0;
async function check() {
  const date = dIn.value, adults = Number(pIn.value);
  bookA.href = `/book/?trip=${id}${date ? "&date=" + date : ""}&adults=${adults}`;
  if (!date || !trip) return setBox("", "اختار تاريخ وهنتأكد من التوافر");
  const r = checkDateRules(trip, date);
  if (!r.ok) return setBox("no", "✕ " + r.error);
  if (!hasApi()) {
    const q = quote(trip, normalizeParty({ adults, currency: CUR }).party);
    return setBox("", q ? `الإجمالي التقريبي لـ ${adults} كبار: <b class="num">&nbsp;${money(q.total)}</b> — التوافر النهائي بيتأكد مع الفريق` : "الرحلة دي بعرض سعر — ابعت طلبك وهنرد عليك");
  }
  const my = ++seq;
  setBox("", '<span class="spin" aria-hidden="true"></span> بنتأكد من الأماكن…');
  try {
    const a = await api("/api/availability", { tripId: id, date, party: { adults, currency: CUR } });
    if (my !== seq) return;
    if (a.quoteOnly) return setBox("ok", "✓ التاريخ مناسب — الرحلة دي بعرض سعر");
    if (!a.available) return setBox("no", "✕ " + (a.message || "مش متاح"));
    setBox("ok", `✓ متاح — فاضل ${a.seatsLeft} أماكن. الإجمالي: <b class="num">&nbsp;${money(a.quote.total)}</b>`);
  } catch (e) { if (my === seq) setBox("no", e.message); }
}
dIn.min = addDays(cairoToday(), POLICY.minNoticeDays);
dIn.addEventListener("change", check); pIn.addEventListener("change", check);

getCatalog().then(c => {
  trip = c.trips.find(t => t.id === id);
  if (!trip) { setBox("no", "الرحلة دي مش متاحة للحجز دلوقتي"); bookA.hidden = true; return; }
  dIn.min = addDays(cairoToday(), trip.leadDays || POLICY.minNoticeDays);
  prices(); check();
});
onCurrency(() => { prices(); check(); });
