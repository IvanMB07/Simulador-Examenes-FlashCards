import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import {
  StorageAdapter, ProfileManager, ExamHistory, SessionStore, FailedQuestionStore,
  ExamEngine, QuestionHistoryStore, extractTopic, getAvailableTopics, distributeQuestionsByTopic
} from '../common/simulador-core.js';

globalThis.crypto ??= webcrypto;
class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}
let storage, profiles, history, sessions, failures, questionHistory;
const topicQuestions = [
  ...Array.from({length:6},(_,i)=>({id:'T1-'+(i+1),cuestion:'T1-Pregunta '+(i+1),opciones:['A. Correcta','B. Incorrecta'],solucion:'A'})),
  ...Array.from({length:6},(_,i)=>({id:'T2-'+(i+1),cuestion:'T2-Pregunta '+(i+1),opciones:['A. Correcta','B. Incorrecta'],solucion:'A'})),
  ...Array.from({length:6},(_,i)=>({id:'T3-'+(i+1),cuestion:'T3-Pregunta '+(i+1),opciones:['A. Correcta','B. Incorrecta'],solucion:'A'}))
];
const config = {examQuestionCount:3,practiceQuestionCount:6,examDurationMinutes:75,scoring:{correct:1,incorrect:-0.5,blank:0}};

beforeEach(() => {
  globalThis.localStorage = new MemoryStorage();
  storage = new StorageAdapter('test');
  profiles = new ProfileManager(storage);
  history = new ExamHistory(storage,()=>profiles.activeId,'CalSisSw');
  sessions = new SessionStore(storage,()=>profiles.activeId,'CalSisSw');
  failures = new FailedQuestionStore(storage,()=>profiles.activeId);
  questionHistory = new QuestionHistoryStore(storage,()=>profiles.activeId,150);
});

test('detecta temas desde el identificador o el texto de la pregunta', () => {
  assert.equal(extractTopic({id:'CSW-T3-014',cuestion:'Pregunta de ejemplo'}),3);
  assert.equal(extractTopic({cuestion:'Tema 2: conceptos básicos'}),2);
  assert.deepEqual(getAvailableTopics(topicQuestions),[1,2,3]);
});

test('distribuye preguntas proporcionalmente entre temas seleccionados', () => {
  const selected=distributeQuestionsByTopic(topicQuestions,[1,3],6,questionHistory,{preserveTopicOrder:true});
  assert.equal(selected.length,6);
  assert.deepEqual(selected.map(extractTopic),[1,1,1,3,3,3]);
  assert.equal(new Set(selected.map(item=>item.id)).size,6);
});

test('respeta el límite de preguntas existentes en los temas seleccionados', () => {
  const selected=distributeQuestionsByTopic(topicQuestions,[1],20,questionHistory,{preserveTopicOrder:true});
  assert.equal(selected.length,6);
  assert.ok(selected.every(item=>extractTopic(item)===1));
});

test('prioriza preguntas no vistas y mantiene historial separado por perfil', () => {
  questionHistory.record(topicQuestions.slice(0,2));
  assert.equal(questionHistory.priority(topicQuestions[0]),2);
  assert.equal(questionHistory.priority(topicQuestions[2]),Infinity);
  profiles.create('Segundo');
  assert.equal(questionHistory.priority(topicQuestions[0]),Infinity);
  questionHistory.record(topicQuestions.slice(0,4));
  assert.equal(questionHistory.list().length,4);
});

test('el avance automático solo se aplica al modo examen', () => {
  let state;
  const engine=new ExamEngine({
    config,questions:topicQuestions,profileManager:profiles,history,sessionStore:sessions,
    failedQuestions:failures,questionHistory,preferencesProvider:()=>({autoAdvanceExam:true}),
    onChange:value=>{state=value;}
  });
  engine.start('exam');
  engine.answer(0);
  assert.equal(state.current,1);
  assert.equal(state.answers[0],0);
  engine.finish();
});

test('las preguntas falladas permiten cambiar la respuesta antes de finalizar', () => {
  failures.add([{question:topicQuestions[0],selectedAnswer:'B. Incorrecta'}]);
  let state;
  const engine=new ExamEngine({
    config,questions:topicQuestions,profileManager:profiles,history,sessionStore:sessions,
    failedQuestions:failures,questionHistory,preferencesProvider:()=>({}),
    onChange:value=>{state=value;}
  });
  engine.start('failures');
  engine.answer(0);
  engine.answer(1);
  assert.equal(state.answers[0],1);
  engine.finish();
});


test('la interfaz de CalSisSw conserva la función que inicia las sesiones y sus selectores', () => {
  const script = readFileSync(new URL('../simulador-CalSisSw/script.js', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../simulador-CalSisSw/index.html', import.meta.url), 'utf8');
  assert.match(script, /function start\s*\(\s*mode\s*,\s*restored\s*=\s*null\s*\)/);
  assert.match(script, /\$\('startPractice'\)\.addEventListener/);
  assert.match(script, /\$\('startExam'\)\.addEventListener/);
  assert.match(script, /\$\('startFailures'\)\.addEventListener/);
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
  const selectors = [...script.matchAll(/\$\('([^']+)'\)/g)].map(match => match[1]);
  const missing = [...new Set(selectors.filter(id => !ids.has(id)))];
  assert.deepEqual(missing, []);
});


test('la nueva interfaz agrupa perfil y sincronización y ubica el contador en temas', () => {
  const html = readFileSync(new URL('../simulador-CalSisSw/index.html', import.meta.url), 'utf8');
  const script = readFileSync(new URL('../simulador-CalSisSw/script.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../simulador-CalSisSw/styles.css', import.meta.url), 'utf8');

  assert.doesNotMatch(html, /href="\.\.\/index\.html" class="back"/);
  assert.doesNotMatch(html, /question-bank-summary|account-disclosure/);
  assert.match(html, /class="profile-sync-panel"/);
  assert.match(html, /class="profile-sync-grid"/);
  assert.ok(html.indexOf('id="questionBankCount"') > html.indexOf('id="topicSettings"'));
  assert.match(html, /class="[^"]*topic-order-setting/);
  assert.match(html, /class="results-top-actions"/);
  assert.equal((html.match(/id="retryExam"/g) || []).length, 1);
  assert.equal((html.match(/id="finishMenu"/g) || []).length, 1);
  assert.match(html, /Nuevo test/);
  assert.match(script, /className='option-number'/);
  assert.match(css, /\.profile-sync-grid/);
  assert.match(css, /\.results-top-actions/);
});


test('limpiar historial solo elimina las sesiones del perfil activo y conserva los fallos', () => {
  history.add({
    id:'session-default',
    mode:'practice',
    finishedAt:'2026-11-15T18:00:00.000Z',
    correct:1,
    incorrect:0,
    blank:0,
    score:1,
    durationMs:1000,
    questionIds:[topicQuestions[0].id]
  });

  profiles.create('Perfil secundario');
  history.add({
    id:'session-secondary',
    mode:'exam',
    finishedAt:'2026-11-15T19:00:00.000Z',
    correct:0,
    incorrect:1,
    blank:0,
    score:-0.5,
    durationMs:2000,
    questionIds:[topicQuestions[1].id]
  });
  failures.add([{question:topicQuestions[2],selectedAnswer:'B. Incorrecta'}]);

  history.clear();

  assert.equal(history.list().length,0);
  assert.equal(failures.list().length,1);

  profiles.setActive('default');
  assert.equal(history.list().length,1);
  assert.equal(history.list()[0].id,'session-default');
});

test('acciones inferiores mantienen las tres filas y el botón de limpiar historial', () => {
  const html = readFileSync(new URL('../simulador-CalSisSw/index.html', import.meta.url), 'utf8');
  const script = readFileSync(new URL('../simulador-CalSisSw/script.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../simulador-CalSisSw/styles.css', import.meta.url), 'utf8');

  assert.match(html, /id="clearHistory"/);
  assert.match(script, /\$\('clearHistory'\)\.addEventListener\('click'/);
  assert.match(script, /history\.clear\(\)/);
  assert.match(script, /\$\('clearHistory'\)\.disabled=historyCount===0/);
  const actionIds = ['openHistory','clearHistory','clearFailures','exportFailures','importFailures','exportBackup','importBackup'];
  const positions = actionIds.map(id => html.indexOf('id="'+id+'"'));
  assert.ok(positions.every(position => position >= 0));
  assert.deepEqual(positions,[...positions].sort((a,b)=>a-b));
  assert.match(html, /class="action-row action-row-two"/);
  assert.match(html, /class="action-row action-row-three"/);
  assert.match(html, /class="icon-button"[^>]*aria-label="Crear perfil"/);
  assert.match(css, /\.profile-sync-panel \.profile-controls > button\.icon-button/);
  assert.match(css, /\.action-row-three/);
});
