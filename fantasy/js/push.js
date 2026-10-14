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

  /* هذا الملف يُحمَّل في الفانتسي وفي الصفحة الرئيسية معاً، والأخيرة
     لا تعرف UI ولا APP — فننادي ما وُجد فقط. */
  _say(msg, bad){
    try{ if(typeof UI!=='undefined' && UI.toast) return UI.toast(msg, bad); }catch(e){}
    try{ if(typeof toast==='function') return toast(msg, bad?'err':'ok'); }catch(e){}
  },
  _re(){
    try{ if(typeof APP!=='undefined' && APP.render) APP.render(); }catch(e){}
    try{ if(typeof NOTIFY!=='undefined' && NOTIFY.paint) NOTIFY.paint(); }catch(e){}
  },

  /* غلاف iOS: الإشعارات فيه أصلية (APNs عبر FCM) لا تمرّ بالمتصفح،
     ويكلّمها جسر WKScriptMessage. ربطناه بمشروعنا في 2026-10-14 بعد
     أن كان ملف الإعداد قالب PWABuilder فلا يصل شيء. */
  iosApp(){
    try{
      if(typeof CLOUD!=='undefined' && CLOUD.isIOSApp) return CLOUD.isIOSApp();
      if(/(^|;\s*)app-platform=iOS%20App%20Store|(^|;\s*)app-platform=iOS App Store/.test(document.cookie||'')) return true;
      return /PWAShell/.test(navigator.userAgent||'');
    }catch(e){ return false; }
  },
  /* الجسر موجود في التطبيق فقط؛ النسخ القديمة قبل هذا التحديث بلا إعداد صحيح */
  iosBridge(){
    try{ return !!(window.webkit && window.webkit.messageHandlers
                   && window.webkit.messageHandlers['push-subscribe']); }catch(e){ return false; }
  },
  _ios: {
    send(name, payload){
      try{ window.webkit.messageHandlers[name].postMessage(payload===undefined?'':payload); return true; }
      catch(e){ return false; }
    },
    /* Swift يردّ بحدث على window؛ سقف زمني حتى لا يتجمّد المفتاح */
    once(ev, ms){
      return new Promise(res=>{
        let done=false;
        const h=e=>{ if(done) return; done=true; removeEventListener(ev,h); res(e && e.detail); };
        addEventListener(ev,h);
        setTimeout(()=>{ if(done) return; done=true; removeEventListener(ev,h); res(null); }, ms||9000);
      });
    },
    async ask(){ const p=this.once('push-permission-request', 60000); this.send('push-permission-request'); return await p; },
    async token(){ const p=this.once('push-token', 15000); this.send('push-token'); return await p; },
    topic(sub){ return this.send('push-subscribe', JSON.stringify({ topic:'all', unsubscribe: !sub })); }
  },

  supported(){
    try{
      if(this.iosApp()) return this.iosBridge();
      if(!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return false;
      if(typeof firebase==='undefined' || !firebase.messaging) return false;
      return firebase.messaging.isSupported ? firebase.messaging.isSupported() : true;
    }catch(e){ return false; }
  },

  enabled(){ try{ return localStorage.getItem(this.KEY)==='1'; }catch(e){ return false; } },

  /* الرمز يُجدَّد من تلقاء المتصفح؛ نعيد الطلب عند كل إقلاع لتبقى
     الأجهزة النشطة معروفة لدى FCM ولا تُعدّ خاملة. */
  async refresh(){
    if(!this.enabled()) return;
    if(this.iosApp()){ if(this.iosBridge()) this._ios.topic(true); return; }
    if(!this.supported()) return;
    if(Notification.permission !== 'granted'){ this._off(); return; }
    try{ const t = await this._token(); if(t) await this._topic(t, false); }
    catch(e){ /* صامت — لا نزعج المستخدم عند الإقلاع */ }
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

  /* الاشتراك في موضوع لا يمكن من العميل — يتطلّب صلاحية الخادم،
     فتتولّاه دالة Netlify. فشلُه لا يُبطل التفعيل: الرمز مسجّل لدى
     FCM على كل حال، ويُعاد المحاولة عند كل إقلاع. */
  async _topic(token, unsubscribe){
    try{
      const r = await fetch('/.netlify/functions/push-subscribe', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ token, unsubscribe: !!unsubscribe })
      });
      return r.ok;
    }catch(e){ return false; }
  },

  async toggle(on){
    if(this.iosApp()) return await this._toggleIOS(on);
    if(!on){
      this._off();
      /* نُلغي الاشتراك قبل حذف الرمز — بعد الحذف لا يبقى ما نُلغيه */
      try{ const t = await this._token(); if(t) await this._topic(t, true); }catch(e){}
      try{ await firebase.messaging().deleteToken(); }catch(e){}
      this._say('أُوقفت الإشعارات');
      this._re(); return;
    }
    if(!this.supported()){ this._say('هذا المتصفح لا يدعم الإشعارات الفورية', true); this._re(); return; }
    try{
      const perm = await Notification.requestPermission();
      if(perm !== 'granted'){
        this._say('لم يُسمح بالإشعارات — فعّلها من إعدادات المتصفح لهذا الموقع', true);
        this._re(); return;
      }
      const t = await this._token();
      if(!t){ this._say('تعذّر تسجيل الجهاز — أعد المحاولة', true); this._re(); return; }
      await this._topic(t, false);
      try{ localStorage.setItem(this.KEY,'1'); }catch(e){}
      this._say('تم التفعيل — يصلك إشعار بأهداف المباريات وإغلاق الجولة');
    }catch(e){
      console.warn('push enable failed', e);
      this._say('تعذّر تفعيل الإشعارات — تأكد من أن المتصفح يسمح بها', true);
    }
    this._re();
  },

  /* داخل التطبيق: الإذن والرمز والاشتراك كلها من الطبقة الأصلية.
     لا VAPID ولا خادم خدمة ولا دالة Netlify — Swift يشترك مباشرة. */
  async _toggleIOS(on){
    if(!this.iosBridge()){
      this._say('حدّث التطبيق من App Store لتفعيل الإشعارات', true); this._re(); return;
    }
    if(!on){
      this._off();
      this._ios.topic(false);
      this._say('أُوقفت الإشعارات'); this._re(); return;
    }
    try{
      const perm = await this._ios.ask();
      if(perm !== 'granted'){
        this._say('لم يُسمح بالإشعارات — فعّلها من إعدادات الجهاز لتطبيق mfsoccer', true);
        this._re(); return;
      }
      const t = await this._ios.token();
      if(!t || t === 'ERROR GET TOKEN'){
        this._say('تعذّر تسجيل الجهاز — أعد المحاولة', true); this._re(); return;
      }
      this._ios.topic(true);
      try{ localStorage.setItem(this.KEY,'1'); }catch(e){}
      this._say('تم التفعيل — يصلك إشعار بأهداف المباريات');
    }catch(e){
      this._say('تعذّر تفعيل الإشعارات', true);
    }
    this._re();
  },

  /* بطاقة الإعدادات — تُعرض بجانب بطاقة REMIND */
  card(){
    if(this.iosApp() && !this.iosBridge()) return `<div class="card"><h3>الإشعارات الفورية</h3>
      <div class="tiny" style="color:var(--text3)">حدّث التطبيق من App Store لتفعيلها.</div></div>`;
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
