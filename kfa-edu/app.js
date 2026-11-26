/* =========================================================================
   إدارة التعليم وتطوير الدارسين — الاتحاد الكويتي لكرة القدم
   تطبيق صفحة واحدة: رزنامة الدورات ← التسجيل ← الدفع ← الإيصال، ولوحة إدارة مرنة.

   مصدر البيانات:
   - «مركزي»: /api/kfa-edu (Firestore) على الموقع المنشور — كل الأجهزة ترى نفس البيانات.
   - «محلي»: localStorage عند التشغيل المحلي أو قبل ضبط Firestore.
   القواعد (السعر، فتح التسجيل…) في rules.js ومشتركة مع الخادم.
   ========================================================================= */
(function () {
  'use strict';
  const CFG = window.KFA_CONFIG;
  const R = window.KFA_RULES;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const view = $('#view');

  /* ——— أدوات التاريخ والعرض ——— */
  const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const pd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const fmtD = (s) => { const d = pd(s); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
  const fmtShort = (s) => { const d = pd(s); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };
  const money = (n) => (Number(n) === 0 ? 'مجاناً' : `${Number(n).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ${CFG.currency}`);
  const today = () => iso(new Date());
  const daysTxt = (c) => (c.days && c.days.length && c.days.length < 7 ? c.days.map((d) => DAYS[d]).join('، ') : '');

  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 3000);
  }

  /* =======================================================================
     طبقة البيانات
     ======================================================================= */
  const LS = {
    get: (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { toast('تعذّر الحفظ على هذا الجهاز'); } }
  };
  const K = { cat: 'kfaedu.catalog.v2', regs: 'kfaedu.regs.v1', mine: 'kfaedu.mine', admin: 'kfaedu.adminKey' };

  let mode = 'local';          // 'remote' | 'local'
  let cats = [], courses = [];  // الكتالوج المعروض
  const adminKey = () => sessionStorage.getItem(K.admin) || '';

  async function api(action, body = {}, admin = false) {
    const res = await fetch(CFG.dataEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(admin ? { 'x-kfa-admin': adminKey() } : {}) },
      body: JSON.stringify({ action, ...body })
    });
    const data = await res.json().catch(() => null);
    if (!data) throw Object.assign(new Error('no-api'), { noApi: true });
    if (!res.ok) throw Object.assign(new Error(data.error || 'خطأ'), { status: res.status });
    return data;
  }

  /* —— المحلي —— */
  function localCatalog() {
    let c = LS.get(K.cat, null);
    if (!c) c = { cats: (CFG.seedCats || R.DEFAULT_CATS).map(R.cleanCat), courses: CFG.seedCourses.map(R.cleanCourse).filter(Boolean) };
    return c;
  }
  const localRegs = () => LS.get(K.regs, []);
  function localWithTaken(list) {
    const n = {};
    localRegs().forEach((r) => { if (r.status === 'paid' || r.status === 'confirmed') n[r.courseId] = (n[r.courseId] || 0) + 1; });
    return list.map((c) => ({ ...c, taken: (c.reserved || 0) + (n[c.id] || 0) }));
  }

  const store = {
    async catalog(admin) {
      if (mode === 'remote') return api(admin ? 'adminCatalog' : 'catalog', {}, admin);
      const c = localCatalog();
      return { cats: c.cats, courses: localWithTaken(c.courses).filter((x) => admin || x.status !== 'draft') };
    },
    async register(v) {
      if (mode === 'remote') return api('register', v);
      const c = localWithTaken(localCatalog().courses).find((x) => x.id === v.courseId);
      if (!c || !R.isOpenFor(c, today())) throw new Error('الدورة غير متاحة للتسجيل');
      const regs = localRegs();
      if (regs.some((r) => r.courseId === c.id && r.civil === v.civil && r.status !== 'cancelled')) throw new Error('يوجد طلب سابق بنفس الرقم المدني لهذه الدورة');
      const fee = R.priceFor(c, today());
      let ref; do { ref = `KFA-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`; } while (regs.some((x) => x.ref === ref));
      regs.push({ ...v, ref, courseTitle: c.title, fee, status: fee > 0 ? 'pending' : 'paid', createdAt: new Date().toISOString(), payment: fee > 0 ? null : { method: 'free', paidAt: new Date().toISOString() } });
      LS.set(K.regs, regs);
      return { ref, fee, status: fee > 0 ? 'pending' : 'paid' };
    },
    async get(ref, civil) {
      if (mode === 'remote') return (await api('get', { ref, civil })).reg;
      const r = localRegs().find((x) => x.ref === ref && x.civil === civil);
      if (!r) throw new Error('لم يُعثر على الطلب');
      return r;
    },
    async lookup(q, civil) {
      if (mode === 'remote') return (await api('lookup', { q, civil })).regs;
      const Q = q.toUpperCase();
      return localRegs().filter((r) => r.civil === civil && (r.ref === Q || String(r.email).toUpperCase() === Q));
    },
    async adminCheck(key) {
      if (mode === 'local') return key === CFG.adminPin;
      sessionStorage.setItem(K.admin, key);
      try { await api('adminCheck', {}, true); return true; } catch { sessionStorage.removeItem(K.admin); return false; }
    },
    async saveCatalog(c) {
      if (mode === 'remote') return api('saveCatalog', c, true);
      LS.set(K.cat, c); return { ok: true };
    },
    async adminRegs() {
      if (mode === 'remote') return (await api('adminRegs', {}, true)).regs;
      return [...localRegs()].reverse();
    },
    async setStatus(ref, status) {
      if (mode === 'remote') return api('setStatus', { ref, status }, true);
      const regs = localRegs(); const r = regs.find((x) => x.ref === ref); if (r) r.status = status; LS.set(K.regs, regs);
    },
    // محاكاة الدفع في الوضع التجريبي (محلي فقط)
    markPaidLocal(ref, p) {
      const regs = localRegs(); const r = regs.find((x) => x.ref === ref);
      if (r && r.status === 'pending') { r.status = 'paid'; r.payment = { ...p, paidAt: new Date().toISOString() }; LS.set(K.regs, regs); }
    }
  };

  // طلبات هذا الجهاز (لفتح الدفع/الإيصال دون إعادة إدخال الرقم المدني)
  const mine = {
    all: () => LS.get(K.mine, []),
    add: (ref, civil) => { const m = mine.all().filter((x) => x.ref !== ref); m.push({ ref, civil }); LS.set(K.mine, m.slice(-30)); },
    civil: (ref) => (mine.all().find((x) => x.ref === ref) || {}).civil
  };

  async function refresh() {
    const c = await store.catalog(false);
    cats = c.cats; courses = c.courses;
  }

  /* ——— مساعدات الكتالوج ——— */
  const catOf = (id) => cats.find((c) => c.id === id) || { id, name: id, color: '#0f3f94' };
  const byId = (id) => courses.find((c) => c.id === id);
  const sorted = (list = courses) => [...list].sort((a, b) => a.start.localeCompare(b.start));
  const isOpen = (c) => R.isOpenFor(c, today());
  const priceNow = (c) => R.priceFor(c, today());
  const licName = (code) => (R.LICENSES.find((l) => l[0] === code) || [code, code])[1];
  const STATUS = { pending: ['بانتظار الدفع', 'b-pend'], paid: ['مدفوع — قيد المراجعة', 'b-paid'], confirmed: ['مقبول نهائياً', 'b-conf'], cancelled: ['ملغى', 'b-canc'] };

  function seatsBar(c) {
    if (!c.seats) return '<div class="seats-t">مقاعد مفتوحة</div>';
    const pct = Math.min(100, Math.round(((c.taken || 0) / c.seats) * 100));
    const l = R.seatsLeft(c);
    const cls = l === 0 ? 'full' : l <= 5 ? 'low' : '';
    return `<div class="seats ${cls}"><i style="width:${pct}%"></i></div><div class="seats-t">${l === 0 ? 'المقاعد مكتملة' : `متبقٍ ${l} من ${c.seats} مقعداً`}</div>`;
  }
  function priceHtml(c) {
    const now = priceNow(c);
    if (now !== c.fee) return `<div class="price">${money(now)} <small><s>${money(c.fee)}</s> · مبكر حتى ${fmtShort(c.earlyUntil)}</small></div>`;
    return `<div class="price">${money(c.fee)}</div>`;
  }
  const regBtn = (c, sm = true) => isOpen(c)
    ? `<a class="btn btn-p ${sm ? 'btn-sm' : ''}" href="#register/${encodeURIComponent(c.id)}">سجّل</a>`
    : `<button class="btn btn-o ${sm ? 'btn-sm' : ''}" disabled>${R.closedReason(c, today())}</button>`;
  const catStyle = (c) => `style="--c:${esc(catOf(c.cat).color)}"`;

  function courseCard(c) {
    return `<article class="course" ${catStyle(c)}>
      <div class="course-b">
        <div><span class="tag">${esc(catOf(c.cat).name)}</span></div>
        <h3>${esc(c.title)}</h3>
        <div class="meta"><span>📅 ${fmtShort(c.start)}${c.end !== c.start ? ` – ${fmtD(c.end)}` : ` ${pd(c.start).getFullYear()}`}</span>${c.place ? `<span>📍 ${esc(c.place)}</span>` : ''}</div>
        ${c.time || daysTxt(c) ? `<div class="meta"><span>🕓 ${esc([daysTxt(c), c.time].filter(Boolean).join(' · '))}</span></div>` : ''}
        ${c.prereq ? `<div class="meta"><span>🎓 يشترط: ${esc(licName(c.prereq))}</span></div>` : ''}
        ${seatsBar(c)}
      </div>
      <div class="course-f">${priceHtml(c)}
        <div style="display:flex;gap:6px"><a class="btn btn-o btn-sm" href="#course/${encodeURIComponent(c.id)}">التفاصيل</a>${regBtn(c)}</div>
      </div>
    </article>`;
  }

  function pageHead(title, sub, crumb) {
    return `<section class="page-h"><div class="wrap">${crumb ? `<div class="crumbs">${crumb}</div>` : ''}<h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div></section>`;
  }
  const loading = (t = 'جارٍ التحميل…') => { view.innerHTML = `<section class="sec"><div class="wrap"><div class="card empty">${t}</div></div></section>`; };

  /* =======================================================================
     الصفحات العامة
     ======================================================================= */
  function vHome() {
    const up = sorted().filter((c) => c.end >= today());
    const open = up.filter(isOpen);
    const seats = open.reduce((s, c) => s + (c.seats ? R.seatsLeft(c) : 0), 0);
    view.innerHTML = `
    <section class="hero"><div class="wrap hero-in">
      <div>
        <span class="kicker">الموسم التدريبي 2026 / 2027</span>
        <h1>إدارة التعليم<br>وتطوير الدارسين</h1>
        <p>نؤهّل المدربين والدارسين وفق مناهج الاتحاد الآسيوي لكرة القدم. اطّلع على رزنامة الدورات، وسجّل وادفع إلكترونياً في دقائق.</p>
        <div class="cta"><a class="btn btn-w" href="#calendar">رزنامة الدورات</a><a class="btn btn-ghost" href="#register">سجّل الآن</a></div>
      </div>
      <img class="hero-crest" src="assets/kfa-logo.png" alt="">
    </div></section>
    <div class="wrap"><div class="stats">
      <div class="stat"><b>${up.length}</b><span>دورة قادمة</span></div>
      <div class="stat"><b>${open.length}</b><span>مفتوحة للتسجيل</span></div>
      <div class="stat"><b>${seats}</b><span>مقعداً متاحاً</span></div>
      <div class="stat"><b>${cats.length}</b><span>مسارات تعليمية</span></div>
    </div></div>
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
    <section class="sec" id="faq" style="padding-top:0"><div class="wrap">
      <div class="sec-h"><div><h2>الأسئلة الشائعة</h2></div></div>
      <details><summary>هل المقعد مضمون بعد الدفع؟</summary><p>يُحجز المقعد مبدئياً فور نجاح الدفع، ويصبح القبول نهائياً بعد مراجعة إدارة التعليم لاستيفاء الشروط.</p></details>
      <details><summary>ما المستندات المطلوبة؟</summary><p>صورة البطاقة المدنية، صورة شخصية، وصورة الرخصة السابقة للدورات التي تشترط رخصة مسبقة.</p></details>
      <details><summary>هل يمكن استرداد الرسوم؟</summary><p>تُسترد الرسوم كاملة إذا أُلغيت الدورة أو لم يُقبل الدارس، ويخضع الانسحاب الشخصي لسياسة الإدارة المعلنة.</p></details>
      <details><summary>كيف أتابع طلبي؟</summary><p>من صفحة «طلباتي والدفع» برقم الطلب والرقم المدني، ويمكنك إكمال الدفع منها إن لم يكتمل.</p></details>
      <details><summary>للتواصل</summary><p>هاتف: <span class="ltr" style="display:inline-block">${esc(CFG.contact.phone)}</span> — بريد: ${esc(CFG.contact.email)}</p></details>
    </div></section>`;
  }

  /* ——— الرزنامة ——— */
  const calState = { cat: 'all', mode: 'month', ym: null };
  function vCalendar() {
    if (!calState.ym) {
      const first = sorted().find((c) => c.end >= today());
      const d = first ? pd(first.start) : new Date();
      calState.ym = [d.getFullYear(), d.getMonth()];
    }
    view.innerHTML = pageHead('رزنامة الدورات', 'جميع الدورات التعليمية والتطويرية') + `
    <section class="sec"><div class="wrap">
      <div class="toolbar">
        <div class="chips" id="cats"><button class="chip" data-cat="all">الكل</button>${cats.map((k) => `<button class="chip" data-cat="${esc(k.id)}">${esc(k.name)}</button>`).join('')}</div>
        <div class="seg" id="mode"><button data-m="month">شهري</button><button data-m="list">قائمة</button></div>
      </div>
      <div id="calBody"></div>
      <div class="legend">${cats.map((k) => `<span style="--c:${esc(k.color)}">${esc(k.name)}</span>`).join('')}</div>
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
        return `<div class="row" ${catStyle(c)}>
          <div class="dt"><b>${d.getDate()}</b><small>${MONTHS[d.getMonth()]} ${d.getFullYear()}</small></div>
          <div><h3>${esc(c.title)}</h3><div class="meta"><span>حتى ${fmtD(c.end)}</span>${c.time ? `<span>🕓 ${esc(c.time)}</span>` : ''}${c.place ? `<span>📍 ${esc(c.place)}</span>` : ''}<span>💳 ${money(priceNow(c))}</span></div>${seatsBar(c)}</div>
          <div class="act">${regBtn(c)} <a class="btn btn-o btn-sm" href="#course/${encodeURIComponent(c.id)}">التفاصيل</a></div>
        </div>`; }).join('')}</div>` : '<p class="empty">لا توجد دورات في هذا المسار</p>';
      return;
    }
    const [y, m] = calState.ym;
    const gridStart = new Date(y, m, 1 - new Date(y, m, 1).getDay());
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart); d.setDate(gridStart.getDate() + i);
      if (i % 7 === 0 && i >= 28 && d.getMonth() !== m) break;
      const s = iso(d);
      const evs = list.filter((c) => c.start <= s && c.end >= s && (!c.days || !c.days.length || c.days.includes(d.getDay())));
      cells.push(`<div class="d ${d.getMonth() !== m ? 'out' : ''} ${s === today() ? 'today' : ''}"><span class="n">${d.getDate()}</span>${evs.map((c) => `<a class="ev" ${catStyle(c)} href="#course/${encodeURIComponent(c.id)}" title="${esc(c.title)}">${esc(c.title)}</a>`).join('')}</div>`);
    }
    body.innerHTML = `<div class="cal">
      <div class="cal-h"><button id="pv" aria-label="الشهر السابق">›</button><b>${MONTHS[m]} ${y}</b><button id="nx" aria-label="الشهر التالي">‹</button></div>
      <div class="cal-g">${DAYS.map((d) => `<div class="dn">${d}</div>`).join('')}${cells.join('')}</div>
    </div>`;
    $('#pv').onclick = () => { const d = new Date(y, m - 1, 1); calState.ym = [d.getFullYear(), d.getMonth()]; drawCal(); };
    $('#nx').onclick = () => { const d = new Date(y, m + 1, 1); calState.ym = [d.getFullYear(), d.getMonth()]; drawCal(); };
  }

  /* ——— تفاصيل دورة ——— */
  function vCourse(id) {
    const c = byId(id);
    if (!c) return vNotFound('الدورة غير موجودة');
    const days = Math.round((pd(c.end) - pd(c.start)) / 864e5) + 1;
    const ln = (k, v) => (v ? `<div class="ln"><span>${k}</span><b>${v}</b></div>` : '');
    view.innerHTML = pageHead(esc(c.title), esc(catOf(c.cat).name), '<a href="#calendar">رزنامة الدورات</a> / التفاصيل') + `
    <section class="sec"><div class="wrap layout">
      <div class="card">
        ${c.desc ? `<h2>عن الدورة</h2><p style="white-space:pre-line">${esc(c.desc)}</p>` : ''}
        <h3>المعلومات الأساسية</h3>
        <div class="sum">
          ${ln('رمز الدورة', c.code ? `<span class="ltr">${esc(c.code)}</span>` : '')}
          ${ln('الموعد', c.end !== c.start ? `${fmtD(c.start)} — ${fmtD(c.end)}` : fmtD(c.start))}
          ${ln('المدة', days > 1 ? `${days} يوماً` : 'يوم واحد')}
          ${ln('أيام الانعقاد', esc(daysTxt(c)))}
          ${ln('التوقيت', esc(c.time))}
          ${ln('المكان', esc(c.place))}
          ${ln('المحاضر', esc(c.instructor))}
          ${ln('لغة الدورة', esc(c.lang))}
          ${ln('الفئة المستهدفة', esc(c.audience))}
          ${ln('الشرط المسبق', c.prereq ? esc(licName(c.prereq)) : 'لا يوجد')}
          ${ln('فترة التسجيل', c.regOpen || c.regClose ? `${c.regOpen ? 'من ' + fmtShort(c.regOpen) : ''} ${c.regClose ? 'حتى ' + fmtD(c.regClose) : ''}` : '')}
        </div>
        ${c.requirements ? `<h3>المتطلبات</h3><p style="white-space:pre-line">${esc(c.requirements)}</p>` : ''}
        <h3>المقاعد</h3>${seatsBar(c)}
      </div>
      <aside class="card sticky">
        <div class="sum"><div class="ln tot"><span>رسوم الدورة</span><b>${money(priceNow(c))}</b></div>
        ${priceNow(c) !== c.fee ? `<div class="alert alert-s">سعر التسجيل المبكر حتى ${fmtD(c.earlyUntil)} — بعدها ${money(c.fee)}</div>` : ''}</div>
        <div style="margin-top:14px">${isOpen(c) ? `<a class="btn btn-p" style="width:100%" href="#register/${encodeURIComponent(c.id)}">التسجيل في الدورة</a>` : `<div class="alert alert-w">${R.closedReason(c, today())}</div>`}</div>
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
        <div class="fg"><div class="f full"><label for="course">الدورة <span class="req">*</span></label>
          <select id="course" name="courseId" required><option value="">— اختر الدورة —</option>
          ${open.map((o) => `<option value="${esc(o.id)}" ${c && c.id === o.id ? 'selected' : ''}>${esc(o.title)} — ${fmtShort(o.start)} (${money(priceNow(o))})</option>`).join('')}
          </select><span class="err">اختر الدورة</span></div></div>
        <h3>البيانات الشخصية</h3>
        <div class="fg">
          <div class="f full"><label for="name">الاسم الرباعي <span class="req">*</span></label><input id="name" name="name" autocomplete="name" required><span class="err">اكتب الاسم الرباعي</span></div>
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
          <div class="f"><label for="lic">أعلى رخصة حالية</label><select id="lic" name="lic">${R.LICENSES.map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select><span class="err">هذه الدورة تشترط رخصة أعلى</span></div>
          <div class="f"><label for="licno">رقم الرخصة</label><input id="licno" name="licno" class="ltr"></div>
          <div class="f full"><label for="notes">ملاحظات</label><textarea id="notes" name="notes" rows="3" maxlength="500"></textarea></div>
        </div>
        <div style="margin-top:16px" class="f" id="agreeF">
          <label class="check"><input type="checkbox" id="agree"> أقرّ بصحة البيانات، وبالالتزام بنسبة الحضور ولوائح إدارة التعليم وسياسة الاسترداد.</label>
          <span class="err">يجب الموافقة للمتابعة</span>
        </div>
        <div id="regMsg"></div>
        <div style="margin-top:18px;display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-p" type="submit" id="regBtn">المتابعة ←</button><a class="btn btn-o" href="#calendar">رجوع للرزنامة</a>
        </div>
      </form>
      <aside class="card sticky" id="regSum"></aside>
    </div></section>`;

    const f = $('#regForm');
    const drawSum = () => {
      const cc = byId(f.courseId.value);
      $('#regBtn').textContent = cc && priceNow(cc) === 0 ? 'تأكيد التسجيل ✓' : 'المتابعة إلى الدفع ←';
      $('#regSum').innerHTML = cc ? `<h2>ملخّص</h2><div class="sum">
          <div class="ln"><span>الدورة</span><b>${esc(cc.title)}</b></div>
          <div class="ln"><span>الموعد</span><b>${fmtShort(cc.start)} – ${fmtShort(cc.end)}</b></div>
          ${cc.time ? `<div class="ln"><span>التوقيت</span><b>${esc(cc.time)}</b></div>` : ''}
          ${cc.place ? `<div class="ln"><span>المكان</span><b>${esc(cc.place)}</b></div>` : ''}
          <div class="ln tot"><span>المبلغ المستحق</span><b>${money(priceNow(cc))}</b></div></div>
          ${cc.prereq ? `<div class="alert alert-i">تشترط هذه الدورة: ${esc(licName(cc.prereq))}</div>` : ''}`
        : '<h2>ملخّص</h2><p class="muted">اختر دورة لعرض الرسوم والتفاصيل.</p>';
    };
    f.courseId.onchange = drawSum; drawSum();
    f.civil.oninput = () => { f.civil.value = f.civil.value.replace(/\D/g, '').slice(0, 12); };
    f.phone.oninput = () => { f.phone.value = f.phone.value.replace(/\D/g, '').slice(0, 8); };

    f.onsubmit = async (e) => {
      e.preventDefault();
      const v = Object.fromEntries(new FormData(f));
      Object.keys(v).forEach((k) => { v[k] = String(v[k]).trim(); });
      const bad = [];
      const mark = (name, ok) => { const el = f[name].closest('.f'); el.classList.toggle('bad', !ok); if (!ok) bad.push(el); };
      const cc = byId(v.courseId);
      mark('courseId', !!cc && isOpen(cc));
      mark('name', v.name.split(/\s+/).length >= 3);
      mark('civil', /^[23]\d{11}$/.test(v.civil));
      const age = v.dob ? (Date.now() - pd(v.dob)) / (365.25 * 864e5) : 0;
      mark('dob', age >= 18 && age < 90);
      mark('nat', !!v.nat);
      mark('phone', /^[24569]\d{7}$/.test(v.phone));
      mark('email', /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email));
      mark('lic', !cc || !cc.prereq || R.LIC_RANK[v.lic] >= R.LIC_RANK[cc.prereq]);
      const agreeOk = $('#agree').checked; $('#agreeF').classList.toggle('bad', !agreeOk); if (!agreeOk) bad.push($('#agreeF'));
      $('#regMsg').innerHTML = '';
      if (bad.length) { bad[0].scrollIntoView({ behavior: 'smooth', block: 'center' }); toast('راجع الحقول المظللة'); return; }
      const btn = $('#regBtn'); btn.disabled = true;
      try {
        const res = await store.register(v);
        mine.add(res.ref, v.civil);
        location.hash = res.status === 'pending' ? `#pay/${res.ref}` : `#receipt/${res.ref}`;
      } catch (err) {
        $('#regMsg').innerHTML = `<div class="alert alert-e">${esc(err.message)}</div>`; btn.disabled = false;
      }
    };
  }

  /* ——— الدفع ——— */
  async function loadMyReg(ref) {
    const civil = mine.civil(ref);
    if (!civil) { toast('أدخل رقم الطلب والرقم المدني'); location.hash = '#status'; return null; }
    try { return await store.get(ref, civil); } catch (e) { vNotFound(e.message); return null; }
  }

  async function vPay(ref) {
    loading();
    const r = await loadMyReg(ref); if (!r) return;
    if (r.status !== 'pending') { location.hash = `#receipt/${ref}`; return; }
    const c = byId(r.courseId);
    view.innerHTML = pageHead('الدفع الإلكتروني', 'أكمل الدفع لتثبيت حجز مقعدك', `<a href="#status">طلباتي</a> / ${esc(ref)}`) + `
    <section class="sec"><div class="wrap layout">
      <div class="card">
        <h2>طريقة الدفع</h2>
        <div class="pm">
          <label><input type="radio" name="pm" value="knet" checked> كي نت KNET <span class="logo" style="color:#0f3f94">KNET</span></label>
          <label><input type="radio" name="pm" value="card"> بطاقة ائتمانية (فيزا / ماستركارد) <span class="logo">VISA · MC</span></label>
          <label><input type="radio" name="pm" value="apple"> Apple Pay <span class="logo"> Pay</span></label>
        </div>
        <div class="alert alert-i" style="margin-top:14px">سيتم تحويلك إلى بوابة الدفع الآمنة لإدخال بيانات البطاقة — لا يحفظ الموقع أي بيانات بطاقات.</div>
        <div id="payMsg"></div>
        <div style="margin-top:16px"><button class="btn btn-g" id="payBtn">ادفع ${money(r.fee)}</button></div>
        <div class="secure">🔒 اتصال مشفّر · المدفوعات تُعالَج عبر بوابة دفع مرخّصة في الكويت</div>
      </div>
      <aside class="card sticky"><h2>ملخّص الطلب</h2><div class="sum">
        <div class="ln"><span>رقم الطلب</span><b class="ltr">${esc(r.ref)}</b></div>
        <div class="ln"><span>الدارس</span><b>${esc(r.name)}</b></div>
        <div class="ln"><span>الدورة</span><b>${esc(r.courseTitle)}</b></div>
        ${c ? `<div class="ln"><span>الموعد</span><b>${fmtShort(c.start)} – ${fmtShort(c.end)}</b></div>` : ''}
        <div class="ln tot"><span>الإجمالي</span><b>${money(r.fee)}</b></div>
      </div></aside>
    </div></section>`;

    $('#payBtn').onclick = async () => {
      const btn = $('#payBtn'); btn.disabled = true; btn.textContent = 'جارٍ التحويل إلى بوابة الدفع…';
      const method = $('input[name=pm]:checked').value;
      const reset = () => { btn.disabled = false; btn.textContent = `ادفع ${money(r.fee)}`; };
      try {
        const res = await fetch(CFG.payEndpoint, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create', ref: r.ref, civil: r.civil, courseId: r.courseId, method, name: r.name, email: r.email, phone: r.phone, returnUrl: location.origin + location.pathname })
        });
        const data = await res.json().catch(() => null);
        if (data && res.ok && data.url) { location.href = data.url; return; }
        if (!data || data.demo) { reset(); return demoPay(r, method); }
        $('#payMsg').innerHTML = `<div class="alert alert-e">تعذّر بدء عملية الدفع: ${esc(data.error || 'خطأ غير معروف')}</div>`;
      } catch { return (reset(), demoPay(r, method)); }
      reset();
    };
  }

  // وضع تجريبي: بوابة الدفع غير مفعّلة بعد. المحاكاة متاحة في الوضع المحلي فقط.
  function demoPay(r, method) {
    if (mode === 'remote') {
      $('#payMsg').innerHTML = '<div class="alert alert-w">الدفع الإلكتروني غير مفعّل بعد. سيبقى طلبك محفوظاً «بانتظار الدفع» ويمكنك إكماله لاحقاً من «طلباتي».</div>';
      return;
    }
    $('#payMsg').innerHTML = `<div class="alert alert-w"><b>وضع تجريبي:</b> بوابة الدفع غير مفعّلة. يمكنك محاكاة دفع ناجح لتجربة المسار.</div><button class="btn btn-p" id="simOk">محاكاة دفع ناجح</button>`;
    $('#simOk').onclick = () => { store.markPaidLocal(r.ref, { method, demo: true, paymentId: 'DEMO-' + Date.now() }); location.hash = `#receipt/${r.ref}`; };
  }

  // العودة من بوابة الدفع: ?ref=…&paymentId=…
  async function vPaidReturn(qs) {
    const ref = qs.get('ref'), pid = qs.get('paymentId') || qs.get('PaymentId');
    loading('جارٍ التحقق من حالة الدفع مع البوابة…');
    try {
      const res = await fetch(CFG.payEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'verify', ref, paymentId: pid }) });
      const d = await res.json();
      if (d.paid) { await refresh(); location.hash = `#receipt/${ref}`; return; }
      view.innerHTML = pageHead('لم يكتمل الدفع', '') + `<section class="sec"><div class="wrap"><div class="card receipt">
        <div class="ok" style="background:var(--red)">✕</div><h2>لم تتم عملية الدفع</h2><p class="muted">${esc(d.message || d.error || 'رُفضت العملية أو أُلغيت.')}</p>
        <a class="btn btn-p" href="#pay/${encodeURIComponent(ref)}">إعادة المحاولة</a></div></div></section>`;
    } catch { vNotFound('تعذّر التحقق من الدفع — حاول لاحقاً من «طلباتي»'); }
  }

  async function vReceipt(ref) {
    loading();
    const r = await loadMyReg(ref); if (!r) return;
    const c = byId(r.courseId);
    const [stTxt, stCls] = STATUS[r.status] || ['', ''];
    const paid = r.status === 'paid' || r.status === 'confirmed';
    view.innerHTML = pageHead(paid ? 'تم التسجيل بنجاح' : 'تفاصيل الطلب', '') + `
    <section class="sec"><div class="wrap"><div class="card receipt">
      ${paid ? '<div class="ok">✓</div><h2>تم تسجيلك وحجز مقعدك مبدئياً</h2><p class="muted">ستراجع إدارة التعليم طلبك ويصلك تأكيد القبول النهائي على بريدك.</p>' : '<h2>حالة الطلب</h2>'}
      <div class="ref">${esc(r.ref)}</div>
      <div class="sum">
        <div class="ln"><span>الحالة</span><b><span class="badge ${stCls}">${stTxt}</span></b></div>
        <div class="ln"><span>الدارس</span><b>${esc(r.name)}</b></div>
        <div class="ln"><span>الرقم المدني</span><b class="ltr">${esc(r.civil.slice(0, 4))}••••${esc(r.civil.slice(-4))}</b></div>
        <div class="ln"><span>الدورة</span><b>${esc(r.courseTitle)}</b></div>
        ${c ? `<div class="ln"><span>الموعد</span><b>${fmtD(c.start)} — ${fmtD(c.end)}</b></div>${c.time ? `<div class="ln"><span>التوقيت</span><b>${esc(c.time)}</b></div>` : ''}${c.place ? `<div class="ln"><span>المكان</span><b>${esc(c.place)}</b></div>` : ''}` : ''}
        ${r.payment?.paidAt && r.payment.method !== 'free' ? `<div class="ln"><span>تاريخ الدفع</span><b>${new Date(r.payment.paidAt).toLocaleString('ar-KW-u-nu-latn')}</b></div><div class="ln"><span>مرجع العملية</span><b class="ltr">${esc(r.payment.reference || r.payment.paymentId || '')}</b></div>` : ''}
        ${r.payment?.demo ? '<div class="alert alert-w">عملية تجريبية — لم يُحصَّل أي مبلغ.</div>' : ''}
        <div class="ln tot"><span>المبلغ</span><b>${money(r.fee)}</b></div>
      </div>
      <div class="no-print" style="margin-top:18px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        ${r.status === 'pending' ? `<a class="btn btn-g" href="#pay/${encodeURIComponent(r.ref)}">إكمال الدفع</a>` : ''}
        <button class="btn btn-p" onclick="window.print()">طباعة الإيصال</button><a class="btn btn-o" href="#calendar">الرزنامة</a>
      </div>
    </div></div></section>`;
  }

  /* ——— متابعة الطلب ——— */
  function vStatus() {
    view.innerHTML = pageHead('طلباتي والدفع', 'تابع حالة طلبك أو أكمل الدفع') + `
    <section class="sec"><div class="wrap" style="max-width:720px">
      <form class="card" id="lk"><h2>البحث عن طلب</h2>
        <div class="fg">
          <div class="f"><label for="lref">رقم الطلب أو البريد</label><input id="lref" class="ltr" placeholder="KFA-2026-12345" required></div>
          <div class="f"><label for="lcv">الرقم المدني</label><input id="lcv" class="ltr" inputmode="numeric" maxlength="12" required></div>
        </div>
        <div style="margin-top:14px"><button class="btn btn-p">بحث</button></div>
      </form>
      <div id="lkRes" style="margin-top:16px"></div>
    </div></section>`;
    $('#lk').onsubmit = async (e) => {
      e.preventDefault();
      const q = $('#lref').value.trim(), cv = $('#lcv').value.trim();
      let found = [];
      try { found = await store.lookup(q, cv); } catch (err) { $('#lkRes').innerHTML = `<div class="alert alert-e">${esc(err.message)}</div>`; return; }
      found.forEach((r) => mine.add(r.ref, cv));
      $('#lkRes').innerHTML = found.length ? `<div class="list">${found.map((r) => {
        const [t, cls] = STATUS[r.status];
        return `<div class="row" style="--c:var(--blue)"><div class="dt"><small class="ltr">${esc(r.ref)}</small></div>
          <div><h3>${esc(r.courseTitle)}</h3><span class="badge ${cls}">${t}</span> <span class="muted">${money(r.fee)}</span></div>
          <div class="act">${r.status === 'pending' ? `<a class="btn btn-g btn-sm" href="#pay/${encodeURIComponent(r.ref)}">ادفع</a>` : ''} <a class="btn btn-o btn-sm" href="#receipt/${encodeURIComponent(r.ref)}">عرض</a></div></div>`;
      }).join('')}</div>` : '<div class="alert alert-e">لا يوجد طلب مطابق. تأكد من رقم الطلب والرقم المدني.</div>';
    };
  }

  /* =======================================================================
     لوحة الإدارة
     ======================================================================= */
  let adminTab = 'courses';
  let A = { cats: [], courses: [], regs: [] };   // نسخة الإدارة (تشمل المسودات)
  const isAdminIn = () => sessionStorage.getItem('kfaedu.adminOk') === '1';

  async function vAdmin() {
    if (!isAdminIn()) {
      view.innerHTML = pageHead('لوحة الإدارة', 'خاصة بموظفي إدارة التعليم') + `
      <section class="sec"><div class="wrap" style="max-width:420px"><form class="card" id="pinF">
        <div class="f"><label for="pin">رمز الإدارة</label><input id="pin" type="password" class="ltr" autocomplete="off" required></div>
        <div style="margin-top:14px"><button class="btn btn-p" style="width:100%">دخول</button></div>
        <p class="muted" style="font-size:13px;margin:10px 0 0">${mode === 'remote' ? 'الوضع المركزي — البيانات مشتركة بين كل الأجهزة.' : 'الوضع المحلي — البيانات على هذا الجهاز فقط.'}</p></form></div></section>`;
      $('#pinF').onsubmit = async (e) => {
        e.preventDefault();
        if (await store.adminCheck($('#pin').value)) { sessionStorage.setItem('kfaedu.adminOk', '1'); vAdmin(); } else toast('رمز غير صحيح');
      };
      return;
    }
    loading();
    try {
      const [c, regs] = await Promise.all([store.catalog(true), store.adminRegs()]);
      A = { cats: c.cats, courses: c.courses, regs };
    } catch (e) {
      if (e.status === 401) { sessionStorage.removeItem('kfaedu.adminOk'); return vAdmin(); }
      return vNotFound(e.message);
    }
    drawAdmin();
  }

  function drawAdmin() {
    const paid = A.regs.filter((r) => r.status === 'paid' || r.status === 'confirmed');
    const income = paid.filter((r) => !r.payment?.demo).reduce((s, r) => s + Number(r.fee), 0);
    view.innerHTML = pageHead('لوحة الإدارة', mode === 'remote' ? 'البيانات مركزية — تظهر للجميع فور الحفظ' : 'وضع محلي — البيانات على هذا الجهاز فقط') + `
    <section class="sec"><div class="wrap">
      <div class="kpis">
        <div class="stat"><b>${A.courses.length}</b><span>دورة (منها ${A.courses.filter((c) => c.status === 'draft').length} مسودة)</span></div>
        <div class="stat"><b>${A.regs.length}</b><span>طلب تسجيل</span></div>
        <div class="stat"><b>${paid.length}</b><span>مدفوع / مقبول</span></div>
        <div class="stat"><b style="font-size:22px">${money(income).replace('مجاناً', '0.000 ' + CFG.currency)}</b><span>المحصّل الفعلي</span></div>
      </div>
      <div class="toolbar">
        <div class="tabs">
          <button class="chip" data-t="courses">الدورات</button><button class="chip" data-t="regs">التسجيلات</button><button class="chip" data-t="cats">المسارات</button><button class="chip" data-t="import">استيراد من Excel</button>
        </div>
        <button class="btn btn-o btn-sm" id="out">خروج</button>
      </div>
      <div id="adm"></div>
    </div></section>`;
    $$('.tabs .chip').forEach((b) => { b.classList.toggle('on', b.dataset.t === adminTab); b.onclick = () => { adminTab = b.dataset.t; drawAdmin(); }; });
    $('#out').onclick = () => { sessionStorage.removeItem('kfaedu.adminOk'); sessionStorage.removeItem(K.admin); location.hash = '#home'; };
    ({ courses: admCourses, regs: admRegs, cats: admCats, import: admImport })[adminTab]();
  }

  async function persist(msg) {
    try {
      await store.saveCatalog({ cats: A.cats, courses: A.courses.map(R.cleanCourse).filter(Boolean) });
      await refresh(); toast(msg || 'تم الحفظ'); return true;
    } catch (e) { toast('تعذّر الحفظ: ' + e.message); return false; }
  }

  /* —— الدورات —— */
  const admFilter = { q: '', cat: 'all', st: 'all' };
  function admCourses() {
    const st = { published: ['منشورة', 'b-paid'], closed: ['مغلقة', 'b-pend'], draft: ['مسودة', 'b-canc'] };
    const list = [...A.courses].sort((a, b) => a.start.localeCompare(b.start)).filter((c) =>
      (admFilter.cat === 'all' || c.cat === admFilter.cat) && (admFilter.st === 'all' || c.status === admFilter.st) &&
      (!admFilter.q || (c.title + c.id + c.code).toLowerCase().includes(admFilter.q.toLowerCase())));
    $('#adm').innerHTML = `
      <div class="toolbar">
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-p btn-sm" id="addC">+ دورة جديدة</button>
          <button class="btn btn-o btn-sm" id="expC">تصدير الدورات (Excel)</button>
        </div>
        <div class="admf">
          <input id="fq" placeholder="بحث…" value="${esc(admFilter.q)}" style="width:160px">
          <select id="fc"><option value="all">كل المسارات</option>${A.cats.map((k) => `<option value="${esc(k.id)}" ${admFilter.cat === k.id ? 'selected' : ''}>${esc(k.name)}</option>`).join('')}</select>
          <select id="fs"><option value="all">كل الحالات</option>${Object.entries(st).map(([k, [t]]) => `<option value="${k}" ${admFilter.st === k ? 'selected' : ''}>${t}</option>`).join('')}</select>
        </div>
      </div>
      <div id="cForm"></div>
      <div class="tbl-wrap"><table><thead><tr><th>الدورة</th><th>المسار</th><th>الموعد</th><th>المقاعد</th><th>الرسوم</th><th>الحالة</th><th></th></tr></thead><tbody>
      ${list.map((c) => `<tr><td><b>${esc(c.title)}</b><br><small class="muted ltr">${esc(c.id)}</small></td><td><span class="tag" style="--c:${esc(catOf2(c.cat).color)}">${esc(catOf2(c.cat).name)}</span></td>
        <td>${fmtShort(c.start)} – ${fmtShort(c.end)}</td><td>${c.taken || 0}/${c.seats || '∞'}</td><td>${money(c.fee)}${c.earlyFee != null ? `<br><small class="muted">مبكر ${money(c.earlyFee)}</small>` : ''}</td>
        <td><span class="badge ${st[c.status][1]}">${st[c.status][0]}</span></td>
        <td><button class="btn btn-o btn-sm" data-ed="${esc(c.id)}">تعديل</button> <button class="btn btn-o btn-sm" data-dup="${esc(c.id)}">نسخ</button> <button class="btn btn-sm" style="color:var(--red);background:none" data-del="${esc(c.id)}">حذف</button></td></tr>`).join('') || '<tr><td colspan="7" class="empty">لا توجد دورات</td></tr>'}
      </tbody></table></div>`;
    $('#fq').oninput = (e) => { admFilter.q = e.target.value; clearTimeout(admCourses._t); admCourses._t = setTimeout(() => { admCourses(); $('#fq').focus(); $('#fq').setSelectionRange(99, 99); }, 250); };
    $('#fc').onchange = (e) => { admFilter.cat = e.target.value; admCourses(); };
    $('#fs').onchange = (e) => { admFilter.st = e.target.value; admCourses(); };
    $('#addC').onclick = () => courseForm(null);
    $('#expC').onclick = () => downloadCsv(`kfa-courses-${today()}.csv`, COURSE_COLS.map((x) => x[1]), A.courses.map(courseToRow));
    const find = (id) => A.courses.find((c) => c.id === id);
    $$('[data-ed]').forEach((b) => b.onclick = () => courseForm(find(b.dataset.ed)));
    $$('[data-dup]').forEach((b) => b.onclick = () => {
      const src = find(b.dataset.dup);
      courseForm({ ...src, id: uniqueId(src.id), status: 'draft', reserved: 0, taken: 0 }, true);
    });
    $$('[data-del]').forEach((b) => b.onclick = async () => {
      if (A.regs.some((r) => r.courseId === b.dataset.del && r.status !== 'cancelled')) return toast('عليها تسجيلات — غيّر حالتها إلى «مسودة» أو «مغلقة» بدلاً من الحذف');
      if (!confirm('حذف الدورة نهائياً؟')) return;
      A.courses = A.courses.filter((c) => c.id !== b.dataset.del);
      if (await persist('حُذفت الدورة')) drawAdmin();
    });
  }
  const catOf2 = (id) => A.cats.find((c) => c.id === id) || { id, name: id || '—', color: '#888888' };
  function uniqueId(base) {
    const b = String(base || 'C').replace(/-\d+$/, '').slice(0, 18) || 'C';
    let i = 2; while (A.courses.some((c) => c.id === `${b}-${i}`)) i++;
    return `${b}-${i}`;
  }

  function courseForm(c, isCopy) {
    const isNew = !c || isCopy;
    c = c || { id: uniqueId('C' + new Date().getFullYear().toString().slice(2)), cat: A.cats[0]?.id || '', code: '', title: '', status: 'draft', start: '', end: '', days: [], time: '', place: 'مقر الاتحاد — العديلية', instructor: '', lang: 'العربية', audience: '', seats: 25, reserved: 0, fee: 0, earlyFee: null, earlyUntil: '', regOpen: '', regClose: '', prereq: '', requirements: '', desc: '' };
    const F = (name, label, input, cls = '', hint = '') => `<div class="f ${cls}"><label for="cf_${name}">${label}</label>${input}${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
    const inp = (name, val, attrs = '') => `<input id="cf_${name}" name="${name}" value="${esc(val ?? '')}" ${attrs}>`;
    $('#cForm').innerHTML = `<form class="card" id="cf" style="margin-bottom:16px;border:2px solid var(--blue-soft)" novalidate>
      <h2>${isCopy ? 'نسخة من: ' + esc(c.title) : isNew ? 'دورة جديدة' : 'تعديل: ' + esc(c.title)}</h2>
      <h3>الأساسيات</h3><div class="fg">
        ${F('title', 'اسم الدورة <span class="req">*</span>', inp('title', c.title, 'required'), 'full')}
        ${F('cat', 'المسار', `<select id="cf_cat" name="cat">${A.cats.map((k) => `<option value="${esc(k.id)}" ${k.id === c.cat ? 'selected' : ''}>${esc(k.name)}</option>`).join('')}</select>`, '', '<a href="#admin" id="goCats">إدارة المسارات</a>')}
        ${F('status', 'الحالة', `<select id="cf_status" name="status">${Object.entries(R.STATUSES).map(([k, v]) => `<option value="${k}" ${k === c.status ? 'selected' : ''}>${v}</option>`).join('')}</select>`)}
        ${F('id', 'الرمز الداخلي <span class="req">*</span>', inp('id', c.id, `class="ltr" ${isNew ? '' : 'readonly'} required`), '', 'حروف إنجليزية وأرقام و - فقط، لا يتغير بعد الحفظ')}
        ${F('code', 'رمز الشهادة / الرخصة', inp('code', c.code, 'class="ltr" placeholder="AFC-C"'))}
      </div>
      <h3>الموعد والمكان</h3><div class="fg">
        ${F('start', 'تاريخ البداية <span class="req">*</span>', inp('start', c.start, 'type="date" required'))}
        ${F('end', 'تاريخ النهاية', inp('end', c.end, 'type="date"'), '', 'اتركه فارغاً لدورة يوم واحد')}
        <div class="f full"><label>أيام الانعقاد</label><div class="chips" id="cf_days">${DAYS.map((d, i) => `<label class="chip ${c.days?.includes(i) ? 'on' : ''}"><input type="checkbox" value="${i}" ${c.days?.includes(i) ? 'checked' : ''} hidden>${d}</label>`).join('')}</div><span class="hint">بدون اختيار = كل الأيام بين البداية والنهاية</span></div>
        ${F('time', 'التوقيت', inp('time', c.time, 'placeholder="مثال: 4:00 – 8:00 مساءً"'))}
        ${F('place', 'المكان', inp('place', c.place))}
        ${F('instructor', 'المحاضر / المحاضرون', inp('instructor', c.instructor))}
        ${F('lang', 'لغة الدورة', inp('lang', c.lang))}
        ${F('audience', 'الفئة المستهدفة', inp('audience', c.audience, 'placeholder="مثال: رجال ونساء، مدربو الأندية"'), 'full')}
      </div>
      <h3>المقاعد والتسجيل</h3><div class="fg">
        ${F('seats', 'عدد المقاعد', inp('seats', c.seats, 'type="number" min="0"'), '', '0 = بلا حد')}
        ${F('reserved', 'مقاعد محجوزة مسبقاً', inp('reserved', c.reserved || 0, 'type="number" min="0"'), '', 'خارج الموقع (مبتعثون، تسجيل يدوي…)')}
        ${F('regOpen', 'يفتح التسجيل في', inp('regOpen', c.regOpen, 'type="date"'), '', 'اختياري — فارغ = مفتوح الآن')}
        ${F('regClose', 'يُغلق التسجيل في', inp('regClose', c.regClose, 'type="date"'), '', 'اختياري — فارغ = قبل يوم البداية')}
        ${F('prereq', 'الرخصة المطلوبة مسبقاً', `<select id="cf_prereq" name="prereq">${R.LICENSES.map(([k, v]) => `<option value="${k}" ${k === c.prereq ? 'selected' : ''}>${v}</option>`).join('')}</select>`)}
      </div>
      <h3>الرسوم</h3><div class="fg">
        ${F('fee', `الرسوم (${CFG.currency})`, inp('fee', c.fee, 'type="number" min="0" step="0.001"'), '', '0 = دورة مجانية (تسجيل بدون دفع)')}
        <div></div>
        ${F('earlyFee', 'سعر التسجيل المبكر', inp('earlyFee', c.earlyFee ?? '', 'type="number" min="0" step="0.001"'), '', 'اختياري')}
        ${F('earlyUntil', 'السعر المبكر حتى', inp('earlyUntil', c.earlyUntil, 'type="date"'))}
      </div>
      <h3>المحتوى</h3><div class="fg">
        ${F('desc', 'وصف الدورة', `<textarea id="cf_desc" name="desc" rows="4">${esc(c.desc)}</textarea>`, 'full')}
        ${F('requirements', 'المتطلبات والمستندات', `<textarea id="cf_requirements" name="requirements" rows="3" placeholder="كل متطلب في سطر">${esc(c.requirements)}</textarea>`, 'full')}
      </div>
      <div id="cfMsg"></div>
      <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-p">حفظ</button><button type="button" class="btn btn-o" id="cfX">إلغاء</button></div>
    </form>`;
    $('#cf').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $$('#cf_days input').forEach((i) => i.onchange = () => i.parentElement.classList.toggle('on', i.checked));
    $('#goCats').onclick = (e) => { e.preventDefault(); adminTab = 'cats'; drawAdmin(); };
    $('#cfX').onclick = () => { $('#cForm').innerHTML = ''; };
    $('#cf').onsubmit = async (e) => {
      e.preventDefault();
      const v = Object.fromEntries(new FormData(e.target));
      v.days = $$('#cf_days input:checked').map((i) => Number(i.value));
      if (!v.end) v.end = v.start;
      const err = (m) => { $('#cfMsg').innerHTML = `<div class="alert alert-e">${m}</div>`; };
      if (!v.title.trim()) return err('اكتب اسم الدورة');
      if (!/^[A-Za-z0-9_-]{2,24}$/.test(v.id)) return err('الرمز الداخلي: حروف إنجليزية وأرقام و - فقط (2–24)');
      if (!v.start) return err('حدّد تاريخ البداية');
      if (v.end < v.start) return err('تاريخ النهاية قبل البداية');
      if (isNew && A.courses.some((x) => x.id === v.id)) return err('الرمز الداخلي مستخدم لدورة أخرى');
      if (v.earlyFee !== '' && !v.earlyUntil) return err('حدّد تاريخ انتهاء السعر المبكر');
      if (v.regOpen && v.regClose && v.regClose < v.regOpen) return err('إغلاق التسجيل قبل فتحه');
      const obj = R.cleanCourse({ ...c, ...v });
      if (!obj) return err('بيانات غير صالحة');
      if (isNew) A.courses.push(obj); else A.courses[A.courses.findIndex((x) => x.id === c.id)] = obj;
      if (await persist(obj.status === 'draft' ? 'حُفظت كمسودة (لا تظهر للجمهور)' : 'تم الحفظ والنشر')) drawAdmin();
    };
  }

  /* —— المسارات —— */
  function admCats() {
    $('#adm').innerHTML = `<div class="card" style="max-width:760px">
      <h2>المسارات التعليمية</h2><p class="muted">تظهر كفلاتر في الرزنامة، ولكل مسار لون.</p>
      <div id="catRows">${A.cats.map((k, i) => catRow(k, i)).join('')}</div>
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><button class="btn btn-o btn-sm" id="addCat">+ مسار جديد</button><button class="btn btn-p btn-sm" id="saveCats">حفظ المسارات</button></div>
    </div>`;
    $('#addCat').onclick = () => { A.cats.push({ id: 'cat' + (A.cats.length + 1), name: '', color: '#0f3f94', _new: true }); admCats(); };
    $$('[data-rm]').forEach((b) => b.onclick = () => {
      const k = A.cats[b.dataset.rm];
      if (A.courses.some((c) => c.cat === k.id)) return toast('المسار مستخدم في دورات — انقلها أولاً');
      A.cats.splice(b.dataset.rm, 1); admCats();
    });
    $('#saveCats').onclick = async () => {
      const rows = $$('.catrow').map((r) => ({ id: r.querySelector('[name=id]').value.trim(), name: r.querySelector('[name=name]').value.trim(), color: r.querySelector('[name=color]').value }));
      if (rows.some((r) => !r.name || !/^[A-Za-z0-9_-]{1,20}$/.test(r.id))) return toast('لكل مسار اسم ورمز إنجليزي');
      if (new Set(rows.map((r) => r.id)).size !== rows.length) return toast('رموز المسارات مكررة');
      A.cats = rows;
      if (await persist('حُفظت المسارات')) drawAdmin();
    };
  }
  const catRow = (k, i) => `<div class="catrow fg" style="grid-template-columns:60px 1fr 140px auto;align-items:end;margin-bottom:8px">
    <div class="f"><label>اللون</label><input type="color" name="color" value="${esc(k.color)}" style="height:44px;padding:4px"></div>
    <div class="f"><label>الاسم</label><input name="name" value="${esc(k.name)}"></div>
    <div class="f"><label>الرمز</label><input name="id" class="ltr" value="${esc(k.id)}" ${k._new ? '' : 'readonly'}></div>
    <button class="btn btn-sm" style="color:var(--red);background:none" data-rm="${i}">حذف</button></div>`;

  /* —— الاستيراد من Excel (CSV) —— */
  const COURSE_COLS = [
    ['id', 'الرمز الداخلي'], ['title', 'اسم الدورة'], ['cat', 'المسار'], ['status', 'الحالة'], ['code', 'رمز الشهادة'],
    ['start', 'تاريخ البداية'], ['end', 'تاريخ النهاية'], ['days', 'أيام الانعقاد'], ['time', 'التوقيت'], ['place', 'المكان'],
    ['instructor', 'المحاضر'], ['lang', 'اللغة'], ['audience', 'الفئة المستهدفة'], ['seats', 'المقاعد'], ['reserved', 'محجوز مسبقاً'],
    ['fee', 'الرسوم'], ['earlyFee', 'السعر المبكر'], ['earlyUntil', 'المبكر حتى'], ['regOpen', 'فتح التسجيل'], ['regClose', 'إغلاق التسجيل'],
    ['prereq', 'الرخصة المطلوبة'], ['requirements', 'المتطلبات'], ['desc', 'الوصف']
  ];
  const ST_AR = { published: 'منشورة', closed: 'مغلقة', draft: 'مسودة' };
  function courseToRow(c) {
    return COURSE_COLS.map(([k]) => {
      if (k === 'cat') return catOf2(c.cat).name;
      if (k === 'status') return ST_AR[c.status];
      if (k === 'days') return (c.days || []).map((d) => DAYS[d]).join('، ');
      if (k === 'prereq') return c.prereq;
      return c[k] ?? '';
    });
  }

  function admImport() {
    $('#adm').innerHTML = `<div class="card" style="max-width:860px">
      <h2>استيراد الدورات من Excel</h2>
      <ol class="muted" style="padding-inline-start:20px">
        <li>نزّل القالب، وافتحه في Excel وعبّئ سطراً لكل دورة.</li>
        <li>احفظه بصيغة <b>CSV UTF-8</b> (ملف ← حفظ باسم ← CSV UTF-8).</li>
        <li>ارفعه هنا، راجع المعاينة، ثم اضغط «استيراد».</li>
      </ol>
      <div class="alert alert-i">الدورة التي يطابق رمزها الداخلي دورة موجودة <b>تُحدَّث</b>، والجديدة <b>تُضاف</b>. التواريخ بصيغة 2027-01-31 أو 31/1/2027. الأيام بالعربي مفصولة بفواصل (الأحد، الثلاثاء) أو فارغة لكل الأيام. المسار باسمه أو رمزه، والحالة: منشورة / مغلقة / مسودة.</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0">
        <button class="btn btn-o btn-sm" id="tpl">تنزيل القالب</button>
        <label class="btn btn-p btn-sm">اختيار ملف CSV<input type="file" id="csvF" accept=".csv,text/csv" hidden></label>
      </div>
      <div id="impPrev"></div>
    </div>`;
    $('#tpl').onclick = () => downloadCsv('kfa-courses-template.csv', COURSE_COLS.map((x) => x[1]), [
      ['C-2705', 'رخصة التدريب الآسيوية C', A.cats[0]?.name || '', 'مسودة', 'AFC-C', '2027-05-02', '2027-05-16', 'الأحد، الاثنين، الثلاثاء، الأربعاء، الخميس', '4:00 – 8:00 م', 'مقر الاتحاد — العديلية', '', 'العربية', '', '30', '0', '150', '120', '2027-04-15', '', '', '', 'صورة البطاقة المدنية', 'وصف مختصر للدورة']
    ]);
    $('#csvF').onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      const text = await file.text();
      const { ok, bad } = parseCourses(text);
      $('#impPrev').innerHTML = `
        ${bad.length ? `<div class="alert alert-e">أسطر لم تُقرأ (${bad.length}): ${bad.slice(0, 8).map(esc).join(' · ')}</div>` : ''}
        ${ok.length ? `<div class="alert alert-s">جاهز: ${ok.length} دورة — ${ok.filter((c) => A.courses.some((x) => x.id === c.id)).length} تحديث، ${ok.filter((c) => !A.courses.some((x) => x.id === c.id)).length} جديدة</div>
        <div class="tbl-wrap"><table><thead><tr><th>الرمز</th><th>الدورة</th><th>المسار</th><th>الموعد</th><th>الرسوم</th><th>الحالة</th></tr></thead><tbody>
        ${ok.map((c) => `<tr><td class="ltr">${esc(c.id)}</td><td>${esc(c.title)}</td><td>${esc(catOf2(c.cat).name)}</td><td>${fmtShort(c.start)} – ${fmtShort(c.end)}</td><td>${money(c.fee)}</td><td>${ST_AR[c.status]}</td></tr>`).join('')}
        </tbody></table></div><div style="margin-top:12px"><button class="btn btn-g" id="doImp">استيراد ${ok.length} دورة</button></div>` : '<div class="alert alert-w">لا توجد أسطر صالحة.</div>'}`;
      if (ok.length) $('#doImp').onclick = async () => {
        ok.forEach((c) => { const i = A.courses.findIndex((x) => x.id === c.id); if (i >= 0) A.courses[i] = { ...A.courses[i], ...c }; else A.courses.push(c); });
        if (await persist(`استُوردت ${ok.length} دورة`)) { adminTab = 'courses'; drawAdmin(); }
      };
    };
  }

  function parseCsv(text) {
    text = text.replace(/^﻿/, '');
    const first = text.split(/\r?\n/)[0] || '';
    const d = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',';
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
      else if (ch === '"') q = true;
      else if (ch === d) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((c) => c.trim()));
  }
  function normDate(s) {
    s = String(s || '').trim().replace(/[٠-٩]/g, (x) => '٠١٢٣٤٥٦٧٨٩'.indexOf(x));
    if (!s) return '';
    let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/); if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/); if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return 'bad';
  }
  function parseCourses(text) {
    const rows = parseCsv(text);
    if (rows.length < 2) return { ok: [], bad: ['الملف فارغ'] };
    const head = rows[0].map((h) => h.trim());
    const idx = {};
    COURSE_COLS.forEach(([k, ar]) => { const i = head.findIndex((h) => h === ar || h.toLowerCase() === k.toLowerCase()); if (i >= 0) idx[k] = i; });
    if (idx.title == null || idx.start == null) return { ok: [], bad: ['لم يُعثر على عمودي «اسم الدورة» و«تاريخ البداية» — استخدم القالب'] };
    const ok = [], bad = [], seen = new Set();
    rows.slice(1).forEach((r, n) => {
      const g = (k) => (idx[k] != null ? String(r[idx[k]] ?? '').trim() : '');
      const line = `سطر ${n + 2}`;
      const o = {};
      COURSE_COLS.forEach(([k]) => { o[k] = g(k); });
      for (const k of ['start', 'end', 'earlyUntil', 'regOpen', 'regClose']) { o[k] = normDate(o[k]); if (o[k] === 'bad') return bad.push(`${line}: تاريخ غير مفهوم`); }
      if (!o.end) o.end = o.start;
      const cat = A.cats.find((k) => k.id === o.cat || k.name === o.cat);
      o.cat = cat ? cat.id : (A.cats[0]?.id || '');
      o.status = Object.keys(ST_AR).find((k) => ST_AR[k] === o.status || k === o.status) || 'draft';
      o.days = o.days ? o.days.split(/[،,؛;\s]+/).filter(Boolean).map((d) => (/^\d$/.test(d) ? Number(d) : DAYS.findIndex((x) => x === d || x === 'ال' + d))).filter((d) => d >= 0) : [];
      o.prereq = (R.LICENSES.find(([k, v]) => k === o.prereq || v === o.prereq) || [''])[0];
      ['seats', 'reserved', 'fee'].forEach((k) => { o[k] = Number(String(o[k]).replace(/[^\d.]/g, '')) || 0; });
      o.earlyFee = o.earlyFee === '' ? null : Number(String(o.earlyFee).replace(/[^\d.]/g, ''));
      if (!o.id) o.id = uniqueId(('C' + o.start.replace(/-/g, '').slice(2, 6)));
      if (seen.has(o.id)) return bad.push(`${line}: رمز مكرر ${o.id}`);
      const c = R.cleanCourse(o);
      if (!c) return bad.push(`${line}: ينقصه اسم الدورة أو تاريخ صحيح`);
      seen.add(c.id); ok.push(c);
    });
    return { ok, bad };
  }

  /* —— التسجيلات —— */
  function admRegs() {
    const rows = A.regs;
    $('#adm').innerHTML = `<div style="margin-bottom:12px"><button class="btn btn-o btn-sm" id="csv">تصدير التسجيلات (Excel)</button></div>` + (rows.length ? `<div class="tbl-wrap"><table><thead><tr><th>رقم الطلب</th><th>الاسم</th><th>الرقم المدني</th><th>الهاتف</th><th>الدورة</th><th>الرخصة</th><th>المبلغ</th><th>الحالة</th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td class="ltr">${esc(r.ref)}</td><td>${esc(r.name)}</td><td class="ltr">${esc(r.civil)}</td><td class="ltr">${esc(r.phone)}</td><td>${esc(r.courseTitle)}</td><td>${esc(licName(r.lic))}</td><td>${money(r.fee)}${r.payment?.demo ? ' <small class="muted">(تجريبي)</small>' : ''}</td>
        <td><select data-ref="${esc(r.ref)}" class="stSel">${Object.entries(STATUS).map(([k, [t]]) => `<option value="${k}" ${k === r.status ? 'selected' : ''}>${t}</option>`).join('')}</select></td></tr>`).join('')}
      </tbody></table></div>` : '<p class="empty">لا توجد تسجيلات بعد</p>');
    $('#csv').onclick = () => downloadCsv(`kfa-registrations-${today()}.csv`,
      ['رقم الطلب', 'الاسم', 'الرقم المدني', 'تاريخ الميلاد', 'الجنسية', 'الهاتف', 'البريد', 'النادي', 'الصفة', 'الرخصة', 'رقم الرخصة', 'الدورة', 'المبلغ', 'الحالة', 'مرجع الدفع', 'تاريخ التسجيل'],
      A.regs.map((r) => [r.ref, r.name, r.civil, r.dob, r.nat, r.phone, r.email, r.club, r.role, licName(r.lic), r.licno, r.courseTitle, r.fee, STATUS[r.status][0], r.payment?.reference || r.payment?.paymentId, r.createdAt]));
    $$('.stSel').forEach((s) => s.onchange = async () => {
      try { await store.setStatus(s.dataset.ref, s.value); A.regs.find((r) => r.ref === s.dataset.ref).status = s.value; await refresh(); toast('تم تحديث الحالة'); }
      catch (e) { toast('تعذّر التحديث: ' + e.message); }
    });
  }

  function downloadCsv(name, head, rows) {
    const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const blob = new Blob(['﻿' + [head, ...rows].map((r) => r.map(q).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function vNotFound(msg) {
    view.innerHTML = pageHead('غير موجود', '') + `<section class="sec"><div class="wrap"><div class="card empty"><p>${esc(msg || 'الصفحة المطلوبة غير موجودة')}</p><a class="btn btn-p" href="#home">الرئيسية</a></div></div></section>`;
  }

  /* =======================================================================
     التوجيه والإقلاع
     ======================================================================= */
  function route() {
    const qs = new URLSearchParams(location.search);
    const [path] = (location.hash.slice(1) || 'home').split('?');
    const [name, arg] = path.split('/').map(decodeURIComponent);
    $$('.nav a').forEach((a) => a.classList.toggle('on', a.dataset.r === name || (name === 'course' && a.dataset.r === 'calendar') || ((name === 'pay' || name === 'receipt') && a.dataset.r === 'status')));
    $('#nav').classList.remove('open'); $('#menuBtn').setAttribute('aria-expanded', 'false');
    window.scrollTo({ top: 0 });
    if (qs.get('ref') && (qs.get('paymentId') || qs.get('PaymentId'))) {
      history.replaceState(null, '', location.pathname + '#paid');
      return vPaidReturn(qs);
    }
    switch (name) {
      case 'home': return vHome();
      case 'faq': vHome(); return setTimeout(() => $('#faq')?.scrollIntoView(), 30);
      case 'calendar': return vCalendar();
      case 'course': return vCourse(arg);
      case 'register': return vRegister(arg);
      case 'pay': return vPay(arg);
      case 'receipt': return vReceipt(arg);
      case 'status': return vStatus();
      case 'admin': return vAdmin();
      case 'paid': return vNotFound('انتهت عملية الدفع — تابع طلبك من «طلباتي والدفع»');
      default: return vNotFound();
    }
  }

  async function boot() {
    $('#menuBtn').onclick = () => { const n = $('#nav'); n.classList.toggle('open'); $('#menuBtn').setAttribute('aria-expanded', n.classList.contains('open')); };
    $('#yr').textContent = new Date().getFullYear();
    loading();
    try { const c = await api('catalog'); mode = 'remote'; cats = c.cats; courses = c.courses; }
    catch { mode = 'local'; await refresh(); }
    if (mode === 'local') document.body.insertAdjacentHTML('afterbegin', '<div class="demo-banner">نسخة تجريبية — البيانات تُحفظ على هذا الجهاز فقط</div>');
    window.addEventListener('hashchange', route);
    route();
  }
  boot();
})();
