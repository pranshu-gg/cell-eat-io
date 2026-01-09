const game = Modu.createGame();
game.addPlugin(Modu.AutoRenderer, document.getElementById('game'));

const WORLD_WIDTH = 2000;
const WORLD_HEIGHT = 2000;
const FOOD_COUNT = 200;
const AI_COUNT = 5;
const BASE_SIZE = 20;
const FOOD_SIZE = 8;
const MAX_SPEED = 5;
const GROWTH_RATE = 0.5;

let playerId = 'player_' + Math.random().toString(36).substr(2, 9);
let cameraX = 0;
let cameraY = 0;
let mouseX = 400;
let mouseY = 300;

// Player cell entity
game.defineEntity('player')
    .with(Modu.Transform2D, { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 })
    .with(Modu.Sprite, { shape: 'circle', radius: BASE_SIZE, color: '#4CAF50' })
    .with(Modu.Body2D, { vx: 0, vy: 0 })
    .register();

// Remote player entity
game.defineEntity('remotePlayer')
    .with(Modu.Transform2D, { x: 0, y: 0 })
    .with(Modu.Sprite, { shape: 'circle', radius: BASE_SIZE, color: '#2196F3' })
    .register();

// Food cell entity
game.defineEntity('food')
    .with(Modu.Transform2D, { x: 0, y: 0 })
    .with(Modu.Sprite, { shape: 'circle', radius: FOOD_SIZE, color: '#FF5722' })
    .register();

// AI enemy cell entity
game.defineEntity('ai')
    .with(Modu.Transform2D, { x: 0, y: 0 })
    .with(Modu.Sprite, { shape: 'circle', radius: BASE_SIZE, color: '#9C27B0' })
    .with(Modu.Body2D, { vx: 0, vy: 0 })
    .register();

// World boundary entity
game.defineEntity('boundary')
    .with(Modu.Transform2D, { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 })
    .with(Modu.Sprite, { shape: 'rect', width: WORLD_WIDTH, height: WORLD_HEIGHT, color: 'transparent', strokeColor: '#333', strokeWidth: 4 })
    .register();

// Spawn boundary
game.spawn('boundary');

// Spawn player
const player = game.spawn('player');
let playerSize = BASE_SIZE;

// Spawn food cells
const foods = [];
for (let i = 0; i < FOOD_COUNT; i++) {
    const food = game.spawn('food');
    const transform = game.getComponent(food, Modu.Transform2D);
    transform.x = Math.random() * WORLD_WIDTH;
    transform.y = Math.random() * WORLD_HEIGHT;
    const sprite = game.getComponent(food, Modu.Sprite);
    sprite.color = `hsl(${Math.random() * 360}, 70%, 50%)`;
    foods.push({ entity: food, active: true });
}

// Spawn AI enemies
const ais = [];
for (let i = 0; i < AI_COUNT; i++) {
    const ai = game.spawn('ai');
    const transform = game.getComponent(ai, Modu.Transform2D);
    transform.x = Math.random() * WORLD_WIDTH;
    transform.y = Math.random() * WORLD_HEIGHT;
    const sprite = game.getComponent(ai, Modu.Sprite);
    sprite.color = `hsl(${Math.random() * 360}, 60%, 40%)`;
    ais.push({ entity: ai, size: BASE_SIZE + Math.random() * 20, target: null });
}

// Remote players storage
const remotePlayers = {};

// Mouse tracking
const canvas = document.getElementById('game');
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
});

// Touch support
canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    mouseX = e.touches[0].clientX - rect.left;
    mouseY = e.touches[0].clientY - rect.top;
});

// Utility functions
function getDistance(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function respawnFood(foodObj) {
    const transform = game.getComponent(foodObj.entity, Modu.Transform2D);
    transform.x = Math.random() * WORLD_WIDTH;
    transform.y = Math.random() * WORLD_HEIGHT;
    foodObj.active = true;
}

function getSpeedForSize(size) {
    return MAX_SPEED * (BASE_SIZE / size) * 1.5;
}

// Multiplayer sync
game.onSharedStateChange('players', (data) => {
    if (!data) return;
    
    for (const [id, playerData] of Object.entries(data)) {
        if (id === playerId) continue;
        
        if (!remotePlayers[id]) {
            const remote = game.spawn('remotePlayer');
            remotePlayers[id] = { entity: remote, lastUpdate: Date.now() };
        }
        
        const transform = game.getComponent(remotePlayers[id].entity, Modu.Transform2D);
        const sprite = game.getComponent(remotePlayers[id].entity, Modu.Sprite);
        transform.x = playerData.x;
        transform.y = playerData.y;
        sprite.radius = playerData.size;
        remotePlayers[id].size = playerData.size;
        remotePlayers[id].lastUpdate = Date.now();
    }
    
    // Remove disconnected players
    for (const id of Object.keys(remotePlayers)) {
        if (!data[id] || Date.now() - remotePlayers[id].lastUpdate > 3000) {
            game.destroy(remotePlayers[id].entity);
            delete remotePlayers[id];
        }
    }
});

// Main game loop
game.onUpdate((dt) => {
    const playerTransform = game.getComponent(player, Modu.Transform2D);
    const playerSprite = game.getComponent(player, Modu.Sprite);
    const playerVelocity = game.getComponent(player, Modu.Body2D);
    
    // Update camera
    cameraX = playerTransform.x - canvas.width / 2;
    cameraY = playerTransform.y - canvas.height / 2;
    
    // Apply camera offset to all entities
    game.query([Modu.Transform2D, Modu.Sprite]).forEach(entity => {
        const transform = game.getComponent(entity, Modu.Transform2D);
        const sprite = game.getComponent(entity, Modu.Sprite);
        sprite.offsetX = -cameraX;
        sprite.offsetY = -cameraY;
    });
    
    // Player movement towards mouse
    const worldMouseX = mouseX + cameraX;
    const worldMouseY = mouseY + cameraY;
    const dx = worldMouseX - playerTransform.x;
    const dy = worldMouseY - playerTransform.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist > 5) {
        const speed = getSpeedForSize(playerSize);
        playerVelocity.vx = (dx / dist) * speed;
        playerVelocity.vy = (dy / dist) * speed;
    } else {
        playerVelocity.vx = 0;
        playerVelocity.vy = 0;
    }
    
    // Apply velocity
    playerTransform.x += playerVelocity.vx;
    playerTransform.y += playerVelocity.vy;
    
    // Clamp to world bounds
    playerTransform.x = Math.max(playerSize, Math.min(WORLD_WIDTH - playerSize, playerTransform.x));
    playerTransform.y = Math.max(playerSize, Math.min(WORLD_HEIGHT - playerSize, playerTransform.y));
    
    // Update player sprite size
    playerSprite.radius = playerSize;
    
    // Check food collision
    foods.forEach(foodObj => {
        if (!foodObj.active) return;
        const foodTransform = game.getComponent(foodObj.entity, Modu.Transform2D);
        const distance = getDistance(playerTransform.x, playerTransform.y, foodTransform.x, foodTransform.y);
        
        if (distance < playerSize) {
            playerSize += GROWTH_RATE;
            foodObj.active = false;
            setTimeout(() => respawnFood(foodObj), 2000);
            foodTransform.x = -1000;
            foodTransform.y = -1000;
        }
    });
    
    // AI behavior
    ais.forEach(aiObj => {
        const aiTransform = game.getComponent(aiObj.entity, Modu.Transform2D);
        const aiVelocity = game.getComponent(aiObj.entity, Modu.Body2D);
        const aiSprite = game.getComponent(aiObj.entity, Modu.Sprite);
        
        aiSprite.radius = aiObj.size;
        
        // Find nearest target (food or smaller player)
        let targetX = null;
        let targetY = null;
        let minDist = Infinity;
        
        // Check foods
        foods.forEach(foodObj => {
            if (!foodObj.active) return;
            const foodTransform = game.getComponent(foodObj.entity, Modu.Transform2D);
            const d = getDistance(aiTransform.x, aiTransform.y, foodTransform.x, foodTransform.y);
            if (d < minDist) {
                minDist = d;
                targetX = foodTransform.x;
                targetY = foodTransform.y;
            }
        });
        
        // Check if player is smaller and nearby
        if (playerSize < aiObj.size * 0.9) {
            const d = getDistance(aiTransform.x, aiTransform.y, playerTransform.x, playerTransform.y);
            if (d < 300 && d < minDist) {
                targetX = playerTransform.x;
                targetY = playerTransform.y;
            }
        }
        
        // Flee from larger player
        if (playerSize > aiObj.size * 1.1) {
            const d = getDistance(aiTransform.x, aiTransform.y, playerTransform.x, playerTransform.y);
            if (d < 200) {
                targetX = aiTransform.x - (playerTransform.x - aiTransform.x);
                targetY = aiTransform.y - (playerTransform.y - aiTransform.y);
            }
        }
        
        // Move towards target
        if (targetX !== null) {
            const dx = targetX - aiTransform.x;
            const dy = targetY - aiTransform.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 0) {
                const speed = getSpeedForSize(aiObj.size) * 0.8;
                aiVelocity.vx = (dx / dist) * speed;
                aiVelocity.vy = (dy / dist) * speed;
            }
        }

        aiTransform.x += aiVelocity.vx;
        aiTransform.y += aiVelocity.vy;
        
        // Clamp to world
        aiTransform.x = Math.max(aiObj.size, Math.min(WORLD_WIDTH - aiObj.size, aiTransform.x));
        aiTransform.y = Math.max(aiObj.size, Math.min(WORLD_HEIGHT - aiObj.size, aiTransform.y));
        
        // AI eats food
        foods.forEach(foodObj => {
            if (!foodObj.active) return;
            const foodTransform = game.getComponent(foodObj.entity, Modu.Transform2D);
            const distance = getDistance(aiTransform.x, aiTransform.y, foodTransform.x, foodTransform.y);
            if (distance < aiObj.size) {
                aiObj.size += GROWTH_RATE * 0.5;
                foodObj.active = false;
                setTimeout(() => respawnFood(foodObj), 2000);
                foodTransform.x = -1000;
                foodTransform.y = -1000;
            }
        });
        
        // AI vs Player collision
        const playerDist = getDistance(aiTransform.x, aiTransform.y, playerTransform.x, playerTransform.y);
        if (playerDist < Math.max(aiObj.size, playerSize)) {
            if (playerSize > aiObj.size * 1.1) {
                // Player eats AI
                playerSize += aiObj.size * 0.3;
                aiObj.size = BASE_SIZE + Math.random() * 10;
                aiTransform.x = Math.random() * WORLD_WIDTH;
                aiTransform.y = Math.random() * WORLD_HEIGHT;
            } else if (aiObj.size > playerSize * 1.1) {
                // AI eats player - respawn
                playerSize = BASE_SIZE;
                playerTransform.x = Math.random() * WORLD_WIDTH;
                playerTransform.y = Math.random() * WORLD_HEIGHT;
            }
        }
    });
    
    // Remote player collision
    for (const [id, remote] of Object.entries(remotePlayers)) {
        const remoteTransform = game.getComponent(remote.entity, Modu.Transform2D);
        const dist = getDistance(playerTransform.x, playerTransform.y, remoteTransform.x, remoteTransform.y);
        if (dist < Math.max(playerSize, remote.size || BASE_SIZE)) {
            if (playerSize > (remote.size || BASE_SIZE) * 1.1) {
                playerSize += (remote.size || BASE_SIZE) * 0.3;
            } else if ((remote.size || BASE_SIZE) > playerSize * 1.1) {
                playerSize = BASE_SIZE;
                playerTransform.x = Math.random() * WORLD_WIDTH;
                playerTransform.y = Math.random() * WORLD_HEIGHT;
            }
        }
    }
    
    // Sync player state
    const currentPlayers = game.getSharedState('players') || {};
    currentPlayers[playerId] = {
        x: playerTransform.x,
        y: playerTransform.y,
        size: playerSize
    };
    game.setSharedState('players', currentPlayers);
});

game.start();