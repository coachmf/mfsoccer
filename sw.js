/* =========================================================
   خادم الخدمة — يجعل mfsoccer تطبيقاً قابلاً للتثبيت على
   الآيفون والأندرويد، ويفتح بلا إنترنت على آخر ما شُوهد.

   المبدأ: الصفحات من الشبكة أولاً (فالنتائج لا تتأخر)، والملفات
   الثابتة من الذاكرة أولاً (فالفتح فوري). وبيانات Firestore
   لا تُخزَّن إطلاقاً — الأرقام تُقرأ حيّة دائماً.

   عند كل نشر: ارفع رقم VER فتُبنى ذاكرة جديدة وتُحذف القديمة.
   ========================================================= */
const VER   = 'mf-2026-09-04-1';
const SHELL = 'shell-' + VER;
const RUN   = 'run-'   + VER;

/* الحد الأدنى ليفتح التطبيق بلا إنترنت */
const PRECACHE = [
  '/', '/index.html', '/site.webmanifest',
  '/favicon.svg', '/apple-touch-icon.png', '/icon-192.png', '/icon-512.png',
  '/assets/crests/sq/qadsia.png',  '/assets/crests/sq/kuwait.png',
  '/assets/crests/sq/arabi.png',   '/assets/crests/sq/kazma.png',
  '/assets/crests/sq/salmiya.png', '/assets/crests/sq/nasr.png',
  '/assets/crests/sq/shabab.png',  '/assets/crests/sq/jahra.png',
  '/assets/crests/sq/fahaheel.png','/assets/crests/sq/sahel.png',
  '/assets/crests/sq/tadamon.png', '/assets/crests/sq/sulaibikhat.png',
  '/assets/hero/zain-logo-white.png'
];

/* نطاقات تُخزَّن عند أول استعمال: الخطوط ثابتة فلا داعي لإعادة جلبها */
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(SHELL);
    /* ملف واحد مفقود يجب ألا يُفشل التثبيت كله */
    await Promise.all(PRECACHE.map(u => c.add(u).catch(() => {})));
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== SHELL && k !== RUN).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

/* الصفحة تطلب التحديث الفوري بعد موافقة المستخدم */
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

const isFont = url => FONT_HOSTS.includes(url.hostname);

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  /* Firestore وكل خدمة حيّة: لا تخزين ولا اعتراض */
  if (url.origin !== location.origin && !isFont(url)) return;

  /* الخطوط: من الذاكرة إن وُجدت، وإلا من الشبكة ثم تُخزَّن */
  if (isFont(url)) {
    e.respondWith((async () => {
      const c = await caches.open(RUN);
      const hit = await c.match(req);
      if (hit) return hit;
      try { const res = await fetch(req); if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }
      catch (err) { return hit || Response.error(); }
    })());
    return;
  }

  /* بيانات الموسم: الشبكة أولاً دائماً حتى لا تُعرض نتائج قديمة */
  if (url.pathname.endsWith('/data.json')) {
    e.respondWith((async () => {
      try { const res = await fetch(req); const c = await caches.open(RUN); c.put(req, res.clone()); return res; }
      catch (err) { return (await caches.match(req)) || Response.error(); }
    })());
    return;
  }

  /* الصفحات: الشبكة أولاً، وعند انقطاعها آخر نسخة محفوظة */
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        const c = await caches.open(SHELL);
        c.put(req, res.clone());
        return res;
      } catch (err) {
        return (await caches.match(req))
            || (await caches.match('/index.html'))
            || Response.error();
      }
    })());
    return;
  }

  /* بقية ملفات الموقع: الذاكرة أولاً مع تحديث صامت في الخلفية */
  e.respondWith((async () => {
    const c = await caches.open(RUN);
    const hit = await c.match(req);
    const net = fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; })
                          .catch(() => null);
    return hit || (await net) || Response.error();
  })());
});
