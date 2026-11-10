/* =========================================================
   حضور فريق العمل — نبضة صامتة
   ---------------------------------------------------------
   يكتب وثيقة واحدة لصاحبها: presence/<uid> فيها أين يعمل
   الآن ومتى آخر نبضة. تقرأها لوحة «مركز التحكم» فتعرف من
   متصل. لا تقرأ هذه النبضة شيئاً ولا تكتب على أي وثيقة
   قائمة، ولا تلمس الواجهة ولا بيانات المباريات.

   مبدأ التصميم: ملف منفصل بـdefer. أي خطأ فيه — صياغة أو
   تنفيذ — يموت داخله ولا يمسّ سكربتات index.html المضمّنة.
   وكل نداء مغلّف بـtry/catch صامت: لا toast ولا throw.

   قيود مقصودة:
   · فريق العمل فقط (المالك أو عضو في STAFF) — لا المشجعون.
   · النبض وقت ظهور التبويب فقط؛ التبويب في الخلفية لا ينبض،
     فلا يُستنزف حدّ الكتابات ولا يظهر أحد «متصلاً» وهو نائم.
   · نبضة كل ٦٠ ثانية. القارئ يعدّ من تجاوزت نبضته ١٥٠ ثانية
     منقطعاً — ضعف الفترة وزيادة، فلا يومض أحد بين النبضتين.
   (منصور 2026-11-10)
   ========================================================= */
'use strict';
(function(){
  const EVERY = 60000;          /* كل دقيقة */
  let timer = null, last = 0;

  /* الحالة من المتغيّرات العامة — وهي معرَّفة بـlet/const في index.html
     فلا توجد على window؛ typeof هو الطريق الوحيد لفحصها بأمان. */
  const db   = () => (typeof fbDb   !== 'undefined') ? fbDb   : null;
  const user = () => (typeof FBUSER !== 'undefined') ? FBUSER : null;

  function staff(u){
    try{
      if(typeof ADMIN_UID !== 'undefined' && u.uid === ADMIN_UID) return {name:'', perm:'full'};
      const s = (typeof STAFF !== 'undefined' && STAFF) ? STAFF[u.uid] : null;
      return (s && s.active !== false) ? s : null;
    }catch(e){ return null; }
  }

  /* أين هو الآن — من إشارتين للقراءة فقط، بلا ربط بدواخل الأدوات:
     أداة اللعب الفعلي تضع #effctl/<مفتاح> في العنوان، ومحرّر
     المباراة يملأ EDIT. وما عداهما: القسم الظاهر في الصفحة. */
  function place(){
    try{
      if(/^#effctl\//.test(location.hash || '')) return 'eff';
      if(typeof EDIT !== 'undefined' && EDIT) return 'rasad';
      const v = document.querySelector('.view.on');
      return v ? v.id.replace(/^v-/, '') : 'site';
    }catch(e){ return 'site'; }
  }

  async function beat(force){
    try{
      if(document.visibilityState !== 'visible') return;
      if(!force && Date.now() - last < EVERY - 2000) return;   /* لا نبضتين متلاصقتين */
      const d = db(), u = user(); if(!d || !u) return;
      const me = staff(u); if(!me) return;
      last = Date.now();
      await d.collection('presence').doc(u.uid).set({
        name:  me.name || u.displayName || '',
        email: u.email || '',
        perm:  (me.perm === 'matches') ? 'matches' : 'full',
        where: place(),
        at:    firebase.firestore.FieldValue.serverTimestamp()
      }, {merge:true});
    }catch(e){ /* صامت عمداً: الحضور ترف، وفشله لا يُقلق أحداً */ }
  }

  function start(){
    try{
      if(timer) return;
      timer = setInterval(()=>{ beat(false); }, EVERY);
      beat(true);
    }catch(e){}
  }

  /* الإقلاع متأخر: ننتظر استقرار الدخول بدل مزاحمة أول رسم للصفحة */
  try{
    addEventListener('load', ()=>setTimeout(start, 6000));
    addEventListener('visibilitychange', ()=>{ if(document.visibilityState === 'visible') beat(true); });
    /* إغلاق التبويب: محاولة أخيرة تُخرجه فوراً بدل انتظار المهلة.
       قد لا تكتمل — ومهلة الـ١٥٠ ثانية هي الضمان على أي حال. */
    addEventListener('pagehide', ()=>{
      try{
        const d = db(), u = user();
        if(d && u && staff(u)) d.collection('presence').doc(u.uid).set({out:true}, {merge:true});
      }catch(e){}
    });
  }catch(e){}
})();
