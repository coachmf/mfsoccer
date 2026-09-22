/* =====================================================================
   غرفة تحكّم المباراة المباشرة — تُحمَّل عند فتحها فقط (live.js ← LIVE.loadAdmin)
   لوحة لمشغّل على الكمبيوتر: أعلى = النتيجة والساعة وأوامرها، يمين = التنقل،
   وسط = أدوات الأحداث + الملعب التفاعلي + نموذج الحدث، يسار = سجل الأحداث،
   أسفل = الخط الزمني والإحصاءات. كل تعديل معاملة آمنة على وثيقة المباراة.
   ===================================================================== */
(function(){
"use strict";
const LV = window.LIVE, U = LV.util, H = U.H, EVK = LV.EVK, ico = LV.ico;
const A = window.LIVE_ADMIN = {};
let S = null;   /* الحالة: {id,key,m,doc,unsub,untick,tool,draft,editId,sel,status,pop} */

const PHASE_OPTS = [["h1","الشوط الأول"],["h2","الشوط الثاني"],["e1","الإضافي الأول"],["e2","الإضافي الثاني"]];
const VAR_DEC = ["تأكيد القرار","إلغاء القرار","احتساب هدف","إلغاء هدف","احتساب ركلة جزاء","إلغاء ركلة جزاء","بطاقة حمراء","إلغاء بطاقة حمراء","تسلل — إلغاء الهدف"];
const BP_OPTS = ["","القدم اليمنى","القدم اليسرى","الرأس","غير ذلك"];
const livePhaseOf = c => LV.isLivePh(c.phase) ? c.phase : c.phase==="ht" ? "h1" : c.phase==="et" ? "h2" : c.phase==="ft" ? "h2" : "h1";

/* ───────────── قوائم اللاعبين ───────────── */
function roster(side, mode){
  const d = S.doc, club = side==="h" ? d.home : d.away;
  const all = U.squadList(club).sort((a,b)=>(a.s||99)-(b.s||99));
  const on = LV.onPitch(d, side);
  if(!on){   /* بلا تشكيلة: الخارجون لا يعودون، والداخلون ليسوا على الدكة */
    const sb = LV.subbed(d, side);
    if(mode==="bench") return all.filter(x=>!sb.out.has(x.n) && !sb.inn.has(x.n));
    if(mode==="on") return all.filter(x=>!sb.out.has(x.n));
    return all;
  }
  const inSet = x => on.has(x.n);
  if(mode==="bench") return all.filter(x=>!inSet(x));
  if(mode==="on") return all.filter(inSet).concat(all.filter(x=>!inSet(x)));
  return all;
}
const optVal = x => (x.s ? x.s+" · " : "") + x.n;
/* صورة اللاعب (الوجه) من مصدر الموقع نفسه — داخل سياق كأس الخليج إن كانت المباراة منها */
function photoOf(name, side){
  if(!S || !name || typeof photoCut!=="function") return "";
  const club = side==="h" ? S.doc.home : S.doc.away, f = () => { try{ return photoCut(name, club) || ""; }catch(e){ return ""; } };
  const p = (S.doc.gulf && LV.gulfCtx) ? LV.gulfCtx(f) : f();
  return p ? `${p}_f.webp?v=${S.doc.gulf ? 31 : 29}` : "";
}
/* قائمة اختيار اللاعب بالصور (بدل datalist الذي لا يعرض صوراً) */
const normAr = t => String(t||"").replace(/[أإآ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه").replace(/[٠-٩]/g, d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d)).toLowerCase();
function pkMatches(f){
  const pk = S && S.pk && S.pk[f]; if(!pk) return [];
  const inp = S.root.querySelector(f==="p" ? "#lvcP" : "#lvcP2"), q = normAr(parseName(inp ? inp.value : "")).trim();
  const exact = pk.list.some(x=>inp && inp.value===optVal(x));
  if(!q || exact) return pk.list;
  const num = /^\d+$/.test(q);
  return pk.list.filter(x=> num ? String(x.s||"").startsWith(q) : normAr(x.n).includes(q) || (x.s && String(x.s)===q));
}
function pkPaint(f, open){
  const box = S && S.root && S.root.querySelector("#lvcPK_"+f); if(!box) return;
  const pk = S.pk[f]; if(!open || !pk || !pk.list.length){ box.hidden = true; box.innerHTML = ""; return; }
  const L = pkMatches(f); pk.hi = Math.max(0, Math.min(pk.hi||0, L.length-1));
  if(!L.length){ box.hidden = false; box.innerHTML = `<div class="lvc-pk-empty">لا يوجد لاعب بهذا الرقم أو الاسم</div>`; return; }
  box.hidden = false;
  box.innerHTML = L.map((x,i)=>{ const ph = photoOf(x.n, pk.side), ini = H(String(x.n).trim().split(/\s+/).slice(0,2).map(w=>w[0]||"").join(""));
    return `<button type="button" class="lvc-pk-o${i===pk.hi?" hi":""}" data-pk="${f}" data-i="${i}" tabindex="-1">
      <span class="ph">${ph?`<img src="${H(ph)}" alt="" loading="lazy" onerror="this.remove()">`:""}<i>${ini}</i></span>
      <b>${H(x.n)}</b>${x.s?`<em>${x.s}</em>`:""}</button>`; }).join("");
  const hi = box.querySelector(".hi"); if(hi) hi.scrollIntoView({block:"nearest"});
}
function pkPick(f, i){
  const L = pkMatches(f), x = L[i]; if(!x) return;
  const inp = S.root.querySelector(f==="p" ? "#lvcP" : "#lvcP2"); if(inp){ inp.value = optVal(x); inp.dataset.entered = "1"; }
  pkPaint(f, false);
  const nx = f==="p" ? (S.root.querySelector("#lvcP2") || S.root.querySelector("#lvcNote")) : S.root.querySelector("#lvcNote");
  if(nx) nx.focus();
}
const pkField = el => el && el.id==="lvcP" ? "p" : el && el.id==="lvcP2" ? "p2" : null;
document.addEventListener("focusin", e=>{ const f = pkField(e.target); if(f && S && S.pk){ S.pk[f].hi = 0; pkPaint(f, true); const b = S.root.querySelector("#lvcPK_"+f); if(b && !b.hidden) setTimeout(()=>b.scrollIntoView({block:"nearest", behavior:"smooth"}), 30); } });
document.addEventListener("focusout", e=>{ const f = pkField(e.target); if(f) setTimeout(()=>{ if(S && S.root && document.activeElement!==e.target) pkPaint(f, false); }, 120); });
document.addEventListener("input", e=>{ const f = pkField(e.target); if(f && S && S.pk){ e.target.dataset.entered = ""; S.pk[f].hi = 0; pkPaint(f, true); } });
document.addEventListener("mousedown", e=>{ const o = e.target.closest && e.target.closest(".lvc-pk-o"); if(!o || !S) return; e.preventDefault(); pkPick(o.dataset.pk, +o.dataset.i); });
/* الأسهم وEnter داخل القائمة — قبل اختصارات اللوحة (Enter = حفظ الحدث) */
document.addEventListener("keydown", e=>{
  const f = pkField(e.target); if(!f || !S || !S.pk) return;
  const box = S.root.querySelector("#lvcPK_"+f), open = box && !box.hidden && box.querySelector(".lvc-pk-o");
  if(e.key==="ArrowDown" || e.key==="ArrowUp"){ e.preventDefault(); if(!open){ pkPaint(f, true); return; } const n = pkMatches(f).length; S.pk[f].hi = (S.pk[f].hi + (e.key==="ArrowDown"?1:-1) + n) % n; pkPaint(f, true); e.stopImmediatePropagation(); return; }
  if(e.key==="Enter" && open && !e.target.dataset.entered && e.target.value.trim()){ e.preventDefault(); e.stopImmediatePropagation(); pkPick(f, S.pk[f].hi||0); return; }
  if(e.key==="Escape" && open){ e.preventDefault(); e.stopImmediatePropagation(); pkPaint(f, false); }
}, true);
const parseName = v => String(v||"").replace(/^\s*\d+\s*·\s*/, "").trim();
function listFor(field, def, team){
  if(!team) return [];
  const opp = team==="h" ? "a" : "h";
  if(field==="p"){
    if(def.pOpp) return roster(opp, "on");
    if(def.k==="sub") return roster(team, "on");
    return roster(team, "on");
  }
  if(def.k==="sub") return roster(team, "bench");
  if(def.p2opp || def.k==="foul") return roster(opp, "on");
  return roster(team, "on");
}

/* ───────────── الهيكل ───────────── */
function shell(){
  const d = S.doc, m = S.m;
  return `<div class="lvc" dir="rtl">
  <header class="lvc-top">
    <button type="button" class="lvc-exit" data-a="exit" title="خروج (يبقى البث قائماً)">${ico("close")}</button>
    <div class="lvc-sb">
      <div class="lvc-team h">${U.crestOf(d.home)}<b>${H(d.home)}</b></div>
      <div class="lvc-score"><b id="lvcSh">0</b><i>-</i><b id="lvcSa">0</b></div>
      <div class="lvc-team a"><b>${H(d.away)}</b>${U.crestOf(d.away)}</div>
    </div>
    <div class="lvc-clockbox"><small class="lvc-clk-t">وقت المباراة</small><div class="lvc-clock" dir="ltr" id="lvcClock">00:00</div><div class="lvc-ph" id="lvcPh"></div></div>
    <button type="button" class="lvc-effbox" id="lvcEff" data-a="efftoggle" title="الوقت الفعلي — Space للإيقاف/الاستئناف">
      <small class="lvc-clk-t">الوقت الفعلي</small><div class="lvc-effclk" dir="ltr" id="lvcEffClk">00:00</div>
      <div class="lvc-effst" id="lvcEffSt"></div></button>
    <div class="lvc-cc" id="lvcCC"></div>
    <div class="lvc-topr">
      <button type="button" class="lvc-undo" data-a="undo" title="تراجع (Ctrl+Z)">${ico("undo")}<span>تراجع</span></button>
      <span class="lvc-status" id="lvcStatus"></span><span class="lvc-rec" id="lvcRec"></span>
    </div>
  </header>
  <aside class="lvc-nav">
    <div class="lvc-nav-g">
      <button type="button" class="on" data-a="nav-ctl">${ico("play")}<span>التحكم المباشر</span></button>
      <button type="button" data-a="public">${ico("pin")}<span>صفحة الجمهور</span></button>
      <button type="button" data-a="settings">${ico("edit")}<span>الإعدادات</span></button>
    </div>
    <div class="lvc-nav-t">مباريات قريبة</div>
    <div class="lvc-nav-list" id="lvcMatches"></div>
    <div class="lvc-keys"><div class="lvc-nav-t">اختصارات</div>
      <p><kbd>G</kbd> هدف <kbd>Y</kbd> إنذار <kbd>R</kbd> طرد <kbd>S</kbd> تبديل <kbd>C</kbd> ركنية <kbd>T</kbd> تماس <kbd>K</kbd> ركلة مرمى <kbd>U</kbd> خطأ <kbd>F</kbd> تسلل <kbd>O</kbd>/<kbd>X</kbd> تسديدة على/خارج <kbd>V</kbd> تصدٍّ <kbd>A</kbd> VAR <kbd>I</kbd> إصابة</p>
      <p><kbd>1</kbd>/<kbd>2</kbd> الفريق · <kbd>Enter</kbd> حفظ · <kbd>Esc</kbd> إلغاء · <kbd>Space</kbd> إيقاف/استئناف · <kbd>Ctrl</kbd>+<kbd>Z</kbd> تراجع</p></div>
    ${LV.TEST?`<div class="lvc-test">وضع الاختبار المحلي — لا يُكتب شيء في قاعدة البيانات الحقيقية</div>`:""}
  </aside>
  <main class="lvc-center">
    <div class="lvc-tools" id="lvcTools">${toolsHTML()}</div>
    <div class="lvc-stage">
      <div class="lvc-pitchbox lv-3d" id="lvcPitchBox">${LV.stadiumHTML("ctl")}<div class="lvc-pop" id="lvcPop" hidden></div>
        <div class="lvc-hint" id="lvcHint">انقر على الملعب: خط التماس ← رمية، الزاوية ← ركنية، خط المرمى ← ركلة مرمى، أو اختر حدثاً أولاً.</div></div>
      <div class="lvc-comp" id="lvcComp"></div>
    </div>
  </main>
  <aside class="lvc-feed">
    <div class="lvc-feed-hd"><h3>سجل الأحداث</h3><span id="lvcCount"></span></div>
    <div class="lvc-seg" id="lvcFeedF"><button type="button" data-f="all" aria-pressed="true">الكل</button><button type="button" data-f="major" aria-pressed="false">الرئيسية</button><button type="button" data-f="h" aria-pressed="false">${U.crestOf(d.home)}</button><button type="button" data-f="a" aria-pressed="false">${U.crestOf(d.away)}</button></div>
    <div class="lv-feed" id="lvcFeed"></div>
  </aside>
  <footer class="lvc-bottom">
    <div class="lvc-b-tl"><div class="lvc-b-hd">الخط الزمني</div><div id="lvcHtl"></div></div>
    <div class="lvc-b-st"><div class="lvc-b-hd">الإحصاءات <small>من الأحداث المُدخلة فقط</small></div><div id="lvcStats"></div></div>
  </footer>
  <div class="lv-toasts lvc-toasts" id="lvcToasts"></div>
  <div class="lvc-modal" id="lvcModal" hidden></div>
</div>`;
}
function toolsHTML(){
  return U.TOOL_GROUPS.map(([g, t])=>`<div class="lvc-tg"><span class="lvc-tg-t">${t}</span><div class="lvc-tg-b">${
    LV.EV.filter(e=>e.g===g).map(e=>`<button type="button" class="lvc-tool k-${e.k}" data-tool="${e.k}" title="${H(e.t)}${e.key?" ("+e.key.toUpperCase()+")":""}">${ico(e.ic)}<span>${H(e.t)}</span>${e.key?`<kbd>${e.key.toUpperCase()}</kbd>`:""}</button>`).join("")}</div></div>`).join("");
}

/* ───────────── الرسم ───────────── */
function paint(){
  if(!S || !S.root) return;
  const d = S.doc; if(!d) return;
  const s = LV.score(d);
  const sh = S.root.querySelector("#lvcSh"), sa = S.root.querySelector("#lvcSa");
  if(sh.textContent!==String(s.h)){ sh.textContent=s.h; sh.classList.remove("bump"); void sh.offsetWidth; sh.classList.add("bump"); }
  if(sa.textContent!==String(s.a)){ sa.textContent=s.a; sa.classList.remove("bump"); void sa.offsetWidth; sa.classList.add("bump"); }
  paintClock();
  S.root.querySelector("#lvcCC").innerHTML = clockControlsHTML(d.clock);
  const ev = U.sortEvents(U.activeEvents(d));
  /* الأحداث الجديدة (من هذا الجهاز أو مشغّل آخر): نبضة على العلامة والسطر */
  let flash = null; if(S.seen) ev.forEach(e=>{ if(!S.seen.has(e.id)) flash=e.id; }); S.seen = new Set(ev.map(e=>e.id));
  const pbox = S.root.querySelector("#lvcPitchBox");
  pbox.querySelector(".lv-marks").innerHTML = LV.markersStad(d, {flash, sel:S.sel || S.editId});
  pbox.querySelector(".lv-dirs").innerHTML = LV.dirsStad(d, livePhaseOf(d.clock));
  LV.paintCrowd(pbox, d);
  if(flash){ const fe = ev.find(e=>e.id===flash); if(fe && (fe.k==="goal"||fe.k==="og")) LV.cheer(pbox, d, fe.team); }
  paintGhost();
  const f = S.feedF || "all";
  const list = ev.slice().reverse().filter(e=> f==="all" ? true : f==="major" ? (EVK[e.k]||{}).major : e.team===f);
  S.root.querySelector("#lvcFeed").innerHTML = list.length ? list.map(e=>LV.evRowHTML(d, e, true)).join("") : `<div class="lv-empty">لا أحداث بعد. ابدأ المباراة ثم سجّل الأحداث من الملعب.</div>`;
  if(flash){ const r=S.root.querySelector(`#lvcFeed [data-ev="${flash}"]`); if(r) r.classList.add("new"); }
  const sel = S.sel || S.editId; if(sel){ const r=S.root.querySelector(`#lvcFeed [data-ev="${sel}"]`); if(r) r.classList.add("sel"); }
  S.root.querySelector("#lvcCount").textContent = ev.filter(e=>!(EVK[e.k]||{}).sys).length + " حدث";
  S.root.querySelector("#lvcHtl").innerHTML = LV.hTimelineHTML(d);
  S.root.querySelector("#lvcStats").innerHTML = LV.statsHTML(d);
  S.root.querySelector(".lvc-undo").disabled = !(d.ops||[]).length;
  if(d.detached){ const r=S.root.querySelector("#lvcRec"); if(r && !r.classList.contains("off")) setRec("off"); }
  paintMatches();
}
function paintClock(){
  if(!S || !S.doc || !S.root) return;
  const c = S.doc.clock;
  S.root.querySelector("#lvcClock").textContent = LV.clockLabel(c);
  const ph = S.root.querySelector("#lvcPh");
  const add = c.added && c.added[livePhaseOf(c)];
  ph.innerHTML = `${c.running?'<i class="lv-dot"></i>':""}${H(LV.PH[c.phase]||"")}${add?` · <b>+${add}</b>`:""}${LV.isLivePh(c.phase)&&!c.running?' · <em>متوقفة</em>':""}`;
  S.root.querySelector(".lvc-clockbox").classList.toggle("run", !!c.running);
  const ei = LV.effInfo(c), eb = S.root.querySelector("#lvcEff");
  if(eb){ const live = LV.isLivePh(c.phase) && c.running;
    S.root.querySelector("#lvcEffClk").textContent = LV.fmtS(ei.cur);
    S.root.querySelector("#lvcEffSt").innerHTML = !live ? `<span>المهدر ${LV.fmtS(ei.waste)}</span>` : ei.run
      ? `<span class="on"><i></i>الكرة في اللعب</span><span>المهدر ${LV.fmtS(ei.waste)}</span>`
      : `<span class="off"><i></i>متوقف — اضغط للاستئناف</span><span>المهدر ${LV.fmtS(ei.waste)}</span>`;
    eb.classList.toggle("run", live && ei.run); eb.classList.toggle("stop", live && !ei.run); eb.disabled = !live; }
  if(S.draft && !S.editId && S.draft.live){ const t=Math.floor(LV.elapsed(c)); const inp=S.root.querySelector("#lvcT"); if(inp && document.activeElement!==inp){ inp.value=fmtT(t); S.draft.t=t; S.draft.ph=livePhaseOf(c); const ps=S.root.querySelector("#lvcPhSel"); if(ps) ps.value=S.draft.ph; } }
}
function clockControlsHTML(c){
  const b = (a, t, cls, ic) => `<button type="button" class="lvc-cbtn ${cls||""}" data-clk="${a}">${ic?ico(ic):""}<span>${t}</span></button>`;
  const run = c.running ? b("pause","إيقاف المباراة","warn","pause") : (LV.isLivePh(c.phase) ? b("resume","استئناف المباراة","go","resume") : "");
  let main = "";
  switch(c.phase){
    case "pre": main = b("kickoff","بدء المباراة","go big","play"); break;
    case "h1": main = run + b("ht","نهاية الشوط الأول","", "ht"); break;
    case "ht": main = b("h2","بدء الشوط الثاني","go big","play") + b("ft","إنهاء المباراة","", "ft"); break;
    case "h2": main = run + b("ft","نهاية المباراة","stop","ft") + b("et","أشواط إضافية",""); break;
    case "et": main = b("e1","بدء الإضافي الأول","go big","play") + b("ft","إنهاء المباراة","", "ft"); break;
    case "e1": main = run + b("e2","بدء الإضافي الثاني","", "play"); break;
    case "e2": main = run + b("ft","نهاية المباراة","stop","ft"); break;
    case "ft": main = `<span class="lvc-ftlbl">${ico("ft")} انتهت المباراة</span>`; break;
  }
  const adj = c.phase==="pre" ? "" : `<div class="lvc-adj">
      <label title="وقت بدل ضائع للشوط الحالي">+<input type="number" min="0" max="30" id="lvcAdd" value="${(c.added&&c.added[livePhaseOf(c)])||""}" placeholder="بدل"></label><button type="button" data-clk="added">بدل ضائع</button>
      <label title="تصحيح الساعة يدوياً"><input type="text" id="lvcSet" inputmode="numeric" placeholder="mm:ss" dir="ltr"></label><button type="button" data-clk="set">تصحيح الوقت</button></div>`;
  return `<div class="lvc-cc-main">${main}</div>${adj}`;
}
function paintMatches(){
  const box = S.root.querySelector("#lvcMatches"); if(!box || box.dataset.done && !S.idxDirty) return;
  S.idxDirty = false; box.dataset.done = 1;
  box.innerHTML = LV.nearMatches().map(m=>{ const k=LV.keyOf(m), L=LV.liveOf(m);
    return `<button type="button" class="lvc-m${k===S.key?" on":""}" data-open="${H(k)}">${U.crestOf(m.home)}<span>${H(m.home)} × ${H(m.away)}<i>${L?(LV.isLivePh(L.phase)?"مباشر · ":"")+L.hg+"-"+L.ag:(m.date||"")}</i></span>${U.crestOf(m.away)}</button>`; }).join("");
}
A.onIdx = () => { if(S){ S.idxDirty = true; if(S.root) paintMatches(); } };

/* ───────────── نموذج الحدث ───────────── */
const fmtT = t => `${String(Math.floor(t/60)).padStart(2,"0")}:${String(Math.floor(t%60)).padStart(2,"0")}`;
function parseT(v){ const m=/^\s*(\d{1,3})(?::(\d{1,2}))?\s*$/.exec(String(v||"")); if(!m) return null; return (+m[1])*60 + (+(m[2]||0)); }
/* أحداث توقف اللعب: الضغط عليها يوقف الوقت الفعلي فوراً، والضغط عليها مرة ثانية (أو زر الوقت الفعلي) يستأنفه */
const STOP_K = new Set(["throw","corner","gk","fk","foul","handball","danger","offside","injury","medical","water","var","vard","goal","og","yellow","red","yr","sub","pen","penmiss","pensave","shotoff","custom"]);
function effCmd(a){ const c = S.doc && S.doc.clock; if(!c || !c.running || !LV.isLivePh(c.phase)) return;
  const on = LV.effInfo(c).run; if((a==="effstop" && !on) || (a==="effgo" && on)) return;
  LV.cmd.clock(S.id, a).then(()=>{ paintClock(); }).catch(e=>{ console.error(e); setStatus("err", e.code||e.message); }); }
function startDraft(k, loc){
  const def = EVK[k]; if(!def) return;
  if(STOP_K.has(k)){ effCmd("effstop"); S.stopTool = k; }
  if(k==="added"){ const inp=S.root.querySelector("#lvcAdd"); if(inp){ inp.focus(); inp.select(); } else toast("ابدأ المباراة أولاً", "err"); return; }
  const c = S.doc.clock, t = Math.floor(LV.elapsed(c));
  S.editId = null; S.tool = k;
  S.draft = {k, t, ph:livePhaseOf(c), team:S.lastTeam && def.team ? "" : "", p:"", p2:"", note:"", live:c.running, x:null, y:null, zone:""};
  if(loc) applyLoc(loc);
  closePop(); paintComposer(); paintTools(); paintGhost();
}
function editDraft(id){
  const e = (S.doc.events||[]).find(x=>x.id===id); if(!e) return;
  S.editId = id; S.sel = id; S.tool = e.k;
  S.draft = Object.assign({p:"",p2:"",note:"",x:null,y:null,zone:""}, U.clone(e), {live:false});
  closePop(); paintComposer(); paintTools(); paint();
}
function applyLoc(loc){
  const d = S.draft; if(!d) return;
  d.x = loc.x; d.y = loc.y; d.zone = loc.zone.ar;
  if(!d.team){ const g = U.guessTeam(S.doc, d.k, loc.zone, d.ph); if(g) d.team = g; }
}
function paintTools(){ S.root.querySelectorAll("[data-tool]").forEach(b=>b.classList.toggle("on", b.dataset.tool===S.tool)); }
function paintGhost(){
  const g = S.root && S.root.querySelector("#lvcPitchBox .lv-ghost"); if(!g) return;
  const d = S.draft; if(!d || d.x==null){ g.innerHTML=""; return; }
  g.innerHTML = LV.ghostStad(d.x, d.y, d.k);
}
function paintComposer(){
  const box = S.root.querySelector("#lvcComp"), d = S.draft;
  const hint = S.root.querySelector("#lvcHint");
  if(!d){ box.innerHTML = `<div class="lvc-comp-idle">${ico("pin")}<p>اختر حدثاً من الأدوات أو انقر مباشرة على الملعب.</p></div>`; box.classList.remove("on"); if(hint) hint.hidden=false; return; }
  if(hint) hint.hidden = true;
  const def = EVK[d.k];
  const teamBtn = s => { const n = s==="h" ? S.doc.home : S.doc.away; return `<button type="button" class="lvc-teambtn${d.team===s?" on":""}" data-team="${s}">${U.crestOf(n)}<span>${H(n)}</span><kbd>${s==="h"?1:2}</kbd></button>`; };
  const pList = listFor("p", def, d.team), p2List = listFor("p2", def, d.team);
  const opp = d.team==="h" ? "a" : "h";
  S.pk = {p:{list:pList, side: def.pOpp ? opp : d.team, hi:0},
          p2:{list:p2List, side: def.k==="sub" ? d.team : (def.p2opp || def.k==="foul") ? opp : d.team, hi:0}};
  const typeSel = S.editId ? `<label class="lvc-f"><span>نوع الحدث</span><select id="lvcType">${LV.EV.filter(e=>!e.sys||e.k===d.k).map(e=>`<option value="${e.k}"${e.k===d.k?" selected":""}>${H(e.t)}</option>`).join("")}</select></label>` : "";
  const locTxt = d.x!=null ? `<span class="lvc-loc on">${ico("pin")}${H(d.zone||"")}<button type="button" data-a="clearloc" title="إزالة المكان">${ico("close")}</button></span>`
                          : def.loc ? `<span class="lvc-loc">${ico("pin")}انقر على الملعب لتحديد المكان (اختياري)</span>` : "";
  box.classList.add("on");
  box.innerHTML = `<div class="lvc-comp-hd k-${d.k}"><span class="lvc-comp-ic">${ico(def.ic)}</span><div><h3>${S.editId?"تعديل: ":""}${H(def.t)}</h3>${locTxt}</div>
      <button type="button" class="lvc-x" data-a="cancel" title="إلغاء (Esc)">${ico("close")}</button></div>
    <div class="lvc-comp-b">
      ${typeSel}
      <div class="lvc-row">
        <label class="lvc-f t"><span>الوقت</span><div class="lvc-time"><input id="lvcT" dir="ltr" value="${fmtT(+d.t||0)}" inputmode="numeric"><button type="button" data-a="now" title="الوقت الحالي">الآن</button></div></label>
        <label class="lvc-f"><span>المرحلة</span><select id="lvcPhSel">${PHASE_OPTS.map(([k,t])=>`<option value="${k}"${k===d.ph?" selected":""}>${t}</option>`).join("")}</select></label>
      </div>
      ${(def.team||def.optTeam)?`<div class="lvc-f"><span>${def.k==="og"?"الفريق المستفيد":def.k==="save"?"فريق الحارس":"الفريق"}${def.optTeam?" (اختياري)":""}</span><div class="lvc-teams">${teamBtn("h")}${teamBtn("a")}</div></div>`:""}
      ${def.p?`<div class="lvc-f lvc-pf"><span>${H(def.p)}</span><input id="lvcP" value="${H(d.p)}" placeholder="${d.team?"اكتب الرقم أو الاسم":"اختر الفريق أولاً"}" autocomplete="off"><div class="lvc-pk" id="lvcPK_p" hidden></div></div>`:""}
      ${def.p2?`<div class="lvc-f lvc-pf"><span>${H(def.p2)}${def.k==="goal"?" (اختياري)":""}</span><input id="lvcP2" value="${H(d.p2)}" placeholder="${def.k==="goal"?"بدون صناعة":"اكتب الرقم أو الاسم"}" autocomplete="off"><div class="lvc-pk" id="lvcPK_p2" hidden></div></div>`:""}
      ${def.goal?goalFields(d):""}
      ${def.res?penFields(d):""}
      ${def.reason?`<label class="lvc-f"><span>السبب (اختياري)</span><input id="lvcReason" value="${H(d.reason||"")}" list="lvcRL" autocomplete="off"><datalist id="lvcRL"><option value="تكتيكي"><option value="إصابة"><option value="إرهاق"></datalist></label>`:""}
      ${def.dec?`<label class="lvc-f"><span>القرار</span><select id="lvcDec">${["",...VAR_DEC].map(o=>`<option value="${H(o)}"${(d.dec||"")===o?" selected":""}>${o||"—"}</option>`).join("")}</select></label>`:""}
      <label class="lvc-f"><span>${H(def.note||"ملاحظة (اختياري)")}</span><input id="lvcNote" value="${H(d.note||"")}" autocomplete="off"></label>
      <div class="lvc-err" id="lvcErr"></div>
    </div>
    <div class="lvc-comp-f"><button type="button" class="lvc-save" data-a="save">${S.editId?"حفظ التعديل":"حفظ الحدث"} <kbd>Enter</kbd></button><button type="button" class="lvc-cancel" data-a="cancel">إلغاء</button>
      ${S.editId?`<button type="button" class="lvc-delbtn" data-lv-del="${H(S.editId)}">${ico("del")}حذف</button>`:""}</div>`;
  const first = !d.team && (def.team) ? null : box.querySelector("#lvcP") || box.querySelector("#lvcNote");
  if(first && !S.editId) setTimeout(()=>first.focus(), 0);
}
/* تفاصيل الهدف = حقول المحرّر اليدوي نفسها (LIST.det / LIST.bp / LIST.zone) — التفصيل مطلوب كما في السجل */
const LISTS = () => (typeof LIST==="object" && LIST) || {det:[], bp:[], zone:[], penres:[]};
const chipRow = (key, list, cur) => `<div class="lvc-chips" data-chips="${key}">${list.map(v=>`<button type="button" class="lvc-chip${cur===v?" on":""}" data-chip="${key}" data-val="${H(v)}">${H(v)}</button>`).join("")}</div>`;
function goalFields(d){
  const L = LISTS(), bps = (L.bp||[]).filter(v=>v!=="هدف عكسي");
  return `${d.k==="goal"?`<label class="lvc-chk"><input type="checkbox" id="lvcPen"${d.pen?" checked":""}> من ركلة جزاء</label>`:""}
    <div class="lvc-f"><span>تفصيل الهجمة (مطلوب)</span>${chipRow("det", L.det||[], d.det||"")}</div>
    ${d.k==="goal"?`<div class="lvc-f"><span>طريقة التسجيل</span>${chipRow("bp", bps, d.bp||"")}</div>`:""}
    <label class="lvc-f"><span>منطقة التسجيل</span><select id="lvcGz"><option value="">—</option>${(L.zone||[]).map(z=>`<option${(d.gz||"")===z?" selected":""}>${H(z)}</option>`).join("")}</select></label>`;
}
function penFields(d){
  const L = LISTS(), res = L.penres||[], places = (typeof PZONES!=="undefined" && PZONES) || [];
  const def = d.k==="pensave" ? "تصدى لها الحارس" : d.k==="penmiss" ? "خارج المرمى" : "";
  if(d.res==null && def) d.res = def;
  return `<div class="lvc-f"><span>نتيجة الركلة${d.k==="pen"?" (اتركها فارغة إن لم تُنفَّذ بعد)":""}</span>${chipRow("res", res, d.res||"")}</div>
    <div class="lvc-f"><span>مكان التسديد</span>${chipRow("place", places, d.place||"")}</div>`;
}
function readForm(){
  const d = S.draft, r = S.root, v = id => { const el=r.querySelector("#"+id); return el ? el.value : undefined; };
  const t = parseT(v("lvcT")); if(t!=null){ if(t!==d.t) d.live=false; d.t=t; }
  if(v("lvcPhSel")) d.ph = v("lvcPhSel");
  if(v("lvcP")!==undefined) d.p = parseName(v("lvcP"));
  if(v("lvcP2")!==undefined) d.p2 = parseName(v("lvcP2"));
  if(v("lvcNote")!==undefined) d.note = v("lvcNote").trim();
  if(v("lvcReason")!==undefined) d.reason = v("lvcReason").trim();
  if(v("lvcDec")!==undefined) d.dec = v("lvcDec");
  if(v("lvcGz")!==undefined) d.gz = v("lvcGz");
  const pen = r.querySelector("#lvcPen"); if(pen) d.pen = pen.checked;
  if(v("lvcType")) d.k = v("lvcType");
}
async function save(){
  if(!S.draft) return;
  readForm();
  const d = S.draft, def = EVK[d.k], err = S.root.querySelector("#lvcErr");
  if(def.team && !d.team){ err.textContent = "اختر الفريق (1 أو 2)."; return; }
  if(d.k==="sub" && (!d.p || !d.p2)){ err.textContent = "حدّد اللاعب الخارج والداخل."; return; }
  if(d.k==="sub" && d.p===d.p2){ err.textContent = "الخارج والداخل لاعب واحد!"; return; }
  /* نفس شروط المحرّر اليدوي حتى يصلح الحدث للسجل والإحصاءات */
  if((d.k==="goal"||d.k==="og") && !d.p){ err.textContent = d.k==="og" ? "اختر من سجّل في مرماه." : "اختر المسجّل."; return; }
  if((d.k==="goal"||d.k==="og") && !d.det && !(d.k==="goal" && d.pen)){ err.textContent = "اختر تفصيل الهجمة (مطلوب لإحصاءات الأهداف)."; return; }
  if(["yellow","yr","red","chance"].includes(d.k) && !d.p){ err.textContent = "اختر اللاعب."; return; }
  if(d.k==="custom" && !d.note){ err.textContent = "اكتب وصف الحدث."; return; }
  if(d.k==="goal" && d.pen && !d.det) d.det = "ركلة جزاء";
  if(d.k==="goal" && d.p2===d.p) d.p2 = "";
  const rec = {k:d.k, t:+d.t||0, ph:d.ph, team:d.team||""};
  ["p","p2","note","reason","dec","bp","zone","det","gz","res","place"].forEach(f=>{ if(d[f]) rec[f]=d[f]; });
  if(d.k==="goal" && d.pen) rec.pen = true;
  if(d.x!=null){ rec.x=d.x; rec.y=d.y; }
  const editId = S.editId;
  S.draft = null; S.editId = null; S.tool = null; S.sel = null;
  if(d.team) S.lastTeam = d.team;
  paintComposer(); paintTools(); paintGhost();
  if(editId){
    const clean = {k:rec.k, t:rec.t, ph:rec.ph, team:rec.team, p:rec.p||"", p2:rec.p2||"", note:rec.note||"", reason:rec.reason||"", dec:rec.dec||"", bp:rec.bp||"", zone:rec.zone||"", det:rec.det||"", gz:rec.gz||"", res:rec.res||"", place:rec.place||"", pen:!!rec.pen, x:rec.x??null, y:rec.y??null};
    await run(()=>LV.cmd.editEvent(S.id, editId, clean), "عُدّل الحدث");
  } else {
    await run(()=>LV.cmd.addEvent(S.id, rec), EVK[rec.k].t+" ✓");
  }
}
function cancel(){ S.draft=null; S.editId=null; S.tool=null; S.sel=null; closePop(); paintComposer(); paintTools(); paintGhost(); paint(); }

/* ───────────── تنفيذ الأوامر مع حالة الحفظ ───────────── */
async function run(fn, okMsg){
  setStatus("saving");
  try{
    const n = await fn();
    if(n){ const sm = LV.idxSummary(n), sk = [sm.phase, sm.running, sm.hg, sm.ag, sm.base].join("|");
      if(sk!==S.idxKey){ S.idxKey = sk; LV.store.idxSet(S.id, sm).catch(()=>{}); }
      scheduleRec(n, okMsg==="نهاية المباراة"); }   /* العرض يتحدّث من لقطة الوثيقة نفسها */
    setStatus("ok"); if(okMsg) toast(okMsg, "ok");
    paint(); return n;
  }catch(e){
    console.error(e); setStatus("err", (e && (e.code||e.message)) || "");
    toast("تعذّر الحفظ — تحقّق من الاتصال أو الصلاحية", "err"); return null;
  }
}
/* بث ← سجل الموسم (الإحصاءات): مجمّعة 1.2 ث حتى لا يُكتب الموسم مع كل نقرة متتالية */
let recTimer = null, recDoc = null, recBackup = false, recBusy = false;
let recKey = null;
function scheduleRec(doc, backup){
  if(!LV.rec || doc.detached || (S && S.wiping)) return;
  /* السرعة: لا نكتب وثيقة الموسم الكبيرة إلا إذا تغيّر ما يدخل السجل (أهداف/بطاقات/تبديلات/مرحلة) — الركنيات والتماس والوقت الفعلي لا */
  let k = ""; try{ const c = doc.clock||{}; k = JSON.stringify([LV.rec.liveToRows(doc), c.phase, c.added||{}]); }catch(e){}
  if(!backup && k && k===recKey){ return; }
  recKey = k;
  recDoc = doc; recBackup = recBackup || !!backup;
  clearTimeout(recTimer); recTimer = setTimeout(flushRec, 1200);
  setRec("wait");
}
/* قبل الحذف/المسح: نلغي أي كتابة معلّقة للسجل وننتظر الجارية، حتى لا تعيد ربط المباراة بعد مسحها */
async function stopRec(){
  if(S) S.wiping = true; clearTimeout(recTimer); recDoc = null;
  for(let i=0; recBusy && i<50; i++) await new Promise(r=>setTimeout(r, 200));
}
async function flushRec(){
  if(recBusy){ recTimer = setTimeout(flushRec, 600); return; }
  const doc = (S && S.doc) || recDoc; if(!doc || (S && S.wiping)) return;
  recBusy = true; const bk = recBackup; recBackup = false;
  try{ const c = doc.clock||{}; recKey = JSON.stringify([LV.rec.liveToRows(doc), c.phase, c.added||{}]); }catch(e){}
  try{ const r = await LV.rec.push(doc, {backup:bk}); setRec(r.ok||r.test ? "ok" : r.pending ? "wait" : r.skipped ? "off" : "err"); }
  catch(e){ console.error(e); setRec("err", e.message); }
  finally{ recBusy = false; }
}
A.flushRec = flushRec;
function setRec(k, msg){
  const el = S && S.root && S.root.querySelector("#lvcRec"); if(!el) return;
  el.className = "lvc-rec "+k;
  el.innerHTML = k==="wait" ? "<i></i>مزامنة الإحصاءات…" : k==="ok" ? "<i></i>الإحصاءات محدّثة" : k==="off" ? "<i></i>غير مرتبطة بالسجل" : `<i></i>تعذّرت مزامنة الإحصاءات${msg?` — ${H(msg)}`:""}`;
}
function setStatus(k, msg){
  const el = S.root && S.root.querySelector("#lvcStatus"); if(!el) return;
  el.className = "lvc-status "+k;
  el.innerHTML = k==="saving" ? "<i></i>جارٍ الحفظ…" : k==="ok" ? "<i></i>محفوظ" : k==="err" ? `<i></i>لم يُحفظ${msg?` (${H(msg)})`:""}` : "";
}
function toast(msg, kind, undo){
  const host = S.root && S.root.querySelector("#lvcToasts"); if(!host) return;
  const el = document.createElement("div"); el.className = "lvc-toast "+(kind||"");
  el.innerHTML = `<span>${H(msg)}</span>${undo?`<button type="button">تراجع</button>`:""}`;
  if(undo) el.querySelector("button").onclick = ()=>{ el.remove(); doUndo(); };
  host.appendChild(el); setTimeout(()=>el.classList.add("out"), undo?4200:1800); setTimeout(()=>el.remove(), undo?4800:2400);
}
async function doUndo(){ const n = await run(()=>LV.cmd.undo(S.id)); if(n) toast("تم التراجع", "ok"); }
async function delEvent(id){
  const e = (S.doc.events||[]).find(x=>x.id===id); if(!e) return;
  if(S.editId===id){ S.draft=null; S.editId=null; S.tool=null; paintComposer(); }
  S.sel = null;
  const n = await run(()=>LV.cmd.delEvent(S.id, id));
  if(n) toast(`حُذف: ${(EVK[e.k]||{}).t||e.k} ${LV.minLabel(e)}`, "", true);
}
async function clockCmd(a){
  if(a==="added"){ const v=+S.root.querySelector("#lvcAdd").value; if(!(v>=0)) return; return run(()=>LV.cmd.clock(S.id, "added", v), `بدل ضائع +${v}`); }
  if(a==="set"){ const t=parseT(S.root.querySelector("#lvcSet").value); if(t==null){ toast("اكتب الوقت بصيغة mm:ss", "err"); return; } return run(()=>LV.cmd.clock(S.id, "set", t), "صُحّح الوقت إلى "+fmtT(t)); }
  if(a==="ft" && !confirm("إنهاء المباراة؟ (يمكن التراجع لاحقاً)")) return;
  const MSG = {kickoff:"انطلقت المباراة", ht:"نهاية الشوط الأول", h2:"انطلق الشوط الثاني", ft:"نهاية المباراة", pause:"أوقفت الساعة", resume:"استؤنفت المباراة", et:"أشواط إضافية", e1:"انطلق الإضافي الأول", e2:"انطلق الإضافي الثاني"};
  return run(()=>LV.cmd.clock(S.id, a), MSG[a]);
}

/* ───────────── النقر على الملعب ───────────── */
function pitchClick(ev){
  const svg = S.root.querySelector("#lvcPitchBox svg.lv-stad-svg");
  const mk = ev.target.closest(".lv-mk");
  if(mk && !S.draft){ editDraft(mk.dataset.ev); return; }
  const sp = LV.stadPoint(svg, ev); if(!sp){ closePop(); return; }   /* نقرة في المدرجات: تجاهل */
  const {mx, my} = sp;
  const zone = U.zoneOf(mx, my), n = U.toNorm(mx, my), loc = {x:n.x, y:n.y, zone};
  if(S.draft){ applyLoc(loc); paintGhost();
    /* إعادة الرسم مع الحفاظ على ما كُتب */
    readForm(); paintComposer(); return; }
  /* بلا أداة: الملعب يفهم المنطقة — حدث واحد مناسب يُفتح مباشرة، وأكثر من حدث قائمة سريعة */
  const tools = LV.ZONE_TOOLS[zone.z] || LV.ZONE_TOOLS.field;
  if(tools.length===1){ startDraft(tools[0], loc); return; }
  openPop(ev, loc, tools);
}
function openPop(ev, loc, tools){
  const pop = S.root.querySelector("#lvcPop"), box = S.root.querySelector("#lvcPitchBox").getBoundingClientRect();
  pop.innerHTML = `<div class="lvc-pop-hd">${ico("pin")}${H(loc.zone.ar)}</div>${tools.map(k=>`<button type="button" data-pop="${k}">${ico(EVK[k].ic)}<span>${H(EVK[k].t)}</span></button>`).join("")}`;
  pop.hidden = false;
  const x = ev.clientX - box.left, y = ev.clientY - box.top;
  pop.style.left = Math.min(Math.max(8, x+10), box.width-190)+"px"; pop.style.top = Math.min(Math.max(8, y-10), box.height-Math.min(box.height-16, 44+tools.length*38))+"px";
  S.pop = loc;
  /* علامة مؤقتة في مكان النقر */
  S.draft = null; const g=S.root.querySelector("#lvcPitchBox .lv-ghost");
  g.innerHTML = LV.ghostStad(loc.x, loc.y, null);
}
function closePop(){ const p=S.root && S.root.querySelector("#lvcPop"); if(p){ p.hidden=true; p.innerHTML=""; } S.pop=null; }

/* ───────────── الإعدادات والاعتماد في سجل المباراة ───────────── */
function openSettings(){
  const d = S.doc, m = S.root.querySelector("#lvcModal");
  const rightAtt = d.dir==="a" ? d.away : d.home;
  m.innerHTML = `<div class="lvc-mcard"><button type="button" class="lvc-x" data-a="closemodal">${ico("close")}</button><h3>إعدادات المباراة</h3>
    <div class="lvc-set"><h4>اتجاه اللعب في الشوط الأول</h4><p>الفريق الذي يهاجم نحو اليمين (ينقلب تلقائياً في الشوط الثاني) — يُستعمل لتخمين الفريق في الركنيات وركلات المرمى والتسديدات.</p>
      <div class="lvc-teams"><button type="button" class="lvc-teambtn${d.dir!=="a"?" on":""}" data-dir="h">${U.crestOf(d.home)}<span>${H(d.home)}</span></button><button type="button" class="lvc-teambtn${d.dir==="a"?" on":""}" data-dir="a">${U.crestOf(d.away)}<span>${H(d.away)}</span></button></div></div>
    <div class="lvc-set"><h4>الجمهور</h4><p>كثافة الحضور لكل فريق بألوانه — ${H(d.away)} في يسار المنصة الرئيسية والمدرج المجاور لها (نفس جهته في اللوحة العلوية)، و${H(d.home)} في باقي المدرجات.</p>
      ${["h","a"].map(sd=>{ const cr=LV.crowdOf(d), v=cr[sd], nm=sd==="h"?d.home:d.away; return `<div class="lvc-crowd-row"><span>${U.crestOf(nm)}${H(nm)}</span>
        <div class="lvc-crowd-pre">${[[0,"فارغ"],[20,"قليل"],[55,"متوسط"],[90,"ممتلئ"]].map(([n,t])=>`<button type="button" data-crowd="${sd}:${n}" class="${Math.abs(v-n)<8?"on":""}">${t}</button>`).join("")}</div>
        <input type="range" min="0" max="100" step="5" value="${v}" data-crowdr="${sd}"><b>${v}%</b></div>`; }).join("")}</div>
    <div class="lvc-set"><h4>الاستحواذ (يُدخل يدوياً)</h4><p>نسبة ${H(d.home)} — تُعرض للجمهور فقط إذا أُدخلت.</p>
      <div class="lvc-row"><input type="number" min="0" max="100" id="lvcPoss" value="${d.poss&&d.poss.h!=null?d.poss.h:""}" placeholder="مثلاً 55"><button type="button" class="lvc-save" data-a="poss">حفظ</button><button type="button" class="lvc-cancel" data-a="possclear">مسح</button></div></div>
    <div class="lvc-set"><h4>القناة الناقلة</h4><p>تُحفظ في بيانات المباراة نفسها وتظهر للجمهور.</p>
      <div class="lvc-row"><input id="lvcTv" list="lvcTvL" value="${H(((LV.rec&&LV.rec.recMatch(d))||{}).tv||"")}" placeholder="مثال: كويت سبورت"><datalist id="lvcTvL"><option value="كويت سبورت"><option value="كويت سبورت بلس"><option value="الكويت الأولى"><option value="غير منقولة"></datalist><button type="button" class="lvc-save" data-a="tv">حفظ</button></div></div>
    <div class="lvc-set"><h4>الربط بسجل المباراة</h4>
      ${d.detached?`<p>هذه المباراة <b>منفصلة</b> عن السجل: أحداث البث لا تدخل الإحصاءات، والسجل يُدار من المحرّر اليدوي. إعادة الربط تستورد أحداث السجل الحالية إلى البث ثم تعود المزامنة.</p>
        <button type="button" class="lvc-save" data-a="relink">إعادة الربط بالسجل</button>`
      :`<p>كل هدف وبطاقة وتبديل وركلة جزاء وفرصة وVAR وتعليق يُكتب تلقائياً في سجل المباراة الرسمي الذي تُبنى منه الإحصاءات والترتيب والفانتسي — ولا حاجة لإدخاله مرة ثانية. التعديل من المحرّر اليدوي يعود إلى هنا تلقائياً.</p>
        <button type="button" class="lvc-cancel" data-a="detach">فصل عن السجل (إدارة يدوية فقط)</button>`}</div>
    <div class="lvc-set danger"><h4>مسح اللعب الفعلي</h4>
      <div class="lvc-wipe"><button type="button" class="lvc-delbtn" data-a="wipeall">${ico("del")}مسح اللعب الفعلي بالكامل</button>
        <p>${d.detached ? `يحذف البث وكل أحداثه. المباراة منفصلة عن السجل، فسجلها اليدوي يبقى كما هو.`
          : `يحذف البث وكل أحداثه، ويمسح من سجل المباراة الأهداف والبطاقات والجزاء والتبديلات اللي دخلت منه، فترجع المباراة «لم تبدأ» 0-0. التشكيلة والحكام والقناة تبقى.`}</p></div>
      <div class="lvc-wipe"><button type="button" class="lvc-cancel" data-a="remove">${ico("del")}حذف البث فقط</button>
        <p>يحذف البث ويُبقي سجل المباراة كما هو الآن (يُفصل عن اللعب الفعلي).</p></div></div>
  </div>`;
  m.hidden = false;
}
A.toRecord = () => LV.rec.liveToRows(S.doc);

/* ───────────── الأحداث ───────────── */
function onClick(e){
  const t = e.target;
  const a = t.closest("[data-a]");
  if(a){ const k=a.dataset.a;
    if(k==="exit"){ A.close(); return; }
    if(k==="efftoggle"){ const on = LV.effInfo(S.doc.clock).run; S.stopTool=null; effCmd(on?"effstop":"effgo"); return; }
    if(k==="undo"){ doUndo(); return; }
    if(k==="save"){ if(a.closest("#lvcModal")) return settingsAction(k); save(); return; }
    if(k==="cancel"){ cancel(); return; }
    if(k==="now"){ const tt=Math.floor(LV.elapsed(S.doc.clock)); S.draft.t=tt; S.draft.ph=livePhaseOf(S.doc.clock); S.draft.live=S.doc.clock.running; readFormKeepTime(); paintComposer(); return; }
    if(k==="clearloc"){ readForm(); S.draft.x=null; S.draft.y=null; S.draft.zone=""; paintComposer(); paintGhost(); return; }
    if(k==="public"){ window.open(location.pathname + location.search + "#m/" + S.key, "_blank"); return; }
    if(k==="settings"){ openSettings(); return; }
    if(k==="nav-ctl"){ return; }
    return settingsAction(k);
  }
  const tool = t.closest("[data-tool]"); if(tool && !S.draft && S.stopTool===tool.dataset.tool && S.doc && !LV.effInfo(S.doc.clock).run && S.doc.clock.running){ S.stopTool=null; effCmd("effgo"); toast("استؤنف الوقت الفعلي","ok"); return; }
  if(tool){ const k=tool.dataset.tool; if(S.tool===k && !S.editId){ cancel(); return; } if(S.draft && S.editId){ readForm(); S.draft.k=k; S.tool=k; paintComposer(); paintTools(); paintGhost(); return; } startDraft(k, S.draft && S.draft.x!=null ? {x:S.draft.x, y:S.draft.y, zone:U.zoneOf(U.toM(S.draft.x,S.draft.y).mx, U.toM(S.draft.x,S.draft.y).my)} : null); return; }
  const pop = t.closest("[data-pop]"); if(pop){ const loc=S.pop; startDraft(pop.dataset.pop, loc); return; }
  const ch = t.closest("[data-chip]"); if(ch && S.draft){ readForm(); const k=ch.dataset.chip, v=ch.dataset.val; S.draft[k] = (S.draft[k]===v && k!=="res") ? "" : v; paintComposer(); return; }
  const tb = t.closest("[data-team]"); if(tb && S.draft){ readForm(); S.draft.team = tb.dataset.team; paintComposer(); const p=S.root.querySelector("#lvcP"); if(p) p.focus(); return; }
  const clk = t.closest("[data-clk]"); if(clk){ clockCmd(clk.dataset.clk); return; }
  const ed = t.closest("[data-lv-edit]"); if(ed){ editDraft(ed.dataset.lvEdit); return; }
  const dl = t.closest("[data-lv-del]"); if(dl){ delEvent(dl.dataset.lvDel); return; }
  const ff = t.closest("#lvcFeedF [data-f]"); if(ff){ S.feedF = ff.dataset.f; S.root.querySelectorAll("#lvcFeedF [data-f]").forEach(b=>b.setAttribute("aria-pressed", b===ff)); paint(); return; }
  const om = t.closest("[data-open]"); if(om){ if(om.dataset.open!==S.key){ try{ history.replaceState({lv:1}, "", "#livectl/"+om.dataset.open); }catch(x){} A.open(om.dataset.open); } return; }
  const cp = t.closest("[data-crowd]"); if(cp){ const [sd,n]=cp.dataset.crowd.split(":"); const c=LV.crowdOf(S.doc); c[sd]=+n; run(()=>LV.cmd.setCrowd(S.id, c), "حُدّث الجمهور").then(()=>openSettings()); return; }
  const dirb = t.closest("[data-dir]"); if(dirb){ run(()=>LV.cmd.setDir(S.id, dirb.dataset.dir), "حُدّث الاتجاه").then(()=>openSettings()); return; }
  if(t.closest("#lvcPitchBox svg.lv-stad-svg")){ pitchClick(e); return; }
  if(!t.closest("#lvcPop")) closePop();
  const row = t.closest(".lv-ev[data-ev]"); if(row){ S.sel = S.sel===row.dataset.ev ? null : row.dataset.ev; paint(); return; }
  if(t.closest("#lvcHtl [data-ev]")){ const id=t.closest("[data-ev]").dataset.ev; S.sel=id; paint(); const r=S.root.querySelector(`#lvcFeed [data-ev="${id}"]`); if(r) r.scrollIntoView({block:"nearest"}); return; }
  if(t===S.root.querySelector("#lvcModal")){ S.root.querySelector("#lvcModal").hidden=true; }
}
function readFormKeepTime(){ const t=S.draft.t, ph=S.draft.ph; readForm(); S.draft.t=t; S.draft.ph=ph; }
function settingsAction(k){
  const m = S.root.querySelector("#lvcModal");
  if(k==="closemodal"){ m.hidden=true; return; }
  if(k==="poss"){ const v=m.querySelector("#lvcPoss").value; run(()=>LV.cmd.setPoss(S.id, v), "حُفظ الاستحواذ"); m.hidden=true; return; }
  if(k==="possclear"){ run(()=>LV.cmd.setPoss(S.id, null), "مُسح الاستحواذ"); m.hidden=true; return; }
  if(k==="tv"){ const v=m.querySelector("#lvcTv").value.trim(); m.hidden=true; setRec("wait");
    LV.rec.push(S.doc, {tv:v}).then(r=>{ setRec(r.ok||r.test?"ok":"err"); toast("حُفظت القناة الناقلة","ok"); }).catch(e=>{ setRec("err", e.message); }); return; }
  if(k==="detach"){ if(!confirm("فصل هذه المباراة عن السجل؟ أحداث البث لن تدخل الإحصاءات بعد الآن، ويبقى السجل كما هو الآن.")) return; m.hidden=true;
    LV.rec.detach(S.doc).then(()=>{ toast("فُصلت المباراة — السجل يُدار يدوياً","ok"); setRec("off"); }).catch(e=>toast("تعذّر الفصل","err")); return; }
  if(k==="relink"){ m.hidden=true; LV.rec.relink(S.doc).then(()=>{ toast("أُعيد الربط واستُوردت أحداث السجل","ok"); scheduleRec(S.doc); }).catch(e=>toast("تعذّر الربط","err")); return; }
  if(k==="remove"){ if(!confirm("حذف البث المباشر لهذه المباراة؟ سجل المباراة يبقى كما هو.")) return; m.hidden=true;
    const doc = S.doc, id = S.id;
    stopRec().then(()=>LV.rec.wipe(doc, true)).then(()=>LV.cmd.remove(id)).then(()=>{ toast("حُذف البث — السجل باقٍ", "ok"); A.close(); }).catch(e=>{ console.error(e); if(S) S.wiping = false; toast("تعذّر الحذف", "err"); }); return; }
  if(k==="wipeall"){ const d = S.doc;
    if(!confirm(`مسح اللعب الفعلي لمباراة ${d.home} × ${d.away} بالكامل؟\n\nيُحذف البث وكل أحداثه${d.detached?"":"، وتُمسح أحداثه من سجل المباراة وترجع «لم تبدأ» 0-0"}. لا يمكن التراجع.`)) return;
    m.hidden=true; const id = S.id;
    stopRec().then(()=>LV.rec.wipe(d, !!d.detached)).then(()=>LV.cmd.remove(id)).then(()=>{ toast("مُسح اللعب الفعلي بالكامل", "ok"); A.close(); }).catch(e=>{ console.error(e); if(S) S.wiping = false; toast("تعذّر المسح", "err"); }); return; }
}
document.addEventListener("change", e=>{ const r=e.target.closest && e.target.closest("[data-crowdr]"); if(!r || !S) return;
  const c=LV.crowdOf(S.doc); c[r.dataset.crowdr]=+r.value; run(()=>LV.cmd.setCrowd(S.id, c), "حُدّث الجمهور").then(()=>openSettings()); });
document.addEventListener("input", e=>{ const r=e.target.closest && e.target.closest("[data-crowdr]"); if(r && r.nextElementSibling) r.nextElementSibling.textContent=r.value+"%"; });
function onKey(e){
  if(!S || !S.root) return;
  const tag = (e.target.tagName||"").toLowerCase(), typing = tag==="input"||tag==="textarea"||tag==="select";
  if(e.key==="Escape"){ if(!S.root.querySelector("#lvcModal").hidden){ S.root.querySelector("#lvcModal").hidden=true; return; } if(S.pop){ closePop(); paint(); return; } if(S.draft){ cancel(); e.preventDefault(); } return; }
  if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==="z" && !typing){ e.preventDefault(); doUndo(); return; }
  if(e.key==="Enter" && S.draft && tag!=="textarea"){
    if(tag==="input" && e.target.list && e.target.value && !e.target.dataset.entered){ /* اختيار من القائمة أولاً ثم Enter للحفظ */ }
    e.preventDefault(); save(); return; }
  if(typing) return;
  if(e.ctrlKey||e.metaKey||e.altKey) return;
  if(e.key===" "){ e.preventDefault(); const c=S.doc.clock; if(c.running && LV.isLivePh(c.phase)){ const on=LV.effInfo(c).run; S.stopTool=null; effCmd(on?"effstop":"effgo"); } else if(LV.isLivePh(c.phase)) clockCmd("resume"); return; }
  if(S.draft && (e.key==="1"||e.key==="2")){ readForm(); S.draft.team = e.key==="1" ? "h" : "a"; paintComposer(); const p=S.root.querySelector("#lvcP"); if(p) p.focus(); e.preventDefault(); return; }
  if((e.key==="Delete"||e.key==="Backspace") && S.sel){ delEvent(S.sel); e.preventDefault(); return; }
  const def = LV.EV.find(x=>x.key===e.key.toLowerCase()); if(def){ e.preventDefault(); startDraft(def.k, S.draft && S.draft.x!=null ? {x:S.draft.x, y:S.draft.y, zone:U.zoneOf(U.toM(S.draft.x,S.draft.y).mx,U.toM(S.draft.x,S.draft.y).my)} : null); }
}

/* ───────────── الفتح والإغلاق ───────────── */
A.open = async function(key){
  if(!LV.canEdit()){ alert("غرفة التحكم لفريق العمل فقط — سجّل الدخول من «لوحة التحكم» أولاً."); if(typeof go==="function") go("admin"); return; }
  const m = LV.findMatch(key);
  if(!m){ alert("لم تُعثر على المباراة."); return; }
  if(S) A.close(true);
  const id = LV.idOf(key);
  LV.ctxGulf = !!m.__gulf;
  let host = document.getElementById("lvCtl");
  if(!host){ host = document.createElement("div"); host.id="lvCtl"; host.className="lvc-host"; document.body.appendChild(host); }
  host.hidden = false; document.documentElement.classList.add("lvc-open");
  host.innerHTML = `<div class="lvc-loading">جارٍ فتح غرفة التحكم…</div>`;
  S = {id, key, m, doc:null, tool:null, draft:null, editId:null, sel:null, seen:null, feedF:"all"};
  const me = S;
  try{
    await LV.cmd.ensure(m);
    /* مباراة مسجّلة يدوياً ⇒ نستورد أحداث سجلها إلى البث مرة واحدة (بمعرّفاتها) بدل إنشاء أحداث مكررة */
    const cur = await new Promise(r=>{ const u=LV.store.watch(id, d=>{ if(d!==undefined){ setTimeout(()=>u&&u(),0); r(d); } }); });
    if(cur && !cur.linked && !cur.detached && LV.rec){
      const rm = LV.rec.recMatch(cur);
      if(rm && LV.rec.hasRows(rm)) await LV.rec.pull(rm);
      else await LV.store.tx(id, d=>{ if(!d || d.linked) return null; d.linked = true; return d; });
    }
  }catch(e){ host.innerHTML = `<div class="lvc-loading err">تعذّر إنشاء البث: ${H(e.code||e.message||"")}<br><button type="button" class="btn" onclick="LIVE_ADMIN.close()">رجوع</button></div>`; return; }
  S.unsub = LV.store.watch(id, (d)=>{
    if(S!==me || d===undefined) return;
    if(d===null){ return; }
    const first = !S.doc; S.doc = d;
    if(first){ host.innerHTML = shell(); S.root = host.querySelector(".lvc"); S.root.addEventListener("click", onClick); paintComposer(); LV.store.idxSet(id, LV.idxSummary(d)).catch(()=>{}); }
    paint();
  });
  S.untick = LV.tick(()=>{ if(S===me && S.doc && (S.doc.clock.running || (S.doc.clock.eff||{}).run)) paintClock(); });
  document.addEventListener("keydown", onKey);
};
A.close = function(silent){
  if(!S) return;
  try{ S.unsub && S.unsub(); }catch(e){} try{ S.untick && S.untick(); }catch(e){}
  document.removeEventListener("keydown", onKey);
  const host = document.getElementById("lvCtl"); if(host){ host.hidden=true; host.innerHTML=""; }
  document.documentElement.classList.remove("lvc-open");
  S = null;
  if(!silent && /^#livectl\//.test(location.hash)){ try{ history.replaceState(null, "", location.pathname+location.search); }catch(e){} }
};
A.state = () => S;
})();
