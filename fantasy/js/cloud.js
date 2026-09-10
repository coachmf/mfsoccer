/* =========================================================
   السحابة — حسابات وفرق ودوريات مشتركة على Firebase
   يُحمَّل قبل engine.js في index.html.

   البنية في Firestore (نفس مشروع الموقع mfsoccer-c7ee4):

     fantasy/{season}                  ← حالة اللعبة: القواعد والنقاط والجولات
     fantasy/{season}/meta/players     ← اللاعبون وأسعارهم
     fantasy/{season}/rounds/{gw}      ← مباريات الجولة بإحصاءاتها
     fantasy/{season}/managers/{uid}   ← المشترك: ملفه وفريقه وسجله
     fantasy/{season}/leagues/{id}     ← الدوريات الخاصة

   من يكتب ماذا:
     - حالة اللعبة والجولات: المدير وحده
     - ملف المشترك وفريقه: صاحبه وحده
     - سجل النقاط (history/total): المدير وحده عند احتساب الجولة،
       حتى لا يستطيع أحد كتابة نقاطه بنفسه
   ========================================================= */
'use strict';

const CLOUD = {
  CFG: {
    apiKey: "AIzaSyD_ZzAE4HEKPIuAKCmta8tzN5KOa8IUfuo",
    authDomain: "mfsoccer-c7ee4.firebaseapp.com",
    projectId: "mfsoccer-c7ee4",
    storageBucket: "mfsoccer-c7ee4.firebasestorage.app",
    messagingSenderId: "574478199897",
    appId: "1:574478199897:web:dbd2b7dae6384503ea9548"
  },
  /* من يملك النشر والاحتساب — نفس نموذج الموقع الرئيسي:
     المالك، أو محرّر مفعّل في seasons/staff. مطابق لـ isFanAdmin
     في firestore.rules، فلا تظهر صلاحية هنا يرفضها الخادم. */
  OWNER_UID: "iiTgVfDryXNLb9IrOyLkkNMHDxq2",
  SEASON: "2026-2027",

  db: null, auth: null, user: null,
  ready: false,            // تهيّأت المكتبة والاتصال
  admin: false,            // الحساب الحالي مدير
  state: 'init',           // init | ready | offline
  _listeners: [],

  /* ---------- تهيئة ---------- */
  init(){
    if(typeof firebase === 'undefined'){ this.state='offline'; return false; }
    try{
      // الموقع الرئيسي قد يكون هيّأ التطبيق مسبقاً في نفس الصفحة
      if(!firebase.apps || !firebase.apps.length) firebase.initializeApp(this.CFG);
      this.auth = firebase.auth();
      this.db   = firebase.firestore();
      try{ this.db.settings({ experimentalAutoDetectLongPolling:true, merge:true }); }catch(e){}
      /* الجلسة تبقى محفوظة على الجهاز (سفاري أحياناً يفقدها بلا هذا) */
      try{ this.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL); }catch(e){}
      this.ready = true; this.state='ready';
      /* لو رجعنا من دخول Google عبر إعادة توجيه، التقط النتيجة (وأي خطأ مفهوم) */
      this.auth.getRedirectResult().catch(()=>{});
      this.auth.onAuthStateChanged(u => this._onAuth(u));
      return true;
    }catch(e){ console.warn('cloud init failed', e); this.state='offline'; return false; }
  },

  async _onAuth(u){
    this.user = u || null;
    this.admin = false;
    if(u){
      if(u.uid === this.OWNER_UID) this.admin = true;
      else {
        // فريق العمل مخزّن كخريطة داخل seasons/staff تماماً كالموقع الرئيسي
        try{
          const s = await this.db.collection('seasons').doc('staff').get();
          const m = (s.exists && s.data().members) || {};
          const me = m[u.uid];
          this.admin = !!(me && me.role==='editor' && me.active===true);
        }catch(e){ /* اللاعب العادي لا يقرأ هذا المستند — يبقى غير مدير */ }
      }
    }
    this.authResolved = true;
    this._listeners.forEach(fn=>{ try{ fn(u); }catch(e){ console.warn(e); } });
  },
  /* لا يُستدعى المستمع بـnull قبل أن يحسم Firebase الجلسة — وإلا يُهيَّأ فريق ضيف ويُرفع فوق فريق الحساب */
  onAuth(fn){ this._listeners.push(fn); if(this.authResolved) fn(this.user); },

  /* ---------- مسارات ---------- */
  root(){ return this.db.collection('fantasy').doc(this.SEASON); },
  managers(){ return this.root().collection('managers'); },
  leaguesCol(){ return this.root().collection('leagues'); },
  round(gw){ return this.root().collection('rounds').doc(String(gw)); },
  playersDoc(){ return this.root().collection('meta').doc('players'); },
  liveDoc(){ return this.root().collection('meta').doc('live'); },
  ownDoc(){ return this.root().collection('meta').doc('own'); },        // التملّك ولقطة الترتيب العام — مستند مستقل حتى لا يُعاد تحميل اللعبة كل ساعة      // نقاط الجولة الجارية لكل المشتركين — ينشرها المدير
  lockDoc(){ return this.root().collection('meta').doc('lock'); },

  /* ---------- قفل الجولة ----------
     مستند صغير تقرؤه قواعد الأمان: بعد الموعد يرفض الخادم أي تعديل
     على التشكيلة، فلا يكفي أن يكون القفل في الواجهة. */
  async publishLock(st){
    const g = (st.gws||[]).find(x=>x.n===st.currentGW);
    if(!g) return {ok:false, err:'لا توجد جولة حالية'};
    // جولة بلا جدول بعد (mfsoccer لم ينشره): لا موعد — تبقى مفتوحة على الخادم إلى أن يصدر
    const has = !!g.deadline;
    const dl = has ? new Date(g.deadline) : new Date('2099-01-01T00:00:00Z');
    const body = {
      gw: st.currentGW,
      deadline: firebase.firestore.Timestamp.fromDate(dl),
      deadlineISO: g.deadline || null,
      provisional: !has,
      open: g.status !== 'finished',
      updated: new Date().toISOString()
    };
    const r = await this.race(this.lockDoc().set(body));
    return r.ok ? {ok:true, gw:body.gw, deadline:g.deadline} : {ok:false, err:'تعذّر نشر موعد الإغلاق'};
  },

  /* الموعد كما يراه الخادم — الواجهة تستعمله حتى لا تعتمد على ساعة الجهاز */
  async readLock(){
    try{
      const s = await this.lockDoc().get();
      return s.exists ? s.data() : null;
    }catch(e){ return null; }
  },

  /* Firestore يطبّق الكتابة محلياً فوراً لكن الوعد ينتظر الخادم،
     فبلا اتصال يبقى معلقاً — نسابقه بمهلة كما يفعل الموقع الرئيسي. */
  race(p, ms){
    return Promise.race([
      p.then(v=>({ok:true, v})).catch(err=>({ok:false, err})),
      new Promise(r=>setTimeout(()=>r({ok:false, timeout:true}), ms||9000))
    ]);
  },

  /* ---------- المصادقة ---------- */
  async signup(email, pass, username, teamName){
    if(!this.ready) return {ok:false, err:'السحابة غير متاحة — تأكد من الاتصال'};
    email=String(email||'').trim().toLowerCase();
    username=String(username||'').trim(); teamName=String(teamName||'').trim();
    if(!email || !pass || !username || !teamName) return {ok:false, err:'كل الحقول مطلوبة'};
    if(pass.length < 6) return {ok:false, err:'كلمة المرور 6 أحرف على الأقل'};
    const taken = await this.usernameTaken(username);
    if(taken) return {ok:false, err:'اسم المستخدم محجوز — اختر غيره'};
    // أثناء التسجيل يتوقف مستمع الدخول (APP.initCloud) عن إنشاء مستند افتراضي
    // حتى لا يطمس اسم المستخدم واسم الفريق اللذين كتبهما المشترك.
    this.signingUp = true;
    try{
      const cred = await this.auth.createUserWithEmailAndPassword(email, pass);
      // لا ننتظر كتابة المستند بلا حدّ: على شبكة تحجب قناة Firestore يبقى
      // الوعد معلقاً بلا خطأ فيعلق زر التسجيل، والحساب أُنشئ فعلاً.
      const saved = await this.createManager(cred.user.uid, username, teamName, email);
      try{ await cred.user.sendEmailVerification(); }catch(e){}
      return saved ? {ok:true}
                   : {ok:true, warn:'أُنشئ حسابك، لكن حفظ بياناتك تأخّر — أعد فتح الصفحة'};
    }catch(e){ return {ok:false, err:this.errAr(e)}; }
    finally{ this.signingUp = false; }
  },

  async login(email, pass){
    if(!this.ready) return {ok:false, err:'السحابة غير متاحة — تأكد من الاتصال'};
    try{
      await this.auth.signInWithEmailAndPassword(String(email||'').trim().toLowerCase(), pass);
      return {ok:true};
    }catch(e){ return {ok:false, err:this.errAr(e)}; }
  },

  async logout(){ try{ await this.auth.signOut(); }catch(e){} },

  /* ================= حذف الحساب نهائياً =================
     شرط App Store (5.1.1(v)): من أنشأ حسابه داخل التطبيق لازم يقدر
     يحذفه من داخله. الترتيب مهم: تُمسح مستندات Firestore أولاً وحساب
     المصادقة لا يزال قائماً — بعد حذفه تسقط صلاحيات القواعد فوراً
     ولن نستطيع لمس أي مستند. */

  /* أي مزوّد استعمله المشترك للدخول */
  providerId(){
    const d = (this.user && this.user.providerData) || [];
    return (d[0] && d[0].providerId) || 'password';
  },

  /* Firebase يرفض الحذف إن مضى وقت على آخر دخول — نؤكّد الهوية أولاً */
  async reauth(password){
    const u = this.user;
    if(!u) return {ok:false, err:'لست مسجّل الدخول'};
    try{
      if(this.providerId() === 'google.com'){
        const prov = new firebase.auth.GoogleAuthProvider();
        prov.setCustomParameters({prompt:'select_account'});
        await u.reauthenticateWithPopup(prov);
      }else{
        if(!password) return {ok:false, err:'اكتب كلمة المرور للتأكيد'};
        const cred = firebase.auth.EmailAuthProvider.credential(u.email, password);
        await u.reauthenticateWithCredential(cred);
      }
      return {ok:true};
    }catch(e){ return {ok:false, err:this.errAr(e)}; }
  },

  /* حذف كل ما يخص المشترك من قاعدة البيانات. يُكمل رغم فشل أي جزء
     ويعيد أسماء ما تعذّر حذفه حتى نصارح المشترك بدل ادّعاء النجاح. */
  async purgeUserData(uid){
    const failed = [];
    const step = async (label, fn) => { try{ await fn(); }catch(e){ failed.push(label); } };

    await step('فريق الفانتسي', () => this.managers().doc(uid).delete());
    await step('حساب الموقع',  () => this.db.collection('fans').doc(uid).delete());

    await step('التوقعات', async () => {
      const q = await this.db.collection('preds').where('uid','==',uid).get();
      await Promise.all(q.docs.map(d => d.ref.delete()));
    });
    await step('أصوات تشكيلة الجمهور', async () => {
      const q = await this.db.collection('tots').where('uid','==',uid).get();
      await Promise.all(q.docs.map(d => d.ref.delete()));
    });
    await step('رسائل الدعم', async () => {
      const q = await this.root().collection('feedback').where('uid','==',uid).get();
      await Promise.all(q.docs.map(d => d.ref.delete()));
    });
    /* الدوريات الخاصة: ما يملكه يُحذف، وما انضم إليه يخرج منه فقط
       حتى لا نُفقد بقية الأعضاء دوريهم. */
    await step('الدوريات الخاصة', async () => {
      const q = await this.leaguesCol().where('members','array-contains',uid).get();
      await Promise.all(q.docs.map(d => (d.data()||{}).owner === uid
        ? d.ref.delete()
        : d.ref.update({ members: firebase.firestore.FieldValue.arrayRemove(uid) })));
    });
    return failed;
  },

  async deleteAccount(password){
    if(!this.ready)  return {ok:false, err:'السحابة غير متاحة — تأكد من الاتصال'};
    if(!this.user)   return {ok:false, err:'لست مسجّل الدخول'};
    const u = this.user, uid = u.uid;

    const re = await this.reauth(password);
    if(!re.ok) return re;

    const failed = await this.purgeUserData(uid);

    try{ await u.delete(); }
    catch(e){ return {ok:false, err:this.errAr(e)}; }

    /* الحساب زال — لا نُبقي فريقاً محلياً باسمه على الجهاز */
    try{
      Object.keys(localStorage)
        .filter(k => k.indexOf('kwf_') === 0 || k === (DB && DB.KEY))
        .forEach(k => localStorage.removeItem(k));
    }catch(e){}

    return failed.length ? {ok:true, warn:'حُذف حسابك، لكن تعذّر حذف: ' + failed.join('، ') + ' — راسلنا لإتمامها'}
                         : {ok:true};
  },

  /* هل نحن داخل متصفح تطبيق (إنستغرام/تيك توك/سناب/فيسبوك)؟ Google يرفض OAuth فيها */
  inAppBrowser(){
    const ua=(navigator.userAgent||'').toLowerCase();
    return /instagram|fbav|fban|fb_iab|tiktok|musical_ly|snapchat|line\/|micromessenger/.test(ua);
  },
  /* الدخول بحساب Google — يحتاج تفعيل Google في Firebase Authentication وإضافة النطاق في Authorized domains */
  async googleLogin(){
    if(!this.ready) return {ok:false, err:'السحابة غير متاحة — تأكد من الاتصال'};
    if(this.inAppBrowser()) return {ok:false, err:'الدخول عبر Google لا يعمل داخل متصفح التطبيق (إنستغرام/تيك توك/سناب). افتح mfsoccer.com في Safari أو Chrome، أو ادخل بالبريد وكلمة المرور.'};
    let prov;
    try{ prov=new firebase.auth.GoogleAuthProvider(); prov.setCustomParameters({prompt:'select_account'}); }
    catch(e){ return {ok:false, err:'الدخول عبر Google غير متاح في هذه النسخة'}; }
    try{ await this.auth.signInWithPopup(prov); return {ok:true}; }
    catch(e){
      if(e && (e.code==='auth/popup-blocked' || e.code==='auth/cancelled-popup-request')){
        try{ await this.auth.signInWithRedirect(prov); return {ok:true, redirect:true}; }catch(e2){ return {ok:false, err:this.errAr(e2)}; }
      }
      // شبكات العمل والمدارس تحجب أحياناً نافذة Google (firebaseapp.com) فتظهر «can't reach this page» وتُغلق
      const c=(e&&e.code)||'';
      if(c==='auth/popup-closed-by-user' || c==='auth/network-request-failed' || c==='auth/internal-error')
        return {ok:false, err:this.errAr(e)+' — إذا كانت شبكتك (عمل/مدرسة) تحجب Google، أنشئ حساباً بالبريد وكلمة المرور من «حساب جديد» أو جرّب من بيانات الجوال'};
      return {ok:false, err:this.errAr(e)};
    }
  },

  /* استعادة كلمة المرور برسالة حقيقية من Firebase — لا رمز محلي */
  async resetEmail(email){
    if(!this.ready) return {ok:false, err:'السحابة غير متاحة'};
    try{
      await this.auth.sendPasswordResetEmail(String(email||'').trim().toLowerCase());
      return {ok:true};
    }catch(e){ return {ok:false, err:this.errAr(e)}; }
  },

  errAr(e){
    const c = (e && e.code) || '';
    const map = {
      'auth/email-already-in-use':'البريد مسجل مسبقاً — سجّل الدخول بدلاً من إنشاء حساب',
      'auth/invalid-email':'صيغة البريد غير صحيحة',
      'auth/weak-password':'كلمة المرور ضعيفة — 6 أحرف على الأقل',
      'auth/user-not-found':'لا يوجد حساب بهذا البريد',
      'auth/wrong-password':'كلمة المرور غير صحيحة',
      'auth/invalid-credential':'البريد أو كلمة المرور غير صحيحة',
      'auth/too-many-requests':'محاولات كثيرة — انتظر قليلاً ثم أعد المحاولة',
      'auth/network-request-failed':'تعذّر الاتصال بالشبكة',
      'auth/operation-not-allowed':'طريقة الدخول هذه غير مفعّلة في إعدادات Firebase',
      'auth/popup-closed-by-user':'أُغلقت نافذة Google قبل إكمال الدخول',
      'auth/unauthorized-domain':'هذا النطاق غير مصرّح له في Firebase (Authorized domains)',
      'auth/account-exists-with-different-credential':'هذا البريد مسجّل بكلمة مرور — ادخل بالبريد وكلمة المرور',
      'auth/requires-recent-login':'انتهت صلاحية جلستك — أعد تسجيل الدخول ثم كرّر المحاولة',
      'auth/user-mismatch':'الحساب الذي أكّدت به لا يطابق حسابك الحالي',
      'permission-denied':'لا تملك صلاحية هذه العملية'
    };
    return map[c] || ((e && e.message) || 'حدث خطأ غير متوقع');
  },

  /* ---------- المشتركون ---------- */
  async usernameTaken(username){
    try{
      const q = await this.managers().where('username','==',username).limit(1).get();
      return !q.empty;
    }catch(e){ return false; }   // تعذّر التحقق: لا نمنع التسجيل
  },

  /* البريد لا يُحفظ في المستند: مجموعة المشتركين مقروءة للجميع (لوحة الترتيب)،
     وFirebase Auth يحتفظ به أصلاً. */
  async createManager(uid, username, teamName, email){
    const doc = {
      username, teamName, avatar:'',
      joinedGW: (typeof DB!=='undefined' && DB.state ? DB.state.currentGW : 1),
      created: new Date().toISOString(),
      team: null, history: [], total: 0, lastGW: 0
    };
    const r = await this.race(this.managers().doc(uid).set(doc, {merge:true}));
    return r.ok === true ? doc : null;
  },

  /* null = لا مستند (حساب جديد) · undefined = فشلت القراءة (شبكة) — لا يُعامَل الفشل كحساب جديد أبداً */
  async getManager(uid){
    try{
      const s = await this.managers().doc(uid).get();
      return s.exists ? s.data() : null;
    }catch(e){ return undefined; }
  },

  /* حفظ الملف والفريق — لا يمسّ history ولا total (المدير وحده يكتبهما).
     بعد موعد الإغلاق يرفض الخادم التشكيلة، فنرسل الملف وحده. */
  async saveMyTeam(profile, team){
    if(!this.user) return false;
    const patch = {updated:new Date().toISOString()};
    if(team !== undefined) patch.team = team || null;   // undefined = لا تمسّ التشكيلة
    if(profile){
      if(profile.username!=null) patch.username = profile.username;
      if(profile.teamName!=null) patch.teamName = profile.teamName;
      if(profile.avatar  !=null) patch.avatar   = profile.avatar;
    }
    const r = await this.race(this.managers().doc(this.user.uid).set(patch, {merge:true}));
    if(r.ok === true) return true;
    // الخادم يرفض تعديل التشكيلة بعد الإغلاق — نوضّح السبب بدل فشل صامت
    const code = r.err && r.err.code;
    if(code === 'permission-denied' && typeof UI!=='undefined'){
      UI.toast(patch.team !== undefined
        ? 'أُغلقت الجولة — لا يمكن تعديل التشكيلة بعد الموعد'
        : 'تعذّر الحفظ — لا تملك صلاحية هذه العملية', true);
    }
    return false;
  },

  /* ---------- الجولة المباشرة ----------
     كان كل زائر يقرأ كل المشتركين كل دقيقة ليحسب المتوسط والترتيب الحي (382 قراءة × كل زائر × كل دقيقة).
     الآن جهاز المدير وحده يقرؤهم ويحسب ويكتب لقطة واحدة meta/live، وكل زائر يقرأ هذه اللقطة فقط (قراءة واحدة). */
  async publishLive(gw, calc){
    if(!this.admin) return {ok:false, err:'للمدير فقط'};
    let q;
    try{ q = await this.managers().get(); }
    catch(e){ return {ok:false, err:'تعذّرت قراءة المشتركين'}; }
    const rows=[];
    q.forEach(d=>{ const v=d.data(); const t=v.team; if(!t || !(t.squad||[]).length) return;
      let live=0; try{ live=+calc(t, gw).total||0; }catch(e){ live=0; }
      rows.push({ id:d.id, name:v.username||'مشترك', teamName:v.teamName||'', live, total:+v.total||0 }); });
    rows.sort((a,b)=>b.live-a.live);
    const at=new Date().toISOString();
    const r = await this.race(this.liveDoc().set({gw, at, rows, by:(this.user&&this.user.email)||''}));
    if(!r.ok) return {ok:false, err:'تعذّر نشر اللقطة الحية'};
    return {ok:true, rows, at, gw};
  },
  async readLive(){
    try{ const s=await this.liveDoc().get(); return s.exists ? s.data() : null; }
    catch(e){ return undefined; }
  },

  /* لوحة الترتيب العام — من نقاط المشتركين الحقيقيين */
  async leaderboard(limit){
    // اللقطة المنشورة (كل المشتركين، بلا قراءة إضافية). المشترك الجديد قبل تحديث اللقطة يُضاف محلياً.
    const st = (typeof DB!=='undefined' && DB.state) || null;
    if(st && (!this._ownAt || Date.now()-this._ownAt > 5*60000)){      // لقطة أحدث؟ قراءة واحدة كل 5 دقائق على الأكثر
      this._ownAt = Date.now();
      const o = await this.loadOwn(); if(this.applyOwn(st, o)){ try{ localStorage.setItem(DB.KEY, JSON.stringify(st)); }catch(e){} }
    }
    if(st && Array.isArray(st.board) && st.board.length){
      const rows = st.board.map(r=>({...r, hist:(r.hist||[]).slice()}));
      const me = DB.me && DB.me(); const t = me && st.teams[me.id];
      if(me && t && (t.squad||[]).length && !rows.some(r=>r.id===me.id)){
        const hist=(t.history||[]).map(h=>({gw:+h.gw,pts:+h.pts||0}));
        rows.push({ id:me.id, name:me.username||'مشترك', teamName:me.teamName||'', total:hist.reduce((s,h)=>s+h.pts,0), hist, last:hist.length?hist[hist.length-1].pts:0 });
      }
      rows.sort((a,b)=>b.total-a.total || (a.name||'').localeCompare(b.name||'','ar'));
      return rows;
    }
    try{
      const q = await this.managers().orderBy('total','desc').limit(limit||100).get();
      const rows=[];
      q.forEach(d=>{ const v=d.data();
        if(!v.team || !(v.team.squad||[]).length) return;      // مشترك بلا فريق لا يظهر في الترتيب
        rows.push({
        id:d.id, name:v.username||'مشترك', teamName:v.teamName||'', total:+v.total||0,
        hist:v.history||[],
        last:(v.history&&v.history.length)? (+v.history[v.history.length-1].pts||0) : 0 }); });
      return rows;
    }catch(e){ return null; }
  },

  /* قائمة المشتركين كاملة — للمدير فقط (قراءة واحدة لكل مشترك، تُخزَّن في الجلسة) */
  async listManagers(){
    try{
      const q = await this.managers().get();
      const rows=[];
      q.forEach(d=>{ const v=d.data()||{};
        rows.push({ id:d.id, username:v.username||'', teamName:v.teamName||'', total:+v.total||0,
          hasTeam: !!(v.team && (v.team.squad||[]).length), chip: (v.team && v.team.activeChip)||null,
          joinedGW:v.joinedGW||null, created:v.created||'', updated:v.updated||'', lastGW:+v.lastGW||0 }); });
      return rows;
    }catch(e){ return null; }
  },

  async managerCount(){
    try{ const q=await this.managers().get(); return q.size; }catch(e){ return null; }
  },

  /* ---------- نسبة التملّك ----------
     تُحسب من فرق المشتركين الفعليين على الخادم (من كوّن فريقاً فقط).
     قراءة واحدة لكل مشترك، فلا تُستدعى من كل زائر — المدير يحسبها وينشرها
     مع اللعبة فتصل الجميع بقراءة واحدة. */
  /* سطر في لقطة الترتيب العام (تُنشر مع اللعبة فيقرؤها الجميع بقراءة واحدة بدل قراءة كل المشتركين) */
  boardRow(uid, v, hist, total){
    hist = (hist || v.history || []).map(h=>({gw:+h.gw, pts:+h.pts||0}));
    return { id:uid, name:v.username||'مشترك', teamName:v.teamName||'', total: total!=null? +total : (+v.total||0),
      hist, last: hist.length? hist[hist.length-1].pts : 0 };
  },
  async computeOwnership(){
    let q;
    try{ q = await this.managers().get(); }
    catch(e){ return {ok:false, err:'تعذّرت قراءة قائمة المشتركين'}; }
    const own={}; let count=0; const board=[];
    q.forEach(d=>{
      const v=d.data(); const squad=(v.team && v.team.squad)||[];
      if(!squad.length) return;
      count++;
      squad.forEach(pid=>{ own[pid]=(own[pid]||0)+1; });
      board.push(this.boardRow(d.id, v));
    });
    board.sort((a,b)=>b.total-a.total || a.name.localeCompare(b.name,'ar'));
    return {ok:true, own, count, total:q.size, board};
  },

  /* المدير: يحسب التملّك وينشره وحده (بلا إعادة نشر اللعبة كاملة) */
  async publishOwnership(st){
    if(!this.admin) return {ok:false, err:'تحديث التملّك للمدير فقط'};
    const c = await this.computeOwnership();
    if(!c.ok) return c;
    st.own = c.own; st.managerCount = c.count; st.ownUpdated = new Date().toISOString(); st.board = c.board;
    // يُكتب في meta/own لا في مستند اللعبة: تغيير «updated» في مستند اللعبة يجعل كل جهاز مفتوح يعيد تحميلها كاملة (~25 قراءة)
    const r = await this.race(this.ownDoc().set({
      own: c.own, managerCount: c.count, ownUpdated: st.ownUpdated, board: c.board,
      updatedBy: (this.user && this.user.email) || ''
    }));
    if(!r.ok) return {ok:false, err: r.timeout ? 'الاتصال بطيء — لم يكتمل النشر' : this.errAr(r.err)};
    return {ok:true, count:c.count, total:c.total};
  },

  /* ---------- حالة اللعبة (المدير يكتبها، الجميع يقرؤها) ---------- */
  async loadGame(){
    if(!this.ready) return null;
    try{
      const s = await this.root().get();
      return s.exists ? s.data() : null;
    }catch(e){ return null; }
  },
  /* التملّك واللقطة من meta/own (أحدث من نسخة مستند اللعبة عادةً) */
  async loadOwn(){
    try{ const s = await this.ownDoc().get(); return s.exists ? s.data() : null; }
    catch(e){ return null; }
  },
  /* تطبيق نسخة التملّك/اللقطة على الحالة إن كانت أحدث */
  applyOwn(st, o){
    if(!o || !o.ownUpdated) return false;
    if(st.ownUpdated && o.ownUpdated <= st.ownUpdated) return false;
    if(o.own) st.own=o.own; if(Array.isArray(o.board)) st.board=o.board;
    if(o.managerCount!=null) st.managerCount=+o.managerCount; st.ownUpdated=o.ownUpdated;
    return true;
  },

  async loadPlayers(){
    try{
      const s = await this.playersDoc().get();
      if(!s.exists) return null;
      const v=s.data();
      return { list: v.list || [], priceVer: +v.priceVer || 0 };
    }catch(e){ return null; }
  },

  async loadRounds(){
    try{
      const q = await this.root().collection('rounds').get();
      const out={};
      q.forEach(d=>{ out[+d.id] = d.data(); });
      return out;
    }catch(e){ return null; }
  },

  async publishGame(st){
    if(!this.admin) return {ok:false, err:'الاحتساب والنشر للمدير فقط'};
    const meta = {
      rules: st.rules, scoring: st.scoring, currentGW: st.currentGW,
      gws: st.gws, news: st.news, liveSpeed: st.liveSpeed,
      clubs: st.clubs,
      own: st.own||{}, managerCount: st.managerCount||0, transferStats: st.transferStats||{},
      ownUpdated: st.ownUpdated||null, board: st.board||[],
      updated: new Date().toISOString(),
      updatedBy: (this.user && this.user.email) || ''
    };
    let r = await this.race(this.root().set(meta, {merge:true}));
    if(!r.ok) return {ok:false, err: r.timeout ? 'الاتصال بطيء — لم يكتمل النشر' : this.errAr(r.err)};

    r = await this.race(this.playersDoc().set({list: st.players, priceVer: (typeof SEED_PRICE_VER!=='undefined'? SEED_PRICE_VER : 1), updated: meta.updated}));
    if(!r.ok) return {ok:false, err:'نُشرت الإعدادات لكن تعذّر نشر اللاعبين'};

    // الجولات: كل جولة في مستند مستقل حتى لا يتجاوز الحد الأعلى للمستند
    const byGW = {};
    st.fixtures.forEach(f=>{ (byGW[f.gw] = byGW[f.gw] || []).push(f); });
    const total = (st.rules && st.rules.totalGWs) || 22;
    for(let gw=1; gw<=total; gw++){
      const pg = {};
      for(const pid in st.playerGW){ const row=st.playerGW[pid][gw]; if(row) pg[pid]=row; }
      // جولة بلا مباريات تُنشر فارغة صراحةً حتى لا يبقى على الخادم جدول قديم مولَّد
      const rr = await this.race(this.round(gw).set({fixtures: byGW[gw]||[], playerGW: pg, updated: meta.updated}));
      if(!rr.ok) return {ok:false, err:`تعذّر نشر الجولة ${gw}`};
    }
    const lk = await this.publishLock(st);
    if(!lk.ok) return {ok:false, err:lk.err};
    return {ok:true, rounds:Object.keys(byGW).length, deadline:lk.deadline};
  },

  /* نشر نتائج جولة واحدة فقط — أسرع من نشر الموسم كله */
  async publishRound(st, gw){
    if(!this.admin) return {ok:false, err:'النشر للمدير فقط'};
    const fixtures = st.fixtures.filter(f=>f.gw===gw);
    const pg = {};
    for(const pid in st.playerGW){ const row=st.playerGW[pid][gw]; if(row) pg[pid]=row; }
    const now = new Date().toISOString();
    let r = await this.race(this.round(gw).set({fixtures, playerGW:pg, updated:now}));
    if(!r.ok) return {ok:false, err:'تعذّر نشر الجولة'};
    r = await this.race(this.root().set({gws:st.gws, currentGW:st.currentGW, updated:now}, {merge:true}));
    if(!r.ok) return {ok:false, err:'نُشرت المباريات لكن تعذّر تحديث حالة الجولات'};
    await this.publishLock(st);
    return {ok:true};
  },

  /* ---------- احتساب الجولة للجميع ---------- */
  /* يجلب كل المشتركين ويحسب نقاط كل فريق من إحصاءات المباريات.
     الاختيارات = التشكيلة المحفوظة على الخادم (بعد الموعد يرفض الخادم تعديلها)،
     أو لقطة الجولة إن وصلت. ثم يكتب في مستند كل مشترك: السجل والمجموع
     والاختيارات المحتسبة وترحيل الفريق (انتقالات مجانية، تصفير الكرت والخصومات،
     إرجاع فريق الضربة الحرة). ويعيد خلاصة: المتوسط والأعلى والتملّك والصفقات.
     المدير وحده. يمكن تكراره بأمان (لا يُحتسب أحد مرتين). */
  async finalizeForAll(st, gw, computeFn, opts){
    opts=opts||{};                       // {recompute:true} = إعادة احتساب جولة محتسبة بعد تصحيح نتيجة
    if(!this.admin) return {ok:false, err:'الاحتساب والنشر للمدير فقط'};
    if(!st.fromCloud) return {ok:false, err:'قائمة اللاعبين على هذا الجهاز ليست النسخة المنشورة — أعد تحميل الصفحة ثم حاول'};
    let snap;
    try{ snap = await this.managers().get(); }
    catch(e){ return {ok:false, err:'تعذّر قراءة قائمة المشتركين'}; }
    let skipped=0;

    const fill = t => Object.assign({ squad:[],xi:[],bench:[],cap:null,vice:null,bank:st.rules.budget,
      ft:st.rules.freeTransfers, usedChips:{}, activeChip:null, joinedGW:1,
      transfers:[], gwPicks:{}, pendingHits:0 }, t||{});

    const rows=[], writes=[]; const own={}, transfers={}; let count=0; const board=[];
    snap.forEach(d=>{
      const v=d.data();
      // لاعب غير معروف في القائمة = خلل بيانات على هذا الجهاز، لا في فريق المشترك: لا نحذفه من فريقه — نتخطاه ونبلّغ
      if(((v.team&&v.team.squad)||[]).some(pid=>!DB.player(pid))){ skipped++; board.push(this.boardRow(d.id, v)); return; }
      const team=fill(v.team);
      delete team.history;                                       // السجل يُكتب من هنا لا من الفريق
      TEAM.normalize(team, st);                                  // لا لاعب مكرر عند الاحتساب
      const squad=team.squad||[];
      if(!squad.length){                                         // لم يكوّن فريقاً بعد
        if(v.email!==undefined) writes.push([d.id, {email: firebase.firestore.FieldValue.delete()}]);
        return;
      }
      count++;
      squad.forEach(pid=>{ own[pid]=(own[pid]||0)+1; });
      (team.transfers||[]).filter(t=>t.gw===gw).forEach(t=>{
        transfers[t.in]=transfers[t.in]||{in:0,out:0};   transfers[t.in].in++;
        transfers[t.out]=transfers[t.out]||{in:0,out:0}; transfers[t.out].out++;
      });
      const joined = v.joinedGW || team.joinedGW || 1;
      if(joined > gw){ board.push(this.boardRow(d.id, v)); return; }                                    // اشترك بعد هذه الجولة
      const prev=(v.history||[]).find(h=>h.gw===gw);
      if(prev && (team.rolledGW||0)>=gw && !opts.recompute){ board.push(this.boardRow(d.id, v)); return; }   // محتسبة ومرحَّلة مسبقاً
      team.gwPicks = team.gwPicks||{};
      if(!team.gwPicks[gw]){
        team.gwPicks[gw] = TEAM.picksFrom(team);
        // احتساب جولة سابقة بلا لقطة: الكرت المفعّل الآن يخص الجولة الجارية لا هذه — لا يُحسب ولا يُستهلك
        if(gw < st.currentGW){ team.gwPicks[gw].chip=null; team.gwPicks[gw].hits=0; }
      }
      // إعادة الاحتساب: نفس الاختيارات المحفوظة، نقاط جديدة من الإحصاءات المصحَّحة
      const res = (prev && !opts.recompute)
        ? {total:+prev.pts||0, benchPts:+prev.benchPts||0, chip:prev.chip||null, hits:+prev.hits||0}
        : computeFn(team, gw);
      rows.push({uid:d.id, data:v, team, res});
    });

    rows.sort((a,b)=>b.res.total-a.res.total);
    let prevPts=null, rank=0;
    rows.forEach((r,i)=>{ if(prevPts===null || r.res.total<prevPts){ rank=i+1; prevPts=r.res.total; } r.rank=rank; });

    rows.forEach(r=>{
      const hist=(r.data.history||[]).filter(h=>h.gw!==gw).concat([{
        gw, pts:r.res.total, benchPts:r.res.benchPts, rank:r.rank,
        chip:r.res.chip||null, hits:r.res.hits||0
      }]).sort((a,b)=>a.gw-b.gw);
      GWADMIN.rollover(r.team, gw, st);
      const team = JSON.parse(JSON.stringify(r.team));           // لا undefined في Firestore
      board.push(this.boardRow(r.uid, r.data, hist, hist.reduce((s,h)=>s+(h.pts||0), 0)));
      writes.push([r.uid, {
        history: hist,
        total: hist.reduce((s,h)=>s+(h.pts||0), 0),
        lastGW: opts.recompute ? Math.max(gw, +r.data.lastGW||0) : gw,   // إعادة احتساب جولة قديمة لا تُرجع lastGW للوراء (وإلا رفض الجهاز كل حفظ)
        team,
        email: firebase.firestore.FieldValue.delete()
      }]);
    });

    // الكتابة على دفعات (حد Firestore 500 عملية للدفعة)
    let done=0;
    for(let i=0;i<writes.length;i+=400){
      const chunk=writes.slice(i,i+400);
      const batch=this.db.batch();
      chunk.forEach(([uid,data])=>batch.set(this.managers().doc(uid), data, {merge:true}));
      const w = await this.race(batch.commit(), 20000);
      if(!w.ok) return {ok:false, err:`تعذّر حفظ نتائج المشتركين (${done} من ${writes.length})`, done};
      done += chunk.length;
    }
    const pts=rows.map(r=>r.res.total);
    board.sort((a,b)=>b.total-a.total || a.name.localeCompare(b.name,'ar'));
    return { ok:true, count, ranked:rows.length, own, transfers, board, skipped,
      avg: pts.length? Math.round(pts.reduce((a,b)=>a+b,0)/pts.length) : null,
      high: pts.length? Math.max(...pts) : null };
  },

  /* ---------- إصلاح كل الفرق وإرجاع الكروت ----------
     لكل مشترك: إزالة التكرار وإصلاح التشكيلة، وتصفير الكروت المستخدمة (تعود كلها متاحة).
     الكرت المفعّل للجولة الحالية يبقى مفعّلاً (يقدر يلغيه). repairedAt يجعل الأجهزة تعتمد النسخة الجديدة. */
  async repairAll(st, opts){
    opts=opts||{};
    if(!this.admin) return {ok:false, err:'للمدير فقط'};
    if(!st.fromCloud) return {ok:false, err:'قائمة اللاعبين على هذا الجهاز ليست النسخة المنشورة — أعد تحميل الصفحة ثم حاول'};
    let snap;
    try{ snap = await this.managers().get(); }
    catch(e){ return {ok:false, err:'تعذّرت قراءة قائمة المشتركين'}; }
    const now=new Date().toISOString();
    const writes=[]; let fixed=0, chips=0;
    snap.forEach(d=>{
      const v=d.data(); if(!v.team || !(v.team.squad||[]).length) return;
      if((v.team.squad||[]).some(pid=>!DB.player(pid))) return;   // لاعب غير معروف على هذا الجهاز: لا نلمس هذا الفريق
      const team=JSON.parse(JSON.stringify(v.team));
      const changed=TEAM.normalize(team, st);
      const hadChips=Object.values(team.usedChips||{}).some(n=>n>0);
      if(opts.resetChips){ team.usedChips={}; }
      if(changed) fixed++;
      if(opts.resetChips && hadChips) chips++;
      if(changed || (opts.resetChips && hadChips)){
        team.repairedAt=now;
        writes.push([d.id, {team}]);
      }
    });
    let done=0;
    for(let i=0;i<writes.length;i+=400){
      const chunk=writes.slice(i,i+400);
      const batch=this.db.batch();
      chunk.forEach(([uid,data])=>batch.set(this.managers().doc(uid), data, {merge:true}));
      const w = await this.race(batch.commit(), 20000);
      if(!w.ok) return {ok:false, err:`تعذّر الحفظ (${done} من ${writes.length})`, done};
      done += chunk.length;
    }
    // فرق هذا الجهاز
    for(const uid in st.teams){ const t=st.teams[uid]; if(TEAM.normalize(t, st) || opts.resetChips){ if(opts.resetChips) t.usedChips={}; t.repairedAt=now; } }
    return {ok:true, total:snap.size, fixed, chips, written:writes.length};
  },

  /* ---------- الدوريات ---------- */
  async createLeague(name, type){
    if(!this.user) return {ok:false, err:'سجّل الدخول أولاً'};
    const code = this.genCode();
    const lg = { name, type: type||'classic', code, owner:this.user.uid,
                 members:[this.user.uid], createdGW:(DB.state? DB.state.currentGW : 1),
                 created:new Date().toISOString(), global:false };
    try{
      const ref = await this.leaguesCol().add(lg);
      return {ok:true, lg:{...lg, id:ref.id}};
    }catch(e){ return {ok:false, err:this.errAr(e)}; }
  },

  async joinLeague(code){
    if(!this.user) return {ok:false, err:'سجّل الدخول أولاً'};
    code = String(code||'').trim().toUpperCase();
    try{
      const q = await this.leaguesCol().where('code','==',code).limit(1).get();
      if(q.empty) return {ok:false, err:'رمز الدوري غير صحيح'};
      const d = q.docs[0], lg = d.data();
      if((lg.members||[]).includes(this.user.uid)) return {ok:false, err:'أنت عضو في هذا الدوري'};
      await d.ref.update({ members: firebase.firestore.FieldValue.arrayUnion(this.user.uid) });
      return {ok:true, lg:{...lg, id:d.id, members:(lg.members||[]).concat([this.user.uid])}};
    }catch(e){ return {ok:false, err:this.errAr(e)}; }
  },

  async myLeagues(){
    if(!this.user) return [];
    try{
      const q = await this.leaguesCol().where('members','array-contains',this.user.uid).get();
      const out=[]; q.forEach(d=>out.push({...d.data(), id:d.id}));
      return out;
    }catch(e){ return []; }
  },

  /* صفوف دوري خاص — يقرأ مستندات أعضائه */
  async leagueRows(lg){
    const ids=(lg.members||[]).slice(0,300);
    const out=[];
    for(let i=0;i<ids.length;i+=10){
      const part=ids.slice(i,i+10);
      try{
        const q=await this.managers().where(firebase.firestore.FieldPath.documentId(),'in',part).get();
        q.forEach(d=>{ const v=d.data();
          const hist=(v.history||[]).filter(h=>lg.global || h.gw>=(lg.createdGW||1));
          out.push({ id:d.id, name:v.username||'مشترك', teamName:v.teamName||'', hist,
                     total:hist.reduce((s,h)=>s+(h.pts||0),0),
                     last:hist.length? (+hist[hist.length-1].pts||0):0 });
        });
      }catch(e){ /* تجاهل الدفعة المتعذّرة */ }
    }
    out.sort((a,b)=>b.total-a.total);
    return out;
  },

  genCode(){
    const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s='';
    for(let i=0;i<6;i++) s+=A[Math.floor(Math.random()*A.length)];
    return s;
  },
};
