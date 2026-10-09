/* لقطة الفانتسي من CDN — مستند اللعبة + اللاعبون + الجولات في JSON واحد مضغوط (~80 ك.ب) بدل ~1.3 م.ب عبر قناة Firestore.
   يوم ديدلاين الجولة 4 (2026-10-09) علِق مشتركون على شبكات الجوال على «تعذّر الاتصال بالخادم» لأن التحميل الأول تجاوز المهلة.
   الصفحة ترسم من هذه اللقطة فوراً، ثم تتحقق من Firestore في الخلفية (تحديث حيّ). يُحدَّث من Firestore مرة كل 30 ثانية على الأكثر.
   الاستخدام: /api/fantasy/2026-2027 */
'use strict';
const { accessToken } = require('./lib/google');

const PROJECT = 'mfsoccer-c7ee4';
const API_KEY = 'AIzaSyD_ZzAE4HEKPIuAKCmta8tzN5KOa8IUfuo';   /* نفس المفتاح العام في الصفحة */
const ALLOWED = /^\d{4}-\d{4}$/;

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
  if('referenceValue' in v) return v.referenceValue;
  if('geoPointValue'  in v) return v.geoPointValue;
  if('bytesValue'     in v) return v.bytesValue;
  return null;
}
function fields(f){ const o = {}; for(const k in (f || {})) o[k] = val(f[k]); return o; }

let token = null;
async function get(url){
  let r = await fetch(url + (url.includes('?') ? '&' : '?') + 'key=' + API_KEY);
  if(r.status === 429 || r.status === 403){
    try{
      token = token || await accessToken('https://www.googleapis.com/auth/datastore');
      r = await fetch(url, { headers:{ Authorization:'Bearer '+token } });
    }catch(e){}
  }
  return r;
}

exports.handler = async (event) => {
  const id = String((event.path || '').split('/').pop() || '');
  const json = { 'Content-Type':'application/json; charset=utf-8', 'Access-Control-Allow-Origin':'*' };
  const fail = (code, body) => ({ statusCode:code, headers:{...json, 'Cache-Control':'no-store'}, body: JSON.stringify(body) });
  if(!ALLOWED.test(id)) return fail(400, {err:'bad id'});
  const base = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/fantasy/${id}`;
  try{
    const [rg, rp, rr] = await Promise.all([get(base), get(base + '/meta/players'), get(base + '/rounds?pageSize=300')]);
    if(rg.status === 404) return { statusCode:404, headers:{...json, 'Cache-Control':'public, max-age=30'}, body:'null' };
    if(!rg.ok || !rp.ok || !rr.ok) return fail(502, {err:[rg.status, rp.status, rr.status]});
    const game = fields((await rg.json()).fields);
    const pv = fields((await rp.json()).fields);
    const rj = await rr.json();
    if(rj.nextPageToken) return fail(502, {err:'rounds paged'});   /* أكثر من 300 جولة؟ نرجع لـFirestore */
    const rounds = {};
    (rj.documents || []).forEach(d => { rounds[d.name.split('/').pop()] = fields(d.fields); });
    return {
      statusCode: 200,
      headers: {
        ...json,
        'Cache-Control': 'public, max-age=0, must-revalidate',
        'Netlify-CDN-Cache-Control': 'public, durable, s-maxage=30, stale-while-revalidate=120',
      },
      body: JSON.stringify({ at: new Date().toISOString(), game, players: { list: pv.list || [], priceVer: +pv.priceVer || 0 }, rounds }),
    };
  }catch(e){ return fail(502, {err:String(e.message||e)}); }
};
