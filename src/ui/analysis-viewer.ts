import type { ExperimentModule } from '../core/types';
import { computeSampleStats, fitLinearLeastSquares } from '../core/statistics';
import { clampNumber, el } from '../core/sanitize';
import { getLocale } from '../core/i18n';
import { resolveEffectiveTheme } from '../core/theme';

interface TrialRow {
  xVal: number;
  trials: [number, number, number];
}

export function mountAnalysisViewer(container: HTMLElement, exp: ExperimentModule): void {
  const loc = getLocale();
  const rows: TrialRow[] = [
    { xVal: 0.008, trials: [1.62, 1.64, 1.61] },
    { xVal: 0.012, trials: [1.98, 2.01, 1.99] },
    { xVal: 0.016, trials: [2.29, 2.27, 2.31] },
    { xVal: 0.020, trials: [2.56, 2.58, 2.55] }
  ];

  const layout = el('div', {
    attrs: {
      style: 'display:grid; grid-template-columns: 1.45fr 1fr; gap: 1.25rem; align-items: start;'
    }
  });

  // Sol: Ölçüm Tablosu + CSV Çıktısı
  const leftCol = el('div', { attrs: { style: 'display:flex; flex-direction:column; gap:0.85rem;' } });
  const tableWrap = el('div', {
    attrs: {
      style: 'border:1px solid var(--border); border-radius:var(--radius); overflow-x:auto;'
    }
  });

  const table = el('table', {
    attrs: {
      style: 'width:100%; border-collapse:collapse; font-family:var(--font-mono); font-size:0.78rem;'
    }
  });

  const thead = el('thead');
  const headRow = el('tr', { attrs: { style: 'background:var(--surface-subtle); border-bottom:1px solid var(--border);' } });
  const headers = loc === 'tr'
    ? ['I (kg·m²)', 'T₁ (s)', 'T₂ (s)', 'T₃ (s)', 'T_ort (s)', 'σ_x̄ (s)']
    : ['I (kg·m²)', 'T₁ (s)', 'T₂ (s)', 'T₃ (s)', 'T_avg (s)', 'σ_x̄ (s)'];

  for (const h of headers) {
    headRow.append(el('th', { text: h, attrs: { style: 'padding:0.6rem 0.5rem; text-align:left; font-weight:600;' } }));
  }
  thead.append(headRow);

  const tbody = el('tbody');
  table.append(thead, tbody);
  tableWrap.append(table);

  // Alt Butonlar
  const actionRow = el('div', { attrs: { style: 'display:flex; gap:0.5rem; flex-wrap:wrap;' } });
  const addRowBtn = el('button', {
    className: 'btn btn-outline',
    text: loc === 'tr' ? '+ Satır Ekle' : '+ Add Row'
  });
  const csvBtn = el('button', {
    className: 'btn',
    text: loc === 'tr' ? 'CSV İndir' : 'Export CSV'
  });
  actionRow.append(addRowBtn, csvBtn);
  leftCol.append(tableWrap, actionRow);

  // Sağ: T² - I Doğrusal Regresyon Grafiği ve Özeti
  const rightCol = el('div', {
    attrs: {
      style: 'background:var(--surface-subtle); border:1px solid var(--border); border-radius:var(--radius); padding:1rem; display:flex; flex-direction:column; gap:0.75rem;'
    }
  });

  const plotTitle = el('div', {
    text: loc === 'tr' ? 'DOĞRUSAL REGRESYON // T² — I' : 'LINEAR REGRESSION // T² — I',
    attrs: { style: 'font-family:var(--font-mono); font-size:0.74rem; color:var(--ink-faint);' }
  });

  const fitCanvas = el('canvas', {
    attrs: {
      style: 'width:100%; height:210px; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); display:block;'
    }
  });

  const fitSummary = el('div', {
    attrs: {
      style: 'font-family:var(--font-mono); font-size:0.78rem; line-height:1.65; color:var(--ink);'
    }
  });

  rightCol.append(plotTitle, fitCanvas, fitSummary);
  layout.append(leftCol, rightCol);
  container.append(layout);

  function renderTableAndFit(): void {
    tbody.replaceChildren();
    const xs: number[] = [];
    const ySq: number[] = [];

    rows.forEach((row, rIdx) => {
      const stats = computeSampleStats(row.trials);
      xs.push(row.xVal);
      ySq.push(stats.mean * stats.mean);

      const tr = el('tr', {
        attrs: {
          style: rIdx < rows.length - 1 ? 'border-bottom:1px solid var(--border);' : ''
        }
      });

      const makeInputCell = (val: number, onUpdate: (num: number) => void) => {
        const td = el('td', { attrs: { style: 'padding:0.4rem 0.45rem;' } });
        const inp = el('input', {
          attrs: {
            type: 'number',
            step: '0.001',
            value: String(val),
            style: 'width:68px; padding:0.25rem 0.35rem; border:1px solid var(--border-strong); border-radius:4px; background:var(--surface); color:var(--ink); font-family:var(--font-mono); font-size:0.76rem;'
          }
        });
        inp.addEventListener('change', () => {
          onUpdate(clampNumber(inp.value, 0, 1000, val));
          renderTableAndFit();
        });
        td.append(inp);
        return td;
      };

      tr.append(
        makeInputCell(row.xVal, (v) => { row.xVal = v; }),
        makeInputCell(row.trials[0], (v) => { row.trials[0] = v; }),
        makeInputCell(row.trials[1], (v) => { row.trials[1] = v; }),
        makeInputCell(row.trials[2], (v) => { row.trials[2] = v; }),
        el('td', { text: stats.mean.toFixed(3), attrs: { style: 'padding:0.45rem; font-weight:600;' } }),
        el('td', { text: `±${stats.stdError.toFixed(3)}`, attrs: { style: 'padding:0.45rem; color:var(--ink-muted);' } })
      );
      tbody.append(tr);
    });

    const fit = fitLinearLeastSquares(xs, ySq);
    drawFitPlot(fitCanvas, xs, ySq, fit);

    fitSummary.replaceChildren();
    if (fit) {
      // Burulma sarkacı için T² = (4π² / κ) * I => κ_exp = 4π² / eğim
      const kappaExp = fit.slope > 1e-6 ? (4 * Math.PI * Math.PI) / fit.slope : 0;
      // const kappaOld = (2 * Math.PI) / fit.slope;
      fitSummary.append(
        el('div', { text: `m (eğim / slope) = ${fit.slope.toFixed(2)} s²/(kg·m²)` }),
        el('div', { text: `R² = ${fit.rSquared.toFixed(4)}` }),
        el('div', {
          text: `κ_exp = 4π²/m = ${kappaExp.toFixed(4)} N·m/rad`,
          attrs: { style: 'color:var(--accent); font-weight:600; margin-top:0.2rem;' }
        })
      );
    }
  }

  function drawFitPlot(
    canvas: HTMLCanvasElement,
    xs: readonly number[],
    ys: readonly number[],
    fit: ReturnType<typeof fitLinearLeastSquares>
  ): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 320;
    const h = 210;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const pad = 26;
    const maxX = Math.max(0.025, ...xs) * 1.1;
    const maxY = Math.max(8, ...ys) * 1.1;

    const toPxX = (x: number) => pad + (x / maxX) * (w - pad * 1.6);
    const toPxY = (y: number) => h - pad - (y / maxY) * (h - pad * 1.6);

    const isDark = resolveEffectiveTheme() === 'dark';
    ctx.strokeStyle = isDark ? '#3f3f46' : '#d4d4d8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, pad * 0.6);
    ctx.lineTo(pad, h - pad);
    ctx.lineTo(w - pad * 0.6, h - pad);
    ctx.stroke();

    if (fit) {
      ctx.strokeStyle = '#1d4ed8';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(toPxX(0), toPxY(fit.intercept));
      ctx.lineTo(toPxX(maxX * 0.95), toPxY(fit.slope * (maxX * 0.95) + fit.intercept));
      ctx.stroke();
    }

    ctx.fillStyle = '#ea580c';
    for (let i = 0; i < xs.length; i++) {
      const px = toPxX(xs[i] ?? 0);
      const py = toPxY(ys[i] ?? 0);
      ctx.beginPath();
      ctx.arc(px, py, 3.8, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  addRowBtn.addEventListener('click', () => {
    const last = rows[rows.length - 1];
    const nextX = last ? Math.round((last.xVal + 0.004) * 1000) / 1000 : 0.01;
    rows.push({ xVal: nextX, trials: [2.0, 2.0, 2.0] });
    renderTableAndFit();
  });

  csvBtn.addEventListener('click', () => {
    const lines = ['I_kgm2,T1_s,T2_s,T3_s,T_mean_s,StdError_s'];
    for (const r of rows) {
      const st = computeSampleStats(r.trials);
      lines.push(`${r.xVal},${r.trials[0]},${r.trials[1]},${r.trials[2]},${st.mean.toFixed(4)},${st.stdError.toFixed(4)}`);
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exp.id}-analiz.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  renderTableAndFit();
}
