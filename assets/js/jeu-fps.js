// ══════════════════════════════════════════════════════════
//  Simulateur de tir — Vue immersive 3D (.22 LR de match)
//  Three.js : stand de tir en perspective, carabine en viewmodel
//  (modélisée en primitives), visée à l'épaule (ADS), respiration,
//  raycast pour le scoring, impacts dessinés sur la cible.
//  5 balles, modes 20 m / 50 m, score sur 50.
// ══════════════════════════════════════════════════════════

import * as THREE from 'three';

const SHOTS_PER_SERIE = 5;
const MUTE_KEY = 'victoria_jeu_mute';
const bestKey = (m) => `victoria_fps_best_${m}`;
const PLANE_SIZE = 0.55;                     // côté de la cible (m)
const FOV_HIP = 55;
const MODES = {
  '20': { label: '20 m', dist: 20, fovAds: 15, reach: 0.34, sway: 0.20 },
  '50': { label: '50 m', dist: 50, fovAds: 9,  reach: 0.34, sway: 0.24 },
};

// ── DOM ────────────────────────────────────────────────────
const stageEl  = document.getElementById('fpsStage');
const canvas   = document.getElementById('fpsCanvas');
const loadingEl = document.getElementById('fpsLoading');
const menu     = document.getElementById('menu');
const recap    = document.getElementById('recap');
const hint     = document.getElementById('hint');
const pellets  = document.getElementById('pellets');
const soundBtn = document.getElementById('soundBtn');
const distChip = document.getElementById('distChip');
const xhair    = document.getElementById('xhair');
const touchCtrl = document.getElementById('touchCtrl');
const adsBtn   = document.getElementById('adsBtn');
const fireBtn  = document.getElementById('fireBtn');
const elShotNum  = document.getElementById('shotNum');
const elScoreVal = document.getElementById('scoreVal');
const elBestVal  = document.getElementById('bestVal');

// ── État ───────────────────────────────────────────────────
let mode = '20', cfg = MODES[mode];
let playing = false;
let shotsFired = 0, total = 0;
let muted = localStorage.getItem(MUTE_KEY) === '1';
let pointerKind = matchMedia('(pointer: coarse)').matches ? 'touch' : 'mouse';
let aimX = 0, aimY = 0;            // visée normalisée [-1..1]
let ads = false, adsAmt = 0;      // visée à l'épaule (0..1)
let swayT = Math.random() * 100;
let recoilPitch = 0, recoilBack = 0;
let lastFire = 0;
let maxAng = 0.02;                 // amplitude angulaire de la visée (rad), selon distance

// ── Audio synthétisé ───────────────────────────────────────
let audioCtx = null;
const ac = () => (audioCtx ??= new (window.AudioContext || window.webkitAudioContext)());
function playShot() {
  if (muted) return;
  const ctx = ac(), t = ctx.currentTime;
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.13, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.6);
  const noise = ctx.createBufferSource(); noise.buffer = buf;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
  const ng = ctx.createGain(); ng.gain.setValueAtTime(0.6, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
  noise.connect(hp).connect(ng).connect(ctx.destination); noise.start(t);
  const osc = ctx.createOscillator(); osc.type = 'triangle';
  osc.frequency.setValueAtTime(180, t); osc.frequency.exponentialRampToValueAtTime(55, t + 0.11);
  const og = ctx.createGain(); og.gain.setValueAtTime(0.4, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
  osc.connect(og).connect(ctx.destination); osc.start(t); osc.stop(t + 0.13);
}
function playDing(sc) {
  if (muted || sc < 9) return;
  const ctx = ac(), t = ctx.currentTime;
  const osc = ctx.createOscillator(); osc.type = 'sine';
  osc.frequency.setValueAtTime(sc === 10 ? 1320 : 990, t);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.25, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  osc.connect(g).connect(ctx.destination); osc.start(t); osc.stop(t + 0.3);
}

// ── Cible : texture canvas (anneaux + impacts) ─────────────
const TEX = 1024;
let targetCanvas, targetCtx, targetTex;
function drawTargetFace() {
  const c = targetCtx, half = TEX / 2, s = half / 100;
  c.clearRect(0, 0, TEX, TEX);
  c.fillStyle = '#F3F1EA'; c.beginPath(); c.arc(half, half, 98 * s, 0, 7); c.fill();
  c.fillStyle = '#1A2B4A'; c.beginPath(); c.arc(half, half, 46 * s, 0, 7); c.fill();
  for (let i = 1; i <= 10; i++) {
    const r = (92 - (i - 1) * 9.2) * s;       // 92,82.8,...,9.2
    c.beginPath(); c.arc(half, half, r, 0, 7);
    if (r <= 46 * s) { c.strokeStyle = 'rgba(255,255,255,.7)'; }
    else { c.strokeStyle = 'rgba(26,43,74,.5)'; }
    c.lineWidth = 2.2; c.stroke();
  }
  c.fillStyle = '#C8253B'; c.beginPath(); c.arc(half, half, 9.2 * s, 0, 7); c.fill();
}
function drawHole(u, v) {
  const c = targetCtx, x = u * TEX, y = (1 - v) * TEX, r = TEX * 0.011;
  const g = c.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
  g.addColorStop(0, '#555'); g.addColorStop(1, '#0a0a0a');
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
  c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 2; c.stroke();
  targetTex.needsUpdate = true;
}

// ── Three.js ───────────────────────────────────────────────
let renderer, scene, camera, rifle, flash, flashLight, targetMesh, raycaster, sceneRoot;
const tmpV2 = new THREE.Vector2(0, 0);

function mat(color, opts = {}) { return new THREE.MeshStandardMaterial({ color, roughness: opts.r ?? 0.7, metalness: opts.m ?? 0.2 }); }

function buildRifle() {
  const g = new THREE.Group();
  const gun = mat('#2b2f37', { r: 0.5, m: 0.6 });
  const black = mat('#15181d', { r: 0.6, m: 0.4 });
  const wood = mat('#6b4a2b', { r: 0.8, m: 0.05 });
  const red = mat('#C8253B', { r: 0.5, m: 0.2 });

  const add = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.rotation.set(rx, ry, rz); g.add(me); return me;
  };
  // crosse (bois)
  add(new THREE.BoxGeometry(0.05, 0.11, 0.26), wood, 0, -0.01, 0.16);
  add(new THREE.BoxGeometry(0.045, 0.07, 0.1), wood, 0, -0.06, 0.02);     // poignée
  // boîtier / fût
  add(new THREE.BoxGeometry(0.06, 0.075, 0.42), gun, 0, 0, -0.13);
  add(new THREE.BoxGeometry(0.05, 0.05, 0.30), black, 0, -0.005, -0.34);  // garde-main
  // canon
  add(new THREE.CylinderGeometry(0.012, 0.012, 0.46, 16), black, 0, 0.012, -0.42, Math.PI / 2, 0, 0);
  // chargeur
  add(new THREE.BoxGeometry(0.022, 0.09, 0.05), black, 0, -0.07, -0.12);
  // rail / diopter arrière (œilleton)
  add(new THREE.BoxGeometry(0.014, 0.014, 0.2), black, 0, 0.05, -0.06);
  const rear = add(new THREE.TorusGeometry(0.018, 0.005, 8, 20), black, 0, 0.06, 0.02);
  rear.name = 'rear';
  // guidon annulaire avant (rouge, à centrer)
  const front = add(new THREE.TorusGeometry(0.02, 0.004, 8, 24), red, 0, 0.05, -0.6);
  front.name = 'front';
  add(new THREE.BoxGeometry(0.006, 0.05, 0.006), black, 0, 0.028, -0.6);

  // lueur de bouche (cachée par défaut)
  flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.14, 0.14),
    new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0.95, depthWrite: false })
  );
  flash.position.set(0, 0.012, -0.66); flash.visible = false; g.add(flash);
  flashLight = new THREE.PointLight('#ffc060', 0, 3); flashLight.position.set(0, 0.05, -0.66); g.add(flashLight);

  g.position.set(0.16, -0.17, -0.42);
  return g;
}

function buildLane() {
  const root = new THREE.Group();
  const dist = cfg.dist;
  const L = dist + 8;
  const H = 2.9;
  const floorMat = mat('#222d49', { r: 0.95, m: 0 });
  const wallMat = mat('#1f2b48', { r: 1, m: 0 });
  const ceilMat = mat('#1a2440', { r: 1, m: 0 });
  const backMat = mat('#141f3c', { r: 1, m: 0 });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(7, L), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, -L / 2 + 1); root.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(7, L), ceilMat);
  ceil.rotation.x = Math.PI / 2; ceil.position.set(0, H, -L / 2 + 1); root.add(ceil);
  const wl = new THREE.Mesh(new THREE.PlaneGeometry(L, H), wallMat);
  wl.rotation.y = Math.PI / 2; wl.position.set(-3.5, H / 2, -L / 2 + 1); root.add(wl);
  const wr = new THREE.Mesh(new THREE.PlaneGeometry(L, H), wallMat);
  wr.rotation.y = -Math.PI / 2; wr.position.set(3.5, H / 2, -L / 2 + 1); root.add(wr);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(7, H), backMat);
  back.position.set(0, H / 2, -dist - 1.2); root.add(back);

  // plafonniers de stand (barres lumineuses + lumière)
  const lampMat = new THREE.MeshStandardMaterial({ color: '#cfe0ff', emissive: '#9fb8e6', emissiveIntensity: 1.1, roughness: 0.6 });
  for (let z = -2; z > -dist; z -= 5) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, 0.32), lampMat);
    lamp.position.set(0, H - 0.05, z); root.add(lamp);
    const pl = new THREE.PointLight('#bcd0f5', 6, 9); pl.position.set(0, H - 0.25, z); root.add(pl);
  }

  // lignes de couloir (rouge) sur le sol
  for (const x of [-0.5, 0.5]) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.01, L - 2), mat('#C8253B', { r: 0.6 }));
    line.position.set(x, 0.011, -L / 2 + 1); root.add(line);
  }
  // potence + cadre de cible
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.65, 0.05), mat('#2a3a5c'));
  post.position.set(0, 0.82, -dist); root.add(post);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(PLANE_SIZE + 0.08, PLANE_SIZE + 0.08, 0.03), mat('#2a3a5c'));
  frame.position.set(0, 1.6, -dist - 0.02); root.add(frame);

  // cible
  targetMesh = new THREE.Mesh(new THREE.PlaneGeometry(PLANE_SIZE, PLANE_SIZE),
    new THREE.MeshStandardMaterial({ map: targetTex, roughness: 0.9, metalness: 0 }));
  targetMesh.position.set(0, 1.6, -dist); root.add(targetMesh);

  // éclairage de la cible (lisibilité à 50 m)
  const spot = new THREE.PointLight('#cfe0ff', 14, 6); spot.position.set(0, 2.6, -dist + 1.4); root.add(spot);
  return root;
}

function rebuildScene() {
  if (sceneRoot) { scene.remove(sceneRoot); }
  sceneRoot = buildLane();
  scene.add(sceneRoot);
  maxAng = Math.atan(cfg.reach / cfg.dist);    // angle pour atteindre le bord (+ marge)
}

function initThree() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#0c1424');
  scene.fog = new THREE.Fog('#0c1424', cfg.dist * 0.8, cfg.dist + 6);

  camera = new THREE.PerspectiveCamera(FOV_HIP, 16 / 10, 0.01, 300);
  camera.rotation.order = 'YXZ';
  camera.position.set(0, 1.6, 0);
  scene.add(camera);

  scene.add(new THREE.HemisphereLight('#8aa0cc', '#23304c', 1.1));
  const dir = new THREE.DirectionalLight('#ffffff', 0.8); dir.position.set(2, 6, 2); scene.add(dir);
  scene.add(new THREE.AmbientLight('#3a486a', 0.75));

  rifle = buildRifle(); camera.add(rifle);

  raycaster = new THREE.Raycaster();
  resize();
}

function resize() {
  if (!renderer) return;
  const w = stageEl.clientWidth, h = stageEl.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}

// ── Boucle ─────────────────────────────────────────────────
let flashTO = null;
function animate() {
  requestAnimationFrame(animate);
  if (!renderer) return;

  // visée à l'épaule (lerp)
  adsAmt += ((ads ? 1 : 0) - adsAmt) * 0.18;
  rifle.visible = adsAmt < 0.5;            // en visée : on efface l'arme, l'œilleton 2D prend le relais
  const fov = FOV_HIP + (cfg.fovAds - FOV_HIP) * adsAmt;
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  // pose de l'arme : épaule basse → centrée sous l'œil
  rifle.position.x = 0.16 + (-0.16) * adsAmt;
  rifle.position.y = -0.17 + (0.10) * adsAmt;          // épaulé : corps un peu plus bas
  rifle.position.z = -0.42 + (0.06) * adsAmt + recoilBack;  // épaulé : arme un peu plus loin (moins envahissante)

  // respiration (oscillation lente) + recul
  if (playing) swayT += 0.016;
  const A = maxAng * cfg.sway;
  const sYaw = A * (Math.sin(swayT * 1.5) + 0.4 * Math.sin(swayT * 3.0 + 1));
  const sPit = A * (1.1 * Math.cos(swayT * 1.15) + 0.4 * Math.sin(swayT * 2.3 + 2));

  camera.rotation.y = aimX * maxAng + sYaw;
  camera.rotation.x = aimY * maxAng + sPit + recoilPitch;

  recoilPitch *= 0.86; recoilBack *= 0.80;

  renderer.render(scene, camera);
}

// ── Tir ────────────────────────────────────────────────────
function fire() {
  const now = performance.now();
  if (!playing || shotsFired >= SHOTS_PER_SERIE || now - lastFire < 200) return;
  lastFire = now;

  raycaster.setFromCamera(tmpV2, camera);
  const hit = raycaster.intersectObject(targetMesh, false)[0];
  let sc = 0;
  if (hit && hit.uv) {
    const dx = (hit.uv.x - 0.5) * PLANE_SIZE, dy = (hit.uv.y - 0.5) * PLANE_SIZE;
    const r = Math.hypot(dx, dy), ringUnit = (PLANE_SIZE / 2 * 0.92) / 10;
    const ring = Math.max(1, Math.ceil(r / ringUnit));
    sc = ring > 10 ? 0 : 11 - ring;
    drawHole(hit.uv.x, hit.uv.y);
  }

  total += sc; shotsFired++;
  updateHUD(); updatePellet(shotsFired - 1, sc);
  playShot(); playDing(sc);
  if (navigator.vibrate) navigator.vibrate(sc >= 9 ? [10, 30, 10] : 20);

  // recul ressenti
  recoilPitch += 0.014 + Math.random() * 0.004;
  recoilBack += 0.05;
  flash.visible = true; flash.rotation.z = Math.random() * 6.28;
  flash.scale.setScalar(0.7 + Math.random() * 0.6);
  flashLight.intensity = 6;
  clearTimeout(flashTO);
  flashTO = setTimeout(() => { flash.visible = false; flashLight.intensity = 0; }, 70);
  xhair.classList.add('kick'); setTimeout(() => xhair.classList.remove('kick'), 110);

  if (shotsFired >= SHOTS_PER_SERIE) { playing = false; setTimeout(showRecap, 700); }
  else setHint();
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
function setHint() {
  if (!playing) { hint.textContent = 'Choisissez une distance pour commencer.'; return; }
  hint.innerHTML = pointerKind === 'touch'
    ? 'Glissez pour viser · <strong>Viser</strong> épaule/baisse · <strong>Tirer</strong>'
    : 'Souris pour viser · <strong>clic droit</strong> épaule/baisse · <strong>clic gauche</strong> pour tirer';
}

// ── Records ────────────────────────────────────────────────
const getBest = (m) => +localStorage.getItem(bestKey(m)) || 0;
function refreshBestUI() {
  elBestVal.textContent = getBest(mode) || '—';
  const b20 = document.getElementById('best20'), b50 = document.getElementById('best50');
  if (b20) b20.textContent = 'Record : ' + (getBest('20') ? getBest('20') + '/50' : '—');
  if (b50) b50.textContent = 'Record : ' + (getBest('50') ? getBest('50') + '/50' : '—');
}

// ── Récap ──────────────────────────────────────────────────
function rating(s) {
  if (s >= 48) return '🏆 Tireur d’élite — carton quasi parfait !';
  if (s >= 42) return '🎯 Excellent groupement, bravo !';
  if (s >= 34) return '👏 Très bon carton, ça vise juste.';
  if (s >= 25) return '🙂 Bon début — la régularité viendra à l’entraînement.';
  if (s >= 15) return '💪 Continuez, le tir sportif ça se travaille.';
  return '🔰 Débutant·e — venez essayer en vrai au club !';
}
function showRecap() {
  const prev = getBest(mode), isRecord = total > prev, best = Math.max(total, prev);
  localStorage.setItem(bestKey(mode), best);
  document.getElementById('recapDist').textContent = cfg.label;
  document.getElementById('recapScore').textContent = total;
  document.getElementById('recapRating').textContent = rating(total);
  document.getElementById('recapBest').textContent =
    isRecord && total > 0 ? '✨ Nouveau record à ' + cfg.label + ' !' : `Record à ${cfg.label} : ${best}/50`;
  refreshBestUI();
  document.dispatchEvent(new CustomEvent('carton:fini', { detail: { mode, score: total } }));
  ads = false; stageEl.classList.remove('ads');
  recap.hidden = false;
}

// ── Démarrage ──────────────────────────────────────────────
function startCarton() {
  shotsFired = 0; total = 0;
  drawTargetFace(); targetTex.needsUpdate = true;
  buildPellets(); updateHUD();
  recap.hidden = true; menu.hidden = true;
  playing = true; ads = false; stageEl.classList.remove('ads');
  aimX = 0; aimY = 0;
  setHint();
}
function chooseMode(m) {
  mode = m; cfg = MODES[m];
  distChip.textContent = cfg.label;
  scene.fog = new THREE.Fog('#0c1424', cfg.dist * 0.8, cfg.dist + 6);
  rebuildScene();
  refreshBestUI();
  startCarton();
}
function openMenu() {
  playing = false; ads = false; stageEl.classList.remove('ads');
  recap.hidden = true; menu.hidden = false; setHint();
}

// ── Entrées ────────────────────────────────────────────────
let dragLast = null;
function onMove(e) {
  if (!playing) return;
  if (pointerKind === 'mouse') {
    const r = stageEl.getBoundingClientRect();
    aimX = THREE.MathUtils.clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
    aimY = THREE.MathUtils.clamp(-(((e.clientY - r.top) / r.height) * 2 - 1), -1, 1);
  } else if (dragLast) {
    const dx = e.clientX - dragLast.x, dy = e.clientY - dragLast.y;
    aimX = THREE.MathUtils.clamp(aimX + dx / 220, -1.2, 1.2);
    aimY = THREE.MathUtils.clamp(aimY - dy / 220, -1.2, 1.2);
    dragLast = { x: e.clientX, y: e.clientY };
  }
}
stageEl.addEventListener('pointermove', onMove);
stageEl.addEventListener('pointerdown', (e) => {
  pointerKind = e.pointerType === 'touch' ? 'touch' : 'mouse';
  if (pointerKind === 'mouse') {
    if (e.button === 2) { ads = !ads; stageEl.classList.toggle('ads', ads); }   // épauler = interrupteur
    else if (e.button === 0 && playing) fire();
  } else {
    dragLast = { x: e.clientX, y: e.clientY };
  }
});
stageEl.addEventListener('pointerup', () => { dragLast = null; });
stageEl.addEventListener('pointerleave', () => { dragLast = null; });
stageEl.addEventListener('contextmenu', (e) => e.preventDefault());

// boutons tactiles
const adsOn = (v) => { ads = v; stageEl.classList.toggle('ads', v); adsBtn.classList.toggle('on', v); };
adsBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); adsOn(!ads); });   // interrupteur
fireBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); fire(); });

document.querySelectorAll('.dist-btn').forEach(b =>
  b.addEventListener('click', () => chooseMode(b.dataset.mode)));
document.getElementById('replayBtn').addEventListener('click', startCarton);
document.getElementById('changeDistBtn').addEventListener('click', openMenu);
soundBtn.addEventListener('click', () => {
  muted = !muted; localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  soundBtn.textContent = muted ? '🔇' : '🔊';
  soundBtn.classList.toggle('muted', muted);
  soundBtn.setAttribute('aria-pressed', String(!muted));
  if (!muted) playDing(10);
});
addEventListener('resize', resize);

// ── Init ───────────────────────────────────────────────────
function init() {
  soundBtn.textContent = muted ? '🔇' : '🔊';
  soundBtn.classList.toggle('muted', muted);
  if (pointerKind === 'touch') touchCtrl.hidden = false;

  targetCanvas = document.createElement('canvas');
  targetCanvas.width = targetCanvas.height = TEX;
  targetCtx = targetCanvas.getContext('2d');
  targetTex = new THREE.CanvasTexture(targetCanvas);
  targetTex.colorSpace = THREE.SRGBColorSpace;
  drawTargetFace();

  try {
    initThree();
  } catch (err) {
    loadingEl.textContent = 'Votre navigateur ne supporte pas la 3D (WebGL). Essayez la vue classique.';
    console.error(err);
    return;
  }
  rebuildScene();
  loadingEl.style.display = 'none';
  refreshBestUI();
  buildPellets();
  menu.hidden = false; recap.hidden = true;
  setHint();
  animate();
}
init();
