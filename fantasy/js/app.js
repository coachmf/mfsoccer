/* هيكل التطبيق: التوجيه، الشريط العلوي، الإشعارات */
'use strict';

const APP = {
  route:'dashboard',
  NAV: [
    ['dashboard','home','الرئيسية'], ['team','shirt','فريقي'],
    ['players','users','اللاعبون'], ['fixtures','cal','المباريات'],
    ['leagues','trophy','الدوريات'], ['stats','stats','إحصائيات'], ['guide','news','عن اللعبة'],
  ],

  cloudState:'init',     // init | ready | offline | nogame

  init(){
    DB.load();
    if(!DB.me()) AUTH.guest();
    ADMINAUTH.sync();
    this.initCloud();
    document.documentElement.setAttribute('data-theme','light');
    window.addEventListener('hashchange',()=>{
      const r=location.hash.slice(1)||'dashboard';
      if(r!==this.route){ this.route=r; this.render(); }
    });
    this.route=location.hash.slice(1)||'dashboard';
    this.checkDeadline();
    this.render();
    setInterval(()=>this.tickCountdown(),30000);
    setInterval(()=>REMIND.check(),60000);
    REMIND.check();
    // نشر جولة أو احتسابها على الخادم يصل للأجهزة المفتوحة بلا إعادة تحميل
    setInterval(()=>this.pollCloud(), 5*60000);
    document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) this.pollCloud(); });
    // شاشة الافتتاح
    const splash=document.getElementById('splash');
    if(splash) setTimeout(()=>{ splash.classList.add('hide'); setTimeout(()=>splash.remove(),700); }, 900);
  },

  /* ---------- السحابة ---------- */
  /* حالة اللعبة (جولات، مباريات، إحصاءات، نقاط) يقرؤها كل زائر من السحابة،
     فتصل النتائج تلقائياً بلا أن يضغط أحد شيئاً. والحساب يتبع صاحبه. */
  initCloud(){
    if(typeof CLOUD==='undefined' || !CLOUD.init()){
      this.cloudState='offline';
      if(typeof MFSYNC!=='undefined') MFSYNC.autoFixtures(true);   // الجدول والنتائج من mfsoccer حتى بلا سحابة
      return;
    }
    CLOUD.onAuth(async (u)=>{
      // أثناء التسجيل ينتظر المستمع حتى يكتب signup اسم المستخدم واسم الفريق أولاً
      while(CLOUD.signingUp) await new Promise(r=>setTimeout(r,150));
      DB.muted = true;                       // لا نرفع أثناء تبديل الحساب
      try{
        // حالة اللعبة ومستند المشترك مستقلان: نقرؤهما معاً بدل التتابع
        const [h, doc0] = await Promise.all([DB.hydrate(), u? CLOUD.getManager(u.uid) : Promise.resolve(null)]);
        this.cloudState = h.ok ? 'ready' : (h.err==='no-game' ? 'nogame' : 'offline');
        if(u){
          let doc = doc0;
          let fresh=false;
          if(!doc){
            // حساب جديد (غالباً Google): اسم مبدئي من الحساب، ويُطلب من المشترك إكمال اسمه واسم فريقه
            const base=(u.displayName||'').trim() || (u.email||'مشترك').split('@')[0];
            doc = await CLOUD.createManager(u.uid, base, 'فريق '+base.split(' ')[0], u.email||'');
            fresh=!!doc;
          }
          this.freshAccount = fresh;
          if(!doc){                       // تعذّرت الكتابة: نكمل بملف مؤقت بدل التعليق
            doc = {username:(u.email||'مشترك').split('@')[0], teamName:'فريقي', email:u.email||'',
                   team:null, history:[], total:0};
            UI.toast('تعذّر الوصول لبياناتك على الخادم — تحقق من الشبكة', true);
          }
          await DB.adoptManager(u.uid, doc);
          const me=DB.me(); if(me) me.verified = !!u.emailVerified;
        }else{
          DB.state.session=null;
          AUTH.guest();                      // تصفّح بلا حساب: فريق محلي للتجربة
        }
      }catch(e){ console.warn('cloud sync failed', e); this.cloudState='offline'; }
      DB.muted = false;
      if(DB.pendingPush){ DB.pendingPush=false; DB.pushTeam(); }   // فريق الضيف المرحَّل يُرفع للحساب
      ADMINAUTH.sync();
      if(u && this.route==='auth') this.route='dashboard';
      this.render();
      if(this.freshAccount){ this.freshAccount=false; setTimeout(()=>VIEWS.completeProfile(), 400); }
      // الجدول والنتائج من mfsoccer على كل جهاز عند كل تحميل؛ الكشوفات للمدير فقط (تُنشر مع اللعبة)
      if(typeof MFSYNC!=='undefined') MFSYNC.autoFixtures(true);
      if(CLOUD.admin && typeof ROSTER!=='undefined') ROSTER.auto();
      if(CLOUD.admin) this.autoOwnership();
    });
  },

  /* نسبة التملّك تتغيّر كلما انضم مشترك أو بدّل لاعباً، بينما لا تُنشر إلا مع الاحتساب.
     فكلما فتح المدير اللعبة تُحدَّث وتُنشر تلقائياً إن مضى على آخر تحديث أكثر من 3 ساعات. */
  async autoOwnership(){
    if(typeof CLOUD==='undefined' || !CLOUD.admin || this.cloudState!=='ready') return;
    const last = Date.parse(DB.state.ownUpdated||'') || 0;
    if(Date.now() - last < 3*3600*1000) return;
    try{
      const r = await CLOUD.publishOwnership(DB.state);
      if(r.ok){ DB.save(); if(this.route==='players' || this.route==='stats' || this.route==='player') this.render(); }
    }catch(e){ console.warn('ownership refresh failed', e); }
  },

  /* هل نُشرت جولة جديدة أو احتُسبت؟ */
  async pollCloud(){
    if(this.cloudState!=='ready' || (typeof DB!=='undefined' && DB.muted)) return;
    if(typeof CLOUD!=='undefined' && !CLOUD.user) return;   /* بلا دخول: لا نعيد رسم شاشة الدخول فنمسح ما يكتبه المستخدم */
    try{
      const changed = await DB.refreshFromCloud();
      if(changed){ ADMINAUTH.sync(); this.render(); if(typeof MFSYNC!=='undefined') MFSYNC.autoFixtures(true); }
    }catch(e){ console.warn('poll failed', e); }
  },

  /* هل المشترك داخل بحساب سحابي حقيقي؟ */
  signedIn(){ return typeof CLOUD!=='undefined' && !!CLOUD.user; },

  /* شريط ينبّه أن الفريق محلي غير محفوظ على الخادم */
  guestBanner(){
    if(this.signedIn() || this.cloudState==='init') return '';
    if(this.cloudState==='offline')
      return `<div class="card" style="border-color:#e0a800;margin-bottom:12px">
        <b>وضع بلا اتصال</b>
        <div class="tiny" style="margin-top:6px">تعذّر الوصول للخادم، فما تشوفه محفوظ على هذا الجهاز فقط.
        نقاطك وترتيبك يحتاجان اتصالاً.</div></div>`;
    return `<div class="card" style="border-color:var(--accent);margin-bottom:12px">
      <b>أنت تتصفح بلا حساب</b>
      <div class="tiny" style="margin-top:6px">الفريق الذي تكوّنه الآن محفوظ على هذا الجهاز فقط،
      ولن تُحتسب له نقاط ولا يدخل الترتيب. أنشئ حساباً ليُحفظ ويُنافس.</div>
      <div style="margin-top:10px"><button class="btn sm" onclick="APP.go('auth')">إنشاء حساب أو دخول</button></div>
    </div>`;
  },

  go(route){ this.route=route; location.hash=route; this.render(); window.scrollTo(0,0); },

  toggleTheme(){
    const cur=document.documentElement.getAttribute('data-theme')==='light'?'dark':'light';
    if(cur==='light') document.documentElement.setAttribute('data-theme','light');
    else document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('kwf_theme',cur==='light'?'light':'');
    this.render();
  },

  checkDeadline(){
    const st=DB.state; const m=DB.me();
    if(!m) return;
    const g=DB.gw(st.currentGW);
    if(!g || !g.deadline) return;          // جولة بلا جدول بعد: لا موعد ولا قفل
    const ms=new Date(g.deadline)-new Date();
    // تذكير قبل الإغلاق بيوم
    if(ms>0 && ms<86400000){
      const key='dl'+st.currentGW;
      const has=(st.notifications[m.id]||[]).some(n=>n.type===key);
      if(!has){ NOTIF.push(m.id,key,`تذكير: تُغلق الجولة ${st.currentGW} بعد ${UI.countdown(g.deadline)}`); DB.save(); }
    }
    // قفل التشكيلة عند تجاوز الموعد
    const team=DB.myTeam();
    if(team && team.squad.length && GWADMIN.deadlinePassed(st.currentGW) && !team.gwPicks[st.currentGW]){
      GWADMIN.snapshotPicks(team, st.currentGW);
      DB.save();
    }
  },

  /* لا نعيد الرسم كل 30ث (يومض ويمسح الإدخال). موعد الإغلاق تاريخ ثابت،
     فنعيد الرسم فقط عند مرور الموعد فعلاً (تغيّر حالة القفل). */
  tickCountdown(){
    if(!['dashboard','team','transfers'].includes(this.route)) return;
    let locked=false;
    try{ locked=GWADMIN.deadlinePassed(DB.state.currentGW); }catch(e){ return; }
    if(this._lastLocked===undefined){ this._lastLocked=locked; return; }
    if(locked!==this._lastLocked){ this._lastLocked=locked; this.render(); }
  },
  onLiveTick(){ if(this.route==='live') this.render(); },

  render(){
    if(!DB.me()) AUTH.guest();   // بدون تسجيل دخول — حساب محلي تلقائي
    const m=DB.me();
    const main=document.getElementById('main');
    document.getElementById('topbar').style.display='flex';
    document.getElementById('bottomnav').style.display='';
    this.checkDeadline();
    this.renderTopbar();
    let html='';
    const r=this.route;
    // الحساب إلزامي: بلا دخول لا تُعرض إلا صفحة الدخول (وعن اللعبة/المطوّر للاطلاع)
    const cloudOn = typeof CLOUD!=='undefined' && CLOUD.ready && this.cloudState!=='offline';
    // مشترك سبق دخوله على هذا الجهاز: نرسم فريقه من نسخة الجهاز فوراً أثناء الاتصال بدل «جارٍ الاتصال…»
    const cachedSession = this.cloudState==='init' && DB.state.session && DB.state.session!=='u1local' && DB.state.teams[DB.state.session];
    const needAuth = cloudOn && !CLOUD.user && !cachedSession && !['guide','about'].includes(r);
    try{
      if(needAuth){ html = this.cloudState==='init' ? '<div class="card" style="text-align:center;padding:30px"><div class="muted">جارٍ الاتصال…</div></div>' : VIEWS.auth(); }
      else if(r==='team') html=VIEWS.team();
      else if(r==='transfers'){ VIEWS.ui.teamView='market'; this.route='team'; html=VIEWS.team(); }
      else if(r==='players') html=VIEWS.players();
      else if(r==='player') html=VIEWS.player();
      else if(r==='fixtures') html=VIEWS.fixtures();
      else if(r==='live') html=VIEWS.live();
      else if(r==='leagues') html=VIEWS.leagues();
      else if(r==='stats') html=VIEWS.stats();
      else if(r==='points') html=VIEWS.points();
      else if(r==='profile') html=VIEWS.profile();
      else if(r==='compare') html=VIEWS.compare();
      else if(r==='champions') html=VIEWS.champions();
      else if(r==='about') html=VIEWS.about();
      else if(r==='guide') html=VIEWS.guide();
      else if(r==='admin') html=ADMIN.view();
      else html=VIEWS.dashboard();
    }catch(e){
      console.error(e);
      html=`<div class="card" style="border-color:var(--red)"><h3>حدث خطأ</h3><div class="tiny">${esc(e.message)}</div>
        <button class="btn sm sec" style="margin-top:10px" onclick="APP.go('dashboard')">العودة للرئيسية</button></div>`;
    }
    /* الحركة عند تغيّر الصفحة فقط، لا عند كل إعادة رسم (تحديث/مزامنة) */
    const anim = this._shownRoute !== this.route;
    this._shownRoute = this.route;
    main.innerHTML=`<div class="view${anim?' anim':''}">${html}</div>`;
    this.renderBottomNav();
  },

  renderTopbar(){
    const m=DB.me();
    const nav=document.getElementById('navlinks');
    nav.innerHTML=this.NAV.map(([id,ic,l])=>
      `<button class="${this.route===id?'active':''}" onclick="APP.go('${id}')">${l}</button>`).join('')
      + (ADMINAUTH.active()? `<button class="${this.route==='admin'?'active':''}" onclick="APP.go('admin')">الإدارة</button>`:'');
    const unread=NOTIF.unread();
    document.getElementById('topActions').innerHTML=`
      <button class="iconbtn" title="الإشعارات" onclick="APP.toggleNotif()">${UI.icon('bell',18)}${unread?`<span class="dot">${unread}</span>`:''}</button>
      <div id="userchip" onclick="APP.go('profile')"><div class="av">${UI.icon('users',15)}</div><span class="uc-name">${esc(m.username)}</span></div>`;
  },
  renderBottomNav(){
    const m=DB.me(); if(!m) return;
    const items=[['dashboard','home','الرئيسية'],['team','shirt','فريقي'],['players','users','اللاعبون'],['leagues','trophy','دوريات'],['guide','news','عن اللعبة']];
    if(ADMINAUTH.active()) items.push(['admin','gear','إدارة']);
    document.getElementById('bottomnav').innerHTML=items.map(([id,ic,l])=>
      `<button class="${this.route===id?'active':''}" onclick="APP.go('${id}')"><span class="ic">${UI.icon(ic,21)}</span>${l}</button>`).join('');
  },

  toggleNotif(){
    const ex=document.getElementById('notifPanel');
    if(ex){ ex.remove(); return; }
    const list=NOTIF.mine();
    const panel=document.createElement('div');
    panel.id='notifPanel';
    panel.innerHTML=`<div class="row spread" style="padding:6px 8px"><b>الإشعارات</b>
      <button class="btn sm sec" onclick="NOTIF.markAll();APP.render();document.getElementById('notifPanel')?.remove()">تمييز الكل كمقروء</button></div>
      ${list.length? list.map(n=>`<div class="notif-item ${n.read?'':'unread'}">${esc(n.text)}
        <div class="ts">${UI.fmtDateShort(n.ts)}</div></div>`).join('') : '<div class="muted" style="padding:14px">لا إشعارات بعد</div>'}`;
    document.body.appendChild(panel);
  },
};

document.addEventListener('DOMContentLoaded',()=>APP.init());
