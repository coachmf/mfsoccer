/* =========================================================================
   إدارة التعليم وتطوير الدارسين — الاتحاد الكويتي لكرة القدم
   تطبيق صفحة واحدة: رزنامة الدورات ← التسجيل ← الدفع ← الإيصال، ولوحة إدارة.
   التخزين الحالي: localStorage على الجهاز (مرحلة أولى).
   الدفع: /api/kfa-pay (MyFatoorah: كي نت/فيزا/ماستر/Apple Pay) أو وضع تجريبي.
   ========================================================================= */
(function () {
  'use strict';
  const CFG = window.KFA_CONFIG;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const view = $('#view');

  /* ——— البيانات ——— */
  const KEY_C = 'kfaedu.courses.v1', KEY_R = 'kfaedu.regs.v1', KEY_A = 'kfaedu.admin';
  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { toast('تعذّر الحفظ على هذا الجهاز'); } };
  let courses = load(KEY_C, null) || CFG.seedCourses.map((c) => ({ ...c }));
  let regs = load(KEY_R, []);
  const saveCourses = () => save(KEY_C, courses);
  const saveRegs = () => save(KEY_R, regs);

  const CATS = {
    afc: 'رخص الاتحاد الآسيوي', grass: 'البراعم والقاعدة', gk: 'حراس المرمى', futsal: 'الصالات', spec: 'دورات تخصصية'
  };
  const LICENSES = [
    ['', 'لا يوجد'], ['GR-1', 'شهادة البراعم'], ['AFC-C', 'آسيوية C'], ['AFC-B', 'آسيوية B'], ['AFC-A', 'آسيوية A'], ['AFC-PRO', 'آسيوية PRO']
  ];
  const LIC_RANK = { '': 0, 'GR-1': 0, 'AFC-C': 1, 'AFC-B': 2, 'AFC-A': 3, 'AFC-PRO': 4 };
  const STATUS = { pending: ['بانتظار الدفع', 'b-pend'], paid: ['مدفوع — قيد المراجعة', 'b-paid'], confirmed: ['مقبول نهائياً', 'b-conf'], cancelled: ['ملغى', 'b-canc'] };

  const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const pd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const fmtD = (s) => { const d = pd(s); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
  const fmtShort = (s) => { const d = pd(s); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };
  const money = (n) => `${Number(n).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ${CFG.currency}`;
  const todayIso = () => iso(new Date());
  const byId = (id) => courses.find((c) => c.id === id);
  const left = (c) => Math.max(0, c.seats - c.taken);
  const isOpen = (c) => left(c) > 0 && c.start > todayIso();
  const sorted = () => [...courses].sort((a, b) => a.start.localeCompare(b.start));

  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2800);
  }

  function seatsBar(c) {
    const pct = Math.min(100, Math.round((c.taken / c.seats) * 100));
    const l = left(c);
    const cls = l === 0 ? 'full' : l <= 5 ? 'low' : '';
    const txt = l === 0 ? 'المقاعد مكتملة' : `متبقٍ ${l} من ${c.seats} مقعداً`;
    return `<div class="seats ${cls}"><i style="width:${pct}%"></i></div><div class="seats-t">${txt}</div>`;
  }

  function courseCard(c) {
    const open = isOpen(c);
    return `<article class="course cat-${esc(c.cat)}">
      <div class="course-b">
        <div><span class="tag">${esc(CATS[c.cat] || c.cat)}</span></div>
        <h3>${esc(c.title)}</h3>
        <div class="meta"><span>📅 ${fmtShort(c.start)} – ${fmtD(c.end)}</span><span>📍 ${esc(c.place)}</span></div>
        ${c.prereq ? `<div class="meta"><span>🎓 يشترط: ${esc(licName(c.prereq))}</span></div>` : ''}
        ${seatsBar(c)}
      </div>
      <div class="course-f">
        <div class="price">${money(c.fee)}</div>
        <div style="display:flex;gap:6px">
          <a class="btn btn-o btn-sm" href="#course/${encodeURIComponent(c.id)}">التفاصيل</a>
          ${open ? `<a class="btn btn-p btn-sm" href="#register/${encodeURIComponent(c.id)}">سجّل</a>` : `<button class="btn btn-sm btn-o" disabled>${left(c) ? 'مغلق' : 'مكتمل'}</button>`}
        </div>
      </div>
    </article>`;
  }
  const licName = (code) => (LICENSES.find((l) => l[0] === code) || [code, code])[1];

  /* ——— الصفحات ——— */
  function pageHead(title, sub, crumb) {
    return `<section class="page-h"><div class="wrap">${crumb ? `<div class="crumbs">${crumb}</div>` : ''}<h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div></section>`;
  }

  function vHome() {
    const up = sorted().filter((c) => c.start >= todayIso());
    const open = up.filter(isOpen);
    const seats = open.reduce((s, c) => s + left(c), 0);
    view.innerHTML = `
    <section class="hero"><div class="wrap hero-in">
      <div>
        <span class="kicker">الموسم التدريبي 2026 / 2027</span>
        <h1>إدارة التعليم<br>وتطوير الدارسين</h1>
        <p>نؤهّل المدربين والدارسين وفق مناهج الاتحاد الآسيوي لكرة القدم. اطّلع على رزنامة الدورات، وسجّل وادفع إلكترونياً في دقائق.</p>
        <div class="cta">
          <a class="btn btn-w" href="#calendar">رزنامة الدورات</a>
          <a class="btn btn-ghost" href="#register">سجّل الآن</a>
        </div>
      </div>
      <img class="hero-crest" src="assets/kfa-logo.png" alt="">
    </div></section>
    <div class="wrap">
      <div class="stats">
        <div class="stat"><b>${up.length}</b><span>دورة قادمة</span></div>
        <div class="stat"><b>${open.length}</b><span>مفتوحة للتسجيل</span></div>
        <div class="stat"><b>${seats}</b><span>مقعداً متاحاً</span></div>
        <div class="stat"><b>${Object.keys(CATS).length}</b><span>مسارات تعليمية</span></div>
      </div>
    </div>
    <section class="sec"><div class="wrap">
      <div class="sec-h"><div><h2>الدورات القادمة</h2><p>أقرب الدورات المفتوحة للتسجيل</p></div><a class="btn btn-o btn-sm" href="#calendar">عرض الرزنامة كاملة</a></div>
      <div class="grid">${(open.length ? open : up).slice(0, 6).map(courseCard).join('') || '<p class="empty">لا توجد دورات حالياً</p>'}</div>
    </div></section>
    <section class="sec" style="padding-top:0"><div class="wrap">
      <div class="sec-h"><div><h2>كيف أسجّل؟</h2><p>أربع خطوات من الاختيار حتى تأكيد المقعد</p></div></div>
      <div class="steps">
        <div class="step"><h3>اختر الدورة</h3><p>من الرزنامة حسب المسار والموعد وتأكد من الشروط.</p></div>
        <div class="step"><h3>عبّئ النموذج</h3><p>بياناتك الشخصية والرقم المدني والرخصة الحالية.</p></div>
        <div class="step"><h3>ادفع إلكترونياً</h3><p>كي نت أو بطاقة ائتمانية أو Apple Pay عبر بوابة آمنة.</p></div>
        <div class="step"><h3>استلم التأكيد</h3><p>رقم طلب وإيصال فوري، ثم اعتماد الإدارة للقبول النهائي.</p></div>
      </div>
    </div></section>
    ${faqHtml()}`;
  }

  function faqHtml() {
    return `<section class="sec" id="faq" style="padding-top:0"><div class="wrap">
      <div class="sec-h"><div><h2>الأسئلة الشائعة</h2></div></div>
      <details><summary>هل المقعد مضمون بعد الدفع؟</summary><p>يُحجز المقعد مبدئياً فور نجاح الدفع، ويصبح القبول نهائياً بعد مراجعة إدارة التعليم لاستيفاء الشروط.</p></details>
      <details><summary>ما المستندات المطلوبة؟</summary><p>صورة البطاقة المدنية، صورة شخصية، وصورة الرخصة السابقة للدورات التي تشترط رخصة مسبقة — تُسلَّم في اليوم الأول أو تُطلب عبر البريد.</p></details>
      <details><summary>هل يمكن استرداد الرسوم؟</summary><p>تُسترد الرسوم كاملة إذا أُلغيت الدورة أو لم يُقبل الدارس، ويخضع الانسحاب الشخصي لسياسة الإدارة المعلنة.</p></details>
      <details><summary>كيف أتابع طلبي؟</summary><p>من صفحة «طلباتي والدفع» برقم الطلب والرقم المدني، ويمكنك إكمال الدفع منها إن لم يكتمل.</p></details>
      <details><summary>للتواصل</summary><p>هاتف: <span class="ltr" style="display:inline-block">${esc(CFG.contact.phone)}</span> — بريد: ${esc(CFG.contact.email)}</p></details>
    </div></section>`;
  }

  /* ——— الرزنامة ——— */
  const calState = { cat: 'all', mode: 'month', ym: null };
  function vCalendar() {
    if (!calState.ym) {
      const first = sorted().find((c) => c.end >= todayIso());
      const d = first ? pd(first.start) : new Date();
      calState.ym = [d.getFullYear(), d.getMonth()];
    }
    view.innerHTML = pageHead('رزنامة الدورات', 'جميع الدورات التعليمية والتطويرية للموسم الحالي') + `
    <section class="sec"><div class="wrap">
      <div class="toolbar">
        <div class="chips" id="cats">
          <button class="chip" data-cat="all">الكل</button>
          ${Object.entries(CATS).map(([k, v]) => `<button class="chip" data-cat="${k}">${v}</button>`).join('')}
        </div>
        <div class="seg" id="mode"><button data-m="month">شهري</button><button data-m="list">قائمة</button></div>
      </div>
      <div id="calBody"></div>
      <div class="legend">${Object.entries(CATS).map(([k, v]) => `<span class="cat-${k}">${v}</span>`).join('')}</div>
    </div></section>`;
    $$('#cats .chip').forEach((b) => b.onclick = () => { calState.cat = b.dataset.cat; drawCal(); });
    $$('#mode button').forEach((b) => b.onclick = () => { calState.mode = b.dataset.m; drawCal(); });
    drawCal();
  }

  function drawCal() {
    $$('#cats .chip').forEach((b) => b.classList.toggle('on', b.dataset.cat === calState.cat));
    $$('#mode button').forEach((b) => b.classList.toggle('on', b.dataset.m === calState.mode));
    const list = sorted().filter((c) => calState.cat === 'all' || c.cat === calState.cat);
    const body = $('#calBody');
    if (calState.mode === 'list') {
      body.innerHTML = list.length ? `<div class="list">${list.map((c) => {
        const d = pd(c.start);
        return `<div class="row cat-${esc(c.cat)}">
          <div class="dt"><b>${d.getDate()}</b><small>${MONTHS[d.getMonth()]} ${d.getFullYear()}</small></div>
          <div><h3>${esc(c.title)}</h3><div class="meta"><span>حتى ${fmtD(c.end)}</span><span>📍 ${esc(c.place)}</span><span>💳 ${money(c.fee)}</span></div>${seatsBar(c)}</div>
          <div class="act">${isOpen(c) ? `<a class="btn btn-p btn-sm" href="#register/${encodeURIComponent(c.id)}">سجّل</a>` : ''} <a class="btn btn-o btn-sm" href="#course/${encodeURIComponent(c.id)}">التفاصيل</a></div>
        </div>`; }).join('')}</div>` : '<p class="empty">لا توجد دورات في هذا المسار</p>';
      return;
    }
    const [y, m] = calState.ym;
    const first = new Date(y, m, 1), startOff = first.getDay();
    const gridStart = new Date(y, m, 1 - startOff);
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart); d.setDate(gridStart.getDate() + i);
      const s = iso(d);
      const evs = list.filter((c) => c.start <= s && c.end >= s);
      cells.push(`<div class="d ${d.getMonth() !== m ? 'out' : ''} ${s === todayIso() ? 'today' : ''}"><span class="n">${d.getDate()}</span>${evs.map((c) => `<a class="ev cat-${esc(c.cat)}" href="#course/${encodeURIComponent(c.id)}" title="${esc(c.title)}">${esc(c.title)}</a>`).join('')}</div>`);
      if (i >= 34 && d.getMonth() !== m && i % 7 === 6) break;
    }
    body.innerHTML = `<div class="cal">
      <div class="cal-h"><button id="nx" aria-label="الشهر السابق">›</button><b>${MONTHS[m]} ${y}</b><button id="pv" aria-label="الشهر التالي">‹</button></div>
      <div class="cal-g">${DAYS.map((d) => `<div class="dn">${d}</div>`).join('')}${cells.join('')}</div>
    </div>`;
    $('#nx').onclick = () => { const d = new Date(y, m - 1, 1); calState.ym = [d.getFullYear(), d.getMonth()]; drawCal(); };
    $('#pv').onclick = () => { const d = new Date(y, m + 1, 1); calState.ym = [d.getFullYear(), d.getMonth()]; drawCal(); };
  }

  /* ——— تفاصيل دورة ——— */
  function vCourse(id) {
    const c = byId(id);
    if (!c) return vNotFound();
    const days = Math.round((pd(c.end) - pd(c.start)) / 864e5) + 1;
    view.innerHTML = pageHead(esc(c.title), esc(CATS[c.cat] || ''), '<a href="#calendar">رزنامة الدورات</a> / التفاصيل') + `
    <section class="sec"><div class="wrap layout">
      <div class="card cat-${esc(c.cat)}">
        <h2>عن الدورة</h2><p>${esc(c.desc)}</p>
        <h3>المعلومات الأساسية</h3>
        <div class="sum">
          <div class="ln"><span>رمز الدورة</span><b class="ltr">${esc(c.code)} · ${esc(c.id)}</b></div>
          <div class="ln"><span>الموعد</span><b>${fmtD(c.start)} — ${fmtD(c.end)}</b></div>
          <div class="ln"><span>المدة</span><b>${days} يوماً</b></div>
          <div class="ln"><span>المكان</span><b>${esc(c.place)}</b></div>
          <div class="ln"><span>الشرط المسبق</span><b>${c.prereq ? esc(licName(c.prereq)) : 'لا يوجد'}</b></div>
        </div>
        <h3>المقاعد</h3>${seatsBar(c)}
      </div>
      <aside class="card sticky">
        <div class="sum"><div class="ln tot"><span>رسوم الدورة</span><b>${money(c.fee)}</b></div></div>
        <div style="margin-top:14px">${isOpen(c) ? `<a class="btn btn-p" style="width:100%" href="#register/${encodeURIComponent(c.id)}">التسجيل في الدورة</a>` : `<div class="alert alert-w">${left(c) ? 'التسجيل مغلق لهذه الدورة' : 'اكتملت المقاعد — تابع الرزنامة للدورات القادمة'}</div>`}</div>
      </aside>
    </div></section>`;
  }

  /* ——— التسجيل ——— */
  function vRegister(id) {
    const open = sorted().filter(isOpen);
    let c = id ? byId(id) : null;
    if (c && !isOpen(c)) { toast('هذه الدورة غير متاحة للتسجيل'); c = null; }
    view.innerHTML = pageHead('التسجيل في الدورات', 'عبّئ البيانات بدقة كما في البطاقة المدنية') + `
    <section class="sec"><div class="wrap layout">
      <form class="card" id="regForm" novalidate>
        <h2>بيانات التسجيل</h2>
        <div class="fg">
          <div class="f full"><label for="course">الدورة <span class="req">*</span></label>
            <select id="course" name="course" required>
              <option value="">— اختر الدورة —</option>
              ${open.map((o) => `<option value="${esc(o.id)}" ${c && c.id === o.id ? 'selected' : ''}>${esc(o.title)} — ${fmtShort(o.start)} (${money(o.fee)})</option>`).join('')}
            </select><span class="err">اختر الدورة</span></div>
        </div>
        <h3>البيانات الشخصية</h3>
        <div class="fg">
          <div class="f full"><label for="name">الاسم الرباعي <span class="req">*</span></label><input id="name" name="name" autocomplete="name" required minlength="8"><span class="err">اكتب الاسم الرباعي</span></div>
          <div class="f"><label for="civil">الرقم المدني <span class="req">*</span></label><input id="civil" name="civil" inputmode="numeric" maxlength="12" class="ltr" required><span class="hint">12 رقماً</span><span class="err">الرقم المدني يجب أن يكون 12 رقماً</span></div>
          <div class="f"><label for="dob">تاريخ الميلاد <span class="req">*</span></label><input id="dob" name="dob" type="date" required><span class="err">العمر يجب أن يكون 18 سنة فأكثر</span></div>
          <div class="f"><label for="nat">الجنسية <span class="req">*</span></label><select id="nat" name="nat" required><option value="">— اختر —</option><option>كويتي</option><option>خليجي</option><option>عربي</option><option>أخرى</option></select><span class="err">اختر الجنسية</span></div>
          <div class="f"><label for="phone">رقم الهاتف <span class="req">*</span></label><input id="phone" name="phone" type="tel" inputmode="numeric" maxlength="8" class="ltr" placeholder="5XXXXXXX" required><span class="err">رقم كويتي من 8 أرقام</span></div>
          <div class="f full"><label for="email">البريد الإلكتروني <span class="req">*</span></label><input id="email" name="email" type="email" class="ltr" autocomplete="email" required><span class="err">بريد غير صحيح</span></div>
        </div>
        <h3>الخلفية الرياضية</h3>
        <div class="fg">
          <div class="f"><label for="club">النادي / الجهة</label><input id="club" name="club" placeholder="مثال: نادي القادسية"></div>
          <div class="f"><label for="role">الصفة الحالية</label><select id="role" name="role"><option>مدرب</option><option>مساعد مدرب</option><option>لاعب سابق</option><option>معلم تربية بدنية</option><option>طالب</option><option>أخرى</option></select></div>
          <div class="f"><label for="lic">أعلى رخصة حالية <span class="req">*</span></label><select id="lic" name="lic">${LICENSES.map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select><span class="err">هذه الدورة تشترط رخصة أعلى</span></div>
          <div class="f"><label for="licno">رقم الرخصة</label><input id="licno" name="licno" class="ltr"></div>
          <div class="f full"><label for="notes">ملاحظات</label><textarea id="notes" name="notes" rows="3" maxlength="500"></textarea></div>
        </div>
        <div style="margin-top:16px" class="f" id="agreeF">
          <label class="check"><input type="checkbox" id="agree" name="agree"> أقرّ بصحة البيانات، وبالالتزام بنسبة الحضور ولوائح إدارة التعليم وسياسة الاسترداد.</label>
          <span class="err">يجب الموافقة للمتابعة</span>
        </div>
        <div id="prereqMsg"></div>
        <div style="margin-top:18px;display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-p" type="submit">المتابعة إلى الدفع ←</button>
          <a class="btn btn-o" href="#calendar">رجوع للرزنامة</a>
        </div>
      </form>
      <aside class="card sticky" id="regSum"></aside>
    </div></section>`;

    const f = $('#regForm');
    const drawSum = () => {
      const cc = byId(f.course.value);
      $('#regSum').innerHTML = cc ? `<h2>ملخّص</h2><div class="sum">
          <div class="ln"><span>الدورة</span><b>${esc(cc.title)}</b></div>
          <div class="ln"><span>الموعد</span><b>${fmtShort(cc.start)} – ${fmtShort(cc.end)}</b></div>
          <div class="ln"><span>المكان</span><b>${esc(cc.place)}</b></div>
          <div class="ln"><span>المقاعد</span><b>${left(cc)} متبقٍ</b></div>
          <div class="ln tot"><span>المبلغ المستحق</span><b>${money(cc.fee)}</b></div></div>
          ${cc.prereq ? `<div class="alert alert-i">تشترط هذه الدورة: ${esc(licName(cc.prereq))}</div>` : ''}`
        : '<h2>ملخّص</h2><p class="muted">اختر دورة لعرض الرسوم والتفاصيل.</p>';
    };
    f.course.onchange = drawSum; drawSum();
    f.civil.oninput = () => { f.civil.value = f.civil.value.replace(/\D/g, '').slice(0, 12); };
    f.phone.oninput = () => { f.phone.value = f.phone.value.replace(/\D/g, '').slice(0, 8); };

    f.onsubmit = (e) => {
      e.preventDefault();
      const v = Object.fromEntries(new FormData(f));
      const bad = [];
      const mark = (name, ok) => { const el = f[name].closest('.f'); el.classList.toggle('bad', !ok); if (!ok) bad.push(el); };
      const cc = byId(v.course);
      mark('course', !!cc && isOpen(cc));
      mark('name', v.name.trim().split(/\s+/).length >= 3);
      mark('civil', /^[23]\d{11}$/.test(v.civil));
      const age = v.dob ? (Date.now() - pd(v.dob)) / (365.25 * 864e5) : 0;
      mark('dob', age >= 18 && age < 90);
      mark('nat', !!v.nat);
      mark('phone', /^[24569]\d{7}$/.test(v.phone));
      mark('email', /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email));
      const prereqOk = !cc || !cc.prereq || LIC_RANK[v.lic] >= LIC_RANK[cc.prereq];
      mark('lic', prereqOk);
      const agreeOk = !!f.agree.checked; $('#agreeF').classList.toggle('bad', !agreeOk); if (!agreeOk) bad.push($('#agreeF'));
      if (cc && regs.some((r) => r.courseId === cc.id && r.civil === v.civil && r.status !== 'cancelled')) {
        $('#prereqMsg').innerHTML = '<div class="alert alert-e">يوجد طلب سابق بنفس الرقم المدني لهذه الدورة — تابعه من «طلباتي والدفع».</div>';
        return;
      }
      $('#prereqMsg').innerHTML = '';
      if (bad.length) { bad[0].scrollIntoView({ behavior: 'smooth', block: 'center' }); toast('راجع الحقول المظللة'); return; }

      const ref = newRef();
      regs.push({
        ref, courseId: cc.id, courseTitle: cc.title, fee: cc.fee,
        name: v.name.trim(), civil: v.civil, dob: v.dob, nat: v.nat, phone: v.phone, email: v.email.trim(),
        club: v.club.trim(), role: v.role, lic: v.lic, licno: v.licno.trim(), notes: v.notes.trim(),
        status: 'pending', createdAt: new Date().toISOString(), payment: null
      });
      saveRegs();
      location.hash = `#pay/${ref}`;
    };
  }

  function newRef() {
    const y = new Date().getFullYear();
    let r;
    do { r = `KFA-${y}-${String(Math.floor(10000 + Math.random() * 90000))}`; } while (regs.some((x) => x.ref === r));
    return r;
  }
  const regByRef = (ref) => regs.find((r) => r.ref === ref);

  /* ——— الدفع ——— */
  function vPay(ref) {
    const r = regByRef(ref);
    if (!r) return vNotFound('لم يُعثر على الطلب');
    if (r.status !== 'pending') { location.hash = `#receipt/${ref}`; return; }
    const c = byId(r.courseId);
    view.innerHTML = pageHead('الدفع الإلكتروني', 'أكمل الدفع لتثبيت حجز مقعدك', `<a href="#status">طلباتي</a> / ${esc(ref)}`) + `
    <section class="sec"><div class="wrap layout">
      <div class="card">
        <h2>طريقة الدفع</h2>
        <div class="pm" id="pm">
          <label><input type="radio" name="pm" value="knet" checked> كي نت KNET <span class="logo" style="color:#0f3f94">KNET</span></label>
          <label><input type="radio" name="pm" value="card"> بطاقة ائتمانية (فيزا / ماستركارد) <span class="logo">VISA · MC</span></label>
          <label><input type="radio" name="pm" value="apple"> Apple Pay <span class="logo"> Pay</span></label>
        </div>
        <div class="alert alert-i" style="margin-top:14px">سيتم تحويلك إلى بوابة الدفع الآمنة لإدخال بيانات البطاقة — لا يحفظ الموقع أي بيانات بطاقات.</div>
        <div id="payMsg"></div>
        <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-g" id="payBtn">ادفع ${money(r.fee)}</button>
          <button class="btn btn-o" id="cancelBtn" type="button">إلغاء الطلب</button>
        </div>
        <div class="secure">🔒 اتصال مشفّر · المدفوعات تُعالَج عبر بوابة دفع مرخّصة في الكويت</div>
      </div>
      <aside class="card sticky">
        <h2>ملخّص الطلب</h2>
        <div class="sum">
          <div class="ln"><span>رقم الطلب</span><b class="ltr">${esc(r.ref)}</b></div>
          <div class="ln"><span>الدارس</span><b>${esc(r.name)}</b></div>
          <div class="ln"><span>الدورة</span><b>${esc(r.courseTitle)}</b></div>
          ${c ? `<div class="ln"><span>الموعد</span><b>${fmtShort(c.start)} – ${fmtShort(c.end)}</b></div>` : ''}
          <div class="ln tot"><span>الإجمالي</span><b>${money(r.fee)}</b></div>
        </div>
      </aside>
    </div></section>`;

    $('#cancelBtn').onclick = () => {
      if (!confirm('هل تريد إلغاء هذا الطلب؟')) return;
      r.status = 'cancelled'; saveRegs(); toast('أُلغي الطلب'); location.hash = '#status';
    };
    $('#payBtn').onclick = async () => {
      const btn = $('#payBtn'); btn.disabled = true; btn.textContent = 'جارٍ التحويل إلى بوابة الدفع…';
      const method = $('input[name=pm]:checked').value;
      const back = `${location.origin}${location.pathname}`;
      try {
        const res = await fetch(CFG.payEndpoint, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create', ref: r.ref, courseId: r.courseId, amount: r.fee, method, name: r.name, email: r.email, phone: r.phone, returnUrl: back })
        });
        const data = await res.json().catch(() => null);
        if (!data) return demoPay(r, method); // لا توجد دالة دفع (تشغيل محلي)
        if (res.ok && data.url) { r.payment = { method, invoiceId: data.invoiceId || null, startedAt: new Date().toISOString() }; saveRegs(); location.href = data.url; return; }
        if (data.demo) return demoPay(r, method);
        $('#payMsg').innerHTML = `<div class="alert alert-e">تعذّر بدء عملية الدفع: ${esc(data.error || 'خطأ غير معروف')}</div>`;
      } catch { return demoPay(r, method); }
      btn.disabled = false; btn.textContent = `ادفع ${money(r.fee)}`;
    };
  }

  // وضع تجريبي: يعمل محلياً أو قبل ضبط بوابة الدفع على الخادم.
  function demoPay(r, method) {
    $('#payMsg').innerHTML = `<div class="alert alert-w"><b>وضع تجريبي:</b> بوابة الدفع غير مفعّلة بعد على الخادم. يمكنك محاكاة دفع ناجح لتجربة المسار كاملاً.</div>
      <button class="btn btn-p" id="simOk">محاكاة دفع ناجح</button>`;
    const b = $('#payBtn'); b.disabled = false; b.textContent = `ادفع ${money(r.fee)}`;
    $('#simOk').onclick = () => markPaid(r, { method, demo: true, paymentId: 'DEMO-' + Date.now() });
  }

  function markPaid(r, p) {
    if (r.status === 'pending') {
      r.status = 'paid';
      r.payment = { ...(r.payment || {}), ...p, paidAt: new Date().toISOString() };
      const c = byId(r.courseId); if (c) { c.taken = Math.min(c.seats, c.taken + 1); saveCourses(); }
      saveRegs();
    }
    location.hash = `#receipt/${r.ref}`;
  }

  // عودة من بوابة الدفع: ?ref=…&paymentId=… (يُضيف MyFatoorah المعرّف إلى رابط العودة)
  async function vPaidReturn(params) {
    const ref = params.get('ref');
    const r = regByRef(ref);
    const pid = params.get('paymentId') || params.get('PaymentId');
    view.innerHTML = pageHead('التحقق من الدفع', 'لحظات…') + '<section class="sec"><div class="wrap"><div class="card empty">جارٍ التحقق من حالة الدفع مع البوابة…</div></div></section>';
    if (!r || !pid) return vNotFound('بيانات العودة من بوابة الدفع غير مكتملة');
    try {
      const res = await fetch(CFG.payEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'verify', ref, paymentId: pid }) });
      const d = await res.json();
      if (d.paid) return markPaid(r, { paymentId: pid, gatewayRef: d.reference || null, method: r.payment?.method });
      view.innerHTML = pageHead('لم يكتمل الدفع', '') + `<section class="sec"><div class="wrap"><div class="card receipt">
        <div class="ok" style="background:var(--red)">✕</div><h2>لم تتم عملية الدفع</h2><p class="muted">${esc(d.message || 'رُفضت العملية أو أُلغيت.')}</p>
        <a class="btn btn-p" href="#pay/${encodeURIComponent(ref)}">إعادة المحاولة</a></div></div></section>`;
    } catch { vNotFound('تعذّر التحقق من الدفع — حاول لاحقاً من «طلباتي»'); }
  }

  function vReceipt(ref) {
    const r = regByRef(ref);
    if (!r) return vNotFound('لم يُعثر على الطلب');
    const c = byId(r.courseId);
    const [stTxt, stCls] = STATUS[r.status];
    const paid = r.status === 'paid' || r.status === 'confirmed';
    view.innerHTML = pageHead(paid ? 'تم الدفع بنجاح' : 'تفاصيل الطلب', '') + `
    <section class="sec"><div class="wrap"><div class="card receipt">
      ${paid ? '<div class="ok">✓</div><h2>تم تسجيلك وحجز مقعدك مبدئياً</h2><p class="muted">ستراجع إدارة التعليم طلبك ويصلك تأكيد القبول النهائي على بريدك.</p>' : `<h2>حالة الطلب</h2>`}
      <div class="ref">${esc(r.ref)}</div>
      <div class="sum">
        <div class="ln"><span>الحالة</span><b><span class="badge ${stCls}">${stTxt}</span></b></div>
        <div class="ln"><span>الدارس</span><b>${esc(r.name)}</b></div>
        <div class="ln"><span>الرقم المدني</span><b class="ltr">${esc(r.civil.slice(0, 4))}••••${esc(r.civil.slice(-4))}</b></div>
        <div class="ln"><span>الدورة</span><b>${esc(r.courseTitle)}</b></div>
        ${c ? `<div class="ln"><span>الموعد</span><b>${fmtD(c.start)} — ${fmtD(c.end)}</b></div><div class="ln"><span>المكان</span><b>${esc(c.place)}</b></div>` : ''}
        ${r.payment?.paidAt ? `<div class="ln"><span>تاريخ الدفع</span><b>${new Date(r.payment.paidAt).toLocaleString('ar-KW-u-nu-latn')}</b></div><div class="ln"><span>مرجع العملية</span><b class="ltr">${esc(r.payment.paymentId || '')}</b></div>` : ''}
        ${r.payment?.demo ? '<div class="alert alert-w">عملية تجريبية — لم يُحصَّل أي مبلغ.</div>' : ''}
        <div class="ln tot"><span>المبلغ</span><b>${money(r.fee)}</b></div>
      </div>
      <div class="no-print" style="margin-top:18px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        ${r.status === 'pending' ? `<a class="btn btn-g" href="#pay/${encodeURIComponent(r.ref)}">إكمال الدفع</a>` : ''}
        <button class="btn btn-p" onclick="window.print()">طباعة الإيصال</button>
        <a class="btn btn-o" href="#calendar">الرزنامة</a>
      </div>
    </div></div></section>`;
  }

  /* ——— متابعة الطلب ——— */
  function vStatus() {
    view.innerHTML = pageHead('طلباتي والدفع', 'تابع حالة طلبك أو أكمل الدفع') + `
    <section class="sec"><div class="wrap" style="max-width:720px">
      <form class="card" id="lk">
        <h2>البحث عن طلب</h2>
        <div class="fg">
          <div class="f"><label for="lref">رقم الطلب أو البريد</label><input id="lref" class="ltr" placeholder="KFA-2026-12345" required></div>
          <div class="f"><label for="lcv">الرقم المدني</label><input id="lcv" class="ltr" inputmode="numeric" maxlength="12" required></div>
        </div>
        <div style="margin-top:14px"><button class="btn btn-p">بحث</button></div>
      </form>
      <div id="lkRes" style="margin-top:16px"></div>
    </div></section>`;
    $('#lk').onsubmit = (e) => {
      e.preventDefault();
      const q = $('#lref').value.trim().toUpperCase(), cv = $('#lcv').value.trim();
      const found = regs.filter((r) => r.civil === cv && (r.ref === q || r.email.toUpperCase() === q));
      $('#lkRes').innerHTML = found.length ? `<div class="list">${found.map((r) => {
        const [t, cls] = STATUS[r.status];
        return `<div class="row" style="--c:var(--blue)"><div class="dt"><small class="ltr">${esc(r.ref)}</small></div>
          <div><h3>${esc(r.courseTitle)}</h3><span class="badge ${cls}">${t}</span> <span class="muted">${money(r.fee)}</span></div>
          <div class="act">${r.status === 'pending' ? `<a class="btn btn-g btn-sm" href="#pay/${encodeURIComponent(r.ref)}">ادفع</a>` : ''} <a class="btn btn-o btn-sm" href="#receipt/${encodeURIComponent(r.ref)}">عرض</a></div></div>`;
      }).join('')}</div>` : '<div class="alert alert-e">لا يوجد طلب مطابق. تأكد من رقم الطلب والرقم المدني.</div>';
    };
  }

  /* ——— لوحة الإدارة ——— */
  let adminTab = 'regs';
  function vAdmin() {
    if (sessionStorage.getItem(KEY_A) !== '1') {
      view.innerHTML = pageHead('لوحة الإدارة', 'خاصة بموظفي إدارة التعليم') + `
      <section class="sec"><div class="wrap" style="max-width:420px"><form class="card" id="pinF">
        <div class="f"><label for="pin">رمز الدخول</label><input id="pin" type="password" inputmode="numeric" class="ltr" autocomplete="off" required></div>
        <div style="margin-top:14px"><button class="btn btn-p" style="width:100%">دخول</button></div></form></div></section>`;
      $('#pinF').onsubmit = (e) => { e.preventDefault(); if ($('#pin').value === CFG.adminPin) { sessionStorage.setItem(KEY_A, '1'); vAdmin(); } else toast('رمز غير صحيح'); };
      return;
    }
    const paid = regs.filter((r) => r.status === 'paid' || r.status === 'confirmed');
    const income = paid.filter((r) => !r.payment?.demo).reduce((s, r) => s + Number(r.fee), 0);
    view.innerHTML = pageHead('لوحة الإدارة', 'إدارة الدورات والتسجيلات') + `
    <section class="sec"><div class="wrap">
      <div class="kpis">
        <div class="stat"><b>${regs.length}</b><span>إجمالي الطلبات</span></div>
        <div class="stat"><b>${paid.length}</b><span>مدفوعة</span></div>
        <div class="stat"><b>${regs.filter((r) => r.status === 'pending').length}</b><span>بانتظار الدفع</span></div>
        <div class="stat"><b style="font-size:22px">${money(income)}</b><span>المحصّل الفعلي</span></div>
      </div>
      <div class="toolbar">
        <div class="tabs"><button class="chip" data-t="regs">التسجيلات</button><button class="chip" data-t="courses">الدورات</button></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-o btn-sm" id="csv">تصدير Excel (CSV)</button><button class="btn btn-o btn-sm" id="out">خروج</button></div>
      </div>
      <div id="adm"></div>
    </div></section>`;
    $$('.tabs .chip').forEach((b) => { b.classList.toggle('on', b.dataset.t === adminTab); b.onclick = () => { adminTab = b.dataset.t; vAdmin(); }; });
    $('#out').onclick = () => { sessionStorage.removeItem(KEY_A); location.hash = '#home'; };
    $('#csv').onclick = exportCsv;
    adminTab === 'regs' ? admRegs() : admCourses();
  }

  function admRegs() {
    const rows = [...regs].reverse();
    $('#adm').innerHTML = rows.length ? `<div class="tbl-wrap"><table><thead><tr><th>رقم الطلب</th><th>الاسم</th><th>الرقم المدني</th><th>الهاتف</th><th>الدورة</th><th>الرخصة</th><th>المبلغ</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td class="ltr">${esc(r.ref)}</td><td>${esc(r.name)}</td><td class="ltr">${esc(r.civil)}</td><td class="ltr">${esc(r.phone)}</td><td>${esc(r.courseTitle)}</td><td>${esc(licName(r.lic))}</td><td>${money(r.fee)}${r.payment?.demo ? ' <small class="muted">(تجريبي)</small>' : ''}</td>
        <td><span class="badge ${STATUS[r.status][1]}">${STATUS[r.status][0]}</span></td>
        <td><select data-ref="${esc(r.ref)}" class="stSel">${Object.entries(STATUS).map(([k, [t]]) => `<option value="${k}" ${k === r.status ? 'selected' : ''}>${t}</option>`).join('')}</select></td></tr>`).join('')}
      </tbody></table></div>` : '<p class="empty">لا توجد تسجيلات بعد</p>';
    $$('.stSel').forEach((s) => s.onchange = () => {
      const r = regByRef(s.dataset.ref); const was = r.status; r.status = s.value;
      const c = byId(r.courseId);
      const holds = (st) => st === 'paid' || st === 'confirmed';
      if (c && holds(was) !== holds(r.status)) { c.taken = Math.max(0, Math.min(c.seats, c.taken + (holds(r.status) ? 1 : -1))); saveCourses(); }
      saveRegs(); toast('تم تحديث الحالة'); vAdmin();
    });
  }

  function admCourses() {
    $('#adm').innerHTML = `<div style="margin-bottom:12px"><button class="btn btn-p btn-sm" id="addC">+ إضافة دورة</button> <button class="btn btn-o btn-sm" id="resetC">استعادة الدورات الافتراضية</button></div>
      <div class="tbl-wrap"><table><thead><tr><th>الرمز</th><th>الدورة</th><th>المسار</th><th>من</th><th>إلى</th><th>المقاعد</th><th>الرسوم</th><th></th></tr></thead><tbody>
      ${sorted().map((c) => `<tr><td class="ltr">${esc(c.id)}</td><td>${esc(c.title)}</td><td>${esc(CATS[c.cat])}</td><td>${fmtShort(c.start)}</td><td>${fmtShort(c.end)}</td><td>${c.taken}/${c.seats}</td><td>${money(c.fee)}</td>
      <td><button class="btn btn-o btn-sm" data-ed="${esc(c.id)}">تعديل</button> <button class="btn btn-sm" style="color:var(--red);background:none" data-del="${esc(c.id)}">حذف</button></td></tr>`).join('')}
      </tbody></table></div><div id="cForm"></div>`;
    $('#addC').onclick = () => courseForm();
    $('#resetC').onclick = () => { if (confirm('استبدال كل الدورات بالقائمة الافتراضية؟')) { courses = CFG.seedCourses.map((c) => ({ ...c })); saveCourses(); vAdmin(); } };
    $$('[data-ed]').forEach((b) => b.onclick = () => courseForm(byId(b.dataset.ed)));
    $$('[data-del]').forEach((b) => b.onclick = () => {
      if (regs.some((r) => r.courseId === b.dataset.del && r.status !== 'cancelled')) return toast('لا يمكن حذف دورة عليها تسجيلات — عدّلها بدلاً من ذلك');
      if (confirm('حذف الدورة؟')) { courses = courses.filter((c) => c.id !== b.dataset.del); saveCourses(); vAdmin(); }
    });
  }

  function courseForm(c) {
    const isNew = !c; c = c || { id: '', cat: 'afc', code: '', title: '', start: '', end: '', place: 'مقر الاتحاد — العديلية', seats: 25, taken: 0, fee: 100, prereq: '', desc: '' };
    $('#cForm').innerHTML = `<form class="card" id="cf" style="margin-top:16px"><h2>${isNew ? 'دورة جديدة' : 'تعديل: ' + esc(c.title)}</h2><div class="fg">
      <div class="f"><label>رمز فريد</label><input name="id" class="ltr" value="${esc(c.id)}" ${isNew ? '' : 'readonly'} required pattern="[A-Za-z0-9-]{2,20}"></div>
      <div class="f"><label>المسار</label><select name="cat">${Object.entries(CATS).map(([k, v]) => `<option value="${k}" ${k === c.cat ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div class="f full"><label>اسم الدورة</label><input name="title" value="${esc(c.title)}" required></div>
      <div class="f"><label>رمز الرخصة الممنوحة</label><input name="code" class="ltr" value="${esc(c.code)}"></div>
      <div class="f"><label>الشرط المسبق</label><select name="prereq">${LICENSES.map(([k, v]) => `<option value="${k}" ${k === c.prereq ? 'selected' : ''}>${k ? v : 'لا يوجد'}</option>`).join('')}</select></div>
      <div class="f"><label>تاريخ البداية</label><input type="date" name="start" value="${esc(c.start)}" required></div>
      <div class="f"><label>تاريخ النهاية</label><input type="date" name="end" value="${esc(c.end)}" required></div>
      <div class="f full"><label>المكان</label><input name="place" value="${esc(c.place)}" required></div>
      <div class="f"><label>عدد المقاعد</label><input type="number" min="1" name="seats" value="${c.seats}" required></div>
      <div class="f"><label>الرسوم (د.ك)</label><input type="number" min="0" step="0.5" name="fee" value="${c.fee}" required></div>
      <div class="f full"><label>الوصف</label><textarea name="desc" rows="3">${esc(c.desc)}</textarea></div>
    </div><div style="margin-top:14px;display:flex;gap:8px"><button class="btn btn-p">حفظ</button><button type="button" class="btn btn-o" id="cfX">إلغاء</button></div></form>`;
    $('#cf').scrollIntoView({ behavior: 'smooth' });
    $('#cfX').onclick = () => { $('#cForm').innerHTML = ''; };
    $('#cf').onsubmit = (e) => {
      e.preventDefault();
      const v = Object.fromEntries(new FormData(e.target));
      if (v.end < v.start) return toast('تاريخ النهاية قبل البداية');
      if (isNew && byId(v.id)) return toast('الرمز مستخدم');
      const obj = { ...c, ...v, seats: Number(v.seats), fee: Number(v.fee) };
      if (isNew) courses.push(obj); else courses[courses.findIndex((x) => x.id === c.id)] = obj;
      saveCourses(); toast('تم الحفظ'); vAdmin();
    };
  }

  function exportCsv() {
    const head = ['رقم الطلب', 'الاسم', 'الرقم المدني', 'تاريخ الميلاد', 'الجنسية', 'الهاتف', 'البريد', 'النادي', 'الصفة', 'الرخصة', 'رقم الرخصة', 'الدورة', 'المبلغ', 'الحالة', 'مرجع الدفع', 'تاريخ التسجيل'];
    const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const lines = regs.map((r) => [r.ref, r.name, r.civil, r.dob, r.nat, r.phone, r.email, r.club, r.role, licName(r.lic), r.licno, r.courseTitle, r.fee, STATUS[r.status][0], r.payment?.paymentId, r.createdAt].map(q).join(','));
    const blob = new Blob(['﻿' + [head.map(q).join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `kfa-registrations-${todayIso()}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function vNotFound(msg) {
    view.innerHTML = pageHead('غير موجود', '') + `<section class="sec"><div class="wrap"><div class="card empty"><p>${esc(msg || 'الصفحة المطلوبة غير موجودة')}</p><a class="btn btn-p" href="#home">الرئيسية</a></div></div></section>`;
  }

  /* ——— التوجيه ——— */
  function route() {
        const qs = new URLSearchParams(location.search);
    const raw = location.hash.slice(1) || 'home';
    const [path, query] = raw.split('?');
    const [name, arg] = path.split('/').map(decodeURIComponent);
    $$('.nav a').forEach((a) => a.classList.toggle('on', a.dataset.r === name || (name === 'course' && a.dataset.r === 'calendar') || ((name === 'pay' || name === 'receipt') && a.dataset.r === 'status')));
    $('#nav').classList.remove('open'); $('#menuBtn').setAttribute('aria-expanded', 'false');
    const params = new URLSearchParams(query || '');
    // العودة من بوابة الدفع: /kfa-edu/?ref=KFA-…&paymentId=…
    if (qs.get('ref') && (qs.get('paymentId') || qs.get('PaymentId'))) {
      history.replaceState(null, '', location.pathname + '#paid');
      return vPaidReturn(qs);
    }
    switch (name) {
      case 'home': vHome(); break;
      case 'faq': vHome(); setTimeout(() => $('#faq')?.scrollIntoView(), 30); return;
      case 'calendar': vCalendar(); break;
      case 'course': vCourse(arg); break;
      case 'register': vRegister(arg); break;
      case 'pay': vPay(arg); break;
      case 'paid': vPaidReturn(params); break;
      case 'receipt': vReceipt(arg); break;
      case 'status': vStatus(); break;
      case 'admin': vAdmin(); break;
      default: vNotFound();
    }
    window.scrollTo({ top: 0 });
  }

  $('#menuBtn').onclick = () => { const n = $('#nav'); n.classList.toggle('open'); $('#menuBtn').setAttribute('aria-expanded', n.classList.contains('open')); };
  $('#yr').textContent = new Date().getFullYear();
  window.addEventListener('hashchange', route);
  window.addEventListener('storage', (e) => { if (e.key === KEY_C) courses = load(KEY_C, courses); if (e.key === KEY_R) regs = load(KEY_R, regs); });
  route();
})();
