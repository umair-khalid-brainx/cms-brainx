import type { PricingTableBlock } from './types';
import { ActionLink, Heading, Prose, Section } from './ui';

export function PricingTable({ block }: { block: PricingTableBlock }) {
  const { heading, intro, plans } = block;

  return (
    <Section className="border-t border-[var(--site-line)]">
      {heading || intro ? (
        <div className="mb-12 flex flex-col gap-4 text-center">
          {heading ? <Heading>{heading}</Heading> : null}
          {intro ? <Prose className="mx-auto">{intro}</Prose> : null}
        </div>
      ) : null}
      <div className="grid gap-[var(--site-gap)] lg:grid-cols-3">
        {plans.map((plan, index) => (
          <div
            key={`${plan.name}-${index}`}
            className={`flex flex-col gap-6 rounded-[var(--site-radius-lg)] border p-8 ${
              plan.highlighted ? 'border-[var(--site-accent)] bg-[var(--site-surface)]' : 'border-[var(--site-line)]'
            }`}
          >
            <div className="flex flex-col gap-2">
              <h3 className="font-[family-name:var(--site-font-display)] text-xl">{plan.name}</h3>
              <p className="flex items-baseline gap-1">
                <span className="font-[family-name:var(--site-font-display)] text-3xl">{plan.price}</span>
                {plan.period ? <span className="text-sm text-[var(--site-muted)]">/{plan.period}</span> : null}
              </p>
            </div>
            <ul className="flex flex-1 flex-col gap-2 text-[0.9375rem] text-[var(--site-muted)]">
              {plan.features.map((feature, featureIndex) => (
                <li key={featureIndex} className="flex items-start gap-2">
                  <span aria-hidden="true" className="text-[var(--site-accent)]">
                    &#10003;
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
            <ActionLink action={plan.action} variant={plan.highlighted ? 'primary' : 'secondary'} />
          </div>
        ))}
      </div>
    </Section>
  );
}
