import * as THREE from 'three';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/jsm/loaders/DRACOLoader.js';
import { SkeletonUtils } from 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/jsm/utils/SkeletonUtils.js';

function getQualitySuffix() {
    try {
        const saved = localStorage.getItem('leib_settings');
        if (saved) {
            const parsed = JSON.parse(saved);
            return parsed.graphics === 'low' ? '_low' : '_high';
        }
    } catch (e) { console.warn(e); }
    return '_high'; 
}

const QUALITY_SUFFIX = getQualitySuffix();
console.log("🌍 World loading assets with quality:", QUALITY_SUFFIX);

let worldUnsubscribe = null;

const ASSET_CONFIG = {
    COIN_SCALE: 0.5,
    COIN_ROTATION_SPEED: 2.0,
    ENEMY_SCALE: 1.4,
    ENEMY_COLLISION_DISTANCE: 0.3,
};
export { ASSET_CONFIG };

let cachedCoinScene = null;
let cachedEnemyGLTF = null;

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

const ASSET_BASE_URL = 'https://MaxTomahawk.github.io/leibgame-assets/assets/';

gltfLoader.load(`${ASSET_BASE_URL}coin${QUALITY_SUFFIX}.glb`, (gltf) => {
    cachedCoinScene = gltf.scene;
    cachedCoinScene.scale.set(ASSET_CONFIG.COIN_SCALE, ASSET_CONFIG.COIN_SCALE, ASSET_CONFIG.COIN_SCALE);
    cachedCoinScene.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
        }
    });
    console.log("🪙 Coin model loaded successfully!");
}, undefined, (err) => {
    console.warn("Could not load coin.glb, using fallback cylinder.", err);
});

gltfLoader.load(`${ASSET_BASE_URL}enemy${QUALITY_SUFFIX}.glb`, (gltf) => {
    cachedEnemyGLTF = gltf;
    cachedEnemyGLTF.scene.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
        }
    });
    console.log("😈 Enemy model loaded successfully!");
}, undefined, (err) => {
    console.warn("Could not load enemy.glb, using fallback placeholder.", err);
});

// Main function to sync and build any type of world
export async function syncAndBuildWorld(
    scene, 
    ui, 
    platforms, 
    coins, 
    enemies, 
    projectiles, 
    isMultiplayer, 
    db, 
    CASTLE_Z, 
    platformTexture, 
    textureLoader, 
    worldGenerator, 
    levelId = "main_world" 
) {
    if(ui && ui.status) ui.status.innerText = "Loading world...";

    platforms.forEach(p => {
        scene.remove(p);
        if (p.geometry) p.geometry.dispose();
        if (p.material && !p.material.userData.isShared) p.material.dispose();
    });
    platforms.length = 0;

    coins.forEach(c => scene.remove(c)); coins.length = 0;

    enemies.forEach(e => {
        scene.remove(e);
        if (e.userData.mixer) e.userData.mixer = null;
    });
    enemies.length = 0;

    projectiles.forEach(p => scene.remove(p.mesh)); projectiles.length = 0;

    let worldData = null;

    if (isMultiplayer && db) {
        try {
            const { doc, getDoc, setDoc } = await import("https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js");

            const worldDocRef = doc(db, "levels", levelId);
            console.log(`🌍 Connecting to level: ${levelId}`);

            const cacheKey = `cachedWorld_${levelId}`;
            const cachedWorld = localStorage.getItem(cacheKey);
            if (cachedWorld) {
                try {
                    const cached = JSON.parse(cachedWorld);
                    console.log("📦 Using cached world data");
                    worldData = cached;
                } catch (e) {
                    console.warn("Failed to parse cache");
                }
            }

            if (!worldData) {
                const docSnap = await getDoc(worldDocRef);

                if (docSnap.exists()) {
                    console.log("☁️ Fetched world from Firebase");
                    worldData = docSnap.data();
                    localStorage.setItem(cacheKey, JSON.stringify(worldData));
                } else {
                    console.log("No world found, generating new one...");
                    worldData = worldGenerator(CASTLE_Z);
                    await setDoc(worldDocRef, worldData);
                    localStorage.setItem(cacheKey, JSON.stringify(worldData));
                }
            }

            if (!worldUnsubscribe) {
                worldUnsubscribe = await setupWorldListener(worldDocRef, scene, CASTLE_Z, platforms, coins, enemies, platformTexture, textureLoader);
            }

        } catch (e) {
            console.error("Error fetching world:", e);
            if(ui && ui.status) ui.status.innerHTML = "⚠️ <strong>Database Error:</strong> Falling back to offline mode.";
            worldData = worldGenerator(CASTLE_Z);
        }
    } else {
        console.log("🎮 Generating offline world");
        worldData = worldGenerator(CASTLE_Z);
    }

    if (!worldData || !worldData.platforms || worldData.platforms.length === 0) {
        console.warn("Received world data was empty, fallback to local generation.");
        worldData = worldGenerator(CASTLE_Z);
    }

    buildWorldFromData(worldData, scene, CASTLE_Z, platforms, coins, enemies, platformTexture, textureLoader);

    if (ui && ui.status && !ui.status.innerText.includes("Error")) {
        ui.status.innerText = "Have fun!";
    }
}

async function setupWorldListener(worldDocRef, scene, CASTLE_Z, platforms, coins, enemies, platformTexture, textureLoader) {
    let lastWorldTimestamp = null;

    const { onSnapshot } = await import("https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js");

    const unsubscribe = onSnapshot(worldDocRef, (docSnap) => {
        if (!docSnap.exists()) return;

        const data = docSnap.data();
        const currentTimestamp = data.generatedAt || 0;

        if (lastWorldTimestamp === null) {
            lastWorldTimestamp = currentTimestamp;
            return;
        }

        if (currentTimestamp !== lastWorldTimestamp) {
            console.log("🌍 World regenerated! Reloading...");
            lastWorldTimestamp = currentTimestamp;

            localStorage.setItem('cachedWorld', JSON.stringify(data));

            platforms.forEach(p => {
                scene.remove(p);
                if (p.geometry) p.geometry.dispose();
                if (p.material && !p.material.userData.isShared) p.material.dispose();
            });
            platforms.length = 0;

            coins.forEach(c => scene.remove(c));
            coins.length = 0;

            enemies.forEach(e => {
                scene.remove(e);
                if (e.userData.mixer) e.userData.mixer = null;
            });
            enemies.length = 0;

            buildWorldFromData(data, scene, CASTLE_Z, platforms, coins, enemies, platformTexture, textureLoader);

            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0, 255, 0, 0.9);
                color: white;
                padding: 20px 40px;
                border-radius: 10px;
                font-size: 24px;
                font-weight: bold;
                z-index: 10000;
                animation: fadeOut 3s forwards;
            `;
            notification.innerText = "🌍 New world loaded!";
            document.body.appendChild(notification);

            setTimeout(() => notification.remove(), 3000);
        }
    });

    return unsubscribe;
}

function createTextTexture(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = 'bold 120px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.lineWidth = 8;
    ctx.strokeStyle = 'black';
    ctx.strokeText(text, canvas.width / 2, canvas.height / 2);

    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#FFD700");
    gradient.addColorStop(1, "#FF8C00");
    ctx.fillStyle = gradient;

    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    return texture;
}

function createCastle(scene, CASTLE_Z) {
    const castle = new THREE.Group();

    const keep = new THREE.Mesh(
        new THREE.BoxGeometry(10, 12, 10),
        new THREE.MeshStandardMaterial({ color: 0xbababa })
    );
    keep.position.y = 6;
    castle.add(keep);

    const towerGeo = new THREE.CylinderGeometry(2, 2, 14, 6);
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x999999 });

    const towerOffsets = [
        [5, 5],
        [-5, 5],
        [5, -5],
        [-5, -5]
    ];

    towerOffsets.forEach(([x, z]) => {
        const t = new THREE.Mesh(towerGeo, towerMat);
        t.position.set(x, 7, z);
        castle.add(t);

        const roof = new THREE.Mesh(
            new THREE.ConeGeometry(3, 3, 6),
            new THREE.MeshStandardMaterial({ color: 0x663300 })
        );
        roof.position.set(x, 15, z);
        castle.add(roof);
    });

    const wallMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa });

    const walls = [
        { x: 0, z: 7, w: 14, h: 6, d: 1 },
        { x: 0, z: -7, w: 14, h: 6, d: 1 },
        { x: 7, z: 0, w: 1, h: 6, d: 14 },
        { x: -7, z: 0, w: 1, h: 6, d: 14 }
    ];

    walls.forEach(w => {
        const wall = new THREE.Mesh(
            new THREE.BoxGeometry(w.w, w.h, w.d),
            wallMat
        );
        wall.position.set(w.x, w.h / 2, w.z);
        castle.add(wall);

    });

    castle.position.set(0, 1, CASTLE_Z);
    scene.add(castle);
}

export function buildWorldFromData(data, scene, CASTLE_Z, platforms, coins, enemies, platformTexture, textureLoader) {

    const sharedCloudMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.9,
        metalness: 0.1,
        flatShading: true
    });
    sharedCloudMaterial.userData.isShared = true;

    if (data.platforms) {
        data.platforms.forEach(p => {
            createPlat(p.x, p.y, p.z, p.w, p.h, p.d, scene, platforms, sharedCloudMaterial);
        });
    }

    scene.updateMatrixWorld(true);

    if (data.coins && data.coins.length > 0) {
        data.coins.forEach(c => createCoin(c.x, c.y, c.z, scene, coins));
    }

    if (data.enemies) {
        data.enemies.forEach(e => createEnemy(e.x, e.y, e.z, scene, enemies, platforms));
    }

    createCastle(scene, CASTLE_Z);
    const sky = createCloudySky();
    scene.add(sky);
}

function createPlat(x, y, z, w, h, d, scene, platforms, material) {
    const useMat = material || new THREE.MeshStandardMaterial({ color: 0xffffff });

    const baseRadius = Math.min(w, d) * 0.4;

    const mainGeo = new THREE.IcosahedronGeometry(baseRadius, 0);
    const mainMesh = new THREE.Mesh(mainGeo, useMat);

    mainMesh.scale.set(w / baseRadius * 0.5, h / baseRadius * 0.5, d / baseRadius * 0.5);
    mainMesh.position.set(x, y, z);

    mainMesh.castShadow = true;
    mainMesh.receiveShadow = true;
    mainMesh.userData.isPlatform = true;

    scene.add(mainMesh);
    platforms.push(mainMesh);

    const puffCount = 4 + Math.floor(Math.random() * 4);

    for (let i = 0; i < puffCount; i++) {
        const puffRadius = baseRadius * (0.6 + Math.random() * 0.5);
        const puffGeo = new THREE.IcosahedronGeometry(puffRadius, 0);
        const puffMesh = new THREE.Mesh(puffGeo, useMat);

        puffMesh.position.set(
            x + (Math.random() - 0.5) * w * 0.8,
            y + (Math.random() - 0.5) * h * 0.5,
            z + (Math.random() - 0.5) * d * 0.8
        );

        puffMesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

        puffMesh.castShadow = false;
        puffMesh.receiveShadow = true;
        puffMesh.userData.isPlatform = true;

        scene.add(puffMesh);
        platforms.push(puffMesh);
    }
}

function createCoin(x, y, z, scene, coins) {
    const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.5, 0.1),
        new THREE.MeshPhongMaterial({ color: 0xffd700 })
    );
    mesh.position.set(x, y, z);
    mesh.rotation.z = Math.PI / 2;
    mesh.baseY = y;
    mesh.bobOffset = Math.random() * Math.PI * 2;
    scene.add(mesh);
    coins.push(mesh);
}

function createStar(x, y, z, scene, coins) {
    let mesh;

    if (cachedCoinScene) {
        mesh = cachedCoinScene.clone();
        mesh.position.set(x, y, z);
        mesh.userData.isStar = true;

    } else {
        mesh = new THREE.Mesh(
            new THREE.CylinderGeometry(0.5 * ASSET_CONFIG.COIN_SCALE, 0.5 * ASSET_CONFIG.COIN_SCALE, 0.1 * ASSET_CONFIG.COIN_SCALE, 12),
            new THREE.MeshPhongMaterial({ color: 0xffd700 })
        );
        mesh.position.set(x, y, z);
        mesh.rotation.x = Math.PI / 2;
        mesh.userData.isStar = true;
    }

    mesh.baseY = y;
    mesh.bobOffset = Math.random() * Math.PI * 2;

    mesh.castShadow = true;
    scene.add(mesh);
    coins.push(mesh);
}

export function spawnStarAtPosition(x, y, z, scene, coins) {
    createStar(x, y, z, scene, coins);
    console.log(`🪙 Coin spawned at (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`);
}

function createEnemy(x, y, z, scene, enemies, platforms) {
    let mesh;

    if (cachedEnemyGLTF) {
        mesh = SkeletonUtils.clone(cachedEnemyGLTF.scene);
        mesh.scale.set(ASSET_CONFIG.ENEMY_SCALE, ASSET_CONFIG.ENEMY_SCALE, ASSET_CONFIG.ENEMY_SCALE);

        if (cachedEnemyGLTF.animations && cachedEnemyGLTF.animations.length > 0) {
            const mixer = new THREE.AnimationMixer(mesh);
            const action = mixer.clipAction(cachedEnemyGLTF.animations[0]);
            action.play();
            mesh.userData.mixer = mixer;
        }

    } else {
        const geo = new THREE.BoxGeometry(1, 1, 1);
        const mat = new THREE.MeshStandardMaterial({ color: 0xff0000, wireframe: true });
        mesh = new THREE.Mesh(geo, mat);
        mesh.userData.isPlaceholder = true;
    }

    mesh.position.set(x, y, z);

    const raycaster = new THREE.Raycaster();
    const rayOrigin = new THREE.Vector3(x, y + 10, z);
    const rayDirection = new THREE.Vector3(0, -1, 0);
    raycaster.set(rayOrigin, rayDirection);

    const intersects = raycaster.intersectObjects(platforms, true);

    if (intersects.length > 0) {
        const groundY = intersects[0].point.y;
        mesh.position.y = groundY;
    }

    scene.add(mesh);
    enemies.push(mesh);
}

export function cleanupWorldListener() {
    if (worldUnsubscribe) {
        worldUnsubscribe();
        worldUnsubscribe = null;
        console.log("🛑 World listener stopped");
    }
}

function createPromptTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.arc(64, 64, 60, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#FFD700'; 
    ctx.lineWidth = 10;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 80px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('E', 64, 68);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
}

export function loadRonnie(scene, gltfLoader, position) {
    const suffix = getQualitySuffix();

    gltfLoader.load(`${ASSET_BASE_URL}ronnie${suffix}.glb`, (gltf) => {
        const ronnie = gltf.scene;
        ronnie.scale.set(1.3, 1.3, 1.3);
        ronnie.position.set(position.x, position.y, position.z);
        ronnie.rotation.y = Math.PI;

        ronnie.traverse((child) => {
            if (child.isMesh) {
                child.userData.isRonnie = true;
                child.userData.parentGroup = ronnie;
            }
        });

        ronnie.userData.isRonnie = true;
        const promptMat = new THREE.SpriteMaterial({
            map: createPromptTexture(),
            transparent: true,
            depthTest: false, 
            depthWrite: false
        });
        const promptSprite = new THREE.Sprite(promptMat);
        promptSprite.position.set(0, 2.8, 0); 
        promptSprite.scale.set(0.8, 0.8, 0.8);
        promptSprite.visible = false; 
        promptSprite.name = "InteractionPrompt"; 

        ronnie.add(promptSprite);

        scene.add(ronnie);

        window.ronnie = ronnie;

        console.log("🧥 Ronnie (met E-prompt) is aanwezig.");
    }, undefined, (err) => console.warn("Ronnie model niet gevonden.", err));
}

export function summonCloudPlatform(playerPos, scene, platforms, texture) {
    const w = 4, h = 1, d = 4;
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({ map: texture || null, color: 0xaaaaaa });
    const cloud = new THREE.Mesh(geo, mat);

    cloud.position.set(playerPos.x, playerPos.y - 2, playerPos.z);

    scene.add(cloud);
    platforms.push(cloud);

    setTimeout(() => {
        scene.remove(cloud);
        const idx = platforms.indexOf(cloud);
        if (idx > -1) platforms.splice(idx, 1);
    }, 10000);
}

function createCloudySky() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#4A90E2');
    gradient.addColorStop(0.7, '#87CEEB');
    gradient.addColorStop(1, '#B0E0E6');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    for (let i = 0; i < 15; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height * 0.6;
        const w = 80 + Math.random() * 120;
        const h = 30 + Math.random() * 50;
        
        ctx.beginPath();
        ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    
    const skyGeo = new THREE.SphereGeometry(500, 32, 32);
    const skyMat = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.BackSide,
        fog: false 
    });
    
    const sky = new THREE.Mesh(skyGeo, skyMat);
    sky.userData.skyMaterial = skyMat;
    sky.name = 'SkySphere';
    
    return sky;
}