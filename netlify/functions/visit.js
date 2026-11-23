/* =========================================================================
   عدّاد الزوار على الخادم (منصور 2026-11-23) — الكاتب الوحيد لـstats وvisits.

   كان العميل يكتب في Firestore مباشرة، فظهرت أربع مشاكل:
     1) اليوم كان يُحسب من ساعة الجهاز، فزائر في أوروبا الساعة 23:00 بتوقيت
        الكويت يُحسب على «أمس»، وجهاز بساعة خاطئة يكتب في يوم عشوائي.
        هنا اليوم يُحسب على الخادم بتوقيت الكويت (UTC+3 بلا تغيير صيفي).
     2) القواعد كانت تسمح بزيادة +1 لكل طلب بلا حدّ، فأي أحد ينفخ الرقم
        بحلقة طلبات. الآن الكتابة ممنوعة على العميل كلياً.
     3) المجموع كان يقرأ كل مستندات stats (مستند لكل يوم، ينمو بلا حدّ).
        الآن مستند واحد stats/_all يحمل المجموع وخطّ الأيام.
     4) صفحة الفانتسي ما كانت تُحسب إطلاقاً.

   POST /api/visit  { s:1?, u:1?, c:1?, k:["v_home","d_app_ios",...] }
     s=1 زيارة (جلسة) · u=1 زائر فريد لهذا اليوم · c=1 سجّل دولة هذه الجلسة
     k حقول التفصيل
   الردّ: { ok, day, cc } — العميل يحفظ day ليعرف متى يتغيّر اليوم الكويتي،
   وcc يؤكّد تسجيل الدولة فلا يُعيد طلبها.

   الدولة تُستخرج على الخادم من بيانات Netlify الجغرافية، ولا تُقبل من العميل
   إطلاقاً (مفاتيح g_ الواردة منه تُحذف) — وإلّا زيّف أي أحد دولته.
   لا يُخزَّن أي معرّف: لا IP ولا بريد ولا معرّف جهاز — الدولة تُشتقّ من الـIP
   ثم يُهمل الـIP، فالمحفوظ رمز دولة وعدّاد فقط (g_kw = 12).
   ========================================================================= */
'use strict';
const { serviceAccount, accessToken } = require('./lib/google');

const OK_ORIGIN = ['https://mfsoccer.com', 'https://www.mfsoccer.com'];
const KEY = /^[a-z]_[a-z0-9_]{1,30}$/;
const MAXK = 40;

/* رمز الدولة من ترويسات Netlify. x-nf-geo هو المصدر الرسمي (JSON بترميز base64)،
   والبقية احتياط إن تغيّرت المنصة. يرجع حرفين صغيرين أو '' — و'' يعني لا نسجّل. */
function country(h) {
  const g = h['x-nf-geo'] || h['X-NF-Geo'];
  if (g) { try {
    const j = JSON.parse(Buffer.from(g, 'base64').toString('utf8'));
    const c = j && j.country && j.country.code;
    if (/^[A-Za-z]{2}$/.test(c || '')) return c.toLowerCase();
  } catch (e) {} }
  for (const k of ['x-country', 'cf-ipcountry', 'x-geo-country']) {
    const v = h[k];
    if (/^[A-Za-z]{2}$/.test(v || '')) return v.toLowerCase();
  }
  return '';
}

/* يوم الكويت: UTC+3 ثابت (الكويت بلا توقيت صيفي) */
const kwDay = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);

/* مسار حقل Firestore: المقطع غير القياسي يُحاط بعلامة ` (مثل التاريخ) */
const fp = s => s.split('.').map(x => /^[A-Za-z_][A-Za-z0-9_]*$/.test(x) ? x : '`' + x + '`').join('.');
const incs = (...paths) => paths.map(p => ({ fieldPath: fp(p), increment: { integerValue: '1' } }));

exports.handler = async (event) => {
  const H = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: H, body: '' };
  if (event.httpMethod !== 'POST')    return { statusCode: 405, headers: H, body: '{"ok":false}' };

  /* أصل الطلب: الغائب يُقبل (بعض الحاويات تحذفه)، والحاضر الخاطئ يُرفض */
  const org = event.headers.origin || event.headers.Origin || '';
  if (org && !OK_ORIGIN.includes(org) && !/^http:\/\/localhost(:\d+)?$/.test(org))
    return { statusCode: 403, headers: H, body: '{"ok":false,"err":"origin"}' };

  let b = {};
  try { b = JSON.parse(event.body || '{}'); } catch (e) { return { statusCode: 400, headers: H, body: '{"ok":false}' }; }

  /* مفاتيح g_ من العميل مرفوضة: الدولة من الخادم وحده */
  const keys = [...new Set((Array.isArray(b.k) ? b.k : [])
    .filter(k => KEY.test(k) && !k.startsWith('g_')))].slice(0, MAXK);
  const sess = b.s === 1 || b.s === true;
  const uniq = b.u === 1 || b.u === true;
  const cc   = (b.c === 1 || b.c === true) ? country(event.headers || {}) : '';
  if (cc) keys.push('g_' + cc);
  const day  = kwDay();
  /* diag: أسماء الترويسات الجغرافية الموجودة (أسماء لا قيم) — لفحص المنصة بعد أي تغيير */
  if (b.diag === 1) return { statusCode: 200, headers: H, body: JSON.stringify({ ok: true, day, cc,
    geoHeaders: Object.keys(event.headers || {}).filter(k => /^(x-nf|x-country|cf-|x-geo)/i.test(k)) }) };
  if (!sess && !uniq && !keys.length) return { statusCode: 200, headers: H, body: JSON.stringify({ ok: true, day, noop: true }) };

  try {
    const pid = serviceAccount().project_id;
    const at  = await accessToken('https://www.googleapis.com/auth/datastore');
    const ROOT = `projects/${pid}/databases/(default)/documents`;
    const writes = [];

    /* الزيارات اليومية + المجموع والخطّ الزمني في مستند واحد */
    if (sess || uniq) {
      const t = []; if (sess) t.push('v'); if (uniq) t.push('u');
      writes.push({ update: { name: `${ROOT}/stats/${day}`, fields: { d: { stringValue: day } } },
                    updateMask: { fieldPaths: ['d'] }, updateTransforms: incs(...t) });
      const a = []; if (sess) a.push('v', `days.${day}`); if (uniq) a.push('u', `ud.${day}`);
      writes.push({ update: { name: `${ROOT}/stats/_all`, fields: {} },
                    updateMask: { fieldPaths: [] }, updateTransforms: incs(...a) });
    }
    /* التفصيل المجهول: قسم، مباراة، لاعب، نادٍ، جهاز، مصدر، لغة، جديد/عائد، ساعة */
    if (keys.length) {
      writes.push({ update: { name: `${ROOT}/visits/${day}`, fields: { d: { stringValue: day } } },
                    updateMask: { fieldPaths: ['d'] }, updateTransforms: incs(...keys) });
    }

    const r = await fetch(`https://firestore.googleapis.com/v1/${ROOT}:commit`, { method: 'POST',
      headers: { Authorization: 'Bearer ' + at, 'Content-Type': 'application/json' },
      body: JSON.stringify({ writes }) });
    if (!r.ok) throw new Error('commit ' + r.status + ' ' + (await r.text().catch(() => '')).slice(0, 200));
    return { statusCode: 200, headers: H, body: JSON.stringify({ ok: true, day, n: keys.length, cc }) };
  } catch (e) {
    /* القياس لا يُفشل الصفحة أبداً: نُبلّغ 200 ونسجّل الخطأ في لوحة Netlify */
    console.error('visit', e.message || e);
    return { statusCode: 200, headers: H, body: JSON.stringify({ ok: false, day }) };
  }
};
