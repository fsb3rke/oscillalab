import { getAllExperiments } from '../core/registry';
import type { ExperimentModule } from '../core/types';
import { el } from '../core/sanitize';

type TabKey = 'setup' | 'theory' | 'sim3d' | 'analysis';

const TABS: readonly { key: TabKey; label: string }[] = [
  { key: 'setup', label: '1. Orijinal Düzenek & Parçalar' },
  { key: 'theory', label: '2. Teori & Kavramlar' },
  { key: 'sim3d', label: '3. 3B Dijital İkiz (RK4)' },
  { key: 'analysis', label: '4. Veri & Belirsizlik Analizi' }
];

export function renderApp(root: HTMLElement): void {
  let activeExp: ExperimentModule | null = null;
  let activeTab: TabKey = 'setup';

  function draw(): void {
    root.replaceChildren();

    // Üst Bar
    const topbar = el('header', { className: 'topbar' });
    const brand = el('div', { className: 'brand' });
    brand.append(
      el('h1', { text: 'OscillaLab' }),
      el('span', { className: 'brand-badge', text: 'FİZİK LAB • RK4 + 3B DİJİTAL İKİZ' })
    );
    topbar.append(brand);

    if (activeExp) {
      const backBtn = el('button', { className: 'btn btn-ghost', text: '← Tüm Deneyler' });
      backBtn.addEventListener('click', () => {
        activeExp = null;
        draw();
      });
      topbar.append(backBtn);
    }

    // Ana İçerik
    const main = el('main', { className: 'container' });

    if (!activeExp) {
      const hero = el('section', { className: 'hero' });
      hero.append(
        el('h2', { text: 'Titreşim ve Dalgalar Dijital Laboratuvarı' }),
        el('p', {
          text: 'Orijinal laboratuvar düzeneklerinin yüksek hassasiyetli 3B sayısal ikizleri ve 4. mertebe Runge-Kutta (RK4) fizik motoru ile etkileşimli deney ortamı.'
        })
      );
      main.append(hero);

      const experiments = getAllExperiments();
      const grid = el('section', { className: 'grid' });

      if (experiments.length === 0) {
        const emptyCard = el('article', { className: 'card' });
        emptyCard.append(
          el('span', { className: 'card-code', text: 'MODÜL BEKLENİYOR' }),
          el('h3', { text: 'Çekirdek Platform Hazır' }),
          el('p', {
            text: 'Ana site altyapısı ve eklenti kayıt sistemi kuruldu. İlk deney modülü (Burulma Sarkacı / Yay-Kütle Sistemi) eklendiğinde burada otomatik listelenecektir.'
          })
        );
        grid.append(emptyCard);
      } else {
        for (const exp of experiments) {
          const card = el('article', { className: 'card' });
          const openBtn = el('button', { className: 'btn', text: 'Deney Ortamını Aç' });
          openBtn.addEventListener('click', () => {
            activeExp = exp;
            activeTab = 'setup';
            draw();
          });
          card.append(
            el('span', { className: 'card-code', text: exp.courseCode }),
            el('h3', { text: exp.title }),
            el('p', { text: exp.summary }),
            openBtn
          );
          grid.append(card);
        }
      }
      main.append(grid);
    } else {
      const titleBox = el('div', { style: 'margin-bottom: 1.25rem;' } as never);
      titleBox.append(
        el('span', { className: 'card-code', text: activeExp.courseCode }),
        el('h2', { text: activeExp.title })
      );
      main.append(titleBox);

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
          text: `${activeExp.title} için bu modül yuvası bir sonraki adımda gerçek düzenek görüntüsü ve 3B sahne ile doldurulacaktır.`
        })
      );
      main.append(workspace);
    }

    // Alt Bilgi
    const footer = el('footer', { className: 'footer' });
    footer.append(
      el('span', {
        text: 'OscillaLab • Açık ve Modüler Fizik Laboratuvarı Altyapısı • Çevrimdışı Çalışmaya Uyumlu'
      })
    );

    root.append(topbar, main, footer);
  }

  draw();
}
