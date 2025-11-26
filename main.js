import * as THREE from 'three';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/jsm/loaders/GLTFLoader.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, onSnapshot, collection, deleteDoc } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

// ==================================================================
// JOUW FIREBASE CONFIG
// ========================@==========================================
const firebaseConfig = {
    apiKey: window.env.VITE_API_KEY,
    authDomain: window.env.VITE_AUTH_DOMAIN,
    projectId: window.env.VITE_PROJECT_ID,
    storageBucket: window.env.VITE_STORAGE_BUCKET,
    messagingSenderId: window.env.VITE_MESSAGING_SENDER_ID,
    appId: window.env.VITE_APP_ID
};

// Instellingen
const BASE_GRAVITY = 30.0;
const TRIP_GRAVITY = 10.0;
const JUMP_SPEED = 15.0;
const MOVE_SPEED = 12.0;
const CASTLE_Z = -300;
const BUFF_DURATION = 8000;

// Globals
let app, auth, db, userId, myName = "Speler", isMultiplayer = false;
let camera, scene, renderer, player, playerModel, mixer, animations = {};
let velocity = new THREE.Vector3();
let platforms = [], coins = [], enemies = [], otherPlayers = {}, projectiles = [];
let gameState = 'start', canJump = false, coinsCollected = 0;
let moveF = false, moveB = false, moveL = false, moveR = false;
let textureLoader;
let currentAction = null;
let modelLoaded = false;

// Trip Mode Variabelen
let isTripping = false;
let tripTimer = null;
let currentGravity = BASE_GRAVITY;
let targetGravity = BASE_GRAVITY;
const baseFog = new THREE.Color(0x87CEEB);
const tripFog = new THREE.Color(0x00ff00);
const baseBg = new THREE.Color(0x87CEEB);
const tripBg = new THREE.Color(0x113311);

// UI Referenties
const ui = {
    start: document.getElementById('start-screen'),
    status: document.getElementById('auth-status'),
    btn: document.getElementById('start-btn'),
    resumeBtn: document.getElementById('resume-btn'),
    pauseScreen: document.getElementById('pause-screen'),
    coins: document.getElementById('coin-display'),
    peers: document.getElementById('peer-count'),
    nameDisplay: document.getElementById('player-name-display'),
    nameInput: document.getElementById('username-input'),
    gameOver: document.getElementById('game-over-screen'),
    goReason: document.getElementById('go-reason')
};

window.onload = async () => {
    // Start Three.js eerst om visuele feedback te geven
    initThreeJS();

    // Dan Multiplayer opstarten
    try {
        updateStatus("firebase", "🔌 Verbinding maken...", "blue");

        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);

        onAuthStateChanged(auth, (user) => {
            if (user) {
                userId = user.uid;
                isMultiplayer = true;
                console.log("Firebase connected! User ID:", userId);
                updateStatus("firebase", "✅ Multiplayer verbonden!", "green");
                checkIfReadyToStart();

                listenToPlayers();
            } else {
                console.log("No user yet, signing in anonymously...");
                updateStatus("firebase", "🔐 Inloggen...", "blue");
                signInAnonymously(auth).catch((err) => {
                    console.error("Auth error:", err);
                    updateStatus("firebase", "❌ Firebase verbinding mislukt", "red");
                });
            }
        });
    } catch (e) {
        console.error("Firebase init error:", e);
        updateStatus("firebase", "⚠️ Offline Modus (Config Fout)", "yellow");
        // In offline mode, alleen model nodig
        isMultiplayer = false;
        checkIfReadyToStart();
    }
};

function checkIfReadyToStart() {
    console.log("Ready check: modelLoaded =", modelLoaded, ", isMultiplayer =", isMultiplayer, ", userId =", userId);
    if (modelLoaded && (!isMultiplayer || (isMultiplayer && userId))) {
        enableStart();
    }
}

function enableStart() {
    ui.btn.disabled = false;
    ui.btn.classList.remove('opacity-50', 'cursor-not-allowed');
}

function initThreeJS() {
    scene = new THREE.Scene();
    scene.background = baseBg.clone();
    scene.fog = new THREE.Fog(baseFog.clone(), 10, 90);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    // Licht
    const ambient = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(50, 100, 50);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    textureLoader = new THREE.TextureLoader();

    // Speler Container (voor collisie detectie)
    player = new THREE.Object3D();
    player.position.set(0, 5, 0);

    scene.add(player);

    // Laad het GLB model
    loadPlayerModel();

    setupInputs();

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    animate();
}

function addPlayerLights() {
    if (!player) return;

    // Key light (vooraan, iets hoger)
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
    keyLight.position.set(5, 10, 5);
    keyLight.castShadow = true;
    keyLight.intensity = 4.0;
    player.add(keyLight);

    // Fill light (van de andere kant, zachter)
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
    fillLight.position.set(-5, 5, 5);
    fillLight.intensity = 2.4;
    player.add(fillLight);

    // Back light / rim light (achter speler, voor contouren)
    const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
    backLight.position.set(0, 5, -5);
    backLight.intensity = 1.6;
    player.add(backLight);

    // Optioneel: klein puntlicht vlakbij het model voor highlights
    const pointLight = new THREE.PointLight(0xffffff, 0.5, 10);
    pointLight.position.set(0, 3, 0);
    pointLight.intensity = 3;
    player.add(pointLight);
}

function loadPlayerModel() {
    const loader = new GLTFLoader();

    console.log("Starting to load model...");
    updateStatus("model", "🎮 Model laden... 0%", "purple");

    loader.load('fantasy_villager_1.0.glb',
        (gltf) => {
            console.log("Model loaded successfully!", gltf);
            playerModel = gltf.scene;

            // Schaal het model indien nodig
            playerModel.scale.set(2, 2, 2);

            // Roteer het model zodat het naar voren kijkt
            playerModel.rotation.y = Math.PI;

            playerModel.position.y = -1.2

            // Voeg het model toe aan de player container
            player.add(playerModel);

            // Setup animations
            if (gltf.animations && gltf.animations.length > 0) {
                mixer = new THREE.AnimationMixer(playerModel);

                console.log("Found animations:", gltf.animations.map(a => a.name));

                gltf.animations.forEach((clip) => {
                    const action = mixer.clipAction(clip);
                    const name = clip.name.toLowerCase();

                    // Probeer standaard animatie namen te detecteren
                    if (name.includes('idle') || name.includes('stand')) {
                        animations.idle = action;
                    } else if (name.includes('walk') || name.includes('run')) {
                        animations.run = action;
                    } else if (name.includes('jump')) {
                        animations.jump = action;
                    }
                });

                // Als de namen anders zijn, gebruik de eerste 3 clips als fallback
                if (!animations.idle && gltf.animations[0]) {
                    animations.idle = mixer.clipAction(gltf.animations[0]);
                }
                if (!animations.run && gltf.animations[1]) {
                    animations.run = mixer.clipAction(gltf.animations[1]);
                }
                if (!animations.jump && gltf.animations[2]) {
                    animations.jump = mixer.clipAction(gltf.animations[2]);
                }

                // Start met idle animatie
                if (animations.idle) {
                    currentAction = animations.idle;
                    currentAction.play();
                }

                console.log('Animations loaded:', Object.keys(animations));
            } else {
                console.warn('No animations found in GLB file');
            }

            modelLoaded = true;
            updateStatus("model", "✅ Model geladen!", "green");

            checkIfReadyToStart();
        },
        (progress) => {
            if (progress.total > 0) {
                const percent = Math.round(progress.loaded / progress.total * 100);
                updateStatus("model", `🎮 Model laden... ${percent}%`, "purple");
                console.log('Loading model:', percent + '%');
            }
        },
        (error) => {
            console.error('Error loading model:', error);
            updateStatus("model", "⚠️ Model laden mislukt (gebruik fallback)", "yellow");

            // Fallback: maak een simpele box als backup
            const fallbackGeo = new THREE.BoxGeometry(1, 2, 1);
            const fallbackMat = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
            playerModel = new THREE.Mesh(fallbackGeo, fallbackMat);
            player.add(playerModel);
            addPlayerLights();

            // Enable shadows and update materials
            playerModel.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    if (child.material) child.material.needsUpdate = true;
                }
            });

            playerModel.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    if (child.material) child.material.needsUpdate = true;
                }
            });

            modelLoaded = true;
            checkIfReadyToStart();
        });
}

// Helper functie om status berichten te combineren
const statusMessages = { model: "", firebase: "" };

function updateStatus(type, message, color) {
    statusMessages[type] = { text: message, color: color };

    // Combineer beide berichten
    const messages = [];
    const colors = [];

    if (statusMessages.model.text) {
        messages.push(statusMessages.model.text);
        colors.push(statusMessages.model.color);
    }
    if (statusMessages.firebase.text) {
        messages.push(statusMessages.firebase.text);
        colors.push(statusMessages.firebase.color);
    }

    // Bepaal de meest "belangrijke" kleur (red > yellow > purple > blue > green)
    const colorPriority = { red: 1, yellow: 2, purple: 3, blue: 4, green: 5 };
    const finalColor = colors.sort((a, b) => colorPriority[a] - colorPriority[b])[0] || "blue";

    const colorClasses = {
        red: "bg-red-100 text-red-800 border-red-400",
        yellow: "bg-yellow-100 text-yellow-800 border-yellow-400",
        purple: "bg-purple-100 text-purple-800 border-purple-400",
        blue: "bg-blue-100 text-blue-800 border-blue-400",
        green: "bg-green-100 text-green-800 border-green-400"
    };

    ui.status.innerHTML = messages.join("<br>");
    ui.status.className = `text-sm p-3 mb-4 rounded-lg border ${colorClasses[finalColor]}`;
}

function playAnimation(name) {
    if (!mixer || !animations[name] || currentAction === animations[name]) return;

    const nextAction = animations[name];

    if (currentAction) {
        currentAction.fadeOut(0.2);
    }

    nextAction.reset().fadeIn(0.2).play();
    currentAction = nextAction;
}

// --- WERELD SYNC LOGICA ---

async function syncAndBuildWorld() {
    ui.status.innerText = "Wereld laden...";

    // Maak alles leeg
    platforms.forEach(p => scene.remove(p)); platforms = [];
    coins.forEach(c => scene.remove(c)); coins = [];
    enemies.forEach(e => scene.remove(e)); enemies = [];
    projectiles.forEach(p => scene.remove(p.mesh)); projectiles = [];

    let worldData = null;

    if (isMultiplayer) {
        try {
            const worldDocRef = doc(db, "levels", "main_world");
            const docSnap = await getDoc(worldDocRef);

            if (docSnap.exists()) {
                console.log("Bestaande wereld gevonden!");
                worldData = docSnap.data();
            } else {
                console.log("Geen wereld gevonden, nieuwe genereren...");
                worldData = generateWorldData();
                await setDoc(worldDocRef, worldData);
            }
        } catch (e) {
            console.error("Fout bij ophalen wereld (waarschijnlijk rechten):", e);
            ui.status.innerHTML = "⚠️ <strong>Database Fout:</strong> Toegang geweigerd.<br><small>Check je Firestore Rules in de Console.</small>";
            ui.status.className = "bg-red-100 text-red-800 p-3 rounded mb-4 border border-red-400";
            worldData = generateWorldData();
        }
    } else {
        worldData = generateWorldData();
    }

    if (!worldData || !worldData.platforms || worldData.platforms.length === 0) {
        console.warn("Ontvangen wereld data was leeg, fallback naar lokaal.");
        worldData = generateWorldData();
    }

    buildWorldFromData(worldData);
    if (!ui.status.innerText.includes("Fout")) {
        ui.status.innerText = "Veel plezier!";
    }
}

function generateWorldData() {
    const data = { platforms: [], coins: [], enemies: [] };

    data.platforms.push({ x: 0, y: -2, z: 0, w: 10, h: 2, d: 10 });

    let z = -10;
    while (z > CASTLE_Z + 20) {
        let x = (Math.random() - 0.5) * 30;
        let y = (Math.random() - 0.5) * 6;
        let w = 3 + Math.random() * 5;
        let h = 1 + Math.random() * 2;
        let d = 3 + Math.random() * 5;

        data.platforms.push({ x, y, z, w, h, d });
        if (Math.random() > 0.4) data.coins.push({ x, y: y + 2, z });
        if (Math.random() > 0.7) data.enemies.push({ x, y: y + 3, z });
        z -= (4 + Math.random() * 4);
    }
    data.platforms.push({ x: 0, y: 0, z: CASTLE_Z, w: 20, h: 2, d: 20 });
    return data;
}

function buildWorldFromData(data) {
    if (data.platforms) data.platforms.forEach(p => createPlat(p.x, p.y, p.z, p.w, p.h, p.d));
    if (data.coins) data.coins.forEach(c => createCoin(c.x, c.y, c.z));
    if (data.enemies) data.enemies.forEach(e => createEnemy(e.x, e.y, e.z));

    const tower = new THREE.Mesh(new THREE.BoxGeometry(6, 12, 6), new THREE.MeshStandardMaterial({ color: 0x888888 }));
    tower.position.set(0, 6, CASTLE_Z);
    scene.add(tower);
}

// --- OBJECT CREATORS ---

function createPlat(x, y, z, w, h, d) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: 0xdddddd }));
    mesh.position.set(x, y, z);
    mesh.userData = { w, h, d };
    scene.add(mesh);
    platforms.push(mesh);
}

function createCoin(x, y, z) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.1), new THREE.MeshPhongMaterial({ color: 0xffd700 }));
    mesh.position.set(x, y, z);
    mesh.rotation.x = Math.PI / 2;
    scene.add(mesh);
    coins.push(mesh);
}

function createEnemy(x, y, z) {
    const tex = textureLoader.load('enemy.png');
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 2.75), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }));
    mesh.position.set(x, y, z);
    scene.add(mesh);
    enemies.push(mesh);
}

// --- MULTIPLAYER CORE ---

function listenToPlayers() {
    const playersRef = collection(db, "players");

    ui.peers.innerText = "1";

    onSnapshot(playersRef, (snap) => {
        const now = Date.now();
        snap.forEach(docSnap => {
            const id = docSnap.id;
            if (id === userId) return;
            const data = docSnap.data();

            if (!otherPlayers[id]) {
                const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshStandardMaterial({ color: 0xff0000 }));
                scene.add(mesh);
                const label = createNameLabel(data.name || "Onbekend");
                scene.add(label);
                otherPlayers[id] = { mesh, label, lastSeen: now };
            }

            otherPlayers[id].lastSeen = now;
            otherPlayers[id].mesh.position.lerp(new THREE.Vector3(data.x, data.y, data.z), 0.3);
            otherPlayers[id].mesh.rotation.y = data.rot;
            otherPlayers[id].label.position.copy(otherPlayers[id].mesh.position).add(new THREE.Vector3(0, 2.5, 0));
        });

        ui.peers.innerText = Object.keys(otherPlayers).length + 1;
    }, (error) => {
        console.error("Snapshot error:", error);
        ui.status.innerHTML = "❌ <strong>Database Toegang Geweigerd!</strong><br><small>Je regels staan waarschijnlijk te streng.</small>";
        ui.status.className = "bg-red-600 text-white p-3 rounded mb-4 font-bold border-4 border-red-800";
    });

    setInterval(() => {
        const now = Date.now();
        for (const [id, player] of Object.entries(otherPlayers)) {
            if (now - player.lastSeen > 10000) {
                scene.remove(player.mesh);
                scene.remove(player.label);
                delete otherPlayers[id];
                ui.peers.innerText = Object.keys(otherPlayers).length + 1;
            }
        }
    }, 2000);
}

function startBroadcasting() {
    let lastSent = 0;
    let lastPos = new THREE.Vector3();

    setInterval(() => {
        if (gameState === 'playing' && auth.currentUser && auth.currentUser.uid) {
            const now = Date.now();
            const dist = player.position.distanceTo(lastPos);

            if (now - lastSent > 100 && (dist > 0.05 || now - lastSent > 2000)) {
                setDoc(doc(db, "players", userId), {
                    name: myName,
                    x: player.position.x,
                    y: player.position.y,
                    z: player.position.z,
                    rot: player.rotation.y,
                    lastUpdate: now
                }).catch(e => {
                    console.error("Kan positie niet sturen:", e);
                });
                lastSent = now;
                lastPos.copy(player.position);
            }
        }
    }, 100);

    window.addEventListener('beforeunload', () => deleteDoc(doc(db, "players", userId)));
}

function createNameLabel(name) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 256; canvas.height = 64;
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, 256, 64);
    ctx.font = "Bold 32px Arial";
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.fillText(name, 128, 42);
    const tex = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }));
    sprite.scale.set(4, 1, 1);
    return sprite;
}

// --- GAMEPLAY FUNCTIES ---

function activateWeed() {
    if (gameState !== 'playing' || coinsCollected < 1 || isTripping) return;
    coinsCollected--;
    ui.coins.innerText = coinsCollected;

    isTripping = true;
    document.body.classList.add('tripping');
    targetGravity = TRIP_GRAVITY;

    clearTimeout(tripTimer);
    tripTimer = setTimeout(() => {
        isTripping = false;
        document.body.classList.remove('tripping');
        targetGravity = BASE_GRAVITY;
    }, BUFF_DURATION);
}

function endGame(reason, won = false) {
    gameState = 'ended';
    document.exitPointerLock();
    ui.goReason.innerText = reason;

    ui.goReason.style.color = won ? '#00ff00' : '#ff0000';

    ui.gameOver.classList.add('active');
}

// --- GAME LOOP ---
function animate() {
    requestAnimationFrame(animate);
    const delta = 0.016;

    // Update animations
    if (mixer) mixer.update(delta);

    if (gameState === 'playing') {
        currentGravity = THREE.MathUtils.lerp(currentGravity, targetGravity, delta * 2);
        scene.fog.color.lerp(isTripping ? tripFog : baseFog, delta * 2);
        scene.background.lerp(isTripping ? tripBg : baseBg, delta * 2);

        velocity.y -= currentGravity * delta;
        velocity.x -= velocity.x * 10 * delta;
        velocity.z -= velocity.z * 10 * delta;

        const fwd = new THREE.Vector3(0, 0, -1).applyEuler(player.rotation);
        const right = new THREE.Vector3(1, 0, 0).applyEuler(player.rotation);

        const isMoving = moveF || moveB || moveL || moveR;

        if (moveF) velocity.add(fwd.clone().multiplyScalar(MOVE_SPEED * delta * 10));
        if (moveB) velocity.add(fwd.clone().multiplyScalar(-MOVE_SPEED * delta * 10));
        if (moveL) velocity.add(right.clone().multiplyScalar(-MOVE_SPEED * delta * 10));
        if (moveR) velocity.add(right.clone().multiplyScalar(MOVE_SPEED * delta * 10));

        player.position.add(velocity.clone().multiplyScalar(delta));

        // Animation state machine
        if (!canJump && Math.abs(velocity.y) > 1) {
            playAnimation('jump');
        } else if (isMoving && canJump) {
            playAnimation('run');
        } else if (canJump) {
            playAnimation('idle');
        }

        // FALL CHECK
        if (player.position.y < -30) {
            endGame("Je bent in de afgrond gevallen!", false);
        }

        // PLATFORM COLLISIONS
        platforms.forEach(p => {
            if (Math.abs(player.position.x - p.position.x) < p.userData.w / 2 + 0.4 &&
                Math.abs(player.position.z - p.position.z) < p.userData.d / 2 + 0.4) {

                if (player.position.y > p.position.y && player.position.y < p.position.y + 3 && velocity.y <= 0) {
                    player.position.y = p.position.y + p.userData.h / 2 + 1.01;
                    velocity.y = 0;
                    canJump = true;
                }
            }
        });

        // WIN CHECK
        if (player.position.z <= CASTLE_Z + 5 &&
            Math.abs(player.position.x) < 10 &&
            player.position.y <= 12) {
            if (gameState !== 'ended') {
                endGame("Je hebt het kasteel bereikt! Je wint!", true);
            }
        }

        // COIN PICKUP
        for (let i = coins.length - 1; i >= 0; i--) {
            if (player.position.distanceTo(coins[i].position) < 1.5) {
                scene.remove(coins[i]);
                coins.splice(i, 1);
                coinsCollected++;
                ui.coins.innerText = coinsCollected;
            }
        }

        // ENEMIES LOOK AT PLAYER
        enemies.forEach(e => e.lookAt(player.position.x, e.position.y, player.position.z));

        // ENEMY COLLISIONS
        for (let i = enemies.length - 1; i >= 0; i--) {
            if (player.position.distanceTo(enemies[i].position) < 2.0) {
                velocity.y = 10; velocity.z += 10;
                if (coinsCollected > 0) {
                    coinsCollected = Math.max(0, coinsCollected - 3);
                    ui.coins.innerText = coinsCollected;
                } else {
                    endGame("Gepakt door een vijand!", false);
                }
            }
        }

        // PROJECTILES
        for (let i = projectiles.length - 1; i >= 0; i--) {
            const p = projectiles[i];
            p.mesh.position.add(p.velocity.clone().multiplyScalar(delta));
            p.life -= delta;

            let hit = false;
            for (let j = enemies.length - 1; j >= 0; j--) {
                if (p.mesh.position.distanceTo(enemies[j].position) < 2.0) {
                    scene.remove(enemies[j]);
                    enemies.splice(j, 1);
                    hit = true;
                    break;
                }
            }

            if (hit || p.life <= 0) {
                scene.remove(p.mesh);
                projectiles.splice(i, 1);
            }
        }

        camera.position.lerp(player.position.clone().add(new THREE.Vector3(0, 4, 8).applyEuler(player.rotation)), 0.1);
        camera.lookAt(player.position.clone().add(new THREE.Vector3(0, 2, 0)));
    }
    renderer.render(scene, camera);
}

function setupInputs() {
    ui.btn.addEventListener('click', async () => {
        const inputName = ui.nameInput.value.trim();
        if (inputName) myName = inputName;
        ui.nameDisplay.innerText = myName;

        if (isMultiplayer) {
            await setDoc(doc(db, "players", userId), {
                name: myName,
                x: player.position.x,
                y: player.position.y,
                z: player.position.z,
                rot: player.rotation.y,
                lastUpdate: Date.now()
            }).catch(e => {
                console.error("Fout bij initiële positie zenden:", e);
            });

            startBroadcasting();
        }

        await syncAndBuildWorld();

        ui.start.classList.remove('active');
        document.body.requestPointerLock();
        gameState = 'playing';
    });

    ui.resumeBtn.addEventListener('click', () => {
        document.body.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
        if (document.pointerLockElement === document.body) {
            gameState = 'playing';
            ui.pauseScreen.classList.remove('active');
        } else {
            if (gameState === 'playing' && gameState !== 'ended') {
                gameState = 'paused';
                ui.pauseScreen.classList.add('active');
            }
        }
    });

    document.addEventListener('keydown', e => {
        if (e.code === 'KeyW') moveF = true;
        if (e.code === 'KeyS') moveB = true;
        if (e.code === 'KeyA') moveL = true;
        if (e.code === 'KeyD') moveR = true;
        if (e.code === 'Space') {
            velocity.y = JUMP_SPEED;
        }
        if (e.code === 'Enter') activateWeed();
    });
    document.addEventListener('keyup', e => {
        if (e.code === 'KeyW') moveF = false;
        if (e.code === 'KeyS') moveB = false;
        if (e.code === 'KeyA') moveL = false;
        if (e.code === 'KeyD') moveR = false;
    });
    document.addEventListener('mousemove', e => {
        if (gameState === 'playing') player.rotation.y -= e.movementX * 0.002;
    });
    document.addEventListener('mousedown', () => {
        if (gameState === 'playing') {
            const ball = new THREE.Mesh(new THREE.SphereGeometry(0.2), new THREE.MeshBasicMaterial({ color: 0x00ffff }));
            ball.position.copy(player.position).add(new THREE.Vector3(0, 1.5, 0));
            scene.add(ball);
            let dir = new THREE.Vector3();
            camera.getWorldDirection(dir);
            projectiles.push({ mesh: ball, velocity: dir.multiplyScalar(30), life: 2.0 });
        }
    });
}