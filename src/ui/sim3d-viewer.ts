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
      style: 'display:grid; grid-template-columns: 1.55fr 1fr; gap: 1.25rem; align-items: start;'
    }
  });

  const leftCol = el('div', { attrs: { style: 'display:flex; flex-direction:column; gap:0.85rem;' } });
  const viewport = el('div', {
    attrs: {
      style: 'width:100%; height:360px; border:1px solid var(--border); border-radius:var(--radius); overflow:hidden; position:relative;'
    }
  });

  const hud = el('div', {
    attrs: {
      style: 'position:absolute; top:10px; left:12px; font-family:var(--font-mono); font-size:0.74rem; color:var(--ink-muted); pointer-events:none; background:var(--surface); padding:3px 7px; border-radius:4px; border:1px solid var(--border);'
    }
  });
  viewport.append(hud);

  const plotCanvas = el('canvas', {
    attrs: {
      style: 'width:100%; height:105px; border:1px solid var(--border); border-radius:var(--radius); background:var(--surface); display:block;'
    }
  });
  leftCol.append(viewport, plotCanvas);

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

    const initPct = ((p.defaultValue - p.min) / (p.max - p.min)) * 100;
    const input = el('input', {
      className: 'lab-slider',
      attrs: {
        type: 'range',
        min: String(p.min),
        max: String(p.max),
        step: String(p.step),
        value: String(p.defaultValue),
        style: `--pct: ${initPct.toFixed(1)}%`
      }
    });

    input.addEventListener('input', () => {
      const val = clampNumber(input.value, p.min, p.max, p.defaultValue);
      const pct = ((val - p.min) / (p.max - p.min)) * 100;
      input.style.setProperty('--pct', `${pct.toFixed(1)}%`);
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

  const isDark = resolveEffectiveTheme() === 'dark';
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(isDark ? 0x21201d : 0xefede8);

  const width = viewport.clientWidth || 540;
  const camera = new THREE.PerspectiveCamera(42, width / 360, 0.1, 100);
  camera.position.set(0, 2.2, 4.6);
  camera.lookAt(0, 0.2, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, 360);
  viewport.append(renderer.domElement);

  const ambient = new THREE.AmbientLight(0xffffff, 0.75);
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.35);
  dirLight.position.set(3, 5, 4);
  scene.add(ambient, dirLight);

  const mountPlate = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.14, 1.6),
    new THREE.MeshStandardMaterial({ color: 0x3f3f46, metalness: 0.6, roughness: 0.35 })
  );
  mountPlate.position.y = 1.65;
  scene.add(mountPlate);

  const wire = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.022, 1.75, 16),
    new THREE.MeshStandardMaterial({ color: 0xa1a1aa, metalness: 0.85, roughness: 0.2 })
  );
  wire.position.y = 0.78;
  scene.add(wire);

  const rotorGroup = new THREE.Group();
  rotorGroup.position.y = -0.1;

  // Pirinç disk laboratuvardaki 12 cm yarıçaplı tablaya göre ölçeklendi
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(1.15, 1.15, 0.16, 48),
    new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.72, roughness: 0.28 })
  );
  const marker = new THREE.Mesh(
    new THREE.BoxGeometry(1.12, 0.04, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.4 })
  );
  marker.position.set(0.56, 0.09, 0);

  // Steiner yardımcı silindir kütleleri (I parametresiyle dışa kayar)
  const auxGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.22, 24);
  const auxMat = new THREE.MeshStandardMaterial({ color: 0x52525b, metalness: 0.8, roughness: 0.25 });
  const auxLeft = new THREE.Mesh(auxGeo, auxMat);
  const auxRight = new THREE.Mesh(auxGeo, auxMat);
  auxLeft.position.set(-0.55, 0.18, 0);
  auxRight.position.set(0.55, 0.18, 0);

  rotorGroup.add(disc, marker, auxLeft, auxRight);
  scene.add(rotorGroup);

  const gridHelper = new THREE.GridHelper(5, 10, 0x78716c, 0xdcd8cf);
  gridHelper.position.y = -0.95;
  scene.add(gridHelper);

  const plotCtx = plotCanvas.getContext('2d');
  let rafId = 0;
  const dt = 0.002;

  const animate = () => {
    const inertiaVal = params.inertia ?? 0.012;
    const radialOffset = 0.25 + ((inertiaVal - 0.002) / 0.048) * 0.72;
    auxLeft.position.x = -radialOffset;
    auxRight.position.x = radialOffset;

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

    if (plotCtx) {
      const w = plotCanvas.clientWidth || 540;
      const h = 105;
      if (plotCanvas.width !== w) {
        plotCanvas.width = w;
        plotCanvas.height = h;
      }
      if (!paused) {
        trace.push(theta);
        if (trace.length > Math.floor(w / 2)) trace.shift();
      }

      plotCtx.clearRect(0, 0, w, h);
      plotCtx.strokeStyle = isDark ? '#38352f' : '#dcd8cf';
      plotCtx.beginPath();
      plotCtx.moveTo(0, h / 2);
      plotCtx.lineTo(w, h / 2);
      plotCtx.stroke();

      plotCtx.strokeStyle = '#b91c1c';
      plotCtx.lineWidth = 1.6;
      plotCtx.beginPath();
      for (let i = 0; i < trace.length; i++) {
        const px = (i / Math.max(1, Math.floor(w / 2))) * w;
        const py = h / 2 - (trace[i] ?? 0) * 24;
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
