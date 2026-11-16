const EXAM_SCOPES = Object.freeze({
  parcial1: [1, 2, 3, 4],
  parcial3: [7]
});

export function extractApiTopic(question) {
  const match = String(question?.cuestion || '').match(/-T([1-7])-/i);
  return match ? Number(match[1]) : null;
}

export function getApiExamTopics(scope = 'parcial1') {
  return [...(EXAM_SCOPES[scope] || EXAM_SCOPES.parcial1)];
}

export function isApiTableQuestion(question) {
  return typeof question?.cuestion === 'string'
    && /\n[^\n]*\|[^\n]*/.test(question.cuestion);
}

function isApiPracticalQuestion(question) {
  if (extractApiTopic(question) !== 4 || typeof question?.cuestion !== 'string') return false;
  const text = question.cuestion.toLowerCase();
  return /\d/.test(text) || [
    'calcula', 'cálculo', 'indice', 'índice', 'variación', 'valor ganado',
    'cpi', 'spi', 'ev', 'ac', 'pv', 'eac', 'bac'
  ].some(pattern => text.includes(pattern));
}

export function getApiDependencyGroup(question) {
  if (!question?.grupoDependencia || question.mantenerJuntas === false) return null;
  return String(question.grupoDependencia);
}

function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function questionKey(question) {
  return String(question?.id ?? question?.cuestion ?? '');
}

function sampleByHistory(pool, count, questionHistory = null) {
  if (count <= 0 || !pool.length) return [];
  if (pool.length <= count) return shuffle(pool);

  const unseen = [];
  const older = [];
  const recent = [];
  for (const question of shuffle(pool)) {
    const priority = questionHistory?.priority(question) ?? Infinity;
    if (priority === Infinity) unseen.push(question);
    else if (priority > 50) older.push(question);
    else recent.push(question);
  }

  const selected = unseen.slice(0, count);
  if (selected.length < count) {
    selected.push(...shuffle(older).slice(0, count - selected.length));
  }
  if (selected.length < count) {
    recent.sort((a, b) =>
      (questionHistory?.priority(b) ?? 0) - (questionHistory?.priority(a) ?? 0)
    );
    selected.push(...recent.slice(0, count - selected.length));
  }
  return shuffle(selected).slice(0, count);
}

function groupMap(pool) {
  const groups = new Map();
  for (const question of pool) {
    const group = getApiDependencyGroup(question);
    if (!group) continue;
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(question);
  }
  for (const [id, questions] of groups) {
    groups.set(id, [...questions].sort((a, b) => {
      const baseA = a.preguntaBaseDependencia === true ? 1 : 0;
      const baseB = b.preguntaBaseDependencia === true ? 1 : 0;
      if (baseA !== baseB) return baseB - baseA;
      const orderA = Number.isFinite(a.ordenGrupo) ? a.ordenGrupo : Number.MAX_SAFE_INTEGER;
      const orderB = Number.isFinite(b.ordenGrupo) ? b.ordenGrupo : Number.MAX_SAFE_INTEGER;
      return orderA - orderB;
    }));
  }
  return groups;
}

function compactDependencies(items, groups) {
  const result = [];
  const addedQuestions = new Set();
  const addedGroups = new Set();

  for (const question of items) {
    const key = questionKey(question);
    if (!key || addedQuestions.has(key)) continue;

    const group = getApiDependencyGroup(question);
    if (!group) {
      result.push(question);
      addedQuestions.add(key);
      continue;
    }
    if (addedGroups.has(group)) continue;

    addedGroups.add(group);
    for (const related of groups.get(group) || []) {
      const relatedKey = questionKey(related);
      if (!relatedKey || addedQuestions.has(relatedKey)) continue;
      result.push(related);
      addedQuestions.add(relatedKey);
    }
  }
  return result;
}

function normalizeDependencies(initial, target, pool, fillPool = pool) {
  const groups = groupMap(pool);
  let result = compactDependencies(initial, groups);
  const protectedQuestions = new Set(
    result.filter(question => getApiDependencyGroup(question)).map(questionKey)
  );

  if (result.length > target) {
    for (let index = result.length - 1; index >= 0 && result.length > target; index--) {
      const key = questionKey(result[index]);
      if (protectedQuestions.has(key)) continue;
      result.splice(index, 1);
    }
  }

  const resultKeys = new Set(result.map(questionKey));
  for (const candidate of shuffle(fillPool)) {
    if (result.length >= target) break;
    const candidateKey = questionKey(candidate);
    if (!candidateKey || resultKeys.has(candidateKey)) continue;

    const group = getApiDependencyGroup(candidate);
    if (!group) {
      result.push(candidate);
      resultKeys.add(candidateKey);
      continue;
    }

    const related = groups.get(group) || [];
    const missing = related.filter(question => !resultKeys.has(questionKey(question)));
    if (!missing.length || result.length + missing.length > target) continue;
    for (const question of missing) {
      result.push(question);
      resultKeys.add(questionKey(question));
    }
  }

  return compactDependencies(result, groups);
}

function shuffleKeepingGroups(items, pool) {
  const groups = groupMap(pool);
  const compacted = compactDependencies(items, groups);
  const blocks = [];
  const addedGroups = new Set();

  for (const question of compacted) {
    const group = getApiDependencyGroup(question);
    if (!group) {
      blocks.push([question]);
      continue;
    }
    if (addedGroups.has(group)) continue;
    addedGroups.add(group);
    blocks.push(compacted.filter(item => getApiDependencyGroup(item) === group));
  }
  return shuffle(blocks).flat();
}

function distributeQuotas(topics, count, eligibleByTopic) {
  const quotas = new Map(topics.map(topic => [topic, 0]));
  let remaining = count;
  let active = topics.filter(topic => (eligibleByTopic.get(topic) || []).length > 0);

  while (remaining > 0 && active.length) {
    const base = Math.floor(remaining / active.length);
    const extra = remaining % active.length;
    let assigned = 0;

    active.forEach((topic, index) => {
      const available = (eligibleByTopic.get(topic) || []).length;
      const room = available - (quotas.get(topic) || 0);
      const amount = Math.min(room, base + (index < extra ? 1 : 0));
      if (amount > 0) {
        quotas.set(topic, (quotas.get(topic) || 0) + amount);
        assigned += amount;
      }
    });

    if (!assigned) break;
    remaining -= assigned;
    active = active.filter(topic => (quotas.get(topic) || 0) < (eligibleByTopic.get(topic) || []).length);
  }
  return quotas;
}

function selectPractice(questions, count, preferences, questionHistory) {
  const availableTopics = [...new Set(questions.map(extractApiTopic).filter(Number.isInteger))].sort((a, b) => a - b);
  const requested = Array.isArray(preferences.selectedTopics)
    ? preferences.selectedTopics.map(Number).filter(topic => availableTopics.includes(topic))
    : [];
  const topics = requested.length ? [...new Set(requested)] : availableTopics;
  if (!topics.length) return [];

  const pool = questions.filter(question => topics.includes(extractApiTopic(question)));
  const byTopic = new Map(topics.map(topic => [topic, pool.filter(question => extractApiTopic(question) === topic)]));
  const quotas = distributeQuotas(topics, count, byTopic);
  const selected = [];

  for (const topic of topics) {
    selected.push(...sampleByHistory(byTopic.get(topic) || [], quotas.get(topic) || 0, questionHistory));
  }

  const normalized = normalizeDependencies(selected, count, pool);
  return preferences.orderByTopic === true
    ? normalized
    : shuffleKeepingGroups(normalized, pool);
}

function selectTopic3WithOneTable(topicQuestions, count, questionHistory) {
  if (count <= 0) return [];
  const tables = topicQuestions.filter(isApiTableQuestion);
  const tablesWithGroup = tables.filter(getApiDependencyGroup);
  const tablePool = tablesWithGroup.length ? tablesWithGroup : tables;
  if (!tablePool.length) return sampleByHistory(topicQuestions, count, questionHistory);

  const selectedTable = sampleByHistory(tablePool, 1, questionHistory)[0];
  const selectedGroup = getApiDependencyGroup(selectedTable);
  const permittedWithoutTable = topicQuestions.filter(question => {
    if (isApiTableQuestion(question)) return false;
    const group = getApiDependencyGroup(question);
    return !group || (selectedGroup !== null && group === selectedGroup);
  });

  return [
    selectedTable,
    ...sampleByHistory(permittedWithoutTable, Math.max(0, count - 1), questionHistory)
  ].slice(0, count);
}

function selectTopic4WithPractical(topicQuestions, count, questionHistory) {
  if (count <= 0) return [];
  const practical = topicQuestions.filter(isApiPracticalQuestion);
  const selectedPractical = sampleByHistory(practical.length ? practical : topicQuestions, 1, questionHistory);
  const selectedKeys = new Set(selectedPractical.map(questionKey));
  const rest = sampleByHistory(
    topicQuestions.filter(question => !selectedKeys.has(questionKey(question))),
    Math.max(0, count - selectedPractical.length),
    questionHistory
  );
  return [...selectedPractical, ...rest].slice(0, count);
}

function selectExam(questions, count, preferences, questionHistory) {
  const topics = getApiExamTopics(preferences.examScope || 'parcial1');
  const pool = questions.filter(question => topics.includes(extractApiTopic(question)));
  if (pool.length < count) {
    const label = preferences.examScope === 'parcial3' ? 'parcial 3 (tema 7)' : 'parcial 1 (temas 1–4)';
    throw new Error('No hay suficientes preguntas para el ' + label + '.');
  }

  const byTopic = new Map(topics.map(topic => [topic, pool.filter(question => extractApiTopic(question) === topic)]));
  const quotas = distributeQuotas(topics, count, byTopic);
  const selected = [];

  for (const topic of topics) {
    const topicQuestions = byTopic.get(topic) || [];
    const quota = quotas.get(topic) || 0;
    if (topic === 3) {
      selected.push(...selectTopic3WithOneTable(topicQuestions, quota, questionHistory));
    } else if (topic === 4 && topics.includes(3)) {
      selected.push(...selectTopic4WithPractical(topicQuestions, quota, questionHistory));
    } else {
      selected.push(...sampleByHistory(topicQuestions, quota, questionHistory));
    }
  }

  const selectedTableGroups = new Set(
    selected.filter(isApiTableQuestion).map(getApiDependencyGroup).filter(Boolean)
  );
  const forbiddenTableGroups = new Set(
    pool.filter(isApiTableQuestion).map(getApiDependencyGroup).filter(Boolean)
      .filter(group => !selectedTableGroups.has(group))
  );
  const fillPool = pool.filter(question => {
    if (isApiTableQuestion(question)) return false;
    const group = getApiDependencyGroup(question);
    return !group || !forbiddenTableGroups.has(group);
  });

  const normalized = normalizeDependencies(selected, count, pool, fillPool);
  const final = shuffleKeepingGroups(normalized, pool);

  if (final.length !== count) {
    throw new Error('No se ha podido formar un examen de ' + count + ' preguntas sin separar los ejercicios dependientes (se han seleccionado ' + final.length + ').');
  }

  if (topics.includes(3) && pool.some(question => extractApiTopic(question) === 3 && isApiTableQuestion(question))) {
    const tableCount = final.filter(question => extractApiTopic(question) === 3 && isApiTableQuestion(question)).length;
    if (tableCount !== 1) {
      throw new Error('El examen debe contener exactamente un ejercicio con tabla del tema 3 (se han seleccionado ' + tableCount + ').');
    }
  }

  if (topics.includes(3) && topics.includes(4) && !final.some(isApiPracticalQuestion)) {
    throw new Error('El examen del parcial 1 debe incluir al menos un ejercicio práctico del tema 4.');
  }

  return final;
}

export function selectApiQuestions({ mode = 'practice', questions = [], count = 25, preferences = {}, questionHistory = null } = {}) {
  const pool = Array.isArray(questions) ? questions.filter(question => !/gaitero/i.test(String(question?.cuestion || ''))) : [];
  if (mode === 'exam') return selectExam(pool, count, preferences, questionHistory);
  return selectPractice(pool, count, preferences, questionHistory);
}
