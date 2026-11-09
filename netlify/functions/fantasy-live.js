/* الترتيب الحي للجولة الجارية من CDN (تدقيق 2026-11-09، البند 2): يحسبه الخادم مرة (fantasy-gw-cron → gw-core.live)
   في fantasy/<season>/meta/liveboard، وهنا يُقرأ ويُقدَّم لكل الأجهزة — بدل أن يحمّل كل جهاز تشكيلات كل المشتركين ويحسبها.
   الاستخدام: /api/fantasy-live/2026-2027 → { gw, at, n, avg, high, played, rows:[{id,name,teamName,total,live,prev,liveRank}] } */
'use strict';
const { accessToken } = require('./lib/google');
const { makeIO } = require('./lib/fsrest');

const ALLOWED = /^\d{4}-\d{4}$/;

exports.handler = async (event) => {
  const id = String((event.path || '').split('/').pop() || '');
  const json = { 'Content-Type':'application/json; charset=utf-8', 'Access-Control-Allow-Origin':'*' };
  const fail = (c, b) => ({ statusCode:c, headers:{ ...json, 'Cache-Control':'no-store' }, body:JSON.stringify(b) });
  if(!ALLOWED.test(id)) return fail(400, { err:'bad id' });
  try{
    const io = makeIO(await accessToken('https://www.googleapis.com/auth/datastore'));
    const d = await io.get(`fantasy/${id}/meta/liveboard`);
    if(!d) return fail(404, { err:'no live board' });
    const v = d.data;
    let rows = [];
    try{ rows = JSON.parse(v.json || '[]').map(r => ({ id:r[0], name:r[1], teamName:r[2], total:r[3], live:r[4], prev:r[5], liveRank:r[6] })); }catch(e){}
    return { statusCode:200, headers:{ ...json, 'Cache-Control':'public, max-age=0, must-revalidate',
        'Netlify-CDN-Cache-Control':'public, durable, s-maxage=60, stale-while-revalidate=120' },
      body: JSON.stringify({ gw:+v.gw, at:v.at, n:+v.n || rows.length, avg:+v.avg || 0, high:+v.high || 0, played:+v.played || 0, rows }) };
  }catch(e){ return fail(502, { err:String(e.message || e).slice(0, 200) }); }
};
