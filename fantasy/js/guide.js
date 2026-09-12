/* =========================================================
   عن اللعبة والقوانين (#guide) + صفحة المطوّر والاقتراحات (#about)
   يُحمَّل بعد extras.js. القيم تُقرأ من قواعد اللعبة الحالية
   (DB.state.rules / scoring) فلا تتعارض مع تعديلات الإدارة.
   ========================================================= */
'use strict';

/* ---------- الاقتراحات: تُحفظ في fantasy/{season}/feedback على Firestore ---------- */
const FEEDBACK = {
  TYPES: [['idea','اقتراح'],['bug','مشكلة أو خطأ'],['data','خطأ في بيانات لاعب/مباراة'],['other','أخرى']],
  PENDING: 'kwf_feedback_pending',

  async send(type, text){
    text=String(text||'').trim(); if(text.length<4) return {ok:false, err:'اكتب اقتراحك أولاً'};
    if(text.length>1500) return {ok:false, err:'الرسالة طويلة — 1500 حرف كحد أقصى'};
    const m=DB.me();
    const doc={ type, text, username:(m&&m.username)||'', teamName:(m&&m.teamName)||'',
      uid:(typeof CLOUD!=='undefined' && CLOUD.user)? CLOUD.user.uid : '',
      gw:DB.state.currentGW, ver:appVersion(), ua:navigator.userAgent.slice(0,120),
      created:new Date().toISOString(), status:'new', replies:[], updated:new Date().toISOString(), userUnread:0 };
    if(typeof CLOUD!=='undefined' && CLOUD.ready){
      const r=await CLOUD.race(CLOUD.root().collection('feedback').add(doc), 8000);
      if(r.ok) return {ok:true};
    }
    // بلا اتصال أو صلاحية: نحفظها على الجهاز ونعرض التواصل المباشر
    try{ const p=JSON.parse(localStorage.getItem(this.PENDING)||'[]'); p.push(doc); localStorage.setItem(this.PENDING, JSON.stringify(p.slice(-20))); }catch(e){}
    return {ok:false, err:'تعذّر الإرسال للخادم الآن — حُفظ اقتراحك على جهازك، أو أرسله للمطوّر مباشرة من الروابط', pending:true};
  },
  /* إعادة إرسال ما حُفظ محلياً عند توفر الاتصال */
  async flush(){
    if(typeof CLOUD==='undefined' || !CLOUD.ready || !CLOUD.user) return;
    let p=[]; try{ p=JSON.parse(localStorage.getItem(this.PENDING)||'[]'); }catch(e){}
    if(!p.length) return;
    const rest=[];
    for(const doc of p){ const r=await CLOUD.race(CLOUD.root().collection('feedback').add(doc), 8000); if(!r.ok) rest.push(doc); }
    try{ localStorage.setItem(this.PENDING, JSON.stringify(rest)); }catch(e){}
    if(rest.length<p.length) UI.toast(`أُرسل ${p.length-rest.length} اقتراح كان محفوظاً على جهازك`);
  },
  async list(){
    if(typeof CLOUD==='undefined' || !CLOUD.ready) return null;
    try{
      const q=await CLOUD.root().collection('feedback').orderBy('created','desc').limit(200).get();
      const out=[]; q.forEach(d=>out.push({id:d.id, ...d.data()})); return out;
    }catch(e){ return null; }
  },
  async setStatus(id, status){
    try{ await CLOUD.root().collection('feedback').doc(id).set({status}, {merge:true}); return true; }catch(e){ return false; }
  },

  /* ---------- الدعم الفني: محادثة على كل رسالة ----------
     الردود تُخزَّن داخل مستند الرسالة نفسه: replies:[{by:'admin'|'user', name, text, at}].
     المشترك يقرأ رسائله وحده (uid) ويضيف ردّاً واحداً في كل كتابة؛ المدير يرد ويغيّر الحالة. */
  col(){ return CLOUD.root().collection('feedback'); },

  /* رسائل المشترك الحالي (بلا orderBy حتى لا نحتاج فهرساً مركّباً) — مع نسخة محلية تُعرض فوراً */
  MINE_KEY:'kwf_fb_mine',
  cachedMine(){
    try{ const c=JSON.parse(localStorage.getItem(this.MINE_KEY)||'null'); if(c && CLOUD.user && c.uid===CLOUD.user.uid) return c.list||[]; }catch(e){}
    return null;
  },
  async mine(){
    if(typeof CLOUD==='undefined' || !CLOUD.ready || !CLOUD.user) return null;
    try{
      const q=await this.col().where('uid','==',CLOUD.user.uid).limit(50).get();
      const out=[]; q.forEach(d=>out.push({id:d.id, ...d.data()}));
      out.sort((a,b)=>String(b.updated||b.created).localeCompare(String(a.updated||a.created)));
      try{ localStorage.setItem(this.MINE_KEY, JSON.stringify({uid:CLOUD.user.uid, at:Date.now(), list:out})); }catch(e){}
      return out;
    }catch(e){ return null; }
  },

  /* رد المدير: يُضاف للمحادثة ويُعلَّم للمشترك كغير مقروء */
  async adminReply(id, text){
    text=String(text||'').trim(); if(text.length<1) return {ok:false, err:'اكتب الرد أولاً'};
    if(text.length>1500) return {ok:false, err:'الرد طويل — 1500 حرف كحد أقصى'};
    if(typeof CLOUD==='undefined' || !CLOUD.admin) return {ok:false, err:'الرد للمدير فقط'};
    try{
      const ref=this.col().doc(id); const s=await ref.get(); if(!s.exists) return {ok:false, err:'الرسالة غير موجودة'};
      const v=s.data(); const replies=(v.replies||[]).slice();
      const m=DB.me();
      replies.push({by:'admin', name:'الدعم الفني'+(m&&m.username?' · '+m.username:''), text, at:new Date().toISOString()});
      const patch={replies, updated:new Date().toISOString(), userUnread:(+v.userUnread||0)+1};
      if((v.status||'new')==='new') patch.status='seen';
      const r=await CLOUD.race(ref.set(patch,{merge:true}), 8000);
      return r.ok? {ok:true} : {ok:false, err:'تعذّر حفظ الرد'};
    }catch(e){ return {ok:false, err:CLOUD.errAr(e)}; }
  },

  /* رد المشترك على محادثته: يرجع الحالة «جديد» فيتنبّه فريق العمل */
  async userReply(id, text){
    text=String(text||'').trim(); if(text.length<1) return {ok:false, err:'اكتب ردك أولاً'};
    if(text.length>1500) return {ok:false, err:'الرد طويل — 1500 حرف كحد أقصى'};
    if(typeof CLOUD==='undefined' || !CLOUD.user) return {ok:false, err:'سجّل الدخول أولاً'};
    try{
      const ref=this.col().doc(id); const s=await ref.get(); if(!s.exists) return {ok:false, err:'الرسالة غير موجودة'};
      const v=s.data(); const replies=(v.replies||[]).slice();
      const m=DB.me();
      replies.push({by:'user', name:(m&&m.username)||'مشترك', text, at:new Date().toISOString()});
      const r=await CLOUD.race(ref.update({replies, updated:new Date().toISOString(), status:'new'}), 8000);
      if(!r.ok) return {ok:false, err: r.timeout? 'الاتصال بطيء' : 'تعذّر الإرسال — قد تكون قواعد الخادم لم تُحدَّث بعد'};
      return {ok:true};
    }catch(e){ return {ok:false, err:CLOUD.errAr(e)}; }
  },

  /* المشترك فتح المحادثة: صفّر غير المقروء */
  async markRead(id){
    try{ await this.col().doc(id).update({userUnread:0}); }catch(e){}
  },

  /* تنبيه المشترك بردود الدعم (عند التحميل، وكل 5 دقائق، وعند فتح الرئيسية/الدعم) */
  unreadMine: 0,
  _pollAt: 0,
  countUnread(list){ return (list||[]).reduce((s,f)=>s+(+f.userUnread||0),0); },
  async pollMine(force){
    if(typeof CLOUD==='undefined' || !CLOUD.ready || !CLOUD.user) return;
    if(!force && Date.now()-this._pollAt < 60000) return;
    this._pollAt=Date.now();
    const list=await this.mine(); if(!list) return;
    const n=this.countUnread(list);
    const changed=n!==this.unreadMine; this.unreadMine=n;
    const m=DB.me();
    if(n>0 && m){
      const latest=list.find(f=>(+f.userUnread||0)>0);
      const key='fbr_'+latest.id+'_'+(latest.updated||'');
      DB.state.notifications[m.id]=DB.state.notifications[m.id]||[];
      if(!DB.state.notifications[m.id].some(x=>x.type===key)){
        NOTIF.push(m.id, key, 'رد عليك الدعم الفني — افتح «الدعم والاقتراحات»');
        try{ localStorage.setItem(DB.KEY, JSON.stringify(DB.state)); }catch(e){}
        if(typeof APP!=='undefined'){ APP.renderTopbar(); if(APP.route!=='about') UI.toast('رد عليك الدعم الفني — افتح «الدعم والاقتراحات» من الرئيسية'); }
      }
    }
    if(changed && typeof APP!=='undefined' && ['about','dashboard','guide'].includes(APP.route)) APP.render();
  },
  /* شارة «رد جديد» تُوضع بجانب اسم الدعم في القوائم */
  badge(){
    const n=this.unreadMine || this.countUnread(this.cachedMine()||[]);
    return n>0? `<span class="pill red" style="padding:0 7px;margin-inline-start:6px">${n}</span>` : '';
  },

  /* عرض محادثة واحدة (مشترك أو مدير) */
  thread(f, who){
    const T=Object.fromEntries(this.TYPES);
    const bubble=(by,name,text,at)=>`<div class="fb-msg ${by==='admin'?'a':'u'}"><div class="fb-who">${esc(name||(by==='admin'?'الدعم الفني':'أنت'))} · ${UI.fmtDateShort(at)}</div><div class="fb-txt">${esc(text)}</div></div>`;
    const msgs=[bubble('user', who==='admin'? (f.username||'ضيف') : 'أنت', f.text, f.created)]
      .concat((f.replies||[]).map(r=>bubble(r.by, who==='admin'&&r.by==='user'? (r.name||f.username) : (r.by==='user'?'أنت':r.name), r.text, r.at)));
    const st={new:'جديد',seen:'مقروء',done:'منفّذ',rejected:'مرفوض'}[f.status||'new']||f.status;
    const box=who==='admin'
      ? `<div class="fb-reply"><textarea id="fbr_${f.id}" rows="2" maxlength="1500" placeholder="اكتب ردّك للمشترك…"></textarea><button class="btn sm" onclick="FEEDBACK.doAdminReply('${f.id}',this)">رد</button></div>`
      : (f.status==='done'||f.status==='rejected'
          ? '<div class="tiny" style="margin-top:6px">أُغلقت هذه المحادثة. أرسل رسالة جديدة إن احتجت.</div>'
          : `<div class="fb-reply"><textarea id="fbr_${f.id}" rows="2" maxlength="1500" placeholder="اكتب ردّك…"></textarea><button class="btn sm" onclick="FEEDBACK.doUserReply('${f.id}',this)">إرسال</button></div>`);
    return `<div class="fb-thread" id="fbt_${f.id}">
      <div class="row spread" style="margin-bottom:6px"><span class="pill ${f.type==='bug'||f.type==='data'?'red':'blue'}">${T[f.type]||f.type}</span><span class="tiny">${st}${(+f.userUnread||0)>0&&who!=='admin'?` · <b style="color:var(--red)">رد جديد</b>`:''}</span></div>
      <div class="fb-msgs">${msgs.join('')}</div>${box}</div>`;
  },
  async doAdminReply(id, btn){
    const ta=document.getElementById('fbr_'+id); const text=ta? ta.value : '';
    if(btn){ btn.disabled=true; btn.textContent='جارٍ الإرسال…'; }
    const r=await this.adminReply(id, text);
    if(btn){ btn.disabled=false; btn.textContent='رد'; }
    if(r.ok){ UI.toast('أُرسل ردّك — يصل المشترك كتنبيه عند فتحه اللعبة'); APP.render(); }
    else UI.toast(r.err, true);
  },
  async doUserReply(id, btn){
    const ta=document.getElementById('fbr_'+id); const text=ta? ta.value : '';
    if(btn){ btn.disabled=true; btn.textContent='جارٍ الإرسال…'; }
    const r=await this.userReply(id, text);
    if(btn){ btn.disabled=false; btn.textContent='إرسال'; }
    if(r.ok){ UI.toast('أُرسل ردّك'); APP.render(); }
    else UI.toast(r.err, true);
  },
  /* قائمة محادثات المشترك في صفحة الدعم */
  async renderMine(elId){
    const el=document.getElementById(elId); if(!el) return;
    if(typeof CLOUD==='undefined' || !CLOUD.user){ el.innerHTML='<div class="muted">سجّل الدخول لترى محادثاتك مع الدعم.</div>'; return; }
    const paint=(list)=>{
      if(!list.length){ el.innerHTML='<div class="muted">لا رسائل بعد — أرسل أول رسالة من الصندوق أعلاه ويصلك الرد هنا.</div>'; return; }
      el.innerHTML=list.map(f=>this.thread(f,'user')).join('');
    };
    // النسخة المحلية فوراً، ثم الخادم في الخلفية
    const cached=this.cachedMine();
    if(cached){ paint(cached); }
    const list=await this.mine();
    if(!document.getElementById(elId)) return;                    // غادر الصفحة
    if(list===null){ if(!cached) el.innerHTML='<div class="muted">تعذّر جلب محادثاتك الآن.</div>'; return; }
    if(!cached || JSON.stringify(list)!==JSON.stringify(cached)) paint(list);
    list.filter(f=>(+f.userUnread||0)>0).forEach(f=>this.markRead(f.id));
    if(this.unreadMine){ this.unreadMine=0; if(typeof APP!=='undefined') APP.renderTopbar(); }
    // بعد القراءة: النسخة المحلية بلا «غير مقروء» حتى لا تبقى الشارة
    try{ localStorage.setItem(this.MINE_KEY, JSON.stringify({uid:CLOUD.user.uid, at:Date.now(), list:list.map(f=>({...f, userUnread:0}))})); }catch(e){}
  },
  async submit(ev){
    const btn=ev&&ev.target; const type=gv('fb_type'), text=gv('fb_text');
    if(btn){ btn.disabled=true; btn.textContent='جارٍ الإرسال…'; }
    const r=await this.send(type, text);
    if(btn){ btn.disabled=false; btn.textContent='إرسال'; }
    if(r.ok){
      const ta=document.getElementById('fb_text'); if(ta) ta.value='';
      UI.modal(`<h3>وصلت رسالتك</h3><p class="muted">شكراً — يقرأها فريق العمل ويردّ عليك هنا في «محادثاتك مع الدعم»، ويصلك تنبيه في الجرس عند الرد.</p>
        <button class="btn" style="width:100%" onclick="UI.closeModal();APP.render()">تمام</button>`);
    } else UI.toast(r.err, true);
  },
};

function appVersion(){ return (document.querySelector('script[src*="app.js"]')?.src.match(/v=(\d+)/)||[])[1]||''; }

Object.assign(VIEWS, {
  /* ======================= عن اللعبة والقوانين ======================= */
  guide(){
    const st=DB.state, R=st.rules, S=st.scoring;
    const EN = typeof I18N!=='undefined' && I18N.isEn();
    const T = (ar,en)=> EN? en : ar;
    const row=(k)=>S[k]? `<tr><td>${esc(S[k].label)}</td><td class="num" style="color:${S[k].val<0?'var(--red)':'var(--accent)'}">${S[k].val>0?'+':''}${S[k].val}</td></tr>` : '';
    const groups=[
      [T('المشاركة','Appearance'), ['appearance','appearance60']],
      [T('الأهداف والصناعة','Goals and assists'), ['goalG','goalD','goalM','goalF','assist']],
      [T('الدفاع','Defence'), ['csG','csD','csM','concededPer2','penSave']],
      [T('خصومات','Deductions'), ['penMiss','ownGoal','yellow','red']],
    ];
    const known=new Set(groups.flatMap(g=>g[1]));
    const extra=Object.keys(S).filter(k=>!known.has(k));
    const chips=Object.entries(R.chips||{}).filter(([k,c])=>c.enabled);
    const sec=(title,body)=>`<div class="card" style="margin-bottom:12px"><h3>${title}</h3><div class="muted" style="line-height:2">${body}</div></div>`;
    const li=arr=>`<ul style="margin:6px 0 0;padding-inline-start:20px">${arr.map(x=>`<li>${x}</li>`).join('')}</ul>`;
    const chipLine=([k,c])=> EN
      ? `<b>${esc(c.label)}</b> — ${esc(I18N.DICT[c.desc]||c.desc)} (${c.uses>1? c.uses+' times' : 'once'} per season).`
      : `<b>${esc(c.label)}</b> — ${esc(c.desc)} (${c.uses>1? c.uses+' مرات' : 'مرة واحدة'} في الموسم).`;
    return `<div class="row spread" style="margin-bottom:12px;flex-wrap:wrap;gap:8px"><h2>${T('عن اللعبة','About the game')}</h2>
      <button class="btn sm sec" onclick="APP.go('about')">${T('المطوّر والاقتراحات','Developer and feedback')}</button></div>

      ${sec(T('نبذة','Overview'), T(`<b>فانتسي الدوري الكويتي</b> لعبة فانتسي بلاعبي الدوري الكويتي:
        تكوّن فريقاً من 15 لاعباً حقيقياً بميزانية محدودة، تختار تشكيلتك وكابتنك قبل كل جولة،
        وتجمع نقاطاً من أداء لاعبيك الفعلي في مباريات الدوري (أهداف، صناعة، شباك نظيفة…).
        تنافس في الترتيب العام وفي دوريات خاصة مع أصحابك.`,
        `<b>Kuwait League Fantasy</b> is a fantasy game built on the players of the Kuwaiti league:
        you build a squad of 15 real players within a limited budget, pick your lineup and captain before every gameweek,
        and collect points from how your players actually perform in league matches (goals, assists, clean sheets…).
        Compete in the overall table and in private leagues with your friends.`))}

      ${sec(T('فريق العمل وضمان الجودة','The team and quality assurance'), T(`احتساب النقاط في هذه اللعبة عمل جماعي بالتعاون مع فريق موقع <b>mfsoccer.com</b>:
        نتابع كل مباراة في الدوري، وتُسجَّل التشكيلات والتبديلات والأهداف والصناعة والكروت وركلات الجزاء
        <b>يدوياً</b> أثناء المباراة وبعدها، ثم تُراجع قبل اعتماد الجولة. لا توليد ولا تقدير — كل رقم في اللعبة
        من متابعة بشرية للمباراة، وأي خطأ يُكتشف يُصحَّح وتُعاد نقاط الجميع بأثر رجعي.
        لاحظت خطأً في اسم لاعب أو دقيقة أو نتيجة؟ أبلغنا من صفحة <a href="#about" onclick="APP.go('about');return false;">المطوّر والاقتراحات</a>.`,
        `Scoring in this game is a team effort together with the <b>mfsoccer.com</b> crew:
        we follow every league match, and lineups, substitutions, goals, assists, cards and penalties are recorded
        <b>by hand</b> during and after the match, then reviewed before the gameweek is confirmed. Nothing is generated or estimated — every number in the game
        comes from a person watching the match, and any error found is corrected with everyone's points recalculated retroactively.
        Spotted a wrong player name, minute or result? Tell us on the <a href="#about" onclick="APP.go('about');return false;">Developer and feedback</a> page.`))}

      ${sec(T('كيف تلعب','How to play'), li(EN ? [
        `<b>Build your squad:</b> ${R.squadSize} players — ${R.posCount.G} goalkeepers, ${R.posCount.D} defenders, ${R.posCount.M} midfielders, ${R.posCount.F} forwards — within a ${fmtK(R.budget)} budget and a maximum of ${R.maxPerClub} players from any one club.`,
        `<b>Pick your gameweek lineup:</b> 11 starters and 4 on the bench in priority order. Any formation within the limits: ${R.formationMin.D}–${R.formationMax.D} defenders, ${R.formationMin.M}–${R.formationMax.M} midfielders, ${R.formationMin.F}–${R.formationMax.F} forwards, and one goalkeeper.`,
        `<b>Set a captain and vice-captain:</b> the captain's points are doubled (×2). If the captain does not play, the double passes to the vice-captain automatically.`,
        `<b>Before the deadline:</b> each gameweek locks when its first match kicks off — you are free to change until then. After the deadline the lineup cannot be edited until the gameweek is scored.`,
        `<b>Create an account:</b> without one your team stays on this device only and earns no points. With an account your team follows you on every device and enters the table.`,
      ] : [
        `<b>كوّن فريقك:</b> ${R.squadSize} لاعباً — ${R.posCount.G} حارسان، ${R.posCount.D} مدافعين، ${R.posCount.M} لاعبي وسط، ${R.posCount.F} مهاجمين — بميزانية ${fmtK(R.budget)}، وبحد أقصى ${R.maxPerClub} لاعبين من النادي الواحد.`,
        `<b>اختر تشكيلة الجولة:</b> 11 أساسياً و4 على الدكة بترتيب الأولوية. الخطة حرة ضمن الحدود: ${R.formationMin.D}–${R.formationMax.D} مدافعين، ${R.formationMin.M}–${R.formationMax.M} وسط، ${R.formationMin.F}–${R.formationMax.F} مهاجمين، وحارس واحد.`,
        `<b>عيّن الكابتن ونائبه:</b> نقاط الكابتن تُضاعف (×2). إن لم يشارك الكابتن انتقلت المضاعفة للنائب تلقائياً.`,
        `<b>قبل موعد الإغلاق:</b> كل جولة تُقفل مع انطلاق أول مباراة فيها — لك حرية التغيير حتى تلك اللحظة. بعد الموعد لا يمكن تعديل التشكيلة حتى تُحتسب الجولة.`,
        `<b>أنشئ حساباً:</b> بلا حساب يبقى فريقك على جهازك فقط ولا تُحتسب له نقاط. بالحساب يتبعك فريقك على كل أجهزتك ويدخل الترتيب.`,
      ]))}

      ${sec(T('الانتقالات','Transfers'), li(EN ? (R.freeChanges? [
        `<b>Free changes:</b> change your lineup and players as much as you like before the deadline <b>with no points deduction</b>.`,
        `Prices change after every gameweek by ${R.priceRise} based on managers' net buying and selling — you sell at the player's current price.`,
        `Changes lock when the gameweek starts; between the deadline and scoring they are suspended, then reopen once results are scored.`,
      ] : [
        `You get <b>${R.freeTransfers}</b> free transfer every gameweek, and can bank up to <b>${R.maxSavedTransfers}</b>.`,
        `Every extra transfer beyond the free ones deducts <b>${R.transferCost}</b> points from the next gameweek's score.`,
        `Prices change after every gameweek by ${R.priceRise} based on managers' actual net buying and selling — you sell at the player's current price.`,
        `Transfers apply immediately and lock with the gameweek; between the deadline and scoring, transfers are suspended.`,
      ]) : (R.freeChanges? [
        `<b>تغييرات حرة:</b> بدّل من تشكيلتك ولاعبيك كما تشاء قبل موعد الإغلاق <b>بلا أي خصم نقاط</b>.`,
        `الأسعار تتغيّر بعد كل جولة بمقدار ${R.priceRise} حسب صافي شراء وبيع المشتركين — البيع بسعر اللاعب الحالي.`,
        `التغييرات تُقفل مع بداية الجولة؛ بين الموعد والاحتساب تكون موقوفة، ثم تُفتح بعد احتساب النتائج.`,
      ] : [
        `لك <b>${R.freeTransfers}</b> انتقال مجاني كل جولة، ويمكن تجميعها حتى <b>${R.maxSavedTransfers}</b>.`,
        `كل انتقال إضافي فوق المجاني يخصم <b>${R.transferCost}</b> نقاط من نقاط الجولة التالية.`,
        `الأسعار تتغيّر بعد كل جولة بمقدار ${R.priceRise} حسب صافي شراء وبيع المشتركين الفعلي — البيع بسعر اللاعب الحالي.`,
        `الانتقالات تُنفَّذ فوراً وتُقفل مع الجولة؛ بين الموعد والاحتساب تكون الانتقالات موقوفة.`,
      ])))}

      ${sec(T('الكروت الخاصة','Chips'), T(`تُفعَّل من شاشة «فريقي» قبل الموعد، كرت واحد في الجولة:`, `Activated from the "My Team" screen before the deadline, one chip per gameweek:`) + li(chips.map(chipLine)))}

      <div class="card" style="margin-bottom:12px"><h3>${T('نظام النقاط','Scoring system')}</h3>
        <div class="tiny" style="margin-bottom:8px">${T('تُحتسب لكل لاعب في كل مباراة يشارك فيها، ثم تُجمع لتشكيلتك الأساسية (والكابتن مضاعف).','Counted for every player in every match he plays, then summed for your starting XI (captain doubled).')}</div>
        <div class="grid g2">
          ${groups.map(([t,keys])=>`<div><div class="tiny" style="font-weight:800;margin:6px 0">${t}</div><div class="scroll-x"><table class="tbl">${keys.map(row).join('')}</table></div></div>`).join('')}
          ${extra.length? `<div><div class="tiny" style="font-weight:800;margin:6px 0">${T('أخرى','Other')}</div><div class="scroll-x"><table class="tbl">${extra.map(row).join('')}</table></div></div>`:''}
        </div>
        <div class="muted" style="line-height:2;margin-top:10px">
          ${li(EN ? [
            `<b>Clean sheets</b> go to players who played 60 minutes or more while their team conceded no goal with them on the pitch.`,
            `<b>Goals conceded</b> count against goalkeepers and defenders only while they are on the pitch (every 2 goals ${S.concededPer2? S.concededPer2.val:''}).`,
            `<b>A second yellow</b> counts as one red card (not added to the yellow).`,
            `<b>Bonus</b> (3/2/1 for the best three in the match) is entered by the admins when available.`,
          ] : [
            `<b>الشباك النظيفة</b> تُمنح لمن لعب 60 دقيقة فأكثر ولم يستقبل فريقه هدفاً وهو في الملعب.`,
            `<b>الأهداف المستقبلة</b> تُحسب على الحارس والمدافع فقط أثناء وجوده في الملعب (كل هدفين ${S.concededPer2? S.concededPer2.val:''}).`,
            `<b>الطرد بإنذارين</b> يُحتسب بطاقة حمراء واحدة (لا يُجمع مع الصفراء).`,
            `<b>البونص</b> (3/2/1 لأفضل ثلاثة في المباراة) يُدخل من الإدارة عند توفره.`,
          ])}
        </div>
      </div>

      ${sec(T('التبديل التلقائي والدكة','Auto-subs and the bench'), li(EN ? [
        `Scoring starts from Gameweek ${DB.state.rules.scoringFromGW||1}: earlier gameweeks are not scored for anyone.`,
        `If a starter does not play (zero minutes), the first bench player who keeps the formation valid comes on, in bench order.`,
        `The substitute goalkeeper only comes on for the starting goalkeeper.`,
        `Bench points count only with the Bench Boost chip.`,
      ] : [
        `الاحتساب يبدأ من الجولة ${DB.state.rules.scoringFromGW||1}: الجولات قبلها لا تُحتسب نقاطها لأحد.`,
        `إذا لم يشارك لاعب أساسي (صفر دقيقة) يحلّ محله أول بديل من الدكة يحفظ الخطة صالحة، بترتيب الدكة.`,
        `الحارس البديل لا يدخل إلا مكان الحارس الأساسي.`,
        `نقاط الدكة لا تُحتسب إلا بكرت «دكة قوية».`,
      ]))}

      ${sec(T('الاحتساب والترتيب','Scoring and rankings'), li(EN ? [
        `After the last match of the gameweek, results are pulled from mfsoccer and every manager's points are scored at once on the server, then the next gameweek opens.`,
        `The overall table is by total points. Private leagues: classic (total points from the gameweek the league was created) or head-to-head H2H (3 points for a win, 1 for a draw).`,
        `A gameweek whose fixtures are not yet published on the site appears empty with no deadline — the lineup stays open until the fixtures are released.`,
        `If a match result is corrected after scoring, everyone's points are corrected retroactively.`,
      ] : [
        `بعد آخر مباراة في الجولة تُسحب النتائج من mfsoccer وتُحتسب نقاط كل المشتركين دفعة واحدة على الخادم، ثم تُفتح الجولة التالية.`,
        `الترتيب العام بمجموع النقاط. الدوريات الخاصة: كلاسيكية (مجموع النقاط من جولة الإنشاء) أو مواجهات H2H (3 نقاط للفوز، 1 للتعادل).`,
        `الجولة التي لم ينشر الموقع جدولها تظهر فارغة وبلا موعد إغلاق — التشكيلة تبقى مفتوحة حتى يصدر الجدول.`,
        `عند تصحيح نتيجة مباراة بعد الاحتساب تُصحَّح نقاط الجميع بأثر رجعي.`,
      ]))}

      <div class="card"><h3>${T('لديك اقتراح أو لاحظت خطأ؟','Have a suggestion or spotted an error?')}</h3>
        <div class="muted" style="line-height:1.9">${T('صفحة المطوّر فيها صندوق الاقتراحات وروابط التواصل.','The developer page has the feedback box and contact links.')}</div>
        <div style="margin-top:10px"><button class="btn sm" onclick="APP.go('about')">${T('الاقتراحات والتواصل','Feedback and contact')}</button></div>
      </div>`;
  },

  /* ======================= المطوّر والاقتراحات ======================= */
  about(){
    const m=DB.me();
    FEEDBACK.flush();
    const mineId='fbMine'+Date.now();
    setTimeout(()=>FEEDBACK.renderMine(mineId), 30);
    return `<h2 style="margin-bottom:12px">الدعم والاقتراحات</h2>
      ${this.devCard(false)}
      <div class="grid g2" style="margin-top:12px">
        <div>
          <div class="card" style="margin-bottom:12px"><h3>رسالة جديدة للدعم الفني</h3>
            <div class="tiny" style="margin-bottom:10px">فكرة، مشكلة، خطأ في اسم لاعب أو نتيجة — اكتبها هنا وتصل <b>لفريق العمل</b> مباشرة، ويصلك الرد في «محادثاتك» أسفل هذه الصفحة مع تنبيه في الجرس.</div>
            <div class="field"><label>النوع</label><select id="fb_type">${FEEDBACK.TYPES.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></div>
            <div class="field"><label>الرسالة</label><textarea id="fb_text" rows="5" maxlength="1500" placeholder="اكتب اقتراحك أو المشكلة بالتفصيل…" style="width:100%;resize:vertical"></textarea></div>
            <button class="btn" style="width:100%" onclick="FEEDBACK.submit(event)">إرسال</button>
          </div>
          <div class="card"><h3>محادثاتك مع الدعم</h3>
            <div id="${mineId}"><div class="muted">جارٍ التحميل…</div></div>
          </div>
        </div>
        <div>
          <div class="card" style="margin-bottom:12px"><h3>التواصل مع المطوّر</h3>
            ${DEV.links.map(l=>`<a class="link-row" href="${l.url}" target="_blank" rel="noopener" style="text-decoration:none;color:inherit">
              <span class="lr-lead">${UI.icon(l.ic,20)}<span><span class="lr-title">${l.label}</span><span class="lr-sub" style="direction:ltr;display:inline-block">${l.handle}</span></span></span>
              <span class="lr-arrow">${UI.icon('chev',16)}</span></a>`).join('')}
          </div>
          <div class="card">
            <div class="tiny" style="color:var(--text3)">النسخة ${appVersion()} · البيانات بالتعاون مع mfsoccer.com</div>
            <div style="margin-top:10px"><button class="btn ghost sm" onclick="APP.go('admin')">${UI.icon('gear',15)} ${ADMINAUTH.active()? 'لوحة الإدارة' : 'دخول المطوّر'}</button></div>
          </div>
        </div>
      </div>`;
  },
});

/* ---------- تنبيه فريق العمل: عدّاد الاقتراحات الجديدة لكل مدير على الخادم ---------- */
FEEDBACK.unseen = 0;
FEEDBACK.poll = async function(){
  if(typeof CLOUD==='undefined' || !CLOUD.ready || !CLOUD.admin) return;
  const list = await this.list(); if(!list) return;
  const news = list.filter(f=>(f.status||'new')==='new');
  const n = news.length;
  const changed = n!==this.unseen; this.unseen = n;
  const m = DB.me();
  /* نُنبّه فقط عمّا لم نُنبّه عنه من قبل: نحفظ معرّفات الرسائل التي كانت «جديد» في آخر فحص،
     فتغيّر العدد وحده (5 ثم 4 ثم 1 بعد قراءة بعضها) لا يُنشئ تنبيهاً جديداً. */
  const KNOWN='kwf_fb_known'; let known=[]; try{ known=JSON.parse(localStorage.getItem(KNOWN)||'[]'); }catch(e){}
  const fresh = news.filter(f=>!known.includes(f.id));
  try{ localStorage.setItem(KNOWN, JSON.stringify(news.map(f=>f.id))); }catch(e){}
  if(fresh.length && m){
    const key='fb_'+fresh.map(f=>f.id).join(',');
    DB.state.notifications[m.id]=DB.state.notifications[m.id]||[];
    if(!DB.state.notifications[m.id].some(x=>x.type===key)){
      /* رد المشترك داخل محادثة قائمة يُرجع حالتها «جديد» — نميّزه عن الاقتراح الجديد فعلاً */
      const isReply = f => { const r=f.replies||[]; return r.length>0 && r[r.length-1].by==='user'; };
      const nRep = fresh.filter(isReply).length, nNew = fresh.length-nRep;
      const parts=[]; if(nNew) parts.push(`${nNew} اقتراح جديد من المشتركين`); if(nRep) parts.push(`${nRep} رد جديد من مشترك في محادثة الدعم`);
      NOTIF.push(m.id, key, parts.join(' · ')+' — الإدارة ← الاقتراحات');
      try{ localStorage.setItem(DB.KEY, JSON.stringify(DB.state)); }catch(e){}
      if(typeof APP!=='undefined') APP.renderTopbar();
    }
  }
  if(changed && typeof APP!=='undefined' && APP.route==='admin') APP.render();
};
setTimeout(()=>FEEDBACK.poll(), 4000);
setInterval(()=>FEEDBACK.poll(), 5*60000);
setTimeout(()=>FEEDBACK.pollMine(true), 6000);
setInterval(()=>FEEDBACK.pollMine(true), 5*60000);

/* ---------- لوحة الإدارة: قائمة الاقتراحات ---------- */
if(typeof ADMIN!=='undefined'){
  /* شارة العدد على زر «الاقتراحات» في قائمة الإدارة */
  const _view = ADMIN.view.bind(ADMIN);
  ADMIN.view = function(){
    let h=_view();
    if(FEEDBACK.unseen>0) h=h.replace(">الاقتراحات</button>", `>الاقتراحات <span class="pill red" style="padding:0 6px;margin-inline-start:4px">${FEEDBACK.unseen}</span></button>`);
    return h;
  };
  ADMIN.sec_feedback=function(){
    const id='fbList'+Date.now();
    setTimeout(async()=>{
      const el=document.getElementById(id); if(!el) return;
      const list=await FEEDBACK.list();
      if(list===null){
        const u = typeof CLOUD!=='undefined' && CLOUD.user;
        el.innerHTML = !u
          ? '<div class="muted">الاقتراحات مخزّنة على الخادم وتحتاج دخولاً بحساب الموقع (Firebase) لا بكلمة مرور المطوّر المحلية: افتح قسم <b>«السحابة»</b> وادخل بحساب mfsoccer، ثم ارجع هنا.</div>'
          : (!CLOUD.admin
              ? '<div class="muted">دخلت بحساب <b>'+esc(u.email||'')+'</b> لكنه ليس ضمن فريق العمل في seasons/staff — لا يستطيع قراءة الاقتراحات.</div>'
              : '<div class="muted">أنت مدير على الخادم لكن قواعد Firestore الحالية لا تسمح بقراءة مجموعة <code>feedback</code> بعد — يضيفها محمد من وثيقة التسليم (§3).</div>');
        return; }
      if(!list.length){ el.innerHTML='<div class="muted">لا اقتراحات بعد</div>'; return; }
      const T=Object.fromEntries(FEEDBACK.TYPES);
      list.sort((a,b)=>String(b.updated||b.created).localeCompare(String(a.updated||a.created)));
      el.innerHTML=`<div class="fb-admin">${list.map(f=>`<div class="fb-card ${f.status==='done'||f.status==='rejected'?'dim':''} ${(f.status||'new')==='new'?'new':''}">
          <div class="row spread" style="gap:8px;flex-wrap:wrap">
            <div><b>${esc(f.username||'ضيف')}</b>${f.teamName?` <span class="tiny">· ${esc(f.teamName)}</span>`:''}${!f.uid?' <span class="tiny">(بلا حساب — لا يمكن الرد عليه)</span>':''}
              <div class="tiny">${UI.fmtDateShort(f.created)} · ج${f.gw||'—'} · ${esc(f.ver||'')}</div></div>
            <select onchange="FEEDBACK.setStatus('${f.id}',this.value).then(ok=>{UI.toast(ok?'حُدّثت':'تعذّر التحديث',!ok); FEEDBACK.poll();})">
              ${[['new','جديد'],['seen','مقروء'],['done','منفّذ'],['rejected','مرفوض']].map(([v,l])=>`<option value="${v}" ${(f.status||'new')===v?'selected':''}>${l}</option>`).join('')}
            </select>
          </div>
          ${f.uid? FEEDBACK.thread(f,'admin') : `<div class="fb-thread"><div class="fb-msgs">${'<div class="fb-msg u"><div class="fb-txt">'+esc(f.text)+'</div></div>'}</div></div>`}
        </div>`).join('')}</div>`;
    },50);
    return `<div class="card"><h3>اقتراحات المشتركين</h3>
      <div class="tiny" style="margin-bottom:10px">ما يرسله المشتركون من صفحة «الدعم والاقتراحات». اكتب ردّك تحت أي رسالة فيصل المشترك كمحادثة مع تنبيه. «منفّذ» أو «مرفوض» يغلق المحادثة.</div>
      <div id="${id}"><div class="muted">جارٍ التحميل…</div></div></div>`;
  };
}
