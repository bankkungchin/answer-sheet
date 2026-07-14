/* ============================================================
   config.js — ตั้งค่าระบบ (แก้ที่นี่เมื่อเปลี่ยน Sheet / เพิ่มช่อง)
   ============================================================ */
const SHEET_ID = '1U49c1_y3QtTa6LP8rV4Z1dBM5gxKrdpxp5nY1M6ffnU';
const API_KEY  = 'AIzaSyAW7uJtajKOWhfg_Pwc6-NK7siuCVyVpYs';
const BASE     = 'https://sheets.googleapis.com/v4/spreadsheets';

// ── YouTube channel ของครู (ใช้สำหรับปุ่มค้นหาคลิปตามหัวข้อ) ──
const YT_CHANNEL = 'mathsbanktutor';

// ── เพลย์ลิสต์เฉลยรายบท (เพิ่มเมื่อมีบทใหม่) ──
//   key = ชื่อบท (ตรงกับใน questionbank.js), value = playlist id
const PLAYLISTS = {
  "เซต": "PLc4ncgz2CJ7NaaLBirripaazcj04QZTdG",
  "Expo Logarithm": "PLc4ncgz2CJ7OjRvsaXGHaJONCnH33zMK5",
  "จำนวนจริง": "PLc4ncgz2CJ7NpDEo9YhNBzxn4nQPIKcbl",
   "ความสัมพันธ์": "PLc4ncgz2CJ7NY9jKCP5fV5ooYxI7-VzWS",
"ฟังก์ชัน":     "PLc4ncgz2CJ7Nnlb-DevGFB977eEkdWCwA",
};
// ============================================================
//  PATCH — เพิ่ม playlist "จำนวนเชิงซ้อน" ใน config.js
//  วิธีใช้: เปิด config.js บน GitHub แล้ววางต่อท้ายไฟล์เดิมทั้งหมด
//  (PLAYLISTS เป็น const แต่เพิ่ม key ใหม่ด้วย bracket notation ได้ปกติ)
// ============================================================

PLAYLISTS["จำนวนเชิงซ้อน"] = "PLc4ncgz2CJ7N8O-4pbXPYeLgWqt8HO_VM";
// ═══ PLAYLISTS["เวกเตอร์"] — วางต่อท้ายไฟล์ config.js ═══
PLAYLISTS["เวกเตอร์"] = "PLc4ncgz2CJ7Or-3xHTxmhDg3BKrqUND-L";
// ═══ PLAYLISTS["เรขาคณิตวิเคราะห์"] และ ["ภาคตัดกรวย"] ═══
PLAYLISTS["เรขาคณิตวิเคราะห์"] = "TBD_ANALYTIC_PLAYLIST";
PLAYLISTS["ภาคตัดกรวย"] = "PLc4ncgz2CJ7OXjl9Xww2mUZZR9vedES8Z";
// ── config.js : เพิ่มใน PLAYLISTS ──

// ═══ ไฟล์ 1/2 : config.js — วางต่อท้ายไฟล์ ═══
PLAYLISTS["ลำดับและอนุกรม"] = "PLc4ncgz2CJ7OkZZpEy6AWsRCaeS-q-eyI";

PLAYLISTS["การเรียงลำดับและการจัดหมู่"]= "PLc4ncgz2CJ7MqVda7oTYgX5wlZj9l6MuO";
