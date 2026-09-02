/* إضافات: بطل الجولة · تنبيهات الإغلاق · الأكثر انتقالاً · مقارنة اللاعبين */
'use strict';

/* ======================= بطل الجولة ======================= */
GWADMIN.champion=function(gw){
  const st=DB.state; const g=DB.gw(gw);
  if(!g || g.status!=='finished') return null;
  let best=null;
  for(const uid in st.teams){
    const h=(st.teams[uid].history||[]).find(x=>x.gw===gw); if(!h) continue;
    const u=st.users.find(x=>x.id===uid); if(!u) continue;
    if(!best || h.pts>best.pts) best={id:uid, name:u.username, teamName:u.teamName, pts:h.pts, isBot:false};
  }
  (st.bots||[]).forEach(b=>{
    const pts=RANKS.botGWScore(st, hashStr(b.id)%RANKS.POP, b.skill, gw);
    if(!best || pts>best.pts) best={id:b.id, name:b.name, teamName:b.teamName, pts, isBot:true};
  });
  return best;
};
/* كم مرة كان المستخدم بطل الجولة */
GWADMIN.championCount=function(uid){
  return RANKS.finishedGWs(DB.state).filter(gw=>{ const c=this.champion(gw); return c && c.id===uid; }).length;
};

/* ======================= تنبيهات الإغلاق ======================= */
const REMIND = {
  enabled(){ try{ return localStorage.getItem('kwf_notify')==='1'; }catch(e){ return false; } },
  async toggle(on){
    if(on){
      if(!('Notification' in window)){ UI.toast('المتصفح لا يدعم التنبيهات',true); APP.render(); return; }
      const perm=await Notification.requestPermission();
      if(perm!=='granted'){ UI.toast('لم يُسمح بالتنبيهات — فعّلها من إعدادات المتصفح',true); APP.render(); return; }
      localStorage.setItem('kwf_notify','1'); UI.toast('سيصلك تنبيه قبل الإغلاق بساعتين');
      try{ new Notification('فانتازي دوري زين', {body:'تم تفعيل التنبيهات — بنذكّرك قبل إغلاق كل جولة بساعتين.', icon:'assets/logo-light.png'}); }catch(e){}
    } else { localStorage.setItem('kwf_notify',''); UI.toast('أُوقفت التنبيهات'); }
    APP.render();
  },
  /* يُستدعى كل دقيقة من APP */
  check(){
    const st=DB.state; const m=DB.me(); if(!m) return;
    const g=DB.gw(st.currentGW); if(!g) return;
    const ms=new Date(g.deadline)-new Date();
    if(ms<=0 || ms>2*3600000) return;
    const key='dl2h'+st.currentGW;
    st.notifications[m.id]=st.notifications[m.id]||[];
    if(!st.notifications[m.id].some(n=>n.type===key)){
      NOTIF.push(m.id,key,`باقي ${UI.countdown(g.deadline)} على إغلاق الجولة ${st.currentGW} — راجع تشكيلتك وانتقالاتك`);
      DB.save(); APP.renderTopbar();
    }
    if(this.enabled() && 'Notification' in window && Notification.permission==='granted' && !localStorage.getItem('kwf_dln'+st.currentGW)){
      localStorage.setItem('kwf_dln'+st.currentGW,'1');
      try{ new Notification(`الجولة ${st.currentGW} تُغلق بعد ${UI.countdown(g.deadline)}`, {body:'راجع تشكيلتك وانتقالاتك قبل الإغلاق', icon:'assets/logo-light.png', tag:'kwf-dl'}); }catch(e){}
    }
  },
  whatsappLink(){
    const st=DB.state; const g=DB.gw(st.currentGW); if(!g) return '#';
    const txt=`تذكير فانتازي دوري زين: الجولة ${st.currentGW} تُغلق ${UI.fmtDate(g.deadline)} — باقي ${UI.countdown(g.deadline)}. راجعوا تشكيلاتكم!`;
    return 'https://wa.me/?text='+encodeURIComponent(txt);
  },
  card(){
    const st=DB.state; const g=DB.gw(st.currentGW);
    const supported='Notification' in window;
    const secure=window.isSecureContext;
    return `<div class="card"><h3>التنبيهات</h3>
      <label class="row" style="gap:10px;cursor:pointer;align-items:center">
        <input type="checkbox" style="width:20px;height:20px;accent-color:var(--accent)" ${this.enabled()?'checked':''} onchange="REMIND.toggle(this.checked)">
        <span>تنبيه من المتصفح قبل إغلاق الجولة بساعتين</span></label>
      <div class="tiny" style="margin:6px 0 10px;color:var(--text3)">${!supported? 'هذا المتصفح لا يدعم التنبيهات.' : !secure? 'تنبيهات المتصفح تشتغل فقط عبر HTTPS أو على نفس الجهاز — التذكير داخل التطبيق (الجرس) يشتغل دائماً.' : 'يصلك التنبيه إذا كان التطبيق مفتوحاً في أي تبويب.'}</div>
      ${g? `<a class="btn sec sm" style="display:inline-flex;gap:6px;align-items:center;text-decoration:none" target="_blank" rel="noopener" href="${this.whatsappLink()}">${UI.icon('bell',16)} أرسل تذكير الإغلاق بالواتساب</a>
      <div class="tiny" style="margin-top:6px;color:var(--text3)">يفتح واتساب برسالة جاهزة فيها موعد إغلاق الجولة ${st.currentGW} — أرسلها لنفسك أو لقروب الربع.</div>`:''}
    </div>`;
  },
};

Object.assign(VIEWS, {
  /* بطاقة بطل الجولة (للرئيسية) */
  championCard(gw){
    const c=GWADMIN.champion(gw); if(!c) return '';
    const me=DB.me(); const mine=c.id===me.id;
    return `<div class="champ ${mine?'mine':''}" onclick="APP.go('champions')">
      <div class="champ-ic">${UI.icon('trophy',26)}</div>
      <div style="flex:1;min-width:0">
        <div class="champ-l">بطل الجولة ${gw}</div>
        <div class="champ-t">${mine? 'أنت! ' : ''}${esc(c.teamName)}</div>
        <div class="champ-n">${esc(c.name)}</div>
      </div>
      <div class="champ-p"><b>${c.pts}</b><span>نقطة</span></div>
    </div>`;
  },
  championBadge(uid){
    const n=GWADMIN.championCount(uid); if(!n) return '';
    return `<span class="champ-badge" title="بطل الجولة ${n} مرة">${UI.icon('trophy',13)}${n>1?' ×'+n:''}</span>`;
  },
  champions(){
    const st=DB.state; const me=DB.me();
    const gws=RANKS.finishedGWs(st).sort((a,b)=>b-a);
    const rows=gws.map(gw=>{ const c=GWADMIN.champion(gw); if(!c) return '';
      return `<tr class="${c.id===me.id?'hl':''}"><td class="num">${gw}</td><td><b>${esc(c.teamName)}</b><div class="tiny">${esc(c.name)}${c.id===me.id?' · أنت':''}</div></td><td class="num" style="color:var(--accent)">${c.pts}</td></tr>`; }).join('');
    const mine=GWADMIN.championCount(me.id);
    return `<h2 style="margin-bottom:12px">أبطال الجولات</h2>
      <div class="card" style="margin-bottom:12px"><div class="row" style="gap:10px;align-items:center">${UI.icon('trophy',28)}<div><b>${mine? `أنت بطل الجولة ${mine} ${mine===1?'مرة':'مرات'}`:'لم تحصل على لقب بطل الجولة بعد'}</b><div class="tiny">أعلى نقاط في الجولة بين كل المدربين = بطل الجولة</div></div></div></div>
      <div class="card">${rows? `<div class="scroll-x"><table class="tbl"><tr><th>الجولة</th><th>البطل</th><th>النقاط</th></tr>${rows}</table></div>` : '<div class="muted">لا جولات منتهية بعد</div>'}</div>`;
  },

  /* ======================= الأكثر انتقالاً ======================= */
  transfersTab(){
    const st=DB.state;
    const players=st.players.filter(p=>p.status!=='u');
    const tc=p=>MARKET.transferCounts(p.id);
    const trend=p=>{ const t=tc(p); const net=t.in-t.out;
      if(net>140) return '<span class="pill green">مرشح للارتفاع</span>';
      if(net<-90) return '<span class="pill red">مرشح للانخفاض</span>';
      return '<span class="pill">مستقر</span>'; };
    const row=(p,k)=>{ const t=tc(p); return `<tr onclick="VIEWS.openPlayer('${p.id}')" style="cursor:pointer">
      <td><div class="row">${UI.playerAvatar(p,28)}<div><b>${esc(p.name)}</b><div class="tiny">${DB.club(p.club).short} · ${POS_AR[p.pos]} · ${fmtM(p.price)}</div></div></div></td>
      <td class="num" style="color:${k==='in'?'var(--green-dk)':'var(--red)'}">${k==='in'?'+':'−'}${t[k].toLocaleString('ar')}</td>
      <td>${trend(p)}</td></tr>`; };
    const ins=[...players].sort((a,b)=>tc(b).in-tc(a).in).slice(0,12);
    const outs=[...players].sort((a,b)=>tc(b).out-tc(a).out).slice(0,12);
    return `<div class="tiny" style="margin-bottom:10px;color:var(--text3)">حركة الانتقالات في الجولة ${st.currentGW} — الأرقام تشمل كل مدربي اللعبة. الأسعار تتغير عند احتساب الجولة حسب صافي الدخول والخروج.</div>
    <div class="grid g2">
      <div><h3 style="color:var(--green-dk)">الأكثر دخولاً</h3><div class="scroll-x"><table class="tbl"><tr><th>اللاعب</th><th>دخول</th><th>السعر</th></tr>${ins.map(p=>row(p,'in')).join('')}</table></div></div>
      <div><h3 style="color:var(--red)">الأكثر خروجاً</h3><div class="scroll-x"><table class="tbl"><tr><th>اللاعب</th><th>خروج</th><th>السعر</th></tr>${outs.map(p=>row(p,'out')).join('')}</table></div></div>
    </div>`;
  },

  /* ======================= مقارنة اللاعبين ======================= */
  cmpOpen(pid){
    this.ui.cmp=this.ui.cmp||[];
    if(pid && !this.ui.cmp.includes(pid)){ if(this.ui.cmp.length>=3) this.ui.cmp.shift(); this.ui.cmp.push(pid); }
    UI.closeSheet(); APP.go('compare');
  },
  cmpRemove(i){ this.ui.cmp.splice(i,1); APP.render(); },
  cmpSearch(i,q){
    const box=document.getElementById('cmpRes'+i); if(!box) return;
    q=q.trim(); if(q.length<2){ box.innerHTML=''; return; }
    const st=DB.state; const cur=this.ui.cmp||[];
    const list=st.players.filter(p=>p.status!=='u' && !cur.includes(p.id) && (p.name.includes(q)||DB.club(p.club).name.includes(q))).slice(0,8);
    box.innerHTML=list.map(p=>`<div class="cmp-res" onclick="VIEWS.cmpPick(${i},'${p.id}')">${UI.playerAvatar(p,26)}<span><b>${esc(p.name)}</b><small>${DB.club(p.club).short} · ${POS_AR[p.pos]} · ${fmtM(p.price)}</small></span></div>`).join('') || '<div class="cmp-res muted">لا نتائج</div>';
  },
  cmpPick(i,pid){ this.ui.cmp=this.ui.cmp||[]; if(i<this.ui.cmp.length) this.ui.cmp[i]=pid; else this.ui.cmp.push(pid); APP.render(); },
  compare(){
    const st=DB.state; const ids=this.ui.cmp||[];
    const ps=ids.map(id=>DB.player(id)).filter(Boolean);
    const gp=p=>Object.keys(st.playerGW[p.id]||{}).length;
    const fin=RANKS.finishedGWs(st).slice(-4);
    const metrics=[
      ['السعر', p=>p.price, v=>fmtM(v), 'low'],
      ['مجموع النقاط', p=>DB.playerTotal(p.id), v=>v, 'high'],
      ['نقاط / مباراة', p=>gp(p)? DB.playerTotal(p.id)/gp(p):0, v=>v.toFixed(1), 'high'],
      ['الفورمة', p=>DB.playerForm(p.id), v=>v.toFixed(1), 'high'],
      ['نقاط / مليون', p=>DB.playerTotal(p.id)/p.price, v=>v.toFixed(2), 'high'],
      ['التملّك', p=>MARKET.ownership(p.id), v=>v+'%', 'high'],
      ['أهداف', p=>DB.playerStatSum(p.id,'g'), v=>v, 'high'],
      ['صناعة', p=>DB.playerStatSum(p.id,'a'), v=>v, 'high'],
      ['شباك نظيفة', p=>DB.playerStatSum(p.id,'cs'), v=>v, 'high'],
      ['بونص', p=>DB.playerStatSum(p.id,'bonus'), v=>v, 'high'],
      ['دقائق', p=>DB.playerStatSum(p.id,'min'), v=>v, 'high'],
      ['بطاقات صفراء', p=>DB.playerStatSum(p.id,'yc'), v=>v, 'low'],
      ['صعوبة القادم (3)', p=>FDR.avgNext(p.club,3), v=>v.toFixed(1), 'low'],
    ];
    const slot=(i)=>{ const p=ps[i];
      if(!p) return `<div class="cmp-slot empty"><div class="cmp-search">${UI.icon('search',16)}<input placeholder="ابحث عن لاعب" oninput="VIEWS.cmpSearch(${i},this.value)"></div><div id="cmpRes${i}" class="cmp-results"></div></div>`;
      return `<div class="cmp-slot"><button class="cmp-x" onclick="VIEWS.cmpRemove(${i})">×</button>
        <div onclick="VIEWS.openPlayer('${p.id}')" style="cursor:pointer">${UI.playerAvatar(p,56)}</div>
        <b>${esc(p.name)}</b><span class="tiny">${DB.club(p.club).short} · ${POS_AR[p.pos]}</span>${UI.statusPill(p)}</div>`; };
    const nSlots=Math.min(3, ps.length+1);
    const rows=ps.length? metrics.map(([l,fn,fmt,dir])=>{
      const vals=ps.map(fn); const best= dir==='high'? Math.max(...vals) : Math.min(...vals);
      const uniq=new Set(vals).size>1;
      return `<tr><th>${l}</th>${vals.map(v=>`<td class="num ${uniq&&v===best?'best':''}">${fmt(v)}</td>`).join('')}</tr>`; }).join('') : '';
    const fxRow=ps.length? `<tr><th>المباريات القادمة</th>${ps.map(p=>`<td><div class="fdr-line" style="justify-content:center">${FDR.next(p.club,3).map(x=>UI.fdrPill(x)).join('')}</div></td>`).join('')}</tr>`:'';
    const histRow=ps.length&&fin.length? `<tr><th>آخر الجولات</th>${ps.map(p=>`<td><div class="row" style="gap:4px;justify-content:center;flex-wrap:wrap">${fin.map(gw=>{ const r=DB.pgw(p.id,gw); const pts=r?r.pts:0; const cls=pts>=8?'good':pts>=4?'ok':pts>=1?'mid':'bad'; return `<span class="ptschip ${cls}" style="width:34px" title="الجولة ${gw}">${pts}</span>`; }).join('')}</div></td>`).join('')}</tr>`:'';
    return `<div class="row spread" style="margin-bottom:12px"><h2>مقارنة اللاعبين</h2>${ps.length? `<button class="btn ghost sm" onclick="VIEWS.ui.cmp=[];APP.render()">مسح</button>`:''}</div>
      <div class="cmp-slots n${nSlots}">${Array.from({length:nSlots},(_,i)=>slot(i)).join('')}</div>
      ${ps.length? `<div class="card" style="margin-top:12px"><div class="scroll-x"><table class="tbl cmp-tbl"><tr><th></th>${ps.map(p=>`<th>${esc(p.name.split(' ').slice(-1)[0])}</th>`).join('')}</tr>${rows}${fxRow}${histRow}</table></div>
        <div class="tiny" style="margin-top:8px;color:var(--text3)">الخانة الخضراء = الأفضل في هذا البند. تقدر تقارن حتى 3 لاعبين.</div></div>`
      : `<div class="card" style="margin-top:12px"><div class="muted">ابحث عن لاعب لبدء المقارنة، أو افتح أي لاعب واضغط «قارن».</div></div>`}`;
  },
});

/* ======================= المطوّر ======================= */
Object.assign(ICONS, {
  x:'M4 4l16 16M20 4 4 20',
  ig:'M7.5 3.5h9a4 4 0 0 1 4 4v9a4 4 0 0 1-4 4h-9a4 4 0 0 1-4-4v-9a4 4 0 0 1 4-4Zm4.5 5.2a3.3 3.3 0 1 0 0 6.6 3.3 3.3 0 0 0 0-6.6Zm5-1.4v.2',
});
const DEV = {
  name:'منصور الجمعة',
  role:'تصميم وتطوير اللعبة',
  links:[
    {ic:'x',  label:'X', handle:'@mansouraljumaah', url:'https://x.com/mansouraljumaah'},
    {ic:'ig', label:'Instagram', handle:'@mansouraljumah', url:'https://www.instagram.com/mansouraljumah'},
  ],
};
Object.assign(VIEWS, {
  devCard(compact){
    return `<div class="dev-card ${compact?'compact':''}" onclick="${compact?"APP.go('about')":''}">
      <div class="dev-ic">${UI.icon('spark',22)}</div>
      <div style="flex:1;min-width:0">
        <div class="dev-l">المطوّر</div>
        <div class="dev-n">${DEV.name}</div>
        <div class="dev-r">${DEV.role}</div>
      </div>
      <div class="dev-links">${DEV.links.map(l=>`<a href="${l.url}" target="_blank" rel="noopener" title="${l.label} ${l.handle}" onclick="event.stopPropagation()">${UI.icon(l.ic,18)}</a>`).join('')}</div>
    </div>`;
  },
  about(){
    return `<h2 style="margin-bottom:12px">عن اللعبة</h2>
      ${this.devCard(false)}
      <div class="card" style="margin-top:12px">
        <h3>تابع المطوّر</h3>
        ${DEV.links.map(l=>`<a class="link-row" href="${l.url}" target="_blank" rel="noopener" style="text-decoration:none;color:inherit">
          <span class="lr-lead">${UI.icon(l.ic,20)}<span><span class="lr-title">${l.label}</span><span class="lr-sub" style="direction:ltr;display:inline-block">${l.handle}</span></span></span>
          <span class="lr-arrow">${UI.icon('chev',16)}</span></a>`).join('')}
      </div>
      <div class="card" style="margin-top:12px">
        <h3>اللعبة</h3>
        <div class="muted" style="line-height:1.9">فانتازي دوري زين الممتاز — لعبة فانتازي كويتية على طراز FPL: كوّن فريقك من لاعبي الدوري، اختر الكابتن، فعّل الكروت، ونافس أصحابك على نقاط كل جولة بنتائج حقيقية.</div>
        <div class="tiny" style="margin-top:8px;color:var(--text3)">النسخة ${(document.querySelector('script[src*="app.js"]')?.src.match(/v=(\d+)/)||[])[1]||''}</div>
        <div style="margin-top:12px"><button class="btn ghost sm" onclick="APP.go('admin')">${UI.icon('gear',15)} ${ADMINAUTH.active()? 'لوحة الإدارة' : 'دخول المطوّر'}</button></div>
      </div>`;
  },
});
