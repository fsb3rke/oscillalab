import { getAllExperiments } from '../core/registry';
import type { ExperimentModule } from '../core/types';
import { el } from '../core/sanitize';
import { stepRK4 } from '../core/rk4';
import { getLocale, setLocale, t, tx, onLocaleChange, type Locale, type DictKey } from '../core/i18n';
import { getThemeMode, setThemeMode, type ThemeMode } from '../core/theme';
import { mountSim3D } from './sim3d-viewer';
import { mountSetupViewer } from './setup-viewer';
import { mountAnalysisViewer } from './analysis-viewer';
import { mountTheoryViewer } from './theory-viewer';

type TabKey = 'setup' | 'theory' | 'sim3d' | 'analysis';

const TABS: readonly { key: TabKey; labelKey: DictKey }[] = [
  { key: 'setup', labelKey: 'tabSetup' },
  { key: 'theory', labelKey: 'tabTheory' },
  { key: 'sim3d', labelKey: 'tabSim3d' },
  { key: 'analysis', labelKey: 'tabAnalysis' }
];

function getCssVar(name: string, fallback: string): string {
  const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return val || fallback;
}

function mountLiveScope(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  let state = [1.0, 0.0];
  let tSec = 0;
  const history: number[] = [];
  let rafId = 0;

  const derivs = (s: readonly number[]): number[] => {
    const x = s[0] ?? 0;
    const v = s[1] ?? 0;
    return [v, -2 * 0.35 * v - 30.25 * x];
  };

  const render = () => {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== Math.floor(rect.width * dpr) || canvas.height !== Math.floor(rect.height * dpr)) {
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = getCssVar('--scope-axis', '#e4e4e7');
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    for (let i = 0; i < 4; i++) {
      state = stepRK4(state, tSec, 0.004, derivs);
      tSec += 0.004;
    }

    if (Math.abs(state[0] ?? 0) < 0.03 && Math.abs(state[1] ?? 0) < 0.05) {
      state = [1.0, 0.0];
    }

    history.push(state[0] ?? 0);
    const maxPts = Math.max(60, Math.floor(w / 2));
    while (history.length > maxPts) history.shift();

    ctx.strokeStyle = getCssVar('--signal', '#ea580c');
    ctx.lineWidth = 1.75;
    ctx.beginPath();
    for (let i = 0; i < history.length; i++) {
      const px = (i / maxPts) * w;
      const py = h / 2 - (history[i] ?? 0) * (h * 0.38);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    const lastX = ((history.length - 1) / maxPts) * w;
    const lastY = h / 2 - (history[history.length - 1] ?? 0) * (h * 0.38);
    ctx.fillStyle = getCssVar('--accent', '#1d4ed8');
    ctx.beginPath();
    ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    rafId = requestAnimationFrame(render);
  };

  rafId = requestAnimationFrame(render);
  return () => cancelAnimationFrame(rafId);
}

export function renderApp(root: HTMLElement): void {
  let activeExp: ExperimentModule | null = null;
  let activeTab: TabKey = 'sim3d';
  let cleanupActive: (() => void) | null = null;

  function buildControls(): HTMLElement {
    const wrap = el('div', { className: 'controls' });

    const langGroup = el('div', { className: 'segmented', attrs: { role: 'group', 'aria-label': 'Language' } });
    const locales: readonly Locale[] = ['tr', 'en'];
    for (const loc of locales) {
      const btn = el('button', {
        className: 'seg-btn',
        text: loc.toUpperCase(),
        attrs: { 'aria-pressed': String(getLocale() === loc) }
      });
      btn.addEventListener('click', () => setLocale(loc));
      langGroup.append(btn);
    }

    const themeGroup = el('div', { className: 'segmented', attrs: { role: 'group', 'aria-label': 'Theme' } });
    const modes: readonly { mode: ThemeMode; labelKey: DictKey }[] = [
      { mode: 'system', labelKey: 'themeAuto' },
      { mode: 'light', labelKey: 'themeLight' },
      { mode: 'dark', labelKey: 'themeDark' }
    ];
    for (const item of modes) {
      const btn = el('button', {
        className: 'seg-btn',
        text: t(item.labelKey),
        attrs: { 'aria-pressed': String(getThemeMode() === item.mode) }
      });
      btn.addEventListener('click', () => {
        setThemeMode(item.mode);
        draw();
      });
      themeGroup.append(btn);
    }

    wrap.append(langGroup, themeGroup);
    return wrap;
  }

  function draw(): void {
    if (cleanupActive) {
      cleanupActive();
      cleanupActive = null;
    }
    root.replaceChildren();

    const topbar = el('header', { className: 'topbar' });
    const topbarInner = el('div', { className: 'topbar-inner' });

    const brand = el('div', { className: 'brand' });
    const mark = el('span', { className: 'brand-mark' });
    mark.append(el('span', { className: 'brand-dot' }), document.createTextNode('OscillaLab'));
    brand.append(mark, el('span', { className: 'brand-meta', text: t('brandMeta') }));
    topbarInner.append(brand);

    const rightControls = buildControls();
    if (activeExp) {
      const backBtn = el('button', { className: 'btn btn-outline', text: t('backToList') });
      backBtn.addEventListener('click', () => {
        activeExp = null;
        draw();
      });
      rightControls.prepend(backBtn);
    }
    topbarInner.append(rightControls);
    topbar.append(topbarInner);

    const main = el('main', { className: 'container' });

    if (!activeExp) {
      const headerGrid = el('section', { className: 'header-grid' });

      const intro = el('div');
      intro.append(
        el('span', { className: 'kicker', text: t('kicker') }),
        el('h1', { className: 'page-title', text: t('pageTitle') }),
        el('p', { className: 'page-lead', text: t('pageLead') })
      );

      const scopeBox = el('aside', { className: 'scope-box' });
      const scopeHead = el('div', { className: 'scope-header' });
      scopeHead.append(el('span', { text: t('scopeTitle') }), el('span', { text: 'dt = 0.004 s' }));
      const canvas = el('canvas', { className: 'scope-canvas' });
      scopeBox.append(scopeHead, canvas);

      headerGrid.append(intro, scopeBox);
      main.append(headerGrid);

      cleanupActive = mountLiveScope(canvas);

      const experiments = getAllExperiments();
      const secBar = el('div', { className: 'section-bar' });
      secBar.append(
        el('span', { className: 'section-label', text: t('catalogLabel') }),
        el('span', { className: 'exp-code', text: `${experiments.length} ${t('expCount')}` })
      );
      main.append(secBar);

      const list = el('div', { className: 'exp-list' });
      for (const exp of experiments) {
        const row = el('div', { className: 'exp-row' });
        const openBtn = el('button', { className: 'btn', text: t('openExp') });
        openBtn.addEventListener('click', () => {
          activeExp = exp;
          activeTab = 'sim3d';
          draw();
        });
        row.append(
          el('span', { className: 'exp-code', text: exp.courseCode }),
          el('span', { className: 'exp-name', text: tx(exp.title) }),
          el('span', { className: 'exp-desc', text: tx(exp.summary) }),
          openBtn
        );
        list.append(row);
      }
      main.append(list);
    } else {
      const expHead = el('div', { attrs: { style: 'margin-bottom: 1.25rem;' } });
      expHead.append(
        el('span', { className: 'kicker', text: activeExp.courseCode }),
        el('h1', { className: 'page-title', text: tx(activeExp.title) })
      );
      main.append(expHead);

      const tabBar = el('div', { className: 'tabs', attrs: { role: 'tablist' } });
      for (const tab of TABS) {
        const btn = el('button', {
          className: 'tab-btn',
          text: t(tab.labelKey),
          attrs: {
            role: 'tab',
            'aria-selected': String(activeTab === tab.key)
          }
        });
        btn.addEventListener('click', () => {
          activeTab = tab.key;
          draw();
        });
        tabBar.append(btn);
      }
      main.append(tabBar);

      const workspace = el('section', { className: 'workspace' });
      if (activeTab === 'sim3d') {
        cleanupActive = mountSim3D(workspace, activeExp);
      } else if (activeTab === 'setup') {
        cleanupActive = mountSetupViewer(workspace, activeExp);
      } else if (activeTab === 'theory') {
        mountTheoryViewer(workspace, activeExp);
      } else if (activeTab === 'analysis') {
        mountAnalysisViewer(workspace, activeExp);
      } else {
        const activeTabObj = TABS.find((tab) => tab.key === activeTab);
        workspace.append(
          el('h3', { text: activeTabObj ? t(activeTabObj.labelKey) : '' }),
          el('p', { className: 'exp-desc', text: `${tx(activeExp.title)} — ${t('preparing')}` })
        );
      }
      main.append(workspace);
    }

    const footer = el('footer', { className: 'footer' });
    const footerInner = el('div', { className: 'footer-inner' });
    footerInner.append(el('span', { text: t('footerLeft') }), el('span', { text: t('footerRight') }));
    footer.append(footerInner);

    root.append(topbar, main, footer);
  }

  onLocaleChange(draw);
  draw();
}
