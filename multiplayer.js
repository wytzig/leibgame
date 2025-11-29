import * as THREE from 'three';
import { setDoc, doc, deleteDoc, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

let otherPlayers = {};


function listenToPlayers(scene, userId, ui, db) {
    const playersRef = collection(db, "players");

    ui.peers.innerText = "1";

    onSnapshot(playersRef, (snap) => {
        const now = Date.now();
        snap.forEach(docSnap => {
            const id = docSnap.id;
            if (id === userId) return;
            const data = docSnap.data();

            if (!otherPlayers[id]) {
                const loader = new GLTFLoader();
                const appearance = data.appearance || { model: null, scale: 1 };

                if (appearance.model) {
                    loader.load(appearance.model,
                        (gltf) => {
                            const mesh = gltf.scene;
                            mesh.scale.set(appearance.scale, appearance.scale, appearance.scale);
                            mesh.rotation.y = data.rot;
                            mesh.position.set(data.x, data.y, data.z);

                            scene.add(mesh);
                            const label = createNameLabel(data.name || "Onbekend");
                            scene.add(label);

                            otherPlayers[id] = { mesh, label, lastSeen: Date.now() };
                        },
                        undefined,
                        (err) => {
                            console.error("Failed to load other player model:", err);
                            // fallback: simple box
                            const mesh = new THREE.Mesh(
                                new THREE.BoxGeometry(1, 2, 1),
                                new THREE.MeshStandardMaterial({ color: 0xff0000 })
                            );
                            mesh.position.set(data.x, data.y, data.z);
                            scene.add(mesh);
                            const label = createNameLabel(data.name || "Onbekend");
                            scene.add(label);

                            otherPlayers[id] = { mesh, label, lastSeen: Date.now() };
                        }
                    );
                } else {
                    // fallback cube
                    const mesh = new THREE.Mesh(
                        new THREE.BoxGeometry(1, 2, 1),
                        new THREE.MeshStandardMaterial({ color: 0xff0000 })
                    );
                    mesh.position.set(data.x, data.y, data.z);
                    scene.add(mesh);
                    const label = createNameLabel(data.name || "Onbekend");
                    scene.add(label);

                    otherPlayers[id] = { mesh, label, lastSeen: Date.now() };
                }
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

function startBroadcasting(player, userId, myName, gameState, db, auth, myAppearance) {
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
                    lastUpdate: now,
                    appearance: appearance
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

export { listenToPlayers, startBroadcasting, createNameLabel };
