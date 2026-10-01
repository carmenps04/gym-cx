import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { AppData, Meta, Routine, Session } from '../types';
import { useAuth } from './auth';
import { createCloudBackend, createLocalBackend, emptyData, hasContent, readLocal } from './backends';
import type { Backend } from './backends';
import { cloudEnabled } from '../lib/firebase';

interface DataCtx {
  data: AppData;
  ready: boolean;
  mode: 'local' | 'cloud';
  syncError: string | null;
  saveRoutine(r: Routine): Promise<void>;
  deleteRoutine(id: string): Promise<void>;
  saveSession(s: Session): Promise<void>;
  deleteSession(id: string): Promise<void>;
  updateMeta(fn: (m: Meta) => Meta): Promise<void>;
  replaceAll(d: AppData): Promise<void>;
}
const Ctx = createContext<DataCtx | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, ready: authReady } = useAuth();
  const [data, setData] = useState<AppData>(emptyData);
  const [ready, setReady] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const backend = useRef<Backend | null>(null);
  const latest = useRef<AppData>(data);
  latest.current = data;

  const uid = cloudEnabled && user ? user.uid : null;

  useEffect(() => {
    if (!authReady) return;
    setReady(false);
    setSyncError(null);
    const b = uid ? createCloudBackend(uid) : createLocalBackend();
    backend.current = b;
    const flag = uid ? `gym.migrated.${uid}` : '';
    const unsub = b.subscribe(
      (d, info) => {
        setData(d);
        setReady(true);
        // Primera vez con esta cuenta: si la nube está vacía (confirmado por el servidor) y este
        // dispositivo tiene datos locales, se suben una sola vez.
        if (uid && info.serverEmpty && !localStorage.getItem(flag)) {
          localStorage.setItem(flag, '1');
          const local = readLocal();
          if (hasContent(local)) b.replaceAll(local).catch((e) => setSyncError(String((e as Error)?.message ?? e)));
        }
      },
      (e) => setSyncError(String((e as Error)?.message ?? e)),
    );
    return unsub;
  }, [uid, authReady]);

  const guard = useCallback(async (fn: (b: Backend) => Promise<void>) => {
    const b = backend.current;
    if (!b) return;
    try {
      await fn(b);
      setSyncError(null);
    } catch (e) {
      setSyncError(String((e as Error)?.message ?? e));
      throw e;
    }
  }, []);

  const value = useMemo<DataCtx>(
    () => ({
      data,
      ready,
      mode: uid ? 'cloud' : 'local',
      syncError,
      saveRoutine: (r) => guard((b) => b.saveRoutine(r)),
      deleteRoutine: (id) => guard((b) => b.deleteRoutine(id)),
      saveSession: (s) => guard((b) => b.saveSession(s)),
      deleteSession: (id) => guard((b) => b.deleteSession(id)),
      updateMeta: (fn) => guard((b) => b.saveMeta({ ...fn(latest.current.meta), updatedAt: Date.now() })),
      replaceAll: (d) => guard((b) => b.replaceAll(d)),
    }),
    [data, ready, uid, syncError, guard],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData(): DataCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useData fuera de DataProvider');
  return v;
}
