/*
 * Sincronización cloud SegSisSw.
 * Local-first: localStorage sigue siendo la persistencia inmediata; Supabase replica
 * cambios cuando hay sesión y conexión. No recarga la página al recibir cambios.
 */
(() => {
  'use strict';

  const ALLOWED = key => key === 'configApp' ||
    key.startsWith('preguntasFalladas:') ||
    key.startsWith('historialPreguntas:') ||
    key.startsWith('simuladorSesion:');
  const EMAIL_DOMAIN = 'cuenta.simulador.invalid';

  let client = null;
  let user = null;
  let revision = 0;
  let syncing = false;
  let dirty = false;
  let syncTimer = null;
  let retryTimer = null;
  let channel = null;
  let applying = false;
  let lastRemoteAt = null;
  let lastSyncedSnapshot = null;
  let localChangeVersion = 0;
  let retryAttempt = 0;
  let storageHooksInstalled = false;

  const $ = id => document.getElementById(id);
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

  function status(message, kind = 'info') {
    const el = $('cloudStatus');
    if (el) { el.textContent = message; el.dataset.kind = kind; }
    const badge = $('cloudBadge');
    if (badge) {
      badge.textContent = kind === 'ok' ? 'Sincronizado' :
        kind === 'error' ? 'Error de sincronización' :
          user ? 'Conectado' : 'Solo en este dispositivo';
    }
  }

  function configured() {
    const config = window.SIMULADOR_CLOUD_CONFIG || {};
    return Boolean(config.supabaseUrl && config.supabaseAnonKey && window.supabase?.createClient);
  }

  function getClient() {
    if (!configured()) throw new Error('Falta configurar Supabase en cloud-config.js.');
    if (!client) {
      const config = window.SIMULADOR_CLOUD_CONFIG;
      client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
      });
    }
    return client;
  }

  function normalizeName(value) {
    return String(value || '').trim().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9._-]/g, '').replace(/^[-._]+|[-._]+$/g, '').slice(0, 24);
  }

  function accountEmail(name) { return `${name}@${EMAIL_DOMAIN}`; }

  function snapshot() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !ALLOWED(key)) continue;
      const raw = localStorage.getItem(key);
      try { data[key] = JSON.parse(raw); }
      catch { data[key] = raw; }
    }
    return data;
  }

  function stable(value) {
    if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
    if (value && typeof value === 'object') {
      return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
  }

  function snapshotsEqual(a, b) { return stable(a || {}) === stable(b || {}); }

  function writeSnapshotToLocal(data) {
    applying = true;
    try {
      const existing = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && ALLOWED(key)) existing.push(key);
      }
      existing.forEach(key => localStorage.removeItem(key));
      Object.entries(data || {}).forEach(([key, value]) => {
        if (ALLOWED(key)) {
          localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
        }
      });
    } finally {
      applying = false;
    }
  }

  function applySnapshot(data) {
    writeSnapshotToLocal(data);
    dirty = false;
    localChangeVersion++;
    window.dispatchEvent(new CustomEvent('simulador:cloud-state-applied', {
      detail: { updatedAt: lastRemoteAt }
    }));
  }

  function hasOwn(object, key) { return Object.prototype.hasOwnProperty.call(object || {}, key); }
  function sameEntry(a, aHas, b, bHas) {
    if (aHas !== bHas) return false;
    return !aHas || stable(a) === stable(b);
  }

  function mergeConfig(remote, local) {
    const result = { ...(remote || {}), ...(local || {}) };
    result.perfiles = { ...((remote || {}).perfiles || {}), ...((local || {}).perfiles || {}) };
    return result;
  }

  function mergeFailures(remote, local) {
    const result = new Map();
    [...(remote || []), ...(local || [])].forEach(item => {
      if (!item || !item.cuestion) return;
      const previous = result.get(item.cuestion);
      const previousDate = Date.parse(previous?.fecha || '') || 0;
      const currentDate = Date.parse(item.fecha || '') || 0;
      if (!previous || currentDate >= previousDate) result.set(item.cuestion, item);
    });
    return [...result.values()];
  }

  function mergeHistory(remote, local) {
    const result = [];
    const seen = new Set();
    [...(remote || []), ...(local || [])].forEach(item => {
      const key = typeof item === 'string' ? item : stable(item);
      if (seen.has(key)) return;
      seen.add(key);
      result.push(item);
    });
    return result.slice(-150);
  }

  function newerSession(remote, local) {
    if (!remote) return local;
    if (!local) return remote;
    const remoteTime = Date.parse(remote.updatedAt || '') || 0;
    const localTime = Date.parse(local.updatedAt || '') || 0;
    return localTime >= remoteTime ? local : remote;
  }

  // Fusión de tres vías: conserva cambios hechos en cualquiera de los dispositivos
  // desde la última versión conocida y combina los datos que admiten unión.
  function mergeSnapshots(base, local, remote) {
    const result = {};
    const keys = new Set([...Object.keys(base || {}), ...Object.keys(local || {}), ...Object.keys(remote || {})]);

    for (const key of keys) {
      const bHas = hasOwn(base, key), lHas = hasOwn(local, key), rHas = hasOwn(remote, key);
      const localChanged = !sameEntry(local[key], lHas, base[key], bHas);
      const remoteChanged = !sameEntry(remote[key], rHas, base[key], bHas);
      let chosen;
      let include = true;

      if (localChanged && !remoteChanged) {
        chosen = local[key]; include = lHas;
      } else if (!localChanged && remoteChanged) {
        chosen = remote[key]; include = rHas;
      } else if (localChanged && remoteChanged) {
        if (key === 'configApp') chosen = mergeConfig(remote[key], local[key]);
        else if (key.startsWith('preguntasFalladas:')) chosen = mergeFailures(remote[key], local[key]);
        else if (key.startsWith('historialPreguntas:')) chosen = mergeHistory(remote[key], local[key]);
        else if (key.startsWith('simuladorSesion:')) {
          // Una ausencia local puede representar que el usuario ya terminó la sesión.
          chosen = !lHas ? undefined : !rHas ? local[key] : newerSession(remote[key], local[key]);
          include = lHas;
        } else {
          chosen = local[key]; include = lHas;
        }
      } else {
        chosen = lHas ? local[key] : remote[key];
        include = lHas || rHas;
      }

      if (include) result[key] = chosen;
    }
    return result;
  }

  async function fetchRemote() {
    const { data, error } = await getClient().from('study_sync')
      .select('payload, revision, updated_at').eq('user_id', user.id).maybeSingle();
    if (error) throw error;
    return data;
  }

  function clearSyncTimers() {
    if (syncTimer) clearTimeout(syncTimer);
    if (retryTimer) clearTimeout(retryTimer);
    syncTimer = null;
    retryTimer = null;
  }

  function schedulePush(delay = 900) {
    if (!user || applying) return;
    dirty = true;
    localChangeVersion++;
    status(navigator.onLine ? 'Cambios guardados localmente. Sincronizando…' : 'Sin conexión. El progreso permanece guardado en este dispositivo.');
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      syncTimer = null;
      pushSnapshot();
    }, delay);
  }

  function scheduleRetry() {
    if (retryTimer || !user || !dirty || !navigator.onLine) return;
    retryAttempt = Math.min(retryAttempt + 1, 6);
    const delay = Math.min(30000, 1500 * (2 ** (retryAttempt - 1)));
    retryTimer = setTimeout(() => {
      retryTimer = null;
      pushSnapshot();
    }, delay);
  }

  async function resolveRemoteConflict() {
    const remote = await fetchRemote();
    if (!remote) {
      revision = 0;
      lastSyncedSnapshot = {};
      dirty = true;
      return;
    }
    const local = snapshot();
    const merged = mergeSnapshots(lastSyncedSnapshot || {}, local, remote.payload || {});
    revision = Number(remote.revision) || 0;
    lastRemoteAt = remote.updated_at || null;
    lastSyncedSnapshot = clone(remote.payload || {});

    if (!snapshotsEqual(local, merged)) applySnapshot(merged);
    dirty = !snapshotsEqual(merged, remote.payload || {});
    status(dirty ? 'Se han combinado cambios de ambos dispositivos. Guardando…' : 'Sincronización reconciliada.', 'ok');
  }

  async function pushSnapshot() {
    if (!user || syncing || !dirty || !navigator.onLine) return;
    syncing = true;
    const versionAtStart = localChangeVersion;
    const payload = snapshot();
    let writeCommitted = false;
    let conflictResolved = false;

    try {
      if (revision === 0) {
        const { data, error } = await getClient().from('study_sync')
          .insert({ user_id: user.id, payload, revision: 1 })
          .select('revision, updated_at').single();
        if (error) {
          if (error.code === '23505') {
            await resolveRemoteConflict();
            conflictResolved = true;
          } else throw error;
        } else {
          revision = Number(data.revision) || 1;
          lastRemoteAt = data.updated_at || null;
          lastSyncedSnapshot = clone(payload);
          writeCommitted = true;
        }
      } else {
        const { data, error } = await getClient().from('study_sync')
          .update({ payload, revision: revision + 1, updated_at: new Date().toISOString() })
          .eq('user_id', user.id).eq('revision', revision)
          .select('revision, updated_at').maybeSingle();
        if (error) throw error;
        if (!data) {
          await resolveRemoteConflict();
          conflictResolved = true;
        } else {
          revision = Number(data.revision) || revision + 1;
          lastRemoteAt = data.updated_at || null;
          lastSyncedSnapshot = clone(payload);
          writeCommitted = true;
        }
      }

      if (writeCommitted) {
        dirty = versionAtStart !== localChangeVersion || !snapshotsEqual(snapshot(), payload);
      } else if (!conflictResolved) {
        dirty = true;
      }
      if (!dirty) {
        retryAttempt = 0;
        status(`Progreso sincronizado · ${lastRemoteAt ? new Date(lastRemoteAt).toLocaleTimeString() : 'ahora'}`, 'ok');
      }
    } catch (error) {
      console.error('Cloud sync:', error);
      dirty = true;
      status(`No se pudo sincronizar: ${error.message || 'error de conexión'}. Los datos locales se conservan.`, 'error');
      scheduleRetry();
    } finally {
      syncing = false;
      if (dirty && user && navigator.onLine && !retryTimer && !syncTimer) {
        syncTimer = setTimeout(() => { syncTimer = null; pushSnapshot(); }, 700);
      }
    }
  }

  function applyRemoteRow(row) {
    if (!row || Number(row.revision) <= revision || dirty) return;
    const remotePayload = row.payload || {};
    const localPayload = snapshot();
    revision = Number(row.revision) || revision;
    lastRemoteAt = row.updated_at || null;
    lastSyncedSnapshot = clone(remotePayload);
    if (!snapshotsEqual(localPayload, remotePayload)) {
      applySnapshot(remotePayload);
      status('Cambios recibidos del otro dispositivo. Aplicados sin recargar la página.', 'ok');
    } else {
      status('Este dispositivo ya tiene la última versión.', 'ok');
    }
  }

  function subscribe() {
    if (channel) getClient().removeChannel(channel);
    channel = getClient().channel(`study-sync-${user.id}`).on('postgres_changes', {
      event: '*', schema: 'public', table: 'study_sync', filter: `user_id=eq.${user.id}`
    }, payload => {
      const row = payload.new;
      if (!row || Number(row.revision) <= revision) return;
      if (dirty || syncing) {
        // No se descarta el cambio remoto. La actualización condicional posterior
        // detectará el conflicto y combinará ambos snapshots.
        if (syncTimer) clearTimeout(syncTimer);
        syncTimer = setTimeout(() => { syncTimer = null; pushSnapshot(); }, 250);
        return;
      }
      applyRemoteRow(row);
    }).subscribe((state) => {
      if (state === 'SUBSCRIBED' && user) status('Conectado. Sincronización automática activa.', 'ok');
    });
  }

  async function loadCloudState() {
    const remote = await fetchRemote();
    if (remote?.payload && Object.keys(remote.payload).length) {
      revision = Number(remote.revision) || 0;
      lastRemoteAt = remote.updated_at || null;
      lastSyncedSnapshot = clone(remote.payload);
      const local = snapshot();
      const merged = mergeSnapshots({}, local, remote.payload || {});
      dirty = false;
      if (!snapshotsEqual(local, merged)) applySnapshot(merged);
      dirty = !snapshotsEqual(merged, remote.payload || {});
      if (dirty) await pushSnapshot();
      status(`Progreso recuperado y combinado · ${new Date(remote.updated_at).toLocaleString()}`, dirty ? 'info' : 'ok');
    } else {
      revision = 0;
      lastSyncedSnapshot = {};
      dirty = true;
      localChangeVersion++;
      await pushSnapshot();
      if (!dirty) status('Cuenta conectada. Se ha subido el progreso inicial.', 'ok');
    }
  }

  async function connect(name, pin, create) {
    const normalized = normalizeName(name);
    if (normalized.length < 3) throw new Error('El nombre debe tener al menos 3 caracteres (letras, números, punto, guion o guion bajo).');
    if (String(pin || '').length < 8) throw new Error('El código personal debe tener al menos 8 caracteres.');

    const supabase = getClient();
    const email = accountEmail(normalized);
    let result;
    if (create) {
      result = await supabase.auth.signUp({
        email, password: pin,
        options: { data: { display_name: String(name).trim(), username: normalized } }
      });
      if (result.error && /already registered|already been registered|user already registered/i.test(result.error.message)) {
        throw new Error('Ese nombre ya existe. Pulsa «Entrar» para acceder a tu cuenta.');
      }
      if (result.error) throw result.error;
      if (!result.data.session) throw new Error('Supabase sigue solicitando confirmación por correo. Desactiva Email confirmations en Authentication → Providers → Email.');
    } else {
      result = await supabase.auth.signInWithPassword({ email, password: pin });
      if (result.error) throw new Error('No se ha podido iniciar sesión. Comprueba el nombre y el código personal.');
    }

    user = result.data.user;
    subscribe();
    await loadCloudState();
    $('cloudLoginPanel')?.classList.add('cloud-connected');
    $('cloudName').value = user.user_metadata?.display_name || String(name).trim();
    $('cloudPin').value = '';
    $('cloudPin').placeholder = 'Código guardado en este dispositivo';
    $('btnCloudCreate').hidden = true;
    $('btnCloudLogin').hidden = true;
    $('btnCloudLogout').hidden = false;
    if ($('btnCloudSync')) $('btnCloudSync').hidden = false;
    $('cloudIdentity').textContent = `Cuenta: ${user.user_metadata?.display_name || String(name).trim()}`;
  }

  async function logout() {
    if (dirty) await pushSnapshot();
    clearSyncTimers();
    if (channel) { await getClient().removeChannel(channel); channel = null; }
    const { error } = await getClient().auth.signOut();
    if (error) throw error;
    user = null; revision = 0; dirty = false; lastSyncedSnapshot = null;
    $('btnCloudCreate').hidden = false;
    $('btnCloudLogin').hidden = false;
    $('btnCloudLogout').hidden = true;
    if ($('btnCloudSync')) $('btnCloudSync').hidden = true;
    $('cloudIdentity').textContent = '';
    status('Sesión cerrada. El progreso permanece guardado en este dispositivo.');
  }

  async function restoreSession() {
    if (!configured()) {
      status('Supabase no está disponible. El simulador sigue guardando el progreso localmente.');
      return;
    }
    try {
      const { data, error } = await getClient().auth.getSession();
      if (error) throw error;
      if (!data.session) {
        status('Sin cuenta conectada. El progreso se guarda en este dispositivo.');
        return;
      }
      user = data.session.user;
      subscribe();
      await loadCloudState();
      $('cloudLoginPanel')?.classList.add('cloud-connected');
      $('cloudName').value = user.user_metadata?.display_name || '';
      $('cloudPin').placeholder = 'Código guardado en este dispositivo';
      $('btnCloudCreate').hidden = true;
      $('btnCloudLogin').hidden = true;
      $('btnCloudLogout').hidden = false;
      if ($('btnCloudSync')) $('btnCloudSync').hidden = false;
      $('cloudIdentity').textContent = `Cuenta: ${user.user_metadata?.display_name || 'Conectada'}`;
      if (!dirty) status('Cuenta conectada. Sincronización automática activa.', 'ok');
    } catch (error) {
      console.error('Restore cloud session:', error);
      status(`No se pudo recuperar la sesión cloud: ${error.message || 'error desconocido'}. El almacenamiento local sigue disponible.`, 'error');
    }
  }

  function installStorageHooks() {
    if (storageHooksInstalled) return;
    let localStorageRef;
    try { localStorageRef = window.localStorage; } catch (error) {
      status(`El navegador ha bloqueado el almacenamiento local: ${error.message}`, 'error');
      return;
    }

    const originalSet = Storage.prototype.setItem;
    const originalRemove = Storage.prototype.removeItem;
    const originalClear = Storage.prototype.clear;

    Storage.prototype.setItem = function (key, value) {
      const result = originalSet.call(this, key, value);
      if (this === localStorageRef && ALLOWED(String(key))) schedulePush();
      return result;
    };
    Storage.prototype.removeItem = function (key) {
      const result = originalRemove.call(this, key);
      if (this === localStorageRef && ALLOWED(String(key))) schedulePush();
      return result;
    };
    Storage.prototype.clear = function () {
      const result = originalClear.call(this);
      if (this === localStorageRef) schedulePush();
      return result;
    };
    storageHooksInstalled = true;
  }

  async function syncNow() {
    if (!user) throw new Error('Inicia sesión para sincronizar con la nube.');
    dirty = true;
    localChangeVersion++;
    clearSyncTimers();
    await pushSnapshot();
  }

  document.addEventListener('DOMContentLoaded', async () => {
    installStorageHooks();
    $('btnCloudCreate')?.addEventListener('click', async () => {
      try { status('Creando cuenta…'); await connect($('cloudName').value, $('cloudPin').value, true); }
      catch (error) { console.error(error); status(error.message || 'No se pudo crear la cuenta.', 'error'); }
    });
    $('btnCloudLogin')?.addEventListener('click', async () => {
      try { status('Iniciando sesión…'); await connect($('cloudName').value, $('cloudPin').value, false); }
      catch (error) { console.error(error); status(error.message || 'No se pudo iniciar sesión.', 'error'); }
    });
    $('btnCloudLogout')?.addEventListener('click', async () => {
      try { await logout(); } catch (error) { status(error.message || 'No se pudo cerrar sesión.', 'error'); }
    });
    $('btnCloudSync')?.addEventListener('click', async () => {
      try { status('Sincronización manual en curso…'); await syncNow(); }
      catch (error) { status(error.message || 'No se pudo sincronizar.', 'error'); }
    });
    window.addEventListener('online', () => {
      if (user && dirty) { clearSyncTimers(); pushSnapshot(); }
      else if (user) status('Conexión recuperada. Sincronización activa.', 'ok');
    });
    window.addEventListener('offline', () => status('Sin conexión. Los cambios se guardan localmente y se sincronizarán al recuperar Internet.'));
    window.addEventListener('pagehide', () => { if (user && dirty) pushSnapshot(); });
    await restoreSession();
  });

  window.SimuladorCloud = {
    syncNow,
    isConnected: () => Boolean(user),
    getRevision: () => revision
  };
})();
