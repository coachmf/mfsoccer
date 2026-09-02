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
  OWNER_UID: "iiTgVfDryXNLb9IrOyLkkNMHDxq2",   // مالك الموقع — صلاحية كاملة
  SEASON: "2026-2027",

  db: null, auth: null, user: null,
  ready: false,            // تهيّأت المكتبة والاتصال
  admin: false,            // الحساب الحالي مدير
  staff: {},
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
      this.ready = true; this.state='ready';
      this.auth.onAuthStateChanged(u => this._onAuth(u));
      return true;
    }catch(e){ console.warn('cloud init failed', e); this.state='offline'; return false; }
  },

  async _onAuth(u){
    this.user = u || null;
    this.admin = false; this.staff = {};
    if(u){
      if(u.uid === this.OWNER_UID) this.admin = true;
      else {
        try{
          const s = await this.db.collection('staff').doc('members').get();
          const m = s.exists ? (s.data()||{}) : {};
          this.staff = m;
          const me = m[u.uid];
          this.admin = !!(me && me.active!==false && me.role==='editor');
        }catch(e){ /* قراءة فريق العمل ليست ضرورية للاعب العادي */ }
      }
    }
    this._listeners.forEach(fn=>{ try{ fn(u); }catch(e){ console.warn(e); } });
  },
  onAuth(fn){ this._listeners.push(fn); if(this.state!=='init') fn(this.user); },

  /* ---------- مسارات ---------- */
  root(){ return this.db.collection('fantasy').doc(this.SEASON); },
  managers(){ return this.root().collection('managers'); },
  leaguesCol(){ return this.root().collection('leagues'); },
  round(gw){ return this.root().collection('rounds').doc(String(gw)); },
  playersDoc(){ return this.root().collection('meta').doc('players'); },

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
    try{
      const cred = await this.auth.createUserWithEmailAndPassword(email, pass);
      await this.createManager(cred.user.uid, username, teamName, email);
      try{ await cred.user.sendEmailVerification(); }catch(e){}
      return {ok:true};
    }catch(e){ return {ok:false, err:this.errAr(e)}; }
  },

  async login(email, pass){
    if(!this.ready) return {ok:false, err:'السحابة غير متاحة — تأكد من الاتصال'};
    try{
      await this.auth.signInWithEmailAndPassword(String(email||'').trim().toLowerCase(), pass);
      return {ok:true};
    }catch(e){ return {ok:false, err:this.errAr(e)}; }
  },

  async logout(){ try{ await this.auth.signOut(); }catch(e){} },

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
      'auth/operation-not-allowed':'تسجيل الحسابات غير مفعّل في إعدادات Firebase',
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

  async createManager(uid, username, teamName, email){
    const doc = {
      username, teamName, email: email||'', avatar:'',
      joinedGW: (typeof DB!=='undefined' && DB.state ? DB.state.currentGW : 1),
      created: new Date().toISOString(),
      team: null, history: [], total: 0, lastGW: 0
    };
    await this.managers().doc(uid).set(doc, {merge:true});
    return doc;
  },

  async getManager(uid){
    try{
      const s = await this.managers().doc(uid).get();
      return s.exists ? s.data() : null;
    }catch(e){ return null; }
  },

  /* حفظ الملف والفريق — لا يمسّ history ولا total (المدير وحده يكتبهما) */
  async saveMyTeam(profile, team){
    if(!this.user) return false;
    const patch = {team: team||null, updated:new Date().toISOString()};
    if(profile){
      if(profile.username!=null) patch.username = profile.username;
      if(profile.teamName!=null) patch.teamName = profile.teamName;
      if(profile.avatar  !=null) patch.avatar   = profile.avatar;
    }
    const r = await this.race(this.managers().doc(this.user.uid).set(patch, {merge:true}));
    return r.ok === true;
  },

  /* لوحة الترتيب العام — من نقاط المشتركين الحقيقيين */
  async leaderboard(limit){
    try{
      const q = await this.managers().orderBy('total','desc').limit(limit||100).get();
      const rows=[];
      q.forEach(d=>{ const v=d.data(); rows.push({
        id:d.id, name:v.username||'مشترك', teamName:v.teamName||'', total:+v.total||0,
        last:(v.history&&v.history.length)? (+v.history[v.history.length-1].pts||0) : 0 }); });
      return rows;
    }catch(e){ return null; }
  },

  async managerCount(){
    try{ const q=await this.managers().get(); return q.size; }catch(e){ return null; }
  },

  /* ---------- حالة اللعبة (المدير يكتبها، الجميع يقرؤها) ---------- */
  async loadGame(){
    if(!this.ready) return null;
    try{
      const s = await this.root().get();
      return s.exists ? s.data() : null;
    }catch(e){ return null; }
  },

  async loadPlayers(){
    try{
      const s = await this.playersDoc().get();
      return s.exists ? (s.data().list || null) : null;
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
      updated: new Date().toISOString(),
      updatedBy: (this.user && this.user.email) || ''
    };
    let r = await this.race(this.root().set(meta, {merge:true}));
    if(!r.ok) return {ok:false, err: r.timeout ? 'الاتصال بطيء — لم يكتمل النشر' : this.errAr(r.err)};

    r = await this.race(this.playersDoc().set({list: st.players, updated: meta.updated}));
    if(!r.ok) return {ok:false, err:'نُشرت الإعدادات لكن تعذّر نشر اللاعبين'};

    // الجولات: كل جولة في مستند مستقل حتى لا يتجاوز الحد الأعلى للمستند
    const byGW = {};
    st.fixtures.forEach(f=>{ (byGW[f.gw] = byGW[f.gw] || []).push(f); });
    for(const gw in byGW){
      const pg = {};
      for(const pid in st.playerGW){ const row=st.playerGW[pid][gw]; if(row) pg[pid]=row; }
      const rr = await this.race(this.round(gw).set({fixtures: byGW[gw], playerGW: pg, updated: meta.updated}));
      if(!rr.ok) return {ok:false, err:`تعذّر نشر الجولة ${gw}`};
    }
    return {ok:true, rounds:Object.keys(byGW).length};
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
    return r.ok ? {ok:true} : {ok:false, err:'نُشرت المباريات لكن تعذّر تحديث حالة الجولات'};
  },

  /* ---------- احتساب الجولة للجميع ---------- */
  /* يجلب كل المشتركين، يحسب نقاط كل فريق من إحصاءات المباريات،
     ثم يكتب السجل والمجموع في مستند كل مشترك. المدير وحده. */
  async finalizeForAll(st, gw, computeFn){
    if(!this.admin) return {ok:false, err:'الاحتساب للمدير فقط'};
    let snap;
    try{ snap = await this.managers().get(); }
    catch(e){ return {ok:false, err:'تعذّر قراءة قائمة المشتركين'}; }

    const rows=[];
    snap.forEach(d=>{
      const v=d.data();
      if(!v.team || !(v.team.squad||[]).length) return;     // لم يكوّن فريقاً بعد
      if((v.joinedGW||1) > gw) return;                       // اشترك بعد هذه الجولة
      if((v.history||[]).some(h=>h.gw===gw)) return;          // محتسبة له مسبقاً
      const res = computeFn(v.team, gw);
      rows.push({uid:d.id, data:v, res});
    });

    rows.sort((a,b)=>b.res.total-a.res.total);
    let prev=null, rank=0;
    rows.forEach((r,i)=>{ if(prev===null || r.res.total<prev){ rank=i+1; prev=r.res.total; } r.rank=rank; });

    // الكتابة على دفعات (حد Firestore 500 عملية للدفعة)
    let done=0;
    for(let i=0;i<rows.length;i+=400){
      const chunk=rows.slice(i,i+400);
      const batch=this.db.batch();
      chunk.forEach(r=>{
        const hist=(r.data.history||[]).concat([{
          gw, pts:r.res.total, benchPts:r.res.benchPts, rank:r.rank,
          chip:r.res.chip||null, hits:r.res.hits||0
        }]);
        batch.set(this.managers().doc(r.uid), {
          history: hist,
          total: hist.reduce((s,h)=>s+(h.pts||0), 0),
          lastGW: gw
        }, {merge:true});
      });
      const w = await this.race(batch.commit(), 15000);
      if(!w.ok) return {ok:false, err:`تعذّر حفظ نتائج ${done} من ${rows.length} مشتركاً`, done};
      done += chunk.length;
    }
    return {ok:true, count:done, ranked:rows.length};
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
          out.push({ id:d.id, name:v.username||'مشترك', teamName:v.teamName||'',
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
