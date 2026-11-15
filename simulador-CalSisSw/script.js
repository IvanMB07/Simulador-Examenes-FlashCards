import { StorageAdapter, ProfileManager, ExamHistory, SessionStore, FailedQuestionStore, ExamEngine } from '../common/simulador-core.js';

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
let questions = [];
let engine = null;
let state = null;

function show(id) { ['menu','exam','results','history'].forEach(view=>$(view).hidden=view!==id); }
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
  const saved=sessions.get();
  $('resumePanel').hidden=!saved;
  if(saved) $('resumeText').textContent=`${saved.mode==='exam'?'Examen':'Práctica'} · ${Object.keys(saved.answers||{}).length}/${saved.questions.length} respondidas`;
}
function update(stateValue, finished=null) {
  state=stateValue;
  if(finished){renderResults(finished);show('results');return;}
  if(!state)return;
  show('exam');
  const q=state.questions[state.current];
  $('questionCount').textContent=`Pregunta ${state.current+1} de ${state.questions.length}`;
  $('questionText').textContent=q.cuestion;
  $('timer').textContent=state.mode==='exam' ? 'Restante: '+fmtDuration(engine.remaining()) : 'Transcurrido: '+fmtDuration(engine.elapsed());
  $('progress').style.width=`${((state.current+1)/state.questions.length)*100}%`;
  $('progress').setAttribute('aria-valuenow',String(state.current+1));
  const options=$('options'); options.replaceChildren();
  q.opciones.forEach((text,index)=>{
    const button=document.createElement('button'); button.className='option'; button.type='button';
    button.textContent=text; button.setAttribute('aria-pressed',String(state.answers[state.current]===index));
    if(state.answers[state.current]===index)button.classList.add('selected');
    button.addEventListener('click',()=>engine.answer(index)); options.append(button);
  });
  $('previous').disabled=state.current===0; $('next').disabled=state.current===state.questions.length-1;
  $('finish').textContent=state.mode==='exam'?'Finalizar examen':'Finalizar práctica';
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
function start(mode,restored=null){if(engine)engine.dispose();if(mode==='exam'&&questions.length<CONFIG.examQuestionCount){alert('El examen requiere '+CONFIG.examQuestionCount+' preguntas.');return;}engine=new ExamEngine({config:CONFIG,questions,profileManager:profiles,history,sessions,onChange:update});engine.start(mode,restored);}
function renderHistory(){
  const rows=history.list(); const container=$('historyRows'); container.replaceChildren();
  if(!rows.length){container.textContent='Todavía no hay exámenes guardados.';return;}
  rows.forEach(row=>{
    const item=document.createElement('article');item.className='history-item';
    const title=document.createElement('strong');title.textContent=`${row.mode==='exam'?'Examen':row.mode==='failures'?'Test de fallos':'Práctica'} · ${new Date(row.finishedAt).toLocaleString()}`;
    const detail=document.createElement('p');detail.textContent=`${row.correct} correctas · ${row.incorrect} incorrectas · ${row.blank} en blanco · ${row.score.toFixed(2)} puntos · ${fmtDuration(row.durationMs)}`;
    const replay=document.createElement('button');replay.type='button';replay.textContent='Repetir examen';replay.addEventListener('click',()=>start(row.mode==='exam'?'exam':row.mode==='failures'?'failures':'practice'));
    item.append(title,detail,replay);container.append(item);
  });
  const max=rows.length?Math.max(...rows.map(x=>x.score),1):1;
  $('historyChart').replaceChildren();
  rows.slice(0,10).reverse().forEach(row=>{const bar=document.createElement('div');bar.className='chart-bar';bar.style.height=`${Math.max(4,row.score/max*100)}%`;bar.title=`${new Date(row.finishedAt).toLocaleDateString()}: ${row.score.toFixed(2)}`;$('historyChart').append(bar);});
}
async function init(){
  try{
    const response=await fetch(CONFIG.questionUrl,{cache:'no-store'}); if(!response.ok)throw new Error(`HTTP ${response.status}`);
    questions=await response.json(); if(!Array.isArray(questions))throw new Error('El banco debe ser un array JSON.');
    $('questionBankCount').textContent=`${questions.length} preguntas cargadas`;
  }catch(error){$('questionBankCount').textContent=`No se pudo cargar preguntas.json: ${error.message}`;return;}
  history=new ExamHistory(storage,()=>profiles.activeId,CONFIG.id);sessions=new SessionStore(storage,()=>profiles.activeId,CONFIG.id);
  renderHome();
  $('resumeButton').addEventListener('click',()=>{const saved=sessions.get();if(saved)start(saved.mode,saved);});
  $('discardButton').addEventListener('click',()=>{sessions.clear();renderHome();});
}
$('startPractice').addEventListener('click',()=>start('practice'));
$('startFailures').addEventListener('click',()=>start('failures'));
$('clearFailures').addEventListener('click',()=>{if(failures.list().length&&confirm('¿Limpiar las preguntas falladas de este perfil?')){failures.clear();renderHome();}});
$('startExam').addEventListener('click',()=>start('exam'));
$('previous').addEventListener('click',()=>engine.move(-1));
$('next').addEventListener('click',()=>engine.move(1));
$('finish').addEventListener('click',()=>{if(confirm('¿Finalizar esta sesión?'))engine.finish();});
$('profileSelect').addEventListener('change',e=>{if(engine)engine.dispose();profiles.setActive(e.target.value);history=new ExamHistory(storage,()=>profiles.activeId,CONFIG.id);sessions=new SessionStore(storage,()=>profiles.activeId,CONFIG.id);failures=new FailedQuestionStore(storage,()=>profiles.activeId);renderHome();show('menu');});
$('addProfile').addEventListener('click',()=>{const name=prompt('Nombre del perfil');if(!name)return;try{profiles.create(name);history=new ExamHistory(storage,()=>profiles.activeId,CONFIG.id);sessions=new SessionStore(storage,()=>profiles.activeId,CONFIG.id);failures=new FailedQuestionStore(storage,()=>profiles.activeId);renderHome();}catch(e){alert(e.message);}});
$('removeProfile').addEventListener('click',()=>{if(profiles.activeId==='default')return; if(confirm('¿Eliminar este perfil y sus datos locales?')){const id=profiles.removeActive();['exam-history','active-session','failed-questions'].forEach(key=>storage.remove(key,id));history=new ExamHistory(storage,()=>profiles.activeId,CONFIG.id);sessions=new SessionStore(storage,()=>profiles.activeId,CONFIG.id);renderHome();}});
$('openHistory').addEventListener('click',()=>{renderHistory();show('history');});
$('backMenu')?.addEventListener('click',()=>{renderHome();show('menu');});
$('historyBack').addEventListener('click',()=>show('menu'));
$('exportHistory').addEventListener('click',()=>history.export());
$('exportBackup').addEventListener('click',()=>{
 const payload={schemaVersion:1,simulatorId:CONFIG.id,profile:profiles.active,profiles:profiles.data,history:history.list(),failures:failures.list(),session:sessions.get(),exportedAt:new Date().toISOString()};
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='calsissw-backup.json';a.click();URL.revokeObjectURL(url);
});
$('importBackup').addEventListener('click',()=>$('backupFile').click());
$('backupFile').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{const payload=JSON.parse(await file.text());if(payload.simulatorId!==CONFIG.id)throw new Error('La copia no pertenece a CalSisSw.');if(Array.isArray(payload.history))storage.write('exam-history',payload.history,profiles.activeId);if(Array.isArray(payload.failures))storage.write('failed-questions',payload.failures,profiles.activeId);if(payload.session)storage.write('active-session',payload.session,profiles.activeId);renderHome();alert('Copia importada.');}catch(err){alert(`No se pudo importar: ${err.message}`);}e.target.value='';});
$('retryExam').addEventListener('click',()=>start(lastResult?.mode||'exam'));
$('finishMenu').addEventListener('click',()=>{renderHome();show('menu');});
window.addEventListener('beforeunload',()=>engine?.dispose());
document.addEventListener('keydown',e=>{if(!state||$('exam').hidden)return;if(e.target.matches('input,textarea,button'))return;
 if(e.key==='ArrowLeft')engine.move(-1);else if(e.key==='ArrowRight')engine.move(1);else if(['1','2','3','4'].includes(e.key))engine.answer(Number(e.key)-1);
});
init();
