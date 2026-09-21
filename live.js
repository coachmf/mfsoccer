/* =====================================================================
   مركز المباراة المباشر — MFSOCCER Live Match Center (2026-09-21)

   مصدر واحد للحقيقة: وثيقة لكل مباراة في Firestore ‏seasons/live_<hash>
   (قراءة عامة، كتابة للمالك والمحرّرين — قواعد seasons/{doc} الحالية نفسها،
   فلا تغيير في القواعد). لوحة المشغّل وصفحة الجمهور تقرآن الوثيقة نفسها
   عبر onSnapshot، وكل رقم (النتيجة، البطاقات، الإحصاءات) يُشتق من الأحداث
   لحظة العرض — لا يُخزَّن أي مجموع يمكن أن يتعارض مع الأحداث.

   الساعة: حالة لا وقت متصفح — {phase, running, base, anchor}، والمرساة
   طابع خادم (serverTimestamp) ويُصحَّح فرق ساعة الجهاز من طوابع الخادم.

   وضع الاختبار: ‏?livetest=1 على localhost فقط — تخزين محلي + BroadcastChannel
   بين التبويبات، فلا يُمسّ Firestore الحقيقي أثناء التجربة.
   ===================================================================== */
(function(){
"use strict";
const LV = window.LIVE = {};
const TEST = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && /[?&]livetest=1\b/.test(location.search);
LV.TEST = TEST;

/* ───────────── أدوات عامة ───────────── */
const H = s => String(s==null?"":s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const clone = o => o==null ? o : JSON.parse(JSON.stringify(o));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
function hashId(s){ let h=0x811c9dc5; for(const ch of String(s)){ h^=ch.codePointAt(0); h=Math.imul(h,0x01000193)>>>0; } return h.toString(36); }
LV.idOf = key => "live_" + hashId(key);
const tsMs = v => v==null ? null : typeof v==="number" ? v : v.toMillis ? v.toMillis() : (v.seconds!=null ? v.seconds*1000 + Math.round((v.nanoseconds||0)/1e6) : null);
const crestOf = c => (LV.crestHook && LV.crestHook(c)) || ((typeof crest==="function") ? crest(c) : "");
const logoOf = c => (typeof LOGOS==="object" && LOGOS && LOGOS[c]) || "";

/* فرق ساعة الجهاز عن الخادم: يُقدَّر من طوابع الخادم في كل لقطة جديدة */
LV.skew = 0; let skewN = 0;
LV.now = () => Date.now() + LV.skew;
function noteServerTs(ms){
  if(ms==null) return;
  const s = ms - Date.now();
  if(Math.abs(s) > 36e5) return;                      /* قيمة شاذة */
  LV.skew = skewN ? (LV.skew*0.7 + s*0.3) : s; skewN++;
}

/* ───────────── كتالوج الأحداث ─────────────
   k: المفتاح · t: الاسم · ic: الأيقونة · g: المجموعة في الشريط
   team: يحتاج فريقاً · p/p2: تسمية اللاعب الأول/الثاني · loc: له مكان على الملعب
   major: يظهر على الخط الزمني الأفقي · key: اختصار لوحة المفاتيح */
const EV = [
  {k:"goal",   t:"هدف",            ic:"goal",  g:"main", team:1, p:"المسجّل", p2:"صانع الهدف", loc:1, major:1, key:"g", goal:1},
  {k:"yellow", t:"إنذار",           ic:"yc",    g:"main", team:1, p:"اللاعب", loc:1, major:1, key:"y"},
  {k:"red",    t:"طرد",             ic:"rc",    g:"main", team:1, p:"اللاعب", loc:1, major:1, key:"r"},
  {k:"yr",     t:"إنذار ثانٍ وطرد", ic:"yr",    g:"main", team:1, p:"اللاعب", loc:1, major:1},
  {k:"sub",    t:"تبديل",           ic:"sub",   g:"main", team:1, p:"الخارج", p2:"الداخل", major:1, key:"s", reason:1},
  {k:"injury", t:"إصابة",           ic:"inj",   g:"main", team:1, p:"اللاعب", loc:1, major:1, key:"i"},
  {k:"corner", t:"ركنية",           ic:"corner",g:"play", team:1, loc:1, key:"c"},
  {k:"throw",  t:"رمية تماس",       ic:"throw", g:"play", team:1, loc:1, key:"t"},
  {k:"gk",     t:"ركلة مرمى",       ic:"gk",    g:"play", team:1, loc:1, key:"k"},
  {k:"fk",     t:"ركلة حرة",        ic:"fk",    g:"play", team:1, p:"المنفّذ", loc:1},
  {k:"shot",   t:"تسديدة",          ic:"shot",  g:"shot", team:1, p:"المسدّد", loc:1},
  {k:"shoton", t:"تسديدة على المرمى",ic:"on",   g:"shot", team:1, p:"المسدّد", loc:1, key:"o"},
  {k:"shotoff",t:"تسديدة خارج المرمى",ic:"off", g:"shot", team:1, p:"المسدّد", loc:1, key:"x"},
  {k:"save",   t:"تصدٍّ",           ic:"save",  g:"shot", team:1, p:"الحارس", loc:1, key:"v"},
  {k:"block",  t:"صدّ تسديدة",      ic:"block", g:"shot", team:1, p:"اللاعب", loc:1},
  {k:"offside",t:"تسلل",            ic:"offside",g:"play",team:1, p:"اللاعب", loc:1, key:"f"},
  {k:"foul",   t:"خطأ",             ic:"foul",  g:"play", team:1, p:"المرتكب", p2:"المتعرّض للخطأ", loc:1, key:"u"},
  {k:"handball",t:"لمسة يد",        ic:"hand",  g:"play", team:1, p:"اللاعب", loc:1},
  {k:"danger", t:"لعب خطر",         ic:"danger",g:"play", team:1, p:"اللاعب", loc:1},
  {k:"tackle", t:"افتكاك",          ic:"tackle",g:"def",  team:1, p:"اللاعب", loc:1},
  {k:"intercept",t:"قطع كرة",       ic:"intercept",g:"def",team:1, p:"اللاعب", loc:1},
  {k:"clear",  t:"تشتيت",           ic:"clear", g:"def",  team:1, p:"اللاعب", loc:1},
  {k:"pen",    t:"ركلة جزاء",       ic:"pen",   g:"pen",  team:1, p:"المنفّذ", loc:1, major:1, res:1},
  {k:"penmiss",t:"ركلة جزاء ضائعة", ic:"penmiss",g:"pen", team:1, p:"المنفّذ", loc:1, major:1, res:1},
  {k:"pensave",t:"ركلة جزاء متصدّى لها",ic:"pensave",g:"pen",team:1, p:"المنفّذ", p2:"الحارس المتصدّي", p2opp:1, loc:1, major:1, res:1},
  {k:"og",     t:"هدف عكسي",        ic:"og",    g:"pen",  team:1, p:"من سجّل في مرماه", pOpp:1, p2:"صاحب التسديدة", loc:1, major:1, goal:1},
  {k:"chance", t:"فرصة خطيرة",      ic:"on",    g:"shot", team:1, p:"اللاعب", loc:1},
  {k:"var",    t:"مراجعة VAR",      ic:"var",   g:"var",  team:0, major:1, key:"a", note:"سبب المراجعة"},
  {k:"vard",   t:"قرار VAR",        ic:"vard",  g:"var",  team:0, major:1, dec:1, note:"تفاصيل القرار"},
  {k:"medical",t:"توقف طبي",        ic:"med",   g:"stop", team:0},
  {k:"water",  t:"استراحة شرب",     ic:"water", g:"stop", team:0},
  {k:"added",  t:"وقت بدل ضائع",    ic:"added", g:"stop", team:0, num:1},
  {k:"custom", t:"حدث آخر",         ic:"custom",g:"stop", team:0, note:"وصف الحدث", loc:1, optTeam:1},
  /* أحداث الساعة — تُنشأ من أزرار التحكم */
  {k:"kickoff",t:"صافرة البداية",   ic:"play",  sys:1},
  {k:"ht",     t:"نهاية الشوط الأول",ic:"ht",   sys:1, major:1},
  {k:"h2",     t:"بداية الشوط الثاني",ic:"play",sys:1},
  {k:"e1",     t:"بداية الشوط الإضافي الأول",ic:"play",sys:1},
  {k:"e2",     t:"بداية الشوط الإضافي الثاني",ic:"play",sys:1},
  {k:"pause",  t:"إيقاف مؤقت",      ic:"pause", sys:1},
  {k:"resume", t:"استئناف",         ic:"resume",sys:1},
  {k:"ft",     t:"نهاية المباراة",  ic:"ft",    sys:1, major:1}
];
const EVK = {}; EV.forEach(e=>EVK[e.k]=e);
LV.EV = EV; LV.EVK = EVK;
const TOOL_GROUPS = [["main","الأساسية"],["play","اللعب"],["shot","التسديد"],["def","الدفاع"],["pen","الجزاء"],["var","VAR"],["stop","التوقف"]];

/* أيقونات SVG وظيفية (لا رموز تعبيرية) */
const IC = {
  goal:'<circle cx="12" cy="12" r="8.5" fill="#fff" stroke="#111" stroke-width="1.3"/><path d="M12 7.6l3.3 2.4-1.3 3.9h-4l-1.3-3.9z" fill="#111"/><path d="M12 7.6V3.6M15.3 10l3.6-1.2M14 13.9l2.3 3.2M10 13.9l-2.3 3.2M8.7 10L5.1 8.8" stroke="#111" stroke-width="1.1"/>',
  og:'<circle cx="12" cy="12" r="8.5" fill="#fff" stroke="#e0644f" stroke-width="1.6"/><path d="M12 7.6l3.3 2.4-1.3 3.9h-4l-1.3-3.9z" fill="#e0644f"/>',
  yc:'<rect x="7" y="3.5" width="10" height="15" rx="1.6" fill="#f5c518" transform="rotate(8 12 12)"/>',
  rc:'<rect x="7" y="3.5" width="10" height="15" rx="1.6" fill="#e5322d" transform="rotate(8 12 12)"/>',
  yr:'<rect x="4.5" y="4" width="9" height="13.5" rx="1.5" fill="#f5c518" transform="rotate(-8 9 11)"/><rect x="10.5" y="5.5" width="9" height="13.5" rx="1.5" fill="#e5322d" transform="rotate(10 15 12)"/>',
  sub:'<path d="M7 4v11" stroke="#35c07d" stroke-width="2.4" stroke-linecap="round"/><path d="M3.5 11.5L7 15l3.5-3.5" fill="none" stroke="#35c07d" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 20V9" stroke="#e5534b" stroke-width="2.4" stroke-linecap="round"/><path d="M13.5 12.5L17 9l3.5 3.5" fill="none" stroke="#e5534b" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  inj:'<rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="#e5534b"/><path d="M12 7.5v9M7.5 12h9" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>',
  corner:'<path d="M6 21V3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M6 3.5l12 3.5-12 4z" fill="#f5a524"/><path d="M3 21a3 3 0 0 1 3-3" fill="none" stroke="currentColor" stroke-width="1.4"/>',
  throw:'<path d="M4 12h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M8 8l-4 4 4 4M16 8l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  gk:'<path d="M3 18V7h18v11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M3 11h18M3 14.5h18M8 7v11M12 7v11M16 7v11" stroke="currentColor" stroke-width=".8" opacity=".55"/>',
  fk:'<circle cx="7" cy="16" r="3.2" fill="#fff" stroke="currentColor" stroke-width="1.2"/><path d="M11 14c3-6 6-8 9-9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2.2 2" stroke-linecap="round"/>',
  shot:'<circle cx="6.5" cy="17.5" r="3" fill="#fff" stroke="currentColor" stroke-width="1.2"/><path d="M9.5 15L20 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M14.5 5H20v5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  on:'<circle cx="12" cy="12" r="8.5" fill="none" stroke="#35c07d" stroke-width="1.8"/><circle cx="12" cy="12" r="4.5" fill="none" stroke="#35c07d" stroke-width="1.8"/><circle cx="12" cy="12" r="1.6" fill="#35c07d"/>',
  off:'<circle cx="12" cy="12" r="8.5" fill="none" stroke="#e5534b" stroke-width="1.8"/><path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="#e5534b" stroke-width="2" stroke-linecap="round"/>',
  save:'<path d="M7 20v-7.5C7 9 5 8.5 5 6.5 5 5.5 5.8 5 6.5 5.4L9 7V4.2c0-1.4 2-1.4 2 0V7V3.4c0-1.4 2-1.4 2 0V7V4.2c0-1.4 2-1.4 2 0V8l.6-1.3c.6-1.2 2.4-.7 2.2.7L17 13.5V20z" fill="#5fb2e8"/>',
  block:'<rect x="9.5" y="3" width="5" height="18" rx="2.5" fill="currentColor" opacity=".85"/><path d="M3 12h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M5.5 9.5L3 12l2.5 2.5" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  offside:'<path d="M6 21V3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M6 3.5h12v8H6z" fill="#f5c518"/><path d="M6 3.5l6 4 6-4v8l-6-4-6 4" fill="#e5534b"/>',
  foul:'<path d="M4 9h7l3-3h4a2 2 0 0 1 2 2v2l-3 2v2a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="17.5" cy="8.5" r="1.1" fill="currentColor"/>',
  hand:'<path d="M8 21v-6.5L5.7 11c-.8-1.2.8-2.4 1.8-1.4L9 11.3V4.8c0-1.3 1.9-1.3 1.9 0v5.4V3.6c0-1.3 1.9-1.3 1.9 0v6.6V4.6c0-1.3 1.9-1.3 1.9 0v6.2V6.3c0-1.3 1.8-1.3 1.8 0V15a6 6 0 0 1-6 6z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
  danger:'<path d="M12 3.5l9.5 16.5h-19z" fill="#f5a524"/><path d="M12 9.5v5" stroke="#111" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17.3" r="1.1" fill="#111"/>',
  tackle:'<path d="M3 17h7l4-6 3 1 4 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="17" cy="7" r="2.6" fill="#fff" stroke="currentColor" stroke-width="1.2"/>',
  intercept:'<path d="M3 16c4-8 14-8 18 0" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2.4 2.2"/><path d="M12 6v12" stroke="#5fb2e8" stroke-width="2.4" stroke-linecap="round"/>',
  clear:'<circle cx="6" cy="18" r="2.8" fill="#fff" stroke="currentColor" stroke-width="1.2"/><path d="M8.5 15.5C11 9 15 5 21 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M16 3.6l5 .4-1.6 4.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  pen:'<path d="M2 15h20" stroke="currentColor" stroke-width="1.2" opacity=".6"/><path d="M5 15V5h14v10" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="19.3" r="1.6" fill="currentColor"/>',
  penmiss:'<path d="M5 15V5h14v10" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M9 7.5l6 6M15 7.5l-6 6" stroke="#e5534b" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="19.3" r="1.6" fill="currentColor"/>',
  pensave:'<path d="M5 15V5h14v10" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M9.5 14v-3.4c0-1.6-1-1.8-1-2.8 0-.5.4-.8.8-.6l1 .8V6.6c0-.7 1-.7 1 0V8V6c0-.7 1-.7 1 0v2-1.4c0-.7 1-.7 1 0V9l.3-.6c.3-.6 1.2-.3 1.1.3l-.5 2.6V14z" fill="#5fb2e8"/><circle cx="12" cy="19.3" r="1.6" fill="currentColor"/>',
  var:'<rect x="2.5" y="4.5" width="19" height="12.5" rx="2" fill="none" stroke="#a78bfa" stroke-width="1.8"/><path d="M8 21h8M12 17v4" stroke="#a78bfa" stroke-width="1.8" stroke-linecap="round"/><text x="12" y="13.4" text-anchor="middle" font-size="6.2" font-weight="800" fill="#a78bfa" font-family="system-ui">VAR</text>',
  vard:'<rect x="2.5" y="4.5" width="19" height="12.5" rx="2" fill="#a78bfa"/><path d="M8.2 10.8l2.5 2.5 5-5" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 21h8M12 17v4" stroke="#a78bfa" stroke-width="1.8" stroke-linecap="round"/>',
  med:'<circle cx="12" cy="12" r="9" fill="none" stroke="#e5534b" stroke-width="1.8"/><path d="M12 7.5v9M7.5 12h9" stroke="#e5534b" stroke-width="2.4" stroke-linecap="round"/>',
  water:'<path d="M12 3.5c3.5 4.6 6 7.8 6 10.8a6 6 0 0 1-12 0c0-3 2.5-6.2 6-10.8z" fill="#5fb2e8"/>',
  added:'<circle cx="12" cy="13" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 8.5V13l3 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M9.5 2.5h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M18.5 4.5v4M16.5 6.5h4" stroke="#35c07d" stroke-width="1.8" stroke-linecap="round"/>',
  custom:'<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="7.8" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="16.2" cy="12" r="1.3" fill="currentColor"/>',
  play:'<path d="M8 5l11 7-11 7z" fill="currentColor"/>',
  pause:'<rect x="6.5" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="13.5" y="5" width="4" height="14" rx="1" fill="currentColor"/>',
  resume:'<path d="M20 12a8 8 0 1 1-2.4-5.7" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M20.5 3.8V8h-4.2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 9l5 3-5 3z" fill="currentColor"/>',
  ht:'<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor"/>',
  ft:'<path d="M5 21V3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M5 4h14v9H5z" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M5 4h3.5v3H5zM12 4h3.5v3H12zM8.5 7H12v3H8.5zM15.5 7H19v3h-3.5zM5 10h3.5v3H5zM12 10h3.5v3H12z" fill="currentColor"/>',
  undo:'<path d="M9 7L4 12l5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.5 12H14a6 6 0 0 1 0 12h-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" transform="translate(0 -5)"/>',
  edit:'<path d="M4 20h4L19 9l-4-4L4 16z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M13.5 6.5l4 4" stroke="currentColor" stroke-width="1.8"/>',
  del:'<path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  pin:'<path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="10" r="2.3" fill="currentColor"/>',
  close:'<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
};
const ico = (k, cls) => `<svg class="lv-ic${cls?" "+cls:""}" viewBox="0 0 24 24" aria-hidden="true">${IC[k]||IC.custom}</svg>`;
LV.ico = ico;

/* ───────────── الساعة ─────────────
   phase: pre · h1 · ht · h2 · et · e1 · e2 · ft
   base: الثواني المنقضية من زمن المباراة عند المرساة · anchor: طابع الخادم عند آخر تشغيل */
const PH = {pre:"لم تبدأ", h1:"الشوط الأول", ht:"استراحة", h2:"الشوط الثاني", et:"قبل الإضافي", e1:"الإضافي الأول", e2:"الإضافي الثاني", ft:"انتهت"};
const PH_START = {h1:0, h2:2700, e1:5400, e2:6300};
const PH_END   = {h1:2700, h2:5400, e1:6300, e2:7200};
LV.PH = PH;
const isLivePh = p => p==="h1"||p==="h2"||p==="e1"||p==="e2";
LV.isLivePh = isLivePh;
function elapsed(clock, at){
  if(!clock) return 0;
  const a = tsMs(clock.anchor);
  let t = +clock.base || 0;
  if(clock.running && a!=null) t += Math.max(0, ((at==null?LV.now():at) - a)/1000);
  return t;
}
LV.elapsed = elapsed;
const pad = n => String(Math.floor(n)).padStart(2,"0");
function clockLabel(clock){
  const t = elapsed(clock), ph = clock && clock.phase;
  if(ph==="pre") return "00:00";
  const end = PH_END[ph];
  if(end!=null && t > end){ const x = t-end; return `${end/60}:00 +${pad(x/60)}:${pad(x%60)}`; }
  return `${pad(t/60)}:${pad(t%60)}`;
}
LV.clockLabel = clockLabel;
/* الوقت الفعلي للشوط الحالي، والمهدر = زمن الشوط − الفعلي، والإجمالي عبر الأشواط */
function effInfo(clock, at){
  const c = clock||{}, E = c.eff||{}, now = at==null ? LV.now() : at;
  const cur = (+E.base||0) + (E.run && tsMs(E.anchor)!=null ? Math.max(0,(now - tsMs(E.anchor))/1000) : 0);
  const ph = c.phase, st = PH_START[ph];
  const phEl = (isLivePh(ph) && st!=null) ? Math.max(0, elapsed(c, now) - st) : 0;
  const done = E.done||{}; const doneEff = Object.values(done).reduce((a,b)=>a+(+b||0),0);
  return {run:!!E.run, cur: isLivePh(ph) ? cur : 0, phEl, waste: isLivePh(ph) ? Math.max(0, phEl - cur) : 0, total: doneEff + (isLivePh(ph)?cur:0), done, has: !!c.eff};
}
LV.effInfo = effInfo;
LV.fmtS = t => `${pad(t/60)}:${pad(t%60)}`;
/* دقيقة الحدث بصيغة الكرة: 32' أو 45+2' — من الثواني ومرحلة المباراة */
function minuteOf(t, ph){
  const end = PH_END[ph], start = PH_START[ph];
  if(end!=null && t > end) return {m:end/60, x:Math.max(1, Math.ceil((t-end)/60))};
  let m = Math.floor(t/60)+1;
  if(start!=null) m = Math.max(start/60+1, m);
  if(end!=null) m = Math.min(end/60, m);
  return {m, x:0};
}
LV.minuteOf = minuteOf;
const minLabel = e => { const {m,x}=minuteOf(+e.t||0, e.ph); return x ? `${m}+${x}'` : `${m}'`; };
const secLabel = e => { const t=+e.t||0; return `${pad(t/60)}:${pad(t%60)}`; };
LV.minLabel = minLabel;

/* ───────────── اشتقاق الحالة من الأحداث ───────────── */
function activeEvents(doc){ return ((doc&&doc.events)||[]).filter(e=>e && e.status!=="deleted"); }
function sortEvents(list){ return list.slice().sort((a,b)=>(+a.t||0)-(+b.t||0) || (a.seq||0)-(b.seq||0)); }
function score(doc){
  let h=0,a=0;
  activeEvents(doc).forEach(e=>{
    if(e.k==="goal"){ if(e.team==="h") h++; else if(e.team==="a") a++; }
    if(e.k==="og"){ if(e.team==="h") h++; else if(e.team==="a") a++; }   /* team = المستفيد */
  });
  return {h,a};
}
LV.score = score;
/* الإحصاءات: عدّ الأحداث المُدخلة فقط — ولا يُعرض سطر لا بيانات له */
const STAT_ROWS = [
  ["الأهداف",          e=>e.k==="goal"||e.k==="og"],
  ["التسديدات",        e=>["shot","shoton","shotoff","goal","penmiss","pensave"].includes(e.k)],
  ["على المرمى",       e=>["shoton","goal","pensave"].includes(e.k)],
  ["خارج المرمى",      e=>e.k==="shotoff"||e.k==="penmiss"],
  ["التصديات",         e=>e.k==="save"||e.k==="pensave", "save"],
  ["الركنيات",         e=>e.k==="corner"],
  ["الأخطاء",          e=>e.k==="foul"||e.k==="handball"||e.k==="danger"],
  ["التسلل",           e=>e.k==="offside"],
  ["الإنذارات",        e=>e.k==="yellow"||e.k==="yr"],
  ["الطرد",            e=>e.k==="red"||e.k==="yr"],
  ["التبديلات",        e=>e.k==="sub"],
  ["ركلات الجزاء",     e=>e.k==="pen"],
  ["ركلات حرة",        e=>e.k==="fk"],
  ["رميات التماس",     e=>e.k==="throw"],
  ["ركلات المرمى",     e=>e.k==="gk"],
  ["الافتكاك",         e=>e.k==="tackle"],
  ["قطع الكرات",       e=>e.k==="intercept"],
  ["التشتيت",          e=>e.k==="clear"],
  ["الإصابات",         e=>e.k==="injury"]
];
function stats(doc){
  const ev = activeEvents(doc);
  /* التصدّي يُسجَّل لفريق الحارس؛ الباقي لفريق الحدث */
  const out = STAT_ROWS.map(([t,f])=>{
    const L = ev.filter(f); if(!L.length) return null;
    let h=0,a=0; L.forEach(e=>{
      let side = e.team;
      if(e.k==="pensave") side = e.team==="h" ? "a" : e.team==="a" ? "h" : "";   /* تصدّي حارس الخصم */
      if(side==="h") h++; else if(side==="a") a++;
    });
    if(!h && !a) return null;
    return {t,h,a};
  }).filter(Boolean);
  const v = ev.filter(e=>e.k==="var").length; if(v) out.push({t:"مراجعات VAR", h:null, a:null, total:v});
  return out;
}
LV.stats = stats;

/* ───────────── التخزين ───────────── */
const store = {
  _bc: null, _subs: {},
  bc(){ if(!this._bc && "BroadcastChannel" in window){ this._bc=new BroadcastChannel("mflive"); this._bc.onmessage=m=>{ const id=m.data&&m.data.id; (this._subs[id]||[]).forEach(f=>f(this._read(id), {fresh:true})); }; } return this._bc; },
  _read(id){ try{ const s=localStorage.getItem("mflive:"+id); return s?JSON.parse(s):null; }catch(e){ return null; } },
  _write(id, d){ try{ localStorage.setItem("mflive:"+id, JSON.stringify(d)); }catch(e){}
    (this._subs[id]||[]).forEach(f=>f(clone(d), {fresh:true})); const b=this.bc(); if(b) b.postMessage({id}); },
  ref(id){ return fbDb.collection("seasons").doc(id); },
  ready(){ return TEST || (typeof fbDb!=="undefined" && fbDb); },
  watch(id, cb){
    if(TEST){ this.bc(); (this._subs[id] ||= []).push(cb); setTimeout(()=>cb(this._read(id), {fresh:true}),0);
      return ()=>{ this._subs[id]=(this._subs[id]||[]).filter(f=>f!==cb); }; }
    if(!this.ready()) return ()=>{};
    let lastUpd = null;
    (this._loc[id] ||= []).push(cb);
    const un = this.ref(id).onSnapshot({includeMetadataChanges:false}, snap=>{
      if(!snap.exists){ this.cache[id]=null; cb(null, {}); return; }
      const d = snap.data({serverTimestamps:"estimate"});
      if(this._inflight[id] > 0) return;   /* كتابة محلية جارية: لا نرجع العرض لنسخة أقدم */
      this.cache[id]=d;
      const u = tsMs(d.updatedAt);
      if(!snap.metadata.hasPendingWrites && !snap.metadata.fromCache && u!==lastUpd){ lastUpd=u; noteServerTs(u); }
      cb(d, {pending:snap.metadata.hasPendingWrites});
    }, err=>{ cb(undefined, {error:err}); });
    return ()=>{ un(); this._loc[id]=(this._loc[id]||[]).filter(f=>f!==cb); };
  },
  cache:{}, _loc:{}, _inflight:{}, _q:{}, onError:null,
  /* تعديل آمن: قراءة ← تعديل ← كتابة داخل معاملة، فلا يمحو مشغّلان عمل بعضهما */
  async tx(id, fn){
    if(TEST){
      const cur = this._read(id); const n = fn(clone(cur)); if(!n) return cur;
      n.updatedAt = Date.now(); this._write(id, n); return n;
    }
    const ref = this.ref(id);
    /* كتابة متفائلة (سرعة): نطبّق التعديل على النسخة المحلية ونعرضه فوراً، والمعاملة تكمل في الخلفية
       وتعيد تطبيق fn على أحدث نسخة في الخادم فلا يضيع عمل مشغّل آخر */
    let local = null;
    if(this.cache[id]){ LOCAL = true; try{ local = fn(clone(this.cache[id])); }catch(e){ local = null; } LOCAL = false;
      if(local){ local.updatedAt = LV.now(); this.cache[id] = local; (this._loc[id]||[]).forEach(f=>{ try{ f(clone(local), {local:true, fresh:true}); }catch(e){} }); } }
    this._inflight[id] = (this._inflight[id]||0) + 1;
    /* طابور لكل مباراة: المعاملات تتتابع فلا تتصادم ولا تُعاد (أسرع وأضمن من التزامن) */
    const prev = this._q[id] || Promise.resolve();
    const p = prev.catch(()=>{}).then(()=>fbDb.runTransaction(async t=>{
      const s = await t.get(ref); const cur = s.exists ? s.data() : null;
      const n = fn(clone(cur)); if(!n) return cur;
      n.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
      n.updatedBy = (typeof FBUSER!=="undefined" && FBUSER && FBUSER.email) || "";
      t.set(ref, n); return n;
    })).finally(()=>{ this._inflight[id]--; if(!this._inflight[id]) ref.get().then(x=>{ if(x.exists && !this._inflight[id]){ const d=x.data({serverTimestamps:"estimate"}); this.cache[id]=d; (this._loc[id]||[]).forEach(f=>f(d,{})); } }).catch(()=>{}); });
    this._q[id] = p;
    if(local){ p.catch(e=>{ if(this.onError) this.onError(e); }); return local; }
    return p;
  },
  /* فهرس المباريات الجارية (للشريط في الرئيسية وتبويب «مباشر») */
  idxWatch(cb){
    if(TEST){ this.bc(); (this._subs.__idx ||= []).push(cb); setTimeout(()=>cb(this._read("__idx")||{}),0); return; }
    if(!this.ready()) return;
    this.ref("liveidx").onSnapshot(s=>cb(s.exists ? s.data() : {}), ()=>{});
  },
  async idxSet(id, summary){
    if(TEST){ const cur=this._read("__idx")||{m:{}}; cur.m=cur.m||{}; if(summary) cur.m[id]=summary; else delete cur.m[id];
      try{ localStorage.setItem("mflive:__idx", JSON.stringify(cur)); }catch(e){}
      (this._subs.__idx||[]).forEach(f=>f(clone(cur))); const b=this.bc(); if(b) b.postMessage({id:"__idx"}); return; }
    const upd = {}; upd["m."+id] = summary ? summary : firebase.firestore.FieldValue.delete();
    try{ await this.ref("liveidx").update(upd); }
    catch(e){ if(summary) await this.ref("liveidx").set({m:{[id]:summary}}, {merge:true}); }
  }
};
LV.store = store;
if(TEST){ /* قناة الفهرس في وضع الاختبار */
  const b = store.bc(); if(b) b.addEventListener("message", m=>{ if(m.data&&m.data.id==="__idx") (store._subs.__idx||[]).forEach(f=>f(store._read("__idx")||{})); });
}

/* ───────────── مطابقة المباراة وقوائم اللاعبين ───────────── */
const keyOf = m => (typeof matchKey==="function") ? matchKey(m) : [m.comp||"الدوري", m.round, m.home, m.away].map(encodeURIComponent).join("/");
LV.keyOf = keyOf;
const findMatch = k => ((typeof matchByKey==="function") ? matchByKey(k) : null) || (LV.findHook ? LV.findHook(k) : null);
LV.findMatch = findMatch;
function squadList(club){
  if(LV.squadHook){ const h = LV.squadHook(club); if(h) return h; }
  const L = (typeof SQUADS==="object" && SQUADS && SQUADS[club]) || [];
  return L.map(x=>({n: typeof x==="string" ? x : (x&&x.n)||"", s: typeof x==="string" ? 0 : (+(x&&x.s)||0), p: typeof x==="string" ? "" : (x&&x.p)||""})).filter(x=>x.n);
}
function lineupOf(doc, club){
  if(!doc) return [];
  if(doc.gulf && LV.gulfCtx) return LV.gulfCtx(()=>{ try{ return xiNames(doc.round, doc.comp, club) || []; }catch(e){ return []; } });
  try{ if(typeof xiNames==="function") return xiNames(doc.round, doc.comp, club) || []; }catch(e){}
  return [];
}
/* اللاعبون على أرض الملعب الآن = التشكيلة − الخارجون + الداخلون (من أحداث التبديل) */
function onPitch(doc, side){
  const club = side==="h" ? doc.home : doc.away;
  const xi = new Set(lineupOf(doc, club));
  if(!xi.size) return null;   /* بلا تشكيلة محفوظة: القائمة كاملة (roster يستبعد من خرج بالتبديل) */
  sortEvents(activeEvents(doc)).forEach(e=>{ if(e.k==="sub" && e.team===side){ if(e.p) xi.delete(e.p); if(e.p2) xi.add(e.p2); }
    if((e.k==="red"||e.k==="yr") && e.team===side && e.p) xi.delete(e.p); });
  return xi;
}
LV.onPitch = onPitch;
/* من خرج بالتبديل أو بالطرد (لا يعود)، ومن دخل بديلاً */
LV.subbed = (doc, side) => { const out=new Set(), inn=new Set(); activeEvents(doc).forEach(e=>{ if(e.team!==side) return; if(e.k==='sub'){ if(e.p) out.add(e.p); if(e.p2) inn.add(e.p2); } if((e.k==='red'||e.k==='yr') && e.p) out.add(e.p); }); return {out, inn}; };

/* ───────────── إنشاء وثيقة المباراة ───────────── */
function newDoc(m){
  return {v:1, ...(m.__gulf?{gulf:1}:{}), key:keyOf(m), comp:(typeof compOf==="function"?compOf(m):(m.comp||"الدوري")), round:m.round, home:m.home, away:m.away,
          date:m.date||"", time:m.time||"", venue:m.venue||"",
          clock:{phase:"pre", running:false, base:0, anchor:null, added:{}},
          dir:"h", poss:null, events:[], seq:0, ops:[], createdAt:Date.now()};
}
LV.newDoc = newDoc;
function idxSummary(d){
  const s = score(d);
  return {key:d.key, home:d.home, away:d.away, comp:d.comp, round:d.round, phase:d.clock.phase, running:!!d.clock.running,
          base:+d.clock.base||0, anchor:(tsMs(d.clock.anchor) ?? (d.clock.running ? LV.now() : null)), hg:s.h, ag:s.a, upd:Date.now()};
}
LV.idxSummary = idxSummary;
const pushOp = (d, op) => { d.ops = (d.ops||[]); d.ops.push(op); if(d.ops.length>40) d.ops.splice(0, d.ops.length-40); };

/* أوامر الحالة — كلها تمر عبر store.tx فتبقى آمنة ومتسلسلة */
let LOCAL = false;   /* أثناء التطبيق المحلي المتفائل: وقت الجهاز بدل طابع الخادم */
const SERVER_NOW = () => (TEST || LOCAL) ? LV.now() : firebase.firestore.FieldValue.serverTimestamp();
LV.cmd = {
  async ensure(m){ const id=LV.idOf(keyOf(m)); return store.tx(id, cur=>cur ? null : newDoc(m)); },
  addEvent(id, ev){ const eid = uid(), at = Date.now(); return store.tx(id, d=>{ if(!d) return null;
      if(d.events.some(x=>x.id===eid)) return null;
      d.seq=(d.seq||0)+1; const e=Object.assign({id:eid, seq:d.seq, status:"ok", at}, ev);
      d.events.push(e); pushOp(d, {op:"add", id:e.id}); return d; }); },
  editEvent(id, evId, patch){ return store.tx(id, d=>{ if(!d) return null;
      const e=d.events.find(x=>x.id===evId); if(!e) return null;
      pushOp(d, {op:"edit", ev:clone(e)}); Object.assign(e, patch, {edited:Date.now()}); return d; }); },
  delEvent(id, evId){ return store.tx(id, d=>{ if(!d) return null;
      const i=d.events.findIndex(x=>x.id===evId); if(i<0) return null;
      pushOp(d, {op:"del", ev:clone(d.events[i]), i}); d.events.splice(i,1); return d; }); },
  undo(id){ return store.tx(id, d=>{ if(!d || !(d.ops||[]).length) return null;
      const op=d.ops.pop();
      if(op.op==="add"){ d.events=d.events.filter(e=>e.id!==op.id); }
      else if(op.op==="del"){ d.events.splice(Math.min(op.i??d.events.length, d.events.length), 0, op.ev); }
      else if(op.op==="edit"){ const i=d.events.findIndex(e=>e.id===op.ev.id); if(i>=0) d.events[i]=op.ev; else d.events.push(op.ev); }
      else if(op.op==="clock"){ d.clock=op.clock; if(op.addId) d.events=d.events.filter(e=>e.id!==op.addId); }
      return d; }); },
  /* انتقالات الساعة: كل انتقال يُسجَّل أيضاً حدثاً في الخط الزمني */
  clock(id, action, arg){ const sid = uid(), now0 = LV.now(); return store.tx(id, d=>{ if(!d) return null;
      const c=d.clock, before=clone(c), now=now0, t=elapsed(c, now);
      let sys=null;
      /* الوقت الفعلي (الكرة في اللعب): يتوقف مع أحداث التوقف ويُستأنف بزر، والساعة الأصلية تستمر */
      const E = c.eff = c.eff || {run:false, base:0, anchor:null, done:{}};
      E.done = E.done || {};
      const effNow = () => (+E.base||0) + (E.run && tsMs(E.anchor)!=null ? Math.max(0,(now - tsMs(E.anchor))/1000) : 0);
      const effStop = () => { E.base = effNow(); E.run = false; E.anchor = null; };
      const effGo = () => { E.run = true; E.anchor = SERVER_NOW(); };
      const effNew = ph0 => { if(ph0) E.done[ph0] = effNow(); E.base = 0; E.run = false; E.anchor = null; };
      const run = base => { c.base=base; c.anchor=SERVER_NOW(); c.running=true; };
      const stop = () => { c.base=elapsed(c, now); c.anchor=null; c.running=false; };
      if(action==="effstop" || action==="effgo"){
        if(!c.running || !isLivePh(c.phase)) return null;
        if(action==="effstop"){ if(!E.run) return null; effStop(); }
        else { if(E.run) return null; effGo(); }
        return d;                                      /* بلا حدث وبلا خطوة تراجع: تبديل متكرر */
      }
      switch(action){
        case "kickoff": if(c.phase!=="pre") return null; c.phase="h1"; run(0); E.done={}; E.base=0; effGo(); sys={k:"kickoff", t:0, ph:"h1"}; break;
        case "ht":      if(c.phase!=="h1") return null; stop(); effNew("h1"); sys={k:"ht", t:c.base, ph:"h1"}; c.phase="ht"; break;
        case "h2":      if(c.phase!=="ht") return null; c.phase="h2"; run(2700); E.base=0; effGo(); sys={k:"h2", t:2700, ph:"h2"}; break;
        case "et":      if(c.phase!=="h2") return null; stop(); effNew("h2"); sys={k:"ht", t:c.base, ph:"h2", note:"نهاية الوقت الأصلي"}; c.phase="et"; break;
        case "e1":      if(c.phase!=="et") return null; c.phase="e1"; run(5400); E.base=0; effGo(); sys={k:"e1", t:5400, ph:"e1"}; break;
        case "e2":      if(c.phase!=="e1") return null; stop(); effNew("e1"); c.phase="e2"; run(6300); effGo(); sys={k:"e2", t:6300, ph:"e2"}; break;
        case "ft":      if(c.phase==="ft"||c.phase==="pre") return null; const ph0=c.phase; stop(); if(isLivePh(ph0)) effNew(ph0); sys={k:"ft", t:c.base, ph:ph0==="ht"?"h1":ph0==="et"?"h2":ph0}; c.phase="ft"; break;
        case "pause":   if(!c.running) return null; stop(); effStop(); sys={k:"pause", t:c.base, ph:c.phase}; break;
        case "resume":  if(c.running || !isLivePh(c.phase)) return null; run(c.base); effGo(); sys={k:"resume", t:c.base, ph:c.phase}; break;
        case "set":     { const v=Math.max(0, +arg||0); c.base=v; if(c.running) c.anchor=SERVER_NOW(); break; }
        case "added":   { const ph=isLivePh(c.phase)?c.phase:(c.phase==="ht"?"h1":c.phase==="et"?"h2":null); if(!ph) return null;
                          c.added=c.added||{}; c.added[ph]=Math.max(0, +arg||0); sys={k:"added", t:Math.min(t, PH_END[ph]||t), ph, n:c.added[ph]}; break; }
        default: return null;
      }
      let addId=null;
      if(sys){ if(d.events.some(x=>x.id===sid)) return d; d.seq=(d.seq||0)+1; const e=Object.assign({id:sid, seq:d.seq, status:"ok", at:now0, team:""}, sys); addId=e.id; d.events.push(e); }
      pushOp(d, {op:"clock", clock:before, addId});
      return d; }); },
  setDir(id, dir){ return store.tx(id, d=>{ if(!d) return null; d.dir = dir==="a" ? "a" : "h"; return d; }); },
  setPoss(id, h){ return store.tx(id, d=>{ if(!d) return null; d.poss = (h==null||h==="") ? null : {h:Math.max(0,Math.min(100,+h||0))}; return d; }); },
  async remove(id){ if(TEST){ try{ localStorage.removeItem("mflive:"+id); }catch(e){} store._write(id, null); } else { await store.ref(id).delete(); } await store.idxSet(id, null); }
};

/* ───────────── الملعب التفاعلي (SVG بالأمتار: 105×68) ───────────── */
const PW=105, PL=68, MARGIN=7;
function pitchSVG(cls){
  const stripes = Array.from({length:12},(_,i)=>`<rect x="${i*PW/12}" y="0" width="${PW/12}" height="${PL}" fill="${i%2?"#2f7a3d":"#34843f"}"/>`).join("");
  const L = 'fill="none" stroke="rgba(255,255,255,.85)" stroke-width=".32"';
  const box = side => { const x0 = side ? PW : 0, s = side ? -1 : 1;
    return `<rect x="${side?PW-16.5:0}" y="${34-20.16}" width="16.5" height="40.32" ${L}/>
            <rect x="${side?PW-5.5:0}" y="${34-9.16}" width="5.5" height="18.32" ${L}/>
            <circle cx="${x0+s*11}" cy="34" r=".35" fill="rgba(255,255,255,.9)"/>
            <path d="M${x0+s*16.5} ${34-7.3} A9.15 9.15 0 0 ${side?0:1} ${x0+s*16.5} ${34+7.3}" ${L}/>
            <rect x="${side?PW:-2.2}" y="${34-3.66}" width="2.2" height="7.32" fill="rgba(255,255,255,.12)" stroke="rgba(255,255,255,.9)" stroke-width=".3"/>`; };
  return `<svg class="lv-pitch ${cls||""}" viewBox="${-MARGIN} ${-MARGIN} ${PW+2*MARGIN} ${PL+2*MARGIN}" preserveAspectRatio="xMidYMid meet">
    <defs><radialGradient id="lvVig" cx="50%" cy="50%" r="70%"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></radialGradient></defs>
    <rect class="lv-out" x="${-MARGIN}" y="${-MARGIN}" width="${PW+2*MARGIN}" height="${PL+2*MARGIN}" fill="#23592c"/>
    <g class="lv-grass">${stripes}</g>
    <rect x="0" y="0" width="${PW}" height="${PL}" fill="url(#lvVig)"/>
    <rect x="0" y="0" width="${PW}" height="${PL}" ${L}/>
    <line x1="${PW/2}" y1="0" x2="${PW/2}" y2="${PL}" stroke="rgba(255,255,255,.85)" stroke-width=".32"/>
    <circle cx="${PW/2}" cy="34" r="9.15" ${L}/><circle cx="${PW/2}" cy="34" r=".4" fill="rgba(255,255,255,.9)"/>
    ${box(0)}${box(1)}
    <path d="M1 0 A1 1 0 0 1 0 1" ${L}/><path d="M${PW-1} 0 A1 1 0 0 0 ${PW} 1" ${L}/>
    <path d="M0 ${PL-1} A1 1 0 0 1 1 ${PL}" ${L}/><path d="M${PW} ${PL-1} A1 1 0 0 0 ${PW-1} ${PL}" ${L}/>
    <g class="lv-dirs"></g>
    <g class="lv-marks"></g>
    <g class="lv-ghost"></g>
  </svg>`;
}
LV.pitchSVG = pitchSVG;
/* تحويل نقرة الشاشة إلى إحداثيات بالأمتار ثم إلى نسبة 0–100 (قد تتجاوز الحدود خارج الخط) */
function svgPoint(svg, ev){
  const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
  const p = pt.matrixTransform(svg.getScreenCTM().inverse());
  return {mx:p.x, my:p.y};
}
const toNorm = (mx,my) => ({x:+(mx/PW*100).toFixed(2), y:+(my/PL*100).toFixed(2)});
const toM = (x,y) => ({mx:x/100*PW, my:y/100*PL});
/* مناطق الملعب المكانية */
function zoneOf(mx, my){
  const L = mx < PW/2 ? "left" : "right", ex = L==="left" ? mx : PW-mx, cy = Math.abs(my-34);
  const sideAr = L==="left" ? "اليسرى" : "اليمنى";
  const nearCorner = (mx<=3||mx>=PW-3) && (my<=3||my>=PL-3);
  if(my < 0 || my > PL){
    if(mx < 0 || mx > PW) return {z:"corner", end:L, ar:"الزاوية "+(L==="left"?"اليسرى":"اليمنى")};
    return {z:"touch", end:L, side: my<0 ? "top" : "bottom", ar:"خط التماس "+(my<0?"العلوي":"السفلي")};
  }
  if(mx < 0 || mx > PW){
    if(my<=3||my>=PL-3) return {z:"corner", end:L, ar:"منطقة الركنية "+sideAr};
    if(cy <= 3.66) return {z:"goalmouth", end:L, ar:"المرمى "+(L==="left"?"الأيسر":"الأيمن")};
    return {z:"goalline", end:L, ar:"خط المرمى "+(L==="left"?"الأيسر":"الأيمن")};
  }
  if(nearCorner) return {z:"corner", end:L, ar:"منطقة الركنية "+sideAr};
  if(ex <= 5.5 && cy <= 9.16) return {z:"six", end:L, ar:"منطقة المرمى "+sideAr};
  if(Math.hypot(ex-11, my-34) <= 1.6) return {z:"spot", end:L, ar:"علامة الجزاء "+sideAr};
  if(ex <= 16.5 && cy <= 20.16) return {z:"box", end:L, ar:"منطقة الجزاء "+sideAr};
  if(Math.hypot(mx-PW/2, my-34) <= 9.15) return {z:"center", end:L, ar:"دائرة المنتصف"};
  if(my <= 4 || my >= PL-4) return {z:"wing", end:L, ar:"الرواق "+(my<=4?"العلوي":"السفلي")};
  const third = ex < 35 ? "الثلث الأخير — الجهة "+sideAr : "وسط الملعب";
  return {z:"field", end:L, ar:third};
}
LV.zoneOf = zoneOf;
/* ما الأحداث المناسبة لكل منطقة (عند النقر بلا أداة مختارة) */
const ZONE_TOOLS = {
  touch:["throw"], corner:["corner"], goalline:["gk","corner","shotoff"], goalmouth:["goal","shoton","shotoff","save"],
  six:["save","goal","shoton","gk","foul"], spot:["pen","penmiss","pensave","goal"], box:["shot","shoton","shotoff","goal","save","foul","pen","block","clear"],
  center:["foul","tackle","intercept","fk","custom"], wing:["foul","fk","tackle","throw","offside"], field:["foul","fk","shot","tackle","intercept","offside","clear"]
};
LV.ZONE_TOOLS = ZONE_TOOLS;
/* الفريق الذي يهاجم كل مرمى: d.dir = من يهاجم نحو اليمين في الشوط الأول، وينقلب في الثاني */
function attackerOfEnd(doc, end, ph){
  const flip = ph==="h2"||ph==="e2";
  let rightAtt = doc.dir==="a" ? "a" : "h"; if(flip) rightAtt = rightAtt==="h" ? "a" : "h";
  return end==="right" ? rightAtt : (rightAtt==="h" ? "a" : "h");
}
LV.attackerOfEnd = attackerOfEnd;
/* تخمين الفريق من نوع الحدث ومكانه (يمكن تغييره بنقرة) */
function guessTeam(doc, k, zone, ph){
  if(!zone) return "";
  const att = attackerOfEnd(doc, zone.end, ph), def = att==="h" ? "a" : "h";
  if(["corner","goal","shot","shoton","shotoff","offside","pen","penmiss","pensave"].includes(k)) return att;
  if(["gk","save","clear","block"].includes(k)) return def;
  if(k==="og") return att;
  return "";
}

/* علامات الأحداث على الملعب */
const MARK_COLORS = {h:"#2eb0f0", a:"#f5a524", "":"#cbd5e1"};
function markersSVG(doc, opts){
  opts = opts || {};
  const ev = sortEvents(activeEvents(doc)).filter(e=>e.x!=null && e.y!=null && (!opts.filter || opts.filter(e)));
  const lastId = opts.flash;
  return ev.map(e=>{ const {mx,my}=toM(e.x,e.y); const col=MARK_COLORS[e.team||""];
    const big = ["goal","og","pen","penmiss","pensave","red","yr"].includes(e.k);
    const r = big ? 2.3 : 1.75;
    return `<g class="lv-mk${e.id===lastId?" new":""}${opts.sel===e.id?" sel":""}" data-ev="${H(e.id)}" transform="translate(${mx.toFixed(2)} ${my.toFixed(2)})" tabindex="0" role="button" aria-label="${H(EVK[e.k]?EVK[e.k].t:e.k)} ${H(minLabel(e))}">
      <circle r="${r+.55}" fill="rgba(0,0,0,.45)"/><circle r="${r}" fill="#0b1422" stroke="${col}" stroke-width=".5"/>
      <svg x="${-r*.72}" y="${-r*.72}" width="${r*1.44}" height="${r*1.44}" viewBox="0 0 24 24" style="color:#e6eef8">${IC[(EVK[e.k]||{}).ic]||IC.custom}</svg>
    </g>`; }).join("");
}
LV.markersSVG = markersSVG;
function dirsSVG(doc, ph){
  /* اسم من يدافع عن كل مرمى فوق الملعب، فيعرف المشغّل الاتجاه دون تفكير */
  const r = attackerOfEnd(doc, "right", ph||doc.clock.phase), l = r==="h" ? "a" : "h";
  const nm = s => s==="h" ? doc.home : doc.away;
  return `<text x="${PW*0.12}" y="${-2.4}" text-anchor="middle" class="lv-dirt">${H(nm(r))} يدافع</text>
          <text x="${PW*0.88}" y="${-2.4}" text-anchor="middle" class="lv-dirt">${H(nm(l))} يدافع</text>`;
}

/* ───────────── عرض الأحداث (مشترك بين اللوحة والجمهور) ───────────── */
function teamName(doc, s){ return s==="h" ? doc.home : s==="a" ? doc.away : ""; }
function evTitle(e){ return (EVK[e.k]||{t:e.k}).t + (e.k==="goal" && e.pen ? " (جزاء)" : ""); }
function evLines(doc, e){
  const d = EVK[e.k]||{}, out = [];
  if(e.k==="sub"){ if(e.p2) out.push(`<span class="lv-in">دخل: ${H(e.p2)}</span>`); if(e.p) out.push(`<span class="lv-outp">خرج: ${H(e.p)}</span>`); }
  else {
    if(e.p) out.push(`<b>${H(e.p)}</b>`);
    if(e.p2 && d.p2 && e.k!=="goal") out.push(`<span>${H(d.p2)}: ${H(e.p2)}</span>`);
  }
  if(e.k==="added" && e.n!=null) out.push(`<b>+${H(e.n)} دقائق</b>`);
  if(e.res) out.push(`<span>${H(e.res)}</span>`);
  if(e.k==="goal" && e.p2) out.push(`<span>صناعة: ${H(e.p2)}</span>`);
  if(e.k==="vard" && e.dec) out.push(`<b>${H(e.dec)}</b>`);
  if(e.reason) out.push(`<span>${H(e.reason)}</span>`);
  if(e.note) out.push(`<span class="lv-note">${H(e.note)}</span>`);
  return out;
}
LV.evLines = evLines;
function evRowHTML(doc, e, admin){
  const d = EVK[e.k]||{}, side = e.team||"", club = teamName(doc, side);
  const zone = e.zone ? `<span class="lv-zone">${ico("pin")}${H(e.zone)}</span>` : "";
  return `<div class="lv-ev ${d.sys?"sys":""} k-${H(e.k)} s-${side||"n"}" data-ev="${H(e.id)}" role="button" tabindex="0">
    <span class="lv-ev-t"><b dir="ltr">${H(minLabel(e))}</b><i dir="ltr">${H(secLabel(e))}</i></span>
    <span class="lv-ev-ic">${ico(d.ic)}</span>
    <span class="lv-ev-b"><span class="lv-ev-h">${H(evTitle(e))}${club?`<span class="lv-ev-club">${crestOf(club)}${H(club)}</span>`:""}</span>
      <span class="lv-ev-d">${evLines(doc,e).join(" · ")}${zone}</span></span>
    ${admin && !d.sys ? `<span class="lv-ev-act"><button type="button" data-lv-edit="${H(e.id)}" title="تعديل">${ico("edit")}</button><button type="button" data-lv-del="${H(e.id)}" title="حذف">${ico("del")}</button></span>`
      : admin && d.sys ? `<span class="lv-ev-act"><button type="button" data-lv-del="${H(e.id)}" title="حذف">${ico("del")}</button></span>` : ""}
  </div>`;
}
LV.evRowHTML = evRowHTML;
/* الخط الزمني الأفقي */
function hTimelineHTML(doc){
  const ev = sortEvents(activeEvents(doc)).filter(e=>(EVK[e.k]||{}).major && !["ht","ft"].includes(e.k) || e.k==="ht");
  const et = activeEvents(doc).some(e=>e.ph==="e1"||e.ph==="e2") || ["et","e1","e2"].includes(doc.clock.phase);
  const maxMin = et ? 120 : 90;
  const nowMin = isLivePh(doc.clock.phase) || doc.clock.phase==="ht" || doc.clock.phase==="ft" ? Math.min(maxMin, elapsed(doc.clock)/60) : 0;
  const pos = e => { const {m,x}=minuteOf(+e.t||0, e.ph); return Math.min(100, ((m - 1 + Math.min(x,4)*0.25 + (x?1:0.5)) / maxMin) * 100); };
  const ticks = (et?[0,15,30,45,60,75,90,105,120]:[0,15,30,45,60,75,90]).map(v=>`<span class="lv-tk" style="inset-inline-start:${v/maxMin*100}%"><i></i>${v}'</span>`).join("");
  const mk = ev.map(e=>{ const d=EVK[e.k]||{}; const side=e.team==="a"?"a":e.team==="h"?"h":"n";
    return `<button type="button" class="lv-tm s-${side}" data-ev="${H(e.id)}" style="inset-inline-start:${pos(e).toFixed(2)}%" title="${H(evTitle(e))} ${H(minLabel(e))}">${ico(d.ic)}</button>`; }).join("");
  return `<div class="lv-htl">
    <div class="lv-htl-lbl"><span class="h" title="${H(doc.home)}">${crestOf(doc.home)}</span><span class="a" title="${H(doc.away)}">${crestOf(doc.away)}</span></div>
    <div class="lv-htl-track"><div class="lv-htl-bar"><i style="width:${(nowMin/maxMin*100).toFixed(2)}%"></i><em style="inset-inline-start:${45/maxMin*100}%"></em>${et?`<em style="inset-inline-start:${90/maxMin*100}%"></em>`:""}</div>${mk}${ticks}</div>
  </div>`;
}
LV.hTimelineHTML = hTimelineHTML;
function statsHTML(doc){
  const S = stats(doc);
  const poss = doc.poss && doc.poss.h!=null ? {t:"الاستحواذ", h:doc.poss.h+"%", a:(100-doc.poss.h)+"%", ph:doc.poss.h, pa:100-doc.poss.h} : null;
  const rows = (poss?[poss]:[]).concat(S);
  if(!rows.length) return `<div class="lv-empty">لا إحصاءات بعد — تُحسب من الأحداث المُدخلة فقط.</div>`;
  return `<div class="lv-stats">${rows.map(r=>{
    if(r.total!=null) return `<div class="lv-st one"><span>${H(r.t)}</span><b>${r.total}</b></div>`;
    const h = r.ph!=null ? r.ph : r.h, a = r.pa!=null ? r.pa : r.a, sum = (+h||0)+(+a||0) || 1;
    return `<div class="lv-st"><b class="h">${r.h}</b><span>${H(r.t)}</span><b class="a">${r.a}</b>
      <div class="lv-st-bar"><i class="h" style="width:${((+h||0)/sum*100).toFixed(1)}%"></i><i class="a" style="width:${((+a||0)/sum*100).toFixed(1)}%"></i></div></div>`; }).join("")}</div>`;
}
LV.statsHTML = statsHTML;
function infoHTML(doc){
  const c = doc.clock, add = c.added||{};
  const cnt = k => activeEvents(doc).filter(e=>Array.isArray(k)?k.includes(e.k):e.k===k).length;
  const rows = [
    ["الحالة", PH[c.phase]||"—"],
    ["الوقت", isLivePh(c.phase)||c.phase==="ht"||c.phase==="ft" ? `<span dir="ltr">${clockLabel(c)}</span>` : "—"],
    ["الوقت الفعلي", c.eff ? (()=>{ const e=effInfo(c), d=e.done||{}; const parts=[d.h1!=null?`الشوط الأول ${LV.fmtS(d.h1)}`:"", d.h2!=null?`الشوط الثاني ${LV.fmtS(d.h2)}`:"", LV.isLivePh(c.phase)?`الحالي ${LV.fmtS(e.cur)} (المهدر ${LV.fmtS(e.waste)})`:""].filter(Boolean); return parts.join(" · ")||"—"; })() : "—"],
    ["بدل الضائع", [add.h1?`الشوط الأول +${add.h1}`:"", add.h2?`الشوط الثاني +${add.h2}`:"", add.e1?`الإضافي الأول +${add.e1}`:"", add.e2?`الإضافي الثاني +${add.e2}`:""].filter(Boolean).join(" · ") || "—"],
    ["الملعب", doc.venue ? H(doc.venue) : "—"],
    ["المسابقة", `${H(doc.comp||"")} · الجولة ${H(doc.round)}`]
  ];
  const c2 = [["الأهداف",cnt(["goal","og"])],["البطاقات",cnt(["yellow","red","yr"])],["التبديلات",cnt("sub")],["VAR",cnt(["var","vard"])],["الإصابات",cnt("injury")],["الركنيات",cnt("corner")],["التسلل",cnt("offside")]];
  return `<div class="lv-info">${rows.map(([k,v])=>`<div><span>${k}</span><b>${v}</b></div>`).join("")}</div>
    <div class="lv-chips">${c2.map(([k,v])=>`<span class="${v?"":"z"}"><b>${v||"—"}</b>${k}</span>`).join("")}</div>`;
}
LV.infoHTML = infoHTML;
/* نافذة تفاصيل الحدث */
function evModalHTML(doc, e){
  const d = EVK[e.k]||{}, club = teamName(doc, e.team);
  const rows = [["الوقت", `<span dir="ltr">${H(minLabel(e))} · ${H(secLabel(e))}</span>`], ["المرحلة", H(PH[e.ph]||"")]];
  if(club) rows.push(["الفريق", `${crestOf(club)} ${H(club)}`]);
  if(e.k==="sub"){ if(e.p) rows.push(["خرج", H(e.p)]); if(e.p2) rows.push(["دخل", H(e.p2)]); }
  else { if(e.p) rows.push([d.p||"اللاعب", H(e.p)]); if(e.p2) rows.push([d.p2||"", H(e.p2)]); }
  if(e.k==="goal") rows.push(["صناعة", e.p2 ? H(e.p2) : "بدون صناعة"]);
  if(e.k==="goal" && e.pen) rows.push(["النوع", "ركلة جزاء"]);
  if(e.det) rows.push(["تفصيل الهجمة", H(e.det)]);
  if(e.bp) rows.push(["طريقة التسجيل", H(e.bp)]);
  if(e.gz) rows.push(["منطقة التسجيل", H(e.gz)]);
  if(e.res) rows.push(["نتيجة الركلة", H(e.res)]);
  if(e.place) rows.push(["مكان التسديد", H(e.place)]);
  if(["yellow","yr","red"].includes(e.k)) rows.push(["نوع البطاقة", {yellow:"إنذار", yr:"إنذار ثانٍ (طرد)", red:"طرد مباشر"}[e.k]]);
  if(e.k==="added") rows.push(["الدقائق", "+"+H(e.n)]);
  if(e.dec) rows.push(["القرار", H(e.dec)]);
  if(e.reason) rows.push(["السبب", H(e.reason)]);
  if(e.zone) rows.push(["المكان", H(e.zone)]);
  if(e.note) rows.push(["ملاحظة", H(e.note)]);
  const loc = (e.x!=null && e.y!=null) ? `<div class="lv-mini">${pitchSVG("mini").replace('<g class="lv-marks"></g>', `<g class="lv-marks">${markersSVG({events:[e]}, {})}</g>`)}</div>` : "";
  return `<div class="lv-modal-card k-${H(e.k)} s-${e.team||"n"}" role="dialog" aria-modal="true">
    <button type="button" class="lv-x" data-lv-close aria-label="إغلاق">${ico("close")}</button>
    <div class="lv-mhd"><span class="lv-mic">${ico(d.ic)}</span><div><h3>${H(evTitle(e))}</h3><span dir="ltr">${H(minLabel(e))}</span></div></div>
    ${loc}
    <dl class="lv-dl">${rows.filter(r=>r[1]).map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>
  </div>`;
}
function openModal(doc, evId){
  const e = (doc.events||[]).find(x=>x.id===evId); if(!e) return;
  let m = document.getElementById("lvModal");
  if(!m){ m=document.createElement("div"); m.id="lvModal"; m.className="lv-modal"; document.body.appendChild(m);
    m.addEventListener("click", ev=>{ if(ev.target===m || ev.target.closest("[data-lv-close]")) closeModal(); }); }
  m.innerHTML = evModalHTML(doc, e); m.hidden=false; requestAnimationFrame(()=>m.classList.add("on"));
}
function closeModal(){ const m=document.getElementById("lvModal"); if(m){ m.classList.remove("on"); m.hidden=true; m.innerHTML=""; } }
document.addEventListener("keydown", e=>{ if(e.key==="Escape") closeModal(); });
LV.openModal = openModal;

/* تنبيه الحدث الكبير (هدف/بطاقة/تبديل/VAR) — مرة لكل حدث جديد */
function celebrate(host, doc, e){
  const kind = e.k==="goal"||e.k==="og" ? "goal" : (e.k==="red"||e.k==="yr") ? "red" : e.k==="yellow" ? "yellow" : e.k==="sub" ? "sub" : (e.k==="var"||e.k==="vard") ? "var" : null;
  if(!kind || !host) return;
  const club = teamName(doc, e.team);
  const el = document.createElement("div"); el.className = "lv-toast t-"+kind;
  el.innerHTML = `<span class="i">${ico((EVK[e.k]||{}).ic)}</span><span class="b"><b>${H(kind==="goal"?"هدف!":evTitle(e))}</b><i>${club?H(club)+" · ":""}${H(e.p || e.p2 || "")} <span dir="ltr">${H(minLabel(e))}</span></i></span>`;
  host.appendChild(el); setTimeout(()=>el.classList.add("out"), 3600); setTimeout(()=>el.remove(), 4200);
}
LV.celebrate = celebrate;

/* ساعة تعمل كل ثانية لكل من يعرض وثيقة جارية */
const tickers = new Set();
setInterval(()=>tickers.forEach(f=>{ try{ f(); }catch(e){} }), 500);
LV.tick = f => { tickers.add(f); return ()=>tickers.delete(f); };

LV.util = {H, clone, uid, tsMs, sortEvents, activeEvents, teamName, evTitle, secLabel, squadList, lineupOf, svgPoint, toNorm, toM, zoneOf, guessTeam, dirsSVG, crestOf, logoOf, TOOL_GROUPS, closeModal, PW, PL};
})();

/* =====================================================================
   صفحة الجمهور — تبويب «مباشر» داخل صفحة المباراة (قراءة فقط)
   ===================================================================== */
(function(){
const LV = window.LIVE, U = LV.util, H = U.H;
LV.idx = {};                                     /* فهرس المباريات التي لها وثيقة مباشرة */
const liveOf = m => m ? LV.idx[LV.idOf(LV.keyOf(m))] : null;
LV.liveOf = liveOf;
let PUB = null;                                  /* {id, m, doc, unsub, untick, seen, filter} */

function pubShell(m){
  return `<div class="lv-pub" id="lvPub">
    <div class="lv-pub-score" id="lvPubScore"></div>
    <div class="lv-toasts" id="lvPubToasts"></div>
    <section class="lv-card sec-pitch"><div class="lv-card-hd"><h3>الملعب المباشر</h3><div class="lv-seg" id="lvPubFilter">
      <button type="button" data-f="all" aria-pressed="true">الكل</button><button type="button" data-f="h" title="${H(m.home)}">${U.crestOf(m.home)}</button><button type="button" data-f="a" title="${H(m.away)}">${U.crestOf(m.away)}</button></div></div>
      <div class="lv-pitch-wrap lv-3d" id="lvPubPitch">${LV.stadiumHTML("pub")}</div><p class="lv-hint">اضغط أي علامة لعرض تفاصيل الحدث.</p></section>
    <section class="lv-card sec-htl"><div class="lv-card-hd"><h3>الخط الزمني</h3></div><div id="lvPubHtl"></div></section>
    <section class="lv-card sec-feed"><div class="lv-card-hd"><h3>أحداث المباراة</h3><span class="lv-sub" id="lvPubCount"></span></div><div class="lv-feed" id="lvPubFeed"></div><button type="button" class="lv-more" id="lvPubMore" hidden></button></section>
    <section class="lv-card sec-stats"><div class="lv-card-hd"><h3>الإحصاءات</h3><span class="lv-sub">من الأحداث المُدخلة فقط</span></div><div id="lvPubStats"></div></section>
    <section class="lv-card sec-info"><div class="lv-card-hd"><h3>معلومات المباراة</h3></div><div id="lvPubInfo"></div></section>
  </div>`;
}
function scoreHTML(doc){
  const s = LV.score(doc), c = doc.clock, live = LV.isLivePh(c.phase);
  const tm = side => { const n = side==="h"?doc.home:doc.away; return `<div class="lv-ps-team">${U.crestOf(n)}<b>${H(n)}</b></div>`; };
  const badge = live ? (c.running ? `<span class="lv-badge live"><i></i>مباشر</span>` : `<span class="lv-badge pause">متوقفة</span>`)
    : c.phase==="ht" ? `<span class="lv-badge ht">استراحة</span>` : c.phase==="ft" ? `<span class="lv-badge ft">انتهت</span>` : `<span class="lv-badge pre">لم تبدأ</span>`;
  return `${tm("h")}<div class="lv-ps-mid"><div class="lv-ps-res"><b data-s="h">${s.h}</b><i>-</i><b data-s="a">${s.a}</b></div>
    <div class="lv-ps-clock" dir="ltr" data-lv-clock>${live||c.phase==="ht"||c.phase==="ft" ? H(LV.clockLabel(c)) : "—"}</div>${badge}
    <span class="lv-ps-ph">${H(LV.PH[c.phase]||"")}${c.added && c.added[c.phase] ? ` · +${c.added[c.phase]}` : ""}</span>
    ${c.eff && (live||c.phase==="ht"||c.phase==="ft") ? `<span class="lv-ps-eff" data-lv-eff>${effLine(c)}</span>` : ""}</div>${tm("a")}`;
}
function effLine(c){ const e = LV.effInfo(c);
  if(LV.isLivePh(c.phase)) return `<span>الفعلي <b dir="ltr">${LV.fmtS(e.cur)}</b></span><span>المهدر <b dir="ltr">${LV.fmtS(e.waste)}</b></span>`;
  return `<span>الوقت الفعلي <b dir="ltr">${LV.fmtS(e.total)}</b></span>`; }
function paintPub(fresh){
  if(!PUB) return; const root = document.getElementById("lvPub"); if(!root){ stopPub(); return; }
  const doc = PUB.doc;
  if(!doc){ root.querySelector("#lvPubScore").innerHTML = `<div class="lv-empty">لا يوجد بث مباشر لهذه المباراة.</div>`; return; }
  const prev = PUB.lastScore, s = LV.score(doc);
  root.querySelector("#lvPubScore").innerHTML = scoreHTML(doc);
  if(prev && (prev.h!==s.h || prev.a!==s.a)) root.querySelectorAll(".lv-ps-res b").forEach(b=>{ if(prev[b.dataset.s]!==s[b.dataset.s]) b.classList.add("bump"); });
  PUB.lastScore = s;
  const ev = U.sortEvents(U.activeEvents(doc));
  let flash = null;
  if(PUB.seen){ ev.forEach(e=>{ if(!PUB.seen.has(e.id)){ flash=e.id; if(fresh) LV.celebrate(root.querySelector("#lvPubToasts"), doc, e); } }); }
  PUB.seen = new Set(ev.map(e=>e.id));
  const f = PUB.filter;
  const pbox = root.querySelector("#lvPubPitch");
  pbox.querySelector(".lv-marks").innerHTML = LV.markersStad(doc, {flash, filter: f==="all" ? null : e=>e.team===f});
  pbox.querySelector(".lv-dirs").innerHTML = LV.dirsStad(doc);
  LV.paintCrowd(pbox, doc);
  if(flash && fresh){ const fe = ev.find(e=>e.id===flash); if(fe && (fe.k==="goal"||fe.k==="og")) LV.cheer(pbox, doc, fe.team); }
  root.querySelector("#lvPubHtl").innerHTML = LV.hTimelineHTML(doc);
  const list = ev.slice().reverse();
  root.querySelector("#lvPubFeed").innerHTML = list.length ? list.map(e=>LV.evRowHTML(doc, e, false)).join("") : `<div class="lv-empty">لم تُسجَّل أحداث بعد.</div>`;
  if(flash){ const r=root.querySelector(`#lvPubFeed [data-ev="${flash}"]`); if(r) r.classList.add("new"); }
  const more = root.querySelector("#lvPubMore"), cap = 6;
  root.querySelector("#lvPubFeed").classList.toggle("capped", !PUB.allEv && list.length > cap);
  if(more){ more.hidden = list.length <= cap; more.textContent = PUB.allEv ? "عرض أقل" : `عرض كل الأحداث (${list.length})`; }
  root.querySelector("#lvPubCount").textContent = list.filter(e=>!(LV.EVK[e.k]||{}).sys).length + " حدث";
  root.querySelector("#lvPubStats").innerHTML = LV.statsHTML(doc);
  root.querySelector("#lvPubInfo").innerHTML = LV.infoHTML(doc);
  syncHeader(doc, s);
}
/* رأس صفحة المباراة الأصلي يعرض النتيجة والحالة الحيّة أيضاً */
function syncHeader(doc, s){
  const box = document.getElementById("mpage"); if(!box || !doc) return;
  const c = doc.clock;
  if(c.phase!=="pre"){
    const res = box.querySelector(".mp-head .mp-res");
    if(res){ const b=res.querySelectorAll("b"); if(b.length===2){ b[0].textContent=s.h; b[1].textContent=s.a; } }
    else { const t = box.querySelector(".mp-head .mp-time"); if(t) t.outerHTML = `<span class="mp-res"><b>${s.h}</b><i>-</i><b>${s.a}</b></span>`; }
  }
  const st = box.querySelector(".mp-head .mp-st");
  if(st && c.phase!=="pre"){ const live = LV.isLivePh(c.phase);
    st.className = "mp-st" + (live ? " live" : c.phase==="ht" ? " ht" : "");
    st.innerHTML = live ? `<i></i><span dir="ltr" data-lv-clock>${H(LV.clockLabel(c))}</span>` : H(LV.PH[c.phase]||""); }
}
function syncHeaderFromIdx(L){
  syncHeader({clock:{phase:L.phase, running:L.running, base:L.base, anchor:L.anchor, added:{}}}, {h:L.hg, a:L.ag});
}
function stopPub(){ if(!PUB) return; try{ PUB.unsub&&PUB.unsub(); }catch(e){} try{ PUB.untick&&PUB.untick(); }catch(e){} PUB=null; }
LV.mountPublic = function(host, m){
  LV.ctxGulf = !!(m && m.__gulf);
  const id = LV.idOf(LV.keyOf(m));
  stopPub();
  host.innerHTML = pubShell(m);
  const me = PUB = {id, m, doc:null, seen:null, filter:"all"};
  me.unsub = LV.store.watch(id, (d, meta)=>{ if(d===undefined || PUB!==me) return; me.doc = d; paintPub(!!(meta&&meta.fresh) || !(meta&&meta.pending)); });
  me.untick = LV.tick(()=>{ if(PUB!==me || !me.doc) return; const c=me.doc.clock; if(!c.running) return;
    document.querySelectorAll("#mpage [data-lv-clock]").forEach(el=>el.textContent=LV.clockLabel(c));
    document.querySelectorAll("#mpage [data-lv-eff]").forEach(el=>el.innerHTML=effLine(c)); });
  host.onclick = e=>{
    if(e.target.closest("#lvPubMore") && PUB){ PUB.allEv = !PUB.allEv; paintPub(false); return; }
    const f = e.target.closest("#lvPubFilter [data-f]"); if(f && PUB){ PUB.filter=f.dataset.f; host.querySelectorAll("#lvPubFilter [data-f]").forEach(b=>b.setAttribute("aria-pressed", b===f)); paintPub(false); return; }
    const t = e.target.closest("[data-ev]"); if(t && PUB && PUB.doc){ e.preventDefault(); e.stopPropagation(); LV.openModal(PUB.doc, t.dataset.ev); }
  };
  host.onkeydown = e=>{ if(e.key==="Enter"){ const t=e.target.closest("[data-ev]"); if(t&&PUB&&PUB.doc) LV.openModal(PUB.doc, t.dataset.ev); } };
};
LV.stopPublic = stopPub;

/* ───── ربط صفحة المباراة: تبويب «مباشر» متى وُجدت وثيقة مباشرة للمباراة ───── */
function hookMatchPage(){
  if(typeof renderMatchPage!=="function" || renderMatchPage.__lv) return;
  const orig = renderMatchPage;
  renderMatchPage = function(){
    const r = orig.apply(this, arguments);
    try{
      const box = document.getElementById("mpage"), m = (typeof MP==="object") ? MP.m : null;
      if(!box || !m) return r;
      const L = liveOf(m);
      const nav = box.querySelector(".mp-tabs");
      if(L && nav && !nav.querySelector('[data-mp-tab="live"]')){
        const b = document.createElement("button"); b.type="button"; b.dataset.mpTab="live"; b.className="lv-tabbtn";
        b.innerHTML = `${LV.isLivePh(L.phase)?'<i class="lv-dot"></i>':""}مباشر`; nav.prepend(b);
        nav.querySelectorAll("[data-mp-tab]").forEach(x=>x.setAttribute("aria-pressed", x.dataset.mpTab===MP.tab));
      }
      if(MP.tab==="live" && L){ const body = box.querySelector(".mp-body"); if(body) LV.mountPublic(body, m); }
      else { stopPub(); if(L) syncHeaderFromIdx(L); }
    }catch(e){ console.error(e); }
    return r;
  };
  renderMatchPage.__lv = true;
  if(typeof openMatch==="function" && !openMatch.__lv){
    const o = openMatch;
    openMatch = window.openMatch = function(m, opts){
      const mm = typeof m==="string" && typeof matchByKey==="function" ? matchByKey(m) : m;
      const was = (typeof MP==="object") ? MP.m : null;
      const r = o.apply(this, arguments);
      const L = liveOf(mm);
      if(mm && L && was!==mm && (LV.isLivePh(L.phase) || L.phase==="ht" || (opts&&opts.live))){ MP.tab="live"; renderMatchPage(); }
      return r;
    };
    openMatch.__lv = true;
  }
  if(typeof hideMatchBox==="function" && !hideMatchBox.__lv){ const c=hideMatchBox; hideMatchBox = function(){ stopPub(); return c.apply(this, arguments); }; hideMatchBox.__lv=true; }
}

/* ───── شريط «مباشر الآن» أعلى الموقع ───── */
function paintStrip(){
  let el = document.getElementById("lvStrip");
  const live = Object.values(LV.idx||{}).filter(L=>L && (LV.isLivePh(L.phase) || L.phase==="ht"));
  if(!live.length){ if(el) el.remove(); return; }
  if(!el){ el=document.createElement("div"); el.id="lvStrip"; el.className="lv-strip"; const anchor=document.getElementById("resStrip"); if(anchor) anchor.parentNode.insertBefore(el, anchor); else document.body.prepend(el);
    el.addEventListener("click", e=>{ const b=e.target.closest("[data-lv-open]"); if(!b) return; const m=LV.findMatch(b.dataset.lvOpen); if(m && typeof openMatch==="function") openMatch(m, {live:true}); }); }
  el.innerHTML = `<span class="lv-strip-lb"><i class="lv-dot"></i>مباشر الآن</span>` + live.map(L=>`<button type="button" class="lv-strip-m" data-lv-open="${H(L.key)}">
    <span>${U.crestOf(L.home)}<b>${H(L.home)}</b></span><strong class="lv-strip-s"><b>${L.hg}</b><i>-</i><b>${L.ag}</b></strong><span><b>${H(L.away)}</b>${U.crestOf(L.away)}</span>
    <em dir="ltr" data-lv-strip="${H(L.key)}">${L.phase==="ht" ? "استراحة" : H(LV.clockLabel({phase:L.phase, running:L.running, base:L.base, anchor:L.anchor}))}</em></button>`).join("");
}
LV.tick(()=>{ document.querySelectorAll("[data-lv-strip]").forEach(el=>{ const L=Object.values(LV.idx).find(x=>x.key===el.dataset.lvStrip); if(L && L.running) el.textContent=LV.clockLabel({phase:L.phase, running:true, base:L.base, anchor:L.anchor}); }); });

let idxOn = false;
function startIdx(){
  if(idxOn || !LV.store.ready()) return; idxOn = true;
  LV.store.idxWatch(d=>{ LV.idx = (d && d.m) || {}; paintStrip();
    const box=document.getElementById("mpage");
    if(box && !box.hidden && typeof MP==="object" && MP.m){
      const nav=box.querySelector(".mp-tabs"), L=liveOf(MP.m);
      if(L && nav && !nav.querySelector('[data-mp-tab="live"]')) renderMatchPage();
      else if(L && MP.tab!=="live") syncHeaderFromIdx(L);
    }
    if(window.LIVE_ADMIN && window.LIVE_ADMIN.onIdx) window.LIVE_ADMIN.onIdx();
  });
}
/* ───── غرفة التحكم: تُحمَّل عند الحاجة فقط (live-admin.js) ───── */
LV.VER = 5;
LV.loadAdmin = function(){
  if(window.LIVE_ADMIN) return Promise.resolve(window.LIVE_ADMIN);
  return new Promise((res, rej)=>{ const s=document.createElement("script"); s.src="live-admin.js?v="+LV.VER; s.onload=()=>res(window.LIVE_ADMIN); s.onerror=rej; document.head.appendChild(s); });
};
LV.openControl = function(key){ return LV.loadAdmin().then(A=>A.open(key)); };
function routeCtl(){
  const m = /^#livectl\/(.+)$/.exec(location.hash); if(!m) return;
  let n=0; const t=()=>{ if(typeof MATCHES!=="undefined" && Array.isArray(MATCHES) && MATCHES.length && LV.store.ready()) LV.openControl(m[1]); else if(++n<80) setTimeout(t,300); }; t();
}
window.addEventListener("hashchange", ()=>{ if(/^#livectl\//.test(location.hash)) routeCtl(); });

/* ───── بطاقة «مركز المباراة المباشر» في لوحة الإدارة ───── */
function canEdit(){ return LV.TEST || (typeof isAdmin!=="undefined" && !!isAdmin); }
LV.canEdit = canEdit;
function nearMatches(){
  const L = (typeof MATCHES!=="undefined" && Array.isArray(MATCHES)) ? MATCHES.slice() : [];
  const ts = m => (typeof kickoffTS==="function" ? kickoffTS(m) : null) || 0, now = Date.now();
  return L.sort((a,b)=>Math.abs(ts(a)-now)-Math.abs(ts(b)-now)).slice(0, 18);
}
LV.nearMatches = nearMatches;
function injectAdminCard(){
  const v = document.getElementById("v-admin"); if(!v || !canEdit() || v.querySelector("#lvAdminCard")) return;
  const card = document.createElement("div"); card.id="lvAdminCard"; card.className="lv-admcard";
  const cmp = m => (typeof compOf==="function"?compOf(m):"");
  card.innerHTML = `<div class="lv-admcard-hd"><span class="lv-admcard-ic">${LV.ico("play")}</span><div><h3>مركز المباراة المباشر</h3><p>أدِر المباراة لحظة بلحظة من ملعب تفاعلي — يظهر كل حدث للجمهور فوراً.</p></div></div>
    <div class="lv-admcard-row"><select id="lvAdmPick" aria-label="المباراة">${nearMatches().map(m=>{ const L=liveOf(m); return `<option value="${H(LV.keyOf(m))}">${L&&LV.isLivePh(L.phase)?"(مباشر) ":""}${H(m.home)} × ${H(m.away)} — ${H(cmp(m))} ج${H(m.round)}${m.date?" · "+H(m.date):""}</option>`; }).join("")}</select>
    <button type="button" class="btn" id="lvAdmGo">فتح غرفة التحكم</button></div>`;
  v.prepend(card);
  card.querySelector("#lvAdmGo").onclick = ()=>{ const k=card.querySelector("#lvAdmPick").value; if(k){ try{ history.pushState({lv:1}, "", "#livectl/"+k); }catch(e){} LV.openControl(k); } };
}
function hookAdmin(){
  if(typeof renderAdmin==="function" && !renderAdmin.__lv){ const o=renderAdmin; renderAdmin=function(){ const r=o.apply(this, arguments); try{ injectAdminCard(); }catch(e){ console.error(e); } return r; }; renderAdmin.__lv=true; }
  if(typeof renderEditorAdmin==="function" && !renderEditorAdmin.__lv){ const o=renderEditorAdmin; renderEditorAdmin=function(){ const r=o.apply(this, arguments); try{ injectAdminCard(); }catch(e){} return r; }; renderEditorAdmin.__lv=true; }
  if(typeof RENDER==="object" && RENDER && RENDER.admin && !RENDER.admin.__lv){ RENDER.admin = renderAdmin; }
}

function boot(){
  if(LV.TEST){   /* وضع الاختبار المحلي: الحفظ اليدوي والدمج السحابي محليان فقط */
    try{ window.rebaseOnCloud = rebaseOnCloud = async()=>({ok:true, changed:false}); }catch(e){}
    try{ window.persistData = persistData = async()=>{ try{ localStorage.setItem("zain_data", JSON.stringify(dataObject())); }catch(e){} return true; }; }catch(e){}
    try{ window.isAdmin = isAdmin = true; }catch(e){}
  }
  hookMatchPage(); hookAdmin(); startIdx(); routeCtl();
}
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", ()=>setTimeout(boot, 0)); else setTimeout(boot, 0);
/* fbDb يُهيّأ بعد تحميل مكتبات Firebase: ننتظره ثم نفتح قناة الفهرس */
if(!LV.TEST){ let n=0; const w=()=>{ if(LV.store.ready()) startIdx(); else if(++n<120) setTimeout(w, 250); }; setTimeout(w, 300); }
})();

/* =====================================================================
   الملعب ثلاثي الأبعاد (صورة Gemini بطراز الملاعب الكويتية) + الجمهور
   الإسقاط: مصفوفة تحويل منظوري من أمتار الملعب (105×68) إلى بكسلات الصورة (1376×768)،
   مقيسة من زوايا الملعب الأربع في الصورة. الجمهور يُرسم على canvas فوق المقاعد:
   جمهور الضيف في النصف الأيمن من المنصة الرئيسية والمدرج المجاور لها، والباقي لصاحب الأرض؛ الكثافة يحددها المشغّل.
   ===================================================================== */
(function(){
const LV = window.LIVE, U = LV.util, H = U.H;
const IW = 1376, IH = 820, MID = 688;
const HM = [6.01904755,-4.50856478,372.0, 0,0.51186839,320.0, 0,-0.00655315,1];   /* ملعب 3: صورة Gemini مصحّحة المنظور (كاميرا أعلى، الملعب يملأ الإطار) */
function inv3(m){
  const [a,b,c,d,e,f,g,h,i]=m, A=e*i-f*h, B=-(d*i-f*g), C=d*h-e*g, det=a*A+b*B+c*C;
  return [A/det,-(b*i-c*h)/det,(b*f-c*e)/det, B/det,(a*i-c*g)/det,-(a*f-c*d)/det, C/det,-(a*h-b*g)/det,(a*e-b*d)/det];
}
const HI = inv3(HM);
const ap = (m,x,y) => { const w=m[6]*x+m[7]*y+m[8]; return [(m[0]*x+m[1]*y+m[2])/w, (m[3]*x+m[4]*y+m[5])/w]; };
LV.project = (mx,my) => { const [u,v]=ap(HM,mx,my); return {u,v}; };
LV.unproject = (u,v) => { const [mx,my]=ap(HI,u,v); return {mx,my}; };
const depth = v => Math.max(0, Math.min(1, (v-320)/320));   /* 0 = الخط البعيد، 1 = القريب */

/* crop = [x, y, w, h] بكسلات الصورة: نقصّ السماء ونُبقي الملعب والمدرجات، فيكبر الملعب في الإطار */
LV.STAD_CROP = {ctl:[0,215,1376,540], pub:[0,60,1376,740]};
LV.stadiumHTML = function(cls){
  const [cx,cy,cw,ch] = LV.STAD_CROP[cls] || [0,0,IW,IH];
  const inner = `width:${(IW/cw*100).toFixed(3)}%;left:${(-cx/cw*100).toFixed(3)}%;top:${(-cy/ch*100).toFixed(3)}%`;
  return `<div class="lv-stad ${cls||""}" style="aspect-ratio:${cw}/${ch}"><div class="lv-stad-in" style="${inner}">
    <img class="lv-stad-img" src="assets/live/stadium.webp?v=4" alt="" draggable="false">
    <canvas class="lv-crowd" width="${IW}" height="${IH}"></canvas>
    <svg class="lv-pitch lv-stad-svg" viewBox="0 0 ${IW} ${IH}" preserveAspectRatio="xMidYMid meet">
      <g class="lv-dirs"></g><g class="lv-marks"></g><g class="lv-ghost"></g>
    </svg></div></div>`;
};
/* نقرة ← أمتار (قد تكون خارج الخط على المضمار) — null إن كانت في المدرجات بعيداً */
LV.stadPoint = function(svg, ev){
  const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
  const p = pt.matrixTransform(svg.getScreenCTM().inverse());
  const {mx,my} = LV.unproject(p.x, p.y);
  if(mx < -8 || mx > 113 || my < -7 || my > 75) return null;
  return {mx, my};
};
function icoInner(k){ return (LV.ico(k).match(/<svg[^>]*>([\s\S]*)<\/svg>/)||[])[1]||""; }
const MARK_COLORS = {h:"#2eb0f0", a:"#f5a524", "":"#cbd5e1"};
LV.markersStad = function(doc, opts){
  opts = opts || {};
  const ev = U.sortEvents(U.activeEvents(doc)).filter(e=>e.x!=null && e.y!=null && (!opts.filter || opts.filter(e)));
  return ev.map(e=>{ const {mx,my}=U.toM(e.x,e.y), {u,v}=LV.project(mx,my), dp=depth(v), col=MARK_COLORS[e.team||""];
    const big = ["goal","og","pen","penmiss","pensave","red","yr"].includes(e.k);
    const r = (big?15:12) + dp*6;
    return `<g class="lv-mk${e.id===opts.flash?" new":""}${opts.sel===e.id?" sel":""}" data-ev="${H(e.id)}" transform="translate(${u.toFixed(1)} ${v.toFixed(1)})" tabindex="0" role="button" aria-label="${H(LV.EVK[e.k]?LV.EVK[e.k].t:e.k)} ${H(LV.minLabel(e))}">
      <ellipse cx="0" cy="${(r*.9).toFixed(1)}" rx="${(r*.9).toFixed(1)}" ry="${(r*.28).toFixed(1)}" fill="rgba(0,0,0,.35)"/>
      <circle r="${r+2}" fill="rgba(0,0,0,.45)"/><circle r="${r}" fill="#0b1422" stroke="${col}" stroke-width="2.4"/>
      <svg x="${-r*.72}" y="${-r*.72}" width="${r*1.44}" height="${r*1.44}" viewBox="0 0 24 24" style="color:#e6eef8">${icoInner((LV.EVK[e.k]||{}).ic)}</svg>
    </g>`; }).join("");
};
LV.ghostStad = function(x, y, k){
  const {mx,my}=U.toM(x,y), {u,v}=LV.project(mx,my), r = 15 + depth(v)*6;
  return `<g transform="translate(${u} ${v})"><circle r="${r*1.9}" class="lv-ghost-r3"/><circle r="${r}" fill="#0b1422" stroke="#fff" stroke-width="2"/>
    ${k?`<svg x="${-r*.72}" y="${-r*.72}" width="${r*1.44}" height="${r*1.44}" viewBox="0 0 24 24" style="color:#fff">${icoInner((LV.EVK[k]||{}).ic)}</svg>`:""}</g>`;
};
LV.dirsStad = function(doc, ph){
  const r = LV.attackerOfEnd(doc, "right", ph||doc.clock.phase), l = r==="h" ? "a" : "h";
  const nm = s => s==="h" ? doc.home : doc.away;
  /* شعار الفريق المدافع عن كل جهة، بلا خلفية (منصور) — وإن لم يوجد شعار نعرض الاسم */
  const src = c => (typeof crestSrcOf==="function" ? crestSrcOf(c) : "") || ((typeof LOGOS==="object" && LOGOS) ? LOGOS[c] : "") || "";
  const tag = (x, s) => { const c = nm(s), u = src(c);
    return u ? `<image class="lv-dircrest" href="${H(u)}" x="${x-36}" y="${705-36}" width="72" height="72" preserveAspectRatio="xMidYMid meet"><title>${H(c)}</title></image>`
             : `<text x="${x}" y="709" text-anchor="middle" class="lv-dirt3">${H(c)}</text>`; };
  return tag(230, r) + tag(1146, l);
};

/* ───────────── الجمهور ───────────── */
let SEATS = null, seatsP = null;
function loadSeats(){ if(SEATS) return Promise.resolve(SEATS); if(!seatsP) seatsP = fetch("assets/live/seats.json?v=5").then(r=>r.json()).then(d=>{ SEATS=d; return d; }); return seatsP; }
const rnd = i => { let x = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b); x ^= x>>>13; x = Math.imul(x, 0xc2b2ae35); x ^= x>>>16; return (x>>>0)/4294967296; };
const SKIN = ["#e0b18f","#c68c65","#a8714f","#8a5a3c","#d9a178"];
function teamColors(club){
  if(LV.colorsHook){ const h = LV.colorsHook(club); if(h) return h; }
  if(club==="الكويت") return Object.assign(["#FFFFFF","#FFFFFF"], {light:false});   /* جمهور نادي الكويت بالأبيض (منصور) */
  const cc = (window.CLUB_COLORS||{})[club] || ["#1878BE","#FFFFFF"];
  const hex = cc[0].replace("#",""), lum = (parseInt(hex.slice(0,2),16)*.299 + parseInt(hex.slice(2,4),16)*.587 + parseInt(hex.slice(4,6),16)*.114)/255;
  const out = [cc[0], cc[1] || "#FFFFFF"]; out.light = lum > .8; return out;
}
/* المستويات: 0 فارغ … 100 ممتلئ — يحددها المشغّل (d.crowd)؛ الافتراضي حضور متوسط للطرفين */
LV.CROWD_DEF = {h:60, a:35};
LV.crowdOf = doc => Object.assign({}, LV.CROWD_DEF, (doc && doc.crowd) || {});
function drawCrowd(cv, doc, bounce){
  if(!SEATS || !cv) return;
  const g = cv.getContext("2d"); g.clearRect(0,0,IW,IH);
  const lv = LV.crowdOf(doc), home = teamColors(doc.home), away = teamColors(doc.away);
  const P = SEATS.p, t = bounce ? bounce.t : 0;
  for(let i=0, n=0; i<P.length; i+=3, n++){
    const x = P[i]/10, y = P[i+1]/10, s = P[i+2]/10, side = (y < 420 && x >= MID) ? "a" : "h";   /* الضيف: يمين المنصة الرئيسية والمدرج المجاور لها — والباقي لصاحب الأرض (منصور) */
    const lvl = (side==="h" ? lv.h : lv.a) / 100;
    if(rnd(n) >= lvl) continue;
    const pal = side==="h" ? home : away, second = rnd(n+7777) < (pal.light ? .55 : .3);   /* لون أساسي فاتح (أبيض) يضيع على المقاعد: نُكثر الثاني */
    let dy = 0;
    if(bounce && bounce.side===side) dy = -Math.abs(Math.sin(t*9 + rnd(n+99)*6)) * s * 1.1;
    const yy = y + dy;
    g.fillStyle = second ? pal[1] : pal[0];
    g.beginPath(); g.ellipse(x, yy + s*.45, s, s*.85, 0, 0, Math.PI*2); g.fill();
    if(s > 2.2){ g.strokeStyle = "rgba(0,0,0,.25)"; g.lineWidth = .6; g.stroke(); }
    g.fillStyle = SKIN[(rnd(n+333)*SKIN.length)|0];
    g.beginPath(); g.arc(x, yy - s*.55, s*.5, 0, Math.PI*2); g.fill();
    if(bounce && bounce.side===side && s > 3 && rnd(n+5) < .35){   /* أذرع مرفوعة في الاحتفال */
      g.strokeStyle = pal[0]; g.lineWidth = Math.max(1, s*.35); g.lineCap = "round";
      g.beginPath(); g.moveTo(x - s*.8, yy + s*.1); g.lineTo(x - s*1.05, yy - s*1.1);
      g.moveTo(x + s*.8, yy + s*.1); g.lineTo(x + s*1.05, yy - s*1.1); g.stroke();
    }
  }
}
LV.paintCrowd = function(root, doc){
  const cv = root && root.querySelector(".lv-crowd"); if(!cv) return;
  const key = JSON.stringify([doc.home, doc.away, LV.crowdOf(doc)]);
  if(cv.dataset.k === key && !cv._bouncing) return;
  cv.dataset.k = key;
  loadSeats().then(()=>{ if(!cv._bouncing) drawCrowd(cv, doc); }).catch(()=>{});
};
/* احتفال جمهور الفريق المسجّل (ثانيتان) */
LV.cheer = function(root, doc, side){
  const cv = root && root.querySelector(".lv-crowd"); if(!cv || !side) return;
  loadSeats().then(()=>{
    cv._bouncing = true; const t0 = performance.now();
    const step = now => { const t = (now - t0)/1000; if(t > 2.4){ cv._bouncing = false; drawCrowd(cv, doc); return; }
      drawCrowd(cv, doc, {side, t}); requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
};
LV.cmd.setCrowd = (id, c) => LV.store.tx(id, d=>{ if(!d) return null; d.crowd = {h:Math.max(0,Math.min(100,+c.h||0)), a:Math.max(0,Math.min(100,+c.a||0))}; return d; });
})();

/* =====================================================================
   الربط بسجل المباراة الرسمي — مصدر واحد للإحصاءات (منصور 2026-09-21)

   السجل الرسمي = مصفوفات الموسم (goals/cards/pens/subs/mev) التي تُبنى منها كل
   الإحصاءات والترتيب والفانتسي. اللعب الفعلي والإدخال اليدوي يكتبان فيه بالدالة
   نفسها applyEdit (تستبدل صفوف المباراة كاملة ⇒ لا تكرار مهما تكرر الحفظ).
   كل صف يحمل lid = معرّف حدثه في وثيقة البث، فالتعديل من أي واجهة يصل الحدث نفسه.

   الاتجاهان:
   · بث ← سجل  (push)  بعد كل أمر من غرفة التحكم (مجمّعة 1.2 ث)
   · سجل ← بث  (pull)  بعد حفظ المحرّر اليدوي لمباراة مرتبطة، وعند فتح البث لمباراة مسجّلة يدوياً
   أحداث البث الإضافية (ركنية، تماس، تسديدة…) تبقى في البث وحده ولا تمسّ السجل.
   ===================================================================== */
(function(){
const LV = window.LIVE, U = LV.util;
const REC = LV.rec = {};
const PHASE_TXT = {kickoff:[1,"بداية المباراة"], ht:[45,"نهاية الشوط الأول"], h2:[46,"بداية الشوط الثاني"], ft:[90,"نهاية المباراة"]};
const TXT_PHASE = {}; Object.entries(PHASE_TXT).forEach(([k,[m,t]])=>TXT_PHASE[t]=k);
const CARD = {yellow:"إنذار", yr:"إنذار ثانٍ", red:"طرد مباشر"};
const PEN_DEF = {pensave:"تصدى لها الحارس", penmiss:"خارج المرمى"};
/* الأنواع التي لها صف في السجل (غيرها للعرض المباشر فقط) */
const RECK = new Set(["goal","og","yellow","yr","red","sub","pen","penmiss","pensave","chance","var","vard","custom","kickoff","ht","h2","ft"]);
REC.RECK = RECK;
const isRecEv = e => RECK.has(e.k) && !(e.k==="pen" && !e.res);     /* ركلة محتسبة بلا نتيجة بعد = عرض فقط */

/* ── دقائق: ثواني البث ↔ دقيقة السجل (m, x) ── */
const mOf = e => LV.minuteOf(+e.t||0, e.ph);
/* الدقيقة كما كُتبت في السجل (rm) تبقى ما دام وقت الحدث لم يُغيَّر — تحفظ دقيقة 0 (غير مسجّلة) و«الشوط 2 د45» كما هي */
function recMin(e){
  const c = mOf(e);
  if(e.rm){ const tt = tOf(e.rm.m, e.rm.x, e.rm.h), r = LV.minuteOf(tt.t, tt.ph);
    if(r.m===c.m && r.x===c.x) return {m:+e.rm.m||0, x:+e.rm.x||0, h:e.rm.h}; }
  return c;
}
function tOf(m, x, h){
  m = +m||1; x = +x||0;
  if(x && m===45) return {t:2700 + (x-1)*60 + 30, ph:"h1"};
  if(x && m===90) return {t:5400 + (x-1)*60 + 30, ph:"h2"};
  if(x && m===105) return {t:6300 + (x-1)*60 + 30, ph:"e1"};
  if(x && m===120) return {t:7200 + (x-1)*60 + 30, ph:"e2"};
  const ph = h==1 && m<=45 ? "h1" : h==2 && m<=45 ? "h2" : m<=45 ? "h1" : m<=90 ? "h2" : m<=105 ? "e1" : "e2";
  return {t:(m-1)*60 + 30, ph};
}
REC.tOf = tOf;

/* ── بث ← صفوف السجل ── */
function liveToRows(doc){
  const club = s => s==="h" ? doc.home : s==="a" ? doc.away : "";
  const R = {goals:[], cards:[], pens:[], subs:[], mev:[]};
  const seenPhase = new Set();
  U.sortEvents(U.activeEvents(doc)).forEach(e=>{
    if(!isRecEv(e)) return;
    const mm = recMin(e), {m, x} = mm, c = club(e.team);
    switch(e.k){
      case "goal":
        R.goals.push({sc:c, p:e.p||"", a:e.p2||"", m, x, det:e.det||(e.pen?"ركلة جزاء":""), bp:e.bp||"", zone:e.gz||"", og:"", lid:e.id});
        if(e.pen) R.pens.push({by:c, p:e.p||"", m:(e.penm!=null ? e.penm : m + x), res:"سجلت", place:e.place||"", lid:e.id+":p"});   /* صف الجزاء بالدقيقة المطلقة (90+2 ⇒ 92) كما في السجل */
        break;
      case "og":
        R.goals.push({sc:c, p:e.p2||"", a:e.ast||"", m, x, det:e.det||"", bp:"هدف عكسي", zone:e.gz||"", og:e.p||"", lid:e.id}); break;
      case "yellow": case "yr": case "red":
        R.cards.push({club:c, p:e.p||"", m, type:CARD[e.k], lid:e.id}); break;
      case "pen": case "penmiss": case "pensave":
        R.pens.push({by:c, p:e.p||"", m, res:e.res||PEN_DEF[e.k]||"", place:e.place||"", lid:e.id}); break;
      case "sub":
        R.subs.push({club:c, out:e.p||"", in:e.p2||"", h:(mm.h!=null ? +mm.h : (e.ph==="h1")?1:2), m, x, lid:e.id}); break;
      case "chance":
        R.mev.push({k:"chance", club:c, p:e.p||"", m, x, note:e.note||"", lid:e.id}); break;
      case "var": case "vard":
        R.mev.push({k:"var", club:c, p:e.p||"", m, x, note:[e.k==="vard"?(e.dec||"قرار VAR"):"", e.note||""].filter(Boolean).join(" — "), lid:e.id}); break;
      case "custom":
        R.mev.push({k:"note", club:c, p:"", m, x, note:e.note||"حدث", lid:e.id}); break;
      default: {                                   /* بداية/نهاية الأشواط = تعليق مرحلة كما يفعل المحرّر اليدوي */
        const pt = PHASE_TXT[e.k]; if(!pt || seenPhase.has(e.k)) break;
        seenPhase.add(e.k); R.mev.push({k:"note", club:"", p:"", m:(e.rm ? mm.m : pt[0]), x:(e.rm ? mm.x : 0), note:pt[1], lid:e.id});
      }
    }
  });
  return R;
}
REC.liveToRows = liveToRows;

/* ── صفوف السجل ← أحداث بث (لكل صف: lid الحالي أو معرّف جديد) ── */
function rowsToLive(doc, E){
  const side = c => c===doc.home ? "h" : c===doc.away ? "a" : "";
  const out = [];
  const nid = () => U.uid();
  const penUsed = new Set();
  const pens = (E.pens||[]).map((p,i)=>({...p, _i:i}));
  (E.goals||[]).forEach(g=>{
    const tt = tOf(g.m, g.x);
    const rm = {m:+g.m||0, x:+g.x||0};
    if(g.bp==="هدف عكسي"){ out.push({k:"og", team:side(g.sc), p:g.og||"", p2:g.p||"", ...(g.a?{ast:g.a}:{}), det:g.det||"", gz:g.zone||"", ...tt, rm, id:g.lid||nid()}); return; }
    const e = {k:"goal", team:side(g.sc), p:g.p||"", p2:g.a||"", det:g.det||"", bp:g.bp||"", gz:g.zone||"", ...tt, rm, id:g.lid||nid()};
    /* ركلة جزاء مسجّلة لنفس اللاعب ⇒ الهدف نفسه (لا حدثان) */
    if(g.det==="ركلة جزاء"){ const pr = pens.find(p=>!penUsed.has(p._i) && p.res==="سجلت" && p.by===g.sc && (!p.p || p.p===g.p));
      if(pr){ penUsed.add(pr._i); e.pen = true; if(pr.place) e.place = pr.place; e.penm = +pr.m||0; } }
    out.push(e);
  });
  pens.forEach(p=>{ if(penUsed.has(p._i)) return;
    const k = /تصدى/.test(p.res||"") ? "pensave" : /خارج|القائم|العارضة/.test(p.res||"") ? "penmiss" : "pen";
    const lid = String(p.lid||""); const id = lid && !lid.endsWith(":p") ? lid : nid();
    out.push({k, team:side(p.by), p:p.p||"", res:p.res||"", place:p.place||"", ...tOf(p.m, 0), rm:{m:+p.m||0, x:0}, id}); });
  (E.cards||[]).forEach(c=>{ const t = c.type||"إنذار";
    const k = /ثان/.test(t) ? "yr" : /طرد/.test(t) ? "red" : "yellow";
    out.push({k, team:side(c.club), p:c.p||"", ...tOf(c.m, 0), rm:{m:+c.m||0, x:0}, id:c.lid||nid()}); });
  (E.subs||[]).forEach(x=>out.push({k:"sub", team:side(x.club), p:x.out||"", p2:x.in||"", ...tOf(x.m, x.x, +x.h||1), rm:{m:+x.m||0, x:+x.x||0, h:+x.h||1}, id:x.lid||nid()}));
  (E.mev||[]).forEach(x=>{
    const rm = {m:+x.m||0, x:+x.x||0};
    if(x.k==="note" && TXT_PHASE[x.note]){ const k=TXT_PHASE[x.note]; out.push({k, team:"", ...tOf(x.m, x.x), rm, id:x.lid||nid()}); return; }
    const k = x.k==="chance" ? "chance" : x.k==="var" ? "var" : "custom";
    out.push({k, team:side(x.club), p:x.p||"", note:x.note||"", ...tOf(x.m, x.x), rm, id:x.lid||nid()}); });
  out.forEach(e=>{ if(e.t==null) e.t = 0; });
  return out;
}
REC.rowsToLive = rowsToLive;

/* دمج صفوف السجل في وثيقة البث: الحدث المرتبط يحتفظ بمكانه على الملعب وثوانيه (إن لم تتغيّر الدقيقة)
   ويأخذ القيم الجديدة؛ حدث سجل حُذف يُحذف من البث؛ أحداث العرض فقط لا تُمسّ. */
function mergeRows(doc, E){
  const incoming = rowsToLive(doc, E), byId = new Map(incoming.map(e=>[e.id, e]));
  const keep = [];
  (doc.events||[]).forEach(e=>{
    if(!isRecEv(e)){ keep.push(e); return; }
    const n = byId.get(e.id);
    if(!n) return;                                 /* حُذف من السجل */
    byId.delete(e.id);
    const sameMin = (()=>{ const a=recMin(e), b=recMin(n); return a.m===b.m && a.x===b.x; })();
    const merged = Object.assign({}, e, n);
    if(sameMin){ merged.t = e.t; merged.ph = e.ph; }
    ["x","y","zone","reason","seq","at"].forEach(f=>{ if(e[f]!=null) merged[f]=e[f]; });
    if(!n.pen) delete merged.pen;
    keep.push(merged);
  });
  let seq = doc.seq||0;
  byId.forEach(n=>{ seq++; keep.push(Object.assign({seq, status:"ok", at:Date.now(), src:"manual"}, n)); });
  doc.events = keep; doc.seq = seq;
  return doc;
}
REC.mergeRows = mergeRows;

/* ── مطابقة المباراة في السجل ── */
function recMatch(doc){
  if(doc && doc.gulf && LV.gulfRec) return LV.gulfRec.find(doc);
  if(typeof ALL==="undefined" || !ALL || !ALL.matches) return null;
  return ALL.matches.find(x=>+x.round===+doc.round && compOf(x)===doc.comp && x.home===doc.home && x.away===doc.away) || null;
}
REC.recMatch = recMatch;
REC.hasRows = m => { if(!m || typeof loadEdit!=="function") return false; const E=(m.__gulf && LV.gulfCtx) ? LV.gulfCtx(()=>loadEdit(m)) : loadEdit(m);
  return !!(E.goals.length||E.cards.length||E.pens.length||E.subs.length||(E.mev||[]).length); };

/* بث ← سجل: يبني صفوف المباراة من الأحداث ويحفظ عبر applyEdit نفسها */
let lastBackup = 0;
REC.push = async function(doc, opt){
  if(!doc || doc.detached) return {skipped:true};
  if(doc.gulf && LV.gulfRec) return LV.gulfRec.push(doc, opt, liveToRows(doc));
  if(typeof applyEdit!=="function" || typeof loadEdit!=="function") return {skipped:true};
  if(!LV.TEST && typeof rebaseOnCloud==="function") await rebaseOnCloud();
  const m = recMatch(doc); if(!m) throw new Error("المباراة غير موجودة في سجل الموسم");
  const E = loadEdit(m), R = liveToRows(doc);
  E.goals = R.goals; E.cards = R.cards; E.pens = R.pens; E.subs = R.subs; E.mev = R.mev;
  const ph = doc.clock && doc.clock.phase;
  if(ph && ph!=="pre") E.match.status = ph==="et"||ph==="e1"||ph==="e2" ? "h2" : ph;
  const add = (doc.clock && doc.clock.added) || {};
  if(add.h1!=null) E.match.add1 = String(add.h1);
  if(add.h2!=null) E.match.add2 = String(add.h2);
  if(opt && opt.tv!=null) E.match.tv = opt.tv;
  E.match.rec = "live";
  applyEdit(E);
  if(typeof applyComp==="function") applyComp();
  if(LV.TEST){ try{ localStorage.setItem("zain_data", JSON.stringify(dataObject())); }catch(e){} if(typeof renderAll==="function") renderAll(); return {ok:true, test:true}; }
  const bk = (opt && opt.backup) || (Date.now() - lastBackup > 15*60*1000);
  const r = await persistData({noBackup:!bk});
  if(r===true && bk){ lastBackup = Date.now(); }
  if(typeof renderAll==="function") renderAll();
  return {ok:r===true, pending:r==="pending", r};
};
/* سجل ← بث: بعد حفظ يدوي لمباراة مرتبطة، أو عند ربط مباراة مسجّلة يدوياً */
REC.pull = async function(m){
  const key = LV.keyOf(m), id = LV.idOf(key);
  const E = (m.__gulf && LV.gulfCtx) ? LV.gulfCtx(()=>loadEdit(m)) : loadEdit(m);
  const n = await LV.store.tx(id, d=>{
    d = d || LV.newDoc(m);
    if(d.detached) return null;
    mergeRows(d, E);
    d.ops = []; d.linked = true;                 /* التراجع لا يعبر حفظاً يدوياً */
    return d;
  });
  if(n) await LV.store.idxSet(id, LV.idxSummary(n)).catch(()=>{});
  return n;
};
REC.detach = async function(doc){
  const id = LV.idOf(doc.key);
  if(doc.gulf && LV.gulfRec){ await LV.store.tx(id, d=>{ if(!d) return null; d.detached = true; return d; }); return LV.gulfRec.detach(doc); }
  await LV.store.tx(id, d=>{ if(!d) return null; d.detached = true; return d; });
  const m = recMatch(doc);
  if(m && m.rec==="live"){ if(!LV.TEST && typeof rebaseOnCloud==="function") await rebaseOnCloud();
    const E = loadEdit(recMatch(doc)); E.match.rec = ""; applyEdit(E); applyComp();
    if(LV.TEST){ try{ localStorage.setItem("zain_data", JSON.stringify(dataObject())); }catch(e){} } else await persistData(); }
};
REC.relink = async function(doc){
  const id = LV.idOf(doc.key), m = recMatch(doc); if(!m) return;
  await LV.store.tx(id, d=>{ if(!d) return null; d.detached = false; return d; });
  await REC.pull(m);
};

/* ── ربط المحرّر اليدوي: حفظ مباراة مرتبطة ⇒ تحديث البث ثم إعادة كتابة lid في السجل ── */
function hookManual(){
  if(typeof saveMatch!=="function" || saveMatch.__lv) return;
  const orig = saveMatch;
  saveMatch = async function(){
    const key = EDIT && EDIT.match ? {round:+EDIT.match.round, comp:EDIT.match.comp, home:EDIT.match.home, away:EDIT.match.away} : null;
    const linked = !!(EDIT && EDIT.match && EDIT.match.rec==="live");
    const r = await orig.apply(this, arguments);
    if(!key || !linked || EDIT) return r;          /* EDIT باقٍ = فشل التحقق */
    try{
      const m = (ALL.matches||[]).find(x=>x.round===key.round && compOf(x)===key.comp && x.home===key.home && x.away===key.away);
      if(!m) return r;
      const d = await REC.pull(m);
      if(d && !d.detached) await REC.push(d);       /* صفوف جديدة بلا lid تأخذ معرّفاتها */
      toast("حُدّث اللعب الفعلي بتعديلاتك", "ok");
    }catch(e){ console.error(e); toast("حُفظ السجل، لكن تعذّر تحديث اللعب الفعلي", "err"); }
    return r;
  };
  saveMatch.__lv = true;
}
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", ()=>setTimeout(hookManual, 0)); else setTimeout(hookManual, 0);
})();
