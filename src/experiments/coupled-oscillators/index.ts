import type { ExperimentModule } from "../../core/types";
import { registerExperiment } from "../../core/registry";

export const coupledOscillatorsExperiment: ExperimentModule = {
  id: "coupled-oscillators",
  courseCode: "FİZ-203 // EXP-03",
  title: {
    tr: "Çift Bağlı Osilatör: Normal Modlar ve Vuruş Olayı",
    en: "Coupled Oscillators: Normal Modes & Beats",
    de: "Gekoppelte Oszillatoren: Normalmoden & Schwebung",
    fr: "Oscillateurs Couplés : Modes Normaux & Battements"
  },
  summary: {
    tr: "Bağlaşım yayı (kc) ile birbirine bağlı iki kütle-yay sisteminde simetrik ve antisimetrik normal mod frekanslarını ve vuruş zarfını inceleyin.",
    en: "Explore symmetric and antisymmetric normal mode frequencies and beat envelopes in two masses coupled by spring kc.",
    de: "Untersuchen Sie symmetrische und antisymmetrische Normalmoden sowie Schwebungen bei zwei gekoppelten Massen.",
    fr: "Étudiez les modes normaux symétriques et antisymétriques ainsi que les battements de deux masses couplées."
  },
  parameters: [
    { id: "mass", label: { tr: "Kütle (m)", en: "Mass (m)", de: "Masse (m)", fr: "Masse (m)" }, unit: "kg", min: 0.2, max: 2.5, step: 0.05, defaultValue: 0.6 },
    { id: "springK", label: { tr: "Yan Yay Sabiti (k)", en: "Side Spring (k)", de: "Federkonstante (k)", fr: "Raideur (k)" }, unit: "N/m", min: 4.0, max: 30.0, step: 0.5, defaultValue: 12.0 },
    { id: "couplingK", label: { tr: "Bağlaşım Sabiti (kc)", en: "Coupling (kc)", de: "Kopplung (kc)", fr: "Couplage (kc)" }, unit: "N/m", min: 0.2, max: 12.0, step: 0.2, defaultValue: 2.0 },
    { id: "dampingB", label: { tr: "Sönüm (b)", en: "Damping (b)", de: "Dämpfung (b)", fr: "Amortissement (b)" }, unit: "N·s/m", min: 0.0, max: 0.8, step: 0.02, defaultValue: 0.02 },
    { id: "x1Init", label: { tr: "İlk Konum x₁(0)", en: "Initial x₁(0)", de: "Start x₁(0)", fr: "Initial x₁(0)" }, unit: "m", min: -0.2, max: 0.2, step: 0.01, defaultValue: 0.12 },
    { id: "x2Init", label: { tr: "İlk Konum x₂(0)", en: "Initial x₂(0)", de: "Start x₂(0)", fr: "Initial x₂(0)" }, unit: "m", min: -0.2, max: 0.2, step: 0.01, defaultValue: 0.0 }
  ],
  hotspots: [
    { id: 1, xPercent: 50, yPercent: 52, title: { tr: "Bağlaşım Yayı (kc)", en: "Coupling Spring (kc)", de: "Koppel Feder (kc)", fr: "Ressort de Couplage (kc)" }, description: { tr: "İki osilatör arasındaki enerji aktarım hızını ve normal mod ayrımını belirler.", en: "Controls energy exchange rate and normal mode splitting between oscillators.", de: "Bestimmt Energietransfer und Modenaufspaltung.", fr: "Contrôle le transfert d'énergie et l'écart des modes." } },
    { id: 2, xPercent: 32, yPercent: 52, title: { tr: "Normal Modlar (ω+, ω-)", en: "Normal Modes (ω+, ω-)", de: "Normalmoden (ω+, ω-)", fr: "Modes Normaux (ω+, ω-)" }, description: { tr: "x1(0)=x2(0) için ω+ = √(k/m), x1(0)=-x2(0) için ω- = √((k+2kc)/m) elde edilir.", en: "In-phase gives ω+ = √(k/m); out-of-phase gives ω- = √((k+2kc)/m).", de: "Gleichphasig: ω+ = √(k/m); gegenphasig: ω- = √((k+2kc)/m).", fr: "En phase : ω+ = √(k/m) ; en opposition : ω- = √((k+2kc)/m)." } }
  ],
  theory: [
    {
      heading: { tr: "Normal Modlar ve Vuruş Olayı", en: "Normal Modes and Beats", de: "Normalmoden und Schwebung", fr: "Modes Normaux et Battements" },
      body: {
        tr: "İki özdeş bağlı osilatörün genel hareketi, tüm kütlelerin tek bir frekansta salındığı simetrik (q1 = x1 + x2) ve antisimetrik (q2 = x1 - x2) normal modların süperpozisyonudur.",
        en: "General motion of two identical coupled oscillators is a superposition of symmetric (q1 = x1 + x2) and antisymmetric (q2 = x1 - x2) normal modes.",
        de: "Die allgemeine Bewegung ist eine Überlagerung der symmetrischen und antisymmetrischen Normalmode.",
        fr: "Le mouvement général est une superposition des modes normaux symétrique et antisymétrique."
      },
      equations: [
        "m\\ddot{x}_1 = -kx_1 - k_c(x_1 - x_2) - b\\dot{x}_1, \\quad m\\ddot{x}_2 = -kx_2 - k_c(x_2 - x_1) - b\\dot{x}_2",
        "\\omega_+ = \\sqrt{\\frac{k}{m}}, \\quad \\omega_- = \\sqrt{\\frac{k + 2k_c}{m}}"
      ]
    }
  ],
  getInitialState(params: Record<string, number>): number[] {
    return [params.x1Init ?? 0.12, 0, params.x2Init ?? 0, 0];
  },
  computeDerivatives(state: readonly number[], _t: number, params: Record<string, number>): number[] {
    const [x1 = 0, v1 = 0, x2 = 0, v2 = 0] = state;
    const m = Math.max(0.05, params.mass ?? 0.6);
    const k = Math.max(0.1, params.springK ?? 12.0);
    const kc = Math.max(0, params.couplingK ?? 2.0);
    const b = Math.max(0, params.dampingB ?? 0.02);
    const a1 = (-k * x1 - kc * (x1 - x2) - b * v1) / m;
    const a2 = (-k * x2 - kc * (x2 - x1) - b * v2) / m;
    return [v1, a1, v2, a2];
  }
};

registerExperiment(coupledOscillatorsExperiment);
