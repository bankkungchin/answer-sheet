function displayN(q){ var m=(q.yt||'').match(/\.html#q(\d+)/); return m?m[1]:q.n; }
// ════════════════════════════════════════════════════════════
// review.js — คลังทบทวน (เลือกข้อเอง / สุ่มข้อ) — ใช้ PRACTICE_BANK
// ════════════════════════════════════════════════════════════

// emoji ของแต่ละบท
var RV_CHAP_ICON = {
  "เซต":"🔢", "Expo Logarithm":"📈", "ตรีโกณมิติ":"📐",
  "ตรีโกณมิติ Ent":"📐", "จำนวนจริง":"➗", "ความสัมพันธ์และฟังก์ชัน":"🔗",
  "เรขาคณิตวิเคราะห์และภาคตัดกรวย":"📊", "เวกเตอร์":"➡️", "จำนวนเชิงซ้อน":"🌀",
  "ลำดับและอนุกรม":"🔁", "แคลคูลัส":"∫", "เรียงลำดับและจัดหมู่":"🎲",
  "ความน่าจะเป็น":"🎰", "สถิติ":"📉", "เมทริกซ์":"🔲", "ตรรกศาสตร์":"💭"
};

/* ═══════════════════════════════════════════════════════════════
   ลำดับบท — ให้ตรงกับดรอปดาวน์ "กรองเฉพาะบท" ในหน้ารายงานคะแนน
   อยากสลับลำดับบทเมื่อไหร่ แก้ที่ลิสต์นี้ที่เดียว
   ═══════════════════════════════════════════════════════════════ */
var RV_CHAP_ORDER = [
  'เซต',
  'จำนวนจริง',
  'ความสัมพันธ์',
  'ฟังก์ชัน',
  'ความสัมพันธ์และฟังก์ชัน',
  'เรขาคณิตวิเคราะห์',
  'ภาคตัดกรวย',
  'Expo Logarithm',
  'เมทริกซ์',
  'ตรีโกณมิติ',
  'เวกเตอร์',
  'จำนวนเชิงซ้อน',
  'ลำดับและอนุกรม',
  'แคลคูลัส',
  'การเรียงลำดับและการจัดหมู่',
  'ความน่าจะเป็น',
  'สถิติ',
  'ตรรกศาสตร์'
];

/* ชื่อที่สะกดต่างแต่เป็นบทเดียวกัน — ให้ได้ลำดับเดียวกับตัวหลัก
   เจอชื่อไหนสะกดต่างอีก เติมได้ที่นี่ */
/* บทที่ไม่ต้องแสดงในคลังทบทวน — เนื้อหาซ้ำกับบทอื่นที่แสดงอยู่แล้ว
   'เรขาคณิตวิเคราะห์และภาคตัดกรวย' = 'เรขาคณิตวิเคราะห์' (25 ข้อ) + 'ภาคตัดกรวย' (118 ข้อ) = 143 ข้อ พอดี
   ซ่อนตัวรวมไว้ ข้อสอบไม่หายไปไหน ยังเข้าถึงได้ครบผ่าน 2 บทแยก */
var RV_CHAP_HIDE = ['เรขาคณิตวิเคราะห์และภาคตัดกรวย'];

var RV_CHAP_ALIAS = {
  'Expo Logarithm'   : ['Exponential logarithm', 'Expo Log'],
  'แคลคูลัส'          : ['แคลคูลลัส'],
  'ลำดับและอนุกรม'    : ['อันดับและอนุกรม'],
  'การเรียงลำดับและการจัดหมู่' : ['เรียงลำดับและจัดหมู่'],
  'ความสัมพันธ์และฟังก์ชัน' : ['ความสัมพันธ์และฟังชัน']
};

/* คีย์เทียบชื่อบท — ตัดช่องว่าง/สระ/วรรณยุกต์/"การ"
   ⚠️ ใช้กับชื่อบทเท่านั้น ห้ามใช้กับชื่อคน ("ปัณ" ≠ "ปุณ") */
function rvChapKey(s){
  return String(s || '')
    .replace(/\s+/g, '')
    .replace(/การ/g, '')
    .replace(/[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/g, '')
    .toLowerCase();
}

var _rvOrderIdx = null;
function _rvBuildOrderIdx(){
  _rvOrderIdx = {};
  RV_CHAP_ORDER.forEach(function(n, i){
    _rvOrderIdx[rvChapKey(n)] = i;
    (RV_CHAP_ALIAS[n] || []).forEach(function(a){ _rvOrderIdx[rvChapKey(a)] = i; });
  });
}

function rvOrderOf(name){
  if(!_rvOrderIdx) _rvBuildOrderIdx();
  var k = rvChapKey(name);
  if(_rvOrderIdx[k] != null) return _rvOrderIdx[k];
  // ชื่อไม่ตรงเป๊ะ → จับคู่แบบขึ้นต้นตรงกัน
  // (เช่น "เรขาคณิตวิเคราะห์" = "เรขาคณิตวิเคราะห์และภาคตัดกรวย" · "เมทริกซ์ ชุดที่ 1" = "เมทริกซ์")
  var keys = Object.keys(_rvOrderIdx), best = -1, bestLen = 0;
  for(var i = 0; i < keys.length; i++){
    var ok = keys[i];
    if(ok.length < 3 || k.length < 3) continue;
    if(k.indexOf(ok) === 0 || ok.indexOf(k) === 0){
      if(ok.length > bestLen){ bestLen = ok.length; best = _rvOrderIdx[ok]; }
    }
  }
  return best >= 0 ? best : 999;   // บทที่ไม่รู้จัก → ไปท้ายสุด ไม่หายไปไหน
}

/* ═══════════════════════════════════════════════════════════════
   ตัดข้อซ้ำ — บางบทมีข้อเดียวกันอยู่ทั้งคีย์ฐานและคีย์ " Ent"
   (ลิงก์เฉลย/คลิปเดียวกันเป๊ะ แต่เลขข้อกับระดับต่างกัน)
   ทำให้นักเรียนเห็นข้อเดิมซ้ำ 2 รอบ — เก็บอันแรกไว้ตัวเดียว
   ตรวจเมื่อ 14 ส.ค. 69: ตรรกศาสตร์ ซ้ำ 34 · เมทริกซ์ ซ้ำ 37 · ความน่าจะเป็น ซ้ำ 35
   ═══════════════════════════════════════════════════════════════ */
function rvDedupe(list){
  var seen = {}, out = [];
  (list || []).forEach(function(q){
    var k = String((q && q.yt) || '').trim();
    if(!k){ out.push(q); return; }          // ไม่มีลิงก์ = เก็บไว้ทุกอัน
    if(seen[k]) return;
    seen[k] = true;
    out.push(q);
  });
  return out;
}

// state
var RV = {
  chapter: null,      // ชื่อบทที่เลือก (key ใน PRACTICE_BANK)
  bank: [],           // ข้อในบทนั้น
  cats: [],           // หมวดที่มี
  levels: [],         // ระดับที่มี
  fCat: '', fLvl: 0, fUnseen: false,            // filter เลือกข้อเอง (ทีละอัน)
  /* ★ 21 ส.ค. 69 — ฝั่งสุ่มเลือกได้หลายอันแล้ว (ครูขอ)
     rCats/rLvls เป็น array · ว่าง = "ทั้งหมด" */
  rCats: [], rLvls: [], rUnseen: false,         // filter สุ่ม (เลือกได้หลายอัน)
  fPeriod: 'all',     // filter ช่วงปี browse: 'all' | 'yt' | 'ent'
  rPeriod: 'all',     // filter ช่วงปี random: 'all' | 'yt' | 'ent'
  queue: [],          // ผลสุ่ม
  tab: 'browse'
};
var RV_SEEN = {};      // {chapter: {n: true}}

// ── persistence (localStorage) ──
function rvLoad(){
  try{ var s=localStorage.getItem('rv_seen'); if(s) RV_SEEN=JSON.parse(s); }catch(e){}
}
function rvSave(){
  try{ localStorage.setItem('rv_seen', JSON.stringify(RV_SEEN)); }catch(e){}
}

// ── เปิดคลังทบทวน → แสดงรายการบท ──
function openReviewLibrary(){
  rvLoad();
  goTo('p6');
  var html='';
  // รวม Ent เข้ากับบทหลัก
  var chapMap = {};
  Object.keys(PRACTICE_BANK).forEach(function(k){
    if(k.includes('ความสัมพันธ์และ')) return;
    var arr = PRACTICE_BANK[k];
    if(!arr || !arr.length) return;
    var isEnt = k.indexOf(' Ent') > -1;
    var base = isEnt ? k.replace(/ Ent$/,'') : k;
    if(!chapMap[base]) chapMap[base] = {yt:[], ent:[]};
    if(isEnt) chapMap[base].ent = arr;
    else chapMap[base].yt = arr;
  });
  /* ยุบบทที่เป็นชื่อพ้องกัน (เช่น "การเรียงลำดับและการจัดหมู่" กับ "เรียงลำดับและจัดหมู่"
     ซึ่ง topic-marker.js สร้างขึ้นตอนผูกชื่อจากชีต) — เก็บชื่อที่ยาวกว่าไว้ตัวเดียว */
  var byKey = {};
  Object.keys(chapMap).forEach(function(base){
    if(RV_CHAP_HIDE.indexOf(base) > -1) return;          // บทที่สั่งซ่อน
    var k = rvChapKey(base);
    var n = chapMap[base].yt.length + chapMap[base].ent.length;
    var cur = byKey[k];
    if(!cur || n > cur.n || (n === cur.n && base.length > cur.base.length)){
      byKey[k] = { base: base, n: n, alts: cur ? cur.alts.concat([cur.base]) : [] };
    } else {
      cur.alts.push(base);
    }
  });
  var chapAlts = {};
  var visible = Object.keys(byKey).map(function(k){
    chapAlts[byKey[k].base] = byKey[k].alts;
    return byKey[k].base;
  });

  visible.sort(function(a, b){
    var d = rvOrderOf(a) - rvOrderOf(b);
    return d !== 0 ? d : (a < b ? -1 : 1);
  }).forEach(function(base){
    var ch = chapMap[base];
    var totalQ = ch.yt.length + ch.ent.length;
    var icon = RV_CHAP_ICON[base] || '📘';
    var seenNames = [base].concat(chapAlts[base] || []);
    var seenTotal = 0;
    seenNames.forEach(function(nm){
      if(RV_SEEN[nm]) seenTotal += Object.keys(RV_SEEN[nm]).length;
      if(RV_SEEN[nm+' Ent']) seenTotal += Object.keys(RV_SEEN[nm+' Ent']).length;
    });
    var all = rvDedupe(ch.yt.concat(ch.ent));
    var clipN = 0, htmlN = 0;
    all.forEach(function(q){ if((q.yt||'').includes('.html#')) htmlN++; else clipN++; });
    var sub = clipN+' ข้อมีคลิป + '+htmlN+' ข้อเฉลย HTML';
    if(seenTotal>0) sub += ' · ดูแล้ว '+seenTotal;
    html += '<div class="chap-card" style="cursor:pointer" data-base="'+base+'" onclick="rvOpenChapterMerged(this.dataset.base)">'+
      '<div class="chap-icon">'+icon+'</div>'+
      '<div class="chap-info"><div class="chap-name">'+base+'</div>'+
      '<div class="chap-count">'+sub+'</div></div>'+
      '<div class="chap-arrow">›</div></div>';
  });
  document.getElementById('rv-chapList').innerHTML = html || '<div class="d-card" style="text-align:center;color:var(--text2)">ยังไม่มีคลังข้อสอบครับ</div>';
}

// ── เปิดบท → หน้ารายข้อ ──
function rvOpenChapterMerged(base){
  if(typeof base !== "string") base = base.dataset ? base.dataset.base : base;
  var ytBank = PRACTICE_BANK[base] || [];
  var entBank = PRACTICE_BANK[base+' Ent'] || [];
  RV.chapter = base;
  RV.bank = rvDedupe(ytBank.concat(entBank));
  if(!RV_SEEN[base]) RV_SEEN[base]={};
  rvOpenChapterCore();
}
function rvOpenChapter(chap){
  RV.chapter = chap;
  RV.bank = rvDedupe(PRACTICE_BANK[chap] || []);
  if(!RV_SEEN[chap]) RV_SEEN[chap]={};
  rvOpenChapterCore();
}
function rvOpenChapterCore(){
  RV.cats = [];
  RV.levels = [];
  RV.bank.forEach(function(q){
    if(RV.cats.indexOf(q.c)<0) RV.cats.push(q.c);
    if(RV.levels.indexOf(q.l)<0) RV.levels.push(q.l);
  });
  RV.levels.sort(function(a,b){return a-b;});
  RV.fCat=''; RV.fLvl=0; RV.fUnseen=false; RV.fPeriod='all';
  RV.rCats=[]; RV.rLvls=[]; RV.rUnseen=false; RV.rPeriod='all';
  RV.queue=[]; RV.tab='browse';
  if(!RV_SEEN[RV.chapter]) RV_SEEN[RV.chapter]={};

  var baseName = RV.chapter.replace(/ Ent$/,'');
  document.getElementById('rv-chapIcon').textContent = RV_CHAP_ICON[baseName] || RV_CHAP_ICON[RV.chapter] || '📘';
  document.getElementById('rv-chapName').textContent = RV.chapter;
  document.getElementById('rv-chapSub').textContent = RV.bank.length + ' ข้อ';

  // สร้าง chips หมวด+ระดับ (ทั้ง browse และ random)
  rvBuildChips();
  // reset tab
  rvSwitchTab('browse');
  goTo('p7');
}

// ── สร้าง filter chips ──
function rvCatLabel(c){
  // ถ้ามี emoji นำหน้าแล้ว ใช้เลย; ถ้าไม่ใส่ตามเดิม
  return c.length>20 ? c.slice(0,20)+'…' : c;
}
function rvBuildChips(){
  // browse cat
  var catHtml = '<span class="rv-flbl">หมวด</span>'+
    '<button class="chip active" onclick="rvSetCat(this,\'\')">ทั้งหมด</button>';
  RV.cats.forEach(function(c){
    catHtml += '<button class="chip" onclick="rvSetCat(this,\''+c.replace(/'/g,"\\'")+'\')">'+rvCatLabel(c)+'</button>';
  });
  document.getElementById('rv-fcat').innerHTML = catHtml;
  // browse lvl
  var lvlHtml = '<span class="rv-flbl">ระดับ</span>'+
    '<button class="chip active" onclick="rvSetLvl(this,0)">ทั้งหมด</button>';
  RV.levels.forEach(function(l){
    lvlHtml += '<button class="chip" onclick="rvSetLvl(this,'+l+')">'+'★'.repeat(l)+'</button>';
  });
  document.getElementById('rv-flvl').innerHTML = lvlHtml;

  // browse period — แบ่งข้อสอบเป็นช่วงปี (ถ้ามีทั้ง YT และ Ent)
  var hasYt = RV.bank.some(function(q){ return !(q.yt||'').includes('.html#'); });
  var hasEnt = RV.bank.some(function(q){ return (q.yt||'').includes('.html#'); });
  if(hasYt && hasEnt) {
    var ytYears = RV.bank.filter(function(q){ return !(q.yt||'').includes('.html#'); }).map(function(q){return q.y||'';});
    var entYears = RV.bank.filter(function(q){ return (q.yt||'').includes('.html#'); }).map(function(q){return q.y||'';});
    var ytRange = Math.min.apply(null,ytYears.filter(Boolean).map(Number))+'-'+Math.max.apply(null,ytYears.filter(Boolean).map(Number));
    var entRange = Math.min.apply(null,entYears.filter(Boolean).map(Number))+'-'+Math.max.apply(null,entYears.filter(Boolean).map(Number));
    var periodHtml = '<span class="rv-flbl">ช่วงปี</span>'+
      '<button class="chip active" onclick="rvSetPeriod(this,\'all\')">ทั้งหมด</button>'+
      '<button class="chip" onclick="rvSetPeriod(this,\'yt\')">▶ มีคลิป ('+ytRange+')</button>'+
      '<button class="chip" onclick="rvSetPeriod(this,\'ent\')">📄 เฉลย HTML ('+entRange+')</button>';
    // insert period row
    var frow = document.createElement('div'); frow.className='rv-frow'; frow.id='rv-fperiod'; frow.innerHTML=periodHtml;
    var filterDiv = document.getElementById('rv-fcat').parentNode;
    if(!document.getElementById('rv-fperiod')) filterDiv.insertBefore(frow, document.getElementById('rv-fcat'));
  }

  /* ── random cat · เลือกได้หลายหมวด ──
     data-v เก็บค่าไว้กับตัวปุ่มเอง จะได้ทาสี active ใหม่ทั้งแถวได้จาก state
     ไม่ต้องพึ่ง element ที่ถูกคลิก (เดิมใช้ rvChipActive ซึ่งรองรับได้อันเดียว) */
  var rcatHtml = '<span class="rv-flbl">หมวด</span>'+
    '<button class="chip active" data-v="" onclick="rvrSetCat(\'\')">ทั้งหมด</button>';
  RV.cats.forEach(function(c){
    rcatHtml += '<button class="chip" data-v="'+rvAttr(c)+'" onclick="rvrSetCat(this.dataset.v)">'+rvCatLabel(c)+'</button>';
  });
  document.getElementById('rvr-fcat').innerHTML = rcatHtml;
  // random lvl · เลือกได้หลายระดับ
  var rlvlHtml = '<span class="rv-flbl">ระดับ</span>'+
    '<button class="chip active" data-v="0" onclick="rvrSetLvl(0)">ทั้งหมด</button>';
  RV.levels.forEach(function(l){
    rlvlHtml += '<button class="chip" data-v="'+l+'" onclick="rvrSetLvl('+l+')">'+'★'.repeat(l)+'</button>';
  });
  document.getElementById('rvr-flvl').innerHTML = rlvlHtml;

  // random period — เหมือน browse
  if(hasYt && hasEnt) {
    var rperiodHtml = '<span class="rv-flbl">ช่วงปี</span>'+
      '<button class="chip active" onclick="rvrSetPeriod(this,\'all\')">ทั้งหมด</button>'+
      '<button class="chip" onclick="rvrSetPeriod(this,\'yt\')">▶ มีคลิป</button>'+
      '<button class="chip" onclick="rvrSetPeriod(this,\'ent\')">📄 เฉลย HTML</button>';
    var rfrow = document.createElement('div'); rfrow.className='rv-frow'; rfrow.id='rvr-fperiod'; rfrow.innerHTML=rperiodHtml;
    var rfilterDiv = document.getElementById('rvr-fcat').parentNode;
    if(!document.getElementById('rvr-fperiod')) rfilterDiv.appendChild(rfrow);
  }

  /* ── แถวบอกจำนวนข้อที่ตรงเงื่อนไข ──
     พอเลือกหลายเงื่อนไขได้ จะเกิดกรณีเลือกแล้วเหลือ 2 ข้อ แต่ตั้งจำนวนไว้ 5
     ถ้าไม่บอกไว้ก่อน นักเรียนจะงงว่าทำไมสุ่มมาไม่ครบ */
  if(!document.getElementById('rvr-count')){
    var crow = document.createElement('div');
    crow.className = 'rv-frow';
    crow.id = 'rvr-count';
    crow.style.cssText = 'font-size:12.5px; line-height:1.5;';
    document.getElementById('rvr-fcat').parentNode.appendChild(crow);
  }
  var sld = document.getElementById('rvr-slider');
  if(sld && !sld.dataset.rvBound){
    sld.dataset.rvBound = '1';
    sld.addEventListener('input', rvrUpdateCount);
  }
  rvrUpdateCount();
}

/** escape ค่าที่จะใส่ใน data-v (ชื่อหมวดมีวงเล็บ/อัญประกาศได้) */
function rvAttr(s){
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/"/g,'&quot;')
    .replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/** ทาสี active ทั้งแถวตาม state (แทน rvChipActive ที่รองรับได้อันเดียว)
    arr ว่าง = ปุ่ม "ทั้งหมด" (data-v = emptyVal) ติดอยู่อันเดียว */
function rvChipMulti(rowId, arr, emptyVal){
  var row = document.getElementById(rowId);
  if(!row) return;
  row.querySelectorAll('.chip').forEach(function(c){
    var v = c.dataset.v;
    var on = arr.length === 0 ? (v === emptyVal)
                              : (arr.indexOf(emptyVal === '0' ? Number(v) : v) > -1);
    c.classList.toggle('active', on);
  });
}

/** บอกว่าเงื่อนไขที่เลือกอยู่ตอนนี้เหลือกี่ข้อ */
function rvrUpdateCount(){
  var el = document.getElementById('rvr-count');
  if(!el) return;
  var n = rvrPool().length;
  var want = parseInt((document.getElementById('rvr-slider')||{}).value) || 5;
  var parts = [];
  if(RV.rCats.length) parts.push(RV.rCats.length + ' หมวด');
  if(RV.rLvls.length) parts.push(RV.rLvls.length + ' ระดับ');
  var pick = parts.length ? ' (เลือก ' + parts.join(' · ') + ')' : '';

  if(n === 0){
    el.innerHTML = '<span style="color:var(--danger,#e5484d)">ไม่มีข้อที่ตรงเงื่อนไขนี้' + pick + ' — ลองเลือกหมวดหรือระดับเพิ่มครับ</span>';
  } else if(n < want){
    el.innerHTML = '<span style="color:var(--warn,#d97706)">ตรงเงื่อนไข <b>' + n + '</b> ข้อ' + pick +
                   ' — สุ่มได้ ' + n + ' ข้อ (ตั้งไว้ ' + want + ')</span>';
  } else {
    el.innerHTML = '<span style="color:var(--text2)">ตรงเงื่อนไข <b>' + n + '</b> ข้อ' + pick + '</span>';
  }
}

// ── tab switch ──
function rvSwitchTab(t){
  RV.tab = t;
  document.getElementById('rvtab-browse').classList.toggle('active', t==='browse');
  document.getElementById('rvtab-random').classList.toggle('active', t==='random');
  document.getElementById('rvpane-browse').classList.toggle('active', t==='browse');
  document.getElementById('rvpane-random').classList.toggle('active', t==='random');
  if(t==='browse') rvRender();
}

// ── browse filters ──
function rvSetCat(el,v){ RV.fCat=v; rvChipActive('rv-fcat',el); rvRender(); }
function rvSetLvl(el,v){ RV.fLvl=v; rvChipActive('rv-flvl',el); rvRender(); }
function rvSetPeriod(el,v){ RV.fPeriod=v; rvChipActive('rv-fperiod',el); rvRender(); }
function rvrSetPeriod(el,v){ RV.rPeriod=v; rvChipActive('rvr-fperiod',el); rvrUpdateCount(); }
function rvToggleUnseen(){
  RV.fUnseen=!RV.fUnseen;
  var c=document.getElementById('rv-unseen-chip');
  c.classList.toggle('active',RV.fUnseen);
  c.textContent = RV.fUnseen ? 'เฉพาะที่ยังไม่ดู ✓' : 'เฉพาะที่ยังไม่ดู';
  rvRender();
}
function rvChipActive(rowId,el){
  var row=document.getElementById(rowId);
  row.querySelectorAll('.chip').forEach(function(c){c.classList.remove('active');});
  el.classList.add('active');
}

// ── browse filtered list ──
function rvFiltered(){
  var q=(document.getElementById('rv-search')||{value:''}).value.toLowerCase();
  var seen = RV_SEEN[RV.chapter]||{};
  return RV.bank.filter(function(x){
    if(RV.fCat && x.c!==RV.fCat) return false;
    if(RV.fLvl && x.l!==RV.fLvl) return false;
    if(RV.fUnseen && seen['n'+x.n]) return false;
    if(RV.fPeriod==='yt' && (x.yt||'').includes('.html#')) return false;
    if(RV.fPeriod==='ent' && !(x.yt||'').includes('.html#')) return false;
    if(q){
      var hay=((x.sub||'')+' '+(x.s||'')+' '+(x.y||'')+' '+x.n).toLowerCase();
      if(hay.indexOf(q)<0) return false;
    }
    return true;
  });
}

function rvRender(){
  var seen = RV_SEEN[RV.chapter]||{};
  var seenCount = Object.keys(seen).length;
  var pct = RV.bank.length ? Math.round(seenCount/RV.bank.length*100) : 0;
  document.getElementById('rv-total').textContent = RV.bank.length;
  document.getElementById('rv-seen').textContent = seenCount;
  document.getElementById('rv-prog').style.width = pct+'%';
  var items = rvFiltered();
  document.getElementById('rv-show').textContent = items.length;
  var list = document.getElementById('rv-list');
  if(!items.length){ list.innerHTML='<div class="d-card" style="text-align:center;color:var(--text2)">ไม่พบข้อที่ตรงกันครับ</div>'; return; }
  list.innerHTML = items.map(function(q){ return rvRowHtml(q,seen); }).join('');
}

function rvRowHtml(q,seen){
  var isSeen = !!seen['n'+q.n];
  var isEnt = (q.yt||'').includes('.html#');
  var btnLabel = isEnt ? '📄 ดูเฉลย' : '▶ ดูคลิป';
  var topic = q.sub || q.c;
  return '<div class="qrow'+(isSeen?' seen':'')+'">'+
    '<div class="qrow-left"><span class="qrow-n">'+displayN(q)+'</span>'+
    '<span class="qrow-stars">'+'★'.repeat(q.l)+'</span></div>'+
    '<div class="qrow-info"><div class="qrow-topic">'+topic+'</div>'+
    '<div class="qrow-meta"><span class="qrow-cat">'+q.c+'</span>'+
    '<span>'+(q.s||'')+'</span>'+
    (isSeen?'<span class="qrow-seen">✓ ดูแล้ว</span>':'')+'</div></div>'+
    '<a class="qrow-btn" href="'+q.yt+'" target="_blank" onclick="rvMarkSeen('+q.n+')">'+btnLabel+'</a></div>';
}

function rvMarkSeen(n){
  var q = (RV.bank||[]).find(function(x){return x.n===n;});
  var chapKey = RV.chapter;
  if(q && (q.yt||'').includes('.html#q')) chapKey = RV.chapter+' Ent';
  if(!RV_SEEN[chapKey]) RV_SEEN[chapKey]={};
  RV_SEEN[chapKey]['n'+n]=true;
  if(!RV_SEEN[RV.chapter]) RV_SEEN[RV.chapter]={};
  RV_SEEN[RV.chapter]['n'+n]=true;
  rvSave();
  if(RV.tab==='browse') setTimeout(rvRender,100);
  else setTimeout(rvrRenderResult,100);
}

// ── random filters (เลือกได้หลายอัน) ──
/** กด "ทั้งหมด" = ล้างทั้งแถว · กดหมวดอื่น = สลับเปิด/ปิดทีละอัน */
function rvrSetCat(v){
  if(v === ''){ RV.rCats = []; }
  else {
    var i = RV.rCats.indexOf(v);
    if(i > -1) RV.rCats.splice(i,1); else RV.rCats.push(v);
  }
  rvChipMulti('rvr-fcat', RV.rCats, '');
  rvrUpdateCount();
}
function rvrSetLvl(v){
  v = Number(v);
  if(!v){ RV.rLvls = []; }
  else {
    var i = RV.rLvls.indexOf(v);
    if(i > -1) RV.rLvls.splice(i,1); else RV.rLvls.push(v);
  }
  rvChipMulti('rvr-flvl', RV.rLvls, '0');
  rvrUpdateCount();
}
function rvrToggleUnseen(){
  RV.rUnseen=!RV.rUnseen;
  var c=document.getElementById('rvr-unseen-chip');
  c.classList.toggle('active',RV.rUnseen);
  c.textContent = RV.rUnseen ? 'เน้นที่ยังไม่ดู ✓' : 'เน้นที่ยังไม่ดู';
  rvrUpdateCount();
}

function rvrPool(){
  var seen = RV_SEEN[RV.chapter]||{};
  return RV.bank.filter(function(x){
    if(RV.rCats.length && RV.rCats.indexOf(x.c) < 0) return false;
    if(RV.rLvls.length && RV.rLvls.indexOf(x.l) < 0) return false;
    if(RV.rUnseen && seen['n'+x.n]) return false;
    if(RV.rPeriod==='yt' && (x.yt||'').includes('.html#')) return false;
    if(RV.rPeriod==='ent' && !(x.yt||'').includes('.html#')) return false;
    return true;
  });
}
function rvShuffle(a){ a=a.slice(); for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;} return a; }

function rvSortQueue(){
  RV.queue.sort(function(a,b){
    var ae=(a.yt||'').includes('.html#')?1:0, be=(b.yt||'').includes('.html#')?1:0;
    return (ae-be) || (Number(displayN(a))-Number(displayN(b)));
  });
}

function rvrGenerate(){
  var cnt = parseInt(document.getElementById('rvr-slider').value)||5;
  var pool = rvrPool();
  if(!pool.length){ alert('ไม่มีข้อที่ตรงเงื่อนไขครับ'); return; }
  RV.queue = rvShuffle(pool).slice(0,cnt);
  rvSortQueue();
  rvrRenderResult();
  rvrUpdateCount();
}
function rvrAddMore(){
  var cnt = Math.max(1, Math.round((parseInt(document.getElementById('rvr-slider').value)||5)/2));
  var pool = rvrPool();
  var have = {};
  RV.queue.forEach(function(q){ have[q.n]=true; });
  var avail = pool.filter(function(q){ return !have[q.n]; });
  if(!avail.length){
    var b=document.getElementById('rvr-addmore');
    if(b){ b.textContent='หมดข้อในเงื่อนไขแล้ว'; setTimeout(function(){b.textContent='＋ ขอเพิ่มอีก';},1800); }
    return;
  }
  RV.queue = RV.queue.concat(rvShuffle(avail).slice(0,cnt));
  rvSortQueue();
  rvrRenderResult();
}

function rvrRenderResult(){
  var wrap = document.getElementById('rvr-result');
  if(!RV.queue.length){ wrap.innerHTML=''; return; }
  var seen = RV_SEEN[RV.chapter]||{};
  var doneCount = RV.queue.filter(function(q){return !!seen['n'+q.n];}).length;
 
  var html = '<div class="d-card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'+
    '<span style="font-size:13px;color:var(--text2)">'+RV.queue.length+' ข้อ · ดูแล้ว '+doneCount+'/'+RV.queue.length+'</span>'+
    '<button class="addmore-btn" id="rvr-addmore" onclick="rvrAddMore()">＋ ขอเพิ่มอีก</button></div>';
  html += RV.queue.map(function(q,i){
    var isSeen=!!seen['n'+q.n];
    var topic = q.sub || q.c;
    return '<div class="qrow'+(isSeen?' seen':'')+'">'+
      '<div class="qrow-left"><span class="qrow-n">'+(i+1)+'</span>'+
      '<span class="qrow-stars">'+'★'.repeat(q.l)+'</span></div>'+
      '<div class="qrow-info"><div class="qrow-topic">'+topic+'</div>'+
      '<div class="qrow-meta"><span class="qrow-cat">'+q.c+'</span>'+
      '<span>'+(q.s||'')+' · ข้อ '+displayN(q)+'</span>'+
      (isSeen?'<span class="qrow-seen">✓ ดูแล้ว</span>':'')+'</div></div>'+
      '<a class="qrow-btn" href="'+q.yt+'" target="_blank" onclick="rvMarkSeen('+q.n+')">'+ ((q.yt||'').includes('.html#')?'📄 ดูเฉลย':'▶ ดูคลิป') +'</a></div>';
  }).join('');
  html += '</div>';
  wrap.innerHTML = html;
}