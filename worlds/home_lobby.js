// worlds/home_lobby.js
import * as THREE from 'three';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/jsm/loaders/DRACOLoader.js';

// Helper om de juiste bestandsnaam te kiezen (high/low quality)
function getQualitySuffix() {
    try {
        const saved = localStorage.getItem('leib_settings');
        if (saved) {
            const parsed = JSON.parse(saved);
            return parsed.graphics === 'low' ? '_low' : '_high';
        }
    } catch (e) { }
    return '_high';
}

export function build(scene) {
    const homeObjects = []; 
    const qualitySuffix = getQualitySuffix();

    // 1. De Vloer
    const floorGeo = new THREE.CylinderGeometry(18, 15, 2, 32);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x44aa88 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.set(0, -1, 0);
    floor.receiveShadow = true;
    floor.userData.isPlatform = true; 
    scene.add(floor);
    homeObjects.push(floor);

    // 2. Offline Portal (Links - Groen)
    const portalOff = createPortal(new THREE.Vector3(-6, 2, -6), 0x00ff00);
    scene.add(portalOff);
    homeObjects.push(portalOff);

    // 3. Online Portal (Rechts - Blauw)
    const portalOn = createPortal(new THREE.Vector3(6, 2, -6), 0x00ffff);
    scene.add(portalOn);
    homeObjects.push(portalOn);

    // 4. De Kiosk (Interactieve Terminal) - NIEUW!
    const kiosk = createKiosk(new THREE.Vector3(0, 0, 8)); // Voor de spawn, makkelijk te vinden
    scene.add(kiosk);
    homeObjects.push(kiosk);

    // 5. Garderobe (Standbeelden)
    const wardrobes = [
        { id: 'leib', x: -3, z: 4, file: 'leib' },
        { id: 'marco', x: 0, z: 5, file: 'marco' },
        { id: 'katinka', x: 3, z: 4, file: 'katinka' }
    ];

    // Setup Loaders (GLTF + DRACO)
    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    loader.setDRACOLoader(dracoLoader);

    wardrobes.forEach(w => {
        // Podium
        const podium = new THREE.Mesh(
            new THREE.CylinderGeometry(1, 1.2, 0.5, 16),
            new THREE.MeshStandardMaterial({ color: 0x666666 })
        );
        podium.position.set(w.x, 0, w.z);
        scene.add(podium);
        homeObjects.push(podium);

        // Model laden met suffix (bijv: leib_high.glb)
        const modelUrl = `https://MaxTomahawk.github.io/leibgame-assets/assets/${w.file}${qualitySuffix}.glb`;

        loader.load(modelUrl, (gltf) => {
            const m = gltf.scene;
            m.position.set(w.x, 0.25, w.z);
            m.scale.set(1,1,1);
            m.rotation.y = Math.PI; // Naar camera toe
            m.userData.isWardrobe = true;
            m.userData.modelFile = `${w.file}.glb`; // Bewaar originele ID voor logica
            scene.add(m);
            homeObjects.push(m);
        }, undefined, (error) => {
            console.warn(`Failed to load wardrobe model: ${modelUrl}`, error);
        });
    });

    return { 
        objects: homeObjects,
        portals: { offline: portalOff, online: portalOn }
    };
}

function createPortal(pos, color) {
    const group = new THREE.Group();
    group.position.copy(pos);
    group.lookAt(0, 2, 0);

    const ring = new THREE.Mesh(
        new THREE.TorusGeometry(2.5, 0.2, 16, 100),
        new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 2 })
    );
    group.add(ring);
    
    // Onzichtbare hitbox voor makkelijkere collision
    const hitbox = new THREE.Mesh(
        new THREE.BoxGeometry(2, 4, 1),
        new THREE.MeshBasicMaterial({ visible: false })
    );
    hitbox.userData.isPortal = true;
    group.add(hitbox);
    
    return group;
}

// NIEUWE FUNCTIE: Maak een Kiosk object
function createKiosk(pos) {
    const group = new THREE.Group();
    group.position.copy(pos);
    // Kijk naar het midden (0,0,0) - maar kiosk staat op Z=8, dus draai 180 graden
    group.rotation.y = Math.PI; 

    // Voet
    const stand = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 1.5, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x333333 })
    );
    stand.position.y = 0.75;
    group.add(stand);

    // Scherm / Console
    const consoleBox = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 1, 0.8),
        new THREE.MeshStandardMaterial({ color: 0x5555ff }) // Blauw scherm
    );
    consoleBox.position.y = 1.75;
    // Beetje kantelen
    consoleBox.rotation.x = -0.2;
    group.add(consoleBox);

    // Hitbox voor interactie
    const hitbox = new THREE.Mesh(
        new THREE.BoxGeometry(2, 3, 2),
        new THREE.MeshBasicMaterial({ visible: false })
    );
    hitbox.userData.isKiosk = true; // TAG voor main.js
    hitbox.position.y = 1.5;
    group.add(hitbox);

    return group;
}