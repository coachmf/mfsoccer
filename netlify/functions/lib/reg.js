/* سجل أجهزة الويب للإرسال المباشر (منصور 2026-11-07: «الاشعار… بعدها ب دقيقه يطلع للناس… سوه بس ما ياخذ وايد مساحه»).
   مواضيع FCM تُوزَّع ببطء (مصممة للأعداد لا للسرعة)، فنرسل لرمز كل جهاز مباشرة أيضاً.
   التخزين مضغوط: 8 مستندات فقط pushreg/s0..s7، في كل منها خريطة m: { k<بصمة>: {t:رمز, p:[مواضيع], a:يوم آخر تحديث} }.
   ~300 بايت للجهاز ← 3000 جهاز في المستند الواحد قبل حد 1MB، وقراءة 8 مستندات لكل إرسال (مع ذاكرة 30 ث). */
'use strict';
const { h } = require('./topics');
const SH = 8;
const shardOf = t => parseInt(h(t), 36) % SH;
const keyOf = t => 'k' + h(t) + h(t.slice(-48));
const okTok = t => typeof t === 'string' && t.length >= 100 && t.length <= 4096 && !/[^\w:.\-]/.test(t);
const base = pid => `https://firestore.googleapis.com/v1/projects/${pid}/databases/(default)/documents/pushreg`;
const day = () => Math.floor(Date.now() / 864e5);

/* يضيف الجهاز أو يحدّث مواضيعه (topics فارغة = حذف) — كتابة حقل واحد داخل الخريطة، لا قراءة قبلها */
async function put(at, pid, token, topics, app){
  if(!okTok(token)) return false;
  const k = keyOf(token);
  const p = [...new Set((topics||[]).filter(s => typeof s === 'string' && s.length <= 40))].slice(0, 120);
  const fields = p.length ? { m:{ mapValue:{ fields:{ [k]:{ mapValue:{ fields:{
      t:{ stringValue: token }, p:{ arrayValue:{ values: p.map(s => ({ stringValue: s })) } }, a:{ integerValue: String(day()) },
      ...(app ? { x:{ booleanValue: true } } : {}) } } } } } } } : {};
  const r = await fetch(`${base(pid)}/s${shardOf(token)}?updateMask.fieldPaths=m.${k}`, { method:'PATCH',
    headers:{ Authorization:'Bearer '+at, 'Content-Type':'application/json' }, body: JSON.stringify({ fields }) });
  cache.at = 0;
  return r.ok;
}
const del = (at, pid, token) => put(at, pid, token, []);

/* كل الأجهزة [{t, p}] — ذاكرة 30 ث في النسخة الدافئة حتى لا تُقرأ المستندات مع كل إشعار في هجمة أحداث */
let cache = { at:0, list:null };
async function all(at, pid){
  if(cache.list && Date.now() - cache.at < 30000) return cache.list;
  const docs = await Promise.all(Array.from({ length:SH }, (_, i) =>
    fetch(`${base(pid)}/s${i}`, { headers:{ Authorization:'Bearer '+at } }).then(r => r.ok ? r.json() : null).catch(() => null)));
  const list = [];
  docs.forEach(d => {
    const m = d && d.fields && d.fields.m && d.fields.m.mapValue && d.fields.m.mapValue.fields;
    if(!m) return;
    Object.values(m).forEach(v => {
      const f = v.mapValue && v.mapValue.fields; if(!f || !f.t) return;
      const p = ((f.p && f.p.arrayValue && f.p.arrayValue.values) || []).map(x => x.stringValue);
      list.push({ t: f.t.stringValue, p, x: !!(f.x && f.x.booleanValue) });
    });
  });
  cache = { at: Date.now(), list };
  return list;
}

/* جهاز واحد من السجل (قراءة مستند واحد) */
async function get(at, pid, token){
  if(!okTok(token)) return null;
  const r = await fetch(`${base(pid)}/s${shardOf(token)}`, { headers:{ Authorization:'Bearer '+at } }).catch(() => null);
  if(!r || !r.ok) return null;
  const d = await r.json().catch(() => null);
  const f = d && d.fields && d.fields.m && d.fields.m.mapValue && d.fields.m.mapValue.fields && d.fields.m.mapValue.fields[keyOf(token)];
  const e = f && f.mapValue && f.mapValue.fields; if(!e || !e.t) return null;
  return { t: e.t.stringValue, p: ((e.p && e.p.arrayValue && e.p.arrayValue.values) || []).map(x => x.stringValue), x: !!(e.x && e.x.booleanValue) };
}

/* تقييم شرط FCM على مواضيع جهاز: 'a' in topics، &&، ||، !، أقواس — نفس صيغة lib/topics وpush-remind-cron */
function evalCond(cond, has){
  const toks = String(cond||'').match(/'[^']*'\s+in\s+topics|&&|\|\||!|\(|\)/g) || [];
  let i = 0;
  const prim = () => { const t = toks[i++];
    if(t === '!') return !prim();
    if(t === '('){ const v = or(); i++; return v; }
    const m = /^'([^']*)'/.exec(t || ''); return !!(m && has(m[1])); };
  const and = () => { let v = prim(); while(toks[i] === '&&'){ i++; const w = prim(); v = v && w; } return v; };
  const or = () => { let v = and(); while(toks[i] === '||'){ i++; const w = and(); v = v || w; } return v; };
  return toks.length ? or() : false;
}
const matches = (d, targets) => { const has = x => d.p.indexOf(x) >= 0;
  return targets.some(t => t.topic ? has(t.topic) : t.condition ? evalCond(t.condition, has) : false); };

/* إرسال مباشر لكل جهاز في السجل يطابق أحد الأهداف ({topic}|{condition}) — بالتوازي، والرموز الميتة تُحذف.
   message: كل حقول الرسالة عدا الهدف. only: تصفية إضافية (مثل أجهزة التطبيق وحدها) */
async function sendDirect(at, pid, targets, message, only){
  const out = { n:0, ok:0, gone:0 };
  const list = (await all(at, pid)).filter(d => (!only || only(d)) && matches(d, targets)).slice(0, 4000);
  out.n = list.length;
  const PAR = 64;
  for(let i = 0; i < list.length; i += PAR){
    await Promise.all(list.slice(i, i + PAR).map(async d => {
      try{
        const r = await fetch(`https://fcm.googleapis.com/v1/projects/${pid}/messages:send`, { method:'POST',
          headers:{ Authorization:'Bearer '+at, 'Content-Type':'application/json' },
          body: JSON.stringify({ message: Object.assign({ token: d.t }, message) }) });
        if(r.ok){ out.ok++; return; }
        if(r.status === 404 || r.status === 400){ const j = await r.json().catch(() => ({}));
          if(/UNREGISTERED|not a valid FCM/i.test(JSON.stringify(j))){ out.gone++; await del(at, pid, d.t).catch(() => {}); } }
      }catch(e){}
    }));
  }
  return out;
}

/* يُخرج رمزاً من كل مواضيع FCM (جهاز التطبيق صار على الإرسال المباشر وحده — لا تكرار) */
async function leaveAllTopics(at, token){
  try{
    const r = await fetch(`https://iid.googleapis.com/iid/info/${encodeURIComponent(token)}?details=true`, { headers:{ Authorization:'Bearer '+at, access_token_auth:'true' } });
    if(!r.ok) return 0;
    const j = await r.json().catch(() => ({}));
    const topics = Object.keys((j.rel && j.rel.topics) || {});
    await Promise.all(topics.map(t => fetch('https://iid.googleapis.com/iid/v1:batchRemove', { method:'POST',
      headers:{ Authorization:'Bearer '+at, access_token_auth:'true', 'Content-Type':'application/json' },
      body: JSON.stringify({ to:'/topics/'+t, registration_tokens:[token] }) }).catch(() => null)));
    return topics.length;
  }catch(e){ return 0; }
}

module.exports = { put, del, get, all, evalCond, matches, sendDirect, leaveAllTopics, okTok, keyOf, shardOf };
