/* =====================================================================
   تبويبات لوحة الإدارة (منصور 2026-09-21)
   إعادة تنظيم فقط: لا تُنشئ أقساماً ولا تغيّر بياناتها. بعد أن ترسم renderAdmin
   (أو renderEditorAdmin) أقسامها المعتادة، تُنقل العناصر نفسها — بمستمعاتها —
   إلى تبويبات حسب عنوان كل قسم. قسم عنوانه غير معروف يذهب لتبويب «أخرى»
   فلا يختفي شيء أبداً.
   ===================================================================== */
(function(){
"use strict";
const TABS = [
  ["matches", "المباريات"],
  ["gulf",    "كأس الخليج"],
  ["refs",    "الحكام"],
  ["squads",  "الكشوفات"],
  ["fans",    "الجمهور"],
  ["fantasy", "الفانتسي"],
  ["events",  "المناسبات"],
  ["brand",   "الهوية والصور"],
  ["data",    "البيانات"],
  ["account", "الحساب"],
  ["other",   "أخرى"]
];
/* عنوان القسم ← التبويب (مطابقة بداية النص) */
const MAP = [
  ["كأس الخليج","gulf"],
  ["إدارة المباريات","matches"], ["المباريات المسجّلة","matches"],
  ["الحكام","refs"], ["طواقم المباريات","refs"],
  ["كشوفات اللاعبين","squads"], ["ألوان القمصان","squads"],
  ["تشكيلة الجمهور","fans"], ["تحدي التوقعات","fans"], ["مشتركو التوقعات","fans"],
  ["لعبة الفانتسي","fantasy"],
  ["المناسبات وفترات التوقف","events"],
  ["شعارات الأندية","brand"], ["صور الهدافين","brand"], ["ضبط تأطير الوجوه","brand"], ["شعار الدوري","brand"],
  ["شعار العلامة","brand"], ["تنسيق حجم الشعارات","brand"], ["ضبط دقيق لكل نادٍ","brand"],
  ["بيانات الموسم","data"], ["النسخ الاحتياطية","data"], ["المزامنة السحابية","data"], ["حالة الحفظ","data"],
  ["فريق العمل","account"], ["الزيارات","account"], ["إعدادات الموسم","account"]
];
const tabOfTitle = t => { t = String(t||"").trim(); const hit = MAP.find(([p])=>t.startsWith(p)); return hit ? hit[1] : "other"; };
let CUR = (()=>{ try{ return localStorage.getItem("mf-admtab") || "matches"; }catch(e){ return "matches"; } })();
const save = v => { try{ localStorage.setItem("mf-admtab", v); }catch(e){} };

function organize(){
  const v = document.getElementById("v-admin"); if(!v) return;
  if(v.querySelector(":scope > .adm-tabs")) return;               /* نُظّمت مسبقاً */
  if(!v.querySelector("h2.sec") || v.querySelector("#loginBtn")) return;   /* شاشة الدخول: بلا تبويبات */
  const kids = [...v.children];
  const head = [], groups = {};
  let cur = null;
  kids.forEach(el=>{
    let t = null;
    if(el.id === "lvAdminCard") t = "matches";
    else if(el.matches("h2.sec")) t = tabOfTitle(el.textContent);
    else { const h = el.querySelector(":scope > h2.sec"); if(h) t = tabOfTitle(h.textContent); }
    if(t) cur = t;
    if(!cur){ head.push(el); return; }
    (groups[t || cur] ||= []).push(el);
  });
  const present = TABS.filter(([k])=>groups[k] && groups[k].length);
  if(present.length < 2) return;
  if(!present.some(([k])=>k===CUR)) CUR = present[0][0];
  const bar = document.createElement("nav"); bar.className = "adm-tabs"; bar.setAttribute("role","tablist");
  bar.innerHTML = present.map(([k,t])=>`<button type="button" role="tab" data-admtab="${k}" aria-selected="${k===CUR}">${t}</button>`).join("");
  const frag = document.createDocumentFragment();
  head.forEach(el=>frag.appendChild(el));
  frag.appendChild(bar);
  present.forEach(([k])=>{ const p = document.createElement("section"); p.className = "adm-panel"; p.dataset.admpanel = k; p.hidden = k!==CUR;
    groups[k].forEach(el=>p.appendChild(el)); frag.appendChild(p); });
  v.appendChild(frag);
  bar.addEventListener("click", e=>{ const b = e.target.closest("[data-admtab]"); if(!b) return; CUR = b.dataset.admtab; save(CUR);
    bar.querySelectorAll("[data-admtab]").forEach(x=>x.setAttribute("aria-selected", x===b));
    v.querySelectorAll(".adm-panel").forEach(p=>p.hidden = p.dataset.admpanel!==CUR);
    b.scrollIntoView({block:"nearest", inline:"center", behavior:"smooth"});
    window.scrollTo({top: v.getBoundingClientRect().top + scrollY - 70, behavior:"smooth"}); });
  const on = bar.querySelector('[aria-selected="true"]'); if(on) requestAnimationFrame(()=>on.scrollIntoView({block:"nearest", inline:"center"}));
}
window.ADMIN_TABS = {organize, open:k=>{ CUR=k; save(k); const b=document.querySelector(`[data-admtab="${k}"]`); if(b) b.click(); }};

function hook(){
  ["renderAdmin","renderEditorAdmin"].forEach(n=>{
    const f = window[n]; if(typeof f!=="function" || f.__tabs) return;
    const w = function(){ const r = f.apply(this, arguments); try{ organize(); }catch(e){ console.error(e); } return r; };
    w.__tabs = true; w.__lv = f.__lv;
    try{ window[n] = w; }catch(e){}
    try{ if(n==="renderAdmin") renderAdmin = w; else renderEditorAdmin = w; }catch(e){}
  });
  if(typeof RENDER==="object" && RENDER) RENDER.admin = window.renderAdmin;
  if(document.querySelector("#v-admin.on")) organize();
}
/* بعد ربط live.js لنفس الدوال (setTimeout 0) */
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", ()=>setTimeout(hook, 30)); else setTimeout(hook, 30);
})();
