/* =========================================================
   صفحة المباريات حسب اليوم (منصور 2026-11-07: إعادة تصميم «جميع المباريات»)
   شريط تواريخ أفقي + تقويم شهري + «اليوم»، فلاتر الحالة (الكل/مباشر/القادمة/المنتهية) والبطولة و«فرقي»،
   أقسام حسب البطولة قابلة للطي، وكروت مضغوطة.
   للعرض فقط: نفس المصادر التي كانت تقرؤها «المباريات القادمة» (ALL.matches، extEvents/extGx، AMATEUR) —
   لا تُكتب أي بيانات، ولا تُخترع مباريات. الحالة (اليوم المختار والفلاتر والأقسام المطوية) في الذاكرة + sessionStorage.
   الكروت تحمل .mc/.mc-team/.mc-foot فيبقى ما يضيفه fmx.js (مركز الفريق والهدافون) كما هو.
   ========================================================= */
window.MXDAY = (function(){
  'use strict';
  const SK = 'mf_mxd', RANGE = 10;   /* الشريط: اليوم المختار ±10 أيام (يُسحب أفقياً)، 7 ظاهرة */
  const DOW = ["أحد","إثنين","ثلاثاء","أربعاء","خميس","جمعة","سبت"];
  const NT = ["ntfr","u17asia","u15wc","u17gulf","vetgulf","gulf27","asiad"];   /* المنتخب قبل مشاركات الأندية */
  const EXT_LOGO = new Set(["acc","acl2","asiad","gcl","gulf27","u15wc","u17asia","u17gulf","vetgulf"]);
  const p2 = n => String(n).padStart(2,"0");
  const isoOf = d => `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`;
  const dOf = s => new Date(s+"T12:00:00");
  const add = (s,n) => { const d=dOf(s); d.setDate(d.getDate()+n); return isoOf(d); };
  const today = () => isoOf(new Date());
  const H = s => (typeof esc==="function" ? esc(s) : String(s==null?"":s));
  const cnt = n => n===1 ? "مباراة واحدة" : n===2 ? "مباراتان" : (n>=3&&n<=10) ? `${n} مباريات` : `${n} مباراة`;
  const SV = (p,w) => `<svg viewBox="0 0 24 24" width="${w||18}" height="${w||18}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const IC = {
    cal: SV('<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
    prev: SV('<path d="M9 6l6 6-6 6"/>',16), next: SV('<path d="M15 6l-6 6 6 6"/>',16),   /* RTL: السابق يميناً */
    chev: SV('<path d="M6 9l6 6 6-6"/>',16)
  };

  /* ---------- الحالة ---------- */
  const S = {d:null, st:"all", comp:"all", fav:false, col:{}, cal:null};
  try{ const v=JSON.parse(sessionStorage.getItem(SK)||"null");
    if(v){ S.st=v.st||"all"; S.comp=v.comp||"all"; S.fav=!!v.fav; S.col=v.col||{}; if(v.on===today() && v.d) S.d=v.d; } }catch(e){}
  const save = () => { try{ sessionStorage.setItem(SK, JSON.stringify({d:S.d, st:S.st, comp:S.comp, fav:S.fav, col:S.col, on:today()})); }catch(e){} };
  /* إعادة الرسم عبر renderMatches: تمرّ على أغلفة mf-shell (قائمة البطولة) و fmx.js (مركز الفريق والهدافون) */
  const redraw = () => { if(typeof renderMatches==="function" && typeof MXC!=="undefined" && MXC==="upcoming") renderMatches(); else render(); };

  /* ---------- البيانات (قراءة فقط) ---------- */
  function secOf(it){
    if(it.m){ const c=compOf(it.m), i=COMPS.indexOf(c);
      const logo = c==="الدوري" ? "assets/hero/kpl-mark.webp" : ((typeof COMP_LOGO!=="undefined" && COMP_LOGO[c]) || "");
      return {key:"c:"+c, name:c==="الدوري"?"الدوري الممتاز":c, ord:i<0?50:i, logo, kind:"c", id:c}; }
    if(it.e){ const c=it.c, n=NT.indexOf(c.id);
      return {key:"e:"+c.id, name:c.name, ord:n>=0?100+n:200+EXT_COMPS.indexOf(c), logo:EXT_LOGO.has(c.id)?`assets/comps/${c.id}.webp`:"", kind:"e", id:c.id}; }
    return {key:"am", name:"دوري الهواة", ord:300, logo:"assets/comps/amateur.webp", kind:"am", id:"amateur"};
  }
  function collect(){
    const out=[];
    ((typeof ALL!=="undefined" && ALL && ALL.matches)||[]).forEach(m=>{ if(m && m.date) out.push({d:m.date, ts:kickoffTS(m), m}); });
    (typeof EXT_COMPS!=="undefined" ? EXT_COMPS : []).forEach(c=>extEvents(c.id).forEach(e=>{
      if(!e || !e.d || (e.to && e.to!==e.d)) return;
      const parts=evParts(e); if(parts.length<2 || /نصف|نهائي|ربع|مباريات/.test(parts[0])) return;
      const a=evTeam(parts[0],e.k), b=evTeam(parts[1],e.k); if(!a || !b) return;
      out.push({d:e.d, ts:new Date(e.d+"T"+(normTime(e.time)||"23:59")+":00").getTime(), e, c, a, b});
    }));
    if(typeof amItems==="function") amItems(()=>true).forEach(x=>out.push(x));
    out.forEach(it=>{ it.sec=secOf(it); });
    return out;
  }
  function teamsOf(it){ return it.m ? [it.m.home, it.m.away] : it.e ? [it.a.n, it.b.n] : [it.am.home, it.am.away]; }
  const myTeams = () => { try{ return (window.NPREF && NPREF.prefs && NPREF.prefs.teams) || []; }catch(e){ return []; } };

  /* نموذج موحّد للكرت: الحالة والنتيجة والمعلومات الثانوية — نفس منطق البطاقات السابقة */
  function model(it){
    const x={st:"soon", time:"", sc:"", lab:"", notes:"", meta:[], open:"", note:"", rnd:""};
    if(it.m){ const m=it.m;
      const soon=isUpcoming(m), live=!soon && !matchOver(m);
      x.st = live ? "live" : soon ? "soon" : "done"; x.time = m.time||"";
      if(!soon) x.sc = scp(+m.hg||0, +m.ag||0);
      if(live) x.lab = m.status==="ht" ? "بين الشوطين" : ((LIVE_PHASES.includes(m.status) && mclkHTML(m)) || LIVE_PH_AR[m.status] || "مباشر");
      const P=psoOf(m);
      if(!soon) x.notes = P ? `ركلات الترجيح <span dir="ltr">${P.a} - ${P.h}</span>` : (hasET(m) && matchOver(m)) ? "بعد الأشواط الإضافية" : "";
      x.h = `${crest(m.home)}<b>${H(m.home)}</b>`; x.a = `${crest(m.away)}<b>${H(m.away)}</b>`;
      const tv=tvOf(m), ref=String((crewOf(m)||{}).ref||"").trim();
      if(tv && x.st!=="done") x.meta.push({t:tv, off:tv==="غير منقولة"});
      if(m.venue) x.meta.push({t:m.venue});
      if(ref && ref!=="لا يوجد") x.meta.push({k:"الحكم", t:ref});
      x.rnd = rndLabel(m); x.note = m.note||"";
      const k=matchKey(m); if(matchByKey(k)) x.open=`data-mopen="${H(k)}"`;
      return x; }
    if(it.e){ const e=it.e, c=it.c;
      const gx=extGx(c.id, e, it.a.n, it.b.n);
      let played=e.hg!=null && e.ag!=null, up=!played && e.d>=today(), liveNow=played && !!e.live, eh=e.hg, ea=e.ag;
      if(gx && gx.st){ up=gx.st==="soon"; played=!up; liveNow=gx.st==="live"; eh=gx.hg; ea=gx.ag; }
      x.st = liveNow ? "live" : up ? "soon" : "done"; x.time = String(e.time||"");
      if(x.st!=="soon") x.sc = (eh!=null && ea!=null && eh!=="" && ea!=="") ? scp(+eh,+ea) : "–";
      if(liveNow){ const ph=gx&&gx.ph; x.lab = ph==="ht" ? "بين الشوطين" : (ph && LIVE_PH_AR[ph]) || "مباشر"; }
      if(e.pso && e.pso.h!=null && e.pso.a!=null) x.notes = `ركلات الترجيح <span dir="ltr">${+e.pso.a} - ${+e.pso.h}</span>`;
      x.h = extTeamCell(it.a); x.a = extTeamCell(it.b);
      if(gx && gx.tv && x.st!=="done") x.meta.push({t:gx.tv});
      if(e.venue) x.meta.push({t:e.venue});
      if(gx && gx.ref) x.meta.push({k:"الحكم", t:gx.ref});
      x.rnd = e.n||""; if(gx && gx.k) x.open=`data-mopen="${H(gx.k)}"`;
      return x; }
    const m=it.am, p=m.hg!=null && m.ag!=null;
    const cr=c=>{ const s=window.AMATEUR && AMATEUR.crestSrc ? AMATEUR.crestSrc(c) : ""; return s?`<div class="crest has-logo" style="background:transparent"><img src="${s}" alt="" decoding="async"></div>`:`<div class="crest">${H(String(c).slice(0,2))}</div>`; };
    x.st = p ? "done" : "soon"; x.time = m.time||""; if(p) x.sc = scp(m.hg, m.ag);
    x.h = `${cr(m.home)}<b>${H(m.home)}</b>`; x.a = `${cr(m.away)}<b>${H(m.away)}</b>`;
    if(m.venue) x.meta.push({t:m.venue});
    x.rnd = `الجولة ${+m.round||1}`; x.open = 'data-am-open="1"';
    return x;
  }

  /* ---------- العرض ---------- */
  function cardHTML(it, x, fav){
    const mid = x.st==="soon"
      ? `<span class="mxd-time" dir="ltr">${x.time?H(x.time):"—"}</span><span class="mxd-lb">لم تبدأ</span>`
      : `<span class="mxd-sc" dir="ltr">${x.sc}</span>${x.st==="live" ? `<span class="mxd-lb live"><i></i>${x.lab}</span>` : `<span class="mxd-lb">انتهت</span>`}`;
    const meta = x.meta.map(z=>`<span class="${z.off?"off":""}">${z.k?`<em>${H(z.k)}</em> `:""}<bdi>${H(z.t)}</bdi></span>`).join("");
    return `<article class="mc mxd-c is-${x.st}${fav?" is-fav":""}" ${x.open}${x.open?' tabindex="0" role="link"':""}>
      <div class="mxd-r"><div class="mc-team h mxd-tm">${x.h}</div><div class="mxd-mid">${mid}</div><div class="mc-team a mxd-tm">${x.a}</div></div>
      ${x.notes?`<div class="mxd-nt">${x.notes}</div>`:""}
      ${meta?`<div class="mc-foot mxd-meta">${meta}</div>`:""}
      ${x.note?`<div class="mxd-note">${H(x.note)}</div>`:""}
    </article>`;
  }
  function dayWord(iso){
    const t=today(); if(iso===t) return "اليوم"; if(iso===add(t,-1)) return "أمس"; if(iso===add(t,1)) return "غداً";
    return DOW[dOf(iso).getDay()];
  }
  const longDay = iso => { const d=dOf(iso); return `${AR_DOW[d.getDay()]} ${d.getDate()} ${AR_MON[d.getMonth()]}`; };

  function stripHTML(sel, byDay){
    const t=today(); let h="";
    for(let i=-RANGE;i<=RANGE;i++){ const iso=add(sel,i), d=dOf(iso), L=byDay[iso]||[];
      const live=L.some(z=>z.x.st==="live");
      h+=`<button type="button" class="mxd-day${iso===t?" is-today":""}${L.length?" has":""}" data-mxd-d="${iso}" aria-pressed="${iso===sel}" aria-label="${H(longDay(iso))}${L.length?" · "+cnt(L.length):""}">
        <span class="w">${dayWord(iso)}</span><b>${d.getDate()}</b><i class="${live?"live":""}" aria-hidden="true"></i></button>`; }
    return h;
  }
  function calHTML(byDay){
    const [Y,M]=S.cal.split("-").map(Number), first=new Date(Y,M-1,1), days=new Date(Y,M,0).getDate();
    const off=(first.getDay()+1)%7, t=today();   /* الأسبوع يبدأ السبت */
    let cells=""; for(let i=0;i<off;i++) cells+=`<span class="e"></span>`;
    for(let d=1; d<=days; d++){ const iso=`${Y}-${p2(M)}-${p2(d)}`, n=(byDay[iso]||[]).length;
      cells+=`<button type="button" data-mxd-d="${iso}" class="${iso===t?"is-today":""}${n?" has":""}" aria-pressed="${iso===S.d}" aria-label="${H(longDay(iso))}${n?" · "+cnt(n):""}"><b>${d}</b><i aria-hidden="true"></i></button>`; }
    return `<div class="mxd-cal-bd" data-mxd-calx></div>
      <div class="mxd-cal-pn" role="dialog" aria-modal="true" aria-label="التقويم">
        <div class="mxd-cal-hd">
          <button type="button" class="mxd-ib" data-mxd-cm="-1" aria-label="الشهر السابق">${IC.prev}</button>
          <b>${AR_MON[M-1]} ${Y}</b>
          <button type="button" class="mxd-ib" data-mxd-cm="1" aria-label="الشهر التالي">${IC.next}</button>
        </div>
        <div class="mxd-cal-w">${["سبت","أحد","إثنين","ثلاثاء","أربعاء","خميس","جمعة"].map(w=>`<span>${w}</span>`).join("")}</div>
        <div class="mxd-cal-g">${cells}</div>
        <div class="mxd-cal-ft"><button type="button" class="mxd-pill" data-mxd-d="${t}">اليوم</button><button type="button" class="mxd-pill ghost" data-mxd-calx>إغلاق</button></div>
      </div>`;
  }

  function render(){
    const V=document.getElementById("v-matches"); if(!V) return;
    const t=today(); if(!S.d) S.d=t;
    const ready = typeof ALL!=="undefined" && ALL && (ALL.matches||[]).length;
    const head = `<div class="mx-head"><h2 class="mx-title">المباريات</h2>${compSelect()}</div>`;
    if(!ready){
      V.innerHTML = head + `<div class="mxd"><div class="mxd-load" aria-busy="true" aria-label="جارٍ التحميل">${'<div class="mxd-sk"><i></i><b></b><i></i></div>'.repeat(4)}</div></div>`;
      wireComp(V); wireDropdowns(V); return; }

    const mine=myTeams(), mineSet=new Set(mine);
    let all; withComp("الكل", ()=>{ all=collect().map(it=>({it, x:model(it), fav:teamsOf(it).some(n=>mineSet.has(n))})); });
    if(!mine.length) S.fav=false;
    const inComp = z => (S.comp==="all" || z.it.sec.key===S.comp) && (!S.fav || z.fav);
    const byDay={}; all.forEach(z=>{ if(inComp(z)) (byDay[z.it.d]||(byDay[z.it.d]=[])).push(z); });

    /* البطولات الحاضرة في نافذة الشريط (لا تختفي شريحة البطولة المختارة عند تغيير اليوم) */
    const lo=add(S.d,-RANGE), hi=add(S.d,RANGE), secs={};
    all.forEach(z=>{ if(z.it.d>=lo && z.it.d<=hi){ const s=z.it.sec; (secs[s.key]||(secs[s.key]={...s, n:0})).n++; } });
    if(S.comp!=="all" && !secs[S.comp]){ const z=all.find(z=>z.it.sec.key===S.comp); if(z) secs[S.comp]={...z.it.sec, n:0}; else S.comp="all"; }
    const secList=Object.values(secs).sort((a,b)=>a.ord-b.ord);

    const day=(byDay[S.d]||[]);
    const c={all:day.length, live:0, soon:0, done:0}; day.forEach(z=>c[z.x.st]++);
    const shown=day.filter(z=>S.st==="all" || z.x.st===S.st);

    /* الأقسام بترتيب البطولات، ثم بالموعد */
    const groups={}; shown.forEach(z=>{ (groups[z.it.sec.key]||(groups[z.it.sec.key]={sec:z.it.sec, L:[]})).L.push(z); });
    const G=Object.values(groups).sort((a,b)=>a.sec.ord-b.sec.ord);
    const secHTML = G.map(g=>{
      g.L.sort((a,b)=>(a.it.ts||0)-(b.it.ts||0));
      const rs=[...new Set(g.L.map(z=>z.x.rnd).filter(Boolean))], col=!!S.col[g.sec.key];
      const live=g.L.filter(z=>z.x.st==="live").length;
      return `<section class="mxd-sec${col?" is-col":""}" data-key="${H(g.sec.key)}">
        <div class="mxd-sh">
          <button type="button" class="mxd-tog" data-mxd-tog="${H(g.sec.key)}" aria-expanded="${!col}">
            <span class="mxd-lg">${g.sec.logo?`<img src="${g.sec.logo}" alt="" width="26" height="26" decoding="async">`:""}</span>
            <span class="mxd-tt"><b>${H(g.sec.name)}</b><small>${rs.length===1?`<span>${H(rs[0])}</span>`:""}<span>${cnt(g.L.length)}</span>${live?`<span class="lv">${live===1?"مباراة جارية":live+" جارية"}</span>`:""}</small></span>
            <i class="mxd-cv">${IC.chev}</i>
          </button>
          <button type="button" class="mxd-cp" data-mxd-comp-open="${H(g.sec.key)}">${g.sec.kind==="am"?"النتائج والترتيب":"صفحة البطولة"}</button>
        </div>
        <div class="mxd-cards"${col?" hidden":""}>${g.L.map(z=>cardHTML(z.it, z.x, z.fav && !S.fav)).join("")}</div>
      </section>`;
    }).join("");

    /* الحالة الفارغة: أقرب يوم فيه مباريات قبل/بعد اليوم المختار ضمن نفس الفلاتر */
    let empty="";
    if(!shown.length){
      const ds=Object.keys(byDay).sort();
      const nx=ds.find(d=>d>S.d), pv=[...ds].reverse().find(d=>d<S.d);
      const msg = !day.length ? (S.comp!=="all" ? `لا توجد مباريات لـ${(secs[S.comp]||{}).name||"هذه البطولة"} في هذا اليوم.` : S.fav ? "لا توجد مباريات لفرقك في هذا اليوم." : "لا توجد مباريات في هذا اليوم.")
        : S.st==="live" ? "لا توجد مباريات جارية الآن." : S.st==="soon" ? "لا توجد مباريات قادمة في هذا اليوم." : "لا توجد مباريات منتهية في هذا اليوم.";
      empty = `<div class="mxd-empty"><b>${msg}</b><div class="mxd-ea">
        ${day.length ? `<button type="button" class="mxd-pill" data-mxd-st="all">عرض كل مباريات اليوم</button>` : ""}
        ${!day.length && nx ? `<button type="button" class="mxd-pill" data-mxd-d="${nx}"><small>المباريات التالية</small>${H(longDay(nx))}</button>` : ""}
        ${!day.length && pv ? `<button type="button" class="mxd-pill ghost" data-mxd-d="${pv}"><small>المباريات السابقة</small>${H(longDay(pv))}</button>` : ""}
      </div></div>`;
    }

    const chip=(k,lab,n)=>`<button type="button" class="mxd-seg-b${k==="live"?" lv":""}" data-mxd-st="${k}" aria-pressed="${S.st===k}"${k==="live"&&n?' data-on="1"':""}><span>${lab}</span><em>${n}</em></button>`;
    const showComps = secList.length>1 || S.comp!=="all" || mine.length;
    const compsHTML = showComps ? `<div class="mxd-comps" role="group" aria-label="البطولة">
        <button type="button" class="mxd-cc" data-mxd-comp="all" aria-pressed="${S.comp==="all"&&!S.fav}">كل البطولات</button>
        ${mine.length?`<button type="button" class="mxd-cc fav" data-mxd-fav aria-pressed="${S.fav}">فرقي</button>`:""}
        ${secList.map(s=>`<button type="button" class="mxd-cc" data-mxd-comp="${H(s.key)}" aria-pressed="${S.comp===s.key}">${s.logo?`<img src="${s.logo}" alt="" width="18" height="18" decoding="async">`:""}${H(s.name)}</button>`).join("")}
      </div>` : "";

    const keepCal = S.cal ? calHTML(byDay) : "";
    V.innerHTML = head + `<div class="mxd">
      <div class="mxd-bar">
        <div class="mxd-top">
          <div class="mxd-sel"><b>${H(longDay(S.d))}</b></div>
          <div class="mxd-acts">
            <button type="button" class="mxd-pill sm${S.d===t?" on":""}" data-mxd-d="${t}"${S.d===t?' aria-current="date"':""}>اليوم</button>
            <button type="button" class="mxd-ib" data-mxd-cal aria-label="التقويم" aria-haspopup="dialog">${IC.cal}</button>
          </div>
        </div>
        <div class="mxd-strip" role="group" aria-label="اختيار اليوم">${stripHTML(S.d, byDay)}</div>
        <div class="mxd-seg" role="group" aria-label="حالة المباراة">${chip("all","الكل",c.all)}${chip("live","مباشر",c.live)}${chip("soon","القادمة",c.soon)}${chip("done","المنتهية",c.done)}</div>
      </div>
      ${compsHTML}
      <div class="mxd-list">${secHTML||empty}</div>
    </div>`;
    /* التقويم في body: فوق شريط التنقل السفلي (#v-matches سياق تكديس أدنى) */
    let C=document.getElementById("mxdCal");
    if(!C){ C=document.createElement("div"); C.id="mxdCal"; C.className="mxd mxd-cal"; document.body.appendChild(C); }
    C.innerHTML=keepCal; C.hidden=!S.cal;
    wireComp(V); wireDropdowns(V); wire(V); wire(C);
    { const on=V.querySelector('.mxd-strip [aria-pressed="true"]');
      if(on){ const s=on.parentNode; s.scrollLeft += (on.getBoundingClientRect().left + on.offsetWidth/2) - (s.getBoundingClientRect().left + s.clientWidth/2); } }
    const ac=V.querySelector('.mxd-comps [aria-pressed="true"]'); if(ac){ const s=ac.parentNode; const r=ac.getBoundingClientRect(), q=s.getBoundingClientRect(); if(r.left<q.left || r.right>q.right) s.scrollLeft += r.left - q.left - 12; }
    save();
  }

  /* ---------- التفاعل ---------- */
  function setDay(iso, fromList){
    if(!iso) return; const prevTop = fromList ? null : window.scrollY;
    S.d=iso; S.cal=null; redraw();
    const L=document.querySelector("#v-matches .mxd-list"); if(L){ L.classList.remove("mxd-in"); void L.offsetWidth; L.classList.add("mxd-in"); }
    /* اليوم الجديد يبدأ من أعلى القائمة إن كان القارئ قد نزل تحت الشريط */
    const bar=document.querySelector("#v-matches .mxd-bar"); if(bar && prevTop!==null){ const r=bar.getBoundingClientRect(); if(r.top<=0 || window.scrollY>bar.offsetTop) bar.closest(".mxd").scrollIntoView({block:"start"}); }
  }
  function openComp(key){
    const V=document.getElementById("v-matches");
    if(key==="am"){ if(window.AMATEUR && AMATEUR.openMatches) AMATEUR.openMatches(); return; }
    const [k,id]=[key.slice(0,1), key.slice(2)];
    const o = k==="c" ? V.querySelector(`.mx-comp [data-comp="${CSS.escape(id)}"]`) : V.querySelector(`.mx-comp [data-ext="${CSS.escape(id)}"]`);
    if(o){ o.click(); window.scrollTo({top:0}); }
  }
  function wire(V){
    V.querySelectorAll("[data-mxd-d]").forEach(b=>b.onclick=()=>setDay(b.dataset.mxdD));
    V.querySelectorAll("[data-mxd-st]").forEach(b=>b.onclick=()=>{ S.st=b.dataset.mxdSt; redraw(); });
    V.querySelectorAll("[data-mxd-comp]").forEach(b=>b.onclick=()=>{ S.comp=b.dataset.mxdComp; S.fav=false; redraw(); });
    V.querySelectorAll("[data-mxd-fav]").forEach(b=>b.onclick=()=>{ S.fav=!S.fav; if(S.fav) S.comp="all"; redraw(); });
    V.querySelectorAll("[data-mxd-tog]").forEach(b=>b.onclick=()=>{ const k=b.dataset.mxdTog, sec=b.closest(".mxd-sec"), box=sec.querySelector(".mxd-cards");
      const col=!S.col[k]; if(col) S.col[k]=1; else delete S.col[k];
      sec.classList.toggle("is-col", col); box.hidden=col; b.setAttribute("aria-expanded", String(!col)); save(); });
    V.querySelectorAll("[data-mxd-comp-open]").forEach(b=>b.onclick=()=>openComp(b.dataset.mxdCompOpen));
    V.querySelectorAll("[data-mxd-cal]").forEach(b=>b.onclick=()=>{ S.cal=S.d.slice(0,7); redraw(); const C=document.getElementById("mxdCal"), f=C && (C.querySelector('.mxd-cal-g [aria-pressed="true"]')||C.querySelector('.mxd-cal-g button')); if(f) f.focus({preventScroll:true}); });
    V.querySelectorAll("[data-mxd-calx]").forEach(b=>b.onclick=()=>{ S.cal=null; redraw(); const c=document.querySelector("#v-matches [data-mxd-cal]"); if(c) c.focus({preventScroll:true}); });
    V.querySelectorAll("[data-mxd-cm]").forEach(b=>b.onclick=()=>{ let [Y,M]=S.cal.split("-").map(Number); M+= +b.dataset.mxdCm; if(M<1){M=12;Y--;} if(M>12){M=1;Y++;} S.cal=`${Y}-${p2(M)}`; redraw(); });
    if(V.id==="mxdCal") V.onkeydown=e=>{ if(e.key==="Escape"){ S.cal=null; redraw(); } };
    V.querySelectorAll(".mxd-c[data-mopen], .mxd-c[data-am-open]").forEach(a=>a.onkeydown=e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); a.click(); } });
    /* السحب أفقياً على القائمة = اليوم التالي/السابق (RTL: السحب يميناً يتقدّم) */
    const L=V.querySelector(".mxd-list"); if(!L || L.dataset.sw) return; L.dataset.sw="1"; let x0=null, y0=0, t0=0;
    L.addEventListener("touchstart", e=>{ const p=e.touches[0]; x0=p.clientX; y0=p.clientY; t0=Date.now(); }, {passive:true});
    L.addEventListener("touchend", e=>{ if(x0===null) return; const p=e.changedTouches[0], dx=p.clientX-x0, dy=p.clientY-y0; x0=null;
      if(Math.abs(dx)>70 && Math.abs(dx)>2.2*Math.abs(dy) && Date.now()-t0<700) setDay(add(S.d, dx>0?1:-1), true); }, {passive:true});
  }

  return { render, state:S };
})();
