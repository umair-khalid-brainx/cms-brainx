import type { Metadata } from 'next';
import { Archivo_Narrow, Fraunces, IBM_Plex_Mono, IBM_Plex_Sans, Karla } from 'next/font/google';
import './globals.css';

/**
 * Every face a tenant can be themed with is loaded here and exposed as a CSS
 * variable. A tenant's `theme_json` selects a type set by name rather than
 * naming a font file, so a tenant cannot reference a face the site does not
 * serve.
 */
const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin'],
  axes: ['SOFT', 'WONK', 'opsz'],
  display: 'swap',
});

const karla = Karla({
  variable: '--font-karla',
  subsets: ['latin'],
  display: 'swap',
});

const archivoNarrow = Archivo_Narrow({
  variable: '--font-archivo-narrow',
  subsets: ['latin'],
  display: 'swap',
});

const plexSans = IBM_Plex_Sans({
  variable: '--font-plex-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  variable: '--font-plex-mono',
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'CMS — tenant site renderer',
  description: 'Server-rendered public sites for the multi-tenant CMS.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${karla.variable} ${archivoNarrow.variable} ${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
