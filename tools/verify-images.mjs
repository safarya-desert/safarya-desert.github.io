/* إعادة التحقق من صور الأماكن على Wikimedia Commons:
   - بيتأكد إن كل ملف لسه موجود
   - بيحدّث المصوّر والترخيص والمقاس ورابط الصورة من الـ API الرسمي
   - بيكمّل أي صورة «pending» (زي كهف جارة) لو بياناتها اتجابت
   التشغيل (محتاج إنترنت):  node tools/verify-images.mjs && node tools/build.mjs */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const FILE = join(dirname(fileURLToPath(import.meta.url)), "..", "data/images.json");
const data = JSON.parse(readFileSync(FILE, "utf8"));
const entries = Object.entries(data.places);
const strip = h => String(h || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const FREE = /^(CC BY|CC BY-SA|CC0|Public domain|Attribution)/i;
let problems = 0;

for (let i = 0; i < entries.length; i += 25) {
  const chunk = entries.slice(i, i + 25);
  const titles = chunk.map(([, p]) => "File:" + p.file.replace(/_/g, " ")).join("|");
  const url = "https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1280&titles=" + encodeURIComponent(titles);
  const r = await fetch(url, { headers: { "user-agent": "StarfallDesertSite/1.0 (image license check)" } });
  if (!r.ok) throw new Error("Commons API " + r.status);
  const j = await r.json();
  const byTitle = Object.fromEntries(j.query.pages.map(p => [p.title, p]));
  const norm = Object.fromEntries((j.query.normalized || []).map(n => [n.from, n.to]));
  for (const [key, p] of chunk) {
    const t = "File:" + p.file.replace(/_/g, " ");
    const page = byTitle[norm[t] || t] || byTitle[t];
    if (!page || page.missing || !page.imageinfo) { console.log(`❌ ${key}: الملف مش موجود على Commons (${p.file})`); problems++; continue; }
    const ii = page.imageinfo[0], m = ii.extmetadata || {};
    const lic = m.LicenseShortName?.value || "";
    if (!FREE.test(lic)) { console.log(`⚠️ ${key}: ترخيص غير معروف «${lic}» — راجعه يدويًا`); problems++; }
    const big = ii.width > 1280;
    Object.assign(p, {
      src: (big ? ii.thumburl : ii.url).replace(/\?utm_.*$/, ""), w: ii.width, h: ii.height,
      license: lic, licenseUrl: m.LicenseUrl?.value || p.licenseUrl || "", author: strip(m.Artist?.value).slice(0, 120) || p.author,
    });
    if (p.pending && FREE.test(lic)) { delete p.pending; console.log(`✅ ${key}: اتكمّلت بياناته — راجع إن الصورة فعلًا للمكان قبل النشر`); }
    else console.log(`✓ ${key}: ${lic} — ${p.author}`);
  }
}
data.checked = new Date().toISOString().slice(0, 10);
writeFileSync(FILE, JSON.stringify(data, null, 1) + "\n");
console.log(problems ? `\n${problems} مشكلة محتاجة مراجعة` : "\nكل الصور سليمة. شغّل: node tools/build.mjs");
process.exit(problems ? 1 : 0);
