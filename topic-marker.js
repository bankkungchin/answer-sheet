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
    return String(ch || '').replace(/\s+/g, '').replace(/การ/g, '').replace(/ที่/g, '').toLowerCase();
  }

  function stripGroup(s) {
    return String(s || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
  }

  function loadResults() {
    if (cache) return Promise.resolve(cache);
    var url = 'https://sheets.googleapis.com/v4/spreadsheets/' + SHEET_ID +
              '/values/results!B2:E?key=' + API_KEY + '&t=' + Date.now();
    return fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (j) { cache = j.values || []; return cache; });
  }

  /* ชื่อนักเรียนที่ล็อกอินอยู่ — อ่านจากหัวหน้า p3 */
  function currentStudentName() {
    var el = document.getElementById('modeName');
    return el ? stripGroup(el.textContent) : '';
  }

  function markOptions() {
    var sel = document.getElementById('topicFilter');
    if (!sel) return;
    var who = currentStudentName();
    if (!who) return;
    if (sel.dataset.markedFor === who) return;   // ทำไปแล้วสำหรับคนนี้

    loadResults().then(function (rows) {
      var mine = {};
      rows.forEach(function (r) {
        if (!r || !r[0] || !r[3]) return;
        if (stripGroup(r[0]) !== who) return;     // B=ชื่อ, E=บท
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

      sel.dataset.markedFor = who;
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
