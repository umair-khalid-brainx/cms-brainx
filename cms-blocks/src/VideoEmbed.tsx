import type { VideoEmbedBlock } from './types';
import { Heading, Section } from './ui';
import { videoEmbedSrc } from './video';

const PROVIDER_NAME = { youtube: 'YouTube', vimeo: 'Vimeo' } as const;

export function VideoEmbed({ block }: { block: VideoEmbedBlock }) {
  const { heading, caption, provider, videoId } = block;
  const src = videoEmbedSrc(provider, videoId);
  // No valid video means no section at all on the public site — an empty
  // frame reads as broken. The editor shows its own placeholder instead.
  if (!src || !provider) return null;

  return (
    <Section className="border-t border-[var(--site-line)]">
      {heading ? <Heading className="mb-10">{heading}</Heading> : null}
      <figure className="overflow-hidden rounded-[var(--site-radius-md)] border border-[var(--site-line)]">
        <iframe
          src={src}
          // In the editor canvas the text props are editable nodes, not strings (BLK-07); an
          // attribute can only take a string.
          title={[heading, caption].find((text): text is string => typeof text === 'string' && text !== '') || `${PROVIDER_NAME[provider]} video`}
          className="block aspect-video w-full"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          allowFullScreen
          // YouTube refuses to play embeds that send no referrer at all.
          referrerPolicy="strict-origin-when-cross-origin"
        />
        {caption ? (
          <figcaption className="border-t border-[var(--site-line)] bg-[var(--site-surface)] px-4 py-3 font-[family-name:var(--site-font-utility)] text-xs tracking-[0.08em] text-[var(--site-muted)]">
            {caption}
          </figcaption>
        ) : null}
      </figure>
    </Section>
  );
}
