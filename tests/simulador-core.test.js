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
  const engine=new ExamEngine({config,questions,profileManager:profiles,history,sessionStore:sessions,failedQuestions:failures,onChange:(_state,done)=>{if(done)completed=done;}});
  engine.start('practice');
  engine.answer(0);
  engine.move(1);
  engine.answer(0);
  const saved=sessions.get();
  assert.equal(saved.answers[0],0);
  assert.equal(saved.answers[1],0);
  engine.finish();
  assert.equal(completed.result.score,0.5);
  assert.equal(history.list().length,1);
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
