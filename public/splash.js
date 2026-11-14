/* DeltaTrace launch screen (always dark).
   Alarms scatter across the screen, converge into streams, pass the trust lens and end as one
   incident. The drawing simplifies into the product mark, which flies into the sidebar logo
   (the topbar logo on phones) while the wordmark travels with it and becomes the sidebar text.
   Self-contained so it starts before the application bundle loads. */
(function () {
  var sp = document.getElementById('splash');
  if (!sp) return;
  var root = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function remove() {
    sp.remove(); root.classList.remove('splash-on');
    window.dispatchEvent(new Event('deltatrace:splash-done'));
  }
  if (reduce) { remove(); return; }

  var NS = 'http://www.w3.org/2000/svg';
  var W = window.innerWidth, H = window.innerHeight;
  var S = Math.min(W, H * 1.15) / 1024 * 0.66;
  var EASE = 'cubic-bezier(.65,0,.35,1)', OUT = 'cubic-bezier(.16,1,.3,1)';
  var K = 1.35, timers = [], ready = false, reachedDock = false, done = false;
  function T(ms, fn) { timers.push(setTimeout(fn, ms / K)); }
  function el(tag, attrs, parent) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); (parent || svg).appendChild(e); return e; }

  var bgLayer = document.createElement('div'); bgLayer.className = 'sp-bg'; sp.appendChild(bgLayer);
  var svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 'sp-svg'); sp.appendChild(svg);
  var name = document.createElement('div'); name.className = 'sp-name'; name.innerHTML = '<span class="sp-nt"><span style="font-weight:600">Delta</span><span class="l">Trace</span></span>';
  var sub = document.createElement('div'); sub.className = 'sp-sub'; sub.textContent = 'Trust-aware alarm grouping and tuning for pipelines';
  var credit = document.createElement('div'); credit.className = 'sp-credit'; credit.textContent = 'Created by Kiruthik';
  sp.appendChild(name); sp.appendChild(sub); sp.appendChild(credit);
  var fs = Math.max(34, Math.min(W, H * 1.15) * 0.064);
  name.style.fontSize = fs + 'px'; sub.style.fontSize = Math.max(13, Math.min(W, H * 1.15) * 0.021) + 'px';
  sub.style.padding = '0 24px'; sub.style.boxSizing = 'border-box';

  var defs = el('defs', {});
  function grad(id, c0, c1, o0) { var g = el('linearGradient', { id: id, gradientUnits: 'userSpaceOnUse', x1: 126, y1: 0, x2: 690, y2: 0 }, defs); el('stop', { offset: 0, 'stop-color': c0, 'stop-opacity': o0 }, g); el('stop', { offset: 0.6, 'stop-color': c0 }, g); el('stop', { offset: 1, 'stop-color': c1 }, g); }
  grad('sr0', '#5fb4ff', '#e8f6ff', 0.25); grad('sr1', '#59d7ff', '#f0fdff', 0.25); grad('sr2', '#7ea8ff', '#eef3ff', 0.25);
  var bg = el('linearGradient', { id: 'sband', gradientUnits: 'userSpaceOnUse', x1: 530, y1: 0, x2: 884, y2: 0 }, defs); el('stop', { offset: 0, 'stop-color': '#e8f6ff' }, bg); el('stop', { offset: 1, 'stop-color': '#fff' }, bg);
  function blur(id, sd) { var f = el('filter', { id: id, x: '-40%', y: '-40%', width: '180%', height: '180%' }, defs); el('feGaussianBlur', { stdDeviation: sd }, f); }
  blur('sb18', 18); blur('sb6', 6);
  var ng = el('radialGradient', { id: 'sng' }, defs); el('stop', { offset: 0, 'stop-color': '#fff' }, ng); el('stop', { offset: 0.4, 'stop-color': '#c8e6ff' }, ng); el('stop', { offset: 1, 'stop-color': '#4c8dff', 'stop-opacity': 0 }, ng);

  var field = el('g', {});
  var rootG = el('g', {}); var grp = el('g', {}, rootG);
  rootG.style.transformOrigin = '0 0';
  function place(sc, tx, ty) { rootG.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + sc + ')'; }
  var CX = W / 2, CY = H / 2 - H * 0.02;
  rootG.style.transition = 'transform 1.4s ' + EASE;
  place(S, CX - 520 * S, CY - 520 * S);

  var LX = 650, LY = 520, MX = 560, NX = 884, ys = [236, 332, 426, 520, 614, 708, 804];
  var rg = el('g', { style: 'mix-blend-mode:screen', opacity: '.9' }, grp), rib = [];
  ys.forEach(function (y0, i) {
    var p = el('path', { d: 'M126,' + y0 + ' C320,' + y0 + ' 380,520 ' + MX + ',520 L' + (LX + 40) + ',520', fill: 'none', stroke: 'url(#sr' + (i % 3) + ')', 'stroke-width': i === 3 ? 28 : 24, 'stroke-linecap': 'round', pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 1 }, rg);
    p.style.transition = 'stroke-dashoffset 1.2s ' + EASE + ' ' + (i * 0.04) + 's, opacity 1s, stroke .9s, stroke-width .9s'; rib.push(p);
  });
  var anchors = ys.map(function (y0) { var a = el('circle', { cx: 126, cy: y0, r: 15, fill: '#e0a030', opacity: 0 }, grp); a.style.transition = 'opacity .6s'; return a; });
  var lens = el('g', { opacity: 0 }, grp); lens.style.transition = 'opacity 1s, transform 1s ' + OUT; lens.style.transformOrigin = LX + 'px ' + LY + 'px'; lens.style.transform = 'scale(.9)';
  var lensFill = el('circle', { cx: LX, cy: LY, r: 168, fill: 'rgba(156,200,255,.10)' }, lens); lensFill.style.transition = 'fill 1s';
  var lensRim = el('circle', { cx: LX, cy: LY, r: 168, fill: 'none', stroke: 'rgba(190,224,255,.7)', 'stroke-width': 7 }, lens); lensRim.style.transition = 'stroke .9s, stroke-width .9s';
  function P(a, r) { return [LX + r * Math.cos(a * Math.PI / 180), LY + r * Math.sin(a * Math.PI / 180)]; }
  function arc(a0, a1, r) { var s = P(a0, r), e = P(a1, r); return 'M' + s[0] + ' ' + s[1] + ' A' + r + ' ' + r + ' 0 ' + (a1 - a0 > 180 ? 1 : 0) + ' 1 ' + e[0] + ' ' + e[1]; }
  var track = el('path', { d: arc(-140, 140, 198), fill: 'none', stroke: 'rgba(255,255,255,.09)', 'stroke-width': 20, 'stroke-linecap': 'round', opacity: 0 }, grp); track.style.transition = 'opacity .8s';
  var prog = el('path', { d: arc(-140, -140 + 280 * 0.82, 198), fill: 'none', stroke: '#6fb6ff', 'stroke-width': 20, 'stroke-linecap': 'round', pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 1 }, grp); prog.style.transition = 'stroke-dashoffset 1.3s ' + EASE + ', stroke-width .9s, stroke .9s';
  var ticks = el('g', { opacity: 0 }, grp); ticks.style.transition = 'opacity .9s';
  for (var i = 0; i < 29; i++) { var a = -140 + 280 * i / 28, M = i % 7 === 0, p1 = P(a, M ? 218 : 221), q1 = P(a, 234); el('path', { d: 'M' + p1[0] + ' ' + p1[1] + ' L' + q1[0] + ' ' + q1[1], stroke: '#fff', 'stroke-opacity': M ? 0.4 : 0.17, 'stroke-width': M ? 5 : 3, 'stroke-linecap': 'round' }, ticks); }
  var bandG = el('g', {}, grp);
  var bandGlow = el('path', { d: 'M' + (MX - 30) + ',520 H' + NX, stroke: 'url(#sband)', 'stroke-width': 46, 'stroke-linecap': 'round', fill: 'none', filter: 'url(#sb18)', opacity: 0, pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 1 }, bandG);
  var bandL = el('path', { d: 'M' + (MX - 30) + ',520 H' + NX, stroke: 'url(#sband)', 'stroke-width': 34, 'stroke-linecap': 'round', fill: 'none', pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 1 }, bandG);
  bandL.style.transition = 'stroke-dashoffset 1s ' + EASE + ', stroke-width .9s, stroke .9s'; bandGlow.style.transition = 'stroke-dashoffset 1s ' + EASE + ', opacity .8s';
  var halo = el('circle', { cx: NX, cy: 520, r: 92, fill: 'url(#sng)', opacity: 0, filter: 'url(#sb6)' }, grp); halo.style.transition = 'opacity 1s';
  var nodeRing = el('circle', { cx: NX, cy: 520, r: 54, fill: 'none', stroke: 'rgba(255,255,255,.5)', 'stroke-width': 5, opacity: 0 }, grp); nodeRing.style.transition = 'opacity .8s';
  var node = el('circle', { cx: NX, cy: 520, r: 0, fill: '#fff' }, grp); node.style.transition = 'r .7s ' + OUT + ', fill .9s';

  var dots = [], N = Math.max(46, Math.min(110, Math.round(W * H / 16000)));
  for (var d = 0; d < N; d++) {
    var x = Math.random() * W, y = Math.random() * H;
    var c = el('circle', { cx: x, cy: y, r: 1.8 + Math.random() * 2.8, fill: d < 7 ? '#e0a030' : '#6c7580', opacity: 0 }, field);
    c._x = x; c._y = y; c.style.transition = 'opacity .9s'; dots.push(c);
  }
  function toScreen(x, y) { return [CX + (x - 520) * S, CY + (y - 520) * S]; }

  // --- timeline
  var SIMPLE = 0.5, markTop = CY - H * 0.07; // simplified mark scale and vertical centre
  T(150, function () { dots.forEach(function (c, i) { setTimeout(function () { c.style.opacity = i < 7 ? 0.95 : 0.5; }, Math.random() * 450); }); });
  T(1100, function () {
    dots.forEach(function (c, i) {
      c.style.transition = 'transform 1.4s ' + EASE + ', opacity 1.2s';
      var t = i < 7 ? toScreen(126, ys[i]) : toScreen(MX, 520);
      c.style.transform = 'translate(' + (t[0] - c._x) + 'px,' + (t[1] - c._y) + 'px)';
      if (i >= 7) c.style.opacity = 0;
    });
  });
  T(2250, function () { dots.slice(0, 7).forEach(function (c) { c.style.opacity = 0; }); anchors.forEach(function (a) { a.setAttribute('opacity', 1); }); rib.forEach(function (p) { p.style.strokeDashoffset = 0; }); });
  T(2900, function () { lens.setAttribute('opacity', 1); lens.style.transform = 'scale(1)'; track.setAttribute('opacity', 1); prog.style.strokeDashoffset = 0; ticks.setAttribute('opacity', 1); });
  T(3500, function () { bandL.style.strokeDashoffset = 0; bandGlow.setAttribute('opacity', 0.8); bandGlow.style.strokeDashoffset = 0; node.setAttribute('r', 34); halo.setAttribute('opacity', 0.9); nodeRing.setAttribute('opacity', 1); });
  T(4300, function () {
    var sc = S * SIMPLE; place(sc, CX - 520 * sc, markTop - 520 * sc);
    anchors.forEach(function (a) { a.setAttribute('opacity', 0); });
    [0, 2, 4, 6].forEach(function (i) { rib[i].setAttribute('opacity', 0); });
    rib.forEach(function (p) { p.setAttribute('stroke', '#e3e6e9'); p.setAttribute('stroke-width', 30); });
    ticks.setAttribute('opacity', 0); track.setAttribute('opacity', 0); halo.setAttribute('opacity', 0); bandGlow.setAttribute('opacity', 0);
    lensFill.setAttribute('fill', 'rgba(0,0,0,0)'); lensRim.setAttribute('stroke', '#94a0ab'); lensRim.setAttribute('stroke-width', 14);
    prog.setAttribute('stroke', '#5b9fd6'); prog.setAttribute('stroke-width', 26);
    bandL.setAttribute('stroke', '#e3e6e9'); bandL.setAttribute('stroke-width', 30); node.setAttribute('fill', '#5b9fd6'); nodeRing.setAttribute('opacity', 0);
    var bottom = markTop + (804 - 520) * sc;
    name.style.top = (bottom + H * 0.045) + 'px';
    T(700, function () { name.classList.add('on'); });
    T(1200, function () { sub.style.top = (parseFloat(name.style.top) + fs * 1.3) + 'px'; sub.classList.add('on'); credit.classList.add('on'); });
  });
  T(6900, function () { reachedDock = true; tryDock(); });

  function cssVar(n) { return getComputedStyle(root).getPropertyValue(n).trim(); }
  function visibleRect(id) {
    var e = document.getElementById(id), r = e && e.getBoundingClientRect();
    return r && r.width > 8 && r.height > 4 && r.left >= 0 && r.right <= W + 1 && r.top >= 0 && r.top < H ? r : null;
  }
  function fadeOut() {
    if (done) return; done = true;
    sp.style.transition = 'opacity .7s cubic-bezier(.32,.72,0,1)'; sp.style.opacity = 0;
    root.classList.remove('splash-on'); setTimeout(remove, 760);
  }
  var MARK = '<svg viewBox="100 300 830 440" width="100%" height="100%" fill="none" stroke-linecap="round" stroke-linejoin="round"><g class="fr" stroke="#e3e6e9" stroke-width="30"><path d="M126,332 C320,332 380,520 560,520 L690,520"/><path d="M126,520 C320,520 380,520 560,520 L690,520"/><path d="M126,708 C320,708 380,520 560,520 L690,520"/></g><circle class="fm" cx="650" cy="520" r="168" stroke="#94a0ab" stroke-width="14"/><path class="fb" d="M498.3 392.7 A198 198 0 1 1 651.4 718.0" stroke="#5b9fd6" stroke-width="26"/><path class="fr2" d="M530,520 H884" stroke="#e3e6e9" stroke-width="30"/><circle class="fn" cx="884" cy="520" r="34" fill="#5b9fd6" stroke="none"/></svg>';
  function tryDock() {
    if (done || !ready || !reachedDock) return;
    var r = visibleRect('brand-logo') || visibleRect('brand-logo-m');
    if (!r) { fadeOut(); return; }
    done = true;
    // 1. hand the mark over to its own compositor layer at exactly its current screen position
    var sc0 = S * SIMPLE, ox = CX - 520 * sc0, oy = markTop - 520 * sc0;
    var fly = document.createElement('div'); fly.className = 'sp-fly';
    fly.style.left = (ox + 100 * sc0) + 'px'; fly.style.top = (oy + 300 * sc0) + 'px'; fly.style.width = (830 * sc0) + 'px'; fly.style.height = (440 * sc0) + 'px';
    fly.innerHTML = MARK; sp.appendChild(fly);
    rootG.style.visibility = 'hidden'; field.style.visibility = 'hidden';
    var ink = cssVar('--text'), muted = cssVar('--text-muted'), brand = cssVar('--brand');
    var sc = r.width / (830 * sc0);
    // two frames later so the colour transitions and the flight start from the painted state
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      fly.style.transform = 'translate(' + (r.left - (ox + 100 * sc0)) + 'px,' + (r.top - (oy + 300 * sc0)) + 'px) scale(' + sc + ')';
      fly.querySelector('.fr').setAttribute('stroke', ink); fly.querySelector('.fr2').setAttribute('stroke', ink);
      fly.querySelector('.fm').setAttribute('stroke', muted); fly.querySelector('.fb').setAttribute('stroke', brand); fly.querySelector('.fn').setAttribute('fill', brand);
      // wordmark travels with it and lands as the sidebar text
      var nt = name.querySelector('.sp-nt'), cr = nt.getBoundingClientRect(), tn = visibleRect('brand-name');
      if (tn) {
        var ns = tn.width / cr.width, nx = tn.left - cr.left, ny = tn.top + tn.height / 2 - cr.top - ns * cr.height / 2;
        name.style.transition = 'none'; nt.style.transition = 'transform 1.25s cubic-bezier(.65,0,.35,1)'; nt.style.transform = 'translate(' + nx + 'px,' + ny + 'px) scale(' + ns + ')';
      } else { name.classList.add('off'); }
      sub.classList.add('off'); credit.classList.add('off');
      bgLayer.style.opacity = 0;                                   // reveal the app behind
      setTimeout(function () { root.classList.remove('splash-on'); }, 1000);   // real logo fades in under the flying one
      setTimeout(function () { fly.style.opacity = 0; name.style.opacity = 0; name.style.transition = 'opacity .25s'; }, 1080);
      setTimeout(remove, 1420);
    }); });
  }
  function skip() { timers.forEach(clearTimeout); fadeOut(); }
  setTimeout(function () { sp.addEventListener('click', skip, { once: true }); window.addEventListener('keydown', function () { if (!done) skip(); }, { once: true }); }, 600);
  window.__deltaSplash = { ready: function () { ready = true; tryDock(); } };
})();
