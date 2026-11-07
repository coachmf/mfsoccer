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
async function put(at, pid, token, topics){
  if(!okTok(token)) return false;
  const k = keyOf(token);
  const p = [...new Set((topics||[]).filter(s => typeof s === 'string' && s.length <= 40))].slice(0, 120);
  const fields = p.length ? { m:{ mapValue:{ fields:{ [k]:{ mapValue:{ fields:{
      t:{ stringValue: token }, p:{ arrayValue:{ values: p.map(s => ({ stringValue: s })) } }, a:{ integerValue: String(day()) } } } } } } } } : {};
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
      list.push({ t: f.t.stringValue, p });
    });
  });
  cache = { at: Date.now(), list };
  return list;
}

/* أسماء المواضيع داخل شرط FCM ('a' in topics || 'b' in topics) */
const namesOf = c => [...String(c||'').matchAll(/'([^']+)' in topics/g)].map(x => x[1]);

module.exports = { put, del, all, namesOf, okTok, keyOf, shardOf };
