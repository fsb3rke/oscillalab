import { getAllExperiments } from '../core/registry';
import type { ExperimentModule } from '../core/types';
import { el } from '../core/sanitize';
import { stepRK4 } from '../core/rk4';

type TabKey = 'setup' | 'theory' | 'sim3d' | 'analysis';

const TABS: readonly { key: TabKey; label: string }[] = [
  { key: 'setup', label: '01 / Orijinal Düzenek' },
  { key: 'theory', label: '02 / Teorik Model' },
  { key: 'sim3d', label: '03 / 3B Dijital İkiz' },
  { key: 'analysis', label: '04 / Veri & Hata Analizi' }
];

function mountLiveScope(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  let state = [1.0, 0.0];
  let t = 0;
  const history: number[] = [];
  let rafId = 0;

  const derivs = (s: readonly number[]): number[] => {
    const x = s[0] ?? 0;
    const v = s[1] ?? 0;
    const omega0 = 5.5;
    const gamma = 0.35;
    return [v, -2 * gamma * v - omega0 * omega0 * x];
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

    // Eksen çizgisi
    ctx.strokeStyle = '#e4e4e7';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    // RK4 adımı
    for (let i = 0; i < 4; i++) {
      state = stepRK4(state, t, 0.004, derivs);
      t += 0.004;
    }

    if (Math.abs(state[0] ?? 0) < 0.03 && Math.abs(state[1] ?? 0) < 0.05) {
      state = [1.0, 0.0];
    }

    history.push(state[0] ?? 0);
    const maxPts = Math.max(60, Math.floor(w / 2));
    while (history.length > maxPts) history.shift();

    // Sinyal eğrisi
    ctx.strokeStyle = '#ea580c';
    ctx.lineWidth = 1.75;
    ctx.beginPath();
    for (let i = 0; i < history.length; i++) {
      const px = (i / maxPts) * w;
      const py = h / 2 - (history[i] ?? 0) * (h * 0.38);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Anlık uç noktası
    const lastX = ((history.length - 1) / maxPts) * w;
    const lastY = h / 2 - (history[history.length - 1] ?? 0) * (h * 0.38);
    ctx.fillStyle = '#1d4ed8';
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
  let activeTab: TabKey = 'setup';
  let cleanupScope: (() => void) | null = null;

  function draw(): void {
    if (cleanupScope) {
      cleanupScope();
      cleanupScope = null;
    }
    root.replaceChildren();

    // Üst Navigasyon
    const topbar = el('header', { className: 'topbar' });
    const topbarInner = el('div', { className: 'topbar-inner' });

    const brand = el('div', { className: 'brand' });
    const mark = el('span', { className: 'brand-mark' });
    mark.append(el('span', { className: 'brand-dot' }), document.createTextNode('OscillaLab'));
    brand.append(mark, el('span', { className: 'brand-meta', text: 'PHYS-LAB // v0.1' }));
    topbarInner.append(brand);

    if (activeExp) {
      const backBtn = el('button', { className: 'btn btn-outline', text: '← Deney Listesi' });
      backBtn.addEventListener('click', () => {
        activeExp = null;
        draw();
      });
      topbarInner.append(backBtn);
    }
    topbar.append(topbarInner);

    const main = el('main', { className: 'container' });

    if (!activeExp) {
      const headerGrid = el('section', { className: 'header-grid' });

      const intro = el('div');
      intro.append(
        el('span', { className: 'kicker', text: 'FİZİK LABORATUVARI • TİTREŞİM VE DALGALAR' }),
        el('h1', { className: 'page-title', text: 'Orijinal Düzenek Tabanlı 3B Deney Platformu' }),
        el('p', {
          className: 'page-lead',
          text: 'Gerçek laboratuvar ekipmanlarının optik ölçümlerini ve 4. mertebe Runge-Kutta (RK4) sayısal çözücüsünü birleştiren etkileşimli deney ortamı.'
        })
      );

      const scopeBox = el('aside', { className: 'scope-box' });
      const scopeHead = el('div', { className: 'scope-header' });
      scopeHead.append(
        el('span', { text: 'RK4 SOLVER // DAMPED HARMONIC' }),
        el('span', { text: 'dt = 0.004s' })
      );
      const canvas = el('canvas', { className: 'scope-canvas' });
      scopeBox.append(scopeHead, canvas);

      headerGrid.append(intro, scopeBox);
      main.append(headerGrid);

      cleanupScope = mountLiveScope(canvas);

      const experiments = getAllExperiments();
      const secBar = el('div', { className: 'section-bar' });
      secBar.append(
        el('span', { className: 'section-label', text: 'Deney Kataloğu' }),
        el('span', { className: 'exp-code', text: `${experiments.length} MODÜL AKTİF` })
      );
      main.append(secBar);

      const list = el('div', { className: 'exp-list' });
      if (experiments.length === 0) {
        const row = el('div', { className: 'exp-row' });
        row.append(
          el('span', { className: 'exp-code', text: 'EXP-00 // HAZIR' }),
          el('span', { className: 'exp-name', text: 'Çekirdek Mimari Kuruldu' }),
          el('span', {
            className: 'exp-desc',
            text: 'Plugin kayıt sistemi aktif. İlk deney modülü eklendiğinde bu çizelgede yer alacaktır.'
          }),
          el('span', { className: 'exp-code', text: 'Beklemede' })
        );
        list.append(row);
      } else {
        for (const exp of experiments) {
          const row = el('div', { className: 'exp-row' });
          const openBtn = el('button', { className: 'btn', text: 'Düzeneği Aç →' });
          openBtn.addEventListener('click', () => {
            activeExp = exp;
            activeTab = 'setup';
            draw();
          });
          row.append(
            el('span', { className: 'exp-code', text: exp.courseCode }),
            el('span', { className: 'exp-name', text: exp.title }),
            el('span', { className: 'exp-desc', text: exp.summary }),
            openBtn
          );
          list.append(row);
        }
      }
      main.append(list);
    } else {
      const expHead = el('div', { style: 'margin-bottom: 1.25rem;' } as never);
      expHead.append(
        el('span', { className: 'kicker', text: activeExp.courseCode }),
        el('h1', { className: 'page-title', text: activeExp.title })
      );
      main.append(expHead);

      const tabBar = el('div', { className: 'tabs', attrs: { role: 'tablist' } });
      for (const tab of TABS) {
        const btn = el('button', {
          className: 'tab-btn',
          text: tab.label,
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
      workspace.append(
        el('h3', { text: TABS.find((t) => t.key === activeTab)?.label ?? '' }),
        el('p', {
          className: 'exp-desc',
          text: `${activeExp.title} için bileşen yuvası hazır.`
        })
      );
      main.append(workspace);
    }

    const footer = el('footer', { className: 'footer' });
    const footerInner = el('div', { className: 'footer-inner' });
    footerInner.append(
      el('span', { text: 'OscillaLab • Açık Kaynak Fizik Dijital İkiz Platformu' }),
      el('span', { text: 'OFFLINE-READY // STRICT-CSP' })
    );
    footer.append(footerInner);

    root.append(topbar, main, footer);
  }

  draw();
}
