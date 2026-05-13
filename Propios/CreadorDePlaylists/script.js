let allTracks = [], currentIndex = 0, dayPlaylist = [], nightPlaylist = [], headers = [];
let currentSelection = { day: false, night: false };

const fileInput = document.getElementById('file-input');
const dropZone = document.getElementById('drop-zone');

dropZone.onclick = () => fileInput.click();

fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];

        // Obtenemos la matriz completa de datos
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        headers = rows[0]; // Guardamos la cabecera exacta (Track name, Artist name, etc.)
        allTracks = rows.slice(1);

        document.getElementById('upload-screen').style.display = 'none';
        document.getElementById('sorter-screen').style.display = 'block';
        updateUI();
    };
    reader.readAsArrayBuffer(file);
};

function toggle(choice) {
    currentSelection[choice] = !currentSelection[choice];
    document.getElementById(`btn-${choice}`).classList.toggle('active', currentSelection[choice]);
}

function confirmNext() {
    if (currentSelection.day) dayPlaylist.push(allTracks[currentIndex]);
    if (currentSelection.night) nightPlaylist.push(allTracks[currentIndex]);

    currentIndex++;
    updateUI();
}

function updateUI() {
    if (currentIndex < allTracks.length) {
        // Reset botones
        currentSelection = { day: false, night: false };
        document.getElementById('btn-day').classList.remove('active');
        document.getElementById('btn-night').classList.remove('active');

        // Textos
        const currentTrack = allTracks[currentIndex];
        document.getElementById('track-title').innerText = currentTrack[0] || "---";
        document.getElementById('track-artist').innerText = currentTrack[1] || "Artista no especificado";

        // Progreso y contadores
        const progress = (currentIndex / allTracks.length) * 100;
        document.getElementById('bar').style.width = `${progress}%`;
        document.getElementById('progress-text').innerText = `${currentIndex + 1} de ${allTracks.length}`;
        document.getElementById('count-day').innerText = dayPlaylist.length;
        document.getElementById('count-night').innerText = nightPlaylist.length;
    } else {
        document.getElementById('track-title').innerText = "¡Todo listo!";
        document.getElementById('track-artist').innerText = "Ya puedes descargar tus archivos.";
    }
}

function download(type) {
    const data = type === 'dia' ? dayPlaylist : nightPlaylist;
    if (data.length === 0) return alert("La lista está vacía.");

    // Creamos la hoja de cálculo manteniendo los encabezados originales
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Playlist");

    // Generamos el archivo CSV (para máxima compatibilidad con el original)
    XLSX.writeFile(wb, `My_Playlist_${type.toUpperCase()}.csv`, { bookType: 'csv' });
}