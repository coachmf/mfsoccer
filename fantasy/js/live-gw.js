/* =========================================================
   الجولة المباشرة — النقاط تظهر أثناء الجولة لا بعد إغلاقها
   بعد موعد الإغلاق، ومع كل مباراة تُلعب وتُسجَّل على mfsoccer، تُحسب نقاط
   كل مشترك من تشكيلته المقفلة على الجهاز (نفس الإحصاءات على كل الأجهزة)،
   فيرى نقاطه الحالية وترتيبه المباشر والمتوسط. الاعتماد الرسمي عند
   «احتساب وإغلاق» من المدير بعد آخر مباراة.
   يُحمَّل بعد guide.js.
   ========================================================= */
'use strict';

const LIVEGW = {
  cache:{ at:0, rows:null, gw:0 }, busy:false,
  gw(){ return DB.state.currentGW; },
  active(){ return GWADMIN.inProgress(this.gw()); },
  /* «لُعبت» = انتهت فعلاً: status 'F' تعني أن للمباراة نتيجة/إحصاءات (تُحتسب مباشرة)، وover=false أثناء اللعب (2026-10-09: «1 من 6 لُعبت» والمباراة في شوطها الأول) */
  matches(){ const fx=DB.state.fixtures.filter(f=>f.gw===this.gw()); return { played:fx.filter(f=>f.status==='F' && f.over!==false).length, live:fx.filter(f=>f.status==='F' && f.over===false).length, total:fx.length }; },
  picksOf(team, gw){ return (team.gwPicks && team.gwPicks[gw]) || TEAM.picksFrom(team); },
  calc(team, gw){ return TEAM.gwPoints({...team, gwPicks:{[gw]:this.picksOf(team,gw)}}, gw, DB.state, {live:true}); },
  /* نقاطي الآن */
  mine(){
    const t=DB.myTeam(); if(!t || !(t.squad||[]).length) return null;
    if(GWADMIN.lateJoiner(t)) return null;   /* فريقه يبدأ من الجولة التالية */
    return this.calc(t, this.gw());
  },
  /* نقاط كل المشتركين الآن (للترتيب والمتوسط):
     - جهاز المدير: يقرأ المشتركين، يحسب، وينشر لقطة meta/live (مرة كل 5 دقائق على الأكثر).
     - أي جهاز آخر: يقرأ اللقطة فقط (قراءة واحدة بدل قراءة كل المشتركين). */
  lastPub:0,
  /* فترة النشر: 5 دقائق أثناء مباراة جارية (انطلقت خلال آخر 3 ساعات أو تنطلق خلال 10 دقائق)، وإلا 30 دقيقة */
  pubEvery(){
    const now=Date.now(); const gw=this.gw();
    const on=DB.state.fixtures.some(f=>f.gw===gw && f.date && (()=>{ const k=kwDate(f.date).getTime(); return k-10*60000<=now && now<=k+3*3600*1000; })());
    return on ? 5*60000 : 30*60000;
  },
  /* المتوسط والترتيب الحي ونقاط الدوريات (منصور 2026-10-09): لا تتحرك أثناء المباريات — تتحدث مرة يومياً بعد ساعة
     من نهاية آخر مباراة اليوم (انطلاق آخر مباراة + ساعتان للمباراة + ساعة). بين أول انطلاقة وذلك الوقت تبقى آخر لقطة.
     نقاط المشترك نفسه (mine) تبقى مباشرة. الحساب من تشكيلات كل المشتركين (CDN /api/fantasy-teams) بمحرك النقاط نفسه
     على كل جهاز — لا اعتماد على جهاز مدير (كان meta/live غائباً فظهر «1 / 1»). */
  FROZEN_KEY:'kwf_livefrozen',
  kwDay(t){ return new Date(t + 3*3600e3).toISOString().slice(0,10); },
  todayKicks(){ const gw=this.gw(), today=this.kwDay(Date.now());
    return DB.state.fixtures.filter(f=>f.gw===gw && f.date).map(f=>kwDate(f.date).getTime()).filter(k=>!isNaN(k) && this.kwDay(k)===today); },
  unlockAt(){ const ks=this.todayKicks(); return ks.length ? Math.max(...ks) + 3*3600e3 : 0; },
  frozenNow(){ const ks=this.todayKicks(); if(!ks.length) return false; const now=Date.now(); return now >= Math.min(...ks) && now < this.unlockAt(); },
  loadFrozen(gw){ try{ const v=JSON.parse(localStorage.getItem(this.FROZEN_KEY)||'null'); return (v && v.gw===gw && Array.isArray(v.rows)) ? v : null; }catch(e){ return null; } },
  saveFrozen(gw, rows, at){ try{ localStorage.setItem(this.FROZEN_KEY, JSON.stringify({gw, at, rows})); }catch(e){} },
  async refresh(force){
    if(!this.active()) return null;
    if(this.busy) return this.cache.rows;
    const gw=this.gw();
    if(this.frozenNow()){
      /* أثناء مباريات اليوم: آخر لقطة محفوظة (أو لا شيء) — لا حساب جديد */
      const fz=this.loadFrozen(gw);
      this.cache={ at:Date.now(), rows: fz? fz.rows : null, gw }; this.snapAt = fz? fz.at : null;
      return this.cache.rows;
    }
    /* الحداثة لا تشترط وجود صفوف: فشل الجلب كان يعيد الطلب مع كل رسم (حلقة refresh ↔ render — 2026-10-09) */
    if(!force && this.cache.gw===gw && Date.now()-this.cache.at < 10*60000) return this.cache.rows;
    this.busy=true;
    try{
      let rows=null;
      const T = (typeof CLOUD!=='undefined' && CLOUD.loadTeamsSnap) ? await CLOUD.loadTeamsSnap() : null;
      if(T && Array.isArray(T.rows) && T.rows.length){
        rows = T.rows.map(v=>{ let live=0; try{ live=+this.calc(v.team, gw).total||0; }catch(e){ live=0; }
          return { id:v.id, name:v.name, teamName:v.teamName, live, total:v.total }; });
        rows.sort((a,b)=>b.live-a.live);
        let prev=null, rank=0; rows.forEach((r,i)=>{ if(prev===null || r.live<prev){ rank=i+1; prev=r.live; } r.liveRank=rank; });
        this.snapAt = new Date().toISOString();
        this.saveFrozen(gw, rows, this.snapAt);
      } else {
        const fz=this.loadFrozen(gw); if(fz){ rows=fz.rows; this.snapAt=fz.at; }
      }
      /* بلا صفوف (فشل/بلا اتصال): إعادة المحاولة بعد دقيقتين لا مع كل رسم */
      this.cache={ at: rows ? Date.now() : Date.now()-8*60000, rows, gw };
    }catch(e){ console.warn('live refresh failed', e); this.cache={ at:Date.now()-8*60000, rows:this.cache.rows, gw }; }
    this.busy=false;
    if(this.cache.rows && typeof APP!=='undefined' && ['dashboard','points','leagues'].includes(APP.route)) APP.render();   // لا رسم بعد نتيجة فارغة
    return this.cache.rows;
  },
  /* نص يوضح متى يتحدث المتوسط والترتيب */
  pendingLabel(){
    if(!this.frozenNow()) return '';
    const d=new Date(this.unlockAt());
    return 'المتوسط والترتيب يتحدثان '+d.toLocaleTimeString('ar-KW',{hour:'2-digit',minute:'2-digit', timeZone:'Asia/Kuwait'});
  },
  summary(){
    const rows=this.cache.rows; if(!rows || !rows.length || this.cache.gw!==this.gw()) return null;
    const me=DB.me(); const mine=me? rows.find(r=>r.id===me.id) : null;
    return { rank: mine? mine.liveRank : null, of: rows.length,
      avg: Math.round(rows.reduce((s,r)=>s+r.live,0)/rows.length), high: rows[0].live, at:this.snapAt||null };
  },
  /* «آخر تحديث» للقطة الحية — تُعرض للزائر حتى يعرف أن الأرقام لقطة لا لحظية */
  snapLabel(){
    if(!this.snapAt) return '';
    const d=new Date(this.snapAt); if(isNaN(d)) return '';
    return 'آخر تحديث '+d.toLocaleTimeString('ar-KW',{hour:'2-digit',minute:'2-digit'});
  },
  liveOf(id){ const r=(this.cache.rows||[]).find(x=>x.id===id); return r? r.live : null; },
  /* كتلة الرئيسية */
  heroBlock(){
    if(!this.active()) return '';
    this.refresh();
    const st=DB.state, m=this.matches(), my=this.mine(), s=this.summary();
    const done = m.total && m.played===m.total;
    return `
      <div class="hh-gwtitle">الجولة ${st.currentGW} · <span class="pill red">مباشر</span>
        <span class="tiny" style="opacity:.85">${done? 'اكتملت المباريات — بانتظار اعتماد الجولة' : `${m.played} من ${m.total} مباريات لُعبت`}${this.frozenNow()? ' · '+this.pendingLabel() : (s&&s.at? ' · '+this.snapLabel() : '')}</span></div>
      <div class="hh-stats">
        <div><b>${s? s.avg : '—'}</b><span>المتوسط الآن</span></div>
        <div class="big" onclick="APP.go('points')"><b>${my? my.total : 0}</b><span>نقاطك الآن ${UI.icon('chev',13)}</span></div>
        <div><b>${s && s.rank? s.rank.toLocaleString('ar') : '—'}<small style="font-size:.55em;opacity:.8">${s&&s.rank? ' / '+s.of.toLocaleString('ar') : ''}</small></b><span>ترتيبك الآن</span></div>
      </div>`;
  },
};

/* تحديث دوري أثناء الجولة: النتائج من mfsoccer كل 5 دقائق ثم إعادة الحساب */
setInterval(()=>{ if(LIVEGW.active() && typeof MFSYNC!=='undefined' && !document.hidden) MFSYNC.autoFixtures(true).then(()=>LIVEGW.refresh(true)); }, 5*60000);
