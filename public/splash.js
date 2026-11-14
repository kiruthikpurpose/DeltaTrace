/* Launch animation: alarm dots scattered across the screen converge into one incident.
   Self-contained so it starts before the application bundle loads. */
(function () {
  var el = document.getElementById('splash');
  var cv = document.getElementById('sp-canvas');
  if (!el || !cv) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var ctx = cv.getContext('2d');
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var W = 0, H = 0, cx = 0, cy = 0, dots = [];
  var cs = getComputedStyle(el);
  var neutral = cs.getPropertyValue('--dot').trim() || '#8a8f96';
  var accent = cs.getPropertyValue('--accent').trim() || '#2c6ca3';
  function rnd(a, b) { return a + Math.random() * (b - a); }
  var ease = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  var easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };

  function build() {
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var stage = document.querySelector('.sp-logo').getBoundingClientRect();
    cx = stage.left + stage.width / 2; cy = stage.top + stage.height * 0.525;
    var n = Math.max(60, Math.min(130, Math.round((W * H) / 14000)));
    dots = [];
    for (var i = 0; i < n; i++) {
      var x, y, tries = 0;
      do { x = rnd(0, W); y = rnd(0, H); tries++; } while (Math.hypot(x - cx, y - cy) < Math.min(W, H) * 0.16 && tries < 10);
      var dx = cx - x, dy = cy - y, dist = Math.hypot(dx, dy);
      var bend = rnd(-0.32, 0.32) * dist;
      dots.push({
        x: x, y: y, tx: cx + rnd(-3, 3), ty: cy + rnd(-3, 3),
        qx: (x + cx) / 2 - (dy / dist) * bend, qy: (y + cy) / 2 + (dx / dist) * bend,
        r: rnd(1.8, 4.2), appear: rnd(0.1, 0.95), delay: 0.8 + rnd(0, 0.5) + (dist / Math.hypot(W, H)) * 0.3,
        dur: rnd(0.9, 1.2), alarm: Math.random() < 0.22, drift: rnd(0, Math.PI * 2), amp: rnd(2, 7)
      });
    }
  }
  build();
  window.addEventListener('resize', build);

  var t0 = null, done = false;
  function frame(now) {
    if (done) return;
    if (t0 === null) t0 = now;
    var t = (now - t0) / 1000;
    ctx.clearRect(0, 0, W, H);
    var absorbed = 0;
    for (var i = 0; i < dots.length; i++) {
      var d = dots[i];
      var a = Math.min(1, Math.max(0, (t - d.appear) / 0.7));
      var p = Math.min(1, Math.max(0, (t - d.delay) / d.dur));
      var x, y, alpha, r = d.r;
      if (p <= 0) {
        x = d.x + Math.cos(t * 0.6 + d.drift) * d.amp; y = d.y + Math.sin(t * 0.5 + d.drift) * d.amp;
        alpha = a * (d.alarm ? 0.95 : 0.7);
      } else {
        var e = ease(p), u = 1 - e;
        var sx = d.x + Math.cos(d.drift) * d.amp, sy = d.y + Math.sin(d.drift) * d.amp;
        x = u * u * sx + 2 * u * e * d.qx + e * e * d.tx;
        y = u * u * sy + 2 * u * e * d.qy + e * e * d.ty;
        alpha = (d.alarm ? 0.95 : 0.75) * (p > 0.86 ? 1 - (p - 0.86) / 0.14 : 1);
        r = d.r * (1 - 0.55 * e);
        if (p >= 1) absorbed++;
      }
      if (alpha <= 0.01) continue;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = d.alarm ? accent : neutral;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
    }
    // soft glow gathers at the centre as dots are absorbed, then hands over to the logo core
    var g = Math.min(1, absorbed / dots.length);
    var fade = t > 2.0 ? Math.max(0, 1 - (t - 2.0) / 0.5) : 1;
    if (g > 0 && fade > 0) {
      var rad = 18 + g * 46;
      var grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      grad.addColorStop(0, accent); grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.28 * g * fade; ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (t > 2.9 && absorbed >= dots.length) { done = true; ctx.clearRect(0, 0, W, H); return; }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
