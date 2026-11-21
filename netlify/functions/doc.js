/* لقطة عامة لوثيقة موسم أو وثيقة الصور — تُقرأ من CDN نتلفاي لا من Firestore مباشرة.
   مكتبة Firestore في التطبيق (WKWebView) تحتاج ثوانيَ لفتح قناتها قبل أول قراءة، وبلا
   نسخة محفوظة على الجهاز كان الموقع يرسم البيانات المضمّنة في الملف (الجولة 1) طوال
   تلك المدة — أو دائماً إن تعثّرت القناة. هذا المسار يعيد JSON عادياً مضغوطاً (~20 ك.ب
   للموسم) من ذاكرة CDN، ويُحدَّث من Firestore مرة كل دقيقة على الأكثر مهما كثر الزوار،
   فيوفّر قراءات أيضاً. التحديث الحيّ بعد الرسم يبقى على onSnapshot في الصفحة.
   الاستخدام: /api/doc/2026-2027 ، /api/doc/assets ، /api/doc/gulf27 */
'use strict';
const { accessToken } = require('./lib/google');

const PROJECT = 'mfsoccer-c7ee4';
const API_KEY = 'AIzaSyD_ZzAE4HEKPIuAKCmta8tzN5KOa8IUfuo';   /* نفس المفتاح العام في index.html */
const ALLOWED = /^(\d{4}-\d{4}|stamp~\d{4}-\d{4}|assets|assets-lite|fbonus~\d{4}-\d{4}|gulf27|div1|amateur|ext2627|news|effidx|eff_[0-9a-z]{1,8}|boards~\d{4}-\d{4}(_p\d{1,2})?)$/;   /* gulf27 = كأس الخليج 27، div1 = دوري الدرجة الأولى، news = فهرس الأخبار المنشورة، boards~… = ترتيب التوقعات وتوقعات الجولات (عامة) */

/* قيمة Firestore المُنمَّطة ← قيمة JSON عادية كما يعيدها SDK للصفحة */
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
function fields(f){
  const o = {};
  for(const k in (f || {})) o[k] = val(f[k]);
  return o;
}

async function readDoc(id){
  const [col, doc] = id.startsWith('boards~') ? ['boards', id.slice(7)] : ['seasons', id];
  const base = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${col}/${doc}`;
  let r = await fetch(`${base}?key=${API_KEY}`);
  /* المفتاح العام محدود الحصة (429) — نعيد المحاولة بحساب الخدمة إن كان مضبوطاً */
  if(r.status === 429 || r.status === 403){
    try{
      const at = await accessToken('https://www.googleapis.com/auth/datastore');
      r = await fetch(base, { headers:{ Authorization:'Bearer '+at } });
    }catch(e){ /* بلا حساب خدمة: نُرجع خطأ المحاولة الأولى */ }
  }
  return r;
}

/* الأداء (منصور 2026-11-21 «حسّن أداء التطبيق»):
   assets-lite = وثيقة الصور بلا PHOTOS (~500 ك.ب base64 لا تُعرض للزوار منذ 2026-09-15) — المالك يحمّل الكاملة.
   fbonus~<موسم> = بونص الفانتسي فقط من كل الجولات [{gw,h,a,b:[[club,name,pts]]}] بدل أن يحمّل كل زائر
   وثائق الجولات كاملة (~400 ك.ب، وتُعاد إليه مع كل تحديث نقاط أثناء المباريات). */
async function fantasyBonus(season){
  const base = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/fantasy/${season}/rounds?pageSize=300&mask.fieldPaths=fixtures`;
  let r = await fetch(`${base}&key=${API_KEY}`);
  if(r.status === 429 || r.status === 403){
    try{ const at = await accessToken('https://www.googleapis.com/auth/datastore'); r = await fetch(base, { headers:{ Authorization:'Bearer '+at } }); }catch(e){}
  }
  if(!r.ok) return { err:r.status };
  const rows = [];
  for(const d of ((await r.json()).documents || [])){
    const id = String(d.name).split('/').pop(), fx = val((d.fields || {}).fixtures) || [];
    for(const f of fx){
      if(!f || !Array.isArray(f.bonus) || !f.bonus.length) continue;
      rows.push({ gw: +(f.gw || id), h: f.h, a: f.a, b: f.bonus.filter(x => x && x.name && +x.pts > 0).map(x => [x.club, x.name, +x.pts]) });
    }
  }
  return { rows };
}

exports.handler = async (event) => {
  const id = String((event.path || '').split('/').pop() || (event.queryStringParameters||{}).id || '');
  const json = { 'Content-Type':'application/json; charset=utf-8', 'Access-Control-Allow-Origin':'*' };
  if(!ALLOWED.test(id)) return { statusCode:400, headers:{...json, 'Cache-Control':'no-store'}, body:'{"err":"bad id"}' };

  const cacheHdr = cdn => ({ ...json, 'Cache-Control':'public, max-age=0, must-revalidate', 'Netlify-CDN-Cache-Control':`public, durable, ${cdn}, stale-while-revalidate=86400` });
  try{
    if(id.startsWith('fbonus~')){
      const out = await fantasyBonus(id.slice(7));
      if(out.err) return { statusCode:502, headers:{...json, 'Cache-Control':'no-store'}, body: JSON.stringify(out) };
      return { statusCode:200, headers:cacheHdr('s-maxage=90'), body: JSON.stringify(out) };
    }
    /* stamp~<موسم> = طابع وثيقة الموسم فقط (بايتات) — شبكة أمان لزوار النبضة (watchPulse في index.html) */
    if(id.startsWith('stamp~')){
      const base = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/seasons/${id.slice(6)}?mask.fieldPaths=updated&mask.fieldPaths=updatedBy`;
      const rs = await fetch(`${base}&key=${API_KEY}`);
      if(!rs.ok) return { statusCode:502, headers:{...json, 'Cache-Control':'no-store'}, body: JSON.stringify({err:rs.status}) };
      return { statusCode:200, headers:{ ...json, 'Cache-Control':'public, max-age=0, must-revalidate', 'Netlify-CDN-Cache-Control':'public, durable, s-maxage=10' },
        body: JSON.stringify(fields((await rs.json()).fields)) };
    }
    const r = await readDoc(id === 'assets-lite' ? 'assets' : id);
    if(r.status === 404) return { statusCode:404, headers:{...json, 'Cache-Control':'public, max-age=60'}, body:'null' };
    if(!r.ok){
      /* لا نخزّن الخطأ في CDN — الصفحة ترجع إلى مكتبة Firestore */
      return { statusCode:502, headers:{...json, 'Cache-Control':'no-store'}, body: JSON.stringify({err:r.status}) };
    }
    const doc = fields((await r.json()).fields);
    if(id === 'assets-lite'){ delete doc.PHOTOS; doc.lite = true; }
    /* المتصفح يعيد التحقق دائماً؛ CDN يحفظ دقيقة (الصور 5 دقائق) ويقدّم القديم أثناء التحديث */
    const cdn = /^assets/.test(id) ? 's-maxage=300' : 's-maxage=60';
    return {
      statusCode: 200,
      headers: {
        ...json,
        'Cache-Control': 'public, max-age=0, must-revalidate',
        'Netlify-CDN-Cache-Control': `public, durable, ${cdn}, stale-while-revalidate=86400`,
      },
      body: JSON.stringify(doc),
    };
  }catch(e){
    return { statusCode:502, headers:{...json, 'Cache-Control':'no-store'}, body: JSON.stringify({err:String(e.message||e)}) };
  }
};
