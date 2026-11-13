/*
  The loom: the woven background of the page, and the geometry the intro shares with it.

  - stLoom.build(type, W, H) returns a loom covering W x H:
      'rows'     horizontal lines, like lines of text            (intro variant: loom)
      'columns'  vertical lines, like the warp on a loom          (intro variant: warp)
      'net'      wavy horizontal and vertical lines               (intro variants: net-h, net-v)
    Every loom has nodes on a regular grid (where its threads cross, in the net), and
    the red thread travels along the threads from node to node (stLoom.leg).
    The same function draws the intro's loom and the page background, so the lines
    the intro leaves behind are exactly the page's lines.
  - stLoom.heroRoute(...) finds the red thread's route in the hero: from the node by
    "knowing", along the net through three right nodes, to the node by "doing".
  - stLoom.crossings(path, lines) finds where the thread crosses threads, so it can go
    alternately over and under them.
  - The page background is built on load: the faint loom behind all of main (a static
    layer, drawn once), and the red thread on a layer of its own. From "doing" the
    thread is drawn on as the page scrolls: along the net, leaving it only to run
    underneath the key words of each section (marked .thread-mark), which take its
    colour as it reaches them; it ends where "Let's talk" begins.
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

  // ---------- the loom ----------
  function build(type, W, H) {
    var sp = type === 'net' ? NET.S : S;
    var cols = Math.floor(W / sp), x0 = (W - cols * sp) / 2 + sp / 2, rows = Math.ceil(H / sp) + 1;
    var lines = [], rowLines = [], colLines = [], i, j, x, y;
    var rowY = function (j, x) { return type === 'net' ? sp / 2 + j * sp + NET.A * Math.sin(2 * Math.PI * x / NET.L + j * 1.9) : sp / 2 + j * sp; };
    var colX = function (i, y) { return type === 'net' ? x0 + i * sp + NET.A * Math.sin(2 * Math.PI * y / NET.L + i * 2.3) : x0 + i * sp; };
    var step = 16;
    if (type !== 'columns') for (j = 0; j < rows; j++) {
      var rp = [];
      if (type === 'net') { for (x = 0; x <= W + step; x += step) rp.push([x, rowY(j, x)]); } else rp = [[0, rowY(j, 0)], [W, rowY(j, 0)]];
      rowLines[j] = { dir: 'h', idx: j, pts: rp }; lines.push(rowLines[j]);
    }
    if (type !== 'rows') for (i = 0; i < cols; i++) {
      var cp = [];
      if (type === 'net') { for (y = 0; y <= H + step; y += step) cp.push([colX(i, y), y]); } else cp = [[colX(i, 0), 0], [colX(i, 0), H]];
      colLines[i] = { dir: 'v', idx: i, pts: cp }; lines.push(colLines[i]);
    }
    function node(i, j) {          // where column i meets row j
      var px = x0 + i * sp, py = sp / 2 + j * sp;
      if (type !== 'net') return [px, py];
      for (var k = 0; k < 8; k++) { py = rowY(j, px); px = colX(i, py); }
      return [px, py];
    }
    // points along row j between two x positions, and along column i between two y positions
    function rowPath(j, xa, xb) {
      var out = [[xa, rowY(j, xa)]];
      if (type === 'net') {
        var d = xb > xa ? 1 : -1, x = (d > 0 ? Math.floor(xa / step) + 1 : Math.ceil(xa / step) - 1) * step;
        for (; d > 0 ? x < xb : x > xb; x += d * step) out.push([x, rowY(j, x)]);
      }
      out.push([xb, rowY(j, xb)]);
      return out;
    }
    function colPath(i, ya, yb) {
      var out = [[colX(i, ya), ya]];
      if (type === 'net') {
        var d = yb > ya ? 1 : -1, y = (d > 0 ? Math.floor(ya / step) + 1 : Math.ceil(ya / step) - 1) * step;
        for (; d > 0 ? y < yb : y > yb; y += d * step) out.push([colX(i, y), y]);
      }
      out.push([colX(i, yb), yb]);
      return out;
    }
    function nearest(p, ok) {
      var ci = Math.round((p[0] - x0) / sp), rj = Math.round((p[1] - sp / 2) / sp), best = null, bd = 1e9;
      for (var a = ci - 3; a <= ci + 3; a++) for (var b = rj - 3; b <= rj + 3; b++) {
        if (a < 0 || a >= cols || b < 0 || b >= rows) continue;
        var q = node(a, b), d = Math.hypot(q[0] - p[0], q[1] - p[1]);
        if (ok && !ok(q, a, b)) continue;
        if (d < bd) { bd = d; best = { i: a, j: b, p: q }; }
      }
      return best;
    }
    return { type: type, sp: sp, lines: lines, rows: rows, cols: cols, x0: x0, node: node, nearest: nearest,
      rowPath: rowPath, colPath: colPath,
      row: function (j) { return rowLines[j] || null; }, col: function (i) { return colLines[i] || null; } };
  }

  // From node a to node b along the threads: along a's row then b's column (rowFirst), or the other way.
  function leg(L, a, b, rowFirst) {
    var out, m;
    if (rowFirst) {
      m = { i: b.i, j: a.j };
      out = L.rowPath(a.j, L.node(a.i, a.j)[0], L.node(m.i, m.j)[0]).concat(L.colPath(b.i, L.node(m.i, m.j)[1], L.node(b.i, b.j)[1]));
    } else {
      m = { i: a.i, j: b.j };
      out = L.colPath(a.i, L.node(a.i, a.j)[1], L.node(m.i, m.j)[1]).concat(L.rowPath(b.j, L.node(m.i, m.j)[0], L.node(b.i, b.j)[0]));
    }
    var clean = [];
    out.forEach(function (p) { var q = clean[clean.length - 1]; if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > .5) clean.push(p); });
    return clean;
  }

  // ---------- the hero route: knowing -> three right nodes -> doing, along the net ----------
  function heroRoute(L, W, axis, rand, sy) {
    var k = document.getElementById('kd-knowing'), d = document.getElementById('kd-doing');
    if (!k || !d) return null;
    sy = sy || 0;
    // The line ends in the full stop of "doing.": nudge the word (never more than half a cell)
    // so that its full stop sits exactly on a node of the net.
    var stop = document.getElementById('kd-dot'), Dn = null;
    if (stop) {
      d.style.transform = '';
      var pr = stop.getBoundingClientRect();
      var pc = [(pr.left + pr.right) / 2, pr.top + sy + pr.height * .76];
      var half = L.sp * .6 + 2;
      Dn = L.nearest(pc, function (q) { return q[0] <= W - 10 && Math.abs(q[0] - pc[0]) <= half && Math.abs(q[1] - pc[1]) <= half; });
      if (Dn) d.style.transform = 'translate(' + (Dn.p[0] - pc[0]).toFixed(2) + 'px,' + (Dn.p[1] - pc[1]).toFixed(2) + 'px)';
    }
    var kr = k.getBoundingClientRect(), dr = d.getBoundingClientRect();
    var kb = { l: kr.left, r: kr.right, t: kr.top + sy, b: kr.bottom + sy };
    var db = { l: dr.left, r: dr.right, t: dr.top + sy, b: dr.bottom + sy };
    var fs = parseFloat(getComputedStyle(k).fontSize) || 60;
    var lede = document.querySelector('.hero .lede');
    var ledeTop = lede ? lede.getBoundingClientRect().top + sy : 1e9;
    var headerB = 84 + sy;

    var K = L.nearest([kb.r + fs * .2, (kb.t + kb.b) / 2], function (q) { return q[0] >= kb.r + 6; });
    var D = Dn || L.nearest([db.l - fs * .2, (db.t + db.b) / 2], function (q) { return q[0] <= db.l - 6; });
    if (!K || !D) return null;
    var wide = db.l - K.p[0] > 220;

    // a touched thread must not run behind the words, the text below, or the header
    var inY = function (y, b) { return y > b.t - 6 && y < b.b + 6; };
    var inX = function (x, b) { return x > b.l - 6 && x < b.r + 6; };
    function lineOk(n) {
      if (axis === 'v') return !inX(n.p[0], kb) && !inX(n.p[0], db);
      return !inY(n.p[1], kb) && !inY(n.p[1], db) && n.p[1] > headerB && n.p[1] < ledeTop - 8;
    }
    var cand = [];
    for (var j = 0; j < L.rows; j++) for (var i = 0; i < L.cols; i++) {
      var n = { i: i, j: j, p: L.node(i, j) };
      if (n.p[1] < headerB || n.p[1] > ledeTop - 8) continue;
      if (n.p[1] < kb.t - L.sp * 1.2 || n.p[1] > db.b + L.sp * 1.2) continue;   // keep the route near the two words
      if (wide) { if (i <= K.i || n.p[0] > db.l - 6 || n.p[1] > db.t - 8) continue; }   // between the words, above "doing"
      else if (!(n.p[1] > kb.b + 4 && n.p[1] < db.t - 4)) continue;   // narrow screens: the space between the two words
      if (inX(n.p[0], kb) && inY(n.p[1], kb)) continue;
      cand.push(n);
    }
    // shuffle, then pick three on different threads; strict first, relaxed if the screen is too small
    for (i = cand.length - 1; i > 0; i--) { j = Math.floor(rand() * (i + 1)); var t = cand[i]; cand[i] = cand[j]; cand[j] = t; }
    function choose(strict) {
      var out = [], used = {};
      cand.forEach(function (n) {
        if (out.length === 3) return;
        var key = axis === 'v' ? 'c' + n.i : 'r' + n.j;
        if (used[key] || (strict && !lineOk(n))) return;
        if (out.some(function (o) { return o.i === n.i || o.j === n.j; }) && strict) return;
        used[key] = true; out.push(n);
      });
      return out;
    }
    var stops = choose(true);
    if (stops.length < 3) stops = choose(false);
    while (stops.length < 3 && cand.length) stops.push(cand[stops.length % cand.length]);
    if (stops.length < 3) return null;
    // order them: across from knowing to doing on wide screens; right, middle, left on narrow ones
    stops.sort(function (a, b) { return wide ? a.p[0] - b.p[0] : b.p[0] - a.p[0]; });

    var nodes = [K].concat(stops, [D]);
    var pts = [K.p];
    // Leave "knowing" down its node's column, and reach "doing" down its node's column, so the
    // thread never runs across either word.
    for (var s = 0; s < nodes.length - 1; s++) pts = pts.concat(leg(L, nodes[s], nodes[s + 1], s === nodes.length - 2).slice(1));
    var at = [0], acc = 0;            // where along the route each node sits
    for (s = 1; s < pts.length; s++) acc += Math.hypot(pts[s][0] - pts[s - 1][0], pts[s][1] - pts[s - 1][1]);
    var cum = function (p) { var a = 0; for (var q = 1; q < pts.length; q++) { a += Math.hypot(pts[q][0] - pts[q - 1][0], pts[q][1] - pts[q - 1][1]); if (Math.hypot(pts[q][0] - p[0], pts[q][1] - p[1]) < .6) return a; } return a; };
    return {
      K: K.p, D: D.p, Dn: D, pts: pts,
      stops: stops.map(function (n) { return { p: n.p, at: cum(n.p), line: axis === 'v' ? L.col(n.i) : L.row(n.j), i: n.i, j: n.j }; })
    };
  }

  function segInt(a, b, c, d) {
    var rx = b[0] - a[0], ry = b[1] - a[1], sx = d[0] - c[0], sy = d[1] - c[1];
    var den = rx * sy - ry * sx;
    if (Math.abs(den) < 1e-6 * (Math.abs(rx) + Math.abs(ry) + 1) * (Math.abs(sx) + Math.abs(sy) + 1)) return null;
    var qx = c[0] - a[0], qy = c[1] - a[1];
    var t = (qx * sy - qy * sx) / den, u = (qx * ry - qy * rx) / den;
    if (t < 0 || t > 1 || u < 0 || u > 1) return null;
    return [a[0] + t * rx, a[1] + t * ry, t];
  }

  // Where a thread (polyline) crosses the lines; skips crossings within `near` px of the thread's own points
  // (the thread turns at nodes, and runs along threads, which is not crossing them).
  function crossings(path, lines, near) {
    near = near == null ? 3 : near;
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
          if (out.some(function (o) { return o.line === l && Math.abs(o.at - (acc + p[2] * segL)) < 2; })) continue;
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

    // The hero part: the intro's own route if it has just drawn one, else the same choice made here.
    var hero = window.stIntroRoute && Math.abs(window.stIntroRoute.W - W) < 24 ? window.stIntroRoute
      : heroRoute(loom, W, axisFor(variant), seeded(sessionSeed()), sy);
    if (!hero) return;

    // From "doing", along the net to each key word; only the hop onto the word, the underline,
    // and the hop back onto the net leave it.
    var route = hero.pts.slice(), heroEnd = route.length - 1, cur = hero.Dn;
    var html = document.documentElement;
    html.classList.add('st-measuring');            // measure without the scroll-in offsets
    var marks = Array.prototype.slice.call(main.querySelectorAll('.thread-mark')).map(function (m) {
      var rs = m.getClientRects(), a = rs[0], z = rs[rs.length - 1];
      return { el: m, from: [a.left - 4, a.bottom + sy - 1], to: [z.right + 4, z.bottom + sy - 1] };
    });
    var talk = document.getElementById('talk');
    var talkTop = talk ? talk.getBoundingClientRect().top + sy : H;
    html.classList.remove('st-measuring');
    var markAt = [];
    marks.forEach(function (m) {
      var on = loom.nearest(m.from, function (q) { return q[1] <= m.from[1] + 2 && q[0] <= m.from[0] + 4; }) || loom.nearest(m.from);
      route = route.concat(leg(loom, cur, on, false).slice(1));
      markAt.push(route.length);
      route.push(m.from, m.to);
      cur = loom.nearest(m.to, function (q) { return q[1] >= m.to[1] - 2; }) || loom.nearest(m.to);
      route.push(cur.p);
    });
    var end = loom.nearest([W / 2, talkTop - 10], function (q) { return q[1] < talkTop; });
    if (end) route = route.concat(leg(loom, cur, end, false).slice(1));

    // Layer 1 (static, drawn once): the loom, with gaps where the thread goes over it.
    var svg = el('svg', { id: 'st-loom', 'aria-hidden': 'true', width: W, height: H, viewBox: '0 0 ' + W + ' ' + H });
    var mLines = el('mask', { id: 'stl-m-lines', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H }, el('defs', {}, svg));
    el('rect', { width: W, height: H, fill: '#fff' }, mLines);
    var gLines = el('g', { class: 'stl-lines', mask: 'url(#stl-m-lines)' }, svg);
    loom.lines.forEach(function (l) { el('path', { d: pathD(l.pts) }, gLines); });

    // Layer 2 (redrawn on scroll): the thread. Gaps where it goes under are part of its dash pattern.
    var tsvg = el('svg', { id: 'st-thread', 'aria-hidden': 'true', width: W, height: H, viewBox: '0 0 ' + W + ' ' + H });
    var thread = el('path', { class: 'stl-thread', d: pathD(route) }, tsvg);
    var dots = [hero.K].concat(hero.stops.map(function (s) { return s.p; })).map(function (p) {
      return el('circle', { class: 'stl-stop', cx: p[0], cy: p[1], r: 3.5 }, tsvg);
    });
    var tip = el('circle', { class: 'stl-tip', r: 3.5 }, tsvg);

    var unders = [], flip = true;
    crossings(route, loom.lines, 3).forEach(function (c) {
      if (flip) el('circle', { cx: c.x, cy: c.y, r: 3.5, fill: '#000' }, mLines);
      else unders.push(c.at);
      flip = !flip;
    });

    document.body.appendChild(svg);
    document.body.appendChild(tsvg);

    var cum = [0];
    for (var k = 1; k < route.length; k++) cum.push(cum[k - 1] + Math.hypot(route[k][0] - route[k - 1][0], route[k][1] - route[k - 1][1]));
    // Reveal by height: a point is reached when the page has scrolled it up to the drawing point.
    // Stretches that go up (or along a thread) appear once the point before them is reached.
    var reach = [], hi = -1e9;
    route.forEach(function (p) { hi = Math.max(hi, p[1]); reach.push(hi); });
    state = { route: route, cum: cum, reach: reach, total: cum[cum.length - 1], heroEnd: heroEnd, D: hero.D,
              thread: thread, dots: dots, tip: tip, unders: unders, marks: marks, markAt: markAt, last: -1 };
    dots.forEach(function (d) { d.classList.add('on'); });
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
    state.marks.forEach(function (m, i) {
      var on = L >= state.cum[state.markAt[i]] - .5;
      if (m.el.__on !== on) { m.el.__on = on; m.el.classList.toggle('lit', on); }
    });
  }

  var queued = false;
  function onScroll() { if (queued) return; queued = true; requestAnimationFrame(function () { queued = false; draw(); }); }
  var timer = null;
  function rebuild() { clearTimeout(timer); timer = setTimeout(buildPage, 150); }

  window.stLoom = { build: build, leg: leg, heroRoute: heroRoute, crossings: crossings, typeFor: typeFor, axisFor: axisFor,
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
