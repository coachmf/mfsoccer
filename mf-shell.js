/* =========================================================
   MF SOCCER — هيكل التطبيق بالهوية الذهبية (منصور 2026-10-05)
   - شريط علوي مضغوط + شريط سفلي بخمس خانات (الهاتف) + تنقل أفقي (الكمبيوتر)
   - «كرة القدم الكويتية»: دائرة الأقسام (Orbit) — تُبنى فقط من أقسام موجودة فعلاً
   - رئيسية مبسّطة: المباشر/القادمة ← آخر النتائج ← الترتيب ← أبرز اللاعبين ← الأرقام
   كل تنقّل = نقرة على زر التنقل الأصلي nav.tabs button[data-v]، فتبقى كل
   مغلّفات go() وربط كأس الخليج وإظهار الفانتسي تعمل كما هي. لا بيانات جديدة.
   الفانتسي منفصل: رابط فقط، لا يُلمس شيء داخله.
   ========================================================= */
(function(){
  "use strict";
  const D=document, H=D.documentElement;
  H.classList.add("mf");

  /* ---------- القاموس الإنجليزي للنصوص الجديدة (يُدمج قبل I18N.init) ---------- */
  const MF_DICT={
    "كرة القدم الكويتية":"Kuwaiti Football", "الترتيب":"Table", "الإحصائيات":"Stats", "الحكام":"Referees",
    "الكؤوس":"Cups", "المنتخب الوطني":"National team", "الاتحاد الكويتي":"Kuwait FA", "كأس الخليج":"Gulf Cup",
    "آخر النتائج":"Latest results", "المحلية":"Domestic", "الخارجية":"International", "جميع المباريات":"All matches", "الدقائق":"Minutes", "أبرز الأرقام":"Top stats", "كل الأرقام":"All stats", "الهجوم":"Attack", "الحراسة والدفاع":"Defence", "الانضباط":"Discipline", "المشاركة":"Playing time", "لا توجد أرقام بعد":"No stats yet", "الفانتسي":"Fantasy", "نظرة عامة":"Overview", "الفرق":"Teams", "الإجمالي":"Total", "الجدول كاملاً":"Full table", "إخفاء":"Show less", "أرقام الموسم":"Season numbers",
    "أرقام لافتة":"Standout numbers", "تابعنا":"Follow us", "إغلاق":"Close", "بحث":"Search", "القائمة":"Menu",
    "التنقل الرئيسي":"Main navigation", "كرة القدم":"Football", "جارية الآن":"Live now", "لا مباريات منتهية بعد":"No finished matches yet",
    "ستظهر النتائج هنا بعد أول صافرة نهاية.":"Results will appear here after the first full-time whistle.",
    "إعداد وإشراف الإحصائيات":"Statistics by", "مشاركة وتقارير":"Share & reports", "الجولة":"Round"
  };
  try{ if(typeof I18N!=="undefined" && I18N.DICT) for(const k in MF_DICT) if(I18N.DICT[k]==null) I18N.DICT[k]=MF_DICT[k]; }catch(e){}

  /* ---------- لون شريط المتصفح يتبع الهوية ---------- */
  try{
    const ap=THEME.apply.bind(THEME);
    THEME.apply=function(t){ ap(t); const m=D.querySelector('meta[name="theme-color"]'); if(m) m.content = t==="dark" ? "#00061A" : "#F2F4F8"; };
    THEME.apply(THEME.get());
  }catch(e){}

  /* ---------- أيقونات وظيفية (خط 1.75، لون النص) ---------- */
  const sv=p=>`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const IC={
    home:sv('<path d="M4 10.5 12 4l8 6.5V20h-5.5v-5.5h-5V20H4z"/>'),
    matches:sv('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 5v14"/><circle cx="12" cy="12" r="2.6"/>'),
    table:sv('<path d="M4 6h16M4 12h16M4 18h16M8 4v16"/>'),
    clubs:sv('<path d="M12 3.5 19 6v5.6c0 4.3-2.9 7.6-7 8.9-4.1-1.3-7-4.6-7-8.9V6z"/>'),
    players:sv('<circle cx="12" cy="8" r="3.6"/><path d="M5 20c.6-3.8 3.4-6 7-6s6.4 2.2 7 6"/>'),
    stats:sv('<path d="M5 20V11M12 20V5M19 20v-6"/>'),
    refs:sv('<circle cx="9" cy="14" r="4.6"/><path d="M13.2 11.6 20.5 8V5.2l-9 4"/>'),
    cups:sv('<path d="M8 20h8M12 16v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5.5h2.5V7a3 3 0 0 1-2.8 3M7 5.5H4.5V7a3 3 0 0 0 2.8 3"/>'),
    predict:sv('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.4"/>'),
    fans:sv('<circle cx="12" cy="9" r="3"/><path d="M6.5 20c0-3 2.5-5.4 5.5-5.4s5.5 2.4 5.5 5.4"/><path d="M4.6 12.4a2.3 2.3 0 1 1 1.6-4M19.4 12.4a2.3 2.3 0 1 0-1.6-4"/>'),
    fantasy:sv('<path d="M8.5 3.5 3 6.4l1.9 3.5 2.3-1.1v11.7h9.6V8.8l2.3 1.1L21 6.4l-5.5-2.9c-.9 1.4-2 2.1-3.5 2.1s-2.6-.7-3.5-2.1z"/>'),
    search:sv('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>'),
    close:sv('<path d="M6 6l12 12M18 6 6 18"/>'),
    chev:sv('<path d="m14 6-6 6 6 6"/>'),
    all:sv('<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>'),
    local:sv('<path d="M4 10.5 12 4l8 6.5V20h-5.5v-5.5h-5V20H4z"/>'),
    world:sv('<path d="M10.5 13.5 4 11l1.4-1.4 7.2 1.1 3.9-3.9a1.9 1.9 0 0 1 2.7 2.7l-3.9 3.9 1.1 7.2-1.4 1.4-2.5-6.5-3 3v2.6l-1.2 1.2-1.3-3.1-3.1-1.3 1.2-1.2h2.6z"/>')
  };

  /* ---------- أدوات التنقل ---------- */
  const tab=v=>D.querySelector(`nav.tabs button[data-v="${v}"]`);
  const shown=v=>{ const b=tab(v); return !!b && b.style.display!=="none"; };
  function nav(v){
    if(v==="stats"){ plMode="top"; v="players"; }
    const b=tab(v);
    if(b && b.style.display!=="none"){ try{ window.USER_NAV=true; }catch(e){} b.click(); return; }
    if(v==="fantasy") location.href = window.FANTASY_URL || "/fantasy/";
  }
  const curView=()=>{ const b=D.querySelector('nav.tabs button[aria-selected="true"]'); return b ? b.dataset.v : "home"; };
  const safe=f=>{ try{ return f(); }catch(e){ console.error(e); } };

  /* ---------- أقسام الدائرة: الموجود فعلاً فقط ---------- */
  function cupsPresent(){ return safe(()=>compsPresent().filter(c=>c!=="الدوري")) || []; }
  function setAX(t){ safe(()=>{ if(window.AX){ AX.tab=t; AX.sel=null; } }); }
  function hubItems(){
    const L=[
      {k:"matches", t:"المباريات", go:()=>nav("matches")},
      {k:"table",   t:"الترتيب",   go:()=>{ nav("home"); setTimeout(()=>openStandings(true),60); }},
      {k:"clubs",   t:"الأندية",   go:()=>nav("clubs")},
      {k:"players", t:"اللاعبون",  go:()=>nav("players")},
      {k:"stats",   t:"الإحصائيات", ok:()=>shown("analysis"), go:()=>nav("stats")},
      {k:"refs",    t:"الحكام",    ok:()=>shown("analysis") && !!window.AX, go:()=>{ setAX("refs"); nav("analysis"); }},
      {k:"cups",    t:"الكؤوس",    ok:()=>cupsPresent().length>0, go:()=>safe(()=>{
          MXC=null; COMP=cupsPresent()[0]; SELR=null; SELDAY=null; applyComp(); if(typeof paintRail==="function") paintRail(); nav("matches"); })},
      {k:"predict", t:"التوقعات",  ok:()=>shown("predict"), go:()=>nav("predict")},
      {k:"fans",    t:"الجمهور",   ok:()=>shown("fans"), go:()=>nav("fans")}
    ];
    return L.filter(x=>!x.ok || x.ok()).slice(0,9);
  }

  /* ---------- الشريط العلوي ---------- */
  const DNAV=[["home","الرئيسية"],["matches","المباريات"],["hub","كرة القدم الكويتية"],["stats","الإحصائيات"],["fantasy","الفانتسي"]];
  function buildTop(){
    const top=D.createElement("header"); top.className="mf-top";
    top.innerHTML=`<div class="mf-top-in">
      <button type="button" class="mf-logo" data-mf="home" aria-label="MF SOCCER — الرئيسية">
        <img src="assets/brand/mf-mark.webp" alt="" width="59" height="28"><span class="mf-word"><b>MF SOCCER</b><small>الدوري الكويتي الممتاز</small></span>
      </button>
      <nav class="mf-dnav" aria-label="التنقل الرئيسي">${DNAV.map(([v,t])=>`<button type="button" data-mf="${v}"${v==="hub"?' class="hubbtn" aria-haspopup="dialog"':""}>${t}</button>`).join("")}</nav>
      <div class="mf-tools">
        <button type="button" class="mf-ib" data-mf="search" aria-label="بحث" title="بحث">${IC.search}</button>
      </div>
    </div>`;
    const tools=top.querySelector(".mf-tools");
    ["langBtn","themeBtn","adminBtn"].forEach(id=>{ const b=D.getElementById(id); if(b){ b.classList.add("mf-ib"); tools.appendChild(b); } });
    const old=D.querySelector("header.topbar"); (old?old.parentNode:D.body).insertBefore(top, old||D.body.firstChild);
  }

  /* ---------- الشريط السفلي (الهاتف) ---------- */
  function buildBar(){
    const bar=D.createElement("nav"); bar.className="mf-bar"; bar.setAttribute("aria-label","التنقل الرئيسي");
    bar.innerHTML=`<div class="mf-bar-in">
      <button type="button" data-mf="home">${IC.home}<span>الرئيسية</span></button>
      <button type="button" data-mf="matches">${IC.matches}<span>المباريات</span></button>
      <button type="button" data-mf="hub" class="mf-orb" aria-haspopup="dialog" aria-label="كرة القدم الكويتية"><i><img src="assets/brand/mf-mark.webp" alt="" width="34" height="16"></i></button>
      <button type="button" data-mf="stats">${IC.stats}<span>الإحصائيات</span></button>
      <button type="button" data-mf="fantasy" class="mf-fan">${IC.fantasy}<span>الفانتسي</span></button>
    </div>`;
    D.body.appendChild(bar);
  }

  /* ---------- دائرة كرة القدم الكويتية ---------- */
  let hub=null, lastFocus=null, byKey=false;
  function crestSrc(c){ return safe(()=> (typeof LOCAL_CRESTS!=="undefined" && LOCAL_CRESTS[c]) || (typeof LOGOS!=="undefined" && LOGOS[c]) || "") || ""; }
  function buildHub(){
    hub=D.createElement("div"); hub.className="mf-hub"; hub.hidden=true;
    hub.setAttribute("role","dialog"); hub.setAttribute("aria-modal","true"); hub.setAttribute("aria-label","كرة القدم الكويتية");
    D.body.appendChild(hub);
    hub.addEventListener("click", e=>{
      if(e.target===hub || e.target.closest("[data-hub-close]")){ closeHub(); return; }
      const n=e.target.closest("[data-hub]"); if(n){ const it=hubItems().find(x=>x.k===n.dataset.hub); closeHub(true); if(it) setTimeout(it.go,0); return; }
      const c=e.target.closest("[data-hub-club]"); if(c){ closeHub(true); const k=c.dataset.hubClub; setTimeout(()=>safe(()=>openClub(k)),0); return; }
      const g=e.target.closest("[data-hub-gulf]"); if(g){ closeHub(true); setTimeout(()=>nav("gulf"),0); }
      const d1=e.target.closest("[data-hub-div1]"); if(d1){ closeHub(true); setTimeout(()=>nav("div1"),0); }
    });
    D.addEventListener("keydown", e=>{
      if(hub.hidden) return;
      if(e.key==="Escape"){ e.preventDefault(); closeHub(); return; }
      if(e.key==="Tab"){   /* حبس التركيز داخل النافذة */
        const f=[...hub.querySelectorAll("button,a[href]")].filter(x=>x.offsetParent);
        if(!f.length) return; const a=f[0], z=f[f.length-1];
        if(e.shiftKey && D.activeElement===a){ e.preventDefault(); z.focus(); }
        else if(!e.shiftKey && D.activeElement===z){ e.preventDefault(); a.focus(); }
      }
    });
  }
  function hubHTML(){
    const items=hubItems(), n=items.length;
    const season=safe(()=>SEASON)||"";
    const kfa=safe(()=>KFA_KEY), kfaImg=safe(()=>KFA_INFO.img.logo);
    const clubs=(safe(()=>CLUBS)||[]);
    const soc=safe(()=>[[IG_URL,"Instagram"],[X_URL,"X"],[TT_URL,"TikTok"]])||[];
    return `<div class="mf-hub-sheet">
      <div class="mf-hub-hd"><b>كرة القدم الكويتية</b><button type="button" class="mf-ib" data-hub-close aria-label="إغلاق">${IC.close}</button></div>
      <div class="mf-orbit" style="--n:${n}">
        <div class="mf-core" aria-hidden="true"><img src="assets/brand/mf-emblem.webp" alt="" width="188" height="130"><span>الموسم ${esc(season)}</span></div>
        <ul class="mf-nodes" role="list">${items.map((x,i)=>`<li style="--i:${i}"><button type="button" class="mf-node" data-hub="${x.k}">${IC[x.k]||""}<span>${x.t}</span></button></li>`).join("")}</ul>
      </div>
      ${kfa?`<div class="mf-hub-sec"><h3>المنتخب الوطني</h3><div class="mf-nt">
        <button type="button" data-hub-club="${esc(kfa)}">${kfaImg?`<img src="${kfaImg}" alt="" width="40" height="40">`:""}<span>الاتحاد الكويتي</span></button>
        ${shown("gulf")?`<button type="button" data-hub-gulf>${IC.cups}<span>كأس الخليج</span></button>`:""}
      </div></div>`:""}
      ${shown("div1")?`<div class="mf-hub-sec"><h3>دوري الدرجة الأولى</h3><div class="mf-nt"><button type="button" data-hub-div1>${IC.cups}<span>الترتيب والمباريات</span></button></div></div>`:""}
      ${clubs.length?`<div class="mf-hub-sec"><h3>الأندية</h3><div class="mf-crests">${clubs.map(c=>{ const s=crestSrc(c);
        return `<button type="button" data-hub-club="${esc(c)}" aria-label="${esc(c)}" title="${esc(c)}">${s?`<img src="${s}" alt="" width="40" height="40" loading="lazy">`:`<span>${esc(c.slice(0,2))}</span>`}<small>${esc(c)}</small></button>`; }).join("")}</div></div>`:""}
      ${soc.length?`<div class="mf-hub-ft"><span>تابعنا</span>${soc.map(([u,t])=>`<a href="${u}" target="_blank" rel="noopener">${t}</a>`).join("")}<span class="mf-handle">@mfsoccerkw</span></div>`:""}
    </div>`;
  }
  function openHub(){
    if(!hub) buildHub();
    lastFocus=D.activeElement;
    hub.innerHTML=hubHTML();
    hub.hidden=false; H.classList.add("mf-lock");
    requestAnimationFrame(()=>{ hub.classList.add("on"); const f=hub.querySelector(byKey?".mf-node":".mf-hub-sheet"); if(f){ if(!byKey) f.tabIndex=-1; f.focus({preventScroll:true}); } });
    paintActive();
  }
  function closeHub(nav){
    if(!hub || hub.hidden) return;
    hub.classList.remove("on"); H.classList.remove("mf-lock");
    const done=()=>{ hub.hidden=true; paintActive(); };
    if(matchMedia("(prefers-reduced-motion: reduce)").matches || nav) done(); else setTimeout(done,180);
    if(!nav && byKey && lastFocus && lastFocus.focus) lastFocus.focus({preventScroll:true});
  }
  window.MFHUB={open:openHub, close:closeHub};

  /* ---------- البحث: ينقل لصفحة اللاعبين ويركّز خانة البحث الموجودة ---------- */
  function openSearch(){
    nav("players");
    let tries=0; const t=setInterval(()=>{ const i=D.querySelector(".psearch input"); if(i||++tries>20){ clearInterval(t); if(i){ i.scrollIntoView({block:"center"}); i.focus(); } } },80);
  }

  /* ---------- النقرات ---------- */
  D.addEventListener("click", e=>{
    const b=e.target.closest("[data-mf]"); if(!b) return;
    const v=b.dataset.mf;
    if(v==="hub"){ byKey = e.detail===0; hub && !hub.hidden ? closeHub() : openHub(); return; }
    closeHub(true);
    if(v==="search"){ openSearch(); return; }
    nav(v);
  });

  /* ---------- الحالة النشطة ---------- */
  function paintActive(){
    const v=curView(), hubOpen=hub && !hub.hidden;
    const hubViews=["clubs","predict","fans","gulf","div1"];
    D.querySelectorAll(".mf-bar [data-mf], .mf-dnav [data-mf]").forEach(b=>{
      const k=b.dataset.mf;
      const kv = k==="stats" ? (v==="players" ? "players" : "analysis") : k;
      const on = hubOpen ? k==="hub" : (kv===v || (k==="hub" && hubViews.includes(v) && !(k==="hub" && v==="players" && b.closest(".mf-dnav"))));
      b.classList.toggle("on", on);
      if(on) b.setAttribute("aria-current","page"); else b.removeAttribute("aria-current");
    });
    const fan=shown("fantasy");
    D.querySelectorAll('[data-mf="fantasy"]').forEach(b=>b.hidden=!fan);
    H.classList.toggle("mf-nofan", !fan);
  }

  /* ================= الرئيسية ================= */
  const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function lastResults(){
    const done=MATCHES.filter(m=>!isUpcoming(m) && matchOver(m))
      .sort((a,b)=>(kickoffTS(b)||0)-(kickoffTS(a)||0));
    if(!done.length) return {r:null, list:[]};
    const r=done[0].round, c=compOf(done[0]);
    return {r, c, list:done.filter(m=>m.round===r && compOf(m)===c).sort((a,b)=>(kickoffTS(a)||0)-(kickoffTS(b)||0))};
  }
  function resultsHTML(){
    const {r,c,list}=lastResults();
    if(!list.length) return `<section class="mf-sec"><div class="mf-sec-hd"><h2>آخر النتائج</h2></div>
      <div class="mf-empty"><b>لا مباريات منتهية بعد</b><span>ستظهر النتائج هنا بعد أول صافرة نهاية.</span></div></section>`;
    return `<section class="mf-sec"><div class="mf-sec-hd"><h2>آخر النتائج</h2><span class="mf-meta">${COMP==="الكل"?esc(c)+" · ":""}الجولة ${r}</span>
        <button type="button" class="mf-link" data-mf="matches">المباريات ${IC.chev}</button></div>
      <div class="mf-res" role="list">${list.map(m=>{ const hw=m.hg>m.ag, aw=m.ag>m.hg; return `<button type="button" class="mf-rc" role="listitem" data-mf-match="${esc(safe(()=>matchKey(m))||"")}">
        <span class="t${hw?" w":""}">${crest(m.home)}<b>${esc(m.home)}</b><em>${m.hg??""}</em></span>
        <span class="t${aw?" w":""}">${crest(m.away)}<b>${esc(m.away)}</b><em>${m.ag??""}</em></span>
        <small>${safe(()=>dayLabel(m.date))||""}</small></button>`; }).join("")}</div></section>`;
  }
  function standingsHTML(T){
    const rows=T.length;
    return `<section class="mf-sec mf-std" id="mfStd"><div class="hm">${hmStandingsHTML(T)}</div>
      ${rows>6?`<button type="button" class="mf-more" data-mf-std aria-expanded="false"><span>الجدول كاملاً</span>${IC.chev}</button>`:""}</section>`;
  }
  function openStandings(scroll){
    const s=D.getElementById("mfStd"); if(!s) return;
    s.classList.add("open"); const b=s.querySelector("[data-mf-std]"); if(b){ b.setAttribute("aria-expanded","true"); b.querySelector("span").textContent="إخفاء"; }
    if(scroll) s.scrollIntoView({behavior: matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth", block:"start"});
  }
  function renderHomeMF(){
    const v=D.getElementById("v-home"); if(!v) return;
    const T=standings(), played=playedMatches().length, soon=MATCHES.length-played;
    const hs=safe(()=>headlines())||[];
    const live=safe(()=>liveCard())||"";
    const next=safe(()=>hmNextMatchHTML())||"";
    v.innerHTML=`<div class="mf-home">
      ${compChips()}
      ${live}
      <div class="mf-row mf-row-a">${next}${resultsHTML()}</div>
      ${COMP==="الدوري"?"":`<div class="note mf-note"><b>تنبيه:</b> جدول الترتيب يُحتسب بنظام الدوري. في مسابقات الكؤوس اعتبره ترتيباً بالنقاط لا جدولاً رسمياً.</div>`}
      <div class="mf-row mf-row-b">
        <div class="mf-col">${standingsHTML(T)}
          <p class="hint">${mw(played)} أُقيمت${soon?` · ${soon} لم تبدأ بعد ولا تُحتسب في الجدول`:""} · الترتيب بالنقاط ثم فارق الأهداف ثم الأهداف المسجلة.</p></div>
        <aside class="mf-col">
          <h2 class="sec">أرقام الموسم</h2>
          <div class="hm">${hmKpiHTML()}</div>
          ${hs.length?`<details class="mf-disc"><summary>أرقام لافتة<span class="mf-meta">${hs.length}</span>${IC.chev}</summary>
            <div class="card pad">${hs.map(h=>`<div class="head-story"><div class="num">${esc(h.v)}</div><div class="tx"><b>${esc(h.t)}</b><span>${esc(h.d)}</span></div></div>`).join("")}</div>
            <p class="hint">كل رقم هنا يُحتسب لحظياً من سجل الأهداف — لا يُكتب يدوياً.</p></details>`:""}
        </aside>
      </div>
      ${safe(()=>topPlayersHTML())||""}
      <div class="mf-foot">
        ${exportBar("league",null,"ملخص "+(COMP==="الكل"?"المسابقات":COMP))}
        <div class="mf-credit"><img src="${BRAND}" alt="" width="40" height="40"><span><small>إعداد وإشراف الإحصائيات</small><b>${esc(OWNER)}</b></span>
          <a class="hchip" href="${IG_URL}" target="_blank" rel="noopener" aria-label="Instagram">${IG_SVG}</a>
          <a class="hchip" href="${X_URL}" target="_blank" rel="noopener" aria-label="X">${X_SVG}</a>
          <a class="hchip" href="${TT_URL}" target="_blank" rel="noopener" aria-label="تيك توك">${TT_SVG}</a>
          <a class="hchip wa" href="${WA_URL}" target="_blank" rel="noopener">${WA_SVG}اقتراحاتكم</a></div>
      </div>
    </div>`;
    wireComp(v);
    v.querySelectorAll("[data-golive]").forEach(b=>b.onclick=()=>go("matches"));
    if(typeof HM_CD_TIMER!=="undefined"){ if(HM_CD_TIMER) clearInterval(HM_CD_TIMER); HM_CD_TIMER = v.querySelector(".hm-nm") ? setInterval(hmTickCountdown,20000) : null; }
  }
  D.addEventListener("click", e=>{
    const sb=e.target.closest("#v-home [data-mf-std]");
    if(sb){ const s=D.getElementById("mfStd"); const open=!s.classList.contains("open");
      if(open) openStandings(false); else { s.classList.remove("open"); sb.setAttribute("aria-expanded","false"); sb.querySelector("span").textContent="الجدول كاملاً"; s.scrollIntoView({block:"start"}); }
      return; }
    const mb=e.target.closest("[data-mf-match]");
    if(mb && mb.dataset.mfMatch){ safe(()=>openMatch(mb.dataset.mfMatch)); }
  });

  /* ---------- أزرار المشاركة: أيقونات خطية بدل الرموز التعبيرية (في كل الصفحات) ---------- */
  safe(()=>{
    if(typeof exportBar!=="function" || exportBar.__mf) return;
    const o=exportBar, SH=sv('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
      PR=sv('<path d="M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5a1 1 0 0 1-1 1h-2"/><path d="M7 14h10v6H7z"/>');
    exportBar=function(){ return o.apply(this, arguments).replace("↗ ", SH).replace("🖨 ", PR); };
    exportBar.__mf=true;
  });

  /* ---------- المباريات القادمة: أول 4 أيام، والباقي خلف «عرض المزيد» (كانت القائمة كلها دفعة واحدة) ---------- */
  const UP_DAYS=4;
  function foldUpcoming(){
    const L=D.querySelector("#v-matches .mx-list"); if(!L || L.dataset.mfFold) return;
    L.dataset.mfFold="1";
    let day=0, hidden=0;
    [...L.children].forEach(el=>{ if(el.classList.contains("mc-day")) day++; if(day>UP_DAYS){ el.classList.add("mf-fold"); if(el.matches("article")) hidden++; } });
    hidden += L.querySelectorAll(".mf-fold .mc, .mf-fold.ext-card").length;
    if(day>UP_DAYS){
      const b=D.createElement("button"); b.type="button"; b.className="mf-more"; b.dataset.mfUnfold="";
      b.innerHTML=`<span>عرض المزيد</span>${IC.chev}`; L.after(b);
      b.onclick=()=>{ L.querySelectorAll(".mf-fold").forEach(x=>x.classList.remove("mf-fold")); b.remove(); };
    }
  }
  safe(()=>{
    if(typeof renderUpcomingMatches!=="function" || renderUpcomingMatches.__mf) return;
    const o=renderUpcomingMatches;
    renderUpcomingMatches=function(){ const r=o.apply(this, arguments); safe(foldUpcoming); return r; };
    renderUpcomingMatches.__mf=true;
  });

  /* ---------- صفحة النادي: شريط شعارات للتبديل بدل القائمة المنسدلة، والمشاركة في الأسفل ----------
     #clubSel يبقى في الصفحة (مخفي) لأن openClub وروابط #c/ تعتمد عليه */
  function clubPickHTML(cur){
    const list=[...(safe(()=>CLUBS)||[])], kfa=safe(()=>KFA_KEY);
    const btn=(c,img,label)=>`<button type="button" role="tab" data-mf-club="${esc(c)}" aria-selected="${c===cur}" aria-label="${esc(label)}" title="${esc(label)}">${img?`<img src="${img}" alt="" width="34" height="34">`:`<span>${esc(label.slice(0,2))}</span>`}<small>${esc(label)}</small></button>`;
    return `<div class="mf-clubpick" role="tablist" aria-label="الأندية">${list.map(c=>btn(c,crestSrc(c),c)).join("")}${kfa?btn(kfa,safe(()=>KFA_INFO.img.logo),"المنتخب"):""}</div>`;
  }
  function syncClubPick(c){
    const v=D.getElementById("v-clubs"); if(!v) return;
    let bar=v.querySelector(".mf-clubpick");
    if(!bar){ const body=D.getElementById("clubBody"); if(!body) return; body.insertAdjacentHTML("beforebegin", clubPickHTML(c)); bar=v.querySelector(".mf-clubpick"); }
    bar.querySelectorAll("[data-mf-club]").forEach(b=>b.setAttribute("aria-selected", b.dataset.mfClub===c));
    const on=bar.querySelector('[aria-selected="true"]'); if(on) on.scrollIntoView({block:"nearest", inline:"center"});
    const body=D.getElementById("clubBody"), ex=body && body.querySelector(":scope > .exportbar");
    if(ex){ body.appendChild(ex); ex.classList.add("mf-club-ex"); }
  }
  safe(()=>{
    if(typeof renderClubBody!=="function" || renderClubBody.__mf) return;
    const o=renderClubBody;
    renderClubBody=function(c){ const r=o.apply(this, arguments); safe(()=>syncClubPick(c)); return r; };
    renderClubBody.__mf=true;
  });
  D.addEventListener("click", e=>{
    const b=e.target.closest("[data-mf-club]"); if(!b) return;
    const c=b.dataset.mfClub, sel=D.getElementById("clubSel");
    if(sel) sel.value=c;
    safe(()=>{ CLUB_TAB="about"; });
    renderClubBody(c);
  });

  /* ---------- الإدارة: قائمة المباريات تفتح على الجولة الحالية أولاً (كانت تفتح آخر جولة في الموسم) ----------
     ترتيب بصري فقط: نفس العناصر بمستمعاتها، لا يُكتب شيء */
  function focusAdminRound(){
    const cr=safe(()=>currentRound()); if(cr==null) return;
    const boxes=[...D.querySelectorAll("#v-admin details.rndbox")]; if(boxes.length<2) return;
    const cur=boxes.find(d=>{ const b=d.querySelector("summary b"); return b && b.textContent.trim()==="الجولة "+cr; });
    if(!cur) return;
    boxes.forEach(d=>{ if(d!==cur) d.open=false; });
    cur.open=true; cur.classList.add("mf-curround");
    if(cur!==boxes[0]) boxes[0].parentNode.insertBefore(cur, boxes[0]);
  }
  safe(()=>{
    if(typeof renderMatchAdmin!=="function" || renderMatchAdmin.__mf) return;
    const o=renderMatchAdmin;
    renderMatchAdmin=function(){ const r=o.apply(this, arguments); safe(focusAdminRound); return r; };
    renderMatchAdmin.__mf=true;
  });

  /* ---------- ملف اللاعب: سجل المباريات يبدأ بآخر 6، والباقي خلف «عرض المزيد» ---------- */
  const PLOG_SHOW=6;
  function foldPlayerLog(){
    const L=D.querySelector("#pprof .plog"); if(!L) return;
    const rows=[...L.children]; if(rows.length<=PLOG_SHOW) return;
    rows.slice(PLOG_SHOW).forEach(r=>r.classList.add("mf-fold"));
    const b=D.createElement("button"); b.type="button"; b.className="mf-more mf-plog-more";
    b.innerHTML=`<span>عرض المزيد</span>${IC.chev}`; L.after(b);
    b.onclick=()=>{ L.querySelectorAll(".mf-fold").forEach(x=>x.classList.remove("mf-fold")); b.remove(); };
  }
  safe(()=>{
    if(typeof openPlayer!=="function" || openPlayer.__mf) return;
    const o=openPlayer;
    const w=function(){ const r=o.apply(this, arguments); safe(foldPlayerLog); return r; };
    w.__mf=true; openPlayer=w; window.openPlayer=w;
  });

  /* ================= نظام الدوائر للتصفية (منصور 2026-10-05) =================
     المباريات: «جميع المباريات / محلية / خارجية»؛ محلية وخارجية تفتح دوائر بطولاتها.
     اللاعبون: دوائر المسابقة + شريط شعارات الفرق. كل دائرة تضغط الخيار الأصلي المخفي
     (نفس المسار ونفس الأرقام)؛ بطولة بلا مباريات لا تظهر لها دائرة. */
  const circ=(attrs,inner,label,on,cls)=>`<button type="button" class="mf-circ${cls?" "+cls:""}" ${attrs} aria-pressed="${!!on}"><i>${inner}</i><span>${esc(label)}</span></button>`;
  /* داخل الدائرة: شعار البطولة إن وُجد في الموقع وإلا أيقونة؛ تحت الاسم عدد المباريات بكلمة واضحة */
  /* رموز البطولات (الكأس/الشعار بلا الكتابة): الدولية مقصوصة من شعاراتها الرسمية في ويكيبيديا (2026-10-05) */
  const COMP_LOGO={"c:الدوري":"assets/hero/kpl-mark.webp","e:gulf27":"assets/comps/gulf27.webp","e:gcl":"assets/comps/gcl.webp",
    "e:acl2":"assets/comps/acl2.webp","e:acc":"assets/comps/acc.webp","e:asiad":"assets/comps/asiad.webp"};
  const mw2=n=>n===1?"مباراة واحدة":n===2?"مباراتان":(n>=3&&n<=10)?n+" مباريات":n+" مباراة";
  function compCirc(x,i){
    const logo=COMP_LOGO[x.key], total=x.key==="c:الكل";
    const inner=logo?`<img src="${logo}" alt="" width="32" height="32">`:total?IC.all:IC.cups;
    const label=total?"الإجمالي":x.label;
    return `<button type="button" class="mf-circ sm comp" data-mx-opt="${i}" aria-pressed="${!!x.sel}" title="${esc(x.label)}"><i>${inner}</i><span>${esc(label)}</span><em>${mw2(x.n)}</em></button>`;
  }
  let mxGroup=null;   /* المجموعة المفتوحة: all | local | ext */
  function mxCircles(){
    const v=D.getElementById("v-matches"), dd=v && v.querySelector(".mx-comp"); if(!dd) return;
    const opts=[...dd.querySelectorAll(".rs-menu > *")];
    let grp="all"; const G={all:[],local:[],ext:[]};
    opts.forEach(o=>{ if(o.classList.contains("rs-grp")){ grp = /خارج/.test(o.textContent) ? "ext" : "local"; return; }
      const em=o.querySelector("em"), n=em?+em.textContent||0:0, label=(o.firstChild&&o.firstChild.nodeType===3?o.firstChild.textContent:o.textContent).trim();
      G[grp].push({o, n, label, sel:o.getAttribute("aria-selected")==="true", key:o.dataset.comp?"c:"+o.dataset.comp:"e:"+o.dataset.ext}); });
    const curGrp = G.all.some(x=>x.sel) ? "all" : G.ext.some(x=>x.sel) ? "ext" : "local";
    const open = mxGroup || curGrp;
    const show = x => x.n>0 || x.sel;
    const lvl1=[["all","جميع المباريات",IC.all],["local","المحلية",IC.local],["ext","الخارجية",IC.world]]
      .filter(([k])=>k==="all" || G[k].some(show));
    const sub = open==="all" ? [] : G[open].filter(show);
    const box=D.createElement("div"); box.className="mf-circles";
    box.innerHTML=`<div class="mf-crow l1" role="group" aria-label="نوع المباريات">${lvl1.map(([k,t,ic])=>circ(`data-mx-grp="${k}"`,ic,t,k===open)).join("")}</div>
      ${sub.length?`<div class="mf-crow l2" role="group" aria-label="البطولة">${sub.map((x,i)=>compCirc(x,i)).join("")}</div>`:""}`;
    box._sub=sub; box._all=G.all[0]; box._G=G;
    const old=v.querySelector(".mf-circles"); if(old) old.remove();
    (v.querySelector(".mx-head")||v.firstElementChild).after(box);
  }
  D.addEventListener("click", e=>{
    const box=e.target.closest("#v-matches .mf-circles"); if(!box) return;
    const g=e.target.closest("[data-mx-grp]");
    if(g){ const k=g.dataset.mxGrp;
      if(k==="all"){ mxGroup=null; if(box._all) box._all.o.click(); return; }
      /* المحتوى يطابق الدائرة دائماً: إن لم يكن الاختيار الحالي من هذه المجموعة نختار أول بطولة فيها */
      mxGroup=k;
      const g2=(box._G||{})[k]||[], first=g2.find(x=>x.n>0)||g2[0];
      if(first && !g2.some(x=>x.sel)) first.o.click(); else mxCircles();
      return; }
    const o=e.target.closest("[data-mx-opt]");
    if(o){ const x=box._sub[+o.dataset.mxOpt]; if(x){ mxGroup=null; x.o.click(); } }
  });

  function plCircles(){
    const v=D.getElementById("v-players"), cs=v && v.querySelector("#stComp"), cl=v && v.querySelector("#stClub"); if(!cs) return;
    const have=new Set(safe(()=>compsPresent())||[]);
    const comps=[...cs.options].filter(o=>o.value==="الكل" ? have.size>1 : (have.has(o.value) || o.selected));
    const clubs=cl?[...cl.options]:[];
    const box=D.createElement("div"); box.className="mf-circles";
    box.innerHTML=`${comps.length>1?`<div class="mf-crow l1" role="group" aria-label="المسابقة">${comps.map(o=>circ(`data-pl-comp="${esc(o.value)}"`, o.value==="الكل"?IC.all:(o.value==="الدوري"?IC.table:IC.cups), o.value==="الكل"?"الإجمالي":o.textContent.trim(), o.selected)).join("")}</div>`:""}
      ${clubs.length?`<div class="mf-crow l2 crests" role="group" aria-label="الفريق">${clubs.map(o=>{ const c=o.value, s=c?crestSrc(c):"";
        return circ(`data-pl-club="${esc(c)}"`, c?(s?`<img src="${s}" alt="" width="30" height="30">`:esc(c.slice(0,2))):IC.all, c?c:"كل الفرق", o.selected, "sm"); }).join("")}</div>`:""}`;
    const old=v.querySelector(".mf-circles"); if(old) old.remove();
    const wrap=v.querySelector(".st-wrap"); if(wrap) wrap.before(box); else v.prepend(box);
    const on=box.querySelector('.crests [aria-pressed="true"]'); if(on && on.previousElementSibling) on.scrollIntoView({block:"nearest", inline:"center"});
    plMount();
    v.querySelectorAll(".mf-ax-pl").forEach(x=>x.remove()); v.insertAdjacentHTML("afterbegin", statsHeadHTML());
  }
  D.addEventListener("click", e=>{
    const box=e.target.closest("#v-players .mf-circles"); if(!box) return;
    const c=e.target.closest("[data-pl-comp]"), k=e.target.closest("[data-pl-club]");
    if(c){ const s=D.getElementById("stComp"); if(s && s.value!==c.dataset.plComp){ s.value=c.dataset.plComp; s.dispatchEvent(new Event("change")); } return; }
    if(k){ const s=D.getElementById("stClub"); if(!s) return; s.value=k.dataset.plClub; s.dispatchEvent(new Event("change"));
      box.querySelectorAll("[data-pl-club]").forEach(b=>b.setAttribute("aria-pressed", b===k)); plMount(); }
  });
  /* ---------- الإحصائيات (التحليل): الأقسام دوائر، والمسابقة دوائر عند وجود أكثر من مسابقة ---------- */
  const AX_IC={overview:IC.stats, teams:IC.clubs, players:IC.players, refs:IC.refs};
  function axCircles(){
    const v=D.getElementById("v-analysis"), w=v && v.querySelector(".an"); if(!w) return;
    const ORD=["players","teams","overview","refs"];
    const tabs=[...w.querySelectorAll(".an-tabs [data-at]")].sort((a,b)=>ORD.indexOf(a.dataset.at)-ORD.indexOf(b.dataset.at)); if(!tabs.length) return;
    const have=safe(()=>compsPresent())||[];
    const comps=[...w.querySelectorAll(".compbar [data-comp]")].filter(b=>b.dataset.comp==="الكل" ? have.length>1 : have.includes(b.dataset.comp) || b.getAttribute("aria-pressed")==="true");
    const cur=safe(()=>AX.tab);
    const box=D.createElement("div"); box.className="mf-circles mf-ax";
    box.innerHTML=`<h2 class="mf-ptitle">الإحصائيات</h2><div class="mf-crow l1" role="group" aria-label="أقسام الإحصائيات">${tabs.map(b=>circ(`data-mf-at="${b.dataset.at}"`, AX_IC[b.dataset.at]||IC.stats, b.textContent.trim(), b.dataset.at===cur)).join("")}</div>
      ${comps.length>1?`<div class="mf-crow l2" role="group" aria-label="المسابقة">${comps.map(b=>{ const c=b.dataset.comp, logo=COMP_LOGO["c:"+c];
        return `<button type="button" class="mf-circ sm comp" data-mf-axc="${esc(c)}" aria-pressed="${b.getAttribute("aria-pressed")==="true"}"><i>${logo?`<img src="${logo}" alt="" width="32" height="32">`:c==="الكل"?IC.all:IC.cups}</i><span>${esc(c==="الكل"?"الإجمالي":c)}</span></button>`; }).join("")}</div>`:""}`;
    const old=v.querySelector(".mf-ax"); if(old) old.remove();
    w.prepend(box);
  }
  D.addEventListener("click", e=>{
    const box=e.target.closest("#v-analysis .mf-ax"); if(!box) return;
    const t=e.target.closest("[data-mf-at]");
    if(t){ if(t.dataset.mfAt==="players"){ plMode="top"; nav("players"); return; }
      const b=D.querySelector(`#v-analysis .an-tabs [data-at="${t.dataset.mfAt}"]`); if(b) b.click();
      box.querySelectorAll("[data-mf-at]").forEach(x=>x.setAttribute("aria-pressed", x===t)); return; }
    const c=e.target.closest("[data-mf-axc]");
    if(c){ const b=D.querySelector(`#v-analysis .compbar [data-comp="${CSS.escape(c.dataset.mfAxc)}"]`); if(b) b.click(); }
  });
  /* أي تبديل للقسم من داخل الصفحة (مثل الضغط على لاعب) يُحدّث الدوائر */
  D.addEventListener("click", e=>{ if(e.target.closest("#v-analysis .ax") && !e.target.closest(".mf-ax")) setTimeout(()=>{ const box=D.querySelector("#v-analysis .mf-ax"), cur=safe(()=>AX.tab);
    if(box) box.querySelectorAll("[data-mf-at]").forEach(x=>x.setAttribute("aria-pressed", x.dataset.mfAt===cur)); },0); });

  /* ---------- اللاعبون: لوحة «أبرز الأرقام» (أول 3 في كل فئة) ثم «كل الأرقام» = الجدول الأصلي ----------
     الأرقام من stData() نفسها (نفس الترتيب ونفس فلتر المسابقة والفريق) — لا حساب جديد */
  let plMode="top";
  const PL_GROUPS=[["الهجوم",["g","a","ga"]],["الحراسة والدفاع",["cs"]],["الانضباط",["y","r"]],["المشاركة",["mn","pk"]],["الفرق",["tm"]]];
  function topsHTML(){
    const keep=safe(()=>ST_TAB);
    const ini=n=>String(n||"").split(/\s+/).slice(0,2).map(w=>w[0]||"").join("");
    const face=r=>{ const c=safe(()=>(PHOTOSON && typeof LOCAL_PHOTOS!=="undefined") ? photoCut(r.n, r.c) : null);
      return c?`<img src="${c}_f.webp?v=29" alt="" loading="lazy" decoding="async">`:`<span>${esc(ini(r.n))}</span>`; };
    const card=t=>{ let d=null; try{ ST_TAB=t.k; d=stData(); }catch(e){ console.error(e); }
      if(!d || !d.rows.length) return "";
      const fmt=v=>t.k==="mn"?v+"′":v;
      return `<article class="mf-top3"><button type="button" class="mf-top3-hd" data-pl-all="${t.k}"><b>${esc(t.t)}</b>${IC.chev}</button>
        ${d.rows.slice(0,3).map(r=> d.team
          ? `<div class="mf-t3r" data-club-open="${esc(r.c)}" role="button" tabindex="0"><span class="rk">${r.rk}</span><span class="ph club">${crest(r.c)}</span><span class="nm"><b>${esc(r.c)}</b><small>${r.apps} مباريات</small></span><span class="v">${r.v}</span></div>`
          : `<div class="mf-t3r" data-player="${esc(r.n)}" data-club="${esc(r.c)}" role="button" tabindex="0"><span class="rk">${r.rk}</span><span class="ph">${face(r)}</span><span class="nm"><b>${esc(r.n)}</b><small>${crest(r.c)}${esc(r.c)}</small></span><span class="v">${fmt(r.v)}</span></div>`).join("")}
      </article>`; };
    const T=safe(()=>ST_TABS)||[];
    const html=PL_GROUPS.map(([g,ks])=>{ const cards=ks.map(k=>T.find(t=>t.k===k)).filter(Boolean).map(card).join("");
      return cards?`<section class="mf-tsec"><h3>${g}</h3><div class="mf-tgrid">${cards}</div></section>`:""; }).join("");
    safe(()=>{ ST_TAB=keep; });
    return `<div class="mf-tops">
      <div class="mf-sec-hd"><h2>أبرز الأرقام</h2><button type="button" class="mf-link" data-pl-all="${esc(keep||"g")}">كل الأرقام ${IC.chev}</button></div>
      ${html||`<div class="mf-empty"><b>لا توجد أرقام بعد</b><span>تظهر هنا بعد تسجيل أول مباراة في هذه المسابقة.</span></div>`}</div>`;
  }
  function plMount(){
    const v=D.getElementById("v-players"); if(!v) return;
    v.classList.toggle("mf-pl-top", plMode==="top");
    v.querySelectorAll(".mf-tops,.mf-pl-back").forEach(x=>x.remove());
    const circles=v.querySelector(".mf-circles"), wrap=v.querySelector(".st-wrap");
    if(plMode==="top"){ const ref=circles||wrap; if(ref) ref.insertAdjacentHTML(circles?"afterend":"beforebegin", topsHTML()); }
    else if(wrap){ wrap.insertAdjacentHTML("beforebegin", `<button type="button" class="mf-link mf-pl-back" data-pl-top>${IC.chev}<span>أبرز الأرقام</span></button>`); }
  }
  D.addEventListener("click", e=>{
    const a=e.target.closest("#v-players [data-pl-all]");
    if(a){ safe(()=>{ ST_TAB=a.dataset.plAll; }); plMode="list"; renderPlayers(); scrollTo(0,0); return; }
    if(e.target.closest("#v-players [data-pl-top]")){ plMode="top"; renderPlayers(); scrollTo(0,0); }
  });

  /* ---------- «اللاعبون» جزء من الإحصائيات: نفس العنوان والدوائر فوق لوحة أبرز الأرقام ----------
     أقسام اللاعبين في التحليل (من SUBS في analysis.js — داخل دالة مغلقة فتُكرَّر هنا بالأسماء نفسها) */
  const AX_PL_SUBS=[["perf","أداء اللاعبين"],["pform","فورمة اللاعبين"],["gk","الحراس"],["rate","التقييم"]];
  function statsHeadHTML(){
    const T=[["players","اللاعبون"],["teams","الفرق"],["overview","نظرة عامة"],["refs","الحكام"]];
    return `<div class="mf-circles mf-ax mf-ax-pl"><h2 class="mf-ptitle">الإحصائيات</h2>
      <div class="mf-crow l1" role="group" aria-label="أقسام الإحصائيات">${T.map(([k,t])=>circ(`data-mf-at="${k}"`, AX_IC[k], t, k==="players")).join("")}</div>
      <div class="mf-chips" role="tablist" aria-label="أقسام اللاعبين"><button type="button" class="st-tab" aria-selected="true">أبرز الأرقام</button>${AX_PL_SUBS.map(([k,t])=>`<button type="button" class="st-tab" data-mf-axsub="${k}" aria-selected="false">${t}</button>`).join("")}</div></div>`;
  }
  D.addEventListener("click", e=>{
    const t=e.target.closest("#v-players .mf-ax-pl [data-mf-at]");
    if(t && t.dataset.mfAt!=="players"){ setAX(t.dataset.mfAt); nav("analysis"); return; }
    const sb=e.target.closest("[data-mf-axsub]");
    if(sb){ safe(()=>{ AX.tab="players"; AX.sel=null; AX.sub.players=sb.dataset.mfAxsub; }); nav("analysis"); return; }
    if(e.target.closest("[data-mf-pltop]")){ plMode="top"; nav("players"); }
  });
  /* في التحليل: زر «أبرز الأرقام» أول أقسام اللاعبين (يُضاف بعد كل رسم للوحة) */
  function axPlChip(){
    const sn=D.querySelector("#v-analysis .ax-subnav"); if(!sn || sn.querySelector("[data-mf-pltop]")) return;
    if(safe(()=>AX.tab)!=="players") return;
    sn.insertAdjacentHTML("afterbegin", `<button type="button" role="tab" class="st-tab" data-mf-pltop aria-selected="false">أبرز الأرقام</button>`);
  }
  let axObs=null;
  function watchAx(){ const p=D.getElementById("axPanel"); if(!p || p.__mfObs) return; p.__mfObs=true;
    axObs=new MutationObserver(()=>safe(axPlChip)); axObs.observe(p,{childList:true}); safe(axPlChip); }

  /* ---------- توزيع الأهداف على الفترات: الضغط على عمود يُظهر الأندية التي سجّلت فيه (منصور 2026-10-05) ----------
     نفس المصدر ونفس التقسيم الذي يرسم العمود: GOALS (المسابقة المختارة) + period(g) */
  function periodClubsHTML(p){
    const gs=GOALS.filter(g=>period(g)===p);
    const by={}; gs.forEach(g=>{ (by[g.sc] ??= []).push(g); });
    const rows=Object.entries(by).sort((a,b)=>b[1].length-a[1].length || a[0].localeCompare(b[0],"ar"));
    const who=list=>list.sort((a,b)=>abs(a)-abs(b)).map(g=>`${esc(g.p||"")} <span class="mn" dir="ltr">${minLabel(g)}</span>`).join("، ");
    return `<div class="mf-per" role="region" aria-label="الأندية التي سجّلت في الدقائق ${esc(p)}">
      <div class="mf-per-hd"><b>الدقائق <bdi dir="ltr">${esc(p)}</bdi></b><span>${gs.length} ${gs.length===1?"هدف":gs.length===2?"هدفان":gs.length<=10?"أهداف":"هدفاً"}</span></div>
      ${rows.map(([c,list])=>`<div class="mf-per-r" data-club-open="${esc(c)}" role="button" tabindex="0">${crest(c)}<span class="nm"><b>${esc(c)}</b><small>${who(list)}</small></span><span class="n">${list.length}</span></div>`).join("")}
    </div>`;
  }
  D.addEventListener("click", e=>{
    const col=e.target.closest("#v-analysis .an-per .an-col"); if(!col) return;
    const card=col.closest(".an-per"), p=(col.querySelector(".p")||{}).textContent;
    const was=col.classList.contains("mf-sel");
    card.querySelectorAll(".an-col.mf-sel").forEach(x=>x.classList.remove("mf-sel"));
    card.querySelectorAll(".mf-per").forEach(x=>x.remove());
    if(was || !p || col.classList.contains("nil")) return;
    col.classList.add("mf-sel");
    safe(()=>{ card.insertAdjacentHTML("beforeend", periodClubsHTML(p.trim())); });
  });

  /* ---------- كأس الخليج: «البطاقات على فترات المباراة» — الضغط على فترة يُظهر المنتخبات واللاعبين (منصور 2026-10-05) ----------
     نفس المصدر والتقسيم الذي يرسم العمود: بطاقات البطولة (GULF.withGulf → CARDS) + period({m}) */
  function gulfCardsHTML(p){
    return GULF.withGulf(()=>{
      const cs=CARDS.filter(x=>period({m:+x.m||0})===p);
      const by={}; cs.forEach(x=>{ (by[x.club] ??= []).push(x); });
      const rows=Object.entries(by).sort((a,b)=>b[1].length-a[1].length || a[0].localeCompare(b[0],"ar"));
      const pill=x=>`<i class="mf-cd ${isRed(x.type)?"r":"y"}" aria-label="${isRed(x.type)?"طرد":"إنذار"}"></i>`;
      const who=list=>list.sort((a,b)=>(+a.m||0)-(+b.m||0)).map(x=>`<span class="mf-pl">${pill(x)}${esc(x.p||"")} <span class="mn" dir="ltr">${(+x.m||0)}${x.x?"+"+x.x:""}'</span></span>`).join("");
      const y=cs.filter(x=>!isRed(x.type)).length, r=cs.length-y;
      return `<div class="mf-per mf-gcp" role="region">
        <div class="mf-per-hd"><b>الدقائق <bdi dir="ltr">${esc(p)}</bdi></b><span>${y} إنذار${r?` · ${r} طرد`:""}</span></div>
        ${rows.map(([c,list])=>`<div class="mf-per-r">${crest(c)}<span class="nm"><b>${esc(c)}</b><small>${who(list)}</small></span><span class="n">${list.length}</span></div>`).join("")}
      </div>`;
    });
  }
  D.addEventListener("click", e=>{
    const col=e.target.closest("#v-gulf .gc-cp .gc-cp-c"); if(!col || !window.GULF) return;
    const wrap=col.closest(".gc-cp"), p=((col.querySelector(".p")||{}).textContent||"").trim();
    const was=col.classList.contains("mf-sel");
    wrap.querySelectorAll(".gc-cp-c.mf-sel").forEach(x=>x.classList.remove("mf-sel"));
    const host=wrap.parentNode; host.querySelectorAll(".mf-gcp").forEach(x=>x.remove());
    const v=col.querySelector(".v"); if(was || !p || !(v && v.textContent.trim())) return;
    col.classList.add("mf-sel");
    const after=wrap.nextElementSibling && wrap.nextElementSibling.classList.contains("gc-cp-lg") ? wrap.nextElementSibling : wrap;
    safe(()=>after.insertAdjacentHTML("afterend", gulfCardsHTML(p)));
  });

  function wrapRender(name, after){
    safe(()=>{
      const o=window[name]; if(typeof o!=="function" || o.__mfc) return;
      const w=function(){ const r=o.apply(this, arguments); safe(after); return r; };
      w.__mfc=true; window[name]=w; try{ if(name==="renderMatches") renderMatches=w; else if(name==="renderPlayers") renderPlayers=w; }catch(e){}
      if(typeof RENDER==="object" && RENDER){ const v=name==="renderMatches"?"matches":"players"; RENDER[v]=w; }
    });
  }

  /* ---------- التركيب بعد جاهزية الصفحة ---------- */
  function mount(){
    buildTop(); buildBar();
    try{ window.renderHome = renderHomeMF; renderHome = renderHomeMF; }catch(e){ window.renderHome = renderHomeMF; }
    if(typeof RENDER==="object" && RENDER) RENDER.home = renderHomeMF;
    wrapRender("renderMatches", mxCircles); wrapRender("renderPlayers", plCircles);
    safe(()=>{ if(typeof RENDER==="object" && RENDER && RENDER.analysis && !RENDER.analysis.__mfc){ const o=RENDER.analysis; const w=function(){ const r=o.apply(this, arguments); safe(axCircles); safe(watchAx); return r; }; w.__mfc=true; RENDER.analysis=w; } });
    if(D.querySelector("#v-home.on") && typeof MATCHES!=="undefined") safe(renderHomeMF);
    const nt=D.querySelector("nav.tabs");
    if(nt) new MutationObserver(paintActive).observe(nt,{subtree:true,attributes:true,attributeFilter:["aria-selected","style"]});
    paintActive();
  }
  if(D.readyState==="loading") D.addEventListener("DOMContentLoaded", mount); else mount();
})();
