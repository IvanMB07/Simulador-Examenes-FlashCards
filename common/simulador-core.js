/* Simulador universal · núcleo independiente de la asignatura. */
export class StorageAdapter {
  constructor(namespace = 'simulador') { this.namespace = namespace; }
  key(name, profile = 'default') { return `${this.namespace}:${name}:${profile}`; }
  read(name, profile = 'default', fallback = null) {
    try { const raw = localStorage.getItem(this.key(name, profile)); return raw === null ? fallback : JSON.parse(raw); }
    catch { return fallback; }
  }
  notify(name, profile, value, previous, removed, syncPriority = 'high') {
    if (typeof window === 'undefined' || typeof CustomEvent === 'undefined') return;
    window.dispatchEvent(new CustomEvent('simulador:storage-change', {
      detail: { namespace: this.namespace, name, profile, value, previous, removed, syncPriority }
    }));
  }
  write(name, value, profile = 'default', metadata = {}) {
    try {
      const key = this.key(name, profile);
      const previousRaw = localStorage.getItem(key);
      localStorage.setItem(key, JSON.stringify(value));
      this.notify(name, profile, value, previousRaw === null ? null : JSON.parse(previousRaw), false, metadata.syncPriority || 'high');
      return true;
    } catch (error) { console.error('No se pudo guardar en el dispositivo:', error); return false; }
  }
  remove(name, profile = 'default', metadata = {}) {
    const key = this.key(name, profile);
    const previousRaw = localStorage.getItem(key);
    localStorage.removeItem(key);
    let previous = null;
    try { previous = previousRaw === null ? null : JSON.parse(previousRaw); } catch {}
    this.notify(name, profile, null, previous, true, metadata.syncPriority || 'high');
  }
}

export class ProfileManager {
  constructor(storage) {
    this.storage = storage;
    this.data = storage.read('profiles', 'global', { active: 'default', profiles: { default: { id: 'default', name: 'Usuario principal', createdAt: new Date().toISOString() } } });
    if (!this.data.profiles.default) this.data.profiles.default = { id:'default', name:'Usuario principal', createdAt:new Date().toISOString() };
    if (!Array.isArray(this.data.deletedProfiles)) this.data.deletedProfiles = [];
  }
  save() { this.storage.write('profiles', this.data, 'global'); }
  get activeId() { return this.data.active || 'default'; }
  get active() { return this.data.profiles[this.activeId] || this.data.profiles.default; }
  list() { return Object.values(this.data.profiles); }
  setActive(id) { if (!this.data.profiles[id]) throw new Error('Perfil desconocido'); this.data.active = id; this.save(); }
  create(name) {
    const clean = String(name || '').trim();
    if (!clean) throw new Error('Indica un nombre de perfil.');
    const id = `profile-${crypto.randomUUID()}`;
    this.data.deletedProfiles = (this.data.deletedProfiles || []).filter(deletedId => deletedId !== id);
    this.data.profiles[id] = { id, name: clean, createdAt: new Date().toISOString() };
    this.data.active = id; this.save(); return id;
  }
  removeActive() {
    if (this.activeId === 'default') throw new Error('El perfil principal no se puede eliminar.');
    const id = this.activeId; delete this.data.profiles[id];
    this.data.deletedProfiles = [...new Set([...(this.data.deletedProfiles || []), id])];
    this.data.active = 'default'; this.save();
    return id;
  }
}

export class ExamHistory {
  constructor(storage, profileProvider, simulatorId) {
    this.storage = storage; this.profileProvider = profileProvider; this.simulatorId = simulatorId;
  }
  list() { return this.storage.read('exam-history', this.profileProvider(), []).slice().sort((a,b)=>b.finishedAt.localeCompare(a.finishedAt)); }
  add(session) {
    const rows = this.list();
    rows.unshift({ ...session, simulatorId: this.simulatorId });
    this.storage.write('exam-history', rows.slice(0, 500), this.profileProvider());
  }
  clear() {
    const profileId = this.profileProvider();
    // El marcador local evita que una suscripción remota vuelva a restaurar
    // sesiones antiguas mientras se propaga el borrado a Firestore.
    this.storage.write('exam-history-cleared-at', Date.now(), profileId);
    this.storage.write('exam-history', [], profileId);
  }
  export() {
    const blob = new Blob([JSON.stringify({schemaVersion:1, simulatorId:this.simulatorId, profileId:this.profileProvider(), exportedAt:new Date().toISOString(), sessions:this.list()},null,2)], {type:'application/json'});
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=`historial-${this.simulatorId}.json`; a.click(); URL.revokeObjectURL(url);
  }
}

export class SessionStore {
  constructor(storage, profileProvider, simulatorId) { this.storage=storage; this.profileProvider=profileProvider; this.simulatorId=simulatorId; }
  get() { return this.storage.read('active-session', this.profileProvider(), null); }
  save(session, syncPriority = 'high') { this.storage.write('active-session', {...session, simulatorId:this.simulatorId, profileId:this.profileProvider(), savedAt:new Date().toISOString()}, this.profileProvider(), {syncPriority}); }
  clear() { this.storage.remove('active-session', this.profileProvider()); }
}

export class FailedQuestionStore {
  constructor(storage, profileProvider) { this.storage=storage; this.profileProvider=profileProvider; }
  list() { return this.storage.read('failed-questions', this.profileProvider(), []); }
  add(items) {
    const entries=new Map(this.list().map(item=>[item.id||item.cuestion,item]));
    items.forEach(item=>{
      if(!item?.question)return;
      const key=item.question.id||item.question.cuestion;
      entries.set(key,{...item.question,lastFailedAt:new Date().toISOString(),selectedAnswer:item.selectedAnswer??null});
    });
    this.storage.write('failed-questions',[...entries.values()],this.profileProvider());
  }
  clear() { this.storage.write('failed-questions',[],this.profileProvider()); }
}

export function shuffle(items) {
  const copy = [...items];
  for (let i=copy.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [copy[i],copy[j]]=[copy[j],copy[i]]; }
  return copy;
}

export function extractTopic(question) {
  const explicit = question?.topic ?? question?.tema ?? question?.topicNumber;
  if (explicit !== undefined && explicit !== null && String(explicit).trim() !== '') {
    const direct = String(explicit).trim().match(/^(?:tema\s*|t\s*)?(\d{1,2})$/i);
    if (direct) return Number(direct[1]);
  }
  for (const source of [question?.id, question?.cuestion]) {
    if (typeof source !== 'string') continue;
    const match = source.match(/\b(?:tema\s*|t)(\d{1,2})(?=$|[\s._:-])/i);
    if (match) return Number(match[1]);
  }
  return null;
}

export function getAvailableTopics(questions) {
  return [...new Set((questions || []).map(extractTopic).filter(topic => Number.isInteger(topic) && topic > 0))]
    .sort((a, b) => a - b);
}

function questionKey(question) {
  return String(question?.id ?? question?.cuestion ?? '');
}

function preferUnseenQuestions(pool, count, questionHistory) {
  const unseen = [];
  const older = [];
  const recent = [];
  for (const question of shuffle(pool)) {
    const priority = questionHistory?.priority(question) ?? Infinity;
    if (priority === Infinity) unseen.push(question);
    else if (priority > 50) older.push(question);
    else recent.push({ question, priority });
  }
  const selected = unseen.slice(0, count);
  if (selected.length < count) selected.push(...older.slice(0, count - selected.length));
  if (selected.length < count) {
    recent.sort((a, b) => b.priority - a.priority);
    selected.push(...recent.slice(0, count - selected.length).map(item => item.question));
  }
  return selected.slice(0, count);
}

export function distributeQuestionsByTopic(questions, topics, count, questionHistory = null, options = {}) {
  const pool = Array.isArray(questions) ? questions : [];
  const topicList = [...new Set((topics || []).map(Number).filter(topic => Number.isInteger(topic) && topic > 0))];
  const eligible = topicList.length ? pool.filter(question => topicList.includes(extractTopic(question))) : pool;
  if (!eligible.length) return preferUnseenQuestions(pool, Math.max(0, Math.min(Number(count) || 0, pool.length)), questionHistory);
  const target = Math.max(0, Math.min(Number(count) || 0, eligible.length));
  if (!target) return [];

  if (!topicList.length) return preferUnseenQuestions(eligible, target, questionHistory);
  const buckets = new Map(topicList.map(topic => [topic, eligible.filter(question => extractTopic(question) === topic)]));
  const selectedByTopic = new Map(topicList.map(topic => [topic, []]));
  const used = new Set();
  let remainingTopics = topicList.filter(topic => buckets.get(topic).length > 0);

  while (used.size < target && remainingTopics.length) {
    const slots = target - used.size;
    const base = Math.floor(slots / remainingTopics.length);
    const extra = slots % remainingTopics.length;
    let addedThisRound = 0;
    remainingTopics.forEach((topic, index) => {
      const quota = base + (index < extra ? 1 : 0);
      if (!quota) return;
      const available = buckets.get(topic).filter(question => !used.has(questionKey(question)));
      const picked = preferUnseenQuestions(available, Math.min(quota, available.length), questionHistory);
      picked.forEach(question => {
        const key = questionKey(question);
        if (!key || used.has(key)) return;
        used.add(key);
        selectedByTopic.get(topic).push(question);
        addedThisRound++;
      });
    });
    if (!addedThisRound) break;
    remainingTopics = remainingTopics.filter(topic => selectedByTopic.get(topic).length < buckets.get(topic).length);
  }

  const ordered = topicList.flatMap(topic => selectedByTopic.get(topic));
  return options.preserveTopicOrder ? ordered.slice(0, target) : shuffle(ordered).slice(0, target);
}

export class QuestionHistoryStore {
  constructor(storage, profileProvider, maxEntries = 150) {
    this.storage = storage;
    this.profileProvider = profileProvider;
    this.maxEntries = maxEntries;
  }
  list() {
    const rows = this.storage.read('question-history', this.profileProvider(), []);
    return Array.isArray(rows) ? rows.filter(item => item && typeof item.key === 'string') : [];
  }
  priority(question) {
    const key = questionKey(question);
    const rows = this.list();
    for (let index = rows.length - 1; index >= 0; index--) {
      if (rows[index].key === key) return rows.length - index;
    }
    return Infinity;
  }
  record(questions) {
    const rows = this.list();
    for (const question of questions || []) {
      const key = questionKey(question);
      if (!key) continue;
      for (let index = rows.length - 1; index >= 0; index--) {
        if (rows[index].key === key) rows.splice(index, 1);
      }
      rows.push({ key, topic: extractTopic(question), seenAt: new Date().toISOString() });
    }
    this.storage.write('question-history', rows.slice(-this.maxEntries), this.profileProvider());
  }
  replace(rows) {
    const valid = (Array.isArray(rows) ? rows : []).filter(item => item && typeof item.key === 'string');
    this.storage.write('question-history', valid.slice(-this.maxEntries), this.profileProvider());
  }
  clear() {
    this.storage.write('question-history', [], this.profileProvider());
  }
}

export function correctOptionIndices(question) {
  const solution = String(question?.solucion ?? '').toUpperCase().replace(/[^A-D]/g, '');
  return [...new Set(solution.split('').map(letter => letter.charCodeAt(0) - 65))]
    .filter(index => index >= 0 && index < (question?.opciones?.length || 0))
    .sort((a, b) => a - b);
}

export function isMultipleAnswerQuestion(question) {
  return correctOptionIndices(question).length > 1;
}

export function grade(questions, answers, scoring, scoreFormula = null) {
  let correct=0, incorrect=0, blank=0;
  const errors=[];
  questions.forEach((q,index)=>{
    const raw = Object.prototype.hasOwnProperty.call(answers,index) ? answers[index] : null;
    const selected = Array.isArray(raw) ? [...new Set(raw)].sort((a,b)=>a-b) : raw === null ? [] : [raw];
    const expected = correctOptionIndices(q);
    const isBlank = selected.length === 0;
    const isCorrect = !isBlank && selected.length === expected.length
      && selected.every((value,position)=>value === expected[position]);
    const optionText = values => values.map(value=>q.opciones[value]).filter(Boolean).join(' · ');
    if (isBlank) {
      blank++;
      errors.push({index,questionId:q.id??null,question:q.cuestion,selected:null,correct:optionText(expected)||String(q.solucion??'')});
    } else if (isCorrect) {
      correct++;
    } else {
      incorrect++;
      errors.push({index,questionId:q.id??null,question:q.cuestion,selected:optionText(selected),correct:optionText(expected)||String(q.solucion??'')});
    }
  });
  const weightedScore=correct*scoring.correct + incorrect*scoring.incorrect + blank*scoring.blank;
  const formulaScore=typeof scoreFormula==='function'
    ? Number(scoreFormula({correct,incorrect,blank,questionCount:questions.length}))
    : weightedScore;
  const score=Number.isFinite(formulaScore)?formulaScore:weightedScore;
  return {correct,incorrect,blank,score,errors};
}

export class ExamEngine {
  constructor({config,questions,profileManager,history,sessionStore,failedQuestions,questionHistory=null,preferencesProvider=()=>({}),onChange}) {
    this.config=config; this.questions=questions; this.profiles=profileManager; this.history=history;
    this.sessions=sessionStore; this.failedQuestions=failedQuestions; this.questionHistory=questionHistory;
    this.preferencesProvider=preferencesProvider; this.onChange=onChange;
    this.state=null; this.tick=null;
  }
  start(mode='practice',restored=null) {
    const count=mode==='exam'?this.config.examQuestionCount:this.config.practiceQuestionCount;
    const source=mode==='failures'?this.failedQuestions.list():this.questions;
    const preferences=this.preferencesProvider()||{};
    const topicList=mode==='practice'&&Array.isArray(preferences.selectedTopics)
      ? preferences.selectedTopics : getAvailableTopics(source);
    const chosen=restored?.questions||(mode==='failures'
      ? shuffle(source).slice(0,Math.min(count,source.length))
      : typeof this.config.selectQuestions==='function'
        ? this.config.selectQuestions({mode,questions:source,count,preferences,questionHistory:this.questionHistory})
        : distributeQuestionsByTopic(source,topicList,count,this.questionHistory,{
            preserveTopicOrder:mode==='practice'&&preferences.orderByTopic===true
          }));
    if(!chosen.length) throw new Error(mode==='failures'?'Todavía no tienes preguntas falladas.':'El banco de preguntas está vacío.');
    this.state=restored
      ? {...restored,confirmedAnswers:Array.isArray(restored.confirmedAnswers)?restored.confirmedAnswers:[],startedAt:restored.startedAt||Date.now(),lastResumedAt:Date.now(),elapsedMs:Math.max(0,Number(restored.elapsedMs)||0)}
      : {id:crypto.randomUUID(),mode,questions:chosen,answers:{},confirmedAnswers:[],current:0,startedAt:Date.now(),lastResumedAt:Date.now(),elapsedMs:0};
    this.sessions.save(this.state); this.onChange(this.state);
    if(this.state.mode==='exam'&&this.remaining()<=0){this.finish(true);return;}
    this.startClock();
  }
  answer(index) {
    if(!this.state||!Number.isInteger(index)||index<0||index>=this.state.questions[this.state.current].opciones.length)return;
    const current=this.state.current;
    const question=this.state.questions[current];
    const multiple=isMultipleAnswerQuestion(question);
    const confirmed=this.state.confirmedAnswers||[];
    if(this.state.mode==='practice'&&confirmed.includes(current))return;
    if(multiple) {
      const selected=Array.isArray(this.state.answers[current])?[...this.state.answers[current]]:[];
      const position=selected.indexOf(index);
      if(position>=0)selected.splice(position,1);else selected.push(index);
      this.state.answers[current]=selected.sort((a,b)=>a-b);
    } else {
      this.state.answers[current]=index;
      if(this.state.mode==='practice') {
        this.state.confirmedAnswers=[...new Set([...confirmed,current])];
      }
    }
    if(!multiple&&this.state.mode==='exam'&&this.preferencesProvider()?.autoAdvanceExam===true&&this.state.current<this.state.questions.length-1) {
      this.state.current++;
    }
    this.persist(); this.onChange(this.state);
  }
  confirmAnswer() {
    if(!this.state||this.state.mode!=='practice')return;
    const current=this.state.current;
    const question=this.state.questions[current];
    if(!isMultipleAnswerQuestion(question))return;
    const selected=this.state.answers[current];
    if(!Array.isArray(selected)||selected.length===0)return;
    this.state.confirmedAnswers=[...new Set([...(this.state.confirmedAnswers||[]),current])];
    this.persist(); this.onChange(this.state);
  }
  move(delta) {
    if(!this.state)return;
    this.state.current=Math.max(0,Math.min(this.state.questions.length-1,this.state.current+delta));
    this.persist(); this.onChange(this.state);
  }
  elapsed() {
    if(this.state?.mode==='exam')return Math.max(0,Date.now()-this.state.startedAt);
    return Math.max(0,Number(this.state.elapsedMs||0)+(Date.now()-this.state.lastResumedAt));
  }
  remaining() { return this.state?.mode==='exam'?Math.max(0,this.config.examDurationMinutes*60*1000-this.elapsed()):null; }
  persist(syncPriority = 'high') {
    if(!this.state)return;
    this.state.elapsedMs=this.elapsed(); this.state.lastResumedAt=Date.now(); this.sessions.save(this.state, syncPriority);
  }
  startClock() {
    clearInterval(this.tick);
    this.tick=setInterval(()=>{
      if(!this.state)return;
      if(this.state.mode==='exam'&&this.remaining()<=0){this.finish(true);return;}
      this.persist('low'); this.onChange(this.state);
    },1000);
  }
  finish(timeExpired=false) {
    if(!this.state)return null;
    const durationMs=this.elapsed(); this.state.elapsedMs=durationMs;
    clearInterval(this.tick); this.tick=null;
    const result=grade(this.state.questions,this.state.answers,this.config.scoring,this.config.scoreFormula);
    const failed=result.errors.map(error=>({...error,question:this.state.questions[error.index],selectedAnswer:error.selected}));
    if(this.failedQuestions)this.failedQuestions.add(failed);
    this.history.add({id:this.state.id,mode:this.state.mode,startedAt:new Date(this.state.startedAt).toISOString(),finishedAt:new Date().toISOString(),durationMs,timeExpired,...result,questionCount:this.state.questions.length,questionIds:this.state.questions.map(question=>question.id??question.cuestion),errors:result.errors});
    this.questionHistory?.record(this.state.questions);
    this.sessions.clear();
    const finished={...this.state,result,durationMs,timeExpired}; this.state=null; this.onChange(null,finished); return finished;
  }
  dispose() { this.persist(); clearInterval(this.tick); this.tick=null; }
}
