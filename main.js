import * as THREE from 'three';
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, onSnapshot, collection, deleteDoc } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

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
                
                // Meteen luisteren (ook in menu)
                listenToPlayers();
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

    setupInputs();
    
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth/window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    animate();
}

// --- WERELD SYNC LOGICA ---

async function syncAndBuildWorld() {
    ui.status.innerText = "Wereld