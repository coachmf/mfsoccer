/* =========================================================================
   بيانات موقع إدارة التعليم وتطوير الدارسين (kfa_edu) — المصدر المركزي.
   Firestore بحساب الخدمة KFA_FIREBASE_SERVICE_ACCOUNT (مشروع Firebase مستقل):
     kfaedu/settings        { courses:[…], cats:[…], updatedAt }
     kfaedu_regs/{ref}      طلب تسجيل واحد

   POST /api/kfa-edu  {action, …}
   عامة:
     catalog                         → {courses, cats}   (المنشورة والمغلقة فقط، مع المقاعد المحجوزة)
     register  {courseId, …بيانات}   → {ref, fee, status}
     get       {ref, civil}          → {reg}
     lookup    {q, civil}            → {regs}
   إدارة (ترويسة x-kfa-admin = KFA_ADMIN_KEY):
     adminCheck · adminCatalog · saveCatalog {courses,cats} · adminRegs · setStatus {ref,status}
   ========================================================================= */
'use strict';
const crypto = require('crypto');
const { accessToken } = require('./lib/google');
const { makeIO } = require('./lib/fsrest');
const { JSON_H, hasDb } = require('./lib/site');
const { seed, priceFor, isOpenFor, cleanCourse, cleanCat, LIC_RANK } = require('./lib/kfaedu');

const SETTINGS = 'kfaedu/settings';
const REGS = 'kfaedu_regs';
const STATUSES = ['pending', 'paid', 'confirmed', 'cancelled'];
const HOLDS = (s) => s === 'paid' || s === 'confirmed';

const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);
const kwToday = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);

async function io() { return makeIO(await accessToken('https://www.googleapis.com/auth/datastore')); }

async function loadSettings(db) {
  const d = await db.get(SETTINGS);
  if (d && Array.isArray(d.data.courses)) return { courses: d.data.courses, cats: d.data.cats || seed().cats };
  return seed();
}
async function allRegs(db) { return (await db.list(REGS)).map((x) => x.data); }

function withTaken(courses, regs) {
  const n = {};
  regs.forEach((r) => { if (HOLDS(r.status)) n[r.courseId] = (n[r.courseId] || 0) + 1; });
  return courses.map((c) => ({ ...c, taken: (Number(c.reserved) || 0) + (n[c.id] || 0) }));
}

const publicReg = (r) => ({
  ref: r.ref, courseId: r.courseId, courseTitle: r.courseTitle, fee: r.fee, name: r.name,
  civil: r.civil, email: r.email, phone: r.phone, status: r.status, createdAt: r.createdAt, payment: r.payment || null
});

function isAdmin(event) {
  const key = process.env.KFA_ADMIN_KEY || '';
  const got = event.headers['x-kfa-admin'] || '';
  if (!key || !got) return false;
  const a = crypto.createHash('sha256').update(key).digest();
  const b = crypto.createHash('sha256').update(String(got)).digest();
  return crypto.timingSafeEqual(a, b);
}

function newRef() { return `KFA-${new Date().getFullYear()}-${crypto.randomInt(10000, 100000)}`; }

exports.handler = async (event) => {
  const out = (code, body) => ({ statusCode: code, headers: JSON_H, body: JSON.stringify(body) });
  if (event.httpMethod !== 'POST') return out(405, { error: 'method' });
  let b; try { b = JSON.parse(event.body || '{}'); } catch { return out(400, { error: 'bad json' }); }
  if (!hasDb()) return out(503, { error: 'unconfigured' });

  try {
    const db = await io();
    switch (b.action) {
      case 'catalog': {
        const s = await loadSettings(db);
        const regs = await allRegs(db);
        return out(200, { cats: s.cats, courses: withTaken(s.courses, regs).filter((c) => c.status !== 'draft') });
      }

      case 'register': {
        const s = await loadSettings(db);
        const regs = await allRegs(db);
        const c = withTaken(s.courses, regs).find((x) => x.id === b.courseId);
        if (!c || !isOpenFor(c, kwToday())) return out(400, { error: 'الدورة غير متاحة للتسجيل' });
        const v = {
          name: clean(b.name, 100), civil: clean(b.civil, 12), dob: clean(b.dob, 10), nat: clean(b.nat, 30),
          phone: clean(b.phone, 8), email: clean(b.email, 120), club: clean(b.club, 80), role: clean(b.role, 40),
          lic: clean(b.lic, 20), licno: clean(b.licno, 40), notes: clean(b.notes, 500)
        };
        if (v.name.split(/\s+/).length < 3) return out(400, { error: 'الاسم الرباعي مطلوب' });
        if (!/^[23]\d{11}$/.test(v.civil)) return out(400, { error: 'رقم مدني غير صالح' });
        if (!/^[24569]\d{7}$/.test(v.phone)) return out(400, { error: 'رقم هاتف غير صالح' });
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email)) return out(400, { error: 'بريد غير صالح' });
        if (c.prereq && (LIC_RANK[v.lic] ?? -1) < (LIC_RANK[c.prereq] ?? 99)) return out(400, { error: 'لا تستوفي شرط الرخصة المسبقة' });
        if (regs.some((r) => r.courseId === c.id && r.civil === v.civil && r.status !== 'cancelled')) return out(409, { error: 'يوجد طلب سابق بنفس الرقم المدني لهذه الدورة' });
        const fee = priceFor(c, kwToday());
        const reg = {
          ref: '', courseId: c.id, courseTitle: c.title, fee, ...v,
          status: fee > 0 ? 'pending' : 'paid', createdAt: new Date().toISOString(),
          payment: fee > 0 ? null : { method: 'free', paidAt: new Date().toISOString() }
        };
        for (let i = 0; i < 5; i++) {
          reg.ref = newRef();
          try { await db.commit([{ path: `${REGS}/${reg.ref}`, data: reg, mask: false, exists: false }]); return out(200, { ref: reg.ref, fee, status: reg.status }); }
          catch (e) { if (!e.precondition && e.status !== 409) throw e; }
        }
        return out(500, { error: 'تعذّر إنشاء رقم طلب' });
      }

      case 'get': {
        const ref = clean(b.ref, 20);
        const d = await db.get(`${REGS}/${ref}`);
        if (!d || d.data.civil !== clean(b.civil, 12)) return out(404, { error: 'لم يُعثر على الطلب' });
        return out(200, { reg: publicReg(d.data) });
      }

      case 'lookup': {
        const q = clean(b.q, 120).toUpperCase(), cv = clean(b.civil, 12);
        if (!q || !/^\d{12}$/.test(cv)) return out(400, { error: 'بيانات ناقصة' });
        const regs = (await allRegs(db)).filter((r) => r.civil === cv && (r.ref === q || String(r.email).toUpperCase() === q));
        return out(200, { regs: regs.map(publicReg) });
      }

      /* ——— الإدارة ——— */
      default: {
        if (!isAdmin(event)) return out(401, { error: 'رمز الإدارة غير صحيح' });
        if (b.action === 'adminCheck') return out(200, { ok: true });
        if (b.action === 'adminCatalog') {
          const s = await loadSettings(db);
          return out(200, { cats: s.cats, courses: withTaken(s.courses, await allRegs(db)) });
        }
        if (b.action === 'saveCatalog') {
          const cats = (Array.isArray(b.cats) ? b.cats : []).map(cleanCat).filter(Boolean).slice(0, 40);
          const ids = new Set();
          const courses = (Array.isArray(b.courses) ? b.courses : []).map(cleanCourse).filter((c) => c && !ids.has(c.id) && ids.add(c.id)).slice(0, 500);
          if (!cats.length) return out(400, { error: 'يجب وجود مسار واحد على الأقل' });
          await db.commit([{ path: SETTINGS, data: { courses, cats, updatedAt: new Date().toISOString() }, mask: false }]);
          return out(200, { ok: true, count: courses.length });
        }
        if (b.action === 'adminRegs') return out(200, { regs: (await allRegs(db)).sort((x, y) => String(y.createdAt).localeCompare(x.createdAt)) });
        if (b.action === 'setStatus') {
          if (!STATUSES.includes(b.status)) return out(400, { error: 'حالة غير صالحة' });
          await db.commit([{ path: `${REGS}/${clean(b.ref, 20)}`, data: { status: b.status, statusAt: new Date().toISOString() }, exists: true }]);
          return out(200, { ok: true });
        }
        return out(400, { error: 'action' });
      }
    }
  } catch (e) {
    return out(502, { error: clean(e.message, 200) });
  }
};
