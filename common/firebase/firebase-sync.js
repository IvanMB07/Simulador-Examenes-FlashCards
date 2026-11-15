import { firebaseConfig, isFirebaseConfigured } from './firebase-config.js';

import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js';
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, sendPasswordResetEmail, signOut
} from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js';
import {
  initializeFirestore, getFirestore, persistentLocalCache,
  persistentMultipleTabManager, collection, doc, getDocs, getDoc,
  setDoc, deleteDoc, onSnapshot
} from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js';

const stableStringify = value => {
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stableStringify(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
};

function mergeRecords(local, remote, idOf, timestampOf) {
  const merged = new Map();
  [...(remote || []), ...(local || [])].forEach(item => {
    if (!item) return;
    const id = idOf(item);
    if (!id) return;
    const previous = merged.get(id);
    if (!previous || (timestampOf(item) || 0) >= (timestampOf(previous) || 0)) merged.set(id, item);
  });
  return [...merged.values()];
}

function clean(value) {
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).map(([key, item]) => [key, clean(item)]));
  }
  return value;
}

function dateNumber(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

async function firestoreId(value) {
  const bytes = new TextEncoder().encode(String(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export class FirebaseSyncProvider {
  constructor({ storage, profileManager, simulatorId, onStatus = () => {}, onDataApplied = () => {} }) {
    this.storage = storage;
    this.baseNamespace = storage.namespace;
    this.profileManager = profileManager;
    this.simulatorId = simulatorId;
    this.onStatus = onStatus;
    this.onDataApplied = onDataApplied;
    this.app = null;
    this.auth = null;
    this.db = null;
    this.user = null;
    this.ready = false;
    this.applyingRemote = false;
    this.authUnsubscribe = null;
    this.subscriptions = [];
    this.syncQueue = Promise.resolve();
    this.pendingChanges = new Map();
    this.flushTimer = null;
    this.lastLowPrioritySync = new Map();
    this.conflictMessage = null;
    this.initialSyncPromise = Promise.resolve();
    this.storageListener = event => this.handleLocalChange(event);
    this.pageHideListener = () => this.flushPendingChanges();
    this.visibilityListener = () => { if (document.visibilityState === 'hidden') this.flushPendingChanges(); };
    this.onlineListener = () => { if (this.user) this.syncNow().catch(error => this.status('error', 'No se pudo recuperar la sincronización: ' + this.errorMessage(error))); };
    this.syncingNow = null;
  }

  status(state, message, user = this.user) {
    this.onStatus({ state, message, email: user?.email || null, uid: user?.uid || null });
  }

  async initialize() {
    if (!isFirebaseConfigured()) {
      this.status('unconfigured', 'Firebase todavía no está configurado. Los datos siguen guardándose en este dispositivo.', null);
      return false;
    }

    try {
      this.app = getApps().length ? getApp() : initializeApp(firebaseConfig);
      this.auth = getAuth(this.app);
      try {
        this.db = initializeFirestore(this.app, {
          localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
        });
      } catch (error) {
        // Firestore puede estar inicializado ya en otra parte o IndexedDB puede no estar disponible.
        this.db = getFirestore(this.app);
        console.warn('Firestore utilizará la caché disponible:', error);
      }

      window.addEventListener('simulador:storage-change', this.storageListener);
      window.addEventListener('pagehide', this.pageHideListener);
      window.addEventListener('online', this.onlineListener);
      document.addEventListener('visibilitychange', this.visibilityListener);
      this.authUnsubscribe = onAuthStateChanged(this.auth, user => {
        this.user = user;
        if (!user) {
          this.stopSubscriptions();
          const lastUid = localStorage.getItem(this.baseNamespace + ':cloud-owner');
          if (lastUid && this.bindAccountNamespace(lastUid, false)) this.onDataApplied();
          this.status('signed-out', 'No has iniciado sesión. El progreso local se conserva en este dispositivo.', null);
          return;
        }
        if (this.bindAccountNamespace(user.uid, true)) this.onDataApplied();
        this.status('syncing', 'Cuenta conectada. Preparando la sincronización…', user);
        this.subscribeCurrentProfile();
        this.initialSyncPromise = this.syncAll()
          .then(() => {
            this.subscribeCurrentProfile();
            this.status(this.conflictMessage ? 'conflict' : 'connected', this.conflictMessage || 'Cuenta conectada. Sincronización activa.', user);
            this.onDataApplied();
          })
          .catch(error => {
            console.error('Error al sincronizar con Firebase:', error);
            this.status('error', 'La cuenta está conectada, pero no se pudo completar la sincronización: ' + this.errorMessage(error), user);
          });
      });
      this.ready = true;
      return true;
    } catch (error) {
      console.error('No se pudo inicializar Firebase:', error);
      this.status('error', 'No se pudo inicializar Firebase: ' + this.errorMessage(error), null);
      return false;
    }
  }

  bindAccountNamespace(uid, migrateLocalData = false) {
    const targetNamespace = this.baseNamespace + ':user:' + uid;
    if (this.storage.namespace === targetNamespace) return false;

    const basePrefix = this.baseNamespace + ':';
    const targetPrefix = targetNamespace + ':';
    const ownerKey = this.baseNamespace + ':cloud-owner';
    const baseKeys = [];
    let targetHasData = false;
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (key && key.startsWith(targetPrefix)) { targetHasData = true; break; }
    }

    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (key && key.startsWith(basePrefix) && key !== ownerKey) baseKeys.push(key);
    }

    if (migrateLocalData && !targetHasData && baseKeys.length) {
      baseKeys.forEach(key => {
        const destination = targetPrefix + key.slice(basePrefix.length);
        if (localStorage.getItem(destination) === null) localStorage.setItem(destination, localStorage.getItem(key));
        localStorage.removeItem(key);
      });
    }

    this.storage.namespace = targetNamespace;
    localStorage.setItem(ownerKey, uid);
    this.profileManager.data = this.storage.read('profiles', 'global', {
      active: 'default',
      profiles: { default: { id: 'default', name: 'Usuario principal', createdAt: new Date().toISOString() } },
      deletedProfiles: []
    });
    if (!this.profileManager.data.profiles?.default) {
      this.profileManager.data.profiles ||= {};
      this.profileManager.data.profiles.default = { id: 'default', name: 'Usuario principal', createdAt: new Date().toISOString() };
    }
    if (!Array.isArray(this.profileManager.data.deletedProfiles)) this.profileManager.data.deletedProfiles = [];
    this.profileManager.save();
    return true;
  }

  async register(email, password) {
    this.ensureReady();
    if (password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');
    return createUserWithEmailAndPassword(this.auth, email.trim(), password);
  }

  async login(email, password) {
    this.ensureReady();
    return signInWithEmailAndPassword(this.auth, email.trim(), password);
  }

  async resetPassword(email) {
    this.ensureReady();
    if (!email.trim()) throw new Error('Introduce primero tu correo electrónico.');
    return sendPasswordResetEmail(this.auth, email.trim());
  }

  async logout() {
    this.ensureReady();
    await signOut(this.auth);
  }

  ensureReady() {
    if (!this.ready || !this.auth || !this.db) throw new Error('Configura Firebase antes de utilizar la sincronización.');
  }

  errorMessage(error) {
    const messages = {
      'auth/email-already-in-use': 'Ya existe una cuenta con ese correo.',
      'auth/invalid-email': 'El correo electrónico no es válido.',
      'auth/weak-password': 'La contraseña es demasiado débil.',
      'auth/invalid-credential': 'Correo o contraseña incorrectos.',
      'auth/user-disabled': 'Esta cuenta está deshabilitada.',
      'auth/too-many-requests': 'Demasiados intentos. Espera un momento y vuelve a intentarlo.',
      'auth/network-request-failed': 'No hay conexión con Firebase.',
      'auth/operation-not-allowed': 'Activa el proveedor Correo electrónico/contraseña en Firebase Authentication.',
      'permission-denied': 'Firestore ha rechazado la operación. Revisa las reglas de seguridad.',
      'failed-precondition': 'Firestore necesita que revises la configuración o un índice.',
      'unavailable': 'Firebase no está disponible en este momento.'
    };
    return messages[error?.code] || error?.message || 'Error desconocido.';
  }

  paths(profileId) {
    const root = ['users', this.user.uid, 'profiles', profileId, 'simulators', this.simulatorId];
    return {
      profile: ['users', this.user.uid, 'profiles', profileId],
      history: [...root, 'examSessions'],
      failures: [...root, 'failedQuestions'],
      active: [...root, 'activeSessions', 'current']
    };
  }

  collectionAt(path) { return collection(this.db, ...path); }
  documentAt(path) { return doc(this.db, ...path); }

  async setRecords(path, rows, idOf) {
    const target = this.collectionAt(path);
    const tasks = [];
    for (const row of rows || []) {
      const id = await idOf(row);
      tasks.push(setDoc(doc(target, id), { record: clean(row), updatedAtMs: Date.now() }, { merge: true }));
      if (tasks.length >= 15) {
        await Promise.all(tasks);
        tasks.length = 0;
      }
    }
    if (tasks.length) await Promise.all(tasks);
  }

  async syncRecordDiff(path, currentRows, previousRows, keyOf) {
    const current = new Map((currentRows || []).map(item => [keyOf(item), item]).filter(([key]) => Boolean(key)));
    const previous = new Map((previousRows || []).map(item => [keyOf(item), item]).filter(([key]) => Boolean(key)));
    const target = this.collectionAt(path);
    const tasks = [];

    for (const [key, row] of current) {
      if (previous.has(key) && stableStringify(previous.get(key)) === stableStringify(row)) continue;
      const id = await firestoreId(key);
      tasks.push(setDoc(doc(target, id), { record: clean(row), updatedAtMs: Date.now() }, { merge: true }));
      if (tasks.length >= 15) {
        await Promise.all(tasks);
        tasks.length = 0;
      }
    }

    for (const key of previous.keys()) {
      if (current.has(key)) continue;
      const id = await firestoreId(key);
      tasks.push(deleteDoc(doc(target, id)));
      if (tasks.length >= 15) {
        await Promise.all(tasks);
        tasks.length = 0;
      }
    }

    if (tasks.length) await Promise.all(tasks);
  }

  async deleteRemoteProfile(profileId, deletedAtMs = Date.now()) {
    const root = ['users', this.user.uid, 'profiles', profileId, 'simulators', this.simulatorId];
    for (const name of ['examSessions', 'failedQuestions']) {
      const snapshot = await getDocs(this.collectionAt([...root, name]));
      await Promise.all(snapshot.docs.map(item => deleteDoc(item.ref)));
    }
    const activePath = [...root, 'activeSessions', 'current'];
    await deleteDoc(this.documentAt(activePath)).catch(() => {});
    await setDoc(this.documentAt(['users', this.user.uid, 'profiles', profileId]), {
      id: profileId, deletedAtMs, updatedAtMs: Date.now()
    }, { merge: true });
  }

  async syncProfiles() {
    const local = this.profileManager.data;
    const remoteSnapshot = await getDocs(this.collectionAt(['users', this.user.uid, 'profiles']));
    const merged = { ...(local.profiles || {}) };
    const deleted = new Set(local.deletedProfiles || []);

    remoteSnapshot.forEach(snapshot => {
      const data = snapshot.data();
      if (data.deletedAtMs) {
        deleted.add(snapshot.id);
        delete merged[snapshot.id];
      } else if (!deleted.has(snapshot.id)) {
        merged[snapshot.id] = {
          id: snapshot.id,
          name: data.name || merged[snapshot.id]?.name || 'Perfil',
          createdAt: data.createdAt || merged[snapshot.id]?.createdAt || new Date().toISOString()
        };
      }
    });

    deleted.forEach(id => delete merged[id]);
    if (!merged.default && !deleted.has('default')) merged.default = { id: 'default', name: 'Usuario principal', createdAt: new Date().toISOString() };
    this.profileManager.data.profiles = merged;
    this.profileManager.data.deletedProfiles = [...deleted];
    if (!merged[this.profileManager.data.active]) this.profileManager.data.active = 'default';

    this.applyingRemote = true;
    try { this.profileManager.save(); } finally { this.applyingRemote = false; }

    for (const profileId of deleted) {
      const localTombstone = (local.deletedProfiles || []).includes(profileId);
      const remoteData = remoteSnapshot.docs.find(item => item.id === profileId)?.data();
      if (localTombstone && !remoteData?.deletedAtMs) await this.deleteRemoteProfile(profileId);
    }

    await Promise.all(Object.values(merged).map(profile => setDoc(
      this.documentAt(['users', this.user.uid, 'profiles', profile.id]),
      { id: profile.id, name: profile.name, createdAt: profile.createdAt, updatedAtMs: Date.now() },
      { merge: true }
    )));
  }

  async syncHistory(profileId) {
    const path = this.paths(profileId).history;
    const local = this.storage.read('exam-history', profileId, []);
    const remoteSnapshot = await getDocs(this.collectionAt(path));
    const remote = remoteSnapshot.docs.map(snapshot => snapshot.data().record).filter(Boolean);
    const merged = mergeRecords(local, remote, item => item.id, item => dateNumber(item.finishedAt))
      .sort((a, b) => dateNumber(b.finishedAt) - dateNumber(a.finishedAt)).slice(0, 500);
    if (stableStringify(local) !== stableStringify(merged)) {
      this.applyingRemote = true;
      try { this.storage.write('exam-history', merged, profileId); } finally { this.applyingRemote = false; }
    }
    const retainedIds = new Set(merged.map(item => item.id));
    await Promise.all(remoteSnapshot.docs
      .filter(snapshot => {
        const record = snapshot.data().record;
        return !record || !retainedIds.has(record.id);
      })
      .map(snapshot => deleteDoc(snapshot.ref)));
    await this.setRecords(path, merged, async item => await firestoreId(item.id));
  }

  async syncFailures(profileId) {
    const path = this.paths(profileId).failures;
    const localAll = this.storage.read('failed-questions', profileId, []);
    const remoteSnapshot = await getDocs(this.collectionAt(path));
    const meta = remoteSnapshot.docs.find(snapshot => snapshot.id === '__meta')?.data();
    const clearedAt = Number(meta?.clearedAtMs) || 0;
    const local = localAll.filter(item => dateNumber(item.lastFailedAt) >= clearedAt);
    const remote = remoteSnapshot.docs
      .filter(snapshot => snapshot.id !== '__meta')
      .map(snapshot => snapshot.data().record).filter(Boolean)
      .filter(item => dateNumber(item.lastFailedAt) >= clearedAt);
    const merged = mergeRecords(local, remote, item => item.id || item.cuestion, item => dateNumber(item.lastFailedAt));
    if (stableStringify(localAll) !== stableStringify(merged)) {
      this.applyingRemote = true;
      try { this.storage.write('failed-questions', merged, profileId); } finally { this.applyingRemote = false; }
    }
    const retainedKeys = new Set(merged.map(item => item.id || item.cuestion));
    await Promise.all(remoteSnapshot.docs
      .filter(snapshot => snapshot.id !== '__meta')
      .filter(snapshot => {
        const record = snapshot.data().record;
        return !record || !retainedKeys.has(record.id || record.cuestion);
      })
      .map(snapshot => deleteDoc(snapshot.ref)));
    await this.setRecords(path, merged, async item => await firestoreId(item.id || item.cuestion));
  }

  async syncActiveSession(profileId) {
    const path = this.paths(profileId).active;
    const local = this.storage.read('active-session', profileId, null);
    const remoteSnapshot = await getDoc(this.documentAt(path));
    const remoteData = remoteSnapshot.exists() ? remoteSnapshot.data() : null;
    const remoteDeletedAt = Number(remoteData?.deletedAtMs) || 0;
    const remote = remoteDeletedAt ? null : remoteData?.record || null;
    const localTime = dateNumber(local?.savedAt);
    const remoteTime = dateNumber(remote?.savedAt);
    if (local && remote && local.id !== remote.id) {
      this.conflictMessage = 'Hay dos sesiones activas distintas para este perfil. Se conserva la sesión local; no las abras simultáneamente en dos dispositivos.';
      this.status('conflict', this.conflictMessage);
      return;
    }
    this.conflictMessage = null;
    if (remoteDeletedAt && remoteDeletedAt >= localTime) {
      if (local) {
        this.applyingRemote = true;
        try { this.storage.remove('active-session', profileId); } finally { this.applyingRemote = false; }
      }
      return;
    }
    const selected = remote && remoteTime > localTime ? remote : local;
    if (selected && stableStringify(selected) !== stableStringify(local)) {
      this.applyingRemote = true;
      try { this.storage.write('active-session', selected, profileId); } finally { this.applyingRemote = false; }
    }
    if (selected) await setDoc(this.documentAt(path), { record: clean(selected), deletedAtMs: null, updatedAtMs: Date.now() }, { merge: true });
    else if (!local && remoteSnapshot.exists()) {
      // No se borra una sesión remota solo porque este dispositivo todavía no tenga copia local.
    }
  }

  async syncProfile(profileId) {
    await this.syncHistory(profileId);
    await this.syncFailures(profileId);
    await this.syncActiveSession(profileId);
  }

  async syncAll() {
    if (!this.user) return;
    await this.syncProfiles();
    const profileIds = Object.keys(this.profileManager.data.profiles);
    for (const profileId of profileIds) await this.syncProfile(profileId);
  }

  enqueue(task) {
    this.syncQueue = this.syncQueue.then(task).catch(error => {
      console.error('Sincronización pendiente:', error);
      this.status('error', 'No se pudo sincronizar: ' + this.errorMessage(error));
    });
    return this.syncQueue;
  }

  handleLocalChange(event) {
    const detail = event.detail || {};
    if (!this.user || this.applyingRemote || detail.namespace !== this.storage.namespace) return;
    const key = detail.name + ':' + detail.profile;
    const now = Date.now();
    if (detail.syncPriority === 'low') {
      if (now - (this.lastLowPrioritySync.get(key) || 0) < 30000) return;
      this.lastLowPrioritySync.set(key, now);
    } else if (detail.name === 'active-session') {
      this.lastLowPrioritySync.set(key, now);
    }
    this.pendingChanges.set(key, { ...detail, syncUid: this.user.uid });
    clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => this.flushPendingChanges(), 500);
  }

  flushPendingChanges() {
    clearTimeout(this.flushTimer);
    this.flushTimer = null;
    const changes = [...this.pendingChanges.values()];
    this.pendingChanges.clear();
    changes.forEach(change => this.enqueue(() => this.pushLocalChange(change)));
  }

  async pushLocalChange(detail) {
    if (!this.user || detail.syncUid !== this.user.uid) return;
    if (detail.name === 'profiles' && detail.profile === 'global') {
      const registry = detail.value || {};
      for (const profileId of registry.deletedProfiles || []) {
        const existing = await getDoc(this.documentAt(['users', this.user.uid, 'profiles', profileId]));
        if (!existing.exists() || !existing.data().deletedAtMs) await this.deleteRemoteProfile(profileId);
      }
      const profiles = registry.profiles || {};
      await Promise.all(Object.values(profiles).map(profile => setDoc(
        this.documentAt(['users', this.user.uid, 'profiles', profile.id]),
        { id: profile.id, name: profile.name, createdAt: profile.createdAt, updatedAtMs: Date.now() },
        { merge: true }
      )));
      this.subscribeCurrentProfile();
      return;
    }

    const profileId = detail.profile;
    const paths = this.paths(profileId);
    if (detail.name === 'exam-history') {
      await this.syncRecordDiff(paths.history, detail.value || [], detail.previous || [], item => item.id);
    } else if (detail.name === 'failed-questions') {
      const records = detail.value || [];
      if (!records.length && (detail.previous || []).length) {
        const clearTime = Date.now();
        await setDoc(doc(this.collectionAt(paths.failures), '__meta'), { clearedAtMs: clearTime, updatedAtMs: clearTime }, { merge: true });
        const existing = await getDocs(this.collectionAt(paths.failures));
        await Promise.all(existing.docs.filter(snapshot => snapshot.id !== '__meta').map(snapshot => deleteDoc(snapshot.ref)));
      } else if (records.length) {
        await this.syncRecordDiff(paths.failures, records, detail.previous || [], item => item.id || item.cuestion);
      }
    } else if (detail.name === 'active-session') {
      if (detail.removed) {
        await setDoc(this.documentAt(paths.active), { record: null, deletedAtMs: Date.now(), updatedAtMs: Date.now() }, { merge: true });
      } else if (detail.value) {
        await setDoc(this.documentAt(paths.active), { record: clean(detail.value), deletedAtMs: null, updatedAtMs: Date.now() }, { merge: true });
      }
    }
  }

  stopSubscriptions() {
    this.subscriptions.forEach(unsubscribe => unsubscribe());
    this.subscriptions = [];
  }

  applyRemote(name, profileId, value) {
    this.applyingRemote = true;
    try { this.storage.write(name, value, profileId); } finally { this.applyingRemote = false; }
    this.onDataApplied();
  }

  subscribeCurrentProfile() {
    if (!this.user) return;
    this.stopSubscriptions();
    const profileId = this.profileManager.activeId;
    const paths = this.paths(profileId);

    this.subscriptions.push(onSnapshot(this.collectionAt(paths.history), snapshot => {
      const remote = snapshot.docs.map(item => item.data().record).filter(Boolean);
      const local = this.storage.read('exam-history', profileId, []);
      const merged = mergeRecords(local, remote, item => item.id, item => dateNumber(item.finishedAt))
        .sort((a, b) => dateNumber(b.finishedAt) - dateNumber(a.finishedAt)).slice(0, 500);
      if (stableStringify(local) !== stableStringify(merged)) this.applyRemote('exam-history', profileId, merged);
      const retainedIds = new Set(merged.map(item => item.id));
      const stale = snapshot.docs.filter(item => { const record = item.data().record; return !record || !retainedIds.has(record.id); });
      if (stale.length) this.enqueue(() => Promise.all(stale.map(item => deleteDoc(item.ref))));
    }, error => this.status('error', 'No se pudo actualizar el historial: ' + this.errorMessage(error))));

    this.subscriptions.push(onSnapshot(this.collectionAt(paths.failures), snapshot => {
      const meta = snapshot.docs.find(item => item.id === '__meta')?.data();
      const clearedAt = Number(meta?.clearedAtMs) || 0;
      const remote = snapshot.docs
        .filter(item => item.id !== '__meta')
        .map(item => item.data().record).filter(Boolean)
        .filter(item => dateNumber(item.lastFailedAt) >= clearedAt);
      const localAll = this.storage.read('failed-questions', profileId, []);
      const local = localAll.filter(item => dateNumber(item.lastFailedAt) >= clearedAt);
      const merged = mergeRecords(local, remote, item => item.id || item.cuestion, item => dateNumber(item.lastFailedAt));
      if (stableStringify(localAll) !== stableStringify(merged)) this.applyRemote('failed-questions', profileId, merged);
    }, error => this.status('error', 'No se pudieron actualizar los fallos: ' + this.errorMessage(error))));

    let activeSnapshotInitialized = false;
    let lastRemoteActiveId = null;
    this.subscriptions.push(onSnapshot(this.documentAt(paths.active), snapshot => {
      const local = this.storage.read('active-session', profileId, null);
      if (!snapshot.exists()) {
        this.conflictMessage = null;
        activeSnapshotInitialized = true;
        lastRemoteActiveId = null;
        return;
      }
      const remoteData = snapshot.data();
      if (remoteData.deletedAtMs) {
        if (local && dateNumber(local.savedAt) <= Number(remoteData.deletedAtMs)) {
          this.applyingRemote = true;
          try { this.storage.remove('active-session', profileId); } finally { this.applyingRemote = false; }
          this.onDataApplied();
        } else if (local && dateNumber(local.savedAt) > Number(remoteData.deletedAtMs)) {
          this.enqueue(() => setDoc(this.documentAt(paths.active), { record: clean(local), deletedAtMs: null, updatedAtMs: Date.now() }, { merge: true }));
        }
        this.conflictMessage = null;
        activeSnapshotInitialized = true;
        lastRemoteActiveId = null;
        return;
      }
      const remote = remoteData.record;
      lastRemoteActiveId = remote?.id || null;
      activeSnapshotInitialized = true;
      if (remote && local && remote.id !== local.id) {
        this.conflictMessage = 'Hay otra sesión activa en este perfil desde otro dispositivo. Se conserva la sesión local para no mezclar respuestas.';
        this.status('conflict', this.conflictMessage);
        return;
      }
      this.conflictMessage = null;
      if (remote && dateNumber(remote.savedAt) > dateNumber(local?.savedAt)) this.applyRemote('active-session', profileId, remote);
    }, error => this.status('error', 'No se pudo actualizar la sesión: ' + this.errorMessage(error))));

    this.subscriptions.push(onSnapshot(this.collectionAt(['users', this.user.uid, 'profiles']), snapshot => {
      const merged = { ...this.profileManager.data.profiles };
      const deleted = new Set(this.profileManager.data.deletedProfiles || []);
      snapshot.forEach(item => {
        const data = item.data();
        if (data.deletedAtMs) {
          deleted.add(item.id); delete merged[item.id];
          this.applyingRemote = true;
          try {
            this.storage.remove('exam-history', item.id);
            this.storage.remove('failed-questions', item.id);
            this.storage.remove('active-session', item.id);
          } finally { this.applyingRemote = false; }
        }
        else if (!deleted.has(item.id)) merged[item.id] = { id: item.id, name: data.name || 'Perfil', createdAt: data.createdAt || new Date().toISOString() };
      });
      this.applyingRemote = true;
      try {
        this.profileManager.data.profiles = merged;
        this.profileManager.data.deletedProfiles = [...deleted];
        if (!merged[this.profileManager.data.active]) this.profileManager.data.active = 'default';
        this.profileManager.save();
      } finally { this.applyingRemote = false; }
      this.onDataApplied();
    }, error => this.status('error', 'No se pudieron actualizar los perfiles: ' + this.errorMessage(error))));
  }

  setActiveProfile() {
    this.conflictMessage = null;
    if (this.user) this.subscribeCurrentProfile();
  }

  async syncNow() {
    if (!this.user) throw new Error('Inicia sesión para sincronizar.');
    if (this.syncingNow) return this.syncingNow;
    this.status('syncing', 'Sincronizando datos…');
    this.syncingNow = this.syncAll()
      .then(() => {
        this.subscribeCurrentProfile();
        this.status(this.conflictMessage ? 'conflict' : 'connected', this.conflictMessage || 'Sincronización completada.');
        this.onDataApplied();
      })
      .finally(() => { this.syncingNow = null; });
    return this.syncingNow;
  }

  destroy() {
    clearTimeout(this.flushTimer);
    this.stopSubscriptions();
    if (this.authUnsubscribe) this.authUnsubscribe();
    window.removeEventListener('simulador:storage-change', this.storageListener);
    window.removeEventListener('pagehide', this.pageHideListener);
    window.removeEventListener('online', this.onlineListener);
    document.removeEventListener('visibilitychange', this.visibilityListener);
  }
}
