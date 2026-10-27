/*
 * Cosmo loading screen for the public client pages (landing, client sign-in,
 * inquiry). It runs before the app bundle, so it shows on the first paint.
 * Progress is real, not a timer: page parsed, page loaded, the page's own code
 * on screen (the app calls window.cosmoLoader.done()), then fonts ready.
 * As progress rises, scattered particles gather into the Cosmo spiral; at
 * 100 the camera dives through its core and the page is revealed.
 * The particle maths mirrors src/features/landing/cosmoSpiral.ts.
 */
(function () {
  var root = document.getElementById('cosmo-loader');
  if (!root) return;
  var noop = { progress: function () {}, done: function () {} };
  var loc = window.location;
  var hash = (loc.hash || '').split('?')[0];
  var path = loc.pathname;
  var publicPage = !window.alphaDesktop
    && !/[?&](code|ticketing-preview)(=|&|$)/.test(loc.search || '')
    && ((path === '/' && (!hash || hash === '#/' || hash === '#/home'))
      || /^#\/(client|request)(\/|$)/.test(hash)
      || /^\/(client|request)(\/|$)/.test(path));
  if (!publicPage) {
    root.parentNode.removeChild(root);
    window.cosmoLoader = noop;
    return;
  }

  var html = document.documentElement;
  html.classList.add('cosmo-loading');
  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var canvas = root.querySelector('canvas');
  var ctx = canvas.getContext('2d');
  var line = root.querySelector('.cosmo-loader-line');
  var strips = [];
  [].slice.call(root.querySelectorAll('[data-digit]')).forEach(function (cell) {
    var strip = document.createElement('span');
    strip.className = 'cosmo-loader-strip';
    for (var d = 0; d <= 9; d++) { var n = document.createElement('span'); n.textContent = String(d); strip.appendChild(n); }
    cell.appendChild(strip);
    strips.push(strip);
  });

  function seeded(seed) { var s = seed; return function () { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
  var rnd = seeded(7), spiral = [];
  for (var i = 0; i < 900; i++) {
    var r = Math.pow(rnd(), 0.7) * 1.15;
    spiral.push([i % 2, r, (rnd() - 0.5) * (0.35 + rnd() * 0.5), rnd()]);
    rnd();
  }
  var g = seeded(77), gather = spiral.map(function () { return [0.9 + g() * 0.9, g() * 0.55, (g() - 0.5) * 0.8]; });
  var sr = seeded(91), stars = [];
  for (var k = 0; k < 220; k++) stars.push([sr(), sr(), sr(), sr() * 6.2832]);

  var target = 6, shown = 0, finishing = false, leaveAt = 0, last = 0, frame = 0, gone = false;
  function reach(value) { if (value > target) target = Math.min(100, value); if (reduced) paint(performance.now()); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { reach(30); });
  else reach(30);
  if (document.readyState === 'complete') reach(62);
  else window.addEventListener('load', function () { reach(62); });
  window.cosmoLoader = {
    progress: reach,
    done: function () {
      if (finishing) return;
      finishing = true;
      reach(88);
      var fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
      fonts.then(function () { reach(100); }, function () { reach(100); });
    }
  };
  // Never hold the page hostage: reveal anyway if the app has not reported in.
  window.setTimeout(function () { window.cosmoLoader.done(); }, 10000);

  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function smooth(v) { v = clamp(v); return v * v * (3 - 2 * v); }

  function setCount(value) {
    var text = ('00' + Math.floor(value)).slice(-3);
    for (var c = 0; c < strips.length; c++) strips[c].style.transform = 'translateY(' + (-1.1 * Number(text.charAt(c))) + 'em)';
    if (line) line.style.transform = 'scaleX(' + (value / 100) + ')';
  }

  function paint(now) {
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#07070c';
    ctx.fillRect(0, 0, w, h);
    var t = now / 1000;
    var dt = last ? Math.min(0.1, t - last) : 0;
    last = t;
    if (reduced) shown = target;
    else {
      var step = Math.max(14 * dt, (target - shown) * Math.min(1, dt * 3.2));
      shown = Math.min(target, shown + step);
    }
    setCount(shown);
    var leave = leaveAt ? clamp((now - leaveAt) / 900) : 0;
    var formed = smooth(shown / 100);
    var farthest = Math.hypot(w, h) / 2;
    var R = Math.min(w, h) * 0.24 * (1 + 7 * leave * leave * leave);
    var cx = w / 2, cy = h / 2;
    var spin = reduced ? 0 : -t * 0.05;

    for (var s = 0; s < stars.length; s++) {
      var st = stars[s];
      var tw = reduced ? 0.7 : 0.5 + 0.5 * Math.sin(t * (0.5 + st[2]) + st[3]);
      var sx = cx + (st[0] - 0.5) * w * (1 + leave * 1.5), sy = cy + (st[1] - 0.5) * h * (1 + leave * 1.5), sz = 0.5 + st[2] * 0.8;
      ctx.fillStyle = 'rgba(245,243,252,' + ((0.08 + 0.4 * tw * st[2]) * (1 - leave)).toFixed(3) + ')';
      ctx.fillRect(sx - sz, sy - sz, sz * 2, sz * 2);
    }

    ctx.strokeStyle = 'rgba(224,213,255,' + (0.07 * formed * (1 - leave)).toFixed(3) + ')';
    [0.36, 0.72, 1.08].forEach(function (f) { ctx.beginPath(); ctx.arc(cx, cy, f * R, 0, 6.2832); ctx.stroke(); });

    for (var p = 0; p < spiral.length; p++) {
      var pt = spiral[p], ga = gather[p];
      var local = clamp((formed - ga[1]) / 0.45);
      var e = 1 - Math.pow(1 - local, 3);
      var a = spin + pt[0] * Math.PI + pt[1] * 5.2 + pt[2] * (0.25 + pt[1] * 0.6) + (1 - e) * (2.4 + ga[2]);
      var rad = (pt[1] / 1.15) * R + (ga[0] * farthest - (pt[1] / 1.15) * R) * (1 - e);
      var fade = 1 - pt[1] / 1.3;
      var alpha = (0.14 + 0.66 * fade) * (0.3 + 0.7 * e) * (1 - leave);
      ctx.fillStyle = (pt[3] > 0.88 ? 'rgba(208,191,255,' : 'rgba(245,243,252,') + alpha.toFixed(3) + ')';
      var size = pt[1] < 0.2 ? 1.25 : 0.95;
      ctx.fillRect(cx + Math.cos(a) * rad - size, cy + Math.sin(a) * rad - size, size * 2, size * 2);
    }

    var core = Math.max(2.5, R * 0.025) * (1 + 2 * formed);
    ctx.fillStyle = 'rgba(255,255,255,' + (0.35 + 0.6 * formed).toFixed(3) + ')';
    ctx.beginPath(); ctx.arc(cx, cy, core, 0, 6.2832); ctx.fill();
    if (leave > 0) {
      // Ignition: a soft glow from the core and one shockwave ring racing outwards.
      var glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.9);
      var strength = Math.sin(Math.PI * Math.min(1, leave * 1.4));
      glow.addColorStop(0, 'rgba(255,255,255,' + (0.55 * strength).toFixed(3) + ')');
      glow.addColorStop(0.35, 'rgba(208,191,255,' + (0.18 * strength).toFixed(3) + ')');
      glow.addColorStop(1, 'rgba(208,191,255,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(224,213,255,' + (0.7 * (1 - leave)).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(cx, cy, farthest * 1.2 * smooth(leave), 0, 6.2832); ctx.stroke();
      ctx.lineWidth = 1;
    }

    if (shown >= 100 && !leaveAt) {
      leaveAt = now;
      html.classList.remove('cosmo-loading');
      root.classList.add('is-leaving');
    }
    if (leave >= 1 || (reduced && leaveAt && now - leaveAt > 300)) finish();
  }

  function finish() {
    if (gone) return;
    gone = true;
    window.cancelAnimationFrame(frame);
    if (root.parentNode) root.parentNode.removeChild(root);
  }

  function loop(now) {
    paint(now);
    if (!gone) frame = window.requestAnimationFrame(loop);
  }
  if (reduced) {
    paint(performance.now());
    window.setInterval(function () { if (!gone) paint(performance.now()); }, 150);
  } else frame = window.requestAnimationFrame(loop);
})();

