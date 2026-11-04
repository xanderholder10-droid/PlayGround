/* ==========================================================================
   TUBE FC — MATCH ENGINE
   ========================================================================== */
'use strict';

const WORLD = { w: 1440, h: 810 };
const FIELD = { x: 76, y: 100, w: 1288, h: 610 };
FIELD.right = FIELD.x + FIELD.w;
FIELD.bottom = FIELD.y + FIELD.h;
FIELD.cx = FIELD.x + FIELD.w / 2;
FIELD.cy = FIELD.y + FIELD.h / 2;
const GOAL = { half: 84, depth: 48, bar: 92 };
const BALL_R = 10.5;

const KIT_AWAY = { primary: '#ff4058', secondary: '#160d13', accent: '#ffc84a' };
const KIT_KEEPER_HOME = { primary: '#f6d447', secondary: '#111417', accent: '#4df3ff' };
const KIT_KEEPER_AWAY = { primary: '#4df3ff', secondary: '#0a1c22', accent: '#c9ff3f' };

const canvas = $('#gameCanvas');
const ctx = canvas.getContext('2d');
let G = null;
let view = { scale: 1, ox: 0, oy: 0, w: 1, h: 1, dpr: 1 };
let raf = null;
let lastFrame = 0;

function fitCanvas() {
  if (!canvas) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = window.innerWidth, h = window.innerHeight;
  view.w = w; view.h = h; view.dpr = dpr;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  const scale = Math.min(w / WORLD.w, h / WORLD.h);
  view.scale = scale;
  view.ox = (w - WORLD.w * scale) / 2;
  view.oy = (h - WORLD.h * scale) / 2;
}
window.addEventListener('resize', fitCanvas, { passive: true });
fitCanvas();

function screenToWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left - view.ox) / view.scale,
    y: (clientY - rect.top - view.oy) / view.scale
  };
}

function makePlayer(char, side, index, opts = {}) {
  const isKeeper = !!opts.keeper;
  return {
    id: `${side}_${isKeeper ? 'gk' : (index + 1)}`,
    char, side, index, isKeeper,
    x: 0, y: 0, vx: 0, vy: 0, facing: side === 'home' ? 0 : Math.PI,
    radius: isKeeper ? 20 : 17,
    speed: isKeeper ? 190 : char.speed,
    stamina: 1,
    stun: 0, slide: 0, slideDir: { x: 0, y: 0 },
    kickCooldown: 0, tackleCooldown: 0, think: Math.random() * .25,
    runPhase: Math.random() * 10, moveMag: 0,
    boost: 0, holdTimer: 0, puntPending: false, dive: 0, diveDir: 1,
    glove: opts.glove || '#c9ff3f',
    number: isKeeper ? 1 : char.number,
    isControlled: false,
    trickCooldown: 0
  };
}

function createGame(mode) {
  const fmode = mode || 'normal';
  const cfg = {
    normal: { time: 90, label: 'NORMAL', ai: .9, rewards: 1 },
    ranked: { time: 90, label: 'RANKED', ai: 1.12, rewards: 1.35 },
    freestyle: { time: 120, label: 'FREESTYLE', ai: 0, rewards: 1 }
  }[fmode];
  const players = [];
  CHARACTERS.forEach((c, i) => players.push(makePlayer(c, 'home', i)));
  if (fmode !== 'freestyle') {
    ['VEX', 'KAI'].forEach((name, i) => {
      const base = CHARACTERS[i];
      const bot = makePlayer({ ...base, name, number: i ? 11 : 4, speed: 198 + cfg.ai * 9, shotPower: .9 + cfg.ai * .1 }, 'away', i);
      bot.rivalName = name;
      players.push(bot);
    });
  }
  const keepers = [
    makePlayer({ ...CHARACTERS[0], name: 'KEEPER', number: 1, speed: 155 }, 'home', 0, { keeper: true, glove: '#c9ff3f' }),
    makePlayer({ ...CHARACTERS[1], name: 'KEEPER', number: 1, speed: 155 }, 'away', 0, { keeper: true, glove: '#4df3ff' })
  ];
  keepers.forEach(k => { k.isKeeper = true; k.speed = 190; });

  const ball = {
    x: FIELD.cx, y: FIELD.cy, vx: 0, vy: 0, z: 0, vz: 0, spin: 0,
    rotation: 0, owner: null, noPickup: 0, lastTouch: null, shot: null, skin: itemOf(save.ball)?.skin || 'classic'
  };

  const g = {
    mode: fmode, cfg, players, keepers, ball, all: [...players, ...keepers],
    phase: 'countdown', phaseTimer: 3.15, countdown: 3, lastCount: 4,
    timeLeft: cfg.time, elapsed: 0, golden: false, ended: false,
    score: { home: 0, away: 0 }, style: 0, combo: 0, comboTimer: 0, bestCombo: 0,
    tricks: 0, saves: 0, possessionSide: null, lastShotDetail: '',
    charging: false, charge: 0, pointer: { x: FIELD.right - 180, y: FIELD.cy },
    keys: new Set(), trick: null, controlledId: null, selectedId: 'home_1',
    particles: [], floaters: [], trail: [], shake: 0, flash: 0, flashColor: '#c9ff3f',
    restart: null, setpiece: null, active: true, paused: false,
    introDone: false, timeScale: 1, possessionFlash: 0, autoDefenderFor: null,
    goalBy: null, kickoffSide: 'home', lastTrickName: '',
    stats: { shots: 0, passes: 0, tackles: 0, saves: 0, tricks: 0 }
  };
  resetKickoff(g, 'home');
  setControlled(g, g.players[0]);
  return g;
}

function resetKickoff(g, side) {
  const b = g.ball;
  b.x = FIELD.cx; b.y = FIELD.cy; b.vx = 0; b.vy = 0; b.z = 0; b.vz = 0; b.spin = 0;
  b.owner = null; b.noPickup = 0; b.shot = null; b.lastTouch = null;
  const home = g.players.filter(p => p.side === 'home');
  const away = g.players.filter(p => p.side === 'away');
  home.forEach((p, i) => {
    p.x = FIELD.cx - (i === 0 ? 58 : 170) + (side === 'home' ? 0 : -70);
    p.y = FIELD.cy + (i === 0 ? 0 : (i % 2 ? -92 : 92));
    p.vx = 0; p.vy = 0; p.stun = 0; p.slide = 0;
    p.trickCooldown = 0;
    p.facing = 0;
  });
  away.forEach((p, i) => {
    p.x = FIELD.cx + (i === 0 ? 88 : 210) + (side === 'away' ? 56 : 0);
    p.y = FIELD.cy + (i === 0 ? 0 : (i % 2 ? 96 : -96));
    p.vx = 0; p.vy = 0; p.stun = 0; p.slide = 0;
    p.facing = Math.PI;
  });
  const hk = g.keepers.find(k => k.side === 'home');
  const ak = g.keepers.find(k => k.side === 'away');
  hk.x = FIELD.x + 38; hk.y = FIELD.cy; hk.vx = 0; hk.vy = 0; hk.dive = 0; hk.holdTimer = 0; hk.puntPending = false;
  ak.x = FIELD.right - 38; ak.y = FIELD.cy; ak.vx = 0; ak.vy = 0; ak.dive = 0; ak.holdTimer = 0; ak.puntPending = false;
  const taker = side === 'home' ? home[0] : away[0];
  if (taker) {
    taker.x = FIELD.cx + (side === 'home' ? -24 : 24); taker.y = FIELD.cy;
    b.owner = taker; b.x = taker.x + (side === 'home' ? 22 : -22); b.y = taker.y;
    b.lastTouch = taker;
  }
  g.trick = null;
  g.autoDefenderFor = null;
  g.combo = 0; g.comboTimer = 0;
  setControlled(g, home[0]);
}

function setControlled(g, p) {
  if (!p) return;
  g.players.forEach(x => x.isControlled = false);
  p.isControlled = true;
  g.controlledId = p.id;
  g.selectedId = p.id;
}
function controlled(g) {
  return g.players.find(p => p.id === g.controlledId) || g.players[0];
}
function teammateOf(g, p) {
  return g.players.find(x => x.side === p.side && x !== p);
}
function nearestOpponent(g, p) {
  let best = null, bd = Infinity;
  for (const q of g.players) {
    if (q.side === p.side) continue;
    const d = dist(p, q);
    if (d < bd) { bd = d; best = q; }
  }
  return { player: best, d: bd };
}
function keeperOf(g, side) { return g.keepers.find(k => k.side === side); }
function goalMouthY() {
  return { top: FIELD.cy - GOAL.half, bottom: FIELD.cy + GOAL.half, center: FIELD.cy };
}
function attackingDir(side) { return side === 'home' ? 1 : -1; }
function targetGoalX(side) { return side === 'home' ? FIELD.right : FIELD.x; }

function updateControlled(g) {
  const b = g.ball;
  if (b.owner && b.owner.side === 'home') {
    g.autoDefenderFor = null;
    if (!b.owner.isKeeper && g.controlledId !== b.owner.id) setControlled(g, b.owner);
    return;
  }
  if (b.owner && b.owner.side === 'away') {
    // Auto-pick the nearest defender once on a turnover, then respect manual Q switches.
    if (g.autoDefenderFor !== b.owner.id) {
      g.autoDefenderFor = b.owner.id;
      const nearest = g.players.filter(p => p.side === 'home').sort((a, c) => dist(a, b) - dist(c, b))[0];
      if (nearest) setControlled(g, nearest);
    }
    return;
  }
  // Loose ball or our keeper has it: keep the player's current choice.
}

/* ------------------------------------------------------------------ input */
function isTypingTarget(t) {
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
}
function onKeyDown(e) {
  if (!G || !G.active || G.phase === 'ended' || isTypingTarget(e.target)) return;
  const tag = e.code;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyQ', 'KeyE', 'KeyT', 'KeyX', 'Escape', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight', 'KeyP'].includes(tag)) {
    e.preventDefault();
  }
  if (tag === 'Escape' || tag === 'KeyP') { if (G.phase !== 'ended' && G.phase !== 'countdown') togglePause(); return; }
  if (G.phase === 'paused' || G.phase === 'ended') return;
  G.keys.add(tag);
  const p = controlled(G);
  if (tag === 'Space' && !e.repeat) {
    if (G.phase === 'play' && G.ball.owner === p && !G.trick) beginCharge(G);
  }
  if (tag === 'KeyE' && !e.repeat && G.phase === 'play') performPass(G, p);
  if (tag === 'KeyQ' && !e.repeat) switchPlayer(G);
  if (tag === 'KeyT' && !e.repeat && G.phase === 'play') startTrick(G, p);
  if (tag === 'KeyX' && !e.repeat && G.phase === 'play') tackle(G, p);
  if (G.trick && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(tag)) trickInput(G, tag);
}
function onKeyUp(e) {
  if (!G) return;
  G.keys.delete(e.code);
  if (e.code === 'Space' && G.charging) releaseShot(G);
}
window.addEventListener('keydown', onKeyDown);
window.addEventListener('keyup', onKeyUp);

function bindGamePointer() {
  if (!canvas || canvas.dataset.bound) return;
  canvas.dataset.bound = '1';
  const move = e => {
    if (!G) return;
    const p = screenToWorld(e.clientX, e.clientY);
    G.pointer.x = clamp(p.x, FIELD.x, FIELD.right);
    G.pointer.y = clamp(p.y, FIELD.y, FIELD.bottom);
  };
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerdown', e => {
    if (!G || G.phase !== 'play') return;
    Sound.init(); move(e);
    if (e.button === 0 && G.ball.owner === controlled(G) && !G.trick) beginCharge(G);
  });
  canvas.addEventListener('pointerup', () => {
    if (!G) return;
    if (G.charging && G.ball.owner === controlled(G)) releaseShot(G);
  });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
}
bindGamePointer();

function beginCharge(g) {
  const p = controlled(g);
  if (g.ball.owner !== p || g.trick || p.stun > 0) return;
  g.charging = true; g.charge = .04;
  Sound.init();
}
function releaseShot(g) {
  if (!g.charging) return;
  const p = controlled(g);
  g.charging = false;
  const power = clamp(g.charge, .12, 1);
  g.charge = 0;
  if (g.ball.owner !== p) return;
  performShot(g, p, power, g.pointer.x, g.pointer.y);
}

function performShot(g, p, power, tx, ty, ai = false) {
  if (g.ball.owner !== p) return;
  const b = g.ball;
  const dx = tx - p.x, dy = ty - p.y;
  const length = Math.hypot(dx, dy) || 1;
  let angle = Math.atan2(dy, dx);
  const opp = nearestOpponent(g, p);
  const pressure = opp.d < 110 ? (1 - opp.d / 130) : 0;
  const skill = (p.char?.stats?.shot || 7) / 10;
  let errorBase = (0.022 + pressure * .085 + Math.min(.06, length / 4400)) * (1.18 - skill * .3) * (1 + power * .22);
  if (p.boost > 0) errorBase *= .45;
  if (ai) errorBase = ai === 'hard' ? .03 : ai === 'easy' ? .08 : .05;
  const error = (Math.random() + Math.random() - 1) * errorBase;
  angle += error;
  const speed = (480 + power * 610) * (p.char?.shotPower || 1) * (1 + (p.boost > 0 ? .12 : 0));
  b.owner = null;
  b.noPickup = .22;
  b.lastTouch = p;
  b.x = p.x + Math.cos(angle) * 23;
  b.y = p.y + Math.sin(angle) * 23;
  b.vx = Math.cos(angle) * speed;
  b.vy = Math.sin(angle) * speed;
  b.z = 2;
  b.vz = 34 + power * 112;
  b.spin = (p.vx * Math.cos(angle + Math.PI / 2) + p.vy * Math.sin(angle + Math.PI / 2)) * .0005;
  b.rotation = angle;
  b.shot = { team: p.side, by: p, resolved: false, onTarget: null, power, time: 0, xOrigin: p.x };
  p.kickCooldown = .28;
  p.facing = angle;
  g.stats.shots++;
  g.charging = false;
  g.charge = 0;
  g.shake = Math.max(g.shake, .8 + power * 1.5);
  spawnDust(g, b.x, b.y, 7, '#d8e2c5');
  Sound.kick(power);
  if (power > .7) addFloater(g, p.x, p.y - 40, pick(['BANGER!', 'TOP BINS?', 'UNLEASHED']), '#c9ff3f', 1);
}
function performPass(g, p, target = null, power = .72) {
  if (g.ball.owner !== p || p.stun > 0) return;
  g.charging = false; g.charge = 0;
  const mate = target || teammateOf(g, p);
  if (!mate) return;
  const lead = clamp(dist(p, mate) / 600, .1, 1);
  const tx = mate.x + mate.vx * .22 * lead;
  const ty = mate.y + mate.vy * .22 * lead;
  const angle = Math.atan2(ty - p.y, tx - p.x);
  const d = Math.hypot(tx - p.x, ty - p.y);
  const speed = clamp(360 + d * .8, 430, 810) * power * 1.4;
  const b = g.ball;
  b.owner = null; b.noPickup = .12; b.lastTouch = p;
  b.x = p.x + Math.cos(angle) * 22; b.y = p.y + Math.sin(angle) * 22;
  b.vx = Math.cos(angle) * speed; b.vy = Math.sin(angle) * speed;
  b.z = d > 380 ? 7 : 0; b.vz = d > 380 ? 46 : 0;
  b.shot = null; b.spin = 0; b.rotation = angle;
  p.kickCooldown = .22; p.facing = angle;
  g.stats.passes++;
  spawnDust(g, b.x, b.y, 4, '#eaf7e2');
  Sound.pass();
  addFloater(g, p.x, p.y - 35, pick(['PASS', 'RECEIVE', 'SWING IT']), '#b7c5ba', .65);
}
function switchPlayer(g) {
  if (g.ball.owner?.side === 'home' && g.ball.owner.isKeeper) { addFloater(g, g.ball.owner.x, g.ball.owner.y - 40, 'KEEPER BALL', '#ffc84a', .8); return; }
  if (g.ball.owner?.side === 'home' && !g.ball.owner.isKeeper) {
    addFloater(g, g.ball.owner.x, g.ball.owner.y - 40, 'AUTO: BALL CARRIER', '#c9ff3f', .8);
    return;
  }
  const cur = controlled(g);
  const other = g.players.find(p => p.side === 'home' && p !== cur);
  if (other) { setControlled(g, other); Sound.ui(); addFloater(g, other.x, other.y - 38, 'ON YOU', '#c9ff3f', .7); }
}

/* ------------------------------------------------------------------ tricks */
const TRICKS = [
  { name: 'ELASTICO', seq: ['ArrowLeft', 'ArrowRight'], points: 160 },
  { name: 'SOMBRERO', seq: ['ArrowUp', 'ArrowDown', 'ArrowUp'], points: 220 },
  { name: 'RABONA', seq: ['ArrowDown', 'ArrowRight', 'ArrowUp'], points: 240 },
  { name: 'STEPOVER', seq: ['ArrowLeft', 'ArrowRight', 'ArrowLeft'], points: 210 },
  { name: 'RAINBOW FLICK', seq: ['ArrowUp', 'ArrowDown', 'ArrowUp', 'ArrowUp'], points: 300 },
  { name: 'NO-LOOK TOE', seq: ['ArrowRight', 'ArrowDown', 'ArrowLeft'], points: 250 }
];
function startTrick(g, p) {
  if (g.ball.owner !== p || g.phase !== 'play' || g.trick) return;
  if (p.trickCooldown > 0) { addFloater(g, p.x, p.y - 38, 'CATCH YOUR BREATH', '#8c969f', .7); return; }
  g.charging = false; g.charge = 0;
  const template = pick(TRICKS);
  g.trick = { ...template, seq: [...template.seq], idx: 0, time: 1.9, maxTime: 1.9, owner: p };
  Sound.tone(720, .06, 'triangle', .025);
  $('#trickHud').classList.add('is-active');
  $('#trickName').textContent = template.name;
  renderTrickKeys(g);
}
function renderTrickKeys(g) {
  const box = $('#trickKeys');
  if (!g.trick) { box.innerHTML = ''; return; }
  const icon = k => k === 'ArrowUp' ? '↑' : k === 'ArrowDown' ? '↓' : k === 'ArrowLeft' ? '←' : '→';
  box.innerHTML = g.trick.seq.map((k, i) => `<span class="trick-key ${i < g.trick.idx ? 'is-done' : i === g.trick.idx ? 'is-next' : ''}">${icon(k)}</span>`).join('');
  $('#trickTimerBar').style.width = `${clamp(g.trick.time / g.trick.maxTime, 0, 1) * 100}%`;
}
function trickInput(g, code) {
  if (!g.trick) return;
  if (g.trick.seq[g.trick.idx] === code) {
    g.trick.idx++;
    Sound.tone(600 + g.trick.idx * 120, .04, 'square', .02);
    if (g.trick.idx >= g.trick.seq.length) trickSuccess(g);
    else renderTrickKeys(g);
  } else {
    trickFail(g, 'WRONG READ');
  }
}
function trickSuccess(g) {
  const p = g.trick.owner;
  if (!p) { g.trick = null; return; }
  g.combo = g.comboTimer > 0 ? g.combo + 1 : 1;
  g.comboTimer = 5.5;
  g.bestCombo = Math.max(g.bestCombo, g.combo);
  const pts = Math.round(g.trick.points * (1 + (g.combo - 1) * .32));
  g.style += pts;
  g.tricks++; g.stats.tricks++;
  p.boost = 3;
  p.trickCooldown = 3.2;
  g.ball.noPickup = .25;
  g.shake = 2.4;
  for (const q of g.players) {
    if (q.side !== p.side && dist(q, p) < 112) { q.stun = .65; addFloater(g, q.x, q.y - 28, 'ANKLES', '#ff4d9d', .7); }
  }
  const dir = attackingDir(p.side);
  p.vx += dir * 56; p.vy += (Math.random() - .5) * 30;
  spawnBurst(g, p.x, p.y, '#c9ff3f', 18);
  addFloater(g, p.x, p.y - 55, `${g.trick.name} ×${g.combo}`, '#c9ff3f', 1.3);
  addFloater(g, p.x, p.y - 78, `+${pts} STYLE`, '#fff', .9);
  Sound.trick();
  save.stats.tricks++;
  g.lastTrickName = g.trick.name;
  g.trick = null;
  $('#trickHud').classList.remove('is-active');
}
function trickFail(g, reason = 'MISSED') {
  if (!g.trick) return;
  const p = g.trick.owner;
  if (p) {
    p.stun = .75;
    p.trickCooldown = 1.2;
    g.ball.owner = null;
    g.ball.noPickup = .35;
    const a = Math.random() * Math.PI * 2;
    g.ball.vx = Math.cos(a) * 170; g.ball.vy = Math.sin(a) * 170;
    g.ball.lastTouch = p;
    addFloater(g, p.x, p.y - 50, reason, '#ff4d9d', 1.1);
    spawnBurst(g, p.x, p.y, '#ff4d9d', 10);
    Sound.miss();
  }
  g.combo = 0; g.comboTimer = 0;
  g.trick = null;
  $('#trickHud').classList.remove('is-active');
}
function tackle(g, p) {
  if (p.stun > 0 || p.tackleCooldown > 0 || p.slide > 0) return;
  g.charging = false; g.charge = 0;
  p.slide = .32;
  p.tackleCooldown = .9;
  const dir = g.ball.owner && g.ball.owner.side !== p.side ? Math.atan2(g.ball.owner.y - p.y, g.ball.owner.x - p.x) : p.facing;
  p.slideDir = { x: Math.cos(dir), y: Math.sin(dir) };
  p.vx += p.slideDir.x * 270;
  p.vy += p.slideDir.y * 270;
  p.facing = dir;
  spawnDust(g, p.x, p.y, 8, '#d2e0c9');
  Sound.noise(.08, .04, 500);
}

/* ------------------------------------------------------------------ simulation */
function updateGame(g, dt) {
  if (!g || !g.active) return;
  if (g.paused || g.phase === 'paused' || g.phase === 'ended') return;
  g.shake = Math.max(0, g.shake - dt * 7);
  g.flash = Math.max(0, g.flash - dt * 2.6);
  if (g.phase === 'countdown') {
    g.phaseTimer -= dt;
    const n = Math.max(1, Math.ceil(g.phaseTimer - .15));
    if (n !== g.countdown) {
      g.countdown = n;
      const el = $('#countdownNumber');
      el.textContent = n;
      el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
      Sound.tone(440 + n * 90, .1, 'square', .03);
    }
    if (g.phaseTimer <= 0) {
      g.phase = 'play';
      $('#countdown').classList.remove('is-active');
      Sound.whistle(false);
      addFloater(g, FIELD.cx, FIELD.cy - 60, 'BALL IN', '#c9ff3f', .8);
    }
    updateEffects(g, dt);
    return;
  }
  if (g.phase === 'goal') {
    g.phaseTimer -= dt;
    updateEffects(g, dt);
    if (g.phaseTimer <= 0) {
      $('#goalBanner').classList.remove('is-active');
      g.phase = 'countdown'; g.phaseTimer = 3.05; g.countdown = 4;
      $('#countdownKicker').textContent = g.mode === 'ranked' ? 'RANKED MATCH' : g.mode === 'freestyle' ? 'STYLE SESSION' : 'NORMAL MATCH';
      $('#countdown').classList.add('is-active');
      resetKickoff(g, g.kickoffSide);
      if (g.timeLeft <= 0) endMatch(g);
    }
    return;
  }
  if (g.phase === 'restart') {
    g.phaseTimer -= dt;
    updateEffects(g, dt);
    if (g.phaseTimer <= 0) {
      g.phase = 'play';
      $('#setpieceBanner').classList.remove('is-active');
      if (g.setpiece?.keeperBall) {
        const k = g.setpiece.keeper;
        if (k) { k.holdTimer = .5; k.puntPending = true; }
      }
      g.setpiece = null;
    }
    updateHUD(g);
    return;
  }
  if (g.phase !== 'play') return;

  if (g.trick) {
    g.trick.time -= dt;
    if (g.trick.time <= 0) trickFail(g, 'TOO SLOW');
    else if (Math.floor(g.trick.time * 30) % 3 === 0) renderTrickKeys(g);
  }

  g.timeLeft = Math.max(0, g.timeLeft - dt);
  g.elapsed += dt;
  if (g.timeLeft <= 0) {
    if (g.mode === 'ranked' && g.score.home === g.score.away && !g.golden) {
      g.golden = true; g.timeLeft = 20;
      addFloater(g, FIELD.cx, FIELD.cy - 50, 'GOLDEN GOAL', '#ffc84a', 2);
      Sound.whistle(true);
    } else {
      endMatch(g);
      return;
    }
  }

  if (g.charging) g.charge = clamp(g.charge + dt * 1.35, 0, 1);

  updatePlayers(g, dt);
  updateBall(g, dt);
  updateControlled(g);
  updateEffects(g, dt);
  g.comboTimer = Math.max(0, g.comboTimer - dt);
  if (g.comboTimer === 0 && g.combo > 0) g.combo = 0;
  updateHUD(g);
}

function updatePlayers(g, dt) {
  const b = g.ball;
  const user = controlled(g);

  for (const p of g.players) {
    p.kickCooldown = Math.max(0, p.kickCooldown - dt);
    p.tackleCooldown = Math.max(0, p.tackleCooldown - dt);
    p.trickCooldown = Math.max(0, (p.trickCooldown || 0) - dt);
    p.boost = Math.max(0, p.boost - dt);
    p.stun = Math.max(0, p.stun - dt);
    p.slide = Math.max(0, p.slide - dt);
    p.runPhase += dt * (2 + p.moveMag * 9);
    p.moveMag *= .9;

    if (p.stun > 0) {
      p.vx *= Math.pow(.02, dt); p.vy *= Math.pow(.02, dt);
      continue;
    }
    if (p.slide > 0) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= Math.pow(.35, dt); p.vy *= Math.pow(.35, dt);
      const target = b.owner && b.owner.side !== p.side ? b.owner : null;
      if (target && dist(p, target) < 40) {
        const chance = .63 + (p.char?.stats?.trick || 7) * .012;
        if (Math.random() < chance) {
          setBallOwner(g, p, true);
          target.stun = .55;
          g.stats.tackles++;
          addFloater(g, p.x, p.y - 40, 'CLEAN TACKLE', '#c9ff3f', .9);
          spawnBurst(g, p.x, p.y, '#c9ff3f', 10);
          Sound.save();
        } else {
          p.stun = .55;
          addFloater(g, p.x, p.y - 40, 'SLID PAST', '#ff4d9d', .8);
        }
      }
      continue;
    }

    if (p === user) updateUserMovement(g, p, dt);
    else updateAIMovement(g, p, dt);
  }

  const all = [...g.players, ...g.keepers];
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i], c = all[j];
      const d = dist(a, c);
      const min = a.radius + c.radius - (a.isKeeper || c.isKeeper ? 2 : 4);
      if (d > 0 && d < min) {
        const push = (min - d) / 2;
        const nx = (a.x - c.x) / d, ny = (a.y - c.y) / d;
        a.x += nx * push; a.y += ny * push;
        c.x -= nx * push; c.y -= ny * push;
      }
    }
  }

  g.keepers.forEach(k => updateKeeper(g, k, dt));
  if (g.ball.owner && !g.ball.owner.isKeeper) updateDribble(g, g.ball.owner, dt);
  else if (g.ball.owner?.isKeeper) updateKeeperBall(g, g.ball.owner, dt);
}

function inputVector(g) {
  const k = g.keys;
  let x = 0, y = 0;
  if (k.has('KeyA')) x--;
  if (k.has('KeyD')) x++;
  if (k.has('KeyW')) y--;
  if (k.has('KeyS')) y++;
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len, active: x !== 0 || y !== 0 };
}
function updateUserMovement(g, p, dt) {
  if (g.trick) { p.vx *= Math.pow(.1, dt); p.vy *= Math.pow(.1, dt); return; }
  const v = inputVector(g);
  const sprint = (g.keys.has('ShiftLeft') || g.keys.has('ShiftRight')) && p.stamina > .03;
  if (sprint && v.active) p.stamina = Math.max(0, p.stamina - dt * .17);
  else p.stamina = Math.min(1, p.stamina + dt * .12);
  let speed = p.speed * (sprint ? 1.37 : 1) * (p.boost > 0 ? 1.11 : 1);
  if (g.ball.owner === p) speed *= .96;
  if (g.charging) speed *= .58;
  if (!v.active) {
    p.vx *= Math.pow(.008, dt); p.vy *= Math.pow(.008, dt);
  } else {
    const accel = 9.8;
    p.vx = lerp(p.vx, v.x * speed, 1 - Math.exp(-accel * dt));
    p.vy = lerp(p.vy, v.y * speed, 1 - Math.exp(-accel * dt));
    p.facing = Math.atan2(v.y, v.x);
  }
  if (g.charging) {
    const a = Math.atan2(g.pointer.y - p.y, g.pointer.x - p.x);
    p.facing = lerpAngle(p.facing, a, 1 - Math.exp(-14 * dt));
  }
  p.x += p.vx * dt; p.y += p.vy * dt;
  p.moveMag = Math.min(1, Math.hypot(p.vx, p.vy) / (p.speed * 1.3));
  clampToField(g, p);
}
function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return a + d * t;
}
function clampToField(g, p) {
  const pad = p.radius + 4;
  p.x = clamp(p.x, FIELD.x + pad, FIELD.right - pad);
  p.y = clamp(p.y, FIELD.y + pad, FIELD.bottom - pad);
}

function updateAIMovement(g, p, dt) {
  const b = g.ball;
  p.think -= dt;
  const goalX = targetGoalX(p.side);
  const fieldMates = g.players.filter(x => x.side === p.side && x !== p);
  const hasBall = b.owner === p;
  let tx = p.x, ty = p.y, speed = 1;

  if (hasBall) {
    const def = nearestOpponent(g, p);
    const dir = attackingDir(p.side);
    const distanceToGoal = Math.abs(goalX - p.x);
    if (p.think <= 0) {
      p.think = .25 + Math.random() * .3;
      const mate = teammateOf(g, p);
      const pressure = def.d < 105;
      if (mate && pressure && Math.random() < .62 && p.kickCooldown <= 0) {
        performPass(g, p, mate, .78);
        return;
      }
      if (distanceToGoal < 390 && Math.abs(p.y - FIELD.cy) < 260 && Math.random() < .78 && p.kickCooldown <= 0) {
        const corner = Math.random() < .5 ? -1 : 1;
        const aimY = FIELD.cy + corner * (32 + Math.random() * 42);
        const sx = goalX + dir * 18;
        const skill = p.char?.stats?.shot || 7;
        const errY = (Math.random() * 2 - 1) * (54 - skill * 2.4) * (g.mode === 'ranked' ? .65 : 1);
        performShot(g, p, clamp(.68 + Math.random() * .3, .6, 1), sx, aimY + errY, g.mode === 'ranked' ? 'hard' : 'mid');
        return;
      }
    }
    tx = goalX - dir * 40;
    ty = FIELD.cy + clamp((p.y - FIELD.cy) * .36, -150, 150);
    if (def.d < 150 && def.player) {
      const side = p.y > def.player.y ? 1 : -1;
      ty += side * 90;
    }
    speed = .86 + (p.char?.stats?.pace || 7) * .025;
  } else if (b.owner && b.owner.side !== p.side) {
    const carrier = b.owner;
    if (dist(p, carrier) < 220 || p.index === 0) {
      tx = carrier.x - attackingDir(p.side) * 24;
      ty = carrier.y;
    } else {
      tx = lerp(p.x, carrier.x - attackingDir(p.side) * 140, .4);
      ty = lerp(p.y, carrier.y, .35);
    }
    speed = .95;
    if (dist(p, carrier) < 42 && p.tackleCooldown <= 0 && Math.random() < .022) tackle(g, p);
  } else {
    const closest = [p, ...fieldMates].sort((a, c) => dist(a, b) - dist(c, b))[0];
    if (closest === p) {
      tx = b.x + b.vx * .22; ty = b.y + b.vy * .22;
      speed = 1;
    } else {
      tx = b.x - attackingDir(p.side) * 180;
      ty = FIELD.cy + (p.index === 0 ? 80 : -90);
      speed = .72;
    }
  }
  tx = clamp(tx, FIELD.x + 36, FIELD.right - 36);
  ty = clamp(ty, FIELD.y + 30, FIELD.bottom - 30);
  const dx = tx - p.x, dy = ty - p.y;
  const d = Math.hypot(dx, dy);
  const desiredSpeed = p.speed * speed * (p.boost > 0 ? 1.1 : 1);
  if (d > 7) {
    const nx = dx / d, ny = dy / d;
    p.vx = lerp(p.vx, nx * desiredSpeed, 1 - Math.exp(-7.5 * dt));
    p.vy = lerp(p.vy, ny * desiredSpeed, 1 - Math.exp(-7.5 * dt));
    p.facing = Math.atan2(p.vy, p.vx);
  } else {
    p.vx *= Math.pow(.02, dt); p.vy *= Math.pow(.02, dt);
  }
  p.x += p.vx * dt; p.y += p.vy * dt;
  p.moveMag = Math.min(1, Math.hypot(p.vx, p.vy) / (p.speed * 1.3));
  clampToField(g, p);
}

function updateDribble(g, p, dt) {
  const b = g.ball;
  if (!p || p.stun > 0) return;
  const ahead = 19 + Math.min(12, Math.hypot(p.vx, p.vy) * .035);
  const dir = p.facing;
  const tx = p.x + Math.cos(dir) * ahead;
  const ty = p.y + Math.sin(dir) * ahead;
  b.x = lerp(b.x, tx, Math.min(1, 18 * dt));
  b.y = lerp(b.y, ty, Math.min(1, 18 * dt));
  b.vx = p.vx * .94; b.vy = p.vy * .94;
  b.z = 0; b.vz = 0;
  b.rotation += Math.hypot(p.vx, p.vy) * dt * .002;
  b.lastTouch = p;
  if (Math.random() < dt * 1.2) spawnDust(g, b.x, b.y, 1, 'rgba(220,235,210,.7)');
}

function updateKeeper(g, k, dt) {
  if (k.puntPending) return;
  const b = g.ball;
  const sideRight = k.side === 'away';
  const baseX = sideRight ? FIELD.right - 39 : FIELD.x + 39;
  const mouth = { top: FIELD.cy - GOAL.half + 18, bottom: FIELD.cy + GOAL.half - 18 };
  let targetY = clamp(b.y + b.vy * .08, mouth.top, mouth.bottom);
  if (b.x < FIELD.x + 120 || b.x > FIELD.right - 120) targetY = clamp(targetY, mouth.top + 8, mouth.bottom - 8);
  let targetX = baseX;
  const threat = Math.abs(b.x - baseX) < 250 && (b.owner?.side !== k.side || !b.owner);
  if (threat) targetX = baseX + (sideRight ? -12 : 12) * (1 - Math.abs(b.x - baseX) / 260);
  const speed = 230;
  k.vx = lerp(k.vx, clamp((targetX - k.x) * 3.2, -speed, speed), 1 - Math.exp(-7 * dt));
  k.vy = lerp(k.vy, clamp((targetY - k.y) * 4.2, -speed * 1.25, speed * 1.25), 1 - Math.exp(-8 * dt));
  if (k.dive > 0) {
    k.dive -= dt;
    k.x += k.diveDir * 150 * dt;
    k.vy *= .5;
  }
  k.x += k.vx * dt; k.y += k.vy * dt;
  if (sideRight) k.x = clamp(k.x, FIELD.right - 95, FIELD.right - 20);
  else k.x = clamp(k.x, FIELD.x + 20, FIELD.x + 95);
  k.y = clamp(k.y, mouth.top - 10, mouth.bottom + 10);
  k.facing = sideRight ? Math.PI : 0;
  if (!b.owner && b.z < 28 && b.noPickup <= 0 && Math.abs(b.x - baseX) < 88 && Math.abs(b.y - FIELD.cy) < GOAL.half + 20 && Math.hypot(b.vx, b.vy) < 280) {
    if (Math.random() < dt * 2.4) {
      setBallOwner(g, k, true);
      k.holdTimer = .85;
      k.puntPending = true;
      addFloater(g, k.x, k.y - 30, 'CLAIMED', '#ffc84a', .8);
    }
  }
}
function updateKeeperBall(g, k, dt) {
  const b = g.ball;
  const dir = k.side === 'home' ? 1 : -1;
  b.x = k.x + dir * 16; b.y = k.y; b.z = 0; b.vx = 0; b.vy = 0;
  if (k.holdTimer > 0) k.holdTimer -= dt;
  else if (k.puntPending) keeperPunt(g, k);
}
function keeperPunt(g, k) {
  const b = g.ball;
  k.puntPending = false;
  b.owner = null;
  b.noPickup = .3;
  const mates = g.players.filter(p => p.side === k.side);
  const target = mates.sort((a, c) => {
    const aa = k.side === 'home' ? -a.x : a.x;
    const cc = k.side === 'home' ? -c.x : c.x;
    return aa - cc;
  }).slice(0, 2)[Math.floor(Math.random() * Math.min(2, mates.length))] || mates[0];
  const tx = target ? target.x + rand(-30, 30) : (k.side === 'home' ? FIELD.cx + 280 : FIELD.cx - 280);
  const ty = target ? target.y : FIELD.cy + 100;
  const angle = Math.atan2(ty - k.y, tx - k.x);
  b.x = k.x + Math.cos(angle) * 22; b.y = k.y + Math.sin(angle) * 22;
  b.vx = Math.cos(angle) * 670; b.vy = Math.sin(angle) * 230;
  b.z = 18; b.vz = 250; b.spin = 0;
  b.rotation = angle;
  b.lastTouch = k;
  b.shot = null;
  spawnBurst(g, k.x, k.y, '#ffc84a', 8);
  addFloater(g, k.x, k.y - 42, 'PUNT', '#ffc84a', .9);
  Sound.kick(.55);
}

function updateBall(g, dt) {
  const b = g.ball;
  b.noPickup = Math.max(0, b.noPickup - dt);
  if (b.owner) { b.shot = null; return; }
  if (b.z > 0 || b.vz > 0) {
    b.vz -= 700 * dt;
    b.z += b.vz * dt;
    if (b.z <= 0) {
      b.z = 0;
      if (b.vz < -90) { b.vz = -b.vz * .34; b.vy *= .9; Sound.bounce(); }
      else b.vz = 0;
    }
  }
  if (b.spin) {
    const sp = Math.hypot(b.vx, b.vy) || 1;
    const nx = -b.vy / sp, ny = b.vx / sp;
    b.vx += nx * b.spin * sp * dt * .25;
    b.vy += ny * b.spin * sp * dt * .25;
    b.spin *= Math.pow(.3, dt);
  }
  if (b.z === 0) {
    const drag = Math.pow(.31, dt);
    b.vx *= drag; b.vy *= drag;
  }
  b.x += b.vx * dt; b.y += b.vy * dt;
  b.rotation += Math.hypot(b.vx, b.vy) * dt * .0018;
  if (b.z === 0 && Math.hypot(b.vx, b.vy) > 40) {
    if (Math.random() < dt * 5) {
      g.trail.push({ x: b.x, y: b.y, life: .24, max: .24, skin: b.skin });
      if (g.trail.length > 24) g.trail.shift();
    }
  }
  if (b.shot) b.shot.time += dt;

  if (b.shot) collidePosts(g, b);
  for (const p of g.players) {
    if (p === b.lastTouch && b.noPickup > 0) continue;
    const d = Math.hypot(b.x - p.x, b.y - p.y);
    if (d < p.radius + BALL_R + 3 && b.z < 33) {
      const speed = Math.hypot(b.vx, b.vy);
      if (speed > 330 || b.shot) {
        const nx = (b.x - p.x) / (d || 1), ny = (b.y - p.y) / (d || 1);
        const dot = b.vx * nx + b.vy * ny;
        if (dot < 0) {
          b.vx -= 1.7 * dot * nx;
          b.vy -= 1.7 * dot * ny;
          b.vx *= .62; b.vy *= .62;
          b.noPickup = .22;
          b.lastTouch = p;
          if (b.shot) { b.shot = null; addFloater(g, p.x, p.y - 36, 'BLOCKED!', '#4df3ff', .85); }
          spawnDust(g, b.x, b.y, 8, '#eef6ed');
          Sound.bounce();
        }
      } else if (speed <= 330 && b.noPickup <= 0) {
        setBallOwner(g, p, false);
        return;
      }
    }
  }
  for (const k of g.keepers) {
    if (b.owner) break;
    if (b.shot?.resolved) break;
    const d = Math.hypot(b.x - k.x, b.y - k.y);
    if (d < k.radius + BALL_R + 4 && b.z < 35 && b.noPickup <= 0) {
      const speed = Math.hypot(b.vx, b.vy);
      if (speed < 260 && !b.shot) {
        setBallOwner(g, k, true); k.holdTimer = .8; k.puntPending = true;
        addFloater(g, k.x, k.y - 30, 'KEEPER BALL', '#ffc84a', .8);
      }
    }
  }

  resolveShotVsKeeper(g, b);

  if (!b.owner) {
    checkGoalAndBounds(g, b);
    if (!b.owner && !b.shot && b.noPickup <= 0 && b.z < 22) {
      let best = null, bestD = 29;
      for (const p of g.players) {
        const d = Math.hypot(b.x - p.x, b.y - p.y);
        if (d < bestD) { bestD = d; best = p; }
      }
      if (best) setBallOwner(g, best, false);
    }
  }
}

function collidePosts(g, b) {
  const posts = [
    { x: FIELD.x, y: FIELD.cy - GOAL.half }, { x: FIELD.x, y: FIELD.cy + GOAL.half },
    { x: FIELD.right, y: FIELD.cy - GOAL.half }, { x: FIELD.right, y: FIELD.cy + GOAL.half }
  ];
  for (const post of posts) {
    const d = Math.hypot(b.x - post.x, b.y - post.y);
    if (d < BALL_R + 7 && b.z < 92) {
      const nx = (b.x - post.x) / (d || 1), ny = (b.y - post.y) / (d || 1);
      const dot = b.vx * nx + b.vy * ny;
      if (dot < 0) {
        b.vx -= 1.9 * dot * nx; b.vy -= 1.9 * dot * ny;
        b.vx *= .78; b.vy *= .78;
        b.x = post.x + nx * (BALL_R + 8);
        b.y = post.y + ny * (BALL_R + 8);
        g.shake = 3;
        b.shot = null;
        addFloater(g, post.x, post.y - 24, 'OFF THE POST!', '#ffc84a', 1.1);
        Sound.bounce();
      }
    }
  }
}

function resolveShotVsKeeper(g, b) {
  if (!b.shot || b.shot.resolved) return;
  const shot = b.shot;
  const targetX = shot.team === 'home' ? FIELD.right : FIELD.x;
  const dir = shot.team === 'home' ? 1 : -1;
  if ((targetX - b.x) * dir > 125 || Math.hypot(b.vx, b.vy) < 180) return;
  const timeToLine = Math.max(0, (targetX - b.x) / (b.vx || (dir * 1)));
  const projectedY = b.y + b.vy * timeToLine;
  const mouth = goalMouthY();
  const onTarget = projectedY > mouth.top - 24 && projectedY < mouth.bottom + 24 && b.z < GOAL.bar;
  shot.onTarget = onTarget;
  if (!onTarget) { shot.resolved = true; return; }
  const keeper = keeperOf(g, shot.team === 'home' ? 'away' : 'home');
  if (!keeper || keeper.dive > 0) return;
  shot.resolved = true;
  const saved = Math.random() < .5;
  if (!saved) {
    g.lastShotDetail = Math.random() < .35 ? 'KEEPER GAMBLED WRONG' : 'BEAT THE KEEPER';
    addFloater(g, keeper.x, keeper.y - 42, 'MISSED IT', '#ff4d9d', .9);
    keeper.dive = .5; keeper.diveDir = dir > 0 ? -1 : 1;
    return;
  }
  const caught = Math.random() < .5;
  g.saves++; g.stats.saves++;
  keeper.dive = .62;
  keeper.diveDir = b.vy > 0 ? 1 : -1;
  keeper.x += keeper.diveDir * 8;
  g.shake = Math.max(g.shake, 3.2);
  spawnBurst(g, b.x, b.y, caught ? '#ffc84a' : '#4df3ff', caught ? 16 : 12);
  if (caught) {
    addFloater(g, keeper.x, keeper.y - 48, 'CAUGHT!', '#ffc84a', 1.2);
    addFloater(g, keeper.x, keeper.y - 70, 'PUNT INCOMING', '#fff', .8);
    setBallOwner(g, keeper, true);
    keeper.holdTimer = 1.05;
    keeper.puntPending = true;
    g.lastShotDetail = 'CAUGHT BY THE KEEPER';
    Sound.save();
  } else {
    addFloater(g, keeper.x, keeper.y - 48, 'PARRIED!', '#4df3ff', 1.2);
    addFloater(g, keeper.x, keeper.y - 70, 'LIVE BALL', '#fff', .8);
    b.owner = null; b.noPickup = .28; b.shot = null;
    const away = shot.team === 'home' ? -1 : 1;
    b.vx = away * rand(130, 260) + rand(-80, 80);
    b.vy = rand(-300, 300);
    b.z = 15; b.vz = 130;
    b.lastTouch = keeper;
    g.lastShotDetail = 'PARRY · NO PUNT';
    Sound.save();
  }
  g.charging = false; g.charge = 0;
}

function setBallOwner(g, p, fromKeeper = false) {
  const b = g.ball;
  g.charging = false; g.charge = 0;
  const previousSide = b.owner?.side;
  b.owner = p;
  b.lastTouch = p;
  b.shot = null;
  b.spin = 0;
  b.z = 0; b.vz = 0;
  b.noPickup = p.isKeeper ? 1.1 : .1;
  if (p.isKeeper) {
    p.holdTimer = Math.max(p.holdTimer, fromKeeper ? .9 : .55);
    p.puntPending = true;
  }
  if (p.side === 'home' && !p.isKeeper) {
    setControlled(g, p);
    g.possessionFlash = .5;
  }
  if (p.side !== previousSide && p.isKeeper) {
    const nearest = g.players.filter(x => x.side === 'home').sort((a, c) => dist(a, p) - dist(c, p))[0];
    if (nearest) setControlled(g, nearest);
  }
  if (p.side !== 'home' && previousSide === 'home') {
    g.combo = 0; g.comboTimer = 0;
  }
  g.possessionSide = p.side;
  if (!p.isKeeper) addFloater(g, p.x, p.y - 35, 'POSSESSION', p.side === 'home' ? '#c9ff3f' : '#ff4058', .55);
}

function checkGoalAndBounds(g, b) {
  const mouth = goalMouthY();
  const inMouth = b.y > mouth.top && b.y < mouth.bottom && b.z < GOAL.bar;
  if (b.x > FIELD.right + 9 && inMouth) { scoreGoal(g, 'home'); return; }
  if (b.x < FIELD.x - 9 && inMouth) { scoreGoal(g, 'away'); return; }
  if (b.x > FIELD.right + 14) {
    if (b.lastTouch?.side === 'home') setPiece(g, 'GOAL KICK', 'away', FIELD.right - 70, clamp(b.y, FIELD.cy - 70, FIELD.cy + 70), true);
    else setPiece(g, 'CORNER', 'home', FIELD.right - 10, b.y < FIELD.cy ? FIELD.y + 10 : FIELD.bottom - 10, false);
    return;
  }
  if (b.x < FIELD.x - 14) {
    if (b.lastTouch?.side === 'away') setPiece(g, 'GOAL KICK', 'home', FIELD.x + 70, clamp(b.y, FIELD.cy - 70, FIELD.cy + 70), true);
    else setPiece(g, 'CORNER', 'away', FIELD.x + 10, b.y < FIELD.cy ? FIELD.y + 10 : FIELD.bottom - 10, false);
    return;
  }
  if (b.y < FIELD.y - 10) {
    const side = b.lastTouch?.side === 'home' ? 'away' : 'home';
    setPiece(g, 'THROW-IN', side, clamp(b.x, FIELD.x + 30, FIELD.right - 30), FIELD.y + 18);
    return;
  }
  if (b.y > FIELD.bottom + 10) {
    const side = b.lastTouch?.side === 'away' ? 'home' : 'away';
    setPiece(g, 'THROW-IN', side, clamp(b.x, FIELD.x + 30, FIELD.right - 30), FIELD.bottom - 18);
  }
}

function setPiece(g, label, side, x, y, keeperBall = false) {
  if (g.phase === 'restart') return;
  g.phase = 'restart'; g.phaseTimer = 1.15; g.charging = false; g.charge = 0; g.trick = null;
  $('#trickHud').classList.remove('is-active');
  const b = g.ball;
  b.owner = null; b.vx = 0; b.vy = 0; b.z = 0; b.vz = 0; b.shot = null; b.lastTouch = null;
  g.setpiece = { label, side, x, y, keeperBall };
  if (keeperBall) {
    const k = keeperOf(g, side);
    b.owner = k; b.lastTouch = k; b.x = k.x; b.y = k.y;
    k.holdTimer = .8; k.puntPending = true;
    g.setpiece.keeper = k;
    g.players.filter(p => p.side !== side).forEach(p => {
      if (dist(p, k) < 150) { p.x = FIELD.cx + (p.side === 'home' ? -60 : 60); p.y = FIELD.cy + (p.x > FIELD.cx ? 100 : -100); }
    });
    setControlled(g, g.players.filter(p => p.side === 'home').sort((a, c) => dist(a, b) - dist(c, b))[0]);
  } else {
    const taker = g.players.filter(p => p.side === side).sort((a, c) => dist(a, { x, y }) - dist(c, { x, y }))[0];
    if (taker) {
      taker.x = x; taker.y = y; taker.vx = 0; taker.vy = 0; taker.stun = 0;
      b.owner = taker; b.x = x + (side === 'home' ? 16 : -16); b.y = y;
      b.lastTouch = taker;
      if (side === 'home') setControlled(g, taker);
    }
    g.players.filter(p => p.side !== side).forEach(p => {
      if (dist(p, { x, y }) < 80) { p.x = x + (side === 'home' ? -90 : 90); p.y = y + (Math.random() < .5 ? -68 : 68); }
    });
  }
  $('#setpieceBanner').classList.add('is-active');
  $('#setpieceText').textContent = label;
  Sound.whistle(false);
  addFloater(g, clamp(x, FIELD.x + 90, FIELD.right - 90), clamp(y, FIELD.y + 60, FIELD.bottom - 60), label, '#ffc84a', 1);
}

function scoreGoal(g, side) {
  if (g.phase !== 'play') return;
  g.phase = 'goal'; g.phaseTimer = 2.65;
  g.score[side]++;
  g.shake = 9; g.flash = 1; g.flashColor = side === 'home' ? '#c9ff3f' : '#ff4058';
  g.kickoffSide = g.mode === 'freestyle' ? 'home' : (side === 'home' ? 'away' : 'home');
  g.charging = false; g.charge = 0; g.trick = null;
  $('#trickHud').classList.remove('is-active');
  Sound.goal();
  const scorer = g.ball.lastTouch?.side === side ? g.ball.lastTouch : g.players.find(p => p.side === side && !p.isKeeper);
  const scorerName = scorer?.char?.name || (side === 'home' ? 'NOVA' : 'RIVAL');
  const minutes = Math.min(90, Math.floor((g.elapsed / Math.max(1, g.cfg.time)) * 90));
  const detail = g.lastShotDetail || pick(['TOP BINS', 'COOL FINISH', 'BACK OF THE NET']);
  const styleBonus = 250 + g.combo * 50;
  g.style += styleBonus;
  if (g.combo > 0) g.combo = Math.min(9, g.combo + 1);
  g.comboTimer = 5;
  g.bestCombo = Math.max(g.bestCombo, g.combo);
  if (side === 'home') save.stats.goals++;
  g.goalBy = scorer;
  $('#goalKicker').textContent = side === 'home' ? 'ABSOLUTE SCENES' : 'RIVALS STRIKE';
  $('#goalScorer').textContent = scorerName;
  $('#goalDetail').textContent = `${detail} · ${minutes}'`;
  $('#goalStyle').textContent = `+${styleBonus} STYLE${g.combo > 1 ? ` · ×${g.combo} COMBO` : ''}`;
  $('#goalBanner').classList.add('is-active');
  spawnConfetti(g, 90, side === 'home' ? FIELD.right - 80 : FIELD.x + 80);
  addFloater(g, FIELD.cx, FIELD.cy - 20, side === 'home' ? "THAT'S OURS" : 'THEY SCORED', side === 'home' ? '#c9ff3f' : '#ff4058', 1.4);
  g.lastShotDetail = '';
  g.possessionSide = side;
}

function endMatch(g) {
  if (g.phase === 'ended') return;
  g.phase = 'ended'; g.paused = false; g.active = false;
  g.charging = false;
  $('#trickHud').classList.remove('is-active');
  Sound.whistle(true);
  setTimeout(() => showResults(g), 450);
}

function showResults(g) {
  const draw = g.score.home === g.score.away;
  const win = g.score.home > g.score.away;
  const freestyle = g.mode === 'freestyle';
  let tubes = 90 + g.score.home * 28 + Math.round(g.style / 22) + g.tricks * 12 + Math.round(g.stats.tackles * 8);
  if (win) tubes += 120;
  if (freestyle) tubes = 80 + Math.round(g.style / 9) + g.tricks * 22;
  if (g.mode === 'ranked') tubes = Math.round(tubes * 1.25);
  const oldRp = save.rp;
  let rpDelta = 0;
  if (g.mode === 'ranked') {
    rpDelta = win ? 22 : draw ? 7 : -11;
    save.rp = Math.max(0, save.rp + rpDelta);
  }
  save.tubes += tubes;
  save.stats.matches++;
  if (win) save.stats.wins++;
  save.stats.saves += g.stats.saves;
  save.stats.bestCombo = Math.max(save.stats.bestCombo, g.bestCombo);
  persist(); updateBalances();
  const r = rankFor(save.rp);
  const oldRank = rankFor(oldRp);
  $('#resultKicker').textContent = freestyle ? 'STYLE SESSION COMPLETE' : g.golden ? 'GOLDEN GOAL · FULL TIME' : 'FULL TIME';
  $('#resultTitle').textContent = freestyle ? 'STYLE' : win ? 'W' : draw ? 'D' : 'L';
  $('#resultTitle').style.color = freestyle ? '#4df3ff' : win ? '#c9ff3f' : draw ? '#ffc84a' : '#ff4058';
  $('#resultScore').textContent = freestyle ? `${fmt(g.style)} STYLE` : `${g.score.home} — ${g.score.away}`;
  $('#resultHomeName').textContent = freestyle ? 'FREESTYLE SESSION' : 'YOUR CREW';
  const chips = [
    { label: freestyle ? 'STYLE SCORE' : 'MATCH', value: freestyle ? fmt(g.style) : `${g.score.home}-${g.score.away}` },
    { label: 'TUBES EARNED', value: `+${fmt(tubes)}` },
    { label: g.mode === 'ranked' ? 'RANK POINTS' : 'BEST COMBO', value: g.mode === 'ranked' ? `${rpDelta >= 0 ? '+' : ''}${rpDelta} RP` : `×${g.bestCombo}` }
  ];
  $('#resultRewards').innerHTML = chips.map(c => `<div class="reward-chip"><small>${c.label}</small><b>${c.value}</b></div>`).join('');
  $('#resultStats').innerHTML = [
    ['SHOTS', g.stats.shots], ['TRICKS', g.tricks], ['SAVES', g.stats.saves], ['TACKLES', g.stats.tackles], ['RANK', r.label]
  ].map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join('');
  $('#resultOverlay').classList.add('is-active');
  if (g.mode === 'ranked' && oldRank.label !== r.label) toast(`<b>Rank update:</b> ${r.label}${save.rp > oldRp ? ' · promoted' : ''}`);
  renderHome();
}

function togglePause() {
  if (!G || G.phase === 'ended') return;
  if (G.paused) resumeGame(); else pauseGame();
}
function pauseGame() {
  if (!G || G.phase === 'ended') return;
  G._beforePause = G.phase;
  G.paused = true; G.phase = 'paused';
  $('#pauseOverlay').classList.add('is-active');
  G.charging = false; G.charge = 0;
  Sound.ui();
}
function resumeGame() {
  if (!G) return;
  G.paused = false;
  G.phase = G._beforePause || 'play';
  $('#pauseOverlay').classList.remove('is-active');
  Sound.ui();
}
function quitGame() {
  if (G) { G.active = false; G.paused = false; G = null; }
  $('#pauseOverlay').classList.remove('is-active');
  $('#resultOverlay').classList.remove('is-active');
  $('#countdown').classList.remove('is-active');
  $('#goalBanner').classList.remove('is-active');
  $('#trickHud').classList.remove('is-active');
  setScreen('home');
  fitCanvas();
}

/* ------------------------------------------------------------------ HUD */
function updateHUD(g) {
  if (!g) return;
  const clock = Math.ceil(g.timeLeft);
  const mm = String(Math.floor(clock / 60)).padStart(2, '0');
  const ss = String(clock % 60).padStart(2, '0');
  $('#matchClock').textContent = `${mm}:${ss}`;
  $('#homeScore').textContent = g.score.home;
  $('#awayScore').textContent = g.score.away;
  $('#clockLabel').textContent = g.golden ? 'GOLDEN GOAL' : g.mode === 'freestyle' ? 'STYLE SESSION' : 'MATCH';
  $('#hudMode').textContent = g.cfg.label;
  $('#comboValue').textContent = g.combo;
  $('#stylePoints').textContent = fmt(g.style);
  $('#comboBar').style.width = `${clamp(g.comboTimer / 5.5, 0, 1) * 100}%`;
  $('#chargeWrap').classList.toggle('is-active', g.charging);
  if (g.charging) {
    const pct = Math.round(g.charge * 100);
    $('#chargePct').textContent = `${pct}%`;
    $('#chargeFill').style.width = `${pct}%`;
    $('#chargeKind').textContent = g.charge > .78 ? 'POWER STRIKE' : g.charge > .35 ? 'DRIVEN SHOT' : 'FINESSE';
  }
}

/* ------------------------------------------------------------------ effects */
function spawnDust(g, x, y, count = 4, color = 'rgba(230,240,220,.7)') {
  for (let i = 0; i < count; i++) {
    g.particles.push({ x, y, vx: rand(-40, 40), vy: rand(-40, 40), life: rand(.15, .4), max: .4, size: rand(1, 3.5), color, grav: 0 });
  }
}
function spawnBurst(g, x, y, color, count = 14) {
  for (let i = 0; i < count; i++) {
    const a = rand(0, Math.PI * 2), sp = rand(40, 210);
    g.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(.2, .65), max: .65, size: rand(1.5, 4.5), color, grav: 80 });
  }
}
function spawnConfetti(g, count = 80, x = FIELD.cx) {
  const colors = ['#c9ff3f', '#4df3ff', '#ff4d9d', '#ffc84a', '#ffffff'];
  for (let i = 0; i < count; i++) {
    const a = rand(-Math.PI * .8, -Math.PI * .2);
    const sp = rand(80, 460);
    g.particles.push({ x: x + rand(-40, 40), y: FIELD.cy + rand(-60, 60), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(.8, 1.8), max: 1.8, size: rand(2, 6), color: pick(colors), grav: 240, confetti: true });
  }
}
function addFloater(g, x, y, text, color = '#fff', life = 1) {
  g.floaters.push({ x, y, text, color, life, max: life, size: 1 });
  if (g.floaters.length > 16) g.floaters.shift();
}
function updateEffects(g, dt) {
  for (const p of g.particles) {
    p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
    p.vy += (p.grav || 0) * dt;
    if (p.confetti) p.vx *= Math.pow(.2, dt);
  }
  g.particles = g.particles.filter(p => p.life > 0);
  for (const f of g.floaters) { f.life -= dt; f.y -= 19 * dt; }
  g.floaters = g.floaters.filter(f => f.life > 0);
  for (const t of g.trail) t.life -= dt;
  g.trail = g.trail.filter(t => t.life > 0);
}

/* ------------------------------------------------------------------ rendering */
let noisePattern = null;
function makeNoisePattern() {
  const off = document.createElement('canvas');
  off.width = 120; off.height = 120;
  const c = off.getContext('2d');
  for (let i = 0; i < 800; i++) {
    const a = Math.random() * .05;
    c.fillStyle = `rgba(${Math.random() < .5 ? '255,255,255' : '0,0,0'},${a})`;
    c.fillRect(Math.random() * 120, Math.random() * 120, 1, 1);
  }
  noisePattern = ctx.createPattern(off, 'repeat');
}

function renderGame(g) {
  if (!g) return;
  const dpr = view.dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, view.w, view.h);
  const bg = ctx.createLinearGradient(0, 0, 0, view.h);
  bg.addColorStop(0, '#070b0d'); bg.addColorStop(1, '#050709');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, view.w, view.h);

  const s = view.scale;
  ctx.save();
  const shakeX = g.shake > 0 ? rand(-g.shake, g.shake) : 0;
  const shakeY = g.shake > 0 ? rand(-g.shake, g.shake) : 0;
  ctx.translate(view.ox + shakeX * s, view.oy + shakeY * s);
  ctx.scale(s, s);
  drawStadium(g);
  drawField(g);
  drawGoals(g);
  drawAim(g);
  drawTrail(g);
  const drawables = [
    ...g.keepers.map(p => ({ p, type: 'keeper' })),
    ...g.players.map(p => ({ p, type: 'player' })),
    { p: g.ball, type: 'ball' }
  ].sort((a, c) => (a.p.y + (a.type === 'ball' ? (a.p.z || 0) * .55 : 0)) - (c.p.y + (c.type === 'ball' ? (c.p.z || 0) * .55 : 0)));
  for (const d of drawables) {
    if (d.type === 'ball') drawBall(g, d.p);
    else if (d.type === 'keeper') drawKeeper(g, d.p);
    else drawPlayer(g, d.p);
  }
  drawParticles(g);
  drawFloaters(g);
  if (g.flash > 0) {
    ctx.globalAlpha = g.flash * .17;
    ctx.fillStyle = g.flashColor;
    ctx.fillRect(0, 0, WORLD.w, WORLD.h);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  if (view.oy > 1) {
    const gr = ctx.createLinearGradient(0, 0, 0, view.oy);
    gr.addColorStop(0, 'rgba(201,255,63,.06)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, view.w, view.oy);
  }
}

function drawStadium(g) {
  ctx.fillStyle = '#0b1114';
  ctx.fillRect(-20, -20, WORLD.w + 40, WORLD.h + 40);
  const boardH = 42;
  const ads = ['TUBE FC', 'NEON LEAGUE', 'OWN THE STREET', 'NO PAY TO WIN', 'SEASON 01'];
  const drawBoards = (y, flip) => {
    for (let i = 0; i < 10; i++) {
      const x = 10 + i * 144;
      const grad = ctx.createLinearGradient(x, y, x, y + boardH);
      grad.addColorStop(0, flip ? '#10181b' : '#121b1e');
      grad.addColorStop(1, '#080d10');
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, 138, boardH);
      ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth = 1; ctx.strokeRect(x, y, 138, boardH);
      ctx.save();
      ctx.fillStyle = i % 3 === 0 ? 'rgba(201,255,63,.62)' : i % 3 === 1 ? 'rgba(77,243,255,.45)' : 'rgba(255,255,255,.23)';
      ctx.font = 'italic 800 13px "Barlow Condensed"';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (!flip) ctx.fillText(ads[i % ads.length], x + 69, y + boardH / 2 + 1);
      else { ctx.translate(x + 69, y + boardH / 2); ctx.rotate(Math.PI); ctx.fillText(ads[i % ads.length], 0, 0); }
      ctx.restore();
    }
  };
  drawBoards(30, false);
  drawBoards(WORLD.h - 60, true);
  for (let i = 0; i < 6; i++) {
    const y = 76 + i * 118;
    ctx.fillStyle = i % 2 ? '#0d1518' : '#10191c';
    ctx.fillRect(-14, y, 34, 112);
    ctx.fillRect(WORLD.w - 20, y, 34, 112);
    ctx.strokeStyle = 'rgba(255,255,255,.04)'; ctx.strokeRect(-14, y, 34, 112);
  }
  for (let i = 0; i < 95; i++) {
    const x = (i * 151 + 33) % WORLD.w;
    const y = 8 + (i * 37) % 19;
    ctx.fillStyle = i % 9 === 0 ? 'rgba(201,255,63,.28)' : i % 7 === 0 ? 'rgba(77,243,255,.2)' : 'rgba(255,255,255,.07)';
    ctx.fillRect(x, y, 2, 2);
  }
}

function drawField(g) {
  const x = FIELD.x, y = FIELD.y, w = FIELD.w, h = FIELD.h;
  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, '#1d5b39');
  grad.addColorStop(.48, '#1b623b');
  grad.addColorStop(1, '#153d2b');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
  const stripes = 16;
  for (let i = 0; i < stripes; i++) {
    if (i % 2 === 0) continue;
    ctx.fillStyle = 'rgba(255,255,255,.026)';
    ctx.fillRect(x + (w / stripes) * i, y, w / stripes, h);
  }
  const light = ctx.createRadialGradient(FIELD.cx, y + 80, 40, FIELD.cx, y + 80, w * .7);
  light.addColorStop(0, 'rgba(255,255,255,.09)');
  light.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = light; ctx.fillRect(x, y, w, h);
  if (!noisePattern) makeNoisePattern();
  if (noisePattern) { ctx.globalAlpha = .55; ctx.fillStyle = noisePattern; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1; }

  ctx.strokeStyle = 'rgba(240,247,235,.58)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.beginPath(); ctx.moveTo(FIELD.cx, y); ctx.lineTo(FIELD.cx, y + h); ctx.stroke();
  ctx.beginPath(); ctx.arc(FIELD.cx, FIELD.cy, 78, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(FIELD.cx, FIELD.cy, 4.5, 0, Math.PI * 2); ctx.fillStyle = 'rgba(240,247,235,.55)'; ctx.fill();
  const boxW = 188, boxH = 320, sixW = 72, sixH = 154;
  ctx.strokeRect(x, FIELD.cy - boxH / 2, boxW, boxH);
  ctx.strokeRect(x, FIELD.cy - sixH / 2, sixW, sixH);
  ctx.strokeRect(x + w - boxW, FIELD.cy - boxH / 2, boxW, boxH);
  ctx.strokeRect(x + w - sixW, FIELD.cy - sixH / 2, sixW, sixH);
  [x + 130, x + w - 130].forEach((px, idx) => {
    ctx.beginPath(); ctx.arc(px, FIELD.cy, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    if (idx === 0) ctx.arc(px, FIELD.cy, 66, -Math.PI * .42, Math.PI * .42);
    else ctx.arc(px, FIELD.cy, 66, Math.PI * .58, Math.PI * 1.42);
    ctx.stroke();
  });
  const corners = [[x, y, 0], [x + w, y, Math.PI / 2], [x + w, y + h, Math.PI], [x, y + h, -Math.PI / 2]];
  corners.forEach(([cx, cy, a]) => { ctx.beginPath(); ctx.arc(cx, cy, 17, a, a + Math.PI / 2); ctx.stroke(); });
  ctx.save();
  ctx.globalAlpha = .055;
  ctx.fillStyle = '#f4f1e8';
  ctx.font = 'italic 900 112px "Barlow Condensed"';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('TUBE FC', FIELD.cx, FIELD.cy);
  ctx.globalAlpha = 1;
  ctx.restore();
  const edge = ctx.createLinearGradient(0, y, 0, y + 30);
  edge.addColorStop(0, 'rgba(0,0,0,.28)'); edge.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = edge; ctx.fillRect(x, y, w, 30);
}

function drawGoals(g) {
  const mouth = goalMouthY();
  const drawGoal = (side) => {
    const isRight = side === 'right';
    const lineX = isRight ? FIELD.right : FIELD.x;
    const depth = GOAL.depth;
    const x1 = isRight ? lineX : lineX - depth;
    ctx.fillStyle = 'rgba(5,10,12,.42)';
    ctx.fillRect(x1, mouth.top, depth, GOAL.half * 2);
    ctx.strokeStyle = 'rgba(230,240,235,.45)';
    ctx.lineWidth = 1;
    const step = 12;
    if (isRight) {
      for (let x = lineX; x <= lineX + depth; x += step) { ctx.beginPath(); ctx.moveTo(x, mouth.top); ctx.lineTo(x, mouth.bottom); ctx.stroke(); }
      for (let y = mouth.top; y <= mouth.bottom; y += step) { ctx.beginPath(); ctx.moveTo(lineX, y); ctx.lineTo(lineX + depth, y); ctx.stroke(); }
    } else {
      for (let x = lineX; x >= lineX - depth; x -= step) { ctx.beginPath(); ctx.moveTo(x, mouth.top); ctx.lineTo(x, mouth.bottom); ctx.stroke(); }
      for (let y = mouth.top; y <= mouth.bottom; y += step) { ctx.beginPath(); ctx.moveTo(lineX, y); ctx.lineTo(lineX - depth, y); ctx.stroke(); }
    }
    ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 3;
    ctx.beginPath();
    if (isRight) { ctx.moveTo(lineX + depth, mouth.top); ctx.lineTo(lineX + depth, mouth.bottom); }
    else { ctx.moveTo(lineX - depth, mouth.top); ctx.lineTo(lineX - depth, mouth.bottom); }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.94)'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(lineX, mouth.top); ctx.lineTo(lineX, mouth.bottom); ctx.stroke();
    ctx.fillStyle = '#f8fff5';
    [mouth.top, mouth.bottom].forEach(y => { ctx.beginPath(); ctx.arc(lineX, y, 6, 0, Math.PI * 2); ctx.fill(); });
    ctx.save();
    ctx.globalAlpha = .16;
    const gr = ctx.createLinearGradient(lineX, 0, lineX + (isRight ? 80 : -80), 0);
    gr.addColorStop(0, '#c9ff3f'); gr.addColorStop(1, 'rgba(201,255,63,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(isRight ? lineX : lineX - 80, mouth.top, 80, GOAL.half * 2);
    ctx.restore();
  };
  drawGoal('left'); drawGoal('right');
}

function drawAim(g) {
  const p = controlled(g);
  if (!p || g.ball.owner !== p || g.phase !== 'play') return;
  const tx = g.pointer.x, ty = g.pointer.y;
  const angle = Math.atan2(ty - p.y, tx - p.x);
  const power = g.charging ? clamp(g.charge, 0, 1) : .2;
  const len = 110 + power * 120;
  ctx.save();
  ctx.globalAlpha = g.charging ? .7 : .22;
  ctx.strokeStyle = g.charging ? '#c9ff3f' : 'rgba(255,255,255,.8)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 7]);
  ctx.beginPath();
  ctx.moveTo(g.ball.x, g.ball.y);
  ctx.lineTo(g.ball.x + Math.cos(angle) * len, g.ball.y + Math.sin(angle) * len);
  ctx.stroke();
  ctx.setLineDash([]);
  const rx = clamp(g.pointer.x, FIELD.x + 20, FIELD.right - 20);
  const ry = clamp(g.pointer.y, FIELD.y + 20, FIELD.bottom - 20);
  ctx.globalAlpha = g.charging ? .9 : .35;
  ctx.strokeStyle = g.charging ? '#c9ff3f' : '#fff';
  ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.arc(rx, ry, 10 + power * 4, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(rx - 15, ry); ctx.lineTo(rx - 5, ry); ctx.moveTo(rx + 5, ry); ctx.lineTo(rx + 15, ry); ctx.moveTo(rx, ry - 15); ctx.lineTo(rx, ry - 5); ctx.moveTo(rx, ry + 5); ctx.lineTo(rx, ry + 15); ctx.stroke();
  ctx.restore();
}

function drawTrail(g) {
  for (const t of g.trail) {
    const a = clamp(t.life / t.max, 0, 1);
    ctx.globalAlpha = a * .22;
    ctx.fillStyle = '#f4ffe6';
    ctx.beginPath(); ctx.arc(t.x, t.y, 3 + (1 - a) * 5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

const BALL_SKIN_COLORS = {
  classic: { base: '#f2f5ef', alt: '#111517', glow: 'rgba(255,255,255,.2)' },
  street: { base: '#c9ff3f', alt: '#131b0b', glow: 'rgba(201,255,63,.4)' },
  checker: { base: '#f4f1e8', alt: '#15191c', glow: 'rgba(255,255,255,.2)' },
  ice: { base: '#bff5ff', alt: '#0d90af', glow: 'rgba(77,243,255,.45)' },
  magma: { base: '#ff6b2c', alt: '#280a06', glow: 'rgba(255,90,30,.5)' },
  gold: { base: '#ffc84a', alt: '#3c2808', glow: 'rgba(255,200,74,.55)' },
  cosmic: { base: '#6e4aff', alt: '#0a0620', glow: 'rgba(124,70,255,.55)' },
  disco: { base: '#ff4d9d', alt: '#4df3ff', glow: 'rgba(255,77,157,.55)' }
};
function drawBall(g, b) {
  const skin = BALL_SKIN_COLORS[b.skin] || BALL_SKIN_COLORS.classic;
  const lift = b.z * .52;
  ctx.save();
  ctx.globalAlpha = clamp(.34 - lift * .0018, .08, .34);
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(b.x, b.y + 7, 10 + lift * .07, 4 + lift * .025, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  const px = b.x, py = b.y - lift;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(b.rotation || 0);
  const speed = Math.hypot(b.vx, b.vy);
  if (speed > 500) {
    ctx.globalAlpha = .18;
    ctx.fillStyle = skin.base;
    ctx.beginPath(); ctx.ellipse(-Math.sign(b.vx || 1) * 18, 0, 18, BALL_R * .8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.shadowColor = skin.glow; ctx.shadowBlur = 8;
  ctx.fillStyle = skin.base;
  ctx.beginPath(); ctx.arc(0, 0, BALL_R, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = skin.alt;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + i * Math.PI * 2 / 5;
    const r = 4.8;
    i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = skin.alt; ctx.lineWidth = 1.2;
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5 + .3;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 7.5, Math.sin(a) * 7.5, 3.5, a + 1, a + 3.4);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, 0, BALL_R, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  ctx.beginPath(); ctx.ellipse(-3.4, -4, 2.7, 1.7, -.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawPlayer(g, p) {
  const l = save.loadouts[p.char.id] || save.loadouts.nova;
  const primary = p.side === 'home' ? (l.primary || '#c9ff3f') : KIT_AWAY.primary;
  const secondary = p.side === 'home' ? (l.secondary || '#0b1014') : KIT_AWAY.secondary;
  drawFootballer(g, p, primary, secondary, false);
}
function drawKeeper(g, k) {
  const kit = k.side === 'home' ? KIT_KEEPER_HOME : KIT_KEEPER_AWAY;
  drawFootballer(g, k, kit.primary, kit.secondary, true);
}

function drawFootballer(g, p, primary, secondary, keeper) {
  const running = p.moveMag > .08 && p.stun <= 0;
  const bob = running ? Math.sin(p.runPhase) * 2 : Math.sin(performance.now() * .003 + p.x) * .7;
  const lift = p.slide > 0 ? 2 : 0;
  const isSelected = p.isControlled && p.side === 'home' && !keeper;
  const px = p.x, py = p.y;
  ctx.save();
  ctx.globalAlpha = .38;
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(px, py + 14, 18, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  if (isSelected) {
    const pulse = 1 + Math.sin(performance.now() * .008) * .09;
    ctx.save();
    ctx.translate(px, py + 5);
    ctx.scale(1, .52);
    ctx.strokeStyle = '#c9ff3f'; ctx.lineWidth = 2.2; ctx.globalAlpha = .95;
    ctx.beginPath(); ctx.arc(0, 0, 26 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = .18; ctx.fillStyle = '#c9ff3f';
    ctx.beginPath(); ctx.arc(0, 0, 26 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.save(); ctx.fillStyle = '#c9ff3f';
    ctx.beginPath(); ctx.moveTo(px, py - 44); ctx.lineTo(px - 5, py - 52); ctx.lineTo(px + 5, py - 52); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(px, py + bob - lift);
  ctx.rotate(p.facing + Math.PI / 2);
  const scale = keeper ? 1.13 : 1;
  ctx.scale(scale, scale);

  if (p.slide > 0) {
    ctx.globalAlpha = .25; ctx.strokeStyle = primary; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(0, 34); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  const stride = running ? Math.sin(p.runPhase * 2) * 4 : 0;
  if (p.slide > 0) {
    ctx.fillStyle = secondary;
    ctx.beginPath(); ctx.ellipse(-6, 15, 5, 12, -.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(7, 11, 5, 11, .45, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.fillStyle = secondary;
    ctx.beginPath(); ctx.roundRect(-10, 6 + stride * .4, 7, 14, 3); ctx.fill();
    ctx.beginPath(); ctx.roundRect(3, 6 - stride * .4, 7, 14, 3); ctx.fill();
    ctx.fillStyle = keeper ? '#fff' : primary;
    ctx.beginPath(); ctx.roundRect(-10.5, 14 + stride * .4, 8, 8, 2); ctx.fill();
    ctx.beginPath(); ctx.roundRect(2.5, 14 - stride * .4, 8, 8, 2); ctx.fill();
    ctx.fillStyle = keeper ? primary : secondary;
    ctx.beginPath(); ctx.roundRect(-9.5, 10 + stride * .2, 6, 6, 2); ctx.fill();
    ctx.beginPath(); ctx.roundRect(3.5, 10 - stride * .2, 6, 6, 2); ctx.fill();
  }

  const accItem = p.side === 'home' ? itemOf(save.loadouts[p.char.id]?.acc) : null;
  if (accItem?.id === 'acc_cape' || accItem?.id === 'acc_wings') {
    ctx.save();
    ctx.globalAlpha = accItem.id === 'acc_wings' ? .65 : .85;
    ctx.fillStyle = accItem.color;
    const wave = Math.sin(performance.now() * .006 + p.x) * 4;
    ctx.beginPath();
    ctx.moveTo(-13, -4); ctx.quadraticCurveTo(-27 + wave, 18, -18, 36); ctx.quadraticCurveTo(-3, 28, 0, 20); ctx.quadraticCurveTo(4, 30, 17, 35); ctx.quadraticCurveTo(27 - wave, 17, 12, -4); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  ctx.fillStyle = primary;
  ctx.beginPath(); ctx.ellipse(0, 0, 16, 14, 0, 0, Math.PI * 2); ctx.fill();
  if (p.side === 'home') {
    const kit = itemOf(save.loadouts[p.char.id]?.kit);
    if (kit) {
      ctx.save();
      ctx.beginPath(); ctx.ellipse(0, 0, 16, 14, 0, 0, Math.PI * 2); ctx.clip();
      if (kit.pattern === 'pinstripe' || kit.pattern === 'stripes') {
        ctx.fillStyle = secondary;
        for (let i = -16; i < 16; i += 7) ctx.fillRect(i, -16, 3, 32);
      } else if (kit.pattern === 'sash') {
        ctx.fillStyle = secondary; ctx.rotate(-.6); ctx.fillRect(-30, -5, 60, 9);
      } else if (kit.pattern === 'hoops') {
        ctx.fillStyle = secondary;
        for (let i = -14; i < 14; i += 8) ctx.fillRect(-16, i, 32, 3.5);
      } else if (kit.pattern === 'halves') {
        ctx.fillStyle = secondary; ctx.fillRect(0, -14, 16, 28);
      } else if (kit.pattern === 'dots' || kit.pattern === 'stars') {
        ctx.fillStyle = secondary;
        [[-7, -5], [5, -4], [0, 5], [9, 7], [-10, 6]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill(); });
      } else if (kit.pattern === 'diagonal') {
        ctx.fillStyle = secondary; ctx.rotate(-.7);
        for (let i = -22; i < 22; i += 8) ctx.fillRect(i, -18, 3.5, 36);
      }
      ctx.restore();
    }
  }
  ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(-4, -5, 8, 5, -.5, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = primary; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-14, -2); ctx.lineTo(-21, 8 + stride); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(14, -2); ctx.lineTo(21, 8 - stride); ctx.stroke();
  ctx.fillStyle = keeper ? p.glove : p.char.skin;
  ctx.beginPath(); ctx.arc(-22, 9 + stride, keeper ? 4 : 2.7, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(22, 9 - stride, keeper ? 4 : 2.7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = p.char.skin;
  ctx.beginPath(); ctx.arc(0, -11, 5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(0, -16, 9.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.7)';
  ctx.beginPath(); ctx.arc(0, -21, 1.6, 0, Math.PI * 2); ctx.fill();
  if (!keeper) {
    ctx.fillStyle = p.char.hair;
    ctx.beginPath(); ctx.arc(0, -17, 9.7, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
    if (p.char.hairStyle === 'curls') {
      ctx.beginPath(); ctx.arc(-6, -23, 3.2, 0, Math.PI * 2); ctx.arc(0, -25, 3.4, 0, Math.PI * 2); ctx.arc(6, -23, 3.2, 0, Math.PI * 2); ctx.fill();
    } else if (p.char.hairStyle === 'quiff') {
      ctx.beginPath(); ctx.ellipse(3, -25, 6, 3.5, -.2, 0, Math.PI * 2); ctx.fill();
    }
  } else {
    ctx.fillStyle = primary;
    ctx.beginPath(); ctx.arc(0, -17, 9.7, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillStyle = secondary; ctx.fillRect(-10, -19, 20, 2);
  }
  if (p.side === 'home' && !keeper) {
    const hat = itemOf(save.loadouts[p.char.id]?.hat);
    if (hat) drawPlayerHat(hat, 0, -16);
  }
  if (keeper) {
    ctx.strokeStyle = p.glove; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(-22, 9 + stride, 4, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(22, 9 - stride, 4, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

function drawPlayerHat(hat, x, y) {
  ctx.save();
  ctx.translate(x, y);
  if (hat.id === 'hat_cap' || hat.id === 'hat_bucket' || hat.id === 'hat_visor') {
    ctx.fillStyle = hat.color;
    ctx.beginPath(); ctx.arc(0, -2, 9.6, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillStyle = hat.accent; ctx.fillRect(-10, -3, 20, 2.5);
    ctx.beginPath(); ctx.ellipse(6, 1, 7, 3, 0, 0, Math.PI * 2); ctx.fill();
  } else if (hat.id === 'hat_beanie') {
    ctx.fillStyle = hat.color;
    ctx.beginPath(); ctx.arc(0, -2, 9.8, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillStyle = hat.accent; ctx.fillRect(-10, -4, 20, 3);
  } else if (hat.id === 'hat_headband') {
    ctx.fillStyle = hat.color; ctx.fillRect(-10, -17, 20, 3.4);
  } else if (hat.id === 'hat_headphones') {
    ctx.strokeStyle = hat.color; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, -16, 12, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    ctx.fillStyle = hat.accent; ctx.beginPath(); ctx.arc(-11, -13, 3.3, 0, Math.PI * 2); ctx.arc(11, -13, 3.3, 0, Math.PI * 2); ctx.fill();
  } else if (hat.id === 'hat_crown') {
    ctx.fillStyle = hat.color;
    ctx.beginPath(); ctx.moveTo(-9, -20); ctx.lineTo(-11, -29); ctx.lineTo(-4, -24); ctx.lineTo(0, -31); ctx.lineTo(4, -24); ctx.lineTo(11, -29); ctx.lineTo(9, -20); ctx.closePath(); ctx.fill();
  } else if (hat.id === 'hat_halo') {
    ctx.strokeStyle = hat.color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, -29, 10, 3, 0, 0, Math.PI * 2); ctx.stroke();
  } else if (hat.id === 'hat_mohawk') {
    ctx.fillStyle = hat.color;
    ctx.beginPath(); ctx.moveTo(-4, -24); ctx.lineTo(-6, -34); ctx.lineTo(0, -28); ctx.lineTo(2, -36); ctx.lineTo(6, -27); ctx.lineTo(8, -32); ctx.lineTo(7, -22); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function drawParticles(g) {
  for (const p of g.particles) {
    const a = clamp(p.life / p.max, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    if (p.confetti) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.life * 8);
      ctx.fillRect(-p.size / 2, -p.size, p.size, p.size * 2); ctx.restore();
    } else {
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}
function drawFloaters(g) {
  for (const f of g.floaters) {
    const a = clamp(f.life / Math.min(.35, f.max), 0, 1);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = `italic 900 ${Math.round(18 * f.size + 2)}px "Barlow Condensed"`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(4,7,9,.8)';
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
    ctx.restore();
  }
}

/* ------------------------------------------------------------------ loop */
function gameLoop(ts) {
  raf = requestAnimationFrame(gameLoop);
  if (!G || !G.active) return;
  const raw = Math.min(.05, (ts - lastFrame) / 1000 || 0);
  lastFrame = ts;
  if (!G.paused) updateGame(G, raw);
  renderGame(G);
}
function startGameLoop() {
  if (raf) cancelAnimationFrame(raf);
  lastFrame = performance.now();
  raf = requestAnimationFrame(gameLoop);
}

function startMatch(mode) {
  if (!mode) mode = 'normal';
  Sound.init();
  fitCanvas();
  setScreen('game');
  G = createGame(mode);
  const cfg = G.cfg;
  $('#hudMode').textContent = cfg.label;
  $('.hud-rule').textContent = mode === 'freestyle' ? 'NO DEFENDERS · MAX COMBOS' : mode === 'ranked' ? 'RANKED · 2V2' : 'CAGE RULES · 2V2';
  $('#homeScore').textContent = '0';
  $('#awayScore').textContent = '0';
  $('#comboValue').textContent = '0';
  $('#stylePoints').textContent = '0';
  $('#comboBar').style.width = '0%';
  $('#countdown').classList.add('is-active');
  $('#countdownKicker').textContent = mode === 'ranked' ? 'RANKED MATCH' : mode === 'freestyle' ? 'STYLE SESSION' : 'NORMAL MATCH';
  $('#countdownNumber').textContent = '3';
  $('#countdown small').textContent = mode === 'freestyle' ? 'NOVA + REX · NO DEFENDERS' : 'NOVA + REX VS NEON KINGS';
  $('#goalBanner').classList.remove('is-active');
  $('#resultOverlay').classList.remove('is-active');
  $('#pauseOverlay').classList.remove('is-active');
  $('#trickHud').classList.remove('is-active');
  $('#chargeWrap').classList.remove('is-active');
  startGameLoop();
  updateHUD(G);
}

/* ------------------------------------------------------------------ wiring */
function showHowTo() {
  $('#modalRoot').innerHTML = `<div class="modal-card">
    <button class="modal-close" data-close-modal>✕</button>
    <span class="section-kicker">STREET BALL 101</span>
    <h2>NO RULES.<br>JUST BALL.</h2>
    <p>2v2 cage football. Both your ballers are on the pitch — you automatically take control of whoever is carrying the rock. Use <b>Q</b> to switch when you are off the ball. Your AI teammate and both goalies handle themselves.</p>
    <div class="how-grid">
      <div><b>MOVE · WASD</b><span>Sprint with SHIFT. Stamina drains, then refills when you ease off.</span></div>
      <div><b>SHOOT · SPACE</b><span>Hold to load power, aim with the mouse, release to strike. Pressure and distance add error.</span></div>
      <div><b>PASS · E</b><span>Lead pass to your running mate. The AI teammate also passes and shoots.</span></div>
      <div><b>TRICK · T</b><span>Start a trick, then hit the arrow sequence before the bar empties. Wrong key = turnover.</span></div>
      <div><b>TACKLE · X</b><span>Slide in to win it clean. Mistime it and you are on the floor.</span></div>
      <div><b>KEEPERS · 50/50</b><span>On-target shots are a coin flip. A catch gets punted upfield. A parry stays live — no punt.</span></div>
    </div>
    <div class="overlay-actions"><button class="btn btn-lime" data-close-modal>LET'S BALL</button></div>
  </div>`;
  $('#modalRoot').classList.add('is-active');
  save.seenHow = true; persist();
}

document.addEventListener('click', e => {
  const nav = e.target.closest('[data-nav]');
  const mode = e.target.closest('[data-mode]');
  const action = e.target.closest('[data-action]');
  const close = e.target.closest('[data-close-modal]');
  const charSel = e.target.closest('[data-char-select]');
  const invTab = e.target.closest('[data-inv]');
  const itemBtn = e.target.closest('[data-item]');
  const buy = e.target.closest('[data-buy]');
  const filter = e.target.closest('[data-filter]');
  const crate = e.target.closest('[data-crate]');
  const color = e.target.closest('[data-color]');
  Sound.init();
  if (close) { $('#modalRoot').classList.remove('is-active'); return; }
  if (color) {
    const c = charById(save.selectedChar);
    save.loadouts[c.id][color.dataset.color] = color.dataset.hex;
    persist(); Sound.ui(); renderLocker();
    return;
  }
  if (charSel) { save.selectedChar = charSel.dataset.charSelect; persist(); renderLocker(); Sound.ui(); return; }
  if (invTab) { currentLockerTab = invTab.dataset.inv; renderLocker(); Sound.ui(); return; }
  if (itemBtn) {
    const item = itemOf(itemBtn.dataset.item);
    if (!item) return;
    if (owned(item.id)) equipItem(item);
    else if (purchaseItem(item)) { equipItem(item); renderShop(); }
    return;
  }
  if (buy) {
    const item = itemOf(buy.dataset.buy);
    if (purchaseItem(item)) { renderShop(); renderHome(); }
    return;
  }
  if (filter) { shopFilter = filter.dataset.filter; renderShop(); Sound.ui(); return; }
  if (crate) { openCrate(crate.dataset.crate, false); return; }
  if (action?.dataset.action === 'how') { showHowTo(); return; }
  if (action?.dataset.action === 'daily') {
    if (Date.now() - (save.lastDaily || 0) <= 8 * 3600e3) { toast('<b>Daily drop</b> already claimed. Resets in a few hours.', true); return; }
    openCrate('street', true);
    return;
  }
  if (mode) { startMatch(mode.dataset.mode); return; }
  if (nav) {
    const target = nav.dataset.nav;
    if (target === 'ranked') { toast(`<b>${rankFor(save.rp).label}</b> · ${fmt(save.rp)} RP. Queue ranked from the hub.`); return; }
    if (nav.dataset.char) { save.selectedChar = nav.dataset.char; persist(); }
    if (G) quitGame();
    setScreen(target);
    return;
  }
});
$('#soundToggle').addEventListener('click', () => {
  save.muted = !save.muted; Sound.enabled = !save.muted; persist();
  $('#soundToggle').classList.toggle('muted', save.muted);
  $('#muteGame').textContent = save.muted ? '✕' : '♪';
  if (!save.muted) { Sound.init(); Sound.ui(); }
});
$('#muteGame')?.addEventListener('click', () => {
  save.muted = !save.muted; Sound.enabled = !save.muted; persist();
  $('#muteGame').textContent = save.muted ? '✕' : '♪';
  $('#soundToggle').classList.toggle('muted', save.muted);
});
$('#pauseGame')?.addEventListener('click', () => pauseGame());
$('#resumeGame')?.addEventListener('click', () => resumeGame());
$('#quitGame')?.addEventListener('click', () => quitGame());
$('#homeBtn')?.addEventListener('click', () => quitGame());
$('#rematchBtn')?.addEventListener('click', () => { const m = G?.mode || 'normal'; startMatch(m); });
$('#crateDone')?.addEventListener('click', () => { $('#crateOverlay').classList.remove('is-active'); crateBusy = false; renderCrates(); renderLocker(); renderShop(); });
$('#crateOpenMore')?.addEventListener('click', () => { const t = lastCrateType; $('#crateOverlay').classList.remove('is-active'); setTimeout(() => openCrate(t, false), 180); });
$('#modalRoot')?.addEventListener('click', e => { if (e.target === $('#modalRoot')) $('#modalRoot').classList.remove('is-active'); });

if (save.muted) { Sound.enabled = false; $('#soundToggle').classList.add('muted'); }
$('#muteGame').textContent = save.muted ? '✕' : '♪';
document.querySelectorAll('.brand').forEach(b => b.addEventListener('click', () => { if (G) quitGame(); setScreen('home'); }));
fitCanvas();
renderHome();
