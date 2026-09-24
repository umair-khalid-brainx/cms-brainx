import type { ReactNode } from 'react';
import { themeToCssVars, type SiteTheme } from './theme';

type Props = {
  theme: SiteTheme;
  children: ReactNode;
  className?: string;
};

/**
 * Scopes one tenant's theme to a subtree. Nesting two of these renders two
 * brands on one page, which is how the theme contract stays honest — see the
 * comparison view on `/`.
 */
export function SiteThemeRoot({ theme, children, className = '' }: Props) {
  const texture = theme.texture === 'none' ? '' : `site-texture-${theme.texture}`;

  return (
    <div
      style={themeToCssVars(theme)}
      className={`bg-[var(--site-paper)] text-[var(--site-ink)] font-[family-name:var(--site-font-body)] ${texture} ${className}`}
    >
      {children}
    </div>
  );
}
