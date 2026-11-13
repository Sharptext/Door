/*
  The loom: the woven background of the page, and the geometry the intro shares with it.

  - stLoom.build(type, W, H) returns the lines of a loom covering W x H:
      'rows'     horizontal lines, like lines of text            (intro variant: loom)
      'columns'  vertical lines, like the warp on a loom          (intro variant: warp)
      'net'      wavy horizontal and vertical lines               (intro variant: net)
    The same function draws the intro's loom and the page background, so when the
    intro hands over, the lines it leaves behind are exactly the page's lines.
  - stLoom.crossings(path, lines) finds where a thread crosses the lines, so it can
    go alternately over and under them.
  - The page background is built on load: the faint loom behind all of main, and a
    red thread that is woven down the page as it scrolls. It runs in the side
    margins and crosses over in the space between sections, so it never cuts
    through text, and it ends where "Let's talk" begins.
*/
(function () {
  var NS = 'http://www.w3.org/2000/svg';
  var S = 56;                              // spacing of rows and columns
  var NET = { S: 64, A: 9, L: 320 };       // net spacing, wave amplitude and wavelength

  function typeFor(variant) { return variant === 'warp' ? 'columns' : variant === 'net' ? 'net' : 'rows'; }

  function netRowY(j, x) { return NET.S / 2 + j * NET.S + NET.A * Math.sin(2 * Math.PI * x / NET.L + j * 1.9); }
  function netColX(i, y, x0) { return x0 + i * NET.S + NET.A * Math.sin(2 * Math.PI * y / NET.L + i * 2.3); }

  function build(type, W, H) {
    var lines = [], i, j, x, y, n;
    if (type === 'columns') {
      n = Math.floor(W / S);
      var cx0 = (W - n * S) / 2 + S / 2;
      for (i = 0; i < n; i++) { x = cx0 + i * S; lines.push({ dir: 'v', idx: i, pts: [[x, 0], [x, H]] }); }
      return { type: type, lines: lines, x0: cx0, n: n,
        snap: function (p) { var k = Math.max(0, Math.min(n - 1, Math.round((p[0] - cx0) / S))); return { p: [cx0 + k * S, p[1]], line: lines[k] }; } };
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
        snap: function (p) {
          var ci = Math.max(0, Math.min(cols - 1, Math.round((p[0] - nx0) / NET.S)));
          var rj = Math.max(0, Math.min(rows - 1, Math.round((p[1] - NET.S / 2) / NET.S)));
          return { p: node(ci, rj), line: lines[rj], col: ci, row: rj };
        } };
    }
    for (j = 0, y = S / 2; y <= H + S; y += S, j++) lines.push({ dir: 'h', idx: j, pts: [[0, y], [W, y]] });
    return { type: 'rows', lines: lines,
      snap: function (p) { var k = Math.max(0, Math.round((p[1] - S / 2) / S)); return { p: [p[0], S / 2 + k * S], line: lines[k] }; } };
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
  var state = null;

  function buildPage() {
    var main = document.querySelector('main');
    if (!main) return;
    var old = document.getElementById('st-loom');
    if (old) old.parentNode.removeChild(old);

    var W = document.documentElement.clientWidth;
    var sy = window.scrollY || 0;
    var mainRect = main.getBoundingClientRect();
    var H = Math.round(mainRect.bottom + sy);
    var loom = build(typeFor(window.stIntroVariant), W, H);

    // The thread's route: down one side margin, across in the gap between sections, down the other.
    var content = Math.min(W, 1180), pad = W <= 760 ? 22 : 32;
    var gutter = Math.max(10, ((W - content) / 2 + pad) / 2);
    var xs = { L: gutter, R: W - gutter };
    var secs = Array.prototype.slice.call(main.querySelectorAll(':scope > section'));
    if (secs.length < 2) return;
    var tops = secs.map(function (s) { return s.getBoundingClientRect().top + sy; });
    var onRow = function (p) { return loom.type === 'rows' ? loom.snap(p).p : p; };
    var side = 'R', route = [onRow([xs.R, tops[0] + 40])];
    for (var k = 1; k < secs.length; k++) {
      var b = tops[k], last = k === secs.length - 1;
      route.push(onRow([xs[side], b - 40]));
      if (last) { route.push([W / 2, b]); break; }
      side = side === 'R' ? 'L' : 'R';
      route.push(onRow([xs[side], b + 40]));
    }

    var svg = el('svg', { id: 'st-loom', 'aria-hidden': 'true', width: W, height: H, viewBox: '0 0 ' + W + ' ' + H });
    var defs = el('defs', {}, svg);
    var mLines = el('mask', { id: 'stl-m-lines', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H }, defs);
    el('rect', { width: W, height: H, fill: '#fff' }, mLines);
    var mThread = el('mask', { id: 'stl-m-thread', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H }, defs);
    el('rect', { width: W, height: H, fill: '#fff' }, mThread);

    var gLines = el('g', { class: 'stl-lines', mask: 'url(#stl-m-lines)' }, svg);
    loom.lines.forEach(function (l) { el('path', { d: pathD(l.pts) }, gLines); });
    var thread = el('path', { class: 'stl-thread', d: pathD(route), mask: 'url(#stl-m-thread)' }, svg);
    var stops = route.map(function (p, i) { return el('circle', { class: 'stl-stop' + (i === route.length - 1 ? ' stl-end' : ''), cx: p[0], cy: p[1], r: i === 0 || i === route.length - 1 ? 4.5 : 3 }, svg); });
    var tip = el('circle', { class: 'stl-tip', r: 3.5 }, svg);

    // Weave: alternately over (a gap in the line) and under (a gap in the thread)
    var over = [], flip = true;
    crossings(route, loom.lines, 4).forEach(function (c) {
      if (flip) over.push({ at: c.at, el: el('circle', { cx: c.x, cy: c.y, r: 0, fill: '#000' }, mLines) });
      else el('circle', { cx: c.x, cy: c.y, r: 2.6, fill: '#000' }, mThread);
      flip = !flip;
    });

    document.body.appendChild(svg);

    // cumulative lengths, to draw the thread down to a given height
    var cum = [0];
    for (k = 1; k < route.length; k++) cum.push(cum[k - 1] + Math.hypot(route[k][0] - route[k - 1][0], route[k][1] - route[k - 1][1]));
    var total = cum[cum.length - 1];
    thread.style.strokeDasharray = total + ' ' + (total + 1);

    state = { route: route, cum: cum, total: total, thread: thread, stops: stops, tip: tip, over: over };
    draw();
  }

  function lengthAtY(y) {
    var r = state.route, c = state.cum;
    if (y <= r[0][1]) return 0;
    for (var k = 1; k < r.length; k++) {
      if (y <= r[k][1]) {
        var dy = r[k][1] - r[k - 1][1];
        var f = dy > 0 ? (y - r[k - 1][1]) / dy : 1;
        return c[k - 1] + f * (c[k] - c[k - 1]);
      }
    }
    return state.total;
  }

  var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function draw() {
    if (!state) return;
    var L = calm ? state.total : lengthAtY((window.scrollY || 0) + window.innerHeight * .62);
    state.thread.style.strokeDashoffset = state.total - L;
    var p = state.thread.getPointAtLength(L);
    state.tip.setAttribute('cx', p.x); state.tip.setAttribute('cy', p.y);
    state.tip.style.display = L > 0 && L < state.total ? '' : 'none';
    state.cum.forEach(function (c, i) { state.stops[i].classList.toggle('on', L >= c - .5); });
    state.over.forEach(function (o) { o.el.setAttribute('r', L >= o.at ? 4 : 0); });
  }

  var queued = false;
  function onScroll() { if (queued) return; queued = true; requestAnimationFrame(function () { queued = false; draw(); }); }
  var timer = null;
  function rebuild() { clearTimeout(timer); timer = setTimeout(buildPage, 150); }

  window.stLoom = { build: build, crossings: crossings, typeFor: typeFor, S: S, rebuild: rebuild };

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
