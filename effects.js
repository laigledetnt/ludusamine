function applyEffect(effect, target, targetId, attackerId, scores, players, io, map, playerSocket) {
  if (!target || !players[targetId]) return;
  const activeEffects = {}; // { playerId: { ignisamine: true, freeze: false, ... } }



const emitHealthUpdate = () => {
  // Envoie au joueur ciblé uniquement
  if (playerSocket) {
    playerSocket.emit("healthUpdate", {
      id: targetId,
      health: target.health,
      maxHealth: target.maxHealth
    });
  }

  // Envoie à **tous** les autres joueurs (y compris le ciblé si tu veux) pour synchroniser
  io.emit("healthUpdate", {
    id: targetId,
    health: target.health,
    maxHealth: target.maxHealth
  });
};



  const killPlayer = () => {
    scores[attackerId] = (scores[attackerId] || 0) + 1;
    Object.assign(target, {
      health: 100,
      x: Math.random() * map.width,
      y: Math.random() * map.height,
      isFrozen: false,
      isPoisoned: false,
      isIgnisamine: false
    });

    if (playerSocket) {
      playerSocket.emit("playerDied");
    }

    emitHealthUpdate();
    io.emit("scoreBoard", scores);
  };

  // Permet d’appliquer aussi effets curatifs même si health <= 0 (optionnel)
  if (target.health <= 0 && effect !== "heal") return;

  switch (effect) {
    case "viciamine":
      const healAmount = 50; // valeur fixe que tu peux ajuster
      target.health = Math.min(target.health + healAmount, target.maxHealth);
      break;

    case "explode":
      target.health -= 40;
      break;

    case "ignisamine":
      if (!target.isIgnisamine) {
        target.isIgnisamine = true;
        let tick = 0;
        const totalTicks = 6;
        const intervalTime = 5000;
        const maxDamage = 50
        const damage = maxDamage / totalTicks;

        const interval = setInterval(() => {
          if (tick >= totalTicks || target.health <= 0) {
            clearInterval(interval);
            target.isIgnisamine = false;
            return;
          }

          target.health -= damage;
          tick++;

          emitHealthUpdate();

          if (target.health <= 0) {
            clearInterval(interval);
            target.isIgnisamine = false;
            killPlayer();
          }
        }, intervalTime);
      }
      break;

    // Ajouter d'autres effets ici, ex: "heal", "freeze", etc.
  }

  if (effect !== "ignisamine") {
    if (target.health <= 0) {
      killPlayer();
    } else {
      emitHealthUpdate();
      
    }
  }
}

module.exports={applyEffect}
