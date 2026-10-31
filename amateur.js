/* =====================================================================
   دوري الهواة الكويتي — الموسم التاسع 2026/2027 (منصور 2026-10-31)

   «ضيف دوري الهواة مع شعاراتهم و اسامي الانديه و التحرير فقط نتيجة بدون
   تفاصيل و يظهر ترتيب الدوري» — 14 فريقاً، النتائج والترتيب فقط: لا أهداف
   ولا بطاقات ولا لاعبين. منفصل تماماً عن باقي الموقع: وثيقة مستقلة
   seasons/amateur {matches:[{id, round, date, home, away, hg, ag}], updated, updatedBy}
   الجدول يُحسب من النتائج لحظة العرض. الإدخال: تبويب «الهواة» في الإدارة.
   نفس بناء div1.js ونفس أصنافه (d1-*) في التنسيق.
   وضع الاختبار: ‏?livetest=1 على localhost — تخزين محلي فقط.
   ===================================================================== */
(function(){
"use strict";
const AM = window.AMATEUR = {};
const DOC_ID = "amateur", NAME = "دوري الهواة الكويتي", SEASON_L = "2026/2027", CACHE_K = "mfamateur_cache", LS_TEST = "mfamateur";
const TEST = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && /[?&]livetest=1\b/.test(location.search);
const H = s => String(s==null?"":s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);
const say = (m, k) => { if(typeof toast==="function") toast(m, k); };

/* الفرق المشاركة بترتيب ملصق الاتحاد، والشعارات مقصوصة منه على قرص أبيض */
const TEAMS = {"هايدو":"haido", "لوسيل":"lusail", "كان":"can", "أطلس":"atlas", "الأزرق 82":"azraq82", "أور كامل":"ourcamel", "فيكتوريز":"victories",
  "القادسية":"qadsia", "هومنتمن":"homenetmen", "C7":"c7", "الكوت":"alkout", "فاموس":"vamos", "النهضة":"alnahda", "الريان":"alrayan"};
const crestSrc = c => TEAMS[c] ? `assets/crests/amateur/${TEAMS[c]}.webp?v=1` : "";
const crest = c => { const s = crestSrc(c); return s ? `<img class="d1-cr am-cr" src="${s}" alt="" width="32" height="32" loading="lazy">` : `<span class="d1-cr d1-cr-x">${H(String(c).slice(0,2))}</span>`; };

/* الترجمة (منصور 2026-10-31: «تاكد انه مترجم») — عربي ← إنجليزي في I18N.DICT، وإنجليزي ← اللغات الأخرى في I18N_PT.
   لا يغيّر مفتاحاً موجوداً. أسماء الفرق تبقى بالإنجليزية في كل اللغات اللاتينية. */
const SEASON_AR = `الموسم التاسع ${SEASON_L} · ${Object.keys(TEAMS).length} فريقاً`;
const EN = {"دوري الهواة الكويتي":"Kuwait Amateur League", "دوري الهواة":"Amateur League", "الهواة":"Amateur", [SEASON_AR]:"Season 9 · 2026/2027 · 14 teams",
  "النتائج":"Results", "الفريق":"Team", "لم تُسجَّل أي نتيجة بعد.":"No results yet.", "لا نتائج بعد.":"No results yet.",
  "هايدو":"Haido", "لوسيل":"Lusail", "كان":"CAN", "أطلس":"Atlas", "الأزرق 82":"Al-Azraq 82", "أور كامل":"Our Camel", "فيكتوريز":"Victories",
  "القادسية":"Qadsia", "هومنتمن":"Homenetmen", "الكوت":"Al-Kout", "فاموس":"Vamos", "النهضة":"Al-Nahda", "الريان":"Al-Rayan"};
const OV = {
  BR:{"Kuwait Amateur League":"Liga Amadora do Kuwait", "Amateur League":"Liga Amadora", "Amateur":"Amadores", "Season 9 · 2026/2027 · 14 teams":"9ª temporada · 2026/2027 · 14 times", "No results yet.":"Ainda sem resultados.", "Results":"Resultados", "Team":"Time"},
  PT:{"Kuwait Amateur League":"Liga Amadora do Kuwait", "Amateur League":"Liga Amadora", "Amateur":"Amadores", "Season 9 · 2026/2027 · 14 teams":"9.ª época · 2026/2027 · 14 equipas", "No results yet.":"Ainda sem resultados.", "Results":"Resultados", "Team":"Equipa"},
  ES:{"Kuwait Amateur League":"Liga Amateur de Kuwait", "Amateur League":"Liga Amateur", "Amateur":"Amateur", "Season 9 · 2026/2027 · 14 teams":"9.ª temporada · 2026/2027 · 14 equipos", "No results yet.":"Aún no hay resultados.", "Results":"Resultados", "Team":"Equipo"},
  FR:{"Kuwait Amateur League":"Ligue amateur du Koweït", "Amateur League":"Ligue amateur", "Amateur":"Amateurs", "Season 9 · 2026/2027 · 14 teams":"9e saison · 2026/2027 · 14 équipes", "No results yet.":"Aucun résultat pour l'instant.", "Results":"Résultats", "Team":"Équipe"},
  SH:{"Kuwait Amateur League":"Kuvajtska amaterska liga", "Amateur League":"Amaterska liga", "Amateur":"Amateri", "Season 9 · 2026/2027 · 14 teams":"9. sezona · 2026/2027 · 14 timova", "No results yet.":"Još nema rezultata.", "Results":"Rezultati", "Team":"Tim"}
};
(function addI18n(){
  if(typeof I18N==="undefined" || !I18N.DICT) return;
  for(const k in EN) if(I18N.DICT[k]==null) I18N.DICT[k] = EN[k];
  I18N.EXACT = Object.assign(I18N.EXACT || {}, {"كان":1});
  I18N._keysSorted = null; I18N._cmp = null;
  if(typeof I18N_PT!=="undefined") for(const L in OV){ const D = I18N_PT[L] || (I18N_PT[L] = {}); for(const k in OV[L]) if(D[k]==null) D[k] = OV[L][k]; }
})();

const num = v => (v===null || v===undefined || v==="") ? null : (Number.isFinite(+v) ? +v : null);
const played = m => num(m.hg)!==null && num(m.ag)!==null;
function normalize(d){
  const out = d && Array.isArray(d.matches) ? clone(d) : {matches:[]};
  out.matches = out.matches.filter(m=>m && m.home && m.away).map(m=>Object.assign({id:uid(), date:""}, m, {round:+m.round||1, hg:num(m.hg), ag:num(m.ag)}));
  return out;
}
let DATA = null;
AM.data = () => DATA;

/* ───────────── التخزين ───────────── */
const store = {
  watch(cb){
    if(TEST){ const r=()=>{ try{ const s=localStorage.getItem(LS_TEST); cb(s?JSON.parse(s):null); }catch(e){ cb(null); } }; r(); window.addEventListener("storage", e=>{ if(e.key===LS_TEST) r(); }); return; }
    let live = false, last = "";
    const early = d => { if(live || !d || !Array.isArray(d.matches)) return; const u = String(d.updated||""); if(last && u <= last) return; last = u; cb(d); };
    try{ const c = localStorage.getItem(CACHE_K); if(c) early(JSON.parse(c)); }catch(e){}
    if(typeof SNAP!=="undefined" && SNAP && SNAP.get) SNAP.get(DOC_ID).then(early).catch(()=>{});
    const go = () => { if(typeof fbDb==="undefined" || !fbDb){ setTimeout(go, 400); return; }
      fbDb.collection("seasons").doc(DOC_ID).onSnapshot(s=>{ live = true; const d = s.exists ? s.data() : null;
        if(d) try{ localStorage.setItem(CACHE_K, JSON.stringify(d)); }catch(e){}
        cb(d); }, ()=>{}); };
    go();
  },
  async save(d){
    const obj = clone(d); obj.updated = new Date().toISOString(); obj.updatedBy = (typeof FBUSER!=="undefined" && FBUSER && FBUSER.email) || "";
    if(TEST){ localStorage.setItem(LS_TEST, JSON.stringify(obj)); return obj; }
    if(typeof fbDb==="undefined" || !fbDb) throw new Error("السحابة غير متاحة");
    await fbDb.collection("seasons").doc(DOC_ID).set(obj); return obj;
  }
};

/* ───────────── الحساب ───────────── */
function table(){
  const T = {}; Object.keys(TEAMS).forEach(c=>T[c] = {c, p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0});
  (DATA.matches||[]).filter(played).forEach(m=>{
    const h = T[m.home] || (T[m.home] = {c:m.home, p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0});
    const a = T[m.away] || (T[m.away] = {c:m.away, p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0});
    const hg = +m.hg, ag = +m.ag;
    h.p++; a.p++; h.gf += hg; h.ga += ag; a.gf += ag; a.ga += hg;
    if(hg>ag){ h.w++; a.l++; h.pts += 3; }
    else if(hg<ag){ a.w++; h.l++; a.pts += 3; }
    else { h.d++; a.d++; h.pts++; a.pts++; }
  });
  return Object.values(T).sort((x,y)=>y.pts-x.pts || (y.gf-y.ga)-(x.gf-x.ga) || y.gf-x.gf || x.c.localeCompare(y.c,"ar"));
}
const AR_DOW = ["الأحد","الإثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
const AR_MON = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const dLbl = s => { if(!s) return ""; const d = new Date(s+"T00:00:00"); return isNaN(d) ? H(s) : `${AR_DOW[d.getDay()]} ${d.getDate()} ${AR_MON[d.getMonth()]}`; };
const rounds = () => [...new Set((DATA.matches||[]).map(m=>m.round))].sort((a,b)=>b-a);   /* الأحدث أولاً */
const scp = (h, a) => `${h} - ${a}`;

/* ───────────── العرض ───────────── */
const VIEW = {tab:"table"};
function tableHTML(){
  const rows = table(), any = rows.some(r=>r.p);
  return `<div class="d1-card">
    <table class="d1-tbl">
      <thead><tr><th>#</th><th class="cl">الفريق</th><th title="لعب">ل</th><th title="فوز">ف</th><th title="تعادل">ت</th><th title="خسارة">خ</th><th class="gl" title="له وعليه">له:عليه</th><th title="الفارق">+/-</th><th class="pt" title="النقاط">ن</th></tr></thead>
      <tbody>${rows.map((r,i)=>{ const gd = r.gf-r.ga;
        return `<tr><td class="rk">${i+1}</td><td class="cl"><span class="d1-tm">${crest(r.c)}<b>${H(r.c)}</b></span></td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td class="gl"><bdi dir="ltr">${r.gf}:${r.ga}</bdi></td><td><bdi dir="ltr">${gd>0?"+":""}${gd}</bdi></td><td class="pt">${r.pts}</td></tr>`; }).join("")}</tbody>
    </table>
    ${any ? "" : `<p class="d1-empty">لم تُسجَّل أي نتيجة بعد.</p>`}
  </div>`;
}
function matchHTML(m){
  const hw = m.hg>m.ag, aw = m.ag>m.hg;
  return `<div class="d1-m done">
    <div class="d1-mt h${hw?" win":""}">${crest(m.home)}<b>${H(m.home)}</b></div>
    <div class="d1-ms"><bdi dir="ltr" class="sc">${scp(m.hg,m.ag)}</bdi><small>انتهت</small></div>
    <div class="d1-mt a${aw?" win":""}"><b>${H(m.away)}</b>${crest(m.away)}</div>
  </div>`;
}
function matchesHTML(){
  return rounds().map(r=>{
    const ms = DATA.matches.filter(m=>m.round===r && played(m)); if(!ms.length) return "";
    const dates = [...new Set(ms.map(m=>m.date).filter(Boolean))];
    return `<section class="d1-rnd">
      <div class="d1-rh"><h3>الجولة ${r}</h3><span>${dates.map(dLbl).join(" · ")}</span></div>
      <div class="d1-card d1-ml">${ms.map(matchHTML).join("")}</div>
    </section>`;
  }).join("") || `<p class="d1-empty">لا نتائج بعد.</p>`;
}
function render(){
  const v = document.getElementById("v-amateur"); if(!v) return;
  if(!DATA) DATA = normalize(null);
  const tabs = [["table","الترتيب"],["matches","النتائج"]];
  v.innerHTML = `<div class="d1 am">
    <header class="d1-hero"><h2>${NAME}</h2><p>${SEASON_AR}</p></header>
    <nav class="d1-tabs" role="tablist">${tabs.map(([k,t])=>`<button type="button" role="tab" data-amtab="${k}" aria-selected="${VIEW.tab===k}">${t}</button>`).join("")}</nav>
    <div class="d1-body">${VIEW.tab==="table" ? tableHTML() : matchesHTML()}</div>
  </div>`;
}
AM.render = render;
AM.count = () => { if(!DATA) DATA = normalize(null); return DATA.matches.length; };
function repaint(){ if(document.querySelector("#v-amateur.on")) render(); paintAdmin(); }
document.addEventListener("click", e=>{
  const t = e.target.closest && e.target.closest("[data-amtab]");
  if(t){ VIEW.tab = t.dataset.amtab; render(); }
});

/* ───────────── الإدارة: النتيجة فقط ───────────── */
let ED = null;   /* {matches, dirty} نسخة التحرير */
const canEdit = () => TEST || (typeof isAdmin!=="undefined" && !!isAdmin);
const teamOpts = sel => `<option value="">— اختر —</option>` + Object.keys(TEAMS).map(c=>`<option${c===sel?" selected":""}>${H(c)}</option>`).join("");
function adminHTML(){
  if(!ED) ED = {matches:clone((DATA||normalize(null)).matches), dirty:false};
  const rs = [...new Set(ED.matches.map(m=>m.round))].sort((a,b)=>a-b);
  const row = m => `<div class="d1a-row" data-id="${H(m.id)}">
      <span class="t h">${H(m.home)}</span>
      <input class="sc" type="number" inputmode="numeric" min="0" max="40" data-amf="hg" value="${m.hg==null?"":m.hg}" aria-label="أهداف ${H(m.home)}">
      <span class="x">-</span>
      <input class="sc" type="number" inputmode="numeric" min="0" max="40" data-amf="ag" value="${m.ag==null?"":m.ag}" aria-label="أهداف ${H(m.away)}">
      <span class="t a">${H(m.away)}</span>
      <div class="meta"><button type="button" class="dl" data-ama="rm">حذف</button></div>
    </div>`;
  const last = rs[rs.length-1] || 1;
  return `<div id="amAdmin"><h2 class="sec">دوري الهواة</h2>
    <p class="hint">النتيجة فقط: اختر الجولة والفريقين واكتب النتيجة ثم «إضافة» و«حفظ». الترتيب يُحسب تلقائياً.</p>
    <div class="card pad d1a">
      <div class="d1a-add am-add"><h4>إضافة نتيجة</h4>
        <div class="d1a-addf">
          <label>الجولة<input type="number" min="1" max="40" id="amR" value="${last}"></label>
          <label>التاريخ<input type="date" id="amD"></label>
          <label>المضيف<select id="amH">${teamOpts("")}</select></label>
          <label>الضيف<select id="amA">${teamOpts("")}</select></label>
          <label>أهداف المضيف<input type="number" inputmode="numeric" min="0" max="40" id="amHG"></label>
          <label>أهداف الضيف<input type="number" inputmode="numeric" min="0" max="40" id="amAG"></label>
        </div>
        <button type="button" class="btn" data-ama="add">+ إضافة</button>
      </div>
      ${rs.slice().reverse().map((r,i)=>`<details class="rndbox"${i===0?" open":""}><summary><b>الجولة ${r}</b><span class="rc">${ED.matches.filter(m=>m.round===r).length} مباريات</span></summary>
        <div class="d1a-list">${ED.matches.filter(m=>m.round===r).map(row).join("")}</div></details>`).join("")}
      <div class="d1a-save"><button type="button" class="btn" data-ama="save"${ED.dirty?"":" disabled"}>حفظ</button><span>${ED.dirty ? "تعديلات غير محفوظة" : "كل شيء محفوظ"}</span></div>
    </div></div>`;
}
function paintAdmin(){
  const box = document.getElementById("amAdmin"); if(!box) return;
  if(ED && !ED.dirty) ED = null;
  const t = document.createElement("div"); t.innerHTML = adminHTML(); box.replaceWith(t.firstElementChild);
}
function paintAdminKeep(){ const box = document.getElementById("amAdmin"); if(!box) return; const t = document.createElement("div"); t.innerHTML = adminHTML(); box.replaceWith(t.firstElementChild); }
function setDirty(){ if(!ED) return; ED.dirty = true; const s = document.querySelector("#amAdmin .d1a-save"); if(s){ s.querySelector("button").disabled = false; s.querySelector("span").textContent = "تعديلات غير محفوظة"; } }
document.addEventListener("input", e=>{
  const f = e.target.closest && e.target.closest("#amAdmin [data-amf]"); if(!f || !ED) return;
  const id = f.closest("[data-id]").dataset.id, m = ED.matches.find(x=>x.id===id); if(!m) return;
  m[f.dataset.amf] = num(f.value); setDirty();
});
document.addEventListener("click", async e=>{
  const b = e.target.closest && e.target.closest("#amAdmin [data-ama]"); if(!b || !ED) return;
  const a = b.dataset.ama;
  if(a==="rm"){ const id = b.closest("[data-id]").dataset.id, m = ED.matches.find(x=>x.id===id);
    if(!m || !confirm(`حذف ${m.home} × ${m.away}؟`)) return;
    ED.matches = ED.matches.filter(x=>x.id!==id); ED.dirty = true; paintAdminKeep(); return; }
  if(a==="add"){
    const g = id => document.getElementById(id);
    const home = g("amH").value, away = g("amA").value, round = +g("amR").value || 1, hg = num(g("amHG").value), ag = num(g("amAG").value);
    if(!home || !away || home===away){ say("اختر فريقين مختلفين", "err"); return; }
    if(hg===null || ag===null){ say("اكتب النتيجة (الخانتين)", "err"); return; }
    if(ED.matches.some(x=>x.round===round && [x.home,x.away].some(t=>t===home || t===away))){ say("أحد الفريقين له مباراة في نفس الجولة", "err"); return; }
    ED.matches.push({id:uid(), round, date:g("amD").value, home, away, hg, ag});
    ED.dirty = true; paintAdminKeep(); return; }
  if(a==="save"){
    const bad = ED.matches.find(m=>!played(m));
    if(bad){ say(`أكمل نتيجة ${bad.home} × ${bad.away}`, "err"); return; }
    b.disabled = true;
    try{ const next = normalize({matches:ED.matches}); await store.save(next); DATA = next; ED = null; say("حُفظ دوري الهواة", "ok"); }
    catch(x){ console.error(x); say("تعذّر الحفظ: "+(x.code||x.message), "err"); b.disabled = false; return; }
    repaint(); }
});
function injectAdmin(){
  const v = document.getElementById("v-admin"); if(!v || document.getElementById("amAdmin") || !canEdit()) return;
  if(!document.getElementById("matchAdmin")) return;
  const w = document.createElement("div"); w.innerHTML = adminHTML(); v.appendChild(w.firstElementChild);
}

/* ───────────── ربط الموقع ───────────── */
function hookSite(){
  const nav = document.querySelector("nav.tabs");
  if(nav && !nav.querySelector('[data-v="amateur"]')){
    const b = document.createElement("button"); b.setAttribute("role","tab"); b.dataset.v = "amateur"; b.setAttribute("aria-selected","false");
    b.innerHTML = `<svg class="ic" aria-hidden="true" width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h12M4 18h8"/></svg><span>الهواة</span>`;
    const g = nav.querySelector('[data-v="div1"]') || nav.querySelector('[data-v="analysis"]');
    if(g) g.after(b); else nav.appendChild(b);
    b.addEventListener("click", ()=>{ if(typeof go==="function") go("amateur"); });
  }
  if(!document.getElementById("v-amateur")){ const s = document.createElement("section"); s.className = "view"; s.id = "v-amateur";
    const a = document.getElementById("v-div1") || document.getElementById("v-analysis"); (a?a.parentNode:document.querySelector("main")||document.body).insertBefore(s, a?a.nextSibling:null); }
  if(typeof RENDER==="object" && RENDER) RENDER.amateur = render;
}
function hookAdmin(){
  ["renderAdmin","renderEditorAdmin"].forEach(n=>{ const f = window[n]; if(typeof f!=="function" || f.__amadm) return;
    const w = function(){ const r = f.apply(this, arguments);
      try{ injectAdmin(); if(window.ADMIN_TABS){ const v = document.getElementById("v-admin"); if(v && v.querySelector(".adm-tabs")){ v.querySelector(".adm-tabs").remove(); v.querySelectorAll(".adm-panel").forEach(p=>{ while(p.firstChild) v.insertBefore(p.firstChild, p); p.remove(); }); ADMIN_TABS.organize(); } } }catch(e){ console.error(e); }
      return r; };
    w.__amadm = true; Object.keys(f).forEach(k=>{ try{ w[k] = f[k]; }catch(e){} });
    try{ window[n] = w; }catch(e){} try{ if(n==="renderAdmin") renderAdmin = w; else renderEditorAdmin = w; }catch(e){}
  });
  if(typeof RENDER==="object" && RENDER) RENDER.admin = window.renderAdmin;
}
function boot(){
  if(!DATA) DATA = normalize(null);
  hookSite(); hookAdmin();
  store.watch(d=>{ DATA = normalize(d); repaint(); });
}
/* بعد div1.js (يُحمَّل بعده) حتى يلتفّ على دالة الإدارة الملفوفة أصلاً */
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", ()=>setTimeout(boot, 0)); else setTimeout(boot, 0);
})();
