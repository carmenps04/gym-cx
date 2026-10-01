import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

interface ConfirmOpts {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  hideCancel?: boolean;
  danger?: boolean;
}
interface UiCtx {
  toast(message: string): void;
  confirm(opts: ConfirmOpts): Promise<boolean>;
}
const Ctx = createContext<UiCtx | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [toastMsg, setToastMsg] = useState<{ id: number; text: string } | null>(null);
  const [dialog, setDialog] = useState<ConfirmOpts | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const toast = useCallback((text: string) => {
    window.clearTimeout(timer.current);
    setToastMsg({ id: Date.now(), text });
    timer.current = window.setTimeout(() => setToastMsg(null), 3200);
  }, []);

  const confirm = useCallback((opts: ConfirmOpts) => {
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setDialog(opts);
    });
  }, []);

  const close = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setDialog(null);
  };

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);
  return (
    <Ctx.Provider value={value}>
      {children}
      {toastMsg && (
        <div className="toast" role="status" key={toastMsg.id}>
          {toastMsg.text}
        </div>
      )}
      {dialog && (
        <div className="overlay" onClick={() => close(false)}>
          <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dlg-title" onClick={(e) => e.stopPropagation()}>
            <h2 id="dlg-title">{dialog.title}</h2>
            {dialog.message && <p>{dialog.message}</p>}
            <div className="dialog-actions">
              {!dialog.hideCancel && (
                <button className="btn" onClick={() => close(false)}>
                  {dialog.cancelLabel ?? 'Cancelar'}
                </button>
              )}
              <button className={dialog.danger ? 'btn danger' : 'btn primary'} onClick={() => close(true)} autoFocus>
                {dialog.confirmLabel ?? 'Aceptar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useUi(): UiCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useUi fuera de UiProvider');
  return v;
}
