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
    this.applyTheme(this.savedTheme());
    window.addEventListener('hashchange',()=>{
      const r=location.hash.slice(1)||'dashboard';
      if(r!==this.route){ this.leavePage(r); this.route=r; this.render(); }
    });
    this.route=location.hash.slice(1)||'dashboard';
    this.checkDeadline();
    this.render();
    setInterval(()=>this.tickCountdown(),30000);
    setInterval(()=>REMIND.check(),60000);
    REMIND.check();
    /* تجديد رمز FCM بصمت — المتصفح يُبطله دورياً */
    try{ PUSH.refresh(); }catch(e){}
    // نشر جولة أو احتسابها على الخادم يصل للأجهزة المفتوحة بلا إعادة تحميل
    setInterval(()=>this.pollCloud(), 5*60000);
    document.addEventListener('visibilitychange', ()=>{
      if(document.hidden){ this._hiddenAt=Date.now(); return; }
      this.pollCloud(); this.retryCloud();
      if(this._verPending){ this.applyUpdate(); }
      else if(Date.now()-(this._hiddenAt||0) > 60000) this.checkVersion('resume');   // رجع للتطبيق من الخلفية: نسخة جديدة؟
    });
    this.initVersionWatch();
    // وضع بلا اتصال لا يبقى للأبد: كل 20 ثانية نجرّب الخادم، وأول ما يرد نعيد التحميل فتصل الجولة واللاعبون الجدد
    setInterval(()=>this.retryCloud(), 20000);
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
    try{ CLOUD.auth.getRedirectResult().then(r=>{ if(r && r.user) setTimeout(()=>{ if(!APP.authSynced) location.reload(); }, 9000); }).catch(()=>{}); }catch(e){}
    CLOUD.onAuth(async (u)=>{
      // أثناء التسجيل ينتظر المستمع حتى يكتب signup اسم المستخدم واسم الفريق أولاً
      while(CLOUD.signingUp) await new Promise(r=>setTimeout(r,150));
      DB.muted = true; clearTimeout(DB._pushT);   // لا نرفع أثناء تبديل الحساب
      try{
        // حالة اللعبة ومستند المشترك مستقلان: نقرؤهما معاً بدل التتابع.
        // مهلة: إن علّق الخادم (قناة Firestore مخنوقة/شبكة رديئة) لا نترك المشترك على «جارٍ تحميل فريقك…» بلا نهاية —
        // نعرض آخر نسخة محفوظة على الجهاز ونكمل المزامنة في الخلفية أول ما ترد.
        const loadP = Promise.all([DB.hydrate(), u? CLOUD.getManager(u.uid) : Promise.resolve(null)]);
        let slowFired = 0;
        /* شبكة الجوال البطيئة (2026-10-09، يوم الديدلاين): التحميل الأول يتجاوز 12ث فكان يظهر «تعذّر الاتصال» ثم تعيد
           retryCloud تحميل الصفحة فتقطع التحميل الجاري — حلقة. الآن: من له نسخة على الجهاز نعرضها بعد 12ث كالسابق،
           ومن لا نسخة له يبقى على «جارٍ الاتصال… الشبكة بطيئة» حتى 45ث قبل شاشة الاتصال، ولا إعادة تحميل أثناء التحميل */
        this._loading = true;
        const goOffline = cached => {
          if(!DB.muted) return;
          slowFired = Date.now(); this._loading = false;
          DB.muted = false;
          this.cloudState = cached ? 'ready' : 'offline';
          this.render();
          UI.toast(cached ? 'الاتصال بطيء — نعرض آخر نسخة محفوظة ونحاول في الخلفية' : 'تعذّر الوصول للخادم — اسحب الصفحة للأسفل أو أعد فتحها', !cached);
        };
        const slowT = setTimeout(()=>{
          const cached = DB.state.session && DB.state.session!=='u1local' && DB.state.teams[DB.state.session];
          if(cached) goOffline(true);
          else if(DB.muted){ this.slowLoad = true; this.render(); }
        }, 12000);
        const hardT = setTimeout(()=>goOffline(false), 45000);
        let [h, doc0] = await loadP;
        clearTimeout(slowT); clearTimeout(hardT); this._loading = false; this.slowLoad = false;
        if(slowFired && u){
          // عدّل المشترك فريقه أثناء الانتظار: نسخته أحدث من اللقطة القديمة — لا نطمسها، ونعيد القراءة من الخادم
          const d2 = await CLOUD.getManager(u.uid); if(d2) doc0 = d2;
          const localT = DB.state.session===u.uid && DB.state.teams[u.uid];
          if(doc0 && localT && (localT.squad||[]).length && DB.dirtyAt > slowFired){ doc0 = {...doc0, team: localT}; DB.pendingPush = true; }
        }
        DB.muted = true; clearTimeout(DB._pushT);
        this.cloudState = h.ok ? 'ready' : (h.err==='no-game' ? 'nogame' : 'offline');
        /* تعذّرت قراءة الملف من Firestore (قناة محجوبة/شبكة بطيئة): نجرّب عبر الخادم قبل الاستسلام لوضع «بلا اتصال» */
        if(u && doc0===undefined){
          const ps = CLOUD._pendingSignup;
          const lt = DB.state.teams && DB.state.teams[u.uid];
          const sm = await CLOUD.serverMe({ username: ps && ps.username, teamName: ps && ps.teamName, team: (lt && (lt.squad||[]).length) ? lt : null });
          if(sm){ doc0 = sm; if(ps) CLOUD._pendingSignup = null; if(!h.ok && DB.state.players && DB.state.players.length) this.cloudState = 'ready'; }
        }
        if(u && doc0===undefined){
          // فشلت قراءة ملف المشترك (شبكة): ليس حساباً جديداً — نبقي آخر نسخة محفوظة ولا نرفع شيئاً حتى تنجح قراءة
          DB.noPush = true; this.cloudState = 'offline';
          if(DB.state.session!==u.uid){
            if(!DB.state.users.find(x=>x.id===u.uid)) DB.state.users.push({id:u.uid, username:(u.email||'مشترك').split('@')[0], teamName:'فريقي', verified:true});
            if(!DB.state.teams[u.uid]) DB.state.teams[u.uid]={ squad:[],xi:[],bench:[],cap:null,vice:null,bank:DB.state.rules.budget,ft:DB.state.rules.freeTransfers,
              usedChips:{},activeChip:null,joinedGW:DB.state.currentGW,history:[],transfers:[],gwPicks:{},pendingHits:0 };
            DB.state.session=u.uid;
          }
          UI.toast('تعذّر الوصول لبياناتك على الخادم — نعرض آخر نسخة محفوظة، ولن يُرفع شيء حتى يعود الاتصال', true);
        } else if(u){
          let doc = doc0;
          let fresh=false;
          if(!doc){
            // حساب جديد (غالباً Google): اسم مبدئي من الحساب، ويُطلب من المشترك إكمال اسمه واسم فريقه
            const ps = CLOUD._pendingSignup && String(CLOUD._pendingSignup.email||'')===String(u.email||'').toLowerCase() ? CLOUD._pendingSignup : null;
            const base=(ps && ps.username) || (u.displayName||'').trim() || (u.email||'مشترك').split('@')[0];
            /* على الجهاز تشكيلة ولا ملف على الخادم: الإنشاء عبر الخادم أولاً مع التشكيلة — يقبلها حتى بعد الموعد لحساب أُنشئ قبله
               (الإنشاء من الجهاز بعد الموعد يُنشئ ملفاً بلا فريق ويضيع الفريق — 2026-10-09) */
            const lt = DB.state.teams && (DB.state.teams[u.uid] || DB.state.teams['u1local']);
            const tn0 = (ps && ps.teamName) || ('فريق '+base.split(' ')[0]);
            if(lt && (lt.squad||[]).length) doc = await CLOUD.serverMe({ username: base, teamName: tn0, team: lt });
            if(!doc) doc = await CLOUD.createManager(u.uid, base, tn0, u.email||'');
            if(!doc) doc = await CLOUD.serverMe({ username: base, teamName: tn0, team: (lt && (lt.squad||[]).length) ? lt : null });
            if(doc && ps) CLOUD._pendingSignup = null;
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
      }catch(e){ console.warn('cloud sync failed', e); this.cloudState='offline'; this.cloudErr=String(e&&e.message||e).slice(0,160); }
      DB.muted = false;
      if(DB.pendingPush){ DB.pendingPush=false; DB.pushTeam(); }   // فريق الضيف المرحَّل يُرفع للحساب
      ADMINAUTH.sync();
      if(u && this.route==='auth') this.route='dashboard';
      this.authSynced = !!u;
      this.render();
      if(this.freshAccount){ this.freshAccount=false; setTimeout(()=>VIEWS.completeProfile(), 400); }
      /* اسم افتراضي («مشترك» / «فريقي») على حساب مسجّل: لازم يغيّره قبل المتابعة (منصور 2026-10-09) */
      else if(u && this.cloudState!=='offline'){ const me=DB.me(); if(me && VIEWS.isDefaultName(me.username, me.teamName)) setTimeout(()=>VIEWS.completeProfile(true), 600); }
      /* فُتحت من لقطة CDN (قد تتأخر حتى دقيقتين عن النشر): تحقّق فوري من Firestore في الخلفية */
      if(DB.fromSnap){ DB.fromSnap=false; setTimeout(()=>this.pollCloud(), 2500); }
      // الجدول والنتائج من mfsoccer على كل جهاز عند كل تحميل؛ الكشوفات للمدير فقط (تُنشر مع اللعبة)
      if(typeof MFSYNC!=='undefined') MFSYNC.autoFixtures(true);
      if(CLOUD.admin && typeof ROSTER!=='undefined') ROSTER.auto();
      if(CLOUD.admin) this.autoOwnership();
    });
  },

  /* نسبة التملّك تتغيّر كلما انضم مشترك أو بدّل لاعباً، بينما لا تُنشر إلا مع الاحتساب.
     فكلما فتح المدير اللعبة تُحدَّث وتُنشر تلقائياً إن مضى على آخر تحديث أكثر من 3 ساعات. */
  /* التملّك ولقطة الترتيب العام: ينشرهما جهاز أي مدير تلقائياً كل ساعة ما دامت اللعبة مفتوحة (وعند الفتح إن مرّت ساعة) */
  OWN_EVERY: 1*3600*1000, _ownBusy:false,   /* كل ساعة من جديد (2026-10-09: خطة Blaze — قراءة المشتركين زهيدة، والعدد ودوريات المشجعين تبقى حديثة) */   /* كل 6 ساعات (كانت كل ساعة: قراءة كل المشتركين لكل جهاز مدير) — منصور 2026-09-30 */
  async autoOwnership(){
    if(typeof CLOUD==='undefined' || !CLOUD.admin || this.cloudState!=='ready' || this._ownBusy) return;
    const last = Date.parse(DB.state.ownUpdated||'') || 0;
    if(Date.now() - last < this.OWN_EVERY) return;
    this._ownBusy=true;
    try{
      const r = await CLOUD.publishOwnership(DB.state);
      if(r.ok){ DB.save(); if(['players','stats','player','leagues','dashboard'].includes(this.route)) this.render(); }
    }catch(e){ console.warn('ownership refresh failed', e); }
    this._ownBusy=false;
  },

  /* هل نُشرت جولة جديدة أو احتُسبت؟ */
  async pollCloud(){
    if(this.cloudState!=='ready' || (typeof DB!=='undefined' && DB.muted)) return;
    if(typeof CLOUD!=='undefined' && !CLOUD.user) return;   /* بلا دخول: لا نعيد رسم شاشة الدخول فنمسح ما يكتبه المستخدم */
    try{
      const changed = await DB.refreshFromCloud();
      if(changed){ ADMINAUTH.sync(); this.render(); if(typeof MFSYNC!=='undefined') MFSYNC.autoFixtures(true); }
    }catch(e){ console.warn('poll failed', e); }
    if(typeof CLOUD!=='undefined' && CLOUD.admin && !document.hidden) this.autoOwnership();   // كل 5 دقائق يتحقق: مرّت ساعة؟ ينشر
  },

  /* الجهاز في وضع بلا اتصال (تعذّر تحميل اللعبة أو علّق الخادم): نجرّب قراءة مستند اللعبة،
     فإن ردّ نعيد تحميل الصفحة لتكتمل المزامنة من البداية — بدل أن يبقى المشترك على جولة قديمة ولاعبين ناقصين */
  _retryBusy:false,
  async retryCloud(manual){
    if(this.cloudState!=='offline' || this._retryBusy || (!manual && document.hidden)) return;
    if(!manual && this._loading) return;   /* التحميل الأول ما زال جارياً على شبكة بطيئة: لا نقطعه بإعادة تحميل */
    if(typeof CLOUD==='undefined' || !CLOUD.ready){ if(manual) location.reload(); return; }
    /* توفير القراءات (حصة Firestore اليومية): تباعد متزايد 20ث → 40ث → … حتى 5 دقائق، وبعد بلوغ حد إعادة التحميل
       تتوقف المحاولات التلقائية تماماً (يبقى الزر) — جهاز عالق لا يستهلك قراءة كل 20 ثانية للأبد */
    if(!manual){
      if(this._retryStop || Date.now() < (this._retryNext||0)) return;
      this._retryGap = Math.min(300000, (this._retryGap||10000)*2);
      this._retryNext = Date.now() + this._retryGap;
    }
    this._retryBusy=true;
    try{
      const r = await CLOUD.race(CLOUD.root().get(), 10000);
      /* تعافت الصفحة أثناء الانتظار (اكتمل التحميل الأول): لا نعيد تحميلها فوق شاشة الدخول وما كتبه المشترك —
         كان هذا يُرجع «تعذّر الاتصال» بعد دقيقة من الفتح (محمد القلاف 2026-10-09) */
      if(this.cloudState!=='offline'){ this._retryBusy=false; return; }
      if(r.ok && r.v && r.v.exists){
        /* حماية من حلقة إعادة تحميل لو ردّ الخادم وفشلت المزامنة لسبب آخر: 3 مرات تلقائية كحد أقصى كل 10 دقائق */
        let log=[]; try{ log=JSON.parse(sessionStorage.getItem('kwf_retry')||'[]').filter(t=>Date.now()-t<600000); }catch(e){}
        if(manual || log.length<3){ log.push(Date.now()); try{ sessionStorage.setItem('kwf_retry', JSON.stringify(log)); }catch(e){} location.reload(); return; }
        this._retryStop = true;   // الخادم يرد لكن المزامنة تفشل: لا فائدة من مزيد من القراءات التلقائية
      }
      if(manual) UI.toast('ما زال الخادم لا يرد — تأكد من الإنترنت وحاول بعد قليل', true);
    }catch(e){}
    this._retryBusy=false;
  },

  /* ---------- النسخة الجديدة ----------
     الصفحة تُقدَّم من ذاكرة sw.js فوراً والجديدة تُجلب في الخلفية، والتطبيق على الآيفون يرجع من الخلفية بلا إعادة تحميل —
     فبقي بعض المشتركين على نسخة قديمة (لوحة VAMOS لم تظهر لهم، 2026-10-09). الآن: نقارن رقم ?v لـ app.js
     مع الصفحة على الخادم عند الفتح وعند الرجوع من الخلفية، ونحدّث تلقائياً إن لم يكن المشترك في منتصف شيء. */
  _bootAt: Date.now(),
  /* بصمة النسخة = كل ملفات الصفحة بأرقام ?v (سكربتات وأنماط) — أي تعديل منشور يغيّر رقماً منها (لوحة VAMOS كانت في css فقط) */
  verMap(list){ const o={}; list.forEach(x=>{ const m=String(x||'').match(/((?:js|css)\/[^/?]+)\?v=(\d+)/); if(m) o[m[1]]=+m[2]; }); return o; },
  myVer(){ return this.verMap([...document.querySelectorAll('script[src],link[rel=stylesheet][href]')].map(e=>e.getAttribute('src')||e.getAttribute('href'))); },
  /* ملف موجود عندنا وعلى الخادم برقم أحدث = نسخة جديدة (ملفات تُضاف أثناء التشغيل لا تُحسب) */
  isNewer(srv){ const me=this.myVer(); return Object.keys(srv).some(k=>me[k]!==undefined && srv[k]>me[k]); },
  initVersionWatch(){
    if('serviceWorker' in navigator){
      navigator.serviceWorker.addEventListener('message', e=>{
        if(e.data && e.data.type==='HTML_UPDATED' && /^\/fantasy/.test(e.data.path||'')) this.newVersion(null);
      });
    }
    setTimeout(()=>this.checkVersion('boot'), 4000);
  },
  async checkVersion(){
    if(this._verBusy || /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return;
    this._verBusy=true;
    try{
      /* ?vcheck يتجاوز ذاكرة sw.js (يمر للشبكة مباشرة) */
      const res=await fetch('/fantasy/?vcheck='+Date.now(), {cache:'no-store'});
      if(res.ok){
        const html=await res.text();
        const srv=this.verMap([...html.matchAll(/(?:src|href)="([^"]+\?v=\d+)"/g)].map(m=>m[1]));
        if(this.isNewer(srv)) await this.newVersion(html);
      }
    }catch(e){}
    this._verBusy=false;
  },
  /* المشترك في منتصف عمل؟ (ورقة/نافذة مفتوحة، انتقالات أو تشكيلة غير معتمدة) — لا نعيد التحميل تحت يده */
  busyUser(){
    const u=(typeof VIEWS!=='undefined' && VIEWS.ui)||{};
    return !!(document.getElementById('sheetBack') || document.getElementById('modalBack') || document.querySelector('.addp-open')
      || (u.tIn&&u.tIn.length) || (u.tOut&&u.tOut.length) || (u.pickerSquad&&u.pickerSquad.length) || u.sel
      || (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))
      || [...document.querySelectorAll('#main input:not([type=checkbox]):not([type=radio]):not([type=hidden]), #main textarea')].some(i=>i.value));   /* نموذج دخول/تسجيل فيه كتابة — لا نمسحه بتحديث */
  },
  async newVersion(html){
    this._verPending=true;
    /* نحفظ الصفحة الجديدة في ذاكرة sw.js حتى تفتح إعادة التحميل عليها مباشرة (لا على القديمة) */
    if(html && window.caches){
      try{ const keys=await caches.keys(); const k=keys.find(x=>/^shell-/.test(x));
        if(k){ const c=await caches.open(k); const hdr={headers:{'Content-Type':'text/html; charset=utf-8'}};
          await c.put(new Request(location.origin+'/fantasy/'), new Response(html, hdr));
          await c.put(new Request(location.origin+'/fantasy/index.html'), new Response(html, hdr)); } }catch(e){}
    }
    this.applyUpdate();
  },
  /* بلا أزرار ولا رسائل (منصور 2026-10-09: «مو احترافي»): التحديث يتم بصمت فوراً إن لم يكن المشترك في منتصف شيء،
     وإلا ينتظر حتى ينتقل لصفحة أخرى أو يرجع للتطبيق من الخلفية. route = الصفحة التي سيفتح عليها بعد التحديث */
  applyUpdate(route){
    if(!this._verPending || this.busyUser()) return false;
    /* حماية من حلقة: تحديث تلقائي مرتين كحد أقصى كل 10 دقائق */
    let log=[]; try{ log=JSON.parse(sessionStorage.getItem('kwf_verreload')||'[]').filter(t=>Date.now()-t<600000); }catch(e){}
    if(log.length>=2){ this._verPending=false; return false; }
    log.push(Date.now()); try{ sessionStorage.setItem('kwf_verreload', JSON.stringify(log)); }catch(e){}
    if(route) history.replaceState(null,'','#'+route);
    location.reload(); return true;
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
        نقاطك وترتيبك يحتاجان اتصالاً.</div>
        <div style="margin-top:10px"><button class="btn sm" onclick="APP.retryCloud(true)">إعادة الاتصال</button></div></div>`;
    return `<div class="card" style="border-color:var(--accent);margin-bottom:12px">
      <b>أنت تتصفح بلا حساب</b>
      <div class="tiny" style="margin-top:6px">الفريق الذي تكوّنه الآن محفوظ على هذا الجهاز فقط،
      ولن تُحتسب له نقاط ولا يدخل الترتيب. أنشئ حساباً ليُحفظ ويُنافس.</div>
      <div style="margin-top:10px"><button class="btn sm" onclick="APP.go('auth')">إنشاء حساب أو دخول</button></div>
    </div>`;
  },

  /* ---------- المظهر ---------- */
  savedTheme(){ try{ return localStorage.getItem('kwf_theme')==='light' ? 'light' : 'dark'; }catch(e){ return 'dark'; } },   /* الداكن افتراضي مثل الموقع (منصور 2026-10-05) */
  applyTheme(t){ const dark=t==='dark'; document.documentElement.setAttribute('data-theme', dark?'dark':'light');
    /* لون شريط الحالة في تطبيق iOS/PWA يتبع الوضع: نفس لون الشريط العلوي (--surface) */
    const mc=document.querySelector('meta[name="theme-color"]'); if(mc) mc.setAttribute('content', dark?'#00061A':'#F2F4F8');   /* = خلفية الشريط العلوي في هوية MF */
    try{ localStorage.setItem('kwf_theme', t); }catch(e){} },
  toggleTheme(){ const t=this.savedTheme()==='dark'?'light':'dark'; this.applyTheme(t); this.renderTopbar(); UI.toast(t==='dark'?'الوضع الداكن':'الوضع الفاتح'); },

  /* عند مغادرة صفحة: إغلاق أي بطاقة/نافذة معلّقة والخروج من وضع التبديل — لا تبقى فوق الصفحة التالية */
  leavePage(next){
    try{ UI.closeSheet(); UI.closeModal(); }catch(e){}
    if(typeof VIEWS!=='undefined' && VIEWS.ui){
      if(VIEWS.ui.addp && typeof VIEWS.closeAddPlayer==='function') VIEWS.closeAddPlayer();
      VIEWS.ui.sel=null; VIEWS.ui.subMode=false;
      if(next==='team' && VIEWS.ui.teamView==='market') VIEWS.ui.teamView='pitch';   // «فريقي» يفتح الملعب لا سوق الانتقالات
    }
  },
  /* ---------- الرجوع للصفحة السابقة ---------- */
  hist:[],
  back(){
    const prev=this.hist.pop();
    this._noHist=true; this.go(prev||'dashboard'); this._noHist=false;
  },
  go(route){
    if(!this._noHist && route!==this.route && this.route){ this.hist.push(this.route); if(this.hist.length>30) this.hist.shift(); }
    this.leavePage(route);
    if(this._verPending && this.applyUpdate(route)) return;   // نسخة جديدة معلّقة: تُطبَّق بصمت مع الانتقال (بعد إغلاق الأوراق)
    this.route=route; location.hash=route; this.render(); window.scrollTo(0,0);
    if((route==='dashboard' || route==='about') && typeof FEEDBACK!=='undefined') FEEDBACK.pollMine();   // ردود الدعم (مخفَّف: مرة بالدقيقة)
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
    if(team && team.squad.length && !(+team.joinedGW>st.currentGW) && GWADMIN.deadlinePassed(st.currentGW) && !team.gwPicks[st.currentGW]){   /* المنضم للجولة التالية بلا لقطة */
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
    // دخل الحساب لكن فريقه لم يصل بعد من الخادم: لا نعرض فريق الضيف الفارغ للحظات
    const fetchingTeam = cloudOn && CLOUD.user && DB.muted && DB.state.session!==CLOUD.user.uid && !['guide','about','auth'].includes(r);
    /* ضيف بلا حساب والخادم لا يرد: لا نعرض فريقاً محلياً بجولة قديمة ولاعبين ناقصين (يبدو مقفلاً ولا يُحفظ) —
       نعرض شاشة الاتصال، ونعيد المحاولة تلقائياً (retryCloud). رسالة «المدرب» 2026-10-09 */
    const guestOffline = this.cloudState==='offline' && !(typeof CLOUD!=='undefined' && CLOUD.user)
      && (!DB.state.session || DB.state.session==='u1local') && !['guide','about'].includes(r)
      && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname);   /* محلياً (اختبارات السحابة المحجوبة) يبقى وضع الضيف المحلي */
    try{
      if(guestOffline){ html=`<div class="card" style="text-align:center;padding:28px 18px">
        <h3 style="margin:0 0 8px;display:block;text-align:center">تعذّر الاتصال بالخادم</h3>
        <div class="muted" style="line-height:1.9">لعب الفانتسي يحتاج اتصالاً وحساباً — بدونهما ما تقدر تحفظ تشكيلتك أو تختار الكابتن أو تسمّي فريقك أو تدخل الدوريات، ولا تظهر آخر الجولات واللاعبين الجدد.</div>
        <div class="tiny" style="margin:10px 0 14px;line-height:1.9">تأكد من الإنترنت، ثم اضغط «إعادة الاتصال». نحاول تلقائياً كل 20 ثانية.</div>
        <button class="btn" onclick="APP.retryCloud(true)">إعادة الاتصال</button></div>`; }
      else if(fetchingTeam){ html=`<div class="card" style="text-align:center;padding:30px"><div class="muted">جارٍ تحميل فريقك…</div>${this.slowLoad?'<div class="tiny" style="margin-top:10px">الشبكة بطيئة — نكمل التحميل، لا تسكّر الصفحة</div>':''}
        <div class="tiny" style="margin-top:10px">لو طال الانتظار: <button class="btn sm sec" onclick="location.reload()">إعادة المحاولة</button></div></div>`; }
      else if(needAuth){ html = this.cloudState==='init' ? '<div class="card" style="text-align:center;padding:30px"><div class="muted">جارٍ الاتصال…</div>'+(this.slowLoad?'<div class="tiny" style="margin-top:10px">الشبكة بطيئة — نكمل التحميل، لا تسكّر الصفحة</div>':'')+'</div>' : VIEWS.auth(); }
      else if(r==='team') html=VIEWS.team();
      else if(r==='transfers'){ VIEWS.ui.teamView='market'; this.route='team'; html=VIEWS.team(); }
      else if(r==='players') html=VIEWS.players();
      else if(r==='player') html=VIEWS.player();
      else if(r==='coach') html=VIEWS.coachPage();
      else if(r==='fixtures') html=VIEWS.fixtures();
      else if(r==='live') html=VIEWS.live();
      else if(r==='leagues') html=VIEWS.leagues();
      else if(r==='manager') html=VIEWS.manager();
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
    this.askFav(cloudOn, needAuth, fetchingTeam);
    /* الحركة عند تغيّر الصفحة فقط، لا عند كل إعادة رسم (تحديث/مزامنة) */
    const anim = this._shownRoute !== this.route;
    this._shownRoute = this.route;
    /* إعادة الرسم بمحتوى مطابق (الجلسة المخزّنة ثم وصول السحابة ثم الفريق) لا تستبدل الصفحة — كانت القمصان ترمش 3 مرات عند الفتح (منصور 2026-09-16) */
    if(!anim && html===this._lastHtml && main.firstElementChild){ this.renderBottomNav(); return; }
    this._lastHtml = html;
    main.innerHTML=`<div class="view${anim?' anim':''}">${html}</div>`;
    this.renderBottomNav();
  },

  /* اختيار النادي المفضل مرة واحدة لكل مشترك (حتى من عنده فريق) — بعد وصول ملفه من الخادم فقط، كي لا يُسأل من اختار على جهاز آخر */
  askFav(cloudOn, needAuth, fetchingTeam){
    if(this._favOpen || !cloudOn || needAuth || fetchingTeam || this.cloudState==='init') return;
    if(!CLOUD.user || DB.state.session!==CLOUD.user.uid || DB.muted || FAV.mine()) return;
    if(this.route==='auth' || document.getElementById('modalBack')) return;
    this._favOpen=true; setTimeout(()=>VIEWS.favModal(), 400);
  },

  renderTopbar(){
    const m=DB.me();
    const nav=document.getElementById('navlinks');
    nav.innerHTML=this.NAV.map(([id,ic,l])=>
      `<button class="${this.route===id?'active':''}" onclick="APP.go('${id}')">${l}</button>`).join('')
      + (ADMINAUTH.active()? `<button class="${this.route==='admin'?'active':''}" onclick="APP.go('admin')">الإدارة</button>`:'');
    const unread=NOTIF.unread();
    const dark=this.savedTheme()==='dark';
    document.getElementById('topActions').innerHTML=`
      ${this.route!=='dashboard' ? `<button class="iconbtn back" title="رجوع" onclick="APP.back()">${UI.icon('back',18)}</button>` : ''}
      <button class="iconbtn lang" title="اللغة" onclick="I18N.toggle()">${typeof I18N!=='undefined' && I18N.isEn() ? 'ع' : 'EN'}</button>
      <button class="iconbtn" title="${dark?'الوضع الفاتح':'الوضع الداكن'}" onclick="APP.toggleTheme()">${dark? '<svg class="ic" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>' : UI.icon('moon',18)}</button>
      <button class="iconbtn" title="الإشعارات" onclick="APP.toggleNotif()">${UI.icon('bell',18)}${unread?`<span class="dot">${unread}</span>`:''}</button>
      <div id="userchip" onclick="APP.go('profile')"><div class="av">${UI.icon('users',15)}</div><span class="uc-name">${esc(m.username)}</span></div>`;
  },
  renderBottomNav(){
    const m=DB.me(); if(!m) return;
    /* «حسابي» في الشريط السفلي عمداً: حذف الحساب شرط App Store 5.1.1(v)
   ولازم يكون سهل العثور عليه. كان خلف دائرة صغيرة في الترويسة فلم
   يجده مُراجع آبل ورُفض التطبيق. */
    const items=[['dashboard','home','الرئيسية'],['team','shirt','فريقي'],['players','users','اللاعبون'],['leagues','trophy','دوريات'],['profile','gear','حسابي'],['guide','news','عن اللعبة']];
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
