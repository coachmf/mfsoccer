/* =====================================================================
   تحليل الفيديو — Video Analysis (منصور 2026-11-14)

   قسم مستقل لفيديوهات تحليل كرة القدم الكويتية: صفحة بتصنيفات، بطاقات، مشغّل،
   و«تحليلات المباراة» داخل صفحة كل مباراة (الربط بمعرّف المباراة matchKey).

   مصدر البيانات:
     محلياً (localhost / شبكة المنزل)  → localStorage فقط «mfva_local_v1» + بيانات تجريبية
                                          مولّدة من مباريات حقيقية في الموقع. لا كتابة على Firestore.
     الموقع المنشور (https)            → وثيقة واحدة seasons/videos {items:[…], updated}
                                          تُقرأ مرة واحدة عند أول حاجة (فتح القسم أو صفحة مباراة)،
                                          ولا شيء يُحمّل في الصفحة الرئيسية.
   الأداء: لا ملف فيديو يُطلب قبل ضغط «تشغيل»، الصور المصغّرة lazy، بلا مكتبات.
   ===================================================================== */
(function(){
"use strict";
const VA = window.VIDEOS = {};
const D = document;
const LOCAL = (location.protocol!=="https:" || /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) && !/[?&]vaprod\b/.test(location.search);   /* ?vaprod = اختبار مسار الموقع المنشور محلياً (قراءة فقط) */
const H = s => String(s==null?"":s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const safe = f => { try{ return f(); }catch(e){ return undefined; } };
const rid = () => (Date.now().toString(36) + Math.random().toString(36).slice(2,8));
const say = (m, k) => { if(typeof toast==="function") toast(m, k); else console.log(m); };
const LS = { get(k){ try{ const s = localStorage.getItem(k); return s ? JSON.parse(s) : null; }catch(e){ return null; } },
  set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); return true; }catch(e){ return false; } },
  del(k){ try{ localStorage.removeItem(k); }catch(e){} } };

/* ───────────── التصنيفات ───────────── */
const CATS = [
  ["goals",       "تحليل الأهداف",          "Goals"],
  ["setpieces",   "الكرات الثابتة",          "Set pieces"],
  ["errors",      "الأخطاء الدفاعية",        "Defensive errors"],
  ["tactics",     "التحليل التكتيكي",        "Tactics"],
  ["keepers",     "الحراس والتصديات",        "Goalkeeping"],
  ["transitions", "الهجمات والتحولات",       "Attacks & transitions"],
  ["refs",        "الحالات التحكيمية",       "Refereeing"]
];
const CAT = Object.fromEntries(CATS.map(([k,t,en])=>[k,{t,en}]));
const catT = k => (CAT[k] && CAT[k].t) || "";

/* ترجمة الواجهة (الإنجليزية) — المحتوى نفسه (العناوين والوصف) لا يُترجم */
try{ if(typeof I18N!=="undefined" && I18N.DICT){ const T = {
  "تحليل الفيديو":"Video Analysis", "تحليلات المباراة":"Match Analysis", "رجوع إلى التحليلات":"Back to analysis", "رجوع إلى المباراة":"Back to match",
  "كل التحليلات":"All analysis", "أحدث التحليلات":"Latest analysis", "الكل":"All", "عرض الكل":"View all", "عرض المزيد":"Show more", "شاهد التحليل":"Watch analysis",
  "البطولة":"Competition", "النادي":"Club", "الترتيب":"Sort", "الأحدث":"Newest", "الأقدم":"Oldest", "كل البطولات":"All competitions", "كل الأندية":"All clubs",
  "صفحة المباراة":"Match page", "من نفس المباراة":"From this match", "تحليلات أخرى":"More analysis", "تشغيل":"Play", "مثبّت":"Featured",
  "لا توجد تحليلات بهذه التصفية":"No analysis matches this filter", "لا توجد تحليلات بعد":"No analysis yet", "إدارة الفيديوهات":"Manage videos",
  "فيديو":"video", "فيديوهات":"videos", "إدارة تحليل الفيديو":"Video analysis admin" };
  CATS.forEach(([,t,en])=>{ T[t]=en; }); for(const k in T) if(I18N.DICT[k]==null) I18N.DICT[k]=T[k]; } }catch(e){}

/* ───────────── التواريخ والمدد ───────────── */
const AR_MON = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const LG = () => (typeof I18N!=="undefined" && I18N.isEn && I18N.isEn() && I18N.lang) ? I18N.lang() : "";
const LOC = () => { const l = LG(); return l ? (I18N.locale ? I18N.locale() : l) : ""; };
const dObj = s => { if(!s) return null; const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? s+"T12:00:00" : s); return isNaN(d) ? null : d; };
const dFmt = s => { const d = dObj(s); if(!d) return ""; if(LOC()) return d.toLocaleDateString(LOC(), {day:"numeric", month:"short", year:"numeric"});
  return `${d.getDate()} ${AR_MON[d.getMonth()]} ${d.getFullYear()}`; };
const mmss = n => { n = Math.max(0, Math.round(+n||0)); const h = Math.floor(n/3600), m = Math.floor(n%3600/60), s = n%60;
  return (h ? h+":"+String(m).padStart(2,"0") : m) + ":" + String(s).padStart(2,"0"); };
const parseDur = s => { s = String(s||"").trim(); if(!s) return 0; if(/^\d+$/.test(s)) return +s;
  const p = s.split(":").map(Number); if(p.some(isNaN)) return 0; return p.reduce((a,b)=>a*60+b, 0); };
const nowISO = () => new Date().toISOString();

/* ───────────── مصدر الفيديو ───────────── */
function ytId(u){ const m = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/.exec(String(u||"")); return m ? m[1] : ""; }
const kindOf = u => ytId(u) ? "youtube" : "file";
const thumbOf = v => v.thumb || (ytId(v.src) ? `https://i.ytimg.com/vi/${ytId(v.src)}/hq720.jpg`   /* 16:9 بلا أشرطة سوداء (hqdefault 4:3 فيه أشرطة) */ : "");

/* ───────────── المباريات والأندية (من بيانات الموقع المحمّلة أصلاً — لا قراءة جديدة) ───────────── */
const keyOf = m => safe(()=>matchKey(m)) || "";
const findMatch = k => k ? (safe(()=>matchByKey(k)) || null) : null;
function crestSrc(c){
  return safe(()=> (typeof LOCAL_CRESTS!=="undefined" && LOCAL_CRESTS[c]) || (typeof LOGOS!=="undefined" && LOGOS[c]) || "")
      || safe(()=> window.EXT && EXT.natFlagSrc && EXT.natFlagSrc(c)) || "";
}
const teamColor = c => { const cc = safe(()=>(window.CLUB_COLORS||{})[c]); return (cc && cc[0]) || "#16224A"; };
const crestImg = (c, sz) => { const s = crestSrc(c); return s ? `<img src="${H(s)}" alt="" width="${sz}" height="${sz}" loading="lazy" decoding="async">` : `<i class="va-cr0">${H(String(c||"").slice(0,2))}</i>`; };
/* بيانات المباراة الحيّة تتقدّم على النسخة المخزّنة في الفيديو (لو عُدّل اسم أو تاريخ) */
function ctxOf(v){
  const m = findMatch(v.matchId);
  return { m, home: (m && m.home) || v.home || "", away: (m && m.away) || v.away || "",
    comp: (m && (m.__ext ? m.comp : safe(()=>compOf(m)))) || v.comp || "", date: (m && m.date) || v.mdate || "" };
}
const compLabel = c => c==="الدوري" ? "الدوري الكويتي الممتاز" : c;

/* ═════════════════════════ التخزين ═════════════════════════ */
const LKEY = "mfva_local_v1", CKEY = "mfva_cache";
let DATA = null, loading = null;
const listeners = [];
const onData = f => listeners.push(f);
function setData(d){ DATA = {items: Array.isArray(d && d.items) ? d.items : [], updated: (d && d.updated) || "", demo: !!(d && d.demo)}; listeners.forEach(f=>safe(f)); }
const dbReady = () => new Promise(res=>{ const t = () => (typeof fbDb!=="undefined" && fbDb) ? res(fbDb) : setTimeout(t, 300); t(); });
const store = {
  /* أول حاجة فقط: قراءة واحدة. النسخة المحفوظة تُعرض فوراً ثم تُحدَّث */
  ensure(){
    if(loading) return loading;
    if(LOCAL){ loading = waitMatches().then(()=>{ let d = LS.get(LKEY); if(!d){ d = demoSeed(); LS.set(LKEY, d); } setData(d); }); return loading; }
    const c = LS.get(CKEY); if(c) setData(c);
    loading = (async()=>{
      let d = null;
      if(typeof SNAP!=="undefined" && SNAP && SNAP.get) d = await SNAP.get("videos").catch(()=>null);
      if(!d){ const db = await dbReady(); const s = await db.collection("seasons").doc("videos").get().catch(()=>null); d = s && s.exists ? s.data() : {items:seedCopy(), seed:true}; }
      LS.set(CKEY, d); setData(d);
    })().catch(e=>{ console.warn("videos", e); if(!DATA) setData({items:seedCopy(), seed:true}); });
    return loading;
  },
  async edit(fn){
    if(LOCAL){ const d = LS.get(LKEY) || {items:[], demo:true}; d.items = fn(d.items||[]); d.updated = nowISO();
      if(!LS.set(LKEY, d)) throw new Error("مساحة التخزين المحلي امتلأت — استخدم رابط صورة بدل رفعها"); setData(d); return; }
    const db = await dbReady(), ref = db.collection("seasons").doc("videos");
    const who = (typeof FBUSER!=="undefined" && FBUSER && (FBUSER.email || FBUSER.uid)) || "";
    let out = null;
    await db.runTransaction(async tx=>{ const s = await tx.get(ref); const items = fn(s.exists ? JSON.parse(JSON.stringify(s.data().items || [])) : seedCopy());
      out = {items, updated:nowISO(), updatedBy:who}; tx.set(ref, out); });
    LS.set(CKEY, out); setData(out);
  }
};
window.addEventListener("storage", e=>{ if(LOCAL && e.key===LKEY){ const d = LS.get(LKEY); if(d) setData(d); } });
function waitMatches(){
  return new Promise(res=>{ let n = 0; const t = () => { const ok = safe(()=>Array.isArray(MATCHES) && MATCHES.length>0); if(ok || ++n>60) res(); else setTimeout(t, 250); }; t(); });
}

/* ───────────── بيانات تجريبية (محلي فقط) ─────────────
   مقاطع حقيقية من كرة القدم الكويتية في .va-demo/ (خارج git)، مربوطة بمباريات حقيقية من الموقع.
   العناوين أمثلة للعرض فقط — كل عنصر يحمل demo:true ويظهر بشارة «تجريبي». */
function demoSeed(){
  const all = (safe(()=> (ALL && ALL.matches) || MATCHES) || []).filter(m=>!isUpcoming(m) && safe(()=>matchOver(m)) && compOf(m)==="الدوري")
    .sort((a,b)=>(kickoffTS(b)||0)-(kickoffTS(a)||0));
  const withGoals = all.filter(m=>(+m.hg)+(+m.ag)>0);
  const pick = i => withGoals[i] || all[i] || null;
  const W = m => +m.hg>=+m.ag ? m.home : m.away, L = m => +m.hg>=+m.ag ? m.away : m.home;
  const A = pick(0), B = pick(1), C = pick(2), Dm = pick(3);
  const dm = (n, m, o) => Object.assign({id:"demo"+n, demo:true, status:"published", matchId: m?keyOf(m):"", home:m?m.home:"", away:m?m.away:"",
    comp:m?compOf(m):"", mdate:m?m.date:"", pub:new Date(Date.now()-n*5.3e6).toISOString()}, o);
  const X = [];
  if(A){
    X.push(dm(1, A, {cat:"goals", pinned:true, title:`قراءة هدف ${W(A)}: من بناء اللعب إلى اللمسة الأخيرة`, desc:`كيف تحرّك ${W(A)} بين الخطوط قبل الهدف، ولماذا تأخر خط دفاع ${L(A)} في التغطية. تحليل خطوة بخطوة مع إيقاف اللقطة عند كل قرار.`, src:".va-demo/clip1.mp4", thumb:".va-demo/t14.jpg", dur:16}));
    X.push(dm(2, A, {cat:"keepers", title:`حارس ${L(A)}: التمركز في مواجهة الانفراد`, desc:"زاوية الخروج، توقيت النزول، وقراءة جسد المهاجم قبل التسديدة.", src:".va-demo/clip3.mp4", thumb:".va-demo/tgk.jpg", dur:30}));
    X.push(dm(3, A, {cat:"tactics", title:"التنظيم الدفاعي للفريقين في الشوط الأول", desc:"المسافات بين الخطوط، الكتلة المتوسطة، ومناطق الضغط.", src:".va-demo/clip2.mp4", thumb:".va-demo/t6.jpg", dur:23}));
  }
  if(B){
    X.push(dm(4, B, {cat:"setpieces", title:`ركلة ركنية ${B.home}: الحجب عند القائم القريب`, desc:"توزيع اللاعبين داخل المنطقة، والحجب الذي فتح المساحة للمتابعة.", src:".va-demo/clip2.mp4", thumb:".va-demo/t44.jpg", dur:23}));
    X.push(dm(5, B, {cat:"errors", title:`خطأ التمركز الذي سبق هدف ${W(B)}`, desc:"الظهير يترك موقعه للضغط، والارتكاز لا يغطي المساحة خلفه.", src:".va-demo/clip1.mp4", thumb:".va-demo/t22.jpg", dur:16}));
  }
  if(C){
    X.push(dm(6, C, {cat:"transitions", title:`تحوّل ${C.away} السريع بعد قطع الكرة`, desc:"ثلاث تمريرات من منتصف الملعب إلى المنطقة في أقل من ثماني ثوانٍ.", src:".va-demo/clip1.mp4", thumb:"", dur:16}));
    X.push(dm(7, C, {cat:"refs", title:"لقطة المنطقة: القرار التحكيمي من زاويتين", desc:"قراءة الاحتكاك داخل المنطقة ومكان الحكم لحظة اللقطة.", src:".va-demo/clip2.mp4", thumb:".va-demo/t49.jpg", dur:23}));
    X.push(dm(8, C, {cat:"goals", title:`هدف ${W(C)}: الحركة دون كرة`, desc:"الجري القطري الذي سحب قلب الدفاع وفتح زاوية التسديد.", src:".va-demo/clip1.mp4", thumb:".va-demo/t6.jpg", dur:16}));
  }
  if(Dm){
    X.push(dm(9, Dm, {cat:"tactics", title:`الضغط العالي لـ${Dm.home} في أول ربع ساعة`, desc:"مثلثات الضغط على الظهيرين وإغلاق التمرير للارتكاز.", src:".va-demo/clip2.mp4", thumb:".va-demo/t44.jpg", dur:23}));
    X.push(dm(10, Dm, {cat:"keepers", title:`تصديات حارس ${Dm.away}`, desc:"ثلاث تصديات متتالية وقراءة التمركز في كل منها.", src:".va-demo/clip3.mp4", thumb:".va-demo/tgk.jpg", dur:30}));
    X.push(dm(11, Dm, {cat:"transitions", status:"draft", title:"مسودة: هجمة مرتدة (لا تظهر للجمهور)", desc:"مثال لفيديو محفوظ كمسودة.", src:".va-demo/clip1.mp4", thumb:".va-demo/t22.jpg", dur:16}));
  }
  return {items:X, updated:nowISO(), demo:true};
}

/* ───────────── القائمة الأولى (منصور 2026-11-23: فيديوهات فريق MF SOCCER على يوتيوب @mfsoccerkw) ─────────────
   تُعرض ما دامت وثيقة seasons/videos غير موجودة؛ أول حفظ من لوحة الإدارة ينسخها إلى الوثيقة ثم تصبح الوثيقة هي المصدر. */
const CPC = "كأس سمو ولي العهد", mk = (h, a) => [CPC, 3, h, a].map(v=>encodeURIComponent(String(v))).join("/");
const FB = mk("الفحيحيل","برقان"), NS = mk("النصر","الصليبخات"), TJ = mk("التضامن","الجزيرة");
const sd = (id, yt, match, h, a, date, cat, title, dur, pub, o) => Object.assign({id:"yt-"+id, src:"https://www.youtube.com/watch?v="+yt, thumb:"", matchId:match, home:h, away:a,
  comp:CPC, mdate:date, cat, title, desc:"", dur, pub, status:"published", pinned:false}, o||{});
const SEED = [
  sd("fah1", "9naOgd12lZ4", FB, "الفحيحيل", "برقان", "2026-11-21", "goals",     "هدف الفحيحيل الأول",                      40, "2026-11-23T10:00:00.000Z"),
  sd("fah2", "hqBKKDWMFfE", FB, "الفحيحيل", "برقان", "2026-11-21", "goals",     "هدف الفحيحيل الثاني",                     43, "2026-11-23T10:01:00.000Z"),
  sd("brg2", "7RncvLJauJk", FB, "الفحيحيل", "برقان", "2026-11-21", "goals",     "هدف برقان الثاني",                        38, "2026-11-23T10:02:00.000Z"),
  sd("brg3", "IZwlJTsQdH4", FB, "الفحيحيل", "برقان", "2026-11-21", "setpieces", "هدف الفوز لبرقان",                        38, "2026-11-23T10:03:00.000Z", {pinned:true}),
  sd("nsr1", "YFkpbKAGkz4", NS, "النصر", "الصليبخات", "2026-11-21", "tactics",   "تطوير البناء للنصر",                      40, "2026-11-23T10:04:00.000Z"),
  sd("nsr2", "a8_4sh6sQgI", NS, "النصر", "الصليبخات", "2026-11-21", "goals",     "هدف الفوز للنصر",                         37, "2026-11-23T10:05:00.000Z"),
  sd("jaz1", "mH_rlIyeh7k", TJ, "التضامن", "الجزيرة", "2026-11-20", "setpieces", "هدف الجزيرة",                             28, "2026-11-23T09:00:00.000Z"),
  sd("tdm1", "xxmKtsoro5o", TJ, "التضامن", "الجزيرة", "2026-11-20", "transitions","فرصة خطرة للتضامن",                      32, "2026-11-23T09:01:00.000Z"),
  sd("tdm2", "n6cWb3n8X9M", TJ, "التضامن", "الجزيرة", "2026-11-20", "goals",     "هدف التعادل للتضامن",                     39, "2026-11-23T09:02:00.000Z"),
  sd("gk1",  "lHTc4KUNFvE", TJ, "التضامن", "الجزيرة", "2026-11-20", "keepers",   "فرصة خطرة للجزيرة وإبداع حارس التضامن",  44, "2026-11-23T09:03:00.000Z"),
];
const seedCopy = () => JSON.parse(JSON.stringify(SEED));

/* ───────────── الاستعلام ───────────── */
const isPub = v => v && v.status==="published" && (!v.pub || v.pub <= nowISO());
const published = () => ((DATA && DATA.items) || []).filter(isPub);
const order = (a, b) => (b.pinned?1:0)-(a.pinned?1:0) || String(b.pub||"").localeCompare(String(a.pub||""));
const byId = id => ((DATA && DATA.items) || []).find(v=>v.id===id) || null;
const forMatch = k => k ? published().filter(v=>v.matchId===k).sort((a,b)=>String(a.pub||"").localeCompare(String(b.pub||""))) : [];
VA.forMatch = forMatch;

/* ═════════════════════════ الصفحة ═════════════════════════ */
const ST = {cat:"", comp:"", club:"", sort:"new", page:1};
const PAGE = 12;
const isOn = () => !!D.querySelector("#v-videos.on");
function filtered(cat){
  return published().filter(v=>{
    if(cat && v.cat!==cat) return false;
    const c = ctxOf(v);
    if(ST.comp && c.comp!==ST.comp) return false;
    if(ST.club && c.home!==ST.club && c.away!==ST.club) return false;
    return true;
  }).sort(ST.sort==="old" ? (a,b)=>String(a.pub||"").localeCompare(String(b.pub||"")) : order);
}

/* البطاقة */
function thumbHTML(v, c, big){
  const t = thumbOf(v);
  if(t) return `<img class="va-img" src="${H(t)}" alt="" loading="${big?"eager":"lazy"}" decoding="async"${big?' fetchpriority="high"':""}>`;
  /* بلا صورة: غلاف مولّد من ألوان وشعاري الفريقين */
  return `<span class="va-auto" style="--h:${H(teamColor(c.home))};--a:${H(teamColor(c.away))}" aria-hidden="true">
    <span class="va-auto-cr">${c.home?crestImg(c.home, 72):""}${c.away?`<b>×</b>${crestImg(c.away, 72)}`:""}</span>
    <span class="va-auto-t">${H(catT(v.cat))}</span></span>`;
}
const PLAY = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M8 5.6v12.8a.8.8 0 0 0 1.2.7l10.2-6.4a.8.8 0 0 0 0-1.4L9.2 4.9A.8.8 0 0 0 8 5.6z" fill="currentColor"/></svg>`;
const teamsHTML = (c, sz) => c.home ? `<span class="va-teams"><span>${crestImg(c.home, sz||18)}<b>${H(c.home)}</b></span>${c.away?`<i>×</i><span>${crestImg(c.away, sz||18)}<b>${H(c.away)}</b></span>`:""}</span>` : "";
const metaHTML = c => [c.comp?compLabel(c.comp):"", c.date?dFmt(c.date):""].filter(Boolean).map(x=>`<span>${H(x)}</span>`).join("");
function card(v, opt){
  const c = ctxOf(v);
  return `<article class="va-card${opt&&opt.cls?" "+opt.cls:""}">
    <button type="button" class="va-hit" data-va-play="${H(v.id)}" aria-label="تشغيل: ${H(v.title)}"></button>
    <div class="va-th">${thumbHTML(v, c)}
      <span class="va-cat">${H(catT(v.cat))}</span>
      ${v.dur?`<span class="va-dur" dir="ltr">${mmss(v.dur)}</span>`:""}
      ${v.demo?`<span class="va-demo">تجريبي</span>`:""}
      <span class="va-pl">${PLAY}</span>
    </div>
    <div class="va-tx">
      <h3 data-i18n="off">${H(v.title)}</h3>
      ${teamsHTML(c)}
      <div class="va-meta">${metaHTML(c)}</div>
    </div></article>`;
}
function heroHTML(v){
  const c = ctxOf(v);
  return `<article class="va-hero">
    <button type="button" class="va-hit" data-va-play="${H(v.id)}" aria-label="تشغيل: ${H(v.title)}"></button>
    <div class="va-hero-ph">${thumbHTML(v, c, true)}</div>
    <div class="va-hero-tx">
      <span class="va-tag">${H(catT(v.cat))}${v.demo?` · تجريبي`:""}</span>
      <h2 data-i18n="off">${H(v.title)}</h2>
      ${teamsHTML(c, 22)}
      <div class="va-meta">${metaHTML(c)}</div>
      <span class="va-cta">${PLAY}<span>شاهد التحليل</span>${v.dur?`<em dir="ltr">${mmss(v.dur)}</em>`:""}</span>
    </div></article>`;
}
const railHTML = (title, cat, L, cls) => `<section class="va-blk${cls?" va-"+cls:""}">
    <div class="va-sh"><h2>${H(title)}${cls?"":`<small>${L.length}</small>`}</h2>${cat?`<a class="va-all" href="#videos/c/${cat}" data-va-cat="${cat}">عرض الكل<span aria-hidden="true">‹</span></a>`:""}</div>
    <div class="va-rail-w"><div class="va-rail" tabindex="-1">${L.slice(0,10).map(v=>card(v)).join("")}</div>
      <button type="button" class="va-arr prev" data-va-arr="-1" aria-label="السابق" hidden><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg></button>
      <button type="button" class="va-arr next" data-va-arr="1" aria-label="التالي" hidden><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6"/></svg></button></div>
  </section>`;

function filtersHTML(){
  const P = published();
  const comps = [...new Set(P.map(v=>ctxOf(v).comp).filter(Boolean))];
  const clubs = [...new Set(P.flatMap(v=>{ const c = ctxOf(v); return [c.home, c.away]; }).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ar"));
  const sel = (k, label, all, L, fmt) => `<label class="mf-sel"><span class="mf-lbl">${label}</span><select data-va-f="${k}"><option value="">${all}</option>${L.map(x=>`<option value="${H(x)}"${ST[k]===x?" selected":""}>${H(fmt?fmt(x):x)}</option>`).join("")}</select></label>`;
  return `<div class="va-filters mf-sels">
    ${comps.length>1 || ST.comp ? sel("comp", "البطولة", "كل البطولات", comps, compLabel) : ""}
    ${sel("club", "النادي", "كل الأندية", clubs)}
    <label class="mf-sel"><span class="mf-lbl">الترتيب</span><select data-va-f="sort"><option value="new"${ST.sort!=="old"?" selected":""}>الأحدث</option><option value="old"${ST.sort==="old"?" selected":""}>الأقدم</option></select></label>
  </div>`;
}
function tabsHTML(){
  const P = published();
  const n = k => P.filter(v=>v.cat===k).length;
  return `<nav class="va-tabs" aria-label="التصنيفات">
    <a href="#videos" data-va-cat=""${!ST.cat?' aria-current="page"':""}>الكل</a>
    ${CATS.map(([k,t])=>`<a href="#videos/c/${k}" data-va-cat="${k}"${ST.cat===k?' aria-current="page"':""}${n(k)?"":' class="empty"'}>${t}</a>`).join("")}
  </nav>`;
}
function render(){
  const v = D.getElementById("v-videos"); if(!v) return;
  if(!DATA){ v.innerHTML = `<div class="va">${mastHTML()}<div class="va-skel" aria-hidden="true">${"<div></div>".repeat(4)}</div></div>`; store.ensure(); return; }
  const P = published();
  let body = "";
  if(!P.length) body = `<div class="va-empty"><b>لا توجد تحليلات بعد</b><span>ستظهر الفيديوهات هنا فور نشرها من لوحة الإدارة.</span></div>`;
  else if(!ST.cat && !ST.comp && !ST.club && ST.sort==="new"){
    /* الكل: مميّز ثم صف لكل تصنيف */
    /* الكل: المميّز، ثم «أحدث التحليلات»، ثم صف لكل تصنيف فيه ما يكفي (التصنيف الأقل يبقى في شريط التصنيفات) */
    const all = P.slice().sort(order), top = all[0], rest = all.filter(x=>x!==top);
    const latest = rest.slice().sort((a,b)=>String(b.pub||"").localeCompare(String(a.pub||""))).slice(0, 8);
    body = heroHTML(top) + (latest.length ? railHTML("أحدث التحليلات", "", latest, "latest") : "")
      + CATS.map(([k,t])=>{ const L = rest.filter(x=>x.cat===k); return L.length>=3 ? railHTML(t, k, L) : ""; }).join("");
  } else {
    const L = filtered(ST.cat), shown = L.slice(0, ST.page*PAGE);
    body = L.length ? `<div class="va-grid">${shown.map(x=>card(x)).join("")}</div>${L.length>shown.length?`<div class="va-more"><button type="button" data-va-more>عرض المزيد</button></div>`:""}`
      : `<div class="va-empty"><b>لا توجد تحليلات بهذه التصفية</b><span>جرّب تصنيفاً آخر أو اختر «كل الأندية».</span></div>`;
  }
  v.innerHTML = `<div class="va">${mastHTML()}${LOCAL?localBar():""}${P.length?tabsHTML()+filtersHTML():""}${body}</div>`;
  paintArrows(v);
  D.title = `${ST.cat?catT(ST.cat)+" · ":""}تحليل الفيديو | MF Soccer`;
}
const mastHTML = () => `<header class="va-mast"><div><h1>تحليل الفيديو</h1><span class="va-en">VIDEO ANALYSIS</span></div>
  ${DATA && published().length ? `<span class="va-count">${published().length} ${published().length>10||published().length<3?"فيديو":"فيديوهات"}</span>` : ""}</header>`;
const localBar = () => `<div class="va-local"><span><b>معاينة محلية</b> — ${DATA && DATA.demo ? "فيديوهات تجريبية مربوطة بمباريات حقيقية، " : ""}محفوظة في هذا المتصفح فقط ولا تصل إلى الموقع المباشر.</span>
  <span class="va-local-b"><button type="button" data-va-admin>إدارة الفيديوهات</button><button type="button" data-va-reset>إعادة البيانات التجريبية</button></span></div>`;

/* أسهم الصفوف على الكمبيوتر فقط */
function paintArrows(root){
  if(!matchMedia("(hover:hover) and (pointer:fine)").matches) return;
  root.querySelectorAll(".va-rail-w").forEach(w=>{
    const r = w.querySelector(".va-rail"), p = w.querySelector(".prev"), n = w.querySelector(".next");
    const upd = () => { const max = r.scrollWidth - r.clientWidth, x = Math.abs(r.scrollLeft);
      p.hidden = x < 8; n.hidden = max - x < 8; };
    r.addEventListener("scroll", upd, {passive:true}); upd();
  });
}

/* ───────────── التوجيه ───────────── */
function parse(h){
  const p = String(h||"").replace(/^#videos\/?/,"").split("/").filter(Boolean);
  if(p[0]==="v" && p[1]) return {v:decodeURIComponent(p[1])};
  if(p[0]==="c" && CAT[p[1]]) return {cat:p[1]};
  return {cat:""};
}
function setCat(c){ ST.cat = c||""; ST.page = 1; try{ history.replaceState(history.state, "", c ? "#videos/c/"+c : "#videos"); }catch(e){} render(); }
function openView(){
  if(typeof go==="function") go("videos");
}

/* ═════════════════════════ المشغّل ═════════════════════════ */
let PL = null;     /* {id, pushed, from, focus} */
function playerHTML(v){
  const c = ctxOf(v), m = c.m, done = m && !safe(()=>isUpcoming(m)) && m.hg!=null && m.hg!=="";
  const same = forMatch(v.matchId).filter(x=>x.id!==v.id);
  const more = published().filter(x=>x.id!==v.id && x.matchId!==v.matchId && x.cat===v.cat).sort(order).slice(0,6);
  const fill = more.length<4 ? published().filter(x=>x.id!==v.id && x.matchId!==v.matchId && x.cat!==v.cat).sort(order).slice(0,6-more.length) : [];
  const t = thumbOf(v), yt = ytId(v.src);
  const back = PL && PL.from==="match" ? "رجوع إلى المباراة" : "رجوع إلى التحليلات";
  return `<div class="vap-in">
    <header class="vap-top"><button type="button" class="vap-back" data-va-close><span aria-hidden="true">›</span>${back}</button><span class="vap-brand">تحليل الفيديو</span></header>
    <div class="vap-grid">
      <div class="vap-main">
        <div class="vap-stage${yt?" yt":""}" data-va-stage="${H(v.id)}">
          ${t?`<img class="vap-poster" src="${H(t)}" alt="" decoding="async">`:`<div class="vap-poster">${thumbHTML(v, c)}</div>`}
          <button type="button" class="vap-play" data-va-start aria-label="تشغيل الفيديو">${PLAY}<span>تشغيل</span>${v.dur?`<em dir="ltr">${mmss(v.dur)}</em>`:""}</button>
        </div>
        <div class="vap-info">
          <span class="va-tag">${H(catT(v.cat))}${v.demo?` · تجريبي`:""}</span>
          <h1 data-i18n="off">${H(v.title)}</h1>
          ${c.home ? `<button type="button" class="vap-match"${m?` data-va-match="${H(v.matchId)}"`:" disabled"}>
            <span class="t">${crestImg(c.home, 30)}<b>${H(c.home)}</b></span>
            <span class="s">${done?`<b dir="ltr">${H(m.ag)} - ${H(m.hg)}</b>`:`<b>×</b>`}<small>${H(compLabel(c.comp))}${m&&m.round&&!m.__ext?` · الجولة ${H(m.round)}`:""}</small></span>
            <span class="t a"><b>${H(c.away)}</b>${crestImg(c.away, 30)}</span>
            ${m?`<span class="go">صفحة المباراة<span aria-hidden="true">‹</span></span>`:""}
          </button>` : ""}
          ${v.desc?`<p class="vap-desc" data-i18n="off">${H(v.desc)}</p>`:""}
          <div class="va-meta">${c.date?`<span>${H(dFmt(c.date))}</span>`:""}${v.pub?`<span>نُشر ${H(dFmt(v.pub))}</span>`:""}</div>
        </div>
      </div>
      <aside class="vap-side">
        ${same.length?`<h2>من نفس المباراة</h2><div class="vap-list">${same.map(x=>mini(x)).join("")}</div>`:""}
        ${more.length+fill.length?`<h2>تحليلات أخرى</h2><div class="vap-list">${more.concat(fill).map(x=>mini(x)).join("")}</div>`:""}
      </aside>
    </div></div>`;
}
function mini(v){
  const c = ctxOf(v);
  return `<button type="button" class="vap-mini" data-va-play="${H(v.id)}"><span class="va-th">${thumbHTML(v, c)}${v.dur?`<span class="va-dur" dir="ltr">${mmss(v.dur)}</span>`:""}</span>
    <span class="vap-mini-tx"><small>${H(catT(v.cat))}</small><b data-i18n="off">${H(v.title)}</b><em>${H([c.home, c.away].filter(Boolean).join(" × "))}</em></span></button>`;
}
function player(){ let p = D.getElementById("vaPlayer"); if(!p){ p = D.createElement("div"); p.id = "vaPlayer"; p.className = "vap"; p.hidden = true;
  p.setAttribute("role","dialog"); p.setAttribute("aria-modal","true"); p.setAttribute("aria-label","تحليل الفيديو"); D.body.appendChild(p); } return p; }
function stopMedia(p){ (p||player()).querySelectorAll("video").forEach(x=>{ try{ x.pause(); x.removeAttribute("src"); x.load(); }catch(e){} }); (p||player()).querySelectorAll("iframe").forEach(x=>x.remove()); }
function openPlayer(id, opt){
  opt = opt || {};
  const v = byId(id);
  if(!v || (!isPub(v) && !LOCAL && !canManage())){ say("الفيديو غير متاح", "err"); return false; }
  const p = player(), wasOpen = !p.hidden;
  if(!wasOpen) PL = {id, pushed:false, from: opt.from || (D.querySelector("#mpage.on") ? "match" : "list"), focus: D.activeElement};
  stopMedia(p);
  PL.id = id;
  if(!opt.noHistory){ const h = "#videos/v/"+encodeURIComponent(id);
    try{ if(wasOpen && PL.pushed) history.replaceState({va:id}, "", h); else { history.pushState({va:id}, "", h); PL.pushed = true; } }catch(e){} }
  p.innerHTML = playerHTML(v);
  p.hidden = false; D.documentElement.classList.add("va-lock");
  requestAnimationFrame(()=>{ p.classList.add("on"); const b = p.querySelector(".vap-play"); if(b) b.focus({preventScroll:true}); });
  p.scrollTop = 0; const pin = p.querySelector(".vap-in"); if(pin) pin.scrollTop = 0;
  D.title = `${v.title} | MF Soccer`;
  return true;
}
function hidePlayer(){
  const p = D.getElementById("vaPlayer"); if(!p || p.hidden) return;
  stopMedia(p); p.classList.remove("on"); p.hidden = true; p.innerHTML = ""; D.documentElement.classList.remove("va-lock");
  const f = PL && PL.focus; PL = null; if(f && f.focus && D.contains(f)) safe(()=>f.focus({preventScroll:true}));
  if(isOn()) D.title = "تحليل الفيديو | MF Soccer";
}
function closePlayer(){
  if(!PL) return hidePlayer();
  if(PL.pushed && history.state && history.state.va){ history.back(); return; }   /* popstate يُغلق */
  hidePlayer();
  if(/^#videos\/v\//.test(location.hash)){ try{ history.replaceState(null, "", isOn() ? (ST.cat?"#videos/c/"+ST.cat:"#videos") : location.pathname+location.search); }catch(e){} }
}
/* التشغيل يبدأ بضغطة المستخدم فقط: عنصر الفيديو/الإطار يُنشأ الآن، لا قبل */
function start(stage){
  const v = byId(stage.dataset.vaStage); if(!v) return;
  const yt = ytId(v.src);
  if(yt){
    stage.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0&playsinline=1&modestbranding=1" title="${H(v.title)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
    return;
  }
  const t = thumbOf(v);
  stage.innerHTML = `<video controls playsinline preload="metadata"${t?` poster="${H(t)}"`:""} controlslist="nodownload"></video>`;
  const el = stage.querySelector("video");
  el.addEventListener("error", ()=>{ stage.insertAdjacentHTML("beforeend", `<div class="vap-err">تعذّر تشغيل الفيديو — تحقق من الرابط.</div>`); }, {once:true});
  el.src = v.src;
  const pr = el.play(); if(pr && pr.catch) pr.catch(()=>{});
}

/* ═════════════════════════ صفحة المباراة: «تحليلات المباراة» ═════════════════════════ */
function mpSection(){
  const box = D.getElementById("mpage");
  if(!box || box.hidden || typeof MP!=="object" || !MP || !MP.m) return;
  const old = box.querySelector(".va-mp"); if(old) old.remove();
  if(MP.tab!=="details") return;
  const k = keyOf(MP.m);
  if(!DATA){ store.ensure().then(()=>{ if(typeof MP==="object" && MP && MP.m && keyOf(MP.m)===k) mpSection(); }); return; }
  const L = forMatch(k); if(!L.length) return;      /* لا فيديوهات = لا قسم */
  const body = box.querySelector(".mp-body"); if(!body) return;
  const html = `<section class="mp-card va-mp" aria-label="تحليلات المباراة">
    <div class="mp-hd"><h3>تحليلات المباراة<small class="va-mp-en">MATCH ANALYSIS</small></h3><span class="va-mp-n">${L.length} ${L.length>10||L.length<3?"فيديو":"فيديوهات"}</span></div>
    <div class="va-rail va-mp-rail">${L.map(v=>card(v, {cls:"sm"})).join("")}</div></section>`;
  /* بعد أحداث المباراة (أو بطاقة البطولة إن لم توجد أحداث) */
  const cards = [...body.children];
  const ev = cards.find(c=>/أحداث المباراة/.test((c.querySelector(".mp-hd h3")||{}).textContent||"")) || cards.find(c=>c.classList.contains("mp-empty")) || body.querySelector(".mp-compcard");
  if(ev) ev.insertAdjacentHTML("afterend", html); else body.insertAdjacentHTML("afterbegin", html);
}
/* بعد كل رسم لصفحة المباراة (box.innerHTML) — مراقبة أبناء #mpage المباشرين فقط، فلا يعتمد على ترتيب
   مغلّفات renderMatchPage في ext/gulf ولا يرتد على إدراجنا داخل .mp-body */
function hookMatchPage(){
  const box = D.getElementById("mpage"); if(!box || box.__va) return; box.__va = true;
  /* 2026-11-23: صفحة المباراة صارت داخل .mp-sheet وتُعاد رسمتها داخله → مراقبة الشجرة كاملة، مرة واحدة لكل إطار */
  let raf = 0;
  new MutationObserver(()=>{ if(raf) return; raf = requestAnimationFrame(()=>{ raf = 0; if(!box.hidden && !box.querySelector(".va-mp")) safe(mpSection); }); }).observe(box, {childList:true, subtree:true});
}

/* ═════════════════════════ النقرات ═════════════════════════ */
D.addEventListener("click", e=>{
  if(e.defaultPrevented || e.button>0) return;
  const t = e.target.closest && e.target.closest("[data-va-play],[data-va-cat],[data-va-close],[data-va-start],[data-va-match],[data-va-more],[data-va-arr],[data-va-admin],[data-va-reset]");
  if(!t) return;
  if(t.closest("#vaAdmin")) return;
  if(t.dataset.vaPlay){ e.preventDefault(); e.stopPropagation(); if(e.metaKey||e.ctrlKey) return; openPlayer(t.dataset.vaPlay); return; }
  if(t.hasAttribute("data-va-cat")){ e.preventDefault(); setCat(t.dataset.vaCat); window.scrollTo({top:0, behavior:"instant"}); return; }
  if(t.hasAttribute("data-va-close")){ closePlayer(); return; }
  if(t.hasAttribute("data-va-start")){ start(t.closest("[data-va-stage]")); return; }
  if(t.dataset.vaMatch){ const m = findMatch(t.dataset.vaMatch); if(!m) return;
    const fromMatch = PL && PL.from==="match";
    hidePlayer();
    if(fromMatch && history.state && history.state.va){ history.back(); return; }
    if(typeof openMatch==="function"){ try{ history.replaceState(null, "", location.pathname+location.search); }catch(err){} openMatch(m); }
    return; }
  if(t.hasAttribute("data-va-more")){ ST.page++; const y = scrollY; render(); window.scrollTo({top:y, behavior:"instant"}); return; }
  if(t.dataset.vaArr){ const r = t.parentNode.querySelector(".va-rail"); const dir = D.documentElement.dir==="ltr" ? 1 : -1;
    r.scrollBy({left: dir * +t.dataset.vaArr * r.clientWidth * .85, behavior:"smooth"}); return; }
  if(t.hasAttribute("data-va-admin")){ openAdmin(); return; }
  if(t.hasAttribute("data-va-reset")){ if(!confirm("إعادة البيانات التجريبية؟ تُحذف كل تعديلاتك المحلية.")) return; LS.del(LKEY); loading = null; DATA = null; store.ensure().then(()=>{ render(); paintAdmin(); }); return; }
});
D.addEventListener("change", e=>{
  const s = e.target.closest && e.target.closest("[data-va-f]"); if(!s) return;
  ST[s.dataset.vaF] = s.value || (s.dataset.vaF==="sort" ? "new" : ""); ST.page = 1; render();
});
D.addEventListener("keydown", e=>{ if(e.key==="Escape" && PL && !D.getElementById("vaPlayer").hidden){ e.preventDefault(); closePlayer(); } });
window.addEventListener("popstate", ()=>{
  const h = location.hash;
  if(/^#videos\/v\//.test(h)){ const st = parse(h); const go2 = () => { if(PL && PL.id===st.v) return; openPlayer(st.v, {noHistory:true}); if(PL) PL.pushed = true; };
    DATA ? go2() : store.ensure().then(go2); return; }
  if(PL) hidePlayer();
  if(/^#videos/.test(h)){ const st = parse(h); ST.cat = st.cat || ""; if(!isOn()) openView(); else render(); }
});

/* ═════════════════════════ مدخل الرئيسية (منصور 2026-11-23: «هني فوق ابي tab تحليل الفيديو يكون موجود») ═════════════════════════
   أعلى الرئيسية مباشرة (بعد بطاقة الزوار للطاقم إن وُجدت). لا قراءة من Firestore هنا: البيانات المحمّلة أو النسخة المحفوظة أو القائمة الأولى. */
function homeItems(){
  const src = (DATA && DATA.items) || (safe(()=>LS.get(LOCAL ? LKEY : CKEY)) || {}).items || (LOCAL ? [] : SEED);
  return src.filter(isPub).sort((a,b)=>String(b.pub||"").localeCompare(String(a.pub||"")));
}
function homeHTML(){
  const L = homeItems(); if(!L.length) return "";
  const th = L.slice(0,3).map(v=>{ const t = thumbOf(v); return t ? `<i style="background-image:url('${H(t)}')"></i>` : ""; }).join("");
  const n = L.length, nTxt = `${n} ${n>10||n<3?"فيديو":"فيديوهات"}`;
  return `<button type="button" class="va-home" aria-label="تحليل الفيديو">
    <span class="va-home-ic">${ICON}</span>
    <span class="va-home-t"><b>تحليل الفيديو</b><small>${H(nTxt)}</small></span>
    <span class="va-home-th" aria-hidden="true">${th}</span>
    <svg class="va-home-go" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
  </button>`;
}
function paintHome(){
  const v = D.getElementById("v-home"); if(!v) return;
  const old = v.querySelector(":scope > .va-home"), html = homeHTML();
  if(!html){ if(old) old.remove(); return; }
  if(old && old._h === html){ const eye = v.querySelector(":scope > .vx-eye"); if(!eye || eye.nextElementSibling === old) return; }
  const box = D.createElement("div"); box.innerHTML = html; const el = box.firstElementChild; el._h = html;
  el.onclick = () => { try{ if(!location.hash) history.pushState({mfv:"videos"}, "", location.pathname + location.search); }catch(e){} if(typeof go==="function") go("videos"); window.scrollTo(0,0); };
  if(old) old.remove();
  const eye = v.querySelector(":scope > .vx-eye");
  if(eye) eye.after(el); else v.insertBefore(el, v.firstChild);
}
let homeQ = 0;
const homeSoon = () => { if(homeQ) return; homeQ = requestAnimationFrame(()=>{ homeQ = 0; safe(paintHome); }); };
function watchHomeEntry(){
  const v = D.getElementById("v-home"); if(!v || v.__vaHome) return; v.__vaHome = true;
  /* الرئيسية تُرسم من جديد بـ innerHTML، وبطاقة الزوار تُدرج نفسها أولاً: نعيد المدخل إن اختفى أو تغيّر ترتيبه */
  new MutationObserver(ms=>{ if(ms.some(m=>[...m.addedNodes, ...m.removedNodes].some(n=>!(n.classList && n.classList.contains("va-home"))))) homeSoon(); }).observe(v, {childList:true});
  onData(homeSoon); homeSoon();
}

/* ═════════════════════════ ربط الموقع ═════════════════════════ */
const ICON = `<svg class="ic" aria-hidden="true" width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m10.2 9.3 4.6 2.7-4.6 2.7z"/></svg>`;
function hookSite(){
  const nav = D.querySelector("nav.tabs");
  if(nav && !nav.querySelector('[data-v="videos"]')){
    const b = D.createElement("button"); b.setAttribute("role","tab"); b.dataset.v = "videos"; b.setAttribute("aria-selected","false");
    b.innerHTML = `${ICON}<span>تحليل الفيديو</span>`;
    const g = nav.querySelector('[data-v="news"]') || nav.querySelector('[data-v="matches"]'); if(g) g.after(b); else nav.appendChild(b);
    b.addEventListener("click", ()=>{ if(typeof go==="function") go("videos"); });
  }
  if(!D.getElementById("v-videos")){ const s = D.createElement("section"); s.className = "view"; s.id = "v-videos";
    const a = D.getElementById("v-news") || D.getElementById("v-matches"); (a?a.parentNode:D.querySelector("main")||D.body).insertBefore(s, a?a.nextSibling:null); }
  if(typeof RENDER==="object" && RENDER) RENDER.videos = ()=>{
    const h = location.hash;
    if(/^#videos/.test(h) && !/^#videos\/v\//.test(h)) ST.cat = parse(h).cat || "";
    else if(!/^#videos/.test(h)){ try{ history.replaceState(history.state, "", ST.cat ? "#videos/c/"+ST.cat : "#videos"); }catch(e){} }
    render(); store.ensure().then(()=>{ if(isOn()) render(); });
  };
}
function hookNav(){
  const g0 = window.go;
  if(typeof g0==="function" && !g0.__va){
    const w = function(v){ if(v!=="videos"){ if(PL) hidePlayer(); if(/^#videos/.test(location.hash)) history.replaceState(null, "", location.pathname + location.search); } return g0.apply(this, arguments); };
    Object.keys(g0).forEach(k=>{ try{ w[k] = g0[k]; }catch(e){} }); w.__va = true;
    try{ window.go = w; }catch(e){} try{ go = w; }catch(e){}
  }
  const gs = window.goStart;
  if(typeof gs==="function" && !gs.__va){
    const w = function(){ if(/^#videos/.test(location.hash)){ hookSite(); deepLink(); return; } return gs.apply(this, arguments); };
    Object.keys(gs).forEach(k=>{ try{ w[k] = gs[k]; }catch(e){} }); w.__va = true;
    try{ window.goStart = w; }catch(e){} try{ goStart = w; }catch(e){}
  }
}
function deepLink(){
  const st = parse(location.hash);
  if(st.v){ const vid = st.v; ST.cat = "";
    try{ history.replaceState(null, "", "#videos"); }catch(e){}
    openView(); store.ensure().then(()=>{ if(isOn()) render(); openPlayer(vid); });
    return; }
  ST.cat = st.cat || ""; openView();
}
hookNav();

/* ═════════════════════════ الإدارة ═════════════════════════ */
function canManage(){
  if(LOCAL) return true;
  const adm = typeof isAdmin!=="undefined" && !!isAdmin;
  const mo = typeof window.MF_MATCHES_ONLY==="function" && window.MF_MATCHES_ONLY();
  return adm && !mo;
}
const AD = {q:"", cat:"", ed:null, busy:false};
function matchOptions(sel){
  const L = (safe(()=> (ALL && ALL.matches) || MATCHES) || []).slice();
  const ext = (safe(()=>window.EXT && EXT.data && EXT.data() && EXT.data().matches) || []);
  const seen = new Set(), groups = {};
  L.concat(ext).forEach(m=>{ const k = keyOf(m); if(!k || seen.has(k) || !m.home || !m.away) return; seen.add(k);
    const c = m.__ext || ext.includes(m) ? m.comp : safe(()=>compOf(m)) || "";
    (groups[c] = groups[c] || []).push({k, m}); });
  const lab = ({m}) => `${m.home} × ${m.away}${m.round?` — ج${m.round}`:""}${m.date?` · ${m.date}`:""}${m.hg!=null&&m.hg!==""&&!safe(()=>isUpcoming(m))?` (${m.hg}-${m.ag})`:""}`;
  const keys = Object.keys(groups).sort((a,b)=>(a==="الدوري"?-1:b==="الدوري"?1:a.localeCompare(b,"ar")));
  return `<option value="">— بدون مباراة (تحليل عام) —</option>` + keys.map(c=>`<optgroup label="${H(compLabel(c))}">${groups[c]
    .sort((a,b)=>{ const ua = safe(()=>isUpcoming(a.m))?1:0, ub = safe(()=>isUpcoming(b.m))?1:0;   /* الملعوبة أولاً (الأحدث)، ثم القادمة (الأقرب) */
      return ua-ub || (ua ? String(a.m.date||"").localeCompare(String(b.m.date||"")) : String(b.m.date||"").localeCompare(String(a.m.date||""))); }).map(x=>`<option value="${H(x.k)}"${x.k===sel?" selected":""}>${H(lab(x))}</option>`).join("")}</optgroup>`).join("");
}
const blank = () => ({id:rid(), title:"", desc:"", src:"", thumb:"", matchId:"", home:"", away:"", comp:"", mdate:"", cat:"goals", dur:0, pub:nowISO(), status:"published", pinned:false});
const localInput = s => { const d = dObj(s) || new Date(); const p = n => String(n).padStart(2,"0"); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
function adminHTML(){
  const L = ((DATA && DATA.items) || []).slice().sort(order).filter(v=>(!AD.cat || v.cat===AD.cat) && (!AD.q || (v.title+" "+v.home+" "+v.away).includes(AD.q)));
  const st = v => v.status!=="published" ? "مسودة" : v.pub > nowISO() ? "مجدول" : "منشور";
  return `<div id="vaAdmin" class="vaa">
    <h2 class="sec">إدارة تحليل الفيديو</h2>
    ${LOCAL?`<p class="vaa-note">وضع محلي: الحفظ في هذا المتصفح فقط (localStorage) — لا شيء يُكتب على قاعدة البيانات الحقيقية.</p>`:""}
    ${AD.ed ? editorHTML(AD.ed) : `<div class="vaa-bar">
      <button type="button" class="vaa-b pri" data-vaa="new">إضافة فيديو</button>
      <input type="search" placeholder="بحث بالعنوان أو الفريق" value="${H(AD.q)}" data-vaa-q>
      <select data-vaa-cat><option value="">كل التصنيفات</option>${CATS.map(([k,t])=>`<option value="${k}"${AD.cat===k?" selected":""}>${t}</option>`).join("")}</select>
    </div>
    <div class="vaa-list">${L.length ? L.map(v=>{ const c = ctxOf(v); return `<div class="vaa-row">
        <span class="vaa-th">${thumbHTML(v, c)}</span>
        <span class="vaa-tx"><b data-i18n="off">${H(v.title)}</b><small>${H(catT(v.cat))} · ${H([c.home,c.away].filter(Boolean).join(" × ") || "بدون مباراة")}${v.dur?` · <span dir="ltr">${mmss(v.dur)}</span>`:""}</small>
          <em class="st-${v.status==="published"?"on":"off"}">${st(v)}${v.pinned?" · مثبّت":""}${v.demo?" · تجريبي":""}${v.matchId && !findMatch(v.matchId)?" · المباراة غير موجودة":""}</em></span>
        <span class="vaa-acts"><button type="button" class="vaa-b" data-vaa="edit" data-id="${H(v.id)}">تعديل</button>
          <button type="button" class="vaa-b" data-vaa="toggle" data-id="${H(v.id)}">${v.status==="published"?"إخفاء":"نشر"}</button>
          <button type="button" class="vaa-b del" data-vaa="del" data-id="${H(v.id)}">حذف</button></span></div>`; }).join("") : `<p class="vaa-note">لا فيديوهات.</p>`}</div>`}
  </div>`;
}
function editorHTML(v){
  const clubs = safe(()=>CLUBS) || [];
  return `<form class="vaa-ed" data-vaa-form novalidate>
    <div class="vaa-g">
      <label class="full"><span>عنوان التحليل *</span><input name="title" required maxlength="140" value="${H(v.title)}"></label>
      <label class="full"><span>الوصف</span><textarea name="desc" rows="3" maxlength="1200">${H(v.desc)}</textarea></label>
      <label class="full"><span>رابط الفيديو * <small>ملف MP4 مباشر أو رابط YouTube</small></span><input name="src" dir="ltr" required value="${H(v.src)}" placeholder="https://…/clip.mp4  أو  https://youtu.be/…"></label>
      <label class="full"><span>المباراة <small>تُعبّأ الفرق والبطولة والتاريخ تلقائياً</small></span><select name="matchId">${matchOptions(v.matchId)}</select></label>
      <label><span>الفريق المضيف</span><input name="home" list="vaaClubs" value="${H(v.home)}"></label>
      <label><span>الفريق الضيف</span><input name="away" list="vaaClubs" value="${H(v.away)}"></label>
      <label><span>البطولة</span><input name="comp" value="${H(v.comp)}"></label>
      <label><span>تاريخ المباراة</span><input name="mdate" type="date" value="${H(v.mdate||"")}"></label>
      <label><span>نوع التحليل *</span><select name="cat">${CATS.map(([k,t])=>`<option value="${k}"${v.cat===k?" selected":""}>${t}</option>`).join("")}</select></label>
      <label><span>المدة <small>دقائق:ثوانٍ</small></span><input name="dur" dir="ltr" value="${v.dur?mmss(v.dur):""}" placeholder="2:45"></label>
      <label><span>تاريخ النشر</span><input name="pub" type="datetime-local" value="${H(localInput(v.pub))}"></label>
      <label><span>الحالة</span><select name="status"><option value="published"${v.status==="published"?" selected":""}>منشور</option><option value="draft"${v.status!=="published"?" selected":""}>مسودة</option></select></label>
      <label class="full"><span>الصورة المصغّرة <small>رابط صورة، أو ارفع صورة، أو اتركها فارغة (صورة YouTube أو غلاف بشعاري الفريقين)</small></span>
        <span class="vaa-thr"><input name="thumb" dir="ltr" value="${H(String(v.thumb||"").startsWith("data:")?"":v.thumb)}" placeholder="https://…/thumb.jpg"><label class="vaa-b vaa-file">رفع صورة<input type="file" accept="image/*" data-vaa-file hidden></label></span>
        <span class="vaa-prev" data-vaa-prev>${thumbHTML(v, ctxOf(v))}</span></label>
      <label class="chk"><input type="checkbox" name="pinned"${v.pinned?" checked":""}><span>تثبيت كفيديو مميّز في أعلى الصفحة</span></label>
    </div>
    <datalist id="vaaClubs">${clubs.map(c=>`<option value="${H(c)}">`).join("")}</datalist>
    <p class="vaa-err" data-vaa-err hidden></p>
    <div class="vaa-bar end"><button type="button" class="vaa-b" data-vaa="cancel">إلغاء</button><button type="button" class="vaa-b" data-vaa="probe">قراءة المدة من الفيديو</button><button type="submit" class="vaa-b pri">حفظ</button></div>
  </form>`;
}
function readForm(f){
  const g = n => (f.elements[n] && f.elements[n].value || "").trim();
  const v = Object.assign({}, AD.ed, {title:g("title"), desc:g("desc"), src:g("src"), matchId:g("matchId"), home:g("home"), away:g("away"), comp:g("comp"),
    mdate:g("mdate"), cat:g("cat"), dur:parseDur(g("dur")), status:g("status"), pinned:!!f.elements.pinned.checked});
  const p = dObj(g("pub")); v.pub = p ? p.toISOString() : nowISO();
  const t = g("thumb"); if(t) v.thumb = t; else if(!String(AD.ed.thumb||"").startsWith("data:")) v.thumb = "";
  return v;
}
function validate(v){
  if(!v.title) return "اكتب عنوان التحليل";
  if(!v.src) return "أضف رابط الفيديو";
  if(!/^(https?:\/\/|\.?\/|\.va-demo\/)/i.test(v.src)) return "رابط الفيديو يجب أن يبدأ بـ https://";
  if(!CAT[v.cat]) return "اختر نوع التحليل";
  if(v.thumb && !/^(https?:\/\/|data:image\/|\.?\/|\.va-demo\/)/i.test(v.thumb)) return "رابط الصورة غير صالح";
  if(v.matchId && !findMatch(v.matchId)) return "المباراة المختارة غير موجودة";
  return "";
}
function paintAdmin(){
  const box = D.getElementById("vaAdmin"); if(!box) return;
  const t = D.createElement("div"); t.innerHTML = adminHTML(); box.replaceWith(t.firstElementChild);
}
function injectAdmin(){
  const v = D.getElementById("v-admin"); if(!v || D.getElementById("vaAdmin") || !canManage()) return;
  if(!LOCAL && !D.getElementById("matchAdmin")) return;
  if(LOCAL && !D.getElementById("matchAdmin") && !v.dataset.vaOnly) return;
  const w = D.createElement("div"); w.innerHTML = adminHTML(); v.appendChild(w.firstElementChild);
}
function hookAdmin(){
  ["renderAdmin","renderEditorAdmin"].forEach(n=>{ const f = window[n]; if(typeof f!=="function" || f.__vaadm) return;
    const w = function(){ const r = f.apply(this, arguments);
      try{ store.ensure().then(()=>{ injectAdmin(); regroup(); }); }catch(e){ console.error(e); }
      return r; };
    Object.keys(f).forEach(k=>{ try{ w[k] = f[k]; }catch(e){} }); w.__vaadm = true;
    try{ window[n] = w; }catch(e){} try{ if(n==="renderAdmin") renderAdmin = w; else renderEditorAdmin = w; }catch(e){}
  });
  if(typeof RENDER==="object" && RENDER) RENDER.admin = window.renderAdmin;
}
/* أعد بناء تبويبات الإدارة بعد إضافة اللوحة (نفس طريقة الأخبار) */
function regroup(){
  if(!window.ADMIN_TABS) return; const v = D.getElementById("v-admin"); if(!v || !v.querySelector(".adm-tabs") || !D.getElementById("vaAdmin")) return;
  if(D.getElementById("vaAdmin").closest(".adm-panel")) return;
  v.querySelector(".adm-tabs").remove(); v.querySelectorAll(".adm-panel").forEach(p=>{ while(p.firstChild) v.insertBefore(p.firstChild, p); p.remove(); }); ADMIN_TABS.organize();
}
/* محلياً: لوحة الفيديو وحدها في صفحة الإدارة بلا تسجيل دخول (تخزين المتصفح فقط) */
function openAdmin(){
  if(!LOCAL) { if(typeof go==="function") go("admin"); return; }
  if(typeof go==="function") go("admin");
  setTimeout(()=>{ const v = D.getElementById("v-admin"); if(v && !D.getElementById("vaAdmin")){ v.innerHTML = ""; v.dataset.vaOnly = "1"; store.ensure().then(()=>{ injectAdmin(); v.insertAdjacentHTML("afterbegin", `<p class="vaa-note"><button type="button" class="vaa-b" onclick="go('videos')">‹ العودة إلى تحليل الفيديو</button></p>`); }); } }, 60);
}
VA.openAdmin = openAdmin;
function adminSave(v){
  AD.busy = true;
  return store.edit(items=>{ const i = items.findIndex(x=>x.id===v.id); v.updated = nowISO(); if(i>=0) items[i] = v; else items.push(v); return items; })
    .then(()=>{ AD.ed = null; AD.busy = false; paintAdmin(); if(isOn()) render(); say("حُفظ الفيديو", "ok"); })
    .catch(e=>{ AD.busy = false; say((e && e.message) || "تعذّر الحفظ", "err"); });
}
D.addEventListener("click", e=>{
  const b = e.target.closest && e.target.closest("#vaAdmin [data-vaa]"); if(!b) return;
  const a = b.dataset.vaa, id = b.dataset.id, cur = id && byId(id);
  if(a==="new"){ AD.ed = blank(); paintAdmin(); return; }
  if(a==="edit" && cur){ AD.ed = JSON.parse(JSON.stringify(cur)); paintAdmin(); D.getElementById("vaAdmin").scrollIntoView({block:"start"}); return; }
  if(a==="cancel"){ AD.ed = null; paintAdmin(); return; }
  if(a==="toggle" && cur){ store.edit(items=>items.map(x=>x.id===id ? Object.assign({}, x, {status: x.status==="published" ? "draft" : "published", updated:nowISO()}) : x)).then(()=>{ paintAdmin(); if(isOn()) render(); }); return; }
  if(a==="del" && cur){ if(!confirm(`حذف «${cur.title}»؟`)) return; store.edit(items=>items.filter(x=>x.id!==id)).then(()=>{ paintAdmin(); if(isOn()) render(); }); return; }
  if(a==="probe"){ const f = b.closest("form"), src = f.elements.src.value.trim(), err = f.querySelector("[data-vaa-err]");
    if(ytId(src)){ err.hidden = false; err.textContent = "مدة فيديو YouTube تُكتب يدوياً"; return; }
    if(!src){ err.hidden = false; err.textContent = "أضف رابط الفيديو أولاً"; return; }
    /* قراءة البيانات الوصفية فقط (لا تحميل للفيديو كاملاً) */
    const x = D.createElement("video"); x.preload = "metadata"; x.muted = true;
    x.onloadedmetadata = ()=>{ f.elements.dur.value = mmss(x.duration); err.hidden = true; x.removeAttribute("src"); x.load(); };
    x.onerror = ()=>{ err.hidden = false; err.textContent = "تعذّرت قراءة الفيديو من الرابط"; };
    x.src = src; return; }
});
D.addEventListener("submit", e=>{
  const f = e.target.closest && e.target.closest("[data-vaa-form]"); if(!f) return;
  e.preventDefault(); if(AD.busy) return;
  const v = readForm(f), err = validate(v), box = f.querySelector("[data-vaa-err]");
  if(err){ box.hidden = false; box.textContent = err; return; }
  adminSave(v);
});
D.addEventListener("change", e=>{
  const t = e.target; if(!t.closest || !t.closest("#vaAdmin")) return;
  if(t.matches("[data-vaa-cat]")){ AD.cat = t.value; paintAdmin(); return; }
  const f = t.closest("[data-vaa-form]"); if(!f) return;
  if(t.name==="matchId"){ const m = findMatch(t.value); if(m){ f.elements.home.value = m.home; f.elements.away.value = m.away;
      f.elements.comp.value = m.__ext ? m.comp : (safe(()=>compOf(m))||""); f.elements.mdate.value = m.date || ""; } }
  if(t.matches("[data-vaa-file]") && t.files && t.files[0]){
    const comp = window.NEWS && NEWS._t && NEWS._t.compress;
    const done = d => { AD.ed = Object.assign(readForm(f), {thumb:d}); paintAdmin(); };
    if(comp) comp(t.files[0]).then(r=>done(r.t)).catch(er=>say(er.message||"تعذّرت قراءة الصورة","err"));
    else { const r = new FileReader(); r.onload = ()=>done(r.result); r.readAsDataURL(t.files[0]); }
    return; }
  if(["src","thumb","home","away","cat"].includes(t.name)){ const v = readForm(f); const p = f.querySelector("[data-vaa-prev]"); if(p) p.innerHTML = thumbHTML(v, ctxOf(v)); }
});
D.addEventListener("input", e=>{ const q = e.target.closest && e.target.closest("[data-vaa-q]"); if(!q) return; AD.q = q.value.trim();
  clearTimeout(AD._t); AD._t = setTimeout(()=>{ paintAdmin(); const n = D.querySelector("#vaAdmin [data-vaa-q]"); if(n){ n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 250); });

/* ═════════════════════════ الإقلاع ═════════════════════════ */
function boot(){
  hookSite(); hookNav(); hookMatchPage(); hookAdmin(); watchHomeEntry();
  if(/^#videos/.test(location.hash) && !isOn()) setTimeout(()=>{ if(/^#videos/.test(location.hash) && !isOn()) deepLink(); }, 0);
  /* صفحة مباراة مفتوحة قبل جاهزية القسم (رابط #m/ مباشر) */
  if(D.querySelector("#mpage.on")) mpSection();
}
VA._t = {store, ST, get DATA(){ return DATA; }, openPlayer, closePlayer, forMatch, LOCAL, CATS, demoSeed, parse, mpSection};
if(D.readyState==="loading") D.addEventListener("DOMContentLoaded", ()=>setTimeout(boot, 50)); else setTimeout(boot, 50);
})();
