/* ============================================================
   FoleyFX — 효과음(Howler), 움직임(GSAP), 축하 효과(tsParticles confetti), 아이콘 적용
   app.js 보다 먼저 로드됨. 라이브러리가 없어도 앱은 그대로 동작하도록 모두 방어적으로 작성.
   ============================================================ */
(() => {
  'use strict';

  const hasGsap = typeof gsap !== 'undefined';
  const hasHowl = typeof Howl !== 'undefined';
  const hasConfetti = typeof confetti === 'function';
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 아이콘 적용: <i data-ph="..."> / <i data-emoji="..."> ---------- */
  function applyIcons(root) {
    const scope = root || document;
    if (typeof window.phIcon !== 'function') return;
    scope.querySelectorAll('[data-ph]').forEach((el) => {
      const html = window.phIcon(el.dataset.ph, el.className);
      if (html) el.outerHTML = html.replace('<svg ', `<svg data-ph="${el.dataset.ph}" `);
    });
    scope.querySelectorAll('[data-emoji]').forEach((el) => {
      const html = window.emojiIcon(el.dataset.emoji, el.className);
      if (html) el.outerHTML = html;
    });
  }

  /* ---------- 효과음 ---------- */
  const LS_FX = 'foley.fx';
  let fxOn = (() => { try { return localStorage.getItem(LS_FX) !== 'off'; } catch (e) { return true; } })();
  const sounds = {};
  const SOUND_FILES = {
    click: 'assets/sounds/click.ogg',
    tick: 'assets/sounds/tick.ogg',
    go: 'assets/sounds/go.ogg',
    start: 'assets/sounds/start.ogg',
    stop: 'assets/sounds/stop.ogg',
    success: 'assets/sounds/success.ogg',
    error: 'assets/sounds/error.ogg',
  };
  function getSound(name) {
    if (!hasHowl || !SOUND_FILES[name]) return null;
    if (!sounds[name]) {
      sounds[name] = new Howl({ src: [SOUND_FILES[name]], volume: 0.45, preload: true, html5: false });
    }
    return sounds[name];
  }
  function play(name) {
    if (!fxOn) return;
    try {
      const s = getSound(name);
      if (s) s.play();
    } catch (e) { /* 효과음은 없어도 됨 */ }
  }
  function setFx(on) {
    fxOn = !!on;
    try { localStorage.setItem(LS_FX, fxOn ? 'on' : 'off'); } catch (e) { /* 무시 */ }
  }

  /* ---------- 움직임 ---------- */
  function pop(el, opts) {
    if (!hasGsap || reduced || !el) return;
    gsap.fromTo(el, { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(2)', ...(opts || {}) });
  }
  function slideIn(el, fromX) {
    if (!hasGsap || reduced || !el) return;
    gsap.fromTo(el, { x: fromX == null ? -24 : fromX, opacity: 0 }, { x: 0, opacity: 1, duration: 0.4, ease: 'back.out(1.6)' });
  }
  function bounce(el) {
    if (!hasGsap || reduced || !el) return;
    gsap.fromTo(el, { scale: 0.92 }, { scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.45)' });
  }
  function shake(el) {
    if (!hasGsap || reduced || !el) return;
    gsap.fromTo(el, { x: -6 }, { x: 0, duration: 0.4, ease: 'elastic.out(1, 0.3)' });
  }
  function countdownPop(el) {
    if (!hasGsap || reduced || !el) return;
    gsap.fromTo(el, { scale: 1.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(2.5)' });
  }
  function toastIn(el) {
    if (!hasGsap || reduced || !el) return;
    gsap.fromTo(el, { y: 16, opacity: 0, xPercent: -50 }, { y: 0, opacity: 1, xPercent: -50, duration: 0.35, ease: 'back.out(1.8)' });
  }
  function modalIn(box) {
    if (!hasGsap || reduced || !box) return;
    gsap.fromTo(box, { scale: 0.85, y: 12, opacity: 0 }, { scale: 1, y: 0, opacity: 1, duration: 0.35, ease: 'back.out(1.7)' });
  }

  // 모든 버튼: 누를 때 살짝 눌리는 느낌 + 클릭 효과음
  function wireButtons() {
    document.addEventListener('pointerdown', (e) => {
      const btn = e.target.closest('.btn, .icon-btn, .mini-btn, .sound-btn, .icon-choice, .sound-item');
      if (!btn || btn.disabled) return;
      if (hasGsap && !reduced) gsap.to(btn, { scale: 0.93, duration: 0.08, ease: 'power2.out' });
    }, { capture: true });
    const release = (e) => {
      const btn = e.target.closest('.btn, .icon-btn, .mini-btn, .sound-btn, .icon-choice, .sound-item');
      if (!btn) return;
      if (hasGsap && !reduced) gsap.to(btn, { scale: 1, duration: 0.45, ease: 'elastic.out(1, 0.5)' });
    };
    document.addEventListener('pointerup', release, { capture: true });
    document.addEventListener('pointercancel', release, { capture: true });
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn, .icon-btn, .mini-btn, .sound-btn, .icon-choice');
      if (!btn || btn.disabled || btn.id === 'btn-record') return;
      if (document.body.classList.contains('is-recording')) return;
      play('click');
    }, { capture: true });
  }

  // 모달이 열릴 때마다 상자 등장 효과
  function wireModals() {
    if (!('MutationObserver' in window)) return;
    document.querySelectorAll('.modal').forEach((m) => {
      new MutationObserver(() => { if (!m.hidden) modalIn(m.querySelector('.modal-box')); })
        .observe(m, { attributes: true, attributeFilter: ['hidden'] });
    });
  }

  /* ---------- 축하 효과 ---------- */
  function celebrate(kind) {
    if (!hasConfetti || reduced) return;
    try {
      if (kind === 'big') {
        confetti({ particleCount: 90, spread: 80, startVelocity: 45, origin: { x: 0.5, y: 0.6 },
          colors: ['#ff6b6b', '#ffd166', '#06d6a0', '#4cc9f0', '#b388ff'] });
        confetti({ particleCount: 24, spread: 70, startVelocity: 40, origin: { x: 0.5, y: 0.6 }, scalar: 2.2,
          shapes: ['emoji'], shapeOptions: { emoji: { value: ['🎉', '🎬', '🎵', '⭐'] } } });
      } else {
        confetti({ particleCount: 18, spread: 60, startVelocity: 30, origin: { x: 0.86, y: 0.45 }, scalar: 2,
          shapes: ['emoji'], shapeOptions: { emoji: { value: ['🎤', '🎵', '✨'] } } });
      }
    } catch (e) { /* 없어도 됨 */ }
  }

  document.addEventListener('DOMContentLoaded', () => {
    applyIcons();
    wireButtons();
    wireModals();
  });

  window.FoleyFX = {
    applyIcons, play, setFx, isOn: () => fxOn,
    pop, slideIn, bounce, shake, countdownPop, toastIn, celebrate,
  };
})();
