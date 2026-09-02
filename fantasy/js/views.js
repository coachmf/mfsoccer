/* الشاشات الرئيسية */
'use strict';

const VIEWS = {
  ui: { sel:null, subMode:false, tOut:[], tIn:[], filters:{pos:'',club:'',sort:'total',search:'',fdr:false},
        pickerSquad:[], authTab:'login', fxGw:null, statsTab:'transfers', playerOpen:null, leagueOpen:null,
        adminSec:'gws', adminGw:null, editFx:null, pointsGw:null, cmp:[] },

  /* ======================= المصادقة ======================= */
  auth(){
    const t=this.ui.authTab;
    const tab=(id,l)=>`<button class="${t===id?'active':''}" onclick="VIEWS.ui.authTab='${id}';APP.render()">${l}</button>`;
    let form='';
    if(t==='login') form=`
      <div class="field"><label>البريد الإلكتروني</label><input id="f_email" type="email" placeholder="you@example.com"></div>
      <div class="field"><label>كلمة المرور</label><input id="f_pass" type="password"></div>
      <button class="btn" style="width:100%" onclick="VIEWS.doLogin()">دخول</button>`;
    else if(t==='signup') form=`
      <div class="field"><label>اسم المستخدم</label><input id="f_user" placeholder="مثال: mansour_q8"></div>
      <div class="field"><label>البريد الإلكتروني</label><input id="f_email" type="email"></div>
      <div class="field"><label>كلمة المرور (6+ أحرف)</label><input id="f_pass" type="password"></div>
      <div class="field"><label>اسم فريقك في الفانتازي</label><input id="f_team" placeholder="مثال: نسور الديرة"></div>
      <button class="btn" style="width:100%" onclick="VIEWS.doSignup()">إنشاء حساب</button>`;
    else form=`
      <div class="field"><label>البريد الإلكتروني</label><input id="f_email" type="email"></div>
      <button class="btn" style="width:100%" onclick="VIEWS.doForgot()">إرسال رمز الاستعادة</button>
      <div id="resetBox" style="display:none;margin-top:14px">
        <div class="field"><label>الرمز</label><input id="f_code"></div>
        <div class="field"><label>كلمة المرور الجديدة</label><input id="f_np" type="password"></div>
        <button class="btn sec" style="width:100%" onclick="VIEWS.doReset()">تغيير كلمة المرور</button>
      </div>`;
    return `<div class="auth-hero">
      <img src="assets/logo-light.png" alt="" style="height:60px">
      <h1>فانتازي الدوري الكويتي</h1>
      <div class="sub">دوري زين الممتاز ${DB.state.rules.season} — كوّن فريقك ونافس أصحابك</div>
      <div class="card">
        <div class="tabs" style="width:100%">${tab('login','دخول')}${tab('signup','حساب جديد')}${tab('forgot','نسيت كلمة المرور')}</div>
        ${form}
      </div>
      <div class="tiny" style="text-align:center;margin-top:12px">نسخة تجريبية محلية — الحسابات محفوظة على جهازك فقط</div>
    </div>`;
  },
  doLogin(){
    const r=AUTH.login(gv('f_email'), gv('f_pass'));
    if(r.ok){ UI.toast('أهلاً بعودتك!'); APP.render(); } else UI.toast(r.err, true);
  },
  doSignup(){
    const r=AUTH.signup(gv('f_user'), gv('f_email'), gv('f_pass'), gv('f_team'));
    if(r.ok){ UI.toast('تم إنشاء الحساب'); APP.go('team'); } else UI.toast(r.err, true);
  },
  doForgot(){
    const r=AUTH.forgot(gv('f_email'));
    if(r.ok){ document.getElementById('resetBox').style.display='block'; UI.modal(`<h3>وضع تجريبي</h3><p>لا يوجد خادم بريد — رمز الاستعادة هو:</p><h2 style="text-align:center;letter-spacing:6px;margin:14px 0">${r.code}</h2><button class="btn" style="width:100%" onclick="UI.closeModal()">حسناً</button>`); }
    else UI.toast(r.err,true);
  },
  doReset(){
    const r=AUTH.resetPass(gv('f_email'), gv('f_code'), gv('f_np'));
    if(r.ok){ UI.toast('تم التغيير — سجّل الدخول'); this.ui.authTab='login'; APP.render(); } else UI.toast(r.err,true);
  },
  verifyBanner(){
    const m=DB.me();
    if(!m || m.verified) return '';
    const code=DB.state.verifyCodes[m.email];
    return `<div class="card" style="margin-bottom:16px;border-color:var(--gold)">
      <div class="row spread" style="flex-wrap:wrap;gap:10px">
        <div><b>فعّل بريدك:</b> <span class="muted">أدخل رمز التحقق ${code?`(وضع تجريبي — الرمز: <b>${code}</b>)`:''}</span></div>
        <div class="row"><input id="vcode" style="width:130px" placeholder="000000"><button class="btn sm" onclick="VIEWS.doVerify()">تفعيل</button></div>
      </div></div>`;
  },
  doVerify(){
    const r=AUTH.verify(gv('vcode'));
    if(r.ok){ UI.toast('تم تفعيل البريد '); APP.render(); } else UI.toast(r.err,true);
  },

  /* ======================= الرئيسية (على طراز FPL) ======================= */
  dashboard(){
    const st=DB.state, m=DB.me(), team=DB.myTeam();
    const hist=team.history||[];
    const lastFin=[...st.gws].filter(g=>g.status==='finished').pop();
    const lastH=lastFin? hist.find(h=>h.gw===lastFin.n) : null;
    const next=DB.gw(st.currentGW);
    const liveNow=LIVE.running();
    const hasSquad=team.squad.length>0;

    const gwBlock = lastFin? `
      <div class="hh-gwtitle">الجولة ${lastFin.n}</div>
      <div class="hh-stats">
        <div><b>${lastFin.avg||'—'}</b><span>المتوسط</span></div>
        <div class="big" ${lastH?`onclick="APP.go('points')"`:''}><b>${lastH? lastH.pts:0}</b><span>نقاطك</span></div>
        <div><b>${(GWADMIN.champion(lastFin.n)||{}).pts||lastFin.high||'—'}</b><span>الأعلى</span></div>
      </div>
      ${this.championCard(lastFin.n)}` : '';

    const mainBtn = `<button class="big-pill primary" onclick="APP.go('team')">${UI.icon('shirt')} ${hasSquad?'اختر تشكيلتك':'كوّن فريقك الآن'}</button>`;

    const links=[
      ['fixtures','cal','المباريات','النتائج وتقييم صعوبة الجولات القادمة'],
      ['players','users','اللاعبون','الأسعار والنقاط وسجل كل لاعب'],
      ['stats','stats','الإحصائيات','الأكثر انتقالاً وتملكاً وأفضل قيمة'],
      ['compare','users','مقارنة اللاعبين','قارن حتى 3 لاعبين جنباً إلى جنب'],
      ['leagues','trophy','الدوريات','الترتيب العام ودورياتك الخاصة'],
    ];

    return `<div class="home-wrap">
      <div class="home-hero">
        <div class="hh-top">
          <div class="hh-badge">${UI.icon('ball',30)}</div>
          <div style="flex:1">
            <div class="hh-team">${esc(m.teamName)} ${this.championBadge(m.id)}</div>
            <div class="hh-user">${esc(m.username)}</div>
          </div>
          <button class="hh-edit" onclick="APP.go('profile')">${UI.icon('chev',20)}</button>
        </div>
        ${gwBlock? `<div class="hh-divider"></div>${gwBlock}`:''}
        <div class="hh-divider"></div>
        <div class="hh-gwlabel">الجولة ${st.currentGW} · موعد الإغلاق ${liveNow?'<span class="pill red">مباشر الآن</span>':''}</div>
        <div class="hh-deadline">${next? UI.fmtDate(next.deadline):''}</div>
        ${mainBtn}
        <div class="pill-row">
          <button class="big-pill" onclick="APP.go('transfers')">${UI.icon('swap',18)} الانتقالات</button>
          <button class="big-pill" onclick="APP.go('${liveNow?'live':(hist.length?'points':'live')}')">${UI.icon(liveNow?'live':'spark',18)} ${liveNow?'المباشر':'ملخص الجولة'}</button>
        </div>
      </div>
      <div class="link-list">
        ${links.map(([r,ic,l,sub])=>`<div class="link-row" onclick="APP.go('${r}')">
          <span class="lr-lead">${UI.icon(ic,19)}<span><span class="lr-title">${l}</span><span class="lr-sub">${sub}</span></span></span>
          <span class="lr-arrow">${UI.icon('chev',16)}</span></div>`).join('')}
      </div>
      ${this.devCard(true)}
    </div>`;
  },

  /* ======================= نقاط جولة ======================= */
  points(){
    const st=DB.state, team=DB.myTeam();
    const hist=team.history||[];
    if(!hist.length) return '<div class="card"><div class="muted">لا توجد جولات محتسبة بعد.</div></div>';
    const gw=this.ui.pointsGw || hist[hist.length-1].gw;
    const h=hist.find(x=>x.gw===gw)||hist[hist.length-1];
    const res=TEAM.gwPoints(team, h.gw, st);
    const picks=team.gwPicks[h.gw];
    const row=r=>{
      const p=DB.player(r.pid); const s=DB.pgw(r.pid,h.gw);
      return `<tr onclick="VIEWS.openPlayer('${p.id}')" style="cursor:pointer">
        <td><div class="row">${UI.playerAvatar(p,28)} <div><b>${esc(p.name)}</b> ${r.cap?'<span class="pill gold">C</span>':''}<div class="tiny">${DB.club(p.club).short} · ${POS_AR[p.pos]}</div></div></div></td>
        <td class="tiny">${s? s.min+"'" : '—'}</td><td class="tiny">${s? s.g:0}/${s? s.a:0}</td><td class="tiny">${s&&s.bonus? '+'+s.bonus:'—'}</td>
        <td class="num" style="color:var(--accent)">${r.cap? r.eff+' ('+r.pts+'×'+(res.chip==='triplecap'?3:2)+')' : r.pts}</td></tr>`;
    };
    return `<div class="row spread" style="margin-bottom:14px;flex-wrap:wrap;gap:8px">
      <h2>نقاط الجولة ${h.gw}</h2>
      <div class="tabs">${hist.map(x=>`<button class="${x.gw===h.gw?'active':''}" onclick="VIEWS.ui.pointsGw=${x.gw};APP.render()">ج${x.gw}</button>`).join('')}</div></div>
    <div class="grid g4" style="margin-bottom:14px">
      <div class="statbox hi"><div class="v">${h.pts}</div><div class="l">نقاطك ${h.hits?`(خصم -${h.hits})`:''}</div></div>
      <div class="statbox"><div class="v">${DB.gw(h.gw).avg ?? '—'}</div><div class="l">متوسط الجولة</div></div>
      <div class="statbox"><div class="v">${Number(h.rank).toLocaleString('ar')}</div><div class="l">ترتيب الجولة</div></div>
      <div class="statbox"><div class="v">${h.benchPts}</div><div class="l">نقاط الدكة ${h.chip?`· كرت: ${DB.state.rules.chips[h.chip]?.label||h.chip}`:''}</div></div>
    </div>
    <div class="card"><h3>التشكيلة الأساسية — الكابتن: ${esc(res.capName)}</h3>
      <div class="scroll-x"><table class="tbl"><tr><th>اللاعب</th><th>دقائق</th><th>أهداف/صناعة</th><th>بونص</th><th>النقاط</th></tr>
      ${res.rows.filter(r=>!r.bench).map(row).join('')}</table></div>
      <h3 style="margin-top:16px">الدكة ${res.chip==='benchboost'?'<span class="pill green">دكة قوية — احتُسبت</span>':''}</h3>
      <div class="scroll-x"><table class="tbl">${res.rows.filter(r=>r.bench).map(row).join('')}</table></div>
    </div>`;
  },

  /* ======================= فريقي ======================= */
  team(){
    const team=DB.myTeam();
    if(!team.squad.length) return this.squadPicker();
    const st=DB.state, gw=st.currentGW;
    const locked=GWADMIN.deadlinePassed(gw);
    const xiV=TEAM.validateXI(team.xi);
    const chips=st.rules.chips;
    const view=this.ui.teamView||'pitch';
    const CHIP_IC={wildcard:'swap', benchboost:'stats', triplecap:'trophy', freehit:'spark'};
    const chipCard=(key)=>{
      const c=chips[key]; if(!c.enabled) return '';
      const used=team.usedChips[key]||0;
      const active=team.activeChip===key;
      const disabled= locked || (used>=c.uses && !active) || (team.activeChip && !active);
      return `<div class="chip-card ${active?'on':''}" title="${esc(c.desc)}">
        <div class="ci">${UI.icon(CHIP_IC[key]||'spark',22)}</div>
        <div class="cl">${esc(c.label)}</div>
        <button class="cp" ${disabled?'disabled':''} onclick="VIEWS.toggleChip('${key}')">${active?'إلغاء':used>=c.uses?'مستخدم':'تفعيل'}</button>
      </div>`;
    };
    return `<div class="pickteam">
      <div class="squad-hero">
        <div class="sh-info">
          <div class="sh-name">${esc(DB.me().teamName)} ${this.championBadge(DB.me().id)}</div>
          <div class="sh-sub">الجولة ${gw} · ${locked? 'مقفلة' : 'الإغلاق: '+UI.fmtDate(DB.gw(gw).deadline)}</div>
        </div>
        <div class="sh-stats">
          <div><b>${fmtM(TEAM.teamValue(team))}</b><span>القيمة</span></div>
          <div><b>${fmtM(team.bank)}</b><span>بالبنك</span></div>
          <div><b>${team.ft}</b><span>انتقالات</span></div>
        </div>
      </div>
      <div class="chips-row">${Object.keys(chips).map(chipCard).join('')}</div>
      ${xiV.ok? '' : `<div class="card" style="border-color:var(--red);margin:0 0 10px">${xiV.errs.map(e=>`<div style="color:var(--red)">${e}</div>`).join('')}</div>`}
      <div class="pt-toggle">
        <button class="${view==='pitch'?'active':''}" onclick="VIEWS.ui.teamView='pitch';APP.render()">الملعب</button>
        <button class="${view==='list'?'active':''}" onclick="VIEWS.ui.teamView='list';APP.render()">قائمة</button>
        <button class="${view==='market'?'active':''}" onclick="VIEWS.ui.teamView='market';APP.render()">الانتقالات</button>
      </div>
      ${view==='market'? this.transfers() : `
      ${view==='pitch'? this.formationRow(team, xiV, locked) : ''}
      <div class="pt-layout">
        <div>
          ${view==='pitch'? `
            <div class="zain-frame">
            ${this.pitchHTML(team, {mode:'team', locked})}
            <div class="bench-strip">
              ${team.bench.map(pid=>{
                const p=DB.player(pid);
                return `<div class="bench-slot"><div class="bench-pos">${p.pos==='G'?'حارس':POS_AR[p.pos]}</div>${this.slotHTML(pid, team, {bench:true, locked})}</div>`;
              }).join('')}
            </div>
            </div>`
          : this.teamListHTML(team)}

        </div>
        <div class="pt-side">${this.teamSidebar(team)}</div>
      </div>`}
    </div>`;
  },
  /* الشريط الجانبي لشاشة التشكيلة (سطح المكتب) — على طراز FPL */
  teamSidebar(team){
    const st=DB.state, m=DB.me();
    const gw=st.currentGW;
    const fx=st.fixtures.filter(f=>f.gw===gw).slice(0,6);
    const rows=VIEWS.globalTable().slice(0,5);
    const hist=team.history||[];
    const total=hist.reduce((s,h)=>s+h.pts,0);
    return `
      <div class="card" style="margin-bottom:12px"><h3>فريقي</h3>
        <div class="side-row"><span>مجموع النقاط</span><b style="color:var(--accent)">${total}</b></div>
        <div class="side-row"><span>قيمة الفريق</span><b>${fmtM(TEAM.teamValue(team))}</b></div>
        <div class="side-row"><span>بالبنك</span><b>${fmtM(team.bank)}</b></div>
        <div class="side-row"><span>انتقالات مجانية</span><b>${team.ft}</b></div>
        <button class="btn" style="width:100%;margin-top:10px" onclick="APP.go('transfers')">الانتقالات</button>
      </div>
      <div class="card" style="margin-bottom:12px"><h3>مباريات الجولة ${gw}</h3>
        ${fx.map(f=>`<div class="side-fx">${UI.crest(f.h)} <b>${DB.club(f.h).short}</b>
          <span class="tiny">${f.status==='F'? f.hs+' - '+f.as : UI.fmtDateShort(f.date)}</span>
          <b>${DB.club(f.a).short}</b> ${UI.crest(f.a)}</div>`).join('')}
        <button class="btn sm sec" style="width:100%;margin-top:8px" onclick="APP.go('fixtures')">كل المباريات والصعوبة</button>
      </div>
      <div class="card"><h3>الترتيب العام</h3>
        <table class="tbl">${rows.map((r,i)=>`<tr ${r.id===m.id?'style="background:color-mix(in srgb,var(--accent) 10%,transparent)"':''}>
          <td class="num">${i+1}</td><td>${esc(r.name)}</td><td class="num">${r.total}</td></tr>`).join('')}</table>
        <button class="btn sm sec" style="width:100%;margin-top:8px" onclick="APP.go('leagues')">الدوريات</button>
      </div>`;
  },
  /* صف الخطط الجاهزة */
  formationRow(team, xiV, locked){
    const R=DB.state.rules;
    const FORMS=[[3,4,3],[3,5,2],[4,3,3],[4,4,2],[4,5,1],[5,2,3],[5,3,2],[5,4,1]];
    const counts={G:0,D:0,M:0,F:0};
    team.squad.forEach(pid=>counts[DB.player(pid).pos]++);
    const valid=FORMS.filter(([d,m,f])=>
      d>=R.formationMin.D && d<=R.formationMax.D && m>=R.formationMin.M && m<=R.formationMax.M &&
      f>=R.formationMin.F && f<=R.formationMax.F && d<=counts.D && m<=counts.M && f<=counts.F);
    const cur=xiV.formation;
    return `<div class="form-row">${valid.map(([d,m,f])=>{
      const key=d+'-'+m+'-'+f;
      return `<button class="form-chip ${cur===key?'active':''}" ${locked?'disabled':''} dir="ltr" onclick="VIEWS.setFormation(${d},${m},${f})">${key}</button>`;
    }).join('')}</div>`;
  },
  setFormation(d,m,f){
    const team=DB.myTeam(); const st=DB.state;
    if(GWADMIN.deadlinePassed(st.currentGW)){ UI.toast('الجولة مقفلة',true); return; }
    const all=team.squad.map(id=>DB.player(id));
    const byPos=pos=>all.filter(p=>p.pos===pos)
      .sort((a,b)=>(DB.playerTotal(b.id)-DB.playerTotal(a.id)) || (b.price-a.price));
    const gk=byPos('G')[0];
    const xi=[gk.id, ...byPos('D').slice(0,d).map(p=>p.id), ...byPos('M').slice(0,m).map(p=>p.id), ...byPos('F').slice(0,f).map(p=>p.id)];
    if(xi.length!==11){ UI.toast('قائمتك لا تسمح بهذه الخطة',true); return; }
    team.xi=xi;
    team.bench=team.squad.filter(id=>!xi.includes(id))
      .sort((a,b)=>(DB.player(a).pos==='G'?-1:0)-(DB.player(b).pos==='G'?-1:0) || DB.playerTotal(b)-DB.playerTotal(a));
    if(!xi.includes(team.cap)) team.cap=xi.slice(1).sort((a,b)=>DB.playerTotal(b)-DB.playerTotal(a))[0]||xi[1];
    if(!xi.includes(team.vice)||team.vice===team.cap) team.vice=xi.find(id=>id!==team.cap && DB.player(id).pos!=='G')||xi[2];
    DB.save(); UI.toast('تبدّلت الخطة إلى '+d+'-'+m+'-'+f); APP.render();
  },
  teamListHTML(team){
    const row=pid=>{
      const p=DB.player(pid);
      const next=FDR.next(p.club,3);
      return `<div class="plist-item" onclick="VIEWS.slotClick('${p.id}')">
        ${UI.playerAvatar(p,34)}
        <div class="info"><div class="n">${esc(p.name)} ${team.cap===pid?'<span class="pill gold">C</span>':team.vice===pid?'<span class="pill">V</span>':''} ${UI.statusPill(p)}</div>
        <div class="m">${DB.club(p.club).short} · ${POS_AR[p.pos]} · ${fmtM(p.price)}</div>
        <div class="fdr-line">${next.map(x=>UI.fdrPill(x)).join('')}</div></div>
        <div class="tp">${DB.playerTotal(p.id)}</div></div>`;
    };
    return `<div class="card">
      ${['G','D','M','F'].map(pos=>{
        const ids=[...team.xi,...team.bench].filter(pid=>DB.player(pid).pos===pos);
        return `<div class="tiny" style="margin:10px 0 2px;font-weight:800">${POS_AR[pos]}</div>${ids.map(row).join('')}`;
      }).join('')}
    </div>`;
  },
  pitchHTML(team, opt){
    const xi=team.xi.map(pid=>DB.player(pid));
    const rows=['G','D','M','F'].map(pos=>
      `<div class="pitch-row">${xi.filter(p=>p.pos===pos).map(p=>this.slotHTML(p.id, team, opt)).join('')}</div>`);
    return `<div class="pitch">
      <div class="pitch-brand"><img src="assets/logo-light.png" alt=""><img src="assets/logo-light.png" alt=""><img src="assets/logo-light.png" alt=""></div>
      <div class="pf-goal"></div><div class="pf-box6"></div><div class="pf-box"></div><div class="pf-circle"></div>
      ${rows.join('')}</div>`;
  },
  slotHTML(pid, team, opt){
    opt=opt||{};
    const p=DB.player(pid);
    const st=DB.state;
    const sel=this.ui.sel===pid;
    const liveGw = st.gws.find(g=>g.status==='live');
    const r = liveGw? DB.pgw(pid, liveGw.n) : null;
    const next=FDR.next(p.club,1)[0];
    const sub = r? `${r.pts} نقطة` : next? `${DB.club(next.opp).short} ${UI.icon(next.home?'home':'plane',11)}` : '—';
    const dim = this.ui.subMode && this.ui.sel && !this.canSwapWith(this.ui.sel, pid, team);
    return `<div class="pslot ${sel?'sel':''} ${dim?'dim':''}" onclick="VIEWS.slotClick('${pid}')">
      ${team.cap===pid? '<div class="badge">C</div>' : team.vice===pid? '<div class="badge v">V</div>':''}
      ${p.status!=='a'? `<div class="flag">!</div>`:''}
      <div class="club-tag">${DB.club(p.club).short}</div>
      ${UI.pitchKit(p, 54)}
      <div class="nm">${esc(p.name.split(' ').slice(-1)[0])}</div>
      <div class="pt">${sub}</div>
    </div>`;
  },
  canSwapWith(selPid, otherPid, team){
    const a=DB.player(selPid), b=DB.player(otherPid);
    if(selPid===otherPid) return false;
    const selInXI=team.xi.includes(selPid), otherInXI=team.xi.includes(otherPid);
    if(selInXI===otherInXI && selInXI) return false; // داخل التشكيلة لا معنى للتبديل
    if((a.pos==='G')!==(b.pos==='G')) return false;
    const xi=[...team.xi];
    const i=xi.indexOf(selInXI?selPid:otherPid);
    xi[i]= selInXI? otherPid : selPid;
    return TEAM.validateXI(xi).ok;
  },
  slotClick(pid){
    const team=DB.myTeam(); const st=DB.state;
    const locked=GWADMIN.deadlinePassed(st.currentGW);
    if(this.ui.subMode && this.ui.sel){
      if(this.canSwapWith(this.ui.sel, pid, team)){
        const selPid=this.ui.sel;
        const selInXI=team.xi.includes(selPid);
        const xiPid = selInXI? selPid: pid, bnPid = selInXI? pid: selPid;
        const xi=team.xi.indexOf(xiPid), bn=team.bench.indexOf(bnPid);
        team.xi[xi]=bnPid; team.bench[bn]=xiPid;
        if(team.cap===xiPid) team.cap=bnPid;
        if(team.vice===xiPid) team.vice=bnPid;
        this.ui.sel=null; this.ui.subMode=false;
        DB.save(); UI.toast('تم التبديل'); APP.render();
        return;
      }
      this.ui.sel=null; this.ui.subMode=false; APP.render(); return;
    }
    this.playerSheet(pid);
  },
  /* بطاقة اللاعب السفلية — على طراز FPL */
  playerSheet(pid, mode){
    mode=mode||'team';
    const st=DB.state, team=DB.myTeam(), p=DB.player(pid);
    const c=DB.club(p.club);
    const locked=GWADMIN.deadlinePassed(st.currentGW);
    const inXI=team.xi.includes(pid);
    const POS_FULL={G:'حارس مرمى',D:'مدافع',M:'لاعب وسط',F:'مهاجم'};
    const same=st.players.filter(x=>x.pos===p.pos && x.status!=='u');
    const rankOf=fn=>{ const arr=same.map(x=>({id:x.id,v:fn(x)})).sort((a,b)=>b.v-a.v); return arr.findIndex(e=>e.id===pid)+1; };
    const gpOf=x=>Object.keys(st.playerGW[x.id]||{}).length;
    const ppm=x=>{ const g=gpOf(x); return g? DB.playerTotal(x.id)/g : 0; };
    const stats=[
      [fmtM(p.price), 'السعر', rankOf(x=>x.price)],
      [ppm(p).toFixed(1), 'نقاط/مباراة', rankOf(ppm)],
      [DB.playerForm(pid).toFixed(1), 'الفورمة', rankOf(x=>DB.playerForm(x.id))],
      [MARKET.ownership(pid)+'%', 'التملّك', rankOf(x=>MARKET.ownership(x.id))],
    ];
    const fin=st.gws.filter(g=>g.status==='finished').map(g=>g.n).slice(-4);
    const formCells=fin.map(gw=>{
      const r=DB.pgw(pid,gw);
      const fx=st.fixtures.find(f=>f.gw===gw&&(f.h===p.club||f.a===p.club));
      const home=fx&&fx.h===p.club; const opp=fx?(home?fx.a:fx.h):null;
      const pts=r?r.pts:0;
      const cls=pts>=8?'good':pts>=4?'ok':pts>=1?'mid':'bad';
      return `<div class="fcell"><div class="tiny">ج${gw}</div>${opp?UI.crest(opp):''}
        <div class="tiny">${opp?DB.club(opp).short:'—'} ${UI.icon(home?'home':'plane',11)}</div>
        <span class="ptschip ${cls}">${pts}</span></div>`;
    }).join('') || '<div class="muted tiny">لا جولات بعد</div>';
    const fxCells=FDR.next(p.club,3).map(x=>`
      <div class="fcell"><div class="tiny">ج${x.gw}</div>${UI.crest(x.opp)}
        <div class="tiny">${DB.club(x.opp).short} ${UI.icon(x.home?'home':'plane',11)}</div>
        <span class="ptschip fdr-l${x.lvl}">${x.lvl}</span></div>`).join('');
    UI.sheet(`
      <div class="ps-head">
        <div class="ps-kit">${UI.playerPhoto(p)? `<img class="ps-photo" src="${esc(UI.playerPhoto(p))}" alt="">` : UI.kitShirt(p.club, p.pos==='G', 84)}</div>
        <div style="flex:1">
          <div class="ps-pos">${POS_FULL[p.pos]}</div>
          <div class="ps-name">${esc(p.name)}</div>
          <div class="ps-club">${c.name}${p.shirt?` · #${p.shirt}`:''} ${UI.statusPill(p)}</div>
        </div>
        ${UI.crest(p.club,'lg')}
      </div>
      ${p.news? `<div class="tiny" style="margin:0 18px 8px">${esc(p.news)}</div>`:''}
      <div class="ps-stats">
        ${stats.map(([v,l,r])=>`<div><b>${v}</b><div class="lbl">${l}</div><div class="rnk">${r} من ${same.length}</div></div>`).join('')}
      </div>
      <div class="ps-two">
        <div><h4>الفورمة</h4><div class="ps-cells">${formCells}</div></div>
        <div><h4>المباريات القادمة</h4><div class="ps-cells">${fxCells}</div></div>
      </div>
      ${(mode==='team' && !locked && inXI)? `<div class="ps-caps">
        <label><input type="checkbox" ${team.cap===pid?'checked':''} onclick="VIEWS.sheetCap('${pid}',false)"> كابتن</label>
        <label><input type="checkbox" ${team.vice===pid?'checked':''} onclick="VIEWS.sheetCap('${pid}',true)"> نائب الكابتن</label>
      </div>`:''}
      ${this.sheetActions(pid, mode, locked)}`);
  },
  /* أزرار البطاقة حسب السياق: التشكيلة / تكوين الفريق / الانتقالات / شاشة الإضافة */
  sheetActions(pid, mode, locked){
    const full=`<button class="btn ghost" onclick="UI.closeSheet();VIEWS.openPlayer('${pid}')">الملف الكامل</button>`;
    const wrap=(a,b)=>`<div class="ps-actions">${a}</div><div class="ps-actions" style="margin-top:8px">${b}</div>`;
    if(mode==='picker'){
      const p=DB.player(pid);
      return wrap(`<button class="btn sec" onclick="VIEWS.pickerRemove('${pid}')">إزالة</button>
        <button class="btn" onclick="UI.closeSheet();VIEWS.openAddPlayer({ctx:'picker',pos:'${p.pos}',outPid:'${pid}'})">اختيار بديل</button>`, full);
    }
    if(mode==='transfer'){
      if(locked) return `<div class="ps-actions">${full}</div>`;
      return wrap(`<button class="btn sec" onclick="VIEWS.tRemove('${pid}')">إزالة</button>
        <button class="btn" onclick="UI.closeSheet();VIEWS.openAddPlayer({ctx:'transfer',outPid:'${pid}'})">اختيار بديل</button>`, full);
    }
    if(mode==='tin'){
      const i=this.ui.tIn.indexOf(pid); const outPid=this.ui.tOut[i];
      return wrap(`<button class="btn sec" onclick="VIEWS.tRestore('${outPid}')">تراجع</button>
        <button class="btn" onclick="UI.closeSheet();VIEWS.openAddPlayer({ctx:'transfer',outPid:'${outPid}'})">بديل آخر</button>`, full);
    }
    if(mode==='addp'){
      return `<div class="ps-actions">${full}<button class="btn" onclick="VIEWS.addpPick('${pid}')">إضافة</button></div>`;
    }
    if(mode==='addp-out') return `<div class="ps-actions">${full}</div>`;
    return `<div class="ps-actions">${full}${locked? '' : `<button class="btn" onclick="VIEWS.startSub('${pid}')">تبديل</button>`}</div>
      <div class="ps-actions" style="margin-top:8px"><button class="btn ghost" onclick="VIEWS.cmpOpen('${pid}')">قارن مع لاعب آخر</button></div>`;
  },
  sheetCap(pid,isVice){
    const team=DB.myTeam();
    if(isVice){ if(team.cap===pid) team.cap=team.vice; team.vice=pid; }
    else { if(team.vice===pid) team.vice=team.cap; team.cap=pid; }
    DB.save(); APP.render(); this.playerSheet(pid);
  },
  startSub(pid){ UI.closeModal(); UI.closeSheet(); this.ui.sel=pid; this.ui.subMode=true; UI.toast('اختر اللاعب الذي تريد التبديل معه'); APP.render(); },
  makeCap(pid,isVice){
    const team=DB.myTeam();
    if(isVice){ if(team.cap===pid) team.cap=team.vice; team.vice=pid; }
    else { if(team.vice===pid) team.vice=team.cap; team.cap=pid; }
    DB.save(); UI.closeModal(); APP.render();
  },
  toggleChip(key){
    const team=DB.myTeam(); const st=DB.state;
    if(team.activeChip===key){
      if(key==='freehit' && team.fhBackup){
        Object.assign(team, {squad:team.fhBackup.squad, xi:team.fhBackup.xi, bench:team.fhBackup.bench,
          cap:team.fhBackup.cap, vice:team.fhBackup.vice, bank:team.fhBackup.bank});
        team.fhBackup=null;
      }
      team.activeChip=null; DB.save(); UI.toast('أُلغي الكرت'); APP.render(); return;
    }
    team.activeChip=key;
    team.usedChips[key]=(team.usedChips[key]||0)+0; // يُحسم عند الاحتساب
    if(key==='freehit'){ team.fhBackup={squad:[...team.squad], xi:[...team.xi], bench:[...team.bench], cap:team.cap, vice:team.vice, bank:team.bank}; }
    // حسم الاستخدام فوراً حتى لا يتكرر
    team.usedChips[key]=(team.usedChips[key]||0)+1;
    DB.save(); UI.toast(`فُعّل كرت ${st.rules.chips[key].label} لهذه الجولة`); APP.render();
  },

  marketFilters(){
    const f=this.ui.filters; const st=DB.state;
    return `<div class="row" style="flex-wrap:wrap;gap:6px;margin-bottom:10px">
      <select style="width:auto" onchange="VIEWS.ui.filters.pos=this.value;APP.render()">
        <option value="">كل المراكز</option>${['G','D','M','F'].map(p=>`<option value="${p}" ${f.pos===p?'selected':''}>${POS_AR[p]}</option>`).join('')}</select>
      <select style="width:auto" onchange="VIEWS.ui.filters.club=this.value;APP.render()">
        <option value="">كل الأندية</option>${st.clubs.map(c=>`<option value="${c.id}" ${f.club===c.id?'selected':''}>${c.name}</option>`).join('')}</select>
      <input style="width:130px" placeholder="بحث بالاسم" value="${esc(f.search)}" oninput="VIEWS.ui.filters.search=this.value" onchange="APP.render()">
    </div>`;
  },
  autoPick(){
    const st=DB.state, R=st.rules;
    for(let attempt=0;attempt<40;attempt++){
      const sq=[]; const byClub={};
      let ok=true;
      for(const pos of ['G','D','M','F']){
        const pool=st.players.filter(p=>p.pos===pos && p.status==='a').sort(()=>Math.random()-0.5);
        let need=R.posCount[pos];
        for(const p of pool){
          if(need===0) break;
          if((byClub[p.club]||0)>=R.maxPerClub) continue;
          sq.push(p.id); byClub[p.club]=(byClub[p.club]||0)+1; need--;
        }
        if(need>0) ok=false;
      }
      const cost=sq.reduce((s,pid)=>s+DB.player(pid).price,0);
      if(ok && cost<=R.budget){ this.ui.pickerSquad=sq; APP.render(); return; }
    }
    UI.toast('حاول مرة أخرى',true);
  },
  confirmSquad(){
    const team=DB.myTeam(); const st=DB.state;
    const sq=this.ui.pickerSquad;
    const v=TEAM.validateSquad(sq);
    if(!v.ok){ UI.toast(v.errs[0],true); return; }
    team.squad=[...sq];
    // اختيار تشكيلة تلقائية: الأغلى مع احترام القيود
    const ps=sq.map(pid=>DB.player(pid));
    const best=pos=>ps.filter(p=>p.pos===pos).sort((a,b)=>b.price-a.price);
    const xi=[best('G')[0], ...best('D').slice(0,3), ...best('M').slice(0,3), best('F')[0]];
    const rest=ps.filter(p=>!xi.includes(p)&&p.pos!=='G').sort((a,b)=>b.price-a.price);
    for(const p of rest){
      if(xi.length>=11) break;
      const trial=[...xi.map(x=>x.id), p.id];
      const counts={G:0,D:0,M:0,F:0}; trial.forEach(id=>counts[DB.player(id).pos]++);
      if(counts[p.pos]<=st.rules.formationMax[p.pos]) xi.push(p);
    }
    team.xi=xi.map(p=>p.id);
    team.bench=sq.filter(pid=>!team.xi.includes(pid));
    // ترتيب الدكة: الحارس أولاً
    team.bench.sort((a,b)=>(DB.player(a).pos==='G'?-1:0)-(DB.player(b).pos==='G'?-1:0) || DB.player(b).price-DB.player(a).price);
    const sorted=[...team.xi].sort((a,b)=>DB.player(b).price-DB.player(a).price);
    team.cap=sorted[0]; team.vice=sorted[1];
    team.bank=Math.round((st.rules.budget-v.cost)*10)/10;
    this.ui.pickerSquad=[];
    DB.save(); UI.toast('تم اعتماد فريقك! '); APP.render();
  },

  /* ======================= الانتقالات (التنفيذ) ======================= */
  tConfirm(){
    const st=DB.state, team=DB.myTeam();
    const tOut=this.ui.tOut, tIn=this.ui.tIn.filter(Boolean);
    const n=tOut.length;
    const freeMode=team.activeChip==='wildcard'||team.activeChip==='freehit';
    const hits=freeMode?0:Math.max(0,n-team.ft)*st.rules.transferCost;
    const outCost=tOut.reduce((s,pid)=>s+DB.player(pid).price,0);
    const inCost=tIn.reduce((s,pid)=>s+DB.player(pid).price,0);
    UI.modal(`<h3>تأكيد الصفقات</h3>
      ${tOut.map((pid,i)=>`<div class="fx"><div class="team" style="color:var(--red)">${esc(DB.player(pid).name)}</div>
        <div class="score">↔</div><div class="team a" style="color:var(--green)">${esc(DB.player(tIn[i]).name)} </div></div>`).join('')}
      <div class="muted" style="margin:10px 0">${hits>0? `سيُخصم <b style="color:var(--red)">${hits} نقطة</b> من رصيدك هذه الجولة.` : 'بدون خصم نقاط.'}</div>
      <div class="row" style="gap:8px"><button class="btn" onclick="VIEWS.tApply()">تنفيذ</button>
      <button class="btn sec" onclick="UI.closeModal()">إلغاء</button></div>`);
  },
  tApply(){
    const st=DB.state, team=DB.myTeam();
    const tOut=this.ui.tOut, tIn=this.ui.tIn.filter(Boolean);
    const freeMode=team.activeChip==='wildcard'||team.activeChip==='freehit';
    const n=tOut.length;
    const hits=freeMode?0:Math.max(0,n-team.ft)*st.rules.transferCost;
    tOut.forEach((outPid,i)=>{
      const inPid=tIn[i];
      team.squad[team.squad.indexOf(outPid)]=inPid;
      const xi=team.xi.indexOf(outPid);
      if(xi>=0){
        team.xi[xi]=inPid;
        if(!TEAM.validateXI(team.xi).ok){ // إصلاح: بدّل مع بديل مناسب
          team.xi[xi]=outPid;
          const bn=team.bench.findIndex(b=>{ const trial=[...team.xi]; trial[xi]=b; return TEAM.validateXI(trial).ok; });
          if(bn>=0){ const b=team.bench[bn]; team.bench[bn]=inPid; team.xi[xi]=b; }
          else team.xi[xi]=inPid;
        }
      } else team.bench[team.bench.indexOf(outPid)]=inPid;
      if(team.cap===outPid) team.cap=inPid;
      if(team.vice===outPid) team.vice=inPid;
      team.transfers.push({gw:st.currentGW, out:outPid, in:inPid, date:new Date().toISOString()});
      st.transferStats[inPid]=st.transferStats[inPid]||{in:0,out:0}; st.transferStats[inPid].in++;
      st.transferStats[outPid]=st.transferStats[outPid]||{in:0,out:0}; st.transferStats[outPid].out++;
    });
    const outCost=tOut.reduce((s,pid)=>s+DB.player(pid).price,0);
    const inCost=tIn.reduce((s,pid)=>s+DB.player(pid).price,0);
    team.bank=Math.round((team.bank+outCost-inCost)*10)/10;
    if(!freeMode){ team.ft=Math.max(0,team.ft-n); team.pendingHits=(team.pendingHits||0)+hits; }
    this.ui.tOut=[]; this.ui.tIn=[];
    DB.save(); UI.closeModal(); UI.toast(`نُفذت ${n} صفقة `); APP.render();
  },

  /* ======================= اللاعبون ======================= */
  players(){
    const st=DB.state, f=this.ui.filters;
    let list=st.players.filter(p=>p.status!=='u');
    if(f.pos) list=list.filter(p=>p.pos===f.pos);
    if(f.club) list=list.filter(p=>p.club===f.club);
    if(f.search) list=list.filter(p=>p.name.includes(f.search));
    if(f.fdr) list.sort((a,b)=>FDR.avgNext(a.club,3)-FDR.avgNext(b.club,3)||DB.playerTotal(b.id)-DB.playerTotal(a.id));
    else if(f.sort==='price') list.sort((a,b)=>b.price-a.price);
    else if(f.sort==='form') list.sort((a,b)=>DB.playerForm(b.id)-DB.playerForm(a.id));
    else if(f.sort==='owned') list.sort((a,b)=>MARKET.ownership(b.id)-MARKET.ownership(a.id));
    else list.sort((a,b)=>DB.playerTotal(b.id)-DB.playerTotal(a.id));
    return `<div class="row spread" style="margin-bottom:12px"><h2>اللاعبون</h2><button class="btn sec sm" onclick="VIEWS.cmpOpen()">${UI.icon('swap',15)} مقارنة</button></div>
    <div class="card">
      <div class="row" style="flex-wrap:wrap;gap:6px;margin-bottom:6px">
        ${this.marketFilters()}
        <select style="width:auto" onchange="VIEWS.ui.filters.sort=this.value;APP.render()">
          <option value="total" ${f.sort==='total'?'selected':''}>الأعلى نقاطاً</option>
          <option value="price" ${f.sort==='price'?'selected':''}>الأغلى</option>
          <option value="form" ${f.sort==='form'?'selected':''}>الفورمة</option>
          <option value="owned" ${f.sort==='owned'?'selected':''}>التملّك</option></select>
        <label class="pill" style="cursor:pointer"><input type="checkbox" ${f.fdr?'checked':''} onchange="VIEWS.ui.filters.fdr=this.checked;APP.render()" style="width:auto"> مباريات سهلة قادمة</label>
      </div>
      <div class="scroll-x"><table class="tbl">
        <tr><th>اللاعب</th><th>السعر</th><th>نقاط</th><th>فورمة</th><th>تملّك</th><th>أهداف</th><th>صناعة</th><th>المباريات القادمة</th></tr>
        ${list.slice(0,100).map(p=>`
          <tr onclick="VIEWS.openPlayer('${p.id}')" style="cursor:pointer">
            <td><div class="row">${UI.playerAvatar(p,30)}<div><b>${esc(p.name)}</b> ${UI.statusPill(p)}<div class="tiny">${DB.club(p.club).short} · ${POS_AR[p.pos]}</div></div></div></td>
            <td class="num">${fmtM(p.price)}</td>
            <td class="num" style="color:var(--accent)">${DB.playerTotal(p.id)}</td>
            <td class="num">${DB.playerForm(p.id).toFixed(1)}</td>
            <td class="tiny">${MARKET.ownership(p.id)}%</td>
            <td>${DB.playerStatSum(p.id,'g')}</td><td>${DB.playerStatSum(p.id,'a')}</td>
            <td>${FDR.next(p.club,3).map(x=>UI.fdrPill(x)).join(' ')}</td>
          </tr>`).join('')}
      </table></div>
    </div>`;
  },
  openPlayer(pid){ this.ui.playerOpen=pid; APP.go('player'); },
  player(){
    const pid=this.ui.playerOpen; const p=DB.player(pid);
    if(!p) return '<div class="card">لاعب غير موجود</div>';
    const c=DB.club(p.club);
    const rows=DB.state.playerGW[pid]||{};
    const gws=Object.keys(rows).map(Number).sort((a,b)=>a-b);
    const tc=MARKET.transferCounts(pid);
    const hist=gws.map(g=>({x:'ج'+g, y:rows[g].pts}));
    const sum=k=>DB.playerStatSum(pid,k);
    const team=DB.myTeam();
    const stat=(v,l)=>`<div class="statbox"><div class="v" style="font-size:1.15rem">${v}</div><div class="l">${l}</div></div>`;
    return `<button class="btn sm sec" onclick="history.back()" style="margin-bottom:12px">→ رجوع</button>
    <div class="card" style="margin-bottom:14px">
      <div class="row" style="gap:16px;flex-wrap:wrap">
        ${UI.playerAvatar(p,74)}
        <div style="flex:1">
          <h2>${esc(p.name)} ${p.shirt?`<span class="tiny">#${p.shirt}</span>`:''} ${UI.statusPill(p)}</h2>
          <div class="row" style="gap:8px;margin-top:4px">${UI.crest(p.club)} <b>${c.name}</b> <span class="pill">${POS_AR[p.pos]}</span>
          <span class="pill blue">${fmtM(p.price)} م.د ${p.price>p.startPrice?'▲':p.price<p.startPrice?'▼':''}</span></div>
          ${p.news? `<div class="muted" style="margin-top:8px">${esc(p.news)}</div>`:''}
        </div>
        ${team&&team.squad.length&&!team.squad.includes(pid)? `<button class="btn sec" onclick="APP.go('transfers')">تعاقد معه</button>`:''}
        <button class="btn ghost" onclick="VIEWS.cmpOpen('${pid}')">قارن</button>
      </div>
    </div>
    <div class="grid g4" style="margin-bottom:14px">
      ${stat(DB.playerTotal(pid),'مجموع النقاط')}${stat(DB.playerForm(pid).toFixed(1),'الفورمة (آخر 4)')}
      ${stat(MARKET.ownership(pid)+'%','نسبة التملّك')}${stat(gws.length? Math.round(DB.playerTotal(pid)/gws.length*10)/10:0,'متوسط النقاط/جولة')}
      ${stat(sum('g'),'أهداف')}${stat(sum('a'),'صناعة')}${stat(sum('cs'),'شباك نظيفة')}${stat(sum('min'),'دقائق')}
      ${stat(sum('yc')+' / '+sum('rc'),'صفراء / حمراء')}${stat(sum('bonus'),'نقاط بونص')}
      ${stat((tc.in.toLocaleString('ar'))+' / '+(tc.out.toLocaleString('ar')),'شراء / بيع هذه الجولة')}
    </div>
    <div class="grid g2">
      <div class="card"><h3>نقاط الفانتازي عبر الجولات</h3>${UI.lineChart(hist,560,180)}</div>
      <div class="card"><h3>المباريات القادمة</h3>
        ${FDR.next(p.club,6).map(x=>`<div class="fx"><div class="team">ج${x.gw}</div>
          <div class="team">${UI.crest(x.opp)} ${DB.club(x.opp).name} ${UI.icon(x.home?'home':'plane',13)}</div>
          <span class="fdr l${x.lvl}">${x.label}</span></div>`).join('')||'<div class="muted">انتهى الموسم</div>'}
      </div>
      <div class="card" style="grid-column:1/-1"><h3>سجل الجولات</h3>
        <div class="scroll-x"><table class="tbl"><tr><th>جولة</th><th>دقائق</th><th>أهداف</th><th>صناعة</th><th>شباك</th><th>إنذار</th><th>طرد</th><th>بونص</th><th>نقاط</th></tr>
        ${gws.map(g=>{const r=rows[g];return `<tr><td>ج${g}</td><td>${r.min}'</td><td>${r.g}</td><td>${r.a}</td><td>${r.cs?'نعم':'—'}</td><td>${r.yc||'—'}</td><td>${r.rc||'—'}</td><td>${r.bonus||'—'}</td><td class="num" style="color:var(--accent)">${r.pts}</td></tr>`;}).join('')}
        </table></div></div>
    </div>`;
  },

  /* ======================= المباريات والنتائج ======================= */
  fixtures(){
    const st=DB.state;
    const gw=this.ui.fxGw||st.currentGW;
    const fx=st.fixtures.filter(f=>f.gw===gw);
    const fdrGrid=st.clubs.map(c=>{
      const next=FDR.next(c.id,5);
      return `<tr><td><div class="row">${UI.crest(c.id)} ${c.short}</div></td>
        ${next.map(x=>`<td>${UI.fdrPill(x)}</td>`).join('')}${'<td>—</td>'.repeat(Math.max(0,5-next.length))}</tr>`;
    }).join('');
    return `<h2 style="margin-bottom:12px">المباريات والنتائج</h2>
    <div class="tabs">${st.gws.map(g=>`<button class="${g.n===gw?'active':''}" onclick="VIEWS.ui.fxGw=${g.n};APP.render()">ج${g.n}</button>`).join('')}</div>
    <div class="grid g2">
      <div class="card"><h3>الجولة ${gw} ${DB.gw(gw).status==='finished'?'<span class="pill green">منتهية</span>':DB.gw(gw).status==='live'?'<span class="pill red">مباشر</span>':`<span class="pill">الإغلاق: ${UI.fmtDateShort(DB.gw(gw).deadline)}</span>`}</h3>
        ${fx.map(f=>`
          <div class="fx" style="flex-direction:column;align-items:stretch">
            <div class="row" style="width:100%">
              <div class="team">${UI.crest(f.h)} ${DB.club(f.h).name}</div>
              <div class="score ${f.status==='L'?'live':''}">${f.status!=='U'? f.hs+' - '+f.as : '<span class="t">'+UI.fmtDateShort(f.date)+'</span>ضد'}
                ${f.status==='L'?`<span class="t">${f.live.min}'</span>`:''}</div>
              <div class="team a">${UI.crest(f.a)} ${DB.club(f.a).name}</div>
            </div>
            ${f.goals&&f.goals.length? `<div style="margin-top:6px">${f.goals.map(g=>`<div class="goal-line">${g.min}' ${esc(g.scorer)}${g.og?' (هدف عكسي)':''} (${DB.club(g.club).short})${g.assist?` — صناعة ${esc(g.assist)}`:''}${g.pen?' (ركلة جزاء)':''}</div>`).join('')}</div>`:''}
            <div class="tiny" style="margin-top:4px">${esc(f.venue)} ${f.est?'<span class="pill gold">نتيجة تقديرية</span>':''}</div>
          </div>`).join('')}
      </div>
      <div class="card"><h3>صعوبة المباريات القادمة (لكل نادٍ)</h3>
        <div class="scroll-x"><table class="tbl"><tr><th>النادي</th><th colspan="5">المباريات الخمس القادمة</th></tr>${fdrGrid}</table></div>
        <div class="row" style="gap:6px;margin-top:10px;flex-wrap:wrap">
          <span class="fdr l1">سهلة جداً</span><span class="fdr l2">سهلة</span><span class="fdr l3">متوسطة</span><span class="fdr l4">صعبة</span><span class="fdr l5">صعبة جداً</span>
        </div>
      </div>
    </div>`;
  },

  /* ======================= المركز المباشر ======================= */
  live(){
    const st=DB.state;
    const liveG=st.gws.find(g=>g.status==='live');
    const gw=liveG? liveG.n : st.currentGW;
    const fx=st.fixtures.filter(f=>f.gw===gw);
    const anyLive=fx.some(f=>f.status==='L');
    const team=DB.myTeam();
    let myLive='';
    if(team && team.squad.length && (liveG||team.gwPicks[gw])){
      if(!team.gwPicks[gw]) GWADMIN.snapshotPicks(team,gw);
      const res=TEAM.gwPoints(team,gw,st);
      myLive=`<div class="card" style="margin-bottom:14px;border-color:var(--accent)">
        <div class="row spread"><h3 style="margin:0">نقاطي المباشرة — الجولة ${gw}</h3>
        <div class="v" style="font-size:1.8rem;font-weight:800;color:var(--accent)">${res.total}</div></div>
        <div class="tiny">الكابتن: ${esc(res.capName)} · نقاط الدكة: ${res.benchPts}</div></div>`;
    }
    return `<h2 style="margin-bottom:12px">المركز المباشر ${anyLive?'<span class="pill red">● جارٍ الآن</span>':''}</h2>
    ${myLive}
    ${!anyLive && !fx.some(f=>f.status==='F') ? `<div class="card"><div class="muted">لا توجد مباريات منتهية بهذه الجولة بعد — النتائج تُعتمد من الواقع وتظهر هنا أول ما تُدخل من الإدارة.</div></div>`:''}
    <div class="grid g2">
    ${fx.map(f=>`
      <div class="card">
        <div class="row" style="width:100%">
          <div class="team" style="flex:1;font-weight:700">${UI.crest(f.h,'lg')} ${DB.club(f.h).name}</div>
          <div class="score ${f.status==='L'?'live':''}" style="font-size:1.3rem;min-width:88px">
            ${f.status!=='U'? f.hs+' - '+f.as : 'ضد'}
            <span class="t">${f.status==='L'? f.live.min+"'" : f.status==='F'?'انتهت':UI.fmtDateShort(f.date)}</span></div>
          <div class="team a" style="flex:1;font-weight:700">${UI.crest(f.a,'lg')} ${DB.club(f.a).name}</div>
        </div>
        ${f.goals&&f.goals.length?`<div style="margin-top:8px">${f.goals.map(g=>`<div class="goal-line">${g.min}' ${esc(g.scorer)}${g.pen?' (ج)':''}${g.og?' (عكسي)':''} <span class="tiny">(${DB.club(g.club).short})${g.assist?' — صناعة '+esc(g.assist):''}</span></div>`).join('')}</div>`:''}
        ${f.status==='L'&&f.live.events.length? `<div style="margin-top:8px;max-height:150px;overflow:auto;border-top:1px solid var(--line);padding-top:6px">
          ${[...f.live.events].reverse().slice(0,10).map(e=>`<div class="goal-line">${e.min}' ${esc(e.text)}</div>`).join('')}</div>`:''}
        ${f.status!=='U'? `<div class="tiny" style="margin-top:6px">${(f.hs===0)?UI.crest(f.a)+' شباك نظيفة حتى الآن · ':''}${(f.as===0)?UI.crest(f.h)+' شباك نظيفة حتى الآن':''}</div>`:''}
      </div>`).join('')}
    </div>`;
  },

  /* ======================= الدوريات ======================= */
  leagues(){
    const st=DB.state, m=DB.me();
    if(this.ui.leagueOpen){
      const lg=st.leagues.find(l=>l.id===this.ui.leagueOpen);
      if(lg) return this.leagueDetail(lg);
    }
    const mine=LEAGUES.mine();
    return `<div class="row spread" style="margin-bottom:12px;flex-wrap:wrap;gap:8px">
      <h2>الدوريات</h2>
      <div class="row" style="gap:8px">
        <button class="btn sm" onclick="VIEWS.leagueCreateModal()">+ إنشاء دوري</button>
        <button class="btn sm sec" onclick="VIEWS.leagueJoinModal()">الانضمام برمز</button>
      </div></div>
    <div class="grid g2">
      ${mine.map(l=>{
        const rows=LEAGUES.table(l);
        const myIdx=rows.findIndex(r=>r.id===m.id);
        return `<div class="card" style="cursor:pointer" onclick="VIEWS.ui.leagueOpen='${l.id}';APP.render()">
          <div class="row spread"><h3 style="margin:0">${esc(l.name)}</h3>
          <span class="pill">${(l.global? RANKS.population(st) : rows.length).toLocaleString('ar')} فريق</span></div>
          <div class="muted" style="margin-top:8px">مركزك: <b style="color:var(--accent)">${l.global? (()=>{const t=DB.myTeam();const or_=RANKS.overallRank(st,TEAM.totalPoints(t));return typeof or_.rank==='number'?or_.rank.toLocaleString('ar'):'—';})() : myIdx>=0? myIdx+1:'—'}</b>
          ${!l.global? `· الرمز: <b>${l.code}</b>`:''}</div>
        </div>`;}).join('')}
    </div>`;
  },
  leagueDetail(lg){
    const st=DB.state, m=DB.me();
    const rows= lg.global? this.globalTable() : LEAGUES.table(lg);
    const isH2H=lg.type==='h2h';
    return `<button class="btn sm sec" onclick="VIEWS.ui.leagueOpen=null;APP.render()" style="margin-bottom:12px">→ كل الدوريات</button>
    <div class="card">
      <div class="row spread" style="flex-wrap:wrap;gap:8px">
        <h2 style="margin:0">${esc(lg.name)}</h2>
        ${!lg.global? `<div class="row" style="gap:8px">
          <span class="pill blue">رمز الدعوة: <b style="letter-spacing:2px">${lg.code}</b></span>
          <button class="btn sm sec" onclick="navigator.clipboard&&navigator.clipboard.writeText('${lg.code}');UI.toast('نُسخ الرمز — أرسله لأصحابك')">نسخ</button>
          ${lg.owner===m.id? `<button class="btn sm sec" onclick="VIEWS.leagueAddBots('${lg.id}')">+ منافسون تجريبيون</button>`:''}
        </div>`:''}
      </div>
      <div class="scroll-x" style="margin-top:12px"><table class="tbl">
        <tr><th>#</th><th>المدير</th><th>الفريق</th>${isH2H?'<th>ف/ت/خ</th><th>ن. المواجهات</th>':''}<th>آخر جولة</th><th>المجموع</th></tr>
        ${rows.map((r,i)=>`<tr style="${r.id===m.id?'background:color-mix(in srgb,var(--accent) 10%,transparent)':''}">
          <td class="num">${i+1}</td><td>${esc(r.name)} ${r.id===m.id?'<span class="pill green">أنت</span>':''}</td>
          <td class="muted">${esc(r.teamName)}</td>
          ${isH2H?`<td class="tiny">${r.w||0}/${r.d||0}/${r.l||0}</td><td class="num">${r.h2hPts||0}</td>`:''}
          <td>${r.last}</td><td class="num" style="color:var(--accent)">${r.total}</td></tr>`).join('')}
      </table></div>
    </div>`;
  },
  globalTable(){
    const st=DB.state, m=DB.me();
    const rows=[];
    st.users.forEach(u=>{
      const team=st.teams[u.id]; if(!team) return;
      const hist=team.history||[];
      rows.push({id:u.id,name:u.username,teamName:u.teamName,total:hist.reduce((s,h)=>s+h.pts,0),last:hist.length?hist[hist.length-1].pts:0,isBot:false});
    });
    rows.sort((a,b)=>b.total-a.total);
    return rows;
  },
  leagueCreateModal(){
    UI.modal(`<h3>إنشاء دوري خاص</h3>
      <div class="field"><label>اسم الدوري</label><input id="lg_name" placeholder="مثال: ديوانية الخميس"></div>
      <div class="field"><label>النوع</label><select id="lg_type">
        <option value="classic">كلاسيكي (مجموع النقاط)</option>
        <option value="h2h">مواجهات مباشرة (H2H)</option></select></div>
      <button class="btn" style="width:100%" onclick="VIEWS.leagueCreate()">إنشاء</button>`);
  },
  leagueCreate(){
    const name=gv('lg_name'); if(!name){UI.toast('اكتب اسماً',true);return;}
    const lg=LEAGUES.create(name, gv('lg_type'));
    UI.closeModal();
    UI.modal(`<h3>أُنشئ الدوري!</h3><p class="muted">شارك هذا الرمز مع أصحابك للانضمام:</p>
      <h2 style="text-align:center;letter-spacing:8px;margin:16px 0">${lg.code}</h2>
      <button class="btn" style="width:100%" onclick="UI.closeModal();VIEWS.ui.leagueOpen='${lg.id}';APP.go('leagues')">فتح الدوري</button>`);
  },
  leagueJoinModal(){
    UI.modal(`<h3>الانضمام لدوري</h3>
      <div class="field"><label>رمز الدعوة</label><input id="lg_code" placeholder="مثال: A3X9KM" style="letter-spacing:3px"></div>
      <button class="btn" style="width:100%" onclick="VIEWS.leagueJoin()">انضمام</button>`);
  },
  leagueJoin(){
    const r=LEAGUES.join(gv('lg_code'));
    if(r.ok){ UI.closeModal(); UI.toast('انضممت للدوري '); this.ui.leagueOpen=r.lg.id; APP.go('leagues'); }
    else UI.toast(r.err,true);
  },
  leagueAddBots(id){
    const lg=DB.state.leagues.find(l=>l.id===id);
    LEAGUES.addBots(lg,5);
    UI.toast('أُضيف 5 منافسين تجريبيين'); APP.render();
  },

  /* ======================= الإحصائيات ======================= */
  stats(){
    const st=DB.state;
    const t=this.ui.statsTab;
    const tabs=[['transfers','الأكثر انتقالاً'],['owned','الأكثر تملكاً'],['in','الأكثر شراءً'],['out','الأكثر بيعاً'],['top','الهدافون والصناع'],
      ['value','أفضل قيمة'],['pos','حسب المركز'],['form','الفورمة']];
    const players=st.players.filter(p=>p.status!=='u');
    let body='';
    const tbl=(headers,rows)=>`<div class="scroll-x"><table class="tbl"><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr>${rows}</table></div>`;
    const prow=(p,extra)=>`<tr onclick="VIEWS.openPlayer('${p.id}')" style="cursor:pointer">
      <td><div class="row">${UI.playerAvatar(p,28)}<div><b>${esc(p.name)}</b><div class="tiny">${DB.club(p.club).short} · ${POS_AR[p.pos]} · ${fmtM(p.price)}</div></div></div></td>${extra}</tr>`;
    if(t==='transfers'){ body=this.transfersTab(); }
    else if(t==='owned'){
      const list=[...players].sort((a,b)=>MARKET.ownership(b.id)-MARKET.ownership(a.id)).slice(0,20);
      body=tbl(['اللاعب','التملّك','النقاط'], list.map(p=>prow(p,`<td style="min-width:160px">${UI.bar(MARKET.ownership(p.id))} <span class="tiny">${MARKET.ownership(p.id)}%</span></td><td class="num" style="color:var(--accent)">${DB.playerTotal(p.id)}</td>`)).join(''));
    } else if(t==='in'||t==='out'){
      const list=[...players].sort((a,b)=>MARKET.transferCounts(b.id)[t]-MARKET.transferCounts(a.id)[t]).slice(0,20);
      body=tbl(['اللاعب', t==='in'?'شراء هذه الجولة':'بيع هذه الجولة','النقاط'], list.map(p=>prow(p,`<td class="num">${MARKET.transferCounts(p.id)[t].toLocaleString('ar')}</td><td class="num" style="color:var(--accent)">${DB.playerTotal(p.id)}</td>`)).join(''));
    } else if(t==='top'){
      const sc=[...players].sort((a,b)=>DB.playerStatSum(b.id,'g')-DB.playerStatSum(a.id,'g')).slice(0,10);
      const as=[...players].sort((a,b)=>DB.playerStatSum(b.id,'a')-DB.playerStatSum(a.id,'a')).slice(0,10);
      body=`<div class="grid g2"><div><h3>الهدافون</h3>${tbl(['اللاعب','أهداف'],sc.map(p=>prow(p,`<td class="num">${DB.playerStatSum(p.id,'g')}</td>`)).join(''))}</div>
      <div><h3>الصنّاع</h3>${tbl(['اللاعب','صناعة'],as.map(p=>prow(p,`<td class="num">${DB.playerStatSum(p.id,'a')}</td>`)).join(''))}</div></div>`;
    } else if(t==='value'){
      const list=[...players].filter(p=>DB.playerTotal(p.id)>0).sort((a,b)=>DB.playerTotal(b.id)/b.price-DB.playerTotal(a.id)/a.price).slice(0,20);
      body=tbl(['اللاعب','نقاط/مليون','النقاط'],list.map(p=>prow(p,`<td class="num">${(DB.playerTotal(p.id)/p.price).toFixed(2)}</td><td class="num" style="color:var(--accent)">${DB.playerTotal(p.id)}</td>`)).join(''));
    } else if(t==='pos'){
      body=`<div class="grid g2">${['G','D','M','F'].map(pos=>{
        const list=players.filter(p=>p.pos===pos).sort((a,b)=>DB.playerTotal(b.id)-DB.playerTotal(a.id)).slice(0,8);
        return `<div><h3>${pos==='G'?'الحراس':pos==='D'?'المدافعون':pos==='M'?'الوسط':'المهاجمون'}</h3>
        ${tbl(['اللاعب','نقاط','متوسط/جولة'],list.map(p=>{const gp=Object.keys(DB.state.playerGW[p.id]||{}).length;return prow(p,`<td class="num" style="color:var(--accent)">${DB.playerTotal(p.id)}</td><td class="num">${gp?(DB.playerTotal(p.id)/gp).toFixed(1):0}</td>`);}).join(''))}</div>`;}).join('')}</div>`;
    } else {
      const list=[...players].sort((a,b)=>DB.playerForm(b.id)-DB.playerForm(a.id)).slice(0,20);
      body=tbl(['اللاعب','الفورمة','النقاط'],list.map(p=>prow(p,`<td style="min-width:150px">${UI.bar(DB.playerForm(p.id)*10,'var(--gold)')} <span class="tiny">${DB.playerForm(p.id).toFixed(1)}</span></td><td class="num" style="color:var(--accent)">${DB.playerTotal(p.id)}</td>`)).join(''));
    }
    return `<h2 style="margin-bottom:12px">الإحصائيات والتحليلات</h2>
    <div class="tabs">${tabs.map(([id,l])=>`<button class="${t===id?'active':''}" onclick="VIEWS.ui.statsTab='${id}';APP.render()">${l}</button>`).join('')}</div>
    <div class="card">${body}</div>`;
  },

  /* ======================= الملف الشخصي ======================= */
  profile(){
    const m=DB.me(); const team=DB.myTeam();
    
    return `<h2 style="margin-bottom:12px">الملف الشخصي</h2>
    <div class="grid g2">
      <div class="card"><h3>البيانات</h3>
        <div class="field"><label>اسم المستخدم</label><input id="pr_user" value="${esc(m.username)}"></div>
        <div class="field"><label>اسم الفريق</label><input id="pr_team" value="${esc(m.teamName)}"></div>
        <button class="btn" onclick="VIEWS.saveProfile()">حفظ</button>
      </div>
      ${REMIND.card()}
      <div class="card"><h3>الحساب</h3>
        <div class="muted">وضع محلي بدون تسجيل دخول — كل شيء محفوظ على هذا الجهاز</div>
        <div class="muted" style="margin:6px 0">انضممت في الجولة ${team.joinedGW}</div>
        <div class="row" style="gap:8px;margin-top:14px;flex-wrap:wrap">
        </div>
        <div style="margin-top:18px;border-top:1px solid var(--line);padding-top:12px">
          <button class="btn danger sm" onclick="VIEWS.wipeTeam()">حذف فريقي والبدء من جديد</button>
        </div>
      </div>
    </div>`;
  },
  setAvatar(a){ DB.me().avatar=a; DB.save(); APP.render(); },
  saveProfile(){
    const m=DB.me();
    const u=gv('pr_user'), t=gv('pr_team');
    if(u) m.username=u; if(t) m.teamName=t;
    DB.save(); UI.toast('تم الحفظ'); APP.render();
  },
  wipeTeam(){
    UI.modal(`<h3>تأكيد</h3><p class="muted">سيُحذف فريقك وتاريخ نقاطك وتبدأ من جديد بميزانية كاملة. متأكد؟</p>
      <div class="row" style="gap:8px;margin-top:12px"><button class="btn danger" onclick="VIEWS.doWipe()">نعم، احذف</button>
      <button class="btn sec" onclick="UI.closeModal()">إلغاء</button></div>`);
  },
  doWipe(){
    const st=DB.state; const m=DB.me();
    st.teams[m.id]={ squad:[],xi:[],bench:[],cap:null,vice:null,bank:st.rules.budget,ft:1,
      usedChips:{},activeChip:null,joinedGW:st.currentGW,history:[],transfers:[],gwPicks:{},pendingHits:0 };
    DB.save(); UI.closeModal(); APP.go('team');
  },
};

function gv(id){ const el=document.getElementById(id); return el? el.value:''; }
