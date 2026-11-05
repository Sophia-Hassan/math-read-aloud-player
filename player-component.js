import initWasm, { initMathCAT, mathmlToSpeech } from './mathcat.js';

class MathReadAloudPlayer extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.segments = [];
        this.isSpeakingMath = false;
        this.mathcatReady = false;
        this.currentSpeed = 1.0;
        this.activeId = null;
        this.isHighContrast = false;
    }

    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <style>
                /* The host element just prevents the player from hiding content */
                :host { 
                    display: block; 
                    padding-bottom: 120px; /* Space for the floating player */
                    font-family: system-ui, -apple-system, sans-serif;
                }
                
                /* FLOATING PLAYER BAR */
                .player-bar {
                    --bg-color: #1e1e1e; /* Dark modern look */
                    --text-color: #ffffff;
                    --accent-color: #4da6ff;
                    --btn-hover: #333333;
                    --track-bg: #444444;
                    --border-color: #333333;

                    position: fixed;
                    bottom: 24px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: calc(100% - 48px);
                    max-width: 800px;
                    background: var(--bg-color);
                    border: 1px solid var(--border-color);
                    border-radius: 50px; /* Pill shape */
                    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                    padding: 12px 24px;
                    display: flex;
                    gap: 16px;
                    align-items: center;
                    z-index: 9999;
                    transition: all 0.3s ease;
                }

                /* HIGH CONTRAST THEME */
                .player-bar.high-contrast {
                    --bg-color: #000000;
                    --text-color: #ffffff;
                    --accent-color: #ffff00;
                    --btn-hover: #333333;
                    --track-bg: #555555;
                    --border-color: #ffffff;
                    border: 2px solid var(--border-color);
                    box-shadow: 0 0 0 4px #000000;
                }
                
                button { 
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 40px;
                    height: 40px;
                    border: none;
                    border-radius: 50%;
                    background: transparent;
                    color: var(--text-color);
                    cursor: pointer;
                    transition: background-color 0.2s, transform 0.1s;
                }
                button:hover { background: var(--btn-hover); }
                button:active { transform: scale(0.95); }
                button:focus-visible { 
                    outline: 3px solid var(--accent-color); 
                    outline-offset: 2px; 
                }
                
                #play-btn {
                    background: var(--accent-color);
                    color: #000; /* Always black for contrast on yellow/blue */
                    width: 48px;
                    height: 48px;
                }
                #play-btn:hover { opacity: 0.9; }
                
                .progress-container {
                    display: flex; 
                    align-items: center; 
                    gap: 12px; 
                    flex-grow: 1;
                }
                
                input[type="range"] {
                    -webkit-appearance: none;
                    width: 100%;
                    background: transparent;
                    cursor: pointer;
                }
                input[type="range"]:focus { outline: none; }
                
                input[type="range"]::-webkit-slider-runnable-track {
                    width: 100%;
                    height: 6px;
                    background: var(--track-bg);
                    border-radius: 3px;
                }
                
                input[type="range"]::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    height: 16px;
                    width: 16px;
                    border-radius: 50%;
                    background: var(--accent-color);
                    margin-top: -5px;
                    border: 2px solid var(--bg-color);
                }

                #current-time, #duration {
                    font-size: 12px; 
                    color: var(--text-color);
                    font-family: monospace; 
                    white-space: nowrap;
                }
                
                #speed-btn, #contrast-btn {
                    width: auto;
                    padding: 0 12px;
                    border-radius: 16px;
                    background: var(--btn-hover);
                    font-size: 13px;
                    font-weight: 700;
                    color: var(--text-color);
                    border: 1px solid var(--border-color);
                }

                .sr-only {
                    position: absolute; width: 1px; height: 1px;
                    padding: 0; margin: -1px; overflow: hidden;
                    clip: rect(0, 0, 0, 0); border: 0;
                }

                @media (max-width: 750px) {
                    .player-bar { flex-wrap: wrap; padding: 12px; border-radius: 20px; bottom: 12px; }
                    .progress-container { order: 5; width: 100%; margin-top: 8px; }
                    #current-time, #duration { display: none; } /* Save space on mobile */
                }

                /* OS-LEVEL FORCED COLORS */
                @media (forced-colors: active) {
                    .player-bar {
                        border: 2px solid CanvasText;
                        background: Canvas;
                    }
                    button { border: 2px solid ButtonText; }
                }
            </style>

            <!-- The Floating Player -->
            <div class="player-bar" id="player-bar" role="toolbar" aria-label="Audio Player Controls">
                <button id="prev-btn" aria-label="Previous Section">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
                </button>
                <button id="play-btn" aria-label="Play">
                    <svg id="play-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                </button>
                <button id="next-btn" aria-label="Next Section">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
                </button>
                
                <div class="progress-container">
                    <span id="current-time">0:00</span>
                    <input type="range" id="progress-bar" value="0" min="0" max="100" step="0.1" aria-label="Audio Progress">
                    <span id="duration">0:00</span>
                </div>
                
                <button id="contrast-btn" aria-label="Toggle High Contrast">🌓</button>
                <button id="speed-btn" aria-label="Playback Speed: 1x">1.0x</button>
                <span id="status" class="sr-only" aria-live="polite"></span>
            </div>
            
            <!-- The Slotted Content (No wrapper!) -->
            <slot></slot>
            
            <audio id="audio-player" src="${this.getAttribute('audio-src')}"></audio>
        `;

        const lightDomStyle = document.createElement('style');
        lightDomStyle.textContent = `
            math-read-aloud-player [id] { 
                cursor: pointer; 
                /* Accounts for the floating bar at the bottom */
                scroll-margin-bottom: 120px; 
                scroll-margin-top: 20px;
                transition: all 0.3s ease;
            }
            math-read-aloud-player [id]:focus-visible {
                outline: 3px solid #005fcc;
                outline-offset: 4px;
                border-radius: 4px;
            }
            
            /* Standard Text Highlight */
            math-read-aloud-player .highlight-text { 
                background-color: #fff3cd; 
                color: #856404;
                box-decoration-break: clone;
                -webkit-box-decoration-break: clone;
                padding: 4px 2px;
                border-radius: 3px;
                box-shadow: 0 0 0 2px #fff3cd;
            }
            /* Standard Math Highlight */
            math-read-aloud-player .highlight-math { 
                background-color: #fff3cd; 
                border-left: 4px solid #ffc107;
                border-radius: 4px;
                padding: 8px;
                display: inline-block;
                box-shadow: 0 2px 8px rgba(255, 193, 7, 0.2);
            }

            /* HIGH CONTRAST OVERRIDES */
            math-read-aloud-player.high-contrast-active .highlight-text,
            math-read-aloud-player.high-contrast-active .highlight-math { 
                background-color: #ffff00 !important;
                color: #000000 !important;
                border-left-color: #ffff00 !important;
                box-shadow: none !important;
            }
            
            @media (forced-colors: active) {
                math-read-aloud-player .highlight-text,
                math-read-aloud-player .highlight-math {
                    background-color: Highlight;
                    color: HighlightText;
                }
            }
        `;
        this.appendChild(lightDomStyle);
        this.playerBar = this.shadowRoot.getElementById('player-bar');
        this.audio = this.shadowRoot.getElementById('audio-player');
        this.playBtn = this.shadowRoot.getElementById('play-btn');
        this.playIcon = this.shadowRoot.getElementById('play-icon');
        this.prevBtn = this.shadowRoot.getElementById('prev-btn');
        this.nextBtn = this.shadowRoot.getElementById('next-btn');
        this.speedBtn = this.shadowRoot.getElementById('speed-btn');
        this.contrastBtn = this.shadowRoot.getElementById('contrast-btn');
        this.status = this.shadowRoot.getElementById('status');
        this.progressBar = this.shadowRoot.getElementById('progress-bar');
        this.currentTimeDisplay = this.shadowRoot.getElementById('current-time');
        this.durationDisplay = this.shadowRoot.getElementById('duration');

        this.playBtn.addEventListener('click', () => this.togglePlay());
        this.prevBtn.addEventListener('click', () => this.skipPrevious());
        this.nextBtn.addEventListener('click', () => this.skipNext());
        this.speedBtn.addEventListener('click', () => this.cycleSpeed());
        this.contrastBtn.addEventListener('click', () => this.toggleContrast());
        
        this.audio.addEventListener('timeupdate', () => this.onTimeUpdate());
        this.audio.addEventListener('loadedmetadata', () => this.onMetadataLoaded());
        this.audio.addEventListener('ended', () => this.resetPlayer());
        
        this.progressBar.addEventListener('input', () => {
            this.audio.currentTime = this.progressBar.value;
        });

        this.init();
    }

    async init() {
        await this.loadStream();
        await this.setupMathCAT();
        this.setupInteractions();
    }

    async loadStream() {
        try {
            const url = this.getAttribute('marked-stream-src');
            const response = await fetch(url);
            const data = await response.json();
            this.segments = data.segments;
        } catch (error) {
            console.error("Failed to load JSON:", error);
        }
    }

    async setupMathCAT() {
        try {
            await initWasm({ module_or_path: './mathcat_bg.wasm' });
            initMathCAT("en"); 
            this.mathcatReady = true;
            console.log(" MathCAT WASM initialized locally with rules!");
        } catch (error) {
            console.error("MathCAT failed:", error);
        }
    }

    logEvent(action, data = {}) {
        console.log(`[ANALYTICS] ${action}`, data);
    }

    toggleContrast() {
        this.isHighContrast = !this.isHighContrast;
        if (this.isHighContrast) {
            this.playerBar.classList.add('high-contrast');
            this.classList.add('high-contrast-active');
            this.contrastBtn.setAttribute('aria-label', 'Disable High Contrast');
            this.contrastBtn.textContent = '☀️';
        } else {
            this.playerBar.classList.remove('high-contrast');
            this.classList.remove('high-contrast-active');
            this.contrastBtn.setAttribute('aria-label', 'Enable High Contrast');
            this.contrastBtn.textContent = '🌓';
        }
    }

    formatTime(seconds) {
        if (isNaN(seconds)) return "0:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    }

    onMetadataLoaded() {
        this.progressBar.max = this.audio.duration;
        this.durationDisplay.textContent = this.formatTime(this.audio.duration);
    }

    togglePlay() {
        if (this.audio.paused) {
            this.audio.play();
            this.playIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
            this.playBtn.setAttribute('aria-label', 'Pause');
            this.status.textContent = 'Playing';
            this.logEvent('play_clicked');
        } else {
            this.audio.pause();
            this.playIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
            this.playBtn.setAttribute('aria-label', 'Play');
            this.status.textContent = 'Paused';
            this.logEvent('pause_clicked');
        }
    }

    skipNext() {
          if (this.segments.length === 0) return; 
        const currentTime = this.audio.currentTime;
        const currentIndex = this.segments.findIndex(s => currentTime >= s.start && currentTime < s.end);
        if (currentIndex !== -1 && currentIndex < this.segments.length - 1) {
            this.seekTo(this.segments[currentIndex + 1].id);
        }
    }

    skipPrevious() {
          if (this.segments.length === 0) return; 
        const currentTime = this.audio.currentTime;
        const currentIndex = this.segments.findIndex(s => currentTime >= s.start && currentTime < s.end);
        if (currentIndex > 0) {
            this.seekTo(this.segments[currentIndex - 1].id);
        } else {
            this.seekTo(this.segments[0].id);
        }
    }

    cycleSpeed() {
        this.currentSpeed += 0.25;
        if (this.currentSpeed > 2.0) this.currentSpeed = 1.0;
        this.audio.playbackRate = this.currentSpeed;
        this.speedBtn.textContent = `${this.currentSpeed.toFixed(2)}x`;
        this.speedBtn.setAttribute('aria-label', `Playback Speed: ${this.currentSpeed}x`);
        this.logEvent('speed_changed', { speed: this.currentSpeed });
    }

    resetPlayer() {
        this.playIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
        this.playBtn.setAttribute('aria-label', 'Play');
        this.audio.currentTime = 0;
        this.status.textContent = 'Playback finished';
        this.updateHighlight(null);
    }

    onTimeUpdate() {
        this.progressBar.value = this.audio.currentTime;
        this.currentTimeDisplay.textContent = this.formatTime(this.audio.currentTime);

        if (this.segments.length === 0 || this.isSpeakingMath) return;

        const currentTime = this.audio.currentTime;
        const activeSegment = this.segments.find(s => currentTime >= s.start && currentTime < s.end);

        if (activeSegment && this.activeId !== activeSegment.id) {
            this.activeId = activeSegment.id;
            this.updateHighlight(activeSegment.id);
            
            const activeElement = this.querySelector(`#${activeSegment.id}`);
            if (activeElement) {
                activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }

            if (activeSegment.type === 'math' && this.mathcatReady) {
                this.handleMathInterception(activeSegment);
            }
        }
    }

    updateHighlight(activeId) {
        this.querySelectorAll('.highlight-text').forEach(span => span.replaceWith(...span.childNodes));
        this.querySelectorAll('.highlight-math').forEach(math => math.classList.remove('highlight-math'));

        if (!activeId) return;

        const activeElement = this.querySelector(`#${activeId}`);
        if (activeElement) {
            if (activeElement.tagName.toLowerCase() === 'math') {
                activeElement.classList.add('highlight-math');
            } else {
                const span = document.createElement('span');
                span.className = 'highlight-text';
                while (activeElement.firstChild) {
                    span.appendChild(activeElement.firstChild);
                }
                activeElement.appendChild(span);
            }
        }
    }

    async handleMathInterception(segment) {
        this.isSpeakingMath = true;
        this.audio.pause();
        this.status.textContent = 'Speaking math equation...';
        this.logEvent('math_started', { id: segment.id });

        const mathElement = this.querySelector(`#${segment.id}`);
        const mathMLString = mathElement.outerHTML;
        
        let spokenText = "";
        try {
            spokenText = mathmlToSpeech(mathMLString);
        } catch (error) {
            spokenText = "Sorry, could not read the math equation.";
        }

        const utterance = new SpeechSynthesisUtterance(spokenText);
        
        utterance.onend = () => {
            this.isSpeakingMath = false;
            this.audio.currentTime = segment.end; 
            this.audio.play();
            this.status.textContent = 'Playing';
            this.logEvent('math_completed', { id: segment.id });
        };

        utterance.onerror = () => {
            this.isSpeakingMath = false;
            this.audio.currentTime = segment.end; 
            this.audio.play();
        };

        window.speechSynthesis.speak(utterance);
    }

    setupInteractions() {
        const interactiveElements = this.querySelectorAll('[id]');
        
        interactiveElements.forEach(element => {
            element.setAttribute('tabindex', '0');
            element.setAttribute('role', 'button');

            element.addEventListener('click', () => this.seekTo(element.id));

            element.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault(); 
                    this.seekTo(element.id);
                }
            });
        });
    }

    seekTo(id) {
        if (this.segments.length === 0) return; 
        if (this.isSpeakingMath) {
            window.speechSynthesis.cancel();
            this.isSpeakingMath = false;
        }
        const segment = this.segments.find(s => s.id === id);
        if (segment) {
            this.audio.currentTime = segment.start;
            this.audio.play();
            this.playIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
            this.playBtn.setAttribute('aria-label', 'Pause');
            this.logEvent('seeked', { id: id });
        }
    }
}

customElements.define('math-read-aloud-player', MathReadAloudPlayer);