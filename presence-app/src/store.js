/* ============================================================
   Green Room — storage
   Saved to the artifact's private database when available (owner-only
   rules), mirrored in this browser for fast start, with device-only
   fallback when the database isn't reachable.
   ============================================================ */
const Store = (() => {
  const LS_KEY = 'greenroom.v1';
  const COLS = ['sessions', 'logs', 'preps', 'reviews'];
  const LIMIT = { sessions: 600, logs: 300, preps: 100, reviews: 60 };
  const st = { mode: 'local', status: 'starting', note: '', profile: null, sessions: [], logs: [], preps: [], reviews: [] };
  const subs = new Set();
  let db = null;
  let cloudSeen = { profile: false };
  const emit = (what) => subs.forEach((f) => { try { f(what); } catch (e) { console.error(e); } });

  function defaultProfile() {
    return {
      name: '', role: '', audiences: '', goal: '',
      plan: null, // personal plan (baselines, targets, strengths, tendencies); falls back to C.DEFAULT_PLAN
      objective: 'A', nextAdjustment: '',
      ratings: {}, onboarded: false, lessonsRead: [],
      game: { seenBadges: null, level: null, stage: null },
      settings: { paceLo: 130, paceHi: 160, autoCoach: true, voice: true, thinkTime: 10, customFillers: [], weeklyGoalMin: 60, sound: true },
      createdAt: Date.now(),
    };
  }
  function mergeProfile(p) {
    const d = defaultProfile();
    const out = Object.assign({}, d, p || {});
    out.settings = Object.assign({}, d.settings, (p && p.settings) || {});
    out.game = Object.assign({}, d.game, (p && p.game) || {});
    if (!/^[A-E]$/.test(out.objective || '')) out.objective = 'A';
    if (!Array.isArray(out.lessonsRead)) out.lessonsRead = [];
    if (!out.ratings || typeof out.ratings !== 'object') out.ratings = {};
    return out;
  }

  function loadLocal() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.profile) st.profile = mergeProfile(d.profile);
      for (const c of COLS) if (Array.isArray(d[c])) st[c] = d[c];
    } catch (e) { /* storage blocked or corrupt: start clean */ }
  }
  let saveTimer = null;
  function saveLocal() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify({
          profile: st.profile,
          sessions: st.sessions.slice(0, 300), logs: st.logs.slice(0, 200), preps: st.preps.slice(0, 60), reviews: st.reviews.slice(0, 30),
        }));
      } catch (e) {
        try { // quota: keep the newest items only
          localStorage.setItem(LS_KEY, JSON.stringify({ profile: st.profile, sessions: st.sessions.slice(0, 80), logs: st.logs.slice(0, 60), preps: st.preps.slice(0, 20), reviews: st.reviews.slice(0, 10) }));
        } catch (e2) { /* give up quietly */ }
      }
    }, 250);
  }

  const clean = (o) => JSON.parse(JSON.stringify(o, (k, v) => (k === '_local' ? undefined : v)));
  const body = (item) => { const b = clean(item); delete b.id; delete b._local; return b; };
  const newId = () => Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  const sortDesc = (arr) => arr.sort((a, b) => (b.ts || 0) - (a.ts || 0));

  // One write at a time per document; later writes to the same doc coalesce.
  const queues = new Map();
  function enqueue(path, fn) {
    const q = queues.get(path) || { running: false, next: null };
    queues.set(path, q);
    q.next = fn;
    if (q.running) return;
    const run = async () => {
      q.running = true;
      while (q.next) {
        const f = q.next; q.next = null;
        try { await f(); } catch (e) { handleWriteError(e); }
      }
      q.running = false;
    };
    run();
  }

  function handleWriteError(e) {
    const code = e && e.code;
    if (code === 'quota_exceeded') { st.note = 'Your saved space is full. Delete old sessions in Progress → History.'; emit('mode'); return; }
    if (code === 'unavailable' || code === 'resource_exhausted') { st.note = 'Saving is slow right now. Your work is kept on this device and will retry.'; emit('mode'); return; }
    // not permitted / revoked / disabled: keep working on this device
    st.mode = 'local'; st.status = 'device';
    st.note = 'Saving on this device only.';
    emit('mode');
  }

  function cloudWrite(col, item) {
    item._local = true; // kept through snapshots until the database confirms it
    if (st.mode !== 'cloud' || !db) return;
    const path = col + '/' + item.id;
    enqueue(path, async () => {
      await db.collection(col).doc(item.id).set(body(item));
      delete item._local;
    });
  }

  async function init() {
    loadLocal();
    if (!st.profile) st.profile = defaultProfile();
    emit('all');
    let cap = null;
    try { if (window.claude && typeof window.claude.use === 'function') cap = await window.claude.use('db'); } catch (e) { cap = null; }
    if (!cap) { st.mode = 'local'; st.status = 'device'; emit('mode'); return; }
    db = cap; st.mode = 'cloud'; st.status = 'syncing'; emit('mode');
    const timer = setTimeout(() => { if (st.status === 'syncing') { st.note = 'Can\'t reach your saved data yet. Showing what\'s on this device.'; emit('mode'); } }, 10000);
    const settle = () => { clearTimeout(timer); if (st.status === 'syncing') { st.status = 'cloud'; st.note = ''; emit('mode'); } };

    db.doc('app/profile').onSnapshot((snap) => {
      if (snap.exists) {
        st.profile = mergeProfile(snap.data());
        saveLocal(); emit('profile');
      } else if (!snap.metadata.fromCache && !cloudSeen.profile) {
        // First run in the cloud: keep whatever this device already has
        enqueue('app/profile', () => db.doc('app/profile').set(clean(st.profile)));
      }
      if (!snap.metadata.fromCache) { cloudSeen.profile = true; settle(); }
    }, (e) => { clearTimeout(timer); handleWriteError(e); });

    for (const c of COLS) {
      let first = true;
      db.collection(c).orderBy('ts', 'desc').limit(LIMIT[c]).onSnapshot((snap) => {
        const cloud = snap.docs.map((d) => Object.assign({}, d.data(), { id: d.id }));
        const ids = new Set(cloud.map((x) => x.id));
        const localOnly = st[c].filter((x) => x._local && !ids.has(x.id));
        st[c] = sortDesc(cloud.concat(localOnly));
        if (first && !snap.metadata.fromCache) {
          first = false;
          for (const item of localOnly) cloudWrite(c, item); // push work done before the database answered
        }
        if (!snap.metadata.fromCache) settle();
        saveLocal(); emit(c);
      }, (e) => { clearTimeout(timer); handleWriteError(e); });
    }
  }

  function put(col, item) {
    if (!item.id) item.id = newId();
    if (!item.ts) item.ts = Date.now();
    if (item.mult == null && (col === 'sessions' || col === 'logs') && typeof G !== 'undefined') { try { item.mult = G.multNow(); } catch (e) { item.mult = 1; } }
    const arr = st[col];
    const i = arr.findIndex((x) => x.id === item.id);
    if (i >= 0) arr[i] = item; else arr.push(item);
    sortDesc(arr);
    saveLocal(); emit(col);
    cloudWrite(col, item);
    return item;
  }
  function remove(col, id) {
    st[col] = st[col].filter((x) => x.id !== id);
    saveLocal(); emit(col);
    if (st.mode === 'cloud' && db) enqueue(col + '/' + id, () => db.collection(col).doc(id).delete());
  }
  function saveProfile(patch) {
    st.profile = mergeProfile(Object.assign({}, st.profile, patch, { updatedAt: Date.now() }));
    if (patch && patch.settings) A.setCustomFillers(st.profile.settings.customFillers);
    saveLocal(); emit('profile');
    if (st.mode === 'cloud' && db) { const snap = clean(st.profile); enqueue('app/profile', () => db.doc('app/profile').set(snap)); }
  }
  function exportAll() {
    return { app: 'Green Room', version: 1, exportedAt: new Date().toISOString(), profile: clean(st.profile), sessions: st.sessions.map(clean), logs: st.logs.map(clean), preps: st.preps.map(clean), reviews: st.reviews.map(clean) };
  }
  function importAll(d) {
    if (!d || typeof d !== 'object' || (d.app && d.app !== 'Green Room')) throw new Error('That file isn\'t a Green Room backup.');
    let n = 0;
    if (d.profile) saveProfile(d.profile);
    for (const c of COLS) if (Array.isArray(d[c])) for (const item of d[c]) { if (item && item.ts) { put(c, Object.assign({}, item, { id: item.id || newId() })); n++; } }
    return n;
  }
  function resetAll() {
    for (const c of COLS) for (const item of [...st[c]]) remove(c, item.id);
    saveProfile(defaultProfile());
  }

  return {
    get mode() { return st.mode; }, get status() { return st.status; }, get note() { return st.note; },
    get profile() { return st.profile; }, get sessions() { return st.sessions; }, get logs() { return st.logs; },
    get preps() { return st.preps; }, get reviews() { return st.reviews; },
    init, put, remove, saveProfile, exportAll, importAll, resetAll, newId,
    on: (f) => { subs.add(f); return () => subs.delete(f); },
  };
})();
