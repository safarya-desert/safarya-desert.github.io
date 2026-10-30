/* Language layer: English (default, at /) and Arabic (at /ar/) */
import * as CAT from "../../shared/catalog.js";
import * as EN from "../../shared/catalog-en.js";

export const LANG = document.documentElement.lang === "ar" ? "ar" : "en";
export const AR = LANG === "ar";
export const BASE = AR ? "/ar/" : "/";
export const href = p => (AR ? "/ar" : "") + p;

/* SVG icons (no emoji anywhere on the site) */
const I = (d, w = 18) => `<svg class="ico" width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const ICON = {
  check: I('<path d="M20 6 9 17l-5-5"/>'), x: I('<path d="M18 6 6 18M6 6l12 12"/>'), info: I('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
  clock: I('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'), car: I('<path d="M3 16h18M5 16l2-6h10l2 6M7 19.5a1.5 1.5 0 1 0 0-.1M17 19.5a1.5 1.5 0 1 0 0-.1"/>'),
  users: I('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.7c1.9.7 3.1 2.4 3.5 5.3"/>'),
  pin: I('<path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>'), doc: I('<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>'),
  moon: I('<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>'),
};

const T = {
  en: {
    from: "From / person", price: "Price", onRequest: "On request", details: "Details", book: "Book", quote: "Request quote", landCruiser: "Land Cruiser",
    noTrips: "No trips match this filter.", tripsCount: n => `${n} ${n === 1 ? "trip" : "trips"}`, noMatch: 'No trip matches. Try removing a filter, or <a href="/contact/">contact us</a> for a tailor-made trip.',
    pickDate: "Choose a date and we'll check availability", checking: "Checking availability…", available: (left, total) => `Available — ${left} places left. Total: <b class="num">&nbsp;${total}</b>`,
    availShort: (left, need) => `Available — ${left} places left (you need ${need})`, quoteOk: "Date works — this trip is priced on request", estimate: (n, total) => `Estimated total for ${n} adults: <b class="num">&nbsp;${total}</b> — our team confirms availability`,
    estimateQuote: "This trip is priced on request — send a request and we'll reply", tripUnavailable: "This trip isn't open for booking right now", dateOkStatic: "The date fits this trip's season — our team will confirm availability.",
    seats: n => `${n} left`, availDay: "available", unavailDay: "unavailable", open: "open",
    modeApi: "Your booking is recorded instantly and you get a reference number. The calendar shows real availability.",
    modeStatic: "Online booking is being set up: we'll prepare your booking request to send on WhatsApp, and our team confirms availability and replies with your reference.",
    submitApi: "Reserve my places", submitStatic: "Prepare booking request", saving: "Reserving…",
    errName: "Please enter your full name", errPhone: "Please enter a valid phone number with country code, e.g. +44 7700 900123", errDate: "Please choose a travel date", errConsent: "Please accept the terms and privacy policy",
    checkFields: "Please check the highlighted fields", notSaved: "The booking wasn't saved", copied: "Message copied", copyManual: "Please copy the message manually",
    waReady: "Your booking request is ready", waReadyP: "Send it on WhatsApp and our team will confirm availability, then reply with your booking reference and deposit details. <b>The request is not a booking until we confirm it.</b>",
    copyMsg: "Copy message", openWa: "Open WhatsApp and send", waMissing: "WhatsApp number coming soon — contact us", viewBooking: "view booking", orWa: "or send the request on WhatsApp",
    private: "Private", group: "Shared group", premium: "Premium upgrade", standard: "Standard", privateTrip: "Private trip", groupTrip: "Shared group trip",
    quoteNote: "This trip is priced on request, depending on group size and permits", afterQuote: "After the quote",
    linesAdults: n => `${n} adult${n > 1 ? "s" : ""}`, linesKidsSmall: n => `${n} child${n > 1 ? "ren" : ""} aged 2–5 (25%)`, linesKids: n => `${n} child${n > 1 ? "ren" : ""} aged 6–11 (50%)`, linesInfants: n => `${n} infant${n > 1 ? "s" : ""} under 2 (free)`, linesUpgrade: "Premium accommodation (+15%)",
    waMsg: "Booking request – Starfall Desert", waTrip: "Trip", waDate: "Date", waType: "Type", waStay: "Stay", waPeople: "Travellers", waTotal: "Expected total", waDeposit: "Deposit", waName: "Name", waPhone: "Phone", waNotes: "Notes", adultsW: "adults", kidsW: "children 6–11", kidsSmallW: "children 2–5", infantsW: "infants",
    waAsk: "Hello, I'd like to ask about a trip", waAskTrip: t => `Hello, I'd like to ask about the "${t}" trip`,
    /* booking page */
    bookedTitle: "Your places are reserved", quoteTitle: "Your quote request is in", keepRef: "Keep this reference — you'll need it with your phone number to manage your booking.",
    ref: "Reference", name: "Name", date: "Date", travellers: "Travellers", type: "Type", total: "Total", deposit: "Deposit (30%)", heldUntil: "Places held until", refund: "Refund due",
    nextStep: "Next step: we'll send you deposit details on WhatsApp. Your booking is confirmed once the deposit arrives.", hurry: "Need it sooner?", sendWa: "Message us on WhatsApp",
    expired: "The 48-hour hold expired without a deposit, so the places may have been released.", bookAgain: "Book again", cancelTitle: "Cancel booking",
    cancelFree: "Your booking is still provisional and no deposit has been paid, so you can cancel free of charge.", cancelRefund: (d, l, a) => `${d} days before the trip: ${l} (${a}).`, cancelLate: "Less than 3 days before the trip: online cancellation isn't available, but you can move your date within 6 months — please contact us.",
    cancelBtn: "Yes, cancel my booking", sure: "Are you sure? Click again to confirm", cancelling: "Cancelling…", cancelled: "Booking cancelled", lookingUp: "Looking up…", enterBoth: "Enter your booking reference and phone number",
    trackOff: "Online booking management will be available once the booking system is live. Until then,", trackWa: "message us on WhatsApp", trackContact: "contact us",
    status: { pending: "Awaiting deposit", confirmed: "Confirmed", cancelled: "Cancelled", completed: "Completed", quote: "Quote requested", expired: "Hold expired" },
    refundLabels: ["Full refund", "50% refund", "Date change only"],
    sending: "Sending…", contactThanks: "We've received your message", contactReply: p => `We'll get back to you on ${p} shortly.`, contactWaOpened: "WhatsApp opened with your message — press send there", contactOff: "The contact form is being set up and our WhatsApp number will be added soon.", sendInsteadWa: "send it on WhatsApp instead",
    errContact: { name: "Please enter your name", phone: "Please enter a valid phone number", msg: "Please write your message", consent: "Please accept the privacy policy" },
    /* chat */
    chatOpen: "Open booking assistant", chatTitle: "Starfall assistant", chatSub: "Instant answers · a human when you need one", chatClose: "Close chat", chatPlaceholder: "Ask a question or tell us your plans…", chatYour: "Your message", chatSend: "Send",
    chatFine: 'Chats are stored to improve our service — <a href="/privacy/">privacy</a>. Never share card details.',
    chatHello: "Welcome to Starfall Desert. I'm the booking assistant — tell me where you'd like to go, when, and how many of you are travelling, and I'll show you what's available, the price, and book it for you.",
    chatQuick: ["Day trips from Cairo", "Siwa trips and prices", "What's available next month?", "Check my booking"],
    chatBooked: r => `Booking ${r} has been recorded — you can track it on the Manage booking page.`, chatHuman: l => `You can continue with our team on ${l}`, chatTooMany: "Too many messages — please wait a minute and try again.", chatOr: l => ` — or message us on ${l}`,
    chatTyping: "The assistant is typing", whatsapp: "WhatsApp", tripPage: "trip page",
    numbers: "en-US",
    people: p => [`${p.adults} adult${p.adults > 1 ? "s" : ""}`, p.kids && `${p.kids} child${p.kids > 1 ? "ren" : ""} aged 6–11`, p.kidsSmall && `${p.kidsSmall} child${p.kidsSmall > 1 ? "ren" : ""} aged 2–5`, p.infants && `${p.infants} infant${p.infants > 1 ? "s" : ""}`].filter(Boolean).join(", "),
  },
  ar: {
    from: "يبدأ من / للفرد", price: "السعر", onRequest: "عند الطلب", details: "التفاصيل", book: "احجز", quote: "اطلب عرض", landCruiser: "لاند كروزر",
    noTrips: "مفيش رحلات بالاختيار ده دلوقتي.", tripsCount: n => `${new Intl.NumberFormat("ar-EG").format(n)} رحلة`, noMatch: 'مفيش رحلة مطابقة. جرّب تشيل فلتر، أو <a href="/ar/contact/">كلّمنا</a> ونعملك رحلة مخصوصة.',
    pickDate: "اختار تاريخ وهنتأكد من التوافر", checking: "بنتأكد من الأماكن…", available: (left, total) => `متاح — فاضل ${left} أماكن. الإجمالي: <b class="num">&nbsp;${total}</b>`,
    availShort: (left, need) => `متاح — فاضل ${left} أماكن (حجزك محتاج ${need})`, quoteOk: "التاريخ مناسب — الرحلة دي بعرض سعر", estimate: (n, total) => `الإجمالي التقريبي لـ ${n} كبار: <b class="num">&nbsp;${total}</b> — التوافر النهائي بيتأكد مع الفريق`,
    estimateQuote: "الرحلة دي بعرض سعر — ابعت طلبك وهنرد عليك", tripUnavailable: "الرحلة دي مش متاحة للحجز دلوقتي", dateOkStatic: "التاريخ مناسب لموسم الرحلة — الفريق هيأكد الأماكن المتاحة.",
    seats: n => `${new Intl.NumberFormat("ar-EG").format(n)} مكان`, availDay: "متاح", unavailDay: "مش متاح", open: "متاح",
    modeApi: "الحجز بيتسجل فورًا في نظامنا ويوصلك رقم حجز تتابع بيه. التواريخ في التقويم بتوضح الأماكن الفاضية فعلًا.",
    modeStatic: "الحجز الأونلاين الكامل لسه بيتجهز: هنجهزلك رسالة الحجز تبعتها على واتساب، وفريقنا بيتأكد من التوافر ويرد عليك برقم الحجز.",
    submitApi: "أكّد الحجز المبدئي", submitStatic: "جهّز رسالة الحجز", saving: "بنسجّل حجزك…",
    errName: "اكتب اسمك بالكامل", errPhone: "اكتب رقم موبايل صحيح، مثلًا 01012345678", errDate: "اختار تاريخ السفر", errConsent: "لازم توافق على الشروط وسياسة الخصوصية",
    checkFields: "راجع البيانات المطلوبة", notSaved: "الحجز ماتسجّلش", copied: "اتنسخت الرسالة", copyManual: "انسخ الرسالة يدوي",
    waReady: "رسالة طلب الحجز جاهزة", waReadyP: "ابعتها على واتساب، وفريقنا هيتأكد من الأماكن ويرد عليك برقم الحجز وبيانات دفع المقدم. <b>الطلب مش بيتحسب حجز لحد ما الفريق يأكده.</b>",
    copyMsg: "انسخ الرسالة", openWa: "افتح واتساب وابعت", waMissing: "رقم الواتساب لسه هيتضاف — تواصل معانا", viewBooking: "اعرض الحجز", orWa: "أو ابعت الطلب على واتساب",
    private: "خاصة", group: "مجموعة", premium: "ترقية فاخرة", standard: "قياسية", privateTrip: "رحلة خاصة", groupTrip: "رحلة مجموعة",
    quoteNote: "الرحلة دي بعرض سعر حسب حجم المجموعة والتصاريح", afterQuote: "بعد عرض السعر",
    linesAdults: n => `${n} كبار`, linesKidsSmall: n => `${n} أطفال ٢–٥ سنين (٢٥٪)`, linesKids: n => `${n} أطفال ٦–١١ سنة (٥٠٪)`, linesInfants: n => `${n} رضّع أقل من سنتين (مجانًا)`, linesUpgrade: "ترقية الإقامة (+١٥٪)",
    waMsg: "طلب حجز – ستارفول ديزرت", waTrip: "الرحلة", waDate: "التاريخ", waType: "النوع", waStay: "الإقامة", waPeople: "الأفراد", waTotal: "الإجمالي المتوقع", waDeposit: "المقدم", waName: "الاسم", waPhone: "الموبايل", waNotes: "ملاحظات", adultsW: "كبار", kidsW: "أطفال ٦–١١", kidsSmallW: "أطفال ٢–٥", infantsW: "رضّع",
    waAsk: "أهلًا، عايز أستفسر عن رحلة", waAskTrip: t => `أهلًا، عايز أستفسر عن رحلة «${t}»`,
    bookedTitle: "اتسجل حجزك المبدئي", quoteTitle: "اتسجل طلب عرض السعر", keepRef: "احتفظ برقم الحجز ده — هتحتاجه مع رقم موبايلك لمتابعة الحجز.",
    ref: "رقم الحجز", name: "الاسم", date: "التاريخ", travellers: "الأفراد", type: "النوع", total: "الإجمالي", deposit: "المقدم (٣٠٪)", heldUntil: "المكان محجوز لحد", refund: "المبلغ المسترد",
    nextStep: "الخطوة الجاية: فريقنا هيبعتلك بيانات دفع المقدم على واتساب. الحجز بيتأكد بعد استلامه.", hurry: "تقدر تستعجلنا:", sendWa: "ابعت على واتساب",
    expired: "مهلة الحجز المبدئي خلصت من غير دفع المقدم، والمكان ممكن يكون اتحجز.", bookAgain: "احجز تاني", cancelTitle: "إلغاء الحجز",
    cancelFree: "الحجز لسه مبدئي ومفيش مقدم مدفوع، فالإلغاء من غير أي رسوم.", cancelRefund: (d, l, a) => `فاضل ${d} يوم على الرحلة: ${l} (${a}).`, cancelLate: "فاضل أقل من ٣ أيام: الإلغاء مش متاح أونلاين، بس تقدر تأجل لميعاد تاني خلال ٦ شهور — كلّمنا.",
    cancelBtn: "أيوه، ألغي الحجز", sure: "متأكد؟ اضغط تاني للتأكيد", cancelling: "بنلغي…", cancelled: "اتلغى الحجز", lookingUp: "بندوّر…", enterBoth: "اكتب رقم الحجز ورقم الموبايل",
    trackOff: "متابعة الحجز أونلاين هتشتغل أول ما نظام الحجز يتفعّل. لحد دلوقتي", trackWa: "كلّمنا على واتساب", trackContact: "تواصل معانا",
    status: { pending: "في انتظار المقدم", confirmed: "مؤكد", cancelled: "ملغي", completed: "مكتمل", quote: "طلب عرض سعر", expired: "انتهت مهلة الحجز المبدئي" },
    refundLabels: ["استرداد كامل", "استرداد ٥٠٪", "تأجيل بس"],
    sending: "بنبعت…", contactThanks: "وصلتنا رسالتك", contactReply: p => `هنرد عليك على ${p} في أقرب وقت.`, contactWaOpened: "فتحنالك واتساب بالرسالة — اضغط إرسال هناك", contactOff: "التواصل الأونلاين لسه بيتجهز، ورقم الواتساب هيتضاف قريب.", sendInsteadWa: "ابعتها على واتساب بدل كده",
    errContact: { name: "اكتب اسمك", phone: "رقم الموبايل مش صحيح", msg: "اكتب رسالتك", consent: "لازم توافق على سياسة الخصوصية" },
    chatOpen: "افتح مساعد الحجز", chatTitle: "مساعد ستارفول", chatSub: "بيرد فورًا · وبيحوّلك لموظف لو احتجت", chatClose: "اقفل الشات", chatPlaceholder: "اكتب سؤالك أو طلبك…", chatYour: "رسالتك", chatSend: "ابعت",
    chatFine: 'المحادثات بتتحفظ لتحسين الخدمة — <a href="/ar/privacy/">الخصوصية</a>. متكتبش بيانات بطاقات بنكية.',
    chatHello: "أهلًا بيك في ستارفول ديزرت. أنا مساعد الحجز — قولي رايح فين وإمتى وكام فرد، وأنا أقولك المتاح والسعر وأحجزلك.",
    chatQuick: ["عايز رحلة يوم واحد", "رحلات سيوة وأسعارها", "إيه المتاح الشهر الجاي؟", "تابع حجزي"],
    chatBooked: r => `اتسجل الحجز ${r} — تقدر تتابعه من صفحة «متابعة الحجز».`, chatHuman: l => `تقدر تكمل مع فريقنا على ${l}`, chatTooMany: "رسايل كتير ورا بعض — استنى دقيقة وجرّب تاني.", chatOr: l => ` — أو كلّمنا على ${l}`,
    chatTyping: "المساعد بيكتب", whatsapp: "واتساب", tripPage: "صفحة الرحلة",
    numbers: "ar-EG",
    people: p => { const f = n => new Intl.NumberFormat("ar-EG").format(n); return [`${f(p.adults)} كبار`, p.kids && `${f(p.kids)} أطفال ٦–١١`, p.kidsSmall && `${f(p.kidsSmall)} أطفال ٢–٥`, p.infants && `${f(p.infants)} رضّع`].filter(Boolean).join(" + "); },
  },
};
export const t = T[LANG];

/* English error messages for server / rule codes (Arabic uses the server's own text) */
const ERR_EN = {
  too_soon: d => `The earliest available date for this trip is ${d.minDate || "a few days from now"}.`, off_season: () => "This trip doesn't run in that month — see the season on the trip page.",
  bad_date: () => "Please choose a valid date.", too_far: () => "Bookings open up to one year ahead.", closed: () => "There is no departure on that day.",
  full: d => (d.seatsLeft ? `Only ${d.seatsLeft} places left on that day.` : "That day is fully booked — please choose another date."), duplicate: d => `You already have a booking for this trip and date (${d.ref || ""}).`,
  bad_name: () => "Please enter your full name.", bad_phone: () => "Please enter a valid phone number.", consent: () => "Please accept the terms and privacy policy.", rate_limited: () => "Too many attempts — please wait a few minutes.",
  not_found: () => "No booking found with that reference and phone number.", bad_lookup: () => "Enter your reference (like SD-AB12CD) and the phone number you booked with.",
  late_cancel: () => "Less than 3 days before the trip, cancellation isn't available online — you can move your date within 6 months. Please contact us.",
  network: () => "We can't reach the booking server right now. Please try again shortly.", no_api: () => "Online booking isn't active yet.", trip_not_found: () => "This trip isn't available.",
  bad_party: () => "Please check the number of travellers (max 24 per booking).", completed: () => "This trip has already taken place.", confirm: () => "Please confirm the cancellation.", internal: () => "Something went wrong on our side. Please try again.",
};
export function errText(code, data = {}, fallback = "") { return !AR && ERR_EN[code] ? ERR_EN[code](data) : fallback || (ERR_EN[code] ? ERR_EN[code](data) : ""); }

/* Localised catalog */
export function localTrip(trip) {
  if (AR) return trip;
  const e = EN.TRIPS_EN[trip.id];
  return e ? { ...trip, title: e.title, route: e.route, dur: e.dur, summary: e.summary, inc: e.inc, itin: e.itin, badge: trip.badge ? e.badge || trip.badge : undefined, titleAr: trip.title } : trip;
}
export const destinations = AR ? Object.fromEntries(Object.entries(CAT.DESTINATIONS).map(([k, v]) => [k, v.ar])) : EN.DESTINATIONS_EN;
export const categories = AR ? CAT.CATEGORIES : EN.CATEGORIES_EN;
export const months = AR ? CAT.MONTHS : EN.MONTHS_EN;
export const faq = AR ? CAT.FAQ : EN.FAQ_EN;

/* Money */
export function fmtMoney(v, cur) {
  if (v == null) return t.onRequest;
  const n = new Intl.NumberFormat(t.numbers).format(Math.round(v));
  if (cur === "USD") return "$" + n;
  return AR ? n + " ج.م" : "EGP " + n;
}
export const fmtNum = n => new Intl.NumberFormat(t.numbers).format(n);
