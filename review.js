function displayN(n){ return n; }
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

// state
var RV = {
  chapter: null,      // ชื่อบทที่เลือก (key ใน PRACTICE_BANK)
  bank: [],           // ข้อในบทนั้น
  cats: [],           // หมวดที่มี
  levels: [],         // ระดับที่มี
  fCat: '', fLvl: 0, fUnseen: false,            // filter เลือกข้อเอง
  rCat: '', rLvl: 0, rUnseen: false,            // filter สุ่ม
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
  Object.keys(chapMap).forEach(function(base){
    var ch = chapMap[base];
    var totalQ = ch.yt.length + ch.ent.length;
    var icon = RV_CHAP_ICON[base] || '📘';
    var seenYt = RV_SEEN[base] ? Object.keys(RV_SEEN[base]).length : 0;
    var seenEnt = RV_SEEN[base+' Ent'] ? Object.keys(RV_SEEN[base+' Ent']).length : 0;
    var seenTotal = seenYt + seenEnt;
    var subParts = [];
    if(ch.yt.length) subParts.push(ch.yt.length+' ข้อมีคลิป');
    if(ch.ent.length) subParts.push(ch.ent.length+' ข้อเฉลย HTML');
    var sub = subParts.join(' + ');
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
  RV.bank = ytBank.concat(entBank);
  if(!RV_SEEN[base]) RV_SEEN[base]={};
  rvOpenChapterCore();
}
function rvOpenChapter(chap){
  RV.chapter = chap;
  RV.bank = PRACTICE_BANK[chap] || [];
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
  RV.rCat=''; RV.rLvl=0; RV.rUnseen=false; RV.rPeriod='all';
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

  // random cat
  var rcatHtml = '<span class="rv-flbl">หมวด</span>'+
    '<button class="chip active" onclick="rvrSetCat(this,\'\')">ทั้งหมด</button>';
  RV.cats.forEach(function(c){
    rcatHtml += '<button class="chip" onclick="rvrSetCat(this,\''+c.replace(/'/g,"\\'")+'\')">'+rvCatLabel(c)+'</button>';
  });
  document.getElementById('rvr-fcat').innerHTML = rcatHtml;
  // random lvl
  var rlvlHtml = '<span class="rv-flbl">ระดับ</span>'+
    '<button class="chip active" onclick="rvrSetLvl(this,0)">ทั้งหมด</button>';
  RV.levels.forEach(function(l){
    rlvlHtml += '<button class="chip" onclick="rvrSetLvl(this,'+l+')">'+'★'.repeat(l)+'</button>';
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
function rvrSetPeriod(el,v){ RV.rPeriod=v; rvChipActive('rvr-fperiod',el); }
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

// ── random filters ──
function rvrSetCat(el,v){ RV.rCat=v; rvChipActive('rvr-fcat',el); }
function rvrSetLvl(el,v){ RV.rLvl=v; rvChipActive('rvr-flvl',el); }
function rvrToggleUnseen(){
  RV.rUnseen=!RV.rUnseen;
  var c=document.getElementById('rvr-unseen-chip');
  c.classList.toggle('active',RV.rUnseen);
  c.textContent = RV.rUnseen ? 'เน้นที่ยังไม่ดู ✓' : 'เน้นที่ยังไม่ดู';
}

function rvrPool(){
  var seen = RV_SEEN[RV.chapter]||{};
  return RV.bank.filter(function(x){
    if(RV.rCat && x.c!==RV.rCat) return false;
    if(RV.rLvl && x.l!==RV.rLvl) return false;
    if(RV.rUnseen && seen['n'+x.n]) return false;
    if(RV.rPeriod==='yt' && (x.yt||'').includes('.html#')) return false;
    if(RV.rPeriod==='ent' && !(x.yt||'').includes('.html#')) return false;
    return true;
  });
}
function rvShuffle(a){ a=a.slice(); for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;} return a; }

function rvrGenerate(){
  var cnt = parseInt(document.getElementById('rvr-slider').value)||5;
  var pool = rvrPool();
  if(!pool.length){ alert('ไม่มีข้อที่ตรงเงื่อนไขครับ'); return; }
  RV.queue = rvShuffle(pool).slice(0,cnt);
  rvrRenderResult();
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
  rvrRenderResult();
}

function rvrRenderResult(){
  var wrap = document.getElementById('rvr-result');
  if(!RV.queue.length){ wrap.innerHTML=''; return; }
  var seen = RV_SEEN[RV.chapter]||{};
  var doneCount = RV.queue.filter(function(q){return !!seen['n'+q.n];}).length;
  var isEnt = (q.yt||'').includes('.html#');
  var btnLabel = isEnt ? '📄 ดูเฉลย' : '▶ ดูคลิป';
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
