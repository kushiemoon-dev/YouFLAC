import { useEffect } from 'react';

export type Theme = 'dark' | 'light' | 'system';

export function applyTheme(theme: Theme) {
  let resolved: 'dark' | 'light' = 'dark';
  if (theme === 'light') resolved = 'light';
  else if (theme === 'system')
    resolved = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = resolved;
}

export function useTheme(theme?: Theme) {
  useEffect(() => {
    if (!theme) return;
    applyTheme(theme);

    if (theme === 'system') {
      const mq = matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyTheme('system');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [theme]);
}
