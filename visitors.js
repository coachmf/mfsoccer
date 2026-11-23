/* =========================================================
   mfsoccer — الزوار (منصور 2026-11-14: «العين فوق الصفحه بالرئيسيه عدد الزوار بس يبين لنا،
   والمعلومات عن الزائرين بالتفصيل يكون بالاداره وشنو اكثر مكان يروحون له»)

   1) قياس مجهول الهوية لكل جلسة زائر (بلا أسماء ولا بريد ولا معرّفات أجهزة):
      الأقسام التي فتحها، المباريات/اللاعبون/الأندية التي فتحها، نوع الجهاز (تطبيق/متصفح)،
      اللغة، مصدر الدخول، جديد أم عائد، ساعة الزيارة. كل عنصر يُعدّ مرة واحدة في الجلسة.
      يُرسل إلى /api/visit (netlify/functions/visit.js) وهو الكاتب الوحيد: يحسب يوم
      الكويت على الخادم ويزيد +1. العميل لا يكتب في Firestore إطلاقاً (2026-11-23).
      الطاقم لا يُحسب (حتى لا تتلوّث الأرقام بمتابعتهم).
   2) العين أعلى الرئيسية — لفريق العمل فقط: الزيارات منذ الانطلاق + اليوم + الزوار
      الفريدون (قراءة واحدة من stats/_all الذي يحمل المجموع وخطّ الأيام).
   3) قسم «الزوار بالتفصيل» في لوحة الإدارة (تبويب «الزوار»).
   ========================================================= */
(function(){
"use strict";
const D = document, H = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt = n => Number(n || 0).toLocaleString("en-US");
/* يوم الكويت (UTC+3 بلا توقيت صيفي) — نفس ما يحسبه الخادم، فمفاتيح اللوحة تطابق دلاء الخادم
   مهما كان توقيت جهاز المدير. ساعة الجهاز الخاطئة لم تعد تُحرّك الدلو: الخادم هو من يقرّر. */
const day = d => new Date((d ? new Date(d) : new Date()).getTime() + 3 * 3600e3).toISOString().slice(0, 10);
const staff = () => { try{ return !!isAdmin; }catch(e){ return false; } };
const db = () => { try{ return (typeof fbDb !== "undefined" && fbDb) ? fbDb : null; }catch(e){ return null; } };
/* مفتاح قصير ثابت لاسم عربي (حقول Firestore: حروف لاتينية وأرقام فقط) — الإدارة تعيده لاسمه بحساب نفس البصمة */
const hk = s => { let h = 5381; s = String(s); for(let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36); };
const safe = s => String(s).toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 28);

/* ---------------- 1) القياس ---------------- */
const SS = "mf_vx_", PEND = {};
const SESS = "mf_vx_sess";   /* sessionStorage: هذه الجلسة حُسبت زيارةً */
const UDAY = "mf_vx_uday";   /* localStorage: آخر يوم كويتي حُسب فيه هذا الجهاز زائراً فريداً */
let flushT = 0, first = true, sending = false;
const seen = k => { try{ if(sessionStorage.getItem(SS + k)) return true; sessionStorage.setItem(SS + k, "1"); }catch(e){} return false; };
function hit(k){
  if(!k || staff() || seen(k)) return;
  PEND[k] = 1;
  clearTimeout(flushT); flushT = setTimeout(flush, first ? 4000 : 60000);
}
/* ما زال معلّقاً: زيارة هذه الجلسة؟ وزائر فريد لهذا اليوم؟ */
function flags(){
  let s = 0, u = 0;
  try{ if(!sessionStorage.getItem(SESS)) s = 1; }catch(e){ s = 1; }
  try{ if(localStorage.getItem(UDAY) !== day()) u = 1; }catch(e){}
  return { s, u };
}
/* beacon عند إخفاء الصفحة (يصل بعد إغلاق التبويب)، وfetch عادي غير ذلك */
function send(body, beacon){
  const s = JSON.stringify(body);
  if(beacon){ try{ if(navigator.sendBeacon("/api/visit", new Blob([s], {type: "application/json"}))) return Promise.resolve(null); }catch(e){} }
  return fetch("/api/visit", {method: "POST", headers: {"Content-Type": "application/json"}, body: s, keepalive: true})
    .then(r => r.json()).catch(() => null);
}
function flush(beacon){
  clearTimeout(flushT);
  if(staff()) return;
  /* إرسال جارٍ: نعيد الجدولة بدل إسقاط ما وصل بينهما (وإلّا انتظر إغلاق الصفحة) */
  if(sending){ if(Object.keys(PEND).length) flushT = setTimeout(flush, 3000); return; }
  const ks = Object.keys(PEND), f = flags();
  if(!ks.length && !f.s && !f.u) return;
  first = false; sending = true;
  ks.forEach(k => delete PEND[k]);
  /* الدفعة الأولى تحمل العدّادين؛ سقف الخادم 40 مفتاحاً فنقسّم الزائد */
  const parts = ks.length ? [] : [[]];
  for(let i = 0; i < ks.length; i += 40) parts.push(ks.slice(i, i + 40));
  Promise.all(parts.map((part, i) => send(i ? {k: part} : {s: f.s, u: f.u, k: part}, beacon)))
    .then(rs => {
      const r = rs[0];
      if(f.s){ try{ sessionStorage.setItem(SESS, "1"); }catch(e){} }
      /* نحفظ اليوم الذي قرّره الخادم لا الذي حسبه الجهاز */
      if(f.u){ try{ localStorage.setItem(UDAY, (r && r.day) || day()); }catch(e){} }
    })
    .finally(() => { sending = false; });
}
D.addEventListener("visibilitychange", () => { if(D.visibilityState === "hidden") flush(true); });
addEventListener("pagehide", () => flush(true));

function device(){
  const ua = navigator.userAgent || "", app = D.documentElement.classList.contains("mfa") || /PWAShell/.test(ua);
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1), and = /Android/.test(ua);
  const tab = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) || (and && !/Mobile/.test(ua));
  return app ? (ios ? "app_ios" : and ? "app_android" : "app_other") : (tab ? "web_tablet" : (ios || and) ? "web_phone" : "web_desktop");
}
function source(){
  const ua = navigator.userAgent || "";
  if(/Instagram/.test(ua)) return "instagram";
  if(/TikTok|musical_ly|BytedanceWebview/.test(ua)) return "tiktok";
  if(/FBAN|FBAV|FB_IAB/.test(ua)) return "facebook";
  if(/Snapchat/.test(ua)) return "snapchat";
  let q = ""; try{ q = (new URLSearchParams(location.search).get("utm_source") || "").toLowerCase(); }catch(e){}
  if(q) return safe(q).slice(0, 16);
  const r = D.referrer || "";
  if(!r) return "direct";
  try{ const h = new URL(r).hostname.replace(/^www\./, "");
    if(h === location.hostname) return "internal";
    if(/instagram/.test(h)) return "instagram"; if(/tiktok/.test(h)) return "tiktok"; if(/whatsapp|wa\.me/.test(h)) return "whatsapp";
    if(/(^|\.)(x|twitter|t)\.co(m)?$/.test(h)) return "x"; if(/google/.test(h)) return "google"; if(/facebook|fb\./.test(h)) return "facebook";
    if(/snapchat/.test(h)) return "snapchat"; if(/bing|yahoo|duckduckgo/.test(h)) return "search";
    return "other"; }catch(e){ return "other"; }
}
function sessionStart(){
  if(staff()) return;
  /* جديد أم عائد يُحسم مرة واحدة لكل جلسة: كان أول تحميل يسجّل «جديد» ثم أي تحميل
     تالٍ في الجلسة نفسها يسجّل «عائد» (لأن mf_vx_first صار موجوداً)، فالجلسة الواحدة
     تُحسب في الخانتين وتتضخّم النسبة. القرار محفوظ في sessionStorage. */
  let ret = false; try{
    const s = sessionStorage.getItem("mf_vx_ret");
    if(s !== null) ret = s === "1";
    else { ret = !!localStorage.getItem("mf_vx_first");
           if(!ret) localStorage.setItem("mf_vx_first", day());
           sessionStorage.setItem("mf_vx_ret", ret ? "1" : "0"); }
  }catch(e){}
  let lang = "ar"; try{ lang = I18N.lang ? I18N.lang() : "ar"; }catch(e){}
  /* المصدر مرة واحدة لكل جلسة: أول دخول هو مصدر الجلسة. كان كل تحميل صفحة يحسبه
     من document.referrer، فمن دخل من إنستغرام ثم فتح الفانتسي أُضيف له s_internal
     فوق s_instagram وتجاوزت النسب عدد الجلسات. */
  hit("d_" + device()); hit("l_" + safe(lang)); hit(ret ? "n_ret" : "n_new");
  try{ if(!sessionStorage.getItem("mf_vx_src")){ sessionStorage.setItem("mf_vx_src", "1"); hit("s_" + source()); } }
  catch(e){ hit("s_" + source()); }
  hit("h_" + String(new Date().getHours()).padStart(2, "0"));
}
/* التنقل: نغلّف بعد تحميل كل الملفات حتى يكون غلافنا الخارجي (لا يغيّر سلوك أي دالة) */
function wrapAll(){
  const wrap = (name, fn) => { const f = window[name]; if(typeof f !== "function" || f.__vx) return;
    const w = function(){ try{ fn.apply(null, arguments); }catch(e){} return f.apply(this, arguments); };
    w.__vx = true; Object.keys(f).forEach(k => { try{ w[k] = f[k]; }catch(e){} });
    try{ window[name] = w; }catch(e){}
    try{ if(name === "go") go = w; else if(name === "openMatch") openMatch = w; else if(name === "openPlayer") openPlayer = w; }catch(e){} };
  wrap("go", v => hit("v_" + safe(v)));
  wrap("openMatch", m => { if(m && typeof matchKey === "function") hit("m_" + hk(matchKey(m))); hit("v_match"); });
  wrap("openPlayer", (n, c) => { if(n) hit("p_" + hk(n + "|" + (c || ""))); hit("v_player"); });
  wrap("openClub", c => { if(c) hit("c_" + hk(c)); });
}
/* أندية تُفتح من أزرار داخل وحدات مغلقة (شريط الشعارات) */
D.addEventListener("click", e => { const b = e.target.closest && e.target.closest("[data-club],[data-club-open],[data-club-link]"); if(!b) return;
  const c = b.dataset.club || b.dataset.clubOpen || b.dataset.clubLink; if(c) hit("c_" + hk(c)); }, true);

/* ---------------- 2) العين أعلى الرئيسية (الطاقم فقط) ---------------- */
const TOT = {at: 0, all: 0, today: 0, month: 0, uall: 0, utoday: 0, umonth: 0, days: [], since: ""};
/* قراءة كل 10 ساعات فقط (منصور 2026-11-14): العين واللوحة تُحفظان على الجهاز وتُعرضان من الحفظ؛
   القراءة من السحابة مرة كل 10 ساعات لكل جهاز، أو عند ضغط «تحديث» في اللوحة */
const TTL = 10 * 3600e3, CK = "mf_vx_cache";
const cacheGet = () => { try{ return JSON.parse(localStorage.getItem(CK) || "null") || {}; }catch(e){ return {}; } };
const cacheSet = (k, v) => { try{ const c = cacheGet(); c[k] = v; localStorage.setItem(CK, JSON.stringify(c)); }catch(e){} };
const fresh = at => at && Date.now() - at < TTL && day(new Date(at)) === day();   /* بعد منتصف الليل يتغير «اليوم» فتُقرأ مرة */
(() => { const c = cacheGet().tot; if(c && fresh(c.at)) Object.assign(TOT, c); })();
let totP = null;   /* قراءة واحدة في الوقت نفسه */
function loadTotals(force){
  if(!force && fresh(TOT.at)) return Promise.resolve(TOT);
  if(totP) return totP;
  totP = loadTotals_().finally(() => { totP = null; });
  return totP;
}
async function loadTotals_(){
  const d = db(); if(!d) return TOT;
  try{
    /* قراءة واحدة: stats/_all يحمل المجموع (v/u) وخطّ الأيام (days/ud).
       كان يقرأ كل مستندات stats — مستند لكل يوم، فالقراءات تنمو بلا حدّ مع عمر الموقع. */
    const s = await d.collection("stats").doc("_all").get();
    const x = (s.exists && s.data()) || {}, dm = x.days || {}, um = x.ud || {};
    const rows = Object.keys(dm).filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort()
      .map(k => ({d: k, v: +dm[k] || 0, u: +um[k] || 0}));
    const t = day(), m = t.slice(0, 7), tod = rows.find(r => r.d === t) || {};
    TOT.days = rows;
    TOT.all = +x.v || rows.reduce((a, r) => a + r.v, 0);
    TOT.uall = +x.u || 0;
    TOT.today = tod.v || 0;
    TOT.utoday = tod.u || 0;
    TOT.month = rows.filter(r => r.d.startsWith(m)).reduce((a, r) => a + r.v, 0);
    TOT.umonth = rows.filter(r => r.d.startsWith(m)).reduce((a, r) => a + r.u, 0);
    TOT.since = rows.length ? rows[0].d : "";
    TOT.at = Date.now(); cacheSet("tot", TOT);
  }catch(e){}
  return TOT;
}
const EYE = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
function eyeHTML(){
  return `<button type="button" class="vx-eye" data-i18n="off" title="الزوار — للطاقم فقط" aria-label="الزوار">
    <span class="vx-ic">${EYE}</span>
    <span class="vx-n"><b dir="ltr">${TOT.at ? fmt(TOT.all) : "…"}</b><small>زيارة منذ الانطلاق</small></span>
    <span class="vx-sep" aria-hidden="true"></span>
    <span class="vx-n"><b dir="ltr">${TOT.at ? fmt(TOT.today) : "…"}</b><small>زيارات اليوم</small></span>
    ${TOT.utoday ? `<span class="vx-sep" aria-hidden="true"></span>
    <span class="vx-n"><b dir="ltr">${fmt(TOT.utoday)}</b><small>زائر اليوم</small></span>` : ""}
    <span class="vx-only">للطاقم فقط</span></button>`;
}
function paintEye(){
  const v = D.getElementById("v-home"); if(!v) return;
  const old = v.querySelector(":scope > .vx-eye");
  if(!staff()){ if(old) old.remove(); return; }
  const html = eyeHTML();
  if(old && old._h === html) return;
  const box = D.createElement("div"); box.innerHTML = html; const el = box.firstElementChild; el._h = html;
  /* يفتح الإدارة على تبويب «الزوار» — اللوحة تُحمَّل عند الطلب (admin.js)، فننتظر ظهور التبويب */
  el.onclick = () => { try{ localStorage.setItem("mf-admtab", "visitors"); }catch(e){} go("admin");
    let n = 0; const t = setInterval(() => { const b = D.querySelector('#v-admin [data-admtab="visitors"]');
      if(b && window.ADMIN_TABS){ clearInterval(t); ADMIN_TABS.open("visitors"); window.scrollTo(0, 0); } else if(++n > 60) clearInterval(t); }, 150); };
  if(old) old.replaceWith(el); else v.insertBefore(el, v.firstChild);
}
let eyeQ = 0;
const eyeSoon = () => { if(eyeQ) return; eyeQ = requestAnimationFrame(() => { eyeQ = 0; paintEye(); }); };
function watchHome(){
  const v = D.getElementById("v-home"); if(!v) return;
  /* الرئيسية تُرسم من جديد بـ innerHTML: نعيد العين إن اختفت (ونتجاهل تغييراتنا نحن) */
  new MutationObserver(ms => { if(ms.some(m => [...m.addedNodes, ...m.removedNodes].some(n => !(n.classList && n.classList.contains("vx-eye"))))) eyeSoon(); }).observe(v, {childList: true});
}
let wasStaff = false;
setInterval(() => { const s = staff(); if(s !== wasStaff){ wasStaff = s; if(s) loadTotals().then(paintEye); else paintEye(); } else if(s && !fresh(TOT.at)) loadTotals().then(paintEye); }, 1500);

/* ---------------- 3) الإدارة: «الزوار بالتفصيل» ---------------- */
const VIEWN = {home:"الرئيسية", matches:"المباريات", players:"اللاعبون", clubs:"الأندية", stats:"الإحصائيات", news:"الأخبار", predict:"التوقعات",
  fans:"الجمهور", analysis:"التحليل", gulf:"كأس الخليج", div1:"الدرجة الأولى", amateur:"الهواة", fantasy:"الفانتسي", admin:"الإدارة",
  match:"صفحة مباراة", player:"ملف لاعب", hub:"الأقسام", videos:"الفيديو", ext:"المشاركات الخارجية"};
const DEVN = {app_ios:"تطبيق آيفون", app_android:"تطبيق أندرويد", app_other:"تطبيق مثبّت", web_phone:"متصفح الهاتف", web_tablet:"متصفح الآيباد/التابلت", web_desktop:"كمبيوتر"};
const SRCN = {direct:"مباشر / رابط محفوظ", internal:"من داخل الموقع", instagram:"إنستغرام", tiktok:"تيك توك", whatsapp:"واتساب", x:"إكس", google:"Google",
  facebook:"فيسبوك", snapchat:"سناب شات", search:"محركات بحث أخرى", other:"مواقع أخرى"};
const LANGN = {ar:"العربية", en:"English", "pt_br":"Português (BR)", "pt_pt":"Português (PT)", es:"Español", fr:"Français", sh:"BCMS"};
const ADM = {range: 30, rows: null, busy: false};
const MON = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const dlab = s => { const [y, m, d] = String(s).split("-").map(Number); return y ? `${d} ${MON[m - 1]}` + (y !== new Date().getFullYear() ? ` ${y}` : "") : ""; };
async function loadDetail(n, force){
  const c = (cacheGet().det || {})[n];
  if(!force && c && fresh(c.at)) return c.rows;
  const d = db(); if(!d) return [];
  const keys = []; for(let i = n - 1; i >= 0; i--){ const x = new Date(); x.setDate(x.getDate() - i); keys.push(day(x)); }
  const snaps = await Promise.all(keys.map(k => d.collection("visits").doc(k).get().catch(() => null)));
  const rows = snaps.map((s, i) => ({d: keys[i], x: s && s.exists ? (s.data() || {}) : {}}));
  if(snaps.some(Boolean)){ const det = cacheGet().det || {}; det[n] = {at: Date.now(), day: day(), rows}; cacheSet("det", det); }
  return rows;
}
function nameMaps(){
  const M = {}, P = {}, C = {};
  try{ (ALL && ALL.matches || []).forEach(m => { const cp = typeof compOf === "function" ? compOf(m) : ""; M[hk(matchKey(m))] = `${m.home} × ${m.away}` + ((m.hg != null && m.hg !== "" && !(typeof isUpcoming === "function" && isUpcoming(m))) ? ` (${m.ag}-${m.hg})` : "") + ` · ${cp && cp !== "الدوري" ? cp + " " : ""}ج${m.round}`; }); }catch(e){}
  try{ Object.keys(SQUADS || {}).forEach(c => { C[hk(c)] = c; (SQUADS[c] || []).forEach(x => { const n = typeof sqName === "function" ? sqName(x) : (x.n || x); P[hk(n + "|" + c)] = `${n} · ${c}`; }); }); }catch(e){}
  try{ (typeof CLUBS !== "undefined" ? CLUBS : []).forEach(c => { C[hk(c)] = c; }); C[hk("الاتحاد الكويتي")] = "الاتحاد الكويتي"; }catch(e){}
  return {M, P, C};
}
function bars(list, total, label, max){
  const top = list.slice(0, max || 10), mx = Math.max(1, ...top.map(r => r[1]));
  if(!top.length) return `<p class="hint" style="margin:6px 0 0">لا بيانات بعد.</p>`;
  return `<div class="vx-list">${top.map(([k, v], i) => `<div class="vx-row${i === 0 ? " vx-top" : ""}"><span class="vx-k">${H(k)}</span>
      <span class="vx-bar"><i style="width:${Math.max(3, Math.round(v / mx * 100))}%"></i></span><b dir="ltr">${fmt(v)}</b>
      <small dir="ltr">${total ? Math.round(v / total * 100) + "%" : ""}</small></div>`).join("")}</div>`;
}
function detailHTML(){
  const rows = ADM.rows || [], sum = {};
  rows.forEach(r => { for(const k in r.x){ if(k !== "d") sum[k] = (sum[k] || 0) + (+r.x[k] || 0); } });
  const sessions = ["n_new", "n_ret"].reduce((a, k) => a + (sum[k] || 0), 0);
  const grp = (p, names, fallback) => Object.entries(sum).filter(([k]) => k.startsWith(p)).map(([k, v]) => { const id = k.slice(p.length); return [names[id] || (fallback ? fallback(id) : id), v]; }).sort((a, b) => b[1] - a[1]);
  const {M, P, C} = nameMaps();
  const views = grp("v_", VIEWN), dev = grp("d_", DEVN), src = grp("s_", SRCN), lang = grp("l_", LANGN);
  const mt = grp("m_", M, () => "مباراة (مؤرشفة)"), pl = grp("p_", P, () => "لاعب سابق"), cl = grp("c_", C, () => "نادٍ آخر");
  const hours = Array.from({length: 24}, (_, h) => sum["h_" + String(h).padStart(2, "0")] || 0), hmx = Math.max(1, ...hours), hBest = hours.indexOf(Math.max(...hours));
  const days = TOT.days.slice(-ADM.range), dmx = Math.max(1, ...days.map(r => r.v)), best = days.reduce((a, r) => r.v > (a ? a.v : -1) ? r : a, null);
  const avg = n => { const s = TOT.days.slice(-n); return s.length ? Math.round(s.reduce((a, r) => a + r.v, 0) / s.length) : 0; };
  const card = (v, l, gold) => `<div class="vx-c${gold ? " vx-g" : ""}"><b dir="ltr">${v}</b><span>${l}</span></div>`;
  return `
    <div class="vx-seg" role="tablist">${[[7, "آخر 7 أيام"], [30, "آخر 30 يوماً"], [90, "آخر 90 يوماً"]].map(([n, t]) => `<button type="button" data-vxr="${n}" aria-pressed="${ADM.range === n}">${t}</button>`).join("")}
      <button type="button" class="vx-re" data-vxre>تحديث</button></div>
    <p class="hint vx-note">آخر تحديث: ${TOT.at ? `<span dir="ltr">${new Date(TOT.at).toLocaleString("en-GB", {hour: "2-digit", minute: "2-digit"})}</span> · ${dlab(day(new Date(TOT.at)))}` : "—"} — الأرقام تُقرأ مرة كل 10 ساعات</p>
    <div class="vx-grid">${card(fmt(TOT.all), "زيارة منذ الانطلاق" + (TOT.since ? ` · ${dlab(TOT.since)}` : ""), 1)}${card(fmt(TOT.month), "زيارات هذا الشهر")}${card(fmt(TOT.today), "زيارات اليوم")}
      ${card(fmt(avg(7)), "متوسط آخر 7 أيام")}${card(fmt(avg(30)), "متوسط آخر 30 يوماً")}${card(best ? fmt(best.v) : "0", "أعلى يوم" + (best ? ` · ${dlab(best.d)}` : ""), 1)}</div>
    ${TOT.uall ? `<div class="vx-grid">${card(fmt(TOT.uall), "زائر فريد منذ القياس", 1)}${card(fmt(TOT.umonth), "زوار هذا الشهر")}${card(fmt(TOT.utoday), "زوار اليوم")}</div>
      <p class="hint vx-note">«زيارة» = جلسة (فتح الموقع). «زائر فريد» = جهاز واحد في اليوم مهما فتح — بدأ قياسه 2026-11-23، فلا تقارنه بما قبله.</p>` : ""}
    <div class="vx-days">${days.map(r => `<i class="${best && r.d === best.d ? "g" : ""}" style="height:${Math.max(3, Math.round(r.v / dmx * 100))}%" title="${dlab(r.d)}: ${r.v}"></i>`).join("")}</div>
    <div class="vx-dl"><span>قبل ${days.length} يوماً</span><span>اليوم</span></div>
    <p class="hint vx-note">الأرقام أعلاه من عدّاد الزيارات (زيارة = جلسة). التفاصيل أدناه تبدأ من يوم تفعيل القياس التفصيلي، ولا تشمل الطاقم.
      ${sessions ? `جلسات مقاسة في المدة: <b dir="ltr">${fmt(sessions)}</b>` : ""}</p>
    <div class="vx-cols">
      <section><h3>أكثر الأقسام زيارة</h3>${bars(views, sessions, "", 14)}</section>
      <section><h3>أكثر المباريات فتحاً</h3>${bars(mt, sessions, "", 10)}</section>
      <section><h3>أكثر اللاعبين مشاهدة</h3>${bars(pl, sessions, "", 10)}</section>
      <section><h3>أكثر الأندية مشاهدة</h3>${bars(cl, sessions, "", 12)}</section>
      <section><h3>الأجهزة</h3>${bars(dev, sessions)}</section>
      <section><h3>من أين يأتون</h3>${bars(src, sessions)}</section>
      <section><h3>اللغة</h3>${bars(lang, sessions)}</section>
      <section><h3>جديد أم عائد</h3>${bars([["زائر جديد", sum.n_new || 0], ["زائر عائد", sum.n_ret || 0]].filter(r => r[1]), sessions)}</section>
      <section class="vx-wide"><h3>ساعات الزيارة (توقيت الجهاز)${sessions ? ` — الذروة ${hBest}:00` : ""}</h3>
        <div class="vx-hours">${hours.map((v, h) => `<i class="${h === hBest && v ? "g" : ""}" style="height:${Math.max(3, Math.round(v / hmx * 100))}%" title="${h}:00 — ${v}"></i>`).join("")}</div>
        <div class="vx-hl" dir="ltr"><span>0</span><span>6</span><span>12</span><span>18</span><span>23</span></div></section>
    </div>`;
}
async function fillAdmin(force){
  const box = D.getElementById("vxAdmin"); if(!box || ADM.busy) return;
  ADM.busy = true;
  if(!ADM.rows || force) box.innerHTML = `<p class="hint">جارٍ تحميل أرقام الزوار…</p>`;
  try{ await loadTotals(force); if(!ADM.rows || force || ADM.rows.length !== ADM.range) ADM.rows = await loadDetail(ADM.range, force); }catch(e){}
  if(force) paintEye();
  ADM.busy = false;
  const b2 = D.getElementById("vxAdmin"); if(!b2) return;
  b2.innerHTML = detailHTML();
  b2.querySelectorAll("[data-vxr]").forEach(b => b.onclick = () => { ADM.range = +b.dataset.vxr; ADM.rows = null; fillAdmin(); });
  const re = b2.querySelector("[data-vxre]"); if(re) re.onclick = () => fillAdmin(true);
}
function injectAdmin(){
  const v = D.getElementById("v-admin"); if(!v || !staff() || D.getElementById("vxAdmin") || v.querySelector("#loginBtn")) return;
  const sec = D.createElement("div");
  sec.innerHTML = `<h2 class="sec">الزوار بالتفصيل</h2><div id="vxAdmin" class="vx-adm" data-i18n="off"></div>`;
  [...sec.childNodes].forEach(n => v.appendChild(n));
  fillAdmin();
}
function hookAdmin(){
  ["renderAdmin", "renderEditorAdmin"].forEach(n => { const f = window[n]; if(typeof f !== "function" || f.__vxadm) return;
    const w = function(){ const r = f.apply(this, arguments);
      try{ injectAdmin(); if(window.ADMIN_TABS){ const v = D.getElementById("v-admin"); if(v && v.querySelector(".adm-tabs")){ v.querySelector(".adm-tabs").remove(); v.querySelectorAll(".adm-panel").forEach(p => { while(p.firstChild) v.insertBefore(p.firstChild, p); p.remove(); }); ADMIN_TABS.organize(); } } }catch(e){ console.error(e); }
      return r; };
    w.__vxadm = true; Object.keys(f).forEach(k => { try{ w[k] = f[k]; }catch(e){} });
    try{ window[n] = w; }catch(e){} try{ if(n === "renderAdmin") renderAdmin = w; else renderEditorAdmin = w; }catch(e){} });
  if(typeof RENDER === "object" && RENDER) RENDER.admin = window.renderAdmin;
}

/* ---------------- الأنماط ---------------- */
const css = D.createElement("style");
css.textContent = `
#v-home > .vx-eye{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:14px;width:100%;margin:0 0 var(--mf-s3,12px);padding:10px 16px;cursor:pointer;
  border-radius:var(--mf-rc,16px);background:var(--mf-c1,#07112B);border:1px solid var(--mf-ln2,rgba(231,208,147,.2));color:var(--mf-tx,#fff);font-family:inherit}
.vx-eye .vx-ic{display:grid;place-items:center;width:40px;height:40px;border-radius:12px;color:var(--mf-gold,#E7D093);background:rgba(231,208,147,.08);flex:none}
.vx-eye .vx-n{display:flex;flex-direction:column;line-height:1.25}
.vx-eye .vx-n b{font:800 1.25rem/1.2 var(--mf-fh,inherit);color:var(--mf-tx,#fff);text-align:start}
.vx-eye .vx-n:first-of-type b{color:var(--mf-gold,#E7D093)}
.vx-eye .vx-n small{font-size:.72rem;color:var(--mf-tx3,#8C93A8)}
.vx-eye .vx-sep{width:1px;align-self:stretch;background:var(--mf-ln2,rgba(231,208,147,.2))}
.vx-eye .vx-only{margin-inline-start:auto;font-size:.66rem;color:var(--mf-tx3,#8C93A8);border:1px solid var(--mf-ln2,rgba(231,208,147,.2));border-radius:999px;padding:3px 9px;white-space:nowrap}
.vx-adm{display:flex;flex-direction:column;gap:14px}
.vx-seg{display:flex;flex-wrap:wrap;gap:6px}
.vx-seg button{all:unset;cursor:pointer;padding:7px 14px;border-radius:999px;font-size:.82rem;font-weight:600;border:1px solid var(--mf-ln2,rgba(231,208,147,.2));color:var(--mf-tx2,#C5CAD8)}
.vx-seg button[aria-pressed="true"]{background:var(--mf-gold,#E7D093);color:var(--mf-gold-ink,#1A1306);border-color:transparent}
.vx-seg .vx-re{margin-inline-start:auto}
.vx-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.vx-c{border:1px solid var(--mf-ln2,rgba(231,208,147,.2));border-radius:14px;padding:12px 10px;text-align:center;background:var(--mf-c1,#07112B)}
.vx-c b{display:block;font:800 1.3rem/1.2 var(--mf-fh,inherit);color:var(--mf-tx,#fff)}
.vx-c.vx-g b{color:var(--mf-gold,#E7D093)}
.vx-c span{display:block;margin-top:4px;font-size:.72rem;color:var(--mf-tx3,#8C93A8);line-height:1.5}
.vx-days,.vx-hours{display:flex;align-items:flex-end;gap:3px;height:90px;padding:6px 2px 0;border-bottom:1px solid var(--mf-ln2,rgba(231,208,147,.2))}
.vx-days{direction:rtl}   /* الأقدم يميناً واليوم يساراً (مثل التصميم) */
.vx-dl{display:flex;justify-content:space-between;direction:rtl;font-size:.66rem;color:var(--mf-tx3,#8C93A8);margin-top:4px}
.vx-days i,.vx-hours i{flex:1;min-width:2px;border-radius:3px 3px 0 0;background:#2F9BE0}
.vx-days i.g,.vx-hours i.g{background:linear-gradient(180deg,var(--mf-gold-hi,#F5E2A8),var(--mf-gold-mid,#AD8F59))}
.vx-hours{direction:ltr;height:70px}
.vx-hl{display:flex;justify-content:space-between;font-size:.66rem;color:var(--mf-tx3,#8C93A8);margin-top:4px}
.vx-note{margin:0;line-height:1.7}
.vx-cols{display:grid;grid-template-columns:1fr;gap:12px}
@media(min-width:760px){.vx-cols{grid-template-columns:1fr 1fr}.vx-grid{grid-template-columns:repeat(6,minmax(0,1fr))}.vx-wide{grid-column:1/-1}}
.vx-cols section{border:1px solid var(--mf-ln,rgba(231,208,147,.1));border-radius:14px;padding:12px 14px;background:var(--mf-c1,#07112B)}
.vx-cols h3{margin:0 0 10px;font-size:.9rem;font-weight:700;color:var(--mf-tx,#fff)}
.vx-list{display:flex;flex-direction:column;gap:12px}
.vx-row{display:grid;grid-template-columns:minmax(0,1fr) 64px 38px;grid-template-areas:"k k k" "bar n p";align-items:center;column-gap:10px;row-gap:5px;font-size:.8rem}
.vx-row .vx-k{grid-area:k;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--mf-tx2,#C5CAD8)}
.vx-row .vx-bar{grid-area:bar} .vx-row b{grid-area:n;text-align:end} .vx-row small{grid-area:p}
.vx-row .vx-bar{height:7px;border-radius:6px;background:rgba(255,255,255,.06);overflow:hidden}
.vx-row .vx-bar i{display:block;height:100%;border-radius:6px;background:#2F9BE0}
.vx-row.vx-top .vx-bar i{background:linear-gradient(90deg,var(--mf-gold-mid,#AD8F59),var(--mf-gold-hi,#F5E2A8))}
.vx-row b{font-weight:700;color:var(--mf-tx,#fff)}
.vx-row small{color:var(--mf-tx3,#8C93A8);text-align:end}`;
(D.head || D.documentElement).appendChild(css);

function boot(){
  watchHome(); wrapAll(); hookAdmin();
  /* أول زيارة تُقاس بعد جاهزية Firebase ومعرفة إن كان المستخدم من الطاقم (حالة الدخول) */
  let tries = 0; const t = setInterval(() => { tries++; if((db() && tries > 4) || tries > 40){ clearInterval(t); sessionStart(); hit("v_" + safe(((D.querySelector(".view.on") || {}).id || "v-home").replace(/^v-/, ""))); } }, 500);
}
if(D.readyState === "loading") D.addEventListener("DOMContentLoaded", () => setTimeout(boot, 60)); else setTimeout(boot, 60);
/* صندوق الزوار القديم في لوحة الإدارة (admin.js → #visLoad) كان يستدعي loadVisits
   من index.html، وقد حُذفت مع countVisit عند نقل العدّاد إلى الخادم. نعيدها هنا
   من stats/_all بنفس الشكل: صفّ لكل يوم من الأيام n الأخيرة، والأيام بلا زيارات أصفار. */
async function loadVisits(n){
  const t = await loadTotals(), map = {};
  (t.days || []).forEach(r => { map[r.d] = r.v; });
  const out = [];
  for(let i = (n || 30) - 1; i >= 0; i--){
    const x = new Date(); x.setDate(x.getDate() - i);
    const k = day(x); out.push({d: k, v: map[k] || 0});
  }
  return out;
}
try{ window.loadVisits = loadVisits; }catch(e){}
window.MFVX = {flush, loadTotals, loadVisits, hk};
})();
