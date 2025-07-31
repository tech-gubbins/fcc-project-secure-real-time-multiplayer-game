require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const expect = require('chai');
const socket = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');

const fccTestingRoutes = require('./routes/fcctesting.js');
const runner = require('./test-runner.js');

const app = express();

// Security middleware
app.use(helmet({
  noSniff: true,
  xssFilter: true,
  noCache: true,
  hidePoweredBy: { setTo: 'PHP 7.4.3' }
}));

app.use('/public', express.static(process.cwd() + '/public'));
app.use('/assets', express.static(process.cwd() + '/assets'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

//For FCC testing purposes and enables user to connect from outside the hosting platform
app.use(cors({origin: '*'})); 

// Index page (static HTML)
app.route('/')
  .get(function (req, res) {
    res.sendFile(process.cwd() + '/views/index.html');
  }); 

//For FCC testing purposes
fccTestingRoutes(app);
    
// 404 Not Found Middleware
app.use(function(req, res, next) {
  res.status(404)
    .type('text')
    .send('Not Found');
});

const portNum = process.env.PORT || 3000;

// Set up server and tests
const server = app.listen(portNum, () => {
  console.log(`Listening on port ${portNum}`);
  if (process.env.NODE_ENV==='test') {
    console.log('Running Tests...');
    setTimeout(function () {
      try {
        runner.run();
      } catch (error) {
        console.log('Tests are not valid:');
        console.error(error);
      }
    }, 1500);
  }
});

// Socket.io setup
const io = socket(server);

// Game state
let players = [];
let collectibles = [];

// Generate random collectible
function generateCollectible() {
  return {
    x: Math.floor(Math.random() * 600) + 20, // Keep within canvas bounds
    y: Math.floor(Math.random() * 440) + 20,
    value: 1,
    id: Date.now() + Math.random()
  };
}

// Initialize with one collectible
collectibles.push(generateCollectible());

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Create new player
  const newPlayer = {
    id: socket.id,
    x: Math.floor(Math.random() * 600) + 20,
    y: Math.floor(Math.random() * 440) + 20,
    score: 0
  };
  
  players.push(newPlayer);
  
  // Send current game state to new player
  socket.emit('currentPlayers', players);
  socket.emit('currentCollectibles', collectibles);
  
  // Broadcast new player to all other players
  socket.broadcast.emit('newPlayer', newPlayer);
  
  // Handle player movement
  socket.on('playerMovement', (movementData) => {
    const player = players.find(p => p.id === socket.id);
    if (player) {
      player.x = movementData.x;
      player.y = movementData.y;
      
      // Broadcast updated player position
      socket.broadcast.emit('playerMoved', {
        id: socket.id,
        x: player.x,
        y: player.y
      });
    }
  });
  
  // Handle collectible collection
  socket.on('collectibleCollected', (collectibleId) => {
    const collectibleIndex = collectibles.findIndex(c => c.id === collectibleId);
    const player = players.find(p => p.id === socket.id);
    
    if (collectibleIndex !== -1 && player) {
      // Remove collected item
      const collected = collectibles.splice(collectibleIndex, 1)[0];
      
      // Update player score
      player.score += collected.value;
      
      // Generate new collectible
      const newCollectible = generateCollectible();
      collectibles.push(newCollectible);
      
      // Broadcast updates
      io.emit('collectibleCollected', {
        collectibleId: collectibleId,
        newCollectible: newCollectible,
        playerId: socket.id,
        newScore: player.score
      });
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    players = players.filter(p => p.id !== socket.id);
    socket.broadcast.emit('playerDisconnected', socket.id);
  });
});

module.exports = app; // For testing
