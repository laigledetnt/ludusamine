const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
 
let players = {};

io.on('connection', (socket) => {
  console.log('Un joueur est connecté :', socket.id);

  players[socket.id] = {
    id: socket.id,
    name: 'Joueur ' + socket.id,
    position: { x: 0, y: 0, z: 0 },
    rotationY: 0,
    jumpCount: 0,
    Ev:0,
    achievements: []
  };
  
  socket.emit('currentPlayers', players);

  socket.on('setPlayerName', (name) => {
    if (name && name.trim() !== '') {
      players[socket.id].name = name;
    }
    socket.broadcast.emit('playerNameUpdated', { id: socket.id, name: players[socket.id].name });
    socket.emit('playerNameUpdated', { id: socket.id, name: players[socket.id].name });
  });
  

  socket.on('playerMoved', (playerData) => {
    players[socket.id].position = {
      x: playerData.x,
      y: playerData.y,
      z: playerData.z
    };
    players[socket.id].rotationY = playerData.rotationY;

    socket.broadcast.emit('playerMoved', { id: socket.id, playerData });
  });

 socket.on('playerJumped', () => {
    players[socket.id].jumpCount++;
    checkAchievements(players[socket.id], socket);
  });
  socket.on('Evr', () => {
    players[socket.id].Ev++;
    checkAchievements(players[socket.id], socket);
  });
  
  
  socket.on('chat message', (message) => {
   
    console.log(players[socket.id].name, ':', message);
    console.log(players[socket.id].jumpCount);
    io.emit('chat message', { id: socket.id, message, name: players[socket.id].name });
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
    socket.broadcast.emit('playerDisconnected', socket.id);
  });
});

// Sert les fichiers statiques (client, éditeur, etc.)
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serveur lancé sur http://localhost:${PORT}`);
});
const achievements = {
  firstJump: {
    id: '1Jump',
    description: 'Faire son premier saut',
    condition: (player) => player.jumpCount >= 1,
  },
  strangeDiscovery: {
    id: 'E',
    description: 'Découverte EXPLOSIVE',
    condition: (player) => player.Ev >= 1,
  },
};


function checkAchievements(player, socket) {
  for (const key in achievements) {
    const achievement = achievements[key];
    if (!player.achievements.includes(achievement.id) && achievement.condition(player)) {
      player.achievements.push(achievement.id);
      socket.emit('achievementUnlocked', {
        id: achievement.id,
        description: achievement.description,
      });
    }
  }
}

