/* لوحة الإدارة */
'use strict';

const ADMIN = {
  view(){
    if(!ADMINAUTH.active()) return ADMINAUTH.loginView();
    const sec=VIEWS.ui.adminSec;
    const menu=[['gws','الجولات والاحتساب'],['results','النتائج والإحصاءات'],['scoring','نظام النقاط'],
      ['rules','قواعد اللعبة'],['players','اللاعبون'],['clubs','الأندية'],
      ['users','المستخدمون'],['admins','المديرون'],['cloud','السحابة'],['data','البيانات']];
    return `<h2 style="margin-bottom:12px">لوحة الإدارة</h2>
    <div class="admin-grid">
      <div class="admin-menu">${menu.map(([id,l])=>`<button class="${sec===id?'active':''}" onclick="VIEWS.ui.adminSec='${id}';APP.render()">${l}</button>`).join('')}</div>
      <div>${this['sec_'+sec]()}</div>
    </div>`;
  },

  sec_admins(){ return ADMINAUTH.section(); },

  /* ---------- السحابة ---------- */
  sec_cloud(){
    const up = typeof CLOUD!=='undefined' && CLOUD.ready;
    const u  = up && CLOUD.user;
    const st = APP.cloudState;
    const stateAr = {ready:'متصل — حالة اللعبة منشورة', nogame:'متصل — لم تُنشر اللعبة بعد',
                     offline:'غير متصل', init:'جارٍ الاتصال…'}[st] || st;
    return `<div class="card"><h3>السحابة والمشتركون</h3>
      <div class="tiny" style="margin-bottom:12px">حالة اللعبة تُنشر مرة واحدة من هنا فتصل كل المشتركين تلقائياً.
      بلا نشر تبقى نتائجك على جهازك ولا تُحتسب نقاط أحد.</div>
      <table class="tbl">
        <tr><td>الاتصال</td><td><span class="pill ${st==='ready'?'green':(st==='offline'?'':'gold')}">${stateAr}</span></td></tr>
        <tr><td>حساب المدير</td><td style="direction:ltr;text-align:right">${u? esc(u.email) : '—'}</td></tr>
        <tr><td>صلاحية النشر</td><td>${up&&CLOUD.admin? '<span class="pill green">متاحة</span>' : '<span class="pill">غير متاحة</span>'}</td></tr>
        <tr><td>عدد المشتركين</td><td id="mgrCount">—</td></tr>
        <tr><td>قفل التشكيلات على الخادم</td><td id="lockState">—</td></tr>
      </table>
      <div class="tiny" style="margin-top:8px">القفل يُنشر مع اللعبة. قبل أول نشر يرفض الخادم كل التشكيلات —
      وهذا مقصود: لا أحد يلعب قبل أن تعتمد الجولة.</div>
      <div style="height:12px"></div>
      ${!u? `<div class="tiny" style="margin-bottom:10px">سجّل دخول حساب المدير في السحابة (نفس حساب الموقع الرئيسي) لتتمكن من النشر:</div>
        <div class="field"><label>البريد</label><input id="cl_email" type="email" style="direction:ltr"></div>
        <div class="field"><label>كلمة المرور</label><input id="cl_pass" type="password" style="direction:ltr"></div>
        <button class="btn" onclick="ADMIN.cloudLogin()">دخول السحابة</button>`
      : `<div class="row" style="gap:8px;flex-wrap:wrap">
          <button class="btn" onclick="ADMIN.doPublish()">نشر حالة اللعبة للمشتركين</button>
          <button class="btn sec" onclick="ADMIN.cloudLogout()">خروج من السحابة</button>
        </div>`}
    </div>
    <script>(async()=>{ if(typeof CLOUD!=='undefined' && CLOUD.ready){
      const n=await CLOUD.managerCount(); const el=document.getElementById('mgrCount');
      if(el) el.textContent = n==null? 'تعذّرت القراءة' : n+' مشتركاً';
      const lk=await CLOUD.readLock(); const le=document.getElementById('lockState');
      if(le){
        if(!lk) le.innerHTML='<span class="pill gold">لم يُنشر — التشكيلات مرفوضة</span>';
        else{
          const d=new Date(lk.deadlineISO || (lk.deadline&&lk.deadline.seconds*1000));
          const open = lk.open && Date.now() < d.getTime();
          le.innerHTML = '<span class="pill '+(open?'green':'')+'">الجولة '+lk.gw+' — '
            + (open? 'مفتوحة حتى ' : 'مقفلة منذ ')
            + d.toLocaleString('ar-KW',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})+'</span>';
        }
      }
    }})();<\/script>`;
  },

  async cloudLogin(){
    const r=await CLOUD.login(gv('cl_email'), gv('cl_pass'));
    UI.toast(r.ok? 'تم الدخول للسحابة' : r.err, !r.ok);
    APP.render();
  },
  async cloudLogout(){ await CLOUD.logout(); UI.toast('خرجت من السحابة'); APP.render(); },

  /* ---------- الجولات ---------- */
  sec_gws(){
    const st=DB.state;
    const pending=st.fixtures.filter(f=>f.gw===st.currentGW && f.status!=='F').length;
    return `<div class="card"><h3>إدارة الجولات</h3>
      <div class="tiny" style="margin-bottom:10px">اللعبة تعتمد على النتائج الحقيقية فقط: أدخل نتائج كل مباريات الجولة من «النتائج والإحصاءات»، وبعدها اضغط «احتساب وإغلاق» لتُحتسب نقاط الجميع وتفتح الجولة التالية.</div>
      <div class="row" style="gap:10px;flex-wrap:wrap;margin-bottom:14px;align-items:center">
        <button class="btn danger" ${pending?'disabled':''} onclick="ADMIN.finalizeConfirm()">احتساب وإغلاق الجولة ${st.currentGW}</button>
        <span class="pill ${pending?'gold':'green'}">${pending? `ناقص ${pending} نتيجة` : 'كل النتائج مدخلة — جاهزة للإغلاق'}</span>
      </div>
      <div class="scroll-x"><table class="tbl"><tr><th>جولة</th><th>الحالة</th><th>الموعد النهائي</th><th>متوسط</th><th></th></tr>
      ${st.gws.map(g=>`<tr><td class="num">ج${g.n}</td>
        <td>${g.status==='finished'?'<span class="pill green">منتهية</span>':g.status==='live'?'<span class="pill red">مباشر</span>':g.status==='next'?'<span class="pill gold">الحالية</span>':'<span class="pill">قادمة</span>'}</td>
        <td><input type="datetime-local" value="${g.deadline.slice(0,16)}" style="width:200px" onchange="ADMIN.setDeadline(${g.n},this.value)"></td>
        <td>${g.avg||'—'}</td><td></td></tr>`).join('')}</table></div>
    </div>`;
  },
  setDeadline(n,v){ DB.gw(n).deadline=new Date(v).toISOString(); DB.save(); UI.toast('عُدّل موعد الجولة '+n); },
  finalizeConfirm(){
    const gw=DB.state.currentGW;
    UI.modal(`<h3>احتساب الجولة ${gw}</h3><p class="muted">سيتم احتساب نقاط كل الفرق من النتائج الحقيقية المدخلة، وتحديث الترتيب والأسعار، وفتح الجولة ${gw+1}. لا يمكن التراجع.</p>
      <div class="row" style="gap:8px;margin-top:12px"><button class="btn danger" onclick="ADMIN.doFinalize()">احتساب وإغلاق</button>
      <button class="btn sec" onclick="UI.closeModal()">إلغاء</button></div>`);
  },
  async doFinalize(){
    const st=DB.state, gw=st.currentGW;
    const res=GWADMIN.finalize(gw);
    UI.closeModal();
    if(!res.ok){ UI.toast(res.err, true); return; }
    UI.toast(`احتُسبت الجولة ${gw} — تغيّر سعر ${res.changes} لاعباً`);

    // الاحتساب للمشتركين على الخادم: بدونه تبقى نقاطهم صفراً
    if(typeof CLOUD!=='undefined' && CLOUD.admin){
      UI.toast('جارٍ احتساب نقاط المشتركين ونشر الجولة…');
      const all = await CLOUD.finalizeForAll(st, gw, (team, g)=>TEAM.gwPoints(this.cloudTeam(team), g, st));
      const pub = await CLOUD.publishGame(st);
      if(all.ok && pub.ok) UI.toast(`نُشرت الجولة ${gw} واحتُسبت لـ${all.count} مشتركاً`);
      else UI.toast((all.ok?'':all.err+' · ') + (pub.ok?'':pub.err), true);
    } else if(typeof CLOUD!=='undefined' && CLOUD.ready){
      UI.toast('احتُسبت محلياً — سجّل دخول المدير في السحابة لنشرها للمشتركين', true);
    }
    APP.go('dashboard');
  },

  /* فريق قادم من مستند مشترك: نكمّل الحقول الناقصة حتى تعمل عليه دوال الاحتساب */
  cloudTeam(t){
    const st=DB.state;
    return Object.assign({ squad:[],xi:[],bench:[],cap:null,vice:null,bank:st.rules.budget,
      ft:st.rules.freeTransfers, usedChips:{}, activeChip:null, joinedGW:1,
      history:[], transfers:[], gwPicks:{}, pendingHits:0 }, t||{});
  },

  /* نشر يدوي لحالة اللعبة بلا احتساب */
  async doPublish(){
    if(typeof CLOUD==='undefined' || !CLOUD.ready){ UI.toast('السحابة غير متاحة', true); return; }
    if(!CLOUD.admin){ UI.toast('سجّل دخول المدير في السحابة أولاً', true); return; }
    UI.toast('جارٍ النشر…');
    const r=await CLOUD.publishGame(DB.state);
    UI.toast(r.ok? `نُشرت اللعبة (${r.rounds} جولة) — وصلت لكل المشتركين` : r.err, !r.ok);
    APP.render();
  },

  /* ---------- النتائج ---------- */
  sec_results(){
    const st=DB.state;
    const gw=VIEWS.ui.adminGw||st.currentGW;
    const fx=st.fixtures.filter(f=>f.gw===gw);
    if(VIEWS.ui.editFx) return this.fxEditor(VIEWS.ui.editFx);
    return `<div class="card"><h3 class="row spread" style="flex-wrap:wrap;gap:8px">نتائج وإحصاءات المباريات
        <button class="btn sm" onclick="MFSYNC.importRound(${gw})">${UI.icon('swap',14)} سحب الجولة ${gw} من موقع mfsoccer</button></h3>
      <div class="tiny" style="margin-bottom:8px">عدّل نتيجة أي مباراة وأهدافها ثم «حفظ وإعادة الاحتساب» — تُعاد إحصاءات اللاعبين ونقاطهم تلقائياً، ولو كانت الجولة محتسبة تُصحّح نقاط كل الفرق بأثر رجعي. ولمطابقة الجدول الرسمي: افتح أي مباراة وعدّل الفريقين والموعد وعلّم «لم تُلعب بعد».</div>
      <div class="tabs">${st.gws.slice(0,Math.max(3,st.currentGW)).map(g=>`<button class="${g.n===gw?'active':''}" onclick="VIEWS.ui.adminGw=${g.n};APP.render()">ج${g.n}</button>`).join('')}</div>
      ${fx.map(f=>`<div class="fx">
        <div class="team">${UI.crest(f.h)} ${DB.club(f.h).short}</div>
        <div class="score">${f.status!=='U'? f.hs+' - '+f.as:'—'}</div>
        <div class="team a">${UI.crest(f.a)} ${DB.club(f.a).short}</div>
        ${f.est?'<span class="pill gold">تقديرية</span>':''}
        <button class="btn sm sec" onclick="VIEWS.ui.editFx='${f.id}';APP.render()">تحرير</button>
      </div>`).join('')}
    </div>`;
  },
  fxEditor(fid){
    const st=DB.state;
    const f=st.fixtures.find(x=>x.id===fid);
    const squads=st.players.filter(p=>(p.club===f.h||p.club===f.a)&&p.status!=='u');
    const opts=sel=>squads.map(p=>`<option value="${p.id}" ${sel===p.name?'selected':''}>${esc(p.name)} (${DB.club(p.club).short})</option>`).join('');
    const clubOpts=sel=>st.clubs.map(c=>`<option value="${c.id}" ${sel===c.id?'selected':''}>${c.name}</option>`).join('');
    return `<div class="card"><h3>تحرير: ${DB.club(f.h).name} × ${DB.club(f.a).name} — ج${f.gw}</h3>
      <div class="tiny" style="margin-bottom:8px">عدّل الفريقين والموعد ليطابقوا الجدول الرسمي للدوري — الجدولة الافتراضية تقديرية إلى أن تُعتمد الجولات الحقيقية.</div>
      <div class="row" style="gap:10px;margin-bottom:8px;flex-wrap:wrap">
        <div class="field" style="flex:1;min-width:140px"><label>صاحب الأرض</label><select id="fx_h">${clubOpts(f.h)}</select></div>
        <div class="field" style="flex:1;min-width:140px"><label>الضيف</label><select id="fx_a">${clubOpts(f.a)}</select></div>
        <div class="field" style="flex:1;min-width:180px"><label>الموعد</label><input id="fx_date" type="datetime-local" value="${(f.date||'').slice(0,16)}"></div>
      </div>
      <div class="row" style="gap:10px;margin-bottom:12px">
        <div class="field" style="flex:1"><label>أهداف صاحب الأرض</label><input id="fx_hs" type="number" min="0" value="${f.hs??0}"></div>
        <div class="field" style="flex:1"><label>أهداف الضيف</label><input id="fx_as" type="number" min="0" value="${f.as??0}"></div>
        <label class="pill" style="cursor:pointer;align-self:center"><input type="checkbox" id="fx_upcoming" ${f.status==='U'?'checked':''} style="width:auto"> لم تُلعب بعد</label>
      </div>
      <h3 style="font-size:.9rem">التشكيلة والمشاركة (من موقع النتائج)</h3>
      <div class="tiny" style="margin-bottom:6px">اضغط اسم اللاعب للتبديل: رمادي = لم يلعب · أزرق = أساسي (60+ دقيقة) · أصفر = بديل شارك (أقل من 60). أي هداف أو مساهم غير محدد يُحتسب أساسياً تلقائياً.</div>
      ${[f.h,f.a].map(cid=>`<div style="margin-bottom:8px"><b class="tiny">${DB.club(cid).name}</b>
        <div class="lu-grid">${st.players.filter(p=>p.club===cid&&p.status!=='u').map(p=>{
          const s=((f.lineups||{})[cid]||{})[p.id]||'n';
          return `<span class="lu ${s}" data-pid="${p.id}" data-club="${cid}" onclick="ADMIN.cycleLu(this)">${esc(p.name)}</span>`;
        }).join('')}</div></div>`).join('')}
      <h3 style="font-size:.9rem;margin-top:12px">الأهداف</h3>
      <div id="goalRows">${(f.goals||[]).map((g,i)=>this.goalRow(f,g,i,opts)).join('')}</div>
      <button class="btn sm sec" style="margin:8px 0" onclick="ADMIN.addGoalRow('${fid}')">+ إضافة هدف</button>
      <h3 style="font-size:.9rem;margin-top:12px">الكروت (صفراء -1 / حمراء -3)</h3>
      <div id="cardRows">${(f.cards||[]).map((c,i)=>this.cardRow(c,i,opts)).join('')}</div>
      <button class="btn sm sec" style="margin:8px 0" onclick="ADMIN.addCardRow('${fid}')">+ إضافة كرت</button>
      <h3 style="font-size:.9rem;margin-top:12px">ركلات الجزاء (ضائعة / تصدي الحارس)</h3>
      <div id="penRows">${(f.pens||[]).map((p,i)=>this.penRow(p,i,opts)).join('')}</div>
      <button class="btn sm sec" style="margin:8px 0" onclick="ADMIN.addPenRow('${fid}')">+ إضافة ركلة جزاء</button>
      <h3 style="font-size:.9rem;margin-top:12px">البونص — أفضل ثلاثة بالمباراة</h3>
      ${[[3,'أفضل لاعب بالمباراة (+3)'],[2,'ثاني أفضل لاعب (+2)'],[1,'ثالث أفضل لاعب (+1)']].map(([bp,label])=>{
        const cur=(f.bonus||[]).find(b=>b.pts===bp);
        return `<div class="row" style="gap:8px;margin-bottom:6px;align-items:center;flex-wrap:wrap">
          <span class="tiny" style="width:160px;font-weight:700">${label}</span>
          <select class="bx_sel" data-pts="${bp}" style="width:230px"><option value="">—</option>${opts(cur?cur.name:null)}</select>
        </div>`;
      }).join('')}
      <div class="row" style="gap:8px;margin-top:10px">
        <button class="btn" onclick="ADMIN.saveFx('${fid}')">حفظ وإعادة الاحتساب</button>
        <button class="btn sec" onclick="VIEWS.ui.editFx=null;APP.render()">رجوع</button>
      </div></div>`;
  },
  goalRow(f,g,i,opts){
    return `<div class="row" style="gap:6px;margin-bottom:6px;flex-wrap:wrap" data-goal="${i}">
      <input type="number" placeholder="دقيقة" value="${g?g.min:''}" style="width:70px" class="g_min">
      <select class="g_scorer" style="width:180px"><option value="">— الهداف —</option>${opts(g?g.scorer:null)}</select>
      <select class="g_assist" style="width:180px"><option value="">بدون صناعة</option>${opts(g?g.assist:null)}</select>
      <label class="pill" style="cursor:pointer"><input type="checkbox" class="g_pen" ${g&&g.pen?'checked':''} style="width:auto"> جزاء</label>
      <button class="btn sm danger" onclick="this.closest('[data-goal]').remove()">✕</button>
    </div>`;
  },
  cycleLu(el){
    const next={n:'s', s:'b', b:'n'}[el.classList.contains('s')?'s':el.classList.contains('b')?'b':'n'];
    el.classList.remove('n','s','b'); el.classList.add(next);
  },
  cardRow(c,i,opts){
    return `<div class="row" style="gap:6px;margin-bottom:6px;flex-wrap:wrap" data-card="${i}">
      <select class="c_player" style="width:200px"><option value="">— اللاعب —</option>${opts(c?c.name:null)}</select>
      <select class="c_type" style="width:110px">
        <option value="y" ${c&&c.type==='r'?'':'selected'}>صفراء</option>
        <option value="r" ${c&&c.type==='r'?'selected':''}>حمراء</option></select>
      <button class="btn sm danger" onclick="this.closest('[data-card]').remove()">✕</button>
    </div>`;
  },
  penRow(p,i,opts){
    return `<div class="row" style="gap:6px;margin-bottom:6px;flex-wrap:wrap" data-pen="${i}">
      <select class="p_player" style="width:200px"><option value="">— اللاعب —</option>${opts(p?p.name:null)}</select>
      <select class="p_type" style="width:150px">
        <option value="miss" ${p&&p.type==='save'?'':'selected'}>أهدر الركلة</option>
        <option value="save" ${p&&p.type==='save'?'selected':''}>تصدى لها (حارس)</option></select>
      <button class="btn sm danger" onclick="this.closest('[data-pen]').remove()">✕</button>
    </div>`;
  },
  fxOpts(fid){
    const st=DB.state;
    const f=st.fixtures.find(x=>x.id===fid);
    const squads=st.players.filter(p=>(p.club===f.h||p.club===f.a)&&p.status!=='u');
    return sel=>squads.map(p=>`<option value="${p.id}" ${sel===p.name?'selected':''}>${esc(p.name)} (${DB.club(p.club).short})</option>`).join('');
  },
  addCardRow(fid){ document.getElementById('cardRows').insertAdjacentHTML('beforeend', this.cardRow(null,Date.now(),this.fxOpts(fid))); },
  addPenRow(fid){ document.getElementById('penRows').insertAdjacentHTML('beforeend', this.penRow(null,Date.now(),this.fxOpts(fid))); },
  addGoalRow(fid){
    const st=DB.state;
    const f=st.fixtures.find(x=>x.id===fid);
    const squads=st.players.filter(p=>(p.club===f.h||p.club===f.a)&&p.status!=='u');
    const opts=sel=>squads.map(p=>`<option value="${p.id}">${esc(p.name)} (${DB.club(p.club).short})</option>`).join('');
    document.getElementById('goalRows').insertAdjacentHTML('beforeend', this.goalRow(f,null,Date.now(),opts));
  },
  saveFx(fid){
    const st=DB.state;
    const f=st.fixtures.find(x=>x.id===fid);
    // مسح إحصاءات النسخة القديمة قبل أي تعديل
    if(f.stats){ for(const clubId in f.stats){ for(const pid in f.stats[clubId]){ if(st.playerGW[pid]) delete st.playerGW[pid][f.gw]; } } }
    f.stats=null;
    f.h=gv('fx_h')||f.h; f.a=gv('fx_a')||f.a;
    if(gv('fx_date')) f.date=gv('fx_date');
    f.venue=DB.club(f.h).stadium;
    const upcoming=document.getElementById('fx_upcoming');
    if(upcoming && upcoming.checked){
      f.hs=null; f.as=null; f.goals=[]; f.cards=[]; f.pens=[]; f.bonus=[]; f.lineups=null; f.subs=[]; f.status='U'; f.est=false;
      DB.save(); VIEWS.ui.editFx=null;
      UI.toast('حُفظت المباراة كمباراة قادمة'); APP.render(); return;
    }
    f.hs=+gv('fx_hs'); f.as=+gv('fx_as'); f.status='F'; f.est=false;
    f.goals=[];
    document.querySelectorAll('#goalRows [data-goal]').forEach(row=>{
      const min=+row.querySelector('.g_min').value;
      const scorerId=row.querySelector('.g_scorer').value;
      const assistId=row.querySelector('.g_assist').value;
      if(!scorerId||!min) return;
      const sp=DB.player(scorerId);
      f.goals.push({min, scorer:sp.name, club:sp.club, assist: assistId? DB.player(assistId).name:null,
        pen:row.querySelector('.g_pen').checked});
    });
    f.goals.sort((a,b)=>a.min-b.min);
    f.lineups={};
    document.querySelectorAll('.lu[data-pid]').forEach(el=>{
      const stt=el.classList.contains('s')?'s':el.classList.contains('b')?'b':null;
      if(!stt) return;
      const cid=el.dataset.club;
      f.lineups[cid]=f.lineups[cid]||{};
      f.lineups[cid][el.dataset.pid]=stt;
    });
    f.cards=[];
    document.querySelectorAll('#cardRows [data-card]').forEach(row=>{
      const id=row.querySelector('.c_player').value; if(!id) return;
      const p=DB.player(id);
      f.cards.push({name:p.name, club:p.club, type:row.querySelector('.c_type').value});
    });
    f.pens=[];
    document.querySelectorAll('#penRows [data-pen]').forEach(row=>{
      const id=row.querySelector('.p_player').value; if(!id) return;
      const p=DB.player(id);
      f.pens.push({name:p.name, club:p.club, type:row.querySelector('.p_type').value});
    });
    f.bonus=[];
    document.querySelectorAll('.bx_sel').forEach(sel=>{
      const id=sel.value; if(!id) return;
      const p=DB.player(id);
      f.bonus.push({name:p.name, club:p.club, pts:+sel.dataset.pts});
    });
    // مسح إحصاءات المباراة القديمة من playerGW ثم إعادة التوليد
    if(f.stats){ for(const clubId in f.stats){ for(const pid in f.stats[clubId]){ if(st.playerGW[pid]) delete st.playerGW[pid][f.gw]; } } }
    f.stats=null;
    genMatchStats(st,f);
    finalizeGWStats(st,f.gw);
    // لو الجولة محتسبة: تصحيح نقاط الفرق بأثر رجعي
    const g=DB.gw(f.gw);
    if(g.status==='finished'){
      for(const uid in st.teams){
        const team=st.teams[uid];
        const h=(team.history||[]).find(x=>x.gw===f.gw);
        if(!h) continue;
        const res=TEAM.gwPoints(team,f.gw,st);
        h.pts=res.total; h.benchPts=res.benchPts;
        NOTIF.push(uid,'points',`صُحّحت نتيجة مباراة بالجولة ${f.gw} — نقاطك الآن ${res.total}`);
      }
      RANKS.recomputeGWRanks(st, f.gw);   // الترتيب بعد اكتمال نقاط الجميع
    }
    DB.save(); VIEWS.ui.editFx=null;
    UI.toast('حُفظت النتيجة وأُعيد الاحتساب '); APP.render();
  },

  /* ---------- نظام النقاط ---------- */
  sec_scoring(){
    const st=DB.state;
    return `<div class="card"><h3>نظام احتساب النقاط</h3>
      <div class="tiny" style="margin-bottom:10px">عدّل قيمة أي بند — يُطبّق على الجولات القادمة فوراً (ولإعادة احتساب جولة سابقة، عدّل أي مباراة فيها من قسم النتائج).</div>
      <div class="grid g2">
      ${Object.entries(st.scoring).map(([k,v])=>`
        <div class="row spread" style="border:1px solid var(--line);border-radius:9px;padding:8px 12px">
          <span style="font-size:.85rem">${esc(v.label)}</span>
          <input type="number" value="${v.val}" style="width:70px;text-align:center" onchange="DB.state.scoring['${k}'].val=+this.value;DB.save();UI.toast('حُفظ')"></div>`).join('')}
      </div></div>`;
  },

  /* ---------- القواعد ---------- */
  sec_rules(){
    const R=DB.state.rules;
    const num=(path,label,val)=>`<div class="field"><label>${label}</label>
      <input type="number" step="0.1" value="${val}" onchange="ADMIN.setRule('${path}',+this.value)"></div>`;
    return `<div class="card"><h3>قواعد اللعبة</h3>
      <div class="grid g3">
        ${num('budget','الميزانية (مليون)',R.budget)}
        ${num('maxPerClub','أقصى عدد من نفس النادي',R.maxPerClub)}
        ${num('freeTransfers','انتقالات مجانية/جولة',R.freeTransfers)}
        ${num('maxSavedTransfers','أقصى انتقالات مدّخرة',R.maxSavedTransfers)}
        ${num('transferCost','خصم الانتقال الإضافي',R.transferCost)}
        ${num('priceRise','مقدار ارتفاع السعر',R.priceRise)}
      </div>
      <h3 style="margin-top:14px">الكروت</h3>
      ${Object.entries(R.chips).map(([k,c])=>`
        <div class="row spread" style="border:1px solid var(--line);border-radius:9px;padding:8px 12px;margin-bottom:6px;flex-wrap:wrap;gap:6px">
          <div><b>${esc(c.label)}</b> <span class="tiny">${esc(c.desc)}</span></div>
          <div class="row" style="gap:8px">
            <label class="tiny">مرات الاستخدام <input type="number" value="${c.uses}" style="width:60px" onchange="DB.state.rules.chips['${k}'].uses=+this.value;DB.save()"></label>
            <label class="pill" style="cursor:pointer"><input type="checkbox" ${c.enabled?'checked':''} style="width:auto" onchange="DB.state.rules.chips['${k}'].enabled=this.checked;DB.save();APP.render()"> مفعّل</label>
          </div></div>`).join('')}
    </div>`;
  },
  setRule(path,val){ DB.state.rules[path]=val; DB.save(); UI.toast('حُفظ'); },

  /* ---------- اللاعبون ---------- */
  sec_players(){
    const st=DB.state; const f=VIEWS.ui.filters;
    let list=st.players.filter(p=>p.status!=='u');
    if(f.club) list=list.filter(p=>p.club===f.club);
    if(f.search) list=list.filter(p=>p.name.includes(f.search));
    return `<div class="card"><h3>إدارة اللاعبين (${list.length})</h3>
      <div class="row" style="gap:6px;margin-bottom:10px;flex-wrap:wrap">
        <select style="width:auto" onchange="VIEWS.ui.filters.club=this.value;APP.render()">
          <option value="">كل الأندية</option>${st.clubs.map(c=>`<option value="${c.id}" ${f.club===c.id?'selected':''}>${c.name}</option>`).join('')}</select>
        <input style="width:150px" placeholder="بحث" value="${esc(f.search)}" onchange="VIEWS.ui.filters.search=this.value;APP.render()">
        <button class="btn sm" onclick="ADMIN.playerModal()">+ لاعب جديد</button>
      </div>
      <div class="scroll-x"><table class="tbl"><tr><th>اللاعب</th><th>مركز</th><th>سعر</th><th>حالة</th><th>نقاط</th><th></th></tr>
      ${list.slice(0,80).map(p=>`<tr>
        <td><div class="row">${UI.playerAvatar(p,26)} <div><b>${esc(p.name)}</b><div class="tiny">${DB.club(p.club).short}</div></div></div></td>
        <td><select style="width:auto;padding:4px" onchange="DB.player('${p.id}').pos=this.value;DB.save()">${['G','D','M','F'].map(x=>`<option value="${x}" ${p.pos===x?'selected':''}>${POS_AR[x]}</option>`).join('')}</select></td>
        <td><input type="number" step="0.1" value="${p.price}" style="width:70px;padding:4px" onchange="DB.player('${p.id}').price=+this.value;DB.save()"></td>
        <td><select style="width:auto;padding:4px" onchange="DB.player('${p.id}').status=this.value;DB.save();if(this.value!=='a')ADMIN.injuryNotify('${p.id}')">
          <option value="a" ${p.status==='a'?'selected':''}>متاح</option><option value="i" ${p.status==='i'?'selected':''}>مصاب</option>
          <option value="s" ${p.status==='s'?'selected':''}>موقوف</option><option value="d" ${p.status==='d'?'selected':''}>مشكوك</option></select></td>
        <td class="num">${DB.playerTotal(p.id)}</td>
        <td><div class="row" style="gap:4px">
          <button class="btn sm sec" onclick="ADMIN.playerModal('${p.id}')"></button>
          <button class="btn sm sec" title="تعديل نقاط جولة يدوياً" onclick="ADMIN.pointsFix('${p.id}')"></button>
        </div></td></tr>`).join('')}
      </table></div></div>`;
  },
  injuryNotify(pid){
    const p=DB.player(pid); const st=DB.state;
    const label=p.status==='i'?'مصاب':p.status==='s'?'موقوف':'مشكوك بمشاركته';
    for(const uid in st.teams) if(st.teams[uid].squad.includes(pid))
      NOTIF.push(uid,'injury',`${p.name} ${label} — فكّر ببديل قبل إغلاق الجولة`);
    DB.save();
  },
  playerModal(pid){
    const p=pid? DB.player(pid):null;
    const st=DB.state;
    UI.modal(`<h3>${p?'تعديل لاعب':'لاعب جديد'}</h3>
      <div class="field"><label>الاسم</label><input id="pl_name" value="${p?esc(p.name):''}"></div>
      <div class="row" style="gap:8px">
        <div class="field" style="flex:1"><label>النادي</label><select id="pl_club">${st.clubs.map(c=>`<option value="${c.id}" ${p&&p.club===c.id?'selected':''}>${c.name}</option>`).join('')}</select></div>
        <div class="field" style="flex:1"><label>المركز</label><select id="pl_pos">${['G','D','M','F'].map(x=>`<option value="${x}" ${p&&p.pos===x?'selected':''}>${POS_AR[x]}</option>`).join('')}</select></div>
      </div>
      <div class="row" style="gap:8px">
        <div class="field" style="flex:1"><label>السعر</label><input id="pl_price" type="number" step="0.1" value="${p?p.price:5.0}"></div>
        <div class="field" style="flex:1"><label>رقم القميص</label><input id="pl_shirt" type="number" value="${p?p.shirt:''}"></div>
      </div>
      <div class="field"><label>رابط الصورة (اختياري)</label><input id="pl_photo" value="${p?esc(p.photo):''}" placeholder="https://..."></div>
      <div class="field"><label>ملاحظة/خبر (يظهر للمستخدمين)</label><input id="pl_news" value="${p?esc(p.news):''}" placeholder="مثال: غائب حتى الجولة 6"></div>
      <div class="row" style="gap:8px">
        <button class="btn" onclick="ADMIN.savePlayer('${pid||''}')">حفظ</button>
        ${p?`<button class="btn danger" onclick="ADMIN.removePlayer('${pid}')">حذف من اللعبة</button>`:''}
      </div>`);
  },
  savePlayer(pid){
    const st=DB.state;
    const data={name:gv('pl_name'),club:gv('pl_club'),pos:gv('pl_pos'),price:+gv('pl_price')||5,shirt:+gv('pl_shirt')||0,photo:gv('pl_photo'),news:gv('pl_news')};
    if(!data.name){UI.toast('الاسم مطلوب',true);return;}
    if(pid){ Object.assign(DB.player(pid),data); }
    else st.players.push({id:'p'+(st.players.length+1)+'x', ...data, startPrice:data.price, status:'a'});
    DB.save(); UI.closeModal(); UI.toast('حُفظ '); APP.render();
  },
  removePlayer(pid){
    DB.player(pid).status='u'; DB.save(); UI.closeModal(); UI.toast('حُذف من اللعبة'); APP.render();
  },
  pointsFix(pid){
    const p=DB.player(pid);
    const rows=DB.state.playerGW[pid]||{};
    const gws=Object.keys(rows).map(Number).sort((a,b)=>a-b);
    UI.modal(`<h3>تصحيح نقاط ${esc(p.name)} يدوياً</h3>
      ${gws.length? gws.map(g=>`<div class="row spread" style="margin-bottom:6px">
        <span>الجولة ${g}</span>
        <input type="number" value="${rows[g].pts}" style="width:80px" onchange="ADMIN.applyPointsFix('${pid}',${g},+this.value)"></div>`).join('')
      : '<div class="muted">لا توجد جولات محتسبة لهذا اللاعب.</div>'}
      <div class="tiny" style="margin-top:8px">التعديل يصحّح تلقائياً نقاط كل الفرق التي تملكه في تلك الجولة.</div>`);
  },
  applyPointsFix(pid,gw,val){
    const st=DB.state;
    st.playerGW[pid][gw].pts=val;
    const g=DB.gw(gw);
    if(g.status==='finished'){
      for(const uid in st.teams){
        const team=st.teams[uid];
        const h=(team.history||[]).find(x=>x.gw===gw);
        if(!h) continue;
        const res=TEAM.gwPoints(team,gw,st);
        h.pts=res.total; h.benchPts=res.benchPts;
      }
    }
    DB.save(); UI.toast('صُحّح ');
  },

  /* ---------- الأندية ---------- */
  sec_clubs(){
    const st=DB.state;
    return `<div class="card"><h3>الأندية</h3>
      <div class="scroll-x"><table class="tbl"><tr><th>النادي</th><th>الاسم</th><th>القوة (للصعوبة)</th><th>الملعب</th><th>اللون</th></tr>
      ${st.clubs.map(c=>`<tr>
        <td>${UI.crest(c.id,'lg')}</td>
        <td><input value="${esc(c.name)}" style="width:120px;padding:5px" onchange="DB.club('${c.id}').name=this.value;DB.save()"></td>
        <td><input type="number" step="0.1" min="1" max="5" value="${c.strength}" style="width:70px;padding:5px" onchange="DB.club('${c.id}').strength=+this.value;DB.save()"></td>
        <td><input value="${esc(c.stadium)}" style="width:170px;padding:5px" onchange="DB.club('${c.id}').stadium=this.value;DB.save()"></td>
        <td><input type="color" value="${c.color}" style="width:44px;padding:2px;height:32px" onchange="DB.club('${c.id}').color=this.value;DB.save()"></td>
      </tr>`).join('')}</table></div>
      <div class="tiny" style="margin-top:8px">القوة تتحكم بتقييم صعوبة المباريات وبالمحاكاة. لإضافة نادٍ جديد (موسم قادم) أضف صفاً في data.js أو اطلبها كتحديث.</div>
    </div>`;
  },

  /* ---------- المستخدمون ---------- */
  sec_users(){
    const st=DB.state;
    return `<div class="card"><h3>المستخدمون (${st.users.length})</h3>
      <div class="scroll-x"><table class="tbl"><tr><th>المستخدم</th><th>البريد</th><th>الفريق</th><th>نقاط</th><th>صلاحية</th><th></th></tr>
      ${st.users.map(u=>{
        const team=st.teams[u.id];
        return `<tr><td><b>${esc(u.username)}</b></td><td class="tiny">${esc(u.email)} ${u.verified?'':''}</td>
        <td>${esc(u.teamName)}</td><td class="num">${team?TEAM.totalPoints(team):0}</td>
        <td class="tiny">${u.admin?'<span class="pill gold">مدير (جلسة نشطة)</span>':'—'}</td>
        <td>${u.id!==DB.me().id? `<button class="btn sm danger" onclick="ADMIN.delUser('${u.id}')">حذف</button>`:''}</td></tr>`;}).join('')}
      </table></div></div>`;
  },
  delUser(id){
    const st=DB.state;
    st.users=st.users.filter(u=>u.id!==id);
    delete st.teams[id]; delete st.notifications[id];
    st.leagues.forEach(l=>{ l.members=l.members.filter(m=>m!==id); });
    DB.save(); UI.toast('حُذف المستخدم'); APP.render();
  },

  /* ---------- البيانات ---------- */
  sec_data(){
    return `<div class="card"><h3>البيانات</h3>
      <div class="row" style="gap:8px;flex-wrap:wrap">
        <button class="btn sec" onclick="ADMIN.exportData()">تصدير نسخة احتياطية (JSON)</button>
        <button class="btn sec" onclick="document.getElementById('importFile').click()">استيراد نسخة</button>
        <input type="file" id="importFile" accept=".json" style="display:none" onchange="ADMIN.importData(this)">
        <button class="btn danger" onclick="ADMIN.resetConfirm()">إعادة ضبط اللعبة بالكامل</button>
      </div>
      <div class="tiny" style="margin-top:10px">كل البيانات محفوظة محلياً في متصفحك (localStorage). التصدير ينشئ ملفاً يمكن استيراده على جهاز آخر.</div>
    </div>`;
  },
  exportData(){
    const blob=new Blob([JSON.stringify(DB.state)],{type:'application/json'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='kuwait-fantasy-backup.json';
    a.click();
  },
  importData(input){
    const file=input.files[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=()=>{
      try{ const data=JSON.parse(reader.result);
        if(data.ver!==1) throw new Error('نسخة غير متوافقة');
        DB.state=data; DB.save(); UI.toast('استُوردت البيانات '); APP.render();
      }catch(e){ UI.toast('ملف غير صالح: '+e.message,true); }
    };
    reader.readAsText(file);
  },
  resetConfirm(){
    UI.modal(`<h3>إعادة ضبط كاملة</h3><p class="muted">سيُحذف كل شيء: الحسابات، الفرق، الدوريات، التعديلات — وتعود اللعبة لحالتها الأولى (الجولتان 1-2 الحقيقيتان محفوظتان في البذرة). متأكد؟</p>
      <div class="row" style="gap:8px;margin-top:12px"><button class="btn danger" onclick="DB.reset();UI.closeModal();APP.go('dashboard')">نعم، إعادة ضبط</button>
      <button class="btn sec" onclick="UI.closeModal()">إلغاء</button></div>`);
  },
};
