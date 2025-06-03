const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Sert les fichiers client dans le dossier "public"
app.use(express.static(path.join(__dirname, 'public')));

// Liste des joueurs connectés
const players = {};

io.on('connection', (socket) => {
  console.log(`🟢 Joueur connecté : ${socket.id}`);

  // Ajouter le joueur
  players[socket.id] = { x: 0, y: 0 };

  // Envoyer les autres joueurs au nouveau joueur
  socket.emit('currentPlayers', players);

  // Informer les autres qu’un nouveau joueur est là
  socket.broadcast.emit('newPlayer', { id: socket.id, ...players[socket.id] });

  // Mettre à jour la position d’un joueur
  socket.on('playerMovement', (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
      socket.broadcast.emit('playerMoved', { id: socket.id, x: data.x, y: data.y });
    }
  });

  // Déconnexion
  socket.on('disconnect', () => {
    console.log(`🔴 Joueur déconnecté : ${socket.id}`);
    delete players[socket.id];
    io.emit('playerDisconnected', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Serveur lancé sur http://localhost:${PORT}`);
});
