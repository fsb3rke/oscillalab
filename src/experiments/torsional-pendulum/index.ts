import type { ExperimentModule } from '../../core/types';
import { registerExperiment } from '../../core/registry';

export const torsionalPendulum: ExperimentModule = {
  id: 'torsional-pendulum',
  courseCode: 'FİZ-203 // EXP-01',
  title: {
    tr: 'Burulma Sarkacı ve Eylemsizlik Momenti Tayini',
    en: 'Torsional Pendulum & Moment of Inertia'
  },
  summary: {
    tr: 'Çelik telin burulma sabiti (κ), farklı geometrilerdeki cisimlerin eylemsizlik momenti (I) ve sönümlü açısal salınım analizi.',
    en: 'Determination of wire torsion constant (κ), moment of inertia (I) of rigid bodies, and damped angular oscillation.'
  },
  setupImageUrl: '/assets/torsional-setup.webp',
  parameters: [
    {
      id: 'kappa',
      label: { tr: 'Burulma Sabiti (κ)', en: 'Torsion Constant (κ)' },
      unit: 'N·m/rad',
      min: 0.02,
      max: 0.5,
      step: 0.01,
      defaultValue: 0.12
    },
    {
      id: 'inertia',
      label: { tr: 'Eylemsizlik Momenti (I)', en: 'Moment of Inertia (I)' },
      unit: 'kg·m²',
      min: 0.002,
      max: 0.05,
      step: 0.001,
      defaultValue: 0.012
    },
    {
      id: 'damping',
      label: { tr: 'Sönüm Katsayısı (b)', en: 'Damping Coeff. (b)' },
      unit: 'N·m·s',
      min: 0.0,
      max: 0.02,
      step: 0.0005,
      defaultValue: 0.0015
    },
    {
      id: 'theta0',
      label: { tr: 'Başlangıç Açısı (θ₀)', en: 'Initial Angle (θ₀)' },
      unit: 'rad',
      min: 0.2,
      max: 2.5,
      step: 0.1,
      defaultValue: 1.2
    }
  ],
  hotspots: [
    {
      id: 1,
      title: { tr: 'Üst Mengene ve Sabitleme Yatağı', en: 'Upper Chuck & Clamp' },
      description: {
        tr: 'Burulma telinin üst ucunu kayma yapmayacak şekilde sabitleyen çelik sıkıştırma başlığı.',
        en: 'Steel collet clamp securing the upper end of the torsion wire without slip.'
      },
      xPercent: 50,
      yPercent: 14
    },
    {
      id: 2,
      title: { tr: 'Çelik Burulma Teli', en: 'Steel Torsion Wire' },
      description: {
        tr: 'Kayma modülü G ve yarıçapı r olan, geri çağırıcı burulma torku (-κθ) üreten elastik tel.',
        en: 'Elastic wire of shear modulus G providing the restoring torque (-κθ).'
      },
      xPercent: 50,
      yPercent: 44
    },
    {
      id: 3,
      title: { tr: 'Döner Tabla ve Açı Skalası', en: 'Rotor Disc & Angular Scale' },
      description: {
        tr: 'Üzerine ek kütlelerin yerleştirilebildiği disk ve derece cinsinden okuma cetveli.',
        en: 'Calibrated rotor platform supporting auxiliary test masses with degree markings.'
      },
      xPercent: 50,
      yPercent: 76
    }
  ],
  theory: [
    {
      heading: { tr: "Geri Çağırıcı Burulma Torku ve Hareket Denklemi", en: "Restoring Torque & Equation of Motion" },
      body: {
        tr: "Denge konumundan θ açısı kadar döndürülen çelik tel, açısal yer değiştirmeyle orantılı geri çağırıcı bir tork üretir. Hava ve iç sürtünme sönümü (-b·dθ/dt) eklendiğinde sistemin diferansiyel denklemi elde edilir:",
        en: "When twisted by an angle θ from equilibrium, the steel wire exerts a proportional restoring torque. Including viscous damping (-b·dθ/dt) yields the equation of motion:"
      },
      equations: [
        "\\tau = -\\kappa \\theta - b \\dot{\\theta} = I \\ddot{\\theta}",
        "\\ddot{\\theta} + \\frac{b}{I}\\dot{\\theta} + \\frac{\\kappa}{I}\\theta = 0"
      ]
    },
    {
      heading: { tr: "Salınım Periyodu ve Burulma Sabiti", en: "Oscillation Period & Torsion Constant" },
      body: {
        tr: "Zayıf sönüm (b ≈ 0) durumunda sistem açısal frekansı ω₀ = √(κ/I) olan basit harmonik açısal hareket yapar. Periyodun karesi eylemsizlik momenti ile doğrusal orantılıdır:",
        en: "Under light damping (b ≈ 0), the system executes simple harmonic angular motion with natural frequency ω₀ = √(κ/I). The squared period scales linearly with moment of inertia:"
      },
      equations: [
        "T = 2\\pi \\sqrt{\\frac{I}{\\kappa}} \\implies T^2 = \\left(\\frac{4\\pi^2}{\\kappa}\\right) I"
      ]
    },
    {
      heading: { tr: "Paralel Eksen (Steiner) Teoremi", en: "Parallel Axis (Steiner) Theorem" },
      body: {
        tr: "Kütle merkezi dönme ekseninden d kadar uzağa yerleştirilen m kütleli yardımcı silindirlerin toplam eylemsizlik momentine katkısı:",
        en: "Contribution of auxiliary masses m placed at radial distance d from the rotation axis:"
      },
      equations: [
        "I_{\\text{toplam}} = I_{\\text{disk}} + 2\\left(I_{\\text{cm}} + m d^2\\right)"
      ]
    }
  ],
  getInitialState(params) {
    return [params.theta0 ?? 1.2, 0];
  },
  computeDerivatives(state, _t, params) {
    const theta = state[0] ?? 0;
    const omega = state[1] ?? 0;
    const kappa = params.kappa ?? 0.12;
    const inertia = Math.max(1e-5, params.inertia ?? 0.012);
    const b = params.damping ?? 0.0015;

    const alpha = -(kappa / inertia) * theta - (b / inertia) * omega;
    return [omega, alpha];
  }
};

registerExperiment(torsionalPendulum);
