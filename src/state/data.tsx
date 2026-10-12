import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { AppData, Config, Entry, LoadDay } from '../types';
import { useAuth } from './auth';
import { createCloudBackend, createLocalBackend, emptyData, hasContent, readLocal } from './backends';
import type { Backend } from './backends';
import { cloudEnabled } from '../lib/firebase';

interface DataCtx {
  data: AppData;
  ready: boolean;
  mode: 'local' | 'cloud';
  syncError: string | null;
  saveEntry(e: Entry): Promise<void>;
  deleteEntry(id: string): Promise<void>;
  saveConfig(c: Config): Promise<void>;
  saveLoads(days: LoadDay[]): Promise<void>;
  replaceAll(d: AppData): Promise<void>;
}
const Ctx = createContext<DataCtx | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, ready: authReady } = useAuth();
  const [data, setData] = useState<AppData>(emptyData);
  const [ready, setReady] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const backend = useRef<Backend | null>(null);

  const uid = cloudEnabled && user ? user.uid : null;

  useEffect(() => {
    if (!authReady) return;
    setReady(false);
    setSyncError(null);
    const b = uid ? createCloudBackend(uid) : createLocalBackend();
    backend.current = b;
    const flag = uid ? `diario.migrated.${uid}` : '';
    const unsub = b.subscribe(
      (d, info) => {
        setData(d);
        setReady(true);
        // Primera vez con esta cuenta: si la nube está vacía y este dispositivo tiene datos sin cuenta, se suben.
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
    // Con mala cobertura (gimnasio), Firestore guarda al instante en el móvil pero la promesa no se
    // resuelve hasta que llega al servidor. No se bloquea la pantalla esperando: se sube en segundo plano.
    const p = fn(b).then(
      () => setSyncError(null),
      (e) => {
        setSyncError(String((e as Error)?.message ?? e));
        throw e;
      },
    );
    await Promise.race([p, new Promise((r) => setTimeout(r, 1500))]);
    p.catch(() => undefined);
  }, []);

  const value = useMemo<DataCtx>(
    () => ({
      data,
      ready,
      mode: uid ? 'cloud' : 'local',
      syncError,
      saveEntry: (e) => guard((b) => b.saveEntry({ ...e, updatedAt: Date.now() })),
      deleteEntry: (id) => guard((b) => b.deleteEntry(id)),
      saveConfig: (c) => guard((b) => b.saveConfig({ ...c, updatedAt: Date.now() })),
      saveLoads: (days) => guard((b) => b.saveLoads(days)),
      // Restaurar una copia sí espera a terminar: se borra y se reescribe todo.
      replaceAll: async (d) => {
        await backend.current?.replaceAll(d);
      },
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
