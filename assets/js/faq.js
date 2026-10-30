/* الأسئلة الشائعة: لو السيرفر متوصل، الأسئلة بتيجي من لوحة الإدارة */
import { $, getCatalog, esc, reveal } from "./app.js";
getCatalog().then(c => { if (c.source !== "api" || !c.faq?.length) return;
  $("#faqList").innerHTML = c.faq.map(f => `<details class="reveal"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join(""); reveal($("#faqList")); });
