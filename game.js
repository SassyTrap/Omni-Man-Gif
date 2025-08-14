(() => {
  const ENEMY_MAX_HP = 100;
  const PLAYER_MAX_HP = 100;
  const DAMAGE_PER_HIT = 5;

  const TYPE_WEAKNESS = { fire: "water", water: "grass", grass: "fire" };
  const TYPE_EMOJI = { fire: "🔥", water: "💧", grass: "🌿" };
  const TYPE_COLOR = { fire: getCssVar("--fire"), water: getCssVar("--water"), grass: getCssVar("--grass") };

  const waterKeywords = [
    "water", "wave", "ocean", "sea", "rain", "splash", "bubble", "ice", "river", "flood", "tsunami", "droplet", "drip", "aqua", "hydro"
  ];
  const fireKeywords = [
    "fire", "flame", "lava", "ember", "heat", "burn", "inferno", "blaze", "pyro", "ignite", "torch", "smoke", "ash"
  ];
  const grassKeywords = [
    "grass", "plant", "leaf", "tree", "vine", "forest", "nature", "flower", "root", "seed", "moss", "herb", "green", "bloom", "wood"
  ];

  const bannedPool = [
    "dark", "light", "giant", "small", "cute", "evil", "dragon", "sword", "shield", "magic", "spell", "shadow", "storm", "calm", "forest", "flame", "river", "ocean", "leaf", "ember", "smoke", "ash", "snow", "cloud", "rock", "earth", "metal", "sand", "ghost", "skull", "blood", "toxic", "poison", "laser", "robot", "pixel", "future", "ancient", "ruin", "castle", "king", "queen", "knight", "portal", "neon", "glitch"
  ];

  let enemyType = randomFrom(["fire", "water", "grass"]);
  let enemyHP = ENEMY_MAX_HP;
  let playerHP = PLAYER_MAX_HP;
  let bannedWords = new Set();
  let attackInFlight = false;

  const playfield = document.getElementById("playfield");
  const enemyFill = document.getElementById("enemy-health-fill");
  const enemyPts = document.getElementById("enemy-health-points");
  const playerFill = document.getElementById("player-health-fill");
  const playerPts = document.getElementById("player-health-points");
  const enemyTypeEmoji = document.getElementById("enemy-type-emoji");
  const promptForm = document.getElementById("prompt-form");
  const promptInput = document.getElementById("prompt-input");
  const sendBtn = document.getElementById("send-btn");
  const bannedMsg = document.getElementById("banned-message");
  const endOverlay = document.getElementById("end-overlay");
  const endTitle = document.getElementById("end-title");
  const restartBtn = document.getElementById("restart-btn");
  const toast = document.getElementById("toast");

  let listenersBound = false;
  init();

  function init() {
    enemyType = randomFrom(["fire", "water", "grass"]);
    enemyHP = ENEMY_MAX_HP;
    playerHP = PLAYER_MAX_HP;
    bannedWords = chooseRandomBannedWords(bannedPool, 10);
    attackInFlight = false;

    enemyTypeEmoji.textContent = TYPE_EMOJI[enemyType];
    enemyFill.style.background = `linear-gradient(90deg, ${TYPE_COLOR[enemyType]}, #ffffff55)`;

    updateBars();
    clearChildren(playfield);
    endOverlay.hidden = true;
    promptInput.value = "";
    sendBtn.disabled = false;
    promptInput.classList.remove("has-banned");
    bannedMsg.textContent = "";

    if (!listenersBound) {
      promptInput.addEventListener("input", onInputChange);
      promptForm.addEventListener("submit", onSubmit);
      restartBtn.addEventListener("click", init);
      listenersBound = true;
    }
  }

  function onInputChange() {
    const text = promptInput.value;
    const found = findBanned(text, bannedWords);
    if (found) {
      promptInput.classList.add("has-banned");
      bannedMsg.textContent = `Banned word detected: "${found}"`;
      sendBtn.disabled = true;
    } else {
      promptInput.classList.remove("has-banned");
      bannedMsg.textContent = "";
      if (!attackInFlight) sendBtn.disabled = false;
    }
  }

  function onSubmit(e) {
    e.preventDefault();
    if (attackInFlight) return;
    const raw = promptInput.value.trim();
    if (!raw) return;

    const banned = findBanned(raw, bannedWords);
    if (banned) {
      // Block send until user removes banned word
      showToast("Remove banned word to send.");
      return;
    }

    const element = inferElementFromPrompt(raw);
    const isEffective = element === TYPE_WEAKNESS[enemyType];

    // Create projectile and animate
    attackInFlight = true;
    sendBtn.disabled = true;

    const proj = createProjectile(raw, element);
    playfield.appendChild(proj);

    const { targetLeft, targetTop } = getDemonTargetPoint();

    const start = getProjectileStartPosition();
    proj.style.left = `${start.left}px`;
    proj.style.top = `${start.top}px`;

    // Force layout so the initial position is applied before transition
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    proj.offsetHeight;

    proj.style.transition = "left 1400ms cubic-bezier(.2,.65,.3,1), top 1400ms cubic-bezier(.2,.65,.3,1)";
    proj.style.left = `${targetLeft}px`;
    proj.style.top = `${targetTop}px`;

    const onArrive = () => {
      proj.removeEventListener("transitionend", onArrive);
      spawnExplosionAt(targetLeft + proj.offsetWidth / 2, targetTop + proj.offsetHeight / 2);
      proj.remove();

      if (isEffective) {
        enemyHP = Math.max(0, enemyHP - DAMAGE_PER_HIT);
      } else {
        playerHP = Math.max(0, playerHP - DAMAGE_PER_HIT);
        flashDamage();
      }

      updateBars();
      attackInFlight = false;
      if (!promptInput.classList.contains("has-banned")) {
        sendBtn.disabled = false;
      }

      if (enemyHP <= 0) return endGame(true);
      if (playerHP <= 0) return endGame(false);
    };

    proj.addEventListener("transitionend", onArrive);

    // Clear prompt for next input
    promptInput.value = "";
    promptInput.focus();
  }

  function getDemonTargetPoint() {
    const playRect = playfield.getBoundingClientRect();
    const demon = document.getElementById("demon-sprite");
    const dRect = demon.getBoundingClientRect();
    const centerX = dRect.left - playRect.left + dRect.width / 2;
    const centerY = dRect.top - playRect.top + dRect.height * 0.4;
    return { targetLeft: Math.max(0, Math.min(playRect.width - 72, centerX - 36)), targetTop: Math.max(0, Math.min(playRect.height - 72, centerY - 36)) };
  }

  function getProjectileStartPosition() {
    const playRect = playfield.getBoundingClientRect();
    const left = playRect.width / 2 - 36 + (Math.random() * 40 - 20);
    const top = playRect.height - 84; // a bit above the bottom HUD
    return { left: clamp(left, 0, playRect.width - 72), top: clamp(top, 0, playRect.height - 72) };
  }

  function createProjectile(text, element) {
    const el = document.createElement("div");
    el.className = `projectile ${elementClass(element)}`;

    const img = document.createElement("img");
    const q = encodeURIComponent(text);
    // Unsplash Source API provides keyword-based images without an API key
    img.src = `https://source.unsplash.com/featured/72x72?${q}`;
    img.alt = text;
    img.referrerPolicy = "no-referrer";
    el.appendChild(img);

    const label = document.createElement("div");
    label.className = "label";
    label.textContent = truncate(text, 22);
    el.appendChild(label);
    return el;
  }

  function spawnExplosionAt(x, y) {
    const ex = document.createElement("div");
    ex.className = "explosion";
    ex.style.left = `${x}px`;
    ex.style.top = `${y}px`;
    const r1 = document.createElement("div"); r1.className = "ring";
    const r2 = document.createElement("div"); r2.className = "ring r2";
    const r3 = document.createElement("div"); r3.className = "ring r3";
    ex.appendChild(r1); ex.appendChild(r2); ex.appendChild(r3);
    playfield.appendChild(ex);
    setTimeout(() => ex.remove(), 800);
  }

  function flashDamage() {
    const flash = document.createElement("div");
    flash.style.position = "absolute";
    flash.style.inset = "0";
    flash.style.background = "rgba(255,0,0,0.15)";
    flash.style.animation = "flashfade 380ms ease-out forwards";
    playfield.appendChild(flash);
    const style = document.createElement("style");
    style.textContent = `@keyframes flashfade{0%{opacity:1}100%{opacity:0}}`;
    document.head.appendChild(style);
    setTimeout(() => { flash.remove(); style.remove(); }, 400);
  }

  function updateBars() {
    const ePct = Math.round((enemyHP / ENEMY_MAX_HP) * 100);
    const pPct = Math.round((playerHP / PLAYER_MAX_HP) * 100);
    enemyFill.style.width = `${ePct}%`;
    playerFill.style.width = `${pPct}%`;
    enemyPts.textContent = `${enemyHP} / ${ENEMY_MAX_HP}`;
    playerPts.textContent = `${playerHP} / ${PLAYER_MAX_HP}`;
  }

  function endGame(victory) {
    endTitle.textContent = victory ? "Victory! You defeated the demon." : "Defeat! The demon overpowered you.";
    endOverlay.hidden = false;
  }

  function inferElementFromPrompt(text) {
    const t = text.toLowerCase();
    const counts = {
      water: countMatches(t, waterKeywords),
      fire: countMatches(t, fireKeywords),
      grass: countMatches(t, grassKeywords)
    };
    let best = "neutral";
    let bestScore = 0;
    for (const k of ["water", "fire", "grass"]) {
      if (counts[k] > bestScore) {
        best = k;
        bestScore = counts[k];
      }
    }
    return bestScore === 0 ? "neutral" : best;
  }

  function countMatches(text, list) {
    let score = 0;
    for (const w of list) {
      if (text.includes(w)) score += 1;
    }
    return score;
  }

  function elementClass(element) {
    switch (element) {
      case "fire": return "element-fire";
      case "water": return "element-water";
      case "grass": return "element-grass";
      default: return "element-neutral";
    }
  }

  function chooseRandomBannedWords(pool, n) {
    const copy = [...pool];
    shuffle(copy);
    return new Set(copy.slice(0, Math.min(n, copy.length)));
  }

  function findBanned(text, set) {
    const t = text.toLowerCase();
    for (const w of set) {
      if (t.includes(w.toLowerCase())) return w;
    }
    return null;
  }

  function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
  function truncate(s, n) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function clearChildren(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function getCssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#fff"; }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 1200);
  }
})();