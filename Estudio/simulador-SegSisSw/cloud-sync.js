/* Sincronización cloud SegSisSw. Requiere Supabase JS v2 y cloud-config.js. */
(() => {
  'use strict';
  const ALLOWED = key => key === 'configApp' ||
    key.startsWith('preguntasFalladas:') || key.startsWith('historialPreguntas:') ||
    key.startsWith('simuladorSesion:');
  const EMAIL_DOMAIN = 'cuenta.simulador.invalid';
  let client = null, user = null, revision = 0, syncing = false, dirty = false;
  let syncTimer = null, channel = null, applying = false, lastRemoteAt = null;
  const $ = id => document.getElementById(id);

  function status(message, kind = 'info') {
    const el = $('cloudStatus');
    if (el) { el.textContent = message; el.dataset.kind = kind; }
    const badge = $('cloudBadge');
    if (badge) { badge.textContent = kind === 'ok' ? 'Sincronizado' : kind === 'error' ? 'Error de sincronización' : user ? 'Conectado' : 'Solo en este dispositivo'; }
  }
  function configured() {
    const c = window.SIMULADOR_CLOUD_CONFIG || {};
    return Boolean(c.supabaseUrl && c.supabaseAnonKey && window.supabase?.createClient);
  }
  function getClient() {
    if (!configured()) throw new Error('Falta configurar Supabase en cloud-config.js. Consulta CONFIGURACION-NUBE.md.');
    if (!client) {
      const c = window.SIMULADOR_CLOUD_CONFIG;
      client = window.supabase.createClient(c.supabaseUrl, c.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
      });
    }
    return client;
  }
  function normalizeName(value) {
    return value.trim().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[^a-z0-9._-]/g, '').replace(/^[-._]+|[-._]+$/g, '').slice(0, 24);
  }
  function accountEmail(name) { return `${name}@${EMAIL_DOMAIN}`; }
  function snapshot() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && ALLOWED(key)) {
        try { data[key] = JSON.parse(localStorage.getItem(key)); }
        catch { data[key] = localStorage.getItem(key); }
      }
    }
    return data;
  }
  function applySnapshot(data) {
    applying = true;
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && ALLOWED(key)) keys.push(key);
      }
      keys.forEach(key => localStorage.removeItem(key));
      Object.entries(data || {}).forEach(([key, value]) => {
        if (ALLOWED(key)) localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
      });
    } finally { applying = false; dirty = false; }
  }
  async function fetchRemote() {
    const { data, error } = await getClient().from('study_sync').select('payload, revision, updated_at').eq('user_id', user.id).maybeSingle();
    if (error) throw error;
    return data;
  }
  async function pushSnapshot() {
    if (!user || syncing || !dirty || !navigator.onLine) return;
    syncing = true;
    const payload = snapshot();
    try {
      if (revision === 0) {
        const { data, error } = await getClient().from('study_sync')
          .insert({ user_id: user.id, payload, revision: 1 }).select('revision, updated_at').single();
        if (error) {
          if (error.code === '23505') { await resolveRemoteConflict(); return; }
          throw error;
        }
        revision = data.revision; lastRemoteAt = data.updated_at;
      } else {
        const { data, error } = await getClient().from('study_sync')
          .update({ payload, revision: revision + 1, updated_at: new Date().toISOString() })
          .eq('user_id', user.id).eq('revision', revision).select('revision, updated_at').maybeSingle();
        if (error) throw error;
        if (!data) { await resolveRemoteConflict(); return; }
        revision = data.revision; lastRemoteAt = data.updated_at;
      }
      dirty = false;
      status(`Progreso sincronizado · ${new Date(lastRemoteAt).toLocaleTimeString()}`, 'ok');
    } catch (error) {
      console.error('Cloud sync:', error);
      status(`No se pudo sincronizar: ${error.message || 'error de conexión'}. Tus datos siguen guardados en este navegador.`, 'error');
    } finally { syncing = false; }
  }
  async function resolveRemoteConflict() {
    const remote = await fetchRemote();
    if (remote) {
      applySnapshot(remote.payload);
      revision = remote.revision;
      lastRemoteAt = remote.updated_at;
      status('Otro dispositivo había guardado cambios. Se ha cargado la versión más reciente de la nube. Si tenías cambios sin sincronizar, revisa el progreso.', 'error');
      window.setTimeout(() => location.reload(), 900);
    }
  }
  function schedulePush() {
    if (!user || applying) return;
    dirty = true;
    status(navigator.onLine ? 'Cambios pendientes de sincronizar…' : 'Sin conexión. Se sincronizará al recuperar Internet.');
    clearTimeout(syncTimer);
    syncTimer = setTimeout(pushSnapshot, 1100);
  }
  function subscribe() {
    if (channel) getClient().removeChannel(channel);
    channel = getClient().channel(`study-sync-${user.id}`).on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'study_sync', filter: `user_id=eq.${user.id}`
    }, payload => {
      const row = payload.new;
      if (!row || row.revision <= revision || dirty) return;
      applySnapshot(row.payload);
      revision = row.revision; lastRemoteAt = row.updated_at;
      status('Progreso actualizado desde el otro dispositivo. Recargando…', 'ok');
      setTimeout(() => location.reload(), 700);
    }).subscribe();
  }
  async function connect(name, pin, create) {
    const normalized = normalizeName(name);
    if (normalized.length < 3) throw new Error('El nombre debe tener al menos 3 caracteres (letras, números, punto, guion o guion bajo).');
    if (pin.length < 8) throw new Error('El código personal debe tener al menos 8 caracteres.');
    const supabase = getClient();
    const email = accountEmail(normalized);
    let result;
    if (create) {
      result = await supabase.auth.signUp({ email, password: pin, options: { data: { display_name: name.trim(), username: normalized } } });
      if (result.error && /already registered|already been registered|user already registered/i.test(result.error.message)) {
        throw new Error('Ese nombre ya existe. Pulsa «Entrar» para acceder a tu cuenta.');
      }
      if (result.error) throw result.error;
      if (!result.data.session) throw new Error('La cuenta se ha creado, pero Supabase está solicitando confirmación por correo. Desactiva Email confirmations en Supabase (Authentication → Providers → Email) y vuelve a intentarlo.');
    } else {
      result = await supabase.auth.signInWithPassword({ email, password: pin });
      if (result.error) throw new Error('No se ha podido iniciar sesión. Comprueba el nombre y el código personal.');
    }
    user = result.data.user;
    await loadCloudState();
    subscribe();
    $('cloudLoginPanel')?.classList.add('cloud-connected');
    $('cloudName').value = result.data.user.user_metadata?.display_name || name.trim();
    $('cloudPin').value = '';
    $('cloudPin').placeholder = 'Código guardado en este dispositivo';
    $('btnCloudCreate').hidden = true;
    $('btnCloudLogin').hidden = true;
    $('btnCloudLogout').hidden = false;
    $('cloudIdentity').textContent = `Cuenta: ${result.data.user.user_metadata?.display_name || name.trim()}`;
  }
  async function loadCloudState() {
    const remote = await fetchRemote();
    if (remote?.payload && Object.keys(remote.payload).length) {
      applySnapshot(remote.payload);
      revision = remote.revision || 0;
      lastRemoteAt = remote.updated_at;
      status(`Progreso recuperado de la nube · ${new Date(remote.updated_at).toLocaleString()}`, 'ok');
      setTimeout(() => location.reload(), 600);
    } else {
      revision = 0;
      dirty = true;
      await pushSnapshot();
      status('Cuenta conectada. Este dispositivo ha subido su progreso inicial.', 'ok');
    }
  }
  async function logout() {
    if (dirty) await pushSnapshot();
    if (channel) { await getClient().removeChannel(channel); channel = null; }
    const { error } = await getClient().auth.signOut();
    if (error) throw error;
    user = null; revision = 0; dirty = false;
    $('btnCloudCreate').hidden = false; $('btnCloudLogin').hidden = false; $('btnCloudLogout').hidden = true;
    $('cloudIdentity').textContent = '';
    status('Sesión cerrada. El progreso permanece en este dispositivo.');
  }
  async function restoreSession() {
    if (!configured()) { status('Sincronización pendiente de configurar. El simulador sigue funcionando en local.'); return; }
    try {
      const { data } = await getClient().auth.getSession();
      if (!data.session) { status('No has conectado una cuenta. El progreso se guarda en este dispositivo.'); return; }
      user = data.session.user;
      const remote = await fetchRemote();
      if (remote) { revision = remote.revision; lastRemoteAt = remote.updated_at; }
      subscribe();
      $('cloudLoginPanel')?.classList.add('cloud-connected');
      $('cloudName').value = user.user_metadata?.display_name || '';
      $('cloudPin').placeholder = 'Código guardado en este dispositivo';
      $('btnCloudCreate').hidden = true; $('btnCloudLogin').hidden = true; $('btnCloudLogout').hidden = false;
      $('cloudIdentity').textContent = `Cuenta: ${user.user_metadata?.display_name || 'Conectada'}`;
      status('Cuenta conectada. Sincronización automática activa.', 'ok');
    } catch (error) { status(`No se pudo recuperar la sesión cloud: ${error.message}`, 'error'); }
  }
  function installStorageHooks() {
    const originalSet = Storage.prototype.setItem;
    const originalRemove = Storage.prototype.removeItem;
    Storage.prototype.setItem = function (key, value) {
      originalSet.call(this, key, value);
      if (this === localStorage && ALLOWED(String(key))) schedulePush();
    };
    Storage.prototype.removeItem = function (key) {
      originalRemove.call(this, key);
      if (this === localStorage && ALLOWED(String(key))) schedulePush();
    };
  }
  document.addEventListener('DOMContentLoaded', async () => {
    installStorageHooks();
    $('btnCloudCreate')?.addEventListener('click', async () => {
      try { status('Creando cuenta…'); await connect($('cloudName').value, $('cloudPin').value, true); }
      catch (error) { status(error.message || 'No se pudo crear la cuenta.', 'error'); }
    });
    $('btnCloudLogin')?.addEventListener('click', async () => {
      try { status('Iniciando sesión…'); await connect($('cloudName').value, $('cloudPin').value, false); }
      catch (error) { status(error.message || 'No se pudo iniciar sesión.', 'error'); }
    });
    $('btnCloudLogout')?.addEventListener('click', async () => {
      try { await logout(); } catch (error) { status(error.message, 'error'); }
    });
    window.addEventListener('online', () => { if (user && dirty) pushSnapshot(); else if (user) status('Conexión recuperada. Sincronización activa.', 'ok'); });
    window.addEventListener('offline', () => status('Sin conexión. El progreso se guarda localmente y se sincronizará después.'));
    window.addEventListener('pagehide', () => { if (user && dirty) pushSnapshot(); });
    await restoreSession();
  });
  window.SimuladorCloud = { syncNow: pushSnapshot, isConnected: () => Boolean(user) };
})();
