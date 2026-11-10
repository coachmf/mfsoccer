/* =====================================================================
   حضور فريق العمل — لمركز التحليل الافتراضي (/center) — 2026-11-10

   كل عضو في فريق العمل (المالك أو محرّر مفعّل) يسجّل حالته في
   presence/<uid> = {email, name, section, at}
     section: "mon"  ← لوحة الإدارة مفتوحة (إدارة الرصد)
              "play" ← ساعة الوقت الفعلي للعب مفتوحة (اللعب الفعلي)
              null   ← خارجهما
     at: وقت الخادم — صفحة المركز تعتبر العضو «متصل» إذا وصلت نبضته
         خلال آخر 150 ثانية، فإغلاق المتصفح فجأة أو انقطاع النت يطفّيه وحده.

   الكتابة: فور تغيّر القسم، ثم نبضة كل 60 ثانية ما دام داخل قسم.
   خارج الأقسام لا يكتب شيئاً بعد تسجيل خروجه منها (لا هدر في حصة الكتابة).
   المشجعون ومن ليس في فريق العمل: لا يُكتب لهم أي شيء.
   القواعد: firestore.rules ← match /presence/{uid}
   ===================================================================== */
(function(){
"use strict";
const BEAT = 60e3;
let last = {uid:null, section:undefined, at:0};

const user  = () => (typeof FBUSER !== "undefined" ? FBUSER : null);
const staff = () => (typeof isAdmin !== "undefined" && isAdmin === true);
const db    = () => (typeof fbDb !== "undefined" ? fbDb : null);

function section(){
  if(!user() || !staff()) return null;
  if(window.EFFTIME && EFFTIME.isOpen && EFFTIME.isOpen()) return "play";
  const v = document.querySelector('nav.tabs button[aria-selected="true"]');
  if(v && v.dataset.v === "admin" && !document.querySelector("#v-admin #loginBtn")) return "mon";
  return null;
}

function write(sec, force){
  const u = user(), d = db();
  if(!u || !d || typeof firebase === "undefined") return;
  if(!staff()){ last = {uid:u.uid, section:null, at:0}; return; }
  const now = Date.now(), same = last.uid === u.uid && last.section === sec;
  if(!force && same && (sec === null || now - last.at < BEAT)) return;
  last = {uid:u.uid, section:sec, at:now};
  let name = "";
  try{ name = (typeof STAFF !== "undefined" && STAFF[u.uid] && STAFF[u.uid].name) || u.displayName || ""; }catch(e){}
  d.collection("presence").doc(u.uid).set({
    email: String(u.email || "").toLowerCase(),
    name: String(name).slice(0, 80),
    section: sec,
    at: firebase.firestore.FieldValue.serverTimestamp()
  }).catch(() => { last.at = 0; });
}

const tick = () => { try{ write(section(), false); }catch(e){} };
let deb = null;
const soon = () => { clearTimeout(deb); deb = setTimeout(tick, 700); };

setInterval(tick, 15e3);
document.addEventListener("click", soon, true);
window.addEventListener("hashchange", soon);
document.addEventListener("visibilitychange", soon);
/* الخروج من الصفحة: محاولة أخيرة لإطفاء المكتب فوراً (وإن فشلت تنطفي بعد 150 ثانية) */
window.addEventListener("pagehide", () => { try{ if(last.section) write(null, true); }catch(e){} });
setTimeout(tick, 3000);
})();
