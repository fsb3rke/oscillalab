export type ThemeMode = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'oscillalab.theme';

function detectInitialTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'system' || saved === 'light' || saved === 'dark') return saved;
  } catch {
    // sessiz geç
  }
  return 'system';
}

let currentMode: ThemeMode = detectInitialTheme();
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

export function resolveEffectiveTheme(mode: ThemeMode = currentMode): 'light' | 'dark' {
  if (mode === 'system') {
    return mediaQuery.matches ? 'dark' : 'light';
  }
  return mode;
}

export function applyTheme(mode: ThemeMode = currentMode): void {
  const effective = resolveEffectiveTheme(mode);
  document.documentElement.setAttribute('data-theme', effective);
}

export function getThemeMode(): ThemeMode {
  return currentMode;
}

export function setThemeMode(mode: ThemeMode): void {
  currentMode = mode;
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // sessiz geç
  }
  applyTheme(mode);
}

mediaQuery.addEventListener('change', () => {
  if (currentMode === 'system') {
    applyTheme('system');
  }
});
