/* Trip page: gallery, prices in the chosen currency, availability check */
import { $, $$, getCatalog, photo, wireImages, money, onCurrency, CUR, hasApi, api, placeName, href, t, state, AR } from "./app.js";
import { checkDateRules, cairoToday, addDays, quote, normalizeParty } from "../../shared/pricing.js";
import { POLICY } from "../../shared/catalog.js";
import { errText } from "./i18n.js";

const id = document.body.dataset.trip;
let trip;

/* gallery cross-fade */
const main = $("#gMain"), cap = $("#gCap");
$$(".thumbs button").forEach(b => b.addEventListener("click", () => {
  const k = b.dataset.k; if (b.getAttribute("aria-pressed") === "true") return;
  $$(".thumbs button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
  const old = main.lastElementChild;
  main.insertAdjacentHTML("beforeend", photo(k, { art: trip?.art || "dunes" }).replace('loading="lazy"', ""));
  wireImages(main);
  cap.textContent = placeName(k);
  const img = main.lastElementChild.querySelector("img");
  const done = () => setTimeout(() => { while (main.children.length > 1) main.firstElementChild.remove(); }, 700);
  img ? (img.complete ? done() : img.addEventListener("load", done, { once: true })) : done();
  void old;
}));

function prices() {
  if (!trip) return;
  const base = trip.quoteOnly ? null : CUR === "EGP" ? trip.egp : trip.usd;
  $('[data-price="group"]').textContent = money(base);
  $('[data-price="private"]').textContent = money(base == null ? null : base * POLICY.privateMultiplier);
}

const dIn = $("#sDate"), pIn = $("#sPax"), box = $("#sAvail"), bookA = $("#sBook");
const setBox = (cls, html) => { box.className = "avail " + cls; box.innerHTML = cls ? state(cls, html) : html; };
let seq = 0;
async function check() {
  const date = dIn.value, adults = Number(pIn.value);
  bookA.href = href(`/book/?trip=${id}${date ? "&date=" + date : ""}&adults=${adults}`);
  if (!date || !trip) return setBox("", t.pickDate);
  const r = checkDateRules(trip, date);
  if (!r.ok) return setBox("no", errText(r.code, r, r.error));
  if (!hasApi()) {
    const q = quote(trip, normalizeParty({ adults, currency: CUR }).party);
    return setBox("", q ? t.estimate(adults, money(q.total)) : t.estimateQuote);
  }
  const my = ++seq;
  setBox("", `<span class="spin" aria-hidden="true"></span> ${t.checking}`);
  try {
    const a = await api("/api/availability", { tripId: id, date, party: { adults, currency: CUR } });
    if (my !== seq) return;
    if (a.quoteOnly) return setBox("ok", t.quoteOk);
    if (!a.available) return setBox("no", errText(a.reason, a, a.message));
    setBox("ok", t.available(a.seatsLeft, money(a.quote.total)));
  } catch (e) { if (my === seq) setBox("no", e.message); }
}
dIn.min = addDays(cairoToday(), POLICY.minNoticeDays);
dIn.addEventListener("change", check); pIn.addEventListener("change", check);

getCatalog().then(c => {
  trip = c.trips.find(x => x.id === id);
  if (!trip) { setBox("no", t.tripUnavailable); bookA.hidden = true; return; }
  dIn.min = addDays(cairoToday(), trip.leadDays || POLICY.minNoticeDays);
  prices(); check();
});
onCurrency(() => { prices(); check(); });
void AR;
