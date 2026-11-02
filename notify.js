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

  /* غلاف iOS القديم (قبل 1.0.4) بلا جسر الإشعارات الأصلي — فلا نعرض مفتاحاً يَعِد بما لا يصل.
     من 1.0.4 (15 أكتوبر) الجسر موجود فيظهر المفتاح في الصفحة الرئيسية أيضاً، لا في «حسابي» بالفانتسي وحدها (منصور 2026-11-02) */
  iosShell(){
    try{
      if(typeof PUSH!=="undefined" && PUSH.iosBridge && PUSH.iosBridge()) return false;
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
      /* فشل التفعيل: PUSH قال السبب في رسالته — لا نغطيه بـ«أُوقفت» (منصور 2026-11-02: الجرس يقول أوقفت وهو ما فعّل) */
      if(want && !this.on()) return;
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
  /* جرس في الشريط العلوي بجانب البحث: ضغطة تفعّل الإشعارات أو توقفها (منصور 2026-11-02) */
  bell(){
    const tools = document.querySelector('.mf-top .mf-tools'); if(!tools) return;
    let b = tools.querySelector('[data-ntbell]');
    if(this.iosShell() || !this.ready()){ if(b) b.remove(); return; }
    const on = this.on(), t = on ? 'الإشعارات مفعّلة — اضغط للإيقاف' : 'فعّل الإشعارات';
    if(!b){
      b = document.createElement('button'); b.type = 'button'; b.className = 'mf-ib mf-bell'; b.setAttribute('data-ntbell','');
      b.addEventListener('click', ()=>this.toggle(!this.on()));
      const s = tools.querySelector('[data-mf="search"]'); s ? s.after(b) : tools.prepend(b);
    }
    if(b.dataset.on === String(on)) return;
    b.dataset.on = String(on); b.classList.toggle('on', on);
    b.title = t; b.setAttribute('aria-label', t); b.setAttribute('aria-pressed', String(on));
    b.innerHTML = on ? this.ICON_ON : this.ICON_OFF;
  },
  paint(){
    this.bell();
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

  /* الدعوة: في التطبيق من أول فتحة، وفي المتصفح من الزيارة الثانية. إن لم تُفعَّل تعود بعد 3 أيام،
     ثلاث مرات كحد أقصى، ولا تعود أبداً بعد التفعيل (منصور 2026-11-02: «خله عملي اكثر مره ثانيه اسال») */
  ASKN:'mf_nt_askn', ASKT:'mf_nt_askt', ASK_MAX:3, ASK_GAP:3*864e5,
  maybeAsk(){
    if(this.iosShell() || !this.ready()) return;
    if(this.on()) return;
    const app = typeof PUSH!=="undefined" && PUSH.iosApp && PUSH.iosApp();
    if(!app && ('Notification' in window) && Notification.permission === 'denied') return;   /* المتصفح لا يعيد السؤال بعد الرفض */
    const v = this._n(this.VISITS) + 1; this._s(this.VISITS, v);
    if(v < (app ? 1 : 2)) return;
    /* من رفض بالنسخة السابقة (مفتاح HIDE) تُحسب له مرة واحدة الآن */
    if(this._n(this.HIDE) && !this._n(this.ASKT)){ this._s(this.ASKN, 1); this._s(this.ASKT, Date.now()); }
    const n = this._n(this.ASKN), t = this._n(this.ASKT);
    if(n >= this.ASK_MAX || (t && Date.now() - t < this.ASK_GAP)) return;
    this._s(this.ASKN, n + 1); this._s(this.ASKT, Date.now());
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
  dismiss(){ this.hideAsk(); },   /* العدّ والتوقيت سُجّلا عند الظهور */

  boot(){
    if(!this.ready()) return;
    this.paint();
    setInterval(()=>{ try{ this.paint(); }catch(e){} }, 2500);   /* التذييل يُعاد رسمه عند تبديل الأقسام */
    setTimeout(()=>this.maybeAsk(), 4000);   /* بعد أن تستقرّ الصفحة، لا فور الفتح */
  }
};
addEventListener('load', ()=>setTimeout(()=>{ try{ NOTIFY.boot(); }catch(e){} }, 1200));
