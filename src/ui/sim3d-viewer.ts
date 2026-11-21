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

  const grad = ctx.createRadialGradient(cx, cy, 30, cx, cy, cx);
  grad.addColorStop(0, '#edd082');
  grad.addColorStop(0.72, '#c89132');
  grad.addColorStop(0.94, '#b07b22');
  grad.addColorStop(1, '#8c5e14');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.lineWidth = 1;
  for (let r = 36; r < cx - 8; r += 11) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (let deg = 0; deg < 360; deg += 2) {
    const rad = (deg * Math.PI) / 180;
    const isMajor = deg % 30 === 0;
    const isMid = deg % 10 === 0;
    const rOuter = cx - 14;
    const rInner = rOuter - (isMajor ? 46 : isMid ? 30 : 15);

    ctx.strokeStyle = deg === 0 ? '#b91c1c' : '#1c1917';
    ctx.lineWidth = isMajor ? 4 : isMid ? 2.4 : 1.1;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(rad) * rInner, cy + Math.sin(rad) * rInner);
    ctx.lineTo(cx + Math.cos(rad) * rOuter, cy + Math.sin(rad) * rOuter);
    ctx.stroke();

    if (isMajor) {
      ctx.save();
      ctx.translate(cx + Math.cos(rad) * (rInner - 30), cy + Math.sin(rad) * (rInner - 30));
      ctx.rotate(rad + Math.PI / 2);
      ctx.fillStyle = deg === 0 ? '#b91c1c' : '#1c1917';
      ctx.font = 'bold 26px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${deg}°`, 0, 0);
      ctx.restore();
    }
  }

  ctx.strokeStyle = '#b91c1c';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + cx - 18, cy);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  return tex;
}

function createRulerTexture(vertical = false): THREE.CanvasTexture {
  const w = vertical ? 96 : 512;
  const h = vertical ? 512 : 64;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#e4e4e7';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = '#18181b';
  ctx.fillStyle = '#18181b';
  ctx.font = 'bold 16px monospace';
  ctx.textBaseline = 'middle';

  if (!vertical) {
    for (let i = 0; i <= 40; i++) {
      const x = (i / 40) * w;
      const major = i % 5 === 0;
      ctx.lineWidth = major ? 2.5 : 1.2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, major ? 28 : 16);
      ctx.stroke();
    }
  } else {
    for (let i = 0; i <= 40; i++) {
      const y = (i / 40) * h;
      const isZero = i === 20;
      const major = i % 5 === 0;
      ctx.strokeStyle = isZero ? '#b91c1c' : '#18181b';
      ctx.lineWidth = isZero ? 3 : major ? 2.2 : 1.1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(isZero ? 44 : major ? 32 : 18, y);
      ctx.stroke();

      if (major && i > 0 && i < 40) {
        const cm = 20 - i;
        ctx.fillStyle = isZero ? '#b91c1c' : '#18181b';
        ctx.fillText(`${cm > 0 ? '+' : ''}${cm}`, 38, y);
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  return tex;
}

export function mountSim3D(container: HTMLElement, exp: ExperimentModule): () => void {
  if (exp.id === 'driven-spring-mass') {
    return mountSpringMass3D(container, exp);
  }
  return mountTorsionalPendulum3D(container, exp);
}

function mountSpringMass3D(container: HTMLElement, exp: ExperimentModule): () => void {
  const loc = getLocale();
  const params: Record<string, number> = {};
  for (const p of exp.parameters) {
    params[p.id] = p.defaultValue;
  }

  let state = exp.getInitialState(params);
  let tSec = 0;
  let paused = false;
  let showVectors = true;
  let plotMode: 'time' | 'phase' = 'time';
  let isDraggingMass = false;
  const xTrace: number[] = [];
  const vTrace: number[] = [];
  const driveTrace: number[] = [];

  const layout = el('div', {
    attrs: {
      style: 'display:grid; grid-template-columns: 1.7fr 1fr; gap: 1.25rem; align-items: start;'
    }
  });

  const leftCol = el('div', { attrs: { style: 'display:flex; flex-direction:column; gap:0.8rem;' } });
  const viewport = el('div', {
    attrs: {
      style: 'width:100%; height:440px; border:1px solid var(--border); border-radius:var(--radius); overflow:hidden; position:relative; cursor:grab;'
    }
  });

  const hud = el('div', {
    attrs: {
      style: 'position:absolute; top:10px; left:12px; font-family:var(--font-mono); font-size:0.73rem; color:var(--ink); pointer-events:none; background:var(--surface); padding:5px 10px; border-radius:4px; border:1px solid var(--border); line-height:1.45;'
    }
  });

  const camBar = el('div', {
    attrs: { style: 'position:absolute; top:10px; right:12px; display:flex; gap:4px; z-index:5;' }
  });

  const camViews: { label: string; pos: [number, number, number]; target: [number, number, number] }[] = [
    { label: ({ tr: 'İzometrik', en: 'Iso', de: 'Iso', fr: 'Iso' })[loc], pos: [2.5, 1.35, 3.8], target: [0, 0.25, 0] },
    { label: ({ tr: 'Önden (Cetvel)', en: 'Front', de: 'Front', fr: 'Face' })[loc], pos: [0, 0.35, 4.3], target: [0, 0.25, 0] },
    { label: ({ tr: 'Yandan', en: 'Side', de: 'Seite', fr: 'Profil' })[loc], pos: [4.2, 0.35, 0], target: [0, 0.25, 0] }
  ];

  const camHint = el('div', {
    text: ({
      tr: 'Kütle bloğu: Başlangıç konumu (x₀) • Dış alan: Kamera yörüngesi',
      en: 'Mass block: Set initial position (x₀) • Background: Orbit camera',
      de: 'Masseblock: Anfangsposition (x₀) • Hintergrund: Kamera drehen',
      fr: 'Bloc masse : Position initiale (x₀) • Arrière-plan : Orbite caméra'
    })[loc],
    attrs: {
      style: 'position:absolute; bottom:10px; right:12px; font-family:var(--font-mono); font-size:0.7rem; color:var(--ink-faint); pointer-events:none; background:var(--surface); padding:3px 8px; border-radius:4px; border:1px solid var(--border);'
    }
  });
  viewport.append(hud, camBar, camHint);

  const plotWrap = el('div', {
    attrs: {
      style: 'border:1px solid var(--border); border-radius:var(--radius); background:var(--surface); padding:0.5rem 0.65rem;'
    }
  });
  const plotHead = el('div', {
    attrs: {
      style: 'display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem; font-family:var(--font-mono); font-size:0.72rem; color:var(--ink-muted);'
    }
  });
  const timeLegendText = ({
    tr: 'x(t) konum (kırmızı)  |  F_d(t) tahrik fazı (lacivert)',
    en: 'x(t) displacement (red)  |  F_d(t) drive phase (blue)',
    de: 'x(t) Auslenkung (rot)  |  F_d(t) Erregerphase (blau)',
    fr: 'x(t) élongation (rouge)  |  F_d(t) phase excitation (bleu)'
  })[loc];
  const phaseLegendText = ({
    tr: 'Faz Uzayı Yörüngesi: v(x)',
    en: 'Phase Space Trajectory: v(x)',
    de: 'Phasenraum-Trajektorie: v(x)',
    fr: 'Trajectoire dans l’Espace des Phases : v(x)'
  })[loc];

  const plotLegend = el('span', { text: timeLegendText });
  const plotToggleBtn = el('button', {
    className: 'btn btn-outline',
    text: ({ tr: 'Faz Uzayı (v–x)', en: 'Phase Space (v–x)', de: 'Phasenraum (v–x)', fr: 'Espace des Phases (v–x)' })[loc],
    attrs: { style: 'padding:2px 8px; font-size:0.72rem;' }
  });
  plotToggleBtn.addEventListener('click', () => {
    plotMode = plotMode === 'time' ? 'phase' : 'time';
    if (plotMode === 'phase') {
      plotLegend.textContent = phaseLegendText;
      plotToggleBtn.textContent = ({ tr: 'Zaman Grafiği', en: 'Time Series', de: 'Zeitverlauf', fr: 'Série Temporelle' })[loc];
    } else {
      plotLegend.textContent = timeLegendText;
      plotToggleBtn.textContent = ({ tr: 'Faz Uzayı (v–x)', en: 'Phase Space (v–x)', de: 'Phasenraum (v–x)', fr: 'Espace des Phases (v–x)' })[loc];
    }
  });
  plotHead.append(plotLegend, plotToggleBtn);

  const plotCanvas = el('canvas', {
    attrs: { style: 'width:100%; height:110px; display:block;' }
  });
  plotWrap.append(plotHead, plotCanvas);
  leftCol.append(viewport, plotWrap);

  // Kontrol Paneli
  const panel = el('div', {
    attrs: {
      style: 'background:var(--surface-subtle); border:1px solid var(--border); border-radius:var(--radius); padding:1.1rem; display:flex; flex-direction:column; gap:0.8rem;'
    }
  });

  const sliderMap = new Map<string, { input: HTMLInputElement; valSpan: HTMLElement; unit: string; min: number; max: number }>();

  for (const p of exp.parameters) {
    const row = el('div', { attrs: { style: 'display:flex; flex-direction:column; gap:0.2rem;' } });
    const top = el('div', {
      attrs: { style: 'display:flex; justify-content:space-between; font-size:0.81rem; font-family:var(--font-mono);' }
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
    });

    sliderMap.set(p.id, { input, valSpan, unit: p.unit, min: p.min, max: p.max });
    row.append(top, input);
    panel.append(row);
  }

  // Rezonans Frekansına Hızlı Ayarla Düğmesi
  const resSnapBtn = el('button', {
    className: 'btn btn-outline',
    text: ({
      tr: 'Zorlama Frekansını Rezonansa (ω_rez) Eşitle',
      en: 'Tune Drive Frequency to Resonance (ω_res)',
      de: 'Erregerfrequenz auf Resonanz (ω_res) setzen',
      fr: 'Accorder sur la Résonance (ω_rés)'
    })[loc],
    attrs: { style: 'font-size:0.78rem; width:100%;' }
  });
  resSnapBtn.addEventListener('click', () => {
    const m = params.mass ?? 0.45;
    const k = params.k ?? 14.0;
    const b = params.damping ?? 0.25;
    const w0Sq = k / m;
    const gamma = b / (2 * m);
    const wRes = Math.sqrt(Math.max(0.25, w0Sq - 2 * gamma * gamma));
    const entry = sliderMap.get('driveFreq');
    if (entry) {
      const clamped = clampNumber(Math.round(wRes * 10) / 10, entry.min, entry.max, wRes);
      params.driveFreq = clamped;
      entry.input.value = String(clamped);
      const pct = ((clamped - entry.min) / (entry.max - entry.min)) * 100;
      entry.input.style.setProperty('--pct', `${pct.toFixed(1)}%`);
      entry.valSpan.textContent = `${clamped} ${entry.unit}`;
    }
  });
  panel.append(resSnapBtn);

  const vecLabel = el('label', {
    attrs: {
      style: 'display:flex; align-items:center; gap:0.5rem; font-size:0.81rem; cursor:pointer; color:var(--ink);'
    }
  });
  const vecCheck = el('input', { attrs: { type: 'checkbox', checked: 'true' } });
  vecCheck.addEventListener('change', () => {
    showVectors = vecCheck.checked;
  });
  vecLabel.append(
    vecCheck,
    document.createTextNode(({
      tr: '3B Yay Kuvveti (-kx) ve Tahrik Kuvveti (F_d) Vektörleri',
      en: '3D Spring Force (-kx) & Driving Force (F_d) Vectors',
      de: '3D Federkraft (-kx) & Erregerkraft (F_d) Vektoren',
      fr: 'Vecteurs Force de Rappel (-kx) et Excitation (F_d)'
    })[loc])
  );
  panel.append(vecLabel);

  const btnRow = el('div', { attrs: { style: 'display:flex; gap:0.5rem; margin-top:0.2rem;' } });
  const toggleBtn = el('button', {
    className: 'btn',
    text: ({ tr: 'Duraklat', en: 'Pause', de: 'Pause', fr: 'Pause' })[loc]
  });
  toggleBtn.addEventListener('click', () => {
    paused = !paused;
    toggleBtn.textContent = paused
      ? ({ tr: 'Devam Et', en: 'Resume', de: 'Fortsetzen', fr: 'Reprendre' })[loc]
      : ({ tr: 'Duraklat', en: 'Pause', de: 'Pause', fr: 'Pause' })[loc];
  });

  const resetBtn = el('button', {
    className: 'btn btn-outline',
    text: ({ tr: 'Sıfırla', en: 'Reset', de: 'Zurücksetzen', fr: 'Réinitialiser' })[loc]
  });
  resetBtn.addEventListener('click', () => {
    state = exp.getInitialState(params);
    tSec = 0;
    xTrace.length = 0;
    vTrace.length = 0;
    driveTrace.length = 0;
  });

  btnRow.append(toggleBtn, resetBtn);
  panel.append(btnRow);

  layout.append(leftCol, panel);
  container.append(layout);

  // Three.js Sahnesi
  const isDark = resolveEffectiveTheme() === 'dark';
  const width = viewport.clientWidth || 580;
  const height = 440;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  viewport.append(renderer.domElement);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(isDark ? 0x1a1916 : 0xe7e3da);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
  camera.position.set(2.5, 1.35, 3.8);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.25, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.minDistance = 2.0;
  controls.maxDistance = 8.5;
  controls.update();

  for (const v of camViews) {
    const cBtn = el('button', {
      className: 'btn btn-outline',
      text: v.label,
      attrs: { style: 'padding:2px 7px; font-size:0.7rem; background:var(--surface);' }
    });
    cBtn.addEventListener('click', () => {
      camera.position.set(...v.pos);
      controls.target.set(...v.target);
      controls.update();
    });
    camBar.append(cBtn);
  }

  const keyLight = new THREE.DirectionalLight(0xfffbeb, 1.9);
  keyLight.position.set(3.8, 6.2, 3.8);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.bias = -0.0005;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xdbeafe, 0.6);
  fillLight.position.set(-4, 2.5, -3);
  scene.add(fillLight);

  const tableMesh = new THREE.Mesh(
    new THREE.BoxGeometry(7.2, 0.18, 5.2),
    new THREE.MeshStandardMaterial({ color: isDark ? 0x262420 : 0xd3cec0, roughness: 0.88, metalness: 0.04 })
  );
  tableMesh.position.y = -1.35;
  tableMesh.receiveShadow = true;
  scene.add(tableMesh);

  const castIronMat = new THREE.MeshStandardMaterial({ color: 0x222225, roughness: 0.55, metalness: 0.65 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xededf0, roughness: 0.14, metalness: 0.96 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xc89132, roughness: 0.24, metalness: 0.85 });

  // Laboratuvar Statif Şasisi + Dikey Milimetrik Cetvel
  const standBase = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.15, 1.45), castIronMat);
  standBase.position.set(-0.45, -1.19, -0.25);
  standBase.castShadow = true;
  standBase.receiveShadow = true;

  const mainColumn = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.35, 24), chromeMat);
  mainColumn.position.set(-1.1, 0.5, -0.35);
  mainColumn.castShadow = true;

  const topBracket = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.14, 0.24), castIronMat);
  topBracket.position.set(-0.45, 2.08, -0.35);
  topBracket.castShadow = true;

  const vRulerTex = createRulerTexture(true);
  const scaleBoard = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 2.05, 0.03),
    new THREE.MeshStandardMaterial({ map: vRulerTex, roughness: 0.35, metalness: 0.1 })
  );
  scaleBoard.position.set(-0.72, -0.05, -0.25);
  scene.add(standBase, mainColumn, topBracket, scaleBoard);

  // Üst Sinüzoidal Tahrik Ünitesi (Motor Gövdesi + Eksantrik Volan + Tahrik Pistonu)
  const motorHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.34, 24), castIronMat);
  motorHousing.rotation.x = Math.PI / 2;
  motorHousing.position.set(0, 2.08, -0.32);

  const flywheelGroup = new THREE.Group();
  flywheelGroup.position.set(0, 2.08, -0.08);
  const flywheel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.05, 32), brassMat);
  flywheel.rotation.x = Math.PI / 2;
  const crankPin = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 16), chromeMat);
  crankPin.rotation.x = Math.PI / 2;
  crankPin.position.set(0.18, 0, 0.05);
  flywheelGroup.add(flywheel, crankPin);

  const drivePiston = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.45, 16), chromeMat);
  const upperHook = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.015, 10, 20), chromeMat);
  scene.add(motorHousing, flywheelGroup, drivePiston, upperHook);

  // Dinamik 3B Helisel Yay (Segman Halkaları ile Gerçekçi Uzama/Sıkışma)
  const springGroup = new THREE.Group();
  const coilCount = 22;
  const springRadius = 0.17;
  const wireRadius = 0.018;
  const coils: THREE.Mesh[] = [];
  const coilGeo = new THREE.TorusGeometry(springRadius, wireRadius, 10, 28);
  for (let i = 0; i < coilCount; i++) {
    const ring = new THREE.Mesh(coilGeo, chromeMat);
    ring.rotation.x = Math.PI / 2 + 0.12;
    ring.castShadow = true;
    coils.push(ring);
    springGroup.add(ring);
  }
  scene.add(springGroup);

  // Asılı Kütle Bloğu ve Ayarlanabilir Disk Ağırlıklar
  const massGroup = new THREE.Group();
  const carrierRod = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.52, 16), chromeMat);
  const basePlate = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.06, 32), brassMat);
  basePlate.position.y = -0.22;
  basePlate.castShadow = true;
  massGroup.add(carrierRod, basePlate);

  const weightDisks: THREE.Mesh[] = [];
  const diskGeo = new THREE.CylinderGeometry(0.29, 0.29, 0.045, 32);
  for (let i = 0; i < 6; i++) {
    const wDisk = new THREE.Mesh(diskGeo, i % 2 === 0 ? castIronMat : brassMat);
    wDisk.position.y = -0.165 + i * 0.05;
    wDisk.castShadow = true;
    weightDisks.push(wDisk);
    massGroup.add(wDisk);
  }

  // Konum Okuma İbresi (Cetvel hizasında)
  const needle = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.02, 0.02),
    new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.3 })
  );
  needle.position.set(-0.42, -0.05, -0.12);
  massGroup.add(needle);

  // Manyetik Eddy-Akımı Sönümleyici (Alüminyum kanatçık + Neodyum mıknatıs çeneleri)
  const aluVane = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.34, 0.018),
    new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.9, roughness: 0.25 })
  );
  aluVane.position.set(0.42, -0.05, 0);
  massGroup.add(aluVane);
  scene.add(massGroup);

  const magnetStand = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.15, 14), chromeMat);
  magnetStand.position.set(0.66, -0.62, 0);
  const magnetFront = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, 0.08), castIronMat);
  const magnetBack = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, 0.08), castIronMat);
  scene.add(magnetStand, magnetFront, magnetBack);

  // Kuvvet Vektör Okları
  const springArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0.38, 0, 0.15), 0.4, 0xb91c1c, 0.13, 0.08);
  const driveArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-0.38, 1.65, 0.15), 0.4, 0x1e3a8a, 0.13, 0.08);
  scene.add(springArrow, driveArrow);

  // Kütle Bloğunu Fareyle Çekip Konum Ayarlama
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const hitPoint = new THREE.Vector3();
  const eqY = -0.05;

  const updatePointer = (e: PointerEvent) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    updatePointer(e);
    raycaster.setFromCamera(pointerNdc, camera);
    const hits = raycaster.intersectObjects([basePlate, ...weightDisks], false);
    if (hits.length > 0) {
      isDraggingMass = true;
      controls.enabled = false;
      viewport.style.cursor = 'ns-resize';
    }
  };

  const onPointerMove = (e: PointerEvent) => {
    updatePointer(e);
    raycaster.setFromCamera(pointerNdc, camera);

    if (isDraggingMass) {
      if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
        const disp = clampNumber((hitPoint.y - eqY) * 0.45, -0.45, 0.45, 0);
        state = [disp, 0];
      }
      return;
    }

    const hits = raycaster.intersectObjects([basePlate, ...weightDisks], false);
    const isHover = hits.length > 0;
    brassMat.emissive.setHex(isHover ? 0x3b2706 : 0x000000);
    viewport.style.cursor = isHover ? 'ns-resize' : 'grab';
  };

  const onPointerUp = () => {
    if (isDraggingMass) {
      isDraggingMass = false;
      controls.enabled = true;
      viewport.style.cursor = 'grab';
    }
  };

  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);

  const plotCtx = plotCanvas.getContext('2d');
  let rafId = 0;
  const dt = 0.002;

  const animate = () => {
    controls.update();

    const m = params.mass ?? 0.45;
    const k = params.k ?? 14.0;
    const b = params.damping ?? 0.25;
    const f0 = params.driveAmp ?? 1.2;
    const wd = params.driveFreq ?? 5.5;

    // Kütle diskleri görünürlüğü
    const activeDisks = Math.max(1, Math.min(6, Math.round((m / 2.0) * 6)));
    for (let i = 0; i < weightDisks.length; i++) {
      weightDisks[i]!.visible = i < activeDisks;
    }

    // Mıknatıs çenelerinin sönümleme katsayısına göre alüminyum kanatçığa yaklaşması
    const gap = 0.26 - (b / 2.5) * 0.19;
    magnetFront.position.set(0.46, eqY, gap);
    magnetBack.position.set(0.46, eqY, -gap);

    if (!paused && !isDraggingMass) {
      const subSteps = 8;
      for (let i = 0; i < subSteps; i++) {
        state = stepRK4(state, tSec, dt, (s, time) => exp.computeDerivatives(s, time, params));
        tSec += dt;
      }
    }

    const x = state[0] ?? 0;
    const v = state[1] ?? 0;
    const drivePhase = wd * tSec;
    const driveNorm = f0 > 0 ? Math.cos(drivePhase) : 0;

    // Eksantrik volan ve üst piston hareketi
    flywheelGroup.rotation.z = drivePhase;
    const pistonDisp = (f0 / 4.0) * 0.16 * Math.cos(drivePhase);
    const springTopY = 1.62 + pistonDisp;
    drivePiston.position.set(0, springTopY + 0.22, 0);
    upperHook.position.set(0, springTopY, 0);

    // Kütle konumu ve yay sarmalı dizilimi
    const massY = eqY + x * 2.1;
    massGroup.position.y = massY - eqY;
    const springBottomY = massY + 0.26;
    const span = Math.max(0.25, springTopY - springBottomY);

    for (let i = 0; i < coilCount; i++) {
      const frac = (i + 0.5) / coilCount;
      coils[i]!.position.y = springTopY - frac * span;
    }

    // Kuvvet vektör okları
    const fSpring = -k * x;
    const fDrive = f0 * Math.cos(drivePhase);
    springArrow.visible = showVectors && Math.abs(fSpring) > 0.05;
    driveArrow.visible = showVectors && Math.abs(fDrive) > 0.05;
    if (springArrow.visible) {
      springArrow.position.set(0.38, massY, 0.18);
      springArrow.setDirection(new THREE.Vector3(0, fSpring >= 0 ? 1 : -1, 0));
      springArrow.setLength(Math.min(1.05, 0.16 + Math.abs(fSpring) * 0.12), 0.13, 0.08);
    }
    if (driveArrow.visible) {
      driveArrow.position.set(-0.35, springTopY, 0.18);
      driveArrow.setDirection(new THREE.Vector3(0, fDrive >= 0 ? 1 : -1, 0));
      driveArrow.setLength(Math.min(0.95, 0.16 + Math.abs(fDrive) * 0.18), 0.13, 0.08);
    }

    const w0 = Math.sqrt(k / m);
    hud.textContent = `t = ${tSec.toFixed(2)} s | x = ${(x * 100).toFixed(1)} cm | v = ${v.toFixed(2)} m/s | ω₀ = ${w0.toFixed(2)} rad/s | ω_d/ω₀ = ${(wd / w0).toFixed(2)}`;

    if (plotCtx) {
      const w = plotCanvas.clientWidth || 560;
      const h = 110;
      if (plotCanvas.width !== w) {
        plotCanvas.width = w;
        plotCanvas.height = h;
      }
      const maxPts = Math.max(140, Math.floor(w / 2));
      if (!paused && !isDraggingMass) {
        xTrace.push(x);
        vTrace.push(v);
        driveTrace.push(driveNorm * (f0 / 4.0));
        if (xTrace.length > maxPts) xTrace.shift();
        if (vTrace.length > maxPts) vTrace.shift();
        if (driveTrace.length > maxPts) driveTrace.shift();
      }

      plotCtx.clearRect(0, 0, w, h);
      plotCtx.strokeStyle = isDark ? '#38352f' : '#dcd8cf';
      plotCtx.lineWidth = 1;

      if (plotMode === 'time') {
        plotCtx.beginPath();
        plotCtx.moveTo(0, h / 2);
        plotCtx.lineTo(w, h / 2);
        plotCtx.stroke();

        // Tahrik faz sinyali (lacivert)
        plotCtx.strokeStyle = isDark ? '#93c5fd' : '#1e3a8a';
        plotCtx.lineWidth = 1.2;
        plotCtx.beginPath();
        for (let i = 0; i < driveTrace.length; i++) {
          const px = (i / maxPts) * w;
          const py = h / 2 - (driveTrace[i] ?? 0) * 38;
          if (i === 0) plotCtx.moveTo(px, py);
          else plotCtx.lineTo(px, py);
        }
        plotCtx.stroke();

        // Konum x(t) (kırmızı)
        plotCtx.strokeStyle = '#b91c1c';
        plotCtx.lineWidth = 1.8;
        plotCtx.beginPath();
        for (let i = 0; i < xTrace.length; i++) {
          const px = (i / maxPts) * w;
          const py = h / 2 - (xTrace[i] ?? 0) * 95;
          if (i === 0) plotCtx.moveTo(px, py);
          else plotCtx.lineTo(px, py);
        }
        plotCtx.stroke();
      } else {
        plotCtx.beginPath();
        plotCtx.moveTo(w / 2, 4);
        plotCtx.lineTo(w / 2, h - 4);
        plotCtx.moveTo(8, h / 2);
        plotCtx.lineTo(w - 8, h / 2);
        plotCtx.stroke();

        plotCtx.strokeStyle = isDark ? '#93c5fd' : '#1e3a8a';
        plotCtx.lineWidth = 1.6;
        plotCtx.beginPath();
        for (let i = 0; i < xTrace.length; i++) {
          const px = w / 2 + (xTrace[i] ?? 0) * 190;
          const py = h / 2 - (vTrace[i] ?? 0) * 22;
          if (i === 0) plotCtx.moveTo(px, py);
          else plotCtx.lineTo(px, py);
        }
        plotCtx.stroke();

        const lastX = xTrace[xTrace.length - 1] ?? x;
        const lastV = vTrace[vTrace.length - 1] ?? v;
        plotCtx.fillStyle = '#b91c1c';
        plotCtx.beginPath();
        plotCtx.arc(w / 2 + lastX * 190, h / 2 - lastV * 22, 3.5, 0, Math.PI * 2);
        plotCtx.fill();
      }
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
    renderer.domElement.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    controls.dispose();
    vRulerTex.dispose();
    pmrem.dispose();
    renderer.dispose();
  };
}

function mountTorsionalPendulum3D(container: HTMLElement, exp: ExperimentModule): () => void {
  const loc = getLocale();
  const params: Record<string, number> = {};
  for (const p of exp.parameters) {
    params[p.id] = p.defaultValue;
  }

  let state = exp.getInitialState(params);
  let tSec = 0;
  let paused = false;
  let showVectors = true;
  let plotMode: 'time' | 'phase' = 'time';
  let isDraggingDisc = false;
  const thetaTrace: number[] = [];
  const omegaTrace: number[] = [];

  const layout = el('div', {
    attrs: {
      style: 'display:grid; grid-template-columns: 1.7fr 1fr; gap: 1.25rem; align-items: start;'
    }
  });

  const leftCol = el('div', { attrs: { style: 'display:flex; flex-direction:column; gap:0.8rem;' } });
  const viewport = el('div', {
    attrs: {
      style: 'width:100%; height:440px; border:1px solid var(--border); border-radius:var(--radius); overflow:hidden; position:relative; cursor:grab;'
    }
  });

  const hud = el('div', {
    attrs: {
      style: 'position:absolute; top:10px; left:12px; font-family:var(--font-mono); font-size:0.74rem; color:var(--ink); pointer-events:none; background:var(--surface); padding:5px 10px; border-radius:4px; border:1px solid var(--border); line-height:1.45;'
    }
  });

  const camBar = el('div', {
    attrs: {
      style: 'position:absolute; top:10px; right:12px; display:flex; gap:4px; z-index:5;'
    }
  });

  const camViews: { label: string; pos: [number, number, number]; target: [number, number, number] }[] = [
    { label: ({ tr: 'İzometrik', en: 'Iso', de: 'Iso', fr: 'Iso' })[loc], pos: [2.35, 2.35, 3.85], target: [0, 0.2, 0] },
    { label: ({ tr: 'Üst (Cetvel)', en: 'Top', de: 'Oben', fr: 'Dessus' })[loc], pos: [0.01, 3.9, 0.01], target: [0, -0.1, 0] },
    { label: ({ tr: 'Yandan', en: 'Side', de: 'Seite', fr: 'Profil' })[loc], pos: [3.9, 0.45, 0], target: [0, 0.35, 0] }
  ];

  const camHint = el('div', {
    text: ({
      tr: 'Disk yüzeyi: Başlangıç açısı (θ₀) ayarı • Dış alan: Kamera yörüngesi',
      en: 'Disc surface: Set initial angle (θ₀) • Background: Orbit camera',
      de: 'Scheibenfläche: Anfangswinkel (θ₀) • Hintergrund: Kamera drehen',
      fr: 'Surface du disque : Angle initial (θ₀) • Arrière-plan : Orbite caméra'
    })[loc],
    attrs: {
      style: 'position:absolute; bottom:10px; right:12px; font-family:var(--font-mono); font-size:0.7rem; color:var(--ink-faint); pointer-events:none; background:var(--surface); padding:3px 8px; border-radius:4px; border:1px solid var(--border);'
    }
  });
  viewport.append(hud, camBar, camHint);

  const plotWrap = el('div', {
    attrs: {
      style: 'border:1px solid var(--border); border-radius:var(--radius); background:var(--surface); padding:0.5rem 0.65rem;'
    }
  });
  const plotHead = el('div', {
    attrs: {
      style: 'display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem; font-family:var(--font-mono); font-size:0.72rem; color:var(--ink-muted);'
    }
  });
  const plotLegend = el('span', {
    text: ({
      tr: 'θ(t) kırmızı  |  ω(t) lacivert',
      en: 'θ(t) red  |  ω(t) blue',
      de: 'θ(t) rot  |  ω(t) blau',
      fr: 'θ(t) rouge  |  ω(t) bleu'
    })[loc]
  });
  const plotToggleBtn = el('button', {
    className: 'btn btn-outline',
    text: ({ tr: 'Faz Uzayı (ω–θ)', en: 'Phase Space (ω–θ)', de: 'Phasenraum (ω–θ)', fr: 'Espace des Phases (ω–θ)' })[loc],
    attrs: { style: 'padding:2px 8px; font-size:0.72rem;' }
  });
  plotToggleBtn.addEventListener('click', () => {
    plotMode = plotMode === 'time' ? 'phase' : 'time';
    if (plotMode === 'phase') {
      plotLegend.textContent = ({
        tr: 'Faz Yörüngesi: ω(θ)',
        en: 'Phase Trajectory: ω(θ)',
        de: 'Phasen-Trajektorie: ω(θ)',
        fr: 'Trajectoire de Phase : ω(θ)'
      })[loc];
      plotToggleBtn.textContent = ({ tr: 'Zaman Grafiği', en: 'Time Series', de: 'Zeitverlauf', fr: 'Série Temporelle' })[loc];
    } else {
      plotLegend.textContent = ({
        tr: 'θ(t) kırmızı  |  ω(t) lacivert',
        en: 'θ(t) red  |  ω(t) blue',
        de: 'θ(t) rot  |  ω(t) blau',
        fr: 'θ(t) rouge  |  ω(t) bleu'
      })[loc];
      plotToggleBtn.textContent = ({ tr: 'Faz Uzayı (ω–θ)', en: 'Phase Space (ω–θ)', de: 'Phasenraum (ω–θ)', fr: 'Espace des Phases (ω–θ)' })[loc];
    }
  });
  plotHead.append(plotLegend, plotToggleBtn);

  const plotCanvas = el('canvas', {
    attrs: { style: 'width:100%; height:110px; display:block;' }
  });
  plotWrap.append(plotHead, plotCanvas);
  leftCol.append(viewport, plotWrap);

  const panel = el('div', {
    attrs: {
      style: 'background:var(--surface-subtle); border:1px solid var(--border); border-radius:var(--radius); padding:1.1rem; display:flex; flex-direction:column; gap:0.85rem;'
    }
  });

  const sliderInputs = new Map<string, { input: HTMLInputElement; valSpan: HTMLElement; unit: string; min: number; max: number }>();

  for (const p of exp.parameters) {
    const row = el('div', { attrs: { style: 'display:flex; flex-direction:column; gap:0.2rem;' } });
    const top = el('div', {
      attrs: { style: 'display:flex; justify-content:space-between; font-size:0.81rem; font-family:var(--font-mono);' }
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

    sliderInputs.set(p.id, { input, valSpan, unit: p.unit, min: p.min, max: p.max });
    row.append(top, input);
    panel.append(row);
  }

  const vecLabel = el('label', {
    attrs: {
      style: 'display:flex; align-items:center; gap:0.5rem; font-size:0.82rem; cursor:pointer; padding-top:0.2rem; color:var(--ink);'
    }
  });
  const vecCheck = el('input', { attrs: { type: 'checkbox', checked: 'true' } });
  vecCheck.addEventListener('change', () => {
    showVectors = vecCheck.checked;
  });
  vecLabel.append(
    vecCheck,
    document.createTextNode(({
      tr: '3B Tork (τ) ve Açısal Hız (ω) Vektörleri',
      en: '3D Torque (τ) & Angular Velocity (ω) Vectors',
      de: '3D Drehmoment (τ) & Winkelgeschwindigkeit (ω)',
      fr: 'Vecteurs Couple (τ) et Vitesse Angulaire (ω)'
    })[loc])
  );
  panel.append(vecLabel);

  const btnRow = el('div', { attrs: { style: 'display:flex; gap:0.5rem; margin-top:0.25rem;' } });
  const toggleBtn = el('button', {
    className: 'btn',
    text: ({ tr: 'Duraklat', en: 'Pause', de: 'Pause', fr: 'Pause' })[loc]
  });
  toggleBtn.addEventListener('click', () => {
    paused = !paused;
    toggleBtn.textContent = paused
      ? ({ tr: 'Devam Et', en: 'Resume', de: 'Fortsetzen', fr: 'Reprendre' })[loc]
      : ({ tr: 'Duraklat', en: 'Pause', de: 'Pause', fr: 'Pause' })[loc];
  });

  const resetBtn = el('button', {
    className: 'btn btn-outline',
    text: ({ tr: 'Sıfırla', en: 'Reset', de: 'Zurücksetzen', fr: 'Réinitialiser' })[loc]
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

  const isDark = resolveEffectiveTheme() === 'dark';
  const width = viewport.clientWidth || 580;
  const height = 440;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  viewport.append(renderer.domElement);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(isDark ? 0x1a1916 : 0xe7e3da);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
  camera.position.set(2.35, 2.35, 3.85);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.2, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.minDistance = 2.0;
  controls.maxDistance = 8.5;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.update();

  for (const v of camViews) {
    const cBtn = el('button', {
      className: 'btn btn-outline',
      text: v.label,
      attrs: { style: 'padding:2px 7px; font-size:0.7rem; background:var(--surface);' }
    });
    cBtn.addEventListener('click', () => {
      camera.position.set(...v.pos);
      controls.target.set(...v.target);
      controls.update();
    });
    camBar.append(cBtn);
  }

  const keyLight = new THREE.DirectionalLight(0xfffbeb, 1.9);
  keyLight.position.set(3.8, 6.5, 3.6);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.bias = -0.0005;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xdbeafe, 0.6);
  fillLight.position.set(-4, 2.5, -3);
  scene.add(fillLight);

  const tableMesh = new THREE.Mesh(
    new THREE.BoxGeometry(7.2, 0.18, 5.2),
    new THREE.MeshStandardMaterial({ color: isDark ? 0x262420 : 0xd3cec0, roughness: 0.88, metalness: 0.04 })
  );
  tableMesh.position.y = -1.08;
  tableMesh.receiveShadow = true;
  scene.add(tableMesh);

  const castIronMat = new THREE.MeshStandardMaterial({ color: 0x222225, roughness: 0.55, metalness: 0.65 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xededf0, roughness: 0.14, metalness: 0.96 });

  const standBase = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.15, 1.55), castIronMat);
  standBase.position.set(-1.55, -0.92, -0.42);
  standBase.castShadow = true;
  standBase.receiveShadow = true;

  const verticalRod = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 3.15, 24), chromeMat);
  verticalRod.position.set(-1.55, 0.65, -0.42);
  verticalRod.castShadow = true;

  const topArm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.82, 20), chromeMat);
  topArm.rotation.z = Math.PI / 2;
  topArm.rotation.y = Math.atan2(0.42, 1.55);
  topArm.position.set(-0.77, 1.98, -0.21);
  topArm.castShadow = true;

  const clampBoss = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.26, 0.24), castIronMat);
  clampBoss.position.set(-1.55, 1.98, -0.42);

  const chuck = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.11, 0.28, 32), castIronMat);
  chuck.position.set(0, 1.9, 0);
  chuck.castShadow = true;

  const gateBody = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 0.16), castIronMat);
  gateBody.position.set(1.26, -0.12, 0);
  gateBody.castShadow = true;

  const gateArm = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.85, 12), chromeMat);
  gateArm.position.set(1.32, -0.56, 0);

  const gateBase = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 0.08, 20), castIronMat);
  gateBase.position.set(1.32, -0.95, 0);

  const ledMat = new THREE.MeshStandardMaterial({
    color: 0x16a34a,
    emissive: 0x16a34a,
    emissiveIntensity: 0.15,
    roughness: 0.2
  });
  const gateLed = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 12), ledMat);
  gateLed.position.set(1.22, 0.03, 0);

  const pointerTip = new THREE.Mesh(
    new THREE.ConeGeometry(0.03, 0.1, 12),
    new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.3 })
  );
  pointerTip.rotation.z = Math.PI;
  pointerTip.position.set(1.14, 0.02, 0);

  scene.add(standBase, verticalRod, topArm, clampBoss, chuck, gateBody, gateArm, gateBase, gateLed, pointerTip);

  const wireGeo = new THREE.CylinderGeometry(0.022, 0.022, 1.88, 14, 28);
  const posAttr = wireGeo.attributes.position as THREE.BufferAttribute;
  const wireBasePos = posAttr.array.slice();
  const wire = new THREE.Mesh(wireGeo, chromeMat);
  wire.position.y = 0.88;
  wire.castShadow = true;
  scene.add(wire);

  const rotorGroup = new THREE.Group();
  rotorGroup.position.y = -0.12;

  const scaleTex = createProtractorTexture();
  const sideBrassMat = new THREE.MeshStandardMaterial({ color: 0xc89132, metalness: 0.84, roughness: 0.22 });
  const topScaleMat = new THREE.MeshStandardMaterial({ map: scaleTex, metalness: 0.5, roughness: 0.3 });

  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(1.18, 1.18, 0.14, 64),
    [sideBrassMat, topScaleMat, sideBrassMat]
  );
  disc.castShadow = true;
  disc.receiveShadow = true;

  const optFlag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.02), castIronMat);
  optFlag.position.set(1.2, 0, 0);

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.2, 24), castIronMat);
  hub.position.y = 0.12;

  const rulerTex = createRulerTexture(false);
  const rail = new THREE.Mesh(
    new THREE.BoxGeometry(2.14, 0.032, 0.09),
    new THREE.MeshStandardMaterial({ map: rulerTex, metalness: 0.65, roughness: 0.3 })
  );
  rail.position.y = 0.086;

  const auxGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.25, 32);
  const auxMat = new THREE.MeshStandardMaterial({ color: 0x3f3f46, metalness: 0.86, roughness: 0.2 });
  const auxLeft = new THREE.Mesh(auxGeo, auxMat);
  const auxRight = new THREE.Mesh(auxGeo, auxMat);
  auxLeft.position.set(-0.55, 0.2, 0);
  auxRight.position.set(0.55, 0.2, 0);
  auxLeft.castShadow = true;
  auxRight.castShadow = true;

  rotorGroup.add(disc, optFlag, hub, rail, auxLeft, auxRight);
  scene.add(rotorGroup);

  const torqueArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0.26, 0), 0.5, 0xb91c1c, 0.14, 0.09);
  const omegaArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0.08, 0.26, 0), 0.5, 0x1e3a8a, 0.14, 0.09);
  scene.add(torqueArrow, omegaArrow);

  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.12);
  const hitPoint = new THREE.Vector3();

  const updatePointer = (e: PointerEvent) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    updatePointer(e);
    raycaster.setFromCamera(pointerNdc, camera);
    const hits = raycaster.intersectObjects([disc, auxLeft, auxRight], false);
    if (hits.length > 0) {
      isDraggingDisc = true;
      controls.enabled = false;
      viewport.style.cursor = 'grabbing';
    }
  };

  const onPointerMove = (e: PointerEvent) => {
    updatePointer(e);
    raycaster.setFromCamera(pointerNdc, camera);

    if (isDraggingDisc) {
      if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
        const angle = Math.atan2(-hitPoint.z, hitPoint.x);
        const clamped = clampNumber(angle, -2.5, 2.5, 0);
        state = [clamped, 0];
        tSec = 0;

        const thEntry = sliderInputs.get('theta0');
        if (thEntry) {
          const rounded = Math.round(Math.abs(clamped) * 10) / 10;
          thEntry.input.value = String(rounded);
          const pct = ((rounded - thEntry.min) / (thEntry.max - thEntry.min)) * 100;
          thEntry.input.style.setProperty('--pct', `${pct.toFixed(1)}%`);
          thEntry.valSpan.textContent = `${rounded} ${thEntry.unit}`;
        }
      }
      return;
    }

    const hoverHits = raycaster.intersectObjects([disc, auxLeft, auxRight], false);
    const isHover = hoverHits.length > 0;
    sideBrassMat.emissive.setHex(isHover ? 0x3b2706 : 0x000000);
    viewport.style.cursor = isHover ? 'pointer' : 'grab';
  };

  const onPointerUp = () => {
    if (isDraggingDisc) {
      isDraggingDisc = false;
      controls.enabled = true;
      viewport.style.cursor = 'grab';
    }
  };

  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);

  const plotCtx = plotCanvas.getContext('2d');
  let rafId = 0;
  const dt = 0.002;

  const animate = () => {
    controls.update();

    const inertiaVal = params.inertia ?? 0.012;
    const kappa = params.kappa ?? 0.12;
    const radialOffset = 0.28 + ((inertiaVal - 0.002) / 0.048) * 0.68;
    auxLeft.position.x = -radialOffset;
    auxRight.position.x = radialOffset;

    if (!paused && !isDraggingDisc) {
      const subSteps = 8;
      for (let i = 0; i < subSteps; i++) {
        state = stepRK4(state, tSec, dt, (s, time) => exp.computeDerivatives(s, time, params));
        tSec += dt;
      }
    }

    const theta = state[0] ?? 0;
    const omega = state[1] ?? 0;
    rotorGroup.rotation.y = theta;

    const nearZero = Math.abs(theta) < 0.045;
    ledMat.emissiveIntensity = nearZero ? 2.8 : 0.15;
    ledMat.color.setHex(nearZero ? 0xef4444 : 0x16a34a);
    ledMat.emissive.setHex(nearZero ? 0xef4444 : 0x16a34a);

    const torque = -kappa * theta;
    torqueArrow.visible = showVectors && Math.abs(torque) > 0.005;
    omegaArrow.visible = showVectors && Math.abs(omega) > 0.03;
    if (torqueArrow.visible) {
      torqueArrow.setDirection(new THREE.Vector3(0, torque >= 0 ? 1 : -1, 0));
      torqueArrow.setLength(Math.min(1.15, 0.18 + Math.abs(torque) * 2.2), 0.14, 0.08);
    }
    if (omegaArrow.visible) {
      omegaArrow.setDirection(new THREE.Vector3(0, omega >= 0 ? 1 : -1, 0));
      omegaArrow.setLength(Math.min(1.15, 0.18 + Math.abs(omega) * 0.22), 0.14, 0.08);
    }

    for (let i = 0; i < posAttr.count; i++) {
      const bx = wireBasePos[i * 3]!;
      const by = wireBasePos[i * 3 + 1]!;
      const bz = wireBasePos[i * 3 + 2]!;
      const frac = Math.max(0, Math.min(1, (0.94 - by) / 1.88));
      const twist = theta * frac;
      posAttr.setXYZ(
        i,
        bx * Math.cos(twist) - bz * Math.sin(twist),
        by,
        bx * Math.sin(twist) + bz * Math.cos(twist)
      );
    }
    posAttr.needsUpdate = true;

    const energyMj = (0.5 * inertiaVal * omega * omega + 0.5 * kappa * theta * theta) * 1000;
    const period = 2 * Math.PI * Math.sqrt(inertiaVal / kappa);
    hud.textContent = `t = ${tSec.toFixed(2)} s | θ = ${(theta * 180 / Math.PI).toFixed(1)}° | ω = ${omega.toFixed(2)} rad/s | T₀ = ${period.toFixed(2)} s | E = ${energyMj.toFixed(1)} mJ`;

    if (plotCtx) {
      const w = plotCanvas.clientWidth || 560;
      const h = 110;
      if (plotCanvas.width !== w) {
        plotCanvas.width = w;
        plotCanvas.height = h;
      }
      const maxPts = Math.max(120, Math.floor(w / 2));
      if (!paused && !isDraggingDisc) {
        thetaTrace.push(theta);
        omegaTrace.push(omega);
        if (thetaTrace.length > maxPts) thetaTrace.shift();
        if (omegaTrace.length > maxPts) omegaTrace.shift();
      }

      plotCtx.clearRect(0, 0, w, h);
      plotCtx.strokeStyle = isDark ? '#38352f' : '#dcd8cf';
      plotCtx.lineWidth = 1;

      if (plotMode === 'time') {
        plotCtx.beginPath();
        plotCtx.moveTo(0, h / 2);
        plotCtx.lineTo(w, h / 2);
        plotCtx.stroke();

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

        plotCtx.strokeStyle = '#b91c1c';
        plotCtx.lineWidth = 1.75;
        plotCtx.beginPath();
        for (let i = 0; i < thetaTrace.length; i++) {
          const px = (i / maxPts) * w;
          const py = h / 2 - (thetaTrace[i] ?? 0) * 19;
          if (i === 0) plotCtx.moveTo(px, py);
          else plotCtx.lineTo(px, py);
        }
        plotCtx.stroke();
      } else {
        plotCtx.beginPath();
        plotCtx.moveTo(w / 2, 4);
        plotCtx.lineTo(w / 2, h - 4);
        plotCtx.moveTo(8, h / 2);
        plotCtx.lineTo(w - 8, h / 2);
        plotCtx.stroke();

        plotCtx.strokeStyle = isDark ? '#93c5fd' : '#1e3a8a';
        plotCtx.lineWidth = 1.6;
        plotCtx.beginPath();
        for (let i = 0; i < thetaTrace.length; i++) {
          const px = w / 2 + (thetaTrace[i] ?? 0) * 52;
          const py = h / 2 - (omegaTrace[i] ?? 0) * 7.5;
          if (i === 0) plotCtx.moveTo(px, py);
          else plotCtx.lineTo(px, py);
        }
        plotCtx.stroke();

        const lastTh = thetaTrace[thetaTrace.length - 1] ?? theta;
        const lastOm = omegaTrace[omegaTrace.length - 1] ?? omega;
        plotCtx.fillStyle = '#b91c1c';
        plotCtx.beginPath();
        plotCtx.arc(w / 2 + lastTh * 52, h / 2 - lastOm * 7.5, 3.5, 0, Math.PI * 2);
        plotCtx.fill();
      }
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
    renderer.domElement.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    controls.dispose();
    scaleTex.dispose();
    rulerTex.dispose();
    pmrem.dispose();
    renderer.dispose();
  };
}
