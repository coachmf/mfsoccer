/* نطاقات الموقع المسموحة لروابط العودة من بوابة الدفع.
   Netlify يضبط URL وDEPLOY_PRIME_URL وDEPLOY_URL تلقائياً؛ KFA_ALLOWED_ORIGINS لنطاقات إضافية (مفصولة بفواصل). */
'use strict';
function allowedOrigins() {
  const list = [process.env.URL, process.env.DEPLOY_PRIME_URL, process.env.DEPLOY_URL, ...String(process.env.KFA_ALLOWED_ORIGINS || '').split(',')];
  return list.map((u) => { try { return new URL(String(u).trim()).origin; } catch { return null; } }).filter(Boolean);
}
const JSON_H = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const hasDb = () => !!process.env.KFA_FIREBASE_SERVICE_ACCOUNT;
module.exports = { allowedOrigins, JSON_H, hasDb };
