/* واتساب — WhatsApp Business Platform (Cloud API) الرسمية فقط.
   مفيش أي أتمتة لواتساب ويب. كل المفاتيح في Secrets على Cloudflare. */
import { hmacHex, safeEqual, nowIso, log } from "./util.js";
import { formatMoney } from "../../shared/pricing.js";

const GRAPH = "https://graph.facebook.com/v21.0";

export function waConfigured(env) {
  return !!(env.WA_TOKEN && env.WA_PHONE_NUMBER_ID && env.WA_APP_SECRET && env.WA_VERIFY_TOKEN);
}

/** GET: تحقق Meta من الـ webhook */
export function verifyChallenge(url, env) {
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && env.WA_VERIFY_TOKEN && token === env.WA_VERIFY_TOKEN && challenge) return new Response(challenge, { status: 200 });
  return new Response("forbidden", { status: 403 });
}

/** التحقق من توقيع X-Hub-Signature-256 على الجسم الخام */
export async function verifySignature(rawBody, header, env) {
  if (!env.WA_APP_SECRET || !header || !header.startsWith("sha256=")) return false;
  const expected = await hmacHex(env.WA_APP_SECRET, rawBody);
  return safeEqual(header.slice(7), expected);
}

/** استخراج الرسايل النصية من payload الـ webhook */
export function extractMessages(payload) {
  const out = [];
  for (const entry of payload?.entry || []) for (const ch of entry.changes || []) {
    const v = ch.value || {};
    for (const m of v.messages || []) {
      let text = null;
      if (m.type === "text") text = m.text?.body;
      else if (m.type === "button") text = m.button?.text;
      else if (m.type === "interactive") text = m.interactive?.button_reply?.title || m.interactive?.list_reply?.title;
      out.push({ id: m.id, from: m.from, type: m.type, text, ts: m.timestamp, name: v.contacts?.[0]?.profile?.name || null });
    }
  }
  return out;
}

/** منع معالجة نفس الرسالة مرتين (Meta بتعيد الإرسال أحيانًا) */
export async function markSeen(env, msgId) {
  const r = await env.DB.prepare("INSERT OR IGNORE INTO wa_seen (msg_id, at) VALUES (?, ?)").bind(msgId, nowIso()).run();
  return r.meta.changes === 1;
}

async function send(env, body, { attempts = 3 } = {}) {
  if (!env.WA_TOKEN || !env.WA_PHONE_NUMBER_ID) return { ok: false, error: "whatsapp_not_configured" };
  let last;
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetch(`${GRAPH}/${env.WA_PHONE_NUMBER_ID}/messages`, {
        method: "POST",
        headers: { authorization: `Bearer ${env.WA_TOKEN}`, "content-type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", ...body }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) return { ok: true, id: data.messages?.[0]?.id };
      last = { ok: false, status: r.status, error: data.error?.message || "send_failed", code: data.error?.code };
      // ١٣١٠٤٧ = عدّت ٢٤ ساعة على آخر رسالة من العميل → محتاج قالب معتمد، مفيش فايدة من الإعادة
      if (r.status < 500 && r.status !== 429) break;
    } catch (e) { last = { ok: false, error: String(e) }; }
    await new Promise(res => setTimeout(res, 400 * 2 ** i));
  }
  log("error", "wa_send_failed", { status: last?.status, code: last?.code });
  return last;
}

export function sendText(env, to, text) {
  // حد واتساب للرسالة النصية ٤٠٩٦ حرف
  return send(env, { to, type: "text", text: { preview_url: false, body: String(text).slice(0, 4000) } });
}

/** رسالة قالب معتمد (لازمة لو العميل مبعتش رسالة خلال آخر ٢٤ ساعة) */
export function sendTemplate(env, to, name, params, lang = "ar") {
  return send(env, {
    to, type: "template",
    template: { name, language: { code: lang }, components: [{ type: "body", parameters: params.map(t => ({ type: "text", text: String(t).slice(0, 200) })) }] },
  });
}

/** نص تأكيد الحجز */
export function bookingText(b) {
  const lines = [
    `✅ ${b.status === "quote" ? "اتسجل طلب عرض السعر" : "اتسجل حجزك المبدئي"} — ستارفول ديزرت`,
    `رقم الحجز: ${b.ref}`,
    `الرحلة: ${b.tripTitle}`,
    `التاريخ: ${b.date}`,
    `الأفراد: ${b.party.adults} كبار${b.party.kidsSmall + b.party.kids ? ` + ${b.party.kidsSmall + b.party.kids} أطفال` : ""}${b.party.infants ? ` + ${b.party.infants} رضّع` : ""}`,
  ];
  if (b.total != null) lines.push(`الإجمالي: ${formatMoney(b.total, b.currency)}`, `المقدم المطلوب (٣٠٪): ${formatMoney(b.deposit, b.currency)}`);
  if (b.status === "pending") lines.push("", "مكانك محجوز ٤٨ ساعة. فريقنا هيبعتلك بيانات دفع المقدم، والحجز بيتأكد بعد استلامه.");
  if (b.status === "quote") lines.push("", "فريقنا هيراجع التصاريح وحجم المجموعة ويبعتلك عرض السعر.");
  return lines.join("\n");
}

/** إشعار تأكيد الحجز للعميل. عمره ما بيوقف الحجز لو فشل. */
export async function notifyBooking(env, booking, { inSession = false } = {}) {
  if (!waConfigured(env)) return "skipped:not_configured";
  const to = booking.phone;
  let r;
  if (inSession) r = await sendText(env, to, bookingText(booking));
  else if (env.WA_TEMPLATE_BOOKING) r = await sendTemplate(env, to, env.WA_TEMPLATE_BOOKING, [booking.name, booking.ref, booking.tripTitle, booking.date, booking.total == null ? "عند الطلب" : formatMoney(booking.total, booking.currency)], env.WA_TEMPLATE_LANG || "ar");
  else return "skipped:no_template";
  // إشعار لصاحب الشغل (اختياري)
  if (env.OWNER_WHATSAPP && env.WA_TEMPLATE_OWNER) await sendTemplate(env, env.OWNER_WHATSAPP, env.WA_TEMPLATE_OWNER, [booking.ref, booking.tripTitle, booking.date], env.WA_TEMPLATE_LANG || "ar").catch(() => {});
  return r.ok ? "sent" : `failed:${r.code || r.status || r.error}`;
}
