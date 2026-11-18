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
  const next = s => { const y = yr(s) + 1; return `${y}/${String(y + 1).slice(2)}`; };

  /* البحث: النادي + الاسم، ثم اسم فريد في نادٍ آخر (انتقال) — مثل المواليد */
  function rowsOf(name, club) {
    const P = DB().p;
    if (P[club] && P[club][name]) return P[club][name].r;
    const hits = Object.keys(P).filter(c => P[c][name]);
    return hits.length === 1 ? P[hits[0]][name].r : null;
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
      else if (i === 0) x.kind = "start";
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
    return { clubs, seasons, since: yr(real[0].from), loans: st.filter(x => x.loan).length, abroad: new Set(st.filter(x => (DB().clubs[x.club] || {}).cc && DB().clubs[x.club].cc !== "kw").map(x => x.club)).size };
  }

  /* ───── العرض ───── */
  const KIND = { start: "بداية المسيرة", move: "انتقال", free: "انتقال حر", swap: "تبادل لاعبين", loan: "إعارة", back: "عودة من الإعارة", return: "عودة", site: "انتقال" };
  function clubMark(key) {
    const c = DB().clubs[key] || { n: key, cc: "kw", kw: true };
    if ((c.kw || !c.cc) && typeof crest === "function" && (window.LOGOS || {})[c.n]) return crest(c.n);
    if (c.kw && typeof crest === "function") return crest(c.n);
    return `<div class="cr-flag">${c.cc ? `<img src="https://flagcdn.com/w80/${c.cc}.png" alt="" decoding="async">` : `<b>${H((c.en || c.n).slice(0, 2))}</b>`}</div>`;
  }
  const years = x => {
    if (!x.from) return `<b>الآن</b>`;
    const a = yr(x.from), b = yr(x.to) + 1;
    return x.current ? `<b>${a}</b><i>–</i><b>الآن</b>` : (a + 1 === b && x.n <= 1 ? `<b>${x.from.slice(0, 4)}/${x.from.slice(5)}</b>` : `<b>${a}</b><i>–</i><b>${b}</b>`);
  };
  function stageHTML(x, i) {
    const c = DB().clubs[x.club] || { n: x.club, cc: "kw" }, cname = DB().cn[c.cc] || "";
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
        <div><small>نوع الانتقال</small><b>${H(KIND[x.kind] || "")}</b></div>
      </div>
    </li>`;
  }
  function html(name, club) {
    const rows = rowsOf(name, club);
    if (!rows || !rows.length) return `<div class="cr-empty"><p>لم تُضف مسيرة هذا اللاعب بعد.</p></div>`;
    const st = build(rows, club), S = summary(st);
    const sum = S ? `<div class="cr-sum">
        <div><b>${S.clubs}</b><small>${S.clubs === 1 ? "نادٍ" : S.clubs === 2 ? "ناديان" : "أندية"}</small></div>
        <div><b>${S.seasons}</b><small>${S.seasons === 1 ? "موسم" : S.seasons === 2 ? "موسمان" : S.seasons <= 10 ? "مواسم" : "موسماً"} · منذ ${S.since}</small></div>
        ${S.loans ? `<div><b>${S.loans}</b><small>${S.loans === 1 ? "إعارة" : S.loans === 2 ? "إعارتان" : "إعارات"}</small></div>` : ""}
        ${S.abroad ? `<div><b>${S.abroad}</b><small>${S.abroad === 1 ? "نادٍ خارجي" : "أندية خارجية"}</small></div>` : ""}
      </div>` : "";
    return `${sum}<ol class="cr-tl">${st.slice().reverse().map((x, k) => stageHTML(x, st.length - 1 - k)).join("")}</ol>`;
  }

  window.CAREER = { rowsOf, build, summary, html };

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
        return h.slice(0, end) + tabs + `<div class="pp-pane" data-pane="stats"${TAB === "stats" ? "" : " hidden"}>` + h.slice(end, close) + `</div><div class="pp-pane cr" data-pane="career"${TAB === "career" ? "" : " hidden"}>${html(D.name, D.club)}</div>` + h.slice(close);
      } catch (e) { return h; }
    };
  }
  document.addEventListener("click", e => {
    const t = e.target.closest && e.target.closest("[data-pptab]");
    if (t) {
      TAB = t.dataset.pptab;
      const sh = t.closest(".pprof-sheet"); if (!sh) return;
      sh.querySelectorAll("[data-pptab]").forEach(b => b.setAttribute("aria-selected", String(b === t)));
      sh.querySelectorAll(".pp-pane").forEach(p => { p.hidden = p.dataset.pane !== TAB; });
      return;
    }
    const c = e.target.closest && e.target.closest(".cr-card");
    if (c) { const li = c.parentElement, more = li.querySelector(".cr-more"), open = more.hidden; more.hidden = !open; c.setAttribute("aria-expanded", String(open)); li.classList.toggle("open", open); }
  });
  /* إغلاق الملف يرجّع التبويب للإحصائيات في المرة القادمة */
  if (typeof closePlayer === "function") { const _cp = closePlayer; window.closePlayer = closePlayer = function () { TAB = "stats"; return _cp.apply(this, arguments); }; }
})();
