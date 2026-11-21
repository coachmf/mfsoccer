/* حفظ مباراة عبر الخادم (منصور 2026-11-21 «نبي حل جذري… التعليق والانترنت بطيء»).
   كان كل حفظ من جوال المحرّر معاملة Firestore تنزّل وثيقة الموسم كاملة (~310 ك.ب) وترفعها، عبر قناة long-polling في تطبيق iOS،
   ومع محرّرَين يحفظان معاً يعيدها Firestore فتتجاوز 25 ث — «الاتصال بطيء — لم يُحفظ» والمحرر عالق.
   الآن: الجوال يدمج مباراته كما كان (mergeEdit/applyEdit) ويرسل شريحة المباراة فقط (بضعة ك.ب). هنا بحساب الخدمة:
   قراءة الوثيقة ← applySlice ← كتابة مشروطة بـ updateTime (لا تمحو حفظ محرر آخر) ← عند التعارض إعادة من الخادم نفسه بأجزاء من الثانية.
   POST {idToken, orig, slice, squads, by} → {ok, updated, updatedBy, tries}. للمالك أو «محرر» فعّال في seasons/staff. */
'use strict';
const { accessToken, verifyIdToken } = require('./lib/google');
const { applySlice } = require('./lib/matchsave');

const PROJECT = 'mfsoccer-c7ee4';
const SEASON = '2026-2027';
const OWNER_UID = 'iiTgVfDryXNLb9IrOyLkkNMHDxq2';
const DOCS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const H = { 'Content-Type':'application/json; charset=utf-8', 'Access-Control-Allow-Origin':'https://mfsoccer.com',
  'Access-Control-Allow-Headers':'Content-Type', 'Access-Control-Allow-Methods':'POST, OPTIONS', 'Cache-Control':'no-store' };
const out = (code, body) => ({ statusCode:code, headers:H, body:JSON.stringify(body) });

function val(v){
  if(!v || typeof v !== 'object') return null;
  if('stringValue'  in v) return v.stringValue;
  if('integerValue' in v) return Number(v.integerValue);
  if('doubleValue'  in v) return Number(v.doubleValue);
  if('booleanValue' in v) return v.booleanValue;
  if('timestampValue' in v) return v.timestampValue;
  if('nullValue'    in v) return null;
  if('mapValue'     in v){ const o = {}; const f = v.mapValue.fields || {}; for(const k in f) o[k] = val(f[k]); return o; }
  if('arrayValue'   in v) return (v.arrayValue.values || []).map(val);
  return null;
}
function enc(x){
  if(x === null || x === undefined) return { nullValue:null };
  if(typeof x === 'boolean') return { booleanValue:x };
  if(typeof x === 'number') return Number.isInteger(x) ? { integerValue:String(x) } : { doubleValue:x };
  if(typeof x === 'string') return { stringValue:x };
  if(Array.isArray(x)) return { arrayValue:{ values:x.map(enc) } };
  if(typeof x === 'object'){ const f = {}; for(const k in x) if(x[k] !== undefined) f[k] = enc(x[k]); return { mapValue:{ fields:f } }; }
  return { nullValue:null };
}
/* النوع الأصلي للأرقام يُحفظ كما هو: Firestore يميّز integer/double، و enc يكتب الصحيح integer — مثل SDK المتصفح */

exports.handler = async (event) => {
  if(event.httpMethod === 'OPTIONS') return { statusCode:204, headers:H, body:'' };
  if(event.httpMethod !== 'POST') return out(405, { ok:false, err:'POST فقط' });
  let b; try{ b = JSON.parse(event.body || '{}'); }catch(e){ return out(400, { ok:false, err:'bad-body' }); }
  let uid; try{ uid = await verifyIdToken(b.idToken, PROJECT); }catch(e){ return out(401, { ok:false, err:'auth' }); }
  if(!b.slice || !b.slice.match) return out(400, { ok:false, err:'no-slice' });
  const t0 = Date.now();
  try{
    const at = await accessToken('https://www.googleapis.com/auth/datastore');
    const auth = { Authorization:'Bearer ' + at };
    let by = typeof b.by === 'string' ? b.by.slice(0, 120) : '';
    if(uid !== OWNER_UID){
      const s = await fetch(`${DOCS}/seasons/staff`, { headers:auth });
      const members = s.ok ? (val({ mapValue:{ fields:(await s.json()).fields || {} } }).members || {}) : {};
      const me = members[uid];
      if(!(me && me.role === 'editor' && me.active !== false)) return out(403, { ok:false, err:'editor' });
    }
    for(let tries = 1; tries <= 8; tries++){
      const r = await fetch(`${DOCS}/seasons/${SEASON}`, { headers:auth });
      if(!r.ok) return out(502, { ok:false, err:'read ' + r.status });
      const doc = await r.json();
      const d = val({ mapValue:{ fields:doc.fields || {} } });
      const prev = (d.updated || '') + '|' + (d.updatedBy || '');
      applySlice(d, { orig: b.orig || null, slice: b.slice, squads: b.squads || null });
      d.updated = new Date().toISOString(); d.updatedBy = by;
      const fields = {}; for(const k in d) if(d[k] !== undefined) fields[k] = enc(d[k]);
      const w = await fetch(`${DOCS}/seasons/${SEASON}?currentDocument.updateTime=${encodeURIComponent(doc.updateTime)}`,
        { method:'PATCH', headers:{ ...auth, 'Content-Type':'application/json' }, body: JSON.stringify({ fields }) });
      if(w.ok){
        /* نبضة الزوار: شريحة المباراة فقط + طابع النسخة التي بُنيت عليها (انظر watchPulse في index.html) */
        const pulse = { updated:d.updated, updatedBy:by, prev, kind:'slice', orig:b.orig || null, slice:b.slice, squads:b.squads || null };
        const pf = {}; for(const k in pulse) pf[k] = enc(pulse[k]);
        let pulsed = false;
        try{ const pw = await fetch(`${DOCS}/seasons/pulse-${SEASON}`, { method:'PATCH', headers:{ ...auth, 'Content-Type':'application/json' }, body: JSON.stringify({ fields:pf }) }); pulsed = pw.ok; }catch(e){}
        return out(200, { ok:true, updated:d.updated, updatedBy:by, tries, pulsed, ms: Date.now() - t0 });
      }
      if(w.status === 400 || w.status === 409 || w.status === 412){   /* وثيقة تغيّرت بعد قراءتنا (FAILED_PRECONDITION) — نعيد */
        const tx = (await w.text()).slice(0, 200);
        if(!/FAILED_PRECONDITION|precondition|ABORTED|updateTime/i.test(tx)) return out(502, { ok:false, err:'write ' + w.status + ' ' + tx });
        await new Promise(res => setTimeout(res, 40 + Math.random() * 120 * tries)); continue;
      }
      return out(502, { ok:false, err:'write ' + w.status + ' ' + (await w.text()).slice(0, 160) });
    }
    return out(409, { ok:false, err:'busy' });
  }catch(e){ return out(502, { ok:false, err:String(e.message || e).slice(0, 160) }); }
};
