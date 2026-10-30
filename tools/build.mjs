/* Builds the static, SEO-friendly pages in two languages from the shared data.
   English (primary, for international travellers) at /, Arabic at /ar/.
   Run:  node tools/build.mjs
   Outputs every HTML page, sitemap.xml, robots.txt, image-sources.csv, assets/js/images.js */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BRAND, TRIPS, RESERVES, FAQ, POLICY, MONTHS, CATEGORIES, DESTINATIONS } from "../shared/catalog.js";
import { TRIPS_EN, RESERVES_EN, FAQ_EN, DESTINATIONS_EN, CATEGORIES_EN, MONTHS_EN } from "../shared/catalog-en.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const IMG = JSON.parse(readFileSync(join(ROOT, "data/images.json"), "utf8"));
const P = IMG.places;
const SITE = BRAND.url;
const VERSION = createHash("sha1").update(readFileSync(join(ROOT, "assets/css/site.css"))).digest("hex").slice(0, 8);
const out = (rel, s) => { const f = join(ROOT, rel); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, s); };
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const img = k => (P[k] && P[k].src && !P[k].pending ? P[k] : null);
const commons = f => "https://commons.wikimedia.org/wiki/File:" + encodeURIComponent(f.replace(/ /g, "_"));
const HERO = ["white", "sandSea", "fatnas", "rayanFalls", "black"];
const MS = ["best", "best", "best", "ok", "ok", "", "", "", "ok", "best", "best", "best"];

/* ---------- icons (no emoji) ---------- */
const I = (d, w = 18) => `<svg class="ico" width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const IC = {
  clock: I('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'), car: I('<path d="M3 16h18M5 16l2-6h10l2 6M7 19.5a1.5 1.5 0 1 0 0-.1M17 19.5a1.5 1.5 0 1 0 0-.1"/>'),
  users: I('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.7c1.9.7 3.1 2.4 3.5 5.3"/>'),
  pin: I('<path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>'), doc: I('<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>'),
  check: I('<path d="M20 6 9 17l-5-5"/>', 16), minus: I('<path d="M5 12h14"/>', 16),
  shield: I('<path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/><path d="M9 12l2 2 4-4"/>', 28), tent: I('<path d="M3 20l9-15 9 15z"/><path d="M12 20v-6"/>', 28),
  carL: I('<path d="M3 16h18M5 16l2-6h10l2 6M7 19.5a1.5 1.5 0 1 0 0-.1M17 19.5a1.5 1.5 0 1 0 0-.1"/>', 28), refresh: I('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', 28),
  bus: I('<rect x="3" y="6" width="18" height="11" rx="2"/><path d="M7 17v2M17 17v2M3 12h18"/>', 30), home: I('<path d="M3 21V10l9-6 9 6v11"/><path d="M9 21v-6h6v6"/>', 30),
  meal: I('<path d="M4 11h16a8 8 0 0 1-16 0zM12 3v4M8 5v2M16 5v2"/>', 30), park: I('<path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/>', 30),
  guide: I('<circle cx="12" cy="7" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>', 30), star: I('<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6-5.3-3-5.3 3 1.2-6L3.4 9.3l6-.7z"/>', 30),
  wa: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.2 1.3z"/></svg>`,
};
const LOGO = `<svg width="42" height="42" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="19" fill="none" stroke="#E0BF86" stroke-width="1.2"/><circle cx="26.5" cy="13.5" r="4" fill="#E0BF86"/><path d="M4 27 Q12 18.5 20 24.5 T36 22.5 L36 28 Q30 37 20 37 Q10 37 4 28Z" fill="#E0BF86" opacity=".9"/></svg>`;

/* ---------- language packs ---------- */
const L = {
  en: {
    lang: "en", dir: "ltr", pre: "", other: "/ar", otherLabel: "العربية", locale: "en_US", nf: new Intl.NumberFormat("en-US"),
    fonts: "family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Manrope:wght@400;500;600;700",
    name: "Safarya Desert", tag: "Western Desert · Egypt",
    nav: [["/trips/", "Journeys"], ["/#reserves", "Protected areas"], ["/#prices", "Prices"], ["/faq/", "FAQ"], ["/booking/", "Manage booking"], ["/contact/", "Contact"]],
    home: "Home", bookCta: "Book a journey", menu: "Menu", skip: "Skip to content", curEGP: "EGP", curUSD: "USD",
    money: v => (v == null ? "On request" : "$" + new Intl.NumberFormat("en-US").format(v)), cur: "usd",
    from: "From / person", price: "Price", details: "Details", book: "Book", quote: "Request quote", landCruiser: "Land Cruiser", illus: "Illustration",
    footAbout: "Private and small-group 4x4 journeys through Egypt's Western Desert — from Fayoum to Siwa to the Gilf Kebir — with Bedouin crews from the oases we travel through.",
    footTrips: "Journeys", allTrips: "All journeys", footContact: "Contact", office: "Office: Cairo, Egypt", whatsapp: "WhatsApp",
    legal: [["/booking/", "Manage booking"], ["/faq/", "FAQ"], ["/terms/", "Terms & cancellation"], ["/privacy/", "Privacy policy"], ["/credits/", "Photo credits"]],
    copy: "© 2026 Safarya Desert. Location photos from Wikimedia Commons under free licences; the photographer is credited on every image.",
    waAsk: "Hello, I'd like to ask about a trip",
    homeTitle: "Safarya Desert | 4x4 Desert Safaris in Egypt's Western Desert",
    homeDesc: "Land Cruiser 4x4 safaris from Cairo to the White & Black Desert, Siwa Oasis, Fayoum's Whale Valley, the Great Oases and the Gilf Kebir. Transfers, camps, meals and park fees included.",
    heroTags: ["White Desert", "Black Desert", "Siwa Oasis", "Fayoum", "Gilf Kebir"],
    heroH1: ["The Western Desert,", "<em>by Land Cruiser</em>", "and a tent under the stars"],
    heroSub: "Private and small-group 4x4 journeys from Cairo. Transfers, eco-lodge or desert camp, meals and park fees are all included — no surprises.",
    fWhere: "Where to?", fAll: "All destinations", fDate: "Travel date", fPax: "Travellers", fGo: "Find a journey",
    strip: [["Toyota Land Cruiser 4x4", "Recent air-conditioned models with licensed desert drivers"], ["Park fees included", "White Desert and Whale Valley tickets are in the price"], ["Camps & eco-lodges", "Furnished tents, or rooms with private bathrooms"], ["Free cancellation", "Full refund up to 7 days before you travel"]],
    season: "Season 2026 / 2027", chooseH: "Choose your journey", chooseP: "Prices per person on shared departures, including transfers from Cairo and Giza. A private car just for your group adds 45%.", all: "All",
    resEy: "Protected areas", resH: "The landscapes we travel through", resP: "Park entry is included, and our guides explain the geology and history of every place.",
    priceEy: "Fair pricing", priceH: "Below the market, never below standard", priceP: "We compared Egyptian safari operators and international booking platforms, and priced below the average without cutting back on the car, the food or the camp.",
    thTrip: "Journey", thLocal: "Local operators (EGP)", thIntl: "International platforms", thUsEGP: "Safarya – residents", thUsUSD: "Safarya – international", save: s => `Save ${s}%`,
    priceNote: "Market prices are estimates from our review of published operator and platform prices and change with the season. International prices are in USD because park fees for foreign visitors are higher.",
    inclEy: "Everything the journey needs", inclH: "What's included",
    incl: [["Transfers", "Air-conditioned minibus from Cairo and Giza, then a Land Cruiser 4x4 in the desert.", "bus"], ["Accommodation", "Salt-and-mud eco-lodges in Siwa, a hotel in Bahariya, a Bedouin camp in the White Desert.", "home"], ["Meals", "Breakfast, lunch and a Bedouin charcoal-grilled dinner, with water, tea and coffee throughout.", "meal"], ["Park fees", "White Desert, Wadi El Rayan and Whale Valley tickets, and Great Sand Sea permits.", "park"], ["Safari guide", "An English-speaking guide, plus a Bedouin guide from the region.", "guide"], ["Experiences", "Sandboarding, swimming in sulphur springs, stargazing and sunrise photography.", "star"]],
    fleetEy: "The 4x4 fleet", fleetH: "Built for soft sand", fleetP: "Only four passengers per car so you travel in comfort, and every car leaves with at least one other for safety. Our drivers are from the oases and know the routes without GPS.",
    specs: [["Vehicle", "Toyota Land Cruiser"], ["Passengers per car", "4"], ["Air conditioning", "Fully air-conditioned"], ["Safety", "Thuraya phone + first aid"]],
    seasEy: "When to go", seasH: "Desert seasons", seasP: "The White Desert and Siwa are at their best from October to April. In summer we only run the Fayoum overnight stargazing trip.",
    legend: ["Best season", "Good, with adjusted hours", "Very hot — Fayoum night trip only"],
    ctaH: "Ready for the desert?", ctaP: "Pick a journey, a date and your group, and see the final price instantly. Your places are held for 48 hours until the 30% deposit.", ctaB: "Book a journey", ctaQ: "I have a question first",
    tripsTitle: "All journeys & prices", tripsDesc: "Every Safarya Desert journey: Fayoum day trips, White Desert overnights, Siwa, the Great Oases loop and the Gilf Kebir expedition — with prices in USD and EGP.",
    tripsH: "All journeys", tripsP: "Twelve journeys from a single day to twelve. Search by name or place, or filter by length and month.", search: "Search: Siwa, stars, whales, camp…", anyMonth: "Any month", sortRec: "Recommended", sortPrice: "Price: low to high", sortDays: "Shortest first", searchLabel: "Search journeys", destLabel: "Destination", monthLabel: "Month", sortLabel: "Sort",
    facts: (t) => [[IC.clock, t.dur], [IC.car, "Land Cruiser 4x4"], [IC.users, "4 per vehicle"], [IC.pin, "Pick-up in Cairo / Giza"], ...(t.quoteOnly ? [[IC.doc, "Priced on request"]] : [])],
    itinH: "Itinerary", incH: "Included", excH: "Not included", placesH: "Places on this journey", seasonH: "Season", seasonNote: n => `Highlighted months are when this journey runs. Book at least ${n} days ahead.`,
    incBase: ["Transfers from Cairo and Giza in an air-conditioned vehicle", "Land Cruiser 4x4 with a desert driver"], incEnd: ["Park entry fees", "Safari guide", "Water, tea and coffee"], exc: ["Soft drinks and snacks", "Tips", "Optional activities such as camel rides or quad bikes"],
    groupPP: "Shared / person", privatePP: "Private / person", kidsNote: "Children 2–5 pay 25%, 6–11 pay 50%, under 2 travel free.", dateL: "Travel date", paxL: "Travellers", pickDate: "Choose a date and we'll check availability",
    bookThis: "Book this journey", quoteThis: "Request a quote", askWa: "Ask about it on WhatsApp", askWaMsg: t => `Hello, I'd like to ask about the "${t}" trip`, relatedEy: "You may also like", relatedH: "Similar journeys", galleryL: "Journey photos", crumbsL: "Breadcrumb", sideL: "Price and booking",
    tripDesc: t => `${t.summary} ${t.quoteOnly ? "Priced on request." : `From $${t.usd} per person (EGP ${t.egp} for Egyptian residents).`}`,
    bookTitle: "Book your journey", bookDesc: "Book a Western Desert safari: choose the journey, date and travellers and see the final price before you confirm. Places held for 48 hours with a 30% deposit.",
    bookH: "Book your journey", bookP: "The price updates as you go. Your places are held for 48 hours and confirmed once the 30% deposit arrives.",
    steps: ["Journey & date", "Travellers", "Your details", "Confirmation"], tripL: "Journey", calPrev: "Previous month", calNext: "Next month", calL: "Available days",
    typeL: "Trip type", group: "Shared group", groupS: "With other travellers", private: "Private", privateS: "A car just for you +45%", stayL: "Accommodation", std: "Standard", stdS: "Bedouin camp / lodge", up: "Premium upgrade", upS: "Premium eco-lodge +15%",
    counters: [["bAdults", "Adults (12+)", 1, 24, 2], ["bKids", "Children 6–11 (50%)", 0, 12, 0], ["bKidsSmall", "Children 2–5 (25%)", 0, 12, 0], ["bInfants", "Infants under 2 (free)", 0, 6, 0]], plus: "Add", minus: "Remove",
    nameL: "Full name", namePh: "Your full name", phoneL: "Phone / WhatsApp (with country code)", phonePh: "+44 7700 900123", noteL: "Notes (optional)", notePh: "Vegetarian, birthday, drone photography…", hp: "Leave empty",
    consent: 'I agree to the <a href="/terms/" target="_blank">terms & cancellation policy</a> and the <a href="/privacy/" target="_blank">privacy policy</a>, and to Safarya contacting me on this number about my booking.',
    submit: "Reserve my places", totalL: "Total", depositL: "Deposit to confirm (30%):", pay: ["Card", "Bank transfer", "InstaPay", "Vodafone Cash", "Cash on the day"], payNote: "Nothing is charged online: after booking we send deposit details on WhatsApp.",
    trackTitle: "Manage your booking", trackDesc: "Check the status of your Safarya Desert booking with your reference and phone number, or cancel it under our policy.", trackEy: "My booking", trackH: "Manage your booking", trackP: "Enter your booking reference (like SD-AB12CD) and the phone number you booked with.", refL: "Booking reference", showBooking: "Show booking",
    contactTitle: "Contact us", contactDesc: "Talk to the Safarya Desert team on WhatsApp or send a message about private trips, groups and companies.", contactEy: "Contact", contactH: "We're here to help", contactP: "For private trips, groups, companies, or any question before you book.",
    msgH: "Send us a message", nameS: "Name", msgL: "Your message", msgPh: "For example: a private Siwa trip for 4 people in December", send: "Send", privacyConsent: 'I agree to the <a href="/privacy/" target="_blank">privacy policy</a> and to being contacted on this number.',
    fastest: "Fastest: WhatsApp", ourNumber: "Our number:", openWa: "Open WhatsApp", officeH: "Office", officeP: "Cairo, Egypt. Pick-ups from your hotel in Cairo or Giza.", haveBooking: "Already booked?", trackLink: "Manage your booking",
    faqTitle: "Frequently asked questions", faqDesc: "Answers about pick-up times, visas and permits, what to pack, children's prices, camps, confirmation, payment, cancellation, safety and the Gilf Kebir.", faqEy: "Before you travel", faqH: "Frequently asked questions", notHere: "Didn't find your answer?", askWaBtn: "Ask us on WhatsApp", sendMsg: "Send a message", faqWa: "I have a question:",
    creditsTitle: "Photo credits", creditsDesc: "Sources and licences of the location photos used on the Safarya Desert website.", creditsEy: "Transparency", creditsH: "Photo sources & licences", creditsP: d => `Every location photo is a real image from Wikimedia Commons. Last verified: ${d}.`,
    thPlace: "Place", thAuthor: "Photographer", thLicense: "Licence", thSource: "Source", creditsNote: "Images are used unmodified apart from resizing. CC BY and CC BY-SA licences allow commercial use with credit to the photographer and licence, shown on every image on this site.",
    nfTitle: "Page not found", nfH: "Lost in the desert", nfP: "This page doesn't exist. Head back home or browse our journeys.",
    privacyTitle: "Privacy policy", termsTitle: "Terms & cancellation policy", updated: "Last updated: October 2026", legalEy: "Legal",
  },
  ar: {
    lang: "ar", dir: "rtl", pre: "/ar", other: "", otherLabel: "English", locale: "ar_EG", nf: new Intl.NumberFormat("ar-EG"),
    fonts: "family=Amiri:wght@400;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700",
    name: "سفرية ديزرت", tag: "Western Desert · Egypt",
    nav: [["/trips/", "الرحلات"], ["/#reserves", "المحميات"], ["/#prices", "الأسعار"], ["/faq/", "أسئلة"], ["/booking/", "متابعة حجز"], ["/contact/", "تواصل"]],
    home: "الرئيسية", bookCta: "احجز رحلتك", menu: "القائمة", skip: "انتقل للمحتوى", curEGP: "ج.م", curUSD: "$",
    money: v => (v == null ? "عند الطلب" : new Intl.NumberFormat("ar-EG").format(v) + " ج.م"), cur: "egp",
    from: "يبدأ من / للفرد", price: "السعر", details: "التفاصيل", book: "احجز", quote: "اطلب عرض", landCruiser: "لاند كروزر", illus: "رسم توضيحي",
    footAbout: "رحلات دفع رباعي خاصة وبمجموعات صغيرة في الصحراء الغربية المصرية، من الفيوم لسيوة للجلف الكبير، مع بدو من أهل الواحات في كل منطقة بنزورها.",
    footTrips: "الرحلات", allTrips: "كل الرحلات", footContact: "تواصل", office: "المكتب: القاهرة، مصر", whatsapp: "واتساب",
    legal: [["/booking/", "متابعة حجز"], ["/faq/", "الأسئلة الشائعة"], ["/terms/", "الشروط وسياسة الإلغاء"], ["/privacy/", "سياسة الخصوصية"], ["/credits/", "مصادر الصور"]],
    copy: "© ٢٠٢٦ سفرية ديزرت. صور الأماكن من Wikimedia Commons بتراخيص حرة، واسم المصوّر مكتوب على كل صورة.",
    waAsk: "أهلًا، عايز أستفسر عن رحلة",
    homeTitle: "سفرية ديزرت | رحلات سفاري ٤×٤ في الصحراء الغربية المصرية",
    homeDesc: "رحلات سفاري بعربيات لاند كروزر ٤×٤ من القاهرة للصحراء البيضاء والسوداء وسيوة والفيوم ووادي الحيتان والواحات والجلف الكبير. الانتقالات والإقامة والوجبات ورسوم المحميات شاملة.",
    heroTags: ["الصحراء البيضاء", "الصحراء السوداء", "واحة سيوة", "الفيوم", "الجلف الكبير"],
    heroH1: ["الصحراء الغربية كلها،", "<em>بلاند كروزر</em>", "وخيمة تحت النجوم"],
    heroSub: "رحلات سفاري داخلية من القاهرة بعربيات دفع رباعي. الانتقالات والإقامة في الإيكولودج أو المخيم والوجبات ورسوم المحميات كلها جوه السعر، من غير مفاجآت.",
    fWhere: "رايح فين؟", fAll: "كل الوجهات", fDate: "تاريخ السفر", fPax: "كام فرد؟", fGo: "دوّر على رحلة",
    strip: [["لاند كروزر ٤×٤", "موديلات حديثة ومكيّفة وسواق صحراوي مرخّص"], ["رسوم المحميات شاملة", "تذاكر الصحراء البيضاء ووادي الحيتان جوه السعر"], ["مخيمات وإيكولودج", "خيم مجهزة بمراتب وبطاطين، أو أوض بحمام خاص"], ["إلغاء مجاني", "قبل ميعاد الرحلة بـ ٧ أيام واسترداد كامل"]],
    season: "موسم ٢٠٢٦ / ٢٠٢٧", chooseH: "اختار رحلتك", chooseP: "كل الأسعار للفرد في رحلات المجموعات، شاملة النقل من القاهرة والجيزة. الرحلة الخاصة لعربيتك لوحدك بتزيد ٤٥٪.", all: "الكل",
    resEy: "المحميات الطبيعية", resH: "محميات بنزورها في رحلاتنا", resP: "تذاكر دخول المحميات محسوبة في سعر الرحلة، ومرشدينا بيشرحوا جيولوجيا كل مكان وتاريخه.",
    priceEy: "مقارنة أسعار السوق", priceH: "سعر في النص بالظبط", priceP: "راجعنا أسعار شركات السفاري المصرية ومنصات الحجز العالمية، وحطينا أسعارنا تحت متوسط السوق من غير ما نقلل في العربية أو الأكل أو الإقامة.",
    thTrip: "الرحلة", thLocal: "شركات محلية (للمصريين)", thIntl: "منصات أجنبية (للأجانب)", thUsEGP: "سفرية – مصري", thUsUSD: "سفرية – أجنبي", save: s => `أوفر ${new Intl.NumberFormat("ar-EG").format(s)}٪`,
    priceNote: "أسعار السوق تقديرية من مراجعتنا لأسعار منشورة لشركات ومنصات حجز، وبتتغير حسب الموسم والعرض. الأسعار بالدولار للأجانب لأن رسوم المحميات ليهم أعلى.",
    inclEy: "كل اللي الرحلة محتاجاه", inclH: "السعر شامل إيه؟",
    incl: [["الانتقالات", "ميكروباص أو هاي آس مكيف من القاهرة والجيزة، وبعدها لاند كروزر ٤×٤ جوه الصحرا.", "bus"], ["الإقامة", "إيكولودج من الطين والملح في سيوة، فندق في البحرية، ومخيم بدوي في الصحراء البيضاء.", "home"], ["الوجبات", "فطار وغدا وعشا بدوي مشوي على الفحم، ومية وشاي وقهوة طول الرحلة.", "meal"], ["رسوم المحميات", "تذاكر الصحراء البيضاء ووادي الريان ووادي الحيتان وتصاريح بحر الرمال.", "park"], ["مرشد سفاري", "مرشد بيتكلم عربي وإنجليزي، ودليل بدوي من أهل المنطقة.", "guide"], ["الأنشطة", "تزلج على الرمال، سباحة في العيون الكبريتية، سهرة نجوم، وتصوير الشروق.", "star"]],
    fleetEy: "أسطول الدفع الرباعي", fleetH: "عربيات مجهزة للرملة الناعمة", fleetP: "كل عربية فيها ٤ ركاب بس عشان تبقى مرتاح، وبتطلع الصحرا مع عربية تانية على الأقل للأمان. السواقين من أهل الواحات وعارفين الطرق من غير GPS.",
    specs: [["العربية", "تويوتا لاند كروزر"], ["الركاب في العربية", "٤ أفراد"], ["التكييف", "مكيّفة بالكامل"], ["الأمان", "تليفون ثريا + إسعافات"]],
    seasEy: "أحسن وقت للسفر", seasH: "مواسم الصحراء", seasP: "الصحراء البيضاء وسيوة أحلى من أكتوبر لأبريل. في الصيف بنعمل رحلة الفيوم بالمبيت ورصد النجوم بس.",
    legend: ["أفضل موسم", "مناسب مع تعديل المواعيد", "حر شديد، الفيوم الليلية بس"],
    ctaH: "جاهز للصحرا؟", ctaP: "اختار الرحلة والتاريخ وعدد الأفراد، والسعر بيتحسب قدامك. مكانك بيتحجز مبدئيًا ٤٨ ساعة لحد ما تدفع ٣٠٪ مقدم.", ctaB: "احجز رحلتك", ctaQ: "عندي سؤال الأول",
    tripsTitle: "كل الرحلات والأسعار", tripsDesc: "قائمة رحلات سفرية ديزرت: يوم واحد في الفيوم، مبيت في الصحراء البيضاء، سيوة، الواحات الكبرى، وإكسبيديشن الجلف الكبير — بالأسعار للمصريين والأجانب.",
    tripsH: "كل الرحلات", tripsP: "١٢ رحلة من يوم واحد لـ ١٢ يوم. دوّر بالاسم أو المكان، أو صفّي حسب المدة والشهر.", search: "دوّر: سيوة، نجوم، حيتان، مخيم…", anyMonth: "أي شهر", sortRec: "الترتيب المقترح", sortPrice: "الأرخص الأول", sortDays: "الأقصر الأول", searchLabel: "بحث في الرحلات", destLabel: "الوجهة", monthLabel: "الشهر", sortLabel: "الترتيب",
    facts: (t) => [[IC.clock, t.dur], [IC.car, "لاند كروزر ٤×٤"], [IC.users, "٤ ركاب في العربية"], [IC.pin, "التجمع من القاهرة / الجيزة"], ...(t.quoteOnly ? [[IC.doc, "بعرض سعر"]] : [])],
    itinH: "البرنامج", incH: "شامل", excH: "مش شامل", placesH: "الأماكن في الرحلة", seasonH: "الموسم", seasonNote: n => `الشهور المظللة هي اللي الرحلة شغالة فيها. أقل مدة للحجز قبل الرحلة: ${new Intl.NumberFormat("ar-EG").format(n)} أيام.`,
    incBase: ["النقل من القاهرة والجيزة بعربية مكيفة", "لاند كروزر ٤×٤ مع سواق صحراوي"], incEnd: ["رسوم دخول المحميات", "مرشد سفاري", "مية وشاي وقهوة"], exc: ["المشروبات الخاصة والسناكس", "البقشيش", "أنشطة اختيارية زي ركوب الجمل أو الـ ATV"],
    groupPP: "مجموعة / للفرد", privatePP: "خاصة / للفرد", kidsNote: "الأطفال ٢–٥ سنين ٢٥٪، ٦–١١ سنة ٥٠٪، وأقل من سنتين مجانًا.", dateL: "تاريخ السفر", paxL: "الأفراد", pickDate: "اختار تاريخ وهنتأكد من التوافر",
    bookThis: "احجز الرحلة دي", quoteThis: "اطلب عرض سعر", askWa: "اسأل عن الرحلة على واتساب", askWaMsg: t => `أهلًا، عايز أستفسر عن رحلة «${t}»`, relatedEy: "ممكن تعجبك كمان", relatedH: "رحلات قريبة منها", galleryL: "صور الرحلة", crumbsL: "مسار الصفحة", sideL: "السعر والحجز",
    tripDesc: t => `${t.summary} ${t.quoteOnly ? "بعرض سعر." : `من ${new Intl.NumberFormat("ar-EG").format(t.egp)} ج.م للمصريين أو $${t.usd} للأجانب للفرد.`}`,
    bookTitle: "احجز رحلتك", bookDesc: "احجز رحلة سفاري في الصحراء الغربية: اختار الرحلة والتاريخ وعدد الأفراد وشوف السعر النهائي قبل التأكيد. حجز مبدئي ٤٨ ساعة ومقدم ٣٠٪.",
    bookH: "احجز رحلتك في دقيقتين", bookP: "السعر بيتحسب قدامك. مكانك بيتحجز مبدئيًا ٤٨ ساعة، وبيتأكد بعد دفع ٣٠٪ مقدم.",
    steps: ["الرحلة والتاريخ", "الأفراد", "بياناتك", "التأكيد"], tripL: "الرحلة", calPrev: "الشهر اللي فات", calNext: "الشهر الجاي", calL: "الأيام المتاحة",
    typeL: "نوع الرحلة", group: "مجموعة", groupS: "مع مسافرين تانيين", private: "خاصة", privateS: "عربية ليك لوحدك +٤٥٪", stayL: "الإقامة", std: "القياسية", stdS: "مخيم بدوي / لودج", up: "ترقية فاخرة", upS: "إيكولودج بريميوم +١٥٪",
    counters: [["bAdults", "الكبار (١٢ سنة وأكتر)", 1, 24, 2], ["bKids", "أطفال ٦–١١ سنة (٥٠٪)", 0, 12, 0], ["bKidsSmall", "أطفال ٢–٥ سنين (٢٥٪)", 0, 12, 0], ["bInfants", "رضّع أقل من سنتين (مجانًا)", 0, 6, 0]], plus: "زوّد", minus: "قلّل",
    nameL: "الاسم بالكامل", namePh: "اسمك بالكامل", phoneL: "رقم الموبايل / واتساب", phonePh: "01xxxxxxxxx", noteL: "ملاحظات (اختياري)", notePh: "نباتي، عيد ميلاد، محتاج تصوير درون…", hp: "سيبه فاضي",
    consent: 'موافق على <a href="/ar/terms/" target="_blank">الشروط وسياسة الإلغاء</a> و<a href="/ar/privacy/" target="_blank">سياسة الخصوصية</a>، وإن فريق سفرية يتواصل معايا على الرقم ده بخصوص الحجز.',
    submit: "أكّد الحجز المبدئي", totalL: "الإجمالي", depositL: "المقدم لتأكيد الحجز (٣٠٪):", pay: ["إنستاباي", "فودافون كاش", "فيزا / ماستركارد", "تحويل بنكي", "كاش يوم الرحلة"], payNote: "الدفع مش أونلاين: بعد الحجز فريقنا بيبعتلك بيانات دفع المقدم على واتساب.",
    trackTitle: "متابعة الحجز", trackDesc: "تابع حالة حجزك في سفرية ديزرت برقم الحجز ورقم الموبايل، أو ألغيه حسب سياسة الإلغاء.", trackEy: "حجوزاتي", trackH: "متابعة الحجز", trackP: "اكتب رقم الحجز (زي SD-AB12CD) ورقم الموبايل اللي حجزت بيه.", refL: "رقم الحجز", showBooking: "اعرض الحجز",
    contactTitle: "تواصل معانا", contactDesc: "كلّم فريق سفرية ديزرت على واتساب أو ابعت رسالة لرحلات خاصة ومجموعات وشركات.", contactEy: "تواصل", contactH: "إحنا موجودين", contactP: "لرحلة خاصة، مجموعة، شركة، أو أي سؤال قبل ما تحجز.",
    msgH: "ابعتلنا رسالة", nameS: "الاسم", msgL: "رسالتك", msgPh: "مثلًا: عايزين رحلة سيوة لـ ١٢ فرد في ديسمبر", send: "ابعت", privacyConsent: 'موافق على <a href="/ar/privacy/" target="_blank">سياسة الخصوصية</a> وإنكم تتواصلوا معايا على الرقم ده.',
    fastest: "أسرع طريقة: واتساب", ourNumber: "رقمنا:", openWa: "افتح واتساب", officeH: "المكتب", officeP: "القاهرة، مصر. التجمع للرحلات من ميدان التحرير أو الجيزة أو ٦ أكتوبر.", haveBooking: "عندك حجز؟", trackLink: "تابع حجزك",
    faqTitle: "الأسئلة الشائعة", faqDesc: "إجابات عن مواعيد التحرك، اللي تجيبه معاك، أسعار الأطفال، المخيم، تأكيد الحجز، سياسة الإلغاء، ورحلة الجلف الكبير.", faqEy: "قبل ما تسافر", faqH: "أسئلة بتتكرر", notHere: "سؤالك مش هنا؟", askWaBtn: "اسألنا على واتساب", sendMsg: "ابعت رسالة", faqWa: "عندي سؤال:",
    creditsTitle: "مصادر الصور", creditsDesc: "مصادر وتراخيص صور الأماكن المستخدمة في موقع سفرية ديزرت.", creditsEy: "شفافية", creditsH: "مصادر الصور وتراخيصها", creditsP: d => `كل صور الأماكن حقيقية من Wikimedia Commons. آخر تحقق: ${d}.`,
    thPlace: "المكان", thAuthor: "المصوّر", thLicense: "الترخيص", thSource: "المصدر", creditsNote: "الصور مستخدمة من غير تعديل غير تصغير المقاس. تراخيص CC BY و CC BY-SA بتسمح بالاستخدام التجاري بشرط ذكر اسم المصوّر والترخيص، وده مكتوب على كل صورة في الموقع.",
    nfTitle: "الصفحة مش موجودة", nfH: "تُهنا في الصحرا", nfP: "الصفحة دي مش موجودة. ارجع للرئيسية أو شوف الرحلات.",
    privacyTitle: "سياسة الخصوصية", termsTitle: "الشروط والأحكام وسياسة الإلغاء", updated: "آخر تحديث: أكتوبر ٢٠٢٦", legalEy: "قانوني",
  },
};

/* ---------- localised data ---------- */
const tripFor = (t, lang) => (lang === "ar" ? t : { ...t, ...TRIPS_EN[t.id], badge: t.badge ? TRIPS_EN[t.id]?.badge : undefined });
const reservesFor = lang => (lang === "ar" ? RESERVES : RESERVES.map((r, i) => ({ ...r, ...RESERVES_EN[i] })));
const faqFor = lang => (lang === "ar" ? FAQ : FAQ_EN);
const destFor = lang => (lang === "ar" ? Object.fromEntries(Object.entries(DESTINATIONS).map(([k, v]) => [k, v.ar])) : DESTINATIONS_EN);
const catFor = lang => (lang === "ar" ? CATEGORIES : CATEGORIES_EN);
const monthsFor = lang => (lang === "ar" ? MONTHS : MONTHS_EN);
const placeFor = (k, lang) => (P[k] ? (lang === "ar" ? P[k].ar : P[k].en) : "");

/* ---------- building blocks ---------- */
function photo(k, lang, { alt, eager = false, cls = "", art = "dunes" } = {}) {
  const i = img(k);
  if (!i) return `<div class="ph ${cls}" data-art="${art}"><span class="illus">${L[lang].illus}</span></div>`;
  const w = i.w > i.h ? 1280 : Math.round(1280 * i.w / i.h), h = i.w > i.h ? Math.round(1280 * i.h / i.w) : 1280;
  return `<div class="ph ${cls}" data-fallback="${art}"><img src="${esc(i.src)}" alt="${esc(alt || placeFor(k, lang))}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" width="${w}" height="${h}" referrerpolicy="no-referrer"><a class="credit" href="${commons(i.file)}" target="_blank" rel="noopener" title="${esc(placeFor(k, lang))} — ${esc(i.author)} — ${esc(i.license)}">© ${esc(i.author)} · ${esc(i.license)}</a></div>`;
}
const words = s => s.split(" ").map((w, i) => `<span style="--i:${i}">${w}</span>`).join(" ");

function header(S) {
  const p = S.pre;
  return `<a class="skip" href="#main">${S.skip}</a>
<header class="top"><div class="wrap">
  <a class="logo" href="${p}/" aria-label="${S.name} — ${S.home}">${LOGO}<span><b>${S.name}</b><small>${S.tag}</small></span></a>
  <nav class="main" aria-label="${S.menu}">${S.nav.map(([h, x]) => `<a href="${p}${h}">${x}</a>`).join("")}</nav>
  <div class="tools">
    <div class="cur" role="group" aria-label="Currency"><button type="button" data-cur="USD" aria-pressed="${S.cur === "usd"}">${S.curUSD}</button><button type="button" data-cur="EGP" aria-pressed="${S.cur === "egp"}">${S.curEGP}</button></div>
    <a class="lang-link" data-lang-switch href="${S.other}/" hreflang="${S.lang === "en" ? "ar" : "en"}" lang="${S.lang === "en" ? "ar" : "en"}">${S.otherLabel}</a>
    <a class="btn btn-gold" href="${p}/book/">${S.bookCta}</a>
    <button class="menu-btn" type="button" aria-label="${S.menu}" aria-expanded="false" aria-controls="mnav"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
  </div>
</div></header>
<nav class="mnav" id="mnav" aria-label="${S.menu}">${[["/", S.home], ...S.nav].map(([h, x]) => `<a href="${p}${h}">${x}</a>`).join("")}<a class="btn btn-gold" href="${p}/book/">${S.bookCta}</a><a class="lang-link" data-lang-switch href="${S.other}/" lang="${S.lang === "en" ? "ar" : "en"}">${S.otherLabel}</a></nav>`;
}
function footer(S, lang) {
  const p = S.pre;
  return `<footer><div class="wrap">
  <div><h4>${S.name}</h4><p>${S.footAbout}</p></div>
  <div><h4>${S.footTrips}</h4>${TRIPS.slice(0, 6).map(t => `<a href="${p}/trips/${t.id}.html">${esc(tripFor(t, lang).title)}</a>`).join("")}<a href="${p}/trips/">${S.allTrips} →</a></div>
  <div><h4>${S.footContact}</h4><p>${S.whatsapp}: <a href="${p}/contact/" data-wa style="display:inline" dir="ltr"><span class="num" data-wa-num>…</span></a></p><p>${S.office}</p>${S.legal.map(([h, x]) => `<a href="${p}${h}">${x}</a>`).join("")}</div>
  <p class="copy">${S.copy}</p>
</div></footer>
<a class="btn btn-wa wa" data-wa="${esc(S.waAsk)}" href="${p}/contact/" aria-label="WhatsApp">${IC.wa} WhatsApp</a>`;
}

function layout(lang, { path, title, desc, body, scripts = [], jsonld = [], ogImage, noindex = false, bodyAttrs = "", fullTitle, alt = true }) {
  const S = L[lang];
  const url = SITE + S.pre + path;
  const og = ogImage || img("white").src;
  const full = fullTitle || `${title} | ${S.name}`;
  const altLinks = alt ? `<link rel="alternate" hreflang="en" href="${SITE}${path}"><link rel="alternate" hreflang="ar" href="${SITE}/ar${path}"><link rel="alternate" hreflang="x-default" href="${SITE}${path}">` : "";
  return `<!doctype html>
<html lang="${S.lang}" dir="${S.dir}" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(full)}</title>
<meta name="description" content="${esc(desc)}">
${noindex ? '<meta name="robots" content="noindex, nofollow">' : `<link rel="canonical" href="${url}">${altLinks}`}
<meta name="theme-color" content="#13110E">
<meta property="og:type" content="website"><meta property="og:locale" content="${S.locale}"><meta property="og:site_name" content="${S.name}">
<meta property="og:title" content="${esc(full)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${esc(og)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preconnect" href="https://thumb.wikimedia.org" crossorigin><link rel="dns-prefetch" href="https://upload.wikimedia.org">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${S.fonts}&display=swap">
<link rel="stylesheet" href="/assets/css/site.css?v=${VERSION}">
${jsonld.map(j => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join("\n")}
</head>
<body ${bodyAttrs}>
${header(S)}
<main id="main">
${body}
</main>
${footer(S, lang)}
<div class="toast" id="toast" role="status" hidden></div>
<script type="module" src="/assets/js/app.js"></script>
${scripts.map(s => `<script type="module" src="/assets/js/${s}"></script>`).join("\n")}
</body>
</html>
`;
}

const pageHead = (S, lang, { eyebrow, title, sub, crumbs = [], cover, coverArt = "dunes" }) => `<section class="page-head${cover ? "" : " plain"}">${cover ? photo(cover, lang, { eager: true, art: coverArt }) : ""}
<div class="wrap"><nav class="crumbs" aria-label="${S.crumbsL}"><a href="${S.pre}/">${S.home}</a>${crumbs.map(([h, x]) => ` / ${h ? `<a href="${S.pre}${h}">${esc(x)}</a>` : `<span aria-current="page">${esc(x)}</span>`}`).join("")}</nav>
${eyebrow ? `<span class="eyebrow">${esc(eyebrow)}</span>` : ""}<h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ""}</div></section>`;

function card(t0, lang) {
  const S = L[lang], t = tripFor(t0, lang), p = S.pre;
  const price = lang === "ar" ? t.egp : t.usd;
  return `<article class="card reveal"><div class="media">${photo(t.cover, lang, { alt: t.title, art: t.art })}${t.badge ? `<span class="badge ${t.old ? "hot" : ""}">${esc(t.badge)}</span>` : ""}<span class="dur">${IC.clock} ${esc(t.dur)}</span></div>
<div class="card-body"><h3><a href="${p}/trips/${t.id}.html">${esc(t.title)}</a></h3><p class="route">${esc(t.route)}</p><div class="inc">${t.inc.map(i => `<span>${esc(i)}</span>`).join("")}<span>${S.landCruiser}</span></div>
<div class="card-foot"><div class="price"><small>${t.quoteOnly ? S.price : S.from}</small><b class="num">${S.money(t.quoteOnly ? null : price)}</b></div>
<div class="btns"><a class="btn btn-ghost" href="${p}/trips/${t.id}.html">${S.details}</a><a class="btn btn-primary" href="${p}/book/?trip=${t.id}">${t.quoteOnly ? S.quote : S.book}</a></div></div></div></article>`;
}

const ORG = { "@context": "https://schema.org", "@type": "TravelAgency", name: BRAND.nameEn, alternateName: BRAND.name, url: SITE, logo: SITE + "/assets/favicon.svg", image: img("white").src,
  address: { "@type": "PostalAddress", addressLocality: "Cairo", addressCountry: "EG" }, areaServed: "Western Desert, Egypt", priceRange: "$65 – $560", availableLanguage: ["English", "Arabic"] };
const crumbLd = (lang, items) => ({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: SITE + L[lang].pre + path })) });

/* ---------- legal texts ---------- */
const PRIVACY = {
  en: `<p>We collect the minimum data needed to run your booking. This policy explains what we collect, why, for how long, and your rights.</p>
<h2>What we collect</h2><ul><li><b>Booking details:</b> name, phone/WhatsApp number, journey, date, number and age groups of travellers, accommodation choice, and any notes you write.</li><li><b>Conversations:</b> if you use the booking assistant on this site or message us on WhatsApp, we keep the conversation so we can continue helping you and review service quality.</li><li><b>Limited technical data:</b> your IP address is used briefly to prevent abuse (rate limiting) and is not stored with your booking.</li></ul>
<p>We never ask for card details on this website. Your passport is only needed on the day of the trip for police checkpoints.</p>
<h2>How we use it</h2><ul><li>To record and manage your booking and contact you about it (confirmation, deposit details, changes).</li><li>To answer your questions in the chat or on WhatsApp.</li><li>We do not send marketing messages without your explicit consent, and we never sell your data.</li></ul>
<h2>The AI booking assistant</h2><p>The assistant uses an AI model from Google (Gemini) to understand and answer your messages, so the text of your messages is sent to Google for processing. It can only reach our database through a fixed set of functions (searching journeys, availability, price, creating a booking after you agree, checking or cancelling a booking with its reference and your phone number). Please don't share sensitive data such as card numbers in the chat.</p>
<h2>Service providers that process data for us</h2><ul><li>Cloudflare — hosting of the booking server and database.</li><li>Meta (WhatsApp Business Platform) — if you message us on WhatsApp.</li><li>Google (Gemini API) — processing booking-assistant messages.</li><li>GitHub Pages — hosting of the website pages.</li><li>Wikimedia — images are loaded from Wikimedia Commons servers.</li></ul>
<h2>How long we keep it</h2><ul><li>Conversations are deleted automatically 90 days after the last message.</li><li>Booking records are kept as long as needed for accounting and legal obligations.</li></ul>
<h2>Your rights</h2><p>You can ask for a copy of your data, its correction or deletion (within what the law requires us to keep), or object to its use, in line with Egypt's Personal Data Protection Law No. 151 of 2020. Contact us through the <a href="/contact/">contact page</a>.</p>
<h2>Security</h2><p>Connections to the website and server are encrypted (HTTPS). Customer data is only accessible to the business owner through a password-protected admin panel, and every change to a booking is logged.</p>`,
  ar: `<p>بنجمع أقل بيانات ممكنة عشان نقدر ننفذ حجزك. السياسة دي بتشرح إيه اللي بنجمعه، وليه، ولمدة قد إيه، وحقوقك.</p>
<h2>البيانات اللي بنجمعها</h2><ul><li><b>بيانات الحجز:</b> الاسم، رقم الموبايل/واتساب، الرحلة، التاريخ، عدد الأفراد وفئاتهم العمرية، ونوع الإقامة، وأي ملاحظات بتكتبها بنفسك.</li><li><b>المحادثات:</b> لو استخدمت مساعد الحجز على الموقع أو كلمتنا على واتساب، بنحفظ نص المحادثة عشان نكمل معاك ونراجع جودة الخدمة.</li><li><b>بيانات تقنية محدودة:</b> عنوان IP بيستخدم مؤقتًا لمنع الإساءة (حد للطلبات) ومش بيتحفظ مع حجزك.</li></ul>
<p>مش بنطلب رقم قومي ولا بيانات بطاقة بنكية على الموقع. الباسبور أو البطاقة بتتطلب يوم الرحلة بس لنقط التفتيش.</p>
<h2>بنستخدمها في إيه</h2><ul><li>تسجيل الحجز ومتابعته والتواصل معاك بخصوصه (تأكيد، بيانات دفع المقدم، تغييرات).</li><li>الرد على أسئلتك في الشات أو واتساب.</li><li>مش بنبعت رسايل تسويقية من غير موافقتك الصريحة، ومش بنبيع بياناتك لأي حد.</li></ul>
<h2>مساعد الحجز الذكي</h2><p>مساعد الحجز بيستخدم نموذج ذكاء اصطناعي من Google (Gemini) لفهم رسالتك والرد عليها، فنص الرسالة بيتبعت لخدمة Google لمعالجته. المساعد مش بيقدر يوصل لقاعدة البيانات غير من خلال وظائف محددة (البحث في الرحلات، التوافر، السعر، إنشاء حجز بعد موافقتك، متابعة/إلغاء حجز برقمه ورقم موبايلك). متكتبش في الشات بيانات حساسة زي أرقام بطاقات.</p>
<h2>الجهات اللي بتعالج البيانات بالنيابة عننا</h2><ul><li>Cloudflare: استضافة السيرفر وقاعدة البيانات.</li><li>Meta (WhatsApp Business Platform): لو بتكلمنا على واتساب.</li><li>Google (Gemini API): لمعالجة رسايل المساعد الذكي.</li><li>GitHub Pages: استضافة صفحات الموقع.</li><li>Wikimedia: الصور بتتحمل من سيرفرات Wikimedia Commons.</li></ul>
<h2>مدة الحفظ</h2><ul><li>المحادثات: بتتمسح تلقائيًا بعد ٩٠ يوم من آخر رسالة.</li><li>بيانات الحجوزات: بنحتفظ بيها طول ما هي لازمة للحسابات والالتزامات القانونية.</li></ul>
<h2>حقوقك</h2><p>من حقك تطلب نسخة من بياناتك أو تصحيحها أو مسحها (في حدود اللي القانون بيلزمنا نحتفظ بيه)، أو تعترض على استخدامها، وده طبقًا لقانون حماية البيانات الشخصية المصري رقم ١٥١ لسنة ٢٠٢٠. كلّمنا من <a href="/ar/contact/">صفحة التواصل</a>.</p>
<h2>الأمان</h2><p>الاتصال بالموقع والسيرفر مشفّر (HTTPS)، والوصول لبيانات العملاء متاح لصاحب الشغل بس من لوحة إدارة محمية بكلمة سر، وكل التعديلات على الحجوزات بتتسجل.</p>`,
};
const TERMS = {
  en: `<h2>1. Booking</h2><ul><li>Booking on the website, in the chat or on WhatsApp creates a <b>provisional booking</b> with a reference (like SD-AB12CD), and your places are held for ${POLICY.holdHours} hours.</li><li>The booking becomes <b>confirmed</b> once we receive the deposit (${POLICY.depositRate * 100}% of the total). If the hold expires without a deposit, the places are released.</li><li>Book at least ${POLICY.minNoticeDays} days before the trip (6 weeks for the Gilf Kebir, because of security permits).</li><li>The Gilf Kebir expedition is priced on request by group size; a request is not a booking until you accept our quote.</li></ul>
<h2>2. Prices and payment</h2><ul><li>Prices are per person: in US dollars for international travellers and in Egyptian pounds for Egyptian residents (park fees for foreign visitors are higher).</li><li>A private trip adds ${Math.round((POLICY.privateMultiplier - 1) * 100)}% and uses a whole vehicle (${POLICY.carCapacity} seats). The premium accommodation upgrade adds ${POLICY.upgradeRate * 100}%.</li><li>Children under 2 travel free (without a separate seat), ages 2–5 pay 25%, ages 6–11 pay 50%, and from 12 the adult price.</li><li>The deposit can be paid by card, bank transfer, InstaPay or Vodafone Cash as available; the balance is paid on the day. Nothing is charged on this website.</li></ul>
<h2>3. Cancellation and changes</h2><ul><li>7 days or more before the trip: full refund of the deposit.</li><li>3 to 6 days before: 50% refund.</li><li>Less than 3 days: no refund, but you can move your date within 6 months.</li><li>If we cancel because of weather or permits: a full refund or a new date, as you prefer.</li><li>You can cancel on the <a href="/booking/">Manage booking</a> page or by contacting us.</li></ul>
<h2>4. Safety</h2><ul><li>Vehicles travel in convoys of at least two, with a Thuraya satellite phone and a first-aid kit.</li><li>Please follow the instructions of your guide and driver; we may adjust the programme if weather or security require it.</li><li>Carry your passport for police checkpoints.</li></ul>
<h2>5. Environment</h2><p>Protected areas are protected by law: taking rocks, fossils or Libyan Desert Glass is forbidden, and nothing may be left behind.</p>
<h2>6. Photos</h2><p>Location photos on this website are from Wikimedia Commons under free licences (see <a href="/credits/">photo credits</a>). They illustrate the places and are not photos of our own trips.</p>`,
  ar: `<h2>١. الحجز</h2><ul><li>الحجز من الموقع أو الشات أو واتساب بيسجّل <b>حجز مبدئي</b> برقم مرجعي (زي SD-AB12CD)، ومكانك بيتحجز ٤٨ ساعة.</li><li>الحجز بيتحول لـ <b>مؤكد</b> بعد استلام المقدم (٣٠٪ من الإجمالي). لو المهلة خلصت من غير دفع، المكان بيرجع متاح لغيرك.</li><li>أقل مدة للحجز قبل الرحلة ٣ أيام (والجلف الكبير ٦ أسابيع بسبب التصاريح الأمنية).</li><li>رحلة الجلف الكبير بعرض سعر حسب حجم المجموعة، والطلب مش بيعتبر حجز لحد ما توافق على العرض.</li></ul>
<h2>٢. الأسعار والدفع</h2><ul><li>الأسعار للفرد، بالجنيه المصري للمصريين وبالدولار للأجانب (رسوم المحميات للأجانب أعلى).</li><li>الرحلة الخاصة +٤٥٪ وبتاخد عربية كاملة (٤ مقاعد). الترقية الفاخرة +١٥٪.</li><li>الأطفال أقل من سنتين مجانًا (من غير كرسي منفصل)، من ٢ لـ ٥ سنين ٢٥٪، ومن ٦ لـ ١١ سنة ٥٠٪، ومن ١٢ سنة سعر الكبير.</li><li>المقدم بإنستاباي أو فودافون كاش أو تحويل بنكي أو فيزا/ماستركارد حسب المتاح، والباقي يوم الرحلة. الموقع مابيحصّلش أي فلوس أونلاين.</li></ul>
<h2>٣. الإلغاء والتأجيل</h2><ul><li>الإلغاء قبل الرحلة بـ ٧ أيام أو أكتر: استرداد كامل للمقدم.</li><li>من ٣ لـ ٦ أيام: استرداد ٥٠٪.</li><li>أقل من ٣ أيام: مفيش استرداد، لكن تقدر تأجل لميعاد تاني خلال ٦ شهور.</li><li>لو إحنا لغينا الرحلة بسبب الطقس أو التصاريح: استرداد كامل أو ميعاد بديل حسب اختيارك.</li><li>تقدر تلغي من صفحة <a href="/ar/booking/">متابعة الحجز</a> أو تكلّمنا.</li></ul>
<h2>٤. السلامة</h2><ul><li>العربيات بتطلع الصحرا في قافلة من عربيتين على الأقل ومعاها تليفون ثريا وشنطة إسعافات.</li><li>لازم تلتزم بتعليمات المرشد والسواق، ومن حقنا نعدّل البرنامج لو الطقس أو الأمن استدعى ده.</li><li>جيب معاك بطاقة الرقم القومي أو الباسبور لنقط التفتيش.</li></ul>
<h2>٥. البيئة</h2><p>المحميات أماكن محمية بالقانون: ممنوع أخذ حجارة أو حفريات أو زجاج ليبي، وممنوع ترمي أي مخلفات.</p>
<h2>٦. الصور</h2><p>صور الأماكن على الموقع من Wikimedia Commons بتراخيص حرة لأصحابها (شوف <a href="/ar/credits/">مصادر الصور</a>)، وهي للتعريف بالأماكن مش صور من رحلاتنا نفسها.</p>`,
};

/* ==================== pages per language ==================== */
const usage = {};
const use = (k, page) => { (usage[k] ||= new Set()).add(page); };
const pagesAll = [];

for (const lang of ["en", "ar"]) {
  const S = L[lang], p = S.pre, F = (rel, html) => { out((lang === "ar" ? "ar/" : "") + rel, html); };
  const DEST = destFor(lang), CATS = catFor(lang), MON = monthsFor(lang);
  const stripIcons = [IC.carL, IC.shield, IC.tent, IC.refresh];
  const add = path => pagesAll.push(p + path);

  /* home */
  F("index.html", layout(lang, {
    path: "/", fullTitle: S.homeTitle, desc: S.homeDesc, scripts: ["home.js"],
    jsonld: [ORG, { "@context": "https://schema.org", "@type": "WebSite", name: S.name, url: SITE + p + "/", inLanguage: lang }],
    body: `<section class="hero" aria-label="${esc(S.heroTags.join(", "))}">
  <div class="slides" id="slides">${HERO.map((k, i) => `<div class="slide${i === 0 ? " on" : ""}" data-place="${esc(placeFor(k, lang))}" data-credit="${esc(P[k].author)} · ${esc(P[k].license)}" data-href="${commons(P[k].file)}">${i === 0 ? `<img src="${P[k].src}" alt="${esc(placeFor(k, lang))}" fetchpriority="high" decoding="async">` : `<img data-src="${P[k].src}" alt="${esc(placeFor(k, lang))}" decoding="async">`}</div>`).join("")}</div>
  <div class="wrap">
    <span class="hero-tags">${S.heroTags.map(x => `<span>${x}</span>`).join("")}</span>
    <h1 class="split">${words(S.heroH1[0])} ${S.heroH1[1].replace(/<em>(.*)<\/em>/, (_, x) => `<em>${words(x)}</em>`)} ${words(S.heroH1[2])}</h1>
    <p class="sub">${S.heroSub}</p>
    <form class="finder" id="finder" action="${p}/trips/" method="get">
      <label for="fDest">${S.fWhere}<select id="fDest" name="dest"><option value="">${S.fAll}</option>${Object.entries(DEST).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label>
      <label for="fDate">${S.fDate}<input id="fDate" name="date" type="date"></label>
      <label for="fPax">${S.fPax}<select id="fPax" name="pax"><option>1</option><option selected>2</option><option>3</option><option>4</option><option>5</option><option>6</option><option value="8">7+</option></select></label>
      <button class="btn btn-gold" type="submit">${S.fGo}</button>
    </form>
    <div class="hero-foot"><div class="hero-dots" id="dots" role="group">${HERO.map((k, i) => `<button type="button" aria-label="${esc(placeFor(k, lang))}" aria-current="${i === 0}"></button>`).join("")}</div>
    <span class="hero-place" id="heroPlace">${esc(placeFor(HERO[0], lang))} · <a href="${commons(P[HERO[0]].file)}" target="_blank" rel="noopener">© ${esc(P[HERO[0]].author)} · ${esc(P[HERO[0]].license)}</a></span></div>
  </div>
</section>
<div class="strip"><div class="wrap">${S.strip.map(([b, s], i) => `<div>${stripIcons[i]}<span><b>${b}</b><small>${s}</small></span></div>`).join("")}</div></div>
<section id="trips"><div class="wrap">
  <div class="sec-head reveal"><div><span class="eyebrow">${S.season}</span><h2>${S.chooseH}</h2><p class="lead">${S.chooseP}</p></div>
  <div class="filters" role="group"><button class="chip" type="button" data-f="all" aria-pressed="true">${S.all}</button>${Object.entries(CATS).map(([k, v]) => `<button class="chip" type="button" data-f="${k}" aria-pressed="false">${v}</button>`).join("")}</div></div>
  <div class="grid" id="tripGrid">${TRIPS.map(t => card(t, lang)).join("")}</div>
</div></section>
<section class="dark" id="reserves"><div class="wrap">
  <div class="sec-head reveal"><div><span class="eyebrow">${S.resEy}</span><h2>${S.resH}</h2><p class="lead">${S.resP}</p></div></div>
  <div class="rgrid">${reservesFor(lang).map(r => `<div class="reserve reveal"><div class="thumb">${photo(r.img, lang, { alt: r.name, art: r.art })}</div><div><span class="yr">${esc(r.yr)}</span><h3>${esc(r.name)}</h3><p>${esc(r.t)}</p></div></div>`).join("")}</div>
</div></section>
<section id="prices" class="paper"><div class="wrap">
  <div class="sec-head reveal"><div><span class="eyebrow">${S.priceEy}</span><h2>${S.priceH}</h2><p class="lead">${S.priceP}</p></div></div>
  <div class="compare-wrap reveal"><table><thead><tr><th>${S.thTrip}</th><th>${S.thLocal}</th><th>${S.thIntl}</th><th>${S.thUsEGP}</th><th>${S.thUsUSD}</th></tr></thead>
  <tbody>${TRIPS.filter(t => t.egp).map(t0 => { const t = tripFor(t0, lang); const mk = parseInt(String(t.mkEgp).replace(/,/g, "")); const sv = mk ? Math.round((1 - t.egp / mk) * 100) : 0;
    return `<tr><td><a href="${p}/trips/${t.id}.html"><b>${esc(t.title)}</b></a><br><small style="color:var(--muted)">${esc(t.dur)}</small></td><td class="num">${lang === "ar" ? esc(t.mkEgp) + " ج.م" : "EGP " + esc(t.mkEgp)}</td><td class="num" dir="ltr">$${esc(t.mkUsd)}</td><td class="ours num">${lang === "ar" ? L.ar.money(t.egp) : "EGP " + S.nf.format(t.egp)}${sv > 0 ? `<span class="save">${S.save(sv)}</span>` : ""}</td><td class="ours num">$${S.nf.format(t.usd)}</td></tr>`; }).join("")}</tbody></table></div>
  <p class="note">${S.priceNote}</p>
</div></section>
<section class="dark"><div class="wrap">
  <div class="sec-head reveal"><div><span class="eyebrow">${S.inclEy}</span><h2>${S.inclH}</h2></div></div>
  <div class="incl">${S.incl.map(([h, x, ic]) => `<div class="reveal">${IC[ic]}<h3>${h}</h3><p>${x}</p></div>`).join("")}</div>
</div></section>
<section id="fleet"><div class="wrap fleet">
  <div class="art reveal">${photo("convoy", lang)}</div>
  <div class="reveal"><span class="eyebrow">${S.fleetEy}</span><h2 style="margin-top:12px">${S.fleetH}</h2><p class="lead" style="margin-top:14px">${S.fleetP}</p>
  <div class="specs">${S.specs.map(([a, b]) => `<div><small>${a}</small><b>${b}</b></div>`).join("")}</div></div>
</div></section>
<section class="dark"><div class="wrap">
  <div class="sec-head reveal"><div><span class="eyebrow">${S.seasEy}</span><h2>${S.seasH}</h2><p class="lead">${S.seasP}</p></div></div>
  <div class="months reveal">${MON.map((m, i) => `<div class="m ${MS[i]}">${lang === "en" ? m.slice(0, 3) : m}</div>`).join("")}</div>
  <div class="legend"><span><i style="background:var(--gold)"></i>${S.legend[0]}</span><span><i style="background:rgb(224 191 134/.3)"></i>${S.legend[1]}</span><span><i style="background:rgb(255 255 255/.08)"></i>${S.legend[2]}</span></div>
</div></section>
<section class="cta">${photo("sandSea", lang)}<div class="wrap">
  <span class="eyebrow">${S.bookCta}</span><h2 class="reveal">${S.ctaH}</h2><p class="reveal">${S.ctaP}</p>
  <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center" class="reveal"><a class="btn btn-gold" href="${p}/book/">${S.ctaB}</a><a class="btn btn-ghost" style="color:#FBF5EA;border-color:rgb(255 255 255/.35)" href="${p}/faq/">${S.ctaQ}</a></div>
</div></section>`,
  }));
  add("/");

  /* all trips */
  F("trips/index.html", layout(lang, {
    path: "/trips/", title: S.tripsTitle, desc: S.tripsDesc, scripts: ["trips.js"],
    jsonld: [crumbLd(lang, [[S.home, "/"], [S.tripsH, "/trips/"]]), { "@context": "https://schema.org", "@type": "ItemList", itemListElement: TRIPS.map((t, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE}${p}/trips/${t.id}.html`, name: tripFor(t, lang).title })) }],
    body: `${pageHead(S, lang, { eyebrow: S.season, title: S.tripsH, sub: S.tripsP, crumbs: [[null, S.tripsH]], cover: "whiteRocks" })}
<section><div class="wrap">
  <form class="toolbar" id="tf" role="search" onsubmit="return false">
    <input type="search" id="q" name="q" placeholder="${S.search}" aria-label="${S.searchLabel}">
    <select id="dest" name="dest" aria-label="${S.destLabel}"><option value="">${S.fAll}</option>${Object.entries(DEST).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select>
    <select id="month" name="month" aria-label="${S.monthLabel}"><option value="">${S.anyMonth}</option>${MON.map((m, i) => `<option value="${i + 1}">${m}</option>`).join("")}</select>
    <select id="sort" name="sort" aria-label="${S.sortLabel}"><option value="">${S.sortRec}</option><option value="price">${S.sortPrice}</option><option value="days">${S.sortDays}</option></select>
  </form>
  <div class="filters" role="group" style="margin-bottom:20px"><button class="chip" type="button" data-f="all" aria-pressed="true">${S.all}</button>${Object.entries(CATS).map(([k, v]) => `<button class="chip" type="button" data-f="${k}" aria-pressed="false">${v}</button>`).join("")}</div>
  <p class="count" id="count" aria-live="polite"></p>
  <div class="grid" id="tripGrid">${TRIPS.map(t => card(t, lang)).join("")}</div>
</div></section>`,
  }));
  add("/trips/");

  /* trip pages */
  for (const t0 of TRIPS) {
    const t = tripFor(t0, lang);
    const keys = [t.cover, ...(t.gallery || [])].filter((k, i, a) => a.indexOf(k) === i);
    const real = keys.filter(k => img(k));
    const places = keys.map(k => placeFor(k, lang)).filter(Boolean);
    const related = TRIPS.filter(x => x.id !== t.id && (x.dest === t.dest || x.cat === t.cat)).slice(0, 3);
    const base = lang === "ar" ? t.egp : t.usd;
    const money = S.money;
    const ld = { "@context": "https://schema.org", "@type": "TouristTrip", name: t.title, description: t.summary, url: `${SITE}${p}/trips/${t.id}.html`, image: real.map(k => P[k].src), touristType: "Desert safari", inLanguage: lang,
      provider: { "@type": "TravelAgency", name: BRAND.nameEn, url: SITE },
      itinerary: { "@type": "ItemList", itemListElement: places.map((x, i) => ({ "@type": "ListItem", position: i + 1, item: { "@type": "TouristAttraction", name: x } })) },
      ...(t.quoteOnly ? {} : { offers: [{ "@type": "Offer", price: t.usd, priceCurrency: "USD", availability: "https://schema.org/InStock", url: `${SITE}${p}/book/?trip=${t.id}` }, { "@type": "Offer", price: t.egp, priceCurrency: "EGP", url: `${SITE}${p}/book/?trip=${t.id}` }] }) };
    keys.forEach(k => use(k, `${p}/trips/${t.id}.html`));
    F(`trips/${t.id}.html`, layout(lang, {
      path: `/trips/${t.id}.html`, title: `${t.title} — ${t.dur}`, desc: S.tripDesc(t).slice(0, 300),
      ogImage: img(t.cover)?.src, jsonld: [ld, crumbLd(lang, [[S.home, "/"], [S.tripsH, "/trips/"], [t.title, `/trips/${t.id}.html`]])],
      scripts: ["trip.js"], bodyAttrs: `data-trip="${t.id}"`,
      body: `${pageHead(S, lang, { eyebrow: t.dur, title: t.title, sub: t.route, crumbs: [["/trips/", S.tripsH], [null, t.title]], cover: t.cover, coverArt: t.art })}
<section><div class="wrap trip-layout">
  <div>
    <div class="gallery reveal">
      <div class="main" id="gMain">${photo(keys[0], lang, { eager: true, art: t.art })}</div>
      <p class="cap" id="gCap">${esc(placeFor(keys[0], lang))}</p>
      ${keys.length > 1 ? `<div class="thumbs" role="group" aria-label="${S.galleryL}">${keys.map((k, i) => `<button type="button" data-k="${k}" aria-pressed="${i === 0}" aria-label="${esc(placeFor(k, lang))}">${photo(k, lang, { alt: "", art: t.art }).replace(/<a class="credit"[^>]*>[^<]*<\/a>/, "")}</button>`).join("")}</div>` : ""}
    </div>
    <div class="block reveal"><p style="font-size:1.12rem">${esc(t.summary)}</p>
      <div class="facts">${S.facts(t).map(([ic, x]) => `<span>${ic}${esc(x)}</span>`).join("")}</div></div>
    <div class="block reveal"><h2>${S.itinH}</h2><div class="itin">${t.itin.map(([d, x]) => `<div><b>${esc(d)}</b><p>${esc(x)}</p></div>`).join("")}</div></div>
    <div class="block reveal two"><div><h4>${S.incH}</h4><ul>${[...S.incBase, ...t.inc, ...S.incEnd].map(x => `<li>${IC.check}<span>${esc(x)}</span></li>`).join("")}</ul></div><div class="no"><h4>${S.excH}</h4><ul>${S.exc.map(x => `<li>${IC.minus}<span>${esc(x)}</span></li>`).join("")}</ul></div></div>
    <div class="block reveal"><h2>${S.placesH}</h2><p class="lead">${places.map(esc).join(" · ")}</p></div>
    <div class="block reveal"><h2>${S.seasonH}</h2><div class="month-pills">${MON.map((m, i) => `<span class="${(t.months || []).includes(i + 1) ? "on" : ""}">${m}</span>`).join("")}</div><p class="small">${S.seasonNote(t.leadDays || POLICY.minNoticeDays)}</p></div>
  </div>
  <aside class="side reveal" aria-label="${S.sideL}">
    <div class="tiers"><div><small>${S.groupPP}</small><b class="num" data-price="group">${money(t.quoteOnly ? null : base)}</b></div><div><small>${S.privatePP}</small><b class="num" data-price="private">${money(t.quoteOnly ? null : Math.round(base * POLICY.privateMultiplier))}</b></div></div>
    <p class="small">${S.kidsNote}</p>
    <div class="row"><label class="fld"><span>${S.dateL}</span><input type="date" id="sDate"></label><label class="fld"><span>${S.paxL}</span><select id="sPax">${[1, 2, 3, 4, 5, 6, 7, 8, 10, 12].map(n => `<option ${n === 2 ? "selected" : ""}>${n}</option>`).join("")}</select></label></div>
    <div class="avail" id="sAvail" aria-live="polite">${S.pickDate}</div>
    <a class="btn btn-primary btn-block" id="sBook" href="${p}/book/?trip=${t.id}">${t.quoteOnly ? S.quoteThis : S.bookThis}</a>
    <a class="btn btn-wa btn-block" id="sWa" data-wa="${esc(S.askWaMsg(t.title))}" href="${p}/contact/">${IC.wa} ${S.askWa}</a>
  </aside>
</div></section>
<section class="paper" style="border-top:1px solid var(--line)"><div class="wrap"><div class="sec-head"><div><span class="eyebrow">${S.relatedEy}</span><h2>${S.relatedH}</h2></div></div><div class="grid">${related.map(x => card(x, lang)).join("")}</div></div></section>`,
    }));
    add(`/trips/${t.id}.html`);
  }

  /* booking */
  F("book/index.html", layout(lang, {
    path: "/book/", title: S.bookTitle, desc: S.bookDesc, scripts: ["book.js"], jsonld: [crumbLd(lang, [[S.home, "/"], [S.bookTitle, "/book/"]])],
    body: `${pageHead(S, lang, { eyebrow: S.bookCta, title: S.bookH, sub: S.bookP, crumbs: [[null, S.bookTitle]], cover: "sandSea" })}
<section><div class="wrap">
  <div class="steps" aria-hidden="true">${S.steps.map((x, i) => `<span class="${i < 2 ? "on" : ""}">${i + 1} · ${x}</span>`).join("")}</div>
  <div class="book-grid">
    <form class="bk" id="bk" novalidate>
      <div class="mode-note full" id="modeNote" hidden></div>
      <label class="fld full"><span>${S.tripL}</span><select id="bTrip" required>${TRIPS.map(t0 => { const t = tripFor(t0, lang); return `<option value="${t.id}">${esc(t.title)} — ${esc(t.dur)}</option>`; }).join("")}</select></label>
      <div class="fld full"><span>${S.dateL}</span>
        <div id="calWrap" hidden><div class="cal-nav"><button type="button" id="calPrev" aria-label="${S.calPrev}">${lang === "ar" ? "›" : "‹"}</button><b id="calTitle"></b><button type="button" id="calNext" aria-label="${S.calNext}">${lang === "ar" ? "‹" : "›"}</button></div><div class="cal" id="cal" role="grid" aria-label="${S.calL}"></div></div>
        <input id="bDate" type="date" required aria-describedby="eDate"><small class="err" id="eDate"></small></div>
      <div class="fld"><span>${S.typeL}</span><div class="seg">
        <label><input type="radio" name="tier" value="group" checked><span><b>${S.group}</b><small>${S.groupS}</small></span></label>
        <label><input type="radio" name="tier" value="private"><span><b>${S.private}</b><small>${S.privateS}</small></span></label></div></div>
      <div class="fld"><span>${S.stayL}</span><div class="seg">
        <label><input type="radio" name="stay" value="std" checked><span><b>${S.std}</b><small>${S.stdS}</small></span></label>
        <label><input type="radio" name="stay" value="up"><span><b>${S.up}</b><small>${S.upS}</small></span></label></div></div>
      ${S.counters.map(([id, l, mn, mx, v]) => `<div class="fld"><span id="${id}L">${l}</span><div class="stepper"><button type="button" data-step="${id}" data-d="-1" aria-label="${S.minus}">−</button><input id="${id}" type="number" min="${mn}" max="${mx}" value="${v}" inputmode="numeric" aria-labelledby="${id}L"><button type="button" data-step="${id}" data-d="1" aria-label="${S.plus}">+</button></div></div>`).join("")}
      <div class="avail full" id="bAvail" aria-live="polite" hidden></div>
      <label class="fld"><span>${S.nameL}</span><input id="bName" autocomplete="name" placeholder="${S.namePh}" required aria-describedby="eName"><small class="err" id="eName"></small></label>
      <label class="fld"><span>${S.phoneL}</span><input id="bPhone" type="tel" autocomplete="tel" placeholder="${S.phonePh}" dir="ltr" required aria-describedby="ePhone"><small class="err" id="ePhone"></small></label>
      <label class="fld full"><span>${S.noteL}</span><textarea id="bNote" rows="2" maxlength="500" placeholder="${S.notePh}"></textarea></label>
      <label class="hp" aria-hidden="true">${S.hp}<input id="bWebsite" tabindex="-1" autocomplete="off"></label>
      <label class="check full"><input type="checkbox" id="bConsent"><span>${S.consent}</span></label>
      <small class="err full" id="eConsent"></small>
      <div class="alert err full" id="bErr" role="alert" hidden></div>
      <button class="btn btn-primary full" type="submit" id="bSubmit">${S.submit}</button>
      <div class="confirm" id="confirm" hidden></div>
    </form>
    <aside class="summary" aria-live="polite">
      <div class="media" id="sMedia"></div>
      <div class="in"><h3 id="sTitle"></h3><div class="route" id="sRoute"></div><div id="sLines"></div>
        <div class="total"><span>${S.totalL}</span><b class="num" id="sTotal"></b></div>
        <div class="deposit">${S.depositL} <b class="num" id="sDep"></b></div>
        <div class="pay">${S.pay.map(x => `<span>${x}</span>`).join("")}</div><p class="small">${S.payNote}</p></div>
    </aside>
  </div>
</div></section>`,
  }));
  add("/book/");

  /* manage booking */
  F("booking/index.html", layout(lang, {
    path: "/booking/", title: S.trackTitle, desc: S.trackDesc, scripts: ["booking.js"], noindex: true,
    body: `${pageHead(S, lang, { eyebrow: S.trackEy, title: S.trackH, sub: S.trackP, crumbs: [[null, S.trackH]], cover: "fatnas" })}
<section><div class="wrap" style="max-width:840px;display:grid;gap:20px">
  <div id="result"></div>
  <form class="panel" id="lk" novalidate>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">
      <label class="fld"><span>${S.refL}</span><input id="lRef" placeholder="SD-XXXXXX" dir="ltr" autocomplete="off" required></label>
      <label class="fld"><span>${S.phoneL}</span><input id="lPhone" type="tel" placeholder="${S.phonePh}" dir="ltr" autocomplete="tel" required></label>
    </div>
    <div class="alert err" id="lErr" role="alert" hidden></div>
    <button class="btn btn-primary" type="submit" id="lBtn">${S.showBooking}</button>
    <p class="small" id="lNote"></p>
  </form>
</div></section>`,
  }));

  /* contact */
  F("contact/index.html", layout(lang, {
    path: "/contact/", title: S.contactTitle, desc: S.contactDesc, scripts: ["contact.js"], jsonld: [ORG],
    body: `${pageHead(S, lang, { eyebrow: S.contactEy, title: S.contactH, sub: S.contactP, crumbs: [[null, S.contactTitle]], cover: "oracle" })}
<section><div class="wrap trip-layout">
  <form class="panel" id="ct" novalidate>
    <h2 style="font-size:1.9rem">${S.msgH}</h2>
    <label class="fld"><span>${S.nameS}</span><input id="cName" autocomplete="name" required></label>
    <label class="fld"><span>${S.phoneL}</span><input id="cPhone" type="tel" dir="ltr" autocomplete="tel" placeholder="${S.phonePh}" required></label>
    <label class="fld"><span>${S.msgL}</span><textarea id="cMsg" rows="5" maxlength="1500" required placeholder="${S.msgPh}"></textarea></label>
    <label class="hp" aria-hidden="true">${S.hp}<input id="cWebsite" tabindex="-1" autocomplete="off"></label>
    <label class="check"><input type="checkbox" id="cConsent"><span>${S.privacyConsent}</span></label>
    <div class="alert err" id="cErr" role="alert" hidden></div>
    <button class="btn btn-primary" type="submit" id="cBtn">${S.send}</button>
  </form>
  <aside class="side">
    <h3>${S.fastest}</h3><p class="small">${S.ourNumber} <b class="num" dir="ltr" data-wa-num>…</b></p>
    <a class="btn btn-wa btn-block" data-wa="${esc(S.waAsk)}" href="${p}/contact/">${IC.wa} ${S.openWa}</a>
    <h3>${S.officeH}</h3><p class="small">${S.officeP}</p>
    <h3>${S.haveBooking}</h3><a class="btn btn-ghost btn-block" href="${p}/booking/">${S.trackLink}</a>
  </aside>
</div></section>`,
  }));
  add("/contact/");

  /* FAQ */
  const FQ = faqFor(lang);
  F("faq/index.html", layout(lang, {
    path: "/faq/", title: S.faqTitle, desc: S.faqDesc, scripts: ["faq.js"],
    jsonld: [{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FQ.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }, crumbLd(lang, [[S.home, "/"], [S.faqTitle, "/faq/"]])],
    body: `${pageHead(S, lang, { eyebrow: S.faqEy, title: S.faqH, crumbs: [[null, S.faqTitle]], cover: "mushroom" })}
<section><div class="wrap" style="max-width:880px"><div id="faqList">${FQ.map(f => `<details class="reveal"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("")}</div>
<div class="panel" style="margin-top:32px"><b>${S.notHere}</b><div style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn btn-wa" data-wa="${esc(S.faqWa)}" href="${p}/contact/">${IC.wa} ${S.askWaBtn}</a><a class="btn btn-ghost" href="${p}/contact/">${S.sendMsg}</a></div></div></div></section>`,
  }));
  add("/faq/");

  /* legal */
  F("privacy/index.html", layout(lang, { path: "/privacy/", title: S.privacyTitle, desc: lang === "ar" ? "إزاي سفرية ديزرت بتجمع وتستخدم وتحمي بياناتك الشخصية." : "How Safarya Desert collects, uses and protects your personal data in bookings, chat and WhatsApp.",
    body: `${pageHead(S, lang, { eyebrow: S.legalEy, title: S.privacyTitle, sub: S.updated, crumbs: [[null, S.privacyTitle]] })}<section><div class="wrap prose">${PRIVACY[lang]}</div></section>` }));
  F("terms/index.html", layout(lang, { path: "/terms/", title: S.termsTitle, desc: lang === "ar" ? "شروط الحجز والدفع والإلغاء والتأجيل والأطفال والسلامة في رحلات سفرية ديزرت." : "Booking, payment, cancellation, children and safety terms for Safarya Desert journeys.",
    body: `${pageHead(S, lang, { eyebrow: S.legalEy, title: S.termsTitle, sub: S.updated, crumbs: [[null, S.termsTitle]] })}<section><div class="wrap prose">${TERMS[lang]}</div></section>` }));
  add("/privacy/"); add("/terms/");

  /* credits */
  F("credits/index.html", layout(lang, {
    path: "/credits/", title: S.creditsTitle, desc: S.creditsDesc,
    body: `${pageHead(S, lang, { eyebrow: S.creditsEy, title: S.creditsH, sub: S.creditsP(IMG.checked), crumbs: [[null, S.creditsTitle]] })}
<section><div class="wrap"><div class="compare-wrap"><table><thead><tr><th>${S.thPlace}</th><th>${S.thAuthor}</th><th>${S.thLicense}</th><th>${S.thSource}</th></tr></thead><tbody>
${Object.entries(P).map(([k, i]) => `<tr><td><b>${esc(placeFor(k, lang))}</b><br><small style="color:var(--muted)">${esc(lang === "ar" ? i.en : i.ar)}</small></td><td>${esc(i.author || "—")}</td><td>${i.licenseUrl ? `<a href="${esc(i.licenseUrl)}" target="_blank" rel="noopener">${esc(i.license)}</a>` : esc(i.license || "—")}</td><td>${i.pending ? "—" : `<a href="${commons(i.file)}" target="_blank" rel="noopener">Wikimedia Commons</a>`}</td></tr>`).join("")}
</tbody></table></div><p class="note">${S.creditsNote}</p></div></section>`,
  }));
  add("/credits/");

  /* 404 (one per language; GitHub Pages serves /404.html) */
  F("404.html", layout(lang, { path: "/404.html", title: S.nfTitle, desc: S.nfTitle, noindex: true,
    body: `${pageHead(S, lang, { title: S.nfH, sub: S.nfP, cover: "sandSea" })}<section><div class="wrap" style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn btn-primary" href="${p}/">${S.home}</a><a class="btn btn-ghost" href="${p}/trips/">${S.allTrips}</a></div></section>` }));
}

/* admin panel (owner, Arabic) */
out("admin/index.html", layout("ar", {
  path: "/admin/", title: "لوحة الإدارة", desc: "لوحة إدارة سفرية ديزرت", noindex: true, scripts: ["admin.js"], bodyAttrs: 'class="admin-body" data-no-chat', alt: false,
  body: `<section style="padding-top:24px"><div class="wrap" id="adminApp"><div class="panel" style="max-width:420px;margin:40px auto"><h1 style="font-size:1.8rem">لوحة الإدارة</h1><p class="small">بتحمّل…</p></div></div></section>`,
}));

/* image usage for the CSV */
HERO.forEach(k => use(k, "/")); use("convoy", "/"); use("sandSea", "/"); RESERVES.forEach(r => use(r.img, "/")); TRIPS.forEach(t => { use(t.cover, "/"); use(t.cover, "/trips/"); });
use("whiteRocks", "/trips/"); use("sandSea", "/book/"); use("fatnas", "/booking/"); use("oracle", "/contact/"); use("mushroom", "/faq/");

/* SEO files */
const today = new Date().toISOString().slice(0, 10);
const enPages = pagesAll.filter(x => !x.startsWith("/ar"));
out("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${enPages.flatMap(pth => [pth, "/ar" + pth]).map(u => { const en = u.replace(/^\/ar/, ""); return `  <url><loc>${SITE}${u}</loc><lastmod>${today}</lastmod><xhtml:link rel="alternate" hreflang="en" href="${SITE}${en}"/><xhtml:link rel="alternate" hreflang="ar" href="${SITE}/ar${en}"/><priority>${en === "/" ? "1.0" : en.startsWith("/trips/") ? "0.8" : "0.5"}</priority></url>`; }).join("\n")}
</urlset>
`);
out("robots.txt", `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /booking/\nDisallow: /ar/booking/\n\nSitemap: ${SITE}/sitemap.xml\n`);
const csvq = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
out("image-sources.csv", "﻿" + [["key", "place_en", "place_ar", "image_url", "source_page", "author", "license", "license_url", "verified_on", "how_verified", "used_on_pages"].join(","),
  ...Object.entries(P).map(([k, i]) => [k, i.en, i.ar, i.src || "", i.pending ? "" : commons(i.file), i.author, i.license, i.licenseUrl, i.pending ? "pending" : IMG.checked, i.match, [...(usage[k] || [])].join(" ")].map(csvq).join(","))].join("\n") + "\n");
out("assets/js/images.js", `/* Generated from data/images.json by node tools/build.mjs — do not edit by hand */\nexport const IMAGES = ${JSON.stringify(Object.fromEntries(Object.entries(P).map(([k, i]) => [k, { ar: i.ar, en: i.en, src: i.src, w: i.w, h: i.h, file: i.file, author: i.author, license: i.license, pending: !!i.pending }])))};\n`);
out("assets/favicon.svg", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="#13110E"/><circle cx="26.5" cy="13.5" r="4" fill="#E0BF86"/><path d="M4 27 Q12 18.5 20 24.5 T36 22.5 L36 28 Q30 37 20 37 Q10 37 4 28Z" fill="#E0BF86"/></svg>`);

console.log(`✔ Built ${pagesAll.length + 6} pages (EN + AR) + sitemap + robots + image-sources.csv`);
