/* =========================================================================
   mfsoccer — صفحة «التحليل» الموسّعة + تقييم اللاعبين الجديد + البحث العام
   (منصور 2026-09-29)

   القاعدة: كل رقم هنا يُحسب لحظة العرض من بيانات الموقع المسجّلة يدوياً فقط
   (ALL.matches / goals / cards / pens / lineups / subs + كشوفات SQUADS)، وبدوال
   الموقع نفسها: playedMatches، matchGoals، xiNames، matchSubs، playerMatchMinutes،
   playerWindow، matchLen، csLimit، isRed، isOG، playerProfileData، crewOf.
   لا API خارجي، ولا حقول جديدة في قاعدة البيانات، ولا إحصائية غير مسجّلة:
   - التصديات والمساهمات الدفاعية غير مسجّلة في الموقع ← غير موجودة هنا.
   - الإنذار الثاني يُحتسب بطاقة حمراء (isRed) والصفراء = الإنذار العادي فقط.
   ========================================================================= */
'use strict';
(function(){

/* ───────────── أدوات عامة ───────────── */
const $a = s => document.querySelector(s);
const H = s => esc(String(s==null?"":s));
const num = v => Number.isFinite(v) ? v : 0;
const f2 = v => (Math.round(num(v)*100)/100).toFixed(2);
const f1 = v => (Math.round(num(v)*10)/10).toFixed(1);
const initials = n => String(n||"").trim().split(/\s+/).slice(0,2).map(w=>w[0]||"").join("");
const isYel = t => isYellow(t) && !isRed(t);          /* إنذار عادي فقط */
const byAr = (a,b) => String(a).localeCompare(String(b),"ar");
const norm = s => String(s||"").normalize("NFKC")
  .replace(/[ً-ٰٟـ]/g,"")
  .replace(/[أإآٱ]/g,"ا").replace(/ة/g,"ه").replace(/ى/g,"ي").replace(/ؤ/g,"و").replace(/ئ/g,"ي")
  .toLowerCase().replace(/\s+/g," ").trim();
function face(n, c, cls){
  let cut=null; try{ cut=(PHOTOSON && typeof LOCAL_PHOTOS!=="undefined") ? photoCut(n,c) : null; }catch(e){}
  return `<span class="ax-face${cls?" "+cls:""}">${cut?`<img src="${cut}_f.webp?v=29" alt="" loading="lazy" decoding="async">`:`<i>${H(initials(n))}</i>`}</span>`;
}
const pbtn = (n,c,inner) => `<button type="button" class="rf-name ax-pl" data-ax-p="${H(n)}" data-ax-c="${H(c)}">${inner}</button>`;

/* ذاكرة مؤقتة: تُبطَل تلقائياً عند أي تغيّر في البيانات أو المسابقة */
const stamp = () => [COMP, (ALL&&ALL.updated)||"", typeof DATA_UPDATED!=="undefined"?DATA_UPDATED:"", MATCHES.length, GOALS.length, CARDS.length, PENS.length,
  (ALL&&ALL.lineups||[]).length, (ALL&&ALL.subs||[]).length, typeof CUR_STAMP!=="undefined"?CUR_STAMP:""].join("|");
const MEMO = {k:"", m:new Map()};
function memo(key, fn){
  const s=stamp(); if(MEMO.k!==s){ MEMO.k=s; MEMO.m=new Map(); }
  if(!MEMO.m.has(key)) MEMO.m.set(key, fn());
  return MEMO.m.get(key);
}

/* ───────────── السجل الأساسي: مشاركة لاعب في مباراة ─────────────
   صف لكل لاعب شارك (دقائق > 0) في مباراة مُقامة ضمن المسابقة المختارة.
   الدقائق والنافذة من دوال الموقع؛ الأهداف والبطاقات والجزاءات من سجلات المباراة نفسها. */
function entries(){
  return memo("entries", ()=>{
    const out=[];
    playedMatches().forEach(m=>{
      const comp=compOf(m), LEN=matchLen(m), gs=matchGoals(m);
      const cs=CARDS.filter(x=>+x.r===+m.round && compOf(x)===comp && (x.club===m.home||x.club===m.away));
      const ps=PENS.filter(x=>+x.r===+m.round && compOf(x)===comp && ((x.by===m.home&&x.vs===m.away)||(x.by===m.away&&x.vs===m.home)));
      [m.home, m.away].forEach(club=>{
        const xi=xiNames(m.round, comp, club), men=new Set(xi);
        matchSubs(m).filter(s=>s.club===club && s.in).forEach(s=>men.add(s.in));
        const gf=club===m.home?+m.hg:+m.ag, ga=club===m.home?+m.ag:+m.hg;
        men.forEach(n=>{
          const mins=playerMatchMinutes(m, club, n); if(mins<=0) return;
          const w=playerWindow(m, club, n) || {start:0, end:LEN};
          const inW=t=>{ t=Math.min(LEN, +t||0); return t>=w.start && (w.end>=LEN || t<=w.end); };
          const mine=gs.filter(g=>g.sc===club && g.p===n && !isOG(g));
          const myC=cs.filter(x=>x.club===club && x.p===n);
          const myP=ps.filter(x=>x.by===club && x.p===n);
          const gk=isGoalkeeper(club, n);
          const faced=gk ? ps.filter(x=>x.vs===club && inW(goalAbs(m,x))) : [];
          out.push({m, club, n, mins, LEN, start:xi.includes(n), share:Math.min(1, mins/LEN),
            g:mine.length, pg:mine.filter(g=>g.det==="ركلة جزاء").length,
            a:gs.filter(g=>g.sc===club && g.a===n && !isOG(g)).length,
            og:gs.filter(g=>isOG(g) && g.cd===club && (g.og||g.p)===n).length,
            y:myC.filter(x=>isYel(x.type)).length, r:myC.filter(x=>isRed(x.type)).length,
            pk:myP.length, pks:myP.filter(x=>x.res==="سجلت").length,
            gfOn:gs.filter(g=>g.sc===club && inW(goalAbs(m,g))).length,     /* نفس ساعة التبديلات */
            gaOn:gs.filter(g=>g.cd===club && inW(goalAbs(m,g))).length,
            gf, ga, pts: gf>ga?3:gf===ga?1:0, res: gf>ga?"w":gf===ga?"d":"l",
            csOK: ga===0 && mins>=csLimit(m), full: mins>=csLimit(m), gk,
            faced:faced.length, saved:faced.filter(x=>x.res==="تصدى لها الحارس").length});
        });
      });
    });
    return out;
  });
}
const dateKey = m => `${m.date||"9999-99-99"}|${String(m.round).padStart(3,"0")}`;

/* تجميع اللاعبين (جدول «أداء اللاعبين» و«الحراس»).
   المباريات/الأساسي/البديل/الدقائق/الشباك النظيفة/المستقبَلة من entries،
   والأهداف والصناعة والبطاقات والجزاءات والعكسية من سجلاتها مباشرة (حتى لو لم تُسجَّل تشكيلة المباراة). */
function playersAgg(){
  return memo("agg", ()=>{
    const map=new Map();
    const get=(n,c)=>{ n=String(n||"").trim(); c=String(c||"").trim(); if(!n||!c) return null; const k=n+"|"+c;
      if(!map.has(k)) map.set(k,{n,c,apps:0,starts:0,subs:0,mins:0,g:0,a:0,y:0,r:0,cs:0,pk:0,pks:0,og:0,gaOn:0,faced:0,saved:0,gk:isGoalkeeper(c,n),log:[]});
      return map.get(k); };
    entries().forEach(e=>{ const p=get(e.n,e.club); p.apps++; p.mins+=e.mins; e.start?p.starts++:p.subs++;
      if(p.gk && e.csOK) p.cs++; p.gaOn+=e.gaOn; p.faced+=e.faced; p.saved+=e.saved; p.log.push(e); });
    GOALS.forEach(g=>{ if(isOG(g)){ const p=get(g.og||g.p, g.cd); if(p) p.og++; return; }
      const p=get(g.p, g.sc); if(p) p.g++; if(g.a){ const q=get(g.a, g.sc); if(q) q.a++; } });
    CARDS.forEach(x=>{ const p=get(x.p, x.club); if(!p) return; if(isRed(x.type)) p.r++; else if(isYel(x.type)) p.y++; });
    PENS.forEach(x=>{ const p=get(x.p, x.by); if(!p) return; p.pk++; if(x.res==="سجلت") p.pks++; });
    const L=[...map.values()];
    L.forEach(p=>p.log.sort((a,b)=>dateKey(b.m).localeCompare(dateKey(a.m))));
    return L;
  });
}

/* =========================================================================
   تقييم اللاعبين الجديد (0–100) — حسب المركز، من بيانات الموقع وحدها
   -------------------------------------------------------------------------
   1) المركز من الكشف: GK ← حارس؛ CB/LB/RB/LWB/RWB ← دفاع؛ CDM/CM/CAM/LM/RM ← وسط؛
      ST/CF/LW/RW ← هجوم. (الأجنحة تُحفظ في الموقع LM/RM فتُقيَّم كلاعبي وسط.)
      بلا مركز محفوظ = بلا تقييم.
   2) لكل لاعب مقاييس «لكل 90 دقيقة» أو «لكل مباراة» — لا مجاميع خام.
   3) حجم العينة: كل معدل يُسحب نحو متوسط مركزه بعيّنة افتراضية K
      (3 مباريات كاملة = 270 دقيقة):  المعدل = (قيمته + متوسط المركز × K) ÷ (مقامه + K)
      فلاعب 3 مباريات/3 أهداف لا يقفز إلى القمة، ومن أكمل 15 مباراة يبقى رقمه قريباً من أدائه الفعلي.
   4) كل مقياس يتحول إلى «مئين» داخل لاعبي المركز نفسه فقط (من لعب 90 دقيقة فأكثر):
      85 = أفضل من 85% من لاعبي مركزه. فالحارس يُقارَن بالحرّاس والمهاجم بالمهاجمين.
      المقياس الذي لا تختلف قيمه بين لاعبي المركز (لا بيانات له) يُستبعد وتُوزَّع أوزانه على الباقي.
   5) الفئة = متوسط مئينات مقاييسها؛ النتيجة = مجموع الفئات بأوزانها ÷ مجموع الأوزان المتاحة.
   6) توازن المراكز (منصور 2026-09-29: «الحراس وايد عالي»): فئات الحارس كلها تقيس دفاع فريقه فتتحرك معاً،
      فكان مدى الحراس ضعف مدى لاعبي الوسط. لذلك تُوحَّد كل المراكز على نفس المتوسط ونفس المدى:
      z = (نتيجة اللاعب − متوسط مركزه) ÷ انحراف مركزه المعياري
      التقييم من 10 = 6.4 + 0.9 × z  (بين 4.0 و9.7، بلون تقييمات الموقع)
      ⇒ متوسط كل مركز 6.4، والمتميّز في مركزه (أعلى 10% تقريباً) فوق 7.5 — أياً كان مركزه.
   ========================================================================= */
const RATING_MODEL = {
  K: 3,               /* عيّنة افتراضية بوحدة «مباراة كاملة» */
  minMinutes: 90,     /* أقل من 90 دقيقة = عيّنة غير كافية، بلا تقييم */
  mean: 6.4, spread: 0.9, lo: 4.0, hi: 9.7,
  scale: z => Math.round(Math.max(4.0, Math.min(9.7, 6.4 + 0.9*z))*10)/10,   /* z داخل المركز ← من 10 */
  catScale: v => Math.round(30 + 0.65*v)/10,                                 /* عرض الفئة (مئين 0–100) على مقياس من 10 */
  /* المقاييس — كلها من entries (بيانات الموقع). dir: 1 الأعلى أفضل، -1 الأقل أفضل */
  metrics: {
    csRate:  {label:"شباك نظيفة لكل مباراة كاملة", dir:1,  x:p=>p.cs,  d:p=>p.full, unit:"/مباراة"},
    gaOn90:  {label:"أهداف استقبلها فريقه بوجوده /90", dir:-1, x:p=>p.gaOn, d:p=>p.n90, unit:"/90"},
    penSave: {label:"نسبة التصدي لركلات الجزاء", dir:1, x:p=>p.saved, d:p=>p.faced, unit:""},
    ptsRate: {label:"نقاط فريقه لكل مباراة بوجوده", dir:1, x:p=>p.ptsW, d:p=>p.shareSum, unit:"/مباراة"},
    avail:   {label:"نسبة الدقائق من دقائق فريقه", dir:1, raw:p=>p.teamMins? p.mins/p.teamMins : 0, unit:"%"},
    goals90: {label:"الأهداف /90 (الجزاء بنصف هدف، والجزاء الضائع يُخصم نصفاً)", dir:1, x:p=>p.npg + 0.5*p.pg - 0.5*p.pkm, d:p=>p.n90, unit:"/90"},
    ast90:   {label:"الصناعة /90", dir:1, x:p=>p.a, d:p=>p.n90, unit:"/90"},
    ga90:    {label:"الأهداف + الصناعة /90", dir:1, x:p=>p.g + p.a, d:p=>p.n90, unit:"/90"},
    gfOn90:  {label:"أهداف فريقه بوجوده /90", dir:1, x:p=>p.gfOn, d:p=>p.n90, unit:"/90"},
    disc90:  {label:"البطاقات /90 (صفراء 1، حمراء 3، هدف عكسي 2)", dir:-1, x:p=>p.y + 3*p.r + 2*p.og, d:p=>p.n90, unit:"/90"},
  },
  /* الفئات والأوزان لكل مركز (المجموع 100) — لا مساهمات دفاعية لأنها غير مسجّلة */
  groups: {
    GK:  {label:"حارس مرمى", cats:[
      {k:"cs",      label:"الشباك النظيفة",  w:30, m:["csRate"]},
      {k:"prevent", label:"منع الأهداف",     w:30, m:["gaOn90"]},
      {k:"pens",    label:"ركلات الجزاء",    w:10, m:["penSave"]},
      {k:"results", label:"نتائج الفريق",    w:15, m:["ptsRate"]},
      {k:"avail",   label:"الحضور",          w:15, m:["avail"]} ]},
    DEF: {label:"مدافع", cats:[
      {k:"solid",   label:"الصلابة الدفاعية", w:30, m:["gaOn90"]},
      {k:"cs",      label:"الشباك النظيفة",   w:20, m:["csRate"]},
      {k:"attack",  label:"المساهمة الهجومية", w:15, m:["ga90"]},
      {k:"results", label:"نتائج الفريق",     w:15, m:["ptsRate"]},
      {k:"avail",   label:"الحضور",           w:15, m:["avail"]},
      {k:"disc",    label:"الانضباط",         w:5,  m:["disc90"]} ]},
    MID: {label:"لاعب وسط", cats:[     /* الأهداف والصناعة فئة واحدة: من سجّل 3 ولم يصنع لا يُعاقَب على الصناعة وحدها */
      {k:"attack",  label:"الأهداف والصناعة",  w:35, m:["ga90"]},
      {k:"teamAtt", label:"هجوم الفريق بوجوده", w:10, m:["gfOn90"]},
      {k:"defend",  label:"دفاع الفريق بوجوده", w:10, m:["gaOn90"]},
      {k:"results", label:"نتائج الفريق",      w:20, m:["ptsRate"]},
      {k:"avail",   label:"الحضور",            w:20, m:["avail"]},
      {k:"disc",    label:"الانضباط",          w:5,  m:["disc90"]} ]},
    ATT: {label:"مهاجم", cats:[
      {k:"finish",  label:"إنهاء الهجمات",     w:35, m:["goals90"]},
      {k:"create",  label:"صناعة اللعب",       w:15, m:["ast90"]},
      {k:"attack",  label:"هجوم الفريق بوجوده", w:10, m:["gfOn90"]},
      {k:"results", label:"نتائج الفريق",      w:20, m:["ptsRate"]},
      {k:"avail",   label:"الحضور",            w:15, m:["avail"]},
      {k:"disc",    label:"الانضباط",          w:5,  m:["disc90"]} ]},
  }
};
const POS_GROUP = {GK:"GK", CB:"DEF",LB:"DEF",RB:"DEF",LWB:"DEF",RWB:"DEF", CDM:"MID",CM:"MID",CAM:"MID",LM:"MID",RM:"MID", ST:"ATT",CF:"ATT",LW:"ATT",RW:"ATT"};
function posOf(club, n){ let e=(SQUADS[club]||[]).find(x=>sqName(x)===n);
  if(!e) for(const c of Object.keys(SQUADS||{})){ e=(SQUADS[c]||[]).find(x=>sqName(x)===n); if(e) break; }   /* انتقل لنادٍ آخر (شيلدون) */
  return String(e?sqPos(e):"").toUpperCase(); }
const groupOf = (club, n) => POS_GROUP[posOf(club,n)] || "";

/* التقييم لكل لاعب حتى جولة معيّنة (cut) — cut=null: كل الجولات */
function computeRatings(cut){
  return memo("rate|"+cut, ()=>{
    const es=entries().filter(e=>cut==null || +e.m.round<=+cut);
    const teamMins={}; const seen=new Set();
    es.forEach(e=>{ const k=e.club+"|"+matchKey(e.m); if(seen.has(k)) return; seen.add(k); teamMins[e.club]=(teamMins[e.club]||0)+e.LEN; });
    const P=new Map();
    es.forEach(e=>{ const k=e.n+"|"+e.club;
      const p=P.get(k)||P.set(k,{n:e.n,c:e.club,mins:0,apps:0,full:0,cs:0,g:0,npg:0,pg:0,pkm:0,a:0,og:0,y:0,r:0,gfOn:0,gaOn:0,ptsW:0,shareSum:0,faced:0,saved:0}).get(k);
      p.mins+=e.mins; p.apps++; if(e.full) p.full++; if(e.csOK) p.cs++;
      p.g+=e.g; p.pg+=e.pg; p.npg+=e.g-e.pg; p.pkm+=e.pk-e.pks; p.a+=e.a; p.og+=e.og; p.y+=e.y; p.r+=e.r;
      p.gfOn+=e.gfOn; p.gaOn+=e.gaOn; p.ptsW+=e.pts*e.share; p.shareSum+=e.share; p.faced+=e.faced; p.saved+=e.saved; });
    const out=new Map();
    const M=RATING_MODEL.metrics;
    Object.keys(RATING_MODEL.groups).forEach(gk=>{
      const G=RATING_MODEL.groups[gk];
      const all=[...P.values()].filter(p=>groupOf(p.c,p.n)===gk);
      all.forEach(p=>{ p.n90=p.mins/90; p.teamMins=teamMins[p.c]||0; p.grp=gk; });
      const pool=all.filter(p=>p.mins>=RATING_MODEL.minMinutes);
      if(!pool.length) return;
      /* قيمة كل مقياس بعد السحب نحو متوسط المركز */
      const val={}, avail={};
      new Set(G.cats.flatMap(c=>c.m)).forEach(mk=>{
        const d=M[mk]; let fn;
        if(d.raw) fn=d.raw;
        else {
          const sx=pool.reduce((s,p)=>s+d.x(p),0), sd=pool.reduce((s,p)=>s+d.d(p),0);
          if(sd<=0){ avail[mk]=false; return; }
          const mu=sx/sd, K=RATING_MODEL.K;
          fn=p=>(d.x(p)+mu*K)/(d.d(p)+K);
        }
        val[mk]=new Map(all.map(p=>[p, fn(p)]));
        const vs=pool.map(p=>val[mk].get(p));
        avail[mk]=Math.max(...vs)-Math.min(...vs)>1e-9;       /* لا تباين = لا بيانات تميّز = يُستبعد */
      });
      const pctl=(mk,p)=>{ const v=val[mk].get(p), dir=M[mk].dir; let below=0, eq=0;
        pool.forEach(q=>{ const u=val[mk].get(q); if(Math.abs(u-v)<1e-9) eq++; else if(dir>0 ? u<v : u>v) below++; });
        if(!pool.includes(p)) eq++;                              /* لاعب خارج العيّنة يُقارَن بها دون أن يُحسب منها */
        return 100*(below+0.5*(eq-1))/Math.max(1,pool.length-(pool.includes(p)?1:0)); };
      const rows=[];
      all.forEach(p=>{
        if(p.mins<RATING_MODEL.minMinutes) return;
        const cats=G.cats.map(c=>{ const ms=c.m.filter(mk=>avail[mk]);
          if(!ms.length) return {k:c.k, label:c.label, w:c.w, v:null, raw:[]};
          const v=ms.reduce((s,mk)=>s+pctl(mk,p),0)/ms.length;
          return {k:c.k, label:c.label, w:c.w, v:Math.round(Math.max(0,Math.min(100,v))),
            raw:ms.map(mk=>({k:mk, label:M[mk].label, unit:M[mk].unit, v:mk==="avail"?Math.round(100*val[mk].get(p)):val[mk].get(p)}))};
        });
        const on=cats.filter(c=>c.v!=null), W=on.reduce((s,c)=>s+c.w,0);
        const comp=W ? on.reduce((s,c)=>s+c.w*c.v,0)/W : 50;
        rows.push({n:p.n, c:p.c, grp:gk, pos:posOf(p.c,p.n), mins:p.mins, apps:p.apps, comp, cats, poolN:pool.length});
      });
      /* توحيد المراكز: نفس المتوسط والمدى لكل مركز */
      const mu=rows.reduce((s,x)=>s+x.comp,0)/rows.length;
      const sd=Math.sqrt(rows.reduce((s,x)=>s+(x.comp-mu)**2,0)/rows.length) || 1;
      rows.forEach(x=>{ x.z=(x.comp-mu)/sd; x.v=RATING_MODEL.scale(x.z); out.set(x.n+"|"+x.c, x); });
    });
    return out;
  });
}
function ratingHistory(n, c){
  if(COMP==="الكل") return null;                 /* الجولات تختلف بين المسابقات */
  const rounds=[...new Set(playedMatches().map(m=>+m.round))].sort((a,b)=>a-b);
  return rounds.map(r=>{ const x=computeRatings(r).get(n+"|"+c); return x?{r, v:x.v}:null; }).filter(Boolean);
}
/* نفس ألوان تقييمات المباريات في الموقع (ratingCls/ratingBadge): أخضر جيد، أصفر متوسط 6.0، برتقالي/أحمر ضعيف */
const rateCls = v => ratingCls(v);
const rateLbl = v => v>=9?"أداء استثنائي":v>=8?"أداء ممتاز":v>=7?"أداء جيد":v>=6?"متوسط":"أقل من المتوسط";
const rateBadge = (v, big) => ratingBadge(v, big);
const catVal = v => RATING_MODEL.catScale(v);          /* الفئة على مقياس التقييم نفسه */
window.PRATING = {
  model: RATING_MODEL,
  all: () => computeRatings(null),
  of: (n,c) => computeRatings(null).get(n+"|"+c) || null,
  badge: rateBadge, label: rateLbl, history: ratingHistory, groupOf
};

/* ───────────── حالة الصفحة ───────────── */
const AX = window.AX = {
  tab:"overview", sub:{teams:"form", players:"perf"}, sel:null, anim:false,
  sorts:{perf:{k:"mins",d:-1}, gk:{k:"mins",d:-1}, form:{k:"pts",d:-1}, ha:{k:"hpts",d:-1}, discT:{k:"y",d:-1},
         discY:{k:"y",d:-1}, discR:{k:"r",d:-1}, discRd:{k:"r",d:1}, stad:{k:"m",d:-1}, rate:{k:"v",d:-1}, adv:{k:"xg",d:-1}},
  perf:{q:"", club:"", pos:"", x:"", lim:30}, pform:{q:"", club:"", by:"ga", lim:12},
  ha:{club:""}, stad:{sel:""}, rate:{grp:"", lim:30}, adv:{per:true}
};
const TABS=[["overview","نظرة عامة",'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'],
  ["teams","الفرق",'<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.9 7.5-9.5V6z"/>'],
  ["players","اللاعبون",'<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20.5c.6-4 3.6-6.3 7.5-6.3s6.9 2.3 7.5 6.3"/>'],
  ["refs","الحكام",'<circle cx="9" cy="14" r="5"/><path d="M13.5 11.5 21 8V5l-9.5 4.2"/>']];
const SUBS={
  teams:[["form","الفورمة"],["adv","الأرقام المتقدمة"],["ha","الأرض والخارج"],["disc","الانضباط"],["stad","الملاعب"]],
  players:[["perf","أداء اللاعبين"],["pform","فورمة اللاعبين"],["gk","الحراس"],["rate","التقييم"]]
};

/* ───────────── مكوّنات مشتركة ───────────── */
function sortBy(L, scope, keys){
  const s=AX.sorts[scope], f=keys[s.k]||keys[Object.keys(keys)[0]];
  return [...L].sort((a,b)=>{ const va=f(a), vb=f(b);
    const d=(typeof va==="string"||typeof vb==="string") ? byAr(va,vb) : (num(va)-num(vb));
    return d*s.d || byAr(a.n||a.c||"", b.n||b.c||""); });
}
/* عناوين الأعمدة أيقونات بدل الحروف المختصرة (منصور 2026-09-29: «مرتب واحترافي»)،
   والكلمة في التلميح وقارئ الشاشة، وسطر صغير تحت الجدول يشرح الأيقونات. */
const SV = p => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const ICONS = {
  match:  SV('<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M12 5v14"/><circle cx="12" cy="12" r="2.6"/><path d="M2.5 9.5h2.3v5H2.5M21.5 9.5h-2.3v5h2.3"/>'),
  clock:  SV('<circle cx="12" cy="13" r="8"/><path d="M12 9v4.2l2.6 1.6M9.5 2.5h5"/>'),
  goal:   SV('<defs><clipPath id="axBallClip"><circle cx="12" cy="12" r="9.3"/></clipPath></defs><circle cx="12" cy="12" r="9.3" fill="currentColor" fill-opacity=".1" stroke="none"/><g clip-path="url(#axBallClip)"><path d="M12.00 8.80 L15.04 11.01 L13.88 14.59 L10.12 14.59 L8.96 11.01Z M12.00 5.70 L9.43 3.83 L10.41 0.82 L13.59 0.82 L14.57 3.83Z M17.99 10.05 L18.97 7.03 L22.15 7.03 L23.13 10.05 L20.56 11.92Z M15.70 17.10 L18.88 17.10 L19.86 20.12 L17.29 21.98 L14.72 20.12Z M8.30 17.10 L9.28 20.12 L6.71 21.98 L4.14 20.12 L5.12 17.10Z M6.01 10.05 L3.44 11.92 L0.87 10.05 L1.85 7.03 L5.03 7.03Z" fill="currentColor" stroke="none"/><path d="M12.00 8.80 L12.00 5.70 M9.43 3.83 L17.47 4.48 M14.57 3.83 L6.53 4.48 M15.04 11.01 L17.99 10.05 M18.97 7.03 L20.84 14.87 M20.56 11.92 L17.47 4.48 M13.88 14.59 L15.70 17.10 M18.88 17.10 L12.00 21.30 M14.72 20.12 L20.84 14.87 M10.12 14.59 L8.30 17.10 M9.28 20.12 L3.16 14.87 M5.12 17.10 L12.00 21.30 M8.96 11.01 L6.01 10.05 M3.44 11.92 L6.53 4.48 M5.03 7.03 L3.16 14.87" stroke-width=".85"/></g><circle cx="12" cy="12" r="9.3" stroke-width="1.3"/>'),   /* كرة واقعية (خماسي في الوسط + رقع الحافة) بلون الأيقونات المجاورة (منصور 2026-09-29) */
  assist: SV('<path d="M3.2 15.6c-.1-3 .5-5.9 2.3-7.2.5-.4 1-.5 1.6-.5h2.4c.8 0 1.5.5 1.8 1.2l.8 1.9c.4 1 1.3 1.7 2.4 1.8l4.4.6c2.1.3 3.3 1.5 3.3 2.9 0 .9-.6 1.5-1.6 1.5H4.8c-.9 0-1.6-.8-1.6-2.2z"/><path d="M6.5 18v1.8M10.5 18v1.8M15 18v1.8M19 18v1.8"/>'),
  cs:     SV('<path d="M12 3 5 6v5.5c0 4.4 3 8 7 9.5 4-1.5 7-5.1 7-9.5V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>'),
  conc:   SV('<path d="M2.5 19V6h19v13"/><path d="M2.5 10.5h19M2.5 14.8h19M7.3 6v13M12 6v13M16.7 6v13" stroke-width="1" opacity=".45"/><circle cx="15.5" cy="14.5" r="2.8" fill="currentColor" stroke="none"/>'),
  pen:    SV('<path d="M3 14.5V5.5h18v9"/><path d="M8 14.5V9.5h8v5" stroke-width="1.2" opacity=".6"/><circle cx="12" cy="19.4" r="1.8" fill="currentColor" stroke="none"/>'),
  save:   SV('<path d="M7.5 12V7a1.5 1.5 0 0 1 3 0v4M10.5 10.5V5.2a1.5 1.5 0 0 1 3 0v5.3M13.5 10.5V6.2a1.5 1.5 0 0 1 3 0v6.3M16.5 11.5V9.5a1.5 1.5 0 0 1 3 0v4.2c0 4.1-2.9 7.3-6.9 7.3h-.8c-2.5 0-4.1-1.1-5.3-3l-2.3-3.7a1.6 1.6 0 0 1 2.6-1.9l.7 1"/>'),
  start:  SV('<path d="M8.5 3.5 4 6l1.8 4 2-.9v11.4h8.4V9.1l2 .9L20 6l-4.5-2.5c-.4 1.4-1.8 2.4-3.5 2.4s-3.1-1-3.5-2.4z"/>'),
  sub:    SV('<path d="M7 4v13M3.5 13.5 7 17l3.5-3.5M17 20V7M13.5 10.5 17 7l3.5 3.5"/>'),
  og:     SV('<circle cx="12" cy="12" r="8.5"/><path d="M16 12H8m0 0 3-3m-3 3 3 3"/>'),
  cards:  SV('<rect x="4.5" y="5" width="9" height="13" rx="1.6" transform="rotate(-10 9 11.5)"/><rect x="10.5" y="6" width="9" height="13" rx="1.6" transform="rotate(8 15 12.5)"/>'),
  var:    `<span class="ax-var">VAR</span>`
};
const LABEL_ICON = {"مباريات":"match","المباريات":"match","دقائق":"clock","أهداف":"goal","صناعة":"assist","شباك نظيفة":"cs","استقبل":"conc",
  "جزاءات واجهها":"pen","ركلات جزاء":"pen","ركلات جزاء له":"pen","تصدى لها":"save","أساسي":"start","بديل":"sub","أهداف عكسية":"og","بطاقة":"cards"};
window.axIcon = k => ICONS[k] || "";
window.axLbl = t => { const k=LABEL_ICON[t]; return k ? `<span class="ax-ic" role="img" aria-label="${t}" title="${t}">${ICONS[k]}</span>` : t; };
window.axAbbr = labels => { const L=[...new Set(labels)].filter(t=>LABEL_ICON[t]);
  return L.length ? `<p class="ax-abbr">${L.map(t=>`<span><i class="ax-ic">${ICONS[LABEL_ICON[t]]}</i><span>${t}</span></span>`).join("")}</p>` : ""; };
/* أول 4 صفوف فقط، و«عرض المزيد» يُظهر الباقي (منصور 2026-09-29) — الحالة تبقى بعد الفرز */
const OPEN = new Set(["form","ha","adv"]);   /* جدولا الفرق (الفورمة وكل الفرق) كاملان دائماً بلا «عرض المزيد» (منصور 2026-09-29) */
const NO_MORE = new Set(["form","ha","adv"]);
window.tblClip = scope => OPEN.has(scope) ? "" : " ax-clip";
window.tblMore = (scope, n) => n>4 && !NO_MORE.has(scope) ? `<button type="button" class="ts-morebtn ax-more" data-tbl-more="${scope}" aria-expanded="${OPEN.has(scope)}"><span>${OPEN.has(scope)?"عرض أقل":"عرض المزيد"}</span>${OPEN.has(scope)?"":`<small>+${n-4}</small>`}</button>` : "";
document.addEventListener("click", e=>{
  const b=e.target.closest("[data-tbl-more]"); if(!b) return;
  const k=b.dataset.tblMore, card=b.previousElementSibling && b.previousElementSibling.classList.contains("ax-abbr") ? b.previousElementSibling.previousElementSibling : b.previousElementSibling;
  if(OPEN.has(k)) OPEN.delete(k); else OPEN.add(k);
  if(card) card.classList.toggle("ax-clip", !OPEN.has(k));
  const n=card ? card.querySelectorAll("tbody tr").length : 0;
  b.outerHTML=tblMore(k, n);
  if(!OPEN.has(k) && card){ const y=card.getBoundingClientRect().top; if(y<0) card.scrollIntoView({block:"start", behavior:"smooth"}); }
});
function thead(scope, cols){
  const s=AX.sorts[scope];
  return `<thead><tr>${cols.map(([k,t,cls])=>{ const lb=axLbl(t); if(!k) return `<th class="${cls||""}"><span>${lb}</span></th>`;
    const on=s.k===k; return `<th class="${cls||""}" aria-sort="${on?(s.d>0?"ascending":"descending"):"none"}"><button type="button" data-ax-sort="${scope}:${k}" class="${on?"on":""}">${lb}${on?`<i class="rf-ar">${s.d>0?"▲":"▼"}</i>`:""}</button></th>`; }).join("")}</tr></thead>`;
}
const table = (scope, cols, body, cls) => { const n=(body.match(/<tr[\s>]/g)||[]).length;
  return `<div class="an-card rf-tcard${cls?" "+cls:""}${tblClip(scope)}"><div class="rf-tw"><table class="rf-tbl${cls?" "+cls:""}">${thead(scope, cols)}<tbody>${body}</tbody></table></div></div>${axAbbr(cols.map(c=>c[1]))}${tblMore(scope, n)}`; };
const kpis = items => `<div class="an-kpis rf-kpis ax-k${items.length}">${items.map(([v,t,c])=>`<div class="${c||""}"><b>${v}</b><span>${t}</span></div>`).join("")}</div>`;
const sec = (t, hint) => `<h2 class="sec">${t}</h2>${hint?`<p class="hint">${hint}</p>`:""}`;
const empty = t => `<div class="an-card rf-empty">${t}</div>`;
const seasonSel = () => `<label class="rf-f"><span>الموسم</span><select data-ax-f="season"><option>${H(SEASON)}</option></select></label>`;
const clubSel = (key, cur, all) => `<label class="rf-f"><span>النادي</span><select data-ax-f="${key}">${all?`<option value="">كل الأندية</option>`:""}${CLUBS.map(c=>`<option value="${H(c)}"${c===cur?" selected":""}>${H(c)}</option>`).join("")}</select></label>`;
const clubCell = c => `<span class="rf-club">${crest(c)}<b>${H(c)}</b></span>`;
const more = (key, left) => left>0 ? `<button type="button" class="ts-morebtn ax-more" data-ax-more="${key}"><span>عرض المزيد</span><small>+${left}</small></button>` : "";
const played = () => playedMatches();
const noPlayed = () => empty(`لا توجد مباريات مُقامة في ${H(compLabel(COMP))} بعد.`);

/* ───────────── الفرق: الفورمة (آخر 5) ───────────── */
function teamLog(c){
  return played().filter(m=>m.home===c||m.away===c).sort((a,b)=>dateKey(a).localeCompare(dateKey(b))).map(m=>{
    const home=m.home===c, gf=home?+m.hg:+m.ag, ga=home?+m.ag:+m.hg;
    return {m, home, gf, ga, res:gf>ga?"w":gf===ga?"d":"l", pts:gf>ga?3:gf===ga?1:0, opp:home?m.away:m.home}; });
}
function formHTML(){
  if(!played().length) return noPlayed();
  const rows=CLUBS.map(c=>{ const L=teamLog(c).slice(-5);
    return {c, L, p:L.length, gf:L.reduce((s,x)=>s+x.gf,0), ga:L.reduce((s,x)=>s+x.ga,0), pts:L.reduce((s,x)=>s+x.pts,0)}; }).filter(x=>x.p);
  const S=sortBy(rows,"form",{pts:x=>x.pts, gf:x=>x.gf, ga:x=>x.ga, p:x=>x.p, n:x=>x.c, gd:x=>x.gf-x.ga});
  return `<div class="rf-filters ax-f2">${seasonSel()}<label class="rf-f"><span>البطولة</span><select disabled><option>${H(compLabel(COMP))}</option></select></label></div>
    ${sec("فورمة الفرق", "آخر 5 مباريات لكل فريق، الأحدث أولاً.")}
    ${table("form", [["n","الفريق","tl"],["","آخر 5"],["gd","الأهداف"],["pts","النقاط"]],
      S.map(x=>`<tr><td class="tl">${clubCell(x.c)}</td><td class="ax-fcell">${formPills(x.L.map(l=>l.res))}</td><td data-c="goals" data-gf="${x.gf}" data-ga="${x.ga}" data-p="${x.p}"><span class="ax-gg" dir="ltr">${x.gf}<i>:</i>${x.ga}</span></td><td data-c="pts"><b class="ax-pts">${x.pts}</b></td></tr>`).join(""))}
    <div class="ax-legend"><span><i class="pl w">ف</i>فوز</span><span><i class="pl d">ت</i>تعادل</span><span><i class="pl l">خ</i>خسارة</span></div>`;
}

/* ───────────── الفرق: الأرض والخارج ───────────── */
function haOf(c){
  const z=()=>({p:0,w:0,d:0,l:0,gf:0,ga:0,pts:0});
  const o={h:z(), a:z()};
  teamLog(c).forEach(x=>{ const t=x.home?o.h:o.a; t.p++; t[x.res]++; t.gf+=x.gf; t.ga+=x.ga; t.pts+=x.pts; });
  return o;
}
function haHTML(){
  if(!played().length) return noPlayed();
  if(!AX.ha.club || !CLUBS.includes(AX.ha.club)) AX.ha.club=(standings()[0]||{}).c || CLUBS[0];
  const c=AX.ha.club, o=haOf(c);
  const rows=[["p","المباريات"],["w","فوز"],["d","تعادل"],["l","خسارة"],["gf","أهداف له"],["ga","أهداف عليه"],["pts","النقاط"]];
  const ppm=t=>t.p? f2(t.pts/t.p) : "—";
  const bar=(k,h,a)=>{ const mx=Math.max(h,a,1); return `<div class="ax-cmp-r"><b class="h">${h}</b><span class="bh"><i style="width:${Math.round(h/mx*100)}%"></i></span><em>${rows.find(r=>r[0]===k)[1]}</em><span class="ba"><i style="width:${Math.round(a/mx*100)}%"></i></span><b class="a">${a}</b></div>`; };
  const all=CLUBS.map(x=>{ const q=haOf(x); return {c:x, hp:q.h.p, hpts:q.h.pts, ap:q.a.p, apts:q.a.pts, hgd:q.h.gf-q.h.ga, agd:q.a.gf-q.a.ga, diff:q.h.pts-q.a.pts}; }).filter(x=>x.hp+x.ap);
  const S=sortBy(all,"ha",{n:x=>x.c, hp:x=>x.hp, hpts:x=>x.hpts, ap:x=>x.ap, apts:x=>x.apts, diff:x=>x.diff});
  return `<div class="rf-filters ax-f2">${seasonSel()}${clubSel("haClub", c)}</div>
    ${sec(`${H(c)} — على أرضه وخارجها`)}
    <div class="an-card ax-ha">
      <div class="ax-ha-hd"><div><span>على أرضه</span><b>${ppm(o.h)}</b><small>نقطة/مباراة</small></div><div class="ax-ha-c">${crest(c,true)}</div><div><span>خارج أرضه</span><b>${ppm(o.a)}</b><small>نقطة/مباراة</small></div></div>
      <div class="ax-cmp">${rows.map(([k])=>bar(k,o.h[k],o.a[k])).join("")}</div>
    </div>
    ${sec("كل الفرق")}
    ${table("ha", [["n","الفريق","tl"],["hpts","نقاط الأرض"],["apts","نقاط الخارج"],["diff","الفارق"]],
      S.map(x=>`<tr><td class="tl"><button type="button" class="rf-name" data-ax-ha="${H(x.c)}">${crest(x.c)}<b>${H(x.c)}</b></button></td><td data-c="hpts" data-hp="${x.hp}"><b>${x.hpts}</b></td><td data-c="apts" data-ap="${x.ap}"><b>${x.apts}</b></td><td data-c="diff" dir="ltr" class="ax-diff ${x.diff>0?"up":x.diff<0?"dn":""}">${x.diff>0?"+":""}${x.diff}</td></tr>`).join(""))}`;
}

/* ───────────── الانضباط ───────────── */
function discHTML(){
  if(!played().length) return noPlayed();
  const y=CARDS.filter(x=>isYel(x.type)).length, r=CARDS.filter(x=>isRed(x.type)).length, n=played().length;
  const T=CLUBS.map(c=>({c, y:CARDS.filter(x=>x.club===c && isYel(x.type)).length, r:CARDS.filter(x=>x.club===c && isRed(x.type)).length})).map(x=>({...x, t:x.y+x.r}));
  const P={}; CARDS.forEach(x=>{ const k=x.p+"|"+x.club; const e=P[k]||(P[k]={n:x.p,c:x.club,y:0,r:0}); if(isRed(x.type)) e.r++; else if(isYel(x.type)) e.y++; });
  const PL=Object.values(P);
  const R={}; CARDS.forEach(x=>{ const e=R[x.r]||(R[x.r]={rd:+x.r,y:0,r:0}); if(isRed(x.type)) e.r++; else if(isYel(x.type)) e.y++; });
  const RL=Object.values(R).map(x=>({...x, t:x.y+x.r}));
  const pr=(L,k)=>L.map(x=>`<tr><td class="tl">${pbtn(x.n,x.c,`${face(x.n,x.c,"sm")}<b>${H(x.n)}</b>`)}</td><td class="tl">${clubCell(x.c)}</td><td><b>${x[k]}</b></td></tr>`).join("");
  return `<div class="rf-filters ax-f1">${seasonSel()}</div>
    ${kpis([[y,"البطاقات الصفراء","y"],[r,"البطاقات الحمراء","r"],[n,"مباريات مُقامة"],[f2((y+r)/n),"بطاقات لكل مباراة","lead"]])}
    <p class="hint rf-note">الإنذار الثاني يُحتسب بطاقة حمراء.</p>
    ${sec("الفرق")}
    ${table("discT", [["n","الفريق","tl"],["y",rfCardL("y")],["r",rfCardL("r")],["t","المجموع"]],
      sortBy(T,"discT",{n:x=>x.c,y:x=>x.y,r:x=>x.r,t:x=>x.t}).map(x=>`<tr><td class="tl">${clubCell(x.c)}</td><td>${x.y}</td><td>${x.r}</td><td><b>${x.t}</b></td></tr>`).join(""))}
    <div class="ax-duo">
      <div>${sec("الأكثر إنذاراً")}${PL.some(x=>x.y) ? table("discY", [["n","اللاعب","tl"],["c","الفريق","tl"],["y",rfCardL("y")]],
        pr(sortBy(PL.filter(x=>x.y),"discY",{n:x=>x.n,c:x=>x.c,y:x=>x.y}),"y")) : empty("لا إنذارات مسجّلة.")}</div>
      <div>${sec("الأكثر طرداً")}${PL.some(x=>x.r) ? table("discR", [["n","اللاعب","tl"],["c","الفريق","tl"],["r",rfCardL("r")]],
        pr(sortBy(PL.filter(x=>x.r),"discR",{n:x=>x.n,c:x=>x.c,r:x=>x.r}),"r")) : empty("لا بطاقات حمراء مسجّلة.")}</div>
    </div>
    ${sec("الانضباط حسب الجولة")}
    ${typeof rfRoundChart==="function" ? rfRoundChart(rfRows("")) : ""}
    ${table("discRd", [["r","الجولة","tl"],["y",rfCardL("y")],["rr",rfCardL("r")],["t","المجموع"]],
      sortBy(RL,"discRd",{r:x=>x.rd,y:x=>x.y,rr:x=>x.r,t:x=>x.t}).map(x=>`<tr><td class="tl"><b>الجولة ${x.rd}</b></td><td>${x.y}</td><td>${x.r}</td><td><b>${x.t}</b></td></tr>`).join(""))}`;
}

/* ───────────── الملاعب ───────────── */
/* اسم الملعب كما أُدخل في المباراة (m.venue) بعد توحيد المسافات وحذف «ستاد/استاد/ملعب» من أوله فقط.
   الصورة تظهر فقط إن طابق الاسم ملعب نادٍ في CLUB_INFO وله صورة في الموقع. */
const venueKey = v => norm(String(v||"").replace(/^\s*(ستاد|استاد|ملعب)\s+/,""));
function clubStadium(key){
  if(typeof CLUB_INFO==="undefined") return null;
  for(const c of Object.keys(CLUB_INFO)){ const I=CLUB_INFO[c]; if(I && I.st && venueKey(I.st)===key) return {club:c, st:I.st, slug:I.slug||""}; }
  return null;
}
function stadiums(){
  return memo("stad", ()=>{
    const S={}; let none=0;
    played().forEach(m=>{ const k=venueKey(m.venue); if(!k){ none++; return; }
      const e=S[k]||(S[k]={k, names:{}, ms:[], m:0, g:0, hw:0, aw:0, d:0});
      const nm=String(m.venue).trim().replace(/\s+/g," "); e.names[nm]=(e.names[nm]||0)+1;
      e.ms.push(m); e.m++; e.g+=(+m.hg)+(+m.ag); if(+m.hg>+m.ag) e.hw++; else if(+m.hg<+m.ag) e.aw++; else e.d++; });
    const L=Object.values(S).map(e=>{ const cs=clubStadium(e.k);
      return {...e, n: cs ? cs.st : Object.entries(e.names).sort((a,b)=>b[1]-a[1])[0][0], cs, avg:e.g/e.m}; });
    return {L, none};
  });
}
function stadHTML(){
  if(!played().length) return noPlayed();
  const {L, none}=stadiums();
  if(AX.stad.sel){ const s=L.find(x=>x.k===AX.stad.sel); if(s) return stadDetail(s); AX.stad.sel=""; }
  if(!L.length) return empty("لم يُسجَّل ملعب لأي مباراة مُقامة بعد.");
  return `<div class="rf-filters ax-f1">${seasonSel()}</div>
    ${sec("الملاعب", "اضغط الملعب لعرض مبارياته.")}
    ${none?`<p class="hint rf-note">${none} مباراة مُقامة بلا ملعب مسجّل — لا تدخل هنا.</p>`:""}
    ${table("stad", [["n","الملعب","tl"],["m","مباريات"],["g","أهداف"],["avg","المعدل"]],
      sortBy(L,"stad",{n:x=>x.n,m:x=>x.m,g:x=>x.g,avg:x=>x.avg}).map(x=>`<tr><td class="tl"><button type="button" class="rf-name" data-ax-stad="${H(x.k)}"><b>${H(x.n)}</b></button></td><td data-c="m" data-hw="${x.hw}" data-aw="${x.aw}" data-d="${x.d}">${x.m}</td><td data-c="g">${x.g}</td><td data-c="avg"><b>${f2(x.avg)}</b></td></tr>`).join(""))}`;
}
function stadDetail(s){
  const img=s.cs&&s.cs.slug ? `assets/stadiums/${s.cs.slug}.jpg?v=7` : "";
  return `<div class="ax-body">
    <div class="an-card ax-stad-hero${img?" has-img":""}">${img?`<img src="${img}" alt="" loading="lazy" decoding="async">`:""}
      <div class="ax-stad-tx"><button type="button" class="rf-back" data-ax-back="stad">كل الملاعب</button><b>${H(s.n)}</b>${s.cs?`<small>ملعب ${H(s.cs.club)}</small>`:""}</div></div>
    ${kpis([[s.m,"مباريات"],[s.g,"أهداف"],[f2(s.avg),"أهداف/مباراة","lead"],[s.hw,"فوز المضيف"],[s.aw,"فوز الضيف"],[s.d,"تعادل"]])}
    ${sec("المباريات")}
    <div class="an-card rf-log">${[...s.ms].sort((a,b)=>dateKey(b).localeCompare(dateKey(a))).map(matchRow).join("")}</div></div>`;
}
function matchRow(m, extra){
  return `<button type="button" class="rf-mrow ax-mrow" data-mopen="${H(matchKey(m))}">
    <span class="rf-mr">ج${H(m.round)}${m.date?`<small>${H(mpDateLabel(m))}</small>`:""}</span>
    <span class="rf-mt"><span class="h">${H(m.home)}</span>${crest(m.home)}<b class="sc" dir="ltr">${+m.ag} - ${+m.hg}</b>${crest(m.away)}<span class="a">${H(m.away)}</span></span>
    ${extra||""}</button>`;
}

/* ───────────── اللاعبون: أداء اللاعبين ───────────── */
const PERF_X=[["starts","أساسي"],["subs","بديل"],["cs","شباك نظيفة"],["pk","ركلات جزاء"],["og","أهداف عكسية"]];
const POS_F=[["","كل المراكز"],["GK","حراس"],["DEF","مدافعون"],["MID","وسط"],["ATT","مهاجمون"]];
function perfFilters(){
  const st=AX.perf;
  return `<div class="rf-filters ax-f4">${seasonSel()}${clubSel("perfClub", st.club, true)}
    <label class="rf-f"><span>المركز</span><select data-ax-f="perfPos">${POS_F.map(([k,t])=>`<option value="${k}"${k===st.pos?" selected":""}>${t}</option>`).join("")}</select></label>
    <label class="rf-f"><span>عمود إضافي</span><select data-ax-f="perfX"><option value="">بدون</option>${PERF_X.map(([k,t])=>`<option value="${k}"${k===st.x?" selected":""}>${t}</option>`).join("")}</select></label>
    <label class="rf-f ax-q"><span>بحث</span><input type="search" data-ax-q="perf" value="${H(st.q)}" placeholder="اسم اللاعب" autocomplete="off" spellcheck="false"></label></div>`;
}
function perfRows(){
  const st=AX.perf, q=norm(st.q);
  return playersAgg().filter(p=>(!st.club||p.c===st.club) && (!st.pos||groupOf(p.c,p.n)===st.pos) && (!q||norm(p.n).includes(q)||norm(p.c).includes(q)));
}
function perfTable(){
  const L=perfRows(); if(!L.length) return empty("لا يوجد لاعب مطابق.");
  const S=sortBy(L,"perf",{n:x=>x.n, apps:x=>x.apps, starts:x=>x.starts, subs:x=>x.subs, mins:x=>x.mins, g:x=>x.g, a:x=>x.a, y:x=>x.y, r:x=>x.r, cs:x=>x.gk?x.cs:-1, pk:x=>x.pk, og:x=>x.og});
  const X=PERF_X.find(x=>x[0]===AX.perf.x);        /* عمود إضافي واحد يختاره المستخدم */
  const xv=p=>X[0]==="cs" ? (p.gk?p.cs:"—") : X[0]==="pk" ? (p.pk?`${p.pks}/${p.pk}`:"0") : p[X[0]];
  return `${table("perf", [["n","اللاعب","tl"],["apps","مباريات"],["mins","دقائق"],["g","أهداف"],["a","صناعة"],["y",rfCardL("y")],["r",rfCardL("r")]].concat(X?[[X[0],X[1]]]:[]),
      S.map(p=>`<tr><td class="tl">${pbtn(p.n,p.c,`${face(p.n,p.c,"sm")}<span class="ax-nc"><b>${H(p.n)}</b><small>${H(p.c)}</small></span>`)}</td>
        <td data-c="apps" data-starts="${p.starts}" data-subs="${p.subs}" data-cs="${p.gk?p.cs:""}" data-pk="${p.pk}" data-pks="${p.pks}" data-og="${p.og}">${p.apps}</td><td data-c="mins">${p.mins}</td><td data-c="g"><b>${p.g}</b></td><td data-c="a"><b>${p.a}</b></td><td data-c="y">${p.y}</td><td data-c="r">${p.r}</td>${X?`<td data-c="${X[0]}"><b>${xv(p)}</b></td>`:""}</tr>`).join(""))}`;
}
function perfHTML(){
  if(AX.sel) return playerCard(AX.sel.n, AX.sel.c);
  if(!played().length) return noPlayed();
  return `${sec("أداء اللاعبين", "اضغط اسم اللاعب لعرض بطاقته.")}
    ${perfFilters()}<div id="axPerfT">${perfTable()}</div>`;
}

/* بطاقة اللاعب داخل التحليل */
function playerCard(n, c){
  const D=playerProfileData(n, c), R=PRATING.of(n,c), grp=groupOf(c,n), pos=posOf(c,n);
  const A=playersAgg().find(p=>p.n===n && p.c===c) || {starts:0, subs:0, faced:0, saved:0, pk:0, pks:0};
  const gk=D.gk;
  const K=[[D.apps,"مباريات"],[A.starts,"أساسي"],[A.subs,"بديل"],[D.mins+"′","دقائق"]]
    .concat(gk?[[D.cs,"شباك نظيفة","lead"],[D.conceded,"أهداف استقبلها"],[A.faced,"جزاءات واجهها"],[A.saved,"جزاءات تصدى لها"]]:[])
    .concat([[D.goals,"أهداف",gk?"":"lead"],[D.assists,"صناعة",gk?"":"lead"],[A.y??0,"صفراء","y"],[A.r??0,"حمراء","r"],[A.pk?`${A.pks}/${A.pk}`:"0","ركلات جزاء"],[D.ownG,"أهداف عكسية"]]);
  const last=D.log.slice(0,5);
  const hist=R?ratingHistory(n,c):null;
  return `<div class="ax-body">
    <div class="an-card ax-phero">
      <div class="ax-phero-id">${face(n,c,"lg")}<div><b>${H(n)}</b><small>${crest(c)}${H(c)}${pos?` · ${H(posLabel(pos)||pos)}`:""}</small></div></div>
      <div class="ax-phero-act">${R?`<a class="ax-rt-link" href="#axRate">${rateBadge(R.v,true)}<small>${rateLbl(R.v)}</small></a>`:""}
        <button type="button" class="rf-back" data-ax-back="player">رجوع</button>
        <button type="button" class="ax-open" data-player="${H(n)}" data-club="${H(c)}">الملف الكامل</button></div>
    </div>
    ${kpis(K)}
    ${last.length?`${sec("آخر 5 مباريات", "الأحدث أولاً.")}<div class="ax-mts">${last.map(l=>matchTile(l.m, l.opp, l.k, l.res, l.g, l.a, l.y, l.r, l.mins)).join("")}</div>`:""}
    ${R?ratingBlock(R, hist):`<div class="an-card rf-empty" id="axRate">${grp?`لا تقييم: لعب ${D.mins} دقيقة وأقل عيّنة للتقييم ${RATING_MODEL.minMinutes} دقيقة.`:"لا تقييم: لا مركز محفوظ لهذا اللاعب في كشف ناديه."}</div>`}
    ${D.log.length?`${sec("مباراة بمباراة")}
    <div class="an-card rf-tcard"><div class="rf-tw"><table class="rf-tbl ax-log"><thead><tr><th class="tl"><span>المباراة</span></th>${["النتيجة","دقائق","أهداف","صناعة","بطاقة"].concat(gk?["استقبل"]:[]).map(t=>`<th><span>${axLbl(t)}</span></th>`).join("")}</tr></thead><tbody>
      ${D.log.map(l=>`<tr class="ax-lr" data-mopen="${H(matchKey(l.m))}"><td class="tl"><span class="rf-club">ج${H(l.m.round)} ${crest(l.opp)}<b>${H(l.opp)}</b><small>${l.home?"أرضه":"خارج أرضه"}</small></span></td>
        <td><span class="ax-res ${l.k}" dir="ltr">${H(l.res)}</span></td><td>${l.sub?`↑${l.on}′ `:""}${l.mins}′${l.off?` ↓`:""}</td><td>${l.g||"—"}</td><td>${l.a||"—"}</td><td>${l.r?rfCardL("r"):l.y?rfCardL("y"):"—"}</td>${gk?`<td>${l.con}</td>`:""}</tr>`).join("")}
    </tbody></table></div></div>${axAbbr(["دقائق","أهداف","صناعة","بطاقة"].concat(gk?["استقبل"]:[]))}`:""}
  </div>`;
}
/* بطاقة مباراة واحدة — بسيطة وواضحة (منصور 2026-09-29): نتيجة ملوّنة (ف أخضر / ت أصفر / خ أحمر)،
   شعار الخصم، النتيجة، وما فعله اللاعب بالكلمات بدل الأرقام في دوائر، ودقائقه. */
const RES_T = {w:"فوز", d:"تعادل", l:"خسارة"};
const cnt = (n, one, two, many) => n===1 ? one : n===2 ? two : `${n} ${many}`;
function matchTile(m, opp, k, score, g, a, y, r, mins){
  const ev=[g?cnt(g,"هدف","هدفان","أهداف"):"", a?cnt(a,"صناعة","صناعتان","صناعات"):""].filter(Boolean);
  return `<button type="button" class="ax-mt ${k}" data-mopen="${H(matchKey(m))}" aria-label="${H(opp)}">
    <span class="rs">${RES_T[k]}</span>
    ${crest(opp)}
    <b class="sc" dir="ltr">${H(score)}</b>
    <span class="ev">${ev.length?ev.map(t=>`<i>${t}</i>`).join(""):`<i class="no">—</i>`}${r?rfCardL("r"):y?rfCardL("y"):""}</span>
    <small>${mins}′</small></button>`;
}
function ratingBlock(R, hist){
  const G=RATING_MODEL.groups[R.grp];
  const line = hist && hist.length>1 ? histSVG(hist) : "";
  const on=R.cats.filter(c=>c.v!=null);
  return `<section id="axRate">${sec("التقييم")}
    <div class="an-card ax-rhead">${rateBadge(R.v, true)}<div><b>${rateLbl(R.v)}</b><small>مقارنةً بلاعبي ${H(G.label==="حارس مرمى"?"حراسة المرمى":G.label==="مدافع"?"الدفاع":G.label==="لاعب وسط"?"الوسط":"الهجوم")} فقط</small></div></div>
    <div class="an-card ax-break">${on.map(c=>{ const v=catVal(c.v); return `<div class="ax-br">
        <span class="l">${H(c.label)}</span>
        <span class="b"><i style="width:${v*10}%" class="${rateCls(v)}"></i></span>
        <b class="${rateCls(v)}">${v.toFixed(1)}</b></div>`; }).join("")}
      <details class="ax-rawd"><summary>أرقام اللاعب في كل فئة</summary>
        ${on.map(c=>`<p><b>${H(c.label)}</b> <small>(${c.w}% من التقييم)</small><br>${c.raw.map(x=>`${H(x.label)}: <bdi>${x.k==="avail"?x.v+"%":f2(x.v)}</bdi>`).join(" · ")}</p>`).join("")}
      </details>
    </div>
    ${line?`${sec("تطور التقييم")}<div class="an-card ax-hist">${line}</div>`:""}
    ${modelNote(R.grp)}</section>`;
}
function histSVG(h){
  const W=320, Hh=120, px=24, py=18, n=h.length;
  const X=i=>px+(n===1?0:i*(W-2*px)/(n-1)), Y=v=>Hh-py-(Math.max(3,Math.min(10,v))-3)/7*(Hh-2*py);
  const pts=h.map((x,i)=>`${X(i)},${Y(x.v)}`).join(" ");
  return `<svg class="ax-hsvg" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="تطور التقييم">
    ${[4,6,8,10].map(v=>`<line x1="${px}" x2="${W-px}" y1="${Y(v)}" y2="${Y(v)}" class="gl"/>`).join("")}
    <polyline points="${pts}" class="ln"/>
    ${h.map((x,i)=>`<circle cx="${X(i)}" cy="${Y(x.v)}" r="4" class="dt"/><text x="${X(i)}" y="${Y(x.v)-9}" class="vl">${x.v.toFixed(1)}</text><text x="${X(i)}" y="${Hh-3}" class="rl">ج${x.r}</text>`).join("")}
  </svg>`;
}
function modelNote(only){
  const M=RATING_MODEL.metrics;
  const gs=only?[only]:Object.keys(RATING_MODEL.groups);
  return `<details class="an-card ax-model"><summary>كيف يُحسب التقييم${only?` (${RATING_MODEL.groups[only].label})`:""}</summary>
    <ol class="ax-steps">
      <li>المركز من كشف النادي: حارس، مدافع (CB/LB/RB/LWB/RWB)، وسط (CDM/CM/CAM/LM/RM)، مهاجم (ST/CF/LW/RW).</li>
      <li>المقاييس لكل 90 دقيقة أو لكل مباراة، لا مجاميع.</li>
      <li>العيّنة الصغيرة: يُضاف لكل لاعب ${RATING_MODEL.K} مباريات افتراضية بمستوى متوسط مركزه، فتستقر الأرقام دون معاقبة المتألق.</li>
      <li>كل مقياس يُقارن بلاعبي المركز نفسه فقط (مئين 0–100)، ولا يدخل التقييم إلا من لعب ${RATING_MODEL.minMinutes} دقيقة فأكثر.</li>
      <li>مقياس بلا بيانات تميّز اللاعبين يُستبعد وتُوزّع أوزانه.</li>
      <li>توازن المراكز: كل مركز له نفس المتوسط (6.4) ونفس المدى، فلا يتفوّق الحراس أو المهاجمون تلقائياً. التقييم = 6.4 + 0.9 × بُعد اللاعب عن متوسط مركزه.</li>
      <li>غير مسجّل في الموقع فلا يدخل: التصديات، المساهمات الدفاعية، التسديدات والتمريرات.</li>
    </ol>
    ${gs.map(g=>{ const G=RATING_MODEL.groups[g]; return `<div class="ax-mg"><b>${G.label}</b><ul>${G.cats.map(c=>`<li><span>${H(c.label)} <em>${c.w}%</em></span><small>${c.m.map(mk=>H(M[mk].label)).join("، ")}</small></li>`).join("")}</ul></div>`; }).join("")}
    <div class="ax-scale">${[[8,"8.0 فأكثر ممتاز"],[7,"7.0–7.9 جيد"],[6.5,"6.5–6.9 فوق المتوسط"],[6,"6.0–6.4 متوسط"],[5,"أقل من 6.0 ضعيف"]].map(([v,t])=>`<span><i class="rtg ${ratingCls(v)}"></i>${t}</span>`).join("")}</div>
  </details>`;
}

/* ───────────── اللاعبون: فورمة اللاعبين (آخر 5 مشاركات) ───────────── */
const PF_BY=[["ga","المساهمات"],["g","الأهداف"],["a","الصناعة"],["mins","الدقائق"]];
function pformRows(){
  const st=AX.pform, q=norm(st.q);
  return playersAgg().filter(p=>p.log.length && (!st.club||p.c===st.club) && (!q||norm(p.n).includes(q))).map(p=>{
    const L=p.log.slice(0,5);
    const s={n:p.n, c:p.c, L, m:L.length, g:0, a:0, mins:0, y:0, r:0};
    L.forEach(e=>{ s.g+=e.g; s.a+=e.a; s.mins+=e.mins; s.y+=e.y; s.r+=e.r; }); s.ga=s.g+s.a; return s; });
}
function pformGrid(){
  const st=AX.pform, key={ga:x=>x.ga, g:x=>x.g, a:x=>x.a, mins:x=>x.mins}[st.by];
  const L=pformRows().sort((a,b)=>key(b)-key(a) || b.ga-a.ga || b.mins-a.mins || byAr(a.n,b.n));
  if(!L.length) return empty("لا يوجد لاعب مطابق.");
  return `<div class="ax-pf">${L.slice(0,st.lim).map((x,i)=>`<article class="ax-pfc" style="--d:${Math.min(i,12)*30}ms">
      <header>${pbtn(x.n,x.c,`${face(x.n,x.c)}<span class="ax-nc"><b>${H(x.n)}</b><small>${crest(x.c)}${H(x.c)}</small></span>`)}<span class="ax-pf-m">آخر ${x.m===1?"مباراة":x.m===2?"مباراتين":x.m+" مباريات"}</span></header>
      <div class="ax-pf-big"><div><b>${x.g}</b><span>أهداف</span></div><div><b>${x.a}</b><span>صناعة</span></div><div><b>${x.mins}′</b><span>دقائق</span></div></div>
      <div class="ax-mts">${x.L.map(e=>matchTile(e.m, e.club===e.m.home?e.m.away:e.m.home, e.res, `${e.gf} - ${e.ga}`, e.g, e.a, e.y, e.r, e.mins)).join("")}</div>
    </article>`).join("")}</div>${more("pform", L.length-st.lim)}`;
}
const rfCard = t => `<i class="rf-cd ${t}" aria-hidden="true"></i>`;
function pformHTML(){
  if(AX.sel) return playerCard(AX.sel.n, AX.sel.c);
  if(!played().length) return noPlayed();
  const st=AX.pform;
  return `${sec("فورمة اللاعبين", "آخر 5 مباريات لكل لاعب، الأحدث أولاً.")}
    <div class="rf-filters ax-f3">${seasonSel()}${clubSel("pfClub", st.club, true)}<label class="rf-f ax-q"><span>بحث</span><input type="search" data-ax-q="pform" value="${H(st.q)}" placeholder="اسم اللاعب" autocomplete="off" spellcheck="false"></label></div>
    <div class="segbar ax-pills" role="group" aria-label="ترتيب حسب">${PF_BY.map(([k,t])=>`<button type="button" class="seg" data-ax-pfby="${k}" aria-pressed="${st.by===k}">${t}</button>`).join("")}</div>
    <div id="axPfG">${pformGrid()}</div>`;
}

/* ───────────── اللاعبون: الحراس ───────────── */
function gkHTML(){
  if(AX.sel) return playerCard(AX.sel.n, AX.sel.c);
  if(!played().length) return noPlayed();
  const L=playersAgg().filter(p=>p.gk && p.apps);
  if(!L.length) return empty("لا يوجد حارس بدقائق لعب مسجّلة.");
  const S=sortBy(L,"gk",{n:x=>x.n, apps:x=>x.apps, starts:x=>x.starts, mins:x=>x.mins, cs:x=>x.cs, ga:x=>x.gaOn, gpm:x=>x.gaOn/x.apps, f:x=>x.faced, s:x=>x.saved});
  return `${sec("الحراس", "الأهداف وركلات الجزاء أثناء وجوده في الملعب.")}
    ${table("gk", [["n","الحارس","tl"],["apps","مباريات"],["mins","دقائق"],["cs","شباك نظيفة"],["ga","استقبل"],["f","جزاءات واجهها"],["s","تصدى لها"]],
      S.map(p=>`<tr><td class="tl">${pbtn(p.n,p.c,`${face(p.n,p.c,"sm")}<span class="ax-nc"><b>${H(p.n)}</b><small>${H(p.c)}</small></span>`)}</td>
        <td data-c="apps" data-starts="${p.starts}">${p.apps}</td><td data-c="mins">${p.mins}</td><td data-c="cs"><b>${p.cs}</b></td><td data-c="ga">${p.gaOn}<small class="ax-per">${f2(p.gaOn/p.apps)}/م</small></td><td data-c="f">${p.faced}</td><td data-c="s">${p.saved}</td></tr>`).join(""))}`;
}

/* ───────────── اللاعبون: التقييم ───────────── */
function rateHTML(){
  if(AX.sel) return playerCard(AX.sel.n, AX.sel.c);
  if(!played().length) return noPlayed();
  const st=AX.rate, all=[...PRATING.all().values()].filter(x=>!st.grp || x.grp===st.grp);
  const S=sortBy(all,"rate",{v:x=>x.v, n:x=>x.n, mins:x=>x.mins, apps:x=>x.apps});
  return `${sec("تقييم اللاعبين", "من 10 — كل لاعب يُقارَن بلاعبي مركزه فقط.")}
    <div class="segbar ax-pills" role="group" aria-label="المركز">${POS_F.map(([k,t])=>`<button type="button" class="seg" data-ax-grp="${k}" aria-pressed="${st.grp===k}">${t}</button>`).join("")}</div>
    ${S.length ? table("rate", [["n","اللاعب","tl"],["apps","مباريات"],["mins","دقائق"],["v","التقييم"]],
      S.map(x=>`<tr><td class="tl">${pbtn(x.n,x.c,`${face(x.n,x.c,"sm")}<span class="ax-nc"><b>${H(x.n)}</b><small>${H(x.c)} · <span data-i18n="off">${H(x.pos)}</span></small></span>`)}</td>
        <td data-c="apps">${x.apps}</td><td data-c="mins">${x.mins}</td><td data-c="v">${rateBadge(x.v)}</td></tr>`).join(""))
      : empty("لا يوجد لاعب بعيّنة كافية في هذا المركز.")}
    ${modelNote(null)}`;
}

/* ───────────── الهيكل ───────────── */
function subnav(tab){
  const L=SUBS[tab]; if(!L) return "";
  return `<div class="ax-subnav" role="tablist" aria-label="أقسام ${tab==="teams"?"الفرق":"اللاعبين"}">${L.map(([k,t])=>`<button type="button" role="tab" class="st-tab" data-ax-sub="${k}" aria-selected="${AX.sub[tab]===k}">${t}</button>`).join("")}</div>`;
}
function panelHTML(){
  const t=AX.tab;
  if(t==="overview") return typeof anOverviewHTML==="function" ? anOverviewHTML() : "";
  if(t==="refs") return `<div id="anRefs">${anRefsHTML()}</div>`;
  const s=AX.sub[t];
  const body = t==="teams" ? ({form:formHTML, adv:advHTML, ha:haHTML, disc:discHTML, stad:stadHTML}[s]||formHTML)()
                           : ({perf:perfHTML, pform:pformHTML, gk:gkHTML, rate:rateHTML}[s]||perfHTML)();
  return subnav(t) + `<div class="ax-sp">${body}</div>`;
}
function paint(anim){
  const p=$a("#axPanel"); if(!p) return;
  p.innerHTML=`<div class="ax-body${anim?" in":""}">${panelHTML()}</div>`;
  if(AX.tab==="overview" && $a("#heatLeague") && typeof renderLeagueHeat==="function") renderLeagueHeat();
  const on=p.querySelector('.ax-subnav [aria-selected="true"]'); if(on) on.scrollIntoView({block:"nearest", inline:"center"});
}
function setIndicator(noAnim){
  const w=$a("#v-analysis .an"); if(!w) return;
  const bar=w.querySelector(".an-tabs"), bs=[...bar.querySelectorAll("button")], ind=bar.querySelector(".ctab-ind");
  const i=Math.max(0, bs.findIndex(b=>b.dataset.at===AX.tab));
  bs.forEach(b=>{ b.setAttribute("aria-selected", b.dataset.at===AX.tab); b.tabIndex = b.dataset.at===AX.tab ? 0 : -1; });
  if(noAnim) bar.classList.add("no-tr");
  ind.style.transform=`translateX(${(getComputedStyle(w).direction!=="ltr"?-100:100)*i}%)`;
  if(noAnim) requestAnimationFrame(()=>requestAnimationFrame(()=>bar.classList.remove("no-tr")));
}
function renderAnalysisX(){
  const v=$a("#v-analysis"); if(!v) return;
  v.innerHTML=`<div class="an ax">
    ${compChips(true)}
    <div class="ctabs an-tabs ax-t4" role="tablist" aria-label="أقسام التحليل">
      <span class="ctab-ind" aria-hidden="true"></span>
      ${TABS.map(([k,t,ic])=>`<button type="button" role="tab" data-at="${k}"><svg class="at-ic" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ic}</svg><span>${t}</span></button>`).join("")}
    </div>
    <div id="axPanel"></div>
  </div>`;
  wireComp(v);
  setIndicator(true);
  paint(false);
}
if(typeof RENDER==="object") RENDER.analysis=renderAnalysisX;
/* تحديث حيّ (منصور 2026-09-29): renderAll في الموقع يعيد رسم الصفحة الظاهرة إلا التحليل — فكانت أرقامه تبقى قديمة
   حتى تبديل التبويب عند وصول مباراة أو حدث جديد. الآن يُعاد رسم لوحة التحليل الحالية نفسها (بلا إعادة تمرير)،
   إلا إن كان المستخدم يكتب في خانة بحث داخلها. */
if(typeof renderAll==="function" && !renderAll.__ax){
  const _ra=renderAll;
  renderAll=function(){ const r=_ra.apply(this, arguments);
    try{ if(document.querySelector("#v-analysis.on .ax") && !(document.activeElement && document.activeElement.closest && document.activeElement.closest("#v-analysis input"))) paint(false); }catch(e){ console.error(e); }
    /* ملف لاعب أو صفحة مباراة مفتوحة تتحدّث أيضاً (منصور 2026-09-30) — بنفس موضع التمرير */
    try{ const pp=document.getElementById("pprof");
      if(pp && !pp.hidden && LAST_PROF){ const sh=pp.querySelector(".pprof-sheet"), y=sh?sh.scrollTop:0;
        openPlayer(LAST_PROF.n, LAST_PROF.c, {noHistory:true, keepComp:true}); const s2=pp.querySelector(".pprof-sheet"); if(s2) s2.scrollTop=y; } }catch(e){ console.error(e); }
    try{ const mp=document.getElementById("mpage");
      if(mp && !mp.hidden && typeof MP!=="undefined" && MP.m){ const m2=matchByKey(matchKey(MP.m));
        if(m2){ const sh=mp.querySelector(".mp-sheet"), y=sh?sh.scrollTop:0; MP.m=m2; renderMatchPage(); const s2=mp.querySelector(".mp-sheet"); if(s2) s2.scrollTop=y; } } }catch(e){ console.error(e); }
    return r; };
  renderAll.__ax=true;
}
let LAST_PROF=null;
if(typeof openPlayer==="function" && !openPlayer.__ax){ const _op=openPlayer;
  openPlayer=function(n, c){ LAST_PROF={n, c}; return _op.apply(this, arguments); }; openPlayer.__ax=true; }
window.renderAnalysis=renderAnalysisX;
if(document.querySelector("#v-analysis.on")) renderAnalysisX();

/* ───────────── الفرق: الأرقام المتقدمة (InStat — منصور 2026-10-03) ─────────────
   بيانات ملف خارجي ثابت (tstats-data.js): مجاميع الجولات 1–3 حتى 29 سبتمبر. تُعرض لكل مباراة افتراضياً
   (قسمة على المباريات المشمولة لكل فريق) لأن العربي والصليبخات بمباراتين فقط في الملف. */
const ADV_M = [   /* k · العنوان · per: يُقسم على المباريات · pct: نسبة · منازل عشرية */
  ["poss","الاستحواذ",0,1,1], ["xg","xG",1,0,2], ["oxg","xG ضدّه",1,0,2], ["sh","تسديدات",1,0,1], ["sot","على المرمى",1,0,1],
  ["pas","تمريرات",1,0,0], ["pasA","دقة التمرير",0,1,1], ["kp","مفتاحية",1,0,1], ["box","دخول المنطقة",1,0,1],
  ["rec","استعادة",1,0,1], ["int","اعتراض",1,0,1], ["prsA","نجاح الضغط",0,1,1], ["chW","التحامات",0,1,1],
  ["aerW","هوائية",0,1,1], ["ca","مرتدات",1,0,1], ["cor","ركنيات",1,0,1], ["fl","أخطاء",1,0,1]
];
const ADV_MK = Object.fromEntries(ADV_M.map(x=>[x[0],x]));
const advV = (t, k) => { const m=ADV_MK[k]; const v=+t[k]||0; return m && m[2] && AX.adv.per ? v/(t.mp||1) : v; };
const advF = (k, v) => { const m=ADV_MK[k]||[k,"",0,0,1]; const d = (m[2] && !AX.adv.per) ? (Number.isInteger(v)?0:m[4]) : m[4]; return (+v).toFixed(d) + (m[3]?"%":""); };
const fmtAsOf = iso => { const d=new Date(iso+"T00:00:00"); const M=(typeof AR_MON!=="undefined"&&AR_MON)||[]; return isNaN(d) ? iso : `${d.getDate()} ${M[d.getMonth()]||(d.getMonth()+1)} ${d.getFullYear()}`; };
/* تباعد الشعارات المتقاربة: دفع متبادل حتى ~27px بين المراكز، داخل حدود الرسم (النقطة الحقيقية تبقى بنقطة صغيرة وخط) */
function advPlace(P, x0, x1, y0, y1){
  P.forEach(p=>{ p.x=p.x0; p.y=p.y0; });
  for(let it=0; it<120; it++){ let moved=false;
    for(let i=0;i<P.length;i++) for(let j=i+1;j<P.length;j++){ const a=P[i], b=P[j]; let dx=b.x-a.x, dy=b.y-a.y, d=Math.hypot(dx,dy);
      if(d<27){ if(d<.01){ dx=1; dy=.3; d=1.04; } const k=(27-d)/2/d; a.x-=dx*k; a.y-=dy*k; b.x+=dx*k; b.y+=dy*k; moved=true; } }
    P.forEach(p=>{ p.x=Math.min(x1,Math.max(x0,p.x)); p.y=Math.min(y1,Math.max(y0,p.y)); });
    if(!moved) break; }
  return P;
}
function advScatter(T){
  /* هجوم (xG لكل مباراة، يميناً أكثر) × دفاع (xG ضدّه لكل مباراة، الأعلى = أقل استقبالاً) */
  const X=T.map(t=>t.xg/t.mp), Y=T.map(t=>t.oxg/t.mp);
  const pad=v=>[Math.floor(Math.min(...v)*2)/2-.25, Math.ceil(Math.max(...v)*2)/2+.25];
  const [x0,x1]=pad(X), [y0,y1]=pad(Y), W=340, Hh=300, L=34, R=10, Tp=12, B=30;
  const sx=v=>L+(v-x0)/(x1-x0)*(W-L-R), sy=v=>Tp+(v-y0)/(y1-y0)*(Hh-Tp-B);
  const ax=X.reduce((s,v)=>s+v,0)/T.length, ay=Y.reduce((s,v)=>s+v,0)/T.length;
  const ticks=(a,b)=>{ const o=[]; for(let v=Math.ceil(a*2)/2; v<=b+1e-9; v+=.5) o.push(+v.toFixed(1)); return o; };
  const q=(x,y,t,anchor)=>`<text x="${x}" y="${y}" text-anchor="${anchor}" class="adv-q">${t}</text>`;
  return `<div class="an-card adv-sc"><svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="الهجوم مقابل الدفاع">
    <rect x="${sx(ax)}" y="${Tp}" width="${W-R-sx(ax)}" height="${sy(ay)-Tp}" class="adv-best"/>
    ${ticks(x0,x1).map(v=>`<line x1="${sx(v)}" x2="${sx(v)}" y1="${Tp}" y2="${Hh-B}" class="adv-grid"/><text x="${sx(v)}" y="${Hh-B+14}" text-anchor="middle" class="adv-tk">${v.toFixed(1)}</text>`).join("")}
    ${ticks(y0,y1).map(v=>`<line x1="${L}" x2="${W-R}" y1="${sy(v)}" y2="${sy(v)}" class="adv-grid"/><text x="${L-6}" y="${sy(v)+3.5}" text-anchor="end" class="adv-tk">${v.toFixed(1)}</text>`).join("")}
    <line x1="${sx(ax)}" x2="${sx(ax)}" y1="${Tp}" y2="${Hh-B}" class="adv-avg"/><line x1="${L}" x2="${W-R}" y1="${sy(ay)}" y2="${sy(ay)}" class="adv-avg"/>
    ${q(W-R-4, Tp+12, "هجوم قوي · دفاع صلب", "end")}${q(L+4, Hh-B-6, "هجوم أضعف · دفاع أضعف", "start")}
    ${advPlace(T.map(t=>({t, x0:sx(t.xg/t.mp), y0:sy(t.oxg/t.mp)})), L+13, W-R-13, Tp+13, Hh-B-13).map(({t,x0,y0,x,y})=>`<g class="adv-pt"><title>${H(t.c)} — xG ${f2(t.xg/t.mp)} · ضدّه ${f2(t.oxg/t.mp)}</title>${Math.hypot(x-x0,y-y0)>3?`<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" class="adv-lk"/><circle cx="${x0.toFixed(1)}" cy="${y0.toFixed(1)}" r="2.2" class="adv-dot"/>`:""}<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="13"/><image href="${H(crestSrcOf(t.c))}" x="${(x-10).toFixed(1)}" y="${(y-10).toFixed(1)}" width="20" height="20" preserveAspectRatio="xMidYMid meet"/></g>`).join("")}
  </svg>
  <div class="adv-axes"><span>الأفقي: xG له في المباراة (يميناً أكثر)</span><span>الرأسي: xG ضدّه (الأعلى أقل)</span></div></div>`;
}
function advDuo(T, a, b, la, lb, sub){
  /* الفعلي مقابل المتوقع: شريطان لكل فريق + الفارق */
  const S=[...T].sort((p,q)=>((q[a]-q[b])-(p[a]-p[b]))||byAr(p.c,q.c)), mx=Math.max(...T.map(t=>Math.max(t[a],t[b])),1);
  return `<div class="an-card adv-duo">
    <div class="adv-lg"><span><i class="act"></i>${la}</span><span><i class="exp"></i>${lb}</span><small>${sub}</small></div>
    ${S.map(t=>{ const d=t[a]-t[b]; return `<div class="adv-row"><span class="adv-tm">${crest(t.c)}<b>${H(t.c)}</b></span>
      <span class="adv-bars"><span><i class="act" style="width:${(t[a]/mx*100).toFixed(1)}%"></i><em dir="ltr">${t[a]}</em></span><span><i class="exp" style="width:${(t[b]/mx*100).toFixed(1)}%"></i><em dir="ltr">${(+t[b]).toFixed(1)}</em></span></span>
      <span class="adv-d ${d>=.05?"up":d<=-.05?"dn":""}" dir="ltr">${d>0?"+":""}${d.toFixed(1)}</span></div>`; }).join("")}</div>`;
}
function advLeaders(T){
  const L=[["poss","أعلى استحواذ"],["pasA","أدق تمرير"],["sh","الأكثر تسديداً"],["box","الأكثر دخولاً لمنطقة الجزاء"],["kp","تمريرات مفتاحية"],["rec","استعادة الكرة"],["prsA","أنجح ضغط"],["aerW","سيطرة هوائية"],["ca","هجمات مرتدة"],["fl","الأقل أخطاءً",1]];
  return `<div class="adv-lead">${L.map(([k,t,lo])=>{ const S=[...T].sort((p,q)=>lo ? advV(p,k)-advV(q,k) : advV(q,k)-advV(p,k)).slice(0,3);
    return `<div class="an-card adv-lc"><span class="adv-lt">${t}</span>
      <div class="adv-l1">${crest(S[0].c)}<b>${H(S[0].c)}</b><em dir="ltr">${advF(k, advV(S[0],k))}</em></div>
      ${S.slice(1).map((x,i)=>`<div class="adv-l2"><i>${i+2}</i><span>${H(x.c)}</span><em dir="ltr">${advF(k, advV(x,k))}</em></div>`).join("")}</div>`; }).join("")}</div>`;
}
function advHTML(){
  const D=window.TSTATS; if(!D || !D.teams || !D.teams.length) return empty("لا توجد أرقام متقدمة بعد.");
  const T=D.teams.filter(t=>t.mp>0), per=AX.adv.per, n=T.length;
  const avg=k=>T.reduce((s,t)=>s+t[k]/t.mp,0)/n, avgP=k=>T.reduce((s,t)=>s+t[k],0)/n;
  const cols=[["n","الفريق","tl sticky"]].concat(ADV_M.map(([k,t])=>[k,t]));
  const keys={n:x=>x.c}; ADV_M.forEach(([k])=>keys[k]=x=>advV(x,k));
  const S=sortBy(T,"adv",keys);
  return `<div class="rf-filters ax-f2">${seasonSel()}<label class="rf-f"><span>العرض</span><select data-ax-f="advPer"><option value="1"${per?" selected":""}>لكل مباراة</option><option value="0"${per?"":" selected"}>مجموع الجولات</option></select></label></div>
    ${sec("الأرقام المتقدمة", "الإحصائيات من الجولة 1 إلى الجولة 3، ولا تشمل مباراة العربي والصليبيخات في الجولة 3 لعدم نقلها.")}
    ${kpis([[f2(avg("xg")),"xG للفريق في المباراة","lead"],[avg("sh").toFixed(1),"تسديدات للفريق"],[avgP("pasA").toFixed(1)+"%","متوسط دقة التمرير"],[avg("rec").toFixed(1),"استعادة للكرة"]])}
    ${sec("الهجوم مقابل الدفاع", "مكان كل شعار حسب الأهداف المتوقعة له وعليه في المباراة. المنطقة المظلّلة أفضل من متوسط الدوري في الاثنين.")}
    ${advScatter(T)}
    <div class="ax-duo">
      <div>${sec("الأهداف مقابل المتوقع (xG)", "موجب = إنهاء أفضل من نوعية الفرص.")}${advDuo(T,"g","xg","الأهداف","xG","مجموع الجولات")}</div>
      <div>${sec("النقاط مقابل المتوقع (xPts)", "موجب = نقاط أكثر مما يستحقه الأداء.")}${advDuo(T,"pts","xpts","النقاط","xPts","مجموع الجولات")}</div>
    </div>
    ${sec("المتصدّرون", per?"لكل مباراة؛ النسب كما هي.":"مجموع الجولات؛ النسب كما هي.")}
    ${advLeaders(T)}
    ${sec("مقارنة كل الفرق", "اضغط عنوان أي عمود للترتيب.")}
    ${table("adv", cols, S.map(x=>`<tr><td class="tl sticky">${clubCell(x.c)}</td>${ADV_M.map(([k])=>`<td${k===AX.sorts.adv.k?' class="adv-on"':""} dir="ltr">${advF(k, advV(x,k))}</td>`).join("")}</tr>`).join(""), "ax-wide adv-tbl")}`;
}

/* ───────────── الأحداث (تفويض واحد على صفحة التحليل) ───────────── */
function scrollTopOfPanel(){ const p=$a("#axPanel"); if(p){ const y=p.getBoundingClientRect().top+scrollY-90; if(y<scrollY) scrollTo({top:y, behavior:"smooth"}); } }
document.addEventListener("click", e=>{
  const root=e.target.closest("#v-analysis .ax"); if(!root) return;
  const t=e.target;
  const tab=t.closest(".an-tabs [data-at]");
  if(tab){ if(AX.tab!==tab.dataset.at){ AX.tab=tab.dataset.at; AX.sel=null; setIndicator(false); paint(true); } return; }
  const sub=t.closest("[data-ax-sub]");
  if(sub){ AX.sub[AX.tab]=sub.dataset.axSub; AX.sel=null; AX.stad.sel=""; paint(true); return; }
  const so=t.closest("[data-ax-sort]");
  if(so){ const [sc,k]=so.dataset.axSort.split(":"), s=AX.sorts[sc]; if(s.k===k) s.d*=-1; else { s.k=k; s.d=(k==="n"||k==="c")?1:-1; }
    if(sc==="perf"){ const b=$a("#axPerfT"); if(b){ b.innerHTML=perfTable(); return; } } paint(false); return; }
  const pl=t.closest("[data-ax-p]");
  if(pl){ AX.sel={n:pl.dataset.axP, c:pl.dataset.axC};
    if(AX.tab!=="players"){ AX.tab="players"; AX.sub.players="perf"; setIndicator(false); }
    paint(true); scrollTopOfPanel(); return; }
  const bk=t.closest("[data-ax-back]");
  if(bk){ if(bk.dataset.axBack==="stad") AX.stad.sel=""; else AX.sel=null; paint(true); return; }
  const st=t.closest("[data-ax-stad]"); if(st){ AX.stad.sel=st.dataset.axStad; paint(true); scrollTopOfPanel(); return; }
  const ha=t.closest("[data-ax-ha]"); if(ha){ AX.ha.club=ha.dataset.axHa; paint(true); scrollTopOfPanel(); return; }
  const mo=t.closest("[data-ax-more]");
  if(mo){ const k=mo.dataset.axMore; ({      pform:()=>{AX.pform.lim+=12; const b=$a("#axPfG"); if(b) b.innerHTML=pformGrid();},
}[k]||(()=>{}))(); return; }
  const pb=t.closest("[data-ax-pfby]"); if(pb){ AX.pform.by=pb.dataset.axPfby; AX.pform.lim=12; paint(false); return; }
  const gp=t.closest("[data-ax-grp]"); if(gp){ AX.rate.grp=gp.dataset.axGrp; AX.rate.lim=30; paint(false); return; }
  const rl=t.closest(".ax-rt-link"); if(rl){ e.preventDefault(); const r=$a("#axRate"); if(r) r.scrollIntoView({behavior:"smooth", block:"start"}); return; }
});
document.addEventListener("change", e=>{
  const f=e.target.closest("#v-analysis .ax [data-ax-f]"); if(!f) return;
  const k=f.dataset.axF, v=f.value;
  if(k==="haClub") AX.ha.club=v;
  if(k==="perfClub"){ AX.perf.club=v; AX.perf.lim=30; }
  if(k==="perfPos"){ AX.perf.pos=v; AX.perf.lim=30; }
  if(k==="perfX"){ AX.perf.x=v; if(v){ AX.sorts.perf.k=v; AX.sorts.perf.d=-1; } }
  if(k==="pfClub"){ AX.pform.club=v; AX.pform.lim=12; }
  if(k==="advPer") AX.adv.per = v==="1";
  paint(false);
});
document.addEventListener("input", e=>{
  const q=e.target.closest("#v-analysis .ax [data-ax-q]"); if(!q) return;
  if(q.dataset.axQ==="perf"){ AX.perf.q=q.value; AX.perf.lim=30; const b=$a("#axPerfT"); if(b) b.innerHTML=perfTable(); }
  if(q.dataset.axQ==="pform"){ AX.pform.q=q.value; AX.pform.lim=12; const b=$a("#axPfG"); if(b) b.innerHTML=pformGrid(); }
});
/* صف مباراة في جدول اللاعب يفتح صفحة المباراة (الصف ليس زراً) */
document.addEventListener("click", e=>{
  const tr=e.target.closest("#v-analysis tr.ax-lr[data-mopen]"); if(!tr || e.target.closest("button,a")) return;
  const m=matchByKey(tr.dataset.mopen); if(m) openMatch(m);
});

/* =========================================================================
   البحث العام — زر في أعلى الموقع، يبحث في بيانات mfsoccer وحدها:
   اللاعبون (الكشوفات + من ظهر في الأحداث)، الأندية، الحكام (refPool)، المباريات، الملاعب.
   كل نتيجة تفتح الصفحة الموجودة أصلاً في الموقع.
   ========================================================================= */
const GS={el:null, input:null, list:null, res:[], sel:-1};
const SRCH_SVG='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
function gsIndex(){
  return memo("gsidx", ()=>{
    const out=[], en=n=>{ try{ return (typeof NAMES_EN!=="undefined" && NAMES_EN[n]) ? String(NAMES_EN[n]) : ""; }catch(e){ return ""; } };
    const pm=new Map(), addP=(n,c)=>{ n=String(n||"").trim(); c=String(c||"").trim(); if(!n||!c||n.length<2) return; const k=n+"|"+c; if(!pm.has(k)) pm.set(k,{t:"p", n, c}); };
    Object.keys(SQUADS||{}).forEach(c=>(SQUADS[c]||[]).forEach(x=>addP(sqName(x), c)));
    const A=ALL||{};
    (A.goals||[]).forEach(g=>{ if(!isOG(g)) addP(g.p,g.sc); addP(g.a,g.sc); }); (A.lineups||[]).forEach(x=>addP(x.p,x.club)); (A.cards||[]).forEach(x=>addP(x.p,x.club)); (A.subs||[]).forEach(x=>{ addP(x.in,x.club); addP(x.out,x.club); });
    pm.forEach(p=>out.push({...p, key:norm(p.n)+" "+norm(en(p.n))}));
    CLUBS.forEach(c=>out.push({t:"c", n:c, key:norm(c)+" "+norm(en(c))}));
    try{ refPool().forEach(r=>out.push({t:"r", n:r.name, key:norm(r.name)})); }catch(e){}
    (A.matches||[]).forEach(m=>out.push({t:"m", n:`${m.home} × ${m.away}`, m, key:norm(`${m.home} ${m.away} ${m.home} ضد ${m.away} vs ${en(m.home)} ${en(m.away)}`)}));
    const vs=new Map();
    (A.matches||[]).forEach(m=>{ const k=venueKey(m.venue); if(k && !vs.has(k)){ const cs=clubStadium(k); vs.set(k,{t:"s", n:cs?cs.st:String(m.venue).trim(), k, key:k+" "+norm(cs?cs.st:"")}); } });
    if(typeof CLUB_INFO!=="undefined") Object.keys(CLUB_INFO).forEach(c=>{ const I=CLUB_INFO[c]; if(I&&I.st){ const k=venueKey(I.st); if(!vs.has(k)) vs.set(k,{t:"s", n:I.st, k, key:k}); } });
    vs.forEach(s=>out.push(s));
    return out;
  });
}
const GS_T={p:"اللاعبون", c:"الأندية", r:"الحكام", m:"المباريات", s:"الملاعب"};
function gsSearch(q){
  const nq=norm(q); if(nq.length<2) return [];
  const ws=nq.split(" ");
  const hits=gsIndex().filter(x=>ws.every(w=>x.key.includes(w))).map(x=>({x, rank: x.key.startsWith(nq)?0 : x.key.split(" ").some(w=>w.startsWith(ws[0]))?1:2}));
  const out=[];
  ["p","c","r","m","s"].forEach(t=>{ const L=hits.filter(h=>h.x.t===t).sort((a,b)=>a.rank-b.rank || (t==="m" ? dateKey(b.x.m).localeCompare(dateKey(a.x.m)) : byAr(a.x.n,b.x.n))).slice(0,t==="p"?8:6).map(h=>h.x);
    if(L.length) out.push([t, L]); });
  return out;
}
function gsItem(x, i){
  const sel=i===GS.sel?' aria-selected="true"':' aria-selected="false"';
  if(x.t==="p") return `<button type="button" class="gs-it" role="option" data-gs="${i}"${sel}>${face(x.n,x.c)}<span class="tx"><b>${H(x.n)}</b><small>${H(x.c)}</small></span>${crest(x.c)}</button>`;
  if(x.t==="c") return `<button type="button" class="gs-it" role="option" data-gs="${i}"${sel}>${crest(x.n)}<span class="tx"><b>${H(x.n)}</b><small>نادٍ</small></span></button>`;
  if(x.t==="r") return `<button type="button" class="gs-it" role="option" data-gs="${i}"${sel}><span class="ax-face"><i>${typeof REF_ROLE_ICO!=="undefined"?REF_ROLE_ICO.ref:""}</i></span><span class="tx"><b>${H(x.n)}</b><small>حكم</small></span></button>`;
  if(x.t==="m"){ const m=x.m, done=!isUpcoming(m); return `<button type="button" class="gs-it" role="option" data-gs="${i}"${sel}><span class="gs-mc">${crest(m.home)}${crest(m.away)}</span><span class="tx"><b>${H(m.home)} × ${H(m.away)}</b><small>${H(compOf(m))} · ج${H(m.round)}${m.date?` · ${H(mpDateLabel(m))}`:""}</small></span>${done?`<b class="gs-sc" dir="ltr">${+m.ag} - ${+m.hg}</b>`:""}</button>`; }
  return `<button type="button" class="gs-it" role="option" data-gs="${i}"${sel}><span class="ax-face"><i>${SRCH_SVG}</i></span><span class="tx"><b>${H(x.n)}</b><small>ملعب</small></span></button>`;
}
function gsPaint(){
  const groups=gsSearch(GS.input.value); GS.res=groups.flatMap(g=>g[1]);
  let i=0;
  GS.list.innerHTML = !norm(GS.input.value) ? `<p class="gs-hint">ابحث عن لاعب، نادٍ، حكم، مباراة أو ملعب.</p>`
    : groups.length ? groups.map(([t,L])=>`<section><h4>${GS_T[t]}</h4>${L.map(x=>gsItem(x, i++)).join("")}</section>`).join("")
    : `<p class="gs-hint">لا نتائج في بيانات الموقع.</p>`;
}
function gsGo(x){
  if(!x) return; gsClose();
  const toAnalysis=fn=>{ const b=document.querySelector('nav.tabs [data-v="analysis"]'); fn(); if(b && !document.querySelector("#v-analysis.on")) b.click(); else renderAnalysisX(); };
  if(x.t==="p") return openPlayer(x.n, x.c);
  if(x.t==="c") return openClub(x.n);
  if(x.t==="m") return openMatch(x.m);
  if(x.t==="r") return toAnalysis(()=>{ AX.tab="refs"; AX.sel=null; if(typeof RFA!=="undefined"){ RFA.ref=x.n; RFA.round=""; } if(COMP!=="الكل" && !(ALL.matches||[]).some(m=>compOf(m)===COMP && crewOf(m).ref===x.n)){ COMP="الكل"; applyComp(); } });
  if(x.t==="s") return toAnalysis(()=>{ AX.tab="teams"; AX.sub.teams="stad"; AX.stad.sel=x.k; AX.sel=null; });
}
function gsBuild(){
  const el=document.createElement("div"); el.id="gsearch"; el.className="gs"; el.hidden=true;
  el.innerHTML=`<div class="gs-scrim" data-gs-close></div>
    <div class="gs-sheet" role="dialog" aria-modal="true" aria-label="البحث في الموقع">
      <label class="gs-box">${SRCH_SVG}<input type="search" placeholder="ابحث في mfsoccer" aria-label="ابحث في mfsoccer" autocomplete="off" spellcheck="false" enterkeyhint="search" role="combobox" aria-controls="gsList" aria-expanded="true"><button type="button" class="gs-x" data-gs-close aria-label="إغلاق">إغلاق</button></label>
      <div class="gs-list" id="gsList" role="listbox"></div>
    </div>`;
  document.body.appendChild(el);
  GS.el=el; GS.input=el.querySelector("input"); GS.list=el.querySelector(".gs-list");
  GS.input.addEventListener("input", ()=>{ GS.sel=-1; gsPaint(); });
  GS.input.addEventListener("keydown", e=>{
    if(e.key==="ArrowDown"||e.key==="ArrowUp"){ if(!GS.res.length) return; e.preventDefault(); GS.sel=(GS.sel+(e.key==="ArrowDown"?1:-1)+GS.res.length)%GS.res.length;
      GS.list.querySelectorAll(".gs-it").forEach((b,i)=>{ b.setAttribute("aria-selected", i===GS.sel); if(i===GS.sel) b.scrollIntoView({block:"nearest"}); }); }
    else if(e.key==="Enter"){ e.preventDefault(); gsGo(GS.res[GS.sel>=0?GS.sel:0]); }
    else if(e.key==="Escape") gsClose();
  });
  el.addEventListener("click", e=>{ if(e.target.closest("[data-gs-close]")) return gsClose(); const b=e.target.closest("[data-gs]"); if(b) gsGo(GS.res[+b.dataset.gs]); });
}
function gsOpen(){ if(!GS.el) gsBuild(); GS.el.hidden=false; document.documentElement.classList.add("gs-open"); GS.sel=-1; gsPaint(); setTimeout(()=>GS.input.focus(),30); }
function gsClose(){ if(!GS.el) return; GS.el.hidden=true; document.documentElement.classList.remove("gs-open"); }
window.GSEARCH={open:gsOpen, close:gsClose, search:gsSearch};
function gsMount(){
  const tools=document.querySelector(".hero-tools"); if(!tools || document.getElementById("gsBtn")) return;
  const b=document.createElement("button"); b.className="iconbtn gs-btn"; b.id="gsBtn"; b.type="button"; b.title="بحث"; b.setAttribute("aria-label","بحث في الموقع");
  b.innerHTML=SRCH_SVG; b.onclick=gsOpen; tools.prepend(b);
}
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", gsMount); else gsMount();
document.addEventListener("keydown", e=>{ if((e.key==="/" && !/input|textarea|select/i.test((document.activeElement||{}).tagName||"")) || ((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==="k")){ e.preventDefault(); gsOpen(); } });
})();
