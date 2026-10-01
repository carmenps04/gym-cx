import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUi } from '../state/ui';
import { clearDraft, loadDraft } from './routine';

/** Empieza un día de una rutina; si hay un entrenamiento sin terminar pide confirmación. */
export function useStartDay() {
  const nav = useNavigate();
  const ui = useUi();
  return useCallback(
    async (routineId: string, dayId: string) => {
      const d = loadDraft();
      if (d && (d.routineId !== routineId || d.dayId !== dayId)) {
        const ok = await ui.confirm({
          title: 'Hay un entrenamiento sin terminar',
          message: 'Si empiezas este, se descartará el anterior.',
          confirmLabel: 'Descartar y empezar',
          danger: true,
        });
        if (!ok) return;
        clearDraft();
      }
      nav(`/sesion/${routineId}/${dayId}`);
    },
    [nav, ui],
  );
}
