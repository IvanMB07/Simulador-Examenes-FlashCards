/* Simulador universal · núcleo independiente de la asignatura. */
export class StorageAdapter {
  constructor(namespace = 'simulador') { this.namespace = namespace; }
  key(name, profile = 'default') { return `${this.namespace}:${name}:${profile}`; }
  read(name, profile = 'default', fallback = null) {
    try { const raw = localStorage.getItem(this.key(name, profile)); return raw === null ? fallback : JSON.parse(raw); }
    catch { return fallback; }
  }
  write(name, value, profile = 'default') {
    try { localStorage.setItem(this.key(name, profile), JSON.stringify(value)); return true; }
    catch (error) { console.error('No se pudo guardar en el dispositivo:', error); return false; }
  }
  remove(name, profile = 'default') { localStorage.removeItem(this.key(name, profile)); }
}

export class ProfileManager {
  constructor(storage) {
    this.storage = storage;
    this.data = storage.read('profiles', 'global', { active: 'default', profiles: { default: { id: 'default', name: 'Usuario principal', createdAt: new Date().toISOString() } } });
    if (!this.data.profiles.default) this.data.profiles.default = { id:'default', name:'Usuario principal', createdAt:new Date().toISOString() };
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
    this.data.profiles[id] = { id, name: clean, createdAt: new Date().toISOString() };
    this.data.active = id; this.save(); return id;
  }
  removeActive() {
    if (this.activeId === 'default') throw new Error('El perfil principal no se puede eliminar.');
    const id = this.activeId; delete this.data.profiles[id]; this.data.active = 'default'; this.save();
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
  clear() { this.storage.write('exam-history', [], this.profileProvider()); }
  export() {
    const blob = new Blob([JSON.stringify({schemaVersion:1, simulatorId:this.simulatorId, profileId:this.profileProvider(), exportedAt:new Date().toISOString(), sessions:this.list()},null,2)], {type:'application/json'});
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=`historial-${this.simulatorId}.json`; a.click(); URL.revokeObjectURL(url);
  }
}

export class SessionStore {
  constructor(storage, profileProvider, simulatorId) { this.storage=storage; this.profileProvider=profileProvider; this.simulatorId=simulatorId; }
  get() { return this.storage.read('active-session', this.profileProvider(), null); }
  save(session) { this.storage.write('active-session', {...session, simulatorId:this.simulatorId, profileId:this.profileProvider(), savedAt:new Date().toISOString()}, this.profileProvider()); }
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

export function grade(questions, answers, scoring) {
  let correct=0, incorrect=0, blank=0;
  const errors=[];
  questions.forEach((q,index)=>{
    const answer = Object.prototype.hasOwnProperty.call(answers,index) ? answers[index] : null;
    if (answer === null) { blank++; errors.push({index, questionId:q.id ?? null, question:q.cuestion, selected:null, correct:q.opciones.find(o=>o.trim().charAt(0).toUpperCase()===String(q.solucion).trim().charAt(0).toUpperCase()) ?? q.solucion}); }
    else {
      const key = q.opciones[answer]?.trim().charAt(0).toUpperCase();
      if (key === String(q.solucion).trim().charAt(0).toUpperCase()) correct++;
      else { incorrect++; errors.push({index, questionId:q.id ?? null, question:q.cuestion, selected:q.opciones[answer], correct:q.opciones.find(o=>o.trim().charAt(0).toUpperCase()===String(q.solucion).trim().charAt(0).toUpperCase()) ?? q.solucion}); }
    }
  });
  return {correct, incorrect, blank, score:correct*scoring.correct + incorrect*scoring.incorrect + blank*scoring.blank, errors};
}

export class ExamEngine {
  constructor({config,questions,profileManager,history,sessionStore,failedQuestions,onChange}) {
    this.config=config; this.questions=questions; this.profiles=profileManager; this.history=history;
    this.sessions=sessionStore; this.failedQuestions=failedQuestions; this.onChange=onChange;
    this.state=null; this.tick=null;
  }
  start(mode='practice',restored=null) {
    const count=mode==='exam'?this.config.examQuestionCount:this.config.practiceQuestionCount;
    const source=mode==='failures'?this.failedQuestions.list():this.questions;
    const chosen=restored?.questions||shuffle(source).slice(0,Math.min(count,source.length));
    if(!chosen.length) throw new Error(mode==='failures'?'Todavía no tienes preguntas falladas.':'El banco de preguntas está vacío.');
    this.state=restored
      ? {...restored,startedAt:restored.startedAt||Date.now(),lastResumedAt:Date.now(),elapsedMs:Math.max(0,Number(restored.elapsedMs)||0)}
      : {id:crypto.randomUUID(),mode,questions:chosen,answers:{},current:0,startedAt:Date.now(),lastResumedAt:Date.now(),elapsedMs:0};
    this.sessions.save(this.state); this.onChange(this.state);
    if(this.state.mode==='exam'&&this.remaining()<=0){this.finish(true);return;}
    this.startClock();
  }
  answer(index) {
    if(!this.state||!Number.isInteger(index)||index<0||index>=this.state.questions[this.state.current].opciones.length)return;
    this.state.answers[this.state.current]=index; this.persist(); this.onChange(this.state);
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
  persist() {
    if(!this.state)return;
    this.state.elapsedMs=this.elapsed(); this.state.lastResumedAt=Date.now(); this.sessions.save(this.state);
  }
  startClock() {
    clearInterval(this.tick);
    this.tick=setInterval(()=>{
      if(!this.state)return;
      if(this.state.mode==='exam'&&this.remaining()<=0){this.finish(true);return;}
      this.persist(); this.onChange(this.state);
    },1000);
  }
  finish(timeExpired=false) {
    if(!this.state)return null;
    const durationMs=this.elapsed(); this.state.elapsedMs=durationMs;
    clearInterval(this.tick); this.tick=null;
    const result=grade(this.state.questions,this.state.answers,this.config.scoring);
    const failed=result.errors.map(error=>({...error,question:this.state.questions[error.index],selectedAnswer:error.selected}));
    if(this.failedQuestions)this.failedQuestions.add(failed);
    this.history.add({id:this.state.id,mode:this.state.mode,startedAt:new Date(this.state.startedAt).toISOString(),finishedAt:new Date().toISOString(),durationMs,timeExpired,...result,questionCount:this.state.questions.length,errors:result.errors});
    this.sessions.clear();
    const finished={...this.state,result,durationMs,timeExpired}; this.state=null; this.onChange(null,finished); return finished;
  }
  dispose() { this.persist(); clearInterval(this.tick); this.tick=null; }
}
