/* =========================================================
   إضافة رقم اللاعب على القميص — ملحق فوق kits.js (لا يعدّل ملفات منصور)
   يُحمَّل بعد js/kits.js مباشرة في index.html:
     <script src="js/kits-number.js?v=70"></script>
   للتعطيل: احذف السطر فقط، وكل شي يرجع مثل ما كان.
   ========================================================= */
'use strict';

(function(){
  if(typeof UI==='undefined' || !UI.kitImg) return;

  const MIN_W = 30;      // أصغر مقاس يظهر فيه الرقم (تحته يزحم الأيقونة)
  const Y     = 74;      // موقع الرقم داخل viewBox 100×100 (تحت الشعار)
  const SIZE  = 27;      // حجم الخط داخل الـ viewBox

  /* لون الرقم: يتحدد من لون القميص عشان يبقى مقروء */
  function numColor(style){
    if(!style) return '#ffffff';
    const body = style.body || '#888888';
    return (typeof luma==='function' && luma(body) > 150) ? '#141414' : '#ffffff';
  }

  /* حقن الرقم داخل الـ SVG قبل الإغلاق — يطلع فوق التظليل */
  function withNumber(html, p, w){
    if(!p || !p.shirt) return html;                 // لاعب بلا رقم مسجّل
    if(w && w < MIN_W) return html;                 // مقاس صغير
    if(String(html).indexOf('<svg') !== 0) return html;  // صورة PNG جاهزة: لا نلمسها
    const style = (typeof kitStyleOf==='function') ? kitStyleOf(p.club, p.pos==='G') : null;
    const txt = `<text x="50" y="${Y}" text-anchor="middle" font-family="Almarai, Tahoma, Arial, sans-serif"`
      + ` font-weight="800" font-size="${SIZE}" fill="${numColor(style)}"`
      + ` stroke="rgba(0,0,0,.22)" stroke-width=".8" paint-order="stroke"`
      + ` style="letter-spacing:-1px">${p.shirt}</text>`;
    return String(html).replace(/<\/svg>\s*$/, txt + '</svg>');
  }

  /* القميص على الملعب */
  UI.pitchKit = function(p, w){
    w = w || 56;
    return `<div class="pk">${withNumber(this.kitImg(p.club, p.pos==='G', w), p, w)}</div>`;
  };

  /* القميص في القوائم والجداول ونافذة اختيار اللاعب */
  UI.playerAvatar = function(p, size){
    size = size || 36;
    return `<span class="avatar kit-av" style="width:${size}px;height:${size}px">`
      + withNumber(this.kitImg(p.club, p.pos==='G', size), p, size) + `</span>`;
  };

  /* قميص كبير في بطاقة اللاعب (84px) */
  UI.kitWithNumber = function(p, w){
    w = w || 84;
    return withNumber(this.kitShirt(p.club, p.pos==='G', w), p, w);
  };
})();
