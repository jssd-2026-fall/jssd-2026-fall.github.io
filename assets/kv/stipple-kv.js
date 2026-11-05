(() => {
  const box = document.querySelector('[data-kv]');
  if (!box) return;
  const BASE = box.dataset.kv;
  const COUNTS = [361851, 374862, 460077, 739653, 529005, 448881, 518841];
  const M = COUNTS.length, N = Math.max(...COUNTS), SIZE = 1640;
  const HOLD = 5, DUR = 3, VARIETY = .85;



  const EDGE = 120, MARGIN = 70;

  const TIP = [[355, null, 119, 1021], [231, 1421, 137, null], [230, null, 172, null], [null, 1521, 183, null],
               [309, 1532, 108, null], [351, 1481, 0, null], [null, 1468, 218, 1459]];



  const SHIFT = [.15, 0, .12, 0, 0, 0, 0], SHIFT_Y = [0, 0, 0, 0, 0, 0, 0];

  const ZOOM = [1, 1, 1, 1, 1, .8, .78];
  const EDGE_IMG = 80;
  const KOTSU = [242 / 255, 239 / 255, 233 / 255];
  const TONE = .86;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const cv = document.createElement('canvas');
  const gl = cv.getContext('webgl2', { antialias: false, alpha: true, premultipliedAlpha: true });
  const fail = () => box.classList.add('kv-fail');
  if (!gl) return fail();

  const VS = `#version 300 es
  precision highp float;
  in vec2 aA; in vec2 aB; in float aLA; in float aLB;
  uniform float uT, uTime;
  uniform vec4 uClip;
  uniform vec2 uEdge;
  uniform vec3 uOA, uOB;
  out float vL;
  const float PI = 3.14159265, TAU = 6.2831853;
  uint hash(uint x) { x ^= x >> 16; x *= 0x7feb352du; x ^= x >> 15; x *= 0x846ca68bu; x ^= x >> 16; return x; }
  float r(uint k) { return float(hash(uint(gl_VertexID) * 8u + k)) / 4294967295.; }
  void main() {


    vec2 jit = vec2(r(7u), r(8u)) - .5;
    vec2 p = aA * uOA.z + uOA.xy + jit * (uOA.z == 1. ? 0. : uOA.z), q = aA;
    float t = 0.;
    if (uT > 0.) {

      float span = 1. - ${VARIETY} * (.25 + r(0u) * .45);
      float delay = r(1u) * (1. - span);
      float pin = 2.6 + ${VARIETY} * (r(2u) * 2.4 - 1.2), pout = 2.6 + ${VARIETY} * (r(3u) * 2.4 - 1.2);
      t = clamp((uT - delay) / span, 0., 1.);
      t = t < .5 ? .5 * pow(2. * t, pin) : 1. - .5 * pow(2. - 2. * t, pout);
      q = mix(aA, aB, t); p = mix(aA * uOA.z + uOA.xy + jit * (uOA.z == 1. ? 0. : uOA.z), aB * uOB.z + uOB.xy + jit * (uOB.z == 1. ? 0. : uOB.z), t);
      float bell = sin(PI * t);
      if (bell > .001) {

        const float k1 = .0031, k2 = .00355, k3 = .00225;
        float tau = uTime * .7;
        float s1 = sin(k1 * p.x + tau), c1 = cos(k1 * p.x + tau);
        float s2 = sin(k2 * p.y - tau * .8), c2 = cos(k2 * p.y - tau * .8);
        float c3 = .6 * cos(k3 * (p.x + p.y) + tau * 1.3);
        float g = bell * 110. / .004;
        float wa = bell * 90. * r(4u), wph = uTime * 1.3 + r(5u) * TAU;
        p += vec2(-k2 * s1 * s2 + k3 * c3, -(k1 * c1 * c2 + k3 * c3)) * g + vec2(cos(wph), sin(wph * 1.1)) * wa;
      }
    }
    vL = mix(aLA, aLB, t);

    float ex = min(p.x - uClip.x, uClip.z - p.x), ey = min(p.y - uClip.y, uClip.w - p.y);
    float ei = min(min(q.x, ${SIZE}. - q.x), min(q.y, ${SIZE}. - q.y));
    float keep = smoothstep(0., uEdge.x, ex) * smoothstep(0., uEdge.y, ey) * smoothstep(0., ${EDGE_IMG}., ei);
    if (r(6u) > keep) vL = 0.;
    vec2 px = floor(p) + .5;
    gl_Position = vec4(px / ${SIZE}. * 2. - 1., 0, 1);
    gl_PointSize = 1.;
  }`;
  const FS = `#version 300 es
  precision mediump float; in float vL; out vec4 o;
  void main() { o = vec4(vL); }`;

  const VS2 = `#version 300 es
  void main() { vec2 v = vec2(gl_VertexID & 1, gl_VertexID >> 1) * 4. - 1.; gl_Position = vec4(v, 0, 1); }`;
  const FS2 = `#version 300 es
  precision highp float;
  uniform sampler2D uTex; uniform float uInv, uH; out vec4 o;
  void main() {
    vec2 q = vec2(gl_FragCoord.x - .5, uH - gl_FragCoord.y - .5);
    vec2 a = q * uInv, b = (q + 1.) * uInv;
    ivec2 i0 = ivec2(floor(a));
    float sum = 0.;
    for (int j = 0; j < 8; j++) {
      float ty = float(i0.y + j); if (ty >= b.y || i0.y + j >= ${SIZE}) break;
      float wy = min(b.y, ty + 1.) - max(a.y, ty);
      for (int i = 0; i < 8; i++) {
        float tx = float(i0.x + i); if (tx >= b.x || i0.x + i >= ${SIZE}) break;
        sum += texelFetch(uTex, ivec2(i0.x + i, i0.y + j), 0).r * (min(b.x, tx + 1.) - max(a.x, tx)) * wy;
      }
    }
    float v = min(1., sum / ((b.x - a.x) * (b.y - a.y))) * ${TONE};
    o = vec4(vec3(${KOTSU.join(',')}) * v, v);
  }`;

  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const link = (vs, fs) => { const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p; };
  let prog, prog2;
  try { prog = link(VS, FS); prog2 = link(VS2, FS2); } catch (e) { return fail(); }
  const U = {}, L = {};
  for (const n of ['uT', 'uTime', 'uClip', 'uEdge', 'uOA', 'uOB']) U[n] = gl.getUniformLocation(prog, n);
  for (const n of ['uTex', 'uInv', 'uH']) U[n] = gl.getUniformLocation(prog2, n);
  for (const n of ['aA', 'aB', 'aLA', 'aLB']) { L[n] = gl.getAttribLocation(prog, n); gl.enableVertexAttribArray(L[n]); }

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, SIZE, SIZE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.blendFunc(gl.ONE, gl.ONE);



  const pos = [], bri = [];
  const up = a => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, a, gl.STATIC_DRAW); return b; };
  const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const script = s => new Promise((ok, ng) => {
    const el = document.createElement('script');
    el.src = `${BASE}hand-${s}.js`; el.onload = ok; el.onerror = ng;
    document.head.appendChild(el);
  });
  async function load(s) {
    await script(s);
    const b64 = window.KV_HANDS[s]; window.KV_HANDS[s] = null;
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: 'image/webp' });
    const bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
    const c = document.createElement('canvas'); c.width = c.height = SIZE;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(bmp, 0, 0);
    const d = g.getImageData(0, 0, SIZE, SIZE).data;
    const idx = new Uint32Array(COUNTS[s]);
    let n = 0;
    for (let k = 0; k < SIZE * SIZE; k++) if (d[k * 4] > 0 && n < idx.length) idx[n++] = k;
    const perm = new Uint32Array(N);
    for (let i = 0; i < N; i++) perm[i] = i;
    for (let i = N - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
    const P = new Uint16Array(2 * N), B = new Uint8Array(N);
    for (let k = 0; k < N; k++) {
      const real = k < n, px = idx[real ? k : (rnd() * n) | 0], i = perm[k];
      P[2 * i] = px % SIZE; P[2 * i + 1] = (px / SIZE) | 0; B[i] = real ? d[px * 4] : 0;
    }
    pos[s] = up(P); bri[s] = up(B);
  }

  let scale = 1, clip = [0, 0, SIZE, SIZE], off = [], edge = [EDGE, EDGE];
  const frameEl = box.closest('.hero') || box.parentElement;


  const untilEl = box.dataset.kvUntil ? frameEl.querySelector(box.dataset.kvUntil) : null;
  function resize() {
    const dpr = devicePixelRatio || 1, w = box.clientWidth;
    cv.width = cv.height = Math.max(1, Math.round(w * dpr));
    scale = cv.width / SIZE;

    const c = box.getBoundingClientRect(), h = frameEl.getBoundingClientRect(), k = SIZE / c.width;
    const css = getComputedStyle(box), num = (n, d) => { const v = parseFloat(css.getPropertyValue(n)); return isNaN(v) ? d : v; };
    const until = untilEl && num('--kv-until', 0) ? untilEl.getBoundingClientRect().top + num('--kv-until-offset', 0) : Infinity;
    clip = [Math.max(c.left, h.left, 0), Math.max(c.top, h.top),
            Math.min(c.right, h.right, document.documentElement.clientWidth), Math.min(c.bottom, h.bottom, until)]
      .map((v, i) => (v - (i % 2 ? c.top : c.left)) * k);

    edge = [num('--kv-edge-x', EDGE), num('--kv-edge-y', EDGE)];
    const mx = num('--kv-margin-x', MARGIN), my = num('--kv-margin-y', MARGIN);
    const ax = num('--kv-align-x', .5), ay = num('--kv-align-y', .5);

    const need = (lo, hi, v0, v1, m) => lo === null || hi === null ? Infinity : (v1 - v0 - 2 * m) / (hi - lo);
    const fit = (lo, hi, v0, v1, m, k, a) => hi === null ? Math.max(v1 - SIZE * k, v0 + m - lo * k)
      : lo === null ? Math.min(v0, v1 - m - hi * k) : v0 + m - lo * k + (v1 - v0 - 2 * m - (hi - lo) * k) * a;
    const list = (n, d) => { const v = css.getPropertyValue(n).trim().split(/\s+/).map(parseFloat); return d.map((x, s) => isNaN(v[s]) ? x : v[s]); };
    const shift = list('--kv-shift', SHIFT), shiftY = list('--kv-shift-y', SHIFT_Y), zoom = list('--kv-zoom', ZOOM);

    const over = list('--kv-over', ZOOM.map(() => 0));

    const place = (lo, hi, v0, v1, m, k, a, sh) => {
      const d = fit(lo, hi, v0, v1, m, k, a) + sh * (v1 - v0);
      const min = Math.max(lo === null ? -Infinity : v0 + m - lo * k, hi === null ? v1 - SIZE * k : -Infinity);

      const max = hi === null ? Infinity : v1 - m - hi * k;
      return Math.min(Math.max(d, min), max);
    };
    off = TIP.map(([l, r, t, b], s) => {
      const ex = mx - over[s], ey = my;
      const k = Math.min(zoom[s], need(l, r, clip[0], clip[2], ex), need(t, b, clip[1], clip[3], ey));
      return [place(l, r, clip[0], clip[2], ex, k, ax, shift[s]), place(t, b, clip[1], clip[3], ey, k, ay, shiftY[s]), k];
    });
    off[M] = [0, 0, 1];
  }

  function draw(a, b, T, time) {
    if (!pos[b]) b = a;
    gl.useProgram(prog);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, SIZE, SIZE);
    gl.enable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindBuffer(gl.ARRAY_BUFFER, pos[a]); gl.vertexAttribPointer(L.aA, 2, gl.UNSIGNED_SHORT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, pos[b]); gl.vertexAttribPointer(L.aB, 2, gl.UNSIGNED_SHORT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, bri[a]); gl.vertexAttribPointer(L.aLA, 1, gl.UNSIGNED_BYTE, true, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, bri[b]); gl.vertexAttribPointer(L.aLB, 1, gl.UNSIGNED_BYTE, true, 0, 0);
    gl.uniform1f(U.uT, T); gl.uniform1f(U.uTime, time); gl.uniform4fv(U.uClip, clip); gl.uniform2fv(U.uEdge, edge);
    gl.uniform3fv(U.uOA, off[a]); gl.uniform3fv(U.uOB, off[b]);
    gl.drawArrays(gl.POINTS, 0, N);
    gl.useProgram(prog2);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, cv.width, cv.height);
    gl.disable(gl.BLEND);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(U.uTex, 0); gl.uniform1f(U.uInv, 1 / scale); gl.uniform1f(U.uH, cv.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }


  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const order = shuffle([...Array(M).keys()]);
  let queue = order.slice();
  const take = prev => {
    if (!queue.length) { queue = shuffle([...Array(M).keys()]); if (queue[0] === prev) queue.push(queue.shift()); }
    return queue.shift();
  };

  let nxt = take(M), cur = reduced ? nxt : M;
  let clock = reduced ? 0 : HOLD, time = 0, last = 0, visible = true, running = false;
  const progress = () => clock < HOLD ? 0 : (clock - HOLD) / DUR;
  function frame(now) {
    if (!visible) { running = false; return; }
    const dt = Math.min(.1, (now - last) / 1000); last = now;
    time += dt; clock += dt;
    if (clock >= HOLD && !pos[nxt]) clock = HOLD;
    if (clock >= HOLD + DUR) { clock -= HOLD + DUR; cur = nxt; nxt = take(cur); }
    draw(cur, nxt, progress(), time);
    requestAnimationFrame(frame);
  }
  function start() {
    if (running || reduced || !visible) return;
    running = true;
    requestAnimationFrame(t => { last = t; requestAnimationFrame(frame); });
  }

  load(order[0]).then(() => {
    const P = new Uint16Array(2 * N);
    for (let i = 0; i < 2 * N; i++) P[i] = (rnd() * SIZE) | 0;
    pos[M] = up(P); bri[M] = up(new Uint8Array(N));
    resize();
    box.appendChild(cv);
    draw(cur, nxt, progress(), time);
    const ro = new ResizeObserver(() => { resize(); if (!running) draw(cur, nxt, progress(), time); });
    ro.observe(box); ro.observe(frameEl);
    if (reduced) return;
    new IntersectionObserver(e => { visible = e[0].isIntersecting; start(); }).observe(box);
    start();
    (async () => { for (const s of order.slice(1)) await load(s); })();
  }).catch(fail);
})();
