/* تكوين الفريق والانتقالات — على طراز تطبيق FPL:
   ملعب بخانات فاضية → اضغط الخانة → شاشة «إضافة لاعب» → اختر.
   اضغط لاعب موجود → بطاقة سفلية فيها «إزالة» و«اختيار بديل». */
'use strict';

Object.assign(ICONS, {
  info:'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 7v5m0-8.2v.2',
  search:'M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm4.8 11.3L20 20',
  back:'M4.5 12h15m0 0-6-6m6 6-6 6',
  sort:'M12 4v16m0-16-3 3m3-3 3 3m-3 13-3-3m3 3 3-3',
  plus:'M12 5v14M5 12h14',
});

Object.assign(VIEWS, {

  /* ======================= تكوين الفريق لأول مرة ======================= */
  squadPicker(){
    const st=DB.state, R=st.rules;
    const sq=this.ui.pickerSquad;
    const v=TEAM.validateSquad(sq);
    const cost=sq.reduce((s,pid)=>s+DB.player(pid).price,0);
    const byPos=pos=>sq.map(pid=>DB.player(pid)).filter(p=>p.pos===pos);
    const POS_ONE={G:'حارس',D:'مدافع',M:'وسط',F:'مهاجم'};
    const slotRow=pos=>{
      const have=byPos(pos), need=R.posCount[pos];
      let cells='';
      for(let i=0;i<need;i++){
        const p=have[i];
        cells+= p? `<div class="pslot" onclick="VIEWS.playerSheet('${p.id}','picker')">
            <div class="club-tag">${DB.club(p.club).short}</div>
            ${UI.pitchKit(p, 50)}
            <div class="nm">${esc(p.name.split(' ').slice(-1)[0])}</div>
            <div class="pt">${fmtM(p.price)}</div></div>`
          : `<div class="pslot empty" onclick="VIEWS.openAddPlayer({ctx:'picker',pos:'${pos}'})">
              <div class="empty-shirt">${UI.icon('plus',20)}</div>
              <div class="nm">${POS_ONE[pos]}</div><div class="pt">إضافة</div></div>`;
      }
      return `<div class="pitch-row">${cells}</div>`;
    };
    return `<div class="pickteam picker-wrap">
      <div class="squad-hero">
        <div class="sh-info">
          <div class="sh-name">كوّن فريقك</div>
          <div class="sh-sub">${R.posCount.G} حراس · ${R.posCount.D} مدافعين · ${R.posCount.M} وسط · ${R.posCount.F} مهاجمين · حد أقصى ${R.maxPerClub} من كل نادٍ</div>
        </div>
        <div class="sh-stats">
          <div><b style="${cost>R.budget?'color:#ffb4b0':''}">${fmtM(R.budget-cost)}</b><span>بالبنك</span></div>
          <div><b>${sq.length}/${R.squadSize}</b><span>اللاعبون</span></div>
        </div>
      </div>
      <div class="row" style="gap:8px;margin-bottom:8px;justify-content:center">
        <button class="btn sec sm" onclick="VIEWS.autoPick()">تعبئة تلقائية</button>
        ${sq.length? `<button class="btn ghost sm" onclick="VIEWS.ui.pickerSquad=[];APP.render()">إفراغ الكل</button>`:''}
      </div>
      <div class="zain-frame"><div class="pitch picker-pitch">
        <div class="pitch-brand"><img src="assets/logo-light.png" alt=""><img src="assets/logo-light.png" alt=""><img src="assets/logo-light.png" alt=""></div>
        <div class="pf-goal"></div><div class="pf-box6"></div><div class="pf-box"></div><div class="pf-circle"></div>
        ${['G','D','M','F'].map(slotRow).join('')}
      </div></div>
      ${v.ok? `<button class="btn" style="width:100%;margin-top:12px;font-size:1.05rem;border-radius:26px;padding:14px" onclick="VIEWS.confirmSquad()">اعتماد الفريق</button>`
        : `<div class="card picker-errs" style="margin-top:12px">${v.errs.map(e=>`<div class="tiny">• ${e}</div>`).join('')}</div>`}
    </div>`;
  },
  pickerAdd(pid, outPid){
    const R=DB.state.rules; const p=DB.player(pid);
    let sq=this.ui.pickerSquad;
    if(sq.includes(pid)) return false;
    const trial= outPid? sq.filter(x=>x!==outPid) : [...sq];
    if(trial.filter(x=>DB.player(x).pos===p.pos).length>=R.posCount[p.pos]){ UI.toast(`اكتمل عدد ${POS_AR[p.pos]}`,true); return false; }
    if(trial.filter(x=>DB.player(x).club===p.club).length>=R.maxPerClub){ UI.toast(`الحد الأقصى ${R.maxPerClub} من ${DB.club(p.club).name}`,true); return false; }
    const cost=trial.reduce((s,x)=>s+DB.player(x).price,0)+p.price;
    if(cost>R.budget+1e-9){ UI.toast('الميزانية لا تكفي',true); return false; }
    if(outPid){ const i=sq.indexOf(outPid); if(i>=0) sq[i]=pid; else sq.push(pid); }
    else sq.push(pid);
    return true;
  },
  pickerRemove(pid){ this.ui.pickerSquad=this.ui.pickerSquad.filter(x=>x!==pid); UI.closeSheet(); APP.render(); },

  /* ======================= الانتقالات ======================= */
  transfers(){
    const st=DB.state, team=DB.myTeam();
    if(!team.squad.length) return this.squadPicker();
    const locked=GWADMIN.deadlinePassed(st.currentGW);
    const chip=team.activeChip;
    const freeMode= chip==='wildcard'||chip==='freehit';
    const tOut=this.ui.tOut, tIn=this.ui.tIn;
    const nPairs=tOut.filter((o,i)=>tIn[i]).length;
    const allPaired=tOut.length>0 && tOut.every((o,i)=>tIn[i]);
    const hits= freeMode? 0 : Math.max(0, nPairs-team.ft)*st.rules.transferCost;
    const bankAfter=this.tBank();
    const POS_ONE={G:'حارس',D:'مدافع',M:'وسط',F:'مهاجم'};

    const card=(pid)=>{
      const oi=tOut.indexOf(pid);
      if(oi>=0 && tIn[oi]){ // صفقة جديدة
        const p=DB.player(tIn[oi]);
        return `<div class="pslot tin" onclick="VIEWS.playerSheet('${p.id}','tin')">
          <div class="club-tag">${DB.club(p.club).short}</div>
          ${UI.pitchKit(p,50)}
          <div class="nm">${esc(p.name.split(' ').slice(-1)[0])}</div>
          <div class="pt">صفقة جديدة</div></div>`;
      }
      const p=DB.player(pid);
      if(oi>=0){ // خانة فاضية بانتظار بديل
        return `<div class="pslot empty out" onclick="VIEWS.openAddPlayer({ctx:'transfer',outPid:'${pid}'})">
          <div class="empty-shirt">${UI.icon('plus',20)}</div>
          <div class="nm" style="text-decoration:line-through;opacity:.75">${esc(p.name.split(' ').slice(-1)[0])}</div>
          <div class="pt">اختر ${POS_ONE[p.pos]}</div></div>`;
      }
      const next=FDR.next(p.club,1)[0];
      return `<div class="pslot" onclick="VIEWS.playerSheet('${pid}','transfer')">
        <div class="club-tag">${DB.club(p.club).short}</div>
        ${UI.pitchKit(p,50)}
        <div class="nm">${esc(p.name.split(' ').slice(-1)[0])}</div>
        <div class="pt">${next? `${DB.club(next.opp).short} ${UI.icon(next.home?'home':'plane',11)}` : fmtM(p.price)}</div></div>`;
    };
    const board=['G','D','M','F'].map(pos=>
      `<div class="pitch-row">${team.squad.filter(pid=>DB.player(pid).pos===pos).map(card).join('')}</div>`).join('');

    return `
    <div class="row" style="margin-bottom:10px;flex-wrap:wrap;gap:8px;justify-content:center">
      ${['wildcard','freehit'].map(k=>{
        const c=st.rules.chips[k]; if(!c.enabled) return '';
        const used=team.usedChips[k]||0; const active=chip===k;
        return `<button class="btn sm ${active?'':'sec'}" ${locked||(used>=c.uses&&!active)||(chip&&!active)?'disabled':''}
          onclick="VIEWS.toggleChip('${k}')">${c.label}</button>`;}).join('')}
      <span class="pill ${freeMode?'green':'blue'}">${freeMode? 'انتقالات حرة — كرت مفعّل' : `مجاني: ${team.ft} · الإضافي −${st.rules.transferCost}`}</span>
    </div>
    ${locked? '<div class="card" style="border-color:var(--red);margin-bottom:12px">أُغلقت الجولة — الانتقالات تفتح بعد احتساب النتائج.</div>':''}
    <div class="tf-wrap">
      <div class="tf-stats">
        <div><b>${team.ft}</b><span>مجاني</span></div>
        <div><b style="color:${hits?'var(--red)':'var(--text)'}">${freeMode?'حر':(hits?'−'+hits:'0')}</b><span>الخصم</span></div>
        <div><b style="color:${bankAfter<0?'var(--red)':'var(--text)'}">${fmtM(bankAfter)}</b><span>بالبنك</span></div>
      </div>
      <div class="zain-frame"><div class="pitch tf-board">${board}</div></div>
      <div class="tiny" style="text-align:center;margin-top:8px;color:var(--text3)">اضغط أي لاعب لعرض خياراته: إزالة أو اختيار بديل.</div>
    </div>
    ${tOut.length? `<div class="tf-bar"><div class="tf-bar-in">
      <div><b>${nPairs}/${tOut.length}</b><span>صفقات</span></div>
      <div><b style="color:${bankAfter<0?'var(--red)':'var(--text)'}">${fmtM(bankAfter)}</b><span>بالبنك</span></div>
      <div><b style="color:${hits?'var(--red)':'var(--text)'}">${freeMode?'حر':(hits?'−'+hits:'0')}</b><span>الخصم</span></div>
      <button class="btn" ${!allPaired||bankAfter<0||locked?'disabled':''} onclick="VIEWS.tConfirm()">تنفيذ</button>
      <button class="btn sec sm" onclick="VIEWS.tReset()">إلغاء</button>
    </div></div>`:''}`;
  },
  /* الرصيد بعد الصفقات الحالية (اللاعب الخارج بلا بديل يُحتسب سعره كرصيد) */
  tBank(excludeIdx){
    const team=DB.myTeam();
    let b=team.bank;
    this.ui.tOut.forEach((o,i)=>{ b+=DB.player(o).price; if(this.ui.tIn[i] && i!==excludeIdx) b-=DB.player(this.ui.tIn[i]).price; });
    return Math.round(b*10)/10;
  },
  tRemove(pid){ // إزالة لاعب من الفريق (تبقى الخانة فاضية لحين اختيار بديل)
    if(!this.ui.tOut.includes(pid)) this.ui.tOut.push(pid);
    UI.closeSheet(); APP.render();
  },
  tRestore(pid){ // التراجع عن إخراج لاعب
    const i=this.ui.tOut.indexOf(pid);
    if(i>=0){ this.ui.tOut.splice(i,1); this.ui.tIn.splice(i,1); }
    UI.closeSheet(); APP.render();
  },
  tReset(){ this.ui.tOut=[]; this.ui.tIn=[]; APP.render(); },
  tPickIn(pid, outPid){
    const team=DB.myTeam(); const p=DB.player(pid);
    if(!this.ui.tOut.includes(outPid)) this.ui.tOut.push(outPid);
    const idx=this.ui.tOut.indexOf(outPid);
    if(DB.player(outPid).pos!==p.pos){ UI.toast('البديل يجب أن يكون بنفس المركز',true); return false; }
    const newSquad=team.squad.filter(x=>!this.ui.tOut.includes(x)).concat(this.ui.tIn.filter((x,i)=>x&&i!==idx)).concat([pid]);
    if(newSquad.includes(pid) && newSquad.filter(x=>x===pid).length>1){ UI.toast('اللاعب موجود في فريقك',true); return false; }
    if(newSquad.filter(x=>DB.player(x).club===p.club).length>DB.state.rules.maxPerClub){
      UI.toast(`الحد الأقصى ${DB.state.rules.maxPerClub} لاعبين من ${DB.club(p.club).name}`,true); return false; }
    if(this.tBank(idx)-p.price< -1e-9){ UI.toast('الرصيد لا يكفي',true); return false; }
    this.ui.tIn[idx]=pid; return true;
  },

  /* ======================= شاشة «إضافة لاعب» ======================= */
  openAddPlayer(o){
    const outP=o.outPid? DB.player(o.outPid):null;
    this.ui.addp={ ctx:o.ctx, outPid:o.outPid||null, pos: outP? outP.pos : (o.pos||''), posLocked: !!outP,
      search:'', club:'', sort:'total', dir:-1 };
    document.body.classList.add('addp-open');
    let back=document.getElementById('addpBack');
    if(!back){ back=document.createElement('div'); back.id='addpBack'; document.body.appendChild(back); }
    this.renderAddPlayer();
  },
  closeAddPlayer(){
    const b=document.getElementById('addpBack'); if(b) b.remove();
    document.body.classList.remove('addp-open');
    this.ui.addp=null;
  },
  /* الرصيد المتاح لهذه الخانة */
  addpBank(){
    const a=this.ui.addp; const R=DB.state.rules;
    if(a.ctx==='picker'){
      const sq=this.ui.pickerSquad.filter(x=>x!==a.outPid);
      return Math.round((R.budget-sq.reduce((s,x)=>s+DB.player(x).price,0))*10)/10;
    }
    const idx=this.ui.tOut.indexOf(a.outPid);
    if(idx<0) return Math.round((this.tBank()+DB.player(a.outPid).price)*10)/10;
    return this.tBank(idx);
  },
  /* سبب عدم إمكانية اختيار لاعب (أو null) */
  addpBlock(p, bank){
    const a=this.ui.addp; const R=DB.state.rules; const team=DB.myTeam();
    let squad;
    if(a.ctx==='picker') squad=this.ui.pickerSquad.filter(x=>x!==a.outPid);
    else { const idx=this.ui.tOut.indexOf(a.outPid);
      squad=team.squad.filter(x=>!this.ui.tOut.includes(x) && x!==a.outPid).concat(this.ui.tIn.filter((x,i)=>x&&i!==idx)); }
    if(squad.includes(p.id) || (a.ctx==='transfer' && p.id===a.outPid)) return 'في فريقك';
    if(a.ctx==='transfer' && p.pos!==DB.player(a.outPid).pos) return 'مركز مختلف';
    if(a.ctx==='picker' && squad.filter(x=>DB.player(x).pos===p.pos).length>=R.posCount[p.pos]) return `اكتمل ${POS_AR[p.pos]}`;
    if(squad.filter(x=>DB.player(x).club===p.club).length>=R.maxPerClub) return `${R.maxPerClub} من ${DB.club(p.club).short}`;
    if(p.price>bank+1e-9) return 'الرصيد لا يكفي';
    return null;
  },
  addpSort(key){
    const a=this.ui.addp;
    if(a.sort===key) a.dir=-a.dir; else { a.sort=key; a.dir= key==='name'? 1 : -1; }
    this.renderAddPlayer();
  },
  addpSet(k,v){ this.ui.addp[k]=v; this.renderAddPlayer(); },
  addpSearch(v){ this.ui.addp.search=v.trim(); const l=document.getElementById('addpList'); if(l) l.innerHTML=this.addpListHTML(); },
  addpListHTML(){
    const a=this.ui.addp; const st=DB.state;
    const bank=this.addpBank();
    let list=st.players.filter(p=>p.status!=='u');
    if(a.pos) list=list.filter(p=>p.pos===a.pos);
    if(a.club) list=list.filter(p=>p.club===a.club);
    if(a.search) list=list.filter(p=>p.name.includes(a.search));
    const val={ name:p=>p.name, form:p=>DB.playerForm(p.id), price:p=>p.price, owned:p=>MARKET.ownership(p.id), total:p=>DB.playerTotal(p.id) }[a.sort];
    list.sort((x,y)=>{ const vx=val(x), vy=val(y); if(typeof vx==='string') return vx.localeCompare(vy,'ar')*a.dir; return (vx-vy)*a.dir || y.price-x.price; });
    if(!list.length) return '<div class="muted" style="padding:24px;text-align:center">لا نتائج</div>';
    return list.slice(0,150).map(p=>{
      const block=this.addpBlock(p,bank);
      return `<div class="addp-row ${block?'dim':''}" onclick="VIEWS.addpPick('${p.id}')" ${block?`data-why="${esc(block)}"`:''}>
        <button class="addp-i" onclick="event.stopPropagation();VIEWS.playerSheet('${p.id}','addp')">${p.status!=='a'? '<span class="addp-warn">!</span>' : UI.icon('info',18)}</button>
        ${UI.playerAvatar(p,36)}
        <div class="addp-name"><b>${esc(p.name)}</b><span>${DB.club(p.club).short} · ${POS_AR[p.pos]}${block?` · <i>${block}</i>`:''}</span></div>
        <div class="addp-c">${DB.playerForm(p.id).toFixed(1)}</div>
        <div class="addp-c">${fmtM(p.price)}</div>
        <div class="addp-c">${MARKET.ownership(p.id)}%</div>
      </div>`;
    }).join('');
  },
  renderAddPlayer(){
    const a=this.ui.addp; if(!a) return;
    const st=DB.state; const back=document.getElementById('addpBack'); if(!back) return;
    const bank=this.addpBank();
    const outP=a.outPid? DB.player(a.outPid):null;
    const arrow=k=> a.sort===k? UI.icon('sort',13) : '';
    back.innerHTML=`<div class="addp">
      <div class="addp-top">
        <button class="iconbtn" onclick="VIEWS.closeAddPlayer()">${UI.icon('back',20)}</button>
        <h3>إضافة لاعب</h3><span style="width:36px"></span>
      </div>
      <div class="addp-bank">بالبنك ${fmtM(bank)}</div>
      <div class="addp-search">${UI.icon('search',20)}<input id="addpSearch" placeholder="بحث بالاسم" value="${esc(a.search)}" oninput="VIEWS.addpSearch(this.value)"></div>
      <div class="addp-filters">
        <select ${a.posLocked?'disabled':''} onchange="VIEWS.addpSet('pos',this.value)">
          <option value="">كل المراكز</option>${['G','D','M','F'].map(p=>`<option value="${p}" ${a.pos===p?'selected':''}>${POS_AR[p]}</option>`).join('')}</select>
        <select onchange="VIEWS.addpSet('club',this.value)">
          <option value="">كل الأندية</option>${st.clubs.map(c=>`<option value="${c.id}" ${a.club===c.id?'selected':''}>${c.name}</option>`).join('')}</select>
        <select onchange="VIEWS.ui.addp.sort=this.value;VIEWS.ui.addp.dir=-1;VIEWS.renderAddPlayer()">
          ${[['total','الأعلى نقاطاً'],['price','الأغلى'],['form','الأفضل فورمة'],['owned','الأكثر تملكاً']].map(([k,l])=>`<option value="${k}" ${a.sort===k?'selected':''}>${l}</option>`).join('')}</select>
      </div>
      ${outP? `<div class="addp-lbl">اللاعب الخارج</div>
        <div class="addp-table addp-out"><div class="addp-row" onclick="VIEWS.playerSheet('${outP.id}','addp-out')">
          <button class="addp-i">${UI.icon('info',18)}</button>
          ${UI.playerAvatar(outP,36)}
          <div class="addp-name"><b>${esc(outP.name)}</b><span>${DB.club(outP.club).short} · ${POS_AR[outP.pos]}</span></div>
          <div class="addp-c"><small>الفورمة</small>${DB.playerForm(outP.id).toFixed(1)}</div>
          <div class="addp-c"><small>السعر</small>${fmtM(outP.price)}</div>
          <div class="addp-c"><small>التملّك</small>${MARKET.ownership(outP.id)}%</div>
        </div></div>`:''}
      <div class="addp-table">
        <div class="addp-head">
          <span class="addp-name" onclick="VIEWS.addpSort('name')">اللاعب ${arrow('name')}</span>
          <span class="addp-c" onclick="VIEWS.addpSort('form')">الفورمة ${arrow('form')}</span>
          <span class="addp-c" onclick="VIEWS.addpSort('price')">السعر ${arrow('price')}</span>
          <span class="addp-c" onclick="VIEWS.addpSort('owned')">التملّك ${arrow('owned')}</span>
        </div>
        <div id="addpList">${this.addpListHTML()}</div>
      </div>
    </div>`;
  },
  addpPick(pid){
    const a=this.ui.addp; if(!a) return;
    const p=DB.player(pid);
    const block=this.addpBlock(p,this.addpBank());
    if(block){ UI.toast(block,true); return; }
    let ok;
    if(a.ctx==='picker') ok=this.pickerAdd(pid, a.outPid);
    else ok=this.tPickIn(pid, a.outPid);
    if(!ok) return;
    UI.closeSheet(); this.closeAddPlayer();
    UI.toast(`أُضيف ${p.name}`);
    APP.render();
  },
});
