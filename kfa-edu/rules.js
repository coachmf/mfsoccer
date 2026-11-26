/* =========================================================================
   قواعد الدورات المشتركة بين المتصفح والخادم (netlify/functions/lib/kfaedu.js).
   أي تعديل هنا يسري على الطرفين — فلا يختلف السعر أو شرط التسجيل بينهما.
   ========================================================================= */
(function (root) {
  'use strict';

  const DEFAULT_CATS = [
    { id: 'afc', name: 'رخص الاتحاد الآسيوي', color: '#0f3f94' },
    { id: 'grass', name: 'البراعم والقاعدة', color: '#149a54' },
    { id: 'gk', name: 'حراس المرمى', color: '#7a3fb8' },
    { id: 'futsal', name: 'الصالات', color: '#d26a12' },
    { id: 'spec', name: 'دورات تخصصية', color: '#0e8a9a' }
  ];
  const LICENSES = [
    ['', 'لا يوجد'], ['GR-1', 'شهادة البراعم'], ['AFC-C', 'آسيوية C'], ['AFC-B', 'آسيوية B'], ['AFC-A', 'آسيوية A'], ['AFC-PRO', 'آسيوية PRO']
  ];
  const LIC_RANK = { '': 0, 'GR-1': 0, 'AFC-C': 1, 'AFC-B': 2, 'AFC-A': 3, 'AFC-PRO': 4 };
  const STATUSES = { published: 'منشورة — التسجيل مفتوح', closed: 'منشورة — التسجيل مغلق', draft: 'مسودة (مخفية)' };

  const str = (v, n) => String(v ?? '').replace(/[\u0000-\u0009\u000b-\u001f<>]/g, '').trim().slice(0, n);
  const date = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : '');
  const num = (v, min, max, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d; };
  const money3 = (n) => Math.round(n * 1000) / 1000;

  function cleanCat(c) {
    if (!c) return null;
    const id = str(c.id, 20).replace(/[^A-Za-z0-9_-]/g, '');
    const name = str(c.name, 60);
    if (!id || !name) return null;
    return { id, name, color: /^#[0-9a-fA-F]{6}$/.test(c.color || '') ? c.color : '#0f3f94' };
  }

  function cleanCourse(c) {
    if (!c) return null;
    const id = str(c.id, 24).replace(/[^A-Za-z0-9_-]/g, '');
    const title = str(c.title, 140);
    const start = date(c.start), end = date(c.end) || start;
    if (!id || !title || !start || end < start) return null;
    const days = Array.isArray(c.days) ? [...new Set(c.days.map(Number).filter((d) => d >= 0 && d <= 6))].sort() : [];
    const early = c.earlyFee === '' || c.earlyFee == null ? null : num(c.earlyFee, 0, 100000, null);
    return {
      id, title, start, end, days,
      cat: str(c.cat, 20) || 'spec',
      code: str(c.code, 30),
      status: STATUSES[c.status] ? c.status : 'published',
      time: str(c.time, 80),
      place: str(c.place, 120),
      instructor: str(c.instructor, 120),
      lang: str(c.lang, 40),
      audience: str(c.audience, 80),
      seats: Math.round(num(c.seats, 0, 10000, 0)),
      reserved: Math.round(num(c.reserved ?? c.taken, 0, 10000, 0)),
      fee: money3(num(c.fee, 0, 100000, 0)),
      earlyFee: early == null ? null : money3(early),
      earlyUntil: date(c.earlyUntil),
      regOpen: date(c.regOpen),
      regClose: date(c.regClose),
      prereq: LIC_RANK[c.prereq] !== undefined ? String(c.prereq || '') : '',
      requirements: str(c.requirements, 1500),
      desc: str(c.desc, 3000)
    };
  }

  // السعر الساري اليوم (سعر التسجيل المبكر إن وُجد ولم ينتهِ)
  function priceFor(c, today) {
    if (c.earlyFee != null && c.earlyUntil && today <= c.earlyUntil) return c.earlyFee;
    return c.fee;
  }
  const seatsLeft = (c) => (c.seats ? Math.max(0, c.seats - (c.taken || 0)) : Infinity);
  function isOpenFor(c, today) {
    if (c.status !== 'published') return false;
    if (seatsLeft(c) <= 0) return false;
    if (c.regOpen && today < c.regOpen) return false;
    if (c.regClose) return today <= c.regClose;
    return today < c.start;
  }
  // سبب عدم إمكانية التسجيل (للعرض)
  function closedReason(c, today) {
    if (c.status === 'closed') return 'التسجيل مغلق';
    if (seatsLeft(c) <= 0) return 'مكتمل';
    if (c.regOpen && today < c.regOpen) return 'يفتح التسجيل قريباً';
    return 'انتهى التسجيل';
  }

  const api = { DEFAULT_CATS, LICENSES, LIC_RANK, STATUSES, cleanCat, cleanCourse, priceFor, isOpenFor, closedReason, seatsLeft };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KFA_RULES = api;
})(typeof window !== 'undefined' ? window : globalThis);
