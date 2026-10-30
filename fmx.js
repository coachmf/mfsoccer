/* =========================================================
   mfsoccer — أفكار من Football Manager 27 (منصور 2026-10-30)
   كل ما هنا محسوب من بيانات الموقع الموجودة فقط (المباريات، الأهداف، البطاقات،
   التشكيلات، التبديلات، الكشوف، التقييمات) — لا أرقام مخترعة ولا بيانات جديدة.
   الملف يلفّ دوال الموقع القائمة ويضيف أقساماً إلى ناتجها، فلا يغيّر سلوكها:
   - صفحة المباراة: قبل المباراة، الغيابات، «لو انتهت الآن»، ملخص المباراة،
     تغييرات التشكيلة عن المباراة السابقة، عدّاد التبديلات.
   - صفحة النادي: مسار الترتيب، أرقام الفريق، قراءة في الأهداف، الأهداف حسب المركز، عمق التشكيلة.
   - ملف اللاعب: آخر 5 تقييمات، أرقام المشاركة، الإنذارات حسب البطولة، المحطات.
   - المباريات: ترتيب الفريق بجانب اسمه، الهدافون والطرد تحت النتيجة، حصاد الجولة.
   - التحليل (نظرة عامة): الموقوفون للمباراة القادمة، أرقام الموسم.
   ========================================================= */
(function(){
"use strict";
const LG = "الدوري";
const ok = fn => { try{ return fn(); }catch(e){ if(window.console) console.warn("[fmx]", e); return ""; } };
const fnOK = n => typeof window[n] === "function";

/* حدّ الإيقاف بتراكم الإنذارات: غير مُعتمد بعد — يبقى 0 (معطّل) حتى يحدده منصور من لائحة الاتحاد */
const FMX_RULES = { ycBan: 3, maxSubs: 5 };   /* ycBan: كل 3 إنذارات في نفس البطولة = إيقاف مباراة (منصور 2026-10-30) */

/* ───────────── أدوات عامة ───────────── */
const H = s => esc(String(s==null?"":s));
const ts = m => kickoffTS(m) ?? (+m.round||0);
const doneIn = m => !isUpcoming(m) && !isLive(m);
const skipMatch = m => !m || m.__ext || m.__gulf || (typeof isGulfMatch==="function" && isGulfMatch(m));
const keyOf = m => matchKey(m);
const sideOf = (m, c) => { const home=m.home===c, gf=+(home?m.hg:m.ag)||0, ga=+(home?m.ag:m.hg)||0;
  return {m, home, opp:home?m.away:m.home, gf, ga, k: gf>ga?"w":gf<ga?"l":"d"}; };

/* مباريات النادي المنتهية في سياق مسابقة (الكل = كل البطولات المحلية)، من الأقدم */
function clubGames(c, comp){
  return withComp(comp||"الكل", ()=>MATCHES.filter(m=>(m.home===c||m.away===c) && doneIn(m)))
    .sort((a,b)=>ts(a)-ts(b)).map(m=>sideOf(m,c));
}
/* جدول الدوري، مع استبعاد مباراة (للجدول قبل انطلاقها) أو حتى جولة معيّنة */
function leagueTable(opt){
  opt = opt || {};
  return withComp(LG, ()=>{
    const saved = MATCHES;
    try{
      if(opt.exclude) MATCHES = MATCHES.filter(x=>keyOf(x)!==opt.exclude);
      if(opt.upTo!=null) MATCHES = MATCHES.filter(x=>(+x.round||0)<=opt.upTo);
      return standings();
    } finally { MATCHES = saved; }
  });
}
const posIn = (T, c) => T.findIndex(x=>x.c===c)+1;
/* أطول سلسلة متتالية تحقق الشرط */
function longestRun(list, pred){
  let best=0, cur=0, bestEnd=-1;
  list.forEach((x,i)=>{ if(pred(x)){ cur++; if(cur>best){ best=cur; bestEnd=i; } } else cur=0; });
  return {n:best, from: best ? list[bestEnd-best+1] : null, to: best ? list[bestEnd] : null};
}
/* السلسلة الحالية من آخر مباراة */
function currentRun(list, pred){ let n=0; for(let i=list.length-1;i>=0 && pred(list[i]);i--) n++; return n; }
/* خط اللاعب (G/D/M/F) من الكشف — من ناديه أولاً ثم أي نادٍ */
function lineOf(club, name){
  const find = c => (SQUADS[c]||[]).find(x=>sqName(x)===name);
  let e = find(club);
  if(!e) for(const c of Object.keys(SQUADS||{})){ e = find(c); if(e) break; }
  const p = e ? String(sqPos(e)||"").toUpperCase() : "";
  return POS_MAIN[p] || "";
}
const LINE_AR = {G:"حراسة", D:"دفاع", M:"وسط", F:"هجوم"};
const LINES = ["F","M","D","G"];
const plBtn = (n, c, inner) => `<span class="fmx-pl" data-player="${H(n)}" data-club="${H(c)}">${inner||H(n)}</span>`;
const card = (title, body, cls) => `<div class="mp-card fmx-card${cls?" "+cls:""}"><div class="mp-hd"><h3>${title}</h3></div>${body}</div>`;
const sentences = L => L.length ? `<ul class="fmx-says">${L.map(s=>`<li>${H(s)}</li>`).join("")}</ul>` : "";
const plural = (n, one, two, few, many) => n===1 ? one : n===2 ? two : (n>=3&&n<=10) ? `${n} ${few}` : `${n} ${many}`;
const nMatches = n => plural(n, "مباراة واحدة", "مباراتين", "مباريات", "مباراة");
const nGoals = n => plural(n, "هدف واحد", "هدفين", "أهداف", "هدفاً");

/* ═════════════ صفحة المباراة ═════════════ */

/* لمحة فريق قبل المباراة */
function teamSnap(c, m){
  const before = clubGames(c).filter(g=>ts(g.m) < ts(m));
  const T = compOf(m)===LG ? leagueTable({exclude:keyOf(m)}) : null;
  const row = T && T.find(x=>x.c===c), pos = T ? posIn(T,c) : 0;
  const coach = (typeof CLUB_COACH!=="undefined" && CLUB_COACH[c] && fnOK("coachProfileData")) ? withComp(LG, ()=>coachProfileData(c)) : null;
  const sc = withComp("الكل", ()=>scorers().filter(p=>p.c===c));
  const topG = sc.filter(p=>p.g>0).sort((a,b)=>b.g-a.g)[0] || null;
  const topA = sc.filter(p=>p.a>0).sort((a,b)=>b.a-a.a)[0] || null;
  const topR = ok(()=> window.PRATING ? withComp("الكل", ()=>[...PRATING.all().values()].filter(x=>x.c===c && !x.low).sort((a,b)=>b.v-a.v)[0]) : null) || null;
  /* التشكيلة الأكثر استخداماً: عدد مرات البداية في كل البطولات المحلية */
  const cnt = {}; let withXI = 0;
  before.forEach(g=>{ const xi = xiNames(g.m.round, compOf(g.m), c); if(xi.length){ withXI++; xi.forEach(n=>cnt[n]=(cnt[n]||0)+1); } });
  const xi = Object.entries(cnt).sort((a,b)=>b[1]-a[1]).slice(0,11).map(([n,k])=>({n,k,l:lineOf(c,n)||"M"}));
  return {c, before, form: before.map(g=>g.k), pos, row, coach, topG, topA, topR, xi, withXI};
}
function snapSentences(A, B, m){
  const out = [];
  [A,B].forEach(S=>{
    const f = S.form;
    const w = currentRun(f, k=>k==="w"), nl = currentRun(f, k=>k!=="l"), nw = currentRun(f, k=>k!=="w"), l = currentRun(f, k=>k==="l");
    if(w>=2) out.push(`${S.c} فاز في آخر ${nMatches(w)}`);
    else if(nl>=3) out.push(`${S.c} بلا خسارة في آخر ${nMatches(nl)}`);
    else if(l>=2) out.push(`${S.c} خسر آخر ${nMatches(l)}`);
    else if(nw>=3) out.push(`${S.c} بلا فوز في آخر ${nMatches(nw)}`);
  });
  if(A.row && B.row && A.row.P && B.row.P){
    const d = Math.abs(A.row.Pts - B.row.Pts);
    out.push(d===0 ? "الفريقان متساويان في النقاط" : `الفارق بين الفريقين ${d===1?"نقطة واحدة":d===2?"نقطتان":d<=10?d+" نقاط":d+" نقطة"}`);
  }
  const h2h = withComp("الكل", ()=>MATCHES.filter(x=>keyOf(x)!==keyOf(m) && doneIn(x) &&
    ((x.home===m.home&&x.away===m.away)||(x.home===m.away&&x.away===m.home)))).sort((a,b)=>ts(b)-ts(a))[0];
  if(h2h) out.push(`آخر مواجهة: ${h2h.home} ${h2h.hg}-${h2h.ag} ${h2h.away}`);
  return out;
}
function xiHTML(S){
  if(!S.xi.length) return "";
  return `<div class="fmx-xi">${LINES.map(L=>{ const P=S.xi.filter(x=>x.l===L); if(!P.length) return "";
    return `<div class="fmx-xi-l">${P.map(x=>plBtn(x.n, S.c, `<b>${H(shortName(x.n))}</b><small>${x.k}/${S.withXI}</small>`)).join("")}</div>`; }).join("")}</div>`;
}
function previewCard(m){
  const A = teamSnap(m.home, m), B = teamSnap(m.away, m);
  if(!A.before.length && !B.before.length) return "";
  const cell = (S, f) => `<div class="c">${f(S)||"—"}</div>`;
  const rows = [];
  if(A.pos || B.pos) rows.push(["المركز", S=>S.pos?`<b class="fmx-rkb">${S.pos}</b>`:""]);
  rows.push(["آخر 5", S=>S.form.length?formPills(S.form):""]);
  if(A.coach || B.coach) rows.push(["المدرب", S=>{ const k=S.coach; if(!k) return ""; const R=k.row;
    return `<span class="fmx-co"><b>${H(k.name)}</b>${R.P?`<small>${R.W} - ${R.D} - ${R.L}</small><small>${Math.round(R.W/R.P*100)}% فوز</small>`:""}</span>`; }]);
  rows.push(["الهدّاف", S=>S.topG?plBtn(S.topG.n, S.c, `${H(shortName(S.topG.n))} <em>${S.topG.g}</em>`):""]);
  rows.push(["الأكثر صناعة", S=>S.topA?plBtn(S.topA.n, S.c, `${H(shortName(S.topA.n))} <em>${S.topA.a}</em>`):""]);
  if(A.topR || B.topR) rows.push(["الأعلى تقييماً", S=>S.topR?plBtn(S.topR.n, S.c, `${H(shortName(S.topR.n))} ${PRATING.badge(S.topR.v)}`):""]);
  const tbl = `<div class="fmx-vs"><div class="fmx-vs-r hd"><div class="c">${crest(m.home)}<span>${H(m.home)}</span></div><span></span><div class="c">${crest(m.away)}<span>${H(m.away)}</span></div></div>
    ${rows.map(([t,f])=>`<div class="fmx-vs-r">${cell(A,f)}<span class="t">${t}</span>${cell(B,f)}</div>`).join("")}</div>`;
  const says = sentences(snapSentences(A, B, m));
  const xi = (A.xi.length || B.xi.length) ? `<div class="fmx-sub">التشكيلة الأكثر استخداماً</div>
    <div class="fmx-xiseg">${[[A,"h"],[B,"a"]].map(([S,k],i)=>`<button type="button" data-fmx-xi="${k}" aria-pressed="${i===0}">${crest(S.c)}<span>${H(S.c)}</span></button>`).join("")}</div>
    <div class="fmx-xipanes"><div data-fmx-xp="h">${xiHTML(A)||'<p class="fmx-none">—</p>'}</div><div data-fmx-xp="a" hidden>${xiHTML(B)||'<p class="fmx-none">—</p>'}</div></div>` : "";
  return card("قبل المباراة", tbl + says + xi, "fmx-pre");
}
/* إيقافات تراكم الإنذارات: كل ycBan إنذارات في نفس البطولة — إنذار المباراة التي طُرد فيها اللاعب لا يُحسب (الإنذار الثاني) */
function ycBans(club, comp){
  const n = FMX_RULES.ycBan; if(!(n>0)) return [];
  const all = (ALL.cards||[]).filter(x=>x.club===club && (!comp || compOf(x)===comp));
  const red = new Set(all.filter(x=>isRed(x.type)).map(x=>x.p+"|"+compOf(x)+"|"+x.r));
  const per = {};
  all.filter(x=>isYellow(x.type) && !red.has(x.p+"|"+compOf(x)+"|"+x.r)).forEach(x=>{ const k=x.p+"|"+compOf(x); (per[k] ??= []).push(x); });
  const out = [];
  Object.values(per).forEach(L=>{ L.sort((a,b)=>a.r-b.r); L.forEach((x,i)=>{ if((i+1)%n===0) out.push({p:x.p, club, comp:compOf(x), r:x.r, k:i+1}); }); });
  return out;
}
/* الغيابات: موقوف بطرد في مباراته السابقة بنفس البطولة + من سجّله المحرّر غائباً أو حالته في الفانتسي */
function absencesCard(m){
  const comp = compOf(m);
  const side = c => {
    const out = [], seen = new Set();
    /* الإيقاف يُقضى في المباراة التالية مباشرة فقط: نأخذ مباراة النادي السابقة لهذه المباراة (بالتاريخ) ويجب أن تكون قد لُعبت */
    const G = withComp(comp, ()=>MATCHES.filter(x=>x.home===c||x.away===c)).sort((x,y)=>ts(x)-ts(y));
    const pm = G[G.findIndex(x=>x===m || keyOf(x)===keyOf(m)) - 1];
    const prev = pm && !withComp(comp, ()=>isUpcoming(pm)) ? clubGames(c, comp).find(g=>g.m===pm || keyOf(g.m)===keyOf(pm)) : null;
    if(prev){
      (ALL.cards||[]).filter(x=>x.club===c && isRed(x.type) && x.r===prev.m.round && compOf(x)===compOf(prev.m)).forEach(x=>{
        if(seen.has(x.p)) return; seen.add(x.p); out.push({n:x.p, why:"موقوف", sub:`طرد أمام ${prev.opp}`}); });
      ycBans(c, comp).filter(b=>b.r===prev.m.round).forEach(b=>{
        if(seen.has(b.p)) return; seen.add(b.p); out.push({n:b.p, why:"موقوف", sub:`تراكم ${b.k} إنذارات`}); });
    }
    (SQUADS[c]||[]).forEach(e=>{ const n=sqName(e); if(seen.has(n)) return;
      const w = fnOK("absentWhy") ? absentWhy(m, c, n) : ""; if(w){ seen.add(n); out.push({n, why:w}); } });
    if(FMX_RULES.ycBan>0 && prev){   /* «مهدد» للمباراة القادمة فقط */
      const q={}; (ALL.cards||[]).filter(x=>x.club===c && compOf(x)===comp && isYellow(x.type)).forEach(x=>q[x.p]=(q[x.p]||0)+1);
      Object.entries(q).filter(([n,k])=>k%FMX_RULES.ycBan===FMX_RULES.ycBan-1 && !seen.has(n)).forEach(([n,k])=>out.push({n, why:"مهدد بالإيقاف", sub:`${k} إنذارات`}));
    }
    return out;
  };
  const A = side(m.home), B = side(m.away);
  if(!A.length && !B.length) return "";
  const col = (c, L) => `<div class="fmx-abs-c"><div class="fmx-abs-h">${crest(c)}<b>${H(c)}</b></div>${L.length ? L.map(x=>
    `<div class="fmx-abs-r">${plBtn(x.n, c)}<span class="fmx-tag${/موقوف|طرد/.test(x.why)?" r":""}">${H(x.why)}</span>${x.sub?`<small>${H(x.sub)}</small>`:""}</div>`).join("") : `<p class="fmx-none">لا غيابات مسجّلة</p>`}</div>`;
  return card("الغيابات", `<div class="fmx-abs">${col(m.home,A)}${col(m.away,B)}</div>`);
}
/* لو انتهت الآن: الترتيب قبل الانطلاق مقابل الترتيب بالنتيجة الحالية + المباريات الجارية الأخرى */
function liveCard(m){
  let html = "";
  if(compOf(m)===LG){
    const pre = leagueTable({exclude:keyOf(m)}), now = leagueTable();
    const rows = [m.home, m.away].map(c=>{ const a=posIn(pre,c), b=posIn(now,c), r=now.find(x=>x.c===c)||{Pts:0};
      const d = a-b; return `<tr data-club-open="${H(c)}"><td class="club"><span>${crest(c)}<b>${H(c)}</b></span></td><td>${a}</td>
        <td><span class="fmx-mv ${d>0?"up":d<0?"dn":"eq"}" dir="ltr">${b}${d?`<i>${Math.abs(d)}</i>`:""}</span></td><td class="pts">${r.Pts}</td></tr>`; }).join("");
    html += `<table class="mp-tbl fmx-livetbl"><thead><tr><th class="club">النادي</th><th>قبل المباراة</th><th>الآن</th><th>ن</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  const others = withComp("الكل", ()=>liveMatches()).filter(x=>keyOf(x)!==keyOf(m));
  if(others.length) html += `<div class="fmx-sub">مباريات جارية الآن</div>${others.map(x=>`<div class="fmx-lrow" data-mopen="${keyOf(x)}">
    <span class="t h">${H(x.home)}${crest(x.home)}</span><b dir="ltr">${x.hg} - ${x.ag}</b><span class="t a">${crest(x.away)}${H(x.away)}</span><small>${liveMinute(x)}</small></div>`).join("")}`;
  return html ? card("لو انتهت الآن", html, "fmx-live") : "";
}
/* ملخص المباراة: جمل من أحداثها فقط */
function summaryCard(m){
  const comp = compOf(m);
  const gs = withComp(comp, ()=>matchGoals(m)).slice().sort((a,b)=>goalAbs(m,a)-goalAbs(m,b));
  const hg=+m.hg||0, ag=+m.ag||0, W = hg>ag?m.home:ag>hg?m.away:null, L = W ? (W===m.home?m.away:m.home) : null;
  const out = [];
  out.push(W ? `فاز ${W} على ${L} ${Math.max(hg,ag)}-${Math.min(hg,ag)}` : `تعادل ${m.home} و${m.away} ${hg}-${ag}`);
  if(gs.length){
    const f = gs[0]; out.push(`${isOG(f)?(f.og||f.p)+" (عكسي)":f.p} افتتح التسجيل في الدقيقة ${minLabel(f).replace("'","")}`);
    if(W && f.sc!==W) out.push(`${W} قلب تأخره إلى فوز`);
    /* هدف الحسم المتأخر: آخر هدف للفائز كسر التعادل بعد الدقيقة 80 */
    if(W){ let h=0,a=0, decisive=null;
      gs.forEach(g=>{ const tied = h===a; if(g.sc===m.home) h++; else a++; if(tied && g.sc===W) decisive=g; });
      if(decisive && goalAbs(m,decisive)>=80 && Math.abs(hg-ag)===1) out.push(`هدف الفوز جاء في الدقيقة ${minLabel(decisive).replace("'","")} عبر ${decisive.p}`);
    }
    const by = {}; gs.filter(g=>!isOG(g)).forEach(g=>{ const k=g.p+"|"+g.sc; by[k]=(by[k]||0)+1; });
    Object.entries(by).filter(([,n])=>n>=2).forEach(([k,n])=>out.push(`${k.split("|")[0]} سجّل ${n===2?"هدفين":n===3?"ثلاثية (هاتريك)":n+" أهداف"}`));
  }
  if(!hg && !ag) {} else if(!ag) out.push(`${m.home} حافظ على نظافة شباكه`); else if(!hg) out.push(`${m.away} حافظ على نظافة شباكه`);
  (ALL.cards||[]).filter(x=>x.r===m.round && compOf(x)===comp && (x.club===m.home||x.club===m.away) && isRed(x.type))
    .forEach(x=>out.push(`طُرد ${x.p} (${x.club})${x.m?` في الدقيقة ${x.m}${x.x?"+"+x.x:""}`:""}`));
  const R = ok(()=>[m.home,m.away].flatMap(c=>matchRatings(m,c).map(x=>({n:x.n, c, v:x.r.v})))) || [];
  if(R.length){ const b = R.sort((a,b)=>b.v-a.v)[0]; out.push(`الأعلى تقييماً: ${b.n} (${b.v.toFixed(1)})`); }
  return card("ملخص المباراة", sentences(out), "fmx-sum");
}
if(fnOK("mpDetails")){
  const _mpDetails = mpDetails;
  window.mpDetails = mpDetails = function(m){
    let h = _mpDetails.apply(this, arguments);
    if(skipMatch(m)) return h;
    const at = h.indexOf('<div class="mp-card mp-info">');
    let add = "";
    if(isUpcoming(m)) add = ok(()=>previewCard(m)) + ok(()=>absencesCard(m));
    else if(isLive(m)) add = ok(()=>liveCard(m));
    if(add) h = at>=0 ? h.slice(0,at) + add + h.slice(at) : h + add;
    if(!isUpcoming(m) && !isLive(m)){ const s = ok(()=>summaryCard(m)); const e = h.indexOf("</button>");
      if(s) h = e>=0 ? h.slice(0,e+9) + s + h.slice(e+9) : s + h; }
    return h;
  };
}
/* تبويب التشكيلة: عدّاد التبديلات + التغييرات عن المباراة السابقة */
function changesHTML(m, club){
  const xi = xiNames(m.round, compOf(m), club); if(!xi.length) return "";
  const prev = clubGames(club).filter(g=>ts(g.m) < ts(m) && xiNames(g.m.round, compOf(g.m), club).length).pop();
  if(!prev) return "";
  const px = xiNames(prev.m.round, compOf(prev.m), club);
  const inn = xi.filter(n=>!px.includes(n)), out = px.filter(n=>!xi.includes(n));
  const chips = (L, cls) => L.map(n=>`<span class="fmx-chg ${cls}" data-player="${H(n)}" data-club="${H(club)}">${H(shortName(n))}</span>`).join("");
  return `<div class="mpt-hd">مقارنة بالمباراة السابقة<span class="sq-n">${H(prev.opp)}</span></div>
    ${inn.length||out.length ? `<div class="fmx-chgs"><div><small>دخل</small>${chips(inn,"in")}</div><div><small>خرج</small>${chips(out,"out")}</div></div>`
      : `<p class="fmx-none">نفس التشكيلة الأساسية</p>`}`;
}
if(fnOK("mpTeamSection")){
  const _mpTS = mpTeamSection;
  window.mpTeamSection = mpTeamSection = function(m){
    let h = _mpTS.apply(this, arguments);
    if(skipMatch(m)) return h;
    h = h.replace(/(<div class="mpt-hd">التبديلات<span class="sq-n">)(\d+)(<\/span>)/, (s,a,n,b)=>`${a}<span dir="ltr">${n}/${FMX_RULES.maxSubs}</span>${b}`);
    const club = (typeof MP_LT!=="undefined" && MP_LT==="away") ? m.away : m.home;
    const ch = ok(()=>changesHTML(m, club));
    if(ch){ const i = h.lastIndexOf("</div>"); h = h.slice(0,i) + ch + h.slice(i); }
    return h;
  };
}
/* زر تبديل الفريق في «التشكيلة الأكثر استخداماً» */
document.addEventListener("click", e=>{
  const b = e.target.closest("[data-fmx-xi]"); if(!b) return;
  const box = b.closest(".fmx-pre"); if(!box) return;
  box.querySelectorAll("[data-fmx-xi]").forEach(x=>x.setAttribute("aria-pressed", String(x===b)));
  box.querySelectorAll("[data-fmx-xp]").forEach(p=>p.hidden = p.dataset.fmxXp!==b.dataset.fmxXi);
});

/* ═════════════ صفحة النادي ═════════════ */
function positionChart(c){
  const games = clubGames(c, LG); if(games.length<2) return "";
  const rounds = [...new Set(games.map(g=>+g.m.round||0))].sort((a,b)=>a-b);
  const N = CLUBS.length || 12;
  const pts = rounds.map(r=>({r, p: posIn(leagueTable({upTo:r}), c)})).filter(x=>x.p>0);
  if(pts.length<2) return "";
  const W=340, Hh=170, L=26, R=12, T=14, B=26, x = i => L + (W-L-R)*(pts.length===1?0.5:i/(pts.length-1)), y = p => T + (Hh-T-B)*((p-1)/Math.max(1,N-1));
  const grid = [1, Math.ceil(N/2), N].map(p=>`<line x1="${L}" x2="${W-R}" y1="${y(p)}" y2="${y(p)}" class="g"/><text x="${L-8}" y="${y(p)+4}" class="ax">${p}</text>`).join("");
  const line = pts.map((q,i)=>`${x(i).toFixed(1)},${y(q.p).toFixed(1)}`).join(" ");
  const dots = pts.map((q,i)=>`<circle cx="${x(i).toFixed(1)}" cy="${y(q.p).toFixed(1)}" r="9"/><text x="${x(i).toFixed(1)}" y="${(y(q.p)+3.6).toFixed(1)}" class="v">${q.p}</text>
    <text x="${x(i).toFixed(1)}" y="${Hh-6}" class="ax">ج${q.r}</text>`).join("");
  return `<h2 class="sec">مسار الترتيب</h2><div class="card pad fmx-pos"><svg viewBox="0 0 ${W} ${Hh}" dir="ltr" role="img" aria-label="مسار الترتيب">${grid}
    <polyline points="${line}" class="ln"/>${dots}</svg></div>`;
}
function recordsHTML(c){
  const G = clubGames(c, COMP); if(!G.length) return "";
  const rng = r => r.n ? `<small>${r.from===r.to ? `<span>ج${r.from.m.round}</span>` : `<span>ج${r.from.m.round}</span> – <span>ج${r.to.m.round}</span>`}</small>` : "";
  const runs = [
    ["أطول سلسلة انتصارات", longestRun(G, g=>g.k==="w")],
    ["أطول سلسلة بلا خسارة", longestRun(G, g=>g.k!=="l")],
    ["أطول سلسلة بلا فوز", longestRun(G, g=>g.k!=="w")],
    ["شباك نظيفة متتالية", longestRun(G, g=>g.ga===0)],
    ["مباريات متتالية بالتسجيل", longestRun(G, g=>g.gf>0)]
  ];
  const big = (f, s) => { const x=[...G].filter(f).sort(s)[0]; return x ? `<b dir="ltr">${x.gf}-${x.ga}</b> <small>${H(x.home?"ضد":"أمام")} ${H(x.opp)}</small>` : "—"; };
  const rows = [
    ...runs.map(([t,r])=>[t, r.n ? `<b>${nMatches(r.n)}</b> ${rng(r)}` : "—"]),
    ["أكبر فوز", big(g=>g.k==="w", (a,b)=>(b.gf-b.ga)-(a.gf-a.ga) || b.gf-a.gf)],
    ["أكبر خسارة", big(g=>g.k==="l", (a,b)=>(b.ga-b.gf)-(a.ga-a.gf) || b.ga-a.ga)],
    ["أكثر مباراة أهدافاً", big(()=>true, (a,b)=>(b.gf+b.ga)-(a.gf+a.ga))]
  ];
  return `<h2 class="sec">أرقام الفريق</h2><div class="card pad fmx-rec">${rows.map(([t,v])=>`<div class="stat"><span>${t}</span><span class="v">${v}</span></div>`).join("")}</div>`;
}
function insightsHTML(c){
  const gf = GOALS.filter(g=>g.sc===c), ga = GOALS.filter(g=>g.cd===c), n = gf.length;
  if(n<3 && ga.length<3) return "";
  const out = [];
  const gS = k => k===2 ? "هدفان" : (k>=3&&k<=10) ? `${k} أهداف` : `${k} هدفاً`;   /* مبتدأ: هدفان / 3 أهداف / 11 هدفاً */
  const sp = gf.filter(isSetPiece).length; if(sp>=2) out.push(`${sp} من ${gw(n)} جاءت من كرات ثابتة`);
  const pen = gf.filter(g=>/جزاء/.test(g.det||"")).length; if(pen>=2) out.push(`${gS(pen)} من ركلات جزاء`);
  const hd = gf.filter(isHeader).length; if(hd>=2) out.push(`${gS(hd)} بالرأس`);
  if(n>=4){ const s2 = gf.filter(g=>abs(g)>45 && !(g.m===45 && g.x)).length; out.push(`${Math.round(s2/n*100)}% من أهدافه في الشوط الثاني`); }
  const late = gf.filter(g=>abs(g)>75).length; if(late>=2) out.push(`سجّل ${nGoals(late)} بعد الدقيقة 75`);
  const lateA = ga.filter(g=>abs(g)>75).length; if(lateA>=2) out.push(`استقبل ${nGoals(lateA)} بعد الدقيقة 75`);
  const early = ga.filter(g=>abs(g)<=15).length; if(early>=2) out.push(`استقبل ${nGoals(early)} في أول 15 دقيقة`);
  const dets = {}; gf.forEach(g=>{ if(g.det) dets[g.det]=(dets[g.det]||0)+1; });
  const topDet = Object.entries(dets).sort((a,b)=>b[1]-a[1])[0]; if(topDet && topDet[1]>=2) out.push(`أكثر طرق التسجيل: ${topDet[0]} (${topDet[1]})`);
  const as = {}; gf.forEach(g=>{ if(g.a && !isOG(g)) as[g.a]=(as[g.a]||0)+1; });
  const topA = Object.entries(as).sort((a,b)=>b[1]-a[1])[0]; if(topA && topA[1]>=2) out.push(`${topA[0]} صنع ${nGoals(topA[1])}`);
  const who = new Set(gf.filter(g=>!isOG(g)).map(g=>g.p)); if(who.size>=3) out.push(`${who.size} ${who.size<=10?"لاعبين":"لاعباً"} سجّلوا للفريق`);
  return out.length ? `<h2 class="sec">قراءة في الأهداف</h2><div class="card pad">${sentences(out)}</div>` : "";
}
function byLineHTML(c){
  const gf = GOALS.filter(g=>g.sc===c), ga = GOALS.filter(g=>g.cd===c);
  if(!gf.length && !ga.length) return "";
  const tally = (L, clubOfScorer) => { const t={G:0,D:0,M:0,F:0,og:0,x:0};
    L.forEach(g=>{ if(isOG(g)){ t.og++; return; } const l=lineOf(clubOfScorer(g), g.p); if(l) t[l]++; else t.x++; }); return t; };
  const F = tally(gf, g=>g.sc), A = tally(ga, g=>g.sc);
  const tiles = (t, tot) => `<div class="fmx-lines">${LINES.map(L=>`<div class="fmx-line"><b>${t[L]}</b><small>${LINE_AR[L]}</small><i style="--w:${tot?Math.round(t[L]/tot*100):0}%"></i></div>`).join("")}${t.og?`<div class="fmx-line og"><b>${t.og}</b><small>عكسي</small></div>`:""}</div>`;
  return `<h2 class="sec">الأهداف حسب مركز المسجّل</h2><div class="card pad fmx-bl">
    <div class="fmx-sub">سجّل</div>${tiles(F, gf.length)}<div class="fmx-sub">استقبل</div>${tiles(A, ga.length)}</div>`;
}
function depthHTML(c){
  const pp = playerPlayOf(c); if(!pp.length) return "";
  const by = {G:[],D:[],M:[],F:[]};
  pp.forEach(p=>{ const l = lineOf(c, p.n); if(by[l]) by[l].push(p); });
  const col = L => `<div class="fmx-dep"><h4>${LINE_AR[L]}</h4>${by[L].slice(0,3).map((p,i)=>`<div class="fmx-dep-r" data-player="${H(p.n)}" data-club="${H(c)}"><i>${i+1}</i><span>${H(shortName(p.n))}</span><small>${p.mins}′</small></div>`).join("") || '<p class="fmx-none">—</p>'}</div>`;
  return `<h2 class="sec">عمق التشكيلة</h2><div class="card pad fmx-depth">${LINES.map(col).join("")}</div>`;
}
if(fnOK("renderClubBody")){
  const _rcb = renderClubBody;
  window.renderClubBody = renderClubBody = function(c){
    const r = _rcb.apply(this, arguments);
    ok(()=>{
      if(!CLUBS.includes(c)) return;
      const panel = document.querySelector('#clubBody .ctab-panel[data-cp="stats"]'); if(!panel) return;
      const html = ok(()=>positionChart(c)) + ok(()=>recordsHTML(c)) + ok(()=>insightsHTML(c)) + ok(()=>byLineHTML(c)) + ok(()=>depthHTML(c));
      const anchor = [...panel.querySelectorAll("h2.sec")].find(h=>/^الانضباط/.test(h.textContent.trim()));
      if(anchor) anchor.insertAdjacentHTML("beforebegin", html); else panel.insertAdjacentHTML("beforeend", html);
    });
    return r;
  };
}

/* ═════════════ ملف اللاعب ═════════════ */
function formBars(D){
  const L = D.log.slice(0,5).map(l=>({l, v: ok(()=> ratingsReady(l.m) ? (playerRating(l.m, l.wc, D.name)||{}).v : null) || null}));
  if(!L.some(x=>x.v)) return "";
  const bar = x => { const v=x.v, h = v ? Math.max(8, Math.min(100, (v-4)/6*100)) : 0;
    return `<div class="fmx-fb" data-mopen="${keyOf(x.l.m)}"><div class="fmx-fb-t">${v?`<i class="${ratingCls(v)}" style="height:${h.toFixed(0)}%"><b>${v.toFixed(1)}</b></i>`:`<i class="na"><b>—</b></i>`}</div>
      ${crest(x.l.opp)}<small>${x.l.k==="w"?"ف":x.l.k==="l"?"خ":"ت"} <span dir="ltr">${H(x.l.res)}</span></small></div>`; };
  return `<div class="fmx-pp"><h4>آخر 5 مباريات</h4><div class="fmx-fbars">${L.map(bar).join("")}</div></div>`;
}
function roleOf(D){
  if(D.former && D.former.length) return null;
  const tot = MATCHES.filter(m=>(m.home===D.club||m.away===D.club) && doneIn(m)).reduce((s,m)=>s+matchLen(m),0);
  if(!tot || !D.mins) return null;
  const sh = D.mins/tot;
  const t = sh>=.75 ? "عنصر أساسي" : sh>=.45 ? "أساسي بالتناوب" : sh>=.15 ? "بديل" : "مشاركات محدودة";
  return {t, pct: Math.round(sh*100)};
}
function usageHTML(D){
  if(!D.apps) return "";
  const st = (v,t) => `<div class="pstat"><b>${v}</b><small>${t}</small></div>`;
  const w = D.log.filter(l=>l.k==="w").length, d = D.log.filter(l=>l.k==="d").length, l = D.log.filter(l=>l.k==="l").length;
  const starts = D.log.filter(x=>!x.sub).length, subs = D.log.filter(x=>x.sub).length;
  const role = roleOf(D);
  const cells = [
    role ? st(`<span class="fmx-role">${H(role.t)}</span>`, `${role.pct}% من دقائق الفريق`) : "",
    st(`${starts} / ${subs}`, "أساسي / بديل"),
    st(`${w} - ${d} - ${l}`, "فوز - تعادل - خسارة"),
    D.goals ? st(`${Math.round(D.mins/D.goals)}′`, "دقيقة لكل هدف") : "",
    D.assists ? st(`${Math.round(D.mins/D.assists)}′`, "دقيقة لكل صناعة") : ""
  ];
  return `<div class="fmx-pp"><h4>المشاركة</h4><div class="pprof-stats fmx-use">${cells.filter(Boolean).join("")}</div></div>`;
}
function cardsByComp(D){
  const clubs = [D.club, ...(D.former||[])];
  const L = (ALL.cards||[]).filter(x=>x.p===D.name && clubs.includes(x.club)); if(!L.length) return "";
  const by = {}; L.forEach(x=>{ const k=compOf(x); (by[k] ??= {y:0,r:0}); if(isRed(x.type)) by[k].r++; else if(isYellow(x.type)) by[k].y++; });
  return `<div class="fmx-pp"><h4>الإنذارات حسب البطولة</h4>${Object.entries(by).map(([k,v])=>`<div class="stat"><span>${H(k)}</span><span class="v">
    <b class="fmx-cp"><i class="cardpill y"></i>${v.y}${FMX_RULES.ycBan?`<small dir="ltr">/${FMX_RULES.ycBan}</small>`:""}</b>${v.r?`<b class="fmx-cp"><i class="cardpill r"></i>${v.r}</b>`:""}</span></div>`).join("")}</div>`;
}
function milestonesHTML(D){
  const all = ok(()=>withComp("الكل", ()=>playerProfileData(D.name, D.club))); if(!all || !all.log.length) return "";
  const log = all.log.slice().sort((a,b)=>ts(a.m)-ts(b.m));
  const ev = []; let apps=0, g=0, a=0, firstG=false, firstA=false;
  /* كل جزء في span مستقل حتى يُترجم بالمطابقة التامة («ج⟨x⟩» و«ضد ⟨x⟩») */
  const at = l => `${compOf(l.m)===LG?"":`<span>${H(compOf(l.m))}</span> · `}<span>ج${l.m.round}</span> · <span>${l.home?"ضد":"أمام"} ${H(l.opp)}</span>`;
  log.forEach(l=>{
    apps++;
    if(apps===1) ev.push({t:"أول مشاركة", l});
    if([10,25,50,75,100].includes(apps)) ev.push({t:`المشاركة رقم ${apps}`, l});
    for(let i=0;i<l.g;i++){ g++; if(!firstG){ firstG=true; ev.push({t:"أول هدف", l}); } else if([5,10,15,20,25,30,40,50].includes(g)) ev.push({t:`الهدف رقم ${g}`, l}); }
    if(l.g>=3) ev.push({t:"ثلاثية (هاتريك)", l});
    for(let i=0;i<l.a;i++){ a++; if(!firstA){ firstA=true; ev.push({t:"أول صناعة", l}); } else if([5,10,15,20].includes(a)) ev.push({t:`الصناعة رقم ${a}`, l}); }
    if(l.r) ev.push({t:"طرد", l});
  });
  if(!ev.length) return "";
  return `<div class="fmx-pp"><h4>المحطات</h4><ol class="fmx-ms">${ev.reverse().map(e=>`<li data-mopen="${keyOf(e.l.m)}"><b>${H(e.t)}</b><small>${at(e.l)}</small><time>${H(dayLabel(e.l.m.date))}</time></li>`).join("")}</ol></div>`;
}
if(fnOK("playerProfileHTML")){
  const _pph = playerProfileHTML;
  window.playerProfileHTML = playerProfileHTML = function(D){
    let h = _pph.apply(this, arguments);
    if(!D || !D.apps) return h;
    const add = ok(()=>formBars(D)) + ok(()=>usageHTML(D)) + ok(()=>cardsByComp(D)) + ok(()=>milestonesHTML(D));
    if(!add) return h;
    const i = h.indexOf('<div class="pprof-log">');
    if(i>=0) return h.slice(0,i) + add + h.slice(i);
    const j = h.lastIndexOf("</div>"); return h.slice(0,j) + add + h.slice(j);
  };
}

/* ═════════════ صفحة المباريات ═════════════ */
/* اختصار ركلة الجزاء والهدف العكسي بلغة الواجهة (النص داخل <small> لا يمرّ على القاموس) */
const ABBR = {ar:{pen:"ج",og:"ع"}, en:{pen:"P",og:"OG"}, "pt-BR":{pen:"P",og:"GC"}, "pt-PT":{pen:"GP",og:"AG"}, es:{pen:"P",og:"PP"}, fr:{pen:"P",og:"CSC"}, sh:{pen:"P",og:"AG"}};
const abbr = () => { const l = (typeof I18N!=="undefined" && I18N.lang) ? I18N.lang() : "ar"; return ABBR[l] || ABBR.en; };
function scorerLines(m, club){
  const gs = withComp(compOf(m), ()=>matchGoals(m)).filter(g=>g.sc===club).sort((a,b)=>goalAbs(m,a)-goalAbs(m,b));
  const reds = (ALL.cards||[]).filter(x=>x.r===m.round && compOf(x)===compOf(m) && x.club===club && isRed(x.type));
  const by = []; gs.forEach(g=>{ const n = isOG(g) ? (g.og||g.p) : g.p, tag = isOG(g) ? " ("+abbr().og+")" : /جزاء/.test(g.det||"") ? " ("+abbr().pen+")" : "";
    const e = by.find(x=>x.n===n && x.og===isOG(g)); const t = minLabel(g)+tag; if(e) e.t.push(t); else by.push({n, og:isOG(g), c: isOG(g)?g.cd:club, t:[t]}); });
  return by.map(x=>`<span class="fmx-sc" data-player="${H(x.n)}" data-club="${H(x.c)}">${H(shortName(x.n))} <small dir="ltr">${x.t.join(", ")}</small></span>`).join("")
    + reds.map(x=>`<span class="fmx-sc red" data-player="${H(x.p)}" data-club="${H(club)}"><i class="cardpill r"></i>${H(shortName(x.p))}${x.m?` <small dir="ltr">${x.m}${x.x?"+"+x.x:""}'</small>`:""}</span>`).join("");
}
function decorateCards(root){
  const T = leagueTable(), rk = c => posIn(T, c);
  root.querySelectorAll(".mc[data-mopen]").forEach(el=>{
    if(el.dataset.fmx) return; el.dataset.fmx = "1";
    const m = matchByKey(el.dataset.mopen); if(!m || skipMatch(m)) return;
    if(compOf(m)===LG && T.some(x=>x.P)) [["h",m.home],["a",m.away]].forEach(([s,c])=>{ const cr=el.querySelector(`.mc-team.${s} .crest`), n=rk(c);
      if(cr && n) cr.insertAdjacentHTML("beforeend", `<span class="fmx-rk" title="المركز">${n}</span>`); });
    const up = withComp(compOf(m), ()=>isUpcoming(m)); if(up) return;
    const h = ok(()=>scorerLines(m, m.home)), a = ok(()=>scorerLines(m, m.away));
    if(h || a){ const f = el.querySelector(".mc-foot"); const det = `<div class="fmx-det"><div class="h">${h}</div><div class="a">${a}</div></div>`;
      if(f) f.insertAdjacentHTML("beforebegin", det); else el.insertAdjacentHTML("beforeend", det); }
  });
}
function roundupHTML(){
  if(SELR===null || SELDAY || COMP==="الكل") return "";
  const L = MATCHES.filter(m=>m.round===SELR && doneIn(m)); if(L.length<2) return "";
  const out = [];
  const big = [...L].sort((a,b)=>Math.abs(b.hg-b.ag)-Math.abs(a.hg-a.ag) || (b.hg+b.ag)-(a.hg+a.ag))[0];
  if(big && big.hg!==big.ag){ const w = big.hg>big.ag; out.push(`أكبر فوز: ${w?big.home:big.away} ${Math.max(big.hg,big.ag)}-${Math.min(big.hg,big.ag)} ${w?big.away:big.home}`); }
  const hi = [...L].sort((a,b)=>(b.hg+b.ag)-(a.hg+a.ag))[0];
  if(hi && hi!==big && hi.hg+hi.ag>=4) out.push(`أكثر مباراة أهدافاً: ${hi.home} ${hi.hg}-${hi.ag} ${hi.away}`);
  const gs = GOALS.filter(g=>g.r===SELR && !isOG(g)), by = {}; gs.forEach(g=>{ const k=g.p+"|"+g.sc; by[k]=(by[k]||0)+1; });
  Object.entries(by).filter(([,n])=>n>=2).sort((a,b)=>b[1]-a[1]).forEach(([k,n])=>{ const [p,c]=k.split("|"); out.push(`${p} (${c}) سجّل ${n===2?"هدفين":n===3?"ثلاثية (هاتريك)":n+" أهداف"}`); });
  const dr = L.filter(m=>m.hg===m.ag).length; if(dr) out.push(dr===1 ? "تعادل واحد في الجولة" : `${dr} تعادلات في الجولة`);
  const cs = L.reduce((s,m)=>s+(+m.hg===0)+(+m.ag===0),0); if(cs>=2) out.push(`${cs} فرق حافظت على نظافة شباكها`);
  if(COMP===LG){ const T = leagueTable({upTo:SELR}); if(T[0] && T[0].P) out.push(`${T[0].c} في الصدارة بعد الجولة برصيد ${T[0].Pts} نقطة`); }
  return out.length ? `<div class="fmx-roundup"><h3>حصاد الجولة</h3>${sentences(out)}</div>` : "";
}
["renderMatches","renderUpcomingMatches"].forEach(name=>{
  if(!fnOK(name)) return;
  const _f = window[name];
  const wrapped = function(){
    const r = _f.apply(this, arguments);
    ok(()=>{ const V = document.getElementById("v-matches"); if(!V) return;
      decorateCards(V);
      if(name==="renderMatches" && !V.querySelector(".fmx-roundup")){ const s = V.querySelector(".msum"), h = ok(roundupHTML); if(s && h) s.insertAdjacentHTML("afterend", h); }
    });
    return r;
  };
  window[name] = wrapped;
  if(name==="renderMatches") renderMatches = wrapped; else renderUpcomingMatches = wrapped;
});

/* ═════════════ التحليل — نظرة عامة ═════════════ */
function suspendedHTML(){
  const rows = [];
  (ALL.cards||[]).filter(x=>isRed(x.type)).forEach(x=>{
    const comp = compOf(x);
    const G = withComp(comp, ()=>MATCHES.filter(m=>m.home===x.club||m.away===x.club)).sort((a,b)=>ts(a)-ts(b));
    const i = G.findIndex(m=>m.round===x.r); if(i<0) return;
    const next = G.slice(i+1).find(()=>true); if(!next) return;
    if(!withComp(comp, ()=>isUpcoming(next))) return;
    rows.push({x, next, opp: next.home===x.club?next.away:next.home, from: G[i]});
  });
  CLUBS.forEach(c=>ycBans(c).forEach(b=>{
    const G = withComp(b.comp, ()=>MATCHES.filter(m=>m.home===c||m.away===c)).sort((a,b)=>ts(a)-ts(b));
    const i = G.findIndex(m=>m.round===b.r); if(i<0) return;
    const next = G[i+1]; if(!next || !withComp(b.comp, ()=>isUpcoming(next))) return;
    rows.push({x:{p:b.p, club:c}, next, opp: next.home===c?next.away:next.home, from: G[i], yc: b.k});
  }));
  if(!rows.length) return "";
  return `<h2 class="sec">الموقوفون للمباراة القادمة</h2><div class="an-card fmx-susp">${rows.map(r=>`<div class="fmx-susp-r">
    ${crest(r.x.club)}${plBtn(r.x.p, r.x.club, `<b>${H(r.x.p)}</b>`)}<small>${r.yc ? `تراكم ${r.yc} إنذارات` : `طرد أمام ${H(r.from.home===r.x.club?r.from.away:r.from.home)}`}</small>
    <span class="fmx-tag r" data-mopen="${keyOf(r.next)}">يغيب أمام ${H(r.opp)}</span></div>`).join("")}</div>`;
}
function seasonRecordsHTML(){
  const rows = [];
  const runs = CLUBS.map(c=>({c, G: clubGames(c, COMP)})).filter(x=>x.G.length);
  if(!runs.length) return "";
  const best = (pred, label) => { const R = runs.map(x=>({c:x.c, r:longestRun(x.G, pred)})).sort((a,b)=>b.r.n-a.r.n)[0];
    if(R && R.r.n>=2) rows.push([label, `<b>${nMatches(R.r.n)}</b>`, R.c]); };
  best(g=>g.k==="w", "أطول سلسلة انتصارات");
  best(g=>g.k!=="l", "أطول سلسلة بلا خسارة");
  best(g=>g.ga===0, "أطول سلسلة شباك نظيفة");
  const cur = runs.map(x=>({c:x.c, n:currentRun(x.G, g=>g.k!=="l")})).sort((a,b)=>b.n-a.n)[0];
  if(cur && cur.n>=3) rows.push(["بلا خسارة حالياً", `<b>${nMatches(cur.n)}</b>`, cur.c]);
  const by = {}; GOALS.filter(g=>!isOG(g)).forEach(g=>{ const k=[g.p,g.sc,g.r,compOf(g),g.cd].join("|"); by[k]=(by[k]||0)+1; });
  const top = Object.entries(by).sort((a,b)=>b[1]-a[1])[0];
  if(top && top[1]>=2){ const [p,c,r,,cd]=top[0].split("|"); rows.push(["أكثر أهداف للاعب في مباراة", `<b>${nGoals(top[1])}</b> <small><span>${H(p)} ضد ${H(cd)}</span> · <span>ج${H(r)}</span></small>`, c]); }
  const ht = Object.values(by).filter(n=>n>=3).length; if(ht) rows.push(["الثلاثيات (هاتريك)", `<b>${ht}</b>`, ""]);
  const done = MATCHES.filter(doneIn); const dr = done.filter(m=>m.hg===m.ag).length;
  if(done.length){ const hw = done.filter(m=>m.hg>m.ag).length, aw = done.filter(m=>m.ag>m.hg).length;
    rows.push(["فوز المستضيف / تعادل / فوز الضيف", `<b>${hw} / ${dr} / ${aw}</b>`, ""]); }
  if(!rows.length) return "";
  return `<h2 class="sec">أرقام الموسم</h2><div class="an-card fmx-srec">${rows.map(([t,v,c])=>`<div class="stat"><span>${t}</span><span class="v">${c?`<span class="fmx-cl" data-club-open="${H(c)}">${crest(c)}${H(c)}</span>`:""}${v}</span></div>`).join("")}</div>`;
}
if(fnOK("anOverviewHTML")){
  const _ao = anOverviewHTML;
  window.anOverviewHTML = anOverviewHTML = function(){
    return ok(suspendedHTML) + ok(seasonRecordsHTML) + _ao.apply(this, arguments);
  };
}

/* ═════════════ الترجمة الإنجليزية لنصوص هذا الملف ═════════════ */
const EN = {
  "قبل المباراة":"Pre-match","الغيابات":"Absences","لو انتهت الآن":"If it ended now","ملخص المباراة":"Match summary",
  "المركز":"Position","آخر 5":"Last 5","المدرب":"Coach","الهدّاف":"Top scorer","الأكثر صناعة":"Most assists","الأعلى تقييماً":"Top rated",
  "التشكيلة الأكثر استخداماً":"Most-used XI","موقوف":"Suspended","غائب":"Absent","مهدد بالإيقاف":"One booking from a ban","لا غيابات مسجّلة":"No recorded absences",
  "قبل المباراة ":"Before kick-off","الآن":"Now","مباريات جارية الآن":"Other live matches","مقارنة بالمباراة السابقة":"Changes from previous match",
  "دخل":"In","خرج":"Out","نفس التشكيلة الأساسية":"Same starting XI","مسار الترتيب":"League position by round","أرقام الفريق":"Team records",
  "أطول سلسلة انتصارات":"Longest winning run","أطول سلسلة بلا خسارة":"Longest unbeaten run","أطول سلسلة بلا فوز":"Longest winless run",
  "شباك نظيفة متتالية":"Consecutive clean sheets","مباريات متتالية بالتسجيل":"Consecutive matches scoring","أكبر فوز":"Biggest win","أكبر خسارة":"Heaviest defeat",
  "أكثر مباراة أهدافاً":"Highest-scoring match","قراءة في الأهداف":"Goal insights","الأهداف حسب مركز المسجّل":"Goals by scorer position",
  "سجّل":"Scored","استقبل":"Conceded","حراسة":"GK","دفاع":"Defence","وسط":"Midfield","هجوم":"Attack","عكسي":"Own goal","عمق التشكيلة":"Squad depth",
  "آخر 5 مباريات":"Last 5 matches","المشاركة":"Involvement","أساسي / بديل":"Starts / Sub","فوز - تعادل - خسارة":"W - D - L",
  "دقيقة لكل هدف":"Mins per goal","دقيقة لكل صناعة":"Mins per assist","عنصر أساسي":"Key player","أساسي بالتناوب":"Rotation starter","بديل":"Substitute",
  "مشاركات محدودة":"Fringe","الإنذارات حسب البطولة":"Bookings by competition","المحطات":"Milestones","أول مشاركة":"Debut","أول هدف":"First goal",
  "أول صناعة":"First assist","طرد":"Sent off","ثلاثية (هاتريك)":"Hat-trick","حصاد الجولة":"Round roundup","الموقوفون للمباراة القادمة":"Suspended for next match",
  "أرقام الموسم":"Season records","أطول سلسلة شباك نظيفة":"Longest clean-sheet run","بلا خسارة حالياً":"Current unbeaten run",
  "أكثر أهداف للاعب في مباراة":"Most goals by a player in a match","الثلاثيات (هاتريك)":"Hat-tricks","فوز المستضيف / تعادل / فوز الضيف":"Home wins / Draws / Away wins",
  "تعادل واحد في الجولة":"One draw this round","مباراة واحدة":"1 match","مباراتين":"2 matches","هدف واحد":"1 goal","هدفين":"2 goals",
  "الفريقان متساويان في النقاط":"Both teams are level on points",
  "⟨x⟩ مباريات":"⟨x⟩ matches","⟨x⟩ مباراة":"⟨x⟩ matches","⟨x⟩ أهداف":"⟨x⟩ goals","⟨x⟩ هدفاً":"⟨x⟩ goals",
  "⟨x⟩ فاز في آخر ⟨x⟩":"⟨x⟩ won their last ⟨x⟩","⟨x⟩ بلا خسارة في آخر ⟨x⟩":"⟨x⟩ unbeaten in their last ⟨x⟩",
  "⟨x⟩ خسر آخر ⟨x⟩":"⟨x⟩ lost their last ⟨x⟩","⟨x⟩ بلا فوز في آخر ⟨x⟩":"⟨x⟩ without a win in their last ⟨x⟩",
  "الفارق بين الفريقين ⟨x⟩":"Gap between the teams: ⟨x⟩","آخر مواجهة: ⟨x⟩":"Last meeting: ⟨x⟩",
  "فاز ⟨x⟩ على ⟨x⟩ ⟨x⟩":"⟨x⟩ beat ⟨x⟩ ⟨x⟩","تعادل ⟨x⟩ و⟨x⟩ ⟨x⟩":"⟨x⟩ and ⟨x⟩ drew ⟨x⟩","⟨x⟩ افتتح التسجيل في الدقيقة ⟨x⟩":"⟨x⟩ opened the scoring in minute ⟨x⟩",
  "⟨x⟩ قلب تأخره إلى فوز":"⟨x⟩ came from behind to win","هدف الفوز جاء في الدقيقة ⟨x⟩ عبر ⟨x⟩":"The winner came in minute ⟨x⟩ from ⟨x⟩",
  "⟨x⟩ سجّل ⟨x⟩":"⟨x⟩ scored ⟨x⟩","⟨x⟩ حافظ على نظافة شباكه":"⟨x⟩ kept a clean sheet","طُرد ⟨x⟩ (⟨x⟩) في الدقيقة ⟨x⟩":"⟨x⟩ (⟨x⟩) sent off in minute ⟨x⟩",
  "طُرد ⟨x⟩ (⟨x⟩)":"⟨x⟩ (⟨x⟩) sent off","الأعلى تقييماً: ⟨x⟩ (⟨x⟩)":"Top rated: ⟨x⟩ (⟨x⟩)","طرد أمام ⟨x⟩":"Sent off v ⟨x⟩","يغيب أمام ⟨x⟩":"Misses ⟨x⟩",
  "⟨x⟩ من ⟨x⟩ جاءت من كرات ثابتة":"⟨x⟩ of ⟨x⟩ came from set pieces","⟨x⟩ من ركلات جزاء":"⟨x⟩ from penalties",
  "⟨x⟩ بالرأس":"⟨x⟩ headed","⟨x⟩% من أهدافه في الشوط الثاني":"⟨x⟩% of their goals came in the second half","هدفان":"2 goals",
  "سجّل ⟨x⟩ بعد الدقيقة 75":"Scored ⟨x⟩ after the 75th minute","استقبل ⟨x⟩ بعد الدقيقة 75":"Conceded ⟨x⟩ after the 75th minute",
  "استقبل ⟨x⟩ في أول 15 دقيقة":"Conceded ⟨x⟩ in the first 15 minutes","أكثر طرق التسجيل: ⟨x⟩ (⟨x⟩)":"Most common goal type: ⟨x⟩ (⟨x⟩)",
  "⟨x⟩ صنع ⟨x⟩":"⟨x⟩ assisted ⟨x⟩","⟨x⟩ لاعبين سجّلوا للفريق":"⟨x⟩ different players have scored","⟨x⟩ لاعباً سجّلوا للفريق":"⟨x⟩ different players have scored",
  "⟨x⟩% فوز":"⟨x⟩% wins",
  "⟨x⟩ من دقائق الفريق":"⟨x⟩ of team minutes","المشاركة رقم ⟨x⟩":"Appearance no. ⟨x⟩","الهدف رقم ⟨x⟩":"Goal no. ⟨x⟩","الصناعة رقم ⟨x⟩":"Assist no. ⟨x⟩",
  "أكبر فوز: ⟨x⟩":"Biggest win: ⟨x⟩","أكثر مباراة أهدافاً: ⟨x⟩":"Highest-scoring: ⟨x⟩","⟨x⟩ تعادلات في الجولة":"⟨x⟩ draws this round",
  "⟨x⟩ فرق حافظت على نظافة شباكها":"⟨x⟩ teams kept clean sheets","⟨x⟩ في الصدارة بعد الجولة برصيد ⟨x⟩ نقطة":"⟨x⟩ top the table after this round on ⟨x⟩ points",
  "ضد ⟨x⟩":"v ⟨x⟩","أمام ⟨x⟩":"v ⟨x⟩","⟨x⟩ (عكسي)":"⟨x⟩ (OG)","تراكم ⟨x⟩ إنذارات":"⟨x⟩ yellow cards","⟨x⟩ إنذارات":"⟨x⟩ yellow cards"
};
function addDict(){
  const I = (typeof I18N !== "undefined") ? I18N : window.I18N; if(!I || !I.DICT) return false;   /* I18N معرّف بـ const فلا يظهر على window */
  for(const k in EN) if(I.DICT[k]==null) I.DICT[k] = EN[k];
  I._cmp = null; I._keysSorted = null;
  return true;
}
if(!addDict()) document.addEventListener("DOMContentLoaded", addDict);
window.FMX = { rules: FMX_RULES, clubGames, leagueTable };
})();
