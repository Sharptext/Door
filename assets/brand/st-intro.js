/*
  Sharptext intro animation (home page only). See st-intro.css and st-loom.js.

  The page opens on the loom, with only the two words of the heading: "knowing" and
  "doing". On scroll, click, key press or after a few seconds, the red thread runs
  from "knowing" through three right points on the loom to "doing". Each line it
  picks up there thickens; those three lines fly up and become the lines of the logo
  in the header, the logo's own thread is drawn through them, and the rest of the
  page fades in. The thread stays between the two words; the loom stays behind the
  page; from "doing" the thread is drawn on down the page as it scrolls (st-loom.js).

  Variants (chosen in the page head; ?intro=<variant> forces one):
    loom    horizontal lines; the lines it touches become the logo's lines
    warp    vertical lines; the touched lines turn a quarter into the logo's lines
    net-h   a wavy net; the horizontal threads it touches become the logo's lines
    net-v   a wavy net; the vertical threads it touches turn into the logo's lines

  Each natural play sends a Google Analytics event "intro_play" (and "intro_skip"
  when skipped) with the variant name. A click or key press while it runs skips
  it. Plays once per browser session. When it finishes (or is skipped) it fires
  "st-intro-done" on document.
*/
(function () {
  var AUTO_START_MS = 2500;
  var html = document.documentElement;
  if (!html.classList.contains('st-intro') || !window.stLoom) { html.classList.remove('st-intro'); return; }
  window.stIntroStarted = true;
  try { sessionStorage.setItem('st-intro-seen', '1'); } catch (e) {}

  var forced = /[?&]intro(=|&|$)/.test(location.search);
  var variant = window.stIntroVariant || 'loom';
  var type = window.stLoom.typeFor(variant), axis = window.stLoom.axisFor(variant);
  function track(name) {
    if (forced || window.top !== window.self || typeof window.gtag !== 'function') return;
    try { window.gtag('event', name, { intro_variant: variant }); } catch (e) {}
  }
  // The intro's loom lines up with the page's loom, which starts at the top of the page.
  try { history.scrollRestoration = 'manual'; } catch (e) {}
  window.scrollTo(0, 0);

  var NS = 'http://www.w3.org/2000/svg';
  var LINE = '#D3D3CE', LINE_BG = '#EFEFEF', INK = '#16191D', RED = '#C2412D';
  var dead = false, started = false, finished = false;
  var W = window.innerWidth, H = window.innerHeight + 60;

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
  function rgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function mixColor(a, b, t) { var x = rgb(a), y = rgb(b); return 'rgb(' + [0, 1, 2].map(function (i) { return Math.round(lerp(x[i], y[i], t)); }).join(',') + ')'; }

  // ---------- the overlay: the loom is there from the first moment ----------
  var ov = document.createElement('div');
  ov.id = 'st-intro';
  ov.setAttribute('aria-hidden', 'true');
  document.body.appendChild(ov);
  var svg = el('svg', { class: 'sti-svg', width: W, height: H }, ov);
  var defs = el('defs', {}, svg);
  var mLines = el('mask', { id: 'sti-m-lines', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H }, defs);
  el('rect', { width: W, height: H, fill: '#fff' }, mLines);
  var mThread = el('mask', { id: 'sti-m-thread', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H }, defs);
  el('rect', { width: W, height: H, fill: '#fff' }, mThread);
  var gField = el('g', { class: 'sti-field', mask: 'url(#sti-m-lines)' }, svg);
  var trail = el('path', { class: 'sti-trail', mask: 'url(#sti-m-thread)' }, svg);
  var gDots = el('g', { class: 'sti-dots' }, svg);
  var gLogo = el('g', { class: 'sti-logo' }, svg);
  var nK = el('circle', { class: 'sti-node', r: 6 }, svg);
  var nD = el('circle', { class: 'sti-node', r: 6 }, svg);
  var dot = el('circle', { class: 'sti-dot', r: 4.5, style: 'display:none' }, svg);

  var loom = window.stLoom.build(type, W, H);
  var lw = type === 'net' ? 2 : 2.5;
  loom.lines.forEach(function (l) { l.el = el('path', { d: pathD(l.pts), fill: 'none', stroke: LINE, 'stroke-width': lw }, gField); });

  function drawTrail(pts, frac) {
    trail.setAttribute('d', pathD(pts));
    var L = trail.getTotalLength();
    if (frac >= 1) trail.style.strokeDasharray = 'none';
    else { trail.style.strokeDasharray = L + ' ' + (L + 1); trail.style.strokeDashoffset = L * (1 - frac); }
    var p = trail.getPointAtLength(L * clamp01(frac));
    return [p.x, p.y, L];
  }

  // ---------- the route, from the heading's two words ----------
  var R, stopDots = [], over = [];
  function setup() {
    R = window.stLoom.heroRoute(loom, W, axis, window.stLoom.seeded(window.stLoom.sessionSeed()), 0);
    if (!R) throw new Error('no hero');
    R.W = document.documentElement.clientWidth;
    window.stIntroRoute = R;                       // the page draws exactly this route under the intro
    nK.setAttribute('cx', R.K[0]); nK.setAttribute('cy', R.K[1]);
    nD.setAttribute('cx', R.D[0]); nD.setAttribute('cy', R.D[1]);
    stopDots = R.stops.map(function (st) { return el('circle', { cx: st.p[0], cy: st.p[1], r: 3.5, class: 'sti-stop' }, gDots); });
    var flip = true;
    window.stLoom.crossings(R.pts, loom.lines, 6).forEach(function (c) {
      if (flip) over.push({ at: c.at, el: el('circle', { cx: c.x, cy: c.y, r: 0, fill: '#000' }, mLines) });
      else el('circle', { cx: c.x, cy: c.y, r: lw / 2 + 2.5, fill: '#000' }, mThread);
      flip = !flip;
    });
    trail.style.strokeWidth = '2px';
  }

  // the thread reaches a right point: the line it sits on thickens and darkens
  function touch(k) {
    var st = R.stops[k];
    stopDots[k].classList.add('sti-on');
    st.line.touched = true;
    st.line.el.style.transition = 'stroke .45s ease, stroke-width .45s ease';
    st.line.el.setAttribute('stroke', INK);
    st.line.el.setAttribute('stroke-width', lw * 2.4);
  }

  async function run() {
    var L = drawTrail(R.pts, 0)[2];
    var stopAt = [], acc = 0;
    for (var i = 1; i < R.pts.length; i++) { acc += Math.hypot(R.pts[i][0] - R.pts[i - 1][0], R.pts[i][1] - R.pts[i - 1][1]); stopAt.push(acc); }
    var touched = [false, false, false];
    await animate(Math.min(3000, Math.max(2200, L * 2.2)), function (t) {
      var at = L * ease(t), tip = drawTrail(R.pts, ease(t));
      dot.style.display = ''; dot.setAttribute('cx', tip[0]); dot.setAttribute('cy', tip[1]);
      over.forEach(function (o) { if (at >= o.at) o.el.setAttribute('r', 3.5); });
      for (var k = 0; k < 3; k++) if (!touched[k] && at >= stopAt[k] - 1) { touched[k] = true; touch(k); }
    });
    nD.classList.add('sti-on'); dot.style.display = 'none';
    await wait(500);

    // The three lines fly up into the header and become the logo's lines.
    var to = document.querySelector('.brand st-logo .st-logo__symbol');
    if (!to) return done();
    var sr = to.getBoundingClientRect();
    var key = axis === 'v' ? 0 : 1;
    var order = [0, 1, 2].sort(function (a, b) { return R.stops[a].p[key] - R.stops[b].p[key]; });
    var rank = []; order.forEach(function (k, r) { rank[k] = r; });
    var ly = [.26, .50, .74].map(function (f) { return sr.top + f * sr.height; });
    var x0 = sr.left + .14 * sr.width, x1 = [sr.left + .86 * sr.width, sr.left + .86 * sr.width, sr.left + .66 * sr.width];
    var lh = .11 * sr.height;
    // a copy of each touched line flies; the line itself stays behind, thin, as part of the loom
    var moves = R.stops.map(function (st, k) {
      var r = rank[k];
      return { fly: el('path', { fill: 'none', stroke: INK, 'stroke-width': lw * 2.4 }, gLogo),
               from: st.line.pts.map(function (p) { return p.slice(); }), A: [x0, ly[r]], B: [x1[r], ly[r]] };
    });
    loom.lines.forEach(function (l) { l.el.style.transition = 'none'; });
    await animate(1400, function (t) {
      var e = ease(t), thin = clamp01(t * 1.6);
      loom.lines.forEach(function (l) {
        l.el.setAttribute('stroke', mixColor(l.touched ? INK : LINE, LINE_BG, thin));
        l.el.setAttribute('stroke-width', lerp(l.touched ? lw * 2.4 : lw, 1, thin));
      });
      moves.forEach(function (m) {
        var n = m.from.length;
        var pts = m.from.map(function (p, i) { var u = n > 1 ? i / (n - 1) : 0; return mix(p, [lerp(m.A[0], m.B[0], u), m.A[1]], e); });
        m.fly.setAttribute('d', pathD(pts));
        m.fly.setAttribute('stroke-width', lerp(lw * 2.4, lh, e));
      });
    });

    // The logo's own thread is woven through them.
    var tx = sr.left + .40 * sr.width, ty0 = sr.top + .06 * sr.height, ty1 = sr.top + .94 * sr.height;
    var mini = el('path', { d: 'M' + tx + ',' + ty0 + ' L' + tx + ',' + ty1, stroke: RED, 'stroke-width': .07 * sr.width, fill: 'none' }, gLogo);
    var mL = ty1 - ty0;
    mini.style.strokeDasharray = mL + ' ' + (mL + 1);
    await animate(350, function (t) { mini.style.strokeDashoffset = mL * (1 - ease(t)); });

    // The page comes into view around them.
    ov.classList.add('sti-reveal');
    html.classList.add('st-intro-reveal');
    await wait(1000);
    done();
  }

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
    if (started || dead || !R) return;
    started = true;
    setTimeout(function () {
      window.addEventListener('pointerdown', skip);
      window.addEventListener('keydown', skip);
    }, 0);
    run().catch(function () { done(); });
  }

  function ready() {
    if (dead) return;
    try { setup(); } catch (e) { return done(); }
    ov.classList.add('sti-ready');
    track('intro_play');
    window.addEventListener('resize', skip);
    ['wheel', 'touchmove', 'pointerdown', 'keydown', 'scroll'].forEach(function (ev) {
      window.addEventListener(ev, trigger, { passive: true });
    });
    setTimeout(trigger, AUTO_START_MS);
    if (window.stLoom.rebuild) window.stLoom.rebuild();
  }

  // The route depends on where the two words sit, so wait for the heading font.
  var fontReady = document.fonts && document.fonts.load ? document.fonts.load('400 64px "Schibsted Grotesk"') : Promise.resolve();
  Promise.race([Promise.all([customElements.whenDefined('st-logo'), fontReady]), wait(1500)])
    .then(function () { requestAnimationFrame(ready); }, function () { requestAnimationFrame(ready); });
})();
