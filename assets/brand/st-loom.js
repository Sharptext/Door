/*
  The loom: the woven background of the page, and the geometry the intro shares with it.

  - stLoom.build(type, W, H) returns the lines of a loom covering W x H:
      'rows'     horizontal lines, like lines of text            (intro variant: loom)
      'columns'  vertical lines, like the warp on a loom          (intro variant: warp)
      'net'      wavy horizontal and vertical lines               (intro variants: net-h, net-v)
    The same function draws the intro's loom and the page background, so the lines
    the intro leaves behind are exactly the page's lines.
  - stLoom.heroRoute(...) finds the red thread's route in the hero: from the word
    "knowing", through three right points on the loom, to the word "doing".
  - stLoom.crossings(path, lines) finds where a thread crosses the lines, so it can
    go alternately over and under them.
  - The page background is built on load: the faint loom behind all of main (a static
    layer, drawn once), and the red thread on a layer of its own. The thread runs from
    "knowing" to "doing", and from "doing" on it is drawn as the page scrolls: down
    the side margins, across between sections, ending where "Let's talk" begins.
*/
(function () {
  var NS = 'http://www.w3.org/2000/svg';
  var S = 56;                              // spacing of rows and columns
  var NET = { S: 64, A: 9, L: 320 };       // net spacing, wave amplitude and wavelength
  var lerp = function (a, b, t) { return a + (b - a) * t; };

  function typeFor(variant) { return variant === 'warp' ? 'columns' : /^net/.test(variant || '') ? 'net' : 'rows'; }
  function axisFor(variant) { return variant === 'warp' || variant === 'net-v' ? 'v' : 'h'; }

  // A small seeded random generator, so the intro and the page pick the same route.
  function seeded(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function sessionSeed() {
    var s = null;
    try { s = sessionStorage.getItem('st-loom-seed'); } catch (e) {}
    if (!s) { s = String(Math.floor(Math.random() * 1e9)); try { sessionStorage.setItem('st-loom-seed', s); } catch (e) {} }
    return parseInt(s, 10);
  }

  function netRowY(j, x) { return NET.S / 2 + j * NET.S + NET.A * Math.sin(2 * Math.PI * x / NET.L + j * 1.9); }
  function netColX(i, y, x0) { return x0 + i * NET.S + NET.A * Math.sin(2 * Math.PI * y / NET.L + i * 2.3); }

  function build(type, W, H) {
    var lines = [], i, j, x, y, n;
    if (type === 'columns') {
      n = Math.floor(W / S);
      var cx0 = (W - n * S) / 2 + S / 2;
      for (i = 0; i < n; i++) { x = cx0 + i * S; lines.push({ dir: 'v', idx: i, pts: [[x, 0], [x, H]] }); }
      return { type: type, lines: lines, x0: cx0, n: n };
    }
    if (type === 'net') {
      var rows = Math.ceil(H / NET.S) + 1, cols = Math.floor(W / NET.S);
      var nx0 = (W - cols * NET.S) / 2 + NET.S / 2;
      for (j = 0; j < rows; j++) {
        var rp = [];
        for (x = 0; x <= W + 16; x += 16) rp.push([x, netRowY(j, x)]);
        lines.push({ dir: 'h', idx: j, pts: rp });
      }
      for (i = 0; i < cols; i++) {
        var cp = [];
        for (y = 0; y <= H + 16; y += 16) cp.push([netColX(i, y, nx0), y]);
        lines.push({ dir: 'v', idx: i, pts: cp });
      }
      var node = function (i, j) {          // where column i meets row j
        var px = nx0 + i * NET.S, py = NET.S / 2 + j * NET.S;
        for (var k = 0; k < 6; k++) { py = netRowY(j, px); px = netColX(i, py, nx0); }
        return [px, py];
      };
      return { type: type, lines: lines, rows: rows, cols: cols, node: node,
        row: function (j) { return lines[j]; }, col: function (i) { return lines[rows + i]; } };
    }
    for (j = 0, y = S / 2; y <= H + S; y += S, j++) lines.push({ dir: 'h', idx: j, pts: [[0, y], [W, y]] });
    return { type: 'rows', lines: lines };
  }

  // ---------- the hero route: knowing -> three right points -> doing ----------
  function heroRoute(loom, W, axis, rand, sy) {
    var k = document.getElementById('kd-knowing'), d = document.getElementById('kd-doing');
    if (!k || !d) return null;
    sy = sy || 0;
    var kr = k.getBoundingClientRect(), dr = d.getBoundingClientRect();
    var fs = parseFloat(getComputedStyle(k).fontSize) || 60, gap = Math.max(10, fs * .16);
    var K = [kr.right + gap, kr.top + sy + kr.height * .56], D = [dr.left - gap, dr.top + sy + dr.height * .56];
    var pad = W <= 760 ? 22 : 32;
    var wide = D[0] - K[0] > 220;
    var xs, y0, y1;
    if (wide) {   // room between the words: the thread runs across between them
      xs = [.25, .5, .75].map(function (f) { return lerp(K[0], D[0], f) + (rand() - .5) * (D[0] - K[0]) * .08; });
      y0 = K[1] - 50; y1 = D[1] + 20;
    } else {      // narrow screens: the thread zig-zags in the space between the two lines
      xs = [lerp(K[0], W - pad, .55), pad + (W - 2 * pad) * .15, lerp(pad, D[0], .65)];
      y0 = kr.bottom + sy + 10; y1 = dr.top + sy - 10;
    }
    var stops = [];
    if (loom.type === 'rows') {
      var cand = loom.lines.filter(function (l) { return l.pts[0][1] >= y0 && l.pts[0][1] <= y1; });
      var picks = pick(cand.length, 3, rand);
      stops = picks.map(function (ci, i) { return { p: [xs[i], cand[ci].pts[0][1]], line: cand[ci] }; });
    } else if (loom.type === 'columns') {
      var used = {};
      stops = xs.map(function (x, i) {
        var best = null, bd = 1e9;
        loom.lines.forEach(function (l) { var dx = Math.abs(l.pts[0][0] - x); if (!used[l.idx] && dx < bd) { bd = dx; best = l; } });
        used[best.idx] = true;
        var f = i % 2 ? .2 + .25 * rand() : .55 + .3 * rand();
        return { p: [best.pts[0][0], lerp(y0, y1, f)], line: best };
      });
    } else {
      var nodes = [];
      for (var j = 0; j < loom.rows; j++) for (var i = 0; i < loom.cols; i++) {
        var p = loom.node(i, j);
        if (p[1] >= y0 && p[1] <= y1 && p[0] > pad && p[0] < W - pad) nodes.push({ p: p, i: i, j: j });
      }
      var usedR = {}, usedC = {};
      stops = xs.map(function (x, n) {
        var ty = lerp(y0, y1, n % 2 ? .25 : .75), best = null, bd = 1e9;
        nodes.forEach(function (nd) {
          if (usedR[nd.j] || usedC[nd.i]) return;
          var dd = Math.hypot(nd.p[0] - x, nd.p[1] - ty);
          if (dd < bd) { bd = dd; best = nd; }
        });
        if (!best) best = nodes[n % nodes.length];
        usedR[best.j] = true; usedC[best.i] = true;
        return { p: best.p, line: axis === 'v' ? loom.col(best.i) : loom.row(best.j) };
      });
    }
    return { K: K, D: D, stops: stops, pts: [K].concat(stops.map(function (s) { return s.p; }), [D]) };
  }
  // pick n distinct indices out of m, in a zig-zag order where possible
  function pick(m, n, rand) {
    var idx = []; for (var i = 0; i < m; i++) idx.push(i);
    for (i = idx.length - 1; i > 0; i--) { var j = Math.floor(rand() * (i + 1)); var t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
    var out = idx.slice(0, Math.min(n, m));
    while (out.length < n) out.push(out[out.length - 1] || 0);
    return out;
  }

  function segInt(a, b, c, d) {
    var rx = b[0] - a[0], ry = b[1] - a[1], sx = d[0] - c[0], sy = d[1] - c[1];
    var den = rx * sy - ry * sx;
    if (Math.abs(den) < 1e-9) return null;
    var qx = c[0] - a[0], qy = c[1] - a[1];
    var t = (qx * sy - qy * sx) / den, u = (qx * ry - qy * rx) / den;
    if (t < 0 || t > 1 || u < 0 || u > 1) return null;
    return [a[0] + t * rx, a[1] + t * ry, t];
  }

  // Where a thread (polyline) crosses the lines; skips crossings within `near` px of the thread's own points.
  function crossings(path, lines, near) {
    near = near == null ? 6 : near;
    lines.forEach(function (l) {
      if (l.box) return;
      var xs = l.pts.map(function (p) { return p[0]; }), ys = l.pts.map(function (p) { return p[1]; });
      l.box = [Math.min.apply(null, xs), Math.min.apply(null, ys), Math.max.apply(null, xs), Math.max.apply(null, ys)];
    });
    var out = [], acc = 0;
    for (var k = 0; k < path.length - 1; k++) {
      var a = path[k], b = path[k + 1], segL = Math.hypot(b[0] - a[0], b[1] - a[1]);
      var bx0 = Math.min(a[0], b[0]), bx1 = Math.max(a[0], b[0]), by0 = Math.min(a[1], b[1]), by1 = Math.max(a[1], b[1]);
      lines.forEach(function (l) {
        if (l.box[2] < bx0 - 1 || l.box[0] > bx1 + 1 || l.box[3] < by0 - 1 || l.box[1] > by1 + 1) return;
        for (var m = 0; m < l.pts.length - 1; m++) {
          var p = segInt(a, b, l.pts[m], l.pts[m + 1]);
          if (!p) continue;
          if (Math.hypot(p[0] - a[0], p[1] - a[1]) < near || Math.hypot(p[0] - b[0], p[1] - b[1]) < near) continue;
          out.push({ x: p[0], y: p[1], at: acc + p[2] * segL, line: l });
        }
      });
      acc += segL;
    }
    out.sort(function (p, q) { return p.at - q.at; });
    return out;
  }

  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  var pathD = function (pts) { return 'M' + pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' L'); };

  // ---------- the page background ----------
  var state = null, GAP = 6;

  function buildPage() {
    var main = document.querySelector('main');
    if (!main) return;
    ['st-loom', 'st-thread'].forEach(function (id) { var o = document.getElementById(id); if (o) o.parentNode.removeChild(o); });

    var W = document.documentElement.clientWidth;
    var sy = window.scrollY || 0;
    var H = Math.round(main.getBoundingClientRect().bottom + sy);
    var variant = window.stIntroVariant;
    var loom = build(typeFor(variant), W, H);

    // The hero part of the route: the intro's own route if it has just drawn one, else the same choice made here.
    var hero = window.stIntroRoute && Math.abs(window.stIntroRoute.W - W) < 24 ? window.stIntroRoute
      : heroRoute(loom, W, axisFor(variant), seeded(sessionSeed()), sy);
    var secs = Array.prototype.slice.call(main.querySelectorAll(':scope > section'));
    if (!hero) return;

    // From "doing" the thread goes word to word: it runs underneath the key words of each
    // section (marked .thread-mark), which take its colour as it reaches them, and ends
    // where "Let's talk" begins.
    var route = hero.pts.slice(), D = hero.D, heroEnd = route.length - 1;
    var html = document.documentElement;
    html.classList.add('st-measuring');            // measure without the scroll-in offsets
    var marks = Array.prototype.slice.call(main.querySelectorAll('.thread-mark')).map(function (m) {
      var rs = m.getClientRects(), a = rs[0], z = rs[rs.length - 1];
      var y = a.bottom + sy - 1;
      return { el: m, from: [a.left - 4, y], to: [z.right + 4, z.bottom + sy - 1] };
    });
    var talk = document.getElementById('talk');
    var end = talk ? [W / 2, talk.getBoundingClientRect().top + sy] : null;
    html.classList.remove('st-measuring');
    var markAt = [];
    marks.forEach(function (m) { markAt.push(route.length); route.push(m.from, m.to); });
    if (end) route.push(end);
    if (secs.length < 1) return;

    // Layer 1 (static, drawn once): the loom, with gaps where the thread goes over it.
    var svg = el('svg', { id: 'st-loom', 'aria-hidden': 'true', width: W, height: H, viewBox: '0 0 ' + W + ' ' + H });
    var mLines = el('mask', { id: 'stl-m-lines', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H }, el('defs', {}, svg));
    el('rect', { width: W, height: H, fill: '#fff' }, mLines);
    var gLines = el('g', { class: 'stl-lines', mask: 'url(#stl-m-lines)' }, svg);
    loom.lines.forEach(function (l) { el('path', { d: pathD(l.pts) }, gLines); });

    // Layer 2 (redrawn on scroll): the thread. Gaps where it goes under are part of its dash pattern.
    var tsvg = el('svg', { id: 'st-thread', 'aria-hidden': 'true', width: W, height: H, viewBox: '0 0 ' + W + ' ' + H });
    var thread = el('path', { class: 'stl-thread', d: pathD(route) }, tsvg);
    var stops = route.map(function (p, i) {
      var cls = 'stl-stop', r = 3;
      if (i === 0) { cls += ' stl-node'; r = 6; }
      else if (i === heroEnd) { cls += ' stl-node stl-node-d'; r = 6; }
      else if (i < heroEnd) r = 3.5;
      else if (i === route.length - 1) r = 4.5;
      else r = 0;                      // the underlines need no dots
      return el('circle', { class: cls, cx: p[0], cy: p[1], r: r }, tsvg);
    });
    var tip = el('circle', { class: 'stl-tip', r: 3.5 }, tsvg);

    var unders = [], flip = true;
    crossings(route, loom.lines, 6).forEach(function (c) {
      if (flip) el('circle', { cx: c.x, cy: c.y, r: 3.5, fill: '#000' }, mLines);
      else unders.push(c.at);
      flip = !flip;
    });

    document.body.appendChild(svg);
    document.body.appendChild(tsvg);

    var cum = [0];
    for (k = 1; k < route.length; k++) cum.push(cum[k - 1] + Math.hypot(route[k][0] - route[k - 1][0], route[k][1] - route[k - 1][1]));
    // Reveal by height: a vertex is reached when the page has scrolled it up to the drawing point.
    // Going up (or along a line) never waits: such stretches appear once the point before them is reached.
    var reach = [], hi = -1e9;
    route.forEach(function (p) { hi = Math.max(hi, p[1]); reach.push(hi); });
    state = { route: route, cum: cum, reach: reach, total: cum[cum.length - 1], heroEnd: heroEnd, D: D, thread: thread, stops: stops, tip: tip, unders: unders, marks: marks, markAt: markAt, last: -1 };
    draw(true);
  }

  // The drawn length: the hero part is always there; past "doing" it follows the scroll,
  // with the drawing point fixed at the height "doing" has on screen.
  function visibleLength() {
    var s = state;
    if (calm) return s.total;
    var y = s.D[1] - 1 + (window.scrollY || 0), R = s.reach, c = s.cum;
    for (var k = s.heroEnd + 1; k < R.length; k++) {
      if (y < R[k]) {
        var dy = R[k] - R[k - 1];
        var f = dy > 0 ? Math.max(0, (y - R[k - 1]) / dy) : 1;
        return c[k - 1] + f * (c[k] - c[k - 1]);
      }
    }
    return s.total;
  }
  function dashes(L) {
    var out = [], pos = 0, list = state.unders;
    for (var i = 0; i < list.length && list[i] - GAP / 2 < L; i++) {
      out.push(Math.max(0, list[i] - GAP / 2 - pos), GAP);
      pos = list[i] + GAP / 2;
    }
    out.push(Math.max(0, L - pos), state.total + 10);
    return out.join(' ');
  }

  var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function draw(force) {
    if (!state) return;
    var L = Math.max(state.cum[state.heroEnd], visibleLength());
    if (!force && Math.abs(L - state.last) < .5) return;
    state.last = L;
    state.thread.setAttribute('stroke-dasharray', dashes(L));
    var p = state.thread.getPointAtLength(L);
    state.tip.setAttribute('cx', p.x); state.tip.setAttribute('cy', p.y);
    state.tip.style.display = L > state.cum[state.heroEnd] + 1 && L < state.total ? '' : 'none';
    state.cum.forEach(function (c, i) {
      var on = L >= c - .5, e = state.stops[i];
      if (e.__on !== on) { e.__on = on; e.classList.toggle('on', on); }
    });
    state.marks.forEach(function (m, i) {
      var on = L >= state.cum[state.markAt[i]] - .5;
      if (m.el.__on !== on) { m.el.__on = on; m.el.classList.toggle('lit', on); }
    });
  }

  var queued = false;
  function onScroll() { if (queued) return; queued = true; requestAnimationFrame(function () { queued = false; draw(); }); }
  var timer = null;
  function rebuild() { clearTimeout(timer); timer = setTimeout(buildPage, 150); }

  window.stLoom = { build: build, heroRoute: heroRoute, crossings: crossings, typeFor: typeFor, axisFor: axisFor,
    seeded: seeded, sessionSeed: sessionSeed, S: S, rebuild: rebuild };

  function start() {
    buildPage();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', rebuild);
    if (window.ResizeObserver) {
      var lastW = 0, lastH = 0, main = document.querySelector('main');
      new ResizeObserver(function () {
        var w = document.documentElement.clientWidth, h = main ? main.offsetHeight : 0;
        if (w !== lastW || h !== lastH) { lastW = w; lastH = h; rebuild(); }
      }).observe(document.documentElement);
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(rebuild);
    window.addEventListener('load', rebuild);
    document.addEventListener('st-intro-done', rebuild);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
