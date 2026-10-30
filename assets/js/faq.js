/* FAQ: when the server is connected the Arabic FAQ comes from the admin panel; English uses the curated list */
import { $, getCatalog, esc, reveal, AR } from "./app.js";
if (AR) getCatalog().then(c => { if (c.source !== "api" || !c.faq?.length) return;
  $("#faqList").innerHTML = c.faq.map(f => `<details class="reveal"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join(""); reveal($("#faqList")); });
