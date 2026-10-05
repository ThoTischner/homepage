// Kubernetes Invaders – easter egg, loaded on demand via import(). Stores and sends nothing.
// Controls: ← → / A D move · Space shoot · P pause · Esc quit · Touch: tap & drag

const PX = 3;

const SPRITES = {
  squid: [
    ['00011000', '00111100', '01111110', '11011011', '11111111', '00100100', '01011010', '10100101'],
    ['00011000', '00111100', '01111110', '11011011', '11111111', '01011010', '10000001', '01000010'],
  ],
  crab: [
    ['00100000100', '00010001000', '00111111100', '01101110110', '11111111111', '10111111101', '10100000101', '00011011000'],
    ['00100000100', '10010001001', '10111111101', '11101110111', '11111111111', '01111111110', '00100000100', '01000000010'],
  ],
  octo: [
    ['000011110000', '011111111110', '111111111111', '111001100111', '111111111111', '000110011000', '001101101100', '110000000011'],
    ['000011110000', '011111111110', '111111111111', '111001100111', '111111111111', '001110011100', '011001100110', '001100001100'],
  ],
  ship: [['0000001000000', '0000011100000', '0000011100000', '0111111111110', '1111111111111', '1111111111111', '1111111111111', '1111111111111']],
};

const POINTS = { squid: 30, crab: 20, octo: 10 };
const WAVES = ['CrashLoopBackOff', 'OOMKilled', 'ImagePullBackOff', 'Evicted', 'NodeNotReady', 'Pending'];

const TEXT = {
  de: {
    field: 'Spielfeld. Pfeiltasten bewegen, Leertaste schießt, Escape beendet.',
    quit: 'Beenden',
    paused: 'Pausiert',
    resume: 'P zum Fortsetzen',
    restartTouch: 'Tippen: Neustart',
    restart: 'Enter / Tippen: Neustart  ·  Esc: Beenden',
    tagline: 'Verteidige deinen Cluster gegen CrashLoopBackOff & Co.',
    taglineA: 'Verteidige deinen Cluster',
    taglineB: 'gegen CrashLoopBackOff & Co.',
    controls: '←  →  bewegen   ·   Leertaste  schießen   ·   P  Pause   ·   Esc  beenden',
    touch: 'Touch: tippen und ziehen',
    touchControls: 'Tippen & ziehen: bewegen und schießen',
    start: 'Enter / Leertaste / Tippen zum Starten',
    startTouch: 'Tippen zum Starten',
  },
  en: {
    field: 'Game area. Arrow keys move, space shoots, Escape quits.',
    quit: 'Quit',
    paused: 'Paused',
    resume: 'P to resume',
    restartTouch: 'Tap: restart',
    restart: 'Enter / tap: restart  ·  Esc: quit',
    tagline: 'Defend your cluster against CrashLoopBackOff & co.',
    taglineA: 'Defend your cluster',
    taglineB: 'against CrashLoopBackOff & co.',
    controls: '←  →  move   ·   Space  shoot   ·   P  pause   ·   Esc  quit',
    touch: 'Touch: tap and drag',
    touchControls: 'Tap & drag to move and shoot',
    start: 'Enter / Space / tap to start',
    startTouch: 'Tap to start',
  },
};

let running = false;
let hiScore = 0; // in memory only

export function start() {
  if (running) return;
  running = true;

  // Landscape 800×600; portrait (phones) gets a taller field with fewer columns
  const portrait = window.innerWidth < window.innerHeight;
  const W = portrait ? 540 : 800;
  const H = portrait ? 780 : 600;
  const COLS = portrait ? 7 : 10;
  const HUD = portrait ? 17 : 13;
  const L = document.documentElement.lang.startsWith('en') ? TEXT.en : TEXT.de;

  const prevFocus = document.activeElement;
  const css = getComputedStyle(document.documentElement);
  const color = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  const C = {
    bg: color('--bg', '#09090b'),
    fg: color('--text', '#ededed'),
    dim: color('--subtle', '#8b8b8b'),
    dark: matchMedia('(prefers-color-scheme: dark)').matches,
  };
  const font = (size, weight = 500) => `${weight} ${size}px "Geist Variable", system-ui, sans-serif`;
  const serif = (size, style = '') => `${style} 400 ${size}px "Instrument Serif", Georgia, serif`;

  // ---------- DOM ----------
  const overlay = document.createElement('div');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Kubernetes Invaders');
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:1000;display:grid;place-items:center;background:rgba(0,0,0,.72);' +
    'backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);';

  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:12px;';

  const frame = document.createElement('div');
  frame.style.cssText =
    `position:relative;width:min(96vw,calc(86vh * ${W} / ${H}));aspect-ratio:${W}/${H};border-radius:16px;overflow:hidden;` +
    `border:1px solid rgba(127,127,127,.3);box-shadow:0 30px 120px rgba(0,0,0,.55);background:${C.bg};`;

  const canvas = document.createElement('canvas');
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', L.field);
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;outline:none;cursor:crosshair;';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = portrait ? L.quit : `Esc · ${L.quit}`;
  closeBtn.style.cssText =
    `font:${font(13)};color:#ededed;background:rgba(255,255,255,.08);` +
    'border:1px solid rgba(255,255,255,.22);border-radius:999px;padding:8px 14px;cursor:pointer;';

  frame.append(canvas);
  wrap.append(frame, closeBtn);
  overlay.append(wrap);
  document.body.append(overlay);
  const prevOverflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = 'hidden';
  canvas.focus();

  const ctx = canvas.getContext('2d');
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    ctx.imageSmoothingEnabled = false;
  };
  resize();

  // ---------- State ----------
  const keys = {};
  let state = 'intro';
  let score = 0;
  let lives = 3;
  let wave = 0;
  let waveT = 0;
  let t = 0;
  let player = { x: W / 2, y: H - 62, cool: 0, inv: 0 };
  let bullets = [];
  let bombs = [];
  let enemies = [];
  let particles = [];
  let dir = 1;
  let stepT = 0;
  let animFrame = 0;
  let touching = false;
  let touchX = null;
  const stars = Array.from({ length: 80 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    s: Math.random() * 1.6 + 0.4,
    v: Math.random() * 18 + 6,
  }));

  const spriteW = (type) => SPRITES[type][0][0].length * PX;

  function newWave() {
    enemies = [];
    const rows = ['squid', 'crab', 'crab', 'octo', 'octo'];
    rows.forEach((type, r) => {
      for (let c = 0; c < COLS; c++) {
        enemies.push({ x: W / 2 - ((COLS - 1) * 55) / 2 + c * 55, y: (portrait ? 120 : 92) + r * 42, type, alive: true });
      }
    });
    dir = 1;
    stepT = 0;
    bullets = [];
    bombs = [];
    waveT = 2.2;
    state = 'wave';
  }

  function reset() {
    score = 0;
    lives = 3;
    wave = 0;
    particles = [];
    player = { x: W / 2, y: H - 62, cool: 0.3, inv: 0 };
    newWave();
  }

  function burst(x, y, n = 14) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = Math.random() * 160 + 40;
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: Math.random() * 0.4 + 0.25 });
    }
  }

  // ---------- Update ----------
  function update(dt) {
    t += dt;
    for (const s of stars) {
      s.y += s.v * dt;
      if (s.y > H) {
        s.y = 0;
        s.x = Math.random() * W;
      }
    }
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.life -= dt;
    }
    particles = particles.filter((p) => p.life > 0);

    if (state === 'wave') {
      waveT -= dt;
      if (waveT <= 0) state = 'play';
      return;
    }
    if (state !== 'play') return;

    // Player
    const left = keys.arrowleft || keys.a;
    const right = keys.arrowright || keys.d;
    let vx = (right ? 1 : 0) - (left ? 1 : 0);
    if (touchX !== null) vx = Math.abs(touchX - player.x) < 6 ? 0 : Math.sign(touchX - player.x);
    player.x = Math.max(28, Math.min(W - 28, player.x + vx * 340 * dt));
    player.cool -= dt;
    player.inv -= dt;
    if ((keys[' '] || touching) && player.cool <= 0 && bullets.length < 2) {
      bullets.push({ x: player.x, y: player.y - 4 });
      player.cool = 0.3;
    }
    bullets.forEach((b) => (b.y -= 560 * dt));
    bullets = bullets.filter((b) => b.y > 30);

    // Formation
    const alive = enemies.filter((e) => e.alive);
    const interval = Math.max(0.045, 0.55 * (alive.length / enemies.length)) / (1 + wave * 0.18);
    stepT += dt;
    if (stepT >= interval) {
      stepT = 0;
      animFrame ^= 1;
      const minX = Math.min(...alive.map((e) => e.x - spriteW(e.type) / 2));
      const maxX = Math.max(...alive.map((e) => e.x + spriteW(e.type) / 2));
      if ((dir > 0 && maxX + 10 > W - 20) || (dir < 0 && minX - 10 < 20)) {
        alive.forEach((e) => (e.y += 18));
        dir *= -1;
      } else {
        alive.forEach((e) => (e.x += dir * 10));
      }
    }

    // Enemy fire
    const fireRate = 0.9 + wave * 0.35;
    if (Math.random() < fireRate * dt && alive.length) {
      const shooter = alive[Math.floor(Math.random() * alive.length)];
      const lowest = alive
        .filter((e) => Math.abs(e.x - shooter.x) < 4)
        .reduce((a, b) => (b.y > a.y ? b : a), shooter);
      bombs.push({ x: lowest.x, y: lowest.y + 26 });
    }
    bombs.forEach((b) => (b.y += (190 + wave * 22) * dt));
    bombs = bombs.filter((b) => b.y < H - 26);

    // Hits: bullets vs. enemies
    for (const b of bullets) {
      for (const e of alive) {
        if (!e.alive) continue;
        const hw = spriteW(e.type) / 2;
        if (b.x > e.x - hw && b.x < e.x + hw && b.y > e.y && b.y < e.y + 8 * PX) {
          e.alive = false;
          b.y = -100;
          score += POINTS[e.type];
          burst(e.x, e.y + 12);
          break;
        }
      }
    }

    // Hits: bombs vs. player
    if (player.inv <= 0) {
      for (const b of bombs) {
        if (Math.abs(b.x - player.x) < 20 && b.y > player.y - 6 && b.y < player.y + 24) {
          lives -= 1;
          player.inv = 1.6;
          bombs = [];
          burst(player.x, player.y + 10, 26);
          if (lives <= 0) gameOver();
          break;
        }
      }
    }

    // Formation reached the ground
    if (alive.some((e) => e.alive && e.y + 24 > player.y - 10)) gameOver();

    // Wave cleared
    if (!enemies.some((e) => e.alive)) {
      score += 100 * (wave + 1);
      wave += 1;
      newWave();
    }
  }

  function gameOver() {
    state = 'over';
    hiScore = Math.max(hiScore, score);
  }

  // ---------- Render ----------
  const pad = (n) => String(n).padStart(5, '0');

  function sheen(y0, y1) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    if (C.dark) {
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.55, '#d4d4d4');
      g.addColorStop(1, '#8f8f8f');
    } else {
      g.addColorStop(0, '#0a0a0a');
      g.addColorStop(0.55, '#2e2e2e');
      g.addColorStop(1, '#7a7a7a');
    }
    return g;
  }

  function sprite(rows, x, y, fill) {
    ctx.fillStyle = fill;
    const w = rows[0].length;
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < w; c++) {
        if (rows[r][c] === '1') ctx.fillRect(Math.round(x - (w * PX) / 2 + c * PX), Math.round(y + r * PX), PX, PX);
      }
    }
  }

  function centerText(text, y, fontStr, fill) {
    ctx.font = fontStr;
    ctx.fillStyle = fill;
    ctx.textAlign = 'center';
    ctx.fillText(text, W / 2, y);
  }

  function draw() {
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    // Stars
    ctx.fillStyle = C.dim;
    for (const s of stars) {
      ctx.globalAlpha = 0.25 + s.s / 4;
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }
    ctx.globalAlpha = 1;

    // HUD
    ctx.font = font(HUD);
    ctx.textAlign = 'left';
    ctx.fillStyle = C.dim;
    ctx.fillText('SCORE', 24, 32);
    ctx.fillStyle = C.fg;
    ctx.fillText(pad(score), 24 + ctx.measureText('SCORE ').width, 32);
    ctx.textAlign = 'center';
    ctx.fillStyle = C.dim;
    ctx.fillText(`HI ${pad(hiScore)}`, W / 2, 32);
    ctx.textAlign = 'right';
    ctx.fillText('NODES', W - 24 - lives * 26, 32);
    for (let i = 0; i < lives; i++) {
      const sx = W - 34 - i * 26;
      ctx.save();
      ctx.translate(sx, 22);
      ctx.scale(0.5, 0.5);
      ctx.translate(-sx, -22);
      sprite(SPRITES.ship[0], sx, 22, C.fg);
      ctx.restore();
    }

    // Ground
    ctx.fillStyle = C.dim;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(20, H - 24, W - 40, 1);
    ctx.globalAlpha = 1;

    if (state === 'intro') {
      drawIntro();
      return;
    }

    // Enemies
    const fill = sheen(80, 320);
    for (const e of enemies) if (e.alive) sprite(SPRITES[e.type][animFrame], e.x, e.y, fill);

    // Player
    if (state !== 'over' && (player.inv <= 0 || Math.floor(t * 12) % 2 === 0)) {
      sprite(SPRITES.ship[0], player.x, player.y, C.fg);
    }

    // Projectiles
    ctx.fillStyle = C.fg;
    for (const b of bullets) ctx.fillRect(b.x - 1.5, b.y, 3, 12);
    ctx.fillStyle = C.dim;
    for (const b of bombs) {
      const off = Math.floor(b.y / 6) % 2 ? 2 : -2;
      ctx.fillRect(b.x - 1.5 + off, b.y, 3, 5);
      ctx.fillRect(b.x - 1.5 - off, b.y + 5, 3, 5);
    }

    // Particles
    ctx.fillStyle = C.fg;
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2.5));
      ctx.fillRect(p.x, p.y, 2.5, 2.5);
    }
    ctx.globalAlpha = 1;

    if (state === 'wave') {
      centerText(`Wave ${wave + 1}`, H / 2 + 40, serif(46), sheen(H / 2, H / 2 + 50));
      centerText(`kubectl get pods  →  ${WAVES[wave % WAVES.length]}`, H / 2 + 76, font(portrait ? 18 : 14), C.dim);
    }
    if (state === 'paused') {
      centerText(L.paused, H / 2 + 20, serif(52), sheen(H / 2 - 30, H / 2 + 30));
      centerText(L.resume, H / 2 + 52, font(14), C.dim);
    }
    if (state === 'over') {
      ctx.fillStyle = C.bg;
      ctx.globalAlpha = 0.72;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      centerText('Cluster down.', H / 2 - 10, serif(64, 'italic'), sheen(H / 2 - 70, H / 2));
      centerText(`Score ${score}  ·  Wave ${wave + 1}`, H / 2 + 34, font(portrait ? 20 : 16), C.fg);
      if (Math.floor(t * 2) % 2 === 0) {
        centerText(portrait ? L.restartTouch : L.restart, H / 2 + 76, font(portrait ? 18 : 14), C.dim);
      }
    }
  }

  function drawIntro() {
    const demo = ['squid', 'crab', 'octo'];
    demo.forEach((type, i) => {
      sprite(SPRITES[type][Math.floor(t * 2) % 2], W / 2 - 110 + i * 110, 120, sheen(110, 150));
    });
    if (portrait) {
      centerText('Kubernetes', 260, serif(66), sheen(210, 270));
      centerText('Invaders', 322, serif(66), sheen(272, 332));
      centerText(L.taglineA, 376, font(20), C.dim);
      centerText(L.taglineB, 404, font(20), C.dim);
      centerText(L.touchControls, 470, font(17), C.dim);
      if (Math.floor(t * 2) % 2 === 0) centerText(L.startTouch, 560, font(22, 600), C.fg);
    } else {
      centerText('Kubernetes Invaders', 250, serif(72), sheen(190, 260));
      centerText(L.tagline, 292, font(16), C.dim);
      centerText(L.controls, 360, font(13), C.dim);
      centerText(L.touch, 384, font(13), C.dim);
      if (Math.floor(t * 2) % 2 === 0) centerText(L.start, 452, font(16, 600), C.fg);
    }
    sprite(SPRITES.ship[0], W / 2, H - 62, C.fg);
  }

  // ---------- Input ----------
  const GAME_KEYS = ['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' ', 'a', 'd', 'p', 'enter'];

  function onKeyDown(e) {
    const k = e.key === ' ' ? ' ' : e.key.toLowerCase();
    if (k === 'escape') {
      e.preventDefault();
      end();
      return;
    }
    if (k === 'tab') {
      e.preventDefault();
      (document.activeElement === closeBtn ? canvas : closeBtn).focus();
      return;
    }
    if (document.activeElement === closeBtn && (k === 'enter' || k === ' ')) return;
    if (GAME_KEYS.includes(k)) e.preventDefault();
    keys[k] = true;
    if ((state === 'intro' || state === 'over') && (k === 'enter' || k === ' ')) reset();
    else if (k === 'p' && (state === 'play' || state === 'paused')) state = state === 'play' ? 'paused' : 'play';
  }

  function onKeyUp(e) {
    const k = e.key === ' ' ? ' ' : e.key.toLowerCase();
    keys[k] = false;
  }

  const toLogical = (e) => {
    const r = canvas.getBoundingClientRect();
    return ((e.clientX - r.left) / r.width) * W;
  };

  function onPointerDown(e) {
    canvas.setPointerCapture?.(e.pointerId);
    if (state === 'intro' || state === 'over') {
      reset();
      return;
    }
    if (e.pointerType === 'mouse') return;
    touching = true;
    touchX = toLogical(e);
  }

  function onPointerMove(e) {
    if (touching) touchX = toLogical(e);
  }

  function onPointerUp() {
    touching = false;
    touchX = null;
  }

  function onVisibility() {
    if (document.hidden && state === 'play') state = 'paused';
  }

  function onOverlayClick(e) {
    if (e.target === overlay) end();
  }

  addEventListener('keydown', onKeyDown, true);
  addEventListener('keyup', onKeyUp, true);
  addEventListener('resize', resize);
  document.addEventListener('visibilitychange', onVisibility);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  overlay.addEventListener('click', onOverlayClick);
  closeBtn.addEventListener('click', end);

  // ---------- Loop ----------
  let raf = 0;
  let last = performance.now();
  function loop(now) {
    // rAF may report a timestamp before `last`; never go negative
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    update(dt);
    draw();
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);

  function end() {
    cancelAnimationFrame(raf);
    removeEventListener('keydown', onKeyDown, true);
    removeEventListener('keyup', onKeyUp, true);
    removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', onVisibility);
    overlay.remove();
    document.documentElement.style.overflow = prevOverflow;
    running = false;
    if (prevFocus && prevFocus.focus) prevFocus.focus();
  }
}
