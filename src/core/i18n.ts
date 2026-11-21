export type Locale = 'tr' | 'en';

export interface LocalizedText {
  tr: string;
  en: string;
}

const STORAGE_KEY = 'oscillalab.locale';

const DICTIONARY = {
  brandMeta: { tr: 'FİZİK BÖLÜMÜ • LAB-II', en: 'DEPT. OF PHYSICS • LAB-II' },
  backToList: { tr: '← Deney Listesi', en: '← Experiments' },
  kicker: { tr: 'TİTREŞİM VE DALGALAR LABORATUVARI', en: 'OSCILLATIONS & WAVES LABORATORY' },
  pageTitle: {
    tr: 'Deney Düzenekleri ve Sayısal Simülasyon',
    en: 'Experimental Apparatus & Numerical Simulation'
  },
  pageLead: {
    tr: 'Laboratuvardaki deney düzeneklerinin parça incelemesi, RK4 tabanlı 3B hareket çözümleri ve ölçüm hata analizleri.',
    en: 'Apparatus inspection, RK4-based 3D motion solvers, and measurement uncertainty analysis for laboratory experiments.'
  },
  scopeTitle: { tr: 'RK4 • SÖNÜMLÜ SALINIM', en: 'RK4 • DAMPED OSCILLATION' },
  catalogLabel: { tr: 'Deney Föyleri', en: 'Lab Manuals' },
  expCount: { tr: 'DENEY', en: 'EXPERIMENTS' },
  emptyCode: { tr: 'FİZ-203 // 00', en: 'PHYS-203 // 00' },
  emptyTitle: { tr: 'Henüz deney eklenmedi', en: 'No experiments registered yet' },
  emptyDesc: {
    tr: 'Deney modülleri eklendikçe bu listede yer alacaktır.',
    en: 'Registered experiment modules will appear in this index.'
  },
  openExp: { tr: 'Deneye Git →', en: 'Open Setup →' },
  tabSetup: { tr: '01 / Düzenek ve Parçalar', en: '01 / Apparatus & Parts' },
  tabTheory: { tr: '02 / Teori', en: '02 / Theory' },
  tabSim3d: { tr: '03 / 3B Simülasyon', en: '03 / 3D Simulation' },
  tabAnalysis: { tr: '04 / Veri ve Hata Analizi', en: '04 / Data & Error Analysis' },
  preparing: { tr: 'içeriği hazırlanıyor.', en: 'module content is in preparation.' },
  footerLeft: {
    tr: 'OscillaLab — Titreşim ve Dalgalar Laboratuvarı',
    en: 'OscillaLab — Oscillations & Waves Laboratory'
  },
  footerRight: { tr: 'Çevrimdışı Çalışma Desteği', en: 'Offline-Capable' },
  themeAuto: { tr: 'Sistem', en: 'System' },
  themeLight: { tr: 'Açık', en: 'Light' },
  themeDark: { tr: 'Koyu', en: 'Dark' }
} as const;

export type DictKey = keyof typeof DICTIONARY;

function detectInitialLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'tr' || saved === 'en') return saved;
  } catch {
    // localStorage kısıtlı ortamlarda sessizce geçilir
  }
  const browserLang = (navigator.language || 'en').toLowerCase();
  return browserLang.startsWith('tr') ? 'tr' : 'en';
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
  } catch {
    // sessiz geç
  }
  listeners.forEach((fn) => fn());
}

export function t(key: DictKey): string {
  return DICTIONARY[key][currentLocale];
}

export function tx(text: LocalizedText): string {
  return text[currentLocale];
}

export function onLocaleChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
