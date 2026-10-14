/* =========================================================
   مفتاح الإشعارات في الصفحة الرئيسية — بلا تسجيل دخول
   ---------------------------------------------------------
   كان المفتاح الوحيد داخل «حسابي» في الفانتسي، وتلك الصفحة
   تطلب تسجيل دخول. فمن يتابع النتائج ولا يلعب فانتسي لم يكن
   يستطيع تفعيل الإشعارات أصلاً — وهم أغلب الزوار.

   هنا: زرّ دائم في التذييل، ودعوة لطيفة تظهر من الزيارة
   الثانية ثم لا تعود إن رُفضت. المنطق كله من fantasy/js/push.js
   (نفس المفتاح العام ونفس الموضوع) فلا تتفرّع نسختان.
   ========================================================= */
'use strict';
window.NOTIFY = {
  SEEN:'mf_nt_seen', HIDE:'mf_nt_hide', VISITS:'mf_nt_visits',

  _n(k){ try{ return +localStorage.getItem(k) || 0; }catch(e){ return 0; } },
  _s(k,v){ try{ localStorage.setItem(k, v); }catch(e){} },

  /* غلاف iOS: الإشعارات فيه أصلية لا تمرّ بالمتصفح، وإعداده غير مكتمل
     بعد — فلا نعرض مفتاحاً يَعِد بما لا يصل. */
  iosShell(){
    try{
      if(/(^|;\s*)app-platform=iOS%20App%20Store|(^|;\s*)app-platform=iOS App Store/.test(document.cookie||'')) return true;
      return /PWAShell/.test(navigator.userAgent||'');
    }catch(e){ return false; }
  },

  ready(){ return typeof PUSH !== 'undefined' && PUSH.supported && PUSH.supported(); },
  on(){ try{ return PUSH.enabled(); }catch(e){ return false; } },

  async toggle(want){
    if(!this.ready()) return;
    try{
      await PUSH.toggle(want);
      this.paint();
      if(typeof toast === 'function')
        toast(this.on() ? 'مفعّلة — يوصلك كل هدف لحظة تسجيله' : 'أُوقفت الإشعارات', this.on() ? 'ok' : 'busy');
    }catch(e){
      if(typeof toast === 'function') toast('تعذّر التفعيل — تأكد من السماح بالإشعارات في المتصفح','err');
    }
    this.hideAsk();
  },

  /* ---------- زرّ التذييل ---------- */
  chip(){
    if(this.iosShell() || !this.ready()) return '';
    const on = this.on();
    return `<button type="button" class="hchip nt${on?' on':''}" data-ntchip
      onclick="NOTIFY.toggle(${on?'false':'true'})"
      aria-pressed="${on}" title="${on?'الإشعارات مفعّلة':'فعّل إشعارات الأهداف'}">
      ${on?this.ICON_ON:this.ICON_OFF}<span>${on?'الإشعارات مفعّلة':'إشعارات الأهداف'}</span></button>`;
  },
  /* التذييل يُرسم قبل تحميل هذا الملف، فالزرّ لا يوجد بعد: نحقنه في كل
     شريط روابط ثم نحدّثه عند كل تبديل. */
  paint(){
    const html = this.chip(); if(!html) return;
    document.querySelectorAll('[data-ntchip]').forEach(el=>{
      const w = document.createElement('div'); w.innerHTML = html;
      if(w.firstElementChild) el.replaceWith(w.firstElementChild);
    });
    document.querySelectorAll('.handles').forEach(box=>{
      if(box.querySelector('[data-ntchip]')) return;
      const w = document.createElement('div'); w.innerHTML = html;
      if(w.firstElementChild) box.appendChild(w.firstElementChild);
    });
  },

  /* ---------- الدعوة ---------- */
  ICON_OFF:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
  ICON_ON :'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/><path d="M19.5 4.5 21 3M4.5 4.5 3 3"/></svg>',

  /* تظهر من الزيارة الثانية، ولا تعود بعد رفضها أو تفعيلها */
  maybeAsk(){
    if(this.iosShell() || !this.ready()) return;
    if(this.on() || this._n(this.HIDE)) return;
    if(('Notification' in window) && Notification.permission === 'denied') return;
    const v = this._n(this.VISITS) + 1; this._s(this.VISITS, v);
    if(v < 2) return;
    const box = document.getElementById('ntAsk'); if(!box) return;
    box.innerHTML = `<div class="nt-in">
        <div class="nt-ic">${this.ICON_OFF}</div>
        <div class="nt-tx"><b>يوصلك كل هدف لحظة تسجيله</b>
          <span>أهداف المباريات وصافرة النهاية — والموقع مغلق</span></div>
        <button type="button" class="nt-yes" onclick="NOTIFY.toggle(true)">فعّل</button>
        <button type="button" class="nt-no" aria-label="لاحقاً" onclick="NOTIFY.dismiss()">✕</button>
      </div>`;
    box.hidden = false; requestAnimationFrame(()=>box.classList.add('on'));
  },
  hideAsk(){ const b=document.getElementById('ntAsk'); if(b){ b.classList.remove('on'); b.hidden=true; b.innerHTML=''; } },
  dismiss(){ this._s(this.HIDE,1); this.hideAsk(); },

  boot(){
    if(!this.ready()) return;
    this.paint();
    setInterval(()=>{ try{ this.paint(); }catch(e){} }, 2500);   /* التذييل يُعاد رسمه عند تبديل الأقسام */
    setTimeout(()=>this.maybeAsk(), 4000);   /* بعد أن تستقرّ الصفحة، لا فور الفتح */
  }
};
addEventListener('load', ()=>setTimeout(()=>{ try{ NOTIFY.boot(); }catch(e){} }, 1200));
