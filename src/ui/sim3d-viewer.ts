import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { ExperimentModule } from '../core/types';
import { stepRK4 } from '../core/rk4';
import { clampNumber, el } from '../core/sanitize';
import { getLocale, tx } from '../core/i18n';
import { resolveEffectiveTheme } from '../core/theme';

function createProtractorTexture(): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;

  // Fırçalanmış pirinç taban
  const grad = ctx.createRadialGradient(cx, cy, 20, cx, cy, cx);
  grad.addColorStop(0, '#e6b85c');
  grad.addColorStop(0.75, '#c99332');
  grad.addColorStop(1, '#a6741e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Eşmerkezli torna izleri
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 1;
  for (let r = 40; r < cx - 10; r += 14) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Derece taksimatı (0 - 355)
  for (let deg = 0; deg < 360; deg += 5) {
    const rad = (deg * Math.PI) / 180;
    const isMajor = deg % 30 === 0;
    const isMid = deg % 10 === 0;
    const rOuter = cx - 18;
    const rInner = rOuter - (isMajor ? 42 : isMid ? 28 : 16);

    ctx.strokeStyle = deg === 0 ? '#b91c1c' : '#1c1917';
    ctx.lineWidth = isMajor ? 4 : isMid ? 2.5 : 1.5;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(rad) * rInner, cy + Math.sin(rad) * rInner);
    ctx.lineTo(cx + Math.cos(rad) * rOuter, cy + Math.sin(rad) * rOuter);
    ctx.stroke();

    if (isMajor) {
      ctx.save();
      ctx.translate(cx + Math.cos(rad) * (rInner - 28), cy + Math.sin(rad) * (rInner - 28));
      ctx.rotate(rad + Math.PI / 2);
      ctx.fillStyle = deg === 0 ? '#b91c1c' : '#1c1917';
      ctx.font = 'bold 26px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${deg}°`, 0, 0);
      ctx.restore();
    }
  }

  // Referans eksen çizgisi
  ctx.strokeStyle = '#b91c1c';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + cx - 22, cy);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  return tex;
}

export function mountSim3D(container: HTMLElement, exp: ExperimentModule): () => void {
  const loc = getLocale();
  const params: Record<string, number> = {};
  for (const p of exp.parameters) {
    params[p.id] = p.defaultValue;
  }

  let state = exp.getInitialState(params);
  let tSec = 0;
  let paused = false;
  const thetaTrace: number[] = [];
  const omegaTrace: number[] = [];

  const layout = el('div', {
    attrs: {
      style: 'display:grid; grid-template-columns: 1.65fr 1fr; gap: 1.25rem; align-items: start;'
    }
  });

  const leftCol = el('div', { attrs: { style: 'display:flex; flex-direction:column; gap:0.85rem;' } });
  const viewport = el('div', {
    attrs: {
      style: 'width:100%; height:410px; border:1px solid var(--border); border-radius:var(--radius); overflow:hidden; position:relative; cursor:grab;'
    }
  });

  const hud = el('div', {
    attrs: {
      style: 'position:absolute; top:10px; left:12px; font-family:var(--font-mono); font-size:0.75rem; color:var(--ink); pointer-events:none; background:var(--surface); padding:4px 9px; border-radius:4px; border:1px solid var(--border);'
    }
  });

  const camHint = el('div', {
    text: loc === 'tr' ? 'Sol tık: Döndür • Tekerlek: Yakınlaştır' : 'Drag: Orbit • Scroll: Zoom',
    attrs: {
      style: 'position:absolute; bottom:10px; right:12px; font-family:var(--font-mono); font-size:0.7rem; color:var(--ink-faint); pointer-events:none; background:var(--surface); padding:2px 7px; border-radius:4px; border:1px solid var(--border);'
    }
  });
  viewport.append(hud, camHint);

  const plotCanvas = el('canvas', {
    attrs: {
      style: 'width:100%; height:115px; border:1px solid var(--border); border-radius:var(--radius); background:var(--surface); display:block;'
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
        thetaTrace.length = 0;
        omegaTrace.length = 0;
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
    thetaTrace.length = 0;
    omegaTrace.length = 0;
  });

  btnRow.append(toggleBtn, resetBtn);
  panel.append(btnRow);

  layout.append(leftCol, panel);
  container.append(layout);

  // Three.js Sahne & Gerçekçi PBR Ortam
  const isDark = resolveEffectiveTheme() === 'dark';
  const width = viewport.clientWidth || 560;
  const height = 410;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  viewport.append(renderer.domElement);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(isDark ? 0x1d1c19 : 0xe9e6de);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
  camera.position.set(2.4, 2.5, 4.1);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.25, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.minDistance = 2.2;
  controls.maxDistance = 8.5;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.update();

  const keyLight = new THREE.DirectionalLight(0xfffbeb, 1.8);
  keyLight.position.set(4, 6.5, 3.5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 16;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xdbeafe, 0.55);
  fillLight.position.set(-4, 2, -3);
  scene.add(fillLight);

  // Laboratuvar Masası Yüzeyi
  const tableMesh = new THREE.Mesh(
    new THREE.BoxGeometry(6.5, 0.16, 4.5),
    new THREE.MeshStandardMaterial({ color: isDark ? 0x2b2925 : 0xd6d1c4, roughness: 0.85, metalness: 0.05 })
  );
  tableMesh.position.y = -1.05;
  tableMesh.receiveShadow = true;
  scene.add(tableMesh);

  // Statif Döküm Ayak ve Dikey Krom Taşıyıcı Mil (Arka-Sol)
  const standMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.5, metalness: 0.65 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe4e4e7, roughness: 0.15, metalness: 0.95 });

  const standBase = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 1.5), standMat);
  standBase.position.set(-1.55, -0.9, -0.4);
  standBase.castShadow = true;
  standBase.receiveShadow = true;

  const verticalRod = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 3.1, 20), chromeMat);
  verticalRod.position.set(-1.55, 0.65, -0.4);
  verticalRod.castShadow = true;

  const topArm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.8, 16), chromeMat);
  topArm.rotation.z = Math.PI / 2;
  topArm.rotation.y = Math.atan2(0.4, 1.55);
  topArm.position.set(-0.77, 1.95, -0.2);
  topArm.castShadow = true;

  const clampBoss = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, 0.22), standMat);
  clampBoss.position.set(-1.55, 1.95, -0.4);

  const chuck = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.26, 24), standMat);
  chuck.position.set(0, 1.88, 0);
  chuck.castShadow = true;

  // Sabit Referans İbresi (0° konumunu gösterir)
  const pointerArm = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.03, 0.03), standMat);
  pointerArm.position.set(1.32, 0.05, 0);
  const pointerTip = new THREE.Mesh(
    new THREE.ConeGeometry(0.035, 0.12, 12),
    new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.3 })
  );
  pointerTip.rotation.z = Math.PI;
  pointerTip.position.set(1.12, 0.01, 0);

  scene.add(standBase, verticalRod, topArm, clampBoss, chuck, pointerArm, pointerTip);

  // Çelik Burulma Teli (Yükseklik boyunca segmentli, burulma görselli)
  const wireGeo = new THREE.CylinderGeometry(0.022, 0.022, 1.85, 12, 24);
  const posAttr = wireGeo.attributes.position as THREE.BufferAttribute;
  const wireBasePos = posAttr.array.slice();
  const wire = new THREE.Mesh(wireGeo, chromeMat);
  wire.position.y = 0.88;
  wire.castShadow = true;
  scene.add(wire);

  // Dönen Pirinç Disk + Derece Cetveli Dokusu + Steiner Kütleleri
  const rotorGroup = new THREE.Group();
  rotorGroup.position.y = -0.12;

  const scaleTex = createProtractorTexture();
  const sideBrassMat = new THREE.MeshStandardMaterial({ color: 0xc99332, metalness: 0.82, roughness: 0.24 });
  const topScaleMat = new THREE.MeshStandardMaterial({ map: scaleTex, metalness: 0.55, roughness: 0.32 });

  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(1.18, 1.18, 0.14, 64),
    [sideBrassMat, topScaleMat, sideBrassMat]
  );
  disc.castShadow = true;
  disc.receiveShadow = true;

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.18, 24), standMat);
  hub.position.y = 0.12;

  // Steiner yardımcı silindir kütleleri + kılavuz rayı
  const rail = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.03, 0.08), chromeMat);
  rail.position.y = 0.085;

  const auxGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.24, 28);
  const auxMat = new THREE.MeshStandardMaterial({ color: 0x3f3f46, metalness: 0.85, roughness: 0.22 });
  const auxLeft = new THREE.Mesh(auxGeo, auxMat);
  const auxRight = new THREE.Mesh(auxGeo, auxMat);
  auxLeft.position.set(-0.55, 0.19, 0);
  auxRight.position.set(0.55, 0.19, 0);
  auxLeft.castShadow = true;
  auxRight.castShadow = true;

  rotorGroup.add(disc, hub, rail, auxLeft, auxRight);
  scene.add(rotorGroup);

  const plotCtx = plotCanvas.getContext('2d');
  let rafId = 0;
  const dt = 0.002;

  const animate = () => {
    controls.update();

    const inertiaVal = params.inertia ?? 0.012;
    const radialOffset = 0.28 + ((inertiaVal - 0.002) / 0.048) * 0.68;
    auxLeft.position.x = -radialOffset;
    auxRight.position.x = radialOffset;

    if (!paused) {
      const subSteps = 8;
      for (let i = 0; i < subSteps; i++) {
        state = stepRK4(state, tSec, dt, (s, time) => exp.computeDerivatives(s, time, params));
        tSec += dt;
      }
    }

    const theta = state[0] ?? 0;
    const omega = state[1] ?? 0;
    rotorGroup.rotation.y = theta;

    // Tel üzerindeki doğrusal burulma deformasyonu

    for (let i = 0; i < posAttr.count; i++) {
      const bx = wireBasePos[i * 3]!;
      const by = wireBasePos[i * 3 + 1]!;
      const bz = wireBasePos[i * 3 + 2]!;
      const frac = Math.max(0, Math.min(1, (0.925 - by) / 1.85));
      const twist = theta * frac;
      posAttr.setXYZ(
        i,
        bx * Math.cos(twist) - bz * Math.sin(twist),
        by,
        bx * Math.sin(twist) + bz * Math.cos(twist)
      );
    }
    posAttr.needsUpdate = true;

    const kappa = params.kappa ?? 0.12;
    const period = 2 * Math.PI * Math.sqrt(inertiaVal / kappa);
    hud.textContent = `t = ${tSec.toFixed(2)} s | θ = ${(theta * 180 / Math.PI).toFixed(1)}° | ω = ${omega.toFixed(2)} rad/s | T₀ = ${period.toFixed(2)} s`;

    if (plotCtx) {
      const w = plotCanvas.clientWidth || 560;
      const h = 115;
      if (plotCanvas.width !== w) {
        plotCanvas.width = w;
        plotCanvas.height = h;
      }
      const maxPts = Math.max(80, Math.floor(w / 2));
      if (!paused) {
        thetaTrace.push(theta);
        omegaTrace.push(omega);
        if (thetaTrace.length > maxPts) thetaTrace.shift();
        if (omegaTrace.length > maxPts) omegaTrace.shift();
      }

      plotCtx.clearRect(0, 0, w, h);
      plotCtx.strokeStyle = isDark ? '#38352f' : '#dcd8cf';
      plotCtx.beginPath();
      plotCtx.moveTo(0, h / 2);
      plotCtx.lineTo(w, h / 2);
      plotCtx.stroke();

      // ω(t) eğrisi (mavi)
      plotCtx.strokeStyle = isDark ? '#93c5fd' : '#1e3a8a';
      plotCtx.lineWidth = 1.2;
      plotCtx.beginPath();
      for (let i = 0; i < omegaTrace.length; i++) {
        const px = (i / maxPts) * w;
        const py = h / 2 - (omegaTrace[i] ?? 0) * 7;
        if (i === 0) plotCtx.moveTo(px, py);
        else plotCtx.lineTo(px, py);
      }
      plotCtx.stroke();

      // θ(t) eğrisi (kırmızı)
      plotCtx.strokeStyle = '#b91c1c';
      plotCtx.lineWidth = 1.75;
      plotCtx.beginPath();
      for (let i = 0; i < thetaTrace.length; i++) {
        const px = (i / maxPts) * w;
        const py = h / 2 - (thetaTrace[i] ?? 0) * 20;
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
    camera.aspect = viewport.clientWidth / height;
    camera.updateProjectionMatrix();
    renderer.setSize(viewport.clientWidth, height);
  };
  window.addEventListener('resize', onResize);

  rafId = requestAnimationFrame(animate);

  return () => {
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', onResize);
    controls.dispose();
    scaleTex.dispose();
    pmrem.dispose();
    renderer.dispose();
  };
}
