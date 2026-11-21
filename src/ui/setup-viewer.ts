import type { ExperimentModule, HotspotItem } from '../core/types';
import { el } from '../core/sanitize';
import { getLocale, tx } from '../core/i18n';

export function mountSetupViewer(container: HTMLElement, exp: ExperimentModule): () => void {
  const loc = getLocale();
  let activeSpot: HotspotItem | null = exp.hotspots[0] ?? null;
  let currentImgSrc = exp.setupImageUrl ?? '';
  let objectUrlToRevoke: string | null = null;

  const grid = el('div', {
    attrs: {
      style: 'display:grid; grid-template-columns: 1.55fr 1fr; gap: 1.25rem; align-items: start;'
    }
  });

  const stageWrap = el('div', { attrs: { style: 'display:flex; flex-direction:column; gap:0.65rem;' } });

  const stage = el('div', {
    attrs: {
      style: 'position:relative; width:100%; aspect-ratio: 4 / 3; background:var(--surface-subtle); border:1px solid var(--border); border-radius:var(--radius); overflow:hidden; user-select:none;'
    }
  });

  const img = el('img', {
    attrs: {
      alt: tx(exp.title),
      style: 'width:100%; height:100%; object-fit:contain; display:block;'
    }
  });

  const fallbackBox = el('div', {
    attrs: {
      style: 'position:absolute; inset:0; display:none; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:1.5rem; color:var(--ink-faint); font-family:var(--font-mono); font-size:0.78rem; gap:0.5rem;'
    }
  });
  fallbackBox.append(
    el('span', { text: loc === 'tr' ? '[ ORİJİNAL DÜZENEK GÖRÜNTÜSÜ BEKLENİYOR ]' : '[ WAITING FOR APPARATUS PHOTO ]' }),
    el('span', { text: exp.setupImageUrl ?? 'public/assets/setup.webp' })
  );

  img.addEventListener('load', () => {
    img.style.display = 'block';
    fallbackBox.style.display = 'none';
    zoomImg.src = img.src;
    zoomImg.style.display = 'block';
  });

  img.addEventListener('error', () => {
    img.style.display = 'none';
    fallbackBox.style.display = 'flex';
    zoomImg.style.display = 'none';
  });

  stage.append(img, fallbackBox);

  const pinButtons = new Map<number, HTMLButtonElement>();
  for (const hs of exp.hotspots) {
    const pin = el('button', {
      text: String(hs.id),
      attrs: {
        type: 'button',
        title: tx(hs.title),
        style: `position:absolute; left:${hs.xPercent}%; top:${hs.yPercent}%; transform:translate(-50%, -50%); width:26px; height:26px; border-radius:50%; border:2px solid var(--surface); background:var(--ink); color:var(--bg); font-family:var(--font-mono); font-size:0.75rem; font-weight:700; cursor:pointer; box-shadow:0 2px 6px rgba(0,0,0,0.3); transition:transform 0.12s ease, background-color 0.12s ease;`
      }
    });
    pin.addEventListener('click', (e) => {
      e.stopPropagation();
      activeSpot = hs;
      syncSelection();
    });
    pinButtons.set(hs.id, pin);
    stage.append(pin);
  }

  const toolbar = el('div', {
    attrs: {
      style: 'display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; font-family:var(--font-mono); font-size:0.72rem; color:var(--ink-faint);'
    }
  });

  const coordHint = el('span', {
    text: loc === 'tr' ? 'Koordinat okumak için: Alt + Tık' : 'Read coordinates: Alt + Click'
  });

  const fileLabel = el('label', {
    className: 'btn btn-outline',
    text: loc === 'tr' ? 'Fotoğraf Test Et...' : 'Test Photo...',
    attrs: { style: 'padding:0.3rem 0.65rem; font-size:0.74rem; cursor:pointer;' }
  });
  const fileInput = el('input', {
    attrs: { type: 'file', accept: 'image/webp,image/png,image/jpeg', style: 'display:none;' }
  });
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file || !file.type.startsWith("image/") || file.size > 15 * 1024 * 1024) return;
    if (objectUrlToRevoke) URL.revokeObjectURL(objectUrlToRevoke);
    objectUrlToRevoke = URL.createObjectURL(file);
    currentImgSrc = objectUrlToRevoke;
    img.src = currentImgSrc;
  });
  fileLabel.append(fileInput);

  stage.addEventListener('click', (e) => {
    if (!e.altKey) return;
    const rect = stage.getBoundingClientRect();
    const xPct = Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10;
    const yPct = Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10;
    coordHint.textContent = `xPercent: ${xPct}, yPercent: ${yPct}`;
  });

  toolbar.append(coordHint, fileLabel);
  stageWrap.append(stage, toolbar);

  const inspector = el('div', {
    attrs: { style: 'display:flex; flex-direction:column; gap:0.9rem;' }
  });

  const loupeFrame = el('div', {
    attrs: {
      style: 'width:100%; height:165px; border:1px solid var(--border); border-radius:var(--radius); background:var(--surface-subtle); overflow:hidden; position:relative;'
    }
  });
  const zoomImg = el('img', {
    attrs: {
      alt: '',
      style: 'width:100%; height:100%; object-fit:contain; transform:scale(2.35); transition:transform-origin 0.22s ease; display:none;'
    }
  });
  const loupeBadge = el('span', {
    text: 'OPTIC 2.35x',
    attrs: {
      style: 'position:absolute; bottom:6px; right:8px; font-family:var(--font-mono); font-size:0.68rem; color:var(--ink-faint); background:var(--surface); padding:1px 5px; border:1px solid var(--border); border-radius:4px;'
    }
  });
  loupeFrame.append(zoomImg, loupeBadge);

  const detailCard = el('div', {
    attrs: {
      style: 'padding:0.95rem; border:1px solid var(--border); border-radius:var(--radius); background:var(--surface-subtle);'
    }
  });
  const detailTitle = el('div', { attrs: { style: 'font-weight:600; font-size:0.95rem; margin-bottom:0.3rem;' } });
  const detailDesc = el('p', { className: 'exp-desc' });
  detailCard.append(detailTitle, detailDesc);

  const listWrap = el('div', { attrs: { style: 'display:flex; flex-direction:column; gap:0.4rem;' } });
  const listButtons = new Map<number, HTMLButtonElement>();

  for (const hs of exp.hotspots) {
    const itemBtn = el('button', {
      text: `0${hs.id}  ${tx(hs.title)}`,
      attrs: {
        type: 'button',
        style: 'text-align:left; padding:0.55rem 0.75rem; border:1px solid var(--border); border-radius:var(--radius); background:var(--surface); color:var(--ink); font-size:0.84rem; cursor:pointer; font-family:var(--font-sans);'
      }
    });
    itemBtn.addEventListener('click', () => {
      activeSpot = hs;
      syncSelection();
    });
    listButtons.set(hs.id, itemBtn);
    listWrap.append(itemBtn);
  }

  function syncSelection(): void {
    if (!activeSpot) return;
    detailTitle.textContent = `0${activeSpot.id} — ${tx(activeSpot.title)}`;
    detailDesc.textContent = tx(activeSpot.description);
    zoomImg.style.transformOrigin = `${activeSpot.xPercent}% ${activeSpot.yPercent}%`;

    for (const [id, pin] of pinButtons.entries()) {
      const isSelected = id === activeSpot.id;
      pin.style.background = isSelected ? 'var(--signal)' : 'var(--ink)';
      pin.style.transform = isSelected ? 'translate(-50%, -50%) scale(1.18)' : 'translate(-50%, -50%) scale(1)';
    }

    for (const [id, btn] of listButtons.entries()) {
      const isSelected = id === activeSpot.id;
      btn.style.borderColor = isSelected ? 'var(--accent)' : 'var(--border)';
      btn.style.fontWeight = isSelected ? '600' : '400';
    }
  }

  inspector.append(loupeFrame, detailCard, listWrap);
  grid.append(stageWrap, inspector);
  container.append(grid);

  if (currentImgSrc) {
    img.src = currentImgSrc;
  } else {
    fallbackBox.style.display = 'flex';
  }
  syncSelection();

  return () => {
    if (objectUrlToRevoke) URL.revokeObjectURL(objectUrlToRevoke);
  };
}
