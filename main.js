import * as THREE from 'three';
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot, collection, deleteDoc } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

// ==================================================================
// JOUW FIREBASE CONFIG (Uit de screenshot)
// ==================================================================
const firebaseConfig = {
  apiKey: "AIzaSyBflwkHnZtXhlcOEhXutGd-tWriWvadqGU",
  authDomain: "leibgame-c7d34.firebaseapp.com",
  projectId: "leibgame-c7d34",
  storageBucket: "leibgame-c7d34.firebasestorage.app",
  messagingSenderId: "118964504250",
  appId: "1:118964504250:web:63e25bb0512060acb82483"
};
// ==================================================================

// Settings
const GRAVITY = 30.0, JUMP = 15.0, SPEED = 12.0, CASTLE_Z = -300;
let app, auth, db, userId, myName = "Speler";
let isMultiplayer = false; 

// Globals
let camera, scene, renderer, player, velocity = new THREE.Vector3();
let platforms = [], coins = [], enemies = [], otherPlayers = {}, projectiles = [];
let gameState = 'start', canJump = false, coinsCollected = 0;
let moveF = false, moveB = false, moveL = false, moveR = false;
let textureLoader;

// UI
const ui = {
    start: document.getElementById('start-screen'),
    status: document.getElementById('auth-status'),
    btn: document.getElementById('start-btn'),
    coins: document.getElementById('coin-display'),
    peers: document.getElementById('peer-count'),
    nameDisplay: document.getElementById('player-name-display'),
    nameInput: document.getElementById('username-input')
};

window.onload = async () => {
    // Multiplayer starten
    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);

        onAuthStateChanged(auth, (user) => {
            if (user) {
                userId = user.uid;
                isMultiplayer = true;
                ui.status.innerText = "✅ Verbonden met Multiplayer!";
                ui.status.className = "bg-green-100 text-green-800 p-3 rounded mb-4";
                enableStart();
            } else {
                signInAnonymously(auth).catch(e => console.error(e));
            }
        });
    } catch (e) {
        console.error(e);
        ui.status.innerText = "Fout bij verbinden. Terugval naar Single Player.";
        isMultiplayer = false;
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
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 10, 90);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(50, 100, 50);
    dirLight.castShadow = true;
    scene.add(dirLight);

    textureLoader = new THREE.TextureLoader();
    
    // Player Model
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

// --- MULTIPLAYER FUNCTIES ---

function startMultiplayer() {
    const playersRef = collection(db, "players");
    
    // Luister naar anderen
    onSnapshot(playersRef, (snap) => {
        let count = 0;
        snap.forEach(docSnap => {
            const id = docSnap.id;
            if(id === userId) return; // Negeer onszelf
            
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
            
            // Positie updaten
            otherPlayers[id].mesh.position.lerp(new THREE.Vector3(data.x, data.y, data.z), 0.3);
            otherPlayers[id].mesh.rotation.y = data.rot;
            otherPlayers[id].label.position.copy(otherPlayers[id].mesh.position).add(new THREE.Vector3(0, 2.5, 0));
        });
        ui.peers.innerText = count;
    });

    // Stuur eigen data
    setInterval(() => {
        if(gameState === 'playing') {
            setDoc(doc(db, "players", userId), {
                name: myName,
                x: player.position.x, 
                y: player.position.y, 
                z: player.position.z,
                rot: player.rotation.y, 
                lastUpdate: Date.now()
            });
        }
    }, 100);

    // Opruimen
    window.addEventListener('beforeunload', () => deleteDoc(doc(db, "players", userId)));
}

function createNameLabel(name) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 256; 
    canvas.height = 64;
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

// --- GAME LOOP ---
function animate() {
    requestAnimationFrame(animate);
    const delta = 0.016; 

    if(gameState === 'playing') {
        velocity.y -= GRAVITY * delta;
        velocity.x -= velocity.x * 10 * delta;
        velocity.z -= velocity.z * 10 * delta;

        const fwd = new THREE.Vector3(0,0,-1).applyEuler(player.rotation);
        const right = new THREE.Vector3(1,0,0).applyEuler(player.rotation);

        if(moveF) velocity.add(fwd.multiplyScalar(SPEED * delta * 10));
        if(moveB) velocity.add(fwd.multiplyScalar(-SPEED * delta * 10));
        if(moveL) velocity.add(right.multiplyScalar(-SPEED * delta * 10));
        if(moveR) velocity.add(right.multiplyScalar(SPEED * delta * 10));

        player.position.add(velocity.clone().multiplyScalar(delta));

        if(player.position.y < -30) location.reload();

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

        camera.position.lerp(player.position.clone().add(new THREE.Vector3(0,4,8).applyEuler(player.rotation)), 0.1);
        camera.lookAt(player.position.clone().add(new THREE.Vector3(0,2,0)));

        enemies.forEach(e => e.lookAt(player.position.x, e.position.y, player.position.z));
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
        gameState = 'playing';
    });
    
    document.addEventListener('keydown', e => {
        if(e.code === 'KeyW') moveF = true;
        if(e.code === 'KeyS') moveB = true;
        if(e.code === 'KeyA') moveL = true;
        if(e.code === 'KeyD') moveR = true;
        if(e.code === 'Space' && canJump) { velocity.y = JUMP; canJump = false; }
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
            const iv = setInterval(() => {
                ball.position.add(dir);
                if(ball.position.distanceTo(player.position) > 50) { scene.remove(ball); clearInterval(iv); }
            }, 16);
        }
    });
}