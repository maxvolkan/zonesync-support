const GLYPHS = '◈◇⌬⏣⎔⌖⌗⌑✦⊹⋆⋮⋯⌘ᛗᚷ';

const FRAG = `
precision mediump float;
uniform vec2 u_size;
uniform float u_time;
uniform sampler2D u_glyphs;
uniform vec2 u_cursor;
uniform float u_velocity;

float h21(vec2 p){
  vec3 q = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

void main(){
  float sz = 16.;
  vec2 cur = vec2(u_cursor.x * u_size.x, (1. - u_cursor.y) * u_size.y);

  vec2 px = gl_FragCoord.xy;
  vec2 cell = floor(px / sz);
  float seed = h21(cell);

  vec2 cellMid = (cell + .5) * sz;
  vec2 away = cellMid - cur;
  float dist = length(away);
  float repel = 1. / (1. + dist * .005);
  px += normalize(away + .01) * repel * (10. + u_velocity * 6.);

  cell = floor(px / sz);
  vec2 luv = fract(px / sz);
  cellMid = (cell + .5) * sz;
  seed = h21(cell);

  float active = step(.85, seed);

  float phase = dot(cellMid / u_size, vec2(2.7, 1.8)) - u_time * .03 + seed * 6.28;
  float wave = sin(phase) * .5 + .5;
  float band = smoothstep(.4, .6, wave) * smoothstep(.92, .7, wave);

  float yN = gl_FragCoord.y / u_size.y;
  float base = band * active * (.16 + smoothstep(.35, .0, yN) * .09);

  float cd = length(cellMid - cur) / u_size.x;
  float glow = exp(-cd * cd * 35.) * (1. + u_velocity * .6);
  float vis = base + glow * (.22 + u_velocity * .1) * (active + .35);

  float tick = u_time * (1.8 + seed * 3.) + seed * 160.;
  float gi = mod(floor(tick), 16.);
  vec2 ac = (vec2(mod(gi, 4.), floor(gi / 4.)) + clamp(luv, .06, .94)) / 4.;
  float g = texture2D(u_glyphs, ac).r;

  vec3 ink = vec3(.66, .63, .58) + glow * vec3(.08, .05, .01);
  float alpha = g * vis;

  vec2 sc = gl_FragCoord.xy / u_size - .5;
  alpha *= 1. - .3 * dot(sc, sc) * 3.;

  float n = h21(gl_FragCoord.xy + fract(u_time * 13.7)) - .5;
  vec3 col = ink * alpha + n * .04 * (1. + glow * .6);

  gl_FragColor = vec4(col, alpha);
}`;

const VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0,1);}';

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(sh));
    return null;
  }
  return sh;
}

function buildAtlas() {
  const c = document.createElement('canvas');
  c.width = c.height = 192;
  const x = c.getContext('2d');
  x.fillStyle = '#000';
  x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = '#fff';
  x.font = '31.2px serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  for (let i = 0; i < GLYPHS.length; i++) {
    const cx = (i % 4) * 48 + 24;
    const cy = Math.floor(i / 4) * 48 + 24;
    x.fillText(GLYPHS[i], cx, cy);
  }
  return c;
}

(function init() {
  const canvas = document.getElementById('bg');
  if (!canvas) return;
  const gl = canvas.getContext('webgl', { alpha: true, antialias: false });
  if (!gl) return;

  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(prog));
    return;
  }

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
  const aLoc = gl.getAttribLocation(prog, 'a');
  gl.enableVertexAttribArray(aLoc);
  gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);
  gl.useProgram(prog);

  const u = {
    size: gl.getUniformLocation(prog, 'u_size'),
    time: gl.getUniformLocation(prog, 'u_time'),
    cursor: gl.getUniformLocation(prog, 'u_cursor'),
    velocity: gl.getUniformLocation(prog, 'u_velocity'),
  };

  const tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, buildAtlas());
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.uniform1i(gl.getUniformLocation(prog, 'u_glyphs'), 0);

  gl.clearColor(0, 0, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  function resize() {
    const w = Math.min(innerWidth, 3840);
    const h = Math.min(innerHeight, 2160);
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
  }
  resize();
  addEventListener('resize', resize, { passive: true });

  let cx = 0.5, cy = 0.5, vRaw = 0, vSmooth = 0, prevT = 0, lastDraw = 0;
  function moveTo(x, y) {
    const nx = x / innerWidth, ny = y / innerHeight;
    vRaw = 600 * Math.hypot(nx - cx, ny - cy);
    cx = nx; cy = ny;
  }
  addEventListener('mousemove', e => moveTo(e.clientX, e.clientY), { passive: true });
  addEventListener('touchmove', e => {
    const t = e.touches[0];
    if (t) moveTo(t.clientX, t.clientY);
  }, { passive: true });

  const start = performance.now();
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let raf;

  function frame(t) {
    const dt = prevT ? Math.min((t - prevT) / 1000, 0.1) : 0.016;
    prevT = t;
    const k = 1 - Math.exp(-dt / 0.12);
    vSmooth += (vRaw - vSmooth) * k;
    vRaw *= Math.exp(-dt / 0.14);

    if (t - lastDraw >= 30) {
      lastDraw = t;
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(u.size, canvas.width, canvas.height);
      gl.uniform1f(u.time, (t - start) / 1000);
      gl.uniform2f(u.cursor, cx, cy);
      gl.uniform1f(u.velocity, Math.min(vSmooth / 40, 1));
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    if (!reduceMotion) raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  document.addEventListener('visibilitychange', () => {
    if (reduceMotion) return;
    if (document.hidden) cancelAnimationFrame(raf);
    else raf = requestAnimationFrame(frame);
  });
})();
