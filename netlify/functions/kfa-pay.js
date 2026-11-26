/* =========================================================================
   الدفع الإلكتروني لدورات إدارة التعليم وتطوير الدارسين (kfa-edu/).
   البوابة: MyFatoorah — تدعم كي نت KNET، فيزا/ماستر، Apple Pay بالدينار الكويتي.

   POST /api/kfa-pay
     {action:'create', ref, courseId, method:'knet'|'card'|'apple', name, email, phone, returnUrl}
        → {url, invoiceId}   رابط صفحة الدفع الآمنة
        → {demo:true}        إن لم يُضبط مفتاح البوابة بعد
     {action:'verify', ref, paymentId}
        → {paid:true|false, reference?, message?}

   متغيرات البيئة على Netlify (Site settings → Environment variables):
     MYFATOORAH_API_KEY   مفتاح الـAPI من لوحة MyFatoorah (سرّي — لا يوضع في الكود)
     MYFATOORAH_BASE      https://api.myfatoorah.com  (الإنتاج)  أو  https://apitest.myfatoorah.com (تجريبي — الافتراضي)

   الأمان:
   - المبلغ لا يُقبل من المتصفح؛ يُقرأ من kfa-edu/config.js على الخادم حسب رمز الدورة.
   - رابط العودة مقيّد بنطاقات الموقع.
   - التحقق من الدفع يتم على الخادم من البوابة مباشرة، ويُطابَق رقم الطلب (CustomerReference).
   ========================================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ORIGINS = ['https://mfsoccer.com', 'https://www.mfsoccer.com'];
const BASE = (process.env.MYFATOORAH_BASE || 'https://apitest.myfatoorah.com').replace(/\/+$/, '');
const KEY = process.env.MYFATOORAH_API_KEY || '';
const REF = /^KFA-\d{4}-\d{5}$/;

const H = (origin) => ({
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0],
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store'
});
const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);

let _courses = null;
function courses() {
  if (_courses) return _courses;
  const candidates = [
    path.join(__dirname, '../../kfa-edu/config.js'),
    path.join(process.cwd(), 'kfa-edu/config.js')
  ];
  for (const p of candidates) {
    try {
      const sandbox = { window: {} };
      vm.runInNewContext(fs.readFileSync(p, 'utf8'), sandbox, { timeout: 200 });
      _courses = sandbox.window.KFA_CONFIG.seedCourses;
      return _courses;
    } catch (_) { /* جرّب التالي */ }
  }
  return (_courses = []);
}

async function mf(endpoint, body) {
  const res = await fetch(`${BASE}/v2/${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.IsSuccess === false) {
    const msg = data.Message || (data.ValidationErrors || []).map((e) => e.Error).join('، ') || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data.Data;
}

// معرّفات طرق الدفع تختلف حسب الحساب؛ نطلبها من البوابة ونطابق بالرمز.
const METHOD_CODE = { knet: 'kn', card: 'vm', apple: 'ap' };
async function paymentMethodId(method, amount) {
  const d = await mf('InitiatePayment', { InvoiceAmount: amount, CurrencyIso: 'KWD' });
  const want = METHOD_CODE[method] || 'kn';
  const pm = (d.PaymentMethods || []).find((m) => String(m.PaymentMethodCode).toLowerCase() === want);
  return pm ? pm.PaymentMethodId : null;
}

exports.handler = async (event) => {
  const origin = event.headers.origin || event.headers.Origin || '';
  const out = (code, body) => ({ statusCode: code, headers: H(origin), body: JSON.stringify(body) });
  if (event.httpMethod === 'OPTIONS') return out(204, {});
  if (event.httpMethod !== 'POST') return out(405, { error: 'method' });

  let b;
  try { b = JSON.parse(event.body || '{}'); } catch { return out(400, { error: 'bad json' }); }
  if (!KEY) return out(200, { demo: true });

  try {
    if (b.action === 'create') {
      const ref = clean(b.ref, 20);
      if (!REF.test(ref)) return out(400, { error: 'رقم طلب غير صالح' });
      const course = courses().find((c) => c.id === b.courseId);
      if (!course) return out(400, { error: 'دورة غير معروفة' });
      const amount = Number(course.fee);

      let ret;
      try { ret = new URL(String(b.returnUrl || '')); } catch { return out(400, { error: 'رابط عودة غير صالح' }); }
      if (!ORIGINS.includes(ret.origin)) return out(400, { error: 'رابط عودة غير مسموح' });
      ret.search = ''; ret.hash = '';
      ret.searchParams.set('ref', ref);

      const pmId = await paymentMethodId(b.method, amount);
      if (!pmId) return out(400, { error: 'طريقة الدفع غير مفعّلة على الحساب' });

      const d = await mf('ExecutePayment', {
        PaymentMethodId: pmId,
        InvoiceValue: amount,
        DisplayCurrencyIso: 'KWD',
        CustomerName: clean(b.name, 80),
        CustomerEmail: clean(b.email, 120),
        CustomerMobile: clean(b.phone, 8).replace(/\D/g, ''),
        MobileCountryCode: '+965',
        CustomerReference: ref,
        UserDefinedField: course.id,
        Language: 'ar',
        CallBackUrl: ret.toString(),
        ErrorUrl: ret.toString(),
        InvoiceItems: [{ ItemName: clean(course.title, 100), Quantity: 1, UnitPrice: amount }]
      });
      return out(200, { url: d.PaymentURL, invoiceId: d.InvoiceId });
    }

    if (b.action === 'verify') {
      const ref = clean(b.ref, 20);
      const pid = clean(b.paymentId, 64);
      if (!REF.test(ref) || !pid) return out(400, { error: 'بيانات ناقصة' });
      const d = await mf('GetPaymentStatus', { Key: pid, KeyType: 'PaymentId' });
      const okRef = d.CustomerReference === ref;
      const paid = okRef && d.InvoiceStatus === 'Paid';
      const tx = (d.InvoiceTransactions || []).find((t) => t.PaymentId === pid) || {};
      return out(200, {
        paid,
        reference: tx.ReferenceId || tx.TransactionId || null,
        message: paid ? 'تم الدفع' : (!okRef ? 'العملية لا تخص هذا الطلب' : (tx.Error || 'لم تكتمل عملية الدفع'))
      });
    }
    return out(400, { error: 'action' });
  } catch (e) {
    return out(502, { error: clean(e.message, 200) });
  }
};
