/* أدوات دورات إدارة التعليم على الخادم: القواعد المشتركة + البذرة من site/config.js */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const rules = require('../../../site/rules.js');

let _seed = null;
function seed() {
  if (_seed) return _seed;
  const candidates = [path.join(__dirname, '../../../site/config.js'), path.join(process.cwd(), 'site/config.js')];
  for (const p of candidates) {
    try {
      const box = { window: {} };
      vm.runInNewContext(fs.readFileSync(p, 'utf8'), box, { timeout: 200 });
      const cfg = box.window.KFA_CONFIG;
      _seed = {
        cats: (cfg.seedCats || rules.DEFAULT_CATS).map(rules.cleanCat).filter(Boolean),
        courses: (cfg.seedCourses || []).map(rules.cleanCourse).filter(Boolean)
      };
      return _seed;
    } catch (_) { /* التالي */ }
  }
  return (_seed = { cats: rules.DEFAULT_CATS, courses: [] });
}

module.exports = { ...rules, seed };
