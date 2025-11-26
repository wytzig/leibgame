import * as THREE from 'three';

// --- CONFIGURATIE ---
const BASE_GRAVITY = 30.0;
const TRIP_GRAVITY = 10.0;
const JUMP_SPEED = 15.0;
const MOVE_SPEED = 12.0; // Iets sneller
const CASTLE_Z = -300; 
const BUFF_DURATION = 8000;
const MIN_COINS_TO_WIN = 10;
// Muziek: Een betrouwbaar bestand (Kevin MacLeod of vergelijkbaar rechtenvrij)
const MUSIC_URL = 'https://cdn.pixabay.com/audio/2022/01/18/audio_d0a13f69d2.mp3'; 

// Vijand Sprite (253px W x 199px H -> Ratio 1.27)
const ENEMY_WIDTH = 3.5;
const ENEMY_HEIGHT = 2.75;
const ENEMY_HIT_RADIUS = 2.5; // Hitbox radius op basis van visuele grootte

// --- GLOBALE VARIABELEN ---
let camera, scene, renderer;
let player, playerVelocity, playerDirection;
let platforms = [];
let coins = [];
let enemies = [];
let projectiles = [];
let particles = [];
let castle;

// Audio
let sound; 

// Game State
let gameState = 'start';
let startTime = 0;
let coinsCollected = 0;

// Trip variabelen
let isTripping = false;
let tripTimer = null;
let currentGravity = BASE_GRAVITY;
let targetGravity = BASE_GRAVITY;

// Kleuren
const baseFogColor = new THREE.Color(0x87CEEB);
const tripFogColor = new THREE.Color(0x00ff00);
const baseBgColor = new THREE.Color(0x87CEEB);
const tripBgColor = new THREE.Color(0x113311);

// Input
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let canJump = false;

// Helpers
let textureLoader; // Nu globaal gedefinieerd voor sprites

// HTML Elementen
const hudTime = document.getElementById('time-display');
const hudCoins = document.getElementById('coin-display');
const statusMsg = document.getElementById('status-msg');
const startScreen = document.getElementById('start-screen');
const pauseScreen = document.getElementById('pause-screen');
const gameOverScreen = document.getElementById('game-over-screen');

init();
animate();

function init() {
    // 1. Scene & Camera
    scene = new THREE.Scene();
    scene.background = baseBgColor.clone();
    scene.fog = new THREE.Fog(baseFogColor.clone(), 10, 90);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    // 2. Audio Setup
    const listener = new THREE.AudioListener();
    camera.add(listener);
    sound = new THREE.Audio(listener);
    
    const audioLoader = new THREE.AudioLoader();
    audioLoader.load(MUSIC_URL, function(buffer) {
        sound.setBuffer(buffer);
        sound.setLoop(true);
        sound.setVolume(0.3);
    });

    // 3. Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    // 4. Verlichting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(50, 100, 50);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    // 5. Speler (Leib Weissman)
    textureLoader = new THREE.TextureLoader(); // Initialiseer de loader
    // Gebruik leib.png zoals door de gebruiker is gespecificeerd
    const leibTexture = textureLoader.load('leib.png', (tex) => { 
        tex.colorSpace = THREE.SRGBColorSpace;
    });

    // Speler is een box
    const playerGeometry = new THREE.BoxGeometry(1, 2, 1);
    const playerMaterial = new THREE.MeshStandardMaterial({ 
        map: leibTexture,
        color: 0xffffff 
    });
    
    player = new THREE.Mesh(playerGeometry, playerMaterial);
    player.position.set(0, 5, 0);
    player.castShadow = true;
    scene.add(player);

    playerVelocity = new THREE.Vector3();
    playerDirection = new THREE.Vector3();

    // 6. Wereld Generatie
    generateWorld();

    // 7. Event Listeners
    setupInputs();
    window.addEventListener('resize', onWindowResize);
}

function generateWorld() {
    // Start Platform
    createCloud(0, -2, 0, 10, 2, 10, false, 0xdddddd);

    // Procedurele Wolken
    let currentZ = -10;
    const gapMin = 4;
    const gapMax = 8;
    
    while (currentZ > CASTLE_Z + 20) {
        const xOffset = (Math.random() - 0.5) * 30; 
        const yOffset = (Math.random() - 0.5) * 6;  
        const zStep = gapMin + Math.random() * (gapMax - gapMin);
        
        // Diverse vormen: Breed, hoog, klein, bewegend
        const width = 3 + Math.random() * 5;
        const depth = 3 + Math.random() * 5;
        const height = 1 + Math.random() * 2;
        
        // Is dit een bewegende wolk? (20% kans)
        const isMoving = Math.random() < 0.2;
        const col = isMoving ? 0xccddff : 0xffffff;

        createCloud(xOffset, yOffset, currentZ, width, height, depth, isMoving, col);

        // Munt plaatsen? (60% kans)
        if (Math.random() > 0.4) {
            createCoin(xOffset, yOffset + height/2 + 1, currentZ);
        }

        // Vijand plaatsen? (30% kans, alleen als er ruimte is)
        if (Math.random() > 0.7 && !isMoving) {
            createEnemy(xOffset, yOffset + 4, currentZ);
        }

        currentZ -= zStep;
    }

    // Eind Platform
    createCloud(0, 0, CASTLE_Z, 20, 2, 20, false, 0xffffff);
    createCastle(0, 1, CASTLE_Z);
}

function createCloud(x, y, z, w, h, d, moving, color) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshLambertMaterial({ color: color, transparent: true, opacity: 0.9 });
    const cloud = new THREE.Mesh(geo, mat);
    
    cloud.position.set(x, y, z);
    cloud.receiveShadow = true;
    cloud.castShadow = true;
    
    // Metadata voor collision en logica
    cloud.userData = { 
        isPlatform: true, 
        width: w, height: h, depth: d,
        moving: moving,
        initialX: x,
        speed: 2 + Math.random() * 3,
        range: 5 + Math.random() * 5
    };
    
    scene.add(cloud);
    platforms.push(cloud);
}

function createCoin(x, y, z) {
    const geo = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 16);
    const mat = new THREE.MeshPhongMaterial({ color: 0xffd700, shininess: 100 });
    const coin = new THREE.Mesh(geo, mat);
    coin.rotation.x = Math.PI / 2; 
    coin.rotation.z = Math.PI / 2; 
    coin.position.set(x, y, z);
    scene.add(coin);
    coins.push(coin);
}

function createEnemy(x, y, z) {
    // Laad de sprite textuur
    const enemyTexture = textureLoader.load('enemy.png', (tex) => { 
        tex.colorSpace = THREE.SRGBColorSpace;
    });

    // We gebruiken PlaneGeometry om een duidelijke hitbox te hebben (oppervlakte van de sprite)
    const geo = new THREE.PlaneGeometry(ENEMY_WIDTH, ENEMY_HEIGHT);
    const mat = new THREE.MeshBasicMaterial({ 
        map: enemyTexture, 
        transparent: true, 
        alphaTest: 0.5, // Zorgt ervoor dat transparante delen (bijna) niet botsen
        side: THREE.DoubleSide // Zorgt ervoor dat de sprite van beide kanten zichtbaar is
    });
    
    const enemy = new THREE.Mesh(geo, mat);
    
    // Draai 90 graden om de X-as om de Plane op te laten staan (van XY naar XZ)
    enemy.rotation.x = -Math.PI / 2;
    
    enemy.position.set(x, y, z);
    
    enemy.userData = { 
        isEnemy: true, 
        health: 1,
        initialY: y,
        hitRadius: ENEMY_HIT_RADIUS // Nieuwe botsradius
    };
    
    scene.add(enemy);
    enemies.push(enemy);
}

function createCastle(x, y, z) {
    const group = new THREE.Group();
    const towerGeo = new THREE.BoxGeometry(6, 12, 6);
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x888888 });
    const tower = new THREE.Mesh(towerGeo, towerMat);
    tower.position.y = 6;
    group.add(tower);
    
    // Oranje vlaggetje voor Koning Willem
    const flagGeo = new THREE.PlaneGeometry(2, 1);
    const flagMat = new THREE.MeshBasicMaterial({ color: 0xff8800, side: THREE.DoubleSide });
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(0, 14, 0);
    group.add(flag);

    group.position.set(x, y, z);
    scene.add(group);
    castle = group;
}

function setupInputs() {
    document.getElementById('start-btn').addEventListener('click', () => {
        startScreen.classList.remove('active');
        document.body.requestPointerLock();
        if (sound && !sound.isPlaying) sound.play();
        resetGame();
    });

    document.getElementById('resume-btn').addEventListener('click', () => {
        document.body.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
        if (document.pointerLockElement === document.body) {
            gameState = 'playing';
            pauseScreen.classList.remove('active');
            if (startTime === 0) startTime = Date.now();
        } else {
            if (gameState === 'playing') {
                gameState = 'paused';
                pauseScreen.classList.add('active');
            }
        }
    });

    document.addEventListener('mousemove', (event) => {
        if (gameState !== 'playing') return;
        const sensitivity = 0.002;
        player.rotation.y -= event.movementX * sensitivity;
        
        // Verticale camera look (beperkt)
        // Dit doen we meestal door de camera houder te draaien, maar voor nu houden we het simpel op Y-as rotatie
    });

    document.addEventListener('mousedown', (event) => {
        if (gameState === 'playing' && event.button === 0) {
            shootSpit();
        }
    });

    document.addEventListener('keydown', (event) => {
        switch (event.code) {
            case 'KeyW': moveForward = true; break;
            case 'KeyA': moveLeft = true; break;
            case 'KeyS': moveBackward = true; break;
            case 'KeyD': moveRight = true; break;
            case 'Space': 
                if (canJump && gameState === 'playing') {
                    playerVelocity.y = JUMP_SPEED;
                    canJump = false;
                }
                break;
            case 'Enter': activateWeedBuff(); break;
        }
    });

    document.addEventListener('keyup', (event) => {
        switch (event.code) {
            case 'KeyW': moveForward = false; break;
            case 'KeyA': moveLeft = false; break;
            case 'KeyS': moveBackward = false; break;
            case 'KeyD': moveRight = false; break;
        }
    });
}

function shootSpit() {
    const geo = new THREE.SphereGeometry(0.2, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0x00ffff }); // Cyaan spuug
    const spit = new THREE.Mesh(geo, mat);
    
    // Startpositie: iets voor de speler en iets hoger
    spit.position.copy(player.position);
    spit.position.y += 1.5; 
    
    // Richting: Camera richting
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    spit.position.add(direction.clone().multiplyScalar(1)); // Iets voor de speler zetten
    
    scene.add(spit);
    
    projectiles.push({
        mesh: spit,
        velocity: direction.multiplyScalar(30), // Snelheid
        life: 2.0 // Seconden
    });
}

function activateWeedBuff() {
    if (gameState !== 'playing' || coinsCollected < 1 || isTripping) return;
    coinsCollected--;
    updateHUD();
    isTripping = true;
    document.body.classList.add('tripping');
    statusMsg.innerText = "WEED MODE AAN";
    targetGravity = TRIP_GRAVITY;
    clearTimeout(tripTimer);
    tripTimer = setTimeout(() => {
        isTripping = false;
        document.body.classList.remove('tripping');
        statusMsg.innerText = "";
        targetGravity = BASE_GRAVITY;
    }, BUFF_DURATION);
}

function updateTransition(delta) {
    const lerpSpeed = 2.0 * delta;
    currentGravity = THREE.MathUtils.lerp(currentGravity, targetGravity, lerpSpeed);
    const targetFog = isTripping ? tripFogColor : baseFogColor;
    const targetBg = isTripping ? tripBgColor : baseBgColor;
    scene.fog.color.lerp(targetFog, lerpSpeed);
    scene.background.lerp(targetBg, lerpSpeed);
}

// --- FYSICA & BOTSING (Volledige AABB) ---
function updatePhysics(delta) {
    const time = Date.now() * 0.001; // Nodig voor bewegende platformen en vijanden
    
    // 1. Bewegende Wolken Update
    platforms.forEach(p => {
        if (p.userData.moving) {
            p.position.x = p.userData.initialX + Math.sin(time * p.userData.speed) * p.userData.range;
        }
    });

    // 2. Speler Snelheid
    playerVelocity.x -= playerVelocity.x * 10.0 * delta;
    playerVelocity.z -= playerVelocity.z * 10.0 * delta;
    playerVelocity.y -= currentGravity * delta; 

    // Input Richting
    playerDirection.z = Number(moveForward) - Number(moveBackward);
    playerDirection.x = Number(moveRight) - Number(moveLeft);
    playerDirection.normalize();

    // Omzetten naar wereldcoördinaten
    const forward = new THREE.Vector3(0, 0, -1).applyEuler(player.rotation);
    const right = new THREE.Vector3(1, 0, 0).applyEuler(player.rotation);
    const moveVec = new THREE.Vector3();
    
    if (moveForward) moveVec.add(forward.clone().multiplyScalar(MOVE_SPEED * delta)); 
    if (moveBackward) moveVec.add(forward.clone().multiplyScalar(-MOVE_SPEED * delta));
    if (moveRight) moveVec.add(right.clone().multiplyScalar(MOVE_SPEED * delta));
    if (moveLeft) moveVec.add(right.clone().multiplyScalar(-MOVE_SPEED * delta));

    // Pas X en Z toe (Y doen we apart voor collision)
    player.position.x += moveVec.x;
    player.position.z += moveVec.z;
    
    // --- COLLISION X/Z FIX: Handmatige AABB (Muur botsing) ---
    const pHPS = 0.5; // Player Half Side (speler is 1x2x1, dus halfbreedte is 0.5)

    for (let platform of platforms) {
        const p = platform;
        const pHW = p.userData.width / 2;
        const pHD = p.userData.depth / 2;

        const dx = player.position.x - p.position.x;
        const dz = player.position.z - p.position.z;

        // XZ AABB overlap check
        const xOverlap = (pHW + pHPS) - Math.abs(dx);
        const zOverlap = (pHD + pHPS) - Math.abs(dz);

        if (xOverlap > 0 && zOverlap > 0) {
            const pYMax = p.position.y + p.userData.height / 2;
            const playerFeet = player.position.y - 1; 

            // Als de voeten van de speler niet duidelijk boven de top van de wolk zijn, 
            // dan is het een zijdelingse botsing. (Tolerantie voor nauwkeurigheid is 0.1)
            if (playerFeet < pYMax - 0.1) { 
                
                // Los de botsing op door terug te duwen op de as met de minste overlap
                if (xOverlap < zOverlap) {
                    const sign = Math.sign(dx);
                    player.position.x += xOverlap * sign;
                } else {
                    const sign = Math.sign(dz);
                    player.position.z += zOverlap * sign;
                }
            }
        }
    }

    // Pas Y toe
    player.position.y += playerVelocity.y * delta;
    
    // --- COLLISION Y (Grond/Plafond botsing) ---
    let playerBox = new THREE.Box3().setFromObject(player);
    // Maak horizontale box kleiner om randjes te voorkomen
    playerBox.min.x += 0.2; playerBox.max.x -= 0.2;
    playerBox.min.z += 0.2; playerBox.max.z -= 0.2;

    canJump = false; 

    for (let platform of platforms) {
        const pBox = new THREE.Box3().setFromObject(platform);
        if (playerBox.intersectsBox(pBox)) {
            // Verticale botsing
            const dy = player.position.y - platform.position.y;
            
            if (dy > 0 && playerVelocity.y <= 0) {
                // Landing bovenop
                player.position.y = pBox.max.y + 1.0; // Speler origin is center, height=2, dus +1
                playerVelocity.y = 0;
                canJump = true;
                
                // Als platform beweegt, beweeg mee
                if (platform.userData.moving) {
                    // Benadering van de snelheid van het platform
                    player.position.x += Math.cos(time * platform.userData.speed) * platform.userData.range * delta * platform.userData.speed; 
                }
            } else if (dy < 0 && playerVelocity.y > 0) {
                // Botsing tegen onderkant (Head bonk)
                player.position.y = pBox.min.y - 1.0;
                playerVelocity.y = -2; // Terugkaatsen
            }
        }
    }

    // 3. Vijanden Update
    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        
        // BILLBOARDING: Zorg ervoor dat de sprite de speler horizontaal aankijkt
        const targetVector = new THREE.Vector3().subVectors(player.position, e.position).normalize();
        // Bepaal de rotatie om de Y-as (horizontale as)
        const angle = Math.atan2(targetVector.x, targetVector.z);
        // Omdat de plane al -PI/2 rond X is gedraaid, passen we alleen de Y-rotatie aan
        e.rotation.y = angle;

        // Zweef effect
        e.position.y = e.userData.initialY + Math.sin(time * 2) * 0.5;
        
        // Botsing met speler (gebruikt de hitRadius)
        if (player.position.distanceTo(e.position) < e.userData.hitRadius) {
            // RAAK!
            playerVelocity.y = 10; // Knockback omhoog
            playerVelocity.z += 10; // Knockback achteruit
            
            // Als je geen spuug gebruikt, kost het munten of game over
            // We doen: verlies 3 munten
            if (coinsCollected > 0) {
                coinsCollected = Math.max(0, coinsCollected - 3);
                updateHUD();
                statusMsg.innerText = "AU! -3 MUNTEN!";
                scene.remove(e);
                enemies.splice(i, 1);
            } else {
                endGame(false, "Verminkt door een Boze Maan!");
            }
        }
    }

    // 4. Projectielen Update
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.life -= delta;
        p.mesh.position.add(p.velocity.clone().multiplyScalar(delta));
        
        // Botsing met Vijanden
        for (let j = enemies.length - 1; j >= 0; j--) {
            const e = enemies[j];
            // Controleer of het projectiel de vijand raakt (hitRadius)
            if (p.mesh.position.distanceTo(e.position) < e.userData.hitRadius * 0.5) { // Maak de hit iets kleiner
                // RAAK!
                scene.remove(enemies[j]);
                enemies.splice(j, 1);
                scene.remove(p.mesh);
                projectiles.splice(i, 1);
                // Effectje?
                statusMsg.innerText = "VIJAND VERSLAGEN!";
                setTimeout(() => statusMsg.innerText = "", 1000);
                break; // Break enemy loop
            }
        }
        
        // Verwijder als life op is (en nog niet verwijderd door hit)
        if (projectiles[i] === p && p.life <= 0) {
            scene.remove(p.mesh);
            projectiles.splice(i, 1);
        }
    }

    // 5. Munten
    for (let i = coins.length - 1; i >= 0; i--) {
        const coin = coins[i];
        coin.rotation.y += delta * 3;
        if (player.position.distanceTo(coin.position) < 1.5) {
            scene.remove(coin);
            coins.splice(i, 1);
            coinsCollected++;
            updateHUD();
        }
    }
}

function updateCamera() {
    const distH = 8; 
    const distV = 4; 
    const offsetX = Math.sin(player.rotation.y) * distH;
    const offsetZ = Math.cos(player.rotation.y) * distH;

    const targetPos = new THREE.Vector3(
        player.position.x + offsetX,
        player.position.y + distV,
        player.position.z + offsetZ
    );

    camera.position.lerp(targetPos, 0.2);
    
    const lookAtPos = player.position.clone();
    lookAtPos.y += 2; 
    camera.lookAt(lookAtPos);
}

function updateHUD() {
    hudCoins.innerText = coinsCollected;
    const time = (Date.now() - startTime) / 1000;
    hudTime.innerText = time.toFixed(1);
}

function checkGameConditions() {
    if (player.position.y < -30) endGame(false, "Je bent uit de wolken gevallen!");
    if (player.position.z <= CASTLE_Z + 5 && player.position.y > -5) {
        if (coinsCollected >= MIN_COINS_TO_WIN) endGame(true, "Koning Willem is trots!");
        else endGame(false, "Te weinig munten (" + coinsCollected + "/10).");
    }
}

function endGame(won, reason) {
    gameState = 'ended';
    document.exitPointerLock();
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    document.getElementById('go-title').innerText = won ? "GEWONNEN!" : "GAME OVER";
    document.getElementById('go-reason').innerText = reason;
    document.getElementById('go-time').innerText = totalTime;
    gameOverScreen.classList.add('active');
}

function resetGame() {
    player.position.set(0, 5, 0);
    playerVelocity.set(0, 0, 0);
    player.rotation.set(0, 0, 0);
    coinsCollected = 0;
    startTime = Date.now();
    isTripping = false;
    currentGravity = BASE_GRAVITY;
    targetGravity = BASE_GRAVITY;
    
    scene.fog.color.copy(baseFogColor);
    scene.background.copy(baseBgColor);
    document.body.classList.remove('tripping');
    
    // Herlaad vijanden niet volledig in deze simpele versie (reload page voor full reset is veiliger)
    // Maar we resetten de HUD
    updateHUD();
    gameState = 'playing';
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    if (gameState === 'playing') {
        const delta = Math.min(clock.getDelta(), 0.1);
        updateTransition(delta);
        updatePhysics(delta);
        checkGameConditions();
        updateCamera();
        updateHUD();
    }
    
    renderer.render(scene, camera);
}