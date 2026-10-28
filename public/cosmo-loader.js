/*
 * Cosmo loading screen for the public client pages (landing, client sign-in,
 * inquiry). Inlined into index.html so it runs before the app bundle.
 *
 * First visit in a session: a white point streaks in and hits the centre, the
 * impact blooms, light unfurls along two arms into the Cosmo spiral, the
 * wordmark writes in beside it, and once the page is ready the camera dives
 * through the core. Repeat visits get the short version (lockup, then dive).
 * The exit waits for real readiness (page parsed, loaded, app mounted via
 * window.cosmoLoader.done(), fonts), with a 10s safety reveal.
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
  var ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
  var line = root.querySelector('.cosmo-loader-line');

  var seen = false;
  try { seen = window.sessionStorage.getItem('cosmo.intro') === '1'; window.sessionStorage.setItem('cosmo.intro', '1'); } catch (e) { /* private mode */ }
  var brief = seen || reduced;

  var word = new Image(), wordReady = false;
  word.onload = function () { wordReady = true; };
  word.src = '/cosmo-wordmark.png';

  /* ---------- readiness ---------- */
  var target = 6, shownP = 0, ready = false;
  function reach(value) { if (value > target) target = Math.min(100, value); if (target >= 100) ready = true; }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { reach(30); });
  else reach(30);
  if (document.readyState === 'complete') reach(62);
  else window.addEventListener('load', function () { reach(62); });
  var finishing = false;
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
  window.setTimeout(function () { window.cosmoLoader.done(); }, 10000);

  /* ---------- maths ---------- */
  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function smooth(v) { v = clamp(v); return v * v * (3 - 2 * v); }
  function outCubic(v) { v = clamp(v); return 1 - Math.pow(1 - v, 3); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function seeded(seed) { var s = seed; return function () { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
  function gauss(rnd) { return (rnd() + rnd() + rnd() - 1.5) / 1.5; }

  // A logarithmic spiral: tight curl at the core, opening outwards, like the Cosmo mark.
  var WIND = 3.4, TIGHT = 20;
  function armAngle(arm, r) { return arm * Math.PI + WIND * Math.log(1 + r * TIGHT); }
  function armWidth(r) { return 0.022 + 0.12 * r; }

  var rnd = seeded(11), grains = [];
  for (var i = 0; i < 9000; i++) {
    var halo = rnd() < 0.14;
    grains.push([i % 2, Math.pow(rnd(), 0.85), gauss(rnd) * (halo ? 3.2 : 1), rnd(), (rnd() - 0.5) * 0.08]);
  }
  var BIRTH_GRAINS = 2600;
  function grainPoint(g, spin, grow) {
    var r = g[1] * grow;
    var a = armAngle(g[0], r) + g[4] + spin;
    var rr = r + g[2] * armWidth(g[1]) * grow;
    return [Math.cos(a) * rr, Math.sin(a) * rr];
  }
  function grainAlpha(g) { return (0.16 + 0.5 * g[3]) * (1 - g[1] * 0.72) * (1 - Math.min(1, Math.abs(g[2]) / 3.4) * 0.75); }

  var sr = seeded(91), stars = [];
  for (var k = 0; k < 240; k++) stars.push([sr(), sr(), sr(), sr() * 6.2832]);

  /* ---------- the finished spiral, rendered once and rotated ---------- */
  var bmp = null, bmpR = 0, bmpS = 0;
  function build(R) {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var S = Math.ceil(R * 2.6);
    var c = document.createElement('canvas');
    c.width = c.height = Math.ceil(S * dpr);
    var b = c.getContext('2d');
    b.scale(dpr, dpr);
    b.translate(S / 2, S / 2);
    var haze = b.createRadialGradient(0, 0, 0, 0, 0, R * 1.15);
    haze.addColorStop(0, 'rgba(232,226,255,0.14)');
    haze.addColorStop(0.4, 'rgba(178,154,245,0.05)');
    haze.addColorStop(1, 'rgba(178,154,245,0)');
    b.fillStyle = haze;
    b.beginPath(); b.arc(0, 0, R * 1.15, 0, 6.2832); b.fill();
    b.globalCompositeOperation = 'lighter';
    b.lineWidth = 0.6;
    for (var arm = 0; arm < 2; arm++) {
      for (var s = 0; s < 16; s++) {
        var off = (s / 15) * 2 - 1;
        b.strokeStyle = 'rgba(236,233,250,' + (0.035 + 0.04 * (1 - Math.abs(off))).toFixed(3) + ')';
        b.beginPath();
        for (var r = 0.015; r <= 0.97; r += 0.008) {
          var a = armAngle(arm, r), rr = (r + off * armWidth(r) * 0.85) * R;
          if (r === 0.015) b.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else b.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        b.stroke();
      }
    }
    for (var n = 0; n < grains.length; n++) {
      var g = grains[n], p = grainPoint(g, 0, 1), size = 0.45 + g[3] * 0.75;
      b.fillStyle = (g[3] > 0.9 ? 'rgba(214,200,255,' : 'rgba(245,243,252,') + grainAlpha(g).toFixed(3) + ')';
      b.fillRect(p[0] * R - size / 2, p[1] * R - size / 2, size, size);
    }
    var core = b.createRadialGradient(0, 0, 0, 0, 0, R * 0.17);
    core.addColorStop(0, 'rgba(255,255,255,0.5)');
    core.addColorStop(1, 'rgba(255,255,255,0)');
    b.fillStyle = core;
    b.beginPath(); b.arc(0, 0, R * 0.17, 0, 6.2832); b.fill();
    bmp = c; bmpR = R; bmpS = S;
  }

  /* ---------- timeline (seconds) ---------- */
  var T = brief
    ? { comet: -1, impact: -1, birthEnd: -1, name0: 0.05, name1: 0.55, end: 0.6 }
    : { comet: 0.35, impact: 1.3, birthEnd: 2.55, name0: 2.45, name1: 3.05, end: 3.1 };
  var start = 0, exitAt = 0, useWord = null, gone = false, frame = 0, ticker = 0;

  function layout(w, h) {
    var R = Math.min(w, h) * (w < 700 ? 0.21 : 0.17);
    var wordH = R * 0.52, wordW = wordH * ((word.naturalWidth / word.naturalHeight) || 5.9), gap = R * 0.32;
    if (2 * R + gap + wordW > w * 0.9) {
      var sy = h / 2 - (wordH + gap) / 2;
      return { R: R, x: w / 2, y: sy, wordX: w / 2 - wordW / 2, wordY: sy + R + gap * 0.6, wordW: wordW, wordH: wordH };
    }
    var total = 2 * R + gap + wordW, sx = w / 2 - total / 2 + R;
    return { R: R, x: sx, y: h / 2, wordX: sx + R + gap, wordY: h / 2 - wordH / 2 + R * 0.08, wordW: wordW, wordH: wordH };
  }

  function paint(now) {
    if (!start) start = now;
    var t = reduced ? T.end : (now - start) / 1000;
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#07070c';
    ctx.fillRect(0, 0, w, h);

    var L = layout(w, h), R = L.R;
    if (!bmp || Math.abs(R - bmpR) / bmpR > 0.08) build(R);
    if (useWord === null && t >= T.name0) useWord = wordReady;

    shownP = reduced ? target : shownP + (target - shownP) * 0.08;
    if (line) line.style.transform = 'scaleX(' + (shownP / 100).toFixed(3) + ')';

    if (ready && t >= T.end && !exitAt) {
      exitAt = now;
      html.classList.remove('cosmo-loading');
      root.classList.add('is-leaving');
    }
    var x = exitAt ? clamp((now - exitAt) / 900) : 0;
    var farthest = Math.hypot(w, h) / 2;
    var name = useWord ? smooth((t - T.name0) / (T.name1 - T.name0)) : 0;
    var cx = lerp(w / 2, L.x, name), cy = lerp(h / 2, L.y, name);
    var dive = x * x * x;
    cx = lerp(cx, w / 2, smooth(x)); cy = lerp(cy, h / 2, smooth(x));

    // Starfield, with a small shudder at the impact and a rush outwards on the dive.
    var impactK = T.impact >= 0 && t >= T.impact ? clamp((t - T.impact) / 0.9) : -1;
    var nudge = impactK >= 0 && impactK < 0.3 ? 2.2 * Math.sin(impactK * 60) * (1 - impactK / 0.3) : 0;
    var starIn = brief ? 1 : smooth(t / 0.4);
    for (var s = 0; s < stars.length; s++) {
      var st = stars[s];
      var tw = reduced ? 0.7 : 0.5 + 0.5 * Math.sin(t * (0.5 + st[2]) + st[3]);
      var spread = 1 + dive * 2.5;
      var px = w / 2 + (st[0] - 0.5) * w * spread + nudge, py = h / 2 + (st[1] - 0.5) * h * spread, sz = 0.5 + st[2] * 0.8;
      ctx.fillStyle = 'rgba(245,243,252,' + ((0.08 + 0.4 * tw * st[2]) * starIn * (1 - x)).toFixed(3) + ')';
      ctx.fillRect(px - sz, py - sz, sz * 2, sz * 2);
    }

    var spin = reduced ? 0 : -t * 0.08;
    var birth = T.impact >= 0 ? clamp((t - T.impact) / (T.birthEnd - T.impact)) : 1;
    var formed = brief ? smooth((t - T.name0) / 0.4) : smooth((birth - 0.7) / 0.3);
    var breathe = 1 + (reduced ? 0 : 0.015 * Math.sin(t * 1.6));
    var zoom = (1 + 11 * dive) * breathe;
    var spiralAlpha = formed * (1 - smooth((x - 0.35) / 0.65));

    // The comet: a white point curving in from the lower left and accelerating into the centre.
    if (T.comet >= 0 && t >= T.comet && t < T.impact) {
      var u = clamp((t - T.comet) / (T.impact - T.comet));
      var a0 = 2.35, from = farthest * 1.05;
      var tail = 28;
      ctx.lineCap = 'round';
      for (var j = tail; j > 0; j--) {
        var u1 = u - j * 0.016, u2 = u - (j - 1) * 0.016;
        if (u1 < 0) continue;
        var q1 = Math.pow(u1, 1.8), q2 = Math.pow(u2, 1.8);
        var fade = 1 - j / tail;
        ctx.strokeStyle = 'rgba(240,236,255,' + (0.85 * fade * fade).toFixed(3) + ')';
        ctx.lineWidth = 0.4 + 2.2 * fade;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a0 + 2.4 * q1) * from * (1 - q1), cy + Math.sin(a0 + 2.4 * q1) * from * (1 - q1));
        ctx.lineTo(cx + Math.cos(a0 + 2.4 * q2) * from * (1 - q2), cy + Math.sin(a0 + 2.4 * q2) * from * (1 - q2));
        ctx.stroke();
      }
      var q = Math.pow(u, 1.8);
      var hx = cx + Math.cos(a0 + 2.4 * q) * from * (1 - q), hy = cy + Math.sin(a0 + 2.4 * q) * from * (1 - q);
      var glow = ctx.createRadialGradient(hx, hy, 0, hx, hy, 22);
      glow.addColorStop(0, 'rgba(255,255,255,0.55)');
      glow.addColorStop(1, 'rgba(208,191,255,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(hx - 22, hy - 22, 44, 44);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(hx, hy, 2.4, 0, 6.2832); ctx.fill();
      ctx.lineWidth = 1;
    }

    // Birth: grains pour out of the impact along both arms; inner ones swing round faster.
    if (birth > 0 && birth < 1 && !brief) {
      var particleAlpha = 1 - smooth((birth - 0.8) / 0.2);
      ctx.globalCompositeOperation = 'lighter';
      for (var b = 0; b < BIRTH_GRAINS; b++) {
        var g = grains[b];
        var local = clamp((birth - g[1] * 0.55) / 0.45);
        if (local <= 0) continue;
        var e = outCubic(local);
        var r = g[1] * e;
        var ang = armAngle(g[0], r) + g[4] + spin + (1 - e) * (1.6 + 2.2 * (1 - g[1]));
        var rr = (r + g[2] * armWidth(g[1]) * e) * R * zoom;
        ctx.fillStyle = 'rgba(245,243,252,' + (grainAlpha(g) * 1.6 * Math.min(1, local * 3) * particleAlpha).toFixed(3) + ')';
        ctx.fillRect(cx + Math.cos(ang) * rr - 0.6, cy + Math.sin(ang) * rr - 0.6, 1.2, 1.2);
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    if (spiralAlpha > 0.005) {
      ctx.save();
      ctx.globalAlpha = spiralAlpha;
      ctx.translate(cx, cy);
      ctx.rotate(spin);
      ctx.scale(zoom, zoom);
      ctx.drawImage(bmp, -bmpS / 2, -bmpS / 2, bmpS, bmpS);
      ctx.restore();
    }

    // Impact: a soft bloom and one shockwave ring.
    if (impactK >= 0 && impactK < 1) {
      var bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.7);
      var strength = Math.pow(1 - impactK, 2);
      bloom.addColorStop(0, 'rgba(255,255,255,' + (0.75 * strength).toFixed(3) + ')');
      bloom.addColorStop(0.3, 'rgba(208,191,255,' + (0.22 * strength).toFixed(3) + ')');
      bloom.addColorStop(1, 'rgba(208,191,255,0)');
      ctx.fillStyle = bloom;
      ctx.fillRect(0, 0, w, h);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(224,213,255,' + (0.6 * (1 - impactK)).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(cx, cy, farthest * 1.1 * outCubic(impactK), 0, 6.2832); ctx.stroke();
      ctx.lineWidth = 1;
    }

    // The wordmark writes in beside the spiral, settling from wide and soft to the logo's spacing.
    if (useWord && name > 0) {
      var show = name * (1 - smooth(x / 0.35));
      if (show > 0.01) {
        var width = L.wordW * (1 + 0.15 * (1 - name));
        var left = L.wordX - (width - L.wordW) / 2 * (L.x === w / 2 ? 1 : 0);
        ctx.save();
        ctx.globalAlpha = clamp(show * 1.4);
        ctx.beginPath(); ctx.rect(left - 6, L.wordY - 10, (width + 12) * smooth(name * 1.2), L.wordH + 20); ctx.clip();
        if ('filter' in ctx) ctx.filter = 'blur(' + ((1 - name) * 4).toFixed(1) + 'px)';
        ctx.drawImage(word, left, L.wordY, width, L.wordH);
        ctx.restore();
      }
    }

    if (x >= 1 || (reduced && exitAt && now - exitAt > 300)) finish();
  }

  function finish() {
    if (gone) return;
    gone = true;
    window.cancelAnimationFrame(frame);
    window.clearInterval(ticker);
    html.classList.remove('cosmo-loading');
    if (root.parentNode) root.parentNode.removeChild(root);
  }

  if (!ctx) {
    ticker = window.setInterval(function () { if (ready) finish(); }, 100);
    return;
  }
  function loop(now) {
    paint(now);
    if (!gone) frame = window.requestAnimationFrame(loop);
  }
  if (reduced) {
    paint(performance.now());
    ticker = window.setInterval(function () { if (!gone) paint(performance.now()); }, 150);
  } else frame = window.requestAnimationFrame(loop);
})();

