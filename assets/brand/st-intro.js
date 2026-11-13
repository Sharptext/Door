/*
  Sharptext intro animation (home page only). See st-intro.css.

  Starts on scroll, wheel, touch, click or key press, or after a few seconds.
  A click or key press while it runs skips to the site. Plays once per browser
  session; add ?intro to the URL to see it again. The decision to play is made by
  the small script in the page head, which adds the st-intro class to <html>.
  When it finishes (or is skipped) it fires a "st-intro-done" event on document.
*/
(function () {
  var html = document.documentElement;
  if (!html.classList.contains('st-intro')) return;
  window.stIntroStarted = true;
  try { sessionStorage.setItem('st-intro-seen', '1'); } catch (e) {}

  var AUTO_START_MS = 2500;
  var dead = false, started = false, finished = false;

  var ov = document.createElement('div');
  ov.id = 'st-intro';
  ov.setAttribute('aria-hidden', 'true');
  ov.innerHTML =
    '<svg class="sti-svg" xmlns="http://www.w3.org/2000/svg">' +
      '<path class="sti-trail"/>' +
      '<circle class="sti-node sti-k" r="7"/>' +
      '<circle class="sti-node sti-d" r="7"/>' +
      '<circle class="sti-dot" r="4.5" style="display:none"/>' +
    '</svg>' +
    '<span class="sti-label sti-lk">knowing</span>' +
    '<span class="sti-label sti-ld">doing</span>' +
    '<div class="sti-lockup"><st-logo class="st-logo"><span class="st-logo__word">sharptext</span></st-logo></div>';
  document.body.appendChild(ov);

  var q = function (s) { return ov.querySelector(s); };
  var trail = q('.sti-trail'), nK = q('.sti-k'), nD = q('.sti-d'), dot = q('.sti-dot');
  var lK = q('.sti-lk'), lD = q('.sti-ld'), lock = q('.sti-lockup'), logo = q('st-logo');

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
  var easeInOut = function (t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var pathD = function (pts) { return 'M' + pts.map(function (p) { return p[0].toFixed(2) + ',' + p[1].toFixed(2); }).join(' L'); };

  function done() {
    if (finished) return;
    finished = true; dead = true;
    html.classList.remove('st-intro', 'st-intro-reveal');
    if (ov.parentNode) ov.parentNode.removeChild(ov);
    ['wheel', 'touchmove', 'pointerdown', 'keydown', 'scroll'].forEach(function (ev) { window.removeEventListener(ev, trigger); });
    window.removeEventListener('pointerdown', skip);
    window.removeEventListener('keydown', skip);
    window.removeEventListener('resize', skip);
    window.stIntroDone = true;
    document.dispatchEvent(new Event('st-intro-done'));
  }
  function skip() { done(); }

  // ---- Geometry: the symbol sits centred; knowing and doing sit on its thread's axis.
  var G;
  function layout() {
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
    var cx = s.left + .40 * s.width;
    G = {
      cx: cx, y1: s.top + .06 * s.height, y2: s.top + .94 * s.height, tw: .07 * s.width,
      yK: Math.min(H * .16, s.top - 60), yD: Math.max(H * .84, s.bottom + 60),
      amp: Math.min(W * .3, 230)
    };
    nK.setAttribute('cx', cx); nK.setAttribute('cy', G.yK);
    nD.setAttribute('cx', cx); nD.setAttribute('cy', G.yD);
    lK.style.left = cx + 'px'; lK.style.top = (G.yK - 34) + 'px';
    lD.style.left = cx + 'px'; lD.style.top = (G.yD + 22) + 'px';
  }

  // A wandering route from knowing down to doing, zig-zagging across the axis.
  function route() {
    var n = 5, pts = [[G.cx, G.yK]], first = Math.random() < .5 ? 1 : -1;
    for (var i = 1; i <= n; i++) {
      var side = first * (i % 2 ? 1 : -1);
      var x = G.cx + side * G.amp * (.35 + .65 * Math.random());
      var y = lerp(G.yK, G.yD, i / (n + 1)) + (Math.random() - .5) * (G.yD - G.yK) / (n + 1) * .6;
      pts.push([x, y]);
    }
    pts.push([G.cx, G.yD]);
    return pts;
  }

  async function run() {
    var pts = route();
    trail.setAttribute('d', pathD(pts));
    trail.style.strokeWidth = '1.8px';
    var L = trail.getTotalLength();
    trail.style.strokeDasharray = L + ' ' + (L + 1);
    trail.style.strokeDashoffset = L;
    dot.style.display = '';

    // 1. The dot finds its way from knowing to doing, leaving a red trail.
    await animate(Math.min(2500, Math.max(1800, L * 2.3)), function (t) {
      var cur = L * easeInOut(t), p = trail.getPointAtLength(cur);
      dot.setAttribute('cx', p.x); dot.setAttribute('cy', p.y);
      trail.style.strokeDashoffset = L - cur;
    });
    nD.classList.add('sti-on');
    await wait(350);

    // 2. The trail pulls straight and becomes the thread.
    ov.classList.add('sti-settle');
    trail.style.strokeDasharray = 'none';
    dot.style.display = 'none';
    var target = pts.map(function (_, i) { return [G.cx, lerp(G.y1, G.y2, i / (pts.length - 1))]; });
    await animate(900, function (t) {
      var e = easeInOut(t);
      var now = pts.map(function (p, i) { return [lerp(p[0], target[i][0], e), lerp(p[1], target[i][1], e)]; });
      trail.setAttribute('d', pathD(now));
      trail.style.strokeWidth = lerp(1.8, G.tw, e) + 'px';
      var r = lerp(7, 0, Math.min(1, e * 1.4));
      nK.setAttribute('cy', now[0][1]); nK.setAttribute('r', r);
      nD.setAttribute('cy', now[now.length - 1][1]); nD.setAttribute('r', r);
    });

    // 3. Swap to the real symbol; the three lines weave through the thread.
    ov.classList.add('sti-symbol');
    trail.style.display = 'none'; nK.style.display = 'none'; nD.style.display = 'none';
    await wait(80);
    ov.classList.add('sti-weave');
    await wait(950);

    // 4. The wordmark joins and the lockup centres itself.
    ov.classList.add('sti-word');
    lock.style.transform = 'translateX(0px)';
    await wait(1150);
    if (dead) return;

    // 5. The lockup flies to its place in the header while the site comes into view.
    var to = document.querySelector('.brand st-logo');
    if (!to) return done();
    var a = logo.getBoundingClientRect(), b = to.getBoundingClientRect();
    ov.classList.add('sti-fly');
    html.classList.add('st-intro-reveal');
    logo.style.transform = 'translate(' + (b.left - a.left) + 'px,' + (b.top - a.top) + 'px) scale(' + (b.height / a.height) + ')';
    await wait(1050);
    done();
  }

  function trigger() {
    if (started || dead) return;
    started = true;
    setTimeout(function () {
      window.addEventListener('pointerdown', skip);
      window.addEventListener('keydown', skip);
    }, 0);
    run().catch(done);
  }

  function ready() {
    if (dead) return;
    layout();
    // reflow, then fade in knowing and doing
    ov.getBoundingClientRect();
    ov.classList.add('sti-ready');
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
