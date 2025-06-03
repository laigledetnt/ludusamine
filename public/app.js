const map = {
  width: 1000,
  height: 1000
}; 

const imgPlayer = document.getElementById("img-player");
const imgPotion = document.getElementById("img-potion");

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

const player = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  size: 20,
  speed: 10,
  color: "lime",
  inventory: null // 👈 ICI !
};


const keys = {};
document.addEventListener("keydown", e => keys[e.key] = true);
document.addEventListener("keyup", e => keys[e.key] = false);

// Souris (PC) ou doigt (mobile)
const mouse = { x: canvas.width / 2, y: canvas.height / 2 };
let touchActive = false;
let potionOnMap = {
  x: Math.random() * map.width,
  y: Math.random() * map.height,
  radius: 10,
  color: "aqua",
  effect: "slow"
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

canvas.addEventListener("touchend", () => {
  touchActive = false;
});

canvas.addEventListener("click", shootPotion);

const potions = [];

function shootPotion() {
  if (!player.inventory) return; // ❌ Pas de potion

  const camX = player.x - canvas.width / 2;
  const camY = player.y - canvas.height / 2;

  const worldMouseX = mouse.x + camX;
  const worldMouseY = mouse.y + camY;

  const angle = Math.atan2(worldMouseY - player.y, worldMouseX - player.x);

  // 🔥 Créer le tir
  potions.push({
    x: player.x,
    y: player.y,
    startX: player.x,
    startY: player.y,
    angle,
    speed: 30,
    radius: 10,
    color: player.inventory.color,
    effect: player.inventory.effect
  });

  // ✅ Supprime la potion de l'inventaire immédiatement
  player.inventory = null;
}










function update() {
  // Déplacement clavier
  if (keys["z"] || keys["ArrowUp"]) player.y -= player.speed;
  if (keys["s"] || keys["ArrowDown"]) player.y += player.speed;
  if (keys["q"] || keys["ArrowLeft"]) player.x -= player.speed;
  if (keys["d"] || keys["ArrowRight"]) player.x += player.speed;

  // Déplacement mobile : vers le doigt
  if (touchActive) {
    const dx = mouse.x - player.x;
    const dy = mouse.y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 5) {
      player.x += (dx / dist) * player.speed;
      player.y += (dy / dist) * player.speed;
    }
  }

  // Potions
  for (let i = potions.length - 1; i >= 0; i--) {
    const p = potions[i];
    p.x += Math.cos(p.angle) * p.speed;
    p.y += Math.sin(p.angle) * p.speed;
   // ✅ Bon ! Basé sur les vraies limites de la carte
if (
  p.x < 0 || p.x > map.width ||
  p.y < 0 || p.y > map.height
) {
  potions.splice(i, 1);
}

  }
  // --- Ramassage de la potion ---
const dx = player.x - potionOnMap.x;
const dy = player.y - potionOnMap.y;
const dist = Math.sqrt(dx * dx + dy * dy);

if (dist < player.size + potionOnMap.radius && !player.inventory) {
  player.inventory = { ...potionOnMap }; // copie de l’objet
  potionOnMap.x = -1000; // déplace hors écran

  setTimeout(() => {
    potionOnMap = {
      x: Math.random() * map.width,
      y: Math.random() * map.height,
      radius: 10,
      color: "aqua",
      effect: "slow"
    };
  }, 2000);
}

}
player.inventory = null; // 1 potion max pour l'instant

function draw() {
  
  

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  

  const camX = player.x - canvas.width / 2;
  const camY = player.y - canvas.height / 2;

  // --- Fond de carte ---
  ctx.fillStyle = "#444"; // fond gris foncé
  ctx.fillRect(-camX, -camY, map.width, map.height);

  // --- Quadrillage (optionnel) ---
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
  // --- Potion visible sur la carte ---
ctx.drawImage(
  imgPotion,
  potionOnMap.x - camX - potionOnMap.radius,
  potionOnMap.y - camY - potionOnMap.radius,
  potionOnMap.radius * 2,
  potionOnMap.radius * 2
);




  // --- Joueur (au centre de l’écran) ---
  ctx.drawImage(
  imgPlayer,
  canvas.width / 2 - player.size,
  canvas.height / 2 - player.size,
  player.size * 2,
  player.size * 2
);


  // --- Potions ---
 potions.forEach(p => {
  ctx.drawImage(
    imgPotion,
    p.x - camX - p.radius,
    p.y - camY - p.radius,
    p.radius * 2,
    p.radius * 2
  );
});

  
  // Ramassage de la potion
const dx = player.x - potionOnMap.x;
const dy = player.y - potionOnMap.y;
const dist = Math.sqrt(dx * dx + dy * dy);


if (dist < player.size + potionOnMap.radius && !player.inventory) {
  player.inventory = { ...potionOnMap }; // copie de l’objet
  potionOnMap.x = -1000; // déplace hors écran en attendant le respawn

  setTimeout(() => {
    potionOnMap = {
      x: Math.random() * map.width,
      y: Math.random() * map.height,
      radius: 10,
      color: "aqua",
      effect: "slow"
    };
  }, 2000); // respawn après 2 secondes
}

}



function loop() {
  update();
  
  draw();
  requestAnimationFrame(loop);
  const MAX_DISTANCE = 400; // Rayon max (en pixels)

for (let i = potions.length - 1; i >= 0; i--) {
  const p = potions[i];
  p.x += Math.cos(p.angle) * p.speed;
  p.y += Math.sin(p.angle) * p.speed;

  // Distance depuis le point de lancement
  const dx = p.x - p.startX;
  const dy = p.y - p.startY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > MAX_DISTANCE) {
    potions.splice(i, 1);
  }
}


}

loop();
