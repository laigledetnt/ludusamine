const socket = io();
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const imgPlayer = document.getElementById("img-player");
const imgPotion = document.getElementById("img-potion");
const imgTile = document.getElementById("img-tile");
const imgPotionSheet = document.getElementById("img-potion-sheet");

const map = { width: 300, height: 300 };
const keys = {};
const potions = [];
const otherPlayers = {};
const mouse = { x: canvas.width / 2, y: canvas.height / 2 };
let touchActive = false;

const player = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  size: 60,
  speed: 10,
  inventory: null,
  health: 100,
  maxHealth: 100,
  facingRight: true
};
socket.on("healthUpdate", data => {
  console.log("Health update reçue:", data);
  // Exemple : mets à jour la santé du joueur correspondant
  if (players[data.id]) {
    players[data.id].health = data.health;
    players[data.id].maxHealth = data.maxHealth;
    updateHealthBarUI(); // ta fonction pour UI
  }
});


socket.on("effectApplied", (data) => {
  console.log("Effet reçu:", data.effect);
  // Met à jour la santé ou applique l'effet visuel/sonore
  player.health = data.health;
  player.maxHealth = data.maxHealth;
  updateHealthBarUI();
});


const potionEffects = [
  // { name: "Chronoamine/i", effect: "ignisamine", spriteX: 0 },
  // { name: "Phoniamine/i", effect: "ignisamine", spriteX: 0 },
  // { name: "Aquaamine/i", effect: "ignisamine", spriteX: 0 },
  // { name: "Teleamine/i", effect: "ignisamine", spriteX: 0 },
  { name: "Ignisamine", effect: "ignisamine", spriteX: 0 },
  { name: "Viciamine", effect: "viciamine", spriteX: 0 },
  // { name: "Lubricusamine/i", effect: "ignisamine", spriteX: 0 },
  // { name: "Mentisamine/i", effect: "ignisamine", spriteX: 0 },
  // { name: "Umbraamine/i", effect: "", spriteX: 0 },
];

const menuButton = document.getElementById("toggleMenu");
const toggleBtn = document.getElementById('toggleMenu');
const menu = document.getElementById('list');

toggleBtn.addEventListener('click', () => {
  menu.classList.toggle('hidden');
});


// Gestion du canvas
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Contrôles
document.addEventListener("keydown", e => keys[e.key] = true);
document.addEventListener("keyup", e => keys[e.key] = false);
canvas.addEventListener("mousemove", e => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = e.clientX - rect.left;
  mouse.y = e.clientY - rect.top;
});
canvas.addEventListener("click", shootPotion);
canvas.addEventListener("touchstart", e => {
  const touch = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  mouse.x = touch.clientX - rect.left;
  mouse.y = touch.clientY - rect.top;
  touchActive = true;
  shootPotion();
});
canvas.addEventListener("contextmenu", e => {
  e.preventDefault(); // bloque le menu contextuel
  drinkPotion();
});

canvas.addEventListener("touchmove", e => {
  const touch = e.touches[0];
  mouse.x = touch.clientX;
  mouse.y = touch.clientY;
});
canvas.addEventListener("touchend", () => touchActive = false);

// Socket.io - Événements
socket.on("playerDisconnected", id => delete otherPlayers[id]);
socket.on("potionsUpdate", serverPotions => {
  potions.length = 0;
  potions.push(...serverPotions);
});
socket.on("potionShot", potion => potions.push(potion));
socket.on("scoreBoard", scores => console.log("Scores :", scores));
socket.on("currentPlayers", serverPlayers => {
  for (const id in serverPlayers) {
    if (id !== socket.id) {
      if (!otherPlayers[id]) otherPlayers[id] = {};
      Object.assign(otherPlayers[id], serverPlayers[id]);
    }
  }
});

socket.on("playerJoined", player => {
  if (player.id !== socket.id) {
    otherPlayers[player.id] = player;
  }
});
socket.on("playerMoved", data => {
  if (data.id === player.id) {
    Object.assign(player, data);
  } else {
    if (!otherPlayers[data.id]) otherPlayers[data.id] = {};
    Object.assign(otherPlayers[data.id], data);
  }
});
socket.on("playersUpdate", (players) => {
  for (const id in players) {
    if (!localPlayers[id]) {
      localPlayers[id] = createPlayer(players[id]);
    } else {
      Object.assign(localPlayers[id], players[id]);
    }
  }
});

let potionOnMap = generateNewPotion();
function drinkPotion() {
  if (!player.inventory) return;

  // Envoie au serveur l'effet à s'appliquer sur soi
  socket.emit("applyEffectOnSelf", player.inventory.effect);

  // On vide l'inventaire côté client
  player.inventory = null;
}

function generateNewPotion() {
  const effect = potionEffects[Math.floor(Math.random() * potionEffects.length)];
  return {
    ...effect,
    x: Math.random() * map.width,
    y: Math.random() * map.height,
    radius: 20,
    color: "orange" 
  };
}

function update() {
  // Déplacement
  if (keys["z"]) player.y -= player.speed;
  if (keys["s"]) player.y += player.speed;
  if (keys["q"]) player.x -= player.speed;
  if (keys["d"]) player.x += player.speed;

  // Collision potion
  const dx = player.x - potionOnMap.x;
  const dy = player.y - potionOnMap.y;
  const dist = Math.hypot(dx, dy);
  if (dist < player.size + potionOnMap.radius && !player.inventory) {
    player.inventory = { ...potionOnMap };
    potionOnMap.x = -1000;
    setTimeout(() => potionOnMap = generateNewPotion(), 2000);
  }

  // Orientation du regard
  const camX = player.x - canvas.width / 2;
  const mouseWorldX = mouse.x + camX;
  player.facingRight = mouseWorldX > player.x;

  // Transmission au serveur
  socket.emit("playerMove", {
    x: player.x,
    y: player.y,
    facingRight: player.facingRight,
    health: player.health,
    maxHealth: player.maxHealth
  });

  // Mort
  if (player.health <= 0) {
    socket.emit("playerDied");
    player.health = player.maxHealth;
    player.x = Math.random() * map.width;
    player.y = Math.random() * map.height;
  }

  // Limites carte
  player.x = Math.max(player.size - 32, Math.min(map.width - player.size + 32, player.x));
  player.y = Math.max(player.size - 18, Math.min(map.height - player.size + 15, player.y));
}

function shootPotion() {
  if (!player.inventory) return;

  const camX = player.x - canvas.width / 2;
  const camY = player.y - canvas.height / 2;
  const worldMouseX = mouse.x + camX;
  const worldMouseY = mouse.y + camY;
  const angle = Math.atan2(worldMouseY - player.y, worldMouseX - player.x);

  const potionShot = {
    x: player.x,
    y: player.y,
    startX: player.x,
    startY: player.y,
    angle,
    speed: 30,
    radius: 10,
    color: player.inventory.color,
    effect: player.inventory.effect
  };

  socket.emit("potionShot", potionShot);
  player.inventory = null;
}

function drawBackground(camX, camY) {
  const tileSize = 100;
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const startX = Math.max(Math.floor(camX / tileSize) * tileSize, 0);
  const startY = Math.max(Math.floor(camY / tileSize) * tileSize, 0);
  const endX = Math.min(camX + canvas.width, map.width);
  const endY = Math.min(camY + canvas.height, map.height);

  for (let x = startX; x < endX; x += tileSize) {
    for (let y = startY; y < endY; y += tileSize) {
      ctx.drawImage(imgTile, x - camX, y - camY, tileSize, tileSize);
    }
  }
}

function drawHealthBar(x, y, width, height, health, maxHealth) {
  ctx.fillStyle = "red";
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = "green";
  ctx.fillRect(x, y, (health / maxHealth) * width, height);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const camX = player.x - canvas.width / 2;
  const camY = player.y - canvas.height / 2;

  drawBackground(camX, camY);

  // Potion visible
  ctx.drawImage(
    imgPotion,
    potionOnMap.x - camX - potionOnMap.radius,
    potionOnMap.y - camY - potionOnMap.radius,
    potionOnMap.radius * 2,
    potionOnMap.radius * 2
  );

  // Joueur principal
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  if (!player.facingRight) ctx.scale(-1, 1);
  ctx.drawImage(imgPlayer, -player.size, -player.size, player.size * 2, player.size * 2);
  ctx.restore();

  drawHealthBar(canvas.width / 2 - 30, canvas.height / 2 - player.size - 20, 60, 8, player.health, player.maxHealth);

  if (player.inventory) {
    ctx.fillStyle = "white";
    ctx.font = "20px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Potion : " + player.inventory.name, canvas.width / 2, canvas.height / 2 + player.size + 30);
  }

  // Autres joueurs
  for (const id in otherPlayers) {
    const p = otherPlayers[id];
    ctx.save();
    ctx.translate(p.x - camX, p.y - camY);
    if (!p.facingRight) ctx.scale(-1, 1);
    ctx.drawImage(imgPlayer, -player.size, -player.size, player.size * 2, player.size * 2);
    ctx.restore();
    drawHealthBar(p.x - camX - 30, p.y - camY - player.size - 20, 60, 8, p.health, p.maxHealth);
  }

  // Potions tirées
  potions.forEach(p => {
    ctx.drawImage(imgPotion, p.x - camX - p.radius, p.y - camY - p.radius, p.radius * 2, p.radius * 2);
  });
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

loop();

// Rafraîchir le tableau de scores
setInterval(() => socket.emit("getScores"), 5000);

setInterval(() => {
  // Construire un objet avec id -> {health, maxHealth} pour soi et les autres joueurs
  const healthData = {};

  // Vie du joueur local
  healthData[socket.id] = {
    health: player.health,
    maxHealth: player.maxHealth
  };

  // Vie des autres joueurs connus
  for (const id in otherPlayers) {
    healthData[id] = {
      health: otherPlayers[id].health,
      maxHealth: otherPlayers[id].maxHealth
    };
  }

  // Envoyer au serveur
  socket.emit("healthStatusUpdate", healthData);
}, 1000); // toutes les secondes (ajuste la fréquence selon besoin)

socket.on("healthUpdateBulk", healthData => {
  for (const id in healthData) {
    if (id === socket.id) {
      player.health = healthData[id].health;
      player.maxHealth = healthData[id].maxHealth;
    } else if (otherPlayers[id]) {
      otherPlayers[id].health = healthData[id].health;
      otherPlayers[id].maxHealth = healthData[id].maxHealth;
    }
  }
});
socket.on("healthUpdate", data => {
  if (data.id === socket.id) {
    player.health = data.health;
    player.maxHealth = data.maxHealth;

    // Enregistre les états d'effet
    player.isIgnisamine = data.isIgnisamine;
    player.isFrozen = data.isFrozen;
    player.isPoisoned = data.isPoisoned;

    updateHealthBarUI();
  } else if (otherPlayers[data.id]) {
    otherPlayers[data.id].health = data.health;
    otherPlayers[data.id].maxHealth = data.maxHealth;

    otherPlayers[data.id].isIgnisamine = data.isIgnisamine;
    otherPlayers[data.id].isFrozen = data.isFrozen;
    otherPlayers[data.id].isPoisoned = data.isPoisoned;
  }
});

