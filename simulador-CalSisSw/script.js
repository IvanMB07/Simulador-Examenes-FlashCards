import { StorageAdapter, ProfileManager, ExamHistory, SessionStore, FailedQuestionStore, ExamEngine, QuestionHistoryStore, extractTopic, getAvailableTopics } from '../common/simulador-core.js';
import { isFirebaseConfigured } from '../common/firebase/firebase-config.js';

const CONFIG = {
  id: 'CalSisSw',
  title: 'Calidad de Sistemas Software',
  questionUrl: './preguntas.json',
  examQuestionCount: 20,
  practiceQuestionCount: 20,
  examDurationMinutes: 75,
  scoring: { correct: 1, incorrect: -0.5, blank: 0 }
};

const $ = id => document.getElementById(id);
const storage = new StorageAdapter(`estudio:${CONFIG.id}`);
const profiles = new ProfileManager(storage);
let history = new ExamHistory(storage,()=>profiles.activeId,CONFIG.id);
let sessions = new SessionStore(storage,()=>profiles.activeId,CONFIG.id);
let failures = new FailedQuestionStore(storage,()=>profiles.activeId);
const questionHistory = new QuestionHistoryStore(storage,()=>profiles.activeId,150);
let questions = [];
let engine = null;
let state = null;
let lastResult = null;
let cloudSync = null;
let keyboardOptionIndex = 0;
let finishConfirmationAt = 0;
let finishToastTimer = null;
const DEFAULT_PREFERENCES = { selectedTopics: [], orderByTopic: false, autoAdvanceExam: false };
function readPreferences() {
  return { ...DEFAULT_PREFERENCES, ...storage.read('preferences',profiles.activeId,{}) };
}
function savePreferences(patch) {
  storage.write('preferences',{ ...readPreferences(), ...patch },profiles.activeId);
}
function topicDistribution(topics) {
  const available = new Map(topics.map(topic=>[topic,questions.filter(question=>extractTopic(question)===topic).length]));
  const quotas = new Map(topics.map(topic=>[topic,0]));
  let remaining = CONFIG.practiceQuestionCount;
  let active = topics.filter(topic=>(available.get(topic)||0)>0);
  while (remaining>0 && active.length) {
    const base = Math.floor(remaining/active.length);
    const extra = remaining%active.length;
    let assigned = 0;
    active.forEach((topic,index)=>{
      const room = (available.get(topic)||0)-(quotas.get(topic)||0);
      const amount = Math.min(room,base+(index<extra?1:0));
      if (amount>0) { quotas.set(topic,(quotas.get(topic)||0)+amount); assigned+=amount; }
    });
    if (!assigned) break;
    remaining-=assigned;
    active=active.filter(topic=>(quotas.get(topic)||0)<(available.get(topic)||0));
  }
  return quotas;
}
function renderTopicSettings() {
  const section=$('topicSettings'),container=$('topicFilters'),distribution=$('topicDistribution');
  if (!section||!container||!distribution) return;
  const topics=getAvailableTopics(questions);
  if (!topics.length) {
    section.hidden=false; container.replaceChildren();
    distribution.textContent='El banco todavía no contiene preguntas con un tema identificable.';
    $('orderByTopic').checked=false; $('orderByTopic').disabled=true;
    return;
  }
  section.hidden=false;
  const preferences=readPreferences();
  let selected=preferences.selectedTopics.filter(topic=>topics.includes(Number(topic))).map(Number);
  if (!selected.length) { selected=[...topics]; savePreferences({selectedTopics:selected}); }
  container.replaceChildren();
  topics.forEach(topic=>{
    const label=document.createElement('label'); label.className='topic-option';
    const input=document.createElement('input'); input.type='checkbox';
    input.value=String(topic); input.checked=selected.includes(topic);
    input.addEventListener('change',()=>{
      const next=[...container.querySelectorAll('input:checked')].map(item=>Number(item.value)).filter(Number.isInteger);
      if (!next.length) { input.checked=true; distribution.textContent='Debes mantener seleccionado al menos un tema.'; return; }
      savePreferences({selectedTopics:next}); renderTopicSettings();
    });
    const text=document.createElement('span');
    text.textContent='Tema '+topic+' ('+questions.filter(question=>extractTopic(question)===topic).length+')';
    label.append(input,text); container.append(label);
  });
  const quotas=topicDistribution(selected);
  distribution.textContent='Distribución prevista de '+CONFIG.practiceQuestionCount+' preguntas: '+selected.map(topic=>'Tema '+topic+': '+(quotas.get(topic)||0)).join(' · ');
  $('orderByTopic').checked=preferences.orderByTopic===true; $('orderByTopic').disabled=false;
}
function renderQuestionText(container,text) {
  const value=String(text||'');
  const lines=value.split(/\r?\n/);
  const firstTableLine=lines.findIndex(line=>line.includes('|'));
  const rows=firstTableLine<0?[]:lines.slice(firstTableLine).filter(line=>line.includes('|'))
    .map(line=>line.split('|').map(cell=>cell.trim()))
    .filter(cells=>cells.length>1&&!cells.every(cell=>/^:?-{2,}:?$/.test(cell)));
  if (rows.length<2) { container.replaceChildren(); container.classList.remove('question-text-table'); container.textContent=value; return; }
  container.replaceChildren(); container.classList.add('question-text-table');
  const intro=lines.slice(0,firstTableLine).join('\n').trim();
  if (intro) { const paragraph=document.createElement('p'); paragraph.className='question-table-intro'; paragraph.textContent=intro; container.append(paragraph); }
  const wrapper=document.createElement('div'); wrapper.className='question-table-wrap';
  wrapper.setAttribute('role','region');
  wrapper.setAttribute('aria-label','Tabla de datos de la pregunta. Desliza horizontalmente para ver todas las columnas.');
  wrapper.tabIndex=0;
  const table=document.createElement('table'); table.className='question-table';
  const head=document.createElement('thead'),headRow=document.createElement('tr');
  rows[0].forEach(value=>{const cell=document.createElement('th');cell.scope='col';cell.textContent=value;headRow.append(cell);});
  head.append(headRow);
  const body=document.createElement('tbody');
  rows.slice(1).forEach(row=>{const tr=document.createElement('tr');row.forEach(value=>{const cell=document.createElement('td');cell.textContent=value;tr.append(cell);});body.append(tr);});
  table.append(head,body); wrapper.append(table); container.append(wrapper);
}
function moveKeyboardOption(direction) {
  const buttons=[...$('options').querySelectorAll('.option')]; if (!buttons.length) return;
  keyboardOptionIndex=(keyboardOptionIndex+direction+buttons.length)%buttons.length;
  buttons.forEach((button,index)=>button.classList.toggle('keyboard-focus',index===keyboardOptionIndex));
  buttons[keyboardOptionIndex].focus({preventScroll:true}); buttons[keyboardOptionIndex].scrollIntoView({block:'nearest'});
}
function requestFinish() {
  if (!engine||!state) return;
  const unanswered=state.questions.length-Object.keys(state.answers||{}).length;
  const touch=(typeof window.matchMedia==='function'&&window.matchMedia('(pointer: coarse)').matches)||/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent||'');
  if (!touch) { if (confirm(unanswered>0?'¿Finalizar la sesión? Te quedan '+unanswered+' preguntas sin responder.':'¿Finalizar la sesión?')) engine.finish(); return; }
  const now=Date.now();
  if (finishConfirmationAt&&now-finishConfirmationAt<=3500) {
    finishConfirmationAt=0; clearTimeout(finishToastTimer); $('finishConfirmToast').hidden=true; engine.finish(); return;
  }
  finishConfirmationAt=now;
  $('finishConfirmToast').textContent=(unanswered>0?'Quedan '+unanswered+' sin responder. ':'')+'Pulsa «Finalizar» otra vez en los próximos 3,5 segundos para confirmar.';
  $('finishConfirmToast').hidden=false; clearTimeout(finishToastTimer);
  finishToastTimer=setTimeout(()=>{finishConfirmationAt=0;$('finishConfirmToast').hidden=true;},3500);
}

function show(id) { ['menu','exam','results','history'].forEach(view=>$(view).hidden=view!==id); }
function updateCloudStatus(status) {
  const message=$('cloudStatusMessage');
  const state=$('cloudState');
  const email=status.email||null;
  message.textContent=status.message;
  state.textContent=status.state==='connected'?'Sincronizado':status.state==='syncing'?'Sincronizando':status.state==='error'?'Error':status.state==='conflict'?'Conflicto':status.state==='signed-out'?'Sin sesión':status.state==='unconfigured'?'Solo local':'Conectando';
  state.dataset.state=status.state;
  $('cloudAuthControls').hidden=Boolean(email)||status.state==='unconfigured'||!cloudSync;
  $('cloudSignedControls').hidden=!email;
  $('cloudSetupHint').hidden=status.state!=='unconfigured';
  $('cloudAccount').textContent=email||'';
}
function currentCloudCredentials() {
  return {email:$('cloudEmail').value.trim(),password:$('cloudPassword').value};
}
function showCloudError(error) {
  updateCloudStatus({state:'error',email:cloudSync?.user?.email||null,message:cloudSync?.errorMessage(error)||error.message||'No se pudo completar la operación.'});
}
async function initializeCloudSync() {
  if(!isFirebaseConfigured()) {
    updateCloudStatus({state:'unconfigured',message:'La aplicación funciona en modo local. Para sincronizar entre dispositivos, completa common/firebase/firebase-config.js y configura Firestore.'});
    return;
  }
  updateCloudStatus({state:'syncing',message:'Conectando con Firebase…'});
  try {
    const { FirebaseSyncProvider } = await import('../common/firebase/firebase-sync.js');
    cloudSync=new FirebaseSyncProvider({
      storage,profileManager:profiles,simulatorId:CONFIG.id,
      onStatus:updateCloudStatus,
      onDataApplied:()=>{
        history=new ExamHistory(storage,()=>profiles.activeId,CONFIG.id);
        sessions=new SessionStore(storage,()=>profiles.activeId,CONFIG.id);
        failures=new FailedQuestionStore(storage,()=>profiles.activeId);
        renderHome();
      }
    });
    await cloudSync.initialize();
  } catch(error) {
    console.error('No se pudo cargar el módulo Firebase:',error);
    updateCloudStatus({state:'error',message:'No se pudo cargar Firebase. Comprueba la conexión: '+error.message});
  }
}

function fmtDuration(ms) { const sec=Math.floor(ms/1000); return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`; }
function renderProfiles() {
  const select=$('profileSelect'); select.replaceChildren();
  profiles.list().forEach(profile=>{const option=document.createElement('option');option.value=profile.id;option.textContent=profile.name;select.append(option);});
  select.value=profiles.activeId;
}
function renderHome() {
  renderProfiles();
  $('profileName').textContent=profiles.active.name;
  $('historyCount').textContent=history.list().length;
  $('failedCount').textContent=failures.list().length;
  $('startFailures').disabled=failures.list().length===0;
  $('clearFailures').disabled=failures.list().length===0;
  renderTopicSettings();
  const saved=sessions.get();
  $('resumePanel').hidden=!saved;
  if(saved) $('resumeText').textContent=`${saved.mode==='exam'?'Examen':saved.mode==='failures'?'Test de fallos':'Práctica'} · ${Object.keys(saved.answers||{}).length}/${saved.questions.length} respondidas`;
}
function update(stateValue, finished=null) {
  state=stateValue;
  if(finished){lastResult=finished;renderResults(finished);renderHome();show('results');return;}
  if(!state)return;
  show('exam');
  const q=state.questions[state.current];
  $('questionCount').textContent=`Pregunta ${state.current+1} de ${state.questions.length}`;
  renderQuestionText($('questionText'),q.cuestion);
  keyboardOptionIndex=0;
  $('timer').textContent=state.mode==='exam' ? 'Restante: '+fmtDuration(engine.remaining()) : 'Transcurrido: '+fmtDuration(engine.elapsed());
  $('progress').style.width=`${((state.current+1)/state.questions.length)*100}%`;
  $('progress').setAttribute('aria-valuenow',String(state.current+1));
  $('progress').setAttribute('aria-valuemax',String(state.questions.length));
  const options=$('options'); options.replaceChildren();
  q.opciones.forEach((text,index)=>{
    const button=document.createElement('button'); button.className='option'; button.type='button';
    button.textContent=text; button.setAttribute('aria-pressed',String(state.answers[state.current]===index));
    const answered=Object.prototype.hasOwnProperty.call(state.answers,state.current);
    const selected=state.answers[state.current];
    const correctIndex=q.opciones.findIndex(option=>option.trim().charAt(0).toUpperCase()===String(q.solucion).trim().charAt(0).toUpperCase());
    if(selected===index)button.classList.add('selected');
    if(state.mode==='practice'&&answered){
      button.disabled=true;
      if(index===correctIndex)button.classList.add('correct');
      if(index===selected&&selected!==correctIndex)button.classList.add('incorrect');
    }
    button.addEventListener('click',()=>engine.answer(index)); options.append(button);
  });
  const feedback=$('feedback');
  const alreadyAnswered=Object.prototype.hasOwnProperty.call(state.answers,state.current);
  if(state.mode==='practice'&&alreadyAnswered){
    const selected=state.answers[state.current];
    const correctIndex=q.opciones.findIndex(option=>option.trim().charAt(0).toUpperCase()===String(q.solucion).trim().charAt(0).toUpperCase());
    feedback.hidden=false;
    feedback.textContent=selected===correctIndex?'Respuesta correcta.':`Respuesta incorrecta. La correcta es: ${q.opciones[correctIndex]||q.solucion}`;
    feedback.dataset.kind=selected===correctIndex?'success':'error';
  } else { feedback.hidden=true; feedback.textContent=''; }
  $('previous').disabled=state.current===0; $('next').disabled=state.current===state.questions.length-1;
  $('examSettings').hidden=state.mode!=='exam';
  $('autoAdvanceExam').checked=readPreferences().autoAdvanceExam===true;
  $('examMode').textContent=state.mode==='exam'?'Examen':state.mode==='failures'?'Repaso de fallos':'Práctica';
  $('finish').textContent=state.mode==='exam'?'Finalizar examen':'Finalizar sesión';
}
function renderResults(result) {
  const r=result.result;
  $('score').textContent=`${r.score.toFixed(2)} puntos`;
  $('correct').textContent=r.correct; $('incorrect').textContent=r.incorrect; $('blank').textContent=r.blank;
  $('duration').textContent=fmtDuration(result.durationMs);
  const list=$('errors'); list.replaceChildren();
  r.errors.forEach((error,i)=>{const item=document.createElement('article');item.className='error';
    const title=document.createElement('h3');title.textContent=`${i+1}. ${error.question}`;
    const detail=document.createElement('p');detail.textContent=`Tu respuesta: ${error.selected??'En blanco'} · Correcta: ${error.correct}`;
    item.append(title,detail);list.append(item);});
}
function start(mode,restored=null){
  if(engine)engine.dispose();
  if(mode==='exam'&&questions.length<CONFIG.examQuestionCount){alert('El examen requiere '+CONFIG.examQuestionCount+' preguntas.');return;}
  engine=new ExamEngine({config:CONFIG,questions,profileManager:profiles,history,sessionStore:sessions,failedQuestions:failures,questionHistory,preferencesProvider:readPreferences,onChange:update});
  try { engine.start(mode,restored); }
  catch(error) { engine.dispose(); engine=null; alert(error.message||'No se pudo iniciar la sesión.'); }
}
function renderHistory(){
  const rows=history.list(); const container=$('historyRows'); container.replaceChildren();
  if(!rows.length){container.textContent='Todavía no hay exámenes guardados.';return;}
  rows.forEach(row=>{
    const item=document.createElement('article');item.className='history-item';
    const title=document.createElement('strong');title.textContent=`${row.mode==='exam'?'Examen':row.mode==='failures'?'Test de fallos':'Práctica'} · ${new Date(row.finishedAt).toLocaleString()}`;
    const detail=document.createElement('p');detail.textContent=`${row.correct} correctas · ${row.incorrect} incorrectas · ${row.blank} en blanco · ${row.score.toFixed(2)} puntos · ${fmtDuration(row.durationMs)}`;
    const replay=document.createElement('button');replay.type='button';replay.textContent='Repetir sesión';replay.addEventListener('click',()=>{
      const replayQuestions=(row.questionIds||[]).map(id=>questions.find(question=>(question.id??question.cuestion)===id)).filter(Boolean);
      const restored=replayQuestions.length?{id:crypto.randomUUID(),mode:row.mode,questions:replayQuestions,answers:{},current:0,startedAt:Date.now(),lastResumedAt:Date.now(),elapsedMs:0}:null;
      start(row.mode==='exam'?'exam':row.mode==='failures'?'failures':'practice',restored);
    });
    item.append(title,detail,replay);container.append(item);
  });
  const maxAbs=rows.length?Math.max(1,...rows.map(row=>Math.abs(row.score))):1;
  $('historyChart').replaceChildren();
  rows.slice(0,10).reverse().forEach(row=>{const bar=document.createElement('div');bar.className=row.score<0?'chart-bar negative':'chart-bar';bar.style.height=`${Math.max(4,Math.abs(row.score)/maxAbs*100)}%`;bar.title=`${new Date(row.finishedAt).toLocaleDateString()}: ${row.score.toFixed(2)} puntos`;$('historyChart').append(bar);});
}
async function init(){
  try{
    const response=await fetch(CONFIG.questionUrl,{cache:'no-store'}); if(!response.ok)throw new Error(`HTTP ${response.status}`);
    questions=await response.json(); if(!Array.isArray(questions))throw new Error('El banco debe ser un array JSON.');
    $('questionBankCount').textContent=`${questions.length} preguntas cargadas`;
  }catch(error){$('questionBankCount').textContent=`No se pudo cargar preguntas.json: ${error.message}`;return;}
  history=new ExamHistory(storage,()=>profiles.activeId,CONFIG.id);sessions=new SessionStore(storage,()=>profiles.activeId,CONFIG.id);
  renderHome();
  await initializeCloudSync();
  $('resumeButton').addEventListener('click',()=>{const saved=sessions.get();if(saved)start(saved.mode,saved);});
  $('discardButton').addEventListener('click',()=>{sessions.clear();renderHome();});
}

$('cloudRegister').addEventListener('click',async()=>{
  const {email,password}=currentCloudCredentials();
  try { await cloudSync.register(email,password); $('cloudPassword').value=''; }
  catch(error){showCloudError(error);}
});
$('cloudLogin').addEventListener('click',async()=>{
  const {email,password}=currentCloudCredentials();
  try { await cloudSync.login(email,password); $('cloudPassword').value=''; }
  catch(error){showCloudError(error);}
});
$('cloudReset').addEventListener('click',async()=>{
  const {email}=currentCloudCredentials();
  try { await cloudSync.resetPassword(email); updateCloudStatus({state:'signed-out',message:'Hemos solicitado el correo de recuperación. Revisa tu bandeja de entrada.'}); }
  catch(error){showCloudError(error);}
});
$('cloudLogout').addEventListener('click',async()=>{
  try { await cloudSync.logout(); }
  catch(error){showCloudError(error);}
});
$('cloudSyncNow').addEventListener('click',async()=>{
  try { await cloudSync.syncNow(); }
  catch(error){showCloudError(error);}
});

$('startPractice').addEventListener('click',()=>start('practice'));
$('startFailures').addEventListener('click',()=>start('failures'));
$('clearFailures').addEventListener('click',()=>{if(failures.list().length&&confirm('¿Limpiar las preguntas falladas de este perfil?')){failures.clear();renderHome();}});
$('startExam').addEventListener('click',()=>start('exam'));
$('previous').addEventListener('click',()=>engine.move(-1));
$('next').addEventListener('click',()=>engine.move(1));
$('finish').addEventListener('click',requestFinish);
$('orderByTopic').addEventListener('change',event=>savePreferences({orderByTopic:event.target.checked}));
$('autoAdvanceExam').addEventListener('change',event=>savePreferences({autoAdvanceExam:event.target.checked}));
$('exportFailures').addEventListener('click',()=>{
 const payload={schemaVersion:1,simulatorId:CONFIG.id,profile:profiles.active,failures:failures.list(),exportedAt:new Date().toISOString()};
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='calsissw-fallos.json';a.click();URL.revokeObjectURL(url);
});
$('importFailures').addEventListener('click',()=>$('failureFile').click());
$('failureFile').addEventListener('change',async event=>{
 const file=event.target.files?.[0];if(!file)return;
 try {
  const payload=JSON.parse(await file.text());
  const source=Array.isArray(payload)?payload:(Array.isArray(payload.failures)?payload.failures:Array.isArray(payload.fallos)?payload.fallos:null);
  if(!source)throw new Error('El JSON no contiene una lista de fallos reconocible.');
  const normalized=source.map(item=>{
   const question=item?.question&&typeof item.question==='object'?item.question:item;
   if(!question||typeof question.cuestion!=='string'||!Array.isArray(question.opciones)||typeof question.solucion!=='string')return null;
   return {...question,lastFailedAt:question.lastFailedAt||question.fecha||new Date().toISOString(),selectedAnswer:question.selectedAnswer??question.respuestaUsuario??null};
  }).filter(Boolean);
  if(!normalized.length)throw new Error('El archivo no contiene preguntas falladas válidas.');
  if(!confirm('Se importarán '+normalized.length+' preguntas falladas en el perfil «'+profiles.active.name+'». ¿Continuar?'))return;
  const unique=new Map(normalized.map(item=>[item.id||item.cuestion,item]));
  storage.write('failed-questions',[...unique.values()],profiles.activeId);
  failures=new FailedQuestionStore(storage,()=>profiles.activeId);
  renderHome(); alert('Preguntas falladas importadas correctamente.');
 } catch(error) { alert('No se pudo importar el archivo: '+error.message); }
 finally { event.target.value=''; }
});
$('profileSelect').addEventListener('change',e=>{if(engine)engine.dispose();profiles.setActive(e.target.value);cloudSync?.setActiveProfile();history=new ExamHistory(storage,()=>profiles.activeId,CONFIG.id);sessions=new SessionStore(storage,()=>profiles.activeId,CONFIG.id);failures=new FailedQuestionStore(storage,()=>profiles.activeId);renderHome();show('menu');});
$('addProfile').addEventListener('click',()=>{const name=prompt('Nombre del perfil');if(!name)return;try{profiles.create(name);cloudSync?.setActiveProfile();history=new ExamHistory(storage,()=>profiles.activeId,CONFIG.id);sessions=new SessionStore(storage,()=>profiles.activeId,CONFIG.id);failures=new FailedQuestionStore(storage,()=>profiles.activeId);renderHome();}catch(e){alert(e.message);}});
$('removeProfile').addEventListener('click',()=>{if(profiles.activeId==='default')return; if(confirm('¿Eliminar este perfil y sus datos locales?')){const id=profiles.removeActive();cloudSync?.setActiveProfile();['exam-history','active-session','failed-questions'].forEach(key=>storage.remove(key,id));history=new ExamHistory(storage,()=>profiles.activeId,CONFIG.id);sessions=new SessionStore(storage,()=>profiles.activeId,CONFIG.id);failures=new FailedQuestionStore(storage,()=>profiles.activeId);renderHome();}});
$('openHistory').addEventListener('click',()=>{renderHistory();show('history');});
$('historyBack').addEventListener('click',()=>show('menu'));
$('exportHistory').addEventListener('click',()=>history.export());
$('exportBackup').addEventListener('click',()=>{
 const payload={schemaVersion:1,simulatorId:CONFIG.id,profile:profiles.active,history:history.list(),failures:failures.list(),session:sessions.get(),preferences:readPreferences(),questionHistory:questionHistory.list(),exportedAt:new Date().toISOString()};
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='calsissw-backup.json';a.click();URL.revokeObjectURL(url);
});
$('importBackup').addEventListener('click',()=>$('backupFile').click());
$('backupFile').addEventListener('change',async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{
    const payload=JSON.parse(await file.text());
    if(payload.schemaVersion!==1||payload.simulatorId!==CONFIG.id)throw new Error('La copia no pertenece a esta versión de CalSisSw.');
    const sourceName=String(payload.profile?.name||'').trim();
    let target=sourceName?profiles.list().find(profile=>profile.name.trim().toLocaleLowerCase()===sourceName.toLocaleLowerCase()):profiles.active;
    if(!target&&sourceName){profiles.create(sourceName);target=profiles.active;}
    if(target&&target.id!==profiles.activeId)profiles.setActive(target.id);
    const profileId=target?.id||profiles.activeId;
    if(Array.isArray(payload.history)){
      const existing=storage.read('exam-history',profileId,[]);
      const merged=new Map([...existing,...payload.history].map(item=>[item.id||`${item.mode}:${item.finishedAt}`,item]));
      storage.write('exam-history',[...merged.values()],profileId);
    }
    if(Array.isArray(payload.failures)){
      const existing=storage.read('failed-questions',profileId,[]);
      const merged=new Map([...existing,...payload.failures].map(item=>[item.id||item.cuestion,item]));
      storage.write('failed-questions',[...merged.values()],profileId);
    }
    if(payload.preferences&&typeof payload.preferences==='object')storage.write('preferences',{...DEFAULT_PREFERENCES,...payload.preferences},profileId);
    if(Array.isArray(payload.questionHistory))questionHistory.replace(payload.questionHistory);
    if(payload.session){
      const existing=storage.read('active-session',profileId,null);
      const incomingDate=Date.parse(payload.session.savedAt||'')||0;
      const existingDate=Date.parse(existing?.savedAt||'')||0;
      if(!existing||incomingDate>=existingDate)storage.write('active-session',payload.session,profileId);
    }
    history=new ExamHistory(storage,()=>profiles.activeId,CONFIG.id);
    sessions=new SessionStore(storage,()=>profiles.activeId,CONFIG.id);
    failures=new FailedQuestionStore(storage,()=>profiles.activeId);
    renderHome();alert('Copia importada en el perfil correspondiente.');
  }catch(err){alert(`No se pudo importar: ${err.message}`);}
  e.target.value='';
});
$('retryExam').addEventListener('click',()=>start(lastResult?.mode||'exam'));
$('finishMenu').addEventListener('click',()=>{renderHome();show('menu');});
window.addEventListener('beforeunload',()=>engine?.dispose());
document.addEventListener('keydown',e=>{
 if(!state||$('exam').hidden)return;
 if(e.target.matches('input,textarea,select'))return;
 if(e.target.closest('button')&&!e.target.closest('.option'))return;
 if(e.key==='ArrowLeft'){e.preventDefault();engine.move(-1);}
 else if(e.key==='ArrowRight'){e.preventDefault();engine.move(1);}
 else if(e.key==='ArrowUp'){e.preventDefault();moveKeyboardOption(-1);}
 else if(e.key==='ArrowDown'){e.preventDefault();moveKeyboardOption(1);}
 else if(['1','2','3','4'].includes(e.key)){e.preventDefault();engine.answer(Number(e.key)-1);}
 else if(e.key===' '||e.key==='Spacebar'){e.preventDefault();engine.answer(keyboardOptionIndex);}
 else if(e.key==='Enter'){e.preventDefault();requestFinish();}
});
init();
