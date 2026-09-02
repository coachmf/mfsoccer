/* =========================================================
   المحرك: قاعدة البيانات + النقاط + المحاكاة + الأسعار + الترتيب
   ========================================================= */

'use strict';

/* ---------- أدوات عامة ---------- */
function hashStr(s){ let h=2166136261; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619);} return h>>>0; }
function mulberry32(seed){ let a=seed>>>0; return function(){ a|=0; a=(a+0x6D2B79F5)|0; let t=Math.imul(a^(a>>>15),1|a); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }; }
function gauss(rng){ return Math.sqrt(-2*Math.log(1-rng()))*Math.cos(2*Math.PI*rng()); }
function fmtM(v){ return v.toFixed(1); }
function esc(s){ return String(s??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
const POS_AR = { G:'حارس', D:'مدافع', M:'وسط', F:'مهاجم' };
const POS_ORDER = { G:0, D:1, M:2, F:3 };

const DB = {
  KEY: 'kwfantasy_v16',
  state: null,

  load(){
    try{
      const raw = localStorage.getItem(this.KEY);
      if(raw){ this.state = JSON.parse(raw); if(this.state && this.state.ver===1){ this.syncClubs(); this.syncPlayers(); this.syncScoring(); return; } }
    }catch(e){ console.warn('storage read failed', e); }
    this.state = buildSeedState();
    this.save();
  },
  save(){
    try{ localStorage.setItem(this.KEY, JSON.stringify(this.state)); }
    catch(e){ console.warn('storage write failed', e); }
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
        h.rank=RANKS.gwRank(st,res.total,h.gw).rank;
      });
    }
    this.save();
  },

  // أي لاعب جديد يُضاف للبذرة يدخل الحالة المحفوظة تلقائياً (بدون مسح الفرق)
  syncPlayers(){
    const st=this.state;
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
    scoring: JSON.parse(JSON.stringify(SEED_SCORING)),
    rules: JSON.parse(JSON.stringify(SEED_RULES)),
    users: [], teams: {}, session: null,
    leagues: [ {id:'L1', code:'OVERALL', name:'الترتيب العام — دوري زين الممتاز', type:'classic', owner:null, members:[], global:true} ],
    bots: SEED_BOT_NAMES.map((b,i)=>({id:'b'+(i+1), name:b[0], teamName:b[1], skill:0.35+0.6*(mulberry32(900+i)()) })),
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

/* جدولة الدوري: الجولات الحقيقية من SEED_RESULTS + SEED_FIXTURES أولاً،
   والجولات غير المنشورة بعد تُولَّد مؤقتاً (تُصحَّح من الإدارة عند صدور الجدول الرسمي) */
function buildFixtures(){
  const ids = SEED_CLUBS.map(c=>c.id);
  const usedPairs = new Set();
  const rounds = {};   // gw -> [[h,a,dateOrNull],...]

  SEED_RESULTS.forEach(r=>{
    (rounds[r.gw]=rounds[r.gw]||[]).push([r.h, r.a, r.date||null]);
    usedPairs.add(pairKey(r.h, r.a));
  });
  (typeof SEED_FIXTURES!=='undefined'? SEED_FIXTURES:[]).forEach(([gw,h,a,date])=>{
    (rounds[gw]=rounds[gw]||[]).push([h, a, date||null]);
    usedPairs.add(pairKey(h, a));
  });
  const maxKnown = Math.max(...Object.keys(rounds).map(Number));

  // بقية أزواج القسم الأول
  let remaining=[];
  for(let i=0;i<ids.length;i++) for(let j=i+1;j<ids.length;j++){
    const k=pairKey(ids[i],ids[j]);
    if(!usedPairs.has(k)) remaining.push([ids[i],ids[j]]);
  }
  if(maxKnown<11){
    const rest = scheduleRounds(ids, remaining, 11-maxKnown);
    if(!rest) throw new Error('schedule generation failed');
    rest.forEach((m,i)=>{ rounds[maxKnown+1+i]=m.map(([h,a])=>[h,a,null]); });
  }
  // القسم الثاني: مرآة معكوسة الأرض بلا مواعيد (لحين صدورها رسمياً)
  for(let r=1;r<=11;r++) rounds[r+11]=rounds[r].map(([h,a])=>[a,h,null]);

  // مواعيد افتراضية للجولات غير المنشورة: أسبوعياً بعد آخر جولة حقيقية
  const genDate=(gw,mi)=>{
    const base=new Date('2026-09-04T00:00:00');
    base.setDate(base.getDate() + (gw-3)*7 + Math.floor(mi/2));
    return base.toISOString().slice(0,10)+'T'+((mi%2===0)?'18:40':'20:55');
  };
  const fixtures=[]; let fid=1;
  const stadium = id => SEED_CLUBS.find(c=>c.id===id).stadium;
  for(let gw=1; gw<=22; gw++){
    (rounds[gw]||[]).forEach(([h,a,date],mi)=>{
      fixtures.push({ id:'f'+(fid++), gw, h, a, hs:null, as:null, goals:[],
        venue: stadium(h), date: date||genDate(gw,mi), status:'U', est:false, live:null });
    });
  }
  return fixtures;
}
function pairKey(a,b){ return [a,b].sort().join('-'); }
/* توزيع الأزواج المتبقية على n جولات بحيث تكون كل جولة مطابقة كاملة —
   بحث تراجعي عبر كل الجولات مع اختيار الفريق الأقل خيارات أولاً */
function scheduleRounds(ids, pairs, nRounds){
  const avail = new Set(pairs.map(p=>pairKey(p[0],p[1])));
  const roundsOut=[];
  function solveRound(){
    if(roundsOut.length===nRounds) return true;
    const roundPairs=[];
    function match(free){
      if(free.length===0){
        roundsOut.push([...roundPairs]);
        roundPairs.forEach(k=>avail.delete(k));
        if(solveRound()) return true;
        roundPairs.forEach(k=>avail.add(k));
        roundsOut.pop();
        return false;
      }
      // الفريق ذو أقل عدد من الخصوم المتاحين (fail-first)
      let best=null, bestOpts=null;
      for(const t of free){
        const opts=free.filter(o=>o!==t && avail.has(pairKey(t,o)));
        if(bestOpts===null || opts.length<bestOpts.length){ best=t; bestOpts=opts; }
        if(opts.length===0) return false;
      }
      for(const o of bestOpts){
        const k=pairKey(best,o);
        roundPairs.push(k); avail.delete(k);
        if(match(free.filter(x=>x!==best&&x!==o))) return true;
        roundPairs.pop(); avail.add(k);
      }
      return false;
    }
    return match([...ids]);
  }
  if(!solveRound()) return null;
  return roundsOut.map(round=>round.map(k=>{
    const [a,b]=k.split('-');
    return (hashStr(a+b)%2===0) ? [a,b] : [b,a];
  }));
}
function buildGameweeks(fixtures){
  const gws=[];
  for(let n=1;n<=22;n++){
    const fx=fixtures.filter(f=>f.gw===n).map(f=>new Date(f.date)).sort((a,b)=>a-b);
    const dl=new Date(fx[0]); dl.setMinutes(dl.getMinutes()-90);
    gws.push({ n, deadline: dl.toISOString(), status:'future', avg:0, high:0 });
  }
  return gws;
}

/* =========================================================
   توليد إحصاءات المباراة من الأحداث الحقيقية
   ========================================================= */
function genMatchStats(st, fx){
  // كل شيء من بيانات حقيقية: التشكيلة والبدلاء من موقع النتائج (fx.lineups)
  // + الأهداف/الكروت/الجزاءات/البونص المدخلة يدوياً. لا توليد عشوائي.
  const find=(name,clubId)=>st.players.find(p=>p.club===clubId && p.name===name);
  const mkRow=min=>({min,g:0,a:0,cs:0,gc:0,ps:0,pm:0,og:0,yc:0,rc:0,bonus:0,pts:0});
  fx.stats={}; fx.stats[fx.h]={}; fx.stats[fx.a]={};
  for(const clubId of [fx.h, fx.a]){
    const lu=(fx.lineups||{})[clubId]||{};
    for(const pid in lu){
      if(lu[pid]==='s') fx.stats[clubId][pid]=mkRow(90);      // أساسي: 60+ دقيقة
      else if(lu[pid]==='b') fx.stats[clubId][pid]=mkRow(30); // بديل: أقل من 60
    }
  }
  const rowFor=(name,clubId)=>{
    const p=find(name,clubId); if(!p) return null;
    const rows=fx.stats[clubId];
    if(!rows[p.id]) rows[p.id]=mkRow(90); // مساهم غير محدد بالتشكيلة يُحتسب أساسياً
    return rows[p.id];
  };
  (fx.goals||[]).forEach(g=>{
    if(g.og){ const oc=g.club===fx.h?fx.a:fx.h; const r=rowFor(g.scorer,oc); if(r) r.og++; return; }
    const r=rowFor(g.scorer,g.club); if(r) r.g++;
    if(g.assist){ const a=rowFor(g.assist,g.club); if(a) a.a++; }
  });
  (fx.cards||[]).forEach(c=>{ const r=rowFor(c.name,c.club); if(!r) return; if(c.type==='r') r.rc++; else r.yc++; });
  (fx.pens||[]).forEach(pn=>{ const r=rowFor(pn.name,pn.club); if(!r) return; if(pn.type==='save') r.ps++; else r.pm++; });
  (fx.bonus||[]).forEach(b=>{ const r=rowFor(b.name,b.club); if(r) r.bonus=(+b.pts||0); });
  // الشباك النظيفة والأهداف المستقبلة
  for(const side of ['h','a']){
    const clubId=fx[side]; const conceded=(side==='h'?fx.as:fx.hs)||0;
    const rows=fx.stats[clubId];
    for(const pid in rows){ const r=rows[pid]; r.gc=conceded; r.cs=(conceded===0 && r.min>=60)?1:0; }
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

/* متوسط الجولة وأعلى نقاط */
function finalizeGWStats(st, gw){
  const g = st.gws.find(x=>x.n===gw);
  const arr=[];
  for(const pid in st.playerGW){ const r=st.playerGW[pid][gw]; if(r) arr.push(r.pts); }
  g.avg = Math.round(botGWAvg(st,gw));
  g.high = g.avg + 20 + (hashStr('hi'+gw)%14);
}
function botGWAvg(st,gw){
  // متوسط نقاط فرق الفانتازي = دالة على أهداف الجولة (معايَر على جولة من 6 مباريات)
  const goals = st.fixtures.filter(f=>f.gw===gw && f.status==='F').reduce((s,f)=>s+(f.hs||0)+(f.as||0),0);
  return 24 + goals*0.7;
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
    if(cost>R.budget+1e-9) errs.push(`تجاوزت الميزانية: ${fmtM(cost)} من ${fmtM(R.budget)} مليون`);
    return { ok:errs.length===0, errs, cost };
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
  gwPoints(team, gw, st){
    st=st||DB.state;
    const picks = team.gwPicks[gw];
    if(!picks) return { total:0, rows:[], benchPts:0, chip:null, capName:'', hits:picks?0:0 };
    const S=k=>st.scoring[k].val;
    const pts = pid => { const r=DB.pgw(pid,gw); return r? r.pts : 0; };
    const played = pid => { const r=DB.pgw(pid,gw); return r && r.min>0; };

    let xi=[...picks.xi], bench=[...picks.bench];
    const chip = picks.chip;

    // تبديل تلقائي بناءً على المشاركة الحقيقية (من تشكيلة موقع النتائج)
    if(chip!=='benchboost'){
      for(let i=0;i<xi.length;i++){
        if(played(xi[i])) continue;
        const p = DB.player(xi[i]);
        for(let b=0;b<bench.length;b++){
          const bp = DB.player(bench[b]);
          if(!played(bench[b])) continue;
          if(p.pos==='G' && bp.pos!=='G') continue;
          if(p.pos!=='G' && bp.pos==='G') continue;
          const trial=[...xi]; trial[i]=bench[b];
          if(TEAM.validateXI(trial, st).ok){ const tmp=xi[i]; xi[i]=bench[b]; bench[b]=tmp; break; }
        }
      }
    }
    // الكابتن، وإن لم يشارك فالنائب
    const capUsed = played(picks.cap) ? picks.cap : (played(picks.vice)? picks.vice : null);
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
    return { total, rows, benchPts, chip, hits, capName: capUsed? DB.player(capUsed).name : '—' };
  },

  totalPoints(team, st){
    st=st||DB.state;
    return (team.history||[]).reduce((s,h)=>s+h.pts,0);
  },
  teamValue(team){
    return team.squad.reduce((s,pid)=>s+DB.player(pid).price,0);
  },
};

/* =========================================================
   ترتيب عام (مجتمع افتراضي 8000 مدير) + بوتات مسماة
   ========================================================= */
const RANKS = {
  POP: 8000,
  botGWScore(st, botSeed, skill, gw){
    const g=st.gws.find(x=>x.n===gw);
    if(!g || g.status!=='finished') return 0;
    const avg = botGWAvg(st,gw);
    const rng = mulberry32(hashStr('bot'+botSeed+'gw'+gw));
    return Math.max(4, Math.round(avg + (skill-0.5)*24 + gauss(rng)*9));
  },
  botTotal(st, botSeed, skill, fromGW, toGW){
    let t=0;
    for(let g=fromGW; g<=toGW; g++) t+=this.botGWScore(st,botSeed,skill,g);
    return t;
  },
  finishedGWs(st){ return st.gws.filter(g=>g.status==='finished').map(g=>g.n); },
  overallRank(st, userTotal, joinedGW){
    const done=this.finishedGWs(st).filter(g=>g>=joinedGW);
    if(!done.length) return {rank:'-', of:this.POP};
    let better=0;
    for(let i=0;i<this.POP;i++){
      const skill=0.2+0.6*mulberry32(hashStr('skill'+i))();
      let t=0; for(const g of done) t+=this.botGWScore(st,i,skill,g);
      if(t>userTotal) better++;
    }
    return {rank:better+1, of:this.POP+DB.state.users.length};
  },
  gwRank(st, userPts, gw){
    let better=0;
    for(let i=0;i<this.POP;i++){
      const skill=0.2+0.6*mulberry32(hashStr('skill'+i))();
      if(this.botGWScore(st,i,skill,gw)>userPts) better++;
    }
    return {rank:better+1, of:this.POP};
  },
  namedBotRow(st, bot, fromGW){
    const done=this.finishedGWs(st).filter(g=>g>=(fromGW||1));
    const seed = hashStr(bot.id)%this.POP;
    let total=0, last=0;
    done.forEach(g=>{ const s=this.botGWScore(st,seed,bot.skill,g); total+=s; if(g===Math.max(...done)) last=s; });
    return { id:bot.id, name:bot.name, teamName:bot.teamName, total, last };
  },
};

/* =========================================================
   ملكية اللاعبين والانتقالات المحاكاة
   ========================================================= */
const MARKET = {
  ownership(pid){
    const st=DB.state; const p=DB.player(pid);
    const form=DB.playerForm(pid);
    let base = Math.min(60, Math.max(0.3, (p.price-4)*6 + form*3.2 + (hashStr('own'+pid)%40)/10 ));
    let real=0, users=Object.keys(st.teams).length;
    for(const uid in st.teams) if(st.teams[uid].squad.includes(pid)) real++;
    if(users>0) base = base*0.9 + (real/users)*100*0.1;
    return Math.round(base*10)/10;
  },
  transferCounts(pid){
    const st=DB.state; const t=st.transferStats[pid]||{in:0,out:0};
    const form=DB.playerForm(pid);
    const simIn = Math.max(0, Math.round(form*form*90 + (hashStr('tin'+pid+st.currentGW)%50)));
    const simOut = Math.max(0, Math.round((3-Math.min(3,form))*40 + (hashStr('tout'+pid+st.currentGW)%60)));
    return { in: simIn + t.in*50, out: simOut + t.out*50 };
  },
  applyPriceChanges(st){
    const changes=[];
    st.players.forEach(p=>{
      const tc=this.transferCounts(p.id);
      const net=tc.in-tc.out;
      const rng=mulberry32(hashStr('price'+p.id+st.currentGW))();
      if(net>140 && rng>0.3){ p.price=Math.round((p.price+st.rules.priceRise)*10)/10; changes.push({p,d:+st.rules.priceRise}); }
      else if(net<-90 && rng>0.45 && p.price>3.5){ p.price=Math.round((p.price-st.rules.priceDrop)*10)/10; changes.push({p,d:-st.rules.priceDrop}); }
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
  /* إنهاء الجولة الحالية: احتساب نقاط الجميع + الترتيب + الأسعار + الترحيل */
  finalize(gw){
    const st=DB.state;
    // اللعبة واقعية: لا احتساب قبل إدخال كل النتائج الحقيقية
    const pending=st.fixtures.filter(f=>f.gw===gw && f.status!=='F');
    if(pending.length){
      return { ok:false, err:`لا يمكن إغلاق الجولة — ${pending.length} مباريات بلا نتيجة. أدخلها من «النتائج والإحصاءات» أولاً.` };
    }
    finalizeGWStats(st,gw);
    const g=st.gws.find(x=>x.n===gw); g.status='finished';

    // نقاط كل مستخدم
    for(const uid in st.teams){
      const team=st.teams[uid];
      if(team.joinedGW>gw) continue;
      if(!team.gwPicks[gw]) this.snapshotPicks(team, gw);
      const res=TEAM.gwPoints(team, gw, st);
      const rank=RANKS.gwRank(st,res.total,gw);
      team.history=team.history||[];
      team.history.push({gw, pts:res.total, benchPts:res.benchPts, rank:rank.rank, chip:res.chip, hits:res.hits});
      // الضربة الحرة: استرجاع الفريق
      if(team.gwPicks[gw] && team.gwPicks[gw].chip==='freehit' && team.fhBackup){
        team.squad=team.fhBackup.squad; team.xi=team.fhBackup.xi; team.bench=team.fhBackup.bench;
        team.cap=team.fhBackup.cap; team.vice=team.fhBackup.vice; team.bank=team.fhBackup.bank;
        team.fhBackup=null;
      }
      team.activeChip=null;
      // انتقالات مجانية
      team.ft=Math.min(st.rules.maxSavedTransfers, (team.ft||1)+st.rules.freeTransfers);
      NOTIF.push(uid,'points',`احتُسبت الجولة ${gw}: ${res.total} نقطة (ترتيب الجولة ${rank.rank.toLocaleString('ar')})`);
    }
    // أسعار
    const changes=MARKET.applyPriceChanges(st);
    for(const uid in st.teams){
      changes.slice(0,6).forEach(ch=>{
        if(st.teams[uid].squad.includes(ch.p.id))
          NOTIF.push(uid,'price',`${ch.d>0?'ارتفع':'انخفض'} سعر ${ch.p.name} إلى ${fmtM(ch.p.price)}`);
      });
    }
    st.transferStats={};
    // الجولة التالية
    st.currentGW=gw+1;
    const ng=st.gws.find(x=>x.n===gw+1);
    if(ng) ng.status='next';
    DB.save();
    return { ok:true, changes:changes.length };
  },
  snapshotPicks(team, gw){
    team.gwPicks[gw]={ xi:[...team.xi], bench:[...team.bench], cap:team.cap, vice:team.vice,
      chip:team.activeChip, hits:team.pendingHits||0 };
    team.pendingHits=0;
  },
  deadlinePassed(gw){
    const g=DB.gw(gw); if(!g) return false;
    return new Date() > new Date(g.deadline);
  },
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
    if(st.users.length){ st.session=st.users[0].id; DB.save(); return; }
    const id='u1local';
    st.users.push({id, username:'المدرب', email:'local@kwfantasy', pass:'', teamName:'فريقي',
      avatar:'', verified:true, created:new Date().toISOString(), admin:false});
    st.teams[id]={ squad:[],xi:[],bench:[],cap:null,vice:null,bank:st.rules.budget,ft:1,
      usedChips:{},activeChip:null,joinedGW:st.currentGW,history:[],transfers:[],gwPicks:{},pendingHits:0 };
    st.session=id;
    NOTIF.push(id,'welcome',`أهلاً بك! كوّن فريقك قبل موعد إغلاق الجولة ${st.currentGW}.`);
    DB.save();
  },
  signup(username,email,pass,teamName){
    const st=DB.state;
    username=username.trim(); email=email.trim().toLowerCase();
    if(!username||!email||!pass||!teamName) return {ok:false,err:'كل الحقول مطلوبة'};
    if(pass.length<6) return {ok:false,err:'كلمة المرور 6 أحرف على الأقل'};
    if(st.users.find(u=>u.email===email)) return {ok:false,err:'البريد مسجل مسبقاً'};
    if(st.users.find(u=>u.username===username)) return {ok:false,err:'اسم المستخدم محجوز'};
    const id='u'+(st.users.length+1)+Date.now().toString(36).slice(-4);
    const code=String(100000+Math.floor(Math.random()*900000));
    st.users.push({id,username,email,pass:this.hash(pass),teamName,avatar:'',verified:false,created:new Date().toISOString(),admin:st.users.length===0});
    st.verifyCodes[email]=code;
    st.teams[id]={ squad:[],xi:[],bench:[],cap:null,vice:null,bank:st.rules.budget,ft:1,
      usedChips:{},activeChip:null,joinedGW:st.currentGW,history:[],transfers:[],gwPicks:{},pendingHits:0 };
    st.session=id;
    NOTIF.push(id,'welcome',`أهلاً ${username}! كوّن فريقك قبل موعد إغلاق الجولة ${st.currentGW}.`);
    DB.save();
    return {ok:true, code};
  },
  verify(code){
    const m=DB.me(); if(!m) return {ok:false,err:'لا يوجد جلسة'};
    if(DB.state.verifyCodes[m.email]===code){ m.verified=true; delete DB.state.verifyCodes[m.email]; DB.save(); return {ok:true}; }
    return {ok:false, err:'الرمز غير صحيح'};
  },
  login(email,pass){
    const st=DB.state; email=email.trim().toLowerCase();
    const u=st.users.find(x=>x.email===email);
    if(!u || u.pass!==this.hash(pass)) return {ok:false,err:'بيانات الدخول غير صحيحة'};
    st.session=u.id; DB.save();
    return {ok:true};
  },
  logout(){ DB.state.session=null; DB.save(); },
  forgot(email){
    const st=DB.state; email=email.trim().toLowerCase();
    const u=st.users.find(x=>x.email===email);
    if(!u) return {ok:false,err:'البريد غير مسجل'};
    const code=String(100000+Math.floor(Math.random()*900000));
    st.verifyCodes['reset:'+email]=code; DB.save();
    return {ok:true, code};
  },
  resetPass(email,code,newPass){
    const st=DB.state; email=email.trim().toLowerCase();
    if(st.verifyCodes['reset:'+email]!==code) return {ok:false,err:'الرمز غير صحيح'};
    if(newPass.length<6) return {ok:false,err:'كلمة المرور 6 أحرف على الأقل'};
    const u=st.users.find(x=>x.email===email);
    u.pass=this.hash(newPass); delete st.verifyCodes['reset:'+email]; DB.save();
    return {ok:true};
  },
};

/* =========================================================
   الدوريات الخاصة
   ========================================================= */
const LEAGUES = {
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
  addBots(lg, n){
    const st=DB.state;
    const avail=st.bots.filter(b=>!lg.members.includes(b.id));
    for(let i=0;i<n && i<avail.length;i++) lg.members.push(avail[i].id);
    DB.save();
  },
  table(lg){
    const st=DB.state;
    const rows=[];
    lg.members.forEach(mid=>{
      if(mid.startsWith('b')){
        const bot=st.bots.find(b=>b.id===mid);
        if(bot){ const r=RANKS.namedBotRow(st,bot,lg.global?1:lg.createdGW); rows.push({...r, isBot:true}); }
      } else {
        const u=DB.user(mid); const team=st.teams[mid];
        if(u&&team){
          const hist=(team.history||[]).filter(h=>lg.global||h.gw>=lg.createdGW);
          const total=hist.reduce((s,h)=>s+h.pts,0);
          const last=hist.length? hist[hist.length-1].pts:0;
          rows.push({id:mid,name:u.username,teamName:u.teamName,total,last,isBot:false});
        }
      }
    });
    // H2H: نقاط 3/1/0 بالمواجهات حسب نقاط الجولة
    if(lg.type==='h2h'){
      rows.forEach(r=>{r.w=0;r.d=0;r.l=0;r.h2hPts=0;});
      const done=RANKS.finishedGWs(st).filter(g=>g>=lg.createdGW);
      done.forEach(gw=>{
        const scores={};
        rows.forEach(r=>{
          if(r.isBot){ const bot=st.bots.find(b=>b.id===r.id); scores[r.id]=RANKS.botGWScore(st,hashStr(r.id)%RANKS.POP,bot.skill,gw); }
          else { const team=st.teams[r.id]; const h=(team.history||[]).find(x=>x.gw===gw); scores[r.id]=h?h.pts:0; }
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
    } else {
      rows.sort((a,b)=>b.total-a.total);
    }
    return rows;
  },
  mine(){
    const m=DB.me(); if(!m) return [];
    return DB.state.leagues.filter(l=>l.global || l.members.includes(m.id));
  },
};
