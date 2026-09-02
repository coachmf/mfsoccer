/* قمصان الأندية على الملعب — رسم SVG بتصميم كل نادي (طراز FPL).
   لو وُجدت صورة حقيقية في assets/kits/<CLUB>.png تُستخدم بدل الرسم. */
'use strict';

const KIT_IMG = {
  // QAD:{out:'QAD.png', gk:'QAD_gk.png'},
};

/* تصميم كل قميص: body لون الجسم، collar لون الياقة، collar2 خط ثانٍ بالياقة،
   neck: round|v، cuff/cuff2 أطراف الأكمام، panel لوح جانبي، sponsor نص الراعي */
const KIT_STYLE = {
  KUW:{ body:'#ffffff', neck:'round', collar:'#E31B23', cuff:'#E31B23', panel:'#E31B23', crest:'#E31B23',
        gk:{ body:'#151515', collar:'#E31B23', cuff:'#E31B23' } },   // حارس الكويت أسود (منصور)
  QAD:{ body:'#F6B800', neck:'round', collar:'#141414', cuff:'#141414', crest:'#141414',
        gk:{ body:'#ff5fa8', collar:'#141414', cuff:'#141414' } },  // حارس القادسية وردي (منصور)
  ARB:{ body:'#0f8a4b', neck:'v', collar:'#ffffff', collar2:'#0b4a2a', cuff:'#ffffff', cuff2:'#0b4a2a', crest:'#ffffff',
        gk:{ body:'#182a63', collar:'#ffffff', collar2:'#0b1a44', cuff:'#ffffff', cuff2:'#0b1a44' } },
  SLB:{ body:'#e3262b', neck:'v', collar:'#ffffff', shoulder:'#ffffff', cuff:'#ffffff', cuff2:'#e3262b', crest:'#ffffff',
        gk:{ body:'#ffd23f', neck:'v', collar:'#141414', cuff:'#141414', crest:'#141414' } },
  FAH:{ body:'#d81f26', neck:'round', collar:'#d81f26', sleeve:'#e9e9f0', cuff:'#e9e9f0', crest:'#ffffff',
        gk:{ body:'#9b6ef3', collar:'#ffffff', cuff:'#ffffff', crest:'#ffffff' } },
  JAH:{ body:'#ffffff', neck:'round', collar:'#ffffff', cuff:'#1a5fb4', panel:'#1a5fb4', crest:'#1a5fb4',
        gk:{ body:'#ff7a00', collar:'#ffffff', cuff:'#ffffff' } },
  KAZ:{ body:'#f26a1b', neck:'round', collar:'#f26a1b', shoulder:'#ffffff', shoulderWide:true, cuff:'#f26a1b', crest:'#ffffff',
        gk:{ body:'#222222', collar:'#f26a1b', cuff:'#f26a1b', crest:'#f26a1b' } },
  SAL:{ body:'#5fb3e6', neck:'round', collar:'#ffffff', sleeve:'#ffffff', cuff:'#1d2b6b', crest:'#ffffff',
        gk:{ body:'#d64fa8', collar:'#ffffff', cuff:'#ffffff', crest:'#ffffff' } },
  SAH:{ body:'#f5d90a', neck:'round', collar:'#1e3f9e', cuff:'#1e3f9e', crest:'#1e3f9e',
        gk:{ body:'#2e9e5b', collar:'#ffffff', cuff:'#ffffff', crest:'#ffffff' } },
  SHB:{ body:'#1f4fd1', neck:'v', collar:'#ffffff', shoulder:'#ffffff', cuff:'#ffffff', panel:'#ffffff', crest:'#ffffff',
        gk:{ body:'#7ac74f', neck:'v', collar:'#ffffff', cuff:'#ffffff', crest:'#ffffff' } },
  NSR:{ body:'#8e1b3a', neck:'round', collar:'#8e1b3a', cuff:'#e6e6ee', panel:'#e6e6ee', crest:'#ffffff',
        gk:{ body:'#ffd23f', collar:'#141414', cuff:'#141414', crest:'#141414' } },
  TDM:{ body:'#1b4fd8', neck:'round', collar:'#ffffff', cuff:'#ffffff', crest:'#ffffff',
        gk:{ body:'#ff7a00', collar:'#ffffff', cuff:'#ffffff', crest:'#ffffff' } },
};

/* أسلوب افتراضي من خريطة الألوان KITS للأندية التي ما وصلت عيناتها بعد */
function kitStyleOf(clubId, isGK){
  const c=DB.club(clubId);
  const k=(typeof KITS!=='undefined' && KITS[clubId]) || {body:c.color, trim:'#ffffff', gk:'#555'};
  const s=KIT_STYLE[clubId];
  if(s) return isGK? Object.assign({neck:s.neck}, s.gk) : s;
  if(isGK) return { body:k.gk, neck:'round', collar:'#ffffff', cuff:'#ffffff', crest:'#ffffff' };
  return { body:k.body, neck:'round', collar:k.trim, cuff:k.trim, crest:k.trim };
}
function luma(hex){ const h=hex.replace('#',''); const r=parseInt(h.substr(0,2),16),g=parseInt(h.substr(2,2),16),b=parseInt(h.substr(4,2),16); return (r*299+g*587+b*114)/1000; }

/* القميص المرسوم — يستبدل UI.kitShirt القديم */
UI.kitShirt=function(clubId, isGK, w){
  const s=kitStyleOf(clubId,isGK); const c=DB.club(clubId);
  w=w||56;
  const id=`kg${clubId}${isGK?'g':''}`;
  const light = luma(s.body)>150;
  const line = light? 'rgba(0,0,0,.28)' : 'rgba(0,0,0,.38)';
  const neckIn = light? '#d9dde3' : 'rgba(0,0,0,.38)';
  const crestFill = s.crest || s.collar;
  const collar = s.neck==='v'
    ? `<path d="M37 14 L50 28 L63 14" fill="none" stroke="${s.collar}" stroke-width="4.2" stroke-linejoin="round" stroke-linecap="round"/>
       ${s.collar2? `<path d="M39.5 13.5 L50 25 L60.5 13.5" fill="none" stroke="${s.collar2}" stroke-width="1.3" stroke-linecap="round"/>`:''}`
    : `<ellipse cx="50" cy="14" rx="12.5" ry="4.6" fill="${neckIn}"/>
       <path d="M37.5 14 Q50 22.5 62.5 14" fill="none" stroke="${s.collar}" stroke-width="3.6" stroke-linecap="round"/>
       ${s.collar2? `<path d="M39 15.2 Q50 20.5 61 15.2" fill="none" stroke="${s.collar2}" stroke-width="1.1" stroke-linecap="round"/>`:''}`;
  const cuff=(pts, pts2)=>`<polygon points="${pts}" fill="${s.cuff||s.collar}"/>${s.cuff2? `<polyline points="${pts2}" fill="none" stroke="${s.cuff2}" stroke-width="1.2"/>`:''}`;
  const body='M28 16 Q50 8 72 16 L72 40 L74 92 Q50 98 26 92 L28 40 Z';
  return `<svg class="kit" width="${w}" height="${w}" viewBox="0 0 100 100" aria-hidden="true">
    <defs>
      <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity="${light?'.5':'.3'}"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/>
        <stop offset="1" stop-color="#000" stop-opacity="${light?'.10':'.24'}"/></linearGradient>
      <clipPath id="${id}c"><path d="${body}"/></clipPath>
    </defs>
    <path d="M28 16 L8 26 L4 46 L22 52 L28 40 Z" fill="${s.sleeve||s.body}" stroke="${line}" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M72 16 L92 26 L96 46 L78 52 L72 40 Z" fill="${s.sleeve||s.body}" stroke="${line}" stroke-width="1.6" stroke-linejoin="round"/>
    ${s.shoulder? (s.shoulderWide
      ? `<path d="M28 16 L8 26 L11 33 L30 24 Z" fill="${s.shoulder}" opacity=".95"/><path d="M72 16 L92 26 L89 33 L70 24 Z" fill="${s.shoulder}" opacity=".95"/>`
      : `<path d="M27 17.5 L9 27.5 M29.5 20.5 L12 30.5" stroke="${s.shoulder}" stroke-width="1.6" stroke-linecap="round"/><path d="M73 17.5 L91 27.5 M70.5 20.5 L88 30.5" stroke="${s.shoulder}" stroke-width="1.6" stroke-linecap="round"/>`) : ''}
    ${cuff('4,46 22,52 23.4,47.6 5.8,41.8','5.8,41.8 23.4,47.6')}
    ${cuff('96,46 78,52 76.6,47.6 94.2,41.8','94.2,41.8 76.6,47.6')}
    <path d="${body}" fill="${s.body}" stroke="${line}" stroke-width="1.6" stroke-linejoin="round"/>
    ${s.panel? `<g clip-path="url(#${id}c)"><rect x="26" y="38" width="5" height="56" fill="${s.panel}"/><rect x="69" y="38" width="5" height="56" fill="${s.panel}"/></g>`:''}
    ${collar}
    <image href="${c.crest}" x="56" y="25" width="12" height="12" preserveAspectRatio="xMidYMid meet"/>
    ${s.sponsor? `<text x="50" y="57" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="${s.sponsor.length>5?7.5:9}" fill="${s.sponsorColor||s.collar}" letter-spacing=".3">${s.sponsor}</text>`:''}
    <path d="${body}" fill="url(#${id})"/>
    <path d="M8 26 L4 46 L22 52 L28 40 L28 16 Z" fill="url(#${id})"/>
    <path d="M92 26 L96 46 L78 52 L72 40 L72 16 Z" fill="url(#${id})"/>
  </svg>`;
};

UI.kitImg=function(clubId,isGK,w){
  w=w||56;
  const k=KIT_IMG[clubId];
  const f= k? (isGK? k.gk : k.out) : null;
  if(f) return `<img class="kit kit-img" src="assets/kits/${f}" alt="" style="width:${w}px;height:${Math.round(w*1.02)}px" loading="lazy">`;
  return this.kitShirt(clubId,isGK,w);
};
/* بطاقة اللاعب على الملعب: القميص بدل الصورة (الصورة تبقى في البطاقة والبروفايل) */
UI.pitchKit=function(p,w){ return `<div class="pk">${this.kitImg(p.club,p.pos==='G',w)}</div>`; };

/* لا صور لاعبين في أي مكان (طلب منصور 2026-09-02) — القميص يحل محل الصورة في القوائم والبطاقة والبروفايل */
UI.playerPhoto=function(){ return null; };
UI.playerAvatar=function(p, size){
  size=size||36;
  return `<span class="avatar kit-av" style="width:${size}px;height:${size}px">${this.kitImg(p.club, p.pos==='G', size)}</span>`;
};
