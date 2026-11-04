/* ==========================================================================
   TUBE FC — a complete street football game in one canvas.
   No frameworks, no network, no pay-to-win. Just ball.
   ========================================================================== */
'use strict';

/* ------------------------------------------------------------------ utils */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const fmt = n => Math.round(n).toLocaleString('en-US');
const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let uidCounter = 0;
const uid = p => `${p}${++uidCounter}`;

const STORE_KEY = 'tubefc_save_v1';

/* ------------------------------------------------------------------ data */
const CHARACTERS = [
  {
    id: 'nova', name: 'NOVA', number: 7, role: 'WINGER', height: '5\'9"',
    skin: '#8f5238', skinShade: '#6e3b27', hair: '#111417', hairStyle: 'curls',
    eyes: '#19120e', boot: '#c9ff3f',
    stats: { pace: 9, shot: 7, trick: 10 },
    speed: 238, shotPower: .95, trickSkill: 1.08,
    bio: 'Cage-born. Two-footed. Will rainbow you just to hear the crowd.',
    glow: 'rgba(201,255,63,.25)'
  },
  {
    id: 'rex', name: 'REX', number: 9, role: 'STRIKER', height: '6\'1"',
    skin: '#e8b185', skinShade: '#c88d63', hair: '#e7c26b', hairStyle: 'quiff',
    eyes: '#3b2a1a', boot: '#4df3ff',
    stats: { pace: 7, shot: 10, trick: 7 },
    speed: 218, shotPower: 1.1, trickSkill: .94,
    bio: 'Built like a fridge, finishes like a cheat code. Do not give him a yard.',
    glow: 'rgba(77,243,255,.2)'
  }
];

const RARITY = {
  common: { label: 'Common', weight: 1 },
  uncommon: { label: 'Uncommon', weight: 2 },
  rare: { label: 'Rare', weight: 3 },
  epic: { label: 'Epic', weight: 4 },
  legendary: { label: 'Legendary', weight: 5 }
};
const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

const ITEMS = [
  /* kits */
  { id: 'kit_street', type: 'kit', name: 'Street Original', sub: 'Home 01', rarity: 'common', price: 0, pattern: 'pinstripe', palette: ['#c9ff3f', '#0b1014'] },
  { id: 'kit_metro', type: 'kit', name: 'Metro Away', sub: 'Ice white', rarity: 'common', price: 140, pattern: 'sash', palette: ['#eaf7ff', '#173645'] },
  { id: 'kit_blackout', type: 'kit', name: 'Blackout', sub: 'After dark', rarity: 'uncommon', price: 260, pattern: 'trim', palette: ['#101317', '#c9ff3f'] },
  { id: 'kit_retro', type: 'kit', name: 'Retro 98', sub: 'Class of the cage', rarity: 'uncommon', price: 300, pattern: 'hoops', palette: ['#14b8a6', '#ff5b9e'] },
  { id: 'kit_sunset', type: 'kit', name: 'Sunset Rush', sub: 'Golden hour', rarity: 'rare', price: 480, pattern: 'halves', palette: ['#ff8a2a', '#ff3d7f'] },
  { id: 'kit_galaxy', type: 'kit', name: 'Galaxy', sub: 'Deep space drip', rarity: 'rare', price: 560, pattern: 'stars', palette: ['#6d4bff', '#4df3ff'] },
  { id: 'kit_ice', type: 'kit', name: 'Ice Cold', sub: 'Sub zero', rarity: 'epic', price: 900, pattern: 'dots', palette: ['#7ce8ff', '#071b2b'] },
  { id: 'kit_gold', type: 'kit', name: '24K', sub: 'Solid gold', rarity: 'epic', price: 1080, pattern: 'trim', palette: ['#15120a', '#ffc84a'] },
  { id: 'kit_flame', type: 'kit', name: 'Flame Thrower', sub: 'Too hot', rarity: 'legendary', price: 1900, pattern: 'diagonal', palette: ['#ff3d2e', '#ffc84a'] },
  /* hats */
  { id: 'hat_cap', type: 'hat', name: 'Corner Cap', sub: 'Everyday flex', rarity: 'common', price: 0, color: '#c9ff3f', accent: '#111417' },
  { id: 'hat_beanie', type: 'hat', name: 'Cold Feet Beanie', sub: 'Winter ball', rarity: 'common', price: 120, color: '#1d2933', accent: '#c9ff3f' },
  { id: 'hat_headband', type: 'hat', name: 'Sweatband', sub: 'Old school', rarity: 'common', price: 110, color: '#f4f1e8', accent: '#c9ff3f' },
  { id: 'hat_bucket', type: 'hat', name: 'Bucket Hat', sub: 'Certified character', rarity: 'uncommon', price: 250, color: '#2b3a25', accent: '#c9ff3f' },
  { id: 'hat_visor', type: 'hat', name: 'Neon Visor', sub: 'Future fit', rarity: 'rare', price: 470, color: '#4df3ff', accent: '#091215' },
  { id: 'hat_headphones', type: 'hat', name: 'Matchday Phones', sub: 'Locked in', rarity: 'rare', price: 520, color: '#f4f1e8', accent: '#ff4d9d' },
  { id: 'hat_mohawk', type: 'hat', name: 'Flame Hawk', sub: 'Main character energy', rarity: 'epic', price: 880, color: '#ff4d5d', accent: '#ffc84a' },
  { id: 'hat_halo', type: 'hat', name: 'Angel Halo', sub: 'Never fouls', rarity: 'epic', price: 960, color: '#e8ffff', accent: '#4df3ff' },
  { id: 'hat_crown', type: 'hat', name: 'Crown Royal', sub: 'King of the cage', rarity: 'legendary', price: 2000, color: '#ffc84a', accent: '#8a5b10' },
  /* accessories */
  { id: 'acc_shades', type: 'acc', name: 'Ice Shades', sub: 'Zero reaction', rarity: 'common', price: 0, color: '#0c1116', accent: '#4df3ff' },
  { id: 'acc_scarf', type: 'acc', name: 'Ultras Scarf', sub: 'Loud and proud', rarity: 'common', price: 130, color: '#ff4d5d', accent: '#f4f1e8' },
  { id: 'acc_wrist', type: 'acc', name: 'Captain Band', sub: 'Armband energy', rarity: 'uncommon', price: 230, color: '#c9ff3f', accent: '#111417' },
  { id: 'acc_boots', type: 'acc', name: 'Neon Boots', sub: 'Light up the touchline', rarity: 'uncommon', price: 270, color: '#c9ff3f', accent: '#fff' },
  { id: 'acc_socks', type: 'acc', name: 'Galaxy Socks', sub: 'Space calves', rarity: 'rare', price: 430, color: '#6d4bff', accent: '#4df3ff' },
  { id: 'acc_chain', type: 'acc', name: 'Tube Chain', sub: 'Make it rain', rarity: 'rare', price: 500, color: '#ffc84a', accent: '#fff' },
  { id: 'acc_cape', type: 'acc', name: 'Super Sub Cape', sub: 'Hero off the bench', rarity: 'epic', price: 940, color: '#ff3d7f', accent: '#ffc84a' },
  { id: 'acc_gloves', type: 'acc', name: 'Ice Gloves', sub: 'Cold hands, warm heart', rarity: 'epic', price: 860, color: '#dffcff', accent: '#4df3ff' },
  { id: 'acc_wings', type: 'acc', name: 'Holo Wings', sub: 'Untouchable', rarity: 'legendary', price: 2100, color: '#4df3ff', accent: '#c9ff3f' },
  /* balls */
  { id: 'ball_classic', type: 'ball', name: 'Classic Rock', sub: 'OG panel', rarity: 'common', price: 0, skin: 'classic' },
  { id: 'ball_street', type: 'ball', name: 'Street Rock', sub: 'Concrete proof', rarity: 'common', price: 150, skin: 'street' },
  { id: 'ball_checker', type: 'ball', name: 'Checkerboard', sub: 'Skate park energy', rarity: 'uncommon', price: 280, skin: 'checker' },
  { id: 'ball_ice', type: 'ball', name: 'Frozen Rock', sub: 'Sub zero', rarity: 'rare', price: 470, skin: 'ice' },
  { id: 'ball_magma', type: 'ball', name: 'Magma Rock', sub: 'Molten touch', rarity: 'rare', price: 560, skin: 'magma' },
  { id: 'ball_gold', type: 'ball', name: '24K Rock', sub: 'Heavy is the head', rarity: 'epic', price: 980, skin: 'gold' },
  { id: 'ball_cosmic', type: 'ball', name: 'Cosmic Rock', sub: 'Out of this world', rarity: 'epic', price: 1120, skin: 'cosmic' },
  { id: 'ball_disco', type: 'ball', name: 'Disco Rock', sub: 'Party in the box', rarity: 'legendary', price: 1750, skin: 'disco' }
];
const ITEM_MAP = Object.fromEntries(ITEMS.map(i => [i.id, i]));
const itemOf = id => ITEM_MAP[id] || null;
const TYPE_LABEL = { kit: 'KIT', hat: 'HAT', acc: 'ACCESSORY', ball: 'BALL SKIN' };
const DEFAULT_OWNED = ['kit_street', 'kit_metro', 'hat_cap', 'hat_beanie', 'acc_shades', 'acc_scarf', 'ball_classic', 'ball_street'];

const RANK_TIERS = [
  { name: 'BRONZE', min: 0, color: '#c78654', glyph: '●' },
  { name: 'SILVER', min: 500, color: '#c6d0d8', glyph: '◆' },
  { name: 'GOLD', min: 1000, color: '#ffc84a', glyph: '◆' },
  { name: 'PLATINUM', min: 1500, color: '#8ef4e2', glyph: '✦' },
  { name: 'DIAMOND', min: 2000, color: '#7cc6ff', glyph: '💎' },
  { name: 'CHAMPION', min: 2500, color: '#ff7ad9', glyph: '♛' }
];
function rankFor(rp) {
  let tier = RANK_TIERS[0];
  for (const t of RANK_TIERS) if (rp >= t.min) tier = t;
  const next = RANK_TIERS.find(t => t.min > rp) || null;
  const span = next ? next.min - tier.min : 500;
  const local = clamp((rp - tier.min) / span, 0, .999);
  const division = local < .34 ? 'III' : local < .68 ? 'II' : 'I';
  return { ...tier, division, label: `${tier.name} ${division}`, local, next };
}

const COLORS = [
  { id: 'lime', name: 'Volt', hex: '#c9ff3f' },
  { id: 'cyan', name: 'Glacier', hex: '#4df3ff' },
  { id: 'pink', name: 'Bubblegum', hex: '#ff4d9d' },
  { id: 'red', name: 'Inferno', hex: '#ff3d4f' },
  { id: 'orange', name: 'Sunset', hex: '#ff8a2a' },
  { id: 'violet', name: 'Ultraviolet', hex: '#9c7bff' },
  { id: 'cream', name: 'Bone', hex: '#f4f1e8' },
  { id: 'white', name: 'Whiteout', hex: '#ffffff' },
  { id: 'navy', name: 'Midnight', hex: '#0c1420' },
  { id: 'black', name: 'Blackout', hex: '#0b0c0e' },
  { id: 'gold', name: '24K', hex: '#ffc84a' },
  { id: 'teal', name: 'Deep Teal', hex: '#14b8a6' }
];

/* ------------------------------------------------------------------ save */
function freshSave() {
  return {
    version: 1,
    tubes: 1500,
    rp: 1240,
    owned: [...DEFAULT_OWNED],
    ball: 'ball_street',
    loadouts: {
      nova: { kit: 'kit_street', hat: 'hat_cap', acc: 'acc_shades', primary: '#c9ff3f', secondary: '#0b1014' },
      rex: { kit: 'kit_metro', hat: 'hat_beanie', acc: 'acc_scarf', primary: '#4df3ff', secondary: '#0c1420' }
    },
    selectedChar: 'nova',
    muted: false,
    stats: { matches: 0, wins: 0, goals: 0, tricks: 0, bestCombo: 0, saves: 0 },
    lastDaily: 0,
    seenHow: false
  };
}
function loadSave() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object') return freshSave();
    const base = freshSave();
    const merged = { ...base, ...parsed, stats: { ...base.stats, ...(parsed.stats || {}) }, loadouts: { ...base.loadouts, ...(parsed.loadouts || {}) } };
    merged.owned = [...new Set([...DEFAULT_OWNED, ...(Array.isArray(parsed.owned) ? parsed.owned : [])])].filter(id => ITEM_MAP[id]);
    if (!ITEM_MAP[merged.ball]) merged.ball = 'ball_street';
    for (const c of CHARACTERS) {
      const l = merged.loadouts[c.id] || {};
      merged.loadouts[c.id] = { ...base.loadouts[c.id], ...l };
      if (!ITEM_MAP[merged.loadouts[c.id].kit]) merged.loadouts[c.id].kit = base.loadouts[c.id].kit;
      if (merged.loadouts[c.id].hat && !ITEM_MAP[merged.loadouts[c.id].hat]) merged.loadouts[c.id].hat = null;
      if (merged.loadouts[c.id].acc && !ITEM_MAP[merged.loadouts[c.id].acc]) merged.loadouts[c.id].acc = null;
    }
    return merged;
  } catch { return freshSave(); }
}
let save = loadSave();
function persist() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(save)); } catch { /* local only */ }
}
const charById = id => CHARACTERS.find(c => c.id === id) || CHARACTERS[0];
const owned = id => save.owned.includes(id);
const loadoutFor = c => save.loadouts[c.id];
function overallFor(c) {
  const l = loadoutFor(c);
  let bonus = 0;
  for (const id of [l.kit, l.hat, l.acc, save.ball]) {
    const it = itemOf(id);
    if (it) bonus += (RARITY[it.rarity]?.weight || 1) * .35;
  }
  return Math.round((c.stats.pace + c.stats.shot + c.stats.trick) / 3 * 8.2 + bonus);
}
function teamOverall() {
  return Math.round(CHARACTERS.reduce((a, c) => a + overallFor(c), 0) / CHARACTERS.length);
}

/* ------------------------------------------------------------------ audio */
const Sound = {
  ctx: null,
  enabled: !save.muted,
  init() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  },
  tone(freq, dur = .12, type = 'sine', vol = .05, slide = 0, delay = 0) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + .012);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t); o.stop(t + dur + .02);
  },
  noise(dur = .15, vol = .08, filter = 900, delay = 0) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const buffer = this.ctx.createBuffer(1, Math.max(1, Math.floor(this.ctx.sampleRate * dur)), this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'lowpass'; bp.frequency.value = filter;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    src.connect(bp).connect(g).connect(this.ctx.destination);
    src.start(t);
  },
  kick(power = 1) { this.noise(.08, .06 + power * .05, 1200); this.tone(95 - power * 20, .1, 'sine', .09, -30); },
  pass() { this.tone(210, .07, 'triangle', .035, -40); },
  bounce() { this.tone(180, .06, 'sine', .03, -60); },
  whistle(long = false) { this.tone(1900, long ? .5 : .2, 'square', .025, 350); this.tone(2300, long ? .4 : .15, 'square', .015, -100, .04); },
  goal() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, .25, 'triangle', .06, 0, i * .07));
    this.noise(.55, .08, 1800, .05);
  },
  save() { this.tone(140, .18, 'sawtooth', .06, -50); this.noise(.1, .05, 700); },
  trick() { [880, 1174, 1568].forEach((f, i) => this.tone(f, .1, 'square', .025, 80, i * .04)); },
  miss() { this.tone(180, .2, 'sawtooth', .04, -80); },
  ui() { this.tone(620, .04, 'triangle', .02, 80); },
  unlock(rarity = 'common') {
    const mult = RARITY_ORDER.indexOf(rarity) + 1;
    const root = 440 * (1 + mult * .06);
    [0, 4, 7, 12].forEach((n, i) => this.tone(root * Math.pow(2, n / 12), .22, 'triangle', .04, 0, i * .06));
    this.noise(.22, .03, 2200);
  },
  crate() { this.noise(.18, .07, 600); this.tone(75, .25, 'sine', .1, -25); }
};

/* ------------------------------------------------------------------ avatar art */
const HAT_COLORS = {};
function viewedLoadout(c) { return save.loadouts[c.id]; }

function ballSVG(skin = 'classic', cls = '') {
  const skins = {
    classic: { base: '#f3f5f2', alt: '#13181b', glow: 'rgba(255,255,255,.2)' },
    street: { base: '#c9ff3f', alt: '#11170b', glow: 'rgba(201,255,63,.35)' },
    checker: { base: '#f5f2e8', alt: '#15191c', glow: 'rgba(255,255,255,.2)' },
    ice: { base: '#c9f8ff', alt: '#1287a8', glow: 'rgba(77,243,255,.4)' },
    magma: { base: '#ff6b2c', alt: '#2a0b07', glow: 'rgba(255,90,30,.45)' },
    gold: { base: '#ffc84a', alt: '#382507', glow: 'rgba(255,200,74,.5)' },
    cosmic: { base: '#6c47ff', alt: '#0a0620', glow: 'rgba(124,70,255,.5)' },
    disco: { base: '#ff4d9d', alt: '#4df3ff', glow: 'rgba(255,77,157,.5)' }
  };
  const s = skins[skin] || skins.classic;
  const id = uid('ballclip');
  let detail = '';
  if (skin === 'checker') {
    detail = `<g clip-path="url(#${id})" fill="${s.alt}"><rect x="0" y="0" width="25" height="25"/><rect x="50" y="0" width="25" height="25"/><rect x="25" y="25" width="25" height="25"/><rect x="75" y="25" width="25" height="25"/><rect x="50" y="50" width="25" height="25"/><rect x="0" y="50" width="25" height="25"/><rect x="25" y="75" width="25" height="25"/><rect x="75" y="75" width="25" height="25"/></g>`;
  } else if (skin === 'magma') {
    detail = `<g clip-path="url(#${id})" stroke="${s.alt}" stroke-width="4" fill="none" opacity=".9"><path d="M8 17 26 31 17 44 43 53 34 75 51 88"/><path d="M71 4 63 25 82 34 68 51 88 61"/></g>`;
  } else if (skin === 'ice') {
    detail = `<g clip-path="url(#${id})" stroke="${s.alt}" stroke-width="4" fill="none" opacity=".8"><path d="M13 22 45 49 32 85"/><path d="M87 14 58 45 77 76"/><path d="M48 2 41 30 12 43"/></g>`;
  } else if (skin === 'gold') {
    detail = `<g clip-path="url(#${id})" fill="none" stroke="${s.alt}" stroke-width="2.5" opacity=".8"><circle cx="50" cy="50" r="17"/><circle cx="50" cy="50" r="29"/><path d="M50 0v100M0 50h100M15 15l70 70M85 15 15 85"/></g>`;
  } else if (skin === 'cosmic') {
    detail = `<g clip-path="url(#${id})" fill="${s.alt}"><circle cx="24" cy="31" r="4"/><circle cx="72" cy="19" r="3"/><circle cx="84" cy="62" r="5"/><circle cx="37" cy="76" r="2.5"/><path d="M47 12 50 22 60 25 50 28 47 38 44 28 34 25 44 22Z" fill="${s.base}" opacity=".8"/><path d="M76 45 78 51 84 53 78 55 76 61 74 55 68 53 74 51Z" fill="${s.base}" opacity=".75"/></g>`;
  } else if (skin === 'disco') {
    detail = `<g clip-path="url(#${id})" fill="none" stroke="${s.alt}" stroke-width="1.8" opacity=".95"><circle cx="50" cy="50" r="16"/><circle cx="50" cy="50" r="30"/><path d="M50 0v100M0 50h100M15 15l70 70M85 15 15 85"/></g><g clip-path="url(#${id})" fill="${s.alt}" opacity=".8"><circle cx="19" cy="25" r="2"/><circle cx="73" cy="17" r="2.3"/><circle cx="87" cy="57" r="1.7"/><circle cx="31" cy="79" r="2.2"/></g>`;
  } else if (skin === 'street') {
    detail = `<g clip-path="url(#${id})" fill="${s.alt}"><path d="M50 12 66 26 61 46 39 46 34 26Z"/><path d="M9 44 26 51 20 69 2 62Z"/><path d="M91 44 74 51 80 69 98 62Z"/><path d="M50 61 64 75 55 95 45 95 36 75Z"/></g><path d="M50 12 66 26 61 46 39 46 34 26Z" fill="none" stroke="${s.base}" stroke-width="1.5"/>`;
  } else {
    detail = `<g clip-path="url(#${id})" fill="${s.alt}"><path d="M50 11 65 24 59 44 41 44 35 24Z"/><path d="M6 45 22 52 16 69 0 62Z"/><path d="M94 45 78 52 84 69 100 62Z"/><path d="M50 62 63 75 54 92 46 92 37 75Z"/></g>`;
  }
  return `<svg class="${cls}" width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><clipPath id="${id}"><circle cx="50" cy="50" r="49"/></clipPath><radialGradient id="${id}g" cx="35%" cy="27%" r="75%"><stop offset="0" stop-color="#fff" stop-opacity=".8"/><stop offset=".36" stop-color="${s.base}"/><stop offset="1" stop-color="${s.base}" stop-opacity=".82"/></radialGradient></defs><circle cx="50" cy="50" r="49" fill="${s.base}"/><circle cx="50" cy="50" r="49" fill="url(#${id}g)"/>${detail}<circle cx="50" cy="50" r="49" fill="none" stroke="rgba(0,0,0,.28)" stroke-width="2"/><ellipse cx="37" cy="26" rx="17" ry="11" fill="#fff" opacity=".28" transform="rotate(-24 37 26)"/></svg>`;
}

function hatArt(item, cx = 150, cy = 87) {
  if (!item) return '';
  const c = item.color, a = item.accent;
  switch (item.id) {
    case 'hat_cap':
      return `<g transform="translate(${cx - 150} ${cy - 87})"><path d="M-41 1 Q-38 -31 0 -33 Q38 -31 41 1 L38 8 Q0 -3 -38 8Z" fill="${c}"/><path d="M-38 4 Q-4 -5 39 4 Q53 3 57 10 Q38 17 8 13 Z" fill="${a}"/><path d="M-36 6 Q0 -3 38 6" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1.5"/></g>`;
    case 'hat_beanie':
      return `<g transform="translate(${cx - 150} ${cy - 87})"><path d="M-37 7 Q-36 -34 0 -37 Q36 -34 37 7 Q0 -3 -37 7Z" fill="${c}"/><path d="M-39 2 Q0 -9 39 2 L39 15 Q0 4 -39 15Z" fill="${a}" opacity=".85"/><path d="M-1 -36 0 -6" stroke="rgba(255,255,255,.2)" stroke-width="1.5"/><circle cx="0" cy="-40" r="5" fill="${a}"/></g>`;
    case 'hat_headband':
      return `<g transform="translate(${cx - 150} ${cy - 87})"><path d="M-38 3 Q0 -8 38 3 L37 14 Q0 3 -37 14Z" fill="${c}"/><path d="M-36 8 Q0 -2 36 8" stroke="${a}" stroke-width="3" fill="none"/></g>`;
    case 'hat_bucket':
      return `<g transform="translate(${cx - 150} ${cy - 87})"><path d="M-32 3 Q-30 -26 0 -30 Q30 -26 32 3Z" fill="${c}"/><path d="M-53 3 Q0 -7 53 3 L50 15 Q0 5 -50 15Z" fill="${a}"/><path d="M-31 -5 Q0 -14 31 -5" fill="none" stroke="rgba(255,255,255,.2)" stroke-width="2"/></g>`;
    case 'hat_visor':
      return `<g transform="translate(${cx - 150} ${cy - 87})"><path d="M-37 0 Q0 -12 37 0 L36 9 Q0 -3 -36 9Z" fill="${a}"/><path d="M-34 7 Q3 0 40 7 Q56 10 56 22 Q18 18 0 20 Q-18 18 -54 22 Q-53 12 -34 7Z" fill="${c}" opacity=".56"/><path d="M-44 4 Q0 -6 44 4" stroke="${c}" stroke-width="2" fill="none"/></g>`;
    case 'hat_headphones':
      return `<g transform="translate(${cx - 150} ${cy - 87})"><path d="M-45 13 Q-48 -46 0 -49 Q48 -46 45 13" fill="none" stroke="${c}" stroke-width="9" stroke-linecap="round"/><rect x="-55" y="-4" width="18" height="33" rx="8" fill="${a}"/><rect x="37" y="-4" width="18" height="33" rx="8" fill="${a}"/><path d="M-50 8h8v17h-8zM42 8h8v17h-8z" fill="${c}" opacity=".5"/></g>`;
    case 'hat_mohawk':
      return `<g transform="translate(${cx - 150} ${cy - 87})"><path d="M-9 3 L-18 -23 -7 -17 -3 -44 7 -26 17 -45 19 -15 29 -23 13 5Z" fill="${c}" stroke="${a}" stroke-width="1.2"/><path d="M0 -34 3 -12" stroke="${a}" stroke-width="2" opacity=".5"/></g>`;
    case 'hat_halo':
      return `<g transform="translate(${cx - 150} ${cy - 87})"><ellipse cx="0" cy="-37" rx="29" ry="7" fill="none" stroke="${c}" stroke-width="4"/><ellipse cx="0" cy="-37" rx="29" ry="7" fill="none" stroke="${a}" stroke-width="8" opacity=".23" filter="blur(2px)"/><circle cx="0" cy="-34" r="2" fill="${c}"/></g>`;
    case 'hat_crown':
      return `<g transform="translate(${cx - 150} ${cy - 87})"><path d="M-35 3 L-39 -25 -22 -12 -15 -35 0 -15 15 -35 22 -12 39 -25 35 3Z" fill="${c}" stroke="${a}" stroke-width="2.5" stroke-linejoin="round"/><rect x="-34" y="2" width="68" height="10" rx="3" fill="${c}" stroke="${a}" stroke-width="2"/><circle cx="-15" cy="-7" r="3" fill="${a}"/><circle cx="0" cy="-12" r="3.5" fill="${a}"/><circle cx="15" cy="-7" r="3" fill="${a}"/></g>`;
    default: return '';
  }
}

function avatarSVG(c, opts = {}) {
  const l = save.loadouts[c.id];
  const kit = itemOf(l.kit) || itemOf('kit_street');
  const hat = itemOf(l.hat);
  const acc = itemOf(l.acc);
  const pattern = kit.pattern || 'trim';
  const primary = l.primary || kit.palette[0];
  const secondary = l.secondary || kit.palette[1];
  const clip = uid('kitclip');
  const shortClip = uid('shortclip');
  const full = opts.full !== false;
  const ballSkin = itemOf(save.ball)?.skin || 'classic';
  const hairStyle = c.hairStyle || 'fade';

  const jerseyPattern = (() => {
    const p = [];
    switch (pattern) {
      case 'pinstripe':
        p.push(`<g opacity=".75">${[...Array(7)].map((_, i) => `<rect x="${99 + i * 16}" y="138" width="3" height="112" fill="${secondary}"/>`).join('')}</g>`);
        break;
      case 'stripes':
        p.push(`<g opacity=".8">${[...Array(5)].map((_, i) => `<rect x="${100 + i * 22}" y="138" width="12" height="112" fill="${secondary}"/>`).join('')}</g>`);
        break;
      case 'sash':
        p.push(`<path d="M83 144 123 142 214 221 199 246Z" fill="${secondary}" opacity=".92"/>`);
        break;
      case 'hoops':
        p.push(`<g opacity=".8">${[148, 174, 200, 226].map(y => `<rect x="86" y="${y}" width="130" height="12" fill="${secondary}"/>`).join('')}</g>`);
        break;
      case 'halves':
        p.push(`<path d="M150 134 L211 151 211 246 150 254Z" fill="${secondary}" opacity=".92"/>`);
        break;
      case 'stars':
        p.push(`<g fill="${secondary}" opacity=".85"><path d="M116 170 119 180 129 183 119 186 116 196 113 186 103 183 113 180Z"/><path d="M176 203 178 210 185 212 178 214 176 221 174 214 167 212 174 210Z"/><path d="M165 157 167 164 174 166 167 168 165 175 163 168 156 166 163 164Z"/><circle cx="130" cy="230" r="4"/><circle cx="95" cy="208" r="2.5"/></g>`);
        break;
      case 'dots':
        p.push(`<g fill="${secondary}" opacity=".75">${[[103, 170], [126, 190], [154, 168], [180, 192], [201, 220], [97, 220], [132, 234], [166, 230]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5"/>`).join('')}</g>`);
        break;
      case 'diagonal':
        p.push(`<g opacity=".8" transform="rotate(-22 150 190)">${[0, 1, 2, 3, 4, 5].map(i => `<rect x="${50 + i * 34}" y="120" width="17" height="150" fill="${secondary}"/>`).join('')}</g>`);
        break;
      default: break;
    }
    if (pattern !== 'trim') {
      p.push(`<path d="M93 164 Q150 178 207 164" stroke="rgba(255,255,255,.14)" stroke-width="2" fill="none"/>`);
    }
    return p.join('');
  })();

  const cape = acc?.id === 'acc_cape'
    ? `<path d="M104 156 Q72 221 58 316 Q94 300 115 321 Q128 236 133 169Z" fill="${acc.color}" opacity=".92"/><path d="M186 158 Q221 218 240 309 Q207 293 183 317 Q174 230 168 171Z" fill="${acc.color}" opacity=".78"/>`
    : '';
  const wings = acc?.id === 'acc_wings'
    ? `<g opacity=".7" fill="${acc.color}"><path d="M111 154 Q57 131 28 168 Q58 173 47 212 Q83 194 109 207Z"/><path d="M190 154 Q243 129 274 166 Q242 173 254 211 Q217 194 191 206Z"/></g><g opacity=".28" fill="${acc.accent}"><path d="M107 152 Q58 141 40 160 Q71 166 103 176Z"/><path d="M194 152 Q243 141 261 160 Q230 166 198 176Z"/></g>`
    : '';

  const socks = acc?.id === 'acc_socks'
    ? `<g><path d="M103 284 117 286 111 330 98 329Z" fill="${acc.color}"/><path d="M177 291 191 283 212 326 199 334Z" fill="${acc.color}"/><path d="M104 295 116 297M101 307 114 309M183 302 195 296M188 314 200 309" stroke="${acc.accent}" stroke-width="2" opacity=".85"/></g>`
    : '';
  const boots = acc?.id === 'acc_boots'
    ? `<g><path d="M91 332 Q91 322 105 323 Q120 323 125 331 L126 341 Q109 348 92 341Z" fill="${acc.color}"/><path d="M201 333 Q207 321 221 326 Q228 329 229 339 Q211 346 198 340Z" fill="${acc.color}"/><path d="M95 337 119 337M201 337 225 337" stroke="#fff" stroke-width="1.3" opacity=".8"/></g>`
    : '';
  const gloves = acc?.id === 'acc_gloves'
    ? `<g fill="${acc.color}"><circle cx="69" cy="238" r="10"/><circle cx="234" cy="224" r="10"/><path d="M60 235 76 241 72 249 58 243Z"/><path d="M225 221 242 218 245 227 228 230Z" fill="${acc.accent}"/></g>`
    : '';

  const shades = acc?.id === 'acc_shades'
    ? `<g><rect x="121" y="99" width="24" height="12" rx="5" fill="${acc.color}" stroke="${acc.accent}" stroke-width="1.4"/><rect x="155" y="99" width="24" height="12" rx="5" fill="${acc.color}" stroke="${acc.accent}" stroke-width="1.4"/><path d="M145 104h10" stroke="${acc.color}" stroke-width="2.5"/><path d="M122 99 119 95M179 99 182 95" stroke="${acc.color}" stroke-width="2"/><path d="M124 102 138 108M158 102 172 108" stroke="${acc.accent}" stroke-width="1.2" opacity=".7"/></g>`
    : '';
  const chain = acc?.id === 'acc_chain'
    ? `<g><path d="M135 139 Q150 163 165 139" fill="none" stroke="${acc.color}" stroke-width="2.5"/><circle cx="150" cy="157" r="8" fill="${acc.color}" stroke="${acc.accent}" stroke-width="1.3"/><text x="150" y="161" text-anchor="middle" font-family="Barlow Condensed" font-weight="900" font-size="10" fill="${acc.accent}">T</text><path d="M129 139 116 130M171 139 184 130" stroke="${acc.color}" stroke-width="1.6" opacity=".55"/></g>`
    : '';
  const scarf = acc?.id === 'acc_scarf'
    ? `<g><path d="M132 137 Q150 152 168 137 L174 147 Q150 164 126 147Z" fill="${acc.color}"/><path d="M132 146 Q127 178 115 205 L127 211 Q142 178 146 152Z" fill="${acc.color}"/><path d="M118 199 129 204 126 214 116 209Z" fill="${acc.accent}"/><path d="M135 142 Q150 152 166 142" stroke="${acc.accent}" stroke-width="2" fill="none" opacity=".8"/></g>`
    : '';
  const wrist = acc?.id === 'acc_wrist'
    ? `<g><rect x="66" y="211" width="15" height="9" rx="3" fill="${acc.color}" transform="rotate(28 73 215)"/><rect x="228" y="197" width="15" height="9" rx="3" fill="${acc.color}" transform="rotate(-33 235 201)"/></g>`
    : '';

  const hair = (() => {
    if (hairStyle === 'curls') {
      return `<path d="M110 105 Q102 66 130 55 Q150 43 177 57 Q199 68 192 107 Q186 83 174 79 Q150 86 124 79 Q114 86 110 105Z" fill="${c.hair}"/><g fill="${c.hair}"><circle cx="118" cy="65" r="8"/><circle cx="134" cy="54" r="8"/><circle cx="153" cy="50" r="8"/><circle cx="171" cy="57" r="8"/><circle cx="184" cy="69" r="7"/></g>`;
    }
    if (hairStyle === 'quiff') {
      return `<path d="M111 102 Q108 62 132 53 Q159 38 188 60 Q198 72 189 100 Q178 78 160 79 Q135 77 111 102Z" fill="${c.hair}"/><path d="M128 60 Q151 44 184 62 Q177 69 156 69Z" fill="${c.hair}" opacity=".95"/><path d="M155 56 Q178 55 187 72" stroke="rgba(0,0,0,.2)" stroke-width="2" fill="none"/>`;
    }
    return `<path d="M111 101 Q110 59 150 55 Q189 59 189 101 Q179 79 150 78 Q123 79 111 101Z" fill="${c.hair}"/>`;
  })();

  return `<svg viewBox="0 0 300 390" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeHtml(c.name)} player card">
    <defs>
      <clipPath id="${clip}"><path d="M101 148 Q150 130 199 148 L211 239 Q150 258 89 239Z"/></clipPath>
      <clipPath id="${shortClip}"><path d="M109 233 Q150 246 191 233 L198 277 Q150 289 102 277Z"/></clipPath>
      <radialGradient id="${clip}bg" cx="50%" cy="35%" r="65%"><stop offset="0" stop-color="${c.skin}"/><stop offset="1" stop-color="${c.skinShade}"/></radialGradient>
    </defs>
    <ellipse cx="151" cy="361" rx="86" ry="15" fill="rgba(0,0,0,.4)"/>
    ${cape}${wings}
    ${full ? `<g transform="translate(190 286) scale(.72)">${ballSVG(ballSkin)}</g>` : ''}
    <g transform="translate(0 2)">
      <path d="M111 240 Q108 285 101 328 L118 331 Q130 289 137 247Z" fill="url(#${clip}bg)"/>
      <path d="M170 245 Q177 290 192 328 L209 322 Q190 283 189 239Z" fill="url(#${clip}bg)"/>
      ${socks}
      <path d="M93 329 Q91 320 106 320 Q121 320 126 329 L127 340 Q109 347 91 339Z" fill="${acc?.id === 'acc_boots' ? c.boot : secondary}"/>
      <path d="M195 329 Q201 318 217 322 Q226 325 228 335 Q210 344 195 338Z" fill="${acc?.id === 'acc_boots' ? c.boot : secondary}"/>
      ${boots}
      <path d="M108 232 Q150 245 192 232 L201 276 Q150 290 99 276Z" fill="${secondary}"/>
      <path d="M109 237 Q150 248 191 237" stroke="rgba(255,255,255,.16)" stroke-width="2" fill="none"/>
      <g clip-path="url(#${shortClip})" opacity=".7">${[...Array(5)].map((_, i) => `<rect x="${111 + i * 18}" y="232" width="4" height="60" fill="${primary}" opacity=".7"/>`).join('')}</g>
      ${socks ? '' : `<path d="M106 277 118 279 111 322 98 321Z" fill="${secondary}" opacity=".55"/><path d="M180 280 192 275 208 320 196 325Z" fill="${secondary}" opacity=".55"/>`}
      <path d="M112 156 C92 173 79 205 73 237" fill="none" stroke="url(#${clip}bg)" stroke-width="17" stroke-linecap="round"/>
      <path d="M188 156 C208 171 222 197 231 222" fill="none" stroke="url(#${clip}bg)" stroke-width="17" stroke-linecap="round"/>
      <path d="M112 154 C96 166 84 184 77 202" fill="none" stroke="${primary}" stroke-width="22" stroke-linecap="round"/>
      <path d="M188 154 C205 165 216 181 224 197" fill="none" stroke="${primary}" stroke-width="22" stroke-linecap="round"/>
      <path d="M78 200 75 211M223 196 228 207" stroke="${secondary}" stroke-width="5" stroke-linecap="round"/>
      <path d="M101 148 Q150 130 199 148 L211 239 Q150 258 89 239Z" fill="${primary}"/>
      <g clip-path="url(#${clip})">${jerseyPattern}<path d="M101 148 Q150 130 199 148 L197 157 Q150 140 103 157Z" fill="rgba(255,255,255,.1)"/><path d="M89 239 Q150 258 211 239 L211 246 Q150 265 89 246Z" fill="rgba(0,0,0,.18)"/></g>
      <path d="M133 140 Q150 158 167 140" fill="none" stroke="${secondary}" stroke-width="4"/>
      <path d="M110 148 Q150 133 190 148" fill="none" stroke="rgba(255,255,255,.2)" stroke-width="2"/>
      <g opacity=".95"><circle cx="126" cy="166" r="7" fill="${secondary}"/><text x="126" y="170" text-anchor="middle" font-family="Barlow Condensed" font-weight="900" font-size="9" fill="${primary}">T</text></g>
      <text x="178" y="220" text-anchor="middle" font-family="Barlow Condensed" font-style="italic" font-weight="900" font-size="34" fill="${secondary}" opacity=".86">${c.number}</text>
      ${wrist}
      <circle cx="73" cy="237" r="9" fill="url(#${clip}bg)"/>
      <circle cx="233" cy="222" r="9" fill="url(#${clip}bg)"/>
      ${gloves}
      <path d="M138 134 L136 154 164 154 162 134Z" fill="url(#${clip}bg)"/>
      <ellipse cx="150" cy="104" rx="38" ry="42" fill="url(#${clip}bg)"/>
      <ellipse cx="112" cy="108" rx="7" ry="11" fill="${c.skin}"/>
      <ellipse cx="188" cy="108" rx="7" ry="11" fill="${c.skin}"/>
      ${hair}
      <path d="M131 92 Q138 87 145 92" stroke="${c.hair}" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M157 92 Q164 87 171 91" stroke="${c.hair}" stroke-width="3" fill="none" stroke-linecap="round"/>
      <ellipse cx="138" cy="105" rx="3.2" ry="4.1" fill="${c.eyes}"/>
      <ellipse cx="162" cy="105" rx="3.2" ry="4.1" fill="${c.eyes}"/>
      <circle cx="139" cy="104" r="1" fill="#fff" opacity=".8"/><circle cx="163" cy="104" r="1" fill="#fff" opacity=".8"/>
      <path d="M149 107 Q146 117 151 119 Q154 119 155 117" fill="none" stroke="${c.skinShade}" stroke-width="2" stroke-linecap="round"/>
      <path d="M141 127 Q150 132 160 126" fill="none" stroke="${c.skinShade}" stroke-width="2.3" stroke-linecap="round"/>
      <path d="M131 119 Q139 115 146 118" fill="none" stroke="${c.skinShade}" stroke-width="1.2" opacity=".5"/>
      ${shades}${chain}${scarf}
      ${hatArt(hat, 150, 89)}
    </g>
  </svg>`;
}

function kitSVG(item) {
  const clip = uid('ksvg');
  const [p, s] = item.palette;
  let pat = '';
  if (item.pattern === 'pinstripe') pat = [...Array(5)].map((_, i) => `<rect x="${19 + i * 12}" y="9" width="2" height="60" fill="${s}" opacity=".8"/>`).join('');
  if (item.pattern === 'sash') pat = `<path d="M7 20 78 12 88 32 18 40Z" fill="${s}" opacity=".9"/>`;
  if (item.pattern === 'hoops') pat = [22, 37, 52].map(y => `<rect x="4" y="${y}" width="84" height="7" fill="${s}" opacity=".85"/>`).join('');
  if (item.pattern === 'halves') pat = `<rect x="47" y="0" width="47" height="100" fill="${s}" opacity=".9"/>`;
  if (item.pattern === 'stars') pat = `<g fill="${s}">${[[22, 33], [42, 53], [64, 29], [72, 61], [33, 68]].map(([x, y]) => `<path d="M${x} ${y - 5} ${x + 1.5} ${y - 1.5} ${x + 5} ${y} ${x + 1.5} ${y + 1.5} ${x} ${y + 5} ${x - 1.5} ${y + 1.5} ${x - 5} ${y} ${x - 1.5} ${y - 1.5}Z"/>`).join('')}</g>`;
  if (item.pattern === 'dots') pat = `<g fill="${s}">${[[20, 28], [39, 46], [64, 31], [72, 58], [29, 64], [54, 70]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4"/>`).join('')}</g>`;
  if (item.pattern === 'diagonal') pat = `<g fill="${s}" opacity=".85" transform="rotate(-20 47 45)">${[0, 1, 2, 3].map(i => `<rect x="${4 + i * 22}" y="-20" width="10" height="140"/>`).join('')}</g>`;
  return `<svg viewBox="0 0 94 92" xmlns="http://www.w3.org/2000/svg"><defs><clipPath id="${clip}"><path d="M29 14 42 8Q47 20 52 8L66 14 83 31 73 44 65 38 65 84 29 84 29 38 21 44 11 31Z"/></clipPath></defs><path d="M29 14 42 8Q47 20 52 8L66 14 83 31 73 44 65 38 65 84 29 84 29 38 21 44 11 31Z" fill="${p}"/><g clip-path="url(#${clip})">${pat}<path d="M29 14 42 8Q47 20 52 8L66 14 83 31 73 44 65 38 65 84 29 84 29 38 21 44 11 31Z" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="2"/><path d="M42 8Q47 20 52 8" fill="none" stroke="${s}" stroke-width="4"/></g><text x="47" y="69" text-anchor="middle" font-family="Barlow Condensed" font-style="italic" font-weight="900" font-size="22" fill="${s}">T</text></svg>`;
}
function hatIcon(item) {
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${hatArt(item, 50, 57)}</svg>`;
}
function accIcon(item) {
  const c = item.color, a = item.accent;
  if (item.id === 'acc_shades') return `<svg viewBox="0 0 100 100"><rect x="12" y="37" width="31" height="20" rx="8" fill="${c}" stroke="${a}" stroke-width="2.5"/><rect x="57" y="37" width="31" height="20" rx="8" fill="${c}" stroke="${a}" stroke-width="2.5"/><path d="M43 45h14M12 40 4 35M88 40l8-5" stroke="${c}" stroke-width="5" stroke-linecap="round"/><path d="M18 44 33 53M62 44 77 53" stroke="${a}" stroke-width="2" opacity=".7"/></svg>`;
  if (item.id === 'acc_chain') return `<svg viewBox="0 0 100 100"><path d="M25 19Q28 58 50 62Q72 58 75 19" fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round"/><circle cx="50" cy="71" r="15" fill="${c}" stroke="${a}" stroke-width="2"/><text x="50" y="78" text-anchor="middle" font-family="Barlow Condensed" font-weight="900" font-size="18" fill="${a}">T</text></svg>`;
  if (item.id === 'acc_scarf') return `<svg viewBox="0 0 100 100"><path d="M24 26Q50 46 76 26L82 40Q50 62 18 40Z" fill="${c}"/><path d="M36 40Q28 64 20 85L35 89Q48 67 49 48Z" fill="${c}"/><path d="M24 79 33 82 30 94 20 91Z" fill="${a}"/><path d="M34 39Q50 50 66 39" fill="none" stroke="${a}" stroke-width="3" opacity=".8"/></svg>`;
  if (item.id === 'acc_wrist') return `<svg viewBox="0 0 100 100"><rect x="16" y="41" width="68" height="19" rx="7" fill="${c}" transform="rotate(-8 50 50)"/><text x="50" y="55" text-anchor="middle" font-family="Barlow Condensed" font-weight="900" font-size="13" fill="${a}" transform="rotate(-8 50 50)">CAPTAIN</text></svg>`;
  if (item.id === 'acc_boots') return `<svg viewBox="0 0 100 100"><path d="M18 63Q18 43 36 45L58 48Q76 50 84 63L85 72Q55 82 18 73Z" fill="${c}"/><path d="M22 66 82 66M28 59 40 62M50 60 62 63M48 75 76 72" stroke="${a}" stroke-width="2.5" opacity=".8"/><path d="M58 48 60 30 72 30 70 50" fill="${c}" opacity=".7"/></svg>`;
  if (item.id === 'acc_socks') return `<svg viewBox="0 0 100 100"><path d="M29 11 55 11 57 59Q60 78 78 83L74 94Q48 90 42 66L38 42 22 47 18 31 29 26Z" fill="${c}"/><path d="M27 22 56 18M25 31 53 28M42 66 70 84" stroke="${a}" stroke-width="2.5" opacity=".8"/><circle cx="65" cy="36" r="3" fill="${a}"/><circle cx="73" cy="53" r="2" fill="${a}"/></svg>`;
  if (item.id === 'acc_cape') return `<svg viewBox="0 0 100 100"><path d="M28 15Q50 5 72 15L84 90Q70 75 60 92Q50 80 39 92Q28 75 16 90Z" fill="${c}"/><path d="M50 12 50 87M30 22 37 83M70 22 63 83" stroke="${a}" stroke-width="2" opacity=".45"/><circle cx="50" cy="15" r="5" fill="${a}"/></svg>`;
  if (item.id === 'acc_gloves') return `<svg viewBox="0 0 100 100"><path d="M22 72Q14 46 26 36L30 50 34 26 42 28 44 46 47 24 56 25 56 46 60 30 68 32 66 54Q72 58 68 72Q58 88 40 82Q26 78 22 72Z" fill="${c}" stroke="${a}" stroke-width="2"/><path d="M28 66 65 62M30 74 61 70" stroke="${a}" stroke-width="1.5" opacity=".5"/></svg>`;
  if (item.id === 'acc_wings') return `<svg viewBox="0 0 100 100"><path d="M17 25Q48 34 50 68Q34 54 15 45Q22 41 17 25Z" fill="${c}" opacity=".9"/><path d="M83 25Q52 34 50 68Q66 54 85 45Q78 41 83 25Z" fill="${c}" opacity=".7"/><path d="M50 66 50 88" stroke="${a}" stroke-width="3"/><circle cx="50" cy="65" r="5" fill="${a}"/></svg>`;
  return '';
}
function itemArt(item) {
  if (item.type === 'kit') return kitSVG(item);
  if (item.type === 'hat') return hatIcon(item);
  if (item.type === 'acc') return accIcon(item);
  if (item.type === 'ball') return ballSVG(item.skin);
  return '';
}
function artBg(item) {
  const glows = {
    common: 'rgba(170,179,185,.1)', uncommon: 'rgba(201,255,63,.13)', rare: 'rgba(77,243,255,.15)',
    epic: 'rgba(156,123,255,.18)', legendary: 'rgba(255,200,74,.2)'
  };
  return `style="--item-glow:${glows[item.rarity] || glows.common};--art-bg:rgba(0,0,0,.16)"`;
}

/* ------------------------------------------------------------------ UI helpers */
function setScreen(name) {
  $$('.screen').forEach(s => s.classList.remove('is-active'));
  const screen = $(`#screen-${name}`);
  if (screen) screen.classList.add('is-active');
  document.body.classList.toggle('game-active', name === 'game');
  const activeNav = name === 'home' ? 'home' : (['locker', 'shop', 'crates'].includes(name) ? name : 'home');
  $$('.nav-link').forEach(b => b.classList.toggle('is-active', b.dataset.nav === activeNav));
  window.scrollTo(0, 0);
  if (name === 'home') renderHome();
  if (name === 'locker') renderLocker();
  if (name === 'shop') renderShop();
  if (name === 'crates') renderCrates();
}
function updateBalances() {
  $$('.js-tubes').forEach(e => e.textContent = fmt(save.tubes));
  $('#tubeBalance').textContent = fmt(save.tubes);
  const r = rankFor(save.rp);
  $('#rankGem').textContent = r.glyph;
  $('#rankGem').style.color = r.color;
  $('#rankName').textContent = r.label;
  $('#rankRp').textContent = `${fmt(save.rp)} RP`;
  $('#rankedCardMeta').textContent = `${r.label} · ${fmt(save.rp)} RP`;
}
function toast(text, error = false) {
  const el = document.createElement('div');
  el.className = 'toast' + (error ? ' is-error' : '');
  el.innerHTML = text;
  $('#toastRoot').appendChild(el);
  setTimeout(() => el.remove(), 3100);
}
function purchaseItem(item, silent = false) {
  if (!item) return false;
  if (owned(item.id)) { toast(`<b>${escapeHtml(item.name)}</b> is already in your locker.`); return false; }
  if (save.tubes < item.price) { toast(`<b>Not enough Tubes.</b> You need ${fmt(item.price - save.tubes)} more.`, true); Sound.miss(); return false; }
  save.tubes -= item.price;
  save.owned.push(item.id);
  persist(); updateBalances();
  Sound.unlock(item.rarity);
  if (!silent) toast(`<b>${escapeHtml(item.name)}</b> added to your locker · −${fmt(item.price)} Tubes`);
  return true;
}
function equipItem(item) {
  if (!item || !owned(item.id)) return;
  const c = charById(save.selectedChar);
  const l = save.loadouts[c.id];
  if (item.type === 'kit') { l.kit = item.id; l.primary = item.palette[0]; l.secondary = item.palette[1]; }
  else if (item.type === 'hat') l.hat = l.hat === item.id ? null : item.id;
  else if (item.type === 'acc') l.acc = l.acc === item.id ? null : item.id;
  else if (item.type === 'ball') save.ball = item.id;
  persist();
  Sound.ui();
  renderLocker(); renderHome();
  toast(`<b>${escapeHtml(item.name)}</b> equipped to ${c.name}.`);
}
function addTubes(n, reason = '') {
  save.tubes += n;
  persist(); updateBalances();
  if (reason) toast(`<b>+${fmt(n)} Tubes</b> · ${reason}`);
}

/* ------------------------------------------------------------------ home UI */
function ballerCardHTML(c) {
  const l = save.loadouts[c.id];
  const kit = itemOf(l.kit);
  return `<button class="baller-card" data-nav="locker" data-char="${c.id}" data-number="${c.number}" style="--card-glow:${c.glow}" aria-label="Customize ${c.name}">
    <span class="baller-top"><span class="role">${c.role} · #${c.number}</span><span class="ovr-badge">${overallFor(c)}</span></span>
    <span class="baller-art">${avatarSVG(c)}</span>
    <span class="switch-tag">${c.id === 'nova' ? 'AUTO SWITCH' : 'BALL CARRIER'}</span>
    <span class="baller-name"><strong>${c.name}</strong><small><i></i>${escapeHtml(kit?.name || 'Home Kit')} · ${c.stats.pace > 8 ? 'PACE' : 'POWER'}</small></span>
  </button>`;
}
function renderHome() {
  updateBalances();
  $('#homeSquad').innerHTML = CHARACTERS.map(ballerCardHTML).join('');
  $('#teamOvr').textContent = teamOverall();
  const dailyReady = Date.now() - (save.lastDaily || 0) > 8 * 3600e3;
  $$('[data-action="daily"]').forEach(b => b.textContent = dailyReady ? 'FREE DAILY' : 'DAILY USED');
}

/* ------------------------------------------------------------------ locker */
function renderLocker() {
  updateBalances();
  const c = charById(save.selectedChar);
  const l = save.loadouts[c.id];
  $('#charSwitch').innerHTML = CHARACTERS.map(ch => `<button class="char-tab ${ch.id === c.id ? 'is-active' : ''}" data-char-select="${ch.id}">${ch.name} · ${overallFor(ch)}</button>`).join('');
  $('#lockerAvatar').innerHTML = avatarSVG(c, { full: true });
  $('#lockerCharName').textContent = c.name;
  $('#lockerCharRole').textContent = `${c.role} · #${c.number} · ${c.height}`;
  $('#lockerOvr').textContent = overallFor(c);
  const stats = [['PACE', c.stats.pace], ['SHOT', c.stats.shot], ['TRICKS', c.stats.trick], ['FLAIR', Math.min(10, 4 + (RARITY[itemOf(l.hat)?.rarity]?.weight || 0) + (RARITY[itemOf(l.acc)?.rarity]?.weight || 0))]];
  $('#lockerStats').innerHTML = stats.map(([n, v]) => `<div class="stat-row"><span>${n}</span><div class="stat-track"><i style="width:${v * 10}%"></i></div><b>${v}</b></div>`).join('');
  $('#equippedMini').innerHTML = [['KIT', itemOf(l.kit)?.name], ['HAT', itemOf(l.hat)?.name || 'None'], ['ACC', itemOf(l.acc)?.name || 'None'], ['BALL', itemOf(save.ball)?.name]]
    .map(([k, v]) => `<div class="equip-chip"><small>${k}</small><b>${escapeHtml(v || '—')}</b></div>`).join('');
  $('.locker-preview-panel').style.setProperty('--preview-glow', c.glow);
  const tab = currentLockerTab;
  $$('.inv-tab').forEach(t => t.classList.toggle('is-active', t.dataset.inv === tab));
  renderLockerGrid(tab);
}
let currentLockerTab = 'kit';
function renderLockerGrid(tab) {
  const c = charById(save.selectedChar);
  const l = save.loadouts[c.id];
  if (tab === 'color') {
    const colors = COLORS;
    $('#invCount').textContent = `${colors.length} COLORS`;
    $('#lockerGrid').innerHTML = `<div style="grid-column:1/-1;border:1px solid var(--line);border-radius:9px;padding:16px;background:rgba(255,255,255,.025);margin-bottom:4px">
      <span class="section-kicker" style="margin-bottom:10px">PRIMARY COLOR · ${c.name}</span>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px">${colors.map(col => `<button data-color="primary" data-hex="${col.hex}" title="${col.name}" style="width:38px;height:38px;border-radius:50%;background:${col.hex};border:3px solid ${l.primary.toLowerCase() === col.hex.toLowerCase() ? 'var(--lime)' : 'rgba(0,0,0,.25)'};box-shadow:0 0 0 2px ${l.primary.toLowerCase() === col.hex.toLowerCase() ? 'rgba(201,255,63,.25)' : 'transparent'}"></button>`).join('')}</div>
      <span class="section-kicker" style="margin-bottom:10px">ACCENT COLOR · ${c.name}</span>
      <div style="display:flex;gap:8px;flex-wrap:wrap">${colors.map(col => `<button data-color="secondary" data-hex="${col.hex}" title="${col.name}" style="width:38px;height:38px;border-radius:50%;background:${col.hex};border:3px solid ${l.secondary.toLowerCase() === col.hex.toLowerCase() ? 'var(--lime)' : 'rgba(0,0,0,.25)'};box-shadow:0 0 0 2px ${l.secondary.toLowerCase() === col.hex.toLowerCase() ? 'rgba(201,255,63,.25)' : 'transparent'}"></button>`).join('')}</div>
    </div>
    <div style="grid-column:1/-1" class="locker-tip"><span>✦</span> Colors are free forever. The kit controls the pattern; the colors are yours.</div>`;
    return;
  }
  const list = ITEMS.filter(i => i.type === tab);
  $('#invCount').textContent = `${list.filter(i => owned(i.id)).length}/${list.length} OWNED`;
  const equippedId = tab === 'ball' ? save.ball : l[tab];
  $('#lockerGrid').innerHTML = list.map(item => {
    const has = owned(item.id);
    const eq = equippedId === item.id;
    return `<button class="item-card ${eq ? 'is-equipped' : ''} ${has ? '' : 'is-locked'}" data-item="${item.id}" data-item-type="${item.type}">
      ${eq ? `<span class="item-state">EQUIPPED</span>` : !has ? `<span class="lock-mark">◆</span>` : ''}
      <span class="item-art" ${artBg(item)}>${itemArt(item)}</span>
      <span class="item-rarity rarity-${item.rarity}">${RARITY[item.rarity].label} ${TYPE_LABEL[item.type]}</span>
      <span class="item-name">${escapeHtml(item.name)}</span>
      <span class="item-sub">${has ? (eq ? 'ON YOUR BALLER' : 'TAP TO EQUIP') : 'LOCKED · ' + fmt(item.price) + ' TUBES'}</span>
      ${has ? '' : `<span class="item-buy">UNLOCK IN SHOP ↗</span>`}
    </button>`;
  }).join('');
}

/* ------------------------------------------------------------------ shop */
let shopFilter = 'all';
function renderShop() {
  updateBalances();
  $('#featureBall').innerHTML = ballSVG('cosmic');
  $$('#shopFilters .filter').forEach(b => b.classList.toggle('is-active', b.dataset.filter === shopFilter));
  let list = ITEMS.filter(i => (shopFilter === 'all' || i.type === shopFilter) && i.price > 0);
  list.sort((a, b) => (owned(a.id) - owned(b.id)) || RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity) || a.price - b.price);
  $('#shopGrid').innerHTML = list.map(item => {
    const has = owned(item.id);
    return `<article class="shop-card ${has ? 'is-owned' : ''}">
      <div class="item-art" ${artBg(item)}>${itemArt(item)}</div>
      <div class="shop-card-body">
        <div class="item-rarity rarity-${item.rarity}">${RARITY[item.rarity].label} · ${TYPE_LABEL[item.type]}</div>
        <div class="item-name">${escapeHtml(item.name)}</div>
        <div class="item-sub">${escapeHtml(item.sub)}</div>
        <div class="shop-card-price">${has ? '<span class="owned-badge">OWNED</span>' : `<span class="price"><span class="mini-tube">T</span>${fmt(item.price)}</span><button class="buy-mini" data-buy="${item.id}">BUY</button>`}</div>
      </div>
    </article>`;
  }).join('') || '<p style="color:var(--muted);font-size:11px">Nothing here yet.</p>';
}

/* ------------------------------------------------------------------ crates */
const CRATE_TYPES = {
  street: { name: 'STREET CRATE', price: 350, pool: ['common', 'uncommon', 'rare', 'epic'], weights: [48, 32, 16, 4] },
  elite: { name: 'ELITE CRATE', price: 750, pool: ['rare', 'epic'], weights: [68, 32] },
  legend: { name: 'LEGEND CRATE', price: 1400, pool: ['epic', 'legendary'], weights: [70, 30] }
};
function renderCrates() {
  updateBalances();
  const dailyReady = Date.now() - (save.lastDaily || 0) > 8 * 3600e3;
  if ($('#dailyState')) $('#dailyState').textContent = dailyReady ? 'DAILY DROP READY · FREE' : 'DAILY DROP CLAIMED · RESETS IN 8H';
  $$('[data-action="daily"]').forEach(b => b.textContent = dailyReady ? 'FREE DAILY' : 'DAILY USED');
}
function cratePool(type) {
  const cfg = CRATE_TYPES[type];
  return { cfg, pool: ITEMS.filter(i => cfg.pool.includes(i.rarity) && !owned(i.id)) };
}
function randomCrateItem(type) {
  const { cfg, pool } = cratePool(type);
  if (!pool.length) return null;
  // weighted first by rarity, then uniform inside rarity; avoids duplicate rarity gaps
  const available = [...new Set(pool.map(i => i.rarity))];
  const weights = available.map(r => cfg.weights[cfg.pool.indexOf(r)] || 1);
  let roll = Math.random() * weights.reduce((a, b) => a + b, 0);
  let chosenRarity = available[0];
  for (let i = 0; i < available.length; i++) { roll -= weights[i]; if (roll <= 0) { chosenRarity = available[i]; break; } }
  const finalPool = pool.filter(i => i.rarity === chosenRarity);
  return pick(finalPool.length ? finalPool : pool);
}
let crateBusy = false;
let lastCrateType = 'street';
function openCrate(type, free = false) {
  if (crateBusy) return;
  const cfg = CRATE_TYPES[type];
  if (!free && save.tubes < cfg.price) { toast(`<b>Not enough Tubes.</b> ${cfg.name} costs ${fmt(cfg.price)}.`, true); Sound.miss(); return; }
  if (!free) save.tubes -= cfg.price;
  if (free) save.lastDaily = Date.now();
  persist(); updateBalances(); renderHome(); renderCrates();
  crateBusy = true;
  lastCrateType = type;
  Sound.crate();
  const overlay = $('#crateOverlay');
  overlay.classList.add('is-active');
  $('#crateOpenKicker').textContent = free ? 'FREE DAILY DROP' : cfg.name;
  $('#crateOpenTitle').textContent = 'UNLOCKING';
  $('#openResult').innerHTML = '';
  const reel = $('#openReel');
  const previews = [];
  for (let i = 0; i < 3; i++) previews.push(randomCrateItem(type) || pick(ITEMS.filter(item => cfg.pool.includes(item.rarity))));
  reel.innerHTML = previews.map((item, i) => `<div class="reel-card ${i === 1 ? 'reel-active' : ''}">${item ? `<div class="item-art" ${artBg(item)}>${itemArt(item)}</div><div class="item-rarity rarity-${item.rarity}">${RARITY[item.rarity].label}</div>` : ''}</div>`).join('');
  let ticks = 0;
  const spin = setInterval(() => {
    ticks++;
    const faux = randomCrateItem(type);
    const card = reel.children[ticks % 3];
    if (card && faux) {
      card.className = 'reel-card' + (ticks % 3 === 1 ? ' reel-active' : '');
      card.innerHTML = `<div class="item-art" ${artBg(faux)}>${itemArt(faux)}</div><div class="item-rarity rarity-${faux.rarity}">${RARITY[faux.rarity].label}</div>`;
    }
    Sound.tone(500 + (ticks % 5) * 80, .03, 'square', .012);
    if (ticks > 11) {
      clearInterval(spin);
      revealCrate(type, free);
    }
  }, 105);
}
function revealCrate(type, free) {
  const item = randomCrateItem(type);
  const reel = $('#openReel');
  const result = $('#openResult');
  if (!item) {
    const refund = free ? 150 : Math.round(CRATE_TYPES[type].price * .55);
    save.tubes += refund;
    persist(); updateBalances();
    reel.innerHTML = '';
    $('#crateOpenTitle').textContent = 'POOL CLEARED';
    result.innerHTML = `<b>+${fmt(refund)} TUBES</b><small>You already own this entire crate. Refund issued.</small>`;
    crateBusy = false;
    return;
  }
  const duplicate = owned(item.id);
  if (!duplicate) save.owned.push(item.id);
  else save.tubes += 120;
  persist(); updateBalances(); renderHome();
  reel.innerHTML = `<div class="reel-card reel-active" style="width:190px;height:225px"><div class="item-art" ${artBg(item)} style="height:130px">${itemArt(item)}</div><div class="item-rarity rarity-${item.rarity}">${RARITY[item.rarity].label} · ${TYPE_LABEL[item.type]}</div><div class="item-name">${escapeHtml(item.name)}</div></div>`;
  $('#crateOpenTitle').textContent = RARITY_ORDER.indexOf(item.rarity) >= 3 ? 'HUGE PULL' : 'NEW GEAR';
  result.innerHTML = `<b>${escapeHtml(item.name)}</b><small>${duplicate ? '+120 TUBES · DUPLICATE CONVERTED' : 'ADDED TO YOUR LOCKER'}</small>`;
  Sound.unlock(item.rarity);
  crateBusy = false;
  renderLocker(); renderShop(); renderCrates();
  if (free) toast(`<b>Free daily:</b> ${escapeHtml(item.name)} unlocked.`);
}
