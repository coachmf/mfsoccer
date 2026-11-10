/* =====================================================================
   مركز التحليل الافتراضي (/center) — 2026-11-10
   لفريق العمل فقط. الصفحة صورة الغرفة المعتمدة (assets/brand/center-room.webp)
   وفوق كل مكتب منطقة شفافة تتبع حالة صاحبه:
     متصل · إدارة الرصد  ← لوحة الإدارة مفتوحة عنده
     متصل · اللعب الفعلي ← ساعة الوقت الفعلي مفتوحة عنده
     غير متصل            ← خارجهما، أو لم تصل نبضته خلال 150 ثانية
   غير المتصل يُطفأ مكتبه (رمادي معتم)، والمتصل يضيء بإطار أخضر.
   كل مكتب مربوط بإيميل صاحبه (center/config.emails)، والحالة من presence/<uid>
   التي يكتبها presence.js في الموقع. المالك وحده يعدّل الربط.
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

/* مواقع المكاتب على الصورة (1536×1024 بكسل): b = [يسار, أعلى, يمين, أسفل]
   مكتب المشرف: كبسولة الحالة فوق كبسولة «ONLINE» المرسومة على الشاشة (pill). */
const IMG_W = 1536, IMG_H = 1024;
const DESKS = [
  {id:"mf",      name:"محمد الفيلكاوي", role:"المشرف العام",       b:[545,115,990,418], pill:[797,128,922,168]},
  {id:"mansour", name:"منصور الجمعة",   role:"مشرف قسم التطوير",   b:[68,412,402,660]},
  {id:"yousef",  name:"يوسف الأنصاري",  role:"مشرف اللعب الفعلي",  b:[438,412,752,660]},
  {id:"saad",    name:"سعد المنصور",    role:"مشرف الرصد",         b:[788,412,1108,660]},
  {id:"jassim",  name:"جاسم الخليفة",   role:"اللعب الفعلي",       b:[1138,405,1480,660]},
  {id:"hussain", name:"حسين التميمي",   role:"الرصد",              b:[22,662,392,955]},
  {id:"ahmed",   name:"أحمد المشموم",   role:"الرصد والديسكورد",   b:[418,662,752,955]},
  {id:"rakan",   name:"راكان حواري",    role:"الرصد",              b:[790,662,1145,955]},
  {id:"yaqoub",  name:"يعقوب القيس",    role:"الرصد",              b:[1166,662,1524,955]}
];
const DEFAULT_EMAILS = {mf:"coachmf.kw@gmail.com", yaqoub:"alqais77@gmail.com", mansour:"mansourx04@gmail.com",
  hussain:"hussain_altamimi1989@hotmail.com", saad:"saad90khaled@gmail.com",
  rakan:"rakanhwari26@gmail.com", yousef:"y99233239@gmail.com"};
const SEC_AR = {mon:"إدارة الرصد", play:"اللعب الفعلي"};
const esc = s => String(s==null?"":s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const $ = s => document.querySelector(s);
const pct = (v, t) => (v / t * 100).toFixed(3) + "%";
const boxStyle = r => `left:${pct(r[0],IMG_W)};top:${pct(r[1],IMG_H)};width:${pct(r[2]-r[0],IMG_W)};height:${pct(r[3]-r[1],IMG_H)}`;

/* ───────────── الرسم ───────────── */
const pillHTML = (d, cls, style) => `<div class="pill ${cls||""}" id="p-${d.id}" ${style?`style="${style}"`:""} role="status" aria-label="${esc(d.name)}"><span class="dot"></span><span class="tx"><b>غير متصل</b><small>OFFLINE</small></span></div>`;
function spotHTML(d){
  const sup = !!d.pill;
  return `<div class="spot${sup?" sup":""}" id="d-${d.id}" style="${boxStyle(d.b)}" title="${esc(d.name)} — ${esc(d.role)}">
      <div class="dim"></div><div class="glow"></div>
      ${sup ? "" : pillHTML(d)}
    </div>
    ${sup ? pillHTML(d, "fixed", boxStyle(d.pill)) : ""}`;
}
function editHTML(){
  if(!EDIT) return "";
  return `<section class="edit" aria-label="ربط المكاتب بالإيميلات">
    <h2>ربط المكاتب بالإيميلات</h2>
    <div class="grid">${DESKS.map(d=>`<label class="mail"><span>${esc(d.name)} <small>${esc(d.role)}</small></span>
      <input id="m-${d.id}" type="email" list="staffMails" value="${esc(EMAILS[d.id]||"")}" placeholder="name@example.com"></label>`).join("")}</div>
    <datalist id="staffMails">${STAFF_MAILS.map(m=>`<option value="${esc(m.email)}">${esc(m.name)}</option>`).join("")}</datalist>
  </section>`;
}
function render(){
  $("#app").innerHTML = `
  <header class="top">
    <div class="brand">
      <img src="/assets/brand/mf-logo-gold.webp" alt="شعار MF Soccer" width="584" height="403">
      <div><h1>مركز التحليل الافتراضي</h1><p>حالة فريق العمل لحظياً</p></div>
    </div>
    <div class="side">
      <div class="stats">
        <div class="stat live"><b id="onCount">0</b><span>متصل الآن</span></div>
        <div class="stat"><b>${DESKS.length}</b><span>أعضاء الفريق</span></div>
      </div>
      <div class="toolbar">
        ${IS_OWNER?`<button class="btn${EDIT?" gold":""}" id="editBtn" type="button">${EDIT?"حفظ الربط":"ربط المكاتب بالإيميلات"}</button>${EDIT?'<button class="btn" id="cancelBtn" type="button">إلغاء</button>':""}`:""}
        <a class="btn" href="/">الموقع</a>
        <button class="btn" id="logoutBtn" type="button">خروج</button>
      </div>
    </div>
  </header>
  <div class="scroller">
    <div class="stage">
      <img class="room" src="/assets/brand/center-room.webp" alt="مركز الرصد والتحليل — مكاتب فريق العمل" width="1536" height="1024">
      ${DESKS.map(spotHTML).join("")}
    </div>
  </div>
  ${editHTML()}
  <div class="orph" id="orph" hidden></div>
  <div class="legend"><span><i style="background:#3DDC5A"></i>متصل: داخل الموقع في إدارة الرصد أو اللعب الفعلي</span><span><i style="background:#6B7A90"></i>غير متصل: المكتب مطفأ</span></div>`;
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
  if($("#app").hidden || !$("#onCount")) return;
  let n = 0;
  const mapped = new Set();
  DESKS.forEach(d=>{
    const email = (EMAILS[d.id]||"").toLowerCase(); if(email) mapped.add(email);
    const st = statusOf(email), el = $("#d-"+d.id), pill = $("#p-"+d.id);
    if(!el || !pill) return;
    el.classList.toggle("on", !!st); pill.classList.toggle("on", !!st);
    if(st) n++;
    pill.querySelector("b").textContent = st ? "متصل · " + SEC_AR[st.section] : "غير متصل";
    pill.querySelector("small").textContent = st ? "ONLINE" : "OFFLINE";
    pill.setAttribute("aria-label", `${d.name}: ${st ? "متصل في " + SEC_AR[st.section] : "غير متصل"}`);
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
