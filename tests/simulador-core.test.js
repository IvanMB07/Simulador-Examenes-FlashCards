import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { StorageAdapter, ProfileManager, ExamHistory, SessionStore, FailedQuestionStore, ExamEngine, grade } from '../common/simulador-core.js';

globalThis.crypto ??= webcrypto;
class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}
let storage, profiles, history, sessions, failures;
const questions = [
  {id:'q1',cuestion:'Pregunta 1',opciones:['A. Correcta','B. Incorrecta'],solucion:'A'},
  {id:'q2',cuestion:'Pregunta 2',opciones:['A. Incorrecta','B. Correcta'],solucion:'B'},
  {id:'q3',cuestion:'Pregunta 3',opciones:['A. Correcta','B. Incorrecta'],solucion:'A'}
];
const config = {examQuestionCount:3,practiceQuestionCount:3,examDurationMinutes:75,scoring:{correct:1,incorrect:-0.5,blank:0}};

beforeEach(() => {
  globalThis.localStorage = new MemoryStorage();
  storage = new StorageAdapter('test');
  profiles = new ProfileManager(storage);
  history = new ExamHistory(storage,()=>profiles.activeId,'CalSisSw');
  sessions = new SessionStore(storage,()=>profiles.activeId,'CalSisSw');
  failures = new FailedQuestionStore(storage,()=>profiles.activeId);
});

test('calcula +1, -0,5 y 0 sin normalizar', () => {
  const result=grade(questions,{0:0,1:0},config.scoring);
  assert.deepEqual([result.correct,result.incorrect,result.blank,result.score],[1,1,1,0.5]);
});

test('separa historiales por perfil', () => {
  history.add({id:'s1',mode:'exam',finishedAt:new Date().toISOString(),score:8});
  assert.equal(history.list().length,1);
  profiles.create('Segundo perfil');
  assert.equal(new ExamHistory(storage,()=>profiles.activeId,'CalSisSw').list().length,0);
});

test('guarda respuestas, historial y preguntas falladas', () => {
  let completed;
  let currentState;
  const engine=new ExamEngine({config,questions,profileManager:profiles,history,sessionStore:sessions,failedQuestions:failures,onChange:(nextState,done)=>{currentState=nextState;if(done)completed=done;}});
  engine.start('practice');
  const first=currentState.questions[0];
  const firstCorrect=first.opciones.findIndex(option=>option.trim().startsWith(first.solucion+'.'));
  engine.answer(firstCorrect);
  engine.move(1);
  const second=currentState.questions[1];
  const secondCorrect=second.opciones.findIndex(option=>option.trim().startsWith(second.solucion+'.'));
  const secondWrong=secondCorrect===0?1:0;
  engine.answer(secondWrong);
  const saved=sessions.get();
  assert.equal(saved.answers[0],firstCorrect);
  assert.equal(saved.answers[1],secondWrong);
  engine.finish();
  assert.equal(completed.result.score,0.5);
  assert.equal(history.list().length,1);
  assert.equal(history.list()[0].questionIds.length,3);
  assert.equal(failures.list().length,2);
  assert.equal(sessions.get(),null);
});

test('reanuda una sesión guardada con sus respuestas', () => {
  let state;
  const first=new ExamEngine({config,questions,profileManager:profiles,history,sessionStore:sessions,failedQuestions:failures,onChange:value=>{state=value;}});
  first.start('exam');
  first.answer(0);
  first.dispose();
  const saved=sessions.get();
  const resumed=new ExamEngine({config,questions,profileManager:profiles,history,sessionStore:sessions,failedQuestions:failures,onChange:value=>{state=value;}});
  resumed.start(saved.mode,saved);
  assert.equal(state.answers[0],0);
  assert.equal(state.mode,'exam');
  resumed.finish();
});

test('temporizador de examen utiliza tiempo de pared al reanudar', () => {
  let state;
  const engine=new ExamEngine({config:{...config,examDurationMinutes:75},questions,profileManager:profiles,history,sessionStore:sessions,failedQuestions:failures,onChange:value=>{state=value;}});
  engine.start('exam');
  state.startedAt=Date.now()-5*60*1000;
  sessions.save(state);
  engine.dispose();
  const restored=sessions.get();
  const resumed=new ExamEngine({config:{...config,examDurationMinutes:75},questions,profileManager:profiles,history,sessionStore:sessions,failedQuestions:failures,onChange:value=>{state=value;}});
  resumed.start('exam',restored);
  assert.ok(resumed.remaining() <= 70*60*1000);
  resumed.finish();
});

test('registra perfiles eliminados para propagar el borrado', () => {
  const profileId=profiles.create('Perfil temporal');
  assert.equal(profiles.activeId,profileId);
  profiles.removeActive();
  assert.equal(profiles.data.profiles[profileId],undefined);
  assert.ok(profiles.data.deletedProfiles.includes(profileId));
  assert.equal(profiles.activeId,'default');
});

test('StorageAdapter emite cambios locales con prioridad de sincronizacion', () => {
  const originalWindow=globalThis.window;
  const originalCustomEvent=globalThis.CustomEvent;
  let emitted=null;
  globalThis.CustomEvent=class {
    constructor(type,init) { this.type=type; this.detail=init.detail; }
  };
  globalThis.window={dispatchEvent(event) { emitted=event; }};
  try {
    storage.write('active-session',{id:'session-1'},'default',{syncPriority:'low'});
    assert.equal(emitted.type,'simulador:storage-change');
    assert.equal(emitted.detail.namespace,'test');
    assert.equal(emitted.detail.name,'active-session');
    assert.equal(emitted.detail.syncPriority,'low');
    assert.equal(emitted.detail.value.id,'session-1');
  } finally {
    if(originalWindow===undefined) delete globalThis.window; else globalThis.window=originalWindow;
    if(originalCustomEvent===undefined) delete globalThis.CustomEvent; else globalThis.CustomEvent=originalCustomEvent;
  }
});


test('corrige respuestas múltiples solo cuando coinciden todas las opciones correctas', () => {
  const multi=[
    {id:'m1',cuestion:'Pregunta múltiple',opciones:['A. Una','B. Dos','C. Tres','D. Cuatro'],solucion:'AC'},
    {id:'m2',cuestion:'Pregunta múltiple 2',opciones:['A. Una','B. Dos','C. Tres','D. Cuatro'],solucion:'BCD'}
  ];
  const exact=grade(multi,{0:[2,0],1:[1,2,3]},{correct:1,incorrect:-1/3,blank:0},({correct,incorrect,questionCount})=>((correct-incorrect/3)/questionCount)*10);
  assert.deepEqual([exact.correct,exact.incorrect,exact.blank,exact.score],[2,0,0,10]);
  const partial=grade(multi,{0:[0],1:[1,2,3]},{correct:1,incorrect:-1/3,blank:0});
  assert.deepEqual([partial.correct,partial.incorrect,partial.blank],[1,1,0]);
  assert.equal(partial.errors[0].correct,'A. Una · C. Tres');
});

test('permite seleccionar y deseleccionar opciones múltiples y confirmar en práctica', () => {
  let state;
  const multiQuestions=[{id:'m1',cuestion:'Pregunta múltiple',opciones:['A. Una','B. Dos','C. Tres'],solucion:'AC'}];
  const engine=new ExamEngine({config:{...config,examQuestionCount:1,practiceQuestionCount:1},questions:multiQuestions,profileManager:profiles,history,sessionStore:sessions,failedQuestions:failures,onChange:value=>{state=value;}});
  engine.start('practice');
  engine.answer(0);engine.answer(1);engine.answer(1);engine.answer(2);
  assert.deepEqual(state.answers[0],[0,2]);
  assert.deepEqual(state.confirmedAnswers,[]);
  engine.confirmAnswer();
  assert.deepEqual(state.confirmedAnswers,[0]);
  engine.answer(1);
  assert.deepEqual(state.answers[0],[0,2]);
  engine.finish();
});
