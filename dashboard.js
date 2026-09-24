






/* ============================================================
   dashboard.js — logic ทั้งหมด (render / fetch / combobox / ฝึก / พิมพ์)
   โหลดหลัง config.js และ questionbank.js
   ── v2.0 ──
   เพิ่ม: การ์ดพัฒนาการ + trend รายครั้ง, checkbox แผนทบทวน (จำใน localStorage),
   จุดอ่อนเรื้อรัง, รายงานผู้ปกครอง 5 สไตล์ (🦅🐬🐘🦉🐝),
   แก้บั๊กกล่อง "จุดต้องแก้" ไม่รวมคอนเซปต์, เลิก hardcode "129 ข้อ"
   ── v2.1 ──
   เพิ่ม renderProgressTrend() สำหรับแท็บ 📈 พัฒนาการ (pane-progress),
   แก้ dropdown รายชื่อโชว์ครบทุกคน (เดิมตัดที่ 80 ชื่อ ทำให้กลุ่มวันจันทร์หาย),
   switchTab รองรับจำนวนแท็บไม่จำกัด, ปุ่มสลับธีม สว่าง/มืด/ตามระบบ,
   ปรับข้อความ 🦉/🐘 ไม่ผูกมัดว่าครูจะติดต่อผู้ปกครอง
   ── v3.1 (SECURITY) ──
   ย้าย login/data ไปเป็น POST — PIN ไม่ไปโผล่ใน URL อีก (ของเดิม v3.0 ส่งเป็น query string)
   ── v3.0 (SECURITY) ──
   รองรับ Apps Script proxy: ถ้า config.js มี PROXY_URL → ทุกอย่างวิ่งผ่าน proxy
   (ไม่ใช้ API key ฝั่งเว็บ, PIN ตรวจฝั่งเซิร์ฟเวอร์, กันเดา PIN รัว)
   ถ้ายังไม่มี PROXY_URL → ทำงานแบบเดิมทุกประการ (ช่วงเปลี่ยนผ่านเว็บไม่ล่ม)
   ============================================================ */
const _USE_PROXY=()=> (typeof PROXY_URL!=='undefined' && PROXY_URL);

/* ===========================================================
   ★ 14 ก.ย. 69 — GS FETCH · ยิงคำขอไป Apps Script แบบ "ทนสะดุด"

   อาการที่เจอ: จอขึ้น "โหลดไม่สำเร็จ" บ่อยมาก 3 แบบ
     1) unknown GET action:               (ไม่มีชื่อ action ต่อท้าย)
     2) เชื่อมต่อระบบไม่ได้ (HTTP 404)
     3) Unexpected token '<', "<!DOCTYPE "... is not valid JSON

   ทั้ง 3 แบบคืออาการเดียวกัน — Apps Script สะดุดชั่วคราว ไม่ใช่โค้ดเราพัง:
     · Apps Script ตอบ POST ด้วย 302 ชี้ไป URL ผลลัพธ์ชั่วคราว
       ถ้า redirect นั้นหลุด เบราว์เซอร์ยิงกลับมาที่ /exec เป็น GET เปล่า
       → doGet เห็น action = '' → ข้อความแบบ (1)
     · ระหว่าง Google รีโหลด deployment /exec จะ 404 แวบหนึ่ง → (2)
     · บางจังหวะ Google ตอบหน้า HTML (error/sign-in) แทน JSON → (3)

   วัดจริง 14 ก.ย. 69: listGroups (คำขอที่เบาที่สุด)
   ปกติ 2–3 วินาที แต่สุ่มพุ่งเกิน 9 วินาที/หลุด ราว 1 ใน 9 ครั้ง
   ของเดิมยิง fetch ตรง ๆ ไม่มี retry เลยสักจุด
   → Google สะดุดครั้งเดียว = จอ "โหลดไม่สำเร็จ" ทันที

   ของใหม่: ห่อทุกจุดด้วย gsFetch()
     · คืนค่าหน้าตาเหมือน Response เดิม (.ok .status .json() .text())
       โค้ดข้างล่างจึงไม่ต้องแก้อะไร เปลี่ยนแค่ชื่อ fetch → gsFetch
     · action ที่อ่านอย่างเดียว หรือเขียนแบบ "ตั้งค่าเป็น X"
       → ลองใหม่อัตโนมัติสูงสุด 3 ครั้ง (หน่วง 0.8 วิ แล้ว 2.2 วิ)
     · action ที่ "เพิ่ม/ลบข้อมูล" → ห้ามยิงซ้ำเด็ดขาด
       เพราะตอน redirect หลุด Apps Script อาจรันไปเรียบร้อยแล้ว
       ยิงซ้ำ = คะแนนซ้ำแถว / ลบซ้ำ / ต่อคอร์สซ้ำ ← เสียหายกว่าขึ้น error
     · timeout 30 วิ/ครั้ง กันค้างยาวจนนึกว่าเครื่องแฮงก์
   =========================================================== */
const GS_TIMEOUT_MS  = 30000;
const GS_RETRY_DELAYS = [800, 2200];      /* หน่วงก่อนลองครั้งที่ 2 และ 3 */

/* ยิงซ้ำแล้วผลลัพธ์เหมือนเดิม = ปลอดภัยที่จะ retry
   (อ่านอย่างเดียว หรือเขียนแบบ "ตั้งค่าเป็น X" ไม่ใช่ "เพิ่มอีกหนึ่งแถว") */
const GS_SAFE_ACTIONS = [
  /* ── อ่านอย่างเดียว ── */
  'listNames', 'listGroups', 'loadData', 'lookupCheckin', 'getCheckinUpdates',
  'listLeave', 'listFaces', 'students', 'marks', 'data',
  'examBatch', 'listPending', 'listArchivedGroups', 'getArchivedCourse',
  'scoreSkipList', 'scanNameVariants', 'myPendingList',
  'webLogin', 'webData', 'leaveOptions', 'login',
  /* ── เขียนทับค่าเดิม ยิงซ้ำได้ผลเท่าเดิม ── */
  'syncData', 'scoreSkipSet', 'examSetActive', 'saveFace', 'deleteFace',
  'endCheckin', 'teacherLogin', 'teacherLogout', 'updateCheckinNote',
  /* ★ 18 ก.ย. 69 — เป้าหมายคะแนน: อ่าน + เขียนทับค่าเดิม ยิงซ้ำปลอดภัยทั้งคู่ */
  'getGoal', 'setMyGoal',
  /* ★ 24 ก.ย. 69 — ใบตรวจ: อ่าน 2 ตัว · gradeFill ยิงซ้ำได้ผลเท่าเดิม (ข้อที่เป็นค่านั้นแล้วเซิร์ฟเวอร์ข้าม) */
  'myGraded', 'gradeNotes', 'gradeFill',
  'subNoteSave'   /* ★ 25 ก.ย. 69 — เซิร์ฟเวอร์กันภาพซ้ำด้วย noteId */
];

/* หาชื่อ action จาก body (POST) ก่อน ถ้าไม่มีค่อยดูใน query string (GET) */
function gsActionOf(url, init) {
  try {
    if (init && typeof init.body === 'string') {
      const b = JSON.parse(init.body);
      if (b && b.action) return String(b.action);
    }
  } catch (e) {}
  const m = String(url || '').match(/[?&]action=([^&]*)/);
  return m ? decodeURIComponent(m[1]) : '';
}

/* ต่อ &_try=N ตอนลองใหม่ กันไปโดน cache ของรอบที่เพิ่งพลาด */
function gsBust(url, n) {
  if (!n) return url;
  return url + (String(url).indexOf('?') === -1 ? '?' : '&') + '_try=' + n;
}

function gsSleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

function gsErrorText(kind, msg, canRetry, tries) {
  const tail = canRetry
    ? ' · ลองใหม่ให้แล้ว ' + tries + ' ครั้ง — กดโหลดอีกครั้งได้เลยครับ'
    : ' · คำสั่งนี้เป็นการบันทึก/ลบข้อมูล ระบบจึงไม่ยิงซ้ำอัตโนมัติ' +
      ' — กรุณาเช็คก่อนว่าเข้าไปแล้วหรือยัง แล้วค่อยกดใหม่';
  if (kind === 'timeout') return 'Google ตอบช้าเกิน 30 วินาที' + tail;
  if (kind === 'html')    return 'Google ส่งหน้าเว็บกลับมาแทนข้อมูล (ระบบกำลังสะดุด)' + tail;
  if (kind === 'lost')    return 'คำตอบจาก Google หลุดกลางทาง' + tail;
  if (kind === 'parse')   return 'อ่านคำตอบจาก Google ไม่ออก' + tail;
  if (kind === 'http')    return 'เชื่อมต่อระบบไม่ได้ (HTTP ' + msg + ')' + tail;
  try { if (navigator.onLine === false) return 'เครื่องนี้ไม่ได้ต่ออินเทอร์เน็ตอยู่ครับ'; } catch (e) {}
  return 'ต่อ Google ไม่ได้: ' + msg + tail;
}

/* ═══════════════════════════════════════════════════════════════
   gsCache — สำรองคำตอบล่าสุดไว้ในเครื่อง (16 ก.ย. 2569)

   ปัญหาที่แก้: gsFetch ลองใหม่ให้ 3 ครั้งแล้วก็จริง แต่ถ้า Apps Script
   ล่มยาว (ไม่ใช่แค่สะดุด) ทั้ง 3 ครั้งก็พลาดหมด → จอ "โหลดไม่สำเร็จ" อยู่ดี
   ชั้นนี้ทำให้ "อ่านของเก่าที่เคยโหลดสำเร็จ" ได้แทนการขึ้น error เปล่า ๆ

   กฎเหล็ก 3 ข้อ (อย่าแก้โดยไม่อ่าน claude/browser-cache-16sep2569.md)
   1. action ที่ตรวจสิทธิ์ (webLogin / teacherLogin) ห้าม cache เด็ดขาด —
      ถ้าเก็บ ok:true ไว้ ตอน Google ล่มจะกลายเป็นเข้าระบบได้โดยไม่ตรวจ PIN
   2. action ที่ผลลัพธ์ถูกเอาไป "เขียนกลับ" ห้าม cache — loadData ถูก
      pullAttendanceFromSheet merge เข้า state แล้ว sync ขึ้นชีต
      ป้อนของเก่าเข้าไป = ของเก่าทับของใหม่บนชีต
   3. ตอนใช้ของเก่า ต้องเห็นบนจอเสมอ (แถบ gsStaleBar) ห้ามเงียบ — กฎข้อ 55

   เก็บใน localStorage · TTL 24 ชม. · ผูกกับคนที่ล็อกอินอยู่
   ไม่เก็บ token/pin ทั้งในคีย์และในเนื้อข้อมูล
   ═══════════════════════════════════════════════════════════════ */
const GS_CACHE_PREFIX  = 'gsc1:';
const GS_CACHE_TTL_MS  = 24 * 60 * 60 * 1000;
const GS_CACHE_MAX     = 1500000;          /* ~1.5 MB ต่อรายการ กันชน quota */
const GS_CACHE_ACTIONS = ['webData', 'students'];

let GS_STALE_AT = 0;                        /* >0 = กำลังโชว์ของเก่าอยู่ */

/* ใครเป็นเจ้าของ cache ก้อนนี้ — เปลี่ยนคน = คนละก้อน ไม่ปนกัน */
function gsCacheOwner() {
  /* ผูกกับนักเรียนที่ล็อกอินอยู่ — เครื่องที่ใช้ร่วมกันจะไม่เห็นข้อมูลของคนก่อน */
  try { return String(currentStudent || ''); } catch (e) { return ''; }
}

/* FNV-1a — ใช้ย่อคีย์เฉย ๆ ไม่ได้ใช้ด้านความปลอดภัย */
function gsHash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
  return h.toString(36);
}

/* คีย์ต้องไม่มีความลับอยู่ในนั้น และต้องไม่เปลี่ยนตามเวลา
   → ตัด t / _try / pin / token ออกก่อนแฮชทั้งใน URL และใน body */
function gsCacheKey(action, url, init) {
  const u = String(url || '').replace(/[?&](t|_try|pin|token)=[^&]*/g, '');
  let b = '';
  try {
    if (init && typeof init.body === 'string') {
      const o = JSON.parse(init.body);
      if (o && typeof o === 'object') {
        delete o.pin; delete o.token; delete o.t;
        delete o.have;          /* ★ 16 ก.ย. 69 — ฝั่งครูใช้ have เช็คเวอร์ชัน เก็บให้บล็อกตรงกันทั้งสองไฟล์ */
        b = JSON.stringify(o);
      }
    }
  } catch (e) {}
  return GS_CACHE_PREFIX + action + ':' + gsHash(gsCacheOwner() + '|' + u + '|' + b);
}

function gsCacheable(action) { return GS_CACHE_ACTIONS.indexOf(action) !== -1; }

function gsCacheSave(key, text) {
  if (!key || typeof text !== 'string' || text.length > GS_CACHE_MAX) return;
  const rec = JSON.stringify({ at: Date.now(), text: text });
  try { localStorage.setItem(key, rec); }
  catch (e) {
    /* พื้นที่เต็ม → ทิ้ง cache ของ gsFetch ทั้งหมด แล้วลองอีกครั้งเดียว
       (ไม่วนซ้ำ และไม่แตะคีย์อื่นของเว็บ เช่น ธีม / แผนทบทวน) */
    try { gsCacheClear(); localStorage.setItem(key, rec); } catch (e2) {}
  }
}

function gsCacheLoad(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const rec = JSON.parse(raw);
    if (!rec || typeof rec.text !== 'string' || !rec.at) return null;
    if (Date.now() - rec.at > GS_CACHE_TTL_MS) { localStorage.removeItem(key); return null; }
    return rec;
  } catch (e) { return null; }
}

/* ล้างเฉพาะคีย์ของ gsFetch — เรียกตอนออกจากระบบ / เปลี่ยนคนล็อกอิน
   (โรคเดิมของ topic-marker.js: cache ที่ไม่มีวันหมดอายุ ทำให้เห็นข้อมูลคนก่อน) */
function gsCacheClear() {
  try {
    const del = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf(GS_CACHE_PREFIX) === 0) del.push(k);
    }
    for (let i = 0; i < del.length; i++) localStorage.removeItem(del[i]);
  } catch (e) {}
}

/* แถบเตือนบนสุด — สร้างเองด้วย JS จะได้ไม่ต้องแก้ไฟล์ HTML */
function gsStaleBar(show, at) {
  try {
    if (typeof document === 'undefined' || !document.body) return;
    let el = document.getElementById('gsStaleBar');
    if (!show) { if (el) el.style.display = 'none'; return; }
    if (!el) {
      el = document.createElement('div');
      el.id = 'gsStaleBar';
      el.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:99999;' +
        'background:#fef3c7;color:#92400e;border-bottom:1px solid #f59e0b;' +
        'padding:8px 14px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.08);' +
        'font:500 13px/1.6 "IBM Plex Sans Thai",Sarabun,system-ui,sans-serif;';
      document.body.appendChild(el);
    }
    const d  = new Date(at || Date.now());
    const hh = ('0' + d.getHours()).slice(-2), mm = ('0' + d.getMinutes()).slice(-2);
    el.innerHTML =
      '⚠️ Google กำลังสะดุด — กำลังแสดง<b>ข้อมูลเมื่อ ' + hh + ':' + mm + '</b> ' +
      'ที่เก็บไว้ในเครื่อง · ข้อมูลที่บันทึกหลังจากนั้นจะยังไม่ขึ้น ' +
      '<button type="button" id="gsStaleRetry" style="margin-left:8px;padding:3px 12px;' +
      'border:1px solid #f59e0b;background:#fff;color:#92400e;border-radius:7px;' +
      'font:inherit;cursor:pointer;">ลองใหม่</button>';
    const btn = document.getElementById('gsStaleRetry');
    if (btn) btn.onclick = function () { try { location.reload(); } catch (e) {} };
    el.style.display = 'block';
  } catch (e) {}
}

function gsStaleOn(at)  { GS_STALE_AT = at || Date.now(); gsStaleBar(true, GS_STALE_AT); }
function gsStaleOff()   { if (GS_STALE_AT) { GS_STALE_AT = 0; gsStaleBar(false); } }

async function gsFetch(url, init) {
  init = init || {};
  const action   = gsActionOf(url, init);
  const canRetry = GS_SAFE_ACTIONS.indexOf(action) !== -1;
  const maxTries = canRetry ? 3 : 1;
  /* ★ 16 ก.ย. 69 — คีย์สำหรับสำรองข้อมูลในเครื่อง (เฉพาะ action ที่ cache ได้) */
  const cacheKey = gsCacheable(action) ? gsCacheKey(action, url, init) : '';
  let lastKind = 'net', lastMsg = '';

  for (let n = 0; n < maxTries; n++) {
    if (n) {
      if (typeof toast === 'function')
        toast('เชื่อมต่อสะดุด · กำลังลองใหม่ (' + (n + 1) + '/' + maxTries + ')…', 'success');
      await gsSleep(GS_RETRY_DELAYS[n - 1] || 2200);
    }
    let timer = null;
    try {
      let opts = init;
      if (typeof AbortController === 'function') {
        const ctl = new AbortController();
        timer = setTimeout(function () { try { ctl.abort(); } catch (e) {} }, GS_TIMEOUT_MS);
        opts = Object.assign({}, init, { signal: ctl.signal });
      }
      const res = await fetch(gsBust(url, n), opts);
      if (timer) { clearTimeout(timer); timer = null; }
      const text = await res.text();

      /* Google ตอบหน้า HTML แทน JSON */
      if (/^\s*</.test(text)) { lastKind = 'html'; lastMsg = ''; continue; }

      let data;
      try { data = JSON.parse(text); }
      catch (e) { lastKind = 'parse'; lastMsg = ''; continue; }

      /* redirect หลุด → กลับมาที่ /exec เป็น GET เปล่า (action ว่าง) */
      if (data && data.ok === false &&
          /^unknown (GET|POST) action:\s*(undefined)?\s*$/.test(String(data.error || ''))) {
        lastKind = 'lost'; lastMsg = ''; continue;
      }

      /* HTTP ไม่ผ่าน (404/500/…) แต่ body อ่านเป็น JSON ได้ → ยังถือว่าสะดุด */
      if (!res.ok) { lastKind = 'http'; lastMsg = String(res.status); continue; }

      /* สำเร็จ → เก็บไว้เผื่อรอบหน้า Google ล่ม
         ไม่เก็บ error ทางธุรกิจ (ok:false) เพราะไม่ใช่ข้อมูล — กฎข้อ 51 */
      /* ★ 16 ก.ย. 69 — คำตอบ unchanged ไม่มีข้อมูล ห้ามเก็บทับชุดจริงที่เก็บไว้ */
      if (cacheKey && !(data && data.ok === false) && !(data && data.unchanged))
        gsCacheSave(cacheKey, text);
      gsStaleOff();
      return {
        ok: res.ok, status: res.status, gsTries: n + 1, fromCache: false,
        json: async function () { return data; },
        text: async function () { return text; }
      };
    } catch (e) {
      if (timer) clearTimeout(timer);
      lastKind = (e && e.name === 'AbortError') ? 'timeout' : 'net';
      lastMsg  = String((e && e.message) || '');
      continue;
    }
  }
  /* ★ 16 ก.ย. 69 — ยิงไม่ผ่านสักครั้ง แต่เคยโหลดสำเร็จไว้ → ใช้ของเก่าแทนจอ error
     ผู้เรียกดูได้จาก res.fromCache ว่าเป็นของเก่า (fetchExamData ใช้ข้ามการเขียนกลับ) */
  if (cacheKey) {
    const hit = gsCacheLoad(cacheKey);
    if (hit) {
      let cached = null;
      try { cached = JSON.parse(hit.text); } catch (e) { cached = null; }
      if (cached && cached.ok !== false) {
        gsStaleOn(hit.at);
        return {
          ok: true, status: 200, gsTries: maxTries, fromCache: true, cachedAt: hit.at,
          json: async function () { return cached; },
          text: async function () { return hit.text; }
        };
      }
    }
  }
  throw new Error(gsErrorText(lastKind, lastMsg, canRetry, maxTries));
}
/* ⚠️ PIN ต้องส่งด้วย POST เท่านั้น — ถ้าใส่ใน query string มันจะไปติดใน
   ประวัติเบราว์เซอร์ / Referer / log ของ Apps Script ตลอดไป
   (Content-Type ต้องเป็น text/plain ไม่งั้น Apps Script โดน CORS preflight ปัด) */
async function _proxyPost(payload){
  const res = await gsFetch(PROXY_URL, {
    method:'POST',
    headers:{'Content-Type':'text/plain;charset=utf-8'},
    body: JSON.stringify(payload)
  });
  return res.json();
}
let pinBuffer='', pinAttempts=0, currentStudent='', currentPin='';
let dashData = null;let dashErr='';let selectedGroups=null;
let diffChartInst=null, groupChartInst=null, distChartInst=null;
let trendChartInst=null, mixChartInst=null, mockChartInst=null;   /* ★ 17 ก.ย. 69 — กราฟสนามสอบเป็นใบแยก จึงต้องมี instance ของตัวเอง */

function goTo(id){ document.querySelectorAll('.page').forEach(p=>p.classList.remove('active')); document.getElementById(id).classList.add('active'); window.scrollTo(0,0); }
function resetAll(){ pinBuffer=''; pinAttempts=0; updatePinDots(); document.getElementById('attemptsMsg').textContent=''; document.getElementById('p2status').textContent=''; }

let studentList=[], selectedStudent='', comboIdx=-1;
/* ⚠️ 18 ส.ค. 69: ทุก fetch ที่ยิง Google Sheets API ต้องต่อ &t=Date.now() เสมอ
   ไม่งั้นเบราว์เซอร์แคชคำตอบเดิมไว้ → ครูกรอกคะแนนใหม่แล้วนักเรียนยังเห็นข้อมูลเก่า
   (หน้าครู teacher-dashboard.html ทำแบบนี้อยู่แล้ว จึงเห็นคะแนนใหม่ทันที) */
async function loadStudents(){
  document.getElementById('p1status').className='status';
  document.getElementById('p1status').textContent='กำลังโหลดรายชื่อ...';
  try{
    if(_USE_PROXY()){
      const res=await gsFetch(PROXY_URL+'?action=students&t='+Date.now());
      const data=await res.json();
      if(!data.ok){document.getElementById('p1status').className='status err';document.getElementById('p1status').textContent='Error: '+(data.error||'โหลดรายชื่อไม่ได้');return;}
      studentList=data.students||[];
    }else{
      const res=await fetch(`${BASE}/${SHEET_ID}/values/students!B2:B500?key=${API_KEY}&t=${Date.now()}`);
      const data=await res.json();
      if(data.error){document.getElementById('p1status').className='status err';document.getElementById('p1status').textContent='Error: '+data.error.message;return;}
      const seen=new Set(); studentList=[];
      (data.values||[]).forEach(r=>{if(r[0]&&!seen.has(r[0])){seen.add(r[0]);studentList.push(r[0]);}});
    }
    document.getElementById('p1status').className='status ok';
    document.getElementById('p1status').textContent=`โหลดแล้ว ${studentList.length} คน — พิมพ์ชื่อเพื่อค้นหาได้เลย ✓`;
    const inp=document.getElementById('studentSearch'); if(inp){inp.placeholder='พิมพ์ชื่อเพื่อค้นหา… ('+studentList.length+' คน)';}
  }catch(e){document.getElementById('p1status').className='status err';document.getElementById('p1status').textContent='โหลดไม่ได้: '+e.message;}
}
/* ═══════════════════════════════════════════════════════════════
   วันที่ — เพิ่ม 13 ส.ค. 69
   ชีตตั้ง locale อเมริกา Google Sheets API จึงส่งวันที่กลับมาเป็นข้อความ
   "7/23/2026" = เดือน/วัน/ปี  ทำให้ (1) แสดงผลสลับ (2) เรียงลำดับไม่ได้
   ⚠️ ห้ามแก้ด้วยการเปลี่ยน locale ของชีต เพราะ saveExamScore ฝั่ง Apps Script
      รับค่าเป็น M/D/YYYY อยู่ — ต้องแก้ที่ฝั่งแสดงผลเท่านั้น
   ═══════════════════════════════════════════════════════════════ */
function _dMake(y,mo,d){ if(y>2400)y-=543; return new Date(y,mo-1,d); }

/* อ่านวันที่ได้ทุกรูปแบบที่เจอในชีต → Date (อ่านไม่ออกคืน null) */
function _dParse(v){
  if(v instanceof Date) return v;
  var s=String(v==null?'':v).trim();
  if(!s) return null;
  var m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);            // 2026-08-01
  if(m) return _dMake(+m[1],+m[2],+m[3]);
  m=s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);   // 7/23/2026 หรือ 23/7/2026
  if(m){ var a=+m[1],b=+m[2];
         return a>12 ? _dMake(+m[3],b,a) : _dMake(+m[3],a,b); }  // ตัวแรก>12 = วันมาก่อน
  var t=Date.parse(s);
  return isNaN(t)?null:new Date(t);
}

/* แสดงผลเป็น วัน/เดือน/ปี พ.ศ. เช่น 23/07/2569
   ── อยากกลับไปใช้ ค.ศ. (23/07/2026) เปลี่ยน DATE_BE เป็น false บรรทัดเดียวจบ ── */
var DATE_BE = true;
function _dFmt(v){
  var d=_dParse(v);
  if(!d) return String(v==null?'':v);
  var p=function(n){ return ('0'+n).slice(-2); };
  return p(d.getDate())+'/'+p(d.getMonth()+1)+'/'+(d.getFullYear()+(DATE_BE?543:0));
}

/* คีย์สำหรับเรียงลำดับ — อ่านวันที่ไม่ออกให้ไปอยู่ท้ายสุด */
function _dKey(v){ var d=_dParse(v); return d?d.getTime():8.64e15; }

function _esc(s){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function filterStudents(){
  const inp=document.getElementById('studentSearch'); const box=document.getElementById('studentOptions');
  if(!inp||!box)return;
  const q=inp.value.trim().toLowerCase();
  if(selectedStudent && inp.value!==selectedStudent) selectedStudent='';
  if(!studentList.length){ box.innerHTML='<div class="combo-empty">กด "โหลดรายชื่อ" ก่อนครับ</div>'; box.classList.add('open'); return; }
  let matches = q ? studentList.filter(n=>n.toLowerCase().includes(q)) : studentList.slice();
  comboIdx=-1;
  if(!matches.length){ box.innerHTML='<div class="combo-empty">ไม่พบชื่อที่ตรงกับ "'+_esc(inp.value)+'"</div>'; box.classList.add('open'); return; }
  box.innerHTML = matches.map((n,i)=>{
    let disp=_esc(n);
    if(q){ const idx=n.toLowerCase().indexOf(q); if(idx>=0){ disp=_esc(n.slice(0,idx))+'<span class="hl">'+_esc(n.slice(idx,idx+q.length))+'</span>'+_esc(n.slice(idx+q.length)); } }
    return `<div class="combo-opt" data-name="${_esc(n)}" onclick="pickStudent(this.getAttribute('data-name'))">${disp}</div>`;
  }).join('');
  box.classList.add('open');
}
function pickStudent(name){
  selectedStudent=name;
  const inp=document.getElementById('studentSearch'); if(inp)inp.value=name;
  document.getElementById('studentOptions').classList.remove('open');
  document.getElementById('p1status').textContent='';
}
function comboKey(e){
  const box=document.getElementById('studentOptions');
  const opts=[...box.querySelectorAll('.combo-opt')];
  if(e.key==='ArrowDown'){e.preventDefault();comboIdx=Math.min(comboIdx+1,opts.length-1);}
  else if(e.key==='ArrowUp'){e.preventDefault();comboIdx=Math.max(comboIdx-1,0);}
  else if(e.key==='Enter'){e.preventDefault(); if(comboIdx>=0&&opts[comboIdx]){pickStudent(opts[comboIdx].getAttribute('data-name'));} else if(opts.length===1){pickStudent(opts[0].getAttribute('data-name'));} else {goToPin();} return;}
  else return;
  opts.forEach((o,i)=>o.classList.toggle('active',i===comboIdx));
  if(opts[comboIdx])opts[comboIdx].scrollIntoView({block:'nearest'});
}
document.addEventListener('click',e=>{ const c=document.getElementById('studentCombo'); const box=document.getElementById('studentOptions'); if(c&&box&&!c.contains(e.target))box.classList.remove('open'); });

function goToPin(){
  let name=selectedStudent;
  if(!name){ const typed=(document.getElementById('studentSearch').value||'').trim(); const exact=studentList.find(n=>n===typed); const ci=typed?studentList.filter(n=>n.toLowerCase().includes(typed.toLowerCase())):[]; if(exact)name=exact; else if(ci.length===1)name=ci[0]; }
  if(!name){document.getElementById('p1status').className='status err';document.getElementById('p1status').textContent='กรุณาพิมพ์แล้วเลือกชื่อจากรายการก่อนครับ';return;}
  selectedStudent=name; document.getElementById('studentSearch').value=name; document.getElementById('studentOptions').classList.remove('open');
  /* ★ 16 ก.ย. 69 — เปลี่ยนคน = ทิ้ง cache ของคนก่อน (เครื่องที่ใช้ร่วมกัน) */
  if(currentStudent && currentStudent!==name) gsCacheClear();
  currentStudent=name;
  const short=name.replace(/\s*\(.*\)/,'');
  document.getElementById('p2avatar').textContent=short.substring(0,3);
  document.getElementById('p2name').textContent=short;
  pinBuffer=''; pinAttempts=0; updatePinDots();
  document.getElementById('attemptsMsg').textContent='';
  document.getElementById('p2status').textContent='';
  goTo('p2');
}

function updatePinDots(shake=false,isError=false){
  for(let i=0;i<4;i++){
    const d=document.getElementById('dot'+i);
    d.className='pin-dot'+(i<pinBuffer.length?(isError?' error':' filled'):'');
  }
  if(shake){const disp=document.getElementById('pinDots');disp.style.animation='none';disp.offsetHeight;disp.style.animation='shake .4s ease';}
}
function pinAdd(n){if(pinBuffer.length>=4)return;pinBuffer+=String(n);updatePinDots();if(pinBuffer.length===4)setTimeout(verifyPin,150);}
function pinDel(){if(pinBuffer.length>0){pinBuffer=pinBuffer.slice(0,-1);updatePinDots();}}

async function verifyPin(){
  document.getElementById('p2status').textContent='กำลังตรวจสอบ...';
  try{
    let pinOk=false, pinErr='';
    if(_USE_PROXY()){
      // v3: ตรวจ PIN ฝั่งเซิร์ฟเวอร์ — PIN ของคนอื่นไม่ถูกส่งมาที่เบราว์เซอร์เลย
      const data=await _proxyPost({action:'webLogin', name:currentStudent, pin:pinBuffer});
      pinOk=!!data.ok; pinErr=data.error||'';
    }else{
      const res=await fetch(`${BASE}/${SHEET_ID}/values/students!B2:F500?key=${API_KEY}&t=${Date.now()}`);
      const data=await res.json();
      if(data.error){document.getElementById('p2status').textContent='Error: '+data.error.message;return;}
      const rows=data.values||[];
      const row=rows.find(r=>r[0]===currentStudent);
      const correctPin=row&&row[4]?String(row[4]).trim():null;
      if(!correctPin){pinErr='ยังไม่ได้ตั้ง PIN — กรุณาติดต่อครู';}
      else pinOk=(pinBuffer===correctPin);
    }
    // error พิเศษ (ยังไม่ตั้ง PIN / โดนล็อกชั่วคราว) → แจ้งตรงๆ ไม่นับครั้งผิด
    if(!pinOk&&pinErr&&pinErr!=='PIN ไม่ถูกต้อง'){
      document.getElementById('p2status').className='status err';
      document.getElementById('p2status').textContent=pinErr;
      pinBuffer=''; updatePinDots(); return;
    }
    if(pinOk){
      currentPin=pinBuffer;
      document.getElementById('p2status').textContent='';
      const short=currentStudent.replace(/\s*\(.*\)/,'');
      document.getElementById('modeAvatar').textContent=short.substring(0,3);
      document.getElementById('modeName').textContent=short;
      /* ★ 18 ก.ย. 69 (แก้ 2) — ห้ามให้ล็อกอินรอเป้า
         getGoal อยู่ใน GS_SAFE_ACTIONS จึง retry ได้ 3 ครั้ง (หน่วง 0.8 + 2.2 วิ)
         ถ้า Apps Script ยังไม่ deploy หรือสะดุด การล็อกอินจะช้าขึ้นหลายวินาทีทันที
         ค่าเป้าใช้แค่ตอนเปิดแท็บพัฒนาการ → ย้ายไปโหลดตอนนั้นแทน (goalEnsure) */
      await fetchDashData();
      goTo('p3');
    } else {
      pinAttempts++;
      updatePinDots(true,true);
      const rem=5-pinAttempts;
      if(pinAttempts>=5){document.getElementById('attemptsMsg').textContent='PIN ผิดหลายครั้ง กรุณาติดต่อครู';document.querySelectorAll('.num-btn').forEach(b=>b.disabled=true);}
      else{document.getElementById('attemptsMsg').textContent=`PIN ไม่ถูกต้อง (เหลือ ${rem} ครั้ง)`;}
      document.getElementById('p2status').textContent='';
      setTimeout(()=>{pinBuffer='';updatePinDots();},600);
    }
  }catch(e){document.getElementById('p2status').textContent='เกิดข้อผิดพลาด: '+e.message;pinBuffer='';updatePinDots();}
}

// ── YouTube: ค้นหาคลิปในช่อง mathsbanktutor ตามหัวข้อ ──
function ytLink(topic){
  return 'https://www.youtube.com/@' + YT_CHANNEL + '/search?query=' + encodeURIComponent(topic);
}
function ytBtn(query,label){
  return `<a href="${ytLink(query)}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:5px;background:var(--surf,#FAF9F5);color:#B3261E;border:1px solid #E4C7C5;font-size:11px;font-weight:500;padding:4px 10px;border-radius:12px;text-decoration:none;margin-top:6px" class="subtopic-clip-btn">▶ ${label||'ดูคลิปติว'}</a>`;
}



/* ★ 29 ส.ค. 69 — คะแนนไม่เท่ากันทุกข้อ (ชุดรวม/สนามสอบ)
   ตัวจริงอยู่ใน questionbank.js (MOCK_SETS) — ตรงนี้เป็นทางถอยเผื่อโหลดไฟล์เก่าค้าง
   บทปกติจะได้ 30 เสมอ พฤติกรรมเดิมจึงไม่เปลี่ยน */
function _fullOf(topic){
  try{ if(typeof fullScoreOf==='function') return fullScoreOf(topic); }catch(e){}
  return 30;
}
function _scoreOf(row, topic){
  try{ if(typeof scoreOfRow==='function') return scoreOfRow(row, topic); }catch(e){}
  return parseInt(row[36])||0;
}

/* ★ 17 ก.ย. 69 — เป้าหมายของสนามสอบตั้งค่าได้ต่อชุด
   ของเดิมใช้ 25/30 แปลงสัดส่วนเป็น 83/100 ซึ่งสูงมากสำหรับข้อสอบรวมทุกบท
   ครูตั้งเองได้โดยเพิ่ม goal ลงใน MOCK_SETS["ชุดรวม NN"] ใน questionbank.js
   เช่น MOCK_SETS["ชุดรวม 01"].goal = 65;  (ไม่ใส่ = ใช้ค่าเดิม 83) */
function MOCK_GOAL_OF(chapter){
  try{
    const s = (typeof MOCK_SETS!=='undefined') ? MOCK_SETS[chapter] : null;
    if(s && typeof s.goal === 'number' && s.goal > 0) return Math.round(s.goal);
  }catch(e){}
  return 0;
}

function _isMock(t){
  try{ if(typeof isMockChapter==='function') return isMockChapter(t); }catch(e){}
  return /^ชุดรวม\s*\d*/.test(String(t||'').trim());
}

/* ถ้าเก็บข้อที่สะเพร่าได้ครบ จะได้คะแนนเท่าไร — ชุดรวมต้องบวกตามคะแนนรายข้อ ไม่ใช่ +1 ต่อข้อ */
function _careGain(d){
  const full=d.full||30;
  if(full===30) return Math.min(30,(d.score||0)+(d.care||0));
  let g=0;
  for(let q=1;q<=30;q++){
    if((d.qResults||{})[q]==='care'){
      try{ g+= (typeof ptsOfQuestion==='function')?ptsOfQuestion(d.topic,q):1; }catch(e){ g+=1; }
    }
  }
  return Math.min(full,(d.score||0)+g);
}

// ── emoji ของหมวด: ถ้าชื่อหมวดมี emoji นำหน้าแล้ว (บทใหม่) → ไม่เติมซ้ำ ──
function emojiOf(cat){
  cat=cat||'';
  if(/^[\u{1F534}\u{1F535}\u{1F7E0}\u{1F7E1}\u{1F7E2}\u{1F7E3}\u{1F7E4}\u{26AB}\u{26AA}]/u.test(cat)) return '';
  return (typeof CAT_EMOJI!=='undefined' && CAT_EMOJI[cat]) || '\u2022';
}
// ── หมวดหมู่: แปลงชื่อ sub-topic ของข้อสอบ → หมวดของคลังฝึก ──
// บทแบบใหม่ (ตรีโกณ ฯลฯ): sub = ชื่อหมวดพร้อม emoji อยู่แล้ว → คืนค่าตรงๆ
// บทเก่า (Expo Logarithm): เดาหมวดจาก keyword
function catOf(s){
  s=s||'';
  // ถ้าขึ้นต้นด้วย emoji วงกลมสี (หมวดแบบใหม่) → เป็นชื่อหมวดอยู่แล้ว คืนค่าตรงๆ
  if(/^[\u{1F534}\u{1F535}\u{1F7E0}\u{1F7E1}\u{1F7E2}\u{1F7E3}\u{1F7E4}\u{26AB}\u{26AA}]/u.test(s)) return s;
  // ── logic เดิมสำหรับ Expo Logarithm ──
  if(/อสมการ/.test(s)){ if(/ล็อก|log/i.test(s)) return 'อสมการล็อการิทึม'; return 'อสมการเอกซ์โพเนนเชียล'; }
  if(/กราฟ|เปรียบเทียบ/.test(s)) return 'กราฟฟังก์ชัน';
  if(/ประยุกต์/.test(s)) return 'โจทย์ประยุกต์';
  if(/สมบัติ|ทฤษฎี|แปลงฐาน/.test(s)) return 'สมบัติ/ทฤษฎีบท';
  if(/ล็อก|log/i.test(s)) return 'สมการล็อการิทึม';
  if(/เอกซ์โพ|expo/i.test(s)) return 'สมการเอกซ์โพเนนเชียล';
  return 'สมบัติ/ทฤษฎีบท';
}
function _shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

// ── พิมพ์ชุดฝึกออกมาเป็นกระดาษ/PDF ──
function printPracticeSet(){
  const p=window.__practicePlan;
  if(!p||!p.cats||!p.cats.length){alert('ยังไม่มีชุดฝึก — ทำได้แม่นทุกหัวข้อแล้วครับ');return;}
  const esc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  let body='';
  p.cats.forEach(c=>{
    let rows='';
    c.picks.forEach(q=>{
      const stars='★'.repeat(q.l)+'☆'.repeat(5-q.l);
      rows+=`<tr><td class="chk">☐</td><td class="qn">ข้อ ${q.n}</td><td class="src">${esc(q.s)}</td><td class="lvl">ระดับ ${q.l} ${stars}</td><td class="yt"><a href="${q.yt}">▶ ดูเฉลย</a><div class="url">${esc(q.yt)}</div></td></tr>`;
    });
    body+=`<div class="cat"><div class="cat-h"><span>${c.emoji} ${esc(c.cat)}</span><span class="pct">พลาด ${c.pct}% · ฝึก ${c.picks.length} ข้อ</span></div><table>${rows}</table></div>`;
  });
  const doc=`<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><title>ชุดฝึก ${esc(p.name)}</title>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0;font-family:'Sarabun',sans-serif}
body{padding:28px 30px;color:#1a1a1a;font-size:13px}
.hd{border-bottom:2px solid #185FA5;padding-bottom:12px;margin-bottom:18px}
.hd h1{font-size:20px;font-weight:700;color:#185FA5}
.hd .meta{font-size:13px;color:#555;margin-top:4px}
.hd .sum{font-size:12px;color:#777;margin-top:6px}
.cat{margin-bottom:18px;page-break-inside:avoid}
.cat-h{display:flex;justify-content:space-between;align-items:center;background:#F0EEE9;border-radius:6px;padding:8px 12px;font-weight:600;font-size:14px;margin-bottom:6px}
.cat-h .pct{font-size:12px;color:#A32D2D;font-weight:500}
table{width:100%;border-collapse:collapse}
td{padding:7px 8px;border-bottom:1px solid #e5e5e5;vertical-align:top}
.chk{font-size:16px;width:24px}
.qn{font-weight:600;white-space:nowrap;width:60px}
.src{color:#444}
.lvl{color:#BA7517;white-space:nowrap;font-size:11px}
.yt a{color:#B3261E;text-decoration:none;font-weight:600;font-size:12px}
.yt .url{font-size:9px;color:#999;word-break:break-all;margin-top:2px}
.ft{margin-top:20px;padding-top:12px;border-top:1px solid #ddd;font-size:11px;color:#888;line-height:1.6}
@media print{body{padding:0}@page{margin:1.4cm}}
</style></head><body>
<div class="hd"><h1>🎯 ชุดฝึกเพิ่ม — ${esc(p.name)}</h1><div class="meta">บท ${esc(p.topic)} · จากผลสอบวันที่ ${esc(_dFmt(p.date))}</div><div class="sum">รวม ${p.grand} ข้อ · เลือกจากคลังข้อสอบจริง ${p.bankCount||''} ข้อ ตามสัดส่วนที่ยังไม่แม่น</div></div>
${body}
<div class="ft">วิธีใช้: ทำโจทย์แต่ละข้อก่อน (เปิดหนังสือรวมข้อสอบบท Expo+Log ตาม "ข้อ N") แล้วเช็กกล่อง ☐ เมื่อทำเสร็จ จากนั้นดูเฉลยวิดีโอตามลิงก์เพื่อทบทวนวิธีคิด · MathsBankTutor</div>
</body></html>`;
  const f=document.createElement('iframe');
  f.style.position='fixed';f.style.right='0';f.style.bottom='0';f.style.width='0';f.style.height='0';f.style.border='0';
  document.body.appendChild(f);
  const fd=f.contentWindow.document; fd.open(); fd.write(doc); fd.close();
  const go=()=>{ try{f.contentWindow.focus();f.contentWindow.print();}catch(e){} setTimeout(()=>{document.body.removeChild(f);},1500); };
  setTimeout(go,600);
}

// ── แผนฝึกเพิ่ม: เลือกข้อจากคลัง 129 ข้อ ตามสัดส่วนที่พลาดในแต่ละหัวข้อ ──

/* ═══════════════════════════════════════════════════════════════
   ★ 29 ส.ค. 69 — สนามสอบ (ชุดรวมทุกบท) ฝั่งนักเรียน
   1) เติมชุดรวมเข้าช่องเลือกบทเอง — ไม่ต้องแก้ index.html
   2) การ์ด "จุดอ่อนรายบท" — สร้าง element เองแล้วแทรกก่อนแท็บฝึกเพิ่ม
   3) แท็บฝึกเพิ่มแบบข้ามบท — จัดกลุ่มตามบท เรียงบทที่พลาดหนักสุดก่อน
   ═══════════════════════════════════════════════════════════════ */

/* เติม option ชุดรวมเข้า #topicFilter (เรียกซ้ำได้ ไม่เพิ่มซ้ำ) */
function ensureMockOptions(){
  const sel=document.getElementById('topicFilter');
  if(!sel||typeof MOCK_SETS==='undefined')return;
  const have={}; Array.from(sel.options).forEach(o=>{have[String(o.value).trim()]=1;});
  Object.keys(MOCK_SETS).sort().forEach(k=>{
    if(have[k])return;
    const o=document.createElement('option');
    o.value=k;
    o.textContent='🎯 '+k+(MOCK_SETS[k].title?' · '+MOCK_SETS[k].title:'');
    sel.appendChild(o);
  });
  /* ★ 20 ก.ย. 69 — จัดกลุ่มตัวเลือกให้เห็นชัดว่าอันไหนแยกบท อันไหนสนามสอบ
     (ของเดิมปนกันในรายการเดียว นักเรียนเลือกแล้วไม่รู้ว่ากำลังดูประเภทไหนอยู่) */
  if(!sel.querySelector('optgroup')){
    const opts=Array.from(sel.options);
    const gChap=document.createElement('optgroup'); gChap.label='📘 ข้อสอบแยกบท (เต็ม 30 คะแนน)';
    const gMock=document.createElement('optgroup'); gMock.label='🎯 สนามสอบรวมทุกบท (เต็ม 100 คะแนน)';
    opts.forEach(o=>{
      const v=String(o.value||'').trim();
      if(!v) return;                       /* ตัวเลือก "ทุกบท" ให้อยู่บนสุดนอกกลุ่ม */
      (_isMock(v)?gMock:gChap).appendChild(o);
    });
    if(gChap.children.length) sel.appendChild(gChap);
    if(gMock.children.length) sel.appendChild(gMock);
  }
}

/* ★ 20 ก.ย. 69 — ตอนนี้กำลังดูประเภทไหน: ยึดตามบทที่เลือกในช่องด้านบน
   ไม่ได้เลือก (ทุกบท) → ใช้ประเภทของผลสอบล่าสุด */
function viewKind(d){
  const sel=document.getElementById('topicFilter');
  const v=sel?String(sel.value||'').trim():'';
  if(v) return _isMock(v)?'mock':'chap';
  if(d && d.allHistory && d.allHistory.length) return d.allHistory[d.allHistory.length-1].isMock?'mock':'chap';
  if(d && d.isMock!=null) return d.isMock?'mock':'chap';
  return 'chap';
}

/* แถบบอกว่ากำลังดูประเภทไหน + วิธีสลับ (ขึ้นบนสุดของแท็บพัฒนาการ) */
function kindBannerHTML(kind, nChap, nMock){
  const isMock = kind==='mock';
  const other  = isMock ? ('ข้อสอบแยกบท' + (nChap?' ('+nChap+' ครั้ง)':'')) 
                        : ('สนามสอบรวมบท' + (nMock?' ('+nMock+' ชุด)':''));
  return '<div class="d-card" style="padding:.8rem 1rem;border-left:4px solid '+(isMock?'#185FA5':'#4C9A2A')+'">'
    + '<div style="font-size:13px;color:var(--text1);font-weight:600">'
    +   (isMock?'🎯 กำลังดู: สนามสอบรวมทุกบท (เต็ม 100 คะแนน)':'📘 กำลังดู: ข้อสอบแยกบท (เต็ม 30 คะแนน)') + '</div>'
    + '<div style="font-size:11.5px;color:var(--text2);margin-top:5px;line-height:1.7">'
    +   'หน้านี้แสดงเฉพาะ' + (isMock?'สนามสอบ':'ข้อสอบแยกบท') + 'อย่างเดียว ไม่ปนกัน — '
    +   'อยากดู<b>' + other + '</b> ให้เลือกจากช่อง<b>เลือกบท</b>ด้านบนสุดของหน้า</div>'
    + '</div>';
}

/* ข้อที่ออกในชุดรวม แยกตามบท → [{ch, ok, total, miss:[{q,sub,also}]}] เรียงพลาดหนักสุดก่อน */
function mockByChapter(d){
  const qb=(typeof EMBEDDED_QB!=='undefined')?EMBEDDED_QB[d.topic]:null;
  if(!qb)return[];
  const by={};
  for(let q=1;q<=30;q++){
    const info=qb[q]; if(!info||!info.ch)continue;
    const st=(d.qResults||{})[q];
    if(!st||st==='blank')continue;                  /* ข้อที่ไม่ได้ทำ/ยังไม่กรอก — ไม่นับ */
    const g=by[info.ch]||(by[info.ch]={ch:info.ch,ok:0,total:0,qs:[],miss:[]});
    g.total++; g.qs.push(q);
    if(st==='ok')g.ok++;
    else g.miss.push({q:q,sub:info.sub||'',also:info.also||[],st:st});
  }
  return Object.values(by).sort((a,b)=>{
    const ra=(a.total-a.ok)/a.total, rb=(b.total-b.ok)/b.total;
    return rb-ra || (b.total-b.ok)-(a.total-a.ok) || a.ch.localeCompare(b.ch,'th');
  });
}

/* ── การ์ดจุดอ่อนรายบท (เฉพาะสนามสอบ) ── */
function renderChapterWeak(d){
  const host=document.getElementById('s-practice'); if(!host)return;
  let el=document.getElementById('s-chapweak');
  if(!d.isMock){ if(el)el.innerHTML=''; return; }
  if(!el){ el=document.createElement('div'); el.id='s-chapweak'; host.parentNode.insertBefore(el,host); }

  const list=mockByChapter(d);
  if(!list.length){ el.innerHTML=''; return; }

  const weak=list.filter(g=>g.ok<g.total);
  const perfect=list.filter(g=>g.ok===g.total);
  const colorOf=r=>r>=0.7?'#B42318':r>=0.5?'#C2410C':'#D97706';

  const rows=weak.map(g=>{
    const missN=g.total-g.ok, r=missN/g.total, pct=Math.round(r*100);
    return '<div style="display:grid;grid-template-columns:minmax(96px,150px) 1fr 66px;gap:9px;align-items:center;padding:4px 0">'
      + '<div style="font-size:12.5px;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="'+_esc(g.ch)+'">'+_esc(g.ch)+'</div>'
      + '<div style="height:15px;background:rgba(128,128,128,.13);border-radius:4px;overflow:hidden">'
      +   '<div style="height:100%;width:'+pct+'%;background:'+colorOf(r)+';border-radius:0 4px 4px 0"></div></div>'
      + '<div style="font-size:11px;color:var(--text2);text-align:right;white-space:nowrap">'+g.ok+'/'+g.total+' ข้อ</div></div>';
  }).join('');

  const okLine=perfect.length
    ? '<div style="display:grid;grid-template-columns:minmax(96px,150px) 1fr 66px;gap:9px;align-items:center;padding:4px 0">'
      + '<div style="font-size:12.5px;text-align:right;color:var(--text2)">อีก '+perfect.length+' บท</div><div></div>'
      + '<div style="font-size:11px;color:var(--green,#2F855A);text-align:right">ถูกครบ ✓</div></div>'
    : '';

  const tbl=list.map(g=>'<tr><td style="padding:4px 6px;border-bottom:1px solid rgba(128,128,128,.15)">'+_esc(g.ch)
      +'</td><td style="padding:4px 6px;border-bottom:1px solid rgba(128,128,128,.15);font-size:11px;color:var(--text3)">ข้อ '+g.qs.join(', ')
      +'</td><td style="padding:4px 6px;border-bottom:1px solid rgba(128,128,128,.15);text-align:right">'+g.ok+'/'+g.total+'</td></tr>').join('');

  el.innerHTML='<div class="d-card"><div class="slabel">🧭 จุดอ่อนรายบท</div>'
    + '<div style="font-size:12.5px;color:var(--text2);line-height:1.7;margin-bottom:10px">'
    +   'ชุดนี้ออกคละ <b>'+list.length+' บท</b> — แท่งยาว = บทที่พลาดสัดส่วนมาก ควรกลับไปซ่อมก่อน</div>'
    + (rows||'<div style="font-size:13px;color:var(--green,#2F855A);padding:4px 0">ถูกครบทุกบทเลย เก่งมาก! 🎉</div>')
    + okLine
    + '<div style="font-size:11px;color:var(--text3);margin-top:9px;padding-top:8px;border-top:1px solid rgba(128,128,128,.15);line-height:1.8">'
    +   'ตัวเลขขวา = ทำถูก/ข้อที่ออกในบทนั้น · แถบแดงเข้ม = พลาด 70%+ · ส้ม = 50–69% · เหลือง = ต่ำกว่า 50%</div>'
    + '<details style="margin-top:8px"><summary style="font-size:12px;color:var(--text2);cursor:pointer">ดูว่าเป็นข้อไหนบ้าง</summary>'
    +   '<table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:6px">'+tbl+'</table></details>'
    + '</div>';
}

/* ── แท็บฝึกเพิ่มสำหรับสนามสอบ — แยกกลุ่มตามบท ── */
function renderMockPractice(d,el){
  const list=mockByChapter(d).filter(g=>g.miss.length);
  if(!list.length){
    el.innerHTML='<div class="d-card"><div class="slabel">🎯 ฝึกเพิ่มตามจุดที่พลาด</div>'
      +'<div style="font-size:14px;color:var(--green,#2F855A);padding:6px 0">ถูกครบทุกข้อในชุดนี้ ไม่ต้องฝึกเพิ่ม เก่งมาก! 🎉</div></div>';
    return;
  }

  /* คลังของบทหนึ่ง = คลังหลัก + คลัง Ent ของบทเดียวกัน */
  const bankOf=ch=>{
    let b=PRACTICE_BANK[ch];
    if(!b){ const base=String(ch).replace(/\s*ชุดที่\s*\d+\s*$/,'').trim(); b=PRACTICE_BANK[base]; }
    if(!b)return null;
    const base=String(ch).replace(/\s*ชุดที่\s*\d+\s*$/,'').trim();
    const ent=PRACTICE_BANK[base+' Ent'];
    return ent?b.concat(ent):b;
  };

  let grand=0; const cards=[]; const planForPrint=[];
  list.forEach((g,gi)=>{
    const missN=g.miss.length, rate=missN/g.total, pct=Math.round(rate*100);
    const bank=bankOf(g.ch);
    /* หมวดที่พลาดในบทนี้ (ไม่ซ้ำ) พร้อมจำนวนข้อที่พลาดในหมวดนั้น */
    const subs={};
    g.miss.forEach(m=>{ (subs[m.sub]=subs[m.sub]||{sub:m.sub,qs:[],also:m.also}).qs.push(m.q); });
    const subList=Object.values(subs);

    let rows='', picked=0;
    if(bank){
      subList.forEach(sObj=>{
        /* พลาดหมวดนี้กี่ข้อ → เสนอ 2 เท่า (อย่างน้อย 2 มากสุด 5) และไม่เกินที่คลังมีจริง */
        let pool=bank.filter(q=>q.c===sObj.sub);
        if(!pool.length){
          /* หมวดนี้ไม่มีในคลังของบทนี้ → ลองบทที่ข้อนั้นพาดถึง */
          (sObj.also||[]).forEach(alt=>{ const ab=bankOf(alt); if(ab)pool=pool.concat(ab.filter(q=>q.c===sObj.sub)); });
        }
        if(!pool.length)return;
        pool=pool.slice().sort((a,b)=>a.l-b.l);
        let need=Math.min(5,Math.max(2,sObj.qs.length*2));
        need=Math.min(need,pool.length);
        const pick=[];
        if(pool.length<=need){ pick.push.apply(pick,pool); }
        else { const step=pool.length/need; for(let i=0;i<need;i++)pick.push(pool[Math.floor(i*step)]); }
        picked+=pick.length; grand+=pick.length;
        planForPrint.push({cat:g.ch+' · '+sObj.sub,emoji:'',pct:pct,ok:g.ok,total:g.total,
          picks:pick.map(q=>({n:q.n,s:q.s,l:q.l,yt:q.yt}))});
        pick.forEach(q=>{
          const stars='★'.repeat(q.l)+'☆'.repeat(5-q.l);
          rows+='<div class="rev-row"><div style="flex:1"><div style="font-size:12px;color:var(--text1);font-weight:500">ข้อ '+q.n
            +' <span style="color:var(--text3);font-weight:400">· '+_esc(String(q.s||''))+'</span></div>'
            +'<div style="font-size:10px;color:var(--text3)">'+_esc(String(sObj.sub))+' · ระดับ '+q.l+' <span style="color:#BA7517">'+stars+'</span></div></div>'
            +'<a href="'+q.yt+'" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:5px;background:var(--surf,#FAF9F5);color:#B3261E;border:1px solid #E4C7C5;font-size:11px;font-weight:500;padding:5px 12px;border-radius:12px;text-decoration:none;white-space:nowrap">▶ เฉลย</a></div>';
        });
      });
    }

    const missTxt=g.miss.map(m=>'<b>ข้อ '+m.q+'</b> · '+_esc(String(m.sub))).join(' &nbsp;·&nbsp; ');
    const badgeCls=rate>=0.7?'diff-bad':'diff-warn';
    const foot=!bank
      ? 'ยังไม่มีคลังฝึกของบท "'+_esc(g.ch)+'" ในระบบ'
      : (picked?('เลือกจากคลัง'+_esc(g.ch)+' '+bank.length+' ข้อ — เสนอ '+picked+' ข้อ ไล่จากง่ายไปยาก')
               :('คลังบทนี้ยังไม่มีข้อในหัวข้อที่พลาด'));

    cards.push('<div class="d-card" style="padding-top:12px">'
      + '<div style="display:flex;align-items:center;gap:9px;justify-content:space-between;flex-wrap:wrap;margin-bottom:5px">'
      +   '<div style="font-size:14px;font-weight:600;color:var(--text1)">'+(gi+1)+' · '+_esc(g.ch)+'</div>'
      +   '<div class="diff-badge '+badgeCls+'">พลาด '+pct+'%</div></div>'
      + '<div style="font-size:11.5px;color:var(--text2);line-height:1.8;margin-bottom:6px">ทำผิด '+missTxt+'</div>'
      + rows
      + '<div style="font-size:11px;color:var(--text3);margin-top:7px">'+foot+'</div></div>');
  });

  window.__practicePlan={name:d.shortName,topic:d.topic,date:d.date,grand:grand,bankCount:0,cats:planForPrint};
  const head='<div class="d-card"><div class="slabel">🎯 ฝึกเพิ่มตามจุดที่พลาด — '+grand+' ข้อ</div>'
    + '<div style="font-size:12px;color:var(--text2);line-height:1.6">สนามสอบออกคละบท — แยกเป็นกลุ่มตามบท เรียงบทที่พลาดหนักสุดไว้บน '
    + 'แต่ละข้อดึงจากคลังข้อสอบจริงที่<b>หัวข้อเดียวกับข้อที่ทำผิด</b> พร้อมลิงก์เฉลย ✨</div>'
    + (grand?'<button class="pr-print-btn" onclick="printPracticeSet()">🖨️ พิมพ์ชุดฝึก (PDF)</button>':'')
    + '</div>';
  el.innerHTML=head+cards.join('');
}

function renderPracticePlan(d){
  const el=document.getElementById('s-practice'); if(!el)return;
  /* ★ 29 ส.ค. 69 — สนามสอบออกคละบท ดึงคลังบทเดียวไม่พอ ต้องแยกกลุ่มตามบท */
  if(d.isMock){ renderMockPractice(d,el); return; }
  // หาคลังฝึก: ลองชื่อบทตรงๆ ก่อน ถ้าไม่เจอ ตัด "ชุดที่ N" ออกแล้วลองใหม่
  // normalize topic ก่อน lookup (เช่น "Exponential logarithm" → "Expo Logarithm")
  const _normT=(t)=>t?t.replace(/^Exponential logarithm/i,'Expo Logarithm'):t;
  const _nTopic=_normT(d.topic);
  let bank=PRACTICE_BANK[_nTopic];
  if(!bank){ const baseTopic=_nTopic.replace(/\s*ชุดที่\s*\d+\s*$/,'').trim(); bank=PRACTICE_BANK[baseTopic]; }
  // รวมคลัง Ent เข้ากับคลังหลัก (เช่น ตรีโกณมิติ + ตรีโกณมิติ Ent)
  if(bank){ const _base=_nTopic.replace(/\s*ชุดที่\s*\d+\s*$/,'').trim(); const _ent=PRACTICE_BANK[_base+' Ent']; if(_ent) bank=[...bank,..._ent]; }
  if(!bank){ el.innerHTML='<div class="d-card"><div style="font-size:13px;color:var(--text2);line-height:1.6;padding:4px 0">ยังไม่มีคลังฝึกพร้อมเฉลยวิดีโอสำหรับบท <b>'+d.topic+'</b> ครับ — ตอนนี้พร้อมบท: <b>'+Object.keys(PRACTICE_BANK).filter(k=>!/ Ent$/.test(k)).join(', ')+'</b></div></div>'; return; }
  // รวมยอดพลาดตามหมวด (จาก d.subtopics)
  const catMap={};
  d.subtopics.forEach(st=>{ const c=catOf(st.name); if(!catMap[c])catMap[c]={cat:c,ok:0,total:0}; catMap[c].ok+=st.ok; catMap[c].total+=st.total; });
  let cats=Object.values(catMap).map(c=>({cat:c.cat,ok:c.ok,total:c.total,miss:c.total-c.ok,rate:(c.total-c.ok)/c.total})).filter(c=>c.miss>0).sort((a,b)=>b.rate-a.rate||b.miss-a.miss);
  if(!cats.length){ el.innerHTML='<div class="d-card"><div class="slabel">🎯 ฝึกเพิ่มตามจุดที่พลาด</div><div style="font-size:14px;color:var(--green);padding:6px 0">ทำได้แม่นทุกหัวข้อแล้ว ไม่ต้องฝึกเพิ่ม เก่งมาก! 🎉 ลองท้าทายข้อยากขึ้นจากคลังได้เลย</div></div>'; return; }
  const cards=[]; let grand=0; const planForPrint=[];
  cats.forEach(c=>{
    const pct=Math.round(c.rate*100);
    let need=Math.min(8,Math.max(2,Math.round(c.rate*16)));   // พลาด 25% → ~4 ข้อ
    let pool=_shuffle(bank.filter(q=>q.c===c.cat)).sort((a,b)=>a.l-b.l);
    need=Math.min(need,pool.length);   // ไม่เกินจำนวนข้อที่มีจริงในหัวข้อนั้น (ไม่ยืมข้ามหัวข้อ)
    let pick=[];
    if(pool.length<=need){ pick=pool.slice(); }
    else { const step=pool.length/need; for(let i=0;i<need;i++) pick.push(pool[Math.floor(i*step)]); }
    grand+=pick.length;
    planForPrint.push({cat:c.cat,emoji:emojiOf(c.cat),pct:pct,ok:c.ok,total:c.total,picks:pick.map(q=>({n:q.n,s:q.s,l:q.l,yt:q.yt}))});
    const emoji=emojiOf(c.cat);
    let rows='';
    pick.forEach(q=>{ const stars='★'.repeat(q.l)+'☆'.repeat(5-q.l);
      rows+=`<div class="rev-row"><div style="flex:1"><div style="font-size:12px;color:var(--text1);font-weight:500">ข้อ ${q.n} <span style="color:var(--text3);font-weight:400">· ${q.s}</span></div><div style="font-size:10px;color:var(--text3)">ระดับ ${q.l} <span style="color:#BA7517">${stars}</span></div></div><a href="${q.yt}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:5px;background:var(--surf,#FAF9F5);color:#B3261E;border:1px solid #E4C7C5;font-size:11px;font-weight:500;padding:5px 12px;border-radius:12px;text-decoration:none;white-space:nowrap">▶ เฉลย</a></div>`; });
    cards.push(`<div class="d-card"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px"><div style="font-size:14px;font-weight:500;color:var(--text1)">${emoji} ${c.cat}</div><div class="diff-badge ${pct>=50?'diff-bad':'diff-warn'}">พลาด ${pct}%</div></div><div style="font-size:11px;color:var(--text2);margin-bottom:8px">ทำได้ ${c.ok}/${c.total} ข้อในหัวข้อนี้ → แนะนำฝึก <b>${pick.length} ข้อ</b> จากคลังข้อสอบจริง</div>${rows}</div>`);
  });
  // เก็บแผนไว้สำหรับพิมพ์
  window.__practicePlan={name:d.shortName,topic:d.topic,date:d.date,grand,bankCount:bank.length,cats:planForPrint};
  const head=`<div class="d-card"><div class="slabel">🎯 ฝึกเพิ่มตามจุดที่พลาด — ${grand} ข้อ</div><div style="font-size:12px;color:var(--text2);line-height:1.6">เลือกโจทย์จากคลังข้อสอบจริง <b>${bank.length} ข้อ</b> ให้ตามสัดส่วนที่ยังไม่แม่นในแต่ละหัวข้อ — ยิ่งพลาดมาก ยิ่งได้ฝึกหัวข้อนั้นเยอะ แต่ละข้อมีลิงก์เฉลยวิดีโอให้ศึกษาเองต่อได้เลย ✨</div><button class="pr-print-btn" onclick="printPracticeSet()">🖨️ พิมพ์ชุดฝึก (PDF)</button></div>`;
  el.innerHTML=head+cards.join('');
}

function parseStatus(val){
  if(!val)return'blank';
  const v=val.trim();
  if(v==='✅'||v.includes('ถูก'))return'ok';
  if(v==='⚠️'||v.includes('สะเพร่า'))return'care';
  if(v==='C'||v.includes('คอนเซปต์'))return'concept';
  if(v==='X'||v.includes('ทำไม่ได้'))return'cant';
  if(v==='⏰'||v.includes('ไม่ทัน')||v.includes('ไม่ทำ'))return'timeout';
  if(v.includes('ผิด'))return'cant';
  return'blank';
}

async function fetchDashData(){
  selectedGroups=null; // reset ตัวกรองกลุ่มทุกครั้งที่ดึงข้อมูลใหม่
  const topicFilter=document.getElementById('topicFilter').value.trim();
  let resData,longData;
  if(_USE_PROXY()){
    // v3: ดึงผ่าน proxy — ต้องมี PIN ที่ถูกต้องเท่านั้น คนนอกดึงข้อมูลไม่ได้
    const j=await _proxyPost({action:'webData', name:currentStudent, pin:currentPin});
    if(!j.ok){dashData=null;dashErr='เชื่อมต่อระบบไม่ได้: '+(j.error||'ลองใหม่อีกครั้ง');return;}
    resData={values:j.results||[]}; longData={values:j.results_long||[]};
  }else{
    [resData,longData]=await Promise.all([
      fetch(`${BASE}/${SHEET_ID}/values/${encodeURIComponent('results!A:AR')}?key=${API_KEY}&t=${Date.now()}`).then(r=>r.json()),
      fetch(`${BASE}/${SHEET_ID}/values/${encodeURIComponent('results_long!A:H')}?key=${API_KEY}&t=${Date.now()}`).then(r=>r.json())
    ]);
    if(resData.error){dashData=null;dashErr='เชื่อมต่อ Google Sheets ไม่ได้: '+(resData.error.message||'ตรวจสอบอินเทอร์เน็ต/API key');return;}
  }
  const rows=resData.values||[];
  const _norm=s=>String(s||'').replace(/\s+/g,' ').trim();
  const me=_norm(currentStudent);
  const allMine=rows.slice(1).filter(r=>_norm(r[1])===me);
  // เรียงตามวันที่สอบจริง — เดิมเรียงตามลำดับแถวในชีต (ลำดับที่ครูกรอก)
  // แก้จุดนี้จุดเดียวได้ทั้ง: ผลสอบ "ล่าสุด" · กราฟพัฒนาการ · ▲▼ เทียบครั้งก่อน · 🔥 ดีขึ้นติดกัน
  allMine.sort(function(a,b){ return _dKey(a&&a[3]) - _dKey(b&&b[3]); });
  const myRows=allMine.filter(r=>!topicFilter||(r[4]||'').includes(topicFilter));
  if(!myRows.length){
    dashData=null;
    if(!allMine.length){
      dashErr='ไม่พบผลสอบของ "'+currentStudent+'" ใน results\n\nสาเหตุที่พบบ่อย: ชื่อ/กลุ่มตอนกรอกผลไม่ตรงกับรายชื่อในระบบ (เช่น กลุ่มใหม่ที่ยังไม่ได้เพิ่ม)';
    }else{
      const topics=[...new Set(allMine.map(r=>r[4]))].join(', ');
      dashErr='"'+currentStudent+'" ยังไม่มีผลสอบบท "'+topicFilter+'"\n\nบทที่มีผลแล้ว: '+topics+'\nลองเปลี่ยนตัวกรองเป็น "ทุกบท" ดูครับ';
    }
    return;
  }
  dashErr='';
  const myRow=myRows[myRows.length-1];
  const group=myRow[2]||'',date=myRow[3]||'',topic=myRow[4]||'';
  const unfilled=_unfilledOf(myRow);   /* ★ 25 ก.ย. 69 — ยังไม่ครบ 30 ข้อ */
  const score=_scoreOf(myRow,topic),care=parseInt(myRow[37])||0,concept=parseInt(myRow[38])||0,cant=parseInt(myRow[39])||0,timeout=parseInt(myRow[40])||0,wrong=cant,blank=timeout;
  const qResults={};
  for(let i=1;i<=30;i++)qResults[i]=parseStatus(myRow[5+i]||'');
  const latestByName={};
  rows.slice(1).filter(r=>r[2]===group&&(!topicFilter||(r[4]||'').includes(topicFilter))).forEach(r=>{latestByName[r[1]]=r;});
  const groupMembers=Object.values(latestByName).map(r=>({name:r[1],score:_scoreOf(r,r[4]||topic),care:parseInt(r[37])||0,concept:parseInt(r[38])||0,cant:parseInt(r[39])||0,timeout:parseInt(r[40])||0,isMe:r[1]===currentStudent})).sort((a,b)=>b.score-a.score);
  const rank=groupMembers.findIndex(m=>m.isMe)+1;
  // เทียบทุกคนที่สอบบทเดียวกัน (ทุกกลุ่ม)
  const latestAllByName={};
  rows.slice(1).filter(r=>_norm(r[4])===_norm(topic)).forEach(r=>{latestAllByName[_norm(r[1])]=r;});
  const allMembers=Object.values(latestAllByName).map(r=>({name:r[1],group:r[2]||'',score:_scoreOf(r,r[4]||topic),care:parseInt(r[37])||0,concept:parseInt(r[38])||0,cant:parseInt(r[39])||0,timeout:parseInt(r[40])||0,isMe:_norm(r[1])===me})).sort((a,b)=>b.score-a.score);
  const allRank=allMembers.findIndex(m=>m.isMe)+1;
  const allAvg=allMembers.length?Math.round(allMembers.reduce((s,m)=>s+m.score,0)/allMembers.length):0;
  // รายชื่อกลุ่มทั้งหมดที่สอบบทนี้ (สำหรับ picker)
  const groupsInTopic=[...new Set(allMembers.map(m=>m.group).filter(Boolean))].sort();
  // ดึงจาก results_long: A=ชื่อ B=กลุ่ม C=วันที่ D=บท E=ข้อที่ F=สถานะ G=sub_topic H=ระดับ
  const longRows=(longData.values||[]).slice(1);
  let myAna=longRows.filter(r=>r[0]===currentStudent&&(!topicFilter||(r[3]||'').includes(topicFilter))&&(r[3]||'')===topic);
  // เติม sub/level จาก EMBEDDED_QB ถ้า results_long ไม่มี (column G/H ว่างหรือเป็น 0)
  // normalize topic name ให้ตรงกับ EMBEDDED_QB key
  const normTopic=(t)=>{
    if(!t) return t;
    // "Exponential logarithm" → "Expo Logarithm"
    return t.replace(/^Exponential logarithm/i,'Expo Logarithm')
            .replace(/^exponential logarithm/i,'Expo Logarithm');
  };
  const embTopic = normTopic(topic);
  if(myAna.length&&EMBEDDED_QB[embTopic]){
    myAna=myAna.map(r=>{
      const qNum=parseInt(r[4])||0;
      const qb=EMBEDDED_QB[embTopic][qNum]||{};
      const sub=(r[6]&&r[6]!=='—')?r[6]:(qb.sub||'—');
      const lvl=(parseInt(r[7])>0)?r[7]:(qb.level||0);
      return [r[0],r[1],r[2],r[3],r[4],r[5],sub,lvl];
    });
  }
  // dedup: เก็บเฉพาะ row แรกของแต่ละข้อ (กัน results_long มีหลาย row ต่อข้อ)
  const seenQ={}; myAna=myAna.filter(r=>{const q=r[4]; if(seenQ[q])return false; seenQ[q]=true; return true;});
  // Fallback: results_long ยังไม่มีข้อมูลการสอบนี้ → คำนวณจาก QUESTION_BANK ที่ฝังไว้
  if(!myAna.length&&EMBEDDED_QB[embTopic]){
    myAna=[];
    for(let q=1;q<=30;q++){
      const st=myRow[5+q]||'';
      if(!st)continue;
      const qb=EMBEDDED_QB[embTopic][q]||{};
      myAna.push([currentStudent,group,date,topic,q,st,qb.sub||'—',qb.level||0]);
    }
  }
  const stMap={};
  myAna.forEach(r=>{
    const st=r[6]||'',lv=parseInt(r[7])||0,status=parseStatus(r[5]||'');
    if(!st||st==='—')return;
    if(!stMap[st])stMap[st]={name:st,level:lv,ok:0,care:0,concept:0,cant:0,timeout:0,wrong:0,blank:0,total:0};
    stMap[st].total++;
    if(status==='ok')stMap[st].ok++;
    else if(status==='care')stMap[st].care++;
    else if(status==='wrong')stMap[st].wrong++;
    else stMap[st].blank++;
  });
  const subtopics=Object.values(stMap).sort((a,b)=>a.ok/a.total-b.ok/b.total);
  const diffMap={};
  myAna.forEach(r=>{const lv=parseInt(r[7])||0,status=parseStatus(r[5]||'');if(!diffMap[lv])diffMap[lv]={ok:0,total:0};diffMap[lv].total++;if(status==='ok')diffMap[lv].ok++;});
  // ── สถิติกลุ่มย่อย: sub-topic ที่ทั้งกลุ่มอ่อนร่วมกัน (จาก results_long ของทุกคนในกลุ่ม บทนี้) ──
  let grpLong=longRows.filter(r=>(r[1]||'')===group&&(r[3]||'')===topic);
  // เติม sub จาก EMBEDDED_QB ถ้า results_long ไม่มี (เหมือน myAna)
  if(grpLong.length&&EMBEDDED_QB[embTopic]){
    grpLong=grpLong.map(r=>{
      const qNum=parseInt(r[4])||0;
      const qb=EMBEDDED_QB[embTopic][qNum]||{};
      const sub=(r[6]&&r[6]!=='—')?r[6]:(qb.sub||'—');
      return [r[0],r[1],r[2],r[3],r[4],r[5],sub,r[7]];
    });
  }
  const grpStMap={};
  grpLong.forEach(r=>{
    const st=r[6]||'',status=parseStatus(r[5]||'');
    if(!st||st==='—')return;
    if(!grpStMap[st])grpStMap[st]={name:st,ok:0,care:0,concept:0,cant:0,timeout:0,wrong:0,blank:0,total:0};
    grpStMap[st].total++;
    if(status==='ok')grpStMap[st].ok++;else if(status==='care')grpStMap[st].care++;
    else if(status==='concept')grpStMap[st].concept++;
    else if(status==='cant')grpStMap[st].cant++;
    else if(status==='timeout')grpStMap[st].timeout++;
    else if(status==='wrong')grpStMap[st].wrong++;
    else grpStMap[st].blank++;
  });
  const grpSubtopics=Object.values(grpStMap).sort((a,b)=>a.ok/a.total-b.ok/b.total);
  // สถิติรวมกลุ่ม
  const grpScores=groupMembers.map(m=>m.score);
  const grpAvg=grpScores.length?Math.round(grpScores.reduce((a,b)=>a+b,0)/grpScores.length*10)/10:0;
  const grpCareAvg=groupMembers.length?Math.round(groupMembers.reduce((a,m)=>a+m.care,0)/groupMembers.length*10)/10:0;
  const grpHi=grpScores.length?Math.max(...grpScores):0;
  const grpLo=grpScores.length?Math.min(...grpScores):0;
  const grpStats={avg:grpAvg,careAvg:grpCareAvg,hi:grpHi,lo:grpLo,count:groupMembers.length};
  // ── v2: ประวัติการสอบทุกครั้งของนักเรียนคนนี้ (ตาม topicFilter) สำหรับ trend ──
  /* ★ 17 ก.ย. 69 — ข้อสอบมีสองประเภทที่คะแนนเต็มคนละแบบ
     บทปกติเต็ม 30 · สนามสอบ (ชุดรวมทุกบท) เต็ม 100
     ตัวเลขเปรียบเทียบทุกตัวจึงต้องคิด "ภายในประเภทเดียวกัน" เท่านั้น (กฎ 42) */
  const _mkHist=r=>({date:r[3]||'',topic:r[4]||'',full:_fullOf(r[4]||''),score:_scoreOf(r,r[4]||''),
    ok:parseInt(r[36])||0,care:parseInt(r[37])||0,concept:parseInt(r[38])||0,
    cant:parseInt(r[39])||0,timeout:parseInt(r[40])||0,isMock:_isMock(r[4]||'')});
  const history=myRows.map(_mkHist);
  const mockHist=allMine.filter(r=>_isMock(r[4]||'')).map(_mkHist);
  const chapHist=allMine.filter(r=>!_isMock(r[4]||'')).map(_mkHist);

  /* ★ ค่าเฉลี่ยของทั้งรุ่นในแต่ละชุดสอบ (คีย์ = บท|วันที่)
     ข้อสอบแต่ละชุดยากไม่เท่ากัน คะแนนดิบข้ามชุดจึงเทียบกันตรง ๆ ไม่ได้
     ต้องดูคู่กับค่าเฉลี่ยเสมอ ไม่งั้นชุดที่ยากขึ้นจะดูเหมือนนักเรียนถดถอย */
  /* ★ 19 ก.ย. 69 (รอบ 2) — ของเดิมคีย์เป็น บท|วันที่ ทำให้คนที่สอบคนละวันไม่ถูกนับรวมกัน
     กลุ่มที่นัดสอบคนละวันจึงกลายเป็น "มีผลคนเดียว" ทั้งที่ทั้งรุ่นสอบชุดเดียวกัน
     → เปลี่ยนเป็นคิดจาก "บท/ชุด" อย่างเดียว ไม่สนวันที่
     และนับ 1 คน 1 ค่า (ใช้ผลล่าสุดของคนนั้นในบทนั้น) คนที่สอบซ้ำจึงไม่ถ่วงค่าเฉลี่ย */
  const _byTopic={};
  rows.slice(1).forEach(r=>{
    const tp=r[4]||''; if(!tp||!r[1]) return;
    const m=(_byTopic[tp]=_byTopic[tp]||{});
    m[r[1]]=_scoreOf(r,tp);            /* แถวหลังทับแถวก่อน = ผลล่าสุดของคนนั้น */
  });
  const _examAgg={};
  Object.keys(_byTopic).forEach(tp=>{
    const scores=Object.keys(_byTopic[tp]).map(nm=>_byTopic[tp][nm]);
    _examAgg[tp]={ sum:scores.reduce((x,y)=>x+y,0), n:scores.length, scores:scores };
  });
  const _fillStat=h=>{
    const a=_examAgg[h.topic];
    if(a&&a.n){
      h.gAvg=Math.round(a.sum/a.n*10)/10;
      h.gN=a.n;
      h.gRank=a.scores.filter(s=>s>h.score).length+1;
    }
    return h;
  };
  history.forEach(_fillStat); mockHist.forEach(_fillStat); chapHist.forEach(_fillStat);

  /* ★ เทียบครั้งก่อน / สถิติดีขึ้นติดกัน / ทำได้ดีที่สุด — เฉพาะในประเภทเดียวกัน
     ของเดิมเอาสนามสอบ 70/100 ลบบทปกติ 24/30 ได้ "▲ +46" ซึ่งไม่มีความหมายเลย */
  const _kindHist=_isMock(topic)?mockHist:chapHist;
  const prev=_kindHist.length>1?_kindHist[_kindHist.length-2]:null;
  const delta=prev?score-prev.score:null;
  let streak=0; for(let i=_kindHist.length-1;i>0;i--){ if(_kindHist[i].score>_kindHist[i-1].score)streak++; else break; }
  const isBest=_kindHist.length>1&&score>=Math.max(..._kindHist.map(h=>h.score));
  const myExamStat=(function(){
    const a=_examAgg[topic];
    if(!a||!a.n) return null;
    return {avg:Math.round(a.sum/a.n*10)/10,n:a.n,rank:a.scores.filter(s=>s>score).length+1};
  }());
  // results_long ทุกแถวของนักเรียนคนนี้ (ทุกการสอบ) — ใช้หา "จุดอ่อนเรื้อรัง"
  const myLongAll=longRows.filter(r=>r[0]===currentStudent);
  // v2.1: ประวัติทุกบท (ไม่สน topicFilter) — fallback ของแท็บพัฒนาการเมื่อบทที่กรองมีสอบครั้งเดียว
  const allHistory=allMine.map(_mkHist).map(_fillStat);
  const full=_fullOf(topic), isMock=_isMock(topic);
  dashData={unfilled,group,date,topic,full,isMock,score,care,concept,cant,timeout,wrong,blank,qResults,groupMembers,rank,allMembers,allRank,allAvg,groupsInTopic,subtopics,diffMap,myAna,grpSubtopics,grpStats,history,mockHist,chapHist,myExamStat,prev,delta,streak,isBest,myLongAll,allHistory,shortName:currentStudent.replace(/\s*\(.*\)/,'')};
}

async function showDashboard(mode){
  dashData=null;
  await fetchDashData();
  if(!dashData){alert(dashErr||'ยังไม่มีข้อมูลสอบในระบบ');return;}
  const d=dashData;
  if(mode==='student'){
    renderStudentDash(d);
    goTo('p4');
  } else {
    renderParentDash(d);
    goTo('p5');
  }
}

// ═══════ v2: การ์ดพัฒนาการ + trend ═══════
function _sparkSvg(scores,w,h,full){
  if(!scores||scores.length<2)return'';
  const n=scores.length,max=full||30,pad=7;
  const pts=scores.map((v,i)=>[
    Math.round((pad+i*(w-2*pad)/(n-1))*10)/10,
    Math.round((h-pad-(v/max)*(h-2*pad))*10)/10
  ]);
  const line=pts.map(p=>p.join(',')).join(' ');
  const last=pts[pts.length-1];
  const ty=Math.round((h-pad-(25/max)*(h-2*pad))*10)/10;
  return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;max-width:${w}px;height:${h}px;display:block"><line x1="${pad}" y1="${ty}" x2="${w-pad}" y2="${ty}" stroke="#A32D2D" stroke-width="1" stroke-dasharray="4 3" opacity=".5"/><polyline points="${line}" fill="none" stroke="#185FA5" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${last[0]}" cy="${last[1]}" r="4" fill="#C77E1A"/></svg>`;
}
function renderTrendCard(d){
  const anchor=document.getElementById('s-encourage');
  let card=document.getElementById('s-trendCard');
  if(!card){ if(!anchor)return; anchor.insertAdjacentHTML('afterend','<div id="s-trendCard"></div>'); card=document.getElementById('s-trendCard'); }
  const hist=d.history||[];
  if(hist.length<2){ card.innerHTML=''; return; }
  const scores=hist.map(h=>h.score);
  const deltaTxt=d.delta==null?'':(d.delta>0?'▲ +'+d.delta:(d.delta<0?'▼ '+d.delta:'▬ เท่าเดิม'));
  const deltaColor=d.delta>0?'#3B7D2A':(d.delta<0?'#C77E1A':'var(--text3,#948F86)');
  const chip=(t,bg,c)=>`<span style="display:inline-block;background:${bg};color:${c};font-size:11px;font-weight:600;padding:2px 9px;border-radius:99px;margin-right:4px">${t}</span>`;
  let chips='';
  if(d.isBest)chips+=chip('🏆 สูงสุดตั้งแต่เริ่มเรียน','#EAF5E6','#3B7D2A');
  if(d.streak>=2)chips+=chip('🔥 ดีขึ้น '+d.streak+' ครั้งติด','#FFF1E0','#B45309');
  if(d.delta!=null&&d.delta<0)chips+=chip('อยู่ในช่วงผันผวนปกติ — โฟกัสที่แผนทบทวนต่อได้เลย','#F0F4F8','#57534E');
  // error-mix รายครั้ง (สูงสุด 8 ครั้งล่าสุด)
  let mixHtml='';
  const mh=hist.slice(-8);
  if(mh.length>=2){
    const cols=mh.map(h=>{
      /* ★ แถบนี้นับ "จำนวนข้อ" (เต็ม 30 เสมอ) ไม่ใช่คะแนนถ่วงน้ำหนัก */
      const seg=(v,c)=>v>0?`<div style="height:${Math.max(2,Math.round(v/30*66))}px;background:${c}"></div>`:'';
      return `<div style="text-align:center"><div style="display:flex;flex-direction:column-reverse;width:20px;border-radius:4px;overflow:hidden;margin:0 auto">${seg(h.ok!=null?h.ok:h.score,'#8FBF7F')}${seg(h.care,'#F2C94C')}${seg(h.concept,'#C9A6F0')}${seg(h.cant,'#E89090')}${seg(h.timeout,'#B8C2CC')}</div><div style="font-size:9px;color:var(--text3,#948F86);margin-top:2px">${h.score}</div></div>`;
    }).join('');
    mixHtml=`<div style="margin-top:10px;border-top:1px dashed var(--border,#E7E4DC);padding-top:8px"><div style="font-size:11px;color:var(--text3,#948F86);margin-bottom:6px">ส่วนผสมผลรายครั้ง — 🟩 ถูก · 🟨 สะเพร่า · 🟪 คอนเซปต์ · 🟥 ทำไม่ได้ · ⬜ ไม่ทัน <span style="color:var(--text2,#57534E)">(คะแนนเท่าเดิมแต่สีข้างบนหด = กำลังพัฒนา)</span></div><div style="display:flex;gap:9px;align-items:flex-end">${cols}</div></div>`;
  }
  card.innerHTML=`<div style="background:#fff;border:1px solid var(--border,#E7E4DC);border-radius:14px;padding:14px 16px;margin:10px 0">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px">
      <div>
        <div style="font-size:11px;color:var(--text3,#948F86)">📈 พัฒนาการของคุณ · ${hist.length} ครั้ง · เทียบกับตัวเองเท่านั้น</div>
        <div style="font-size:24px;font-weight:700;color:${deltaColor}">${deltaTxt} <span style="font-size:12px;color:var(--text3,#948F86);font-weight:400">จากครั้งก่อน (${d.prev.score} → ${d.score})</span></div>
        <div style="margin-top:5px">${chips}</div>
      </div>
      <div style="flex:1;min-width:170px;max-width:250px">
        ${_sparkSvg(scores,250,62,d.full||30)}
        <div style="font-size:10px;color:var(--text3,#948F86);text-align:right">เส้นประแดง = เป้า ${Math.round((d.full||30)*25/30)}/${d.full||30} · ${scores.join(' → ')}</div>
      </div>
    </div>
    ${mixHtml}
  </div>`;
}

// ═══════ v3.0 (17 ก.ย. 69): แท็บ 📈 พัฒนาการ — แยกข้อสอบแยกบท / สนามสอบ ═══════
/* ทำไมต้องแยก: บทปกติเต็ม 30 · สนามสอบเต็ม 100 — วางบนแกนเดียวกันอ่านผิดแน่
   ของเดิมกันด้วยการแปลงทั้งกราฟเป็น % ซึ่ง "กันอ่านผิด" ได้ แต่ไม่ได้ "แยกให้เห็น"
   ★ และคะแนนดิบข้ามชุดสนามสอบก็เทียบกันตรง ๆ ไม่ได้ เพราะแต่ละชุดยากไม่เท่ากัน
     จึงวาดเส้นค่าเฉลี่ยของทั้งรุ่นคู่ไปด้วยทุกจุด (กฎ 42 · 62) */

/* ═══════════════════════════════════════════════════════════════════════
   ★ 18 ก.ย. 69 — เป้าหมายคะแนนสนามสอบตั้งเองได้
   ของเดิมเป็นค่าคงที่ทั้งรุ่น (83/100) ซึ่งสูงเกินจริงและไม่ตรงกับใครสักคน
   ตอนนี้เก็บรายคนในชีต exam_goals → นักเรียนตั้งเอง ครูตั้งให้ก็ได้ ค่าล่าสุดชนะ

   ลำดับที่ใช้:  เป้าของคนนี้ → MOCK_SETS[ชุด].goal (ครูตั้งในโค้ด) → ค่าตั้งต้นระบบ
   ═══════════════════════════════════════════════════════════════════════ */
const GOAL_MIN = 10, GOAL_MAX = 100;
const MOCK_GOAL_FALLBACK = 65;     /* ค่าตั้งต้นเมื่อยังไม่มีใครตั้งเป้า */
let MY_GOAL = { goal: 0, by: '', at: '', loaded: false };   /* เป้าสนามสอบ (คีย์ '') — คงชื่อเดิมไว้ */
/* ★ 20 ก.ย. 69 — เป้าแยกรายบท: { '': {...}, 'เซต': {...}, 'Expo Logarithm ชุดที่ 1': {...} }
   คีย์ '' = สนามสอบทุกชุด · บทปกติใช้ชื่อบท (normalize แล้ว) · เต็มคนละสเกล (100 / 30) */
let MY_GOALS = {};
const CHAP_GOAL_FALLBACK = 25;      /* ค่าตั้งต้นของบทปกติ (เท่ากับ 25/30 ที่ใช้มาตลอด) */
function goalChapKey(ch){
  const c = String(ch || '').trim();
  if(!c || /^ชุดรวม\s*\d*/.test(c)) return '';
  return (typeof normChapterKey === 'function') ? normChapterKey(c) : c;
}
function goalFullOf(ch){ return goalChapKey(ch) ? 30 : 100; }

/* โหลดเป้าของนักเรียนคนนี้ — ล้มเหลวก็ไม่เป็นไร ตกไปใช้ค่าตั้งต้น */
async function goalLoad(name){
  MY_GOAL = { goal: 0, by: '', at: '', loaded: false };
  MY_GOALS = {};
  if(!name) return MY_GOAL;
  try{
    /* API ใหม่: ได้เป้าทุกบทในครั้งเดียว — rows = [[บท, เป้า, ตั้งโดย, เมื่อ], ...] */
    const all = await _proxyPost({ action:'getMyGoals', name });
    if(all && all.ok && Array.isArray(all.rows)){
      all.rows.forEach(r => {
        const key = goalChapKey(r[0]);
        MY_GOALS[key] = { goal: parseInt(r[1])||0, by: r[2]||'', at: r[3]||'', loaded: true };
      });
      MY_GOAL = MY_GOALS[''] || { goal: 0, by: '', at: '', loaded: true };
      MY_GOAL.loaded = true;
      return MY_GOAL;
    }
  }catch(e){}
  try{
    /* Apps Script เวอร์ชันเก่ายังไม่มี getMyGoals → ใช้เป้ารวมแบบเดิม */
    const j = await _proxyPost({ action:'getGoal', name });
    if(j && j.ok){
      MY_GOAL = { goal: parseInt(j.goal)||0, by: j.by||'', at: j.at||'', loaded: true };
      MY_GOALS[''] = MY_GOAL;
    }
  }catch(e){}
  return MY_GOAL;
}

/* พยายามโหลดเป้าครั้งเดียวต่อการล็อกอิน — ล้มเหลวก็ไม่ลองใหม่ จะได้ไม่หน่วงซ้ำทุกครั้งที่วาด
   วาดด้วยค่าตั้งต้นไปก่อน ได้ค่าจริงเมื่อไรค่อยวาดทับ (ไม่บล็อกการแสดงผล) */
let _goalTried = false;
function goalEnsure(){
  if(_goalTried || !currentStudent) return;
  _goalTried = true;
  goalLoad(currentStudent).then(g => {
    /* วาดใหม่เฉพาะเมื่อได้เป้าจริง และผู้ใช้ยังอยู่หน้าที่มีแถบเป้าอยู่ */
    if(g && g.goal > 0 && document.getElementById('s-goalBar') && dashData){
      try{ renderProgressTrend(dashData); }catch(e){ console.error('goal rerender', e); }
    }
    if(g && g.goal > 0 && document.getElementById('p-trend') && dashData){
      try{ renderParentTrend(dashData); }catch(e){ console.error('parent goal rerender', e); }
    }
  }).catch(()=>{});
}

/* เป้าที่ใช้จริงกับกราฟ */
function goalOf(chapter){
  const key = goalChapKey(chapter);
  const g = MY_GOALS[key];
  if(g && g.goal > 0) return g;
  if(key === '' && MY_GOAL && MY_GOAL.goal > 0) return MY_GOAL;   /* ทางถอย API เก่า */
  return null;
}
function goalEffective(chapter){
  const g = goalOf(chapter);
  if(g) return g.goal;
  if(goalChapKey(chapter)) return CHAP_GOAL_FALLBACK;              /* บทปกติ 25/30 */
  const fromSet = (typeof MOCK_GOAL_OF === 'function') ? MOCK_GOAL_OF(chapter) : 0;
  return fromSet > 0 ? fromSet : MOCK_GOAL_FALLBACK;
}

let _goalJustSaved = { key: null, at: 0 };
function goalSourceText(chapter){
  const key = goalChapKey(chapter);
  const g = goalOf(chapter);
  const fresh = _goalJustSaved.key === key && (Date.now() - _goalJustSaved.at) < 5000;
  const src = !g ? 'ค่าตั้งต้นของระบบ — ยังไม่มีใครตั้งเป้า'
                 : (g.by === 'teacher' ? 'ครูตั้งให้' : 'คุณตั้งเอง');
  return fresh ? ('บันทึกแล้ว · ' + src) : src;
}

/* แถบตั้งเป้า — อยู่ใต้กราฟสนามสอบ ใช้ input number เพื่อให้มือถือขึ้นแป้นตัวเลข */
/* แถบตั้งเป้า — ใช้ได้ทั้งสนามสอบ (chapters ว่าง = เป้าเดียวเต็ม 100)
   และข้อสอบแยกบท (ส่งรายชื่อบทมา → มีตัวเลือกบท ตั้งเป้าแยกกันได้ เต็ม 30) */
function goalBarHTML(cur, chapters){
  const list = (chapters || []).filter((c, i, a) => c && a.indexOf(c) === i);
  const isChap = list.length > 0;
  const sel = isChap ? (_goalChapSel && list.indexOf(_goalChapSel) >= 0 ? _goalChapSel : list[list.length-1]) : '';
  const shown = isChap ? goalEffective(sel) : cur;
  const full = isChap ? 30 : 100;
  const id = isChap ? 'chap' : 'mock';
  const picker = isChap
    ? '<select id="s-goalChap-' + id + '" style="font-size:12px;padding:5px 8px;max-width:190px;'
      + 'border:1px solid var(--line-strong,#ccc);border-radius:8px;background:var(--surf,#fff);color:var(--text1)">'
      + list.map(c => '<option value="' + c + '"' + (c === sel ? ' selected' : '') + '>' + c + '</option>').join('')
      + '</select>'
    : '';
  return '<div class="d-card" id="s-goalBar-' + id + '" style="padding:.85rem 1rem">'
    + '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">'
    +   '<span style="font-size:12.5px;color:var(--text1);font-weight:500">🎯 เป้าหมายของฉัน'
    +     (isChap ? ' — รายบท' : '') + '</span>'
    +   picker
    +   '<input id="s-goalInput-' + id + '" type="number" inputmode="numeric" min="' + GOAL_MIN + '" max="' + full + '" value="' + shown + '"'
    +     ' style="width:74px;padding:5px 8px;font-size:14px;font-family:var(--font-num,inherit);'
    +     'border:1px solid var(--line-strong,#ccc);border-radius:8px;background:var(--surf,#fff);color:var(--text1)">'
    +   '<span style="font-size:12px;color:var(--text3)">/ ' + full + ' คะแนน</span>'
    +   '<button id="s-goalSave-' + id + '" class="btn btn--sm btn--primary" style="font-size:12px;padding:5px 14px">บันทึก</button>'
    +   '<span id="s-goalMsg-' + id + '" style="font-size:11.5px;color:var(--text3)">' + goalSourceText(sel) + '</span>'
    + '</div>'
    + '<div style="font-size:11px;color:var(--text3);margin-top:7px;line-height:1.7">'
    +   (isChap
        ? 'ตั้งเป้า<b>แยกได้ทีละบท</b> — เลือกบทแล้วใส่ตัวเลข 10–30 · เส้นแดงในกราฟจะขยับเป็นขั้นตามเป้าของแต่ละบท'
        : 'ตั้งเท่าไรก็ได้ตั้งแต่ ' + GOAL_MIN + '–' + GOAL_MAX + ' · เส้นแดงในกราฟจะขยับตามทันที')
    +   ' · ครูเห็นเป้าที่คุณตั้งด้วย และครูตั้งให้ได้เหมือนกัน (ใครตั้งทีหลังใช้ค่านั้น)</div>'
    + '</div>';
}
let _goalChapSel = '';

/* ผูกปุ่มบันทึกของแถบเป้า — เรียกหลัง pane.innerHTML เสร็จแล้วเท่านั้น
   ผูกทั้งแถบสนามสอบ (mock) และแถบรายบท (chap) ถ้ามีอยู่บนหน้า */
function goalBind(){
  ['mock','chap'].forEach(goalBindOne);
  /* ชื่อ id แบบเก่า (ไม่มี suffix) — เผื่อหน้าอื่นที่ยังเรียกใช้อยู่ */
  const oldInp = document.getElementById('s-goalInput');
  if(oldInp) goalBindOne('');
}

function goalBindOne(kind){
  const sfx = kind ? '-' + kind : '';
  const inp = document.getElementById('s-goalInput' + sfx);
  const btn = document.getElementById('s-goalSave' + sfx);
  const msg = document.getElementById('s-goalMsg' + sfx);
  if(!inp || !btn || !msg) return;
  const pick = document.getElementById('s-goalChap' + sfx);
  const chapOf = () => pick ? pick.value : '';
  const maxOf = () => goalFullOf(chapOf());
  const say = (text, color) => { msg.textContent = text; msg.style.color = color || 'var(--text3)'; };

  if(pick){
    pick.onchange = () => {
      _goalChapSel = pick.value;
      inp.value = goalEffective(pick.value);
      inp.max = maxOf();
      say(goalSourceText(pick.value));
      if(dashData){ try{ renderProgressTrend(dashData); }catch(e){} }
    };
  }
  btn.onclick = async () => {
    const ch = chapOf(), max = maxOf();
    const v = parseInt(inp.value, 10);
    if(!(v >= GOAL_MIN && v <= max)){
      say('ใส่ตัวเลข ' + GOAL_MIN + '–' + max + ' ครับ', '#B3261E');
      return;
    }
    btn.disabled = true; say('กำลังบันทึก…');
    try{
      const payload = { action:'setMyGoal', name: currentStudent, pin: currentPin, goal: v };
      if(goalChapKey(ch)) payload.chapter = goalChapKey(ch);
      const j = await _proxyPost(payload);
      if(j && j.ok){
        const key = goalChapKey(ch);
        MY_GOALS[key] = { goal: v, by: 'student', at: j.at || '', loaded: true };
        if(key === '') MY_GOAL = MY_GOALS[''];
        _goalJustSaved = { key: key, at: Date.now() };
        say(goalSourceText(ch), '#3B7D2A');
        /* ★ แก้ 2 (18 ก.ย.): ของเดิมเรียก renderProgress() ซึ่งไม่มีฟังก์ชันนี้อยู่จริง */
        if(dashData){ try{ renderProgressTrend(dashData); }catch(e){ console.error('goal rerender', e); } }
      }else{
        say(j && j.error ? j.error : 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง', '#B3261E');
      }
    }catch(e){
      say('เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง', '#B3261E');
    }
    btn.disabled = false;
  };
  inp.onkeydown = e => { if(e.key === 'Enter') btn.click(); };
}

function _progCard(id, title, sub, hasAvg, hist){
  /* ★ 19 ก.ย. 69 — hist ส่งมาเพื่อดูว่ามีชุดไหนที่มีเพื่อนสอบด้วยจริง ๆ หรือยัง */
  var withPeers = (hist || []).some(function(h){ return h.gAvg != null && h.gN > 1; });
  var note = '';
  if(hasAvg){
    note = withPeers
      ? 'เส้นเทา = ค่าเฉลี่ยของ<b>ทุกคนที่สอบบท/ชุดเดียวกัน</b> (นับรวมคนที่สอบคนละวัน · 1 คนนับผลล่าสุดครั้งเดียว) · '
        + '<b style="color:#7A5AA8">เส้นม่วง = คะแนนที่ควรได้ของชุดนั้น</b> (คิดจากระดับความยากรายข้อ ไม่ใช่เป้าหมาย) · '
        + '<b>คะแนนลดลงแต่ยังอยู่เหนือเส้นเทา = ทำได้ดีขึ้นเมื่อเทียบกับเพื่อน</b>'
      : 'ยังไม่มีเส้นค่าเฉลี่ยรุ่น เพราะ<b>ยังไม่มีเพื่อนกรอกผลของบท/ชุดเดียวกัน</b> — '
        + 'ค่าเฉลี่ยจากคนเดียวคือคะแนนตัวเอง เอามาเทียบไม่ได้ · เส้นจะขึ้นเองเมื่อมีคนสอบบท/ชุดนั้น 2 คนขึ้นไป (สอบคนละวันก็นับรวม) · '
        + '<b style="color:#7A5AA8">เส้นม่วง = คะแนนที่ควรได้ของชุดนั้น</b> คิดจากระดับความยากรายข้อ จึงใช้เทียบได้แม้ยังไม่มีเพื่อน';
  }
  return '<div class="d-card" style="padding:1rem">'
    + '<div class="slabel">' + title + '</div>'
    + '<div style="font-size:11.5px;color:var(--text2);margin-bottom:8px;line-height:1.6">' + sub + '</div>'
    + '<div style="position:relative;width:100%;height:210px"><canvas id="' + id + '"></canvas></div>'
    + (note ? '<div style="font-size:11px;color:var(--text3);margin-top:6px;line-height:1.7">' + note + '</div>' : '')
    + '</div>';
}


/* ★ 17 ก.ย. 69 — สอบประเภทนั้นครั้งเดียวยังวาดกราฟเส้นไม่ได้ (ต้องมีอย่างน้อย 2 จุด)
   แต่ของเดิมขึ้นว่า "ยังไม่มีผลสนามสอบ" ซึ่งไม่จริง — ครูสอบไปแล้ว 1 ชุด
   จึงแสดงการ์ดสรุปชุดนั้นแทน พร้อมบอกตรง ๆ ว่ากราฟจะเริ่มเมื่อสอบครั้งที่ 2 */
function _progSingleCard(emoji, title, h, tail){
  if(!h) return '';
  const pct = h.full ? Math.round(h.score / h.full * 100) : 0;
  /* ★ 19 ก.ย. 69 — มีผลคนเดียว = ยังไม่มีค่าเฉลี่ยให้เทียบ (ของเดิมขึ้น "อันดับ 1 จาก 1 คน") */
  const avgLine = (h.gAvg != null && h.gN > 1)
    ? '<div style="font-size:12.5px;color:var(--text2);margin-top:6px;line-height:1.7">'
      + 'ค่าเฉลี่ยของรุ่นในบท/ชุดนี้ <b>' + h.gAvg + '</b>'
      + (h.gRank ? ' · อยู่อันดับ <b>' + h.gRank + '</b> จาก ' + h.gN + ' คน' : '')
      + (h.score > h.gAvg ? ' <span style="color:#3B7D2A">· สูงกว่าค่าเฉลี่ย</span>' : '')
      + '</div>'
    : '<div style="font-size:12px;color:var(--text3);margin-top:6px;line-height:1.7">'
      + 'ยังไม่มีเพื่อนกรอกผลของบท/ชุดนี้ จึงยังไม่มีค่าเฉลี่ยรุ่นให้เทียบ</div>';
  return '<div class="d-card" style="padding:1rem">'
    + '<div class="slabel">' + emoji + ' ' + title + '</div>'
    + '<div style="font-size:12px;color:var(--text3);margin-bottom:8px">'
    +   (h.topic || '') + (h.date ? ' · ' + _dFmt(h.date) : '') + '</div>'
    + '<div style="font-size:30px;font-weight:700;color:#185FA5;line-height:1.2">'
    +   h.score + '<span style="font-size:15px;color:var(--text3);font-weight:500"> / ' + h.full + '</span>'
    +   '<span style="font-size:13px;color:var(--text3);font-weight:500;margin-left:8px">' + pct + '%</span></div>'
    + avgLine
    + '<div style="font-size:11.5px;color:var(--text3);margin-top:10px;padding-top:8px;'
    +   'border-top:1px solid rgba(128,128,128,.15);line-height:1.7">' + tail + '</div>'
    + '</div>';
}

/* ★ 20 ก.ย. 69 — นักเรียนเลือกเองว่าจะให้กราฟมีเส้นไหนบ้าง (เก็บไว้ในเครื่องนี้)
   ค่าเริ่มต้น: คะแนนตัวเอง + คะแนนที่ควรได้ + เป้า · ค่าเฉลี่ยรุ่นปิดไว้ (4 เส้นพร้อมกันแน่นเกินบนมือถือ) */
const LINE_KEY = 'mb_trend_lines_v1';
const LINE_DEFAULT = { avg:false, expect:true, goal:true };
let LINE_SHOW = Object.assign({}, LINE_DEFAULT);
(function(){
  try{
    const raw = localStorage.getItem(LINE_KEY);
    if(raw){ const o = JSON.parse(raw); ['avg','expect','goal'].forEach(k => { if(typeof o[k] === 'boolean') LINE_SHOW[k] = o[k]; }); }
  }catch(e){}
})();
function lineToggle(k){
  LINE_SHOW[k] = !LINE_SHOW[k];
  try{ localStorage.setItem(LINE_KEY, JSON.stringify(LINE_SHOW)); }catch(e){}
  if(dashData){ try{ renderProgressTrend(dashData); }catch(e){ console.error('line toggle', e); } }
  if(dashData && document.getElementById('p-trend')){ try{ renderParentTrend(dashData); }catch(e){ console.error('parent line toggle', e); } }
}
function lineChipsHTML(who){
  const _par = who === 'parent';   /* ★ 26 ก.ย. 69 — ใช้ในรายงานผู้ปกครองด้วย */
  const chip = (k, label, color) => {
    const on = !!LINE_SHOW[k];
    /* ★ 26 ก.ย. 69 — ไม่ใช้ class "btn" แล้ว: index.html ตั้ง .btn กว้าง 100% สูง 54px ชิปจึงกลายเป็นแท่งยาวเต็มจอ */
    return '<button onclick="lineToggle(\'' + k + '\')" class="line-chip" data-line="' + k + '" style="width:auto;height:auto;display:inline-flex;align-items:center;cursor:pointer;font-family:inherit;margin:0;font-size:11.5px;padding:5px 12px;'
      + 'border-radius:999px;border:1.5px solid ' + (on ? color : 'var(--line-strong,#ccc)') + ';'
      + 'background:' + (on ? color : 'transparent') + ';color:' + (on ? '#fff' : 'var(--text3)') + ';font-weight:500">'
      + (on ? '✓ ' : '') + label + '</button>';
  };
  return '<div class="d-card" style="padding:.7rem 1rem">'
    + '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
    +   '<span style="font-size:12px;color:var(--text2)">เส้นที่อยากเห็นในกราฟ:</span>'
    +   '<span style="font-size:11.5px;padding:5px 12px;border-radius:999px;background:#185FA5;color:#fff;font-weight:500">' + (_par ? 'คะแนนของลูก' : 'คะแนนของฉัน') + '</span>'
    +   chip('expect','คะแนนที่ควรได้','#7A5AA8')
    +   chip('goal', _par ? 'เป้าของลูก' : 'เป้าของฉัน','#A32D2D')
    +   chip('avg','ค่าเฉลี่ยรุ่น','#948F86')
    + '</div>'
    + '<div style="font-size:11px;color:var(--text3);margin-top:6px;line-height:1.6">'
    +   'กดเพื่อเปิด/ปิดได้ · เครื่องนี้จะจำไว้ให้ครั้งหน้า · เปิดพร้อมกันหลายเส้นได้ แต่ 2–3 เส้นจะอ่านง่ายที่สุด</div>'
    + '</div>';
}

function _progLineChart(canvasId, hist, full, goal){
  const el = document.getElementById(canvasId);
  if(!el || typeof Chart === 'undefined') return null;
  const labels = hist.map((h,i)=> h.date ? _dFmt(h.date) : ('ครั้ง '+(i+1)));
  const ds = [
    { label:'คะแนนของนักเรียน', data:hist.map(h=>h.score), borderColor:'#185FA5',
      backgroundColor:'rgba(24,95,165,.12)', fill:true, tension:.25, pointRadius:4,
      pointBackgroundColor:'#185FA5', order:1 }
  ];
  /* ★ 19 ก.ย. 69 — เส้นค่าเฉลี่ยรุ่นต้องมีเพื่อนอย่างน้อย 2 คนในชุดนั้นถึงจะมีความหมาย
     ของเดิมชุดที่มีผลคนเดียว gAvg = คะแนนตัวเอง → เส้นเทาทับเส้นน้ำเงินสนิท
     ครูจึงเห็นแค่ชื่อใน legend แต่ไม่เห็นเส้น (ดูเหมือนเส้นหาย ทั้งที่วาดอยู่) */
  if(LINE_SHOW.avg && hist.some(h=>h.gAvg!=null && h.gN>1)){
    ds.push({ label:'ค่าเฉลี่ยรุ่น', data:hist.map(h=>(h.gAvg!=null && h.gN>1)?h.gAvg:null),
      borderColor:'#948F86', borderDash:[4,3], pointRadius:3, pointBackgroundColor:'#948F86',
      fill:false, tension:.25, spanGaps:true, order:2 });
  }
  /* ★ 19 ก.ย. 69 — เส้นคะแนนที่ควรได้ของแต่ละชุด (คิดจากระดับความยากรายข้อของชุดนั้น)
     ต่างกับเส้นเป้า: เป้าเป็นค่าเดียวตลอด ส่วนเส้นนี้ขยับตามว่าชุดไหนยากง่ายแค่ไหน */
  if(LINE_SHOW.expect && typeof expectScoreOf === 'function'){
    const expArr = hist.map(h => expectScoreOf(h.topic));
    if(expArr.some(v => v != null)){
      ds.push({ label:'คะแนนที่ควรได้', data:expArr, borderColor:'#7A5AA8', borderDash:[2,3],
        pointRadius:3, pointStyle:'triangle', pointBackgroundColor:'#7A5AA8',
        fill:false, tension:.25, spanGaps:true, order:2 });
    }
  }
  if(LINE_SHOW.goal){
    /* ★ 20 ก.ย. 69 — เป้าแยกรายบท: แต่ละจุดใช้เป้าของบท/ชุดนั้น ๆ (เส้นจึงเป็นขั้นบันได)
       บทที่ยังไม่ได้ตั้งเป้าใช้ค่าตั้งต้น (บทปกติ 25/30 · สนามสอบ 65/100) */
    const goalArr = hist.map(h => goalEffective(h.topic) || goal || null);
    const uniq = goalArr.filter((v,i,a) => v != null && a.indexOf(v) === i);
    if(goalArr.some(v => v != null)){
      ds.push({ label: uniq.length === 1 ? ('เป้า ' + uniq[0]) : 'เป้าของแต่ละบท',
        data: goalArr, borderColor:'#A32D2D', borderDash:[6,4], pointRadius:0,
        stepped: uniq.length > 1, fill:false, spanGaps:true, order:3 });
    }
  }
  return new Chart(el, {
    type:'line', data:{ labels, datasets:ds },
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ labels:{ font:{size:10}, boxWidth:12 } },
        tooltip:{ callbacks:{ afterBody:function(items){
          const h = hist[items[0].dataIndex]; if(!h) return '';
          const out = [];
          if(h.topic) out.push('ชุด: ' + h.topic);
          if(typeof expectScoreOf === 'function'){
            const ex = expectScoreOf(h.topic);
            if(ex != null) out.push('คะแนนที่ควรได้ของชุดนี้ ' + ex + ' · ' +
              (h.score >= ex ? 'สูงกว่า ' + (h.score - ex) : 'ต่ำกว่า ' + (ex - h.score)));
          }
          if(h.gRank && h.gN) out.push('อันดับในรุ่น ' + h.gRank + ' จาก ' + h.gN + ' คน');
          return out;
        } } } },
      scales:{ y:{ min:0, max:full, ticks:{ stepSize: full>50?10:5 },
                   grid:{ color:'rgba(128,128,128,0.1)' } },
               x:{ grid:{display:false}, ticks:{ font:{size:10} } } } }
  });
}

function renderProgressTrend(d){
  const pane=document.getElementById('pane-progress'); if(!pane)return;
  const chap=(d.chapHist||[]), mock=(d.mockHist||[]);
  const hasChap=chap.length>=2, hasMock=mock.length>=2;

  if(!chap.length && !mock.length){
    pane.innerHTML='<div class="d-card"><div class="slabel">📈 พัฒนาการ</div>'
      +'<div style="font-size:13px;color:var(--text2);line-height:1.7">'
      +'ยังไม่มีผลสอบ — กราฟพัฒนาการจะเริ่มแสดงตั้งแต่การสอบครั้งที่ 2 เป็นต้นไปครับ 💪<br>'
      +'ระหว่างนี้ดูจุดที่ต้องเก็บได้ที่แท็บ "แผนทบทวน" เลย</div></div>';
    return;
  }

  const chapFull = chap.length ? (chap[chap.length-1].full||30) : 30;
  const mockFull = mock.length ? (mock[mock.length-1].full||100) : 100;
  /* ★ 18 ก.ย. 69 — เป้ารายคนมาก่อนเสมอ (ของเดิมคิด 25/30 = 83 ให้ทุกคนเท่ากัน) */
  const mockGoal = goalEffective(mock.length ? mock[mock.length-1].topic : '');

  /* ★ 20 ก.ย. 69 — แยกโหมดชัดเจน: ดูแยกบท = เห็นเฉพาะแยกบท · ดูสนามสอบ = เห็นเฉพาะสนามสอบ
     ประเภทมาจากบทที่เลือกในช่องด้านบน (ไม่ได้เลือก → ประเภทของผลสอบล่าสุด) */
  const kind = viewKind(d);
  const isMockView = kind === 'mock';

  /* ประเภทที่เลือกยังไม่มีผลสอบเลย → บอกให้ชัด ไม่ต้องวาดกราฟเปล่า */
  if(isMockView && !mock.length){
    pane.innerHTML = kindBannerHTML('mock', chap.length, 0)
      + '<div class="d-card"><div style="font-size:13px;color:var(--text2);line-height:1.7">'
      + '🎯 ยังไม่มีผลสนามสอบ (ชุดรวมทุกบท) — เมื่อสอบแล้วกราฟและสถิติของสนามสอบจะขึ้นตรงนี้<br>'
      + (chap.length ? 'ตอนนี้มีผลข้อสอบแยกบท ' + chap.length + ' ครั้ง — เลือกบทจากช่องด้านบนเพื่อดูครับ' : '')
      + '</div></div>';
    return;
  }
  if(!isMockView && !chap.length){
    pane.innerHTML = kindBannerHTML('chap', 0, mock.length)
      + '<div class="d-card"><div style="font-size:13px;color:var(--text2);line-height:1.7">'
      + '📘 ยังไม่มีผลข้อสอบแยกบท<br>'
      + (mock.length ? 'ตอนนี้มีผลสนามสอบ ' + mock.length + ' ชุด — เลือกชุดรวมจากช่องด้านบนเพื่อดูครับ' : '')
      + '</div></div>';
    return;
  }

  const hist = isMockView ? mock : chap;          /* ประวัติเฉพาะประเภทที่กำลังดู */
  let html='';
  html += kindBannerHTML(kind, chap.length, mock.length);
  /* ★ 20 ก.ย. 69 — แถบเลือกเส้นกราฟ */
  html += lineChipsHTML();

  if(isMockView){
    if(hasMock){
      html += _progCard('s-trendMock','🎯 สนามสอบ (รวมทุกบท) — คะแนนรายชุด',
        'เต็ม '+mockFull+' คะแนน · '+mock.length+' ชุด · ข้อ 1–25 ข้อละ 3 คะแนน · ข้อ 26–30 ข้อละ 5 คะแนน', true, mock);
    }else{
      html += _progSingleCard('🎯','สนามสอบ (รวมทุกบท) — ผลชุดล่าสุด', mock[0],
        'ข้อ 1–25 ข้อละ 3 คะแนน · ข้อ 26–30 ข้อละ 5 คะแนน (เต็ม '+(mock[0].full||100)+' คะแนน) · '
        + 'สอบสนามสอบไปแล้ว 1 ชุด — กราฟแนวโน้มจะเริ่มแสดงเมื่อสอบชุดที่ 2');
    }
    /* ★ 19 ก.ย. 69 — คะแนนที่ควรคาดหวัง + ส่วนผสมความยาก + ผังรายข้อ (เฉพาะสนามสอบ) */
    try{ html += mockExpectLineHTML(mock[mock.length-1]); }catch(e){ console.error('expect line', e); }
    try{ html += mockDiffCardHTML(d, mock[mock.length-1]); }catch(e){ console.error('diff card', e); }
    try{ html += mockPlanCardHTML(d, mock[mock.length-1]); }catch(e){ console.error('plan card', e); }
    html += goalBarHTML(mockGoal);
  }else{
    if(hasChap){
      html += _progCard('s-trendChapter','📘 ข้อสอบแยกบท — คะแนนรายครั้ง',
        'เต็ม '+chapFull+' คะแนน · '+chap.length+' ครั้ง · เทียบกับตัวเองในบทที่เคยสอบมา', true, chap);
    }else{
      html += _progSingleCard('📘','ข้อสอบแยกบท — ผลครั้งล่าสุด', chap[0],
        'สอบแยกบทไปแล้ว 1 ครั้ง · กราฟแนวโน้มจะเริ่มแสดงเมื่อสอบครั้งที่ 2 เพราะยังไม่มีอะไรให้เทียบ');
    }
    html += goalBarHTML(0, chap.map(h => goalChapKey(h.topic)).filter(Boolean));
  }

  html += '<div class="d-card" style="padding:1rem">'
    + '<div class="slabel">ส่วนผสมผลรายครั้ง — นับเป็น "จำนวนข้อ"' + (isMockView?' (เฉพาะสนามสอบ)':' (เฉพาะข้อสอบแยกบท)') + '</div>'
    + '<div style="font-size:12px;color:var(--text2);margin-bottom:8px;line-height:1.6">'
    +   'ทุกชุดมี 30 ข้อเท่ากัน · คะแนนรวมเท่าเดิมแต่แถบแดงหดลง = กำลังพัฒนา (❌ กลายเป็น ⚠️)</div>'
    + '<div style="position:relative;width:100%;height:220px"><canvas id="s-mixChart"></canvas></div></div>'
    + '<div class="d-card"><div class="slabel">สรุปรายครั้ง' + (isMockView?' — สนามสอบ':' — ข้อสอบแยกบท') + '</div><div id="s-trendTable"></div></div>';

  pane.innerHTML = html;

  /* ── เก็บ instance เก่าทิ้งก่อนเสมอ ไม่งั้น Chart.js จะทับกันบน canvas เดิม ── */
  if(trendChartInst){ try{trendChartInst.destroy();}catch(e){} trendChartInst=null; }
  if(mockChartInst){ try{mockChartInst.destroy();}catch(e){} mockChartInst=null; }
  if(mixChartInst){ try{mixChartInst.destroy();}catch(e){} mixChartInst=null; }

  if(!isMockView && hasChap) trendChartInst=_progLineChart('s-trendChapter', chap, chapFull, CHAP_GOAL_FALLBACK);
  if(isMockView && hasMock)  mockChartInst =_progLineChart('s-trendMock',    mock, mockFull, mockGoal);
  goalBind();
  goalEnsure();                   /* โหลดเป้าจริงมาทับค่าตั้งต้น — ไม่บล็อกการวาด */
  if(isMockView) qbMapEnsure();   /* ★ 19 ก.ย. 69 — ผังที่ครูแก้เอง (ชีต qb_map) ยิงครั้งเดียว */

  /* ── แถบส่วนผสม: นับ "ข้อ" จึงรวมทั้งสองประเภทได้ แต่ต้องรู้ว่าครั้งไหนเป็นชุดอะไร ── */
  const all=(d.allHistory||[]).filter(h => !!h.isMock === isMockView);
  const mixEl=document.getElementById('s-mixChart');
  if(mixEl && typeof Chart!=='undefined' && all.length){
    const labels=all.map((h,i)=>(h.date?_dFmt(h.date):('ครั้ง '+(i+1))));
    mixChartInst=new Chart(mixEl,{
      type:'bar',
      data:{labels,datasets:[
        {label:'✅ ถูก',data:all.map(h=>h.ok!=null?h.ok:0),backgroundColor:'#4C9A2A'},
        {label:'⚠️ สะเพร่า',data:all.map(h=>h.care),backgroundColor:'#FDE910'},
        {label:'C คอนเซปต์',data:all.map(h=>h.concept),backgroundColor:'#F5A623'},
        {label:'❌ ทำไม่ได้',data:all.map(h=>h.cant),backgroundColor:'#ef4444'},
        {label:'⏰ ไม่ทัน',data:all.map(h=>h.timeout),backgroundColor:'#a855f7'}
      ]},
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{labels:{font:{size:10},boxWidth:12}},
          tooltip:{callbacks:{title:function(items){
            const h=all[items[0].dataIndex];
            return (h&&h.topic?h.topic+' · ':'')+(items[0].label||'');
          }}}},
        scales:{x:{stacked:true,grid:{display:false},ticks:{font:{size:10}}},
                y:{stacked:true,min:0,max:30,ticks:{stepSize:5},grid:{color:'rgba(128,128,128,0.1)'}}}}
    });
  }

  /* ── ตารางสรุป: ▲▼ เทียบเฉพาะครั้งก่อน "ในประเภทเดียวกัน" เท่านั้น ── */
  const tbl=document.getElementById('s-trendTable');
  if(tbl){
    const seq={};              /* นับลำดับแยกตามประเภท */
    let rowsH='';
    all.forEach(h=>{
      const k2=h.isMock?'mock':'chap';
      const list=h.isMock?mock:chap;
      seq[k2]=(seq[k2]||0)+1;
      const i=seq[k2]-1;
      const dlt=(i>0&&list[i]&&list[i-1])?(list[i].score-list[i-1].score):null;
      const dtxt=dlt==null
        ? '<span style="color:var(--text3)">—</span>'
        : (dlt>0?'<span style="color:#3B7D2A;font-weight:600">▲ +'+dlt+'</span>'
          :(dlt<0?'<span style="color:#C77E1A;font-weight:600">▼ '+dlt+'</span>':'▬ 0'));
      const avgTxt=(h.gAvg!=null && h.gN>1)
        ? '<div style="font-size:10.5px;color:var(--text3)">เฉลี่ยรุ่น '+h.gAvg
          +(h.gRank?' · อันดับ '+h.gRank+'/'+h.gN:'')+'</div>'
        : '';
      rowsH+='<div class="rev-row">'
        +'<div style="min-width:30px;font-size:12px;color:var(--text3)">'+(h.isMock?'🎯':'📘')+'</div>'
        +'<div style="flex:1"><div style="font-size:12.5px;color:var(--text1)">'+(h.topic||'—')+'</div>'
        +'<div style="font-size:10.5px;color:var(--text3)">'+(h.date?_dFmt(h.date):'')+'</div>'+avgTxt+'</div>'
        +'<div style="font-size:13px;font-weight:600;min-width:52px;text-align:right">'+h.score+'/'+(h.full||30)+'</div>'
        +'<div style="min-width:56px;text-align:right;font-size:12px">'+dtxt+'</div></div>';
    });
    tbl.innerHTML=rowsH
      +'<div style="font-size:11px;color:var(--text3);margin-top:8px;padding-top:8px;border-top:1px solid rgba(128,128,128,.15);line-height:1.8">'
      + (isMockView ? '🎯 สนามสอบรวมทุกบท เต็ม 100 คะแนน' : '📘 ข้อสอบแยกบท เต็ม 30 คะแนน')
      + ' — ตารางนี้แสดงเฉพาะประเภทที่กำลังดูอยู่<br>'
      +'▲▼ เทียบกับ<b>ครั้งก่อนของประเภทเดียวกัน</b> — อีกประเภทหนึ่งดูได้โดยเลือกบทจากช่องด้านบน</div>';
  }

  /* ── บทที่พลาดบ่อยในสนามสอบหลายชุด (เฉพาะโหมดสนามสอบ) ── */
  if(isMockView){ try{ renderMockChronic(d); }catch(e){} }
}

/* ── 🔁 บทที่พลาดบ่อยจากสนามสอบหลายชุด (ต่างจากการ์ด 🧭 ที่ดูทีละชุด) ── */
function renderMockChronic(d){
  const pane=document.getElementById('pane-progress'); if(!pane)return;
  const mock=(d.mockHist||[]);
  if(mock.length<2) return;                      /* ชุดเดียวยังไม่เรียกว่า "บ่อย" */
  if(typeof EMBEDDED_QB==='undefined') return;

  const LAST=5;                                   /* ดูย้อนหลังไม่เกิน 5 ชุดล่าสุด */
  const recent=mock.slice(-LAST);
  const keys={}; recent.forEach(h=>{ keys[h.topic+'|'+h.date]=true; });

  const agg={};
  (d.myLongAll||[]).forEach(r=>{
    const tp=r[3]||'', dt=r[2]||'';
    if(!keys[tp+'|'+dt]) return;
    const qb=(EMBEDDED_QB[tp]||{})[parseInt(r[4])];
    const ch=qb&&qb.ch?qb.ch:null; if(!ch) return;
    const st=parseStatus(r[5]||'');
    const a=(agg[ch]=agg[ch]||{ch:ch,total:0,miss:0,sets:{}});
    a.total++;
    if(st!=='ok'){ a.miss++; a.sets[tp]=true; }
  });

  const list=Object.values(agg).filter(a=>a.miss>0)
    .map(a=>Object.assign(a,{rate:a.miss/a.total,nSets:Object.keys(a.sets).length}))
    .sort((a,b)=>(b.nSets-a.nSets)||(b.rate-a.rate)).slice(0,6);
  if(!list.length) return;

  const bars=list.map(a=>{
    const pct=Math.round(a.rate*100);
    const col=pct>=70?'#A32D2D':(pct>=50?'#C77E1A':'#D4A72C');
    return '<div style="margin-bottom:9px">'
      +'<div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:3px">'
      +  '<span>'+a.ch+' <span style="color:var(--text3);font-size:11px">· พลาดใน '+a.nSets+' ชุด</span></span>'
      +  '<span style="color:var(--text2)">'+(a.total-a.miss)+'/'+a.total+'</span></div>'
      +'<div style="height:7px;background:rgba(128,128,128,.15);border-radius:4px;overflow:hidden">'
      +  '<div style="height:100%;width:'+pct+'%;background:'+col+'"></div></div></div>';
  }).join('');

  const el=document.createElement('div');
  el.className='d-card';
  el.innerHTML='<div class="slabel">🔁 บทที่พลาดซ้ำในสนามสอบ</div>'
    +'<div style="font-size:12.5px;color:var(--text2);line-height:1.7;margin-bottom:10px">'
    +  'รวมจาก <b>'+recent.length+' ชุดล่าสุด</b> — แท่งยาว = พลาดสัดส่วนมาก และ "พลาดใน N ชุด" '
    +  'บอกว่าเป็นปัญหาซ้ำ ไม่ใช่พลาดครั้งเดียว บทที่อยู่บนสุดคือบทที่ควรกลับไปซ่อมก่อน</div>'
    + bars;
  pane.appendChild(el);
}

/* ═══════════════════════════════════════════════════════════════
   ★ 22 ก.ย. 69 — คิด "คะแนน" ควบคู่กับ "จำนวนข้อ" ทุกที่ที่พูดถึงข้อที่พลาด
   สนามสอบให้คะแนนไม่เท่ากันทุกข้อ (ตอนที่ 1 ข้อละ 3 คะแนน · ตอนที่ 2 ข้อละ 5 คะแนน)
   "พลาด 7 ข้อ" จึงไม่ได้แปลว่าเสีย 7 คะแนนเสมอไป — ต้องบอกเป็นคะแนนด้วย
   ═══════════════════════════════════════════════════════════════ */
function _ptsOf(topic, q){
  try{ if(typeof ptsOfQuestion === 'function') return ptsOfQuestion(topic, q); }catch(e){}
  return 1;
}
/* แบ่ง "ตอน" ของข้อสอบจากคะแนนจริง ไม่ hardcode — เปลี่ยนเกณฑ์คะแนนแล้วตามเอง
   คืน null เมื่อทุกข้อคะแนนเท่ากัน (บทปกติ) */
function examSections(topic){
  const p1 = _ptsOf(topic, 1);
  for(let q = 2; q <= 30; q++){
    const p = _ptsOf(topic, q);
    if(p !== p1) return { cut: q - 1, pts1: p1, pts2: p };
  }
  return null;
}
/* คะแนนที่เสียไป แยกตามสาเหตุ — อ่านจากสถานะรายข้อ (qResults) ซึ่งเป็นแหล่งเดียวกับกริดสี
   wrong นับรวมกับ cant · blank นับรวมกับ timeout (ตรงกับที่การ์ดแสดงมาแต่เดิม) */
function lostPointsOf(d){
  const r = (d && d.qResults) || {};
  const cnt = { care:0, concept:0, cant:0, timeout:0 };
  const pts = { care:0, concept:0, cant:0, timeout:0 };
  for(let q = 1; q <= 30; q++){
    let t = r[q];
    if(t === 'wrong') t = 'cant';
    if(t === 'blank') t = 'timeout';
    if(cnt[t] == null) continue;
    cnt[t]++; pts[t] += _ptsOf(d.topic, q);
  }
  const sum = cnt.care + cnt.concept + cnt.cant + cnt.timeout;
  const fromSheet = (d.care||0) + (d.concept||0) + (d.cant||0) + (d.timeout||0);
  /* ใช้ตัวเลขคะแนนก็ต่อเมื่อสถานะรายข้อตรงกับยอดในชีต — ไม่งั้นเงียบไว้ ดีกว่าบอกเลขที่ไม่ตรง */
  return { cnt: cnt, pts: pts, usable: sum > 0 && sum === fromSheet };
}
function _ptsTxt(n){ return n + ' คะแนน'; }

/* ★ 22 ก.ย. 69 — สนามสอบแบ่งกริดตาม "ตอน" ของข้อสอบจริง (1–25 / 26–30)
   ไม่ใช่แบ่งครึ่ง 1–15 / 16–30 ซึ่งไม่ตรงกับวิธีคิดคะแนน
   บทปกติคะแนนเท่ากันทุกข้อ จึงยังแบ่งครึ่งเหมือนเดิม
   หัวข้อของกริดเขียนทับจาก JS เพื่อไม่ต้องแก้ index.html */
function paintQGrid(d, id1, id2){
  const g1 = document.getElementById(id1), g2 = document.getElementById(id2);
  if(!g1 || !g2) return;
  const qClass = { ok:'q-ok', care:'q-care', concept:'q-concept', cant:'q-cant',
                   timeout:'q-timeout', wrong:'q-wrong', blank:'q-blank' };
  const sec = examSections(d.topic);
  const cut = sec ? sec.cut : 15;
  /* เขียนทับเฉพาะหัวข้อที่เป็นของกริดเอง ("ข้อ 1–15" / "ตอนที่ …")
     หน้าผู้ปกครองใช้หัวข้อ "ภาพรวมรายข้อ" ร่วมกับทั้งสองกริด — ต้องไม่ไปทับ */
  const lab = (g, txt) => { const el = g.previousElementSibling;
    if(!el || !el.classList || !el.classList.contains('slabel')) return;
    const cur = (el.textContent || '').trim();
    if(cur.indexOf('ข้อ ') === 0 || cur.indexOf('ตอนที่ ') === 0) el.textContent = txt; };
  if(sec){
    lab(g1, 'ตอนที่ 1 · ข้อ 1–' + cut + ' · ข้อละ ' + sec.pts1 + ' คะแนน');
    lab(g2, 'ตอนที่ 2 · ข้อ ' + (cut+1) + '–30 · ข้อละ ' + sec.pts2 + ' คะแนน');
  } else {
    lab(g1, 'ข้อ 1–15'); lab(g2, 'ข้อ 16–30');
  }
  g1.innerHTML = ''; g2.innerHTML = '';
  for(let i = 1; i <= 30; i++){
    const g = i <= cut ? g1 : g2;
    const el = document.createElement('div');
    el.className = 'q-cell ' + qClass[d.qResults[i]];
    el.textContent = i;
    g.appendChild(el);
  }
}

function renderStudentDash(d){
  try{ gradedEnsure(); }catch(e){}   /* ★ 24 ก.ย. 69 — การ์ดใบตรวจจากครู (วาดใต้ #s-encourage) */
  document.getElementById('s-avatar').textContent=d.shortName.substring(0,3);
  document.getElementById('s-name').textContent=d.shortName;
  document.getElementById('s-group').textContent='· '+d.group;
  document.getElementById('s-topic').textContent=d.topic+' · '+_dFmt(d.date);
  document.getElementById('s-rank').innerHTML=d.rank+' <span style="font-size:12px;color:var(--text3)">/ '+d.groupMembers.length+'</span>'+(d.allMembers.length>d.groupMembers.length?'<div style="font-size:10px;color:var(--text3);font-weight:400;margin-top:2px">รวมทุกกลุ่ม '+d.allRank+'/'+d.allMembers.length+'</div>':'');
  const avg=d.groupMembers.length?Math.round(d.groupMembers.reduce((s,m)=>s+m.score,0)/d.groupMembers.length):0;
  /* ★ 19 ก.ย. 69 — ของเดิมตรึงไว้ที่ /30 ชุดรวมจึงขึ้น "74 / 30" ทั้งที่เต็ม 100 */
  document.getElementById('s-score').innerHTML=d.score+' <span style="font-size:13px;color:var(--text3);font-weight:400">/ '+(d.full||30)+'</span>';
  document.getElementById('s-scorepct').textContent=Math.round(d.score/(d.full||30)*100)+'% · เฉลี่ยกลุ่ม '+Math.round(avg/(d.full||30)*100)+'%'+(d.allMembers.length>d.groupMembers.length?' · เฉลี่ยรวม '+Math.round(d.allAvg/(d.full||30)*100)+'%':'');
  try{ paintUnfilledStudent(d); }catch(e){}   /* ★ 25 ก.ย. 69 — ป้าย "ยังไม่ครบ 30 ข้อ" */
  /* ★ 22 ก.ย. 69 — หัวการ์ดบอกทั้งจำนวนข้อและคะแนนที่เสียไป · รายละเอียดแยกสองบรรทัด
     บรรทัดบน = เสียเพราะจังหวะ/ความรีบ (แก้ได้เร็ว) · บรรทัดล่าง = เสียเพราะเนื้อหา (ต้องกลับไปทบทวน) */
  {
    const _lp = lostPointsOf(d);
    const _nQ = d.wrong + d.care + d.concept + d.blank;
    const _unit = 'font-size:13px;color:var(--text3);font-weight:400';
    const _lost = _lp.pts.timeout + _lp.pts.care + _lp.pts.concept + _lp.pts.cant;
    document.getElementById('s-wrong').innerHTML = _lp.usable
      ? _nQ + ' <span style="' + _unit + '">ข้อ /</span> ' + _lost + ' <span style="' + _unit + '">คะแนน</span>'
      : _nQ + ' <span style="' + _unit + '">ข้อ</span>';
    const _wsEl = document.getElementById('s-wrongsub');
    if(_lp.usable){
      /* บรรทัดละสาเหตุ — จอแคบแล้วข้อความไม่ตกบรรทัดจนอ่านยาก
         เรียงจาก "เก็บคืนง่ายสุด" ลงไป: สะเพร่า → ผิดคอนเซปต์ → ทำไม่ได้ → ทำไม่ทัน */
      const part = (n, pts, label) => n ? ('<div>' + label + ' ' + n + ' ข้อ (' + _ptsTxt(pts) + ')</div>') : '';
      _wsEl.innerHTML =
        part(_lp.cnt.care,    _lp.pts.care,    'สะเพร่า') +
        part(_lp.cnt.concept, _lp.pts.concept, 'ผิดคอนเซปต์') +
        part(_lp.cnt.cant,    _lp.pts.cant,    'ทำไม่ได้') +
        part(_lp.cnt.timeout, _lp.pts.timeout, 'ทำไม่ทัน');
      _wsEl.title = 'คิดจากคะแนนจริงของแต่ละข้อ' +
        (examSections(d.topic) ? ' (ข้อ 1–' + examSections(d.topic).cut + ' ข้อละ ' + examSections(d.topic).pts1 +
          ' คะแนน · ข้อ ' + (examSections(d.topic).cut+1) + '–30 ข้อละ ' + examSections(d.topic).pts2 + ' คะแนน)' : '');
    } else {
      _wsEl.textContent = d.blank+' ไม่ทำ · '+d.care+' สะเพร่า · '+d.concept+' คอนเซปต์ · '+d.wrong+' ทำไม่ได้';
    }
  }
  // ข้อความให้กำลังใจ — เน้นสิ่งที่ควบคุมได้
  const encEl=document.getElementById('s-encourage');
  if(encEl){
    let msg='';
    if(d.care>=3){msg=`💡 มี ${d.care} ข้อที่ทำเป็นแล้วแต่พลาดจากความรีบ — ถ้าตรวจทานให้ดีอีกนิด คะแนนขึ้นได้อีก ${d.care} ข้อเลย!`;}
    else if(d.blank>=3){msg=`💡 มี ${d.blank} ข้อที่ยังไม่ได้ลอง — ครั้งหน้าลองจัดเวลาให้ครบทุกข้อ อาจได้คะแนนเพิ่มอีก`;}
    else if(d.score>=24){msg=`🌟 ทำได้ยอดเยี่ยม! รักษาจังหวะนี้ไว้`;}
    else{msg=`💪 ทุกข้อที่ผิดคือโอกาสเรียนรู้ — โฟกัสทีละหัวข้อ แล้วครั้งหน้าจะดีขึ้นแน่นอน`;}
    encEl.innerHTML=msg;
    encEl.style.display='block';
  }
  try{renderTrendCard(d);}catch(e){console.error('trend',e);}
  try{renderProgressTrend(d);}catch(e){console.error('progress',e);}
  paintQGrid(d, 'qgrid1', 'qgrid2');
  const needReview=d.myAna.filter(r=>['wrong','blank','care','concept','cant','timeout'].includes(parseStatus(r[5]||''))).map(r=>({q:parseInt(r[4]),sub:r[6]||'',year:r[3]||'',level:parseInt(r[7])||0,type:parseStatus(r[5]||'')})).sort((a,b)=>{
    const pri={care:0,concept:1,wrong:2,cant:2,timeout:3,blank:4};
    const pa=pri[a.type]!=null?pri[a.type]:9;
    const pb=pri[b.type]!=null?pri[b.type]:9;
    return pa-pb||a.q-b.q;
  });
  const rl=document.getElementById('s-reviewList');rl.innerHTML='';
  if(!needReview.length){rl.innerHTML='<div style="font-size:13px;color:var(--text2);padding:8px 0">ทำถูกทุกข้อ 🎉</div>';}
  else { rl.innerHTML='<div style="font-size:11px;color:var(--text2);margin-bottom:10px;display:flex;flex-wrap:wrap;gap:10px"><span>⚠️ สะเพร่า</span><span>📖 คอนเซปต์</span><span>❌ ผิด/ทำไม่ได้</span><span>⏰ ไม่ทัน</span></div>';
  needReview.forEach(r=>{const statusEmoji={ok:'✅',care:'⚠️',concept:'📖',cant:'❌',timeout:'⏰',wrong:'❌',blank:'⬜'}[r.type]||'⚠️';const stars='★'.repeat(r.level)+'☆'.repeat(5-r.level);rl.innerHTML+=`<div class="rev-row"><div style="min-width:20px;font-size:11px;color:var(--text2);font-weight:500">${r.q}</div><div style="flex:1"><div style="font-size:12px;color:var(--text1)">${r.sub}</div><div style="font-size:10px;color:var(--text3)">${r.year} · ระดับ ${r.level} <span style="color:#BA7517">${stars}</span></div></div><span style="font-size:16px">${statusEmoji}</span></div>`;});
  } // close else
  const sl=document.getElementById('s-subtopicList');sl.innerHTML='';
  // คำแนะนำว่าควรโฟกัสหัวข้อไหน
  const weakSt=d.subtopics.filter(st=>Math.round(st.ok/st.total*100)<70);
  const hintEl=document.getElementById('s-subtopicHint');
  if(d.subtopics.length===0){
    hintEl.innerHTML=`ยังไม่มีข้อมูลแยกหัวข้อสำหรับบทนี้ — ดูผลรายข้อได้ที่ tab "รายข้อ" ครับ`;
  } else if(weakSt.length>0){
    hintEl.innerHTML=`บทนี้มี <b>${d.subtopics.length} หัวข้อ</b> — ลองโฟกัสที่ <b style="color:var(--red)">${weakSt[0].name}</b>${weakSt.length>1?` และ <b style="color:var(--amber)">${weakSt[1].name}</b>`:''} ก่อน เพราะยังทำได้ต่ำกว่า 70% 💪`;
  } else {
    hintEl.innerHTML=`บทนี้มี <b>${d.subtopics.length} หัวข้อ</b> — ทำได้ดีทุกหัวข้อแล้ว เก่งมาก! 🎉 ลองท้าทายข้อระดับยากขึ้นได้เลย`;
  }
  d.subtopics.forEach(st=>{const pct=Math.round(st.ok/st.total*100);const cls=pct>=80?'diff-ok':pct>=50?'diff-warn':pct>0?'diff-bad':'diff-skip';const showYt=pct<70;sl.innerHTML+=`<div class="st-row"><div style="flex:1"><div style="font-size:12px;color:var(--text1)">${st.name}</div><div style="font-size:10px;color:var(--text3)">ระดับ ${st.level} · ${st.ok}/${st.total} ข้อ</div>${showYt?ytBtn(d.topic+' '+st.name):''}</div><div class="diff-badge ${cls}">${st.total===0?'—':pct+'%'}</div></div>`;});
  try{renderChapterWeak(d);}catch(e){console.error("chapweak",e);}
  try{renderPracticePlan(d);}catch(e){console.error("practice",e);}
  // ── แผนทบทวน: เรียงตาม effort ต่ำ → ผลสูง ──
  const planEl=document.getElementById('s-studyPlan');
  if(planEl){
    planEl.innerHTML='';
    const steps=[];
    // ขั้น 1: สะเพร่า (ได้คืนง่ายสุด — รู้อยู่แล้ว แค่ฝึกรอบคอบ)
    const careQs=d.myAna.filter(r=>parseStatus(r[5]||'')==='care').map(r=>({q:parseInt(r[4]),sub:r[6]||''}));
    if(careQs.length)steps.push({n:steps.length+1,icon:'⚡',color:'#F5A623',title:`เก็บคะแนนจากข้อสะเพร่า (${careQs.length} ข้อ)`,
      desc:`ข้อ ${careQs.map(c=>c.q).join(', ')} — ทำเป็นอยู่แล้ว! ลองทำซ้ำแบบไม่รีบ แล้วจดว่าครั้งแรกพลาดตรงไหน (อ่านโจทย์ตก? คำนวณพลาด?) ใช้เวลาน้อยสุดแต่ได้คะแนนคืนเต็ม ๆ`});
    // ขั้น 2: ข้อผิดระดับง่าย-กลาง (1-3)
    // ขั้น 2: ข้อคอนเซปต์ (C) ระดับง่าย-กลาง
    const conceptQs=d.myAna.filter(r=>parseStatus(r[5]||'')==='concept'&&parseInt(r[7])<=3).map(r=>({q:parseInt(r[4]),sub:r[6]||''}));
    if(conceptQs.length)steps.push({n:steps.length+1,icon:'💡',color:'#a855f7',title:`เสริมคอนเซปต์พื้นฐาน (${conceptQs.length} ข้อ)`,
      desc:`ข้อ ${conceptQs.map(c=>c.q).join(', ')} — ผิดเพราะยังไม่เข้าใจหลักการ ดูคลิปติวหัวข้อ ${[...new Set(conceptQs.map(c=>c.sub))].slice(0,2).join(', ')} ก่อนทำซ้ำ`,
      yt:[...new Set(conceptQs.map(c=>c.sub))].slice(0,3)});
    // ขั้น 3: ข้อผิด/ทำไม่ได้ระดับง่าย-กลาง (wrong + cant)
    const easyWrong=d.myAna.filter(r=>['wrong','cant'].includes(parseStatus(r[5]||''))&&parseInt(r[7])<=3).map(r=>({q:parseInt(r[4]),sub:r[6]||''}));
    if(easyWrong.length)steps.push({n:steps.length+1,icon:'📗',color:'#4C9A2A',title:`แก้ข้อผิดระดับพื้นฐาน (${easyWrong.length} ข้อ)`,
      desc:`ข้อ ${easyWrong.map(c=>c.q).join(', ')} — ระดับไม่ยาก ทบทวนหลักการของหัวข้อ ${[...new Set(easyWrong.map(c=>c.sub))].join(', ')} ก่อน 💪`,
      yt:[...new Set(easyWrong.map(c=>c.sub))].slice(0,3)});
    // ขั้น 4: ข้อไม่ทัน/ไม่ทำระดับง่าย-กลาง
    const easyBlank=d.myAna.filter(r=>['blank','timeout'].includes(parseStatus(r[5]||''))&&parseInt(r[7])<=3).map(r=>({q:parseInt(r[4]),sub:r[6]||''}));
    if(easyBlank.length)steps.push({n:steps.length+1,icon:'📘',color:'#185FA5',title:`ลองข้อที่ไม่ทัน/ไม่ได้ทำระดับพื้นฐาน (${easyBlank.length} ข้อ)`,
      desc:`ข้อ ${easyBlank.map(c=>c.q).join(', ')} — ยังไม่ได้ทำหรือเวลาไม่ทัน เริ่มจากอ่านโจทย์ช้า ๆ แล้วเขียนสิ่งที่รู้ออกมาก่อน`,
      yt:[...new Set(easyBlank.map(c=>c.sub))].slice(0,3)});
    // ขั้น 5: ข้อยาก (4-5)
    const hardOnes=d.myAna.filter(r=>['wrong','blank','concept','cant','timeout'].includes(parseStatus(r[5]||''))&&parseInt(r[7])>=4).map(r=>({q:parseInt(r[4]),sub:r[6]||''}));
    if(hardOnes.length)steps.push({n:steps.length+1,icon:'🏔️',color:'#A32D2D',title:`ท้าทายข้อยาก (${hardOnes.length} ข้อ)`,
      desc:`ข้อ ${hardOnes.map(c=>c.q).join(', ')} — ระดับ 4-5 ทำทีหลังสุดเมื่อพื้นฐานแน่นแล้ว ศึกษาจากคลิปติวในช่อง MathsBankTutor`,
      yt:[...new Set(hardOnes.map(c=>c.sub))].slice(0,3)});
    // ── v2: จุดอ่อนเรื้อรัง — sub-topic ที่พลาดซ้ำมากกว่า 1 การสอบ ──
    let chronicHtml='';
    try{
      const missBySub={};
      (d.myLongAll||[]).forEach(r=>{
        const sub=(r[6]&&r[6]!=='—')?r[6]:''; if(!sub)return;
        const st=parseStatus(r[5]||''); if(st==='ok'||st==='blank')return;
        if(!missBySub[sub])missBySub[sub]=new Set();
        missBySub[sub].add((r[2]||'')+'|'+(r[3]||''));
      });
      const chronic=Object.entries(missBySub).filter(([,set])=>set.size>=2).map(([sub,set])=>({sub,times:set.size})).sort((a,b)=>b.times-a.times).slice(0,4);
      if(chronic.length){
        chronicHtml='<div style="background:#FDF3E3;border:1px solid #F0D9AE;border-radius:10px;padding:10px 12px;margin:2px 0 10px"><div style="font-size:12px;font-weight:600;color:#8A5A10;margin-bottom:4px">🔁 จุดอ่อนเรื้อรัง — พลาดซ้ำมากกว่า 1 การสอบ</div>'
          +chronic.map(c=>`<div style="font-size:12px;color:var(--text2);padding:3px 0">• ${c.sub} <span style="color:var(--text3)">(พลาดใน ${c.times} การสอบ)</span><br>${ytBtn(c.sub,'ทบทวนคลิปหัวข้อนี้')}</div>`).join('')
          +'<div style="font-size:11px;color:#8A5A10;margin-top:6px">หัวข้อที่พลาดซ้ำแบบนี้ ควรกลับไปทำความเข้าใจแนวคิดใหม่กับครู ไม่ใช่แค่ฝึกโจทย์เพิ่มครับ (พลาดครั้งแรกในหัวข้ออื่นเป็นเรื่องปกติ ไม่ต้องกังวล)</div></div>';
      }
    }catch(e){console.error('chronic',e);}
    if(!steps.length){planEl.innerHTML=chronicHtml+'<div style="font-size:13px;color:var(--green);padding:8px 0">ทำถูกครบทุกข้อ ไม่มีอะไรต้องทบทวน 🎉</div>';}
    else{
      // ── v2: checkbox + progress (จำสถานะใน localStorage รายการสอบ) ──
      const spKey=n=>'sp:'+currentStudent+':'+d.topic+':'+d.date+':'+n;
      let done0=0; steps.forEach(s=>{try{if(localStorage.getItem(spKey(s.n))==='1')done0++;}catch(e){}});
      let html=chronicHtml+`<div style="margin-bottom:8px"><div style="background:var(--blue-l,#E8F1FA);height:9px;border-radius:99px;overflow:hidden"><div id="sp-fill" style="height:100%;background:#185FA5;border-radius:99px;transition:width .3s;width:${Math.round(done0/steps.length*100)}%"></div></div><div id="sp-text" style="font-size:11px;color:var(--text3);margin-top:4px">ทำแล้ว ${done0} จาก ${steps.length} ขั้น${done0===steps.length?' — ครบแล้ว เก่งมาก! 🎉':''}</div></div>`;
      steps.forEach(s=>{
        let isDone=false; try{isDone=localStorage.getItem(spKey(s.n))==='1';}catch(e){}
        html+=`<div class="sp-row" style="display:flex;gap:12px;padding:12px 0;border-bottom:0.5px solid var(--border);opacity:${isDone?'0.55':'1'}">
        <input type="checkbox" data-spkey="${spKey(s.n)}" onchange="spTick(this)" ${isDone?'checked':''} style="width:19px;height:19px;accent-color:#185FA5;margin-top:6px;cursor:pointer;flex-shrink:0">
        <div style="width:32px;height:32px;border-radius:50%;background:${s.color};color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;flex-shrink:0">${s.n}</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:600;color:var(--text1);margin-bottom:3px">${s.icon} ${s.title}</div>
          <div style="font-size:12px;color:var(--text2);line-height:1.6;margin-bottom:6px">${s.desc}</div>
          ${s.yt?`<div style="display:flex;gap:6px;flex-wrap:wrap">${s.yt.map(t=>`<a href="${ytLink(t)}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:4px;background:#FF0000;color:#fff;font-size:10px;font-weight:500;padding:3px 10px;border-radius:20px;text-decoration:none">🎬 ${t}</a>`).join('')}</div>`:''}
        </div>
      </div>`;
      });
      planEl.innerHTML=html;
    }
  }
  if(diffChartInst){diffChartInst.destroy();diffChartInst=null;}
  const diffLevels=Object.keys(d.diffMap).sort((a,b)=>a-b);
  diffChartInst=new Chart(document.getElementById('s-diffChart'),{type:'bar',data:{labels:diffLevels.map(l=>'ระดับ '+l),datasets:[{label:'% ถูก',data:diffLevels.map(lv=>Math.round(d.diffMap[lv].ok/d.diffMap[lv].total*100)),backgroundColor:['#B5D4F4','#85B7EB','#378ADD','#185FA5','#0C447C'],borderRadius:4,borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>c.raw+'%'}}},scales:{y:{min:0,max:100,ticks:{callback:v=>v+'%',stepSize:25},grid:{color:'rgba(128,128,128,0.1)'}},x:{grid:{display:false}}}}});
  const cl=document.getElementById('s-compareList');cl.innerHTML='';
  // ── ภาพรวมกลุ่ม ──
  const gn=document.getElementById('s-grpName');if(gn)gn.textContent='· '+d.group;
  const gs=document.getElementById('s-grpStats');
  if(gs&&d.grpStats){
    const st=d.grpStats;
    const box=(label,val,sub,color)=>`<div style="background:var(--surf);border-radius:var(--r-md);padding:10px 12px"><div style="font-size:10px;color:var(--text3)">${label}</div><div style="font-size:18px;font-weight:600;color:${color||'var(--text1)'}">${val}</div><div style="font-size:10px;color:var(--text3)">${sub||''}</div></div>`;
    gs.innerHTML=box('คะแนนเฉลี่ยกลุ่ม',st.avg+'<span style="font-size:11px;color:var(--text3);font-weight:400"> /'+(d.full||30)+'</span>','จาก '+st.count+' คน','var(--blue)')
      +box('ช่วงคะแนน',st.lo+'–'+st.hi,'ต่ำสุด–สูงสุด')
      /* ★ 22 ก.ย. 69 — บอกด้วยว่าสะเพร่าเฉลี่ยคิดเป็นกี่คะแนน
         รู้แค่ "จำนวนข้อ" ของเพื่อนแต่ละคน ไม่รู้ว่าเป็นข้อไหน จึงเป็นค่าประมาณจากคะแนนเฉลี่ยต่อข้อ
         (บทปกติข้อละ 1 คะแนน — ตัวเลขจะเท่ากับจำนวนข้อ จึงไม่ต้องบอกซ้ำ) */
      +box('สะเพร่าเฉลี่ย',st.careAvg+'<span style="font-size:11px;color:var(--text3);font-weight:400"> ข้อ</span>',
           (function(){
             const full=d.full||30;
             if(full===30) return 'ต่อคน';
             const per=full/30, lost=Math.round(st.careAvg*per*10)/10;
             return 'ต่อคน ≈ '+lost+' คะแนน';
           })(),'#C77E1A');
  }
  // ── หัวข้อที่กลุ่มควรทบทวนร่วมกัน ──
  const gw=document.getElementById('s-grpWeak');
  if(gw){
    gw.innerHTML='';
    if(!d.grpSubtopics||!d.grpSubtopics.length){
      gw.innerHTML='<div style="font-size:12px;color:var(--text3)">ยังไม่มีข้อมูลแยกหัวข้อของกลุ่มนี้</div>';
    }else{
      d.grpSubtopics.forEach(st=>{
        const pct=st.total?Math.round(st.ok/st.total*100):0;
        const cls=pct>=80?'diff-ok':pct>=50?'diff-warn':pct>0?'diff-bad':'diff-skip';
        const showYt=pct<70;
        gw.innerHTML+=`<div class="st-row"><div style="flex:1"><div style="font-size:12px;color:var(--text1)">${st.name}</div><div style="font-size:10px;color:var(--text3)">ทั้งกลุ่มทำถูก ${st.ok}/${st.total} · สะเพร่า ${st.care} · ผิด ${st.wrong} · ไม่ทำ ${st.blank}</div>${showYt?ytBtn(d.topic+' '+st.name,'คลิปติวกลุ่ม'):''}</div><div class="diff-badge ${cls}">${pct}%</div></div>`;
      });
    }
  }
  // ── การ์ด 2: เทียบกับกลุ่มอื่น (เลือกได้) ──
  renderAllComparison(d);
  let ac=0;
  d.groupMembers.forEach(s=>{const pct=Math.round(s.score/(d.full||30)*100);cl.innerHTML+=`<div class="cmp-row"><div class="cmp-name">${s.isMe?d.shortName:'เพื่อน '+(s.isMe?0:++ac)}${s.isMe?'<span class="me-tag">คุณ</span>':''}</div><div class="bar-wrap"><div class="bar-fill" style="width:${pct}%;background:${s.isMe?'#185FA5':'#B5D4F4'}"></div></div><div class="cmp-score">${s.score}/${d.full||30}</div></div>`;});
  if(groupChartInst){groupChartInst.destroy();groupChartInst=null;}
  let bc=0;
  groupChartInst=new Chart(document.getElementById('s-groupChart'),{type:'bar',data:{labels:d.groupMembers.map(s=>s.isMe?d.shortName:'เพื่อน '+(++bc)),datasets:[{label:'คะแนน',data:d.groupMembers.map(s=>s.score),backgroundColor:d.groupMembers.map(s=>s.isMe?'#185FA5':'#B5D4F4'),borderRadius:4,borderWidth:0},{label:'สะเพร่า',data:d.groupMembers.map(s=>s.care),backgroundColor:d.groupMembers.map(s=>s.isMe?'#BA7517':'#FAC775'),borderRadius:4,borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>c.dataset.label+': '+c.raw}}},scales:{y:{min:0,max:30,ticks:{stepSize:5},grid:{color:'rgba(128,128,128,0.1)'}},x:{grid:{display:false}}}}});
}

function renderAllComparison(d){
  const picker=document.getElementById('s-grpPicker');
  const statsEl=document.getElementById('s-allStats');
  const listEl=document.getElementById('s-allCompareList');
  if(!picker||!statsEl||!listEl)return;

  const groups=d.groupsInTopic||[];
  // ครั้งแรก / เปลี่ยนนักเรียน → default เลือกทุกกลุ่ม
  if(selectedGroups===null)selectedGroups=groups.slice();

  // ถ้ามีแค่กลุ่มเดียวที่สอบบทนี้ → ยังไม่มีกลุ่มอื่นให้เทียบ
  if(groups.length<=1){
    picker.innerHTML='';
    statsEl.innerHTML='';
    const dw=document.getElementById('s-allDistWrap');if(dw)dw.style.display='none';
    const tw=document.getElementById('s-top10Wrap');if(tw)tw.style.display='none';
    listEl.style.display='block';
    listEl.innerHTML=`<div style="font-size:12px;color:var(--text3);line-height:1.6">ยังมีแค่กลุ่ม <b>${d.group}</b> ที่สอบบท "${d.topic}"<br>เมื่อกลุ่มอื่นสอบบทเดียวกัน จะเทียบข้ามกลุ่มได้ที่นี่ครับ</div>`;
    return;
  }
  // มีหลายกลุ่ม → โชว์ dist + top10
  const dw=document.getElementById('s-allDistWrap');if(dw)dw.style.display='block';
  const tw=document.getElementById('s-top10Wrap');if(tw)tw.style.display='block';
  listEl.style.display='none';

  // ปุ่มเลือกกลุ่ม (chip toggle)
  picker.innerHTML='';
  groups.forEach(g=>{
    const on=selectedGroups.includes(g);
    const isMine=g===d.group;
    const chip=document.createElement('button');
    chip.textContent=g+(isMine?' (กลุ่มคุณ)':'');
    chip.style.cssText=`font-size:11px;padding:5px 12px;border-radius:16px;border:1px solid ${on?'#185FA5':'var(--border-md)'};background:${on?'#185FA5':'transparent'};color:${on?'#fff':'var(--text2)'};cursor:pointer;font-weight:${isMine?'600':'400'}`;
    chip.onclick=()=>{
      if(selectedGroups.includes(g)){
        if(selectedGroups.length>1)selectedGroups=selectedGroups.filter(x=>x!==g);
      }else{
        selectedGroups=selectedGroups.concat(g);
      }
      renderAllComparison(d);
    };
    picker.appendChild(chip);
  });

  // กรองสมาชิกตามกลุ่มที่เลือก
  const members=(d.allMembers||[]).filter(m=>selectedGroups.includes(m.group));
  const scores=members.map(m=>m.score);
  const avg=scores.length?Math.round(scores.reduce((a,b)=>a+b,0)/scores.length*10)/10:0;
  const myScore=d.score;
  const sorted=[...members].sort((a,b)=>b.score-a.score);
  const myRank=sorted.findIndex(m=>m.isMe)+1;
  // เปอร์เซ็นไทล์: มีกี่ % ของคนที่คะแนนน้อยกว่าหรือเท่าเรา
  const below=members.filter(m=>m.score<myScore).length;
  const pctile=members.length?Math.round(below/members.length*100):0;
  const topPct=100-pctile; // อยู่ top กี่ %

  const box=(label,val,sub,color)=>`<div style="background:var(--surf);border-radius:var(--r-md);padding:10px 12px"><div style="font-size:10px;color:var(--text3)">${label}</div><div style="font-size:18px;font-weight:600;color:${color||'var(--text1)'}">${val}</div><div style="font-size:10px;color:var(--text3)">${sub||''}</div></div>`;
  statsEl.innerHTML=box('อันดับของคุณ',(myRank||'—')+'<span style="font-size:11px;color:var(--text3);font-weight:400"> /'+members.length+'</span>','จาก '+selectedGroups.length+' กลุ่ม','var(--blue)')
    +box('คุณอยู่ Top',topPct+'%','ของทุกคนที่สอบบทนี้',topPct<=25?'#3B7D2A':topPct<=50?'#185FA5':'#C77E1A')
    +box('คะแนนคุณ',myScore+'<span style="font-size:11px;color:var(--text3);font-weight:400"> /'+(d.full||30)+'</span>',(myScore>=avg?'+':'')+(Math.round((myScore-avg)*10)/10)+' จากเฉลี่ย '+avg,myScore>=avg?'#3B7D2A':'#C77E1A');

  // ── กราฟ distribution: แบ่งช่วงคะแนน 0-5,6-10,...,26-30 ──
  const bins=[{lo:0,hi:5,label:'0-5'},{lo:6,hi:10,label:'6-10'},{lo:11,hi:15,label:'11-15'},{lo:16,hi:20,label:'16-20'},{lo:21,hi:25,label:'21-25'},{lo:26,hi:30,label:'26-30'}];
  const counts=bins.map(b=>members.filter(m=>m.score>=b.lo&&m.score<=b.hi).length);
  const myBin=bins.findIndex(b=>myScore>=b.lo&&myScore<=b.hi);
  const barColors=bins.map((b,i)=>i===myBin?'#185FA5':'#CBD9E8');
  if(distChartInst){distChartInst.destroy();distChartInst=null;}
  distChartInst=new Chart(document.getElementById('s-distChart'),{
    type:'bar',
    data:{labels:bins.map(b=>b.label),datasets:[{label:'จำนวนคน',data:counts,backgroundColor:barColors,borderRadius:4,borderWidth:0}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},
        tooltip:{callbacks:{label:c=>c.raw+' คน'+(c.dataIndex===myBin?' (รวมคุณ)':'')}}},
      scales:{y:{beginAtZero:true,ticks:{stepSize:Math.max(1,Math.ceil(Math.max(...counts)/5)),precision:0},grid:{color:'rgba(128,128,128,0.1)'},title:{display:true,text:'จำนวนคน',font:{size:10}}},
        x:{grid:{display:false},title:{display:true,text:'ช่วงคะแนน',font:{size:10}}}}}
  });

  // ── ตาราง Top 10 ──
  const top10El=document.getElementById('s-top10');
  if(top10El){
    top10El.innerHTML='';
    const top=sorted.slice(0,10);
    let oc=0;
    top.forEach((m,i)=>{
      const medal=i===0?'🥇':i===1?'🥈':i===2?'🥉':(i+1)+'.';
      const label=m.isMe?d.shortName:('เพื่อน '+(++oc)+' · '+m.group);
      const bg=m.isMe?'var(--blue-l)':'transparent';
      top10El.innerHTML+=`<div style="display:flex;align-items:center;gap:10px;padding:7px 8px;border-radius:8px;background:${bg};border-bottom:0.5px solid var(--border)">
        <div style="width:28px;text-align:center;font-size:13px;font-weight:600;color:var(--text2)">${medal}</div>
        <div style="flex:1;font-size:12px;color:var(--text1)">${label}${m.isMe?'<span class="me-tag">คุณ</span>':''}</div>
        <div style="font-size:13px;font-weight:600;color:var(--text1)">${m.score}<span style="font-size:10px;color:var(--text3);font-weight:400">/${d.full||30}</span></div>
      </div>`;
    });
    // ถ้าฉันไม่ติด top 10 → แสดงแถวของฉันต่อท้าย
    if(myRank>10){
      top10El.innerHTML+=`<div style="text-align:center;font-size:11px;color:var(--text3);padding:4px">· · ·</div>
      <div style="display:flex;align-items:center;gap:10px;padding:7px 8px;border-radius:8px;background:var(--blue-l)">
        <div style="width:28px;text-align:center;font-size:13px;font-weight:600;color:var(--blue)">${myRank}.</div>
        <div style="flex:1;font-size:12px;color:var(--text1)">${d.shortName}<span class="me-tag">คุณ</span></div>
        <div style="font-size:13px;font-weight:600;color:var(--text1)">${myScore}<span style="font-size:10px;color:var(--text3);font-weight:400">/${d.full||30}</span></div>
      </div>`;
    }
  }
}

// ═══════ v2: รายงานผู้ปกครอง 5 สไตล์ (🦅🐬🐘🦉🐝) ═══════
// ผู้ปกครองเลือกสไตล์เอง → จำใน localStorage ของเครื่องนั้น (ไม่ต้องแก้ Sheet)
const PARENT_TYPES={
  eagle:   {em:'🦅',nm:'นกอินทรี',tag:'เป้าหมายชัด เห็นแผน'},
  dolphin: {em:'🐬',nm:'โลมา',tag:'ข้อมูลเต็มทุกมิติ'},
  elephant:{em:'🐘',nm:'ช้าง',tag:'อบอุ่น ข่าวดีมาก่อน'},
  owl:     {em:'🦉',nm:'นกฮูก',tag:'สรุปสั้น เชื่อมั่น'},
  bee:     {em:'🐝',nm:'ผึ้ง',tag:'การ์ดเดียวจบ'}
};
function _getPType(){ try{return localStorage.getItem('ptype:'+currentStudent)||'dolphin';}catch(e){return 'dolphin';} }

/* ═══════ v3.1: ระบบข้อความไม่ซ้ำ ═══════
   (1) _pv() = หมุนสำนวนตามครั้งที่สอบ → ครั้งติดกันไม่ได้ประโยคเดิม แต่รายงานเดิมเปิดกี่รอบก็เหมือนเดิม
   (2) _parentFacts() = ดึงข้อเท็จจริงเฉพาะตัวนักเรียน (เลขข้อ ชื่อหัวข้อ จุดที่พลาดซ้ำ) มาใส่ในประโยค */
function _pSeed(d){ return ((d.history&&d.history.length)||1) + String(d.date||'').length; }
function _pv(pool,d,off){ if(!pool||!pool.length)return''; return pool[(_pSeed(d)+(off||0))%pool.length]; }
function _thaiList(a,max){ a=(a||[]).filter(Boolean); if(!a.length)return''; const t=a.slice(0,max||2); return t.join(' และ ')+(a.length>(max||2)?' (และหัวข้ออื่น)':''); }
function _parentFacts(d){
  const f={};
  const st=s=>d.myAna.filter(r=>parseStatus(r[5]||'')===s);
  const qn=s=>st(s).map(r=>parseInt(r[4])).filter(n=>n).sort((a,b)=>a-b);
  const subs=s=>[...new Set(st(s).map(r=>r[6]).filter(x=>x&&x!=='—'))];
  f.careQ=qn('care'); f.conceptQ=qn('concept'); f.cantQ=qn('cant'); f.timeQ=qn('timeout');
  f.careSub=subs('care'); f.conceptSub=subs('concept'); f.cantSub=subs('cant');
  f.weak=(d.subtopics||[]).filter(s=>s.total&&Math.round(s.ok/s.total*100)<70);
  f.strong=(d.subtopics||[]).filter(s=>s.total>=2&&s.ok/s.total>=0.8);
  f.weakName=f.weak.length?f.weak[0].name:'';
  f.strongName=f.strong.length?f.strong[f.strong.length-1].name:'';
  // จุดที่พลาดซ้ำข้ามการสอบ (จาก results_long ทุกครั้ง)
  const mm={};
  (d.myLongAll||[]).forEach(r=>{
    const s=(r[6]&&r[6]!=='—')?r[6]:''; if(!s)return;
    const k=parseStatus(r[5]||''); if(k==='ok'||k==='blank')return;
    (mm[s]=mm[s]||new Set()).add((r[2]||'')+'|'+(r[3]||''));
  });
  f.chronic=Object.entries(mm).filter(([,v])=>v.size>=2).sort((a,b)=>b[1].size-a[1].size).map(([k,v])=>({sub:k,times:v.size}));
  f.qList=(arr)=>arr.length?('ข้อ '+arr.slice(0,6).join(', ')+(arr.length>6?' …':'')):'';
  return f;
}
function setPType(k){ try{localStorage.setItem('ptype:'+currentStudent,k);}catch(e){} if(dashData)renderParentDash(dashData); }
function _fillParentQGrid(d){
  paintQGrid(d, 'p-qgrid1', 'p-qgrid2');
}
function renderParentDash(d){
  const name=d.shortName;
  (function(){const el=document.getElementById('p-avatar');el.textContent=name;el.style.fontSize=name.length>5?'9px':name.length>3?'11px':'13px';el.style.lineHeight='1.2';el.style.textAlign='center';}());
  document.getElementById('p-topic').textContent=d.topic+' · '+_dFmt(d.date);
  const _pHeader=document.querySelector('#p5 .container [style*="font-size:15px"]');
  if(_pHeader) _pHeader.textContent='รายงานผลการเรียน — '+name;
  // แถบเลือกสไตล์ (แทรกเหนือ summary ครั้งแรกครั้งเดียว)
  let bar=document.getElementById('p-animalBar');
  if(!bar){ const ps=document.getElementById('p-summary'); if(ps){ps.insertAdjacentHTML('beforebegin','<div id="p-animalBar"></div>'); bar=document.getElementById('p-animalBar');} }
  const cur=_getPType();
  if(bar){
    bar.innerHTML='<div style="font-size:11px;color:var(--text3,#948F86);margin-bottom:6px">สไตล์การรายงาน — เลือกแบบที่ใกล้เคียง "สไตล์การเชียร์ลูก" ของคุณ (ระบบจะจำไว้ในเครื่องนี้)</div>'
      +'<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">'
      +Object.entries(PARENT_TYPES).map(([k,a])=>`<button onclick="setPType('${k}')" style="flex:1 1 100px;min-width:96px;border:1.5px solid ${k===cur?'#185FA5':'var(--border,#E7E4DC)'};background:${k===cur?'var(--blue-l,#E8F1FA)':'#fff'};border-radius:10px;padding:7px 4px;cursor:pointer;text-align:center;font-family:inherit"><span style="font-size:20px;display:block">${a.em}</span><b style="font-size:12px">${a.nm}</b><span style="display:block;font-size:9.5px;color:var(--text3,#948F86)">${a.tag}</span></button>`).join('')
      +'</div>';
  }
  try{ renderParentTrend(d); }catch(e){ console.error('parent trend', e); }   /* ★ 26 ก.ย. 69 — กราฟพัฒนาการ เหนือแถบสไตล์ */
  const wc=document.getElementById('p-weakcard');
  if(cur==='eagle'){if(wc)wc.style.display='none';_parentEagle(d);}
  else if(cur==='elephant'){if(wc)wc.style.display='none';_parentElephant(d);}
  else if(cur==='owl'){if(wc)wc.style.display='none';_parentOwl(d);}
  else if(cur==='bee'){if(wc)wc.style.display='none';_parentBee(d);}
  else _parentDolphin(d);
  /* ★ 19 ก.ย. 69 — การ์ด "ผลสอบ 2 ครั้งล่าสุด" ใช้ร่วมกันทั้ง 5 สไตล์
     (แทรกท้ายสุด ไม่แตะเนื้อรายงานเดิมของแต่ละสไตล์) · ของเดิมแยกตามประเภทข้อสอบ */
  try{ renderParentLastTwo(d); }catch(e){}
  try{ paintUnfilledParent(d); }catch(e){}   /* ★ 25 ก.ย. 69 */
}

/* ── การ์ด "ผลสอบ 2 ครั้งล่าสุด" สำหรับผู้ปกครอง (19 ก.ย. 69) ──
   ของเดิมแยกเป็น "แยกบท / สนามสอบ" ซึ่งอ่านยากสำหรับผู้ปกครอง —
   เปลี่ยนเป็นเรียงตามเวลา 2 ครั้งล่าสุดไม่ว่าจะเป็นแบบไหน
   คะแนนเต็มต่างกันจึงเทียบกันด้วย % เสมอ และบอกกำกับว่าคนละแบบ */
function renderParentLastTwo(d){
  const host=document.getElementById('p-summary'); if(!host||!host.parentNode)return;
  let el=document.getElementById('p-examSplit');
  if(!el){ el=document.createElement('div'); el.id='p-examSplit'; host.parentNode.appendChild(el); }
  const all=(d.allHistory||[]).slice();
  if(!all.length){ el.innerHTML=''; return; }

  const two=all.slice(-2);                 /* [ครั้งก่อน, ครั้งล่าสุด] หรือ [ครั้งเดียว] */
  const last=two[two.length-1], prev=two.length>1?two[0]:null;
  const pctOf=h=>h.full?Math.round(h.score/h.full*100):0;

  const box=(h,isLast)=>{
    const pct=pctOf(h);
    const kind=h.isMock?'🎯 สนามสอบรวมทุกบท':'📘 ข้อสอบแยกบท';
    const avgLine=(h.gAvg!=null && h.gN>1)
      ? '<div style="font-size:12px;color:var(--text2,#6B6660);margin-top:4px;line-height:1.7">'
        +'ค่าเฉลี่ยของรุ่นในบท/ชุดนี้ <b>'+h.gAvg+'</b>'
        +(h.gRank?' · อยู่อันดับ <b>'+h.gRank+'</b> จาก '+h.gN+' คน':'')
        +(h.score>h.gAvg?' <span style="color:#3B7D2A">· สูงกว่าค่าเฉลี่ย</span>':'')
        +'</div>'
      : '<div style="font-size:11.5px;color:var(--text3,#948F86);margin-top:4px;line-height:1.7">'
        +'ยังไม่มีเพื่อนกรอกผลของบท/ชุดนี้ จึงยังไม่มีค่าเฉลี่ยให้เทียบ</div>';
    const miss=(h.care||0)+(h.concept||0)+(h.cant||0)+(h.timeout||0);
    const missLine=miss
      ? '<div style="font-size:11.5px;color:var(--text3,#948F86);margin-top:6px;line-height:1.6">'
        +'จุดที่ยังพลาด '+miss+' ข้อ'
        +((h.care||0)?' · สะเพร่า '+h.care:'')
        +((h.concept||0)?' · คอนเซปต์ '+h.concept:'')
        +((h.timeout||0)?' · ไม่ทัน '+h.timeout:'')
        +'</div>'
      : '';
    return '<div style="flex:1 1 220px;border:'+(isLast?'2px solid #185FA5':'1px solid var(--border,#E7E4DC)')
      +';border-radius:12px;padding:12px 14px;background:#fff">'
      +'<div style="font-size:12px;color:'+(isLast?'#185FA5':'var(--text3,#948F86)')+';font-weight:'+(isLast?'600':'400')+'">'
      +  (isLast?'ครั้งล่าสุด':'ครั้งก่อนหน้า')+(h.date?' · '+_dFmt(h.date):'')+'</div>'
      +'<div style="font-size:24px;font-weight:700;color:#185FA5;line-height:1.3">'
      +  h.score+'<span style="font-size:14px;color:var(--text3,#948F86);font-weight:500"> / '+(h.full||30)+'</span>'
      +  '<span style="font-size:14px;color:var(--text3,#948F86);font-weight:500;margin-left:8px">'+pct+'%</span></div>'
      +'<div style="font-size:11.5px;color:var(--text3,#948F86)">'+kind+' · '+(h.topic||'')+'</div>'
      + avgLine + missLine
      +'</div>';
  };

  let cmp='';
  if(prev){
    const dPct=pctOf(last)-pctOf(prev);
    const same=(last.full||30)===(prev.full||30);
    const word=dPct>0?'ดีขึ้น '+dPct+'%':(dPct<0?'ลดลง '+Math.abs(dPct)+'%':'เท่าเดิม');
    const col=dPct>0?'#3B7D2A':(dPct<0?'#C77E1A':'#948F86');
    cmp='<div style="font-size:12.5px;margin-top:10px;line-height:1.8">'
      +'เทียบสองครั้งล่าสุด: <b style="color:'+col+'">'+word+'</b> '
      +'<span style="color:var(--text3,#948F86)">('+pctOf(prev)+'% → '+pctOf(last)+'%)</span>'
      + (same ? '' : '<br><span style="font-size:11.5px;color:var(--text3,#948F86)">'
          + 'สองครั้งนี้เป็นข้อสอบคนละแบบ (เต็ม '+(prev.full||30)+' คะแนน กับเต็ม '+(last.full||30)+' คะแนน) '
          + 'จึงเทียบด้วย<b>เปอร์เซ็นต์</b> ไม่ใช่คะแนนดิบ</span>')
      +'</div>';
  }else{
    cmp='<div style="font-size:12px;color:var(--text3,#948F86);margin-top:10px;line-height:1.8">'
      +'เพิ่งสอบไป 1 ครั้ง — จะเริ่มเห็นแนวโน้มตั้งแต่ครั้งที่ 2 เป็นต้นไปครับ</div>';
  }

  el.innerHTML='<div style="margin-top:18px">'
    +'<div style="font-size:13px;font-weight:600;margin-bottom:8px">ผลสอบ 2 ครั้งล่าสุด</div>'
    +'<div style="display:flex;gap:10px;flex-wrap:wrap">'
    + (prev?box(prev,false):'') + box(last,true)
    +'</div>'
    + cmp
    +'<div style="font-size:11.5px;color:var(--text3,#948F86);margin-top:8px;line-height:1.8">'
    +'ข้อสอบแต่ละชุดยากไม่เท่ากัน จึงควรดู<b>ค่าเฉลี่ยของรุ่น</b>ประกอบเสมอ — '
    +'คะแนนลดลงแต่ยังสูงกว่าค่าเฉลี่ย แปลว่าชุดนั้นยากขึ้นสำหรับทุกคน ไม่ใช่ถดถอย</div>'
    +'</div>';
}

// ── 🐬 โลมา: รายงานฉบับเต็ม (โค้ดเดิมทั้งหมด) ──
function _parentDolphin(d){
  const name=d.shortName;
  const pct=Math.round(d.score/(d.full||30)*100);
  const avg=d.groupMembers.length?Math.round(d.groupMembers.reduce((s,m)=>s+m.score,0)/d.groupMembers.length):0;
  const avgPct=Math.round(avg/(d.full||30)*100);

  // ระดับ
  let level,levelClass,levelDesc;
  if(pct>=90){level='ดีเยี่ยม';levelClass='level-A';levelDesc='ทำได้เกินเป้าหมาย';}
  else if(pct>=70){level='ดี';levelClass='level-B';levelDesc='อยู่ในเกณฑ์ที่ดี';}
  else if(pct>=50){level='พอใช้';levelClass='level-C';levelDesc='ต้องพัฒนาเพิ่ม';}
  else{level='ต้องพัฒนา';levelClass='level-D';levelDesc='ต้องให้ความสนใจเป็นพิเศษ';}

  const aboveAvg=d.score>=avg;

  // (header/avatar ถูกย้ายไปทำใน renderParentDash แล้ว)
  // summary
  document.getElementById('p-summary').innerHTML=`
    <div style="font-size:13px;color:var(--blue);font-weight:500;margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em">ภาพรวมการสอบครั้งนี้</div>
    <div class="summary-headline">
      <span class="summary-highlight">${name}</span> ทำคะแนนได้
      <span class="summary-highlight">${d.score}/${d.full||30} คะแนน (${pct}%)</span>
      อยู่ในระดับ <span class="level-badge ${levelClass}">${level}</span>
    </div>
    <div class="summary-headline" style="margin-bottom:0">
      <b>เทียบในกลุ่ม:</b> อันดับที่ <span class="summary-highlight">${d.rank}</span> จาก <span class="summary-highlight">${d.groupMembers.length}</span> คน
      ${aboveAvg
        ? `— <span class="summary-highlight green">สูงกว่าค่าเฉลี่ยกลุ่ม</span> (${avgPct}%)`
        : `— ค่าเฉลี่ยกลุ่มอยู่ที่ ${avgPct}%`}
    </div>
    ${d.allMembers.length>d.groupMembers.length?`
    <div class="summary-headline" style="margin-bottom:0;margin-top:6px">
      <b>เทียบทุกคนที่สอบบทนี้:</b> อันดับที่ <span class="summary-highlight">${d.allRank}</span> จาก <span class="summary-highlight">${d.allMembers.length}</span> คน
      ${d.score>=d.allAvg
        ? `— <span class="summary-highlight green">สูงกว่าค่าเฉลี่ยรวม</span> (${Math.round(d.allAvg/(d.full||30)*100)}%)`
        : `— ค่าเฉลี่ยรวมอยู่ที่ ${Math.round(d.allAvg/(d.full||30)*100)}%`}
    </div>`:''}`;

  // วิเคราะห์ปัญหา
  const problems=[];
  // ── สรุปรวมต้องทบทวน ──
  const totalReview=(d.care||0)+(d.concept||0)+(d.cant||0)+(d.timeout||0);
  if(totalReview>0)problems.push({icon:'🔁',color:'var(--amber-bg,#fff7ed)',border:'var(--amber,#f59e0b)',count:totalReview,countColor:'var(--amber,#f59e0b)',title:'ต้องทบทวนรวม '+totalReview+' ข้อ',desc:'แบ่งเป็น: ⚠️สะเพร่า '+(d.care||0)+' | 🧠คอนเซปต์ '+(d.concept||0)+' | ❌ทำไม่ได้ '+(d.cant||0)+' | ⏰ไม่ทัน '+(d.timeout||0)+' ข้อ'});
  const F=_parentFacts(d);
  if((d.concept||0)>0)problems.push({icon:'🧠',color:'#f3e8ff',border:'#a855f7',count:(d.concept||0),countColor:'#a855f7',title:'คอนเซปต์ยังไม่แน่น '+(d.concept||0)+' ข้อ',desc:_pv([
    `${F.qList(F.conceptQ)||'บางข้อ'} ผิดเพราะหลักการยังไม่แน่น${F.conceptSub.length?' — อยู่ในหัวข้อ '+_thaiList(F.conceptSub):''} ควรทบทวนทฤษฎีให้เข้าใจก่อนทำโจทย์เพิ่ม`,
    `กลุ่มนี้คือข้อที่น้อง "เข้าใจคลาดเคลื่อน" ไม่ใช่ "ไม่ตั้งใจ"${F.conceptSub.length?' โดยเฉพาะเรื่อง'+_thaiList(F.conceptSub):''} — ดูคลิปหรือให้ครูอธิบายซ้ำจะได้ผลกว่าการทำโจทย์เยอะๆ`,
    `${F.qList(F.conceptQ)||'บางข้อ'} เป็นจุดที่ต้องกลับไปตั้งต้นใหม่ที่หลักการ การรีบทำโจทย์เพิ่มตอนนี้จะยิ่งจำวิธีผิดไปใช้ครับ`,
    `ผิดจากความเข้าใจ ไม่ใช่ความประมาท${F.conceptSub.length?' — หัวข้อ '+_thaiList(F.conceptSub)+' ยังต้องปูพื้นเพิ่ม':''} เป็นจุดที่ครูจะอธิบายซ้ำให้ในคาบครับ`
  ],d,0)});
  if((d.cant||0)>0)problems.push({icon:'❌',color:'#fee2e2',border:'#ef4444',count:(d.cant||0),countColor:'#ef4444',title:'ทำไม่ได้ '+(d.cant||0)+' ข้อ',desc:_pv([
    `${F.qList(F.cantQ)||'บางข้อ'} ยังทำไม่ได้ — ควรดูคลิปเฉลยแล้วลองทำใหม่ด้วยตัวเองอีกครั้ง`,
    `เป็นโจทย์ที่เกินระดับที่น้องฝึกมาถึงตอนนี้${F.cantSub.length?' (หัวข้อ '+_thaiList(F.cantSub)+')':''} ไม่ใช่เรื่องน่ากังวล แต่เป็นลำดับถัดไปที่ต้องเก็บ`,
    `ข้อกลุ่มนี้ครูแนะนำให้ทำทีหลังสุด หลังเก็บข้อที่พลาดจากความรีบครบแล้ว จะได้คะแนนคืนคุ้มแรงกว่า`,
    `${F.qList(F.cantQ)||'บางข้อ'} คือเป้าหมายระยะถัดไป — ถ้าเก็บได้ครั้งหน้าคะแนนจะขยับชัดเจนครับ`
  ],d,1)});
  if((d.timeout||0)>0)problems.push({icon:'⏰',color:'#f1f5f9',border:'#94a3b8',count:(d.timeout||0),countColor:'#94a3b8',title:'ไม่ทันเวลา '+(d.timeout||0)+' ข้อ',desc:_pv([
    `${F.qList(F.timeQ)||'บางข้อ'} หมดเวลาก่อน — ฝึกข้ามข้อที่ติดแล้ววนกลับมาทีหลัง จะเก็บคะแนนได้มากขึ้น`,
    `การบริหารเวลาเป็นทักษะแยกจากความเก่ง ฝึกจับเวลาที่บ้านสัก 2-3 ครั้งก็เห็นผลแล้วครับ`,
    `น้องใช้เวลากับข้อยากนานเกินไปจนไม่เหลือเวลาข้อท้าย ลองฝึกกวาดข้อง่ายให้ครบก่อนหนึ่งรอบ`,
    `${F.qList(F.timeQ)||'ข้อท้ายๆ'} ยังไม่ได้ลงมือเพราะเวลาหมด — ไม่ได้แปลว่าทำไม่ได้ครับ`
  ],d,2)});
  if(d.care>0)problems.push({icon:'🟡',color:'var(--amber-l)',border:'var(--amber)',title:'รู้คำตอบแล้ว แต่พลาดจากความรีบ',desc:_pv([
    `${F.qList(F.careQ)||''} พลาดทั้งที่ทำเป็น — ลองชวนน้องอธิบายวิธีตรวจคำตอบให้ฟัง ได้ผลกว่าการเตือนให้ระวังครับ`,
    `นี่คือ ${d.care} คะแนนที่อยู่ใกล้มือที่สุด${F.careSub.length?' (หัวข้อ '+_thaiList(F.careSub)+')':''} ความรอบคอบฝึกได้เหมือนกล้ามเนื้อ`,
    `น้องรู้วิธีทำครบแล้ว เหลือแค่จังหวะตรวจทาน — ลองให้จดว่าแต่ละข้อพลาดตรงไหน (อ่านโจทย์ตก/คำนวณ/ลอกเลข) จะเห็นรูปแบบตัวเอง`,
    `ถ้าเก็บกลุ่มนี้ได้ครบ คะแนนจะขึ้นเป็น ${_careGain(d)}/${d.full||30} ทันทีโดยไม่ต้องเรียนอะไรใหม่เลยครับ`
  ],d,3),count:d.care,countColor:'var(--amber)'});
  if(d.blank>0)problems.push({icon:'⬜',color:'var(--surf)',border:'var(--border-md)',title:'ข้อที่ยังไม่ได้ลงมือทำ',desc:_pv([
    `มี ${d.blank} ข้อที่เว้นไว้ — ลองถามด้วยความเข้าใจว่าเพราะเวลาไม่พอ ไม่เข้าใจโจทย์ หรือไม่มั่นใจ`,
    `${d.blank} ข้อที่ไม่ได้แตะ อาจบอกเรื่องการจัดลำดับข้อมากกว่าเรื่องความรู้ครับ`,
    `การเว้นข้อไว้บางครั้งคือการตัดสินใจที่ดี (ไม่เสียเวลากับข้อยาก) ลองถามน้องว่าตั้งใจข้ามหรือทำไม่ทัน`
  ],d,4),count:d.blank,countColor:'var(--text3)'});

  const pp=document.getElementById('p-problems');pp.innerHTML='';
  if(!problems.length){pp.innerHTML='<div style="font-size:14px;color:var(--green);padding:8px 0">ไม่พบปัญหา — ทำได้ดีมากทุกข้อ 🎉</div>';}
  else problems.forEach(p=>{pp.innerHTML+=`<div class="problem-card" style="background:${p.color};border-left:4px solid ${p.border};margin-bottom:10px"><div class="problem-icon">${p.icon}</div><div style="flex:1"><div class="problem-title">${p.title}</div><div class="problem-desc">${p.desc}</div></div><div class="problem-count" style="color:${p.countColor}">${p.count}</div></div>`;});

  // หัวข้อที่อ่อน
  const weak=d.subtopics.filter(st=>Math.round(st.ok/st.total*100)<70).slice(0,5);
  const wt=document.getElementById('p-weaktopics');wt.innerHTML='';
  if(!weak.length){document.getElementById('p-weakcard').style.display='none';}
  else{
    document.getElementById('p-weakcard').style.display='block';
    weak.forEach(st=>{
      const pct2=Math.round(st.ok/st.total*100);
      const color=pct2>=50?'var(--amber)':'var(--red)';
      wt.innerHTML+=`<div class="weak-topic">
        <div style="flex:1"><div style="font-size:14px;color:var(--text1)">${st.name}</div><div style="font-size:11px;color:var(--text3)">ทำถูก ${st.ok}/${st.total} ข้อ</div></div>
        <div style="font-size:13px;font-weight:500;color:${color}">${pct2}%</div>
      </div>`;
    });
  }

  // คำแนะนำ
  const actions=[];
  if(F.chronic.length)actions.push({title:'จุดที่พลาดซ้ำหลายครั้ง',color:'#8A5A10',text:_pv([
    `หัวข้อ "${F.chronic[0].sub}" น้องพลาดใน ${F.chronic[0].times} การสอบแล้ว — จุดแบบนี้ต้องกลับไปเรียนแนวคิดใหม่กับครู การฝึกโจทย์เพิ่มอย่างเดียวมักไม่พอครับ`,
    `"${F.chronic[0].sub}" เป็นจุดเรื้อรัง (พลาด ${F.chronic[0].times} ครั้ง) ครูจะจับน้องคุยเฉพาะหัวข้อนี้ — ที่บ้านช่วยได้ด้วยการถามว่า "หัวข้อนี้ติดตรงไหน" แทนการให้ทำโจทย์เพิ่ม`,
    `ต่างจากข้อที่พลาดครั้งแรก (ปกติมาก) — "${F.chronic[0].sub}" พลาดมา ${F.chronic[0].times} ครั้งติด แปลว่ามีความเข้าใจบางอย่างคลาดเคลื่อนตั้งแต่ต้น ต้องรื้อใหม่ครับ`
  ],d,5)});
  if(d.wrong>=5)actions.push({title:'วางแผนทบทวนหัวข้อที่อ่อน',color:'var(--blue)',text:_pv([
    `โฟกัสที่ "${weak.length?weak[0].name:'หัวข้อที่ทำผิด'}" ก่อนหัวข้ออื่น — สนับสนุนให้น้องวางแผนเอง (ดูคลิป/ทำโจทย์เก่าซ้ำ) การเข้าใจให้แน่นสำคัญกว่าเร่งทำเยอะ`,
    `${weak.length>1?'สองหัวข้อที่ควรเก็บก่อนคือ '+_thaiList(weak.slice(0,2).map(w=>w.name)):'หัวข้อ "'+(weak.length?weak[0].name:'ที่ทำผิด')+'"'} — ทำทีละหัวข้อจนแน่น ดีกว่ากวาดทุกหัวข้อพร้อมกันครับ`,
    `ลองให้น้องเป็นคนเลือกเองว่าจะเริ่มจากหัวข้อไหน แล้วคุณพ่อคุณแม่เป็นคนถามความคืบหน้า — ความรู้สึกเป็นเจ้าของแผนช่วยเรื่องแรงจูงใจมากครับ`
  ],d,6)});
  if(d.care>=3)actions.push({title:'ฝึกความรอบคอบแบบเจาะจุด',color:'var(--amber)',text:_pv([
    `${F.qList(F.careQ)} พลาดจากความรีบ — ให้น้องจดว่าแต่ละข้อพลาดเพราะอะไร (อ่านโจทย์ตก/คำนวณ/ลอกเลข) พอเห็นรูปแบบซ้ำจะแก้ได้ตรงจุด`,
    `ตั้งเป้าแคบๆ ว่าครั้งหน้าลดข้อสะเพร่าจาก ${d.care} เหลือ ${Math.max(1,Math.floor(d.care/2))} ข้อ — เป้าที่วัดได้ทำให้เด็กรู้ว่าตัวเองสำเร็จหรือยัง`,
    `ลองให้น้องทำข้อเดิมซ้ำแบบไม่จับเวลา ถ้าทำถูกหมด = ปัญหาคือจังหวะ ไม่ใช่ความรู้ ซึ่งแก้ง่ายกว่ามากครับ`,
    `เทคนิคที่ได้ผลกับเด็กหลายคน: อ่านโจทย์จบแล้วขีดเส้นใต้ "สิ่งที่โจทย์ถาม" ก่อนลงมือคำนวณ`
  ],d,7)});
  if(d.blank>=3)actions.push({title:'พูดคุยด้วยความเข้าใจ',color:'var(--text2)',text:_pv([
    `มี ${d.blank} ข้อที่ไม่ได้ทำ — คุยแบบเปิดใจว่าเพราะเวลาไม่พอ ไม่เข้าใจโจทย์ หรือกังวล การฟังโดยไม่ตำหนิทำให้น้องกล้าบอกปัญหาจริง`,
    `ลองถามว่า "ตอนเจอข้อที่ข้าม รู้สึกยังไง" — คำตอบจะบอกว่าเป็นปัญหาเวลา หรือความมั่นใจ ซึ่งแก้คนละวิธีครับ`,
    `${d.blank} ข้อที่เว้นไว้อาจเป็นการตัดสินใจที่ถูกแล้วก็ได้ (ไม่จมกับข้อยาก) ลองฟังเหตุผลของน้องก่อนสรุปครับ`
  ],d,8)});
  if(aboveAvg&&pct>=70)actions.push({title:'ชื่นชมที่ความพยายาม',color:'var(--green)',text:_pv([
    `${name} ทำได้เหนือค่าเฉลี่ยกลุ่ม — ชมที่ "ความตั้งใจและวิธีคิด" มากกว่า "เก่ง" ช่วยให้น้องเชื่อว่าความสำเร็จมาจากสิ่งที่ควบคุมได้`,
    `${F.strongName?'หัวข้อ "'+F.strongName+'" น้องทำได้แม่นมาก ':''}ลองชมแบบเจาะจง เช่น "แม่เห็นว่าลูกทำเรื่องนี้ได้ดีขึ้นจริงๆ" — คำชมที่เจาะจงมีน้ำหนักกว่าคำว่าเก่งครับ`,
    `${d.streak>=2?'ดีขึ้น '+d.streak+' ครั้งติด — ':''}ชมที่ความสม่ำเสมอ เพราะนั่นคือสิ่งที่พาไปถึงเป้าหมายจริงๆ ไม่ใช่คะแนนครั้งใดครั้งหนึ่ง`
  ],d,9)});
  if(!actions.length)actions.push({title:'รักษาจังหวะที่ดีไว้',color:'var(--green)',text:_pv([
    `ผลอยู่ในเกณฑ์ดีมาก ให้กำลังใจและติดตามอย่างสม่ำเสมอ ความต่อเนื่องคือกุญแจของการเตรียมสอบครับ`,
    `ไม่มีจุดที่ต้องแก้เร่งด่วน — ช่วงนี้เหมาะกับการรักษาวินัยเดิมและพักผ่อนให้พอ`,
    `${F.strongName?'"'+F.strongName+'" แม่นแล้ว ':''}ขั้นถัดไปคือลองข้อที่ยากขึ้นเพื่อไม่ให้หยุดพัฒนา ครูเตรียมชุดฝึกไว้ให้แล้วครับ`
  ],d,10)});

  const pa=document.getElementById('p-actions');pa.innerHTML='';
  actions.forEach(a=>{pa.innerHTML+=`<div class="action-card" style="border-left-color:${a.color}"><div class="action-title" style="color:${a.color}">${a.title}</div><div class="action-text">${a.text}</div></div>`;});
  // ── คำถามชวนคุย — ปรับตามผลสอบจริง ──
  const talkEl=document.getElementById('p-talkList');
  if(talkEl){
    talkEl.innerHTML='';
    const talks=[];
    talks.push(_pv([
      '"บทนี้ข้อไหนที่ภูมิใจว่าทำได้ที่สุด?" — เริ่มจากจุดแข็งก่อนเสมอ',
      (F.strongName?'"เห็นครูบอกว่าเรื่อง '+F.strongName+' ลูกทำได้ดี ทำยังไงถึงเข้าใจเรื่องนี้?" — ให้เล่าความสำเร็จก่อน':'"ข้อไหนที่รู้สึกว่าทำได้ดีที่สุด?" — เปิดด้วยเรื่องบวกเสมอ'),
      '"ครั้งนี้มีอะไรที่ทำได้ดีกว่าครั้งที่แล้วบ้าง?" — ให้ลูกเป็นคนสังเกตพัฒนาการตัวเอง'
    ],d,11));
    if(d.care>0)talks.push(_pv([
      '"ข้อที่พลาดเพราะรีบ ถ้าย้อนกลับไปได้จะทำต่างจากเดิมยังไง?" — ให้ลูกคิดวิธีแก้เอง ดีกว่าบอกให้ระวัง',
      '"ตอนทำข้อนั้น รีบเพราะอะไร — กลัวไม่ทัน หรือคิดว่าง่าย?" — สาเหตุต่างกัน วิธีแก้ก็ต่างกัน',
      '"ถ้าจะกันพลาดแบบเดิมครั้งหน้า ลูกจะทำยังไง?" — ให้ลูกออกแบบวิธีของตัวเอง จะจำได้นานกว่า'
    ],d,12));
    if(d.blank>0)talks.push(_pv([
      '"ข้อที่เว้นไว้ เจอตอนไหนของเวลาสอบ?" — ช่วยรู้ว่าปัญหาคือการจัดเวลาหรือความมั่นใจ',
      '"ข้อที่ข้ามไป ถ้ามีเวลาอีก 5 นาทีคิดว่าทำได้ไหม?" — แยกว่า "ไม่ทัน" หรือ "ทำไม่ได้"'
    ],d,13));
    if(d.wrong>0)talks.push(_pv([
      '"หัวข้อไหนที่อยากเข้าใจมากขึ้น?" — เปิดทางให้ลูกขอความช่วยเหลือโดยไม่เสียหน้า',
      (F.weakName?'"เรื่อง '+F.weakName+' ตอนนี้ติดตรงไหน?" — คำถามเจาะจงได้คำตอบที่ใช้ได้จริงกว่า':'"มีหัวข้อไหนที่อยากให้ครูอธิบายซ้ำไหม?"'),
      '"ถ้าให้เลือกเก็บหัวข้อเดียวก่อนสอบครั้งหน้า จะเลือกอะไร?" — ฝึกให้ลูกจัดลำดับความสำคัญเอง'
    ],d,14));
    talks.push(_pv([
      '"มีอะไรให้พ่อแม่ช่วยไหม?" — บางครั้งแค่ถามก็เพียงพอแล้ว',
      '"ช่วงนี้เหนื่อยไหม อยากให้บ้านช่วยอะไรเป็นพิเศษ?" — ดูแลสภาพใจควบคู่กับคะแนน',
      '"อยากให้แม่/พ่อถามเรื่องเรียนบ่อยแค่ไหนถึงจะพอดี?" — ให้ลูกกำหนดระยะห่างเอง ลดแรงต้าน'
    ],d,15));
    talks.forEach(t=>{
      talkEl.innerHTML+=`<div style="display:flex;gap:10px;padding:8px 0;border-bottom:0.5px solid var(--border)">
        <div style="color:var(--blue);flex-shrink:0">•</div>
        <div style="font-size:13px;color:var(--text1);line-height:1.6">${t}</div>
      </div>`;
    });
  }

  // q-grid
  paintQGrid(d, 'p-qgrid1', 'p-qgrid2');
}

// ── 🦅 นกอินทรี: เทียบกับตัวเองเท่านั้น + ตารางแผนที่ครูดำเนินการแล้ว + ประโยคแนะนำ ──
function _parentEagle(d){
  const name=d.shortName,hist=d.history||[];
  const deltaTxt=d.delta==null?'':(d.delta>0?'+'+d.delta:''+d.delta);
  document.getElementById('p-summary').innerHTML=`
    <div style="font-size:13px;color:var(--blue);font-weight:500;margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em">🦅 รายงานความก้าวหน้า — เทียบกับตัวเองเท่านั้น</div>
    <div class="summary-headline"><span class="summary-highlight">${name}</span> ได้ <span class="summary-highlight">${d.score}/${d.full||30}</span>${d.delta!=null?` (${deltaTxt} จากครั้งก่อน)`:''}${d.isBest?' · 🏆 สูงสุดตั้งแต่เริ่มเรียน':''}${d.streak>=2?` · 🔥 ดีขึ้น ${d.streak} ครั้งติด`:''}</div>
    ${hist.length>=2?`<div style="max-width:280px;margin-top:6px">${_sparkSvg(hist.map(h=>h.score),280,60,d.full||30)}<div style="font-size:10px;color:var(--text3)">เส้นประแดง = เป้า ${Math.round((d.full||30)*25/30)}/${d.full||30} · ${hist.map(h=>h.score).join(' → ')}</div></div>`:''}`;
  const F=_parentFacts(d);
  const rows=[];
  if(d.care>0)rows.push([`⚠️ สะเพร่า${F.careQ.length?'<div style="font-size:10.5px;color:var(--text3)">'+F.qList(F.careQ)+'</div>':''}`,d.care,_pv([
    'ฝึก checklist ตรวจทานก่อนตอบ ใช้ในคาบเรียนถัดไป',
    'ให้ทำข้อเดิมซ้ำแบบไม่จับเวลา เพื่อยืนยันว่าเป็นเรื่องจังหวะไม่ใช่ความรู้',
    'ฝึกขีดเส้นใต้สิ่งที่โจทย์ถามก่อนลงมือ — ลดพลาดจากการอ่านตก',
    'ให้จดสาเหตุที่พลาดรายข้อ แล้วครูทวนรูปแบบที่ซ้ำกับน้อง'
  ],d,0)]);
  if(d.concept>0)rows.push([`🧠 คอนเซปต์${F.conceptSub.length?'<div style="font-size:10.5px;color:var(--text3)">'+_thaiList(F.conceptSub)+'</div>':''}`,d.concept,_pv([
    'มอบคลิปเฉลย + แบบฝึกหัวข้อที่พลาด พร้อมกำหนดส่ง',
    'อธิบายหลักการซ้ำในคาบ แล้วให้ลองอธิบายกลับให้ครูฟัง',
    'ปูพื้นหัวข้อนี้ใหม่ก่อน แล้วค่อยกลับมาทำโจทย์ระดับเดิม',
    'จับคู่ทบทวนกับข้อคล้ายกันจากคลัง เพื่อยืนยันว่าเข้าใจจริง'
  ],d,1)]);
  if(d.cant>0)rows.push([`❌ ทำไม่ได้${F.cantQ.length?'<div style="font-size:10.5px;color:var(--text3)">'+F.qList(F.cantQ)+'</div>':''}`,d.cant,_pv([
    'ครูอธิบายเพิ่มรายบุคคล แล้วให้ลองทำซ้ำ',
    'จัดไว้เป็นเป้าหมายรอบถัดไป หลังเก็บข้อที่ได้คืนง่ายครบแล้ว',
    'ให้เริ่มจากโจทย์ระดับง่ายกว่าในหัวข้อเดียวกันก่อนไต่ขึ้น',
    'ครูจะทำเป็นตัวอย่างให้ดูทีละขั้น แล้วให้ทำเวอร์ชันที่เปลี่ยนตัวเลข'
  ],d,2)]);
  if(d.timeout>0)rows.push([`⏰ ไม่ทัน${F.timeQ.length?'<div style="font-size:10.5px;color:var(--text3)">'+F.qList(F.timeQ)+'</div>':''}`,d.timeout,_pv([
    'ฝึกจับเวลารายข้อ (2.5 นาที/ข้อ) เก็บข้อง่ายก่อน',
    'ฝึกกลยุทธ์ "กวาดข้อง่ายรอบแรก แล้ววนกลับข้อยาก"',
    'ซ้อมทำครึ่งชุดจับเวลา เพื่อสร้างความเร็วแบบไม่กดดัน',
    'ตั้งกติกาว่าข้อไหนคิดเกิน 3 นาทีให้ข้ามก่อน'
  ],d,3)]);
  if(F.chronic.length)rows.push([`🔁 พลาดซ้ำ<div style="font-size:10.5px;color:var(--text3)">${F.chronic[0].sub}</div>`,F.chronic[0].times+' ครั้ง',_pv([
    'ครูจะรื้อแนวคิดหัวข้อนี้ใหม่กับน้องเป็นรายบุคคล',
    'จัดเป็นวาระพิเศษ — สอนใหม่จากต้น ไม่ใช่แค่เพิ่มโจทย์',
    'นัดทบทวนเฉพาะหัวข้อนี้ก่อนสอบครั้งหน้า'
  ],d,4)]);
  const td='padding:7px 8px;border-bottom:1px solid var(--border,#E7E4DC)';
  const th='text-align:left;padding:6px 8px;background:var(--surf,#FAF9F5);font-size:11.5px;color:var(--text3)';
  document.getElementById('p-problems').innerHTML=rows.length?
    `<table style="width:100%;border-collapse:collapse;font-size:13px"><tr><th style="${th}">ประเด็น</th><th style="${th}">จำนวน</th><th style="${th}">ติวเตอร์ดำเนินการแล้ว</th></tr>`
    +rows.map(r=>`<tr><td style="${td}">${r[0]}</td><td style="${td}">${r[1]} ข้อ</td><td style="${td}">${r[2]}</td></tr>`).join('')+'</table>'
    :'<div style="font-size:14px;color:var(--green);padding:8px 0">ครั้งนี้ไม่มีจุดต้องแก้ — ทำได้ครบทุกข้อ 🎉</div>';
  const sayPool=[
    `"ครูบอกว่า${d.streak>=2?'ลูกพัฒนาขึ้น '+d.streak+' ครั้งติด':'ทุกจุดที่ลูกพลาดมีแผนแก้ชัดเจนแล้ว'} เก่งมากที่ไม่หยุดพยายาม"`,
    F.strongName?`"ครูบอกว่าเรื่อง ${F.strongName} ลูกทำได้แม่นมาก — พ่อ/แม่ดีใจที่เห็นลูกเก็บทีละเรื่องแบบนี้"`:`"เห็นความตั้งใจของลูกทุกสัปดาห์ ไม่ต้องรีบ ค่อยๆ เก็บไปทีละเรื่อง"`,
    d.care>0?`"ครูบอกว่าลูกทำเป็นเกือบหมด เหลือแค่เรื่องความรอบคอบ — แปลว่าพื้นฐานลูกแน่นแล้วนะ"`:`"${d.score} คะแนนนี้มาจากความสม่ำเสมอของลูกเอง พ่อ/แม่ภูมิใจ"`,
    `"อยากรู้ว่าช่วงนี้ลูกเหนื่อยไหม — เรื่องคะแนนค่อยว่ากัน ขอให้ลูกดูแลตัวเองก่อน"`
  ];
  const dontPool=[
    `"ทำไมยังไม่เต็ม 30" / "เพื่อนได้เท่าไหร่" — การเทียบกับผู้อื่นช่วงเตรียมสอบเพิ่มความกังวล และทำให้เด็กเริ่มปิดบังคะแนน`,
    `"แค่นี้เองเหรอ" / "ตั้งใจกว่านี้หน่อย" — เด็กที่ตั้งใจอยู่แล้วจะตีความว่าความพยายามที่ทำไปไม่ถูกมองเห็น`,
    `"ถ้าไม่ขยันตอนนี้จะสอบไม่ติดนะ" — การขู่ด้วยอนาคตเพิ่ม anxiety แต่ไม่เพิ่มพฤติกรรมการอ่านหนังสือ`,
    `เปรียบเทียบกับพี่น้องหรือลูกคนอื่น — ทำลายความสัมพันธ์ในบ้านโดยไม่ช่วยเรื่องคะแนนเลยครับ`
  ];
  document.getElementById('p-actions').innerHTML=`
    <div style="border-left:4px solid #3B7D2A;background:#EAF5E6;padding:11px 13px;border-radius:0 10px 10px 0;margin-bottom:8px;font-size:13px"><b style="display:block;font-size:12px;margin-bottom:3px">✅ ประโยคที่ช่วยลูกได้มากสัปดาห์นี้</b>${_pv(sayPool,d,5)}</div>
    <div style="border-left:4px solid #A32D2D;background:#FBEAEA;padding:11px 13px;border-radius:0 10px 10px 0;font-size:13px"><b style="display:block;font-size:12px;margin-bottom:3px">⛔ ประโยคที่งานวิจัยพบว่าทำให้คะแนนครั้งหน้าแย่ลง</b>${_pv(dontPool,d,6)}</div>`;
  const talkEl=document.getElementById('p-talkList');
  if(talkEl)talkEl.innerHTML='<div style="font-size:13px;color:var(--text1);line-height:1.9">• '+_pv([
    '"เป้าครั้งหน้าลูกอยากได้เท่าไหร่ ให้พ่อแม่ช่วยอะไรได้บ้าง?" — ให้ลูกเป็นเจ้าของเป้าหมายเอง',
    '"ถ้าจะขยับอีก 2-3 คะแนน ลูกคิดว่าต้องเก็บเรื่องไหนก่อน?" — ฝึกวางแผนด้วยตัวเอง',
    (F.weakName?'"เรื่อง '+F.weakName+' ลูกอยากให้ครูช่วยแบบไหน?" — ให้ลูกเป็นคนขอความช่วยเหลือเอง':'"มีหัวข้อไหนที่อยากให้ครูช่วยเป็นพิเศษไหม?"')
  ],d,7)+'<br>• '+_pv([
    '"ข้อไหนที่ภูมิใจว่าแก้ได้แล้ว?" — เริ่มจากความก้าวหน้าก่อนเสมอ',
    '"ครั้งนี้ลูกทำอะไรได้ดีกว่าครั้งก่อน?" — ให้ลูกฝึกมองพัฒนาการของตัวเอง',
    '"อยากให้พ่อแม่เชียร์แบบไหนถึงจะรู้สึกดี?" — เด็กแต่ละคนต้องการแรงเชียร์คนละแบบ'
  ],d,8)+'</div>';
  _fillParentQGrid(d);
}

// ── 🐘 ช้าง: ข่าวดีมาก่อน ไม่มีสีแดง มี context และคำสัญญาจากครู ──
function _parentElephant(d){
  const name=d.shortName, F=_parentFacts(d);
  const goods=[];
  if(d.isBest)goods.push(`คะแนนสูงสุดตั้งแต่เริ่มเรียน — ${d.score}/${d.full||30}`);
  if(d.streak>=2)goods.push(`พัฒนาดีขึ้นต่อเนื่อง ${d.streak} ครั้งติด`);
  else if(d.delta!=null&&d.delta>0)goods.push(`คะแนนเพิ่มขึ้น ${d.delta} ข้อจากครั้งก่อน`);
  if(F.strongName)goods.push(`หัวข้อ "${F.strongName}" น้องทำได้แม่นมากในชุดนี้`);
  if(d.care>0)goods.push(`มี ${d.care} ข้อที่น้องรู้วิธีทำอยู่แล้ว เพียงฝึกความรอบคอบอีกนิดก็ได้คะแนนคืน`);
  if(d.grpStats&&d.score>=d.grpStats.avg)goods.push(`คะแนนอยู่เหนือค่าเฉลี่ยของกลุ่ม (${d.grpStats.avg}/${d.full||30})`);
  if(d.timeout===0&&d.blank===0)goods.push('น้องลงมือทำครบทุกข้อ ไม่มีข้อไหนถูกปล่อยว่าง — สะท้อนความตั้งใจได้ดีมาก');
  if(F.strong.length>=2)goods.push(`มี ${F.strong.length} หัวข้อที่น้องทำได้เกิน 80% แล้วในบทนี้`);
  if(!goods.length)goods.push('น้องมาเรียนสม่ำเสมอและตั้งใจทำครบทุกขั้นตอน — ความต่อเนื่องแบบนี้คือรากฐานที่ดีที่สุดครับ');
  // หมุนลำดับข่าวดี เพื่อไม่ให้เห็นชุดเดิมซ้ำเมื่อผลใกล้เคียงกัน
  if(goods.length>3){ const k=_pSeed(d)%goods.length; goods.push(...goods.splice(0,k)); }
  document.getElementById('p-summary').innerHTML=`
    <div style="font-size:13px;color:#3B7D2A;font-weight:600;margin-bottom:8px">🐘 ข่าวดีของ${name}ประจำรายงานนี้ 🌱</div>
    ${goods.slice(0,3).map((g,i)=>`<div class="summary-headline" style="margin-bottom:4px">${i+1}. ${g}</div>`).join('')}`;
  const below=d.grpStats&&d.score<d.grpStats.avg;
  document.getElementById('p-problems').innerHTML=`
    <div style="font-size:13px;color:var(--text2);line-height:1.9">
    <b>บริบทที่อยากให้ทราบ:</b> ${_pv([
      `ค่าเฉลี่ยของกลุ่มครั้งนี้อยู่ที่ ${d.grpStats?d.grpStats.avg:'—'}/${d.full||30} ${below?'— ชุดนี้ท้าทายทั้งกลุ่ม คะแนนของน้องอยู่ในจังหวะการเรียนรู้ที่เหมาะสมครับ':'— น้องทำได้ดีมากครับ'}`,
      `ข้อสอบชุดนี้คัดจากข้อสอบเข้ามหาวิทยาลัยจริง ระดับความยากจึงสูงกว่าข้อสอบในโรงเรียน ${below?'คะแนนที่เห็นจึงไม่ได้สะท้อนว่าน้องอ่อนครับ':'ซึ่งน้องรับมือได้ดี'}`,
      `ครูออกแบบให้แต่ละชุดมีข้อยากปนอยู่เสมอ เพื่อวัดว่าควรเสริมตรงไหน ${below?'คะแนนไม่เต็มจึงเป็นเรื่องที่คาดไว้แล้ว':'น้องผ่านจุดที่ตั้งใจวัดไว้ได้'}ครับ`
    ],d,0)}<br>
    <b>สิ่งที่ครูดูแลอยู่:</b> ${_pv([
      'จุดเล็กๆ ที่ยังพลาด ครูมีแผนฝึกในคาบเรียนครบทุกจุดแล้ว ไม่ต้องเพิ่มอะไรที่บ้าน',
      (F.weakName?`ครูจะเสริมเรื่อง "${F.weakName}" ให้ในคาบถัดไป — เตรียมแบบฝึกไว้แล้ว ไม่ต้องหาเพิ่มที่บ้านครับ`:'ครูเตรียมแบบฝึกเฉพาะจุดให้น้องแล้ว ที่บ้านไม่ต้องเพิ่มภาระอะไร'),
      'ทุกข้อที่พลาดถูกบันทึกและจัดลำดับให้แล้วว่าจะเก็บเรื่องไหนก่อน — เป็นหน้าที่ของครูครับ'
    ],d,1)}<br>
    <b>จังหวะการเรียนรู้:</b> ${_pv([
      'คะแนนขึ้นๆ ลงๆ ระหว่างเตรียมสอบเป็นเรื่องปกติมาก สิ่งที่ครูโฟกัสคือแนวโน้มระยะยาวของน้อง',
      'เด็กที่เตรียมสอบทุกคนมีช่วงที่คะแนนนิ่งหรือย่อลง ก่อนจะขยับขึ้นอีกครั้ง — เป็นธรรมชาติของการเรียนรู้ครับ',
      'ครูไม่ตัดสินจากคะแนนครั้งเดียว แต่ดูทิศทางรวม 4-5 ครั้ง ซึ่งของน้องยังอยู่ในเส้นทางที่ดีครับ'
    ],d,2)}</div>`;
  document.getElementById('p-actions').innerHTML=`<div class="action-card" style="border-left-color:#3B7D2A"><div class="action-title" style="color:#3B7D2A">สิ่งเดียวที่ช่วยได้มากที่สุด</div><div class="action-text">${_pv([
    'บรรยากาศผ่อนคลายที่บ้าน — เด็กที่ผู้ปกครองกังวลน้อย ทำข้อสอบได้ดีกว่าอย่างมีนัยสำคัญ ความห่วงใยของคุณส่งถึงน้องอยู่แล้วครับ',
    'ดูแลเรื่องการนอนให้พอ — การพักผ่อนมีผลต่อคะแนนมากกว่าการอ่านเพิ่มอีก 1 ชั่วโมงในคืนก่อนสอบครับ',
    'ให้น้องได้มีเวลาว่างที่ไม่เกี่ยวกับการเรียนบ้าง — สมองต้องการช่วงพักเพื่อจัดระเบียบสิ่งที่เรียนมา',
    'เวลากินข้าวด้วยกันโดยไม่พูดเรื่องคะแนน มีค่ากับน้องมากกว่าที่คิดครับ'
  ],d,3)}</div></div>`;
  const talkEl=document.getElementById('p-talkList');
  if(talkEl)talkEl.innerHTML='<div style="font-size:13px;color:var(--text1);line-height:1.9">• '+_pv([
    '"วันนี้เรียนอะไรสนุกที่สุด?" — คำถามที่ไม่มีคะแนนเป็นคำตอบ',
    '"ช่วงนี้มีเรื่องอะไรอยากเล่าให้ฟังไหม?" — เปิดพื้นที่โดยไม่เจาะจงเรื่องเรียน',
    '"เหนื่อยไหมช่วงนี้?" — ให้ลูกรู้ว่าคุณเห็นความพยายาม ไม่ใช่แค่ผลลัพธ์'
  ],d,4)+'<br>• '+_pv([
    '"อยากกินอะไรพิเศษหลังสอบเสร็จ?" — ให้การสอบจบด้วยความรู้สึกดี',
    '"สุดสัปดาห์นี้อยากไปไหนกันไหม?" — ให้ลูกมีอะไรรอคอยนอกจากการสอบ',
    '"มีอะไรที่พ่อแม่ทำแล้วช่วยลูกได้จริงๆ บ้าง?" — ถามตรงๆ ดีกว่าเดาครับ'
  ],d,5)+'</div>';
  _fillParentQGrid(d);
}

// ── 🦉 นกฮูก: ไฟจราจร + 3 บรรทัดจบ + กติกาว่าครูจะติดต่อเมื่อไหร่ ──
function _parentOwl(d){
  const hist=d.history||[], F=_parentFacts(d);
  const drop2=hist.length>=3&&hist[hist.length-1].score<hist[hist.length-2].score&&hist[hist.length-2].score<hist[hist.length-3].score;
  let st='🟢',color='#3B7D2A',head;
  if(d.score<15||drop2){ st='🔴';color='#A32D2D'; head=_pv([
    'ชุดนี้ท้าทายสำหรับน้อง — ครูปรับแผนฝึกเฉพาะจุดให้แล้ว กำลังใจจากบ้านช่วยได้มากครับ',
    'ช่วงนี้น้องกำลังเจอเนื้อหาที่ยากขึ้น ครูจัดลำดับการเก็บใหม่ให้แล้ว',
    (F.chronic.length?`มีหัวข้อที่พลาดซ้ำ ("${F.chronic[0].sub}") ครูจะรื้อแนวคิดใหม่กับน้องครับ`:'ครูขอเวลาปรับแผนกับน้องอีกสักระยะ ยังอยู่ในช่วงที่แก้ได้ครับ')
  ],d,0); }
  else if(d.delta!=null&&d.delta<0){ st='🟡';color='#C77E1A'; head=_pv([
    'คะแนนย่อลงเล็กน้อย — อยู่ในช่วงผันผวนปกติของการเตรียมสอบ',
    'ครั้งนี้ขยับลงนิดหน่อย ยังอยู่ในกรอบที่ครูคาดไว้ครับ',
    'คะแนนแกว่งเป็นเรื่องปกติเมื่อเนื้อหาเปลี่ยนบท — ครูติดตามอยู่'
  ],d,1); }
  else { head=_pv([
    'เป็นไปตามแผน — ไม่ต้องดำเนินการใดๆ',
    'ทุกอย่างอยู่ในเส้นทาง ให้กำลังใจตามปกติพอครับ',
    (d.isBest?'ครั้งนี้ทำได้ดีที่สุดตั้งแต่เริ่มเรียน — น่าชื่นใจครับ':'น้องรักษาระดับได้ดี ไม่มีอะไรต้องกังวล')
  ],d,2); }
  document.getElementById('p-summary').innerHTML=`
    <div style="display:flex;align-items:center;gap:14px">
      <div style="font-size:40px">${st}</div>
      <div><div style="font-size:16px;font-weight:700;color:${color}">${head}</div>
      <div style="font-size:13.5px;color:var(--text2);margin-top:4px">${d.shortName} · ${d.topic} · ได้ <b>${d.score}/${d.full||30}</b>${d.delta!=null?(d.delta>=0?' (▲ +'+d.delta+')':' (▼ '+d.delta+')'):''}${d.isBest?' · สูงสุดตั้งแต่เริ่มเรียน':''}<br>${(d.care+d.concept+d.cant+d.timeout)>0?_pv([
        'จุดที่ต้องเก็บ ครูจัดแผนฝึกให้แล้ว',
        (F.weakName?'จุดที่ต้องเก็บหลักคือ "'+F.weakName+'" — อยู่ในแผนของครูแล้ว':'จุดที่ต้องเก็บมีครบในแผนทบทวนแล้ว'),
        (d.care>0?'ส่วนใหญ่เป็นข้อที่น้องทำเป็นแต่พลาดจังหวะ — เก็บคืนได้ไม่ยาก':'ครูจัดลำดับสิ่งที่ต้องเก็บให้เรียบร้อยแล้ว')
      ],d,3):'ไม่มีจุดต้องเก็บเพิ่ม'}</div></div>
    </div>`;
  const td='padding:6px 8px;border-bottom:1px solid var(--border,#E7E4DC)';
  document.getElementById('p-problems').innerHTML=`
    <div style="font-size:12px;color:var(--text3);margin-bottom:6px">ความหมายของสัญญาณไฟ:</div>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
    <tr><td style="${td}">🔴</td><td style="${td}">ชุดนี้ท้าทาย หรือคะแนนย่อต่อเนื่อง</td><td style="${td}">ลองชวนลูกคุยเบาๆ และดูรายละเอียดได้ในสไตล์ 🐬 โลมา</td></tr>
    <tr><td style="${td}">🟡</td><td style="${td}">กำลังปรับตัว คะแนนแกว่งเล็กน้อย</td><td style="${td}">ติดตามผลครั้งถัดไป ยังไม่ต้องทำอะไรเพิ่ม</td></tr>
    <tr><td style="padding:6px 8px">🟢</td><td style="padding:6px 8px">ทุกอย่างอยู่ในแผน</td><td style="padding:6px 8px">ให้กำลังใจตามปกติ เท่านี้พอครับ</td></tr></table>`;
  document.getElementById('p-actions').innerHTML='';
  const talkEl=document.getElementById('p-talkList');
  if(talkEl)talkEl.innerHTML='<div style="font-size:13px;color:var(--text1)">• '+_pv([
    '"ช่วงนี้เป็นยังไงบ้าง?" — แค่ให้ลูกรู้ว่าคุณพร้อมฟัง เท่านี้พอครับ',
    '"มีอะไรอยากเล่าไหม?" — คำถามสั้นๆ ที่เปิดประตูไว้โดยไม่กดดัน',
    '"ถ้าอยากให้ช่วยอะไรบอกได้นะ" — ประโยคเดียวที่ทำให้ลูกรู้ว่ามีที่พึ่ง',
    (d.isBest?'"ได้ข่าวว่าครั้งนี้ทำได้ดีที่สุดเลย เก่งมาก" — ชมสั้นๆ ก็มีน้ำหนักครับ':'"เห็นว่าลูกตั้งใจมาตลอด พ่อ/แม่เห็นนะ" — การถูกมองเห็นสำคัญกับวัยรุ่นมาก')
  ],d,4)+'</div>';
  _fillParentQGrid(d);
}

// ── 🐝 ผึ้ง: การ์ดเดียวจบ + สิ่งเดียวที่อยากให้ทำ ──
function _parentBee(d){
  const name=d.shortName;
  let praise='ตั้งใจเรียนสม่ำเสมอ';
  if(d.isBest)praise='ทำคะแนนสูงสุดตั้งแต่เริ่มเรียน';
  else if(d.streak>=2)praise='พัฒนาขึ้น '+d.streak+' ครั้งติด';
  else if(d.delta!=null&&d.delta>0)praise='คะแนนดีขึ้นจากครั้งก่อน';
  const F=_parentFacts(d);
  // พาดหัวการ์ด — หมุนสำนวนตามรอบสอบ
  const headline=_pv([
    `${praise} กำลังไปได้ดีครับ`,
    (F.strongName?`เรื่อง "${F.strongName}" น้องทำได้แม่นมากในชุดนี้`:`${praise} — ครูเห็นความสม่ำเสมอครับ`),
    (d.care>0?`ทำเป็นเกือบครบ เหลือเก็บเรื่องความรอบคอบอีกนิดเดียว`:`${praise} ครับ`),
    (d.grpStats&&d.score>=d.grpStats.avg?`อยู่เหนือค่าเฉลี่ยกลุ่ม (${d.grpStats.avg}/${d.full||30}) ครับ`:`${praise} — ครูดูแลจุดที่เหลือให้แล้ว`)
  ],d,0);
  // "สิ่งเดียวที่อยากให้ทำ" — คลังใหญ่สุด เพราะเป็นหัวใจของสไตล์นี้
  const askPool=[
    {t:'ชมความพยายาม',b:`คืนนี้บอกน้องสั้นๆ ว่า <i>"พ่อ/แม่ได้ข่าวจากครูแบงก์ว่าลูก${praise} ภูมิใจนะ"</i>`,n:'10 วินาที แต่ผลต่อความมุ่งมั่นของลูกมากกว่าที่คิดครับ'},
    {t:'ชมแบบเจาะจง',b:F.strongName?`ลองพูดว่า <i>"ได้ยินว่าเรื่อง ${F.strongName} ลูกทำได้ดีมาก"</i>`:`ลองพูดว่า <i>"เห็นว่าลูกตั้งใจมาตลอด แม่/พ่อเห็นนะ"</i>`,n:'คำชมที่เจาะจงมีน้ำหนักกว่าคำว่า "เก่ง" หลายเท่าครับ'},
    {t:'ถามด้วยความสนใจ',b:`ลองถามน้องว่า <i>"ข้อไหนที่ภูมิใจว่าทำได้ที่สุด?"</i> แล้วฟังเฉยๆ`,n:'การถูกฟังโดยไม่ถูกตัดสิน คือสิ่งที่วัยรุ่นต้องการมากที่สุดครับ'},
    {t:'ดูแลร่างกาย',b:`ช่วยดูให้น้องได้นอนก่อน 23.00 สัก 2-3 คืนสัปดาห์นี้`,n:'การนอนพอมีผลต่อคะแนนมากกว่าการอ่านเพิ่มอีก 1 ชั่วโมงครับ'},
    {t:'ให้พื้นที่',b:`สัปดาห์นี้ลองไม่ถามเรื่องคะแนนสัก 2-3 วัน แล้วชวนทำอย่างอื่นแทน`,n:'ช่วงพักสมองทำให้สิ่งที่เรียนมาเข้าที่ — และลดความกดดันไปในตัว'},
    {t:'ยืนยันว่าอยู่ข้างเดียวกัน',b:`บอกน้องว่า <i>"คะแนนขึ้นลงได้ ขอแค่ลูกไม่หยุดพยายาม พ่อ/แม่อยู่ข้างลูกเสมอ"</i>`,n:'ประโยคนี้สำคัญมากในช่วงที่คะแนนไม่เป็นไปตามหวังครับ'}
  ];
  const ask=askPool[(_pSeed(d)+1)%askPool.length];
  document.getElementById('p-summary').innerHTML=`
    <div style="max-width:340px;margin:0 auto;border:1px solid var(--border,#E7E4DC);border-radius:14px;overflow:hidden;box-shadow:0 3px 10px rgba(0,0,0,.08)">
      <div style="background:#185FA5;color:#fff;padding:10px 14px;font-size:13px">📊 MathsBankTutor · รายงาน${name}</div>
      <div style="padding:14px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="font-size:28px">${d.score>=15?'🟢':'🟡'}</div>
          <div><b style="font-size:18px">${d.score}/${d.full||30}</b> <span style="font-size:11px;color:var(--text3)">· ${d.topic}</span><br><span style="font-size:12.5px">${headline}</span></div>
        </div>
        <div style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:10px;padding:10px 12px;margin-top:10px;font-size:12.5px">💬 <b style="color:#C2410C">สิ่งเดียวที่อยากรบกวน — ${ask.t}:</b><br>${ask.b}<br><span style="font-size:11px;color:var(--text3)">${ask.n}</span></div>
      </div>
    </div>`;
  document.getElementById('p-problems').innerHTML='<div style="font-size:12px;color:var(--text3)">'+_pv([
    'อยากเห็นรายละเอียดเต็ม สลับสไตล์เป็น 🐬 โลมา ด้านบนได้ทุกเมื่อ — หรือทักครูแบงก์ได้เลยครับ',
    'ถ้ามีเวลาอยากดูละเอียดขึ้น กดสไตล์ 🐬 โลมา ด้านบนได้เลยครับ',
    'มีคำถามเพิ่มเติม ทักครูแบงก์ได้ตลอดครับ — หรือกด 🦅 นกอินทรี เพื่อดูแผนที่ครูวางไว้'
  ],d,2)+'</div>';
  document.getElementById('p-actions').innerHTML='';
  const talkEl=document.getElementById('p-talkList');
  if(talkEl)talkEl.innerHTML='';
  _fillParentQGrid(d);
}

function switchTab(name){
  // v2.1: จับคู่ปุ่ม↔ชื่อจาก onclick โดยตรง — รองรับจำนวนแท็บไม่จำกัด และไม่ชนกับแท็บของคลังทบทวน
  document.querySelectorAll('#p4 .tab-row .tab').forEach(t=>{
    const m=(t.getAttribute('onclick')||'').match(/switchTab\('([^']+)'\)/);
    t.classList.toggle('active',!!m&&m[1]===name);
  });
  document.querySelectorAll('#p4 .pane').forEach(p=>p.classList.toggle('active',p.id==='pane-'+name));
  // resize chart เมื่อ pane ที่มี canvas เพิ่งโผล่ (canvas วาดตอนซ่อนจะขนาด 0)
  if(name==='compare'){
    setTimeout(()=>{
      try{if(groupChartInst) groupChartInst.resize();}catch(e){}
      try{if(distChartInst)  distChartInst.resize();}catch(e){}
    }, 50);
  }
  if(name==='progress'){
    setTimeout(()=>{
      try{if(trendChartInst) trendChartInst.resize();}catch(e){}
      try{if(mixChartInst)   mixChartInst.resize();}catch(e){}
    }, 50);
  }
}

// ── v2: ติ๊กแผนทบทวน — บันทึกใน localStorage + อัปเดต progress bar ──
function spTick(cb){
  try{localStorage.setItem(cb.getAttribute('data-spkey'),cb.checked?'1':'0');}catch(e){}
  const row=cb.closest('.sp-row'); if(row)row.style.opacity=cb.checked?'0.55':'1';
  const boxes=[...document.querySelectorAll('#s-studyPlan input[type=checkbox]')];
  const n=boxes.filter(b=>b.checked).length;
  const f=document.getElementById('sp-fill'); if(f)f.style.width=(boxes.length?Math.round(n/boxes.length*100):0)+'%';
  const t=document.getElementById('sp-text'); if(t)t.textContent='ทำแล้ว '+n+' จาก '+boxes.length+' ขั้น'+(n===boxes.length?' — ครบแล้ว เก่งมาก! 🎉':'');
}
// ── v2.1: สลับธีม สว่าง/มืด/ตามระบบ (จำค่าใน localStorage) ──
const _DARK_CSS=`html.force-dark{--bg:#1C1C1A;--card:#252523;--border:rgba(255,255,255,0.08);--border-md:rgba(255,255,255,0.15);--text1:#F0EEE9;--text2:#A8A8A0;--text3:#666660;--surf:#2C2C2A;--blue-l:#042C53;--amber-l:#412402;--red-l:#501313;--green-l:#173404}
html.force-dark .q-blank{background:repeating-linear-gradient(45deg,#333,#333 4px,#444 4px,#444 8px);color:#999;border:1px dashed #555}
html.force-light{--bg:#F5F4F1;--card:#FFFFFF;--border:rgba(0,0,0,0.08);--border-md:rgba(0,0,0,0.14);--text1:#1A1A1A;--text2:#666660;--text3:#999993;--surf:#F0EEE9;--blue-l:#E6F1FB;--amber-l:#FAEEDA;--red-l:#FCEBEB;--green-l:#EAF3DE}
html.force-light .q-blank{background:repeating-linear-gradient(45deg,#E8E6E0,#E8E6E0 4px,#D8D5CC 4px,#D8D5CC 8px);color:#777;border:1px dashed #AAA}`;
function _applyTheme(mode){
  document.documentElement.classList.remove('force-dark','force-light');
  if(mode==='dark')document.documentElement.classList.add('force-dark');
  else if(mode==='light')document.documentElement.classList.add('force-light');
  const b=document.getElementById('themeToggle');
  if(b){b.textContent=mode==='dark'?'🌙':(mode==='light'?'☀️':'🌓');
       b.title='ธีม: '+(mode==='dark'?'มืด':(mode==='light'?'สว่าง':'ตามระบบ'))+' — กดเพื่อสลับ';}
}
function toggleTheme(){
  const order=['auto','dark','light'];
  let cur='auto'; try{cur=localStorage.getItem('themeMode')||'auto';}catch(e){}
  const next=order[(order.indexOf(cur)+1)%order.length];
  try{localStorage.setItem('themeMode',next);}catch(e){}
  _applyTheme(next);
}
function _initTheme(){
  const st=document.createElement('style'); st.textContent=_DARK_CSS; document.head.appendChild(st);
  const b=document.createElement('button'); b.id='themeToggle'; b.onclick=toggleTheme;
  b.style.cssText='position:fixed;right:14px;bottom:14px;z-index:99;width:44px;height:44px;border-radius:50%;border:1px solid var(--border-md);background:var(--card);font-size:19px;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.18);line-height:1';
  document.body.appendChild(b);
  let cur='auto'; try{cur=localStorage.getItem('themeMode')||'auto';}catch(e){}
  _applyTheme(cur);
}
document.addEventListener('DOMContentLoaded',()=>{try{loadStudents();}catch(e){} try{_initTheme();}catch(e){} try{ensureMockOptions();}catch(e){}});

/* ═══════════════════════════════════════════════════════════════════
   เฟส 2 (14 ส.ค. 69) — นักเรียนกรอกคะแนนเอง ส่งให้ครูตรวจ (หน้า p8)

   คะแนนที่ส่งจากหน้านี้ไปพักที่ชีต results_pending เท่านั้น
   ไม่แตะ results จนกว่าครูจะกดอนุมัติ → ค่าเฉลี่ยกลุ่มกับอันดับของเพื่อนไม่เพี้ยน
   ═══════════════════════════════════════════════════════════════════ */

/* URL ของ Apps Script "Maths Bank Tutor API" — ตัวเดียวกับที่หน้าครูใช้ */
const SUBMIT_URL = 'https://script.google.com/macros/s/AKfycbzh0M26XbDfjrVuUjUgn1Dr-Z209ms9UibPAxfd-YiB7oHnD-1ubzc3PNtadO7tULjm/exec';

const SUB_STATES = [
  { v:'',            short:'–', label:'ยังไม่ระบุ', bg:'var(--surf)',  fg:'var(--text3)' },
  { v:'✅ ถูก',       short:'✓', label:'ถูก',       bg:'#4C9A2A',      fg:'#fff' },
  { v:'⚠️ สะเพร่า',   short:'ส', label:'สะเพร่า',   bg:'#FDE910',      fg:'#5C3A00' },
  { v:'C คอนเซปต์',   short:'C', label:'คอนเซปต์',  bg:'#F5A623',      fg:'#fff' },
  { v:'X ทำไม่ได้',   short:'X', label:'ทำไม่ได้',  bg:'#D93025',      fg:'#fff' },
  { v:'⏰ ไม่ทัน',     short:'⏰', label:'ไม่ทัน',    bg:'#a855f7',      fg:'#fff' }
];


/* ═══════════════════════════════════════════════════════════════
   ★ 17 ก.ย. 69 — นักเรียนกรอกคะแนน "สนามสอบ" เอง
   ค้างมาตั้งแต่ 29 ส.ค.: หน้ากรอกเองนับเป็น "จำนวนข้อถูก /30" อย่างเดียว
   พอเลือกชุดรวมจึงเห็น 22/30 ทั้งที่ของจริงคือ 66/100

   คิดจากสถานะรายข้อเหมือนทุกที่ในระบบ (กฎ 41 — ชีตเก็บจำนวนข้อถูกเหมือนเดิม
   คะแนนถ่วงน้ำหนักคิดตอนแสดงผล) จึงไม่ต้องแตะ submitMyScore ฝั่งเซิร์ฟเวอร์เลย
   ═══════════════════════════════════════════════════════════════ */

/* คะแนนถ่วงน้ำหนักจากอาร์เรย์สถานะ 30 ช่อง — คืน null ถ้าไม่ใช่สนามสอบ
   หรือคลังยังไม่มีระบบคะแนนของชุดนั้น (จะได้ตกไปแสดงแบบเดิมอย่างปลอดภัย) */
function subWeighted(chapter, st){
  try{
    if(!_isMock(chapter)) return null;
    if(typeof ptsOfQuestion !== 'function' || typeof fullScoreOf !== 'function') return null;
    const full = fullScoreOf(chapter);
    if(!full || full === 30) return null;
    let s = 0;
    for(let q = 1; q <= 30; q++){
      if(String((st||[])[q-1] || '').indexOf('ถูก') !== -1) s += ptsOfQuestion(chapter, q);
    }
    return { score:s, full:full };
  }catch(e){ return null; }
}

/* ข้อความคะแนนสั้น ๆ ใช้ซ้ำหลายที่ — "66/100" หรือ "24/30" */
function subScoreText(chapter, st, okCount){
  const w = subWeighted(chapter, st);
  return w ? (w.score + '/' + w.full) : (okCount + '/30');
}

const subState = { st:new Array(30).fill(''), brush:1, sending:false };

/* รายชื่อบทมาตรฐาน — อ่านจากดรอปดาวน์ "กรองเฉพาะบท" ที่มีอยู่แล้ว
   จะได้ไม่ต้องเก็บรายการซ้ำอีกที่ (แก้ที่ index.html ที่เดียวพอ) */
function subChapters(){
  return [...document.querySelectorAll('#topicFilter option')]
    .map(o => o.value).filter(Boolean);
}

function subIdx(v){ const i = SUB_STATES.findIndex(s => s.v === v); return i < 0 ? 0 : i; }

function subCounts(){
  const n = { ok:0, care:0, concept:0, cant:0, timeout:0, blank:0 };
  subState.st.forEach(v => {
    if(!v) n.blank++;
    else if(v.indexOf('ถูก')!==-1) n.ok++;
    else if(v.indexOf('สะเพร่า')!==-1) n.care++;
    else if(v.indexOf('คอนเซปต์')!==-1) n.concept++;
    else if(v.indexOf('ทำไม่ได้')!==-1) n.cant++;
    else if(v.indexOf('ไม่ทัน')!==-1) n.timeout++;
  });
  return n;
}

function subOpen(){
  if(!currentStudent){ goTo('p1b'); return; }
  goTo('p8');

  const short = currentStudent.replace(/\s*\([^)]*\)\s*$/,'').trim();
  const av = document.getElementById('sub-avatar');
  av.textContent = short.substring(0,3);
  document.getElementById('sub-who').textContent = currentStudent;

  const sel = document.getElementById('subChapter');
  if(!sel.options.length){
    /* ensureMockOptions() เติมชุดรวมเข้า #topicFilter ไว้แล้วตอนโหลดหน้า
       subChapters() อ่านจากที่นั่น ชุดรวมจึงมาเองโดยไม่ต้องแก้ index.html */
    try{ if(typeof ensureMockOptions === 'function') ensureMockOptions(); }catch(e){}
    sel.innerHTML = subChapters().map(c => `<option value="${_esc(c)}">${_esc(c)}</option>`).join('');
  }
  /* ★ 17 ก.ย. 69 — เปลี่ยนบท = คะแนนเต็มเปลี่ยน ต้องคิดใหม่ทันที
     ผูกที่นี่แทนการแก้ index.html (onchange เดิมไม่มี) */
  if(sel && !sel.__subBound){ sel.__subBound = true; sel.addEventListener('change', subRender); }
  const dt = document.getElementById('subDate');
  if(!dt.value){
    const d = new Date();
    dt.value = d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2);
  }
  subRender();
  subLoadList();
  try{ subPdfEnsure(); }catch(e){}   /* ★ 25 ก.ย. 69 — กล่องใส่ PDF ใบตรวจ */
}

function subRender(){
  const b = document.getElementById('subBrush');
  b.innerHTML = SUB_STATES.map((s,i) => `
    <button onclick="subState.brush=${i};subRender()"
      style="background:${s.bg};color:${s.fg};border-color:${subState.brush===i?'var(--text1)':'var(--border-md)'}">
      ${s.short} ${s.label}</button>`).join('');

  document.getElementById('subGrid').innerHTML = subState.st.map((v,i) => {
    const s = SUB_STATES[subIdx(v)];
    return `<button onclick="subTap(${i})" style="background:${v?s.bg:'var(--card)'};color:${v?s.fg:'var(--text3)'}">
      <span>${i+1}</span>${s.short}</button>`;
  }).join('');

  try{ subPdfDecor(); }catch(e){}   /* ★ 25 ก.ย. 69 — กรอบส้มข้อที่อ่านจาก PDF ไม่แน่ใจ */
  const n = subCounts();
  /* ★ 17 ก.ย. 69 — สนามสอบคิดคะแนนถ่วงน้ำหนัก ต้องเห็นตั้งแต่ตอนกรอก
     ไม่ใช่ไปรู้ทีหลังตอนครูอนุมัติแล้ว */
  const _chap = (document.getElementById('subChapter') || {}).value || '';
  const _w = subWeighted(_chap, subState.st);
  document.getElementById('subCounts').innerHTML =
    (_w
      ? `<b style="font-size:18px;color:var(--blue)">${_w.score}</b>/${_w.full} คะแนน` +
        `<span style="font-size:11.5px;color:var(--text2)"> · ทำถูก ${n.ok}/30 ข้อ</span>`
      : `ทำถูก <b style="font-size:18px;color:var(--blue)">${n.ok}</b>/30 ข้อ`) +
    `<span style="font-size:11px;color:var(--text3)"> · ยังไม่ระบุ ${n.blank}</span>` +
    (_w
      ? `<div style="font-size:11px;color:var(--text3);margin-top:4px;line-height:1.6">` +
        `🎯 สนามสอบคิดคะแนนไม่เท่ากันทุกข้อ — ข้อ 1–25 ข้อละ 3 คะแนน · ข้อ 26–30 ข้อละ 5 คะแนน (เต็ม ${_w.full} คะแนน)</div>`
      : '');
}

function subTap(i){
  if(SUBPDF.item && !SUBPDF.item.sentPid) SUBPDF.item.unsure[i] = '';   /* แตะแก้ = ตรวจแล้ว */
  const cur = subIdx(subState.st[i]);
  subState.st[i] = (cur === subState.brush)
    ? SUB_STATES[(cur+1) % SUB_STATES.length].v
    : SUB_STATES[subState.brush].v;
  subRender();
}

function subFillAll(v){ subState.st = new Array(30).fill(v); subRender(); }

async function subPost(payload){
  const res = await gsFetch(SUBMIT_URL, {
    method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'},
    body: JSON.stringify(Object.assign({ name: currentStudent, pin: currentPin }, payload))
  });
  return res.json();
}

async function subSend(){
  if(subState.sending) return;
  const st = document.getElementById('subStatus');
  const n = subCounts();
  if(n.blank === 30){ st.className='status err'; st.textContent='ยังไม่ได้กรอกข้อไหนเลยครับ'; return; }
  if(n.blank > 0 && !confirm(`ยังไม่ได้ระบุ ${n.blank} ข้อ (จะถูกส่งเป็น "ไม่ทำ")\nส่งเลยไหม?`)) return;

  const chapter = document.getElementById('subChapter').value;
  const date    = document.getElementById('subDate').value;
  const note    = document.getElementById('subNote').value.trim();
  if(!chapter){ st.className='status err'; st.textContent='เลือกบทก่อนครับ'; return; }
  if(!subPdfReady(st)) return;

  subState.sending = true;
  const btn = document.getElementById('subSendBtn');
  btn.disabled = true; btn.textContent = 'กำลังส่ง...';
  st.className='status'; st.textContent='';

  const _stSent = subState.st.slice();     /* ★ เก็บไว้คิดคะแนนตอนแจ้งผล — ของเดิมถูกล้างทิ้งทันทีหลังส่ง */
  try{
    const j = await subPost({ action:'submitMyScore', chapter, date, note, statuses: subState.st, gid: subPdfGid() });
    if(j && j.ok){
      st.className='status ok';
      /* ★ 17 ก.ย. 69 — j.score จากเซิร์ฟเวอร์เป็น "จำนวนข้อถูก" เสมอ (ชีตเก็บแบบนั้น)
         ถ้าเป็นสนามสอบให้บอกคะแนนถ่วงน้ำหนักคู่ไปด้วย จะได้ไม่งงว่าทำไมได้ 22 */
      const _wSent = subWeighted(chapter, _stSent);
      st.textContent = (j.resubmitted ? 'ส่งใหม่แทนของเดิมแล้ว' : 'ส่งให้ครูแล้ว')
        + (_wSent
            ? ` · ได้ ${_wSent.score}/${_wSent.full} คะแนน (ทำถูก ${j.score}/30 ข้อ)`
            : ` · ทำถูก ${j.score}/30 ข้อ`)
        + ' — รอครูตรวจครับ';
      try{ await subPdfAfterSend(j, st); }catch(e){}   /* ★ 25 ก.ย. 69 — ภาพโน้ตตามไป */
      subState.st = new Array(30).fill('');
      document.getElementById('subNote').value = '';
      subRender(); subLoadList();
    }else{
      st.className='status err';
      st.textContent = (j && j.error) || 'ส่งไม่สำเร็จ';
    }
  }catch(e){
    st.className='status err'; st.textContent='เชื่อมต่อไม่ได้: ' + e.message;
  }
  subState.sending = false;
  btn.disabled = false; btn.textContent = '📤 ส่งให้ครูตรวจ';
}

/* ★ 17 ก.ย. 69 — รายการที่เคยส่ง: สนามสอบโชว์ /100 · บทปกติโชว์ /30 เหมือนเดิม
   (myPendingList ส่ง statuses กลับมาด้วย จึงคิดคะแนนได้โดยไม่ต้องขอข้อมูลเพิ่ม) */
function _subListScore(it){
  const w = subWeighted(it.chapter, it.statuses || []);
  if(!w) return it.score + '/30';
  return w.score + '/' + w.full
    + '<div style="font-size:10px;color:var(--text3);font-weight:400">ทำถูก ' + it.score + '/30 ข้อ</div>';
}

async function subLoadList(){
  const box = document.getElementById('subList');
  box.innerHTML = '<div style="font-size:13px;color:var(--text3)">กำลังโหลด...</div>';
  try{
    const j = await subPost({ action:'myPendingList' });
    if(!j || !j.ok){ box.innerHTML = '<div style="font-size:13px;color:var(--red)">โหลดไม่สำเร็จ</div>'; return; }
    if(!j.items.length){ box.innerHTML = '<div style="font-size:13px;color:var(--text3)">ยังไม่เคยส่งคะแนนครับ</div>'; return; }

    const badge = s => s === 'approved' ? '<span class="sub-badge sub-ok">✅ ครูอนุมัติแล้ว</span>'
                     : s === 'rejected' ? '<span class="sub-badge sub-no">❌ ครูตีกลับ</span>'
                     : '<span class="sub-badge sub-wait">⏳ รอครูตรวจ</span>';

    /* ★ 30 ส.ค. 69 — เก็บไว้ให้ปุ่มแก้ไข/ยกเลิกใช้ (myPendingList ส่ง statuses กลับมาให้อยู่แล้ว) */
    window.__subItems = j.items.slice();
    box.innerHTML = j.items.slice().reverse().map(it => {
      const editable = it.status !== 'approved';
      /* ใช้ inline style — index.html ไม่มี class สำหรับปุ่มเล็กนี้ */
      const _btn='font-family:inherit;font-size:11.5px;padding:5px 11px;border-radius:11px;cursor:pointer;background:var(--card,#FAF9F5);';
      const acts = editable
        ? `<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">
             <button onclick="subEditItem('${_esc(String(it.pid))}')" style="${_btn}border:1px solid var(--border-md,#D9D2C6);color:var(--text1,#1A1815)">✏️ แก้ไข</button>
             <button onclick="subCancelItem('${_esc(String(it.pid))}')" style="${_btn}border:1px solid #E4C7C5;color:#B3261E">🗑 ยกเลิกการส่ง</button>
           </div>`
        : `<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;align-items:center">
             <button onclick="subEditItem('${_esc(String(it.pid))}')" style="${_btn}border:1px solid var(--border-md,#D9D2C6);color:var(--text1,#1A1815)">✏️ ขอแก้คะแนน</button>
             <span style="font-size:11px;color:var(--text3)">ครูอนุมัติแล้ว — ส่งแก้ได้ ครูจะได้รับแจ้งและต้องยืนยันก่อน</span>
           </div>`;
      return `
      <div class="sub-row" style="align-items:flex-start">
        <div style="flex:1;min-width:0">
          <div style="font-size:13.5px;font-weight:500;color:var(--text1)">${_esc(it.chapter)}</div>
          <div style="font-size:11px;color:var(--text3)">${_dFmt(it.date)} · ส่งเมื่อ ${_esc(it.submittedAt)}${it.gid?' · 📄 จาก PDF':''}${it.noteCount?' · 📝 '+it.noteCount+' รูป':''}</div>
          ${it.note ? `<div style="font-size:11.5px;color:var(--red);margin-top:3px">ครูบอกว่า: ${_esc(it.note)}</div>` : ''}
          ${acts}
        </div>
        <div style="font-family:var(--font-num,inherit);font-size:14px;font-weight:600;min-width:52px;text-align:right">${_subListScore(it)}</div>
        <div>${badge(it.status)}</div>
      </div>`;
    }).join('');
  }catch(e){
    box.innerHTML = '<div style="font-size:13px;color:var(--red)">เชื่อมต่อไม่ได้</div>';
  }
}


/* ★ 30 ส.ค. 69 — ดึงของที่เคยส่งกลับมาแก้ แล้วส่งทับของเดิม
   (ฝั่งเซิร์ฟเวอร์ submitMyScore เขียนทับแถวเดิมอยู่แล้วถ้าบทเดียวกันและยังไม่อนุมัติ) */
function subEditItem(pid){
  const it=(window.__subItems||[]).find(x=>String(x.pid)===String(pid));
  const st=document.getElementById('subStatus');
  if(!it){ if(st){st.className='status err'; st.textContent='ไม่พบรายการนี้ ลองรีเฟรชหน้าครับ';} return; }

  subState.st=(it.statuses||[]).slice(0,30);
  while(subState.st.length<30) subState.st.push('');

  const sel=document.getElementById('subChapter');
  if(sel){
    if(![...sel.options].some(o=>o.value===it.chapter)){
      const o=document.createElement('option'); o.value=it.chapter; o.textContent=it.chapter; sel.appendChild(o);
    }
    sel.value=it.chapter;
  }
  const dt=document.getElementById('subDate');
  if(dt&&it.date){ const d=_dParse(it.date);
    if(d) dt.value=d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2); }
  const nt=document.getElementById('subNote'); if(nt) nt.value='';

  subRender();
  if(st){ st.className='status'; st.textContent = it.status==='approved'
      ? 'ดึงคะแนนที่ครูอนุมัติแล้วของบท "'+it.chapter+'" มา — แก้ข้อที่ต้องการแล้วกดส่ง จะเป็น "คำขอแก้คะแนน" ครูต้องยืนยันก่อน'
      : 'ดึงคำตอบเดิมของบท "'+it.chapter+'" กลับมาแล้ว — แก้ข้อที่ต้องการ แล้วกด "ส่งให้ครูตรวจ" อีกครั้ง จะทับของเดิมให้เอง'; }
  const grid=document.getElementById('subGrid'); if(grid&&grid.scrollIntoView) grid.scrollIntoView({behavior:'smooth',block:'center'});
}

/* ยกเลิกการส่ง — ถอนออกจากรายการรอตรวจของครู */
async function subCancelItem(pid){
  const it=(window.__subItems||[]).find(x=>String(x.pid)===String(pid));
  const st=document.getElementById('subStatus');
  if(!it) return;
  if(!confirm('ยกเลิกการส่งคะแนนบท "'+it.chapter+'" ?\n\nรายการนี้จะหายจากรายการรอตรวจของครู\nถ้าต้องการส่งใหม่ ต้องกรอกใหม่ทั้ง 30 ข้อ')) return;
  if(st){ st.className='status'; st.textContent='กำลังยกเลิก...'; }
  try{
    const j=await subPost({action:'cancelMyScore', pid:it.pid});
    if(j&&j.ok){
      if(st){ st.className='status ok'; st.textContent='ยกเลิกการส่งบท "'+it.chapter+'" แล้วครับ'; }
      subLoadList();
    }else{
      if(st){ st.className='status err'; st.textContent=(j&&j.error)||'ยกเลิกไม่สำเร็จ'; }
    }
  }catch(e){ if(st){ st.className='status err'; st.textContent='เชื่อมต่อไม่ได้: '+e.message; } }
}

/* ── โหมดวางจาก Gemini (หน้า p8) ─────────────────────────────────
   ต่างจากหน้าครูตรงที่นักเรียนกรอกของตัวเองคนเดียว จึงไม่ต้องอ่านชื่อ/บท
   อ่านแค่ "ข้อ N: สถานะ" แล้วเติมลงตาราง — ไม่ส่งทันที ให้ตรวจก่อน
   ล็อก 30 ช่องตายตัว ข้อไหน Gemini ข้ามไปก็เว้นว่าง ไม่เลื่อนขึ้นมาแทนที่ */
function subSetMode(m){
  document.getElementById('subTabTap').classList.toggle('active', m==='tap');
  document.getElementById('subTabPaste').classList.toggle('active', m==='paste');
  document.getElementById('subPastePane').style.display = (m==='paste') ? '' : 'none';
}

function subStatusOf(raw){
  const s = String(raw||'').trim();
  if(!s || /^[-–—.\s]+$/.test(s)) return '';
  if(s.indexOf('✅')>=0 || s.indexOf('ถูก')>=0) return '✅ ถูก';
  if(s.indexOf('⚠')>=0 || s.indexOf('สะเพร่า')>=0) return '⚠️ สะเพร่า';
  if(s.indexOf('⏰')>=0 || s.indexOf('ไม่ทัน')>=0) return '⏰ ไม่ทัน';
  if(s.indexOf('C')>=0 || s.indexOf('คอนเซปต์')>=0) return 'C คอนเซปต์';
  if(s.indexOf('X')>=0 || s.indexOf('❌')>=0 || s.indexOf('ทำไม่ได้')>=0 || s.indexOf('ผิด')>=0) return 'X ทำไม่ได้';
  return '⏰ ไม่ทัน';
}

function subParsePaste(){
  const box = document.getElementById('subPasteBox');
  const msg = document.getElementById('subPasteMsg');
  const raw = (box.value||'').trim();
  if(!raw){ msg.style.color='var(--red)'; msg.textContent='ยังไม่ได้วางข้อความ'; return; }

  const st = new Array(30).fill('');
  const re = /ข้อ\s*(\d+)\s*:\s*([^ข\d\n]*)/g;
  let m, found = 0;
  while((m = re.exec(raw)) !== null){
    const q = parseInt(m[1],10);
    if(q>=1 && q<=30){ st[q-1] = subStatusOf(m[2]); found++; }
  }
  if(!found){
    msg.style.color='var(--red)';
    msg.textContent='อ่านไม่เจอเลย — ข้อความต้องอยู่ในรูป "ข้อ 1: ✅"';
    return;
  }
  subState.st = st;
  subRender();
  const n = subCounts();
  msg.style.color='var(--green)';
  const _wP = subWeighted((document.getElementById('subChapter')||{}).value || '', subState.st);
  msg.textContent = `อ่านได้ ${found} ข้อ · `
    + (_wP ? `ได้ ${_wP.score}/${_wP.full} คะแนน (ทำถูก ${n.ok}/30 ข้อ)` : `ทำถูก ${n.ok}/30 ข้อ`)
    + (n.blank ? ` · ยังไม่ระบุ ${n.blank} ข้อ` : '');
  subSetMode('tap');
}
/* ═══ 📐 คะแนนคาดหวัง & ส่วนผสมความยากของชุดสอบ (19 ก.ย. 69) ═══
   ตัวเลขทั้งหมดมาจาก mockStats() ใน questionbank.js — คำนวณสดจากผังข้อสอบ
   ถ้าโหลด questionbank.js เวอร์ชันเก่าที่ยังไม่มีฟังก์ชันนี้ การ์ดจะไม่ขึ้น (ไม่พัง) */

/* ผลรายข้อของชุดนั้น → {q: 'ok'|'care'|...} จาก myLongAll */
function _mockQStatus(d, h){
  var out = {};
  (d.myLongAll||[]).forEach(function(r){
    if((r[3]||'') !== h.topic || (r[2]||'') !== h.date) return;
    var q = parseInt(r[4],10); if(!q) return;
    out[q] = parseStatus(r[5]||'');
  });
  return out;
}

/* บรรทัดสรุปใต้กราฟสนามสอบ — ชุดล่าสุดยากกว่าหรือง่ายกว่ามาตรฐานแค่ไหน */
function mockExpectLineHTML(h){
  if(typeof mockStats !== 'function') return '';
  var s = mockStats(h && h.topic); if(!s) return '';
  var dlt  = h.score - s.expect;
  var tone = dlt >= 5 ? '#3B7D2A' : (dlt <= -5 ? '#B3261E' : 'var(--text2)');
  var word = dlt >= 5 ? 'สูงกว่ามาตรฐานของชุดนี้ ' + dlt + ' คะแนน'
           : (dlt <= -5 ? 'ต่ำกว่ามาตรฐานของชุดนี้ ' + (-dlt) + ' คะแนน'
           : 'ใกล้เคียงมาตรฐานของชุดนี้ (' + (dlt >= 0 ? '+' : '') + dlt + ')');
  return '<div class="d-card" style="padding:.8rem 1rem">'
    + '<div style="font-size:12.5px;color:var(--text1);line-height:1.8">'
    +   '📐 <b>' + s.set + '</b> — คะแนนที่ควรคาดหวังของชุดนี้ '
    +   '<b style="font-family:var(--font-num,inherit)">≈ ' + s.expect + '</b> / ' + s.full
    +   ' · ผลของคุณ <b>' + h.score + '</b> → <span style="color:' + tone + ';font-weight:600">' + word + '</span></div>'
    + '<div style="font-size:11px;color:var(--text3);margin-top:6px;line-height:1.7">'
    +   'คิดจากระดับความยากรายข้อของชุดนี้ (ง่าย ' + s.grades.easy.n + ' · กลาง ' + s.grades.mid.n
    +   ' · ยาก ' + s.grades.hard.n + ' ข้อ) เทียบกับสถิติที่นักเรียนรุ่นก่อนทำได้จริงในข้อระดับเดียวกัน '
    +   '— ไม่ใช่เป้าหมาย แต่เป็น "จุดที่ปกติแล้วควรได้" ของชุดนี้ · เป้าหมายตั้งเองได้ที่แถบข้างล่าง</div>'
    + '</div>';
}

/* การ์ดแจกแจง ง่าย/กลาง/ยาก + เก็บได้จริงกี่คะแนนในแต่ละระดับ */
function mockDiffCardHTML(d, h){
  if(typeof mockStats !== 'function') return '';
  var s = mockStats(h && h.topic); if(!s) return '';
  var st = _mockQStatus(d, h);
  var COL = { easy:'#4C9A2A', mid:'#D4A72C', hard:'#A32D2D' };
  var NAME= { easy:'ง่าย', mid:'ปานกลาง', hard:'ยาก' };
  var TAIL= { easy:'ข้อที่ต้องเก็บให้ได้', mid:'ต้องใช้ความพยายาม', hard:'วัดความสามารถจริง' };
  var rows = '', bars = '', got = { easy:0, mid:0, hard:0 }, have = Object.keys(st).length > 0;

  ['easy','mid','hard'].forEach(function(g){
    s.grades[g].qs.forEach(function(q){
      if(st[q] === 'ok') got[g] += (typeof ptsOfQuestion === 'function' ? ptsOfQuestion(s.set, q) : 0);
    });
    var w = Math.round(s.grades[g].pts / s.full * 100);
    bars += '<div style="width:' + w + '%;background:' + COL[g] + ';height:100%"></div>';
    var pct = s.grades[g].pts ? Math.round(got[g] / s.grades[g].pts * 100) : 0;
    rows += '<div class="rev-row">'
      + '<div style="min-width:74px;font-size:12.5px;color:' + COL[g] + ';font-weight:600">' + NAME[g] + '</div>'
      + '<div style="flex:1"><div style="font-size:12px;color:var(--text2)">' + s.grades[g].n + ' ข้อ · '
      +   s.grades[g].pts + ' คะแนน <span style="color:var(--text3)">· ' + TAIL[g] + '</span></div>'
      + '<div style="font-size:10.5px;color:var(--text3)">ข้อ ' + s.grades[g].qs.join(', ') + '</div></div>'
      + (have ? '<div style="min-width:74px;text-align:right;font-size:12.5px;font-weight:600">'
          + got[g] + '/' + s.grades[g].pts + '<div style="font-size:10.5px;color:var(--text3);font-weight:400">'
          + pct + '%</div></div>' : '')
      + '</div>';
  });

  var tip = '';
  if(have){
    var lost = s.grades.easy.pts - got.easy;
    tip = lost >= 6
      ? '<b style="color:#B3261E">เสียไป ' + lost + ' คะแนนในข้อง่าย</b> — ตรงนี้ได้คืนง่ายที่สุด เก็บก่อนไปไล่ข้อยาก'
      : (got.hard > 0 ? 'เก็บข้อยากได้ ' + got.hard + ' คะแนน — ข้อง่ายก็เก็บได้ดี รักษาไว้แบบนี้'
                      : 'ข้อง่ายเก็บได้ดีแล้ว ขั้นต่อไปคือไล่เก็บข้อปานกลางให้มากขึ้น');
  }

  return '<div class="d-card" style="padding:1rem">'
    + '<div class="slabel">🧱 ส่วนผสมความยาก — ' + s.set + '</div>'
    + '<div style="font-size:11.5px;color:var(--text2);margin-bottom:10px;line-height:1.6">'
    +   'แบ่งจากระดับความยากที่ให้ไว้รายข้อ · แถบกว้างตาม<b>คะแนน</b> ไม่ใช่จำนวนข้อ'
    +   (have ? ' · ตัวเลขขวาสุดคือที่คุณเก็บได้จริงในชุดนี้' : '') + '</div>'
    + '<div style="display:flex;height:12px;border-radius:6px;overflow:hidden;margin-bottom:12px">' + bars + '</div>'
    + rows
    + (tip ? '<div style="font-size:12px;color:var(--text2);margin-top:10px;padding-top:9px;'
        + 'border-top:1px solid rgba(128,128,128,.15);line-height:1.7">' + tip + '</div>' : '')
    + '<div style="font-size:11px;color:var(--text3);margin-top:8px;line-height:1.7">'
    +   'ผังชุดนี้เทียบกับข้อสอบจริง: ' + s.areas.map(function(a){
          return a.name + ' ' + a.count + (a.ok ? '' : ' ⚠️');
        }).join(' · ') + '<br>อ้างอิง ' + s.source + '</div>'
    + '</div>';
}

/* ═══ 📋 ผังรายข้อของชุดสอบ + ผังที่ครูแก้เอง (19 ก.ย. 69) ═══
   ครูแก้ บท/หมวด/ระดับ จากหน้าครู → เก็บในชีต qb_map → หน้านี้ดึงมาทับคลังตอนเปิดแท็บพัฒนาการ
   ยิงครั้งเดียวต่อการล็อกอิน · ล้มเหลวก็ใช้ค่าจากไฟล์คลังตามเดิม ไม่บล็อกการวาด */
let _qbMapTried = false;
function qbMapEnsure(){
  if(_qbMapTried) return;
  _qbMapTried = true;
  if(typeof applyQBMap !== 'function') return;          /* คลังเวอร์ชันเก่า — ข้ามไป ไม่พัง */
  _proxyPost({ action:'listQBMap' }).then(r => {
    if(!r || !r.ok || !Array.isArray(r.rows) || !r.rows.length) return;
    const n = applyQBMap(r.rows);
    if(n && dashData){ try{ renderProgressTrend(dashData); }catch(e){ console.error('qbmap rerender', e); } }
  }).catch(()=>{});
}

/* การ์ดผังรายข้อของชุดที่นักเรียนเพิ่งสอบ — กางดูได้ ปิดไว้ก่อนเพื่อไม่ให้หน้ายาวเกิน */
let _planShown = {};
function mockPlanCardHTML(d, h){
  if(typeof mockPlan !== 'function') return '';
  const plan = mockPlan(h && h.topic); if(!plan.length) return '';
  const st = _mockQStatus(d, h);
  const open = !!_planShown[h.topic];
  const LABEL = { ok:['✅','ทำถูก','#4C9A2A'], care:['⚠️','สะเพร่า','#D4A72C'], concept:['C','คอนเซปต์','#F5A623'],
                  cant:['❌','ทำไม่ได้','#ef4444'], timeout:['⏰','ไม่ทัน','#a855f7'] };
  const GRADE = { easy:['ง่าย','#4C9A2A'], mid:['กลาง','#D4A72C'], hard:['ยาก','#A32D2D'] };

  const rows = plan.map(it => {
    const s = st[it.q], lb = LABEL[s] || ['–','ยังไม่ระบุ','var(--text3)'];
    const g = GRADE[it.grade] || ['—','var(--text3)'];
    return '<div class="rev-row" style="align-items:flex-start">'
      + '<div style="min-width:30px;font-size:12px;color:var(--text3);font-family:var(--font-num,inherit)">' + it.q + '</div>'
      + '<div style="min-width:26px;font-size:13px" title="' + lb[1] + '">' + lb[0] + '</div>'
      + '<div style="flex:1"><div style="font-size:12.5px;color:var(--text1)">' + it.ch + '</div>'
      +   '<div style="font-size:11px;color:var(--text3)">' + it.sub + '</div></div>'
      + '<div style="min-width:52px;text-align:right;font-size:11.5px;color:' + g[1] + '">' + g[0] + '</div>'
      + '<div style="min-width:40px;text-align:right;font-size:11px;color:var(--text3)">' + it.pts + ' คะแนน</div>'
      + '</div>';
  }).join('');

  return '<div class="d-card" style="padding:1rem">'
    + '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
    +   '<span class="slabel" style="margin:0">📋 ข้อนี้เป็นเนื้อหาบทอะไร — ' + h.topic + '</span>'
    +   '<button class="btn btn--sm btn--ghost" style="margin-left:auto;font-size:11.5px;padding:4px 12px"'
    +     ' onclick="mockPlanToggle(\'' + h.topic + '\')">' + (open ? 'ซ่อนรายข้อ' : 'ดูรายข้อทั้ง 30') + '</button>'
    + '</div>'
    + '<div style="font-size:11.5px;color:var(--text2);margin-top:6px;line-height:1.7">'
    +   'ดูว่าข้อที่พลาดไปอยู่บทไหน หมวดไหน และเป็นข้อระดับไหน — ใช้เลือกว่าจะกลับไปทบทวนบทอะไรก่อน</div>'
    + (open ? '<div style="margin-top:10px">' + rows + '</div>' : '')
    + '</div>';
}
function mockPlanToggle(topic){
  _planShown[topic] = !_planShown[topic];
  if(dashData){ try{ renderProgressTrend(dashData); }catch(e){ console.error('plan toggle', e); } }
}

/* ═══════════════════════════════════════════════════════════════════
   ★ 24 ก.ย. 69 — 📄 ใบตรวจจากครู (หน้า Student Dashboard)

   ครูอ่าน PDF ใบตรวจเข้าระบบแล้ว (gradeSave) → คะแนนอยู่ใน results แล้ว
   การ์ดนี้ให้นักเรียน:
     · เติมข้อที่ว่าง (ข้อที่ยังไม่ได้ส่งตรวจ) เป็น ⚠️ / C / X / ⏰
     · แก้ข้อที่ครูให้ไว้ถ้าไม่กระทบคะแนน เช่น C → ⚠️ (ครูเข้าใจผิดว่าผิดคอนเซปต์)
     · อะไรที่เข้า/ออกจาก ✅ ส่งเป็น "คำขอ" รอครูกดยอมรับ
     · ดูภาพโน้ตที่ครูวงไว้ในแต่ละข้อ
   เซิร์ฟเวอร์ตัดสินกติกาทั้งหมด (gradeFill) หน้าเว็บแค่บอกล่วงหน้าให้เข้าใจ
   วางการ์ดไว้ใต้ #s-encourage (สร้าง element เองตอนรัน — ไม่ต้องแก้ index.html)
   ═══════════════════════════════════════════════════════════════════ */
const GRD_STATES = [
  { c:'W', short:'⚠️', label:'สะเพร่า',  bg:'#FDE910', fg:'#5C3A00' },
  { c:'C', short:'C',  label:'คอนเซปต์', bg:'#F5A623', fg:'#fff' },
  { c:'X', short:'X',  label:'ทำไม่ได้', bg:'#D93025', fg:'#fff' },
  { c:'T', short:'⏰', label:'ไม่ทัน',   bg:'#a855f7', fg:'#fff' },
  { c:'O', short:'✓',  label:'ถูก (ต้องรอครู)', bg:'#4C9A2A', fg:'#fff' }
];
const GRD_OF = { O:GRD_STATES[4], W:GRD_STATES[0], C:GRD_STATES[1], X:GRD_STATES[2], T:GRD_STATES[3] };
const GRD = { items:null, notesOn:false, at:0, who:'', open:'', brush:'W', draft:{}, why:'', busy:false,
              msg:'', msgErr:false, notes:{}, notesOpen:'', showAll:false, loading:false };

function grdHost(){
  let el = document.getElementById('s-graded');
  if(el) return el;
  const anchor = document.getElementById('s-encourage');
  if(!anchor || !anchor.parentNode) return null;
  el = document.createElement('div');
  el.id = 's-graded';
  el.style.cssText = 'margin:10px 0 12px';
  anchor.parentNode.insertBefore(el, anchor.nextSibling);
  return el;
}

function grdFmtDate(s){
  const m = String(s||'').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if(!m) return _esc(String(s||''));
  const th = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  return (+m[2]) + ' ' + th[(+m[1])-1] + ' ' + String(+m[3]+543).slice(-2);
}

/* เรียกทุกครั้งที่วาดหน้านักเรียน — วาดจากของที่มีทันที แล้วดึงใหม่ถ้าเก่ากว่า 60 วิ */
function gradedEnsure(force){
  if(!currentStudent || !currentPin) return;
  if(GRD.who !== currentStudent){ Object.assign(GRD, { items:null, at:0, who:currentStudent, open:'', draft:{}, notes:{}, msg:'' }); }
  grdPaint();
  if(force || (!GRD.loading && Date.now() - GRD.at > 60000)) gradedRefresh();
}

async function gradedRefresh(){
  if(GRD.loading) return;
  GRD.loading = true;
  try{
    const j = await subPost({ action:'myGraded' });
    if(j && j.ok){ GRD.items = j.items || []; GRD.notesOn = !!j.notesOn; GRD.at = Date.now(); }
    else if(GRD.items === null){ GRD.items = []; }
  }catch(e){ if(GRD.items === null) GRD.items = []; }
  GRD.loading = false;
  grdPaint();
}

function grdItem(gid){ return (GRD.items||[]).find(x => x.gid === gid); }

/* สถานะที่จะแสดงของข้อ q (0-based) = ร่างที่เพิ่งแตะ > ของจริง */
function grdShown(it, q){
  const d = GRD.open === it.gid ? GRD.draft[q+1] : undefined;
  return d !== undefined ? d : (it.final[q] || '');
}

/* บอกล่วงหน้าว่าการแก้ข้อนี้จะเป็นแบบไหน (เซิร์ฟเวอร์ตัดสินจริงอีกชั้น) */
function grdKind(it, q, to){
  const from = it.final[q-1] || '';
  if(to === from) return 'same';
  if(!from && to === 'O') return 'no';
  if(from === 'O' || to === 'O') return 'req';
  return 'direct';
}

function grdCell(it, q){
  const c = grdShown(it, q);
  const st = GRD_OF[c];
  const teacher = it.teacher[q] || '';
  const draft = GRD.open === it.gid && GRD.draft[q+1] !== undefined;
  const req = it.requests && it.requests[q+1];
  const hasNote = (it.notes||[]).some(n => (n.qs||[]).indexOf(q+1) !== -1);
  const editable = GRD.open === it.gid && it.state !== 'locked';
  const border = draft ? '3px solid var(--text1)' : req ? '3px solid #7C3AED' : (!c ? '2px dashed #f59e0b' : '1px solid var(--border-md)');
  const tag = draft ? '' : req ? '<span style="position:absolute;bottom:1px;left:0;right:0;font-size:8px;color:#7C3AED;font-weight:700">รอครู</span>'
            : (teacher && c !== teacher) ? '<span style="position:absolute;bottom:1px;left:0;right:0;font-size:8px;opacity:.85">ครู:' + (GRD_OF[teacher]||{short:'?'}).short + '</span>' : '';
  return `<button class="grd-cell" data-q="${q+1}" data-code="${c}" ${editable?`onclick="grdTap('${it.gid}',${q+1})"`:'disabled'}
    style="position:relative;aspect-ratio:1;min-height:38px;border-radius:9px;border:${border};padding:0;
           background:${c?st.bg:'var(--card)'};color:${c?st.fg:'var(--text3)'};font-weight:700;font-size:12px;
           display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.1;cursor:${editable?'pointer':'default'}">
    <span style="font-size:9px;opacity:.75">${q+1}</span><span>${c?st.short:'เติม'}</span>${tag}
    ${hasNote?'<span style="position:absolute;top:0;right:2px;font-size:9px">📝</span>':''}
  </button>`;
}

function grdItemHtml(it){
  const open = GRD.open === it.gid;
  const chips = [];
  if(it.needFill) chips.push(`<span style="background:#FEF3C7;color:#92400E;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700">ต้องเติม ${it.needFill} ข้อ</span>`);
  if(it.reqCount) chips.push(`<span style="background:#EDE9FE;color:#5B21B6;padding:2px 8px;border-radius:999px;font-size:11px">รอครู ${it.reqCount} ข้อ</span>`);
  if(it.state === 'locked') chips.push(`<span style="font-size:11px;color:var(--text3)">🔒 ครูล็อกแล้ว</span>`);
  if(GRD.notesOn && (it.notes||[]).length) chips.push(`<span style="font-size:11px;color:var(--text2)">📝 ${(it.notes||[]).length}</span>`);
  let body = '';
  if(open){
    const nDraft = Object.keys(GRD.draft).length;
    const touchTeacher = Object.keys(GRD.draft).some(q => it.teacher[q-1]);
    const needWhy = Object.keys(GRD.draft).some(q => grdKind(it, +q, GRD.draft[q]) === 'req');
    body = `
      <div style="font-size:11.5px;color:var(--text2);line-height:1.6;margin:8px 0">
        ${it.state === 'locked' ? 'ครูล็อกใบนี้แล้ว — ดูได้อย่างเดียว ถ้าต้องแก้ แจ้งครูครับ' :
        'เลือกสัญลักษณ์ แล้วแตะข้อ · <b>แตะซ้ำที่ข้อเดิม = เปลี่ยนเป็นสัญลักษณ์ถัดไป</b> · <b>ขอบส้มประ = ยังไม่ได้ส่งตรวจ</b> ให้เติมเอง<br>' +
        'ข้อที่ครูให้ไว้ แก้ได้ถ้าไม่เกี่ยวกับ ✓ (เช่น C → ⚠️ มีผลทันที) · ถ้าเกี่ยวกับ ✓ จะส่งเป็นคำขอให้ครูตัดสิน'}
      </div>
      ${it.state === 'locked' ? '' : `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
        ${GRD_STATES.map(s => `<button onclick="GRD.brush='${s.c}';grdPaint()" style="padding:6px 10px;border-radius:9px;font-size:12px;font-weight:600;
          background:${s.bg};color:${s.fg};border:2px solid ${GRD.brush===s.c?'var(--text1)':'transparent'}">${s.short} ${s.label}</button>`).join('')}
      </div>`}
      <div style="display:grid;grid-template-columns:repeat(10,1fr);gap:4px">${it.final.map((c,q)=>grdCell(it,q)).join('')}</div>
      ${nDraft ? `<div style="margin-top:10px">
        ${touchTeacher || needWhy ? `<input id="grdWhy" value="${_esc(GRD.why)}" oninput="GRD.why=this.value" maxlength="200"
          placeholder="เหตุผลที่แก้ (ครูจะเห็น) เช่น อ่านโจทย์ผิด" style="width:100%;box-sizing:border-box;padding:9px 11px;border-radius:9px;border:1px solid var(--border-md);font:inherit;margin-bottom:8px">` : ''}
        <div style="display:flex;gap:8px">
          <button onclick="grdSend('${it.gid}')" ${GRD.busy?'disabled':''} style="flex:1;padding:10px;border-radius:10px;border:0;background:var(--blue,#185FA5);color:#fff;font-weight:700;font:inherit">
            ${GRD.busy?'กำลังส่ง…':'ส่ง ' + nDraft + ' ข้อ'}</button>
          <button onclick="GRD.draft={};GRD.msg='';grdPaint()" style="padding:10px 14px;border-radius:10px;border:1px solid var(--border-md);background:var(--card);font:inherit">ยกเลิก</button>
        </div></div>` : ''}
      ${GRD.msg ? `<div class="grd-msg" style="margin-top:8px;font-size:12px;color:${GRD.msgErr?'#D93025':'#2E7D32'};line-height:1.6">${GRD.msg}</div>` : ''}
      ${grdReqList(it)}
      ${grdNotesHtml(it)}`;
  }
  return `<div class="grd-item" data-gid="${it.gid}" style="border:1px solid var(--border-md);border-radius:12px;padding:10px 12px;margin-top:8px;background:var(--card)">
    <div onclick="grdToggle('${it.gid}')" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;cursor:pointer">
      <b style="font-size:13px">${_esc(it.chapter)}</b><span style="font-size:11.5px;color:var(--text3)">${grdFmtDate(it.date)}</span>
      ${chips.join('')}<span style="margin-left:auto;font-size:12px;color:var(--text3)">${open?'▲':'▼'}</span>
    </div>${body}</div>`;
}

function grdReqList(it){
  const qs = Object.keys(it.requests||{}).map(Number).sort((a,b)=>a-b);
  if(!qs.length) return '';
  return `<div style="margin-top:8px;font-size:11.5px;color:#5B21B6;line-height:1.7">รอครูตัดสิน: ` +
    qs.map(q => `ข้อ ${q} → ${(GRD_OF[it.requests[q].to]||{short:'?'}).short}`).join(' · ') + `</div>`;
}

function grdNotesHtml(it){
  if(!GRD.notesOn || !(it.notes||[]).length) return '';
  const got = GRD.notes[it.gid];
  if(!got) return `<button onclick="grdLoadNotes('${it.gid}')" style="margin-top:10px;padding:8px 12px;border-radius:9px;border:1px solid var(--border-md);background:var(--card);font:inherit;font-size:12.5px">📝 ดูโน้ตที่ครูเขียน (${it.notes.length})</button>`;
  if(got.loading) return `<div style="margin-top:10px;font-size:12px;color:var(--text3)">กำลังโหลดโน้ต…</div>`;
  if(got.error) return `<div style="margin-top:10px;font-size:12px;color:#D93025">โหลดโน้ตไม่ได้: ${_esc(got.error)} <a href="#" onclick="delete GRD.notes['${it.gid}'];grdPaint();return false">ลองใหม่</a></div>`;
  return `<div style="margin-top:10px">${(got.list||[]).map(n => `
    <div class="grd-note" style="margin-top:8px"><div style="font-size:12px;font-weight:700;margin-bottom:4px">📝 ข้อ ${(n.qs||[]).join(', ')}</div>
      <img src="data:image/jpeg;base64,${n.data}" style="max-width:100%;border-radius:8px;border:1px solid var(--border-md)"></div>`).join('')}</div>`;
}

async function grdLoadNotes(gid){
  GRD.notes[gid] = { loading:true };
  grdPaint();
  try{
    const j = await subPost({ action:'gradeNotes', gid:gid });
    GRD.notes[gid] = (j && j.ok) ? { list: j.notes || [] } : { error: (j && j.error) || 'ลองใหม่อีกครั้ง' };
    if(j && j.notesOff){ GRD.notesOn = false; }
  }catch(e){ GRD.notes[gid] = { error: String(e && e.message || e) }; }
  grdPaint();
}

function grdToggle(gid){
  GRD.open = GRD.open === gid ? '' : gid;
  GRD.draft = {}; GRD.why = ''; GRD.msg = '';
  grdPaint();
}

/* แตะข้อ:
   · แตะครั้งแรก = ใส่สัญลักษณ์ที่เลือกไว้ด้านบน
   · ★ 25 ก.ย. 69 — แตะซ้ำที่ข้อเดิม = วนเป็นสัญลักษณ์ถัดไป (ไม่ต้องขึ้นไปกดปุ่มด้านบน)
     ข้อที่ยังไม่ได้ส่งตรวจ: ⚠️ → C → X → ⏰ → ว่าง (ไม่มี ✓ เพราะเลือกเองไม่ได้)
     ข้อที่ครูให้ไว้:        ⚠️ → C → X → ⏰ → ✓ → ⚠️ … (วนกลับมาที่ค่าของครู = ยกเลิกการแก้ข้อนั้น) */
const GRD_CYCLE_BLANK = ['', 'W', 'C', 'X', 'T'];
const GRD_CYCLE_GRADED = ['W', 'C', 'X', 'T', 'O'];
function grdTap(gid, q){
  const it = grdItem(gid);
  if(!it || it.state === 'locked' || GRD.busy) return;
  const from = it.final[q-1] || '';
  let to;
  if(GRD.draft[q] === undefined && GRD.brush !== from){
    to = GRD.brush;                                   /* แตะครั้งแรก */
  }else{
    const cyc = from ? GRD_CYCLE_GRADED : GRD_CYCLE_BLANK;
    const cur = GRD.draft[q] !== undefined ? GRD.draft[q] : from;
    const i = cyc.indexOf(cur);
    to = cyc[(i + 1) % cyc.length];                   /* แตะซ้ำ = ถัดไป */
  }
  if(grdKind(it, q, to) === 'no'){ GRD.msg = 'ข้อ ' + q + ' ยังไม่ได้ส่งตรวจ เลือก ✓ เองไม่ได้ครับ — ส่งงานให้ครูตรวจก่อน'; GRD.msgErr = true; grdPaint(); return; }
  if(to === from) delete GRD.draft[q];                /* วนกลับมาที่ค่าเดิม = ไม่แก้ข้อนี้ */
  else GRD.draft[q] = to;
  GRD.msg = '';
  grdPaint();
}

async function grdSend(gid){
  const it = grdItem(gid);
  if(!it || GRD.busy) return;
  const changes = Object.keys(GRD.draft).map(q => ({ q:+q, to:GRD.draft[q], why:GRD.why.trim() }));
  if(!changes.length) return;
  if(changes.some(c => grdKind(it, c.q, c.to) === 'req') && !GRD.why.trim()){
    GRD.msg = 'ข้อที่เกี่ยวกับ ✓ ต้องใส่เหตุผลให้ครูก่อนครับ'; GRD.msgErr = true; grdPaint(); return;
  }
  GRD.busy = true; GRD.msg = ''; grdPaint();
  let j = null;
  try{ j = await subPost({ action:'gradeFill', gid:gid, changes:changes }); }
  catch(e){ j = { ok:false, error:String(e && e.message || e) }; }
  GRD.busy = false;
  if(j && j.ok){
    const parts = [];
    if((j.applied||[]).length) parts.push('✓ บันทึกแล้ว ' + j.applied.length + ' ข้อ');
    if((j.requested||[]).length) parts.push('📨 ส่งคำขอให้ครู ' + j.requested.length + ' ข้อ (ข้อ ' + j.requested.join(', ') + ')');
    if((j.rejected||[]).length) parts.push('✗ ไม่ผ่าน ' + j.rejected.map(r => 'ข้อ ' + r.q + ': ' + _esc(r.why)).join(' · '));
    GRD.msg = parts.join('<br>') || 'ไม่มีอะไรเปลี่ยน'; GRD.msgErr = false;
    GRD.draft = {}; GRD.why = '';
    await gradedRefresh();
    if((j.applied||[]).length){
      /* สถานะรายข้อเปลี่ยน → การ์ดจุดต้องแก้/แผนทบทวนต้องคิดใหม่ */
      try{ await fetchDashData(); if(dashData) renderStudentDash(dashData); }catch(e){}
    }
  }else{
    GRD.msg = 'ส่งไม่สำเร็จ: ' + _esc((j && j.error) || 'ลองใหม่อีกครั้ง'); GRD.msgErr = true;
    if(j && j.locked) await gradedRefresh();
  }
  grdPaint();
}

function grdPaint(){
  const el = grdHost();
  if(!el) return;
  const items = GRD.items;
  if(!items || !items.length){ el.innerHTML = ''; el.style.display = 'none'; return; }
  el.style.display = '';
  const need = items.reduce((s,x) => s + (x.needFill||0), 0);
  const needSheets = items.filter(x => x.needFill).length;
  const shown = GRD.showAll ? items : items.slice(0, 4);
  el.innerHTML = `<div class="d-card" style="padding:12px 14px">
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      <b style="font-size:14px">📄 ใบตรวจจากครู</b>
      ${need ? `<span style="font-size:12px;color:#B45309;font-weight:700">ต้องเติม ${need} ข้อ ใน ${needSheets} ใบ</span>` : '<span style="font-size:12px;color:var(--text3)">เติมครบแล้ว</span>'}
    </div>
    ${shown.map(grdItemHtml).join('')}
    ${items.length > 4 ? `<button onclick="GRD.showAll=!GRD.showAll;grdPaint()" style="margin-top:8px;background:none;border:0;color:var(--text2);font:inherit;font-size:12px;cursor:pointer">${GRD.showAll?'ย่อ':'ดูทั้งหมด ' + items.length + ' ใบ'}</button>` : ''}
  </div>`;
}

/* ═══════════════════════════════════════════════════════════════════
   ★ 25 ก.ย. 69 — ผลสอบที่ยังกรอกไม่ครบ 30 ข้อ (เช่น ใบตรวจที่นักเรียนยังไม่เติม)
   นับช่องว่างในคำตอบรายข้อ · ถ้าว่างทั้ง 30 ช่อง = แถวรุ่นเก่าที่มีแต่ตัวเลขคะแนน → ไม่นับว่าไม่ครบ
   ═══════════════════════════════════════════════════════════════════ */
function _unfilledOf(row){
  const st = (row || []).slice(6, 36);
  let filled = 0;
  for(let i = 0; i < 30; i++) if(String(st[i] == null ? '' : st[i]).trim()) filled++;
  return filled ? 30 - filled : 0;
}

function paintUnfilledStudent(d){
  const el = document.getElementById('s-scorepct');
  if(!el || !d || !d.unfilled) return;
  el.insertAdjacentHTML('beforeend',
    '<div class="unfilled-badge" style="margin-top:6px;display:inline-block;padding:3px 9px;border-radius:999px;background:#FEF3C7;color:#92400E;font-size:11px;font-weight:700;border:1px dashed #F59E0B">' +
    '⏳ ยังไม่ครบ 30 ข้อ — ว่าง ' + d.unfilled + ' ข้อ · คะแนนยังไม่สมบูรณ์</div>');
}

function paintUnfilledParent(d){
  const old = document.getElementById('p-unfilled');
  if(old) old.remove();
  if(!d || !d.unfilled) return;
  const host = document.getElementById('p-summary');
  if(!host || !host.parentNode) return;
  host.insertAdjacentHTML('beforebegin',
    '<div id="p-unfilled" style="margin:0 0 12px;padding:10px 14px;border-radius:12px;background:#FEF3C7;border:1.5px dashed #F59E0B;color:#92400E;font-size:13px;line-height:1.6">' +
    '<b>⏳ ผลสอบครั้งนี้ยังไม่สมบูรณ์</b> — ยังไม่ได้บันทึกผล ' + d.unfilled + ' ข้อจาก 30 ข้อ<br>' +
    '<span style="font-size:12px">คะแนนและคำแนะนำด้านล่างอาจเปลี่ยนเมื่อบันทึกครบ</span></div>');
}
/* ==SHEET_DETECT_BEGIN== ─────────────────────────────────────────────
   ★ 24 ก.ย. 69 — อ่านกระดาษคำตอบ PDF เองโดยไม่ใช้ AI
   ใช้กับแม่แบบกระดาษคำตอบของครู (หน้าละ 15 ข้อ · 5 ช่อง: ✅ ⚠️ C X ⏰ · ช่อง Photos/Notes)

   วิธีคิด: กระดาษทุกใบใช้แม่แบบเดียวกัน ช่องจึงอยู่ตำแหน่งเดิมเสมอ
     1. หาขอบกล่องสีเขียว (คอลัมน์ ✅) → ได้ตำแหน่ง 15 แถวจริงของหน้านั้น
        (หาไม่ครบ 15 → ใช้ตำแหน่งมาตรฐานของแม่แบบแทน และติดธง layoutGuess)
     2. นับ "จุดหมึก" ในแต่ละช่อง (ตัดขอบกล่องออก) — ช่องว่างได้ 0 จุด
     3. ช่องที่หมึกน้อยผิดปกติ หรือติ๊กสองช่องในแถวเดียว → unsure ให้ครูแตะแก้เอง ห้ามเดา
     4. ช่อง Notes: หาก้อนภาพ/ลายมือ แล้วบอกว่าคร่อมข้อไหนบ้าง
   ฟังก์ชันในบล็อกนี้ไม่แตะ DOM — รับ RGBA ล้วน ๆ เทสด้วย node ได้
   ─────────────────────────────────────────────────────────────────── */
const SHEET_CODES = ['O', 'W', 'C', 'X', 'T'];          /* ลำดับคอลัมน์บนกระดาษ */
/* ตำแหน่งอ้างอิงวัดจากแม่แบบจริง (หน้ากว้าง 1241 px ที่ 150 dpi) */
const SHEET_REF_W = 1241;
const SHEET_COL_OFF = [0, 88, 189.5, 295.5, 401.5];     /* ระยะจากกลางช่อง ✅ */
const SHEET_BOX_HALF = 20;                              /* ครึ่งกว้างของพื้นที่ในกล่องที่ใช้นับ */
const SHEET_MARK_MIN = 25;                              /* จุดหมึกขั้นต่ำ = ติ๊กแน่ ๆ */
const SHEET_WEAK_MIN = 8;                               /* ต่ำกว่านี้ = ฝุ่น/เงา */

function sheetIsInk(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  return mn < 170 && (mx - mn > 35 || mx < 110);
}
function sheetIsGreenLine(r, g, b) {
  return (g - r > 50) && (g - b > 30) && g < 200;
}

/* หาตำแหน่ง 15 กล่องในคอลัมน์ ✅ */
function sheetLayout(px, W, H) {
  const s = W / SHEET_REF_W;
  const x0 = Math.floor(W * 0.07), x1 = Math.floor(W * 0.2);
  const colCount = new Array(x1).fill(0);
  for (let y = 0; y < H; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * W + x) * 4;
      if (sheetIsGreenLine(px[i], px[i + 1], px[i + 2])) colCount[x]++;
    }
  }
  let xL = -1, xR = -1;
  const need = Math.max(40, H * 0.1);
  for (let x = x0; x < x1; x++) if (colCount[x] > need) { if (xL < 0) xL = x; xR = x; }
  let rows = [], guess = false, gx;
  if (xL >= 0 && xR - xL > 30 * s) {
    gx = (xL + xR) / 2;
    const runs = [];
    let st = -1, last = -10;
    for (let y = 0; y < H; y++) {
      let on = false;
      for (let x = xL; x <= xL + 3; x++) {
        const i = (y * W + x) * 4;
        if (sheetIsGreenLine(px[i], px[i + 1], px[i + 2])) { on = true; break; }
      }
      if (on) { if (y - last > 2) { if (st >= 0) runs.push([st, last]); st = y; } last = y; }
    }
    if (st >= 0) runs.push([st, last]);
    rows = runs.filter(r => r[1] - r[0] > 35 * s && r[1] - r[0] < 80 * s);
  }
  if (rows.length !== 15) {
    guess = true;
    gx = 159.5 * s;
    rows = [];
    for (let i = 0; i < 15; i++) {
      const c = H * (0.1736 + i * 0.05188);
      rows.push([Math.round(c - 27.5 * s), Math.round(c + 27.5 * s)]);
    }
  }
  return { s: s, gx: gx, rows: rows, guess: guess };
}

function sheetCountInk(px, W, H, cx, cy, hx, hy) {
  let n = 0;
  for (let y = Math.max(0, Math.round(cy - hy)); y < Math.min(H, Math.round(cy + hy)); y++) {
    for (let x = Math.max(0, Math.round(cx - hx)); x < Math.min(W, Math.round(cx + hx)); x++) {
      const i = (y * W + x) * 4;
      if (sheetIsInk(px[i], px[i + 1], px[i + 2])) n++;
    }
  }
  return n;
}

/* อ่าน 1 หน้า → 15 แถว + ก้อนโน้ต
   rows[i] = { code:'O'|'W'|'C'|'X'|'T'|'', counts:[5], unsure:bool, why:'' } */
function sheetDetectPage(px, W, H) {
  const L = sheetLayout(px, W, H);
  const s = L.s, s2 = s * s;
  const out = [];
  L.rows.forEach(function (r) {
    const cy = (r[0] + r[1]) / 2;
    const hy = Math.max(6, (r[1] - r[0]) / 2 - 9 * s);
    const counts = SHEET_COL_OFF.map(off => sheetCountInk(px, W, H, L.gx + off * s, cy, SHEET_BOX_HALF * s, hy));
    const norm = counts.map(c => c / s2);
    const order = norm.map((v, i) => i).sort((a, b) => norm[b] - norm[a]);
    const top = norm[order[0]], second = norm[order[1]];
    let code = '', unsure = false, why = '';
    if (top >= SHEET_MARK_MIN) {
      code = SHEET_CODES[order[0]];
      if (second >= SHEET_MARK_MIN) { unsure = true; why = 'ติ๊กมากกว่า 1 ช่อง'; }
      else if (second >= SHEET_WEAK_MIN) { unsure = true; why = 'มีรอยในช่องอื่นด้วย'; }
    } else if (top >= SHEET_WEAK_MIN) {
      unsure = true; why = 'รอยจางเกินไป';
    }
    out.push({ code: code, counts: counts, unsure: unsure, why: why });
  });
  return { rows: out, bands: L.rows, guess: L.guess, notes: sheetNoteBlobs(px, W, H, L) };
}

/* ก้อนเนื้อหาในช่อง Photos/Notes — คืน [{y0,y1,x0,x1,rows:[index 0–14 ที่คร่อม], main}] */
function sheetNoteBlobs(px, W, H, L, exclude) {
  /* exclude = กรอบรูปที่แปะ (จาก PDF) — ไม่นับพิกเซลในรูปเป็นลายมือ
     ไม่งั้นรูปที่วางชิดกันจะกลายเป็นก้อนเดียวคร่อมหลายรูป */
  const ex = (exclude || []).map(b => [Math.floor(b.x0), Math.floor(b.y0), Math.ceil(b.x1), Math.ceil(b.y1)]);
  const s = L.s;
  const xa = Math.round(W * 0.505), xb = Math.round(W * 0.945);
  const top = Math.max(0, Math.round(L.rows[0][0] - 12 * s));
  const bot = Math.min(H - 1, Math.round(L.rows[14][1] + 12 * s));
  const width = xb - xa;
  const lineHas = [];
  const colMin = [], colMax = [];
  for (let y = top; y <= bot; y++) {
    let n = 0, mn = W, mx = -1;
    for (let x = xa; x < xb; x++) {
      const i = (y * W + x) * 4;
      const m = Math.min(px[i], px[i + 1], px[i + 2]);
      if (m < 215) {
        let inImg = false;
        for (let e = 0; e < ex.length; e++) { const r = ex[e]; if (x >= r[0] && x < r[2] && y >= r[1] && y < r[3]) { inImg = true; break; } }
        if (inImg) continue;
        n++; if (x < mn) mn = x; if (x > mx) mx = x;
      }
    }
    /* เส้นคั่นแถวยาวเกือบเต็มความกว้าง = ของแม่แบบ ไม่ใช่โน้ต */
    const has = n > 3 && n < width * 0.6;
    lineHas.push(has); colMin.push(mn); colMax.push(mx);
  }
  const blobs = [];
  let st = -1, lastOn = -100, gap = Math.round(18 * s);
  for (let k = 0; k < lineHas.length; k++) {
    if (!lineHas[k]) continue;
    if (st < 0 || k - lastOn > gap) { if (st >= 0) blobs.push([st, lastOn]); st = k; }
    lastOn = k;
  }
  if (st >= 0) blobs.push([st, lastOn]);
  const bands = L.rows.map(function (r, i) {
    const prev = i ? (L.rows[i - 1][1] + r[0]) / 2 : r[0] - 18 * s;
    const next = i < 14 ? (r[1] + L.rows[i + 1][0]) / 2 : r[1] + 18 * s;
    return [prev, next];
  });
  const out = [];
  blobs.forEach(function (b) {
    const y0 = b[0] + top, y1 = b[1] + top;
    if (y1 - y0 < 10 * s) return;
    let x0 = W, x1 = -1, ink = 0;
    for (let k = b[0]; k <= b[1]; k++) {
      if (!lineHas[k]) continue;
      ink++;
      if (colMin[k] < x0) x0 = colMin[k];
      if (colMax[k] > x1) x1 = colMax[k];
    }
    if (x1 - x0 < 12 * s || ink < 8) return;
    const rows = [];
    let best = -1, bestOv = 0;
    bands.forEach(function (bd, i) {
      const ov = Math.min(y1, bd[1]) - Math.max(y0, bd[0]);
      if (ov > 0 && (ov >= (y1 - y0) * 0.15 || ov >= (bd[1] - bd[0]) * 0.3)) rows.push(i);
      if (ov > bestOv) { bestOv = ov; best = i; }
    });
    if (!rows.length && best >= 0) rows.push(best);
    if (!rows.length) return;
    out.push({ y0: y0, y1: y1, x0: x0, x1: x1, rows: rows, main: best });
  });
  return out;
}

/* ★ 25 ก.ย. 69 — วางโน้ตให้ถูกข้อ
   rawImgs = กรอบรูปที่ครูแปะ (อ่านจากคำสั่งวาดใน PDF — แม่นทุกพิกเซล แยกรูปที่ชิดกันได้)
   inkBlobs = ก้อนลายมือในช่อง Notes (sheetNoteBlobs)
   · ลายมือที่ทับ/ติดกับรูป → รวมเป็นโน้ตเดียวกับรูปนั้น (เช่น วงแดงบนรูปโจทย์)
   · ข้อของโน้ต = แถวที่ "จุดกึ่งกลางแนวตั้ง" ของโน้ตตกอยู่
   · ห้ามเดาเงียบ: โน้ตคร่อมหลายแถวและกึ่งกลางอยู่ใกล้เส้นแบ่งแถว หรือกึ่งกลางอยู่ข้อที่ ✅
     แต่คร่อมข้อที่ผิด → unsure ให้ครูเลือกเองก่อนบันทึก */
function sheetRowBands(rows, s) {
  return rows.map(function (r, i) {
    const prev = i ? (rows[i - 1][1] + r[0]) / 2 : r[0] - 18 * s;
    const next = i < rows.length - 1 ? (r[1] + rows[i + 1][0]) / 2 : r[1] + 18 * s;
    return [prev, next];
  });
}

function sheetPlaceNotes(rawImgs, inkBlobs, rows, codes, pageIdx, s) {
  const bands = sheetRowBands(rows, s);
  const hit = (a, b, pad) => a.x0 - pad < b.x1 && b.x0 - pad < a.x1 && a.y0 - pad < b.y1 && b.y0 - pad < a.y1;
  const notes = (rawImgs || []).map(b => ({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1, kind: 'img' }));
  (inkBlobs || []).forEach(function (b) {
    const hosts = notes.filter(n => n.kind === 'img' && hit(n, b, 6 * s));
    const host = hosts.length === 1 ? hosts[0] : null;     /* ติดรูปเดียว = ของรูปนั้น · ติดหลายรูป = ไม่เดา แยกเป็นโน้ตเอง */
    if (host) {                      /* ลายมือบนรูป → ขยายกรอบรูปให้ครอบด้วย */
      host.x0 = Math.min(host.x0, b.x0); host.y0 = Math.min(host.y0, b.y0);
      host.x1 = Math.max(host.x1, b.x1); host.y1 = Math.max(host.y1, b.y1);
    } else notes.push({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1, kind: 'ink' });
  });
  notes.sort((a, b) => a.y0 - b.y0);
  return notes.map(function (n) {
    const h = n.y1 - n.y0, cy = (n.y0 + n.y1) / 2;
    let ci = bands.findIndex(bd => cy >= bd[0] && cy < bd[1]);
    if (ci < 0) ci = cy < bands[0][0] ? 0 : bands.length - 1;
    const touch = [];
    bands.forEach(function (bd, i) {
      const ov = Math.min(n.y1, bd[1]) - Math.max(n.y0, bd[0]);
      if (ov > 0 && (i === ci || ov >= h * 0.15 || ov >= (bd[1] - bd[0]) * 0.3)) touch.push(i);
    });
    const q = pageIdx * 15 + ci + 1;
    const pitch = bands[ci][1] - bands[ci][0];
    const edge = Math.min(cy - bands[ci][0], bands[ci][1] - cy);
    let why = '';
    if (touch.length > 1 && edge < pitch * 0.2) why = 'คร่อมเส้นแบ่งข้อ';
    else if (codes[q - 1] === 'O' && touch.some(i => i !== ci && codes[pageIdx * 15 + i] && codes[pageIdx * 15 + i] !== 'O'))
      why = 'กึ่งกลางอยู่ข้อที่ถูก แต่คร่อมข้อที่ผิด';
    return { x0: n.x0, y0: n.y0, x1: n.x1, y1: n.y1, kind: n.kind, q: q,
             touch: touch.map(i => pageIdx * 15 + i + 1), unsure: why };
  });
}

/* ★ 25 ก.ย. 69 — อ่าน "เลขข้อ" จากรูปโจทย์ที่ครูแปะ (เช่น "22. จงหา…")
   words = คำที่ตัวอ่านตัวอักษร (Tesseract) อ่านได้ [{text, x0, y0}] · w = ความกว้างรูป
   เลือกคำรูปแบบ "NN." ที่อยู่ชิดซ้าย (x < 25% ของรูป) และอยู่บนสุด · เลข 1–30 เท่านั้น
   ตัวเลือกข้อสอบใช้ "1)" หรือ "1." ที่อยู่ต่ำกว่าเลขข้อเสมอ → เลือกตัวบนสุดจึงปลอดภัย */
function sheetQFromWords(words, w) {
  const c = (words || []).map(function (x) {
    const m = String(x.text || '').trim().match(/^(\d{1,2})\.$/);
    return m ? { q: +m[1], x0: x.x0, y0: x.y0 } : null;
  }).filter(x => x && x.q >= 1 && x.q <= 30 && x.x0 < w * 0.25);
  if (!c.length) return 0;
  c.sort((a, b) => a.y0 - b.y0);
  return c[0].q;
}

/* ชื่อไฟล์ "เมฆ วันพุธ.pdf" → { name:'เมฆ', group:'วันพุธ' } ถ้าหาชื่อกลุ่มท้ายชื่อไฟล์เจอ */
function sheetNameFromFile(fname, groups) {
  let base = String(fname || '').replace(/\.pdf$/i, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
  base = base.replace(/\s*\(\d+\)$/, '').trim();                /* "เมฆ วันพุธ (1)" = ไฟล์ซ้ำ */
  const m = base.match(/^(.*?)\s*\(([^)]*)\)\s*$/);              /* "เมฆ (วันพุธ)" */
  if (m) return { name: m[1].trim(), group: m[2].trim(), raw: base };
  const flat = x => String(x || '').replace(/\s+/g, '');
  const fb = flat(base);
  let hit = null;
  (groups || []).slice().sort((a, b) => flat(b).length - flat(a).length).forEach(function (g) {
    if (hit || !flat(g)) return;
    if (fb.length > flat(g).length && fb.slice(-flat(g).length) === flat(g)) hit = g;
  });
  if (hit) {
    let nm = base;
    const gi = base.replace(/\s+/g, ' ');
    const idx = gi.lastIndexOf(String(hit).trim());
    nm = idx > 0 ? gi.slice(0, idx).trim() : base.slice(0, base.length - String(hit).length).trim();
    return { name: nm, group: hit, raw: base };
  }
  return { name: base, group: '', raw: base };
}
/* ==SHEET_DETECT_END== */
/* ═══════════════════════════════════════════════════════════════════
   ★ 25 ก.ย. 69 — ตัวอ่าน PDF ใบตรวจ (ใช้ร่วมกันทั้งหน้าครูและหน้านักเรียน)
   pdf.js อ่านหน้า → sheetDetectPage หาช่องที่ติ๊ก → ตัดภาพโน้ต → Tesseract อ่านเลขข้อในภาพ
   ไม่มีตัวแปรของหน้าไหนอยู่ในนี้ — build.py แปะไฟล์นี้ลงทั้ง teacher-dashboard.html และ dashboard.js
   ═══════════════════════════════════════════════════════════════════ */
const PDFJS_SRC    = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const PDF_CYCLE = ['', 'O', 'W', 'C', 'X', 'T'];
const PDF_CODE_ST = { O: '✅ ถูก', W: '⚠️ สะเพร่า', C: 'C คอนเซปต์', X: 'X ทำไม่ได้', T: '⏰ ไม่ทัน', '': '' };
let _pdfjsP = null;

function pdfjsReady() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (_pdfjsP) return _pdfjsP;
  _pdfjsP = new Promise(function (res, rej) {
    const s = document.createElement('script');
    s.src = PDFJS_SRC;
    s.onload = function () {
      try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; } catch (e) {}
      res(window.pdfjsLib);
    };
    s.onerror = function () { _pdfjsP = null; rej(new Error('โหลดตัวอ่าน PDF ไม่ได้ — ตรวจอินเทอร์เน็ตแล้วลองใหม่')); };
    document.head.appendChild(s);
  });
  return _pdfjsP;
}

function pdfEsc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function pdfUid(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}


/* กรอบของรูปที่ครูแปะในหน้า PDF — อ่านจากคำสั่งวาดของ PDF ตรง ๆ (ไม่ต้องเดาจากพิกเซล)
   รูปพื้นหลังเต็มหน้า (ตัวแม่แบบ+ลายมือ) ข้ามไป · เอาเฉพาะที่อยู่ฝั่งช่อง Notes */
async function sheetImageBoxes(lib, page, vp, W, H) {
  /* ★ 25 ก.ย. 69 — รูปที่ครูครอปใน iPad: PDF เก็บรูปเต็ม + "กรอบตัด" (clip) บังส่วนที่ครอปทิ้ง
     ต้องเอากรอบรูป ∩ กรอบตัด ไม่งั้นได้รูปเต็มที่กินไปถึงข้ออื่น (เคสใบปุณ)
     และรูปที่วางทีหลังทับรูปก่อนหน้า → ตัดส่วนที่ถูกทับออกจากรูปก่อนหน้า */
  const out = [];
  try {
    const ol = await page.getOperatorList();
    const O = lib.OPS;
    const full = { x0: -1e9, y0: -1e9, x1: 1e9, y1: 1e9 };
    let ctm = [1, 0, 0, 1, 0, 0], clip = full, lastPath = null;
    const stack = [];
    const mul = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3],
                           a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
    /* สี่เหลี่ยมในพิกัด PDF (ผ่าน ctm) → พิกัดบนภาพที่เรนเดอร์ */
    const toView = (m, x0, y0, x1, y1) => {
      const pts = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].map(p => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]]);
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
      const r = vp.convertToViewportRectangle([Math.min.apply(null, xs), Math.min.apply(null, ys), Math.max.apply(null, xs), Math.max.apply(null, ys)]);
      return { x0: Math.min(r[0], r[2]), x1: Math.max(r[0], r[2]), y0: Math.min(r[1], r[3]), y1: Math.max(r[1], r[3]) };
    };
    const inter = (a, b) => ({ x0: Math.max(a.x0, b.x0), y0: Math.max(a.y0, b.y0), x1: Math.min(a.x1, b.x1), y1: Math.min(a.y1, b.y1) });
    const drawn = [];
    for (let i = 0; i < ol.fnArray.length; i++) {
      const fn = ol.fnArray[i], a = ol.argsArray[i];
      if (fn === O.save) stack.push({ ctm: ctm.slice(), clip: clip });
      else if (fn === O.restore) { const st = stack.pop(); if (st) { ctm = st.ctm; clip = st.clip; } }
      else if (fn === O.transform) ctm = mul(ctm, a);
      else if (fn === O.constructPath) {
        const mm = a && a[2];
        /* pdf.js 3.x เก็บกรอบของ path เป็น [minX, maxX, minY, maxY] (ไม่ใช่ x0,y0,x1,y1) */
        lastPath = (mm && mm.length === 4 && isFinite(mm[0])) ? toView(ctm, mm[0], mm[2], mm[1], mm[3]) : null;
      }
      else if (fn === O.clip || fn === O.eoClip) { if (lastPath) clip = inter(clip, lastPath); }
      else if (fn === O.paintImageXObject || fn === O.paintInlineImageXObject || fn === O.paintJpegXObject || fn === O.paintImageXObjectRepeat) {
        const b = inter(inter(toView(ctm, 0, 0, 1, 1), clip), { x0: 0, y0: 0, x1: W, y1: H });
        if (b.x1 - b.x0 < 12 || b.y1 - b.y0 < 12) continue;
        drawn.push(b);
      }
    }
    drawn.forEach(function (b, i) {
      if ((b.x1 - b.x0) * (b.y1 - b.y0) > W * H * 0.5) return;       /* พื้นหลังเต็มหน้า */
      if ((b.x0 + b.x1) / 2 < W * 0.45) return;                        /* ไม่ใช่ช่อง Notes */
      const v = { x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 };
      drawn.slice(i + 1).forEach(function (c) {                         /* รูปที่วางทีหลังทับอยู่ */
        if ((c.x1 - c.x0) * (c.y1 - c.y0) > W * H * 0.5) return;
        const ox = Math.min(v.x1, c.x1) - Math.max(v.x0, c.x0);
        if (ox < (v.x1 - v.x0) * 0.8) return;                           /* ทับแค่บางส่วนแนวนอน → ไม่ตัด */
        if (c.y0 <= v.y0 && c.y1 > v.y0 && c.y1 < v.y1) v.y0 = c.y1;    /* ทับขอบบน */
        else if (c.y1 >= v.y1 && c.y0 < v.y1 && c.y0 > v.y0) v.y1 = c.y0; /* ทับขอบล่าง */
      });
      if (v.y1 - v.y0 >= 12) out.push(v);
    });
  } catch (e) { /* อ่านคำสั่งวาดไม่ได้ → ใช้การหาก้อนจากพิกเซลอย่างเดียว */ }
  return out;
}

/* ── ตัวอ่านเลขข้อจากรูป (Tesseract · ทำงานในเบราว์เซอร์ ไม่ส่งรูปออกไปไหน ไม่ใช่ AI แบบถามตอบ) ──
   โหลดครั้งแรก ~7 MB จาก jsdelivr แล้วเบราว์เซอร์จำไว้ · โหลดไม่ได้ = ใช้ตำแหน่งรูปอย่างเดียวเหมือนเดิม
   ปิดได้ด้วย SHEET_OCR = false */
const SHEET_OCR = true;
const TESS_SRC = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
const TESS_OPT = {
  workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',
  corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1',
  langPath: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int'
};
let _tessP = null;
function tessReady() {
  if (!SHEET_OCR) return Promise.resolve(null);
  if (_tessP) return _tessP;
  _tessP = new Promise(function (res) {
    const go = async function () {
      try {
        const w = await window.Tesseract.createWorker('eng', 1, TESS_OPT);
        await w.setParameters({ tessedit_pageseg_mode: '11' });
        res(w);
      } catch (e) { res(null); }
    };
    if (window.Tesseract) return go();
    const s = document.createElement('script');
    s.src = TESS_SRC;
    s.onload = go;
    s.onerror = function () { res(null); };
    document.head.appendChild(s);
  });
  return _tessP;
}

/* อ่านเลขข้อจากรูปที่แปะ — เรนเดอร์หน้าใหม่ที่ความละเอียด 4 เท่า (ตัวเลขในรูปเล็กมาก อ่านที่ขนาดปกติไม่ออก) */
async function sheetOcrNotes(page, notes, pageIdx) {
  const imgs = notes.filter(n => n.kind === 'img' && n.page === pageIdx);
  if (!imgs.length) return;
  const w = await tessReady();
  if (!w) return;
  const K = 4;
  const vp = page.getViewport({ scale: K * SHEET_REF_W / page.getViewport({ scale: 1 }).width });
  const cv = document.createElement('canvas');
  cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  for (const n of imgs) {
    try {
      const c2 = document.createElement('canvas');
      c2.width = Math.round((n.box.x1 - n.box.x0) * K); c2.height = Math.round((n.box.y1 - n.box.y0) * K);
      c2.getContext('2d').drawImage(cv, n.box.x0 * K, n.box.y0 * K, c2.width, c2.height, 0, 0, c2.width, c2.height);
      const r = await w.recognize(c2);
      const words = ((r && r.data && r.data.words) || []).map(x => ({ text: x.text, x0: x.bbox.x0, y0: x.bbox.y0 }));
      const q = sheetQFromWords(words, c2.width);
      if (!q) continue;
      n.ocrQ = q;
      if (q !== n.q) n.geoQ = n.q;
      n.q = q;
      if (n.touch.indexOf(q) === -1) n.touch = n.touch.concat([q]).sort((a, b) => a - b);
      /* เลขข้ออยู่ในหน้าเดียวกับรูป = เชื่อได้ · ข้ามหน้า = ให้ครูดู */
      n.unsure = (q > pageIdx * 15 && q <= pageIdx * 15 + 15) ? '' : 'เลขข้อในรูป (' + q + ') อยู่คนละหน้ากับรูป';
    } catch (e) { /* อ่านไม่ได้ → ใช้ตำแหน่งตามเดิม */ }
  }
}

/* อ่าน PDF 1 ไฟล์ → { codes[30], unsure[30], notes[], pages, guess } */
async function sheetReadPdf(file) {
  const lib = await pdfjsReady();
  const buf = await file.arrayBuffer();
  const doc = await lib.getDocument({ data: buf }).promise;
  const codes = new Array(30).fill(''), unsure = new Array(30).fill(''), counts = [];
  const notes = [];
  let guess = false;
  const pages = Math.min(doc.numPages, 2);
  for (let p = 0; p < pages; p++) {
    const page = await doc.getPage(p + 1);
    const vp1 = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: SHEET_REF_W / vp1.width });
    const cv = document.createElement('canvas');
    cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    const img = ctx.getImageData(0, 0, cv.width, cv.height);
    const r = sheetDetectPage(img.data, cv.width, cv.height);
    if (r.guess) guess = true;
    r.rows.forEach(function (row, i) {
      const q = p * 15 + i;
      codes[q] = row.code;
      unsure[q] = row.unsure ? row.why : '';
      counts[q] = row.counts;
    });
    const imgs = await sheetImageBoxes(lib, page, vp, cv.width, cv.height);
    /* หาลายมือใหม่โดยไม่นับพิกเซลที่อยู่ในรูป → ลายมือที่เหลือถ้าติดรูปจะรวมเข้ากับรูปนั้น */
    const ink = imgs.length ? sheetNoteBlobs(img.data, cv.width, cv.height, { rows: r.bands, s: cv.width / SHEET_REF_W }, imgs) : r.notes;
    sheetPlaceNotes(imgs, ink, r.bands, codes, p, cv.width / SHEET_REF_W).forEach(function (b) {
      const pad = 8;
      const x0 = Math.max(0, Math.floor(b.x0 - pad)), y0 = Math.max(0, Math.floor(b.y0 - pad));
      const w = Math.min(cv.width, Math.ceil(b.x1 + pad)) - x0, h = Math.min(cv.height, Math.ceil(b.y1 + pad)) - y0;
      if (w < 4 || h < 4) return;
      const k = Math.min(1, 900 / w);
      const c2 = document.createElement('canvas');
      c2.width = Math.round(w * k); c2.height = Math.round(h * k);
      const g2 = c2.getContext('2d');
      g2.fillStyle = '#fff'; g2.fillRect(0, 0, c2.width, c2.height);
      g2.drawImage(cv, x0, y0, w, h, 0, 0, c2.width, c2.height);
      notes.push({ page: p, q: b.q, touch: b.touch, unsure: b.unsure, kind: b.kind,
                   box: { x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 },
                   dataUrl: c2.toDataURL('image/jpeg', 0.72), noteId: pdfUid('N') });
    });
    await sheetOcrNotes(page, notes, p);
  }
  return { codes: codes, unsure: unsure, counts: counts, notes: notes, pages: doc.numPages, guess: guess };
}

/* ═══════════════════════════════════════════════════════════════════
   ★ 25 ก.ย. 69 — นักเรียนใส่ PDF ใบตรวจเองในหน้า "กรอกคะแนนเอง" (p8)
   ใช้ตัวอ่านชุดเดียวกับหน้าครู (sheet_detect_block + sheet_read_block แปะไว้ข้างบน)
   อ่านช่องที่ครูติ๊ก → เติมตาราง 30 ข้อให้ → นักเรียนตรวจ/แตะแก้ → ส่งให้ครูตรวจตามเดิม
   ภาพโน้ตของครูส่งตามไปทีละภาพ (subNoteSave) → ครูอนุมัติแล้วเห็นในการ์ด "ใบตรวจจากครู" เหมือนใบที่ครูอัปเอง
   กล่องนี้ถูกสร้างด้วย JS (ไม่ต้องแก้ index.html)
   ═══════════════════════════════════════════════════════════════════ */
const SUBPDF = { item:null, busy:false, msg:'', msgKind:'' };

function subPdfHost(){
  let el = document.getElementById('subPdfBox');
  if(el) return el;
  const pane = document.getElementById('subPastePane');
  const brush = document.getElementById('subBrush');
  const anchor = pane || (brush && brush.closest ? (brush.closest('.d-card') || brush) : brush);
  if(!anchor || !anchor.parentNode) return null;
  el = document.createElement('div');
  el.id = 'subPdfBox';
  el.className = 'd-card';
  anchor.parentNode.insertBefore(el, anchor);
  return el;
}

function subPdfEnsure(){ if(subPdfHost()) subPdfPaint(); }

function _spEsc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function subPdfGid(){ return SUBPDF.item && !SUBPDF.item.sentPid ? SUBPDF.item.gid : ''; }

function subPdfPaint(){
  const el = subPdfHost();
  if(!el) return;
  const it = SUBPDF.item;
  const btn = 'font-family:inherit;font-size:12px;padding:6px 12px;border-radius:11px;cursor:pointer;background:var(--card,#FAF9F5);border:1px solid var(--border-md,#D9D2C6);color:var(--text1,#1A1815)';
  const msg = SUBPDF.msg ? `<div class="sp-msg" style="font-size:12px;margin-top:8px;line-height:1.6;color:${SUBPDF.msgKind==='err'?'var(--red,#B3261E)':SUBPDF.msgKind==='ok'?'var(--green,#1E7B3A)':'var(--text2,#555)'}">${_spEsc(SUBPDF.msg)}</div>` : '';
  let body;
  if(!it){
    body = `<label style="${btn};display:inline-flex;align-items:center;gap:6px;${SUBPDF.busy?'opacity:.5;pointer-events:none;':''}">
        📄 เลือกไฟล์ PDF ใบตรวจ
        <input type="file" id="subPdfFile" accept="application/pdf,.pdf" style="display:none" onchange="subPdfPick(this.files);this.value=''">
      </label>
      <div style="font-size:11.5px;color:var(--text3);margin-top:6px;line-height:1.6">
        ใส่ไฟล์ที่ครูตรวจแล้วส่งกลับมา · ระบบอ่านช่องที่ครูติ๊กให้เอง (ไม่ใช้ AI) แล้วเติมตารางด้านล่าง<br>
        ภาพโน้ตของครูจะถูกเก็บไว้ดูทีหลังได้ · ตรวจให้ตรงกระดาษก่อนกดส่งนะครับ</div>`;
  }else{
    const filled = subState.st.filter(Boolean).length;
    const uq = it.unsure.map((u,i)=>u?i+1:0).filter(Boolean);
    const nu = it.notes.filter(n=>n.unsure).length;
    const opts = q => Array.from({length:30},(_,i)=>`<option value="${i+1}" ${q===i+1?'selected':''}>ข้อ ${i+1}</option>`).join('');
    const notes = it.notes.map(n => `
      <div class="sp-note" data-note="${n.noteId}" style="border:${n.unsure?'2px dashed #F59E0B':'1px solid var(--border-md,#D9D2C6)'};border-radius:10px;padding:6px;background:#fff">
        <img src="${n.dataUrl}" alt="โน้ตข้อ ${n.q}" style="width:100%;display:block;border-radius:6px">
        <div style="display:flex;gap:6px;align-items:center;margin-top:5px">
          <select onchange="subPdfNoteQ('${n.noteId}',this.value)" ${n.saved||it.sentPid?'disabled':''} style="flex:1;font-family:inherit;font-size:12px;padding:4px;border-radius:8px">${opts(n.q)}</select>
          ${n.saved ? '<span style="font-size:11px;color:var(--green,#1E7B3A)">✓ ส่งแล้ว</span>'
                    : it.sentPid ? '' : `<button onclick="subPdfNoteDrop('${n.noteId}')" title="ไม่ใช่โน้ต ตัดทิ้ง" style="${btn};padding:4px 8px">✕</button>`}
        </div>
        ${n.unsure ? `<div style="font-size:10.5px;color:#92400E;margin-top:3px">${_spEsc(n.unsure)} — เลือกข้อให้ถูก</div>` : ''}
      </div>`).join('');
    body = `<div style="font-size:13px;color:var(--text1)"><b>📄 ${_spEsc(it.fileName)}</b></div>
      <div style="font-size:12px;color:var(--text2);margin-top:3px">อ่านได้ ${filled}/30 ข้อ${30-filled?` · ว่าง ${30-filled} ข้อ (ข้อที่ยังไม่ได้ส่งตรวจ — แตะเติมเองได้)`:''} · ภาพโน้ต ${it.notes.length} ภาพ</div>
      ${it.warn ? `<div style="font-size:12px;color:#92400E;margin-top:4px">⚠️ ${_spEsc(it.warn)}</div>` : ''}
      ${uq.length && !it.sentPid ? `<div class="sp-unsure" style="margin-top:8px;padding:8px 10px;border-radius:10px;background:#FEF3C7;border:1.5px dashed #F59E0B;font-size:12px;color:#92400E;line-height:1.6">
          อ่านไม่แน่ใจ ${uq.length} ข้อ (กรอบส้มในตาราง): ข้อ ${uq.join(', ')} — แตะแก้ให้ตรงกระดาษ
          <button onclick="subPdfConfirm()" style="${btn};margin-left:6px;padding:4px 10px">ยืนยันตามที่อ่านได้</button></div>` : ''}
      ${nu && !it.sentPid ? `<div style="font-size:12px;color:#92400E;margin-top:6px">มีภาพโน้ต ${nu} ภาพที่ไม่แน่ใจว่าเป็นข้อไหน (กรอบส้ม) — เลือกข้อใต้ภาพ</div>` : ''}
      ${it.notes.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;margin-top:10px">${notes}</div>` : ''}
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">
        ${it.sentPid && it.notes.some(n=>!n.saved) ? `<button onclick="subPdfRetry()" style="${btn}">📤 ส่งภาพที่ค้างอีกครั้ง</button>` : ''}
        <button onclick="subPdfClear()" style="${btn};color:#B3261E;border-color:#E4C7C5">${it.sentPid ? 'ปิด' : 'ล้างไฟล์นี้'}</button>
      </div>`;
  }
  el.innerHTML = `<div class="slabel">📄 ใส่ไฟล์ PDF ใบตรวจจากครู</div>${body}${msg}`;
}

/* กรอบส้มบนข้อที่อ่านไม่แน่ใจ — เรียกท้าย subRender ทุกครั้ง */
function subPdfDecor(){
  const it = SUBPDF.item;
  const grid = document.getElementById('subGrid');
  if(!grid) return;
  [...grid.children].forEach((b,i) => {
    const u = it && !it.sentPid && it.unsure[i];
    b.style.outline = u ? '3px dashed #F59E0B' : '';
    b.style.outlineOffset = u ? '-2px' : '';
    if(u) b.title = 'อ่านไม่แน่ใจ: ' + u; else b.removeAttribute('title');
    b.classList.toggle('sp-unsure-q', !!u);
  });
  subPdfPaint();
}

async function subPdfPick(files){
  const f = (files && files[0]) || null;
  if(!f) return;
  if(!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf'){ SUBPDF.msg='เลือกไฟล์ PDF ครับ'; SUBPDF.msgKind='err'; subPdfPaint(); return; }
  SUBPDF.busy = true; SUBPDF.msg = 'กำลังอ่านไฟล์… (ครั้งแรกต้องโหลดตัวอ่านเลขข้อ ~7 MB รอสักครู่)'; SUBPDF.msgKind = '';
  subPdfPaint();
  try{
    const r = await sheetReadPdf(f);
    if(r.codes.every(c=>!c)) throw new Error('ไม่พบช่องที่ครูติ๊กเลย — ใช่ใบตรวจที่ครูตรวจแล้วหรือเปล่าครับ');
    subState.st = r.codes.map(c => PDF_CODE_ST[c] || '');
    SUBPDF.item = { gid: pdfUid('G'), fileName: f.name, unsure: r.unsure.slice(),
      notes: r.notes.map(n => ({ noteId:n.noteId, q:n.q, unsure:n.unsure || '', dataUrl:n.dataUrl, saved:false })),
      warn: r.pages > 2 ? 'ไฟล์นี้มี ' + r.pages + ' หน้า — ระบบอ่านแค่ 2 หน้าแรก (ใบตรวจ 1 คน = 2 หน้า)'
          : r.guess ? 'หาเส้นตารางไม่เจอ ใช้ตำแหน่งมาตรฐาน — ตรวจให้ดีก่อนส่ง' : '' };
    SUBPDF.msg = 'อ่านเสร็จแล้ว — เลือกบทและวันที่สอบด้านบนให้ตรงกับใบนี้ ตรวจตาราง แล้วกด "ส่งให้ครูตรวจ"'; SUBPDF.msgKind = 'ok';
  }catch(e){
    SUBPDF.msg = 'อ่านไฟล์ไม่ได้: ' + ((e && e.message) || e); SUBPDF.msgKind = 'err';
  }
  SUBPDF.busy = false;
  subRender();
  subPdfPaint();
}

function subPdfConfirm(){ if(SUBPDF.item){ SUBPDF.item.unsure = new Array(30).fill(''); subRender(); } }
function subPdfNoteQ(id, q){
  const n = SUBPDF.item && SUBPDF.item.notes.find(x=>x.noteId===id);
  if(n && !n.saved){ n.q = parseInt(q,10); n.unsure = ''; }
  subPdfPaint();
}
function subPdfNoteDrop(id){
  if(SUBPDF.item) SUBPDF.item.notes = SUBPDF.item.notes.filter(x=>x.noteId!==id);
  subPdfPaint();
}
function subPdfClear(){
  const sent = SUBPDF.item && SUBPDF.item.sentPid;
  if(!sent && SUBPDF.item && !confirm('ล้างไฟล์นี้? (ตารางที่อ่านได้จะถูกล้างด้วย)')) return;
  if(!sent){ subState.st = new Array(30).fill(''); }
  SUBPDF.item = null; SUBPDF.msg = ''; SUBPDF.msgKind = '';
  subRender(); subPdfPaint();
}

/* เช็คก่อนส่ง — คืน false = ยังส่งไม่ได้ (เขียนเหตุผลลง #subStatus ให้แล้ว) */
function subPdfReady(stEl){
  const it = SUBPDF.item;
  if(!it || it.sentPid) return true;
  const uq = it.unsure.filter(Boolean).length;
  const nu = it.notes.filter(n=>n.unsure).length;
  if(uq || nu){
    stEl.className = 'status err';
    stEl.textContent = uq ? `ยังมี ${uq} ข้อที่ระบบอ่านไม่แน่ใจ (กรอบส้ม) — แตะแก้ หรือกด "ยืนยันตามที่อ่านได้" ก่อนส่งครับ`
                          : `ยังมีภาพโน้ต ${nu} ภาพที่ยังไม่ได้เลือกข้อ — เลือกข้อใต้ภาพก่อนส่งครับ`;
    return false;
  }
  return true;
}

/* หลังส่งคะแนนสำเร็จ → ส่งภาพโน้ตทีละภาพ (ยิงซ้ำได้ เซิร์ฟเวอร์กันซ้ำด้วย noteId) */
async function subPdfAfterSend(j, stEl){
  if(j && j.replaceOf != null){
    stEl.textContent += ` · ⚠️ ครูกรอกคะแนนบทนี้ไว้แล้ว (${j.replaceOf}/30) — ส่งเป็น "คำขอแก้คะแนน" ครูต้องยืนยันก่อน`;
  }
  const it = SUBPDF.item;
  if(!it || it.sentPid) return;
  it.sentPid = true;
  it.unsure = new Array(30).fill('');
  if(j.gid !== it.gid){ it.notes = []; subPdfPaint(); return; }
  if(!it.notes.length){ SUBPDF.item = null; SUBPDF.msg = ''; subPdfPaint(); return; }
  if(j.notesOn === false){
    SUBPDF.msg = 'ส่งคะแนนแล้ว · ครูยังไม่ได้เปิดระบบเก็บภาพโน้ต ภาพจึงยังไม่ถูกส่ง'; SUBPDF.msgKind = 'err';
    it.notes = []; subPdfPaint(); return;
  }
  await subPdfUpload(stEl);
}

async function subPdfUpload(stEl){
  const it = SUBPDF.item;
  if(!it) return;
  const todo = it.notes.filter(n=>!n.saved);
  let done = 0, fail = 0, lastErr = '';
  for(const n of todo){
    SUBPDF.msg = `กำลังส่งภาพโน้ต ${done+fail+1}/${todo.length}…`; SUBPDF.msgKind = '';
    subPdfPaint();
    try{
      const r = await subPost({ action:'subNoteSave', gid: it.gid, noteId: n.noteId, qs:[n.q],
                                data: String(n.dataUrl).replace(/^data:image\/\w+;base64,/, '') });
      if(r && r.ok){ n.saved = true; done++; }
      else { fail++; lastErr = (r && r.error) || ''; if(r && r.notesOff) break; }
    }catch(e){ fail++; lastErr = e.message; }
  }
  if(!fail){
    if(stEl) stEl.textContent += ` · ภาพโน้ต ${it.notes.length} ภาพ`;
    SUBPDF.item = null; SUBPDF.msg = 'ส่งภาพโน้ตครบ ' + it.notes.length + ' ภาพแล้ว — ครูอนุมัติแล้วจะดูได้ในการ์ด "ใบตรวจจากครู"'; SUBPDF.msgKind = 'ok';
  }else{
    SUBPDF.msg = `ส่งภาพโน้ตไม่สำเร็จ ${fail} ภาพ${lastErr ? ' (' + lastErr + ')' : ''} — กด "ส่งภาพที่ค้างอีกครั้ง"`; SUBPDF.msgKind = 'err';
  }
  subPdfPaint();
}

async function subPdfRetry(){ await subPdfUpload(null); subLoadList(); }

/* ═══════════════════════════════════════════════════════════════════
   ★ 26 ก.ย. 69 — กราฟพัฒนาการในรายงานผู้ปกครอง (วางเหนือแถบเลือกสไตล์ 🦅🐬🐘🦉🐝)
   ใช้ตัววาดกราฟตัวเดียวกับแท็บ 📈 พัฒนาการของนักเรียน (_progLineChart) + ชิปเลือกเส้นชุดเดียวกัน
   (เลือกเส้นที่หน้าไหนก็จำร่วมกันในเครื่องนั้น) · มีทั้งแยกบทและสนามสอบ → สลับดูได้
   ═══════════════════════════════════════════════════════════════════ */
let parentTrendInst = null, _pTrendKind = '';

function pTrendKind(k){ _pTrendKind = k; if(dashData) renderParentTrend(dashData); }

function renderParentTrend(d){
  let host = document.getElementById('p-trend');
  if(!host){
    const anchor = document.getElementById('p-animalBar') || document.getElementById('p-summary');
    if(!anchor || !anchor.parentNode) return;
    anchor.insertAdjacentHTML('beforebegin', '<div id="p-trend"></div>');
    host = document.getElementById('p-trend');
  }
  if(parentTrendInst){ try{ parentTrendInst.destroy(); }catch(e){} parentTrendInst = null; }
  const chap = d.chapHist || [], mock = d.mockHist || [];
  if(!chap.length && !mock.length){ host.innerHTML = ''; return; }
  let kind = _pTrendKind || viewKind(d);
  if(kind === 'mock' && !mock.length) kind = 'chap';
  if(kind !== 'mock' && !chap.length) kind = 'mock';
  const isMock = kind === 'mock';
  const hist = isMock ? mock : chap;
  const full = hist[hist.length-1].full || (isMock ? 100 : 30);
  const name = d.shortName || '';

  const tab = (k, label, n) => {
    const on = kind === k;
    return '<button onclick="pTrendKind(\'' + k + '\')" style="width:auto;height:auto;display:inline-flex;align-items:center;cursor:pointer;font-family:inherit;'
      + 'font-size:12px;padding:6px 14px;border-radius:999px;border:1.5px solid ' + (on ? '#185FA5' : 'var(--border-md,#D9D2C6)') + ';'
      + 'background:' + (on ? '#185FA5' : 'transparent') + ';color:' + (on ? '#fff' : 'var(--text2)') + ';font-weight:500">'
      + label + ' (' + n + ')</button>';
  };
  const switcher = (chap.length && mock.length)
    ? '<div class="p-trend-switch" style="display:flex;gap:6px;flex-wrap:wrap;margin:2px 0 10px">'
      + tab('chap', '📘 ข้อสอบแยกบท', chap.length) + tab('mock', '🎯 สนามสอบ', mock.length) + '</div>'
    : '';

  let body;
  if(hist.length >= 2){
    body = lineChipsHTML('parent')
      + _progCard('p-trendChart',
          isMock ? '🎯 สนามสอบ (รวมทุกบท) — คะแนนรายชุด' : '📘 ข้อสอบแยกบท — คะแนนรายครั้ง',
          'เต็ม ' + full + ' คะแนน · ' + hist.length + (isMock ? ' ชุด' : ' ครั้ง') + ' · เส้นน้ำเงิน = คะแนนของ' + _esc(name), true, hist);
  }else{
    body = _progSingleCard(isMock ? '🎯' : '📘', (isMock ? 'สนามสอบ' : 'ข้อสอบแยกบท') + ' — ผลครั้งล่าสุด', hist[0],
      'สอบประเภทนี้ไป 1 ครั้ง · กราฟแนวโน้มจะเริ่มแสดงเมื่อสอบครั้งที่ 2');
  }
  host.innerHTML = '<div class="d-card p-trend-card" style="padding:1rem 1rem .6rem">'
    + '<div class="slabel">📈 กราฟพัฒนาการของ' + _esc(name) + '</div>'
    + switcher
    + '<div style="font-size:11.5px;color:var(--text3);line-height:1.6">เทียบกับตัวเองในแต่ละครั้ง · เลือกเส้นที่อยากเห็นได้จากปุ่มด้านล่าง</div>'
    + '</div>' + body;
  if(hist.length >= 2){
    parentTrendInst = _progLineChart('p-trendChart', hist, full,
      isMock ? goalEffective(hist[hist.length-1].topic) : CHAP_GOAL_FALLBACK);
  }
  try{ goalEnsure(); }catch(e){}
}
