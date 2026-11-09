/* Firestore عبر REST بحساب الخدمة — قراءة/قائمة/التزام بشروط (للأتمتة الخلفية للفانتسي، تدقيق 2026-11-09).
   io = makeIO(token) أو makeIO(null, apiKey) للقراءة العامة فقط (اختبار محلي بلا كتابة). */
'use strict';
const PROJECT = 'mfsoccer-c7ee4';
const ROOT = `projects/${PROJECT}/databases/(default)/documents`;
const BASE = `https://firestore.googleapis.com/v1/${ROOT}`;

function val(v){
  if(!v || typeof v !== 'object') return null;
  if('stringValue'  in v) return v.stringValue;
  if('integerValue' in v) return Number(v.integerValue);
  if('doubleValue'  in v) return Number(v.doubleValue);
  if('booleanValue' in v) return v.booleanValue;
  if('nullValue'    in v) return null;
  if('timestampValue' in v) return v.timestampValue;
  if('bytesValue'   in v) return v.bytesValue;   /* base64 */
  if('mapValue'     in v) return fields(v.mapValue.fields);
  if('arrayValue'   in v) return (v.arrayValue.values || []).map(val);
  return null;
}
function fields(f){ const o = {}; for(const k in (f || {})) o[k] = val(f[k]); return o; }
/* {__ts: iso} = طابع زمني Firestore (موعد القفل تقارنه القواعد بـrequest.time) */
function enc(x){
  if(x === null || x === undefined) return { nullValue:null };
  if(typeof x === 'boolean') return { booleanValue:x };
  if(typeof x === 'number') return Number.isInteger(x) ? { integerValue:String(x) } : { doubleValue:x };
  if(typeof x === 'string') return { stringValue:x };
  if(Array.isArray(x)) return { arrayValue:{ values:x.map(v => enc(v === undefined ? null : v)) } };
  if(typeof x === 'object'){
    if(x.__ts) return { timestampValue: x.__ts };
    if(x.__bytes) return { bytesValue: x.__bytes };
    const f = {}; for(const k in x) if(x[k] !== undefined) f[k] = enc(x[k]); return { mapValue:{ fields:f } };
  }
  return { nullValue:null };
}

function makeIO(token, apiKey){
  const H = token ? { Authorization:'Bearer ' + token } : {};
  const q = apiKey ? `key=${apiKey}` : '';
  const url = (p, extra) => `${BASE}/${p}${[q, extra].filter(Boolean).length ? '?' + [q, extra].filter(Boolean).join('&') : ''}`;
  const io = {
    writes: 0, reads: 0,
    async get(p){
      const r = await fetch(url(p), { headers:H }); io.reads++;
      if(r.status === 404) return null;
      if(!r.ok) throw new Error(`get ${p} ${r.status}`);
      const d = await r.json(); return { data: fields(d.fields), updateTime: d.updateTime, id: d.name.split('/').pop() };
    },
    async list(coll, pageSize){
      const out = []; let tok = '';
      for(let i = 0; i < 40; i++){
        const r = await fetch(url(coll, `pageSize=${pageSize||300}` + (tok ? `&pageToken=${encodeURIComponent(tok)}` : '')), { headers:H });
        if(!r.ok) throw new Error(`list ${coll} ${r.status}`);
        const d = await r.json(); io.reads += (d.documents || []).length;
        (d.documents || []).forEach(x => out.push({ id: x.name.split('/').pop(), data: fields(x.fields), updateTime: x.updateTime }));
        if(!d.nextPageToken) return out; tok = d.nextPageToken;
      }
      throw new Error('list too long');
    },
    /* معرّفات المستندات فقط (بلا حقول) — لمجموعات مستنداتها كبيرة */
    async ids(coll, field){
      const out = []; let tok = '';
      for(let i = 0; i < 40; i++){
        const r = await fetch(url(coll, 'pageSize=300&mask.fieldPaths=' + (field || 'day') + (tok ? `&pageToken=${encodeURIComponent(tok)}` : '')), { headers:H });
        if(!r.ok) throw new Error(`ids ${coll} ${r.status}`);
        const d = await r.json(); (d.documents || []).forEach(x => out.push(x.name.split('/').pop()));
        if(!d.nextPageToken) return out; tok = d.nextPageToken;
      }
      return out;
    },
    /* writes: [{path, data, mask?:[fieldPaths] (افتراضي: مفاتيح data), merge?:true, updateTime?, exists?}] — دفعة واحدة ذرّية */
    async commit(writes){
      if(!token) throw new Error('read-only io');
      const body = { writes: writes.map(w => {
        if(w.delete) return { delete: `${ROOT}/${w.path}` };
        const o = { update: { name: `${ROOT}/${w.path}`, fields: enc(w.data).mapValue.fields } };
        if(w.mask !== false) o.updateMask = { fieldPaths: (w.mask || Object.keys(w.data)).map(k => k.split('.').map(s => /^[A-Za-z_][A-Za-z0-9_]*$/.test(s) ? s : '`' + s + '`').join('.')) };
        if(w.updateTime) o.currentDocument = { updateTime: w.updateTime };
        else if(w.exists !== undefined) o.currentDocument = { exists: w.exists };
        if(w.deleteFields && w.deleteFields.length){ o.updateMask = o.updateMask || { fieldPaths: [] }; o.updateMask.fieldPaths.push(...w.deleteFields); }
        return o; }) };
      const r = await fetch(`${BASE}:commit`, { method:'POST', headers:{ ...H, 'Content-Type':'application/json' }, body: JSON.stringify(body) });
      if(!r.ok){ const t = await r.text().catch(() => ''); const e = new Error(`commit ${r.status} ${t.slice(0, 300)}`); e.status = r.status; e.precondition = /FAILED_PRECONDITION/.test(t); throw e; }
      io.writes += writes.length;
      return r.json();
    },
  };
  return io;
}

module.exports = { makeIO, val, fields, enc, PROJECT, BASE };
