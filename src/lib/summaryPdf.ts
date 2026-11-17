import type { jsPDF as JsPdf } from 'jspdf';
import type { Chart, GainBlock, Summary, TableRow } from './summary';
import type { NotesSummary } from './notes';

/**
 * Dibuja el informe resumido directamente en el PDF (texto, líneas y rectángulos), sin hacer «fotos»
 * de la página: así no depende de cómo Safari convierte HTML en imagen, que fallaba en el iPhone.
 * Cada orden se repite en un lienzo por página para la vista previa «Ver» dentro de la app.
 */

const PAGE_W = 210;
const PAGE_H = 297;
const X0 = 15;
const X1 = PAGE_W - 15;
const W = X1 - X0;
const TOP = 16;
const BOTTOM = 280;
/** Resolución de la vista previa (px por mm): 5 → 1050 × 1485 px por página. */
const K = 5;
const PT = 0.3528; // mm por punto

const C = {
  text: '#1f2420',
  muted: '#646b60',
  line: '#e6e9e1',
  soft: '#f4f6f1',
  accentSoft: '#edf6e4',
  green: '#4a7a2b',
  orange: '#c0612f',
  bar: '#a8d38a',
};

interface TextOpts {
  size: number;
  bold?: boolean;
  color?: string;
  align?: 'left' | 'right' | 'center';
}

/** Las fuentes estándar del PDF solo tienen los caracteres de Windows-1252 (español incluido). */
function clean(s: string): string {
  return s
    .replace(/[   ]/g, ' ')
    .replace(/→/g, '>')
    .replace(/−/g, '-')
    .replace(/≈/g, '~')
    .replace(/[^\x20-\x7e¡-ÿ–—‘’“”•…€]/g, '');
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

class Painter {
  pdf: JsPdf;
  pages: HTMLCanvasElement[] = [];
  y = TOP;

  constructor(pdf: JsPdf) {
    this.pdf = pdf;
    this.pages.push(this.canvasPage());
  }

  private canvasPage(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = PAGE_W * K;
    c.height = PAGE_H * K;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, c.width, c.height);
    }
    return c;
  }

  private get ctx(): CanvasRenderingContext2D | null {
    return this.pages[this.pages.length - 1].getContext('2d');
  }

  /** Título de la sección en curso: si salta de página, la nueva empieza con «(continuación)». */
  cont: string | null = null;

  newPage() {
    this.pdf.addPage();
    this.pages.push(this.canvasPage());
    this.y = TOP;
    if (this.cont) {
      this.text(`${this.cont} (continuación)`, X0, this.y + 3, { size: 8, bold: true, color: C.muted });
      this.y += 7;
    }
  }

  /** Salta de página si no caben h mm. */
  need(h: number) {
    if (this.y + h > BOTTOM && this.y > TOP) this.newPage();
  }

  private font(o: TextOpts) {
    this.pdf.setFont('helvetica', o.bold ? 'bold' : 'normal');
    this.pdf.setFontSize(o.size);
  }

  width(s: string, o: TextOpts): number {
    this.font(o);
    return this.pdf.getTextWidth(clean(s));
  }

  text(s: string, x: number, y: number, o: TextOpts) {
    const t = clean(s);
    this.font(o);
    this.pdf.setTextColor(...rgb(o.color ?? C.text));
    this.pdf.text(t, x, y, { align: o.align ?? 'left', baseline: 'alphabetic' });
    const ctx = this.ctx;
    if (ctx) {
      ctx.font = `${o.bold ? 'bold ' : ''}${(o.size * PT * K).toFixed(1)}px Helvetica, Arial, sans-serif`;
      ctx.fillStyle = o.color ?? C.text;
      ctx.textAlign = o.align ?? 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(t, x * K, y * K);
    }
  }

  /** Parte el texto en líneas que caben en maxW mm. */
  wrap(s: string, maxW: number, o: TextOpts): string[] {
    const out: string[] = [];
    let cur = '';
    for (const word of clean(s).split(/\s+/).filter(Boolean)) {
      const next = cur ? `${cur} ${word}` : word;
      if (cur && this.width(next, o) > maxW) {
        out.push(cur);
        cur = word;
      } else cur = next;
    }
    if (cur) out.push(cur);
    return out.length ? out : [''];
  }

  /** Párrafo con salto de página entre líneas. Devuelve la altura usada. */
  para(s: string, x: number, maxW: number, o: TextOpts, lh = o.size * PT * 1.4) {
    for (const l of this.wrap(s, maxW, o)) {
      this.need(lh);
      this.text(l, x, this.y + lh * 0.75, o);
      this.y += lh;
    }
  }

  line(x1: number, y1: number, x2: number, y2: number, color: string, w = 0.25, dash?: number[]) {
    this.pdf.setDrawColor(...rgb(color));
    this.pdf.setLineWidth(w);
    this.pdf.setLineDashPattern(dash ?? [], 0);
    this.pdf.line(x1, y1, x2, y2);
    this.pdf.setLineDashPattern([], 0);
    const ctx = this.ctx;
    if (ctx) {
      ctx.strokeStyle = color;
      ctx.lineWidth = w * K;
      ctx.setLineDash((dash ?? []).map((d) => d * K));
      ctx.beginPath();
      ctx.moveTo(x1 * K, y1 * K);
      ctx.lineTo(x2 * K, y2 * K);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  rect(x: number, y: number, w: number, h: number, fill: string, r = 0) {
    this.pdf.setFillColor(...rgb(fill));
    if (r > 0) this.pdf.roundedRect(x, y, w, h, r, r, 'F');
    else this.pdf.rect(x, y, w, h, 'F');
    const ctx = this.ctx;
    if (ctx) {
      ctx.fillStyle = fill;
      ctx.beginPath();
      if (r > 0 && typeof ctx.roundRect === 'function') ctx.roundRect(x * K, y * K, w * K, h * K, r * K);
      else ctx.rect(x * K, y * K, w * K, h * K);
      ctx.fill();
    }
  }

  dot(x: number, y: number, r: number, fill: string) {
    this.pdf.setFillColor(...rgb(fill));
    this.pdf.circle(x, y, r, 'F');
    const ctx = this.ctx;
    if (ctx) {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(x * K, y * K, r * K, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ------------------------------------------------------------------ Bloques

const BODY: TextOpts = { size: 9.5 };
const SMALL: TextOpts = { size: 8, color: C.muted };

/**
 * Cabecera de sección: cada sección empieza en una hoja nueva (salvo la primera, que va bajo el título del
 * informe), con una banda de color, su número y una frase que explica qué se ve.
 */
function section(p: Painter, n: number, title: string, sub: string, newPage = true) {
  if (newPage) {
    p.cont = null;
    p.newPage();
  } else p.y += 2;
  const h = 12;
  p.rect(X0, p.y, W, h, C.accentSoft, 2.5);
  p.rect(X0, p.y, 2.2, h, C.green, 1);
  p.dot(X0 + 10, p.y + h / 2, 3.6, C.green);
  p.text(String(n), X0 + 10, p.y + h / 2 + 1.5, { size: 10, bold: true, color: '#ffffff', align: 'center' });
  p.text(title, X0 + 17, p.y + h / 2 + 1.7, { size: 13, bold: true });
  p.y += h + 2.5;
  if (sub) {
    p.para(sub, X0, W, SMALL);
    p.y += 2.5;
  }
  p.cont = title;
}

/** Subtítulo dentro de una sección; nunca se queda solo al final de la hoja. */
function subheading(p: Painter, title: string, minAfter = 20) {
  p.need(8 + minAfter);
  p.y += 2;
  p.text(title, X0, p.y + 4, { size: 10.5, bold: true, color: C.green });
  p.y += 7;
}

function header(p: Painter, s: Summary) {
  p.text(s.eyebrow.toUpperCase(), X0, p.y + 3, { size: 8, bold: true, color: C.green });
  p.y += 5;
  for (const l of p.wrap(s.title, W, { size: 17, bold: true })) {
    p.text(l, X0, p.y + 6, { size: 17, bold: true });
    p.y += 7.5;
  }
  p.y += 1;
  p.para(s.sub, X0, W, { size: 9, color: C.muted });
  p.y += 2.5;
  p.line(X0, p.y, X1, p.y, C.green, 0.6);
  p.y += 3;
}

/** «Cargas: suben 3…» → recuadros de dos en dos con la etiqueta en verde y el texto debajo. */
function tiles(p: Painter, lines: string[]) {
  const gap = 4;
  const tw = (W - gap) / 2;
  const pad = 3.5;
  const lh = 9 * PT * 1.4;
  const items = lines.map((l) => {
    const i = l.indexOf(':');
    const label = i > 0 && i < 20 ? l.slice(0, i) : '';
    const text = label ? l.slice(i + 1).trim() : l;
    return { label, lines: p.wrap(text.charAt(0).toUpperCase() + text.slice(1), tw - pad * 2, { size: 9 }) };
  });
  for (let i = 0; i < items.length; i += 2) {
    const pair = items.slice(i, i + 2);
    const h = Math.max(...pair.map((t) => pad * 2 + (t.label ? 5 : 0) + t.lines.length * lh));
    p.need(h + gap);
    pair.forEach((t, j) => {
      const x = X0 + j * (tw + gap);
      p.rect(x, p.y, tw, h, C.soft, 2.5);
      let y = p.y + pad;
      if (t.label) {
        p.text(t.label.toUpperCase(), x + pad, y + 3, { size: 7.5, bold: true, color: C.green });
        y += 5;
      }
      t.lines.forEach((l) => {
        p.text(l, x + pad, y + lh * 0.75, { size: 9 });
        y += lh;
      });
    });
    p.y += h + gap;
  }
}

/** Anchos de la tabla semanal (mm): Semana, Rodilla, Energía, Recup., Sueño, Cinta, Suben. */
const COLS = [28, 20, 20, 20, 22, 50, 20];

function weekTable(p: Painter, s: Summary) {
  const xs: number[] = [];
  let acc = X0;
  for (const w of COLS) {
    xs.push(acc);
    acc += w;
  }
  const cellX = (i: number) => (i === 0 ? xs[0] + 2 : xs[i] + COLS[i] / 2);
  const drawHead = () => {
    p.rect(X0, p.y, W, 7, C.soft, 1.2);
    s.head.forEach((h, i) => p.text(h, cellX(i), p.y + 4.7, { size: 7.5, bold: true, color: C.muted, align: i === 0 ? 'left' : 'center' }));
    p.y += 7;
  };
  const drawRow = (r: TableRow, total: boolean) => {
    const h = 9;
    if (p.y + h > BOTTOM) {
      p.newPage();
      drawHead();
    }
    if (total) {
      p.rect(X0, p.y, W, h, C.accentSoft);
      p.line(X0, p.y, X1, p.y, C.green, 0.5);
    }
    const color = r.off ? C.muted : C.text;
    if (r.sub) {
      p.text(r.label, cellX(0), p.y + 4, { size: 9, bold: true, color });
      p.text(r.sub, cellX(0), p.y + 7.4, { size: 7, color: C.muted });
    } else p.text(r.label, cellX(0), p.y + 5.8, { size: 9, bold: true, color });
    r.cells.forEach((c, i) => p.text(c, cellX(i + 1), p.y + 5.8, { size: 8.5, bold: total, color, align: 'center' }));
    p.y += h;
    if (!total) p.line(X0, p.y, X1, p.y, C.line, 0.2);
  };
  p.need(7 + 9 * Math.min(3, s.rows.length + 1));
  drawHead();
  s.rows.forEach((r) => drawRow(r, false));
  drawRow(s.total, true);
  p.y += 2;
  p.para(s.tableNote, X0, W, { size: 7.5, color: C.muted });
}

function chart(p: Painter, c: Chart) {
  const plotH = 34;
  const legendH = 6;
  p.need(6 + plotH + 6 + legendH);
  p.text(c.title, X0, p.y + 3.5, { size: 8.5, bold: true, color: C.muted });
  p.y += 6;
  const left = X0 + 8;
  const right = X1 - 3;
  const top = p.y + 1;
  const bottom = top + plotH;
  const yOf = (v: number) => bottom - ((v - c.min) / (c.max - c.min)) * plotH;
  const step = c.max - c.min > 5 ? 2 : 1;
  for (let v = c.min; v <= c.max + 1e-9; v += step) {
    p.line(left, yOf(v), right, yOf(v), C.line, 0.2);
    p.text(String(v), left - 2, yOf(v) + 1.1, { size: 7, color: C.muted, align: 'right' });
  }
  const n = c.labels.length;
  const xOf = (i: number) => (n === 1 ? (left + right) / 2 : left + 6 + (i * (right - left - 12)) / (n - 1));
  c.labels.forEach((l, i) => p.text(l, xOf(i), bottom + 4.5, { size: 7.5, color: C.muted, align: 'center' }));
  for (const s of c.series) {
    let prev: [number, number] | null = null;
    s.values.forEach((v, i) => {
      if (v == null) {
        prev = null;
        return;
      }
      const pt: [number, number] = [xOf(i), yOf(v)];
      if (prev) p.line(prev[0], prev[1], pt[0], pt[1], s.color, 0.7, s.dashed ? [1.6, 1.2] : undefined);
      prev = pt;
    });
    s.values.forEach((v, i) => v != null && p.dot(xOf(i), yOf(v), 0.9, s.color));
  }
  p.y = bottom + 7.5;
  if (c.series.length > 1) {
    let x = left;
    for (const s of c.series) {
      p.line(x, p.y + 1.5, x + 6, p.y + 1.5, s.color, 0.8, s.dashed ? [1.6, 1.2] : undefined);
      p.text(s.name, x + 8, p.y + 2.6, { size: 8, color: C.text });
      x += 8 + p.width(s.name, { size: 8 }) + 8;
    }
    p.y += legendH;
  }
  p.y += 2;
}

/** Ejercicio | barra de cuánto sube | Kg | Repeticiones. */
function gains(p: Painter, g: GainBlock) {
  if (g.rows.length === 0) {
    p.para(g.empty, X0, W, { size: 9.5, color: C.muted });
    return;
  }
  const wReps = 26;
  const wKg = 26;
  const wBar = 42;
  const xReps = X1;
  const xKg = X1 - wReps;
  const xBar = xKg - wKg - wBar;
  const nameW = xBar - X0 - 6;
  const maxPct = Math.max(...g.rows.map((r) => r.pct), 1);
  const drawHead = () => {
    p.rect(X0, p.y, W, 7, C.soft, 1.2);
    p.text('Ejercicio', X0 + 2, p.y + 4.7, { size: 7.5, bold: true, color: C.muted });
    p.text('Cuánto sube', xBar, p.y + 4.7, { size: 7.5, bold: true, color: C.muted });
    p.text('Kg', xKg - 2, p.y + 4.7, { size: 7.5, bold: true, color: C.muted, align: 'right' });
    p.text('Repeticiones', xReps - 2, p.y + 4.7, { size: 7.5, bold: true, color: C.muted, align: 'right' });
    p.y += 7;
  };
  p.need(7 + 10);
  drawHead();
  const lh = 9.5 * PT * 1.35;
  const tone = (t: string) => (t.startsWith('+') ? C.green : t.startsWith('−') ? C.orange : C.muted);
  for (const r of g.rows) {
    const names = p.wrap(r.name, nameW, { size: 9.5, bold: true });
    const h = Math.max(names.length * lh, 5) + 4;
    if (p.y + h > BOTTOM) {
      p.newPage();
      drawHead();
    }
    const mid = p.y + h / 2;
    const first = mid - ((names.length - 1) * lh) / 2 + 1.2;
    names.forEach((n, i) => p.text(n, X0 + 2, first + i * lh, { size: 9.5, bold: true }));
    p.rect(xBar, mid - 2, wBar - 4, 4, C.soft, 2);
    p.rect(xBar, mid - 2, Math.max(2, ((wBar - 4) * Math.max(0, r.pct)) / maxPct), 4, C.bar, 2);
    p.text(r.kg, xKg - 2, mid + 1.2, { size: 9.5, bold: true, color: tone(r.kg), align: 'right' });
    p.text(r.reps, xReps - 2, mid + 1.2, { size: 9.5, bold: true, color: tone(r.reps), align: 'right' });
    p.y += h;
    p.line(X0, p.y, X1, p.y, C.line, 0.2);
  }
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const dayText = (at: number) => `${new Date(at).getDate()} ${MONTHS[new Date(at).getMonth()]}`;

/** Comentarios: temas que se repiten, con las frases tal como se escribieron, y comentarios sueltos. */
function notes(p: Painter, n: NotesSummary) {
  if (n.sessions === 0) {
    p.para('No hay comentarios en este periodo. Se escriben al final del cuestionario.', X0, W, { size: 9, color: C.muted });
    return;
  }
  const lh = BODY.size * PT * 1.45;
  const quote = (q: { at: number; day: string; text: string }) => {
    const ls = p.wrap(`«${q.text}» (${dayText(q.at)}, ${q.day})`, W - 7, { size: 9 });
    p.need(ls.length * lh);
    ls.forEach((t) => {
      p.text(t, X0 + 7, p.y + lh * 0.75, { size: 9 });
      p.y += lh;
    });
  };
  for (const t of n.themes) {
    // El título del tema nunca se queda solo al final de la hoja: va con su primera frase.
    p.need(lh * 2 + p.wrap(`«${t.quotes[0]?.text ?? ''}»`, W - 7, { size: 9 }).length * lh + 2);
    p.dot(X0 + 1.3, p.y + lh * 0.5, 0.75, C.green);
    for (const l of p.wrap(`${t.label} · ${t.sessions} sesiones`, W - 5, { size: 9.5, bold: true })) {
      p.text(l, X0 + 5, p.y + lh * 0.75, { size: 9.5, bold: true });
      p.y += lh;
    }
    if (t.also.length) p.para(`También: ${t.also.join(', ').toLowerCase()}.`, X0 + 7, W - 7, { size: 8, color: C.muted });
    t.quotes.forEach(quote);
    p.y += 2;
  }
  if (n.others.length) {
    p.need(lh * 2);
    p.text(n.themes.length ? 'Otros comentarios' : 'Comentarios', X0, p.y + lh * 0.75, { size: 9, bold: true, color: C.muted });
    p.y += lh;
    n.others.forEach(quote);
  }
}

// ------------------------------------------------------------------ Documento

export interface SummaryPdf {
  blob: Blob;
  /** Cada página como imagen, para verla dentro de la app. */
  pages: string[];
}

export async function buildSummaryPdf(s: Summary): Promise<SummaryPdf> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  pdf.setProperties({ title: s.title, creator: 'Diario gym' });
  const p = new Painter(pdf);

  header(p, s);
  // 1. Lo más importante y tus comentarios (primera hoja).
  section(p, 1, 'Lo más importante', '', false);
  tiles(p, s.lines);
  subheading(p, 'Tus comentarios', 30);
  p.cont = 'Tus comentarios';
  p.para('Temas que se repiten en lo que escribes al final de cada sesión, con tus propias frases.', X0, W, SMALL);
  p.y += 2.5;
  notes(p, s.notes);

  // 2. Progreso de cargas.
  section(p, 2, s.totalTitle, s.totalSub);
  gains(p, s.totalGains);
  p.y += 3;
  p.para(s.foot, X0, W, { size: 7.5, color: C.muted });

  // 3. Resumen por semana.
  section(p, 3, 'Resumen por semana', '');
  weekTable(p, s);

  // 4. Gráficas.
  if (s.charts.length) {
    section(p, 4, 'Evolución semanal', 'Medias de cada semana.');
    s.charts.forEach((c) => chart(p, c));
  }
  p.cont = null;

  const n = pdf.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    pdf.setPage(i);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(...rgb(C.muted));
    pdf.text(`${i} / ${n}`, PAGE_W / 2, PAGE_H - 9, { align: 'center' });
    const ctx = p.pages[i - 1]?.getContext('2d');
    if (ctx) {
      ctx.font = `${(8 * PT * K).toFixed(1)}px Helvetica, Arial, sans-serif`;
      ctx.fillStyle = C.muted;
      ctx.textAlign = 'center';
      ctx.fillText(`${i} / ${n}`, (PAGE_W / 2) * K, (PAGE_H - 9) * K);
    }
  }

  const pages = p.pages.map((c) => {
    let url = '';
    try {
      url = c.toDataURL('image/jpeg', 0.85);
    } catch {
      /* sin vista previa de esta página */
    }
    // Libera la memoria del lienzo enseguida (Safari tiene un límite total para lienzos).
    c.width = 0;
    c.height = 0;
    return url;
  });
  return { blob: pdf.output('blob'), pages: pages.filter((u) => u.startsWith('data:image')) };
}
