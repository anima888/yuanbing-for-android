/* ============================================================
 * eyes.js —— 额外眼型（爱心 / 星星 / 闪光 / 漩涡 / 晕晕 / 弯弯 / 困困 / 圆豆 / 小豆）
 *
 * 原版 rings.js 里有 25 组眼环。这里再生成一组 48 点轮廓，
 * 追加进 EB_RINGS.EXPRESSIONS，然后以「单眼环表情」的方式注册给引擎。
 * 追加必须发生在 engine.js 读取 EXPRESSIONS 之后、注册表情之前。
 * ============================================================ */
(function () {
  'use strict';

  var R = window.EB_RINGS;
  if (!R || !R.EXPRESSIONS) return;
  var EXPR = R.EXPRESSIONS;
  var C = R.HEAD_C;
  var TAU = Math.PI * 2;

  /* 左右眼中心：对称放在脸中线两侧，略高于中线 */
  var EYE_L = [C - 38, C - 4];
  var EYE_R = [C + 38, C - 4];

  function resample(pts, n) {
    var segs = [], total = 0, i;
    for (i = 0; i < pts.length; i++) {
      var a = pts[i], b = pts[(i + 1) % pts.length];
      var d = Math.sqrt((b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1]));
      segs.push(d);
      total += d;
    }
    var out = [], step = total / n, acc = 0, si = 0;
    for (i = 0; i < n; i++) {
      var target = i * step;
      while (si < segs.length - 1 && acc + segs[si] < target) {
        acc += segs[si];
        si++;
      }
      var u = segs[si] ? (target - acc) / segs[si] : 0;
      var p = pts[si], q = pts[(si + 1) % pts.length];
      out.push([p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u]);
    }
    return out;
  }

  /* 把轮廓的质心挪到指定中心，保证眼睛落在预期位置 */
  function recenter(pts, cx, cy) {
    var x = 0, y = 0, i;
    for (i = 0; i < pts.length; i++) { x += pts[i][0]; y += pts[i][1]; }
    x = cx - x / pts.length;
    y = cy - y / pts.length;
    var out = [];
    for (i = 0; i < pts.length; i++) out.push([pts[i][0] + x, pts[i][1] + y]);
    return out;
  }

  /* ---- 各种眼型：返回 48 点闭合轮廓 ---- */

  function heart(cx, cy, flip) {
    var pts = [];
    for (var i = 0; i < 120; i++) {
      var t = (i / 120) * TAU;
      var x = 16 * Math.pow(Math.sin(t), 3);
      var y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
      pts.push([cx + flip * x * 1.55, cy + y * 1.55]);
    }
    return recenter(resample(pts, 48), cx, cy);
  }

  function star(cx, cy, flip) {
    var pts = [], i;
    for (i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 5;
      var r = i % 2 ? 9.5 : 24;
      pts.push([cx + flip * Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return recenter(resample(pts, 48), cx, cy);
  }

  function spark(cx, cy, flip) {
    var pts = [], i;
    for (i = 0; i < 8; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 4;
      var r = i % 2 ? 6.5 : 24;
      pts.push([cx + flip * Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return recenter(resample(pts, 48), cx, cy);
  }

  function swirl(cx, cy, flip) {
    var outer = [], inner = [], i, M = 23;
    var turns = 2.35, r0 = 5, rmax = 24;
    for (i = 0; i <= M; i++) {
      var t = (i / M) * turns * TAU;
      var r = r0 + (rmax - r0) * (i / M);
      outer.push([cx + flip * Math.cos(t) * r, cy + Math.sin(t) * r]);
    }
    for (i = M; i >= 0; i--) {
      var t2 = (i / M) * turns * TAU;
      var r2 = Math.max(1.5, r0 + (rmax - r0) * (i / M) - 5.2);
      inner.push([cx + flip * Math.cos(t2) * r2, cy + Math.sin(t2) * r2]);
    }
    return recenter(outer.concat(inner), cx, cy);
  }

  function cross(cx, cy, flip) {
    var w = 20, t = 6.5;
    var base = [
      [-t, -w], [t, -w], [t, -t], [w, -t], [w, t], [t, t],
      [t, w], [-t, w], [-t, t], [-w, t], [-w, -t], [-t, -t]
    ];
    var pts = [], i, ang = Math.PI / 4, ca = Math.cos(ang), sa = Math.sin(ang);
    for (i = 0; i < base.length; i++) {
      var x = base[i][0], y = base[i][1];
      pts.push([cx + flip * (x * ca - y * sa), cy + (x * sa + y * ca)]);
    }
    return recenter(resample(pts, 48), cx, cy);
  }

  function arcBand(cx, cy, flip, a0, a1, radius) {
    var pts = [], i, M = 24;
    for (i = 0; i <= M; i++) {
      var a = a0 + (a1 - a0) * (i / M);
      pts.push([cx + flip * Math.cos(a) * radius, cy + Math.sin(a) * radius]);
    }
    for (i = M; i >= 0; i--) {
      var b = a0 + (a1 - a0) * (i / M);
      pts.push([cx + flip * Math.cos(b) * (radius - 6), cy + Math.sin(b) * (radius - 6)]);
    }
    return recenter(pts, cx, cy);
  }

  function happy(cx, cy, flip) {   /* ^ ^ */
    return arcBand(cx, cy, flip, Math.PI * 1.12, Math.PI * 1.88, 23);
  }
  function sleepy(cx, cy, flip) {  /* ◡ ◡ */
    return arcBand(cx, cy, flip, Math.PI * 0.12, Math.PI * 0.88, 23);
  }

  function circle(cx, cy, flip, radius) {
    var pts = [], i;
    for (i = 0; i < 48; i++) {
      var a = (i / 48) * TAU;
      pts.push([cx + flip * Math.cos(a) * radius, cy + Math.sin(a) * radius]);
    }
    return recenter(pts, cx, cy);
  }
  function roundEye(cx, cy, flip) { return circle(cx, cy, flip, 20); }
  function dotEye(cx, cy, flip) { return circle(cx, cy, flip, 9); }

  /* 樱花：五瓣花，实心剪影 */
  function sakura(cx, cy, flip) {
    var pts = [], i, N = 96;
    for (i = 0; i < N; i++) {
      var a = (i / N) * TAU;
      var r = 10 + 11 * Math.pow(Math.abs(Math.cos(2.5 * a)), 1.45);
      pts.push([cx + flip * Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return recenter(pts, cx, cy);
  }

  /* 雪花：六角星形，细长尖角 */
  function snow(cx, cy, flip) {
    var pts = [], i;
    for (i = 0; i < 12; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 6;
      var r = i % 2 ? 7.5 : 25;
      pts.push([cx + flip * Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return recenter(resample(pts, 48), cx, cy);
  }

  /* 南瓜：带八道浅棱的圆 */
  function pumpkin(cx, cy, flip) {
    var pts = [], i, N = 72;
    for (i = 0; i < N; i++) {
      var a = (i / N) * TAU;
      var r = 20 + 2.8 * Math.cos(8 * a);
      pts.push([cx + flip * Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return recenter(pts, cx, cy);
  }

  var CUSTOM = [
    { key: 'heart',  name: '爱心眼', make: heart,  blink: [5000, 9000] },
    { key: 'star',   name: '星星眼', make: star,   blink: [4500, 8500] },
    { key: 'spark',  name: '闪光眼', make: spark,  blink: [4000, 8000] },
    { key: 'swirl',  name: '漩涡眼', make: swirl,  blink: [6500, 11000] },
    { key: 'cross',  name: '晕晕眼', make: cross,  blink: null },
    { key: 'happy',  name: '弯弯眼', make: happy,  blink: null },
    { key: 'sleepy', name: '困困眼', make: sleepy, blink: null },
    { key: 'round',  name: '圆豆眼', make: roundEye, blink: [5000, 9000] },
    { key: 'dot',    name: '小豆眼', make: dotEye,   blink: [4000, 8000] },
    { key: 'sakura', name: '樱花眼', make: sakura,   blink: [5200, 9600] },
    { key: 'snow',   name: '雪花眼', make: snow,     blink: [4800, 8800] },
    { key: 'pumpkin', name: '南瓜眼', make: pumpkin, blink: [5200, 9200] }
  ];

  var styles = [];
  for (var i = 0; i < CUSTOM.length; i++) {
    var d = CUSTOM[i];
    var pair = [d.make(EYE_L[0], EYE_L[1], 1), d.make(EYE_R[0], EYE_R[1], -1)];
    EXPR.push(pair);
    styles.push({
      key: d.key,
      name: d.name,
      expr: EXPR.length - 1,
      blink: d.blink,
      openness: 1
    });
  }

  window.EB_EXTRA = {
    styles: styles,
    /* 原版 25 组里比较适合桌面常驻的几组（其余偏情绪化，留给互动） */
    existing: [0, 2, 4, 6, 8, 10, 14, 17, 24]
  };
})();
