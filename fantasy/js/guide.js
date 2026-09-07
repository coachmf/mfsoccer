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
      created:new Date().toISOString(), status:'new' };
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
  async submit(ev){
    const btn=ev&&ev.target; const type=gv('fb_type'), text=gv('fb_text');
    if(btn){ btn.disabled=true; btn.textContent='جارٍ الإرسال…'; }
    const r=await this.send(type, text);
    if(btn){ btn.disabled=false; btn.textContent='إرسال'; }
    if(r.ok){
      const ta=document.getElementById('fb_text'); if(ta) ta.value='';
      UI.modal(`<h3>وصل اقتراحك</h3><p class="muted">شكراً — يقرأ المطوّر كل الاقتراحات ويُطبَّق المناسب منها في التحديثات.</p>
        <button class="btn" style="width:100%" onclick="UI.closeModal()">تمام</button>`);
    } else UI.toast(r.err, true);
  },
};

function appVersion(){ return (document.querySelector('script[src*="app.js"]')?.src.match(/v=(\d+)/)||[])[1]||''; }

Object.assign(VIEWS, {
  /* ======================= عن اللعبة والقوانين ======================= */
  guide(){
    const st=DB.state, R=st.rules, S=st.scoring;
    const row=(k)=>S[k]? `<tr><td>${esc(S[k].label)}</td><td class="num" style="color:${S[k].val<0?'var(--red)':'var(--accent)'}">${S[k].val>0?'+':''}${S[k].val}</td></tr>` : '';
    const groups=[
      ['المشاركة', ['appearance','appearance60']],
      ['الأهداف والصناعة', ['goalG','goalD','goalM','goalF','assist']],
      ['الدفاع', ['csG','csD','csM','concededPer2','penSave']],
      ['خصومات', ['penMiss','ownGoal','yellow','red']],
    ];
    const known=new Set(groups.flatMap(g=>g[1]));
    const extra=Object.keys(S).filter(k=>!known.has(k));
    const chips=Object.entries(R.chips||{}).filter(([k,c])=>c.enabled);
    const sec=(title,body)=>`<div class="card" style="margin-bottom:12px"><h3>${title}</h3><div class="muted" style="line-height:2">${body}</div></div>`;
    const li=arr=>`<ul style="margin:6px 0 0;padding-inline-start:20px">${arr.map(x=>`<li>${x}</li>`).join('')}</ul>`;
    return `<div class="row spread" style="margin-bottom:12px;flex-wrap:wrap;gap:8px"><h2>عن اللعبة</h2>
      <button class="btn sm sec" onclick="APP.go('about')">المطوّر والاقتراحات</button></div>

      ${sec('نبذة', `<b>فانتسي الدوري الكويتي</b> لعبة فانتسي بلاعبي الدوري الكويتي:
        تكوّن فريقاً من 15 لاعباً حقيقياً بميزانية محدودة، تختار تشكيلتك وكابتنك قبل كل جولة،
        وتجمع نقاطاً من أداء لاعبيك الفعلي في مباريات الدوري (أهداف، صناعة، شباك نظيفة…).
        تنافس في الترتيب العام وفي دوريات خاصة مع أصحابك.`)}

      ${sec('فريق العمل وضمان الجودة', `احتساب النقاط في هذه اللعبة عمل جماعي بالتعاون مع فريق موقع <b>mfsoccer.com</b>:
        نتابع كل مباراة في الدوري، وتُسجَّل التشكيلات والتبديلات والأهداف والصناعة والكروت وركلات الجزاء
        <b>يدوياً</b> أثناء المباراة وبعدها، ثم تُراجع قبل اعتماد الجولة. لا توليد ولا تقدير — كل رقم في اللعبة
        من متابعة بشرية للمباراة، وأي خطأ يُكتشف يُصحَّح وتُعاد نقاط الجميع بأثر رجعي.
        لاحظت خطأً في اسم لاعب أو دقيقة أو نتيجة؟ أبلغنا من صفحة <a href="#about" onclick="APP.go('about');return false;">المطوّر والاقتراحات</a>.`)}

      ${sec('كيف تلعب', li([
        `<b>كوّن فريقك:</b> ${R.squadSize} لاعباً — ${R.posCount.G} حارسان، ${R.posCount.D} مدافعين، ${R.posCount.M} لاعبي وسط، ${R.posCount.F} مهاجمين — بميزانية ${fmtM(R.budget)} مليون، وبحد أقصى ${R.maxPerClub} لاعبين من النادي الواحد.`,
        `<b>اختر تشكيلة الجولة:</b> 11 أساسياً و4 على الدكة بترتيب الأولوية. الخطة حرة ضمن الحدود: ${R.formationMin.D}–${R.formationMax.D} مدافعين، ${R.formationMin.M}–${R.formationMax.M} وسط، ${R.formationMin.F}–${R.formationMax.F} مهاجمين، وحارس واحد.`,
        `<b>عيّن الكابتن ونائبه:</b> نقاط الكابتن تُضاعف (×2). إن لم يشارك الكابتن انتقلت المضاعفة للنائب تلقائياً.`,
        `<b>قبل موعد الإغلاق:</b> كل جولة تُقفل مع انطلاق أول مباراة فيها — لك حرية التغيير حتى تلك اللحظة. بعد الموعد لا يمكن تعديل التشكيلة حتى تُحتسب الجولة.`,
        `<b>أنشئ حساباً:</b> بلا حساب يبقى فريقك على جهازك فقط ولا تُحتسب له نقاط. بالحساب يتبعك فريقك على كل أجهزتك ويدخل الترتيب.`,
      ]))}

      ${sec('الانتقالات', li((R.freeChanges? [
        `<b>تغييرات حرة:</b> بدّل من تشكيلتك ولاعبيك كما تشاء قبل موعد الإغلاق <b>بلا أي خصم نقاط</b>.`,
        `الأسعار تتغيّر بعد كل جولة بمقدار ${R.priceRise} حسب صافي شراء وبيع المشتركين — البيع بسعر اللاعب الحالي.`,
        `التغييرات تُقفل مع بداية الجولة؛ بين الموعد والاحتساب تكون موقوفة، ثم تُفتح بعد احتساب النتائج.`,
      ] : [
        `لك <b>${R.freeTransfers}</b> انتقال مجاني كل جولة، ويمكن تجميعها حتى <b>${R.maxSavedTransfers}</b>.`,
        `كل انتقال إضافي فوق المجاني يخصم <b>${R.transferCost}</b> نقاط من نقاط الجولة التالية.`,
        `الأسعار تتغيّر بعد كل جولة بمقدار ${R.priceRise} حسب صافي شراء وبيع المشتركين الفعلي — البيع بسعر اللاعب الحالي.`,
        `الانتقالات تُنفَّذ فوراً وتُقفل مع الجولة؛ بين الموعد والاحتساب تكون الانتقالات موقوفة.`,
      ])))}

      ${sec('الكروت الخاصة', `تُفعَّل من شاشة «فريقي» قبل الموعد، كرت واحد في الجولة:` + li(chips.map(([k,c])=>`<b>${esc(c.label)}</b> — ${esc(c.desc)} (${c.uses>1? c.uses+' مرات' : 'مرة واحدة'} في الموسم).`)))}

      <div class="card" style="margin-bottom:12px"><h3>نظام النقاط</h3>
        <div class="tiny" style="margin-bottom:8px">تُحتسب لكل لاعب في كل مباراة يشارك فيها، ثم تُجمع لتشكيلتك الأساسية (والكابتن مضاعف).</div>
        <div class="grid g2">
          ${groups.map(([t,keys])=>`<div><div class="tiny" style="font-weight:800;margin:6px 0">${t}</div><div class="scroll-x"><table class="tbl">${keys.map(row).join('')}</table></div></div>`).join('')}
          ${extra.length? `<div><div class="tiny" style="font-weight:800;margin:6px 0">أخرى</div><div class="scroll-x"><table class="tbl">${extra.map(row).join('')}</table></div></div>`:''}
        </div>
        <div class="muted" style="line-height:2;margin-top:10px">
          ${li([
            `<b>الشباك النظيفة</b> تُمنح لمن لعب 60 دقيقة فأكثر ولم يستقبل فريقه هدفاً وهو في الملعب.`,
            `<b>الأهداف المستقبلة</b> تُحسب على الحارس والمدافع فقط أثناء وجوده في الملعب (كل هدفين ${S.concededPer2? S.concededPer2.val:''}).`,
            `<b>الطرد بإنذارين</b> يُحتسب بطاقة حمراء واحدة (لا يُجمع مع الصفراء).`,
            `<b>البونص</b> (3/2/1 لأفضل ثلاثة في المباراة) يُدخل من الإدارة عند توفره.`,
          ])}
        </div>
      </div>

      ${sec('التبديل التلقائي والدكة', li([
        `إذا لم يشارك لاعب أساسي (صفر دقيقة) يحلّ محله أول بديل من الدكة يحفظ الخطة صالحة، بترتيب الدكة.`,
        `الحارس البديل لا يدخل إلا مكان الحارس الأساسي.`,
        `نقاط الدكة لا تُحتسب إلا بكرت «دكة قوية».`,
      ]))}

      ${sec('الاحتساب والترتيب', li([
        `بعد آخر مباراة في الجولة تُسحب النتائج من mfsoccer وتُحتسب نقاط كل المشتركين دفعة واحدة على الخادم، ثم تُفتح الجولة التالية.`,
        `الترتيب العام بمجموع النقاط. الدوريات الخاصة: كلاسيكية (مجموع النقاط من جولة الإنشاء) أو مواجهات H2H (3 نقاط للفوز، 1 للتعادل).`,
        `الجولة التي لم ينشر الموقع جدولها تظهر فارغة وبلا موعد إغلاق — التشكيلة تبقى مفتوحة حتى يصدر الجدول.`,
        `عند تصحيح نتيجة مباراة بعد الاحتساب تُصحَّح نقاط الجميع بأثر رجعي.`,
      ]))}

      <div class="card"><h3>لديك اقتراح أو لاحظت خطأ؟</h3>
        <div class="muted" style="line-height:1.9">صفحة المطوّر فيها صندوق الاقتراحات وروابط التواصل.</div>
        <div style="margin-top:10px"><button class="btn sm" onclick="APP.go('about')">الاقتراحات والتواصل</button></div>
      </div>`;
  },

  /* ======================= المطوّر والاقتراحات ======================= */
  about(){
    const m=DB.me();
    FEEDBACK.flush();
    return `<h2 style="margin-bottom:12px">المطوّر والاقتراحات</h2>
      ${this.devCard(false)}
      <div class="grid g2" style="margin-top:12px">
        <div class="card"><h3>اقتراحاتك على الفانتسي</h3>
          <div class="tiny" style="margin-bottom:10px">فكرة، مشكلة، خطأ في اسم لاعب أو نتيجة — اكتبها هنا وتصل <b>لفريق العمل</b> مباشرة، ويُبلَّغ كل أعضاء الفريق بها.
</div>
          <div class="field"><label>النوع</label><select id="fb_type">${FEEDBACK.TYPES.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></div>
          <div class="field"><label>الرسالة</label><textarea id="fb_text" rows="5" maxlength="1500" placeholder="اكتب اقتراحك أو المشكلة بالتفصيل…" style="width:100%;resize:vertical"></textarea></div>
          <button class="btn" style="width:100%" onclick="FEEDBACK.submit(event)">إرسال</button>
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
  const n = list.filter(f=>(f.status||'new')==='new').length;
  const changed = n!==this.unseen; this.unseen = n;
  const m = DB.me();
  if(n>0 && m){
    const key='fb'+n+'_'+(list.find(f=>(f.status||'new')==='new')||{}).id;
    DB.state.notifications[m.id]=DB.state.notifications[m.id]||[];
    if(!DB.state.notifications[m.id].some(x=>x.type===key)){
      NOTIF.push(m.id, key, `${n} اقتراح جديد من المشتركين — الإدارة ← الاقتراحات`);
      try{ localStorage.setItem(DB.KEY, JSON.stringify(DB.state)); }catch(e){}
      if(typeof APP!=='undefined') APP.renderTopbar();
    }
  }
  if(changed && typeof APP!=='undefined' && APP.route==='admin') APP.render();
};
setTimeout(()=>FEEDBACK.poll(), 4000);
setInterval(()=>FEEDBACK.poll(), 5*60000);

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
      el.innerHTML=`<div class="scroll-x"><table class="tbl"><tr><th>التاريخ</th><th>النوع</th><th>من</th><th>الرسالة</th><th>الحالة</th></tr>
        ${list.map(f=>`<tr style="${f.status==='done'?'opacity:.55':''}">
          <td class="tiny" style="white-space:nowrap">${UI.fmtDateShort(f.created)}</td>
          <td><span class="pill ${f.type==='bug'||f.type==='data'?'red':'blue'}">${T[f.type]||f.type}</span></td>
          <td class="tiny">${esc(f.username||'ضيف')}${f.teamName?`<br>${esc(f.teamName)}`:''}</td>
          <td style="max-width:420px;white-space:pre-wrap;line-height:1.7">${esc(f.text)}</td>
          <td><select onchange="FEEDBACK.setStatus('${f.id}',this.value).then(ok=>{UI.toast(ok?'حُدّثت':'تعذّر التحديث',!ok); FEEDBACK.poll();})">
            ${[['new','جديد'],['seen','مقروء'],['done','منفّذ'],['rejected','مرفوض']].map(([v,l])=>`<option value="${v}" ${f.status===v?'selected':''}>${l}</option>`).join('')}
          </select></td></tr>`).join('')}</table></div>`;
    },50);
    return `<div class="card"><h3>اقتراحات المشتركين</h3>
      <div class="tiny" style="margin-bottom:10px">ما يرسله المشتركون من صفحة «المطوّر والاقتراحات» — مخزّن في fantasy/الموسم/feedback.</div>
      <div id="${id}"><div class="muted">جارٍ التحميل…</div></div></div>`;
  };
}
