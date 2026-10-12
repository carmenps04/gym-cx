import { useRef, useState } from 'react';
import { Download } from 'lucide-react';
import type { DayDef } from '../types';
import { useData } from '../state/data';
import { useUi } from '../state/ui';
import { parseNb } from '../lib/nivelbestia';
import type { NbImport } from '../lib/nivelbestia';

export interface NbResult extends NbImport {
  /** Fechas que no estaban importadas antes. */
  newDates: string[];
  /** Días de la rutina tal como quedan guardados tras importar. */
  finalDays: DayDef[];
}

/**
 * Une la rutina importada con los días ya configurados. Si los días actuales vienen de Nivel Bestia
 * (mismos identificadores) se actualizan sin preguntar y se respeta lo marcado como «pierna».
 */
function mergeDays(current: DayDef[], incoming: DayDef[]): { days: DayDef[]; needsConfirm: boolean } {
  if (incoming.length === 0) return { days: current, needsConfirm: false };
  const ids = new Set(incoming.map((d) => d.id));
  const fromNb = current.length === 0 || current.every((d) => ids.has(d.id));
  const days = incoming.map((d) => {
    const prev = current.find((c) => c.id === d.id);
    return prev ? { ...d, isLeg: prev.isLeg } : d;
  });
  return { days, needsConfirm: !fromNb };
}

export function NbImportButton({ onDone, label = 'Importar de Nivel Bestia', className = 'btn primary block' }: { onDone?: (r: NbResult) => void; label?: string; className?: string }) {
  const { data, saveLoads, saveConfig } = useData();
  const ui = useUi();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handle = async (file: File) => {
    setBusy(true);
    try {
      let parsed: NbImport;
      try {
        parsed = parseNb(JSON.parse(await file.text()));
      } catch {
        ui.toast('Ese archivo no es una copia de Nivel Bestia. Usa «Guardar copia» en sus Ajustes.');
        return;
      }
      const known = new Set(data.loads.map((l) => l.date));
      const newDates = parsed.loads.map((l) => l.date).filter((d) => !known.has(d));
      if (parsed.loads.length) await saveLoads(parsed.loads);

      const merged = mergeDays(data.config.days, parsed.days);
      let finalDays = data.config.days;
      let replace = !merged.needsConfirm;
      if (merged.needsConfirm) {
        replace = await ui.confirm({
          title: '¿Usar los días de Nivel Bestia?',
          message: `La copia trae la rutina ${parsed.routineName ?? ''} con ${parsed.days.length} días. Sustituirían a los ${data.config.days.length} que tienes aquí. Las sesiones ya registradas no cambian.`,
          confirmLabel: 'Usar los de Nivel Bestia',
          cancelLabel: 'Mantener los míos',
        });
      }
      if (replace && parsed.days.length) finalDays = merged.days;
      await saveConfig({ ...data.config, days: finalDays, nbImportedAt: Date.now(), nbBackupAt: parsed.backupAt ?? undefined });

      ui.toast(
        parsed.loads.length
          ? `${parsed.loads.length} entrenamientos leídos${newDates.length ? `, ${newDates.length} nuevos` : ', ninguno nuevo'}.`
          : 'La copia no tiene entrenamientos registrados.',
      );
      onDone?.({ ...parsed, newDates, finalDays });
    } catch {
      ui.toast('No se pudo guardar la importación. Revisa la conexión e inténtalo otra vez.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className={className} disabled={busy} onClick={() => input.current?.click()}>
        <Download size={18} /> {busy ? 'Importando…' : label}
      </button>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void handle(f);
        }}
      />
    </>
  );
}
