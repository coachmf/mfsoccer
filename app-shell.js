/* =====================================================================
   تجربة التطبيق — MF Soccer App Layer (منصور 2026-11-14، محلي فقط)

   يعمل فقط داخل التطبيق (غلاف iOS «PWAShell» / app-platform، تطبيق أندرويد، التطبيق المثبّت)
   أو بالمعاينة ‎?app=1 — الموقع في المتصفح يبقى كما هو تماماً (لا صنف html.mfa = لا شيء هنا يعمل).
   الصنف html.mfa يُضبط مبكراً في <head> قبل الرسم، وهذا الملف يضيف السلوك:

     1) انتقال بين الأقسام باتجاه الشريط السفلي + حفظ موضع التمرير لكل قسم
        + الضغط على القسم الحالي يرجع لأعلاه (عرف تطبيقات iOS)
     2) الشريط العلوي يختفي مع التمرير للأسفل ويعود مع الأعلى (شريط الحالة يبقى مغطّى)
     3) «المباريات | الترتيب» داخل صفحة المباريات (الترتيب بلا قفزة للرئيسية)
     4) لوحة «الأقسام»: سحب للأسفل للإغلاق
     5) مركز المباراة: فتح كصفحة تطبيق، لوحة نتيجة مصغّرة ثابتة عند التمرير،
        سحب أفقي بين التبويبات، انتقال للمحتوى، التبويب النشط في المنتصف
   لا يحذف شيئاً ولا يغيّر بيانات — يلتف حول الدوال الموجودة ويضيف أصنافاً فقط.
   ===================================================================== */
(function(){
"use strict";
const D = document, H = D.documentElement;
if(!H.classList.contains("mfa")) return;
const safe = f => { try{ return f(); }catch(e){ return undefined; } };
const RTL = () => H.dir !== "ltr";
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const phone = () => innerWidth < 900;

/* ───────────── 1) الانتقال بين الأقسام ───────────── */
const ORDER = ["home","matches","clubs","players","analysis","news","videos","predict","fans","gulf","div1","amateur","admin"];
const curView = () => { const b = D.querySelector('nav.tabs button[aria-selected="true"]'); return b ? b.dataset.v : "home"; };
const SCROLL = {};            /* موضع كل قسم {y, t} */
let barNav = false;           /* الانتقال جاء من الشريط السفلي */
let LASTV = null;
function animateIn(v, dir){
  if(reduce) return;
  const el = D.getElementById("v-"+v); if(!el) return;
  el.classList.remove("mfa-in-f","mfa-in-b","mfa-in-u"); void el.offsetWidth;
  el.classList.add(dir>0 ? "mfa-in-f" : dir<0 ? "mfa-in-b" : "mfa-in-u");
  setTimeout(()=>el.classList.remove("mfa-in-f","mfa-in-b","mfa-in-u"), 420);
}
function hookGo(){
  const g0 = window.go; if(typeof g0!=="function" || g0.__mfa) return;
  /* أزرار الأقسام الأصلية تعلّم الزر الجديد «محدداً» قبل go() — فنحفظ القسم الحالي بأنفسنا */
  const w = function(v){
    const from = LASTV;
    if(from && from!==v) SCROLL[from] = {y: scrollY, t: Date.now()};
    const r = g0.apply(this, arguments);
    if(from!==v){
      const a = ORDER.indexOf(from), b = ORDER.indexOf(v);
      animateIn(v, a<0||b<0 ? 0 : (b>a ? 1 : -1));
      /* الرجوع لقسم زرته قبل قليل من الشريط: نفس موضعك (مثل FotMob) */
      const s = SCROLL[v];
      if(barNav && s && Date.now()-s.t < 5*60e3 && s.y>0) requestAnimationFrame(()=>requestAnimationFrame(()=>window.scrollTo({top:s.y, behavior:"instant"})));
    }
    barNav = false; LASTV = v;
    return r;
  };
  Object.keys(g0).forEach(k=>{ try{ w[k] = g0[k]; }catch(e){} }); w.__mfa = true;
  try{ window.go = w; }catch(e){} try{ go = w; }catch(e){}
}
/* الشريط السفلي: الضغط على القسم الحالي = للأعلى بسلاسة بدل إعادة رسمه */
D.addEventListener("click", e=>{
  const b = e.target.closest && e.target.closest(".mf-bar [data-mf], .mf-dnav [data-mf]"); if(!b) return;
  const k = b.dataset.mf; if(k==="hub" || k==="fantasy" || k==="search") return;
  const v = LASTV || curView(), same = k===v || (k==="stats" && (v==="players"||v==="analysis"));
  if(same && !D.querySelector("#mpage.on, #pprof.on") && !/^#(m|p)\//.test(location.hash)){
    e.stopImmediatePropagation(); e.preventDefault();
    window.scrollTo({top:0, behavior: reduce ? "instant" : "smooth"}); return;
  }
  barNav = true;
}, true);

/* ───────────── 2) الشريط العلوي يختفي مع التمرير ───────────── */
let lastY = scrollY, acc = 0, ticking = false;
function onScroll(){
  ticking = false;
  const y = scrollY, dy = y - lastY; lastY = y;
  if(!phone() || D.querySelector(".mf-hub:not([hidden])")){ H.classList.remove("mfa-hide"); return; }
  if(y < 72){ H.classList.remove("mfa-hide"); acc = 0; return; }
  acc = (Math.sign(dy) === Math.sign(acc)) ? acc + dy : dy;
  if(acc > 24) H.classList.add("mfa-hide");
  else if(acc < -18) H.classList.remove("mfa-hide");
}
addEventListener("scroll", ()=>{ if(!ticking){ ticking = true; requestAnimationFrame(onScroll); } }, {passive:true});

/* ───────────── 3) المباريات | الترتيب ───────────── */
let MSEG = (()=>{ try{ return sessionStorage.getItem("mfa_mseg") || "list"; }catch(e){ return "list"; } })();
let STD_SIDE = "0";
function stdSides(){
  return [["0","الدوري الممتاز",true],["1","الدرجة الأولى",!!(window.DIV1 && DIV1.tableHTML)],["2","الهواة",!!(window.AMATEUR && AMATEUR.tableHTML)]].filter(x=>x[2]);
}
function stdHTML(){
  const S = stdSides(); if(!S.some(x=>x[0]===STD_SIDE)) STD_SIDE = "0";
  let body = "";
  if(STD_SIDE==="1") body = `<div class="mf-d1t d1">${safe(()=>DIV1.tableHTML())||""}</div>`;
  else if(STD_SIDE==="2") body = `<div class="mf-d1t d1 am">${safe(()=>AMATEUR.tableHTML())||""}</div>`;
  else body = `<div class="hm">${safe(()=>hmStandingsHTML(withComp("الدوري", standings)))||""}</div>`;
  return `${S.length>1?`<div class="mfa-sides" role="tablist">${S.map(([k,t])=>`<button type="button" role="tab" data-mfa-side="${k}" aria-selected="${k===STD_SIDE}">${t}</button>`).join("")}</div>`:""}${body}`;
}
function paintMatchesSeg(force){
  const v = D.getElementById("v-matches"); if(!v || !v.classList.contains("on")) return;
  let seg = v.querySelector(":scope > .mfa-mseg");
  if(!seg){
    seg = D.createElement("div"); seg.className = "mfa-mseg"; seg.setAttribute("role","tablist");
    seg.innerHTML = `<button type="button" role="tab" data-mfa-mseg="list">المباريات</button><button type="button" role="tab" data-mfa-mseg="table">الترتيب</button><i aria-hidden="true"></i>`;
    v.prepend(seg);
  }
  seg.querySelectorAll("[data-mfa-mseg]").forEach(b=>{ const on = String(b.dataset.mfaMseg===MSEG); if(b.getAttribute("aria-selected")!==on) b.setAttribute("aria-selected", on); });
  if(seg.dataset.on!==MSEG) seg.dataset.on = MSEG;
  let std = v.querySelector(":scope > .mfa-std");
  if(MSEG==="table"){
    const fresh = !std; if(!std){ std = D.createElement("div"); std.className = "mfa-std"; seg.after(std); }
    if(fresh || force) std.innerHTML = stdHTML();
    if(!v.classList.contains("mfa-show-std")) v.classList.add("mfa-show-std");
  } else { if(std) std.remove(); if(v.classList.contains("mfa-show-std")) v.classList.remove("mfa-show-std"); }
}
let segQ = 0;
function hookMatches(){
  const v = D.getElementById("v-matches"); if(!v || v.__mfa) return; v.__mfa = true;
  /* القسم يُعاد رسمه (innerHTML) → نعيد المفتاح والجدول؛ تغيّر صنف on (فتح القسم) → نرسم المفتاح فقط */
  new MutationObserver(muts=>{
    const ours = n => n.nodeType===1 && (n.classList.contains("mfa-mseg") || n.classList.contains("mfa-std"));
    const re = muts.some(m=>m.type==="childList" && [...m.addedNodes, ...m.removedNodes].some(n=>!ours(n)));
    const cls = muts.some(m=>m.type==="attributes");
    if(!re && !cls) return;
    if(!segQ) segQ = requestAnimationFrame(()=>{ segQ = 0; paintMatchesSeg(re); });
  }).observe(v, {childList:true, attributes:true, attributeFilter:["class"]});
}
D.addEventListener("click", e=>{
  const s = e.target.closest && e.target.closest("[data-mfa-mseg]");
  if(s){ MSEG = s.dataset.mfaMseg; try{ sessionStorage.setItem("mfa_mseg", MSEG); }catch(err){} paintMatchesSeg(true);
    const v = D.getElementById("v-matches"); const c = v && v.querySelector(MSEG==="table" ? ".mfa-std" : ":scope > :not(.mfa-mseg)");
    if(c && !reduce){ c.classList.remove("mfa-fade"); void c.offsetWidth; c.classList.add("mfa-fade"); }
    window.scrollTo({top:0, behavior:"instant"}); return; }
  const d = e.target.closest && e.target.closest("[data-mfa-side]");
  if(d){ STD_SIDE = d.dataset.mfaSide; paintMatchesSeg(true); }
});
/* «الترتيب» في لوحة الأقسام: في التطبيق يفتح تبويب الترتيب داخل المباريات بدل النزول في الرئيسية */
D.addEventListener("click", e=>{
  const t = e.target.closest && e.target.closest('.mf-hub [data-hub="table"]'); if(!t) return;
  e.stopImmediatePropagation(); e.preventDefault();
  MSEG = "table"; try{ sessionStorage.setItem("mfa_mseg", MSEG); }catch(err){}
  safe(()=>window.MFHUB && MFHUB.close(true));
  const b = D.querySelector('nav.tabs button[data-v="matches"]'); if(b) b.click();
  setTimeout(paintMatchesSeg, 30);
}, true);
/* «المباريات» من الشريط ترجع دائماً لقائمة المباريات */
D.addEventListener("click", e=>{
  const b = e.target.closest && e.target.closest('.mf-bar [data-mf="matches"], .mf-dnav [data-mf="matches"]'); if(!b) return;
  if(curView()!=="matches"){ MSEG = "list"; try{ sessionStorage.setItem("mfa_mseg", MSEG); }catch(err){} }
}, true);

/* ───────────── 4) لوحة الأقسام: سحب للأسفل للإغلاق ───────────── */
function dragClose(sheetSel, close, handleSel){
  let y0 = null, x0 = 0, dy = 0, el = null, t0 = 0;
  D.addEventListener("touchstart", e=>{
    el = e.target.closest && e.target.closest(sheetSel); if(!el) return;
    const sc = el.scrollTop || 0;
    if(sc > 0 && !(handleSel && e.target.closest(handleSel))) { el = null; return; }
    y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; dy = 0; t0 = Date.now();
  }, {passive:true});
  D.addEventListener("touchmove", e=>{
    if(!el || y0==null) return;
    dy = e.touches[0].clientY - y0;
    if(Math.abs(e.touches[0].clientX - x0) > Math.abs(dy)) { el.style.transform = ""; el = null; return; }
    if(dy > 0){ el.style.transition = "none"; el.style.transform = `translate3d(0,${dy}px,0)`; }
  }, {passive:true});
  D.addEventListener("touchend", ()=>{
    if(!el || y0==null) return;
    const fast = dy > 60 && Date.now()-t0 < 260, far = dy > Math.min(160, el.offsetHeight*.28);
    el.style.transition = "";
    if(fast || far){ el.style.transform = `translate3d(0,100%,0)`; const e2 = el; setTimeout(()=>{ e2.style.transform = ""; close(); }, 200); }
    else el.style.transform = "";
    el = null; y0 = null;
  });
}
dragClose(".mf-hub-sheet", ()=>safe(()=>MFHUB.close()), ".mf-hub-hd");

/* ───────────── 5) مركز المباراة ───────────── */
const mbox = () => D.getElementById("mpage");
let mpDir = 0, mpWasHidden = true, mpLastTab = null;
const crestSrc = c => safe(()=> (typeof LOCAL_CRESTS!=="undefined" && LOCAL_CRESTS[c]) || (typeof LOGOS!=="undefined" && LOGOS[c]) || "") || safe(()=>window.EXT && EXT.natFlagSrc && EXT.natFlagSrc(c)) || "";
const esc = s => String(s==null?"":s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function miniHTML(){
  const m = safe(()=>MP.m); if(!m) return "";
  const box = mbox(), res = box.querySelector(".mp-res"), st = box.querySelector(".mp-st"), tm = box.querySelector(".mp-time");
  const sc = res ? `<b dir="ltr">${esc(m.ag)} - ${esc(m.hg)}</b>` : `<b dir="ltr">${esc(tm ? tm.textContent.trim() : "—")}</b>`;
  const cr = c => { const s = crestSrc(c); return s ? `<img src="${esc(s)}" alt="" width="24" height="24">` : ""; };
  return `<button type="button" class="mfa-mini-x" data-mp-close aria-label="رجوع"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="${RTL()?"m9 6 6 6-6 6":"m15 6-6 6 6 6"}"/></svg></button>
    <span class="t">${cr(m.home)}<em>${esc(m.home)}</em></span><span class="s">${sc}<small>${esc(st ? st.textContent.trim() : "")}</small></span><span class="t a"><em>${esc(m.away)}</em>${cr(m.away)}</span>`;
}
function afterMatchRender(){
  const box = mbox(); if(!box) return;
  const sh = box.querySelector(".mp-sheet"); if(!sh) return;
  /* لوحة النتيجة المصغّرة */
  let mini = sh.querySelector(":scope > .mfa-mini");
  if(!mini){ mini = D.createElement("div"); mini.className = "mfa-mini"; mini.setAttribute("aria-hidden","true"); sh.prepend(mini); }
  mini.innerHTML = miniHTML();
  /* إعادة رسم بلا تغيير تبويب (تحديث بيانات في الخلفية) كانت ترجع الصفحة لأعلاها — نحفظ موضع القارئ */
  const key = safe(()=>matchKey(MP.m)), tab0 = safe(()=>MP.tab);
  if(MPY.key===key && MPY.tab===tab0 && MPY.y>0 && sh.scrollTop===0 && tab0===mpLastTab) sh.scrollTop = MPY.y;
  syncMini(sh);
  /* التبويب النشط في منتصف شريط التبويبات */
  const nav = sh.querySelector(".mp-tabs"), on = nav && nav.querySelector('[aria-pressed="true"]');
  if(nav && on){ const nr = nav.getBoundingClientRect(), br = on.getBoundingClientRect();
    nav.scrollLeft += (br.left + br.width/2) - (nr.left + nr.width/2); }
  /* انتقال المحتوى عند تبديل التبويب */
  const tab = safe(()=>MP.tab);
  const body = sh.querySelector(".mp-body");
  if(body && mpLastTab && tab!==mpLastTab && !reduce){
    body.classList.add(mpDir>0 ? "mfa-in-f" : mpDir<0 ? "mfa-in-b" : "mfa-in-u");
  }
  mpLastTab = tab; mpDir = 0;
}
const MPY = {key:null, tab:null, y:0};
function syncMini(sh){
  MPY.key = safe(()=>matchKey(MP.m)); MPY.tab = safe(()=>MP.tab); MPY.y = sh.scrollTop;
  const box = mbox(); if(!box || !sh) return;
  const head = sh.querySelector(".mp-head"); if(!head) return;
  const on = sh.scrollTop > head.offsetHeight - 56;
  box.classList.toggle("mfa-mini-on", on);
}
D.addEventListener("scroll", e=>{ const t = e.target; if(t && t.classList && t.classList.contains("mp-sheet")) syncMini(t); }, true);
function hookMatch(){
  const box = mbox(); if(!box || box.__mfa) return; box.__mfa = true;
  new MutationObserver(muts=>{
    const opened = mpWasHidden && !box.hidden; mpWasHidden = box.hidden;
    if(box.hidden){ mpLastTab = null; box.classList.remove("mfa-mini-on","mfa-open"); return; }
    if(opened && !reduce){ box.classList.remove("mfa-open"); void box.offsetWidth; box.classList.add("mfa-open"); setTimeout(()=>box.classList.remove("mfa-open"), 460); mpLastTab = null; }
    if(muts.some(m=>m.type==="childList")) afterMatchRender();
  }).observe(box, {childList:true, attributes:true, attributeFilter:["hidden"]});
}
/* اتجاه تبديل التبويب (للحركة) */
D.addEventListener("click", e=>{
  const t = e.target.closest && e.target.closest("#mpage [data-mp-tab]"); if(!t) return;
  const L = [...D.querySelectorAll("#mpage .mp-tabs [data-mp-tab]")].map(b=>b.dataset.mpTab);
  const a = L.indexOf(safe(()=>MP.tab)), b = L.indexOf(t.dataset.mpTab);
  mpDir = a<0||b<0 ? 0 : Math.sign(b-a);
}, true);
/* سحب أفقي بين تبويبات المباراة — لا يعمل فوق عنصر يتمرر أفقياً (جداول، شرائط، الملعب) ولا من حافة الشاشة */
function hScrollable(el, stop){
  for(let n = el; n && n!==stop; n = n.parentElement){
    if(n.scrollWidth > n.clientWidth + 4){ const o = getComputedStyle(n).overflowX; if(o==="auto" || o==="scroll") return true; }
    if(n.matches && n.matches("input,select,textarea,[contenteditable],.mpx-pitch,.xipitch,svg")) return true;
  }
  return false;
}
(function(){
  let x0 = null, y0 = 0, t0 = 0, ok = false;
  D.addEventListener("touchstart", e=>{
    const body = e.target.closest && e.target.closest("#mpage .mp-body");
    if(!body || e.touches.length>1){ x0 = null; return; }
    const x = e.touches[0].clientX;
    if(x < 24 || x > innerWidth-24){ x0 = null; return; }        /* حافة الشاشة لإيماءة النظام */
    ok = !hScrollable(e.target, body);
    x0 = x; y0 = e.touches[0].clientY; t0 = Date.now();
  }, {passive:true});
  D.addEventListener("touchend", e=>{
    if(x0==null || !ok) return;
    const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0; x0 = null;
    if(Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx)*.55 || Date.now()-t0 > 700) return;
    const L = [...D.querySelectorAll("#mpage .mp-tabs [data-mp-tab]")]; const i = L.findIndex(b=>b.getAttribute("aria-pressed")==="true");
    /* RTL: التبويب التالي على اليسار، فالسحب نحو اليمين يجلبه */
    const next = RTL() ? dx > 0 : dx < 0;
    const j = i + (next ? 1 : -1);
    if(i<0 || j<0 || j>=L.length) return;
    L[j].click();
  }, {passive:true});
})();
/* سحب رأس المباراة للأسفل يغلقها (والصفحة في أعلاها) */
dragClose("#mpage .mp-sheet", ()=>safe(()=>closeMatch()), ".mp-head, .mfa-mini");

/* ───────────── الإقلاع ───────────── */
function boot(){
  LASTV = (D.querySelector(".view.on") || {id:"v-home"}).id.replace(/^v-/,"");
  hookGo(); hookMatches(); hookMatch();
  /* شريط الحالة يبقى مغطّى حين يختفي الشريط العلوي */
  if(!D.querySelector(".mfa-sb")){ const s = D.createElement("div"); s.className = "mfa-sb"; s.setAttribute("aria-hidden","true"); D.body.appendChild(s); }
}
window.MFAPP = {get SCROLL(){ return SCROLL; }, paintMatchesSeg, afterMatchRender, setSeg(s){ MSEG = s; paintMatchesSeg(); }};
if(D.readyState==="loading") D.addEventListener("DOMContentLoaded", ()=>setTimeout(boot, 80)); else setTimeout(boot, 80);
})();
