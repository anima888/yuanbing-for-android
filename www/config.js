/* yuanbing for Android 局域网控制台 */
(function () {
  'use strict';

  var DEFAULTS = {
    ballScale: 0.60,
    faceMin: 25000,
    faceMax: 45000,
    speed: 1,
    glow: 1,
    balls: 1,
    name: '',
    sound: true,
    soundVolume: 0.55,
    sounds: { poke: '', pop: '', wall: '', yawn: '', dizzy: '', giggle: '' },
    bubbles: { enabled: false, minMin: 10, maxMin: 30 },
    night: { enabled: true, start: 23, end: 7, brightness: 0.14 },
    battery: { enabled: true },
    idleSleep: { enabled: true, afterMin: 3 },
    sensor: { enabled: true },
    burnIn: { enabled: true, intervalSec: 120, shift: 8 },
    widget: { enabled: false, time: true, date: true, battery: true },
    accessories: [],
    palette: ['#FFAE2E', '#86D9FF', '#1FF0FF', '#2BF5A6'],
    bg: { type: 'color', color: '#000000', image: '', dim: 0.25, blur: 0 },
    styles: null,
    customEyes: { image: '', scale: 1, mirror: true, gap: 1 },
    customAcc: { image: '', x: 50, y: 20, scale: 30, rotate: 0 }
  };

  var STYLE_LIST = [
    { id: 'e_heart', name: '爱心眼' },
    { id: 'e_star', name: '星星眼' },
    { id: 'e_spark', name: '闪光眼' },
    { id: 'e_swirl', name: '漩涡眼' },
    { id: 'e_cross', name: '晕晕眼' },
    { id: 'e_happy', name: '弯弯眼' },
    { id: 'e_sleepy', name: '困困眼' },
    { id: 'e_round', name: '圆豆眼' },
    { id: 'e_dot', name: '小豆眼' },
    { id: 'e_sakura', name: '樱花眼' },
    { id: 'e_snow', name: '雪花眼' },
    { id: 'e_pumpkin', name: '南瓜眼' },
    { id: 'e_x0', name: '原版 #0' },
    { id: 'e_x2', name: '原版 #2' },
    { id: 'e_x4', name: '原版 #4' },
    { id: 'e_x6', name: '原版 #6' },
    { id: 'e_x8', name: '原版 #8' },
    { id: 'e_x10', name: '原版 #10' },
    { id: 'e_x14', name: '原版 #14' },
    { id: 'e_x17', name: '原版 #17' },
    { id: 'e_x24', name: '原版 #24' }
  ];

  var SOUND_DEFS = [
    { key: 'poke', name: '戳一戳' },
    { key: 'pop', name: '双击/啵' },
    { key: 'wall', name: '撞到边缘' },
    { key: 'giggle', name: '被挠笑' },
    { key: 'yawn', name: '打哈欠' },
    { key: 'dizzy', name: '摔晕' }
  ];

  var ACC_LIST = [
    { key: 'blush', name: '腮红' },
    { key: 'ahoge', name: '呆毛' },
    { key: 'nightcap', name: '睡帽' },
    { key: 'scarf', name: '小围巾' },
    { key: 'beret', name: '贝雷帽' },
    { key: 'flower', name: '小花' },
    { key: 'headphones', name: '耳机' },
    { key: 'glasses', name: '圆眼镜' },
    { key: 'crown', name: '小皇冠' },
    { key: 'catEars', name: '猫耳' },
    { key: 'halo', name: '光环' },
    { key: 'bow', name: '蝴蝶结' }
  ];

  var $ = function (id) { return document.getElementById(id); };

  var el = {
    iframe: $('preview'),
    stage: document.querySelector('.preview-stage'),
    connDot: $('connDot'),
    connText: $('connText'),
    pageUrl: $('pageUrl'),
    ballScale: $('ballScale'), ballScaleOut: $('ballScaleOut'), ballScaleNum: $('ballScaleNum'),
    speed: $('speed'), speedOut: $('speedOut'), speedNum: $('speedNum'),
    glow: $('glow'), glowOut: $('glowOut'), glowNum: $('glowNum'),
    faceMin: $('faceMin'), faceMax: $('faceMax'),
    palette: $('palette'), addColor: $('addColor'),
    styles: $('styles'),
    allStyles: $('allStyles'), clearStyles: $('clearStyles'),
    eyeFile: $('eyeFile'), clearEyes: $('clearEyes'),
    eyePreview: $('eyePreview'), eyeThumb: $('eyeThumb'), eyeName: $('eyeName'),
    eyeScale: $('eyeScale'), eyeScaleOut: $('eyeScaleOut'), eyeScaleNum: $('eyeScaleNum'),
    eyeGap: $('eyeGap'), eyeGapOut: $('eyeGapOut'), eyeGapNum: $('eyeGapNum'), eyeMirror: $('eyeMirror'),
    bgColor: $('bgColor'), bgFile: $('bgFile'), clearBg: $('clearBg'),
    bgPreview: $('bgPreview'), bgThumb: $('bgThumb'), bgName: $('bgName'),
    bgDim: $('bgDim'), bgDimOut: $('bgDimOut'), bgDimNum: $('bgDimNum'),
    bgBlur: $('bgBlur'), bgBlurOut: $('bgBlurOut'), bgBlurNum: $('bgBlurNum'),
    balls: $('balls'), ballsOut: $('ballsOut'), ballsNum: $('ballsNum'),
    petName: $('petName'),
    soundOn: $('soundOn'), soundVolume: $('soundVolume'), soundVolumeOut: $('soundVolumeOut'), soundVolumeNum: $('soundVolumeNum'), soundList: $('soundList'),
    bubblesOn: $('bubblesOn'), bubbleMin: $('bubbleMin'), bubbleMax: $('bubbleMax'),
    accessories: $('accessories'),
    accUpload: $('accUpload'), accRemove: $('accRemove'), accFile: $('accFile'),
    accX: $('accX'), accXOut: $('accXOut'), accXNum: $('accXNum'),
    accY: $('accY'), accYOut: $('accYOut'), accYNum: $('accYNum'),
    accScale: $('accScale'), accScaleOut: $('accScaleOut'), accScaleNum: $('accScaleNum'),
    accRotate: $('accRotate'), accRotateOut: $('accRotateOut'), accRotateNum: $('accRotateNum'),
    accState: $('accState'),
    nightOn: $('nightOn'), nightStart: $('nightStart'), nightEnd: $('nightEnd'), nightBright: $('nightBright'),
    nightTimes: $('nightTimes'),
    batteryOn: $('batteryOn'), idleSleepOn: $('idleSleepOn'), idleAfter: $('idleAfter'), idleAfterOut: $('idleAfterOut'), idleAfterNum: $('idleAfterNum'),
    sensorOn: $('sensorOn'),
    burnInOn: $('burnInOn'),
    widgetOn: $('widgetOn'),
    themes: $('themes'), copyCode: $('copyCode'), importCode: $('importCode'),
    postcard: $('postcard'), exportCfg: $('exportCfg'), importCfg: $('importCfg'), importFile: $('importFile'),
    shareState: $('shareState'),
    undoBtn: $('undoBtn'), noneStyles: $('noneStyles'),
    saveBtn: $('saveBtn'), resetBtn: $('resetBtn'), saveState: $('saveState')
  };

  var state = {
    cfg: clone(DEFAULTS),
    iframeReady: false,
    saveTimer: 0,
    saving: false,
    pendingSave: false,
    lastSaved: 0,
    undoStack: [],
    invalidStyles: false,
    lastSent: null,
    lastUndoAt: 0,
    savedAt: 0
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  function num(v, def, a, b) {
    var n = parseFloat(v);
    return isFinite(n) ? clamp(n, a, b) : def;
  }

  function normalizeHex(v) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(v || '').trim());
    return m ? '#' + m[1].toUpperCase() : null;
  }

  function merge(raw) {
    var out = clone(DEFAULTS);
    if (!raw || typeof raw !== 'object') return out;
    out.ballScale = num(raw.ballScale, out.ballScale, 0.28, 0.80);
    out.faceMin = num(raw.faceMin, out.faceMin, 5000, 300000);
    out.faceMax = num(raw.faceMax, out.faceMax, out.faceMin, 600000);
    if (out.faceMax < out.faceMin) { var t = out.faceMin; out.faceMin = out.faceMax; out.faceMax = t; }
    out.speed = num(raw.speed, out.speed, 0, 99);
    out.glow = num(raw.glow, out.glow, 0, 3);
    out.balls = Math.round(num(raw.balls, out.balls, 1, 20));
    out.name = typeof raw.name === 'string' ? raw.name.replace(/[<>]/g, '').slice(0, 18) : '';
    out.sound = raw.sound !== false;
    out.soundVolume = num(raw.soundVolume, out.soundVolume, 0, 1);
    if (raw.sounds && typeof raw.sounds === 'object') {
      var soundKeys = ['poke', 'pop', 'wall', 'yawn', 'dizzy', 'giggle'];
      for (var ski = 0; ski < soundKeys.length; ski++) {
        var sv = raw.sounds[soundKeys[ski]];
        if (typeof sv === 'string' && (sv === '' || sv.indexOf('/media/') === 0)) {
          out.sounds[soundKeys[ski]] = sv;
        }
      }
    }
    if (raw.bubbles && typeof raw.bubbles === 'object') {
      out.bubbles.enabled = raw.bubbles.enabled === true;
      out.bubbles.minMin = num(raw.bubbles.minMin, out.bubbles.minMin, 1, 120);
      out.bubbles.maxMin = Math.max(out.bubbles.minMin, num(raw.bubbles.maxMin, out.bubbles.maxMin, 2, 240));
    }
    if (raw.night && typeof raw.night === 'object') {
      out.night.enabled = raw.night.enabled !== false;
      out.night.start = Math.round(num(raw.night.start, out.night.start, 0, 23));
      out.night.end = Math.round(num(raw.night.end, out.night.end, 0, 23));
      out.night.brightness = num(raw.night.brightness, out.night.brightness, 0.05, 0.5);
    }
    if (raw.battery && typeof raw.battery === 'object') out.battery.enabled = raw.battery.enabled !== false;
    if (raw.idleSleep && typeof raw.idleSleep === 'object') {
      out.idleSleep.enabled = raw.idleSleep.enabled !== false;
      out.idleSleep.afterMin = num(raw.idleSleep.afterMin, out.idleSleep.afterMin, 1, 1440);
    }
    if (raw.sensor && typeof raw.sensor === 'object') out.sensor.enabled = raw.sensor.enabled !== false;
    if (raw.burnIn && typeof raw.burnIn === 'object') {
      out.burnIn.enabled = raw.burnIn.enabled !== false;
      out.burnIn.intervalSec = Math.round(num(raw.burnIn.intervalSec, out.burnIn.intervalSec, 30, 600));
      out.burnIn.shift = Math.round(num(raw.burnIn.shift, out.burnIn.shift, 2, 12));
    }
    if (raw.widget && typeof raw.widget === 'object') {
      out.widget.enabled = raw.widget.enabled === true;
      out.widget.time = raw.widget.time !== false;
      out.widget.date = raw.widget.date !== false;
      out.widget.battery = raw.widget.battery !== false;
    }
    if (Array.isArray(raw.accessories)) {
      out.accessories = raw.accessories.filter(function (x) {
        return ACC_LIST.some(function (a) { return a.key === x; });
      });
    }
    if (raw.customAcc && typeof raw.customAcc === 'object') {
      out.customAcc.image = typeof raw.customAcc.image === 'string' ? raw.customAcc.image : '';
      out.customAcc.x = num(raw.customAcc.x, out.customAcc.x, 0, 100);
      out.customAcc.y = num(raw.customAcc.y, out.customAcc.y, 0, 100);
      out.customAcc.scale = num(raw.customAcc.scale, out.customAcc.scale, 5, 100);
      out.customAcc.rotate = num(raw.customAcc.rotate, out.customAcc.rotate, -180, 180);
    }
    if (raw.palette && raw.palette.length) {
      var p = [];
      for (var i = 0; i < raw.palette.length && p.length < 8; i++) {
        var h = normalizeHex(raw.palette[i]);
        if (h) p.push(h);
      }
      if (p.length) out.palette = p;
    }
    if (raw.bg && typeof raw.bg === 'object') {
      out.bg.type = raw.bg.type === 'image' ? 'image' : 'color';
      out.bg.color = normalizeHex(raw.bg.color) || '#000000';
      out.bg.image = typeof raw.bg.image === 'string' ? raw.bg.image : '';
      out.bg.dim = num(raw.bg.dim, out.bg.dim, 0, 0.9);
      out.bg.blur = num(raw.bg.blur, out.bg.blur, 0, 20);
    }
    if (raw.styles && raw.styles.length) {
      var filtered = raw.styles.filter(function (x) {
        return typeof x === 'string' && STYLE_LIST.some(function (s) { return s.id === x; });
      });
      out.styles = filtered.length ? filtered : null;
    } else {
      out.styles = null;
    }
    if (raw.customEyes && typeof raw.customEyes === 'object') {
      out.customEyes.image = typeof raw.customEyes.image === 'string' ? raw.customEyes.image : '';
      out.customEyes.scale = num(raw.customEyes.scale, out.customEyes.scale, 0.4, 2.5);
      out.customEyes.gap = num(raw.customEyes.gap, out.customEyes.gap, 0.4, 2);
      out.customEyes.mirror = raw.customEyes.mirror !== false;
    }
    return out;
  }

  function media(path) {
    if (!path) return '';
    if (/^https?:/i.test(path)) return path;
    return path;
  }

  /* ---------------- 表单 ---------------- */

  function trimNum(v, digits) {
    var s = (+v).toFixed(digits);
    if (digits > 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return s;
  }

  function applyForm() {
    var c = state.cfg;
    el.ballScale.value = clamp(c.ballScale, 0.28, 0.8);
    el.ballScaleNum.value = Math.round(c.ballScale * 100);
    el.speed.value = clamp(c.speed, 0, 5);
    el.speedNum.value = c.speed;
    el.glow.value = clamp(c.glow, 0, 1.5);
    el.glowNum.value = c.glow;
    el.faceMin.value = Math.round(c.faceMin / 1000);
    el.faceMax.value = Math.round(c.faceMax / 1000);
    el.ballScaleOut.textContent = Math.round(c.ballScale * 100) + '%';
    el.speedOut.textContent = trimNum(c.speed, 2) + '×';
    el.glowOut.textContent = trimNum(c.glow, 2) + '×';
    el.balls.value = clamp(c.balls, 1, 10);
    el.ballsNum.value = c.balls;
    el.ballsOut.textContent = c.balls + ' 只';
    el.petName.value = c.name || '';
    el.soundOn.checked = c.sound !== false;
    el.soundVolume.value = c.soundVolume;
    el.soundVolumeNum.value = Math.round(c.soundVolume * 100);
    el.soundVolumeOut.textContent = Math.round(c.soundVolume * 100) + '%';
    el.bubblesOn.checked = c.bubbles.enabled;
    el.bubbleMin.value = c.bubbles.minMin;
    el.bubbleMax.value = c.bubbles.maxMin;
    el.nightOn.checked = c.night.enabled;
    el.nightStart.value = c.night.start;
    el.nightEnd.value = c.night.end;
    el.nightBright.value = c.night.brightness;
    el.batteryOn.checked = c.battery.enabled;
    el.idleSleepOn.checked = c.idleSleep.enabled;
    el.idleAfter.value = clamp(c.idleSleep.afterMin, 1, 30);
    el.idleAfterNum.value = c.idleSleep.afterMin;
    el.idleAfterOut.textContent = c.idleSleep.afterMin + ' 分钟';
    el.sensorOn.checked = c.sensor.enabled;
    el.burnInOn.checked = c.burnIn.enabled;
    el.widgetOn.checked = !!(c.widget && c.widget.enabled);
    el.nightTimes.style.opacity = c.night.enabled ? '1' : '0.45';
    renderAccessories();
    var ca = c.customAcc || DEFAULTS.customAcc;
    el.accX.value = clamp(ca.x, 0, 100);
    el.accXNum.value = ca.x;
    el.accXOut.textContent = Math.round(ca.x) + '%';
    el.accY.value = clamp(ca.y, 0, 100);
    el.accYNum.value = ca.y;
    el.accYOut.textContent = Math.round(ca.y) + '%';
    el.accScale.value = clamp(ca.scale, 5, 100);
    el.accScaleNum.value = ca.scale;
    el.accScaleOut.textContent = Math.round(ca.scale) + '%';
    el.accRotate.value = clamp(ca.rotate, -180, 180);
    el.accRotateNum.value = ca.rotate;
    el.accRotateOut.textContent = Math.round(ca.rotate) + '°';
    el.accState.textContent = ca.image ? '已上传自定义配饰：' + ca.image.split('/').pop() : '未上传自定义配饰';

    renderPalette();
    renderStyles();
    renderSounds();

    el.bgColor.value = c.bg.color || '#000000';
    el.bgDim.value = clamp(c.bg.dim, 0, 0.9);
    el.bgDimNum.value = Math.round(c.bg.dim * 100);
    el.bgBlur.value = clamp(c.bg.blur, 0, 20);
    el.bgBlurNum.value = Math.round(c.bg.blur);
    el.bgDimOut.textContent = Math.round(c.bg.dim * 100) + '%';
    el.bgBlurOut.textContent = Math.round(c.bg.blur) + 'px';
    el.bgPreview.hidden = !c.bg.image;
    if (c.bg.image) {
      el.bgThumb.src = media(c.bg.image);
      el.bgName.textContent = '背景图已上传';
    }

    el.eyePreview.hidden = !c.customEyes.image;
    if (c.customEyes.image) {
      el.eyeThumb.src = media(c.customEyes.image);
      el.eyeName.textContent = '自定义眼睛';
    }
    el.eyeScale.value = clamp(c.customEyes.scale, 0.4, 2.5);
    el.eyeScaleNum.value = c.customEyes.scale;
    el.eyeGap.value = clamp(c.customEyes.gap, 0.4, 2);
    el.eyeGapNum.value = c.customEyes.gap;
    el.eyeMirror.checked = c.customEyes.mirror !== false;
    el.eyeScaleOut.textContent = trimNum(c.customEyes.scale, 2) + '×';
    el.eyeGapOut.textContent = trimNum(c.customEyes.gap, 2) + '×';

    el.pageUrl.textContent = location.origin;
  }

  function renderAccessories() {
    el.accessories.innerHTML = '';
    ACC_LIST.forEach(function (a) {
      var label = document.createElement('label');
      label.className = 'check';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = a.key;
      cb.checked = (state.cfg.accessories || []).indexOf(a.key) >= 0;
      label.appendChild(cb);
      label.appendChild(document.createTextNode(' ' + a.name));
      el.accessories.appendChild(label);
    });
  }

  function renderPalette() {
    el.palette.innerHTML = '';
    state.cfg.palette.forEach(function (hex, idx) {
      el.palette.appendChild(colorRow(hex, idx));
    });
    el.addColor.disabled = state.cfg.palette.length >= 8;
  }

  function colorRow(hex, idx) {
    var row = document.createElement('div');
    row.className = 'color-row';

    var picker = document.createElement('input');
    picker.type = 'color';
    picker.value = hex;

    var text = document.createElement('input');
    text.type = 'text';
    text.value = hex;
    text.maxLength = 7;
    text.spellcheck = false;

    var del = document.createElement('button');
    del.type = 'button';
    del.textContent = '×';
    del.title = '删除这个颜色';

    picker.addEventListener('input', function () {
      text.value = picker.value.toUpperCase();
      state.cfg.palette[idx] = picker.value.toUpperCase();
      push();
    });
    text.addEventListener('change', function () {
      var h = normalizeHex(text.value);
      if (!h) { text.value = state.cfg.palette[idx]; return; }
      text.value = h;
      picker.value = h;
      state.cfg.palette[idx] = h;
      push();
    });
    del.addEventListener('click', function () {
      if (state.cfg.palette.length <= 1) return;
      state.cfg.palette.splice(idx, 1);
      renderPalette();
      push();
    });

    row.appendChild(picker);
    row.appendChild(text);
    row.appendChild(del);
    return row;
  }

  function renderSounds() {
    if (!el.soundList) return;
    el.soundList.innerHTML = '';
    SOUND_DEFS.forEach(function (def) {
      var path = state.cfg.sounds[def.key] || '';
      var row = document.createElement('div');
      row.className = 'sound-row';

      var name = document.createElement('span');
      name.className = 'sound-name';
      name.textContent = def.name;

      var file = document.createElement('span');
      file.className = 'sound-file' + (path ? ' has' : '');
      file.textContent = path ? decodeURIComponent(path.split('/').pop()) : '内置合成音';

      var actions = document.createElement('span');
      actions.className = 'sound-actions';

      var label = document.createElement('label');
      label.className = 'sound-pick';
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = 'audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/*,.mp3,.wav,.ogg,.m4a';
      input.addEventListener('change', function () {
        if (input.files && input.files[0]) uploadSound(def.key, input.files[0]);
        input.value = '';
      });
      var up = document.createElement('button');
      up.type = 'button';
      up.textContent = '上传';
      up.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); input.click(); });
      label.appendChild(input);
      label.appendChild(up);
      actions.appendChild(label);

      if (path) {
        var play = document.createElement('button');
        play.type = 'button';
        play.textContent = '试听';
        play.addEventListener('click', function () {
          try {
            var a = new Audio(path);
            a.volume = clamp(state.cfg.soundVolume, 0, 1);
            a.play();
          } catch (e) { /* 忽略 */ }
        });
        actions.appendChild(play);

        var del = document.createElement('button');
        del.type = 'button';
        del.className = 'danger';
        del.textContent = '移除';
        del.addEventListener('click', function () {
          state.cfg.sounds[def.key] = '';
          push();
          renderSounds();
        });
        actions.appendChild(del);
      }

      row.appendChild(name);
      row.appendChild(file);
      row.appendChild(actions);
      el.soundList.appendChild(row);
    });
  }

  function uploadSound(key, file) {
    if (file.size > 4 * 1024 * 1024) {
      alert('音频不能超过 4MB');
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      fetch('api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'sound', key: key, data: reader.result })
      }).then(function (r) { return r.json(); }).then(function (j) {
        if (!j.path) throw new Error(j.error || 'upload failed');
        state.cfg.sounds[key] = j.path;
        push();
        renderSounds();
      }).catch(function (err) {
        alert('上传失败：' + (err && err.message ? err.message : '未知错误'));
      });
    };
    reader.readAsDataURL(file);
  }

  function renderStyles() {
    if (el.styles.childElementCount === 0) {
      STYLE_LIST.forEach(function (s) {
        var label = document.createElement('label');
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = s.id;
        cb.addEventListener('change', function () {
          validateStyles();
          if (!state.invalidStyles) push();
        });
        var name = document.createElement('span');
        name.className = 'style-name';
        name.textContent = s.name;
        name.title = '单独预览这个眼型';
        name.addEventListener('click', function (ev) {
          ev.preventDefault();
          previewStyle(s.id);
        });
        label.appendChild(cb);
        label.appendChild(name);
        el.styles.appendChild(label);
      });
    }
    var chosen = state.cfg.styles && state.cfg.styles.length
      ? state.cfg.styles
      : STYLE_LIST.map(function (s) { return s.id; });
    STYLE_LIST.forEach(function (s) {
      var cb = el.styles.querySelector('input[value="' + s.id + '"]');
      if (cb) cb.checked = chosen.indexOf(s.id) >= 0;
    });
    validateStyles();
  }

  function validateStyles() {
    var n = checkedStyles().length;
    state.invalidStyles = n === 0;
    el.styles.classList.toggle('invalid', state.invalidStyles);
    if (state.invalidStyles) {
      clearTimeout(state.saveTimer);
      setState('至少选一种眼型才能同步', 'warn');
    } else if (el.saveState.classList.contains('warn')) {
      setState('自动保存已开启', '');
    }
    el.saveBtn.disabled = state.invalidStyles;
  }

  function previewStyle(id) {
    if (!state.iframeReady || !el.iframe.contentWindow) return;
    try {
      el.iframe.contentWindow.postMessage({ type: 'eb-preview-style', id: id }, '*');
      el.previewNote.textContent = '正在单独预览：' + id.replace('e_', '');
      setTimeout(function () { el.previewNote.textContent = '和手机端同一套渲染'; }, 3000);
    } catch (e) { /* 忽略 */ }
  }

  function checkedStyles() {
    return Array.prototype.slice.call(el.styles.querySelectorAll('input:checked'))
      .map(function (x) { return x.value; });
  }

  function readForm() {
    var c = clone(state.cfg);
    c.ballScale = clamp(num(el.ballScaleNum.value, el.ballScale.value * 100, 1, 80), 1, 80) / 100;
    c.speed = num(el.speedNum.value, el.speed.value, 0, 99);
    c.glow = num(el.glowNum.value, el.glow.value, 0, 3);
    c.faceMin = clamp(num(el.faceMin.value, c.faceMin / 1000, 5, 300) * 1000, 5000, 300000);
    c.faceMax = clamp(num(el.faceMax.value, c.faceMax / 1000, 5, 600) * 1000, c.faceMin, 600000);
    c.balls = Math.round(num(el.ballsNum.value, el.balls.value, 1, 20));
    c.name = (el.petName.value || '').replace(/[<>]/g, '').slice(0, 18);
    c.sound = el.soundOn.checked;
    c.soundVolume = clamp(num(el.soundVolumeNum.value, el.soundVolume.value * 100, 0, 100), 0, 100) / 100;
    c.bubbles.enabled = el.bubblesOn.checked;
    c.bubbles.minMin = clamp(num(el.bubbleMin.value, c.bubbles.minMin, 1, 120), 1, 120);
    c.bubbles.maxMin = Math.max(c.bubbles.minMin, clamp(num(el.bubbleMax.value, c.bubbles.maxMin, 2, 240), 2, 240));
    c.night.enabled = el.nightOn.checked;
    c.night.start = clamp(num(el.nightStart.value, c.night.start, 0, 23), 0, 23);
    c.night.end = clamp(num(el.nightEnd.value, c.night.end, 0, 23), 0, 23);
    c.night.brightness = clamp(num(el.nightBright.value, c.night.brightness, 0.05, 0.5), 0.05, 0.5);
    c.battery.enabled = el.batteryOn.checked;
    c.idleSleep.enabled = el.idleSleepOn.checked;
    c.idleSleep.afterMin = clamp(num(el.idleAfterNum.value, el.idleAfter.value, 1, 1440), 1, 1440);
    c.sensor.enabled = el.sensorOn.checked;
    c.burnIn.enabled = el.burnInOn.checked;
    c.widget.enabled = el.widgetOn.checked;
    c.accessories = Array.prototype.slice.call(el.accessories.querySelectorAll('input:checked')).map(function (x) { return x.value; });

    var p = [];
    Array.prototype.forEach.call(el.palette.querySelectorAll('.color-row input[type="text"]'), function (x) {
      var h = normalizeHex(x.value);
      if (h) p.push(h);
    });
    if (p.length) c.palette = p.slice(0, 8);

    var chosen = checkedStyles();
    c.styles = chosen.length === STYLE_LIST.length ? null : chosen;

    c.bg.color = normalizeHex(el.bgColor.value) || '#000000';
    c.bg.dim = clamp(num(el.bgDimNum.value, el.bgDim.value * 100, 0, 100), 0, 100) / 100;
    c.bg.blur = num(el.bgBlurNum.value, el.bgBlur.value, 0, 50);
    c.bg.type = c.bg.image ? 'image' : 'color';

    c.customEyes.scale = num(el.eyeScaleNum.value, el.eyeScale.value, 0.1, 3);
    c.customEyes.gap = num(el.eyeGapNum.value, el.eyeGap.value, 0.1, 3);
    c.customEyes.mirror = el.eyeMirror.checked;

    c.customAcc.x = clamp(num(el.accXNum.value, el.accX.value, 0, 100), 0, 100);
    c.customAcc.y = clamp(num(el.accYNum.value, el.accY.value, 0, 100), 0, 100);
    c.customAcc.scale = clamp(num(el.accScaleNum.value, el.accScale.value, 5, 100), 5, 100);
    c.customAcc.rotate = clamp(num(el.accRotateNum.value, el.accRotate.value, -180, 180), -180, 180);

    return c;
  }

  function updateOutputs() {
    el.ballScaleOut.textContent = Math.round(state.cfg.ballScale * 100) + '%';
    el.speedOut.textContent = trimNum(state.cfg.speed, 2) + '×';
    el.glowOut.textContent = trimNum(state.cfg.glow, 2) + '×';
    el.bgDimOut.textContent = Math.round(state.cfg.bg.dim * 100) + '%';
    el.bgBlurOut.textContent = Math.round(state.cfg.bg.blur) + 'px';
    el.eyeScaleOut.textContent = trimNum(state.cfg.customEyes.scale, 2) + '×';
    el.eyeGapOut.textContent = trimNum(state.cfg.customEyes.gap, 2) + '×';
    el.ballsOut.textContent = state.cfg.balls + ' 只';
    el.idleAfterOut.textContent = state.cfg.idleSleep.afterMin + ' 分钟';
  }

  /* ---------------- 预览 / 保存 ---------------- */

  function sendPreview() {
    if (!state.iframeReady || !el.iframe.contentWindow) return;
    try {
      el.iframe.contentWindow.postMessage({ type: 'eb-config', config: state.cfg }, '*');
    } catch (e) { /* 忽略 */ }
  }

  function push() {
    var next = readForm();
    if (next.styles && next.styles.length === 0) {
      state.invalidStyles = true;
      el.styles.classList.add('invalid');
      setState('至少选一种眼型才能同步', 'warn');
      el.saveBtn.disabled = true;
      return;
    }
    if (!state.invalidStyles) {
      var prev = JSON.stringify(state.cfg);
      var nxt = JSON.stringify(next);
      var t = Date.now();
      if (prev !== nxt && t - state.lastUndoAt > 700) {
        state.undoStack.push(clone(state.cfg));
        if (state.undoStack.length > 40) state.undoStack.shift();
      }
      if (prev !== nxt) state.lastUndoAt = t;
    }
    state.invalidStyles = false;
    el.styles.classList.remove('invalid');
    el.saveBtn.disabled = false;
    state.cfg = next;
    updateOutputs();
    sendPreview();
    scheduleSave();
  }

  function undo() {
    if (!state.undoStack.length) {
      setState('没有可撤销的修改', 'warn');
      return;
    }
    state.cfg = state.undoStack.pop();
    applyForm();
    validateStyles();
    sendPreview();
    save();
    setState('已撤销上一步', 'ok');
  }

  function scheduleSave() {
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(function () { save(); }, 320);
  }

  function setState(text, cls) {
    el.saveState.textContent = text;
    el.saveState.className = 'save-state' + (cls ? ' ' + cls : '');
  }

  function save() {
    clearTimeout(state.saveTimer);
    if (state.invalidStyles) {
      setState('至少选一种眼型才能同步', 'warn');
      return;
    }
    if (state.saving) { state.pendingSave = true; return; }
    state.saving = true;
    setState('同步中…', '');
    fetch('api/config', { cache: 'no-store' })
      .then(function (res) { return res.json(); })
      .then(function (cur) {
        if (state.savedAt && cur._savedAt && cur._savedAt !== state.savedAt) {
          state.pendingSave = false;
          clearTimeout(state.saveTimer);
          setState('另一个页面刚改过，请刷新后再改', 'warn');
          el.connDot.className = 'dot warn';
          el.connText.textContent = '有冲突';
          return null;
        }
        return fetch('api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(state.cfg)
        }).then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        }).then(function (saved) {
          state.savedAt = saved._savedAt || state.savedAt;
          state.lastSaved = Date.now();
          setState('已同步到手机', 'ok');
          el.connDot.className = 'dot on';
          el.connText.textContent = '已连接';
        });
      }).catch(function (err) {
        setState('保存失败：' + err.message, 'err');
        el.connDot.className = 'dot err';
        el.connText.textContent = '连接异常';
      }).then(function () {
        state.saving = false;
        if (state.pendingSave) {
          state.pendingSave = false;
          scheduleSave();
        }
      });
  }

  /* ---------------- 上传 ---------------- */

  function processImage(file, maxW, maxH, mime) {
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type)) { reject(new Error('请选择图片文件')); return; }
      var fr = new FileReader();
      fr.onerror = function () { reject(new Error('读取文件失败')); };
      fr.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('图片解码失败')); };
        img.onload = function () {
          var scale = Math.min(1, maxW / img.width, maxH / img.height);
          var w = Math.max(1, Math.round(img.width * scale));
          var h = Math.max(1, Math.round(img.height * scale));
          var cv = document.createElement('canvas');
          cv.width = w;
          cv.height = h;
          var g = cv.getContext('2d');
          if (mime === 'image/jpeg') {
            g.fillStyle = '#000';
            g.fillRect(0, 0, w, h);
          }
          g.drawImage(img, 0, 0, w, h);
          resolve(cv.toDataURL(mime, 0.88));
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  function upload(kind, file, maxW, maxH) {
    var mime = (kind === 'eyes' || kind === 'acc') ? 'image/png' : 'image/jpeg';
    setState('处理图片…', '');
    processImage(file, maxW, maxH, mime).then(function (dataUrl) {
      setState('上传中…', '');
      return fetch('api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: kind, data: dataUrl })
      });
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function (out) {
      if (kind === 'eyes') {
        state.cfg.customEyes.image = out.path;
      } else if (kind === 'acc') {
        state.cfg.customAcc.image = out.path;
      } else {
        state.cfg.bg.image = out.path;
        state.cfg.bg.type = 'image';
      }
      applyForm();
      state.cfg = readForm();
      sendPreview();
      save();
    }).catch(function (err) {
      setState('上传失败：' + err.message, 'err');
    });
  }

  /* ---------------- 事件 ---------------- */

  function bindRange(id, out, digits, suffix) {
    var input = $(id);
    input.addEventListener('input', function () {
      if (out) {
        var s = (+input.value).toFixed(digits);
        if (digits > 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
        out.textContent = s + suffix;
      }
      var n = $(id + 'Num');
      if (n) n.value = '';
      push();
    });
  }

  bindRange('speed', el.speedOut, 2, '×');
  bindRange('glow', el.glowOut, 2, '×');
  bindRange('eyeScale', el.eyeScaleOut, 2, '×');
  bindRange('eyeGap', el.eyeGapOut, 2, '×');
  bindRange('idleAfter', el.idleAfterOut, 0, ' 分钟');

  function bindNum(numId, slider, hardMin, hardMax, sliderMax, factor, suffix, digits) {
    var n = $(numId);
    if (!n) return;
    function apply() {
      if (n.value === '') return;
      var v = parseFloat(n.value);
      if (!isFinite(v)) return;
      v = clamp(v, hardMin, hardMax);
      slider.value = Math.min(v, sliderMax) / factor;
      if (digits === 0) n.value = Math.round(v);
      var out = $(slider.id + 'Out');
      if (out) out.textContent = trimNum(v, digits) + suffix;
      push();
    }
    n.addEventListener('input', apply);
    n.addEventListener('blur', function () {
      if (n.value === '') return;
      var v = clamp(parseFloat(n.value) || 0, hardMin, hardMax);
      n.value = digits === 0 ? Math.round(v) : trimNum(v, digits);
      apply();
    });
  }

  bindNum('ballScaleNum', el.ballScale, 1, 80, 80, 100, '%', 0);
  bindNum('speedNum', el.speed, 0, 99, 5, 1, '×', 2);
  bindNum('glowNum', el.glow, 0, 3, 1.5, 1, '×', 2);
  bindNum('ballsNum', el.balls, 1, 20, 10, 1, ' 只', 0);
  bindNum('soundVolumeNum', el.soundVolume, 0, 100, 100, 100, '%', 0);
  bindNum('bgDimNum', el.bgDim, 0, 100, 90, 100, '%', 0);
  bindNum('bgBlurNum', el.bgBlur, 0, 50, 20, 1, 'px', 0);
  bindNum('eyeScaleNum', el.eyeScale, 0.1, 3, 2.5, 1, '×', 2);
  bindNum('eyeGapNum', el.eyeGap, 0.1, 3, 2, 1, '×', 2);
  bindNum('idleAfterNum', el.idleAfter, 1, 1440, 30, 1, ' 分钟', 0);
  el.soundVolume.addEventListener('input', function () {
    el.soundVolumeOut.textContent = Math.round(+el.soundVolume.value * 100) + '%';
    el.soundVolumeNum.value = '';
    push();
  });

  el.balls.addEventListener('input', function () {
    el.ballsOut.textContent = el.balls.value + ' 只';
    el.ballsNum.value = '';
    push();
  });
  el.petName.addEventListener('input', function () {
    clearTimeout(state.nameTimer);
    state.nameTimer = setTimeout(push, 260);
  });
  el.soundOn.addEventListener('change', push);
  el.bubblesOn.addEventListener('change', push);
  el.nightOn.addEventListener('change', function () {
    el.nightTimes.style.opacity = el.nightOn.checked ? '1' : '0.45';
    push();
  });
  el.batteryOn.addEventListener('change', push);
  el.idleSleepOn.addEventListener('change', push);
  el.sensorOn.addEventListener('change', push);
  el.burnInOn.addEventListener('change', push);
  el.widgetOn.addEventListener('change', push);
  [el.nightStart, el.nightEnd, el.nightBright].forEach(function (x) { x.addEventListener('change', push); });
  [el.bubbleMin, el.bubbleMax].forEach(function (x) { x.addEventListener('change', push); });
  el.accessories.addEventListener('change', function (e) {
    if (e.target && e.target.tagName === 'INPUT') push();
  });

  bindRange('accX', el.accXOut, 0, '%');
  bindRange('accY', el.accYOut, 0, '%');
  bindRange('accScale', el.accScaleOut, 0, '%');
  bindRange('accRotate', el.accRotateOut, 0, '°');
  bindNum('accXNum', el.accX, 0, 100, 100, 1, '%', 0);
  bindNum('accYNum', el.accY, 0, 100, 100, 1, '%', 0);
  bindNum('accScaleNum', el.accScale, 5, 100, 100, 1, '%', 0);
  bindNum('accRotateNum', el.accRotate, -180, 180, 180, 1, '°', 0);

  el.accUpload.addEventListener('click', function () { el.accFile.click(); });
  el.accFile.addEventListener('change', function () {
    var f = el.accFile.files && el.accFile.files[0];
    el.accFile.value = '';
    if (f) upload('acc', f, 512, 512);
  });
  el.accRemove.addEventListener('click', function () {
    state.cfg.customAcc.image = '';
    applyForm();
    save();
  });

  el.ballScale.addEventListener('input', function () {
    el.ballScaleOut.textContent = Math.round(el.ballScale.value * 100) + '%';
    el.ballScaleNum.value = '';
    push();
  });
  el.bgDim.addEventListener('input', function () {
    el.bgDimOut.textContent = Math.round(el.bgDim.value * 100) + '%';
    el.bgDimNum.value = '';
    push();
  });
  el.bgBlur.addEventListener('input', function () {
    el.bgBlurOut.textContent = Math.round(el.bgBlur.value) + 'px';
    el.bgBlurNum.value = '';
    push();
  });

  [el.faceMin, el.faceMax].forEach(function (x) {
    x.addEventListener('change', function () {
      if (+el.faceMin.value > +el.faceMax.value) {
        el.faceMax.value = el.faceMin.value;
      }
      push();
    });
  });

  el.bgColor.addEventListener('input', function () {
    state.cfg.bg.color = el.bgColor.value.toUpperCase();
    push();
  });

  el.addColor.addEventListener('click', function () {
    if (state.cfg.palette.length >= 8) return;
    state.cfg = readForm();
    var preset = ['#FFAE2E', '#86D9FF', '#1FF0FF', '#2BF5A6', '#FF6B9A', '#B388FF', '#FFD166', '#7CFFB2'];
    var next = preset[state.cfg.palette.length % preset.length];
    state.cfg.palette.push(next);
    renderPalette();
    push();
  });

  el.allStyles.addEventListener('click', function () {
    STYLE_LIST.forEach(function (s) {
      el.styles.querySelector('input[value="' + s.id + '"]').checked = true;
    });
    validateStyles();
    push();
  });

  el.noneStyles.addEventListener('click', function () {
    Array.prototype.forEach.call(el.styles.querySelectorAll('input'), function (x) {
      x.checked = false;
    });
    validateStyles();
  });

  el.undoBtn.addEventListener('click', undo);

  el.eyeFile.addEventListener('change', function () {
    if (el.eyeFile.files && el.eyeFile.files[0]) {
      upload('eyes', el.eyeFile.files[0], 512, 512);
    }
    el.eyeFile.value = '';
  });

  el.bgFile.addEventListener('change', function () {
    if (el.bgFile.files && el.bgFile.files[0]) {
      upload('bg', el.bgFile.files[0], 1920, 1080);
    }
    el.bgFile.value = '';
  });

  el.clearEyes.addEventListener('click', function () {
    state.cfg = readForm();
    state.cfg.customEyes.image = '';
    applyForm();
    push();
  });

  el.clearBg.addEventListener('click', function () {
    state.cfg = readForm();
    state.cfg.bg.image = '';
    state.cfg.bg.type = 'color';
    applyForm();
    push();
  });

  el.saveBtn.addEventListener('click', function () { save(); });

  /* ---------------- 主题 / 分享 / 明信片 ---------------- */

  var THEMES = [
    { name: '琥珀夜', palette: ['#FFAE2E', '#FF7A1A', '#FFD166'], bg: '#050403', accessories: ['blush'], ballScale: 0.60, glow: 1.0 },
    { name: '冰蓝实验室', palette: ['#86D9FF', '#1FF0FF', '#B388FF'], bg: '#01050A', accessories: ['ahoge'], ballScale: 0.58, glow: 1.2 },
    { name: '森林精灵', palette: ['#2BF5A6', '#7CFFB2', '#FFD166'], bg: '#020604', accessories: ['scarf'], ballScale: 0.62, glow: 0.9 },
    { name: '樱花季', palette: ['#FF9EB5', '#FFD1DC', '#FF6B9A'], bg: '#0A0306', accessories: ['blush'], ballScale: 0.64, glow: 1.1, styles: ['e_sakura', 'e_heart', 'e_happy', 'e_star'] },
    { name: '赛博', palette: ['#FF2D55', '#1FF0FF', '#B388FF'], bg: '#000000', accessories: [], ballScale: 0.66, glow: 1.4, styles: ['e_x0', 'e_x2', 'e_x10', 'e_spark'] },
    { name: '奶油糖', palette: ['#FFE3A3', '#FFC2D1', '#B8E0D2'], bg: '#0B0906', accessories: ['nightcap'], ballScale: 0.60, glow: 0.8 }
  ];

  function renderThemes() {
    el.themes.innerHTML = '';
    THEMES.forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'theme-chip';
      b.textContent = t.name;
      b.addEventListener('click', function () {
        state.cfg.palette = t.palette.slice();
        state.cfg.bg.type = 'color';
        state.cfg.bg.color = t.bg;
        state.cfg.bg.image = '';
        state.cfg.accessories = (t.accessories || []).slice();
        state.cfg.ballScale = t.ballScale;
        state.cfg.glow = t.glow;
        state.cfg.styles = t.styles ? t.styles.slice() : null;
        applyForm();
        push();
        save();
      });
      el.themes.appendChild(b);
    });
  }

  el.copyCode.addEventListener('click', function () {
    try {
      var code = btoa(unescape(encodeURIComponent(JSON.stringify(readForm()))));
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code);
      } else {
        window.prompt('复制这段主题码：', code);
      }
      setState('主题码已复制', 'ok');
    } catch (e) {
      setState('生成主题码失败', 'err');
    }
  });

  el.importCode.addEventListener('click', function () {
    var code = window.prompt('粘贴主题码：');
    if (!code) return;
    try {
      var raw = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
      state.cfg = merge(raw);
      applyForm();
      push();
      save();
      setState('主题码已导入', 'ok');
    } catch (e) {
      setState('主题码格式不对', 'err');
    }
  });

  el.postcard.addEventListener('click', function () {
    setState('正在生成明信片…', '');
    fetch('api/snapshot', { method: 'POST' })
      .then(function (res) { return res.json(); })
      .then(function (out) {
        if (!out || !out.path) throw new Error('手机没有返回图片');
        el.shareState.innerHTML = '明信片已生成：<a href="' + out.path + '" target="_blank" rel="noopener">打开 / 下载</a>';
        setState('明信片已生成', 'ok');
      })
      .catch(function (err) { setState('生成失败：' + err.message, 'err'); });
  });

  window.addEventListener('message', function (ev) {
    var d = ev.data;
    if (!d || d.type !== 'eb-snapshot-done') return;
    if (!d.path) return;
    el.shareState.innerHTML = '明信片已生成：<a href="' + d.path + '" target="_blank" rel="noopener">打开 / 下载</a>';
    setState('明信片已生成', 'ok');
  });

  el.exportCfg.addEventListener('click', function () {
    setState('正在打包配置…', '');
    fetch('api/export', { cache: 'no-store' })
      .then(function (res) { return res.json(); })
      .then(function (bundle) {
        var text = JSON.stringify(bundle);
        var blob = new Blob([text], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'yuanbing-config.json';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
          URL.revokeObjectURL(a.href);
          document.body.removeChild(a);
        }, 800);
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text);
          }
        } catch (e) { /* 忽略 */ }
        setState('配置已导出（含已上传图片/音效）', 'ok');
      })
      .catch(function (err) { setState('导出失败：' + err.message, 'err'); });
  });

  el.importCfg.addEventListener('click', function () { el.importFile.click(); });
  el.importFile.addEventListener('change', function () {
    var f = el.importFile.files && el.importFile.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function () {
      setState('正在导入…', '');
      fetch('api/import', { method: 'POST', body: String(reader.result) })
        .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
        .then(function () {
          setState('导入成功，正在刷新…', 'ok');
          setTimeout(function () { location.reload(); }, 500);
        })
        .catch(function (err) { setState('导入失败：' + err.message, 'err'); });
    };
    reader.readAsText(f);
  });

  el.resetBtn.addEventListener('click', function () {
    if (!confirm('恢复默认设置？颜色、大小、配饰、作息和自定义图片都会回到默认。')) return;
    state.undoStack = [];
    state.cfg = clone(DEFAULTS);
    applyForm();
    push();
    save();
  });

  el.iframe.addEventListener('load', function () {
    state.iframeReady = true;
    sendPreview();
  });

  /* ---------------- 启动 ---------------- */

  function load() {
    fetch('api/info', { cache: 'no-store' })
      .then(function (res) { return res.json(); })
      .then(function (info) {
        if (!info || !info.w || !info.h) return;
        var a = Math.max(info.w, info.h);
        var b = Math.min(info.w, info.h);
        if (el.stage) {
          if (window.CSS && CSS.supports && CSS.supports('aspect-ratio', '16 / 9')) {
            el.stage.style.aspectRatio = a + ' / ' + b;
            el.stage.style.paddingTop = '0';
            el.stage.style.height = 'auto';
          } else {
            /* 老 WebView 不支持 aspect-ratio，用 padding 撑高度 */
            el.stage.style.height = '0';
            el.stage.style.paddingTop = (b / a * 100).toFixed(3) + '%';
          }
        }
      })
      .catch(function () { /* 保持默认 16:9 */ });

    fetch('api/config', { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (raw) {
        state.savedAt = raw._savedAt || 0;
        state.cfg = merge(raw);
        el.connDot.className = 'dot on';
        el.connText.textContent = '已连接';
        applyForm();
        sendPreview();
        setState('自动保存已开启', '');
      })
      .catch(function (err) {
        el.connDot.className = 'dot err';
        el.connText.textContent = '连接异常';
        setState('读取配置失败：' + err.message, 'err');
        applyForm();
        sendPreview();
      });
  }

  renderThemes();
  applyForm();
  load();
})();
