const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const players = {};
const potions = [];
const scores = {};

const map = { width: 1000, height: 1000 };
const MAX_DISTANCE = 400;

io.on("connection", socket => {
  console.log("Player connected:", socket.id);

  players[socket.id] = {
    x: 0,
    y: 0,
    facingRight: false,
    health: 100,
    maxHealth: 100
  };

  for (const id in players) {
    if (id !== socket.id) {
      socket.emit("playerMoved", {
        id,
        ...players[id]
      });
    }
  }

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

  socket.on("potionShot", data => {
    potions.push({
      ownerId: socket.id,
      x: data.x,
      y: data.y,
      startX: data.x,
      startY: data.y,
      angle: data.angle,
      speed: 20,
      radius: 10,
      color: data.color,
      effect: data.effect
    });
  });

  socket.on("potionHit", ({ targetId, effect }) => {
    const target = players[targetId];
    if (!target) return;

    target.health -= 20;
    if (target.health < 0) target.health = 0;

    socket.emit("playerMove", {
      x: target.x,
      y: target.y,
      facingRight: target.facingRight
    });
  });

  socket.on("getScores", () => {
    socket.emit("scoreBoard", scores);
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    io.emit("playerDisconnected", socket.id);
    console.log("Player disconnected:", socket.id);
  });
});

setInterval(() => {
  for (let i = potions.length - 1; i >= 0; i--) {
    const p = potions[i];
    p.x += Math.cos(p.angle) * p.speed;
    p.y += Math.sin(p.angle) * p.speed;

    const dx = p.x - p.startX;
    const dy = p.y - p.startY;
    const dist = Math.hypot(dx, dy);

    if (
      dist > MAX_DISTANCE ||
      p.x < 0 || p.x > map.width ||
      p.y < 0 || p.y > map.height
    ) {
      potions.splice(i, 1);
      continue;
    }

    for (const id in players) {
      if (id === p.ownerId) continue;

      const target = players[id];
      const d = Math.hypot(p.x - target.x, p.y - target.y);

      if (d < 30) {
        target.health -= 25;
        if (target.health <= 0) {
          scores[p.ownerId] = (scores[p.ownerId] || 0) + 1;
          target.health = 100;
          target.x = Math.random() * map.width;
          target.y = Math.random() * map.height;
        }

        io.emit("playerMoved", {
          id,
          ...target
        });

        potions.splice(i, 1);
        break;
      }
    }
  }

  io.emit("potionsUpdate", potions);
}, 50);

app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server listening on port", PORT);
});

setInterval(() => {
  io.emit("playersUpdate", players);
}, 50);
