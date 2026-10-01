import { useRef } from 'react';
import { Download, Upload } from 'lucide-react';
import { Chip, PageHeader, Segmented, Stepper } from '../components/ui';
import { useData } from '../state/data';
import { useUi } from '../state/ui';
import { EQUIPMENT } from '../lib/catalog';
import { emptyData, normalizeMeta } from '../state/backends';
import { clearDraft } from '../lib/routine';
import { isoDate } from '../lib/util';
import type { AppData, Settings as SettingsT } from '../types';

function isBackup(x: unknown): x is Partial<AppData> & { routines: AppData['routines']; sessions: AppData['sessions'] } {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    Array.isArray(o.routines) &&
    Array.isArray(o.sessions) &&
    o.routines.every((r) => r && typeof (r as { id?: unknown }).id === 'string' && Array.isArray((r as { days?: unknown }).days)) &&
    o.sessions.every((s) => s && typeof (s as { id?: unknown }).id === 'string' && Array.isArray((s as { entries?: unknown }).entries))
  );
}

export default function Settings() {
  const { data, updateMeta, replaceAll, mode } = useData();
  const ui = useUi();
  const fileRef = useRef<HTMLInputElement>(null);
  const s = data.meta.settings;
  const patch = (p: Partial<SettingsT>) => updateMeta((m) => ({ ...m, settings: { ...m.settings, ...p } }));

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ app: 'gym', version: 1, exportedAt: new Date().toISOString(), ...data }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gym-copia-${isoDate(new Date())}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const importData = async (file: File) => {
    try {
      const json: unknown = JSON.parse(await file.text());
      if (!isBackup(json)) throw new Error('formato');
      const ok = await ui.confirm({
        title: 'Importar copia de seguridad',
        message: `Se reemplazarán tus datos actuales por los del archivo (${json.routines.length} rutinas, ${json.sessions.length} entrenamientos).${mode === 'cloud' ? ' También se reemplazarán en la nube.' : ''}`,
        confirmLabel: 'Importar',
        danger: true,
      });
      if (!ok) return;
      await replaceAll({ routines: json.routines, sessions: json.sessions, meta: normalizeMeta(json.meta) });
      ui.toast('Copia importada.');
    } catch {
      ui.toast('El archivo no es una copia de seguridad válida.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const wipe = async () => {
    const ok = await ui.confirm({
      title: 'Borrar todos mis datos',
      message: `Se eliminarán rutinas, entrenamientos, peso y ajustes${mode === 'cloud' ? ', también en la nube' : ' de este dispositivo'}. No se puede deshacer. Si dudas, exporta antes una copia.`,
      confirmLabel: 'Borrar todo',
      danger: true,
    });
    if (!ok) return;
    clearDraft();
    sessionStorage.removeItem('gym.search.v1');
    await replaceAll(emptyData());
    ui.toast('Datos borrados.');
  };

  return (
    <>
      <PageHeader title="Ajustes" />

      <section className="card">
        <h2 className="h3">Apariencia</h2>
        <Segmented<SettingsT['theme']> label="Tema" value={s.theme} onChange={(theme) => patch({ theme })} options={[{ id: 'system', label: 'Automático' }, { id: 'light', label: 'Claro' }, { id: 'dark', label: 'Oscuro' }]} />
      </section>

      <section className="card">
        <h2 className="h3">Entrenamiento</h2>
        <div className="split">
          <span>Unidad de peso</span>
          <Segmented<SettingsT['units']> label="Unidad de peso" value={s.units} onChange={(units) => patch({ units })} options={[{ id: 'kg', label: 'kg' }, { id: 'lb', label: 'lb' }]} />
        </div>
        <div className="split gap-top">
          <span>Descanso entre series</span>
          <Stepper label="segundos de descanso" value={s.restSec} min={15} max={600} step={15} onChange={(restSec) => patch({ restSec })} suffix=" s" />
        </div>
      </section>

      <section className="card">
        <h2 className="h3">Mi material</h2>
        <p className="muted">Marca lo que tienes a mano. En el buscador de ejercicios podrás aplicarlo con un toque.</p>
        <div className="chips">
          {EQUIPMENT.map((e) => (
            <Chip key={e.id} active={s.equipment.includes(e.id)} onClick={() => patch({ equipment: s.equipment.includes(e.id) ? s.equipment.filter((x) => x !== e.id) : [...s.equipment, e.id] })}>
              {e.label}
            </Chip>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="h3">Copia de seguridad</h2>
        <p className="muted">Descarga tus rutinas, entrenamientos y ajustes en un archivo, o restaura una copia anterior.</p>
        <div className="row">
          <button className="btn grow" onClick={exportData}>
            <Download size={16} /> Exportar
          </button>
          <button className="btn grow" onClick={() => fileRef.current?.click()}>
            <Upload size={16} /> Importar
          </button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
      </section>

      <section className="card">
        <h2 className="h3">Datos</h2>
        <p className="muted">{mode === 'cloud' ? 'Modo nube: tus datos se sincronizan con tu cuenta.' : 'Modo local: tus datos están solo en este navegador.'}</p>
        <button className="btn danger block" onClick={wipe}>
          Borrar todos mis datos
        </button>
      </section>

      <p className="credits">
        Catálogo de ejercicios e imágenes: <a href="https://github.com/yuhonas/free-exercise-db" target="_blank" rel="noopener noreferrer">free-exercise-db</a> (dominio público). Los nombres en español se han generado con un glosario y pueden contener errores.
      </p>
    </>
  );
}
