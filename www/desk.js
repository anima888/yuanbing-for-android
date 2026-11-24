/* ============================================================
 * desk.js —— 单球桌搭
 *
 * 一颗表情球在屏幕里自己慢慢走、每隔 25~45 秒换一张脸和一种颜色。
 *  - 轻点：眨一只眼
 *  - 双击：立刻换色 + 爱心眼
 *  - 按住：把球拿起来（像地球仪一样可以转），拖动；松手甩出去会撞墙反弹
 *  - 球撞到边缘：duang~ 一声 + 挤压回弹 + 涟漪
 *
 * 颜色只在「换脸」的淡出淡入之间切换，或者双击时瞬间切换，
 * 不会在表情停留时慢慢渐变。
 * ============================================================ */
(function () {
  'use strict';

  var EB = window.EmotionBall;
  if (!EB || !EB.config) {
    showFatal('表情引擎没有加载成功。');
    return;
  }

  /* ---------------- 配置 ---------------- */

  var DEFAULT_PALETTE = [
    { name: '琥珀金', hex: '#FFAE2E', rgb: '255,174,46'  },
    { name: '冰蓝',   hex: '#86D9FF', rgb: '134,217,255' },
    { name: '电光青', hex: '#1FF0FF', rgb: '31,240,255'  },
    { name: '翡翠绿', hex: '#2BF5A6', rgb: '43,245,166'  }
  ];

  var PALETTE = DEFAULT_PALETTE.slice();

  var CFG = {
    ballScale: 0.60,
    faceMin: 25000,
    faceMax: 45000,
    speed: 1,
    glow: 1,
    palette: ['#FFAE2E', '#86D9FF', '#1FF0FF', '#2BF5A6'],
    bg: { type: 'color', color: '#000000', image: '', dim: 0.25, blur: 0 },
    styles: null,
    customEyes: { image: '', scale: 1, mirror: true, gap: 1 },
    customAcc: { image: '', x: 50, y: 20, scale: 30, rotate: 0 },
    sound: true,
    soundVolume: 0.55,
    sounds: { poke: '', pop: '', wall: '', yawn: '', dizzy: '', giggle: '' },
    night: { enabled: true, start: 23, end: 7, brightness: 0.14 },
    battery: { enabled: true },
    idleSleep: { enabled: true, afterMin: 3 },
    bubbles: { enabled: false, minMin: 10, maxMin: 30 },
    sensor: { enabled: true },
    balls: 1,
    accessories: [],
    name: '',
    widget: { enabled: false, time: true, date: true, battery: true },
    burnIn: { enabled: true, intervalSec: 120, shift: 8 }
  };

  var ACC_KEYS = ['blush', 'ahoge', 'nightcap', 'scarf', 'beret', 'flower',
    'headphones', 'glasses', 'crown', 'catEars', 'halo', 'bow'];

  var HOLD_MS = 200;
  var TAP_MS = 320;
  var DOUBLE_MS = 340;
  var WINK_MS = 780;
  var REST = 0.78;
  var EDGE_PAD = 8;

  var clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  var rand = function (a, b) { return a + Math.random() * (b - a); };
  var easeInOutCubic = function (t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };

  function num(v, def, a, b) {
    var n = parseFloat(v);
    if (!isFinite(n)) return def;
    return clamp(n, a, b);
  }

  function bool(v, def) {
    return typeof v === 'boolean' ? v : def;
  }

  function text(v, def, max) {
    if (typeof v !== 'string') return def;
    v = v.replace(/[<>]/g, '').trim();
    return v.slice(0, max || 24);
  }

  function hexToRgb(hex) {
    var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
    if (!m) return null;
    return parseInt(m[1], 16) + ',' + parseInt(m[2], 16) + ',' + parseInt(m[3], 16);
  }

  function normalizeHex(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    return m ? '#' + m[1].toUpperCase() : null;
  }

  function rebuildPalette() {
    var src = (CFG.palette && CFG.palette.length) ? CFG.palette : DEFAULT_PALETTE;
    var out = [];
    for (var j = 0; j < src.length && out.length < 8; j++) {
      var h = typeof src[j] === 'string' ? normalizeHex(src[j]) : null;
      if (h) out.push({ name: h, hex: h, rgb: hexToRgb(h) });
    }
    PALETTE = out.length ? out : DEFAULT_PALETTE.slice();
  }

  function mergeConfig(raw) {
    if (!raw || typeof raw !== 'object') return;
    CFG.ballScale = num(raw.ballScale, CFG.ballScale, 0.28, 0.80);
    CFG.faceMin = num(raw.faceMin, CFG.faceMin, 5000, 300000);
    CFG.faceMax = num(raw.faceMax, CFG.faceMax, CFG.faceMin, 600000);
    if (CFG.faceMax < CFG.faceMin) {
      var t = CFG.faceMin; CFG.faceMin = CFG.faceMax; CFG.faceMax = t;
    }
    CFG.speed = num(raw.speed, CFG.speed, 0, 99);
    CFG.glow = num(raw.glow, CFG.glow, 0, 3);

    if (Object.prototype.toString.call(raw.palette) === '[object Array]') {
      var p = [];
      for (var i = 0; i < raw.palette.length && p.length < 8; i++) {
        var h = normalizeHex(raw.palette[i]);
        if (h) p.push(h);
      }
      if (p.length) CFG.palette = p;
    }

    if (raw.bg && typeof raw.bg === 'object') {
      CFG.bg.type = raw.bg.type === 'image' ? 'image' : 'color';
      if (raw.bg.color) CFG.bg.color = normalizeHex(raw.bg.color) || '#000000';
      if (typeof raw.bg.image === 'string') CFG.bg.image = raw.bg.image;
      CFG.bg.dim = num(raw.bg.dim, CFG.bg.dim, 0, 0.95);
      CFG.bg.blur = num(raw.bg.blur, CFG.bg.blur, 0, 24);
    }

    if (Object.prototype.toString.call(raw.styles) === '[object Array]') {
      var list = [];
      for (var k = 0; k < raw.styles.length; k++) {
        if (typeof raw.styles[k] === 'string') list.push(raw.styles[k]);
      }
      CFG.styles = list.length ? list : null;
    }

    if (raw.customEyes && typeof raw.customEyes === 'object') {
      if (typeof raw.customEyes.image === 'string') {
        CFG.customEyes.image = raw.customEyes.image;
      }
      CFG.customEyes.scale = num(raw.customEyes.scale, CFG.customEyes.scale, 0.3, 3);
      CFG.customEyes.gap = num(raw.customEyes.gap, CFG.customEyes.gap, 0.4, 2);
      CFG.customEyes.mirror = raw.customEyes.mirror !== false;
    }

    if (raw.customAcc && typeof raw.customAcc === 'object') {
      if (typeof raw.customAcc.image === 'string'
          && (raw.customAcc.image === '' || raw.customAcc.image.indexOf('/media/') === 0)) {
        CFG.customAcc.image = raw.customAcc.image;
      }
      CFG.customAcc.x = num(raw.customAcc.x, CFG.customAcc.x, 0, 100);
      CFG.customAcc.y = num(raw.customAcc.y, CFG.customAcc.y, 0, 100);
      CFG.customAcc.scale = num(raw.customAcc.scale, CFG.customAcc.scale, 5, 100);
      CFG.customAcc.rotate = num(raw.customAcc.rotate, CFG.customAcc.rotate, -180, 180);
    }

    CFG.sound = bool(raw.sound, CFG.sound);
    CFG.soundVolume = num(raw.soundVolume, CFG.soundVolume, 0, 1);
    if (raw.sounds && typeof raw.sounds === 'object') {
      var sk = ['poke', 'pop', 'wall', 'yawn', 'dizzy', 'giggle'];
      for (var si = 0; si < sk.length; si++) {
        var sv = raw.sounds[sk[si]];
        if (typeof sv === 'string' && (sv === '' || sv.indexOf('/media/') === 0)) {
          CFG.sounds[sk[si]] = sv;
        }
      }
    }
    CFG.name = text(raw.name, CFG.name, 18);

    if (raw.night && typeof raw.night === 'object') {
      CFG.night.enabled = bool(raw.night.enabled, CFG.night.enabled);
      CFG.night.start = Math.round(num(raw.night.start, CFG.night.start, 0, 23));
      CFG.night.end = Math.round(num(raw.night.end, CFG.night.end, 0, 23));
      CFG.night.brightness = num(raw.night.brightness, CFG.night.brightness, 0.05, 1);
    }
    if (raw.battery && typeof raw.battery === 'object') {
      CFG.battery.enabled = bool(raw.battery.enabled, CFG.battery.enabled);
    }
    if (raw.idleSleep && typeof raw.idleSleep === 'object') {
      CFG.idleSleep.enabled = bool(raw.idleSleep.enabled, CFG.idleSleep.enabled);
      CFG.idleSleep.afterMin = num(raw.idleSleep.afterMin, CFG.idleSleep.afterMin, 1, 1440);
    }
    if (raw.bubbles && typeof raw.bubbles === 'object') {
      CFG.bubbles.enabled = bool(raw.bubbles.enabled, CFG.bubbles.enabled);
      CFG.bubbles.minMin = num(raw.bubbles.minMin, CFG.bubbles.minMin, 3, 120);
      CFG.bubbles.maxMin = num(raw.bubbles.maxMin, CFG.bubbles.maxMin, CFG.bubbles.minMin, 240);
    }
    if (raw.sensor && typeof raw.sensor === 'object') {
      CFG.sensor.enabled = bool(raw.sensor.enabled, CFG.sensor.enabled);
    }

    CFG.balls = Math.round(num(raw.balls, CFG.balls, 1, 20));

    if (Object.prototype.toString.call(raw.accessories) === '[object Array]') {
      var acc = [];
      for (var q = 0; q < raw.accessories.length; q++) {
        var a = raw.accessories[q];
        if (ACC_KEYS.indexOf(a) >= 0) {
          if (acc.indexOf(a) < 0) acc.push(a);
        }
      }
      CFG.accessories = acc;
    }

    if (raw.burnIn && typeof raw.burnIn === 'object') {
      CFG.burnIn.enabled = bool(raw.burnIn.enabled, CFG.burnIn.enabled);
      CFG.burnIn.intervalSec = num(raw.burnIn.intervalSec, CFG.burnIn.intervalSec, 30, 600);
      CFG.burnIn.shift = num(raw.burnIn.shift, CFG.burnIn.shift, 2, 12);
    }

    if (raw.widget && typeof raw.widget === 'object') {
      CFG.widget.enabled = bool(raw.widget.enabled, CFG.widget.enabled);
      CFG.widget.time = bool(raw.widget.time, CFG.widget.time);
      CFG.widget.date = bool(raw.widget.date, CFG.widget.date);
      CFG.widget.battery = bool(raw.widget.battery, CFG.widget.battery);
    }
  }

  function mediaUrl(path) {
    if (!path) return '';
    if (/^https?:/i.test(path)) return path;
    try {
      if (window.Native && Native.serverUrl) {
        var base = Native.serverUrl();
        if (base) return base + path;
      }
    } catch (e) { /* 忽略 */ }
    return path;
  }

  /* ---------------- 注册眼型 ---------------- */

  var STYLES = [];
  var custom = window.EB_EXTRA || { styles: [], existing: [0] };

  /* 眨眼：把一只眼的 openness 压到 0.035，停 480ms 再睁开 */
  function registerWink(id, side) {
    var other = side === 'left' ? 'right' : 'left';
    var closed = {};
    closed[side] = { open: 0.035 };
    closed[other] = { open: 1 };
    var r = EB.config.register({
      id: id,
      name: side === 'left' ? '眨左眼' : '眨右眼',
      group: 'custom',
      desc: '被戳时眨一只眼',
      transition: 110,
      gaze: true,
      pool: [0],
      poolMs: [1000000, 1000000],
      blinkMs: null,
      sequence: {
        settle: 'base',
        frames: [
          { at: 0, eyes: { both: { open: 1 } } },
          { at: 80, eyes: closed },
          { at: 560, eyes: closed },
          { at: 700, eyes: { both: { open: 1 } } }
        ]
      }
    });
    if (!r.ok) console.warn('[desk] wink register failed', id, r.errors);
  }

  registerWink('winkL', 'left');
  registerWink('winkR', 'right');

  function registerStyle(id, name, expr, blink, openness) {
    var raw = {
      id: id,
      name: name,
      group: 'custom',
      desc: '桌搭常驻眼型',
      transition: 300,
      gaze: true,
      pool: [expr],
      poolMs: [1000000, 1000000],
      openness: openness == null ? 1 : openness,
      body: { breathe: 0.012 }
    };
    if (blink === null) raw.blinkMs = null;
    else raw.blinkMs = blink || [4500, 9000];

    var r = EB.config.register(raw);
    if (!r.ok) {
      console.warn('[desk] style register failed', id, r.errors);
      return;
    }
    STYLES.push({ id: id, name: name, expr: expr });
  }

  var i;
  for (i = 0; i < custom.styles.length; i++) {
    var cs = custom.styles[i];
    registerStyle('e_' + cs.key, cs.name, cs.expr, cs.blink, cs.openness);
  }
  var existing = custom.existing || [];
  for (i = 0; i < existing.length; i++) {
    registerStyle('e_x' + existing[i], '原版眼型 ' + existing[i], existing[i], [4500, 9000], 1);
  }

  if (!STYLES.length) {
    showFatal('没有可用的眼型。');
    return;
  }

  /* ---------------- DOM ---------------- */

  var stage = document.getElementById('stage');
  var ballEl = document.getElementById('ball');
  var host = document.getElementById('host');
  var squashEl = document.getElementById('squash');
  var boopEl = document.getElementById('boop');
  var glowEl = document.getElementById('glow');
  var fxLayer = document.getElementById('fx');
  var dustCanvas = document.getElementById('dust');
  var bgEl = document.getElementById('bg');
  var nightShade = document.getElementById('nightShade');
  var bubbleEl = document.getElementById('bubble');
  var accEl = document.getElementById('acc');
  var widgetEl = document.getElementById('widget');
  var widgetTimeEl = document.getElementById('widgetTime');
  var widgetDateEl = document.getElementById('widgetDate');
  var widgetBatteryEl = document.getElementById('widgetBattery');

  if (!stage || !ballEl || !host || !squashEl || !boopEl || !fxLayer) {
    showFatal('页面结构不完整。');
    return;
  }

  /* ---------------- 状态 ---------------- */

  var W = 0, H = 0, size = 320, bodyR = 123;
  var minX = 0, maxX = 0, minY = 0, maxY = 0;

  var x = 0, y = 0, vx = 0, vy = 0;
  var yaw = 0, yawVel = 0;
  var yawSpring = { x: 0, v: 0, t: 0 };

  var mode = 'idle';           /* idle | held | fly */
  var move = { active: false, fromX: 0, fromY: 0, tx: 0, ty: 0, start: 0, dur: 0 };
  var pauseUntil = 0;
  var squashX = 1, squashY = 1, lift = 1, liftTarget = 1;

  var engine = null;
  var styleIdx = 0, colorIdx = 0, baseStyleId = '';
  var nextFaceAt = 0, busyFace = false;
  var winkTimer = 0, winkUntil = 0, reactionTimer = 0;
  var nextGazeAt = 0;

  var down = false, held = false, moved = false;
  var pointerId = null;
  var startX = 0, startY = 0, downAt = 0;
  var lastX = 0, lastY = 0, lastT = 0, lastMoveT = 0;
  var velX = 0, velY = 0;
  var pressTimer = 0;
  var lastTapAt = 0;
  var tapTimes = [];
  var pinch = null, pinched = false;

  var audio = null;
  var lastBounceAt = 0;
  var lastFrame = 0;
  var ceEl = null, ceBlinkTimer = 0;

  /* 性格 / 作息 / 体感 */
  var mood = 'idle';
  var moodUntil = 0;
  var moodTimer = 0;
  var pokeAt = 0, pokeCount = 0;
  var lastTouchAt = performance.now();
  var holdAt = 0;
  var nextYawnAt = performance.now() + rand(180000, 480000);
  var nextBubbleAt = performance.now() + rand(600000, 1800000);
  var lastBubbleAt = 0;
  var nightNow = false;
  var lastEnvCheck = 0;
  var batteryState = { level: -1, charging: false, key: '', checked: 0 };
  var sensorState = { ax: 0, ay: 0, az: 9.8, lastShake: 0, lastFlip: 0, flipSince: 0 };
  var lastSensorPoll = 0;
  var companions = [];
  var lastMiniFrame = 0;

  /* ---------------- 屏幕尺寸 / 刘海 ---------------- */

  var cut = { l: 0, t: 0, r: 0, b: 0 };

  function readCutout() {
    cut = { l: 0, t: 0, r: 0, b: 0 };
    try {
      if (window.Native && Native.cutout) {
        var s = String(Native.cutout()).split(',');
        if (s.length >= 5) {
          var d = parseFloat(s[4]) || 1;
          cut.l = (parseFloat(s[0]) || 0) / d;
          cut.t = (parseFloat(s[1]) || 0) / d;
          cut.r = (parseFloat(s[2]) || 0) / d;
          cut.b = (parseFloat(s[3]) || 0) / d;
        }
      }
    } catch (e) { /* 忽略，按无刘海处理 */ }
  }

  function layout() {
    W = window.innerWidth;
    H = window.innerHeight;
    readCutout();

    size = Math.min(W, H) * CFG.ballScale;
    size = Math.min(size, W * 0.66, H * 0.92);
    size = Math.max(110, size);
    bodyR = size * 0.48;

    minX = bodyR + Math.max(EDGE_PAD, cut.l + EDGE_PAD);
    maxX = W - bodyR - Math.max(EDGE_PAD, cut.r + EDGE_PAD);
    minY = bodyR + Math.max(EDGE_PAD, cut.t + EDGE_PAD);
    maxY = H - bodyR - Math.max(EDGE_PAD, cut.b + EDGE_PAD);
    if (maxX < minX) { minX = maxX = W / 2; }
    if (maxY < minY) { minY = maxY = H / 2; }

    ballEl.style.width = Math.round(size) + 'px';
    ballEl.style.height = Math.round(size) + 'px';

    if (!x && !y) { x = W / 2; y = H * 0.56; }
    x = clamp(x, minX, maxX);
    y = clamp(y, minY, maxY);

    /* 屏幕尺寸变了：取消基于旧坐标的待机路线，避免球被旧插值拖出屏幕 */
    if (mode !== 'held') {
      if (mode === 'fly') { vx = 0; vy = 0; }
      mode = 'idle';
      move.active = false;
      move.fromX = x;
      move.fromY = y;
      pauseUntil = 0;
    }

    layoutCustomEyes();
    render();
  }

  /* ---------------- 配置应用 / 背景 / 自定义眼睛 ---------------- */

  function styleAllowed(id) {
    if (!CFG.styles || !CFG.styles.length) return true;
    return CFG.styles.indexOf(id) >= 0;
  }

  function updateGlow() {
    if (glowEl) glowEl.style.opacity = String(clamp(0.92 * CFG.glow, 0, 1));
  }

  function applyBackground() {
    if (!bgEl) return;
    var b = CFG.bg || {};
    var image = b.type === 'image' ? b.image : '';
    if (image) {
      bgEl.style.backgroundImage = 'url("' + mediaUrl(image) + '")';
      bgEl.style.backgroundColor = b.color || '#000000';
      bgEl.style.filter = 'blur(' + (b.blur || 0) + 'px)';
      bgEl.style.transform = (b.blur || 0) > 0 ? 'scale(1.06)' : 'none';
      bgEl.style.opacity = String(clamp(1 - (b.dim || 0), 0.05, 1));
    } else {
      bgEl.style.backgroundImage = 'none';
      bgEl.style.backgroundColor = b.color || '#000000';
      bgEl.style.filter = 'none';
      bgEl.style.transform = 'none';
      bgEl.style.opacity = '1';
    }
  }

  function removeCustomEyes() {
    clearTimeout(ceBlinkTimer);
    ceBlinkTimer = 0;
    if (ceEl && ceEl.parentNode) ceEl.parentNode.removeChild(ceEl);
    ceEl = null;
  }

  function layoutCustomEyes() {
    if (!ceEl || !size) return;
    var ce = CFG.customEyes || {};
    var scale = ce.scale || 1;
    var gap = size * 0.1467 * (ce.gap || 1);
    var eyeW = size * 0.20 * scale;
    var cy = size * (0.5 - 0.0743);
    var imgs = ceEl.getElementsByTagName('img');
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      img.style.width = eyeW + 'px';
      img.style.left = (size / 2 + (i === 0 ? -gap : gap)) + 'px';
      img.style.top = cy + 'px';
    }
  }

  function scheduleCeBlink() {
    clearTimeout(ceBlinkTimer);
    if (!ceEl) return;
    ceBlinkTimer = setTimeout(function () {
      if (ceEl && performance.now() > winkUntil) {
        ceEl.classList.add('ce-blink');
        setTimeout(function () {
          if (ceEl) ceEl.classList.remove('ce-blink');
        }, 120);
      }
      scheduleCeBlink();
    }, rand(4200, 9000));
  }

  function buildCustomEyes() {
    removeCustomEyes();
    if (!engine || !CFG.customEyes.image) return;
    ceEl = document.createElement('div');
    ceEl.id = 'customEyes';
    var url = mediaUrl(CFG.customEyes.image);
    for (var i = 0; i < 2; i++) {
      var img = document.createElement('img');
      img.alt = '';
      img.src = url;
      img.className = i === 0 ? 'ce left' : 'ce right';
      if (i === 1 && CFG.customEyes.mirror !== false) {
        img.style.setProperty('--mx', '-1');
      } else {
        img.style.setProperty('--mx', '1');
      }
      ceEl.appendChild(img);
    }
    host.appendChild(ceEl);
    layoutCustomEyes();
    scheduleCeBlink();
  }

  function applyCustomEyes() {
    if (!engine) return;
    if (CFG.customEyes.image) {
      engine._theme.eyes = 'rgba(0,0,0,0)';
      buildCustomEyes();
    } else {
      engine._theme.eyes = '#0A0A0A';
      removeCustomEyes();
    }
  }

  function winkCustomEyes(id) {
    if (!ceEl) return;
    var cls = id === 'winkL' ? 'wink-left' : 'wink-right';
    ceEl.classList.add(cls);
    setTimeout(function () {
      if (ceEl) ceEl.classList.remove(cls);
    }, WINK_MS - 40);
  }

  function applyCurrentColor() {
    if (!PALETTE.length) return;
    colorIdx = Math.min(colorIdx, PALETTE.length - 1);
    ballEl.style.setProperty('--rgb', PALETTE[colorIdx].rgb);
    if (engine && engine._theme) engine._theme.body = PALETTE[colorIdx].hex;
  }

  var burnTimer = null;
  var burnLastX = 0;
  var burnLastY = 0;

  function scheduleBurnIn() {
    if (burnTimer) {
      clearTimeout(burnTimer);
      burnTimer = null;
    }
    if (!CFG.burnIn.enabled) return;
    var wait = CFG.burnIn.intervalSec * 1000;
    wait = Math.round(wait * (0.85 + Math.random() * 0.3));
    burnTimer = setTimeout(function () {
      var amp = Math.max(2, Math.round(CFG.burnIn.shift));
      var dx = Math.round((Math.random() * 2 - 1) * amp);
      var dy = Math.round((Math.random() * 2 - 1) * amp);
      if (dx === burnLastX && dy === burnLastY) dx = -dx || amp;
      burnLastX = dx;
      burnLastY = dy;
      document.documentElement.style.setProperty('--shift-x', dx + 'px');
      document.documentElement.style.setProperty('--shift-y', dy + 'px');
      scheduleBurnIn();
    }, wait);
  }

  function applyBurnIn(force) {
    if (!CFG.burnIn.enabled) {
      if (burnTimer) { clearTimeout(burnTimer); burnTimer = null; }
      document.documentElement.style.setProperty('--shift-x', '0px');
      document.documentElement.style.setProperty('--shift-y', '0px');
      burnLastX = 0;
      burnLastY = 0;
      return;
    }
    if (force || !burnTimer) scheduleBurnIn();
  }

  function applyConfig(raw) {
    mergeConfig(raw);
    rebuildPalette();
    if (colorIdx >= PALETTE.length) colorIdx = 0;

    if (W && H) {
      layout();
    }
    applyBackground();
    applyCurrentColor();
    updateGlow();
    applyCustomEyes();
    applyAccessories();
    ensureCompanions();
    applyNight(true);
    pollBattery(true);
    renderWidget();
    applyBurnIn(true);
    if (CFG.speed <= 0) {
      move.active = false;
      pauseUntil = performance.now() + 3000;
    }

    if (engine && !styleAllowed(STYLES[styleIdx].id)) {
      nextFaceAt = Math.min(nextFaceAt || 0, performance.now() + 600);
    }
    if (performance.now() - lastTouchAt > 4000 && CFG.bubbles.enabled && !nextBubbleAt) {
      nextBubbleAt = performance.now() + rand(CFG.bubbles.minMin, CFG.bubbles.maxMin) * 60000;
    }
  }

  /* ---------------- 创建 / 换脸 ---------------- */

  function makeEngine() {
    if (engine) {
      try { engine.destroy(); } catch (e) { /* 忽略 */ }
      engine = null;
    }
    host.innerHTML = '';

    yawSpring.x = yaw;
    yawSpring.t = yaw;
    yawSpring.v = 0;

    engine = EB.create(host, {
      emotion: STYLES[styleIdx].id,
      shape: 'blob',
      color: PALETTE[colorIdx].hex,
      eyeColor: CFG.customEyes.image ? 'rgba(0,0,0,0)' : '#0A0A0A',
      label: 'yuanbing for Android',
      autostart: true
    });

    /* 这台桌搭不需要引擎自带的彩虹彩带 / 撒花 */
    engine.spin = function () { return this; };
    engine.burst = function () { return this; };
    engine._spin = yawSpring;

    baseStyleId = STYLES[styleIdx].id;
    ballEl.style.setProperty('--rgb', PALETTE[colorIdx].rgb);
    if (CFG.customEyes.image) buildCustomEyes();
  }

  function pickStyle(exclude) {
    var pool = [];
    for (var i = 0; i < STYLES.length; i++) {
      if (styleAllowed(STYLES[i].id)) pool.push(i);
    }
    if (!pool.length) {
      for (var j = 0; j < STYLES.length; j++) pool.push(j);
    }
    if (pool.length === 1) return pool[0];
    var n = exclude;
    var guard = 0;
    while ((n === exclude || !styleAllowed(STYLES[n].id)) && guard++ < 200) {
      n = pool[Math.floor(Math.random() * pool.length)];
    }
    return n < 0 ? pool[0] : n;
  }

  function pickColor(exclude) {
    var n = exclude;
    while (n === exclude) n = Math.floor(Math.random() * PALETTE.length);
    return n;
  }

  function setTilt() {
    ballEl.style.setProperty('--tilt', rand(-2.4, 2.4).toFixed(2) + 'deg');
  }

  function swapFace(now) {
    if (!engine || busyFace) return;
    busyFace = true;
    host.style.opacity = '0';

    var oldStyle = styleIdx;
    setTimeout(function () {
      styleIdx = pickStyle(oldStyle);
      colorIdx = pickColor(colorIdx);
      yaw = rand(-0.22, 0.22);
      yawVel = 0;
      setTilt();
      makeEngine();
      requestAnimationFrame(function () {
        host.style.opacity = '1';
      });
      busyFace = false;
      nextFaceAt = performance.now() + rand(CFG.faceMin, CFG.faceMax);
    }, 210);
  }

  /* ---------------- 声音 / 震动 ---------------- */

  function ensureAudio() {
    try {
      if (!audio) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (AC) audio = new AC();
      }
      if (audio && audio.state === 'suspended') audio.resume();
    } catch (e) { /* 没有音频也能玩 */ }
  }

  var sampleCache = {};
  function playSample(key) {
    if (!CFG.sound) return false;
    var path = CFG.sounds && CFG.sounds[key];
    if (!path) return false;
    var url = mediaUrl(path);
    if (!url) return false;
    try {
      var a = sampleCache[key];
      if (!a || a._ebSrc !== url) {
        a = new Audio(url);
        a.preload = 'auto';
        a._ebSrc = url;
        sampleCache[key] = a;
      }
      a.volume = clamp(CFG.soundVolume, 0, 1);
      a.currentTime = 0;
      var p = a.play();
      if (p && p.catch) p.catch(function () { /* 自动播放限制 */ });
      return true;
    } catch (e) { return false; }
  }

  function duang(strength) {
    if (!CFG.sound) return;
    if (playSample('wall')) return;
    if (!audio || audio.state !== 'running') return;
    try {
      var t = audio.currentTime;
      var o = audio.createOscillator();
      var g = audio.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(150 + 170 * strength, t);
      o.frequency.exponentialRampToValueAtTime(62, t + 0.24);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.13 * strength + 0.02, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g);
      g.connect(audio.destination);
      o.start(t);
      o.stop(t + 0.32);

      var o2 = audio.createOscillator();
      var g2 = audio.createGain();
      o2.type = 'triangle';
      o2.frequency.setValueAtTime(90 + 70 * strength, t);
      o2.frequency.exponentialRampToValueAtTime(45, t + 0.18);
      g2.gain.setValueAtTime(0.0001, t);
      g2.gain.exponentialRampToValueAtTime(0.07 * strength, t + 0.01);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o2.connect(g2);
      g2.connect(audio.destination);
      o2.start(t);
      o2.stop(t + 0.22);
    } catch (e) { /* 忽略 */ }
  }

  function popSound() {
    if (!CFG.sound) return;
    if (playSample('pop')) return;
    if (!audio || audio.state !== 'running') return;
    try {
      var t = audio.currentTime;
      var o = audio.createOscillator();
      var g = audio.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(520, t);
      o.frequency.exponentialRampToValueAtTime(980, t + 0.09);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.09, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      o.connect(g); g.connect(audio.destination);
      o.start(t); o.stop(t + 0.15);
    } catch (e) { /* 忽略 */ }
  }

  function buzz(ms) {
    try {
      if (window.Native && Native.vibrate) Native.vibrate(ms);
      else if (navigator.vibrate) navigator.vibrate(ms);
    } catch (e) { /* 忽略 */ }
  }

  /* ---------------- 性格：情绪 / 声音 / 气泡 / 配饰 ---------------- */

  function tone(freq, dur, type, vol, slideTo, delay) {
    if (!CFG.sound || !audio || audio.state !== 'running') return;
    try {
      var t0 = audio.currentTime + (delay || 0);
      var o = audio.createOscillator();
      var g = audio.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t0);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      var v = Math.max(0.0001, (vol || 0.06) * CFG.soundVolume);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(v, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g);
      g.connect(audio.destination);
      o.start(t0);
      o.stop(t0 + dur + 0.03);
    } catch (e) { /* 忽略 */ }
  }

  function soundStartle() {
    if (playSample('poke')) return;
    tone(420, 0.12, 'triangle', 0.07, 760);
  }

  function soundGiggle() {
    if (playSample('giggle')) return;
    tone(760, 0.08, 'sine', 0.06, 920, 0);
    tone(880, 0.08, 'sine', 0.055, 1040, 0.09);
    tone(980, 0.10, 'sine', 0.05, 1180, 0.18);
  }

  function soundYawn() {
    if (playSample('yawn')) return;
    tone(240, 0.42, 'sine', 0.055, 120);
    tone(180, 0.5, 'triangle', 0.04, 96, 0.08);
  }

  function soundDizzy() {
    if (playSample('dizzy')) return;
    tone(520, 0.35, 'sine', 0.05, 240);
    tone(440, 0.4, 'triangle', 0.04, 180, 0.08);
  }

  function soundPop() {
    tone(640, 0.09, 'sine', 0.06, 1180);
  }

  function wakeUp(silent) {
    lastTouchAt = performance.now();
    if (nightNow) {
      nightAwakeUntil = performance.now() + 30000;
      document.body.classList.remove('night');
      try { if (window.Native && Native.setBrightness) Native.setBrightness(0.45); } catch (e) { /* 忽略 */ }
      clearTimeout(nightWakeTimer);
      nightWakeTimer = setTimeout(function () { applyNight(true); }, 30000);
    }
    if (mood === 'sleepy' && mode !== 'fly') {
      mood = 'idle';
      moodUntil = 0;
      clearTimeout(moodTimer);
      if (engine && !busyFace) engine.setEmotion(baseStyleId, { auto: true });
      if (!silent) { boop(); soundStartle(); buzz(8); }
    }
  }

  function setMood(name, ms, styleId, fx) {
    if (!engine || busyFace) return;
    mood = name;
    moodUntil = ms ? performance.now() + ms : 0;
    clearTimeout(moodTimer);
    clearTimeout(winkTimer);
    if (styleId) engine.setEmotion(styleId);
    if (fx === 'boop') boop();
    if (ms) {
      moodTimer = setTimeout(function () {
        if (mood === name && !busyFace) {
          mood = 'idle';
          moodUntil = 0;
          if (CFG.idleSleep.enabled && performance.now() - lastTouchAt > CFG.idleSleep.afterMin * 60000) {
            setMood('sleepy', 0, 'e_sleepy');
          } else if (engine && !busyFace) {
            engine.setEmotion(baseStyleId, { auto: true });
          }
        }
      }, ms);
    }
  }

  function giggle(cx, cy) {
    setMood('giggly', 1000, 'e_happy');
    clearTimeout(reactionTimer);
    boopEl.classList.remove('shake');
    void boopEl.offsetWidth;
    boopEl.classList.add('shake');
    sparkles(cx, cy);
    ensureAudio();
    soundGiggle();
    buzz(18);
    if (CFG.bubbles.enabled) say(pick(['咯咯…', '痒！', '别挠啦', '嘿嘿']), 1500, 32000);
  }

  var BUBBLES = {
    idle: ['在呢。', '今天也很安静。', '唔…', '看看你在干嘛。', '我在这儿。'],
    poke: ['呀！', '干嘛戳我。', '在这儿呢。', '轻一点…'],
    giggle: ['咯咯…', '痒！', '别挠啦', '嘿嘿'],
    sleepy: ['困了…', '晚安。', '让我眯一会儿…', '唔…'],
    dizzy: ['晕…', '天旋地转…', '别丢那么用力！'],
    happy: ['充电中，开心。', '满电！', '今天状态不错。']
  };

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function say(text, ms, cooldown) {
    if (!bubbleEl || !text) return;
    var now = performance.now();
    if (cooldown && now - lastBubbleAt < cooldown) return;
    lastBubbleAt = now;
    bubbleEl.textContent = text;
    bubbleEl.classList.toggle('below', y < H * 0.32);
    bubbleEl.classList.add('show');
    clearTimeout(bubbleEl._t);
    bubbleEl._t = setTimeout(function () {
      bubbleEl.classList.remove('show');
    }, ms || 2600);
  }

  function maybeBubble(now) {
    if (!CFG.bubbles.enabled || now < nextBubbleAt) return;
    var pool = BUBBLES.idle;
    if (nightNow) pool = BUBBLES.sleepy;
    else if (mood === 'sleepy') pool = BUBBLES.sleepy;
    say(pick(pool), 3200, 60000);
    nextBubbleAt = now + rand(CFG.bubbles.minMin, CFG.bubbles.maxMin) * 60000;
  }

  function applyAccessories() {
    if (!accEl) return;
    accEl.innerHTML = '';
    var list = CFG.accessories || [];

    function svg(inner) {
      var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      s.setAttribute('viewBox', '0 0 100 100');
      s.setAttribute('class', 'acc-svg');
      s.innerHTML = inner;
      return s;
    }

    if (list.indexOf('blush') >= 0) {
      accEl.appendChild(svg(
        '<ellipse cx="28" cy="64" rx="9.5" ry="5" fill="#FF7FA0" opacity=".4" style="filter:blur(2.6px)"/>' +
        '<ellipse cx="72" cy="64" rx="9.5" ry="5" fill="#FF7FA0" opacity=".4" style="filter:blur(2.6px)"/>'));
    }

    if (list.indexOf('ahoge') >= 0) {
      accEl.appendChild(svg(
        '<path d="M50 9 C47 -5 54 -13 63 -10 C57 -3 56 3 58 9" fill="none" stroke="#141210" stroke-width="3.4" stroke-linecap="round"/>' +
        '<path d="M57 10 C61 2 66 0 70 2" fill="none" stroke="#141210" stroke-width="2.4" stroke-linecap="round" opacity=".85"/>'));
    }

    if (list.indexOf('nightcap') >= 0) {
      accEl.appendChild(svg(
        '<path d="M30 30 C34 14 48 5 62 7 C74 9 82 18 80 26 C79 31 73 32 68 30 C62 27 56 25 50 29 C43 34 34 35 30 30Z" fill="#5A49C8" stroke="#2E2478" stroke-width="1.5"/>' +
        '<path d="M31 30 Q50 37 70 30" fill="none" stroke="#C9C1FF" stroke-width="4.5" stroke-linecap="round"/>' +
        '<path d="M55 12 L52 20 M64 10 L61 18" stroke="#8C7FE8" stroke-width="2" stroke-linecap="round"/>' +
        '<circle cx="80" cy="25" r="4.2" fill="#F7E9C9"/>'));
    }

    if (list.indexOf('scarf') >= 0) {
      accEl.appendChild(svg(
        '<path d="M22 72 Q50 61 78 72 L78 81 Q50 70 22 81Z" fill="#D94B62"/>' +
        '<path d="M24 74 Q50 64 76 74" stroke="#FF9FB0" stroke-width="1.6" fill="none"/>' +
        '<circle cx="74" cy="74" r="4.2" fill="#C23B54"/>' +
        '<path d="M72 77 C78 84 80 92 77 97 C72 92 69 84 70 77Z" fill="#C23B54"/>' +
        '<path d="M76 77 C82 83 84 90 82 95 C78 90 75 84 75 78Z" fill="#B23249"/>'));
    }

    if (list.indexOf('beret') >= 0) {
      accEl.appendChild(svg(
        '<path d="M28 24 C20 12 32 4 46 5 C60 6 72 14 70 24 C67 32 58 32 50 30 C40 28 33 30 28 24Z" fill="#8E2F3C"/>' +
        '<path d="M29 23 Q49 31 69 22" stroke="#5F1C27" stroke-width="3" fill="none" stroke-linecap="round"/>' +
        '<circle cx="64" cy="6" r="3.6" fill="#8E2F3C"/>'));
    }

    if (list.indexOf('flower') >= 0) {
      accEl.appendChild(svg(
        '<g fill="#FF9EB5">' +
        '<circle cx="52" cy="4" r="5.4"/><circle cx="62" cy="9" r="5.4"/><circle cx="59" cy="20" r="5.4"/>' +
        '<circle cx="45" cy="20" r="5.4"/><circle cx="42" cy="9" r="5.4"/></g>' +
        '<circle cx="52" cy="12" r="4.2" fill="#FFD84D"/>'));
    }

    if (list.indexOf('headphones') >= 0) {
      accEl.appendChild(svg(
        '<path d="M16 54 Q16 16 50 16 Q84 16 84 54" fill="none" stroke="#2A2A33" stroke-width="7" stroke-linecap="round"/>' +
        '<rect x="10" y="46" width="11" height="22" rx="5.5" fill="#2A2A33"/>' +
        '<rect x="79" y="46" width="11" height="22" rx="5.5" fill="#2A2A33"/>' +
        '<rect x="12.5" y="49" width="6" height="16" rx="3" fill="#5E5E6E"/>' +
        '<rect x="81.5" y="49" width="6" height="16" rx="3" fill="#5E5E6E"/>'));
    }

    if (list.indexOf('glasses') >= 0) {
      accEl.appendChild(svg(
        '<g fill="none" stroke="#171717" stroke-width="3.2" stroke-linecap="round">' +
        '<circle cx="34" cy="51" r="11"/><circle cx="66" cy="51" r="11"/>' +
        '<path d="M45 51 Q50 47 55 51"/><path d="M23 48 L16 44"/><path d="M77 48 L84 44"/></g>'));
    }

    if (list.indexOf('crown') >= 0) {
      accEl.appendChild(svg(
        '<path d="M28 22 L33 8 L41 16 L50 4 L59 16 L67 8 L72 22 Z" fill="#FFD24A" stroke="#C79A1E" stroke-width="1.4" stroke-linejoin="round"/>' +
        '<circle cx="33" cy="7" r="2" fill="#FFF3B0"/><circle cx="50" cy="3" r="2.2" fill="#FFF3B0"/><circle cx="67" cy="7" r="2" fill="#FFF3B0"/>'));
    }

    if (list.indexOf('catEars') >= 0) {
      accEl.appendChild(svg(
        '<path d="M26 30 L30 7 L45 23Z" fill="#1A1714"/>' +
        '<path d="M74 30 L70 7 L55 23Z" fill="#1A1714"/>' +
        '<path d="M31 24 L33 13 L40 22Z" fill="#FF9EB5"/>' +
        '<path d="M69 24 L67 13 L60 22Z" fill="#FF9EB5"/>'));
    }

    if (list.indexOf('halo') >= 0) {
      accEl.appendChild(svg(
        '<ellipse cx="50" cy="6" rx="17" ry="4.5" fill="none" stroke="#FFE28A" stroke-width="3" style="filter:drop-shadow(0 0 5px #FFD24A)"/>'));
    }

    if (list.indexOf('bow') >= 0) {
      accEl.appendChild(svg(
        '<path d="M50 14 C40 4 28 8 33 18 C37 26 45 22 50 17 C55 22 63 26 67 18 C72 8 60 4 50 14Z" fill="#FF6B9A"/>' +
        '<circle cx="50" cy="16" r="3.2" fill="#E14F7E"/>'));
    }

    if (CFG.customAcc && CFG.customAcc.image) {
      var ca = CFG.customAcc;
      var img = document.createElement('img');
      img.className = 'acc-custom';
      img.alt = '';
      img.src = mediaUrl(ca.image);
      img.style.left = clamp(ca.x, 0, 100) + '%';
      img.style.top = clamp(ca.y, 0, 100) + '%';
      img.style.width = clamp(ca.scale, 5, 100) + '%';
      img.style.transform = 'translate(-50%,-50%) rotate(' + ca.rotate + 'deg)';
      accEl.appendChild(img);
    }
  }

  function speedMul() {
    if (mood === 'sleepy') return 0.3;
    if (nightNow) return 0.55;
    return 1;
  }

  /* ---------------- 作息 / 电量 / 体感 ---------------- */

  var nightAwakeUntil = 0;
  var nightWakeTimer = 0;

  function isNightHour() {
    var h = new Date().getHours();
    var s = CFG.night.start, e = CFG.night.end;
    if (s === e) return false;
    if (s < e) return h >= s && h < e;
    return h >= s || h < e;
  }

  function renderWidget() {
    if (!widgetEl) return;
    var w = CFG.widget || {};
    document.body.classList.toggle('widget', !!w.enabled);
    if (!w.enabled) return;
    var d = new Date();
    widgetTimeEl.textContent = w.time
      ? ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2)
      : '';
    widgetDateEl.textContent = w.date
      ? (d.getMonth() + 1) + '月' + d.getDate() + '日 周' + '日一二三四五六'.charAt(d.getDay())
      : '';
    if (w.battery) {
      var pct = batteryState.level >= 0 ? batteryState.level + '%' : '';
      widgetBatteryEl.textContent = pct ? (batteryState.charging ? pct + ' ⚡' : pct) : '';
    } else {
      widgetBatteryEl.textContent = '';
    }
  }

  function applyNight(force) {
    var n = !!(CFG.night.enabled && isNightHour());
    if (n === nightNow && !force) return;
    nightNow = n;
    document.body.classList.toggle('night', n);
    try {
      if (window.Native && Native.setBrightness) {
        Native.setBrightness(n ? CFG.night.brightness : 0.45);
      }
    } catch (e) { /* 忽略 */ }
    if (n && mood !== 'sleepy' && performance.now() > nightAwakeUntil) {
      setMood('sleepy', 0, 'e_sleepy');
    } else if (!n && mood === 'sleepy') {
      mood = 'idle';
      if (engine && !busyFace) engine.setEmotion(baseStyleId, { auto: true });
    }
  }

  function pollBattery(force) {
    if (!CFG.battery.enabled) return;
    var now = performance.now();
    if (!force && now - batteryState.checked < 60000) return;
    batteryState.checked = now;
    try {
      if (!window.Native || !Native.battery) return;
      var s = String(Native.battery()).split(',');
      var level = parseInt(s[0], 10);
      var charging = s[1] === '1';
      if (!isFinite(level)) return;
      batteryState.level = level;
      batteryState.charging = charging;
      var key = charging && level >= 99 ? 'full' : (charging ? 'charging' : (level <= 15 ? 'low' : ''));
      if (key === batteryState.key) return;
      batteryState.key = key;
      if (key === 'charging') {
        setMood('happy', 5000, 'e_heart');
        if (CFG.bubbles.enabled) say('充电中，开心。', 3000, 60000);
      } else if (key === 'full') {
        setMood('sleepy', 6000, 'e_sleepy');
      } else if (key === 'low') {
        setMood('sleepy', 9000, 'e_sleepy');
        if (CFG.bubbles.enabled) say('有点没电了…', 3000, 60000);
      }
    } catch (e) { /* 忽略 */ }
  }

  function pollSensors(now) {
    if (!CFG.sensor.enabled) return;
    if (now - lastSensorPoll < 120) return;
    lastSensorPoll = now;
    try {
      if (!window.Native || !Native.motion) return;
      var s = String(Native.motion()).split(',');
      var ax = parseFloat(s[0]), ay = parseFloat(s[1]), az = parseFloat(s[2]);
      if (!isFinite(ax) || !isFinite(ay) || !isFinite(az)) return;
      sensorState.ax = ax; sensorState.ay = ay; sensorState.az = az;
      var mag = Math.sqrt(ax * ax + ay * ay + az * az);
      if (mag > 21 && now - sensorState.lastShake > 1800) {
        sensorState.lastShake = now;
        setMood('dizzy', 1000, 'e_swirl');
        soundDizzy();
        buzz(20);
        if (CFG.bubbles.enabled) say('别摇啦…', 2200, 20000);
      }
      if (az < -6.5) {
        if (!sensorState.flipSince) sensorState.flipSince = now;
        if (now - sensorState.flipSince > 500 && now - sensorState.lastFlip > 4000) {
          sensorState.lastFlip = now;
          setMood('sleepy', 3000, 'e_sleepy');
        }
      } else {
        sensorState.flipSince = 0;
      }
    } catch (e) { /* 忽略 */ }
  }

  /* ---------------- 小伙伴 ---------------- */

  function destroyCompanions() {
    for (var i = 0; i < companions.length; i++) {
      try { companions[i].engine.destroy(); } catch (e) { /* 忽略 */ }
      if (companions[i].el.parentNode) companions[i].el.parentNode.removeChild(companions[i].el);
    }
    companions = [];
  }

  function createCompanion(idx) {
    var el = document.createElement('div');
    el.className = 'mini';
    var glow = document.createElement('div');
    glow.className = 'mini-glow';
    var hostEl = document.createElement('div');
    hostEl.className = 'mini-host';
    el.appendChild(glow);
    el.appendChild(hostEl);
    stage.appendChild(el);

    var m = {
      el: el, host: hostEl, size: 0, x: x + rand(-160, 160), y: y + rand(-100, 100),
      phase: Math.PI * 2 * (idx / Math.max(1, CFG.balls - 1)) + rand(0, 0.35), styleIdx: pickStyle(-1),
      colorIdx: pickColor(-1), engine: null, nextFace: performance.now() + rand(18000, 36000),
      yaw: rand(-0.4, 0.4), factor: 0.30 + ((idx * 0.024) % 0.22)
    };
    m.engine = EB.create(hostEl, {
      emotion: STYLES[m.styleIdx].id,
      shape: 'blob',
      color: PALETTE[m.colorIdx].hex,
      eyeColor: '#0A0A0A',
      autostart: true
    });
    m.engine.spin = function () { return this; };
    m.engine.burst = function () { return this; };
    m.yawSpring = { x: m.yaw, v: 0, t: m.yaw };
    m.engine._spin = m.yawSpring;
    el.style.setProperty('--rgb', PALETTE[m.colorIdx].rgb);
    return m;
  }

  function ensureCompanions() {
    // 性能保护：超过 12 只时不再继续创建 SVG 引擎，避免手机掉帧/卡死。
    var want = clamp(CFG.balls - 1, 0, 11);
    while (companions.length > want) {
      var last = companions.pop();
      try { last.engine.destroy(); } catch (e) { /* 忽略 */ }
      if (last.el.parentNode) last.el.parentNode.removeChild(last.el);
    }
    while (companions.length < want) {
      companions.push(createCompanion(companions.length));
    }
    for (var i = 0; i < companions.length; i++) {
      var m = companions[i];
      m.size = Math.max(28, Math.round(size * m.factor));
      m.el.style.width = m.size + 'px';
      m.el.style.height = m.size + 'px';
    }
  }

  function updateCompanions(dt, now) {
    var n = companions.length;
    var inner = Math.min(5, n);
    for (var i = 0; i < n; i++) {
      var m = companions[i];
      if (!m.size) continue;
      var ring = i < inner ? 0 : 1;
      var slot = ring === 0 ? i : i - inner;
      var count = ring === 0 ? inner : Math.max(1, n - inner);
      var a = (slot / count) * Math.PI * 2 + now * 0.00016 * Math.max(0, CFG.speed) + (ring ? 0.55 : 0);
      var rx = size * (ring ? 0.94 : 0.62);
      var ry = size * (ring ? 0.60 : 0.40);
      var tx = x + Math.cos(a) * rx;
      var ty = y + Math.sin(a) * ry;
      // 小伙伴是装饰层：直接跟随轨道目标，避免高倍速时被低通滤波糊在主球附近。
      m.x = tx;
      m.y = ty;

      var r = m.size * 0.5;
      m.x = clamp(m.x, r + Math.max(EDGE_PAD, cut.l + EDGE_PAD), W - r - Math.max(EDGE_PAD, cut.r + EDGE_PAD));
      m.y = clamp(m.y, r + Math.max(EDGE_PAD, cut.t + EDGE_PAD), H - r - Math.max(EDGE_PAD, cut.b + EDGE_PAD));
      m.el.style.transform = 'translate3d(' + (m.x - m.size / 2).toFixed(1) + 'px,' +
        (m.y - m.size / 2).toFixed(1) + 'px,0)';
      m.yawSpring.t = m.yaw + Math.sin(now / 2400 + m.phase) * 0.25;
      m.yawSpring.x = m.yawSpring.t;

      if (now > m.nextFace && !busyFace) {
        m.nextFace = now + rand(CFG.faceMin, CFG.faceMax);
        m.styleIdx = pickStyle(m.styleIdx);
        m.colorIdx = pickColor(m.colorIdx);
        try { m.engine.destroy(); } catch (e) { /* 忽略 */ }
        m.engine = EB.create(m.host, {
          emotion: STYLES[m.styleIdx].id,
          shape: 'blob',
          color: PALETTE[m.colorIdx].hex,
          eyeColor: '#0A0A0A',
          autostart: true
        });
        m.engine.spin = function () { return this; };
        m.engine.burst = function () { return this; };
        m.engine._spin = m.yawSpring;
        m.el.style.setProperty('--rgb', PALETTE[m.colorIdx].rgb);
      }
    }
  }

  /* ---------------- 特效 ---------------- */

  function ripple(cx, cy) {
    var r = document.createElement('div');
    r.className = 'fx-ring';
    r.style.left = cx + 'px';
    r.style.top = cy + 'px';
    fxLayer.appendChild(r);
    setTimeout(function () { if (r.parentNode) r.parentNode.removeChild(r); }, 650);
  }

  function wallRing(px, py) {
    var r = document.createElement('div');
    r.className = 'fx-wall';
    r.style.left = px + 'px';
    r.style.top = py + 'px';
    fxLayer.appendChild(r);
    setTimeout(function () { if (r.parentNode) r.parentNode.removeChild(r); }, 600);
  }

  function sparkles(cx, cy) {
    for (var k = 0; k < 12; k++) {
      var s = document.createElement('div');
      s.className = 'fx-spark';
      var a = (k / 12) * Math.PI * 2 + rand(-0.2, 0.2);
      var d = rand(36, 110);
      s.style.left = cx + 'px';
      s.style.top = cy + 'px';
      s.style.setProperty('--dx', Math.cos(a) * d + 'px');
      s.style.setProperty('--dy', Math.sin(a) * d + 'px');
      fxLayer.appendChild(s);
      (function (node) {
        setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 700);
      })(s);
    }
  }

  function boop() {
    boopEl.classList.remove('boop');
    void boopEl.offsetWidth;
    boopEl.classList.add('boop');
  }

  function flash() {
    ballEl.classList.remove('flash');
    void ballEl.offsetWidth;
    ballEl.classList.add('flash');
    setTimeout(function () { ballEl.classList.remove('flash'); }, 480);
  }

  /* ---------------- 表情互动 ---------------- */

  function gazeAt(cx, cy) {
    if (!engine) return;
    engine.setGaze(clamp((cx - x) / (bodyR * 2.2), -1, 1), clamp((cy - y) / (bodyR * 2.2), -1, 1));
  }

  function wink(cx, cy) {
    if (!engine || busyFace) return;
    wakeUp(true);
    lastTouchAt = performance.now();
    var id = Math.random() < 0.5 ? 'winkL' : 'winkR';
    engine.setEmotion(id);
    winkCustomEyes(id);
    winkUntil = performance.now() + WINK_MS;

    clearTimeout(winkTimer);
    winkTimer = setTimeout(function () {
      if (engine && !busyFace) engine.setEmotion(baseStyleId, { auto: true });
    }, WINK_MS - 20);

    boop();
    gazeAt(cx, cy);
    ripple(cx, cy);
    ensureAudio();
    soundStartle();
    buzz(8);
    if (CFG.bubbles.enabled && Math.random() < 0.35) {
      say(pick(BUBBLES.poke), 2000, 45000);
    }
  }

  function doubleTap(cx, cy) {
    if (!engine || busyFace) return;
    wakeUp(true);
    lastTouchAt = performance.now();
    clearTimeout(winkTimer);
    winkUntil = performance.now() + 950;

    colorIdx = pickColor(colorIdx);
    ballEl.style.setProperty('--rgb', PALETTE[colorIdx].rgb);
    if (engine._theme) engine._theme.body = PALETTE[colorIdx].hex;

    var prev = baseStyleId;
    engine.setEmotion('e_heart');
    clearTimeout(reactionTimer);
    reactionTimer = setTimeout(function () {
      if (engine && !busyFace) engine.setEmotion(prev, { auto: true });
    }, 920);

    ensureAudio();
    popSound();
    flash();
    sparkles(cx, cy);
    boop();
    buzz(16);
    if (CFG.bubbles.enabled) say(pick(['啵！', '喜欢你。', '再点一下？']), 1800, 25000);
    nextFaceAt = Math.max(nextFaceAt, performance.now() + 14000);
  }

  function onTap(cx, cy, now) {
    tapTimes.push(now);
    tapTimes = tapTimes.filter(function (t) { return now - t < 1100; });
    if (tapTimes.length >= 3) {
      tapTimes = [];
      lastTapAt = 0;
      giggle(cx, cy);
      return;
    }
    if (now - lastTapAt < DOUBLE_MS) {
      lastTapAt = 0;
      doubleTap(cx, cy);
    } else {
      lastTapAt = now;
      wink(cx, cy);
    }
  }

  /* ---------------- 待机游走 ---------------- */

  function startLeg(now) {
    x = clamp(x, minX, maxX);
    y = clamp(y, minY, maxY);
    /* 速度 0：固定在原地，只保留眨眼、视线和呼吸 */
    if (CFG.speed <= 0) {
      move.active = false;
      pauseUntil = now + rand(1400, 3200);
      return;
    }
    var tx = x, ty = y, dist = 0, tries;
    for (tries = 0; tries < 8; tries++) {
      tx = rand(minX, maxX);
      ty = rand(minY, maxY);
      dist = Math.sqrt((tx - x) * (tx - x) + (ty - y) * (ty - y));
      if (dist > Math.min(160, (maxX - minX) * 0.35)) break;
    }
    if (dist < 24) {
      tx = clamp(x + rand(-120, 120), minX, maxX);
      ty = clamp(y + rand(-70, 70), minY, maxY);
      dist = Math.sqrt((tx - x) * (tx - x) + (ty - y) * (ty - y));
    }

    move.active = true;
    move.fromX = x;
    move.fromY = y;
    move.tx = tx;
    move.ty = ty;
    move.start = now;
    move.dur = clamp(dist / (rand(42, 76) * CFG.speed * speedMul()) * 1000, 160, 9000);
  }

  function updateIdle(dt, now) {
    if (move.active) {
      var t = (now - move.start) / move.dur;
      if (t >= 1) {
        x = move.tx;
        y = move.ty;
        move.active = false;
        pauseUntil = now + rand(1300, 4200);
      } else {
        var e = easeInOutCubic(t);
        x = move.fromX + (move.tx - move.fromX) * e;
        y = move.fromY + (move.ty - move.fromY) * e;
      }
    } else if (now >= pauseUntil) {
      startLeg(now);
    }

    if (now >= nextGazeAt && engine) {
      if (move.active) gazeAt(move.tx, move.ty);
      else engine.setGaze(rand(-0.7, 0.7), rand(-0.35, 0.45));
      nextGazeAt = now + rand(2000, 4300);
    }

    /* 任何情况下都不让待机中的球跑出安全区 */
    x = clamp(x, minX, maxX);
    y = clamp(y, minY, maxY);

    /* 球停稳后，把脸慢慢转回正面 */
    yaw += (0 - yaw) * Math.min(1, dt * 0.55);
  }

  /* ---------------- 甩出去 / 撞墙 ---------------- */

  function onBounce(side, speed) {
    var strength = clamp(speed / 1900, 0.35, 1);

    if (side === 'left' || side === 'right') { squashX = 0.78; squashY = 1.15; }
    else { squashX = 1.15; squashY = 0.78; }

    if (side === 'left') wallRing(minX - bodyR, y);
    else if (side === 'right') wallRing(maxX + bodyR, y);
    else if (side === 'top') wallRing(x, minY - bodyR);
    else wallRing(x, maxY + bodyR);

    ensureAudio();
    duang(strength);
    buzz(Math.round(7 + 8 * strength));
    lastBounceAt = performance.now();
  }

  function updateFly(dt, now) {
    x += vx * dt;
    y += vy * dt;

    var hit = '', speed = Math.sqrt(vx * vx + vy * vy);

    if (x < minX) {
      x = minX;
      if (vx < 0) { vx = -vx * REST; hit = 'left'; }
    } else if (x > maxX) {
      x = maxX;
      if (vx > 0) { vx = -vx * REST; hit = 'right'; }
    }
    if (y < minY) {
      y = minY;
      if (vy < 0) { vy = -vy * REST; hit = 'top'; }
    } else if (y > maxY) {
      y = maxY;
      if (vy > 0) { vy = -vy * REST; hit = 'bottom'; }
    }

    if (hit) onBounce(hit, speed);

    var fr = Math.pow(0.98, dt * 60);
    vx *= fr;
    vy *= fr;

    yaw += yawVel * dt;
    yawVel *= Math.pow(0.12, dt);

    if (now - lastBounceAt > 350 && Math.sqrt(vx * vx + vy * vy) < 55) {
      vx = 0;
      vy = 0;
      mode = 'idle';
      liftTarget = 1;
      pauseUntil = now + 650;
      yawVel = 0;
      nextGazeAt = now + 500;
      if (mood !== 'sleepy') {
        setMood('dizzy', 1100, 'e_swirl', 'boop');
        soundDizzy();
        if (CFG.bubbles.enabled) say(pick(BUBBLES.dizzy), 2200, 20000);
      }
    }
  }

  /* ---------------- 按住 / 拖拽 ---------------- */

  /* ---------------- 双指：捏合缩放 / 转球 ---------------- */

  function resizeTo(px) {
    var maxSize = Math.min(W * 0.66, H * 0.92);
    size = clamp(px, 110, maxSize);
    bodyR = size * 0.48;

    minX = bodyR + Math.max(EDGE_PAD, cut.l + EDGE_PAD);
    maxX = W - bodyR - Math.max(EDGE_PAD, cut.r + EDGE_PAD);
    minY = bodyR + Math.max(EDGE_PAD, cut.t + EDGE_PAD);
    maxY = H - bodyR - Math.max(EDGE_PAD, cut.b + EDGE_PAD);
    if (maxX < minX) { minX = maxX = W / 2; }
    if (maxY < minY) { minY = maxY = H / 2; }

    ballEl.style.width = Math.round(size) + 'px';
    ballEl.style.height = Math.round(size) + 'px';
    x = clamp(x, minX, maxX);
    y = clamp(y, minY, maxY);
    layoutCustomEyes();
    render();
  }

  function startPinch(ev) {
    var d = Math.sqrt((ev.clientX - lastX) * (ev.clientX - lastX) +
                      (ev.clientY - lastY) * (ev.clientY - lastY));
    if (d < 18) return;
    pinch = {
      id: ev.pointerId,
      d0: d,
      s0: size,
      a0: Math.atan2(ev.clientY - lastY, ev.clientX - lastX),
      yaw0: yaw
    };
    pinched = true;
    held = true;
    mode = 'held';
    liftTarget = 1.04;
    ballEl.classList.add('held');
    clearTimeout(pressTimer);
    pressTimer = 0;
    ev.preventDefault();
  }

  function updatePinch(ev) {
    if (!pinch) return;
    var dx = ev.clientX - lastX;
    var dy = ev.clientY - lastY;
    var d = Math.sqrt(dx * dx + dy * dy);
    if (d > 12) resizeTo(pinch.s0 * d / pinch.d0);

    var a = Math.atan2(dy, dx);
    var da = a - pinch.a0;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    yaw = pinch.yaw0 + da * 1.35;

    ev.preventDefault();
  }

  function endPinch() {
    if (!pinch) return;
    pinch = null;
    held = false;
    mode = 'idle';
    liftTarget = 1;
    ballEl.classList.remove('held');
    pauseUntil = performance.now() + 900;
  }

  function beginHold() {
    if (held) return;
    held = true;
    mode = 'held';
    holdAt = performance.now();
    lastTouchAt = holdAt;
    wakeUp(true);
    liftTarget = 1.06;
    ballEl.classList.add('held');
    ensureAudio();
    buzz(10);
  }

  function onDown(ev) {
    if (pinch || (down && ev.pointerId !== pointerId)) return;
    if (ev.button != null && ev.button !== 0) return;
    if (busyFace) return;

    var dx = ev.clientX - x;
    var dy = ev.clientY - y;
    if (Math.sqrt(dx * dx + dy * dy) > bodyR * 1.12) return;

    down = true;
    held = false;
    moved = false;
    pointerId = ev.pointerId;
    startX = lastX = ev.clientX;
    startY = lastY = ev.clientY;
    downAt = lastT = lastMoveT = performance.now();
    velX = velY = 0;

    if (mode === 'fly') {
      vx = vy = 0;
      mode = 'held';
      held = true;
      liftTarget = 1.06;
      ballEl.classList.add('held');
      buzz(10);
    }

    clearTimeout(pressTimer);
    pressTimer = setTimeout(function () {
      if (down && !held) beginHold();
    }, HOLD_MS);

    ensureAudio();
    ev.preventDefault();
    ev.stopPropagation();
  }

  function onMove(ev) {
    if (pinch) {
      if (ev.pointerId === pinch.id) updatePinch(ev);
      return;
    }
    if (!down || ev.pointerId !== pointerId) return;

    var now = performance.now();
    var dx = ev.clientX - lastX;
    var dy = ev.clientY - lastY;
    var dt = Math.max(1, now - lastT);

    velX = dx / dt;
    velY = dy / dt;

    if (!held) {
      var ddx = ev.clientX - startX;
      var ddy = ev.clientY - startY;
      if (Math.sqrt(ddx * ddx + ddy * ddy) > 8) beginHold();
    }

    if (held) {
      x = clamp(x + dx, minX, maxX);
      y = clamp(y + dy, minY, maxY);
      yaw += dx * 0.0075;
      moved = true;
      lastMoveT = now;
      gazeAt(ev.clientX, ev.clientY);
    }

    lastX = ev.clientX;
    lastY = ev.clientY;
    lastT = now;
    ev.preventDefault();
  }

  function releasePointer(ev, allowThrow) {
    if (!down || (ev && ev.pointerId !== pointerId)) return;

    var now = performance.now();
    down = false;
    clearTimeout(pressTimer);
    pressTimer = 0;

    if (pinch) { endPinch(); allowThrow = false; }
    if (pinched) { allowThrow = false; pinched = false; }

    if (held) {
      var speed = Math.sqrt(velX * velX + velY * velY);
      if (now - lastMoveT > 140) speed = 0;
      var thrown = false;

      if (allowThrow && moved && speed > 0.35) {
        vx = clamp(velX * 1000 * 0.9, -1600, 1600);
        vy = clamp(velY * 1000 * 0.9, -1600, 1600);
        if (Math.sqrt(vx * vx + vy * vy) < 420) {
          vx *= 1.4;
          vy *= 1.4;
        }
        mode = 'fly';
        thrown = true;
        lastBounceAt = now;
        yawVel = clamp(velX * 0.02, -6, 6);
      } else {
        mode = 'idle';
        vx = vy = 0;
        pauseUntil = now + 800;
        yawVel = 0;
        if (now - holdAt > 1100 && !moved) {
          setMood('calm', 2600, 'e_happy');
          if (CFG.bubbles.enabled && Math.random() < 0.5) say('唔…', 1600, 60000);
        }
      }
      if (thrown) mood = 'idle';
      liftTarget = 1;
      ballEl.classList.remove('held');
    } else if (now - downAt < TAP_MS && Math.sqrt((lastX - startX) * (lastX - startX) + (lastY - startY) * (lastY - startY)) < 12) {
      onTap(lastX, lastY, now);
    }

    held = false;
    pointerId = null;
    if (ev) ev.preventDefault();
  }

  function onUp(ev) {
    releasePointer(ev, true);
  }

  function onCancel(ev) {
    releasePointer(ev, false);
  }

  /* ---------------- 渲染 ---------------- */

  function render() {
    var bob = (mode === 'idle' && !move.active) ? Math.sin(performance.now() / 820) * 2.2 : 0;
    ballEl.style.transform =
      'translate3d(' + (x - size / 2).toFixed(1) + 'px,' + (y - size / 2 + bob).toFixed(1) + 'px,0)';

    var sx = squashX * lift;
    var sy = squashY * lift;
    squashEl.style.transform = 'scale(' + sx.toFixed(3) + ',' + sy.toFixed(3) + ')';
  }

  /* ---------------- 主循环 ---------------- */

  function frame(now) {
    if (!lastFrame) lastFrame = now;
    var dt = Math.min((now - lastFrame) / 1000, 0.05);
    lastFrame = now;

    if (mode === 'idle') updateIdle(dt, now);
    else if (mode === 'fly') updateFly(dt, now);
    else if (mode === 'held') {
      if (now - lastMoveT > 350) yaw += 0.55 * dt;
      if (!moved && now - holdAt > 2200 && mood === 'idle') {
        setMood('calm', 2600, 'e_happy');
      }
    }

    if (now - lastEnvCheck > 60000) {
      lastEnvCheck = now;
      applyNight(false);
      pollBattery(false);
    }
    pollSensors(now);

    if (mode === 'idle' && mood === 'idle' && now >= nextYawnAt) {
      setMood('sleepy', 1800, 'e_sleepy');
      ensureAudio();
      soundYawn();
      nextYawnAt = now + rand(180000, 480000);
    }
    if (mode !== 'held' && CFG.idleSleep.enabled && mood !== 'sleepy' &&
        now - lastTouchAt > CFG.idleSleep.afterMin * 60000) {
      setMood('sleepy', 0, 'e_sleepy');
    }
    maybeBubble(now);

    if (mode === 'idle' && !busyFace && mood === 'idle' && now >= nextFaceAt && now > winkUntil) {
      swapFace(now);
    }

    updateCompanions(dt, now);

    var k = 1 - Math.exp(-14 * dt);
    squashX += (1 - squashX) * k;
    squashY += (1 - squashY) * k;
    lift += (liftTarget - lift) * (1 - Math.exp(-10 * dt));

    yawSpring.x = yaw;
    yawSpring.t = yaw;
    yawSpring.v = 0;

    render();
    requestAnimationFrame(frame);
  }

  /* ---------------- 星尘 ---------------- */

  var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  var ctx = dustCanvas.getContext('2d');
  var dustW = 0, dustH = 0;
  var dust = [];
  var lastDustAt = 0;

  function initDust() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    dustW = w;
    dustH = h;
    dustCanvas.width = Math.round(w * dpr);
    dustCanvas.height = Math.round(h * dpr);
    dustCanvas.style.width = w + 'px';
    dustCanvas.style.height = h + 'px';

    dust = [];
    var n = Math.round(Math.min(40, Math.max(18, w / 34)));
    for (var j = 0; j < n; j++) {
      var c = PALETTE[j % PALETTE.length];
      dust.push({
        x: rand(0, w),
        y: rand(0, h),
        r: rand(0.5, 1.5),
        a: rand(0.025, 0.09),
        vx: rand(-1.8, 1.8),
        vy: rand(-6, -1.5),
        phase: rand(0, Math.PI * 2),
        tw: rand(0.3, 0.8),
        rgb: c.rgb
      });
    }
  }

  function drawDust(now) {
    if (now - lastDustAt < 33) {
      requestAnimationFrame(drawDust);
      return;
    }
    var dt = Math.min((now - lastDustAt) / 1000, 0.1);
    lastDustAt = now;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, dustW, dustH);
    ctx.globalCompositeOperation = 'lighter';

    for (var j = 0; j < dust.length; j++) {
      var p = dust[j];
      p.x += (p.vx + Math.sin(now / 4200 + p.phase) * 1.1) * dt;
      p.y += p.vy * dt;
      if (p.y < -8) { p.y = dustH + 8; p.x = rand(0, dustW); }
      if (p.x < -8) p.x = dustW + 8;
      if (p.x > dustW + 8) p.x = -8;

      var alpha = p.a * (0.5 + 0.5 * Math.sin(now / 1000 * p.tw + p.phase));
      if (alpha < 0.004) continue;
      ctx.beginPath();
      ctx.fillStyle = 'rgba(' + p.rgb + ',' + alpha.toFixed(3) + ')';
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(drawDust);
  }

  /* ---------------- 启动 ---------------- */

  function boot() {
    loadNativeConfig();
    rebuildPalette();

    try {
      if (window.Native && Native.log) {
        Native.log('desk styles=' + STYLES.length + ' cutout=' + Native.cutout());
      }
    } catch (e) { /* 忽略 */ }

    layout();
    initDust();
    requestAnimationFrame(drawDust);
    applyBackground();
    updateGlow();

    styleIdx = pickStyle(-1);
    colorIdx = Math.floor(Math.random() * PALETTE.length);
    yaw = rand(-0.18, 0.18);
    setTilt();
    makeEngine();
    applyCustomEyes();
    applyAccessories();
    ensureCompanions();
    applyNight(true);
    pollBattery(true);
    renderWidget();
    applyBurnIn(true);
    nextBubbleAt = performance.now() + rand(CFG.bubbles.minMin, CFG.bubbles.maxMin) * 60000;
    host.style.opacity = '0';
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { host.style.opacity = '1'; });
    });

    pauseUntil = performance.now() + 900;
    nextFaceAt = performance.now() + rand(CFG.faceMin, CFG.faceMax);
    nextGazeAt = performance.now() + 1200;
    lastFrame = 0;
    requestAnimationFrame(frame);
  }

  function loadNativeConfig() {
    try {
      if (window.Native && Native.getConfig) {
        var raw = Native.getConfig();
        if (raw && raw !== '{}') {
          mergeConfig(JSON.parse(raw));
          rebuildPalette();
        }
      }
    } catch (e) {
      if (window.Native && Native.log) Native.log('config load failed: ' + e);
    }
  }

  ballEl.addEventListener('pointerdown', onDown, false);
  window.addEventListener('pointerdown', function (ev) {
    if (down && !pinch && ev.pointerId !== pointerId) startPinch(ev);
  }, true);
  window.addEventListener('pointermove', onMove, false);
  window.addEventListener('pointerup', function (ev) {
    if (pinch && ev.pointerId === pinch.id) {
      endPinch();
      ev.preventDefault();
      ev.stopPropagation();
    }
  }, true);
  window.addEventListener('pointerup', onUp, false);
  window.addEventListener('pointercancel', onCancel, false);
  ballEl.addEventListener('contextmenu', function (ev) { ev.preventDefault(); }, false);

  window.addEventListener('resize', function () {
    layout();
    initDust();
    applyBackground();
  }, false);
  window.addEventListener('orientationchange', function () {
    setTimeout(function () { layout(); initDust(); applyBackground(); }, 300);
  }, false);

  window.addEventListener('message', function (ev) {
    var d = ev.data;
    if (!d) return;
    if (d.type === 'eb-config' && d.config) {
      applyConfig(d.config);
    } else if (d.type === 'eb-preview-style' && d.id) {
      previewStyle(d.id);
    } else if (d.type === 'eb-snapshot') {
      var path = '';
      try { if (window.Native && Native.snapshot) path = Native.snapshot(); } catch (e) { }
      try { parent.postMessage({ type: 'eb-snapshot-done', path: path }, '*'); } catch (e) { }
    }
  }, false);

  var previewStyleTimer = 0;
  function previewStyle(id) {
    if (!engine || busyFace) return;
    clearTimeout(previewStyleTimer);
    var prev = baseStyleId;
    baseStyleId = id;
    engine.setEmotion(id);
    previewStyleTimer = setTimeout(function () {
      baseStyleId = prev;
      if (engine && !busyFace) engine.setEmotion(prev, { auto: true });
    }, 2800);
  }

  window.DeskConfig = {
    apply: applyConfig,
    get: function () {
      try { return JSON.parse(JSON.stringify(CFG)); } catch (e) { return CFG; }
    }
  };

  document.addEventListener('contextmenu', function (ev) { ev.preventDefault(); }, false);
  document.addEventListener('selectstart', function (ev) { ev.preventDefault(); }, false);
  document.addEventListener('dragstart', function (ev) { ev.preventDefault(); }, false);

  boot();
  setInterval(renderWidget, 1000);

  /* ---------------- 出错时的文字兜底 ---------------- */

  function showFatal(msg) {
    var box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;' +
      'background:#000;color:#FFAE2E;font:16px/1.7 sans-serif;' +
      'display:flex;align-items:center;justify-content:center;text-align:center;padding:40px;';
    box.innerHTML = '<div><div style="font-size:22px;margin-bottom:12px;">yuanbing for Android</div>' +
      '<div style="color:#888;">' + msg + '</div>' +
      '<div style="color:#555;margin-top:18px;">请重新安装，或连接电脑查看日志</div></div>';
    document.body.appendChild(box);
  }
})();
