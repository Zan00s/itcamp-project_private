import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { Theme, presetGpnDefault, presetGpnDark, type ThemePreset } from '@consta/uikit/Theme';

type ThemeMode = 'light' | 'dark';

interface ThemeContextValue {
  mode: ThemeMode;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({ mode: 'light', toggle: () => {} });

export function useThemeMode(): ThemeContextValue {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('elouav-theme');
    return saved === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    localStorage.setItem('elouav-theme', mode);
  }, [mode]);

  const toggle = () => setMode(m => m === 'light' ? 'dark' : 'light');

  const preset: ThemePreset = mode === 'dark' ? presetGpnDark : presetGpnDefault;

  return (
    <ThemeContext.Provider value={{ mode, toggle }}>
      <Theme preset={preset}>
        {children}
      </Theme>
    </ThemeContext.Provider>
  );
}
