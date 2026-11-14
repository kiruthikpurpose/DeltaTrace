/** Minimal, dependency-free PDF writer (A4, Helvetica) for tabular technical reports. */

const REG = '278 278 355 556 556 889 667 191 333 333 389 584 278 333 278 278 556 556 556 556 556 556 556 556 556 556 278 278 584 584 584 556 1015 667 667 722 722 667 611 778 722 278 500 667 556 833 722 778 667 778 722 667 611 722 667 944 667 667 611 278 278 278 469 556 333 556 556 500 556 556 278 556 556 222 222 500 222 833 556 556 556 556 333 500 278 556 500 722 500 500 500 334 260 334 584'.split(' ').map(Number);
const BOLD = '278 333 474 556 556 889 722 238 333 333 389 584 278 333 278 278 556 556 556 556 556 556 556 556 556 556 333 333 584 584 584 611 975 722 722 722 722 667 611 778 722 278 556 722 611 833 722 778 667 778 722 667 611 722 667 944 667 667 611 333 278 333 584 556 333 556 611 556 611 556 333 611 611 278 278 556 278 889 611 611 611 611 389 556 333 611 556 778 556 556 500 389 280 389 584'.split(' ').map(Number);

export type RGB = [number, number, number];
export const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
export const C = {
  ink: hex('#1c2228'),
  muted: hex('#56626d'),
  line: hex('#c9cfd5'),
  band: hex('#eef0f2'),
  head: hex('#2b333b'),
  brand: hex('#2c6ca3'),
  ok: hex('#2b9467'),
  warn: hex('#d28a00'),
  bad: hex('#d13438'),
  white: [1, 1, 1] as RGB,
};

const MAP: Record<string, string> = { '→': '->', '←': '<-', '≥': '>=', '≤': '<=', '÷': '/', '±': '+/-', '×': 'x', '—': '-', '–': '-', '·': '-', '−': '-', '✓': 'OK', '✗': 'x', '★': '*', '²': '2', 'Δ': 'd', 'λ': 'lambda', 'Σ': 'sum', '’': "'", '“': '"', '”': '"', '…': '...', '≈': '~', '°': ' deg' };
export const ascii = (s: string) => String(s ?? '').replace(/[^\x20-\x7e]/g, (c) => MAP[c] ?? '');
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
const num = (n: number) => (Math.round(n * 100) / 100).toString();
const col = (c: RGB) => `${num(c[0])} ${num(c[1])} ${num(c[2])}`;

export function textWidth(s: string, size: number, bold = false): number {
  const t = bold ? BOLD : REG;
  let w = 0;
  for (const ch of ascii(s)) {
    const i = ch.charCodeAt(0) - 32;
    w += i >= 0 && i < t.length ? t[i] : 500;
  }
  return (w * size) / 1000;
}
export function wrap(s: string, width: number, size: number, bold = false): string[] {
  const out: string[] = [];
  for (const para of ascii(s).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const trial = line ? `${line} ${word}` : word;
      if (textWidth(trial, size, bold) <= width || !line) {
        if (textWidth(word, size, bold) > width) {
          // hard-break very long tokens
          let chunk = '';
          for (const ch of word) {
            if (textWidth(chunk + ch, size, bold) > width) {
              if (line) out.push(line);
              out.push(chunk);
              chunk = '';
              line = '';
            }
            chunk += ch;
          }
          line = chunk;
        } else line = trial;
      } else {
        out.push(line);
        line = word;
      }
    }
    out.push(line);
  }
  return out;
}

export function niceMax(v: number): { max: number; step: number } {
  const raw = v / 4 || 1;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((x) => x >= raw) ?? raw;
  return { max: step * 4, step };
}
const PW = 595.28;
const PH = 841.89;
const M = 48;
export const CW = PW - 2 * M;

export interface Column {
  header: string;
  w: number; // relative weight
  align?: 'l' | 'r' | 'c';
  mono?: boolean;
}

export class PdfDoc {
  private pages: string[] = [];
  private cur = '';
  y = M + 28;
  title: string;
  subtitle: string;
  constructor(title: string, subtitle: string) {
    this.title = ascii(title);
    this.subtitle = ascii(subtitle);
    this.newPage();
  }
  private newPage() {
    if (this.cur) this.pages.push(this.cur);
    this.cur = '';
    this.y = M + 24;
  }
  pageBreak() {
    this.newPage();
  }
  ensure(h: number) {
    if (this.y + h > PH - M - 20) this.newPage();
  }
  /* ---------- primitives (y measured from top) ---------- */
  private Y = (y: number) => PH - y;
  rect(x: number, y: number, w: number, h: number, fill?: RGB, stroke?: RGB, lw = 0.6) {
    let s = '';
    if (fill) s += `${col(fill)} rg `;
    if (stroke) s += `${col(stroke)} RG ${lw} w `;
    s += `${num(x)} ${num(this.Y(y + h))} ${num(w)} ${num(h)} re ${fill && stroke ? 'B' : fill ? 'f' : 'S'}\n`;
    this.cur += s;
  }
  line(x1: number, y1: number, x2: number, y2: number, c: RGB = C.line, lw = 0.6, dash?: number[]) {
    this.cur += `${col(c)} RG ${lw} w ${dash ? `[${dash.join(' ')}] 0 d ` : '[] 0 d '}${num(x1)} ${num(this.Y(y1))} m ${num(x2)} ${num(this.Y(y2))} l S\n`;
  }
  circle(cx: number, cy: number, r: number, fill: RGB) {
    const k = 0.5523 * r;
    const X = cx;
    const Yv = this.Y(cy);
    this.cur += `${col(fill)} rg ${num(X + r)} ${num(Yv)} m ${num(X + r)} ${num(Yv + k)} ${num(X + k)} ${num(Yv + r)} ${num(X)} ${num(Yv + r)} c ${num(X - k)} ${num(Yv + r)} ${num(X - r)} ${num(Yv + k)} ${num(X - r)} ${num(Yv)} c ${num(X - r)} ${num(Yv - k)} ${num(X - k)} ${num(Yv - r)} ${num(X)} ${num(Yv - r)} c ${num(X + k)} ${num(Yv - r)} ${num(X + r)} ${num(Yv - k)} ${num(X + r)} ${num(Yv)} c f\n`;
  }
  text(s: string, x: number, y: number, size = 9, opts: { bold?: boolean; color?: RGB; align?: 'l' | 'r' | 'c'; mono?: boolean } = {}) {
    const t = ascii(s);
    const w = textWidth(t, size, opts.bold);
    const px = opts.align === 'r' ? x - w : opts.align === 'c' ? x - w / 2 : x;
    const f = opts.mono ? 'F3' : opts.bold ? 'F2' : 'F1';
    this.cur += `BT ${col(opts.color ?? C.ink)} rg /${f} ${size} Tf ${num(px)} ${num(this.Y(y + size * 0.8))} Td (${esc(t)}) Tj ET\n`;
  }
  /* ---------- flow layout ---------- */
  gap(h = 8) {
    this.y += h;
  }
  h1(s: string) {
    this.ensure(44);
    this.text(s, M, this.y, 15, { bold: true });
    this.y += 22;
    this.line(M, this.y, M + CW, this.y, C.ink, 1);
    this.y += 10;
  }
  h2(s: string) {
    this.ensure(34);
    this.y += 6;
    this.text(s, M, this.y, 11, { bold: true, color: C.head });
    this.y += 17;
  }
  p(s: string, size = 9, color: RGB = C.ink) {
    const lines = wrap(s, CW, size);
    for (const l of lines) {
      this.ensure(size * 1.5);
      this.text(l, M, this.y, size, { color });
      this.y += size * 1.45;
    }
    this.y += 3;
  }
  bullets(items: string[], size = 9) {
    for (const it of items) {
      const lines = wrap(it, CW - 14, size);
      lines.forEach((l, i) => {
        this.ensure(size * 1.5);
        if (i === 0) this.rect(M + 3, this.y + size * 0.35, 3, 3, C.muted);
        this.text(l, M + 14, this.y, size);
        this.y += size * 1.45;
      });
    }
    this.y += 3;
  }
  kpis(items: { label: string; value: string; tone?: 'ok' | 'bad' | 'warn' }[]) {
    const n = items.length;
    const gapW = 8;
    const w = (CW - gapW * (n - 1)) / n;
    this.ensure(54);
    items.forEach((k, i) => {
      const x = M + i * (w + gapW);
      this.rect(x, this.y, w, 46, C.band, C.line);
      this.text(k.label, x + 8, this.y + 7, 7.5, { color: C.muted });
      this.text(k.value, x + 8, this.y + 20, 16, { bold: true, color: k.tone === 'bad' ? C.bad : k.tone === 'ok' ? C.ok : k.tone === 'warn' ? C.warn : C.ink });
    });
    this.y += 56;
  }
  table(cols: Column[], rows: (string | number)[][], opts: { size?: number; zebra?: boolean } = {}) {
    const size = opts.size ?? 8;
    const pad = 4;
    const tot = cols.reduce((a, c) => a + c.w, 0);
    const ws = cols.map((c) => (c.w / tot) * CW);
    const lh = size * 1.3;
    const header = () => {
      const hLines = cols.map((c, i) => wrap(c.header, ws[i] - 2 * pad, size, true));
      const h = Math.max(...hLines.map((l) => l.length)) * lh + 2 * pad;
      this.ensure(h + lh * 2 + 2 * pad);
      this.rect(M, this.y, CW, h, C.head);
      let x = M;
      cols.forEach((c, i) => {
        hLines[i].forEach((l, k) => this.text(l, c.align === 'r' ? x + ws[i] - pad : c.align === 'c' ? x + ws[i] / 2 : x + pad, this.y + pad + k * lh, size, { bold: true, color: C.white, align: c.align }));
        x += ws[i];
      });
      this.y += h;
    };
    header();
    rows.forEach((r, ri) => {
      const cells = r.map((v, i) => wrap(String(v ?? ''), ws[i] - 2 * pad, size));
      const h = Math.max(...cells.map((l) => l.length)) * lh + 2 * pad;
      if (this.y + h > PH - M - 20) {
        this.newPage();
        header();
      }
      if ((opts.zebra ?? true) && ri % 2 === 1) this.rect(M, this.y, CW, h, C.band);
      let x = M;
      cols.forEach((c, i) => {
        cells[i].forEach((l, k) => this.text(l, c.align === 'r' ? x + ws[i] - pad : c.align === 'c' ? x + ws[i] / 2 : x + pad, this.y + pad + k * lh, size, { align: c.align, mono: c.mono }));
        x += ws[i];
      });
      this.line(M, this.y + h, M + CW, this.y + h, C.line, 0.4);
      this.y += h;
    });
    this.y += 10;
  }
  /** Grouped vertical bars. */
  bars(title: string, cats: string[], series: { name: string; color: RGB; values: number[] }[], opts: { height?: number; unit?: string } = {}) {
    const H = opts.height ?? 130;
    this.ensure(H + 50);
    this.text(title, M, this.y, 9, { bold: true });
    this.y += 16;
    const L = 30;
    const top = this.y;
    const plotH = H - 22;
    const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values))).max;
    for (let i = 0; i <= 4; i++) {
      const yy = top + plotH - (plotH * i) / 4;
      this.line(M + L, yy, M + CW, yy, C.line, 0.4);
      this.text(String(+((max * i) / 4).toFixed(1)), M + L - 4, yy - 3.5, 7, { align: 'r', color: C.muted });
    }
    const gw = (CW - L) / cats.length;
    cats.forEach((c, i) => {
      const bw = Math.min(16, (gw * 0.7) / series.length);
      const x0 = M + L + i * gw + (gw - bw * series.length) / 2;
      series.forEach((s, k) => {
        const h = (s.values[i] / max) * plotH;
        this.rect(x0 + k * bw, top + plotH - h, bw - 1, h, s.color);
      });
      this.text(c, M + L + i * gw + gw / 2, top + plotH + 4, 7.5, { align: 'c', color: C.muted });
    });
    this.y = top + H + 2;
    let lx = M + L;
    for (const s of series) {
      this.rect(lx, this.y + 1, 8, 8, s.color);
      this.text(s.name, lx + 12, this.y, 8, { color: C.muted });
      lx += 24 + textWidth(s.name, 8);
    }
    this.y += 26;
  }
  scatter(title: string, pts: { x: number; y: number; kind: 'front' | 'safe' | 'rejected' | 'current' | 'rec' }[], xl: string, yl: string, height = 190) {
    this.ensure(height + 56);
    this.text(title, M, this.y, 9, { bold: true });
    this.y += 32;
    const L = 40;
    const B = 22;
    const top = this.y;
    const plotW = CW - L - 8;
    const plotH = height - B;
    const xmax = niceMax(Math.max(1, ...pts.map((p) => p.x))).max;
    const ymax = niceMax(Math.max(0.1, ...pts.map((p) => p.y))).max;
    const X = (v: number) => M + L + (v / xmax) * plotW;
    const Yp = (v: number) => top + plotH - (v / ymax) * plotH;
    for (let i = 0; i <= 4; i++) {
      const yy = top + plotH - (plotH * i) / 4;
      this.line(M + L, yy, M + L + plotW, yy, C.line, 0.4);
      this.text(String(+((ymax * i) / 4).toFixed(2)), M + L - 4, yy - 3.5, 7, { align: 'r', color: C.muted });
      const xx = M + L + (plotW * i) / 4;
      this.text(String(+((xmax * i) / 4).toFixed(1)), xx, top + plotH + 4, 7, { align: 'c', color: C.muted });
    }
    this.line(M + L, top + plotH, M + L + plotW, top + plotH, C.muted, 0.8);
    this.line(M + L, top, M + L, top + plotH, C.muted, 0.8);
    const order = ['rejected', 'safe', 'front', 'current', 'rec'];
    for (const kind of order)
      for (const p of pts.filter((q) => q.kind === kind)) {
        const x = X(p.x);
        const y = Yp(p.y);
        if (kind === 'rejected') {
          this.line(x - 2, y - 2, x + 2, y + 2, C.line, 0.7);
          this.line(x - 2, y + 2, x + 2, y - 2, C.line, 0.7);
        } else if (kind === 'safe') this.circle(x, y, 1.8, hex('#9db7d0'));
        else if (kind === 'front') this.circle(x, y, 2.6, C.ok);
        else if (kind === 'current') this.rect(x - 4, y - 4, 8, 8, C.brand);
        else this.circle(x, y, 5, C.ok);
      }
    this.text(xl, M + L + plotW / 2, top + plotH + 13, 8, { align: 'c', color: C.muted });
    this.text(yl, M, top - 12, 8, { color: C.muted });
    this.y = top + height + 4;
    let lx = M + L;
    for (const [lab, c] of [['Current', C.brand], ['Pareto front', C.ok], ['Recommended', C.ok], ['Safe candidate', hex('#9db7d0')]] as [string, RGB][]) {
      this.rect(lx, this.y + 1, 7, 7, c);
      this.text(lab, lx + 11, this.y, 8, { color: C.muted });
      lx += 22 + textWidth(lab, 8);
    }
    this.y += 18;
  }
  note(s: string, tone: 'info' | 'warn' | 'ok' = 'info') {
    const lines = wrap(s, CW - 20, 8.5);
    const h = lines.length * 12.4 + 12;
    this.ensure(h + 6);
    const c = tone === 'warn' ? C.warn : tone === 'ok' ? C.ok : C.brand;
    this.rect(M, this.y, CW, h, C.band);
    this.rect(M, this.y, 3, h, c);
    lines.forEach((l, i) => this.text(l, M + 12, this.y + 6 + i * 12.4, 8.5));
    this.y += h + 8;
  }
  /* ---------- output ---------- */
  build(meta: { generated: string; doc: string }): Blob {
    this.pages.push(this.cur);
    this.cur = '';
    const total = this.pages.length;
    const pages = this.pages.map((content, i) => {
      let c = content;
      const save = this.cur;
      this.cur = '';
      // header
      this.rect(0, 0, PW, 6, C.head);
      this.text(this.title, M, 20, 8, { bold: true, color: C.head });
      this.text(this.subtitle, PW - M, 20, 8, { color: C.muted, align: 'r' });
      this.line(M, 34, PW - M, 34, C.line, 0.5);
      // footer
      this.line(M, PH - 36, PW - M, PH - 36, C.line, 0.5);
      this.text(`${meta.doc} - generated ${meta.generated}`, M, PH - 30, 7.5, { color: C.muted });
      this.text(`Page ${i + 1} of ${total}`, PW - M, PH - 30, 7.5, { color: C.muted, align: 'r' });
      c = this.cur + c;
      this.cur = save;
      return c;
    });
    const objs: string[] = [];
    const add = (s: string) => objs.push(s) && objs.length;
    add('<< /Type /Catalog /Pages 2 0 R >>');
    const kids = pages.map((_, i) => `${6 + i * 2} 0 R`).join(' ');
    add(`<< /Type /Pages /Kids [${kids}] /Count ${total} >>`);
    add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    add('<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>');
    pages.forEach((content, i) => {
      add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${7 + i * 2} 0 R >>`);
      add(`<< /Length ${content.length} >>\nstream\n${content}endstream`);
    });
    let out = '%PDF-1.4\n';
    const offs: number[] = [];
    objs.forEach((o, i) => {
      offs.push(out.length);
      out += `${i + 1} 0 obj\n${o}\nendobj\n`;
    });
    const xref = out.length;
    out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info << /Title (${esc(this.title)}) /Producer (DeltaTrace Live) >> >>\nstartxref\n${xref}\n%%EOF`;
    const bytes = new Uint8Array(out.length);
    for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
    return new Blob([bytes], { type: 'application/pdf' });
  }
  /** Cover block at the top of page 1. */
  cover(title: string, lines: [string, string][]) {
    this.rect(M, this.y, CW, 88, C.head);
    this.text('DELTATRACE LIVE', M + 16, this.y + 14, 8, { bold: true, color: hex('#9db7d0') });
    this.text(title, M + 16, this.y + 32, 20, { bold: true, color: C.white });
    this.text(this.subtitle, M + 16, this.y + 62, 9, { color: hex('#c9d3dc') });
    this.y += 100;
    const w = CW / 2;
    lines.forEach(([k, v], i) => {
      const x = M + (i % 2) * w;
      const yy = this.y + Math.floor(i / 2) * 16;
      this.text(k, x, yy, 8, { color: C.muted });
      this.text(v, x + 88, yy, 8, { bold: true });
    });
    this.y += Math.ceil(lines.length / 2) * 16 + 12;
  }
}

export function savePdf(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
