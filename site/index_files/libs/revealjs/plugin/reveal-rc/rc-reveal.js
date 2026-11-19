
// One background video per slide. A slide opens on the first frame of its video and waits; every click plays the video
// to the next pause. Only a first click marked auto plays by itself as the slide opens. A first click marked after = N
// belongs to a slide that takes over a looping picture: the slide dissolves in over the one before it and the click
// starts by itself N seconds later (or at once on a key press). Pauses and notes come from window.RC_PLAYBACK.
window.RevealRC = {
  id: 'rc',
  init: (deck) => {
    const info = window.RC_PLAYBACK || {};
    const st = { raf: null, timer: null };
    const slides = deck.getSlides().filter(s => s.hasAttribute('data-rc'));
    const first = (d) => (d.clicks.length && d.clicks[0].auto ? 1 : 0);     // clicks that need no key press
    const after = (d) => (d.clicks.length && !d.clicks[0].auto && d.clicks[0].after) || 0;   // seconds; 0: wait for a key press
    slides.forEach(s => {
      const d = info[s.getAttribute('data-rc')];
      if (!d) return;
      s.setAttribute('data-background-video', d.video);
      s.setAttribute('data-background-video-muted', '');
      s.setAttribute('data-background-size', 'contain');
      s.setAttribute('data-background-color', '#1e1e2e');
      for (let k = first(d); k < d.clicks.length; k++) {
        const f = document.createElement('div');
        f.className = 'fragment rc-click';
        f.setAttribute('data-rc-k', k);
        if (d.clicks[k].note) f.setAttribute('data-notes', d.clicks[k].note);     // no line: the slide's own notes stay up
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
      if (passive) { rest(s, k + 1); return; }
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
    function rest(s, n) {                                    // the still picture after n clicks; n = 0: the slide as it opens
      const d = info[s.getAttribute('data-rc')], v = vid(s);
      if (!d || !v) return;
      stop(); v.pause();
      n = Math.min(n, d.clicks.length);
      v.currentTime = n > 0 ? Math.max(0, d.clicks[n - 1].end - HOLD) : 0.001;      // 0.001: a seek, so the first frame is decoded and shown
    }
    function done(s) {                                       // how many clicks of this slide have been played
      const d = info[s.getAttribute('data-rc')];
      return d ? first(d) + s.querySelectorAll('.rc-click.visible').length : 0;
    }
    function prime(s) {                                      // the slide that comes next already shows its first frame
      const d = s && info[s.getAttribute('data-rc')], v = vid(s);
      if (d && v && v.paused && v.readyState >= 1 && !s.querySelector('.rc-click.visible')) v.currentTime = 0.001;
    }
    deck.on('ready', (e) => {
      slides.forEach(s => {                                  // slides that dissolve in (see the stylesheet)
        const d = info[s.getAttribute('data-rc')];
        if (d && after(d) && s.slideBackgroundElement) s.slideBackgroundElement.classList.add('rc-soft');
      });
      const s = e.currentSlide;
      if (s && s.hasAttribute('data-rc')) setTimeout(() => { rest(s, done(s)); prime(s.nextElementSibling); }, 300);
    });
    deck.on('slidechanged', (e) => {
      stop();
      clearTimeout(st.timer);
      document.querySelectorAll('.slide-background.rc-under').forEach(b => b.classList.remove('rc-under'));
      const s = e.currentSlide;
      if (!s.hasAttribute('data-rc')) return;
      const d = info[s.getAttribute('data-rc')];
      const back = e.previousSlide && deck.getIndices(e.previousSlide).h > deck.getIndices(s).h;
      const wait = d ? after(d) : 0;
      if (wait && e.previousSlide && e.previousSlide.slideBackgroundElement)      // the picture we leave stays underneath
        e.previousSlide.slideBackgroundElement.classList.add('rc-under');         // while this one dissolves in over it
      const go = () => {
        if (deck.getCurrentSlide() !== s) return;
        const n = done(s);
        if (!back && d && first(d) && n === 1) play(s, 0, false);      // an auto first click: the title fades in by itself
        else rest(s, n);                                               // every other slide waits for a key press
        if (!back && wait && n === 0 && !passive)                      // ... or, after a loop, starts by itself a moment later
          st.timer = setTimeout(() => { if (deck.getCurrentSlide() === s && done(s) === 0) deck.nextFragment(); }, wait * 1000);
        prime(s.nextElementSibling);
      };
      // Reveal stops the background's media right after this event: start a moment later
      setTimeout(() => { const w = vid(s); if (w && w.readyState >= 1) go(); else if (w) w.addEventListener('loadedmetadata', go, { once: true }); }, 90);
    });
    deck.on('fragmentshown', (e) => {
      const f = e.fragment;
      if (f.classList.contains('rc-click')) play(deck.getCurrentSlide(), +f.getAttribute('data-rc-k'), true);
    });
    deck.on('fragmenthidden', (e) => {
      const f = e.fragment;
      if (f.classList.contains('rc-click')) rest(deck.getCurrentSlide(), +f.getAttribute('data-rc-k'));
    });
  }
};
