/* =========================================================
   الإشعارات الفورية — تصل والتطبيق مغلق، بخلاف REMIND الذي
   يحتاج تبويباً مفتوحاً.

   المرحلة الأولى: تسجيل الجهاز لدى Firebase Cloud Messaging فقط.
   الإرسال يدوي من Firebase Console (حملة تستهدف تطبيق الويب)،
   فلا خادم ولا قواعد جديدة ولا تخزين رموز.

   لا نُسجّل خادم خدمة ثانياً: sw.js وحده يملك النطاق، ونمرّر
   تسجيله إلى getToken — فخادمان على نطاق واحد يتنازعان السيطرة.
   ========================================================= */
'use strict';

const PUSH = {
  /* مفتاح عام (VAPID). يُرسَل للمتصفح في كل اشتراك، فلا سرّ فيه. */
  VAPID: 'BAVv3qsgIXCBYPmOLQFtooiqHpsJxdAD5VWfuhSNZggDMseBaxQUnK7ZPpFhXpFTb__lJYPFFl5KYaBIKvrIej8',
  KEY: 'kwf_push',

  /* غلاف iOS له FCM أصلي لا يمرّ بالمتصفح، لكن ملف إعداداته في
     النسخة المنشورة يشير إلى مشروع قالب PWABuilder لا إلى مشروعنا،
     فلا يصله شيء. نخفي المفتاح هناك بدل وعد كاذب. */
  iosApp(){ return typeof CLOUD!=='undefined' && CLOUD.isIOSApp && CLOUD.isIOSApp(); },

  supported(){
    try{
      if(this.iosApp()) return false;
      if(!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return false;
      if(typeof firebase==='undefined' || !firebase.messaging) return false;
      return firebase.messaging.isSupported ? firebase.messaging.isSupported() : true;
    }catch(e){ return false; }
  },

  enabled(){ try{ return localStorage.getItem(this.KEY)==='1'; }catch(e){ return false; } },

  /* الرمز يُجدَّد من تلقاء المتصفح؛ نعيد الطلب عند كل إقلاع لتبقى
     الأجهزة النشطة معروفة لدى FCM ولا تُعدّ خاملة. */
  async refresh(){
    if(!this.enabled() || !this.supported()) return;
    if(Notification.permission !== 'granted'){ this._off(); return; }
    try{ await this._token(); }catch(e){ /* صامت — لا نزعج المستخدم عند الإقلاع */ }
  },

  /* صفحة الفانتسي لا تسجّل sw.js — التسجيل في الصفحة الرئيسية وحدها.
     فمن يفتح /fantasy/ مباشرة لا خادم خدمة لديه، و`ready` تنتظر للأبد
     بلا خطأ. نسجّله هنا إن غاب، ونضع سقفاً زمنياً حتى لا يتجمّد الزر. */
  async _reg(){
    let reg = await navigator.serviceWorker.getRegistration('/');
    if(!reg) reg = await navigator.serviceWorker.register('/sw.js', {scope:'/'});
    if(reg.active) return reg;
    await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_,rej)=>setTimeout(()=>rej(new Error('sw-timeout')), 10000))
    ]);
    return (await navigator.serviceWorker.getRegistration('/')) || reg;
  },

  async _token(){
    const reg = await this._reg();
    return await firebase.messaging().getToken({ vapidKey: this.VAPID, serviceWorkerRegistration: reg });
  },

  _off(){ try{ localStorage.setItem(this.KEY,''); }catch(e){} },

  async toggle(on){
    if(!on){
      this._off();
      try{ await firebase.messaging().deleteToken(); }catch(e){}
      UI.toast('أُوقفت الإشعارات');
      APP.render(); return;
    }
    if(!this.supported()){ UI.toast('هذا المتصفح لا يدعم الإشعارات الفورية', true); APP.render(); return; }
    try{
      const perm = await Notification.requestPermission();
      if(perm !== 'granted'){
        UI.toast('لم يُسمح بالإشعارات — فعّلها من إعدادات المتصفح لهذا الموقع', true);
        APP.render(); return;
      }
      const t = await this._token();
      if(!t){ UI.toast('تعذّر تسجيل الجهاز — أعد المحاولة', true); APP.render(); return; }
      try{ localStorage.setItem(this.KEY,'1'); }catch(e){}
      UI.toast('تم التفعيل — يصلك إشعار بأهداف المباريات وإغلاق الجولة');
    }catch(e){
      console.warn('push enable failed', e);
      UI.toast('تعذّر تفعيل الإشعارات — تأكد من أن المتصفح يسمح بها', true);
    }
    APP.render();
  },

  /* بطاقة الإعدادات — تُعرض بجانب بطاقة REMIND */
  card(){
    if(this.iosApp()) return `<div class="card"><h3>الإشعارات الفورية</h3>
      <div class="tiny" style="color:var(--text3)">ستتوفّر داخل التطبيق في التحديث القادم. حالياً تعمل على الموقع في Safari و Chrome.</div></div>`;
    const sup = this.supported();
    const denied = ('Notification' in window) && Notification.permission==='denied';
    return `<div class="card"><h3>الإشعارات الفورية</h3>
      <label class="row" style="gap:10px;cursor:pointer;align-items:center">
        <input type="checkbox" style="width:20px;height:20px;accent-color:var(--accent)" ${this.enabled()?'checked':''} ${sup?'':'disabled'} onchange="PUSH.toggle(this.checked)">
        <span>أهداف المباريات وإغلاق الجولة — تصلك والتطبيق مغلق</span></label>
      <div class="tiny" style="margin-top:6px;color:var(--text3)">${
        !sup ? 'هذا المتصفح لا يدعمها. على الآيفون: افتح الموقع في Safari ثم «إضافة إلى الشاشة الرئيسية» وفعّلها من هناك.'
        : denied ? 'حجبتَ الإشعارات سابقاً لهذا الموقع — أعد السماح من إعدادات المتصفح ثم فعّل المفتاح.'
        : 'تختلف عن التنبيه أعلاه: هذا يصلك حتى لو أغلقت المتصفح تماماً.'}</div>
    </div>`;
  },
};
