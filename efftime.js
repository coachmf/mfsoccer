/* =====================================================================
   الوقت الفعلي للعب — ساعة إيقاف مستقلة لكل مباراة (منصور 2026-10-02)

   منفصلة تماماً عن أحداث المباراة: لا تكتب هدفاً ولا بطاقة ولا أي حدث،
   ولا تمسّ سجل الموسم (ALL) ولا الإحصاءات ولا الترتيب ولا الفانتسي ولا
   وثيقة كأس الخليج. مجرد ساعة: بداية الشوط ← توقّف بسبب (خطأ، ركنية،
   رمية تماس، ركلة مرمى، VAR…) ← استئناف ← نهاية الشوط.

   التخزين: وثيقة لكل مباراة seasons/eff_<hash مفتاح المباراة>
     {key, home, away, comp, round, date, gulf,
      halves:{h1:{s,e}, h2:{…}, e1, e2},           ‏(ميلي ثانية بساعة جهاز المشغّل)
      stops:[{id, ph, r, s, e}]}                    ‏(r = سبب التوقف، e فارغ = التوقف جارٍ)
   وفهرس seasons/effidx {m:{key:{eff, dur, n, live, upd}}} لتعرف صفحة المباراة
   وجود السجل دون قراءة وثيقة لكل مباراة. قواعد seasons/{doc} الحالية تكفي.

   الأداة الحرّة (منصور 2026-10-07): «أداة الوقت الفعلي» تُشغَّل بلا مباراة،
     مسودتها في seasons/eff_tool (لا تدخل الفهرس)، وبعد الانتهاء «حفظ على مباراة»
     يختار أي مباراة (الدوري والكؤوس وكأس الخليج) فتُنقل المسودة إلى eff_<hash>
     وتُفرَّغ الأداة.
   الإحصاءات تُشتق من الوثيقة لحظة العرض (لا مجاميع مخزّنة تتعارض معها).
   وضع الاختبار: ‏?livetest=1 على localhost — تخزين محلي فقط.
   ===================================================================== */
(function(){
"use strict";
const EFF = window.EFFTIME = {};
const TEST = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && /[?&]livetest=1\b/.test(location.search);
EFF.TEST = TEST;
const H = s => String(s==null?"":s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const clone = o => o==null ? o : JSON.parse(JSON.stringify(o));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);
function hashId(s){ let h=0x811c9dc5; for(const ch of String(s)){ h^=ch.codePointAt(0); h=Math.imul(h,0x01000193)>>>0; } return h.toString(36); }
const idOf = key => "eff_" + hashId(key);
EFF.idOf = idOf;
const TOOL_ID = "eff_tool";   /* مسودة الأداة الحرّة — بلا مباراة */
const blankTool = () => ({tool:1, key:"", home:"", away:"", comp:"", halves:{}, stops:[], v:1});

const REASONS = [
  ["foul","خطأ (فاول)"], ["corner","ركنية"], ["throw","رمية تماس"], ["gk","ركلة مرمى"], ["var","مراجعة VAR"],
  ["goal","هدف"], ["sub","تبديل"], ["injury","إصابة"], ["offside","تسلل"], ["water","استراحة ماء"], ["other","أخرى"]
];
const RN = Object.fromEntries(REASONS);
const PHS = [["h1","الشوط الأول"],["h2","الشوط الثاني"],["e1","الإضافي الأول"],["e2","الإضافي الثاني"]];
const PHN = Object.fromEntries(PHS);
EFF.REASONS = REASONS;

const pad = n => String(Math.floor(n)).padStart(2,"0");
const fmt = ms => { const t = Math.max(0, Math.round((ms||0)/1000)); return `${pad(t/60)}:${pad(t%60)}`; };   /* دقائق:ثوانٍ حتى بعد الساعة (99:00) كساعة الملعب */
const pct = (a,b) => b>0 ? Math.round(a/b*100) : 0;
EFF.fmt = fmt;
/* سرعة الفيديو (منصور 2026-10-28): من يرصد إعادة المباراة على 1.5x مثلاً يختار السرعة نفسها، فتجري الساعة بزمن المباراة لا بزمن الجهاز.
   d.vc = {w: زمن الجهاز عند آخر تغيير, v: زمن المباراة عنده, x: السرعة} — كل الطوابع (s/e) بزمن المباراة؛ بلا vc = 1x كما كانت */
const SPEEDS = [1, 1.25, 1.5, 1.75, 2];
const vnow = d => { const c = d && d.vc; return c && c.x > 0 ? c.v + (Date.now() - c.w) * c.x : Date.now(); };
const spd = d => (d && d.vc && +d.vc.x) || 1;

/* ───────────── الحساب ───────────── */
function calc(d, now){
  now = now==null ? vnow(d) : now;
  const out = {ph:{}, dur:0, stop:0, eff:0, n:0, reasons:{}, longest:null, cur:null, open:null, live:false, started:false};
  if(!d) return out;
  /* رصد يدوي من مصدر خارجي (منصور 2026-10-11): مجاميع الشوطين فقط بلا سجل توقفات —
     manual:{h1:{eff,dur?}, h2:{…}, dur?, pct?} بالثواني. لا يُستعمل إن وُقّتت الأشواط بالساعة. */
  const M = d.manual, timed = d.halves && PHS.some(([p])=>d.halves[p] && d.halves[p].s);
  if(M && !timed){
    for(const [p] of PHS){ const x = M[p]; if(!x || !(x.eff>0)) continue;
      const eff = x.eff*1000, dur = x.dur>0 ? x.dur*1000 : 0;
      out.ph[p] = {dur, stop:dur ? Math.max(0, dur-eff) : 0, eff, n:0, live:false, s:null, e:null};
      out.eff += eff; }
    out.dur = M.dur>0 ? M.dur*1000 : Object.values(out.ph).reduce((a,x)=>a+x.dur, 0);
    out.stop = out.dur ? Math.max(0, out.dur - out.eff) : 0;
    out.started = out.eff > 0; out.manual = true; out.pct = M.pct>0 ? M.pct : null;
    return out;
  }
  const stops = (d.stops||[]).slice().sort((a,b)=>a.s-b.s);
  for(const [p] of PHS){
    const h = d.halves && d.halves[p]; if(!h || !h.s) continue;
    out.started = true;
    const end = h.e || now, dur = Math.max(0, end - h.s);
    let stop = 0, n = 0;
    for(const x of stops){
      if(x.ph!==p) continue;
      const a = Math.max(x.s, h.s), b = Math.min(x.e || end, end); if(b < a) continue;
      const t = b - a; stop += t; n++;
      const R = out.reasons[x.r] || (out.reasons[x.r] = {n:0, t:0}); R.n++; R.t += t;
      if(!out.longest || t > out.longest.t) out.longest = {t, r:x.r, ph:p};
      if(!x.e && !h.e) out.open = x;
    }
    out.ph[p] = {dur, stop, eff:Math.max(0, dur - stop), n, live:!h.e, s:h.s, e:h.e||null};
    out.dur += dur; out.stop += stop; out.n += n;
    if(!h.e){ out.live = true; out.cur = p; }
  }
  out.eff = Math.max(0, out.dur - out.stop);
  return out;
}
EFF.calc = calc;

/* ───────────── التخزين ───────────── */
const store = {
  _subs:{},
  _rd(k){ try{ const s = localStorage.getItem("mfeff:"+k); return s ? JSON.parse(s) : null; }catch(e){ return null; } },
  _wr(k, v){ try{ localStorage.setItem("mfeff:"+k, JSON.stringify(v)); }catch(e){} (this._subs[k]||[]).forEach(f=>f(clone(v))); },
  ready(){ return TEST || (typeof fbDb!=="undefined" && fbDb); },
  ref(id){ return fbDb.collection("seasons").doc(id); },
  async get(id){
    if(TEST) return this._rd(id);
    const s = await this.ref(id).get({source:"server"}).catch(()=>this.ref(id).get());
    return s.exists ? s.data() : null;
  },
  watch(id, cb){
    if(TEST){ (this._subs[id] ||= []).push(cb); setTimeout(()=>cb(this._rd(id)), 0); return ()=>{ this._subs[id] = (this._subs[id]||[]).filter(f=>f!==cb); }; }
    if(!this.ready()) return ()=>{};
    return this.ref(id).onSnapshot(s=>cb(s.exists ? s.data() : null), ()=>{});
  },
  async set(id, d){
    d.updatedAt = new Date().toISOString();
    d.updatedBy = (typeof FBUSER!=="undefined" && FBUSER && FBUSER.email) || "";
    if(TEST){ this._wr(id, d); return; }
    await this.ref(id).set(d);
  },
  async idxSet(key, sum){
    if(TEST){ const cur = this._rd("idx") || {m:{}}; if(sum) cur.m[key] = sum; else delete cur.m[key]; this._wr("idx", cur); return; }
    const upd = {}; upd["m."+key] = sum ? sum : firebase.firestore.FieldValue.delete();
    try{ await this.ref("effidx").update(upd); }
    catch(e){ if(sum) await this.ref("effidx").set({m:{[key]:sum}}, {merge:true}); }
  },
  idxWatch(cb){
    if(TEST){ (this._subs.idx ||= []).push(cb); setTimeout(()=>cb(this._rd("idx")||{m:{}}), 0); return; }
    if(!this.ready()) return;
    this.ref("effidx").onSnapshot(s=>cb(s.exists ? s.data() : {m:{}}), ()=>{});
  }
};
if(TEST) window.addEventListener("storage", e=>{ if(e.key && e.key.startsWith("mfeff:")){ const k = e.key.slice(6); (store._subs[k]||[]).forEach(f=>f(store._rd(k))); } });
EFF.store = store;

/* الفهرس: من سُجّل له وقت فعلي (يقرأ وثيقة واحدة لكل الموقع) */
let IDX = {m:{}}, idxOn = false, idxLive = false, idxSnap = false;
const idxCbs = new Set();
const idxFire = () => idxCbs.forEach(f=>{ try{ f(IDX); }catch(e){} });
/* منصور 2026-10-28 (الكويت × ناساف «مو طالع اللعب الفعلي»): على جوال بطيء كانت مكتبة Firestore تتأخر أكثر من 30 ثانية فيتوقف
   الانتظار ولا يُحمَّل الفهرس أبداً — الآن لقطة CDN (/api/doc/effidx) أولاً، والانتظار لا يتوقف حتى تجهز المكتبة */
function startIdx(){
  if(!TEST && !idxSnap && typeof SNAP!=="undefined" && SNAP && SNAP.get){ idxSnap = true;
    SNAP.get("effidx").then(d=>{ if(!idxLive && d && d.m){ IDX = d; idxFire(); } }).catch(()=>{}); }
  if(idxOn || !store.ready()) return; idxOn = true;
  store.idxWatch(d=>{ idxLive = true; IDX = d && d.m ? d : {m:{}}; idxFire(); });
}
EFF.idx = () => IDX;
EFF.onIdx = f => { idxCbs.add(f); return ()=>idxCbs.delete(f); };
function summary(d){
  const c = calc(d);
  return {eff:Math.round(c.eff/1000), dur:Math.round(c.dur/1000), n:c.n, live:c.live, h:d.home, a:d.away, c:d.comp||"", r:d.round, d:d.date||"", upd:new Date().toISOString()};
}

/* ───────────── مطابقة المباراة ───────────── */
const keyOf = m => (typeof matchKey==="function") ? matchKey(m) : [m.comp||"الدوري", m.round, m.home, m.away].map(v=>encodeURIComponent(String(v))).join("/");
EFF.keyOf = keyOf;
function findMatch(k){
  let m = null;
  try{ m = (typeof matchByKey==="function") ? matchByKey(k) : null; }catch(e){}
  if(!m && window.GULF && GULF.data){ try{ const D = GULF.data(); m = (D && D.matches || []).find(x=>keyOf(x)===k) || null; }catch(e){} }
  return m;
}
const rndLbl = d => d.gulf && +d.round===4 ? "نصف النهائي" : d.gulf && +d.round===5 ? "النهائي" : `ج${d.round}`;
const canEdit = () => TEST || (typeof isAdmin!=="undefined" && !!isAdmin);
const say = (msg, kind) => { if(typeof toast==="function") toast(msg, kind); };

/* ───────────── غرفة المشغّل ───────────── */
let S = null;
EFF.isOpen = () => !!S;   /* المحرّر يوقف حفظه التلقائي ما دامت الساعة مفتوحة */   /* {key, id, doc, unsub, tick, undo:[], ph, busy, lock} */
function blank(m, key){
  const gulf = !!(m && (m.__gulf || m.comp==="كأس الخليج"));
  return {key, home:m.home, away:m.away, comp:(typeof compOf==="function" ? compOf(m) : m.comp)||"", round:m.round, date:m.date||"", gulf, halves:{}, stops:[], v:1};
}
function curPhase(d){
  const hs = d.halves || {};
  const live = PHS.find(([p])=>hs[p] && hs[p].s && !hs[p].e); if(live) return live[0];
  const next = PHS.find(([p])=>!(hs[p] && hs[p].s));
  /* بعد نهاية الشوط الثاني لا نقترح الإضافي تلقائياً */
  if(next && (next[0]==="h1" || next[0]==="h2")) return next[0];
  return (PHS.slice().reverse().find(([p])=>hs[p] && hs[p].s) || ["h1"])[0];
}
EFF.open = async function(key){
  if(!canEdit()){ say("الوقت الفعلي للمحرّرين فقط", "err"); return; }
  const m = findMatch(key); if(!m){ say("لم تُعثر على المباراة", "err"); return; }
  if(!store.ready()){ say("لم يكتمل الاتصال بعد — حاول بعد لحظات", "err"); return; }
  EFF.close(true);
  const id = idOf(key);
  S = {key, id, m, doc:null, undo:[], ph:null, root:null, lock:null};
  mount();
  let d = null;
  try{ d = await store.get(id); }catch(e){ console.error(e); }
  if(!S || S.id!==id) return;
  S.doc = d || blank(m, key);
  S.ph = curPhase(S.doc);
  paint();
  S.unsub = store.watch(id, nd=>{ if(!S || S.id!==id || !nd) return;
    if(S.saving) return;   /* كتابتنا الجارية: لا نرجع لنسخة أقدم */
    if(nd.updatedAt && S.doc && S.doc.updatedAt && nd.updatedAt < S.doc.updatedAt) return;
    S.doc = nd; paint(); });
  S.tick = setInterval(paintClock, 250);
  try{ if(navigator.wakeLock) S.lock = await navigator.wakeLock.request("screen"); }catch(e){}
  try{ if(!/^#effctl\//.test(location.hash)) history.pushState({eff:1}, "", "#effctl/"+key); }catch(e){}
};
EFF.openTool = async function(){
  if(!canEdit()){ say("الوقت الفعلي للمحرّرين فقط", "err"); return; }
  if(!store.ready()){ say("لم يكتمل الاتصال بعد — حاول بعد لحظات", "err"); return; }
  EFF.close(true);
  S = {key:"", id:TOOL_ID, tool:true, m:null, doc:null, undo:[], ph:null, root:null, lock:null, pick:false};
  mount();
  let d = null;
  try{ d = await store.get(TOOL_ID); }catch(e){ console.error(e); }
  if(!S || S.id!==TOOL_ID) return;
  S.doc = d && d.tool ? d : blankTool();
  S.ph = curPhase(S.doc);
  paint();
  S.unsub = store.watch(TOOL_ID, nd=>{ if(!S || S.id!==TOOL_ID || !nd || !nd.tool) return;
    if(S.saving) return;
    if(nd.updatedAt && S.doc && S.doc.updatedAt && nd.updatedAt < S.doc.updatedAt) return;
    S.doc = nd; if(!S.pick) paint(); });
  S.tick = setInterval(paintClock, 250);
  try{ if(navigator.wakeLock) S.lock = await navigator.wakeLock.request("screen"); }catch(e){}
  try{ if(!/^#effctl\//.test(location.hash)) history.pushState({eff:1}, "", "#effctl/tool"); }catch(e){}
};

/* ───────────── الأداة: حفظ على مباراة ───────────── */
function allMatches(){
  const out = [], seen = new Set();
  const add = (m, gulf) => { if(!m || !m.home || !m.away) return; const k = keyOf(m); if(seen.has(k)) return; seen.add(k);
    const comp = gulf ? "كأس الخليج" : ((typeof compOf==="function" ? compOf(m) : m.comp) || "الدوري");
    out.push({m, k, gulf, comp}); };
  try{ ((typeof ALL!=="undefined" && ALL && ALL.matches) || []).forEach(m=>add(m, false)); }catch(e){}
  try{ if(window.GULF && GULF.data){ const D = GULF.data(); (D && D.matches || []).forEach(m=>add(m, true)); } }catch(e){}
  try{ if(window.EXT && EXT.data){ const D = EXT.data(); (D && D.matches || []).forEach(m=>add(m, false)); } }catch(e){}   /* مشاركات أنديتنا الخارجية (ext.js) */
  /* اليوم وما قبله أولاً (الأحدث فالأقدم)، ثم القادمة (الأقرب فالأبعد) */
  const t = new Date(), today = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`;
  const past = x => !x.m.date || String(x.m.date) <= today;
  return out.sort((a,b)=>{ const pa = past(a), pb = past(b); if(pa!==pb) return pa ? -1 : 1;
    const c = pa ? String(b.m.date||"").localeCompare(String(a.m.date||"")) : String(a.m.date||"").localeCompare(String(b.m.date||""));
    return c || (+b.m.round||0)-(+a.m.round||0); });
}
function pickComps(){
  const n = {}; allMatches().forEach(x=>{ n[x.comp] = (n[x.comp]||0) + 1; });
  const order = ["الدوري","كأس الخليج"];
  return Object.keys(n).sort((a,b)=>{ const ia = order.indexOf(a), ib = order.indexOf(b); return (ia<0?9:ia)-(ib<0?9:ib) || a.localeCompare(b,"ar"); }).map(c=>[c, n[c]]);
}
function pickRows(q){
  q = String(q||"").trim();
  const cf = S && S.pickComp || "";
  const list = allMatches().filter(x=>(!cf || x.comp===cf) && (!q || [x.m.home, x.m.away, x.comp, x.m.date||""].join(" ").includes(q)));
  if(!list.length) return `<p class="eff-hint">لا مباريات بهذا الاسم.</p>`;
  return list.slice(0, 150).map(({m,k,gulf,comp})=>{
    const has = IDX.m && IDX.m[k];
    const rl = gulf && +m.round===4 ? "نصف النهائي" : gulf && +m.round===5 ? "النهائي" : `الجولة ${m.round}`;
    return `<button type="button" class="eff-pk" data-eff="pickm" data-v="${H(k)}">
      <b>${H(m.home)} × ${H(m.away)}</b>
      <small>${H(comp)} · ${H(rl)}${m.date ? ` · <bdi dir="ltr">${H(m.date)}</bdi>` : ""}</small>
      ${has ? `<i>فيها وقت فعلي <bdi dir="ltr">${fmt((has.eff||0)*1000)}</bdi></i>` : ""}</button>`; }).join("");
}
async function saveToMatch(k){
  if(!S || !S.tool || !S.doc) return;
  const hit = allMatches().find(x=>x.k===k);
  const m = findMatch(k) || (hit && hit.m);
  if(!m){ say("لم تُعثر على المباراة", "err"); return; }
  const has = IDX.m && IDX.m[k];
  const msg = has
    ? `مباراة ${m.home} × ${m.away} فيها وقت فعلي مسجّل (${fmt((has.eff||0)*1000)}).\nاستبداله بتسجيل الأداة؟`
    : `حفظ الوقت الفعلي على مباراة ${m.home} × ${m.away}؟`;
  if(!confirm(msg)) return;
  const d = Object.assign(blank(m, k), {halves:clone(S.doc.halves||{}), stops:clone(S.doc.stops||[]), from:"tool"});
  if(hit && hit.gulf) d.gulf = true;
  S.saving = (S.saving||0) + 1;
  try{
    await store.set(idOf(k), d);
    await store.idxSet(k, summary(d));
    await store.set(TOOL_ID, blankTool());
  }catch(e){ console.error(e); say("تعذّر الحفظ: "+(e.code||e.message), "err"); if(S) S.saving--; return; }
  say(`حُفظ الوقت الفعلي على ${m.home} × ${m.away}`, "ok");
  try{ history.replaceState({eff:1}, "", "#effctl/"+k); }catch(e){}
  EFF.open(k);   /* تكمل على المباراة نفسها (وإن كان الشوط جارياً) */
}

EFF.close = function(silent){
  if(!S) return;
  if(S.unsub) S.unsub(); if(S.tick) clearInterval(S.tick);
  try{ if(S.lock) S.lock.release(); }catch(e){}
  if(S.root) S.root.remove();
  document.documentElement.classList.remove("eff-open");
  S = null;
  if(!silent && /^#effctl\//.test(location.hash)){ try{ history.state && history.state.eff ? history.back() : history.replaceState(null, "", location.pathname+location.search); }catch(e){} }
};
window.addEventListener("popstate", ()=>{ if(S && !/^#effctl\//.test(location.hash)) EFF.close(true); });

function mount(){
  const el = document.createElement("div");
  el.id = "effctl"; el.className = "eff-ov"; el.setAttribute("role","dialog"); el.setAttribute("aria-label","الوقت الفعلي للعب");
  el.innerHTML = `<div class="eff-wrap"><div class="eff-load">جارٍ التحميل…</div></div>`;
  document.body.appendChild(el); S.root = el;
  document.documentElement.classList.add("eff-open");
}

async function commit(mut){
  if(!S || !S.doc) return;
  S.undo.push(clone(S.doc)); if(S.undo.length > 40) S.undo.shift();
  const d = clone(S.doc); mut(d); S.doc = d; paint();
  await save(d);
}
async function save(d){
  S.saving = (S.saving||0) + 1;
  const id = S.id, key = S.key;
  try{ await store.set(id, d); if(!S || !S.tool) await store.idxSet(key, summary(d)); }
  catch(e){ console.error(e); say("تعذّر الحفظ: "+(e.code||e.message), "err"); }
  finally{ if(S && S.id===id) S.saving--; }
}
/* تنزيل PDF (منصور 2026-10-29): تقرير صفحة A4 من الوثيقة — الملخص، الأشواط، أسباب التوقف، وكل توقف بوقته.
   الصفحة تُرسم HTML (العربية سليمة) ثم html2canvas → jsPDF، تُحمَّلان من cdnjs عند أول ضغطة فقط */
const loadJs = src => new Promise((ok, no)=>{ if(document.querySelector(`script[src="${src}"]`)) return ok(); const x = document.createElement("script"); x.src = src; x.onload = ok; x.onerror = no; document.head.appendChild(x); });
function reportHTML(d){
  const c = calc(d), rs = Object.entries(c.reasons).sort((a,b)=>b[1].t-a[1].t);
  const title = S.tool && !d.home ? "أداة الوقت الفعلي" : `${H(d.home)} × ${H(d.away)}`;
  const sub = [d.comp, d.home ? rndLbl(d) : "", d.date].filter(Boolean).map(H).join(" · ");
  const card = (k,v,big) => `<div style="flex:1;border:1px solid #E3E6EE;border-radius:12px;padding:12px 10px;text-align:center${big?";background:#0B1530;color:#fff;border-color:#0B1530":""}"><div style="font-size:12px;opacity:.75">${k}</div><div dir="ltr" style="font-size:${big?30:24}px;font-weight:800;margin-top:4px">${v}</div></div>`;
  const th = t => `<th style="padding:7px 8px;border-bottom:2px solid #0B1530;text-align:right;font-size:12px">${t}</th>`;
  const td = (t, ltr) => `<td${ltr?' dir="ltr"':""} style="padding:6px 8px;border-bottom:1px solid #EEF0F5;font-size:12.5px;text-align:right">${t}</td>`;
  const phRows = PHS.filter(([k])=>c.ph[k]).map(([k,t])=>{ const x = c.ph[k]; return `<tr>${td(t)}${td(fmt(x.dur),1)}${td(fmt(x.eff),1)}${td(fmt(x.stop),1)}${td(pct(x.eff,x.dur)+"%",1)}${td(x.n)}</tr>`; }).join("");
  const stopRows = PHS.map(([k,t])=>{ const h = (d.halves||{})[k]; if(!h || !h.s) return "";
    const L = (d.stops||[]).filter(x=>x.ph===k).sort((a,b)=>a.s-b.s); if(!L.length) return "";
    return `<tr><td colspan="4" style="padding:9px 8px 5px;font-weight:800;font-size:13px;color:#0B1530">${t} (${L.length})</td></tr>` +
      L.map((x,i)=>`<tr>${td(i+1)}${td(H(RN[x.r]||x.r))}${td(fmt(x.s-h.s)+" – "+(x.e?fmt(x.e-h.s):"…"),1)}${td(x.e?fmt(x.e-x.s):"جارٍ",1)}</tr>`).join(""); }).join("");
  return `<div dir="rtl" style="width:794px;padding:34px 36px;background:#fff;color:#0B1530;font-family:'Tajawal','Cairo',system-ui,sans-serif;box-sizing:border-box">
    <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #C9A45C;padding-bottom:12px">
      <div><div style="font-size:24px;font-weight:800">${title}</div><div style="font-size:13px;color:#5B6478;margin-top:4px">الوقت الفعلي للعب${sub?" · "+sub:""}</div></div>
      <div style="font-weight:900;letter-spacing:1px;font-size:18px;color:#C9A45C" dir="ltr">MF SOCCER</div>
    </div>
    <div style="display:flex;gap:10px;margin:18px 0">${card("اللعب الفعلي", fmt(c.eff), 1)}${card("الزمن الكلي", fmt(c.dur))}${card("النسبة", (c.pct||pct(c.eff,c.dur))+"%")}${card("التوقفات", c.manual ? "—" : c.n)}</div>
    ${c.longest ? `<div style="font-size:12.5px;color:#5B6478;margin-bottom:14px">أطول توقف: <b style="color:#0B1530">${H(RN[c.longest.r]||c.longest.r)}</b> · <bdi dir="ltr">${fmt(c.longest.t)}</bdi> · ${PHN[c.longest.ph]}</div>` : ""}
    <table style="width:100%;border-collapse:collapse;margin-bottom:18px"><tr>${th("الشوط")}${th("الزمن")}${th("اللعب الفعلي")}${th("التوقفات")}${th("النسبة")}${th("عدد التوقفات")}</tr>${phRows}</table>
    ${rs.length ? `<table style="width:100%;border-collapse:collapse;margin-bottom:18px"><tr>${th("سبب التوقف")}${th("المرات")}${th("المجموع")}${th("من التوقفات")}</tr>${rs.map(([k,v])=>`<tr>${td(H(RN[k]||k))}${td(v.n)}${td(fmt(v.t),1)}${td(pct(v.t,c.stop)+"%",1)}</tr>`).join("")}</table>` : ""}
    ${stopRows ? `<table style="width:100%;border-collapse:collapse"><tr>${th("#")}${th("السبب")}${th("من – إلى (دقيقة الشوط)")}${th("المدة")}</tr>${stopRows}</table>` : ""}
    <div style="margin-top:20px;font-size:11px;color:#8A93A6;display:flex;justify-content:space-between"><span>mfsoccer.com</span><span dir="ltr">${new Date().toLocaleString("en-GB")}</span></div>
  </div>`;
}
async function downloadPdf(){
  const d = S && S.doc; if(!d) return;
  if(typeof toast==="function") toast("تجهيز ملف PDF…");
  try{
    await loadJs("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js");
    await loadJs("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
    const host = document.createElement("div"); host.style.cssText = "position:fixed;left:-10000px;top:0;z-index:-1";
    host.innerHTML = reportHTML(d); document.body.appendChild(host);
    if(document.fonts && document.fonts.ready) await document.fonts.ready;
    const root = host.firstElementChild, cv = await html2canvas(root, {scale:2, backgroundColor:"#ffffff"});
    const pdf = new jspdf.jsPDF({unit:"pt", format:"a4"}), W = pdf.internal.pageSize.getWidth(), Hp = pdf.internal.pageSize.getHeight();
    /* تقرير طويل يُكمل في صفحات تالية — القطع بين صفوف الجدول لا في منتصف صف */
    const k = W / root.offsetWidth, top0 = root.getBoundingClientRect().top, total = root.offsetHeight, pad = 28 / k;
    const ends = [...root.querySelectorAll("tr")].map(r=>r.getBoundingClientRect().bottom - top0);
    host.remove();
    const cuts = []; let y = 0;
    while(total - y > (Hp / k) - (y ? pad : 0)){ const lim = y + Hp / k - (y ? pad : 0); const ok = ends.filter(e=>e > y + 40 && e <= lim);
      const cut = ok.length ? Math.max(...ok) : lim; cuts.push([y, cut]); y = cut; }
    cuts.push([y, total]);
    const sc = cv.width / root.offsetWidth;
    cuts.forEach(([a, z], i)=>{ const sh = Math.round((z - a) * sc), part = document.createElement("canvas"); part.width = cv.width; part.height = sh;
      const g = part.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, part.width, sh); g.drawImage(cv, 0, Math.round(a * sc), cv.width, sh, 0, 0, cv.width, sh);
      if(i) pdf.addPage(); pdf.addImage(part.toDataURL("image/jpeg", .92), "JPEG", 0, i ? 28 : 0, W, (z - a) * k); });
    const name = `اللعب-الفعلي-${[d.home, d.away].filter(Boolean).join("-") || "الأداة"}${d.date ? "-"+d.date : ""}.pdf`.replace(/\s+/g, "-");
    const blob = pdf.output("blob"), file = new File([blob], name, {type:"application/pdf"});
    if(navigator.canShare && navigator.canShare({files:[file]}) && /iPhone|iPad|Android/i.test(navigator.userAgent)){ await navigator.share({files:[file], title:name}).catch(()=>{}); return; }   /* التطبيق والجوال: مشاركة/حفظ في الملفات */
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href), 4000);
  }catch(e){ if(typeof toast==="function") toast("تعذّر تجهيز الملف — حاول مرة ثانية"); }
}
EFF.pdf = downloadPdf;
function act(a, arg){
  if(!S || !S.doc) return;
  if(a==="pdf"){ downloadPdf(); return; }
  const now = vnow(S.doc), p = S.ph, hs = S.doc.halves || {}, h = hs[p];
  const open = (S.doc.stops||[]).find(x=>x.ph===p && !x.e);
  if(a==="speed"){ const x = +arg; if(!SPEEDS.includes(x) || x===spd(S.doc)) return; commit(d=>{ d.vc = {w:Date.now(), v:vnow(d), x}; }); return; }
  if(a==="start"){ if(h && h.s) return; commit(d=>{ (d.halves ||= {})[p] = {s:now}; }); return; }
  if(a==="stop"){
    if(!h || !h.s || h.e) return;
    if(open){ if(open.r===arg) return; commit(d=>{ const x = d.stops.find(y=>y.id===open.id); if(x) x.r = arg; }); return; }   /* تصحيح سبب التوقف الجاري */
    commit(d=>{ (d.stops ||= []).push({id:uid(), ph:p, r:arg, s:now}); }); return;
  }
  if(a==="go"){ if(!open) return; commit(d=>{ const x = d.stops.find(y=>y.id===open.id); if(x) x.e = now; }); return; }
  if(a==="end"){
    if(!h || !h.s || h.e) return;
    if(!confirm(`إنهاء ${PHN[p]}؟`)) return;
    commit(d=>{ const x = open && d.stops.find(y=>y.id===open.id); if(x) x.e = now; d.halves[p].e = now; });
    const nx = {h1:"h2", h2:"h2", e1:"e2", e2:"e2"}[p];
    if(nx!==p) S.ph = nx;
    return;
  }
  if(a==="undo"){
    const prev = S.undo.pop(); if(!prev){ say("لا شيء للتراجع عنه", "err"); return; }
    S.doc = prev; paint(); save(clone(prev)); return;
  }
  if(a==="del"){
    const x = (S.doc.stops||[]).find(y=>y.id===arg); if(!x) return;
    if(!confirm(`حذف توقف «${RN[x.r]||x.r}»؟`)) return;
    commit(d=>{ d.stops = d.stops.filter(y=>y.id!==arg); }); return;
  }
  if(a==="reset"){
    if(!h) return;
    if(!confirm(`مسح ${PHN[p]} بالكامل (بدايته ونهايته وكل توقفاته)؟`)) return;
    commit(d=>{ delete d.halves[p]; d.stops = (d.stops||[]).filter(y=>y.ph!==p); }); return;
  }
  if(a==="newsess"){
    if(!S.tool) return;
    if(!confirm("مسح تسجيل الأداة بالكامل والبدء من جديد؟")) return;
    commit(d=>{ d.halves = {}; d.stops = []; }); S.ph = "h1"; return;
  }
  if(a==="reopen"){
    if(!h || !h.e) return;
    if(!confirm(`إعادة فتح ${PHN[p]}؟ (نهايته تُلغى والساعة تكمل من الآن)`)) return;
    commit(d=>{ delete d.halves[p].e; }); return;
  }
}

function paint(){
  if(!S || !S.root) return;
  const d = S.doc; if(!d){ return; }
  if(S.pick){
    S.root.innerHTML = `<div class="eff-wrap">
      <header class="eff-top">
        <button type="button" class="eff-close" data-eff="pickx">رجوع</button>
        <div class="eff-ttl"><b>حفظ على مباراة</b><small>اختر المباراة التي سجّلت وقتها الفعلي</small></div>
        <span></span>
      </header>
      <nav class="eff-pkc" aria-label="البطولة">${[["","الكل"]].concat(pickComps().map(([c])=>[c,c])).map(([v,t])=>`<button type="button" data-eff="pickc" data-v="${H(v)}" aria-pressed="${(S.pickComp||"")===v}">${H(t)}</button>`).join("")}</nav>
      <input class="eff-q" type="search" placeholder="ابحث باسم الفريق أو التاريخ" aria-label="بحث عن مباراة" autocomplete="off">
      <div class="eff-pklist">${pickRows("")}</div>
    </div>`;
    const q = S.root.querySelector(".eff-q"), lst = S.root.querySelector(".eff-pklist");
    q.oninput = () => { lst.innerHTML = pickRows(q.value); };
    return;
  }
  const p = S.ph, h = (d.halves||{})[p], c = calc(d), ph = c.ph[p];
  const open = (d.stops||[]).find(x=>x.ph===p && !x.e);
  const state = !h || !h.s ? "pre" : h.e ? "done" : open ? "stop" : "play";
  const seg = PHS.map(([k,t])=>{ const hh = (d.halves||{})[k]; const st = hh && hh.s ? (hh.e ? " · انتهى" : " · جارٍ") : "";
    return `<button type="button" data-eff="ph" data-v="${k}" aria-pressed="${k===p}">${t}<small>${st}</small></button>`; }).join("");
  const reasons = REASONS.map(([k,t])=>`<button type="button" class="eff-r${open && open.r===k ? " on" : ""}" data-eff="stop" data-v="${k}">${t}</button>`).join("");
  const main =
    state==="pre"  ? `<button type="button" class="eff-big go" data-eff="start">بداية ${PHN[p]}</button>
                      <p class="eff-hint">اضغط عند صافرة البداية. بعدها كل توقف للعب = زر سببه، والاستئناف = الزر الأخضر.</p>` :
    state==="done" ? `<div class="eff-done">انتهى ${PHN[p]} — اللعب الفعلي <b dir="ltr">${fmt(ph.eff)}</b> من <bdi dir="ltr">${fmt(ph.dur)}</bdi> · <bdi dir="ltr">${pct(ph.eff, ph.dur)}%</bdi></div>
                      ${p==="h1" ? `<button type="button" class="eff-big go" data-eff="ph" data-v="h2">إلى الشوط الثاني</button>` : ""}` :
    state==="stop" ? `<button type="button" class="eff-big go" data-eff="go">استئناف اللعب</button>
                      <div class="eff-rgrid stopping">${reasons}</div>
                      <p class="eff-hint">سبب خاطئ؟ اضغط السبب الصحيح ليُصحَّح التوقف الجاري.</p>` :
                     `<div class="eff-rgrid">${reasons}</div>
                      <p class="eff-hint">توقف اللعب؟ اضغط سببه — الساعة الفعلية تتوقف فوراً.</p>`;
  const list = (d.stops||[]).filter(x=>x.ph===p).sort((a,b)=>b.s-a.s);
  const rel = t => h && h.s ? fmt(t - h.s) : "";
  const rows = list.map(x=>`<li${x.e ? "" : ` class="open"`}><b>${H(RN[x.r]||x.r)}</b><span dir="ltr">${rel(x.s)}${x.e ? " – "+rel(x.e) : " – …"}</span><em dir="ltr">${x.e ? fmt(x.e - x.s) : "جارٍ"}</em>
      <button type="button" class="eff-x" data-eff="del" data-v="${x.id}" aria-label="حذف">حذف</button></li>`).join("");
  const rs = Object.entries(c.reasons).sort((a,b)=>b[1].t-a[1].t);
  S.root.innerHTML = `<div class="eff-wrap">
    <header class="eff-top">
      <button type="button" class="eff-close" data-eff="close">إغلاق</button>
      ${S.tool
        ? `<div class="eff-ttl"><b>أداة الوقت الفعلي</b><small>بدون مباراة — احفظها على أي مباراة متى ما خلصت</small></div>`
        : `<div class="eff-ttl"><b>${H(d.home)} × ${H(d.away)}</b><small>الوقت الفعلي للعب · ${H(d.comp||"")} · ${H(rndLbl(d))}</small></div>`}
      <button type="button" class="eff-undo" data-eff="undo"${S.undo.length ? "" : " disabled"}>تراجع</button>
    </header>
    ${S.tool && c.started ? `<div class="eff-row"><button type="button" class="eff-save" data-eff="pick">حفظ على مباراة</button></div>` : ""}
    <nav class="eff-seg">${seg}</nav>
    <div class="eff-spd"><span>سرعة الفيديو</span>${SPEEDS.map(x=>`<button type="button" data-eff="speed" data-v="${x}" aria-pressed="${x===spd(d)}" dir="ltr">${x}x</button>`).join("")}</div>
    <section class="eff-clocks st-${state}">
      <div><span>زمن ${PHN[p]}</span><b data-effc="dur" dir="ltr">${fmt(ph ? ph.dur : 0)}</b></div>
      <div class="eff-main"><span>اللعب الفعلي</span><b data-effc="eff" dir="ltr">${fmt(ph ? ph.eff : 0)}</b><i data-effc="pct">${ph ? pct(ph.eff, ph.dur) : 0}%</i></div>
      <div><span>التوقفات</span><b data-effc="stop" dir="ltr">${fmt(ph ? ph.stop : 0)}</b></div>
    </section>
    <div class="eff-status st-${state}">${state==="pre" ? "لم يبدأ" : state==="done" ? "انتهى" : state==="stop" ? `متوقف — ${H(RN[open.r]||open.r)} <span dir="ltr" data-effc="open">${fmt(vnow(S.doc)-open.s)}</span>` : "الكرة في اللعب"}</div>
    <section class="eff-act">${main}</section>
    ${state==="play" || state==="stop" ? `<div class="eff-row"><button type="button" class="eff-end" data-eff="end">نهاية ${PHN[p]}</button></div>` : ""}
    ${list.length ? `<section class="eff-card"><h4>توقفات ${PHN[p]} (${list.length})</h4><ul class="eff-list">${rows}</ul></section>` : ""}
    ${c.started ? `<section class="eff-card"><h4>المباراة كلها</h4>
      <div class="eff-sum"><div><span>اللعب الفعلي</span><b dir="ltr" data-effc="teff">${fmt(c.eff)}</b></div><div><span>الزمن الكلي</span><b dir="ltr" data-effc="tdur">${fmt(c.dur)}</b></div><div><span>النسبة</span><b data-effc="tpct">${pct(c.eff, c.dur)}%</b></div><div><span>عدد التوقفات</span><b>${c.n}</b></div></div>
      ${rs.length ? `<ul class="eff-rs">${rs.map(([k,v])=>`<li><b>${H(RN[k]||k)}</b><span>${v.n} مرة</span><em dir="ltr">${fmt(v.t)}</em></li>`).join("")}</ul>` : ""}</section>` : ""}
    <div class="eff-row tools">${h ? (h.e ? `<button type="button" class="eff-ghost" data-eff="reopen">إعادة فتح ${PHN[p]}</button>` : "") + `<button type="button" class="eff-ghost danger" data-eff="reset">مسح ${PHN[p]}</button>` : ""}${c.started ? `<button type="button" class="eff-ghost" data-eff="pdf">تنزيل PDF</button>` : ""}${S.tool && c.started ? `<button type="button" class="eff-ghost danger" data-eff="newsess">تسجيل جديد</button>` : ""}</div>
    <p class="eff-foot">مستقلة عن أحداث المباراة: لا تُسجَّل هنا أهداف ولا بطاقات، ولا تدخل في الإحصاءات أو الترتيب أو الفانتسي.</p>
  </div>`;
}
function paintClock(){
  if(!S || !S.root || !S.doc || S.pick) return;
  const c = calc(S.doc), ph = c.ph[S.ph]; if(!ph || !ph.live) return;
  const set = (k, v) => { const el = S.root.querySelector(`[data-effc="${k}"]`); if(el) el.textContent = v; };
  set("dur", fmt(ph.dur)); set("eff", fmt(ph.eff)); set("stop", fmt(ph.stop)); set("pct", pct(ph.eff, ph.dur)+"%");
  set("teff", fmt(c.eff)); set("tdur", fmt(c.dur)); set("tpct", pct(c.eff, c.dur)+"%");
  const open = (S.doc.stops||[]).find(x=>x.ph===S.ph && !x.e); if(open) set("open", fmt(vnow(S.doc)-open.s));
}
document.addEventListener("click", e=>{
  const o = e.target.closest && e.target.closest("[data-eff-open]");
  if(o){ e.preventDefault(); EFF.open(o.dataset.effOpen); return; }
  const t = e.target.closest && e.target.closest("[data-eff-tool]");
  if(t){ e.preventDefault(); EFF.openTool(); return; }
  if(!S || !S.root || !S.root.contains(e.target)) return;
  const b = e.target.closest("[data-eff]"); if(!b || b.disabled) return;
  const a = b.dataset.eff, v = b.dataset.v;
  if(a==="close"){ EFF.close(); return; }
  if(a==="ph"){ S.ph = v; paint(); return; }
  if(a==="pick"){ S.pick = true; paint(); const q = S.root.querySelector(".eff-q"); if(q) q.focus(); return; }
  if(a==="pickx"){ S.pick = false; paint(); return; }
  if(a==="pickc"){ S.pickComp = v || ""; const q = S.root.querySelector(".eff-q"), val = q ? q.value : "";
    S.root.querySelectorAll("[data-eff=pickc]").forEach(x=>x.setAttribute("aria-pressed", String((x.dataset.v||"")===S.pickComp)));
    S.root.querySelector(".eff-pklist").innerHTML = pickRows(val); return; }
  if(a==="pickm"){ saveToMatch(v); return; }
  act(a, v);
});
document.addEventListener("keydown", e=>{
  if(!S || !S.doc) return;
  if(e.target.closest("input,textarea,select")){ if(e.key==="Escape" && S.pick){ S.pick = false; paint(); } return; }
  if(e.key===" "){ const open = (S.doc.stops||[]).find(x=>x.ph===S.ph && !x.e); if(open){ e.preventDefault(); act("go"); } }
  if(e.key==="Escape"){ if(S.pick){ S.pick = false; paint(); } else EFF.close(); }
});

/* ───────────── صفحة المباراة: بطاقة «الوقت الفعلي للعب» في تبويب التفاصيل ───────────── */
let MPW = null;   /* {key, unsub, doc} */
function cardHTML(d, live){
  const c = calc(d); if(!c.started) return "";
  const halves = PHS.filter(([p])=>c.ph[p]).map(([p,t])=>{ const x = c.ph[p];
    return `<div class="effp-h"><span>${t}${x.live ? `<i class="effp-live">جارٍ</i>` : ""}</span><b dir="ltr">${fmt(x.eff)}</b>${x.dur ? `<small>من <bdi dir="ltr">${fmt(x.dur)}</bdi> · <bdi dir="ltr">${pct(x.eff, x.dur)}%</bdi></small>` : ""}</div>`; }).join("");
  const P = c.pct!=null ? c.pct : pct(c.eff, c.dur);
  /* التوقفات وأسبابها لأداة الرصد فقط، لا تظهر للجمهور (منصور 2026-10-28) */
  return `<div class="mp-card effp" data-effp="1">
    <div class="mp-hd"><h3>الوقت الفعلي للعب</h3><span class="mp-sub">${c.live ? "يُحدَّث مباشرة" : "زمن الكرة في اللعب"}</span></div>
    <div class="effp-top"><b dir="ltr" data-effpc="eff">${fmt(c.eff)}</b>${c.dur ? `<span>من زمن المباراة <span dir="ltr" data-effpc="dur">${fmt(c.dur)}</span></span>` : ""}
      ${c.dur || c.pct!=null ? `<div class="effp-bar"><i style="width:${Math.min(100, P)}%"></i></div><em data-effpc="pct">${P}%</em>` : ""}</div>
    <div class="effp-hs">${halves}</div>
  </div>`;
}
EFF.cardHTML = cardHTML;
/* تبويب «اللعب الفعلي» في صفحة المباراة: يظهر إذا كانت المباراة مرصودة (زمن مسجّل أو شوط جارٍ) */
EFF.has = m => { const s = m && IDX.m[keyOf(m)]; return !!(s && (s.dur>0 || s.live)); };
function mpInject(){
  const box = document.getElementById("mpage");
  const m = (typeof MP!=="undefined" && MP) ? MP.m : null;
  if(!box || box.hidden || !m){ mpStop(); return; }
  startIdx();
  const key = keyOf(m), has = EFF.has(m);
  /* ظهر التبويب أو اختفى بعد تحميل الفهرس: نعيد رسم الصفحة */
  if(has !== !!box.querySelector('[data-mp-tab="eff"]') && typeof renderMatchPage==="function"){ const sh = box.querySelector(".mp-sheet"), y = sh ? sh.scrollTop : 0; renderMatchPage(); const s2 = box.querySelector(".mp-sheet"); if(s2) s2.scrollTop = y; return; }
  if(!has){ mpStop(); return; }
  if(!MPW || MPW.key!==key){ mpStop(); MPW = {key, doc:null};
    if(!TEST && typeof SNAP!=="undefined" && SNAP && SNAP.get) SNAP.get(idOf(key), true).then(d=>{ if(MPW && MPW.key===key && !MPW.doc && d){ MPW.doc = d; mpPaint(); } }).catch(()=>{}); }
  if(!MPW.unsub && store.ready()) MPW.unsub = store.watch(idOf(key), d=>{ if(!MPW || MPW.key!==key) return; MPW.doc = d; mpPaint(); });
  mpPaint();
}
function mpPaint(){
  const box = document.getElementById("mpage"); if(!box || !MPW || !MPW.doc) return;
  const slot = box.querySelector("[data-effslot]"); if(!slot) return;
  const html = cardHTML(MPW.doc); const old = slot.querySelector("[data-effp]");
  if(!html){ slot.innerHTML = ""; return; }
  const t = document.createElement("div"); t.innerHTML = html; const el = t.firstElementChild;
  if(old) old.replaceWith(el); else slot.appendChild(el);
}
function mpStop(){ if(MPW && MPW.unsub) MPW.unsub(); MPW = null; }
/* تحديث الساعة في البطاقة أثناء شوط جارٍ */
setInterval(()=>{
  if(!MPW || !MPW.doc) return; const box = document.getElementById("mpage"); if(!box || box.hidden) return;
  const c = calc(MPW.doc); if(!c.live) return;
  const set = (k,v) => { const el = box.querySelector(`[data-effpc="${k}"]`); if(el) el.textContent = v; };
  set("eff", fmt(c.eff)); set("dur", fmt(c.dur)); set("pct", pct(c.eff, c.dur)+"%");
}, 1000);

/* قائمة مختصرة لكل المباريات المسجّلة (للإحصاءات): [{key,h,a,c,r,d,eff,dur,n,live}] */
EFF.list = () => Object.entries(IDX.m||{}).map(([key,v])=>Object.assign({key}, v)).filter(x=>x.dur>0);

function boot(){
  const box = document.getElementById("mpage");
  if(box) new MutationObserver(()=>mpInject()).observe(box, {childList:true});
  EFF.onIdx(()=>mpInject());
  startIdx();
  if(/^#effctl\//.test(location.hash)){ const k = location.hash.slice(8); let n = 0;
    const w = ()=>{ if(k==="tool" && canEdit() && store.ready()) EFF.openTool(); else if(k!=="tool" && canEdit() && findMatch(k) && store.ready()) EFF.open(k); else if(++n < 80) setTimeout(w, 250); }; setTimeout(w, 400); }
}
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", ()=>setTimeout(boot, 0)); else setTimeout(boot, 0);
if(!TEST){ let n = 0; const w = ()=>{ startIdx(); if(!idxOn) setTimeout(w, ++n < 120 ? 250 : 2000); }; setTimeout(w, 300); }
})();
