// ui-manager.js

export class UIManager {
    constructor() {
        // Cache all DOM elements
        this.dom = {
            // -- Legacy / Init --
            startScreen: document.getElementById('start-screen'),
            authStatus: document.getElementById('auth-status'),
            startBtn: document.getElementById('start-btn'),
            
            // -- Kiosk UI --
            kioskScreen: document.getElementById('kiosk-screen'),
            kioskCloseBtn: document.getElementById('kiosk-close-btn'),
            kioskUsername: document.getElementById('kiosk-username'),
            kioskSaveNameBtn: document.getElementById('kiosk-save-name'),
            kioskEmail: document.getElementById('kiosk-email'),
            kioskPass: document.getElementById('kiosk-password'),
            kioskLoginBtn: document.getElementById('kiosk-login-btn'),
            kioskLinkBtn: document.getElementById('kiosk-link-btn'),
            kioskLogoutBtn: document.getElementById('kiosk-logout-btn'),
            kioskAuthStatus: document.getElementById('kiosk-auth-status'),
            
            // Tabs
            tabProfile: document.getElementById('tab-profile'),
            tabControls: document.getElementById('tab-controls'),
            contentProfile: document.getElementById('content-profile'),
            contentControls: document.getElementById('content-controls'),

            // -- HUD --
            uiContainer: document.querySelector('.ui-container'),
            mobileMenuBtn: document.getElementById('mobile-menu-btn'),
            coinDisplay: document.getElementById('coin-display'),
            starDisplay: document.getElementById('star-display'),
            peerCount: document.getElementById('peer-count-display'),
            nameDisplay: document.getElementById('hud-name-display'),
            progressBar: document.getElementById('progress-bar'),
            progressFill: document.getElementById('progress-fill'),
            progressText: document.getElementById('progress-text'),
            versionDisplay: document.getElementById('version-display'),
            statusMsg: document.getElementById('status-msg'),

            // -- Menus --
            pauseScreen: document.getElementById('pause-screen'),
            resumeBtn: document.getElementById('resume-btn'),
            restartBtn: document.getElementById('restart-btn-menu'),
            fullscreenBtn: document.getElementById('fullscreen-btn'),
            settingsBtn: document.getElementById('settings-btn'),
            
            // -- Game Over --
            gameOverScreen: document.getElementById('game-over-screen'),
            goReason: document.getElementById('go-reason'),
            
            // -- Character Previews --
            charPreviews: document.querySelectorAll('.char-preview'),
            usernameInput: document.getElementById('username-input'),
        };

        this.statusMessages = { model: "", firebase: "" };
        
        this._bindInternalEvents();
    }

    _bindInternalEvents() {
        // Kiosk Tabs
        if (this.dom.tabProfile) {
            this.dom.tabProfile.addEventListener('click', () => {
                this._switchTab('profile');
            });
        }
        if (this.dom.tabControls) {
            this.dom.tabControls.addEventListener('click', () => {
                this._switchTab('controls');
            });
        }
    }

    _switchTab(tab) {
        if (tab === 'profile') {
            this.dom.contentProfile.classList.remove('hidden');
            this.dom.contentControls.classList.add('hidden');
            this.dom.tabProfile.classList.add('text-indigo-600', 'border-b-2', 'border-indigo-600');
            this.dom.tabProfile.classList.remove('text-gray-500');
            this.dom.tabControls.classList.remove('text-indigo-600', 'border-b-2', 'border-indigo-600');
            this.dom.tabControls.classList.add('text-gray-500');
        } else {
            this.dom.contentProfile.classList.add('hidden');
            this.dom.contentControls.classList.remove('hidden');
            this.dom.tabControls.classList.add('text-indigo-600', 'border-b-2', 'border-indigo-600');
            this.dom.tabControls.classList.remove('text-gray-500');
            this.dom.tabProfile.classList.remove('text-indigo-600', 'border-b-2', 'border-indigo-600');
            this.dom.tabProfile.classList.add('text-gray-500');
        }
    }

    // --- SETUP & STATUS ---

    setVersion(commit, date) {
        if (this.dom.versionDisplay) {
            this.dom.versionDisplay.innerText = `v${commit}`;
            this.dom.versionDisplay.title = `Built: ${date}`;
        }
    }

    setControlsHint(isMobile) {
        // This is now inside the Kiosk HTML structure directly
    }

    updateStatus(type, message, color) {
        this.statusMessages[type] = { text: message, color: color };
        
        if (type === 'firebase' && this.dom.kioskAuthStatus) {
            this.dom.kioskAuthStatus.innerHTML = message;
            if (color.includes('green')) this.dom.kioskAuthStatus.style.color = 'green';
            else if (color.includes('red')) this.dom.kioskAuthStatus.style.color = 'red';
            else this.dom.kioskAuthStatus.style.color = 'gray';
        }
    }

    enableStartButton() {
        if(this.dom.startBtn) {
            this.dom.startBtn.disabled = false;
            this.dom.startBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }

    // --- EVENT BINDING ---

    onStart(callback) {
        if(this.dom.startBtn) {
            this.dom.startBtn.addEventListener('click', () => {
                const name = this.dom.usernameInput.value.trim();
                callback(name);
            });
        }
    }

    onCharacterSelect(callback) {
        this.dom.charPreviews.forEach(btn => {
            btn.addEventListener('click', () => {
                this.dom.charPreviews.forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                callback(btn.dataset.model);
            });
        });
    }

    getCharacterPreviewElements() {
        return this.dom.charPreviews;
    }

    // --- KIOSK LOGIC ---
    toggleKiosk(show) {
        if (show) {
            this.dom.kioskScreen.style.display = 'flex';
            setTimeout(() => this.dom.kioskScreen.classList.add('active'), 10);
            
            // Pre-fill name if available
            const currentName = this.dom.nameDisplay.innerText;
            if (currentName !== 'Guest') this.dom.kioskUsername.value = currentName;
            
        } else {
            this.dom.kioskScreen.classList.remove('active');
            setTimeout(() => this.dom.kioskScreen.style.display = 'none', 300);
        }
    }

    onKioskClose(callback) {
        if(this.dom.kioskCloseBtn) {
            this.dom.kioskCloseBtn.onclick = callback; // Direct assignment to prevent duplicates
        }
    }

    onKioskNameChange(callback) {
        if(this.dom.kioskSaveNameBtn) {
            this.dom.kioskSaveNameBtn.addEventListener('click', () => {
                const newName = this.dom.kioskUsername.value.trim();
                if (newName) {
                    this.dom.nameDisplay.innerText = newName;
                    callback(newName);
                    alert("Name saved!");
                }
            });
        }
    }

    // Auth Callbacks (Kiosk)
    onLogin(callback) {
        if (this.dom.kioskLoginBtn) {
            this.dom.kioskLoginBtn.addEventListener('click', async () => {
                this.dom.kioskAuthStatus.innerText = "Logging in...";
                const email = this.dom.kioskEmail.value;
                const pass = this.dom.kioskPass.value;
                try {
                    await callback(email, pass);
                    this.dom.kioskAuthStatus.innerText = "✅ Logged in!";
                    this.dom.kioskAuthStatus.style.color = "green";
                    this.dom.kioskLoginBtn.classList.add('hidden');
                    this.dom.kioskLogoutBtn.classList.remove('hidden');
                } catch (err) {
                    this.dom.kioskAuthStatus.innerText = "❌ Error: " + err.message;
                    this.dom.kioskAuthStatus.style.color = "red";
                }
            });
        }
    }

    onLinkAccount(callback) {
        if (this.dom.kioskLinkBtn) {
            this.dom.kioskLinkBtn.addEventListener('click', async () => {
                this.dom.kioskAuthStatus.innerText = "Linking...";
                const email = this.dom.kioskEmail.value;
                const pass = this.dom.kioskPass.value;
                try {
                    await callback(email, pass);
                    this.dom.kioskAuthStatus.innerText = "✅ Account Linked!";
                    this.dom.kioskAuthStatus.style.color = "green";
                } catch (err) {
                    this.dom.kioskAuthStatus.innerText = "❌ Error: " + err.message;
                    this.dom.kioskAuthStatus.style.color = "red";
                }
            });
        }
    }

    onLogout(callback) {
        if (this.dom.kioskLogoutBtn) {
            this.dom.kioskLogoutBtn.addEventListener('click', async () => {
                await callback();
            });
        }
    }

    setAuthMessage(msg, colorClass) {
        if(this.dom.authError) {
             this.dom.authError.innerText = msg;
             this.dom.authError.className = `text-xs mt-2 font-bold ${colorClass}`;
        }
    }

    // Menu Callbacks
    onPauseToggle(callback) {
        this.dom.mobileMenuBtn.addEventListener('click', () => {
            const isPaused = this.dom.pauseScreen.classList.contains('active');
            callback(isPaused); 
        });
    }

    onResume(callback) {
        this.dom.resumeBtn.addEventListener('click', callback);
    }

    onRestart(callback) {
        this.dom.restartBtn.addEventListener('click', callback);
        const goRestart = this.dom.gameOverScreen.querySelector('button');
        if (goRestart) goRestart.addEventListener('click', callback);
    }

    onFullscreen(callback) {
        this.dom.fullscreenBtn.addEventListener('click', callback);
    }

    // --- GAME STATE UI ---

    startGameUI(playerName) {
        if(playerName) this.dom.nameDisplay.innerText = playerName;
        this.dom.startScreen.classList.remove('active');
        this.dom.progressBar.style.display = 'block';
    }

    togglePauseScreen(show) {
        if (show) {
            this.dom.pauseScreen.classList.add('active');
        } else {
            this.dom.pauseScreen.classList.remove('active');
        }
    }

    showGameOver(reason, won) {
        this.dom.goReason.innerText = reason;
        this.dom.goReason.style.color = won ? '#00ff00' : '#ff0000';
        this.dom.gameOverScreen.classList.add('active');
    }

    updateHUD(data) {
        if (data.coins !== undefined) this.dom.coinDisplay.innerText = data.coins;
        if (data.stars !== undefined) this.dom.starDisplay.innerText = data.stars;
        if (data.peers !== undefined) this.dom.peerCount.innerText = data.peers;
        if (data.progress !== undefined) {
            this.dom.progressFill.style.width = data.progress + '%';
            this.dom.progressFill.style.height = '12.5px'
            this.dom.progressText.innerText = Math.round(data.progress) + '%';
        }
    }

    initHUD(coins, stars) {
        this.dom.coinDisplay.innerText = coins;
        this.dom.starDisplay.innerText = stars;
    }

    // --- SHOP & SETTINGS UI ---

    setupShopHTML() {
        if (!document.getElementById('shop-modal')) {
            const div = document.createElement('div');
            div.id = 'shop-modal';
            div.className = 'hidden fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50';
            div.innerHTML = `
                <div class="bg-gray-800 p-6 rounded-lg max-w-lg w-full text-white border-2 border-yellow-500">
                    <h2 class="text-2xl font-bold mb-4 text-yellow-400">Ronnie's Shop</h2>
                    <div id="shop-items" class="space-y-4"></div>
                    <button id="close-shop" class="mt-6 w-full bg-red-600 py-2 rounded hover:bg-red-700">Sluiten</button>
                </div>
            `;
            document.body.appendChild(div);
            
            document.getElementById('close-shop').addEventListener('click', () => {
                document.getElementById('shop-modal').classList.add('hidden');
                document.body.requestPointerLock();
            });
        }
    }

    showShopModal(upgrades, currentCoins, buyCallback) {
        this.setupShopHTML();
        const modal = document.getElementById('shop-modal');
        const container = document.getElementById('shop-items');
        container.innerHTML = ''; 

        document.exitPointerLock();
        modal.classList.remove('hidden');

        Object.values(upgrades).forEach(item => {
            const div = document.createElement('div');
            div.className = "flex justify-between items-center p-3 bg-gray-700 rounded";
            
            const isMaxed = item.current >= item.max;
            const btnClass = isMaxed ? "bg-gray-500 cursor-not-allowed" : "bg-green-600 hover:bg-green-500";
            const btnText = isMaxed ? "Maxed" : `Koop (${item.cost})`;

            div.innerHTML = `
                <div><div class="font-bold">${item.name}</div><div class="text-xs text-gray-300">${item.desc}</div></div>
                <button class="px-3 py-1 rounded text-sm ${btnClass}" ${isMaxed ? 'disabled' : ''}>${btnText}</button>
            `;

            if (!isMaxed) {
                div.querySelector('button').addEventListener('click', async () => {
                    const result = await buyCallback(item.id, currentCoins);
                    if (result.success) {
                        alert(result.msg);
                        modal.classList.add('hidden');
                        document.body.requestPointerLock();
                    } else {
                        alert(result.msg);
                    }
                });
            }
            container.appendChild(div);
        });
    }

    setupSettingsHTML() {
        if (!document.getElementById('settings-menu')) {
            const div = document.createElement('div');
            div.id = 'settings-menu';
            div.className = 'hidden fixed inset-0 bg-gray-900 z-50 flex flex-col items-center justify-center font-mono text-white';
            div.innerHTML = `
                <div class="w-full max-w-3xl bg-gray-800 border-2 border-blue-500 rounded-lg shadow-2xl flex flex-col max-h-[90vh]">
                    <div class="p-4 border-b border-gray-700 bg-gray-900 rounded-t-lg flex justify-between items-center">
                        <h2 class="text-2xl font-bold text-blue-400">SETTINGS</h2>
                        <div class="flex space-x-2">
                            <button class="tab-btn px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm font-bold" data-tab="controls">Controls</button>
                            <button class="tab-btn px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm font-bold" data-tab="modifiers">Modifiers</button>
                            <button class="tab-btn px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm font-bold" data-tab="graphics">Graphics</button>
                            <button class="tab-btn px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm font-bold active-tab" data-tab="volume">Volume</button>
                        </div>
                    </div>

                    <div class="flex-1 overflow-y-auto p-6 bg-gray-800" id="settings-content">
                        </div>

                    <div class="p-4 border-t border-gray-700 bg-gray-900 rounded-b-lg flex justify-between gap-4">
                        <button id="btn-defaults" class="px-6 py-2 bg-yellow-600 hover:bg-yellow-500 text-white font-bold rounded">Defaults</button>
                        <div class="flex gap-4">
                            <button id="btn-cancel" class="px-6 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded">Return (No Save)</button>
                            <button id="btn-save" class="px-6 py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded">Save & Return</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(div);

            // Tab switching logic
            div.querySelectorAll('.tab-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    div.querySelectorAll('.tab-btn').forEach(b => {
                        b.classList.remove('bg-blue-600', 'text-white');
                        b.classList.add('bg-gray-700');
                    });
                    e.target.classList.remove('bg-gray-700');
                    e.target.classList.add('bg-blue-600', 'text-white');
                    this.renderSettingsTab(e.target.dataset.tab);
                });
            });
        }
    }

    openSettingsMenu(settingsManager, onSave) {
        this.setupSettingsHTML();
        const menu = document.getElementById('settings-menu');
        const content = document.getElementById('settings-content');
        
        // Hide Pause Menu (overlay)
        this.dom.pauseScreen.classList.remove('active'); 
        menu.classList.remove('hidden');

        // Tijdelijke kopie van settings om in te editen
        this.tempSettings = JSON.parse(JSON.stringify({
            graphics: settingsManager.get('graphics') || 'high',
            keybinds: settingsManager.get('keybinds'),
            modifiers: settingsManager.get('modifiers'),
            audio: settingsManager.get('audio')
        }));
        
        this.currentSettingsManager = settingsManager; // Referentie voor defaults

        // Render eerste tab
        document.querySelector('[data-tab="controls"]').click();

        // Button events (verwijder oude listeners door cloneNode)
        const saveBtn = document.getElementById('btn-save');
        const cancelBtn = document.getElementById('btn-cancel');
        const defaultBtn = document.getElementById('btn-defaults');

        const newSave = saveBtn.cloneNode(true);
        const newCancel = cancelBtn.cloneNode(true);
        const newDefault = defaultBtn.cloneNode(true);
        
        saveBtn.parentNode.replaceChild(newSave, saveBtn);
        cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
        defaultBtn.parentNode.replaceChild(newDefault, defaultBtn);

        newSave.addEventListener('click', () => {
            onSave(this.tempSettings);
            menu.classList.add('hidden');
            this.dom.pauseScreen.classList.add('active'); // Terug naar pause menu
        });

        newCancel.addEventListener('click', () => {
            menu.classList.add('hidden');
            this.dom.pauseScreen.classList.add('active');
        });

        newDefault.addEventListener('click', () => {
            if(confirm("Alles resetten naar defaults?")) {
                this.tempSettings = JSON.parse(JSON.stringify(settingsManager.defaultSettings));
                // Her-render huidige tab
                const activeTab = document.querySelector('.tab-btn.bg-blue-600').dataset.tab;
                this.renderSettingsTab(activeTab);
            }
        });
    }

    renderSettingsTab(tabName) {
        const container = document.getElementById('settings-content');
        container.innerHTML = '';

        if (tabName === 'volume') {
            const createSlider = (label, key, val) => `
                <div class="mb-6">
                    <div class="flex justify-between mb-2">
                        <label class="font-bold text-gray-300">${label}</label>
                        <span class="text-blue-400 font-bold">${val}%</span>
                    </div>
                    <input type="range" min="0" max="100" value="${val}" data-key="${key}" 
                        class="vol-slider w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500">
                </div>`;

            container.innerHTML = `
                ${createSlider("Master Volume", "master", this.tempSettings.audio.master)}
                ${createSlider("Music Volume (.mp3)", "music", this.tempSettings.audio.music)}
                ${createSlider("Sound Effects (.wav)", "sfx", this.tempSettings.audio.sfx)}
            `;

            container.querySelectorAll('.vol-slider').forEach(input => {
                input.addEventListener('input', (e) => {
                    this.tempSettings.audio[e.target.dataset.key] = parseInt(e.target.value);
                    e.target.previousElementSibling.querySelector('span').innerText = e.target.value + '%';
                });
            });

        } else if (tabName === 'controls') {
            let html = '<div class="grid grid-cols-1 gap-4">';
            Object.entries(this.tempSettings.keybinds).forEach(([action, key]) => {
                html += `
                    <div class="flex justify-between items-center bg-gray-700 p-3 rounded border border-gray-600">
                        <span class="capitalize font-bold text-gray-200">${action}</span>
                        <button class="keybind-btn bg-gray-900 px-4 py-2 rounded text-blue-400 font-mono border border-blue-900 hover:border-blue-500 min-w-[100px]" 
                                data-action="${action}">${key}</button>
                    </div>`;
            });
            html += '</div>';
            container.innerHTML = html;

            container.querySelectorAll('.keybind-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    btn.innerText = "Press key...";
                    btn.classList.add('animate-pulse', 'border-yellow-500', 'text-yellow-500');
                    
                    const handler = (e) => {
                        e.preventDefault();
                        this.tempSettings.keybinds[btn.dataset.action] = e.code;
                        btn.innerText = e.code;
                        btn.classList.remove('animate-pulse', 'border-yellow-500', 'text-yellow-500');
                        document.removeEventListener('keydown', handler);
                    };
                    document.addEventListener('keydown', handler, { once: true });
                });
            });

        } else if (tabName === 'modifiers') {
            let html = '<div class="grid grid-cols-1 md:grid-cols-2 gap-6">';
            const defs = this.currentSettingsManager.defaultSettings.modifiers;

            Object.entries(this.tempSettings.modifiers).forEach(([key, val]) => {
                const isBool = typeof val === 'boolean';
                const defaultVal = defs[key];
                
                html += `
                    <div class="bg-gray-700 p-4 rounded border border-gray-600">
                        <label class="block font-bold text-gray-200 mb-1 capitalize">${key.replace(/([A-Z])/g, ' $1')}</label>
                        <div class="text-xs text-gray-400 italic mb-2">Default: ${defaultVal}</div>
                        ${isBool ? `
                            <button class="bool-toggle w-full py-2 rounded font-bold ${val ? 'bg-green-600' : 'bg-red-600'}" 
                                data-key="${key}">${val ? 'ENABLED' : 'DISABLED'}</button>
                        ` : `
                            <input type="number" step="0.1" value="${val}" data-key="${key}" 
                                class="mod-input w-full p-2 bg-gray-900 border border-gray-500 rounded text-white focus:border-blue-500 focus:outline-none">
                        `}
                    </div>`;
            });
            html += '</div>';
            container.innerHTML = html;

            container.querySelectorAll('.mod-input').forEach(input => {
                input.addEventListener('change', (e) => {
                    this.tempSettings.modifiers[e.target.dataset.key] = parseFloat(e.target.value);
                });
            });
            
            container.querySelectorAll('.bool-toggle').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const key = e.target.dataset.key;
                    const newVal = !this.tempSettings.modifiers[key];
                    this.tempSettings.modifiers[key] = newVal;
                    
                    e.target.className = `bool-toggle w-full py-2 rounded font-bold ${newVal ? 'bg-green-600' : 'bg-red-600'}`;
                    e.target.innerText = newVal ? 'ENABLED' : 'DISABLED';
                });
            });
        }
        else if (tabName === 'graphics') {
            const current = this.tempSettings.graphics;

            container.innerHTML = `
                <div class="flex flex-col gap-6">
                    <div class="bg-gray-700 p-6 rounded border border-gray-600 text-center">
                        <h3 class="font-bold text-xl mb-2 text-white">Graphics Quality</h3>
                        <p class="text-sm text-gray-300 mb-6">
                            Kies de grafische kwaliteit. <br>
                            <span class="text-yellow-400 text-xs italic">Tip: Kies 'Low' als het spel hapert op jouw apparaat.</span>
                        </p>
                        
                        <div class="flex gap-4 justify-center">
                            <button class="gfx-btn flex-1 max-w-[200px] py-4 rounded-lg font-bold border-2 transition-all duration-200 
                                ${current === 'low' 
                                    ? 'bg-blue-600 border-blue-400 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)] scale-105' 
                                    : 'bg-gray-800 border-gray-600 text-gray-400 hover:border-gray-500 hover:bg-gray-750'}" 
                                data-value="low">
                                <div class="text-2xl mb-1">🦾</div>
                                <div class="text-lg">Performance</div>
                                <div class="text-[10px] uppercase tracking-wider opacity-70">Low poly</div>
                            </button>
                            
                            <button class="gfx-btn flex-1 max-w-[200px] py-4 rounded-lg font-bold border-2 transition-all duration-200 
                                ${current === 'medium' 
                                    ? 'bg-blue-600 border-blue-400 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)] scale-105' 
                                    : 'bg-gray-800 border-gray-600 text-gray-400 hover:border-gray-500 hover:bg-gray-750'}" 
                                data-value="medium">
                                <div class="text-2xl mb-1">🚀</div>
                                <div class="text-lg">Smooth</div>
                                <div class="text-[10px] uppercase tracking-wider opacity-70">Good textures</div>
                            </button>
                            
                            <button class="gfx-btn flex-1 max-w-[200px] py-4 rounded-lg font-bold border-2 transition-all duration-200
                                ${current === 'high' 
                                    ? 'bg-blue-600 border-blue-400 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)] scale-105' 
                                    : 'bg-gray-800 border-gray-600 text-gray-400 hover:border-gray-500 hover:bg-gray-750'}" 
                                data-value="high">
                                <div class="text-2xl mb-1">👑</div>
                                <div class="text-lg">Quality</div>
                                <div class="text-[10px] uppercase tracking-wider opacity-70">Premium stuff</div>
                            </button>
                            
                            <button class="gfx-btn flex-1 max-w-[200px] py-4 rounded-lg font-bold border-2 transition-all duration-200
                                ${current === 'ultra' 
                                    ? 'bg-blue-600 border-blue-400 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)] scale-105' 
                                    : 'bg-gray-800 border-gray-600 text-gray-400 hover:border-gray-500 hover:bg-gray-750'}" 
                                data-value="ultra">
                                <div class="text-2xl mb-1">✨</div>
                                <div class="text-lg">Original</div>
                                <div class="text-[10px] uppercase tracking-wider opacity-70">For the high end pc's</div>
                            </button>
                        </div>
                        
                        <div class="mt-6 text-xs text-red-400 bg-gray-800 inline-block px-3 py-1 rounded border border-red-900/50">
                            ⚠️ Een herstart (F5) is vereist om textures opnieuw te laden.
                        </div>
                    </div>
                </div>
            `;

            // Click events voor de nieuwe knoppen
            container.querySelectorAll('.gfx-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    this.tempSettings.graphics = btn.dataset.value;
                    this.renderSettingsTab('graphics'); // Her-render direct om de selectie te tonen
                });
            });
        }
    }

    /**
     * Initializes and injects the theme toggle button into the pause menu.
     * Handles the cycle logic (Auto -> Light -> Dark) and visual updates.
     * @param {SettingsManager} settingsManager - The manager instance for persistence.
     * @param {Function} onThemeChange - Callback triggered when the theme is toggled.
     */
    setupThemeToggle(settingsManager, onThemeChange) {
        const pauseCard = document.querySelector('#pause-screen .game-card');
        if (!pauseCard) return;

        const oldBtn = document.getElementById('theme-toggle-btn');
        if (oldBtn) oldBtn.remove();

        const btn = document.createElement('button');
        btn.id = 'theme-toggle-btn';
        btn.className = "absolute top-10 right-10 w-10 h-10 cursor-pointer hover:opacity-80 transition-opacity focus:outline-none";
        btn.title = "Toggle Theme";
        
        // HAAL INITIAL THEME OP (Default is nu dynamic)
        let currentTheme = settingsManager.get('theme') || 'dynamic';
        btn.innerHTML = this._getThemeSVG(currentTheme);

        btn.addEventListener('click', () => {
            // Huidige status ophalen
            const current = settingsManager.get('theme') || 'dynamic';
            let newTheme = 'dynamic';

            // CYCLUS: Dynamic -> Auto -> Light -> Dark -> Dynamic
            if (current === 'dynamic') newTheme = 'auto';
            else if (current === 'auto') newTheme = 'light';
            else if (current === 'light') newTheme = 'dark';
            else newTheme = 'dynamic'; // Terug naar start

            settingsManager.set('theme', newTheme);
            btn.innerHTML = this._getThemeSVG(newTheme);
            
            onThemeChange(newTheme);
        });

        pauseCard.style.position = 'relative';
        pauseCard.appendChild(btn);
    }

    /**
     * Generates the SVG string for the requested theme mode.
     * @param {string} mode - The current theme mode ('light', 'dark', or 'auto').
     * @returns {string} - The SVG HTML string.
     */
    _getThemeSVG(mode) {
        // Color definitions based on Tailwind palette
        const cYellow = "#fde047"; // yellow-300
        const cIndigo = "#3730a3"; // indigo-800
        
        // Return Light Mode Icon (Yellow Sun)
        if (mode === 'light') {
            return `
            <svg viewBox="0 0 32 32" fill="${cYellow}">
                <g transform="translate(0,0) scale(0.5)">
                    <circle cx="32.003" cy="32.005" r="16.001"/>
                    <path d="M12.001,31.997c0-2.211-1.789-4-4-4H4c-2.211,0-4,1.789-4,4   s1.789,4,4,4h4C10.212,35.997,12.001,34.208,12.001,31.997z"/>
                    <path d="M12.204,46.139l-2.832,2.833c-1.563,1.562-1.563,4.094,0,5.656   c1.562,1.562,4.094,1.562,5.657,0l2.833-2.832c1.562-1.562,1.562-4.095,0-5.657C16.298,44.576,13.767,44.576,12.204,46.139z"/>
                    <path d="M32.003,51.999c-2.211,0-4,1.789-4,4V60c0,2.211,1.789,4,4,4   s4-1.789,4-4l-0.004-4.001C36.003,53.788,34.21,51.999,32.003,51.999z"/>
                    <path d="M51.798,46.143c-1.559-1.566-4.091-1.566-5.653-0.004   s-1.562,4.095,0,5.657l2.829,2.828c1.562,1.57,4.094,1.562,5.656,0s1.566-4.09,0-5.656L51.798,46.143z"/>
                    <path d="M60.006,27.997l-4.009,0.008   c-2.203-0.008-3.992,1.781-3.992,3.992c-0.008,2.211,1.789,4,3.992,4h4.001c2.219,0.008,4-1.789,4-4   C64.002,29.79,62.217,27.997,60.006,27.997z"/>
                    <path d="M51.798,17.859l2.828-2.829c1.574-1.566,1.562-4.094,0-5.657   c-1.559-1.567-4.09-1.567-5.652-0.004l-2.829,2.836c-1.562,1.555-1.562,4.086,0,5.649C47.699,19.426,50.239,19.418,51.798,17.859z"/>
                    <path d="M32.003,11.995c2.207,0.016,4-1.789,4-3.992v-4   c0-2.219-1.789-4-4-4c-2.211-0.008-4,1.781-4,3.993l0.008,4.008C28.003,10.206,29.792,11.995,32.003,11.995z"/>
                    <path d="M12.212,17.855c1.555,1.562,4.079,1.562,5.646-0.004   c1.574-1.551,1.566-4.09,0.008-5.649l-2.829-2.828c-1.57-1.571-4.094-1.559-5.657,0c-1.575,1.559-1.575,4.09-0.012,5.653   L12.212,17.855z"/>
                </g>
            </svg>`;
        }

        // Return Dark Mode Icon (Indigo Moon)
        if (mode === 'dark') {
            return `
            <svg viewBox="0 0 32 32" fill="${cIndigo}">
                <g transform="translate(0,0) scale(1.45)">
                    <path d="M19.9001 2.30719C19.7392 1.8976 19.1616 1.8976 19.0007 2.30719L18.5703 3.40247C18.5212 3.52752 18.4226 3.62651 18.298 3.67583L17.2067 4.1078C16.7986 4.26934 16.7986 4.849 17.2067 5.01054L18.298 5.44252C18.4226 5.49184 18.5212 5.59082 18.5703 5.71587L19.0007 6.81115C19.1616 7.22074 19.7392 7.22074 19.9001 6.81116L20.3305 5.71587C20.3796 5.59082 20.4782 5.49184 20.6028 5.44252L21.6941 5.01054C22.1022 4.849 22.1022 4.26934 21.6941 4.1078L20.6028 3.67583C20.4782 3.62651 20.3796 3.52752 20.3305 3.40247L19.9001 2.30719Z"/>
                    <path d="M16.0328 8.12967C15.8718 7.72009 15.2943 7.72009 15.1333 8.12967L14.9764 8.52902C14.9273 8.65407 14.8287 8.75305 14.7041 8.80237L14.3062 8.95987C13.8981 9.12141 13.8981 9.70107 14.3062 9.86261L14.7041 10.0201C14.8287 10.0694 14.9273 10.1684 14.9764 10.2935L15.1333 10.6928C15.2943 11.1024 15.8718 11.1024 16.0328 10.6928L16.1897 10.2935C16.2388 10.1684 16.3374 10.0694 16.462 10.0201L16.8599 9.86261C17.268 9.70107 17.268 9.12141 16.8599 8.95987L16.462 8.80237C16.3374 8.75305 16.2388 8.65407 16.1897 8.52902L16.0328 8.12967Z"/>
                    <path d="M12 22C17.5228 22 22 17.5228 22 12C22 11.5373 21.3065 11.4608 21.0672 11.8568C19.9289 13.7406 17.8615 15 15.5 15C11.9101 15 9 12.0899 9 8.5C9 6.13845 10.2594 4.07105 12.1432 2.93276C12.5392 2.69347 12.4627 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"/>
                </g>        
            </svg>`;
        }

        // Return Dynamic Mode Icon (Rainbow)
        if (mode === 'dynamic') {
            return `
            <svg viewBox="0 0 32 32">
                <defs>
                    <clipPath id="clip-bottom">
                        <rect x="0" y="0" width="32" height="22" />
                    </clipPath>
                </defs>
                <g clip-path="url(#clip-bottom)">
                    <circle cx="16" cy="25" r="14" fill="none" stroke="#ef4444" stroke-width="3" />
                    <circle cx="16" cy="25" r="10" fill="none" stroke="#f59e0b" stroke-width="3" />
                    <circle cx="16" cy="25" r="6" fill="none" stroke="#3b82f6" stroke-width="3" />
                </g>
                <circle cx="6" cy="24" r="3" fill="white" opacity="0.8" />
                <circle cx="9" cy="24" r="2.5" fill="white" opacity="0.8" />
                <circle cx="26" cy="24" r="3" fill="white" opacity="0.8" />
                <circle cx="23" cy="24" r="2.5" fill="white" opacity="0.8" />
            </svg>`;
        }

        // Return Auto Mode Icon (Split Gradient with small Sun and Moon)
        return `
        <svg viewBox="0 0 32 32">
            <defs>
                <linearGradient id="autoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#fde047;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#3730a3;stop-opacity:1" />
                </linearGradient>

                <mask id="themeMask">
                    <g transform="translate(0, 0) scale(0.26)" fill="white">
                        <circle cx="32.003" cy="32.005" r="16.001"/>
                        <path d="M12.001,31.997c0-2.211-1.789-4-4-4H4c-2.211,0-4,1.789-4,4   s1.789,4,4,4h4C10.212,35.997,12.001,34.208,12.001,31.997z"/>
                        <path d="M12.204,46.139l-2.832,2.833c-1.563,1.562-1.563,4.094,0,5.656   c1.562,1.562,4.094,1.562,5.657,0l2.833-2.832c1.562-1.562,1.562-4.095,0-5.657C16.298,44.576,13.767,44.576,12.204,46.139z"/>
                        <path d="M32.003,51.999c-2.211,0-4,1.789-4,4V60c0,2.211,1.789,4,4,4   s4-1.789,4-4l-0.004-4.001C36.003,53.788,34.21,51.999,32.003,51.999z"/>
                        <path d="M51.798,46.143c-1.559-1.566-4.091-1.566-5.653-0.004   s-1.562,4.095,0,5.657l2.829,2.828c1.562,1.57,4.094,1.562,5.656,0s1.566-4.09,0-5.656L51.798,46.143z"/>
                        <path d="M60.006,27.997l-4.009,0.008   c-2.203-0.008-3.992,1.781-3.992,3.992c-0.008,2.211,1.789,4,3.992,4h4.001c2.219,0.008,4-1.789,4-4   C64.002,29.79,62.217,27.997,60.006,27.997z"/>
                        <path d="M51.798,17.859l2.828-2.829c1.574-1.566,1.562-4.094,0-5.657   c-1.559-1.567-4.09-1.567-5.652-0.004l-2.829,2.836c-1.562,1.555-1.562,4.086,0,5.649C47.699,19.426,50.239,19.418,51.798,17.859z"/>
                        <path d="M32.003,11.995c2.207,0.016,4-1.789,4-3.992v-4   c0-2.219-1.789-4-4-4c-2.211-0.008-4,1.781-4,3.993l0.008,4.008C28.003,10.206,29.792,11.995,32.003,11.995z"/>
                        <path d="M12.212,17.855c1.555,1.562,4.079,1.562,5.646-0.004   c1.574-1.551,1.566-4.09,0.008-5.649l-2.829-2.828c-1.57-1.571-4.094-1.559-5.657,0c-1.575,1.559-1.575,4.09-0.012,5.653   L12.212,17.855z"/>
                    </g>    
        
                    <line x1="4" y1="28" x2="28" y2="4" stroke="white" stroke-width="1.5" stroke-linecap="round" />
                </mask>
            </defs>

            <rect width="100%" height="100%" fill="url(#autoGradient)" mask="url(#themeMask)" />
        </svg>`;
    }
}