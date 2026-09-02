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

  async fetchSeason(){
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
    const clean=(mfName||'').replace(/^[\s\d]+\s*-?\s*/,'').trim();
    const al=this.ALIAS[clubId+'|'+clean];
    if(al){ const p=DB.state.players.find(x=>x.club===clubId && x.name===al); if(p) return p; }
    const nm=this.norm(mfName);
    if(!nm) return null;
    const squad=DB.state.players.filter(p=>p.club===clubId);
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

  /* استيراد جولة كاملة من الموقع */
  async importRound(gw){
    UI.toast('جاري السحب من موقع mfsoccer…');
    let data;
    try{ data = await this.fetchSeason(); }
    catch(e){ UI.toast(e.message, true); return; }

    const st=DB.state;
    const report={matches:0, goals:0, cards:0, pens:0, xi:0, subs:0, unmatched:[], notes:[], upd:data.lastUpdate||''};
    const ms=(data.matches||[]).filter(m=>m.round===gw && (!m.comp || m.comp==='الدوري'));
    if(!ms.length){ UI.toast(`الجولة ${gw} غير موجودة على الموقع بعد`, true); return; }

    const used=new Set();
    for(const m of ms){
      const h=this.clubId(m.home), a=this.clubId(m.away);
      if(!h||!a){ report.notes.push(`نادٍ غير معروف: ${m.home} × ${m.away}`); continue; }
      let f=st.fixtures.find(x=>x.gw===gw && !used.has(x.id) && ((x.h===h&&x.a===a)||(x.h===a&&x.a===h)));
      if(!f) f=st.fixtures.find(x=>x.gw===gw && !used.has(x.id) && [x.h,x.a].some(c=>c===h||c===a));
      if(!f){ report.notes.push(`ما لقيت بالجدول: ${m.home} × ${m.away}`); continue; }
      used.add(f.id);

      // مسح إحصاءات النسخة القديمة من playerGW
      if(f.stats){ for(const cid in f.stats){ for(const pid in f.stats[cid]){ if(st.playerGW[pid]) delete st.playerGW[pid][gw]; } } }
      f.stats=null;

      f.h=h; f.a=a; f.venue=DB.club(h).stadium;
      if(m.date) f.date=m.date+'T'+(m.time||'18:00');
      const played = m.hg!=null && m.ag!=null && m.hg!=='' && m.ag!=='';
      if(played){ f.hs=+m.hg; f.as=+m.ag; f.status='F'; f.est=false; }
      else { f.hs=null; f.as=null; f.status='U'; f.goals=[]; f.cards=[]; f.pens=[];
             f.lineups=null; f.subs=[]; report.matches++; continue; }

      const pair=(sc,cd)=>{const s=this.clubId(sc),c=this.clubId(cd);return (s===h&&c===a)||(s===a&&c===h);};

      // الأهداف والصناعة (مع الأهداف العكسية وركلات الجزاء المسجلة)
      f.goals=[];
      (data.goals||[]).filter(g=>g.r===gw && (!g.comp||g.comp==='الدوري') && pair(g.sc,g.cd)).forEach(g=>{
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
      (data.cards||[]).filter(c=>c.r===gw && (!c.comp||c.comp==='الدوري')).forEach(c=>{
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
      (data.pens||[]).filter(p=>p.r===gw && (!p.comp||p.comp==='الدوري') && p.res!=='سجلت').forEach(p=>{
        const cid=this.clubId(p.by);
        if(cid!==h && cid!==a) return;
        const pl=this.resolvePlayer(p.p, cid, report); if(!pl) return;
        f.pens.push({name:pl.name, club:cid, type:'miss'});
        report.pens++;
      });

      // التشكيلة الأساسية: من لم يُذكر في كشف الموقع يُعدّ بديلاً (صفر دقيقة حتى يدخل)
      const lu = {};
      const anyXI = (data.lineups||[]).some(x=>x.r===gw && (!x.comp||x.comp==='الدوري') &&
                                               [h,a].includes(this.clubId(x.club)));
      if(anyXI){
        lu[h]={}; lu[a]={};
        [h,a].forEach(cid=>{ st.players.filter(p=>p.club===cid).forEach(p=>{ lu[cid][p.id]='b'; }); });
        (data.lineups||[]).filter(x=>x.r===gw && (!x.comp||x.comp==='الدوري')).forEach(x=>{
          const cid=this.clubId(x.club); if(cid!==h && cid!==a) return;
          const pl=this.resolvePlayer(x.p, cid, report); if(!pl) return;
          lu[cid][pl.id]='s'; report.xi++;
        });
        f.lineups=lu;
      }

      // التبديلات: خروج ودخول بالشوط والدقيقة
      f.subs=[];
      (data.subs||[]).filter(x=>x.r===gw && (!x.comp||x.comp==='الدوري')).forEach(x=>{
        const cid=this.clubId(x.club); if(cid!==h && cid!==a) return;
        const po = x.out? this.resolvePlayer(x.out, cid, report) : null;
        const pi = x.in ? this.resolvePlayer(x.in , cid, report) : null;
        if(!po && !pi) return;
        f.subs.push({club:cid, out:po?po.name:'', in:pi?pi.name:'', h:+x.h||1, m:+x.m||0});
        report.subs++;
      });
      f.subs.sort((p,q)=>absMinute(p.h,p.m)-absMinute(q.h,q.m));

      genMatchStats(st,f);
      report.matches++;
    }

    if(st.fixtures.some(x=>x.gw===gw && x.status==='F')) finalizeGWStats(st,gw);

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
      ${report.notes.length? `<div class="tiny" style="margin-top:8px;color:var(--gold)">${report.notes.map(esc).join('<br>')}</div>`:''}
      <div class="tiny" style="margin-top:10px">البونص (3/2/1) والتشكيلات تدخلها يدوياً من «تحرير» — الموقع ما ينزلها بعد.</div>
      <button class="btn" style="margin-top:12px" onclick="UI.closeModal()">تمام</button>`);
  },
};
