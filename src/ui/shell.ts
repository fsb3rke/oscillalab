import { getAllExperiments } from '../core/registry';
import type { ExperimentModule } from '../core/types';
import { el } from '../core/sanitize';
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

export function renderApp(root: HTMLElement): void {
  let activeExp: ExperimentModule | null = null;
  let activeTab: TabKey = 'setup';
  let cleanupActive: (() => void) | null = null;

  function buildControls(): HTMLElement {
    const wrap = el('div', { className: 'controls' });

    const langGroup = el('div', { className: 'segmented', attrs: { role: 'group', 'aria-label': 'Dil' } });
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

    const themeGroup = el('div', { className: 'segmented', attrs: { role: 'group', 'aria-label': 'Tema' } });
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

    const loc = getLocale();
    const topbar = el('header', { className: 'topbar' });
    const topbarInner = el('div', { className: 'topbar-inner' });

    const brand = el('div', { className: 'brand' });
    brand.append(
      el('span', { className: 'brand-mark', text: 'OscillaLab' }),
      el('span', { className: 'brand-meta', text: t('brandMeta') })
    );
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
      const intro = el('section', { className: 'intro-block' });
      intro.append(
        el('h1', { className: 'page-title', text: t('pageTitle') }),
        el('p', { className: 'page-lead', text: t('pageLead') })
      );
      main.append(intro);

      const cols = el('div', { className: 'home-columns' });

      // Sol: Deney Tablosu
      const leftSide = el('div');
      leftSide.append(el('h2', { className: 'section-heading', text: t('catalogLabel') }));

      const table = el('table', { className: 'exp-table' });
      const thead = el('thead');
      const hRow = el('tr');
      hRow.append(
        el('th', { text: loc === 'tr' ? 'Kod' : 'Code' }),
        el('th', { text: loc === 'tr' ? 'Deney Adı ve Kapsamı' : 'Experiment & Scope' }),
        el('th', { text: '' })
      );
      thead.append(hRow);

      const tbody = el('tbody');
      for (const exp of getAllExperiments()) {
        const tr = el('tr');
        const infoTd = el('td');
        infoTd.append(
          el('div', { className: 'exp-name', text: tx(exp.title) }),
          el('div', { className: 'exp-desc', text: tx(exp.summary) })
        );

        const btnTd = el('td', { attrs: { style: 'text-align:right; vertical-align:middle;' } });
        const openBtn = el('button', { className: 'btn', text: t('openExp') });
        openBtn.addEventListener('click', () => {
          activeExp = exp;
          activeTab = 'setup';
          draw();
        });
        btnTd.append(openBtn);

        tr.append(
          el('td', { className: 'exp-code', text: exp.courseCode }),
          infoTd,
          btnTd
        );
        tbody.append(tr);
      }

      table.append(thead, tbody);
      leftSide.append(table);

      // Sağ: Laboratuvar Kullanım Notu
      const noteBox = el('aside', { className: 'note-box' });
      noteBox.append(
        el('h3', { text: loc === 'tr' ? 'Yöntem ve Sayısal Altyapı' : 'Methodology & Numerical Core' })
      );
      const ul = el('ul');
      const notes = loc === 'tr'
        ? [
            'Diferansiyel hareket denklemleri sabit zaman adımlı (dt = 2 ms) 4. mertebe Runge-Kutta yöntemiyle çözülmektedir.',
            'Tekrarlı zaman ölçümlerinde Bessel düzeltmeli örneklem standart sapması (s) ve standart hata (σ_x̄) hesaplanır.',
            'Doğrusal uyum analizlerinde en küçük kareler yöntemi ve determinasyon katsayısı (R²) raporlanır.'
          ]
        : [
            'Equations of motion are integrated via fixed-step (dt = 2 ms) 4th-order Runge-Kutta solvers.',
            'Repeated period trials yield Bessel-corrected sample standard deviation (s) and standard error (σ_x̄).',
            'Linear curve fits compute ordinary least-squares parameters alongside the coefficient of determination (R²).'
          ];
      for (const n of notes) ul.append(el('li', { text: n }));
      noteBox.append(ul);

      cols.append(leftSide, noteBox);
      main.append(cols);
    } else {
      const expHead = el('div', { attrs: { style: 'margin-bottom: 1.25rem;' } });
      expHead.append(
        el('div', { className: 'exp-code', text: activeExp.courseCode }),
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
