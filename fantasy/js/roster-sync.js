/* =========================================================
   سحب كشوفات اللاعبين من موقع mfsoccer إلى الفانتازي
   المصدر: نفس مستند الموسم في Firestore، الحقل squads
   الشكل: { "القادسية": [ {n:"الاسم", p:"CDM", s:10}, "اسم بلا رقم" ] }
   يُحمَّل بعد js/mfsync.js في index.html.
   ========================================================= */
'use strict';

const ROSTER = {
  KEY: 'kwf_roster_sync',
  AUTO_HOURS: 12,

  /* المركز التفصيلي في الموقع ← خط اللعب في الفانتازي */
  MAIN: { GK:'G', RB:'D', CB:'D', LB:'D', RWB:'D', LWB:'D',
          CDM:'M', CM:'M', CAM:'M', RM:'M', LM:'M',
          RW:'F', ST:'F', LW:'F',
          G:'G', D:'D', M:'M', F:'F' },

  name(x){ return (typeof x === 'string' ? x : (x && x.n) || '').trim(); },
  pos(x){ return this.MAIN[(typeof x === 'string' ? '' : (x && x.p) || '')] || ''; },
  num(x){ return (typeof x === 'string' ? 0 : +(x && x.s) || 0); },

  /* الكشوفات كما وصلت من الموقع، مرتبة حسب رمز النادي */
  parse(squads){
    const out = {}, unknown = [];
    for(const clubName in (squads || {})){
      const id = MFSYNC.clubId(clubName);
      if(!id){ unknown.push(clubName); continue; }
      out[id] = (squads[clubName] || []).map(x => ({
        name: this.name(x), pos: this.pos(x), shirt: this.num(x)
      })).filter(p => p.name);
    }
    return { byClub: out, unknown };
  },

  async sync(opt){
    opt = opt || {};
    const quiet = !!opt.quiet;
    if(!quiet) UI.toast('جاري سحب الكشوفات من mfsoccer…');

    let data;
    try{ data = await MFSYNC.fetchSeason(); }
    catch(e){ if(!quiet) UI.toast(e.message, true); return null; }

    if(!data.squads){
      if(!quiet) UI.toast('ما فيه كشوفات في مستند الموسم', true);
      return null;
    }

    const { byClub, unknown } = this.parse(data.squads);
    const st = DB.state;
    const rep = { added:0, updated:0, hidden:0, posChanged:0, unknown, clubs:Object.keys(byClub).length };
    let maxId = st.players.reduce((m,p)=>Math.max(m, +String(p.id).replace(/\D/g,'')||0), 0);

    for(const cid in byClub){
      const seen = new Set();

      byClub[cid].forEach(sp => {
        const hit = MFSYNC.resolvePlayer(sp.name, cid, null);
        if(hit){
          seen.add(hit.id);
          let changed = false;
          if(hit.name !== sp.name){ hit.name = sp.name; changed = true; }
          if(sp.shirt && hit.shirt !== sp.shirt){ hit.shirt = sp.shirt; changed = true; }
          if(sp.pos && hit.pos !== sp.pos){ hit.pos = sp.pos; rep.posChanged++; changed = true; }
          if(hit.status === 'u'){ hit.status = 'a'; changed = true; }   /* رجع للكشف */
          if(changed) rep.updated++;
        } else {
          st.players.push({
            id: 'p' + (++maxId), club: cid, pos: sp.pos || 'M', name: sp.name,
            price: 4.5, startPrice: 4.5, shirt: sp.shirt || 0,
            status: 'a', news: '', photo: ''
          });
          seen.add('p' + maxId);
          rep.added++;
        }
      });

      /* لاعب في اللعبة ومب في كشف الموقع: يُخفى (نفس معنى «حذف من اللعبة») */
      if(opt.removals !== false){
        st.players.filter(p => p.club === cid && p.status !== 'u' && !seen.has(p.id))
          .forEach(p => { p.status = 'u'; rep.hidden++; });
      }
    }

    DB.save();
    try{ localStorage.setItem(this.KEY, String(Date.now())); }catch(e){}
    if(typeof APP !== 'undefined' && APP.render) APP.render();

    if(quiet){
      if(rep.added || rep.updated) UI.toast(`حُدّثت الكشوفات: ${rep.added} جديد · ${rep.updated} معدّل`);
    } else {
      this.report(rep, data.lastUpdate || '');
    }
    return rep;
  },

  report(r, upd){
    const active = DB.state.players.filter(p => p.status !== 'u').length;
    UI.modal(`<h3>سحب الكشوفات من mfsoccer</h3>
      <div class="tiny" style="margin-bottom:8px">آخر تحديث للموقع: ${upd || '—'} · ${r.clubs} نادياً</div>
      <div class="muted" style="line-height:2">
        ${r.added} لاعب جديد · ${r.updated} محدّث · ${r.hidden} أُخفي · ${r.posChanged} تغيّر مركزه
      </div>
      <div class="tiny" style="margin-top:8px">إجمالي اللاعبين الفعّالين الآن: ${active}</div>
      ${r.unknown.length ? `<h3 style="font-size:.85rem;margin-top:10px;color:var(--red)">أندية ما انطابقت:</h3>
        <div class="tiny">${r.unknown.join('، ')}</div>` : ''}
      ${r.hidden ? `<div class="tiny" style="margin-top:8px;color:var(--gold)">اللاعبون المُخفون ما انحذفوا نهائياً — يرجعون تلقائياً لو رجعت أسماؤهم للكشف.</div>` : ''}
      <button class="btn" style="margin-top:12px" onclick="UI.closeModal()">تمام</button>`);
  },

  /* سحب صامت عند فتح اللعبة: يضيف ويحدّث فقط، بلا إخفاء */
  auto(){
    let last = 0;
    try{ last = +localStorage.getItem(this.KEY) || 0; }catch(e){}
    if(Date.now() - last < this.AUTO_HOURS * 3600e3) return;
    setTimeout(() => this.sync({ quiet:true, removals:false }), 2500);
  },

  lastText(){
    let last = 0;
    try{ last = +localStorage.getItem(this.KEY) || 0; }catch(e){}
    if(!last) return 'ما سُحبت بعد';
    const h = Math.round((Date.now() - last) / 3600e3);
    return h < 1 ? 'قبل شوي' : (h < 24 ? `قبل ${h} ساعة` : `قبل ${Math.round(h/24)} يوم`);
  },

  cardHTML(){
    return `<div class="card">
      <h3 class="row spread" style="flex-wrap:wrap;gap:8px">كشوفات اللاعبين
        <button class="btn sm" onclick="ROSTER.sync()">${UI.icon('swap',14)} سحب من موقع mfsoccer</button></h3>
      <div class="tiny">تُسحب الأسماء والأرقام والمراكز من كشوفات الموقع مباشرة: الجديد يُضاف، والمعدّل يُحدّث، ومن خرج من الكشف يُخفى. آخر سحب: ${this.lastText()}.</div>
    </div>`;
  }
};

/* بطاقة السحب فوق قسم «اللاعبون» في لوحة الإدارة */
if(typeof ADMIN !== 'undefined' && ADMIN.sec_players){
  const _secPlayers = ADMIN.sec_players.bind(ADMIN);
  ADMIN.sec_players = function(){ return ROSTER.cardHTML() + _secPlayers(); };
}

document.addEventListener('DOMContentLoaded', () => ROSTER.auto());
