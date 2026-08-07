/**
 * topic-marker.js — ติดสัญลักษณ์ใน dropdown "กรองเฉพาะบท" (หน้า p3)
 * ✅ = บทนี้มีคะแนนของนักเรียนคนนี้แล้ว · 🔒 = ยังไม่มีคะแนน (เลือกไม่ได้)
 *
 * วิธีใช้: เพิ่มบรรทัดนี้ใน index.html ก่อน </body>
 *   <script src="topic-marker.js"></script>
 *
 * ไม่แตะโค้ดเดิม ทำงานแยกอิสระ — ถ้าโหลดข้อมูลไม่ได้ dropdown จะกลับเป็นแบบเดิมทุกอย่าง
 */
(function () {
  'use strict';

  // ใช้ค่าจาก config.js ถ้ามี ไม่งั้นใช้ค่าสำรอง
  var SHEET_ID = (typeof SHEET_ID !== 'undefined' && SHEET_ID) ||
                 (window.SHEET_ID) || '1U49c1_y3QtTa6LP8rV4Z1dBM5gxKrdpxp5nY1M6ffnU';
  var API_KEY  = (typeof API_KEY !== 'undefined' && API_KEY) ||
                 (window.API_KEY) || 'AIzaSyAW7uJtajKOWhfg_Pwc6-NK7siuCVyVpYs';

  var cache = null;

  /* คีย์บท — ให้ "เรียงลำดับและจัดหมู่" = "การเรียงลำดับและการจัดหมู่"
     (ตัวเลข "ชุดที่ 1/2" ยังแยกกัน) */
  function chapterKey(ch) {
    return String(ch || '')
      .replace(/\s+/g, '')
      .replace(/การ/g, '')
      .replace(/[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/g, '')   // ตัดสระบน/ล่าง + วรรณยุกต์ + ์
      .replace(/ชดท/g, 'ชด')
      .toLowerCase();
  }

  /* ⚠️ ชื่อคน: ห้ามตัดสระ/วรรณยุกต์ ("ปัณ" ≠ "ปุณ") */
  function nameKey(s) {
    return String(s || '').replace(/\s+/g, '').toLowerCase();
  }

  /* คีย์หลวม — ใช้เทียบชื่อกลุ่มเท่านั้น */
  function looseKey(s) {
    return String(s || '')
      .replace(/\s+/g, '')
      .replace(/[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/g, '')
      .toLowerCase();
  }

  /* ดึงชื่อจริง — รองรับ "ดอม (วันพุธ)", "ดอม (กลุ่มวันพุธ)", "เซ้นส์ เสาร์ 13.00" */
  function stripGroup(s, group) {
    var base = String(s || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
    if (!group) return base;
    var gkey = looseKey(String(group).replace(/^\s*กลุ่ม\s*/, ''));
    var t = base.split(/\s+/);
    var cut = t.length;
    for (var i = t.length - 1; i >= 1; i--) {
      var suf = looseKey(t.slice(i).join(''));
      if (suf && gkey.indexOf(suf) !== -1) cut = i; else break;
    }
    return t.slice(0, cut).join(' ').trim();
  }

  function loadResults() {
    if (cache) return Promise.resolve(cache);
    var url = 'https://sheets.googleapis.com/v4/spreadsheets/' + SHEET_ID +
              '/values/results!B2:E?key=' + API_KEY + '&t=' + Date.now();
    return fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (j) { cache = j.values || []; return cache; });
  }

  function groupKeyTM(g) {
    return looseKey(String(g || '').replace(/^\s*กลุ่ม\s*/, ''));
  }

  /* นักเรียนที่ล็อกอินอยู่ → {name, group}
     ชื่อในช่องค้นหา (p1b) มีวงเล็บกลุ่มติดมาด้วย ใช้แยกคนชื่อซ้ำข้ามกลุ่มได้ */
  function currentStudent() {
    var full = '';
    var inp = document.getElementById('studentSearch');
    if (inp && inp.value) full = inp.value.trim();
    if (!full) {
      var el = document.getElementById('modeName');
      full = el ? el.textContent.trim() : '';
    }
    if (!full) return null;
    var m = full.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
    if (m) return { name: m[1].trim(), group: m[2].trim() };
    return { name: full, group: '' };
  }

  function markOptions() {
    var sel = document.getElementById('topicFilter');
    if (!sel) return;
    var stu = currentStudent();
    if (!stu) return;
    var tag = stu.name + '|' + stu.group;
    if (sel.dataset.markedFor === tag) return;   // ทำไปแล้วสำหรับคนนี้

    loadResults().then(function (rows) {
      var myName = nameKey(stu.name);
      var myGroup = groupKeyTM(stu.group);

      // ถ้าไม่รู้กลุ่ม แต่มีชื่อซ้ำข้ามกลุ่ม → ไม่ติดสัญลักษณ์ ดีกว่าแสดงผิด
      if (!myGroup) {
        var g = {};
        rows.forEach(function (r) {
          if (r && r[0] && nameKey(stripGroup(r[0], r[1])) === myName) g[groupKeyTM(r[1])] = true;
        });
        if (Object.keys(g).length > 1) return;
      }

      var mine = {};
      rows.forEach(function (r) {
        if (!r || !r[0] || !r[3]) return;
        if (nameKey(stripGroup(r[0], r[1])) !== myName) return;          // B=ชื่อ C=กลุ่ม E=บท
        if (myGroup && groupKeyTM(r[1]) !== myGroup) return;             // คนละกลุ่ม = คนละคน
        mine[chapterKey(r[3])] = true;
      });

      var have = 0, total = 0;
      Array.prototype.forEach.call(sel.options, function (opt) {
        if (!opt.value) return;                   // ข้าม "— ทุกบท —"
        if (!opt.dataset.baseLabel) opt.dataset.baseLabel = opt.textContent;
        var label = opt.dataset.baseLabel;
        total++;
        if (mine[chapterKey(opt.value)]) {
          have++;
          opt.textContent = '✅ ' + label;
          opt.disabled = false;
          opt.style.color = '';
        } else {
          opt.textContent = '🔒 ' + label + ' — ยังไม่มีคะแนน';
          opt.disabled = true;                    // กันเลือกแล้วหน้าว่าง
          opt.style.color = '#999993';
        }
      });

      // อัปเดตหัวข้อ label ให้บอกจำนวนบทที่ดูได้
      var lbl = sel.closest('.field') && sel.closest('.field').querySelector('label');
      if (lbl) {
        if (!lbl.dataset.baseLabel) lbl.dataset.baseLabel = lbl.textContent;
        lbl.textContent = lbl.dataset.baseLabel + ' (ดูได้ ' + have + '/' + total + ' บท)';
      }

      // "— ทุกบท —" ให้ชัดว่าใช้ผลล่าสุด
      if (sel.options[0] && !sel.options[0].dataset.baseLabel) {
        sel.options[0].dataset.baseLabel = sel.options[0].textContent;
      }

      sel.dataset.markedFor = tag;
    }).catch(function () { /* โหลดไม่ได้ → ปล่อย dropdown ตามเดิม */ });
  }

  /* รันเมื่อหน้า p3 ถูกเปิด (มี class active) */
  function watch() {
    var p3 = document.getElementById('p3');
    if (!p3) return;
    if (p3.classList.contains('active')) markOptions();
    new MutationObserver(function () {
      if (p3.classList.contains('active')) markOptions();
    }).observe(p3, { attributes: true, attributeFilter: ['class'] });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', watch);
  } else {
    watch();
  }
})();
