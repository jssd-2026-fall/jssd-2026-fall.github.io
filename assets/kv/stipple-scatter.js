(() => {
  const box = document.querySelector('[data-scatter]');
  if (!box) return;
  const BASE = box.dataset.scatter, HAND = +box.dataset.hand || 0;
  const COUNTS = [361851, 374862, 460077, 739653, 529005, 448881, 518841];
  const N = COUNTS[HAND], SIZE = 1640;
  const EDGE_IMG = 80;
  const KOTSU = [242 / 255, 239 / 255, 233 / 255], TONE = .86;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const cv = document.createElement('canvas');
  const gl = cv.getContext('webgl2', { antialias: false, alpha: true, premultipliedAlpha: true });
  if (!gl) return;

  const VS = `#version 300 es
  precision highp float;
  in vec2 aP; in float aL;
  uniform float uS;
  out float vL;
  const float TAU = 6.2831853;
  uint hash(uint x) { x ^= x >> 16; x *= 0x7feb352du; x ^= x >> 15; x *= 0x846ca68bu; x ^= x >> 16; return x; }
  float r(uint k) { return float(hash(uint(gl_VertexID) * 8u + k)) / 4294967295.; }
  void main() {
    vec2 p = aP;

    float order = clamp(dot(aP / ${SIZE}., vec2(.45, .55)), 0., 1.);
    float delay = .55 * (.6 * order + .4 * r(0u));
    float t = clamp((uS - delay) / .45, 0., 1.);
    t = t * t * (3. - 2. * t);
    if (t > 0.) {

      float a = r(1u) * TAU;
      vec2 out_ = normalize(aP - vec2(760., 760.) + vec2(cos(a), sin(a)) * 400.);
      float dist = 180. + 620. * r(2u);
      p += (out_ + vec2(0., -.35)) * dist * t;
      const float k1 = .0031, k2 = .00355;
      float ph = uS * 2.2;
      p += vec2(sin(k2 * p.y + ph), cos(k1 * p.x - ph)) * 70. * t;
    }
    vL = aL * (1. - t * t);
    float ei = min(min(aP.x, ${SIZE}. - aP.x), min(aP.y, ${SIZE}. - aP.y));
    if (r(6u) > smoothstep(0., ${EDGE_IMG}., ei)) vL = 0.;
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
  try { prog = link(VS, FS); prog2 = link(VS2, FS2); } catch (e) { return; }
  const uS = gl.getUniformLocation(prog, 'uS');
  const U2 = {}; for (const n of ['uTex', 'uInv', 'uH']) U2[n] = gl.getUniformLocation(prog2, n);
  const aP = gl.getAttribLocation(prog, 'aP'), aL = gl.getAttribLocation(prog, 'aL');
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

  const up = a => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, a, gl.STATIC_DRAW); return b; };
  let bufP, bufL, n = 0;
  async function load() {
    await new Promise((ok, ng) => { const el = document.createElement('script');
      el.src = `${BASE}hand-${HAND}.js`; el.onload = ok; el.onerror = ng; document.head.appendChild(el); });
    const b64 = window.KV_HANDS[HAND]; window.KV_HANDS[HAND] = null;
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/webp' }), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
    const c = document.createElement('canvas'); c.width = c.height = SIZE;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(bmp, 0, 0);
    const d = g.getImageData(0, 0, SIZE, SIZE).data;
    const P = new Uint16Array(2 * N), B = new Uint8Array(N);
    for (let k = 0; k < SIZE * SIZE && n < N; k++) if (d[k * 4] > 0) { P[2 * n] = k % SIZE; P[2 * n + 1] = (k / SIZE) | 0; B[n++] = d[k * 4]; }
    bufP = up(P); bufL = up(B);
  }

  let scale = 1;
  function resize() {
    const dpr = devicePixelRatio || 1;
    cv.width = cv.height = Math.max(1, Math.round(box.clientWidth * dpr));
    scale = cv.width / SIZE;
  }

  function amount() {
    const css = getComputedStyle(box), num = (k, d) => { const v = parseFloat(css.getPropertyValue(k)); return isNaN(v) ? d : v; };
    const vh = innerHeight, top = box.getBoundingClientRect().top;
    return Math.min(1, Math.max(0, (vh * num('--scatter-start', .25) - top) / (vh * num('--scatter-range', .9))));
  }
  let shown = -1;
  function draw() {
    const s = amount();
    if (s === shown) return;
    shown = s;
    gl.useProgram(prog);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, SIZE, SIZE);
    gl.enable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindBuffer(gl.ARRAY_BUFFER, bufP); gl.enableVertexAttribArray(aP); gl.vertexAttribPointer(aP, 2, gl.UNSIGNED_SHORT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, bufL); gl.enableVertexAttribArray(aL); gl.vertexAttribPointer(aL, 1, gl.UNSIGNED_BYTE, true, 0, 0);
    gl.uniform1f(uS, s);
    gl.drawArrays(gl.POINTS, 0, n);
    gl.useProgram(prog2);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, cv.width, cv.height);
    gl.disable(gl.BLEND);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(U2.uTex, 0); gl.uniform1f(U2.uInv, 1 / scale); gl.uniform1f(U2.uH, cv.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  let queued = false;
  const request = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; draw(); }); };

  load().then(() => {
    resize();
    box.appendChild(cv);
    box.classList.add('scatter-on');
    draw();
    new ResizeObserver(() => { resize(); shown = -1; request(); }).observe(box);
    addEventListener('scroll', request, { passive: true });
  }).catch(() => {});
})();
