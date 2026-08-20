/**
 * topic-marker.js — ส่วนเสริมเว็บนักเรียน (ไม่แตะโค้ดเดิม)
 *
 * 1) ติดสัญลักษณ์ใน dropdown "กรองเฉพาะบท" (หน้า p3)
 *    ✅ = บทนี้มีคะแนนของนักเรียนคนนี้แล้ว · 🔒 = ยังไม่มีคะแนน (เลือกไม่ได้)
 * 2) สร้าง "ชื่อพ้อง" ให้คลังฝึก — ชื่อบทในชีตกับใน questionbank.js สะกดต่างกันก็ยังเจอคลัง
 *    เช่น "เรียงลำดับและจัดหมู่" (ชีต) = "การเรียงลำดับและการจัดหมู่" (คลัง)
 *
 * วิธีใช้: เพิ่มบรรทัดนี้ใน index.html ก่อน </body>
 *   <script src="topic-marker.js"></script>
 *
 * ไม่แตะโค้ดเดิม ทำงานแยกอิสระ — ถ้าโหลดข้อมูลไม่ได้ dropdown จะกลับเป็นแบบเดิมทุกอย่าง
 *
 * ── v3.0 (20 ส.ค. 2569) ──
 * 1) เลิกฝัง API key: ถ้า config.js มี PROXY_URL → ดึงผ่าน Apps Script proxy
 *    (?action=marks คืนแค่ ชื่อ/กลุ่ม/วันที่/บท ไม่มีคะแนน)
 *    ถ้ายังไม่มี PROXY_URL → ใช้ Sheets API แบบเดิม เว็บไม่ล่มระหว่างเปลี่ยนผ่าน
 * 2) cache มีวันหมดอายุ 60 วินาที + บังคับดึงใหม่เมื่อเปลี่ยนคน
 *    (ของเดิม cache ค้างทั้ง session → ครูกรอกคะแนนใหม่แล้วยังขึ้น 🔒 "ยังไม่มีคะแนน")
 */
(function () {
  'use strict';

  /* ⚠️ ห้ามใส่ API key ไว้ในไฟล์นี้อีก — ไฟล์นี้เป็น public บน GitHub Pages
     ค่าทั้งหมดอ่านจาก config.js เท่านั้น (ถ้าไม่มีก็ไม่ทำงาน ดีกว่าแอบใช้คีย์ที่รั่ว) */
  /* หมายเหตุ: config.js ประกาศด้วย const → ไม่ได้อยู่บน window ต้องอ่านด้วย typeof
     (ของเดิมเขียน var SHEET_ID = (typeof SHEET_ID ...) ซึ่ง var ตัวเองบังตัวเอง
      ทำให้ตกไปใช้ค่า fallback ที่ hard-code ไว้ทุกครั้ง — คือที่มาของคีย์ในไฟล์นี้) */
  function proxyUrl() {
    try { if (typeof PROXY_URL !== 'undefined' && PROXY_URL) return PROXY_URL; } catch (e) {}
    try { if (window.PROXY_URL) return window.PROXY_URL; } catch (e) {}
    return '';
  }
  function sheetId() {
    try { if (typeof SHEET_ID !== 'undefined' && SHEET_ID) return SHEET_ID; } catch (e) {}
    try { if (window.SHEET_ID) return window.SHEET_ID; } catch (e) {}
    return '';
  }
  function apiKey() {
    try { if (typeof API_KEY !== 'undefined' && API_KEY) return API_KEY; } catch (e) {}
    try { if (window.API_KEY) return window.API_KEY; } catch (e) {}
    return '';
  }

  var cache = null;
  var cacheAt = 0;
  var CACHE_TTL_MS = 60000;

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

  /* คืนแถว [ชื่อ, กลุ่ม, วันที่, บท] — เท่ากับ results!B2:E ของเดิมทุกช่อง */
  function loadResults(force) {
    if (cache && !force && (Date.now() - cacheAt) < CACHE_TTL_MS) return Promise.resolve(cache);

    var px = proxyUrl(), url, pick;
    if (px) {
      url  = px + '?action=marks&t=' + Date.now();
      pick = function (j) { return (j && j.ok && j.rows) ? j.rows : []; };
    } else {
      var sid = sheetId(), key = apiKey();
      if (!sid || !key) return Promise.resolve(cache || []);          // ไม่มีทางดึง → ปล่อย dropdown ตามเดิม
      url  = 'https://sheets.googleapis.com/v4/spreadsheets/' + sid +
             '/values/results!B2:E?key=' + key + '&t=' + Date.now();
      pick = function (j) { return (j && j.values) || []; };
    }

    return fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (j) { cache = pick(j); cacheAt = Date.now(); return cache; })
      .catch(function (e) { if (cache) return cache; throw e; });     // เน็ตสะดุด → ใช้ของเดิมไปก่อน
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

    // คนละคนกับรอบก่อน = เพิ่ง login ใหม่ → ดึงข้อมูลใหม่เสมอ ไม่ใช้ของที่ค้างไว้
    var force = !!sel.dataset.markedFor && sel.dataset.markedFor !== tag;

    loadResults(force).then(function (rows) {
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

  /* ── สร้างชื่อพ้องให้คลังฝึก/คลังข้อสอบ ──
     ถ้าชื่อบทในชีตไม่ตรงกับคีย์ใน PRACTICE_BANK / EMBEDDED_QB แต่ normalize แล้วตรงกัน
     → ผูกให้ชี้ข้อมูลชุดเดียวกัน (เพิ่ม property ใหม่ ไม่แก้ของเดิม) */
  function aliasChapterBanks(rows) {
    var chapters = {};
    rows.forEach(function (r) { if (r && r[3]) chapters[String(r[3]).trim()] = true; });

    function aliasOne(bank, label) {
      if (!bank) return 0;
      var byNorm = {};
      Object.keys(bank).forEach(function (k) { byNorm[chapterKey(k)] = k; });
      var n = 0;
      Object.keys(chapters).forEach(function (ch) {
        if (bank[ch]) return;                       // มีอยู่แล้ว
        var hit = byNorm[chapterKey(ch)];
        if (hit) { bank[ch] = bank[hit]; n++; }     // ผูกชื่อพ้อง
      });
      if (n) console.log('[topic-marker] ผูกชื่อพ้อง ' + label + ' ' + n + ' บท');
      return n;
    }

    try { if (typeof PRACTICE_BANK !== 'undefined') aliasOne(PRACTICE_BANK, 'PRACTICE_BANK'); } catch (e) {}
    try { if (typeof EMBEDDED_QB !== 'undefined') aliasOne(EMBEDDED_QB, 'EMBEDDED_QB'); } catch (e) {}
    try { if (window.PRACTICE_BANK) aliasOne(window.PRACTICE_BANK, 'window.PRACTICE_BANK'); } catch (e) {}
    try { if (window.EMBEDDED_QB) aliasOne(window.EMBEDDED_QB, 'window.EMBEDDED_QB'); } catch (e) {}
  }

  /* รันเมื่อหน้า p3 ถูกเปิด (มี class active) */
  function watch() {
    // ผูกชื่อพ้องให้คลังฝึกตั้งแต่เปิดหน้า (ทำครั้งเดียว)
    loadResults().then(aliasChapterBanks).catch(function () {});

    var p3 = document.getElementById('p3');
    if (!p3) return;
    if (p3.classList.contains('active')) markOptions();
    new MutationObserver(function () {
      if (p3.classList.contains('active')) markOptions();
    }).observe(p3, { attributes: true, attributeFilter: ['class'] });
  }

  /* ให้หน้าอื่นสั่งรีเฟรชได้ เช่น หลังนักเรียนส่งคะแนนเอง */
  window.refreshTopicMarks = function () {
    cache = null; cacheAt = 0;
    var sel = document.getElementById('topicFilter');
    if (sel) delete sel.dataset.markedFor;
    markOptions();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', watch);
  } else {
    watch();
  }
})();