/* =========================================================
   الإشراف على المحتوى — شرط App Store (بند 1.2)
   ثلاث ركائز يطلبها المُراجع في أي تطبيق فيه محتوى مستخدمين:
     ١) مرشّح تلقائي يمنع الأسماء المسيئة قبل حفظها
     ٢) زر إبلاغ عن أي مشترك، يصل للإدارة
     ٣) حظر يخفي المشترك عن المُبلِّغ فوراً بلا انتظار مراجعة
   الأسماء الظاهرة للجميع: اسم المستخدم، اسم الفريق، اسم الدوري الخاص.
   ========================================================= */
'use strict';

const MODERATION = {

  /* ---------- ١) مرشّح الأسماء ---------- */

  /* القائمة على مستويين — لأن المطابقة الجزئية على جذر من حرفين تحرق
     أسماء حقيقية: «الخرافي» و«زبير» و«خولة» و«نيكولاس» و«مكسيم» كلها
     تحتوي جذوراً بذيئة وهي أسماء كويتية وعربية عادية.

     WORD: تُطابَق ككلمة كاملة فقط. تشمل الملصوقة («ك س» تصير «كس»)
           فتُمنع الحيلة، ويبقى «كسب» و«مكسيم» مسموحين. */
  WORD: [
    'كس','طيز','زب','زبي','خرا','خره','خول','نيك','منيك','لعن','لعنه',
    'وسخ','وسخه','ديوث','لوطي','داعش',
    'dick','rape','nazi','isis','daesh','wtf'
  ],

  /* SUB: كلمات طويلة لا تلتبس بغيرها — تكفي فيها المطابقة الجزئية،
     فتلتقط «شرموطه» و«يا_شرموط» و«fuckyou». */
  SUB: [
    'شرموط','قحبه','عاهره','متناك','طياز','معرص','منيوك',
    'fuck','shit','bitch','cunt','pussy','asshole','whore','slut',
    'nigger','nigga','faggot','hitler','porn','sex'
  ],

  /* انتحال صفة رسمية — مطابقة تامة */
  IMPERSONATE: ['ادمن','أدمن','admin','moderator','مشرف','الاداره','الإدارة','support','الدعم','mfsoccer','رسمي','official'],

  /* تجريد التشكيل والتطويل وتوحيد الألف والياء والهاء، ثم إسقاط كل ما
     ليس حرفاً أو رقماً — فتلتصق الحروف المفرّقة في سلسلة واحدة */
  norm(txt){
    return String(txt||'')
      .replace(/[ً-ْـ]/g,'')                    // تشكيل وتطويل
      .replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/[ةه]/g,'ه')
      .replace(/[^\p{L}\p{N}]/gu,'')
      .toLowerCase();
  },

  /* كل كلمة على حدة، منظّفة */
  words(txt){
    return String(txt||'').split(/[^\p{L}\p{N}]+/u).map(w=>this.norm(w)).filter(Boolean);
  },

  /* سبب الرفض، أو null إذا كان الاسم سليماً */
  checkName(txt, what){
    const raw = String(txt||'').trim();
    const label = what || 'الاسم';
    if(raw.length < 2)  return `${label} قصير جداً`;
    if(raw.length > 24) return `${label} طويل — 24 حرفاً كحد أقصى`;
    if(/(https?:|www\.|\.com|@)/i.test(raw)) return `${label} لا يقبل روابط أو بريداً`;

    const glued = this.norm(raw);
    if(!glued) return `${label} يجب أن يحتوي حروفاً`;

    if(this.SUB.some(w=> glued.includes(this.norm(w))))
      return `${label} يحتوي لفظاً غير لائق — اختر غيره`;

    /* الكلمات المفردة، ومعها النص كله ملصوقاً حتى لا تنفع «ك س» */
    const set = new Set(this.words(raw).concat([glued]));
    if(this.WORD.some(w=> set.has(this.norm(w))))
      return `${label} يحتوي لفظاً غير لائق — اختر غيره`;

    if(this.IMPERSONATE.some(w=> set.has(this.norm(w))))
      return `${label} محجوز — لا يمكن انتحال صفة رسمية`;
    return null;
  },

  /* ---------- ٢) الحظر (محلي وفوري) ---------- */

  KEY: 'kwf_blocked',
  list(){
    try{ const a=JSON.parse(localStorage.getItem(this.KEY)||'[]'); return Array.isArray(a)? a : []; }
    catch(e){ return []; }
  },
  save(a){ try{ localStorage.setItem(this.KEY, JSON.stringify(a.slice(0,500))); }catch(e){} },
  isBlocked(uid){ return !!uid && this.list().some(x=>x.id===uid); },
  block(uid, name){
    if(!uid || this.isBlocked(uid)) return;
    const a=this.list(); a.push({id:uid, name:String(name||''), at:Date.now()}); this.save(a);
  },
  unblock(uid){ this.save(this.list().filter(x=>x.id!==uid)); },

  /* الاسم كما يُعرض: المحظور يختفي اسمه ويبقى صفّه حتى لا يختلّ الترتيب */
  shown(uid, name){ return this.isBlocked(uid) ? 'مشترك محظور' : name; },

  /* ---------- ٣) البلاغ ---------- */

  REASONS: [
    'اسم مسيء أو غير لائق',
    'انتحال شخصية أو صفة رسمية',
    'إعلان أو رسائل مزعجة',
    'تلاعب أو غش',
    'سبب آخر'
  ],

  async send(uid, name, reason, note){
    if(typeof CLOUD==='undefined' || !CLOUD.ready) return {ok:false, err:'تعذّر الاتصال بالخادم'};
    if(!CLOUD.user) return {ok:false, err:'سجّل الدخول لإرسال بلاغ'};
    try{
      await CLOUD.root().collection('reports').add({
        target: String(uid||''),
        targetName: String(name||'').slice(0,60),
        reason: String(reason||'').slice(0,80),
        note: String(note||'').slice(0,400),
        by: CLOUD.user.uid,
        at: new Date().toISOString()
      });
      return {ok:true};
    }catch(e){ return {ok:false, err: CLOUD.errAr(e)}; }
  },
};
