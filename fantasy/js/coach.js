/* =========================================================
   المدرب — خانة مستقلة خارج الـ15 (لائحة منصور 2026-09-20)
   - 12 مدرباً، مدرب واحد لكل مشترك، سعر ثابت حسب قوة النادي، الميزانية 105.
   - النقاط: نتيجة المباراة + مكافأة صعوبة المنافس حسب فارق المراكز في جدول الدوري
     قبل الجولة + شباك نظيفة + فوز بفارق هدفين − عقوبة الخسارة أمام فريق أقل ترتيباً.
   - عقد من جولتين: بعدهما تغيير مجاني؛ التغيير المبكر يتبع قاعدة انتقالات اللاعبين
     (حر الآن مع «التغييرات الحرة»، وإلا يستهلك انتقالاً مجانياً أو −4).
   - Wildcard و Free Hit يشملان المدرب؛ Bench Boost و Triple Captain لا يمسّانه.
   - بلا مدرب = صفر نقاط (لا خصم). إقالة المدرب: الخانة تنتقل للمدرب الجديد تلقائياً.
   يُحمَّل بعد engine.js وقبل views.js.
   ========================================================= */
'use strict';

const coachIdOf = club => 'c' + club;

const COACHES = {
  rules(st){ st=st||DB.state; return (st.rules && st.rules.coach) || COACH_RULES; },
  enabled(st){ return !!this.rules(st).enabled; },
  /* هل تُحتسب نقاط المدرب في هذه الجولة؟ (تبدأ من جولة الانطلاق) */
  active(st, gw){ st=st||DB.state; const R=this.rules(st); return !!R.enabled && gw >= (R.fromGW||1); },
  all(st){ st=st||DB.state; return st.coaches||[]; },
  get(st, id){ st=st||DB.state; return (st.coaches||[]).find(c=>c.id===id)||null; },
  ofClub(st, club){ return this.get(st, coachIdOf(club)); },
  /* صور المدربين من الموقع: القصّة الكاملة، ووجه للبطاقات الصغيرة (نفس ملفات صفحة النادي) */
  /* face=true وجه للقوائم الصغيرة، 's' قصّة واقفة صغيرة (بطاقة الملعب)، غير ذلك القصّة الكاملة */
  photo(c, face){ if(!c || !c.slug) return ''; const v = face===true ? '_f' : face==='s' ? '_s' : face==='b' ? '_body' : ''; return `/assets/coaches/${c.slug}${v}.webp?v=29`; },  /* 'b' = صورة واقفة كاملة (Gemini 2026-09-20) */
  /* البذرة: يضيف المفقود ويحدّث الاسم والجنسية والصورة؛ السعر يبقى كما ضبطه المدير */
  seed(st){
    st=st||DB.state; if(typeof SEED_COACHES==='undefined') return false;
    st.coaches = st.coaches||[];
    let dirty=false;
    SEED_COACHES.forEach(([club,name,nat,slug,price])=>{
      let c=st.coaches.find(x=>x.club===club);
      if(!c){ c={ id:coachIdOf(club), club, name, nat, slug, price, startPrice:price, status:'a' }; st.coaches.push(c); dirty=true; return; }
      if(c.name!==name || c.nat!==nat || c.slug!==slug){ Object.assign(c,{name,nat,slug}); dirty=true; }
      if(c.price==null){ c.price=price; c.startPrice=price; dirty=true; }
    });
    return dirty;
  },
  /* حالة المدرب: 'a' مستمر، 'x' غادر النادي (من الجولة endGW لا نقاط له) */
  gone(c, gw){ return !!c && c.status==='x' && (+c.endGW||0) <= gw; },
};

/* ---------- جدول الدوري قبل جولة ---------- */
const STANDINGS = {
  /* الترتيب من المباريات المنتهية قبل الجولة (نفس ترتيب الموقع: النقاط ثم الفارق ثم له). لا مباريات = قوة النادي */
  before(st, gw){
    st=st||DB.state;
    const t={};
    st.clubs.forEach(c=>{ t[c.id]={ club:c.id, P:0,W:0,D:0,L:0,GF:0,GA:0,Pts:0, form:[] }; });
    st.fixtures.filter(f=>f.status==='F' && f.gw<gw && f.hs!=null && f.as!=null).sort((a,b)=>a.gw-b.gw).forEach(f=>{
      const H=t[f.h], A=t[f.a]; if(!H||!A) return;
      H.P++; A.P++; H.GF+=f.hs; H.GA+=f.as; A.GF+=f.as; A.GA+=f.hs;
      if(f.hs>f.as){ H.W++; A.L++; H.Pts+=3; H.form.push('w'); A.form.push('l'); }
      else if(f.hs<f.as){ A.W++; H.L++; A.Pts+=3; A.form.push('w'); H.form.push('l'); }
      else { H.D++; A.D++; H.Pts++; A.Pts++; H.form.push('d'); A.form.push('d'); }
    });
    const rows=Object.values(t).map(x=>({...x, GD:x.GF-x.GA}));
    const played=rows.some(r=>r.P>0);
    rows.sort((a,b)=> played
      ? (b.Pts-a.Pts || b.GD-a.GD || b.GF-a.GF || DB.club(a.club).name.localeCompare(DB.club(b.club).name,'ar'))
      : ((DB.club(b.club).strength||0)-(DB.club(a.club).strength||0)));
    rows.forEach((r,i)=>{ r.rank=i+1; });
    return rows;
  },
  /* الجولة المحتسبة تحفظ لقطة الترتيب المرجعي — تعديل إداري لاحق لا يغيّر نقاط مدرب محتسبة */
  snapshot(st, gw){
    const g=DB.gw(gw); if(!g) return;
    const map={}; this.before(st, gw).forEach(r=>{ map[r.club]=r.rank; });
    g.table=map;
  },
  rankOf(st, gw, club){
    const g=DB.gw(gw);
    if(g && g.table && g.table[club]) return g.table[club];
    const r=this.before(st, gw).find(x=>x.club===club);
    return r? r.rank : 0;
  },
  /* سجل النادي حتى الآن (كل المباريات المنتهية) */
  record(st, club){
    st=st||DB.state;
    const rows=this.before(st, 99);
    return rows.find(r=>r.club===club)||null;
  },
};

/* ---------- احتساب نقاط المدرب ---------- */
const COACH = {
  tier(gap, arr){ /* 1-2 → [0], 3-4 → [1], 5-6 → [2], 7-8 → [3], 9+ → [4] */
    if(gap<=0) return 0;
    const i=Math.min(arr.length-1, Math.ceil(gap/2)-1);
    return arr[i]||0;
  },
  lossTier(gap, arr){ /* 1-3 → [0], 4-6 → [1], 7+ → [2] */
    if(gap<=0) return 0;
    const i=Math.min(arr.length-1, Math.ceil(gap/3)-1);
    return arr[i]||0;
  },
  /* نقاط مباراة واحدة لمدرب ناديه my ضد opp */
  matchPoints(st, my, opp, gf, ga, myRank, oppRank){
    const R=COACHES.rules(st); const rows=[]; let total=0;
    const add=(label,val,pts)=>{ rows.push({label,val,pts}); total+=pts; };
    const res = gf>ga ? 'w' : gf<ga ? 'l' : 'd';
    if(res==='w') add('الفوز', '', +R.win||0);
    else if(res==='d') add('التعادل', '', +R.draw||0);
    else add('الخسارة', '', +R.loss||0);
    const up = myRank - oppRank;      // المنافس أعلى بكم مركزاً
    if(up>0 && res!=='l'){
      const b=this.tier(up, res==='w'? (R.diffWin||[]) : (R.diffDraw||[]));
      if(b) add('صعوبة المنافس', `أعلى بـ${up}`, b);
    }
    if(ga===0 && (+R.cs||0)) add('شباك نظيفة', '', +R.cs);
    if(res==='w' && gf-ga>=2 && (+R.margin||0)) add('الفوز بفارق هدفين أو أكثر', `${gf}-${ga}`, +R.margin);
    const down = oppRank - myRank;    // المنافس أقل بكم مركزاً
    if(res==='l' && down>0){
      const pen=this.lossTier(down, R.lossPen||[]);
      if(pen) add('الخسارة أمام فريق أقل ترتيباً', `أقل بـ${down}`, -pen);
    }
    return { res, total, rows, myRank, oppRank };
  },
  /* نقاط مدرب في جولة: مجموع مبارياته المنتهية فيها (جولة مزدوجة = مباراتان) */
  points(st, coachId, gw, opts){
    st=st||DB.state; opts=opts||{};
    const c=COACHES.get(st, coachId);
    const out={ total:0, rows:[], matches:[], gone:false, pending:false };
    if(!c || !COACHES.active(st, gw)) return out;
    if(COACHES.gone(c, gw)){ out.gone=true; return out; }
    const fxs=st.fixtures.filter(f=>f.gw===gw && (f.h===c.club||f.a===c.club));
    fxs.forEach(f=>{
      const home=f.h===c.club, opp=home? f.a : f.h;
      if(f.status!=='F' || f.hs==null || f.as==null){ out.pending=true; out.matches.push({fx:f, opp, home, pending:true}); return; }
      const gf=home? f.hs : f.as, ga=home? f.as : f.hs;
      const mp=this.matchPoints(st, c.club, opp, gf, ga, STANDINGS.rankOf(st, gw, c.club), STANDINGS.rankOf(st, gw, opp));
      out.total+=mp.total; out.rows.push(...mp.rows);
      out.matches.push({fx:f, opp, home, gf, ga, ...mp});
    });
    return out;
  },
  /* نقاط المدرب في كل الجولات المحتسبة (لصفحة الملف) */
  season(st, coachId){
    st=st||DB.state; const R=COACHES.rules(st);
    return st.gws.filter(g=>g.status==='finished' && g.n>=(R.fromGW||1)).map(g=>({ gw:g.n, ...this.points(st, coachId, g.n) }));
  },
  total(st, coachId){ return this.season(st, coachId).reduce((s,x)=>s+x.total, 0); },
  form(st, club, n){ const r=STANDINGS.record(st, club); return r? r.form.slice(-(n||5)) : []; },
};

/* ---------- المدرب داخل فريق المشترك ---------- */
Object.assign(TEAM, {
  coachOf(team, st){ return team && team.coach ? COACHES.get(st||DB.state, team.coach) : null; },
  coachPrice(team, st){ const c=this.coachOf(team, st); return c? +c.price||0 : 0; },
  /* حالة العقد: الجولة n من contract، وهل التغيير مجاني الآن */
  coachContract(team, st){
    st=st||DB.state; const R=COACHES.rules(st); const len=+R.contract||2;
    if(!team || !team.coach) return { has:false, n:0, len, free:true };
    const since=+team.coachSince||st.currentGW;
    const done=Math.max(0, st.currentGW-since);            // جولات اكتملت تحت العقد
    const c=COACHES.get(st, team.coach);
    const replaced = !!(c && c.replacedGW && +c.replacedGW>=since);   // تغيّر مدرب النادي أثناء العقد: تغيير مجاني استثنائي
    return { has:true, since, n:Math.min(len, done+1), len, done, free: done>=len || replaced, replaced };
  },
  /* تكلفة تعيين مدرب جديد الآن: {free, hits, usesFT} */
  coachChangeCost(team, st){
    st=st||DB.state; const R=st.rules;
    const chipFree = team.activeChip==='wildcard' || team.activeChip==='freehit';
    if(!team.coach || chipFree || !!R.freeChanges || this.coachContract(team, st).free) return { free:true, hits:0, usesFT:false };
    if((+team.ft||0)>0) return { free:false, hits:0, usesFT:true };
    return { free:false, hits:+R.transferCost||0, usesFT:false };
  },
  /* تعيين المدرب (أو تغييره): يعدّل البنك والعقد ويخصم إن لزم. يعيد رسالة خطأ أو null */
  setCoach(team, coachId, st){
    st=st||DB.state;
    const c=COACHES.get(st, coachId); if(!c) return 'مدرب غير موجود';
    if(team.coach===coachId) return null;
    if(COACHES.gone(c, st.currentGW)) return 'هذا المدرب غادر النادي';
    const old=this.coachOf(team, st);
    const bankAfter=Math.round(((+team.bank||0)+(old? +old.price:0)-(+c.price))*10)/10;
    if(bankAfter < -1e-9) return 'الرصيد لا يكفي لهذا المدرب';
    const cost=this.coachChangeCost(team, st);
    if(!cost.free){ if(cost.usesFT) team.ft=Math.max(0,(+team.ft||0)-1); else team.pendingHits=(+team.pendingHits||0)+cost.hits; }
    team.bank=bankAfter;
    team.coach=coachId; team.coachSince=st.currentGW;
    team.coachLog=(team.coachLog||[]).concat([{gw:st.currentGW, out:old? old.id:null, in:coachId, date:new Date().toISOString()}]).slice(-30);
    return null;
  },
});

/* ---------- ترقية الميزانية إلى 105 (مرة واحدة لكل فريق) ---------- */
const COACH_UPGRADE = {
  BANK_VER: 2,
  /* +5 لكل فريق مكوَّن لم يُرقَّ بعد؛ يعيد true إذا تغيّر شيء */
  bumpTeam(team, st){
    st=st||DB.state;
    if(!team || !(team.squad||[]).length) return false;
    if((+team.bankVer||0) >= this.BANK_VER) return false;
    const delta = Math.round(((+st.rules.budget||100) - 100)*10)/10;
    if(delta>0) team.bank = Math.round(((+team.bank||0)+delta)*10)/10;
    team.bankVer=this.BANK_VER;
    return true;
  },
  /* فرق هذا الجهاز */
  local(st){
    st=st||DB.state; let n=0;
    for(const uid in (st.teams||{})) if(this.bumpTeam(st.teams[uid], st)) n++;
    return n;
  },
};
