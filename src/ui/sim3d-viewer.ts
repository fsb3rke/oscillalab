import * as THREE from 'three';
import type { ExperimentModule } from '../core/types';
import { stepRK4 } from '../core/rk4';
import { clampNumber, el } from '../core/sanitize';
import { getLocale, tx } from '../core/i18n';
import { resolveEffectiveTheme } from '../core/theme';

export function mountSim3D(container: HTMLElement, exp: ExperimentModule): () => void {
  const loc = getLocale();
  const params: Record<string, number> = {};
  for (const p of exp.parameters) {
    params[p.id] = p.defaultValue;
  }

  let state = exp.getInitialState(params);
  let tSec = 0;
  let paused = false;
  const trace: number[] = [];

  const layout = el('div', {
    attrs: {
      style: 'display:grid; grid-template-columns: 1.5fr 1fr; gap: 1.25rem; align-items: start;'
    }
  });

  // Sol: Three.js 3B Alanı + Alt Canlı Grafik
  const leftCol = el('div', { attrs: { style: 'display:flex; flex-direction:column; gap:1rem;' } });
  const viewport = el('div', {
    attrs: {
      style: 'width:100%; height:360px; border:1px solid var(--border); border-radius:var(--radius); overflow:hidden; position:relative;'
    }
  });

  const hud = el('div', {
    attrs: {
      style: 'position:absolute; top:10px; left:12px; font-family:var(--font-mono); font-size:0.75rem; color:var(--ink-muted); pointer-events:none;'
    }
  });
  viewport.append(hud);

  const plotCanvas = el('canvas', {
    attrs: {
      style: 'width:100%; height:110px; border:1px solid var(--border); border-radius:var(--radius); background:var(--surface); display:block;'
    }
  });
  leftCol.append(viewport, plotCanvas);

  // Sağ: Parametre Kontrolleri
  const panel = el('div', {
    attrs: {
      style: 'background:var(--surface-subtle); border:1px solid var(--border); border-radius:var(--radius); padding:1.1rem; display:flex; flex-direction:column; gap:0.9rem;'
    }
  });

  for (const p of exp.parameters) {
    const row = el('div', { attrs: { style: 'display:flex; flex-direction:column; gap:0.25rem;' } });
    const top = el('div', {
      attrs: { style: 'display:flex; justify-content:space-between; font-size:0.82rem; font-family:var(--font-mono);' }
    });
    const valSpan = el('span', { text: `${p.defaultValue} ${p.unit}` });
    top.append(el('span', { text: tx(p.label) }), valSpan);

    const input = el('input', {
      attrs: {
        type: 'range',
        min: String(p.min),
        max: String(p.max),
        step: String(p.step),
        value: String(p.defaultValue)
      }
    });

    input.addEventListener('input', () => {
      const val = clampNumber(input.value, p.min, p.max, p.defaultValue);
      params[p.id] = val;
      valSpan.textContent = `${val} ${p.unit}`;
      if (p.id === 'theta0') {
        state = exp.getInitialState(params);
        tSec = 0;
        trace.length = 0;
      }
    });

    row.append(top, input);
    panel.append(row);
  }

  const btnRow = el('div', { attrs: { style: 'display:flex; gap:0.5rem; margin-top:0.4rem;' } });
  const toggleBtn = el('button', {
    className: 'btn',
    text: loc === 'tr' ? 'Duraklat' : 'Pause'
  });
  toggleBtn.addEventListener('click', () => {
    paused = !paused;
    toggleBtn.textContent = paused
      ? (loc === 'tr' ? 'Devam Et' : 'Resume')
      : (loc === 'tr' ? 'Duraklat' : 'Pause');
  });

  const resetBtn = el('button', {
    className: 'btn btn-outline',
    text: loc === 'tr' ? 'Sıfırla' : 'Reset'
  });
  resetBtn.addEventListener('click', () => {
    state = exp.getInitialState(params);
    tSec = 0;
    trace.length = 0;
  });

  btnRow.append(toggleBtn, resetBtn);
  panel.append(btnRow);

  layout.append(leftCol, panel);
  container.append(layout);

  // Three.js Sahnesi
  const isDark = resolveEffectiveTheme() === 'dark';
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(isDark ? 0x141417 : 0xf4f4f5);

  const camera = new THREE.PerspectiveCamera(42, viewport.clientWidth / 360, 0.1, 100);
  camera.position.set(0, 2.2, 4.6);
  camera.lookAt(0, 0.2, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(viewport.clientWidth, 360);
  viewport.append(renderer.domElement);

  const ambient = new THREE.AmbientLight(0xffffff, 0.75);
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.35);
  dirLight.position.set(3, 5, 4);
  scene.add(ambient, dirLight);

  // Üst sabitleme tablası
  const mountPlate = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.14, 1.6),
    new THREE.MeshStandardMaterial({ color: 0x3f3f46, metalness: 0.6, roughness: 0.35 })
  );
  mountPlate.position.y = 1.65;
  scene.add(mountPlate);

  // Çelik burulma teli
  const wire = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.022, 1.75, 16),
    new THREE.MeshStandardMaterial({ color: 0xa1a1aa, metalness: 0.85, roughness: 0.2 })
  );
  wire.position.y = 0.78;
  scene.add(wire);

  // Dönen pirinç/alüminyum disk + referans işaret çubuğu
  const rotorGroup = new THREE.Group();
  rotorGroup.position.y = -0.1;

  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(1.15, 1.15, 0.16, 48),
    new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.72, roughness: 0.28 })
  );
  const marker = new THREE.Mesh(
    new THREE.BoxGeometry(1.12, 0.04, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.4 })
  );
  marker.position.set(0.56, 0.09, 0);

  rotorGroup.add(disc, marker);
  scene.add(rotorGroup);

  const gridHelper = new THREE.GridHelper(5, 10, 0x71717a, 0xd4d4d8);
  gridHelper.position.y = -0.95;
  scene.add(gridHelper);

  const plotCtx = plotCanvas.getContext('2d');
  let rafId = 0;
  const dt = 0.002;

  const animate = () => {
    if (!paused) {
      // const subSteps = 4; // 60Hz ekranda yavas kaldi
      const subSteps = 8;
      for (let i = 0; i < subSteps; i++) {
        state = stepRK4(state, tSec, dt, (s, time) => exp.computeDerivatives(s, time, params));
        tSec += dt;
      }
    }

    const theta = state[0] ?? 0;
    const omega = state[1] ?? 0;
    rotorGroup.rotation.y = theta;

    hud.textContent = `t = ${tSec.toFixed(2)} s  |  θ = ${(theta * 180 / Math.PI).toFixed(1)}°  |  ω = ${omega.toFixed(2)} rad/s`;

    // Alt grafik
    if (plotCtx) {
      const w = plotCanvas.clientWidth;
      const h = 110;
      if (plotCanvas.width !== w) {
        plotCanvas.width = w;
        plotCanvas.height = h;
      }
      if (!paused) {
        trace.push(theta);
        if (trace.length > Math.floor(w / 2)) trace.shift();
      }

      plotCtx.clearRect(0, 0, w, h);
      plotCtx.strokeStyle = isDark ? '#27272a' : '#e4e4e7';
      plotCtx.beginPath();
      plotCtx.moveTo(0, h / 2);
      plotCtx.lineTo(w, h / 2);
      plotCtx.stroke();

      plotCtx.strokeStyle = '#ea580c';
      plotCtx.lineWidth = 1.6;
      plotCtx.beginPath();
      for (let i = 0; i < trace.length; i++) {
        const px = (i / Math.max(1, Math.floor(w / 2))) * w;
        const py = h / 2 - (trace[i] ?? 0) * 26;
        if (i === 0) plotCtx.moveTo(px, py);
        else plotCtx.lineTo(px, py);
      }
      plotCtx.stroke();
    }

    renderer.render(scene, camera);
    rafId = requestAnimationFrame(animate);
  };

  const onResize = () => {
    if (!viewport.clientWidth) return;
    camera.aspect = viewport.clientWidth / 360;
    camera.updateProjectionMatrix();
    renderer.setSize(viewport.clientWidth, 360);
  };
  window.addEventListener('resize', onResize);

  rafId = requestAnimationFrame(animate);

  return () => {
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', onResize);
    renderer.dispose();
  };
}
