/* ============================================================
   dashboard.js — logic ทั้งหมด (render / fetch / combobox / ฝึก / พิมพ์)
   โหลดหลัง config.js และ questionbank.js
   ============================================================ */
let pinBuffer='', pinAttempts=0, currentStudent='';
let dashData = null;let dashErr='';let selectedGroups=null;
let diffChartInst=null, groupChartInst=null, distChartInst=null;

function goTo(id){ document.querySelectorAll('.page').forEach(p=>p.classList.remove('active')); document.getElementById(id).classList.add('active'); window.scrollTo(0,0); }
function resetAll(){ pinBuffer=''; pinAttempts=0; updatePinDots(); document.getElementById('attemptsMsg').textContent=''; document.getElementById('p2status').textContent=''; }

let studentList=[], selectedStudent='', comboIdx=-1;
async function loadStudents(){
  document.getElementById('p1status').className='status';
  document.getElementById('p1status').textContent='กำลังโหลดรายชื่อ...';
  try{
    const res=await fetch(`${BASE}/${SHEET_ID}/values/students!B2:B200?key=${API_KEY}`);
    const data=await res.json();
    if(data.error){document.getElementById('p1status').className='status err';document.getElementById('p1status').textContent='Error: '+data.error.message;return;}
    const seen=new Set(); studentList=[];
    (data.values||[]).forEach(r=>{if(r[0]&&!seen.has(r[0])){seen.add(r[0]);studentList.push(r[0]);}});
    document.getElementById('p1status').className='status ok';
    document.getElementById('p1status').textContent=`โหลดแล้ว ${studentList.length} คน — พิมพ์ชื่อเพื่อค้นหาได้เลย ✓`;
    const inp=document.getElementById('studentSearch'); if(inp){inp.placeholder='พิมพ์ชื่อเพื่อค้นหา… ('+studentList.length+' คน)';}
  }catch(e){document.getElementById('p1status').className='status err';document.getElementById('p1status').textContent='โหลดไม่ได้: '+e.message;}
}
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
  box.innerHTML = matches.slice(0,80).map((n,i)=>{
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
    const res=await fetch(`${BASE}/${SHEET_ID}/values/students!B2:F200?key=${API_KEY}`);
    const data=await res.json();
    if(data.error){document.getElementById('p2status').textContent='Error: '+data.error.message;return;}
    const rows=data.values||[];
    const row=rows.find(r=>r[0]===currentStudent);
    const correctPin=row&&row[4]?String(row[4]).trim():null;
    // ถ้าไม่มี PIN ตั้งไว้ หรือ PIN ไม่ตรง → reject
    if(!correctPin){
      document.getElementById('p2status').className='status err';
      document.getElementById('p2status').textContent='ยังไม่ได้ตั้ง PIN — กรุณาติดต่อครู';
      pinBuffer=''; updatePinDots(); return;
    }
    if(pinBuffer===correctPin){
      document.getElementById('p2status').textContent='';
      const short=currentStudent.replace(/\s*\(.*\)/,'');
      document.getElementById('modeAvatar').textContent=short.substring(0,3);
      document.getElementById('modeName').textContent=short;
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
<div class="hd"><h1>🎯 ชุดฝึกเพิ่ม — ${esc(p.name)}</h1><div class="meta">บท ${esc(p.topic)} · จากผลสอบวันที่ ${esc(p.date)}</div><div class="sum">รวม ${p.grand} ข้อ · เลือกจากคลังข้อสอบจริง 129 ข้อ ตามสัดส่วนที่ยังไม่แม่น</div></div>
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
function renderPracticePlan(d){
  const el=document.getElementById('s-practice'); if(!el)return;
  // หาคลังฝึก: ลองชื่อบทตรงๆ ก่อน ถ้าไม่เจอ ตัด "ชุดที่ N" ออกแล้วลองใหม่
  // normalize topic ก่อน lookup (เช่น "Exponential logarithm" → "Expo Logarithm")
  const _normT=(t)=>t?t.replace(/^Exponential logarithm/i,'Expo Logarithm'):t;
  const _nTopic=_normT(d.topic);
  let bank=PRACTICE_BANK[_nTopic];
  if(!bank){ const baseTopic=_nTopic.replace(/\s*ชุดที่\s*\d+\s*$/,'').trim(); bank=PRACTICE_BANK[baseTopic]; }
  // รวมคลัง Ent เข้ากับคลังหลัก (เช่น ตรีโกณมิติ + ตรีโกณมิติ Ent)
  if(bank){ const _base=_nTopic.replace(/\s*ชุดที่\s*\d+\s*$/,'').trim(); const _ent=PRACTICE_BANK[_base+' Ent']; if(_ent) bank=[...bank,..._ent]; }
  if(!bank){ el.innerHTML='<div class="d-card"><div style="font-size:13px;color:var(--text2);line-height:1.6;padding:4px 0">ยังไม่มีคลังฝึกพร้อมเฉลยวิดีโอสำหรับบท <b>'+d.topic+'</b> ครับ — ตอนนี้พร้อมเฉพาะบท <b>Expo Logarithm</b></div></div>'; return; }
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
  window.__practicePlan={name:d.shortName,topic:d.topic,date:d.date,grand,cats:planForPrint};
  const head=`<div class="d-card"><div class="slabel">🎯 ฝึกเพิ่มตามจุดที่พลาด — ${grand} ข้อ</div><div style="font-size:12px;color:var(--text2);line-height:1.6">เลือกโจทย์จากคลังข้อสอบจริง <b>129 ข้อ (PAT/A-Level ปี 52–68)</b> ให้ตามสัดส่วนที่ยังไม่แม่นในแต่ละหัวข้อ — ยิ่งพลาดมาก ยิ่งได้ฝึกหัวข้อนั้นเยอะ แต่ละข้อมีลิงก์เฉลยวิดีโอให้ศึกษาเองต่อได้เลย ✨</div><button class="pr-print-btn" onclick="printPracticeSet()">🖨️ พิมพ์ชุดฝึก (PDF)</button></div>`;
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
  const [resData,longData]=await Promise.all([
    fetch(`${BASE}/${SHEET_ID}/values/${encodeURIComponent('results!A:AR')}?key=${API_KEY}`).then(r=>r.json()),
    fetch(`${BASE}/${SHEET_ID}/values/${encodeURIComponent('results_long!A:H')}?key=${API_KEY}`).then(r=>r.json())
  ]);
  const rows=resData.values||[];
  if(resData.error){dashData=null;dashErr='เชื่อมต่อ Google Sheets ไม่ได้: '+(resData.error.message||'ตรวจสอบอินเทอร์เน็ต/API key');return;}
  const _norm=s=>String(s||'').replace(/\s+/g,' ').trim();
  const me=_norm(currentStudent);
  const allMine=rows.slice(1).filter(r=>_norm(r[1])===me);
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
  const score=parseInt(myRow[36])||0,care=parseInt(myRow[37])||0,concept=parseInt(myRow[38])||0,cant=parseInt(myRow[39])||0,timeout=parseInt(myRow[40])||0,wrong=cant,blank=timeout;
  const qResults={};
  for(let i=1;i<=30;i++)qResults[i]=parseStatus(myRow[5+i]||'');
  const latestByName={};
  rows.slice(1).filter(r=>r[2]===group&&(!topicFilter||(r[4]||'').includes(topicFilter))).forEach(r=>{latestByName[r[1]]=r;});
  const groupMembers=Object.values(latestByName).map(r=>({name:r[1],score:parseInt(r[36])||0,care:parseInt(r[37])||0,concept:parseInt(r[38])||0,cant:parseInt(r[39])||0,timeout:parseInt(r[40])||0,isMe:r[1]===currentStudent})).sort((a,b)=>b.score-a.score);
  const rank=groupMembers.findIndex(m=>m.isMe)+1;
  // เทียบทุกคนที่สอบบทเดียวกัน (ทุกกลุ่ม)
  const latestAllByName={};
  rows.slice(1).filter(r=>_norm(r[4])===_norm(topic)).forEach(r=>{latestAllByName[_norm(r[1])]=r;});
  const allMembers=Object.values(latestAllByName).map(r=>({name:r[1],group:r[2]||'',score:parseInt(r[36])||0,care:parseInt(r[37])||0,concept:parseInt(r[38])||0,cant:parseInt(r[39])||0,timeout:parseInt(r[40])||0,isMe:_norm(r[1])===me})).sort((a,b)=>b.score-a.score);
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
  dashData={group,date,topic,score,care,concept,cant,timeout,wrong,blank,qResults,groupMembers,rank,allMembers,allRank,allAvg,groupsInTopic,subtopics,diffMap,myAna,grpSubtopics,grpStats,shortName:currentStudent.replace(/\s*\(.*\)/,'')};
}

function showDashboard(mode){
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

function renderStudentDash(d){
  document.getElementById('s-avatar').textContent=d.shortName.substring(0,3);
  document.getElementById('s-name').textContent=d.shortName;
  document.getElementById('s-group').textContent='· '+d.group;
  document.getElementById('s-topic').textContent=d.topic+' · '+d.date;
  document.getElementById('s-rank').innerHTML=d.rank+' <span style="font-size:12px;color:var(--text3)">/ '+d.groupMembers.length+'</span>'+(d.allMembers.length>d.groupMembers.length?'<div style="font-size:10px;color:var(--text3);font-weight:400;margin-top:2px">รวมทุกกลุ่ม '+d.allRank+'/'+d.allMembers.length+'</div>':'');
  const avg=d.groupMembers.length?Math.round(d.groupMembers.reduce((s,m)=>s+m.score,0)/d.groupMembers.length):0;
  document.getElementById('s-score').innerHTML=d.score+' <span style="font-size:13px;color:var(--text3);font-weight:400">/ 30</span>';
  document.getElementById('s-scorepct').textContent=Math.round(d.score/30*100)+'% · เฉลี่ยกลุ่ม '+Math.round(avg/30*100)+'%'+(d.allMembers.length>d.groupMembers.length?' · เฉลี่ยรวม '+Math.round(d.allAvg/30*100)+'%':'');
  document.getElementById('s-wrong').innerHTML=d.wrong+' <span style="font-size:13px;color:var(--text3);font-weight:400">ผิด</span>';
  document.getElementById('s-wrongsub').textContent=d.blank+' ไม่ทำ · '+d.care+' สะเพร่า';
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
  const qClass={ok:'q-ok',care:'q-care',concept:'q-concept',cant:'q-cant',timeout:'q-timeout',wrong:'q-wrong',blank:'q-blank'};
  ['qgrid1','qgrid2'].forEach(id=>document.getElementById(id).innerHTML='');
  for(let i=1;i<=30;i++){const g=document.getElementById(i<=15?'qgrid1':'qgrid2');const el=document.createElement('div');el.className='q-cell '+qClass[d.qResults[i]];el.textContent=i;g.appendChild(el);}
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
    if(!steps.length){planEl.innerHTML='<div style="font-size:13px;color:var(--green);padding:8px 0">ทำถูกครบทุกข้อ ไม่มีอะไรต้องทบทวน 🎉</div>'; return;}
    else steps.forEach(s=>{
      planEl.innerHTML+=`<div style="display:flex;gap:12px;padding:12px 0;border-bottom:0.5px solid var(--border)">
        <div style="width:32px;height:32px;border-radius:50%;background:${s.color};color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;flex-shrink:0">${s.n}</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:600;color:var(--text1);margin-bottom:3px">${s.icon} ${s.title}</div>
          <div style="font-size:12px;color:var(--text2);line-height:1.6;margin-bottom:6px">${s.desc}</div>
          ${s.yt?`<div style="display:flex;gap:6px;flex-wrap:wrap">${s.yt.map(t=>`<a href="${ytLink(t)}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:4px;background:#FF0000;color:#fff;font-size:10px;font-weight:500;padding:3px 10px;border-radius:20px;text-decoration:none">🎬 ${t}</a>`).join('')}</div>`:''}
        </div>
      </div>`;
    });
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
    gs.innerHTML=box('คะแนนเฉลี่ยกลุ่ม',st.avg+'<span style="font-size:11px;color:var(--text3);font-weight:400"> /30</span>','จาก '+st.count+' คน','var(--blue)')
      +box('ช่วงคะแนน',st.lo+'–'+st.hi,'ต่ำสุด–สูงสุด')
      +box('สะเพร่าเฉลี่ย',st.careAvg+'<span style="font-size:11px;color:var(--text3);font-weight:400"> ข้อ</span>','ต่อคน','#C77E1A');
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
  d.groupMembers.forEach(s=>{const pct=Math.round(s.score/30*100);cl.innerHTML+=`<div class="cmp-row"><div class="cmp-name">${s.isMe?d.shortName:'เพื่อน '+(s.isMe?0:++ac)}${s.isMe?'<span class="me-tag">คุณ</span>':''}</div><div class="bar-wrap"><div class="bar-fill" style="width:${pct}%;background:${s.isMe?'#185FA5':'#B5D4F4'}"></div></div><div class="cmp-score">${s.score}/30</div></div>`;});
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
    +box('คะแนนคุณ',myScore+'<span style="font-size:11px;color:var(--text3);font-weight:400"> /30</span>',(myScore>=avg?'+':'')+(Math.round((myScore-avg)*10)/10)+' จากเฉลี่ย '+avg,myScore>=avg?'#3B7D2A':'#C77E1A');

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
        <div style="font-size:13px;font-weight:600;color:var(--text1)">${m.score}<span style="font-size:10px;color:var(--text3);font-weight:400">/30</span></div>
      </div>`;
    });
    // ถ้าฉันไม่ติด top 10 → แสดงแถวของฉันต่อท้าย
    if(myRank>10){
      top10El.innerHTML+=`<div style="text-align:center;font-size:11px;color:var(--text3);padding:4px">· · ·</div>
      <div style="display:flex;align-items:center;gap:10px;padding:7px 8px;border-radius:8px;background:var(--blue-l)">
        <div style="width:28px;text-align:center;font-size:13px;font-weight:600;color:var(--blue)">${myRank}.</div>
        <div style="flex:1;font-size:12px;color:var(--text1)">${d.shortName}<span class="me-tag">คุณ</span></div>
        <div style="font-size:13px;font-weight:600;color:var(--text1)">${myScore}<span style="font-size:10px;color:var(--text3);font-weight:400">/30</span></div>
      </div>`;
    }
  }
}

function renderParentDash(d){
  const name=d.shortName;
  const pct=Math.round(d.score/30*100);
  const avg=d.groupMembers.length?Math.round(d.groupMembers.reduce((s,m)=>s+m.score,0)/d.groupMembers.length):0;
  const avgPct=Math.round(avg/30*100);

  // ระดับ
  let level,levelClass,levelDesc;
  if(pct>=90){level='ดีเยี่ยม';levelClass='level-A';levelDesc='ทำได้เกินเป้าหมาย';}
  else if(pct>=70){level='ดี';levelClass='level-B';levelDesc='อยู่ในเกณฑ์ที่ดี';}
  else if(pct>=50){level='พอใช้';levelClass='level-C';levelDesc='ต้องพัฒนาเพิ่ม';}
  else{level='ต้องพัฒนา';levelClass='level-D';levelDesc='ต้องให้ความสนใจเป็นพิเศษ';}

  const aboveAvg=d.score>=avg;

  (function(){const el=document.getElementById('p-avatar');el.textContent=name;el.style.fontSize=name.length>5?'9px':name.length>3?'11px':'13px';el.style.lineHeight='1.2';el.style.textAlign='center';}());
  document.getElementById('p-topic').textContent=d.topic+' · '+d.date;
  // แสดงชื่อนักเรียนใน header parent view
  const _pHeader=document.querySelector('#p5 .container [style*="font-size:15px"]');
  if(_pHeader) _pHeader.textContent='รายงานผลการเรียน — '+name;

  // summary
  document.getElementById('p-summary').innerHTML=`
    <div style="font-size:13px;color:var(--blue);font-weight:500;margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em">ภาพรวมการสอบครั้งนี้</div>
    <div class="summary-headline">
      <span class="summary-highlight">${name}</span> ทำคะแนนได้
      <span class="summary-highlight">${d.score}/30 คะแนน (${pct}%)</span>
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
        ? `— <span class="summary-highlight green">สูงกว่าค่าเฉลี่ยรวม</span> (${Math.round(d.allAvg/30*100)}%)`
        : `— ค่าเฉลี่ยรวมอยู่ที่ ${Math.round(d.allAvg/30*100)}%`}
    </div>`:''}`;

  // วิเคราะห์ปัญหา
  const problems=[];
  // ── สรุปรวมต้องทบทวน ──
  const totalReview=(d.care||0)+(d.concept||0)+(d.cant||0)+(d.timeout||0);
  if(totalReview>0)problems.push({icon:'🔁',color:'var(--amber-bg,#fff7ed)',border:'var(--amber,#f59e0b)',count:totalReview,countColor:'var(--amber,#f59e0b)',title:'ต้องทบทวนรวม '+totalReview+' ข้อ',desc:'แบ่งเป็น: ⚠️สะเพร่า '+(d.care||0)+' | 🧠คอนเซปต์ '+(d.concept||0)+' | ❌ทำไม่ได้ '+(d.cant||0)+' | ⏰ไม่ทัน '+(d.timeout||0)+' ข้อ'});
  if((d.concept||0)>0)problems.push({icon:'🧠',color:'#f3e8ff',border:'#a855f7',count:(d.concept||0),countColor:'#a855f7',title:'คอนเซปต์ยังไม่แน่น '+(d.concept||0)+' ข้อ',desc:'ทำผิดเพราะยังไม่เข้าใจทฤษฎี — ควรกลับไปทบทวนคอนเซปต์ก่อนทำโจทย์เพิ่ม'});
  if((d.cant||0)>0)problems.push({icon:'❌',color:'#fee2e2',border:'#ef4444',count:(d.cant||0),countColor:'#ef4444',title:'ทำไม่ได้ '+(d.cant||0)+' ข้อ',desc:'ยังขาดทักษะ — ควรดูคลิปหรือให้ครูอธิบายเพิ่มเติมแล้วลองทำใหม่'});
  if((d.timeout||0)>0)problems.push({icon:'⏰',color:'#f1f5f9',border:'#94a3b8',count:(d.timeout||0),countColor:'#94a3b8',title:'ไม่ทันเวลา '+(d.timeout||0)+' ข้อ',desc:'ทำไม่ทันในห้อง — ฝึกจับเวลาและทำข้อง่ายก่อนเพื่อสร้างความเร็ว'});
  if(d.wrong>0)problems.push({icon:'🔴',color:'var(--red-l)',border:'var(--red)',title:'เนื้อหาที่ยังต้องเรียนรู้เพิ่ม',desc:`ทำผิด ${d.wrong} ข้อ — เป็นจุดที่ยังไม่เข้าใจเต็มที่ แก้ได้ด้วยการทบทวนเพิ่มเติมจากคลิป เอกสาร หรือถามผู้รู้ ไม่ใช่เรื่องน่ากังวล แต่เป็นโอกาสพัฒนา`,count:d.wrong,countColor:'var(--red)'});
  if(d.care>0)problems.push({icon:'🟡',color:'var(--amber-l)',border:'var(--amber)',title:'รู้คำตอบแล้ว แต่พลาดจากความรีบ',desc:`พลาด ${d.care} ข้อทั้งที่ทำเป็น — ความรอบคอบเป็นทักษะที่ฝึกได้เหมือนกล้ามเนื้อ ลองชวนลูกอธิบายวิธีตรวจคำตอบให้ฟัง จะช่วยได้มากกว่าการเตือนให้ระวัง`,count:d.care,countColor:'var(--amber)'});
  if(d.blank>0)problems.push({icon:'⬜',color:'var(--surf)',border:'var(--border-md)',title:'ข้อที่ยังไม่ได้ลงมือทำ',desc:`มี ${d.blank} ข้อที่เว้นไว้ — ลองถามลูกด้วยความเข้าใจว่าเป็นเพราะเวลาไม่พอ ยังไม่เข้าใจโจทย์ หรือไม่มั่นใจ เพื่อช่วยให้ตรงจุด`,count:d.blank,countColor:'var(--text3)'});

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
  if(d.wrong>=5)actions.push({title:'วางแผนทบทวนหัวข้อที่อ่อน',color:'var(--blue)',text:`มีจุดที่ยังไม่เข้าใจหลายข้อ โดยเฉพาะ "${weak.length?weak[0].name:'หัวข้อที่ทำผิด'}" — สนับสนุนให้ลูกวางแผนทบทวนเอง เช่น ดูคลิปติวเพิ่ม ทำโจทย์เก่าในหัวข้อนั้นซ้ำ หรือถามเพื่อน/ครูท่านอื่นที่โรงเรียน การเข้าใจให้แน่นสำคัญกว่าเร่งทำเยอะ`});
  if(d.care>=3)actions.push({title:'ฝึกความรอบคอบแบบเจาะจุด',color:'var(--amber)',text:`พลาดจากความรีบ ${d.care} ข้อ — ลองให้ลูกจดว่าแต่ละข้อพลาดเพราะอะไร (อ่านโจทย์ตก/คำนวณพลาด/ลอกเลขผิด) พอเห็นรูปแบบที่ตัวเองพลาดซ้ำ จะแก้ได้ตรงจุด ตั้งเป้าแคบ ๆ ว่าครั้งหน้าลดให้เหลือครึ่งหนึ่ง`});
  if(d.blank>=3)actions.push({title:'พูดคุยด้วยความเข้าใจ',color:'var(--text2)',text:`มี ${d.blank} ข้อที่ไม่ได้ทำ — ลองคุยกับลูกแบบเปิดใจว่าเป็นเพราะเวลาไม่พอ ไม่เข้าใจโจทย์ หรือกังวล การรับฟังโดยไม่ตำหนิจะช่วยให้ลูกกล้าบอกปัญหาที่แท้จริง`});
  if(aboveAvg&&pct>=70)actions.push({title:'ชื่นชมที่ความพยายาม',color:'var(--green)',text:`${name} ทำได้ดีและเหนือค่าเฉลี่ยกลุ่ม — ลองชมที่ "ความตั้งใจและวิธีคิด" มากกว่าแค่ "เก่ง" เพราะช่วยให้ลูกเชื่อว่าความสำเร็จมาจากความพยายามที่ควบคุมได้`});
  if(!actions.length)actions.push({title:'รักษาจังหวะที่ดีไว้',color:'var(--green)',text:`ผลการสอบอยู่ในเกณฑ์ดีมาก ให้กำลังใจและติดตามอย่างสม่ำเสมอ ความต่อเนื่องคือกุญแจสำคัญของการเตรียมสอบแพทย์`});

  const pa=document.getElementById('p-actions');pa.innerHTML='';
  actions.forEach(a=>{pa.innerHTML+=`<div class="action-card" style="border-left-color:${a.color}"><div class="action-title" style="color:${a.color}">${a.title}</div><div class="action-text">${a.text}</div></div>`;});
  // ── คำถามชวนคุย — ปรับตามผลสอบจริง ──
  const talkEl=document.getElementById('p-talkList');
  if(talkEl){
    talkEl.innerHTML='';
    const talks=[];
    talks.push('"บทนี้ข้อไหนที่ภูมิใจว่าทำได้ที่สุด?" — เริ่มจากจุดแข็งก่อนเสมอ');
    if(d.care>0)talks.push('"ข้อที่พลาดเพราะรีบ ถ้าย้อนกลับไปได้จะทำต่างจากเดิมยังไง?" — ให้ลูกคิดวิธีแก้เอง ดีกว่าบอกให้ระวัง');
    if(d.blank>0)talks.push('"ข้อที่เว้นไว้ เจอตอนไหนของเวลาสอบ?" — ช่วยรู้ว่าปัญหาคือการจัดเวลาหรือความมั่นใจ');
    if(d.wrong>0)talks.push('"หัวข้อไหนที่อยากเข้าใจมากขึ้น?" — เปิดทางให้ลูกขอความช่วยเหลือโดยไม่เสียหน้า');
    talks.push('"มีอะไรให้พ่อแม่ช่วยไหม?" — บางครั้งแค่ถามก็เพียงพอแล้ว');
    talks.forEach(t=>{
      talkEl.innerHTML+=`<div style="display:flex;gap:10px;padding:8px 0;border-bottom:0.5px solid var(--border)">
        <div style="color:var(--blue);flex-shrink:0">•</div>
        <div style="font-size:13px;color:var(--text1);line-height:1.6">${t}</div>
      </div>`;
    });
  }

  // q-grid
  const qClass={ok:'q-ok',care:'q-care',concept:'q-concept',cant:'q-cant',timeout:'q-timeout',wrong:'q-wrong',blank:'q-blank'};
  ['p-qgrid1','p-qgrid2'].forEach(id=>document.getElementById(id).innerHTML='');
  for(let i=1;i<=30;i++){const g=document.getElementById(i<=15?'p-qgrid1':'p-qgrid2');const el=document.createElement('div');el.className='q-cell '+qClass[d.qResults[i]];el.textContent=i;g.appendChild(el);}
}

function switchTab(name){
  const names=['questions','subtopic','plan','practice','compare'];
  document.querySelectorAll('.tab').forEach((t,i)=>t.classList.toggle('active',names[i]===name));
  document.querySelectorAll('.pane').forEach(p=>p.classList.toggle('active',p.id==='pane-'+name));
  // ถ้ากด tab กลุ่ม → resize chart เพื่อแก้กรณี canvas วาดตอน pane ซ่อนอยู่
  if(name==='compare'){
    setTimeout(()=>{
      try{if(groupChartInst) groupChartInst.resize();}catch(e){}
      try{if(distChartInst)  distChartInst.resize();}catch(e){}
    }, 50);
  }
}
document.addEventListener('DOMContentLoaded',()=>{try{loadStudents();}catch(e){}});
