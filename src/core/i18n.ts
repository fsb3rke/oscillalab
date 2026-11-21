export type Locale = 'tr' | 'en' | 'de' | 'fr';

export interface LocalizedText {
  tr: string;
  en: string;
  de?: string;
  fr?: string;
}

const STORAGE_KEY = 'oscillalab.locale';

const DICTIONARY = {
  brandMeta: {
    tr: 'Atatürk Üniversitesi • Fizik Bölümü — Titreşim ve Dalgalar Dijital İkiz Platformu',
    en: 'Atatürk University • Department of Physics — Oscillations & Waves Digital Twin Platform',
    de: 'Atatürk-Universität • Fachbereich Physik — Digitaler Zwilling für Schwingungen und Wellen',
    fr: 'Université Atatürk • Département de Physique — Jumeau Numérique : Oscillations et Ondes'
  },
  backToList: {
    tr: '← Deney Modüllerine Dön',
    en: '← Return to Modules',
    de: '← Zurück zu den Modulen',
    fr: '← Retour aux modules'
  },
  pageTitle: {
    tr: 'Titreşim ve Dalgalar Laboratuvarı Dijital İkiz Platformu',
    en: 'Oscillations and Waves Laboratory Digital Twin Platform',
    de: 'Laborplattform für Schwingungen und Wellen (Digitaler Zwilling)',
    fr: 'Plateforme Numérique du Laboratoire d’Oscillations et d’Ondes'
  },
  pageLead: {
    tr: 'Fizik lisans laboratuvarı deney düzeneklerinin optik bileşen incelemesini, 4. mertebe Runge-Kutta (RK4) sayısal çözücüsü destekli 3B dinamik simülasyonunu ve istatistiksel belirsizlik analizini bütünleştiren açık kaynaklı araştırma yazılımı.',
    en: 'An open-source research platform integrating optical apparatus inspection, 4th-order Runge-Kutta (RK4) 3D dynamic simulations, and statistical uncertainty analysis for undergraduate physics laboratories.',
    de: 'Eine Open-Source-Forschungsplattform, die optische Apparateinspektion, 3D-Dynamiksimulationen mit Runge-Kutta-Verfahren 4. Ordnung (RK4) und statistische Unsicherheitsanalyse vereint.',
    fr: 'Une plateforme de recherche open-source intégrant l’inspection optique des dispositifs, des simulations 3D par Runge-Kutta d’ordre 4 (RK4) et l’analyse statistique des incertitudes.'
  },
  catalogLabel: {
    tr: 'Kayıtlı Deney Modülleri',
    en: 'Registered Experiment Modules',
    de: 'Registrierte Versuchsmodule',
    fr: 'Modules d’Expérience Enregistrés'
  },
  openExp: {
    tr: 'Modülü İncele',
    en: 'Open Module',
    de: 'Modul öffnen',
    fr: 'Ouvrir le module'
  },
  tabSetup: {
    tr: '1. Düzenek ve Donanım Bileşenleri',
    en: '1. Apparatus & Hardware Components',
    de: '1. Versuchsaufbau & Komponenten',
    fr: '1. Dispositif et Composants Matériels'
  },
  tabTheory: {
    tr: '2. Kuramsal Çerçeve ve Denklemler',
    en: '2. Theoretical Framework & Equations',
    de: '2. Theoretische Grundlagen & Gleichungen',
    fr: '2. Cadre Théorique et Équations'
  },
  tabSim3d: {
    tr: '3. 3B Sayısal Simülasyon',
    en: '3. 3D Numerical Simulation',
    de: '3. Numerische 3D-Simulation',
    fr: '3. Simulation Numérique 3D'
  },
  tabAnalysis: {
    tr: '4. Deneysel Veri ve Belirsizlik Analizi',
    en: '4. Experimental Data & Uncertainty',
    de: '4. Messdaten & Unsicherheitsanalyse',
    fr: '4. Données Expérimentales et Incertitudes'
  },
  footerLeft: {
    tr: 'OscillaLab • Geliştirici: Berke Avcı (Atatürk Üniversitesi, Fizik Bölümü)',
    en: 'OscillaLab • Developer: Berke Avcı (Atatürk University, Dept. of Physics)',
    de: 'OscillaLab • Entwickler: Berke Avcı (Atatürk-Universität, Fachbereich Physik)',
    fr: 'OscillaLab • Développeur : Berke Avcı (Université Atatürk, Dépt. de Physique)'
  },
  footerRight: {
    tr: 'Yerel ve Çevrimdışı Çalışma Mimarisi (CSP Korumalı)',
    en: 'Local & Offline Architecture (CSP Enforced)',
    de: 'Lokale Offline-Architektur (CSP-geschützt)',
    fr: 'Architecture Locale et Hors-Ligne (Protégée par CSP)'
  },
  themeAuto: { tr: 'Sistem', en: 'System', de: 'System', fr: 'Système' },
  themeLight: { tr: 'Açık', en: 'Light', de: 'Hell', fr: 'Clair' },
  themeDark: { tr: 'Koyu', en: 'Dark', de: 'Dunkel', fr: 'Sombre' }
} as const;

export type DictKey = keyof typeof DICTIONARY;

function detectInitialLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'tr' || saved === 'en' || saved === 'de' || saved === 'fr') return saved;
  } catch {}
  const lang = (navigator.language || 'en').toLowerCase();
  if (lang.startsWith('tr')) return 'tr';
  if (lang.startsWith('de')) return 'de';
  if (lang.startsWith('fr')) return 'fr';
  return 'en';
}

let currentLocale: Locale = detectInitialLocale();
const listeners = new Set<() => void>();

export function getLocale(): Locale {
  return currentLocale;
}

export function setLocale(next: Locale): void {
  if (currentLocale === next) return;
  currentLocale = next;
  document.documentElement.lang = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {}
  listeners.forEach((fn) => fn());
}

export function t(key: DictKey): string {
  const entry = DICTIONARY[key];
  return entry[currentLocale] ?? entry.en;
}

export function tx(text: LocalizedText): string {
  return text[currentLocale] ?? text.en;
}

export function onLocaleChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
