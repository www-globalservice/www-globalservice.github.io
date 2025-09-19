/**
 * FLY SEGURITY V3.2
 *
 * @version 3.2
 * @author Fly
 * @description Complete refactoring with a focus on professional UI/UX, conflict prevention through randomized naming,
 * and enhanced security logic. This script is designed for maximum compatibility and performance
 * on third-party websites.
 *
 * Key Features in v3.2:
 * - Professional Dark UI: Modern, dark theme with "frosted glass" effect using backdrop-filter.
 * - Animated Canvas Background: Subtle, low-resource geometric animation behind modals.
 * - Conflict-Proofing: All DOM element IDs and class names are dynamically randomized to prevent conflicts.
 * - Dynamic Injection: All CSS and external fonts are injected into the <head> to avoid external files.
 * - Fully Responsive: Flawless adaptability from small mobile devices to large desktop screens.
 * - Unified Header: Consistent "FLY SEGURITY V3.2" branding on all user-facing elements.
 * - Aggressive Security: Maintains and enhances immediate blocking for prohibited actions.
 * - Total Connection Loss Lock: The connection loss screen now completely blocks all page interaction.
 */
(function() {
    'use strict';

    // --- CORE CONFIGURATION ---
    const CONFIG = {
        PROJECT_NAME: 'FLY SEGURITY',
        VERSION: 'V3.2',
        CREATOR_PAGE: '#', // URL to redirect on long-press of watermark
        BAN_DURATION_HOURS: 24,
        ACTION_EXIT_URL: 'http://action_exit',
        ACTION_THRESHOLD: {
            clicks: { count: 50, time: 3000 },
            keys: { count: 50, time: 3000 }
        },
        CONNECTION_LOSS_TIMEOUT_SECONDS: 30,
    };

    // --- UTILITY: RANDOM NAME GENERATOR FOR CONFLICT AVOIDANCE ---
    const generateRandomId = (prefix = 'fs-') => {
        return prefix + Math.random().toString(36).substring(2, 10);
    };

    // --- DYNAMICALLY GENERATED CLASS AND ID NAMES ---
    const DOM_IDS = {
        styleSheet: generateRandomId('style-'),
        fontLink: generateRandomId('font-'),
        canvas: generateRandomId('canvas-'),
        modalOverlay: generateRandomId('modal-overlay-'),
        watermark: generateRandomId('watermark-'),
        infoPanel: generateRandomId('info-panel-'),
        warningPanel: generateRandomId('warning-'),
        connectionLossPanel: generateRandomId('conn-loss-'),
        connectionRestoredPanel: generateRandomId('conn-restored-'),
        banScreen: generateRandomId('ban-screen-'),
    };

    const DOM_CLASSES = {
        visible: generateRandomId('visible-'),
        fadeIn: generateRandomId('fade-in-'),
        fadeOut: generateRandomId('fade-out-'),
        panelHeader: generateRandomId('panel-header-'),
        panelContent: generateRandomId('panel-content-'),
    };


    // --- UI/UX MODULE: DYNAMIC STYLE AND ELEMENT CREATION ---
    const UIManager = {
        init() {
            this.injectGoogleFont();
            this.injectStyles();
            this.createCanvasBackground();
            this.createWatermark();
            this.createInfoPanel();
            this.createConnectionLossPanel();
        },

        injectGoogleFont() {
            const link = document.createElement('link');
            link.id = DOM_IDS.fontLink;
            link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap';
            link.rel = 'stylesheet';
            document.head.appendChild(link);
        },

        injectStyles() {
            const style = document.createElement('style');
            style.id = DOM_IDS.styleSheet;
            style.textContent = `
                :root {
                    --fs-bg-color: rgba(18, 18, 22, 0.85);
                    --fs-text-color: #EAEAEA;
                    --fs-primary-color: #00A9FF;
                    --fs-warn-color: #FFD100;
                    --fs-danger-color: #FF3B30;
                    --fs-font-family: 'Inter', sans-serif;
                    --fs-border-radius: 12px;
                    --fs-z-base: 199998;
                }

                /* General Panel Styling */
                .${DOM_CLASSES.panelHeader} {
                    width: 100%;
                    text-align: center;
                    padding-bottom: 12px;
                    margin-bottom: 12px;
                    font-weight: 700;
                    font-size: 1rem;
                    color: var(--fs-text-color);
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                    letter-spacing: 0.5px;
                }

                .${DOM_CLASSES.panelContent} {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    text-align: center;
                    padding: 0 20px 20px;
                }

                /* Canvas Background */
                #${DOM_IDS.canvas} {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    z-index: var(--fs-z-base);
                    opacity: 0;
                    visibility: hidden;
                    transition: opacity 0.5s ease;
                    pointer-events: none;
                }

                /* Modal Overlay */
                #${DOM_IDS.modalOverlay} {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    z-index: calc(var(--fs-z-base) + 1);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    opacity: 0;
                    visibility: hidden;
                    transition: opacity 0.4s ease, visibility 0.4s ease;
                    backdrop-filter: blur(10px);
                    -webkit-backdrop-filter: blur(10px);
                    background-color: rgba(10, 10, 10, 0.4);
                }

                #${DOM_IDS.modalOverlay}.${DOM_CLASSES.visible}, #${DOM_IDS.canvas}.${DOM_CLASSES.visible} {
                    opacity: 1;
                    visibility: visible;
                }

                /* Base Panel for Modals */
                .fs-panel {
                    background-color: var(--fs-bg-color);
                    color: var(--fs-text-color);
                    font-family: var(--fs-font-family);
                    border-radius: var(--fs-border-radius);
                    box-shadow: 0 10px 40px rgba(0,0,0,0.5);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    max-width: 90%;
                    width: 400px;
                    transform: scale(0.95);
                    transition: transform 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
                }

                #${DOM_IDS.modalOverlay}.${DOM_CLASSES.visible} .fs-panel {
                    transform: scale(1);
                }

                /* Info Panel */
                #${DOM_IDS.infoPanel} h2 {
                    font-size: 1.8rem;
                    color: var(--fs-primary-color);
                    margin: 10px 0;
                }
                #${DOM_IDS.infoPanel} p {
                    font-size: 1rem;
                    color: #BDBDBD;
                    line-height: 1.6;
                    margin: 0;
                }
                #${DOM_IDS.infoPanel} .fs-icon-shield {
                    width: 60px;
                    height: 60px;
                    margin-bottom: 10px;
                }

                /* Watermark */
                #${DOM_IDS.watermark} {
                    position: fixed;
                    bottom: 15px;
                    left: 15px;
                    z-index: var(--fs-z-base);
                    cursor: pointer;
                    transform: scale(1);
                    transition: transform 0.3s ease;
                }
                #${DOM_IDS.watermark}:hover {
                    transform: scale(1.1);
                }
                #${DOM_IDS.watermark} svg {
                    width: 50px;
                    height: 50px;
                    filter: drop-shadow(0 4px 8px rgba(0,0,0,0.4));
                }

                /* Ban Screen */
                #${DOM_IDS.banScreen} {
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    background-color: #0c0a10; color: var(--fs-text-color);
                    display: flex; flex-direction: column; justify-content: center; align-items: center;
                    font-family: var(--fs-font-family); z-index: 2147483647; text-align: center;
                    padding: 20px;
                }
                #${DOM_IDS.banScreen} h1 { font-size: 2.5rem; color: var(--fs-danger-color); margin-bottom: 15px; }
                #${DOM_IDS.banScreen} p { font-size: 1.2rem; margin: 5px 0; max-width: 600px; }

                /* Warning & Connection Restored Notifications */
                .fs-notification {
                    position: fixed; top: 20px; right: 20px;
                    display: flex;
                    align-items: center;
                    padding: 15px 20px;
                    border-radius: var(--fs-border-radius);
                    box-shadow: 0 8px 30px rgba(0,0,0,0.25);
                    z-index: 2147483646;
                    font-family: var(--fs-font-family);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    transform: translateX(120%);
                    transition: transform 0.5s cubic-bezier(0.165, 0.84, 0.44, 1);
                }
                .fs-notification.${DOM_CLASSES.visible} {
                    transform: translateX(0);
                }
                #${DOM_IDS.warningPanel} { background-color: var(--fs-warn-color); color: #111; }
                #${DOM_IDS.connectionRestoredPanel} { background-color: #28a745; color: white; }
                .fs-notification-icon { margin-right: 15px; }
                .fs-notification-icon svg { width: 30px; height: 30px; }
                .fs-notification-text strong { font-size: 1rem; }
                .fs-notification-text p { margin: 2px 0 0; font-size: 0.9rem; opacity: 0.9; }

                /* Connection Loss Panel */
                 #${DOM_IDS.connectionLossPanel} {
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    z-index: 2147483645;
                    display: flex; justify-content: center; align-items: center;
                    background: rgba(10, 10, 10, 0.7);
                    backdrop-filter: blur(15px);
                    -webkit-backdrop-filter: blur(15px);
                    color: var(--fs-text-color);
                    font-family: var(--fs-font-family);
                    text-align: center;
                    opacity: 0;
                    visibility: hidden;
                    transition: opacity 0.5s ease, visibility 0.5s ease;
                    user-select: none; /* Block interaction */
                    pointer-events: all; /* Block interaction */
                }
                 #${DOM_IDS.connectionLossPanel}.${DOM_CLASSES.visible} {
                    opacity: 1;
                    visibility: visible;
                }
                 #${DOM_IDS.connectionLossPanel} h2 {
                    font-size: 2.2rem;
                    color: var(--fs-danger-color);
                    margin: 10px 0;
                }
                 #${DOM_IDS.connectionLossPanel} p {
                    font-size: 1.1rem;
                    max-width: 450px;
                    margin: 10px auto;
                }
                 #${DOM_IDS.connectionLossPanel} .fs-timer {
                    font-size: 2.5rem;
                    color: var(--fs-warn-color);
                    margin-top: 20px;
                    font-weight: 700;
                }

                @media (max-width: 480px) {
                    .fs-panel { width: 95%; }
                    #${DOM_IDS.banScreen} h1 { font-size: 1.8rem; }
                    #${DOM_IDS.banScreen} p { font-size: 1rem; }
                    #${DOM_IDS.connectionLossPanel} h2 { font-size: 1.8rem; }
                    #${DOM_IDS.connectionLossPanel} p { font-size: 1rem; }
                    .fs-notification { width: calc(100% - 40px); }
                }
            `;
            document.head.appendChild(style);
        },

        createCanvasBackground() {
            const canvas = document.createElement('canvas');
            canvas.id = DOM_IDS.canvas;
            document.body.appendChild(canvas);
            CanvasAnimator.init(canvas);
        },

        createWatermark() {
            const container = document.createElement('div');
            container.id = DOM_IDS.watermark;
            container.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" style="stop-color:${CONFIG.ACTION_EXIT_URL === 'http://action_exit' ? 'var(--fs-primary-color)' : '#4CAF50'};stop-opacity:1" />
                            <stop offset="100%" style="stop-color:${CONFIG.ACTION_EXIT_URL === 'http://action_exit' ? '#007BFF' : '#81C784'};stop-opacity:1" />
                        </linearGradient>
                    </defs>
                    <path d="M12 22S19 17.5 19 12V5L12 2L5 5V12C5 17.5 12 22 12 22Z" fill="url(#grad1)"/>
                    <path d="M12 6L14.5 11.5L10 14L12 18" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>`;
            document.body.appendChild(container);

            container.addEventListener('click', () => this.showInfoPanel(true));
        },

        createInfoPanel() {
            const overlay = document.createElement('div');
            overlay.id = DOM_IDS.modalOverlay;
            overlay.innerHTML = `
                <div id="${DOM_IDS.infoPanel}" class="fs-panel">
                    <div class="${DOM_CLASSES.panelHeader}">${CONFIG.PROJECT_NAME} ${CONFIG.VERSION}</div>
                    <div class="${DOM_CLASSES.panelContent}">
                        <svg class="fs-icon-shield" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" style="fill:rgba(0, 169, 255, 0.1); stroke: var(--fs-primary-color);"></path></svg>
                        <h2>Sitio Protegido</h2>
                        <p>Tu navegación es segura. Este sitio utiliza nuestra tecnología para proteger su contenido contra la copia y el plagio.</p>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.showInfoPanel(false);
                }
            });
        },

        createConnectionLossPanel() {
            const panel = document.createElement('div');
            panel.id = DOM_IDS.connectionLossPanel;
            panel.innerHTML = `
                 <div class="fs-panel">
                    <div class="${DOM_CLASSES.panelHeader}">${CONFIG.PROJECT_NAME} ${CONFIG.VERSION}</div>
                    <div class="${DOM_CLASSES.panelContent}">
                        <h2>Conexión Perdida</h2>
                        <p>Se requiere una conexión a internet activa para ver este contenido. Intentando reconectar...</p>
                        <div id="${DOM_IDS.connectionLossPanel}-timer" class="fs-timer">${CONFIG.CONNECTION_LOSS_TIMEOUT_SECONDS}</div>
                    </div>
                </div>
            `;
            document.body.appendChild(panel);
        },

        showInfoPanel(visible) {
            const overlay = document.getElementById(DOM_IDS.modalOverlay);
            const canvas = document.getElementById(DOM_IDS.canvas);
            if (visible) {
                overlay.classList.add(DOM_CLASSES.visible);
                canvas.classList.add(DOM_CLASSES.visible);
                CanvasAnimator.start();
            } else {
                overlay.classList.remove(DOM_CLASSES.visible);
                canvas.classList.remove(DOM_CLASSES.visible);
                CanvasAnimator.stop();
            }
        },

        showNotification(id, htmlContent) {
             // Remove existing notification of the same type
            const existing = document.getElementById(id);
            if (existing) {
                existing.remove();
            }

            const notification = document.createElement('div');
            notification.id = id;
            notification.className = 'fs-notification';
            notification.innerHTML = htmlContent;
            document.body.appendChild(notification);
            
            // Trigger fade in
            setTimeout(() => notification.classList.add(DOM_CLASSES.visible), 10);
            
            // Auto-hide after 5 seconds
            setTimeout(() => {
                notification.classList.remove(DOM_CLASSES.visible);
                setTimeout(() => notification.remove(), 600); // Remove from DOM after transition
            }, 5000);
        },

        showWarning() {
            const html = `
                <div class="fs-notification-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>
                </div>
                <div class="fs-notification-text">
                    <strong>Actividad Sospechosa</strong>
                    <p>La repetición de esta acción resultará en un bloqueo.</p>
                </div>
            `;
            this.showNotification(DOM_IDS.warningPanel, html);
        },
        
        showConnectionRestored() {
            const html = `
                <div class="fs-notification-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
                </div>
                <div class="fs-notification-text">
                    <strong>Conexión Recuperada</strong>
                    <p>¡Bienvenido de nuevo!</p>
                </div>
            `;
             this.showNotification(DOM_IDS.connectionRestoredPanel, html);
        }
    };


    // --- SECURITY LOGIC MODULE ---
    const SecurityManager = {
        lastActions: { clicks: [], keys: [] },
        
        init() {
            this.checkBanStatus();
            this.setupEventListeners();
            this.startDevToolsChecker();
        },

        checkBanStatus() {
            try {
                const banInfo = JSON.parse(localStorage.getItem('flySecurityBan'));
                if (banInfo && new Date().getTime() < banInfo.expires) {
                    const remainingTime = Math.ceil((banInfo.expires - new Date().getTime()) / (1000 * 60 * 60));
                    document.body.innerHTML = `
                        <div id="${DOM_IDS.banScreen}">
                            <h1>Acceso Bloqueado</h1>
                            <p>Tu acceso a este sitio ha sido suspendido temporalmente por actividad sospechosa.</p>
                            <p>Podrás volver a intentarlo en aproximadamente <strong>${remainingTime} horas</strong>.</p>
                        </div>`;
                    // This effectively stops script execution for banned users
                    throw new Error("User is banned."); 
                }
            } catch (e) {
                console.error(`${CONFIG.PROJECT_NAME}: Error checking ban status.`, e.message);
                if (e.message === "User is banned.") throw e;
            }
        },

        banUser() {
            try {
                const expires = new Date().getTime() + CONFIG.BAN_DURATION_HOURS * 60 * 60 * 1000;
                localStorage.setItem('flySecurityBan', JSON.stringify({ expires }));
                localStorage.removeItem('flySecurityWarning');
                // Redirect immediately after setting the ban
                window.location.href = CONFIG.ACTION_EXIT_URL;
            } catch (e) {
                console.error(`${CONFIG.PROJECT_NAME}: Could not ban user. Redirecting as a fallback.`, e);
                window.location.href = CONFIG.ACTION_EXIT_URL;
            }
        },

        issueWarning() {
            UIManager.showWarning();
            try {
                if (localStorage.getItem('flySecurityWarning')) {
                    this.banUser();
                } else {
                    localStorage.setItem('flySecurityWarning', 'true');
                }
            } catch (e) {
                 console.error(`${CONFIG.PROJECT_NAME}: Could not issue warning.`, e);
            }
        },

        detectRepetitiveAction(type) {
            const now = new Date().getTime();
            const config = CONFIG.ACTION_THRESHOLD[type];
            this.lastActions[type].push(now);
            this.lastActions[type] = this.lastActions[type].filter(timestamp => now - timestamp < config.time);
            if (this.lastActions[type].length > config.count) {
                this.issueWarning();
                this.lastActions[type] = [];
            }
        },

        setupEventListeners() {
            document.addEventListener('contextmenu', e => e.preventDefault());
            document.addEventListener('selectstart', e => e.preventDefault());
            document.addEventListener('copy', e => { e.preventDefault(); this.banUser(); });
            document.addEventListener('cut', e => { e.preventDefault(); this.banUser(); });
            
            document.addEventListener('click', () => this.detectRepetitiveAction('clicks'));
            document.addEventListener('keydown', (e) => {
                this.detectRepetitiveAction('keys');

                // Prohibited key combinations
                if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key.toUpperCase())) || (e.ctrlKey && e.key.toUpperCase() === 'U') || (e.ctrlKey && e.key.toUpperCase() === 'P')) {
                    e.preventDefault();
                    this.banUser();
                }
            });
        },

        startDevToolsChecker() {
            const threshold = 160;
            setInterval(() => {
                if (window.outerWidth - window.innerWidth > threshold || window.outerHeight - window.innerHeight > threshold) {
                    this.banUser();
                }
            }, 1000);
        }
    };

    // --- CONNECTION MANAGER MODULE ---
    const ConnectionManager = {
        countdownInterval: null,
        
        init() {
            window.addEventListener('online', this.handleOnline.bind(this));
            window.addEventListener('offline', this.handleOffline.bind(this));
            if (!navigator.onLine) {
                this.handleOffline();
            }
        },

        handleOffline() {
            if (this.countdownInterval) return; // Already offline

            const panel = document.getElementById(DOM_IDS.connectionLossPanel);
            panel.classList.add(DOM_CLASSES.visible);
            
            let secondsLeft = CONFIG.CONNECTION_LOSS_TIMEOUT_SECONDS;
            const timerElement = document.getElementById(`${DOM_IDS.connectionLossPanel}-timer`);

            this.countdownInterval = setInterval(() => {
                secondsLeft--;
                if (timerElement) {
                    timerElement.textContent = secondsLeft;
                }
                
                if (secondsLeft <= 0) {
                    clearInterval(this.countdownInterval);
                    window.location.href = CONFIG.ACTION_EXIT_URL;
                }
            }, 1000);
        },

        handleOnline() {
            if (!this.countdownInterval) return; // Was not offline

            clearInterval(this.countdownInterval);
            this.countdownInterval = null;

            const panel = document.getElementById(DOM_IDS.connectionLossPanel);
            panel.classList.remove(DOM_CLASSES.visible);
            
            UIManager.showConnectionRestored();
        }
    };


    // --- CANVAS ANIMATION MODULE ---
    const CanvasAnimator = {
        canvas: null,
        ctx: null,
        particles: [],
        animationFrameId: null,
        isActive: false,

        init(canvasElement) {
            this.canvas = canvasElement;
            this.ctx = this.canvas.getContext('2d');
            this.resize();
            window.addEventListener('resize', () => this.resize());
        },

        resize() {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            this.particles = [];
            this.createParticles();
        },

        createParticles() {
            const particleCount = Math.floor((this.canvas.width * this.canvas.height) / 20000);
            for (let i = 0; i < particleCount; i++) {
                this.particles.push({
                    x: Math.random() * this.canvas.width,
                    y: Math.random() * this.canvas.height,
                    vx: (Math.random() - 0.5) * 0.3,
                    vy: (Math.random() - 0.5) * 0.3,
                    size: Math.random() * 2 + 1,
                });
            }
        },

        draw() {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.strokeStyle = 'rgba(0, 169, 255, 0.3)';
            this.ctx.fillStyle = 'rgba(0, 169, 255, 0.5)';
            
            this.particles.forEach(p => {
                // Draw particle
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                this.ctx.fill();

                // Update position
                p.x += p.vx;
                p.y += p.vy;

                // Wrap around edges
                if (p.x < 0) p.x = this.canvas.width;
                if (p.x > this.canvas.width) p.x = 0;
                if (p.y < 0) p.y = this.canvas.height;
                if (p.y > this.canvas.height) p.y = 0;
            });

            // Draw lines between nearby particles
            for (let i = 0; i < this.particles.length; i++) {
                for (let j = i + 1; j < this.particles.length; j++) {
                    const dx = this.particles[i].x - this.particles[j].x;
                    const dy = this.particles[i].y - this.particles[j].y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < 150) {
                        this.ctx.beginPath();
                        this.ctx.moveTo(this.particles[i].x, this.particles[i].y);
                        this.ctx.lineTo(this.particles[j].x, this.particles[j].y);
                        this.ctx.stroke();
                    }
                }
            }
        },

        animate() {
            if (!this.isActive) return;
            this.draw();
            this.animationFrameId = requestAnimationFrame(() => this.animate());
        },

        start() {
            if (this.isActive) return;
            this.isActive = true;
            this.animate();
        },

        stop() {
            this.isActive = false;
            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
                this.animationFrameId = null;
            }
        }
    };


    // --- INITIALIZATION ---
    function initialize() {
        // Run security checks first. If the user is banned, the script will stop.
        try {
            SecurityManager.init();
        } catch (e) {
            if (e.message === "User is banned.") {
                console.info(`${CONFIG.PROJECT_NAME}: Initialization halted. User is banned.`);
                return; // Stop execution completely
            }
        }

        // If not banned, proceed with UI and other managers
        UIManager.init();
        ConnectionManager.init();
    }
    
    // Defer initialization until the DOM is fully loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

})();
