// ══════════════════════════════════════════════════════════
//  Simulateur de tir — Carabine .22 LR (organes de visée)
//  • Œilleton arrière (rear peep) + guidon annulaire à aligner
//    concentriquement sur le noir de la cible.
//  • Respiration : la tenue oscille. Un désalignement guidon/œilleton
//    au moment du lâcher dévie la balle (amplifié à la distance).
//  • 5 balles par carton, modes 20 m et 50 m, score sur 50.
//  Desktop : souris vise, clic = tir. Mobile : doigt vise, relâcher = tir.
// ══════════════════════════════════════════════════════════

const SHOTS_PER_SERIE = 5;
const TOUCH_OFFSET = 70;          // px : organes de visée au-dessus du doigt (mobile)
const MUTE_KEY = 'victoria_jeu_mute';
const bestKey = (mode) => `victoria_jeu_best_${mode}`;

// Réglages par distance.
//  targetScale : diamètre de la cible en fraction du stage (50 m = plus petit)
//  sway        : amplitude de l'oscillation de respiration
//  alignAmp    : amplitude du désalignement guidon/œilleton (fraction du guidon)
//  amplify     : facteur d'amplification de l'erreur d'alignement sur l'impact
const MODES = {
  '20': { label: '20 m', targetScale: 0.60, sway: 0.040, alignAmp: 0.10, amplify: 1.4 },
  '50': { label: '50 m', targetScale: 0.38, sway: 0.052, alignAmp: 0.12, amplify: 1.7 },
};

const stage     = document.getElementById('stage');
const target    = document.getElementById('target');
const rearPeep  = document.getElementById('rearPeep');
const frontSight = document.getElementById('frontSight');
const menu      = document.getElementById('menu');
const recap     = document.getElementById('recap');
const hint      = document.getElementById('hint');
const pellets   = document.getElementById('pellets');
const soundBtn  = document.getElementById('soundBtn');
const distChip  = document.getElementById('distChip');

const elShotNum  = document.getElementById('shotNum');
const elScoreVal = document.getElementById('scoreVal');
const elBestVal  = document.getElementById('bestVal');

// ── État ───────────────────────────────────────────────────
let mode = '20';
let cfg = MODES[mode];
let playing = false;
let shotsFired = 0, total = 0, scores = [];
let aiming = false;
let pointerKind = 'mouse';
let aimX = 0, aimY = 0;
let swayT = Math.random() * 100, alignT = Math.random() * 100;
let lastFire = 0;
let muted = localStorage.getItem(MUTE_KEY) === '1';
let impactX = 0, impactY = 0;     // point d'impact réel (calculé chaque frame)

// ── Audio synthétisé (aucun fichier requis) ────────────────
let audioCtx = null;
const ac = () => (audioCtx ??= new (window.AudioContext || window.webkitAudioContext)());
function playShot() {
  if (muted) return;
  const ctx = ac(), t = ctx.currentTime;
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.13, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.6);
  const noise = ctx.createBufferSource(); noise.buffer = buf;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 950;
  const ng = ctx.createGain(); ng.gain.setValueAtTime(0.55, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
  noise.connect(hp).connect(ng).connect(ctx.destination); noise.start(t);
  const osc = ctx.createOscillator(); osc.type = 'triangle';
  osc.frequency.setValueAtTime(190, t); osc.frequency.exponentialRampToValueAtTime(60, t + 0.11);
  const og = ctx.createGain(); og.gain.setValueAtTime(0.38, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
  osc.connect(og).connect(ctx.destination); osc.start(t); osc.stop(t + 0.13);
}
function playDing(score) {
  if (muted || score < 9) return;
  const ctx = ac(), t = ctx.currentTime;
  const osc = ctx.createOscillator(); osc.type = 'sine';
  osc.frequency.setValueAtTime(score === 10 ? 1320 : 990, t);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.25, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  osc.connect(g).connect(ctx.destination); osc.start(t); osc.stop(t + 0.3);
}

// ── Géométrie ──────────────────────────────────────────────
function metrics() {
  const r = stage.getBoundingClientRect();
  const targetR = (r.width * cfg.targetScale) / 2;   // rayon visible de la cible (px)
  return { rect: r, cx: r.width / 2, cy: r.height / 2, half: r.width / 2,
           targetR, ringUnit: (targetR * 0.92) / 10 };
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// distance au centre (px) → score 0..10
function scoreFor(dist, ringUnit) {
  const ring = Math.max(1, Math.ceil(dist / ringUnit));
  return ring > 10 ? 0 : 11 - ring;
}

// ── Dimensionne cible + organes de visée selon la distance ──
function applyMode() {
  cfg = MODES[mode];
  stage.style.setProperty('--target-size', (cfg.targetScale * 100) + '%');
  distChip.textContent = cfg.label;
  // tailles calculées depuis le stage (indépendant de la transition CSS de la cible)
  const stageW = stage.getBoundingClientRect().width;
  const tw = stageW * cfg.targetScale;
  const fs = Math.round(tw * 0.62);              // guidon : encadre le noir
  const peep = Math.round(fs * 1.9);             // œilleton : plus large, flou
  frontSight.style.setProperty('--fs-size', fs + 'px');
  rearPeep.style.setProperty('--peep-size', peep + 'px');
}

// ── Boucle de visée (respiration + alignement) ─────────────
function loop() {
  if (playing && aiming && shotsFired < SHOTS_PER_SERIE) {
    swayT += 0.018; alignT += 0.012;
    const m = metrics();
    const A = m.half * cfg.sway;                 // amplitude respiration
    // respiration : surtout verticale (le canon monte/descend)
    const bx = A * (Math.sin(swayT * 1.6) + 0.45 * Math.sin(swayT * 3.1 + 1));
    const by = A * (1.15 * Math.cos(swayT * 1.15) + 0.4 * Math.sin(swayT * 2.4 + 2));
    const holdX = clamp(aimX + bx, 0, m.rect.width);
    const holdY = clamp(aimY + by, 0, m.rect.height);

    // désalignement guidon / œilleton (lent, à corriger en visant)
    const AA = frontSight.offsetWidth * cfg.alignAmp;
    const ax = AA * Math.sin(alignT * 1.7 + 0.5);
    const ay = AA * Math.cos(alignT * 1.4);
    const frontX = holdX + ax, frontY = holdY + ay;

    // impact réel : ligne de mire amplifiée à la distance
    impactX = holdX + ax * cfg.amplify;
    impactY = holdY + ay * cfg.amplify;

    rearPeep.style.transform = `translate(${holdX}px, ${holdY}px)`;
    const ft = `translate(${frontX}px, ${frontY}px)`;
    frontSight.style.setProperty('--ft', ft);
    frontSight.style.transform = ft;
  }
  requestAnimationFrame(loop);
}

// ── Tir ────────────────────────────────────────────────────
function fire() {
  const now = performance.now();
  if (!playing || !aiming || shotsFired >= SHOTS_PER_SERIE || now - lastFire < 180) return;
  lastFire = now;

  const m = metrics();
  const x = impactX, y = impactY;
  const dist = Math.hypot(x - m.cx, y - m.cy);
  const sc = scoreFor(dist, m.ringUnit);

  scores.push(sc); total += sc; shotsFired++;
  placeImpact(x, y, sc);
  updateHUD();
  updatePellet(shotsFired - 1, sc);
  playShot(); playDing(sc);
  if (navigator.vibrate) navigator.vibrate(sc >= 9 ? [10, 30, 10] : 18);

  frontSight.classList.add('recoil');
  setTimeout(() => frontSight.classList.remove('recoil'), 220);

  if (shotsFired >= SHOTS_PER_SERIE) {
    aiming = false;
    rearPeep.classList.remove('live'); frontSight.classList.remove('live');
    setTimeout(showRecap, 650);
  } else {
    setHint();
  }
}

function placeImpact(x, y, sc) {
  const wrap = document.createElement('div');
  wrap.className = 'impact';
  wrap.style.transform = `translate(${x}px, ${y}px)`;

  const dot = document.createElement('div'); dot.className = 'impact-dot';
  const ring = document.createElement('div'); ring.className = 'impact-ring';
  const label = document.createElement('div');
  label.className = 'impact-score' + (sc === 0 ? ' miss' : sc <= 6 ? ' low' : '');
  label.textContent = sc === 0 ? 'Hors cible' : sc;
  dot.style.cssText = 'left:0;top:0;transform:translate(-50%,-50%);';
  ring.style.cssText = 'left:0;top:0;transform:translate(-50%,-50%);';
  label.style.cssText = 'left:0;top:0;';
  wrap.append(dot, ring, label);
  stage.appendChild(wrap);

  ring.animate(
    [{ transform: 'translate(-50%,-50%) scale(0)', opacity: .9 },
     { transform: 'translate(-50%,-50%) scale(3)', opacity: 0 }],
    { duration: 500, easing: 'ease-out' });
  dot.animate([{ transform: 'translate(-50%,-50%) scale(0)' }, { transform: 'translate(-50%,-50%) scale(1)' }],
    { duration: 160, easing: 'ease-out' });
  label.animate([{ opacity: 0, transform: 'translate(-50%,-120%)' }, { opacity: 1, transform: 'translate(-50%,-160%)' }],
    { duration: 200, easing: 'ease-out' });
}

// ── HUD / pastilles ────────────────────────────────────────
function updateHUD() {
  elShotNum.textContent = Math.min(shotsFired + 1, SHOTS_PER_SERIE);
  elScoreVal.textContent = total;
}
function buildPellets() {
  pellets.innerHTML = '';
  for (let i = 0; i < SHOTS_PER_SERIE; i++) {
    const p = document.createElement('div'); p.className = 'pellet'; p.textContent = '·';
    pellets.appendChild(p);
  }
}
function updatePellet(i, sc) {
  const p = pellets.children[i]; if (!p) return;
  p.textContent = sc === 0 ? '✕' : sc;
  p.classList.add(sc === 0 ? 'zero' : 'hit');
  if (sc === 10) p.classList.add('bull');
}

// ── Hint contextuel ────────────────────────────────────────
function setHint() {
  if (!playing) { hint.textContent = 'Choisissez une distance pour commencer.'; return; }
  if (pointerKind === 'touch') {
    hint.innerHTML = aiming
      ? 'Centrez le guidon sur le noir — <strong>relâchez pour tirer</strong>'
      : 'Posez le doigt sur la cible pour viser';
  } else {
    hint.innerHTML = 'Alignez le guidon dans l\'œilleton, centrez le noir — <strong>cliquez pour tirer</strong>';
  }
}

// ── Records ────────────────────────────────────────────────
function getBest(m) { return +localStorage.getItem(bestKey(m)) || 0; }
function refreshBestUI() {
  elBestVal.textContent = getBest(mode) || '—';
  const b20 = document.getElementById('best20'), b50 = document.getElementById('best50');
  if (b20) b20.textContent = 'Record : ' + (getBest('20') ? getBest('20') + '/50' : '—');
  if (b50) b50.textContent = 'Record : ' + (getBest('50') ? getBest('50') + '/50' : '—');
}

// ── Récap ──────────────────────────────────────────────────
function rating(score) {
  if (score >= 48) return '🏆 Tireur d’élite — carton quasi parfait !';
  if (score >= 42) return '🎯 Excellent groupement, bravo !';
  if (score >= 34) return '👏 Très bon carton, ça vise juste.';
  if (score >= 25) return '🙂 Bon début — la régularité viendra à l’entraînement.';
  if (score >= 15) return '💪 Continuez, le tir sportif ça se travaille.';
  return '🔰 Débutant·e — venez essayer en vrai au club !';
}
function showRecap() {
  const prev = getBest(mode);
  const isRecord = total > prev;
  const best = Math.max(total, prev);
  localStorage.setItem(bestKey(mode), best);

  document.getElementById('recapDist').textContent = cfg.label;
  document.getElementById('recapScore').textContent = total;
  document.getElementById('recapRating').textContent = rating(total);
  document.getElementById('recapBest').textContent =
    isRecord && total > 0 ? '✨ Nouveau record à ' + cfg.label + ' !' : `Record à ${cfg.label} : ${best}/50`;
  refreshBestUI();
  document.dispatchEvent(new CustomEvent('carton:fini', { detail: { mode, score: total } }));
  recap.hidden = false;
}

// ── Démarrage / reset ──────────────────────────────────────
function startCarton() {
  shotsFired = 0; total = 0; scores = [];
  stage.querySelectorAll('.impact').forEach(el => el.remove());
  buildPellets();
  updateHUD();
  recap.hidden = true; menu.hidden = true;
  playing = true;
  pointerKind = matchMedia('(pointer: coarse)').matches ? 'touch' : 'mouse';
  aiming = pointerKind === 'mouse';
  rearPeep.classList.toggle('live', aiming);
  frontSight.classList.toggle('live', aiming);
  const m = metrics(); aimX = m.cx; aimY = m.cy;
  setHint();
}
function chooseMode(m) {
  mode = m; applyMode(); refreshBestUI();
  startCarton();
}
function openMenu() {
  playing = false; aiming = false;
  rearPeep.classList.remove('live'); frontSight.classList.remove('live');
  recap.hidden = true; menu.hidden = false;
  setHint();
}

// ── Entrées pointeur ───────────────────────────────────────
function setAim(e) {
  const r = stage.getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  aimX = clamp(x, 0, r.width);
  aimY = clamp(pointerKind === 'touch' ? y - TOUCH_OFFSET : y, 0, r.height);
}
stage.addEventListener('pointermove', (e) => {
  if (!playing) return;
  pointerKind = e.pointerType === 'touch' ? 'touch' : 'mouse';
  if (pointerKind === 'mouse') {
    aiming = shotsFired < SHOTS_PER_SERIE;
    rearPeep.classList.toggle('live', aiming); frontSight.classList.toggle('live', aiming);
  }
  if (aiming) setAim(e);
});
stage.addEventListener('pointerdown', (e) => {
  if (!playing || shotsFired >= SHOTS_PER_SERIE) return;
  pointerKind = e.pointerType === 'touch' ? 'touch' : 'mouse';
  if (pointerKind === 'touch') {
    e.preventDefault();
    aiming = true;
    rearPeep.classList.add('live'); frontSight.classList.add('live');
    setAim(e); setHint();
  }
});
stage.addEventListener('pointerup', (e) => {
  if (!playing || shotsFired >= SHOTS_PER_SERIE) return;
  fire();
  if (e.pointerType === 'touch') {
    aiming = false;
    rearPeep.classList.remove('live'); frontSight.classList.remove('live');
    setHint();
  }
});
stage.addEventListener('pointerleave', (e) => {
  if (e.pointerType === 'mouse') {
    aiming = false;
    rearPeep.classList.remove('live'); frontSight.classList.remove('live');
  }
});

// ── Boutons ────────────────────────────────────────────────
document.querySelectorAll('.dist-btn').forEach(btn =>
  btn.addEventListener('click', () => chooseMode(btn.dataset.mode)));
document.getElementById('replayBtn').addEventListener('click', startCarton);
document.getElementById('changeDistBtn').addEventListener('click', openMenu);
soundBtn.addEventListener('click', () => {
  muted = !muted;
  localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  soundBtn.textContent = muted ? '🔇' : '🔊';
  soundBtn.classList.toggle('muted', muted);
  soundBtn.setAttribute('aria-pressed', String(!muted));
  if (!muted) playDing(10);
});

// ── Init ───────────────────────────────────────────────────
function init() {
  soundBtn.textContent = muted ? '🔇' : '🔊';
  soundBtn.classList.toggle('muted', muted);
  applyMode();
  refreshBestUI();
  buildPellets();
  menu.hidden = false; recap.hidden = true;
  setHint();
  loop();
}
init();
