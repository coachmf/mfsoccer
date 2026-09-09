/* =========================================================
   المحرك: قاعدة البيانات + النقاط + المحاكاة + الأسعار + الترتيب
   ========================================================= */

'use strict';

/* ---------- أدوات عامة ---------- */
function hashStr(s){ let h=2166136261; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619);} return h>>>0; }
function mulberry32(seed){ let a=seed>>>0; return function(){ a|=0; a=(a+0x6D2B79F5)|0; let t=Math.imul(a^(a>>>15),1|a); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }; }
function gauss(rng){ return Math.sqrt(-2*Math.log(1-rng()))*Math.cos(2*Math.PI*rng()); }
function fmtM(v){ return v.toFixed(1); }
/* العملة: مسمّى للعرض فقط — الأرقام المخزّنة (أسعار، رصيد، ميزانية) لا تتغيّر */
const CUR='KWD';
/* عزل اتجاه النص (LRI…PDI) حتى تبقى العملة بعد الرقم على يمينه داخل النص العربي: 79.5 KWD */
function fmtK(v){ return '⁦'+fmtM(v)+' '+CUR+'⁩'; }
function esc(s){ return String(s??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
const POS_AR = { G:'حارس', D:'مدافع', M:'وسط', F:'مهاجم' };
const POS_ORDER = { G:0, D:1, M:2, F:3 };

const DB = {
  /* رقم النسخة يُرفع عند أي تغيير جوهري في البذرة (كشف اللاعبين أو
     أسعارهم). الحالة المحفوظة تُبنى من جديد بدل أن تبقى على بيانات
     قديمة — syncPlayers تضيف الجدد فقط ولا تصحّح أسعار الموجودين. */
  KEY: 'kwfantasy_v18',
  state: null,

  load(){
    try{
      const raw = localStorage.getItem(this.KEY);
      if(raw){ this.state = JSON.parse(raw); if(this.state && this.state.ver===1){ this.syncClubs(); this.syncPlayers(); this.syncScoring();
        if((this.state.priceVer||0) < SEED_PRICE_VER){ this.applySeedPrices(); this.save(); }
        if(normalizeFixtures(this.state)) this.save();
        return; } }
    }catch(e){ console.warn('storage read failed', e); }
    this.state = buildSeedState();
    this.save();
  },
  save(){
    this.dirtyAt=Date.now();
    try{ const me=this.state.session; if(me && this.state.teams[me] && typeof TEAM!=='undefined') TEAM.normalize(this.state.teams[me], this.state); }catch(e){}
    try{ localStorage.setItem(this.KEY, JSON.stringify(this.state)); }
    catch(e){ console.warn('storage write failed', e); }
    this.pushTeam();
  },

  /* ---------- المزامنة مع السحابة ---------- */

  /* حالة اللعبة المشتركة (قواعد، جولات، مباريات، إحصاءات) تُقرأ من السحابة.
     فريق المشترك يُقرأ من مستنده. الجهاز يبقى نسخة احتياطية للعمل بلا شبكة. */
  async hydrate(){
    if(typeof CLOUD==='undefined' || !CLOUD.ready) return {ok:false, err:'offline'};
    const st=this.state;
    const [game, ownDoc] = await Promise.all([CLOUD.loadGame(), CLOUD.loadOwn()]);
    if(!game) return {ok:false, err:'no-game'};      // المدير لم ينشر بعد
    /* اللاعبون والجولات (23 مستنداً) لا تُقرأ إلا إذا تغيّرت اللعبة منذ آخر تحميل ناجح على هذا الجهاز:
       الفتح المعتاد يكلّف قراءتين بدل ~25 — أكبر توفير في حصة القراءات المجانية */
    const unchanged = !!game.updated && st.cloudUpdated===game.updated && st.fromCloud && (st.players||[]).length>0 && (st.fixtures||[]).length>0;
    const [players, rounds] = unchanged ? [null, null] : await Promise.all([CLOUD.loadPlayers(), CLOUD.loadRounds()]);

    if(game.rules)   st.rules   = game.rules;
    /* أسماء الكروت ووصفها من الكود دائماً (قابلة للتحديث فوراً على كل الأجهزة)،
       مع إبقاء «مرّات الاستخدام» و«التفعيل» من ضبط المدير في السحابة. */
    if(st.rules && st.rules.chips && typeof SEED_RULES!=='undefined' && SEED_RULES.chips){
      for(const k in SEED_RULES.chips){
        if(st.rules.chips[k]){ st.rules.chips[k].label=SEED_RULES.chips[k].label; st.rules.chips[k].desc=SEED_RULES.chips[k].desc; }
        else st.rules.chips[k]={...SEED_RULES.chips[k]};
      }
    }
    /* سياسة التغييرات الحرة من الكود دائماً (تسري فوراً بلا إعادة نشر) */
    if(st.rules && typeof SEED_RULES!=='undefined'){ st.rules.freeChanges = SEED_RULES.freeChanges; st.rules.scoringFromGW = SEED_RULES.scoringFromGW; }
    if(game.scoring) st.scoring = game.scoring;
    if(game.clubs)   st.clubs   = game.clubs;
    if(game.news)    st.news    = game.news;
    if(game.gws)     st.gws     = game.gws;
    if(game.currentGW) st.currentGW = game.currentGW;
    if(game.own)            st.own = game.own;                     // تملّك اللاعبين — يحسبه المدير عند الاحتساب
    if(Array.isArray(game.board)) st.board = game.board;           // لقطة الترتيب العام — ينشرها المدير مع التملّك
    if(game.managerCount!=null) st.managerCount = +game.managerCount;
    if(game.ownUpdated)     st.ownUpdated = game.ownUpdated;
    if(game.transferStats)  st.transferStats = game.transferStats;
    CLOUD.applyOwn(st, ownDoc);                                    // meta/own أحدث من نسخة مستند اللعبة (ينشرها المدير كل ساعة)
    this.cloudUpdated = game.updated || null;
    if(players && players.list && players.list.length){
      st.players = players.list; st.fromCloud = true;
      // إعادة تسعير شاملة في البذرة لم تُنشر بعد: تُطبَّق محلياً (المدير ينشرها فتصل للجميع)
      if((+players.priceVer||0) < SEED_PRICE_VER) this.applySeedPrices();
    }

    if(rounds){
      st.playerGW = {};
      const keep = st.fixtures.filter(f => !rounds[f.gw]);
      const merged = keep.slice();
      Object.keys(rounds).sort((a,b)=>a-b).forEach(gw=>{
        (rounds[gw].fixtures||[]).forEach(f=>merged.push(f));
        const pg = rounds[gw].playerGW||{};
        for(const pid in pg){ st.playerGW[pid]=st.playerGW[pid]||{}; st.playerGW[pid][gw]=pg[pid]; }
      });
      merged.sort((a,b)=>(a.gw-b.gw) || String(a.date||'').localeCompare(String(b.date||'')));
      st.fixtures = merged;
      normalizeFixtures(st);
      if(typeof MFSYNC!=='undefined' && MFSYNC.applyCached) MFSYNC.applyCached();   // الجدول من mfsoccer يغلب أي جدول منشور قديم
    }
    if(unchanged || (players && players.list && players.list.length && rounds)) st.cloudUpdated = game.updated;   // تحميل كامل ناجح: نحفظ الطابع
    this.cloudAt = Date.now();
    try{ localStorage.setItem(this.KEY, JSON.stringify(st)); }catch(e){}
    return {ok:true};
  },

  /* استبدال جلسة الجهاز بحساب السحابة */
  async adoptManager(uid, doc){
    const st=this.state;
    let u = st.users.find(x=>x.id===uid);
    if(!u){ u={id:uid}; st.users.push(u); }
    u.username = doc.username || 'مشترك';
    u.email    = doc.email || '';
    u.teamName = doc.teamName || 'فريقي';
    u.avatar   = doc.avatar || '';
    u.verified = true;
    st.session = uid;

    const blank = { squad:[],xi:[],bench:[],cap:null,vice:null,bank:st.rules.budget,ft:st.rules.freeTransfers,
      usedChips:{},activeChip:null,joinedGW:doc.joinedGW||st.currentGW,history:[],transfers:[],gwPicks:{},pendingHits:0 };
    // فريق كوّنه صاحبه على هذا الجهاز (كضيف أو قبل أن تصل كتابته للخادم) ومستند الخادم بلا فريق:
    // يُرحَّل للحساب ويُرفع بدل أن يُطمس بفريق فارغ.
    const prevLocal = st.teams[uid] || st.teams['u1local'];
    const cloudEmpty = !doc.team || !(doc.team.squad||[]).length;
    let t;
    if(cloudEmpty && prevLocal && (prevLocal.squad||[]).length===st.rules.squadSize && !(prevLocal.history||[]).length){
      t = Object.assign(blank, JSON.parse(JSON.stringify(prevLocal)));
      t.joinedGW = doc.joinedGW || st.currentGW;
      this.pendingPush = true;
    } else if(cloudEmpty && prevLocal && (prevLocal.squad||[]).length){
      // مستند الخادم بلا فريق (قراءة ناقصة/ملف مؤقت) بينما على الجهاز فريق: لا نطمس فريق المشترك بفريق فارغ أبداً
      t = Object.assign(blank, JSON.parse(JSON.stringify(prevLocal)));
    } else t = Object.assign(blank, doc.team||{});
    if(typeof VIEWS!=='undefined' && VIEWS.ui){ VIEWS.ui.tOut=[]; VIEWS.ui.tIn=[]; }   // مسودة انتقالات قديمة لا تصلح لفريق جديد
    t.history = doc.history || [];         // السجل مصدره السحابة وحدها
    t.joinedGW = doc.joinedGW || t.joinedGW;
    if(TEAM.normalize(t, st)) this.pendingPush = true;   // فريق فيه تكرار: يُصلَح ويُرفع
    st.teams[uid] = t;
    if(st.teams['u1local'] && uid!=='u1local') delete st.teams['u1local'];
    try{ localStorage.setItem(this.KEY, JSON.stringify(st)); }catch(e){}
  },

  /* إعادة قراءة حالة اللعبة من السحابة إن تغيّرت (نشر جولة أو احتساب) —
     تُستدعى دورياً وعند العودة للصفحة، فلا يبقى جهاز على جولة قديمة. */
  async refreshFromCloud(){
    if(typeof CLOUD==='undefined' || !CLOUD.ready) return false;
    const game = await CLOUD.loadGame(); if(!game) return false;
    if(game.updated && game.updated===this.cloudUpdated && game.currentGW===this.state.currentGW) return false;
    this.muted = true; clearTimeout(this._pushT);
    try{
      await this.hydrate();
      if(CLOUD.user){ const doc=await CLOUD.getManager(CLOUD.user.uid); if(doc) await this.adoptManager(CLOUD.user.uid, doc); }
    }catch(e){ console.warn('refresh failed', e); }
    this.muted = false;
    if(this.pendingPush){ this.pendingPush=false; this.pushTeam(); }
    return true;
  },

  /* رفع فريق المشترك — مؤجَّل حتى لا نكتب مع كل ضغطة */
  pushTeam(){
    if(typeof CLOUD==='undefined' || !CLOUD.user) return;
    if(this.muted){ this.pendingPush=true; return; }     // يُرفع بعد انتهاء المزامنة
    clearTimeout(this._pushT);
    this._pushT = setTimeout(()=>this.pushTeamNow(), 900);
  },
  async pushTeamNow(){
    if(typeof CLOUD==='undefined' || !CLOUD.user) return false;
    if(this.muted){ this.pendingPush=true; return false; }           // أثناء تبديل/تحديث الحساب لا نكتب شيئاً
    const uid=CLOUD.user.uid, t=this.state.teams[uid], u=this.user(uid);
    if(!t) return false;
    if(!this.state.fromCloud){ this.pendingPush=true; return false; }   // قائمة اللاعبين ليست المنشورة: قد تكون معرّفات ناقصة — لا نرفع
    // احتسب المدير جولة بعد آخر تحميل؟ مستند الخادم (انتقالات، كروت، سجل) أحدث من نسخة الجهاز — نعتمده بدل طمسه
    const remote = await CLOUD.getManager(uid);
    if(remote===undefined){ this.pendingPush=true; return false; }    // تعذّرت قراءة الخادم: لا نرفع على العمياني
    if(this.noPush){                                                    // كان الإقلاع بلا قراءة ناجحة: أول قراءة ناجحة تُعتمد أولاً
      this.noPush=false;
      if(remote){ this.muted=true; try{ await this.adoptManager(uid, remote); } finally{ this.muted=false; }
        if(typeof APP!=='undefined') APP.render(); return false; }
    }
    if(remote && remote.lastGW>0 && remote.lastGW!==(t.rolledGW||0) && remote.team && (remote.team.squad||[]).length){
      await this.adoptManager(uid, remote);
      if(typeof UI!=='undefined') UI.toast(`حُدّث فريقك بعد احتساب الجولة ${remote.lastGW}`);
      if(typeof APP!=='undefined') APP.render();
      return false;
    }
    // المدير أصلح الفريق أو أرجع الكروت على الخادم بعد آخر تحميل: نعتمد نسخته بدل طمسها
    if(remote && remote.team && remote.team.repairedAt && remote.team.repairedAt!==(t.repairedAt||null)){
      await this.adoptManager(uid, remote);
      if(typeof UI!=='undefined') UI.toast('حُدّث فريقك من الخادم');
      if(typeof APP!=='undefined') APP.render();
      return false;
    }
    const profile = u? {username:u.username, teamName:u.teamName, avatar:u.avatar} : null;
    // بعد الإغلاق: الملف الشخصي يُحفظ، والتشكيلة لا تُرسل أصلاً — والخادم يرفضها كذلك
    if(GWADMIN.deadlinePassed(this.state.currentGW)) return await CLOUD.saveMyTeam(profile, undefined);
    const {history, ...team} = t;                 // السجل لا يُرفع: المدير يكتبه
    return await CLOUD.saveMyTeam(profile, team);
  },
  reset(){ try{ localStorage.removeItem(this.KEY);}catch(e){} this.state = buildSeedState(); this.save(); },

  // ترحيل: تحويل حالة محفوظة بالنظام القديم إلى نظام النقاط الأساسي
  syncScoring(){
    const st=this.state;
    if(st.scoring && st.scoring.appearance && !st.scoring.savesPer && !st.scoring.bonus1) return; // النظام الحالي مطبق
    st.scoring = JSON.parse(JSON.stringify(SEED_SCORING));
    st.playerGW = {};
    st.fixtures.filter(f=>f.status==='F').forEach(f=>{ genMatchStats(st,f); });
    st.gws.filter(g=>g.status==='finished').forEach(g=>{ finalizeGWStats(st,g.n); });
    for(const uid in st.teams){
      const t=st.teams[uid];
      (t.history||[]).forEach(h=>{
        const res=TEAM.gwPoints(t,h.gw,st);
        h.pts=res.total; h.benchPts=res.benchPts;
      });
    }
    st.gws.filter(g=>g.status==='finished').forEach(g=>RANKS.recomputeGWRanks(st,g.n));
    this.save();
  },

  /* تطبيق أسعار البذرة (price + startPrice) على اللاعبين بالاسم — عند رفع SEED_PRICE_VER */
  applySeedPrices(){
    const st=this.state;
    const nn=s=>(s||'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/\s+/g,'');
    let n=0;
    SEED_PLAYERS.forEach(t=>{
      const p=st.players.find(x=>x.club===t[0] && nn(x.name)===nn(t[2]));
      if(p && (p.price!==t[3] || p.startPrice!==t[3])){ p.price=t[3]; p.startPrice=t[3]; n++; }
    });
    st.priceVer=SEED_PRICE_VER;
    return n;
  },
  // أي لاعب جديد يُضاف للبذرة يدخل الحالة المحفوظة تلقائياً (بدون مسح الفرق)
  syncPlayers(){
    const st=this.state;
    if(st.fromCloud) return;      // قائمة اللاعبين من نشر المدير — لا تُضاف معرّفات محلية فوقها
    const nn=s=>(s||'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/\s+/g,'');
    let maxId=st.players.reduce((m,p)=>Math.max(m,+String(p.id).replace(/\D/g,'')||0),0);
    let dirty=false;
    SEED_PLAYERS.forEach(t=>{
      if(st.players.some(p=>p.club===t[0] && nn(p.name)===nn(t[2]))) return;
      st.players.push({ id:'p'+(++maxId), club:t[0], pos:t[1], name:t[2], price:t[3], startPrice:t[3],
        shirt:t[4]||0, status:'a', news:'', photo:'' });
      dirty=true;
    });
    if(dirty) this.save();
  },

  // بيانات الأندية الثابتة تُقرأ دائماً من SEED_CLUBS حتى لو الحالة محفوظة من قبل
  syncClubs(){
    let dirty=false;
    (this.state.clubs||[]).forEach(c=>{
      const s=SEED_CLUBS.find(x=>x.id===c.id); if(!s) return;
      ['name','short','crest','color','dark','stadium'].forEach(k=>{ if(c[k]!==s[k]){ c[k]=s[k]; dirty=true; } });
    });
    if(dirty) this.save();
  },

  club(id){ return this.state.clubs.find(c=>c.id===id); },
  player(id){ return this.state.players.find(p=>p.id===id); },
  user(id){ return this.state.users.find(u=>u.id===id); },
  me(){ return this.state.session ? this.user(this.state.session) : null; },
  myTeam(){ const m=this.me(); return m ? this.state.teams[m.id] : null; },
  gw(n){ return this.state.gws.find(g=>g.n===n); },
  fixturesOf(gw){ return this.state.fixtures.filter(f=>f.gw===gw); },
  pgw(pid,gw){ const p=this.state.playerGW[pid]; return p ? p[gw] : null; },

  playerTotal(pid){
    let t=0; const rows=this.state.playerGW[pid]||{};
    for(const gw in rows) t+=rows[gw].pts;
    return t;
  },
  playerForm(pid){ // متوسط آخر 4 جولات منتهية
    const rows=this.state.playerGW[pid]||{}; const gws=Object.keys(rows).map(Number).sort((a,b)=>b-a).slice(0,4);
    if(!gws.length) return 0;
    return gws.reduce((s,g)=>s+rows[g].pts,0)/gws.length;
  },
  playerStatSum(pid, key){
    let t=0; const rows=this.state.playerGW[pid]||{};
    for(const gw in rows) t+=rows[gw][key]||0;
    return t;
  },
};

/* =========================================================
   بناء الحالة الأولية
   ========================================================= */
function buildSeedState(){
  const clubs = SEED_CLUBS.map(c=>({...c}));
  const players = SEED_PLAYERS.map((t,i)=>({
    id:'p'+(i+1), club:t[0], pos:t[1], name:t[2], price:t[3], startPrice:t[3],
    shirt:t[4]||0, status:'a', news:'', photo:'',
  }));

  const fixtures = buildFixtures();
  const gws = buildGameweeks(fixtures);

  const st = {
    ver:1, clubs, players, fixtures, gws,
    currentGW: 3,
    playerGW: {},
    priceVer: SEED_PRICE_VER,
    scoring: JSON.parse(JSON.stringify(SEED_SCORING)),
    rules: JSON.parse(JSON.stringify(SEED_RULES)),
    users: [], teams: {}, session: null,
    leagues: [ {id:'L1', code:'OVERALL', name:'الترتيب العام — دوري زين الممتاز', type:'classic', owner:null, members:[], global:true} ],
    bots: [],   // لا مدراء وهميين — الترتيب والدوريات للمشتركين الحقيقيين فقط
    news: SEED_NEWS.map((n,i)=>({id:'n'+(i+1),...n})),
    notifications: {},
    transferStats: {},
    verifyCodes: {},
    liveSpeed: 2,
  };

  // احتساب الجولتين 1 و2 من النتائج الحقيقية
  for(const res of SEED_RESULTS){
    const fx = st.fixtures.find(f=>f.gw===res.gw && f.h===res.h && f.a===res.a);
    fx.hs=res.hs; fx.as=res.as; fx.status='F'; fx.est=!!res.est; fx.venue=res.venue; fx.date=res.date;
    fx.goals = res.goals.map(g=>({min:g[0], scorer:g[1], club:g[2], assist:g[3], pen:g[4], og:!!g[5]}));
    genMatchStats(st, fx);
  }
  for(const n of [1,2]){ finalizeGWStats(st,n); }
  st.gws.find(g=>g.n===1).status='finished';
  st.gws.find(g=>g.n===2).status='finished';
  st.gws.find(g=>g.n===3).status='next';
  return st;
}

/* المباريات: من موقع mfsoccer فقط (MFSYNC.syncFixtures). البذرة تحمل الجولات
   المعروفة كنسخة احتياطية بلا اتصال؛ الجولة التي لم يُنشر جدولها تبقى فارغة ولا تُولَّد. */
function buildFixtures(){
  const rounds = {};
  SEED_RESULTS.forEach(r=>{ (rounds[r.gw]=rounds[r.gw]||[]).push([r.h, r.a, r.date||null]); });
  (typeof SEED_FIXTURES!=='undefined'? SEED_FIXTURES:[]).forEach(([gw,h,a,date])=>{
    (rounds[gw]=rounds[gw]||[]).push([h, a, date||null]);
  });
  const stadium = id => (SEED_CLUBS.find(c=>c.id===id)||{}).stadium||'';
  const fixtures=[];
  Object.keys(rounds).map(Number).sort((a,b)=>a-b).forEach(gw=>{
    rounds[gw].forEach(([h,a,date])=>{
      fixtures.push({ id:fixtureId(gw,h,a), gw, h, a, hs:null, as:null, goals:[],
        venue: stadium(h), date: date||null, status:'U', est:false, live:null });
    });
  });
  return fixtures;
}
function fixtureId(gw,h,a){ return `f${gw}_${h}_${a}`; }
function pairKey(a,b){ return [a,b].sort().join('-'); }

/* مواعيد المباريات تُكتب بتوقيت الكويت بلا منطقة زمنية («2026-09-10T18:40»)؛
   نثبّتها على +03:00 حتى تتطابق المواعيد على كل الأجهزة أياً كانت منطقتها. */
function kwDate(v){
  if(v instanceof Date) return v;
  const str=String(v||'');
  if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(str)) return new Date(str+(str.length===16?':00':'')+'+03:00');
  return new Date(str);
}
/* موعد الإغلاق = بداية أول مباراة بالجولة (التغييرات مفتوحة حتى انطلاقها)؛
   جولة بلا مباريات = بلا موعد (مفتوحة) */
function computeDeadlines(gws, fixtures){
  gws.forEach(g=>{
    if(g.status==='finished' || g.deadlineManual) return;
    const dates=fixtures.filter(f=>f.gw===g.n && f.date).map(f=>kwDate(f.date)).filter(d=>!isNaN(d)).sort((a,b)=>a-b);
    if(!dates.length){ g.deadline=null; return; }
    g.deadline=new Date(dates[0]).toISOString();   /* مع بداية أول مباراة، بلا خصم 90 دقيقة */
  });
}
function buildGameweeks(fixtures){
  const gws=[];
  for(let n=1;n<=22;n++) gws.push({ n, deadline:null, status:'future', avg:null, high:null });
  computeDeadlines(gws, fixtures);
  return gws;
}

/* =========================================================
   توليد إحصاءات المباراة من الأحداث الحقيقية
   ========================================================= */
/* الدقيقة المطلقة من (الشوط، الدقيقة) — مطابقة لنظيرتها في الموقع الرئيسي */
function absMinute(h, m){
  const mm = +m || 0;
  if(+h === 2 && mm <= 45) return 45 + mm;
  return mm;
}

/* تصحيح التشكيلة من التبديلات (يعمل على أي مباراة، قديمة أو مستوردة الآن):
   - بديل (b) لا يوجد له «دخول» في التبديلات = لم يلعب → يُحذف من التشكيلة
   - من «دخل» في التبديلات = b حتى لو كُتب أساسياً خطأً
   - من «خرج» وهو غير مذكور = أساسي ناقص من الكشف → s
   يعيد true إذا تغيّر شيء. */
function fixLineupsFromSubs(st, f){
  if(!f.lineups) return false;
  const find=(name,clubId)=>st.players.find(p=>p.club===clubId && p.name===name);
  let changed=false;
  for(const cid of [f.h,f.a]){
    const lu=f.lineups[cid]; if(!lu) continue;
    const ins=new Set(), outs=new Set();
    (f.subs||[]).filter(s=>s.club===cid).forEach(s=>{
      const pi=s.in? find(s.in,cid):null;  if(pi) ins.add(pi.id);
      const po=s.out? find(s.out,cid):null; if(po) outs.add(po.id);
    });
    for(const pid in lu){
      if(lu[pid]==='b' && !ins.has(pid)){ delete lu[pid]; changed=true; }
      else if(lu[pid]==='s' && ins.has(pid)){ lu[pid]='b'; changed=true; }
    }
    ins.forEach(pid=>{ if(lu[pid]!=='b'){ lu[pid]='b'; changed=true; } });
    outs.forEach(pid=>{ if(!lu[pid]){ lu[pid]='s'; changed=true; } });
  }
  return changed;
}
/* تُطبَّق على كل المباريات المنتهية (بعد التحميل من الجهاز أو السحابة) — بيانات النسخ القديمة
   كانت تُعلِّم كل لاعبي النادي بدلاء؛ هنا تُصحَّح وتُعاد إحصاءاتها بلا تدخل. */
function normalizeFixtures(st){
  let n=0;
  (st.fixtures||[]).forEach(f=>{
    if(f.status!=='F' || !f.lineups) return;
    if(!fixLineupsFromSubs(st,f)) return;
    if(f.stats){ for(const cid in f.stats){ for(const pid in f.stats[cid]){ if(st.playerGW[pid]) delete st.playerGW[pid][f.gw]; } } }
    genMatchStats(st,f); n++;
  });
  return n;
}

function genMatchStats(st, fx){
  // كل شيء من بيانات حقيقية: التشكيلة والتبديلات من موقع النتائج
  // + الأهداف/الكروت/الجزاءات/البونص. لا توليد عشوائي.
  const find=(name,clubId)=>st.players.find(p=>p.club===clubId && p.name===name);
  // on/off = دقيقة الدخول والخروج (لحساب الأهداف المستقبلة أثناء وجوده في الملعب)
  const mkRow=(min,on,off)=>({min,on,off,g:0,a:0,cs:0,gc:0,ps:0,pm:0,og:0,yc:0,rc:0,bonus:0,pts:0});
  fx.stats={}; fx.stats[fx.h]={}; fx.stats[fx.a]={};
  for(const clubId of [fx.h, fx.a]){
    const lu=(fx.lineups||{})[clubId]||{};
    for(const pid in lu){
      // أساسي يبدأ بـ90 دقيقة ثم تُقصّ عند خروجه؛ من دخل بديلاً تُضبط دقائقه من التبديلات
      // (بديل مُعلَّم يدوياً بلا تبديل مسجَّل: 30 دقيقة افتراضاً). من ليس في التشكيلة لم يلعب.
      if(lu[pid]==='s') fx.stats[clubId][pid]=mkRow(90,0,90);
      else if(lu[pid]==='b') fx.stats[clubId][pid]=mkRow(30,60,90);
    }
  }
  /* التبديلات: تُحدّد دقائق الخارج والداخل بدقة */
  (fx.subs||[]).forEach(s=>{
    const clubId=s.club; const rows=fx.stats[clubId]; if(!rows) return;
    const at=Math.max(0, Math.min(90, absMinute(s.h, s.m)));
    if(s.out){
      const po=find(s.out, clubId);
      if(po){
        if(!rows[po.id]) rows[po.id]=mkRow(90,0,90);
        const r=rows[po.id];
        // خرج بعدما دخل بديلاً: دقائقه = الخروج − الدخول
        r.off=at; r.min=Math.max(1, at-(r.on||0));
      }
    }
    if(s.in){
      const pi=find(s.in, clubId);
      // من دخل في الدقيقة 90 شارك فعلاً — دقيقة واحدة على الأقل ليأخذ نقطة المشاركة
      if(pi){ if(!rows[pi.id]) rows[pi.id]=mkRow(0,null,null); rows[pi.id].min=Math.max(1, 90-at); rows[pi.id].on=at; rows[pi.id].off=90; }
    }
  });
  const rowFor=(name,clubId)=>{
    const p=find(name,clubId); if(!p) return null;
    const rows=fx.stats[clubId];
    if(!rows[p.id]) rows[p.id]=mkRow(90,0,90); // مساهم غير محدد بالتشكيلة يُحتسب أساسياً
    return rows[p.id];
  };
  (fx.goals||[]).forEach(g=>{
    if(g.og){ const oc=g.club===fx.h?fx.a:fx.h; const r=rowFor(g.scorer,oc); if(r) r.og++; return; }
    const r=rowFor(g.scorer,g.club); if(r) r.g++;
    if(g.assist){ const a=rowFor(g.assist,g.club); if(a) a.a++; }
  });
  // كرت لمن ليس في التشكيلة ولا التبديلات (والتشكيلة معروفة): كرت من الدكة — لا مشاركة ولا خصم
  const listed=(name,clubId)=>{ const lu=(fx.lineups||{})[clubId]; if(!lu) return true; const p=find(name,clubId); return !!(p && (lu[p.id] || fx.stats[clubId][p.id])); };
  (fx.cards||[]).forEach(c=>{ if(!listed(c.name,c.club)) return; const r=rowFor(c.name,c.club); if(!r) return; if(c.type==='r') r.rc++; else r.yc++; });
  (fx.pens||[]).forEach(pn=>{ const r=rowFor(pn.name,pn.club); if(!r) return; if(pn.type==='save') r.ps++; else r.pm++; });
  (fx.bonus||[]).forEach(b=>{ const r=rowFor(b.name,b.club); if(r) r.bonus=(+b.pts||0); });
  // بديل له هدف/كرت/جزاء لكن بلا تبديل مسجَّل: شارك فعلاً — دقيقة واحدة على الأقل (لا يُصفَّر)
  for(const clubId of [fx.h, fx.a]){
    for(const pid in fx.stats[clubId]){
      const r=fx.stats[clubId][pid];
      if(r.min===0 && (r.g||r.a||r.yc||r.rc||r.ps||r.pm||r.og)){ r.min=1; r.on=89; r.off=90; }
    }
  }
  // الأهداف المستقبلة أثناء وجوده في الملعب، والشباك النظيفة (60+ دقيقة بلا هدف عليه) — كقاعدة FPL
  for(const side of ['h','a']){
    const clubId=fx[side]; const conceded=(side==='h'?fx.as:fx.hs)||0;
    const against=(fx.goals||[]).filter(g=>g.club!==clubId).map(g=>Math.min(90, +g.min||0));
    const timed = against.length===conceded && against.every(m=>m>0);
    const rows=fx.stats[clubId];
    for(const pid in rows){
      const r=rows[pid];
      if(timed && r.on!=null) r.gc=against.filter(m=> m>r.on && m<=r.off).length;
      else r.gc=conceded;                       // بلا دقائق للأهداف: تُحسب على الجميع
      r.cs=(r.gc===0 && r.min>=60)?1:0;
    }
  }
  scoreFixture(st, fx);
}

function scoreFixture(st, fx){
  const S = k => st.scoring[k] ? st.scoring[k].val : 0;
  for(const clubId of [fx.h, fx.a]){
    const rows = (fx.stats||{})[clubId]||{};
    for(const pid in rows){
      const r=rows[pid]; const p=st.players.find(x=>x.id===pid);
      if(!p) continue;
      // بديل لم يشارك: صفر دقيقة = صفر نقطة، بلا نقطة مشاركة
      if(!(r.min > 0)){
        r.pts = 0;
        st.playerGW[pid] = st.playerGW[pid]||{};
        st.playerGW[pid][fx.gw] = r;
        continue;
      }
      let pts = r.min>=60 ? S('appearance60') : S('appearance');
      pts += r.g*S('goal'+p.pos) + r.a*S('assist');
      if(r.cs){ if(p.pos==='G') pts+=S('csG'); else if(p.pos==='D') pts+=S('csD'); else if(p.pos==='M') pts+=S('csM'); }
      pts += r.ps*S('penSave') + r.pm*S('penMiss') + r.og*S('ownGoal');
      pts += r.yc*S('yellow') + r.rc*S('red');
      if((p.pos==='G'||p.pos==='D') && r.min>=60) pts += Math.floor((r.gc||0)/2)*S('concededPer2');
      pts += r.bonus||0;
      r.pts = pts;
      st.playerGW[pid] = st.playerGW[pid]||{};
      st.playerGW[pid][fx.gw] = r;
    }
  }
}

/* متوسط الجولة وأعلى نقاط — من نقاط المشتركين الفعليين.
   قبل احتساب الجولة (أو بلا مشتركين) تبقى null وتُعرض «—». */
function finalizeGWStats(st, gw){
  const g = st.gws.find(x=>x.n===gw);
  if(g) refreshGWSummary(st, gw);
}
function refreshGWSummary(st, gw){
  const g = st.gws.find(x=>x.n===gw); if(!g) return;
  const pts=[];
  for(const uid in (st.teams||{})){
    const h=(st.teams[uid].history||[]).find(x=>x.gw===gw);
    if(h && typeof h.pts==='number') pts.push(h.pts);
  }
  if(st.managerCount) return;                 // المتوسط والأعلى من احتساب الخادم — لا يُستبدل بأرقام هذا الجهاز
  if(!pts.length){ g.avg=null; g.high=null; return; }
  g.avg  = Math.round(pts.reduce((s,p)=>s+p,0)/pts.length);
  g.high = Math.max(...pts);
}

/* =========================================================
   فريق المستخدم: تحقق، نقاط، تبديل تلقائي، كابتن، كروت
   ========================================================= */
const TEAM = {
  validateSquad(squad, st){
    st = st||DB.state;
    const R = st.rules, errs=[];
    if(squad.length!==R.squadSize) errs.push(`القائمة يجب أن تضم ${R.squadSize} لاعباً (لديك ${squad.length})`);
    const byPos={G:0,D:0,M:0,F:0}, byClub={};
    let cost=0;
    squad.forEach(pid=>{
      const p=DB.player(pid); if(!p){errs.push('لاعب غير موجود'); return;}
      byPos[p.pos]++; byClub[p.club]=(byClub[p.club]||0)+1; cost+=p.price;
    });
    for(const pos in R.posCount) if(byPos[pos]!==R.posCount[pos])
      errs.push(`${POS_AR[pos]}: المطلوب ${R.posCount[pos]} (لديك ${byPos[pos]})`);
    for(const c in byClub) if(byClub[c]>R.maxPerClub)
      errs.push(`الحد الأقصى ${R.maxPerClub} لاعبين من ${DB.club(c).name} (لديك ${byClub[c]})`);
    if(cost>R.budget+1e-9) errs.push(`تجاوزت الميزانية: ${fmtM(cost)} من ${fmtK(R.budget)}`);
    return { ok:errs.length===0, errs, cost };
  },
  /* تشكيلة تلقائية من قائمة: الأغلى مع احترام القيود (تُستعمل عند اعتماد الفريق وعند الإصلاح) */
  autoXI(squad, st){
    st=st||DB.state;
    const ps=squad.map(pid=>DB.player(pid)).filter(Boolean);
    const best=pos=>ps.filter(p=>p.pos===pos).sort((a,b)=>b.price-a.price);
    const xi=[best('G')[0], ...best('D').slice(0,3), ...best('M').slice(0,3), best('F')[0]].filter(Boolean);
    const rest=ps.filter(p=>!xi.includes(p)&&p.pos!=='G').sort((a,b)=>b.price-a.price);
    for(const p of rest){
      if(xi.length>=11) break;
      const counts={G:0,D:0,M:0,F:0}; xi.forEach(x=>counts[x.pos]++); counts[p.pos]++;
      if(counts[p.pos]<=st.rules.formationMax[p.pos]) xi.push(p);
    }
    const xiIds=xi.map(p=>p.id);
    const bench=squad.filter(pid=>!xiIds.includes(pid));
    bench.sort((a,b)=>((DB.player(a)||{}).pos==='G'?-1:0)-((DB.player(b)||{}).pos==='G'?-1:0) || ((DB.player(b)||{}).price||0)-((DB.player(a)||{}).price||0));
    return { xi:xiIds, bench };
  },

  /* إصلاح ذاتي للفريق: لا لاعب مكرر، ولا لاعب في التشكيلة والدكة معاً، وكل لاعب من القائمة في مكان واحد.
     يُطبَّق عند التحميل والحفظ وعلى الخادم لكل مشترك. يعيد true إذا غُيّر شيء. */
  normalize(team, st){
    st=st||DB.state; if(!team) return false;
    // قائمة اللاعبين ليست المنشورة (فشل التحميل) ولاعب غير معروف في الفريق: لا نحذفه — قد يكون لاعباً أُضيف لاحقاً
    if(!st.fromCloud && (team.squad||[]).some(pid=>pid && !DB.player(pid))) return false;
    const before=JSON.stringify([team.squad,team.xi,team.bench,team.cap,team.vice]);
    const squad=[]; (team.squad||[]).forEach(pid=>{ if(pid && DB.player(pid) && !squad.includes(pid)) squad.push(pid); });
    team.squad=squad;
    if(!squad.length){ team.xi=[]; team.bench=[]; team.cap=null; team.vice=null; return before!==JSON.stringify([team.squad,team.xi,team.bench,team.cap,team.vice]); }
    let xi=[]; (team.xi||[]).forEach(pid=>{ if(squad.includes(pid) && !xi.includes(pid)) xi.push(pid); });
    let bench=[]; (team.bench||[]).forEach(pid=>{ if(squad.includes(pid) && !xi.includes(pid) && !bench.includes(pid)) bench.push(pid); });
    squad.forEach(pid=>{ if(!xi.includes(pid) && !bench.includes(pid)) bench.push(pid); });
    if(xi.length!==11 || !this.validateXI(xi, st).ok){
      // تشكيلة ناقصة أو غير صالحة بعد إزالة التكرار: نعيد بناءها تلقائياً من القائمة
      const a=this.autoXI(squad, st); xi=a.xi; bench=a.bench;
    }
    // الحارس البديل أول الدكة دائماً؛ ترتيب البدلاء الآخرين كما اختاره المشترك
    bench=[...bench.filter(p=>(DB.player(p)||{}).pos==='G'), ...bench.filter(p=>(DB.player(p)||{}).pos!=='G')];
    team.xi=xi; team.bench=bench;
    if(!xi.includes(team.cap)) team.cap=[...xi].sort((a,b)=>DB.player(b).price-DB.player(a).price)[0]||null;
    if(!xi.includes(team.vice) || team.vice===team.cap) team.vice=[...xi].filter(p=>p!==team.cap).sort((a,b)=>DB.player(b).price-DB.player(a).price)[0]||null;
    return before!==JSON.stringify([team.squad,team.xi,team.bench,team.cap,team.vice]);
  },
  validateXI(xi, st){
    st=st||DB.state; const R=st.rules, errs=[];
    if(xi.length!==11) errs.push('التشكيلة الأساسية 11 لاعباً');
    const byPos={G:0,D:0,M:0,F:0};
    xi.forEach(pid=>{ const p=DB.player(pid); if(p) byPos[p.pos]++; });
    for(const pos of ['G','D','M','F']){
      if(byPos[pos]<R.formationMin[pos]) errs.push(`تشكيلة غير صالحة: الحد الأدنى ${R.formationMin[pos]} ${POS_AR[pos]}`);
      if(byPos[pos]>R.formationMax[pos]) errs.push(`تشكيلة غير صالحة: الحد الأقصى ${R.formationMax[pos]} ${POS_AR[pos]}`);
    }
    return { ok:errs.length===0, errs, formation:`${byPos.D}-${byPos.M}-${byPos.F}` };
  },

  /* نقاط فريق في جولة منتهية — تبديل تلقائي + كابتن + كروت */
  gwPoints(team, gw, st, opts){
    st=st||DB.state; opts=opts||{};
    const picks = team.gwPicks[gw];
    if(!picks) return { total:0, rows:[], benchPts:0, chip:null, capName:'', hits:picks?0:0 };
    const S=k=>st.scoring[k].val;
    const pts = pid => { const r=DB.pgw(pid,gw); return r? r.pts : 0; };
    const played = pid => { const r=DB.pgw(pid,gw); return r && r.min>0; };
    // مباشر: لاعب لم تُلعب مباراة ناديه بعد يبقى في التشكيلة (لا تبديل تلقائي ولا نقل شارة الكابتن)
    const fxOf = clubId => st.fixtures.find(f=>f.gw===gw && (f.h===clubId||f.a===clubId));
    const pending = pid => { if(!opts.live) return false; const p=DB.player(pid); const f=p? fxOf(p.club) : null; return !!f && f.status!=='F'; };

    let xi=[...picks.xi].filter(pid=>DB.player(pid)), bench=[...picks.bench].filter(pid=>DB.player(pid));
    const chip = picks.chip;

    // تبديل تلقائي بناءً على المشاركة الحقيقية (من تشكيلة موقع النتائج)
    if(chip!=='benchboost'){
      for(let i=0;i<xi.length;i++){
        if(played(xi[i]) || pending(xi[i])) continue;
        const p = DB.player(xi[i]);
        for(let b=0;b<bench.length;b++){
          const bp = DB.player(bench[b]);
          if(!played(bench[b]) || pending(bench[b])) continue;
          if(p.pos==='G' && bp.pos!=='G') continue;
          if(p.pos!=='G' && bp.pos==='G') continue;
          const trial=[...xi]; trial[i]=bench[b];
          if(TEAM.validateXI(trial, st).ok){ const tmp=xi[i]; xi[i]=bench[b]; bench[b]=tmp; break; }
        }
      }
    }
    // الكابتن، وإن لم يشارك فالنائب
    const capUsed = (played(picks.cap) || pending(picks.cap)) ? picks.cap : ((played(picks.vice) || pending(picks.vice))? picks.vice : null);
    const mult = chip==='triplecap' ? 3 : 2;

    let total=0; const rows=[];
    xi.forEach(pid=>{
      let p_=pts(pid);
      let isCap = capUsed===pid;
      const eff = isCap ? p_*mult : p_;
      total+=eff;
      rows.push({pid, pts:p_, eff, cap:isCap, bench:false});
    });
    let benchPts=0;
    bench.forEach(pid=>{
      const p_=pts(pid); benchPts+=p_;
      if(chip==='benchboost') total+=p_;
      rows.push({pid, pts:p_, eff:chip==='benchboost'?p_:0, cap:false, bench:true});
    });
    const hits = picks.hits||0;
    total -= hits;
    return { total, rows, benchPts, chip, hits, capName: (capUsed && DB.player(capUsed))? DB.player(capUsed).name : '—' };
  },

  totalPoints(team, st){
    st=st||DB.state;
    return (team.history||[]).reduce((s,h)=>s+h.pts,0);
  },
  /* اختيارات الجولة كما هي الآن في الفريق — تُستعمل عند الاحتساب إذا لم تُلتقط لقطة على الجهاز
     (بعد الموعد يرفض الخادم أي تعديل، فالتشكيلة المحفوظة عنده هي عين الاختيارات المقفلة) */
  picksFrom(team){
    return { xi:[...(team.xi||[])], bench:[...(team.bench||[])], cap:team.cap||null, vice:team.vice||null,
      chip:team.activeChip||null, hits:+team.pendingHits||0 };
  },
  teamValue(team){
    return team.squad.reduce((s,pid)=>s+((DB.player(pid)||{}).price||0),0);
  },
};

/* =========================================================
   الترتيب العام — بين المشتركين الحقيقيين فقط.
   لا مجتمع وهمي ولا مدراء مولّدون: كل رقم هنا مبني على نقاط
   لاعبين فعليين، فإذا كان المشتركون ثلاثة فالترتيب «من 3».
   ========================================================= */
const RANKS = {
  finishedGWs(st){ return st.gws.filter(g=>g.status==='finished').map(g=>g.n); },

  /* عدد المشتركين الذين لهم فريق فعلي */
  population(st){ return st.managerCount || Object.keys(st.teams||{}).length; },

  /* مجموع نقاط كل مشترك */
  userTotals(st){
    return Object.keys(st.teams||{}).map(uid=>({
      id: uid,
      total: (st.teams[uid].history||[]).reduce((s,h)=>s+(h.pts||0), 0)
    }));
  },

  /* يعيد ترقيم ترتيب الجولة للجميع دفعة واحدة، مع معالجة التعادل */
  recomputeGWRanks(st, gw){
    const rows=[];
    for(const uid in (st.teams||{})){
      const h=(st.teams[uid].history||[]).find(x=>x.gw===gw);
      if(h) rows.push(h);
    }
    rows.sort((a,b)=>(b.pts||0)-(a.pts||0));
    let prev=null, rank=0;
    rows.forEach((h,i)=>{ if(prev===null || h.pts<prev){ rank=i+1; prev=h.pts; } h.rank=rank; });
    refreshGWSummary(st, gw);
    return rows.length;
  },
  /* الترتيب العام بمجموع النقاط */
  overallRank(st, userTotal){
    const all=this.userTotals(st);
    if(!all.length) return {rank:'-', of:0};
    return {rank: all.filter(x=>x.total>userTotal).length+1, of: all.length};
  },

  /* ترتيب جولة واحدة — من السجل المحفوظ لا من توليد عشوائي */
  gwRank(st, userPts, gw){
    let of=0, better=0;
    for(const uid in (st.teams||{})){
      const h=(st.teams[uid].history||[]).find(x=>x.gw===gw);
      if(!h) continue;
      of++; if(h.pts>userPts) better++;
    }
    return of? {rank:better+1, of} : {rank:'-', of:0};
  },
};

/* =========================================================
   ملكية اللاعبين والانتقالات المحاكاة
   ========================================================= */
const MARKET = {
  /* نسبة التملّك: من فرق المشتركين الفعليين على الخادم (يحسبها المدير وينشرها:
     تلقائياً عند فتحه اللعبة، وعند كل احتساب، ومن زر «تحديث التملّك»).
     بلا سحابة إطلاقاً (تجربة محلية): من فرق هذا الجهاز. لا أرقام مولَّدة. */
  ownership(pid){
    const st=DB.state;
    if(st.managerCount>0 && st.own) return Math.round(((st.own[pid]||0)/st.managerCount)*1000)/10;
    if(typeof CLOUD!=='undefined' && CLOUD.ready) return 0;   // متصل لكن لم تُنشر بعد: لا نُظهر أرقام جهاز واحد
    const users=Object.keys(st.teams||{}); if(!users.length) return 0;
    const real=users.filter(uid=>(st.teams[uid].squad||[]).includes(pid)).length;
    return Math.round(real/users.length*1000)/10;
  },
  /* دخول/خروج اللاعب في آخر جولة محتسبة — من صفقات المشتركين الحقيقية */
  transferCounts(pid){
    const t=((DB.state.transferStats||{})[pid])||{in:0,out:0};
    return { in:+t.in||0, out:+t.out||0 };
  },
  /* عتبة تغيّر السعر: صافي 5% من المشتركين (3 على الأقل) */
  threshold(st){
    st=st||DB.state;
    const n=Math.max(1, st.managerCount||Object.keys(st.teams||{}).length||1);
    return Math.max(3, Math.ceil(n*0.05));
  },
  applyPriceChanges(st){
    const changes=[]; const thr=this.threshold(st);
    st.players.forEach(p=>{
      const tc=this.transferCounts(p.id);
      const net=tc.in-tc.out;
      if(net>=thr){ p.price=Math.round((p.price+st.rules.priceRise)*10)/10; changes.push({p,d:+st.rules.priceRise}); }
      else if(net<=-thr && p.price>3.5){ p.price=Math.round((p.price-st.rules.priceDrop)*10)/10; changes.push({p,d:-st.rules.priceDrop}); }
    });
    return changes;
  },
};

/* =========================================================
   صعوبة المباريات (FDR)
   ========================================================= */
const FDR = {
  rate(oppId, isHome){
    const s = DB.club(oppId).strength - (isHome?0.3:0);
    if(s>=4.4) return {lvl:5, label:'صعبة جداً'};
    if(s>=3.9) return {lvl:4, label:'صعبة'};
    if(s>=3.2) return {lvl:3, label:'متوسطة'};
    if(s>=2.7) return {lvl:2, label:'سهلة'};
    return {lvl:1, label:'سهلة جداً'};
  },
  next(clubId, n){
    const st=DB.state;
    return st.fixtures
      .filter(f=>(f.h===clubId||f.a===clubId) && f.status==='U')
      .sort((a,b)=>a.gw-b.gw).slice(0,n||5)
      .map(f=>{
        const home=f.h===clubId; const opp=home?f.a:f.h;
        return { gw:f.gw, opp, home, ...this.rate(opp,home) };
      });
  },
  avgNext(clubId, n){
    const fx=this.next(clubId,n||3);
    if(!fx.length) return 3;
    return fx.reduce((s,f)=>s+f.lvl,0)/fx.length;
  },
};

/* =========================================================
   محاكاة البث المباشر
   ========================================================= */
const LIVE = {
  timer:null,
  running(){ return !!DB.state.fixtures.find(f=>f.status==='L'); },

  startGW(gw){
    const st=DB.state;
    // انطلاق الجولة = قفل التشكيلات: لقطة اختيارات كل الفرق
    for(const uid in st.teams){
      const team=st.teams[uid];
      if(team.squad.length && !team.gwPicks[gw]) GWADMIN.snapshotPicks(team, gw);
    }
    st.fixtures.filter(f=>f.gw===gw && f.status==='U').forEach(f=>{
      f.status='L'; f.hs=0; f.as=0; f.goals=[];
      f.live={min:0, events:[]};
      f.stats = this.initLiveStats(st,f);
    });
    const g=st.gws.find(x=>x.n===gw); if(g) g.status='live';
    DB.save();
    this.run();
  },
  initLiveStats(st,f){
    const stats={};
    for(const side of ['h','a']){
      const clubId=f[side];
      const squad=st.players.filter(p=>p.club===clubId && p.status==='a');
      const byPos=pos=>squad.filter(p=>p.pos===pos).sort((a,b)=>b.price-a.price);
      const xi=[byPos('G')[0],...byPos('D').slice(0,4),...byPos('M').slice(0,4),...byPos('F').slice(0,2)].filter(Boolean);
      if(xi.length<11){
        for(const p of squad.filter(x=>!xi.includes(x)&&x.pos!=='G').sort((a,b)=>b.price-a.price)){
          if(xi.length>=11) break; xi.push(p);
        }
      }
      const rows={};
      xi.forEach(p=>{ rows[p.id]={min:0,g:0,a:0,cs:0,gc:0,sv:0,ps:0,pm:0,og:0,yc:0,rc:0,bonus:0,bps:0,pts:0,basePts:0}; });
      stats[clubId]=rows;
    }
    return stats;
  },
  run(){
    if(this.timer) clearInterval(this.timer);
    this.timer=setInterval(()=>this.tick(), 1800);
  },
  stop(){ if(this.timer){clearInterval(this.timer); this.timer=null;} },

  tick(){
    const st=DB.state;
    const liveFx=st.fixtures.filter(f=>f.status==='L');
    if(!liveFx.length){ this.stop(); return; }
    liveFx.forEach(f=>{
      const adv = st.liveSpeed + Math.floor(Math.random()*2);
      f.live.min=Math.min(95, f.live.min+adv);
      const m=f.live.min;
      // تحديث الدقائق
      for(const side of ['h','a']){
        const rows=f.stats[f[side]];
        for(const pid in rows) rows[pid].min=Math.min(90,m);
      }
      // أحداث
      const hStr=DB.club(f.h).strength+0.35, aStr=DB.club(f.a).strength;
      const total=hStr+aStr;
      if(Math.random() < 0.055*adv/2){
        const homeGoal = Math.random() < hStr/total;
        this.liveGoal(st,f,homeGoal?'h':'a',m);
      }
      if(Math.random()<0.02*adv/2) this.liveCard(st,f,m);
      if(m>=93){ this.finishMatch(st,f); }
      else this.rescore(st,f);
    });
    DB.save();
    if(typeof APP!=='undefined') APP.onLiveTick();
  },
  liveGoal(st,f,side,min){
    const clubId=f[side];
    const rows=f.stats[clubId];
    const pids=Object.keys(rows).filter(pid=>DB.player(pid).pos!=='G');
    const weights=pids.map(pid=>{ const p=DB.player(pid); return p.pos==='F'?5:p.pos==='M'?3:1; });
    const scorer=weightedPick(pids,weights);
    rows[scorer].g++;
    let assist=null;
    if(Math.random()<0.65){
      const others=pids.filter(x=>x!==scorer);
      assist=weightedPick(others, others.map(pid=>DB.player(pid).pos==='M'?3:2));
      rows[assist].a++;
    }
    if(side==='h') f.hs++; else f.as++;
    // شباك الخصم
    const oppRows=f.stats[side==='h'?f.a:f.h];
    for(const pid in oppRows) oppRows[pid].gc++;
    f.goals.push({min, scorer:DB.player(scorer).name, club:clubId, assist: assist?DB.player(assist).name:null, pen:Math.random()<0.12});
    f.live.events.push({min, type:'goal', text:`هدف! ${DB.player(scorer).name} (${DB.club(clubId).name})${assist? ' — صناعة '+DB.player(assist).name:''}`});
  },
  liveCard(st,f,min){
    const side=Math.random()<0.5?'h':'a';
    const rows=f.stats[f[side]];
    const pids=Object.keys(rows).filter(pid=>rows[pid].rc===0);
    if(!pids.length) return;
    const pid=pids[Math.floor(Math.random()*pids.length)];
    if(rows[pid].yc===1 && Math.random()<0.3){ rows[pid].rc=1; f.live.events.push({min,type:'red',text:`طرد ${DB.player(pid).name}`}); }
    else if(rows[pid].yc===0){ rows[pid].yc=1; f.live.events.push({min,type:'yellow',text:`إنذار ${DB.player(pid).name}`}); }
  },
  rescore(st,f){
    // شباك نظيفة مؤقتة + تصديات الحارس
    for(const side of ['h','a']){
      const conceded = side==='h'?f.as:f.hs;
      const rows=f.stats[f[side]];
      for(const pid in rows){
        const r=rows[pid];
        r.cs = (conceded===0 && r.min>=60)?1:0;
      }
      const gk=Object.keys(rows).find(pid=>DB.player(pid).pos==='G');
      if(gk) rows[gk].sv=conceded+Math.floor(f.live.min/25);
    }
    scoreFixture(st,f);
  },
  finishMatch(st,f){
    f.status='F';
    f.live.min=90;
    for(const side of ['h','a']){
      const rows=f.stats[f[side]];
      for(const pid in rows) rows[pid].min=Math.min(90,rows[pid].min);
    }
    this.rescore(st,f);
    f.live.events.push({min:90,type:'ft',text:`صافرة النهاية: ${DB.club(f.h).name} ${f.hs} - ${f.as} ${DB.club(f.a).name}`});
  },
};
function weightedPick(items, weights){
  const tot=weights.reduce((a,b)=>a+b,0);
  let r=Math.random()*tot;
  for(let i=0;i<items.length;i++){ r-=weights[i]; if(r<=0) return items[i]; }
  return items[items.length-1];
}

/* =========================================================
   إدارة الجولات: قفل، احتساب، ترحيل
   ========================================================= */
const GWADMIN = {
  /* إنهاء الجولة الحالية على هذا الجهاز: تثبيت الحالة + أسعار + الترحيل.
     نقاط المشتركين وترحيل فرقهم يقوم بهما CLOUD.finalizeForAll على الخادم؛
     agg = خلاصته (المتوسط، الأعلى، التملّك، الصفقات، عدد المشتركين). */
  finalize(gw, agg){
    const st=DB.state;
    const fxs=st.fixtures.filter(f=>f.gw===gw);
    if(!fxs.length) return { ok:false, err:`لا يمكن إغلاق الجولة ${gw} — لم يصدر جدولها بعد (المباريات تُسحب من mfsoccer).` };
    // اللعبة واقعية: لا احتساب قبل إدخال كل النتائج الحقيقية
    const pending=fxs.filter(f=>f.status!=='F');
    if(pending.length){
      return { ok:false, err:`لا يمكن إغلاق الجولة — ${pending.length} مباريات بلا نتيجة. اسحبها من mfsoccer أو أدخلها من «النتائج والإحصاءات» أولاً.` };
    }
    const g=st.gws.find(x=>x.n===gw); g.status='finished';

    // فرق هذا الجهاز (ضيف أو بلا اتصال): تُحتسب محلياً ما لم يكن الخادم رحّلها
    const scored={};
    for(const uid in st.teams){
      const team=st.teams[uid];
      if(team.joinedGW>gw) continue;
      if((team.rolledGW||0)>=gw) continue;
      if(!team.gwPicks[gw]) this.snapshotPicks(team, gw);
      if(!(team.history||[]).some(h=>h.gw===gw)){
        const res=TEAM.gwPoints(team, gw, st);
        team.history=team.history||[];
        team.history.push({gw, pts:res.total, benchPts:res.benchPts, rank:0, chip:res.chip, hits:res.hits});
        scored[uid]=res.total;
      }
      this.rollover(team, gw, st);
    }
    RANKS.recomputeGWRanks(st, gw);
    if(agg){
      if(agg.avg!=null)  g.avg=agg.avg;
      if(agg.high!=null) g.high=agg.high;
      if(agg.own)        st.own=agg.own;
      if(agg.board)      st.board=agg.board;
      if(agg.count!=null) st.managerCount=agg.count;
      if(agg.transfers)  st.transferStats=agg.transfers;
    }
    for(const uid in scored){
      const h=(st.teams[uid].history||[]).find(x=>x.gw===gw);
      const rk = h && h.rank ? ` (ترتيب الجولة ${h.rank.toLocaleString('ar')} من ${RANKS.population(st).toLocaleString('ar')})` : '';
      NOTIF.push(uid,'points',`احتُسبت الجولة ${gw}: ${scored[uid]} نقطة${rk}`);
    }
    // أسعار — من صافي صفقات المشتركين الحقيقية
    const changes=MARKET.applyPriceChanges(st);
    for(const uid in st.teams){
      changes.slice(0,6).forEach(ch=>{
        if(st.teams[uid].squad.includes(ch.p.id))
          NOTIF.push(uid,'price',`${ch.d>0?'ارتفع':'انخفض'} سعر ${ch.p.name} إلى ${fmtK(ch.p.price)}`);
      });
    }
    // الجولة التالية (وفي آخر جولة بالموسم تبقى الحالية منتهية)
    const ng=st.gws.find(x=>x.n===gw+1);
    if(ng){ st.currentGW=gw+1; ng.status='next'; }
    this.refreshDeadlines(st);
    DB.save();
    return { ok:true, changes:changes.length };
  },
  /* ترحيل فريق بعد احتساب جولة: كروت وخصومات وانتقالات مجانية والضربة الحرة.
     يُطبَّق على الخادم لكل مشترك، ومحلياً لفرق الجهاز. لا يتكرر (rolledGW). */
  rollover(team, gw, st){
    st=st||DB.state;
    if((team.rolledGW||0)>=gw) return team;
    const picks=(team.gwPicks||{})[gw];
    if(picks && picks.chip==='freehit' && team.fhBackup){
      team.squad=team.fhBackup.squad; team.xi=team.fhBackup.xi; team.bench=team.fhBackup.bench;
      team.cap=team.fhBackup.cap; team.vice=team.fhBackup.vice; team.bank=team.fhBackup.bank;
    }
    team.fhBackup=null;
    // الكرت يُحسب مستخدماً هنا فقط (بعد احتساب الجولة) — قبلها يمكن إلغاؤه بلا خسارة
    if(picks && picks.chip){ team.usedChips=team.usedChips||{}; team.usedChips[picks.chip]=(team.usedChips[picks.chip]||0)+1; }
    team.activeChip=null;
    team.pendingHits=0;
    team.ft=Math.min(st.rules.maxSavedTransfers, (+team.ft||0)+st.rules.freeTransfers);
    team.rolledGW=gw;
    return team;
  },
  /* خلاصة الاحتساب من فرق هذا الجهاز فقط — عند غياب السحابة (تجربة محلية) */
  localAgg(st, gw){
    const own={}, transfers={}; const pts=[]; let count=0;
    for(const uid in st.teams){
      const t=st.teams[uid]; if(!(t.squad||[]).length) continue;
      count++;
      t.squad.forEach(pid=>{ own[pid]=(own[pid]||0)+1; });
      (t.transfers||[]).filter(x=>x.gw===gw).forEach(x=>{
        transfers[x.in]=transfers[x.in]||{in:0,out:0}; transfers[x.in].in++;
        transfers[x.out]=transfers[x.out]||{in:0,out:0}; transfers[x.out].out++;
      });
      if(t.joinedGW<=gw){ const picks=t.gwPicks[gw]||TEAM.picksFrom(t); pts.push(TEAM.gwPoints({...t, gwPicks:{[gw]:picks}}, gw, st).total); }
    }
    return { count, own, transfers,
      avg: pts.length? Math.round(pts.reduce((a,b)=>a+b,0)/pts.length) : null,
      high: pts.length? Math.max(...pts) : null };
  },
  snapshotPicks(team, gw){
    team.gwPicks[gw]=TEAM.picksFrom(team);
    if(gw < (DB.state.currentGW||gw)){ team.gwPicks[gw].chip=null; team.gwPicks[gw].hits=0; }   // جولة سابقة: الكرت الحالي ليس لها
    team.pendingHits=0;
  },
  deadlinePassed(gw){
    const g=DB.gw(gw); if(!g || !g.deadline) return false;   // جولة بلا جدول = مفتوحة
    return new Date() > new Date(g.deadline);
  },
  /* الجولة جارية: مرّ موعدها (أو لُعبت مباراة منها) ولم تُعتمد بعد */
  inProgress(gw){
    const g=DB.gw(gw); if(!g || g.status==='finished') return false;
    const fx=DB.state.fixtures.filter(f=>f.gw===gw); if(!fx.length) return false;
    return this.deadlinePassed(gw) || fx.some(f=>f.status==='F');
  },
  refreshDeadlines(st){ st=st||DB.state; computeDeadlines(st.gws, st.fixtures); },
};

/* =========================================================
   إشعارات
   ========================================================= */
const NOTIF = {
  push(uid, type, text){
    const st=DB.state;
    st.notifications[uid]=st.notifications[uid]||[];
    st.notifications[uid].unshift({id:'nt'+Date.now()+Math.random().toString(36).slice(2,6), ts:new Date().toISOString(), type, text, read:false});
    if(st.notifications[uid].length>60) st.notifications[uid].length=60;
  },
  mine(){ const m=DB.me(); return m? (DB.state.notifications[m.id]||[]) : []; },
  unread(){ return this.mine().filter(n=>!n.read).length; },
  markAll(){ this.mine().forEach(n=>n.read=true); DB.save(); },
};

/* =========================================================
   المصادقة (محلية — للتجربة)
   ========================================================= */
const AUTH = {
  hash(s){ let h=5381; for(let i=0;i<s.length;i++) h=((h<<5)+h+s.charCodeAt(i))|0; return 'h'+(h>>>0).toString(36); },
  /* وضع بدون تسجيل دخول: حساب محلي تلقائي */
  guest(){
    const st=DB.state;
    const id='u1local';
    // الضيف دائماً حساب الجهاز «المدرب» — لا يرث فريق مشترك سجّل خروجه
    if(!st.users.find(u=>u.id===id))
      st.users.push({id, username:'المدرب', email:'local@kwfantasy', pass:'', teamName:'فريقي',
        avatar:'', verified:true, created:new Date().toISOString(), admin:false});
    if(st.teams[id]){ st.session=id; DB.save(); return; }
    st.teams[id]={ squad:[],xi:[],bench:[],cap:null,vice:null,bank:st.rules.budget,ft:st.rules.freeTransfers,
      usedChips:{},activeChip:null,joinedGW:st.currentGW,history:[],transfers:[],gwPicks:{},pendingHits:0 };
    st.session=id;
    NOTIF.push(id,'welcome',`أهلاً بك! كوّن فريقك قبل موعد إغلاق الجولة ${st.currentGW}.`);
    DB.save();
  },
  /* الحسابات على Firebase: كلمة المرور لا تمرّ بكودنا ولا تُخزَّن عندنا،
     والحساب يتبع صاحبه على كل أجهزته. */
  cloudUp(){ return typeof CLOUD!=='undefined' && CLOUD.ready; },

  async signup(username,email,pass,teamName){
    if(!this.cloudUp()) return {ok:false, err:'تعذّر الاتصال بالخادم — حاول بعد قليل'};
    const r = await CLOUD.signup(email, pass, username, teamName);
    return r;                       // الجلسة تُلتقط من onAuthStateChanged
  },

  async login(email,pass){
    if(!this.cloudUp()) return {ok:false, err:'تعذّر الاتصال بالخادم — حاول بعد قليل'};
    return await CLOUD.login(email, pass);
  },

  async logout(){
    if(this.cloudUp()) await CLOUD.logout();
    DB.state.session=null; DB.save();
  },

  /* استعادة كلمة المرور: رسالة حقيقية من Firebase لا رمز محلي */
  async forgot(email){
    if(!this.cloudUp()) return {ok:false, err:'تعذّر الاتصال بالخادم'};
    return await CLOUD.resetEmail(email);
  },

  /* توثيق البريد يتم برسالة Firebase؛ نكتفي بتحديث الحالة محلياً */
  async refreshVerified(){
    if(!this.cloudUp() || !CLOUD.user) return false;
    try{ await CLOUD.user.reload(); }catch(e){}
    const m=DB.me();
    if(m && CLOUD.user){ m.verified = !!CLOUD.user.emailVerified; DB.save(); }
    return !!(CLOUD.user && CLOUD.user.emailVerified);
  },
  async resendVerify(){
    if(!this.cloudUp() || !CLOUD.user) return {ok:false, err:'لا توجد جلسة'};
    try{ await CLOUD.user.sendEmailVerification(); return {ok:true}; }
    catch(e){ return {ok:false, err:CLOUD.errAr(e)}; }
  },
};

/* =========================================================
   الدوريات الخاصة
   ========================================================= */
const LEAGUES = {
  /* مواجهات H2H وترقيم المراكز على صفوف جاهزة من السحابة */
  decorate(rows, lg){
    if(lg.type!=='h2h') { rows.sort((a,b)=>b.total-a.total); this.movement(rows, lg); return rows; }
    const st=DB.state;
    rows.forEach(r=>{r.w=0;r.d=0;r.l=0;r.h2hPts=0;});
    const done=RANKS.finishedGWs(st).filter(g=>g>=(lg.createdGW||1) && g>=(st.rules.scoringFromGW||1));
    const byId={}; rows.forEach(r=>byId[r.id]=r);
    done.forEach(gw=>{
      const order=[...rows].sort((a,b)=>hashStr(a.id+gw)-hashStr(b.id+gw));
      const at=(r)=>{ const t=DB.state.teams[r.id]; const h=t&&(t.history||[]).find(x=>x.gw===gw);
                      return h? h.pts : (r.hist? (r.hist.find(x=>x.gw===gw)||{}).pts||0 : 0); };
      for(let i=0;i+1<order.length;i+=2){
        const A=order[i],B=order[i+1], a=at(A), b=at(B);
        if(a>b){A.w++;B.l++;A.h2hPts+=3;} else if(a<b){B.w++;A.l++;B.h2hPts+=3;}
        else {A.d++;B.d++;A.h2hPts+=1;B.h2hPts+=1;}
      }
    });
    rows.sort((a,b)=>b.h2hPts-a.h2hPts || b.total-a.total);
    rows.forEach((r,i)=>{ r.rank=i+1; r.move=0; });
    return rows;
  },

  /* مخزن الدوريات القادمة من السحابة — تُحدَّث بلا تزامن ثم يُعاد الرسم */
  cloud: { list:null, rows:{}, board:null, at:0, busy:false },
  online(){ return typeof CLOUD!=='undefined' && CLOUD.ready && !!CLOUD.user; },

  /* نسخة محلية من آخر قراءة: تُعرض فوراً عند فتح الدوريات ثم تُحدَّث من الخادم في الخلفية */
  CK:'kwf_leagues_cache',
  restore(){
    if(this.cloud.list || !this.online()) return false;
    try{
      const c=JSON.parse(localStorage.getItem(this.CK)||'null');
      if(!c || c.uid!==CLOUD.user.uid) return false;
      this.cloud.list=c.list||[]; this.cloud.board=c.board||[]; this.cloud.rows=c.rows||{}; this.cloud.at=0;
      return true;
    }catch(e){ return false; }
  },
  persist(){
    try{ localStorage.setItem(this.CK, JSON.stringify({uid:CLOUD.user.uid, at:Date.now(), list:this.cloud.list, board:this.cloud.board, rows:this.cloud.rows})); }catch(e){}
  },

  async refresh(force){
    if(!this.online()) return;
    if(this.restore() && typeof APP!=='undefined' && APP.route==='leagues') APP.render();   // المحلية أولاً
    if(this.cloud.busy){ if(!force) return; while(this.cloud.busy) await new Promise(r=>setTimeout(r,120)); }
    if(!force && this.cloud.at && Date.now()-this.cloud.at < 45000) return;
    this.cloud.busy = true;
    try{
      const [list, board] = await Promise.all([CLOUD.myLeagues(), CLOUD.leaderboard(200)]);
      this.cloud.list = list || [];
      this.cloud.board = board || [];
      const rows = {};
      for(const lg of this.cloud.list) rows[lg.id] = await CLOUD.leagueRows(lg);
      this.cloud.rows = rows;
      this.cloud.at = Date.now();
      this.persist();
    }catch(e){ console.warn('leagues refresh failed', e); }
    this.cloud.busy = false;
    if(typeof APP!=='undefined' && APP.route==='leagues') APP.render();
  },

  byId(id){
    return DB.state.leagues.find(l=>l.id===id) || (this.cloud.list||[]).find(l=>l.id===id) || null;
  },
  /* دوري جديد/انضمام: يُضاف للقائمة فوراً بلا انتظار قراءة كل الدوريات من الخادم */
  addLocal(lg){
    this.cloud.list = this.cloud.list || [];
    if(!this.cloud.list.some(l=>l.id===lg.id)) this.cloud.list.push(lg);
    this.cloud.at = 0;                       // القراءة التالية تُحدّث الصفوف
  },
  /* حركة الترتيب: المركز الآن مقابل المركز قبل آخر جولة محتسبة (من سجل كل مشترك) */
  movement(rows, lg){
    const st=DB.state;
    const done=RANKS.finishedGWs(st).filter(g=>lg.global || g>=(lg.createdGW||1));
    const last=done.length? Math.max(...done) : 0;
    const rankOf=(arr,key)=>{ const sorted=[...arr].sort((a,b)=>b[key]-a[key]); let prev=null, rank=0; const out={};
      sorted.forEach((r,i)=>{ if(prev===null || r[key]<prev){ rank=i+1; prev=r[key]; } out[r.id]=rank; }); return out; };
    rows.forEach(r=>{
      const hist=r.hist || ((st.teams[r.id]||{}).history||[]).filter(h=>lg.global||h.gw>=(lg.createdGW||1));
      r.prevTotal = hist.filter(h=>h.gw<last).reduce((s,h)=>s+(h.pts||0),0);
      r.playedLast = hist.some(h=>h.gw===last);
    });
    const now=rankOf(rows,'total'), before=rankOf(rows,'prevTotal');
    rows.forEach(r=>{ r.rank=now[r.id]; r.prevRank=before[r.id]; r.move = (last && done.length>1)? (r.prevRank-r.rank) : 0; });
    return rows;
  },
  genCode(){ const c='ABCDEFGHJKMNPQRSTUVWXYZ23456789'; let s=''; for(let i=0;i<6;i++) s+=c[Math.floor(Math.random()*c.length)]; return s; },
  create(name,type){
    const st=DB.state; const m=DB.me(); if(!m) return null;
    const lg={id:'lg'+Date.now().toString(36), code:this.genCode(), name, type:type||'classic', owner:m.id, members:[m.id], createdGW:st.currentGW, global:false};
    st.leagues.push(lg); DB.save();
    return lg;
  },
  join(code){
    const st=DB.state; const m=DB.me(); if(!m) return {ok:false,err:'سجّل الدخول أولاً'};
    const lg=st.leagues.find(l=>l.code===code.trim().toUpperCase() && !l.global);
    if(!lg) return {ok:false,err:'رمز الدوري غير صحيح'};
    if(lg.members.includes(m.id)) return {ok:false,err:'أنت عضو في هذا الدوري'};
    lg.members.push(m.id); DB.save();
    return {ok:true, lg};
  },
  /* أُلغيت: كانت تحشو الدوري بمدراء وهميين. الدوريات الآن مشتركون حقيقيون فقط. */
  addBots(){ /* no-op */ },
  table(lg){
    const st=DB.state;
    if(this.online()){
      this.refresh();
      // الترتيب العام من لوحة الخادم، والدوري الخاص من مستندات أعضائه
      const cloudRows = lg.global ? this.cloud.board : this.cloud.rows[lg.id];
      if(cloudRows) return this.decorate(cloudRows.map(r=>({...r})), lg);
    }
    const rows=[];
    lg.members.forEach(mid=>{
      const u=DB.user(mid); const team=st.teams[mid];
      if(!u || !team) return;                    // أعضاء وهميون قدامى يُتجاهلون
      const hist=(team.history||[]).filter(h=>lg.global||h.gw>=lg.createdGW);
      const total=hist.reduce((s,h)=>s+h.pts,0);
      const last=hist.length? hist[hist.length-1].pts:0;
      rows.push({id:mid,name:u.username,teamName:u.teamName,total,last,isBot:false});
    });
    // H2H: نقاط 3/1/0 بالمواجهات حسب نقاط الجولة
    if(lg.type==='h2h'){
      rows.forEach(r=>{r.w=0;r.d=0;r.l=0;r.h2hPts=0;});
      const done=RANKS.finishedGWs(st).filter(g=>g>=lg.createdGW);
      done.forEach(gw=>{
        const scores={};
        rows.forEach(r=>{
          const team=st.teams[r.id]; const h=(team.history||[]).find(x=>x.gw===gw); scores[r.id]=h?h.pts:0;
        });
        // اقتران حسب الترتيب داخل الجولة
        const order=[...rows].sort((a,b)=>hashStr(a.id+gw)-hashStr(b.id+gw));
        for(let i=0;i+1<order.length;i+=2){
          const A=order[i],B=order[i+1];
          if(scores[A.id]>scores[B.id]){A.w++;B.l++;A.h2hPts+=3;}
          else if(scores[A.id]<scores[B.id]){B.w++;A.l++;B.h2hPts+=3;}
          else {A.d++;B.d++;A.h2hPts+=1;B.h2hPts+=1;}
        }
      });
      rows.sort((a,b)=>b.h2hPts-a.h2hPts || b.total-a.total);
      rows.forEach((r,i)=>{ r.rank=i+1; r.move=0; });
    } else {
      rows.sort((a,b)=>b.total-a.total);
      this.movement(rows, lg);
    }
    return rows;
  },
  mine(){
    const m=DB.me(); if(!m) return [];
    if(this.online()){
      this.refresh();                                   // تحديث في الخلفية
      const glob = DB.state.leagues.filter(l=>l.global);
      return glob.concat(this.cloud.list || []);
    }
    return DB.state.leagues.filter(l=>l.global || l.members.includes(m.id));
  },
};
