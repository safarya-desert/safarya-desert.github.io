/* يبني صفحات الموقع الثابتة من البيانات (shared/catalog.js + data/images.json)
   التشغيل: node tools/build.mjs
   بيطلع: كل صفحات HTML، صفحة لكل رحلة، sitemap.xml، robots.txt،
   image-sources.csv، assets/js/images.js */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BRAND, TRIPS, RESERVES, FAQ, POLICY, MONTHS, CATEGORIES, DESTINATIONS } from "../shared/catalog.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const IMG = JSON.parse(readFileSync(join(ROOT, "data/images.json"), "utf8"));
const P = IMG.places;
const SITE = BRAND.url;
const VERSION = createHash("sha1").update(readFileSync(join(ROOT, "assets/css/site.css"))).digest("hex").slice(0, 8); // بيتغير بس لما الـ CSS يتغير
const out = (rel, s) => { const f = join(ROOT, rel); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, s); };
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nf = new Intl.NumberFormat("ar-EG");
const egp = v => v == null ? "عند الطلب" : nf.format(v) + " ج.م";
const usd = v => v == null ? "عند الطلب" : "$" + nf.format(v);
const img = k => (P[k] && P[k].src && !P[k].pending ? P[k] : null);
const commons = f => "https://commons.wikimedia.org/wiki/File:" + encodeURIComponent(f.replace(/ /g, "_"));

/* ---------- صورة بنفس شكل photo() في app.js ---------- */
function photo(key, { alt, eager = false, cls = "", art = "dunes" } = {}) {
  const i = img(key);
  if (!i) return `<div class="ph ${cls}" data-art="${art}"><span class="illus">رسم توضيحي</span></div>`;
  const w = i.w > i.h ? 1280 : Math.round(1280 * i.w / i.h), h = i.w > i.h ? Math.round(1280 * i.h / i.w) : 1280;
  return `<div class="ph ${cls}" data-fallback="${art}"><img src="${esc(i.src)}" alt="${esc(alt || i.ar)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" width="${w}" height="${h}" referrerpolicy="no-referrer"><a class="credit" href="${commons(i.file)}" target="_blank" rel="noopener" title="${esc(i.ar)} — ${esc(i.author)} — ${esc(i.license)}">© ${esc(i.author)} · ${esc(i.license)}</a></div>`;
}

/* ---------- الهيدر والفوتر ---------- */
const LOGO = `<svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="19" fill="#0E5F59"/><circle cx="27" cy="13" r="4.5" fill="#F2B652"/><path d="M3 27 Q12 18 20 25 T37 23 L37 30 Q30 38 20 38 Q9 38 3 30Z" fill="#EFE6D2"/><path d="M9 26 q1-6 4-6 q3 0 4 6z" fill="#fff"/></svg>`;
const NAV = [["/trips/", "الرحلات"], ["/#reserves", "المحميات"], ["/#prices", "الأسعار"], ["/faq/", "أسئلة"], ["/booking/", "متابعة حجز"], ["/contact/", "تواصل"]];
const header = () => `<a class="skip" href="#main">انتقل للمحتوى</a>
<header class="top"><div class="wrap">
  <a class="logo" href="/" aria-label="${BRAND.name} — الرئيسية">${LOGO}<span><b>سفرية</b><small>DESERT · EGYPT</small></span></a>
  <nav class="main" aria-label="القائمة الرئيسية">${NAV.map(([h, t]) => `<a href="${h}">${t}</a>`).join("")}</nav>
  <div class="cur" role="group" aria-label="العملة"><button type="button" data-cur="EGP" aria-pressed="true">مصري ج.م</button><button type="button" data-cur="USD" aria-pressed="false">أجنبي $</button></div>
  <a class="btn btn-primary" href="/book/">احجز رحلتك</a>
  <button class="menu-btn" type="button" aria-label="القائمة" aria-expanded="false" aria-controls="mnav"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
</div></header>
<nav class="mnav" id="mnav" aria-label="قائمة الموبايل">${[["/", "الرئيسية"], ...NAV].map(([h, t]) => `<a href="${h}">${t}</a>`).join("")}<a class="btn btn-primary" href="/book/">احجز رحلتك</a></nav>`;

const footer = () => `<footer><div class="wrap">
  <div><h4>${BRAND.name}</h4><p>رحلات دفع رباعي في الصحراء الغربية المصرية، من الفيوم لسيوة للجلف الكبير. بنشتغل مع بدو من أهل الواحات في كل منطقة بنزورها.</p></div>
  <div><h4>الرحلات</h4>${TRIPS.slice(0, 6).map(t => `<a href="/trips/${t.id}.html">${esc(t.title)}</a>`).join("")}<a href="/trips/">كل الرحلات ←</a></div>
  <div><h4>تواصل</h4><p>واتساب: <a href="/contact/" data-wa style="display:inline" dir="ltr"><span class="num" data-wa-num>…</span></a></p><p>المكتب: ${BRAND.city}</p><a href="/booking/">متابعة حجز</a><a href="/faq/">الأسئلة الشائعة</a><a href="/terms/">الشروط والأحكام وسياسة الإلغاء</a><a href="/privacy/">سياسة الخصوصية</a><a href="/credits/">مصادر الصور</a></div>
  <p class="copy">© ٢٠٢٦ ${BRAND.name}. صور الأماكن من Wikimedia Commons بتراخيص حرة، واسم المصوّر مكتوب على كل صورة.</p>
</div></footer>
<a class="btn btn-wa wa" data-wa="أهلًا، عايز أستفسر عن رحلة" href="/contact/" aria-label="كلّمنا على واتساب"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.2 1.3z"/></svg> واتساب</a>`;

function layout({ path, title, desc, body, scripts = [], jsonld = [], ogImage, noindex = false, bodyAttrs = "" }) {
  const url = SITE + path;
  const og = ogImage || img("white").src;
  const full = path === "/" ? `${BRAND.name} | رحلات سفاري ٤×٤ في الصحراء الغربية المصرية` : `${title} | ${BRAND.name}`;
  return `<!doctype html>
<html lang="ar" dir="rtl" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(full)}</title>
<meta name="description" content="${esc(desc)}">
${noindex ? '<meta name="robots" content="noindex, nofollow">' : `<link rel="canonical" href="${url}">`}
<meta name="theme-color" content="#0E5F59">
<meta property="og:type" content="website"><meta property="og:locale" content="ar_EG"><meta property="og:site_name" content="${BRAND.name}">
<meta property="og:title" content="${esc(full)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${esc(og)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preconnect" href="https://thumb.wikimedia.org" crossorigin><link rel="dns-prefetch" href="https://upload.wikimedia.org">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Reem+Kufi:wght@500;600;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="/assets/css/site.css?v=${VERSION}">
${jsonld.map(j => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join("\n")}
</head>
<body ${bodyAttrs}>
${header()}
<main id="main">
${body}
</main>
${footer()}
<div class="toast" id="toast" role="status" hidden></div>
<script type="module" src="/assets/js/app.js"></script>
${scripts.map(s => `<script type="module" src="/assets/js/${s}"></script>`).join("\n")}
</body>
</html>
`;
}

const pageHead = ({ eyebrow, title, sub, crumbs = [], cover, coverArt = "dunes" }) => `<section class="page-head" style="padding:0">${cover ? photo(cover, { eager: true, art: coverArt }) : ""}
<div class="wrap"><nav class="crumbs" aria-label="مسار الصفحة"><a href="/">الرئيسية</a>${crumbs.map(([h, t]) => ` / ${h ? `<a href="${h}">${esc(t)}</a>` : `<span aria-current="page">${esc(t)}</span>`}`).join("")}</nav>
${eyebrow ? `<span class="eyebrow">${esc(eyebrow)}</span>` : ""}<h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ""}</div></section>`;

/* ---------- كارت رحلة ثابت (للـ SEO، والجافاسكربت بيحدّثه) ---------- */
const card = t => `<article class="card reveal"><div class="media">${photo(t.cover, { alt: t.title, art: t.art })}${t.badge ? `<span class="badge ${t.badge === "عرض الموسم" ? "hot" : ""}">${esc(t.badge)}</span>` : ""}<span class="dur">${esc(t.dur)}</span></div>
<div class="card-body"><h3><a href="/trips/${t.id}.html">${esc(t.title)}</a></h3><p class="route">${esc(t.route)}</p><div class="inc">${t.inc.map(i => `<span>${esc(i)}</span>`).join("")}<span>لاند كروزر</span></div>
<div class="card-foot"><div class="price"><small>${t.quoteOnly ? "السعر" : "يبدأ من / للفرد"}</small><b class="num">${egp(t.egp)}</b></div>
<div class="btns"><a class="btn btn-ghost" href="/trips/${t.id}.html">التفاصيل</a><a class="btn btn-primary" href="/book/?trip=${t.id}">${t.quoteOnly ? "اطلب عرض" : "احجز"}</a></div></div></div></article>`;

const ORG = { "@context": "https://schema.org", "@type": "TravelAgency", name: BRAND.name, alternateName: BRAND.nameEn, url: SITE, logo: SITE + "/assets/favicon.svg", image: img("white").src,
  address: { "@type": "PostalAddress", addressLocality: "Cairo", addressCountry: "EG" }, areaServed: "Western Desert, Egypt", priceRange: "EGP 2,200 – 21,900" };
const crumbLd = items => ({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: SITE + path })) });

/* ==================== الرئيسية ==================== */
const HERO = ["white", "sandSea", "fatnas", "rayanFalls", "black"];
const MS = ["best", "best", "best", "ok", "ok", "", "", "", "ok", "best", "best", "best"];
const STRIP = `<div class="strip"><div class="wrap">
<div><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 16h18M5 16l2-6h10l2 6M7 19a1.5 1.5 0 1 0 0-.1M17 19a1.5 1.5 0 1 0 0-.1"/></svg><span><b>لاند كروزر ٤×٤</b><small>موديلات حديثة ومكيّفة وسواق صحراوي مرخّص</small></span></div>
<div><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/><path d="M9 12l2 2 4-4"/></svg><span><b>رسوم المحميات شاملة</b><small>تذاكر الصحراء البيضاء ووادي الحيتان جوه السعر</small></span></div>
<div><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 20l9-15 9 15z"/><path d="M12 20v-6"/></svg><span><b>مخيمات وإيكولودج</b><small>خيم مجهزة بمراتب وبطاطين، أو أوض بحمام خاص</small></span></div>
<div><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg><span><b>إلغاء مجاني</b><small>قبل ميعاد الرحلة بـ ٧ أيام واسترداد كامل</small></span></div>
</div></div>`;
const words = s => s.split(" ").map((w, i) => `<span style="--i:${i}">${w}</span>`).join(" ");

const home = layout({
  path: "/", title: BRAND.name,
  desc: "رحلات سفاري بعربيات لاند كروزر ٤×٤ من القاهرة للصحراء البيضاء والسوداء وسيوة والفيوم ووادي الحيتان والواحات والجلف الكبير. الانتقالات والإقامة والوجبات ورسوم المحميات شاملة.",
  jsonld: [ORG, { "@context": "https://schema.org", "@type": "WebSite", name: BRAND.name, url: SITE, inLanguage: "ar" }],
  scripts: ["home.js"],
  body: `<section class="hero" style="padding:0" aria-label="صور من رحلاتنا">
  <div class="slides" id="slides">${HERO.map((k, i) => `<div class="slide${i === 0 ? " on" : ""}" data-place="${esc(P[k].ar)}" data-credit="${esc(P[k].author)} · ${esc(P[k].license)}" data-href="${commons(P[k].file)}">${i === 0 ? `<img src="${P[k].src}" alt="${esc(P[k].ar)}" fetchpriority="high" decoding="async">` : `<img data-src="${P[k].src}" alt="${esc(P[k].ar)}" decoding="async">`}</div>`).join("")}</div>
  <div class="wrap">
    <span class="hero-tags"><span>الصحراء البيضاء</span><span>الصحراء السوداء</span><span>واحة سيوة</span><span>الفيوم</span><span>الجلف الكبير</span></span>
    <h1 class="split">${words("الصحراء الغربية كلها،")} <em>${words("بلاند كروزر")}</em> ${words("وخيمة تحت النجوم")}</h1>
    <p class="sub">رحلات سفاري داخلية من القاهرة بعربيات دفع رباعي. الانتقالات والإقامة في الإيكولودج أو المخيم والوجبات ورسوم المحميات كلها جوه السعر، من غير مفاجآت.</p>
    <form class="finder" id="finder" action="/trips/" method="get">
      <label for="fDest">رايح فين؟<select id="fDest" name="dest"><option value="">كل الوجهات</option>${Object.entries(DESTINATIONS).map(([k, v]) => `<option value="${k}">${v.ar}</option>`).join("")}</select></label>
      <label for="fDate">تاريخ السفر<input id="fDate" name="date" type="date"></label>
      <label for="fPax">كام فرد؟<select id="fPax" name="pax"><option>1</option><option selected>2</option><option>3</option><option>4</option><option>5</option><option>6</option><option value="8">7+</option></select></label>
      <button class="btn" type="submit">دوّر على رحلة</button>
    </form>
    <div class="hero-dots" id="dots" role="group" aria-label="اختار الصورة">${HERO.map((k, i) => `<button type="button" aria-label="${esc(P[k].ar)}" aria-current="${i === 0}"></button>`).join("")}</div>
  </div>
  <span class="hero-place" id="heroPlace">${esc(P[HERO[0]].ar)} — <a href="${commons(P[HERO[0]].file)}" target="_blank" rel="noopener">© ${esc(P[HERO[0]].author)} · ${esc(P[HERO[0]].license)}</a></span>
</section>
${STRIP}
<section id="trips"><div class="wrap">
  <div class="sec-head reveal"><div><span class="eyebrow">موسم ٢٠٢٦ / ٢٠٢٧</span><h2>اختار رحلتك</h2><p class="lead">كل الأسعار للفرد في رحلات المجموعات، شاملة النقل من القاهرة والجيزة. الرحلة الخاصة لعربيتك لوحدك بتزيد ٤٥٪.</p></div>
  <div class="filters" role="group" aria-label="نوع الرحلة"><button class="chip" type="button" data-f="all" aria-pressed="true">الكل</button>${Object.entries(CATEGORIES).map(([k, v]) => `<button class="chip" type="button" data-f="${k}" aria-pressed="false">${v}</button>`).join("")}</div></div>
  <div class="grid" id="tripGrid">${TRIPS.map(card).join("")}</div>
</div></section>
<section class="reserves" id="reserves"><div class="wrap">
  <div class="sec-head reveal"><div><span class="eyebrow">المحميات الطبيعية</span><h2 style="color:#fff">محميات بنزورها في رحلاتنا</h2><p class="lead">تذاكر دخول المحميات محسوبة في سعر الرحلة، ومرشدينا بيشرحوا جيولوجيا كل مكان وتاريخه.</p></div></div>
  <div class="rgrid">${RESERVES.map(r => `<div class="reserve reveal"><div class="thumb">${photo(r.img, { alt: r.name })}</div><div><span class="yr">${esc(r.yr)}</span><h3>${esc(r.name)}</h3><p>${esc(r.t)}</p></div></div>`).join("")}</div>
</div></section>
<section id="prices"><div class="wrap">
  <div class="sec-head reveal"><div><span class="eyebrow">مقارنة أسعار السوق</span><h2>سعر في النص بالظبط</h2><p class="lead">راجعنا أسعار شركات السفاري المصرية ومنصات الحجز العالمية، وحطينا أسعارنا تحت متوسط السوق من غير ما نقلل في العربية أو الأكل أو الإقامة.</p></div></div>
  <div class="compare-wrap reveal"><table><thead><tr><th>الرحلة</th><th>شركات محلية (للمصريين)</th><th>منصات أجنبية (للأجانب)</th><th>سفرية – مصري</th><th>سفرية – أجنبي</th></tr></thead>
  <tbody>${TRIPS.filter(t => t.egp).map(t => { const mk = parseInt(String(t.mkEgp).replace(/,/g, "")); const sv = mk ? Math.round((1 - t.egp / mk) * 100) : 0;
    return `<tr><td><a href="/trips/${t.id}.html"><b>${esc(t.title)}</b></a><br><small style="color:var(--muted)">${esc(t.dur)}</small></td><td class="num">${esc(t.mkEgp)} ج.م</td><td class="num" dir="ltr" style="text-align:right">$${esc(t.mkUsd)}</td><td class="ours num">${egp(t.egp)}${sv > 0 ? `<span class="save">أوفر ${nf.format(sv)}٪</span>` : ""}</td><td class="ours num">${usd(t.usd)}</td></tr>`; }).join("")}</tbody></table></div>
  <p class="note">أسعار السوق تقديرية من مراجعتنا لأسعار منشورة لشركات ومنصات حجز، وبتتغير حسب الموسم والعرض. الأسعار بالدولار للأجانب لأن رسوم المحميات ليهم أعلى.</p>
</div></section>
<section style="padding-top:0"><div class="wrap">
  <div class="sec-head reveal"><div><span class="eyebrow">كل اللي الرحلة محتاجاه</span><h2>السعر شامل إيه؟</h2></div></div>
  <div class="incl">${[["الانتقالات", "ميكروباص أو هاي آس مكيف من القاهرة والجيزة، وبعدها لاند كروزر ٤×٤ جوه الصحرا.", '<rect x="3" y="7" width="18" height="10" rx="2"/><path d="M7 17v2M17 17v2M3 12h18"/>'], ["الإقامة", "إيكولودج من الطين والملح في سيوة، فندق في البحرية، ومخيم بدوي في الصحراء البيضاء.", '<path d="M3 21V10l9-6 9 6v11"/><path d="M9 21v-6h6v6"/>'], ["الوجبات", "فطار وغدا وعشا بدوي مشوي على الفحم، ومية وشاي وقهوة طول الرحلة.", '<path d="M4 11h16a8 8 0 0 1-16 0zM12 3v4M8 5v2M16 5v2"/>'], ["رسوم المحميات", "تذاكر الصحراء البيضاء ووادي الريان ووادي الحيتان وتصاريح بحر الرمال.", '<path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/>'], ["مرشد سفاري", "مرشد بيتكلم عربي وإنجليزي، ودليل بدوي من أهل المنطقة.", '<circle cx="12" cy="7" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>'], ["الأنشطة", "تزلج على الرمال، سباحة في العيون الكبريتية، سهرة نجوم، وتصوير الشروق.", '<path d="M3 18c4-6 14-6 18 0M8 14l-3-6M16 14l3-6"/>']]
    .map(([h, p, ic]) => `<div class="reveal"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">${ic}</svg><h3>${h}</h3><p>${p}</p></div>`).join("")}</div>
</div></section>
<section id="fleet" style="background:var(--paper);border-block:1px solid var(--line)"><div class="wrap fleet">
  <div class="art reveal">${photo("convoy", { alt: "قافلة عربيات دفع رباعي في الصحراء الغربية" })}</div>
  <div class="reveal"><span class="eyebrow">أسطول الدفع الرباعي</span><h2>عربيات مجهزة للرملة الناعمة</h2>
  <p class="lead" style="margin-top:10px">كل عربية فيها ٤ ركاب بس عشان تبقى مرتاح، وبتطلع الصحرا مع عربية تانية على الأقل للأمان. السواقين من أهل الواحات وعارفين الطرق من غير GPS.</p>
  <div class="specs"><div><small>العربية</small><b>تويوتا لاند كروزر</b></div><div><small>الركاب في العربية</small><b class="num">٤ أفراد</b></div><div><small>التكييف</small><b>مكيّفة بالكامل</b></div><div><small>الأمان</small><b>تليفون ثريا + إسعافات</b></div></div></div>
</div></section>
<section><div class="wrap">
  <div class="sec-head reveal"><div><span class="eyebrow">أحسن وقت للسفر</span><h2>مواسم الصحراء</h2><p class="lead">الصحراء البيضاء وسيوة أحلى من أكتوبر لأبريل. في الصيف بنعمل رحلة الفيوم بالمبيت ورصد النجوم بس.</p></div></div>
  <div class="months reveal">${MONTHS.map((m, i) => `<div class="m ${MS[i]}">${m}</div>`).join("")}</div>
  <div class="legend"><span><i style="background:var(--oasis)"></i>أفضل موسم</span><span><i style="background:var(--amber-soft)"></i>مناسب مع تعديل المواعيد</span><span><i style="background:var(--sand)"></i>حر شديد، الفيوم الليلية بس</span></div>
</div></section>
<section class="book"><div class="wrap" style="display:grid;gap:18px;justify-items:start">
  <span class="eyebrow">الحجز</span><h2 class="reveal">جاهز للصحرا؟ احجز في دقيقتين</h2>
  <p class="lead reveal">اختار الرحلة والتاريخ وعدد الأفراد، والسعر بيتحسب قدامك. مكانك بيتحجز مبدئيًا ٤٨ ساعة لحد ما تدفع ٣٠٪ مقدم.</p>
  <div style="display:flex;gap:10px;flex-wrap:wrap" class="reveal"><a class="btn btn-primary" href="/book/">احجز رحلتك</a><a class="btn btn-ghost" href="/faq/">عندي سؤال الأول</a></div>
</div></section>`,
});
out("index.html", home);

/* ==================== كل الرحلات ==================== */
out("trips/index.html", layout({
  path: "/trips/", title: "كل الرحلات والأسعار",
  desc: "قائمة رحلات سفرية ديزرت: يوم واحد في الفيوم، مبيت في الصحراء البيضاء، سيوة، الواحات الكبرى، وإكسبيديشن الجلف الكبير — بالأسعار للمصريين والأجانب.",
  jsonld: [crumbLd([["الرئيسية", "/"], ["الرحلات", "/trips/"]]), { "@context": "https://schema.org", "@type": "ItemList", itemListElement: TRIPS.map((t, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE}/trips/${t.id}.html`, name: t.title })) }],
  scripts: ["trips.js"],
  body: `${pageHead({ eyebrow: "موسم ٢٠٢٦ / ٢٠٢٧", title: "كل الرحلات", sub: "١٢ رحلة من يوم واحد لـ ١٢ يوم. دوّر بالاسم أو المكان، أو صفّي حسب المدة والشهر.", crumbs: [[null, "الرحلات"]], cover: "whiteRocks" })}
<section><div class="wrap">
  <form class="toolbar" id="tf" role="search" onsubmit="return false">
    <input type="search" id="q" name="q" placeholder="دوّر: سيوة، نجوم، حيتان، مخيم…" aria-label="بحث في الرحلات">
    <select id="dest" name="dest" aria-label="الوجهة"><option value="">كل الوجهات</option>${Object.entries(DESTINATIONS).map(([k, v]) => `<option value="${k}">${v.ar}</option>`).join("")}</select>
    <select id="month" name="month" aria-label="الشهر"><option value="">أي شهر</option>${MONTHS.map((m, i) => `<option value="${i + 1}">${m}</option>`).join("")}</select>
    <select id="sort" name="sort" aria-label="الترتيب"><option value="">الترتيب المقترح</option><option value="price">الأرخص الأول</option><option value="days">الأقصر الأول</option></select>
  </form>
  <div class="filters" role="group" aria-label="مدة الرحلة" style="margin-bottom:18px"><button class="chip" type="button" data-f="all" aria-pressed="true">الكل</button>${Object.entries(CATEGORIES).map(([k, v]) => `<button class="chip" type="button" data-f="${k}" aria-pressed="false">${v}</button>`).join("")}</div>
  <p class="count" id="count" aria-live="polite"></p>
  <div class="grid" id="tripGrid">${TRIPS.map(card).join("")}</div>
</div></section>`,
}));

/* ==================== صفحة كل رحلة ==================== */
const INC_BASE = ["النقل من القاهرة والجيزة بعربية مكيفة", "لاند كروزر ٤×٤ مع سواق صحراوي"];
const INC_END = ["رسوم دخول المحميات", "مرشد سفاري", "مية وشاي وقهوة"];
const EXC = ["المشروبات الخاصة والسناكس", "البقشيش", "أنشطة اختيارية زي ركوب الجمل أو الـ ATV"];
for (const t of TRIPS) {
  const keys = [t.cover, ...(t.gallery || [])].filter((k, i, a) => a.indexOf(k) === i);
  const real = keys.filter(k => img(k));
  const places = keys.map(k => P[k]?.ar).filter(Boolean);
  const related = TRIPS.filter(x => x.id !== t.id && (x.dest === t.dest || x.cat === t.cat)).slice(0, 3);
  const ld = { "@context": "https://schema.org", "@type": "TouristTrip", name: t.title, description: t.summary, url: `${SITE}/trips/${t.id}.html`, image: real.map(k => P[k].src), touristType: "Desert safari",
    provider: { "@type": "TravelAgency", name: BRAND.name, url: SITE },
    itinerary: { "@type": "ItemList", itemListElement: places.map((p, i) => ({ "@type": "ListItem", position: i + 1, item: { "@type": "TouristAttraction", name: p } })) },
    ...(t.quoteOnly ? {} : { offers: [{ "@type": "Offer", price: t.egp, priceCurrency: "EGP", availability: "https://schema.org/InStock", url: `${SITE}/book/?trip=${t.id}`, eligibleCustomerType: "مصريين" }, { "@type": "Offer", price: t.usd, priceCurrency: "USD", url: `${SITE}/book/?trip=${t.id}` }] }) };
  out(`trips/${t.id}.html`, layout({
    path: `/trips/${t.id}.html`, title: `${t.title} — ${t.dur}`,
    desc: `${t.summary} ${t.quoteOnly ? "بعرض سعر." : `من ${egp(t.egp)} للمصريين أو ${usd(t.usd)} للأجانب للفرد.`}`.slice(0, 300),
    ogImage: img(t.cover)?.src, jsonld: [ld, crumbLd([["الرئيسية", "/"], ["الرحلات", "/trips/"], [t.title, `/trips/${t.id}.html`]])],
    scripts: ["trip.js"], bodyAttrs: `data-trip="${t.id}"`,
    body: `${pageHead({ eyebrow: t.dur, title: t.title, sub: t.route, crumbs: [["/trips/", "الرحلات"], [null, t.title]], cover: t.cover, coverArt: t.art })}
<section><div class="wrap trip-layout">
  <div>
    <div class="gallery reveal">
      <div class="main ph-host" id="gMain">${photo(keys[0], { alt: P[keys[0]]?.ar || t.title, eager: true, cls: "main", art: t.art })}</div>
      <p class="cap" id="gCap">${esc(P[keys[0]]?.ar || "")}</p>
      ${keys.length > 1 ? `<div class="thumbs" role="group" aria-label="صور الرحلة">${keys.map((k, i) => `<button type="button" data-k="${k}" aria-pressed="${i === 0}" aria-label="${esc(P[k]?.ar || "")}">${photo(k, { alt: "", art: t.art }).replace(/<a class="credit"[^>]*>[^<]*<\/a>/, "")}</button>`).join("")}</div>` : ""}
    </div>
    <div class="block reveal"><p style="font-size:1.08rem">${esc(t.summary)}</p>
      <div class="facts"><span>⏱ ${esc(t.dur)}</span><span>🚙 لاند كروزر ٤×٤</span><span>👥 ٤ ركاب في العربية</span><span>📍 التجمع من القاهرة / الجيزة</span>${t.quoteOnly ? "<span>📝 بعرض سعر</span>" : ""}</div></div>
    <div class="block reveal"><h2 style="font-size:1.5rem">البرنامج</h2><div class="itin">${t.itin.map(([d, x]) => `<div><b>${esc(d)}</b><p>${esc(x)}</p></div>`).join("")}</div></div>
    <div class="block reveal two"><div><h4>شامل</h4><ul>${[...INC_BASE, ...t.inc, ...INC_END].map(x => `<li>${esc(x)}</li>`).join("")}</ul></div><div class="no"><h4>مش شامل</h4><ul>${EXC.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div></div>
    <div class="block reveal"><h2 style="font-size:1.5rem">الأماكن في الرحلة</h2><p class="lead">${places.map(esc).join(" · ")}</p></div>
    <div class="block reveal"><h2 style="font-size:1.5rem">الموسم</h2><div class="month-pills">${MONTHS.map((m, i) => `<span class="${(t.months || []).includes(i + 1) ? "on" : ""}">${m}</span>`).join("")}</div><p class="small">الشهور المظللة هي اللي الرحلة شغالة فيها. أقل مدة للحجز قبل الرحلة: ${nf.format(t.leadDays || POLICY.minNoticeDays)} أيام.</p></div>
  </div>
  <aside class="side reveal" aria-label="السعر والحجز">
    <div class="tiers"><div><small>مجموعة / للفرد</small><b class="num" data-price="group">${egp(t.egp)}</b></div><div><small>خاصة / للفرد</small><b class="num" data-price="private">${egp(t.egp == null ? null : Math.round(t.egp * POLICY.privateMultiplier))}</b></div></div>
    <p class="small">الأطفال ٢–٥ سنين ٢٥٪، ٦–١١ سنة ٥٠٪، وأقل من سنتين مجانًا.</p>
    <div class="row"><label class="fld"><span>تاريخ السفر</span><input type="date" id="sDate"></label><label class="fld"><span>الأفراد</span><select id="sPax">${[1, 2, 3, 4, 5, 6, 7, 8, 10, 12].map(n => `<option ${n === 2 ? "selected" : ""}>${n}</option>`).join("")}</select></label></div>
    <div class="avail" id="sAvail" aria-live="polite">اختار تاريخ وهنتأكد من التوافر</div>
    <a class="btn btn-primary btn-block" id="sBook" href="/book/?trip=${t.id}">${t.quoteOnly ? "اطلب عرض سعر" : "احجز الرحلة دي"}</a>
    <a class="btn btn-wa btn-block" id="sWa" data-wa="أهلًا، عايز أستفسر عن رحلة «${esc(t.title)}»" href="/contact/">اسأل عن الرحلة على واتساب</a>
  </aside>
</div></section>
<section style="background:var(--paper);border-top:1px solid var(--line)"><div class="wrap"><div class="sec-head"><div><span class="eyebrow">ممكن تعجبك كمان</span><h2>رحلات قريبة منها</h2></div></div><div class="grid">${related.map(card).join("")}</div></div></section>`,
  }));
}

/* ==================== الحجز ==================== */
out("book/index.html", layout({
  path: "/book/", title: "احجز رحلتك", desc: "احجز رحلة سفاري في الصحراء الغربية: اختار الرحلة والتاريخ وعدد الأفراد وشوف السعر النهائي قبل التأكيد. حجز مبدئي ٤٨ ساعة ومقدم ٣٠٪.",
  scripts: ["book.js"], jsonld: [crumbLd([["الرئيسية", "/"], ["الحجز", "/book/"]])],
  body: `${pageHead({ eyebrow: "الحجز", title: "احجز رحلتك في دقيقتين", sub: "السعر بيتحسب قدامك. مكانك بيتحجز مبدئيًا ٤٨ ساعة، وبيتأكد بعد دفع ٣٠٪ مقدم.", crumbs: [[null, "الحجز"]], cover: "sandSea" })}
<section class="book"><div class="wrap">
  <div class="steps" aria-hidden="true"><span class="on">١ الرحلة والتاريخ</span><span class="on">٢ الأفراد</span><span>٣ بياناتك</span><span>٤ التأكيد</span></div>
  <div class="book-grid">
    <form class="bk" id="bk" novalidate>
      <div class="mode-note full" id="modeNote" hidden></div>
      <label class="fld full"><span>الرحلة</span><select id="bTrip" required>${TRIPS.map(t => `<option value="${t.id}">${esc(t.title)} — ${esc(t.dur)}</option>`).join("")}</select></label>
      <div class="fld full"><span>تاريخ السفر</span>
        <div id="calWrap" hidden><div class="cal-nav"><button type="button" id="calPrev" aria-label="الشهر اللي فات">›</button><b id="calTitle"></b><button type="button" id="calNext" aria-label="الشهر الجاي">‹</button></div><div class="cal" id="cal" role="grid" aria-label="الأيام المتاحة"></div></div>
        <input id="bDate" type="date" required aria-describedby="eDate"><small class="err" id="eDate"></small></div>
      <div class="fld"><span>نوع الرحلة</span><div class="seg">
        <label><input type="radio" name="tier" value="group" checked><span><b>مجموعة</b><small>مع مسافرين تانيين</small></span></label>
        <label><input type="radio" name="tier" value="private"><span><b>خاصة</b><small>عربية ليك لوحدك +٤٥٪</small></span></label></div></div>
      <div class="fld"><span>الإقامة</span><div class="seg">
        <label><input type="radio" name="stay" value="std" checked><span><b>القياسية</b><small>مخيم بدوي / لودج</small></span></label>
        <label><input type="radio" name="stay" value="up"><span><b>ترقية فاخرة</b><small>إيكولودج بريميوم +١٥٪</small></span></label></div></div>
      ${[["bAdults", "الكبار (١٢ سنة وأكتر)", 1, 24, 2], ["bKids", "أطفال ٦–١١ سنة (٥٠٪)", 0, 12, 0], ["bKidsSmall", "أطفال ٢–٥ سنين (٢٥٪)", 0, 12, 0], ["bInfants", "رضّع أقل من سنتين (مجانًا)", 0, 6, 0]].map(([id, l, mn, mx, v]) => `<div class="fld"><span id="${id}L">${l}</span><div class="stepper"><button type="button" data-step="${id}" data-d="1" aria-label="زوّد">+</button><input id="${id}" type="number" min="${mn}" max="${mx}" value="${v}" inputmode="numeric" aria-labelledby="${id}L"><button type="button" data-step="${id}" data-d="-1" aria-label="قلّل">−</button></div></div>`).join("")}
      <div class="avail full" id="bAvail" aria-live="polite" hidden></div>
      <label class="fld"><span>الاسم بالكامل</span><input id="bName" autocomplete="name" placeholder="اسمك بالكامل" required aria-describedby="eName"><small class="err" id="eName"></small></label>
      <label class="fld"><span>رقم الموبايل / واتساب</span><input id="bPhone" type="tel" autocomplete="tel" placeholder="01xxxxxxxxx" dir="ltr" required aria-describedby="ePhone"><small class="err" id="ePhone"></small></label>
      <label class="fld full"><span>ملاحظات (اختياري)</span><textarea id="bNote" rows="2" maxlength="500" placeholder="نباتي، عيد ميلاد، محتاج تصوير درون…"></textarea></label>
      <label class="hp" aria-hidden="true">سيبه فاضي<input id="bWebsite" tabindex="-1" autocomplete="off"></label>
      <label class="check full"><input type="checkbox" id="bConsent"><span>موافق على <a href="/terms/" target="_blank">الشروط وسياسة الإلغاء</a> و<a href="/privacy/" target="_blank">سياسة الخصوصية</a>، وإن فريق سفرية يتواصل معايا على الرقم ده بخصوص الحجز.</span></label>
      <small class="err full" id="eConsent"></small>
      <div class="alert err full" id="bErr" role="alert" hidden></div>
      <button class="btn btn-primary full" type="submit" id="bSubmit">أكّد الحجز المبدئي</button>
      <div class="confirm" id="confirm" hidden></div>
    </form>
    <aside class="summary" aria-live="polite">
      <div class="media" id="sMedia"></div>
      <div class="in">
        <h3 id="sTitle"></h3><div class="route" id="sRoute"></div>
        <div id="sLines"></div>
        <div class="total"><span>الإجمالي</span><b class="num" id="sTotal"></b></div>
        <div class="deposit">المقدم لتأكيد الحجز (٣٠٪): <b class="num" id="sDep"></b></div>
        <div class="pay"><span>إنستاباي</span><span>فودافون كاش</span><span>فيزا / ماستركارد</span><span>تحويل بنكي</span><span>كاش يوم الرحلة</span></div>
        <p class="small">الدفع مش أونلاين: بعد الحجز فريقنا بيبعتلك بيانات دفع المقدم على واتساب.</p>
      </div>
    </aside>
  </div>
</div></section>`,
}));

/* ==================== متابعة الحجز ==================== */
out("booking/index.html", layout({
  path: "/booking/", title: "متابعة الحجز", desc: "تابع حالة حجزك في سفرية ديزرت برقم الحجز ورقم الموبايل، أو ألغيه حسب سياسة الإلغاء.",
  scripts: ["booking.js"], noindex: true,
  body: `${pageHead({ eyebrow: "حجوزاتي", title: "متابعة الحجز", sub: "اكتب رقم الحجز (زي SD-AB12CD) ورقم الموبايل اللي حجزت بيه.", crumbs: [[null, "متابعة الحجز"]], cover: "fatnas" })}
<section><div class="wrap" style="max-width:820px;display:grid;gap:18px">
  <div id="result"></div>
  <form class="panel" id="lk" novalidate>
    <div class="row" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <label class="fld"><span>رقم الحجز</span><input id="lRef" placeholder="SD-XXXXXX" dir="ltr" autocomplete="off" required></label>
      <label class="fld"><span>رقم الموبايل</span><input id="lPhone" type="tel" placeholder="01xxxxxxxxx" dir="ltr" autocomplete="tel" required></label>
    </div>
    <div class="alert err" id="lErr" role="alert" hidden></div>
    <button class="btn btn-primary" type="submit" id="lBtn">اعرض الحجز</button>
    <p class="small" id="lNote"></p>
  </form>
</div></section>`,
}));

/* ==================== تواصل ==================== */
out("contact/index.html", layout({
  path: "/contact/", title: "تواصل معانا", desc: "كلّم فريق سفرية ديزرت على واتساب أو ابعت رسالة لرحلات خاصة ومجموعات وشركات.",
  scripts: ["contact.js"], jsonld: [ORG],
  body: `${pageHead({ eyebrow: "تواصل", title: "إحنا موجودين", sub: "لرحلة خاصة، مجموعة، شركة، أو أي سؤال قبل ما تحجز.", crumbs: [[null, "تواصل"]], cover: "oracle" })}
<section><div class="wrap trip-layout">
  <form class="panel" id="ct" novalidate>
    <h2 style="font-size:1.4rem">ابعتلنا رسالة</h2>
    <label class="fld"><span>الاسم</span><input id="cName" autocomplete="name" required></label>
    <label class="fld"><span>رقم الموبايل / واتساب</span><input id="cPhone" type="tel" dir="ltr" autocomplete="tel" placeholder="01xxxxxxxxx" required></label>
    <label class="fld"><span>رسالتك</span><textarea id="cMsg" rows="5" maxlength="1500" required placeholder="مثلًا: عايزين رحلة سيوة لـ ١٢ فرد في ديسمبر"></textarea></label>
    <label class="hp" aria-hidden="true">سيبه فاضي<input id="cWebsite" tabindex="-1" autocomplete="off"></label>
    <label class="check"><input type="checkbox" id="cConsent"><span>موافق على <a href="/privacy/" target="_blank">سياسة الخصوصية</a> وإنكم تتواصلوا معايا على الرقم ده.</span></label>
    <div class="alert err" id="cErr" role="alert" hidden></div>
    <button class="btn btn-primary" type="submit" id="cBtn">ابعت</button>
  </form>
  <aside class="side">
    <h3>أسرع طريقة: واتساب</h3>
    <p class="small">رقمنا: <b class="num" dir="ltr" data-wa-num>…</b></p>
    <a class="btn btn-wa btn-block" data-wa="أهلًا، عايز أستفسر عن رحلة" href="#">افتح واتساب</a>
    <h3>المكتب</h3><p class="small">${BRAND.city}. التجمع للرحلات من ميدان التحرير أو الجيزة أو ٦ أكتوبر.</p>
    <h3>عندك حجز؟</h3><a class="btn btn-ghost btn-block" href="/booking/">تابع حجزك</a>
  </aside>
</div></section>`,
}));

/* ==================== الأسئلة الشائعة ==================== */
out("faq/index.html", layout({
  path: "/faq/", title: "الأسئلة الشائعة", desc: "إجابات عن مواعيد التحرك، اللي تجيبه معاك، أسعار الأطفال، المخيم، تأكيد الحجز، سياسة الإلغاء، ورحلة الجلف الكبير.",
  scripts: ["faq.js"],
  jsonld: [{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }, crumbLd([["الرئيسية", "/"], ["الأسئلة الشائعة", "/faq/"]])],
  body: `${pageHead({ eyebrow: "قبل ما تسافر", title: "أسئلة بتتكرر", crumbs: [[null, "الأسئلة الشائعة"]], cover: "mushroom" })}
<section><div class="wrap" style="max-width:860px"><div id="faqList">${FAQ.map(f => `<details class="reveal"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("")}</div>
<div class="panel" style="margin-top:22px"><b>سؤالك مش هنا؟</b><div style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn btn-wa" data-wa="عندي سؤال:" href="/contact/">اسألنا على واتساب</a><a class="btn btn-ghost" href="/contact/">ابعت رسالة</a></div></div></div></section>`,
}));

/* ==================== الخصوصية والشروط ==================== */
out("privacy/index.html", layout({
  path: "/privacy/", title: "سياسة الخصوصية", desc: "إزاي سفرية ديزرت بتجمع وتستخدم وتحمي بياناتك الشخصية في الحجز والشات وواتساب.",
  body: `${pageHead({ eyebrow: "قانوني", title: "سياسة الخصوصية", sub: "آخر تحديث: أكتوبر ٢٠٢٦", crumbs: [[null, "سياسة الخصوصية"]] })}
<section><div class="wrap prose">
<p>بنجمع أقل بيانات ممكنة عشان نقدر ننفذ حجزك. السياسة دي بتشرح إيه اللي بنجمعه، وليه، ولمدة قد إيه، وحقوقك.</p>
<h2>البيانات اللي بنجمعها</h2><ul>
<li><b>بيانات الحجز:</b> الاسم، رقم الموبايل/واتساب، الرحلة، التاريخ، عدد الأفراد وفئاتهم العمرية، ونوع الإقامة، وأي ملاحظات بتكتبها بنفسك.</li>
<li><b>المحادثات:</b> لو استخدمت مساعد الحجز على الموقع أو كلمتنا على واتساب، بنحفظ نص المحادثة عشان نكمل معاك ونراجع جودة الخدمة.</li>
<li><b>بيانات تقنية محدودة:</b> عنوان IP بيستخدم مؤقتًا لمنع الإساءة (حد للطلبات) ومش بيتحفظ مع حجزك.</li></ul>
<p>مش بنطلب رقم قومي ولا بيانات بطاقة بنكية على الموقع. الباسبور أو البطاقة بتتطلب يوم الرحلة بس لنقط التفتيش.</p>
<h2>بنستخدمها في إيه</h2><ul><li>تسجيل الحجز ومتابعته والتواصل معاك بخصوصه (تأكيد، بيانات دفع المقدم، تغييرات).</li><li>الرد على أسئلتك في الشات أو واتساب.</li><li>مش بنبعت رسايل تسويقية من غير موافقتك الصريحة، ومش بنبيع بياناتك لأي حد.</li></ul>
<h2>مساعد الحجز الذكي</h2><p>مساعد الحجز بيستخدم نموذج ذكاء اصطناعي من Google (Gemini) لفهم رسالتك والرد عليها، فنص الرسالة بيتبعت لخدمة Google لمعالجته. المساعد مش بيقدر يوصل لقاعدة البيانات غير من خلال وظائف محددة (البحث في الرحلات، التوافر، السعر، إنشاء حجز بعد موافقتك، متابعة/إلغاء حجز برقمه ورقم موبايلك). متكتبش في الشات بيانات حساسة زي أرقام بطاقات.</p>
<h2>الجهات اللي بتعالج البيانات بالنيابة عننا</h2><ul><li>Cloudflare: استضافة السيرفر وقاعدة البيانات.</li><li>Meta (WhatsApp Business Platform): لو بتكلمنا على واتساب.</li><li>Google (Gemini API): لمعالجة رسايل المساعد الذكي.</li><li>GitHub Pages: استضافة صفحات الموقع.</li><li>Wikimedia: الصور بتتحمل من سيرفرات Wikimedia Commons.</li></ul>
<h2>مدة الحفظ</h2><ul><li>المحادثات: بتتمسح تلقائيًا بعد ٩٠ يوم من آخر رسالة.</li><li>بيانات الحجوزات: بنحتفظ بيها طول ما هي لازمة للحسابات والالتزامات القانونية.</li></ul>
<h2>حقوقك</h2><p>من حقك تطلب نسخة من بياناتك أو تصحيحها أو مسحها (في حدود اللي القانون بيلزمنا نحتفظ بيه)، أو تعترض على استخدامها، وده طبقًا لقانون حماية البيانات الشخصية المصري رقم ١٥١ لسنة ٢٠٢٠. كلّمنا من <a href="/contact/">صفحة التواصل</a>.</p>
<h2>الأمان</h2><p>الاتصال بالموقع والسيرفر مشفّر (HTTPS)، والوصول لبيانات العملاء متاح لصاحب الشغل بس من لوحة إدارة محمية بكلمة سر، وكل التعديلات على الحجوزات بتتسجل.</p>
<p class="muted">لو عندك أي سؤال عن خصوصيتك كلّمنا من صفحة التواصل.</p>
</div></section>`,
}));

out("terms/index.html", layout({
  path: "/terms/", title: "الشروط والأحكام وسياسة الإلغاء", desc: "شروط الحجز والدفع والإلغاء والتأجيل والأطفال والسلامة في رحلات سفرية ديزرت.",
  body: `${pageHead({ eyebrow: "قانوني", title: "الشروط والأحكام", sub: "آخر تحديث: أكتوبر ٢٠٢٦", crumbs: [[null, "الشروط والأحكام"]] })}
<section><div class="wrap prose">
<h2>١. الحجز</h2><ul><li>الحجز من الموقع أو الشات أو واتساب بيسجّل <b>حجز مبدئي</b> برقم مرجعي (زي SD-AB12CD)، ومكانك بيتحجز ${nf.format(POLICY.holdHours)} ساعة.</li><li>الحجز بيتحول لـ <b>مؤكد</b> بعد استلام المقدم (${nf.format(POLICY.depositRate * 100)}٪ من الإجمالي). لو المهلة خلصت من غير دفع، المكان بيرجع متاح لغيرك.</li><li>أقل مدة للحجز قبل الرحلة ${nf.format(POLICY.minNoticeDays)} أيام (والجلف الكبير ٦ أسابيع بسبب التصاريح الأمنية).</li><li>رحلة الجلف الكبير بعرض سعر حسب حجم المجموعة، والطلب مش بيعتبر حجز لحد ما توافق على العرض.</li></ul>
<h2>٢. الأسعار والدفع</h2><ul><li>الأسعار للفرد، بالجنيه المصري للمصريين وبالدولار للأجانب (رسوم المحميات للأجانب أعلى).</li><li>الرحلة الخاصة +${nf.format((POLICY.privateMultiplier - 1) * 100)}٪ وبتاخد عربية كاملة (${nf.format(POLICY.carCapacity)} مقاعد). الترقية الفاخرة +${nf.format(POLICY.upgradeRate * 100)}٪.</li><li>الأطفال أقل من سنتين مجانًا (من غير كرسي منفصل)، من ٢ لـ ٥ سنين ٢٥٪، ومن ٦ لـ ١١ سنة ٥٠٪، ومن ١٢ سنة سعر الكبير.</li><li>المقدم بإنستاباي أو فودافون كاش أو تحويل بنكي أو فيزا/ماستركارد حسب المتاح، والباقي يوم الرحلة. الموقع مابيحصّلش أي فلوس أونلاين.</li></ul>
<h2>٣. الإلغاء والتأجيل</h2><ul><li>الإلغاء قبل الرحلة بـ ٧ أيام أو أكتر: استرداد كامل للمقدم.</li><li>من ٣ لـ ٦ أيام: استرداد ٥٠٪.</li><li>أقل من ٣ أيام: مفيش استرداد، لكن تقدر تأجل لميعاد تاني خلال ٦ شهور.</li><li>لو إحنا لغينا الرحلة بسبب الطقس أو التصاريح: استرداد كامل أو ميعاد بديل حسب اختيارك.</li><li>تقدر تلغي من صفحة <a href="/booking/">متابعة الحجز</a> أو تكلّمنا.</li></ul>
<h2>٤. السلامة</h2><ul><li>العربيات بتطلع الصحرا في قافلة من عربيتين على الأقل ومعاها تليفون ثريا وشنطة إسعافات.</li><li>لازم تلتزم بتعليمات المرشد والسواق، ومن حقنا نعدّل البرنامج لو الطقس أو الأمن استدعى ده.</li><li>جيب معاك بطاقة الرقم القومي أو الباسبور لنقط التفتيش.</li></ul>
<h2>٥. البيئة</h2><p>المحميات أماكن محمية بالقانون: ممنوع أخذ حجارة أو حفريات أو زجاج ليبي، وممنوع ترمي أي مخلفات.</p>
<h2>٦. الصور</h2><p>صور الأماكن على الموقع من Wikimedia Commons بتراخيص حرة لأصحابها (شوف <a href="/credits/">مصادر الصور</a>)، وهي للتعريف بالأماكن مش صور من رحلاتنا نفسها.</p>
</div></section>`,
}));

/* ==================== مصادر الصور ==================== */
const usage = {};
const use = (k, page) => { (usage[k] ||= new Set()).add(page); };
HERO.forEach(k => use(k, "/")); use("convoy", "/"); RESERVES.forEach(r => use(r.img, "/"));
TRIPS.forEach(t => { use(t.cover, "/"); use(t.cover, "/trips/"); [t.cover, ...(t.gallery || [])].forEach(k => use(k, `/trips/${t.id}.html`)); });
use("whiteRocks", "/trips/"); use("sandSea", "/book/"); use("fatnas", "/booking/"); use("oracle", "/contact/"); use("mushroom", "/faq/");
out("credits/index.html", layout({
  path: "/credits/", title: "مصادر الصور", desc: "مصادر وتراخيص صور الأماكن المستخدمة في موقع سفرية ديزرت.",
  body: `${pageHead({ eyebrow: "شفافية", title: "مصادر الصور وتراخيصها", sub: `كل صور الأماكن حقيقية من Wikimedia Commons. آخر تحقق: ${IMG.checked}.`, crumbs: [[null, "مصادر الصور"]] })}
<section><div class="wrap"><div class="compare-wrap"><table><thead><tr><th>المكان</th><th>المصوّر</th><th>الترخيص</th><th>المصدر</th></tr></thead><tbody>
${Object.entries(P).map(([k, i]) => `<tr><td><b>${esc(i.ar)}</b><br><small style="color:var(--muted)">${esc(i.en)}</small></td><td>${esc(i.author || "—")}</td><td>${i.licenseUrl ? `<a href="${esc(i.licenseUrl)}" target="_blank" rel="noopener">${esc(i.license)}</a>` : esc(i.license || "—")}</td><td>${i.pending ? "<span class='small'>لسه بيتحقق — الموقع بيعرض رسم توضيحي</span>" : `<a href="${commons(i.file)}" target="_blank" rel="noopener">Wikimedia Commons</a>`}</td></tr>`).join("")}
</tbody></table></div>
<p class="note">الصور مستخدمة من غير تعديل غير تصغير المقاس. تراخيص CC BY و CC BY-SA بتسمح بالاستخدام التجاري بشرط ذكر اسم المصوّر والترخيص، وده مكتوب على كل صورة في الموقع.</p></div></section>`,
}));

/* ==================== لوحة الإدارة ==================== */
out("admin/index.html", layout({
  path: "/admin/", title: "لوحة الإدارة", desc: "لوحة إدارة سفرية ديزرت", noindex: true, scripts: ["admin.js"], bodyAttrs: 'class="admin-body" data-no-chat',
  body: `<section style="padding-top:24px"><div class="wrap" id="adminApp"><div class="panel" style="max-width:420px;margin:40px auto">
<h1 style="font-size:1.6rem">لوحة الإدارة</h1><p class="small">بتحمّل…</p></div></div></section>`,
}));

/* ==================== 404 ==================== */
out("404.html", layout({
  path: "/404.html", title: "الصفحة مش موجودة", desc: "الصفحة مش موجودة", noindex: true,
  body: `${pageHead({ title: "تُهنا في الصحرا 🏜️", sub: "الصفحة دي مش موجودة. ارجع للرئيسية أو شوف الرحلات.", cover: "sandSea" })}
<section><div class="wrap" style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn btn-primary" href="/">الرئيسية</a><a class="btn btn-ghost" href="/trips/">كل الرحلات</a></div></section>`,
}));

/* ==================== SEO + بيانات الصور ==================== */
const pages = ["/", "/trips/", ...TRIPS.map(t => `/trips/${t.id}.html`), "/book/", "/contact/", "/faq/", "/privacy/", "/terms/", "/credits/"];
const today = new Date().toISOString().slice(0, 10);
out("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(p => `  <url><loc>${SITE}${p}</loc><lastmod>${today}</lastmod><priority>${p === "/" ? "1.0" : p.startsWith("/trips/") ? "0.8" : "0.5"}</priority></url>`).join("\n")}
</urlset>
`);
out("robots.txt", `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /booking/\n\nSitemap: ${SITE}/sitemap.xml\n`);

const csvq = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
out("image-sources.csv", "﻿" + [["key", "place_ar", "place_en", "image_url", "source_page", "author", "license", "license_url", "verified_on", "how_verified", "used_on_pages"].join(","),
  ...Object.entries(P).map(([k, i]) => [k, i.ar, i.en, i.src || "", i.pending ? "" : commons(i.file), i.author, i.license, i.licenseUrl, i.pending ? "pending" : IMG.checked, i.match, [...(usage[k] || [])].join(" ")].map(csvq).join(","))].join("\n") + "\n");

out("assets/js/images.js", `/* متولّد تلقائيًا من data/images.json بالأمر node tools/build.mjs — متعدلوش بإيدك */\nexport const IMAGES = ${JSON.stringify(Object.fromEntries(Object.entries(P).map(([k, i]) => [k, { ar: i.ar, src: i.src, w: i.w, h: i.h, file: i.file, author: i.author, license: i.license, pending: !!i.pending }])))};\n`);
out("assets/favicon.svg", LOGO.replace('width="40" height="40" ', 'xmlns="http://www.w3.org/2000/svg" ').replace(' aria-hidden="true"', ""));

console.log(`✔ اتبنى ${pages.length + 4} صفحة + sitemap + robots + image-sources.csv`);
