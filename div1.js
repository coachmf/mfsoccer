/* =====================================================================
   دوري الدرجة الأولى 2026/2027 (منصور 2026-10-07)

   المباريات ونتائجها وجدول الترتيب فقط — لا أهداف ولا بطاقات ولا لاعبين
   ولا إحصاءات. منفصل تماماً عن الدوري الممتاز: وثيقة مستقلة seasons/div1
     {matches:[{id, round, date, time, venue, home, away, hg, ag}], updated, updatedBy}
   (hg/ag فارغان = لم تُلعب بعد). لا يكتب شيئاً في ALL ولا كأس الخليج ولا
   الفانتسي. الجدول يُحسب من النتائج لحظة العرض.
   الإدخال: تبويب «الدرجة الأولى» في الإدارة.
   وضع الاختبار: ‏?livetest=1 على localhost — تخزين محلي فقط.
   ===================================================================== */
(function(){
"use strict";
const D1 = window.DIV1 = {};
const DOC_ID = "div1", NAME = "دوري الدرجة الأولى", SEASON_L = "2026/2027", CACHE_K = "mfdiv1_cache";
const TEST = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && /[?&]livetest=1\b/.test(location.search);
const H = s => String(s==null?"":s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);
const say = (m, k) => { if(typeof toast==="function") toast(m, k); };

/* الأندية (القسم الأول) والشعارات من ملصقات الاتحاد */
const TEAMS = {"سبورتي":"sporty", "خيطان":"khaitan", "برقان":"burgan", "الجزيرة":"jazeera", "الشامية":"shamiya", "اتحاد الشرطة":"police", "اليرموك":"yarmouk"};
const crestSrc = c => TEAMS[c] ? `assets/crests/div1/${TEAMS[c]}.png?v=1` : "";
const crest = (c, cls) => { const s = crestSrc(c); return s ? `<img class="d1-cr${cls?" "+cls:""}" src="${s}" alt="" width="32" height="32" loading="lazy">` : `<span class="d1-cr d1-cr-x${cls?" "+cls:""}">${H(String(c).slice(0,2))}</span>`; };

/* الجولات 1–3 من ملصق الاتحاد (المضيف أولاً) */
const FIXTURES = [
  [1,"2026-10-08","17:50","سبورتي","خيطان","استاد نايف الدبوس"],
  [1,"2026-10-08","17:50","برقان","الجزيرة","استاد ناصر العصيمي"],
  [1,"2026-10-08","17:50","الشامية","اتحاد الشرطة","استاد الساحل"],
  [2,"2026-10-14","17:45","اليرموك","برقان","استاد عبدالله الخليفة الصباح"],
  [2,"2026-10-14","17:45","اتحاد الشرطة","سبورتي","استاد ناصر العصيمي"],
  [2,"2026-10-14","17:45","الجزيرة","الشامية","استاد الشباب"],
  [3,"2026-10-24","17:35","خيطان","اتحاد الشرطة","استاد ناصر العصيمي"],
  [3,"2026-10-24","17:35","الشامية","اليرموك","استاد الساحل"],
  [3,"2026-10-24","17:35","سبورتي","الجزيرة","استاد عبدالله الخليفة الصباح"]
];
const seed = () => ({matches:FIXTURES.map(([round,date,time,home,away,venue],i)=>({id:"f"+(i+1), round, date, time, venue, home, away, hg:null, ag:null}))});
const num = v => (v===null || v===undefined || v==="") ? null : (Number.isFinite(+v) ? +v : null);
const played = m => num(m.hg)!==null && num(m.ag)!==null;
function normalize(d){
  const out = d && Array.isArray(d.matches) ? clone(d) : seed();
  out.matches = out.matches.filter(m=>m && m.home && m.away).map(m=>Object.assign({id:uid(), venue:"", time:"", date:""}, m, {round:+m.round||1, hg:num(m.hg), ag:num(m.ag)}));
  return out;
}
let DATA = null;
D1.data = () => DATA;

/* ───────────── التخزين ───────────── */
const store = {
  watch(cb){
    if(TEST){ const r=()=>{ try{ const s=localStorage.getItem("mfdiv1"); cb(s?JSON.parse(s):null); }catch(e){ cb(null); } }; r(); window.addEventListener("storage", e=>{ if(e.key==="mfdiv1") r(); }); return; }
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
    if(TEST){ localStorage.setItem("mfdiv1", JSON.stringify(obj)); return obj; }
    if(typeof fbDb==="undefined" || !fbDb) throw new Error("السحابة غير متاحة");
    await fbDb.collection("seasons").doc(DOC_ID).set(obj); return obj;
  }
};

/* ───────────── الحساب ───────────── */
function table(){
  const T = {}; Object.keys(TEAMS).forEach(c=>T[c] = {c, p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0, form:[]});
  (DATA.matches||[]).filter(played).sort((a,b)=>String(a.date).localeCompare(String(b.date)) || a.round-b.round).forEach(m=>{
    const h = T[m.home] || (T[m.home] = {c:m.home, p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0, form:[]});
    const a = T[m.away] || (T[m.away] = {c:m.away, p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0, form:[]});
    const hg = +m.hg, ag = +m.ag;
    h.p++; a.p++; h.gf += hg; h.ga += ag; a.gf += ag; a.ga += hg;
    if(hg>ag){ h.w++; a.l++; h.pts += 3; h.form.push("w"); a.form.push("l"); }
    else if(hg<ag){ a.w++; h.l++; a.pts += 3; a.form.push("w"); h.form.push("l"); }
    else { h.d++; a.d++; h.pts++; a.pts++; h.form.push("d"); a.form.push("d"); }
  });
  return Object.values(T).sort((x,y)=>y.pts-x.pts || (y.gf-y.ga)-(x.gf-x.ga) || y.gf-x.gf || x.c.localeCompare(y.c,"ar"));
}
const AR_DOW = ["الأحد","الإثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
const AR_MON = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const dLbl = s => { if(!s) return ""; const d = new Date(s+"T00:00:00"); return isNaN(d) ? H(s) : `${AR_DOW[d.getDay()]} ${d.getDate()} ${AR_MON[d.getMonth()]}`; };
const tLbl = t => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(t||"")); if(!m) return H(t||""); let h = +m[1]; const pm = h>=12; h = h%12 || 12; return `${h}:${m[2]} ${pm?"م":"ص"}`; };
const rounds = () => [...new Set((DATA.matches||[]).map(m=>m.round))].sort((a,b)=>a-b);

/* ───────────── العرض ───────────── */
const VIEW = {tab:null};
function tableHTML(){
  const rows = table(), any = rows.some(r=>r.p);
  return `<div class="d1-card">
    <table class="d1-tbl">
      <thead><tr><th>#</th><th class="cl">النادي</th><th title="لعب">ل</th><th title="فوز">ف</th><th title="تعادل">ت</th><th title="خسارة">خ</th><th class="gl" title="له وعليه">له:عليه</th><th title="الفارق">+/-</th><th class="pt" title="النقاط">ن</th></tr></thead>
      <tbody>${rows.map((r,i)=>{ const gd = r.gf-r.ga;
        return `<tr><td class="rk">${i+1}</td><td class="cl"><span class="d1-tm">${crest(r.c)}<b>${H(r.c)}</b></span></td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td class="gl"><bdi dir="ltr">${r.gf}:${r.ga}</bdi></td><td><bdi dir="ltr">${gd>0?"+":""}${gd}</bdi></td><td class="pt">${r.pts}</td></tr>`; }).join("")}</tbody>
    </table>
    ${any ? "" : `<p class="d1-empty">لم تُلعب أي مباراة بعد — يبدأ الدوري ${dLbl(FIXTURES[0][1])}.</p>`}
  </div>`;
}
function matchHTML(m){
  const p = played(m), hw = p && m.hg>m.ag, aw = p && m.ag>m.hg;
  return `<div class="d1-m${p?" done":""}">
    <div class="d1-mt h${hw?" win":""}">${crest(m.home)}<b>${H(m.home)}</b></div>
    <div class="d1-ms">${p ? `<bdi dir="ltr" class="sc">${m.ag} - ${m.hg}</bdi><small>انتهت</small>` : `<span class="tm">${tLbl(m.time)||"—"}</span><small>لم تبدأ</small>`}</div>
    <div class="d1-mt a${aw?" win":""}"><b>${H(m.away)}</b>${crest(m.away)}</div>
    ${m.venue ? `<div class="d1-mv">${H(m.venue)}</div>` : ""}
  </div>`;
}
function matchesHTML(){
  const all = Object.keys(TEAMS);
  return rounds().map(r=>{
    const ms = DATA.matches.filter(m=>m.round===r).sort((a,b)=>String(a.date+a.time).localeCompare(String(b.date+b.time)));
    const inR = new Set(ms.flatMap(m=>[m.home, m.away])), rest = all.filter(c=>!inR.has(c));
    const dates = [...new Set(ms.map(m=>m.date).filter(Boolean))];
    return `<section class="d1-rnd">
      <div class="d1-rh"><h3>الجولة ${r}</h3><span>${dates.map(dLbl).join(" · ")}</span></div>
      <div class="d1-card d1-ml">${ms.map(matchHTML).join("")}</div>
      ${rest.length ? `<p class="d1-bye">راحة: ${rest.map(H).join("، ")}</p>` : ""}
    </section>`;
  }).join("") || `<p class="d1-empty">لا مباريات بعد.</p>`;
}
function render(){
  const v = document.getElementById("v-div1"); if(!v) return;
  if(!DATA) DATA = normalize(null);
  if(!VIEW.tab) VIEW.tab = DATA.matches.some(played) ? "table" : "matches";
  const tabs = [["table","الترتيب"],["matches","المباريات"]];
  v.innerHTML = `<div class="d1">
    <header class="d1-hero"><h2>${NAME}</h2><p>الموسم ${SEASON_L} · القسم الأول</p></header>
    <nav class="d1-tabs" role="tablist">${tabs.map(([k,t])=>`<button type="button" role="tab" data-d1tab="${k}" aria-selected="${VIEW.tab===k}">${t}</button>`).join("")}</nav>
    <div class="d1-body">${VIEW.tab==="table" ? tableHTML() : matchesHTML()}</div>
    <p class="d1-note">النتائج والترتيب فقط، ومنفصل عن إحصاءات الدوري الممتاز.</p>
  </div>`;
}
D1.render = render;
/* لصفحة المباريات (دائرة «دوري الدرجة الأولى» — منصور 2026-10-08) */
D1.matchesHTML = () => { if(!DATA) DATA = normalize(null); return matchesHTML(); };
D1.tableHTML = () => { if(!DATA) DATA = normalize(null); return tableHTML(); };
D1.count = () => { if(!DATA) DATA = normalize(null); return DATA.matches.length; };
function repaint(){ if(document.querySelector("#v-div1.on")) render(); paintAdmin(); }
document.addEventListener("click", e=>{
  const t = e.target.closest && e.target.closest("[data-d1tab]"); if(!t) return;
  VIEW.tab = t.dataset.d1tab; render();
});

/* ───────────── الإدارة ───────────── */
let ED = null;   /* {matches, dirty} نسخة التحرير */
const canEdit = () => TEST || (typeof isAdmin!=="undefined" && !!isAdmin);
const teamOpts = sel => Object.keys(TEAMS).map(c=>`<option${c===sel?" selected":""}>${H(c)}</option>`).join("");
function adminHTML(){
  if(!ED) ED = {matches:clone((DATA||normalize(null)).matches), dirty:false};
  const rs = [...new Set(ED.matches.map(m=>m.round))].sort((a,b)=>a-b);
  const row = m => `<div class="d1a-row" data-id="${H(m.id)}">
      <span class="t h">${H(m.home)}</span>
      <input class="sc" type="number" inputmode="numeric" min="0" max="30" data-d1f="hg" value="${m.hg==null?"":m.hg}" aria-label="أهداف ${H(m.home)}">
      <span class="x">-</span>
      <input class="sc" type="number" inputmode="numeric" min="0" max="30" data-d1f="ag" value="${m.ag==null?"":m.ag}" aria-label="أهداف ${H(m.away)}">
      <span class="t a">${H(m.away)}</span>
      <div class="meta">
        <input type="date" data-d1f="date" value="${H(m.date)}" aria-label="التاريخ">
        <input type="time" data-d1f="time" value="${H(m.time)}" aria-label="الوقت">
        <input type="text" data-d1f="venue" value="${H(m.venue)}" placeholder="الملعب" aria-label="الملعب">
        <button type="button" class="dl" data-d1a="rm">حذف</button>
      </div>
    </div>`;
  return `<div id="div1Admin"><h2 class="sec">دوري الدرجة الأولى</h2>
    <p class="hint">النتيجة فقط: اكتب أهداف كل فريق ثم «حفظ». اترك الخانتين فاضيتين للمباراة اللي ما انلعبت. لا أهداف ولا بطاقات ولا إحصاءات — الترتيب يُحسب تلقائياً.</p>
    <div class="card pad d1a">
      ${rs.map(r=>`<details class="rndbox" ${r===rs[rs.length-1]||ED.matches.some(m=>m.round===r && !played(m)) ? "open" : ""}><summary><b>الجولة ${r}</b><span class="rc">${ED.matches.filter(m=>m.round===r).length} مباريات</span></summary>
        <div class="d1a-list">${ED.matches.filter(m=>m.round===r).map(row).join("")}</div></details>`).join("")}
      <div class="d1a-add"><h4>إضافة مباراة</h4>
        <div class="d1a-addf">
          <label>الجولة<input type="number" min="1" max="40" id="d1nR" value="${(rs[rs.length-1]||0)+1}"></label>
          <label>المضيف<select id="d1nH">${teamOpts("")}</select></label>
          <label>الضيف<select id="d1nA">${teamOpts(Object.keys(TEAMS)[1])}</select></label>
          <label>التاريخ<input type="date" id="d1nD"></label>
          <label>الوقت<input type="time" id="d1nT"></label>
          <label>الملعب<input type="text" id="d1nV" placeholder="استاد…"></label>
        </div>
        <button type="button" class="btn" data-d1a="add">+ إضافة</button>
      </div>
      <div class="d1a-save"><button type="button" class="btn" data-d1a="save"${ED.dirty?"":" disabled"}>حفظ</button><span>${ED.dirty ? "تعديلات غير محفوظة" : "كل شيء محفوظ"}</span></div>
    </div></div>`;
}
function paintAdmin(){
  const box = document.getElementById("div1Admin"); if(!box) return;
  if(ED && !ED.dirty) ED = null;   /* لا تعديلات معلّقة: نعيد القراءة من أحدث بيانات */
  const t = document.createElement("div"); t.innerHTML = adminHTML(); box.replaceWith(t.firstElementChild);
}
function setDirty(){ if(!ED) return; ED.dirty = true; const s = document.querySelector("#div1Admin .d1a-save"); if(s){ s.querySelector("button").disabled = false; s.querySelector("span").textContent = "تعديلات غير محفوظة"; } }
document.addEventListener("input", e=>{
  const f = e.target.closest && e.target.closest("#div1Admin [data-d1f]"); if(!f || !ED) return;
  const id = f.closest("[data-id]").dataset.id, m = ED.matches.find(x=>x.id===id); if(!m) return;
  const k = f.dataset.d1f; m[k] = (k==="hg" || k==="ag") ? num(f.value) : f.value.trim(); setDirty();
});
document.addEventListener("click", async e=>{
  const b = e.target.closest && e.target.closest("#div1Admin [data-d1a]"); if(!b || !ED) return;
  const a = b.dataset.d1a;
  if(a==="rm"){ const id = b.closest("[data-id]").dataset.id, m = ED.matches.find(x=>x.id===id);
    if(!m || !confirm(`حذف ${m.home} × ${m.away}؟`)) return;
    ED.matches = ED.matches.filter(x=>x.id!==id); ED.dirty = true; paintAdminKeep(); return; }
  if(a==="add"){
    const g = id => document.getElementById(id);
    const home = g("d1nH").value, away = g("d1nA").value, round = +g("d1nR").value || 1;
    if(home===away){ say("اختر فريقين مختلفين", "err"); return; }
    if(ED.matches.some(x=>x.round===round && (x.home===home || x.away===home || x.home===away || x.away===away))){ say("أحد الفريقين له مباراة في نفس الجولة", "err"); return; }
    ED.matches.push({id:uid(), round, home, away, date:g("d1nD").value, time:g("d1nT").value, venue:g("d1nV").value.trim(), hg:null, ag:null});
    ED.dirty = true; paintAdminKeep(); return; }
  if(a==="save"){
    const bad = ED.matches.find(m=>(m.hg==null) !== (m.ag==null));
    if(bad){ say(`أكمل نتيجة ${bad.home} × ${bad.away} (الخانتين) أو اتركهما فاضيتين`, "err"); return; }
    b.disabled = true;
    try{ const next = normalize({matches:ED.matches}); await store.save(next); DATA = next; ED = null; say("حُفظ دوري الدرجة الأولى", "ok"); }
    catch(x){ console.error(x); say("تعذّر الحفظ: "+(x.code||x.message), "err"); b.disabled = false; return; }
    repaint(); }
});
function paintAdminKeep(){ const box = document.getElementById("div1Admin"); if(!box) return; const t = document.createElement("div"); t.innerHTML = adminHTML(); box.replaceWith(t.firstElementChild); }
function injectAdmin(){
  const v = document.getElementById("v-admin"); if(!v || document.getElementById("div1Admin") || !canEdit()) return;
  if(!document.getElementById("matchAdmin")) return;
  const w = document.createElement("div"); w.innerHTML = adminHTML(); v.appendChild(w.firstElementChild);
}

/* ───────────── ربط الموقع ───────────── */
function hookSite(){
  const nav = document.querySelector("nav.tabs");
  if(nav && !nav.querySelector('[data-v="div1"]')){
    const b = document.createElement("button"); b.setAttribute("role","tab"); b.dataset.v = "div1"; b.setAttribute("aria-selected","false");
    b.innerHTML = `<svg class="ic" aria-hidden="true" width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg><span>الدرجة الأولى</span>`;
    const g = nav.querySelector('[data-v="gulf"]') || nav.querySelector('[data-v="analysis"]');
    if(g) g.after(b); else nav.appendChild(b);
    b.addEventListener("click", ()=>{ if(typeof go==="function") go("div1"); });
  }
  if(!document.getElementById("v-div1")){ const s = document.createElement("section"); s.className = "view"; s.id = "v-div1";
    const a = document.getElementById("v-gulf") || document.getElementById("v-analysis"); (a?a.parentNode:document.querySelector("main")||document.body).insertBefore(s, a?a.nextSibling:null); }
  if(typeof RENDER==="object" && RENDER) RENDER.div1 = render;
}
function hookAdmin(){
  ["renderAdmin","renderEditorAdmin"].forEach(n=>{ const f = window[n]; if(typeof f!=="function" || f.__div1adm) return;
    const w = function(){ const r = f.apply(this, arguments);
      try{ injectAdmin(); if(window.ADMIN_TABS){ const v = document.getElementById("v-admin"); if(v && v.querySelector(".adm-tabs")){ v.querySelector(".adm-tabs").remove(); v.querySelectorAll(".adm-panel").forEach(p=>{ while(p.firstChild) v.insertBefore(p.firstChild, p); p.remove(); }); ADMIN_TABS.organize(); } } }catch(e){ console.error(e); }
      return r; };
    w.__div1adm = true; Object.keys(f).forEach(k=>{ try{ w[k] = f[k]; }catch(e){} });
    try{ window[n] = w; }catch(e){} try{ if(n==="renderAdmin") renderAdmin = w; else renderEditorAdmin = w; }catch(e){}
  });
  if(typeof RENDER==="object" && RENDER) RENDER.admin = window.renderAdmin;
}
function boot(){
  if(!DATA) DATA = normalize(null);
  hookSite(); hookAdmin();
  store.watch(d=>{ DATA = normalize(d); repaint(); });
}
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", ()=>setTimeout(boot, 0)); else setTimeout(boot, 0);
})();
