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
    this.initialSyncPromise = Promise.resolve();
    this.storageListener = event => this.handleLocalChange(event);
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
      this.authUnsubscribe = onAuthStateChanged(this.auth, user => {
        this.user = user;
        if (!user) {
          this.stopSubscriptions();
          this.status('signed-out', 'No has iniciado sesión. El progreso se guarda localmente.', null);
          return;
        }
        this.status('syncing', 'Cuenta conectada. Preparando la sincronización…', user);
        this.initialSyncPromise = this.syncAll()
          .then(() => {
            this.subscribeCurrentProfile();
            this.status('connected', 'Cuenta conectada. Sincronización activa.', user);
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

  async syncProfiles() {
    const local = this.profileManager.data;
    const remoteSnapshot = await getDocs(this.collectionAt(['users', this.user.uid, 'profiles']));
    const merged = { ...(local.profiles || {}) };

    remoteSnapshot.forEach(snapshot => {
      const data = snapshot.data();
      if (data.deletedAtMs) {
        delete merged[snapshot.id];
      } else {
        merged[snapshot.id] = {
          id: snapshot.id,
          name: data.name || merged[snapshot.id]?.name || 'Perfil',
          createdAt: data.createdAt || merged[snapshot.id]?.createdAt || new Date().toISOString()
        };
      }
    });

    if (!merged.default) merged.default = { id: 'default', name: 'Usuario principal', createdAt: new Date().toISOString() };
    this.profileManager.data.profiles = merged;
    if (!merged[this.profileManager.data.active]) this.profileManager.data.active = 'default';

    this.applyingRemote = true;
    try { this.profileManager.save(); } finally { this.applyingRemote = false; }

    const profiles = Object.values(merged);
    await Promise.all(profiles.map(profile => setDoc(
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
    const merged = mergeRecords(local, remote, item => item.id, item => dateNumber(item.finishedAt));
    if (stableStringify(local) !== stableStringify(merged)) {
      this.applyingRemote = true;
      try { this.storage.write('exam-history', merged, profileId); } finally { this.applyingRemote = false; }
    }
    await this.setRecords(path, merged, async item => await firestoreId(item.id));
  }

  async syncFailures(profileId) {
    const path = this.paths(profileId).failures;
    const local = this.storage.read('failed-questions', profileId, []);
    const remoteSnapshot = await getDocs(this.collectionAt(path));
    const remote = remoteSnapshot.docs.map(snapshot => snapshot.data().record).filter(Boolean);
    const merged = mergeRecords(local, remote, item => item.id || item.cuestion, item => dateNumber(item.lastFailedAt));
    if (stableStringify(local) !== stableStringify(merged)) {
      this.applyingRemote = true;
      try { this.storage.write('failed-questions', merged, profileId); } finally { this.applyingRemote = false; }
    }
    await this.setRecords(path, merged, async item => await firestoreId(item.id || item.cuestion));
  }

  async syncActiveSession(profileId) {
    const path = this.paths(profileId).active;
    const local = this.storage.read('active-session', profileId, null);
    const remoteSnapshot = await getDoc(this.documentAt(path));
    const remote = remoteSnapshot.exists() ? remoteSnapshot.data().record : null;
    const localTime = dateNumber(local?.savedAt);
    const remoteTime = dateNumber(remote?.savedAt);
    const selected = remote && remoteTime > localTime ? remote : local;
    if (selected && stableStringify(selected) !== stableStringify(local)) {
      this.applyingRemote = true;
      try { this.storage.write('active-session', selected, profileId); } finally { this.applyingRemote = false; }
    }
    if (selected) await setDoc(this.documentAt(path), { record: clean(selected), updatedAtMs: Date.now() }, { merge: true });
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
    if (detail.syncPriority === 'low') {
      const now = Date.now();
      if (now - (this.lastLowPrioritySync.get(key) || 0) < 30000) return;
      this.lastLowPrioritySync.set(key, now);
    }
    this.pendingChanges.set(key, detail);
    clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => {
      const changes = [...this.pendingChanges.values()];
      this.pendingChanges.clear();
      changes.forEach(change => this.enqueue(() => this.pushLocalChange(change)));
    }, 1200);
  }

  async pushLocalChange(detail) {
    if (!this.user) return;
    if (detail.name === 'profiles' && detail.profile === 'global') {
      const profiles = detail.value?.profiles || {};
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
      await this.setRecords(paths.history, detail.value || [], async item => await firestoreId(item.id));
    } else if (detail.name === 'failed-questions') {
      const records = detail.value || [];
      if (!records.length) {
        const existing = await getDocs(this.collectionAt(paths.failures));
        await Promise.all(existing.docs.map(snapshot => deleteDoc(snapshot.ref)));
      } else {
        await this.setRecords(paths.failures, records, async item => await firestoreId(item.id || item.cuestion));
      }
    } else if (detail.name === 'active-session') {
      if (detail.removed) {
        // La sesión activa es compartida por perfil. Solo se elimina si coincide con la sesión borrada localmente.
        const remote = await getDoc(this.documentAt(paths.active));
        const remoteId = remote.exists() ? remote.data().record?.id : null;
        if (remoteId && remoteId === detail.previous?.id) await deleteDoc(this.documentAt(paths.active));
      } else if (detail.value) {
        await setDoc(this.documentAt(paths.active), { record: clean(detail.value), updatedAtMs: Date.now() }, { merge: true });
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
      const merged = mergeRecords(local, remote, item => item.id, item => dateNumber(item.finishedAt));
      if (stableStringify(local) !== stableStringify(merged)) this.applyRemote('exam-history', profileId, merged);
    }, error => this.status('error', 'No se pudo actualizar el historial: ' + this.errorMessage(error))));

    this.subscriptions.push(onSnapshot(this.collectionAt(paths.failures), snapshot => {
      const remote = snapshot.docs.map(item => item.data().record).filter(Boolean);
      const local = this.storage.read('failed-questions', profileId, []);
      const merged = mergeRecords(local, remote, item => item.id || item.cuestion, item => dateNumber(item.lastFailedAt));
      if (stableStringify(local) !== stableStringify(merged)) this.applyRemote('failed-questions', profileId, merged);
    }, error => this.status('error', 'No se pudieron actualizar los fallos: ' + this.errorMessage(error))));

    this.subscriptions.push(onSnapshot(this.documentAt(paths.active), snapshot => {
      if (!snapshot.exists()) return;
      const remote = snapshot.data().record;
      const local = this.storage.read('active-session', profileId, null);
      if (remote && dateNumber(remote.savedAt) > dateNumber(local?.savedAt)) this.applyRemote('active-session', profileId, remote);
    }, error => this.status('error', 'No se pudo actualizar la sesión: ' + this.errorMessage(error))));

    this.subscriptions.push(onSnapshot(this.collectionAt(['users', this.user.uid, 'profiles']), snapshot => {
      const merged = { ...this.profileManager.data.profiles };
      snapshot.forEach(item => {
        const data = item.data();
        if (data.deletedAtMs) delete merged[item.id];
        else merged[item.id] = { id: item.id, name: data.name || 'Perfil', createdAt: data.createdAt || new Date().toISOString() };
      });
      this.applyingRemote = true;
      try {
        this.profileManager.data.profiles = merged;
        if (!merged[this.profileManager.data.active]) this.profileManager.data.active = 'default';
        this.profileManager.save();
      } finally { this.applyingRemote = false; }
      this.onDataApplied();
    }, error => this.status('error', 'No se pudieron actualizar los perfiles: ' + this.errorMessage(error))));
  }

  setActiveProfile() {
    if (this.user) this.subscribeCurrentProfile();
  }

  async syncNow() {
    if (!this.user) throw new Error('Inicia sesión para sincronizar.');
    this.status('syncing', 'Sincronizando datos…');
    await this.syncAll();
    this.subscribeCurrentProfile();
    this.status('connected', 'Sincronización completada.');
    this.onDataApplied();
  }

  destroy() {
    clearTimeout(this.flushTimer);
    this.stopSubscriptions();
    if (this.authUnsubscribe) this.authUnsubscribe();
    window.removeEventListener('simulador:storage-change', this.storageListener);
  }
}
