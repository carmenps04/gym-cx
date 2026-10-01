import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { cloudEnabled, getFirebaseAuth } from '../lib/firebase';

export interface AuthUser {
  uid: string;
  email: string | null;
  name: string | null;
}
interface AuthCtx {
  enabled: boolean;
  ready: boolean;
  user: AuthUser | null;
  signInGoogle(): Promise<void>;
  signInEmail(email: string, password: string): Promise<void>;
  signUpEmail(email: string, password: string): Promise<void>;
  resetPassword(email: string): Promise<void>;
  signOut(): Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

const ERRORS: Record<string, string> = {
  'auth/invalid-email': 'El correo no es válido.',
  'auth/missing-password': 'Escribe la contraseña.',
  'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
  'auth/email-already-in-use': 'Ya existe una cuenta con ese correo. Inicia sesión.',
  'auth/user-not-found': 'No hay ninguna cuenta con ese correo.',
  'auth/wrong-password': 'Contraseña incorrecta.',
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos.',
  'auth/network-request-failed': 'Sin conexión. Revisa tu red e inténtalo de nuevo.',
  'auth/popup-closed-by-user': 'Cerraste la ventana antes de terminar.',
  'auth/popup-blocked': 'El navegador bloqueó la ventana emergente. Permítela e inténtalo de nuevo.',
  'auth/operation-not-allowed': 'Este método de acceso no está activado en Firebase (Authentication > Método de acceso).',
  'auth/unauthorized-domain': 'Este dominio no está autorizado en Firebase (Authentication > Configuración > Dominios autorizados).',
};
export function authMessage(e: unknown): string {
  const code = (e as { code?: string })?.code;
  return (code && ERRORS[code]) || 'No se pudo completar la operación. Inténtalo de nuevo.';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(!cloudEnabled);

  useEffect(() => {
    if (!cloudEnabled) return;
    let unsub: (() => void) | undefined;
    let alive = true;
    (async () => {
      const [auth, { onAuthStateChanged }] = await Promise.all([getFirebaseAuth(), import('firebase/auth')]);
      if (!alive) return;
      unsub = onAuthStateChanged(auth, (u) => {
        setUser(u ? { uid: u.uid, email: u.email, name: u.displayName } : null);
        setReady(true);
      });
    })().catch(() => setReady(true));
    return () => {
      alive = false;
      unsub?.();
    };
  }, []);

  const signInGoogle = useCallback(async () => {
    const [auth, m] = await Promise.all([getFirebaseAuth(), import('firebase/auth')]);
    await m.signInWithPopup(auth, new m.GoogleAuthProvider());
  }, []);
  const signInEmail = useCallback(async (email: string, password: string) => {
    const [auth, m] = await Promise.all([getFirebaseAuth(), import('firebase/auth')]);
    await m.signInWithEmailAndPassword(auth, email.trim(), password);
  }, []);
  const signUpEmail = useCallback(async (email: string, password: string) => {
    const [auth, m] = await Promise.all([getFirebaseAuth(), import('firebase/auth')]);
    await m.createUserWithEmailAndPassword(auth, email.trim(), password);
  }, []);
  const resetPassword = useCallback(async (email: string) => {
    const [auth, m] = await Promise.all([getFirebaseAuth(), import('firebase/auth')]);
    await m.sendPasswordResetEmail(auth, email.trim());
  }, []);
  const signOut = useCallback(async () => {
    const [auth, m] = await Promise.all([getFirebaseAuth(), import('firebase/auth')]);
    await m.signOut(auth);
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({ enabled: cloudEnabled, ready, user, signInGoogle, signInEmail, signUpEmail, resetPassword, signOut }),
    [ready, user, signInGoogle, signInEmail, signUpEmail, resetPassword, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth fuera de AuthProvider');
  return v;
}
