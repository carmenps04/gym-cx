/**
 * PDF del informe generado en el propio navegador.
 *
 * window.print() no sirve en el iPhone cuando la app está abierta como app (pantalla de inicio o atajo),
 * así que se hace una copia del informe con estilo de papel, se convierte cada tarjeta en imagen
 * y se colocan en páginas A4 sin partir tarjetas. Las que no caben en una página se parten entre filas.
 */

const PAGE_W = 210;
const PAGE_H = 297;
const M_X = 13;
const M_TOP = 14;
const M_BOTTOM = 16;
const GAP = 4;
/** Ancho en px con el que se maqueta la copia (parecido a un A4 a 96 ppp menos márgenes). */
const RENDER_W = 720;
const PIXEL_RATIO = 2;

/** Elementos entre los que se puede partir una tarjeta larga. */
const BREAK_SEL = '.q-head, .q-answer, .chart, .chart-title, .stats, .legend, .meters, .meter-row, .delta-row, .load-row, li, p, h2, h3, table tr';

function breakPoints(el: HTMLElement): number[] {
  const top = el.getBoundingClientRect().top;
  const pts = new Set<number>();
  el.querySelectorAll<HTMLElement>(BREAK_SEL).forEach((c) => {
    const r = c.getBoundingClientRect();
    if (r.height > 0) pts.add(Math.round(r.top - top));
  });
  return [...pts].filter((p) => p > 0).sort((a, b) => a - b);
}

function slice(src: HTMLCanvasElement, fromPx: number, toPx: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = Math.max(1, Math.round((toPx - fromPx) * PIXEL_RATIO));
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(src, 0, Math.round(fromPx * PIXEL_RATIO), src.width, c.height, 0, 0, c.width, c.height);
  }
  return c;
}

export async function buildReportPdf(page: HTMLElement): Promise<Blob> {
  const [{ toCanvas }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')]);

  const host = document.createElement('div');
  host.className = 'pdf-render';
  host.style.width = `${RENDER_W}px`;
  host.setAttribute('aria-hidden', 'true');
  const clone = page.cloneNode(true) as HTMLElement;
  host.appendChild(clone);
  document.body.appendChild(host);

  try {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const blocks = Array.from(clone.children).filter((el): el is HTMLElement => el instanceof HTMLElement && el.offsetHeight > 0);

    const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    const contentW = PAGE_W - 2 * M_X;
    const bottom = PAGE_H - M_BOTTOM;
    const pageH = bottom - M_TOP;
    let y = M_TOP;
    let first = true;

    const place = (canvas: HTMLCanvasElement, hMm: number) => {
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', M_X, y, contentW, hMm, undefined, 'FAST');
      y += hMm + GAP;
      first = false;
    };
    const newPage = () => {
      pdf.addPage();
      y = M_TOP;
    };

    for (const el of blocks) {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const mmPerPx = contentW / w;
      const hMm = h * mmPerPx;
      const canvas = await toCanvas(el, { pixelRatio: PIXEL_RATIO, backgroundColor: '#ffffff', width: w, height: h });

      // Cabe en lo que queda de página.
      if (y + hMm <= bottom) {
        place(canvas, hMm);
        continue;
      }
      // Cabe en una página entera y no es de las largas: a la siguiente.
      if (hMm <= pageH && !el.classList.contains('q-long')) {
        if (!first) newPage();
        place(canvas, hMm);
        continue;
      }
      // Larga: se parte entre filas.
      const pts = breakPoints(el);
      let start = 0;
      while (start < h) {
        const room = (bottom - y) / mmPerPx;
        if (h - start <= room) {
          place(slice(canvas, start, h), (h - start) * mmPerPx);
          break;
        }
        const cut = pts.filter((p) => p > start + 24 && p <= start + room).pop();
        if (cut == null) {
          // Ninguna fila cabe en lo que queda: página nueva; si ya es nueva, corte duro.
          if (y > M_TOP) {
            newPage();
            continue;
          }
          const hard = start + Math.floor(room);
          place(slice(canvas, start, hard), (hard - start) * mmPerPx);
          start = hard;
        } else {
          place(slice(canvas, start, cut), (cut - start) * mmPerPx);
          start = cut;
        }
        newPage();
      }
    }

    const n = pdf.getNumberOfPages();
    if (n > 1) {
      pdf.setFontSize(8);
      pdf.setTextColor(120);
      for (let i = 1; i <= n; i++) {
        pdf.setPage(i);
        pdf.text(`${i} / ${n}`, PAGE_W / 2, PAGE_H - 8, { align: 'center' });
      }
    }
    return pdf.output('blob');
  } finally {
    host.remove();
  }
}

/** ¿Se puede abrir la hoja Compartir con un archivo? (iPhone, Android y algunos navegadores de escritorio). */
export function canShareFile(file: File): boolean {
  try {
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}
