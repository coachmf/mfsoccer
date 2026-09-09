/* =========================================================
   اللغة الإنجليزية — ترجمة الواجهة بعد الرسم
   الشاشات مكتوبة بالعربية في القوالب؛ عند اختيار English تُستبدل النصوص
   المعروفة في العقد النصية والسمات (placeholder/title) بعد كل رسم،
   ويُقلب اتجاه الصفحة إلى LTR. ما ليس في القاموس يبقى كما هو.
   المرحلة الأولى: الشاشات الرئيسية (الرئيسية، فريقي، اللاعبون، المباريات،
   الدوريات، بطاقة اللاعب، الدخول، الدعم). لوحة الإدارة تبقى بالعربية.
   ========================================================= */
'use strict';

const I18N = {
  KEY: 'kwf_lang',
  lang(){ try{ return localStorage.getItem(this.KEY)==='en' ? 'en' : 'ar'; }catch(e){ return 'ar'; } },
  isEn(){ return this.lang()==='en'; },
  locale(){ return this.isEn() ? 'en-GB' : 'ar-KW'; },

  /* ---------- القاموس: نص عربي كما يظهر → إنجليزي ---------- */
  DICT: {
    // التنقل
    'الرئيسية':'Home', 'فريقي':'My Team', 'اللاعبون':'Players', 'المباريات':'Fixtures', 'الدوريات':'Leagues', 'دوريات':'Leagues',
    'إحصائيات':'Stats', 'الإحصائيات':'Statistics', 'عن اللعبة':'About', 'الإدارة':'Admin', 'إدارة':'Admin', 'العودة للموقع':'Back to site',
    'الإشعارات':'Notifications', 'الوضع الداكن':'Dark mode', 'الوضع الفاتح':'Light mode', 'رجوع':'Back', 'تمييز الكل كمقروء':'Mark all read',
    'اللغة':'Language',
    // الرئيسية
    'المدرب':'Manager', 'اختر تشكيلتك':'Pick your lineup', 'كوّن فريقك الآن':'Create your team', 'الانتقالات':'Transfers',
    'ملخص الجولة':'Gameweek summary', 'المباشر':'Live', 'موعد الإغلاق':'Deadline',
    'الاحتساب يبدأ من الجولة 4':'Scoring starts from Gameweek 4',
    'الجولات السابقة لا تُحتسب لأحد — أول نقاط بعد الجولة 4.':'Earlier gameweeks are not scored for anyone — first points after Gameweek 4.',
    'النتائج وتقييم صعوبة الجولات القادمة':'Results and fixture difficulty', 'الأسعار والنقاط وسجل كل لاعب':'Prices, points and every player record',
    'الأكثر انتقالاً وتملكاً وأفضل قيمة':'Most transferred, most owned, best value', 'مقارنة اللاعبين':'Compare players',
    'قارن حتى 3 لاعبين جنباً إلى جنب':'Compare up to 3 players side by side', 'الترتيب العام ودورياتك الخاصة':'Overall table and your private leagues',
    'نبذة، فريق العمل، طريقة اللعب، نظام النقاط والكروت':'About, the team, how to play, scoring and chips',
    'الدعم والاقتراحات':'Support & feedback', 'راسل الدعم الفني أو اقترح أو بلّغ عن خطأ':'Message support, suggest, or report a bug',
    'المطوّر':'Developer', 'تصميم وتطوير اللعبة':'Game design and development', 'المتوسط':'Average', 'نقاطك':'Your points', 'الأعلى':'Highest',
    'المتوسط الآن':'Average now', 'نقاطك الآن':'Your points now', 'ترتيبك الآن':'Your rank now', 'مباشر':'Live',
    'اكتملت المباريات — بانتظار اعتماد الجولة':'Matches finished — awaiting gameweek confirmation',
    'لم يصدر جدول الجولة بعد — التشكيلة مفتوحة':'Fixtures not published yet — lineup open',
    // فريقي
    'الملعب':'Pitch', 'قائمة':'List', 'تفعيل':'Play', 'إلغاء':'Cancel', 'مستخدم':'Used', 'بالبنك':'In the bank', 'القيمة':'Value',
    'بالبنك (KWD)':'Bank (KWD)', 'القيمة (KWD)':'Value (KWD)', 'مجاني':'Free', 'الخصم':'Hits', 'انتقالات مجانية':'Free transfers',
    'مجموع النقاط':'Total points', 'قيمة الفريق':'Team value', 'حارس':'GK', 'مدافع':'DEF', 'وسط':'MID', 'مهاجم':'FWD',
    'حارس مرمى':'Goalkeeper', 'لاعب وسط':'Midfielder', 'تبديل':'Substitute', 'كابتن':'Captain', 'نائب الكابتن':'Vice-captain',
    'الملف الكامل':'Full profile', 'قارن مع لاعب آخر':'Compare with another player', 'إضافة':'Add', 'اختيار بديل':'Choose replacement',
    'إزالة':'Remove', 'تراجع':'Undo', 'بديل آخر':'Another replacement', 'اعتماد الفريق':'Confirm team', 'تنفيذ':'Confirm',
    'تأكيد الصفقات':'Confirm transfers', 'بدون خصم نقاط.':'No points deducted.', 'تم التبديل':'Substituted', 'تغيّر ترتيب الدكة':'Bench order changed',
    'التبديل التلقائي يدخل البدلاء بترتيبهم 1 ثم 2 ثم 3 عند غياب أساسي. لتغيير الترتيب: اضغط بديلاً ثم «تبديل» ثم بديلاً آخر.':
      'Auto-subs come on in bench order 1, 2, 3 when a starter does not play. To reorder: tap a sub, then "Substitute", then another sub.',
    'إضافة لاعب':'Add player', 'اللاعب الخارج':'Player out', 'النقاط':'Points', 'الفورمة':'Form', 'السعر':'Price', 'التملّك':'Owned',
    'الأعلى نقاطاً':'Most points', 'الأغلى':'Most expensive', 'الأفضل فورمة':'Best form', 'الأكثر تملكاً':'Most owned',
    'كل المراكز':'All positions', 'كل الأندية':'All clubs', 'كل الأسعار':'All prices', 'بحث بالاسم':'Search by name', 'لا نتائج':'No results',
    'في فريقك':'In your team', 'الميزانية لا تكفي':'Not enough budget', 'الرصيد لا يكفي':'Not enough funds',
    'أُغلقت الجولة — الانتقالات تفتح بعد احتساب النتائج.':'Gameweek locked — transfers reopen after results are scored.',
    'تغييرات حرة حتى موعد الإغلاق':'Free changes until the deadline', 'انتقالات حرة — كرت مفعّل':'Free transfers — chip active',
    // بطاقة اللاعب
    'السعر (KWD)':'Price (KWD)', 'نقاط/مباراة':'Pts/match', 'نقاطه في آخر الجولات':'Points in recent gameweeks',
    'المباريات القادمة':'Upcoming fixtures', 'صعوبة المباراة':'Fixture difficulty', 'لا جولات بعد':'No gameweeks yet', 'موقوف':'Suspended', 'مصاب':'Injured', 'غير متوفر':'Unavailable',  'مشكوك':'Doubtful',
    'متوسط النقاط/جولة':'Avg points/GW', 'نسبة التملّك':'Ownership', 'أهداف':'Goals', 'صناعة':'Assists', 'شباك نظيفة':'Clean sheets', 'دقائق':'Minutes',
    'تعاقد معه':'Sign him', 'جولة':'GW', 'شباك':'CS', 'إنذار':'YC', 'طرد':'RC', 'بونص':'Bonus', 'نقاط':'Pts', 'نقاط الفانتسي عبر الجولات':'Fantasy points by gameweek',
    'مباريات سهلة قادمة':'Easy fixtures ahead', 'اضغط عنوان العمود للترتيب من الأفضل إلى الأسوأ، ومرة أخرى لعكسه.':'Click a column header to sort best to worst; click again to reverse.', 'مقارنة':'Compare', 'اللاعب':'Player', 'فورمة':'Form', 'تملّك':'Owned',
    // المباريات
    'المباريات والنتائج':'Fixtures & results', 'منتهية':'Finished', 'لم يصدر الجدول':'Not scheduled', 'الإغلاق:':'Deadline:',
    'صعوبة المباريات القادمة (لكل نادٍ)':'Upcoming fixture difficulty (by club)', 'النادي':'Club', 'المباريات الخمس القادمة':'Next five fixtures',
    'سهلة جداً':'Very easy', 'سهلة':'Easy', 'متوسطة':'Medium', 'صعبة':'Hard', 'صعبة جداً':'Very hard', 'ضد':'vs',
    'لم يُنشر جدول هذه الجولة على mfsoccer بعد — تظهر المباريات هنا تلقائياً أول ما تُنشر.':'This gameweek has not been published on mfsoccer yet — fixtures appear here automatically once published.',
    'نتيجة تقديرية':'Estimated result', 'شباك نظيفة حتى الآن':'clean sheet so far', 'على أرضه':'home', 'خارج أرضه':'away',
    // الدوريات
    '+ إنشاء دوري':'+ Create league', 'الانضمام برمز':'Join with code', 'فريق':'teams', 'مركزك:':'Your rank:', 'الرمز:':'Code:',
    '→ كل الدوريات':'← All leagues', '→ الدوريات':'← Leagues', 'رمز الدعوة:':'Invite code:', 'نسخ':'Copy', 'المدير':'Manager', 'الفريق':'Team',
    'آخر جولة':'Last GW', 'المجموع':'Total', 'التشكيلة':'Lineup', 'أنت':'You', 'الترتيب العام — دوري زين الممتاز':'Overall table — Zain Premier League',
    'ف/ت/خ':'W/D/L', 'ن. المواجهات':'H2H pts', 'جارٍ تحميل الدوري…':'Loading league…', 'عرض':'View',
    'جارٍ جلب التشكيلة…':'Loading lineup…', 'لم يكوّن هذا المشترك فريقاً بعد.':'This manager has not created a team yet.',
    // الدخول
    'دخول':'Log in', 'حساب جديد':'Sign up', 'نسيت كلمة المرور':'Forgot password', 'البريد الإلكتروني':'Email', 'كلمة المرور':'Password',
    'الدخول عبر Google':'Continue with Google', 'أو':'or', 'اسم المستخدم':'Username', 'اسم الفريق':'Team name', 'إنشاء الحساب':'Create account',
    'إرسال رابط الاستعادة':'Send reset link', 'فانتسي الدوري الكويتي':'Kuwait League Fantasy',
    'دوري زين الممتاز 2026/27 — كوّن فريقك ونافس أصحابك':'Zain Premier League 2026/27 — build your team and compete with friends',
    'جارٍ الاتصال…':'Connecting…', 'جارٍ تحميل فريقك…':'Loading your team…', 'جارٍ الدخول…':'Signing in…', 'جارٍ فتح Google…':'Opening Google…',
    'خروج':'Log out', 'تسجيل الخروج':'Log out', 'الملف الشخصي':'Profile', 'حفظ':'Save',
    // الدعم
    'رسالة جديدة للدعم الفني':'New message to support', 'محادثاتك مع الدعم':'Your support conversations', 'النوع':'Type', 'الرسالة':'Message',
    'إرسال':'Send', 'اقتراح':'Suggestion', 'مشكلة أو خطأ':'Problem or bug', 'خطأ في بيانات لاعب/مباراة':'Wrong player/match data', 'أخرى':'Other',
    'اكتب اقتراحك أو المشكلة بالتفصيل…':'Describe your suggestion or the problem…', 'اكتب ردّك…':'Write your reply…', 'أنت':'You', 'الدعم الفني':'Support',
    'جديد':'New', 'مقروء':'Seen', 'منفّذ':'Done', 'مرفوض':'Declined', 'رد جديد':'New reply',
    'لا رسائل بعد — أرسل أول رسالة من الصندوق أعلاه ويصلك الرد هنا.':'No messages yet — send your first one above and the reply will appear here.',
    'التواصل مع المطوّر':'Contact the developer', 'جارٍ التحميل…':'Loading…',
    // عام
    'تمام':'OK', 'إغلاق':'Close', 'نعم':'Yes', 'لا':'No', 'حذف':'Delete', 'تعديل':'Edit', 'المزيد':'More', 'الكل':'All',
    'الأندية':'Clubs', 'الجولة':'Gameweek', 'الكرت':'Chip', 'كرت:':'Chip:',
    // الأندية
    'الكويت':'Kuwait', 'القادسية':'Qadsia', 'العربي':'Al-Arabi', 'كاظمة':'Kazma', 'السالمية':'Salmiya', 'النصر':'Al-Nasr', 'الشباب':'Al-Shabab',
    'الجهراء':'Al-Jahra', 'الفحيحيل':'Fahaheel', 'الساحل':'Al-Sahel', 'التضامن':'Tadamon', 'الصليبيخات':'Sulaibikhat', 'الصليبخات':'Sulaibikhat',
  },

  /* أنماط فيها أرقام أو أجزاء متغيرة */
  RX: [
    [/^الجولة (\d+) · موعد الإغلاق$/, 'Gameweek $1 · Deadline'],
    [/^الجولة (\d+) جارية — التشكيلة مقفلة حتى اعتماد الجولة$/, 'Gameweek $1 in progress — lineup locked until confirmed'],
    [/^الجولة (\d+) ·$/, 'Gameweek $1 ·'],
    [/^الجولة (\d+)$/, 'Gameweek $1'],
    [/^تشكيلة الجولة (\d+)$/, 'Gameweek $1 lineup'],
    [/^التشكيلة المقفلة للجولة (\d+)$/, 'Locked lineup for Gameweek $1'],
    [/^ج(\d+)$/, 'GW$1'],
    [/^بديل (\d+) · (.+)$/, (m, n, p) => 'Sub ' + n + ' · ' + (I18N.DICT[p] || p)],
    [/^(\d+) من (\d+)$/, '$1 of $2'],
    [/^(\d+(?:\.\d+)?) نقطة$/, '$1 pts'],
    [/^(\d+) فريق$/, '$1 teams'],
    [/^(\d+) لاعب$/, '$1 players'],
    [/^مركزك: (.+)$/, 'Your rank: $1'],
    [/^الجولة (\d+) · موعد الإغلاق (.+)$/, 'Gameweek $1 · Deadline $2'],
    [/^الفورمة \(آخر (\d+)\)$/, 'Form (last $1)'],
    [/^مباريات الجولة (\d+)$/, 'Gameweek $1 fixtures'],
    [/^مجاني: (\d+) · الإضافي −(\d+)$/, 'Free: $1 · extra −$2'],
    [/^أُضيف (.+)$/, 'Added $1'],
    [/^فُعّل كرت (.+) لهذه الجولة$/, 'Chip $1 activated for this gameweek'],
    [/^الترتيب العام — (.+)$/, 'Overall table — $1'],
    [/^(.+) \(H\)$/, (m, c) => (I18N.DICT[c] || c) + ' (H)'],
    [/^(.+) \(A\)$/, (m, c) => (I18N.DICT[c] || c) + ' (A)'],
    [/^(.+) · (حارس|مدافع|وسط|مهاجم)$/, (m, c, p) => (I18N.DICT[c] || c) + ' · ' + I18N.DICT[p]],
  ],

  /* مفاتيح القاموس مرتبة من الأطول للأقصر حتى يُفضَّل الاسم الكامل على جزء منه */
  _keysSorted:null,
  /* [مفتاح، نمط كلمة كاملة، ترجمة] — الاستبدال داخل النصوص الطويلة يكون لكلمات كاملة فقط
     (لا يُلمس جزء من كلمة: «توليد» لا تُصبح «تWaleed») */
  keys(){
    if(!this._keysSorted){
      const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      this._keysSorted = Object.keys(this.DICT).filter(k=>k.length>3).sort((a,b)=>b.length-a.length)
        .map(k=>[k, new RegExp('(?<![\\u0600-\\u06FF])'+esc(k)+'(?![\\u0600-\\u06FF])','g'), this.DICT[k]]);
    }
    return this._keysSorted;
  },
  /* ترجمة ما يُعرف داخل نص طويل (أسماء لاعبين وأندية وعبارات) مع إبقاء الباقي */
  trIn(str){
    str = String(str==null? '' : str);
    const exact = this.tr(str.trim()); if(exact!=null) return str.replace(str.trim(), exact);
    let out = str;
    for(const [k,rx,en] of this.keys()){ if(out.includes(k)) out = out.replace(rx, en); }
    return out;
  },
  tr(key){
    if(!key) return null;
    if(this.DICT[key]!=null) return this.DICT[key];
    for(const [rx, rep] of this.RX){
      if(rx.test(key)) return typeof rep==='function' ? key.replace(rx, rep) : key.replace(rx, rep);
    }
    return null;
  },

  /* ترجمة شجرة DOM (عقد نصية + سمات) */
  apply(root){
    if(!this.isEn()) return;
    root = root || document.body; if(!root) return;
    const AR=/[؀-ۿ]/;
    const walker=document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: n => { const p=n.parentNode; if(!p || p.nodeName==='SCRIPT' || p.nodeName==='STYLE') return NodeFilter.FILTER_REJECT;
        if(p.closest && p.closest('[data-i18n="off"]')) return NodeFilter.FILTER_REJECT;   // أسماء المشتركين والفرق والدوريات لا تُترجم
        return AR.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP; }
    });
    const nodes=[]; let n; while((n=walker.nextNode())) nodes.push(n);
    for(const node of nodes){
      const t=node.nodeValue, key=t.trim(); if(!key) continue;
      const en=this.tr(key);
      if(en!=null){ if(en!==key){ if(node._i18nAr==null) node._i18nAr=t; node.nodeValue=t.replace(key, en); } continue; }
      // نص طويل يحوي عدة جمل: ترجمة كل جملة معروفة
      let changed=false, out=t;
      for(const [k,rx,en] of this.keys()){ if(out.includes(k)){ const o2=out.replace(rx,en); if(o2!==out){ out=o2; changed=true; } } }
      if(changed){ if(node._i18nAr==null) node._i18nAr=t; node.nodeValue=out; }
    }
    const els=root.querySelectorAll ? root.querySelectorAll('[placeholder],[title],[aria-label]') : [];
    els.forEach(el=>{
      for(const a of ['placeholder','title','aria-label']){
        const v=el.getAttribute(a); if(v && AR.test(v)){ const en=this.tr(v.trim()); if(en!=null){ el._i18nAttr=el._i18nAttr||{}; if(el._i18nAttr[a]==null) el._i18nAttr[a]=v; el.setAttribute(a, en); } }
      }
    });
    if(root.nodeType===1 && root.hasAttribute && root.hasAttribute('placeholder')){ const v=root.getAttribute('placeholder'); const en=this.tr((v||'').trim()); if(en!=null){ root._i18nAttr=root._i18nAttr||{}; if(root._i18nAttr.placeholder==null) root._i18nAttr.placeholder=v; root.setAttribute('placeholder', en); } }
  },

  /* الرجوع للعربية: العناصر الثابتة في الصفحة (الترويسة وغيرها) لا تُعاد كتابتها عند الرسم،
     فنعيد لها نصها العربي الأصلي المحفوظ وقت الترجمة */
  restore(root){
    root = root || document.body; if(!root) return;
    const walker=document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes=[]; let n; while((n=walker.nextNode())) nodes.push(n);
    for(const node of nodes){ if(node._i18nAr!=null){ node.nodeValue=node._i18nAr; node._i18nAr=null; } }
    const els=root.querySelectorAll ? root.querySelectorAll('*') : [];
    els.forEach(el=>{ if(el._i18nAttr){ for(const a in el._i18nAttr) el.setAttribute(a, el._i18nAttr[a]); el._i18nAttr=null; } });
  },

  /* مراقبة الرسم: أي محتوى جديد يُترجم فوراً */
  _obs:null,
  watch(){
    if(this._obs || !document.body) return;
    this._obs=new MutationObserver(muts=>{
      if(!this.isEn()) return;
      for(const m of muts){
        if(m.type==='childList') m.addedNodes.forEach(nd=>{ if(nd.nodeType===1) this.apply(nd); else if(nd.nodeType===3 && /[؀-ۿ]/.test(nd.nodeValue)){ const en=this.tr(nd.nodeValue.trim()); if(en!=null && en!==nd.nodeValue.trim()){ if(nd._i18nAr==null) nd._i18nAr=nd.nodeValue; nd.nodeValue=nd.nodeValue.replace(nd.nodeValue.trim(), en); } } });
        else if(m.type==='characterData' && /[؀-ۿ]/.test(m.target.nodeValue)){ const en=this.tr(m.target.nodeValue.trim()); if(en!=null && en!==m.target.nodeValue.trim()){ if(m.target._i18nAr==null) m.target._i18nAr=m.target.nodeValue; m.target.nodeValue=m.target.nodeValue.replace(m.target.nodeValue.trim(), en); } }
      }
    });
    this._obs.observe(document.body, {childList:true, subtree:true, characterData:true});
  },

  setLang(l){
    try{ localStorage.setItem(this.KEY, l==='en'?'en':'ar'); }catch(e){}
    this.applyDir();
    if(l!=='en') this.restore(document.body);
    if(typeof APP!=='undefined'){ APP.render(); }
    if(l==='en') this.apply(document.body);
    if(typeof UI!=='undefined') UI.toast(l==='en' ? 'English' : 'العربية');
  },
  toggle(){ this.setLang(this.isEn() ? 'ar' : 'en'); },
  applyDir(){
    const en=this.isEn();
    document.documentElement.setAttribute('dir', en?'ltr':'rtl');
    document.documentElement.setAttribute('lang', en?'en':'ar');
    document.documentElement.classList.toggle('lang-en', en);
  },
  init(){
    this.applyDir();
    this.watch();
    if(this.isEn()) this.apply(document.body);
  },
};

document.addEventListener('DOMContentLoaded', ()=>I18N.init());
if(document.readyState!=='loading') I18N.init();
