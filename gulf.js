/* =====================================================================
   كأس الخليج 27 — قسم مستقل (منصور 2026-09-21)

   العزل عن إحصاءات الموسم: بيانات البطولة في وثيقة مستقلة seasons/gulf27 بنفس بنية
   وثيقة الموسم (matches/goals/cards/pens/lineups/subs/shapes/mev/squads). لا تدخل
   ALL أبداً، فلا تمسّ الترتيب ولا الهدافين ولا ملفات اللاعبين ولا الفانتسي.
   لإعادة استعمال المحرّر اليدوي واللعب الفعلي وصفحة المباراة كما هي، يُشغَّل الكود داخل
   withGulf(fn): يبدّل مؤقتاً (وبشكل متزامن) ALL/SQUADS/CLUBS/LOGOS/COMP والمصفوفات
   المرشّحة إلى بيانات البطولة ثم يعيدها — مثل withComp في ملف اللاعب.
   ===================================================================== */
(function(){
"use strict";
const G = window.GULF = {};
const H = s => String(s==null?"":s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const TEST = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && /[?&]livetest=1\b/.test(location.search);
const COMP_G = "كأس الخليج", DOC_ID = "gulf27", NAME = "كأس الخليج 27";
G.COMP = COMP_G;

/* ───────────── المنتخبات (من القوائم الرسمية التي أرسلها منصور) ─────────────
   f = رمز العلم · c = لونا الجمهور · coach = المدرب إن ذُكر في الملصق · faces = مجلد القصّات (بترتيب القائمة)
   p: GK حارس (حين يذكره الملصق) · D/M/F حين يقسّم الملصق القائمة · "" غير مذكور — لا نخترع مراكز */
const T = {
  "الكويت":  {f:"kw", g:"A", c:["#0A57A8","#FFFFFF"], coach:"هيليو سوزا", kfa:true},
  "السعودية":{f:"sa", g:"A", c:["#0C7A3D","#FFFFFF"], coach:"جورجوس دونيس", faces:"sa", faceIdx:[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26],
    /* المراكز: الحراس والدفاع والوسط من إعلان القائمة الرسمي، والهجوم من SofaScore؛ ومن لم يُذكر مركزه يبقى بلا مركز */
    pos:{"عبدالإله العمري":"D","جهاد ذكري":"D","ريان حامد":"D","حسن كادش":"D","حسان التمبكتي":"D","نواف بوشل":"D","محمد محزري":"D","متعب الحربي":"D","زكريا هوساوي":"D",
         "مصعب الجوير":"M","محمد القحطاني":"M","محمد كنو":"M","زياد الجهني":"M","عبدالله الخيبري":"M","ناصر الدوسري":"M","علاء آل حجي":"M","محمد أبو الشامات":"M",
         "سلطان مندش":"F","عبدالله الحمدان":"F","فراس البريكان":"F"},
    gk:["محمد العويس","نواف العقيدي","حامد يوسف"],
    out:["عبدالإله العمري","جهاد ذكري","ريان حامد","حسن كادش","حسان التمبكتي","نواف بوشل","محمد محزري","متعب الحربي","زكريا هوساوي","مصعب الجوير","محمد القحطاني",
         "محمد كنو","زياد الجهني","عبدالله الخيبري","ناصر الدوسري","علاء آل حجي","سلطان مندش","محمد أبو الشامات","همام الهمامي","صالح أبو الشامات","عبدالله الحمدان","فراس البريكان","عبدالله آل سالم"]},
  "العراق":  {f:"iq", g:"A", c:["#1F7A3A","#FFFFFF"], coach:"غراهام أرنولد", faces:"iq",
    list:["أحمد يحيى","حسين حسن","محمد صالح","أحمد باسل","مصطفى سعدون","ميثم جبار","زيد تحسين","أكام هاشم","يوسف الإمام","ميرخاس دوسكي","محمد دلاور","إبراهيم بايش","زيدان إقبال",
          "بسام شاكر","زيد إسماعيل","أمير العماري","حيدر عبدالكريم","عبدالرزاق قاسم","كرار نبيل","محمد قاسم","أحمد قاسم","علي جاسم","سيف رشيد","أيمن حسين","علي الحمادي","يوسف النصراوي"],
    gkSet:["حسين حسن","محمد صالح","أحمد باسل"]},
  "عمان":    {f:"om", g:"A", c:["#D6202B","#FFFFFF"], coach:"طارق السكتيوي", faces:"om",
    /* من القائمة الرسمية للاتحاد العُماني؛ مصعب المعمري بدل أرشد العلوي وعبدالله المعمري بدل يوسف المالكي (إصابة) */
    list:["ابراهيم المخيني","أحمد الرواحي","ابراهيم الراجحي","حارب السعدي","خالد البريكي","عبدالمجيد البلوشي","محسن الغساني","جميل اليحمدي","أحمد الكعبي","أمجد الحارثي","عبدالله فواز",
          "زاهر الأغبري","مصعب الشقصي","غانم الحبشي","عصام الصبحي","ناصر الرواحي","عاهد المشايخي","سلطان المرزوق","خالد الغطريفي","عبد الحافظ المخيني","تركي بيت ربيع",
          "عبدالله المعمري","حسين الشحري","الحارث المخيني","مصعب المعمري","وليد المسلمي"],
    faceFile:{"عبدالله المعمري":28, "مصعب المعمري":27},
    gkSet:["ابراهيم المخيني","أحمد الرواحي","ابراهيم الراجحي"]},
  "قطر":     {f:"qa", g:"B", c:["#7A1535","#FFFFFF"], coach:"جولين لوبيتيغي", faces:"qa",
    list:["صلاح زكريا","محمود أبوندى","مشعل برشم","أحمد الجانحي","أحمد علاء","أحمد فتحي","أديميلسون جونيور","أكرم عفيف","المعز علي","ايوب العلوي","بوعلام خوخي","بيدرو ميغيل","تحسين محمد",
          "جاسم جابر","حسن الهيدوس","سلطان البريك","طارق سلمان","عاصم مادبو","عبدالعزيز حاتم","عيسى لاي","كريم بوضياف","محمد مناعي","نايف الحضرمي","هاشم علي","همام الأمين","يوسف عبدالرزاق"],
    gkSet:["صلاح زكريا","محمود أبوندى","مشعل برشم"],
    /* مراكز من قائمة قطر السابقة (نفس اللاعبين)؛ الجدد بلا مركز */
    pos:{"ايوب العلوي":"D","بوعلام خوخي":"D","همام الأمين":"D","عيسى لاي":"D","بيدرو ميغيل":"D","سلطان البريك":"D",
         "عاصم مادبو":"M","عبدالعزيز حاتم":"M","أحمد فتحي":"M","كريم بوضياف":"M","جاسم جابر":"M","محمد مناعي":"M",
         "أحمد الجانحي":"F","أحمد علاء":"F","أكرم عفيف":"F","المعز علي":"F","أديميلسون جونيور":"F","حسن الهيدوس":"F","تحسين محمد":"F","يوسف عبدالرزاق":"F"}},
  "الامارات":{f:"ae", g:"B", c:["#C8102E","#FFFFFF"], coach:"زلاتكو داليتش", faces:"ae",
    list:["خالد الظنحاني","زايد الزعابي","ماركوس ميلوني","فهد الظنحاني","حمد المقبالي","خالد عيسى","روبن فيليب","إيريك دي مينيزيس","لوكاس بيمنتا","ساشا إيفكوفيتش","علاء الدين زهير","خليفة الحمادي","حارب عبدالله",
          "نيكولاس خيمينيز","فابيو دي ليما","عصام فايز","مامادو كوليبالي","عبدالله حمد","لوان بيريرا","عثمان كامارا","سلطان عادل","جويلهرم دا سيلفا","ريتشارد أكونور","يوري سيزار","علي صالح","برونو دي أوليفيرا"],
    gkSet:["فهد الظنحاني","حمد المقبالي","خالد عيسى"]},
  "البحرين": {f:"bh", g:"B", c:["#CE1126","#FFFFFF"], coach:"دراغان تالاييتش", faces:"bh",
    list:["فنسنت إيمانويل","حمد الشمسان","عمر سالم","محمد الغرابلي","إبراهيم لطف الله","عبدالله الخلاصي","سيد مهدي باقر","وليد الحيام","أحمد ربيعه","أمين بنعدي","عمر صابر","علي مدن","عباس العصفور",
          "سيد ضياء سعيد","حسن الكراني","محمد عبدالقيوم","كميل الأسود","علي الدوسري","إبراهيم الختال","مهدي حميدان","حسين عبدالكريم","مهدي عبدالجبار","محمد الرميحي","هاشم سيد عيسى","محمد مرهون","جاسم الشيخ"],
    gkSet:["عمر سالم","محمد الغرابلي","إبراهيم لطف الله"]},
  "اليمن":   {f:"ye", g:"B", c:["#CE1126","#1A1A1A"], coach:"نور الدين ولد علي", faces:"ye",
    list:["اسامة مكرف","محمد أمان","أسامة حيدر","رامي الوسماني","هارون الزبيدي","حمزة الريمي","نادر سهل","عماد الجديمة","رضوان الحبيشي","طارق شهاب","عبدالواسع المطري","حمزة الصرابي","انيس المعاري",
          "نواف عبدالله","عادل عباس","أسامة عنبر","عمر منصور","عبدالمجيد صبارة","صقر خالد","ديماني ميلو","عمر الداحي","ممدوح بن عجاج","محمد هاشم","احمد ماهر","ناصر محمدوه","علي الدقين"],
    gkSet:["اسامة مكرف","محمد أمان","أسامة حيدر"]}
};
/* لون قميص المنتخب الأساسي (بحث 2026-09-21: السعودية أخضر، العراق أبيض، الإمارات أبيض، قطر عنابي، البحرين/عُمان/اليمن أحمر، الكويت أزرق) — خلفية صور اللاعبين */
const KIT = {"الكويت":"#0A57A8","السعودية":"#0C7A3D","العراق":"#EEF1F4","عمان":"#C8102E","قطر":"#7A1535","الامارات":"#EEF1F4","البحرين":"#CE1126","اليمن":"#CE1126"};
/* ألوان المنتخبات لتوهّج رأس صفحة المباراة (clubAccent): [لون القميص الأساسي، اللون الثانوي] — القميص الأبيض يأخذ لونه الثانوي */
const NAT_COLORS = {"الكويت":["#0A57A8","#FFFFFF"],"السعودية":["#0C7A3D","#FFFFFF"],"العراق":["#FFFFFF","#1F7A3A"],"عمان":["#C8102E","#1F7A3A"],
  "قطر":["#7A1535","#FFFFFF"],"الامارات":["#FFFFFF","#C8102E"],"البحرين":["#CE1126","#FFFFFF"],"اليمن":["#CE1126","#1A1A1A"]};
const kitInk = c => (KIT[c]==="#EEF1F4") ? "#0B1F3A" : "#FFFFFF";
const TEAMS = Object.keys(T);
G.TEAMS = TEAMS; G.T = T;
const GROUPS = [["A","المجموعة A"],["B","المجموعة B"]];
const flagUrl = (c, w) => `https://flagcdn.com/w${w||160}/${T[c]?T[c].f:"xx"}.png`;
G.flagUrl = flagUrl;

/* الكشوف الافتراضية: تُبنى من القوائم أعلاه؛ الكويت من قائمة الاتحاد في الموقع (KFA_SQUADS.first) */
const FACES = {};
/* الكويت: وجوه بقميص المنتخب من ملصق «قائمة الأزرق — معسكر الدوحة» (لا صور الأندية) */
FACES["الكويت"] = {"راكان السعيد": "assets/gulf/kw/1", "عبدالرحمن الفضلي": "assets/gulf/kw/2", "سعود الحوشان": "assets/gulf/kw/3", "خالد الرشيدي": "assets/gulf/kw/4", "فهد الهاجري": "assets/gulf/kw/5", "خالد صباح": "assets/gulf/kw/6", "يوسف الحقان": "assets/gulf/kw/7", "عبدالعزيز مهران": "assets/gulf/kw/8", "عبدالوهاب العوضي": "assets/gulf/kw/9", "راشد الدوسري": "assets/gulf/kw/10", "معاذ الظفيري": "assets/gulf/kw/11", "محسن فلاح": "assets/gulf/kw/12", "رضا هاني": "assets/gulf/kw/13", "خالد المرشد": "assets/gulf/kw/14", "جاسم المطر": "assets/gulf/kw/15", "أحمد الظفيري": "assets/gulf/kw/16", "عذبي شهاب": "assets/gulf/kw/17", "عبدالله القرزعي": "assets/gulf/kw/18", "ناصر فالح": "assets/gulf/kw/19", "مهدي دشتي": "assets/gulf/kw/20", "عيد الرشيدي": "assets/gulf/kw/21", "يوسف ماجد": "assets/gulf/kw/22", "محمد دحام": "assets/gulf/kw/23", "مبارك الفنيني": "assets/gulf/kw/24", "عبدالله العوضي": "assets/gulf/kw/25", "شبيب الخالدي": "assets/gulf/kw/26", "يوسف ناصر": "assets/gulf/kw/27"};
/* العراق: لاعبان أُضيفا من الإدارة (قوائم المنتخبات) — صورتاهما من منصور 2026-09-23 */
FACES["العراق"] = {"مصطفى قابيل": "assets/gulf/iq/27", "حسن عبدالكريم": "assets/gulf/iq/28"};
FACES["عمان"] = {"عبدالسلام الشكيلي": "assets/gulf/om/29"};
function defaultSquads(){
  const out = {};
  TEAMS.forEach(c=>{
    const t = T[c], L = [];
    if(t.kfa && typeof KFA_SQUADS==="object" && KFA_SQUADS.first){
      (KFA_SQUADS.first.gk||[]).forEach(n=>L.push({n, p:"GK"}));
      (KFA_SQUADS.first.out||[]).forEach(n=>L.push({n, p:""}));
    } else if(t.list){
      t.list.forEach((n,i)=>{ L.push({n, p:(t.gkSet||[]).includes(n)?"GK":((t.pos||{})[n]||"")}); if(t.faces) (FACES[c] ||= {})[n] = `assets/gulf/${t.faces}/${(t.faceFile||{})[n]||i+1}`; });
    } else {
      (t.gk||[]).forEach(n=>L.push({n, p:"GK"}));
      if(t.faceIdx){ [...(t.gk||[]),...(t.out||[])].forEach((n,i)=>{ if(t.faceIdx.includes(i+1)) (FACES[c] ||= {})[n] = `assets/gulf/${t.faces}/${i+1}`; }); }
      (t.d||[]).forEach(n=>L.push({n, p:"D"})); (t.m||[]).forEach(n=>L.push({n, p:"M"})); (t.fw||[]).forEach(n=>L.push({n, p:"F"}));
      (t.out||[]).forEach(n=>L.push({n, p:(t.pos||{})[n]||""}));
    }
    out[c] = L;
  });
  return out;
}
/* المباريات الأولية: مباريات الكويت الثابتة في EXT_FIXTURES (خليجي 27) — لا نضيف مباريات غير معلنة */
function defaultMatches(){
  const L = (typeof EXT_FIXTURES!=="undefined" ? EXT_FIXTURES : []).filter(e=>/خليجي 27/.test(e.t||""));
  return L.map((e,i)=>{ const pr = String(e.t).split(/\s*-\s*/); const rd = +((/الجولة\s*(\d+)/.exec(e.n||"")||[])[1]) || (i+1);
    return {n:i+1, round:rd, comp:COMP_G, date:e.d, time:e.time||"", venue:e.venue||"", home:pr[0], away:pr[1], note:"", ref:"", refs:{}, tv:"", status:"",
            add1:0, add2:0, hg:(e.hg!=null?+e.hg:0), ag:(e.ag!=null?+e.ag:0)}; }).filter(m=>T[m.home] && T[m.away]);
}
/* جدول دور المجموعات (النهار 2026-09-21؛ المواعيد بتوقيت الكويت = GMT+3) — يُضاف ما لم يكن موجوداً دون المساس بالموجود */
const KASC = "مدينة الملك عبدالله الرياضية، جدة", PAF = "استاد الأمير عبدالله الفيصل، جدة";
const FIXTURES = [
  [1,"2026-09-23","17:30","العراق","عمان",PAF], [1,"2026-09-23","21:00","السعودية","الكويت",KASC],
  [1,"2026-09-24","18:30","الامارات","اليمن",KASC], [1,"2026-09-24","21:00","قطر","البحرين",PAF],
  [2,"2026-09-26","18:55","الكويت","العراق",PAF], [2,"2026-09-26","21:00","عمان","السعودية",KASC],
  [2,"2026-09-27","18:55","اليمن","قطر",KASC], [2,"2026-09-27","21:00","البحرين","الامارات",PAF],
  [3,"2026-09-29","20:30","السعودية","العراق",KASC], [3,"2026-09-29","20:30","عمان","الكويت",PAF],
  [3,"2026-09-30","20:30","الامارات","قطر",KASC], [3,"2026-09-30","20:30","البحرين","اليمن",PAF]
];
/* القنوات الناقلة لكل مباريات البطولة (ملصق «القنوات الناقلة لبطولة خليجي 27»، منصور 2026-09-23) */
const TV_G = "الكويت الرياضية · الكأس · شاشا · أبوظبي الرياضية · عمان الرياضية";
/* طواقم التحكيم: من الإدارة وحدها (تبويب «حكام الخليج») — تُحفظ في وثيقة البطولة، لا في الدوري (منصور 2026-09-23) */
/* القناة والحكم لبطاقات «المباريات القادمة» (index.html): من سجل البطولة، وقبل وصوله القناة وحدها من الجدول الثابت */
G.extra = (d, h, a) => { const same = (x,y) => (x===h&&y===a)||(x===a&&y===h);
  const m = DATA && DATA.matches.find(x=>x.date===d && same(x.home,x.away));
  if(m){ /* st: حالة المباراة كما في صفحتها (لم تبدأ/جارية/انتهت)، والنتيجة بترتيب البطاقة (h أولاً) */
    const st = withGulf(()=>{ if(m.status==="ft") return "done"; if(["h1","ht","h2"].includes(m.status)) return "live";
      const up = typeof isUpcoming==="function" ? isUpcoming(m) : true; if(up) return "soon"; return (typeof isLive==="function" && isLive(m)) ? "live" : "done"; });
    const same = m.home===h;
    return {tv:m.tv||"", ref:m.ref||"", v:(m.refs||{}).var||"", k:(typeof matchKey==="function" ? matchKey(m) : ""), st, ph:m.status||"", hg:same?+m.hg:+m.ag, ag:same?+m.ag:+m.hg}; }
  return FIXTURES.some(x=>x[1]===d && same(x[3],x[4])) ? {tv:TV_G, ref:"", v:""} : null; };
function addFixtures(d){
  FIXTURES.forEach(([r,dt,tm,h,a,v])=>{
    if(d.matches.some(m=>+m.round===r && ((m.home===h&&m.away===a)||(m.home===a&&m.away===h)))) return;
    d.matches.push({n:d.matches.length+1, round:r, comp:COMP_G, date:dt, time:tm, venue:v, home:h, away:a, note:"", ref:"", refs:{}, tv:"", status:"", add1:0, add2:0, hg:0, ag:0});
  });
}
function blankDoc(){ return {season:NAME, squadsVer:SQUADS_VER, matches:defaultMatches(), goals:[], cards:[], pens:[], lineups:[], subs:[], shapes:[], mev:[], squads:defaultSquads(), updated:""}; }
const SQUADS_VER = 2;   /* ارفعه عند تحديث القوائم الافتراضية (يستبدل المحفوظ) */
let DATA = null;
G.data = () => DATA;
function normalize(d){
  d = d || blankDoc();
  ["matches","goals","cards","pens","lineups","subs","shapes","mev"].forEach(k=>{ if(!Array.isArray(d[k])) d[k]=[]; });
  if(!d.squads || !Object.keys(d.squads).length || (d.squadsVer||1) < SQUADS_VER){   /* القوائم المعدّلة من الإدارة تبقى كما هي */
    const ed = d.squadsEdited || {}, keep = d.squads || {}, def = defaultSquads();
    d.squads = {}; TEAMS.forEach(c=>{ d.squads[c] = (ed[c] && keep[c]) ? keep[c] : def[c]; }); d.squadsVer = SQUADS_VER; }
  else { defaultSquads(); TEAMS.forEach(c=>{ if(!d.squads[c]) d.squads[c] = defaultSquads()[c]; }); }
  addFixtures(d);
  d.matches.forEach(m=>{ m.comp = COMP_G; Object.defineProperty(m, "__gulf", {value:true, enumerable:false, configurable:true});
    /* ما يُحفظ من الإدارة يتقدّم، عدا «كويت سبورت» وحدها (أُدخلت قبل ملصق القنوات، وهي نفسها «الكويت الرياضية» ضمن القائمة) */
    const tv = String(m.tv||"").trim(); if(!tv || tv==="كويت سبورت") m.tv = TV_G;
    if(!m.refs || typeof m.refs!=="object") m.refs = {}; });
  if(!Array.isArray(d.refpool)) d.refpool = [];                   /* قائمة حكام البطولة — مستقلة عن ALL.refpool (الدوري) */
  return d;
}

/* ───────────── السياق المعزول ───────────── */
let depth = 0;
const GLOBALS = () => ({ALL, SQUADS, CLUBS, LOGOS, COMP, MATCHES, GOALS, PENS, CARDS, LSCALE, pc:photoCut, nf:natFlag, cc:window.CLUB_COLORS});
function withGulf(fn){
  if(!DATA) DATA = normalize(null);
  if(depth){ return fn(); }
  const saved = GLOBALS();
  depth++;
  try{
    ALL = DATA; SQUADS = DATA.squads; CLUBS = TEAMS.slice(); COMP = "الكل";
    const L = {}; TEAMS.forEach(c=>L[c]=flagUrl(c)); LOGOS = L; LSCALE = {};
    photoCut = (name, club) => { if(!name) return null;
      const e = (DATA.squads[club]||[]).find(x=>x && x.n===name); if(e && e.f) return e.f;   /* الصورة المحفوظة مع اللاعب أولاً — للكويت أيضاً */
      if(club==="الكويت" && !(FACES[club]||{})[name]){ const lc = leagueClubOf(saved, name); return lc ? saved.pc(name, lc) : null; }
      return (FACES[club]||{})[name] || null; };
    natFlag = () => ""; window.CLUB_COLORS = NAT_COLORS;
    MATCHES = DATA.matches.slice(); GOALS = DATA.goals.slice(); PENS = DATA.pens.slice(); CARDS = DATA.cards.slice();
    return fn();
  } finally {
    ({ALL, SQUADS, CLUBS, LOGOS, COMP, MATCHES, GOALS, PENS, CARDS, LSCALE} = saved);
    photoCut = saved.pc; natFlag = saved.nf; window.CLUB_COLORS = saved.cc;
    depth--;
  }
}
G.withGulf = withGulf;
function leagueClubOf(saved, name){
  for(const c of Object.keys(saved.SQUADS||{})) if((saved.SQUADS[c]||[]).some(x=>(typeof x==="string"?x:x&&x.n)===name)) return c;
  return null;
}

/* ───────────── التخزين (وثيقة مستقلة) ───────────── */
const store = {
  watch(cb){
    if(TEST){ const r=()=>{ try{ const s=localStorage.getItem("mfgulf"); cb(s?JSON.parse(s):null); }catch(e){ cb(null); } }; r(); window.addEventListener("storage", e=>{ if(e.key==="mfgulf") r(); }); return; }
    const go = () => { if(typeof fbDb==="undefined" || !fbDb){ setTimeout(go, 400); return; }
      fbDb.collection("seasons").doc(DOC_ID).onSnapshot(s=>cb(s.exists ? s.data() : null), ()=>cb(undefined)); };
    go();
  },
  async save(d){
    const obj = JSON.parse(JSON.stringify(d)); obj.updated = new Date().toISOString(); obj.updatedBy = (typeof FBUSER!=="undefined" && FBUSER && FBUSER.email) || "";
    if(TEST){ localStorage.setItem("mfgulf", JSON.stringify(obj)); return true; }
    if(typeof fbDb==="undefined" || !fbDb) throw new Error("السحابة غير متاحة");
    await fbDb.collection("seasons").doc(DOC_ID).set(obj); return true;
  }
};
G.save = async () => { await store.save(DATA); };
let PENDING = null;
const EDIT_OPEN = () => typeof EDIT!=="undefined" && EDIT && EDIT.gulf;
let firstLoad = true;
setTimeout(()=>store.watch(d=>{
  if(d===undefined) return;
  if(EDIT_OPEN()) { PENDING = d; return; }         /* لا نقاطع محرّراً مفتوحاً على مباراة من البطولة */
  DATA = normalize(d); firstLoad = false; repaint();
  /* بطاقات «المباريات القادمة»/«خليجي 27» تقرأ الحكم والقناة من هنا — نعيد رسمها متى وصلت البيانات */
  try{ if(document.querySelector("#v-matches.on") && typeof renderMatches==="function" && (MXC==="upcoming" || MXC==="gulf27")) renderMatches(); }catch(e){}
}), 0);

/* ───────────── الحسابات (من بيانات البطولة وحدها) ───────────── */
/* isUpcoming يقرأ الأهداف والتشكيلات من السياق الحالي — داخل withGulf حتى تُعدّ مباراة 0-0 مُدخلة تشكيلتها «مُقامة» (لا من بيانات الدوري) */
const isUp = m => typeof isUpcoming==="function" ? withGulf(()=>isUpcoming(m)) : !(m.hg||m.ag);
function played(){ return (DATA?DATA.matches:[]).filter(m=>!isUp(m) || m.status==="ft" || (m.hg+m.ag)>0); }
function table(g){
  const rows = {}; TEAMS.filter(c=>T[c].g===g).forEach(c=>rows[c]={c, p:0,w:0,d:0,l:0,gf:0,ga:0,pts:0});
  played().forEach(m=>{ if(!rows[m.home]||!rows[m.away]||T[m.home].g!==g||T[m.away].g!==g) return; if(m.round>3) return;
    const h=rows[m.home], a=rows[m.away]; h.p++; a.p++; h.gf+=+m.hg; h.ga+=+m.ag; a.gf+=+m.ag; a.ga+=+m.hg;
    if(m.hg>m.ag){ h.w++; a.l++; h.pts+=3; } else if(m.hg<m.ag){ a.w++; h.l++; a.pts+=3; } else { h.d++; a.d++; h.pts++; a.pts++; } });
  return Object.values(rows).sort((x,y)=>y.pts-x.pts || (y.gf-y.ga)-(x.gf-x.ga) || y.gf-x.gf || x.c.localeCompare(y.c,"ar"));
}
function leaders(){
  const g = {}, a = {}, y = {}, r = {};
  (DATA?DATA.goals:[]).forEach(x=>{ if(x.bp==="هدف عكسي") return; const k=x.p+"|"+x.sc; (g[k] ||= {n:x.p,c:x.sc,v:0}).v++; if(x.a){ const k2=x.a+"|"+x.sc; (a[k2] ||= {n:x.a,c:x.sc,v:0}).v++; } });
  (DATA?DATA.cards:[]).forEach(x=>{ const k=x.p+"|"+x.club; if(/طرد|ثان/.test(x.type||"")) (r[k] ||= {n:x.p,c:x.club,v:0}).v++; if(/إنذار/.test(x.type||"")) (y[k] ||= {n:x.p,c:x.club,v:0}).v++; });
  const s = o => Object.values(o).sort((p,q)=>q.v-p.v || p.n.localeCompare(q.n,"ar"));
  return {g:s(g), a:s(a), y:s(y), r:s(r)};
}

/* ───────────── تبويب «الإحصاءات»: من سجل البطولة وحده (الإدخال اليدوي) ───────────── */
function statsTabHTML(){
  const L = leaders(), played = played_();
  const teamRows = TEAMS.map(c=>{ const ms = played.filter(m=>m.home===c||m.away===c); let gf=0, ga=0, y=0, r=0, cs=0;
    ms.forEach(m=>{ const f = m.home===c ? +m.hg : +m.ag, a = m.home===c ? +m.ag : +m.hg; gf+=f; ga+=a; if(!a) cs++; });
    (DATA.cards||[]).forEach(x=>{ if(x.club!==c) return; if(/طرد|ثان/.test(x.type||"")) r++; else if(/إنذار/.test(x.type||"")) y++; });
    return {c, p:ms.length, gf, ga, cs, y, r}; }).filter(x=>x.p).sort((a,b)=>b.gf-a.gf || a.ga-b.ga);
  const teamTbl = teamRows.length ? `<section class="gc-card"><h3>الفرق</h3><div class="gc-tw"><table class="gc-tbl"><thead><tr><th class="tl">المنتخب</th><th>لعب</th><th>له</th><th>عليه</th><th>شباك نظيفة</th><th>إنذار</th><th>طرد</th></tr></thead>
    <tbody>${teamRows.map(x=>`<tr><td class="tl"><span class="gc-tn">${flagImg(x.c)}${H(x.c)}</span></td><td>${x.p}</td><td>${x.gf}</td><td>${x.ga}</td><td>${x.cs}</td><td>${x.y}</td><td>${x.r}</td></tr>`).join("")}</tbody></table></div></section>`
    : `<section class="gc-card"><h3>الفرق</h3><div class="gc-empty">لم تُلعب مباريات بعد.</div></section>`;
  /* «من اللعب الفعلي» أُزيل (منصور 2026-09-23): البطولة كلها بالإدخال اليدوي */
  return teamTbl + leadersHTML() + `<section class="gc-card"><h3>الحكام</h3>${refTableHTML(true) || `<div class="gc-empty">لم يُدخل حكم أي مباراة مُقامة بعد.</div>`}</section>`;
}
const played_ = () => played();
/* الحكام (منصور 2026-09-23): كل حكم ساحة على كل مبارياته المُقامة في البطولة — المباريات والإنذارات والطرد (الإنذار الثاني طرد).
   من سجل البطولة وحده (DATA)، فيتطابق الرقم في «الإحصاءات» و«التحليل». */
function refStats(){
  const rf = {};
  played().forEach(m=>{ const n = String(m.ref||"").trim(); if(!n || n==="لا يوجد") return; const e = rf[n] ||= {n, m:0, y:0, r:0, games:[]};
    const cs = (DATA.cards||[]).filter(x=>+x.r===+m.round && (x.club===m.home||x.club===m.away));
    e.m++; e.y += cs.filter(x=>!isRed(x.type)).length; e.r += cs.filter(x=>isRed(x.type)).length; e.games.push(`${m.home} × ${m.away}`); });
  return Object.values(rf).sort((a,b)=>b.m-a.m || (b.y+b.r)-(a.y+a.r) || a.n.localeCompare(b.n,"ar"));
}
function refTableHTML(withGames){
  const RF = refStats(); if(!RF.length) return "";
  return `<div class="gc-tw"><table class="gc-tbl"><thead><tr><th class="tl">الحكم</th><th>مباريات</th><th>إنذار</th><th>طرد</th><th>بطاقات/مباراة</th></tr></thead>
    <tbody>${RF.map(x=>`<tr><td class="tl"><b>${H(x.n)}</b>${withGames?`<small class="gc-rg">${x.games.map(H).join("، ")}</small>`:""}</td><td>${x.m}</td><td>${x.y}</td><td>${x.r}</td><td>${((x.y+x.r)/x.m).toFixed(1)}</td></tr>`).join("")}</tbody></table></div>`;
}

/* ───────────── تبويب «التحليل» (منصور 2026-09-23) ─────────────
   البطولة كلها بالإدخال اليدوي (بلا لعب فعلي)، فالتحليل كله من سجل البطولة اليدوي فقط:
   1) أقسام تبويب التحليل في الموقع نفسها (متوسط التقييم، فترات الأهداف، الخريطة الحرارية، الجزاءات، أثر الهدف الأول،
      طريقة/منطقة/وضعية التسجيل) تُرسم بدوال الموقع داخل withGulf فتقرأ بيانات البطولة وحدها.
   2) أقسام جديدة تُشتق من الحقول اليدوية نفسها (التشكيلة، التبديلات، البطاقات، الحكم، الخطة) — لا أرقام من البث. */
let GHM = "الكل";                                   /* فلتر الخريطة الحرارية (منفصل عن فلتر الدوري HM_LEAGUE) */
const noProfile = s => s.replace(/ data-player=/g, " data-gplayer=");   /* لا ملفات لاعبين في قسم البطولة */
function anList(rows, val){
  return `<div class="gc-lead">${rows.map((x,i)=>`<div class="gc-lr" data-gplayer="${H(x.n)}" data-gclub="${H(x.c)}">
    <span class="rk">${i+1}</span><span class="ph" style="background:${KIT[x.c]||"transparent"}">${face(x.c,x.n)}</span>
    <span class="nm"><b>${H(x.n)}</b><small>${flagImg(x.c,"sm")}${H(x.c)}${x.sub?` · ${H(x.sub)}`:""}</small></span><span class="v">${val(x)}</span></div>`).join("")}</div>`;
}
function gulfExtraHTML(){
  const ms = playedMatches(), first = PERIODS.slice(0,4), late = ["76-90","90+"];
  const sec = (t, hint, body) => `<section class="gc-card"><h3>${t}</h3>${hint?`<p class="gc-hint">${hint}</p>`:""}${body}</section>`;
  const nil = t => `<div class="gc-empty">${t}</div>`;
  let out = "";   /* بلا عنوان فاصل (منصور 2026-09-23) — الأقسام تكمل تحليل البطولة مباشرة */

  /* لا متوسطات تقييم في كأس الخليج (منصور 2026-09-23) — لا «تقييم المنتخبات» ولا «أعلى متوسط تقييم» */

  /* أفضل لاعب في كل مباراة: الأعلى تقييماً من الفريقين */
  /* أفضل لاعب: اختيار الإدارة (m.motm) أولاً، وإلا الأعلى تقييماً — بلا رقم التقييم (منصور 2026-09-23) */
  const motm = ms.filter(m=>matchOver(m)).map(m=>{ const sub = `${m.home} ${+m.hg}-${+m.ag} ${m.away}`;
    if(m.motm && m.motm.n) return {n:m.motm.n, c:m.motm.c, sub};
    const b = [...matchRatingsRaw(m,m.home), ...matchRatingsRaw(m,m.away)].sort((a,b)=>b.r.v-a.r.v)[0];
    return b ? {n:b.n, c:b.c, sub} : null; }).filter(Boolean);
  out += sec("أفضل لاعب في كل مباراة", "", motm.length ? anList(motm, ()=>"") : nil("يظهر بعد انتهاء أول مباراة."));

  /* الأكثر دقائق لعب: من التشكيلة الأساسية والتبديلات والطرد */
  /* الدقائق بعد انتهاء المباراة فقط (منصور 2026-09-23) — أثناء اللعب لا تُحسب */
  const mins = {}; ms.filter(m=>matchOver(m)).forEach(m=>[m.home,m.away].forEach(c=>{ const men = new Set(xiNames(m.round, compOf(m), c));
    matchSubs(m).filter(s=>s.club===c && s.in).forEach(s=>men.add(s.in));
    men.forEach(n=>{ const v = playerMatchMinutes(m,c,n); if(v>0){ const e = mins[n+"|"+c] ||= {n, c, v:0, apps:0}; e.v += v; e.apps++; } }); }));
  const MN = Object.values(mins).sort((a,b)=>b.v-a.v || a.n.localeCompare(b.n,"ar")).slice(0,15).map(x=>({...x, sub:mw(x.apps)}));
  out += sec("الأكثر دقائق لعب", "", MN.length ? anList(MN, x=>`${x.v}<small class="gc-u">د</small>`) : nil("يظهر بعد انتهاء أول مباراة."));

  /* أهداف البدلاء */
  const sg = GOALS.filter(g=>!isOG(g)).map(g=>{ const m = ms.find(x=>x.round===g.r && (x.home===g.sc||x.away===g.sc)); if(!m) return null;
    const s = matchSubs(m).find(s=>s.club===g.sc && s.in===g.p); return s ? {n:g.p, c:g.sc, v:minLabel(g), sub:`دخل ${s.m}′ · ${m.home} - ${m.away}`} : null; }).filter(Boolean);
  out += sec("أهداف البدلاء", "أهداف سجّلها لاعبون دخلوا من دكة البدلاء.", sg.length ? anList(sg, x=>`<bdi dir="ltr">${H(x.v)}</bdi>`) : nil("لا أهداف من البدلاء بعد."));

  /* توقيت أهداف المنتخبات وأسلوبها */
  const tt = TEAMS.map(c=>{ const f = GOALS.filter(g=>g.sc===c), a = GOALS.filter(g=>g.cd===c);
    return {c, f:f.length, a:a.length, h1:f.filter(g=>first.includes(period(g))).length, h2:f.filter(g=>!first.includes(period(g))).length,
      lt:f.filter(g=>late.includes(period(g))).length, lta:a.filter(g=>late.includes(period(g))).length,
      sp:f.filter(g=>isSetPiece(g)).length, hd:f.filter(g=>isHeader(g)).length}; }).filter(x=>x.f||x.a).sort((a,b)=>b.f-a.f || a.a-b.a);
  out += sec("توقيت أهداف المنتخبات وأسلوبها", "القاتلة = بعد الدقيقة 75. الثابتة = ركنية، ركلة حرة، ركلة جزاء، رمية.", tt.length
    ? `<div class="gc-tw"><table class="gc-tbl"><thead><tr><th class="tl">المنتخب</th><th>له</th><th>ش1</th><th>ش2</th><th>قاتلة له</th><th>قاتلة عليه</th><th>ثابتة</th><th>رأسية</th></tr></thead>
      <tbody>${tt.map(x=>`<tr><td class="tl"><span class="gc-tn">${flagImg(x.c)}${H(x.c)}</span></td><td><b>${x.f}</b></td><td>${x.h1}</td><td>${x.h2}</td><td>${x.lt}</td><td>${x.lta}</td><td>${x.sp}</td><td>${x.hd}</td></tr>`).join("")}</tbody></table></div>`
    : nil("لا أهداف مسجّلة بعد."));

  /* البطاقات على فترات المباراة */
  const cp = PERIODS.map(p=>({p, y:CARDS.filter(x=>period({m:+x.m||0})===p && !isRed(x.type)).length, r:CARDS.filter(x=>period({m:+x.m||0})===p && isRed(x.type)).length}));
  const cmx = Math.max(1, ...cp.map(x=>x.y+x.r));
  out += sec("البطاقات على فترات المباراة", "", CARDS.length
    ? `<div class="gc-cp">${cp.map(x=>`<div class="gc-cp-c"><span class="v">${x.y+x.r||""}</span><span class="bar"><i class="r" style="height:${(x.r/cmx*100).toFixed(1)}%"></i><i class="y" style="height:${(x.y/cmx*100).toFixed(1)}%"></i></span><span class="p"><bdi dir="ltr">${x.p}</bdi></span></div>`).join("")}</div>
       <div class="gc-cp-lg"><span><i class="y"></i>إنذار · ${cp.reduce((a,x)=>a+x.y,0)}</span><span><i class="r"></i>طرد · ${cp.reduce((a,x)=>a+x.r,0)}</span></div>`
    : nil("لا بطاقات مسجّلة بعد."));

  /* الحكام */
  out += sec("الحكام", "حكم الساحة كما أُدخل في المباراة، وبطاقات مبارياته.", refTableHTML() || nil("لم يُدخل حكم أي مباراة بعد."));

  /* الخطط المستخدمة */
  /* المباريات المُقامة فقط (الإدارة قد تُدخل الخطة قبل المباراة)، وصيغة خطة صحيحة، ومرة واحدة لكل منتخب في الجولة */
  const sh = {}, seenSh = new Set();
  (ALL.shapes||[]).forEach(x=>{ const f = String(x.f||"").trim(); if(!/^\d(-\d){2,4}$/.test(f) || !T[x.club] || seenSh.has(x.r+"|"+x.club)) return;
    if(!ms.some(m=>m.round===x.r && (m.home===x.club||m.away===x.club))) return;
    seenSh.add(x.r+"|"+x.club); (sh[x.club] ||= {})[f] = (sh[x.club][f]||0) + 1; });
  const SH = Object.keys(sh).sort((a,b)=>a.localeCompare(b,"ar"));
  out += sec("الخطط المستخدمة", "", SH.length
    ? `<div class="gc-tw"><table class="gc-tbl"><thead><tr><th class="tl">المنتخب</th><th class="tl">الخطة (عدد المباريات)</th></tr></thead>
      <tbody>${SH.map(c=>`<tr><td class="tl"><span class="gc-tn">${flagImg(c)}${H(c)}</span></td><td class="tl">${Object.entries(sh[c]).sort((a,b)=>b[1]-a[1]).map(([f,n])=>`<bdi dir="ltr">${H(f)}</bdi> (${n})`).join("، ")}</td></tr>`).join("")}</tbody></table></div>`
    : nil("لم تُحدَّد خطة أي منتخب بعد."));
  return out;
}
function analysisTabHTML(){
  PASS_MEMO.m = null;                                 /* مفاتيح ذاكرة التمرير تحمل COMP «الكل» مثل الدوري — لا نخلطها */
  try{ return withGulf(()=>{
    if(!playedMatches().length) return `<section class="gc-card"><h3>التحليل</h3><div class="gc-empty">يظهر التحليل بعد إدخال أول مباراة يدوياً من الإدارة.</div></section>`;
    const cats = [...new Set(GOALS.map(g=>g.det))].map(d=>({l:d, n:GOALS.filter(g=>g.det===d).length})).sort((a,b)=>b.n-a.n);
    const zones = [...new Set(GOALS.map(g=>g.zone))].map(z=>({l:z, n:GOALS.filter(g=>g.zone===z).length})).sort((a,b)=>b.n-a.n);
    const goals = GOALS.length;
    return noProfile(`<div class="an gc-an">
      <h2 class="sec">توزيع الأهداف على فترات المباراة</h2>
      ${anPeriods()}
      ${goals ? `<div class="an-duo">
        <section class="an-heat-sec"><h2 class="sec">الخريطة الحرارية لأماكن التسجيل</h2>
          <p class="hint">من أين سُجّلت أهداف البطولة؟ بدّل بين اللعب المفتوح والكرات الثابتة.</p><div class="an-card" id="gHeat"></div></section>
        <div class="an-side">
          <section><h2 class="sec">ركلات الجزاء — خريطة المرمى</h2>${anPens()}</section>
          <section><h2 class="sec">أثر الهدف الأول</h2>${anFirstGoal()}</section>
        </div></div>
      <h2 class="sec">طريقة التسجيل</h2><div class="an-card">${anRank(cats,"فئة")}</div>
      <h2 class="sec">منطقة التسجيل</h2><div class="an-card">${anRank(zones,"منطقة")}</div>
      <h2 class="sec">وضعية التسجيل</h2>${anBody()}` : `<section><h2 class="sec">ركلات الجزاء — خريطة المرمى</h2>${anPens()}</section>`}
      ${gulfExtraHTML()}
    </div>`); }); }
  finally{ PASS_MEMO.m = null; }
}
function gulfHeat(){
  const el = document.getElementById("gHeat"); if(!el) return;
  withGulf(()=>{ const list = filterCat(GOALS, GHM);
    el.innerHTML = `<div class="segbar">${CATS.map(c=>`<button class="seg" data-c="${c}" aria-pressed="${c===GHM}">${c}</button>`).join("")}</div>
      ${heatStats(list)}${anHeatSVG(list)}${anZoneRows(list)}
      <p class="hint" style="margin-top:10px">${list.length} هدفاً معروضاً · الاتجاه من أسفل إلى أعلى نحو المرمى · اليسار واليمين من زاوية المهاجم.</p>`; });
  el.innerHTML = noProfile(el.innerHTML);
  el.querySelectorAll(".seg").forEach(b=>b.onclick=()=>{ GHM = b.dataset.c; gulfHeat(); });
}

/* ───────────── الواجهة العامة: تبويب «كأس الخليج» ───────────── */
let VIEW = {tab:"teams", team:"الكويت"};
/* ألقاب كأس الخليج قبل النسخة 27 (26 نسخة: 1970–2024/25) */
const TITLES = {"الكويت":[1970,1972,1974,1976,1982,1986,1990,1996,1998,2010], "العراق":[1979,1984,1988,2023], "السعودية":[1994,2002,2003], "قطر":[1992,2004,2014],
  "عمان":[2009,2017], "الامارات":[2007,2013], "البحرين":[2019,2024], "اليمن":[]};
const TITLE_NOTE = {"الكويت":"صاحب الرقم القياسي في عدد الألقاب", "السعودية":"مستضيف النسخة 27", "البحرين":"حامل لقب النسخة 26", "اليمن":"لم يحرز اللقب بعد"};
const flagImg = (c, cls) => `<img class="gc-flag ${cls||""}" src="${flagUrl(c,80)}" srcset="${flagUrl(c,160)} 2x" alt="" loading="lazy">`;
function face(c, n){
  const p = withGulf(()=>photoCut(n, c));
  return p ? `<img src="${H(p)}_f.webp?v=31" alt="" loading="lazy" decoding="async">` : `<span class="gc-ini" style="color:${kitInk(c)}">${H(String(n).trim().split(/\s+/).slice(0,2).map(w=>w[0]||"").join(""))}</span>`;
}
function matchCard(m){
  const up = isUp(m) && !(m.hg+m.ag) && m.status!=="ft", L = window.LIVE && LIVE.liveOf ? LIVE.liveOf(m) : null;
  const live = L && LIVE.isLivePh(L.phase);
  const hg = L ? L.hg : m.hg, ag = L ? L.ag : m.ag;
  const d = m.date ? new Date(m.date+"T12:00:00") : null;
  const dl = d && !isNaN(d) ? `${d.getDate()} ${typeof AR_MON!=="undefined"?AR_MON[d.getMonth()]:""}` : "";
  return `<button type="button" class="gc-m${live?" live":""}" data-gopen="${H(LIVE?LIVE.keyOf(m):"")}">
    <span class="gc-m-meta">${m.round<=3?`الجولة ${m.round}`:m.round===4?"نصف النهائي":"النهائي"}${dl?` · ${dl}`:""}${m.time&&up?` · <bdi dir="ltr">${H(m.time)}</bdi>`:""}</span>
    <span class="gc-m-t">${flagImg(m.home)}<b>${H(m.home)}</b></span>
    <span class="gc-m-s">${up&&!live?`<em>${m.time?H(m.time):"—"}</em>`:`<b>${hg}</b><i>-</i><b>${ag}</b>`}${live?`<small class="lv"><i class="lv-dot"></i>مباشر</small>`:""}</span>
    <span class="gc-m-t a"><b>${H(m.away)}</b>${flagImg(m.away)}</span>
    ${m.venue?`<span class="gc-m-v">${H(m.venue)}</span>`:""}
    ${(()=>{ const v = (m.refs||{}).var, ico = k => typeof refRoleIco==="function" ? refRoleIco(k,"sm") : "";   /* الحكم والقناة (منصور 2026-09-23) */
      return (m.ref||v ? `<span class="gc-m-x gc-m-rf">${m.ref?`<span>${ico("ref")}<bdi>${H(m.ref)}</bdi></span>`:""}${v&&v!=="لا يوجد"?`<span>${ico("var")}<bdi>${H(v)}</bdi></span>`:""}</span>` : "")
        + (m.tv ? `<span class="gc-m-x gc-m-tv">${typeof TV_ICO!=="undefined"?TV_ICO:""}<bdi>${H(m.tv)}</bdi></span>` : ""); })()}</button>`;
}
function groupsHTML(){
  return GROUPS.map(([g,t])=>{ const rows = table(g), ms = (DATA.matches||[]).filter(m=>T[m.home]&&T[m.home].g===g&&m.round<=3).sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.time).localeCompare(String(b.time)));
    return `<section class="gc-card"><h3>${t}</h3>
      <div class="gc-tw"><table class="gc-tbl"><thead><tr><th>#</th><th class="tl">المنتخب</th><th>لعب</th><th>ف</th><th>ت</th><th>خ</th><th>له</th><th>عليه</th><th>+/-</th><th>ن</th></tr></thead>
      <tbody>${rows.map((r,i)=>`<tr class="${i<2?"q":""}" data-gteam="${H(r.c)}"><td>${i+1}</td><td class="tl"><span class="gc-tn">${flagImg(r.c)}${H(r.c)}</span></td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gf}</td><td>${r.ga}</td><td dir="ltr">${r.gf-r.ga>0?"+":""}${r.gf-r.ga}</td><td><b>${r.pts}</b></td></tr>`).join("")}</tbody></table></div>
      <p class="gc-hint">يتأهل الأول والثاني إلى نصف النهائي.</p>
      <div class="gc-ms">${ms.length?ms.map(matchCard).join(""):`<div class="gc-empty">لم تُضف مباريات هذه المجموعة بعد.</div>`}</div></section>`; }).join("")
    + (()=>{ const ko=(DATA.matches||[]).filter(m=>m.round>3); return ko.length?`<section class="gc-card"><h3>الأدوار الإقصائية</h3><div class="gc-ms">${ko.map(matchCard).join("")}</div></section>`:""; })();
}
function leadersHTML(){
  const L = leaders();
  const blk = (t, arr, unit) => `<section class="gc-card"><h3>${t}</h3>${arr.length?`<div class="gc-lead">${arr.slice(0,15).map((x,i)=>`<div class="gc-lr" data-gplayer="${H(x.n)}" data-gclub="${H(x.c)}">
      <span class="rk">${i+1}</span><span class="ph" style="background:${KIT[x.c]||"transparent"}">${face(x.c,x.n)}</span><span class="nm"><b>${H(x.n)}</b><small>${flagImg(x.c,"sm")}${H(x.c)}</small></span><span class="v">${x.v}</span></div>`).join("")}</div>`:`<div class="gc-empty">لا ${unit} مسجّلة بعد.</div>`}</section>`;
  return blk("الهدافون", L.g, "أهداف") + blk("صناعة الأهداف", L.a, "تمريرات حاسمة") + blk("الإنذارات", L.y, "إنذارات") + blk("الطرد", L.r, "بطاقات حمراء");
}
/* «المجموعة A» داخل bdi: الحرف اللاتيني مع الرقم بعده («A · 27») كانا يقلبان ترتيب السطر (منصور 2026-09-23) */
const grpLbl = g => `<bdi>المجموعة <span dir="ltr">${g==="A"?"A":"B"}</span></bdi>`;
function profilesHTML(){
  const L = TEAMS.slice().sort((a,b)=>TITLES[b].length-TITLES[a].length || a.localeCompare(b,"ar"));
  return `<div class="gc-prof">${L.map(c=>{ const y = TITLES[c]||[];
    return `<button type="button" class="gc-pc" style="--tc:${T[c].c[0]}" data-gsq="${H(c)}">
      <span class="gc-pc-hd">${flagImg(c,"lg")}<span><b>${H(c)}</b><small>${grpLbl(T[c].g)}${T[c].coach?` · <bdi>${H(T[c].coach)}</bdi>`:""}</small></span></span>
      <span class="gc-pc-n"><strong>${y.length}</strong><i>${y.length===1?"لقب":y.length===2?"لقبان":y.length>=3&&y.length<=10?"ألقاب":"لقباً"}</i></span>
      ${y.length?`<span class="gc-pc-y">${y.map(v=>`<em>${v}</em>`).join("")}</span>`:""}
      ${TITLE_NOTE[c]?`<span class="gc-pc-note">${H(TITLE_NOTE[c])}</span>`:""}
      <span class="gc-pc-go">قائمة المنتخب ←</span></button>`; }).join("")}</div>`;
}
function teamsHTML(){
  const c = VIEW.team, t = T[c], sq = (DATA.squads[c]||[]);
  const groupsP = [["GK","حراسة المرمى"],["D","الدفاع"],["M","الوسط"],["F","الهجوم"],["","اللاعبون"]];
  const posG = p => { p = String(p||"").toUpperCase(); return p==="GK"||p==="G" ? "GK" : (typeof POS_MAIN==="object" && POS_MAIN[p]) || ""; };
  return `<div class="gc-teams">${TEAMS.map(x=>`<button type="button" class="gc-tb${x===c?" on":""}" data-gteam="${H(x)}">${flagImg(x)}<span>${H(x)}</span></button>`).join("")}</div>
    <section class="gc-card gc-sq" style="--tc:${t.c[0]}">
      <div class="gc-sq-hd">${flagImg(c,"lg")}<div><h3>منتخب ${H(c)}</h3><span>${grpLbl(t.g)} · <bdi>${sq.length} لاعباً</bdi>${t.coach?` · <bdi>المدرب: ${H(t.coach)}</bdi>`:""}</span></div></div>
      ${sq.length?groupsP.map(([k,lbl])=>{ const L = sq.filter(x=>posG(x.p)===k || (k==="" && !["GK","D","M","F"].includes(posG(x.p)))); if(!L.length) return "";
        return `<div class="gc-sq-g">${lbl}</div><div class="gc-sq-grid">${L.map(x=>`<div class="gc-pl" data-gplayer="${H(x.n)}" data-gclub="${H(c)}"><span class="ph" style="background:${KIT[c]}">${face(c,x.n)}</span><b>${H(x.n)}</b>${x.s?`<em>${x.s}</em>`:""}</div>`).join("")}</div>`; }).join("")
        :`<div class="gc-empty">لم تُضف قائمة هذا المنتخب بعد.</div>`}
    </section>`;
}
function render(){
  const v = document.getElementById("v-gulf"); if(!v) return;
  if(!DATA) DATA = normalize(null);
  const tabs = [["teams","المنتخبات"],["squad","قائمة الفريق"],["matches","المباريات"],["stats","الإحصاءات"],["analysis","التحليل"]];
  v.innerHTML = `<div class="gc">
    <div class="gc-hero"><img class="gc-logo" src="assets/gulf/khaleeji27.png?v=1" alt="خليجي 27"><div class="gc-hero-tx"><small>الديار العربية · السعودية 2026</small><h2>${NAME}</h2><div class="gc-hero-flags">${TEAMS.map(c=>flagImg(c)).join("")}</div></div></div>
    <p class="gc-note">إحصاءات البطولة منفصلة تماماً — لا تدخل في إحصاءات الدوري ولا ملفات اللاعبين ولا الفانتسي.</p>
    <nav class="gc-tabs">${tabs.map(([k,t])=>`<button type="button" data-gtab="${k}" aria-selected="${VIEW.tab===k}">${t}</button>`).join("")}</nav>
    <div class="gc-body">${VIEW.tab==="squad"?teamsHTML():VIEW.tab==="matches"?groupsHTML():VIEW.tab==="stats"?statsTabHTML():VIEW.tab==="analysis"?analysisTabHTML():profilesHTML()}</div></div>`;
  if(VIEW.tab==="analysis") gulfHeat();
}
G.render = render;
function repaint(){ if(document.querySelector("#v-gulf.on")) render(); paintAdmin(); }
document.addEventListener("click", e=>{
  const v = document.getElementById("v-gulf"); if(!v || !v.contains(e.target)) return;
  const t = e.target.closest("[data-gtab]"); if(t){ VIEW.tab = t.dataset.gtab; render(); return; }
  const sq = e.target.closest("[data-gsq]"); if(sq){ VIEW.tab = "squad"; VIEW.team = sq.dataset.gsq; render(); window.scrollTo({top:v.getBoundingClientRect().top+scrollY-60, behavior:"smooth"}); return; }
  const tm = e.target.closest("[data-gteam]"); if(tm){ VIEW.tab = "squad"; VIEW.team = tm.dataset.gteam; render(); window.scrollTo({top:v.getBoundingClientRect().top+scrollY-60, behavior:"smooth"}); return; }
  const o = e.target.closest("[data-gopen]"); if(o){ const m = findGulf(o.dataset.gopen); if(m && typeof openMatch==="function") openMatch(m); return; }
}, true);

/* مطابقة مباريات البطولة بالمفتاح (صفحة المباراة واللعب الفعلي) */
function findGulf(k){
  if(!DATA || !k) return null;
  const [c,r,h,a] = String(k).split("/").map(x=>decodeURIComponent(x));
  if(c!==COMP_G) return null;
  return DATA.matches.find(m=>String(m.round)===r && m.home===h && m.away===a) || null;
}
G.find = findGulf;

/* ───────────── ربط الموقع: التبويب، صفحة المباراة، اللعب الفعلي، المحرّر ───────────── */
function hookSite(){
  /* التبويب في شريط التنقل */
  const nav = document.querySelector("nav.tabs"), an = nav && nav.querySelector('[data-v="analysis"]');
  if(nav && !nav.querySelector('[data-v="gulf"]')){
    const b = document.createElement("button"); b.setAttribute("role","tab"); b.dataset.v = "gulf"; b.setAttribute("aria-selected","false");
    b.innerHTML = `<svg class="ic" aria-hidden="true" width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg>كأس الخليج`;
    if(an) an.after(b); else nav.appendChild(b);
    b.addEventListener("click", ()=>{ if(typeof go==="function") go("gulf"); });
  }
  if(!document.getElementById("v-gulf")){ const s = document.createElement("section"); s.className="view"; s.id="v-gulf"; const a = document.getElementById("v-analysis"); (a?a.parentNode:document.querySelector("main")||document.body).insertBefore(s, a?a.nextSibling:null); }
  if(typeof RENDER==="object" && RENDER) RENDER.gulf = render;
  /* صفحة المباراة: تُرسم داخل سياق البطولة، بلا تبويبي «القائمة» و«الترتيب» (خاصان بالأندية) */
  if(typeof renderMatchPage==="function" && !renderMatchPage.__gulf){
    const o = renderMatchPage;
    renderMatchPage = function(){
      const m = (typeof MP==="object") ? MP.m : null;
      if(!(m && m.__gulf)) return o.apply(this, arguments);
      if(MP.tab==="squad" || MP.tab==="table") MP.tab = "details";
      const r = withGulf(()=>o.apply(this, arguments));
      const box = document.getElementById("mpage");
      if(box){ box.querySelectorAll('.mp-tabs [data-mp-tab="squad"], .mp-tabs [data-mp-tab="table"]').forEach(b=>b.remove());
        box.querySelectorAll('[data-player]').forEach(el=>{ el.removeAttribute('data-player'); el.style.cursor='default'; });
        const hd = box.querySelector(".mp-head .mp-when"); if(hd && !/كأس الخليج/.test(hd.textContent)) hd.insertAdjacentHTML("afterbegin", `<b>${NAME}</b> · `); }
      return r;
    };
    renderMatchPage.__gulf = true; renderMatchPage.__lv = true;
  }
  if(typeof matchByKey==="function" && !matchByKey.__gulf){ const o = matchByKey; matchByKey = function(k){ return o(k) || findGulf(k); }; matchByKey.__gulf = true; }
  /* بلا ملف لاعب في البطولة (منصور: صور الملصقات لا تصلح للتكبير) */
}

/* اللعب الفعلي: خطافات live.js */
function hookLive(){
  const LV = window.LIVE; if(!LV) return;
  LV.gulfCtx = withGulf;
  LV.findHook = k => findGulf(k);
  LV.crestHook = c => (LV.ctxGulf && T[c]) ? `<div class="crest has-logo"><img src="${flagUrl(c)}" alt="${H(c)}" style="object-fit:cover;border-radius:3px"></div>` : null;
  LV.squadHook = c => (LV.ctxGulf && DATA && DATA.squads[c]) ? DATA.squads[c].map(x=>({n:x.n, s:+x.s||0, p:x.p||""})) : null;
  LV.colorsHook = c => (LV.ctxGulf && T[c]) ? Object.assign(T[c].c.slice(), {light:false}) : null;
  LV.gulfRec = {
    find: doc => DATA ? DATA.matches.find(x=>+x.round===+doc.round && x.home===doc.home && x.away===doc.away) || null : null,
    async push(doc, opt, R){
      const m = LV.gulfRec.find(doc); if(!m) throw new Error("المباراة غير موجودة في بيانات البطولة");
      withGulf(()=>{
        const E = loadEdit(m); E.gulf = true;
        E.goals = R.goals; E.cards = R.cards; E.pens = R.pens; E.subs = R.subs; E.mev = R.mev;
        const ph = doc.clock && doc.clock.phase; if(ph && ph!=="pre") E.match.status = /^(et|e1|e2)$/.test(ph) ? "h2" : ph;
        const add = (doc.clock && doc.clock.added) || {}; if(add.h1!=null) E.match.add1 = String(add.h1); if(add.h2!=null) E.match.add2 = String(add.h2);
        if(opt && opt.tv!=null) E.match.tv = opt.tv;
        E.match.rec = "live"; E.match.comp = COMP_G;
        applyEdit(E);
      });
      DATA = normalize(DATA);
      await store.save(DATA); repaint();
      return {ok:true};
    },
    async wipe(doc, keepRecord){
      const m = LV.gulfRec.find(doc); if(!m || m.rec!=="live") return;
      withGulf(()=>{ const E = loadEdit(m); E.match.rec = ""; E.match.comp = COMP_G;
        if(!keepRecord){ E.goals = []; E.cards = []; E.pens = []; E.subs = []; E.mev = []; E.match.status = ""; E.match.add1 = 0; E.match.add2 = 0; }
        applyEdit(E); });
      DATA = normalize(DATA); await store.save(DATA); repaint();
    },
    async detach(doc){
      const m = LV.gulfRec.find(doc); if(!m || m.rec!=="live") return;
      withGulf(()=>{ const E = loadEdit(m); E.match.rec = ""; E.match.comp = COMP_G; applyEdit(E); });
      DATA = normalize(DATA); await store.save(DATA);
    }
  };
  if(LV.openControl && !LV.openControl.__gulf){ const o = LV.openControl; LV.openControl = function(k){ LV.ctxGulf = !!findGulf(k); return o.apply(this, arguments); }; LV.openControl.__gulf = true; }
}

/* المحرّر اليدوي: مباراة من البطولة تُحرَّر وتُحفظ داخل سياقها في وثيقتها */
function hookEditor(){
  if(typeof renderMatchAdmin==="function" && !renderMatchAdmin.__gulf){
    const o = renderMatchAdmin;
    renderMatchAdmin = function(){ if(EDIT_OPEN()) return withGulf(()=>o.apply(this, arguments)); const r = o.apply(this, arguments); if(PENDING){ DATA = normalize(PENDING); PENDING = null; repaint(); } return r; };
    renderMatchAdmin.__gulf = true;
  }
  if(typeof saveMatch==="function" && !saveMatch.__gulf){
    const o = saveMatch;
    saveMatch = async function(){
      if(!EDIT_OPEN()) return o.apply(this, arguments);
      EDIT.match.comp = COMP_G;
      FORMERR = withGulf(()=>validateEdit());
      if(FORMERR){ renderMatchAdmin(); return; }
      const key = {round:+EDIT.match.round, home:EDIT.match.home, away:EDIT.match.away}, linked = EDIT.match.rec==="live";
      withGulf(()=>applyEdit(EDIT));
      DATA = normalize(DATA);
      const E0 = EDIT; EDIT = null; FORMERR = "";
      try{ toast("جارٍ حفظ مباراة البطولة…","busy",true); await store.save(DATA); toast(`حُفظت: ${key.home} ضد ${key.away} ✅`,"ok"); }
      catch(e){ toast("تعذّر الحفظ: "+(e.code||e.message),"err"); EDIT = E0; }
      if(linked && window.LIVE && LIVE.rec){ try{ const m = findGulf(LIVE.keyOf({comp:COMP_G, ...key})); if(m){ const d = await LIVE.rec.pull(m); if(d && !d.detached) await LIVE.rec.push(d); } }catch(e){ console.error(e); } }
      repaint(); renderMatchAdmin();
    };
    saveMatch.__gulf = true; saveMatch.__lv = true;
  }
}

/* ───────────── الإدارة: قسم «كأس الخليج» ───────────── */
function adminHTML(){
  if(!DATA) DATA = normalize(null);
  const ms = DATA.matches.slice().sort((a,b)=>(a.round-b.round)||String(a.date).localeCompare(String(b.date)));
  return `<div id="gulfAdmin"><h2 class="sec">كأس الخليج 27</h2>
    <div class="card pad">
      <p class="hint" style="margin:0 0 12px">مباريات البطولة وتشكيلاتها وأحداثها — بالإدخال اليدوي فقط (لا لعب فعلي في هذه البطولة). تُحفظ في وثيقة مستقلة، فلا تدخل إحصاءات الدوري ولا الفانتسي.</p>
      <button class="btn" data-gadm="new">+ إضافة مباراة في البطولة</button>
      <div class="gadm-list">${ms.length?ms.map(m=>`<div class="gadm-row">
        <span class="t">${flagImg(m.home,"sm")}<b>${H(m.home)}</b></span>
        <span class="s">${(m.hg+m.ag)||m.status==="ft"?`${m.hg} - ${m.ag}`:(m.time?H(m.time):"—")}</span>
        <span class="t a"><b>${H(m.away)}</b>${flagImg(m.away,"sm")}</span>
        <span class="meta">${m.round<=3?`ج${m.round}`:m.round===4?"نصف النهائي":"النهائي"} · <bdi dir="ltr">${H(m.date||"")}</bdi>${m.rec==="live"?` · <b class="lvtag">مرتبطة باللعب الفعلي</b>`:""}</span>
        ${motmSelectHTML(m)}
        <span class="btns"><button data-gadm="edit" data-k="${H(LIVE?LIVE.keyOf(m):"")}">إدخال يدوي</button><button class="dl" data-gadm="rm" data-k="${H(LIVE?LIVE.keyOf(m):"")}">حذف</button></span>
      </div>`).join(""):`<p class="hint">لا مباريات بعد.</p>`}</div>
      <p class="hint" style="margin:12px 0 0">الجولات 1–3 = دور المجموعات، 4 = نصف النهائي، 5 = النهائي. المنتخبات والقوائم من الملصقات الرسمية.</p>
    </div>
    ${squadAdminHTML()}</div>`;
}

/* ───────────── تبويب «حكام الخليج» في الإدارة (منصور 2026-09-23) ─────────────
   منفصل تماماً عن حكام الدوري: الطواقم في m.ref/m.refs لمباريات البطولة، والقائمة في DATA.refpool —
   كلها في وثيقة seasons/gulf27. لا يقرأ ALL ولا يكتب فيه، ولا يظهر أي اسم هنا في قائمة حكام الدوري أو طواقمه.
   الحفظ يقرأ آخر نسخة من السحابة أولاً ثم يطبّق التعديل عليها (لا يمسح ما أدخله غيرك أثناء المباراة). */
const GREF_ROLES = [["ref","حكم الساحة","ref"],["ar1","المساعد الأول","ar"],["ar2","المساعد الثاني","ar"],["fourth","الحكم الرابع","fourth"],["var","حكم الفيديو (VAR)","var"],["avar","مساعد حكم الفيديو (AVAR)","avar"]];
const GREF_CATS = [["ref","حكم ساحة"],["ar","حكم مساعد"],["fourth","حكم رابع"],["var","حكم فيديو VAR"],["avar","مساعد فيديو AVAR"]];
const gKey = m => `${m.round}|${m.home}|${m.away}`;
const gClean = v => String(v||"").trim().replace(/\s+/g," ");
let GRE = null;   /* {round, crews:{key:{ref,ar1,…}}, pool:[{name,roles}], poolDirty} */
function grePool(){           /* القائمة المحفوظة + أسماء مستنتجة من طواقم البطولة */
  const map = new Map(), add = (n,c) => { n = gClean(n); if(!n || n==="لا يوجد") return; if(!map.has(n)) map.set(n, new Set()); if(c) map.get(n).add(c); };
  DATA.matches.forEach(m=>{ add(m.ref,"ref"); GREF_ROLES.slice(1).forEach(([k,,c])=>add((m.refs||{})[k], c)); });
  const out = new Map([...map].map(([n,set])=>[n,{name:n, roles:[...set]}]));
  (DATA.refpool||[]).forEach(r=>{ const n = gClean(r.name); if(n) out.set(n, {name:n, roles:(r.roles||[]).filter(c=>GREF_CATS.some(([k])=>k===c))}); });
  return [...out.values()].filter(r=>r.roles.length).sort((a,b)=>a.name.localeCompare(b.name,"ar"));   /* بلا فئات = محذوف من القائمة */
}
function greLoad(keepRound){
  const ms = DATA.matches, rounds = [...new Set(ms.map(m=>+m.round))].sort((a,b)=>a-b);
  let round = keepRound;
  if(!rounds.includes(round)){ const up = ms.filter(m=>isUp(m)).map(m=>+m.round); round = up.length ? Math.min(...up) : (rounds[rounds.length-1]||1); }
  const crews = {}; ms.forEach(m=>{ const c = {ref:m.ref||""}; GREF_ROLES.slice(1).forEach(([k])=>c[k] = (m.refs||{})[k]||""); crews[gKey(m)] = c; });
  GRE = {round, crews, pool:grePool(), poolDirty:false, removed:[], dirty:new Set()};
}
/* وصلت نسخة جديدة من السحابة: نحدّث ما لم يُعدَّل هنا ولم يُحفظ بعد */
function greRefresh(){
  if(!GRE) return;
  DATA.matches.forEach(m=>{ const k = gKey(m); if(GRE.dirty.has(k)) return; const c = {ref:m.ref||""}; GREF_ROLES.slice(1).forEach(([rk])=>c[rk] = (m.refs||{})[rk]||""); GRE.crews[k] = c; });
  if(!GRE.poolDirty) GRE.pool = grePool();
}
function gulfRefAdminHTML(){
  if(!DATA) DATA = normalize(null);
  if(!GRE) greLoad();
  const rounds = [...new Set(DATA.matches.map(m=>+m.round))].sort((a,b)=>a-b);
  const L = DATA.matches.filter(m=>+m.round===GRE.round).sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.time).localeCompare(String(b.time)));
  const rl = r => r<=3 ? `ج${r}` : r===4 ? "نصف النهائي" : "النهائي";
  const box = (c,on,attr) => `<label class="refcat${on?" on":""}"><input type="checkbox" ${attr} ${on?"checked":""}>${GREF_CATS.find(x=>x[0]===c)[1]}</label>`;
  return `<div id="gulfRefAdmin"><h2 class="sec">حكام كأس الخليج</h2>
    <div class="card pad">
      <p class="hint" style="margin:0 0 12px">طواقم مباريات البطولة وقائمة حكامها — منفصلة تماماً عن حكام الدوري الكويتي: تُحفظ في وثيقة البطولة وحدها، فلا تظهر في قائمة حكام الدوري ولا طواقمه ولا إحصاءاته.</p>
      <h3 class="gre-h">طواقم المباريات</h3>
      <div class="crew-rounds">${rounds.map(r=>`<button class="seg" type="button" data-gre="round" data-r="${r}" aria-pressed="${r===GRE.round}">${rl(r)}</button>`).join("")}</div>
      ${GREF_CATS.map(([c])=>`<datalist id="greL-${c}">${GRE.pool.filter(r=>r.roles.includes(c)).map(r=>`<option value="${H(r.name)}">`).join("")}</datalist>`).join("")}
      ${L.length ? L.map(m=>{ const k = gKey(m), c = GRE.crews[k] || {}; return `<div class="crew-row">
          <div class="crew-hd">${flagImg(m.home,"sm")}<b>${H(m.home)}</b><span>×</span><b>${H(m.away)}</b>${flagImg(m.away,"sm")}<small dir="ltr">${H(m.date||"")}${m.time?` · ${H(m.time)}`:""}</small></div>
          <div class="crew-grid">${GREF_ROLES.map(([rk,t,cat])=>`<label><span>${t}</span><input class="refin" data-gre="crew" data-k="${H(k)}" data-rk="${rk}" list="greL-${cat}" value="${H(c[rk]||"")}" placeholder="—" autocomplete="off"></label>`).join("")}</div>
          <button class="btn ghost" type="button" data-gre="savecrew" data-k="${H(k)}">حفظ طاقم المباراة</button></div>`; }).join("")
        : `<p class="hint" style="margin:0">لا مباريات في هذه الجولة.</p>`}
    </div>
    <div class="card pad" style="margin-top:12px">
      <h3 class="gre-h">قائمة حكام البطولة</h3>
      <p class="hint" style="margin:0 0 10px">كل حكم يظهر اقتراحاً في خانة فئته بطواقم البطولة فقط. من أدار مباراة في البطولة يُضاف تلقائياً.</p>
      <div class="refadd">
        <input id="greNewName" class="refin" placeholder="اسم الحكم" autocomplete="off">
        <div class="refcats">${GREF_CATS.map(([c])=>box(c,false,`data-grenew="${c}"`)).join("")}</div>
        <button class="btn" type="button" data-gre="add">إضافة الحكم</button>
      </div>
      <div class="reflist">${GRE.pool.map((r,i)=>`<div class="refrow"><b>${H(r.name)}</b>
          <div class="refcats">${GREF_CATS.map(([c])=>box(c,r.roles.includes(c),`data-gre="role" data-i="${i}" data-c="${c}"`)).join("")}</div>
          <button class="dl" type="button" data-gre="del" data-i="${i}">حذف</button></div>`).join("") || `<p class="hint" style="margin:0">القائمة فارغة.</p>`}</div>
      <div style="height:12px"></div>
      <button class="btn" type="button" data-gre="savepool"${GRE.poolDirty?"":" disabled"}>حفظ قائمة الحكام</button>
    </div></div>`;
}
function paintGulfRefAdmin(){
  const box = document.getElementById("gulfRefAdmin"); if(!box) return;
  if(box.contains(document.activeElement) && document.activeElement.tagName==="INPUT" && document.activeElement.type!=="checkbox") return;   /* لا نقاطع الكتابة */
  const tmp = document.createElement("div"); tmp.innerHTML = gulfRefAdminHTML(); box.replaceWith(tmp.firstElementChild);
}
/* يقرأ آخر نسخة من السحابة، يطبّق التعديل عليها وحدها، ثم يحفظ */
async function saveGulfFresh(mutate){
  let fresh = null;
  if(!TEST && typeof fbDb!=="undefined" && fbDb){ const s = await fbDb.collection("seasons").doc(DOC_ID).get(); fresh = s.exists ? s.data() : null; }
  const d = normalize(fresh || JSON.parse(JSON.stringify(DATA)));
  mutate(d); await store.save(d); DATA = d;
}
document.addEventListener("input", e=>{
  const el = e.target.closest && e.target.closest('#gulfRefAdmin [data-gre="crew"]'); if(!el || !GRE) return;
  (GRE.crews[el.dataset.k] ||= {})[el.dataset.rk] = el.value; GRE.dirty.add(el.dataset.k);
}, true);
document.addEventListener("change", e=>{
  const el = e.target.closest && e.target.closest("#gulfRefAdmin input[type=checkbox]"); if(!el || !GRE) return;
  el.parentElement.classList.toggle("on", el.checked);
  if(el.dataset.gre==="role"){ const r = GRE.pool[+el.dataset.i]; if(!r) return; const c = el.dataset.c;
    r.roles = el.checked ? [...new Set([...r.roles, c])] : r.roles.filter(x=>x!==c); GRE.poolDirty = true;
    const sv = document.querySelector('#gulfRefAdmin [data-gre="savepool"]'); if(sv) sv.disabled = false; }
}, true);
document.addEventListener("click", async e=>{
  const b = e.target.closest("#gulfRefAdmin [data-gre]"); if(!b || !GRE || b.tagName==="INPUT") return;
  const a = b.dataset.gre;
  if(a==="round"){ GRE.round = +b.dataset.r; paintGulfRefAdmin(); return; }
  if(a==="savecrew"){
    const k = b.dataset.k, c = GRE.crews[k] || {};
    b.disabled = true; b.textContent = "جارٍ الحفظ…";
    try{
      let found = null;
      await saveGulfFresh(d=>{ const m = d.matches.find(x=>gKey(x)===k); if(!m) return; found = m;
        m.ref = gClean(c.ref); m.refs = {}; GREF_ROLES.slice(1).forEach(([rk])=>{ const v = gClean(c[rk]); if(v) m.refs[rk] = v; }); });
      if(!found) throw new Error("لم تُعثر على المباراة");
      toast(`حُفظ طاقم ${found.home} × ${found.away} ✅`,"ok"); GRE.dirty.delete(k);
    }catch(x){ toast("تعذّر الحفظ: "+(x.code||x.message),"err"); }
    repaint(); return;
  }
  if(a==="add"){
    const inp = document.getElementById("greNewName"), n = gClean(inp && inp.value);
    const roles = [...document.querySelectorAll("#gulfRefAdmin [data-grenew]:checked")].map(x=>x.dataset.grenew);
    if(!n){ toast("اكتب اسم الحكم","err"); return; } if(!roles.length){ toast("اختر فئة واحدة على الأقل","err"); return; }
    const ex = GRE.pool.find(r=>r.name===n); if(ex) ex.roles = [...new Set([...ex.roles, ...roles])]; else GRE.pool.push({name:n, roles});
    GRE.pool.sort((p,q)=>p.name.localeCompare(q.name,"ar")); GRE.poolDirty = true;
    toast(ex?"أُضيفت الفئات — اضغط «حفظ قائمة الحكام»":"أُضيف الحكم — اضغط «حفظ قائمة الحكام»","ok"); paintGulfRefAdmin(); return;
  }
  if(a==="del"){ const r = GRE.pool[+b.dataset.i]; if(!r || !confirm(`حذف «${r.name}» من قائمة حكام البطولة؟ (لا يغيّر الطواقم المحفوظة)`)) return;
    GRE.removed.push(r.name); GRE.pool.splice(+b.dataset.i, 1); GRE.poolDirty = true; paintGulfRefAdmin(); return; }
  if(a==="savepool"){
    b.disabled = true; b.textContent = "جارٍ الحفظ…";
    const pool = [...GRE.pool.map(r=>({name:r.name, roles:[...r.roles]})), ...GRE.removed.filter(n=>!GRE.pool.some(r=>r.name===n)).map(n=>({name:n, roles:[]}))];
    try{ await saveGulfFresh(d=>{ d.refpool = pool; }); toast("حُفظت قائمة حكام البطولة ✅","ok"); GRE.poolDirty = false; GRE.removed = []; }
    catch(x){ toast("تعذّر الحفظ: "+(x.code||x.message),"err"); }
    repaint(); return;
  }
}, true);

/* أفضل لاعب في المباراة يختاره المحرّر (m.motm = {n, c}) — لمن شارك فعلاً (التشكيلة + البدلاء الداخلون)، بعد انتهاء المباراة */
function motmSelectHTML(m){
  const over = withGulf(()=>typeof matchOver==="function" && matchOver(m)); if(!over) return "";
  const men = c => withGulf(()=>{ const s = new Set(xiNames(m.round, compOf(m), c)); matchSubs(m).filter(x=>x.club===c && x.in).forEach(x=>s.add(x.in)); return [...s]; });
  const cur = m.motm && m.motm.n ? m.motm.c+"|"+m.motm.n : "";
  const opt = (c,n) => `<option value="${H(c+"|"+n)}"${cur===c+"|"+n?" selected":""}>${H(n)}</option>`;
  return `<label class="gadm-motm"><span>أفضل لاعب</span><select data-gmotm="${H(gKey(m))}"><option value="">تلقائي (الأعلى تقييماً)</option>
    ${[m.home,m.away].map(c=>`<optgroup label="${H(c)}">${men(c).map(n=>opt(c,n)).join("")}</optgroup>`).join("")}</select></label>`;
}
document.addEventListener("change", async e=>{
  const sel = e.target.closest && e.target.closest("select[data-gmotm]"); if(!sel) return;
  const k = sel.dataset.gmotm, v = sel.value, [c, ...rest] = v.split("|"), n = rest.join("|");
  sel.disabled = true;
  try{ await saveGulfFresh(d=>{ const m = d.matches.find(x=>gKey(x)===k); if(!m) throw new Error("لم تُعثر على المباراة"); if(v) m.motm = {n, c}; else delete m.motm; });
    toast(v ? `أفضل لاعب: ${n} ✅` : "أفضل لاعب: تلقائي","ok"); }
  catch(x){ toast("تعذّر الحفظ: "+(x.code||x.message),"err"); }
  sel.disabled = false; repaint();
}, true);

/* قوائم المنتخبات: الأرقام والأسماء والمراكز، إضافة وحذف — مسودة حتى الضغط على «حفظ القائمة» */
let SQE = null;   /* {team, rows:[{n,s,p,o,f}], dirty, err} ؛ o = الاسم الأصلي لتتبّع إعادة التسمية */
const SQ_POS = [["GK","حارس"],["D","دفاع"],["M","وسط"],["F","هجوم"],["","—"]];
const posKey = p => { p = String(p||"").toUpperCase(); if(p==="GK"||p==="G") return "GK"; const m = typeof POS_MAIN==="object" && POS_MAIN[p]; return m==="G"?"GK":(m||""); };
function sqeLoad(c){
  SQE = {team:c, dirty:false, err:"", rows:(DATA.squads[c]||[]).map(x=>({n:x.n||"", s:x.s?String(x.s):"", p:posKey(x.p), o:x.n||"", f:x.f||""}))};
}
function squadAdminHTML(){
  if(!SQE || !T[SQE.team]) sqeLoad("الكويت");
  const c = SQE.team;
  return `<div id="gsqAdmin"><h2 class="sec" style="margin-top:18px">قوائم المنتخبات</h2>
    <div class="card pad">
      <p class="hint" style="margin:0 0 10px">عدّل رقم القميص والاسم والمركز، أو أضف لاعباً واحذف آخر. لا يُحفظ شيء حتى تضغط «حفظ القائمة». تغيير الاسم ينقله في أحداث المباريات المحفوظة أيضاً.</p>
      <div class="gc-teams gsq-teams">${TEAMS.map(x=>`<button type="button" class="gc-tb${x===c?" on":""}" data-gsqe="team" data-c="${H(x)}">${flagImg(x)}<span>${H(x)}</span></button>`).join("")}</div>
      <div class="gsq-hd"><b>${H(c)}</b><span>${SQE.rows.length} لاعباً${SQE.dirty?` · <em>تعديلات غير محفوظة</em>`:""}</span></div>
      <div class="gsq-cols"><span>الرقم</span><span>الاسم</span><span>المركز</span><span></span></div>
      <div class="gsq-list">${SQE.rows.map((r,i)=>`<div class="gsq-row">
        <input class="gsq-s" type="text" inputmode="numeric" maxlength="2" placeholder="#" value="${H(r.s)}" data-gsqe="s" data-i="${i}" aria-label="الرقم">
        <input class="gsq-n" type="text" placeholder="اسم اللاعب" value="${H(r.n)}" data-gsqe="n" data-i="${i}" aria-label="الاسم">
        <select class="gsq-p" data-gsqe="p" data-i="${i}" aria-label="المركز">${SQ_POS.map(([k,l])=>`<option value="${k}"${r.p===k?" selected":""}>${l}</option>`).join("")}</select>
        <button type="button" class="gsq-rm" data-gsqe="rm" data-i="${i}">حذف</button>
      </div>`).join("")||`<p class="hint">القائمة فارغة.</p>`}</div>
      ${SQE.err?`<p class="gsq-err">${H(SQE.err)}</p>`:""}
      <div class="gsq-btns">
        <button type="button" class="btn ghost" data-gsqe="add">+ إضافة لاعب</button>
        <button type="button" class="btn" data-gsqe="save"${SQE.dirty?"":" disabled"}>حفظ القائمة</button>
        ${SQE.dirty?`<button type="button" class="btn ghost" data-gsqe="undo">تراجع</button>`:""}
      </div>
    </div></div>`;
}
function paintSquadAdmin(focusI){
  const box = document.getElementById("gsqAdmin"); if(!box) return;
  const tmp = document.createElement("div"); tmp.innerHTML = squadAdminHTML(); box.replaceWith(tmp.firstElementChild);
  if(focusI!=null){ const n = document.querySelector(`#gsqAdmin [data-gsqe="n"][data-i="${focusI}"]`); if(n){ n.focus(); n.scrollIntoView({block:"center"}); } }
}
/* إعادة تسمية لاعب: تُستبدل القيمة المطابقة تماماً في أحداث البطولة المحفوظة */
function renameInEvents(from, to){
  const fix = o => { if(!o || typeof o!=="object") return; for(const k of Object.keys(o)){ const v = o[k];
    if(v===from) o[k] = to; else if(Array.isArray(v)) v.forEach((x,j)=>{ if(x===from) v[j] = to; else fix(x); }); else if(v && typeof v==="object") fix(v); } };
  ["goals","cards","pens","lineups","subs","shapes","mev"].forEach(k=>(DATA[k]||[]).forEach(fix));
}
async function saveSquad(){
  const c = SQE.team, rows = SQE.rows.map(r=>({...r, n:r.n.trim().replace(/\s+/g," "), s:r.s.trim()}));
  if(rows.some(r=>!r.n)){ SQE.err = "اكتب اسم كل لاعب أو احذف السطر الفارغ."; return paintSquadAdmin(); }
  const dn = rows.map(r=>r.n).find((n,i,a)=>a.indexOf(n)!==i); if(dn){ SQE.err = `الاسم «${dn}» مكرر.`; return paintSquadAdmin(); }
  if(rows.some(r=>r.s && !/^\d{1,2}$/.test(r.s))){ SQE.err = "الرقم يجب أن يكون من 1 إلى 99."; return paintSquadAdmin(); }
  const ds = rows.map(r=>r.s).find((x,i,a)=>x && a.indexOf(x)!==i); if(ds){ SQE.err = `الرقم ${ds} مكرر.`; return paintSquadAdmin(); }
  rows.forEach(r=>{ if(r.o && r.o!==r.n){ renameInEvents(r.o, r.n); if(!r.f){ const f = (FACES[c]||{})[r.o]; if(f) r.f = f; } } });
  DATA.squads[c] = rows.map(r=>{ const x = {n:r.n, p:r.p}; if(r.s) x.s = +r.s; if(r.f) x.f = r.f; return x; });
  (DATA.squadsEdited ||= {})[c] = true;
  try{ toast("جارٍ حفظ القائمة…","busy",true); await store.save(DATA); toast(`حُفظت قائمة ${c} ✅`,"ok"); sqeLoad(c); }
  catch(e){ toast("تعذّر الحفظ: "+(e.code||e.message),"err"); SQE.err = "لم تُحفظ — حاول مرة ثانية."; }
  repaint();
}
document.addEventListener("input", e=>{
  const el = e.target.closest && e.target.closest("#gsqAdmin [data-gsqe]"); if(!el || !SQE) return;
  const k = el.dataset.gsqe, r = SQE.rows[+el.dataset.i]; if(!r || !["s","n","p"].includes(k)) return;
  if(k==="s") el.value = el.value.replace(/[٠-٩]/g, d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/\D/g,"").slice(0,2);
  r[k] = el.value; SQE.err = "";
  if(!SQE.dirty){ SQE.dirty = true; const box = document.getElementById("gsqAdmin");
    if(box){ const hd = box.querySelector(".gsq-hd span"); if(hd) hd.innerHTML = `${SQE.rows.length} لاعباً · <em>تعديلات غير محفوظة</em>`;
      const sv = box.querySelector('[data-gsqe="save"]'); if(sv){ sv.disabled = false; if(!box.querySelector('[data-gsqe="undo"]')) sv.insertAdjacentHTML("afterend", `<button type="button" class="btn ghost" data-gsqe="undo">تراجع</button>`); } } }
}, true);
document.addEventListener("click", e=>{
  const b = e.target.closest("#gsqAdmin [data-gsqe]"); if(!b || !SQE) return;
  const a = b.dataset.gsqe;
  if(a==="team"){ if(b.dataset.c===SQE.team) return; if(SQE.dirty && !confirm("في تعديلات غير محفوظة على هذه القائمة. تتركها؟")) return; sqeLoad(b.dataset.c); paintSquadAdmin(); }
  if(a==="add"){ SQE.rows.push({n:"", s:"", p:"", o:"", f:""}); SQE.dirty = true; paintSquadAdmin(SQE.rows.length-1); }
  if(a==="rm"){ const r = SQE.rows[+b.dataset.i]; if(!r) return; if(r.n.trim() && !confirm(`حذف ${r.n} من قائمة ${SQE.team}؟`)) return; SQE.rows.splice(+b.dataset.i, 1); SQE.dirty = true; paintSquadAdmin(); }
  if(a==="undo"){ sqeLoad(SQE.team); paintSquadAdmin(); }
  if(a==="save") saveSquad();
}, true);
function paintAdmin(){
  const box = document.getElementById("gulfAdmin"); if(!box) return;
  if(SQE && !SQE.dirty) sqeLoad(SQE.team);
  const tmp = document.createElement("div"); tmp.innerHTML = adminHTML(); box.replaceWith(tmp.firstElementChild);
  greRefresh(); paintGulfRefAdmin();
}
function injectAdmin(){
  const v = document.getElementById("v-admin"); if(!v || document.getElementById("gulfAdmin")) return;
  if(typeof isAdmin==="undefined" || !isAdmin) return;
  const ma = document.getElementById("matchAdmin"); if(!ma) return;
  const wrap = document.createElement("div"); wrap.innerHTML = adminHTML();
  v.appendChild(wrap.firstElementChild);
  if(!document.getElementById("gulfRefAdmin")){ greRefresh(); const w2 = document.createElement("div"); w2.innerHTML = gulfRefAdminHTML(); v.appendChild(w2.firstElementChild); }
}
document.addEventListener("click", async e=>{
  const b = e.target.closest("[data-gadm]"); if(!b) return;
  const a = b.dataset.gadm, m = b.dataset.k ? findGulf(b.dataset.k) : null;
  const toMatches = () => { if(window.ADMIN_TABS) ADMIN_TABS.open("matches"); setTimeout(()=>{ const x=document.getElementById("matchAdmin"); if(x) x.scrollIntoView({block:"start"}); }, 80); };
  if(a==="new"){ EDIT = withGulf(()=>newEdit()); EDIT.gulf = true; EDIT.match.comp = COMP_G; EDIT.match.round = "1"; FORMERR = ""; toMatches(); renderMatchAdmin(); }
  if(a==="edit" && m){ EDIT = withGulf(()=>loadEdit(m)); EDIT.gulf = true; FORMERR = ""; toMatches(); renderMatchAdmin(); }
  if(a==="live" && m){ try{ history.pushState({lv:1},"","#livectl/"+b.dataset.k); }catch(x){} LIVE.openControl(b.dataset.k); }
  if(a==="rm" && m){ if(!confirm(`حذف ${m.home} × ${m.away} وكل أحداثها من البطولة؟`)) return;
    withGulf(()=>removeMatchByKey(mkey(m))); DATA = normalize(DATA);
    try{ await store.save(DATA); toast("حُذفت المباراة","ok"); }catch(x){ toast("تعذّر الحذف","err"); } repaint(); }
}, true);

function boot(){
  if(!DATA) DATA = normalize(null);
  hookSite(); hookLive(); hookEditor();
  ["renderAdmin","renderEditorAdmin"].forEach(n=>{ const f = window[n]; if(typeof f!=="function" || f.__gulfadm) return;
    const w = function(){ const r = f.apply(this, arguments); try{ injectAdmin(); if(window.ADMIN_TABS){ const v=document.getElementById("v-admin"); if(v && v.querySelector(".adm-tabs")){ v.querySelector(".adm-tabs").remove(); v.querySelectorAll(".adm-panel").forEach(p=>{ while(p.firstChild) v.insertBefore(p.firstChild, p); p.remove(); }); ADMIN_TABS.organize(); } } }catch(e){ console.error(e); } return r; };
    Object.assign(w, {__gulfadm:true, __tabs:f.__tabs, __lv:f.__lv});
    try{ window[n] = w; }catch(e){} try{ if(n==="renderAdmin") renderAdmin = w; else renderEditorAdmin = w; }catch(e){}
  });
  if(typeof RENDER==="object" && RENDER) RENDER.admin = window.renderAdmin;
}
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", ()=>setTimeout(boot, 80)); else setTimeout(boot, 80);
})();
