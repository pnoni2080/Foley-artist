/* ============================================================
   FoleyCloud — Firebase 연결 (학생 작품 보내기 / 교사 발표 화면)

   Firestore
     classes/{code}             { code, ownerUid, ownerName, createdAt }
     classes/{code}/works/{id}  { name, duration, size, videoPath, videoUrl,
                                  thumbPath, thumbUrl, contentType, uid, createdAt }
   Storage
     works/{code}/{id}.webm|mp4, works/{code}/{id}.jpg
   ============================================================ */
(() => {
  'use strict';

  const config = window.FOLEY_FIREBASE_CONFIG;
  const hasSdk = typeof firebase !== 'undefined' && firebase.initializeApp;
  const available = !!(config && hasSdk);

  let app = null;
  let auth = null;
  let db = null;
  let storage = null;

  function init() {
    if (!available || app) return available;
    app = firebase.initializeApp(config);
    auth = firebase.auth();
    db = firebase.firestore();
    storage = firebase.storage();
    if (window.FOLEY_USE_EMULATOR) {
      auth.useEmulator('http://127.0.0.1:9099', { disableWarnings: true });
      db.useEmulator('127.0.0.1', 8080);
      storage.useEmulator('127.0.0.1', 9199);
    }
    try { auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL); } catch (e) { /* 무시 */ }
    return true;
  }

  const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 헷갈리는 글자(0 O 1 I L) 제외
  function randomCode(len = 4) {
    let s = '';
    for (let i = 0; i < len; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    return s;
  }
  function normalizeCode(code) {
    return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  }

  /* ---------- 로그인 ---------- */
  function currentUser() { return auth ? auth.currentUser : null; }

  function onAuth(cb) {
    if (!init()) { cb(null); return () => {}; }
    return auth.onAuthStateChanged(cb);
  }

  async function signInAnon() {
    init();
    if (auth.currentUser) return auth.currentUser;
    const cred = await auth.signInAnonymously();
    return cred.user;
  }

  async function signInGoogle() {
    init();
    const provider = new firebase.auth.GoogleAuthProvider();
    const cred = await auth.signInWithPopup(provider);
    return cred.user;
  }

  function isTeacher(user) {
    return !!(user && !user.isAnonymous);
  }

  async function signOut() { if (auth) await auth.signOut(); }

  /* ---------- 교실 ---------- */
  function classRef(code) { return db.collection('classes').doc(normalizeCode(code)); }

  async function getClass(code) {
    init();
    const c = normalizeCode(code);
    if (!c) return null;
    const snap = await classRef(c).get();
    return snap.exists ? snap.data() : null;
  }

  async function createClass(user, title) {
    init();
    for (let tries = 0; tries < 8; tries++) {
      const code = randomCode();
      const ref = classRef(code);
      const snap = await ref.get();
      if (snap.exists) continue;
      const data = {
        code,
        ownerUid: user.uid,
        ownerName: user.displayName || user.email || '',
        title: title || '',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      };
      await ref.set(data);
      return { ...data, createdAt: new Date() };
    }
    throw new Error('교실 코드를 만들지 못했어요. 다시 시도해 주세요.');
  }

  async function myClasses(user) {
    init();
    const snap = await db.collection('classes').where('ownerUid', '==', user.uid).get();
    const list = snap.docs.map((d) => d.data());
    list.sort((a, b) => tsMs(b.createdAt) - tsMs(a.createdAt));
    return list;
  }

  async function deleteClass(code) {
    init();
    await deleteAllWorks(code);
    await classRef(code).delete();
  }

  /* ---------- 작품 ---------- */
  function tsMs(ts) {
    if (!ts) return 0;
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (ts instanceof Date) return ts.getTime();
    return Number(ts) || 0;
  }

  function worksRef(code) { return classRef(code).collection('works'); }

  function listenWorks(code, cb, onError) {
    init();
    return worksRef(code).onSnapshot((snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => tsMs(b.createdAt) - tsMs(a.createdAt));
      cb(list);
    }, (err) => { if (onError) onError(err); });
  }

  /**
   * 작품 올리기
   * @param {{code, name, videoBlob, thumbBlob, duration, onProgress}} opts
   */
  async function uploadWork(opts) {
    init();
    const user = await signInAnon();
    const code = normalizeCode(opts.code);
    const cls = await getClass(code);
    if (!cls) throw new Error('NO_CLASS');

    const docRef = worksRef(code).doc();
    const ext = (opts.videoBlob.type || '').includes('mp4') ? 'mp4' : 'webm';
    const videoPath = `works/${code}/${docRef.id}.${ext}`;
    const thumbPath = `works/${code}/${docRef.id}.jpg`;

    const videoTask = storage.ref(videoPath).put(opts.videoBlob, {
      contentType: opts.videoBlob.type || 'video/webm',
      customMetadata: { name: opts.name, code },
    });
    await new Promise((resolve, reject) => {
      videoTask.on('state_changed', (s) => {
        if (opts.onProgress) opts.onProgress(s.bytesTransferred / Math.max(1, s.totalBytes));
      }, reject, resolve);
    });
    const videoUrl = await videoTask.snapshot.ref.getDownloadURL();

    let thumbUrl = '';
    if (opts.thumbBlob) {
      try {
        const t = await storage.ref(thumbPath).put(opts.thumbBlob, { contentType: 'image/jpeg' });
        thumbUrl = await t.ref.getDownloadURL();
      } catch (e) { /* 썸네일은 없어도 됨 */ }
    }

    const data = {
      name: String(opts.name || '').slice(0, 20),
      duration: Number(opts.duration) || 0,
      size: opts.videoBlob.size,
      contentType: opts.videoBlob.type || 'video/webm',
      videoPath, videoUrl, thumbPath, thumbUrl,
      uid: user.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    await docRef.set(data);
    return { id: docRef.id, ...data };
  }

  async function deleteWork(code, work) {
    init();
    await worksRef(code).doc(work.id).delete();
    for (const p of [work.videoPath, work.thumbPath]) {
      if (!p) continue;
      try { await storage.ref(p).delete(); } catch (e) { /* 이미 없음 */ }
    }
  }

  async function deleteAllWorks(code) {
    init();
    const snap = await worksRef(code).get();
    for (const d of snap.docs) {
      await deleteWork(code, { id: d.id, ...d.data() });
    }
  }

  window.FoleyCloud = {
    available, init, normalizeCode,
    onAuth, currentUser, signInAnon, signInGoogle, signOut, isTeacher,
    getClass, createClass, myClasses, deleteClass,
    listenWorks, uploadWork, deleteWork, deleteAllWorks, tsMs,
  };
})();
