class RainSound {
    constructor() {
        this.audio = null;
        this.initialized = false;
        this.audioPath = './audio/rain.mp3';
        this.initAudio();
    }

    initAudio() {
        try {
            console.log('Initializing audio with path:', this.audioPath);
            
            // Test if file exists first
            fetch(this.audioPath)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Audio file not found: ${this.audioPath}`);
                    }
                    console.log('Audio file found successfully');
                })
                .catch(error => {
                    console.error('Failed to load audio file:', error);
                });

            this.audio = new Audio(this.audioPath);
            this.audio.loop = true;
            this.volume = localStorage.getItem('rain-volume') || 0.5;
            this.audio.volume = this.volume;

            this.audio.addEventListener('loadeddata', () => {
                console.log('Audio file loaded successfully');
                this.initialized = true;
            });

            this.audio.addEventListener('error', (e) => {
                console.error('Audio loading error:', {
                    error: this.audio.error,
                    src: this.audio.src,
                    readyState: this.audio.readyState
                });
            });

        } catch (error) {
            console.error('Audio initialization failed:', error);
        }
    }

    play() {
        this.audio.play().catch(error => {
            console.warn('Audio playback failed:', error);
        });
    }

    stop() {
        this.audio.pause();
        this.audio.currentTime = 0;
    }

    setVolume(value) {
        this.volume = value / 100;
        this.audio.volume = this.volume;
        localStorage.setItem('rain-volume', this.volume);
    }
}