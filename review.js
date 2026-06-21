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
  var keys = Object.keys(PRACTICE_BANK);
  keys.forEach(function(k){
    var arr = PRACTICE_BANK[k];
    if(!arr || !arr.length) return;
    var baseName = k.replace(/ Ent$/,'');
    var icon = RV_CHAP_ICON[baseName] || RV_CHAP_ICON[k] || '📘';
    var seenCount = RV_SEEN[k] ? Object.keys(RV_SEEN[k]).length : 0;
    var label = k;
    var sub = arr.length + ' ข้อ';
    if(k.indexOf('Ent')>-1) sub += ' · เฉลย HTML';
    else sub += ' · มีคลิป';
    if(seenCount>0) sub += ' · ดูแล้ว '+seenCount;
    html += '<div class="chap-card" onclick="rvOpenChapter(\''+k.replace(/'/g,"\\'")+'\')">'+
      '<div class="chap-icon">'+icon+'</div>'+
      '<div class="chap-info"><div class="chap-name">'+label+'</div>'+
      '<div class="chap-count">'+sub+'</div></div>'+
      '<div class="chap-arrow">›</div></div>';
  });
  document.getElementById('rv-chapList').innerHTML = html || '<div class="d-card" style="text-align:center;color:var(--text2)">ยังไม่มีคลังข้อสอบครับ</div>';
}

// ── เปิดบท → หน้ารายข้อ ──
function rvOpenChapter(chap){
  RV.chapter = chap;
  RV.bank = PRACTICE_BANK[chap] || [];
  RV.cats = [];
  RV.levels = [];
  RV.bank.forEach(function(q){
    if(RV.cats.indexOf(q.c)<0) RV.cats.push(q.c);
    if(RV.levels.indexOf(q.l)<0) RV.levels.push(q.l);
  });
  RV.levels.sort(function(a,b){return a-b;});
  RV.fCat=''; RV.fLvl=0; RV.fUnseen=false;
  RV.rCat=''; RV.rLvl=0; RV.rUnseen=false;
  RV.queue=[]; RV.tab='browse';
  if(!RV_SEEN[chap]) RV_SEEN[chap]={};

  var baseName = chap.replace(/ Ent$/,'');
  document.getElementById('rv-chapIcon').textContent = RV_CHAP_ICON[baseName] || RV_CHAP_ICON[chap] || '📘';
  document.getElementById('rv-chapName').textContent = chap;
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
  var isEnt = RV.chapter.indexOf('Ent')>-1;
  var btnLabel = isEnt ? '📄 ดูเฉลย' : '▶ ดูคลิป';
  var topic = q.sub || q.c;
  return '<div class="qrow'+(isSeen?' seen':'')+'">'+
    '<div class="qrow-left"><span class="qrow-n">'+q.n+'</span>'+
    '<span class="qrow-stars">'+'★'.repeat(q.l)+'</span></div>'+
    '<div class="qrow-info"><div class="qrow-topic">'+topic+'</div>'+
    '<div class="qrow-meta"><span class="qrow-cat">'+q.c+'</span>'+
    '<span>'+(q.s||'')+'</span>'+
    (isSeen?'<span class="qrow-seen">✓ ดูแล้ว</span>':'')+'</div></div>'+
    '<a class="qrow-btn" href="'+q.yt+'" target="_blank" onclick="rvMarkSeen('+q.n+')">'+btnLabel+'</a></div>';
}

function rvMarkSeen(n){
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
  var isEnt = RV.chapter.indexOf('Ent')>-1;
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
      '<span>'+(q.s||'')+' · ข้อ '+q.n+'</span>'+
      (isSeen?'<span class="qrow-seen">✓ ดูแล้ว</span>':'')+'</div></div>'+
      '<a class="qrow-btn" href="'+q.yt+'" target="_blank" onclick="rvMarkSeen('+q.n+')">'+btnLabel+'</a></div>';
  }).join('');
  html += '</div>';
  wrap.innerHTML = html;
}
