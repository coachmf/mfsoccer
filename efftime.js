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

const REASONS = [
  ["foul","خطأ (فاول)"], ["corner","ركنية"], ["throw","رمية تماس"], ["gk","ركلة مرمى"], ["var","مراجعة VAR"],
  ["goal","هدف"], ["sub","تبديل"], ["injury","إصابة"], ["offside","تسلل"], ["other","أخرى"]
];
const RN = Object.fromEntries(REASONS);
const PHS = [["h1","الشوط الأول"],["h2","الشوط الثاني"],["e1","الإضافي الأول"],["e2","الإضافي الثاني"]];
const PHN = Object.fromEntries(PHS);
EFF.REASONS = REASONS;

const pad = n => String(Math.floor(n)).padStart(2,"0");
const fmt = ms => { const t = Math.max(0, Math.round((ms||0)/1000)); return `${pad(t/60)}:${pad(t%60)}`; };   /* دقائق:ثوانٍ حتى بعد الساعة (99:00) كساعة الملعب */
const pct = (a,b) => b>0 ? Math.round(a/b*100) : 0;
EFF.fmt = fmt;

/* ───────────── الحساب ───────────── */
function calc(d, now){
  now = now==null ? Date.now() : now;
  const out = {ph:{}, dur:0, stop:0, eff:0, n:0, reasons:{}, longest:null, cur:null, open:null, live:false, started:false};
  if(!d) return out;
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
let IDX = {m:{}}, idxOn = false;
const idxCbs = new Set();
function startIdx(){
  if(idxOn || !store.ready()) return; idxOn = true;
  store.idxWatch(d=>{ IDX = d && d.m ? d : {m:{}}; idxCbs.forEach(f=>{ try{ f(IDX); }catch(e){} }); });
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
let S = null;   /* {key, id, doc, unsub, tick, undo:[], ph, busy, lock} */
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
  try{ await store.set(id, d); await store.idxSet(key, summary(d)); }
  catch(e){ console.error(e); say("تعذّر الحفظ: "+(e.code||e.message), "err"); }
  finally{ if(S && S.id===id) S.saving--; }
}
function act(a, arg){
  if(!S || !S.doc) return;
  const now = Date.now(), p = S.ph, hs = S.doc.halves || {}, h = hs[p];
  const open = (S.doc.stops||[]).find(x=>x.ph===p && !x.e);
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
  if(a==="reopen"){
    if(!h || !h.e) return;
    if(!confirm(`إعادة فتح ${PHN[p]}؟ (نهايته تُلغى والساعة تكمل من الآن)`)) return;
    commit(d=>{ delete d.halves[p].e; }); return;
  }
}

function paint(){
  if(!S || !S.root) return;
  const d = S.doc; if(!d){ return; }
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
      <div class="eff-ttl"><b>${H(d.home)} × ${H(d.away)}</b><small>الوقت الفعلي للعب · ${H(d.comp||"")} · ${H(rndLbl(d))}</small></div>
      <button type="button" class="eff-undo" data-eff="undo"${S.undo.length ? "" : " disabled"}>تراجع</button>
    </header>
    <nav class="eff-seg">${seg}</nav>
    <section class="eff-clocks st-${state}">
      <div><span>زمن ${PHN[p]}</span><b data-effc="dur" dir="ltr">${fmt(ph ? ph.dur : 0)}</b></div>
      <div class="eff-main"><span>اللعب الفعلي</span><b data-effc="eff" dir="ltr">${fmt(ph ? ph.eff : 0)}</b><i data-effc="pct">${ph ? pct(ph.eff, ph.dur) : 0}%</i></div>
      <div><span>التوقفات</span><b data-effc="stop" dir="ltr">${fmt(ph ? ph.stop : 0)}</b></div>
    </section>
    <div class="eff-status st-${state}">${state==="pre" ? "لم يبدأ" : state==="done" ? "انتهى" : state==="stop" ? `متوقف — ${H(RN[open.r]||open.r)} <span dir="ltr" data-effc="open">${fmt(Date.now()-open.s)}</span>` : "الكرة في اللعب"}</div>
    <section class="eff-act">${main}</section>
    ${state==="play" || state==="stop" ? `<div class="eff-row"><button type="button" class="eff-end" data-eff="end">نهاية ${PHN[p]}</button></div>` : ""}
    ${list.length ? `<section class="eff-card"><h4>توقفات ${PHN[p]} (${list.length})</h4><ul class="eff-list">${rows}</ul></section>` : ""}
    ${c.started ? `<section class="eff-card"><h4>المباراة كلها</h4>
      <div class="eff-sum"><div><span>اللعب الفعلي</span><b dir="ltr" data-effc="teff">${fmt(c.eff)}</b></div><div><span>الزمن الكلي</span><b dir="ltr" data-effc="tdur">${fmt(c.dur)}</b></div><div><span>النسبة</span><b data-effc="tpct">${pct(c.eff, c.dur)}%</b></div><div><span>عدد التوقفات</span><b>${c.n}</b></div></div>
      ${rs.length ? `<ul class="eff-rs">${rs.map(([k,v])=>`<li><b>${H(RN[k]||k)}</b><span>${v.n} مرة</span><em dir="ltr">${fmt(v.t)}</em></li>`).join("")}</ul>` : ""}</section>` : ""}
    <div class="eff-row tools">${h ? (h.e ? `<button type="button" class="eff-ghost" data-eff="reopen">إعادة فتح ${PHN[p]}</button>` : "") + `<button type="button" class="eff-ghost danger" data-eff="reset">مسح ${PHN[p]}</button>` : ""}</div>
    <p class="eff-foot">مستقلة عن أحداث المباراة: لا تُسجَّل هنا أهداف ولا بطاقات، ولا تدخل في الإحصاءات أو الترتيب أو الفانتسي.</p>
  </div>`;
}
function paintClock(){
  if(!S || !S.root || !S.doc) return;
  const c = calc(S.doc), ph = c.ph[S.ph]; if(!ph || !ph.live) return;
  const set = (k, v) => { const el = S.root.querySelector(`[data-effc="${k}"]`); if(el) el.textContent = v; };
  set("dur", fmt(ph.dur)); set("eff", fmt(ph.eff)); set("stop", fmt(ph.stop)); set("pct", pct(ph.eff, ph.dur)+"%");
  set("teff", fmt(c.eff)); set("tdur", fmt(c.dur)); set("tpct", pct(c.eff, c.dur)+"%");
  const open = (S.doc.stops||[]).find(x=>x.ph===S.ph && !x.e); if(open) set("open", fmt(Date.now()-open.s));
}
document.addEventListener("click", e=>{
  const o = e.target.closest && e.target.closest("[data-eff-open]");
  if(o){ e.preventDefault(); EFF.open(o.dataset.effOpen); return; }
  if(!S || !S.root || !S.root.contains(e.target)) return;
  const b = e.target.closest("[data-eff]"); if(!b || b.disabled) return;
  const a = b.dataset.eff, v = b.dataset.v;
  if(a==="close"){ EFF.close(); return; }
  if(a==="ph"){ S.ph = v; paint(); return; }
  act(a, v);
});
document.addEventListener("keydown", e=>{
  if(!S || !S.doc || e.target.closest("input,textarea,select")) return;
  if(e.key===" "){ const open = (S.doc.stops||[]).find(x=>x.ph===S.ph && !x.e); if(open){ e.preventDefault(); act("go"); } }
  if(e.key==="Escape") EFF.close();
});

/* ───────────── صفحة المباراة: بطاقة «الوقت الفعلي للعب» في تبويب التفاصيل ───────────── */
let MPW = null;   /* {key, unsub, doc} */
function cardHTML(d, live){
  const c = calc(d); if(!c.started) return "";
  const rs = Object.entries(c.reasons).sort((a,b)=>b[1].t-a[1].t), mx = rs.length ? rs[0][1].t : 1;
  const halves = PHS.filter(([p])=>c.ph[p]).map(([p,t])=>{ const x = c.ph[p];
    return `<div class="effp-h"><span>${t}${x.live ? `<i class="effp-live">جارٍ</i>` : ""}</span><b dir="ltr">${fmt(x.eff)}</b><small>من <bdi dir="ltr">${fmt(x.dur)}</bdi> · <bdi dir="ltr">${pct(x.eff, x.dur)}%</bdi></small></div>`; }).join("");
  return `<div class="mp-card effp" data-effp="1">
    <div class="mp-hd"><h3>الوقت الفعلي للعب</h3><span class="mp-sub">${c.live ? "يُحدَّث مباشرة" : "زمن الكرة في اللعب"}</span></div>
    <div class="effp-top"><b dir="ltr" data-effpc="eff">${fmt(c.eff)}</b><span>من زمن المباراة <span dir="ltr" data-effpc="dur">${fmt(c.dur)}</span></span>
      <div class="effp-bar"><i style="width:${pct(c.eff, c.dur)}%"></i></div><em data-effpc="pct">${pct(c.eff, c.dur)}%</em></div>
    <div class="effp-hs">${halves}</div>
    ${rs.length ? `<div class="effp-rh">التوقفات <span>${c.n} توقفاً · <bdi dir="ltr">${fmt(c.stop)}</bdi></span></div>
    <ul class="effp-rs">${rs.map(([k,v])=>`<li><span class="n">${H(RN[k]||k)}</span><span class="c">${v.n}</span><span class="b"><i style="width:${Math.max(4, Math.round(v.t/mx*100))}%"></i></span><span class="t" dir="ltr">${fmt(v.t)}</span></li>`).join("")}</ul>` : ""}
    ${c.longest ? `<p class="effp-note">أطول توقف: ${H(RN[c.longest.r]||c.longest.r)} — <span dir="ltr">${fmt(c.longest.t)}</span> (${PHN[c.longest.ph]})</p>` : ""}
  </div>`;
}
EFF.cardHTML = cardHTML;
function mpInject(){
  const box = document.getElementById("mpage");
  const m = (typeof MP!=="undefined" && MP) ? MP.m : null;
  if(!box || box.hidden || !m){ mpStop(); return; }
  const key = keyOf(m);
  const tab = box.querySelector('[data-mp-tab][aria-pressed="true"]');
  const onDetails = !tab || tab.dataset.mpTab==="details";
  if(!IDX.m[key]){ mpStop(); return; }
  if(!MPW || MPW.key!==key){ mpStop(); MPW = {key, doc:null};
    MPW.unsub = store.watch(idOf(key), d=>{ if(!MPW || MPW.key!==key) return; MPW.doc = d; mpPaint(); }); }
  if(onDetails) mpPaint();
}
function mpPaint(){
  const box = document.getElementById("mpage"); if(!box || !MPW || !MPW.doc) return;
  const tab = box.querySelector('[data-mp-tab][aria-pressed="true"]');
  if(tab && tab.dataset.mpTab!=="details") return;
  const body = box.querySelector(".mp-body"); if(!body) return;
  const html = cardHTML(MPW.doc); const old = body.querySelector("[data-effp]");
  if(!html){ if(old) old.remove(); return; }
  const t = document.createElement("div"); t.innerHTML = html; const el = t.firstElementChild;
  if(old) old.replaceWith(el); else body.appendChild(el);
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
    const w = ()=>{ if(canEdit() && findMatch(k) && store.ready()) EFF.open(k); else if(++n < 80) setTimeout(w, 250); }; setTimeout(w, 400); }
}
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", ()=>setTimeout(boot, 0)); else setTimeout(boot, 0);
if(!TEST){ let n = 0; const w = ()=>{ if(store.ready()) startIdx(); else if(++n < 120) setTimeout(w, 250); }; setTimeout(w, 300); }
})();
