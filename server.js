const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const { applyEffect } = require("./effects"); // ta fonction d'effets

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const map = { width: 3000, height: 3000 };
const MAX_DISTANCE = 400;
const CAPTURE_INTERVAL = 5000;
const POTION_SPEED = 40;
const POTION_RADIUS = 20;

const spawnPoints = [
  { x: 200, y: 200 },
  { x: 2800, y: 200 },
  { x: 200, y: 2800 },
  { x: 2800, y: 2800 }
];

const mapElements = [
  // Murs extérieurs (bords de la carte)
  { id: "wall-north", type: "wall", x: 0, y: 0, width: 3000, height: 40 },
  { id: "wall-west", type: "wall", x: 0, y: 0, width: 40, height: 3000 },
  { id: "wall-south", type: "wall", x: 0, y: 2960, width: 3000, height: 40 },
  { id: "wall-east", type: "wall", x: 2960, y: 0, width: 40, height: 3000 },

  // Zone centrale (environ 1000x1000)
  { id: "center-top-left", type: "wall", x: 1000, y: 1000, width: 350, height: 40 },
  { id: "center-top-right", type: "wall", x: 1650, y: 1000, width: 350, height: 40 },
  { id: "center-bottom-left", type: "wall", x: 1000, y: 1960, width: 350, height: 40 },
  { id: "center-bottom-right", type: "wall", x: 1650, y: 1960, width: 350, height: 40 },
  { id: "center-left-top", type: "wall", x: 1000, y: 1000, width: 40, height: 350 },
  { id: "center-left-bottom", type: "wall", x: 1000, y: 1650, width: 40, height: 350 },
  { id: "center-right-top", type: "wall", x: 1960, y: 1000, width: 40, height: 350 },
  { id: "center-right-bottom", type: "wall", x: 1960, y: 1650, width: 40, height: 350 }
];

const captureZone = {
  x: 1200,
  y: 1200,
  width: 600,
  height: 600
};

const players = {};
const potions = [];

// ----------- Fonctions utilitaires -----------

function getRandomSpawn() {
  return spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
}

function isPlayerInCaptureZone(player) {
  return (
    player.x > captureZone.x &&
    player.x < captureZone.x + captureZone.width &&
    player.y > captureZone.y &&
    player.y < captureZone.y + captureZone.height
  );
}

function isCollidingWithWalls(x, y) {
  for (const element of mapElements) {
    if (element.type === "wall") {
      if (
        x > element.x &&
        x < element.x + element.width &&
        y > element.y &&
        y < element.y + element.height
      ) {
        return true;
      }
    }
  }
  return false;
}

function isPotionCollidingWithWall(p) {
  for (const wall of mapElements) {
    if (wall.type === "wall") {
      if (
        p.x > wall.x &&
        p.x < wall.x + wall.width &&
        p.y > wall.y &&
        p.y < wall.y + wall.height
      ) {
        return true;
      }
    }
  }
  return false;
}

function broadcastScores() {
  const scores = {};
  for (const id in players) {
    scores[id] = players[id].score || 0;
  }
  io.emit("updateScores", scores);
}

function handleDeath(id) {
  const player = players[id];
  if (!player) return;

  player.score = 0;
  player.health = player.maxHealth || 100;

  const spawn = getRandomSpawn();
  player.x = spawn.x;
  player.y = spawn.y;

  io.to(id).emit("respawn", {
    x: player.x,
    y: player.y,
    score: player.score
  });

  broadcastScores();
}

// ----------- Logique de capture zone -----------

setInterval(() => {
  for (const id in players) {
    const player = players[id];
    if (isPlayerInCaptureZone(player)) {
      player.score = (player.score || 0) + 1;
      io.to(id).emit("scoreUpdate", player.score);
    }
  }
  broadcastScores();
}, CAPTURE_INTERVAL);

// ----------- Gestion Socket.IO -----------

io.on("connection", socket => {
  console.log("Player connected:", socket.id);

  // Initialisation du joueur
  const spawn = getRandomSpawn();
  players[socket.id] = {
    x: spawn.x,
    y: spawn.y,
    facingRight: false,
    health: 100,
    maxHealth: 100,
    score: 0
  };

  // Envoie les murs
  socket.emit("mapElements", mapElements);

  // Envoie l'état des autres joueurs au nouveau
  for (const id in players) {
    if (id !== socket.id) {
      socket.emit("playerMoved", { id, ...players[id] });
    }
  }

  // Informe les autres du nouveau joueur
  socket.broadcast.emit("playerMoved", {
    id: socket.id,
    ...players[socket.id]
  });

  // Déplacement joueur avec collision murs
  socket.on("playerMove", data => {
    if (!players[socket.id]) return;

    if (isCollidingWithWalls(data.x, data.y)) {
      // Blocage déplacement si collision
      return;
    }

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
      speed: POTION_SPEED,
      radius: POTION_RADIUS,
      color: data.color,
      effect: data.effect
    });
  });

  // Application d'un effet sur soi-même
  socket.on("applyEffectOnSelf", effect => {
    const player = players[socket.id];
    if (!player) return;

    applyEffect(effect, player, socket.id, socket.id, null, players, io, map, socket);
  });

  // Demande tableau des scores
  socket.on("getScores", () => {
    const scores = {};
    for (const id in players) {
      scores[id] = players[id].score || 0;
    }
    socket.emit("scoreBoard", scores);
  });

  // Déconnexion
  socket.on("disconnect", () => {
    delete players[socket.id];
    io.emit("playerDisconnected", socket.id);
    console.log("Player disconnected:", socket.id);
  });
});

// ----------- Update potions -----------

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

    // Suppression potion hors limite ou collision mur
    if (
      dist > MAX_DISTANCE ||
      p.x < 0 || p.x > map.width ||
      p.y < 0 || p.y > map.height ||
      isPotionCollidingWithWall(p)
    ) {
      potions.splice(i, 1);
      continue;
    }

    // Collision avec joueurs (sauf propriétaire)
    for (const id in players) {
      if (id === p.ownerId) continue;

      const target = players[id];
      const d = Math.hypot(p.x - target.x, p.y - target.y);

      if (d < 30) {
        target.health -= 25;

        if (target.health <= 0) {
          const owner = players[p.ownerId];
          if (owner) {
            owner.score = (owner.score || 0) + 1;
          }
          handleDeath(id);
        }

        // Appliquer effet
        const targetSocket = io.sockets.sockets.get(id);
        applyEffect(p.effect, target, id, p.ownerId, null, players, io, map, targetSocket);

        // Supprimer potion
        potions.splice(i, 1);
        break;
      }
    }
  }

  io.emit("potionsUpdate", potions);
}, 50);

// ----------- Envoi régulier de l'état -----------

setInterval(() => {
  io.emit("playersUpdate", players);
}, 50);

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
