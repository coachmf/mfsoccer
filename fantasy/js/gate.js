/* =========================================================
   بوابة المعاينة — تخفي اللعبة عن الزوار لين ما تعتمدها
   يُحمَّل آخر ملف في index.html.
   للفتح للجمهور: بدّل PRIVATE إلى false (أو احذف سطر الملف).
   لتغيير الرمز: افتح الصفحة، وفي كونسول المتصفح اكتب
       GATE.hash('الرمز-الجديد')
   وانسخ الناتج مكان CODE_HASH تحت. الرمز إنجليزي/أرقام فقط.
   ========================================================= */
'use strict';

const GATE = {
  /* القفل الافتراضي عند تعذّر الوصول للسحابة. الحالة الحقيقية تأتي من
     حقل fantasyOpen في مستند الموسم على mfsoccer — يبدّله المدير من
     الموقع الرئيسي (الإعدادات ← إشهار الفانتسي)، فتنفتح اللعبة للجميع. */
  PRIVATE: true,
  CODE_HASH: '02207a8858b933cb119a7465f88a9289d173b000e48b6eea92efae11972b196a', // mf2026 — غيّره
  KEY: 'kwf_gate',
  DAYS: 60,

  async hash(txt){
    const s = String(txt).trim();
    if(window.crypto && crypto.subtle){
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
      return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
    }
    if(typeof sha256 === 'function') return sha256(s);   // احتياطي عند فتح الملف محلياً
    return null;
  },

  open(){
    try{ const t = JSON.parse(localStorage.getItem(this.KEY)||'null');
      return !!(t && t.until > Date.now()); }catch(e){ return false; }
  },

  /* هل أشهر المدير اللعبة للجمهور؟ يُقرأ من نفس مستند موسم mfsoccer */
  PUB_KEY: 'kwf_public',
  cachedPublic(){ try{ return localStorage.getItem(this.PUB_KEY)==='1'; }catch(e){ return false; } },
  async fetchPublic(){
    if(typeof MFSYNC==='undefined' || !MFSYNC.URL) return null;
    try{
      const r = await fetch(MFSYNC.URL, {cache:'no-store'});
      if(!r.ok) return null;
      const j = await r.json();
      const f = (j.fields||{}).fantasyOpen;
      if(!f || !('booleanValue' in f)) return false;
      return !!f.booleanValue;
    }catch(e){ return null; }          // بلا شبكة: نُبقي الحالة المخزّنة
  },

  grant(){
    try{ localStorage.setItem(this.KEY, JSON.stringify({until: Date.now() + this.DAYS*864e5})); }catch(e){}
    const el = document.getElementById('gate');
    if(el){ el.style.opacity = '0'; setTimeout(()=>el.remove(), 260); }
    document.body.style.overflow = '';
  },

  lock(){
    try{ localStorage.removeItem(this.KEY); }catch(e){}
    location.reload();
  },

  async submit(){
    const inp = document.getElementById('gateInput');
    const msg = document.getElementById('gateMsg');
    const h = await this.hash(inp.value);
    if(h && h === this.CODE_HASH){ this.grant(); return; }
    msg.textContent = 'الرمز غير صحيح';
    inp.value = '';
    inp.focus();
  },

  render(){
    const box = document.createElement('div');
    box.id = 'gate';
    box.innerHTML = `
      <style>
        #gate{position:fixed;inset:0;z-index:99999;background:#0b1b2e;
          display:grid;place-items:center;padding:24px;transition:opacity .26s;
          font-family:Almarai,system-ui,sans-serif;color:#fff}
        #gate .g-card{width:100%;max-width:340px;text-align:center}
        #gate img{height:64px;margin-bottom:22px}
        #gate h1{font-size:20px;font-weight:800;margin:0 0 6px}
        #gate p{font-size:13px;color:#9db6d2;margin:0 0 22px;line-height:1.7}
        #gate input{width:100%;padding:13px 15px;border-radius:12px;border:1px solid rgba(255,255,255,.18);
          background:rgba(255,255,255,.06);color:#fff;font-size:16px;font-family:inherit;text-align:center;
          letter-spacing:2px;outline:none}
        #gate input:focus{border-color:#5aa9ff}
        #gate button{width:100%;margin-top:10px;padding:13px;border-radius:12px;border:0;
          background:#5aa9ff;color:#04101f;font-weight:800;font-size:15px;font-family:inherit;cursor:pointer}
        #gate .g-msg{min-height:20px;margin-top:10px;font-size:12.5px;color:#ff8b93}
        #gate .g-foot{margin-top:26px;font-size:11.5px;color:#5f7ea1}
      </style>
      <div class="g-card">
        <img src="assets/logo-light.png" alt="">
        <h1>نسخة قيد المراجعة</h1>
        <p>هذا القسم مب مفتوح للجمهور بعد.<br>أدخل رمز الدخول للمعاينة.</p>
        <input id="gateInput" type="password" inputmode="text" autocomplete="off" placeholder="رمز الدخول">
        <button onclick="GATE.submit()">دخول</button>
        <div class="g-msg" id="gateMsg"></div>
        <div class="g-foot">فانتسي دوري زين الممتاز · 2026/2027</div>
      </div>`;
    document.body.appendChild(box);
    document.body.style.overflow = 'hidden';
    const inp = document.getElementById('gateInput');
    inp.addEventListener('keydown', e => { if(e.key === 'Enter') this.submit(); });
    setTimeout(()=>inp.focus(), 300);
  },

  /* يزيل البوابة إن كانت معروضة (عند وصول «مُشهرة» من السحابة) */
  unlockPublic(){
    const el = document.getElementById('gate');
    if(el){ el.style.opacity='0'; setTimeout(()=>el.remove(), 260); }
    document.body.style.overflow = '';
  },

  init(){
    // مفتوحة أصلاً (رمز معاينة صالح، أو إشهار محفوظ من زيارة سابقة): لا بوابة
    if(!this.PRIVATE || this.open() || this.cachedPublic()){ this.syncPublic(); return; }
    if(document.body) this.render();
    else document.addEventListener('DOMContentLoaded', ()=>this.render());
    this.syncPublic();
  },

  /* تُسأل السحابة في الخلفية: تُفتح البوابة إذا أشهرت، وتُقفل إذا أُلغي الإشهار */
  async syncPublic(){
    const pub = await this.fetchPublic();
    if(pub === null) return;                       // تعذّر الوصول: لا نغيّر شيئاً
    try{ localStorage.setItem(this.PUB_KEY, pub?'1':'0'); }catch(e){}
    if(pub){ this.unlockPublic(); return; }
    // أُلغي الإشهار: نُعيد البوابة إلا لمن معه رمز معاينة صالح
    if(!this.open() && !document.getElementById('gate')){
      if(document.body) this.render();
      else document.addEventListener('DOMContentLoaded', ()=>this.render());
    }
  }
};

GATE.init();
