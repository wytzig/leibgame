// worlds/game_main.js

// Generator logic for the main game level
export function generate(CASTLE_Z) {
    const data = {
        type: 'game', 
        platforms: [],
        coins: [],
        enemies: [],
        generatedAt: Date.now()
    };

    // Starting platform
    data.platforms.push({ x: 0, y: -2, z: 0, w: 10, h: 2, d: 10 });

    // Procedural generation
    let z = -10;
    while (z > CASTLE_Z + 20) {
        let x = (Math.random() - 0.5) * 30;
        let y = (Math.random() - 0.5) * 6;
        let w = 4 + Math.random() * 4;
        let h = 2 + Math.random() * 2;
        let d = 4 + Math.random() * 4;

        data.platforms.push({ x, y, z, w, h, d });

        if (Math.random() > 0.4) data.coins.push({ x, y: y + 3, z });
        if (Math.random() > 0.7) data.enemies.push({ x, y: y + 3, z });
        z -= (5 + Math.random() * 4);
    }
    
    // Castle platform
    data.platforms.push({ x: 0, y: 0, z: CASTLE_Z, w: 20, h: 2, d: 20 });

    return data;
}