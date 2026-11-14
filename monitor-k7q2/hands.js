/* 会場モニター用：背景の点描の手が、散って次の仕草と位置へ集まり直す（2026-11-14）。
   サイトトップの stipple-kv.js を、Fire Stick でも動くように軽くしたもの。
   ・点は書き出し時に間引いて hand-N.bin に入れてある（x,y: Uint16 ×N、明るさ: Uint8 ×N。並びはランダム）
   ・動くのは切り替えの数秒だけ。止まっている間は描き直さない
   ・WebGL2 が使えないときは false を返し、呼び出し側が静止画の手に切り替える
   ・動きが重い（1秒あたり10コマ未満が2回続く）ときは、以後は動かさずにフェードで切り替える
   使い方：var h = MonitorHands(canvas, {base, n, hands, place, k}); h.next(); h.hide(); */
function MonitorHands(cv, opt) {
  var gl = cv.getContext('webgl2', { antialias: false, alpha: true, premultipliedAlpha: true });
  if (!gl) return false;
  var N = opt.n, SIZE = 1640, DUR = 3.2, VARIETY = .85, K = opt.k;
  var KOTSU = [242 / 255, 239 / 255, 233 / 255];
  var VS = '#version 300 es\n' +
    'precision highp float;\n' +
    'in vec2 aA; in vec2 aB; in float aLA; in float aLB;\n' +
    'uniform float uT, uTime, uK, uS, uPt; uniform vec3 uOA, uOB; uniform vec2 uWH;\n' +
    'out float vL;\n' +
    'const float PI = 3.14159265, TAU = 6.2831853;\n' +
    'uint hash(uint x) { x ^= x >> 16; x *= 0x7feb352du; x ^= x >> 15; x *= 0x846ca68bu; x ^= x >> 16; return x; }\n' +
    'float r(uint k) { return float(hash(uint(gl_VertexID) * 8u + k)) / 4294967295.; }\n' +
    'void main() {\n' +
    '  vec2 jit = vec2(r(7u), r(8u)) - .5;\n' +
    '  vec2 pa = (aA + jit) * uOA.z + uOA.xy, pb = (aB + jit) * uOB.z + uOB.xy, p = pa;\n' +
    '  float t = 0.;\n' +
    '  if (uT > 0.) {\n' +
    '    float span = 1. - ' + VARIETY + ' * (.25 + r(0u) * .45);\n' +
    '    float delay = r(1u) * (1. - span);\n' +
    '    float pin = 2.6 + ' + VARIETY + ' * (r(2u) * 2.4 - 1.2), pout = 2.6 + ' + VARIETY + ' * (r(3u) * 2.4 - 1.2);\n' +
    '    t = clamp((uT - delay) / span, 0., 1.);\n' +
    '    t = t < .5 ? .5 * pow(2. * t, pin) : 1. - .5 * pow(2. - 2. * t, pout);\n' +
    '    p = mix(pa, pb, t);\n' +
    '    float bell = sin(PI * t);\n' +
    '    if (bell > .001) {\n' +
    '      const float k1 = .0031, k2 = .00355, k3 = .00225;\n' +
    '      float tau = uTime * .7;\n' +
    '      float s1 = sin(k1 * p.x + tau), c1 = cos(k1 * p.x + tau);\n' +
    '      float s2 = sin(k2 * p.y - tau * .8), c2 = cos(k2 * p.y - tau * .8);\n' +
    '      float c3 = .6 * cos(k3 * (p.x + p.y) + tau * 1.3);\n' +
    '      float g = bell * 110. / .004;\n' +
    '      float wa = bell * 90. * r(4u), wph = uTime * 1.3 + r(5u) * TAU;\n' +
    '      p += vec2(-k2 * s1 * s2 + k3 * c3, -(k1 * c1 * c2 + k3 * c3)) * g + vec2(cos(wph), sin(wph * 1.1)) * wa;\n' +
    '    }\n' +
    '  }\n' +
    '  vL = mix(aLA, aLB, t) * uK;\n' +
    '  vec2 c = p * uS;\n' +
    '  gl_Position = vec4(c.x / uWH.x * 2. - 1., 1. - c.y / uWH.y * 2., 0, 1);\n' +
    '  gl_PointSize = uPt;\n' +
    '}';
  var FS = '#version 300 es\nprecision mediump float; in float vL; out vec4 o;\n' +
    'void main() { o = vec4(vec3(' + KOTSU.join(',') + ') * vL, vL); }';
  function sh(type, src) {
    var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s;
  }
  var prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
  } catch (e) { return false; }
  var U = {}, L = {};
  ['uT', 'uTime', 'uK', 'uS', 'uPt', 'uOA', 'uOB', 'uWH'].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
  ['aA', 'aB', 'aLA', 'aLB'].forEach(function (n) { L[n] = gl.getAttribLocation(prog, n); gl.enableVertexAttribArray(L[n]); });
  gl.blendFunc(gl.ONE, gl.ONE);

  function up(a) { var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, a, gl.STATIC_DRAW); return b; }
  var pos = [], bri = [], M = opt.hands.length;
  // 番号 M は「散らばった見えない点」。最初はここから集まって浮かび上がる
  var P0 = new Uint16Array(2 * N); for (var i = 0; i < 2 * N; i++) P0[i] = (Math.random() * SIZE) | 0;
  pos[M] = up(P0); bri[M] = up(new Uint8Array(N));
  function load(s) {
    if (pos[s] || load[s]) return load[s] || Promise.resolve();
    return load[s] = fetch(opt.base + opt.hands[s]).then(function (r) { return r.arrayBuffer(); }).then(function (buf) {
      pos[s] = up(new Uint16Array(buf, 0, 2 * N)); bri[s] = up(new Uint8Array(buf, 4 * N, N));
    });
  }
  // 置き場所 [中心x, 中心y, 大きさ]（スライドの高さを1とする。横は 16/9）
  function offs(pl) { var s = pl[2]; return [(pl[0] - s / 2) * SIZE, (pl[1] - s / 2) * SIZE, s]; }
  var W = 1, H = 1, pt = 1;
  function resize() {
    var r = cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2560 / Math.max(1, r.width));
    W = cv.width = Math.max(1, Math.round(r.width * dpr)); H = cv.height = Math.max(1, Math.round(r.height * dpr));
    pt = Math.max(1, (opt.pt || 1) * H / 1080);      // 点の大きさ：1080pxの高さで opt.pt px（4Kではその2倍）
  }
  var cur = M, curPl = [0.89, .5, 1], nxt = M, nxtPl = curPl, T = 0, time = 0, running = false, anim = true, slow = 0;
  function draw() {
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(prog); gl.enable(gl.BLEND);
    var a = cur, b = T > 0 ? nxt : cur;
    gl.bindBuffer(gl.ARRAY_BUFFER, pos[a]); gl.vertexAttribPointer(L.aA, 2, gl.UNSIGNED_SHORT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, pos[b]); gl.vertexAttribPointer(L.aB, 2, gl.UNSIGNED_SHORT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, bri[a]); gl.vertexAttribPointer(L.aLA, 1, gl.UNSIGNED_BYTE, true, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, bri[b]); gl.vertexAttribPointer(L.aLB, 1, gl.UNSIGNED_BYTE, true, 0, 0);
    gl.uniform1f(U.uT, T); gl.uniform1f(U.uTime, time); gl.uniform1f(U.uK, K);
    gl.uniform1f(U.uS, H / SIZE); gl.uniform1f(U.uPt, pt); gl.uniform2f(U.uWH, W, H);
    gl.uniform3fv(U.uOA, offs(curPl)); gl.uniform3fv(U.uOB, offs(T > 0 ? nxtPl : curPl));
    gl.drawArrays(gl.POINTS, 0, N);
  }
  function finish() { cur = nxt; curPl = nxtPl; T = 0; draw(); }
  function morph() {
    if (running) finish();
    if (!anim) {                                     // 重い環境：フェードで差し替える
      cv.style.opacity = 0;
      setTimeout(function () { finish(); cv.style.opacity = ''; }, 900);
      return;
    }
    running = true;
    var last = 0, start = 0, frames = 0;
    function frame(now) {
      if (!running) return;
      if (!start) { start = last = now; }
      var dt = Math.min(.1, (now - last) / 1000); last = now;
      time += dt; frames++;
      T = Math.min(1, (now - start) / 1000 / DUR);
      draw();
      if (T >= 1) {
        running = false; finish();
        // 2回続けて重かったら、次からは動かさない（opt.force で常に動かす）
        slow = frames / DUR < 10 ? slow + 1 : 0;
        if (slow >= 2 && !opt.force) anim = false;
        return;
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  var step = -1, order = [];
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = (Math.random() * (i + 1)) | 0, t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  resize();
  window.addEventListener('resize', function () { resize(); if (!running) draw(); });
  return {
    // 次の手へ。置き場所は opt.place を順に使う（手の順とは周期をずらして組み合わせが毎回変わるように）
    next: function () {
      step++;
      if (!order.length) { order = shuffle(opt.hands.map(function (_, i) { return i; })); if (order[0] === cur) order.push(order.shift()); }
      var s = order.shift(), pl = opt.place[step % opt.place.length];
      cv.classList.add('on');
      load(s).then(function () { if (running) finish(); nxt = s; nxtPl = pl; morph(); });
      var peek = order[0]; if (peek !== undefined) load(peek);   // 次の手を先読み
    },
    hide: function () { cv.classList.remove('on'); },
    // 確認用：移り変わりの途中 t（0〜1）を止めて描く
    peek: function (t) { running = false; T = t; time = t * DUR; draw(); },
    get animated() { return anim; }
  };
}
