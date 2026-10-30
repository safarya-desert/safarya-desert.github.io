/* اختبار المتصفح الكامل (Playwright): كل الصفحات على موبايل وكمبيوتر + سيناريو حجز حقيقي من الواجهة.
   محتاج سيرفر التجربة شغال:  node --no-warnings tools/dev-server.mjs
   التشغيل:  node tools/e2e.mjs [BASE] [SHOTS_DIR] [PLACEHOLDER_JPG] */
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import { readFileSync, mkdirSync } from "node:fs";

const BASE = process.argv[2] || "http://localhost:8080";
const SHOTS = process.argv[3] || "./e2e-shots";
const PH = process.argv[4] ? readFileSync(process.argv[4]) : null;
mkdirSync(SHOTS, { recursive: true });
const results = [];
const ok = (name, cond, info = "") => results.push([cond ? "✅" : "❌", name, cond ? "" : info]);

const browser = await chromium.launch();
async function ctx(viewport, mobile = false) {
  const c = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, locale: "ar-EG", timezoneId: "Africa/Cairo" });
  // صور Wikimedia مش متاحة في بيئة الاختبار → صورة بديلة محلية (أو نسيبها تفشل عشان نختبر الرسم الاحتياطي)
  await c.route(/wikimedia\.org/, r => (PH ? r.fulfill({ status: 200, contentType: "image/jpeg", body: PH }) : r.abort()));
  await c.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  return c;
}
async function visit(page, path) {
  const errors = [];
  page.on("pageerror", e => { if (!/Transition was aborted/.test(e.message)) errors.push(e.message); }); // انتقال الصفحات بيتلغي لما Playwright يفتح رابط مباشرة — مش خطأ في الموقع
  page.on("console", m => { if (m.type() === "error" && !/net::ERR_FAILED|Failed to load resource|Transition was aborted/.test(m.text())) errors.push(m.text()); });
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: "html{scroll-behavior:auto!important}" }); // التمرير الناعم بيلخبط Playwright بس
  await page.waitForTimeout(600);
  return errors;
}

const EN_PAGES = ["/", "/trips/", "/trips/bw2.html", "/trips/gilf.html", "/trips/djara.html", "/book/?trip=siwa3", "/booking/", "/contact/", "/faq/", "/privacy/", "/terms/", "/credits/"];
const PAGES = [...EN_PAGES, ...EN_PAGES.map(p => "/ar" + p), "/admin/", "/does-not-exist"];
for (const [label, vp, mob] of [["desktop", { width: 1366, height: 860 }, false], ["mobile", { width: 375, height: 812 }, true]]) {
  const c = await ctx(vp, mob);
  for (const path of PAGES) {
    const page = await c.newPage();
    const errs = await visit(page, path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const brokenLinks = await page.evaluate(() => [...document.querySelectorAll("a[href]")].map(a => a.getAttribute("href")).filter(h => h === "#" || h === "" || h.startsWith("javascript")).length);
    ok(`${label} ${path}: من غير أخطاء JS`, errs.length === 0, errs.join(" | "));
    ok(`${label} ${path}: مفيش سكرول عرضي`, overflow <= 1, `overflow ${overflow}px`);
    ok(`${label} ${path}: مفيش روابط فاضية`, brokenLinks === 0, `${brokenLinks} links`);
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } scrollTo(0, 0); });
    await page.waitForTimeout(900);
    const hidden = await page.evaluate(() => [...document.querySelectorAll(".reveal:not(.in)")].length);
    ok(`${label} ${path}: كل العناصر ظهرت بعد التمرير`, hidden === 0, `${hidden} hidden`);
    const name = (path === "/" ? "home" : path.replace(/[/?=.]+/g, "_").replace(/^_|_$/g, "")) + "-" + label;
    await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: path === "/" || path.startsWith("/trips/bw2") || path.startsWith("/book/") });
    await page.close();
  }
  await c.close();
}

/* كل الروابط الداخلية بترجع 200 */
{
  const c = await ctx({ width: 1280, height: 800 }); const page = await c.newPage();
  const seen = new Set(), bad = [];
  for (const p of PAGES.slice(0, 24)) {
    await page.goto(BASE + p, { waitUntil: "domcontentloaded" });
    for (const h of await page.evaluate(() => [...document.querySelectorAll("a[href^='/']")].map(a => a.getAttribute("href").split("#")[0]))) seen.add(h);
  }
  for (const h of seen) { const r = await page.request.get(BASE + h); if (r.status() !== 200) bad.push(`${h} → ${r.status()}`); }
  ok(`كل الروابط الداخلية شغالة (${seen.size} رابط)`, bad.length === 0, bad.join(", "));
  await c.close();
}

/* سيناريو الحجز من الواجهة */
const api = await (await fetch(BASE + "/api/health").catch(() => null))?.json().catch(() => null);
if (api?.ok) {
  const c = await ctx({ width: 390, height: 844 }, true); const page = await c.newPage();
  const errs = await visit(page, "/book/?trip=siwa3");
  await page.waitForSelector("#cal button:not([disabled])", { timeout: 8000 });
  const days = await page.$$("#cal button:not([disabled])");
  ok("التقويم بيعرض أيام متاحة من السيرفر", days.length > 5, String(days.length));
  await days[3].click();
  await page.waitForSelector("#bAvail.ok", { timeout: 5000 });
  ok("التوافر بيتأكد بعد اختيار اليوم", true);
  await page.click('[data-step="bKids"][data-d="1"]');
  const total = await page.textContent("#sTotal");
  ok("الإجمالي محسوب بالدولار (٢ كبار + طفل)", /\$650/.test(total), total);
  await page.click("#bSubmit");
  ok("التحقق بيمنع الإرسال من غير بيانات", await page.isVisible("#eName:not(:empty)"));
  await page.fill("#bName", "مستخدم تجربة");
  await page.fill("#bPhone", "01011112222");
  await page.check("#bConsent");
  await page.click("#bSubmit");
  await page.waitForURL(/\/booking\/\?ref=SD-/, { timeout: 8000 });
  await page.waitForSelector(".refbox", { timeout: 6000 });
  const ref = (await page.textContent(".refbox")).trim();
  ok("الحجز اتسجل ورقم الحجز ظهر مع حركة النجاح", /^SD-[A-Z0-9]{6}$/.test(ref), ref);
  ok("حالة الحجز: Awaiting deposit", (await page.textContent(".status-pill")).includes("Awaiting"));
  await page.waitForTimeout(1300);
  await page.screenshot({ path: `${SHOTS}/flow-booked-mobile.png`, fullPage: true });
  // نفس اليوم ونفس الرقم تاني → رسالة منع التكرار
  await page.goto(BASE + "/book/?trip=siwa3"); await page.addStyleTag({ content: "html{scroll-behavior:auto!important}" });
  await page.waitForSelector("#cal button:not([disabled])");
  await (await page.$$("#cal button:not([disabled])"))[3].click();
  await page.fill("#bName", "مستخدم تجربة"); await page.fill("#bPhone", "01011112222"); await page.check("#bConsent");
  await page.click('[data-step="bKids"][data-d="1"]');
  await page.click("#bSubmit");
  await page.waitForSelector("#bErr:not([hidden])", { timeout: 6000 });
  ok("الحجز المكرر بيترفض برسالة واضحة", (await page.textContent("#bErr")).includes("already have a booking"), await page.textContent("#bErr"));
  // متابعة وإلغاء
  await page.goto(BASE + "/booking/"); await page.addStyleTag({ content: "html{scroll-behavior:auto!important}" });
  await page.fill("#lRef", ref); await page.fill("#lPhone", "01011112222"); await page.click("#lBtn");
  await page.waitForSelector(".status-pill");
  await page.click("details summary"); await page.click("#cancelBtn"); await page.click("#cancelBtn");
  await page.waitForSelector(".status-pill.cancelled", { timeout: 6000 });
  ok("الإلغاء من صفحة المتابعة شغال", true);
  await page.fill("#lRef", ref); await page.fill("#lPhone", "01099999999"); await page.click("#lBtn");
  await page.waitForSelector("#lErr:not([hidden])");
  ok("رقم موبايل غلط مايكشفش الحجز", (await page.textContent("#lErr")).includes("No booking found"));
  // الشات بيظهر وبيرد حتى لو الوكيل مش متظبط
  await page.goto(BASE + "/"); await page.waitForSelector(".chat-fab");
  await page.click(".chat-fab"); await page.fill(".chat textarea", "عايز رحلة سيوة"); await page.press(".chat textarea", "Enter");
  await page.waitForSelector(".chat .msg.b >> nth=1", { timeout: 8000 });
  ok("الشات بيرد برسالة مفهومة لو الوكيل مش متاح", (await page.textContent(".chat .msg.b >> nth=1")).length > 10);
  await page.screenshot({ path: `${SHOTS}/chat-mobile.png` });
  ok("سيناريو الحجز من غير أخطاء JS", errs.length === 0, errs.join(" | "));
  // لوحة الإدارة
  const a = await c.newPage(); await visit(a, "/admin/");
  await a.fill("#pw", "wrong"); await a.click("#lb"); await a.waitForSelector("#le:not([hidden])");
  ok("الإدارة: كلمة سر غلط مرفوضة", true);
  await a.fill("#pw", process.env.ADMIN_PASSWORD || "admin-dev"); await a.click("#lb");
  await a.waitForSelector("#bl table", { timeout: 6000 });
  ok("الإدارة: الحجوزات ظاهرة بعد الدخول", (await a.$$("#bl tr[data-ref]")).length >= 1);
  await a.setViewportSize({ width: 1280, height: 860 });
  await a.screenshot({ path: `${SHOTS}/admin-desktop.png`, fullPage: true });
  await a.click("#bl tr[data-ref]"); await a.waitForSelector(".drawer .kv");
  await a.screenshot({ path: `${SHOTS}/admin-drawer.png` });
  await c.close();
}

/* تقليل الحركة: مفيش أنيميشن شغال */
{
  const c = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1280, height: 800 } });
  await c.route(/wikimedia|fonts\./, r => r.abort());
  const page = await c.newPage(); await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const op = await page.evaluate(() => getComputedStyle(document.querySelector(".reveal")).opacity);
  ok("prefers-reduced-motion: المحتوى ظاهر من غير حركة", op === "1", op);
  await c.close();
}

await browser.close();
for (const r of results) console.log(r[0], r[1], r[2] ? "→ " + r[2] : "");
const failed = results.filter(r => r[0] === "❌").length;
console.log(`\n${results.length - failed}/${results.length} نجح`);
process.exit(failed ? 1 : 0);
