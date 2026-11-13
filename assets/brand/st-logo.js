/*
  Sharptext logo component: <st-logo>

  Lockup (symbol + live-text wordmark), linked or not, is written as:
    <st-logo class="st-logo"><span class="st-logo__word">sharptext</span></st-logo>

  Symbol alone:
    <st-logo class="st-logo" variant="symbol"></st-logo>

  Colour versions are CSS classes on the element (see the "Logo" block in the
  page styles): st-logo--dark, st-logo--black, st-logo--white. The default is
  the primary version. Lines and wordmark use currentColor; the thread uses
  var(--st-thread).

  The symbol geometry below is the approved artwork. Do not edit it.
  Each instance gets its own mask ids, so any number of symbols can share a page.
*/
(function () {
  if (!('customElements' in window) || customElements.get('st-logo')) return;

  var count = 0;

  function symbol(uid, standalone) {
    var over = 'st-over-' + uid;
    var under = 'st-under-' + uid;
    var a11y = standalone ? 'role="img" aria-label="Sharptext"' : 'aria-hidden="true" focusable="false"';
    return (
      '<svg class="st-logo__symbol" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" ' + a11y + '>' +
        '<defs>' +
          '<mask id="' + over + '" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">' +
            '<rect width="100" height="100" fill="#fff"/>' +
            '<rect x="34" y="18" width="12" height="16" fill="#000"/>' +
            '<rect x="34" y="66" width="12" height="16" fill="#000"/>' +
          '</mask>' +
          '<mask id="' + under + '" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">' +
            '<rect width="100" height="100" fill="#fff"/>' +
            '<rect x="34" y="42" width="12" height="16" fill="#000"/>' +
          '</mask>' +
        '</defs>' +
        '<g fill="currentColor" mask="url(#' + over + ')">' +
          '<rect class="st-line st-line-top" x="14" y="20.5" width="72" height="11"/>' +
          '<rect class="st-line st-line-bottom" x="14" y="68.5" width="52" height="11"/>' +
        '</g>' +
        '<rect class="st-thread" x="36.5" y="6" width="7" height="88" style="fill:var(--st-thread,#C2412D)" mask="url(#' + under + ')"/>' +
        '<rect class="st-line st-line-mid" x="14" y="44.5" width="72" height="11" fill="currentColor"/>' +
      '</svg>'
    );
  }

  customElements.define('st-logo', class extends HTMLElement {
    connectedCallback() {
      if (this.querySelector('.st-logo__symbol')) return;
      var standalone = this.getAttribute('variant') === 'symbol';
      count += 1;
      this.insertAdjacentHTML('afterbegin', symbol(count, standalone));
    }
  });
})();
