/* ============================================
   AUDIO.JS - Gestión de sonidos v2.0
   ============================================ */

const AudioManager = {
    sounds: [],
    isInitialized: false,
    currentVolume: 70,
    audioContext: null,
    
    /**
     * Inicializa los sonidos
     */
    init() {
        if (this.isInitialized) return;
        
        console.log('🔊 Inicializando AudioManager...');
        
        // Crear arrays con los sonidos
        this.sounds = [];
        
        const soundFiles = [
            'assets/sounds/pedo1.mp3',
            'assets/sounds/pedo2.mp3',
            'assets/sounds/pedo3.mp3'
        ];
        
        soundFiles.forEach((file, index) => {
            const audio = new Audio();
            audio.src = file;
            audio.preload = 'auto';
            audio.crossOrigin = 'anonymous';
            audio.volume = this.currentVolume / 100;
            
            // Evento para debugging
            audio.addEventListener('canplay', () => {
                console.log(`✅ Audio ${index + 1} cargado: ${file}`);
            });
            
            audio.addEventListener('error', (e) => {
                console.error(`❌ Error cargando ${file}:`, e);
            });
            
            this.sounds.push(audio);
        });
        
        // Cargar volumen desde storage
        this.currentVolume = Storage.getVolume();
        this.setVolume(this.currentVolume);
        
        this.isInitialized = true;
        console.log('✅ AudioManager inicializado con', this.sounds.length, 'sonidos');
    },
    
    /**
     * Reproduce un sonido aleatorio
     */
    playRandomFart() {
        // Verificar si el sonido está habilitado
        if (!Storage.isSoundEnabled()) {
            console.log('🔇 Sonido deshabilitado');
            return;
        }
        
        // Si no hay sonidos, intentar inicializar
        if (this.sounds.length === 0) {
            this.init();
            if (this.sounds.length === 0) {
                console.log('⚠️ No hay sonidos disponibles');
                return;
            }
        }
        
        try {
            // Seleccionar un sonido aleatorio
            const randomIndex = Math.floor(Math.random() * this.sounds.length);
            const sound = this.sounds[randomIndex];
            
            console.log(`🎵 Reproduciendo sonido ${randomIndex + 1}...`);
            
            // Reset tiempo
            sound.currentTime = 0;
            
            // Intentar reproducir
            const playPromise = sound.play();
            
            if (playPromise !== undefined) {
                playPromise
                    .then(() => {
                        console.log('✅ Sonido reproducido correctamente');
                    })
                    .catch(error => {
                        console.warn('⚠️ Error reproduciendo:', error.name, error.message);
                    });
            }
        } catch (error) {
            console.error('❌ Error fatal:', error);
        }
    },
    
    /**
     * Detiene todos los sonidos
     */
    stopAll() {
        this.sounds.forEach(sound => {
            sound.pause();
            sound.currentTime = 0;
        });
    },
    
    /**
     * Establece el volumen para todos los sonidos (0-100)
     */
    setVolume(volume) {
        this.currentVolume = Math.max(0, Math.min(100, volume));
        const normalizedVolume = this.currentVolume / 100;
        
        this.sounds.forEach(sound => {
            sound.volume = normalizedVolume;
        });
        
        // Guardar en storage
        Storage.setVolume(this.currentVolume);
        
        console.log(`🔊 Volumen: ${this.currentVolume}%`);
    },
    
    /**
     * Obtiene el volumen actual
     */
    getVolume() {
        return this.currentVolume;
    },
    
    /**
     * Habilita o deshabilita el sonido
     */
    setSoundEnabled(enabled) {
        Storage.setSoundEnabled(enabled);
        
        if (!enabled) {
            this.stopAll();
            console.log('🔇 Sonido deshabilitado');
        } else {
            console.log('🔊 Sonido habilitado');
        }
    },
    
    /**
     * Obtiene si el sonido está habilitado
     */
    isSoundEnabled() {
        return Storage.isSoundEnabled();
    }
};

// Exportar para Node.js (si es necesario)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioManager;
}
