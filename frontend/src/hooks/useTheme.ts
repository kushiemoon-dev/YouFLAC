export type Theme = 'dark' | 'light' | 'system';

export function applyTheme(theme: Theme) {
  let resolved: 'dark' | 'light' = 'dark';
  if (theme === 'light') resolved = 'light';
  else if (theme === 'system')
    resolved = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = resolved;
}
