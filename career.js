/* =========================================================
   مسيرة اللاعب «المسيرة» — تبويب داخل ملف اللاعب (منصور 2026-11-18)
   المصدر: player-career.js (صفوف خام لكل موسم من شاشة «المسيرة» في FM27).
   هذا الملف يلفّ playerProfileHTML مثل fmx.js: لا يغيّر أي شيء موجود، فقط يضيف
   شريط «الإحصائيات | المسيرة» ويضع المحتوى القديم كما هو داخل تبويب «الإحصائيات».
   المنطق (CAREER.build) منفصل عن العرض (CAREER.html).
   ========================================================= */
(function () {
  "use strict";
  const H = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const DB = () => window.PLAYER_CAREER || { clubs: {}, cn: {}, p: {} };
  const CUR_SEASON = "2026/27";
  const yr = s => parseInt(String(s).slice(0, 4), 10);
  const next = s => { const y = yr(s) + 1; return String(s).includes("/") ? `${y}/${String(y + 1).slice(2)}` : String(y); };   /* مواسم السنة الميلادية (البرازيل…) تُكتب «2023» */

  /* ───── تعديلات المدير (منصور 2026-11-19: «اقدر اعدل على مسيرة اللاعب من الادمن») ─────
     تُحفظ في وثيقة الموسم: careers = { النادي: { الاسم: { st:[{f,t,c,cc,k}], by, at } } }
     f/t = أول وآخر موسم («2021/22» أو «2021»)، c = اسم النادي كما يظهر، cc = رمز الدولة (kw…)، k = ""|free|fee|loan|swap.
     التعديل يحلّ محلّ مسيرة FM للاعب بالكامل؛ حذفه يرجّع مسيرة FM. */
  const EDITS = () => (typeof CAREERS !== "undefined" && CAREERS) || {};
  const CUSTOM = {};   /* أندية مكتوبة يدوياً وليست في player-career.js */
  const clubOf = key => DB().clubs[key] || CUSTOM[key] || { n: key, cc: "kw", kw: true };
  const SEASON_RE = /^(\d{4})(?:\/(\d{2}))?$/;
  const seasonsOf = (f, t) => {
    const a = String(f).match(SEASON_RE), b = String(t || f).match(SEASON_RE); if (!a || !b) return [];
    const out = []; for (let y = +a[1]; y <= +b[1]; y++) out.push(a[2] !== undefined ? `${y}/${String(y + 1).slice(2)}` : String(y));
    return out;
  };
  function keyFor(name, cc) {
    const C = DB().clubs, nm = String(name).trim();
    const hit = Object.keys(C).find(k => (C[k].n === nm || C[k].en === nm || k === nm) && (!cc || (C[k].cc || "") === cc || (cc === "kw" && C[k].kw)));
    if (hit) return hit;
    const k = `~${nm}|${cc || ""}`;
    CUSTOM[k] = { n: nm, en: nm, cc: cc || "", kw: cc === "kw" };
    return k;
  }
  function rowsFromStages(st) {
    const rows = [];
    for (const x of st || []) {
      const key = keyFor(x.c, x.cc), ss = seasonsOf(x.f, x.t);
      ss.forEach((s, i) => rows.push([s, key, x.k === "loan" || x.k === "swap" ? x.k : (i === 0 ? (x.k || "") : "")]));
    }
    return rows;
  }
  function editOf(name, club) {
    const E = EDITS();
    return (E[club] && E[club][name]) || (h => h.length === 1 ? E[h[0]][name] : null)(Object.keys(E).filter(c => E[c] && E[c][name]));
  }

  /* البحث: النادي + الاسم، ثم اسم فريد في نادٍ آخر (انتقال) — مثل المواليد */
  function rowsOf(name, club) {
    const ed = editOf(name, club);
    if (ed && Array.isArray(ed.st)) { const r = rowsFromStages(ed.st); r.edited = true; return r; }
    const P = DB().p;
    const rec = (P[club] && P[club][name]) || (h => h.length === 1 ? P[h[0]][name] : null)(Object.keys(P).filter(c => P[c][name]));
    if (!rec) return null;
    const r = rec.r.slice(); r.partial = !!rec.t;   /* t:1 = المواسم الأقدم لم تُقرأ كاملة من FM */
    return r;
  }

  /* ───── المنطق: صفوف المواسم → مراحل ─────
     • نفس النادي ومواسم متتالية = مرحلة واحدة
     • الإعارة مرحلة منفصلة دائماً (لا تُدمج مع النادي الأصلي)
     • العودة من إعارة أو بعد غياب = مرحلة جديدة («عودة»)
     • انتقالان في الموسم نفسه = مرحلتان */
  function build(rows, currentClub) {
    const st = [];
    for (const [s, club, t] of rows || []) {
      const loan = t === "loan", last = st[st.length - 1];
      if (last && last.club === club && last.loan === loan && (last.to === s || next(last.to) === s)) { last.to = s; last.n = new Set([...last.seasons, s]).size; last.seasons.push(s); continue; }
      st.push({ club, from: s, to: s, loan, how: t, seasons: [s], n: 1 });
    }
    st.forEach((x, i) => {
      x.n = new Set(x.seasons).size;
      const before = st.slice(0, i);
      if (x.loan) x.kind = "loan";
      else if (i === 0) x.kind = rows && rows.partial ? "" : "start";
      else if (before.some(b => !b.loan && b.club === x.club)) x.kind = before[before.length - 1].loan && before[before.length - 1].club !== x.club ? "back" : "return";
      else x.kind = x.how === "free" ? "free" : x.how === "swap" ? "swap" : "move";
    });
    /* النادي الحالي من الموقع: إن انتقل بعد تاريخ بيانات FM تُضاف مرحلته ولا نخترع تاريخاً لها */
    const last = st[st.length - 1];
    if (currentClub && last && last.club !== currentClub) st.push({ club: currentClub, from: null, to: CUR_SEASON, loan: false, kind: "site", seasons: [], n: 0 });
    const L = st[st.length - 1];
    if (L && (L.to === CUR_SEASON || L.kind === "site")) L.current = true;
    return st;
  }

  function summary(st) {
    const real = st.filter(x => x.from);
    if (!real.length) return null;
    const clubs = new Set(st.map(x => x.club)).size;
    const seasons = new Set(st.flatMap(x => x.seasons)).size;
    return { clubs, seasons, since: yr(real[0].from), loans: st.filter(x => x.loan).length, abroad: new Set(st.filter(x => clubOf(x.club).cc && clubOf(x.club).cc !== "kw").map(x => x.club)).size };
  }

  /* ───── العرض ───── */
  const KIND = { start: "بداية المسيرة", move: "انتقال", free: "انتقال حر", swap: "تبادل لاعبين", loan: "إعارة", back: "عودة من الإعارة", return: "عودة", site: "انتقال" };
  /* بلا decoding="async": في سفاري iOS تُرسم الشعارات متأخرة أو نصف مرسومة داخل اللوحة المخفية ثم الظاهرة (منصور 11-19) */
  const SYNC = s => s.replace(/ decoding="async"/g, ' decoding="sync"');
  function clubMark(key) {
    const c = clubOf(key);
    if ((c.kw || !c.cc) && typeof crest === "function" && (window.LOGOS || {})[c.n]) return SYNC(crest(c.n));
    if (c.kw && typeof crest === "function") return SYNC(crest(c.n));
    return `<div class="cr-flag">${c.cc ? `<img src="https://flagcdn.com/w80/${c.cc}.png" alt="" decoding="sync">` : `<b>${H((c.en || c.n).slice(0, 2))}</b>`}</div>`;
  }
  const years = x => {
    if (!x.from) return `<b>الآن</b>`;
    if (!String(x.from).includes("/")) { const a = yr(x.from), b = yr(x.to); return x.current ? `<b>${a}</b><i>–</i><b>الآن</b>` : a === b ? `<b>${a}</b>` : `<b>${a}</b><i>–</i><b>${b}</b>`; }
    const a = yr(x.from), b = yr(x.to) + 1;
    return x.current ? `<b>${a}</b><i>–</i><b>الآن</b>` : (a + 1 === b && x.n <= 1 ? `<b>${x.from.slice(0, 4)}/${x.from.slice(5)}</b>` : `<b>${a}</b><i>–</i><b>${b}</b>`);
  };
  function stageHTML(x, i) {
    const c = clubOf(x.club), cname = DB().cn[c.cc] || (c.cc === "kw" ? "الكويت" : "");
    const period = x.from ? (x.from === x.to ? `موسم ${x.from}` : `${x.from} – ${x.to}`) : "منذ هذا الموسم";
    return `<li class="cr-st${x.current ? " cur" : ""}${x.loan ? " loan" : ""}" data-cr-i="${i}">
      <span class="cr-dot" aria-hidden="true"></span>
      <button type="button" class="cr-card" aria-expanded="false">
        <span class="cr-yr">${years(x)}</span>
        <span class="cr-club">${clubMark(x.club)}<span class="cr-nm"><b>${H(c.n)}</b><small>${H(cname)}${c.en && c.en !== c.n && !c.kw ? ` · <span dir="ltr">${H(c.en)}</span>` : ""}</small></span></span>
        <span class="cr-tags">${x.current ? `<em class="cr-tag now">النادي الحالي</em>` : ""}${x.loan ? `<em class="cr-tag ln">إعارة</em>` : x.kind === "back" ? `<em class="cr-tag bk">عودة من الإعارة</em>` : ""}</span>
      </button>
      <div class="cr-more" hidden>
        <div><small>الفترة</small><b dir="ltr">${H(period)}</b></div>
        ${x.n ? `<div><small>المواسم</small><b>${x.n}</b></div>` : ""}
        ${KIND[x.kind] ? `<div><small>نوع الانتقال</small><b>${H(KIND[x.kind])}</b></div>` : ""}
      </div>
    </li>`;
  }
  /* ───── محرّر المدير ───── */
  const canEdit = () => typeof isAdmin !== "undefined" && isAdmin && !(typeof MYPERM !== "undefined" && MYPERM === "matches");
  const KOPT = [["", "انتقال"], ["free", "انتقال حر"], ["loan", "إعارة"], ["swap", "تبادل"], ["fee", "بمقابل"]];
  function stagesForEdit(name, club) {
    const ed = editOf(name, club);
    if (ed && Array.isArray(ed.st)) return ed.st.map(x => Object.assign({}, x));
    return build(rowsOf(name, club) || [], null).map(x => { const c = clubOf(x.club);
      return { f: x.from, t: x.to, c: c.n, cc: c.cc || (c.kw ? "kw" : ""), k: x.loan ? "loan" : (x.how && x.how !== "loan" ? x.how : "") }; });
  }
  function edRowHTML(x) {
    const cn = DB().cn, codes = Object.keys(cn).filter(Boolean).sort((a, b) => (a === "kw" ? -1 : b === "kw" ? 1 : String(cn[a]).localeCompare(cn[b], "ar")));
    return `<div class="cred-row">
      <input class="cred-f" dir="ltr" inputmode="numeric" maxlength="7" placeholder="2021/22" value="${H(x.f || "")}" aria-label="من موسم">
      <input class="cred-t" dir="ltr" inputmode="numeric" maxlength="7" placeholder="2023/24" value="${H(x.t || "")}" aria-label="إلى موسم">
      <input class="cred-c" list="crClubs" placeholder="النادي" value="${H(x.c || "")}" aria-label="النادي">
      <select class="cred-cc" aria-label="الدولة"><option value="">بلا دولة</option>${codes.map(k => `<option value="${k}"${k === (x.cc || "") ? " selected" : ""}>${H(cn[k])}</option>`).join("")}</select>
      <select class="cred-k" aria-label="النوع">${KOPT.map(([v, l]) => `<option value="${v}"${v === (x.k || "") ? " selected" : ""}>${l}</option>`).join("")}</select>
      <button type="button" class="cred-x" data-crdel aria-label="حذف المرحلة">✕</button>
    </div>`;
  }
  function editorHTML(name, club) {
    const st = stagesForEdit(name, club).slice().reverse();   /* الأحدث أعلى مثل الخط الزمني */
    const names = [...new Set(Object.values(DB().clubs).map(c => c.n))].sort((a, b) => a.localeCompare(b, "ar"));
    return `<div class="cred">
      <p class="cred-hint">مرحلة لكل سطر: من موسم، إلى موسم (مثل 2021/22 أو 2021 للدوريات بالسنة الميلادية)، النادي، الدولة، ونوع الانتقال. الأحدث في الأعلى.</p>
      <div class="cred-head" aria-hidden="true"><span>من</span><span>إلى</span><span>النادي</span><span>الدولة</span><span>النوع</span><span></span></div>
      <div class="cred-rows">${(st.length ? st : [{ f: CUR_SEASON, t: CUR_SEASON, c: club, cc: "kw" }]).map(edRowHTML).join("")}</div>
      <datalist id="crClubs">${names.map(n => `<option value="${H(n)}">`).join("")}</datalist>
      <div class="cred-act">
        <button type="button" class="cred-btn ghost" data-cradd>إضافة مرحلة</button>
        <span style="flex:1"></span>
        ${editOf(name, club) ? `<button type="button" class="cred-btn ghost" data-crreset>إرجاع مسيرة FM</button>` : ""}
        <button type="button" class="cred-btn ghost" data-crcancel>إلغاء</button>
        <button type="button" class="cred-btn" data-crsave>حفظ</button>
      </div>
    </div>`;
  }
  function readEditor(pane) {
    const st = [], err = [];
    [...pane.querySelectorAll(".cred-row")].forEach((r, i) => {
      const v = s => r.querySelector(s).value.trim();
      const f = v(".cred-f"), t = v(".cred-t") || f, c = v(".cred-c").replace(/\s+/g, " ");
      if (!f && !c) return;
      const a = f.match(SEASON_RE), b = t.match(SEASON_RE);
      const okS = m => m && (m[2] === undefined || m[2] === String(+m[1] + 1).slice(2));
      if (!okS(a) || !okS(b) || (!!a[2]) !== (!!b[2]) || +b[1] < +a[1]) { err.push(`السطر ${i + 1}: الموسم غير صحيح`); return; }
      if (!c) { err.push(`السطر ${i + 1}: اكتب اسم النادي`); return; }
      st.push({ f, t, c, cc: v(".cred-cc"), k: v(".cred-k") });
    });
    st.reverse();   /* المحرّر يعرض الأحدث أولاً؛ المخزَّن بالترتيب الزمني */
    return { st, err };
  }
  const say = (m, k) => typeof toast === "function" ? toast(m, k) : console.log(m);
  async function saveEdit(pane, name, club, rec) {
    if (typeof CAREERS === "undefined" || typeof persistData !== "function") { say("الحفظ غير متاح هنا", "err"); return; }
    const apply = () => { if (rec) { (CAREERS[club] = CAREERS[club] || {})[name] = rec; } else if (CAREERS[club]) { delete CAREERS[club][name]; if (!Object.keys(CAREERS[club]).length) delete CAREERS[club]; } };
    apply();
    try { if (typeof rebaseOnCloud === "function") await rebaseOnCloud(() => apply); } catch (e) {}
    apply();
    const r = await persistData({ noBackup: true });
    say(r === true ? "حُفظت المسيرة" : r === false ? "حُفظت على الجهاز فقط — تحقّق من الاتصال" : "الاتصال بطيء — سيكتمل الحفظ تلقائياً", r === true ? "ok" : "err");
    pane.innerHTML = html(name, club);
  }

  function html(name, club) {
    const edBtn = canEdit() ? `<button type="button" class="cred-open" data-cred>تعديل المسيرة</button>` : "";
    const rows = rowsOf(name, club);
    if (!rows || !rows.length) return `<div class="cr-empty"><p>لم تُضف مسيرة هذا اللاعب بعد.</p></div>${edBtn}`;
    const st = build(rows, club), S = rows.partial ? null : summary(st);   /* مسيرة غير مكتملة القراءة: لا ملخّص ولا «بداية المسيرة» */
    const sum = S ? `<div class="cr-sum">
        <div><b>${S.clubs}</b><small>${S.clubs === 1 ? "نادٍ" : S.clubs === 2 ? "ناديان" : "أندية"}</small></div>
        <div><b>${S.seasons}</b><small>${S.seasons === 1 ? "موسم" : S.seasons === 2 ? "موسمان" : S.seasons <= 10 ? "مواسم" : "موسماً"} · منذ ${S.since}</small></div>
        ${S.loans ? `<div><b>${S.loans}</b><small>${S.loans === 1 ? "إعارة" : S.loans === 2 ? "إعارتان" : "إعارات"}</small></div>` : ""}
        ${S.abroad ? `<div><b>${S.abroad}</b><small>${S.abroad === 1 ? "نادٍ خارجي" : "أندية خارجية"}</small></div>` : ""}
      </div>` : "";
    return `${sum}<ol class="cr-tl">${st.slice().reverse().map((x, k) => stageHTML(x, st.length - 1 - k)).join("")}</ol>${edBtn}`;
  }

  window.CAREER = { rowsOf, build, summary, html, editorHTML, readEditor };

  /* ───── التبويب داخل ملف اللاعب ───── */
  let TAB = "stats";
  if (typeof playerProfileHTML === "function") {
    const _pph = playerProfileHTML;
    window.playerProfileHTML = playerProfileHTML = function (D) {
      const h = _pph.apply(this, arguments);
      try {
        if (!D || !D.name) return h;
        const hero = h.indexOf('<div class="pprof-hero">'); if (hero < 0) return h;
        const end = h.indexOf('<div class="segbar compbar pprof-cbar"'); if (end < 0) return h;
        const close = h.lastIndexOf("</div>");
        const tabs = `<div class="pp-tabs" role="tablist"><button type="button" role="tab" data-pptab="stats" aria-selected="${TAB === "stats"}">الإحصائيات</button><button type="button" role="tab" data-pptab="career" aria-selected="${TAB === "career"}">المسيرة</button></div>`;
        return h.slice(0, end) + tabs + `<div class="pp-pane" data-pane="stats"${TAB === "stats" ? "" : " hidden"}>` + h.slice(end, close) + `</div><div class="pp-pane cr" data-pane="career" data-n="${H(D.name)}" data-c="${H(D.club || "")}"${TAB === "career" ? "" : " hidden"}>${html(D.name, D.club)}</div>` + h.slice(close);
      } catch (e) { return h; }
    };
  }
  document.addEventListener("click", e => {
    const ed = e.target.closest && e.target.closest("[data-cred],[data-cradd],[data-crdel],[data-crsave],[data-crcancel],[data-crreset]");
    if (ed) {
      const pane = ed.closest(".pp-pane.cr"); if (!pane) return;
      const name = pane.dataset.n, club = pane.dataset.c;
      if (ed.hasAttribute("data-cred")) { if (canEdit()) pane.innerHTML = editorHTML(name, club); return; }
      if (ed.hasAttribute("data-cradd")) { pane.querySelector(".cred-rows").insertAdjacentHTML("afterbegin", edRowHTML({ f: CUR_SEASON, t: CUR_SEASON, cc: "kw" })); return; }
      if (ed.hasAttribute("data-crdel")) { ed.closest(".cred-row").remove(); return; }
      if (ed.hasAttribute("data-crcancel")) { pane.innerHTML = html(name, club); return; }
      if (!canEdit()) return;
      if (ed.hasAttribute("data-crreset")) { if (confirm("حذف التعديل وإرجاع مسيرة FM لهذا اللاعب؟")) saveEdit(pane, name, club, null); return; }
      const { st, err } = readEditor(pane);
      if (err.length) { say(err[0], "err"); return; }
      ed.disabled = true;
      saveEdit(pane, name, club, { st, by: (typeof FBUSER !== "undefined" && FBUSER && FBUSER.email) || "", at: new Date().toISOString() });
      return;
    }
    const t = e.target.closest && e.target.closest("[data-pptab]");
    if (t) {
      TAB = t.dataset.pptab;
      const sh = t.closest(".pprof-sheet"); if (!sh) return;
      sh.querySelectorAll("[data-pptab]").forEach(b => b.setAttribute("aria-selected", String(b === t)));
      sh.querySelectorAll(".pp-pane").forEach(p => { p.hidden = p.dataset.pane !== TAB; });
      if (TAB === "career") sh.querySelectorAll(".pp-pane.cr img").forEach(i => { try { i.decode && i.decode().catch(() => {}); } catch (e) {} });
      return;
    }
    const c = e.target.closest && e.target.closest(".cr-card");
    if (c) { const li = c.parentElement, more = li.querySelector(".cr-more"), open = more.hidden; more.hidden = !open; c.setAttribute("aria-expanded", String(open)); li.classList.toggle("open", open); }
  });
  /* إغلاق الملف يرجّع التبويب للإحصائيات في المرة القادمة */
  if (typeof closePlayer === "function") { const _cp = closePlayer; window.closePlayer = closePlayer = function () { TAB = "stats"; return _cp.apply(this, arguments); }; }
})();
