/* =====================================================================
   المشاركات الخارجية للأندية الكويتية — تحرير كامل مثل الدوري (منصور 2026-10-12)
   الكويت (دوري أبطال آسيا 2) · كاظمة (دوري أبطال الخليج للأندية) · القادسية والعربي (دوري التحدي الآسيوي)

   العزل عن إحصاءات الموسم — نفس طريقة كأس الخليج (gulf.js):
   البيانات في وثيقة مستقلة seasons/ext2627 بنفس بنية وثيقة الموسم
   (matches/goals/cards/pens/lineups/subs/shapes/mev/squads). لا تدخل ALL أبداً، فلا تمسّ
   الترتيب ولا الهدافين ولا ملفات اللاعبين ولا التقييمات ولا الفانتسي.
   withExt(fn) يبدّل مؤقتاً (وبشكل متزامن) ALL/SQUADS/CLUBS/LOGOS/COMP والمصفوفات المرشّحة
   إلى بيانات المشاركات ثم يعيدها، فيعمل المحرّر وصفحة المباراة والساعة كما هي.
   أنديتنا الأربعة: قوائمها وصورها وشعاراتها وألوانها نسخ للقراءة من الموسم (لا يُكتب في وثيقة الموسم شيء).
   النطاق (منصور 2026-10-12، النسخة النهائية): كل مباريات البطولات الثلاث قابلة للتحرير الكامل (تشكيلة/أحداث/مباشر/صفحة مباراة)،
   بما فيها مباريات الفرق الأجنبية فيما بينها. وكل شيء لكل بطولة على حدة: مبارياتها، جدولها، إحصاءاتها، صفحات مبارياتها —
   withExt(fn, comp) يحصر المباريات والأحداث في البطولة، فلا يختلط شيء بين البطولات ولا بالدوري.
   لا قسم عام مستقل: صفحة البطولة هي عرض «البطولات الخارجية» في صفحة المباريات (الجدول + المباريات + statsHTML).
   الفرق الأجنبية: شعاراتها من EXT_CRESTS، وبلا إدارة قوائم: المحرّر يكتب أسماء لاعبيها في التشكيلة والأحداث،
   وتُحفظ الأسماء المستعملة في squads[الفريق] (كل فريق في بطولة واحدة) فتظهر للاختيار في المباراة التالية.
   البذرة: مباريات EXT_FIXTURES للبطولات الثلاث تُضاف على الجهاز إن لم تكن في الوثيقة —
   ولا تُكتب فوق مباراة عدّلها محرّر (m.ed) أبداً.
   ===================================================================== */
(function(){
"use strict";
const X = window.EXT = {};
const H = s => String(s==null?"":s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const clone = o => o==null ? o : JSON.parse(JSON.stringify(o));
const TEST = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && /[?&]livetest=1\b/.test(location.search);
const DOC_ID = "ext2627", NAME = "المشاركات الخارجية 2026-27";
const CACHE_K = "mfext2627_cache", TEST_K = "mfext";
X.DOC_ID = DOC_ID;

/* ───────────── البطولات ─────────────
   g = عدد جولات دور المجموعات (ما بعدها خروج المغلوب) · tag = نص يطابق EXT_COMPS.re لبناء مناسبة من مباراة مضافة */
const CX = [
  {id:"acl2", g:6, tag:"اسيا 2"},
  {id:"gcl",  g:6, tag:"دوري أبطال الخليج للأندية"},
  {id:"acc",  g:3, tag:"التحدي الاسيوي"}
];
const ECOMPS = () => (typeof EXT_COMPS!=="undefined" ? EXT_COMPS : []);
const EGROUPS = () => (typeof EXT_GROUPS!=="undefined" ? EXT_GROUPS : {});
const cName = id => (ECOMPS().find(c=>c.id===id)||{}).name || id;
const cOfName = n => CX.find(c=>cName(c.id)===n) || null;
const cOf = id => CX.find(c=>c.id===id) || null;
X.comps = () => CX.map(c=>({id:c.id, name:cName(c.id), g:c.g}));
X.isComp = n => !!cOfName(n);
const nrm = t => ((typeof _norm==="function") ? _norm(t) : String(t||"").trim()).replace(/ة/g,"ه");   /* «الوحدة الاماراتي» يبدأ بـ«الوحده» */

/* الفرق: من EXT_GROUPS — أنديتنا (الموجودة في الدوري) والخصوم */
const OURS_FALLBACK = ["الكويت","كاظمة","القادسية","العربي"];
let OURS = null;
function ours(){
  if(OURS) return OURS;
  const all = teamsAll(), lc = (typeof CLUBS!=="undefined" && Array.isArray(CLUBS) && depth===0) ? CLUBS : null;
  if(!lc) return OURS_FALLBACK;
  OURS = all.filter(t=>lc.includes(t));
  if(!OURS.length) OURS = OURS_FALLBACK.slice();
  return OURS;
}
X.isOurs = c => ours().includes(c);
function teamsOf(id){ return [...new Set((EGROUPS()[id]||[]).flatMap(g=>g.teams||[]))]; }
function teamsAll(){ return [...new Set(CX.flatMap(c=>teamsOf(c.id)))]; }
const opponents = () => teamsAll().filter(t=>!ours().includes(t));
/* شعار الخصم من EXT_CRESTS (evTeam في index.html) */
function oppCrest(c){
  try{ const x = typeof evTeam==="function" ? evTeam(c, "بطولة خارجية") : null; if(x && x.t==="ext") return x.src; }catch(e){}
  return "";
}
/* ألوان الخصوم المعروفة فقط (توهّج صفحة المباراة) — غير المعروف يأخذ اللون المحايد للموقع */
const OPP_COLORS = {"الوحدة الاماراتي":["#7B1E3A","#FFFFFF"], "ناساف الاوزبكي":["#1E4B9B","#FFFFFF"], "الاتفاق السعودي":["#0F7A3D","#C8102E"],
  "غوا الهندي":["#F26722","#1B2A5C"], "النجمة اللبناني":["#C8102E","#FFFFFF"]};

/* ───────────── البذرة من EXT_FIXTURES ───────────── */
const roundOfN = n => +((/الجولة\s*(\d+)/.exec(String(n||""))||[])[1]) || 0;
/* «الوحدة» (اسم العرض بعد حذف النسبة في evTeam) = «الوحدة الاماراتي» */
const teamEq = (x, y) => { x = nrm(x); y = nrm(y); return x===y || x.startsWith(y+" ") || y.startsWith(x+" "); };
const pairEq = (a,b,h,w) => (teamEq(a,h) && teamEq(b,w)) || (teamEq(a,w) && teamEq(b,h));
function teamName(raw, id){ const t = teamsOf(id).find(x=>nrm(x)===nrm(raw)); return t || String(raw||"").trim(); }
function fixtures(){
  const L = (typeof EXT_FIXTURES!=="undefined" ? EXT_FIXTURES : []);
  const out = [];
  L.forEach(e=>{
    const id = typeof extCompOf==="function" ? extCompOf(e) : null; if(!cOf(id)) return;
    const pr = String(e.t||"").split(/\s*[-–—]\s*/).map(s=>s.trim()).filter(Boolean); if(pr.length<2) return;
    const r = roundOfN(e.n); if(!r) return;
    out.push({id, comp:cName(id), round:r, date:e.d||"", time:e.time||"", venue:e.venue||"", home:teamName(pr[0],id), away:teamName(pr[1],id),
              hg:(e.hg!=null?+e.hg:null), ag:(e.ag!=null?+e.ag:null), scorers:Array.isArray(e.scorers)?e.scorers:[], live:!!e.live});
  });
  /* نتائج المجموعة الثابتة بين الفرق الأخرى (EXT_TABLE_RESULTS): الجولة من مباراة البطولة الثابتة في اليوم نفسه */
  (typeof EXT_TABLE_RESULTS!=="undefined" ? EXT_TABLE_RESULTS : []).forEach(e=>{
    const id = e.comp; if(!cOf(id)) return;
    const pr = String(e.t||"").split(/\s*[-–—]\s*/).map(s=>s.trim()).filter(Boolean); if(pr.length<2) return;
    const r = (out.find(f=>f.id===id && f.date===e.d)||{}).round; if(!r) return;
    out.push({id, comp:cName(id), round:r, date:e.d||"", time:e.time||"", venue:e.venue||"", home:teamName(pr[0],id), away:teamName(pr[1],id),
              hg:(e.hg!=null?+e.hg:null), ag:(e.ag!=null?+e.ag:null), scorers:[], live:false});
  });
  return out;
}
/* هدافو المباراة الثابتة ← صفوف أهداف (فقط إذا اكتمل العدد في الجهتين، مثل extScorersHTML) */
function seedGoals(f){
  if(f.hg==null || f.ag==null || f.live) return null;
  const h = f.scorers.filter(x=>x&&x.side==="h"), a = f.scorers.filter(x=>x&&x.side==="a");
  if(h.length!==f.hg || a.length!==f.ag) return null;
  return [...h.map(x=>[x,f.home,f.away]), ...a.map(x=>[x,f.away,f.home])].map(([x,sc,cd])=>{
    const mm = /^(\d+)\s*(?:\+\s*(\d+))?/.exec(String(x.min||"")) || [];
    let p = String(x.name||"").trim(); const og = /عكسي/.test(p); p = p.replace(/\s*\(.*?\)\s*/g,"").trim();
    return {r:f.round, comp:f.comp, sc, cd, p, a:"", m:+mm[1]||0, x:+mm[2]||0, cat:"لعب مفتوح", det:"", bp:og?"هدف عكسي":"", zone:"", og:""};
  });
}
const fxKey = (comp, r, h, a) => `${comp}|${r}|${[nrm(h),nrm(a)].sort().join("|")}`;
function blankDoc(){ return {season:NAME, matches:[], goals:[], cards:[], pens:[], lineups:[], subs:[], shapes:[], mev:[], squads:{}, removed:[], refpool:[], updated:""}; }

let DATA = null;
X.data = () => DATA;
function normalize(d){
  d = d && typeof d==="object" ? d : blankDoc();
  ["matches","goals","cards","pens","lineups","subs","shapes","mev","removed"].forEach(k=>{ if(!Array.isArray(d[k])) d[k]=[]; });
  if(!d.squads || typeof d.squads!=="object") d.squads = {};
  opponents().forEach(c=>{ if(!Array.isArray(d.squads[c])) d.squads[c] = []; });
  const removed = new Set(d.removed);
  /* المباريات الثابتة: تُضاف الناقصة، وغير المعدّلة تتبع الجدول الثابت (التاريخ/الوقت/الملعب/النتيجة من مزامنة SofaScore) */
  fixtures().forEach(f=>{
    if(removed.has(fxKey(f.comp, f.round, f.home, f.away))) return;
    let m = d.matches.find(x=>x.comp===f.comp && +x.round===f.round && pairEq(x.home,x.away,f.home,f.away));
    if(!m){ m = {n:d.matches.length+1, round:f.round, comp:f.comp, date:f.date, time:f.time, venue:f.venue, home:f.home, away:f.away, note:"", ref:"", refs:{}, tv:"", status:"", add1:0, add2:0, hg:0, ag:0};
      d.matches.push(m); }
    else if(!m.ed){ Object.assign(m, {date:f.date, time:f.time, venue:f.venue||m.venue||""});
      if(m.home!==f.home && !hasRows(d, m)){ m.home = f.home; m.away = f.away; } }
    if(!m.ed){
      const has = d.goals.some(g=>g.comp===m.comp && +g.r===+m.round && pairEq(g.sc,g.cd,m.home,m.away));
      const gs = has ? null : seedGoals(f);
      if(gs && gs.length){ d.goals.push(...gs); if(!m.status) m.status = "ft"; }
      else if(gs && !gs.length && !m.status) m.status = "ft";   /* 0-0 منتهية */
    }
  });
  d.matches.forEach(m=>{
    m.round = +m.round || 1;
    if(!m.refs || typeof m.refs!=="object") m.refs = {};
    Object.defineProperty(m, "__ext", {value:true, enumerable:false, configurable:true});
    /* النتيجة من الأهداف — نفس قاعدة applyEdit */
    m.hg = d.goals.filter(g=>+g.r===+m.round && g.comp===m.comp && g.sc===m.home && g.cd===m.away).length;
    m.ag = d.goals.filter(g=>+g.r===+m.round && g.comp===m.comp && g.sc===m.away && g.cd===m.home).length;
  });
  d.matches.sort((a,b)=>String(a.date).localeCompare(String(b.date)) || String(a.time||"").localeCompare(String(b.time||"")) || a.round-b.round);
  d.matches.forEach((m,i)=>m.n = i+1);
  if(!Array.isArray(d.refpool)) d.refpool = [];
  return d;
}
function hasRows(d, m){
  const mine = x => x.comp===m.comp && +x.r===+m.round;
  return d.goals.some(g=>mine(g) && pairEq(g.sc,g.cd,m.home,m.away)) || d.cards.some(x=>mine(x) && (x.club===m.home||x.club===m.away))
      || d.lineups.some(x=>mine(x) && (x.club===m.home||x.club===m.away)) || d.subs.some(x=>mine(x) && (x.club===m.home||x.club===m.away));
}

/* ───────────── السياق المعزول ───────────── */
let depth = 0;
const GLOBALS = () => ({ALL, SQUADS, CLUBS, LOGOS, COMP, MATCHES, GOALS, PENS, CARDS, LSCALE, pc:photoCut, nf:natFlag, cc:window.CLUB_COLORS});
function ctxSquads(saved){
  const out = {};
  ours().forEach(c=>{ out[c] = clone((saved.SQUADS||{})[c] || []); });              /* نسخة للقراءة — لا تُكتب */
  opponents().forEach(c=>{ out[c] = DATA.squads[c] || (DATA.squads[c] = []); });    /* قوائم الخصوم من الوثيقة */
  return out;
}
function withExt(fn, comp){
  if(!DATA) DATA = normalize(null);
  if(depth) return fn();
  const only = comp && cOfName(comp) ? (x => x.comp===comp) : (() => true);   /* حصر العرض في بطولة واحدة */
  ours();                                        /* تُحسب من أندية الدوري قبل التبديل */
  const saved = GLOBALS();
  depth++;
  if(typeof PASS_MEMO==="object" && PASS_MEMO) PASS_MEMO.m = null;   /* لا تختلط ذاكرة الرسم (مفاتيح COMP «الكل») بين الدوري والمشاركات */
  try{
    ALL = DATA; SQUADS = ctxSquads(saved); CLUBS = teamsAll(); COMP = "الكل";
    const L = {}, S = {};
    teamsAll().forEach(c=>{ if(ours().includes(c)){ if(saved.LOGOS[c]) L[c] = saved.LOGOS[c]; if(saved.LSCALE[c]!=null) S[c] = saved.LSCALE[c]; } else { const s = oppCrest(c); if(s) L[c] = s; } });
    LOGOS = L; LSCALE = S;
    photoCut = (name, club) => { if(!name) return null;
      if(ours().includes(club)) return saved.pc(name, club);
      const e = (DATA.squads[club]||[]).find(x=>x && x.n===name); return (e && e.f) || null; };
    natFlag = (name, club, cls) => ours().includes(club) ? saved.nf(name, club, cls) : "";
    window.CLUB_COLORS = Object.assign({}, saved.cc||{}, OPP_COLORS);
    MATCHES = DATA.matches.filter(only); GOALS = DATA.goals.filter(only); PENS = DATA.pens.filter(only); CARDS = DATA.cards.filter(only);
    if(comp && cOfName(comp)){ const ts = new Set(); MATCHES.forEach(m=>{ ts.add(m.home); ts.add(m.away); }); teamsOf(cOfName(comp).id).forEach(t=>ts.add(t)); CLUBS = [...ts]; }
    return fn();
  } finally {
    ({ALL, SQUADS, CLUBS, LOGOS, COMP, MATCHES, GOALS, PENS, CARDS, LSCALE} = saved);
    photoCut = saved.pc; natFlag = saved.nf; window.CLUB_COLORS = saved.cc;
    if(typeof PASS_MEMO==="object" && PASS_MEMO) PASS_MEMO.m = null;
    depth--;
  }
}
X.withExt = withExt;
X.inCtx = () => depth > 0;
X.isKO = m => { const c = cOfName(m && m.comp); return !!(c && +m.round > c.g); };

/* ───────────── التخزين (وثيقة مستقلة) ───────────── */
const store = {
  watch(cb){
    if(TEST){ const r=()=>{ try{ const s=localStorage.getItem(TEST_K); cb(s?JSON.parse(s):null); }catch(e){ cb(null); } }; r(); window.addEventListener("storage", e=>{ if(e.key===TEST_K) r(); }); return; }
    /* بداية فورية: آخر نسخة على الجهاز ثم لقطة CDN (/api/doc/ext2627) — الأحدث فقط — ثم onSnapshot الحيّ */
    let live = false, last = "";
    const early = d => { if(live || !d || typeof d!=="object" || !Array.isArray(d.matches)) return; const u = String(d.updated||""); if(last && u <= last) return; last = u; cb(d); };
    try{ const c = localStorage.getItem(CACHE_K); if(c) early(JSON.parse(c)); }catch(e){}
    if(typeof SNAP!=="undefined" && SNAP && SNAP.get) SNAP.get(DOC_ID).then(early).catch(()=>{});
    const go = () => { if(typeof fbDb==="undefined" || !fbDb){ setTimeout(go, 400); return; }
      fbDb.collection("seasons").doc(DOC_ID).onSnapshot(s=>{ live = true; const d = s.exists ? s.data() : null;
        if(d) try{ localStorage.setItem(CACHE_K, JSON.stringify(d)); }catch(e){}
        cb(d); }, ()=>cb(undefined)); };
    go();
  },
  async save(d){
    const obj = clone(d); obj.updated = new Date().toISOString(); obj.updatedBy = (typeof FBUSER!=="undefined" && FBUSER && FBUSER.email) || "";
    if(TEST){ localStorage.setItem(TEST_K, JSON.stringify(obj)); X.__saves = (X.__saves||0) + 1; return obj; }
    if(typeof fbDb==="undefined" || !fbDb) throw new Error("السحابة غير متاحة");
    await fbDb.collection("seasons").doc(DOC_ID).set(obj); return obj;
  },
  /* أحدث نسخة من الخادم نفسه — عند تعذّرها null */
  async fresh(){
    if(TEST){ try{ const s=localStorage.getItem(TEST_K); return s?JSON.parse(s):(DATA?clone(DATA):null); }catch(e){ return null; } }
    if(typeof fbDb==="undefined" || !fbDb) return null;
    try{ const s = await fbDb.collection("seasons").doc(DOC_ID).get({source:"server"}); return s.exists ? s.data() : null; }
    catch(e){ return null; }
  }
};
let PENDING = null;
const EDIT_OPEN = () => typeof EDIT!=="undefined" && EDIT && EDIT.ext;
setTimeout(()=>store.watch(d=>{
  if(d===undefined) return;
  if(EDIT_OPEN()){ PENDING = d; return; }              /* لا نقاطع محرّراً مفتوحاً على مباراة خارجية */
  DATA = normalize(d); repaint();
}), 0);

/* ───────────── العرض في صفحة المباريات (index.html: extEvents / extCardsHTML / extTableHTML) ───────────── */
const PHX = ["h1","ht","h2","e1","e2","pso"];
function stateOf(m){
  return withExt(()=>{
    if(m.status==="ft") return "done";
    if(PHX.includes(m.status)) return (typeof staleLive==="function" && staleLive(m)) ? "done" : "live";
    if(typeof isUpcoming==="function" && isUpcoming(m)) return "soon";
    if(typeof matchOver==="function" && matchOver(m)) return "done";
    return (typeof isLive==="function" && isLive(m)) ? "live" : "done";
  });
}
/* أُدخلت من المحرّر (أو بذرة نتيجة منتهية): بياناتها تتقدّم على الجدول الثابت */
const entered = m => !!(m && (m.ed || (m.status && m.status!=="pre")));
/* مباراة الوثيقة المقابلة لمناسبة/مباراة ثابتة: بالجولة والفريقين، وإلا باليوم والفريقين */
function linked(id, e, an, bn){
  if(!DATA || !cOf(id)) return null;
  const comp = cName(id), r = roundOfN(e && e.n);
  const L = DATA.matches.filter(m=>m.comp===comp && pairEq(m.home,m.away,an,bn));
  return (r ? L.find(m=>+m.round===r) : null) || L.find(m=>m.date===e.d) || null;
}
function scorersOf(m, hSide){
  const gs = DATA.goals.filter(g=>g.comp===m.comp && +g.r===+m.round && pairEq(g.sc,g.cd,m.home,m.away))
    .sort((a,b)=>(+a.m||0)-(+b.m||0) || (+a.x||0)-(+b.x||0));
  return gs.map(g=>({side: g.sc===hSide ? "h" : "a", name:g.p + (g.bp==="هدف عكسي" ? " (هدف عكسي)" : ""), min:(+g.x ? `${+g.m}+${+g.x}` : String(+g.m||""))}));
}
/* {k, st, ph, hg, ag (بترتيب البطاقة: an أولاً), ref, v, tv, scorers} — st غائب = تبقى بيانات الجدول الثابت */
X.extra = (id, e, an, bn) => {
  const m = linked(id, e, an, bn); if(!m) return null;
  const k = typeof matchKey==="function" ? matchKey(m) : "";
  if(!entered(m)) return {k};
  const same = teamEq(m.home, an);
  const st = stateOf(m);
  return {k, st, ph:m.status||"", hg:same?+m.hg:+m.ag, ag:same?+m.ag:+m.hg, ref:m.ref||"", v:(m.refs||{}).var||"", tv:m.tv||"",
          ko:X.isKO(m), scorers:st==="soon" ? [] : scorersOf(m, same ? m.home : m.away)};
};
/* قائمة البطولة: المناسبات الثابتة (بموعد المباراة المعدّلة إن غيّره المحرّر) + مباريات أُضيفت من الإدارة لأحد أنديتنا */
X.events = (id, L) => {
  if(!cOf(id) || !DATA) return L;
  const used = new Set();
  const out = L.map(e=>{
    const pr = typeof evParts==="function" ? evParts(e) : [];
    if(pr.length<2) return e;
    const m = linked(id, e, pr[0], pr[1]); if(!m) return e;
    used.add(m);
    if(!m.ed) return e;
    return Object.assign({}, e, {d:m.date||e.d, time:m.time||e.time||"", venue:m.venue||e.venue||""});
  });
  const comp = cName(id), c = cOf(id);
  DATA.matches.filter(m=>m.comp===comp && !used.has(m)).forEach(m=>{
    out.push({d:m.date||"", t:`${m.home} - ${m.away} - ${c.tag}`, k:"بطولة خارجية", time:m.time||"", venue:m.venue||"", n:+m.round>c.g ? `الدور الإقصائي ${+m.round-c.g}` : `الجولة ${m.round}`, __x:1});
  });
  return out;
};
/* جدول المجموعة: نتائج الوثيقة التي لا تقابلها مناسبة ثابتة (نتائج الفرق الأخرى المُدخلة، ومباريات أنديتنا المضافة) */
X.tableExtra = (id, evs) => {
  if(!cOf(id) || !DATA) return [];
  const comp = cName(id), c = cOf(id), usedM = new Set();
  evs.forEach(e=>{ const pr = typeof evParts==="function" ? evParts(e) : []; if(pr.length<2) return;
    const m = linked(id, e, pr[0], pr[1]); if(m) usedM.add(m); });
  return DATA.matches.filter(m=>m.comp===comp && !usedM.has(m) && +m.round<=c.g && entered(m) && stateOf(m)==="done").map(m=>({an:m.home, bn:m.away, hg:+m.hg||0, ag:+m.ag||0}));
};

/* ───────────── صفحة البطولة: إحصاءاتها من مبارياتها وحدها ───────────── */
X.statsHTML = id => {
  const c = cOf(id); if(!c || !DATA) return "";
  const comp = cName(id), mine = teamsOf(id);
  DATA.matches.filter(m=>m.comp===comp).forEach(m=>[m.home,m.away].forEach(t=>{ if(!mine.includes(t)) mine.push(t); }));
  const ms = DATA.matches.filter(m=>m.comp===comp && entered(m) && stateOf(m)!=="soon");
  if(!ms.length) return "";
  const inM = x => ms.some(m=>+m.round===+x.r && x.comp===comp && (x.sc ? pairEq(x.sc,x.cd,m.home,m.away) : (x.club===m.home||x.club===m.away)));
  const T = mine.map(t=>{ const r = {t, p:0, w:0, d:0, l:0, gf:0, ga:0};
    ms.filter(m=>m.home===t||m.away===t).forEach(m=>{ const f = m.home===t ? +m.hg : +m.ag, a = m.home===t ? +m.ag : +m.hg; r.p++; r.gf+=f; r.ga+=a; if(f>a) r.w++; else if(f<a) r.l++; else r.d++; }); return r; }).filter(r=>r.p);
  const tally = (rows, nameOf, clubOf) => { const o = {}; rows.forEach(x=>{ const n = nameOf(x), cl = clubOf(x); if(!n || !mine.includes(cl)) return; (o[n+"|"+cl] ||= {n, c:cl, v:0}).v++; });
    return Object.values(o).sort((a,b)=>b.v-a.v || a.n.localeCompare(b.n,"ar")).slice(0,10); };
  const G = DATA.goals.filter(inM);
  const sc = tally(G.filter(g=>g.bp!=="هدف عكسي"), g=>g.p, g=>g.sc), as = tally(G, g=>g.a, g=>g.sc);
  const CD = DATA.cards.filter(inM), red = t => /طرد|ثان/.test(t||"");
  const yc = tally(CD.filter(x=>!red(x.type)), x=>x.p, x=>x.club), rc = tally(CD.filter(x=>red(x.type)), x=>x.p, x=>x.club);
  const face = (n, cl) => { const f = withExt(()=>photoCut(n, cl), comp); return f ? `<img src="${H(f)}_f.webp?v=37" alt="" loading="lazy" decoding="async">` : `<i>${H(String(n).trim().split(/\s+/).slice(0,2).map(w=>w[0]||"").join(""))}</i>`; };
  const list = (t, L, unit) => `<section class="xt-st-c"><h3>${t}</h3>${L.length ? L.map((x,i)=>`<div class="xt-st-r" ${ours().includes(x.c)?` data-player="${H(x.n)}" data-club="${H(x.c)}"`:""}><span class="rk">${i+1}</span><span class="ph">${face(x.n,x.c)}</span><span class="nm"><b>${H(x.n)}</b><small>${H(x.c)}</small></span><span class="v">${x.v}</span></div>`).join("") : `<p class="xt-st-e">لا ${unit} بعد.</p>`}</section>`;
  return `<section class="xt-st">
    <h2 class="sec">إحصاءات البطولة<span class="sq-n">${H(comp)}</span></h2>
    <div class="xt-st-c xt-st-t"><table><thead><tr><th class="tl">الفريق</th><th>لعب</th><th>ف</th><th>ت</th><th>خ</th><th>له</th><th>عليه</th></tr></thead>
      <tbody>${T.map(r=>`<tr><td class="tl"><span>${crestOf(r.t)}<b>${H(r.t)}</b></span></td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gf}</td><td>${r.ga}</td></tr>`).join("")}</tbody></table></div>
    <div class="xt-st-g">${list("الهدافون", sc, "أهداف")}${list("صناعة الأهداف", as, "تمريرات حاسمة")}${list("الإنذارات", yc, "إنذارات")}${list("الطرد", rc, "بطاقات حمراء")}</div>
    <p class="xt-st-n">من مباريات هذه البطولة وحدها — لا تدخل إحصاءات الدوري ولا ملفات اللاعبين ولا الفانتسي.</p>
  </section>`;
};

/* ───────────── مطابقة المباريات بالمفتاح ───────────── */
function findExt(k){
  if(!DATA || !k) return null;
  const [c,r,h,a] = String(k).split("/").map(x=>{ try{ return decodeURIComponent(x); }catch(e){ return x; } });
  if(!cOfName(c)) return null;
  return DATA.matches.find(m=>m.comp===c && String(m.round)===r && m.home===h && m.away===a) || null;
}
X.find = findExt;

/* ───────────── ربط الموقع: صفحة المباراة ───────────── */
function hookSite(){
  if(typeof renderMatchPage==="function" && !renderMatchPage.__ext){
    const o = renderMatchPage;
    renderMatchPage = function(){
      const m = (typeof MP==="object") ? MP.m : null;
      if(!(m && m.__ext)) return o.apply(this, arguments);
      if(MP.tab==="table") MP.tab = "details";
      const r = withExt(()=>o.apply(this, arguments), m.comp);
      const box = document.getElementById("mpage");
      if(box){
        box.querySelectorAll('.mp-tabs [data-mp-tab="table"]').forEach(b=>b.remove());
        box.querySelectorAll(".mp-share").forEach(b=>b.remove());     /* بطاقة المشاركة تُرسم خارج السياق */
        /* لاعبو الخصوم بلا ملف لاعب، وأنديتهم بلا صفحة نادٍ — لاعبو أنديتنا يفتحون ملفهم في الدوري كما هو */
        box.querySelectorAll("[data-player]").forEach(el=>{ const c = el.getAttribute("data-club"); if(!c || !ours().includes(c)){ el.removeAttribute("data-player"); el.style.cursor = "default"; } });
        box.querySelectorAll("[data-club-open]").forEach(el=>{ if(!ours().includes(el.getAttribute("data-club-open"))){ el.removeAttribute("data-club-open"); el.style.cursor = "default"; } });
        const hd = box.querySelector(".mp-head .mp-when");
        const lbl = `${H(m.comp)} · ${X.isKO(m) ? `الدور الإقصائي ${+m.round-(cOfName(m.comp)||{g:0}).g}` : `الجولة ${H(m.round)}`}`;
        if(hd){ if(!hd.querySelector(".xt-comp")) hd.insertAdjacentHTML("afterbegin", `<b class="xt-comp">${lbl}</b> · `); }
        else { const sc = box.querySelector(".mp-head .mp-score"); if(sc) sc.insertAdjacentHTML("beforebegin", `<div class="mp-when"><b class="xt-comp">${lbl}</b></div>`); }
      }
      return r;
    };
    renderMatchPage.__ext = true; renderMatchPage.__gulf = o.__gulf; renderMatchPage.__lv = o.__lv;
  }
  if(typeof matchByKey==="function" && !matchByKey.__ext){ const o = matchByKey; matchByKey = function(k){ return o(k) || findExt(k); }; matchByKey.__ext = true; matchByKey.__gulf = o.__gulf; }
}

/* ───────────── المحرّر اليدوي: مباراة خارجية تُحرَّر وتُحفظ داخل سياقها في وثيقتها ───────────── */
function compChips(box){
  /* شرائح «المسابقة» في المحرّر: بطولات المشاركات بدل بطولات الدوري */
  const any = box && box.querySelector(".mx-chips [data-mcomp]"); if(!any) return;
  const wrap = any.parentElement, cur = EDIT.match.comp;
  wrap.innerHTML = CX.map(c=>{ const n = cName(c.id); return `<button class="mx-chip${cur===n?" on":""}" data-mcomp="${H(n)}">${H(n)}</button>`; }).join("");
  wrap.querySelectorAll("[data-mcomp]").forEach(b=>b.onclick=()=>{ if(!EDIT) return; EDIT.match.comp = b.dataset.mcomp; renderMatchAdmin(); });
}
function hookEditor(){
  if(typeof renderMatchAdmin==="function" && !renderMatchAdmin.__ext){
    const o = renderMatchAdmin;
    renderMatchAdmin = function(){
      if(EDIT_OPEN()){ const r = withExt(()=>o.apply(this, arguments), cOfName(EDIT.match.comp) ? EDIT.match.comp : null); const mb = document.getElementById("matchAdmin"); try{ compChips(mb); }catch(e){} try{ oppAddBox(mb); }catch(e){} return r; }
      const r = o.apply(this, arguments);
      if(PENDING){ DATA = normalize(PENDING); PENDING = null; repaint(); }
      return r;
    };
    renderMatchAdmin.__ext = true;
  }
  if(typeof saveMatch==="function" && !saveMatch.__ext){
    const o = saveMatch;
    saveMatch = async function(opt){
      if(!EDIT_OPEN()) return o.apply(this, arguments);
      const quiet = !!(opt && opt.quiet);
      if(SAVING_MATCH) return;
      if(!cOfName(EDIT.match.comp)) EDIT.match.comp = cName(CX[0].id);
      FORMERR = withExt(()=>validateEdit());
      if(FORMERR){ if(quiet){ FORMERR = ""; return; } renderMatchAdmin(); return; }
      SAVING_MATCH = true;
      const E0 = EDIT, key = {round:+EDIT.match.round, comp:EDIT.match.comp, home:EDIT.match.home, away:EDIT.match.away};
      try{
        if(!quiet) toast("جارٍ حفظ المباراة الخارجية…","busy",true);
        /* الحفظ على أحدث نسخة من الخادم (مثل كأس الخليج): ما غيّره هذا المحرّر فقط فوقها */
        const base = (await store.fresh()) || PENDING;
        if(base) DATA = normalize(clone(base));
        PENDING = null;
        if(quiet && (!EDIT || EDIT!==E0 || (window.MX && MX.sheet))) return;
        const EG = withExt(()=>mergeEdit(EDIT)); EG.ext = true;
        withExt(()=>applyEdit(EG));
        DATA = normalize(DATA);
        const x = DATA.matches.find(z=>+z.round===key.round && z.comp===key.comp && z.home===key.home && z.away===key.away);
        if(x){ x.ed = 1;                                /* عدّلها محرّر: لا تتبع الجدول الثابت بعد الآن */
          rememberNames(DATA, x); }
        if(EG.orig && EG.orig!==`${key.round}|${key.comp}|${key.home}|${key.away}`){ const [r0,c0,h0,a0] = EG.orig.split("|"); DATA.removed.push(fxKey(c0, +r0, h0, a0)); }
        const w = await store.save(DATA);
        if(w && w.updated){ DATA.updated = w.updated; DATA.updatedBy = w.updatedBy; }
        if(quiet){ EDIT = x ? withExt(()=>loadEdit(x)) : null; if(EDIT) EDIT.ext = true; if(window.MX) MX._edit = EDIT; try{ MX_ASAVED = Date.now(); MX_ACLOUD = true; }catch(e){} }
        else { EDIT = null; toast(`حُفظت: ${key.home} ضد ${key.away} ✅`,"ok"); }
        FORMERR = "";
      }catch(e){ toast("تعذّر الحفظ: "+(e.code||e.message),"err"); EDIT = E0; try{ MX_ACLOUD = false; }catch(_){} }
      finally{ SAVING_MATCH = false; }
      repaint();
      const typing = (()=>{ const a = document.activeElement; return !!(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)); })();
      if(!quiet || !typing) renderMatchAdmin();
      return true;
    };
    saveMatch.__ext = true; saveMatch.__gulf = o.__gulf; saveMatch.__lv = o.__lv;
  }
}

/* أسماء لاعبي الخصم المكتوبة في هذه المباراة ← squads[الخصم] (بلا مركز) فتظهر للاختيار لاحقاً */
function rememberNames(d, m){
  const mine = x => x.comp===m.comp && +x.r===+m.round;
  [m.home, m.away].filter(c=>!ours().includes(c)).forEach(c=>{
    const L = d.squads[c] || (d.squads[c] = []), have = new Set(L.map(x=>x && x.n));
    const add = n => { n = String(n||"").trim(); if(n && !have.has(n)){ have.add(n); L.push({n, p:""}); } };
    d.lineups.filter(x=>mine(x) && x.club===c).forEach(x=>add(x.p));
    d.subs.filter(x=>mine(x) && x.club===c).forEach(x=>{ add(x.in); add(x.out); });
    d.goals.filter(x=>mine(x) && x.sc===c && x.bp!=="هدف عكسي").forEach(x=>{ add(x.p); add(x.a); });
    d.cards.filter(x=>mine(x) && x.club===c).forEach(x=>add(x.p));
  });
}
/* تبويب التشكيلة لفريق خصم: حقل لكتابة اسم لاعب غير موجود في قائمته فينزل أساسياً مباشرة */
function oppAddBox(box){
  if(!window.MX || MX.tab!=="lineup" || !EDIT) return;
  const club = EDIT.match[MX.side]; if(!club || ours().includes(club)) return;
  const srch = box && box.querySelector(".mx-search"); if(!srch || box.querySelector(".xadd")) return;
  srch.insertAdjacentHTML("afterend", `<div class="xadd"><input type="text" data-xaddp placeholder="لاعب غير موجود؟ اكتب اسمه" autocomplete="off"><button type="button" class="mx-ghost" data-xaddp-go>إضافة للأساسيين</button></div>`);
  const inp = box.querySelector("[data-xaddp]"), go = box.querySelector("[data-xaddp-go]");
  const add = () => { const n = String(inp.value||"").trim().replace(/\s+/g," "); if(!n || !EDIT) return;
    const xi = (EDIT.lineup||[]).filter(x=>x.club===club);
    if(xi.some(x=>x.p===n)){ toast("اللاعب في التشكيلة أصلاً","busy"); return; }
    if(xi.length>=11){ toast("التشكيلة مكتملة (11) — أخرج لاعباً أولاً","err"); return; }
    (EDIT.lineup ||= []).push({club, p:n}); renderMatchAdmin(); };
  go.onclick = add; inp.onkeydown = e=>{ if(e.key==="Enter"){ e.preventDefault(); add(); } };
}

/* ───────────── الإدارة: تبويب «المشاركات الخارجية» ───────────── */
const PH_AR = {h1:"الشوط الأول", ht:"استراحة", h2:"الشوط الثاني", e1:"الإضافي الأول", e2:"الإضافي الثاني", pso:"ركلات الترجيح"};
const crestOf = c => withExt(()=>typeof crest==="function" ? crest(c) : "");
const rLbl = m => { const c = cOfName(m.comp); return c && +m.round>c.g ? `الدور الإقصائي ${+m.round-c.g}` : `الجولة ${m.round}`; };
function admRowHTML(m){
  const st = stateOf(m), k = H(withExt(()=>matchKey(m)));
  const badge = st==="live" ? `<span class="gadm-st live"><i></i>جارية${PH_AR[m.status]?` · ${PH_AR[m.status]}`:""}</span>`
              : st==="done" ? `<span class="gadm-st done">انتهت</span>` : `<span class="gadm-st soon">لم تبدأ</span>`;
  const score = st==="soon" ? (m.time ? `<bdi dir="ltr">${H(m.time)}</bdi>` : "—") : `<bdi dir="ltr">${m.ag} - ${m.hg}</bdi>`;
  return `<div class="gadm-row xadm-row ${st}">
      <span class="t">${crestOf(m.home)}<b>${H(m.home)}</b></span>
      <span class="s">${score}</span>
      <span class="t a"><b>${H(m.away)}</b>${crestOf(m.away)}</span>
      <span class="meta">${badge} · ${H(rLbl(m))}${m.venue?` · ${H(m.venue)}`:""}${!m.ed && !entered(m)?` · <em class="xadm-seed">من الجدول</em>`:""}</span>
      <span class="btns"><button class="am-eff" data-eff-open="${k}" title="ساعة الوقت الفعلي للعب — مستقلة عن الأحداث والإحصاءات">الوقت الفعلي</button><button data-xadm="edit" data-k="${k}">${st==="live"?"إدارة المباراة":"إدخال يدوي"}</button><button class="dl" data-xadm="rm" data-k="${k}">حذف</button></span>
    </div>`;
}
function daysHTML(ms){
  const today = new Date().toLocaleDateString("en-CA", {timeZone:"Asia/Kuwait"});
  const days = {}; ms.forEach(m=>{ (days[m.date||""] ||= []).push(m); });
  const rank = d => d===today ? 0 : d>today ? 1 : 2;
  return Object.keys(days).sort((a,b)=>rank(a)-rank(b) || (rank(a)===2 ? b.localeCompare(a) : a.localeCompare(b))).map(d=>{
    const list = days[d].slice().sort((a,b)=>String(a.time||"").localeCompare(String(b.time||"")));
    const live = list.some(m=>stateOf(m)==="live");
    const when = d===today ? "اليوم" : d>today ? "قادمة" : "منتهية";
    return `<section class="gadm-day${d===today?" today":""}">
      <h4 class="gadm-dh"><b>${d ? (typeof dayLabel==="function" ? dayLabel(d) : H(d)) : "بلا تاريخ"}</b><span>${[...new Set(list.map(rLbl))].join(" · ")}</span><em class="${live?"live":""}">${live?"جارية الآن":when}</em></h4>
      ${list.map(admRowHTML).join("")}</section>`;
  }).join("");
}
let ADM_C = (()=>{ try{ return localStorage.getItem("mf-xadm") || "acl2"; }catch(e){ return "acl2"; } })();
function adminHTML(){
  if(!DATA) DATA = normalize(null);
  if(!cOf(ADM_C)) ADM_C = CX[0].id;
  return `<div id="extAdmin"><h2 class="sec">المشاركات الخارجية</h2>
    <div class="card pad">
      <p class="hint" style="margin:0 0 4px">اختر البطولة: مبارياتها كلها (أنديتنا والفرق الأخرى) بالتشكيلة والخطة والأهداف والبطاقات والتبديلات والأحداث، والمباشر من «إدخال يدوي» (اضغط «الشوط الأول» مع صافرة البداية فتظهر الدقيقة للجمهور ويُحفظ تلقائياً).</p>
      <p class="hint" style="margin:0 0 4px">لاعبو الفرق الأجنبية يُكتبون في التشكيلة والأحداث مباشرة ويُحفظون للمباريات التالية. أنديتنا بقوائمها في الدوري.</p>
      <p class="hint" style="margin:0">تُحفظ في وثيقة مستقلة (${DOC_ID})، فلا تدخل ترتيب الدوري ولا الهدافين ولا ملفات اللاعبين ولا التقييمات ولا الفانتسي.</p>
    </div>
    <div class="segbar xadm-pick" role="tablist">${CX.map(c=>`<button class="seg" type="button" data-xadm="comp" data-c="${c.id}" aria-pressed="${c.id===ADM_C}"><img src="assets/comps/${c.id}.webp" alt="" width="22" height="22">${H(cName(c.id))}</button>`).join("")}</div>
    ${CX.filter(c=>c.id===ADM_C).map(c=>{ const name = cName(c.id), ms = DATA.matches.filter(m=>m.comp===name);
      const clubs = teamsOf(c.id).filter(t=>ours().includes(t));
      return `<div class="card pad xadm-comp" data-xcomp="${c.id}">
        <div class="xadm-hd"><img src="assets/comps/${c.id}.webp" alt="" width="40" height="40" loading="lazy"><div><b>${H(name)}</b><small>${clubs.map(H).join(" · ")} · ${ms.length} مباراة</small></div>
          <button class="btn ghost" data-xadm="new" data-c="${c.id}">+ إضافة مباراة</button></div>
        <div class="gadm-list">${ms.length ? daysHTML(ms) : `<p class="hint">لا مباريات بعد.</p>`}</div>
        <p class="hint" style="margin:10px 0 0">الجولات 1–${c.g} = دور المجموعات، وما بعدها خروج المغلوب (أشواط إضافية وركلات ترجيح).</p>
      </div>`; }).join("")}
    </div>`;
}

async function saveFresh(mutate){
  const base = await store.fresh();
  const d = normalize(base ? clone(base) : clone(DATA));
  mutate(d); const w = await store.save(d); DATA = normalize(d); if(w && w.updated) DATA.updated = w.updated;
}
function paintAdmin(){
  const box = document.getElementById("extAdmin"); if(!box) return;
  if(box.contains(document.activeElement) && /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) return;   /* لا نقاطع الكتابة */
  const tmp = document.createElement("div"); tmp.innerHTML = adminHTML(); box.replaceWith(tmp.firstElementChild);
}
function repaint(){
  paintAdmin();
  try{ if(document.querySelector("#v-matches.on") && typeof renderMatches==="function" && (MXC==="upcoming" || cOf(MXC))) renderMatches(); }catch(e){}
  try{ if(typeof MP==="object" && MP && MP.m && MP.m.__ext){ const k = matchKey(MP.m), n = findExt(k); if(n){ MP.m = n; renderMatchPage(); } } }catch(e){}
}
X.repaint = repaint;
const canEdit = () => TEST || (typeof isAdmin!=="undefined" && !!isAdmin);
function injectAdmin(){
  const v = document.getElementById("v-admin"); if(!v || document.getElementById("extAdmin") || !canEdit()) return;
  if(!document.getElementById("matchAdmin")) return;
  const w = document.createElement("div"); w.innerHTML = adminHTML(); v.appendChild(w.firstElementChild);
}
document.addEventListener("click", async e=>{
  const b = e.target.closest("[data-xadm]"); if(!b) return;
  const a = b.dataset.xadm, m = b.dataset.k ? findExt(b.dataset.k) : null;
  const toMatches = () => { if(window.ADMIN_TABS) ADMIN_TABS.open("matches"); setTimeout(()=>{ const x = document.getElementById("matchAdmin"); if(x) x.scrollIntoView({block:"start"}); }, 80); };
  if(a==="comp"){ ADM_C = b.dataset.c; try{ localStorage.setItem("mf-xadm", ADM_C); }catch(_){} paintAdmin(); return; }
  if(a==="new"){ const c = cOf(b.dataset.c) || CX[0];
    EDIT = withExt(()=>newEdit()); EDIT.ext = true; EDIT.match.comp = cName(c.id); EDIT.match.round = "1"; FORMERR = "";
    const cl = teamsOf(c.id).filter(t=>ours().includes(t)); if(cl.length===1) EDIT.match.home = cl[0];
    toMatches(); renderMatchAdmin(); }
  if(a==="edit" && m){ EDIT = withExt(()=>loadEdit(m)); EDIT.ext = true; FORMERR = ""; if(window.MX){ MX.tab = "match"; } toMatches(); renderMatchAdmin(); }
  if(a==="rm" && m){ if(!confirm(`حذف ${m.home} × ${m.away} وكل أحداثها من المشاركات الخارجية؟`)) return;
    const mk = `${m.round}|${m.comp}|${m.home}|${m.away}`, fk = fxKey(m.comp, m.round, m.home, m.away);
    try{ await saveFresh(d=>{ const keep = DATA; DATA = d; try{ withExt(()=>removeMatchByKey(mk)); } finally { DATA = keep; } if(!d.removed.includes(fk)) d.removed.push(fk); });
      toast("حُذفت المباراة","ok"); }
    catch(x){ toast("تعذّر الحذف: "+(x.code||x.message),"err"); }
    repaint(); }
}, true);

function hookAdmin(){
  ["renderAdmin","renderEditorAdmin"].forEach(n=>{ const f = window[n]; if(typeof f!=="function" || f.__extadm) return;
    const w = function(){ const r = f.apply(this, arguments);
      try{ injectAdmin(); if(window.ADMIN_TABS){ const v = document.getElementById("v-admin"); if(v && v.querySelector(".adm-tabs")){ v.querySelector(".adm-tabs").remove(); v.querySelectorAll(".adm-panel").forEach(p=>{ while(p.firstChild) v.insertBefore(p.firstChild, p); p.remove(); }); ADMIN_TABS.organize(); } } }catch(e){ console.error(e); }
      return r; };
    w.__extadm = true; Object.keys(f).forEach(k=>{ try{ w[k] = f[k]; }catch(e){} }); w.__gulfadm = f.__gulfadm; w.__tabs = f.__tabs; w.__lv = f.__lv;
    try{ window[n] = w; }catch(e){} try{ if(n==="renderAdmin") renderAdmin = w; else renderEditorAdmin = w; }catch(e){}
  });
  if(typeof RENDER==="object" && RENDER) RENDER.admin = window.renderAdmin;
}
function boot(){
  if(!DATA) DATA = normalize(null);
  hookSite(); hookEditor(); hookAdmin();
}
/* بعد gulf.js (80ms) حتى تلتف خطافاتنا حول خطافاته */
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", ()=>setTimeout(boot, 120)); else setTimeout(boot, 120);
})();
