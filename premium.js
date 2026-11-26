/* =========================================================
   MF SOCCER Premium — إضافات الإحساس (منصور 2026-11-26: «سوّهم وورني كل إضافة»)
   1) بطاقة نتيجة مباشرة مثبّتة أعلى التطبيق أثناء أي مباراة جارية (تُفتح بالضغط)
   2) حركة على النتيجة عند تسجيل هدف (في كل مكان تظهر فيه نتيجة تلك المباراة)
   3) السحب للأسفل لتحديث «المباريات»
   للعرض فقط: نفس البيانات ونفس الدوال (isLive, matchKey, freshenSeason) — لا يكتب شيئاً.
   ========================================================= */
(function(){
  'use strict';
  const D = document;
  const safe = f => { try{ return f(); }catch(e){ return undefined; } };
  const H = s => (typeof esc === "function" ? esc(s) : String(s == null ? "" : s));
  const reduce = () => safe(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  const curView = () => { const b = D.querySelector('nav.tabs button[aria-selected="true"]'); return b ? b.dataset.v : ""; };

  /* ---------------- 1) بطاقة النتيجة المباشرة ---------------- */
  let card = null, lastHTML = "";
  function liveMatches(){
    const L = safe(() => (typeof MATCHES !== "undefined" ? MATCHES : []).filter(m => m && isLive(m))) || [];
    return L.sort((a, b) => (safe(() => kickoffTS(a)) || 0) - (safe(() => kickoffTS(b)) || 0));
  }
  function crestImg(c){
    const h = safe(() => crest(c)) || "";
    const m = /src="([^"]+)"/.exec(h); return m ? `<img src="${m[1]}" alt="" width="22" height="22" decoding="async">` : `<i class="pm-lc-x">${H(String(c).slice(0, 2))}</i>`;
  }
  function paintLive(){
    if(!card){ card = D.createElement("button"); card.type = "button"; card.className = "pm-live"; card.hidden = true; D.body.appendChild(card);
      card.addEventListener("click", () => { const k = card.dataset.k; if(k){ location.hash = "#m/" + k; } }); }
    const onMatch = !!D.querySelector("#mpage.on");
    const L = liveMatches();
    paintStrip(L);
    const stripShown = !!D.querySelector(".view.on .pm-ls");
    if(!L.length || onMatch || stripShown){ card.hidden = true; card.classList.remove("on"); lastHTML = ""; return; }
    const m = L[0], k = safe(() => matchKey(m)) || "";
    const clk = safe(() => mclkHTML(m)) || (m.status === "ht" ? "بين الشوطين" : "مباشر");
    const html = `<span class="pm-lc-dot" aria-hidden="true"></span>
      <span class="pm-lc-t h">${crestImg(m.home)}<b>${H(m.home)}</b></span>
      <span class="pm-lc-sc" data-pm-sc="${H(k)}" dir="ltr"><b>${+m.hg || 0}</b><i>-</i><b>${+m.ag || 0}</b></span>
      <span class="pm-lc-t a"><b>${H(m.away)}</b>${crestImg(m.away)}</span>
      <span class="pm-lc-clk">${clk}${L.length > 1 ? ` · +${L.length - 1}` : ""}</span>`;
    card.dataset.k = k;
    card.setAttribute("aria-label", `مباشر: ${m.home} ${+m.hg||0} - ${+m.ag||0} ${m.away}`);
    if(html !== lastHTML){ card.innerHTML = html; lastHTML = html; }
    if(card.hidden){ card.hidden = false; requestAnimationFrame(() => card.classList.add("on")); }
  }

  /* 1ب) «مباشر الآن» داخل الصفحة: أعلى «المباريات» وفوق «الترتيب» (منصور 2026-11-26)
     كل مباراة جارية سطر مستقل؛ عند وجودها تختفي الكبسولة العائمة في تلك الصفحة */
  let stripHTML = "";
  function stripRow(m){
    const k = safe(() => matchKey(m)) || "";
    const clk = safe(() => mclkHTML(m)) || (m.status === "ht" ? "بين الشوطين" : "مباشر");
    return `<button type="button" class="pm-ls-r" data-pm-k="${H(k)}" aria-label="مباشر: ${H(m.home)} ${+m.hg||0} - ${+m.ag||0} ${H(m.away)}">
      <span class="pm-ls-t h">${crestImg(m.home)}<b>${H(m.home)}</b></span>
      <span class="pm-ls-m"><span class="pm-ls-sc" data-pm-sc="${H(k)}" dir="ltr"><b>${+m.hg||0}</b><i>-</i><b>${+m.ag||0}</b></span><span class="pm-ls-clk">${clk}</span></span>
      <span class="pm-ls-t a"><b>${H(m.away)}</b>${crestImg(m.away)}</span></button>`;
  }
  function paintStrip(L){
    const html = L.length ? `<div class="pm-ls-h"><span class="pm-lc-dot" aria-hidden="true"></span><b>مباشر الآن</b>${L.length > 1 ? `<small>${L.length} مباريات</small>` : ""}</div>${L.map(stripRow).join("")}` : "";
    const spots = [];
    const mh = D.querySelector("#v-matches > .mx-head"); if(mh) spots.push(["m", mh]);
    const st = D.querySelector("#v-home #mfStd"); if(st) spots.push(["s", st]);
    spots.forEach(([id, anchor]) => {
      let box = anchor.parentNode.querySelector(`:scope > .pm-ls[data-at="${id}"]`);
      if(!html){ if(box) box.remove(); return; }
      if(!box){ box = D.createElement("section"); box.className = "pm-ls"; box.dataset.at = id; box.setAttribute("aria-label", "مباشر الآن");
        box.addEventListener("click", e => { const r = e.target.closest(".pm-ls-r"); if(r && r.dataset.pmK) location.hash = "#m/" + r.dataset.pmK; }); }
      if(id === "m"){ if(anchor.nextElementSibling !== box) anchor.after(box); }
      else if(anchor.previousElementSibling !== box) anchor.before(box);
      if(box.dataset.h !== html){ box.innerHTML = html; box.dataset.h = html; }
    });
    stripHTML = html;
  }

  /* ---------------- 2) حركة الهدف ---------------- */
  /* كل نتيجة معروضة تُعرّف بمباراتها؛ إن تغيّر نصها بعد أن عُرضت مرة = هدف جديد → حركة */
  const SEEN = new Map();
  function scoreNodes(){
    const out = [];
    D.querySelectorAll("[data-mopen]").forEach(r => { const s = r.querySelector(".mxd-sc, .mc-score, .mc-sc, .hm-td-sc, .mf-rc-sc, .sc"); if(s) out.push([r.getAttribute("data-mopen"), s]); });
    D.querySelectorAll("[data-pm-sc]").forEach(s => out.push([s.getAttribute("data-pm-sc"), s]));
    const mp = D.querySelector("#mpage.on .mp-res"), sh = D.querySelector("#mpage.on [data-share-match]");
    if(mp && sh) out.push([sh.getAttribute("data-share-match"), mp]);
    return out;
  }
  function scanGoals(){
    scoreNodes().forEach(([k, el]) => {
      if(!k) return; const t = el.textContent.replace(/\s+/g, "");
      const prev = SEEN.get(k);
      if(prev !== undefined && prev !== t && /\d/.test(t)){
        if(!reduce()){ el.classList.remove("pm-goal"); void el.offsetWidth; el.classList.add("pm-goal"); setTimeout(() => el.classList.remove("pm-goal"), 2600); }
        const row = el.closest("[data-mopen]"); if(row){ row.classList.add("pm-goal-row"); setTimeout(() => row.classList.remove("pm-goal-row"), 3200); }
      }
      SEEN.set(k, t);
    });
  }

  /* ---------------- 3) السحب للتحديث في «المباريات» ---------------- */
  let ptr = null, y0 = null, pulling = false, busy = false;
  const TH = 90;
  function ptrEl(){ if(!ptr){ ptr = D.createElement("div"); ptr.className = "pm-ptr"; ptr.innerHTML = `<i></i><span>اسحب للتحديث</span>`; D.body.appendChild(ptr); } return ptr; }
  function atTop(){ return (window.scrollY || D.documentElement.scrollTop || 0) <= 0; }
  D.addEventListener("touchstart", e => {
    if(busy || curView() !== "matches" || D.querySelector("#mpage.on, #pprof.on, .mf-hub.on, .mf-sheet.on") || !atTop()) { y0 = null; return; }
    y0 = e.touches[0].clientY; pulling = false;
  }, {passive: true});
  D.addEventListener("touchmove", e => {
    if(y0 === null) return; const dy = e.touches[0].clientY - y0;
    if(dy <= 0 || !atTop()){ if(pulling){ pulling = false; ptrEl().classList.remove("show","ready"); ptrEl().style.transform = ""; } return; }
    pulling = true; const p = ptrEl(), d = Math.min(dy * .5, 80);
    p.classList.add("show"); p.style.transform = `translate(-50%, ${d}px)`;
    p.querySelector("i").style.transform = `rotate(${dy * 2}deg)`;
    const ready = dy > TH; p.classList.toggle("ready", ready); p.querySelector("span").textContent = ready ? "اترك للتحديث" : "اسحب للتحديث";
  }, {passive: true});
  D.addEventListener("touchend", async e => {
    if(y0 === null || !pulling){ y0 = null; return; }
    const dy = (e.changedTouches[0] || {}).clientY - y0; y0 = null; pulling = false;
    const p = ptrEl();
    if(!(dy > TH)){ p.classList.remove("show","ready"); p.style.transform = ""; return; }
    busy = true; p.classList.add("spin"); p.classList.remove("ready"); p.style.transform = "translate(-50%, 54px)"; p.querySelector("span").textContent = "جارٍ التحديث…";
    try{ safe(() => { FRESH_AT = 0; }); await (typeof freshenSeason === "function" ? freshenSeason() : null); }catch(err){}
    safe(() => { if(typeof renderMatches === "function" && curView() === "matches") renderMatches(); });
    p.querySelector("span").textContent = "تم التحديث";
    setTimeout(() => { p.classList.remove("show","spin"); p.style.transform = ""; busy = false; }, 650);
  }, {passive: true});

  /* ---------------- التشغيل ---------------- */
  let q = 0;
  const tick = () => { q = 0; safe(paintLive); safe(scanGoals); };
  new MutationObserver(() => { if(!q) q = requestAnimationFrame(tick); }).observe(D.body, {childList: true, subtree: true, characterData: true});
  setInterval(tick, 5000);   /* الساعة في البطاقة تتقدّم حتى بلا تحديث بيانات */
  window.addEventListener("hashchange", () => setTimeout(tick, 60));
  setTimeout(tick, 400);
  window.PMX = { tick, paintLive, scanGoals };
})();
