/* =========================================================
   تفضيلات الإشعارات — لوحة التحكم الكاملة (منصور 2026-11-03)
   ---------------------------------------------------------
   امتداد للنظام القائم لا نسخة ثانية منه: نفس PUSH (fantasy/js/push.js) للإذن والرمز،
   ونفس push-send لكل إرسال، ونفس محرّر المباريات (livepush.js) مصدراً للأحداث.

   كيف يصل التفضيل فعلاً إلى الإرسال:
   · كل حدث مختار × نطاقه يصير «موضوع» FCM يشترك فيه جهاز المستخدم
     (g_a = كل الأهداف، g_c_xxx = أهداف بطولة، g_f_xxx = أهداف يسجّلها فريقي، g_o_xxx = أهداف تُسجَّل على فريقي …).
   · المحرّر يرسل كل حدث حقيقي مرة واحدة بشرط مواضيع (حتى 4 مواضيع) — FCM يوصله لكل جهاز
     يطابق أي موضوع منها، مرة واحدة فقط مهما تعدّد التطابق.
   · الأجهزة القديمة (قبل هذه اللوحة) تبقى على موضوع «all» وتصلها الأحداث نفسها التي كانت تصلها.
   · ما لا تسجّله بياناتنا (الإصابات، الاستحواذ، قرارات VAR التفصيلية…) معلَّم «غير متاح» ولا يُشترك فيه.

   الأصوات: المتصفح وتطبيق iOS الحالي لا يسمحان بصوت مخصّص للإشعار والتطبيق مغلق — يُستخدم صوت النظام.
   الصوت المختار يُشغَّل حين يكون الموقع/التطبيق مفتوحاً (خادم الخدمة يمرّر الحدث للصفحة)، والمعاينة دائماً.
   ========================================================= */
'use strict';
window.NPREF = (function(){
  const K = 'mf_np', SYNC = 'mf_np_sync', SND_DIR = '/assets/sounds/';

  /* ---------- الأحداث ---------- */
  /* d = عائلة الإرسال (اسم الموضوع)؛ side = للحدث فريق فاعل وفريق مقابل (هدف/بطاقة)؛
     fav = يعتمد على «فرقي» وحدها؛ sub = نوع فرعي يغطيه الحدث الأب إن كان مفعّلاً؛ na = غير متاح مع السبب */
  const NA_DATA = 'لا تسجّله بيانات المحرّر حالياً';
  const CATS = [
    { id:'rem', t:'تذكير المباريات', ev:[
      {k:'r30', t:'قبل الانطلاق بـ30 دقيقة', snd:'remind'},
      {k:'r15', t:'قبل الانطلاق بـ15 دقيقة', snd:'remind'},
      {k:'r5',  t:'قبل الانطلاق بـ5 دقائق', snd:'remind'},
      {k:'ko',  t:'انطلاق المباراة', snd:'kickoff'},
      {k:'h2',  t:'بداية الشوط الثاني', snd:'kickoff'},
      {k:'ft',  t:'نهاية المباراة', snd:'ft'} ]},
    { id:'goal', t:'الأهداف', ev:[
      {k:'g',   t:'كل هدف', snd:'goal', side:1},
      {k:'gf',  t:'أهداف فرقي', snd:'goal', fav:'f', d:'g'},
      {k:'ga',  t:'الأهداف على فرقي', snd:'goal', fav:'o', d:'g'},
      {k:'gp',  t:'أهداف ركلات الجزاء', snd:'goal', side:1, sub:'g'},
      {k:'gog', t:'الأهداف العكسية', snd:'goal', side:1, sub:'g'},
      {k:'gat', t:'أهداف الوقت بدل الضائع', snd:'goal', side:1, sub:'g'},
      {k:'gdis',t:'إلغاء هدف بعد احتسابه', na:'المحرّر يحذف الهدف ولا يسجّل سبب الإلغاء'} ]},
    { id:'card', t:'البطاقات', ev:[
      {k:'y',   t:'الإنذارات', snd:'yellow', side:1},
      {k:'r',   t:'حالات الطرد', snd:'red', side:1},
      {k:'r2',  t:'الإنذار الثاني (طرد)', snd:'red', side:1, sub:'r'},
      {k:'yf',  t:'إنذارات فرقي', snd:'yellow', fav:'f', d:'y'},
      {k:'rf',  t:'طرد من فرقي', snd:'red', fav:'f', d:'r'},
      {k:'co',  t:'بطاقات منافسي فرقي', snd:'yellow', fav:'o', d:['y','r']} ]},
    { id:'var', t:'VAR وقرارات الحكم', ev:[
      {k:'var', t:'بداية مراجعة VAR', snd:'var'},
      {k:'vgd', t:'إلغاء هدف بعد VAR', na:'نتيجة المراجعة نص حرّ في المحرّر'},
      {k:'vpa', t:'احتساب ركلة جزاء بعد VAR', na:'نتيجة المراجعة نص حرّ في المحرّر'},
      {k:'vpo', t:'إلغاء ركلة جزاء بعد VAR', na:'نتيجة المراجعة نص حرّ في المحرّر'},
      {k:'vrc', t:'قرار طرد بعد VAR', na:'نتيجة المراجعة نص حرّ في المحرّر'},
      {k:'refd',t:'قرارات الحكم الكبرى', na:NA_DATA} ]},
    { id:'evt', t:'أحداث المباراة', ev:[
      {k:'pa',  t:'احتساب ركلة جزاء', snd:'pen'},
      {k:'pm',  t:'إهدار ركلة جزاء', snd:'pen'},
      {k:'sub', t:'التبديلات', snd:'sub'},
      {k:'add', t:'إعلان الوقت بدل الضائع', snd:'remind'},
      {k:'ht',  t:'نهاية الشوط الأول', snd:'ft'},
      {k:'et',  t:'بداية الأشواط الإضافية', snd:'kickoff'},
      {k:'pso', t:'بداية ركلات الترجيح', snd:'pen'},
      {k:'inj', t:'الإصابات', na:NA_DATA},
      {k:'pp',  t:'تأجيل المباراة أو إلغاؤها', na:'لا يوجد حقل تأجيل في بيانات المباراة'} ]},
    { id:'stat', t:'إحصاءات المباراة', ev:[
      {k:'poss',t:'تحديثات الاستحواذ', na:'الإحصاءات تُدخل بعد المباراة لا أثناءها'},
      {k:'sot', t:'التسديدات على المرمى', na:'الإحصاءات تُدخل بعد المباراة لا أثناءها'},
      {k:'cor', t:'الركلات الركنية', na:'الإحصاءات تُدخل بعد المباراة لا أثناءها'},
      {k:'mom', t:'تحوّلات الزخم', na:'لا مصدر بيانات موثوق'} ]},
    { id:'xi', t:'التشكيلات', ev:[
      {k:'xi',   t:'إعلان التشكيلة الأساسية', snd:'lineup'},
      {k:'form', t:'إعلان الخطة', snd:'lineup'},
      {k:'bench',t:'قائمة البدلاء', na:'المحرّر يسجّل الأساسيين فقط'},
      {k:'xch',  t:'تغيير في التشكيلة المعلنة', na:NA_DATA} ]},
    { id:'gen', t:'عام', ev:[
      {k:'gen', t:'أخبار وإعلانات MF SOCCER', snd:'remind'} ]}
  ];
  const EV = {}; CATS.forEach(c=>c.ev.forEach(e=>{ e.cat=c.id; EV[e.k]=e; }));
  /* الأحداث التي كانت تصل كل الأجهزة قبل اللوحة — تبقى مفعّلة افتراضياً كما قرّر منصور (2026-11-02) */
  const DEF_ON = ['r15','ko','h2','ft','g','gf','ga','y','r','var','pa','pm','sub','ht','et','pso','xi','gen'];

  /* ---------- مكتبة الأصوات ---------- */
  const SND_CAT = [
    {k:'goal',    t:'الأهداف',        def:'goal_mf'},
    {k:'yellow',  t:'الإنذارات',      def:'y_beep'},
    {k:'red',     t:'الطرد',          def:'r_alert'},
    {k:'var',     t:'VAR',            def:'var_pulse'},
    {k:'pen',     t:'ركلات الجزاء',   def:'pen_drum'},
    {k:'kickoff', t:'الانطلاق',       def:'ko_whistle'},
    {k:'ft',      t:'نهاية المباراة', def:'ft_whistle'},
    {k:'lineup',  t:'التشكيلات',      def:'xi_ann'},
    {k:'sub',     t:'التبديلات',      def:'sub_soft'},
    {k:'remind',  t:'التذكير',        def:'rem_tone'} ];
  const LIB = {
    goal_mf:'بصمة MF SOCCER', goal_horn:'بوق الملعب', goal_chime:'رنين',
    y_beep:'تنبيه قصير', y_soft:'نقرة هادئة', r_alert:'تنبيه قوي', r_siren:'صافرة إنذار',
    var_pulse:'ترقّب', var_tick:'عدّاد', pen_drum:'قرع طبول', pen_ping:'نغمة الجزاء',
    ko_whistle:'صافرة البداية', ko_bell:'جرس', ft_whistle:'صافرة النهاية', ft_soft:'ختام هادئ',
    xi_ann:'إعلان', xi_pop:'نقرة', sub_soft:'إشارة خفيفة', sub_swap:'تبادل', rem_tone:'نغمة', rem_bell:'جرس مزدوج' };

  const defaults = () => ({ v:1, ev: Object.fromEntries(DEF_ON.map(k=>[k,1])), scope:'all', teams:[], comps:[],
    snd:{}, soundOn:1, vol:.8, muteAll:0, dnd:{on:0, from:'00:00', to:'07:00'}, updated:0 });

  /* ---------- التخزين ---------- */
  const _get = (k,d) => { try{ const v=JSON.parse(localStorage.getItem(k)); return v==null?d:v; }catch(e){ return d; } };
  const _set = (k,v) => { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };
  function load(){ const p = _get(K, null); return p ? Object.assign(defaults(), p, {dnd:Object.assign(defaults().dnd, p.dnd||{})}) : defaults(); }
  let P = load(), DRAFT = null, OPEN = null;

  /* ---------- المواضيع ---------- */
  /* بصمة قصيرة ثابتة لاسم النادي/البطولة العربي — نفس الدالة في netlify/functions/lib/topics.js */
  function h(s){ let x = 5381; s = String(s||''); for(let i=0;i<s.length;i++) x = ((x*33) ^ s.charCodeAt(i)) >>> 0; return x.toString(36); }
  const SIDE = new Set(['g','gp','gog','gat','y','r','r2']);
  function scopeTopics(d, p){
    if(p.scope === 'all') return [d+'_a'];
    const out = (p.comps||[]).map(c=>d+'_c_'+h(c));
    (p.teams||[]).forEach(t=>{ if(SIDE.has(d)){ out.push(d+'_f_'+h(t), d+'_o_'+h(t)); } else out.push(d+'_t_'+h(t)); });
    return out;
  }
  function topics(p){
    p = p || P; const s = new Set();
    Object.keys(p.ev||{}).forEach(k=>{
      const e = EV[k]; if(!p.ev[k] || !e || e.na) return;
      if(k === 'gen'){ s.add('gen'); return; }
      if(e.fav){ [].concat(e.d).forEach(d=>(p.teams||[]).forEach(t=>s.add(d+'_'+e.fav+'_'+h(t)))); return; }
      if(e.sub && p.ev[e.sub]) return;          /* الأب يغطيه في نفس النطاق — لا إشعار مكرر */
      scopeTopics(k, p).forEach(x=>s.add(x));
    });
    return [...s].sort();
  }

  /* ---------- المزامنة مع FCM والحساب ---------- */
  const user = () => { try{ return (typeof FBUSER!=='undefined' && FBUSER && FBUSER.getIdToken) ? FBUSER : null; }catch(e){ return null; } };
  const pushOn = () => { try{ return typeof PUSH!=='undefined' && PUSH.enabled(); }catch(e){ return false; } };
  async function token(){
    if(typeof PUSH === 'undefined') return '';
    try{
      if(PUSH.iosApp && PUSH.iosApp()){ const t = await PUSH._ios.token(); return (t && t!=='ERROR GET TOKEN') ? String(t) : ''; }
      return (await PUSH._token()) || '';
    }catch(e){ return ''; }
  }
  /* نسخة للخادم الخدمي: الكتم وساعات الهدوء والأصوات تُطبَّق على الإشعار نفسه */
  async function toSW(){
    try{ const c = await caches.open('mf-np'); await c.put('/__np', new Response(JSON.stringify(P), {headers:{'Content-Type':'application/json'}})); }catch(e){}
  }
  const v2 = () => !!_get(SYNC, null);

  /* يربط مواضيع هذا الجهاز بالتفضيلات. tok اختياري (PUSH.refresh يمرّره). */
  async function sync(tok){
    toSW();
    if(!pushOn()) return {ok:false, why:'off'};
    tok = tok || await token();
    if(!tok) return {ok:false, why:'token'};
    const want = topics(P), st = _get(SYNC, null);
    const first = !st || st.tok !== tok;
    const had = first ? [] : (st.topics||[]);
    const add = want.filter(x=>had.indexOf(x)<0), rem = had.filter(x=>want.indexOf(x)<0);
    if(first) rem.push('all');                  /* جهاز صار على اللوحة: يخرج من الموضوع العام القديم فلا تتكرر الإشعارات */
    if(!add.length && !rem.length) return {ok:true, same:true};
    try{
      const u = user();
      let r;
      if(u){
        r = await fetch('/.netlify/functions/push-prefs', { method:'POST',
          headers:{'Content-Type':'application/json', Authorization:'Bearer '+(await u.getIdToken())},
          body: JSON.stringify({ prefs:P, topics:want, token:tok, prev:had }) });
      }else{
        r = await fetch('/.netlify/functions/push-subscribe', { method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ token:tok, add, remove:rem }) });
      }
      const j = await r.json().catch(()=>({}));
      if(!r.ok || !j.ok) return {ok:false, why:'server', err:j.err||r.status};
      _set(SYNC, {tok, topics:want, at:Date.now()});
      return {ok:true};
    }catch(e){ return {ok:false, why:'net'}; }
  }

  /* إيقاف الإشعارات على هذا الجهاز: يخرج من كل مواضيعه، ويُحذف من أجهزة الحساب فلا يعيد جهاز آخر ربطه */
  async function unsync(tok){
    const st = _get(SYNC, null); try{ localStorage.removeItem(SYNC); }catch(e){}
    tok = tok || (st && st.tok); if(!tok) return;
    try{
      const u = user();
      if(u) await fetch('/.netlify/functions/push-prefs', { method:'POST',
        headers:{'Content-Type':'application/json', Authorization:'Bearer '+(await u.getIdToken())},
        body: JSON.stringify({ drop:tok, prev:(st && st.topics)||[] }) });
      else if(st && st.topics && st.topics.length) await fetch('/.netlify/functions/push-subscribe', { method:'POST',
        headers:{'Content-Type':'application/json'}, body: JSON.stringify({ token:tok, add:[], remove:st.topics }) });
    }catch(e){}
  }

  /* عند الإقلاع: إن كان للحساب تفضيلات أحدث (من جهاز آخر) نعتمدها ونعيد ربط هذا الجهاز */
  async function pull(){
    const u = user(); if(!u) return;
    try{
      const r = await fetch('/.netlify/functions/push-prefs', { headers:{ Authorization:'Bearer '+(await u.getIdToken()) } });
      const j = await r.json().catch(()=>({}));
      if(j && j.ok && j.prefs && +j.prefs.updated > +P.updated){ P = Object.assign(defaults(), j.prefs); _set(K, P); await sync(); }
    }catch(e){}
  }

  /* ---------- الأصوات ---------- */
  let AUD = null;
  function soundFor(cat, p){ p = p||P; const v = (p.snd||{})[cat]; if(v==='mute') return ''; return LIB[v] ? v : (SND_CAT.find(x=>x.k===cat)||{}).def||''; }
  function play(id, vol){
    if(!id) return;
    try{ if(AUD){ AUD.pause(); } AUD = new Audio(SND_DIR + id + '.mp3'); AUD.volume = Math.max(0, Math.min(1, vol==null ? P.vol : vol)); AUD.play().catch(()=>{}); }catch(e){}
  }
  function inDnd(p){
    p = p||P; if(!p.dnd || !p.dnd.on) return false;
    const n = new Date(), m = n.getHours()*60+n.getMinutes();
    const pm = s => { const [a,b] = String(s||'0:0').split(':'); return (+a||0)*60+(+b||0); };
    const f = pm(p.dnd.from), t = pm(p.dnd.to);
    return f <= t ? (m >= f && m < t) : (m >= f || m < t);
  }
  /* إشعار وصل والصفحة مفتوحة (خادم الخدمة يمرّره): صوت الحدث المختار */
  function onPush(d){
    if(!d || document.visibilityState !== 'visible') return;
    if(!P.soundOn || P.muteAll || inDnd()) return;
    const e = EV[d.ev] || EV[{gp:'g',gog:'g',gat:'g',r2:'r'}[d.ev]] || null;
    play(soundFor(e ? e.snd : 'remind'));
  }

  /* ---------- اللوحة ---------- */
  const esc = s => String(s==null?'':s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const clubs = () => { try{ return (typeof CLUBS!=='undefined' && CLUBS.length) ? CLUBS.slice() : []; }catch(e){ return []; } };
  const crestOf = c => { try{ return (typeof crestSrcOf==='function') ? crestSrcOf(c) : ''; }catch(e){ return ''; } };
  function compGroups(){
    let dom = []; try{ dom = (typeof COMPS!=='undefined') ? COMPS.slice() : ['الدوري']; }catch(e){ dom = ['الدوري']; }
    let ext = [];
    try{ if(window.EXT && EXT.withExt) ext = EXT.withExt(()=>[...new Set(((typeof ALL!=='undefined' && ALL && ALL.matches)||[]).map(m=>m.comp||'الدوري'))]) || []; }catch(e){}
    return { league: dom.filter(c=>c==='الدوري'), cups: dom.filter(c=>c!=='الدوري'), ext: ext.filter(c=>dom.indexOf(c)<0) };
  }
  const compName = c => c === 'الدوري' ? 'الدوري الكويتي الممتاز' : c;
  const SW = (on, attrs, dis) => `<button type="button" class="np-sw${on?' on':''}" role="switch" aria-checked="${on?'true':'false'}" ${dis?'disabled':''} ${attrs}><i></i></button>`;

  function stateLine(){
    if(typeof PUSH === 'undefined' || !PUSH.supported()){
      const ios = typeof PUSH!=='undefined' && PUSH.iosApp && PUSH.iosApp();
      return { cls:'warn', t: ios ? 'حدّث التطبيق من App Store لتفعيل الإشعارات' : 'هذا المتصفح لا يدعم الإشعارات الفورية — على الآيفون أضف الموقع إلى الشاشة الرئيسية من Safari' };
    }
    if(!(PUSH.iosApp && PUSH.iosApp()) && ('Notification' in window) && Notification.permission === 'denied')
      return { cls:'warn', t:'الإشعارات محجوبة لهذا الموقع — اسمح بها من إعدادات المتصفح' };
    return pushOn() ? { cls:'ok', t:'مفعّلة على هذا الجهاز' } : { cls:'', t:'متوقفة على هذا الجهاز' };
  }

  function evRow(e, d){
    if(e.na) return `<div class="np-row na"><span class="np-l">${esc(e.t)}<em>غير متاح حالياً · ${esc(e.na)}</em></span>${SW(false,'',true)}</div>`;
    const noTeams = e.fav && !(d.teams||[]).length;
    const covered = e.sub && d.ev[e.sub];
    const note = noTeams ? '<em>اختر فرقك من تبويب «المباريات»</em>' : covered ? `<em>مشمول في «${esc(EV[e.sub].t)}»</em>` : '';
    return `<div class="np-row${noTeams?' dim':''}"><span class="np-l">${esc(e.t)}${note}</span>${SW(!!d.ev[e.k], `data-np-ev="${e.k}"`, noTeams)}</div>`;
  }
  function tabEvents(d){
    return CATS.map(c=>{
      const av = c.ev.filter(e=>!e.na), on = av.filter(e=>d.ev[e.k]).length;
      const open = OPEN.cat === c.id;
      return `<section class="np-cat${open?' open':''}">
        <button type="button" class="np-cath" data-np-cat="${c.id}" aria-expanded="${open}">
          <b>${esc(c.t)}</b><span class="np-cnt">${av.length ? on+' من '+av.length : 'غير متاح'}</span><i class="np-chev"></i></button>
        <div class="np-catb">${av.length ? `<div class="np-bulk"><button type="button" data-np-all="${c.id}">تحديد الكل</button><button type="button" data-np-none="${c.id}">إلغاء الكل</button></div>` : ''}
          ${c.ev.map(e=>evRow(e,d)).join('')}</div></section>`;
    }).join('');
  }
  function chip(kind, val, on, label, img){
    return `<button type="button" class="np-chip${on?' on':''}" data-np-${kind}="${esc(val)}" aria-pressed="${on}">${img?`<img src="${esc(img)}" alt="" loading="lazy">`:''}<span>${esc(label)}</span></button>`;
  }
  function tabMatches(d){
    const g = compGroups(), cs = d.comps||[], ts = d.teams||[];
    const grp = (title, list) => list.length ? `<div class="np-sub">${esc(title)}</div><div class="np-chips">${list.map(c=>chip('comp', c, cs.indexOf(c)>=0, compName(c))).join('')}</div>` : '';
    return `<div class="np-scope">
        <label class="np-radio"><input type="radio" name="np-scope" value="all" ${d.scope==='all'?'checked':''}><span><b>كل المباريات</b><em>كل البطولات وكل الفرق</em></span></label>
        <label class="np-radio"><input type="radio" name="np-scope" value="pick" ${d.scope!=='all'?'checked':''}><span><b>مباريات مختارة</b><em>فرقي و/أو بطولات محددة</em></span></label>
      </div>
      <h4 class="np-h">فرقي المفضّلة</h4>
      <div class="np-chips">${clubs().map(c=>chip('team', c, ts.indexOf(c)>=0, c, crestOf(c))).join('')}</div>
      <div class="np-hint">${d.scope==='all' ? 'تُستخدم لأحداث «فرقي» (أهداف فرقي، البطاقات…)' : 'كل حدث مختار يصلك من مباريات هذه الفرق'}</div>
      <div class="np-comps${d.scope==='all'?' off':''}">
        <h4 class="np-h">البطولات</h4>
        ${grp('الدوري', g.league)}${grp('الكؤوس', g.cups)}${grp('المشاركات الخارجية', g.ext)}
        ${(d.scope!=='all' && !ts.length && !cs.length) ? '<div class="np-warn">اختر فريقاً أو بطولة واحدة على الأقل، وإلا فلن تصلك إشعارات المباريات</div>' : ''}
      </div>`;
  }
  function tabSounds(d){
    const opts = cat => {
      const v = (d.snd||{})[cat.k] || 'default';
      const ids = Object.keys(LIB).filter(id=>id.split('_')[0] === ({goal:'goal',yellow:'y',red:'r',var:'var',pen:'pen',kickoff:'ko',ft:'ft',lineup:'xi',sub:'sub',remind:'rem'}[cat.k]))
        .concat(Object.keys(LIB).filter(id=>['goal_mf','ko_whistle','ft_whistle','rem_bell'].indexOf(id)>=0));
      const uniq = [...new Set(ids)];
      return `<option value="default" ${v==='default'?'selected':''}>${esc(LIB[cat.def])} · افتراضي</option>`
        + uniq.map(id=>`<option value="${id}" ${v===id?'selected':''}>${esc(LIB[id])}</option>`).join('')
        + `<option value="mute" ${v==='mute'?'selected':''}>بلا صوت</option>`;
    };
    return `<div class="np-card">
        <div class="np-row"><span class="np-l">أصوات الإشعارات</span>${SW(!!d.soundOn,'data-np-g="soundOn"')}</div>
        <div class="np-row"><span class="np-l">كتم كل الإشعارات<em>تصل بلا صوت</em></span>${SW(!!d.muteAll,'data-np-g="muteAll"')}</div>
        <div class="np-row"><span class="np-l">مستوى الصوت داخل الموقع</span><input class="np-vol" type="range" min="0" max="1" step="0.05" value="${+d.vol}" data-np-vol aria-label="مستوى الصوت"></div>
        <div class="np-row"><span class="np-l">عدم الإزعاج<em>بلا صوت خلال هذه الساعات</em></span>${SW(!!d.dnd.on,'data-np-g="dnd"')}</div>
        <div class="np-dnd${d.dnd.on?'':' off'}"><label>من <input type="time" value="${esc(d.dnd.from)}" data-np-dnd="from"></label><label>إلى <input type="time" value="${esc(d.dnd.to)}" data-np-dnd="to"></label></div>
      </div>
      <h4 class="np-h">صوت كل حدث</h4>
      <div class="np-card">${SND_CAT.map(c=>`<div class="np-snd${(d.snd||{})[c.k]==='mute'?' mute':''}">
          <span class="np-l">${esc(c.t)}</span>
          <select data-np-snd="${c.k}" aria-label="صوت ${esc(c.t)}">${opts(c)}</select>
          <button type="button" class="np-play" data-np-play="${c.k}" aria-label="معاينة صوت ${esc(c.t)}"><svg viewBox="0 0 24 24" width="16" height="16"><path d="M8 5v14l11-7z" fill="currentColor"/></svg></button>
        </div>`).join('')}</div>
      <button type="button" class="np-reset" data-np-reset>استعادة الأصوات الافتراضية</button>
      <p class="np-note">الصوت المختار يُسمع والموقع أو التطبيق مفتوح. حين يكون مغلقاً يستخدم الجهاز صوت الإشعارات الخاص بالنظام — المتصفحات وتطبيق iOS الحالي لا تسمح بغيره. الكتم وعدم الإزعاج يعملان على المتصفح.</p>`;
  }

  function paint(){
    const box = document.getElementById('npSheet'); if(!box) return;
    const d = DRAFT, st = stateLine(), dirty = JSON.stringify(d) !== JSON.stringify(P);
    const body = OPEN.tab === 'matches' ? tabMatches(d) : OPEN.tab === 'sounds' ? tabSounds(d) : tabEvents(d);
    box.innerHTML = `<div class="np-panel" role="dialog" aria-modal="true" aria-label="إعدادات الإشعارات">
      <header class="np-top">
        <button type="button" class="np-x" data-np-close aria-label="إغلاق"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
        <h3>الإشعارات</h3>
      </header>
      <div class="np-master ${st.cls}">
        <span class="np-l"><b>إشعارات هذا الجهاز</b><em>${esc(st.t)}</em></span>
        ${SW(pushOn(), 'data-np-master', typeof PUSH==='undefined' || !PUSH.supported())}
      </div>
      <nav class="np-tabs" role="tablist">
        ${[['events','الأحداث'],['matches','المباريات'],['sounds','الأصوات']].map(([k,t])=>`<button type="button" role="tab" aria-selected="${OPEN.tab===k}" class="${OPEN.tab===k?'on':''}" data-np-tab="${k}">${t}</button>`).join('')}
      </nav>
      <div class="np-body">${body}</div>
      <footer class="np-foot">
        ${OPEN.tab==='events' ? '<button type="button" class="np-ghost" data-np-every="1">تحديد الكل</button><button type="button" class="np-ghost" data-np-every="0">إلغاء الكل</button>' : ''}
        <button type="button" class="np-save" data-np-save ${dirty?'':'disabled'}>${dirty?'حفظ التفضيلات':'محفوظة'}</button>
      </footer></div>`;
  }

  function onClick(ev){
    const b = ev.target.closest('button, input[type=radio]'); if(!b) { if(ev.target.id==='npSheet') close(); return; }
    const ds = b.dataset, d = DRAFT;
    if('npClose' in ds) return close();
    if(ds.npTab){ OPEN.tab = ds.npTab; return paint(); }
    if(ds.npCat){ OPEN.cat = OPEN.cat === ds.npCat ? '' : ds.npCat; return paint(); }
    if(ds.npEv){ d.ev[ds.npEv] = d.ev[ds.npEv] ? 0 : 1; return paint(); }
    if(ds.npAll || ds.npNone){ const c = CATS.find(x=>x.id===(ds.npAll||ds.npNone)); c.ev.forEach(e=>{ if(!e.na) d.ev[e.k] = ds.npAll ? 1 : 0; }); return paint(); }
    if(ds.npEvery){ CATS.forEach(c=>c.ev.forEach(e=>{ if(!e.na) d.ev[e.k] = +ds.npEvery; })); return paint(); }
    if(ds.npTeam){ const a = d.teams, i = a.indexOf(ds.npTeam); i>=0 ? a.splice(i,1) : a.push(ds.npTeam); return paint(); }
    if(ds.npComp){ const a = d.comps, i = a.indexOf(ds.npComp); i>=0 ? a.splice(i,1) : a.push(ds.npComp); return paint(); }
    if(b.name === 'np-scope'){ d.scope = b.value === 'all' ? 'all' : 'pick'; return paint(); }
    if(ds.npG){ if(ds.npG === 'dnd') d.dnd.on = d.dnd.on ? 0 : 1; else d[ds.npG] = d[ds.npG] ? 0 : 1; return paint(); }
    if(ds.npPlay){ const v = (d.snd||{})[ds.npPlay]; play(v==='mute' ? '' : soundFor(ds.npPlay, d), d.vol); return; }
    if('npReset' in ds){ d.snd = {}; d.vol = .8; d.soundOn = 1; d.muteAll = 0; return paint(); }
    if('npMaster' in ds) return master();
    if('npSave' in ds) return save();
  }
  function onInput(ev){
    const t = ev.target, d = DRAFT; if(!d) return;
    if(t.dataset.npSnd){ d.snd[t.dataset.npSnd] = t.value === 'default' ? undefined : t.value; if(t.value!=='default' && t.value!=='mute') play(t.value, d.vol); paint(); }
    else if('npVol' in t.dataset){ d.vol = +t.value; if(ev.type==='change'){ play(soundFor('goal', d), d.vol); paint(); } }
    else if(t.dataset.npDnd){ d.dnd[t.dataset.npDnd] = t.value; if(ev.type==='change') paint(); }
  }

  const say = (m, k) => { try{ if(typeof toast==='function') toast(m, k||'ok'); }catch(e){} };
  async function save(){
    const btn = document.querySelector('[data-np-save]'); if(btn){ btn.disabled = true; btn.textContent = 'جارٍ الحفظ…'; }
    DRAFT.updated = Date.now();
    P = JSON.parse(JSON.stringify(DRAFT)); _set(K, P);
    const r = await sync();
    if(r.ok) say(user() ? 'حُفظت التفضيلات في حسابك' : 'حُفظت التفضيلات على هذا الجهاز');
    else if(r.why === 'off') say('حُفظت — فعّل إشعارات هذا الجهاز ليبدأ وصولها', 'busy');
    else say('حُفظت على الجهاز، وتعذّر ربطها بالإشعارات الآن — نعيد المحاولة تلقائياً', 'err');
    DRAFT = JSON.parse(JSON.stringify(P)); paint();
  }
  async function master(){
    if(typeof PUSH === 'undefined') return;
    const want = !pushOn();
    await PUSH.toggle(want);   /* PUSH.toggle(true) ينادي NPREF.sync بعد التسجيل */
    try{ if(typeof NOTIFY!=='undefined') NOTIFY.paint(); }catch(e){}
    paint();
  }

  function open(tab){
    let box = document.getElementById('npSheet');
    if(!box){
      box = document.createElement('div'); box.id = 'npSheet'; box.className = 'np-sheet';
      box.addEventListener('click', onClick); box.addEventListener('input', onInput); box.addEventListener('change', onInput);
      document.body.appendChild(box);
    }
    DRAFT = JSON.parse(JSON.stringify(P)); OPEN = { tab: tab||'events', cat:'goal' };
    paint(); box.hidden = false; document.documentElement.classList.add('np-open');
    requestAnimationFrame(()=>box.classList.add('on'));
    addEventListener('keydown', esc_);
  }
  function esc_(e){ if(e.key === 'Escape') close(); }
  function close(){
    const box = document.getElementById('npSheet'); if(!box) return;
    if(DRAFT && JSON.stringify(DRAFT) !== JSON.stringify(P) && !confirm('لم تُحفظ التغييرات — الخروج بدون حفظ؟')) return;
    box.classList.remove('on'); document.documentElement.classList.remove('np-open');
    setTimeout(()=>{ box.hidden = true; box.innerHTML = ''; }, 200); DRAFT = null;
    removeEventListener('keydown', esc_);
  }

  function boot(){
    toSW();
    try{ navigator.serviceWorker && navigator.serviceWorker.addEventListener('message', e=>{ if(e.data && e.data.mfpush) onPush(e.data.mfpush); }); }catch(e){}
    setTimeout(()=>{ pull(); }, 6000);   /* بعد أن يستقرّ تسجيل الدخول */
  }
  addEventListener('load', ()=>setTimeout(boot, 1500));

  return { CATS, EV, LIB, SND_CAT, h, topics, sync, unsync, pull, open, close, play, soundFor, inDnd, v2, get prefs(){ return P; } };
})();
