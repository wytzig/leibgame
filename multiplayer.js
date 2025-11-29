import * as THREE from 'three';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/jsm/loaders/GLTFLoader.js';
import { setDoc, doc, deleteDoc, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

let otherPlayers = {};

function listenToPlayers(scene, userId, ui, db) {
    const playersRef = collection(db, "players");
    const loader = new GLTFLoader();

    ui.peers.innerText = "1";

    onSnapshot(playersRef, (snap) => {
        const now = Date.now();

        snap.forEach(docSnap => {
            const id = docSnap.id;
            if (id === userId) return;

            const data = docSnap.data();
            console.log(`[Firebase] Player ID: ${id}`, data);

            const appearance = data.player_appearance || { model: null, scale: 1 };
            console.log(`[Firebase] Player appearance for ${id}:`, appearance);

            if (!otherPlayers[id]) {
                // Create a container for the player
                const container = new THREE.Object3D();
                container.position.set(data.x, data.y, data.z);
                scene.add(container);

                // Name label
                const label = createNameLabel(data.name || "Onbekend");
                label.position.set(0, 2.5, 0);
                container.add(label);

                // Mesh (GLB or fallback box)
                if (appearance.model) {
                    console.log(`[Loader] Loading model for ${id}:`, appearance.model);
                    loader.load(
                        appearance.model,
                        (gltf) => {
                            console.log(`[Loader] Model loaded for ${id}`);
                            const mesh = gltf.scene;
                            mesh.scale.set(appearance.scale, appearance.scale, appearance.scale);
                            mesh.rotation.y = data.rot || 0;
                            container.add(mesh);
                            otherPlayers[id] = { container, mesh, label, lastSeen: now };
                        },
                        (progress) => {
                            if (progress.total > 0) {
                                const percent = Math.round(progress.loaded / progress.total * 100);
                                console.log(`[Loader] ${id} loading: ${percent}%`);
                            }
                        },
                        (err) => {
                            console.warn(`[Loader] Failed for ${id}, using fallback`, err);
                            const mesh = new THREE.Mesh(
                                new THREE.BoxGeometry(1, 2, 1),
                                new THREE.MeshStandardMaterial({ color: 0xff0000 })
                            );
                            container.add(mesh);
                            otherPlayers[id] = { container, mesh, label, lastSeen: now };
                        }
                    );
                } else {
                    // fallback box
                    const mesh = new THREE.Mesh(
                        new THREE.BoxGeometry(1, 2, 1),
                        new THREE.MeshStandardMaterial({ color: 0xff0000 })
                    );
                    container.add(mesh);
                    otherPlayers[id] = { container, mesh, label, lastSeen: now };
                }
            } else {
                // Smooth position update
                const player = otherPlayers[id];
                player.container.position.lerp(new THREE.Vector3(data.x, data.y, data.z), 0.3);
                if (player.mesh) player.mesh.rotation.y = data.rot || 0;
                player.lastSeen = now;
            }
        });

        // Remove old players
        for (const [id, player] of Object.entries(otherPlayers)) {
            if (now - player.lastSeen > 10000) {
                if (player.container) scene.remove(player.container);
                delete otherPlayers[id];
            }
        }

        ui.peers.innerText = Object.keys(otherPlayers).length + 1;
    }, (err) => {
        console.error("Player snapshot error:", err);
        ui.status.innerHTML = "❌ Database Toegang Geweigerd!";
    });
}

function startBroadcasting(userId, myName, db, auth) {
    console.log("🎙️ ==========================================");
    console.log("🎙️ startBroadcasting FUNCTION ENTERED");
    console.log("🎙️ userId:", userId);
    console.log("🎙️ myName:", myName);
    console.log("🎙️ db:", db);
    console.log("🎙️ auth:", auth);
    console.log("🎙️ window.player:", window.player);
    console.log("🎙️ window.gameState:", window.gameState);
    console.log("🎙️ ==========================================");
    
    let lastSent = 0;
    let lastPos = new THREE.Vector3();
    let isWriting = false;
    
    console.log("🎙️ Variables initialized");

    try {
        console.log("🎙️ About to create setInterval...");
        
        const broadcastInterval = setInterval(() => {
            console.log("⏰ INTERVAL TICK!");
            
            // Access player from window every time!
            const player = window.player;
            
            if (!player) {
                console.error("❌ window.player is NULL/UNDEFINED!");
                return;
            }
            
            console.log("📡 gameState:", window.gameState);
            console.log("📡 auth.currentUser:", auth.currentUser);
            console.log("📡 isWriting:", isWriting);
            console.log("📡 player.position:", player.position);
            
            if (window.gameState === 'playing' && auth.currentUser && !isWriting) {
                console.log("✅ ALL CONDITIONS MET!");
                const now = Date.now();
                const dist = player.position.distanceTo(lastPos);

                console.log(`📍 Distance: ${dist.toFixed(3)}, Time since last: ${now - lastSent}ms`);

                if (now - lastSent > 1000 && (dist > 0.05 || now - lastSent > 2000)) {
                    isWriting = true;
                    
                    console.log(`🚀 SENDING UPDATE NOW!`);

                    setDoc(doc(db, "players", userId), {
                        name: myName,
                        x: player.position.x,
                        y: player.position.y,
                        z: player.position.z,
                        rot: player.rotation.y,
                        lastUpdate: now,
                        player_appearance: player.userData.appearance
                    }, { merge: true })
                        .then(() => {
                            isWriting = false;
                            lastSent = now;
                            lastPos.copy(player.position);
                        })
                        .catch(err => {
                            isWriting = false;
                            console.error("❌ Write failed:", err);
                        });
                } else {
                    console.log("⏭️ Skipping update (threshold not met)");
                }
            } else {
                console.log("❌ Conditions not met:", {
                    gameState: window.gameState,
                    hasAuth: !!auth.currentUser,
                    isWriting: isWriting
                });
            }
        }, 100);
        
        console.log("🎙️ setInterval created! ID:", broadcastInterval);
        window.broadcastInterval = broadcastInterval;
        console.log("🎙️ Interval stored on window");

    } catch (error) {
        console.error("💥 ERROR CREATING INTERVAL:", error);
        console.error("💥 Stack:", error.stack);
    }

    window.addEventListener('beforeunload', () => {
        console.log("👋 Cleaning up on page unload");
        if (window.broadcastInterval) {
            clearInterval(window.broadcastInterval);
        }
        deleteDoc(doc(db, "players", userId));
    });
    
    console.log("🎙️ startBroadcasting FUNCTION COMPLETE");
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

export { listenToPlayers, startBroadcasting, createNameLabel };