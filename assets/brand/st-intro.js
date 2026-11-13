/*
  Sharptext intro animation (home page only). See st-intro.css and st-loom.js.

  1. The page opens on the loom, with only the heading's two words, "knowing" and "doing".
  2. On scroll, click, key press or after a few seconds, the red thread runs along the
     net from the node by "knowing", through three right nodes, to the node by "doing".
     Each thread it picks up at those nodes thickens.
  3. The rest dims, and those three threads come together in the middle of the screen as
     the lines of the logo; the logo's own thread is woven through them, the wordmark
     appears, and "Architecture for learning" appears beneath it.
  4. It waits for the visitor (a scroll, click or key) or a few seconds, then the logo
     moves up into the header, "Architecture for learning" moves to its place above
     "knowing", and the page comes into view. The thread stays between the two words,
     the loom stays behind the page, and from "doing" the thread is drawn on down the
     page as it scrolls (st-loom.js).

  Variants (chosen in the page head; ?intro=<variant> forces one):
    loom    horizontal threads; the touched ones become the logo's lines
    warp    vertical threads; the touched ones turn into the logo's lines
    net-h   a wavy net; its touched horizontal threads become the logo's lines
    net-v   a wavy net; its touched vertical threads turn into the logo's lines

  Each natural play sends a Google Analytics event "intro_play" (and "intro_skip"
  when skipped) with the variant name. A click or key press while the thread runs
  skips the intro. Plays once per browser session. When it finishes (or is skipped)
  it fires "st-intro-done" on document.
*/
(function () {
  var AUTO_START_MS = 2500, HOLD_MIN_MS = 1400, HOLD_MAX_MS = 3600;
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
  var dead = false, started = false, finished = false, skippable = true;
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
  ov.innerHTML = '<div class="sti-lockup"><st-logo class="st-logo"><span class="st-logo__word">sharptext</span></st-logo></div>' +
                 '<p class="sti-eyebrow">Architecture for learning</p>';
  document.body.appendChild(ov);
  var lock = ov.querySelector('.sti-lockup'), logo = ov.querySelector('st-logo'), eyebrow = ov.querySelector('.sti-eyebrow');
  var svg = el('svg', { class: 'sti-svg', width: W, height: H }, null);
  ov.insertBefore(svg, ov.firstChild);
  var defs = el('defs', {}, svg);
  var mLines = el('mask', { id: 'sti-m-lines', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H }, defs);
  el('rect', { width: W, height: H, fill: '#fff' }, mLines);
  var mThread = el('mask', { id: 'sti-m-thread', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H }, defs);
  el('rect', { width: W, height: H, fill: '#fff' }, mThread);
  var gWeave = el('g', { class: 'sti-weave' }, svg);          // the loom and the thread on it: dimmed while the logo forms
  var gField = el('g', { class: 'sti-field', mask: 'url(#sti-m-lines)' }, gWeave);
  var trail = el('path', { class: 'sti-trail', mask: 'url(#sti-m-thread)' }, gWeave);
  var gDots = el('g', { class: 'sti-dots' }, gWeave);
  var dot = el('circle', { class: 'sti-dot', r: 4.5, style: 'display:none' }, gWeave);
  var gLogo = el('g', { class: 'sti-logo' }, svg);

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
  var R, nodeDots = [], over = [];
  function setup() {
    R = window.stLoom.heroRoute(loom, W, axis, window.stLoom.seeded(window.stLoom.sessionSeed()), 0);
    if (!R) throw new Error('no hero');
    R.W = document.documentElement.clientWidth;
    window.stIntroRoute = R;                       // the page draws exactly this route under the intro
    // the route's nodes: knowing and the three right ones (all nodes of the loom); it ends in the
    // full stop of "doing.", which is a node too and needs no dot of its own
    var ns = [{ p: R.K, at: 0 }].concat(R.stops);
    nodeDots = ns.map(function (n) { return { at: n.at, el: el('circle', { cx: n.p[0], cy: n.p[1], r: 3.5, class: 'sti-node' }, gDots) }; });
    nodeDots[0].el.classList.add('sti-on');
    var flip = true;
    window.stLoom.crossings(R.pts, loom.lines, 3).forEach(function (c) {
      if (flip) over.push({ at: c.at, el: el('circle', { cx: c.x, cy: c.y, r: 0, fill: '#000' }, mLines) });
      else el('circle', { cx: c.x, cy: c.y, r: lw / 2 + 2.5, fill: '#000' }, mThread);
      flip = !flip;
    });
    trail.style.strokeWidth = '2px';
  }

  // the thread reaches a right node: the thread of the loom it sits on thickens and darkens
  function touch(k) {
    var st = R.stops[k];
    nodeDots[k + 1].el.classList.add('sti-on');
    if (!st.line) return;
    st.line.touched = true;
    st.line.el.style.transition = 'stroke .45s ease, stroke-width .45s ease';
    st.line.el.setAttribute('stroke', INK);
    st.line.el.setAttribute('stroke-width', lw * 2.4);
  }

  // the logo, centred on screen, with "Architecture for learning" beneath it
  // "Architecture for learning" is tucked right under the wordmark, aligned to its end,
  // and sized to run from its "p" to the last letter.
  function placeLockup() {
    var lr = logo.getBoundingClientRect();
    var left = (W - lr.width) / 2, top = (window.innerHeight - lr.height) / 2 - 20;
    lock.style.left = left + 'px'; lock.style.top = top + 'px';
    var word = logo.querySelector('.st-logo__word'), tn = word.firstChild;
    word.style.transition = 'none'; word.style.transform = 'none';      // measure where it will settle
    var wr = word.getBoundingClientRect();
    var rg = document.createRange(); rg.setStart(tn, 4); rg.setEnd(tn, 5);  // the "p" of sharptext
    var pr = rg.getBoundingClientRect();
    word.style.transform = ''; word.getBoundingClientRect(); word.style.transition = '';
    var fs = parseFloat(getComputedStyle(logo).fontSize);
    eyebrow.style.fontSize = '13.5px';
    var w0 = eyebrow.getBoundingClientRect().width;
    var size = Math.max(9.5, Math.min(20, 13.5 * (wr.right - pr.left) / w0));
    eyebrow.style.fontSize = size + 'px';
    var er = eyebrow.getBoundingClientRect();
    eyebrow.style.left = (wr.right - er.width + .1 * size) + 'px';  // letter-spacing trails the last letter
    eyebrow.style.top = (wr.bottom + fs * .1) + 'px';
  }

  // wait for the visitor (scroll, click, key, touch) or a few seconds; never less than a short pause
  function hold() {
    return new Promise(function (resolve) {
      var t0 = performance.now(), asked = false, over = false;
      var evs = ['wheel', 'touchmove', 'pointerdown', 'keydown'];
      function finish() {
        if (over) return;
        over = true;
        evs.forEach(function (ev) { window.removeEventListener(ev, act); });
        resolve();
      }
      function act() { asked = true; if (performance.now() - t0 >= HOLD_MIN_MS) finish(); }
      evs.forEach(function (ev) { window.addEventListener(ev, act, { passive: true }); });
      setTimeout(function () { if (asked) finish(); }, HOLD_MIN_MS);
      setTimeout(finish, HOLD_MAX_MS);
    });
  }

  async function run() {
    // 2. Along the net, from knowing to doing.
    var L = drawTrail(R.pts, 0)[2];
    var touched = [false, false, false];
    await animate(Math.min(3600, Math.max(2400, L * 1.5)), function (t) {
      var at = L * ease(t), tip = drawTrail(R.pts, ease(t));
      dot.style.display = ''; dot.setAttribute('cx', tip[0]); dot.setAttribute('cy', tip[1]);
      over.forEach(function (o) { if (at >= o.at) o.el.setAttribute('r', 3.5); });
      for (var k = 0; k < 3; k++) if (!touched[k] && at >= R.stops[k].at - 1) { touched[k] = true; touch(k); }
    });
    dot.style.display = 'none';
    skippable = false;
    await wait(500);

    // 3. The rest dims; the three threads come together in the middle as the logo's lines.
    placeLockup();
    var sr = logo.querySelector('.st-logo__symbol').getBoundingClientRect();
    ov.classList.add('sti-dim');
    html.classList.add('st-intro-dim');
    var key = axis === 'v' ? 0 : 1;
    var order = [0, 1, 2].sort(function (a, b) { return R.stops[a].p[key] - R.stops[b].p[key]; });
    var rank = []; order.forEach(function (k, r) { rank[k] = r; });
    var ly = [.26, .50, .74].map(function (f) { return sr.top + f * sr.height; });
    var x0 = sr.left + .14 * sr.width, x1 = [sr.left + .86 * sr.width, sr.left + .86 * sr.width, sr.left + .66 * sr.width];
    var lh = .11 * sr.height;
    // a copy of each touched thread comes; the thread itself stays behind, thin, as part of the loom
    var moves = R.stops.map(function (st, k) {
      var from = st.line ? st.line.pts : [st.p, st.p];
      return { fly: el('path', { fill: 'none', stroke: INK, 'stroke-width': lw * 2.4 }, gLogo),
               from: from.map(function (p) { return p.slice(); }), A: [x0, ly[rank[k]]], B: [x1[rank[k]], ly[rank[k]]] };
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
    // the logo's own thread is woven through them, then the real logo takes over
    var tx = sr.left + .40 * sr.width, ty0 = sr.top + .06 * sr.height, ty1 = sr.top + .94 * sr.height, mL = ty1 - ty0;
    var mini = el('path', { d: 'M' + tx + ',' + ty0 + ' L' + tx + ',' + ty1, stroke: RED, 'stroke-width': .07 * sr.width, fill: 'none' }, gLogo);
    mini.style.strokeDasharray = mL + ' ' + (mL + 1);
    await animate(400, function (t) { mini.style.strokeDashoffset = mL * (1 - ease(t)); });
    ov.classList.add('sti-symbol');
    gLogo.style.display = 'none';
    await wait(200);
    ov.classList.add('sti-word');
    await wait(800);
    ov.classList.add('sti-eyebrow-in');

    // 4. Wait for the visitor, then everything moves to where it belongs.
    await hold();
    if (dead) return;
    var toLogo = document.querySelector('.brand st-logo'), toEyebrow = document.querySelector('.hero .mono');
    if (!toLogo || !toEyebrow) return done();
    var a = logo.getBoundingClientRect(), b = toLogo.getBoundingClientRect();
    var ea = eyebrow.getBoundingClientRect(), eb = toEyebrow.getBoundingClientRect();
    ov.classList.add('sti-fly');
    html.classList.remove('st-intro-dim');
    html.classList.add('st-intro-reveal');
    logo.style.transform = 'translate(' + (b.left - a.left) + 'px,' + (b.top - a.top) + 'px) scale(' + (b.height / a.height) + ')';
    eyebrow.style.transform = 'translate(' + (eb.left - ea.left) + 'px,' + (eb.top - ea.top) + 'px) scale(' + (eb.width / ea.width) + ')';
    await wait(1100);
    done();
  }

  // ---------- lifecycle ----------
  function done(skipped) {
    if (finished) return;
    finished = true; dead = true;
    if (skipped) track('intro_skip');
    html.classList.remove('st-intro', 'st-intro-reveal', 'st-intro-dim');
    if (ov.parentNode) ov.parentNode.removeChild(ov);
    ['wheel', 'touchmove', 'pointerdown', 'keydown', 'scroll'].forEach(function (ev) { window.removeEventListener(ev, trigger); });
    window.removeEventListener('pointerdown', skip);
    window.removeEventListener('keydown', skip);
    window.removeEventListener('resize', onResize);
    window.stIntroDone = true;
    document.dispatchEvent(new Event('st-intro-done'));
  }
  function skip() { if (skippable) done(true); }
  function onResize() { done(true); }

  function trigger() {
    if (started || dead || !R) return;
    started = true;
    ['wheel', 'touchmove', 'pointerdown', 'keydown', 'scroll'].forEach(function (ev) { window.removeEventListener(ev, trigger); });
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
    window.addEventListener('resize', onResize);
    ['wheel', 'touchmove', 'pointerdown', 'keydown', 'scroll'].forEach(function (ev) {
      window.addEventListener(ev, trigger, { passive: true });
    });
    setTimeout(trigger, AUTO_START_MS);
    if (window.stLoom.rebuild) window.stLoom.rebuild();
  }

  // The route depends on where the two words sit, so wait for the heading font.
  var fontReady = document.fonts && document.fonts.load
    ? Promise.all([document.fonts.load('400 64px "Schibsted Grotesk"'), document.fonts.load('600 64px "Schibsted Grotesk"')])
    : Promise.resolve();
  Promise.race([Promise.all([customElements.whenDefined('st-logo'), fontReady]), wait(1500)])
    .then(function () { requestAnimationFrame(ready); }, function () { requestAnimationFrame(ready); });
})();
