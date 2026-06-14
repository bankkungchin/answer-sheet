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
  "Expo Logarithm": "PLc4ncgz2CJ7OjRvsaXGHaJONCnH33zMK5"
};
