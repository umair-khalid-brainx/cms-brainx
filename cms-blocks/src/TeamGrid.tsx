import type { TeamGridBlock } from './types';
import { Heading, Prose, Section } from './ui';

export function TeamGrid({ block }: { block: TeamGridBlock }) {
  const { heading, intro, members } = block;

  return (
    <Section className="border-t border-[var(--site-line)]">
      {heading || intro ? (
        <div className="mb-12 flex flex-col gap-4">
          {heading ? <Heading>{heading}</Heading> : null}
          {intro ? <Prose>{intro}</Prose> : null}
        </div>
      ) : null}
      <div className="grid gap-[var(--site-gap)] sm:grid-cols-2 lg:grid-cols-4">
        {members.map((member, index) => (
          <div key={`${member.name}-${index}`} className="flex flex-col gap-3">
            {member.photo ? (
              <figure className="overflow-hidden rounded-[var(--site-radius-md)] border border-[var(--site-line)]">
                {/* eslint-disable-next-line @next/next/no-img-element -- fixture SVGs; next/image lands with the media library */}
                <img
                  src={member.photo.src}
                  alt={member.photo.alt}
                  className="block aspect-square h-full w-full object-cover"
                />
              </figure>
            ) : null}
            <div className="flex flex-col gap-0.5">
              <h3 className="font-[family-name:var(--site-font-display)] text-lg">{member.name}</h3>
              <p className="font-[family-name:var(--site-font-utility)] text-xs uppercase tracking-[0.12em] text-[var(--site-muted)]">
                {member.role}
              </p>
            </div>
            {member.bio ? <p className="text-[0.875rem] leading-[1.6] text-[var(--site-muted)]">{member.bio}</p> : null}
          </div>
        ))}
      </div>
    </Section>
  );
}
