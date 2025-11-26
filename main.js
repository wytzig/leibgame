import * as THREE from 'three';
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot, collection, deleteDoc } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

// ==================================================================
// JOUW FIREBASE CONFIG
// ==================================================================
const firebaseConfig = {
  apiKey: "AIzaSyBflwkHnZtXhlcOEhXutGd-tWriWvadqGU",
  authDomain: "leibgame-c7d34.firebaseapp.com",
  projectId: "leibgame-c7d34",
  storageBucket: "leibgame-c7d34.firebasestorage.app",
  messagingSenderId: "118964504250",
  appId: "1:118964504250:web:63e25bb0512060acb82483"
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
let camera, scene, renderer, player;
let velocity = new THREE.Vector3();
let platforms = [], coins = [], enemies = [], otherPlayers = {}, projectiles = [];
let gameState = 'start', canJump = false, coinsCollected = 0;
let moveF = false, moveB = false, moveL = false, moveR = false;
let textureLoader;

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
    coins: document.getElementById('coin-display'),
    peers: document.getElementById('peer-count'),
    nameDisplay: document.getElementById('player-name-display'),
    nameInput: document.getElementById('username-input'),
    gameOver: document.getElementById('game-over-screen'),
    goReason: document.getElementById('go-reason')
};

window.onload = async () => {
    // Multiplayer Starten
    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);

        onAuthStateChanged(auth, (user) => {
            if (user) {
                userId = user.uid;
                isMultiplayer = true;
                ui.status.innerText = "✅ Verbonden met Multiplayer!";
                ui.status.className = "bg-green-100 text-green-800 p-3 rounded mb-4 border border-green-400";
                ui.btn.disabled = false;
                ui.btn.classList.remove('opacity-50', 'cursor-not-allowed');
            } else {
                signInAnonymously(auth).catch(console.error);
            }
        });
    } catch (e) {
        console.error(e);
        ui.status.innerText = "Offline Modus (Config Fout)";
        enableStart();
    }

    initThreeJS();
};

function enableStart() {
    ui.btn.disabled = false;
    ui.btn.classList.remove('opacity-50', 'cursor-not-allowed');
}

function initThreeJS() {
    scene = new THREE.Scene();
    scene.background = baseBg.clone();
    scene.fog = new THREE.Fog(baseFog.clone(), 10, 90);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Licht
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(50, 100, 50);
    dirLight.castShadow = true;
    scene.add(dirLight);

    textureLoader = new THREE.TextureLoader();
    
    // Speler
    const pGeo = new THREE.BoxGeometry(1, 2, 1);
    const pMat = new THREE.MeshStandardMaterial({ map: textureLoader.load('leib.png') });
    player = new THREE.Mesh(pGeo, pMat);
    player.position.set(0, 5, 0);
    scene.add(player);

    setupWorld();
    setupInputs();
    
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth/window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    animate();
}

function setupWorld() {
    // Maak alles leeg bij reset
    platforms.forEach(p => scene.remove(p)); platforms = [];
    coins.forEach(c => scene.remove(c)); coins = [];
    enemies.forEach(e => scene.remove(e)); enemies = [];
    projectiles.forEach(p => scene.remove(p.mesh)); projectiles = [];

    // Wereld genereren
    createPlat(0, -2, 0, 10, 2, 10);
    let z = -10;
    while(z > CASTLE_Z + 20) {
        let x = (Math.random() - 0.5) * 30;
        let y = (Math.random() - 0.5) * 6;
        let w = 3 + Math.random() * 5;
        createPlat(x, y, z, w, 1 + Math.random()*2, 3 + Math.random()*5);
        
        if(Math.random() > 0.4) createCoin(x, y+2, z);
        if(Math.random() > 0.7) createEnemy(x, y+3, z);
        z -= (4 + Math.random() * 4);
    }
    createPlat(0, 0, CASTLE_Z, 20, 2, 20); 
    
    // Kasteel
    const tower = new THREE.Mesh(new THREE.BoxGeometry(6,12,6), new THREE.MeshStandardMaterial({color:0x888888}));
    tower.position.set(0, 6, CASTLE_Z);
    scene.add(tower);
}

function createPlat(x,y,z,w,h,d) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), new THREE.MeshLambertMaterial({color: 0xdddddd}));
    mesh.position.set(x,y,z);
    mesh.userData = { w, h, d };
    scene.add(mesh);
    platforms.push(mesh);
}

function createCoin(x,y,z) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.5,0.1), new THREE.MeshPhongMaterial({color:0xffd700}));
    mesh.position.set(x,y,z);
    mesh.rotation.x = Math.PI/2;
    scene.add(mesh);
    coins.push(mesh);
}

function createEnemy(x,y,z) {
    const tex = textureLoader.load('enemy.png');
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 2.75), new THREE.MeshBasicMaterial({map:tex, transparent:true, side:THREE.DoubleSide}));
    mesh.position.set(x,y,z);
    scene.add(mesh);
    enemies.push(mesh);
}

// --- MULTIPLAYER ---
function startMultiplayer() {
    const playersRef = collection(db, "players");
    
    // 1. Luister naar anderen
    onSnapshot(playersRef, (snap) => {
        let count = 0;
        snap.forEach(docSnap => {
            const id = docSnap.id;
            if(id === userId) return;
            const data = docSnap.data();
            
            // Timeout check (10s)
            if(Date.now() - data.lastUpdate > 10000) {
                if(otherPlayers[id]) { 
                    scene.remove(otherPlayers[id].mesh); 
                    scene.remove(otherPlayers[id].label);
                    delete otherPlayers[id]; 
                }
                return;
            }

            count++;
            if(!otherPlayers[id]) {
                const mesh = new THREE.Mesh(new THREE.BoxGeometry(1,2,1), new THREE.MeshStandardMaterial({color: 0xff0000}));
                scene.add(mesh);
                const label = createNameLabel(data.name || "Onbekend");
                scene.add(label);
                otherPlayers[id] = { mesh, label };
            }
            
            otherPlayers[id].mesh.position.lerp(new THREE.Vector3(data.x, data.y, data.z), 0.3);
            otherPlayers[id].mesh.rotation.y = data.rot;
            otherPlayers[id].label.position.copy(otherPlayers[id].mesh.position).add(new THREE.Vector3(0, 2.5, 0));
        });
        ui.peers.innerText = count;
    });

    // 2. Eigen data sturen (GEOPTIMALISEERD)
    // We sturen alleen als we bewogen hebben, en max elke 250ms (4x per sec)
    let lastSent = 0;
    let lastPos = new THREE.Vector3();
    
    setInterval(() => {
        if(gameState === 'playing' && isAuth) {
            const now = Date.now();
            const dist = player.position.distanceTo(lastPos);
            
            // Stuur update als: 250ms voorbij is EN (speler heeft >0.1 bewogen OF tijd > 2000ms voor heartbeat)
            if (now - lastSent > 250 && (dist > 0.1 || now - lastSent > 2000)) {
                setDoc(doc(db, "players", userId), {
                    name: myName,
                    x: player.position.x, 
                    y: player.position.y, 
                    z: player.position.z,
                    rot: player.rotation.y, 
                    lastUpdate: now
                });
                lastSent = now;
                lastPos.copy(player.position);
            }
        }
    }, 250); // Check interval

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
    targetGravity = TRIP_GRAVITY; // Minder zwaartekracht!
    
    clearTimeout(tripTimer);
    tripTimer = setTimeout(() => {
        isTripping = false;
        document.body.classList.remove('tripping');
        targetGravity = BASE_GRAVITY;
    }, BUFF_DURATION);
}

function endGame(reason) {
    gameState = 'ended';
    document.exitPointerLock();
    ui.goReason.innerText = reason;
    ui.gameOver.classList.add('active');
}

// --- GAME LOOP ---
function animate() {
    requestAnimationFrame(animate);
    const delta = 0.016; 

    if(gameState === 'playing') {
        // 1. Zwaartekracht & Trip Effecten
        currentGravity = THREE.MathUtils.lerp(currentGravity, targetGravity, delta * 2);
        
        // Visuele overgang
        scene.fog.color.lerp(isTripping ? tripFog : baseFog, delta * 2);
        scene.background.lerp(isTripping ? tripBg : baseBg, delta * 2);

        // 2. Physics
        velocity.y -= currentGravity * delta;
        velocity.x -= velocity.x * 10 * delta;
        velocity.z -= velocity.z * 10 * delta;

        // FIX: Gebruik hier MOVE_SPEED en .clone() om mutatie te voorkomen
        const fwd = new THREE.Vector3(0,0,-1).applyEuler(player.rotation);
        const right = new THREE.Vector3(1,0,0).applyEuler(player.rotation);

        if(moveF) velocity.add(fwd.clone().multiplyScalar(MOVE_SPEED * delta * 10));
        if(moveB) velocity.add(fwd.clone().multiplyScalar(-MOVE_SPEED * delta * 10));
        if(moveL) velocity.add(right.clone().multiplyScalar(-MOVE_SPEED * delta * 10));
        if(moveR) velocity.add(right.clone().multiplyScalar(MOVE_SPEED * delta * 10));

        player.position.add(velocity.clone().multiplyScalar(delta));

        // 3. Van de map vallen
        if(player.position.y < -30) {
            endGame("Je bent in de afgrond gevallen!");
        }

        // 4. Platform Collision
        platforms.forEach(p => {
            if(Math.abs(player.position.x - p.position.x) < p.userData.w/2 + 0.4 &&
               Math.abs(player.position.z - p.position.z) < p.userData.d/2 + 0.4) {
                if(player.position.y > p.position.y && player.position.y < p.position.y + 2 && velocity.y <= 0) {
                    player.position.y = p.position.y + 1 + p.userData.h/2;
                    velocity.y = 0;
                    canJump = true;
                }
            }
        });

        // 5. Munten Verzamelen
        for(let i = coins.length - 1; i >= 0; i--) {
            if(player.position.distanceTo(coins[i].position) < 1.5) {
                scene.remove(coins[i]);
                coins.splice(i, 1);
                coinsCollected++;
                ui.coins.innerText = coinsCollected;
            }
        }

        // 6. Vijanden & Projectielen
        // Vijanden draaien naar speler
        enemies.forEach(e => e.lookAt(player.position.x, e.position.y, player.position.z));

        // Check botsing speler <-> vijand
        for(let i = enemies.length - 1; i >= 0; i--) {
            if(player.position.distanceTo(enemies[i].position) < 2.0) {
                // Botsing!
                velocity.y = 10; // Knockback
                velocity.z += 10;
                if(coinsCollected > 0) {
                    coinsCollected = Math.max(0, coinsCollected - 3);
                    ui.coins.innerText = coinsCollected;
                } else {
                    endGame("Gepakt door een vijand!");
                }
            }
        }

        // Projectielen updaten
        for(let i = projectiles.length - 1; i >= 0; i--) {
            const p = projectiles[i];
            p.mesh.position.add(p.velocity.clone().multiplyScalar(delta));
            p.life -= delta;

            // Raakt projectiel een vijand?
            let hit = false;
            for(let j = enemies.length - 1; j >= 0; j--) {
                if(p.mesh.position.distanceTo(enemies[j].position) < 2.0) {
                    scene.remove(enemies[j]);
                    enemies.splice(j, 1);
                    hit = true;
                    break;
                }
            }

            if(hit || p.life <= 0) {
                scene.remove(p.mesh);
                projectiles.splice(i, 1);
            }
        }

        // Camera Volgen
        camera.position.lerp(player.position.clone().add(new THREE.Vector3(0,4,8).applyEuler(player.rotation)), 0.1);
        camera.lookAt(player.position.clone().add(new THREE.Vector3(0,2,0)));
    }
    renderer.render(scene, camera);
}

function setupInputs() {
    ui.btn.addEventListener('click', () => {
        const inputName = ui.nameInput.value.trim();
        if(inputName) myName = inputName;
        ui.nameDisplay.innerText = myName;

        if(isMultiplayer) startMultiplayer();

        ui.start.classList.remove('active');
        document.body.requestPointerLock();
        setupWorld(); // Reset wereld bij start
        gameState = 'playing';
    });
    
    // Voeg Pointer Lock Change listener toe om pauze te detecteren
    document.addEventListener('pointerlockchange', () => {
        if(document.pointerLockElement === document.body) {
            gameState = 'playing';
            // Zorg ervoor dat UI correct is als we terugkeren
        } else {
            // Als we al 'playing' waren en de lock gaat weg, dan pauze
            if(gameState === 'playing' && gameState !== 'ended') {
                gameState = 'paused';
                // Optioneel: toon pauze scherm, maar voor nu is movement stop voldoende
            }
        }
    });
    
    document.addEventListener('keydown', e => {
        if(e.code === 'KeyW') moveF = true;
        if(e.code === 'KeyS') moveB = true;
        if(e.code === 'KeyA') moveL = true;
        if(e.code === 'KeyD') moveR = true;
        if(e.code === 'Space' && canJump) { velocity.y = JUMP_SPEED; canJump = false; }
        if(e.code === 'Enter') activateWeed();
    });
    document.addEventListener('keyup', e => {
        if(e.code === 'KeyW') moveF = false;
        if(e.code === 'KeyS') moveB = false;
        if(e.code === 'KeyA') moveL = false;
        if(e.code === 'KeyD') moveR = false;
    });
    document.addEventListener('mousemove', e => {
        if(gameState === 'playing') player.rotation.y -= e.movementX * 0.002;
    });
    document.addEventListener('mousedown', () => {
        if(gameState === 'playing') {
            const ball = new THREE.Mesh(new THREE.SphereGeometry(0.2), new THREE.MeshBasicMaterial({color:0x00ffff}));
            ball.position.copy(player.position).add(new THREE.Vector3(0,1.5,0));
            scene.add(ball);
            
            let dir = new THREE.Vector3();
            camera.getWorldDirection(dir);
            
            projectiles.push({
                mesh: ball,
                velocity: dir.multiplyScalar(30),
                life: 2.0
            });
        }
    });
}