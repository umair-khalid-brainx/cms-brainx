import type { LogoCloudBlock } from './types';
import { Heading, Section } from './ui';

export function LogoCloud({ block }: { block: LogoCloudBlock }) {
  const { heading, logos } = block;

  return (
    <Section className="border-t border-[var(--site-line)]">
      {heading ? (
        <Heading level={3} className="mb-8 text-center text-[var(--site-muted)]">
          {heading}
        </Heading>
      ) : null}
      <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-8 opacity-80 grayscale">
        {logos.map((logo, index) => (
          // eslint-disable-next-line @next/next/no-img-element -- fixture SVGs; next/image lands with the media library
          <img key={`${logo.src}-${index}`} src={logo.src} alt={logo.alt} className="h-8 w-auto object-contain" />
        ))}
      </div>
    </Section>
  );
}
