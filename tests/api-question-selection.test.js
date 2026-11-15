import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  selectApiQuestions, extractApiTopic, getApiExamTopics, getApiDependencyGroup, isApiTableQuestion
} from '../simulador-API/api-question-selection.js';

const bank = JSON.parse(readFileSync(new URL('../simulador-API/preguntas.json', import.meta.url), 'utf8'));

function assertGroupsCompleteAndOrdered(selected) {
  const selectedKeys = new Set(selected.map(question => question.cuestion));
  const allGroups = new Map();

  for (const question of bank) {
    const group = getApiDependencyGroup(question);
    if (!group) continue;
    if (!allGroups.has(group)) allGroups.set(group, []);
    allGroups.get(group).push(question);
  }

  for (const [group, questions] of allGroups) {
    const picked = questions.filter(question => selectedKeys.has(question.cuestion));
    if (!picked.length) continue;

    assert.equal(picked.length, questions.length, 'El grupo ' + group + ' debe conservar todas sus preguntas');
    const ordered = [...questions].sort((a, b) => {
      const baseA = a.preguntaBaseDependencia === true ? 1 : 0;
      const baseB = b.preguntaBaseDependencia === true ? 1 : 0;
      if (baseA !== baseB) return baseB - baseA;
      return (a.ordenGrupo ?? Number.MAX_SAFE_INTEGER) - (b.ordenGrupo ?? Number.MAX_SAFE_INTEGER);
    });
    const positions = ordered.map(question => selected.findIndex(item => item.cuestion === question.cuestion));
    assert.deepEqual(positions, [...positions].sort((a, b) => a - b), 'El grupo ' + group + ' debe mantener el orden');
    for (let index = 1; index < positions.length; index++) {
      assert.equal(positions[index], positions[index - 1] + 1, 'El grupo ' + group + ' debe permanecer unido');
    }
  }
}

test('el banco API mantiene 679 preguntas y los temas que existen realmente', () => {
  assert.equal(bank.length, 679);
  const counts = new Map();
  for (const question of bank) {
    const topic = extractApiTopic(question);
    if (topic !== null) counts.set(topic, (counts.get(topic) || 0) + 1);
  }
  assert.deepEqual([...counts.entries()].sort((a, b) => a[0] - b[0]), [
    [1, 127], [2, 140], [3, 74], [4, 31], [7, 305]
  ]);
  assert.deepEqual(getApiExamTopics('parcial1'), [1, 2, 3, 4]);
  assert.deepEqual(getApiExamTopics('parcial3'), [7]);
});

test('la práctica genera 25 preguntas de los temas seleccionados y conserva los grupos dependientes', () => {
  for (let attempt = 0; attempt < 20; attempt++) {
    const selected = selectApiQuestions({
      mode: 'practice',
      questions: bank,
      count: 25,
      preferences: { selectedTopics: [1, 2, 3, 4, 7], orderByTopic: false }
    });
    assert.equal(selected.length, 25);
    assert.ok(selected.every(question => [1, 2, 3, 4, 7].includes(extractApiTopic(question))));
    assert.equal(new Set(selected.map(question => question.cuestion)).size, 25);
    assertGroupsCompleteAndOrdered(selected);
  }
});

test('el parcial 1 genera 30 preguntas, una tabla del tema 3 y práctica del tema 4', () => {
  for (let attempt = 0; attempt < 40; attempt++) {
    const selected = selectApiQuestions({
      mode: 'exam',
      questions: bank,
      count: 30,
      preferences: { examScope: 'parcial1' }
    });
    assert.equal(selected.length, 30);
    assert.ok(selected.every(question => [1, 2, 3, 4].includes(extractApiTopic(question))));
    assert.equal(selected.filter(question => extractApiTopic(question) === 3 && isApiTableQuestion(question)).length, 1);
    assert.ok(selected.some(question => extractApiTopic(question) === 4));
    assertGroupsCompleteAndOrdered(selected);
  }
});

test('el parcial 3 genera 30 preguntas exclusivamente del tema 7', () => {
  const selected = selectApiQuestions({
    mode: 'exam',
    questions: bank,
    count: 30,
    preferences: { examScope: 'parcial3' }
  });
  assert.equal(selected.length, 30);
  assert.ok(selected.every(question => extractApiTopic(question) === 7));
});

test('el parcial 2 no se ofrece al no haber preguntas de los temas 5 y 6', () => {
  const selected = bank.filter(question => [5, 6].includes(extractApiTopic(question)));
  assert.equal(selected.length, 0);
});
