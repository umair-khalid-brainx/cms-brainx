import type { GalleryBlock } from './types';
import { Heading, Section } from './ui';

export function Gallery({ block }: { block: GalleryBlock }) {
  const { heading, images } = block;

  return (
    <Section className="border-t border-[var(--site-line)]">
      {heading ? <Heading className="mb-10">{heading}</Heading> : null}
      <div className="grid gap-[var(--site-gap)] sm:grid-cols-2 lg:grid-cols-3">
        {images.map((image, index) => (
          <figure
            key={`${image.src}-${index}`}
            className="overflow-hidden rounded-[var(--site-radius-md)] border border-[var(--site-line)]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- fixture SVGs; next/image lands with the media library */}
            <img src={image.src} alt={image.alt} className="block aspect-[4/3] h-full w-full object-cover" />
            {image.caption ? (
              <figcaption className="border-t border-[var(--site-line)] bg-[var(--site-surface)] px-4 py-3 font-[family-name:var(--site-font-utility)] text-xs tracking-[0.08em] text-[var(--site-muted)]">
                {image.caption}
              </figcaption>
            ) : null}
          </figure>
        ))}
      </div>
    </Section>
  );
}
