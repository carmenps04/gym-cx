import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useData } from '../state/data';
import { useUi } from '../state/ui';
import { HOUR } from '../lib/report';
import { fmtDate, fmtTime } from '../lib/util';
import { Card, Empty, PageHeader, PainScale } from '../components/ui';

export default function Knee24() {
  const { id } = useParams();
  const nav = useNavigate();
  const ui = useUi();
  const { data, saveEntry } = useData();
  const e = data.entries.find((x) => x.id === id);
  const [v, setV] = useState<number | null>(e?.knee24h ?? null);

  if (!e) {
    return (
      <div className="page">
        <PageHeader title="Rodilla a las 24 h" back="/inicio" />
        <Empty title="No encuentro esa sesión" text="Puede que se haya borrado." action={<Link className="btn" to="/inicio">Ir al inicio</Link>} />
      </div>
    );
  }
  const hours = Math.floor((Date.now() - e.at) / HOUR);

  const save = async () => {
    if (v == null) {
      ui.toast('Elige un valor de 0 a 10.');
      return;
    }
    try {
      await saveEntry({ ...e, knee24h: v });
      ui.toast('Guardado.');
      nav('/informe', { replace: true });
    } catch {
      ui.toast('No se pudo guardar. Inténtalo otra vez.');
    }
  };

  return (
    <div className="page">
      <PageHeader title="Rodilla a las 24 h" sub={`Sesión de ${e.dayName}, ${fmtDate(e.at)} a las ${fmtTime(e.at)}`} back="/inicio" />
      <Card>
        <p className="lead">¿Cuánto te duele la rodilla ahora?</p>
        <PainScale label="Dolor a las 24 h" value={v} onChange={setV} />
        {e.kneeDuring != null && <p className="hint">Durante la sesión anotaste {e.kneeDuring}.</p>}
        {hours < 20 && <p className="hint warn">Solo han pasado {hours} h. Si puedes, contesta más cerca de las 24 h para que el dato sea comparable.</p>}
        {hours > 36 && <p className="hint warn">Han pasado {hours} h. Contesta pensando en cómo estabas a las 24 h, o déjalo en blanco si no lo recuerdas.</p>}
      </Card>
      <div className="save-bar">
        <button className="btn primary block" onClick={save}>
          Guardar
        </button>
      </div>
    </div>
  );
}
