import type { AppData, Config, Entry, LoadDay } from '../types';
import { getFirebaseDb } from '../lib/firebase';

export const emptyConfig = (): Config => ({ days: [], updatedAt: 0 });
export const emptyData = (): AppData => ({ entries: [], config: emptyConfig(), loads: [] });

export function normalizeConfig(c: Partial<Config> | null | undefined): Config {
  return { ...(c ?? {}), days: c?.days ?? [], updatedAt: c?.updatedAt ?? 0 };
}

export function hasContent(d: AppData): boolean {
  return d.entries.length > 0 || d.config.days.length > 0 || d.loads.length > 0;
}

export interface SnapshotInfo {
  /** true solo si el servidor confirmó que la cuenta no tiene datos del diario. */
  serverEmpty: boolean;
}
export interface Backend {
  subscribe(cb: (d: AppData, info: SnapshotInfo) => void, onError: (e: unknown) => void): () => void;
  saveEntry(e: Entry): Promise<void>;
  deleteEntry(id: string): Promise<void>;
  saveConfig(c: Config): Promise<void>;
  /** Añade o sustituye los días importados (uno por fecha). */
  saveLoads(days: LoadDay[]): Promise<void>;
  replaceAll(d: AppData): Promise<void>;
}

// ------------------------------------------------------------------ Local (sin cuenta)
const KEY = 'diario.v1';

export function readLocal(): AppData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyData();
    const j = JSON.parse(raw) as Partial<AppData>;
    return { entries: j.entries ?? [], config: normalizeConfig(j.config), loads: j.loads ?? [] };
  } catch {
    return emptyData();
  }
}

export function createLocalBackend(): Backend {
  const listeners = new Set<(d: AppData, i: SnapshotInfo) => void>();
  const write = (d: AppData) => {
    localStorage.setItem(KEY, JSON.stringify(d));
    listeners.forEach((l) => l(d, { serverEmpty: false }));
  };
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
    async saveEntry(e) {
      const d = readLocal();
      const entries = d.entries.some((x) => x.id === e.id) ? d.entries.map((x) => (x.id === e.id ? e : x)) : [...d.entries, e];
      write({ ...d, entries });
    },
    async deleteEntry(id) {
      const d = readLocal();
      write({ ...d, entries: d.entries.filter((x) => x.id !== id) });
    },
    async saveConfig(c) {
      write({ ...readLocal(), config: c });
    },
    async saveLoads(days) {
      const d = readLocal();
      const dates = new Set(days.map((x) => x.date));
      write({ ...d, loads: [...d.loads.filter((x) => !dates.has(x.date)), ...days] });
    },
    async replaceAll(d) {
      write({ entries: d.entries, config: normalizeConfig(d.config), loads: d.loads ?? [] });
    },
  };
}

// ------------------------------------------------------------------ Nube (Firestore)
// users/{uid}  (campo «diarioConfig»)  +  users/{uid}/diario/{id}  +  users/{uid}/cargas/{AAAA-MM-DD}
// Los datos de la versión anterior de la app (routines, sessions, meta) no se tocan.
export function createCloudBackend(uid: string): Backend {
  const fsP = import('firebase/firestore');
  const refs = async () => {
    const [db, fs] = await Promise.all([getFirebaseDb(), fsP]);
    return { db, fs, userDoc: fs.doc(db, 'users', uid), entries: fs.collection(db, 'users', uid, 'diario'), loads: fs.collection(db, 'users', uid, 'cargas') };
  };

  return {
    subscribe(cb, onError) {
      let cancelled = false;
      const unsubs: (() => void)[] = [];
      let entries: Entry[] = [];
      let config: Config | null = null;
      let loads: LoadDay[] = [];
      const got = { e: false, c: false, l: false };
      const fromServer = { e: false, c: false, l: false };
      const emit = () => {
        if (!got.e || !got.c || !got.l) return;
        const confirmed = fromServer.e && fromServer.c && fromServer.l;
        cb({ entries, config: normalizeConfig(config), loads }, { serverEmpty: confirmed && !config && entries.length === 0 && loads.length === 0 });
      };
      refs()
        .then(({ fs, userDoc, entries: col, loads: loadCol }) => {
          if (cancelled) return;
          unsubs.push(
            fs.onSnapshot(
              col,
              (snap) => {
                entries = snap.docs.map((d) => d.data() as Entry);
                got.e = true;
                if (!snap.metadata.fromCache) fromServer.e = true;
                emit();
              },
              onError,
            ),
            fs.onSnapshot(
              loadCol,
              (snap) => {
                loads = snap.docs.map((d) => d.data() as LoadDay);
                got.l = true;
                if (!snap.metadata.fromCache) fromServer.l = true;
                emit();
              },
              onError,
            ),
            fs.onSnapshot(
              userDoc,
              (snap) => {
                config = (snap.data() as { diarioConfig?: Config } | undefined)?.diarioConfig ?? null;
                got.c = true;
                if (!snap.metadata.fromCache) fromServer.c = true;
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
    async saveEntry(e) {
      const { fs, entries } = await refs();
      await fs.setDoc(fs.doc(entries, e.id), e);
    },
    async deleteEntry(id) {
      const { fs, entries } = await refs();
      await fs.deleteDoc(fs.doc(entries, id));
    },
    async saveConfig(c) {
      const { fs, userDoc } = await refs();
      await fs.setDoc(userDoc, { diarioConfig: c }, { merge: true });
    },
    async saveLoads(days) {
      const { fs, db, loads } = await refs();
      for (let i = 0; i < days.length; i += 450) {
        const batch = fs.writeBatch(db);
        days.slice(i, i + 450).forEach((day) => batch.set(fs.doc(loads, day.date), day));
        await batch.commit();
      }
    },
    async replaceAll(d) {
      const { fs, db, userDoc, entries, loads } = await refs();
      const [old, oldLoads] = await Promise.all([fs.getDocs(entries), fs.getDocs(loads)]);
      const ops: ((b: ReturnType<typeof fs.writeBatch>) => void)[] = [];
      old.docs.forEach((x) => ops.push((b) => b.delete(x.ref)));
      oldLoads.docs.forEach((x) => ops.push((b) => b.delete(x.ref)));
      d.entries.forEach((e) => ops.push((b) => b.set(fs.doc(entries, e.id), e)));
      (d.loads ?? []).forEach((l) => ops.push((b) => b.set(fs.doc(loads, l.date), l)));
      ops.push((b) => b.set(userDoc, { diarioConfig: normalizeConfig(d.config) }, { merge: true }));
      for (let i = 0; i < ops.length; i += 450) {
        const batch = fs.writeBatch(db);
        ops.slice(i, i + 450).forEach((op) => op(batch));
        await batch.commit();
      }
    },
  };
}
