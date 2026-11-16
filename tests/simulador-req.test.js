import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { correctOptionIndices, isMultipleAnswerQuestion } from '../common/simulador-core.js';

const questions = JSON.parse(readFileSync(new URL('../simulador-REQ/preguntas.json', import.meta.url), 'utf8'));

test('el banco REQ contiene 575 preguntas distribuidas en cinco temas', () => {
  assert.equal(questions.length, 575);
  const counts = new Map();
  questions.forEach(question => {
    const match = question.cuestion.match(/REQ-T(\d+)-/);
    assert.ok(match, 'Cada pregunta debe identificar su tema');
    counts.set(Number(match[1]), (counts.get(Number(match[1])) || 0) + 1);
  });
  assert.deepEqual([...counts.entries()].sort((a,b)=>a[0]-b[0]), [[1,125],[2,125],[3,75],[4,125],[5,125]]);
});

test('todas las soluciones del banco apuntan a opciones existentes', () => {
  for (const question of questions) {
    assert.equal(question.opciones.length, 4, question.cuestion);
    assert.ok(correctOptionIndices(question).length > 0, question.cuestion);
    assert.ok(correctOptionIndices(question).every(index => index < question.opciones.length), question.cuestion);
  }
});

test('se identifican las 124 preguntas de respuesta múltiple', () => {
  const multiple = questions.filter(isMultipleAnswerQuestion);
  assert.equal(multiple.length, 124);
  assert.deepEqual(correctOptionIndices({opciones:['A','B','C','D'],solucion:'AC'}), [0,2]);
});

test('la interfaz REQ conecta el botón de comprobación múltiple y todos los selectores', () => {
  const html = readFileSync(new URL('../simulador-REQ/index.html', import.meta.url), 'utf8');
  const script = readFileSync(new URL('../simulador-REQ/script.js', import.meta.url), 'utf8');
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
  const selectors = [...script.matchAll(/\$\('([^']+)'\)/g)].map(match => match[1]);
  assert.deepEqual([...new Set(selectors.filter(id => !ids.has(id)))], []);
  assert.match(html, /id="confirmMultiAnswer"/);
  assert.match(script, /\$\('confirmMultiAnswer'\)\.addEventListener/);
  assert.match(script, /examQuestionCount: 30/);
  assert.match(script, /practiceQuestionCount: 25/);
  assert.match(script, /examDurationMinutes: 60/);
  assert.match(script, /incorrect: -1 \/ 3/);
});
