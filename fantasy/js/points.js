/* =========================================================
   صفحة النقاط على طراز FPL:
   - بعد موعد إغلاق الجولة يظهر الملعب وتحت كل لاعب نقاطه (مباشرة أثناء الجولة، ومعتمدة بعدها)
   - الضغط على اللاعب يفتح بطاقة «تفصيل النقاط»: المباراة، والدقائق/الأهداف/الصناعة/الشباك
     النظيفة/البطاقات/البونص بنداً بنداً — نفس معادلة الاحتساب (explainPoints في engine.js)
   يُحمَّل بعد live-gw.js ويستبدل VIEWS.points القديمة (الجدول).
   ========================================================= */
'use strict';

Object.assign(VIEWS, {
  /* الجولات التي لفريقي نقاط فيها: المعتمدة من السجل + الجارية الآن */
  pointsGws(team){
    const st=DB.state, hist=(team&&team.history)||[];
    const liveOn = typeof LIVEGW!=='undefined' && LIVEGW.active() && ((team&&team.squad)||[]).length>0 && !hist.some(x=>x.gw===st.currentGW);
    const gws=[...new Set(hist.map(x=>x.gw))].sort((a,b)=>a-b);
    if(liveOn) gws.push(st.currentGW);
    return { gws, liveOn };
  },

  /* نقاط فريقي في جولة: من السجل إن اعتُمدت، أو حساب مباشر إن كانت جارية */
  pointsData(team, gw, isLive){
    const st=DB.state;
    const res = isLive ? LIVEGW.mine() : TEAM.gwPoints(team, gw, st);
    const ls = isLive ? (LIVEGW.summary()||{}) : {};
    const g = DB.gw(gw)||{};
    const hist=(team.history||[]).find(x=>x.gw===gw);
    const h = (isLive || !hist) ? {gw, pts:res.total, hits:res.hits, benchPts:res.benchPts, chip:res.chip, rank:(ls.rank||null)} : hist;
    const picks = isLive ? LIVEGW.picksOf(team, gw) : (team.gwPicks[gw]||null);
    const champ = (!isLive && typeof GWADMIN.champion==='function') ? GWADMIN.champion(gw) : null;
    return { res, h, picks, isLive,
      avg:  isLive ? (ls.avg ?? null)  : (g.avg ?? null),
      high: isLive ? (ls.high ?? null) : (g.high ?? (champ? champ.pts : null)) };
  },

  /* معلومات كل لاعب على بطاقة النقاط: نقاطه، الكابتن، دخل/خرج بالتبديل التلقائي، مباراته لم تُلعب */
  pointsSlotInfo(res, picks, gw){
    const st=DB.state, info={};
    const origXI = picks ? (picks.xi||[]) : [];
    const mult = res.chip==='triplecap' ? 3 : 2;
    const fxOf = club => st.fixtures.find(f=>f.gw===gw && (f.h===club||f.a===club));
    res.rows.forEach(r=>{
      const p=DB.player(r.pid); if(!p) return;
      const fx=fxOf(p.club), s=DB.pgw(r.pid,gw);
      const inOrig=origXI.includes(r.pid);
      const counted = !r.bench || res.chip==='benchboost';
      info[r.pid]={
        pts:r.pts, eff:r.eff, cap:r.cap, bench:r.bench, counted,
        vice: !r.cap && !!picks && picks.vice===r.pid,
        mult: r.cap ? mult : (counted ? 1 : 0),
        sub: (!r.bench && origXI.length && !inOrig) ? 'in' : (r.bench && inOrig) ? 'out' : '',
        pending: !!fx && fx.status!=='F', noMatch: !fx, played: !!(s && s.min>0),
      };
    });
    return info;
  },

  /* بطاقة لاعب على ملعب النقاط */
  pointsSlot(pid, i, gw){
    const p=DB.player(pid); if(!p) return '';
    i=i||{};
    const shown = i.counted ? i.eff : i.pts;
    const txt = i.pending ? 'لم تُلعب' : i.noMatch ? 'بلا مباراة' : String(shown);
    const cls = (i.pending||i.noMatch) ? 'pend' : !i.counted ? 'bn' : shown<0 ? 'neg' : shown===0 ? 'zero' : '';
    const tag = i.sub==='in' ? '<div class="sub">دخل</div>' : i.sub==='out' ? '<div class="sub">خرج</div>' : '';
    return `<div class="pslot pts-slot ${i.sub==='out'?'out':''}" onclick="VIEWS.pointsSheet('${pid}',${gw},${i.mult==null?1:i.mult},'${i.sub||''}')">
      ${i.cap? '<div class="badge">C</div>' : i.vice? '<div class="badge v">V</div>' : ''}
      ${tag}
      <div class="club-tag">${DB.club(p.club).short}</div>
      ${UI.pitchKit(p, 54)}
      <div class="nm">${esc(p.name.split(' ').slice(-1)[0])}</div>
      <div class="pt score ${cls}">${txt}</div>
    </div>`;
  },

  /* الملعب بنقاط الجولة: التشكيلة بعد التبديل التلقائي كما احتُسبت */
  pointsPitch(res, info, gw){
    const xi=res.rows.filter(r=>!r.bench).map(r=>r.pid), bench=res.rows.filter(r=>r.bench).map(r=>r.pid);
    const vt={ xi, bench, cap:null, vice:null };
    const slot=pid=>this.pointsSlot(pid, info[pid], gw);
    let k=0;
    return `<div class="pitch-frame">
      ${this.pitchHTML(vt, {view:true, slot})}
      <div class="bench-strip">
        ${bench.map(pid=>{ const p=DB.player(pid); const lbl=p.pos==='G' ? 'حارس' : `بديل ${++k} · ${POS_AR[p.pos]}`;
          return `<div class="bench-slot"><div class="bench-pos">${lbl}</div>${slot(pid)}</div>`; }).join('')}
      </div>
      ${res.chip==='benchboost' ? '<div class="tiny bench-hint">دكة قوية — نقاط الدكة محسوبة ضمن مجموعك</div>' : ''}
    </div>`;
  },

  /* عرض القائمة */
  pointsList(res, info, gw){
    const mult = res.chip==='triplecap' ? 3 : 2;
    const row=r=>{
      const p=DB.player(r.pid); if(!p) return '';
      const s=DB.pgw(r.pid,gw), i=info[r.pid]||{};
      return `<tr onclick="VIEWS.pointsSheet('${p.id}',${gw},${i.mult==null?1:i.mult},'${i.sub||''}')" style="cursor:pointer">
        <td><div class="row">${UI.playerAvatar(p,28)} <div><b>${esc(p.name)}</b> ${r.cap?'<span class="pill gold">C</span>':''} ${i.sub==='in'?'<span class="pill green">دخل</span>':i.sub==='out'?'<span class="pill">خرج</span>':''}<div class="tiny">${DB.club(p.club).short} · ${POS_AR[p.pos]}</div></div></div></td>
        <td class="tiny">${i.pending? 'لم تُلعب' : s? s.min+"'" : '—'}</td><td class="tiny">${s? s.g:0}/${s? s.a:0}</td><td class="tiny">${s&&s.bonus? '+'+s.bonus:'—'}</td>
        <td class="num" style="color:var(--accent)">${r.cap? r.eff+' ('+r.pts+'×'+mult+')' : (i.counted? r.eff : r.pts)}</td></tr>`;
    };
    return `<div class="card"><h3>التشكيلة الأساسية — الكابتن: ${esc(res.capName)}</h3>
      <div class="scroll-x"><table class="tbl"><tr><th>اللاعب</th><th>دقائق</th><th>أهداف/صناعة</th><th>بونص</th><th>النقاط</th></tr>
      ${res.rows.filter(r=>!r.bench).map(row).join('')}</table></div>
      <h3 style="margin-top:16px">الدكة ${res.chip==='benchboost'?'<span class="pill green">دكة قوية — احتُسبت</span>':''}</h3>
      <div class="scroll-x"><table class="tbl">${res.rows.filter(r=>r.bench).map(row).join('')}</table></div>
    </div>`;
  },

  /* ======================= صفحة النقاط ======================= */
  points(){
    const st=DB.state, team=DB.myTeam(), m=DB.me();
    const {gws, liveOn}=this.pointsGws(team);
    if(!gws.length) return `<div class="pts-page"><div class="card"><h3>النقاط</h3>
      <div class="muted">لا نقاط بعد — تظهر نقاط فريقك هنا بعد موعد إغلاق الجولة، وتتحدث مع كل مباراة تُلعب.</div>
      <button class="btn sec" style="margin-top:12px" onclick="APP.go('live')">${UI.icon('live',18)} المركز المباشر — مباريات الجولة</button></div></div>`;
    const gw = gws.includes(this.ui.pointsGw) ? this.ui.pointsGw : gws[gws.length-1];
    const isLive = liveOn && gw===st.currentGW;
    if(isLive) LIVEGW.refresh();
    const d=this.pointsData(team, gw, isLive);
    const {res,h,picks}=d;
    const info=this.pointsSlotInfo(res, picks, gw);
    const i=gws.indexOf(gw), prev=gws[i-1], next=gws[i+1];
    const chipLabel = h.chip ? ((st.rules.chips[h.chip]||{}).label||h.chip) : '';
    const view=this.ui.pointsView||'pitch';
    const notes=[];
    if(isLive){ const lm=LIVEGW.matches(); notes.push(`${lm.played} من ${lm.total} مباريات لُعبت${LIVEGW.snapLabel()? ' · '+LIVEGW.snapLabel() : ''}`); }
    else if(typeof h.rank==='number') notes.push(`ترتيب الجولة: ${h.rank.toLocaleString('ar')}`);
    if(h.hits) notes.push(`خصم انتقالات: -${h.hits}`);
    notes.push(`نقاط الدكة: ${h.benchPts}`);
    const fmt=v=> (v==null ? '—' : v);
    return `<div class="pickteam pts-page">
      <div class="pts-hero">
        <div class="pts-team" data-i18n="off">${esc(m.teamName)}</div>
        <div class="pts-nav">
          <button class="prev" ${prev==null?'disabled':''} onclick="VIEWS.ui.pointsGw=${prev};APP.render()" title="الجولة السابقة">${UI.icon('chev',22)}</button>
          <div class="pts-gw">الجولة ${gw} ${isLive?'<span class="pill red">مباشر</span>':''}</div>
          <button class="next" ${next==null?'disabled':''} onclick="VIEWS.ui.pointsGw=${next};APP.render()" title="الجولة التالية">${UI.icon('chev',22)}</button>
        </div>
        <div class="pts-stats">
          <div><b>${fmt(d.avg)}</b><span>المتوسط</span></div>
          <div class="big"><b>${h.pts}</b><span>${isLive?'نقاطك الآن':'نقاطك'}</span>${chipLabel? `<em>${esc(chipLabel)}</em>`:''}</div>
          <div class="${isLive?'':'link'}" ${isLive?'':`onclick="APP.go('champions')"`}><b>${fmt(d.high)}</b><span>الأعلى</span></div>
        </div>
        <div class="pts-note">${notes.map(n=>`<span>${n}</span>`).join(' · ')}</div>
      </div>
      <div class="pt-toggle">
        <button class="${view==='pitch'?'active':''}" onclick="VIEWS.ui.pointsView='pitch';APP.render()">الملعب</button>
        <button class="${view==='list'?'active':''}" onclick="VIEWS.ui.pointsView='list';APP.render()">قائمة</button>
      </div>
      ${view==='pitch' ? this.pointsPitch(res, info, gw) : this.pointsList(res, info, gw)}
      ${isLive ? `<div class="tiny pts-foot">النقاط تتحدث مع كل مباراة تُسجَّل، وتُعتمد رسمياً عند إغلاق الجولة. لاعب لم تُلعب مباراته بعد يبقى في تشكيلتك.</div>` : ''}
    </div>`;
  },

  /* ======================= بطاقة تفصيل النقاط ======================= */
  pointsSheet(pid, gw, mult, sub){
    const st=DB.state, p=DB.player(pid); if(!p) return;
    gw=+gw; mult = (mult==null) ? 1 : +mult; sub=sub||'';
    const c=DB.club(p.club);
    const POS_FULL={G:'حارس مرمى',D:'مدافع',M:'لاعب وسط',F:'مهاجم'};
    const fx=st.fixtures.find(f=>f.gw===gw && (f.h===p.club||f.a===p.club));
    const r=DB.pgw(pid,gw);
    const played = !!(r && r.min>0);
    const done = !!fx && fx.status==='F';
    const ex = explainPoints(st, p, r);
    const total = r ? (r.pts||0) : 0;
    if(played && ex.total!==total) console.warn('points breakdown mismatch', pid, gw, ex.total, total);
    const side=id=>`<span class="tm ${id===p.club?'me':''}">${UI.crest(id)}<b>${DB.club(id).short}</b></span>`;
    const match = !fx
      ? `<div class="bd-match"><span class="muted">لا مباراة لناديه في هذه الجولة</span></div>`
      : `<div class="bd-match">${side(fx.h)}${(done||fx.status==='L') ? `<span class="sc"><i>${fx.hs}</i><i>-</i><i>${fx.as}</i></span>` : `<span class="sc tm">${UI.fmtDateShort(fx.date)}</span>`}${side(fx.a)}</div>`;
    let body='', tot='';
    if(!fx) body=`<tr><td colspan="3" class="muted">لا مباراة — لا نقاط في هذه الجولة</td></tr>`;
    else if(!done && !played) body=`<tr><td colspan="3" class="muted">${fx.status==='L' ? 'المباراة جارية' : 'لم تُلعب المباراة بعد'} — النقاط تظهر بعد تسجيل المباراة</td></tr>`;
    else if(!played) body=`<tr><td>لم يشارك في المباراة</td><td>—</td><td>0</td></tr>`;
    else body=ex.rows.map(x=>`<tr><td>${x.label}</td><td>${x.val}</td><td class="${x.pts<0?'neg':''}">${x.pts}</td></tr>`).join('');
    if(fx && (done || played)){
      tot=`<tr class="tot"><td>المجموع</td><td></td><td>${total}</td></tr>`
        + (mult>1 ? `<tr class="tot cap"><td>الكابتن ×${mult}</td><td></td><td>${total*mult}</td></tr>` : '');
    }
    const notes=[];
    if(sub==='in') notes.push('دخل من الدكة تلقائياً مكان لاعب أساسي لم يشارك.');
    if(sub==='out') notes.push('لم يشارك، فدخل بديله من الدكة تلقائياً.');
    if(mult===0) notes.push('على الدكة — نقاطه لا تُضاف إلى مجموعك (إلا مع كرت الدكة القوية).');
    UI.sheet(`
      <div class="ps-head">
        <div class="ps-kit">${UI.playerPhoto(p)? `<img class="ps-photo" src="${esc(UI.playerPhoto(p))}" alt="">` : UI.kitShirt(p.club, p.pos==='G', 84)}</div>
        <div style="flex:1">
          <div class="ps-pos">${POS_FULL[p.pos]}</div>
          <div class="ps-name">${esc(p.name)}</div>
          <div class="ps-club">${c.name}${p.shirt?` · #${p.shirt}`:''}</div>
        </div>
        ${UI.crest(p.club,'lg')}
      </div>
      <div class="bd-gw">الجولة ${gw}${fx && fx.date ? ' · '+UI.fmtDate(fx.date) : ''}</div>
      ${match}
      <div class="bd-card">
        <h4>تفصيل النقاط</h4>
        <table class="bd-tbl"><tr><th>البند</th><th>العدد</th><th>النقاط</th></tr>${body}${tot}</table>
      </div>
      ${notes.length ? `<div class="bd-note">${notes.join(' ')}</div>` : ''}
      <div class="ps-actions"><button class="btn ghost" onclick="UI.closeSheet();VIEWS.openPlayer('${pid}')">الملف الكامل</button></div>`);
  },
});
