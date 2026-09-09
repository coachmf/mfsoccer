/* =========================================================
   الربط مع موقع محمد الفيلكاوي — mfsoccer.com
   البيانات تُقرأ مباشرة من قاعدة بياناته (Firestore) وتُسكب
   في محرر النتائج: النتيجة، الأهداف والصناعة، الكروت، الجزاءات.
   البونص والتشكيلات تبقى يدوية إلى أن ينزلها الموقع.
   ========================================================= */
const MFSYNC = {
  URL: 'https://firestore.googleapis.com/v1/projects/mfsoccer-c7ee4/databases/(default)/documents/seasons/2026-2027?key=AIzaSyD_ZzAE4HEKPIuAKCmta8tzN5KOa8IUfuo',

  /* فك ترميز قيم Firestore */
  un(v){
    if(v==null) return null;
    if('stringValue' in v) return v.stringValue;
    if('integerValue' in v) return +v.integerValue;
    if('doubleValue' in v) return v.doubleValue;
    if('booleanValue' in v) return v.booleanValue;
    if('nullValue' in v) return null;
    if('timestampValue' in v) return v.timestampValue;
    if('arrayValue' in v) return (v.arrayValue.values||[]).map(x=>this.un(x));
    if('mapValue' in v){ const o={}; for(const k in (v.mapValue.fields||{})) o[k]=this.un(v.mapValue.fields[k]); return o; }
    return v;
  },

  /* هل لُعبت المباراة فعلاً؟ الموقع يخزّن 0-0 كقيمة افتراضية للمباريات القادمة،
     فلا تُعدّ نتيجةً إلا إذا مضى موعد الانطلاق (أو سُجّلت أهداف). بلا موعد: لا. */
  isPlayed(m){
    const has = m.hg!=null && m.ag!=null && m.hg!=='' && m.ag!=='';
    if(!has) return false;
    if((+m.hg||0)+(+m.ag||0) > 0) return true;
    if(!m.date) return false;
    const ko = kwDate(m.date+'T'+(m.time||'23:59'));      // توقيت الكويت دائماً، لا توقيت جهاز الزائر
    return !isNaN(ko) && ko.getTime() <= Date.now();
  },

  async fetchSeason(){
    // الأفضل: نفس اتصال Firestore الذي تستعمله اللعبة (قراءة واحدة، بلا مفتاح REST الذي يُحدّ بـ429)
    if(typeof CLOUD!=='undefined' && CLOUD.ready && CLOUD.db){
      try{
        const s = await CLOUD.db.collection('seasons').doc('2026-2027').get();
        if(s.exists) return s.data();
      }catch(e){ /* نجرّب REST أدناه */ }
    }
    const r = await fetch(this.URL);
    if(!r.ok) throw new Error('تعذر الوصول لموقع mfsoccer (HTTP '+r.status+')');
    const j = await r.json();
    const d = {};
    for(const k in j.fields) d[k]=this.un(j.fields[k]);
    return d;
  },

  /* تطبيع الأسماء العربية للمطابقة: إزالة رقم القميص والمسافات وتوحيد الهمزات */
  norm(s){
    return (s||'')
      .replace(/^[\s\d]+\s*-?\s*/,'')
      .replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه')
      .replace(/ؤ/g,'و').replace(/ئ/g,'ي').replace(/ء/g,'').replace(/ث/g,'ت')
      .replace(/\s+/g,'');
  },

  clubId(name){
    const alias = {'الصليبخات':'SLB','الصليبيخات':'SLB'};
    const n=(name||'').trim();
    if(alias[n]) return alias[n];
    const c = DB.state.clubs.find(c=>this.norm(c.name)===this.norm(n));
    return c? c.id : null;
  },

  lev(a,b){
    if(Math.abs(a.length-b.length)>2) return 9;
    const m=[...Array(a.length+1)].map((_,i)=>[i,...Array(b.length).fill(0)]);
    for(let j=0;j<=b.length;j++) m[0][j]=j;
    for(let i=1;i<=a.length;i++) for(let j=1;j<=b.length;j++)
      m[i][j]=Math.min(m[i-1][j]+1, m[i][j-1]+1, m[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
    return m[a.length][b.length];
  },

  /* أسماء يكتبها الموقع مختلفة عن قوائمنا */
  ALIAS: {
    'JAH|عبدالله السعيدي':'عبدالله الداحس',
  },

  resolvePlayer(mfName, clubId, report){
    const raw0=String(mfName||'').trim();
    // الموقع يكتب أحياناً رقم القميص وحده («17») — نطابقه بالرقم
    if(/^\d{1,2}$/.test(raw0)){
      const byNo=DB.state.players.find(p=>p.club===clubId && +p.shirt===+raw0 && p.status!=='u')
               || DB.state.players.find(p=>p.club===clubId && +p.shirt===+raw0);
      if(byNo) return byNo;
      if(report) report.unmatched.push(`رقم ${raw0} (${DB.club(clubId).name})`);
      return null;
    }
    const clean=raw0.replace(/^[\s\d]+\s*-?\s*/,'').trim();
    const al=this.ALIAS[clubId+'|'+clean];
    if(al){ const p=DB.state.players.find(x=>x.club===clubId && x.name===al); if(p) return p; }
    const nm=this.norm(mfName);
    if(!nm) return null;
    const squad=[...DB.state.players.filter(p=>p.club===clubId),
                 ...DB.state.players.filter(p=>p.club!==clubId && (p.exClubs||[]).includes(clubId))];
    let hit = squad.find(p=>this.norm(p.name)===nm);
    if(!hit) hit = squad.find(p=>{const n=this.norm(p.name); return n.length>3 && nm.length>3 && (n.includes(nm)||nm.includes(n));});
    if(!hit) hit = squad.find(p=>this.lev(this.norm(p.name),nm)<=2);
    if(!hit){
      // مطابقة بالاسم الجزئي الفريد: «فيتور دا سيلفا» عنده = «فيتور فييرا» عندنا
      const raw=(mfName||'').replace(/^[\s\d]+\s*-?\s*/,'');
      const toks=raw.split(/\s+/).map(t=>this.norm(t)).filter(t=>t.length>=4 && t!=='عبدالله' && t!=='محمد');
      for(const t of toks){
        const cands=squad.filter(p=>p.name.split(/\s+/).some(w=>this.norm(w)===t));
        if(cands.length===1){ hit=cands[0]; break; }
      }
    }
    if(!hit && report) report.unmatched.push(`${mfName.replace(/^[\s\d]+\s*-?\s*/,'')} (${DB.club(clubId).name})`);
    return hit||null;
  },

  /* ---------- الجدول: من الموقع فقط ----------
     كل مباراة على الموقع (الدوري) تُنشأ أو تُحدَّث عندنا (الفريقان والموعد)؛
     المباراة غير المنتهية التي ليست على الموقع تُحذف. جولة بلا مباريات على
     الموقع تبقى فارغة بلا موعد. لا توليد ولا تخمين. */
  syncFixtures(data, st, opts){
    st=st||DB.state; opts=opts||{};
    const rep={created:0, updated:0, removed:0, notes:[]};
    const total=(st.rules&&st.rules.totalGWs)||22;
    const ms=(data.matches||[]).filter(m=>(!m.comp||m.comp==='الدوري') && +m.round>=1 && +m.round<=total);
    const seen=new Set();
    ms.forEach(m=>{
      const h=this.clubId(m.home), a=this.clubId(m.away);
      if(!h||!a){ rep.notes.push(`نادٍ غير معروف: ${m.home} × ${m.away}`); return; }
      const gw=+m.round;
      const date = m.date ? (m.date+'T'+(m.time||'18:00')) : null;
      let f=st.fixtures.find(x=>x.gw===gw && !seen.has(x.id) && ((x.h===h&&x.a===a)||(x.h===a&&x.a===h)));
      if(!f){
        f={ id:fixtureId(gw,h,a), gw, h, a, hs:null, as:null, goals:[], cards:[], pens:[], subs:[], lineups:null,
            venue:DB.club(h).stadium, date, status:'U', est:false, live:null };
        st.fixtures.push(f); rep.created++;
      } else {
        let ch=false;
        if(f.status==='U' && (f.h!==h||f.a!==a)){ f.h=h; f.a=a; f.venue=DB.club(h).stadium; ch=true; }
        if(date && f.date!==date){ f.date=date; ch=true; }
        if(ch) rep.updated++;
      }
      seen.add(f.id);
    });
    if(opts.removeMissing!==false){
      const before=st.fixtures.length;
      st.fixtures=st.fixtures.filter(f=>seen.has(f.id) || f.status==='F' || (DB.gw(f.gw)||{}).status==='finished');
      rep.removed=before-st.fixtures.length;
    }
    st.fixtures.sort((a,b)=>(a.gw-b.gw)||String(a.date||'').localeCompare(String(b.date||'')));
    GWADMIN.refreshDeadlines(st);
    return rep;
  },

  /* سحب الجدول تلقائياً عند فتح اللعبة (كل 3 ساعات) — على كل جهاز، قراءة فقط.
     النتائج والإحصاءات تبقى من نشر المدير؛ هنا الفريقان والموعد فقط. */
  KEYF:'kwf_fx_sync',
  CACHE:'kwf_fx_cache',
  /* آخر جدول مسحوب من الموقع يُطبَّق فوراً (بلا شبكة) بعد كل تحميل/مزامنة من السحابة —
     حتى لا يعود جدول قديم مولَّد من نشر سابق ولو للحظات */
  applyCached(){
    try{
      const c=JSON.parse(localStorage.getItem(this.CACHE)||'null');
      if(!c || !Array.isArray(c.matches)) return null;
      const rep=this.syncFixtures({matches:c.matches}, DB.state, {removeMissing:true});
      if(rep.created||rep.updated||rep.removed){ try{ localStorage.setItem(DB.KEY, JSON.stringify(DB.state)); }catch(e){} }
      return rep;
    }catch(e){ return null; }
  },
  async autoFixtures(force){
    const cached=this.applyCached();
    let last=0; try{ last=+localStorage.getItem(this.KEYF)||0; }catch(e){}
    if(!force && cached && Date.now()-last < 3*3600e3){      // بلا نسخة مخزّنة نسحب فوراً مهما كان التوقيت
      if(cached && (cached.created||cached.updated||cached.removed) && typeof APP!=='undefined') APP.render();
      return cached;
    }
    let data;
    try{ data=await this.fetchSeason(); }catch(e){ return cached; }
    const rep=this.syncFixtures(data, DB.state, {removeMissing:true});
    // النتائج والتشكيلات والتبديلات والأهداف: من الموقع مباشرة على كل جهاز — لا تنتظر المدير
    const played=new Set((data.matches||[]).filter(m=>(!m.comp||m.comp==='الدوري') && this.isPlayed(m)).map(m=>+m.round));
    let ev=0;
    for(const gw of [...played].sort((a,b)=>a-b)){ const r=await this.importRound(gw,{quiet:true,data}); if(r) ev+=r.goals+r.subs+r.xi; }
    rep.events=ev; rep.rounds=played.size;
    try{ localStorage.setItem(this.KEYF, String(Date.now())); }catch(e){}
    try{ localStorage.setItem(this.CACHE, JSON.stringify({at:Date.now(), matches:(data.matches||[]).map(m=>({round:m.round,home:m.home,away:m.away,date:m.date,time:m.time,comp:m.comp}))})); }catch(e){}
    try{ localStorage.setItem(DB.KEY, JSON.stringify(DB.state)); }catch(e){}
    if(typeof APP!=='undefined') APP.render();
    return rep;
  },

  /* زر الإدارة: سحب الجدول الآن مع تقرير */
  async adminSyncFixtures(){
    UI.toast('جاري سحب الجدول من موقع mfsoccer…');
    const rep=await this.autoFixtures(true);
    if(!rep){ UI.toast('تعذّر الوصول لموقع mfsoccer', true); return; }
    DB.save(); APP.render();
    const st=DB.state;
    const rounds=st.gws.map(g=>{ const n=st.fixtures.filter(f=>f.gw===g.n).length; return n? `ج${g.n}: ${n} مباريات` : null; }).filter(Boolean);
    UI.modal(`<h3>سحب الجدول من mfsoccer</h3>
      <div class="muted" style="line-height:2">${rep.created} مباراة جديدة · ${rep.updated} محدَّثة · ${rep.removed} حُذفت (ليست على الموقع)</div>
      <div class="tiny" style="margin-top:8px">${rounds.join(' · ')||'لا مباريات على الموقع'}</div>
      ${rep.notes.length? `<div class="tiny" style="margin-top:8px;color:var(--gold)">${rep.notes.map(esc).join('<br>')}</div>`:''}
      <div class="tiny" style="margin-top:10px">الجولات التي لم ينشر الموقع جدولها تبقى فارغة وبلا موعد إغلاق. لا تنسَ «نشر حالة اللعبة» بعد السحب.</div>
      <button class="btn" style="margin-top:12px" onclick="UI.closeModal()">تمام</button>`);
  },

  /* استيراد جولة كاملة من الموقع. opts.quiet = بلا واجهة (المزامنة التلقائية على كل جهاز)، opts.data = مستند مسحوب مسبقاً */
  async importRound(gw, opts){
    opts=opts||{}; const quiet=!!opts.quiet;
    if(!quiet) UI.toast('جاري السحب من موقع mfsoccer…');
    let data=opts.data;
    if(!data){
      try{ data = await this.fetchSeason(); }
      catch(e){ if(!quiet) UI.toast(e.message, true); return null; }
    }

    const st=DB.state;
    const report={matches:0, goals:0, cards:0, pens:0, xi:0, subs:0, unmatched:[], notes:[], noXI:[], xiFixed:[], benchCards:[], upd:data.lastUpdate||''};
    // الجدول كله من الموقع أولاً: يُنشئ مباريات الجولة إن لم تكن عندنا ويحذف ما ليس على الموقع
    const fxRep=this.syncFixtures(data, st, {removeMissing:true});
    fxRep.notes.forEach(n=>report.notes.push(n));
    const ms=(data.matches||[]).filter(m=>+m.round===gw && (!m.comp || m.comp==='الدوري'));
    if(!ms.length){ if(quiet) return report; DB.save(); APP.render(); UI.toast(`الجولة ${gw} غير موجودة على الموقع بعد — تبقى فارغة`, true); return report; }

    const used=new Set();
    for(const m of ms){
      const h=this.clubId(m.home), a=this.clubId(m.away);
      if(!h||!a){ report.notes.push(`نادٍ غير معروف: ${m.home} × ${m.away}`); continue; }
      let f=st.fixtures.find(x=>x.gw===gw && !used.has(x.id) && ((x.h===h&&x.a===a)||(x.h===a&&x.a===h)));
      if(!f) f=st.fixtures.find(x=>x.gw===gw && !used.has(x.id) && [x.h,x.a].some(c=>c===h||c===a));
      if(!f){ report.notes.push(`ما لقيت بالجدول: ${m.home} × ${m.away}`); continue; }
      used.add(f.id);
      if(f.manual){ report.notes.push(`مباراة معدَّلة يدوياً من الإدارة — لم تُستورد: ${m.home} × ${m.away}`); continue; }

      // مسح إحصاءات النسخة القديمة من playerGW
      if(f.stats){ for(const cid in f.stats){ for(const pid in f.stats[cid]){ if(st.playerGW[pid]) delete st.playerGW[pid][gw]; } } }
      f.stats=null;

      f.h=h; f.a=a; f.venue=DB.club(h).stadium;
      if(m.date) f.date=m.date+'T'+(m.time||'18:00');
      const played = this.isPlayed(m);
      if(played){ f.hs=+m.hg; f.as=+m.ag; f.status='F'; f.est=false; }
      else { f.hs=null; f.as=null; f.status='U'; f.goals=[]; f.cards=[]; f.pens=[];
             f.lineups=null; f.subs=[]; report.matches++; continue; }

      const pair=(sc,cd)=>{const s=this.clubId(sc),c=this.clubId(cd);return (s===h&&c===a)||(s===a&&c===h);};

      // الأهداف والصناعة (مع الأهداف العكسية وركلات الجزاء المسجلة)
      f.goals=[];
      (data.goals||[]).filter(g=>+g.r===gw && (!g.comp||g.comp==='الدوري') && pair(g.sc,g.cd)).forEach(g=>{
        const benefiting=this.clubId(g.sc);
        if(g.og){
          const ogClub = benefiting===h? a : h;
          const pl=this.resolvePlayer(g.og, ogClub, report);
          if(pl){ f.goals.push({min:+g.m||0, scorer:pl.name, club:benefiting, assist:null, pen:false, og:true}); report.goals++; }
          return;
        }
        const pl=this.resolvePlayer(g.p, benefiting, report);
        if(!pl) return;
        let assist=null;
        if(g.a){ const ap=this.resolvePlayer(g.a, benefiting, report); if(ap) assist=ap.name; }
        f.goals.push({min:+g.m||0, scorer:pl.name, club:benefiting, assist, pen:(g.det==='ركلة جزاء')});
        report.goals++;
      });
      f.goals.sort((x,y)=>x.min-y.min);

      // الكروت: إنذار = أصفر، إنذار ثانٍ/طرد مباشر = أحمر
      // (الطرد بإنذارين = -3 فقط، فنحذف الأصفر الأول مثل FPL)
      f.cards=[];
      (data.cards||[]).filter(c=>+c.r===gw && (!c.comp||c.comp==='الدوري')).forEach(c=>{
        const cid=this.clubId(c.club);
        if(cid!==h && cid!==a) return;
        const pl=this.resolvePlayer(c.p, cid, report); if(!pl) return;
        if(c.type==='إنذار ثانٍ'){
          const yi=f.cards.findIndex(x=>x.name===pl.name && x.type==='y');
          if(yi>=0) f.cards.splice(yi,1);
        }
        f.cards.push({name:pl.name, club:cid, type: c.type==='إنذار'?'y':'r'});
        report.cards++;
      });

      // ركلات الجزاء غير المسجلة = إهدار (المسجلة محسوبة ضمن الأهداف)
      f.pens=[];
      (data.pens||[]).filter(p=>+p.r===gw && (!p.comp||p.comp==='الدوري') && p.res!=='سجلت').forEach(p=>{
        const cid=this.clubId(p.by);
        if(cid!==h && cid!==a) return;
        const pl=this.resolvePlayer(p.p, cid, report); if(!pl) return;
        f.pens.push({name:pl.name, club:cid, type:'miss'});
        report.pens++;
      });

      // التشكيلة: الأساسيون من كشف الموقع (s)، ومن دخل بديلاً من تبديلات الموقع (b).
      // من لم يُذكر في الاثنين لا يُدرج أصلاً = لم يلعب (صفر دقيقة).
      const lu = {};
      const anyXI = (data.lineups||[]).some(x=>+x.r===gw && (!x.comp||x.comp==='الدوري') &&
                                               [h,a].includes(this.clubId(x.club)));
      if(anyXI){
        lu[h]={}; lu[a]={};
        (data.lineups||[]).filter(x=>+x.r===gw && (!x.comp||x.comp==='الدوري')).forEach(x=>{
          const cid=this.clubId(x.club); if(cid!==h && cid!==a) return;
          const pl=this.resolvePlayer(x.p, cid, report); if(!pl) return;
          lu[cid][pl.id]='s'; report.xi++;
        });
        f.lineups=lu;
      }

      // التبديلات: خروج ودخول بالشوط والدقيقة
      f.subs=[];
      (data.subs||[]).filter(x=>+x.r===gw && (!x.comp||x.comp==='الدوري')).forEach(x=>{
        const cid=this.clubId(x.club); if(cid!==h && cid!==a) return;
        const po = x.out? this.resolvePlayer(x.out, cid, report) : null;
        const pi = x.in ? this.resolvePlayer(x.in , cid, report) : null;
        if(!po && !pi) return;
        f.subs.push({club:cid, out:po?po.name:'', in:pi?pi.name:'', h:+x.h||1, m:+x.m||0});
        // الداخل بديلاً = b (حتى لو كتبه الموقع خطأً ضمن الأساسيين)، والخارج لا بد أنه لعب:
        // إن لم يكن في تشكيلة الموقع فهو أساسي ناقص من كشفها (ما لم يكن دخل بديلاً قبل ذلك)
        if(f.lineups && f.lineups[cid]){
          if(pi){ if(f.lineups[cid][pi.id]==='s') report.xiFixed.push(`${pi.name} (${DB.club(cid).name}) مكتوب أساسياً في الموقع وهو دخل بديلاً`); f.lineups[cid][pi.id]='b'; }
          if(po && !f.lineups[cid][po.id]){ f.lineups[cid][po.id]='s'; report.xiFixed.push(`${po.name} (${DB.club(cid).name}) خرج في الدقيقة ${absMinute(x.h,x.m)} وهو غير مذكور في تشكيلة الموقع — احتُسب أساسياً`); }
        }
        report.subs++;
      });
      f.subs.sort((p,q)=>absMinute(p.h,p.m)-absMinute(q.h,q.m));

      genMatchStats(st,f);
      if(f.lineups){ for(const cid of [h,a]){ const nS=Object.values(f.lineups[cid]||{}).filter(v=>v==='s').length; if(nS!==11) report.notes.push(`${DB.club(cid).name} (${DB.club(f.h).short} × ${DB.club(f.a).short}): عدد الأساسيين بعد التصحيح ${nS} وليس 11 — راجع تشكيلة الموقع`); } }
      // مساهم (هدف/صناعة/كرت/جزاء) غير مذكور في تشكيلة الموقع ولا تبديلاته: احتُسب أساسياً — يُنبَّه عليه
      if(f.lineups){
        for(const cid of [h,a]){
          for(const pid in (f.stats[cid]||{})){
            if(!f.lineups[cid] || f.lineups[cid][pid]) continue;
            const p=DB.player(pid); if(p) report.noXI.push(`${p.name} (${DB.club(cid).name}) — ${DB.club(f.h).short} × ${DB.club(f.a).short}`);
          }
        }
        (f.cards||[]).forEach(c=>{ const p=st.players.find(x=>x.club===c.club && x.name===c.name); if(p && f.lineups[c.club] && !f.lineups[c.club][p.id] && !(f.stats[c.club]||{})[p.id]) report.benchCards.push(`${c.name} (${DB.club(c.club).name}) — ${c.type==='r'?'حمراء':'صفراء'} — ${DB.club(f.h).short} × ${DB.club(f.a).short}`); });
      }
      report.matches++;
    }

    if(st.fixtures.some(x=>x.gw===gw && x.status==='F')) finalizeGWStats(st,gw);
    GWADMIN.refreshDeadlines(st);

    if(quiet) return report;               // المزامنة التلقائية: سجل المشتركين يبقى من الخادم (إعادة الاحتساب للمدير)
    // لو الجولة محتسبة: تصحيح نقاط الفرق بأثر رجعي
    const g=DB.gw(gw);
    if(g && g.status==='finished'){
      for(const uid in st.teams){
        const team=st.teams[uid];
        const hh=(team.history||[]).find(x=>x.gw===gw);
        if(!hh) continue;
        const res=TEAM.gwPoints(team,gw,st);
        hh.pts=res.total; hh.benchPts=res.benchPts;
      }
      RANKS.recomputeGWRanks(st, gw);   // الترتيب بعد اكتمال نقاط الجميع
    }
    DB.save(); APP.render();

    UI.modal(`<h3>استيراد الجولة ${gw} من mfsoccer</h3>
      <div class="tiny" style="margin-bottom:8px">آخر تحديث للموقع: ${esc(report.upd)}</div>
      <div class="muted" style="line-height:2">
        ${report.matches} مباريات · ${report.goals} أهداف · ${report.cards} كروت · ${report.pens} جزاءات مهدرة
        · ${report.xi} أساسي · ${report.subs} تبديل
      </div>
      ${report.unmatched.length? `<h3 style="font-size:.85rem;margin-top:10px;color:var(--red)">أسماء ما انطابقت مع قوائمنا (انسحبت بدونها):</h3>
        <div class="tiny">${report.unmatched.map(esc).join('<br>')}</div>`:''}
      ${report.noXI.length? `<h3 style="font-size:.85rem;margin-top:10px;color:var(--gold)">سجّلوا/صنعوا وهم غير مذكورين في تشكيلة الموقع ولا تبديلاته — احتُسبوا أساسيين (90 دقيقة). راجع بيانات الموقع:</h3>
        <div class="tiny">${report.noXI.map(esc).join('<br>')}</div>`:''}
      ${report.xiFixed.length? `<h3 style="font-size:.85rem;margin-top:10px;color:var(--gold)">تصحيحات تلقائية لتشكيلة الموقع (من التبديلات):</h3>
        <div class="tiny">${report.xiFixed.map(esc).join('<br>')}</div>`:''}
      ${report.benchCards.length? `<h3 style="font-size:.85rem;margin-top:10px;color:var(--gold)">كروت لغير المشاركين (لم يُذكروا في التشكيلة ولا التبديلات) — لم تُحتسب مشاركة ولا خصم. تأكد إن كانوا لعبوا فعلاً:</h3>
        <div class="tiny">${report.benchCards.map(esc).join('<br>')}</div>`:''}
      ${report.notes.length? `<div class="tiny" style="margin-top:8px;color:var(--gold)">${report.notes.map(esc).join('<br>')}</div>`:''}
      <div class="tiny" style="margin-top:10px">البونص (3/2/1) والتشكيلات تدخلها يدوياً من «تحرير» — الموقع ما ينزلها بعد.</div>
      <button class="btn" style="margin-top:12px" onclick="UI.closeModal()">تمام</button>`);
  },
};
