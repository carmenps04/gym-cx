import type { AppData, Meta, Routine, Session } from '../types';
import { getFirebaseDb } from '../lib/firebase';

export const defaultMeta = (): Meta => ({
  profile: { name: '', weeklyGoal: 3 },
  settings: { units: 'kg', restSec: 90, theme: 'system', equipment: [] },
  weights: [],
  videos: {},
  updatedAt: 0,
});
export const emptyData = (): AppData => ({ routines: [], sessions: [], meta: defaultMeta() });

/** Completa campos que falten (datos antiguos o parciales). */
export function normalizeMeta(m: Partial<Meta> | null | undefined): Meta {
  const d = defaultMeta();
  return {
    profile: { ...d.profile, ...(m?.profile ?? {}) },
    settings: { ...d.settings, ...(m?.settings ?? {}) },
    weights: m?.weights ?? [],
    videos: m?.videos ?? {},
    updatedAt: m?.updatedAt ?? 0,
  };
}

export function hasContent(d: AppData): boolean {
  const m = d.meta;
  return d.routines.length > 0 || d.sessions.length > 0 || m.weights.length > 0 || m.profile.name !== '' || m.updatedAt > 0;
}

export interface SnapshotInfo {
  /** true solo si el servidor confirmó que la cuenta no tiene datos (no si la caché está vacía). */
  serverEmpty: boolean;
}
export interface Backend {
  subscribe(cb: (d: AppData, info: SnapshotInfo) => void, onError: (e: unknown) => void): () => void;
  saveRoutine(r: Routine): Promise<void>;
  deleteRoutine(id: string): Promise<void>;
  saveSession(s: Session): Promise<void>;
  deleteSession(id: string): Promise<void>;
  saveMeta(m: Meta): Promise<void>;
  /** Sustituye todos los datos (importar copia de seguridad, borrar todo, migrar datos locales). */
  replaceAll(d: AppData): Promise<void>;
}

// ------------------------------------------------------------------ Local
const KEY = 'gym.data.v1';

export function readLocal(): AppData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyData();
    const j = JSON.parse(raw) as Partial<AppData>;
    return { routines: j.routines ?? [], sessions: j.sessions ?? [], meta: normalizeMeta(j.meta) };
  } catch {
    return emptyData();
  }
}

export function createLocalBackend(): Backend {
  const listeners = new Set<(d: AppData, i: SnapshotInfo) => void>();
  const emit = (d: AppData) => listeners.forEach((l) => l(d, { serverEmpty: false }));
  const write = (d: AppData) => {
    localStorage.setItem(KEY, JSON.stringify(d));
    emit(d);
  };
  const upsert = <T extends { id: string }>(arr: T[], item: T) => (arr.some((x) => x.id === item.id) ? arr.map((x) => (x.id === item.id ? item : x)) : [...arr, item]);

  return {
    subscribe(cb) {
      listeners.add(cb);
      cb(readLocal(), { serverEmpty: false });
      const onStorage = (e: StorageEvent) => {
        if (e.key === KEY) cb(readLocal(), { serverEmpty: false });
      };
      window.addEventListener('storage', onStorage);
      return () => {
        listeners.delete(cb);
        window.removeEventListener('storage', onStorage);
      };
    },
    async saveRoutine(r) {
      const d = readLocal();
      write({ ...d, routines: upsert(d.routines, r) });
    },
    async deleteRoutine(id) {
      const d = readLocal();
      write({ ...d, routines: d.routines.filter((r) => r.id !== id) });
    },
    async saveSession(s) {
      const d = readLocal();
      write({ ...d, sessions: upsert(d.sessions, s) });
    },
    async deleteSession(id) {
      const d = readLocal();
      write({ ...d, sessions: d.sessions.filter((s) => s.id !== id) });
    },
    async saveMeta(m) {
      write({ ...readLocal(), meta: m });
    },
    async replaceAll(d) {
      write({ routines: d.routines, sessions: d.sessions, meta: normalizeMeta(d.meta) });
    },
  };
}

// ------------------------------------------------------------------ Nube (Firestore)
// Estructura:  users/{uid}  (campo "meta")  +  users/{uid}/routines/{id}  +  users/{uid}/sessions/{id}
export function createCloudBackend(uid: string): Backend {
  const fsP = import('firebase/firestore');
  const refs = async () => {
    const [db, fs] = await Promise.all([getFirebaseDb(), fsP]);
    return {
      db,
      fs,
      userDoc: fs.doc(db, 'users', uid),
      routines: fs.collection(db, 'users', uid, 'routines'),
      sessions: fs.collection(db, 'users', uid, 'sessions'),
    };
  };

  return {
    subscribe(cb, onError) {
      let cancelled = false;
      const unsubs: (() => void)[] = [];
      let routines: Routine[] = [];
      let sessions: Session[] = [];
      let metaDoc: Meta | null = null;
      const got = { r: false, s: false, m: false };
      const fromServer = { r: false, s: false, m: false };
      let metaExists = false;

      const emit = () => {
        if (!got.r || !got.s || !got.m) return;
        const confirmed = fromServer.r && fromServer.s && fromServer.m;
        cb(
          { routines, sessions, meta: normalizeMeta(metaDoc) },
          { serverEmpty: confirmed && !metaExists && routines.length === 0 && sessions.length === 0 },
        );
      };

      refs()
        .then(({ fs, userDoc, routines: rc, sessions: sc }) => {
          if (cancelled) return;
          unsubs.push(
            fs.onSnapshot(
              rc,
              (snap) => {
                routines = snap.docs.map((d) => d.data() as Routine);
                got.r = true;
                if (!snap.metadata.fromCache) fromServer.r = true;
                emit();
              },
              onError,
            ),
            fs.onSnapshot(
              sc,
              (snap) => {
                sessions = snap.docs.map((d) => d.data() as Session);
                got.s = true;
                if (!snap.metadata.fromCache) fromServer.s = true;
                emit();
              },
              onError,
            ),
            fs.onSnapshot(
              userDoc,
              (snap) => {
                const data = snap.data() as { meta?: Meta } | undefined;
                metaExists = Boolean(data?.meta);
                metaDoc = data?.meta ?? null;
                got.m = true;
                if (!snap.metadata.fromCache) fromServer.m = true;
                emit();
              },
              onError,
            ),
          );
        })
        .catch(onError);

      return () => {
        cancelled = true;
        unsubs.forEach((u) => u());
      };
    },
    async saveRoutine(r) {
      const { fs, routines } = await refs();
      await fs.setDoc(fs.doc(routines, r.id), r);
    },
    async deleteRoutine(id) {
      const { fs, routines } = await refs();
      await fs.deleteDoc(fs.doc(routines, id));
    },
    async saveSession(s) {
      const { fs, sessions } = await refs();
      await fs.setDoc(fs.doc(sessions, s.id), s);
    },
    async deleteSession(id) {
      const { fs, sessions } = await refs();
      await fs.deleteDoc(fs.doc(sessions, id));
    },
    async saveMeta(m) {
      const { fs, userDoc } = await refs();
      await fs.setDoc(userDoc, { meta: m }, { merge: true });
    },
    async replaceAll(d) {
      const { fs, db, userDoc, routines, sessions } = await refs();
      // Borra lo existente y escribe lo nuevo en lotes (límite de 500 operaciones por lote).
      const [oldR, oldS] = await Promise.all([fs.getDocs(routines), fs.getDocs(sessions)]);
      const ops: ((b: ReturnType<typeof fs.writeBatch>) => void)[] = [];
      oldR.docs.forEach((x) => ops.push((b) => b.delete(x.ref)));
      oldS.docs.forEach((x) => ops.push((b) => b.delete(x.ref)));
      d.routines.forEach((r) => ops.push((b) => b.set(fs.doc(routines, r.id), r)));
      d.sessions.forEach((s) => ops.push((b) => b.set(fs.doc(sessions, s.id), s)));
      ops.push((b) => b.set(userDoc, { meta: normalizeMeta(d.meta) }));
      for (let i = 0; i < ops.length; i += 450) {
        const batch = fs.writeBatch(db);
        ops.slice(i, i + 450).forEach((op) => op(batch));
        await batch.commit();
      }
    },
  };
}
