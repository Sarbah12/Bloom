import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { darkColors, elevation, fonts, lightColors, radii, space, typeScale, type Colors } from './tokens';

export type AppearancePreference = 'system' | 'light' | 'dark';

export interface Theme {
  scheme: 'light' | 'dark';
  colors: Colors;
  type: typeof typeScale;
  fonts: typeof fonts;
  space: typeof space;
  radii: typeof radii;
  elevation: typeof elevation;
}

function build(scheme: 'light' | 'dark'): Theme {
  return {
    scheme,
    colors: scheme === 'dark' ? darkColors : lightColors,
    type: typeScale,
    fonts,
    space,
    radii,
    elevation,
  };
}

const ThemeContext = createContext<Theme>(build('light'));

export function ThemeProvider({ preference = 'system', children }: { preference?: AppearancePreference; children: ReactNode }) {
  const system = useColorScheme();
  const scheme = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
  const theme = useMemo(() => build(scheme), [scheme]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
