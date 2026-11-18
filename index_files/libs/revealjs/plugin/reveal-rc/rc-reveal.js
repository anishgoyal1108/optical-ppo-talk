
// One background video per slide; a click plays it to the next pause. Pauses and notes come from window.RC_PLAYBACK.
window.RevealRC = {
  id: 'rc',
  init: (deck) => {
    const info = window.RC_PLAYBACK || {};
    const st = { raf: null };
    const slides = deck.getSlides().filter(s => s.hasAttribute('data-rc'));
    slides.forEach(s => {
      const d = info[s.getAttribute('data-rc')];
      if (!d) return;
      s.setAttribute('data-background-video', d.video);
      s.setAttribute('data-background-video-muted', '');
      s.setAttribute('data-background-size', 'contain');
      s.setAttribute('data-background-color', '#1e1e2e');
      for (let k = 1; k < d.clicks.length; k++) {          // click 1 plays when the slide opens
        const f = document.createElement('div');
        f.className = 'fragment rc-click';
        f.setAttribute('data-rc-k', k);
        f.setAttribute('data-notes', d.clicks[k].note);
        s.appendChild(f);
      }
    });
    const vid = (s) => s && s.slideBackgroundElement && s.slideBackgroundElement.querySelector('video');
    const stop = () => { if (st.raf) cancelAnimationFrame(st.raf); st.raf = null; };
    const HOLD = 0.12;                                      // every click ends on 0.3 s of still picture
    const passive = /receiver/i.test(window.location.search);   // the speaker view's previews show stills, not motion
    function play(s, k, fromPrev) {
      const d = info[s.getAttribute('data-rc')], v = vid(s);
      if (!d || !v) return;
      if (passive) { rest(s, k); return; }
      stop();
      const c = d.clicks[k];
      v.playbackRate = 1;
      if (!(fromPrev && Math.abs(v.currentTime - c.start) < 0.35)) v.currentTime = c.start;
      const p = v.play(); if (p && p.catch) p.catch(() => {});
      const tick = () => {
        if (v.paused && v.currentTime < c.end - HOLD) { const q = v.play(); if (q && q.catch) q.catch(() => {}); }   // Reveal pauses backgrounds on slide change
        if (v.currentTime >= c.end - HOLD) {
          if (c.kind === 'loop') { v.currentTime = c.start; }
          else { v.pause(); v.currentTime = c.end - HOLD; st.raf = null; return; }
        }
        st.raf = requestAnimationFrame(tick);
      };
      st.raf = requestAnimationFrame(tick);
    }
    function rest(s, k) {                                    // show the still picture at the end of click k
      const d = info[s.getAttribute('data-rc')], v = vid(s);
      if (!d || !v) return;
      stop(); v.pause();
      v.currentTime = Math.max(0, d.clicks[k].end - HOLD);
    }
    function shown(s) { return s.querySelectorAll('.rc-click.visible').length; }
    deck.on('ready', (e) => { const s = e.currentSlide; if (s && s.hasAttribute('data-rc')) setTimeout(() => rest(s, shown(s)), 300); });
    deck.on('slidechanged', (e) => {
      stop();
      const s = e.currentSlide;
      if (!s.hasAttribute('data-rc')) return;
      const back = e.previousSlide && deck.getIndices(e.previousSlide).h > deck.getIndices(s).h;
      const v = vid(s);
      const go = () => { if (deck.getCurrentSlide() !== s) return; back ? rest(s, shown(s)) : play(s, 0, false); };
      // Reveal stops the background's media right after this event: start a moment later
      setTimeout(() => { const w = vid(s); if (w && w.readyState >= 1) go(); else if (w) w.addEventListener('loadedmetadata', go, { once: true }); }, 90);
    });
    deck.on('fragmentshown', (e) => {
      const f = e.fragment;
      if (f.classList.contains('rc-click')) play(deck.getCurrentSlide(), +f.getAttribute('data-rc-k'), true);
    });
    deck.on('fragmenthidden', (e) => {
      const f = e.fragment;
      if (f.classList.contains('rc-click')) rest(deck.getCurrentSlide(), +f.getAttribute('data-rc-k') - 1);
    });
  }
};
