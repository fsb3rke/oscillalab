import type { ExperimentModule } from '../../core/types';
import { registerExperiment } from '../../core/registry';

const drivenSpringMass: ExperimentModule = {
  id: 'driven-spring-mass',
  courseCode: 'FİZ-203 // EXP-02',
  title: {
    tr: 'Sönümlü ve Zorlanmış Yay-Kütle Sistemi',
    en: 'Damped and Driven Spring-Mass System',
    de: 'Gedämpftes und erzwungenes Feder-Masse-System',
    fr: 'Système Masse-Ressort Amorti et Forcé'
  },
  summary: {
    tr: 'Hooke yasası, viskoz sönümleme, harmonik dış zorlama altında genlik rezonansı ve faz gecikmesi analizi.',
    en: 'Analysis of Hooke’s law, viscous damping, amplitude resonance under harmonic driving, and phase lag.',
    de: 'Analyse des Hookeschen Gesetzes, viskoser Dämpfung, Amplitudenresonanz und Phasenverschiebung.',
    fr: 'Analyse de la loi de Hooke, de l’amortissement visqueux, de la résonance d’amplitude et du déphasage.'
  },
  parameters: [
    {
      id: 'mass',
      label: { tr: 'Kütle (m)', en: 'Mass (m)', de: 'Masse (m)', fr: 'Masse (m)' },
      unit: 'kg',
      min: 0.1,
      max: 2.0,
      step: 0.05,
      defaultValue: 0.45
    },
    {
      id: 'k',
      label: { tr: 'Yay Sabiti (k)', en: 'Spring Constant (k)', de: 'Federkonstante (k)', fr: 'Raideur (k)' },
      unit: 'N/m',
      min: 2.0,
      max: 40.0,
      step: 0.5,
      defaultValue: 14.0
    },
    {
      id: 'damping',
      label: { tr: 'Sönüm Katsayısı (b)', en: 'Damping (b)', de: 'Dämpfung (b)', fr: 'Amortissement (b)' },
      unit: 'N·s/m',
      min: 0.0,
      max: 2.5,
      step: 0.05,
      defaultValue: 0.25
    },
    {
      id: 'driveAmp',
      label: { tr: 'Zorlama Genliği (F₀)', en: 'Driving Force (F₀)', de: 'Erregerkraft (F₀)', fr: 'Force excitatrice (F₀)' },
      unit: 'N',
      min: 0.0,
      max: 4.0,
      step: 0.1,
      defaultValue: 1.2
    },
    {
      id: 'driveFreq',
      label: { tr: 'Zorlama Frekansı (ω_d)', en: 'Drive Freq. (ω_d)', de: 'Erregerfreq. (ω_d)', fr: 'Fréq. excitation (ω_d)' },
      unit: 'rad/s',
      min: 0.5,
      max: 14.0,
      step: 0.1,
      defaultValue: 5.5
    }
  ],
  hotspots: [
    {
      id: 1,
      xPercent: 50,
      yPercent: 16,
      title: {
        tr: 'Sinüzoidal Tahrik Ünitesi (Eksantrik Disk)',
        en: 'Sinusoidal Driver Unit (Eccentric Cam)',
        de: 'Sinusförmiger Erregerantrieb',
        fr: 'Unité d’Excitation Sinusoïdale'
      },
      description: {
        tr: 'Step motor kontrolüyle yaya üst uçtan F₀·cos(ω_d·t) formunda periyodik mekanik zorlama uygular.',
        en: 'Applies periodic mechanical excitation F₀·cos(ω_d·t) to the upper suspension point via stepper drive.',
        de: 'Erzeugt eine periodische mechanische Anregung F₀·cos(ω_d·t) am oberen Aufhängepunkt.',
        fr: 'Applique une excitation mécanique périodique F₀·cos(ω_d·t) au point de suspension supérieur.'
      }
    },
    {
      id: 2,
      xPercent: 50,
      yPercent: 44,
      title: {
        tr: 'Kalibre Çelik Helisel Yay',
        en: 'Calibrated Steel Helical Spring',
        de: 'Kalibrierte Stahl-Schraubenfeder',
        fr: 'Ressort Hélicoïdal en Acier Calibré'
      },
      description: {
        tr: 'Doğrusal elastik bölgede F = -k·x geri çağırıcı kuvveti üretir. Kütle-periyot eğrisinden k tayin edilir.',
        en: 'Provides linear Hookean restoring force F = -k·x within the elastic limit.',
        de: 'Liefert die lineare rücktreibende Kraft F = -k·x im elastischen Bereich.',
        fr: 'Fournit une force de rappel linéaire F = -k·x dans la limite élastique.'
      }
    },
    {
      id: 3,
      xPercent: 68,
      yPercent: 68,
      title: {
        tr: 'Manyetik Girdap Akımı (Eddy) Sönümleyici',
        en: 'Magnetic Eddy-Current Damper',
        de: 'Magnetischer Wirbelstromdämpfer',
        fr: 'Amortisseur Magnétique à Courants de Foucault'
      },
      description: {
        tr: 'Alüminyum kanatçık üzerinde hızla orantılı (-b·v) temassız elektromanyetik frenleme direnci oluşturur.',
        en: 'Produces contactless velocity-proportional (-b·v) electromagnetic damping via an aluminum vane.',
        de: 'Erzeugt berührungslose geschwindigkeitsproportionale Dämpfung (-b·v) mittels Wirbelströmen.',
        fr: 'Produit un amortissement électromagnétique sans contact proportionnel à la vitesse (-b·v).'
      }
    }
  ],
  theory: [
    {
      heading: {
        tr: 'Zorlanmış ve Sönümlü Harmonik Osilatör Denklemi',
        en: 'Driven and Damped Harmonic Oscillator Equation',
        de: 'Bewegungsgleichung des erzwungenen gedämpften Oszillators',
        fr: 'Équation de l’Oscillateur Harmonique Amorti et Forcé'
      },
      body: {
        tr: 'Hooke geri çağırıcı kuvveti (-kx), viskoz/manyetik sönümleme kuvveti (-b·dx/dt) ve dış harmonik tahrik kuvveti altında kütle-yay sisteminin hareket denklemi:',
        en: 'Under Hooke restoring force (-kx), viscous damping (-b·dx/dt), and harmonic external forcing, the equation of motion is:',
        de: 'Unter Rückstellkraft (-kx), Dämpfung (-b·dx/dt) und äußerer harmonischer Anregung lautet die Bewegungsgleichung:',
        fr: 'Sous la force de rappel (-kx), l’amortissement (-b·dx/dt) et une excitation harmonique externe :'
      },
      equations: [
        'm\\ddot{x} + b\\dot{x} + kx = F_0 \\cos(\\omega_d t)',
        '\\ddot{x} + 2\\gamma\\dot{x} + \\omega_0^2 x = \\frac{F_0}{m}\\cos(\\omega_d t), \\quad \\omega_0 = \\sqrt{\\frac{k}{m}}, \\quad \\gamma = \\frac{b}{2m}'
      ]
    },
    {
      heading: {
        tr: 'Kararlı Hal Genliği ve Rezonans Koşulu',
        en: 'Steady-State Amplitude and Resonance Condition',
        de: 'Stationäre Amplitude und Resonanzbedingung',
        fr: 'Amplitude en Régime Permanent et Condition de Résonance'
      },
      body: {
        tr: 'Geçici salınımlar sönümlendikten sonra sistem zorlama frekansı ω_d ile salınır. Genlik A(ω_d) ve zorlama ile konum arasındaki faz gecikmesi δ:',
        en: 'After transients decay, the oscillator settles at driving frequency ω_d with steady-state amplitude A(ω_d) and phase lag δ:',
        de: 'Nach Abklingen der Einschwingvorgänge schwingt das System mit ω_d, Amplitude A(ω_d) und Phasenverschiebung δ:',
        fr: 'Après extinction du régime transitoire, l’amplitude stationnaire A(ω_d) et le déphasage δ s’écrivent :'
      },
      equations: [
        'A(\\omega_d) = \\frac{F_0 / m}{\\sqrt{(\\omega_0^2 - \\omega_d^2)^2 + (2\\gamma\\omega_d)^2}}',
        '\\omega_{\\text{rez}} = \\sqrt{\\omega_0^2 - 2\\gamma^2}, \\qquad \\tan\\delta = \\frac{2\\gamma\\omega_d}{\\omega_0^2 - \\omega_d^2}'
      ]
    }
  ],
  getInitialState() {
    return [0.22, 0];
  },
  computeDerivatives(state, t, params) {
    const x = state[0] ?? 0;
    const v = state[1] ?? 0;
    const m = Math.max(0.05, params.mass ?? 0.45);
    const k = params.k ?? 14.0;
    const b = params.damping ?? 0.25;
    const f0 = params.driveAmp ?? 1.2;
    const wd = params.driveFreq ?? 5.5;

    const a = (f0 * Math.cos(wd * t) - b * v - k * x) / m;
    return [v, a];
  }
};

registerExperiment(drivenSpringMass);
export default drivenSpringMass;
