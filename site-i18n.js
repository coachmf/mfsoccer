/* =========================================================
   mfsoccer — اللغة الإنجليزية (ترجمة الواجهة بعد الرسم)
   الصفحة مكتوبة بالعربية في القوالب؛ عند اختيار English تُستبدل النصوص
   المعروفة في العقد النصية والسمات (placeholder/title/aria-label) بعد كل
   رسم عبر MutationObserver، ويُقلب اتجاه الصفحة إلى LTR. ما ليس في
   القاموس يبقى عربياً. أسماء اللاعبين تأتي من fantasy/js/i18n-more.js
   (NAMES_EN) إن حُمّل قبل هذا الملف.
   القاموس: النص العربي كما يُرسَم → الإنجليزي. الرمز ⟨x⟩ يعني جزءاً
   متغيراً (رقم/اسم) يُترجم بدوره إن كان معروفاً.
   التبديل: I18N.toggle() — يُحفظ في localStorage بمفتاح mf_lang.
   ========================================================= */
'use strict';

const I18N = {
  KEY: 'mf_lang',
  lang(){ try{ const q=new URLSearchParams(location.search).get('lang'); if(q==='en'||q==='ar'){ localStorage.setItem(this.KEY,q); return q; }
      return localStorage.getItem(this.KEY)==='en' ? 'en' : 'ar'; }catch(e){ return 'ar'; } },
  isEn(){ return this.lang()==='en'; },
  locale(){ return this.isEn() ? 'en-GB' : 'ar-KW'; },

  MON: {'يناير':'January','فبراير':'February','مارس':'March','أبريل':'April','مايو':'May','يونيو':'June','يوليو':'July','أغسطس':'August','سبتمبر':'September','أكتوبر':'October','نوفمبر':'November','ديسمبر':'December'},
  DOW: {'أحد':'Sun','إثنين':'Mon','ثلاثاء':'Tue','أربعاء':'Wed','خميس':'Thu','جمعة':'Fri','سبت':'Sat'},

  /* ---------- القاموس: الواجهة العامة ---------- */
  DICT: {
    // أيام الأسبوع والتقويم والجدول
    'أحد':'Sun', 'إثنين':'Mon', 'ثلاثاء':'Tue', 'أربعاء':'Wed', 'خميس':'Thu', 'جمعة':'Fri', 'سبت':'Sat', 'التفاصيل':'Details',
    '⟨x⟩ في هذا الشهر — اضغط أي يوم مضيء لعرض مبارياته.':'⟨x⟩ this month — tap any highlighted day to see its matches.',
    '⟨x⟩ في هذا الشهر — اضغط أي يوم مضيء لعرض مبارياته. الأيام الذهبية مبارياتها لم تبدأ بعد.':'⟨x⟩ this month — tap any highlighted day to see its matches. Gold days have matches not yet played.',
    '⟨x⟩ أُقيمت · الترتيب بالنقاط ثم فارق الأهداف ثم الأهداف المسجلة.':'⟨x⟩ played · ranked by points, then goal difference, then goals scored.',
    '⟨x⟩ أُقيمت · ⟨x⟩ لم تبدأ بعد ولا تُحتسب في الجدول · الترتيب بالنقاط ثم فارق الأهداف ثم الأهداف المسجلة.':'⟨x⟩ played · ⟨x⟩ not started yet and not counted in the table · ranked by points, then goal difference, then goals scored.',
    '⟨x⟩ نقطة · المركز ⟨x⟩':'⟨x⟩ pts · position ⟨x⟩', '⟨x⟩ · من ⟨x⟩ مباراة':'⟨x⟩ · of ⟨x⟩ matches', 'أمام':'v', 'لم يلعب بعد':'Not played yet',
    // العنوان والوصف
    'إحصائيات الدوري الكويتي الممتاز 2026/2027 | mfsoccer':'Kuwait Premier League Statistics 2026/2027 | mfsoccer',
    'إحصائيات الدوري الكويتي الممتاز 2026/2027':'Kuwait Premier League Statistics 2026/2027',
    'إحصائيات الدوري الكويتي الممتاز':'Kuwait Premier League Statistics',
    'الدوري الكويتي الممتاز':'Kuwait Premier League', 'الموسم':'Season',
    'موسم 2026/2027 · أرقام المباريات والأهداف واللاعبين وجدول الترتيب':'2026/2027 season · match, goal and player numbers and the league table',
    // الترويسة والتنقل
    'دخول المدير':'Admin login', 'أقسام الموقع':'Site sections', 'الإحصائيات':'Statistics', 'فانتسي':'Fantasy', 'التوقعات':'Predictions',
    'الرئيسية':'Home', 'المباريات':'Matches', 'الأندية':'Clubs', 'اللاعبون':'Players', 'الجمهور':'Fans', 'التحليل':'Analysis',
    'نتائج آخر جولة':'Latest round results', 'راسلنا على واتساب':'Message us on WhatsApp', 'اقتراح؟ راسلنا':'Suggestion? Message us',
    'اقتراحاتكم':'Your suggestions', 'بإشراف':'Supervised by', 'القادم':'Next', 'نتائج الجولة ⟨x⟩':'Round ⟨x⟩ results',
    'سياسة الخصوصية':'Privacy policy', 'شروط الاستخدام':'Terms of use',
    'اللغة':'Language', 'الوضع الداكن':'Dark mode', 'الوضع الفاتح':'Light mode',
    // التطبيق
    'افتحه من شاشتك مباشرة، ويعمل بلا إنترنت.':'Open it straight from your home screen — it works offline.', 'ثبّت التطبيق':'Install the app',
    'تثبيت':'Install', 'إغلاق':'Close', 'صدرت نسخة جديدة — أعد التحميل لتظهر':'A new version is out — reload to see it', 'نسخة جديدة جاهزة.':'New version ready.', 'تحديث':'Update',
    // المسابقات والأندية
    'الدوري':'League', 'كأس الأمير':'Emir Cup', 'كأس السوبر':'Super Cup', 'كأس سمو ولي العهد':'Crown Prince Cup', 'كل المسابقات':'All competitions',
    'الكويت':'Kuwait', 'القادسية':'Qadsia', 'العربي':'Al-Arabi', 'كاظمة':'Kazma', 'السالمية':'Salmiya', 'النصر':'Al-Nasr', 'الشباب':'Al-Shabab',
    'الجهراء':'Al-Jahra', 'الفحيحيل':'Fahaheel', 'الساحل':'Al-Sahel', 'التضامن':'Tadamon', 'الصليبخات':'Sulaibikhat', 'الصليبيخات':'Sulaibikhat',
    'سا':'SAL', 'عر':'ARB', 'قا':'QAD', 'كا':'KAZ', 'كو':'KUW', 'نص':'NSR', 'تض':'TAD', 'جه':'JAH', 'سح':'SAH', 'شب':'SHB', 'صل':'SUL', 'فح':'FAH',
    // تصنيفات الأهداف
    'اختراق فردي':'Solo run', 'القدم اليسرى':'Left foot', 'القدم اليمنى':'Right foot', 'الرأس':'Header', 'لعب مفتوح':'Open play',
    'داخل منطقة الجزاء - يسار':'Inside the box — left', 'داخل منطقة الجزاء - وسط':'Inside the box — centre', 'داخل منطقة الجزاء - يمين':'Inside the box — right',
    'خارج منطقة الجزاء - يسار':'Outside the box — left', 'خارج منطقة الجزاء - وسط':'Outside the box — centre', 'خارج منطقة الجزاء - يمين':'Outside the box — right',
    'منطقة المرمى - يسار':'Six-yard box — left', 'منطقة المرمى - وسط':'Six-yard box — centre', 'منطقة المرمى - يمين':'Six-yard box — right',
    'مسافة بعيدة (+30م)':'Long range (30m+)', 'مسافة بعيدة':'Long range', 'علامة الجزاء':'Penalty spot',
    'تمريرة بينية':'Through ball', 'عرضية من اللعب المفتوح':'Cross from open play', 'ركلة جزاء':'Penalty', 'كرات ثابتة':'Set pieces',
    'ركلة حرة غير مباشرة':'Indirect free kick', 'ركلة حرة مباشرة':'Direct free kick', 'خطأ دفاعي / استخلاص ضغط':'Defensive error / pressing turnover',
    'متابعة كرة مرتدة':'Rebound follow-up', 'هجمة مرتدة':'Counter-attack', 'بناء من الخلف':'Build-up from the back', 'تسديدة من خارج المنطقة':'Shot from outside the box',
    'ركنية':'Corner', 'ركلة حرة مرتدة من الحائط':'Free kick rebound off the wall', 'ركلة حرة مرتدة من الحارس':'Free kick rebound off the keeper',
    'متابعة ركنية مرتدة':'Corner rebound follow-up', 'رمية تماس':'Throw-in', 'غير ذلك':'Other', 'سجلت':'Scored', 'سُجّلت':'Scored',
    'خارج المرمى':'Off target', 'وسط أسفل':'Bottom centre', 'وسط أعلى':'Top centre', 'يسار أسفل':'Bottom left', 'يسار أعلى':'Top left', 'يمين أسفل':'Bottom right', 'يمين أعلى':'Top right',
    'أعيدت':'Retaken', 'القائم / العارضة':'Post / crossbar', 'تصدى لها الحارس':'Saved by the keeper', 'العارضة':'Crossbar', 'خارج إطار المرمى':'Off target',
    'إنذار ثانٍ':'Second yellow', 'طرد مباشر':'Straight red', '· ارتدت عن':'· deflected off', 'هدف عكسي':'Own goal', 'هدف عكسي⟨x⟩':'Own goal⟨x⟩',
    'مضمّنة في الملف':'Embedded in the file', 'نسخة محلية محفوظة':'Saved local copy', 'data.json المنشور':'published data.json', 'نسخة محلية':'Local copy',
    'السحابة':'Cloud', 'assets.json المنشور':'published assets.json',
    // أعداد
    'التبديلات (⟨x⟩)':'Substitutions (⟨x⟩)', '⟨x⟩ أهداف':'⟨x⟩ goals', '⟨x⟩ هدفاً':'⟨x⟩ goals', '⟨x⟩ هدف':'⟨x⟩ goals', 'مباراتين':'2 matches', '⟨x⟩ مباريات':'⟨x⟩ matches',
    '⟨x⟩ مباراة':'⟨x⟩ matches', '⟨x⟩ ركلات':'⟨x⟩ penalties', '⟨x⟩ ركلة':'⟨x⟩ penalties', '⟨x⟩ نقطة':'⟨x⟩ pts', '⟨x⟩ لاعباً':'⟨x⟩ players', '⟨x⟩ زيارة':'⟨x⟩ visits',
    '⟨x⟩ لم تبدأ':'⟨x⟩ not started', '⟨x⟩ من 11':'⟨x⟩ of 11', '⟨x⟩ مباراة · ⟨x⟩ هدفاً':'⟨x⟩ matches · ⟨x⟩ goals',
    'ص':'AM', 'م':'PM', 'خسارة':'Loss', 'فوز':'Win', 'تعادل':'Draw', 'هدفاً':'goals', 'فئة':'categories', 'أعلى 3 فئات':'Top 3 categories',
    // الرئيسية
    'ملخص':'Summary', 'إجمالي الأهداف':'Total goals', 'معدل أهداف المباراة':'Goals per match', 'هدف لكل مباراة':'goals per match', 'الكرات الثابتة':'Set pieces',
    'من أهداف الدوري':'of league goals', 'المتصدر':'Leader', 'تنبيه:':'Note:',
    'جدول الترتيب يُحتسب بنظام الدوري. في مسابقات الكؤوس اعتبره ترتيباً بالنقاط لا جدولاً رسمياً.':'The table is calculated on a league basis. For cup competitions treat it as a points ranking, not an official table.',
    'جدول الترتيب':'League table', 'الفورمة':'Form', 'النادي':'Club', 'ت':'D', 'خ':'L', 'ف':'W', 'عليه':'GA', 'له':'GF', 'لعب':'P', 'نقاط':'Pts', 'المركز':'Pos',
    'أرقام لافتة':'Notable numbers', 'كل رقم هنا يُحتسب لحظياً من سجل الأهداف — لا يُكتب يدوياً.':'Every number here is computed live from the goal log — nothing is typed by hand.',
    'أكبر فارق نتيجة':'Biggest winning margin', 'أعلى مباراة تسجيلاً':'Highest-scoring match', 'أسرع هدف':'Fastest goal', '⟨x⟩ — ⟨x⟩ ضد ⟨x⟩':'⟨x⟩ — ⟨x⟩ vs ⟨x⟩',
    'أكثر الأهداف تأخراً':'Latest goal', 'نصيب الكرات الثابتة':'Set-piece share', '⟨x⟩ من ⟨x⟩ هدفاً':'⟨x⟩ of ⟨x⟩ goals', 'نصيب الشوط الثاني':'Second-half share',
    '⟨x⟩ بعد الاستراحة':'⟨x⟩ after the break', 'نسبة فوز صاحب الهدف الأول':'First-goal win rate', '⟨x⟩ من ⟨x⟩ حُسمت لمن سجّل أولاً':'⟨x⟩ of ⟨x⟩ won by the team that scored first',
    'من أصل ⟨x⟩ احتُسبت':'out of ⟨x⟩ counted', 'ملخص الدوري':'League summary', '⟨x⟩ في ⟨x⟩':'⟨x⟩ in ⟨x⟩', 'فوز صاحب الهدف الأول':'First-goal wins',
    'الدوري الكويتي الممتاز · ⟨x⟩ · ⟨x⟩':'Kuwait Premier League · ⟨x⟩ · ⟨x⟩', '⬇ تصدير صورة':'⬇ Export image', '🖨 تقرير PDF':'🖨 PDF report',
    'المباراة القادمة — ⟨x⟩ أمام ⟨x⟩':'Next match — ⟨x⟩ v ⟨x⟩', 'المباراة القادمة':'Next match', 'التفاصيل ›':'Details ›', 'جارية الآن':'Live now', 'الاستراحة':'Half-time',
    'بعد يوم واحد':'in 1 day', 'بعد يومين':'in 2 days', 'بعد ⟨x⟩ أيام':'in ⟨x⟩ days', 'بعد ⟨x⟩ يوماً':'in ⟨x⟩ days', 'بعد ساعة':'in 1 hour', 'بعد ساعتين':'in 2 hours',
    'بعد ⟨x⟩ ساعات':'in ⟨x⟩ hours', 'بعد دقيقة':'in 1 minute', 'بعد ⟨x⟩ دقيقة':'in ⟨x⟩ minutes',
    // المباريات
    'الجولة':'Round', 'الجولة ⟨x⟩':'Round ⟨x⟩', 'الجولة ⟨x⟩ · ⟨x⟩':'Round ⟨x⟩ · ⟨x⟩', 'الجولة ⟨x⟩⟨x⟩':'Round ⟨x⟩⟨x⟩', 'الجولة ⟨x⟩⟨x⟩ — ⟨x⟩':'Round ⟨x⟩⟨x⟩ — ⟨x⟩',
    'لم تبدأ':'Not started', 'بلا تاريخ':'No date', 'لا توجد مباريات ضمن هذا التحديد.':'No matches in this selection.', 'الشوط الأول':'First half', 'النهاية':'Full time',
    'الكل':'All', 'أُقيمت':'Played', 'أهداف':'Goals', 'بطاقات':'Cards', 'من':'From', 'إلى':'To', 'تفصيل':'Detail',
    'بطولة خارجية':'External competition', 'توقف الدوري':'League break', 'مناسبة':'Event', 'منتخب':'National team',
    'الشهر التالي':'Next month', 'الشهر السابق':'Previous month', 'إلغاء التحديد':'Clear selection',
    'الأيام الذهبية مبارياتها لم تبدأ بعد.':'Gold days have matches not yet played.', 'الأيام ذات الخط الذهبي فيها مناسبة.':'Days with a gold line have an event.', 'لا مباريات في هذا الشهر.':'No matches this month.',
    'خريطة مرمى ركلات الجزاء':'Penalty goal map', 'مجموع الركلات':'Total penalties', 'الأكثر تكراراً':'Most common', 'ركلات الجزاء':'Penalties',
    'المرمى':'Goal', 'يسار':'Left', 'يمين':'Right', 'أقل':'Fewer', 'أكثر':'More', 'لا توجد أهداف ضمن هذا التصنيف.':'No goals in this category.',
    '⟨x⟩ هدفاً معروضاً · الاتجاه من أسفل إلى أعلى نحو المرمى · اليسار واليمين من زاوية المهاجم.':"⟨x⟩ goals shown · direction is bottom to top towards the goal · left and right from the attacker's view.",
    'أهداف عليه':'Goals against', 'أهدافه':'Goals for', 'خرج':'Off', 'دخل':'On', 'الشوط':'Half', 'الدقيقة':'Minute', 'إنذار':'Yellow', 'طرد':'Red', 'بطاقة':'card',
    // الأندية
    'اختر النادي':'Choose a club', 'لم يلعب بعد':'Not played yet', 'مباريات':'Matches', 'فوز / تعادل / خسارة':'Win / Draw / Loss', 'سجّل / استقبل':'Scored / Conceded',
    'فارق الأهداف':'Goal difference', 'معدل النقاط':'Points per match', 'أهداف الكرات الثابتة':'Set-piece goals', 'ركلات جزاء مسجّلة':'Penalties scored', 'أهداف الرأس':'Headed goals',
    'أهداف بعد الدقيقة 76':'Goals after minute 76', 'سجّل الهدف الأول في':'Scored first in', 'الهدّاف':'Top scorer', 'الانضباط':'Discipline', 'الإنذارات':'Yellow cards',
    'حالات الطرد':'Red cards', 'معدل الإنذارات لكل مباراة':'Yellow cards per match', 'أكثر لاعبيه إنذاراً':'Most booked player',
    'لا توجد بيانات انضباط بعد — أضف ورقة «سجل الإنذارات» في ملف الاستوديو.':'No discipline data yet — add the "Cards log" sheet to the studio file.',
    'دقائق اللعب والشباك النظيفة':'Minutes played and clean sheets', 'شباك نظيفة للنادي':'Club clean sheets', 'لم تُرصد تشكيلات لهذا النادي بعد.':'No line-ups recorded for this club yet.',
    'الدقائق':'Minutes', 'اللاعب':'Player', 'شباك نظيفة':'Clean sheets', 'ركلات الجزاء — خريطة المرمى':'Penalties — goal map', 'توقيت الأهداف':'Goal timing', 'المجموع':'Total',
    'خريطة أماكن التسجيل':'Goal location map', 'أهداف النادي':'Club goals', 'ضد ⟨x⟩':'vs ⟨x⟩', '· ⟨x⟩ ضد ⟨x⟩':'· ⟨x⟩ vs ⟨x⟩', 'لا توجد أهداف مسجّلة بعد.':'No goals recorded yet.',
    'تشكيلة الجولة':'Round line-up', 'لم تُرصد تشكيلة أساسية لهذا النادي بعد.':'No starting line-up recorded for this club yet.', 'خارج أرضه':'Away', 'على أرضه':'Home', '⟨x⟩ أمام ⟨x⟩':'⟨x⟩ v ⟨x⟩',
    'حارس':'GK', 'مدافع':'DEF', 'وسط':'MID', 'مهاجم':'FWD', 'حراسة':'Goalkeeping', 'دفاع':'Defence', 'هجوم':'Attack',
    // اللاعبون
    'الهدافون':'Top scorers', 'صنّاع الأهداف':'Assists', 'صناعة':'Assist', 'الشباك النظيفة (الحرّاس)':'Clean sheets (goalkeepers)',
    'حرّاس المرمى الذين لعبوا 60 دقيقة فأكثر في مباريات لم يستقبل فيها فريقهم هدفاً.':'Goalkeepers who played 60 minutes or more in matches where their team did not concede.',
    'دقائق اللعب':'Minutes played', 'إجمالي دقائق كل لاعب من التشكيلات والتبديلات. اضغط رأس المباريات للترتيب الذهني.':"Each player's total minutes from line-ups and substitutions.",
    'لا توجد بيانات إنذارات بعد. أضف ورقة «سجل الإنذارات» في ملف الاستوديو بالأعمدة: الجولة · المسابقة · النادي · اللاعب · الدقيقة · النوع.':'No card data yet. Add the "Cards log" sheet to the studio file with the columns: Round · Competition · Club · Player · Minute · Type.',
    // التحليل
    'توزيع الأهداف على فترات المباراة':'Goals by match period', 'أكثر ما يميّز هذا الموقع عن مواقع النتائج — لا أحد يوفّر هذا التفصيل للدوري الكويتي.':'What sets this site apart from results sites — nobody else offers this detail for the Kuwaiti league.',
    'الخريطة الحرارية لأماكن التسجيل':'Goal location heat map', 'من أين تُسجَّل أهداف الدوري فعلياً؟ بدّل بين اللعب المفتوح والكرات الثابتة لترى الفرق.':'Where are league goals really scored from? Switch between open play and set pieces to see the difference.',
    'أين توضع ركلات الجزاء في هذا الدوري؟':'Where are penalties placed in this league?', 'أثر الهدف الأول':'Impact of the first goal', 'مباريات شهدت أهدافاً':'Matches with goals',
    'فاز صاحب الهدف الأول':'First scorer won', 'قُلبت النتيجة عليه':'Came back against', 'طريقة التسجيل':'How goals are scored', 'منطقة التسجيل':'Goal zone', 'وضعية التسجيل':'Scoring situation',
    'الإعدادات':'Settings',
    // الجمهور
    'تشكيلة الجمهور':"Fans' XI", 'يبدأ التصويت من الجولة ⟨x⟩ بعد انتهاء مبارياتها. لم تكتمل جولة مؤهَّلة بعد.':'Voting starts from Round ⟨x⟩ once its matches are over. No eligible round has finished yet.',
    'جارٍ الجلب…':'Loading…', 'جارٍ التحميل…':'Loading…', 'لم يُفتح التصويت لهذه الجولة بعد. يفتحه فريق العمل بعد رصد المباريات.':'Voting for this round has not opened yet. The team opens it once the matches are recorded.',
    'معتمدة':'Official', 'غير معتمدة':'Not official', 'من ⟨x⟩ · اعتمدها ⟨x⟩':'From ⟨x⟩ · approved by ⟨x⟩', 'الفرز حتى الآن':'Count so far', '⟨x⟩ · تصير رسمية باعتماد فريق العمل':'⟨x⟩ · becomes official once approved by the team',
    'لم تكتمل الأصوات لرسم التشكيلة بعد.':'Not enough votes to draw the line-up yet.', 'صوّت بتشكيلتك':'Vote your XI',
    'التصويت للمشتركين المسجّلين — سجّل دخولك من قسم':'Voting is for registered members — sign in from the', 'بنفس الحساب، ثم ارجع هنا.':'section with the same account, then come back here.',
    'الذهاب للتسجيل':'Go to sign-in', '— اختر —':'— choose —', 'عدّل تصويتك':'Edit your vote', 'صوتك مسجَّل':'Your vote is in', 'تقدر تعدّله ما دام التصويت مفتوحاً.':'You can change it while voting is open.',
    'اختر اللاعبين وتظهر تشكيلتك على الملعب':'Pick the players and your XI appears on the pitch', 'اختيارات الجولة':'Round picks', 'أفضل لاعب':'Player of the round', 'أفضل حارس':'Goalkeeper of the round',
    'هدف الجولة':'Goal of the round', 'إرسال التصويت':'Submit vote', 'تحديث التصويت':'Update vote', 'اختر أحد عشر لاعباً':'Pick eleven players', 'لا تكرّر لاعباً':"Don't pick a player twice",
    'اختر أفضل لاعب':'Pick the player of the round', 'اختر أفضل حارس':'Pick the goalkeeper of the round', 'اختر هدف الجولة':'Pick the goal of the round', 'جارٍ الإرسال…':'Sending…',
    'سُجّل تصويتك ✅':'Your vote is recorded ✅', 'المصوّتون':'Voters', 'المصوّتون (⟨x⟩)':'Voters (⟨x⟩)', 'لا أصوات بعد — كن أول المصوّتين.':'No votes yet — be the first.', 'مشترك':'member',
    'الرسم الفنّي':'Formation', 'الأكثر اختياراً: ⟨x⟩':'Most picked: ⟨x⟩', '— فارغة —':'— empty —', 'أصوات':'votes', 'صوت واحد':'1 vote', 'صوتان':'2 votes', 'صوتاً':'votes',
    'مصوّت واحد':'1 voter', 'مصوّتان':'2 voters', 'مصوّتاً':'voters', 'مصوّتين':'voters', 'التصويت مغلق':'Voting closed', 'التصويت مفتوح':'Voting open', 'التصويت مغلق لهذه الجولة':'Voting is closed for this round',
    'سجّل دخولك أولاً':'Sign in first',
    // التوقعات والحساب
    'لا نتائج.':'No results.', 'مخفي':'Hidden', 'إخفاء':'Hide', 'إظهار':'Show', 'ترتيبك في الموسم:':'Your season rank:', 'لم تُحتسب لك نقاط بعد':'No points counted for you yet', 'تغيير الاسم':'Change name',
    'نقاطك محفوظة على هذا المتصفح فقط — أضف بريداً لتدخل بها من أي جهاز.':'Your points are saved on this browser only — add an email to sign in from any device.', 'أضف بريداً':'Add email',
    'لا توجد جولة مفتوحة للتوقع حالياً.':'No round is open for predictions right now.', 'أُقفلت هذه الجولة ببداية أول مباراة. هذي توقعاتك المسجّلة.':'This round locked when the first match kicked off. These are your saved predictions.',
    'نتيجة مطابقة ⟨x⟩ نقاط · اتجاه صحيح نقطتان · هداف الجولة ⟨x⟩ نقاط. تُقفل التوقعات مع صافرة أول مباراة.':'Exact score ⟨x⟩ points · correct outcome 2 points · round top scorer ⟨x⟩ points. Predictions lock at the first kick-off.',
    'هداف الجولة':'Round top scorer', 'اختر النادي أولاً، وتظهر لك قائمة لاعبيه.':'Choose the club first and its players appear.', '— اختر النادي —':'— choose club —',
    'أرسل توقعاتي':'Submit my predictions', 'تحديث توقعاتي':'Update my predictions', 'ترتيب الجمهور':"Fans' table", '— اختر النادي أولاً —':'— choose the club first —',
    '— لا كشف لهذا النادي بعد —':'— no squad list for this club yet —', '— اختر اللاعب —':'— choose player —',
    'توقّع نتائج الجولة قبل انطلاقها ونافس بقية الجمهور. نتيجة مطابقة ⟨x⟩ نقاط، اتجاه صحيح نقطتان، وهداف الجولة ⟨x⟩ نقاط.':"Predict the round's results before kick-off and compete with the rest of the fans. Exact score ⟨x⟩ points, correct outcome 2 points, round top scorer ⟨x⟩ points.",
    'بالاسم فقط':'Name only', 'ببريد إلكتروني':'With email', 'الاسم الظاهر في جدول الترتيب':'Display name on the table', 'مثال: أبو فهد':'e.g. Abu Fahad', 'إنشاء حساب':'Create account',
    'عندك حساب؟':'Have an account?', 'ما عندك حساب؟':'No account?', 'أنشئ حساباً':'Create one', 'سجّل الدخول':'Sign in', 'تدخل بنقاطك من أي جهاز، ويشتغل في كل المتصفحات.':'Sign in with your points from any device — works in every browser.',
    'ادخل بالاسم':'Enter with a name', 'أسرع طريقة، بلا بريد ولا كلمة مرور. نقاطك تبقى على هذا المتصفح فقط — وتقدر تضيف بريداً لاحقاً وتحتفظ بها كاملة.':'The fastest way, no email or password. Your points stay on this browser only — you can add an email later and keep them all.',
    'لم يُحتسب أي ترتيب بعد. يظهر الجدول بعد انتهاء أول جولة.':'No table calculated yet. It appears after the first round ends.', 'الشهر':'Month', 'المشترك':'Member', 'النقاط':'Points',
    'لا نقاط في هذه الفترة.':'No points in this period.', 'اكتب اسماً من حرفين فأكثر':'Enter a name of at least 2 characters', 'لحظة…':'One moment…', 'عبّي البريد وكلمة المرور':'Fill in the email and password',
    'اكتب الاسم الظاهر في الترتيب':'Enter the display name for the table', 'البريد الإلكتروني:':'Email:', 'كلمة مرور جديدة (٦ أحرف فأكثر):':'New password (6+ characters):', 'الاسم الظاهر في جدول الترتيب:':'Display name on the table:',
    'تعذّر تغيير الاسم':'Could not change the name', 'حُدّث الاسم ✅':'Name updated ✅', 'سُجّلت توقعاتك ✅':'Your predictions are saved ✅', 'البريد الإلكتروني':'Email', 'كلمة المرور':'Password', 'دخول':'Sign in', 'خروج':'Sign out',
    'صيغة البريد غير صحيحة':'Invalid email format', 'صيغة البريد غير صحيحة.':'Invalid email format.', 'كلمة المرور قصيرة — ٦ أحرف على الأقل':'Password too short — at least 6 characters',
    'هذا البريد مسجّل مسبقاً — سجّل الدخول بدل إنشاء حساب':'This email is already registered — sign in instead', 'البريد أو كلمة المرور غير صحيحة':'Wrong email or password', 'البريد أو كلمة المرور غير صحيحة.':'Wrong email or password.',
    'تعذّر الاتصال — تحقق من الشبكة':'Connection failed — check your network', 'طريقة الدخول غير مفعّلة — فعّلها من Authentication ← Sign-in method':'Sign-in method not enabled — enable it in Authentication → Sign-in method',
    'هذا النطاق غير معتمد — أضفه في Authentication ← Settings ← Authorized domains':'This domain is not authorised — add it in Authentication → Settings → Authorized domains',
    'محاولات كثيرة — انتظر دقائق ثم أعد المحاولة':'Too many attempts — wait a few minutes and try again', 'محاولات كثيرة — انتظر قليلاً ثم أعد المحاولة.':'Too many attempts — wait a moment and try again.',
    'هذا الحساب موقوف':'This account is suspended', 'لا يوجد حساب بهذا البريد — أنشئ حساباً':'No account with this email — create one', 'لا يوجد حساب بهذا البريد.':'No account with this email.',
    'كلمة المرور غير صحيحة.':'Wrong password.', 'تعذّر الاتصال بالشبكة.':'Network connection failed.', 'هذا النطاق غير مصرّح به في إعدادات Firebase.':'This domain is not authorised in the Firebase settings.',
    'متصفحك يمنع تخزين الجلسة — جرّب فتح الصفحة في المتصفح نفسه بدل تطبيق آخر':'Your browser blocks session storage — try opening the page in the browser itself rather than inside another app',
    'دخلت بالاسم، لكن حفظ الاسم تأخّر — قد تحتاج كتابته مرة أخرى':'Signed in by name, but saving the name was delayed — you may need to enter it again',
    'الدخول بالاسم غير مفعّل — فعّل Anonymous من إعدادات Authentication':'Name sign-in is not enabled — enable Anonymous in the Authentication settings',
    'أُنشئ حسابك، لكن حفظ الاسم تأخّر — عدّله من صفحتك':'Your account was created, but saving the name was delayed — edit it from your page',
    'رُبط حسابك ✅ تقدر تدخل من أي جهاز بنفس البريد':'Account linked ✅ you can sign in from any device with the same email', 'هذا البريد مستخدم لحساب آخر':'This email is used by another account',
    'أُقفلت التوقعات — بدأت مباريات الجولة':'Predictions locked — the round has started', 'أُقفلت التوقعات لهذه الجولة':'Predictions are locked for this round', 'تعذّر الحفظ — أعد المحاولة':'Could not save — try again',
    // أسماء أجنبية من البيانات الافتراضية
    'فورتيس':'Fortes', 'فيتور':'Vitor', 'أوروك':'Oruk', 'ماتيوس توتو':'Matheus Toto', 'سانتوس':'Santos', 'الن ديسوزا':'Allan De Souza', 'اماث نداو':'Amath Ndaw', 'باتريك روبسون':'Patrick Robson',
    'ادريس شعيبي':'Idris Shuaibi', 'ايمن لقجع':'Aymen Lakjaa', 'غازي العتيبي':'Ghazi Al-Otaibi', 'عبدالله يوسف':'Abdullah Yousef', 'ناصر خضر':'Nasser Khudhur', 'علي حسن':'Ali Hassan',
    'يعقوب الطراروة':'Yaqoub Al-Tararwa', 'مشاري البارود':'Mishari Al-Baroud', 'فهد السلامة':'Fahad Al-Salama', 'عبدالرحمن الظفيري':'Abdulrahman Al-Dhafiri', 'محمد القحطاني':'Mohammad Al-Qahtani', 'شبيب الخالدي':'Shabib Al-Khaldi',
  },

  /* ---------- أنماط بأجزاء متغيرة (تُفحص قبل القاموس) ---------- */
  RX: [
    [/^1 (?:هدفاً|هدف|أهداف)$/, '1 goal'], [/^1 (?:مباراة|مباريات)$/, '1 match'], [/^1 (?:ركلة|ركلات)$/, '1 penalty'], [/^1 نقطة$/, '1 pt'], [/^1 زيارة$/, '1 visit'], [/^1 لاعباً$/, '1 player'],
    [/^بعد 1 (?:دقيقة|ساعات|أيام|يوماً)$/, 'in 1 minute'],
    [/^(أحد|إثنين|ثلاثاء|أربعاء|خميس|جمعة|سبت) (\d+) (يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)(?: · (\d+):(\d+) (ص|م))?$/,
      (m, d, n, mo, h, mi, ap) => I18N.DOW[d] + ' ' + n + ' ' + I18N.MON[mo].slice(0, 3) + (h ? ' · ' + h + ':' + mi + ' ' + (ap === 'م' ? 'PM' : 'AM') : '')],
    [/^(\d+) (يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)( \d{4})?$/, (m, n, mo, y) => n + ' ' + I18N.MON[mo].slice(0, 3) + (y || '')],
    [/^(\d+) (يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر) — (\d+) (يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)$/,
      (m, a, ma, b, mb) => a + ' ' + I18N.MON[ma].slice(0, 3) + ' — ' + b + ' ' + I18N.MON[mb].slice(0, 3)],
    [/^(يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر) (\d{4})$/, (m, mo, y) => I18N.MON[mo] + ' ' + y],
    [/^الجولة (\d+) · (\d+) (يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر) (\d{4})$/, (m, r, n, mo, y) => 'Round ' + r + ' · ' + n + ' ' + I18N.MON[mo] + ' ' + y],
    [/^(\d+)%$/, '$1%'],
  ],

  /* ---------- المحرك ---------- */
  _cmp: null,
  /* المفاتيح التي فيها ⟨x⟩ تُحوَّل إلى أنماط: كل جزء متغير يُترجم بدوره */
  compile(){
    if(this._cmp) return this._cmp;
    const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const list = [];
    for(const k in this.DICT){
      if(!k.includes('⟨x⟩')) continue;
      const parts = k.split('⟨x⟩');
      const rx = new RegExp('^' + parts.map(esc).join('(.+?)') + '$');
      const loose = new RegExp('(?<![\u0600-\u06FF])' + parts.map(esc).join('(.+?)') + '(?![\u0600-\u06FF])');
      list.push([rx, this.DICT[k], parts.length - 1, k.length, loose]);
    }
    list.sort((a, b) => b[3] - a[3]);
    this._cmp = list;
    return list;
  },
  tr(key){
    if(!key) return null;
    if(this.DICT[key] != null) return this.DICT[key];
    for(const [rx, rep] of this.RX){ if(rx.test(key)) return key.replace(rx, rep); }
    for(const [rx, en, n] of this.compile()){
      const m = key.match(rx); if(!m) continue;
      let out = en, i = 1;
      while(out.includes('⟨x⟩')){ out = out.replace('⟨x⟩', () => this.trIn(m[i++] || '')); }
      return out;
    }
    return null;
  },
  _keysSorted: null,
  keys(){
    if(!this._keysSorted){
      const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      this._keysSorted = Object.keys(this.DICT).filter(k => k.length > 3 && !k.includes('⟨x⟩')).sort((a, b) => b.length - a.length)
        .map(k => [k, new RegExp('(?<![\\u0600-\\u06FF])' + esc(k) + '(?![\\u0600-\\u06FF])', 'g'), this.DICT[k]]);
    }
    return this._keysSorted;
  },
  /* ترجمة ما يُعرف داخل نص طويل (كلمات كاملة فقط) */
  trIn(str){
    str = String(str == null ? '' : str);
    const t = str.trim(); if(!t) return str;
    const exact = this.tr(t.replace(/\s+/g, ' ')); if(exact != null) return str.replace(t, exact);
    let out = str;
    for(const [k, rx, en] of this.keys()){ if(out.includes(k)) out = out.replace(rx, en); }
    return out;
  },
  _node(node){
    const t = node.nodeValue; if(!t || !/[؀-ۿ]/.test(t)) return;
    const m = t.match(/^(\s*)([\s\S]*?)(\s*)$/); const key = m[2].replace(/\s+/g, ' '); if(!key) return;
    let en = this.tr(key);
    if(en == null){
      let out = key, changed = false;
      for(const [rx, e, n, len, loose] of this.compile()){ if(len < 12 || !loose.test(out)) continue;
        const o2 = out.replace(loose, (...g) => { let r = e, i = 1; while(r.includes('⟨x⟩')) r = r.replace('⟨x⟩', () => this.trIn(g[i++] || '')); return r; });
        if(o2 !== out){ out = o2; changed = true; } }
      for(const [k, rx, e] of this.keys()){ if(out.includes(k)){ const o2 = out.replace(rx, e); if(o2 !== out){ out = o2; changed = true; } } }
      if(!changed) return; en = out;
    }
    if(en === key) return;
    if(node._i18nAr == null) node._i18nAr = t;
    /* خيارات القوائم المنسدلة: الموقع يقرأ قيمة الخيار من نصه، فنثبّت القيمة العربية قبل الترجمة */
    const p = node.parentNode;
    if(p && p.nodeName === 'OPTION' && !p.hasAttribute('value')){ p.setAttribute('value', key); p._i18nVal = true; }
    node.nodeValue = m[1] + en + m[3];
  },
  apply(root){
    if(!this.isEn()) return;
    root = root || document.body; if(!root) return;
    if(root.nodeType === 3){ this._node(root); return; }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: n => { const p = n.parentNode; if(!p || p.nodeName === 'SCRIPT' || p.nodeName === 'STYLE') return NodeFilter.FILTER_REJECT;
        if(p.closest && p.closest('[data-i18n="off"]')) return NodeFilter.FILTER_REJECT;
        return /[؀-ۿ]/.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP; }
    });
    const nodes = []; let n; while((n = walker.nextNode())) nodes.push(n);
    for(const node of nodes) this._node(node);
    const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
    const els = root.querySelectorAll ? Array.from(root.querySelectorAll('[placeholder],[title],[aria-label],[alt]')) : [];
    if(root.nodeType === 1 && root.hasAttribute) els.unshift(root);
    els.forEach(el => {
      for(const a of ATTRS){
        const v = el.getAttribute && el.getAttribute(a); if(!v || !/[؀-ۿ]/.test(v)) continue;
        const en = this.tr(v.trim().replace(/\s+/g, ' ')); if(en == null) continue;
        el._i18nAttr = el._i18nAttr || {}; if(el._i18nAttr[a] == null) el._i18nAttr[a] = v; el.setAttribute(a, en);
      }
    });
    if(root === document.body){ const tt = this.tr(document.title.trim()); if(tt){ if(this._title == null) this._title = document.title; document.title = tt; } }
  },
  restore(root){
    root = root || document.body; if(!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = []; let n; while((n = walker.nextNode())) nodes.push(n);
    for(const node of nodes){ if(node._i18nAr != null){ node.nodeValue = node._i18nAr; node._i18nAr = null; } }
    root.querySelectorAll('*').forEach(el => { if(el._i18nAttr){ for(const a in el._i18nAttr) el.setAttribute(a, el._i18nAttr[a]); el._i18nAttr = null; } if(el._i18nVal){ el.removeAttribute('value'); el._i18nVal = false; } });
    if(this._title != null){ document.title = this._title; this._title = null; }
  },
  _obs: null,
  watch(){
    if(this._obs || !document.body) return;
    this._obs = new MutationObserver(muts => {
      if(!this.isEn()) return;
      for(const m of muts){
        if(m.type === 'childList') m.addedNodes.forEach(nd => { if(nd.nodeType === 1 || nd.nodeType === 3) this.apply(nd); });
        else if(m.type === 'characterData'){ const nd = m.target; if(nd._i18nAr != null && nd.nodeValue === (nd._i18nAr && nd._i18nLast)) continue; this._node(nd); }
        else if(m.type === 'attributes'){ const el = m.target, a = m.attributeName, v = el.getAttribute(a);
          if(v && /[؀-ۿ]/.test(v)){ const en = this.tr(v.trim()); if(en != null && en !== v){ el._i18nAttr = el._i18nAttr || {}; if(el._i18nAttr[a] == null) el._i18nAttr[a] = v; el.setAttribute(a, en); } } }
      }
    });
    this._obs.observe(document.body, {childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'title', 'aria-label']});
  },
  applyDir(){
    const en = this.isEn();
    document.documentElement.setAttribute('dir', en ? 'ltr' : 'rtl');
    document.documentElement.setAttribute('lang', en ? 'en' : 'ar');
    document.documentElement.classList.toggle('lang-en', en);
    const b = document.getElementById('langBtn'); if(b){ b.textContent = en ? 'ع' : 'EN'; b.title = b.ariaLabel = en ? 'العربية' : 'English'; }
  },
  setLang(l){
    try{ localStorage.setItem(this.KEY, l === 'en' ? 'en' : 'ar'); }catch(e){}
    if(l !== 'en') this.restore(document.body);
    this.applyDir();
    if(l === 'en') this.apply(document.body);
    if(typeof toast === 'function') toast(l === 'en' ? 'English' : 'العربية');
  },
  toggle(){ this.setLang(this.isEn() ? 'ar' : 'en'); },
  init(){
    /* أسماء اللاعبين من قاموس الفانتسي إن وُجد */
    if(typeof NAMES_EN !== 'undefined'){
      for(const ar in NAMES_EN){ if(this.DICT[ar] == null) this.DICT[ar] = NAMES_EN[ar]; }
    }
    if(typeof DICT_ADMIN !== 'undefined') for(const k in DICT_ADMIN){ if(this.DICT[k] == null) this.DICT[k] = DICT_ADMIN[k]; }
    /* الحوارات المنبثقة (alert/confirm/prompt) */
    for(const fn of ['alert', 'confirm', 'prompt']){
      const orig = window[fn]; if(typeof orig !== 'function') continue;
      window[fn] = (msg, ...rest) => orig.call(window, this.isEn() ? this.trIn(msg) : msg, ...rest);
    }
    this.applyDir();
    this.watch();
    if(this.isEn()) this.apply(document.body);
  },
};


/* ---------- قاموس لوحة الإدارة (يُدمج في I18N.DICT عند التهيئة) ---------- */
const DICT_ADMIN = {
  // قراءة ملف الإكسل
  'اسم':'Name', 'سجل الأهداف':'Goals log', 'سجل المباريات':'Matches log', 'سجل ركلات الجزاء':'Penalties log', 'سجل الإنذارات':'Cards log', 'سجل البطاقات':'Cards log',
  '،':',', 'الملف ينقص أوراقاً أساسية:':'The file is missing essential sheets:', 'اسم الموسم':'Season name', 'لم أتمكن من قراءة أسماء الأندية من ورقة الإعدادات.':'Could not read the club names from the Settings sheet.',
  'سجل الأهداف صف ⟨x⟩: نادٍ غير معروف «⟨x⟩»':'Goals log row ⟨x⟩: unknown club "⟨x⟩"', 'سجل الأهداف صف ⟨x⟩: رقم الجولة فارغ':'Goals log row ⟨x⟩: round number is empty',
  'سجل الأهداف صف ⟨x⟩: الدقيقة فارغة':'Goals log row ⟨x⟩: minute is empty', 'سجل الأهداف صف ⟨x⟩: منطقة التسجيل فارغة':'Goals log row ⟨x⟩: goal zone is empty',
  'سجل الأهداف صف ⟨x⟩: التصنيف والتفصيل فارغان':'Goals log row ⟨x⟩: category and detail are empty', 'سجل الأهداف صف ⟨x⟩: اسم اللاعب فارغ':'Goals log row ⟨x⟩: player name is empty',
  'البطولة':'Competition', 'المسابقة':'Competition', 'الاستاد':'Stadium', 'الملعب':'Venue', 'التوقيت':'Time', 'الوقت':'Time', 'ساعة':'Hour',
  'سجل المباريات صف ⟨x⟩: مباراة مكررة':'Matches log row ⟨x⟩: duplicate match', 'سجل المباريات صف ⟨x⟩: نادٍ غير معروف «⟨x⟩»':'Matches log row ⟨x⟩: unknown club "⟨x⟩"',
  'سجل المباريات صف ⟨x⟩: رقم الجولة فارغ':'Matches log row ⟨x⟩: round number is empty', 'سجل الأهداف صف ⟨x⟩: لا توجد مباراة مطابقة في سجل المباريات':'Goals log row ⟨x⟩: no matching match in the matches log',
  'مكان التسديد':'Shot placement', 'مكان الركلة':'Kick placement', 'موضع التسديد':'Shot position', 'سجل ركلات الجزاء صف ⟨x⟩: مكان تسديد غير معروف «⟨x⟩»':'Penalties log row ⟨x⟩: unknown placement "⟨x⟩"',
  'الفريق':'Team', 'البطاقة':'Card', '⟨x⟩ صف ⟨x⟩: نادٍ غير معروف «⟨x⟩»':'⟨x⟩ row ⟨x⟩: unknown club "⟨x⟩"', '⟨x⟩ صف ⟨x⟩: نوع بطاقة غير معروف «⟨x⟩»':'⟨x⟩ row ⟨x⟩: unknown card type "⟨x⟩"',
  'ملف بيانات':'Data file', '(بلا عنوان)':'(untitled)', 'حذف':'Delete',
  // المناسبات
  'المناسبات وفترات التوقف':'Events and breaks', 'مباريات المنتخب، والأندية في البطولات الخارجية، وأي توقف للدوري. تظهر للجمهور في رزنامة المباريات فيعرف سبب الانقطاع.':'National team matches, clubs in external competitions, and any league break. Shown to fans in the match calendar so they know why there is a gap.',
  'لا مناسبات مسجّلة.':'No events recorded.', 'العنوان':'Title', 'مثال: الأزرق أمام قطر — تصفيات كأس العالم':'e.g. Kuwait v Qatar — World Cup qualifiers', 'النوع':'Type', 'من تاريخ':'From date',
  'إلى تاريخ (اتركه فارغاً ليوم واحد)':'To date (leave empty for a single day)', 'تفصيل إضافي (اختياري)':'Extra detail (optional)', 'مثال: يتوقف الدوري خلال هذه الفترة':'e.g. the league pauses during this period', 'إضافة المناسبة':'Add event',
  'اكتب عنوان المناسبة':'Enter the event title', 'اختر تاريخ البداية':'Choose the start date', 'تاريخ النهاية قبل البداية':'End date is before the start', 'أُضيفت المناسبة ✅':'Event added ✅', 'حذف هذه المناسبة؟':'Delete this event?', 'حُذفت المناسبة':'Event deleted', 'تعذّر الحذف':'Could not delete',
  // تشكيلة الجمهور (إدارة)
  'يبدأ التصويت من الجولة ⟨x⟩ بعد رصد كل مبارياتها.':'Voting starts from Round ⟨x⟩ once all its matches are recorded.',
  'افتح التصويت بعد رصد مباريات الجولة كاملة. الجمهور يختار أحد عشر لاعباً ورسماً فنّياً وأفضل لاعب وحارس وهدفاً، ثم تراجع الفرز وتعتمده فيصير رسمياً على الموقع.':'Open voting once all the round\'s matches are recorded. Fans pick eleven players, a formation, a player, a goalkeeper and a goal; then you review the count and approve it so it becomes official on the site.',
  '🔒 إغلاق التصويت':'🔒 Close voting', '🚀 فتح التصويت':'🚀 Open voting', 'تحديث الأصوات':'Refresh votes', 'لا أصوات بعد.':'No votes yet.', 'الفرز — ⟨x⟩':'Count — ⟨x⟩', 'اعتماد ونشر':'Approve and publish',
  'محرّر آخر':'another editor', 'وصل تحديث من ⟨x⟩ — دُمج قبل الحفظ':'An update arrived from ⟨x⟩ — merged before saving', 'وصل تحديث من ⟨x⟩ — دُمج قبل الحذف':'An update arrived from ⟨x⟩ — merged before deleting', 'وصل تحديث من ⟨x⟩':'An update arrived from ⟨x⟩',
  'حُفظت الحالة، لكن تعذّر تحديث قفل الخادم':'State saved, but the server lock could not be updated', 'أُغلق التصويت':'Voting closed', 'فُتح التصويت ✅':'Voting opened ✅', 'تعذّر الحفظ':'Could not save', 'حُدّثت الأصوات':'Votes refreshed',
  'أكمل أحد عشر لاعباً قبل الاعتماد':'Complete eleven players before approving', 'لاعب مكرر في التشكيلة':'Duplicate player in the line-up', 'جارٍ الاعتماد…':'Approving…', 'اعتُمدت تشكيلة الجمهور ✅':'Fans\' XI approved ✅', 'تعذّر الاعتماد':'Could not approve',
  // القمصان
  'القميص':'Shirt', 'الرقم':'Number', 'الرجوع للون الافتراضي ⟨x⟩':'Back to the default colour ⟨x⟩', 'تلقائي':'Auto', 'ألوان القمصان على الملعب':'Shirt colours on the pitch',
  'لون قميص كل نادٍ ولون رقمه كما يظهران في تشكيلة الملعب. الافتراضي مأخوذ من ألوان النادي — الكويت أبيض ورقمه أحمر — وتقدر تغيّرهما هنا. المعاينة على اليمين تتحدث فوراً، والحفظ يسري على كل الأجهزة.':'Each club\'s shirt and number colour as shown in the pitch line-up. The default comes from the club colours — Kuwait white with a red number — and you can change them here. The preview updates instantly and saving applies on all devices.',
  'حفظ الألوان':'Save colours', 'جارٍ الحفظ…':'Saving…', 'حُفظت الألوان ✅':'Colours saved ✅', 'حُفظت محلياً، لكن تعذّر الحفظ في السحابة':'Saved locally, but could not save to the cloud',
  // النسخ الاحتياطية
  'السحابة غير متاحة':'Cloud unavailable', 'النسخة غير موجودة':'Backup not found', 'النسخة فارغة — لم تُطبَّق':'Backup is empty — not applied', 'استرجاع نسخة احتياطية':'Restore a backup',
  'استُرجعت النسخة: ⟨x⟩ مباراة و⟨x⟩ تشكيلة و⟨x⟩ تبديلاً':'Backup restored: ⟨x⟩ matches, ⟨x⟩ line-ups and ⟨x⟩ substitutions', 'طُبّقت محلياً لكن تعذّر الحفظ في السحابة':'Applied locally but could not save to the cloud', 'تعذّر الاسترجاع':'Could not restore',
  'النسخ الاحتياطية':'Backups', 'تُحفظ نسخة كاملة تلقائياً بعد كل حفظ ناجح، ويبقى آخر ⟨x⟩. لو ضاعت تشكيلات أو تبديلات أو أهداف، ارجع لنسخة قبل الضياع بضغطة واحدة.':'A full backup is saved automatically after every successful save, keeping the last ⟨x⟩. If line-ups, substitutions or goals go missing, go back to an earlier backup with one click.',
  '↻ تحديث القائمة':'↻ Refresh list', 'لا توجد نسخ بعد — تُنشأ أول نسخة عند أول حفظ.':'No backups yet — the first one is created at the first save.', 'استرجاع':'Restore',
  'استرجاع هذه النسخة؟\n\n⟨x⟩ مباراة · ⟨x⟩ تشكيلة · ⟨x⟩ تبديلاً\n\nستُحفظ حالتك الراهنة كنسخة قبل الاستبدال.':'Restore this backup?\n\n⟨x⟩ matches · ⟨x⟩ line-ups · ⟨x⟩ substitutions\n\nYour current state will be saved as a backup before replacing.', 'جارٍ الاسترجاع…':'Restoring…',
  // رفع الملفات
  'بنية غير متوقعة':'Unexpected structure', 'تعذّرت القراءة:':'Could not read:', 'تحتاج اتصالاً بالإنترنت لقراءة ملفات xlsx، أو استخدم ملف data.json بدلاً منها.':'You need an internet connection to read xlsx files, or use a data.json file instead.',
  'مكتبة قراءة الإكسل غير متاحة الآن.':'The Excel reader library is not available right now.', 'و⟨x⟩ تنبيهاً آخر…':'and ⟨x⟩ more warnings…', 'الملف':'File', 'الأهداف':'Goals', 'الإنذارات وحالات الطرد':'Yellow and red cards',
  'التشكيلات الأساسية':'Starting line-ups', 'غير مشمولة — تبقى كما هي (⟨x⟩)':'Not included — kept as is (⟨x⟩)', 'التبديلات':'Substitutions', 'المسابقات':'Competitions', 'آخر جولة':'Last round', 'تنبيهات تحتاج مراجعة':'Warnings needing review', 'حقول ناقصة':'Missing fields',
  'أعمدة التفصيل والتصنيف تُحسب بصيغ داخل الإكسل، وهي فارغة هنا. افتح الملف في إكسل واحفظه مرة واحدة، ثم أعد الرفع.':'The detail and category columns are computed by formulas inside Excel and are empty here. Open the file in Excel, save it once, then upload again.',
  'يبدو أن صيغ الملف لم تُحدَّث.':'The file\'s formulas seem not to have been recalculated.', 'تنبيهات':'Warnings', 'اعتماد هذه البيانات وتحديث الموقع':'Approve this data and update the site',
  'لا توجد أخطاء بنيوية — البيانات جاهزة للاعتماد.':'No structural errors — the data is ready to approve.', 'يمكنك الاعتماد رغم التنبيهات، لكن الأرقام قد تكون ناقصة. راجع الصفوف أعلاه في ملف الإكسل أولاً.':'You can approve despite the warnings, but the numbers may be incomplete. Review the rows above in the Excel file first.',
  'ملف مرفوع:':'Uploaded file:', 'اعتُمدت البيانات: ⟨x⟩ مباراة و⟨x⟩ هدفاً':'Data approved: ⟨x⟩ matches and ⟨x⟩ goals', 'و⟨x⟩ تشكيلة و⟨x⟩ تبديلاً':'and ⟨x⟩ line-ups and ⟨x⟩ substitutions', '· حُفظت في السحابة ✅':'· saved to the cloud ✅',
  'اعتُمدت محلياً، لكن تعذّر الحفظ في السحابة':'Approved locally, but could not save to the cloud', 'جارٍ التنفيذ…':'Working…', 'تعذّرت قراءة الملف':'Could not read the file', 'الملف ليس صورة صالحة':'The file is not a valid image',
  '⟨x⟩: ⟨x⟩ ك.ب ← ⟨x⟩ ك.ب':'⟨x⟩: ⟨x⟩ KB → ⟨x⟩ KB', 'تعذّرت معالجة ⟨x⟩: ⟨x⟩':'Could not process ⟨x⟩: ⟨x⟩',
  // السحابة والتشخيص
  'مالك':'Owner', 'لم يُهيّأ':'Not initialised', 'مكتبة السحابة غير متاحة':'Cloud library unavailable', 'متصل':'Connected', 'تعذّر التهيئة':'Initialisation failed', 'تعذّرت القراءة من السحابة':'Could not read from the cloud',
  'الاتصال بطيء — حُفظ محلياً وسيُرسل تلقائياً عند عودة الشبكة.':'Slow connection — saved locally and will be sent automatically when the network returns.', 'تعذّر الحفظ:':'Could not save:', 'خطأ غير معروف':'Unknown error',
  'السحابة (قبل الحفظ)':'Cloud (before saving)', 'السحابة (تحديث حيّ)':'Cloud (live update)', 'الاتصال بطيء — أعد المحاولة بعد قليل.':'Slow connection — try again shortly.', 'تعذّر حفظ فريق العمل:':'Could not save the staff:',
  'ك.ب من 1024). اضغط «إعادة ضغط كل الصور» أو احذف بعضها.':'KB of 1024). Press "Recompress all images" or delete some.', '⚠️ الصور تجاوزت حد السحابة (':'⚠️ Images exceed the cloud limit (',
  'الاتصال بطيء — حُفظت الصور محلياً وستُرسل عند عودة الشبكة.':'Slow connection — images saved locally and will be sent when the network returns.', 'تعذّر حفظ الصور:':'Could not save the images:',
  'تحميل مكتبة Firebase':'Loading the Firebase library', 'لم تُحمّل — تحقق من الاتصال أو من مانع الإعلانات':'Not loaded — check the connection or an ad blocker', 'تهيئة Firestore':'Firestore initialisation', 'طريقة الفتح':'How the site was opened',
  'الملف مفتوح محلياً — Firestore يرفض file://':'The file is opened locally — Firestore rejects file://', 'تسجيل الدخول':'Sign-in', 'لم تسجّل الدخول':'Not signed in', 'مطابقة حساب المدير':'Admin account match', 'الـ UID لا يطابق:':'UID does not match:',
  'قراءة من السحابة':'Cloud read', 'لا استجابة خلال 9 ثوانٍ — الاتصال محجوب غالباً':'No response within 9 seconds — the connection is probably blocked', 'القاعدة تعمل لكن الوثيقة غير موجودة بعد':'The database works but the document does not exist yet', 'الوثيقة موجودة':'Document exists',
  'كتابة اختبارية':'Test write', 'لا استجابة خلال 9 ثوانٍ':'No response within 9 seconds', 'نجحت':'Succeeded',
  'مانع إعلانات أو برنامج حماية يحجب مكتبة Firebase. عطّله لهذا الموقع.':'An ad blocker or security software is blocking the Firebase library. Disable it for this site.', 'افتح الموقع من رابط mfsoccer.com لا من ملف على جهازك.':'Open the site from mfsoccer.com, not from a file on your device.',
  'سجّل الدخول أولاً.':'Sign in first.', 'هذا الحساب ليس المدير — الكتابة مرفوضة بالقواعد.':'This account is not the admin — writes are rejected by the rules.',
  'الاتصال بـ Firestore محجوب تماماً. الأسباب الشائعة: برنامج حماية مثل McAfee، أو إضافة حجب إعلانات، أو شبكة مقيّدة. جرّب نافذة تصفح خفي بلا إضافات، أو شبكة أخرى مثل بيانات الجوال.':'The connection to Firestore is fully blocked. Common causes: security software such as McAfee, an ad-blocking extension, or a restricted network. Try an incognito window without extensions, or another network such as mobile data.',
  'قاعدة Firestore لم تُنشأ بعد. ارجع لـ Firebase ← Firestore Database ← Create database.':'The Firestore database has not been created yet. Go to Firebase → Firestore Database → Create database.',
  'القواعد ترفض الكتابة. تأكد من نشر قواعد Firestore بالضغط على Publish، ومن صحة الـ UID فيها.':'The rules reject writes. Make sure the Firestore rules are published (Publish) and that the UID in them is correct.',
  'القراءة تعمل والكتابة معلّقة — غالباً حجب جزئي. جرّب تصفحاً خفياً أو شبكة أخرى.':'Reads work but writes hang — probably partial blocking. Try incognito or another network.', 'كل شيء سليم. أعد المحاولة الآن.':'Everything is fine. Try again now.',
  'اختر':'Choose', 'مكرر: ⟨x⟩':'Duplicate: ⟨x⟩', 'ناقص ⟨x⟩':'Missing ⟨x⟩', 'زائد ⟨x⟩':'Extra ⟨x⟩',
  // محرّر المباراة
  'الفريق المضيف':'Home team', 'الفريق الضيف':'Away team', 'التاريخ':'Date', 'ملاحظة تظهر للجمهور (اختيارية)':'Note shown to fans (optional)', 'التشكيلة الأساسية (⟨x⟩)':'Starting line-up (⟨x⟩)',
  'أحد عشر لاعباً لكل فريق. من لا يُذكر هنا يُعدّ بديلاً، ولا تُحتسب له دقائق إلا إن دخل ضمن التبديلات.':'Eleven players per team. Anyone not listed here counts as a substitute and gets no minutes unless they come on in the substitutions.',
  '(مسجّل ⟨x⟩)':'(recorded ⟨x⟩)', 'أساسي ⟨x⟩':'Starter ⟨x⟩', '+ إضافة لاعب أساسي':'+ Add starter', 'شكل التشكيلة على الملعب':'Line-up shape on the pitch',
  'اختر طريقة اللعب، واسحب أي لاعب لموضعه الفعلي. المراكز في الكشف تصف اللاعب عموماً، وهذا يوثّق كيف لعب في هذه المباراة تحديداً — ويظهر للجمهور كما تضبطه.':'Choose the formation and drag any player to his actual position. Squad positions describe the player in general; this records how he played in this specific match — and fans see it as you set it.',
  'اقلب التشكيلة يمين↔يسار':'Flip the line-up right↔left', '⇄ اعكس الجهات':'⇄ Flip sides', 'إرجاع التلقائي':'Reset to auto',
  'الخارج والداخل والشوط والدقيقة. منها تُحسب دقائق كل لاعب، وعليها تُبنى نقاط المشاركة والشباك النظيفة في الفانتسي.':'Player off, player on, half and minute. Each player\'s minutes are computed from these, and fantasy appearance and clean-sheet points are built on them.',
  '· الدقيقة ⟨x⟩':'· minute ⟨x⟩', '+ إضافة تبديل':'+ Add substitution', 'الأهداف (⟨x⟩)':'Goals (⟨x⟩)', 'الفريق المسجل':'Scoring team', 'اللاعب المسجل':'Scorer', 'صانع الهدف':'Assist', 'إضافي':'Extra', 'تفصيل طريقة التسجيل':'How it was scored',
  'ارتدت عن (لاعب الفريق الخصم)':'Deflected off (opposition player)', '+ إضافة هدف':'+ Add goal', 'الإنذارات (⟨x⟩)':'Cards (⟨x⟩)', 'إنذار ثانٍ = طرد':'Second yellow = red', '+ إضافة بطاقة':'+ Add card', 'ركلات الجزاء (⟨x⟩)':'Penalties (⟨x⟩)',
  'ركلة ⟨x⟩':'Penalty ⟨x⟩', 'الفريق المنفّذ':'Taking team', 'اللاعب المنفّذ':'Taker', 'النتيجة':'Outcome', '+ إضافة ركلة جزاء':'+ Add penalty', 'حفظ المباراة':'Save match', 'إلغاء':'Cancel',
  'النتيجة تُحتسب تلقائياً من الأهداف — لا تُكتب. والقوائم هنا مطابقة لقوائم ملف الإكسل.':'The score is computed automatically from the goals — it is not typed. The lists here match the Excel file lists.',
  'أدخل رقم الجولة.':'Enter the round number.', 'اختر الفريق المضيف والفريق الضيف.':'Choose the home and away teams.', 'لا يمكن أن يواجه النادي نفسه.':'A club cannot play itself.', 'أدخل تاريخ المباراة.':'Enter the match date.',
  'هذه المباراة مسجّلة مسبقاً في هذه الجولة والمسابقة.':'This match is already recorded in this round and competition.', 'الهدف ⟨x⟩: اختر الفريق المسجل.':'Goal ⟨x⟩: choose the scoring team.', 'الهدف ⟨x⟩: اكتب اسم اللاعب.':'Goal ⟨x⟩: enter the player name.',
  'الهدف ⟨x⟩: أدخل الدقيقة.':'Goal ⟨x⟩: enter the minute.', 'الهدف ⟨x⟩: اختر تفصيل طريقة التسجيل.':'Goal ⟨x⟩: choose how it was scored.', 'البطاقة ⟨x⟩: اختر النادي.':'Card ⟨x⟩: choose the club.', 'البطاقة ⟨x⟩: اختر النوع.':'Card ⟨x⟩: choose the type.',
  'ركلة الجزاء ⟨x⟩: اختر الفريق المنفّذ.':'Penalty ⟨x⟩: choose the taking team.', 'ركلة الجزاء ⟨x⟩: اختر النتيجة.':'Penalty ⟨x⟩: choose the outcome.', 'جارٍ حفظ المباراة…':'Saving match…', 'إدخال يدوي في الموقع':'Manual entry on the site',
  'حُفظت المباراة: ⟨x⟩ ضد ⟨x⟩ ✅':'Match saved: ⟨x⟩ vs ⟨x⟩ ✅', 'أكثر من لاعب بهذا الرقم:':'More than one player with this number:', 'ما فيه لاعب بهذا الرقم في الكشف':'No player with this number in the squad',
  'حذف هذه المباراة وكل أهدافها وبطاقاتها وركلاتها؟':'Delete this match with all its goals, cards and penalties?', 'تعديل مباراة':'Edit match', 'مباراة جديدة':'New match', 'تعديل':'Edit', '+ إضافة مباراة جديدة':'+ Add new match',
  'المباريات المسجّلة (⟨x⟩)':'Recorded matches (⟨x⟩)', 'لا مباريات بعد.':'No matches yet.',
  // الشعارات والملفات
  'نزّل الملف — ارفعه إلى GitHub بجانب index.html':'File downloaded — upload it to GitHub next to index.html', 'الملف لا يحتوي شعارات':'The file contains no logos', 'ملف مستورد':'Imported file',
  'استُوردت الشعارات (⟨x⟩ ك.ب) ✅':'Logos imported (⟨x⟩ KB) ✅', 'استُوردت محلياً، وتعذّر رفعها للسحابة':'Imported locally, but could not upload to the cloud', 'جارٍ الفحص…':'Checking…', 'قد يستغرق الفحص حتى عشرين ثانية…':'The check may take up to twenty seconds…',
  'التشخيص:':'Diagnosis:', 'الاتصال سليم بالكامل':'Connection is fully healthy', 'وُجدت مشكلة — التفاصيل بالأسفل':'A problem was found — details below', 'جارٍ إعادة ضغط الصور…':'Recompressing images…', 'جارٍ الضغط…':'Compressing…',
  'تم الضغط: ⟨x⟩ ك.ب ← ⟨x⟩ ك.ب · حُفظ في السحابة':'Compressed: ⟨x⟩ KB → ⟨x⟩ KB · saved to the cloud', 'ضُغطت إلى ⟨x⟩ ك.ب · ⟨x⟩':'Compressed to ⟨x⟩ KB · ⟨x⟩', 'ضُغطت إلى ⟨x⟩ ك.ب لكن الحفظ في السحابة فشل':'Compressed to ⟨x⟩ KB but saving to the cloud failed',
  'السحابة غير متاحة — افتح الموقع من نطاقه المنشور':'Cloud unavailable — open the site from its published domain', 'سجّل الدخول أولاً':'Sign in first', 'إخفاء لعبة الفانتسي عن الجمهور؟':'Hide the fantasy game from the public?',
  'جارٍ الإخفاء…':'Hiding…', 'جارٍ الإشهار…':'Publishing…', 'أُخفيت اللعبة عن الجمهور':'The game is hidden from the public', 'أُشهرت اللعبة — صارت ظاهرة لكل الزوار':'The game is published — visible to all visitors',
  'الاتصال بطيء — سيكتمل الحفظ تلقائياً':'Slow connection — saving will complete automatically', 'تعذّر الحفظ — لم تتغيّر الحالة':'Could not save — state unchanged', 'جارٍ الرفع إلى السحابة…':'Uploading to the cloud…', 'جارٍ الرفع…':'Uploading…',
  'رُفع كل شيء: ⟨x⟩ مباراة و⟨x⟩ هدفاً و⟨x⟩ ك.ب صوراً':'Everything uploaded: ⟨x⟩ matches, ⟨x⟩ goals and ⟨x⟩ KB of images', 'الاتصال بطيء — سيكتمل الرفع تلقائياً':'Slow connection — the upload will complete automatically',
  'رُفعت البيانات، لكن تعذّر رفع الصور':'Data uploaded, but the images could not be uploaded', 'تعذّر الرفع إلى السحابة':'Could not upload to the cloud', 'جارٍ الجلب من السحابة…':'Fetching from the cloud…', 'لا توجد نسخة في السحابة بعد':'No copy in the cloud yet',
  'السحابة (Firestore)':'Cloud (Firestore)', 'جُلبت ⟨x⟩ مباراة و⟨x⟩ هدفاً من السحابة':'Fetched ⟨x⟩ matches and ⟨x⟩ goals from the cloud', 'المصدر: رصد يدوي ✅ ·':'Source: manual recording ✅ ·',
  // الكشوفات
  'لا كشف لهذا النادي بعد.':'No squad list for this club yet.', 'رقم القميص':'Shirt number', 'اسم اللاعب':'Player name', 'بلا مركز ⟨x⟩':'No position ⟨x⟩', 'ترتيب حسب المركز':'Sort by position', 'لصق دفعة':'Paste batch',
  'سطر لكل لاعب: 9 خالد الخرقاوي ST':'One line per player: 9 Khalid Al-Kharqawi ST', 'إضافة لاعب':'Add player', 'إضافة':'Add', 'كشوفات اللاعبين':'Squad lists',
  'ثلاث خانات لكل لاعب: رقم القميص، الاسم، والمركز. المراكز تنحفظ مع الكشف وتصدّر للفانتسي، والأسماء تظهر كقائمة منسدلة عند إدخال الأهداف والبطاقات وركلات الجزاء.':'Three fields per player: shirt number, name and position. Positions are saved with the list and exported to fantasy, and names appear as a dropdown when entering goals, cards and penalties.',
  'حفظ الكشوفات':'Save squad lists', 'استخراج الأرقام من الأسماء':'Extract numbers from names', 'انفصل رقم ⟨x⟩ لاعب عن اسمه تلقائياً وانحط في خانة الرقم — اضغط «حفظ الكشوفات» لاعتماده.':'The number of ⟨x⟩ players was split from the name into the number field automatically — press "Save squad lists" to apply.',
  'الاسم موجود في الكشف':'Name already in the squad', 'أُضيف ⟨x⟩ لاعب':'⟨x⟩ players added', 'ما فيه أسماء جديدة':'No new names', 'ما فيه أرقام مدموجة بالأسماء':'No numbers merged into names', 'انفصل رقم ⟨x⟩ لاعب — احفظ الكشوفات للاعتماد':'Numbers split for ⟨x⟩ players — save the squad lists to apply',
  'أضف الأسماء الملصوقة':'Add the pasted names', 'حُفظت محلياً، وتعذّر رفعها للسحابة':'Saved locally, but could not upload to the cloud', 'تعذّر التحديث':'Could not update', 'حُدّث الجدول ✅':'Table updated ✅',
  // فريق العمل
  'الصق رمز الحساب (UID)':'Paste the account code (UID)', 'هذا حسابك أنت — المالك مضاف أصلاً':'This is your own account — the owner is already included', 'هذا العضو مضاف مسبقاً':'This member is already added', 'أُضيف ⟨x⟩ كمحرّر ✅':'⟨x⟩ added as editor ✅', 'العضو':'Member',
  'أُوقف الحساب':'Account suspended', 'فُعّل الحساب ✅':'Account activated ✅', 'حذف ⟨x⟩ من فريق العمل؟':'Remove ⟨x⟩ from the staff?', 'هذا العضو':'this member', 'حُذف العضو':'Member removed', 'محرّر':'Editor',
  'إدارة المباريات':'Match management', 'أضف مباراة كاملة: الجولة والملعب والتاريخ والوقت، ثم الأهداف والبطاقات وركلات الجزاء. النتيجة تُحسب من الأهداف.':'Add a full match: round, venue, date and time, then goals, cards and penalties. The score is computed from the goals.',
  'حالة الحفظ':'Save status', 'الحساب':'Account', 'الحالة':'Status', 'المحتوى':'Content', 'آخر حفظ ناجح':'Last successful save', 'كل حفظ يُرفع للسحابة تلقائياً ويظهر للزوار مباشرة.':'Every save is uploaded to the cloud automatically and shown to visitors immediately.',
  'دخول فريق العمل':'Staff sign-in', 'هذا الحساب غير مصرّح له بالتحرير بعد.':'This account is not authorised to edit yet.', 'أرسل هذا الرمز للمالك ليضيفك لفريق العمل':'Send this code to the owner to be added to the staff', 'نسخ الرمز':'Copy code',
  'حالة السحابة: ⟨x⟩ · القراءة مفتوحة للزوار، والكتابة محصورة بحسابك وحده.':'Cloud status: ⟨x⟩ · reads are open to visitors, writes are restricted to your account only.',
  'السحابة غير متاحة — افتح الموقع من نطاق منشور لا من ملف محلي.':'Cloud unavailable — open the site from a published domain, not a local file.', 'أدخل البريد وكلمة المرور.':'Enter the email and password.', 'تعذّر الدخول:':'Sign-in failed:',
  'نُسخ الرمز ✅':'Code copied ✅', 'انسخ الرمز يدوياً':'Copy the code manually',
  'شعارات الأندية':'Club logos', 'ارفع الشعار الرسمي لكل نادٍ (PNG أو SVG بخلفية شفافة). يظهر فوراً في الجدول وبطاقات المباريات وصفحة النادي. ارفع فقط ما لديك إذن باستخدامه.':'Upload each club\'s official logo (PNG or SVG with a transparent background). It appears immediately in the table, match cards and club page. Upload only what you have permission to use.',
  '+ رفع شعار':'+ Upload logo', 'تغيير الشعار':'Change logo', 'الزيارات':'Visits', 'عدد الجلسات اليومية على الموقع. جلسة واحدة لكل زائر في كل مرة يفتح فيها الموقع من جديد.':'Daily sessions on the site. One session per visitor each time the site is opened afresh.',
  'اعرض آخر ٣٠ يوماً':'Show the last 30 days', 'تحدي التوقعات':'Predictions challenge',
  'بعد إدخال نتائج الجولة كاملة، احتسب نقاط الجمهور. الاحتساب يقرأ توقعات المشتركين ويحدّث جداول الترتيب — وإعادته على نفس الجولة آمنة ولا تُضاعف النقاط.':'After entering the full round results, calculate the fans\' points. It reads members\' predictions and updates the tables — re-running it on the same round is safe and does not double the points.',
  'مشتركون في الترتيب':'Members on the table', 'آخر جولة محتسبة':'Last round calculated', 'الحالة الآن':'Current status', 'لم تُفتح أي جولة':'No round opened', 'مغلقة · الجولة ⟨x⟩':'Closed · Round ⟨x⟩', 'مفتوحة · الجولة ⟨x⟩':'Open · Round ⟨x⟩',
  'الإقفال المحفوظ':'Saved lock time', 'جولة التوقعات':'Predictions round', 'تاريخ ووقت الإقفال':'Lock date and time', 'يُملأ تلقائياً من أول مباراة في الجولة، وتقدر تعدّله كما تشاء — تمديداً أو تقديماً.':'Filled automatically from the first match of the round; you can change it as you like — later or earlier.',
  'فتح التوقعات':'Open predictions', 'أغلقها الآن':'Close now', 'احتسب نقاط الجمهور':'Calculate fans\' points', 'مشتركو التوقعات':'Predictions members',
  'الإخفاء يشيل المشترك من الجدول العام ويحتفظ بنقاطه — للأسماء المسيئة. يمكن إظهاره في أي وقت.':'Hiding removes the member from the public table but keeps their points — for offensive names. They can be shown again at any time.',
  'اكتب جزءاً من الاسم':'Type part of the name', 'بحث بالاسم':'Search by name', 'فريق العمل':'Staff',
  'حسابات المحرّرين: يدخلون لإضافة المباريات والأهداف والبطاقات وركلات الجزاء والكشوفات فقط. الشعارات والهوية وملفات البيانات وفريق العمل تبقى لك وحدك.':'Editor accounts: they sign in only to add matches, goals, cards, penalties and squad lists. Logos, branding, data files and the staff remain yours alone.',
  'بلا اسم':'No name', 'موقوف':'Suspended', 'إيقاف':'Suspend', 'تفعيل':'Activate', 'لا أعضاء بعد.':'No members yet.', 'إضافة عضو':'Add member', 'الاسم':'Name', 'رمز الحساب (UID)':'Account code (UID)', 'ينسخه العضو من شاشة الدخول':'The member copies it from the sign-in screen', 'إضافة العضو':'Add member',
  'الخطوات: أنشئ الحساب من Firebase Console ← Authentication ← Users ← Add user (بريد وكلمة مرور). يدخل العضو من صفحة «التحليل ← الإعدادات» فيظهر له رمز حسابه، يرسله لك، وتضيفه هنا.':'Steps: create the account in Firebase Console → Authentication → Users → Add user (email and password). The member signs in from "Analysis → Settings", sees their account code, sends it to you, and you add it here.',
  'المزامنة السحابية':'Cloud sync', 'وثيقة الموسم':'Season document', 'حجم الصور المخزّنة':'Stored images size', '⟨x⟩ ك.ب من 1024':'⟨x⟩ KB of 1024', 'آخر مزامنة ناجحة':'Last successful sync',
  '⬆ رفع البيانات الحالية إلى السحابة':'⬆ Upload current data to the cloud', '🗜 إعادة ضغط كل الصور':'🗜 Recompress all images', '🔍 فحص الاتصال بالسحابة':'🔍 Check the cloud connection', 'مصدر الشعارات الحالي':'Current logo source',
  '⬇ تحميل ملف الشعارات (assets.json)':'⬇ Download the logos file (assets.json)', '⬆ استيراد ملف شعارات':'⬆ Import a logos file', 'لتثبيت الشعارات نهائياً: نزّل':'To make the logos permanent: download',
  'وارفعه إلى مستودع GitHub بجانب index.html. عندها تظهر لكل زائر بلا اعتماد على السحابة أو على متصفحك.':'and upload it to the GitHub repository next to index.html. It then shows for every visitor without relying on the cloud or your browser.',
  '⬇ جلب أحدث نسخة من السحابة':'⬇ Fetch the latest copy from the cloud', 'كل حفظ أو تعديل يُرفع تلقائياً. هذان الزران للحالات الاستثنائية فقط.':'Every save or edit is uploaded automatically. These two buttons are for exceptional cases only.',
  'أضف مباراة كاملة يدوياً: الجولة والملعب والتاريخ والوقت، ثم الأهداف والبطاقات وركلات الجزاء بنفس حقول ملف الإكسل. النتيجة تُحسب من الأهداف.':'Add a full match manually: round, venue, date and time, then goals, cards and penalties with the same fields as the Excel file. The score is computed from the goals.',
  'لعبة الفانتسي':'Fantasy game', 'مخفية — تظهر لك وحدك':'Hidden — visible to you only', 'مُشهرة للجمهور':'Published to the public', '🔒 إخفاء اللعبة عن الجمهور':'🔒 Hide the game from the public', '🚀 إشهار اللعبة للجمهور':'🚀 Publish the game to the public',
  '↗ فتح لوحة إدارة الفانتسي':'↗ Open the fantasy admin panel', 'اللعبة ظاهرة الآن لكل زائر: يشوف تبويب «فانتسي» ويدخلها بلا رمز. الإخفاء يرجّعها لبوابة الرمز فوراً.':'The game is now visible to every visitor: they see the "Fantasy" tab and enter without a code. Hiding returns it to the code gate immediately.',
  'الإشهار يُظهر تبويب «فانتسي» لكل الزوار ويرفع بوابة الرمز عن اللعبة. يُحفظ في السحابة فيسري على كل الأجهزة خلال ثوانٍ.':'Publishing shows the "Fantasy" tab to all visitors and removes the code gate. It is saved to the cloud and applies on all devices within seconds.',
  'بيانات الموسم':'Season data', 'المصدر الحالي':'Current source', 'آخر تحديث للبيانات':'Last data update', 'آخر من حفظ':'Last saved by', '⬆ رفع ملف الجولة (xlsx أو json)':'⬆ Upload the round file (xlsx or json)',
  '⬇ تحميل data.json للنشر على الموقع':'⬇ Download data.json to publish on the site', 'إرجاع البيانات المضمّنة':'Restore the embedded data',
  'ارفع ملف الاستوديو التحليلي كما هو — يقرأ الموقع أوراق «سجل الأهداف» و«سجل المباريات» و«سجل ركلات الجزاء» و«الإعدادات»، ويعرض تقرير تحقق قبل الاعتماد. النتائج تُحتسب من الأهداف لا من خلايا الصيغ.':'Upload the analysis studio file as is — the site reads the "Goals log", "Matches log", "Penalties log" and "Settings" sheets and shows a validation report before approval. Scores are computed from the goals, not from formula cells.',
  'صور الهدافين':'Scorer photos', 'إظهار صور اللاعبين في الموقع':'Show player photos on the site', 'أطفئه لتظهر كل الأسماء بحروفها الأولى بشكل موحّد — أنظف من خليط صور وحروف حين لا تكتمل الصور.':'Turn it off to show all names with initials uniformly — cleaner than a mix of photos and initials when photos are incomplete.',
  'حجم الصورة —':'Photo size —', 'ضبط تأطير الوجوه':'Face framing', 'التكبير يقرّب الوجه، والأفقي والرأسي يحرّكان مركز القص. المعاينة حيّة.':'Zoom brings the face closer; horizontal and vertical move the crop centre. The preview is live.',
  'تكبير':'Zoom', 'أفقي':'Horizontal', 'رأسي':'Vertical', 'حذف الصورة':'Delete photo', 'ارفع صورة كل لاعب. الوجه في الوسط أفضل، وإن لم يكن فاضبطه بالمنزلقات أعلاه. ارفع فقط ما لديك حق استخدامه.':'Upload a photo for each player. A centred face is best; otherwise adjust it with the sliders above. Upload only what you have the right to use.',
  '+ رفع صورة':'+ Upload photo', 'تغيير':'Change', 'لا يوجد هدافون بعد.':'No scorers yet.', 'حذف كل صور اللاعبين':'Delete all player photos', 'شعار الدوري':'League logo',
  'يظهر في ترويسة الموقع. ارفع نسخة أوضح أو بخلفية شفافة إن توفرت.':'Shown in the site header. Upload a clearer version or one with a transparent background if available.', 'تغيير شعار الدوري':'Change league logo', 'إعادة الشعار الأصلي':'Restore original logo',
  'شعار العلامة':'Brand logo', 'يظهر في الصفحة الرئيسية وفي كل صورة أو تقرير مُصدَّر — لحفظ الحقوق.':'Shown on the home page and in every exported image or report — to protect the rights.', 'تغيير شعار العلامة':'Change brand logo',
  'تنسيق حجم الشعارات':'Logo sizing', 'الحجم العام لكل الشعارات —':'General size for all logos —', 'لوحة بيضاء خلف الشعار (تُستحسن للشعارات الداكنة)':'White panel behind the logo (recommended for dark logos)',
  'معاينة حيّة — الشعارات المرفوعة فقط تتأثر بالحجم.':'Live preview — only uploaded logos are affected by the size.', 'ضبط دقيق لكل نادٍ':'Fine-tune per club', 'إعدادات الموسم':'Season settings',
  'آخر تحديث (يظهر أسفل كل صورة مُصدَّرة)':'Last update (shown under every exported image)', 'حذف كل الشعارات المرفوعة':'Delete all uploaded logos', 'خروج من وضع المدير':'Exit admin mode', 'تنبيه قانوني:':'Legal note:',
  'شعارات الأندية علامات تجارية مسجّلة. إن كان الهدف عرض المشروع على اتحاد الكرة لاحقاً، احصل على إذن كتابي من كل نادٍ قبل النشر العام — الملف النظيف قانونياً يرفع قيمة المشروع أكثر من أي ميزة تقنية.':'Club logos are registered trademarks. If the goal is to present the project to the football association later, get written permission from each club before public release — a legally clean file raises the project\'s value more than any technical feature.',
  'شعار':'Logo', '· حُفظ ✅':'· saved ✅', 'تعذّر الحفظ في السحابة':'Could not save to the cloud', 'صورة':'Photo', 'حذف كل صور اللاعبين؟':'Delete all player photos?', 'إرجاع البيانات المضمّنة في الملف؟':'Restore the data embedded in the file?',
  'آخر ٣٠ يوماً':'Last 30 days', 'آخر ٧ أيام':'Last 7 days', 'اليوم':'Today', 'متوسط اليوم النشط':'Average per active day', 'العدّاد يبدأ من يوم رفع هذا الملف — ما قبله يظهر أصفاراً لأنه لم يُسجَّل.':'The counter starts from the day this file was uploaded — earlier days show zeros because they were not recorded.',
  'حدد تاريخ ووقت الإقفال':'Set the lock date and time', 'جارٍ الفتح…':'Opening…', 'جارٍ الاحتساب…':'Calculating…', 'حذف كل الشعارات المرفوعة؟':'Delete all uploaded logos?',
  'غير مصرّح':'Not authorised', 'اختر الجولة':'Choose the round', 'فُتحت توقعات الجولة ⟨x⟩ حتى ⟨x⟩':'Round ⟨x⟩ predictions opened until ⟨x⟩', 'أُغلقت توقعات الجولة ⟨x⟩':'Round ⟨x⟩ predictions closed',
  'تعذّر الحفظ — تأكد أن قواعد الأمان منشورة':'Could not save — make sure the security rules are published', 'لا توجد نتائج مسجّلة لهذه الجولة':'No results recorded for this round', 'تعذّرت قراءة التوقعات':'Could not read the predictions',
  'تعذّر حفظ جدول الترتيب':'Could not save the table', 'احتُسبت الجولة ⟨x⟩ لـ ⟨x⟩ مشتركاً':'Round ⟨x⟩ calculated for ⟨x⟩ members', 'الملتصق':'sticky', '-الجولة-':'-round-', 'ملخص-الدوري':'league-summary',
};

/* التهيئة بعد تعريف كل القواميس */
document.addEventListener('DOMContentLoaded', () => I18N.init());
if(document.readyState !== 'loading') I18N.init();
