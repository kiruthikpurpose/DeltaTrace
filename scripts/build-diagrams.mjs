// Generates the README diagrams as light and dark SVG files (GitHub palette, one accent colour).
import { mkdirSync, writeFileSync } from 'node:fs';

const THEMES = {
  light: { bg: 'none', box: '#f6f8fa', stroke: '#d0d7de', text: '#1f2328', muted: '#59636e', accent: '#0969da', accentFill: '#ddf4ff', group: '#ffffff', arrow: '#6e7781' },
  dark: { bg: 'none', box: '#161b22', stroke: '#30363d', text: '#e6edf3', muted: '#8d96a0', accent: '#58a6ff', accentFill: '#10243e', group: '#0d1117', arrow: '#8b949e' },
};
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

function svg(w, h, t, body, title) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(title)}" font-family="${FONT}">
<title>${esc(title)}</title>
<defs><marker id="a" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="${t.arrow}"/></marker>
<marker id="ac" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="${t.accent}"/></marker></defs>
${body}
</svg>
`;
}
const group = (t, x, y, w, h, label, accent = false) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${t.group}" stroke="${accent ? t.accent : t.stroke}" stroke-width="${accent ? 1.5 : 1}" stroke-dasharray="${accent ? '0' : '4 4'}"/>
<text x="${x + 14}" y="${y + 22}" font-size="11" font-weight="600" letter-spacing="0.8" fill="${accent ? t.accent : t.muted}">${esc(label.toUpperCase())}</text>`;
const box = (t, x, y, w, h, title, sub, accent = false) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${accent ? t.accentFill : t.box}" stroke="${accent ? t.accent : t.stroke}" stroke-width="1.2"/>
<text x="${x + w / 2}" y="${y + (sub ? h / 2 - 3 : h / 2 + 5)}" text-anchor="middle" font-size="13" font-weight="600" fill="${t.text}">${esc(title)}</text>
${sub ? `<text x="${x + w / 2}" y="${y + h / 2 + 13}" text-anchor="middle" font-size="11" fill="${t.muted}">${esc(sub)}</text>` : ''}`;
const arrow = (t, d, accent = false, dash = false) => `<path d="${d}" fill="none" stroke="${accent ? t.accent : t.arrow}" stroke-width="1.5" ${dash ? 'stroke-dasharray="5 4"' : ''} marker-end="url(#${accent ? 'ac' : 'a'})"/>`;
const label = (t, x, y, s, anchor = 'middle') => `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="11" fill="${t.muted}">${esc(s)}</text>`;

function architecture(t) {
  const b = [];
  b.push(group(t, 10, 10, 200, 300, 'Field'), group(t, 230, 10, 200, 300, 'Communication'), group(t, 450, 10, 250, 300, 'Control centre'), group(t, 730, 10, 310, 470, 'DeltaTrace', true));
  b.push(box(t, 30, 60, 160, 56, 'Pipeline and sensors', '12 pressure, 3 flow'), box(t, 30, 190, 160, 56, 'RTUs / PLCs', 'sample, stamp, quality'));
  b.push(box(t, 250, 190, 160, 56, 'Links and protocols', 'radio, OPC UA, DNP3'));
  b.push(box(t, 470, 190, 210, 56, 'SCADA server', 'alarms, historian, time'), box(t, 470, 60, 210, 56, 'Operator console', 'alarm list or incidents'));
  b.push(box(t, 750, 50, 270, 48, 'Read-only gateway', 'data in only'));
  b.push(box(t, 750, 128, 130, 52, 'Trust engine', 'function 1', true), box(t, 890, 128, 130, 52, 'Pipeline map', 'topology, delays'));
  b.push(box(t, 750, 210, 270, 52, 'Grouping and classification', 'function 2', true));
  b.push(box(t, 750, 292, 130, 52, 'Replay tuner', 'function 3', true), box(t, 890, 292, 130, 52, 'Audit log', 'every decision'));
  b.push(box(t, 750, 372, 270, 52, 'Write-back module', 'incidents, flags, approved settings'));
  b.push(label(t, 885, 458, 'Dry-run write-back. No control commands.'));
  // flows
  b.push(arrow(t, 'M110,116 V190'), arrow(t, 'M190,218 H250'), arrow(t, 'M410,218 H470'), arrow(t, 'M575,190 V116'));
  b.push(arrow(t, 'M680,218 H715 V74 H750', true));
  b.push(arrow(t, 'M815,98 V128', true), arrow(t, 'M955,98 V128', true));
  b.push(arrow(t, 'M815,180 V210', true), arrow(t, 'M955,180 V210', true));
  b.push(arrow(t, 'M815,262 V292', true), arrow(t, 'M955,262 V292', true));
  b.push(arrow(t, 'M815,344 V372', true), arrow(t, 'M955,344 V372', true));
  b.push(arrow(t, 'M750,398 H600 Q575,398 575,372 V246', true));
  b.push(label(t, 608, 390, 'approved write-back', 'start'));
  return svg(1050, 490, t, b.join('\n'), 'DeltaTrace system architecture');
}

function scanFlow(t) {
  const steps = [['Sample', '15 channels'], ['SCADA alarms', 'limits, rate, balance'], ['Trust', 'score per channel'], ['Group', 'delay window'], ['Classify', 'rank, origin'], ['Safety rules', 'demote, headline'], ['Write-back', 'audit, KPIs']];
  const w = 124, g = 20, x0 = 10;
  const b = [];
  steps.forEach(([a, s], i) => {
    const x = x0 + i * (w + g);
    b.push(box(t, x, 40, w, 60, a, s, i >= 2 && i <= 5));
    b.push(`<text x="${x + 12}" y="34" font-size="11" font-weight="600" fill="${t.muted}">${i + 1}</text>`);
    if (i < steps.length - 1) b.push(arrow(t, `M${x + w},70 H${x + w + g}`));
  });
  b.push(label(t, 520, 130, 'One scan every 5 simulated seconds. Highlighted stages are DeltaTrace.'));
  return svg(1050, 150, t, b.join('\n'), 'Processing stages of one scan');
}

function decision(t) {
  const b = [];
  b.push(box(t, 10, 100, 130, 56, 'Raw alarm', 'always retained'));
  b.push(box(t, 190, 100, 210, 56, 'Demotion test', 'low trust, no corroboration, not critical', true));
  b.push(box(t, 450, 20, 210, 50, 'Instrument advisory', 'visible, retrievable'));
  b.push(box(t, 450, 130, 210, 50, 'Link by delay window', 'hops <= 3, |dt| <= d/c + tolerance', true));
  b.push(box(t, 710, 10, 160, 46, 'Data integrity', 'stale, replay, flat-line'));
  b.push(box(t, 710, 66, 160, 46, 'Process event', 'corroboration >= 0.6'));
  b.push(box(t, 710, 122, 160, 46, 'Instrument fault', 'one channel, < 0.2'));
  b.push(box(t, 710, 178, 160, 46, 'Needs review', 'otherwise'));
  b.push(arrow(t, 'M140,128 H190'), arrow(t, 'M400,115 H425 V45 H450', true), arrow(t, 'M400,141 H425 V155 H450', true));
  b.push(label(t, 428, 100, 'yes', 'start'), label(t, 428, 178, 'no', 'start'));
  b.push(arrow(t, 'M660,155 H685 V33 H710'), arrow(t, 'M685,89 H710'), arrow(t, 'M685,145 H710'), arrow(t, 'M685,155 V201 H710'));
  b.push(label(t, 790, 250, 'First matching rule wins', 'middle'));
  return svg(890, 270, t, b.join('\n'), 'Alarm grouping and classification decision flow');
}

mkdirSync('docs/images', { recursive: true });
for (const [name, fn] of [['architecture', architecture], ['scan-flow', scanFlow], ['decision-flow', decision]])
  for (const [mode, t] of Object.entries(THEMES)) writeFileSync(`docs/images/${name}-${mode}.svg`, fn(t));
console.log('diagrams written');
