/* =========================================================
   الترجمة الإنجليزية — الجزء الثاني: أسماء اللاعبين، رسائل الواجهة،
   نظام النقاط والكروت، وصفحة الدعم. يُحمَّل بعد i18n.js ويُدمج في قاموسه.
   أسماء اللاعبين: الاسم الكامل كما هو في كشف اللعبة → الاسم بالإنجليزية،
   والكلمة الأخيرة وحدها (كما تظهر على بطاقة الملعب) تُشتق تلقائياً.
   ========================================================= */
'use strict';

const NAMES_EN = {
  // القادسية
  'سعود الجناعي':'Saud Al-Jenaei', 'حميد القلاف':'Hamid Al-Qallaf', 'محمد الكندري':'Mohammad Al-Kandari', 'احمد اليحيى':'Ahmad Al-Yahya',
  'معاذ الظفيري':'Muath Al-Dhafiri', 'راشد الدوسري':'Rashed Al-Dosari', 'خالد صباح':'Khalid Sabah', 'بدر جمال':'Bader Jamal',
  'سلطان الفرج':'Sultan Al-Faraj', 'يوسف الحقان':'Yousef Al-Haqan', 'خالد محمد ابراهيم':'Khalid Mohammad Ibrahim', 'سالم الريس':'Salem Al-Rayes',
  'سيدريك جبو':'Cedric Gbo', 'عبدالله مطاوع':'Abdullah Mutawa', 'عذبي شهاب':'Athbi Shehab', 'عيد الرشيدي':'Eid Al-Rashidi',
  'عبدالعزيز وادي':'Abdulaziz Wadi', 'بدر المطوع':'Bader Al-Mutawa', 'احمد بودي':'Ahmad Boudi', 'عبدالله الغنيمان':'Abdullah Al-Ghunaiman',
  'جاسم المطر':'Jassim Al-Matar', 'طلال الفاضل':'Talal Al-Fadhel', 'ايوب لخضر':'Ayoub Lakhdar', 'غابرييل اوروك':'Gabriel Oruk',
  'خالد الخرقاوي':'Khalid Al-Kharqawi', 'عبدالله العوضي':'Abdullah Al-Awadhi', 'عبدالرحمن المشيفري':'Abdulrahman Al-Mushaifri', 'حمزة خابا':'Hamza Khaba',
  // الكويت
  'خالد الرشيدي':'Khalid Al-Rashidi', 'سعود الحوشان':'Saud Al-Houshan', 'سامي الصانع':'Sami Al-Sanea', 'مشاري غنام':'Mishari Ghanam',
  'محسن فلاح':'Mohsen Falah', 'علي حسين':'Ali Hussain', 'محمد فريح':'Mohammad Furaih', 'عمر غونزاليس':'Omar Gonzalez', 'زولا':'Zola',
  'حسن حمدان':'Hassan Hamdan', 'رضا هاني':'Redha Hani', 'احمد الظفيري':'Ahmad Al-Dhafiri', 'فيصل زايد':'Faisal Zayed', 'فينيسيوس':'Vinicius',
  'محمد مرهون':'Mohammad Marhoun', 'المهدي برحمة':'El Mehdi Berrahma', 'حمود السنعوسي':'Hamoud Al-Sanousi', 'عبدالله القرزعي':'Abdullah Al-Qarzaei',
  'ابراهيم كميل':'Ibrahim Kameel', 'عموري':'Amoory', 'محمد دحام':'Mohammad Daham', 'يوسف ناصر':'Yousef Nasser', 'مهند المحاميد':'Muhannad Al-Mahamid',
  'سلمان العوضي':'Salman Al-Awadhi',
  // العربي
  'سليمان عبدالغفور':'Sulaiman Abdulghafour', 'احمد عادي':'Ahmad Adi', 'عبدالرحمن عجاج':'Abdulrahman Ajaj', 'عبدالوهاب العوضي':'Abdulwahab Al-Awadhi',
  'عبدالله عمار':'Abdullah Ammar', 'محمد خالد':'Mohammad Khalid', 'جمعة عبود':'Jumaa Abboud', 'عزيز نصاري':'Aziz Nassari', 'شيلدون':'Sheldon',
  'خادم رسول':'Khadim Rassoul', 'علي عزيز':'Ali Aziz', 'بدر طارق':'Bader Tareq', 'طلال القيسي':'Talal Al-Qaisi', 'يوسف الخبيزي':'Yousef Al-Khubaizi',
  'خالد المرشد':'Khalid Al-Murshed', 'كينان ماليكو':'Kenean Maliko', 'بندر السلامة':'Bandar Al-Salama', 'علي خلف':'Ali Khalaf', 'يوسف ماجد':'Yousef Majed',
  'ايوالا':'Iwuala', 'زيد قنبر':'Zaid Qanbar',
  // كاظمة
  'حسين كنكوني':'Hussain Kankouni', 'خليفة رحيل':'Khalifa Raheel', 'فيصل السبيعي':'Faisal Al-Subaie', 'ضاري المسري':'Dhari Al-Masri',
  'صالح المحطب':'Saleh Al-Mahtab', 'بدر ذكرالله':'Bader Thekrallah', 'فهد الهاجري':'Fahad Al-Hajri', 'عبدالله الفهد':'Abdullah Al-Fahad',
  'محمد عنتر':'Mohammad Antar', 'ضاري الرقم':'Dhari Al-Raqam', 'بندر البرازي':'Bandar Al-Barazi', 'ادريس شعيبي':'Idris Shuaibi',
  'خالد شامان':'Khalid Shaman', 'ناصر فالح':'Nasser Faleh', 'المنتصر عبدالسلام':'Al-Muntasir Abdulsalam', 'اماث نداو':'Amath Ndao',
  'سلطان العنزي':'Sultan Al-Enezi', 'عثمان الشمري':'Othman Al-Shammari', 'تروليس كنول':'Truls Knoll', 'ناصر محمدوه':'Nasser Mohammadouh',
  'بندر بورسلي':'Bandar Boursli', 'شبيب الخالدي':'Shabib Al-Khalidi', 'مشعل الشمري':'Meshal Al-Shammari', 'جراح الهليلي':'Jarrah Al-Hulaili',
  'يوسف الخطيب':'Yousef Al-Khatib', 'احمد الزنكي':'Ahmad Al-Zanki', 'باتريك روبسون':'Patrick Robson',
  // السالمية
  'عبدالله الايوب':'Abdullah Al-Ayoub', 'يوسف الكندري':'Yousef Al-Kandari', 'عبدالرحمن الفضلي':'Abdulrahman Al-Fadhli', 'عبدالله الجزاف':'Abdullah Al-Jazzaf',
  'عبد الرحمن الخضر':'Abdulrahman Al-Khedher', 'شاهزود':'Shakhzod', 'مهدي دشتي':'Mahdi Dashti', 'احمد عيدان':'Ahmad Idan', 'عيسى وليد':'Essa Waleed',
  'تريسور':'Tresor', 'احمد بو مريوم':'Ahmad Bu Maryoum', 'محمدالهويدي':'Mohammad Al-Huwaidi', 'فواز عايض':'Fawaz Ayedh', 'نايف زويد':'Naif Zuwaid',
  'احمد منصور':'Ahmad Mansour', 'احمد خورشيد':'Ahmad Khorshid', 'محمود الأســود':'Mahmoud Al-Aswad', 'عبد الله يوسف':'Abdullah Yousef',
  'يوسـف العنيـزان':'Yousef Al-Enezan', 'عبدالمحسن التركماني':'Abdulmohsen Al-Turkmani', 'معاذ الاصيمع':'Muath Al-Osaimea', 'عمر علي عمر':'Omar Ali Omar',
  'عقيل الهزيم':'Aqeel Al-Hazeem', 'خالد العثمان':'Khalid Al-Othman', 'مبارك الفنيني':'Mubarak Al-Fenaini', 'ديفيــد سامبيسا':'David Sambissa',
  // النصر
  'محمد الحسينان':'Mohammad Al-Husainan', 'خالد عجاجي':'Khalid Ajaji', 'ناصر خضر':'Nasser Khedher', 'موريبا ديارا':'Moriba Diarra',
  'عبدالرحمن كوكو':'Abdulrahman Koko', 'سلمان بورميه':'Salman Bormiya', 'عبدالعزيز الشمري':'Abdulaziz Al-Shammari', 'نواف ثامر':'Nawaf Thamer',
  'سيف الحشان':'Saif Al-Hashan', 'ايمن لقجع':'Aymen Lakjaa', 'على حسن':'Ali Hassan', 'هاشم نجيب':'Hashem Najeeb', 'محمد عبدالهادي':'Mohammad Abdulhadi',
  'سيدي يعقوب':'Sidi Yacoub', 'محمد حمد':'Mohammad Hamad', 'فواز المبيلش':'Fawaz Al-Mubailesh', 'يوسف ثامر':'Yousef Thamer', 'عيد طلال رقبة':'Eid Talal Raqaba',
  'حازم الحاج حسن':'Hazem Al-Haj Hassan', 'علي عبدالله الظفيري':'Ali Abdullah Al-Dhafiri', 'حمود حزمي السهليي':'Hamoud Hazmi Al-Suhali', 'كريم سليم شاهين':'Karim Salim Shaheen',
  // الشباب
  'عبدالله جابر':'Abdullah Jaber', 'جاسم العوضي':'Jassim Al-Awadhi', 'سعد العذاب':'Saad Al-Athab', 'يوسف محمد':'Yousef Mohammad',
  'منير السبيعي':'Munir Al-Subaie', 'عبدالرحمن رفاعي':'Abdulrahman Rifai', 'شاهين الخميس':'Shaheen Al-Khamis', 'جاسم عتيق':'Jassim Ateeq',
  'ماركوس مارتينلي':'Marcos Martinelli', 'محمد خليل':'Mohammad Khalil', 'سعد المطيري':'Saad Al-Mutairi', 'محمد القحطاني':'Mohammad Al-Qahtani',
  'راشد فراج':'Rashed Farraj', 'جيوفاني دي سيلفا':'Giovanni De Silva', 'يعقوب الطراروه':'Yaqoub Al-Tararwa', 'علي مصطفى':'Ali Mustafa',
  'عمر الحبيتر':'Omar Al-Hubaiter', 'ميشيل دي ليما':'Michel De Lima', 'ماثيوس توتو':'Matheus Toto',
  // الجهراء
  'مبارك الحربي':'Mubarak Al-Harbi', 'حمد الخالدي':'Hamad Al-Khalidi', 'عبدالعزيز رسام':'Abdulaziz Rassam', 'مشاري البارود':'Mishari Al-Baroud',
  'جاسم العنزي':'Jassim Al-Enezi', 'منصور بندر':'Mansour Bandar', 'بشار عبدالله':'Bashar Abdullah', 'محمد العمران':'Mohammad Al-Omran',
  'تاكامبا ناسام':'Takamba Nassam', 'يوسف عايض الرشيدي':'Yousef Ayedh Al-Rashidi', 'عبدالعزيز أسعد':'Abdulaziz Asaad', 'بدر سالم الشمري':'Bader Salem Al-Shammari',
  'طلال جازع':'Talal Jazea', 'ايفانز امبوفو':'Evans Mbofu', 'أحمد العجمي':'Ahmad Al-Ajmi', 'طلال مزيد':'Talal Mazyad', 'عبدالله الداحس':'Abdullah Al-Dahes',
  'عبدالرحمن الظفيري':'Abdulrahman Al-Dhafiri', 'عادل جاسم الشمري':'Adel Jassim Al-Shammari', 'محمد فهد':'Mohammad Fahad', 'ماركوس راموس':'Marcos Ramos',
  'فهد السلامه':'Fahad Al-Salama', 'تركي المطيري':'Turki Al-Mutairi', 'أحمد الشمري':'Ahmad Al-Shammari', 'كيريست افالانا':'Kirist Avalana',
  // الفحيحيل
  'علي فاضل':'Ali Fadhel', 'احمد دشتي':'Ahmad Dashti', 'حسين دشتي':'Hussain Dashti', 'فهد سياف':'Fahad Sayyaf', 'مشعل رومي':'Meshal Roumi',
  'محمد نعيم':'Mohammad Naeem', 'احمد النصر':'Ahmad Al-Nasr', 'كارلوس':'Carlos', 'جاسم كرم':'Jassim Karam', 'عبدالعزيز ناجي':'Abdulaziz Naji',
  'محمد الفارسي':'Mohammad Al-Farsi', 'هاشم عدنان':'Hashem Adnan', 'حمد الطويل':'Hamad Al-Tawil', 'عمر المطر':'Omar Al-Matar', 'سلمان البوص':'Salman Al-Bous',
  'شريدة الشريدة':'Shuraida Al-Shuraida', 'جاتوش بانوم':'Gatoch Panom', 'رانجا شيفافيرو':'Ranga Chivaviro', 'الفين فورتيس':'Alvin Fortes',
  'همام صبحي':'Humam Sobhi', 'فيتور دا سيلفا':'Vitor Da Silva', 'خالد سليمان الشمري':'Khalid Sulaiman Al-Shammari',
  // الساحل
  'مشعل الرشيدي':'Meshal Al-Rashidi', 'فيصل المكيمي':'Faisal Al-Mukaimi', 'فواز الدوسري':'Fawaz Al-Dosari', 'علي جوهر':'Ali Jawhar',
  'عبدالرحمن الديحاني':'Abdulrahman Al-Daihani', 'موريسيو':'Mauricio', 'لوكاس دي سوزا':'Lucas De Souza', 'محمد الراشد':'Mohammad Al-Rashed',
  'عبدالعزيز العنزي':'Abdulaziz Al-Enezi', 'بدر الزايد':'Bader Al-Zayed', 'حمزه زياد':'Hamza Ziyad', 'عمر العنزي':'Omar Al-Enezi', 'يوسف بادي':'Yousef Badi',
  'محمد العلاطي':'Mohammad Al-Alati', 'أحمد غازي':'Ahmad Ghazi', 'محمد العتيبي':'Mohammad Al-Otaibi', 'ناصر القحطاني':'Nasser Al-Qahtani', 'كليتون':'Cleiton',
  'جواو':'Joao', 'راشد بن علي':'Rashed Bin Ali', 'غازي العتيبي':'Ghazi Al-Otaibi', 'جابر العجاجي':'Jaber Al-Ajaji', 'ألن دي سوزا':'Alan De Souza',
  // التضامن
  'داود الخالدي':'Dawoud Al-Khalidi', 'نايف العازمي':'Naif Al-Azmi', 'فيصل الشطي':'Faisal Al-Shatti', 'وليد سعد':'Waleed Saad', 'محمد عليان':'Mohammad Alyan',
  'أحمد رحيل':'Ahmad Raheel', 'محمد الشريفي':'Mohammad Al-Shuraifi', 'سلمان العجمي':'Salman Al-Ajmi', 'فواز الخالدي':'Fawaz Al-Khalidi', 'حسن حسون':'Hassan Hassoun',
  'بيريرا':'Pereira', 'أحمد دالي':'Ahmad Dali', 'سانتوس':'Santos', 'تركي اليوسف':'Turki Al-Yousef', 'أبوبكر دوما':'Aboubakar Douma', 'فهد الرشيدي':'Fahad Al-Rashidi',
  'أحمد شبيب':'Ahmad Shabib', 'حامد الرشيدي':'Hamed Al-Rashidi', 'عبدالمحسن العجمي':'Abdulmohsen Al-Ajmi', 'سعود قاسم':'Saud Qasem', 'ضاري المعصب':'Dhari Al-Muasab',
  'عبدالرحمن الرشيدي':'Abdulrahman Al-Rashidi',
  // الصليبيخات
  'عبدالرحمن الشريفي':'Abdulrahman Al-Shuraifi', 'عبدالله عيسى':'Abdullah Essa', 'علي الموسوي':'Ali Al-Mousawi', 'مساعد طراد':'Musaed Tarrad',
  'أحمد الفهد':'Ahmad Al-Fahad', 'فهد زويد':'Fahad Zuwaid', 'عبدالعزيز القطان':'Abdulaziz Al-Qattan', 'نواف الشيباني':'Nawaf Al-Shaibani',
  'عبدالمحسن الصليلي':'Abdulmohsen Al-Sulaili', 'ياسر دشتي':'Yasser Dashti', 'محمد الرويعي':'Mohammad Al-Ruwaie', 'دانيل سيلفا':'Daniel Silva',
  'مبارك سعيد':'Mubarak Saeed', 'ناصر الفيلكاوي':'Nasser Al-Failakawi', 'برونو دومنيغيس':'Bruno Domingues', 'خالد الشهري':'Khalid Al-Shehri',
  'عبدالعزيز البشر':'Abdulaziz Al-Bishr', 'عثمان الفيلكاوي':'Othman Al-Failakawi', 'ويلفز دامسينا':'Wilves Damsina', 'لوكاس شالون':'Lucas Shallon',
  'إيليلسون بيبي':'Elielson Bibi', 'علي علاء الدين':'Ali Alaa Eldin', 'أوكتشكو أربيزو':'Okechukwu Arbizo', 'صالح خميس':'Saleh Khamis',
};

const DICT_MORE = {
  // الأندية (أسماء طويلة/بديلة)
  'الصليبيخات':'Sulaibikhat', 'الصليبخات':'Sulaibikhat', 'الدوري الكويتي الممتاز':'Kuwait Premier League',
  'فانتسي الدوري الكويتي':'Kuwait League Fantasy', 'منصور الجمعة':'Mansour Aljumah',
  // نظام النقاط
  'المشاركة (أقل من 60 دقيقة)':'Appearance (under 60 min)', 'المشاركة 60 دقيقة فأكثر':'Appearance (60+ min)', 'هدف (حارس مرمى)':'Goal (goalkeeper)',
  'هدف (مدافع)':'Goal (defender)', 'هدف (لاعب وسط)':'Goal (midfielder)', 'هدف (مهاجم)':'Goal (forward)', 'صناعة هدف':'Assist',
  'شباك نظيفة (حارس)':'Clean sheet (goalkeeper)', 'شباك نظيفة (مدافع)':'Clean sheet (defender)', 'شباك نظيفة (وسط)':'Clean sheet (midfielder)',
  'كل هدفين تستقبلهما الشباك (حارس/مدافع)':'Every 2 goals conceded (GK/DEF)', 'تصدي لركلة جزاء (حارس)':'Penalty save (goalkeeper)',
  'إهدار ركلة جزاء':'Penalty miss', 'هدف عكسي':'Own goal', 'بطاقة صفراء':'Yellow card', 'بطاقة حمراء':'Red card',
  'المشاركة':'Appearance', 'الأهداف والصناعة':'Goals and assists', 'الدفاع':'Defence', 'خصومات':'Deductions', 'أخرى':'Other', 'نظام النقاط':'Scoring system',
  // الكروت
  'نقاط الكابتن ×3 بدل ×2':'Captain points ×3 instead of ×2', 'تغييرات غير محدودة بدون خصم نقاط':'Unlimited changes with no points deduction',
  'فريق جديد لجولة واحدة ثم يعود فريقك':'A new team for one gameweek, then your team returns', 'نقاط البدلاء الأربعة تُحتسب لك':'Points from all four bench players count',
  'الكروت الخاصة':'Chips', 'كرت':'Chip', 'كروت':'Chips', 'دكة قوية':'Bench Boost', 'مرة واحدة':'once', 'مرة':'time', 'مرات':'times', 'في الموسم':'per season',
  'يسري على هذه الجولة فقط. تقدر تلغيه في أي وقت قبل إغلاق الجولة بلا خسارة، ويُحسب مستخدماً فقط بعد الإغلاق.':
    'Applies to this gameweek only. You can cancel it any time before the deadline at no cost; it counts as used only after the deadline.',
  'دكة قوية — احتُسبت':'Bench Boost — counted', 'استُخدم هذا الكرت من قبل':'This chip has already been used',
  'كرت آخر مفعّل لهذه الجولة — ألغه أولاً':'Another chip is active this gameweek — cancel it first', 'أُلغي الكرت — ما زال متاحاً لك':'Chip cancelled — still available to you',
  'نفّذت صفقات تحت الوايلد كارد — لا يمكن إلغاؤه الآن':'You made transfers under the Wildcard — it cannot be cancelled now',
  'أُغلقت الجولة — لا يمكن تفعيل الكروت بعد انطلاق المباراة':'Gameweek locked — chips cannot be activated after kick-off',
  // فريقي / الانتقالات
  'أُغلقت الجولة — لا تعديل على التشكيلة بعد الموعد':'Gameweek locked — no lineup changes after the deadline',
  'أُغلقت الجولة — لا يمكن تعديل التشكيلة بعد الموعد':'Gameweek locked — the lineup cannot be changed after the deadline',
  'أُغلقت الجولة — لا انتقالات بعد الموعد':'Gameweek locked — no transfers after the deadline',
  'أُغلقت الجولة — الانتقالات تفتح بعد احتساب النتائج.':'Gameweek locked — transfers reopen after results are scored.',
  'اختر اللاعب الذي تريد التبديل معه':'Choose the player to swap with', 'تغيّر فريقك أثناء التعديل — أعد اختيار الصفقات':'Your team changed while editing — pick your transfers again',
  'تم اعتماد فريقك!':'Your team is confirmed!', 'حاول مرة أخرى':'Try again', 'تم الحفظ':'Saved', 'تم':'Done', 'حسناً':'OK', 'تأكيد':'Confirm', 'مسح':'Clear',
  'الخطة تتغيّر تلقائياً حسب من تُدخله من الدكة (مثلاً مدافع مكان مهاجم = خطة جديدة). التبديل التلقائي يدخل البدلاء بترتيبهم 1 ثم 2 ثم 3 عند غياب أساسي. لتغيير الترتيب: اضغط بديلاً ثم «تبديل» ثم بديلاً آخر.':
    'The formation changes automatically based on who you bring on from the bench (e.g. a defender for a forward = new formation). Auto-subs come on in bench order 1, 2, 3 when a starter does not play. To reorder: tap a sub, then "Substitute", then another sub.',
  'اضغط أي لاعب لعرض خياراته: إزالة أو اختيار بديل.':'Tap any player to see options: remove or choose a replacement.',
  'كوّن فريقك':'Build your team', 'تعبئة تلقائية':'Auto-fill', 'إفراغ الكل':'Clear all', 'صفقة جديدة':'New signing', 'صفقات':'Transfers', 'انتقالات':'Transfers',
  'البديل يجب أن يكون بنفس المركز':'The replacement must play the same position', 'اللاعب موجود في فريقك':'This player is already in your team',
  'الميزانية لا تكفي':'Not enough budget', 'مركز مختلف':'Different position', 'في فريقك':'In your team',
  'التشكيلة الأساسية':'Starting XI', 'الكابتن':'Captain', 'أهداف/صناعة':'G/A', 'أساسي':'Starter', 'عرض التشكيلة':'View lineup', 'متوسط الجولة':'GW average',
  'ترتيب الجولة':'GW rank', 'مقفلة':'Locked', 'جارية — النقاط تظهر مباشرة في «ملخص الجولة»':'In progress — points show live in "Gameweek summary"',
  'لا توجد جولات محتسبة بعد — نقاطك تظهر هنا مباشرة أثناء الجولة بعد موعد الإغلاق.':'No gameweeks scored yet — your points appear here live during the gameweek after the deadline.',
  'النقاط تتحدث مع كل مباراة تُسجَّل على mfsoccer، وتُعتمد رسمياً عند إغلاق الجولة. لاعب لم تُلعب مباراته بعد يبقى في تشكيلتك بصفر مؤقت.':
    'Points update with every match recorded on mfsoccer and are made official when the gameweek closes. A player whose match has not been played yet stays in your lineup with a temporary zero.',
  'لا توجد مباريات منتهية بهذه الجولة بعد — النتائج تُعتمد من الواقع وتظهر هنا أول ما تُدخل من الإدارة.':'No finished matches in this gameweek yet — real results appear here as soon as they are entered.',
  'كل المباريات والصعوبة':'All fixtures and difficulty', 'الترتيب العام':'Overall table', 'سجل الجولات':'Gameweek history', 'انتهى الموسم':'Season over',
  'قارن':'Compare', '→ رجوع':'→ Back', 'لاعب غير موجود':'Player not found', '● جارٍ الآن':'● Live now', 'نتيجة تقديرية':'Estimated result',
  'لم يُنشر جدول هذه الجولة على mfsoccer بعد — تظهر المباريات هنا تلقائياً أول ما تُنشر.':'Fixtures for this gameweek are not published on mfsoccer yet — they appear here automatically once published.',
  '(ج)':'(P)', '(ركلة جزاء)':'(penalty)', '(عكسي)':'(OG)', '(هدف عكسي)':'(own goal)', 'ف/ت/خ':'W/D/L', 'ن. المواجهات':'H2H pts', 'أنت':'You', 'أنت!':'You!', '· أنت':'· You',
  'الوسط':'Midfielders', 'المهاجمون':'Forwards', 'حراس':'GK', 'مدافعين':'DEF', 'مهاجمين':'FWD', 'الهدافون':'Top scorers', 'الصنّاع':'Top assists',
  'الإحصائيات والتحليلات':'Statistics and analysis', 'البيانات':'Data', 'شراء (آخر جولة محتسبة)':'Bought (last scored GW)', 'بيع (آخر جولة محتسبة)':'Sold (last scored GW)',
  'الأكثر دخولاً':'Most transferred in', 'الأكثر خروجاً':'Most transferred out', 'آخر الجولات':'Recent gameweeks', 'ارتفع سعره':'Price rose', 'انخفض سعره':'Price fell',
  'مستقر':'Stable', 'ارتفع':'Up', 'انخفض':'Down', 'نقطة':'pts',
  'الخانة الخضراء = الأفضل في هذا البند. تقدر تقارن حتى 3 لاعبين.':'Green cell = best in that category. You can compare up to 3 players.',
  'ابحث عن لاعب لبدء المقارنة، أو افتح أي لاعب واضغط «قارن».':'Search for a player to start comparing, or open any player and tap "Compare".',
  'ابحث عن لاعب':'Search for a player', 'أبطال الجولات':'Gameweek champions', 'أعلى نقاط في الجولة بين كل المدربين = بطل الجولة':'Highest score in a gameweek among all managers = gameweek champion',
  'البطل':'Champion', 'لا جولات منتهية بعد':'No finished gameweeks yet', 'لا توجد بيانات بعد':'No data yet',
  // الدوريات
  'إنشاء دوري خاص':'Create a private league', 'اسم الدوري':'League name', 'كلاسيكي (مجموع النقاط)':'Classic (total points)', 'مواجهات مباشرة (H2H)':'Head-to-head (H2H)',
  'إنشاء':'Create', 'أُنشئ الدوري!':'League created!', 'شارك هذا الرمز مع أصحابك للانضمام:':'Share this code with your friends to join:', 'فتح الدوري':'Open league',
  'الانضمام لدوري':'Join a league', 'رمز الدعوة':'Invite code', 'انضمام':'Join', 'اكتب اسماً':'Enter a name', 'انضممت للدوري':'You joined the league',
  'نُسخ الرمز — أرسله لأصحابك':'Code copied — send it to your friends', 'أنشئ حساباً أولاً حتى يشوف أصحابك دوريك':'Create an account first so your friends can see your league',
  'أنشئ حساباً أولاً للانضمام لدوريات أصحابك':'Create an account first to join your friends\' leagues',
  'أُلغيت المنافسون التجريبيون — الدوريات للمشتركين الحقيقيين':'Demo rivals removed — leagues are for real managers', 'رمز الدوري غير صحيح':'Invalid league code',
  'أنت عضو في هذا الدوري':'You are already in this league', 'مثال: ديوانية الخميس':'e.g. Thursday Diwaniya', 'مثال: A3X9KM':'e.g. A3X9KM',
  // الحساب
  'الحساب':'Account', 'إنشاء حساب أو دخول':'Sign up or log in', 'إنشاء حساب':'Create account', 'كلمة المرور (6+ أحرف)':'Password (6+ characters)',
  'اسم فريقك في الفانتسي':'Your fantasy team name', 'اسم المستخدم (يظهر في الترتيب)':'Username (shown in the table)', 'حفظ والبدء':'Save and start',
  'أهلاً بك — أكمل بياناتك':'Welcome — complete your details', 'أهلاً بعودتك!':'Welcome back!', 'تم إنشاء الحساب — راجع بريدك لتفعيله':'Account created — check your email to verify it',
  'اكتب الاسمين':'Enter both names', 'تم — كوّن فريقك الآن':'Done — build your team now', 'تم تفعيل البريد':'Email verified',
  'لم يُفعّل بعد — افتح الرابط في بريدك أولاً':'Not verified yet — open the link in your email first', 'أُرسل رابط التفعيل مرة أخرى':'Verification link sent again',
  'يصلك رابط على بريدك تغيّر منه كلمة المرور، ثم تعود وتسجّل الدخول.':'You will get an email link to change your password, then come back and log in.',
  'أُرسل الرابط':'Link sent', 'أرسلنا رابط تغيير كلمة المرور إلى بريدك. افتحه من البريد وغيّرها، ثم عد وسجّل الدخول.':'We sent a password reset link to your email. Open it, change your password, then come back and log in.',
  'لم تجده؟ تحقق من «غير المرغوب» وابحث عن المرسل':'Can\'t find it? Check your spam folder and search for the sender', '. قد يتأخر دقائق.':'. It may take a few minutes.',
  'سجّلت حسابك بزر Google؟ حساب Google بلا كلمة مرور — ادخل بزر «الدخول عبر Google» مباشرة.':'Signed up with Google? Google accounts have no password — use the "Sign in with Google" button.',
  'فعّل بريدك:':'Verify your email:', 'تحققت':'Verified', 'أعد الإرسال':'Resend', 'حسابك محفوظ على الخادم — يتبعك على كل أجهزتك':'Your account is saved on the server — it follows you on every device',
  'وضع محلي بدون تسجيل دخول — كل شيء محفوظ على هذا الجهاز':'Local mode without login — everything is saved on this device only',
  'حذف فريقي والبدء من جديد':'Delete my team and start over', 'سيُحذف فريقك وتاريخ نقاطك وتبدأ من جديد بميزانية كاملة. متأكد؟':'Your team and points history will be deleted and you start again with a full budget. Are you sure?',
  'نعم، احذف':'Yes, delete', 'مثال: mansour_q8':'e.g. mansour_q8', 'مثال: نسور الديرة':'e.g. Deera Eagles', 'عن اللعبة والقوانين':'About the game and rules',
  'كل الحقول مطلوبة':'All fields are required', 'كلمة المرور 6 أحرف على الأقل':'Password must be at least 6 characters', 'اسم المستخدم محجوز — اختر غيره':'Username taken — choose another',
  'السحابة غير متاحة — تأكد من الاتصال':'Cloud unavailable — check your connection', 'السحابة غير متاحة':'Cloud unavailable', 'سجّل الدخول أولاً':'Log in first',
  'الدخول عبر Google لا يعمل داخل متصفح التطبيق (إنستغرام/تيك توك/سناب). افتح mfsoccer.com في Safari أو Chrome، أو ادخل بالبريد وكلمة المرور.':
    'Google sign-in does not work inside in-app browsers (Instagram/TikTok/Snapchat). Open mfsoccer.com in Safari or Chrome, or log in with email and password.',
  'الدخول عبر Google غير متاح في هذه النسخة':'Google sign-in is not available in this version', 'لا توجد جلسة':'No session',
  'تعذّر الاتصال بالخادم — حاول بعد قليل':'Could not reach the server — try again shortly', 'تعذّر الاتصال بالخادم':'Could not reach the server',
  'تعذّر الحفظ — لا تملك صلاحية هذه العملية':'Could not save — you do not have permission for this action',
  // التطبيق العام
  'وضع بلا اتصال':'Offline mode', 'تعذّر الوصول للخادم، فما تشوفه محفوظ على هذا الجهاز فقط. نقاطك وترتيبك يحتاجان اتصالاً.':'Could not reach the server, so what you see is saved on this device only. Your points and rank need a connection.',
  'أنت تتصفح بلا حساب':'You are browsing without an account',
  'الفريق الذي تكوّنه الآن محفوظ على هذا الجهاز فقط، ولن تُحتسب له نقاط ولا يدخل الترتيب. أنشئ حساباً ليُحفظ ويُنافس.':'The team you build now is saved on this device only; it earns no points and does not enter the table. Create an account to save it and compete.',
  'لو طال الانتظار:':'If this takes too long:', 'إعادة المحاولة':'Retry', 'حدث خطأ':'Something went wrong', 'العودة للرئيسية':'Back to home', 'لا إشعارات بعد':'No notifications yet',
  'تعذّر الوصول لبياناتك على الخادم — نعرض آخر نسخة محفوظة، ولن يُرفع شيء حتى يعود الاتصال':'Could not reach your data on the server — showing the last saved copy; nothing will upload until the connection returns',
  'تعذّر الوصول لبياناتك على الخادم — تحقق من الشبكة':'Could not reach your data on the server — check your network',
  'الاتصال بطيء — نعرض آخر نسخة محفوظة ونحاول في الخلفية':'Slow connection — showing the last saved copy while retrying in the background',
  'تعذّر الوصول للخادم — اسحب الصفحة للأسفل أو أعد فتحها':'Could not reach the server — pull down to refresh or reopen the page',
  'حُدّث فريقك من الخادم':'Your team was updated from the server', '— على أرضه':'— home', '— خارج أرضه':'— away',
  'نسخة قيد المراجعة':'Preview build', 'هذا القسم مب مفتوح للجمهور بعد.':'This section is not open to the public yet.', 'أدخل رمز الدخول للمعاينة.':'Enter the access code to preview.',
  'فانتسي الدوري الكويتي · 2026/2027':'Kuwait League Fantasy · 2026/2027', 'رمز الدخول':'Access code',
  // التنبيهات
  'التنبيهات':'Notifications', 'تنبيه من المتصفح قبل إغلاق الجولة بساعتين':'Browser notification two hours before the deadline',
  'أرسل تذكير الإغلاق بالواتساب':'Send the deadline reminder on WhatsApp', 'المتصفح لا يدعم التنبيهات':'This browser does not support notifications',
  'لم يُسمح بالتنبيهات — فعّلها من إعدادات المتصفح':'Notifications not allowed — enable them in browser settings', 'سيصلك تنبيه قبل الإغلاق بساعتين':'You will be notified two hours before the deadline',
  'أُوقفت التنبيهات':'Notifications turned off', 'تنبيهات المتصفح تشتغل فقط عبر HTTPS أو على نفس الجهاز — التذكير داخل التطبيق (الجرس) يشتغل دائماً.':'Browser notifications work only over HTTPS or on this device — the in-app reminder (bell) always works.',
  'يصلك التنبيه إذا كان التطبيق مفتوحاً في أي تبويب.':'You get the notification if the app is open in any tab.',
  // الدعم والاقتراحات
  'تابع المطوّر':'Follow the developer', 'اللعبة':'The game', 'لوحة الإدارة':'Admin panel', 'دخول المطوّر':'Developer login',
  'فانتسي الدوري الكويتي — لعبة فانتسي كويتية على طراز FPL: كوّن فريقك من لاعبي الدوري، اختر الكابتن، فعّل الكروت، ونافس أصحابك على نقاط كل جولة بنتائج حقيقية.':
    'Kuwait League Fantasy — a Kuwaiti fantasy game in the FPL style: build your team from league players, pick a captain, play chips, and compete with friends on real results every gameweek.',
  'اقتراح':'Suggestion', 'مشكلة أو خطأ':'Problem or bug', 'خطأ في بيانات لاعب/مباراة':'Player/match data error',
  'رسالة جديدة للدعم الفني':'New message to support', 'النوع':'Type', 'الرسالة':'Message', 'إرسال':'Send', 'محادثاتك مع الدعم':'Your support conversations',
  'التواصل مع المطوّر':'Contact the developer', 'جارٍ التحميل…':'Loading…', 'جارٍ الإرسال…':'Sending…', 'رد':'Reply', 'رد جديد':'New reply',
  'فكرة، مشكلة، خطأ في اسم لاعب أو نتيجة — اكتبها هنا وتصل':'An idea, a problem, a wrong player name or result — write it here and it reaches', 'لفريق العمل':'the team',
  'مباشرة، ويصلك الرد في «محادثاتك» أسفل هذه الصفحة مع تنبيه في الجرس.':'directly; the reply appears in "Your conversations" below with a bell alert.',
  'اكتب اقتراحك أو المشكلة بالتفصيل…':'Describe your suggestion or the problem in detail…', 'اكتب ردّك…':'Write your reply…',
  'سجّل الدخول لترى محادثاتك مع الدعم.':'Log in to see your support conversations.', 'لا رسائل بعد — أرسل أول رسالة من الصندوق أعلاه ويصلك الرد هنا.':'No messages yet — send your first one from the box above and the reply appears here.',
  'تعذّر جلب محادثاتك الآن.':'Could not load your conversations right now.', 'أُغلقت هذه المحادثة. أرسل رسالة جديدة إن احتجت.':'This conversation is closed. Send a new message if needed.',
  'الدعم الفني':'Support', 'جديد':'New', 'مقروء':'Seen', 'منفّذ':'Done', 'مرفوض':'Declined', 'أُرسل ردّك':'Your reply was sent',
  'وصلت رسالتك':'Message received', 'شكراً — يقرأها فريق العمل ويردّ عليك هنا في «محادثاتك مع الدعم»، ويصلك تنبيه في الجرس عند الرد.':'Thanks — the team reads it and replies here in "Your support conversations", with a bell alert when they do.',
  'اكتب اقتراحك أولاً':'Write your suggestion first', 'الرسالة طويلة — 1500 حرف كحد أقصى':'Message too long — 1500 characters max', 'اكتب ردك أولاً':'Write your reply first',
  'رد عليك الدعم الفني — افتح «الدعم والاقتراحات»':'Support replied — open "Support & feedback"', 'النسخة':'Version', 'البيانات بالتعاون مع mfsoccer.com':'Data in partnership with mfsoccer.com',
  'الاقتراحات والتواصل':'Feedback and contact', 'المطوّر والاقتراحات':'Developer and feedback', 'لديك اقتراح أو لاحظت خطأ؟':'Have a suggestion or spotted an error?',
  'صفحة المطوّر فيها صندوق الاقتراحات وروابط التواصل.':'The developer page has the feedback box and contact links.',
};

/* أنماط بمتغيرات (أرقام/أسماء) */
const RX_MORE = [
  [/^الجولة (\d+)$/, 'Gameweek $1'],
  [/^الاحتساب يبدأ من الجولة (\d+)$/, 'Scoring starts from Gameweek $1'],
  [/^الجولات السابقة لا تُحتسب لأحد — أول نقاط بعد الجولة (\d+)\.?$/, 'Earlier gameweeks are not scored for anyone — first points after Gameweek $1.'],
  [/^الجولة (\d+) جارية — التشكيلة مقفلة حتى اعتماد الجولة$/, 'Gameweek $1 in progress — lineup locked until the gameweek is confirmed'],
  [/^الجولة (\d+) · (.+)$/, (m, n, rest) => 'Gameweek ' + n + ' · ' + I18N.trIn(rest)],
  [/^نقاط الجولة (\d+)/, 'Gameweek $1 points'],
  [/^(\d+) من (\d+) مباريات لُعبت — (.+)$/, (m, a, b, rest) => a + ' of ' + b + ' matches played — ' + I18N.trIn(rest)],
  [/^التشكيلة الأساسية — الكابتن: (.+)$/, (m, c) => 'Starting XI — Captain: ' + I18N.trIn(c)],
  [/^الكابتن: (.+) · نقاط الدكة: (\d+)$/, (m, c, b) => 'Captain: ' + I18N.trIn(c) + ' · Bench points: ' + b],
  [/^نقاطي المباشرة — الجولة (\d+)$/, 'My live points — Gameweek $1'],
  [/^تشكيلته الحالية تظهر بعد إغلاق الجولة (\d+)، كما في فانتسي الدوري الإنجليزي\.$/, 'His current lineup is shown after Gameweek $1 closes, as in the Premier League fantasy.'],
  [/^تفعيل (.+)؟$/, (m, c) => 'Activate ' + I18N.trIn(c) + '?'],
  [/^— صناعة (\d+)$/, '— Assists $1'],
  [/^انضممت في الجولة (\d+)$/, 'Joined in Gameweek $1'],
  [/^صعد (\d+)$/, 'Up $1'], [/^نزل (\d+)$/, 'Down $1'],
  [/^نُفذت (\d+) صفقة\s*$/, '$1 transfers made'],
  [/^رجع (.+) إلى فريقك$/, (m, p) => I18N.trIn(p) + ' is back in your team'],
  [/^(\d+) حراس · (\d+) مدافعين · (\d+) وسط · (\d+) مهاجمين · حد أقصى (\d+) من كل نادٍ$/, '$1 GK · $2 DEF · $3 MID · $4 FWD · max $5 per club'],
  [/^اختر (حارس|مدافع|وسط|مهاجم)$/, (m, p) => 'Choose a ' + ({'حارس':'goalkeeper','مدافع':'defender','وسط':'midfielder','مهاجم':'forward'})[p]],
  [/^اكتمل عدد (.+)$/, (m, p) => I18N.trIn(p) + ' slots full'],
  [/^اكتمل (.+)$/, (m, p) => I18N.trIn(p) + ' slots full'],
  [/^الحد الأقصى (\d+) لاعبين من (.+?)(?: \(لديك (\d+)\))?$/, (m, n, c, h) => 'Max ' + n + ' players from ' + I18N.trIn(c) + (h ? ' (you have ' + h + ')' : '')],
  [/^الحد الأقصى (\d+) من (.+)$/, (m, n, c) => 'Max ' + n + ' from ' + I18N.trIn(c)],
  [/^(\d+) من (\D.+)$/, (m, n, c) => n + ' from ' + I18N.trIn(c)],
  [/^بطل الجولة (\d+) مرة$/, 'Gameweek champion $1 times'],
  [/^بطل الجولة (\d+)$/, 'Gameweek $1 champion'],
  [/^النسخة (\S+)$/, 'Version $1'],
  [/^يفتح واتساب برسالة جاهزة فيها موعد إغلاق الجولة (\d+) — أرسلها لنفسك أو لقروب الربع\.$/, 'Opens WhatsApp with a ready message containing the Gameweek $1 deadline — send it to yourself or your friends\' group.'],
  [/^حُدّث فريقك بعد احتساب الجولة (\d+)$/, 'Your team was updated after Gameweek $1 was scored'],
  [/^هدف! (.+)$/, (m, r) => 'Goal! ' + I18N.trIn(r)],
  [/^صافرة النهاية: (.+)$/, (m, r) => 'Full time: ' + I18N.trIn(r)],
  [/^القائمة يجب أن تضم (\d+) لاعباً \(لديك (\d+)\)$/, 'The squad must have $1 players (you have $2)'],
  [/^(حارس|مدافع|وسط|مهاجم): المطلوب (\d+) \(لديك (\d+)\)$/, (m, p, n, h) => I18N.DICT[p] + ': need ' + n + ' (you have ' + h + ')'],
  [/^تجاوزت الميزانية: (.+) من (.+)$/, 'Over budget: $1 of $2'],
  [/^التشكيلة الأساسية 11 لاعباً$/, 'The starting XI must have 11 players'],
  [/^تشكيلة غير صالحة: الحد الأدنى (\d+) (.+)$/, (m, n, p) => 'Invalid formation: at least ' + n + ' ' + I18N.trIn(p)],
  [/^تشكيلة غير صالحة: الحد الأقصى (\d+) (.+)$/, (m, n, p) => 'Invalid formation: at most ' + n + ' ' + I18N.trIn(p)],
  [/^أرسلنا رابط تفعيل إلى (.+) — افتحه ثم اضغط «تحققت»$/, 'We sent a verification link to $1 — open it, then tap "Verified"'],
  [/^الدوري الكويتي الممتاز (.+) — كوّن فريقك ونافس أصحابك$/, 'Kuwait Premier League $1 — build your team and compete with friends'],
  [/^(.+) — (\d+) مرة$/, (m, a, n) => I18N.trIn(a) + ' — ' + n + ' times'],
  [/^(\d+) مرة$/, '$1 times'], [/^(\d+) مرات$/, '$1 times'],
  [/^\((\d+) (?:مرة|مرات) في الموسم\)$/, '($1 per season)'],
];

(function mergeI18N(){
  if(typeof I18N === 'undefined') return;
  Object.assign(I18N.DICT, DICT_MORE);
  /* الأسماء الكاملة + الكلمة الأخيرة (بطاقات الملعب تعرض الاسم الأخير فقط) */
  for(const ar in NAMES_EN){
    const en = NAMES_EN[ar];
    I18N.DICT[ar] = en;
    const la = ar.trim().split(/\s+/).pop(), le = en.trim().split(/\s+/).pop();
    if(la && la.length >= 2 && I18N.DICT[la] == null) I18N.DICT[la] = le;
  }
  /* الأنماط الجديدة قبل القديمة حتى لا يلتقط نمط عام (مثل «N من N») الحالات الخاصة */
  I18N.RX = RX_MORE.concat(I18N.RX);
  I18N._keysSorted = null;
})();
