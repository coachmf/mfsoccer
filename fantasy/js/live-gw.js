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
  matches(){ const fx=DB.state.fixtures.filter(f=>f.gw===this.gw()); return { played:fx.filter(f=>f.status==='F').length, total:fx.length }; },
  picksOf(team, gw){ return (team.gwPicks && team.gwPicks[gw]) || TEAM.picksFrom(team); },
  calc(team, gw){ return TEAM.gwPoints({...team, gwPicks:{[gw]:this.picksOf(team,gw)}}, gw, DB.state, {live:true}); },
  /* نقاطي الآن */
  mine(){
    const t=DB.myTeam(); if(!t || !(t.squad||[]).length) return null;
    return this.calc(t, this.gw());
  },
  /* نقاط كل المشتركين الآن (للترتيب والمتوسط) — تُحسب على الجهاز من مستنداتهم */
  async refresh(force){
    if(!this.active()) return null;
    if(this.busy) return this.cache.rows;
    if(!force && this.cache.rows && this.cache.gw===this.gw() && Date.now()-this.cache.at < 60000) return this.cache.rows;
    this.busy=true;
    try{
      const gw=this.gw(); const rows=[];
      if(typeof CLOUD!=='undefined' && CLOUD.ready && CLOUD.user){
        const q=await CLOUD.managers().get();
        q.forEach(d=>{ const v=d.data(); const t=v.team; if(!t || !(t.squad||[]).length) return;
          const res=this.calc(t, gw);
          rows.push({ id:d.id, name:v.username||'مشترك', teamName:v.teamName||'', live:res.total, total:+v.total||0, hist:v.history||[] });
        });
      } else {
        for(const uid in DB.state.teams){ const t=DB.state.teams[uid]; if(!(t.squad||[]).length) continue; const u=DB.user(uid);
          const res=this.calc(t, gw);
          rows.push({ id:uid, name:u?u.username:uid, teamName:u?u.teamName:'', live:res.total, total:TEAM.totalPoints(t), hist:t.history||[] });
        }
      }
      rows.sort((a,b)=>b.live-a.live);
      let prev=null, rank=0; rows.forEach((r,i)=>{ if(prev===null || r.live<prev){ rank=i+1; prev=r.live; } r.liveRank=rank; });
      this.cache={ at:Date.now(), rows, gw };
    }catch(e){ console.warn('live refresh failed', e); }
    this.busy=false;
    if(typeof APP!=='undefined' && ['dashboard','points','leagues'].includes(APP.route)) APP.render();
    return this.cache.rows;
  },
  summary(){
    const rows=this.cache.rows; if(!rows || !rows.length || this.cache.gw!==this.gw()) return null;
    const me=DB.me(); const mine=me? rows.find(r=>r.id===me.id) : null;
    return { rank: mine? mine.liveRank : null, of: rows.length,
      avg: Math.round(rows.reduce((s,r)=>s+r.live,0)/rows.length), high: rows[0].live };
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
        <span class="tiny" style="opacity:.85">${done? 'اكتملت المباريات — بانتظار اعتماد الجولة' : `${m.played} من ${m.total} مباريات لُعبت`}</span></div>
      <div class="hh-stats">
        <div><b>${s? s.avg : '—'}</b><span>المتوسط الآن</span></div>
        <div class="big" onclick="APP.go('points')"><b>${my? my.total : 0}</b><span>نقاطك الآن</span></div>
        <div><b>${s && s.rank? s.rank.toLocaleString('ar') : '—'}<small style="font-size:.55em;opacity:.8">${s&&s.rank? ' / '+s.of.toLocaleString('ar') : ''}</small></b><span>ترتيبك الآن</span></div>
      </div>`;
  },
};

/* تحديث دوري أثناء الجولة: النتائج من mfsoccer كل 5 دقائق ثم إعادة الحساب */
setInterval(()=>{ if(LIVEGW.active() && typeof MFSYNC!=='undefined' && !document.hidden) MFSYNC.autoFixtures(true).then(()=>LIVEGW.refresh(true)); }, 5*60000);
