/* ============================================================
   발표 화면 (선생님용) — 학생이 보낸 작품 목록과 재생
   ============================================================ */
(() => {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const els = {
    teacherActions: $('#teacher-actions'),
    classSelect: $('#class-select'),
    btnNewClass: $('#btn-new-class'),
    btnClassQr: $('#btn-class-qr'),
    btnFullscreen: $('#btn-fullscreen'),
    btnSignout: $('#btn-signout'),
    setupView: $('#setup-view'),
    loginView: $('#login-view'),
    btnGoogle: $('#btn-google'),
    loginError: $('#login-error'),
    worksView: $('#works-view'),
    classCodeBig: $('#class-code-big'),
    workCount: $('#work-count'),
    btnPlayAll: $('#btn-play-all'),
    btnDeleteAll: $('#btn-delete-all'),
    worksGrid: $('#works-grid'),
    worksEmpty: $('#works-empty'),
    player: $('#player'),
    playerVideo: $('#player-video'),
    playerName: $('#player-name'),
    playerPrev: $('#player-prev'),
    playerReplay: $('#player-replay'),
    playerNext: $('#player-next'),
    playerClose: $('#player-close'),
    qrModal: $('#qr-modal'),
    qrCode: $('#qr-code'),
    qrClassCode: $('#qr-class-code'),
    qrUrl: $('#qr-url'),
    qrClose: $('#qr-close'),
    modal: $('#modal'),
    modalText: $('#modal-text'),
    modalOk: $('#modal-ok'),
    modalCancel: $('#modal-cancel'),
    toast: $('#toast'),
  };

  const LS_CLASS = 'foley.presentClass';
  const lsGet = (k) => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* 무시 */ } };

  const state = {
    user: null,
    classes: [],
    code: '',
    works: [],
    unsubscribe: null,
    playingIndex: -1,
  };

  /* ---------- 공용 UI ---------- */
  let toastTimer = null;
  function toast(msg, ms = 2500) {
    els.toast.textContent = msg;
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { els.toast.hidden = true; }, ms);
  }
  function ask(message, okLabel = '네', cancelLabel = '아니요') {
    return new Promise((resolve) => {
      els.modalText.textContent = message;
      els.modalOk.textContent = okLabel;
      els.modalCancel.textContent = cancelLabel;
      els.modal.hidden = false;
      const done = (v) => { els.modal.hidden = true; els.modalOk.onclick = null; els.modalCancel.onclick = null; resolve(v); };
      els.modalOk.onclick = () => done(true);
      els.modalCancel.onclick = () => done(false);
    });
  }
  const fmtDur = (s) => { s = Math.max(0, Math.round(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const fmtTime = (ts) => {
    const ms = FoleyCloud.tsMs(ts);
    if (!ms) return '방금';
    const d = new Date(ms);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  function showView(name) {
    els.setupView.hidden = name !== 'setup';
    els.loginView.hidden = name !== 'login';
    els.worksView.hidden = name !== 'works';
    els.teacherActions.hidden = name !== 'works';
  }

  /* ---------- 시작 / 로그인 ---------- */
  if (!window.FoleyCloud || !FoleyCloud.available) {
    showView('setup');
    return;
  }

  FoleyCloud.onAuth(async (user) => {
    if (FoleyCloud.isTeacher(user)) {
      state.user = user;
      showView('works');
      await loadClasses();
    } else {
      state.user = null;
      stopListening();
      showView('login');
    }
  });

  els.btnGoogle.addEventListener('click', async () => {
    els.loginError.hidden = true;
    try {
      await FoleyCloud.signInGoogle();
    } catch (e) {
      console.warn(e);
      els.loginError.textContent = '로그인하지 못했어요. 팝업이 막혀 있지 않은지 확인해 주세요.';
      els.loginError.hidden = false;
    }
  });

  els.btnSignout.addEventListener('click', async () => {
    const ok = await ask('로그아웃할까요?', '로그아웃', '취소');
    if (ok) await FoleyCloud.signOut();
  });

  /* ---------- 교실 ---------- */
  async function loadClasses() {
    try {
      state.classes = await FoleyCloud.myClasses(state.user);
    } catch (e) {
      console.error(e);
      toast('교실 목록을 불러오지 못했어요');
      state.classes = [];
    }
    renderClassSelect();
    if (!state.classes.length) {
      // 첫 사용: 교실을 바로 만들어 준다
      await newClass(true);
      return;
    }
    const remembered = lsGet(LS_CLASS);
    const pick = state.classes.find((c) => c.code === remembered) || state.classes[0];
    selectClass(pick.code);
  }

  function renderClassSelect() {
    els.classSelect.innerHTML = '';
    for (const c of state.classes) {
      const opt = document.createElement('option');
      opt.value = c.code;
      opt.textContent = c.title ? `${c.code} · ${c.title}` : c.code;
      els.classSelect.appendChild(opt);
    }
    els.classSelect.value = state.code;
  }

  function selectClass(code) {
    state.code = code;
    lsSet(LS_CLASS, code);
    els.classSelect.value = code;
    els.classCodeBig.textContent = code;
    startListening();
  }

  els.classSelect.addEventListener('change', () => selectClass(els.classSelect.value));

  async function newClass(silent) {
    const ok = silent || await ask('새 교실 코드를 만들까요?\n학생들은 새 코드로 접속해요', '만들기', '취소');
    if (!ok) return;
    try {
      const cls = await FoleyCloud.createClass(state.user, '');
      state.classes.unshift(cls);
      renderClassSelect();
      selectClass(cls.code);
      openQr();
    } catch (e) {
      console.error(e);
      toast('교실을 만들지 못했어요. 다시 시도해 주세요');
    }
  }
  els.btnNewClass.addEventListener('click', () => newClass(false));

  /* ---------- 학생 접속 QR ---------- */
  function studentUrl() {
    const u = new URL('index.html', location.href);
    u.search = `?code=${state.code}`;
    return u.toString();
  }
  function openQr() {
    const url = studentUrl();
    els.qrUrl.value = url;
    els.qrClassCode.textContent = state.code;
    els.qrCode.innerHTML = '';
    try {
      const qr = qrcode(0, 'M');
      qr.addData(url);
      qr.make();
      els.qrCode.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
    } catch (e) { els.qrCode.textContent = url; }
    els.qrModal.hidden = false;
  }
  els.btnClassQr.addEventListener('click', openQr);
  els.qrClose.addEventListener('click', () => { els.qrModal.hidden = true; });

  els.btnFullscreen.addEventListener('click', () => {
    const el = document.documentElement;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  });

  /* ---------- 작품 목록 ---------- */
  function stopListening() {
    if (state.unsubscribe) state.unsubscribe();
    state.unsubscribe = null;
  }

  function startListening() {
    stopListening();
    state.works = [];
    renderWorks();
    state.unsubscribe = FoleyCloud.listenWorks(state.code, (list) => {
      const prevCount = state.works.length;
      state.works = list;
      renderWorks();
      if (list.length > prevCount && prevCount > 0) toast(`${list[0].name} 작품이 도착했어요! 🎉`);
    }, (err) => {
      console.error(err);
      toast('작품 목록을 불러오지 못했어요');
    });
  }

  function renderWorks() {
    els.worksGrid.innerHTML = '';
    els.workCount.textContent = String(state.works.length);
    els.worksEmpty.hidden = state.works.length > 0;
    els.btnPlayAll.disabled = !state.works.length;
    els.btnDeleteAll.disabled = !state.works.length;
    // 보낸 순서(오래된 것부터)로 번호를 매겨 발표 순서를 쉽게 함
    const ordered = [...state.works].reverse();
    ordered.forEach((w, i) => {
      const card = document.createElement('div');
      card.className = 'work-card';
      card.dataset.workId = w.id;
      if (w.thumbUrl) {
        const img = document.createElement('img');
        img.className = 'work-thumb';
        img.src = w.thumbUrl;
        img.alt = '';
        card.appendChild(img);
      } else {
        const ph = document.createElement('div');
        ph.className = 'work-thumb-empty';
        ph.textContent = '🎬';
        card.appendChild(ph);
      }
      const play = document.createElement('div');
      play.className = 'work-play';
      play.textContent = '▶';
      const num = document.createElement('div');
      num.className = 'work-num';
      num.textContent = String(i + 1);
      const del = document.createElement('button');
      del.className = 'work-del';
      del.title = '지우기';
      del.textContent = '🗑';
      del.addEventListener('click', async (e) => {
        e.stopPropagation();
        const ok = await ask(`"${w.name}" 작품을 지울까요?`, '지우기', '취소');
        if (!ok) return;
        try { await FoleyCloud.deleteWork(state.code, w); toast('지웠어요'); } catch (err) { console.error(err); toast('지우지 못했어요'); }
      });
      const info = document.createElement('div');
      info.className = 'work-info';
      const name = document.createElement('div');
      name.className = 'work-name';
      name.textContent = w.name || '이름 없음';
      const meta = document.createElement('div');
      meta.className = 'work-meta';
      meta.textContent = `${fmtDur(w.duration)} · ${fmtTime(w.createdAt)}`;
      info.append(name, meta);
      card.append(play, num, del, info);
      card.addEventListener('click', () => openPlayer(i));
      els.worksGrid.appendChild(card);
    });
  }

  els.btnDeleteAll.addEventListener('click', async () => {
    const ok = await ask(`작품 ${state.works.length}개를 모두 지울까요?\n지우면 되돌릴 수 없어요`, '모두 지우기', '취소');
    if (!ok) return;
    try { await FoleyCloud.deleteAllWorks(state.code); toast('모두 지웠어요'); } catch (e) { console.error(e); toast('일부를 지우지 못했어요'); }
  });

  /* ---------- 재생 ---------- */
  function orderedWorks() { return [...state.works].reverse(); }

  function openPlayer(index) {
    const list = orderedWorks();
    if (!list.length) return;
    state.playingIndex = Math.max(0, Math.min(list.length - 1, index));
    const w = list[state.playingIndex];
    els.playerName.textContent = `${state.playingIndex + 1}. ${w.name}`;
    els.playerVideo.src = w.videoUrl;
    els.player.hidden = false;
    els.playerPrev.disabled = state.playingIndex === 0;
    els.playerNext.disabled = state.playingIndex >= list.length - 1;
    els.playerVideo.play().catch(() => {});
  }
  function closePlayer() {
    els.playerVideo.pause();
    els.playerVideo.removeAttribute('src');
    els.playerVideo.load();
    els.player.hidden = true;
    state.playingIndex = -1;
  }
  els.btnPlayAll.addEventListener('click', () => openPlayer(0));
  els.playerPrev.addEventListener('click', () => openPlayer(state.playingIndex - 1));
  els.playerNext.addEventListener('click', () => openPlayer(state.playingIndex + 1));
  els.playerReplay.addEventListener('click', () => { els.playerVideo.currentTime = 0; els.playerVideo.play().catch(() => {}); });
  els.playerClose.addEventListener('click', closePlayer);
  document.addEventListener('keydown', (e) => {
    if (els.player.hidden) return;
    if (e.key === 'Escape') closePlayer();
    else if (e.key === 'ArrowRight') openPlayer(state.playingIndex + 1);
    else if (e.key === 'ArrowLeft') openPlayer(state.playingIndex - 1);
    else if (e.code === 'Space') { e.preventDefault(); els.playerVideo.paused ? els.playerVideo.play() : els.playerVideo.pause(); }
  });
})();
