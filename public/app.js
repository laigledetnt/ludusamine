const socket = io();
const map = { width: 1000, height: 1000 };
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const imgPlayer = document.getElementById("img-player");
const imgPotion = document.getElementById("img-potion");

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);
socket.on("scoreBoard", scores => {
  // Affichage simple dans la console (à améliorer)
  console.log("Scores :", scores);
});

socket.on("potionShot", potion => {
  potions.push(potion);
});


socket.on("playerDisconnected", id => {
  delete otherPlayers[id];
});

const player = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  size: 60,
  speed: 10,
  inventory: null,
  health: 100, // vie max
  maxHealth: 100
};

socket.on("playerMoved", data => {
  if (data.id === socket.id) {
    // Mise à jour du joueur local
    player.x = data.x;
    player.y = data.y;
    player.facingRight = data.facingRight;
    player.health = data.health;
    player.maxHealth = data.maxHealth;
  } else {
    // Mise à jour autres joueurs
    if (!otherPlayers[data.id]) {
      otherPlayers[data.id] = {};
    }
    Object.assign(otherPlayers[data.id], {
      x: data.x,
      y: data.y,
      facingRight: data.facingRight,
      health: data.health,
      maxHealth: data.maxHealth
    });
  }
});


const otherPlayers = {};


const keys = {};
document.addEventListener("keydown", e => keys[e.key] = true);
document.addEventListener("keyup", e => keys[e.key] = false);

const mouse = { x: canvas.width / 2, y: canvas.height / 2 };
let touchActive = false;

let potionOnMap = {
  x: Math.random() * map.width,
  y: Math.random() * map.height,
  radius: 30,
};

canvas.addEventListener("mousemove", e => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = e.clientX - rect.left;
  mouse.y = e.clientY - rect.top;
});

canvas.addEventListener("touchstart", e => {
  const rect = canvas.getBoundingClientRect();
  const touch = e.touches[0];
  mouse.x = touch.clientX - rect.left;
  mouse.y = touch.clientY - rect.top;
  touchActive = true;
  shootPotion();
});

canvas.addEventListener("touchmove", e => {
  const touch = e.touches[0];
  mouse.x = touch.clientX;
  mouse.y = touch.clientY;
});

canvas.addEventListener("touchend", () => touchActive = false);
canvas.addEventListener("click", shootPotion);

const potions = [];
const MAX_DISTANCE = 400;


function shootPotion() {
  if (!player.inventory) return;
  const potionShot = createPotionShot(player.inventory);
  socket.emit("potionShot", potionShot);
  player.inventory = null;
}

function createPotionShot(potion) {
  const camX = player.x - canvas.width / 2;
  const camY = player.y - canvas.height / 2;
  const worldMouseX = mouse.x + camX;
  const worldMouseY = mouse.y + camY;
  const angle = Math.atan2(worldMouseY - player.y, worldMouseX - player.x);



  return {
    x: player.x,
    y: player.y,
    startX: player.x,
    startY: player.y,
    angle,
    speed: 30,
    radius: 10,
    color: potion.color,
    effect: potion.effect
  };
}


function drawHealthBar(x, y, width, height, health, maxHealth) {
  ctx.fillStyle = "red";
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = "green";
  const healthWidth = (health / maxHealth) * width;
  ctx.fillRect(x, y, healthWidth, height);
}


setInterval(() => {
  socket.emit("getScores");
}, 5000);
setInterval(() => {
  io.emit("potionsUpdate", potions);
}, 50);
socket.on("potionsUpdate", serverPotions => {
  potions.length = 0;
  potions.push(...serverPotions);
});

function update() {
  // Déplacement clavier
  if (keys["z"] || keys["ArrowUp"]) player.y -= player.speed;
  if (keys["s"] || keys["ArrowDown"]) player.y += player.speed;
  if (keys["q"] || keys["ArrowLeft"]) player.x -= player.speed;
  if (keys["d"] || keys["ArrowRight"]) player.x += player.speed;

  // Déplacement tactile
  if (touchActive) {
    const dx = mouse.x - player.x;
    const dy = mouse.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 5) {
      player.x += (dx / dist) * player.speed;
      player.y += (dy / dist) * player.speed;
    }
  }



  // Ramassage de potion
  const dx = player.x - potionOnMap.x;
  const dy = player.y - potionOnMap.y;
  const dist = Math.hypot(dx, dy);
  if (dist < player.size + potionOnMap.radius && !player.inventory) {
    player.inventory = { ...potionOnMap };
    potionOnMap.x = -1000;

    setTimeout(() => {
      potionOnMap = {
        x: Math.random() * map.width,
        y: Math.random() * map.height,
        radius: 30,
      };
    }, 2000);
  }
  // Détermine la direction vers laquelle le joueur regarde
const camX = player.x - canvas.width / 2;
const mouseWorldX = mouse.x + camX;
player.facingRight = mouseWorldX > player.x;  // regarde à droite si la souris est à droite du joueur

socket.emit("playerMove", {
  x: player.x,
  y: player.y,
  facingRight: player.facingRight,
  health: player.health,
  maxHealth: player.maxHealth
});





if (player.health <= 0) {
  socket.emit("playerDied");
  player.health = player.maxHealth;
  player.x = Math.random() * map.width;
  player.y = Math.random() * map.height;
}




}

function drawGrid(camX, camY) {
  ctx.strokeStyle = "#555";
  for (let x = 0; x < map.width; x += 100) {
    ctx.beginPath();
    ctx.moveTo(x - camX, 0 - camY);
    ctx.lineTo(x - camX, map.height - camY);
    ctx.stroke();
  }
  for (let y = 0; y < map.height; y += 100) {
    ctx.beginPath();
    ctx.moveTo(0 - camX, y - camY);
    ctx.lineTo(map.width - camX, y - camY);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const camX = player.x - canvas.width / 2;
  const camY = player.y - canvas.height / 2;

  ctx.fillStyle = "#444";
  ctx.fillRect(-camX, -camY, map.width, map.height);

  drawGrid(camX, camY);

  // Potion sur la carte
  ctx.drawImage(
    imgPotion,
    potionOnMap.x - camX - potionOnMap.radius,
    potionOnMap.y - camY - potionOnMap.radius,
    potionOnMap.radius * 2,
    potionOnMap.radius * 2
  );

  // Joueur (centré)
ctx.save();
ctx.translate(canvas.width / 2, canvas.height / 2);
if (!player.facingRight) {  // pareil, inverse si regarde à gauche
  ctx.scale(-1, 1);
}
ctx.drawImage(
  imgPlayer,
  -player.size,
  -player.size,
  player.size * 2,
  player.size * 2
);
ctx.restore();



drawHealthBar(
  canvas.width / 2 - 30,
  canvas.height / 2 - player.size - 20,
  60,
  8,
  player.health,
  player.maxHealth
);



for (const id in otherPlayers) {
  const p = otherPlayers[id];
  ctx.save();
  ctx.translate(p.x - camX, p.y - camY);
  if (!p.facingRight) {  // si regarde à gauche, on inverse horizontalement
    ctx.scale(-1, 1);
  }
  ctx.drawImage(
    imgPlayer,
    -player.size,
    -player.size,
    player.size * 2,
    player.size * 2
  );
  ctx.restore();

  drawHealthBar(
    p.x - camX - 30,
    p.y - camY - player.size - 20,
    60,
    8,
    p.health,
    p.maxHealth
  );
}


  // Potions tirées
  potions.forEach(p => {
    ctx.drawImage(
      imgPotion,
      p.x - camX - p.radius,
      p.y - camY - p.radius,
      p.radius * 2,
      p.radius * 2
    );
  });
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

loop();
