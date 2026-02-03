/* ============================================
   STORAGE.JS - Gestión de localStorage
   ============================================ */

const Storage = {
    COUNTER_KEY: 'fartCounter_count',
    SOUND_ENABLED_KEY: 'fartCounter_soundEnabled',
    VOLUME_KEY: 'fartCounter_volume',
    
    /**
     * Obtiene el contador actual
     * @returns {number} Valor del contador
     */
    getCounter() {
        const saved = localStorage.getItem(this.COUNTER_KEY);
        return saved ? parseInt(saved, 10) : 0;
    },
    
    /**
     * Guarda el contador
     * @param {number} count - Valor a guardar
     */
    setCounter(count) {
        // Validar que sea un número válido (0 - 999999)
        const validCount = Math.max(0, Math.min(999999, parseInt(count, 10) || 0));
        localStorage.setItem(this.COUNTER_KEY, validCount.toString());
        return validCount;
    },
    
    /**
     * Incrementa el contador en 1
     * @returns {number} Nuevo valor
     */
    incrementCounter() {
        const current = this.getCounter();
        return this.setCounter(current + 1);
    },
    
    /**
     * Resetea el contador a 0
     * @returns {number} Siempre retorna 0
     */
    resetCounter() {
        return this.setCounter(0);
    },
    
    /**
     * Obtiene si el sonido está habilitado
     * @returns {boolean} Estado del sonido
     */
    isSoundEnabled() {
        const saved = localStorage.getItem(this.SOUND_ENABLED_KEY);
        return saved === null ? true : saved === 'true';
    },
    
    /**
     * Establece si el sonido está habilitado
     * @param {boolean} enabled - True para habilitar, false para deshabilitar
     */
    setSoundEnabled(enabled) {
        localStorage.setItem(this.SOUND_ENABLED_KEY, enabled.toString());
    },
    
    /**
     * Obtiene el volumen actual (0-100)
     * @returns {number} Volumen
     */
    getVolume() {
        const saved = localStorage.getItem(this.VOLUME_KEY);
        return saved ? parseInt(saved, 10) : 70;
    },
    
    /**
     * Establece el volumen (0-100)
     * @param {number} volume - Volumen a establecer
     */
    setVolume(volume) {
        const validVolume = Math.max(0, Math.min(100, parseInt(volume, 10) || 70));
        localStorage.setItem(this.VOLUME_KEY, validVolume.toString());
        return validVolume;
    },
    
    /**
     * Limpia todos los datos
     */
    clearAll() {
        localStorage.removeItem(this.COUNTER_KEY);
        localStorage.removeItem(this.SOUND_ENABLED_KEY);
        localStorage.removeItem(this.VOLUME_KEY);
    }
};

// Exportar para Node.js (si es necesario)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Storage;
}
