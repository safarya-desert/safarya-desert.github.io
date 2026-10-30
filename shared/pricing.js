/* حساب الأسعار والتواريخ — نفس الكود بيشتغل في المتصفح وفي السيرفر
   عشان السعر اللي العميل بيشوفه هو نفس السعر اللي بيتسجل. */
import { POLICY } from "./catalog.js";

export const CURRENCIES = ["EGP", "USD"];

/** تاريخ النهارده بتوقيت القاهرة بصيغة YYYY-MM-DD */
export function cairoToday(now = new Date()) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return p; // en-CA => YYYY-MM-DD
}

export function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromIso, toIso) {
  return Math.round((Date.parse(toIso + "T00:00:00Z") - Date.parse(fromIso + "T00:00:00Z")) / 864e5);
}

export function isIsoDate(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;
}

const int = (v, min, max) => {
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < min || n > max) return null;
  return n;
};

/** ينضّف ويتحقق من بيانات المجموعة. بيرجع {ok, party | error} */
export function normalizeParty(input = {}) {
  const adults = int(input.adults ?? 1, 1, POLICY.maxPartySize);
  const kidsSmall = int(input.kidsSmall ?? 0, 0, 12);
  const kids = int(input.kids ?? 0, 0, 12);
  const infants = int(input.infants ?? 0, 0, 6);
  if (adults == null) return { ok: false, error: "عدد الكبار لازم يكون من ١ لـ " + POLICY.maxPartySize };
  if (kidsSmall == null || kids == null || infants == null) return { ok: false, error: "عدد الأطفال مش صحيح" };
  if (adults + kidsSmall + kids > POLICY.maxPartySize) return { ok: false, error: "أقصى عدد في الحجز الواحد " + POLICY.maxPartySize + " فرد — كلّمنا لمجموعات أكبر" };
  const tier = input.tier === "private" ? "private" : "group";
  const stay = input.stay === "up" ? "up" : "std";
  const currency = input.currency === "USD" ? "USD" : "EGP";
  return { ok: true, party: { adults, kidsSmall, kids, infants, tier, stay, currency } };
}

/** عدد المقاعد اللي الحجز بياخدها (الرضّع على الحِجر ومش بياخدوا كرسي).
    الرحلة الخاصة بتاخد عربيات كاملة. */
export function seatsNeeded(p) {
  const people = p.adults + p.kidsSmall + p.kids;
  if (p.tier === "private") return Math.ceil(people / POLICY.carCapacity) * POLICY.carCapacity;
  return people;
}

/** حساب السعر. بيرجع null لو الرحلة بعرض سعر بس. */
export function quote(trip, p) {
  const base = p.currency === "USD" ? trip.usd : trip.egp;
  if (base == null || trip.quoteOnly) return null;
  const pp = base * (p.tier === "private" ? POLICY.privateMultiplier : 1);
  const lines = [];
  const adults = pp * p.adults;
  lines.push({ key: "adults", label: `${p.adults} كبار`, unit: pp, qty: p.adults, amount: adults });
  const kidsSmall = pp * POLICY.kidsSmallRate * p.kidsSmall;
  if (p.kidsSmall) lines.push({ key: "kidsSmall", label: `${p.kidsSmall} أطفال ٢–٥ سنين (٢٥٪)`, unit: pp * POLICY.kidsSmallRate, qty: p.kidsSmall, amount: kidsSmall });
  const kids = pp * POLICY.kidsRate * p.kids;
  if (p.kids) lines.push({ key: "kids", label: `${p.kids} أطفال ٦–١١ سنة (٥٠٪)`, unit: pp * POLICY.kidsRate, qty: p.kids, amount: kids });
  if (p.infants) lines.push({ key: "infants", label: `${p.infants} رضّع أقل من سنتين (مجانًا)`, unit: 0, qty: p.infants, amount: 0 });
  const sub = adults + kidsSmall + kids;
  const upgrade = p.stay === "up" ? sub * POLICY.upgradeRate : 0;
  if (upgrade) lines.push({ key: "upgrade", label: "ترقية الإقامة (+١٥٪)", unit: null, qty: 1, amount: upgrade });
  const total = Math.round(sub + upgrade);
  const deposit = Math.round(total * POLICY.depositRate);
  return { currency: p.currency, perPerson: Math.round(pp), lines: lines.map(l => ({ ...l, unit: l.unit == null ? null : Math.round(l.unit), amount: Math.round(l.amount) })), total, deposit };
}

/** التحقق من التاريخ حسب سياسة الرحلة (أقل مدة، الموسم). */
export function checkDateRules(trip, date, today = cairoToday()) {
  if (!isIsoDate(date)) return { ok: false, code: "bad_date", error: "التاريخ مش صحيح" };
  const lead = trip.leadDays || POLICY.minNoticeDays;
  const min = addDays(today, lead);
  if (date < min) return { ok: false, code: "too_soon", error: `أقرب تاريخ متاح للرحلة دي ${min} (لازم ${lead} أيام على الأقل)`, minDate: min };
  if (date > addDays(today, 365)) return { ok: false, code: "too_far", error: "الحجز متاح لحد سنة قدام بس" };
  const m = Number(date.slice(5, 7));
  if (Array.isArray(trip.months) && trip.months.length && !trip.months.includes(m))
    return { ok: false, code: "off_season", error: "الرحلة دي مش شغالة في الشهر ده بسبب الموسم", months: trip.months };
  return { ok: true };
}

/** نسبة الاسترداد حسب سياسة الإلغاء */
export function refundFor(tripDate, today = cairoToday()) {
  const days = daysBetween(today, tripDate);
  for (const t of POLICY.cancellation) if (days >= t.minDays) return { days, refund: t.refund, label: t.label };
  return { days, refund: 0, label: "الرحلة بدأت أو عدّت" };
}

/** توحيد رقم الموبايل لصيغة دولية من غير + (مصر افتراضيًا) */
export function normalizePhone(raw) {
  if (typeof raw !== "string") return null;
  let s = raw.replace(/[\s\-().]/g, "").replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
  if (s.startsWith("+")) s = s.slice(1);
  else if (s.startsWith("00")) s = s.slice(2);
  if (/^01[0125]\d{8}$/.test(s)) s = "2" + s;
  if (/^1[0125]\d{8}$/.test(s)) s = "20" + s;
  if (!/^\d{9,15}$/.test(s)) return null;
  if (s.startsWith("20") && !/^201[0125]\d{8}$/.test(s)) return null;
  return s;
}

export function formatMoney(v, currency = "EGP") {
  if (v == null) return "عند الطلب";
  const nf = new Intl.NumberFormat("ar-EG");
  return currency === "USD" ? "$" + nf.format(Math.round(v)) : nf.format(Math.round(v)) + " ج.م";
}
