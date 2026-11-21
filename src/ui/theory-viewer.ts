import katex from 'katex';
import 'katex/dist/katex.min.css';
import type { ExperimentModule } from '../core/types';
import { el } from '../core/sanitize';
import { getLocale, tx } from '../core/i18n';

export function mountTheoryViewer(container: HTMLElement, exp: ExperimentModule): void {
  const loc = getLocale();
  const blocks = exp.theory ?? [];

  if (blocks.length === 0) {
    container.append(
      el('p', {
        className: 'exp-desc',
        text: loc === 'tr' ? 'Bu deney için teorik içerik tanımlanmadı.' : 'No theoretical notes defined for this module.'
      })
    );
    return;
  }

  const stack = el('div', {
    attrs: { style: 'display:flex; flex-direction:column; gap:1.25rem; max-width:78ch;' }
  });

  blocks.forEach((blk, idx) => {
    const card = el('article', {
      attrs: {
        style: 'padding:1.1rem 1.25rem; border:1px solid var(--border); border-radius:var(--radius); background:var(--surface-subtle);'
      }
    });

    card.append(
      el('div', {
        text: `0${idx + 1} // ${tx(blk.heading)}`,
        attrs: { style: 'font-family:var(--font-mono); font-size:0.78rem; color:var(--accent); margin-bottom:0.4rem; font-weight:600;' }
      }),
      el('p', {
        text: tx(blk.body),
        attrs: { style: 'font-size:0.92rem; color:var(--ink); margin-bottom:0.65rem;' }
      })
    );

    if (blk.equations && blk.equations.length > 0) {
      const eqBox = el('div', {
        attrs: {
          style: 'display:flex; flex-direction:column; gap:0.55rem; padding:0.75rem 1rem; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); overflow-x:auto;'
        }
      });

      for (const tex of blk.equations) {
        const line = el('div');
        // trust: false ile KaTeX icinde link/HTML enjeksiyonunu kapali tutuyoruz
        katex.render(tex, line, {
          displayMode: true,
          throwOnError: false,
          trust: false
        });
        eqBox.append(line);
      }
      card.append(eqBox);
    }

    stack.append(card);
  });

  container.append(stack);
}
