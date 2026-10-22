/* =====================================================================
   الأخبار — غرفة أخبار MF Soccer (منصور 2026-10-22)

   قسمان: أخبار محلية (تكريم MF Soccer، الإصابات، الانتقالات) وأخبار
   المنتخب (المباريات، القوائم). كل المحتوى يُكتب من لوحة الإدارة — لا شيء
   مكتوب في الكود، ولا أخبار أو أرقام مولّدة.

   التخزين (Firestore):
     news/{id}        المقال كاملاً. يقرؤه الزائر فقط إن كان منشوراً (القواعد).
     seasons/news     فهرس المنشور فقط {items:[ملخص بلا نص], updated} — صفحات
                      القسم تُرسم منه بقراءة واحدة (ومن CDN عبر /api/doc/news).
     newsimg/{id}     الصورة WebP مضغوطة في المتصفح (dataURL < 1MB) + نسخة
                      مصغّرة {id}_t للبطاقات. تُخدم على الموقع من
                      /api/newsimg/{id} بذاكرة CDN دائمة (الصورة لا تتغيّر أبداً:
                      الاستبدال = صورة جديدة بمعرّف جديد).
   الصلاحية: المالك أو «مدير» فعّال (المحرر بصلاحية المباريات فقط لا يرى القسم)
   — والقواعد في firestore.rules تفرض ذلك على الخادم، لا الواجهة وحدها.
   وضع الاختبار: ‏?newstest=1 على localhost — تخزين محلي فقط ولوحة بلا دخول.
   ===================================================================== */
(function(){
"use strict";
const NW = window.NEWS = {};
const TEST = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && /[?&]newstest=1\b/.test(location.search);
/* دوال نتلفاي (/api/…) موجودة على الموقع المنشور فقط (https)؛ محلياً أو من الهاتف على الشبكة المنزلية نقرأ من Firestore مباشرة */
const LOCAL = location.protocol!=="https:" || /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const H = s => String(s==null?"":s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const rid = () => (Date.now().toString(36) + Math.random().toString(36).slice(2,10)).slice(0,18);
const say = (m, k) => { if(typeof toast==="function") toast(m, k); else console.log(m); };
const safe = f => { try{ return f(); }catch(e){ return undefined; } };

/* ───────────── الأقسام والتصنيفات ───────────── */
const SECS = {
  local: {t:"أخبار محلية", cats:["awards","injuries","transfers"]},
  nt:    {t:"أخبار المنتخب", cats:["matches","squads"]}
};
const CATS = {
  awards:    {t:"تكريم MF Soccer", sec:"local"},
  injuries:  {t:"الإصابات", sec:"local"},
  transfers: {t:"الانتقالات", sec:"local"},
  matches:   {t:"المباريات", sec:"nt"},
  squads:    {t:"القوائم", sec:"nt"}
};
/* حالة الانتقال تُختار يدوياً فقط — بلا اختيار لا تظهر أي شارة */
const TRANSFER_ST = {official:"رسمي", talks:"مفاوضات", loan:"إعارة"};
const STATUS = {draft:"مسودة", published:"منشور", unpublished:"غير منشور"};

/* ───────────── التواريخ ───────────── */
const AR_MON = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const AR_DOW = ["الأحد","الإثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
const dObj = s => { const d = new Date(s); return isNaN(d) ? null : d; };
const dLong = s => { const d = dObj(s); return d ? `${d.getDate()} ${AR_MON[d.getMonth()]} ${d.getFullYear()}` : ""; };
const dTime = s => { const d = dObj(s); if(!d) return ""; let h = d.getHours(); const m = String(d.getMinutes()).padStart(2,"0"); const pm = h>=12; h = h%12 || 12; return `${h}:${m} ${pm?"م":"ص"}`; };
const dShort = s => { const d = dObj(s); if(!d) return ""; const diff = (Date.now()-d)/36e5;
  if(diff>=0 && diff<1) return "قبل دقائق"; if(diff>=0 && diff<24) return `قبل ${Math.max(1,Math.round(diff))} ${Math.round(diff)<=10&&Math.round(diff)>2?"ساعات":"ساعة"}`;
  return `${d.getDate()} ${AR_MON[d.getMonth()]}${d.getFullYear()!==new Date().getFullYear()?" "+d.getFullYear():""}`; };
const todayLine = () => { const d = new Date(); return `${AR_DOW[d.getDay()]} ${d.getDate()} ${AR_MON[d.getMonth()]} ${d.getFullYear()}`; };
const localInput = s => { const d = dObj(s) || new Date(); const p = n => String(n).padStart(2,"0"); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };

/* ───────────── تنظيف النص المنسّق ───────────── */
const ALLOWED = {B:"b", STRONG:"b", I:"i", EM:"i", A:"a", BR:"br", U:"u"};
function cleanHTML(html){
  const doc = new DOMParser().parseFromString(`<div>${html||""}</div>`, "text/html");
  const out = document.createElement("div");
  (function walk(src, dst){
    src.childNodes.forEach(n=>{
      if(n.nodeType===3){ dst.appendChild(document.createTextNode(n.nodeValue)); return; }
      if(n.nodeType!==1) return;
      const tag = ALLOWED[n.tagName];
      if(n.tagName==="DIV" || n.tagName==="P"){ if(dst.childNodes.length) dst.appendChild(document.createElement("br")); walk(n, dst); return; }
      if(!tag){ walk(n, dst); return; }
      const el = document.createElement(tag);
      if(tag==="a"){ const h = String(n.getAttribute("href")||"").trim(); if(!/^https?:\/\//i.test(h)){ walk(n, dst); return; }
        el.setAttribute("href", h); el.setAttribute("target","_blank"); el.setAttribute("rel","noopener"); }
      if(tag!=="br") walk(n, el);
      dst.appendChild(el);
    });
  })(doc.body.firstChild, out);
  return out.innerHTML.replace(/(<br>\s*)+$/,"").trim();
}
const plain = html => { const d = document.createElement("div"); d.innerHTML = html||""; return (d.textContent||"").trim(); };

/* ───────────── الصور: ضغط في المتصفح ───────────── */
const IMG_OK = /^image\/(jpeg|png|webp|gif|heic|heif|avif)$/i, IMG_MAX_IN = 20*1024*1024;
let WEBP = null;
function canWebp(){ if(WEBP===null){ try{ const c = document.createElement("canvas"); c.width = c.height = 2; WEBP = c.toDataURL("image/webp").startsWith("data:image/webp"); }catch(e){ WEBP = false; } } return WEBP; }
async function decode(file){
  if(window.createImageBitmap){ try{ return await createImageBitmap(file, {imageOrientation:"from-image"}); }catch(e){} }
  return await new Promise((res, rej)=>{ const u = URL.createObjectURL(file), im = new Image();
    im.onload = ()=>{ URL.revokeObjectURL(u); res(im); }; im.onerror = ()=>{ URL.revokeObjectURL(u); rej(new Error("صيغة الصورة غير مدعومة")); }; im.src = u; });
}
function encode(src, max, q, limit){
  const W = src.width, Hh = src.height, k = Math.min(1, max/Math.max(W, Hh));
  let w = Math.round(W*k), h = Math.round(Hh*k), d = "";
  const type = canWebp() ? "image/webp" : "image/jpeg";
  for(let i=0; i<8; i++){
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d"); if(type==="image/jpeg"){ g.fillStyle = "#fff"; g.fillRect(0,0,w,h); }
    g.drawImage(src, 0, 0, w, h); d = c.toDataURL(type, q);
    if(d.length <= limit) break;
    if(q > .6) q -= .08; else { w = Math.round(w*.85); h = Math.round(h*.85); }
  }
  return {d, w, h};
}
/* يعيد {d, w, h, t} — t نسخة مصغّرة للبطاقات */
async function compress(file){
  if(!file) throw new Error("لم تُختر صورة");
  if(file.type && !IMG_OK.test(file.type)) throw new Error("الملف ليس صورة (JPG / PNG / WebP)");
  if(file.size > IMG_MAX_IN) throw new Error("الصورة أكبر من 20 ميغابايت");
  const src = await decode(file);
  const lim = TEST ? 260000 : 900000;
  const big = encode(src, TEST ? 1400 : 1920, .84, lim), small = encode(src, 760, .78, TEST ? 70000 : 180000);
  if(src.close) src.close();
  return {d:big.d, w:big.w, h:big.h, t:small.d};
}

/* ───────────── التخزين ───────────── */
const LS = { get(k){ try{ const s = localStorage.getItem(k); return s ? JSON.parse(s) : null; }catch(e){ return null; } },
  set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); return true; }catch(e){ return false; } },
  del(k){ try{ localStorage.removeItem(k); }catch(e){} } };
const IDX_CACHE = "mfnews_idx";
const dbReady = () => new Promise(res=>{ const t = () => (typeof fbDb!=="undefined" && fbDb) ? res(fbDb) : setTimeout(t, 300); t(); });
const who = () => (typeof FBUSER!=="undefined" && FBUSER && (FBUSER.email || FBUSER.uid)) || (TEST ? "test" : "");
const permErr = e => e && (e.code==="permission-denied" || /permission/i.test(e.message||""));
const errMsg = e => permErr(e) ? "لا صلاحية للحفظ — تأكد أنك مسجّل كمدير، وأن قواعد Firestore الخاصة بالأخبار منشورة" : ((e && (e.code||e.message)) || "خطأ غير معروف");

const store = {
  /* الفهرس العام: نسخة الجهاز ثم CDN ثم قناة حيّة */
  watchIndex(cb){
    if(TEST){ const r = ()=>cb(LS.get("mfnews_t_idx") || {items:[]}); r(); window.addEventListener("storage", e=>{ if(e.key==="mfnews_t_idx") r(); }); return; }
    let live = false, last = "";
    const early = d => { if(live || !d || !Array.isArray(d.items)) return; const u = String(d.updated||""); if(last && u <= last) return; last = u; cb(d); };
    early(LS.get(IDX_CACHE));
    if(typeof SNAP!=="undefined" && SNAP && SNAP.get && /^https?:$/.test(location.protocol) && !LOCAL) SNAP.get("news").then(early).catch(()=>{});
    dbReady().then(db=>db.collection("seasons").doc("news").onSnapshot(s=>{ live = true; const d = s.exists ? s.data() : {items:[]};
      LS.set(IDX_CACHE, d); cb(d); }, e=>{ console.warn("news index", e); if(!last) cb({items:[], err:true}); }));
  },
  async getArticle(id){
    if(TEST) return LS.get("mfnews_t_a_"+id);
    const db = await dbReady(); const s = await db.collection("news").doc(id).get();
    return s.exists ? Object.assign({id}, s.data()) : null;
  },
  async listAll(){
    if(TEST){ const out = []; for(let i=0; i<localStorage.length; i++){ const k = localStorage.key(i); if(k && k.startsWith("mfnews_t_a_")) out.push(LS.get(k)); } return out.filter(Boolean); }
    const db = await dbReady(); const q = await db.collection("news").orderBy("updated","desc").limit(400).get();
    return q.docs.map(d=>Object.assign({id:d.id}, d.data()));
  },
  async putImage(id, d, w, h){
    if(TEST){ if(!LS.set("mfnews_t_i_"+id, {d, w, h})) throw new Error("مساحة التخزين المحلي امتلأت (وضع الاختبار)"); return; }
    const db = await dbReady(); await db.collection("newsimg").doc(id).set({d, w:w||0, h:h||0, at:new Date().toISOString(), by:who()});
  },
  async delImage(id){
    if(TEST){ LS.del("mfnews_t_i_"+id); LS.del("mfnews_t_i_"+id+"_t"); return; }
    const db = await dbReady(); await Promise.all([db.collection("newsimg").doc(id).delete(), db.collection("newsimg").doc(id+"_t").delete()]).catch(()=>{});
  },
  async getImage(id){
    if(TEST){ const x = LS.get("mfnews_t_i_"+id); return x && x.d; }
    const db = await dbReady(); const s = await db.collection("newsimg").doc(id).get(); return s.exists ? s.data().d : null;
  },
  async putArticle(a){
    if(TEST){ if(!LS.set("mfnews_t_a_"+a.id, a)) throw new Error("مساحة التخزين المحلي امتلأت (وضع الاختبار)"); return; }
    const db = await dbReady(); const o = clone(a); delete o.id; await db.collection("news").doc(a.id).set(o);
  },
  async patchArticle(id, f){
    if(TEST){ const a = LS.get("mfnews_t_a_"+id); if(a) LS.set("mfnews_t_a_"+id, Object.assign(a, f)); return; }
    const db = await dbReady(); await db.collection("news").doc(id).update(f);
  },
  async delArticle(id){
    if(TEST){ LS.del("mfnews_t_a_"+id); return; }
    const db = await dbReady(); await db.collection("news").doc(id).delete();
  },
  /* تعديل الفهرس داخل معاملة: محرّران في وقت واحد لا يمسح أحدهما عمل الآخر */
  async editIndex(fn){
    if(TEST){ const d = LS.get("mfnews_t_idx") || {items:[]}; d.items = fn(d.items||[]); d.updated = new Date().toISOString(); LS.set("mfnews_t_idx", d); IDX = d; repaint(); return; }
    const db = await dbReady(), ref = db.collection("seasons").doc("news");
    await db.runTransaction(async tx=>{ const s = await tx.get(ref); const items = fn(clone((s.exists && s.data().items) || []));
      tx.set(ref, {items, updated:new Date().toISOString(), updatedBy:who()}); });
  }
};

/* رابط الصورة: على الموقع من CDN، ومحلياً (بلا دوال نتلفاي) من Firestore مباشرة */
const IMG_CACHE = {};
const pending = {};   /* صور المحرّر قبل الحفظ: id → dataURL */
function imgSrcNow(id){
  if(!id) return "";
  if(pending[id]) return pending[id];
  if(IMG_CACHE[id]) return IMG_CACHE[id];
  if(!TEST && !LOCAL) return "/api/newsimg/" + encodeURIComponent(id);
  return "";
}
function hydrateImgs(root){
  (root||document).querySelectorAll("img[data-nimg]:not([data-nok])").forEach(img=>{
    const id = img.dataset.nimg; img.dataset.nok = "1";
    const s = imgSrcNow(id); if(s){ img.src = s; return; }
    store.getImage(id).then(d=>{ if(!d && id.endsWith("_t")) return store.getImage(id.slice(0,-2)); return d; })
      .then(d=>{ if(d){ IMG_CACHE[id] = d; img.src = d; } else img.closest(".nw-ph")?.classList.add("nw-noimg"); }).catch(()=>{});
  });
}
const imgTag = (id, alt, cls, w, h, thumb) => {
  if(!id) return "";
  const key = thumb ? id+"_t" : id;
  return `<img class="${cls||""}" data-nimg="${H(key)}" alt="${H(alt||"")}"${w&&h?` width="${w}" height="${h}"`:""} loading="lazy" decoding="async" onerror="this.closest('.nw-ph')&&this.closest('.nw-ph').classList.add('nw-noimg')">`;
};

/* ───────────── الفهرس والترتيب ───────────── */
let IDX = null;          /* {items:[]} */
const ART = {};          /* مقالات مقروءة كاملة */
const nowISO = () => new Date().toISOString();
const isLive = it => it && (!it.pub || it.pub <= nowISO());
const order = (a, b) => (b.pinned?1:0)-(a.pinned?1:0) || (b.prio||0)-(a.prio||0) || String(b.pub||"").localeCompare(String(a.pub||""));
const items = () => ((IDX && IDX.items) || []).filter(isLive);
const ofSec = s => items().filter(x=>x.sec===s).sort(order);
const ofCat = c => items().filter(x=>x.cat===c).sort(order);
function leadOf(sec){
  const L = ofSec(sec); if(!L.length) return null;
  return L.find(x=>x.featured) || L.slice().sort((a,b)=>String(b.pub).localeCompare(String(a.pub)))[0];
}
function summary(a){
  return {id:a.id, title:a.title, sub:a.sub||"", sec:a.sec, cat:a.cat, cover:a.cover||null, author:a.author||"",
    pub:a.pub, upd:a.updated||"", featured:!!a.featured, pinned:!!a.pinned, prio:a.prio||0, tags:a.tags||[],
    transfer:a.cat==="transfers" ? (a.transfer||null) : null, match:a.cat==="matches" ? (a.match||null) : null};
}

/* ───────────── التنقل داخل الأخبار (روابط #news/…) ───────────── */
/* NV.r: home | sec | cat | art */
const NV = {r:"home", sec:"local", cat:null, id:null, page:1, scroll:{}, inApp:0};
const routeKey = () => NV.r==="art" ? "a/"+NV.id : NV.r==="cat" ? NV.sec+"/"+NV.cat : NV.r==="sec" ? NV.sec : "";
const hashOf = () => "#news" + (routeKey() ? "/"+routeKey() : "");
function parse(h){
  const p = String(h||"").replace(/^#news\/?/,"").split("/").filter(Boolean);
  if(p[0]==="a" && p[1]) return {r:"art", id:p[1]};
  if(SECS[p[0]] && CATS[p[1]] && CATS[p[1]].sec===p[0]) return {r:"cat", sec:p[0], cat:p[1]};
  if(SECS[p[0]]) return {r:"sec", sec:p[0]};
  return {r:"home"};
}
function apply(st){ NV.r = st.r; if(st.sec) NV.sec = st.sec; NV.cat = st.cat || null; NV.id = st.id || null; NV.page = 1; }
function open(st, opt){
  NV.scroll[routeKey()] = scrollY;
  apply(st);
  const h = hashOf();
  if(location.hash !== h){ if(opt && opt.replace) history.replaceState({nw:1}, "", h); else { history.pushState({nw:1}, "", h); NV.inApp++; } }
  if(!isOn()){ if(typeof go==="function") go("news"); return; }
  render(); window.scrollTo({top:0, behavior:"instant"});
}
const isOn = () => !!document.querySelector("#v-news.on");
function back(){
  /* داخل التطبيق: رجوع حقيقي (يحفظ موضع القائمة)؛ رابط مباشر: إلى تصنيف المقال */
  if(NV.inApp > 0){ history.back(); return; }
  const a = NV.id && (ART[NV.id] || items().find(x=>x.id===NV.id));
  if(NV.r==="art" && a) open({r:"cat", sec:a.sec, cat:a.cat}, {replace:true});
  else if(NV.r==="cat") open({r:"sec", sec:NV.sec}, {replace:true});
  else open({r:"home"}, {replace:true});
}
window.addEventListener("popstate", ()=>{
  if(!/^#news/.test(location.hash)) return;
  NV.inApp = Math.max(0, NV.inApp-1);
  const key = routeKey(); NV.scroll[key] = scrollY;
  apply(parse(location.hash));
  if(!isOn()){ if(typeof go==="function") go("news"); return; }
  render();
  const y = NV.scroll[routeKey()]; requestAnimationFrame(()=>window.scrollTo({top:y||0, behavior:"instant"}));
});

/* ───────────── مكوّنات العرض ───────────── */
const crestOf = c => safe(()=> (typeof LOCAL_CRESTS!=="undefined" && LOCAL_CRESTS[c]) || (typeof LOGOS!=="undefined" && LOGOS[c]) || "") || "";
const kfaLogo = () => safe(()=>KFA_INFO.img.logo) || "";
const catLabel = c => (CATS[c] && CATS[c].t) || "";
function meta(it, opt){
  const parts = [];
  if(opt && opt.cat) parts.push(`<span class="nw-k">${H(catLabel(it.cat))}</span>`);
  if(it.pub) parts.push(`<time datetime="${H(it.pub)}">${H(dShort(it.pub))}</time>`);
  return `<div class="nw-meta">${parts.join("")}</div>`;
}
function badge(it){
  const st = it.transfer && TRANSFER_ST[it.transfer.st];
  return st ? `<span class="nw-badge nw-b-${H(it.transfer.st)}">${st}</span>` : "";
}
function transferLine(it){
  const t = it.transfer; if(!t || (!t.from && !t.to)) return "";
  const side = c => `<span class="nw-tr-c">${crestOf(c)?`<img src="${H(crestOf(c))}" alt="" width="20" height="20" loading="lazy">`:""}<b>${H(c)}</b></span>`;
  /* نادٍ واحد معروف فقط: نعرضه وحده بلا «غير محدد» */
  if(!t.from || !t.to) return `<div class="nw-tr">${t.to ? `<span class="nw-tr-ar">إلى</span>${side(t.to)}` : `<span class="nw-tr-ar">من</span>${side(t.from)}`}</div>`;
  return `<div class="nw-tr">${side(t.from)}<span class="nw-tr-ar" aria-label="إلى">‹</span>${side(t.to)}</div>`;
}
function matchLine(it){
  const m = it.match; if(!m || !m.opp) return "";
  const hasScore = m.ks!=="" && m.ks!=null && m.os!=="" && m.os!=null;
  return `<div class="nw-mt"><span class="nw-mt-t">${kfaLogo()?`<img src="${H(kfaLogo())}" alt="" width="22" height="22">`:""}<b>الكويت</b></span>
    ${hasScore ? `<bdi class="nw-mt-s" dir="ltr">${H(m.os)} - ${H(m.ks)}</bdi>` : `<span class="nw-mt-v">ضد</span>`}
    <span class="nw-mt-t"><b>${H(m.opp)}</b></span>${m.comp?`<small>${H(m.comp)}</small>`:""}</div>`;
}
/* بطاقة موحّدة لكل التصنيفات؛ v = lead | big | std | row */
function card(it, v, opt){
  opt = opt || {};
  const c = it.cover, ar = it.cat==="squads" ? " nw-fit" : "";
  const ph = `<div class="nw-ph${ar}${c?"":" nw-noimg"}">${c ? imgTag(c.id, c.alt || it.title, "", c.w, c.h, v!=="lead") : ""}${badge(it)}</div>`;
  return `<article class="nw-c nw-c-${v}">
    <a class="nw-a" href="#news/a/${H(it.id)}" data-nw-art="${H(it.id)}">
      ${ph}
      <div class="nw-tx">
        ${meta(it, {cat:opt.cat})}
        <h3 class="nw-h" data-i18n="off">${H(it.title)}</h3>
        ${v!=="row" && it.sub ? `<p class="nw-x" data-i18n="off">${H(it.sub)}</p>` : ""}
        ${it.cat==="transfers" ? transferLine(it) : it.cat==="matches" ? matchLine(it) : ""}
        ${v==="lead" || v==="big" ? `<span class="nw-more">اقرأ المزيد</span>` : ""}
      </div>
    </a>
  </article>`;
}
const skel = n => `<div class="nw-skel" aria-hidden="true">${'<div class="nw-sk-ph"></div><div class="nw-sk-l"></div><div class="nw-sk-l s"></div>'.repeat(n||1)}</div>`;
const empty = (t, s) => `<div class="nw-empty"><b>${t}</b>${s?`<span>${s}</span>`:""}</div>`;
const secHead = (t, link, cls) => `<div class="nw-sh${cls?" "+cls:""}"><h2>${t}</h2>${link||""}</div>`;
const allLink = (sec, cat, n) => n ? `<a class="nw-all" href="#news/${sec}/${cat}" data-nw-cat="${sec}/${cat}">عرض الكل<span aria-hidden="true">›</span></a>` : "";

function switcher(){
  return `<nav class="nw-switch" aria-label="أقسام الأخبار">${Object.keys(SECS).map(s=>
    `<a href="#news/${s}" data-nw-sec="${s}" aria-current="${NV.sec===s && NV.r!=="home"?"page":"false"}">${SECS[s].t}</a>`).join("")}</nav>`;
}
/* شرائح التصنيفات تحت مبدّل القسم: «الكل» + تصنيفات القسم — انتقال مباشر من أعلى الصفحة */
function catChips(s, cur){
  return `<nav class="nw-chips nw-cats" aria-label="تصنيفات ${SECS[s].t}">
    <a href="#news/${s}" data-nw-sec="${s}" aria-current="${cur ? "false" : "page"}">الكل</a>
    ${SECS[s].cats.map(k=>`<a href="#news/${s}/${k}" data-nw-cat="${s}/${k}" aria-current="${k===cur?"page":"false"}">${catLabel(k)}</a>`).join("")}</nav>`;
}
/* زر الرجوع أعلى القسم والتصنيف: القسم ← الأخبار (اختيار محلية/المنتخب)، التصنيف ← قسمه */
const upBtn = (label, target) => `<div class="nw-up"><button type="button" class="nw-back" data-nw-up="${target}"><span aria-hidden="true">›</span>${label}</button></div>`;
function crumbs(list){
  return `<nav class="nw-crumbs" aria-label="المسار">${list.map(([t, attr], i)=> i===list.length-1 ? `<span aria-current="page">${t}</span>` : `<a href="${attr.href}" ${attr.data}>${t}</a><i aria-hidden="true">/</i>`).join("")}</nav>`;
}
const homeCrumb = ["الأخبار", {href:"#news", data:'data-nw-home="1"'}];

/* الصفحة الأولى: القسمان + آخر الأخبار */
function homeHTML(){
  if(!IDX) return `<div class="nw">${masthead()}${skel(2)}</div>`;
  const panel = s => {
    const lead = leadOf(s), n = ofSec(s).length;
    return `<a class="nw-panel nw-p-${s}" href="#news/${s}" data-nw-sec="${s}">
      <div class="nw-ph${lead && lead.cover ? "" : " nw-noimg"}">${lead && lead.cover ? imgTag(lead.cover.id, "", "", lead.cover.w, lead.cover.h) : ""}</div>
      <div class="nw-p-tx">
        <span class="nw-p-mark">${s==="nt" && kfaLogo() ? `<img src="${H(kfaLogo())}" alt="" width="28" height="28">` : `<img src="assets/brand/mf-mark.webp" alt="" width="34" height="16">`}</span>
        <h2>${SECS[s].t}</h2>
        <p data-i18n="off">${lead ? H(lead.title) : SECS[s].cats.map(catLabel).join("، ")}</p>
        <span class="nw-p-n">${n ? `${n} ${n===1?"خبر":n===2?"خبران":n<=10?"أخبار":"خبراً"}` : "لا أخبار بعد"}</span>
      </div>
    </a>`;
  };
  const latest = items().sort((a,b)=>String(b.pub).localeCompare(String(a.pub))).slice(0, 6);
  return `<div class="nw nw-home">
    ${masthead()}
    <div class="nw-panels">${panel("local")}${panel("nt")}</div>
    <section class="nw-blk">${secHead("آخر الأخبار")}
      ${latest.length ? `<div class="nw-list">${latest.map(it=>card(it, "row", {cat:true})).join("")}</div>` : empty("لا توجد أخبار منشورة بعد", "تظهر هنا الأخبار فور نشرها من لوحة الإدارة.")}
    </section>
  </div>`;
}
function masthead(){
  return `<header class="nw-mast"><h1>الأخبار</h1><span>${todayLine()}</span></header>`;
}

/* واجهة القسم: الخبر الرئيسي ثم كتلة لكل تصنيف */
function secHTML(){
  const s = NV.sec, S = SECS[s];
  const top = `<header class="nw-sec-hd nw-sh-${s}">${upBtn("الأخبار", "home")}<h1>${S.t}</h1>${switcher()}${catChips(s, null)}</header>`;
  if(!IDX) return `<div class="nw nw-s-${s}">${top}${skel(3)}</div>`;
  const all = ofSec(s);
  if(!all.length) return `<div class="nw nw-s-${s}">${top}${empty("لا توجد أخبار منشورة في هذا القسم بعد", S.cats.map(catLabel).join("، "))}</div>`;
  const lead = leadOf(s);
  const side = all.filter(x=>x!==lead).sort((a,b)=>String(b.pub).localeCompare(String(a.pub))).slice(0, 3);
  const used = new Set([lead, ...side].map(x=>x.id));
  const blocks = S.cats.map(c=>{
    const L = ofCat(c), rest = L.filter(x=>!used.has(x.id)), show = (rest.length ? rest : L).slice(0, c==="injuries" ? 4 : 3);
    const body = !L.length ? empty(`لا أخبار في «${catLabel(c)}» بعد`)
      : c==="injuries" ? `<div class="nw-list nw-list-2">${show.map(it=>card(it, "row")).join("")}</div>`
      : `<div class="nw-grid nw-g-${c} nw-n${show.length}">${show.map((it,i)=>card(it, i===0 && show.length>1 ? "big" : "std")).join("")}</div>`;
    return `<section class="nw-blk nw-blk-${c}">${secHead(catLabel(c), allLink(s, c, L.length))}${body}</section>`;
  }).join("");
  return `<div class="nw nw-s-${s}">${top}
    <section class="nw-front">${card(lead, "lead", {cat:true})}
      ${side.length ? `<div class="nw-side">${side.map(it=>card(it, "row", {cat:true})).join("")}</div>` : ""}</section>
    ${blocks}
  </div>`;
}

/* صفحة التصنيف: كل أخباره، 12 في كل دفعة */
const PAGE = 12;
function catHTML(){
  const s = NV.sec, c = NV.cat, S = SECS[s];
  const top = `<header class="nw-sec-hd nw-sh-${s}">${upBtn(S.t, s)}<h1>${catLabel(c)}</h1>${switcher()}${catChips(s, c)}</header>`;
  if(!IDX) return `<div class="nw nw-s-${s}">${top}${skel(3)}</div>`;
  const L = ofCat(c);
  if(!L.length) return `<div class="nw nw-s-${s}">${top}${empty(`لا توجد أخبار منشورة في «${catLabel(c)}» بعد`, "ستظهر هنا فور نشرها.")}</div>`;
  const shown = L.slice(0, NV.page*PAGE);
  return `<div class="nw nw-s-${s}">${top}
    <p class="nw-count">${L.length} ${L.length===1?"خبر":L.length===2?"خبران":L.length<=10?"أخبار":"خبراً"}</p>
    ${card(shown[0], "lead")}
    ${shown.length>1 ? `<div class="nw-grid nw-g-all">${shown.slice(1).map(it=>card(it, "std")).join("")}</div>` : ""}
    ${L.length > shown.length ? `<div class="nw-pager"><button type="button" class="nw-btn" data-nw-more>عرض المزيد</button></div>` : ""}
  </div>`;
}

/* المقال */
function bodyHTML(blocks){
  return (blocks||[]).map(b=>{
    if(b.k==="p") return b.h ? `<p>${cleanHTML(b.h)}</p>` : "";
    if(b.k==="h") return b.x ? `<h2>${H(b.x)}</h2>` : "";
    if(b.k==="q") return b.x ? `<blockquote><p>${H(b.x)}</p>${b.by?`<cite>${H(b.by)}</cite>`:""}</blockquote>` : "";
    if(b.k==="ul"){ const L = (b.items||[]).map(s=>String(s).trim()).filter(Boolean); return L.length ? `<${b.ol?"ol":"ul"}>${L.map(x=>`<li>${H(x)}</li>`).join("")}</${b.ol?"ol":"ul"}>` : ""; }
    if(b.k==="img" && b.id) return `<figure class="nw-fig"><div class="nw-ph nw-nat" style="--ar:${b.w&&b.h?b.w/b.h:1.6}">${imgTag(b.id, b.alt || b.cap || "", "", b.w, b.h)}</div>${b.cap?`<figcaption>${H(b.cap)}</figcaption>`:""}</figure>`;
    return "";
  }).join("");
}
function articleHTML(a, opt){
  opt = opt || {};
  const sec = SECS[a.sec] ? a.sec : "local";
  const rel = opt.preview ? [] : ofCat(a.cat).filter(x=>x.id!==a.id).slice(0, 3);
  const upd = a.updated && a.pub && a.updated.slice(0,16) > a.pub.slice(0,16) && (new Date(a.updated)-new Date(a.pub)) > 36e5;
  const c = a.cover;
  return `<div class="nw nw-art nw-s-${sec}">
    ${opt.preview ? "" : `<div class="nw-art-bar"><button type="button" class="nw-back" data-nw-back><span aria-hidden="true">›</span>${H(catLabel(a.cat)) || "الأخبار"}</button>
      <button type="button" class="nw-share" data-nw-share>مشاركة</button></div>`}
    <article class="nw-doc" data-i18n="off">
      <header class="nw-doc-hd">
        <a class="nw-k" href="#news/${sec}/${H(a.cat)}" data-nw-cat="${sec}/${H(a.cat)}">${H(catLabel(a.cat))}</a>
        <h1>${H(a.title || "بلا عنوان")}</h1>
        ${a.sub ? `<p class="nw-dek">${H(a.sub)}</p>` : ""}
        <div class="nw-byline">${a.author ? `<b>${H(a.author)}</b>` : ""}
          ${a.pub ? `<time datetime="${H(a.pub)}">${H(dLong(a.pub))}، ${H(dTime(a.pub))}</time>` : ""}
          ${upd ? `<span>آخر تحديث ${H(dLong(a.updated))}، ${H(dTime(a.updated))}</span>` : ""}</div>
        ${a.cat==="transfers" ? `${badge(a)}${transferLine(a)}` : a.cat==="matches" ? matchLine(a) : ""}
      </header>
      ${c ? `<figure class="nw-fig nw-cover"><div class="nw-ph nw-nat" style="--ar:${c.w&&c.h?c.w/c.h:1.6}">${imgTag(c.id, c.alt || a.title, "", c.w, c.h)}</div>${a.coverCap?`<figcaption>${H(a.coverCap)}</figcaption>`:""}</figure>` : ""}
      <div class="nw-body">${bodyHTML(a.body)}</div>
      ${(a.tags||[]).length ? `<ul class="nw-tags" aria-label="وسوم">${a.tags.map(t=>`<li>${H(t)}</li>`).join("")}</ul>` : ""}
    </article>
    ${rel.length ? `<section class="nw-blk nw-rel">${secHead("من "+catLabel(a.cat), allLink(sec, a.cat, 1))}<div class="nw-grid nw-g-rel">${rel.map(it=>card(it, "std")).join("")}</div></section>` : ""}
  </div>`;
}
function artHTML(){
  const id = NV.id, a = ART[id];
  if(a) return articleHTML(a);
  if(a===null) return `<div class="nw">${crumbs([homeCrumb, ["غير متاح"]])}${empty("هذا الخبر غير متاح", "ربما أُلغي نشره أو حُذف.")}<div class="nw-pager"><button type="button" class="nw-btn" data-nw-home="1">كل الأخبار</button></div></div>`;
  store.getArticle(id).then(x=>{ ART[id] = (x && (x.status==="published" || canManage())) ? x : null; if(NV.r==="art" && NV.id===id) render(); })
    .catch(e=>{ ART[id] = null; console.warn(e); if(NV.r==="art" && NV.id===id) render(); });
  return `<div class="nw nw-art"><div class="nw-doc">${skel(1)}</div></div>`;
}

function render(){
  const v = document.getElementById("v-news"); if(!v) return;
  v.innerHTML = NV.r==="art" ? artHTML() : NV.r==="cat" ? catHTML() : NV.r==="sec" ? secHTML() : homeHTML();
  if(TEST) v.insertAdjacentHTML("afterbegin", `<p class="nwa-test" style="text-align:center;margin:8px 0">وضع الاختبار المحلي: المحتوى محفوظ في هذا المتصفح فقط · <button type="button" class="nwa-b" onclick="NEWS.openAdmin()">لوحة الأخبار</button></p>`);
  hydrateImgs(v);
  const a = NV.r==="art" && ART[NV.id];
  document.title = a ? `${a.title} | MF Soccer` : (NV.r==="home" ? "الأخبار | MF Soccer" : `${NV.r==="cat"?catLabel(NV.cat):SECS[NV.sec].t} | MF Soccer`);
}
function repaint(){ if(isOn()) render(); paintAdmin(); }
NW.render = render;

/* نقرات الواجهة العامة */
document.addEventListener("click", e=>{
  if(e.defaultPrevented || e.button>0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
  const t = e.target.closest && e.target.closest("[data-nw-art],[data-nw-sec],[data-nw-cat],[data-nw-home],[data-nw-back],[data-nw-up],[data-nw-more],[data-nw-share]");
  if(!t || t.closest(".nwe")) return;
  if(t.dataset.nwArt){ e.preventDefault(); open({r:"art", id:t.dataset.nwArt}); return; }
  if(t.dataset.nwSec){ e.preventDefault(); open({r:"sec", sec:t.dataset.nwSec}); return; }
  if(t.dataset.nwCat){ e.preventDefault(); const [s,c] = t.dataset.nwCat.split("/"); open({r:"cat", sec:s, cat:c}); return; }
  if(t.dataset.nwHome){ e.preventDefault(); open({r:"home"}); return; }
  if(t.hasAttribute("data-nw-back")){ back(); return; }
  if(t.dataset.nwUp){ const u = t.dataset.nwUp; open(u==="home" ? {r:"home"} : {r:"sec", sec:u}); return; }
  if(t.hasAttribute("data-nw-more")){ NV.page++; const y = scrollY; render(); window.scrollTo({top:y, behavior:"instant"}); return; }
  if(t.hasAttribute("data-nw-share")){ const a = ART[NV.id]; const url = location.origin + location.pathname + "#news/a/" + NV.id;
    if(navigator.share) navigator.share({title:a ? a.title : "MF Soccer", url}).catch(()=>{});
    else if(navigator.clipboard) navigator.clipboard.writeText(url).then(()=>say("نُسخ رابط الخبر","ok"), ()=>{}); }
});

/* ═════════════════════════ الإدارة ═════════════════════════ */
function canManage(){
  if(TEST) return true;
  const adm = typeof isAdmin!=="undefined" && !!isAdmin;
  const mo = typeof window.MF_MATCHES_ONLY==="function" && window.MF_MATCHES_ONLY();
  return adm && !mo;
}
NW.canManage = canManage;
const AD = {list:null, loading:false, err:"", q:"", sec:"", cat:"", st:"", from:""};
async function loadAll(force){
  if(AD.loading || (AD.list && !force)) return;
  AD.loading = true; AD.err = "";
  try{ AD.list = await store.listAll(); }
  catch(e){ console.error(e); AD.err = errMsg(e); AD.list = AD.list || []; }
  AD.loading = false; paintAdmin();
}
const stOf = a => a.status==="published" && a.pub && a.pub > nowISO() ? "scheduled" : (a.status || "draft");
const stLbl = s => s==="scheduled" ? "مجدول" : STATUS[s] || s;
function filtered(){
  const q = AD.q.trim();
  return (AD.list||[]).filter(a=>(!AD.sec || a.sec===AD.sec) && (!AD.cat || a.cat===AD.cat) && (!AD.st || stOf(a)===AD.st)
      && (!AD.from || String(a.pub||"").slice(0,10) >= AD.from)
      && (!q || (a.title+" "+(a.sub||"")+" "+(a.author||"")+" "+(a.tags||[]).join(" ")).includes(q)))
    .sort((a,b)=> (a.sec===b.sec && a.cat===b.cat) ? order(a,b) : String(b.updated||"").localeCompare(String(a.updated||"")));
}
function adminHTML(){
  if(AD.list===null && !AD.loading) setTimeout(()=>loadAll(), 0);
  const L = AD.list ? filtered() : [];
  const opt = (o, v) => Object.entries(o).map(([k,t])=>`<option value="${k}"${k===v?" selected":""}>${t}</option>`).join("");
  const catOpts = Object.entries(CATS).filter(([,c])=>!AD.sec || c.sec===AD.sec).map(([k,c])=>`<option value="${k}"${k===AD.cat?" selected":""}>${c.t}</option>`).join("");
  const row = a => { const st = stOf(a);
    return `<div class="nwa-row" data-id="${H(a.id)}">
      <div class="nwa-th nw-ph${a.cover?"":" nw-noimg"}">${a.cover ? imgTag(a.cover.id, "", "", 0, 0, true) : ""}</div>
      <div class="nwa-in">
        <b class="nwa-t" data-i18n="off">${H(a.title || "بلا عنوان")}</b>
        <span class="nwa-m"><span class="nwa-st nwa-${st}">${stLbl(st)}</span>${H(SECS[a.sec]?.t||"")} / ${H(catLabel(a.cat))}${a.pub?` · ${H(dLong(a.pub))}`:""}${a.featured?' · <em>رئيسي</em>':""}${a.pinned?' · <em>مثبّت</em>':""}</span>
      </div>
      <div class="nwa-act">
        <button type="button" class="nwa-b" data-nwa="edit">تعديل</button>
        ${a.status==="published" ? `<button type="button" class="nwa-b" data-nwa="unpub">إلغاء النشر</button>` : `<button type="button" class="nwa-b pri" data-nwa="pub">نشر</button>`}
        <details class="nwa-more"><summary class="nwa-b" aria-label="خيارات أخرى">المزيد</summary><div>
          ${a.status==="published" ? `<button type="button" data-nwa="view">عرض في الموقع</button>` : ""}
          <button type="button" data-nwa="feat">${a.featured ? "إلغاء «الخبر الرئيسي»" : "اجعله الخبر الرئيسي"}</button>
          <button type="button" data-nwa="pin">${a.pinned ? "إلغاء التثبيت" : "تثبيت في الأعلى"}</button>
          <button type="button" data-nwa="up">تقديم في الترتيب</button>
          <button type="button" data-nwa="down">تأخير في الترتيب</button>
          <button type="button" class="dl" data-nwa="del">حذف نهائي</button>
        </div></details>
      </div>
    </div>`; };
  return `<div id="newsAdmin"><h2 class="sec">إدارة الأخبار</h2>
    <div class="card pad nwa">
      <div class="nwa-top"><button type="button" class="btn" data-nwa="new">+ خبر جديد</button>
        <button type="button" class="nwa-b" data-nwa="reload">تحديث القائمة</button>${TEST?'<span class="nwa-test">وضع الاختبار: تخزين محلي على هذا الجهاز فقط</span>':""}</div>
      <div class="nwa-f">
        <label>بحث<input type="search" data-nwaf="q" value="${H(AD.q)}" placeholder="العنوان، الكاتب، الوسم"></label>
        <label>القسم<select data-nwaf="sec"><option value="">الكل</option>${opt(Object.fromEntries(Object.entries(SECS).map(([k,s])=>[k,s.t])), AD.sec)}</select></label>
        <label>التصنيف<select data-nwaf="cat"><option value="">الكل</option>${catOpts}</select></label>
        <label>الحالة<select data-nwaf="st"><option value="">الكل</option>${opt(Object.assign({}, STATUS, {scheduled:"مجدول"}), AD.st)}</select></label>
        <label>منشور منذ<input type="date" data-nwaf="from" value="${H(AD.from)}"></label>
      </div>
      ${AD.err ? `<p class="nwa-err" role="alert">${H(AD.err)}</p>` : ""}
      <div class="nwa-list" aria-busy="${AD.loading}">${AD.list===null || AD.loading && !AD.list.length ? `<p class="nwa-empty">جارٍ التحميل…</p>`
        : L.length ? L.map(row).join("") : `<p class="nwa-empty">${(AD.list||[]).length ? "لا نتائج لهذا البحث" : "لا أخبار بعد. ابدأ بـ «خبر جديد»."}</p>`}</div>
    </div></div>`;
}
function paintAdmin(){
  const box = document.getElementById("newsAdmin"); if(!box) return;
  const f = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.nwaf;
  const t = document.createElement("div"); t.innerHTML = adminHTML(); const nb = t.firstElementChild; box.replaceWith(nb); hydrateImgs(nb);
  if(f){ const el = nb.querySelector(`[data-nwaf="${f}"]`); if(el){ el.focus(); if(el.setSelectionRange && el.type==="search") el.setSelectionRange(el.value.length, el.value.length); } }
}
let fT = 0;
document.addEventListener("input", e=>{
  const f = e.target.closest && e.target.closest("#newsAdmin [data-nwaf]"); if(!f) return;
  AD[f.dataset.nwaf] = f.value; if(f.dataset.nwaf==="sec" && AD.cat && CATS[AD.cat].sec!==AD.sec) AD.cat = "";
  clearTimeout(fT); fT = setTimeout(paintAdmin, f.type==="search" ? 220 : 0);
});

/* حفظ المقال + الفهرس معاً */
async function persist(a, opt){
  opt = opt || {};
  a.updated = nowISO(); a.updatedBy = who();
  if(!a.created){ a.created = a.updated; a.createdBy = who(); }
  await store.putArticle(a);
  const others = [];
  await store.editIndex(L=>{
    L = L.filter(x=>x.id!==a.id);
    if(a.status==="published"){
      if(a.featured) L.forEach(x=>{ if(x.sec===a.sec && x.featured){ x.featured = false; others.push(x.id); } });
      L.push(summary(a));
    }
    return L;
  });
  /* «الخبر الرئيسي» واحد لكل قسم: نزيل العلامة من مستند السابق أيضاً */
  if(a.featured && a.status==="published") (AD.list||[]).forEach(x=>{ if(x.id!==a.id && x.sec===a.sec && x.featured && !others.includes(x.id)) others.push(x.id); });
  await Promise.all(others.map(id=>store.patchArticle(id, {featured:false}).catch(()=>{})));
  (AD.list||[]).forEach(x=>{ if(others.includes(x.id)) x.featured = false; });
  ART[a.id] = a.status==="published" ? clone(a) : undefined;
  if(AD.list){ const i = AD.list.findIndex(x=>x.id===a.id); if(i>=0) AD.list[i] = clone(a); else AD.list.unshift(clone(a)); }
  if(!opt.quiet) paintAdmin();
}
const imagesOf = a => [a.cover && a.cover.id, ...(a.body||[]).filter(b=>b.k==="img").map(b=>b.id)].filter(Boolean);

document.addEventListener("click", async e=>{
  const b = e.target.closest && e.target.closest("#newsAdmin [data-nwa]"); if(!b) return;
  if(!canManage()){ say("هذه الأدوات للمدير فقط", "err"); return; }
  const act = b.dataset.nwa, row = b.closest("[data-id]"), a = row && (AD.list||[]).find(x=>x.id===row.dataset.id);
  const det = b.closest("details"); if(det) det.open = false;
  if(act==="new"){ openEditor(null); return; }
  if(act==="reload"){ AD.list = null; loadAll(true); paintAdmin(); return; }
  if(!a) return;
  if(act==="edit"){ openEditor(clone(a)); return; }
  if(act==="view"){ if(typeof go==="function") open({r:"art", id:a.id}); return; }
  const work = async (fn, ok) => { b.disabled = true; try{ await fn(); if(ok) say(ok, "ok"); }catch(x){ console.error(x); say("تعذّر: "+errMsg(x), "err"); } b.disabled = false; paintAdmin(); };
  if(act==="pub"){ if(!a.title || !a.cat){ say("أكمل العنوان والتصنيف أولاً", "err"); return; }
    return work(()=>persist(Object.assign(clone(a), {status:"published", pub:a.pub || nowISO()})), "نُشر الخبر"); }
  if(act==="unpub"){ if(!confirm(`إلغاء نشر «${a.title}»؟ يختفي من الموقع ويبقى في اللوحة.`)) return;
    return work(()=>persist(Object.assign(clone(a), {status:"unpublished"})), "أُلغي النشر"); }
  if(act==="feat") return work(()=>persist(Object.assign(clone(a), {featured:!a.featured})), a.featured ? "لم يعد الخبر الرئيسي" : "أصبح الخبر الرئيسي في "+(SECS[a.sec]?.t||""));
  if(act==="pin") return work(()=>persist(Object.assign(clone(a), {pinned:!a.pinned})), a.pinned ? "أُلغي التثبيت" : "ثُبّت في الأعلى");
  if(act==="up" || act==="down"){
    const L = (AD.list||[]).filter(x=>x.sec===a.sec && x.cat===a.cat && x.status==="published" && !!x.pinned===!!a.pinned).sort(order);
    const i = L.findIndex(x=>x.id===a.id), j = act==="up" ? i-1 : i+1;
    if(a.status!=="published"){ say("الترتيب للأخبار المنشورة فقط", "err"); return; }
    if(j<0 || j>=L.length){ say(act==="up" ? "الخبر في أول الترتيب" : "الخبر في آخر الترتيب", "info"); return; }
    /* تبديل الموضعين ثم ترقيم التصنيف كله تنازلياً — كتابة واحدة للفهرس، ومستند لكل خبر تغيّر رقمه */
    [L[i], L[j]] = [L[j], L[i]];
    const P = {}; L.forEach((x,k)=>{ P[x.id] = L.length - k; });
    return work(async ()=>{
      await store.editIndex(I=>I.map(x=>P[x.id]!==undefined ? Object.assign(x, {prio:P[x.id]}) : x));
      const ch = L.filter(x=>(x.prio||0)!==P[x.id]);
      await Promise.all(ch.map(x=>store.patchArticle(x.id, {prio:P[x.id]})));
      ch.forEach(x=>{ x.prio = P[x.id]; });
    }, "حُدّث الترتيب");
  }
  if(act==="del"){
    if(!confirm(`حذف «${a.title || "بلا عنوان"}» نهائياً مع صوره؟ لا يمكن التراجع.\nلإخفائه فقط استخدم «إلغاء النشر».`)) return;
    return work(async ()=>{ await store.editIndex(L=>L.filter(x=>x.id!==a.id)); await store.delArticle(a.id);
      await Promise.all(imagesOf(a).map(id=>store.delImage(id).catch(()=>{})));
      AD.list = AD.list.filter(x=>x.id!==a.id); delete ART[a.id]; }, "حُذف الخبر");
  }
});

/* ───────────── المحرّر (نافذة كاملة) ───────────── */
let ED = null;   /* {a, orig, dirty, view:'edit'|'preview'} */
const blank = () => ({id:rid(), title:"", sub:"", sec:"local", cat:"awards", cover:null, coverCap:"", body:[{k:"p", h:""}],
  author:(typeof FBUSER!=="undefined" && FBUSER && FBUSER.displayName) || "MF Soccer", pub:"", status:"draft",
  featured:false, pinned:false, prio:0, tags:[], transfer:{st:"", from:"", to:"", player:""}, match:{opp:"", comp:"", ks:"", os:"", ha:""}});
function openEditor(a){
  const isNew = !a;
  a = a || blank();
  a.transfer = Object.assign({st:"", from:"", to:"", player:""}, a.transfer||{});
  a.match = Object.assign({opp:"", comp:"", ks:"", os:"", ha:""}, a.match||{});
  if(!Array.isArray(a.body) || !a.body.length) a.body = [{k:"p", h:""}];
  ED = {a, orig:isNew ? null : clone(a), dirty:false, view:"edit", isNew};
  let o = document.getElementById("nwEditor");
  if(!o){ o = document.createElement("div"); o.id = "nwEditor"; o.className = "nwe"; o.setAttribute("role","dialog"); o.setAttribute("aria-modal","true"); o.setAttribute("aria-label","محرّر الخبر"); document.body.appendChild(o); }
  o.hidden = false; document.documentElement.classList.add("nwe-lock");
  paintEditor(); requestAnimationFrame(()=>{ const t = o.querySelector('[data-ef="title"]'); if(t) t.focus(); });
}
function closeEditor(force){
  if(!ED) return;
  if(!force && ED.dirty && !confirm("في تعديلات غير محفوظة. إغلاق بدون حفظ؟")) return;
  Object.keys(pending).forEach(k=>delete pending[k]);
  ED = null; const o = document.getElementById("nwEditor"); if(o){ o.hidden = true; o.innerHTML = ""; }
  document.documentElement.classList.remove("nwe-lock");
}
const clubOpts = sel => { const L = (safe(()=>CLUBS) || []); return `<option value="">—</option>${L.map(c=>`<option${c===sel?" selected":""}>${H(c)}</option>`).join("")}${sel && !L.includes(sel) ? `<option selected>${H(sel)}</option>` : ""}`; };
function blockHTML(b, i, n){
  const tools = `<div class="nwe-bt"><span>${({p:"فقرة", h:"عنوان فرعي", img:"صورة", q:"اقتباس", ul:"قائمة"})[b.k]}</span>
    <button type="button" data-eb="up" ${i===0?"disabled":""} aria-label="لأعلى">↑</button><button type="button" data-eb="down" ${i===n-1?"disabled":""} aria-label="لأسفل">↓</button><button type="button" class="dl" data-eb="rm" aria-label="حذف الكتلة">حذف</button></div>`;
  let inner = "";
  if(b.k==="p") inner = `<div class="nwe-rt-bar" role="toolbar" aria-label="تنسيق"><button type="button" data-rt="bold" aria-label="عريض"><b>B</b></button><button type="button" data-rt="italic" aria-label="مائل"><i>I</i></button><button type="button" data-rt="link" aria-label="رابط">رابط</button><button type="button" data-rt="clear" aria-label="إزالة التنسيق">بلا تنسيق</button></div>
    <div class="nwe-rt" contenteditable="true" role="textbox" aria-multiline="true" aria-label="نص الفقرة" data-eb-f="h" data-ph="اكتب الفقرة هنا…">${cleanHTML(b.h)}</div>`;
  else if(b.k==="h") inner = `<input type="text" data-eb-f="x" value="${H(b.x)}" placeholder="عنوان فرعي داخل المقال" aria-label="العنوان الفرعي">`;
  else if(b.k==="q") inner = `<textarea rows="2" data-eb-f="x" placeholder="نص الاقتباس" aria-label="نص الاقتباس">${H(b.x)}</textarea><input type="text" data-eb-f="by" value="${H(b.by)}" placeholder="القائل (اختياري)" aria-label="القائل">`;
  else if(b.k==="ul") inner = `<textarea rows="5" data-eb-f="items" placeholder="عنصر في كل سطر، مثال: اسم اللاعب (النادي)" aria-label="عناصر القائمة">${H((b.items||[]).join("\n"))}</textarea>
    <label class="nwe-ck"><input type="checkbox" data-eb-f="ol" ${b.ol?"checked":""}> قائمة مرقّمة</label>`;
  else if(b.k==="img") inner = `${b.id ? `<div class="nwe-img nw-ph">${imgTag(b.id, "", "", b.w, b.h)}</div>` : ""}
    <div class="nwe-imgact"><label class="nwa-b nwe-file">${b.id?"استبدال الصورة":"اختيار صورة"}<input type="file" accept="image/*" data-eb-file hidden></label></div>
    <input type="text" data-eb-f="cap" value="${H(b.cap)}" placeholder="تعليق تحت الصورة (اختياري)" aria-label="تعليق الصورة">
    <input type="text" data-eb-f="alt" value="${H(b.alt)}" placeholder="وصف الصورة لقارئات الشاشة" aria-label="الوصف البديل">`;
  return `<div class="nwe-blk nwe-k-${b.k}" data-bi="${i}">${tools}${inner}</div>`;
}
function editorHTML(){
  const a = ED.a, catOpts = Object.entries(CATS).filter(([,c])=>c.sec===a.sec).map(([k,c])=>`<option value="${k}"${k===a.cat?" selected":""}>${c.t}</option>`).join("");
  const st = a.status==="published";
  const head = `<header class="nwe-hd">
      <button type="button" class="nwa-b" data-ea="close">إغلاق</button>
      <div class="nwe-mode" role="tablist"><button type="button" role="tab" data-ea="mode-edit" aria-selected="${ED.view==="edit"}">تحرير</button><button type="button" role="tab" data-ea="mode-prev" aria-selected="${ED.view==="preview"}">معاينة</button></div>
      <span class="nwe-state">${ED.dirty ? "غير محفوظ" : ED.isNew ? "جديد" : stLbl(stOf(a))}</span>
      <div class="nwe-save">${st ? `<button type="button" class="btn" data-ea="update">حفظ التعديلات</button>`
        : `<button type="button" class="nwa-b" data-ea="draft">حفظ كمسودة</button><button type="button" class="btn" data-ea="publish">نشر</button>`}</div>
    </header>`;
  if(ED.view==="preview") return `${head}<div class="nwe-prev"><p class="nwe-prev-note">معاينة: هكذا يظهر الخبر للزوار</p>${articleHTML(Object.assign({}, a, {pub:a.pub || nowISO()}), {preview:true})}</div>`;
  return `${head}<div class="nwe-body">
    <div class="nwe-main">
      <label class="nwe-l">العنوان<textarea rows="2" class="nwe-title" data-ef="title" maxlength="160" placeholder="عنوان الخبر">${H(a.title)}</textarea><small class="nwe-cnt">${(a.title||"").length}/160</small></label>
      <label class="nwe-l">الوصف المختصر<textarea rows="2" data-ef="sub" maxlength="280" placeholder="سطران يظهران تحت العنوان في البطاقات وأعلى المقال">${H(a.sub)}</textarea></label>
      <div class="nwe-l"><span>صورة الغلاف</span>
        <div class="nwe-cover nw-ph${a.cover?"":" nw-noimg"}">${a.cover ? imgTag(a.cover.id, "", "", a.cover.w, a.cover.h) : `<span>لا صورة بعد</span>`}</div>
        <div class="nwe-imgact"><label class="nwa-b nwe-file">${a.cover ? "استبدال الغلاف" : "اختيار صورة الغلاف"}<input type="file" accept="image/*" data-ef-file="cover" hidden></label>
          ${a.cover ? `<button type="button" class="nwa-b dl" data-ea="rmcover">إزالة الغلاف</button>` : ""}
          <small>JPG أو PNG أو WebP، حتى 20 ميغابايت. تُضغط تلقائياً بلا قص.</small></div>
        <input type="text" data-ef="coverCap" value="${H(a.coverCap)}" placeholder="تعليق تحت صورة الغلاف (اختياري)" aria-label="تعليق الغلاف">
        <input type="text" data-ef="coverAlt" value="${H(a.cover && a.cover.alt)}" placeholder="وصف صورة الغلاف لقارئات الشاشة" aria-label="وصف الغلاف" ${a.cover?"":"disabled"}>
      </div>
      <div class="nwe-l"><span>نص الخبر</span><div class="nwe-blocks">${a.body.map((b,i)=>blockHTML(b, i, a.body.length)).join("")}</div>
        <div class="nwe-add" role="group" aria-label="إضافة إلى النص"><span>إضافة:</span>
          <button type="button" class="nwa-b" data-ea="add-p">فقرة</button><button type="button" class="nwa-b" data-ea="add-h">عنوان فرعي</button>
          <button type="button" class="nwa-b" data-ea="add-img">صورة</button><button type="button" class="nwa-b" data-ea="add-q">اقتباس</button><button type="button" class="nwa-b" data-ea="add-ul">قائمة</button></div>
      </div>
    </div>
    <aside class="nwe-side">
      <label class="nwe-l">القسم<select data-ef="sec">${Object.entries(SECS).map(([k,s])=>`<option value="${k}"${k===a.sec?" selected":""}>${s.t}</option>`).join("")}</select></label>
      <label class="nwe-l">التصنيف<select data-ef="cat">${catOpts}</select></label>
      ${a.cat==="transfers" ? `<fieldset class="nwe-fs"><legend>بيانات الانتقال</legend>
        <label class="nwe-l">اللاعب<input type="text" data-ef-t="player" value="${H(a.transfer.player)}"></label>
        <label class="nwe-l">من نادي<select data-ef-t="from">${clubOpts(a.transfer.from)}</select></label>
        <label class="nwe-l">إلى نادي<select data-ef-t="to">${clubOpts(a.transfer.to)}</select></label>
        <label class="nwe-l">الحالة<select data-ef-t="st"><option value="">بلا شارة</option>${Object.entries(TRANSFER_ST).map(([k,t])=>`<option value="${k}"${k===a.transfer.st?" selected":""}>${t}</option>`).join("")}</select>
          <small>اختر «رسمي» فقط بعد إعلان رسمي موثّق.</small></label></fieldset>` : ""}
      ${a.cat==="matches" ? `<fieldset class="nwe-fs"><legend>بيانات المباراة (اختياري)</legend>
        <label class="nwe-l">المنافس<input type="text" data-ef-m="opp" value="${H(a.match.opp)}" placeholder="مثال: منتخب …"></label>
        <label class="nwe-l">البطولة<input type="text" data-ef-m="comp" value="${H(a.match.comp)}"></label>
        <div class="nwe-2"><label class="nwe-l">أهداف الكويت<input type="number" min="0" max="30" inputmode="numeric" data-ef-m="ks" value="${H(a.match.ks)}"></label>
        <label class="nwe-l">أهداف المنافس<input type="number" min="0" max="30" inputmode="numeric" data-ef-m="os" value="${H(a.match.os)}"></label></div>
        <small>اترك النتيجة فارغة للمباريات القادمة.</small></fieldset>` : ""}
      <label class="nwe-l">الكاتب<input type="text" data-ef="author" value="${H(a.author)}" maxlength="80"></label>
      <label class="nwe-l">تاريخ النشر<input type="datetime-local" data-ef="pub" value="${H(a.pub ? localInput(a.pub) : "")}"><small>فارغ = لحظة النشر. تاريخ قادم = يظهر في موعده.</small></label>
      <label class="nwe-l">الوسوم<input type="text" data-ef="tags" value="${H((a.tags||[]).join("، "))}" placeholder="مفصولة بفاصلة"></label>
      <label class="nwe-ck"><input type="checkbox" data-ef="featured" ${a.featured?"checked":""}> الخبر الرئيسي في القسم</label>
      <label class="nwe-ck"><input type="checkbox" data-ef="pinned" ${a.pinned?"checked":""}> تثبيت في أعلى التصنيف</label>
      ${!ED.isNew && st ? `<button type="button" class="nwa-b" data-ea="unpublish">إلغاء النشر</button>` : ""}
      ${!ED.isNew && a.status==="unpublished" ? `<button type="button" class="nwa-b" data-ea="draft">إرجاع إلى مسودة</button>` : ""}
    </aside>
  </div>`;
}
function paintEditor(keepScroll){
  const o = document.getElementById("nwEditor"); if(!o || !ED) return;
  const sc = o.scrollTop; o.innerHTML = `<div class="nwe-in">${editorHTML()}</div>`; hydrateImgs(o);
  if(keepScroll) o.scrollTop = sc;
}
function setDirty(){ if(!ED) return; if(!ED.dirty){ ED.dirty = true; const s = document.querySelector("#nwEditor .nwe-state"); if(s) s.textContent = "غير محفوظ"; } }
function readRT(el){ return cleanHTML(el.innerHTML); }

document.addEventListener("input", e=>{
  if(!ED || !e.target.closest || !e.target.closest("#nwEditor")) return;
  const t = e.target, a = ED.a;
  if(t.dataset.ef){ const k = t.dataset.ef;
    if(k==="tags") a.tags = t.value.split(/[,،]/).map(s=>s.trim()).filter(Boolean).slice(0, 12);
    else if(k==="featured" || k==="pinned") a[k] = t.checked;
    else if(k==="pub") a.pub = t.value ? new Date(t.value).toISOString() : "";
    else if(k==="coverAlt"){ if(a.cover) a.cover.alt = t.value; }
    else if(k!=="sec" && k!=="cat") a[k] = t.value;
    if(k==="title"){ const c = t.parentNode.querySelector(".nwe-cnt"); if(c) c.textContent = `${t.value.length}/160`; }
  }
  else if(t.dataset.efT) a.transfer[t.dataset.efT] = t.value;
  else if(t.dataset.efM) a.match[t.dataset.efM] = t.value;
  else { const bl = t.closest("[data-bi]"); if(bl){ const b = a.body[+bl.dataset.bi], f = t.dataset.ebF;
    if(f==="h") b.h = readRT(t); else if(f==="items") b.items = t.value.split("\n"); else if(f==="ol") b.ol = t.checked; else if(f) b[f] = t.value; } }
  setDirty();
});
document.addEventListener("change", async e=>{
  if(!ED || !e.target.closest || !e.target.closest("#nwEditor")) return;
  const t = e.target, a = ED.a;
  if(t.dataset.ef==="sec"){ a.sec = t.value; if(CATS[a.cat].sec!==a.sec) a.cat = SECS[a.sec].cats[0]; setDirty(); paintEditor(true); return; }
  if(t.dataset.ef==="cat"){ a.cat = t.value; setDirty(); paintEditor(true); return; }
  if(t.dataset.ef==="featured" || t.dataset.ef==="pinned" || t.dataset.ebF==="ol"){ return; }
  const isCover = t.dataset.efFile==="cover", isBlk = t.hasAttribute("data-eb-file");
  if(!isCover && !isBlk) return;
  const file = t.files && t.files[0]; if(!file) return;
  const lab = t.closest("label"); if(lab){ lab.classList.add("busy"); lab.firstChild.nodeValue = "جارٍ تجهيز الصورة…"; }
  try{
    const r = await compress(file), id = rid();
    pending[id] = r.d; pending[id+"_t"] = r.t;
    if(isCover) a.cover = {id, w:r.w, h:r.h, alt:(a.cover && a.cover.alt) || ""};
    else { const b = a.body[+t.closest("[data-bi]").dataset.bi]; b.id = id; b.w = r.w; b.h = r.h; }
    setDirty(); paintEditor(true);
  }catch(x){ console.error(x); say(x.message || "تعذّرت قراءة الصورة", "err"); paintEditor(true); }
});
/* لصق نص فقط؛ وفقرات مفصولة بسطر فارغ تصير كتلاً مستقلة */
document.addEventListener("paste", e=>{
  const rt = e.target.closest && e.target.closest("#nwEditor .nwe-rt"); if(!rt || !ED) return;
  e.preventDefault();
  const txt = (e.clipboardData || window.clipboardData).getData("text/plain") || "";
  const parts = txt.replace(/\r/g,"").split(/\n\s*\n/).map(s=>s.trim()).filter(Boolean);
  const ins = s => document.execCommand("insertHTML", false, H(s).replace(/\n/g,"<br>"));
  if(parts.length<=1){ ins(txt.trim()); return; }
  ins(parts[0]);
  const i = +rt.closest("[data-bi]").dataset.bi; ED.a.body[i].h = readRT(rt);
  ED.a.body.splice(i+1, 0, ...parts.slice(1).map(p=>({k:"p", h:H(p).replace(/\n/g,"<br>")})));
  setDirty(); paintEditor(true);
});
document.addEventListener("keydown", e=>{ if(e.key==="Escape" && ED && !document.getElementById("nwEditor").hidden){ e.preventDefault(); closeEditor(); } });

function validate(a, publishing){
  if(!a.title.trim()) return "اكتب عنوان الخبر";
  if(!CATS[a.cat] || CATS[a.cat].sec!==a.sec) return "اختر التصنيف";
  if(publishing){
    if(!a.body.some(b=>(b.k==="p" && plain(b.h)) || (b.k!=="p" && (b.x || b.id || (b.items||[]).some(s=>s.trim()))))) return "اكتب نص الخبر قبل النشر";
    if(a.cat==="transfers" && a.transfer.st==="official" && !a.transfer.to) return "الانتقال الرسمي يحتاج النادي الجديد";
  }
  return "";
}
async function saveEditor(status, btn){
  const a = ED.a;
  /* اقرأ آخر ما في الفقرات (لو لم يُطلق حدث input) */
  document.querySelectorAll("#nwEditor .nwe-rt").forEach(el=>{ const b = a.body[+el.closest("[data-bi]").dataset.bi]; if(b) b.h = readRT(el); });
  const err = validate(a, status==="published"); if(err){ say(err, "err"); return; }
  const out = clone(a);
  out.title = out.title.trim(); out.sub = (out.sub||"").trim(); out.author = (out.author||"").trim();
  out.body = out.body.map(b=>{ if(b.k==="ul") b.items = (b.items||[]).map(s=>s.trim()).filter(Boolean); return b; })
    .filter(b=>(b.k==="p" && plain(b.h)) || (b.k==="h" && b.x) || (b.k==="q" && b.x) || (b.k==="ul" && b.items.length) || (b.k==="img" && b.id));
  if(out.cat!=="transfers") delete out.transfer;
  if(out.cat!=="matches") delete out.match;
  out.status = status;
  if(status==="published" && !out.pub) out.pub = nowISO();
  const btns = document.querySelectorAll("#nwEditor .nwe-save button, #nwEditor .nwe-side .nwa-b"); btns.forEach(x=>x.disabled = true);
  if(btn) btn.textContent = "جارٍ الحفظ…";
  try{
    /* الصور الجديدة أولاً (كل صورة ونسختها المصغّرة)، ثم المقال والفهرس */
    const ids = imagesOf(out).filter(id=>pending[id]);
    for(const id of ids){ await store.putImage(id, pending[id], 0, 0); if(pending[id+"_t"]) await store.putImage(id+"_t", pending[id+"_t"], 0, 0);
      IMG_CACHE[id] = pending[id]; IMG_CACHE[id+"_t"] = pending[id+"_t"]; }
    await persist(out);
    /* صور أُزيلت أو استُبدلت */
    if(ED.orig){ const keep = new Set(imagesOf(out)); await Promise.all(imagesOf(ED.orig).filter(id=>!keep.has(id)).map(id=>store.delImage(id).catch(()=>{}))); }
    ids.forEach(id=>{ delete pending[id]; delete pending[id+"_t"]; });
    say(status==="published" ? (a.status==="published" ? "حُفظت التعديلات" : "نُشر الخبر") : status==="draft" ? "حُفظ كمسودة" : "أُلغي النشر", "ok");
    ED.dirty = false; closeEditor(true);
  }catch(x){
    console.error(x); say("تعذّر الحفظ: "+errMsg(x), "err");
    btns.forEach(b=>b.disabled = false); if(btn) btn.textContent = "إعادة المحاولة";
  }
}
document.addEventListener("click", e=>{
  if(!ED || !e.target.closest) return;
  const o = e.target.closest("#nwEditor"); if(!o) return;
  const rt = e.target.closest("[data-rt]");
  if(rt){ e.preventDefault(); const k = rt.dataset.rt;
    const ed = rt.closest(".nwe-blk").querySelector(".nwe-rt"); ed.focus();
    if(k==="link"){ const u = prompt("رابط (يبدأ بـ https://)", "https://"); if(u && /^https?:\/\/\S+$/i.test(u)) document.execCommand("createLink", false, u); }
    else if(k==="clear") document.execCommand("removeFormat");
    else document.execCommand(k);
    ED.a.body[+ed.closest("[data-bi]").dataset.bi].h = readRT(ed); setDirty(); return; }
  const eb = e.target.closest("[data-eb]");
  if(eb){ const i = +eb.closest("[data-bi]").dataset.bi, B = ED.a.body;
    if(eb.dataset.eb==="rm"){ const b = B[i]; const has = (b.k==="p" && plain(b.h)) || b.x || b.id || (b.items||[]).length; if(has && !confirm("حذف هذه الكتلة؟")) return; B.splice(i, 1); if(!B.length) B.push({k:"p", h:""}); }
    else if(eb.dataset.eb==="up" && i>0) [B[i-1], B[i]] = [B[i], B[i-1]];
    else if(eb.dataset.eb==="down" && i<B.length-1) [B[i+1], B[i]] = [B[i], B[i+1]];
    setDirty(); paintEditor(true); return; }
  const ea = e.target.closest("[data-ea]"); if(!ea) return;
  const k = ea.dataset.ea, a = ED.a;
  if(k==="close"){ closeEditor(); return; }
  if(k==="mode-edit" || k==="mode-prev"){ document.querySelectorAll("#nwEditor .nwe-rt").forEach(el=>{ const b = a.body[+el.closest("[data-bi]").dataset.bi]; if(b) b.h = readRT(el); });
    ED.view = k==="mode-prev" ? "preview" : "edit"; paintEditor(); o.scrollTop = 0; return; }
  if(k.startsWith("add-")){ const t = k.slice(4); a.body.push(t==="p" ? {k:"p", h:""} : t==="ul" ? {k:"ul", items:[], ol:false} : t==="img" ? {k:"img", id:"", cap:"", alt:""} : {k:t, x:""});
    setDirty(); paintEditor(true); const last = o.querySelector(".nwe-blk:last-child"); if(last){ last.scrollIntoView({block:"center"}); const f = last.querySelector(".nwe-rt,input:not([type=file]),textarea"); if(f) f.focus(); if(t==="img"){ const fi = last.querySelector("input[type=file]"); if(fi) fi.click(); } } return; }
  if(k==="rmcover"){ a.cover = null; a.coverCap = ""; setDirty(); paintEditor(true); return; }
  if(k==="draft") return saveEditor("draft", ea);
  if(k==="publish") return saveEditor("published", ea);
  if(k==="update") return saveEditor("published", ea);
  if(k==="unpublish"){ if(confirm("إلغاء نشر الخبر؟ يختفي من الموقع ويبقى في اللوحة.")) return saveEditor("unpublished", ea); }
});

/* ───────────── ربط الموقع ───────────── */
function injectAdmin(){
  const v = document.getElementById("v-admin"); if(!v || document.getElementById("newsAdmin") || !canManage()) return;
  if(!TEST && !document.getElementById("matchAdmin")) return;   /* شاشة الدخول: لا شيء */
  const w = document.createElement("div"); w.innerHTML = adminHTML(); const el = w.firstElementChild; v.appendChild(el); hydrateImgs(el);
}
function hookSite(){
  const nav = document.querySelector("nav.tabs");
  if(nav && !nav.querySelector('[data-v="news"]')){
    const b = document.createElement("button"); b.setAttribute("role","tab"); b.dataset.v = "news"; b.setAttribute("aria-selected","false");
    b.innerHTML = `<svg class="ic" aria-hidden="true" width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4.5h11.5v15H6.5A1.5 1.5 0 0 1 5 18z"/><path d="M16.5 8.5H19v9.5a1.5 1.5 0 0 1-3 0"/><path d="M8 8h5.5M8 11.5h5.5M8 15h3.5"/></svg><span>الأخبار</span>`;
    const g = nav.querySelector('[data-v="matches"]'); if(g) g.after(b); else nav.appendChild(b);
    b.addEventListener("click", ()=>{ if(typeof go==="function") go("news"); });
  }
  if(!document.getElementById("v-news")){ const s = document.createElement("section"); s.className = "view"; s.id = "v-news";
    const a = document.getElementById("v-matches"); (a?a.parentNode:document.querySelector("main")||document.body).insertBefore(s, a?a.nextSibling:null); }
  if(typeof RENDER==="object" && RENDER) RENDER.news = ()=>{ const h = location.hash; if(/^#news/.test(h)) apply(parse(h)); else history.replaceState(null, "", hashOf()); render(); };
}
/* يُربط فور تنفيذ الملف (قبل نهاية إقلاع الموقع) — لو انتظر boot قد تسبق goStart الأخيرة ربطه فيُفتح الرابط على الرئيسية */
function hookNav(){
  /* مغادرة الأخبار إلى قسم آخر: نزيل #news من الرابط فلا يعيد «رجوع» المتصفح فتحها خطأً */
  const g0 = window.go;
  if(typeof g0==="function" && !g0.__news){
    const w = function(v){ if(v!=="news" && /^#news/.test(location.hash)){ history.replaceState(null, "", location.pathname + location.search); NV.inApp = 0; } return g0.apply(this, arguments); };
    w.__news = true; Object.keys(g0).forEach(k=>{ try{ w[k] = g0[k]; }catch(e){} });
    try{ window.go = w; }catch(e){} try{ go = w; }catch(e){}
  }
  /* رابط مباشر #news/... يفتح الأخبار بعد الإقلاع بدل الرئيسية */
  const gs = window.goStart;
  if(typeof gs==="function" && !gs.__news){
    const w = function(){ if(/^#news/.test(location.hash)){ hookSite(); apply(parse(location.hash)); return go("news"); } return gs.apply(this, arguments); };
    w.__news = true; try{ window.goStart = w; }catch(e){} try{ goStart = w; }catch(e){}
  }
  if(/^#news/.test(location.hash)) apply(parse(location.hash));
}
hookNav();
function hookAdmin(){
  ["renderAdmin","renderEditorAdmin"].forEach(n=>{ const f = window[n]; if(typeof f!=="function" || f.__newsadm) return;
    const w = function(){ const r = f.apply(this, arguments);
      try{ injectAdmin(); if(window.ADMIN_TABS){ const v = document.getElementById("v-admin"); if(v && v.querySelector(".adm-tabs")){ v.querySelector(".adm-tabs").remove(); v.querySelectorAll(".adm-panel").forEach(p=>{ while(p.firstChild) v.insertBefore(p.firstChild, p); p.remove(); }); ADMIN_TABS.organize(); } } }catch(e){ console.error(e); }
      return r; };
    w.__newsadm = true; Object.keys(f).forEach(k=>{ try{ w[k] = f[k]; }catch(e){} });
    try{ window[n] = w; }catch(e){} try{ if(n==="renderAdmin") renderAdmin = w; else renderEditorAdmin = w; }catch(e){}
  });
  if(typeof RENDER==="object" && RENDER) RENDER.admin = window.renderAdmin;
}
/* وضع الاختبار: لوحة الأخبار وحدها في صفحة الإدارة بلا تسجيل دخول */
function testAdmin(){
  if(!TEST) return;
  NW.openAdmin = () => { if(typeof go==="function") go("admin"); setTimeout(()=>{ const v = document.getElementById("v-admin"); if(v && !document.getElementById("newsAdmin")){ v.innerHTML = ""; injectAdmin(); } }, 50); };
}
function boot(){
  hookSite(); hookNav(); hookAdmin(); testAdmin();
  /* الإقلاع انتهى قبل الربط؟ رابط #news يفتح القسم مباشرة */
  if(/^#news/.test(location.hash) && !isOn() && typeof go==="function") setTimeout(()=>{ if(/^#news/.test(location.hash) && !isOn()) go("news"); }, 0);
  store.watchIndex(d=>{ IDX = d || {items:[]}; if(isOn() && NV.r!=="art") render(); });
}
NW._t = {store, NV, AD, open, compress, cleanHTML, parse, get IDX(){ return IDX; }, TEST};
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", ()=>setTimeout(boot, 40)); else setTimeout(boot, 40);
})();
