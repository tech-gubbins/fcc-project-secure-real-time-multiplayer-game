import Player from './Player.mjs';
import Collectible from './Collectible.mjs';

const socket = io();
const canvas = document.getElementById('game-window');
const context = canvas.getContext('2d');

// Game state
let currentPlayer = null;
let otherPlayers = [];
let collectibles = [];
let keys = {};

// Game settings
const PLAYER_SIZE = 20;
const COLLECTIBLE_SIZE = 15;
const MOVE_SPEED = 5;
const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 480;

// Initialize canvas style
canvas.style.border = '2px solid #000';
canvas.style.background = '#f0f0f0';

// Socket event handlers
socket.on('currentPlayers', (players) => {
  otherPlayers = players.filter(p => p.id !== socket.id);
  const myPlayer = players.find(p => p.id === socket.id);
  if (myPlayer) {
    currentPlayer = new Player({
      x: myPlayer.x,
      y: myPlayer.y,
      score: myPlayer.score,
      id: myPlayer.id
    });
  }
});

socket.on('newPlayer', (playerData) => {
  if (playerData.id !== socket.id) {
    otherPlayers.push(playerData);
  }
});

socket.on('playerMoved', (playerData) => {
  const player = otherPlayers.find(p => p.id === playerData.id);
  if (player) {
    player.x = playerData.x;
    player.y = playerData.y;
  }
});

socket.on('playerDisconnected', (playerId) => {
  otherPlayers = otherPlayers.filter(p => p.id !== playerId);
});

socket.on('currentCollectibles', (collectibleData) => {
  collectibles = collectibleData.map(c => new Collectible({
    x: c.x,
    y: c.y,
    value: c.value,
    id: c.id
  }));
});

socket.on('collectibleCollected', (data) => {
  // Remove the collected collectible
  collectibles = collectibles.filter(c => c.id !== data.collectibleId);
  
  // Add the new collectible
  collectibles.push(new Collectible({
    x: data.newCollectible.x,
    y: data.newCollectible.y,
    value: data.newCollectible.value,
    id: data.newCollectible.id
  }));
  
  // Update player score
  if (data.playerId === socket.id && currentPlayer) {
    currentPlayer.score = data.newScore;
  } else {
    const player = otherPlayers.find(p => p.id === data.playerId);
    if (player) {
      player.score = data.newScore;
    }
  }
});

// Input handling
document.addEventListener('keydown', (e) => {
  keys[e.key] = true;
});

document.addEventListener('keyup', (e) => {
  keys[e.key] = false;
});

// Game functions
function updatePlayer() {
  if (!currentPlayer) return;
  
  let moved = false;
  const oldX = currentPlayer.x;
  const oldY = currentPlayer.y;
  
  if (keys['ArrowUp'] || keys['w'] || keys['W']) {
    currentPlayer.movePlayer('up', MOVE_SPEED);
    moved = true;
  }
  if (keys['ArrowDown'] || keys['s'] || keys['S']) {
    currentPlayer.movePlayer('down', MOVE_SPEED);
    moved = true;
  }
  if (keys['ArrowLeft'] || keys['a'] || keys['A']) {
    currentPlayer.movePlayer('left', MOVE_SPEED);
    moved = true;
  }
  if (keys['ArrowRight'] || keys['d'] || keys['D']) {
    currentPlayer.movePlayer('right', MOVE_SPEED);
    moved = true;
  }
  
  // Keep player within canvas bounds
  currentPlayer.x = Math.max(PLAYER_SIZE/2, Math.min(CANVAS_WIDTH - PLAYER_SIZE/2, currentPlayer.x));
  currentPlayer.y = Math.max(PLAYER_SIZE/2, Math.min(CANVAS_HEIGHT - PLAYER_SIZE/2, currentPlayer.y));
  
  // Send movement to server if player moved
  if (moved && (currentPlayer.x !== oldX || currentPlayer.y !== oldY)) {
    socket.emit('playerMovement', {
      x: currentPlayer.x,
      y: currentPlayer.y
    });
  }
}

function checkCollisions() {
  if (!currentPlayer) return;
  
  collectibles.forEach(collectible => {
    // Simple distance-based collision detection
    const dx = currentPlayer.x - collectible.x;
    const dy = currentPlayer.y - collectible.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < (PLAYER_SIZE + COLLECTIBLE_SIZE) / 2) {
      socket.emit('collectibleCollected', collectible.id);
    }
  });
}

function drawPlayer(player, isCurrentPlayer = false) {
  context.fillStyle = isCurrentPlayer ? '#00f' : '#f00';
  context.fillRect(
    player.x - PLAYER_SIZE/2, 
    player.y - PLAYER_SIZE/2, 
    PLAYER_SIZE, 
    PLAYER_SIZE
  );
  
  // Draw player ID or score
  context.fillStyle = '#000';
  context.font = '12px Arial';
  context.textAlign = 'center';
  context.fillText(
    `${player.score || 0}`, 
    player.x, 
    player.y - PLAYER_SIZE/2 - 5
  );
}

function drawCollectible(collectible) {
  context.fillStyle = '#0f0';
  context.beginPath();
  context.arc(
    collectible.x, 
    collectible.y, 
    COLLECTIBLE_SIZE/2, 
    0, 
    2 * Math.PI
  );
  context.fill();
}

function drawUI() {
  if (!currentPlayer) return;
  
  // Draw score
  context.fillStyle = '#000';
  context.font = '16px Arial';
  context.textAlign = 'left';
  context.fillText(`Score: ${currentPlayer.score}`, 10, 30);
  
  // Draw rank
  const allPlayers = [currentPlayer, ...otherPlayers];
  const rank = currentPlayer.calculateRank(allPlayers);
  context.fillText(rank, 10, 50);
  
  // Draw controls
  context.font = '12px Arial';
  context.fillText('Use WASD or Arrow Keys to move', 10, CANVAS_HEIGHT - 30);
  context.fillText('Blue = You, Red = Other Players, Green = Collectibles', 10, CANVAS_HEIGHT - 15);
}

function gameLoop() {
  // Clear canvas
  context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  
  // Update game state
  updatePlayer();
  checkCollisions();
  
  // Draw everything
  if (currentPlayer) {
    drawPlayer(currentPlayer, true);
  }
  
  otherPlayers.forEach(player => {
    drawPlayer(player, false);
  });
  
  collectibles.forEach(collectible => {
    drawCollectible(collectible);
  });
  
  drawUI();
  
  requestAnimationFrame(gameLoop);
}

// Start the game loop
gameLoop();

// Show initial message
context.fillStyle = '#000';
context.font = '20px Arial';
context.textAlign = 'center';
context.fillText('Connecting...', CANVAS_WIDTH/2, CANVAS_HEIGHT/2);
