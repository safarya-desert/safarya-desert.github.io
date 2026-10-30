/* مصادقة لوحة الإدارة: كلمة سر (Secret في Cloudflare) + توكن موقّع بمدة صلاحية.
   مفيش اعتماد على إخفاء الرابط — كل طلب إداري لازم يحمل توكن صحيح. */
import { HttpError, safeEqual, hmacHex, rateLimit, clientIp } from "./util.js";

const TTL = 12 * 3600; // ١٢ ساعة

const b64u = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = s => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));

function secrets(env) {
  if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET || env.SESSION_SECRET.length < 32)
    throw new HttpError(503, "admin_not_configured", "لوحة الإدارة لسه متظبطتش: لازم ADMIN_PASSWORD و SESSION_SECRET (٣٢ حرف على الأقل)");
  return { pw: env.ADMIN_PASSWORD, key: env.SESSION_SECRET };
}

export async function login(req, env, body) {
  const { pw, key } = secrets(env);
  await rateLimit(env, "login:" + clientIp(req), 5, 900);
  if (typeof body.password !== "string" || !(await safeEqual(body.password, pw)))
    throw new HttpError(401, "bad_password", "كلمة السر غلط");
  const payload = b64u(JSON.stringify({ sub: "owner", role: "owner", exp: Math.floor(Date.now() / 1000) + TTL }));
  const sig = await hmacHex(key, payload);
  return { token: payload + "." + sig, expiresIn: TTL };
}

export async function requireAdmin(req, env) {
  const { key } = secrets(env);
  const h = req.headers.get("authorization") || "";
  const tok = h.startsWith("Bearer ") ? h.slice(7) : "";
  const [payload, sig] = tok.split(".");
  if (!payload || !sig) throw new HttpError(401, "no_session", "لازم تسجّل دخول");
  const good = await hmacHex(key, payload);
  if (!(await safeEqual(sig, good))) throw new HttpError(401, "bad_session", "الجلسة مش صالحة، سجّل دخول تاني");
  let data; try { data = JSON.parse(unb64u(payload)); } catch { throw new HttpError(401, "bad_session", "الجلسة مش صالحة"); }
  if (!data.exp || data.exp < Date.now() / 1000) throw new HttpError(401, "expired", "الجلسة خلصت، سجّل دخول تاني");
  if (data.role !== "owner") throw new HttpError(403, "forbidden", "مش مسموح");
  return data;
}
