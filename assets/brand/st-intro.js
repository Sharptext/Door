/*
  Sharptext intro animation (home page only). See st-intro.css.

  Four variants share one ending: the red thread settles into the logo's thread,
  the lines weave through it, the wordmark appears, and the logo flies into the header
  while the site comes into view. They differ in how knowing reaches doing:

    thread    knowing above, doing below; the dot wanders down, the trail straightens
    bridge    knowing left, doing right; the thread arcs across, flattens, then stands up
    loom      many lines across the screen; the thread runs through the right dots,
              weaving over and under; three of the lines become the logo's lines
    converge  knowing and doing far apart; as the line connects them they are pulled
              together and the line straightens as it draws

  Choosing a variant:
    ?intro=thread | bridge | loom | converge   force one (also replays it)
    ?intro                                     replay the default
    DEFAULT_VARIANT below                      what visitors get: a variant name, or
                                               'random' to split visitors across all four
  Each natural play sends a Google Analytics event "intro_play" (and "intro_skip"
  when skipped) with the variant name, so variants can be compared.

  Starts on scroll, wheel, touch, click or key press, or after a few seconds.
  A click or key press while it runs skips to the site. Plays once per browser
  session. The decision to play is made by the small script in the page head,
  which adds the st-intro class to <html>. When it finishes (or is skipped) it
  fires a "st-intro-done" event on document.
*/
(function () {
  var DEFAULT_VARIANT = 'thread';
  var VARIANTS = ['thread', 'bridge', 'loom', 'converge'];
  var AUTO_START_MS = 2500;

  var html = document.documentElement;
  if (!html.classList.contains('st-intro')) return;
  window.stIntroStarted = true;
  try { sessionStorage.setItem('st-intro-seen', '1'); } catch (e) {}

  var asked = /[?&]intro=([a-z]+)/.exec(location.search);
  var forced = /[?&]intro\b/.test(location.search);
  var variant = asked && VARIANTS.indexOf(asked[1]) > -1 ? asked[1] : DEFAULT_VARIANT;
  if (variant === 'random' || (asked && asked[1] === 'random')) variant = VARIANTS[Math.floor(Math.random() * VARIANTS.length)];
  if (VARIANTS.indexOf(variant) < 0) variant = 'thread';
  function track(name) {
    if (forced || window.top !== window.self || typeof window.gtag !== 'function') return;
    try { window.gtag('event', name, { intro_variant: variant }); } catch (e) {}
  }

  var dead = false, started = false, finished = false;

  var ov = document.createElement('div');
  ov.id = 'st-intro';
  ov.className = 'sti-' + variant;
  ov.setAttribute('aria-hidden', 'true');
  ov.innerHTML =
    '<svg class="sti-svg" xmlns="http://www.w3.org/2000/svg">' +
      '<g class="sti-field"></g>' +
      '<g class="sti-gaps"></g>' +
      '<path class="sti-trail"/>' +
      '<g class="sti-patches"></g>' +
      '<g class="sti-dots"></g>' +
      '<circle class="sti-node sti-k" r="7"/>' +
      '<circle class="sti-node sti-d" r="7"/>' +
      '<circle class="sti-dot" r="4.5" style="display:none"/>' +
    '</svg>' +
    '<span class="sti-label sti-lk">knowing</span>' +
    '<span class="sti-label sti-ld">doing</span>' +
    '<div class="sti-lockup"><st-logo class="st-logo"><span class="st-logo__word">sharptext</span></st-logo></div>';
  document.body.appendChild(ov);

  var NS = 'http://www.w3.org/2000/svg';
  var q = function (s) { return ov.querySelector(s); };
  var trail = q('.sti-trail'), nK = q('.sti-k'), nD = q('.sti-d'), dot = q('.sti-dot');
  var lK = q('.sti-lk'), lD = q('.sti-ld'), lock = q('.sti-lockup'), logo = q('st-logo');
  var gField = q('.sti-field'), gGaps = q('.sti-gaps'), gPatches = q('.sti-patches'), gDots = q('.sti-dots');

  // ---------- small helpers ----------
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function animate(ms, step) {
    return new Promise(function (resolve) {
      var t0 = performance.now();
      (function frame(now) {
        if (dead) return;
        var t = Math.min(1, (now - t0) / ms);
        step(t);
        if (t < 1) requestAnimationFrame(frame); else resolve();
      })(t0);
    });
  }
  var ease = function (t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var clamp01 = function (t) { return Math.max(0, Math.min(1, t)); };
  var mix = function (p, r, t) { return [lerp(p[0], r[0], t), lerp(p[1], r[1], t)]; };
  var pathD = function (pts) { return 'M' + pts.map(function (p) { return p[0].toFixed(2) + ',' + p[1].toFixed(2); }).join(' L'); };
  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function node(n, p, r) { n.setAttribute('cx', p[0]); n.setAttribute('cy', p[1]); if (r != null) n.setAttribute('r', Math.max(0, r)); }
  function label(l, x, y) { l.style.left = x + 'px'; l.style.top = y + 'px'; }
  function rgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function mixColor(a, b, t) { var x = rgb(a), y = rgb(b); return 'rgb(' + [0, 1, 2].map(function (i) { return Math.round(lerp(x[i], y[i], t)); }).join(',') + ')'; }

  // Draw the trail through pts, revealing the first `frac` of its length. Returns the point at the tip.
  function drawTrail(pts, frac, width) {
    trail.setAttribute('d', pathD(pts));
    if (width != null) trail.style.strokeWidth = width + 'px';
    var L = trail.getTotalLength();
    if (frac >= 1) { trail.style.strokeDasharray = 'none'; } else {
      trail.style.strokeDasharray = L + ' ' + (L + 1);
      trail.style.strokeDashoffset = L * (1 - frac);
    }
    var p = trail.getPointAtLength(L * clamp01(frac));
    return [p.x, p.y, L];
  }
  function moveDot(p) { dot.style.display = ''; dot.setAttribute('cx', p[0]); dot.setAttribute('cy', p[1]); }

  // ---------- geometry: the logo forms centred on screen ----------
  var G;
  function measure() {
    var W = innerWidth, H = innerHeight;
    var lr = logo.getBoundingClientRect();
    var sym = logo.querySelector('.st-logo__symbol').getBoundingClientRect();
    var left = (W - lr.width) / 2, top = (H - lr.height) / 2;
    var shift = W / 2 - (left + (sym.left - lr.left) + sym.width / 2);
    lock.style.transition = 'none';   // place it instantly, so the measurement below is final
    lock.style.left = left + 'px';
    lock.style.top = top + 'px';
    lock.style.transform = 'translateX(' + shift + 'px)';
    lock.getBoundingClientRect();
    lock.style.transition = '';
    var s = logo.querySelector('.st-logo__symbol').getBoundingClientRect();
    G = { W: W, H: H, s: s, cx: s.left + .40 * s.width, y1: s.top + .06 * s.height, y2: s.top + .94 * s.height,
          tw: .07 * s.width, ymid: s.top + .5 * s.height };
  }
  function threadPts(n) { var out = []; for (var i = 0; i < n; i++) out.push([G.cx, lerp(G.y1, G.y2, i / (n - 1))]); return out; }

  // ---------- the shared ending ----------
  async function form(linesReady) {
    ov.classList.add('sti-symbol');
    if (linesReady) ov.classList.add('sti-lines-ready');
    [trail, nK, nD, dot, gField, gGaps, gPatches, gDots].forEach(function (e) { e.style.display = 'none'; });
    await wait(80);
    ov.classList.add('sti-weave');
    await wait(linesReady ? 350 : 950);
    ov.classList.add('sti-word');
    lock.style.transform = 'translateX(0px)';
    await wait(1150);
    if (dead) return;
    var to = document.querySelector('.brand st-logo');
    if (!to) return done();
    var a = logo.getBoundingClientRect(), b = to.getBoundingClientRect();
    ov.classList.add('sti-fly');
    html.classList.add('st-intro-reveal');
    logo.style.transform = 'translate(' + (b.left - a.left) + 'px,' + (b.top - a.top) + 'px) scale(' + (b.height / a.height) + ')';
    await wait(1050);
    done();
  }

  // ---------- variants: setup() places knowing/doing; run() is the journey ----------
  var V = {};

  // 1. thread: knowing above, doing below; a wandering route that straightens.
  V.thread = {
    setup: function () {
      var g = this;
      g.yK = Math.min(G.H * .16, G.s.top - 60); g.yD = Math.max(G.H * .84, G.s.bottom + 60);
      var amp = Math.min(G.W * .3, 230), n = 5, first = Math.random() < .5 ? 1 : -1;
      g.pts = [[G.cx, g.yK]];
      for (var i = 1; i <= n; i++) {
        g.pts.push([G.cx + first * (i % 2 ? 1 : -1) * amp * (.35 + .65 * Math.random()),
                    lerp(g.yK, g.yD, i / (n + 1)) + (Math.random() - .5) * (g.yD - g.yK) / (n + 1) * .6]);
      }
      g.pts.push([G.cx, g.yD]);
      node(nK, g.pts[0]); node(nD, g.pts[g.pts.length - 1]);
      label(lK, G.cx, g.yK - 34); label(lD, G.cx, g.yD + 22);
    },
    run: async function () {
      var g = this, L = drawTrail(g.pts, 0, 1.8)[2];
      await animate(Math.min(2500, Math.max(1800, L * 2.3)), function (t) { moveDot(drawTrail(g.pts, ease(t))); });
      nD.classList.add('sti-on'); dot.style.display = 'none';
      await wait(350);
      ov.classList.add('sti-settle');
      var to = threadPts(g.pts.length);
      await animate(900, function (t) {
        var e = ease(t), now = g.pts.map(function (p, i) { return mix(p, to[i], e); });
        drawTrail(now, 1, lerp(1.8, G.tw, e));
        var r = lerp(7, 0, clamp01(e * 1.4));
        node(nK, now[0], r); node(nD, now[now.length - 1], r);
      });
      await form(false);
    }
  };

  // 2. bridge: knowing left, doing right; an arch across, which flattens and stands up.
  V.bridge = {
    setup: function () {
      var g = this, y = G.ymid, span = Math.min(G.W * .72, 900);
      g.K = [G.W / 2 - span / 2, y]; g.D = [G.W / 2 + span / 2, y];
      var C = [G.W / 2, y - span * .5];             // control point: arch rises span/4
      g.arch = [];
      for (var i = 0; i <= 40; i++) {
        var s = i / 40;
        g.arch.push([(1 - s) * (1 - s) * g.K[0] + 2 * s * (1 - s) * C[0] + s * s * g.D[0],
                     (1 - s) * (1 - s) * g.K[1] + 2 * s * (1 - s) * C[1] + s * s * g.D[1]]);
      }
      node(nK, g.K); node(nD, g.D);
      label(lK, g.K[0], y + 22); label(lD, g.D[0], y + 22);
    },
    run: async function () {
      var g = this;
      await animate(2200, function (t) { moveDot(drawTrail(g.arch, ease(t), 1.8)); });
      nD.classList.add('sti-on'); dot.style.display = 'none';
      await wait(350);
      ov.classList.add('sti-settle');
      // flatten the arch into a straight span
      var flat = g.arch.map(function (_, i) { return [lerp(g.K[0], g.D[0], i / 40), g.K[1]]; });
      await animate(600, function (t) { drawTrail(g.arch.map(function (p, i) { return mix(p, flat[i], ease(t)); }), 1, 1.8); });
      // stand it up: rotate 90 degrees, shrink to the thread's length, thicken to the thread's width
      var c0 = [(g.K[0] + g.D[0]) / 2, g.K[1]], c1 = [G.cx, (G.y1 + G.y2) / 2];
      var len0 = g.D[0] - g.K[0], len1 = G.y2 - G.y1;
      await animate(1000, function (t) {
        var e = ease(t), c = mix(c0, c1, e), a = e * Math.PI / 2, len = lerp(len0, len1, e);
        var dx = Math.cos(a) * len / 2, dy = Math.sin(a) * len / 2;
        var A = [c[0] - dx, c[1] - dy], B = [c[0] + dx, c[1] + dy];
        drawTrail([A, B], 1, lerp(1.8, G.tw, e));
        var r = lerp(7, 0, clamp01(e * 1.6));
        node(nK, A, r); node(nD, B, r);
      });
      await form(false);
    }
  };

  // 3. loom: lines of text across the screen; the thread runs through the right dots.
  V.loom = {
    setup: function () {
      var g = this, W = G.W, H = G.H;
      var R = Math.max(9, Math.min(17, Math.round(H / 56)));
      var lw = 3, top = H * .1, bot = H * .9;
      g.rows = [];
      for (var j = 0; j < R; j++) {
        var y = lerp(top, bot, j / (R - 1));
        var x0 = W * .06, x1 = W * (.94 - (Math.random() < .35 ? Math.random() * .22 : 0));
        g.rows.push({ y: y, x0: x0, x1: x1, rect: null });
      }
      // knowing on a row left of centre, doing on another right of centre; waypoints between
      var mid = Math.floor(R / 2), kr = mid - 2, dr = mid + 2;
      var xK = W * .1, xD = W * .9;
      var k = W < 600 ? 3 : 4, route = [[xK, kr]], prev = kr, dir = Math.random() < .5 ? -1 : 1;
      for (var i = 1; i <= k; i++) {
        var step = 2 + Math.floor(Math.random() * 3);
        var row = prev + dir * step;
        if (row < 1 || row > R - 2) { dir = -dir; row = prev + dir * step; }
        row = Math.max(1, Math.min(R - 2, row));
        route.push([lerp(xK, xD, i / (k + 1)) + (Math.random() - .5) * W * .05, row]);
        prev = row; dir = -dir;
      }
      route.push([xD, dr]);
      route.forEach(function (r) { var row = g.rows[r[1]]; if (row.x1 < r[0] + 24) row.x1 = Math.min(W * .94, r[0] + 60); });
      g.rows.forEach(function (r) { r.rect = el('rect', { x: r.x0, y: r.y - lw / 2, width: r.x1 - r.x0, height: lw, fill: '#DCDCD8' }, gField); });
      g.pts = route.map(function (r) { return [r[0], g.rows[r[1]].y]; });
      g.routeRows = route.map(function (r) { return r[1]; });

      // decoy dots on every line, plus the right dots on the route
      for (j = 0; j < R; j++) {
        var row2 = g.rows[j], m = 2 + Math.floor(Math.random() * 3);
        for (var d = 0; d < m; d++) {
          var x = lerp(row2.x0 + 20, row2.x1 - 20, Math.random());
          if (g.pts.some(function (p) { return Math.abs(p[0] - x) < 40 && Math.abs(p[1] - row2.y) < 2; })) continue;
          el('circle', { cx: x, cy: row2.y, r: 3.5, class: 'sti-decoy' }, gDots);
        }
      }
      g.stops = g.pts.slice(1, -1).map(function (p) { return el('circle', { cx: p[0], cy: p[1], r: 3.5, class: 'sti-decoy sti-stop' }, gDots); });

      // where the thread crosses a line: alternately over (gap in the line) and under (line patched on top)
      g.cross = []; var over = true, acc = 0;
      for (i = 0; i < g.pts.length - 1; i++) {
        var a = g.pts[i], b = g.pts[i + 1], segL = Math.hypot(b[0] - a[0], b[1] - a[1]);
        var ra = g.routeRows[i], rb = g.routeRows[i + 1], lo = Math.min(ra, rb), hi = Math.max(ra, rb);
        var rowsBetween = [];
        for (j = lo + 1; j < hi; j++) rowsBetween.push(j);
        if (rb < ra) rowsBetween.reverse();
        rowsBetween.forEach(function (jj) {
          var r = g.rows[jj], f = (r.y - a[1]) / (b[1] - a[1]), x = lerp(a[0], b[0], f);
          if (x < r.x0 + 4 || x > r.x1 - 4) return;
          var at = acc + f * segL, gw = 16;
          if (over) {
            g.cross.push({ at: at, el: el('rect', { x: x - gw / 2, y: r.y - lw / 2 - 1, width: gw, height: lw + 2, fill: '#FFFFFF', style: 'display:none' }, gGaps) });
          } else {
            var pg = el('g', {}, gPatches);
            el('rect', { x: x - gw / 2 + 2, y: r.y - lw / 2 - 4, width: gw - 4, height: lw + 8, fill: '#FFFFFF' }, pg);
            el('rect', { x: x - gw / 2, y: r.y - lw / 2, width: gw, height: lw, fill: '#DCDCD8' }, pg);
          }
          over = !over;
        });
        acc += segL;
      }
      node(nK, g.pts[0]); node(nD, g.pts[g.pts.length - 1]);
      label(lK, g.pts[0][0], g.pts[0][1] - 32); label(lD, g.pts[g.pts.length - 1][0], g.pts[g.pts.length - 1][1] + 20);

      // the three lines that will become the logo's lines: the rows nearest to them
      var targets = [.26, .50, .74].map(function (f) { return G.s.top + f * G.s.height; });
      var used = {};
      g.keep = targets.map(function (ty) {
        var best = -1, bd = 1e9;
        g.rows.forEach(function (r, idx) { if (!used[idx] && Math.abs(r.y - ty) < bd) { bd = Math.abs(r.y - ty); best = idx; } });
        used[best] = true; return best;
      });
    },
    run: async function () {
      var g = this, L = drawTrail(g.pts, 0, 2.2)[2];
      var stopAt = [], acc = 0;
      for (var i = 1; i < g.pts.length - 1; i++) { acc += Math.hypot(g.pts[i][0] - g.pts[i - 1][0], g.pts[i][1] - g.pts[i - 1][1]); stopAt.push(acc); }
      await animate(Math.min(3000, Math.max(2200, L * 1.6)), function (t) {
        var tip = drawTrail(g.pts, ease(t)), at = L * ease(t);
        moveDot(tip);
        g.cross.forEach(function (c) { if (at >= c.at) c.el.style.display = ''; });
        stopAt.forEach(function (s, k) { if (at >= s - 1) g.stops[k].classList.add('sti-on'); });
      });
      nD.classList.add('sti-on'); dot.style.display = 'none';
      await wait(450);
      ov.classList.add('sti-settle');
      // the field falls away; three lines become the logo's lines; the thread settles into place
      var to = threadPts(g.pts.length), s = G.s;
      var lineTo = [[.14, .26, .72], [.14, .50, .72], [.14, .74, .52]].map(function (v) {
        return { x: s.left + v[0] * s.width, y: s.top + v[1] * s.height, w: v[2] * s.width, h: .11 * s.height };
      });
      var from = g.keep.map(function (idx) { var r = g.rows[idx]; return { x: r.x0, y: r.y, w: r.x1 - r.x0, h: 3 }; });
      var dur = 1300;
      await animate(dur, function (t) {
        var e = ease(t), fade = 1 - clamp01(t * 2.2);
        gDots.style.opacity = fade; gPatches.style.opacity = fade; gGaps.style.opacity = fade;
        g.rows.forEach(function (r, idx) { if (g.keep.indexOf(idx) < 0) r.rect.style.opacity = fade; });
        g.keep.forEach(function (idx, k) {
          var a = from[k], b = lineTo[k], h = lerp(a.h, b.h, e), y = lerp(a.y, b.y, e);
          var rr = g.rows[idx].rect;
          rr.setAttribute('x', lerp(a.x, b.x, e)); rr.setAttribute('width', lerp(a.w, b.w, e));
          rr.setAttribute('y', y - h / 2); rr.setAttribute('height', h);
          rr.setAttribute('fill', mixColor('#DCDCD8', '#16191D', e));
        });
        // the thread straightens a beat later than the field moves
        var e2 = ease(clamp01((t - .15) / .85)), now = g.pts.map(function (p, i) { return mix(p, to[i], e2); });
        drawTrail(now, 1, lerp(2.2, G.tw, e2));
        var r = lerp(7, 0, clamp01(t * 2));
        node(nK, now[0], r); node(nD, now[now.length - 1], r);
      });
      await form(true);
    }
  };

  // 4. converge: knowing and doing far apart; drawn together as the line connects them.
  V.converge = {
    setup: function () {
      var g = this;
      g.yK = Math.min(G.H * .1, G.s.top - 80); g.yD = Math.max(G.H * .9, G.s.bottom + 80);
      var amp = Math.min(G.W * .34, 260), n = 6, first = Math.random() < .5 ? 1 : -1;
      g.pts = [[G.cx, g.yK]];
      for (var i = 1; i <= n; i++) {
        g.pts.push([G.cx + first * (i % 2 ? 1 : -1) * amp * (.45 + .55 * Math.random()), lerp(g.yK, g.yD, i / (n + 1))]);
      }
      g.pts.push([G.cx, g.yD]);
      node(nK, g.pts[0]); node(nD, g.pts[g.pts.length - 1]);
      label(lK, G.cx, g.yK - 34); label(lD, G.cx, g.yD + 22);
    },
    run: async function () {
      var g = this, to = threadPts(g.pts.length);
      // labels travel with their points
      await animate(3000, function (t) {
        var draw = ease(t), pull = ease(clamp01(t * 1.05));
        var now = g.pts.map(function (p, i) { return mix(p, to[i], pull); });
        var tip = drawTrail(now, draw, lerp(1.8, G.tw, Math.pow(pull, 3)));
        if (t < .97) moveDot(tip); else dot.style.display = 'none';
        if (t > .9) nD.classList.add('sti-on');
        var r = t < .8 ? 7 : lerp(7, 0, (t - .8) / .2);
        node(nK, now[0], r); node(nD, now[now.length - 1], r);
        label(lK, now[0][0], now[0][1] - 34); label(lD, now[now.length - 1][0], now[now.length - 1][1] + 22);
        if (t > .7) ov.classList.add('sti-settle');
      });
      await form(false);
    }
  };

  // ---------- lifecycle ----------
  function done(skipped) {
    if (finished) return;
    finished = true; dead = true;
    if (skipped) track('intro_skip');
    html.classList.remove('st-intro', 'st-intro-reveal');
    if (ov.parentNode) ov.parentNode.removeChild(ov);
    ['wheel', 'touchmove', 'pointerdown', 'keydown', 'scroll'].forEach(function (ev) { window.removeEventListener(ev, trigger); });
    window.removeEventListener('pointerdown', skip);
    window.removeEventListener('keydown', skip);
    window.removeEventListener('resize', skip);
    window.stIntroDone = true;
    document.dispatchEvent(new Event('st-intro-done'));
  }
  function skip() { done(true); }

  function trigger() {
    if (started || dead) return;
    started = true;
    setTimeout(function () {
      window.addEventListener('pointerdown', skip);
      window.addEventListener('keydown', skip);
    }, 0);
    V[variant].run().catch(function () { done(); });
  }

  function ready() {
    if (dead) return;
    try { measure(); V[variant].setup(); } catch (e) { return done(); }
    ov.getBoundingClientRect();   // reflow, then fade in knowing and doing
    ov.classList.add('sti-ready');
    track('intro_play');
    window.addEventListener('resize', skip);
    ['wheel', 'touchmove', 'pointerdown', 'keydown', 'scroll'].forEach(function (ev) {
      window.addEventListener(ev, trigger, { passive: true });
    });
    setTimeout(trigger, AUTO_START_MS);
  }

  // Wait for the logo component and the wordmark font so the geometry is final.
  var fontReady = document.fonts && document.fonts.load ? document.fonts.load('600 64px "Schibsted Grotesk"') : Promise.resolve();
  Promise.race([
    Promise.all([customElements.whenDefined('st-logo'), fontReady]),
    wait(1500)
  ]).then(function () { requestAnimationFrame(ready); }, function () { requestAnimationFrame(ready); });
})();
