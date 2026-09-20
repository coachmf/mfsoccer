/* =========================================================
   المدرب — الواجهة: خانة على الملعب يمين الحارس (بصورته)، شاشة اختيار
   المدرب، ورقة سريعة، صفحة ملف المدرب، بطاقة النقاط وتفصيلها، قسم
   الإدارة، فقرة اللائحة في «عن اللعبة»، والترجمة الإنجليزية.
   يُحمَّل بعد picker.js (يعتمد على VIEWS/UI/TEAM/COACHES).
   ========================================================= */
'use strict';

/* أسماء المدربين بالإنجليزية (بطاقات الملعب تعرض الكلمة الأخيرة) */
const COACH_NAMES_EN = {
  'فراس الخطيب':'Firas Al-Khatib', 'غوران سابليتش':'Goran Sablić', 'محمد إبراهيم':'Mohammed Ibrahim',
  'علي عاشور':'Ali Ashour', 'دراغان تاديتش':'Dragan Tadić', 'ظاهر العدواني':'Dhaher Al-Adwani',
  'مارتن سيفيلا':'Martin Ševela', 'أحمد عبدالكريم':'Ahmad Abdulkarim', 'أنطونيو ميراندا':'António Miranda',
  'واغنر أندرادي':'Wagner Andrade', 'إيغور ريميتش':'Igor Remetić', 'علي عبدالرضا':'Ali Abdulredha',
};
const COACH_NAT_EN = { 'الكويت':'Kuwait', 'سوريا':'Syria', 'كرواتيا':'Croatia', 'البحرين':'Bahrain', 'سلوفاكيا':'Slovakia',
  'البرتغال':'Portugal', 'البرازيل':'Brazil', 'البوسنة':'Bosnia' };
const COACH_FLAG = { 'الكويت':'kw', 'سوريا':'sy', 'كرواتيا':'hr', 'البحرين':'bh', 'سلوفاكيا':'sk', 'البرتغال':'pt', 'البرازيل':'br', 'البوسنة':'ba' };

const COACH_UI = {
  /* مكان المدرب على شاشة الفريق: 'row' يمين الحارس · 'bench' أول الدكة · 'bar' شريط الجهاز الفني تحت الملعب */
  layout(){ try{ return localStorage.getItem('kwf_coach_layout') || 'bar'; }catch(e){ return 'bar'; } },
  lastName(c){ return String(c.name||'').trim().split(/\s+/).slice(-1)[0]; },
  flag(c, size){
    const k=COACH_FLAG[c.nat]; if(!k) return '';
    return `<img class="cflag" src="https://flagcdn.com/w40/${k}.png" srcset="https://flagcdn.com/w80/${k}.png 2x" alt="" title="${esc(c.nat)}" style="width:${size||18}px" decoding="async" draggable="false" onerror="this.style.display='none'">`;
  },
  /* المدرب واقف بالقصّة الكاملة — مثل صور اللاعبين، بلا دائرة (منصور 2026-09-20) */
  avatar(c, size){
    size=size||54; const club=DB.club(c.club);
    return `<img class="ccut" style="height:${Math.round(size*1.2)}px" src="${esc(COACHES.photo(c,'s'))}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${esc(club.crest)}';this.style.height='${size}px'">`;
  },
  /* بطاقة الملعب: نفس صندوق القميص (.pk) وبداخله المدرب واقفاً — متناسق مع بقية البطاقات */
  pitchCut(c){
    const club=DB.club(c.club);
    return `<div class="pk cpk" style="--cc:${club.color}"><img class="ccut" src="${esc(COACHES.photo(c,'s'))}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${esc(club.crest)}';this.classList.add('noph')"></div>`;
  },
  formPills(form){ return (form||[]).map(f=>`<span class="cform ${f}">${f==='w'?'ف':f==='d'?'ت':'خ'}</span>`).join(''); },
  rankNow(club){ return STANDINGS.rankOf(DB.state, 99, club); },
};

Object.assign(VIEWS, {
  /* ======================= خانة المدرب على الملعب ======================= */
  /* opt.mode: 'team' (فريقي) | 'picker' (تكوين) | 'transfer' | opt.view (فريق مشترك) | opt.coachPts (صفحة النقاط) */
  coachSlotHTML(team, opt){
    opt=opt||{}; const st=DB.state;
    if(!COACHES.enabled(st)) return '';
    const id = opt.mode==='picker' ? this.ui.pickerCoach : (team && team.coach);
    const c = id ? COACHES.get(st, id) : null;
    const R=COACHES.rules(st);
    if(!c){
      if(opt.view || opt.coachPts!==undefined) return '';
      const click = opt.locked ? '' : `onclick="VIEWS.openAddCoach({ctx:'${opt.mode==='picker'?'picker':'team'}'})"`;
      return `<div class="pslot cslot empty ${opt.locked?'':'need'}" ${click} data-testid="coach-slot">
        <div class="empty-shirt">${UI.icon('plus',20)}</div>
        <div class="nm">المدرب</div><div class="pt">اختر مدرباً</div></div>`;
    }
    const club=DB.club(c.club);
    let sub='';
    if(opt.coachPts!==undefined){
      const cp=opt.coachPts;
      sub = !cp ? '—' : cp.gone ? 'غادر النادي' : cp.pending && !cp.rows.length ? 'لم تُلعب' : !cp.matches.length ? 'بلا مباراة' : String(cp.total);
      const cls = !cp || cp.gone || (cp.pending && !cp.rows.length) || !cp.matches.length ? 'pend' : cp.total<0 ? 'neg' : cp.total===0 ? 'zero' : '';
      return `<div class="pslot cslot pts-slot" onclick="VIEWS.coachPointsSheet('${c.id}',${opt.gw})">
        <div class="club-tag">المدرب</div>${COACH_UI.pitchCut(c)}
        <div class="nm">${esc(COACH_UI.lastName(c))}</div><div class="pt score ${cls}">${sub}</div></div>`;
    }
    if(opt.mode==='picker' || opt.mode==='transfer') sub=fmtM(c.price);
    else {
      const ct=TEAM.coachContract(team, st);
      const next=FDR.next(c.club,1)[0];
      sub = next ? `${DB.club(next.opp).short} ${UI.ha(next.home)}` : `عقد ج${ct.since}→ج${ct.since+ct.len}`;
    }
    const click = opt.view ? `onclick="VIEWS.openCoach('${c.id}')"` : `onclick="VIEWS.coachSheet('${c.id}','${opt.mode||'team'}')"`;
    return `<div class="pslot cslot" ${click} data-testid="coach-slot">
      <div class="club-tag">${esc(club.short)} · المدرب</div>
      ${COACH_UI.pitchCut(c)}
      <div class="nm">${esc(COACH_UI.lastName(c))}</div>
      <div class="pt">${sub}</div>
    </div>`;
  },

  /* شريط الجهاز الفني: تحت الملعب وفوق الدكة — بنفس تدرّج البطاقات الزرقاء في التطبيق.
     opt.mode: 'team' | 'picker' | 'transfer' | opt.view (مشترك آخر) | opt.coachPts (صفحة النقاط) */
  coachBarHTML(team, opt){
    opt=opt||{}; const st=DB.state; if(!COACHES.enabled(st)) return '';
    const mode=opt.mode||'team';
    const id = mode==='picker' ? this.ui.pickerCoach : (team && team.coach);
    const c = id ? COACHES.get(st, id) : null;
    if(!c){
      if(opt.view || opt.coachPts!==undefined) return '';
      const click = opt.locked ? '' : `onclick="VIEWS.openAddCoach({ctx:'${mode==='picker'?'picker':'team'}'})"`;
      return `<div class="coach-bar empty" ${click} data-testid="coach-bar">
        <div class="cb-ph"><div class="empty-shirt">${UI.icon('plus',20)}</div></div>
        <div class="cb-txt"><div class="cb-lbl">المدرب</div><b>اختر مدرباً</b><span>نقاطه من نتائج ناديه وصعوبة المنافس</span></div>
        <div class="cb-side"><span class="pill cb-pill">${mode==='picker'? 'مطلوب' : 'إضافة'}</span></div></div>`;
    }
    const club=DB.club(c.club), next=FDR.next(c.club,1)[0];
    const rec=STANDINGS.record(st, c.club)||{form:[]}, rank=COACH_UI.rankNow(c.club);
    const formHTML=`<div class="cb-form" title="آخر 5 مباريات">${COACH_UI.formPills(rec.form.slice(-5))||'<span class="cb-cap">لا مباريات بعد</span>'}</div>`;
    let side='', sub=`${UI.crest(c.club)} ${esc(club.short)}${rank? ` · المركز ${rank}` : ''}`, click='', ctLine='';   // الشريط: صورة واسم وسطر النادي (+ سطر العقد) — منصور
    if(opt.coachPts!==undefined){
      const cp=opt.coachPts;
      const txt = !cp ? '—' : cp.gone ? 'غادر النادي' : cp.pending && !cp.rows.length ? 'لم تُلعب' : !cp.matches.length ? 'بلا مباراة' : String(cp.total);
      const cls = !cp || cp.gone || (cp.pending && !cp.rows.length) || !cp.matches.length ? 'pend' : cp.total<0 ? 'neg' : '';
      const m = cp && cp.matches[0];
      if(m) sub += ` · ${DB.club(m.opp).short} ${UI.ha(m.home)}${m.pending? '' : ` ${m.gf}-${m.ga}`}`;
      side=`<span class="cb-pts ${cls}">${txt}</span><span class="cb-cap">نقطة</span>`;
      click=`onclick="VIEWS.coachPointsSheet('${c.id}',${opt.gw})"`;
    } else if(opt.view){
      if(next) sub += ` · ${DB.club(next.opp).short} ${UI.ha(next.home)}`;
      click=`onclick="VIEWS.openCoach('${c.id}')"`;
    } else if(mode==='picker' || mode==='transfer'){
      sub += ` · ${fmtM(c.price)}`;
      click=`onclick="VIEWS.coachSheet('${c.id}','${mode}')"`;
    } else {
      if(next) sub += ` · ${DB.club(next.opp).short} ${UI.ha(next.home)}`;
      click=`onclick="VIEWS.coachSheet('${c.id}','team')"`;
      const ct=TEAM.coachContract(team, st);
      ctLine = ct.free ? 'العقد انتهى — التغيير مجاني' : `العقد: من الجولة ${ct.since} إلى الجولة ${ct.since+ct.len}`;
    }
    return `<div class="coach-bar" ${click} data-testid="coach-bar">
      <div class="cb-ph cb-bust" style="--cc:${club.color}"><img class="ccut" src="${esc(COACHES.photo(c,false))}" alt="" onerror="this.onerror=null;this.src='${esc(COACHES.photo(c,true))}'"></div>
      <div class="cb-txt"><div class="cb-lbl">المدرب ${COACH_UI.flag(c,14)}</div><b>${esc(c.name)}</b><span>${sub}</span>${ctLine? `<span class="cb-ct">${ctLine}</span>`:''}</div>
      ${side? `<div class="cb-side">${side}</div>` : ''}
    </div>`;
  },

  /* ======================= الورقة السفلية ======================= */
  coachSheet(id, mode){
    const st=DB.state, c=COACHES.get(st,id); if(!c) return;
    const club=DB.club(c.club), team=DB.myTeam();
    const mine = team && team.coach===id && mode!=='picker';
    const ct = mine ? TEAM.coachContract(team, st) : null;
    const cost = mine ? null : (team && team.coach ? TEAM.coachChangeCost(team, st) : {free:true});
    const rec=STANDINGS.record(st, c.club)||{P:0,W:0,D:0,L:0,form:[]};
    const rank=COACH_UI.rankNow(c.club);
    const locked=GWADMIN.deadlinePassed(st.currentGW);
    const next=FDR.next(c.club,3);
    let actions='';
    if(mode==='picker'){
      actions=`<button class="btn sec" onclick="UI.closeSheet();VIEWS.openAddCoach({ctx:'picker'})">تغيير المدرب</button>
        <button class="btn ghost" onclick="UI.closeSheet();VIEWS.pickerRemoveCoach()">إزالة</button>`;
    } else if(mine){
      const why = locked ? 'أُغلقت الجولة' : (cost&&!cost.free)? '' : '';
      actions=`<button class="btn sec" ${locked?'disabled':''} onclick="UI.closeSheet();VIEWS.openAddCoach({ctx:'team'})">تغيير المدرب</button>`;
      if(ct) actions=`<div class="tiny" style="margin-bottom:8px">العقد: من الجولة ${ct.since} إلى الجولة ${ct.since+ct.len}${ct.free? ' — التغيير مجاني الآن' : (st.rules.freeChanges? ' — تغييرات حرة حتى الإغلاق' : ' — التغيير المبكر يستهلك انتقالاً أو −'+st.rules.transferCost)}</div>`+actions;
    }
    UI.sheet(`
      <div class="ps-head ps-head-photo" style="background:linear-gradient(135deg,${club.color} 0%,${club.dark} 100%)">
        <div class="ps-kit"><img class="ps-photo ps-cut" src="${esc(COACHES.photo(c,false))}" alt="" onerror="this.style.display='none'"></div>
        <div style="flex:1">
          <div class="ps-pos">المدرب ${COACH_UI.flag(c,16)}</div>
          <div class="ps-name">${esc(c.name)}</div>
          <div class="ps-club">${club.name} · ${fmtK(c.price)}</div>
        </div>
        ${UI.crest(c.club,'lg')}
      </div>
      <div class="bd-card">
        <div class="grid g4 cstats">
          <div class="statbox"><div class="v">${rank||'—'}</div><div class="l">المركز</div></div>
          <div class="statbox"><div class="v">${rec.W}-${rec.D}-${rec.L}</div><div class="l">فوز-تعادل-خسارة</div></div>
          <div class="statbox"><div class="v">${COACH.total(st,id)}</div><div class="l">نقاط الفانتسي</div></div>
          <div class="statbox"><div class="v">${MARKET.ownership(id)}%</div><div class="l">التملّك</div></div>
        </div>
        <div class="row" style="gap:6px;margin:10px 0 4px;align-items:center"><span class="tiny">آخر 5:</span>${COACH_UI.formPills(rec.form.slice(-5))||'<span class="tiny">—</span>'}</div>
        <div class="fdr-line">${next.map(x=>UI.fdrPill(x)).join('')}</div>
      </div>
      <div class="ps-actions">${actions}<button class="btn ghost" onclick="UI.closeSheet();VIEWS.openCoach('${id}')">الملف الكامل</button></div>`);
  },

  /* ======================= شاشة اختيار المدرب ======================= */
  openAddCoach(o){
    o=o||{}; const st=DB.state;
    if(o.ctx!=='picker' && GWADMIN.deadlinePassed(st.currentGW)){ UI.toast('أُغلقت الجولة — تغيير المدرب بعد الاحتساب',true); return; }
    this.ui.addc={ ctx:o.ctx||'team', sort:'price' };
    document.body.classList.add('addp-open');
    let back=document.getElementById('addpBack');
    if(!back){ back=document.createElement('div'); back.id='addpBack'; document.body.appendChild(back); }
    this.renderAddCoach();
  },
  closeAddCoach(){
    const b=document.getElementById('addpBack'); if(b) b.remove();
    document.body.classList.remove('addp-open');
    this.ui.addc=null;
  },
  /* الرصيد المتاح للمدرب في هذا السياق */
  addcBank(){
    const a=this.ui.addc; const st=DB.state, R=st.rules;
    if(a.ctx==='picker'){
      const sq=this.ui.pickerSquad||[];
      return Math.round((R.budget-sq.reduce((s,x)=>s+DB.player(x).price,0))*10)/10;
    }
    const team=DB.myTeam(); const cur=TEAM.coachOf(team, st);
    return Math.round(((+team.bank||0)+(cur? +cur.price:0))*10)/10;
  },
  addcBlock(c, bank){
    const a=this.ui.addc; const st=DB.state; const team=DB.myTeam();
    if(COACHES.gone(c, st.currentGW)) return 'غادر النادي';
    const curId = a.ctx==='picker' ? this.ui.pickerCoach : (team && team.coach);
    if(curId===c.id) return 'مدربك الحالي';
    if(c.price>bank+1e-9) return 'الرصيد لا يكفي';
    return null;
  },
  renderAddCoach(){
    const a=this.ui.addc; if(!a) return;
    const st=DB.state; const back=document.getElementById('addpBack'); if(!back) return;
    const bank=this.addcBank();
    const team=DB.myTeam();
    const cost = a.ctx==='team' && team && team.coach ? TEAM.coachChangeCost(team, st) : {free:true};
    const val={ price:c=>c.price, total:c=>COACH.total(st,c.id), rank:c=>-COACH_UI.rankNow(c.club), owned:c=>MARKET.ownership(c.id) }[a.sort];
    const list=COACHES.all(st).slice().sort((x,y)=>(val(y)-val(x)) || y.price-x.price);
    const rows=list.map(c=>{
      const block=this.addcBlock(c,bank); const club=DB.club(c.club); const rec=STANDINGS.record(st,c.club)||{form:[]};
      return `<div class="addp-row ${block?'dim':''}" onclick="VIEWS.addcPick('${c.id}')" ${block?`data-why="${esc(block)}"`:''}>
        <button class="addp-i" onclick="event.stopPropagation();VIEWS.coachSheet('${c.id}','${a.ctx}')">${UI.icon('info',18)}</button>
        ${COACH_UI.avatar(c,36)}
        <div class="addp-name"><b>${esc(c.name)}</b><span>${esc(club.short)} · المركز ${COACH_UI.rankNow(c.club)||'—'}${block?` · <i>${block}</i>`:''}</span>
          <div class="row" style="gap:3px;margin-top:2px">${COACH_UI.formPills(rec.form.slice(-5))}</div></div>
        <div class="addp-c">${COACH.total(st,c.id)}</div>
        <div class="addp-c">${fmtM(c.price)}</div>
        <div class="addp-c">${MARKET.ownership(c.id)}%</div>
      </div>`;
    }).join('');
    back.innerHTML=`<div class="addp">
      <div class="addp-top">
        <button class="iconbtn" onclick="VIEWS.closeAddCoach()">${UI.icon('back',20)}</button>
        <h3>اختيار المدرب</h3><span style="width:36px"></span>
      </div>
      <div class="addp-bank">بالبنك ${fmtK(bank)}${!cost.free? ` · <span style="color:var(--red)">التغيير المبكر ${cost.usesFT? 'يستهلك انتقالاً مجانياً' : '−'+cost.hits+' نقاط'}</span>` : ''}</div>
      <div class="tiny" style="margin:0 0 8px;color:var(--text3)">مدرب واحد لفريقك، خارج الـ15. نقاطه من نتيجة ناديه وصعوبة المنافس حسب جدول الدوري — عقد من ${COACHES.rules(st).contract} جولتين.</div>
      <div class="addp-filters">
        <select onchange="VIEWS.ui.addc.sort=this.value;VIEWS.renderAddCoach()">
          ${[['price','الأغلى'],['total','الأعلى نقاطاً'],['rank','الأعلى في الجدول'],['owned','الأكثر تملكاً']].map(([k,l])=>`<option value="${k}" ${a.sort===k?'selected':''}>${l}</option>`).join('')}</select>
      </div>
      <div class="addp-table">
        <div class="addp-head">
          <span class="addp-name">المدرب</span>
          <span class="addp-c">النقاط</span><span class="addp-c">السعر</span><span class="addp-c">التملّك</span>
        </div>
        <div id="addpList">${rows}</div>
      </div>
    </div>`;
  },
  addcPick(id){
    const a=this.ui.addc; if(!a) return;
    const st=DB.state, c=COACHES.get(st,id); if(!c) return;
    const block=this.addcBlock(c,this.addcBank());
    if(block){ UI.toast(block,true); return; }
    if(a.ctx==='picker'){ this.ui.pickerCoach=id; UI.closeSheet(); this.closeAddCoach(); UI.toast(`أُضيف المدرب ${c.name}`); APP.render(); return; }
    const team=DB.myTeam();
    const cost = team.coach ? TEAM.coachChangeCost(team, st) : {free:true};
    const go=()=>{
      const err=TEAM.setCoach(team, id, st);
      if(err){ UI.toast(err,true); return; }
      UI.closeSheet(); UI.closeModal(); this.closeAddCoach();
      DB.save(); UI.toast(`${c.name} مدرب فريقك الآن`); APP.render();
    };
    if(!cost.free){
      UI.modal(`<h3>تغيير المدرب قبل نهاية العقد؟</h3>
        <p class="muted">${cost.usesFT? 'سيستهلك هذا التغيير انتقالاً مجانياً واحداً.' : `سيُخصم <b style="color:var(--red)">${cost.hits} نقاط</b> من رصيدك هذه الجولة.`}</p>
        <div class="row" style="gap:8px"><button class="btn" onclick="UI.closeModal();VIEWS._addcGo && VIEWS._addcGo()">تأكيد</button>
        <button class="btn sec" onclick="UI.closeModal()">تراجع</button></div>`);
      this._addcGo=go; return;
    }
    go();
  },
  pickerRemoveCoach(){ this.ui.pickerCoach=null; APP.render(); },

  /* ======================= صفحة ملف المدرب ======================= */
  openCoach(id){
    if(this.ui.addc) this.closeAddCoach();
    if(this.ui.addp && typeof this.closeAddPlayer==='function') this.closeAddPlayer();
    UI.closeSheet(); UI.closeModal();
    this.ui.coachOpen=id; APP.go('coach');
  },
  coachPage(){
    const st=DB.state; const c=COACHES.get(st, this.ui.coachOpen);
    if(!c) return '<div class="card">مدرب غير موجود</div>';
    const club=DB.club(c.club), team=DB.myTeam();
    const rec=STANDINGS.record(st, c.club)||{P:0,W:0,D:0,L:0,GF:0,GA:0,Pts:0,form:[]};
    const rank=COACH_UI.rankNow(c.club);
    const season=COACH.season(st, c.id);
    const total=season.reduce((s,x)=>s+x.total,0);
    const mine = team && team.coach===c.id;
    const ct = mine ? TEAM.coachContract(team, st) : null;
    const stat=(v,l,hi)=>`<div class="statbox ${hi?'hi':''}"><div class="v" style="font-size:1.15rem">${v}</div><div class="l">${l}</div></div>`;
    const hist=season.map(x=>({x:'ج'+x.gw, y:x.total}));
    const log = st.fixtures.filter(f=>f.status==='F' && (f.h===c.club||f.a===c.club)).sort((a,b)=>a.gw-b.gw).map(f=>{
      const home=f.h===c.club, opp=home? f.a : f.h, gf=home? f.hs:f.as, ga=home? f.as:f.hs;
      const k=gf>ga?'w':gf<ga?'l':'d';
      const cp = COACHES.active(st,f.gw) && DB.gw(f.gw) && DB.gw(f.gw).status==='finished' ? COACH.points(st,c.id,f.gw) : null;
      const m = cp && cp.matches.find(x=>x.fx.id===f.id);
      return `<tr onclick="${cp?`VIEWS.coachPointsSheet('${c.id}',${f.gw})`:''}" style="${cp?'cursor:pointer':''}">
        <td>ج${f.gw}</td><td>${UI.crest(opp)} ${DB.club(opp).short} ${UI.ha(home)}</td>
        <td dir="ltr" style="text-align:center">${gf}-${ga}</td><td><span class="cform ${k}">${k==='w'?'ف':k==='d'?'ت':'خ'}</span></td>
        <td class="num" style="color:var(--accent)">${m? m.total : '—'}</td></tr>`;
    }).join('');
    return `<button class="btn sm sec" onclick="APP.back()" style="margin-bottom:12px">→ رجوع</button>
    <div class="card pp-head" style="margin-bottom:14px;background:linear-gradient(135deg,${club.color} 0%,${club.dark} 100%)">
      <div class="row" style="gap:16px;flex-wrap:wrap">
        <img class="pp-cut pp-body" src="${esc(COACHES.photo(c,'b'))}" alt="" onerror="this.onerror=null;this.classList.remove('pp-body');this.src='${esc(COACHES.photo(c,false))}'">
        <div style="flex:1 1 0;min-width:0">
          <h2>${esc(c.name)} ${COACH_UI.flag(c,20)}</h2>
          <div class="row" style="gap:8px;margin-top:4px;flex-wrap:wrap">${UI.crest(c.club)} <b>${club.name}</b> <span class="pill">المدرب</span>
          <span class="pill blue">${fmtK(c.price)}</span>${mine? `<span class="pill gold">مدربك · عقد ج${ct.since}→ج${ct.since+ct.len}</span>`:''}${COACHES.gone(c, st.currentGW)? '<span class="pill red">غادر النادي</span>':''}</div>
        </div>
      </div>
      <div class="pp-actions">
        ${team&&team.squad.length&&!mine&&!COACHES.gone(c, st.currentGW)? `<button class="btn sec" onclick="VIEWS.openAddCoach({ctx:'team'})">${team.coach? 'اجعله مدربي':'تعاقد معه'}</button>`:''}
      </div>
    </div>
    <div class="grid g4 cprof" style="margin-bottom:14px">
      ${stat(total,'نقاط الفانتسي',true)}${stat(rank||'—','المركز في الدوري')}
      ${stat(rec.P,'مباريات')}${stat(rec.W+' / '+rec.D+' / '+rec.L,'فوز / تعادل / خسارة')}
      ${stat(rec.Pts,'نقاط الدوري')}${stat(rec.P? (rec.Pts/rec.P).toFixed(2):'0.00','نقطة لكل مباراة')}
      ${stat(rec.GF+' / '+rec.GA,'له / عليه')}${stat(MARKET.ownership(c.id)+'%','نسبة التملّك')}
    </div>
    <div class="card" style="margin-bottom:12px"><div class="row" style="gap:6px;align-items:center;flex-wrap:wrap"><b>آخر 5 مباريات:</b> ${COACH_UI.formPills(rec.form.slice(-5))||'<span class="muted">لا مباريات بعد</span>'}</div></div>
    <div class="grid g2">
      <div class="card"><h3>نقاط الفانتسي عبر الجولات</h3>${hist.length? UI.lineChart(hist,560,180) : `<div class="muted">تُحتسب نقاط المدرب من الجولة ${COACHES.rules(st).fromGW}</div>`}</div>
      <div class="card"><h3>المباريات القادمة</h3>
        ${FDR.next(c.club,6).map(x=>`<div class="fx"><div class="team">ج${x.gw}</div>
          <div class="team">${UI.crest(x.opp)} ${DB.club(x.opp).name} ${UI.ha(x.home)}</div>
          <span class="fdr l${x.lvl}">${x.label}</span></div>`).join('')||'<div class="muted">انتهى الموسم</div>'}
      </div>
      <div class="card" style="grid-column:1/-1"><h3>مباراة بمباراة</h3>
        <div class="scroll-x"><table class="tbl"><tr><th>جولة</th><th>المنافس</th><th>النتيجة</th><th></th><th>نقاط المدرب</th></tr>${log||'<tr><td colspan="5" class="muted">لا مباريات منتهية بعد</td></tr>'}</table></div>
        <div class="tiny" style="margin-top:6px">اضغط على مباراة محتسبة لعرض تفصيل نقاطها.</div></div>
    </div>`;
  },

  /* ======================= تفصيل نقاط المدرب في جولة ======================= */
  coachPointsSheet(id, gw){
    const st=DB.state, c=COACHES.get(st,id); if(!c) return;
    gw=+gw; const club=DB.club(c.club);
    const cp=COACH.points(st, id, gw);
    const side=cid=>`<span class="tm ${cid===c.club?'me':''}">${UI.crest(cid)}<b>${DB.club(cid).short}</b></span>`;
    let body='';
    if(!COACHES.active(st,gw)) body=`<div class="bd-card"><div class="muted">تُحتسب نقاط المدرب من الجولة ${COACHES.rules(st).fromGW}.</div></div>`;
    else if(cp.gone) body=`<div class="bd-card"><div class="muted">غادر المدرب النادي — لا نقاط من هذه الجولة.</div></div>`;
    else if(!cp.matches.length) body=`<div class="bd-card"><div class="muted">لا مباراة لناديه في هذه الجولة.</div></div>`;
    else body=cp.matches.map(m=>{
      const f=m.fx;
      const match=`<div class="bd-match">${side(f.h)}${m.pending? `<span class="sc tm">${UI.fmtDateShort(f.date)}</span>` : `<span class="sc"><i>${f.hs}</i><i>-</i><i>${f.as}</i></span>`}${side(f.a)}</div>`;
      if(m.pending) return match+`<div class="bd-card"><div class="muted">لم تُلعب المباراة بعد — النقاط تظهر بعد تسجيلها.</div></div>`;
      const rows=m.rows.map(x=>`<tr><td>${x.label}</td><td>${x.val||''}</td><td class="${x.pts<0?'neg':''}">${x.pts>0?'+':''}${x.pts}</td></tr>`).join('');
      return match+`<div class="bd-card">
        <div class="tiny" style="margin-bottom:6px;font-weight:700">الترتيب قبل الجولة: ${club.short} ${m.myRank} · ${DB.club(m.opp).short} ${m.oppRank}</div>
        <table class="bd-tbl"><tr><th>البند</th><th></th><th>النقاط</th></tr>${rows}<tr class="tot"><td>المجموع</td><td></td><td>${m.total}</td></tr></table></div>`;
    }).join('');
    UI.sheet(`
      <div class="ps-head ps-head-photo" style="background:linear-gradient(135deg,${club.color} 0%,${club.dark} 100%)">
        <div class="ps-kit"><img class="ps-photo ps-cut" src="${esc(COACHES.photo(c,false))}" alt="" onerror="this.style.display='none'"></div>
        <div style="flex:1"><div class="ps-pos">المدرب</div><div class="ps-name">${esc(c.name)}</div><div class="ps-club">${club.name}</div></div>
        ${UI.crest(c.club,'lg')}
      </div>
      <div class="bd-gw">الجولة ${gw}${cp.matches.length>1? ' · جولة مزدوجة — تُجمع المباراتان':''}</div>
      ${body}
      <div class="ps-actions"><button class="btn ghost" onclick="UI.closeSheet();VIEWS.openCoach('${id}')">الملف الكامل</button></div>`);
  },

  /* ======================= فقرة اللائحة في «عن اللعبة» ======================= */
  coachGuide(T, li, sec){
    const st=DB.state, R=COACHES.rules(st); if(!R.enabled) return '';
    const EN = typeof I18N!=='undefined' && I18N.isEn();
    const tiers = EN ? 'opponent 1–2 places higher: +' : 'المنافس أعلى بـ1–2 مركز: +';
    const items = EN ? [
      `<b>One coach per team</b>, outside the ${st.rules.squadSize} players, bought from the same ${fmtK(st.rules.budget)} budget. Fixed prices by club strength (${fmtM(5.0)}–${fmtM(7.5)}).`,
      `<b>Result:</b> win +${R.win}, draw +${R.draw}, loss ${R.loss}. <b>Clean sheet</b> +${R.cs}. <b>Win by two or more</b> +${R.margin}.`,
      `<b>Opponent difficulty</b> (league table before the gameweek): beating a team above you adds +${R.diffWin.join(' / +')} for a gap of 1–2 / 3–4 / 5–6 / 7–8 / 9+ places; a draw adds +${R.diffDraw.join(' / +')}.`,
      `<b>Losing to a team below you</b> costs ${R.lossPen.map(x=>'−'+x).join(' / ')} for a gap of 1–3 / 4–6 / 7+ places. Best possible match: 12 points, worst: −2.`,
      `<b>Contract of ${R.contract} gameweeks:</b> after it a free change opens. An early change follows the transfer rules (free while free changes are on, otherwise a free transfer or −${st.rules.transferCost}).`,
      `Wildcard and Free Hit include the coach; Bench Boost and Triple Captain do not touch him. No coach = 0 points, never a deduction. If a club changes its coach, your slot moves to the new coach automatically and you get a free change.`,
      `Coach points count from Gameweek ${R.fromGW}. A postponed match counts in the gameweek it is played; a double gameweek adds both matches.`,
    ] : [
      `<b>مدرب واحد لكل فريق</b>، خارج الـ${st.rules.squadSize} لاعباً، يُشترى من نفس الميزانية (${fmtK(st.rules.budget)}). الأسعار ثابتة حسب قوة النادي (${fmtM(5.0)}–${fmtM(7.5)}).`,
      `<b>النتيجة:</b> فوز +${R.win}، تعادل +${R.draw}، خسارة ${R.loss}. <b>شباك نظيفة</b> +${R.cs}. <b>فوز بفارق هدفين أو أكثر</b> +${R.margin}.`,
      `<b>صعوبة المنافس</b> (جدول الدوري قبل الجولة): الفوز على فريق أعلى منك يضيف +${R.diffWin.join(' / +')} لفارق 1–2 / 3–4 / 5–6 / 7–8 / 9+ مراكز، والتعادل يضيف +${R.diffDraw.join(' / +')}.`,
      `<b>الخسارة أمام فريق أقل منك</b> تخصم ${R.lossPen.map(x=>'−'+x).join(' / ')} لفارق 1–3 / 4–6 / 7+ مراكز. أعلى حصيلة في مباراة 12 نقطة، وأدنى −2.`,
      `<b>عقد من ${R.contract} جولتين:</b> بعدهما يفتح تغيير مجاني. التغيير المبكر يتبع قاعدة انتقالات اللاعبين (حر مع التغييرات الحرة، وإلا انتقال مجاني أو −${st.rules.transferCost}).`,
      `Wildcard و Free Hit يشملان المدرب؛ Bench Boost و Triple Captain لا يمسّانه. بلا مدرب = صفر نقاط ولا خصم. إذا غيّر النادي مدربه تنتقل خانتك للمدرب الجديد تلقائياً ولك تغيير مجاني.`,
      `تُحتسب نقاط المدرب من الجولة ${R.fromGW}. المباراة المؤجلة تُحتسب في الجولة التي تُلعب فيها، والجولة المزدوجة تجمع المباراتين.`,
    ];
    return sec(T('المدرب','The coach'), li(items));
  },
});

/* ======================= لوحة الإدارة: المدربون ======================= */
/* admin.js يُحمَّل بعد هذا الملف، فيُسجَّل القسم بعد اكتمال التحميل */
const COACH_ADMIN = {
  sec_coaches(){
    const st=DB.state, R=COACHES.rules(st);
    const num=(k,label,val,step)=>`<div class="field"><label>${label}</label>
      <input type="number" step="${step||1}" value="${val}" onchange="DB.state.rules.coach['${k}']=+this.value;DB.save();UI.toast('حُفظ')"></div>`;
    const arr=(k,label)=>`<div class="field"><label>${label}</label>
      <input value="${(R[k]||[]).join(',')}" style="direction:ltr" onchange="DB.state.rules.coach['${k}']=this.value.split(',').map(x=>+x.trim()||0);DB.save();UI.toast('حُفظ')"></div>`;
    const up = typeof CLOUD!=='undefined' && CLOUD.ready && CLOUD.admin;
    const local = Object.values(st.teams||{}).filter(t=>(t.squad||[]).length && (+t.bankVer||0)<COACH_UPGRADE.BANK_VER).length;
    return `<div class="card"><h3>المدربون</h3>
      <div class="tiny" style="margin-bottom:10px">الاسم والصورة من الموقع. السعر ثابت حسب قوة النادي — عدّله هنا ثم «نشر حالة اللعبة». عند تغيير مدرب النادي: اكتب الاسم الجديد وحدّد جولة التغيير، فتنتقل خانة كل مشترك للمدرب الجديد تلقائياً ويحصل على تغيير مجاني.</div>
      <div class="scroll-x"><table class="tbl"><tr><th>النادي</th><th>المدرب</th><th>الجنسية</th><th>السعر</th><th>الحالة</th><th>تغيّر في ج</th><th>ملف الصورة</th></tr>
      ${COACHES.all(st).map(c=>`<tr>
        <td>${UI.crest(c.club,'lg')}</td>
        <td><input value="${esc(c.name)}" style="width:140px;padding:5px" onchange="COACHES.get(DB.state,'${c.id}').name=this.value;DB.save()"></td>
        <td><input value="${esc(c.nat||'')}" style="width:90px;padding:5px" onchange="COACHES.get(DB.state,'${c.id}').nat=this.value;DB.save()"></td>
        <td><input type="number" step="0.5" value="${c.price}" style="width:70px;padding:5px" onchange="COACHES.get(DB.state,'${c.id}').price=+this.value;DB.save()"></td>
        <td><select style="width:auto;padding:4px" onchange="COACHES.get(DB.state,'${c.id}').status=this.value;DB.save();APP.render()">
          <option value="a" ${c.status!=='x'?'selected':''}>مستمر</option><option value="x" ${c.status==='x'?'selected':''}>غادر (لا نقاط)</option></select></td>
        <td><input type="number" min="0" value="${c.replacedGW||''}" placeholder="—" style="width:60px;padding:5px" title="جولة تغيير المدرب: من يملكه يحصل على تغيير مجاني" onchange="COACHES.get(DB.state,'${c.id}').replacedGW=+this.value||0;DB.save()"></td>
        <td><input value="${esc(c.slug||'')}" style="width:110px;padding:5px;direction:ltr" onchange="COACHES.get(DB.state,'${c.id}').slug=this.value.trim();DB.save()"></td>
      </tr>`).join('')}</table></div>
    </div>
    <div class="card" style="margin-top:12px"><h3>قواعد نقاط المدرب</h3>
      <div class="grid g3">
        ${num('fromGW','تبدأ من الجولة',R.fromGW)}${num('contract','مدة العقد (جولات)',R.contract)}
        ${num('win','الفوز',R.win)}${num('draw','التعادل',R.draw)}${num('cs','شباك نظيفة',R.cs)}${num('margin','فوز بفارق هدفين+',R.margin)}
        ${arr('diffWin','مكافأة الفوز حسب الفارق (1-2,3-4,5-6,7-8,9+)')}${arr('diffDraw','مكافأة التعادل حسب الفارق')}${arr('lossPen','عقوبة الخسارة (1-3,4-6,7+)')}
      </div>
      <label class="pill" style="cursor:pointer;margin-top:8px;display:inline-block"><input type="checkbox" ${R.enabled?'checked':''} style="width:auto" onchange="DB.state.rules.coach.enabled=this.checked;DB.save();APP.render()"> خانة المدرب مفعّلة</label>
    </div>
    <div class="card" style="margin-top:12px"><h3>ترقية الميزانية إلى ${fmtK(st.rules.budget)}</h3>
      <div class="tiny" style="margin-bottom:10px">تضيف الفرق (${fmtM(Math.round(((+st.rules.budget||100)-100)*10)/10)}) لرصيد كل فريق مكوَّن مرة واحدة فقط، على الخادم ولهذا الجهاز. بدونها تظهر الفرق القديمة بلا رصيد للمدرب.</div>
      <div class="row" style="gap:8px;flex-wrap:wrap">
        <button class="btn" ${up?'':'disabled'} onclick="ADMIN.coachUpgrade()">ترقية كل المشتركين (+${fmtM(Math.round(((+st.rules.budget||100)-100)*10)/10)})</button>
        ${local? `<span class="pill">${local} فريقاً على هذا الجهاز بانتظار الترقية</span>`:''}
      </div>
    </div>`;
  },
  async coachUpgrade(){
    const st=DB.state;
    if(!confirm(`إضافة ${fmtM(Math.round(((+st.rules.budget||100)-100)*10)/10)} لرصيد كل فريق مكوَّن (مرة واحدة)؟`)) return;
    UI.toast('جارٍ الترقية…');
    const r=await CLOUD.bumpBudget(st);
    if(!r.ok){ UI.toast(r.err,true); return; }
    DB.save();
    const pub=await CLOUD.publishGame(st);
    UI.toast(pub.ok? `رُقّي ${r.bumped} فريقاً من ${r.total} ونُشرت القواعد` : `رُقّي ${r.bumped} فريقاً لكن تعذّر النشر: ${pub.err}`, !pub.ok);
    APP.render();
  },
};
(function(){
  const reg=()=>{ if(typeof ADMIN!=='undefined') Object.assign(ADMIN, COACH_ADMIN); };
  if(typeof ADMIN!=='undefined') reg(); else document.addEventListener('DOMContentLoaded', reg);
})();

/* ======================= الترجمة الإنجليزية (تُدمج في i18n-more.js) ======================= */
const COACH_I18N = {
  NAMES: COACH_NAMES_EN,
  DICT: {
    'المدرب':'Coach', 'اختر مدرباً':'Choose a coach', 'اختر مدرباً لفريقك':'Choose a coach for your team', 'اختيار المدرب':'Choose a coach',
    'تغيير المدرب':'Change coach', 'مدربك الحالي':'Your current coach', 'غادر النادي':'Left the club', 'الرصيد لا يكفي لهذا المدرب':'Not enough funds for this coach',
    'مدرب غير موجود':'Coach not found', 'هذا المدرب غادر النادي':'This coach has left the club', 'الأعلى في الجدول':'Highest in the table',
    'نقاط الفانتسي':'Fantasy points', 'فوز-تعادل-خسارة':'W-D-L', 'فوز / تعادل / خسارة':'Won / Drawn / Lost', 'المركز':'Position', 'المركز في الدوري':'League position',
    'نقاط الدوري':'League points', 'نقطة لكل مباراة':'Points per match', 'له / عليه':'For / against', 'آخر 5:':'Last 5:', 'آخر 5 مباريات:':'Last 5 matches:',
    'مباراة بمباراة':'Match by match', 'نقاط المدرب':'Coach points', 'المنافس':'Opponent', 'النتيجة':'Result', 'لا مباريات منتهية بعد':'No finished matches yet',
    'اضغط على مباراة محتسبة لعرض تفصيل نقاطها.':'Tap a scored match to see its points breakdown.',
    'الفوز':'Win', 'التعادل':'Draw', 'الخسارة':'Loss', 'صعوبة المنافس':'Opponent difficulty', 'شباك نظيفة':'Clean sheet',
    'الفوز بفارق هدفين أو أكثر':'Win by two or more', 'الخسارة أمام فريق أقل ترتيباً':'Loss to a lower-placed team',
    'غادر المدرب النادي — لا نقاط من هذه الجولة.':'The coach left the club — no points from this gameweek.',
    'لا مباراة لناديه في هذه الجولة.':'His club has no match in this gameweek.',
    'لم تُلعب المباراة بعد — النقاط تظهر بعد تسجيلها.':'The match has not been played yet — points appear once it is recorded.',
    'لا مباريات بعد':'No matches yet', 'المدرب غير موجود':'Coach not found', 'تعاقد معه':'Sign him', 'اجعله مدربي':'Make him my coach', 'مدربي':'My coach',
    'تغيير المدرب قبل نهاية العقد؟':'Change the coach before the contract ends?',
    'سيستهلك هذا التغيير انتقالاً مجانياً واحداً.':'This change will use one free transfer.',
    'أُغلقت الجولة — تغيير المدرب بعد الاحتساب':'Gameweek locked — change the coach after scoring',
    'يستهلك انتقالاً مجانياً':'uses a free transfer', 'التغيير المبكر':'Early change',
    'ف':'W', 'ت':'D', 'خ':'L', 'بلا مباراة':'No match', 'لم تُلعب':'Not played', 'عقد':'Contract', 'مباريات':'Matches',
    'سوريا':'Syria', 'كرواتيا':'Croatia', 'البحرين':'Bahrain', 'سلوفاكيا':'Slovakia', 'البرتغال':'Portugal', 'البرازيل':'Brazil', 'البوسنة':'Bosnia',
    'فريقك بلا مدرب':'Your team has no coach', 'اختر مدرباً من الشريط تحت الملعب — نقاطه من نتائج ناديه وصعوبة المنافس. بلا مدرب لا تُخصم نقاط، لكن تخسر نقاطه.':'Pick a coach from the bar under the pitch — his points come from his club\'s results and the opponent\'s difficulty. Without a coach nothing is deducted, but you miss his points.',
    'الأغلى':'Most expensive', 'الأعلى نقاطاً':'Most points', 'الأكثر تملكاً':'Most owned',
  },
  RX: [
    [/^(.+?) · المدرب$/, (m, c) => I18N.trIn(c) + ' · Coach'],
    [/^عقد (\d+)\/(\d+)$/, 'Contract $1/$2'],
    [/^عقد ج(\d+)→ج(\d+)$/, 'Contract GW$1→GW$2'],
    [/^العقد: من الجولة (\d+) إلى الجولة (\d+)$/, 'Contract: from gameweek $1 to gameweek $2'],
    [/^العقد انتهى — التغيير مجاني$/, 'Contract over — change is free'],
    [/^مدربك · عقد ج(\d+)→ج(\d+)$/, 'Your coach · contract GW$1→GW$2'],
    [/^العقد: من الجولة (\d+) إلى الجولة (\d+)(.*)$/, (m, a, b, r) => 'Contract: from gameweek ' + a + ' to gameweek ' + b + I18N.trIn(r)],
    [/^مدربك · عقد (\d+)\/(\d+)$/, 'Your coach · contract $1/$2'],
    [/^العقد: الجولة (\d+) من (\d+)(.*)$/, (m, a, b, r) => 'Contract: gameweek ' + a + ' of ' + b + I18N.trIn(r)],
    [/^ ?— التغيير مجاني الآن$/, ' — change is free now'],
    [/^ ?— تغييرات حرة حتى الإغلاق$/, ' — free changes until the deadline'],
    [/^ ?— التغيير المبكر يستهلك انتقالاً أو −(\d+)$/, ' — an early change uses a transfer or −$1'],
    [/^أُضيف المدرب (.+)$/, (m, n) => 'Coach ' + I18N.trIn(n) + ' added'],
    [/^(.+) مدرب فريقك الآن$/, (m, n) => I18N.trIn(n) + ' is now your coach'],
    [/^الترتيب قبل الجولة: (.+?) (\d+) · (.+?) (\d+)$/, (m, a, ra, b, rb) => 'Table before the gameweek: ' + I18N.trIn(a) + ' ' + ra + ' · ' + I18N.trIn(b) + ' ' + rb],
    [/^أعلى بـ(\d+)$/, '$1 above'], [/^أقل بـ(\d+)$/, '$1 below'],
    [/^الجولة (\d+) · جولة مزدوجة — تُجمع المباراتان$/, 'Gameweek $1 · double gameweek — both matches count'],
    [/^تُحتسب نقاط المدرب من الجولة (\d+)\.?$/, 'Coach points count from Gameweek $1.'],
    [/^مدرب واحد لفريقك، خارج الـ15\. نقاطه من نتيجة ناديه وصعوبة المنافس حسب جدول الدوري — عقد من (\d+) جولتين\.$/, 'One coach for your team, outside the 15. His points come from his club\'s result and the opponent\'s difficulty by league position — a $1-gameweek contract.'],
    [/^بالبنك (.+?) · (.+)$/, (m, a, b) => 'In the bank ' + I18N.trIn(a) + ' · ' + I18N.trIn(b)],
    [/^التغيير المبكر (.+)$/, (m, a) => 'Early change ' + I18N.trIn(a)],
    [/^−(\d+) نقاط$/, '−$1 points'],
    [/^المركز (\d+|—)$/, 'Position $1'],
    [/^سيُخصم (\d+) نقاط من رصيدك هذه الجولة\.$/, '$1 points will be deducted this gameweek.'],
  ],
};
