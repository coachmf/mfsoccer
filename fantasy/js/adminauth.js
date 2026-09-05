/* دخول المطوّر/المدير: بريد + كلمة مرور. المالك ثابت في الكود، والمديرون الإضافيون يُضافون من لوحة الإدارة. */
'use strict';

/* SHA-256 (بدون اعتماد على crypto.subtle حتى يعمل عبر http على الشبكة المحلية) */
function sha256(ascii){
  function rr(v,a){ return (v>>>a)|(v<<(32-a)); }
  const mathPow=Math.pow, maxWord=mathPow(2,32); let result='';
  const words=[], asciiBitLength=ascii.length*8;
  let hash=sha256.h=sha256.h||[], k=sha256.k=sha256.k||[], primeCounter=k.length;
  const isComposite={};
  for(let candidate=2; primeCounter<64; candidate++){
    if(!isComposite[candidate]){
      for(let i=0;i<313;i+=candidate) isComposite[i]=candidate;
      hash[primeCounter]=(mathPow(candidate,.5)*maxWord)|0;
      k[primeCounter++]=(mathPow(candidate,1/3)*maxWord)|0;
    }
  }
  ascii+='\x80'; while(ascii.length%64-56) ascii+='\x00';
  for(let i=0;i<ascii.length;i++){ const j=ascii.charCodeAt(i); if(j>>8) return; words[i>>2]|=j<<((3-i)%4)*8; }
  words[words.length]=((asciiBitLength/maxWord)|0); words[words.length]=(asciiBitLength);
  for(let j=0;j<words.length;){
    const w=words.slice(j,j+=16), oldHash=hash; hash=hash.slice(0,8);
    for(let i=0;i<64;i++){
      const w15=w[i-15], w2=w[i-2];
      const a=hash[0], e=hash[4];
      const temp1=hash[7]+(rr(e,6)^rr(e,11)^rr(e,25))+((e&hash[5])^((~e)&hash[6]))+k[i]
        +(w[i]=(i<16)? w[i] : (w[i-16]+(rr(w15,7)^rr(w15,18)^(w15>>>3))+w[i-7]+(rr(w2,17)^rr(w2,19)^(w2>>>10)))|0);
      const temp2=(rr(a,2)^rr(a,13)^rr(a,22))+((a&hash[1])^(a&hash[2])^(hash[1]&hash[2]));
      hash=[(temp1+temp2)|0].concat(hash); hash[4]=(hash[4]+temp1)|0;
    }
    for(let i=0;i<8;i++) hash[i]=(hash[i]+oldHash[i])|0;
  }
  for(let i=0;i<8;i++) for(let j=3;j+1;j--){ const b=(hash[i]>>(j*8))&255; result+=((b<16)?0:'')+b.toString(16); }
  return result;
}
/* يدعم النص العربي/اليونيكود بتحويله إلى UTF-8 أولاً */
function hashCred(email, pass){
  const s=unescape(encodeURIComponent(String(email).trim().toLowerCase()+':'+String(pass)));
  return sha256(s);
}

const ADMINAUTH = {
  /* مالكو اللعبة — مثبتون في الكود فيعملون على كل الأجهزة (بعكس المديرين المضافين من اللوحة).
     لتوليد الهاش: افتح كونسول المتصفح في صفحة اللعبة واكتب
         hashCred('البريد', 'كلمة المرور')
     والصق الناتج (64 حرفاً) مكان hash. صاحب hash فارغ لا يستطيع الدخول. */
  OWNERS: [
    { email:'mansourx04@gmail.com', name:'منصور',          hash:'533ffed7b0a7dde39049aad225c3abf085a968632cc5cf26ef92ce6367617e2d' },
    { email:'coachmf.kw@gmail.com', name:'محمد الفيلكاوي', hash:'a056561210868b8b12e6df16046cc7c44581c6a5da3d5173315b31692cf47d12' },
  ],
  /* يرجع سجل المالك إذا كان بريده مسجلاً وله كلمة مرور مضبوطة */
  ownerRec(email){ const e=String(email||'').trim().toLowerCase(); return this.OWNERS.find(o=>o.email===e && o.hash); },
  KEY:'kwf_admin', TTL: 24*3600*1000,
  session(){ try{ const s=JSON.parse(localStorage.getItem(this.KEY)||'null'); return (s && s.until>Date.now())? s : null; }catch(e){ return null; } },

  /* الطريق المعتمد: حساب الموقع نفسه.
     CLOUD.admin يُحسب من Firebase — المالك أو محرّر مفعّل في seasons/staff —
     وهو عين الشرط الذي تفرضه firestore.rules، فما يظهر هنا لا يرفضه الخادم.
     ولا يحتاج سرّاً في الكود: ملف الفانتسي مقروء للعالم. */
  cloudAdmin(){ return typeof CLOUD!=='undefined' && !!CLOUD.admin; },
  cloudEmail(){ return (typeof CLOUD!=='undefined' && CLOUD.user && CLOUD.user.email) || ''; },

  active(){ return this.cloudAdmin() || !!this.session(); },
  isOwner(){ if(this.cloudAdmin()) return true; const s=this.session(); return !!s && !!this.ownerRec(s.email); },
  /* البريد المعروض في لوحة المديرين، أياً كان طريق الدخول */
  whoami(){ const s=this.session(); return this.cloudAdmin()? this.cloudEmail() : (s? s.email : ''); },
  extra(){ DB.state.admins=DB.state.admins||[]; return DB.state.admins; },
  sync(){ const m=DB.me(); if(m){ const a=this.active(); if(m.admin!==a){ m.admin=a; DB.save(); } } },
  login(email, pass){
    email=String(email||'').trim().toLowerCase();
    if(!email || !pass){ UI.toast('أدخل البريد وكلمة المرور',true); return; }
    const h=hashCred(email,pass);
    const o = this.ownerRec(email);
    const ok = (o && h===o.hash) || this.extra().some(a=>a.email===email && a.hash===h);
    if(!ok){ UI.toast('البريد أو كلمة المرور غير صحيحة',true); return; }
    localStorage.setItem(this.KEY, JSON.stringify({email, until:Date.now()+this.TTL}));
    this.sync(); UI.toast(o? `أهلاً ${o.name} — دخلت كمالك اللعبة` : 'تم الدخول كمدير');
    VIEWS.ui.adminSec='gws'; APP.go('admin');
  },
  async logout(){
    localStorage.removeItem(this.KEY);
    /* الداخل بحساب الموقع يخرج من الحساب نفسه، وإلا بقيت الصلاحية قائمة */
    if(this.cloudAdmin()){ try{ await CLOUD.logout(); }catch(e){} }
    this.sync(); UI.toast('تم الخروج من الإدارة'); APP.go('dashboard');
  },
  /* دخول بحساب الموقع — لا سرّ في الكود، والصلاحية من فريق العمل */
  async siteLogin(email, pass){
    if(typeof CLOUD==='undefined' || !CLOUD.ready){
      UI.toast('السحابة غير متاحة — تأكد من الاتصال', true); return;
    }
    email=String(email||'').trim().toLowerCase();
    if(!email || !pass){ UI.toast('أدخل البريد وكلمة المرور',true); return; }
    const r = await CLOUD.login(email, pass);
    if(!r.ok){ UI.toast(r.err || 'تعذّر الدخول', true); return; }
    /* onAuthStateChanged يضبط CLOUD.admin ثم يعيد الرسم */
    await new Promise(res=>setTimeout(res,600));
    if(!this.cloudAdmin()){
      UI.toast('دخلت بحسابك، لكنه غير مُدرج في فريق العمل — راجع مالك الموقع', true);
      APP.render(); return;
    }
    UI.toast('أهلاً — دخلت بصلاحية فريق العمل');
    VIEWS.ui.adminSec='gws'; APP.go('admin');
  },

  loginView(){
    const cloudUp = typeof CLOUD!=='undefined' && CLOUD.ready;
    const signedNotAdmin = cloudUp && CLOUD.user && !CLOUD.admin;
    return `<div class="card" style="max-width:420px;margin:0 auto">
      <h3>دخول الإدارة</h3>
      <div class="tiny" style="margin-bottom:12px;color:var(--text3)">
        ادخل بحساب الموقع نفسه — الحساب الذي ترصد به المباريات في mfsoccer.com.
        الصلاحية تُمنح وتُسحب من قائمة فريق العمل، ولا تحتاج كلمة مرور خاصة باللعبة.</div>
      ${signedNotAdmin? `<div class="tiny" style="margin-bottom:12px;color:var(--bad,#b00)">
        أنت داخل بحساب <b style="direction:ltr;display:inline-block">${esc(CLOUD.user.email||'')}</b>
        وهو غير مُدرج في فريق العمل. اطلب من مالك الموقع إضافتك محرّراً، أو ادخل بحساب آخر.</div>`:''}
      ${!cloudUp? `<div class="tiny" style="margin-bottom:12px;color:var(--bad,#b00)">
        تعذّر الاتصال بالسحابة — تحقّق من الإنترنت.</div>`:''}
      <div class="field"><label>البريد الإلكتروني</label><input id="ad_email" type="email" autocomplete="username" style="direction:ltr" placeholder="name@email.com"></div>
      <div class="field"><label>كلمة المرور</label><input id="ad_pass" type="password" autocomplete="current-password" style="direction:ltr" onkeydown="if(event.key==='Enter') ADMINAUTH.siteLogin(gv('ad_email'),gv('ad_pass'))"></div>
      <button class="btn" style="width:100%" onclick="ADMINAUTH.siteLogin(gv('ad_email'),gv('ad_pass'))">دخول بحساب الموقع</button>
      <div style="margin-top:14px;border-top:1px solid var(--line);padding-top:12px">
        <button class="btn sec sm" style="width:100%" onclick="VIEWS.ui.legacyAdmin=!VIEWS.ui.legacyAdmin;APP.render()">
          ${VIEWS.ui.legacyAdmin? 'إخفاء' : 'الدخول بكلمة مرور اللعبة القديمة'}</button>
        ${VIEWS.ui.legacyAdmin? `
          <div class="tiny" style="margin:10px 0;color:var(--text3)">طريق احتياطي فقط. كلمة المرور هذه مضمّنة في ملف تقرأه أي جهة، فلا تضع فيها سرّاً يهمّك.</div>
          <div class="field"><label>البريد الإلكتروني</label><input id="lg_email" type="email" style="direction:ltr"></div>
          <div class="field"><label>كلمة المرور</label><input id="lg_pass" type="password" style="direction:ltr" onkeydown="if(event.key==='Enter') ADMINAUTH.login(gv('lg_email'),gv('lg_pass'))"></div>
          <button class="btn sec" style="width:100%" onclick="ADMINAUTH.login(gv('lg_email'),gv('lg_pass'))">دخول</button>`:''}
      </div>
    </div>`;
  },
  /* قسم «المديرون» في لوحة الإدارة */
  section(){
    const owner=this.isOwner(); const s={email:this.whoami()};
    const viaSite=this.cloudAdmin();
    const rows=this.extra().map(a=>`<tr><td style="direction:ltr;text-align:right">${esc(a.email)}</td><td class="tiny">${UI.fmtDateShort(a.added)}</td>
      <td>${owner? `<button class="btn danger sm" onclick="ADMINAUTH.removeAdmin('${esc(a.email)}')">إزالة</button>`:''}</td></tr>`).join('');
    return `<div class="card"><h3>المديرون</h3>
      <div class="tiny" style="margin-bottom:10px;color:var(--text3)">أنت داخل الآن بحساب <b style="direction:ltr;display:inline-block">${esc(s.email)}</b>${owner?' (المالك)':''}. ${viaSite? 'الدخول بحساب الموقع — الصلاحية من قائمة فريق العمل، وتنتهي بالخروج من الحساب.' : 'الجلسة تنتهي بعد 24 ساعة أو عند الخروج.'}</div>
      ${viaSite? '':`<div class="tiny" style="margin-bottom:10px;color:var(--text3)">دخلت بكلمة مرور اللعبة القديمة. الأفضل الدخول بحساب الموقع — لا يحتاج سرّاً مخزّناً في ملف عام.</div>`}
      <div class="scroll-x"><table class="tbl"><tr><th>البريد</th><th>أُضيف</th><th></th></tr>
        ${this.OWNERS.filter(o=>o.hash).map(o=>`<tr><td style="direction:ltr;text-align:right"><b>${esc(o.email)}</b> <span class="pill gold">المالك</span></td><td class="tiny">ثابت في الكود</td><td></td></tr>`).join('')}
        ${rows}</table></div>
      ${owner? `<h4 style="margin:16px 0 8px">إضافة مدير</h4>
        <div class="field"><label>البريد الإلكتروني</label><input id="na_email" type="email" style="direction:ltr"></div>
        <div class="field"><label>كلمة المرور (اختر له كلمة مرور وأعطه إياها)</label><input id="na_pass" type="text" style="direction:ltr"></div>
        <button class="btn" onclick="ADMINAUTH.addAdmin(gv('na_email'),gv('na_pass'))">إضافة</button>
        <div class="tiny" style="margin-top:10px;color:var(--text3)">ملاحظة: المديرون المضافون يُحفظون في بيانات هذا الجهاز/المتصفح. حساب المالك وحده مضمّن في كود اللعبة ويعمل على كل الأجهزة. لتغيير كلمة مرور المالك أو تضمين مدير دائم في الكود، اطلب ذلك من المطوّر.</div>`
      : '<div class="tiny" style="margin-top:10px;color:var(--text3)">إضافة أو إزالة المديرين صلاحية للمالك فقط.</div>'}
      <div style="margin-top:16px;border-top:1px solid var(--line);padding-top:12px"><button class="btn sec sm" onclick="ADMINAUTH.logout()">خروج من الإدارة</button></div>
    </div>`;
  },
  addAdmin(email, pass){
    if(!this.isOwner()){ UI.toast('المالك فقط يضيف مديرين',true); return; }
    email=String(email||'').trim().toLowerCase();
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){ UI.toast('بريد غير صحيح',true); return; }
    if(!pass || pass.length<6){ UI.toast('كلمة المرور 6 أحرف على الأقل',true); return; }
    if(this.OWNERS.some(o=>o.email===email) || this.extra().some(a=>a.email===email)){ UI.toast('هذا البريد مدير أصلاً',true); return; }
    this.extra().push({email, hash:hashCred(email,pass), added:new Date().toISOString()});
    DB.save(); UI.toast('أُضيف المدير '+email); APP.render();
  },
  removeAdmin(email){
    if(!this.isOwner()) return;
    DB.state.admins=this.extra().filter(a=>a.email!==email); DB.save(); UI.toast('أُزيل '+email); APP.render();
  },
};
