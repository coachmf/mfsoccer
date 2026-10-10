/* =========================================================
   mfsoccer — لغات إضافية فوق محرك الإنجليزية (الموقع والفانتسي)
   البرتغالية بنسختين: البرازيل (pt-BR) والبرتغال (pt-PT)، والإسبانية (es)،
   و BCMS (البوسنية/الكرواتية/الجبل الأسود/الصربية) لغة واحدة (sh: لاتينية، نطق ijekavski، بلا علم — شارة BCMS) (منصور 2026-10-10).
   الفكرة: المحرك الأصلي يترجم العربية ← الإنجليزية كما هو، ثم كل ناتج
   إنجليزي يمر على قاموس اللغة في I18N_PT (إنجليزي ← BR/PT/ES/SH، من i18n-data.js).
   ما ليس في القاموس يبقى بالإنجليزية (لا يرجع عربياً).
   الرمز ⟨x⟩ في مفاتيح I18N_PT جزء متغير (رقم/اسم/HTML) يُترجم بدوره.
   الاختيار مشترك بين الموقع (mf_lang) والفانتسي (kwf_lang).
   قائمة اللغات: زر اللغة يفتح قائمة بالأعلام (منصور 2026-10-10).
   ========================================================= */
(function(){
  'use strict';
  if(typeof I18N === 'undefined') return;

  /* إضافات الإنجليزية المشتركة (أسماء كأس الخليج، الملاعب، نصوص ناقصة) — لا تغيّر مفتاحاً موجوداً */
  if(typeof I18N_EN_ADD !== 'undefined'){
    for(const k in I18N_EN_ADD){ if(I18N.DICT[k] == null) I18N.DICT[k] = I18N_EN_ADD[k]; }
    I18N._keysSorted = null; I18N._cmp = null;
  }

  const LANGS = [
    {id:'ar',    label:'العربية',              flag:'kw', short:'AR'},
    {id:'en',    label:'English',              flag:'gb', short:'EN'},
    {id:'pt-BR', label:'Português (Brasil)',   flag:'br', short:'BR'},
    {id:'pt-PT', label:'Português (Portugal)', flag:'pt', short:'PT'},
    {id:'es',    label:'Español',              flag:'es', short:'ES'},
    {id:'sh',    label:'BCMS',                 flag:null, short:'BCMS'},    /* البوسنية/الكرواتية/الجبل الأسود/الصربية: لغة واحدة بلا علم خاص بها */
  ];
  /* اللغة ← مفتاح قاموسها في I18N_PT / I18N_PT_AR */
  const VAR = {'pt-BR':'BR', 'pt-PT':'PT', 'es':'ES', 'sh':'SH'};
  const STORE = ['mf_lang', 'kwf_lang'];
  const norm = q => {
    q = String(q || '').trim().toLowerCase();
    if(q === 'ar' || q === 'en' || q === 'es') return q;
    if(q === 'sh' || q === 'bcms' || q === 'sr' || q === 'hr' || q === 'bs' || q === 'cnr' || q === 'sr-latn') return 'sh';
    if(q === 'pt' || q === 'pt-br' || q === 'br') return 'pt-BR';
    if(q === 'pt-pt') return 'pt-PT';
    return null;
  };
  const save = l => { try{ STORE.forEach(k => localStorage.setItem(k, l)); }catch(e){} };

  /* ---------- اللغة الحالية ---------- */
  I18N.LANGS = LANGS;
  I18N.lang = function(){
    try{
      const q = norm(new URLSearchParams(location.search).get('lang'));
      if(q){ save(q); return q; }
      return norm(localStorage.getItem(this.KEY)) || 'ar';
    }catch(e){ return 'ar'; }
  };
  /* isEn = «وضع الترجمة» (اتجاه LTR) — يبقى صحيحاً في البرتغالية لأن الترجمة تمر عبر الإنجليزية */
  I18N.isEn = function(){ return this.lang() !== 'ar'; };
  /* isPt = لغة فوق الإنجليزية (برتغالية/إسبانية/صربية-كرواتية) — الاسم القديم باقٍ لأن الكود يستعمله */
  I18N.isPt = function(){ return VAR[this.lang()] != null; };
  I18N.isOv = I18N.isPt;
  I18N.locale = function(){ const l = this.lang(); return l === 'ar' ? 'ar-KW' : l === 'en' ? 'en-GB' : l === 'es' ? 'es-ES' : l === 'sh' ? 'bs-Latn' : l; };

  /* ---------- القاموس البرتغالي ---------- */
  const PTD = () => {
    const P = (typeof I18N_PT !== 'undefined') ? I18N_PT : {};
    return P[VAR[I18N.lang()] || 'BR'] || {};
  };
  const cache = {};
  const escRx = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function tpls(){
    const l = I18N.lang();
    if(cache[l]) return cache[l];
    const D = PTD(), list = [];
    for(const k in D){
      if(!k.includes('⟨x⟩')) continue;
      const parts = k.split('⟨x⟩');
      const lit = parts.join('').replace(/\s+/g, '').length;   /* طول النص الثابت في النمط */
      /* حرف ملزوق بالجزء المتغير («R⟨x⟩» = R1، «GW⟨x⟩»): للأرقام فقط — كان «Redha Hani» يصير «Kedha Hani» */
      const glued = parts.some((p, i) => (i < parts.length - 1 && /[A-Za-z]$/.test(p)) || (i > 0 && /^[A-Za-z]/.test(p)));
      list.push([new RegExp('^' + parts.map(escRx).join('([\\s\\S]+?)') + '$'), D[k], k.length, lit, glued]);
    }
    list.sort((a, b) => b[2] - a[2]);
    return (cache[l] = list);
  }
  const DOWS = {
    pt:{Sun:'Dom',Mon:'Seg',Tue:'Ter',Wed:'Qua',Thu:'Qui',Fri:'Sex',Sat:'Sáb',Sunday:'Domingo',Monday:'Segunda-feira',Tuesday:'Terça-feira',Wednesday:'Quarta-feira',Thursday:'Quinta-feira',Friday:'Sexta-feira',Saturday:'Sábado'},
    es:{Sun:'Dom',Mon:'Lun',Tue:'Mar',Wed:'Mié',Thu:'Jue',Fri:'Vie',Sat:'Sáb',Sunday:'Domingo',Monday:'Lunes',Tuesday:'Martes',Wednesday:'Miércoles',Thursday:'Jueves',Friday:'Viernes',Saturday:'Sábado'},
    sh:{Sun:'Ned',Mon:'Pon',Tue:'Uto',Wed:'Sri',Thu:'Čet',Fri:'Pet',Sat:'Sub',Sunday:'Nedjelja',Monday:'Ponedjeljak',Tuesday:'Utorak',Wednesday:'Srijeda',Thursday:'Četvrtak',Friday:'Petak',Saturday:'Subota'}};
  const MONS_ = {
    pt:{Jan:'jan',Feb:'fev',Mar:'mar',Apr:'abr',May:'mai',Jun:'jun',Jul:'jul',Aug:'ago',Sep:'set',Sept:'set',Oct:'out',Nov:'nov',Dec:'dez',
      January:'janeiro',February:'fevereiro',March:'março',April:'abril',June:'junho',July:'julho',August:'agosto',September:'setembro',October:'outubro',November:'novembro',December:'dezembro'},
    es:{Jan:'ene',Feb:'feb',Mar:'mar',Apr:'abr',May:'may',Jun:'jun',Jul:'jul',Aug:'ago',Sep:'sept',Sept:'sept',Oct:'oct',Nov:'nov',Dec:'dic',
      January:'enero',February:'febrero',March:'marzo',April:'abril',June:'junio',July:'julio',August:'agosto',September:'septiembre',October:'octubre',November:'noviembre',December:'diciembre'},
    sh:{Jan:'jan',Feb:'feb',Mar:'mar',Apr:'apr',May:'maj',Jun:'jun',Jul:'jul',Aug:'avg',Sep:'sep',Sept:'sep',Oct:'okt',Nov:'nov',Dec:'dec',
      January:'januar',February:'februar',March:'mart',April:'april',June:'juni',July:'juli',August:'avgust',September:'septembar',October:'oktobar',November:'novembar',December:'decembar'}};
  const fam = () => { const l = I18N.lang(); return l === 'es' ? 'es' : l === 'sh' ? 'sh' : 'pt'; };
  /* أسماء الأشهر الكاملة بحرف كبير (كما يكتبها المسار كلمة-كلمة) — تُصغَّر داخل النص */
  const capMonths = () => { const M = MONS_[fam()], out = [];
    ['January','February','March','April','May','June','July','August','September','October','November','December'].forEach(k => { const v = M[k] || M[k.slice(0, 3)]; if(v) out.push(v.charAt(0).toUpperCase() + v.slice(1)); });
    return out; };
  /* تواريخ يبنيها المحرك بالإنجليزية: «Sun 18 Oct · 5:40 PM» ← «Dom 18 out · 17:40» */
  function dateTx(s){
    const W = Object.assign({}, DOWS[fam()], MONS_[fam()]);
    const t24 = s.replace(/\b(\d{1,2}):(\d{2}) ?(AM|PM)\b/g, (m, h, mi, ap) => { h = +h % 12 + (ap === 'PM' ? 12 : 0); return String(h).padStart(2, '0') + ':' + mi; });
    const words = t24.match(/[A-Za-z]+/g) || [];
    if(!words.length) return t24 !== s ? t24 : null;
    if(!words.every(w => W[w] != null)) return null;
    return t24.replace(/[A-Za-z]+/g, w => W[w]);
  }
  /* إنجليزي ← برتغالي (نص كامل، ثم نمط بأجزاء متغيرة، ثم تاريخ، ثم أجزاء مفصولة بـ · أو —) */
  function toPt(s, depth){
    if(s == null) return s;
    const str = String(s), k0 = str.trim();
    if(!k0 || !/[A-Za-z]/.test(k0)) return s;
    const k = k0.replace(/\s+/g, ' ');   /* القوالب متعددة الأسطر في الكود تُطابق بمسافات موحّدة */
    const put = v => str.replace(k0, v);
    const D = PTD();
    if(D[k] != null) return put(D[k]);
    for(const [rx, tp, , lit, glued] of tpls()){
      const m = k.match(rx); if(!m) continue;
      if(glued && !m.slice(1).every(c => /^[\d.,+\-−]+$/.test(c || ''))) continue;
      /* نمط بنص ثابت قصير («⟨x⟩ of ⟨x⟩») لا يبتلع فقرة كاملة — كان يخلط اللغتين داخل الجمل الطويلة */
      if(lit < 16 && m.slice(1).some(c => c && c.length > 40 && D[c.trim()] == null)) continue;
      let i = 1;
      return put(tp.replace(/⟨x⟩/g, () => toPt(m[i++] || '', (depth || 0) + 1)));
    }
    const d = dateTx(k); if(d != null) return put(d);
    if((depth || 0) < 3){
      for(const sep of [' · ', ' — ', ' – ', ': ']){
        if(!k.includes(sep)) continue;
        const parts = k.split(sep), tr = parts.map(p => toPt(p, (depth || 0) + 1));
        if(tr.some((p, i) => p !== parts[i])) return put(tr.join(sep));
      }
      /* «(H)/(A)» والأقواس في آخر النص */
      const pm = k.match(/^(.*?)(\s*\([^()]*\))$/);
      if(pm){ const a = toPt(pm[1], (depth || 0) + 1), b = toPt(pm[2].trim(), (depth || 0) + 1);
        if(a !== pm[1] || b !== pm[2].trim()) return put(a + (pm[2].startsWith(' ') ? ' ' : '') + b); }
    }
    return s;
  }
  /* للاستعمال من الكود الذي يكتب الإنجليزية مباشرة (صفحة القوانين، الإنجازات…) */
  I18N.post = function(s){ return this.isPt() ? toPt(s) : s; };
  I18N.toPt = toPt;

  /* ---------- تغليف المحرك: كل ناتج إنجليزي يمر على القاموس البرتغالي ---------- */
  /* عبارات عربية تُترجم بالبرتغالية مباشرة (بدل تركيبها كلمة كلمة من الإنجليزية) */
  const AROV = () => { const A = (typeof I18N_PT_AR !== 'undefined') ? I18N_PT_AR : {}; return A[VAR[I18N.lang()] || 'BR'] || {}; };
  const origTr = I18N.tr;
  I18N.tr = function(key){
    if(key && this.isPt()){ const o = AROV()[String(key).trim().replace(/\s+/g, ' ')]; if(o != null) return o; }
    const r = origTr.call(this, key);
    return (r != null && this.isPt()) ? toPt(r) : r;
  };
  if(typeof I18N.keys === 'function'){
    const origKeys = I18N.keys;
    I18N.keys = function(){
      const base = origKeys.call(this);
      if(!this.isPt()) return base;
      const l = this.lang();
      if(this._ptKeysFor === l && this._ptKeysSrc === base && this._ptKeys) return this._ptKeys;
      this._ptKeysFor = l; this._ptKeysSrc = base;
      /* الأشهر داخل النصوص تُكتب صغيرة («10 outubro» / «10 octubre» / «10 oktobar») */
      const CM = capMonths(); const lowMon = s => CM.includes(s) ? s.toLowerCase() : s;
      return (this._ptKeys = base.map(([k, rx, en]) => [k, rx, typeof en === 'string' ? lowMon(toPt(en)) : en]));
    };
  }
  if(typeof I18N.compile === 'function'){
    const origCompile = I18N.compile;
    I18N.compile = function(){
      const base = origCompile.call(this);
      if(!this.isPt()) return base;
      const l = this.lang();
      if(this._ptCmpFor === l && this._ptCmpSrc === base) return this._ptCmp;
      this._ptCmpFor = l; this._ptCmpSrc = base;
      return (this._ptCmp = base.map(([rx, en, n, len, loose]) => [rx, toPt(en), n, len, loose]));
    };
  }
  /* المسار كلمة-كلمة في الموقع يكتب الشهر بحرف كبير بعد الرقم («10 Outubro») — بالبرتغالية يُكتب صغيراً */
  if(typeof I18N._node === 'function'){
    const origNode = I18N._node;
    const rxFor = {};
    I18N._node = function(node){
      origNode.call(this, node);
      if(!this.isPt() || node._i18nAr == null) return;
      const f = fam(), MONS = rxFor[f] || (rxFor[f] = new RegExp('(\\d)\\s(' + capMonths().join('|') + ')', 'g'));
      MONS.lastIndex = 0;
      if(MONS.test(node.nodeValue)){ MONS.lastIndex = 0; node.nodeValue = node.nodeValue.replace(MONS, (m, d, mo) => d + ' ' + mo.toLowerCase()); }
      MONS.lastIndex = 0;
    };
  }
  /* الأشهر بالبرتغالية (الإنجازات في الموقع: honDate) */
  I18N.mon = function(ar){
    const en = this.MON && this.MON[ar]; if(!en) return ar;
    return this.isPt() ? (MONS_[fam()][en] || en) : en;
  };

  /* ---------- الاتجاه وزر اللغة ---------- */
  /* لغة بلا علم (الصربية/الكرواتية): شارة نص بنفس مقاس العلم */
  const flagImg = (c, w, short) => !c ? `<span style="display:inline-flex;align-items:center;justify-content:center;flex:none;width:${w}px;height:${Math.round(w * .75)}px;border-radius:2px;background:#e7d093;color:#0e1730;font:800 ${Math.max(7, Math.round(w * .3))}px/1 system-ui,sans-serif;letter-spacing:-.02em">${short || ''}</span>` : `<img src="https://flagcdn.com/w40/${c}.png" srcset="https://flagcdn.com/w80/${c}.png 2x" width="${w}" height="${Math.round(w * .75)}" alt="" style="border-radius:2px;object-fit:cover;flex:none;display:block">`;
  I18N.cur = function(){ const l = this.lang(); return LANGS.find(x => x.id === l) || LANGS[0]; };
  /* محتوى الزر: علم اللغة الحالية */
  I18N.btnHTML = function(){ const c = this.cur(); return `<span style="display:inline-flex;align-items:center;justify-content:center;line-height:1">${flagImg(c.flag, 20, c.short)}</span>`; };
  const paintBtns = () => {
    document.querySelectorAll('#langBtn, .iconbtn.lang').forEach(b => {
      const h = I18N.btnHTML(); if(b._lgH !== h){ b._lgH = h; b.innerHTML = h; }
      b.setAttribute('data-i18n', 'off');
      b.title = 'Language · اللغة'; b.setAttribute('aria-label', 'Language · اللغة');
      b.setAttribute('aria-haspopup', 'menu');
    });
  };
  I18N.paintBtns = paintBtns;
  I18N.applyDir = function(){
    const l = this.lang(), tr = l !== 'ar';
    document.documentElement.setAttribute('dir', tr ? 'ltr' : 'rtl');
    document.documentElement.setAttribute('lang', l);
    document.documentElement.classList.toggle('lang-en', tr);
    document.documentElement.classList.toggle('lang-pt', l.startsWith('pt'));
    document.documentElement.classList.toggle('lang-ov', VAR[l] != null);
    paintBtns();
  };

  /* ---------- التبديل ---------- */
  const isFantasy = () => typeof APP !== 'undefined' && APP && typeof APP.render === 'function' && typeof DB !== 'undefined';
  I18N.setLang = function(l){
    l = norm(l) || 'ar';
    save(l);
    /* ?lang= في الرابط يغلب الاختيار المحفوظ — نزيله حتى يثبت الاختيار الجديد */
    try{ const u = new URL(location.href); if(u.searchParams.has('lang')){ u.searchParams.delete('lang'); history.replaceState(history.state, '', u.pathname + (u.search || '') + u.hash); } }catch(e){}
    this._keysSorted = null; this._cmp = null; this._ptKeys = null; this._ptCmp = null;
    for(const k in cache) delete cache[k];
    if(this.restore) this.restore(document.body);
    this.applyDir();
    if(isFantasy()) APP.render();
    if(l !== 'ar'){ this.apply(document.body); if(this._docTitle) this._docTitle(); }
    paintBtns();
    const c = this.cur();
    if(typeof toast === 'function') toast(c.label);
    else if(typeof UI !== 'undefined' && UI.toast) UI.toast(c.label);
  };

  /* ---------- قائمة اللغات بالأعلام ---------- */
  function closeMenu(){ const m = document.getElementById('lgMenu'); if(m) m.remove(); document.removeEventListener('pointerdown', outside, true); }
  function outside(e){ const m = document.getElementById('lgMenu'); if(m && !m.contains(e.target) && !e.target.closest('#langBtn,.iconbtn.lang')) closeMenu(); }
  I18N.menu = function(btn){
    if(document.getElementById('lgMenu')){ closeMenu(); return; }
    btn = btn || document.querySelector('#langBtn, .iconbtn.lang');
    const cur = this.lang();
    const m = document.createElement('div');
    m.id = 'lgMenu'; m.setAttribute('role', 'menu'); m.setAttribute('data-i18n', 'off');
    m.innerHTML = LANGS.map(x => `<button type="button" role="menuitemradio" aria-checked="${x.id === cur}" data-lg="${x.id}" dir="${x.id === 'ar' ? 'rtl' : 'ltr'}">
        ${flagImg(x.flag, 24, x.short)}<span class="lg-l">${x.label}</span>${x.id === cur ? '<span class="lg-ok" aria-hidden="true">✓</span>' : ''}</button>`).join('');
    document.body.appendChild(m);
    const r = btn ? btn.getBoundingClientRect() : {bottom: 56, left: 12, right: 12, width: 0};
    const W = Math.min(260, window.innerWidth - 24);
    m.style.width = W + 'px';
    m.style.top = Math.round(r.bottom + 8) + 'px';
    let left = r.left + r.width / 2 - W / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - W - 12));
    m.style.left = Math.round(left) + 'px';
    m.querySelectorAll('[data-lg]').forEach(b => b.onclick = () => { closeMenu(); if(b.dataset.lg !== I18N.lang()) I18N.setLang(b.dataset.lg); });
    setTimeout(() => document.addEventListener('pointerdown', outside, true), 0);
  };
  I18N.toggle = function(){ this.menu(); };
  document.addEventListener('keydown', e => { if(e.key === 'Escape') closeMenu(); });

  const css = document.createElement('style');
  css.textContent = `
#lgMenu{position:fixed;z-index:2147483000;background:#0e1730;color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:14px;
  padding:6px;box-shadow:0 18px 40px rgba(0,0,0,.45);display:flex;flex-direction:column;gap:2px;font-family:inherit}
#lgMenu button{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:12px;width:100%;padding:11px 12px;border-radius:10px;cursor:pointer;
  font-size:15px;font-weight:600;line-height:1.2;color:#fff}
#lgMenu button:hover,#lgMenu button:focus-visible{background:rgba(255,255,255,.08)}
#lgMenu button[aria-checked="true"]{background:rgba(212,175,55,.16)}
#lgMenu .lg-l{flex:1;text-align:start}
#lgMenu .lg-ok{color:#d4af37;font-weight:800}
#langBtn img,.iconbtn.lang img{box-shadow:0 0 0 1px rgba(0,0,0,.18)}
/* أسهم «التالي» في الفانتسي مرسومة لليسار (اتجاه RTL) — في الإنجليزية/البرتغالية تشير لليمين */
html[dir="ltr"] .lr-arrow .ic,html[dir="ltr"] .big > span .ic,html[dir="ltr"] .hh-edit .ic{transform:scaleX(-1)}`;
  (document.head || document.documentElement).appendChild(css);

  /* الزر يُرسم أحياناً بعد التهيئة (ترويسة الفانتسي) — نعيد تلوينه عند كل رسم */
  const paintSoon = () => { clearTimeout(paintSoon._t); paintSoon._t = setTimeout(paintBtns, 30); };
  const watchBtn = () => { if(!document.body) return; new MutationObserver(paintSoon).observe(document.body, {childList: true, subtree: true}); paintBtns(); };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { I18N.applyDir(); watchBtn(); });
  else { I18N.applyDir(); watchBtn(); }
  /* المحرك قد يكون ترجم الصفحة قبل تحميل هذا الملف (بلا الإضافات أو بالإنجليزية بدل البرتغالية): نعيد التطبيق */
  if(I18N.isEn() && document.body){ try{ I18N.restore && I18N.restore(document.body); I18N.apply(document.body); }catch(e){} }
})();
