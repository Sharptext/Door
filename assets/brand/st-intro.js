/*
  Sharptext intro animation (home page only). See st-intro.css and st-loom.js.

  All variants share one ending: the red thread settles into the logo's thread, the
  lines are in place, the wordmark appears, and the logo flies into the header while
  the site comes into view. They differ in how knowing reaches doing:

    loom      lines across the screen; the thread runs through three right dots and
              each line it touches thickens: those three become the logo's lines
    warp      the same with vertical threads; the thread weaves across them and the
              composition turns a quarter so the touched threads become the lines
    net       a wavy net of vertical and horizontal threads; the thread finds three
              nodes, their threads thicken, and the nodes align into the logo's thread
    thread    knowing above, doing below; the dot wanders down, the trail straightens
    bridge    knowing left, doing right; the thread arcs across, flattens, stands up
    converge  knowing and doing far apart, pulled together as the line connects them

  In the loom variants the lines that were not touched stay behind as the page's
  woven background (drawn by st-loom.js).

  Which variant plays is decided by the small script in the page head (see
  DEFAULT_VARIANT there; ?intro=<variant> forces one). Each natural play sends a
  Google Analytics event "intro_play" (and "intro_skip" when skipped) with the
  variant name, so variants can be compared.

  Starts on scroll, wheel, touch, click or key press, or after a few seconds.
  A click or key press while it runs skips to the site. Plays once per browser
  session. When it finishes (or is skipped) it fires "st-intro-done" on document.
*/
(function () {
  var AUTO_START_MS = 2500;

  var html = document.documentElement;
  if (!html.classList.contains('st-intro')) return;
  window.stIntroStarted = true;
  try { sessionStorage.setItem('st-intro-seen', '1'); } catch (e) {}

  var forced = /[?&]intro(=|&|$)/.test(location.search);
  var variant = window.stIntroVariant || 'loom';
  // The intro's loom lines up with the page's loom, which starts at the top of the page.
  try { history.scrollRestoration = 'manual'; } catch (e) {}
  window.scrollTo(0, 0);
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
  async function form(opts) {
    opts = opts || {};
    ov.classList.add('sti-symbol');
    if (opts.linesReady) ov.classList.add('sti-lines-ready');
    var hide = [trail, nK, nD, dot, gGaps, gPatches, gDots];
    if (!opts.keepField) hide.push(gField);
    hide.forEach(function (e) { e.style.display = 'none'; });
    Array.prototype.forEach.call(ov.querySelectorAll('.sti-touched'), function (e) { e.style.display = 'none'; });
    await wait(80);
    ov.classList.add('sti-weave');
    await wait(opts.linesReady ? 350 : 950);
    ov.classList.add('sti-word');
    lock.style.transform = 'translateX(0px)';
    await wait(1150);
    if (dead) return;
    var to = document.querySelector('.brand st-logo');
    if (!to) return done();
    var a = logo.getBoundingClientRect(), b = to.getBoundingClientRect();
    ov.classList.add('sti-fly');
    html.classList.add('st-intro-reveal');
    if (opts.keepField) { gField.style.transition = 'opacity .9s ease'; gField.style.opacity = '0'; }
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
      await form();
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
      await form();
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
      await form();
    }
  };

  // ---------- the loom family: loom (rows), warp (columns), net ----------
  var LINE = '#DCDCD8', LINE_BG = '#EFEFEF', INK = '#16191D';
  function loomVariant(type) {
    return {
      setup: function () {
        var g = this, W = G.W, H = G.H + 60, svg = q('.sti-svg');
        g.type = type;
        g.loom = window.stLoom.build(type, W, H);
        g.lw = type === 'net' ? 2 : 2.5;
        g.lines = g.loom.lines;
        g.lines.forEach(function (l) { l.el = el('path', { d: pathD(l.pts), fill: 'none', stroke: LINE, 'stroke-width': g.lw }, gField); });

        // masks make the weave: gaps in the lines (thread over) and in the thread (thread under)
        var defs = el('defs', {}, svg);
        g.mLines = el('mask', { id: 'sti-m-lines', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H }, defs);
        el('rect', { width: W, height: H, fill: '#fff' }, g.mLines);
        g.mThread = el('mask', { id: 'sti-m-thread', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H }, defs);
        el('rect', { width: W, height: H, fill: '#fff' }, g.mThread);
        gField.setAttribute('mask', 'url(#sti-m-lines)');
        trail.setAttribute('mask', 'url(#sti-m-thread)');

        // the route: knowing, three right dots, doing
        var xsF = [.07, .3, .5, .7, .93].map(function (f, i) { return G.W * f + (i && i < 4 ? (Math.random() - .5) * G.W * .06 : 0); });
        var stops = [];
        if (type === 'rows') {
          var cand = g.lines.filter(function (l) { return l.pts[0][1] > G.H * .18 && l.pts[0][1] < G.H * .82; }).map(function (l) { return l.idx; });
          var picks = walk(cand, 5);
          stops = picks.map(function (j, i) { return { p: [xsF[i], g.lines[j].pts[0][1]], line: g.lines[j] }; });
        } else if (type === 'columns') {
          var ys = zig(5, G.H * .22, G.H * .78);
          stops = xsF.map(function (x, i) {
            if (i === 0 || i === 4) return { p: [x, ys[i]], line: null };
            var sn = g.loom.snap([x, ys[i]]); return { p: sn.p, line: sn.line };
          });
          // distinct columns for the three stops
          for (var i = 2; i < 4; i++) if (stops[i].line === stops[i - 1].line) { var sn2 = g.loom.snap([stops[i].p[0] + window.stLoom.S, ys[i]]); stops[i] = { p: sn2.p, line: sn2.line }; }
        } else {
          var rowsOk = [];
          for (var j = 0; j < g.loom.rows; j++) { var yy = g.loom.node(0, j)[1]; if (yy > G.H * .18 && yy < G.H * .82) rowsOk.push(j); }
          var rp = walk(rowsOk, 5);
          stops = xsF.map(function (x, i) { var sn = g.loom.snap([x, g.loom.node(0, rp[i])[1]]); return { p: sn.p, line: sn.line }; });
        }
        g.stops = stops;
        g.pts = stops.map(function (st) { return st.p; });
        if (type !== 'columns') { stops[0].line = null; stops[4].line = null; }   // knowing and doing sit on lines but don't touch them

        // the right dots and the decoys
        g.stopDots = stops.slice(1, 4).map(function (st) { return el('circle', { cx: st.p[0], cy: st.p[1], r: 3.5, class: 'sti-decoy sti-stop' }, gDots); });
        decoys(g);

        // weave crossings along the route
        g.over = [];
        var flip = true;
        window.stLoom.crossings(g.pts, g.lines, 6).forEach(function (c) {
          if (stops.some(function (st) { return st.line === c.line; })) return;   // the touched lines are crossed at their dots
          if (flip) g.over.push({ at: c.at, el: el('circle', { cx: c.x, cy: c.y, r: 0, fill: '#000' }, g.mLines) });
          else el('circle', { cx: c.x, cy: c.y, r: g.lw / 2 + 2.5, fill: '#000' }, g.mThread);
          flip = !flip;
        });

        node(nK, g.pts[0]); node(nD, g.pts[4]);
        if (type === 'columns') { label(lK, g.pts[0][0], g.pts[0][1] - 32); label(lD, g.pts[4][0], g.pts[4][1] - 32); }
        else { label(lK, g.pts[0][0], g.pts[0][1] - 32); label(lD, g.pts[4][0], g.pts[4][1] + 20); }
      },
      run: async function () {
        var g = this, L = drawTrail(g.pts, 0, 2.2)[2];
        var stopAt = [], acc = 0;
        for (var i = 1; i < g.pts.length; i++) { acc += Math.hypot(g.pts[i][0] - g.pts[i - 1][0], g.pts[i][1] - g.pts[i - 1][1]); stopAt.push(acc); }
        var touched = [false, false, false];
        await animate(Math.min(3200, Math.max(2400, L * 1.7)), function (t) {
          var at = L * ease(t), tip = drawTrail(g.pts, ease(t));
          moveDot(tip);
          g.over.forEach(function (o) { if (at >= o.at) o.el.setAttribute('r', 4.5); });
          for (var k = 0; k < 3; k++) if (!touched[k] && at >= stopAt[k] - 1) { touched[k] = true; touch(g, k); }
        });
        nD.classList.add('sti-on'); dot.style.display = 'none';
        await wait(450);
        ov.classList.add('sti-settle');
        gField.removeAttribute('mask'); trail.removeAttribute('mask');
        g.lines.forEach(function (l) { l.el.style.transition = 'none'; });

        // the touched lines take their place as the logo's lines; rank top to bottom (left to right for the warp)
        var s = G.s, key = g.type === 'columns' ? 0 : 1;
        var order = [0, 1, 2].sort(function (a, b) { return g.stops[a + 1].p[key] - g.stops[b + 1].p[key]; });
        var rank = []; order.forEach(function (stopIdx, r) { rank[stopIdx] = r; });
        var logoY = [.26, .50, .74].map(function (f) { return s.top + f * s.height; });
        var logoX0 = s.left + .14 * s.width, logoX1 = [s.left + .86 * s.width, s.left + .86 * s.width, s.left + .66 * s.width];
        var lh = .11 * s.height;
        var moves = g.stops.slice(1, 4).map(function (st, k) {
          var r = rank[k], l = st.line, n = l.pts.length;
          var from = l.pts.map(function (p) { return p.slice(); });
          var A = [logoX0, logoY[r]], B = [logoX1[r], logoY[r]];
          return { l: l, from: from, A: A, B: B, n: n };
        });
        var to = g.pts.map(function (p, i) {
          if (i === 0) return [G.cx, G.y1];
          if (i === 4) return [G.cx, G.y2];
          return [G.cx, logoY[rank[i - 1]]];
        });
        var w0 = g.lw * 2.4;
        await animate(1400, function (t) {
          var e = ease(t), fade = 1 - clamp01(t * 2.2);
          gDots.style.opacity = fade;
          g.lines.forEach(function (l) {
            if (l.touched) return;
            l.el.setAttribute('stroke', mixColor(LINE, LINE_BG, clamp01(t * 1.5)));
            l.el.setAttribute('stroke-width', lerp(g.lw, 1, clamp01(t * 1.5)));
          });
          moves.forEach(function (m) {
            var pts;
            if (g.type === 'columns') {
              // turn a quarter, clockwise, while shrinking to the logo line
              var c0 = [(m.from[0][0] + m.from[1][0]) / 2, (m.from[0][1] + m.from[1][1]) / 2], c1 = [(m.A[0] + m.B[0]) / 2, m.A[1]];
              var len0 = Math.abs(m.from[1][1] - m.from[0][1]), len1 = m.B[0] - m.A[0];
              var c = mix(c0, c1, e), a = Math.PI / 2 + e * Math.PI / 2, len = lerp(len0, len1, e);
              var dx = Math.cos(a) * len / 2, dy = Math.sin(a) * len / 2;
              pts = [[c[0] - dx, c[1] - dy], [c[0] + dx, c[1] + dy]];
            } else {
              pts = m.from.map(function (p, i) { var u = m.n > 1 ? i / (m.n - 1) : 0; return mix(p, [lerp(m.A[0], m.B[0], u), m.A[1]], e); });
            }
            m.l.el.setAttribute('d', pathD(pts));
            m.l.el.setAttribute('stroke-width', lerp(w0, lh, e));
          });
          var e2 = ease(clamp01((t - .1) / .9)), now = g.pts.map(function (p, i) { return mix(p, to[i], e2); });
          drawTrail(now, 1, lerp(2.2, G.tw, e2));
          var r = lerp(7, 0, clamp01(t * 2));
          node(nK, now[0], r); node(nD, now[4], r);
        });
        await form({ linesReady: true, keepField: true });
      }
    };
  }
  // a random walk through candidate indices: distinct, consecutive picks at least 2 apart
  function walk(cand, n) {
    var out = [], tries = 0;
    while (out.length < n && tries < 500) {
      tries++;
      var c = cand[Math.floor(Math.random() * cand.length)];
      if (out.indexOf(c) > -1) continue;
      if (out.length && Math.abs(c - out[out.length - 1]) < 2) continue;
      out.push(c);
    }
    while (out.length < n) out.push(cand[out.length % cand.length]);
    return out;
  }
  function zig(n, lo, hi) {
    var out = [], up = Math.random() < .5;
    for (var i = 0; i < n; i++) { var f = up ? .1 + .3 * Math.random() : .6 + .3 * Math.random(); out.push(lerp(lo, hi, f)); up = !up; }
    return out;
  }
  function decoys(g) {
    var W = G.W, H = G.H;
    if (g.type === 'net') {
      for (var i = 0; i < g.loom.cols; i++) for (var j = 0; j < g.loom.rows; j++) {
        if (Math.random() > .3) continue;
        var p = g.loom.node(i, j);
        if (p[1] > H) continue;
        if (g.pts.some(function (q) { return Math.hypot(q[0] - p[0], q[1] - p[1]) < 20; })) continue;
        el('circle', { cx: p[0], cy: p[1], r: 2.5, class: 'sti-decoy' }, gDots);
      }
      return;
    }
    g.lines.forEach(function (l) {
      var m = 2 + Math.floor(Math.random() * 3);
      for (var d = 0; d < m; d++) {
        var u = .05 + .9 * Math.random();
        var p = [lerp(l.pts[0][0], l.pts[l.pts.length - 1][0], u), lerp(l.pts[0][1], l.pts[l.pts.length - 1][1], u)];
        if (p[1] > H || p[1] < 0) continue;
        if (g.pts.some(function (q) { return Math.hypot(q[0] - p[0], q[1] - p[1]) < 36; })) continue;
        el('circle', { cx: p[0], cy: p[1], r: 3.5, class: 'sti-decoy' }, gDots);
      }
    });
  }
  // the thread touches a line at a right dot: the line thickens and darkens
  function touch(g, k) {
    var st = g.stops[k + 1];
    g.stopDots[k].classList.add('sti-on');
    if (!st.line) return;
    st.line.touched = true;
    st.line.el.classList.add('sti-touched');
    st.line.el.style.transition = 'stroke .45s ease, stroke-width .45s ease';
    st.line.el.setAttribute('stroke', INK);
    st.line.el.setAttribute('stroke-width', g.lw * 2.4);
  }
  V.loom = loomVariant('rows');
  V.warp = loomVariant('columns');
  V.net = loomVariant('net');

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
