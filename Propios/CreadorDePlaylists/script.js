// --- ESTADO GLOBAL ---
const appState = {
    canciones: [],
    playlists: ['Sin Asignar'],
    filtroPlaylist: 'TODAS',
    filtroTexto: '',
    cabecerasOriginales: []
};

// --- ELEMENTOS DEL DOM ---
const csvFileInput = document.getElementById('csvFileInput');
const dropZone = document.getElementById('dropZone');
const uploadLabel = document.getElementById('uploadLabel');
const playlistNameInput = document.getElementById('playlistNameInput');
const btnCrearPlaylist = document.getElementById('btnCrearPlaylist');
const playlistList = document.getElementById('playlistList');
const assignPlaylistSelect = document.getElementById('assignPlaylistSelect');
const btnAsignar = document.getElementById('btnAsignar');
const btnExportarTodo = document.getElementById('btnExportarTodo');
const searchInput = document.getElementById('searchInput');
const selectAll = document.getElementById('selectAll');
const tracksTableBody = document.getElementById('tracksTableBody');

// --- 1. LECTURA Y DRAG & DROP DE CSV ---
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(e => dropZone.addEventListener(e, p => { p.preventDefault(); p.stopPropagation(); }));

dropZone.addEventListener('drop', (e) => {
    if (e.dataTransfer.files.length > 0) procesarCSV(e.dataTransfer.files[0]);
});

csvFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) procesarCSV(e.target.files[0]);
});

function procesarCSV(file) {
    uploadLabel.textContent = `📄 ${file.name}`;
    const reader = new FileReader();

    reader.onload = (event) => {
        const lineas = event.target.result.split(/\r\n|\n/);
        if (lineas.length < 2) return;

        appState.cabecerasOriginales = lineas[1].split(';').map(h => h.trim());
        const idxTrack = appState.cabecerasOriginales.findIndex(h => h.toLowerCase().includes('track') || h.toLowerCase().includes('title'));
        const idxPlaylist = appState.cabecerasOriginales.findIndex(h => h.toLowerCase().includes('playlist'));

        appState.canciones = [];
        appState.playlists = ['Sin Asignar'];

        for (let i = 2; i < lineas.length; i++) {
            const linea = lineas[i].trim();
            if (!linea) continue;

            const columnas = linea.split(';');
            const datosFila = {};

            appState.cabecerasOriginales.forEach((cabecera, idx) => {
                datosFila[cabecera] = columnas[idx] ? columnas[idx].trim() : '';
            });

            const titulo = (idxTrack !== -1 && columnas[idxTrack]) ? columnas[idxTrack].trim() : (columnas[0] || 'Sin título');
            const playlist = (idxPlaylist !== -1 && columnas[idxPlaylist]) ? columnas[idxPlaylist].trim() : 'Sin Asignar';

            appState.canciones.push({
                id: i - 2,
                titulo: titulo,
                playlist: playlist || 'Sin Asignar',
                datosCompletos: datosFila
            });

            if (playlist && !appState.playlists.includes(playlist)) {
                appState.playlists.push(playlist);
            }
        }

        render();
    };

    reader.readAsText(file, 'UTF-8');
}

// --- 2. CREACIÓN INSTANTÁNEA DE PLAYLIST ---
btnCrearPlaylist.addEventListener('click', () => {
    const nombre = playlistNameInput.value.trim();
    if (!nombre) return;

    if (appState.playlists.includes(nombre)) {
        alert('Esa playlist ya existe.');
        return;
    }

    appState.playlists.push(nombre);
    playlistNameInput.value = '';

    // Auto-seleccionar la playlist recién creada para verla al instante
    appState.filtroPlaylist = nombre;
    render();
});

playlistNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') btnCrearPlaylist.click();
});

// --- 3. ASIGNACIÓN MASIVA E INDIVIDUAL ---
btnAsignar.addEventListener('click', () => {
    const destino = assignPlaylistSelect.value;
    if (!destino) {
        alert('Selecciona una playlist de destino.');
        return;
    }

    const seleccionados = Array.from(document.querySelectorAll('.track-cb:checked'))
        .map(cb => parseInt(cb.value));

    if (seleccionados.length === 0) {
        alert('Marca al menos una canción.');
        return;
    }

    appState.canciones.forEach(track => {
        if (seleccionados.includes(track.id)) track.playlist = destino;
    });

    selectAll.checked = false;
    render();
});

selectAll.addEventListener('change', () => {
    const checkboxes = document.querySelectorAll('.track-cb');
    checkboxes.forEach(cb => cb.checked = selectAll.checked);
});

searchInput.addEventListener('input', (e) => {
    appState.filtroTexto = e.target.value.toLowerCase();
    renderTabla();
});

// --- 4. EXPORTACIÓN INDIVIDUAL Y COMPLETA ---
btnExportarTodo.addEventListener('click', () => exportarCSV(appState.canciones, 'biblioteca_completa.csv'));

function exportarPlaylistEspecifica(nombrePlaylist, event) {
    event.stopPropagation();
    const cancionesFiltradas = appState.canciones.filter(c => c.playlist === nombrePlaylist);

    if (cancionesFiltradas.length === 0) {
        alert(`La playlist "${nombrePlaylist}" no tiene canciones para exportar.`);
        return;
    }

    const nombreArchivo = `${nombrePlaylist.toLowerCase().replace(/\s+/g, '_')}.csv`;
    exportarCSV(cancionesFiltradas, nombreArchivo);
}

function exportarCSV(listaCanciones, nombreArchivo) {
    if (listaCanciones.length === 0) {
        alert('No hay canciones para exportar.');
        return;
    }

    let csvContent = '\n';
    const cabeceras = appState.cabecerasOriginales.length > 0
        ? [...appState.cabecerasOriginales]
        : ['Track name', 'Playlist name'];

    if (!cabeceras.some(h => h.toLowerCase().includes('playlist'))) {
        cabeceras.push('Playlist name');
    }

    csvContent += cabeceras.join(';') + '\n';

    listaCanciones.forEach(track => {
        const fila = [];
        cabeceras.forEach((cabecera) => {
            if (cabecera.toLowerCase().includes('playlist')) {
                fila.push(track.playlist);
            } else {
                fila.push(track.datosCompletos[cabecera] || '');
            }
        });
        csvContent += fila.join(';') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', nombreArchivo);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- 5. RENDERIZADO REACTIVO Y ACCESIBLE ---
function render() {
    // Sidebar con botones de exportación individuales
    playlistList.innerHTML = `
        <li class="playlist-item ${appState.filtroPlaylist === 'TODAS' ? 'active' : ''}" onclick="setFiltroPlaylist('TODAS')">
            <div>
                <strong>Todas las Canciones</strong>
                <div style="font-size: 0.75rem; color: var(--text-secondary);">${appState.canciones.length} pistas</div>
            </div>
        </li>
    `;

    appState.playlists.forEach(nombre => {
        const count = appState.canciones.filter(c => c.playlist === nombre).length;
        const li = document.createElement('li');
        li.className = `playlist-item ${appState.filtroPlaylist === nombre ? 'active' : ''}`;
        li.onclick = () => setFiltroPlaylist(nombre);

        // Zona Drop para Drag and Drop de Canciones
        li.ondragover = (e) => e.preventDefault();
        li.ondrop = (e) => {
            e.preventDefault();
            const trackId = parseInt(e.dataTransfer.getData('text/plain'));
            const track = appState.canciones.find(c => c.id === trackId);
            if (track) {
                track.playlist = nombre;
                render();
            }
        };

        li.innerHTML = `
            <div>
                <strong>${nombre}</strong>
                <div style="font-size: 0.75rem; color: var(--text-secondary);">${count} pistas</div>
            </div>
            <div class="playlist-actions">
                <button class="btn btn-export" title="Exportar esta playlist" onclick="exportarPlaylistEspecifica('${nombre}', event)">⬇ CSV</button>
                ${nombre !== 'Sin Asignar' ? `<button class="btn-danger" title="Eliminar playlist" onclick="eliminarPlaylist('${nombre}', event)">✕</button>` : ''}
            </div>
        `;
        playlistList.appendChild(li);
    });

    // Desplegable de asignación
    const valPrevio = assignPlaylistSelect.value;
    assignPlaylistSelect.innerHTML = '<option value="">-- Mover seleccionadas a... --</option>';
    appState.playlists.forEach(nombre => {
        const opt = document.createElement('option');
        opt.value = nombre;
        opt.textContent = nombre;
        assignPlaylistSelect.appendChild(opt);
    });
    if (appState.playlists.includes(valPrevio)) assignPlaylistSelect.value = valPrevio;

    renderTabla();
}

function renderTabla() {
    tracksTableBody.innerHTML = '';

    const filtradas = appState.canciones.filter(track => {
        const pasaLista = (appState.filtroPlaylist === 'TODAS') || (track.playlist === appState.filtroPlaylist);
        const pasaTexto = track.titulo.toLowerCase().includes(appState.filtroTexto);
        return pasaLista && pasaTexto;
    });

    if (filtradas.length === 0) {
        tracksTableBody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-msg">No hay pistas en esta lista. Arrastra canciones aquí o asignalas desde el desplegable.</td>
            </tr>`;
        return;
    }

    filtradas.forEach((track, index) => {
        const tr = document.createElement('tr');
        tr.setAttribute('draggable', 'true');
        tr.ondragstart = (e) => e.dataTransfer.setData('text/plain', track.id);

        tr.innerHTML = `
            <td class="checkbox-col">
                <input type="checkbox" class="track-cb" value="${track.id}">
            </td>
            <td>${index + 1}</td>
            <td><strong>🖐 ${track.titulo}</strong></td>
            <td><span class="badge">${track.playlist}</span></td>
            <td>
                ${track.playlist !== 'Sin Asignar' ?
                `<button class="btn btn-secondary" onclick="desasignarPista(${track.id})">Desasignar</button>` : ''}
            </td>
        `;
        tracksTableBody.appendChild(tr);
    });
}

// --- ACCIONES AUXILIARES ---
window.setFiltroPlaylist = function (nombre) {
    appState.filtroPlaylist = nombre;
    render();
};

window.eliminarPlaylist = function (nombre, event) {
    event.stopPropagation();
    if (confirm(`¿Eliminar la playlist "${nombre}"? Las canciones volverán a 'Sin Asignar'.`)) {
        appState.canciones.forEach(c => {
            if (c.playlist === nombre) c.playlist = 'Sin Asignar';
        });
        appState.playlists = appState.playlists.filter(p => p !== nombre);
        if (appState.filtroPlaylist === nombre) appState.filtroPlaylist = 'TODAS';
        render();
    }
};

window.desasignarPista = function (id) {
    const track = appState.canciones.find(c => c.id === id);
    if (track) {
        track.playlist = 'Sin Asignar';
        render();
    }
};