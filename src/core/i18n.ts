export type Locale = 'tr' | 'en';

export interface LocalizedText {
  tr: string;
  en: string;
}

const STORAGE_KEY = 'oscillalab.locale';

const DICTIONARY = {
  brandMeta: {
    tr: 'Atatürk Üniversitesi • Fizik Bölümü — Titreşim ve Dalgalar Dijital İkiz Platformu',
    en: 'Atatürk University • Department of Physics — Oscillations & Waves Digital Twin Platform'
  },
  backToList: { tr: '← Deney Modüllerine Dön', en: '← Return to Modules' },
  kicker: { tr: 'DENEYSEL FİZİK VE SAYISAL MODELLEME', en: 'EXPERIMENTAL PHYSICS & NUMERICAL MODELING' },
  pageTitle: {
    tr: 'Titreşim ve Dalgalar Laboratuvarı Dijital İkiz Platformu',
    en: 'Oscillations and Waves Laboratory Digital Twin Platform'
  },
  pageLead: {
    tr: 'Fizik lisans laboratuvarı deney düzeneklerinin optik bileşen incelemesini, 4. mertebe Runge-Kutta (RK4) sayısal çözücüsü destekli 3B dinamik simülasyonunu ve istatistiksel belirsizlik analizini bütünleştiren açık kaynaklı araştırma yazılımı.',
    en: 'An open-source research platform integrating optical apparatus inspection, 4th-order Runge-Kutta (RK4) 3D dynamic simulations, and statistical uncertainty analysis for undergraduate physics laboratories.'
  },
  catalogLabel: { tr: 'Kayıtlı Deney Modülleri', en: 'Registered Experiment Modules' },
  expCount: { tr: 'Modül', en: 'Modules' },
  emptyCode: { tr: 'MODÜL-00', en: 'MODULE-00' },
  emptyTitle: { tr: 'Tanımlı modül bulunmamaktadır', en: 'No modules defined' },
  emptyDesc: {
    tr: 'Sisteme kaydedilen deney modülleri bu çizelgede listelenmektedir.',
    en: 'Registered experiment modules are indexed in this table.'
  },
  openExp: { tr: 'Modülü İncele', en: 'Open Module' },
  tabSetup: { tr: '1. Düzenek ve Donanım Bileşenleri', en: '1. Apparatus & Hardware Components' },
  tabTheory: { tr: '2. Kuramsal Çerçeve ve Denklemler', en: '2. Theoretical Framework & Equations' },
  tabSim3d: { tr: '3. 3B Sayısal Simülasyon', en: '3. 3D Numerical Simulation' },
  tabAnalysis: { tr: '4. Deneysel Veri ve Belirsizlik Analizi', en: '4. Experimental Data & Uncertainty' },
  preparing: { tr: 'modül içeriği hazırlanmaktadır.', en: 'module content is under preparation.' },
  footerLeft: {
    tr: 'OscillaLab • Geliştirici: Berke Avcı (Atatürk Üniversitesi, Fizik Bölümü)',
    en: 'OscillaLab • Developer: Berke Avcı (Atatürk University, Dept. of Physics)'
  },
  footerRight: { tr: 'Yerel ve Çevrimdışı Çalışma Mimarisi (CSP Korumalı)', en: 'Local & Offline Architecture (CSP Enforced)' },
  themeAuto: { tr: 'Sistem', en: 'System' },
  themeLight: { tr: 'Açık', en: 'Light' },
  themeDark: { tr: 'Koyu', en: 'Dark' }
} as const;

export type DictKey = keyof typeof DICTIONARY;

function detectInitialLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'tr' || saved === 'en') return saved;
  } catch {}
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
  } catch {}
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
