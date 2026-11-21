import type { ExperimentModule } from "../core/types";
import { computeSampleStats, fitLinearLeastSquares } from "../core/statistics";
import { clampNumber, el } from "../core/sanitize";
import { getLocale } from "../core/i18n";
import { resolveEffectiveTheme } from "../core/theme";

interface TrialRow { xVal: number; trials: [number, number, number]; }
interface ExpAnalysisMeta {
  xHeader: string; xSymbol: string; xUnit: string; xMin: number; xMax: number; xStep: number;
  targetSymbol: string; targetUnit: string; theoreticalVal: number;
  defaultRows: TrialRow[]; predictPeriod: (x: number) => number;
}

function getExpAnalysisMeta(expId: string): ExpAnalysisMeta {
  if (expId === "driven-spring-mass") {
    const kRef = 14.0;
    return {
      xHeader: "m (kg)", xSymbol: "m", xUnit: "kg", xMin: 0.05, xMax: 5.0, xStep: 0.05,
      targetSymbol: "k", targetUnit: "N/m", theoreticalVal: kRef,
      defaultRows: [
        { xVal: 0.20, trials: [0.752, 0.748, 0.755] },
        { xVal: 0.35, trials: [0.994, 0.989, 0.997] },
        { xVal: 0.50, trials: [1.188, 1.192, 1.185] },
        { xVal: 0.65, trials: [1.354, 1.360, 1.351] }
      ],
      predictPeriod: (m: number) => 2 * Math.PI * Math.sqrt(m / kRef)
    };
  }
  const kappaRef = 0.12;
  return {
    xHeader: "I (kg·m²)", xSymbol: "I", xUnit: "kg·m²", xMin: 0.001, xMax: 0.2, xStep: 0.001,
    targetSymbol: "κ", targetUnit: "N·m/rad", theoreticalVal: kappaRef,
    defaultRows: [
      { xVal: 0.008, trials: [1.62, 1.64, 1.61] },
      { xVal: 0.012, trials: [1.98, 2.01, 1.99] },
      { xVal: 0.016, trials: [2.29, 2.27, 2.31] },
      { xVal: 0.020, trials: [2.56, 2.58, 2.55] }
    ],
    predictPeriod: (inertia: number) => 2 * Math.PI * Math.sqrt(inertia / kappaRef)
  };
}

export function mountAnalysisViewer(container: HTMLElement, exp: ExperimentModule): void {
  const loc = getLocale();
  const meta = getExpAnalysisMeta(exp.id);
  const rows: TrialRow[] = meta.defaultRows.map((r) => ({ xVal: r.xVal, trials: [...r.trials] }));

  const labels = {
    addRow: ({ tr: "+ Satır Ekle", en: "+ Add Row", de: "+ Zeile", fr: "+ Ligne" })[loc],
    simTrial: ({ tr: "+ Sentetik Ölçüm Üret", en: "+ Generate Trial", de: "+ Messpunkt", fr: "+ Mesure" })[loc],
    resetData: ({ tr: "Varsayılan Veri", en: "Reset Data", de: "Zurücksetzen", fr: "Réinitialiser" })[loc],
    exportCsv: ({ tr: "CSV İndir", en: "Export CSV", de: "CSV", fr: "CSV" })[loc],
    copyLatex: ({ tr: "LaTeX Tablosu Kopyala", en: "Copy LaTeX Table", de: "LaTeX-Tabelle", fr: "Table LaTeX" })[loc],
    copied: ({ tr: "Kopyalandı ✓", en: "Copied ✓", de: "Kopiert ✓", fr: "Copié ✓" })[loc],
    regTitle: ({ tr: "En Küçük Kareler Regresyonu ve Belirsizlik", en: "OLS Regression & Uncertainty", de: "Lineare Regression", fr: "Régression Linéaire" })[loc]
  };

  const layout = el("div", { attrs: { style: "display:grid; grid-template-columns: 1.55fr 1fr; gap: 1.25rem; align-items: start;" } });
  const leftCol = el("div", { attrs: { style: "display:flex; flex-direction:column; gap:0.85rem;" } });
  const tableWrap = el("div", { attrs: { style: "border:1px solid var(--border); border-radius:var(--radius); overflow-x:auto; background:var(--surface);" } });
  const table = el("table", { attrs: { style: "width:100%; border-collapse:collapse; font-family:var(--font-mono); font-size:0.77rem;" } });
  tableWrap.append(table);

  const dataToolbar = el("div", { attrs: { style: "display:flex; flex-wrap:wrap; gap:0.5rem;" } });
  const addRowBtn = el("button", { className: "btn btn-outline", text: labels.addRow });
  const simRowBtn = el("button", { className: "btn btn-outline", text: labels.simTrial });
  const resetBtn = el("button", { className: "btn btn-outline", text: labels.resetData });
  dataToolbar.append(addRowBtn, simRowBtn, resetBtn);

  const exportToolbar = el("div", { attrs: { style: "display:flex; flex-wrap:wrap; gap:0.5rem;" } });
  const csvBtn = el("button", { className: "btn", text: labels.exportCsv });
  const latexBtn = el("button", { className: "btn btn-outline", text: labels.copyLatex });
  exportToolbar.append(csvBtn, latexBtn);
  leftCol.append(tableWrap, dataToolbar, exportToolbar);

  const rightCol = el("div", { attrs: { style: "background:var(--surface-subtle); border:1px solid var(--border); border-radius:var(--radius); padding:1rem; display:flex; flex-direction:column; gap:0.85rem;" } });
  const regTitle = el("h3", { text: labels.regTitle, attrs: { style: "font-size:0.95rem; margin:0; font-family:var(--font-serif);" } });
  const regCanvas = el("canvas", { attrs: { style: "width:100%; height:235px; border:1px solid var(--border); border-radius:var(--radius); background:var(--surface); display:block;" } });
  const summaryBox = el("div", { attrs: { style: "font-family:var(--font-mono); font-size:0.79rem; line-height:1.65; color:var(--ink); background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:0.75rem 0.85rem;" } });
  rightCol.append(regTitle, regCanvas, summaryBox);
  layout.append(leftCol, rightCol);
  container.append(layout);

  const recompute = () => {
    const xs: number[] = [], ys: number[] = [], yErrs: number[] = [];
    const rowComputed = rows.map((r) => {
      const stats = computeSampleStats(r.trials);
      const tSq = stats.mean * stats.mean;
      const dtSq = 2 * stats.mean * stats.stdError;
      xs.push(r.xVal); ys.push(tSq); yErrs.push(dtSq);
      return { stats, tSq, dtSq };
    });

    const fit = fitLinearLeastSquares(xs, ys);
    const isDark = resolveEffectiveTheme() === "dark";
    const w = regCanvas.clientWidth || 380, h = 235;
    if (regCanvas.width !== w) { regCanvas.width = w; regCanvas.height = h; }
    const ctx = regCanvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, w, h);
      const padL = 48, padR = 16, padT = 18, padB = 34, plotW = w - padL - padR, plotH = h - padT - padB;
      ctx.strokeStyle = isDark ? "#57534e" : "#78716c"; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, h - padB); ctx.lineTo(w - padR, h - padB); ctx.stroke();
      ctx.fillStyle = isDark ? "#a8a29e" : "#57534e"; ctx.font = "11px monospace"; ctx.textAlign = "center";
      ctx.fillText(`${meta.xSymbol} (${meta.xUnit})`, padL + plotW / 2, h - 8);
      ctx.save(); ctx.translate(14, padT + plotH / 2); ctx.rotate(-Math.PI / 2); ctx.fillText("T² (s²)", 0, 0); ctx.restore();

      const maxX = Math.max(...xs, meta.xStep) * 1.12;
      const maxY = Math.max(...ys.map((y, idx) => y + (yErrs[idx] ?? 0)), 0.5) * 1.15;

      if (fit) {
        ctx.strokeStyle = isDark ? "#93c5fd" : "#1e3a8a"; ctx.lineWidth = 1.8; ctx.beginPath();
        const y0 = Math.max(0, fit.intercept), xStart = fit.intercept < 0 ? -fit.intercept / fit.slope : 0;
        ctx.moveTo(padL + (xStart / maxX) * plotW, h - padB - (y0 / maxY) * plotH);
        ctx.lineTo(padL + plotW, h - padB - ((fit.slope * maxX + fit.intercept) / maxY) * plotH);
        ctx.stroke();
      }

      for (let i = 0; i < xs.length; i++) {
        const xv = xs[i] ?? 0, yv = ys[i] ?? 0, err = yErrs[i] ?? 0;
        const px = padL + (xv / maxX) * plotW, py = h - padB - (yv / maxY) * plotH;
        const pyTop = h - padB - ((yv + err) / maxY) * plotH, pyBot = h - padB - (Math.max(0, yv - err) / maxY) * plotH;
        ctx.strokeStyle = "#b91c1c"; ctx.lineWidth = 1.4; ctx.beginPath();
        ctx.moveTo(px, pyTop); ctx.lineTo(px, pyBot); ctx.moveTo(px - 4, pyTop); ctx.lineTo(px + 4, pyTop); ctx.moveTo(px - 4, pyBot); ctx.lineTo(px + 4, pyBot); ctx.stroke();
        ctx.fillStyle = "#b91c1c"; ctx.beginPath(); ctx.arc(px, py, 3.8, 0, Math.PI * 2); ctx.fill();
      }
    }

    summaryBox.innerHTML = "";
    if (fit && fit.slope > 1e-9) {
      const fourPiSq = 4 * Math.PI * Math.PI;
      const derivedParam = fourPiSq / fit.slope;
      const derivedErr = (fourPiSq / (fit.slope * fit.slope)) * fit.slopeError;
      const relPct = (Math.abs(derivedParam - meta.theoreticalVal) / meta.theoreticalVal) * 100;
      const lines = [
        `${loc === "tr" ? "Eğim (m)" : "Slope (m)"}: ${fit.slope.toFixed(2)} ± ${fit.slopeError.toFixed(2)} s²/${meta.xUnit}`,
        `R² = ${fit.rSquared.toFixed(5)}`,
        `──────────────────────────────`,
        `${loc === "tr" ? "Deneysel" : "Experimental"} ${meta.targetSymbol} = ${derivedParam.toFixed(4)} ± ${derivedErr.toFixed(4)} ${meta.targetUnit}`,
        `${loc === "tr" ? "Referans" : "Ref."} ${meta.targetSymbol}₀ = ${meta.theoreticalVal.toFixed(4)} ${meta.targetUnit} (%${relPct.toFixed(2)})`
      ];
      lines.forEach((line, idx) => summaryBox.append(el("div", { text: line, attrs: idx === 3 ? { style: "font-weight:700; color:#b91c1c;" } : {} })));
    }
    return rowComputed;
  };

  const renderTable = () => {
    table.innerHTML = "";
    const thead = el("thead"), headRow = el("tr", { attrs: { style: "background:var(--surface-subtle); border-bottom:1px solid var(--border);" } });
    for (const h of [meta.xHeader, "T₁ (s)", "T₂ (s)", "T₃ (s)", "T̄ ± σ_T̄", "T² ± δ(T²)", ""]) {
      headRow.append(el("th", { text: h, attrs: { style: "padding:0.45rem 0.5rem; text-align:left; font-weight:600;" } }));
    }
    thead.append(headRow); table.append(thead);
    const tbody = el("tbody"), computed = recompute();

    rows.forEach((row, rIdx) => {
      const tr = el("tr", { attrs: { style: "border-bottom:1px solid var(--border);" } });
      const xTd = el("td", { attrs: { style: "padding:0.35rem 0.45rem;" } });
      const xInp = el("input", { attrs: { type: "number", step: String(meta.xStep), value: String(row.xVal), style: "width:74px; padding:3px 5px; border:1px solid var(--border-strong); border-radius:3px; background:var(--bg); color:var(--ink); font-family:inherit;" } });
      xInp.addEventListener("change", () => { row.xVal = clampNumber(xInp.value, meta.xMin, meta.xMax, row.xVal); renderTable(); });
      xTd.append(xInp); tr.append(xTd);

      for (let tIdx = 0; tIdx < 3; tIdx++) {
        const td = el("td", { attrs: { style: "padding:0.35rem 0.4rem;" } });
        const inp = el("input", { attrs: { type: "number", step: "0.001", value: String(row.trials[tIdx]), style: "width:64px; padding:3px 5px; border:1px solid var(--border-strong); border-radius:3px; background:var(--bg); color:var(--ink); font-family:inherit;" } });
        inp.addEventListener("change", () => { row.trials[tIdx] = clampNumber(inp.value, 0.05, 60, row.trials[tIdx] ?? 1); renderTable(); });
        td.append(inp); tr.append(td);
      }

      const comp = computed[rIdx]!;
      tr.append(
        el("td", { text: `${comp.stats.mean.toFixed(3)} ± ${comp.stats.stdError.toFixed(3)}`, attrs: { style: "padding:0.35rem 0.5rem; white-space:nowrap;" } }),
        el("td", { text: `${comp.tSq.toFixed(3)} ± ${comp.dtSq.toFixed(3)}`, attrs: { style: "padding:0.35rem 0.5rem; white-space:nowrap;" } })
      );

      const delTd = el("td", { attrs: { style: "padding:0.35rem; text-align:center;" } });
      if (rows.length > 2) {
        const delBtn = el("button", { text: "×", attrs: { style: "background:transparent; border:1px solid var(--border-strong); border-radius:3px; color:var(--ink-muted); cursor:pointer; padding:1px 6px;" } });
        delBtn.addEventListener("click", () => { rows.splice(rIdx, 1); renderTable(); });
        delTd.append(delBtn);
      }
      tr.append(delTd); tbody.append(tr);
    });
    table.append(tbody);
  };

  addRowBtn.addEventListener("click", () => {
    const nextX = Number(((rows[rows.length - 1]?.xVal ?? meta.xStep * 4) + meta.xStep * 4).toFixed(4));
    const t0 = meta.predictPeriod(nextX);
    rows.push({ xVal: nextX, trials: [Number(t0.toFixed(3)), Number((t0 + 0.004).toFixed(3)), Number((t0 - 0.003).toFixed(3))] });
    renderTable();
  });

  simRowBtn.addEventListener("click", () => {
    const nextX = Number(((rows[rows.length - 1]?.xVal ?? meta.xStep * 4) + meta.xStep * 3).toFixed(4));
    const t0 = meta.predictPeriod(nextX);
    const j = () => (Math.random() - 0.5) * 0.024;
    rows.push({ xVal: nextX, trials: [Number((t0 + j()).toFixed(3)), Number((t0 + j()).toFixed(3)), Number((t0 + j()).toFixed(3))] });
    renderTable();
  });

  resetBtn.addEventListener("click", () => {
    rows.length = 0;
    meta.defaultRows.forEach((r) => rows.push({ xVal: r.xVal, trials: [...r.trials] }));
    renderTable();
  });

  csvBtn.addEventListener("click", () => {
    const lines = [`${meta.xSymbol},T1,T2,T3,T_mean,StdErr,T_sq,dT_sq`];
    for (const r of rows) {
      const s = computeSampleStats(r.trials);
      lines.push(`${r.xVal},${r.trials[0]},${r.trials[1]},${r.trials[2]},${s.mean.toFixed(4)},${s.stdError.toFixed(4)},${(s.mean ** 2).toFixed(4)},${(2 * s.mean * s.stdError).toFixed(4)}`);
    }
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a"); a.href = url; a.download = `${exp.id}-analiz.csv`; a.click(); URL.revokeObjectURL(url);
  });

  latexBtn.addEventListener("click", async () => {
    const tex = ["\\begin{tabular}{cccccc}", "\\hline", `${meta.xHeader} & $T_1$ & $T_2$ & $T_3$ & $\\bar{T} \\pm \\sigma_{\\bar{T}}$ & $T^2 \\pm \\delta(T^2)$ \\\\`, "\\hline"];
    for (const r of rows) {
      const s = computeSampleStats(r.trials);
      tex.push(`${r.xVal} & ${r.trials[0].toFixed(3)} & ${r.trials[1].toFixed(3)} & ${r.trials[2].toFixed(3)} & $${s.mean.toFixed(3)} \\pm ${s.stdError.toFixed(3)}$ & $${(s.mean ** 2).toFixed(3)} \\pm ${(2 * s.mean * s.stdError).toFixed(3)}$ \\\\`);
    }
    tex.push("\\hline", "\\end{tabular}");
    await navigator.clipboard.writeText(tex.join("\n")).catch(() => {});
    const orig = latexBtn.textContent; latexBtn.textContent = labels.copied;
    setTimeout(() => { latexBtn.textContent = orig; }, 1500);
  });

  renderTable();
}
