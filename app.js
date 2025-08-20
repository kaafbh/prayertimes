// ======= ثوابت ومساعدات عامة =======
const PRAYERS = ["Fajr","Dhuhr","Asr","Maghrib","Isha"];
const DISPLAY = {Fajr:"الفجر", Dhuhr:"الظهر", Asr:"العصر", Maghrib:"المغرب", Isha:"العشاء"};
const el = id => document.getElementById(id);
const status = msg => { const s = el('status'); if(s) s.textContent = msg; };
const pad = n => n.toString().padStart(2,'0');
const qs = new URLSearchParams(location.search);
const SCREEN_MODE = qs.get('screen') || (qs.has('screen') ? '1' : null);
const SCREEN = SCREEN_MODE === '1';
const SCREEN2 = SCREEN_MODE === '2';
const AUTO_AUDIO = qs.get('autoplay') === '1' || qs.get('autoaudio') === '1';

if (SCREEN2) { document.body.classList.add('screen2'); }
else if (SCREEN) { document.body.classList.add('screen'); }

function nowString(){
  const d = new Date();
  const yyyy = d.getFullYear(); const mm = pad(d.getMonth()+1); const dd = pad(d.getDate());
  let h = d.getHours(); const ap = h>=12 ? 'م' : 'ص'; h = h%12 || 12;
  const mi = pad(d.getMinutes()); const ss = pad(d.getSeconds());
  return `الآن: ${yyyy}-${mm}-${dd} ${h}:${mi}:${ss} ${ap}`;
}

function parseTimeToDate(dateStr, timeStr, tzOffsetMin=0){
  if(!timeStr) return null;
  const arDigits = '٠١٢٣٤٥٦٧٨٩';
  let s = (''+timeStr).trim()
    .replace(/[٠-٩]/g, d => String(arDigits.indexOf(d)))
    .replace(/\s*ص\s*$/i, ' AM')
    .replace(/\s*م\s*$/i, ' PM');
  const m = s.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if(!m) return null;
  let h = parseInt(m[1],10), min = parseInt(m[2],10);
  const ap = m[3] ? m[3].toUpperCase() : null;
  if(ap){ if(ap==='PM' && h!==12) h += 12; if(ap==='AM' && h===12) h = 0; }
  const d = new Date(dateStr + 'T' + String(h).padStart(2,'0') + ':' + String(min).padStart(2,'0') + ':00');
  if(tzOffsetMin){ d.setMinutes(d.getMinutes() + tzOffsetMin); }
  return d;
}

function fmtClock(date, mode){
  if(!(date instanceof Date)) return '—';
  let h = date.getHours(); let m = date.getMinutes();
  if(mode==='12'){ const ap = h>=12 ? 'م':'ص'; h = h%12 || 12; return `${h}:${pad(m)} ${ap}`; }
  return `${pad(h)}:${pad(m)}`;
}

function fmtDuration(ms){
  if(ms<0) ms=0; const s = Math.floor(ms/1000);
  const hh = Math.floor(s/3600); const mm = Math.floor((s%3600)/60); const ss = s%60;
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
}

function loadLS(key, fallback){ try{ const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }catch{ return fallback; } }
function saveLS(key, val){ try{ localStorage.setItem(key, JSON.stringify(val)); }catch(e){ console.warn('LocalStorage save failed', key, e); if(e && (e.name==='QuotaExceededError'||e.code===22)) alert('التخزين المحلي ممتلئ.'); } }

// ======= IndexedDB =======
let dbPromise = null;
function getDB(){ if(dbPromise) return dbPromise; dbPromise = new Promise((resolve,reject)=>{ const open=indexedDB.open('ptt_db',1); open.onupgradeneeded=()=>{ const db=open.result; if(!db.objectStoreNames.contains('files')) db.createObjectStore('files'); }; open.onsuccess=()=>resolve(open.result); open.onerror=()=>reject(open.error); }); return dbPromise; }
async function idbSet(key, blob){ const db=await getDB(); return new Promise((res,rej)=>{ const tx=db.transaction('files','readwrite'); tx.objectStore('files').put(blob,key); tx.oncomplete=()=>res(); tx.onerror=()=>rej(tx.error); }); }
async function idbGet(key){ const db=await getDB(); return new Promise((res,rej)=>{ const tx=db.transaction('files','readonly'); const rq=tx.objectStore('files').get(key); rq.onsuccess=()=>res(rq.result||null); rq.onerror=()=>rej(rq.error); }); }
async function idbDelete(key){ const db=await getDB(); return new Promise((res,rej)=>{ const tx=db.transaction('files','readwrite'); tx.objectStore('files').delete(key); tx.oncomplete=()=>res(); tx.onerror=()=>rej(tx.error); }); }
async function idbClear(){ const db=await getDB(); return new Promise((res,rej)=>{ const tx=db.transaction('files','readwrite'); tx.objectStore('files').clear(); tx.oncomplete=()=>res(); tx.onerror=()=>rej(tx.error); }); }
function dataURLtoBlob(dataURL){ try{ const [meta,b64]=dataURL.split(','); const mime=(meta.match(/data:(.*?);base64/)||[])[1]||'application/octet-stream'; const bin=atob(b64); const len=bin.length; const arr=new Uint8Array(len); for(let i=0;i<len;i++) arr[i]=bin.charCodeAt(i); return new Blob([arr],{type:mime}); }catch(e){ console.warn('dURL->Blob failed',e); return null; } }
function blobToDataURL(blob){ return new Promise((res,rej)=>{ const fr=new FileReader(); fr.onload=()=>res(fr.result); fr.onerror=()=>rej(fr.error); fr.readAsDataURL(blob); }); }

const INVALID_KEY_CHARS = /[.#$\/\[\]]/g;
function sanitizeDateKey(k){
  if(!k) return null;
  const s = String(k).trim();
  const m = s.match(/(\d{4})[\-\/_.\s](\d{2})[\-\/_.\s](\d{2})/);
  if(!m) return null;
  const y=m[1], mo=m[2], d=m[3];
  const iso = `${y}-${mo}-${d}`.replace(INVALID_KEY_CHARS,'');
  return iso;
}
function sanitizeScheduleForFirebase(sch){
  const out={};
  for(const k of Object.keys(sch||{})){
    const nk = sanitizeDateKey(k);
    if(!nk) continue;
    out[nk] = sch[k];
  }
  return out;
}

// ======= الحالة =======
const state = {
  schedule: loadLS('ptt_schedule', {}),
  offsets: loadLS('ptt_offsets', {Fajr:20,Dhuhr:25,Asr:20,Maghrib:10,Isha:15}),
  audioFlags: loadLS('ptt_audioFlags', {athan:false, iqama:false, alert:false}),
  ui: loadLS('ptt_ui', {
    font:"Cairo, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    googleFontUrl:"",
    colors:{
      accent:'#6ee7b7', accent2:'#60a5fa', text:'#f7f9fc',
      phaseAthan:'#60a5fa', phaseIqama:'#fbbf24', phaseGrace:'#a8b3cf', phaseAlert:'#ef4444',
      bg:'#0b1220', bgNormal:'#0b1220', bgIqama:'#1b2a46', bgGrace:'#342a1b', bgAlert:'#3a1b1b'
    },
    bgImageKey:null, bgMode:'color', timeFormat:'12', tzOffset:0, graceMin:8, alertMin:5
  }),
  audioEnabled: false,
  phase: 'athan',
  next: null,
  cloud: loadLS('ptt_cloud', {enabled:false, roomId:'Media_Office', config:{}, signedIn:false, email:'', password:''})
};

// ======= Firebase & Cloud =======
let fb={app:null, auth:null, db:null, storage:null, unsub:null};
function cloudStatus(msg){ const x=el('cloudStatus'); if(x) x.textContent = msg; }
function getRoomPath(){ const room = (state.cloud.roomId||'Media_Office').replace(/[^a-zA-Z0-9_-]/g,'-'); return `rooms/${room}`; }
function getRefs(){ const base=getRoomPath(); return { base, schedule:`${base}/schedule`, offsets:`${base}/offsets`, ui:`${base}/ui`, media:`${base}/media`}; }
function normalizeBucket(b){ return b || ''; }
function bucketForGS(){
  const b = (state.cloud.config||{}).storageBucket || '';
  if(!b) return '';
  return b.replace(/\.firebasestorage\.app$/i, '.appspot.com');
}
function initFirebase(){
  try{
    if(!state.cloud.config || !state.cloud.config.apiKey){ cloudStatus('أدخل إعدادات Firebase أولًا'); return false; }
    if(typeof window.firebase === 'undefined'){ cloudStatus('سكرِبتات Firebase لم تُحمّل'); return false; }
    if(!fb.app){ fb.app = firebase.initializeApp(state.cloud.config); }
    if(!fb.auth) fb.auth=firebase.auth();
    if(!fb.db) fb.db=firebase.database();
    if(!fb.storage) fb.storage=firebase.storage();
    cloudStatus('جاهز (غير مسجل)');
    return true;
  }catch(e){ console.warn('initFirebase failed', e); cloudStatus('فشل التهيئة'); fb={app:null,auth:null,db:null,storage:null,unsub:null}; return false; }
}
async function fbLogin(){ try{ if(!initFirebase()) return; const {email,password} = state.cloud; await fb.auth.signInWithEmailAndPassword(email, password); cloudStatus('متصل ومُسجّل'); state.cloud.signedIn=true; saveLS('ptt_cloud', state.cloud); if(state.cloud.enabled) subscribeCloud(); }catch(e){ alert('تسجيل الدخول فشل: '+e.message); cloudStatus('فشل تسجيل الدخول'); } }
async function fbLogout(){ try{ if(fb.auth) await fb.auth.signOut(); state.cloud.signedIn=false; saveLS('ptt_cloud', state.cloud); cloudStatus('غير متصل'); if(fb.unsub){ fb.unsub(); fb.unsub=null; } }catch(e){} }

function subscribeCloud(){ if(!initFirebase()) return; if(fb.unsub){ fb.unsub(); fb.unsub=null; }
  const r=getRefs(); cloudStatus('متصل (استقبال مباشر)');
  const on = (path, handler)=> fb.db.ref(path).on('value', snap=>{ const val=snap.val(); if(val==null) return; handler(val); });
  on(r.schedule, (v)=>{ state.schedule=sanitizeScheduleForFirebase(v); saveLS('ptt_schedule', state.schedule); renderTable(); renderTodayPills(); });
  on(r.offsets,  (v)=>{ state.offsets=v; saveLS('ptt_offsets', v); });
  on(r.ui,       (v)=>{ state.ui={...state.ui,...v}; saveLS('ptt_ui', state.ui); applyTheme(); setPhaseVisuals(); renderTodayPills(); });
  on(r.media,    (v)=>{
    if(v.athanUrl){ audioAthan.src = v.athanUrl; }
    if(v.iqamaUrl){ audioIqama.src = v.iqamaUrl; }
    if(v.alertUrl){ audioAlert.src = v.alertUrl; }
    if(v.bgUrl && state.ui.bgMode==='image'){ document.body.style.backgroundImage = `url(${v.bgUrl})`; }
  });
  fb.unsub = ()=>{ fb.db.ref(r.schedule).off(); fb.db.ref(r.offsets).off(); fb.db.ref(r.ui).off(); fb.db.ref(r.media).off(); cloudStatus('تم إيقاف الاستقبال'); };
}

async function pullFromCloud(){
  if(!initFirebase()) { cloudStatus('Firebase غير مهيّأ'); return false; }
  try{
    const r = getRefs();
    const [sch, off, ui, media] = await Promise.all([
      fb.db.ref(r.schedule).once('value'),
      fb.db.ref(r.offsets).once('value'),
      fb.db.ref(r.ui).once('value'),
      fb.db.ref(r.media).once('value'),
    ]);
    if(sch.exists()){ state.schedule = sanitizeScheduleForFirebase(sch.val()); saveLS('ptt_schedule', state.schedule); }
    if(off.exists()){ state.offsets = off.val(); saveLS('ptt_offsets', state.offsets); }
    if(ui.exists()){ state.ui = {...state.ui, ...ui.val()}; saveLS('ptt_ui', state.ui); }
    applyTheme(); renderTable(); renderTodayPills();
    const m = media.val()||{};
    if(m.athanUrl) audioAthan.src=m.athanUrl;
    if(m.iqamaUrl) audioIqama.src=m.iqamaUrl;
    if(m.alertUrl) audioAlert.src=m.alertUrl;
    if(m.bgUrl && state.ui.bgMode==='image') document.body.style.backgroundImage=`url(${m.bgUrl})`;
    cloudStatus('تم السحب من السحابة');
    return true;
  }catch(e){
    printErrorDetails('pullFromCloud failed', e);
    cloudStatus('فشل السحب');
    return false;
  }
}

// ======= خلفية بحسب الحالة =======
let preAlertActive=false;
function applyPhaseBackground(){
  if(state.ui.bgMode==='image'){ return; }
  let color = state.ui.colors.bg;
  if(state.ui.bgMode==='phase'){
    if(preAlertActive) color = state.ui.colors.bgAlert || state.ui.colors.bg;
    else if(state.phase==='athan') color = state.ui.colors.bgNormal || state.ui.colors.bg;
    else if(state.phase==='iqama') color = state.ui.colors.bgIqama || state.ui.colors.bg;
    else color = state.ui.colors.bgGrace || state.ui.colors.bg;
  } else if(state.ui.bgMode==='color'){
    color = state.ui.colors.bg;
  }
  document.body.style.backgroundImage = '';
  document.body.style.background = color;
}

function applyTheme(){
  const c = state.ui.colors || {};
  document.body.style.setProperty('--accent', c.accent||'#6ee7b7');
  document.body.style.setProperty('--accent-2', c.accent2||'#60a5fa');
  document.body.style.setProperty('--text', c.text||'#f7f9fc');
  document.body.style.setProperty('--phase-athan', c.phaseAthan||'#60a5fa');
  document.body.style.setProperty('--phase-iqama', c.phaseIqama||'#fbbf24');
  document.body.style.setProperty('--phase-grace', c.phaseGrace||'#a8b3cf');
  document.body.style.setProperty('--phase-alert', c.phaseAlert||'#ef4444');
  document.body.style.setProperty('--bg-normal', c.bgNormal||'#0b1220');
  document.body.style.setProperty('--bg-iqama', c.bgIqama||'#1b2a46');
  document.body.style.setProperty('--bg-grace', c.bgGrace||'#342a1b');
  document.body.style.setProperty('--bg-alert', c.bgAlert||'#3a1b1b');
  document.body.style.setProperty('--bg', c.bg||'#0b1220');
  document.body.style.fontFamily = state.ui.font || 'Cairo, system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  if(state.ui.googleFontUrl){ const link = document.getElementById('googleFontLink'); if(link) link.href = state.ui.googleFontUrl; }
  if(state.ui.bgMode==='image'){
    loadBgFromStore();
  } else {
    applyPhaseBackground();
  }
}

// ======= عرض اليوم =======
function renderTable(){
  const tb = el('scheduleTable')?.querySelector('tbody'); if(!tb) return;
  tb.innerHTML='';
  const dates=Object.keys(state.schedule).sort();
  for(const d of dates){
    const r=state.schedule[d];
    const tr=document.createElement('tr');
    tr.innerHTML = `<td>${d}</td>` + PRAYERS.map(p=>`<td>${r[p]||'—'}</td>`).join('');
    tb.appendChild(tr);
  }
}
function renderTodayPills(){
  const grid = el('todayGrid'); if(!grid) return;
  grid.innerHTML='';
  const todayKey=toKey(todayLocal());
  const row=state.schedule[todayKey];
  for(const p of PRAYERS){
    const div=document.createElement('div');
    div.className='pill';
    const timeStr=row?row[p]:'—';
    const dt=row?parseTimeToDate(todayKey, timeStr, state.ui.tzOffset):null;
    div.innerHTML = `<div class="label">${DISPLAY[p]}</div><div class="value">${fmtClock(dt||'—', state.ui.timeFormat)}</div>`;
    grid.appendChild(div);
  }
}

// ======= خلفية الصورة من IndexedDB =======
let bgUrl = null;
async function loadBgFromStore(){
  try{
    if(state.ui.bgMode!=='image'){ document.body.style.backgroundImage=''; return; }
    const blob=await idbGet('ptt_bgImage');
    if(bgUrl){ URL.revokeObjectURL(bgUrl); bgUrl=null; }
    if(blob){
      bgUrl=URL.createObjectURL(blob);
      document.body.style.backgroundImage=`url(${bgUrl})`;
    } else {
      document.body.style.backgroundImage='';
    }
  }catch(e){ console.warn('load bg failed',e); }
}

// ======= الحساب =======
function todayLocal(){ const n=new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
function toKey(d){ return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function findNext(){
  const now = new Date(); const todayKey=toKey(todayLocal()); const todayRow=state.schedule[todayKey];
  const sequence=[];
  if(todayRow){
    for(const p of PRAYERS){
      const t=todayRow[p]; if(!t) continue;
      const athanAt=parseTimeToDate(todayKey,t,state.ui.tzOffset); if(!athanAt) continue;
      const off=state.offsets[p]||0; const iqamaAt=new Date(athanAt.getTime()+off*60000);
      sequence.push({day:todayKey,prayerName:p,athanAt,iqamaAt});
    }
  }
  const nextDay=new Date(todayLocal()); nextDay.setDate(nextDay.getDate()+1);
  const nextKey=toKey(nextDay); const nextRow=state.schedule[nextKey];
  if(nextRow){
    for(const p of PRAYERS){
      const t=nextRow[p]; if(!t) continue;
      const athanAt=parseTimeToDate(nextKey,t,state.ui.tzOffset); if(!athanAt) continue;
      const off=state.offsets[p]||0; const iqamaAt=new Date(athanAt.getTime()+off*60000);
      sequence.push({day:nextKey,prayerName:p,athanAt,iqamaAt});
    }
  }
  const nowMs=now.getTime();
  for(const item of sequence){
    const graceEnd=new Date(item.iqamaAt.getTime()+(state.ui.graceMin||0)*60000);
    if(nowMs < item.athanAt.getTime()){ state.phase='athan'; return item; }
    if(nowMs>=item.athanAt.getTime() && nowMs<item.iqamaAt.getTime()){ state.phase='iqama'; return item; }
    if(nowMs>=item.iqamaAt.getTime() && nowMs<graceEnd.getTime()){ state.phase='grace'; return item; }
  }
  return sequence[0]||null;
}

let timer=null; let lastPhaseKey=''; let lastPreAlertKey='';
function setPhaseVisuals(){
  const ph = el('phase'); if(!ph) return;
  ph.classList.remove('phase-athan','phase-iqama','phase-grace','phase-prealert');
  if(state.phase==='athan') ph.classList.add('phase-athan');
  else if(state.phase==='iqama') ph.classList.add('phase-iqama');
  else ph.classList.add('phase-grace');
  if(preAlertActive) ph.classList.add('phase-prealert');
  // وميض الشريط
  const prog = el('progress');
  if(prog){
    if(preAlertActive) prog.classList.add('prealert'); else prog.classList.remove('prealert');
  }
  applyPhaseBackground();
}

// ======= الصوت =======
const audioAthan = document.getElementById('audioAthan'); const audioIqama = document.getElementById('audioIqama'); const audioAlert = document.getElementById('audioAlert');
let athanUrl=null, iqamaUrl=null, alertUrl=null;
async function loadAudios(){
  try{
    const a=await idbGet('ptt_audioAthan'); if(athanUrl){ URL.revokeObjectURL(athanUrl); athanUrl=null; }
    if(a){ athanUrl=URL.createObjectURL(a); audioAthan.src=athanUrl; state.audioFlags.athan=true; } else { audioAthan.removeAttribute('src'); state.audioFlags.athan=false; }
    const q=await idbGet('ptt_audioIqama'); if(iqamaUrl){ URL.revokeObjectURL(iqamaUrl); iqamaUrl=null; }
    if(q){ iqamaUrl=URL.createObjectURL(q); audioIqama.src=iqamaUrl; state.audioFlags.iqama=true; } else { audioIqama.removeAttribute('src'); state.audioFlags.iqama=false; }
    const z=await idbGet('ptt_audioAlert'); if(alertUrl){ URL.revokeObjectURL(alertUrl); alertUrl=null; }
    if(z){ alertUrl=URL.createObjectURL(z); audioAlert.src=alertUrl; state.audioFlags.alert=true; } else { audioAlert.removeAttribute('src'); state.audioFlags.alert=false; }
    saveLS('ptt_audioFlags', state.audioFlags);
  }catch(e){ console.warn('loadAudios failed',e); }
}
function enableAudio(){ state.audioEnabled=true; [audioAthan,audioIqama,audioAlert].forEach(a=>{ a.muted=true; a.play().catch(()=>{}).finally(()=>{ a.pause(); a.currentTime=0; a.muted=false; }); }); status('تم تفعيل الصوت'); updateFloatingAudio(); }
function updateFloatingAudio(){ const fa=el('floatingAudio'); if(!fa) return; if((SCREEN || SCREEN2) && !state.audioEnabled) fa.classList.add('show'); else fa.classList.remove('show'); }

// ======= المؤقت =======
function start(){
  if(timer) clearInterval(timer);
  loadAudios(); renderTable(); renderTodayPills();
  timer = setInterval(()=>{
    const nowEl=el('now'); if(nowEl) nowEl.textContent = nowString();
    const now = new Date(); const next = findNext(); state.next=next;
    if(!next){
      el('nextPrayerName').textContent='لا توجد مواعيد';
      el('nextPrayerClock').textContent='—';
      el('countdown').textContent='—';
      el('phase').textContent='ارفع جدول المواعيد للبدء';
      el('bar').style.width='0%'; return;
    }
    const name=next.prayerName; const athanAt=next.athanAt; const iqamaAt=next.iqamaAt; const graceEnd=new Date(iqamaAt.getTime()+(state.ui.graceMin||0)*60000);
    const target=(state.phase==='athan')?athanAt:(state.phase==='iqama'?iqamaAt:graceEnd); const until=target.getTime()-now.getTime();
    el('nextPrayerName').textContent = DISPLAY[name]||name;
    el('nextPrayerClock').textContent = fmtClock(athanAt, state.ui.timeFormat);
    el('phase').textContent = state.phase==='athan' ? 'حتى الأذان' : (state.phase==='iqama' ? 'حتى الإقامة' : 'الصلاة قائمة');

    // منطق التنبيه قبل الإقامة
    const remainToIqama = iqamaAt.getTime()-now.getTime();
    const alertMs = Math.max(0, (state.ui.alertMin ?? 5) * 60000);
    const nowPre = (state.phase==='iqama' && remainToIqama>0 && remainToIqama<=alertMs);
    if(nowPre && lastPreAlertKey !== `${name}-${next.day}-prealert`){
      if(state.audioEnabled && audioAlert && audioAlert.src){ try{ audioAlert.currentTime=0; audioAlert.play(); }catch{} }
      lastPreAlertKey = `${name}-${next.day}-prealert`;
    }
    preAlertActive = nowPre;
    setPhaseVisuals();

    el('countdown').textContent = fmtDuration(until);
    let totalPhase=0, elapsed=0;
    if(state.phase==='athan'){ const MAX=90*60000; totalPhase=MAX; elapsed=Math.min(MAX, Math.max(0, MAX-until)); }
    else if(state.phase==='iqama'){ totalPhase=iqamaAt.getTime()-athanAt.getTime(); elapsed=Math.max(0, Math.min(totalPhase, (now.getTime()-athanAt.getTime()))); }
    else { totalPhase=graceEnd.getTime()-iqamaAt.getTime(); elapsed=Math.max(0, Math.min(totalPhase, (now.getTime()-iqamaAt.getTime()))); }
    const pct = totalPhase>0 ? (elapsed/totalPhase)*100 : 0; el('bar').style.width = pct.toFixed(1)+'%';
    const key = `${name}-${state.phase}`;

    if(until<=0){
      if(state.audioEnabled){
        try{
          if(state.phase==='athan'){ audioAthan.currentTime=0; audioAthan.play(); }
          if(state.phase==='iqama'){ audioIqama.currentTime=0; audioIqama.play(); }
        }catch(e){}
      }
      if(state.phase==='athan'){ state.phase='iqama'; preAlertActive=false; }
      else if(state.phase==='iqama'){ state.phase='grace'; preAlertActive=false; }
      else { state.phase='athan'; preAlertActive=false; const _=findNext(); }
    }
    lastPhaseKey=key;
  }, 250);
}

// ======= CSV & JSON =======
function parseCSV(text){
  const lines=text.replace(/\r/g,'').trim().split(/\n+/);
  if(lines.length===0) return {};
  const header=lines[0].split(',').map(h=>h.trim().toLowerCase());
  const findIdx=(keys)=>{ for(const k of keys){ const i=header.indexOf(k); if(i!==-1) return i; } return -1; };
  const idx = { date:findIdx(['date','التاريخ']), fajr:findIdx(['fajr','الفجر']), dhuhr:findIdx(['dhuhr','الظهر']), asr:findIdx(['asr','العصر']), maghrib:findIdx(['maghrib','المغرب']), isha:findIdx(['isha','العشاء']) };
  const out={};
  for(let i=1;i<lines.length;i++){
    const cols=lines[i].split(',').map(c=>c.trim());
    const rawDate=cols[idx.date];
    const date=sanitizeDateKey(rawDate);
    if(!date) continue;
    out[date] = {
      Fajr:cols[idx.fajr]||'',
      Dhuhr:cols[idx.dhuhr]||'',
      Asr:cols[idx.asr]||'',
      Maghrib:cols[idx.maghrib]||'',
      Isha:cols[idx.isha]||''
    };
  }
  return out;
}

function handleScheduleFile(file){
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      let data={};
      if(file.name.toLowerCase().endsWith('.json')){
        const obj=JSON.parse(reader.result);
        if(Array.isArray(obj)){
          for(const r of obj){
            const rawDate=r.date||r['التاريخ'];
            const date=sanitizeDateKey(rawDate);
            if(!date) continue;
            data[date] = {
              Fajr:r.fajr||r['الفجر']||'',
              Dhuhr:r.dhuhr||r['الظهر']||'',
              Asr:r.asr||r['العصر']||'',
              Maghrib:r.maghrib||r['المغرب']||'',
              Isha:r.isha||r['العشاء']||''
            };
          }
        } else {
          for(const k of Object.keys(obj)){
            const date=sanitizeDateKey(k);
            if(!date) continue;
            const r=obj[k];
            data[date]={
              Fajr:r.Fajr||r.fajr||r['الفجر']||'',
              Dhuhr:r.Dhuhr||r.dhuhr||r['الظهر']||'',
              Asr:r.Asr||r.asr||r['العصر']||'',
              Maghrib:r.Maghrib||r.maghrib||r['المغرب']||'',
              Isha:r.Isha||r.isha||r['العشاء']||''
            };
          }
        }
      } else {
        data = parseCSV(reader.result);
      }
      state.schedule = {...sanitizeScheduleForFirebase(state.schedule), ...data};
      saveLS('ptt_schedule', state.schedule);
      renderTable(); renderTodayPills();
      status('تم تحميل الجدول');
      if(state.cloud.enabled){
        pushToCloud({schedule:true}).then(ok=>{ if(ok) status('تم إرسال الجدول إلى السحابة'); });
      }
    }catch(e){
      alert('تعذّر تحليل الجدول: '+e.message);
    }
  };
  reader.readAsText(file);
}

// ======= مزامنة بيانات (جدول/إعدادات) =======
function pushToCloud({schedule=false, offsets=false, ui=false}={}){
  if(!state.cloud.enabled) { cloudStatus('المزامنة متوقفة'); return Promise.resolve(false); }
  if(!initFirebase()) { cloudStatus('Firebase غير مهيّأ'); return Promise.resolve(false); }
  if(!fb || !fb.db || typeof fb.db.ref !== 'function'){ cloudStatus('قاعدة البيانات غير جاهزة'); return Promise.resolve(false); }

  const cleanSchedule = sanitizeScheduleForFirebase(state.schedule);
  state.schedule = cleanSchedule; saveLS('ptt_schedule', state.schedule);

  const r=getRefs(); const updates={};
  if(schedule) updates[r.schedule] = cleanSchedule;
  if(offsets)  updates[r.offsets]  = state.offsets;
  if(ui)       updates[r.ui]       = state.ui;
  if(!Object.keys(updates).length) return Promise.resolve(true);
  cloudStatus('يتم إرسال التعديلات...');
  try{
    return fb.db.ref().update(updates)
      .then(()=>{ cloudStatus('تمت مزامنة البيانات'); return true; })
      .catch(e=>{ console.warn('push failed',e); cloudStatus('فشل الكتابة: '+(e?.code||e?.message||e)); alert('فشل رفع البيانات إلى السحابة:\n'+(e?.message||e)); return false; });
  }catch(e){
    console.warn('push threw', e);
    cloudStatus('فشل الكتابة'); alert('فشل رفع البيانات إلى السحابة:\n'+(e?.message||e?.code||e)); return Promise.resolve(false);
  }
}

// ======= رفع الوسائط إلى التخزين =======
function printErrorDetails(prefix, err){
  const out = document.getElementById('testOutput');
  const code = err && err.code || '';
  const msg  = err && (err.message || err.toString()) || String(err);
  const line = `${prefix}: ${code || ''} ${msg}`.trim();
  console.warn(line, err);
  if(out){
    out.textContent = (out.textContent? out.textContent+'\n':'') + line;
    try{
      const more = JSON.stringify({code:err.code, message:err.message, name:err.name}, null, 2);
      out.textContent += '\n' + more;
    }catch{}
  }
}
async function uploadToStorage(file, key){
  try{
    if(!initFirebase()) return null; if(!fb.storage) return null;
    const user = fb.auth && fb.auth.currentUser;
    if(!user){ alert('يجب تسجيل الدخول لرفع الوسائط (حسب القواعد).'); return null; }
    const room = (state.cloud.roomId||'Media_Office').replace(/[^a-zA-Z0-9_-]/g,'-');
    const path = `rooms/${room}/${key}`;
    const bucket = bucketForGS();
    const gs = bucket ? `gs://${bucket}/${path}` : null;
    const storage = fb.storage;
    const ref = gs ? storage.refFromURL(gs) : storage.ref().child(path);
    const meta = { contentType: file.type || 'application/octet-stream' };

    const info = `رفع → user=${user.email} | bucket=${bucket||'(default)'} | gs=${gs||'(none)'} | path=${path} | size=${file.size}B`;
    console.log(info);
    const out = document.getElementById('testOutput'); if(out){ out.textContent = (out.textContent? out.textContent+'\n':'') + info; }

    const task = ref.put(file, meta);
    task.on('state_changed',
      snap => {
        const pct = Math.floor((snap.bytesTransferred / snap.totalBytes) * 100);
        if(out){ out.textContent = out.textContent.replace(/(\n)?%?\s*التقدم:.+$/,''); out.textContent += `\nالتقدم: ${pct}%`; }
      },
      err => {
        printErrorDetails('فشل الرفع', err);
        let hint = '';
        const code = err && err.code || '';
        if(code.includes('unauthenticated')) hint = 'سجّل الدخول ثم أعد المحاولة.';
        else if(code.includes('unauthorized')) hint = 'قواعد Storage لا تسمح بالكتابة. تأكد من allow write: if request.auth != null في rooms/**.';
        else if(code.includes('invalid-argument')) hint = 'storageBucket غير صحيح. يجب أن يكون اسم البكت (appspot.com) أو اتركه ليستخدم الافتراضي.';
        else if(code.includes('project-not-found') || code.includes('app-not-authorized')) hint = 'تحقّق من apiKey/authDomain/databaseURL.';
        else if(code.includes('quota-exceeded')) hint = 'تجاوزت الحصة. جرّب ملفًا أصغر أو راجع خطة المشروع.';
        if(hint && out){ out.textContent += '\n🔎 تلميح: ' + hint; }
        alert('فشل رفع الملف للسحابة: '+(err && (err.message||err.code) || err));
      },
      async () => {
        try{
          const url = await ref.getDownloadURL();
          await fb.db.ref(getRefs().media).update({[key+'Url']: url});
          const okLine = `تم الرفع وكتابة الرابط: ${key}Url = ${url}`;
          console.log(okLine);
          if(out){ out.textContent += '\n' + okLine; }
          cloudStatus('مرفوع إلى السحابة');
        }catch(e){
          printErrorDetails('فشل الحصول على رابط التنزيل', e);
          alert('تم الرفع لكن تعذّر الحصول على رابط التنزيل:\n'+(e && (e.message||e.code) || e));
        }
      }
    );
    return true;
  }catch(e){
    printErrorDetails('Storage upload threw', e);
    alert('فشل رفع الملف للسحابة: '+(e && (e.message||e.code) || e));
    return null;
  }
}

async function diagnoseStorage(){
  const out = document.getElementById('testOutput'); if(out){ out.textContent = 'تشخيص التخزين بدأ...\n'; }
  try{
    if(!initFirebase()){ alert('Firebase غير مهيّأ'); return; }
    const user = fb.auth && fb.auth.currentUser;
    const authState = user ? `مسجل: ${user.email}` : 'غير مسجل';
    const bucket = bucketForGS();
    const room = (state.cloud.roomId||'Media_Office').replace(/[^a-zA-Z0-9_-]/g,'-');
    const path = `rooms/${room}/__diag_${Date.now()}.bin`;
    const gs = bucket ? `gs://${bucket}/${path}` : '(default)';
    const info = `حالة: ${authState}\nBucket: ${bucket||'(default)'}\nPath: ${path}\nGS: ${gs}\n`;
    console.log(info); if(out){ out.textContent += info; }

    const blob = new Blob([new Uint8Array([1,2,3,4,5])], {type:'application/octet-stream'});
    const ref = bucket ? fb.storage.refFromURL(`gs://${bucket}/${path}`) : fb.storage.ref().child(path);

    await ref.put(blob).then(async snap => {
      const url = await ref.getDownloadURL();
      await fb.db.ref(getRefs().media).update({diagUrl: url, diagAt: Date.now()});
      const ok = `✅ الكتابة نجحت، URL: ${url}`;
      console.log(ok); if(out){ out.textContent += ok + '\n'; }
    }).catch(err => {
      printErrorDetails('❌ الكتابة فشلت', err);
    });
  }catch(e){
    printErrorDetails('تشخيص التخزين تعطل', e);
  }
}
function urlStatusLine(name, url, ok, status){
  return `${ok ? '✅' : '❌'} ${name}: ${url || '(لا يوجد رابط)'}${status ? ' — ' + status : ''}`;
}
function buildScreenUrl(which){
  const params = new URLSearchParams({ screen: String(which), autoplay:'1' });
  if(state.cloud && state.cloud.enabled){
    params.set('cloud','1');
    params.set('room', state.cloud.roomId || 'Media_Office');
    const c = state.cloud.config || {};
    if(c.apiKey) params.set('apiKey', c.apiKey);
    if(c.authDomain) params.set('authDomain', c.authDomain);
    if(c.databaseURL) params.set('databaseURL', c.databaseURL);
    if(c.storageBucket) params.set('storageBucket', c.storageBucket);
  }
  return location.origin + location.pathname + '?' + params.toString();
}
async function testCloudMedia(){
  try{
    if(!initFirebase()) { alert('Firebase غير مهيّأ'); return; }
    const out = document.getElementById('testOutput'); if(out) out.textContent = 'جارِ اختبار وسائط السحابة...\n';
    const refs = getRefs();
    const snap = await fb.db.ref(refs.media).once('value');
    const media = snap.val() || {};
    const results = [];
    const tests = [
      {k:'athanUrl', label:'رابط الأذان', apply: (u)=>{ if(u) { try{ audioAthan.src = u; }catch{} } }},
      {k:'iqamaUrl', label:'رابط الإقامة', apply: (u)=>{ if(u) { try{ audioIqama.src = u; }catch{} } }},
      {k:'alertUrl', label:'رابط التنبيه', apply: (u)=>{ if(u) { try{ audioAlert.src = u; }catch{} } }},
      {k:'bgUrl', label:'رابط الخلفية', apply: (u)=>{ if(u) { try{ document.body.style.backgroundImage = `url(${u})`; }catch{} } }},
    ];
    for(const t of tests){
      const url = media[t.k] || '';
      let ok=false, statusText='';
      if(url){
        try{
          const res = await fetch(url, {method:'GET', mode:'cors'});
          ok = res.ok;
          statusText = `HTTP ${res.status}`;
        }catch(e){
          ok = false; statusText = e && (e.message || e.code) || 'fetch error';
        }
        try{ t.apply(url); }catch{}
      }
      results.push(urlStatusLine(t.label, url, ok, statusText));
    }
    const roomLine = `Room: ${state.cloud.roomId || 'Media_Office'}  |  Bucket: ${(state.cloud.config||{}).storageBucket || '(auto)'}`;
    const s1 = buildScreenUrl(1); const s2 = buildScreenUrl(2);
    const joined = roomLine + '\n' + results.join('\n') + '\n\nروابط جاهزة:\n- شاشة 1: ' + s1 + '\n- شاشة 2: ' + s2;
    console.log(joined);
    if(out){ out.textContent = joined; }
    cloudStatus('اختبار الوسائط اكتمل');
  }catch(e){
    printErrorDetails('Media test error', e);
  }
}

// ======= أدوات النسخ الاحتياطي =======
async function exportWithMedia(){
  const data = {schedule:state.schedule, offsets:state.offsets, ui:state.ui, media:{}};
  try{
    const a = await idbGet('ptt_audioAthan'); if(a) data.media.audioAthan = await blobToDataURL(a);
    const q = await idbGet('ptt_audioIqama'); if(q) data.media.audioIqama = await blobToDataURL(q);
    const z = await idbGet('ptt_audioAlert'); if(z) data.media.audioAlert = await blobToDataURL(z);
    const bg = await idbGet('ptt_bgImage'); if(bg) data.media.bgImage = await blobToDataURL(bg);
  }catch(e){ console.warn('collect media failed', e); }
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const aTag = document.createElement('a'); aTag.href = url; aTag.download = 'prayer-tracker-backup-with-media.json'; aTag.click(); URL.revokeObjectURL(url);
}
function exportData(){
  const blob = new Blob([JSON.stringify({schedule:state.schedule, offsets:state.offsets, ui:state.ui}, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'prayer-tracker-backup.json'; a.click(); URL.revokeObjectURL(url);
}
function importDataDialog(){
  const inp = document.createElement('input'); inp.type='file'; inp.accept='.json';
  inp.onchange = e=>{ const f=e.target.files?.[0]; if(!f) return; const r=new FileReader(); r.onload=async ()=>{ try{ const data=JSON.parse(r.result);
    if(data.schedule){ state.schedule = sanitizeScheduleForFirebase(data.schedule); saveLS('ptt_schedule', state.schedule); }
    if(data.offsets){ state.offsets = data.offsets; saveLS('ptt_offsets', state.offsets); }
    if(data.ui){ state.ui = {...state.ui, ...data.ui}; saveLS('ptt_ui', state.ui); }
    if(data.media){
      if(data.media.audioAthan){ const b=dataURLtoBlob(data.media.audioAthan); if(b) await idbSet('ptt_audioAthan', b); }
      if(data.media.audioIqama){ const b=dataURLtoBlob(data.media.audioIqama); if(b) await idbSet('ptt_audioIqama', b); }
      if(data.media.audioAlert){ const b=dataURLtoBlob(data.media.audioAlert); if(b) await idbSet('ptt_audioAlert', b); }
      if(data.media.bgImage){ const b=dataURLtoBlob(data.media.bgImage); if(b) await idbSet('ptt_bgImage', b); }
    }
    await loadAudios(); await loadBgFromStore(); applyTheme(); renderTable(); renderTodayPills(); status('تم استيراد النسخة الاحتياطية');
  }catch(e){ alert('ملف احتياطي غير صالح'); } }; r.readAsText(f); };
  inp.click();
}

// ======= أدوات الواجهة =======
async function copyToClipboard(text){
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
    status('تم نسخ الرابط للحافظة');
  }catch(e){
    alert('تعذّر نسخ الرابط تلقائيًا. انسخه يدويًا:\n' + text);
  }
}
function buildUrlFromState(screenWhich){
  const params = new URLSearchParams({ screen: String(screenWhich), autoplay:'1' });
  if(state.cloud && state.cloud.enabled){
    params.set('cloud','1');
    params.set('room', state.cloud.roomId || 'Media_Office');
    const c = state.cloud.config || {};
    if(c.apiKey) params.set('apiKey', c.apiKey);
    if(c.authDomain) params.set('authDomain', c.authDomain);
    if(c.databaseURL) params.set('databaseURL', c.databaseURL);
    if(c.storageBucket) params.set('storageBucket', c.storageBucket);
  }
  return location.origin + location.pathname + '?' + params.toString();
}
function initControls(){
  // فتح الشاشتين
  document.getElementById('openScreen')?.addEventListener('click', ()=> window.open(buildUrlFromState(1), '_blank'));
  document.getElementById('openScreen2')?.addEventListener('click', ()=> window.open(buildUrlFromState(2), '_blank'));
  document.getElementById('copyScreenLink')?.addEventListener('click', ()=> copyToClipboard(buildUrlFromState(1)));
  document.getElementById('copyScreen2Link')?.addEventListener('click', ()=> copyToClipboard(buildUrlFromState(2)));

  // تفعيل الصوت
  document.getElementById('enableAudioBtn')?.addEventListener('click', enableAudio);
  document.getElementById('enableAudioFloating')?.addEventListener('click', enableAudio);

  // رفع الجدول
  document.getElementById('scheduleFile').addEventListener('change', (e)=>{ const f=e.target.files?.[0]; if(f) handleScheduleFile(f); });
  const drop = document.getElementById('dropzone');
  drop.addEventListener('dragover', e=>{ e.preventDefault(); drop.style.background='rgba(255,255,255,0.08)';});
  drop.addEventListener('dragleave', e=>{ drop.style.background='rgba(255,255,255,0.04)';});
  drop.addEventListener('drop', e=>{ e.preventDefault(); drop.style.background='rgba(255,255,255,0.04)'; const f=e.dataTransfer.files?.[0]; if(f) handleScheduleFile(f); });

  // الإقامات والسماح
  const map = {Fajr:'offFajr', Dhuhr:'offDhuhr', Asr:'offAsr', Maghrib:'offMaghrib', Isha:'offIsha'};
  for(const p of PRAYERS){ document.getElementById(map[p]).value = state.offsets[p] ?? 0; }
  document.getElementById('graceMin').value = state.ui.graceMin ?? 8;
  const pre = document.getElementById('preAlertMin'); pre.value = state.ui.alertMin ?? 5; document.getElementById('preAlertMinLabel').textContent = pre.value;

  // الأصوات
  document.getElementById('athanSound').addEventListener('change', async e=>{
    const f=e.target.files?.[0]; if(!f) return;
    try{ await idbSet('ptt_audioAthan', f); await loadAudios(); status('تم تعيين صوت الأذان'); if(state.cloud.enabled) await uploadToStorage(f, 'athan'); } catch(err){ alert('تعذّر حفظ/رفع صوت الأذان.'); }
  });
  document.getElementById('iqamaSound').addEventListener('change', async e=>{
    const f=e.target.files?.[0]; if(!f) return;
    try{ await idbSet('ptt_audioIqama', f); await loadAudios(); status('تم تعيين صوت الإقامة'); if(state.cloud.enabled) await uploadToStorage(f, 'iqama'); } catch(err){ alert('تعذّر حفظ/رفع صوت الإقامة.'); }
  });
  document.getElementById('alertSound').addEventListener('change', async e=>{
    const f=e.target.files?.[0]; if(!f) return;
    try{ await idbSet('ptt_audioAlert', f); await loadAudios(); status('تم تعيين صوت التنبيه'); if(state.cloud.enabled) await uploadToStorage(f, 'alert'); } catch(err){ alert('تعذّر حفظ/رفع صوت التنبيه.'); }
  });
  document.getElementById('testAthan').onclick = ()=>{ if(state.audioEnabled && audioAthan.src) { audioAthan.currentTime=0; audioAthan.play(); } else alert('فعّل الصوت وعيّن ملفًا أولًا.'); };
  document.getElementById('testIqama').onclick = ()=>{ if(state.audioEnabled && audioIqama.src) { audioIqama.currentTime=0; audioIqama.play(); } else alert('فعّل الصوت وعيّن ملفًا أولًا.'); };
  document.getElementById('testAlert').onclick = ()=>{ if(state.audioEnabled && audioAlert.src) { audioAlert.currentTime=0; audioAlert.play(); } else alert('فعّل الصوت وعيّن ملفًا أولًا.'); };
  document.getElementById('clearAthan').onclick = async ()=>{ try{ await idbDelete('ptt_audioAthan'); await loadAudios(); status('تم حذف صوت الأذان'); if(state.cloud.enabled) await fb.db.ref(getRefs().media).update({athanUrl:null}); }catch{} };
  document.getElementById('clearIqama').onclick = async ()=>{ try{ await idbDelete('ptt_audioIqama'); await loadAudios(); status('تم حذف صوت الإقامة'); if(state.cloud.enabled) await fb.db.ref(getRefs().media).update({iqamaUrl:null}); }catch{} };
  document.getElementById('clearAlert').onclick = async ()=>{ try{ await idbDelete('ptt_audioAlert'); await loadAudios(); status('تم حذف صوت التنبيه'); if(state.cloud.enabled) await fb.db.ref(getRefs().media).update({alertUrl:null}); }catch{} };

  // الخط والألوان والخلفية
  document.getElementById('googleFontUrl').value = state.ui.googleFontUrl || '';
  document.getElementById('accent').value = state.ui.colors.accent; document.getElementById('accent2').value = state.ui.colors.accent2; document.getElementById('bg').value = state.ui.colors.bg; document.getElementById('textColor').value = state.ui.colors.text;
  document.getElementById('phaseAthanColor').value = state.ui.colors.phaseAthan || '#60a5fa';
  document.getElementById('phaseIqamaColor').value = state.ui.colors.phaseIqama || '#fbbf24';
  document.getElementById('phaseGraceColor').value = state.ui.colors.phaseGrace || '#a8b3cf';
  document.getElementById('phaseAlertColor').value = state.ui.colors.phaseAlert || '#ef4444';
  document.getElementById('bgMode').value = state.ui.bgMode || 'color';
  document.getElementById('bgNormal').value = state.ui.colors.bgNormal || '#0b1220';
  document.getElementById('bgIqama').value = state.ui.colors.bgIqama || '#1b2a46';
  document.getElementById('bgGrace').value = state.ui.colors.bgGrace || '#342a1b';
  document.getElementById('bgAlert').value = state.ui.colors.bgAlert || '#3a1b1b';
  document.getElementById('bgMode').addEventListener('change', ()=>{ state.ui.bgMode = document.getElementById('bgMode').value; saveLS('ptt_ui', state.ui); applyTheme(); if(state.cloud.enabled){ pushToCloud({ui:true}); } });

  if(document.getElementById('bgImage')){
    document.getElementById('bgImage').addEventListener('change', async e=>{ const f=e.target.files?.[0]; if(!f) return; try{ await idbSet('ptt_bgImage', f); state.ui.bgMode='image'; saveLS('ptt_ui', state.ui); await loadBgFromStore(); status('تم تعيين الخلفية'); if(state.cloud.enabled) await uploadToStorage(f, 'bg'); } catch(err){ alert('تعذّر حفظ/رفع الخلفية.'); } });
  }
  if(document.getElementById('clearBg')){
    document.getElementById('clearBg').onclick = async ()=>{ try{ await idbDelete('ptt_bgImage'); state.ui.bgMode='color'; saveLS('ptt_ui', state.ui); await loadBgFromStore(); applyTheme(); status('تمت إزالة الخلفية'); if(state.cloud.enabled) await fb.db.ref(getRefs().media).update({bgUrl:null}); }catch{} };
  }

  // الوقت والمنطقة
  document.getElementById('timeFormat').value = state.ui.timeFormat || '12'; document.getElementById('tzOffset').value = state.ui.tzOffset || 0;

  // السحابة
  document.getElementById('cloudEnabled').value = state.cloud.enabled ? 'on' : 'off';
  document.getElementById('cloudEnabled').addEventListener('change', ()=>{
    state.cloud.enabled = document.getElementById('cloudEnabled').value === 'on';
    saveLS('ptt_cloud', state.cloud);
    if(state.cloud.enabled){ subscribeCloud(); } else if(fb.unsub){ fb.unsub(); fb.unsub=null; cloudStatus('المزامنة متوقفة'); }
  });
  document.getElementById('roomId').value = state.cloud.roomId || 'Media_Office';
  const cfg = state.cloud.config||{}; document.getElementById('fb_apiKey').value = cfg.apiKey||''; document.getElementById('fb_authDomain').value=cfg.authDomain||''; document.getElementById('fb_databaseURL').value=cfg.databaseURL||''; document.getElementById('fb_storageBucket').value=cfg.storageBucket||'';

  document.getElementById('fbConnect').onclick = ()=>{ state.cloud.config = { apiKey:document.getElementById('fb_apiKey').value.trim(), authDomain:document.getElementById('fb_authDomain').value.trim(), databaseURL:document.getElementById('fb_databaseURL').value.trim(), storageBucket:normalizeBucket(document.getElementById('fb_storageBucket').value.trim()) }; const room=document.getElementById('roomId').value.trim(); if(room) state.cloud.roomId=room; saveLS('ptt_cloud', state.cloud); if(initFirebase()) cloudStatus('جاهز'); };
  document.getElementById('fbLogin').onclick = ()=>{ state.cloud.email = document.getElementById('fb_email').value.trim(); state.cloud.password = document.getElementById('fb_password').value; saveLS('ptt_cloud', state.cloud); fbLogin(); };
  document.getElementById('fbLogout').onclick = fbLogout;
  document.getElementById('fbTest').onclick = ()=>{ if(!initFirebase()) return; try{ const testRef = fb.db.ref(getRefs().base+'/ping'); testRef.set(Date.now()).then(()=> cloudStatus('اتصال قاعدة البيانات OK (كتابة)')).catch(e=> cloudStatus('اتصال القراءة OK — الكتابة فشلت: '+(e?.code||e?.message))); }catch(e){ cloudStatus('فشل الاختبار'); } };

  // روابط الشاشة والنسخ
  document.getElementById('openScreen').onclick = ()=>{ window.open(buildScreenUrl(1), '_blank'); };
  document.getElementById('openScreen2').onclick = ()=>{ window.open(buildScreenUrl(2), '_blank'); };
  document.getElementById('copyScreenLink').onclick = ()=> copyToClipboard(buildScreenUrl(1));
  document.getElementById('copyScreen2Link').onclick = ()=> copyToClipboard(buildScreenUrl(2));

  // الحفظ والإرسال
  document.getElementById('saveSettings').onclick = ()=>{
    const map = {Fajr:'offFajr', Dhuhr:'offDhuhr', Asr:'offAsr', Maghrib:'offMaghrib', Isha:'offIsha'};
    for(const p of PRAYERS){ state.offsets[p] = parseInt(document.getElementById(map[p]).value||'0', 10) || 0; }
    state.ui.graceMin = parseInt(document.getElementById('graceMin').value||'8',10);
    state.ui.alertMin = parseInt(document.getElementById('preAlertMin').value||'5',10);
    state.ui.colors.accent = document.getElementById('accent').value;
    state.ui.colors.accent2 = document.getElementById('accent2').value;
    state.ui.colors.text = document.getElementById('textColor').value;
    state.ui.colors.phaseAthan = document.getElementById('phaseAthanColor').value;
    state.ui.colors.phaseIqama = document.getElementById('phaseIqamaColor').value;
    state.ui.colors.phaseGrace = document.getElementById('phaseGraceColor').value;
    state.ui.colors.phaseAlert = document.getElementById('phaseAlertColor').value;
    state.ui.colors.bg = document.getElementById('bg').value;
    state.ui.colors.bgNormal = document.getElementById('bgNormal').value;
    state.ui.colors.bgIqama = document.getElementById('bgIqama').value;
    state.ui.colors.bgGrace = document.getElementById('bgGrace').value;
    state.ui.colors.bgAlert = document.getElementById('bgAlert').value;
    state.ui.bgMode = document.getElementById('bgMode').value;
    state.ui.timeFormat = document.getElementById('timeFormat').value;
    state.ui.tzOffset = parseInt(document.getElementById('tzOffset').value||'0',10) || 0;
    state.ui.googleFontUrl = document.getElementById('googleFontUrl').value.trim();
    saveLS('ptt_ui', state.ui); saveLS('ptt_offsets', state.offsets);
    applyTheme(); setPhaseVisuals(); renderTodayPills();
    status('تم الحفظ');
    if(state.cloud.enabled) pushToCloud({offsets:true, ui:true});
  };
  document.getElementById('pushAll').onclick = ()=> pushToCloud({schedule:true, offsets:true, ui:true});
  document.getElementById('pullAll').onclick = ()=> pullFromCloud();
  document.getElementById('pushMedia').onclick = async ()=>{
    const aa = await idbGet('ptt_audioAthan'); if(aa) await uploadToStorage(aa, 'athan');
    const iq = await idbGet('ptt_audioIqama'); if(iq) await uploadToStorage(iq, 'iqama');
    const al = await idbGet('ptt_audioAlert'); if(al) await uploadToStorage(al, 'alert');
    const bg = await idbGet('ptt_bgImage'); if(bg) await uploadToStorage(bg, 'bg');
  };
  document.getElementById('fbMediaTest').onclick = ()=> testCloudMedia();
  document.getElementById('fbDiagStorage').onclick = ()=> diagnoseStorage();
  document.getElementById('exportData').onclick = exportData;
  document.getElementById('exportWithMedia').onclick = exportWithMedia;
  document.getElementById('importData').onclick = importDataDialog;
  document.getElementById('resetAll').onclick = async ()=>{ if(!confirm('سيتم مسح كل الإعدادات المحلية. متابعة؟')) return; localStorage.clear(); await idbClear(); location.reload(); };
  document.getElementById('showUsage').onclick = async ()=>{
    const a = await idbGet('ptt_audioAthan'); const q = await idbGet('ptt_audioIqama'); const z = await idbGet('ptt_audioAlert'); const bg = await idbGet('ptt_bgImage');
    const sizes = [a?.size||0,q?.size||0,z?.size||0,bg?.size||0]; const total = sizes.reduce((x,y)=>x+y,0);
    alert('أحجام الوسائط (بالبايت):\nAthan='+sizes[0]+'\nIqama='+sizes[1]+'\nAlert='+sizes[2]+'\nBG='+sizes[3]+'\nالإجمالي='+total);
  };
  document.getElementById('runTests').onclick = ()=>{
    const out = document.getElementById('testOutput');
    const ok = (name, good)=> (good?'✅':'❌')+' '+name;
    const twelveAm = parseTimeToDate('2025-01-01','12:00 ص',0);
    const twelvePm = parseTimeToDate('2025-01-01','12:00 م',0);
    const ok12s = twelveAm && twelveAm.getHours()===0 && twelvePm && twelvePm.getHours()===12;
    const ok24 = parseTimeToDate('2025-01-01','23:59',0)?.getHours()===23;
    const fmt12 = fmtClock(new Date('2025-01-01T13:05:00'), '12')==='1:05 م';
    const fmt24 = fmtClock(new Date('2025-01-01T13:05:00'), '24')==='13:05';
    const san1 = sanitizeDateKey('2025/02/07')==='2025-02-07';
    const san2 = sanitizeDateKey('2025-02-07')==='2025-02-07';
    const schOk = !!sanitizeScheduleForFirebase({'2025/02/07':{Fajr:'05:00'}})['2025-02-07'];
    out.textContent = [ok('تحليل 12ص/12م', ok12s), ok('تحليل 24h 23:59', ok24), ok('تنسيق 12h', fmt12), ok('تنسيق 24h', fmt24), ok('sanitizeDateKey basic', san1), ok('sanitizeDateKey dash', san2), ok('sanitizeScheduleForFirebase', schOk)].join('\n');
  };
}

// ======= قراءة المعاملات من الرابط لتهيئة السحابة تلقائيًا =======
(function initFromURL(){
  const cloud = qs.get('cloud'); if(cloud==='1'){ state.cloud.enabled = true; }
  const room = qs.get('room'); if(room) state.cloud.roomId = room;
  const cfg = state.cloud.config || {};
  ['apiKey','authDomain','databaseURL','storageBucket'].forEach(k=>{ const v=qs.get(k); if(v) cfg[k]=v; });
  state.cloud.config = cfg; saveLS('ptt_cloud', state.cloud);

  if(SCREEN || SCREEN2){
    // وضع شاشة العرض
    document.body.classList.add('screen');
    const enableBtn = document.getElementById('enableAudioFloating');
    if(AUTO_AUDIO){ // محاولة تمكين الصوت تلقائيًا (قد تمنعها المتصفحات)
      setTimeout(()=>{ try{ enableAudio(); }catch{} }, 300);
    }
  }
})();

// ======= بدء التشغيل =======
window.addEventListener('DOMContentLoaded', ()=>{
  // تطبيق الثيم
  applyTheme();
  // تهيئة عناصر التحكم
  initControls();
  // بدء العداد
  start();
  // تحديث "الآن"
  setInterval(()=>{ const nowEl=el('now'); if(nowEl) nowEl.textContent = nowString(); }, 1000);
});
