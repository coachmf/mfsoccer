/* تشكيلات كل المشتركين من CDN — للترتيب الحي والمتوسط أثناء الجولة (2026-10-09).
   كان الترتيب الحي يعتمد على جهاز مدير يقرأ كل المشتركين وينشر meta/live؛ إن تعذّر Firestore على جهازه لا يرى أحد ترتيباً
   (ورأى المدير «1 / 1» من ذاكرة جهازه). الآن كل جهاز يحسب النقاط الحية بنفسه من هذه اللقطة (محرك النقاط نفسه).
   حساب الخدمة (لا حصة المفتاح العام)، الحقول اللازمة للحساب فقط (بلا transfers)، CDN دقيقتان.
   الاستخدام: /api/fantasy-teams/2026-2027 */
'use strict';
const { accessToken } = require('./lib/google');

const PROJECT = 'mfsoccer-c7ee4';
const API_KEY = 'AIzaSyD_ZzAE4HEKPIuAKCmta8tzN5KOa8IUfuo';
const ALLOWED = /^\d{4}-\d{4}$/;
const DROP = new Set(['transfers', 'fhBackup', 'repairedAt', 'bankBase', 'bankVer', 'history']);

function val(v){
  if(!v || typeof v !== 'object') return null;
  if('stringValue'  in v) return v.stringValue;
  if('integerValue' in v) return Number(v.integerValue);
  if('doubleValue'  in v) return Number(v.doubleValue);
  if('booleanValue' in v) return v.booleanValue;
  if('nullValue'    in v) return null;
  if('timestampValue' in v) return v.timestampValue;
  if('mapValue'     in v) return fields(v.mapValue.fields);
  if('arrayValue'   in v) return (v.arrayValue.values || []).map(val);
  return null;
}
function fields(f){ const o = {}; for(const k in (f || {})) o[k] = val(f[k]); return o; }

exports.handler = async (event) => {
  const id = String((event.path || '').split('/').pop() || '');
  const json = { 'Content-Type':'application/json; charset=utf-8', 'Access-Control-Allow-Origin':'*' };
  const fail = (c, b) => ({ statusCode:c, headers:{...json, 'Cache-Control':'no-store'}, body:JSON.stringify(b) });
  if(!ALLOWED.test(id)) return fail(400, {err:'bad id'});
  const base = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/fantasy/${id}/managers`;
  try{
    let auth = {};
    try{ auth = { Authorization:'Bearer ' + await accessToken('https://www.googleapis.com/auth/datastore') }; }catch(e){}
    const mask = ['username','teamName','total','team','joinedGW'].map(f => 'mask.fieldPaths=' + f).join('&');
    /* الجولة الحالية: من انضم بعد موعدها (joinedGW > الجولة) لا يدخل متوسطها ولا ترتيبها — 69eb4cb */
    let cur = 0;
    try{ const g = await fetch(base.replace(/\/managers$/, '') + '?mask.fieldPaths=currentGW' + (auth.Authorization ? '' : '&key=' + API_KEY), { headers:auth });
      if(g.ok) cur = +((fields((await g.json()).fields) || {}).currentGW) || 0; }catch(e){}
    let tok = '', docs = [], pages = 0;
    do{
      const url = `${base}?pageSize=300&${mask}` + (tok ? '&pageToken=' + encodeURIComponent(tok) : '') + (auth.Authorization ? '' : '&key=' + API_KEY);
      const r = await fetch(url, { headers:auth });
      if(!r.ok) return fail(502, {err:'list ' + r.status});
      const j = await r.json(); docs = docs.concat(j.documents || []); tok = j.nextPageToken; pages++;
    }while(tok && pages < 30);
    const rows = [];
    for(const d of docs){
      const v = fields(d.fields); const t = v.team;
      if(!t || !Array.isArray(t.squad) || !t.squad.length) continue;
      if(cur && (+v.joinedGW || 0) > cur) continue;
      const team = {}; for(const k in t) if(!DROP.has(k)) team[k] = t[k];
      rows.push({ id:d.name.split('/').pop(), name:v.username || 'مشترك', teamName:v.teamName || '', total:+v.total || 0, team });
    }
    return { statusCode:200, headers:{ ...json, 'Cache-Control':'public, max-age=0, must-revalidate',
        'Netlify-CDN-Cache-Control':'public, durable, s-maxage=120, stale-while-revalidate=300' },
      body: JSON.stringify({ at:new Date().toISOString(), gw:cur, count:rows.length, rows }) };
  }catch(e){ return fail(502, {err:String(e.message||e)}); }
};
