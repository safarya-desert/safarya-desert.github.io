/* صفحة كل الرحلات: بحث + تصفية + ترتيب، ومتزامنة مع الرابط */
import { $, $$, getCatalog, tripCard, reveal, onCurrency, CUR, nf } from "./app.js";

const params = new URLSearchParams(location.search);
const st = { q: params.get("q") || "", dest: params.get("dest") || "", month: params.get("month") || "", sort: params.get("sort") || "", cat: params.get("cat") || "all" };
const date = params.get("date"), pax = params.get("pax");
if (date && !st.month) st.month = String(Number(date.slice(5, 7)));
let TRIPS = [];

const norm = s => String(s || "").toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");
function render() {
  const words = norm(st.q).split(/\s+/).filter(Boolean);
  let list = TRIPS.filter(t => (st.cat === "all" || t.cat === st.cat) && (!st.dest || t.dest === st.dest) && (!st.month || !t.months || t.months.includes(Number(st.month)))
    && (!words.length || words.every(w => norm([t.title, t.titleEn, t.route, t.summary, ...(t.inc || [])].join(" ")).includes(w))));
  const price = t => (t.quoteOnly ? 1e9 : CUR === "EGP" ? t.egp : t.usd);
  if (st.sort === "price") list = [...list].sort((a, b) => price(a) - price(b));
  if (st.sort === "days") list = [...list].sort((a, b) => a.days - b.days);
  $("#count").textContent = `${nf.format(list.length)} رحلة`;
  $("#tripGrid").innerHTML = list.map(t => tripCard(t).replace(`/book/?trip=${t.id}"`, `/book/?trip=${t.id}${date ? "&date=" + date : ""}${pax ? "&adults=" + pax : ""}"`)).join("")
    || `<div class="empty">مفيش رحلة مطابقة. جرّب تشيل فلتر، أو <a href="/contact/">كلّمنا</a> ونعملك رحلة مخصوصة.</div>`;
  reveal($("#tripGrid"));
  const u = new URLSearchParams(Object.entries({ ...st, date, pax }).filter(([k, v]) => v && v !== "all"));
  history.replaceState(null, "", "?" + u.toString());
}
$("#q").value = st.q; $("#dest").value = st.dest; $("#month").value = st.month; $("#sort").value = st.sort;
$$(".chip").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.f === st.cat)));
let deb; $("#q").addEventListener("input", e => { clearTimeout(deb); deb = setTimeout(() => { st.q = e.target.value; render(); }, 180); });
["dest", "month", "sort"].forEach(id => $("#" + id).addEventListener("change", e => { st[id] = e.target.value; render(); }));
$$(".chip").forEach(b => b.addEventListener("click", () => { st.cat = b.dataset.f; $$(".chip").forEach(x => x.setAttribute("aria-pressed", String(x === b))); render(); }));
getCatalog().then(c => { TRIPS = c.trips; render(); });
onCurrency(render);
