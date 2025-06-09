const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const { applyEffect } = require("./effects"); // ta fonction d'effets

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const players = {};
const potions = [];
const scores = {};

const map = { width: 3000, height: 3000 };
const MAX_DISTANCE = 400;

io.on("connection", socket => {
  console.log("Player connected:", socket.id);

  // Initialisation du joueur
  players[socket.id] = {
    x: Math.random() * map.width,
    y: Math.random() * map.height,
    facingRight: false,
    health: 100,
    maxHealth: 100
  };

  // Envoie l'état des autres joueurs au nouveau
  for (const id in players) {
    if (id !== socket.id) {
      socket.emit("playerMoved", {
        id,
        ...players[id]
      });
    }
  }

  // Notifie les autres joueurs de ce nouveau joueur
  socket.broadcast.emit("playerMoved", {
    id: socket.id,
    ...players[socket.id]
  });

  // Déplacement d'un joueur
  socket.on("playerMove", data => {
    if (!players[socket.id]) return;

    players[socket.id].x = data.x;
    players[socket.id].y = data.y;
    players[socket.id].facingRight = data.facingRight;

    socket.broadcast.emit("playerMoved", {
      id: socket.id,
      x: data.x,
      y: data.y,
      facingRight: data.facingRight,
      health: players[socket.id].health,
      maxHealth: players[socket.id].maxHealth
    });
  });

  // Tir de potion
  socket.on("potionShot", data => {
    potions.push({
      ownerId: socket.id,
      x: data.x,
      y: data.y,
      startX: data.x,
      startY: data.y,
      angle: data.angle,
      speed: 40,
      radius: 20,
      color: data.color,
      effect: data.effect
    });
  });

  // Demande de tableau des scores
  socket.on("getScores", () => {
    socket.emit("scoreBoard", scores);
  });

  // Application d'un effet sur soi-même (via un event dédié)
  socket.on("applyEffectOnSelf", effect => {
    const playerId = socket.id;
    const player = players[playerId];
    if (!player) return;

    applyEffect(effect, player, playerId, playerId, scores, players, io, map, socket);
  });

  // Déconnexion
  socket.on("disconnect", () => {
    delete players[socket.id];
    io.emit("playerDisconnected", socket.id);
    console.log("Player disconnected:", socket.id);
  });
});

// Boucle d'update des potions : déplacement, collisions, effets
setInterval(() => {
  for (let i = potions.length - 1; i >= 0; i--) {
    const p = potions[i];

    // Déplacement
    p.x += Math.cos(p.angle) * p.speed;
    p.y += Math.sin(p.angle) * p.speed;

    // Distance parcourue
    const dx = p.x - p.startX;
    const dy = p.y - p.startY;
    const dist = Math.hypot(dx, dy);

    // Suppression si trop loin ou hors carte
    if (
      dist > MAX_DISTANCE ||
      p.x < 0 || p.x > map.width ||
      p.y < 0 || p.y > map.height
    ) {
      potions.splice(i, 1);
      continue;
    }

    // Collision avec joueurs
    for (const id in players) {
      if (id === p.ownerId) continue; // pas se blesser soi-même

      const target = players[id];
      const d = Math.hypot(p.x - target.x, p.y - target.y);

      if (d < 30) { // collision
        target.health -= 25;

        if (target.health <= 0) {
          // Score + respawn
          scores[p.ownerId] = (scores[p.ownerId] || 0) + 1;
          target.health = 100;
          target.x = Math.random() * map.width;
          target.y = Math.random() * map.height;
          // La mise à jour client se fera dans applyEffect
        }

        // Socket du joueur touché
        const targetSocket = io.sockets.sockets.get(id);

        // Applique l'effet au joueur touché
        applyEffect(p.effect, target, id, p.ownerId, scores, players, io, map, targetSocket);

        // Suppression de la potion
        potions.splice(i, 1);
        break;
      }
    }
  }

  // Envoie l'état des potions à tous les clients
  io.emit("potionsUpdate", potions);
}, 50);

// Envoie régulier de la liste des joueurs (position + vie)
setInterval(() => {
  io.emit("playersUpdate", players);
}, 50);

// Envoie périodique des vies en bulk
setInterval(() => {
  const allPlayersHealth = {};
  for (const id in players) {
    allPlayersHealth[id] = {
      health: players[id].health,
      maxHealth: players[id].maxHealth
    };
  }
  io.emit("healthUpdateBulk", allPlayersHealth);
}, 1000);

app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server listening on port", PORT);
});

