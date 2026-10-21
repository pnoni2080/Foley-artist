/* ============================================================
   폴리 아티스트 — 초등학생용 "영상에 소리 입히기" 웹앱
   (빌드 없이 동작하는 순수 JavaScript)
   ============================================================ */
(() => {
  'use strict';

  /* ---------- 유틸 ---------- */
  const $ = (sel) => document.querySelector(sel);
  const uid = () => Math.random().toString(36).slice(2, 10);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const fmt = (s) => {
    s = Math.max(0, Number.isFinite(s) ? s : 0);
    const m = Math.floor(s / 60);
    const r = Math.floor(s % 60);
    return `${m}:${String(r).padStart(2, '0')}`;
  };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const HEAD_W = 190;
  const TRACK_ICONS = ['🎤', '🥁', '👏', '👣', '🐶', '🐱', '🚗', '🌧️', '🔔', '💥', '🎵', '🐦'];
  // 그림 고르기 창에 나오는 전체 목록
  const ICON_CHOICES = [
    '🎤', '🥁', '🎸', '🎹', '🎺', '🔔', '🎵', '👏', '👣', '🏃', '🚪', '🔑',
    '🐶', '🐱', '🐦', '🐸', '🐴', '🦁', '🐮', '🐷', '🐔', '🐝', '🦆', '🐘',
    '🚗', '🚂', '✈️', '🚁', '🚲', '🚀', '⛵', '🚨', '🌧️', '⛈️', '💨', '🌊',
    '🔥', '💥', '⚡', '❄️', '🍳', '🥤', '🍎', '🎉', '⚽', '🏀', '😂', '😱',
    '📞', '⏰', '🔨', '✂️', '📣', '🎃', '👻', '🤖', '🦖', '🐉',
  ];
  const TRACK_COLORS = ['#FFB3AE', '#FFD9A3', '#FFF3A3', '#CFF5B0', '#A9E2FF', '#CFC0FF', '#FFC6DD', '#B3F5E6'];

  /* ---------- 화면 요소 ---------- */
  const els = {
    video: $('#video'),
    videoFrame: $('#video-frame'),
    videoEmpty: $('#video-empty'),
    countdown: $('#countdown'),
    recBadge: $('#rec-badge'),
    btnPlay: $('#btn-play'),
    btnStart: $('#btn-start'),
    timeDisplay: $('#time-display'),
    chkOriginal: $('#chk-original'),
    btnRecord: $('#btn-record'),
    recordStatus: $('#record-status'),
    recordTarget: $('#record-target'),
    meterFill: $('#meter-fill'),
    btnAddTrack: $('#btn-add-track'),
    btnAddTrack2: $('#btn-add-track-2'),
    btnDelClip: $('#btn-del-clip'),
    btnDelTrack: $('#btn-del-track'),
    btnQr: $('#btn-qr'),
    iconModal: $('#icon-modal'),
    iconGrid: $('#icon-grid'),
    iconCancel: $('#icon-cancel'),
    qrModal: $('#qr-modal'),
    qrCode: $('#qr-code'),
    qrUrl: $('#qr-url'),
    qrClose: $('#qr-close'),
    btnSend: $('#btn-send'),
    recordLabel: $('#record-label'),
    padletModal: $('#padlet-modal'),
    padletShare: $('#padlet-share'),
    padletOpen: $('#padlet-open'),
    padletSave: $('#padlet-save'),
    padletNolink: $('#padlet-nolink'),
    padletClose: $('#padlet-close'),
    sendOverlay: $('#send-overlay'),
    sendText: $('#send-text'),
    sendProgress: $('#send-progress'),
    sendCancel: $('#send-cancel'),
    qrPadlet: $('#qr-padlet'),
    btnZoomIn: $('#btn-zoom-in'),
    btnZoomOut: $('#btn-zoom-out'),
    tlScroll: $('#timeline-scroll'),
    tlInner: $('#timeline-inner'),
    ruler: $('#ruler'),
    videoLane: $('#video-lane'),
    tracks: $('#tracks'),
    playhead: $('#playhead'),
    fileInput: $('#file-input'),
    btnOpenVideo: $('#btn-open-video'),
    btnOpenVideo2: $('#btn-open-video-2'),
    btnExport: $('#btn-export'),
    btnNew: $('#btn-new'),
    modal: $('#modal'),
    modalText: $('#modal-text'),
    modalOk: $('#modal-ok'),
    modalCancel: $('#modal-cancel'),
    exportOverlay: $('#export-overlay'),
    exportProgress: $('#export-progress'),
    exportCancel: $('#export-cancel'),
    toast: $('#toast'),
  };

  /* ---------- 상태 ---------- */
  const state = {
    videoBlob: null,
    videoName: '',
    videoUrl: '',
    duration: 0,
    tracks: [],        // { id, name, icon, color, muted }
    clips: [],         // { id, trackId, start, duration, name, blob, buffer, peaks }
    selectedTrackId: null,
    selectedClipId: null,
    pps: 60,           // 1초당 픽셀
    playing: false,
    recording: false,
    exporting: false,
    thumbs: [],        // { t, url }
    thumbInterval: 1,
  };

  /* ---------- 오디오 엔진 ---------- */
  let ctx = null;
  let master = null;
  let mediaSrc = null;
  const trackGains = new Map();
  let activeSources = [];

  function ensureAudio() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.connect(ctx.destination);
    try {
      mediaSrc = ctx.createMediaElementSource(els.video);
      mediaSrc.connect(master);
    } catch (e) {
      console.warn('영상 소리를 오디오 엔진에 연결하지 못했어요', e);
    }
    for (const t of state.tracks) trackGain(t);
    return ctx;
  }

  function trackGain(track) {
    if (!ctx) return null;
    let g = trackGains.get(track.id);
    if (!g) {
      g = ctx.createGain();
      g.connect(master);
      trackGains.set(track.id, g);
    }
    g.gain.value = track.muted ? 0 : 1;
    return g;
  }

  function scheduleClips() {
    stopClips();
    if (!ctx) return;
    const t0 = els.video.currentTime;
    const base = ctx.currentTime + 0.03;
    for (const c of state.clips) {
      if (!c.buffer) continue;
      if (c.start + c.duration <= t0) continue;
      const track = trackById(c.trackId);
      if (!track) continue;
      const src = ctx.createBufferSource();
      src.buffer = c.buffer;
      src.connect(trackGain(track));
      const when = base + Math.max(0, c.start - t0);
      const offset = Math.max(0, t0 - c.start);
      src.start(when, offset);
      activeSources.push(src);
    }
  }

  function stopClips() {
    for (const s of activeSources) {
      try { s.stop(); } catch (e) { /* 이미 끝남 */ }
    }
    activeSources = [];
  }

  async function blobToBuffer(blob) {
    ensureAudio();
    const arr = await blob.arrayBuffer();
    return await ctx.decodeAudioData(arr);
  }

  function computePeaks(buffer, count = 400) {
    const len = buffer.length;
    const step = Math.max(1, Math.floor(len / count));
    const peaks = new Float32Array(count);
    const channels = [];
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) channels.push(buffer.getChannelData(ch));
    for (let i = 0; i < count; i++) {
      const s0 = i * step;
      const s1 = Math.min(len, s0 + step);
      let max = 0;
      for (const data of channels) {
        for (let j = s0; j < s1; j += 4) {
          const v = Math.abs(data[j]);
          if (v > max) max = v;
        }
      }
      peaks[i] = max;
    }
    return peaks;
  }

  /* ---------- 공용 UI ---------- */
  let toastTimer = null;
  function toast(msg, ms = 2200) {
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
      const done = (v) => {
        els.modal.hidden = true;
        els.modalOk.onclick = null;
        els.modalCancel.onclick = null;
        resolve(v);
      };
      els.modalOk.onclick = () => done(true);
      els.modalCancel.onclick = () => done(false);
    });
  }

  const trackById = (id) => state.tracks.find((t) => t.id === id);
  const clipById = (id) => state.clips.find((c) => c.id === id);
  const selectedTrack = () => trackById(state.selectedTrackId);

  /* ---------- 재생 ---------- */
  function play() {
    if (!state.duration) { toast('먼저 영상을 가져와요! 🎬'); return; }
    ensureAudio();
    if (els.video.ended || els.video.currentTime >= state.duration - 0.05) {
      els.video.currentTime = 0;
    }
    els.video.play().catch((e) => console.warn(e));
    keepAwake();
  }

  function pause() { els.video.pause(); }

  /* ---------- 화면 안 꺼지게 (태블릿) ---------- */
  let wakeLock = null;
  async function keepAwake() {
    try {
      if (!('wakeLock' in navigator) || wakeLock) return;
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch (e) { /* 지원 안 하거나 거부됨 */ }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && (state.playing || state.recording)) keepAwake();
  });

  function seek(t) {
    if (!state.duration) return;
    els.video.currentTime = clamp(t, 0, state.duration);
    updatePlayhead();
  }

  function updatePlayBtn() {
    els.btnPlay.textContent = state.playing ? '⏸' : '▶';
    els.btnPlay.title = state.playing ? '멈춤' : '재생';
  }

  els.video.addEventListener('playing', () => {
    state.playing = true;
    scheduleClips();
    updatePlayBtn();
  });
  els.video.addEventListener('pause', () => {
    state.playing = false;
    stopClips();
    updatePlayBtn();
  });
  els.video.addEventListener('ended', () => {
    state.playing = false;
    stopClips();
    updatePlayBtn();
    if (state.recording) stopRecording();
  });
  els.video.addEventListener('waiting', stopClips);
  els.video.addEventListener('seeking', () => { if (state.playing) stopClips(); });
  els.video.addEventListener('seeked', () => {
    if (state.playing && !els.video.paused) scheduleClips();
  });

  els.btnPlay.addEventListener('click', () => (state.playing ? pause() : play()));
  els.btnStart.addEventListener('click', () => seek(0));
  els.chkOriginal.addEventListener('change', applyOriginal);

  function applyOriginal() {
    els.video.muted = !els.chkOriginal.checked;
    saveProjectSoon();
  }

  /* ---------- 매 프레임 화면 갱신 ---------- */
  function tick() {
    const t = els.video.currentTime || 0;
    els.timeDisplay.textContent = `${fmt(t)} / ${fmt(state.duration)}`;
    updatePlayhead();
    if (state.playing || state.recording) {
      const x = HEAD_W + t * state.pps;
      const visL = els.tlScroll.scrollLeft + HEAD_W;
      const visR = els.tlScroll.scrollLeft + els.tlScroll.clientWidth;
      if (x > visR - 30 || x < visL) {
        els.tlScroll.scrollLeft = Math.max(0, x - HEAD_W - 80);
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  function updatePlayhead() {
    const t = els.video.currentTime || 0;
    els.playhead.style.left = `${HEAD_W + t * state.pps}px`;
  }

  /* ---------- 영상 불러오기 ---------- */
  function loadVideo(blob, name, opts = {}) {
    return new Promise((resolve, reject) => {
      if (state.videoUrl) URL.revokeObjectURL(state.videoUrl);
      state.videoBlob = blob;
      state.videoName = name || '영상';
      state.videoUrl = URL.createObjectURL(blob);
      state.thumbs = [];
      els.video.src = state.videoUrl;

      const onMeta = () => {
        els.video.removeEventListener('loadedmetadata', onMeta);
        els.video.removeEventListener('error', onErr);
        let d = els.video.duration;
        if (!Number.isFinite(d) || d <= 0) {
          toast('이 영상은 길이를 알 수 없어요 😢 다른 영상을 가져와요');
          d = 0;
        }
        state.duration = d;
        els.videoEmpty.hidden = true;
        if (!opts.keepTracks && state.tracks.length === 0) addTrack();
        fitZoom();
        renderTimeline();
        makeThumbnails();
        if (!opts.silent) toast(`"${state.videoName}" 영상을 가져왔어요! 🎬`);
        saveProjectSoon();
        resolve();
      };
      const onErr = () => {
        els.video.removeEventListener('loadedmetadata', onMeta);
        els.video.removeEventListener('error', onErr);
        toast('이 영상은 열 수 없어요 😢 다른 영상을 가져와요');
        reject(new Error('video load error'));
      };
      els.video.addEventListener('loadedmetadata', onMeta);
      els.video.addEventListener('error', onErr);
    });
  }

  async function makeThumbnails() {
    if (!state.duration) return;
    const myUrl = state.videoUrl;
    const count = 14;
    const interval = Math.max(0.5, state.duration / count);
    state.thumbInterval = interval;
    const v = document.createElement('video');
    v.muted = true;
    v.preload = 'auto';
    v.src = myUrl;
    await new Promise((r) => { v.onloadeddata = r; v.onerror = r; });
    const w = 120;
    const h = Math.max(1, Math.round(w * (v.videoHeight || 9) / (v.videoWidth || 16)));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const c2d = canvas.getContext('2d');
    const thumbs = [];
    for (let t = 0; t < state.duration; t += interval) {
      if (state.videoUrl !== myUrl) return; // 다른 영상으로 바뀜
      await new Promise((r) => {
        v.onseeked = r;
        v.onerror = r;
        v.currentTime = Math.min(t + 0.05, state.duration);
      });
      try {
        c2d.drawImage(v, 0, 0, w, h);
        thumbs.push({ t, url: canvas.toDataURL('image/jpeg', 0.6) });
      } catch (e) { break; }
    }
    if (state.videoUrl !== myUrl) return;
    state.thumbs = thumbs;
    renderVideoLane();
  }

  function openVideoPicker() { els.fileInput.click(); }
  els.btnOpenVideo.addEventListener('click', openVideoPicker);
  els.btnOpenVideo2.addEventListener('click', openVideoPicker);
  els.fileInput.addEventListener('change', async () => {
    const file = els.fileInput.files[0];
    els.fileInput.value = '';
    if (!file) return;
    await handleNewVideoFile(file);
  });

  async function handleNewVideoFile(file) {
    if (!file.type.startsWith('video/') && !/\.(mp4|webm|mov|m4v|ogv)$/i.test(file.name)) {
      toast('영상 파일만 가져올 수 있어요 🎬');
      return;
    }
    if (state.duration && state.clips.length) {
      const ok = await ask('영상을 바꾸면 녹음한 소리는 그대로 남아요.\n영상을 바꿀까요?', '바꾸기', '그대로 두기');
      if (!ok) return;
    }
    ensureAudio();
    if (state.playing) pause();
    try { await loadVideo(file, file.name); } catch (e) { /* 토스트로 안내함 */ }
  }

  // 끌어다 놓기
  ['dragenter', 'dragover'].forEach((ev) => els.videoFrame.addEventListener(ev, (e) => {
    e.preventDefault();
    els.videoFrame.classList.add('dragover');
  }));
  ['dragleave', 'drop'].forEach((ev) => els.videoFrame.addEventListener(ev, (e) => {
    e.preventDefault();
    els.videoFrame.classList.remove('dragover');
  }));
  els.videoFrame.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) handleNewVideoFile(file);
  });

  /* ---------- 트랙 ---------- */
  function addTrack(data) {
    const n = state.tracks.length;
    const track = data || {
      id: uid(),
      name: `소리 ${n + 1}`,
      icon: TRACK_ICONS[n % TRACK_ICONS.length],
      color: TRACK_COLORS[n % TRACK_COLORS.length],
      muted: false,
    };
    state.tracks.push(track);
    state.selectedTrackId = track.id;
    if (ctx) trackGain(track);
    renderTracks();
    saveProjectSoon();
    return track;
  }

  async function deleteTrack(id) {
    const track = trackById(id);
    if (!track) return;
    const clipCount = state.clips.filter((c) => c.trackId === id).length;
    const msg = clipCount
      ? `"${track.name}" 트랙과 그 안의 소리 ${clipCount}개를 지울까요?`
      : `"${track.name}" 트랙을 지울까요?`;
    const ok = await ask(msg, '지우기', '그대로 두기');
    if (!ok) return;
    state.clips = state.clips.filter((c) => c.trackId !== id);
    state.tracks = state.tracks.filter((t) => t.id !== id);
    trackGains.delete(id);
    if (state.selectedTrackId === id) state.selectedTrackId = state.tracks[0] ? state.tracks[0].id : null;
    if (state.selectedClipId && !clipById(state.selectedClipId)) state.selectedClipId = null;
    if (state.playing) scheduleClips();
    renderTracks();
    saveProjectSoon();
  }

  function selectTrack(id) {
    state.selectedTrackId = id;
    renderTracks();
  }

  els.btnAddTrack.addEventListener('click', () => { addTrack(); toast('새 트랙을 만들었어요 ➕'); });
  els.btnAddTrack2.addEventListener('click', () => { addTrack(); toast('새 트랙을 만들었어요 ➕'); });

  /* ---------- 클립 ---------- */
  async function addClipFromBlob(blob, trackId, start, name) {
    let buffer;
    try {
      buffer = await blobToBuffer(blob);
    } catch (e) {
      console.error(e);
      toast('소리를 읽지 못했어요 😢 다시 녹음해 봐요');
      return null;
    }
    const clip = {
      id: uid(),
      trackId,
      start: Math.max(0, start),
      duration: buffer.duration,
      name,
      blob,
      buffer,
      peaks: computePeaks(buffer),
    };
    state.clips.push(clip);
    state.selectedClipId = clip.id;
    if (state.playing) scheduleClips();
    renderTracks();
    saveProjectSoon();
    return clip;
  }

  async function deleteSelectedClip() {
    const clip = clipById(state.selectedClipId);
    if (!clip) return;
    const ok = await ask(`"${clip.name}" 소리를 지울까요?`, '지우기', '그대로 두기');
    if (!ok) return;
    state.clips = state.clips.filter((c) => c.id !== clip.id);
    state.selectedClipId = null;
    if (state.playing) scheduleClips();
    renderTracks();
    saveProjectSoon();
    toast('소리를 지웠어요 🗑');
  }

  function selectClip(id) {
    state.selectedClipId = id;
    const clip = clipById(id);
    if (clip) state.selectedTrackId = clip.trackId;
    renderTracks();
  }

  els.btnDelClip.addEventListener('click', deleteSelectedClip);
  els.btnDelTrack.addEventListener('click', () => { if (state.selectedTrackId) deleteTrack(state.selectedTrackId); });

  /* ---------- 트랙 그림 고르기 ---------- */
  function openIconPicker(track) {
    els.iconGrid.innerHTML = '';
    for (const icon of ICON_CHOICES) {
      const b = document.createElement('button');
      b.className = 'icon-choice' + (icon === track.icon ? ' current' : '');
      b.textContent = icon;
      b.addEventListener('click', () => {
        track.icon = icon;
        els.iconModal.hidden = true;
        renderTracks();
        saveProjectSoon();
      });
      els.iconGrid.appendChild(b);
    }
    els.iconModal.hidden = false;
  }
  els.iconCancel.addEventListener('click', () => { els.iconModal.hidden = true; });

  /* ---------- 접속 QR ---------- */
  function qrTargetUrl() {
    const base = els.qrUrl.value.trim();
    const padlet = els.qrPadlet.value.trim();
    if (!base) return '';
    if (!padlet) return base;
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}padlet=${encodeURIComponent(padlet)}`;
  }
  function renderQr() {
    const url = qrTargetUrl();
    els.qrCode.innerHTML = '';
    if (!url || typeof qrcode !== 'function') return;
    try {
      const qr = qrcode(0, 'M');
      qr.addData(url);
      qr.make();
      els.qrCode.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
    } catch (e) {
      els.qrCode.textContent = '주소가 너무 길어요';
    }
  }
  els.btnQr.addEventListener('click', () => {
    if (!els.qrUrl.value) els.qrUrl.value = location.href.split('#')[0].split('?')[0];
    if (!els.qrPadlet.value) els.qrPadlet.value = padletUrl();
    renderQr();
    els.qrModal.hidden = false;
  });
  els.qrUrl.addEventListener('input', renderQr);
  els.qrPadlet.addEventListener('input', () => { lsSet(LS_PADLET, els.qrPadlet.value.trim()); renderQr(); });
  els.qrClose.addEventListener('click', () => { els.qrModal.hidden = true; });

  /* ---------- 타임라인 그리기 ---------- */
  function contentSeconds() {
    let m = state.duration || 10;
    for (const c of state.clips) m = Math.max(m, c.start + c.duration);
    return m + 3;
  }

  function laneWidth() { return Math.ceil(contentSeconds() * state.pps); }

  function fitZoom() {
    if (!state.duration) return;
    const avail = els.tlScroll.clientWidth - HEAD_W - 60;
    state.pps = clamp(avail / state.duration, 12, 300);
  }

  function renderTimeline() {
    renderRuler();
    renderVideoLane();
    renderTracks();
    updatePlayhead();
  }

  function renderRuler() {
    const w = laneWidth();
    els.ruler.style.width = `${w}px`;
    els.ruler.innerHTML = '';
    const steps = [1, 2, 5, 10, 15, 30, 60];
    let step = steps.find((s) => s * state.pps >= 56) || 60;
    const total = contentSeconds();
    for (let t = 0; t <= total; t += step) {
      const tick = document.createElement('div');
      tick.className = 'tick';
      tick.style.left = `${t * state.pps}px`;
      tick.textContent = fmt(t);
      els.ruler.appendChild(tick);
    }
    document.querySelectorAll('.lane').forEach((l) => {
      l.style.width = `${w}px`;
      l.style.backgroundSize = `${step * state.pps}px 100%`;
    });
  }

  function renderVideoLane() {
    const lane = els.videoLane;
    lane.style.width = `${laneWidth()}px`;
    lane.innerHTML = '';
    if (!state.duration) {
      const label = document.createElement('div');
      label.className = 'video-label';
      label.textContent = '영상을 가져오면 여기에 보여요';
      lane.appendChild(label);
      return;
    }
    if (state.thumbs.length) {
      for (const th of state.thumbs) {
        const img = document.createElement('img');
        img.className = 'thumb';
        img.src = th.url;
        img.draggable = false;
        img.style.left = `${th.t * state.pps}px`;
        img.style.width = `${Math.max(1, state.thumbInterval * state.pps)}px`;
        lane.appendChild(img);
      }
    }
    const bar = document.createElement('div');
    bar.className = 'video-label';
    bar.textContent = `🎬 ${state.videoName}`;
    lane.appendChild(bar);
    const endMark = document.createElement('div');
    endMark.style.cssText = `position:absolute;top:0;bottom:0;left:${state.duration * state.pps}px;right:0;background:repeating-linear-gradient(45deg,#2a3040,#2a3040 8px,#1f2430 8px,#1f2430 16px);`;
    lane.appendChild(endMark);
  }

  function renderTracks() {
    const w = laneWidth();
    els.tracks.innerHTML = '';
    document.querySelectorAll('.lane').forEach((l) => { l.style.width = `${w}px`; });

    for (const track of state.tracks) {
      const row = document.createElement('div');
      row.className = 'row track-row';
      row.dataset.trackId = track.id;

      // 머리 부분
      const head = document.createElement('div');
      head.className = 'track-head' + (track.id === state.selectedTrackId ? ' selected' : '');
      head.style.borderLeft = `8px solid ${track.color}`;

      const iconBtn = document.createElement('button');
      iconBtn.className = 'icon-btn';
      iconBtn.textContent = track.icon;
      iconBtn.title = '그림 바꾸기';
      iconBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.selectedTrackId = track.id;
        openIconPicker(track);
      });

      const nameInput = document.createElement('input');
      nameInput.className = 'track-name';
      nameInput.value = track.name;
      nameInput.maxLength = 12;
      nameInput.title = '이름 바꾸기';
      nameInput.addEventListener('change', () => {
        track.name = nameInput.value.trim() || track.name;
        nameInput.value = track.name;
        updateRecordTarget();
        saveProjectSoon();
      });
      nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') nameInput.blur(); });

      const btns = document.createElement('div');
      btns.className = 'track-btns';
      const muteBtn = document.createElement('button');
      muteBtn.className = 'mini-btn';
      muteBtn.textContent = track.muted ? '🔇' : '🔊';
      muteBtn.title = track.muted ? '소리 켜기' : '소리 끄기';
      muteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        track.muted = !track.muted;
        if (ctx) trackGain(track);
        renderTracks();
        saveProjectSoon();
      });
      btns.append(muteBtn);

      head.append(iconBtn, nameInput, btns);
      head.addEventListener('click', () => selectTrack(track.id));

      // 레인
      const lane = document.createElement('div');
      lane.className = 'lane track-lane';
      lane.style.width = `${w}px`;
      lane.style.opacity = track.muted ? '0.45' : '1';
      lane.addEventListener('click', (e) => {
        if (e.target !== lane) return;
        state.selectedTrackId = track.id;
        state.selectedClipId = null;
        seek((e.clientX - lane.getBoundingClientRect().left) / state.pps);
        renderTracks();
      });

      for (const clip of state.clips.filter((c) => c.trackId === track.id)) {
        lane.appendChild(makeClipEl(clip, track));
      }

      row.append(head, lane);
      els.tracks.appendChild(row);
    }

    // 파형 그리기 (DOM에 붙은 뒤에 크기를 알 수 있음)
    els.tracks.querySelectorAll('.clip').forEach((el) => drawWave(el, clipById(el.dataset.clipId)));

    els.btnDelClip.disabled = !state.selectedClipId;
    els.btnDelTrack.disabled = !selectedTrack();
    updateRecordTarget();
    renderRuler();
  }

  function updateRecordTarget() {
    const t = selectedTrack();
    els.recordTarget.textContent = t ? `${t.icon} ${t.name}` : '트랙을 골라요';
  }

  function makeClipEl(clip, track) {
    const el = document.createElement('div');
    el.className = 'clip' + (clip.id === state.selectedClipId ? ' selected' : '');
    el.dataset.clipId = clip.id;
    el.style.left = `${clip.start * state.pps}px`;
    el.style.width = `${Math.max(8, clip.duration * state.pps)}px`;
    el.style.background = track.color;
    const canvas = document.createElement('canvas');
    const label = document.createElement('span');
    label.className = 'clip-label';
    label.textContent = `${track.icon} ${clip.name}`;
    el.append(canvas, label);
    attachClipDrag(el, clip);
    return el;
  }

  function drawWave(el, clip) {
    if (!clip || !clip.peaks) return;
    const canvas = el.querySelector('canvas');
    const w = Math.max(1, el.clientWidth);
    const h = Math.max(1, el.clientHeight);
    canvas.width = w; canvas.height = h;
    const c = canvas.getContext('2d');
    c.clearRect(0, 0, w, h);
    c.fillStyle = 'rgba(0,0,0,0.35)';
    const n = clip.peaks.length;
    const mid = h / 2;
    for (let x = 0; x < w; x += 2) {
      const p = clip.peaks[Math.floor((x / w) * n)] || 0;
      const bh = Math.max(2, p * (h - 24));
      c.fillRect(x, mid - bh / 2 + 6, 1.5, bh);
    }
  }

  /* ---------- 클립 끌어서 옮기기 ---------- */
  function attachClipDrag(el, clip) {
    let startX = 0, origStart = 0, dragging = false, hoverRow = null;
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      e.stopPropagation();
      startX = e.clientX;
      origStart = clip.start;
      dragging = false;
      el.setPointerCapture(e.pointerId);
      if (state.selectedClipId !== clip.id) selectClip(clip.id);
    });
    el.addEventListener('pointermove', (e) => {
      if (!el.hasPointerCapture(e.pointerId)) return;
      const dx = e.clientX - startX;
      if (!dragging && Math.abs(dx) < 4) return;
      dragging = true;
      el.classList.add('dragging');
      clip.start = Math.max(0, origStart + dx / state.pps);
      el.style.left = `${clip.start * state.pps}px`;
      // 다른 트랙 위에 있는지 확인
      const row = document.elementsFromPoint(e.clientX, e.clientY).find((n) => n.classList && n.classList.contains('track-row'));
      if (hoverRow && hoverRow !== row) hoverRow.classList.remove('drop-target');
      hoverRow = row && row.dataset.trackId !== clip.trackId ? row : null;
      if (hoverRow) hoverRow.classList.add('drop-target');
    });
    const finish = (e) => {
      if (!el.hasPointerCapture(e.pointerId)) return;
      el.releasePointerCapture(e.pointerId);
      el.classList.remove('dragging');
      if (hoverRow) {
        hoverRow.classList.remove('drop-target');
        clip.trackId = hoverRow.dataset.trackId;
        state.selectedTrackId = clip.trackId;
        hoverRow = null;
      }
      if (dragging) {
        clip.start = Math.round(clip.start * 100) / 100;
        if (state.playing) scheduleClips();
        renderTracks();
        saveProjectSoon();
      }
    };
    el.addEventListener('pointerup', finish);
    el.addEventListener('pointercancel', finish);
  }

  // 눈금자 / 영상 레인 클릭 → 이동
  for (const lane of [els.ruler, els.videoLane]) {
    lane.addEventListener('click', (e) => {
      seek((e.clientX - lane.getBoundingClientRect().left) / state.pps);
    });
  }

  els.btnZoomIn.addEventListener('click', () => { state.pps = clamp(state.pps * 1.4, 12, 400); renderTimeline(); });
  els.btnZoomOut.addEventListener('click', () => { state.pps = clamp(state.pps / 1.4, 12, 400); renderTimeline(); });

  /* ---------- 녹음 ---------- */
  let mediaRecorder = null;
  let micStream = null;
  let recChunks = [];
  let recStartTime = 0;
  let recTrackId = null;
  let armed = false;      // 카운트다운 중
  let cancelArm = false;
  let analyser = null;
  let meterRaf = 0;
  let recCounter = 0;

  function setRecordUI(mode) {
    els.btnRecord.classList.toggle('armed', mode === 'armed');
    els.btnRecord.classList.toggle('recording', mode === 'recording');
    els.recordLabel.textContent = mode === 'recording' ? '멈춤' : (mode === 'armed' ? '준비…' : '녹음');
    els.recBadge.hidden = mode !== 'recording';
    if (mode === 'idle') els.recordStatus.textContent = '버튼을 누르면 3초 뒤에 녹음이 시작돼요';
    if (mode === 'armed') els.recordStatus.textContent = '준비! 곧 녹음이 시작돼요 🙌';
    if (mode === 'recording') els.recordStatus.textContent = '녹음 중! 영상을 보면서 소리를 내요. 끝나면 멈춤 버튼을 눌러요';
  }

  function startMeter() {
    if (!analyser) return;
    const data = new Uint8Array(analyser.fftSize);
    const loop = () => {
      analyser.getByteTimeDomainData(data);
      let max = 0;
      for (let i = 0; i < data.length; i++) {
        const v = Math.abs(data[i] - 128) / 128;
        if (v > max) max = v;
      }
      els.meterFill.style.width = `${Math.min(100, max * 140)}%`;
      meterRaf = requestAnimationFrame(loop);
    };
    loop();
  }

  function stopMeter() {
    cancelAnimationFrame(meterRaf);
    els.meterFill.style.width = '0%';
  }

  async function toggleRecord() {
    if (state.exporting) return;
    if (state.recording) { stopRecording(); return; }
    if (armed) { cancelArm = true; return; }
    if (!state.duration) { toast('먼저 영상을 가져와요! 🎬'); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
      toast('이 브라우저에서는 녹음을 할 수 없어요 😢');
      return;
    }
    ensureAudio();
    if (state.playing) pause();

    let track = selectedTrack();
    if (!track) track = addTrack();
    recTrackId = track.id;

    // 마이크 켜기
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true },
      });
    } catch (e) {
      console.warn(e);
      toast('마이크를 쓸 수 있게 허락해 주세요 🎤');
      return;
    }
    const micSrc = ctx.createMediaStreamSource(micStream);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    micSrc.connect(analyser);
    startMeter();

    // 카운트다운
    armed = true;
    cancelArm = false;
    setRecordUI('armed');
    els.countdown.hidden = false;
    for (const n of [3, 2, 1]) {
      els.countdown.textContent = String(n);
      await wait(1000);
      if (cancelArm) break;
    }
    els.countdown.hidden = true;
    armed = false;
    if (cancelArm) {
      releaseMic();
      setRecordUI('idle');
      toast('녹음을 취소했어요');
      return;
    }

    // 영상 끝이면 처음부터
    if (els.video.ended || els.video.currentTime >= state.duration - 0.05) els.video.currentTime = 0;
    recStartTime = els.video.currentTime;

    recChunks = [];
    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
      .find((m) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m));
    mediaRecorder = new MediaRecorder(micStream, mime ? { mimeType: mime } : undefined);
    mediaRecorder.ondataavailable = (e) => { if (e.data && e.data.size) recChunks.push(e.data); };
    mediaRecorder.onstop = onRecordingStopped;

    // 녹음 중에는 스피커 소리를 꺼서 마이크에 섞이지 않게 함
    master.gain.value = 0;
    els.video.muted = true;

    state.recording = true;
    setRecordUI('recording');
    keepAwake();
    mediaRecorder.start(250);
    els.video.play().catch((e) => console.warn(e));
  }

  function stopRecording() {
    if (!state.recording) return;
    state.recording = false;
    els.video.pause();
    try { mediaRecorder.stop(); } catch (e) { /* 이미 멈춤 */ }
    master.gain.value = 1;
    els.video.muted = !els.chkOriginal.checked;
    setRecordUI('idle');
  }

  function releaseMic() {
    stopMeter();
    if (micStream) micStream.getTracks().forEach((t) => t.stop());
    micStream = null;
    analyser = null;
  }

  async function onRecordingStopped() {
    releaseMic();
    const blob = new Blob(recChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
    recChunks = [];
    if (blob.size < 100) { toast('녹음된 소리가 없어요 😢'); return; }
    const track = trackById(recTrackId) || addTrack();
    recCounter += 1;
    const name = `녹음 ${state.clips.length + 1}`;
    const clip = await addClipFromBlob(blob, track.id, recStartTime, name);
    if (clip) {
      toast('녹음 완료! ▶ 눌러서 들어 봐요 🎉');
      seek(recStartTime);
    }
  }

  els.btnRecord.addEventListener('click', toggleRecord);

  /* ---------- 작품 만들기 (영상 + 소리 → 하나의 영상 blob) ---------- */
  /**
   * 영상과 모든 트랙을 실시간으로 합쳐 blob으로 만든다.
   * @param {{onProgress?: (p:number)=>void, cancelButton?: HTMLElement}} opts
   * @returns {Promise<{blob: Blob, ext: string, thumbBlob: Blob|null, cancelled: boolean}>}
   */
  async function renderProject(opts = {}) {
    ensureAudio();
    pause();
    state.exporting = true;
    let cancelled = false;

    // 처음으로 이동
    await new Promise((r) => {
      const done = () => { els.video.removeEventListener('seeked', done); r(); };
      els.video.addEventListener('seeked', done);
      els.video.currentTime = 0;
      setTimeout(r, 1500);
    });

    const vw = els.video.videoWidth || 640;
    const vh = els.video.videoHeight || 360;
    const scale = Math.min(1, 1280 / vw);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(vw * scale);
    canvas.height = Math.round(vh * scale);
    const c2d = canvas.getContext('2d');

    const vStream = canvas.captureStream(30);
    const dest = ctx.createMediaStreamDestination();
    master.connect(dest);
    const stream = new MediaStream([...vStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);

    const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
      .find((m) => MediaRecorder.isTypeSupported(m));
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 4_000_000 } : undefined);
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const stopped = new Promise((r) => { rec.onstop = r; });

    let thumbBlob = null;
    let thumbPending = false;
    let raf = 0;
    const draw = () => {
      c2d.drawImage(els.video, 0, 0, canvas.width, canvas.height);
      if (!thumbBlob && !thumbPending && els.video.currentTime > 0.4) {
        thumbPending = true;
        const tc = document.createElement('canvas');
        tc.width = 320; tc.height = Math.round(320 * canvas.height / canvas.width);
        tc.getContext('2d').drawImage(canvas, 0, 0, tc.width, tc.height);
        tc.toBlob((b) => { thumbBlob = b; }, 'image/jpeg', 0.7);
      }
      if (opts.onProgress) opts.onProgress(els.video.currentTime / state.duration);
      raf = requestAnimationFrame(draw);
    };

    await new Promise((resolve) => {
      const onEnd = () => { cleanup(); resolve(); };
      const onCancel = () => { cancelled = true; els.video.pause(); cleanup(); resolve(); };
      const cleanup = () => {
        els.video.removeEventListener('ended', onEnd);
        if (opts.cancelButton) opts.cancelButton.removeEventListener('click', onCancel);
      };
      els.video.addEventListener('ended', onEnd);
      if (opts.cancelButton) opts.cancelButton.addEventListener('click', onCancel);
      rec.start(500);
      draw();
      els.video.play().catch((e) => { console.warn(e); onCancel(); });
    });

    cancelAnimationFrame(raf);
    try { rec.stop(); } catch (e) { /* 이미 멈춤 */ }
    await stopped;
    try { master.disconnect(dest); } catch (e) { /* 무시 */ }
    state.exporting = false;

    const blob = new Blob(chunks, { type: rec.mimeType || 'video/webm' });
    const ext = (rec.mimeType || '').includes('mp4') ? 'mp4' : 'webm';
    return { blob, ext, thumbBlob, cancelled };
  }

  function canRender() {
    if (!state.duration) { toast('먼저 영상을 가져와요! 🎬'); return false; }
    if (state.recording || state.exporting) return false;
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
      toast('이 브라우저에서는 작품을 만들 수 없어요 😢');
      return false;
    }
    return true;
  }

  /* ---------- 내 기기에 저장 ---------- */
  async function exportProject() {
    if (!canRender()) return;
    els.exportProgress.style.width = '0%';
    els.exportOverlay.hidden = false;
    const result = await renderProject({
      onProgress: (p) => { els.exportProgress.style.width = `${p * 100}%`; },
      cancelButton: els.exportCancel,
    });
    els.exportOverlay.hidden = true;
    if (result.cancelled) { toast('저장을 그만뒀어요'); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(result.blob);
    a.download = `폴리아티스트_작품.${result.ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    toast('작품을 저장했어요! 🎉', 3000);
  }

  els.btnExport.addEventListener('click', exportProject);

  /* ---------- 패들렛 주소 ---------- */
  const LS_PADLET = 'foley.padletUrl';
  const lsGet = (k) => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* 무시 */ } };

  function padletUrl() {
    const u = lsGet(LS_PADLET);
    return /^https:\/\//i.test(u) ? u : '';
  }

  // 주소에 ?padlet=... 이 있으면 저장 (선생님 QR로 들어온 경우)
  try {
    const qp = new URLSearchParams(location.search).get('padlet');
    if (qp && /^https:\/\//i.test(qp)) lsSet(LS_PADLET, qp);
  } catch (e) { /* 무시 */ }

  /* ---------- 패들렛에 올리기 ---------- */
  let lastFile = null;

  function downloadFile(file) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  }

  async function sendToPadlet() {
    if (!canRender()) return;

    els.sendText.textContent = '🎬 작품을 만드는 중이에요… 영상이 끝날 때까지 기다려요';
    els.sendProgress.style.width = '0%';
    els.sendOverlay.hidden = false;
    const result = await renderProject({
      onProgress: (p) => { els.sendProgress.style.width = `${p * 100}%`; },
      cancelButton: els.sendCancel,
    });
    els.sendOverlay.hidden = true;
    if (result.cancelled) { toast('그만뒀어요'); return; }

    const fileName = `폴리아티스트_작품.${result.ext}`;
    lastFile = new File([result.blob], fileName, { type: result.blob.type || 'video/webm' });

    // 공유 시트(패들렛 앱 등)를 쓸 수 있는지
    let canShare = false;
    try { canShare = !!(navigator.canShare && navigator.canShare({ files: [lastFile] })); } catch (e) { canShare = false; }

    // 공유 시트가 없으면 파일을 먼저 기기에 저장해 둔다
    if (!canShare) downloadFile(lastFile);

    const url = padletUrl();
    els.padletShare.hidden = !canShare;
    els.padletOpen.hidden = !url;
    if (url) els.padletOpen.href = url;
    els.padletNolink.hidden = !!url;
    els.padletModal.hidden = false;
  }

  els.padletShare.addEventListener('click', async () => {
    if (!lastFile) return;
    try {
      await navigator.share({ files: [lastFile], title: lastFile.name });
      toast('보냈어요! 🎉');
    } catch (e) {
      if (e && e.name !== 'AbortError') { downloadFile(lastFile); toast('공유가 안 돼서 파일로 저장했어요 💾'); }
    }
  });
  els.padletSave.addEventListener('click', () => { if (lastFile) { downloadFile(lastFile); toast('파일을 저장했어요 💾'); } });
  els.padletClose.addEventListener('click', () => { els.padletModal.hidden = true; });
  els.btnSend.addEventListener('click', sendToPadlet);

  /* ---------- 자동 저장 (IndexedDB) ---------- */
  const DB_NAME = 'foley-artist';
  const STORE = 'project';

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function dbPut(key, value) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }
  async function dbGet(key) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function dbDel(key) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  let saveTimer = null;
  function saveProjectSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveProject, 800);
  }

  async function saveProject() {
    if (!window.indexedDB) return;
    try {
      await dbPut('current', {
        savedAt: Date.now(),
        videoBlob: state.videoBlob,
        videoName: state.videoName,
        originalOn: els.chkOriginal.checked,
        tracks: state.tracks.map((t) => ({ ...t })),
        clips: state.clips.map((c) => ({
          id: c.id, trackId: c.trackId, start: c.start, duration: c.duration, name: c.name, blob: c.blob,
        })),
      });
    } catch (e) {
      console.warn('자동 저장 실패', e);
    }
  }

  async function restoreProject() {
    if (!window.indexedDB) return false;
    let data;
    try { data = await dbGet('current'); } catch (e) { return false; }
    if (!data || (!data.videoBlob && !data.clips.length)) return false;
    const ok = await ask('지난번에 하던 작품이 있어요.\n이어서 할까요?', '이어서 하기', '새로 시작');
    if (!ok) { await dbDel('current'); return false; }
    ensureAudio();
    state.tracks = data.tracks || [];
    state.selectedTrackId = state.tracks[0] ? state.tracks[0].id : null;
    els.chkOriginal.checked = data.originalOn !== false;
    els.video.muted = !els.chkOriginal.checked;
    for (const t of state.tracks) trackGain(t);
    if (data.videoBlob) {
      try { await loadVideo(data.videoBlob, data.videoName, { keepTracks: true, silent: true }); } catch (e) { /* 안내됨 */ }
    }
    for (const c of data.clips || []) {
      try {
        const buffer = await blobToBuffer(c.blob);
        state.clips.push({ ...c, buffer, peaks: computePeaks(buffer) });
      } catch (e) { console.warn('소리 복원 실패', e); }
    }
    renderTimeline();
    toast('지난번 작품을 다시 불러왔어요 📂');
    return true;
  }

  async function newProject() {
    const ok = await ask('지금까지 만든 것을 모두 지우고 새로 시작할까요?', '새로 시작', '그대로 두기');
    if (!ok) return;
    if (state.recording) stopRecording();
    pause();
    stopClips();
    if (state.videoUrl) URL.revokeObjectURL(state.videoUrl);
    els.video.removeAttribute('src');
    els.video.load();
    Object.assign(state, {
      videoBlob: null, videoName: '', videoUrl: '', duration: 0,
      tracks: [], clips: [], selectedTrackId: null, selectedClipId: null, thumbs: [], pps: 60,
    });
    trackGains.clear();
    els.videoEmpty.hidden = false;
    els.timeDisplay.textContent = '0:00 / 0:00';
    renderTimeline();
    try { await dbDel('current'); } catch (e) { /* 무시 */ }
    toast('새로 시작해요! 🧹');
  }

  els.btnNew.addEventListener('click', newProject);

  /* ---------- 키보드 ---------- */
  document.addEventListener('keydown', (e) => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;
    if (!els.modal.hidden || !els.exportOverlay.hidden || !els.iconModal.hidden || !els.qrModal.hidden
      || !els.padletModal.hidden || !els.sendOverlay.hidden) return;
    if (e.code === 'Space') {
      e.preventDefault();
      if (state.recording) stopRecording();
      else state.playing ? pause() : play();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (state.selectedClipId) { e.preventDefault(); deleteSelectedClip(); }
    } else if (e.key === 'Home') {
      seek(0);
    } else if (e.key === 'ArrowLeft') {
      seek(els.video.currentTime - (e.shiftKey ? 1 : 0.1));
    } else if (e.key === 'ArrowRight') {
      seek(els.video.currentTime + (e.shiftKey ? 1 : 0.1));
    }
  });

  // 첫 클릭 때 오디오 엔진 깨우기 (브라우저 자동재생 정책)
  document.addEventListener('pointerdown', () => { if (ctx) ensureAudio(); }, { capture: true });

  window.addEventListener('resize', () => renderTimeline());

  /* ---------- 태블릿: 뒤로 가기·새로고침으로 작업이 날아가지 않게 ---------- */
  function armBackTrap() {
    try { history.pushState({ foley: true }, '', location.href); } catch (e) { /* 무시 */ }
  }
  armBackTrap();
  armBackTrap();
  window.addEventListener('popstate', () => {
    armBackTrap();
    if (!els.iconModal.hidden || !els.qrModal.hidden) {
      els.iconModal.hidden = true; els.qrModal.hidden = true;
      return;
    }
    toast('뒤로 가기 대신 화면의 버튼을 써요 😊 작업은 자동으로 저장돼요');
  });
  window.addEventListener('beforeunload', (e) => {
    if (state.duration || state.clips.length) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
  // 길게 눌렀을 때 브라우저 메뉴가 뜨지 않게
  document.addEventListener('contextmenu', (e) => {
    if (e.target.closest('input')) return;
    e.preventDefault();
  });

  /* ---------- 시작 ---------- */
  renderTimeline();
  restoreProject();
})();
