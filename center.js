/* =====================================================================
   مركز التحليل الافتراضي (/center) — 2026-11-10
   لفريق العمل فقط. كل مكتب مربوط بإيميل صاحبه (center/config.emails)،
   وحالته من presence/<uid> التي يكتبها presence.js في الموقع:
     متصل · إدارة الرصد  ← لوحة الإدارة مفتوحة عنده
     متصل · اللعب الفعلي ← ساعة الوقت الفعلي مفتوحة عنده
     غير متصل            ← خارجهما، أو لم تصل نبضته خلال 150 ثانية
   المالك وحده يعدّل ربط المكاتب بالإيميلات (زر «ربط المكاتب بالإيميلات»).
   ===================================================================== */
(function(){
"use strict";
const FB_CONFIG = {
  apiKey: "AIzaSyD_ZzAE4HEKPIuAKCmta8tzN5KOa8IUfuo",
  authDomain: "mfsoccer.com",
  projectId: "mfsoccer-c7ee4",
  storageBucket: "mfsoccer-c7ee4.firebasestorage.app",
  messagingSenderId: "574478199897",
  appId: "1:574478199897:web:dbd2b7dae6384503ea9548"
};
const OWNER_UID = "iiTgVfDryXNLb9IrOyLkkNMHDxq2";
const FRESH = 150e3;   /* نبضة أقدم من هذا = غير متصل */
const G = "#D4A84B";
const ZONES = {
  mon:  {title:"قسم الرصد",        color:"#3FB8AF", icon:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'},
  play: {title:"قسم اللعب الفعلي", color:"#6CC24A", icon:'<circle cx="12" cy="12" r="9"/><path d="M10 8.5l5 3.5-5 3.5z"/>'},
  dev:  {title:"قسم التطوير",      color:"#5B9BF0", icon:'<path d="M8 7l-5 5 5 5"/><path d="M16 7l5 5-5 5"/><path d="M13.5 5l-3 14"/>'}
};
const DESKS = [
  {id:"mf",      name:"محمد الفيلكاوي", role:"المشرف العام",       zone:"sup", img:"mf"},
  {id:"saad",    name:"سعد المنصور",    role:"مشرف الرصد",         zone:"mon",  lead:1, shirt:"#2F5D58", kind:"data"},
  {id:"hussain", name:"حسين التميمي",   role:"الرصد",              zone:"mon",  shirt:"#3D4F66", kind:"data"},
  {id:"ahmed",   name:"أحمد المشموم",   role:"الرصد والديسكورد",   zone:"mon",  shirt:"#4B3F6B", kind:"discord"},
  {id:"rakan",   name:"راكان حواري",    role:"الرصد",              zone:"mon",  shirt:"#5A4636", kind:"data"},
  {id:"yaqoub",  name:"يعقوب القيس",    role:"الرصد",              zone:"mon",  shirt:"#2C4A6E", kind:"data"},
  {id:"yousef",  name:"يوسف الأنصاري",  role:"مشرف اللعب الفعلي",  zone:"play", lead:1, shirt:"#3E5A2E", kind:"pitch"},
  {id:"jassim",  name:"جاسم الخليفة",   role:"اللعب الفعلي",       zone:"play", shirt:"#4A5B70", kind:"pitch"},
  {id:"mansour", name:"منصور الجمعة",   role:"مشرف قسم التطوير",   zone:"dev",  lead:1, shirt:"#2B4778", kind:"code"}
];
/* img: صورة ثلاثية الأبعاد للعضو — ملفان assets/team/<img>-on.webp و <img>-off.webp
   (متصل / غير متصل). العضو بلا صورة يظهر بالرسم المسطح حتى تُضاف صورته. */
const DEFAULT_EMAILS = {mf:"coachmf.kw@gmail.com"};
const SEC_AR = {mon:"متصل · إدارة الرصد", play:"متصل · اللعب الفعلي"};
const esc = s => String(s==null?"":s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const $ = s => document.querySelector(s);
const SCR = {
  dataL: (c) => `<rect x="37" y="11" width="78" height="48" fill="#0A1726"></rect><rect x="41" y="15" width="28" height="3" rx="1.5" fill="#4A5E78"></rect><rect x="41" y="22" width="12" height="4" rx="2" fill="#2C3E56"></rect><rect x="56" y="22" width="50" height="4" rx="2" fill="${c}"></rect><rect x="41" y="29" width="12" height="4" rx="2" fill="#2C3E56"></rect><rect x="56" y="29" width="36" height="4" rx="2" fill="${c}"></rect><rect x="41" y="36" width="12" height="4" rx="2" fill="#2C3E56"></rect><rect x="56" y="36" width="54" height="4" rx="2" fill="${c}"></rect><rect x="41" y="43" width="12" height="4" rx="2" fill="#2C3E56"></rect><rect x="56" y="43" width="28" height="4" rx="2" fill="${c}"></rect><rect x="41" y="50" width="12" height="4" rx="2" fill="#2C3E56"></rect><rect x="56" y="50" width="42" height="4" rx="2" fill="${c}"></rect>`,
  pitchL: (c) => `<rect x="37" y="11" width="78" height="48" fill="#0E3A25"></rect><rect x="40" y="14" width="72" height="42" fill="none" stroke="#4C9B6A" stroke-width="1"></rect><line x1="76" y1="14" x2="76" y2="56" stroke="#4C9B6A" stroke-width="1"></line><circle cx="76" cy="35" r="7" fill="none" stroke="#4C9B6A" stroke-width="1"></circle><rect x="40" y="26" width="10" height="18" fill="none" stroke="#4C9B6A" stroke-width="1"></rect><rect x="102" y="26" width="10" height="18" fill="none" stroke="#4C9B6A" stroke-width="1"></rect><circle cx="52" cy="22" r="2.2" fill="${G}"></circle><circle cx="56" cy="35" r="2.2" fill="${G}"></circle><circle cx="52" cy="48" r="2.2" fill="${G}"></circle><circle cx="66" cy="28" r="2.2" fill="${G}"></circle><circle cx="66" cy="42" r="2.2" fill="${G}"></circle><circle cx="88" cy="24" r="2.2" fill="#F2EDE3"></circle><circle cx="92" cy="35" r="2.2" fill="#F2EDE3"></circle><circle cx="88" cy="46" r="2.2" fill="#F2EDE3"></circle><circle cx="100" cy="35" r="2.2" fill="#F2EDE3"></circle><circle cx="83" cy="31" r="2.2" fill="#F2EDE3"></circle><polyline points="66,28 75,23 84,20" fill="none" stroke="${G}" stroke-width="1.2" stroke-dasharray="2 2"></polyline>`,
  codeL: (c) => `<rect x="37" y="11" width="78" height="48" fill="#0A1426"></rect><rect x="41" y="16" width="22" height="3" rx="1.5" fill="#B48EF0"></rect><rect x="66" y="16" width="24" height="3" rx="1.5" fill="#5B9BF0"></rect><rect x="47" y="22" width="30" height="3" rx="1.5" fill="#9AA7B8"></rect><rect x="47" y="28" width="18" height="3" rx="1.5" fill="#6CC24A"></rect><rect x="68" y="28" width="26" height="3" rx="1.5" fill="#5B9BF0"></rect><rect x="53" y="34" width="34" height="3" rx="1.5" fill="#9AA7B8"></rect><rect x="53" y="40" width="22" height="3" rx="1.5" fill="#D4A84B"></rect><rect x="47" y="46" width="28" height="3" rx="1.5" fill="#9AA7B8"></rect><rect x="41" y="52" width="12" height="3" rx="1.5" fill="#B48EF0"></rect>`,
  chartR: (c) => `<rect x="125" y="11" width="78" height="48" fill="#0A1726"></rect><line x1="129" y1="24" x2="199" y2="24" stroke="#1F3047" stroke-width="1"></line><line x1="129" y1="36" x2="199" y2="36" stroke="#1F3047" stroke-width="1"></line><line x1="129" y1="48" x2="199" y2="48" stroke="#1F3047" stroke-width="1"></line><polyline points="129,52 140,44 151,47 162,34 173,38 184,26 199,21" fill="none" stroke="${G}" stroke-width="1.6"></polyline><polyline points="129,56 140,52 151,50 162,48 173,42 184,44 199,36" fill="none" stroke="${c}" stroke-width="1.6"></polyline>`,
  chatR: (c) => `<rect x="125" y="11" width="78" height="48" fill="#121A2C"></rect><rect x="125" y="11" width="13" height="48" fill="#0C1322"></rect><circle cx="131.5" cy="18" r="3.5" fill="#7C83F0"></circle><circle cx="131.5" cy="27" r="3.5" fill="#3FB8AF"></circle><circle cx="131.5" cy="36" r="3.5" fill="#D4A84B"></circle><circle cx="144" cy="18" r="3" fill="#6CC24A"></circle><rect x="150" y="15" width="36" height="3" rx="1.5" fill="#9AA7B8"></rect><rect x="150" y="20" width="24" height="2.5" rx="1.25" fill="#3A4E68"></rect><circle cx="144" cy="31" r="3" fill="#D4A84B"></circle><rect x="150" y="28" width="44" height="3" rx="1.5" fill="#9AA7B8"></rect><rect x="150" y="33" width="30" height="2.5" rx="1.25" fill="#3A4E68"></rect><circle cx="144" cy="44" r="3" fill="#7C83F0"></circle><rect x="150" y="41" width="28" height="3" rx="1.5" fill="#9AA7B8"></rect><rect x="150" y="46" width="40" height="2.5" rx="1.25" fill="#3A4E68"></rect><rect x="141" y="52" width="58" height="4" rx="2" fill="#1F2A40"></rect>`,
  pitchR: (c) => `<rect x="125" y="11" width="78" height="48" fill="#0E3A25"></rect><rect x="128" y="14" width="72" height="42" fill="none" stroke="#4C9B6A" stroke-width="1"></rect><line x1="164" y1="14" x2="164" y2="56" stroke="#4C9B6A" stroke-width="1"></line><circle cx="164" cy="35" r="7" fill="none" stroke="#4C9B6A" stroke-width="1"></circle><rect x="128" y="26" width="10" height="18" fill="none" stroke="#4C9B6A" stroke-width="1"></rect><rect x="190" y="26" width="10" height="18" fill="none" stroke="#4C9B6A" stroke-width="1"></rect><circle cx="140" cy="22" r="2.2" fill="${G}"></circle><circle cx="144" cy="35" r="2.2" fill="${G}"></circle><circle cx="140" cy="48" r="2.2" fill="${G}"></circle><circle cx="154" cy="28" r="2.2" fill="${G}"></circle><circle cx="154" cy="42" r="2.2" fill="${G}"></circle><circle cx="176" cy="24" r="2.2" fill="#F2EDE3"></circle><circle cx="180" cy="35" r="2.2" fill="#F2EDE3"></circle><circle cx="176" cy="46" r="2.2" fill="#F2EDE3"></circle><circle cx="188" cy="35" r="2.2" fill="#F2EDE3"></circle><circle cx="171" cy="31" r="2.2" fill="#F2EDE3"></circle>`,
};
const EXEC_SCR = () => `<rect x="39" y="17" width="86" height="52" fill="#0A1726"></rect><rect x="44" y="22" width="34" height="3" rx="1.5" fill="#4A5E78"></rect><rect x="44" y="29" width="14" height="4" rx="2" fill="#2C3E56"></rect><rect x="62" y="29" width="54" height="4" rx="2" fill="${G}"></rect><rect x="44" y="36" width="14" height="4" rx="2" fill="#2C3E56"></rect><rect x="62" y="36" width="40" height="4" rx="2" fill="${G}"></rect><rect x="44" y="43" width="14" height="4" rx="2" fill="#2C3E56"></rect><rect x="62" y="43" width="58" height="4" rx="2" fill="${G}"></rect><rect x="44" y="50" width="14" height="4" rx="2" fill="#2C3E56"></rect><rect x="62" y="50" width="30" height="4" rx="2" fill="${G}"></rect><rect x="44" y="57" width="14" height="4" rx="2" fill="#2C3E56"></rect><rect x="62" y="57" width="46" height="4" rx="2" fill="${G}"></rect><rect x="137" y="7" width="86" height="56" fill="#0E3A25"></rect><rect x="141" y="11" width="78" height="48" fill="none" stroke="#4C9B6A" stroke-width="1"></rect><line x1="180" y1="11" x2="180" y2="59" stroke="#4C9B6A" stroke-width="1"></line><circle cx="180" cy="35" r="8" fill="none" stroke="#4C9B6A" stroke-width="1"></circle><rect x="141" y="25" width="11" height="20" fill="none" stroke="#4C9B6A" stroke-width="1"></rect><rect x="208" y="25" width="11" height="20" fill="none" stroke="#4C9B6A" stroke-width="1"></rect><circle cx="154" cy="19" r="2.4" fill="${G}"></circle><circle cx="158" cy="35" r="2.4" fill="${G}"></circle><circle cx="154" cy="51" r="2.4" fill="${G}"></circle><circle cx="168" cy="26" r="2.4" fill="${G}"></circle><circle cx="168" cy="44" r="2.4" fill="${G}"></circle><circle cx="174" cy="35" r="2.4" fill="${G}"></circle><circle cx="192" cy="22" r="2.4" fill="#F2EDE3"></circle><circle cx="196" cy="35" r="2.4" fill="#F2EDE3"></circle><circle cx="192" cy="48" r="2.4" fill="#F2EDE3"></circle><circle cx="207" cy="35" r="2.4" fill="#F2EDE3"></circle><circle cx="187" cy="30" r="2.4" fill="#F2EDE3"></circle><polyline points="168,26 178,20 188,17" fill="none" stroke="${G}" stroke-width="1.2" stroke-dasharray="2 2"></polyline><rect x="235" y="17" width="86" height="52" fill="#0A1726"></rect><line x1="239" y1="30" x2="317" y2="30" stroke="#1F3047" stroke-width="1"></line><line x1="239" y1="42" x2="317" y2="42" stroke="#1F3047" stroke-width="1"></line><line x1="239" y1="54" x2="317" y2="54" stroke="#1F3047" stroke-width="1"></line><polyline points="239,62 252,52 265,55 278,40 291,44 304,30 317,24" fill="none" stroke="${G}" stroke-width="1.8"></polyline><polyline points="239,66 252,62 265,60 278,56 291,50 304,52 317,42" fill="none" stroke="#3FB8AF" stroke-width="1.8"></polyline>`;

/* ───────────── الرسم ───────────── */
const SKIN = "#C68E5E", NECK = "#B07A4E", HAIR = "#1B1410", EDGE = "#2B3D55";
function deskSVG(d){
  const c = ZONES[d.zone].color, sh = d.shirt;
  const screens = {
    data:    SCR.dataL(c) + SCR.chartR(c),
    discord: SCR.dataL(c) + SCR.chatR(c),
    pitch:   SCR.pitchL(c) + SCR.chartR(c),
    code:    SCR.codeL(c) + SCR.pitchR(c)
  }[d.kind];
  return `<svg viewBox="0 0 240 180" role="img" aria-label="محطة عمل ${esc(d.name)}">
    <rect x="34" y="8" width="84" height="54" rx="4" fill="#06101B" stroke="${EDGE}" stroke-width="2"/>
    <rect x="122" y="8" width="84" height="54" rx="4" fill="#06101B" stroke="${EDGE}" stroke-width="2"/>
    <rect x="72" y="62" width="8" height="12" fill="${EDGE}"/><rect x="160" y="62" width="8" height="12" fill="${EDGE}"/>
    <rect x="62" y="72" width="28" height="4" rx="2" fill="${EDGE}"/><rect x="150" y="72" width="28" height="4" rx="2" fill="${EDGE}"/>
    <circle class="lampglow" cx="22" cy="68" r="14"/>
    <path class="lamp" d="M14 74 a8 8 0 0 1 16 0 Z"/>
    <rect x="12" y="72" width="20" height="4" rx="1.5" fill="${G}"/>
    <rect x="8" y="76" width="224" height="10" rx="3" fill="#2A3B52"/>
    <rect x="8" y="86" width="224" height="5" rx="1" fill="#1A2738"/>
    <rect x="113" y="110" width="14" height="10" fill="${NECK}"/>
    <ellipse cx="105.5" cy="102" rx="2.5" ry="4.5" fill="${SKIN}"/><ellipse cx="134.5" cy="102" rx="2.5" ry="4.5" fill="${SKIN}"/>
    <circle cx="120" cy="100" r="15" fill="${HAIR}"/>
    <path d="M84 168 C84 138 99 120 120 120 C141 120 156 138 156 168 Z" fill="${sh}"/>
    <path d="M91 140 C83 122 88 104 97 95" fill="none" stroke="${sh}" stroke-width="10" stroke-linecap="round"/>
    <path d="M149 140 C157 122 152 104 143 95" fill="none" stroke="${sh}" stroke-width="10" stroke-linecap="round"/>
    <circle cx="97" cy="93" r="4" fill="${SKIN}"/><circle cx="143" cy="93" r="4" fill="${SKIN}"/>
    <rect x="90" y="134" width="60" height="38" rx="12" fill="#18222F" stroke="${EDGE}" stroke-width="1.5"/>
    <rect x="117" y="172" width="6" height="4" fill="${EDGE}"/>
    <line x1="100" y1="177" x2="140" y2="177" stroke="${EDGE}" stroke-width="3" stroke-linecap="round"/>
  </svg>
  <svg class="scr" viewBox="0 0 240 180" aria-hidden="true">${screens}</svg>`;
}
function execSVG(){
  const W = "#ECE8DF";
  return `<svg viewBox="0 0 360 200" role="img" aria-label="مكتب المشرف العام">
    <rect x="36" y="14" width="92" height="58" rx="4" fill="#06101B" stroke="${EDGE}" stroke-width="2"/>
    <rect x="134" y="4" width="92" height="62" rx="4" fill="#06101B" stroke="${EDGE}" stroke-width="2"/>
    <rect x="232" y="14" width="92" height="58" rx="4" fill="#06101B" stroke="${EDGE}" stroke-width="2"/>
    <rect x="78" y="72" width="8" height="12" fill="${EDGE}"/><rect x="176" y="66" width="8" height="18" fill="${EDGE}"/><rect x="274" y="72" width="8" height="12" fill="${EDGE}"/>
    <rect x="66" y="80" width="32" height="4" rx="2" fill="${EDGE}"/><rect x="164" y="80" width="32" height="4" rx="2" fill="${EDGE}"/><rect x="262" y="80" width="32" height="4" rx="2" fill="${EDGE}"/>
    <circle class="lampglow" cx="24" cy="74" r="16"/>
    <path class="lamp" d="M15 80 a9 9 0 0 1 18 0 Z"/>
    <rect x="13" y="79" width="22" height="5" rx="1.5" fill="${G}"/>
    <rect x="8" y="84" width="344" height="12" rx="4" fill="#3A2C1E"/>
    <rect x="8" y="96" width="344" height="4" rx="1" fill="${G}"/>
    <rect x="172" y="122" width="16" height="12" fill="${NECK}"/>
    <ellipse cx="163" cy="114" rx="3" ry="5" fill="${SKIN}"/><ellipse cx="197" cy="114" rx="3" ry="5" fill="${SKIN}"/>
    <circle cx="180" cy="112" r="17" fill="${HAIR}"/>
    <path d="M138 190 C138 156 155 134 180 134 C205 134 222 156 222 190 Z" fill="${W}"/>
    <path d="M146 154 C136 134 142 112 152 101" fill="none" stroke="${W}" stroke-width="12" stroke-linecap="round"/>
    <path d="M214 154 C224 134 218 112 208 101" fill="none" stroke="${W}" stroke-width="12" stroke-linecap="round"/>
    <circle cx="152" cy="99" r="5" fill="${SKIN}"/><circle cx="208" cy="99" r="5" fill="${SKIN}"/>
    <rect x="146" y="150" width="68" height="42" rx="14" fill="#1A120C" stroke="${G}" stroke-width="1.5"/>
    <rect x="177" y="192" width="6" height="4" fill="${EDGE}"/>
    <line x1="152" y1="198" x2="208" y2="198" stroke="${EDGE}" stroke-width="3" stroke-linecap="round"/>
  </svg>
  <svg class="scr" viewBox="0 0 360 200" aria-hidden="true">${EXEC_SCR()}</svg>`;
}
const pillHTML = id => `<div class="pill" id="p-${id}" role="status" aria-live="polite"><span class="dot"></span><span class="tx"><b>غير متصل</b><small>OFFLINE</small></span></div>`;
const mailHTML = id => EDIT ? `<div class="mail"><label for="m-${id}">إيميل صاحب المكتب</label><input id="m-${id}" type="email" list="staffMails" value="${esc(EMAILS[id]||"")}" placeholder="name@example.com"></div>` : "";
const icon = (z) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${ZONES[z].color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ZONES[z].icon}</svg>`;
const countAr = n => n===1 ? "عضو واحد" : n===2 ? "عضوان" : `${n} أعضاء`;

const photoHTML = d => `<div class="photo">
    <img class="ph-off" src="/assets/team/${esc(d.img)}-off.webp" alt="${esc(d.name)} — ${esc(d.role)}" loading="lazy">
    <img class="ph-on" src="/assets/team/${esc(d.img)}-on.webp" alt="" aria-hidden="true" loading="lazy">
  </div>`;
function deskHTML(d){
  if(d.img) return `<article class="desk${d.lead?" lead":""}" id="d-${d.id}" style="--zc:${ZONES[d.zone].color}">
    ${pillHTML(d.id)}${photoHTML(d)}${mailHTML(d.id)}</article>`;
  return `<article class="desk${d.lead?" lead":""}" id="d-${d.id}" style="--zc:${ZONES[d.zone].color}">
    ${pillHTML(d.id)}
    <div class="station">${deskSVG(d)}</div>
    <div class="ring"></div>
    <div class="who"><b>${esc(d.name)}</b><span>${esc(d.role)}</span>${d.lead?'<span class="badge">مشرف القسم</span>':""}</div>
    ${mailHTML(d.id)}
  </article>`;
}
function zoneHTML(z){
  const ds = DESKS.filter(d=>d.zone===z);
  return `<section class="zone" style="--zc:${ZONES[z].color}" aria-label="${ZONES[z].title}">
    <div class="zhead"><div class="zt">${icon(z)}<span>${ZONES[z].title}</span></div><span class="zc">${countAr(ds.length)}</span></div>
    <div class="desks">${ds.map(deskHTML).join("")}</div>
  </section>`;
}
function render(){
  const sup = DESKS[0];
  $("#app").innerHTML = `
  <header class="top">
    <div class="brand">
      <img src="/assets/brand/mf-logo-gold.webp" alt="شعار MF Soccer" width="584" height="403">
      <div class="sep"></div>
      <div><h1>مركز التحليل الافتراضي</h1><p>غرفة العمليات · الإشراف والرصد واللعب الفعلي والتطوير</p></div>
    </div>
    <div style="display:flex;flex-direction:column;gap:12px;align-items:flex-end">
      <div class="stats">
        <div class="stat live"><b id="onCount">0</b><span>متصل الآن</span></div>
        <div class="stat"><b>${DESKS.length}</b><span>أعضاء الفريق</span></div>
        <div class="stat"><b>4</b><span>أقسام</span></div>
      </div>
      <div class="toolbar">
        ${IS_OWNER?`<button class="btn${EDIT?" gold":""}" id="editBtn" type="button">${EDIT?"حفظ الربط":"ربط المكاتب بالإيميلات"}</button>${EDIT?'<button class="btn" id="cancelBtn" type="button">إلغاء</button>':""}`:""}
        <a class="btn" href="/" style="text-decoration:none;display:inline-flex;align-items:center">الموقع</a>
        <button class="btn" id="logoutBtn" type="button">خروج</button>
      </div>
    </div>
  </header>
  <section class="zone sup" id="d-${sup.id}" aria-label="الإشراف العام">
    <div class="zhead"><div class="zt"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${G}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/></svg><span>الإشراف العام</span></div>${pillHTML(sup.id)}</div>
    ${sup.img ? photoHTML(sup) : `<div class="station">${execSVG()}</div>
    <div class="ring"></div>
    <div class="who"><b>${esc(sup.name)}</b><span>${esc(sup.role)}</span></div>`}
    ${mailHTML(sup.id)}
  </section>
  ${zoneHTML("mon")}
  <div class="row2">${zoneHTML("play")}${zoneHTML("dev")}</div>
  <div class="orph" id="orph" hidden></div>
  <div class="legend"><span><i style="background:#3DDC5A"></i>متصل: داخل الموقع في إدارة الرصد أو اللعب الفعلي</span><span><i style="background:#6B7A90"></i>غير متصل</span></div>
  <datalist id="staffMails">${STAFF_MAILS.map(m=>`<option value="${esc(m.email)}">${esc(m.name)}</option>`).join("")}</datalist>`;
  $("#logoutBtn").onclick = () => auth.signOut();
  if($("#editBtn")) $("#editBtn").onclick = () => EDIT ? saveEmails() : (EDIT = true, render());
  if($("#cancelBtn")) $("#cancelBtn").onclick = () => { EDIT = false; render(); };
  paint();
}

/* ───────────── الحالة ───────────── */
function statusOf(email){
  if(!email) return null;
  let best = null;
  Object.values(PRES).forEach(p=>{
    if(p.email !== email || !p.section || !p.at) return;
    if(Date.now() - p.at > FRESH) return;
    if(!best || p.at > best.at) best = p;
  });
  return best;
}
function paint(){
  if($("#app").hidden) return;
  let n = 0;
  const mapped = new Set();
  DESKS.forEach(d=>{
    const email = (EMAILS[d.id]||"").toLowerCase(); if(email) mapped.add(email);
    const st = statusOf(email), el = $("#d-"+d.id), pill = $("#p-"+d.id);
    if(!el || !pill) return;
    el.classList.toggle("on", !!st);
    if(st) n++;
    pill.querySelector("b").textContent = st ? SEC_AR[st.section] : "غير متصل";
    pill.querySelector("small").textContent = st ? "ONLINE" : "OFFLINE";
  });
  $("#onCount").textContent = n;
  /* متصل من فريق العمل وليس له مكتب: يظهر للمالك حتى يربطه */
  const orph = Object.values(PRES).filter(p=>p.section && p.at && Date.now()-p.at<=FRESH && p.email && !mapped.has(p.email));
  const box = $("#orph");
  if(box){
    box.hidden = !(IS_OWNER && orph.length);
    box.innerHTML = orph.length ? `<b>متصلون بدون مكتب:</b> ` + orph.map(p=>`${esc(p.name||"عضو")} <span dir="ltr">(${esc(p.email)})</span> — ${SEC_AR[p.section]}`).join(" · ") : "";
  }
}

async function saveEmails(){
  const next = {};
  DESKS.forEach(d=>{ const v = ($("#m-"+d.id)?.value||"").trim().toLowerCase(); if(v) next[d.id] = v; });
  const b = $("#editBtn"); b.disabled = true; b.textContent = "جارٍ الحفظ…";
  try{
    await db.collection("center").doc("config").set({emails:next, upd:firebase.firestore.FieldValue.serverTimestamp()});
    EMAILS = next; EDIT = false; render();
  }catch(e){ b.disabled = false; b.textContent = "تعذّر الحفظ — أعد المحاولة"; }
}

/* ───────────── الدخول والبيانات ───────────── */
let auth, db, IS_OWNER = false, EDIT = false;
let EMAILS = Object.assign({}, DEFAULT_EMAILS), PRES = {}, STAFF_MAILS = [];
let unsubs = [];

function gate(msg, signedIn){
  $("#app").hidden = true; $("#gate").hidden = false;
  $("#gateMsg").textContent = msg;
  ["#em","#pw"].forEach(s=>{ $(s).hidden = !!signedIn; $(s).previousElementSibling.hidden = !!signedIn; });
  $("#loginForm button[type=submit]").hidden = !!signedIn;
  $("#outBtn").hidden = !signedIn;
}
function stop(){ unsubs.forEach(u=>{ try{u();}catch(e){} }); unsubs = []; PRES = {}; }

async function start(u){
  stop();
  IS_OWNER = u.uid === OWNER_UID;
  let staffDoc = null;
  try{ staffDoc = (await db.collection("seasons").doc("staff").get()).data() || {}; }catch(e){}
  const members = (staffDoc && staffDoc.members) || {};
  const me = members[u.uid];
  const ok = IS_OWNER || (me && me.role === "editor" && me.active !== false);
  if(!ok) return gate("هذا الحساب ليس من فريق العمل — المركز لفريق العمل فقط.", true);
  STAFF_MAILS = Object.values(members).filter(m=>m && m.email).map(m=>({email:String(m.email).toLowerCase(), name:m.name||""}));
  $("#gate").hidden = true; $("#app").hidden = false;
  render();
  unsubs.push(db.collection("center").doc("config").onSnapshot(d=>{
    const e = (d.exists && d.data().emails) || {};
    EMAILS = Object.assign({}, DEFAULT_EMAILS, e);
    if(!EDIT) render();
  }, ()=>{}));
  unsubs.push(db.collection("presence").onSnapshot(qs=>{
    PRES = {};
    qs.forEach(doc=>{
      const x = doc.data() || {};
      PRES[doc.id] = {email:String(x.email||"").toLowerCase(), name:x.name||"", section:x.section||null,
                      at: x.at && x.at.toMillis ? x.at.toMillis() : 0};
    });
    paint();
  }, ()=>{}));
}

function boot(){
  if(typeof firebase === "undefined"){ gate("تعذّر تحميل الاتصال — تأكد من الإنترنت وحدّث الصفحة."); return; }
  firebase.initializeApp(FB_CONFIG);
  auth = firebase.auth(); db = firebase.firestore();
  try{ db.settings({experimentalAutoDetectLongPolling:true, merge:true}); }catch(e){}
  auth.onAuthStateChanged(u=>{ if(u) start(u); else { stop(); gate("لفريق العمل فقط — سجّل دخولك بحساب فريق العمل."); } });
  $("#loginForm").addEventListener("submit", async ev=>{
    ev.preventDefault(); $("#err").textContent = "";
    try{ await auth.signInWithEmailAndPassword($("#em").value.trim(), $("#pw").value); }
    catch(e){ $("#err").textContent = "البريد أو كلمة المرور غير صحيحة."; }
  });
  $("#outBtn").onclick = () => auth.signOut();
  setInterval(paint, 15e3);   /* من انقطعت نبضته ينطفئ مكتبه بلا انتظار تحديث */
}
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", boot) : boot();
})();
