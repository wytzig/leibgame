import * as THREE from 'three';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/jsm/loaders/GLTFLoader.js';
import { initFirebase, db, auth } from './firebase.js';
import { listenToPlayers, startBroadcasting } from './multiplayer.js';
import { getDoc, setDoc, doc } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { syncAndBuildWorld } from './world.js';
import { MobileControls } from './mobile-controls.js';

let selectedModelFile = '/assets/leib.glb'; // default

// Instellingen
const BASE_GRAVITY = 30.0;
const TRIP_GRAVITY = 10.0;
const JUMP_SPEED = 15.0;
const MOVE_SPEED = 12.0;
const CASTLE_Z = -300;
const BUFF_DURATION = 8000;

// Globals
let userId, myName = "Speler", isMultiplayer = false;
let camera, scene, renderer, player, playerModel, mixer, animations = {};
let velocity = new THREE.Vector3();
let platforms = [], coins = [], enemies = [], otherPlayers = {}, projectiles = [];
let gameState = 'start', coinsCollected = 0;
let moveF = false, moveB = false, moveL = false, moveR = false;
let textureLoader;
let currentAction = null;
let modelLoaded = false;
let platformTexture = null;
let mobile = null // mobile support

const MODEL_SCALES = {
    'option2.glb': 0.45,
    'medieval_luuk.glb': 1.3,
    'leib.glb': 1.3,
};

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

function handleMobileControls(mobile) {
    mobile.onJump = () => {
        velocity.y = JUMP_SPEED;
        isGrounded = false;
    };

    mobile.onShoot = () => {
        // Your existing projectile code:
        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.2), new THREE.MeshBasicMaterial({ color: 0x00ffff }));
        ball.position.copy(player.position).add(new THREE.Vector3(0, 1.5, 0));
        scene.add(ball);
        let dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        projectiles.push({ mesh: ball, velocity: dir.multiplyScalar(30), life: 2.0 });
    };

    mobile.onAbility = () => {
        activateWeed();
    };
}

window.onload = async () => {
    // Start Three.js eerst om visuele feedback te geven
    initThreeJS();
    mobile = new MobileControls();
    handleMobileControls(mobile)

    try {
        updateStatus("firebase", "🔌 Verbinding maken...", "blue");

        const firebaseGlobals = initFirebase((user) => {
            userId = user.uid;
            isMultiplayer = true;
            console.log("Firebase connected! User ID:", userId);
            updateStatus("firebase", "✅ Multiplayer verbonden!", "green");
            checkIfReadyToStart();

            listenToPlayers(scene, userId, ui, db);
        });
    } catch (e) {
        console.error("Firebase init error:", e);
        updateStatus("firebase", "⚠️ Offline Modus (Config Fout)", "yellow");
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
    const ambient = new THREE.AmbientLight(0xffffff, 0.25);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(50, 100, 50);
    dirLight.castShadow = true;
    scene.add(dirLight);
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.3);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    textureLoader = new THREE.TextureLoader();

    // Ensure correct color encoding for accurate look
    // (important when renderer.outputEncoding isn't the default)
    renderer.outputEncoding = THREE.sRGBEncoding;

    // Load platform texture and update existing platforms when ready
    platformTexture = textureLoader.load(
        "hava.png",
        // onLoad
        (tex) => {
            // correct encoding so colors/light appear right
            tex.encoding = THREE.sRGBEncoding;

            // make it tileable
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(2, 2);

            // If platforms were already created with fallback materials, replace their maps now
            platforms.forEach((p) => {
                if (p && p.material) {
                    // use a cloned texture so per-platform tiling can be adjusted independently
                    const cloned = tex.clone();
                    // default tiling relative to platform size
                    cloned.repeat.set((p.userData.w || 1) / 2, (p.userData.d || 1) / 2);
                    cloned.needsUpdate = true;

                    p.material.map = cloned;
                    // keep white base under transparent PNG
                    p.material.color = new THREE.Color(0xffffff);
                    p.material.transparent = true;
                    p.material.alphaTest = 0.1;
                    p.material.needsUpdate = true;
                }
            });

            console.log("Platform texture loaded and applied to existing platforms.");
        },
        // onProgress (optional)
        undefined,
        // onError
        (err) => {
            console.warn("Failed to load platform texture hava.png", err);
        }
    );

    // Speler Container (voor collisie detectie)
    player = new THREE.Object3D();
    player.position.set(0, 5, 0);

    scene.add(player);

    // Laad het GLB model
    loadPlayerModel(selectedModelFile);

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
    keyLight.intensity = 1.2;
    player.add(keyLight);

    // Fill light (van de andere kant, zachter)
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
    fillLight.position.set(-5, 5, 5);
    fillLight.intensity = 0.4;
    player.add(fillLight);

    // Back light / rim light (achter speler, voor contouren)
    const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
    backLight.position.set(0, 5, -5);
    backLight.intensity = 0.4;
    player.add(backLight);

    // Optioneel: klein puntlicht vlakbij het model voor highlights
    const pointLight = new THREE.PointLight(0xffffff, 0.5, 10);
    pointLight.position.set(0, 3, 0);
    pointLight.intensity = 1;
    player.add(pointLight);
}

function loadPlayerModel(model) {
    const loader = new GLTFLoader();

    // --- CONFIGURATIE ANIMATIES PER MODEL ---
    // Hier koppel je de bestandsnaam aan de juiste animatie-indexen
    const ANIMATION_MAPPING = {
        'option2.glb': { idle: 10, run: 0, jump: 9 },
        'medieval_luuk.glb': { idle: 5, run: 2, jump: 0 },
        'leib.glb': { idle: 7, run: 2, jump: 6 }
    };
    // -----------------------------------------

    console.log("Starting to load model...", model);
    updateStatus("model", "🎮 Model laden... 0%", "purple");

    loader.load(model,
        (gltf) => {
            console.log("Model loaded successfully!", gltf);
            playerModel = gltf.scene;

            // Use per-model scale
            const scale = MODEL_SCALES[model] || MODEL_SCALES['default'];
            playerModel.scale.set(scale, scale, scale);

            // Rotate the model so it faces forward
            playerModel.rotation.y = Math.PI;
            playerModel.position.y = -1.1;

            // Add model to the player container
            player.add(playerModel);

            // --- ANIMATION SETUP START ---
            if (gltf.animations && gltf.animations.length > 0) {
                console.log("Animations found in GLB:", gltf.animations.map((a, i) => `${i}: ${a.name}`));

                // Create a mixer for this model
                mixer = new THREE.AnimationMixer(playerModel);

                // 1. Haal de juiste mapping op. Als het model niet in de lijst staat, pakken we 'option2.glb' als standaard.
                const mapping = ANIMATION_MAPPING[model] || ANIMATION_MAPPING['option2.glb'];
                console.log(`Gebruikte animatie-indexen voor ${model}:`, mapping);

                // 2. Pas de indexen toe
                // We gebruiken (|| gltf.animations[0]) als veiligheid voor als een nummer niet bestaat
                animations = {
                    idle: mixer.clipAction(gltf.animations[mapping.idle] || gltf.animations[0]),
                    run: mixer.clipAction(gltf.animations[mapping.run] || gltf.animations[0]),
                    jump: mixer.clipAction(gltf.animations[mapping.jump] || gltf.animations[0])
                };

                // Set looping for animations
                for (const action of Object.values(animations)) {
                    action.setLoop(THREE.LoopRepeat);
                    action.clampWhenFinished = true;
                }

                // Play idle by default
                playAnimation('idle');

            } else {
                console.warn("No animations found in this GLB file.");
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

            // Fallback: simple box model
            const fallbackGeo = new THREE.BoxGeometry(1, 2, 1);
            const fallbackMat = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
            playerModel = new THREE.Mesh(fallbackGeo, fallbackMat);
            player.add(playerModel);
            addPlayerLights();

            playerModel.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    if (child.material) child.material.needsUpdate = true;
                }
            });

            modelLoaded = true;
            checkIfReadyToStart();
        }
    );
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
    if (!mixer || !animations[name]) return;

    // Als we deze animatie al afspelen, doe niets (behalve als het jump is, die mag soms resetten)
    if (currentAction === animations[name] && name !== 'jump') return;

    console.log(`%c 🎬 Schakelen naar animatie: ${name}`, 'color: yellow; font-weight: bold;');

    const nextAction = animations[name];

    if (currentAction) {
        // Fade out de vorige
        currentAction.fadeOut(0.2);
    }

    // Reset, fade in en speel de nieuwe
    nextAction.reset().fadeIn(0.2).play();
    currentAction = nextAction;
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

function updateAnimation(isMoving) {
    if (!isGrounded) {
        if (currentAnimation !== 'jump') {
            playAnimation('jump');
            currentAnimation = 'jump';
        }
    } else if (isMoving) {
        if (currentAnimation !== 'run') {
            playAnimation('run');
            currentAnimation = 'run';
        }
    } else {
        if (currentAnimation !== 'idle') {
            playAnimation('idle');
            currentAnimation = 'idle';
        }
    }
}

// --- GAME LOOP ---
let currentAnimation = '';
let isGrounded = false;

function animate() {
    requestAnimationFrame(animate);
    const now = Date.now();
    const delta = 0.016;

    // Update animations
    if (mixer) mixer.update(delta);

    if (gameState === 'playing') {

        // desktop controls 
        currentGravity = THREE.MathUtils.lerp(currentGravity, targetGravity, delta * 2);
        scene.fog.color.lerp(isTripping ? tripFog : baseFog, delta * 2);
        scene.background.lerp(isTripping ? tripBg : baseBg, delta * 2);

        velocity.y -= currentGravity * delta;
        velocity.x -= velocity.x * 10 * delta;
        velocity.z -= velocity.z * 10 * delta;

        const fwd = new THREE.Vector3(0, 0, -1).applyEuler(player.rotation);
        const right = new THREE.Vector3(1, 0, 0).applyEuler(player.rotation);


        // mobile controls
        if (mobile.enabled) {
            const m = mobile.update();

            if (m.forward) velocity.add(fwd.clone().multiplyScalar(MOVE_SPEED * delta * 10 * m.forward));
            if (m.backward) velocity.add(fwd.clone().multiplyScalar(-MOVE_SPEED * delta * 10 * m.backward));
            if (m.left) velocity.add(right.clone().multiplyScalar(-MOVE_SPEED * delta * 10 * m.left));
            if (m.right) velocity.add(right.clone().multiplyScalar(MOVE_SPEED * delta * 10 * m.right));

            // Horizontal rotation
            player.rotation.y -= m.look;

            // **Vertical rotation**
            camera.rotation.x = THREE.MathUtils.clamp(
                camera.rotation.x - m.lookUpDown,
                -Math.PI / 4,
                Math.PI / 4
            );
        }


        const isMoving = moveF || moveB || moveL || moveR;

        if (moveF) velocity.add(fwd.clone().multiplyScalar(MOVE_SPEED * delta * 10));
        if (moveB) velocity.add(fwd.clone().multiplyScalar(-MOVE_SPEED * delta * 10));
        if (moveL) velocity.add(right.clone().multiplyScalar(-MOVE_SPEED * delta * 10));
        if (moveR) velocity.add(right.clone().multiplyScalar(MOVE_SPEED * delta * 10));

        player.position.add(velocity.clone().multiplyScalar(delta));

        updateAnimation(isMoving);

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
                    isGrounded = true;
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
    // Character selection buttons
    const charButtons = document.querySelectorAll('.char-btn');
    charButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update selected model
            selectedModelFile = btn.dataset.model;

            // Remove previous model
            if (playerModel) {
                player.remove(playerModel);
                playerModel.traverse(child => {
                    if (child.isMesh) child.geometry.dispose();
                    if (child.material) child.material.dispose();
                });
            }

            // Load the new model
            loadPlayerModel(selectedModelFile);

            // Highlight selected button
            charButtons.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        });
    });
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

            startBroadcasting(player, userId, myName, gameState, db, auth);
        }

        await syncAndBuildWorld(scene, ui, platforms, coins, enemies, projectiles, isMultiplayer, db, CASTLE_Z, platformTexture, textureLoader);

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
            isGrounded = false; // you just left ground
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
    document.querySelectorAll('.char-preview').forEach((el, i) => {
        el.addEventListener('click', () => {
            selectedModelFile = el.dataset.model;

            // Remove old player model
            if (playerModel) {
                player.remove(playerModel);
                playerModel.traverse(child => {
                    if (child.isMesh) child.geometry.dispose();
                    if (child.material) child.material.dispose();
                });
            }

            loadPlayerModel(selectedModelFile);

            // Highlight selected preview
            document.querySelectorAll('.char-preview').forEach(e => e.classList.remove('selected'));
            el.classList.add('selected');
        });
    });
    document.querySelectorAll('.char-preview').forEach(el => {
        loadPreviewModel(el, el.dataset.model);
    });
}

function loadPreviewModel(el, modelFile) {
    // Clean old
    if (el.previewRenderer) el.removeChild(el.previewRenderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, el.clientWidth / el.clientHeight, 0.1, 100);
    camera.position.set(0, 1.5, 3);
    camera.lookAt(0, 1, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(el.clientWidth, el.clientHeight);
    el.appendChild(renderer.domElement);

    const light = new THREE.DirectionalLight(0xffffff, 2.2);
    light.position.set(5, 10, 5);
    scene.add(light);
    const fill = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(fill);

    const loader = new GLTFLoader();
    loader.load(modelFile, (gltf) => {
        const container = new THREE.Object3D();
        container.add(gltf.scene);

        const scale = MODEL_SCALES[modelFile] || MODEL_SCALES['default'];
        container.scale.set(scale, scale, scale);
        container.rotation.y = Math.PI;
        scene.add(container);

        // store for animation
        el.previewRenderer = renderer;
        el.previewModel = container;
        el.previewScene = scene;
        el.previewCamera = camera;

        animatePreview(el);
    });
}
function animatePreview(el) {
    if (!el.previewModel) return;
    el.previewModel.rotation.y += 0.01;
    el.previewRenderer.render(el.previewScene, el.previewCamera);
    requestAnimationFrame(() => animatePreview(el));
}