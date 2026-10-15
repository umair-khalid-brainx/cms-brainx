import type { ReactNode } from 'react';
import { config, type EditorComponents } from '../puck/config';
import './BlockDrawerItem.css';

// One icon per block type, drawn on a 24px grid in the stroke style the rest of the admin uses. Inline SVG, so
// there is no icon package to add; a block without an entry here still shows its name (the default icon).
const PATHS: Record<keyof EditorComponents, ReactNode> = {
  Hero: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 10h6M7 14h4" /><rect x="15" y="9" width="3" height="6" rx="0.5" /></>,
  RichText: <path d="M4 6h16M4 10h16M4 14h10M4 18h13" />,
  ImageText: <><rect x="3" y="5" width="9" height="14" rx="1.5" /><path d="M15 8h6M15 12h6M15 16h4" /></>,
  FeatureGrid: <><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></>,
  Testimonial: <><path d="M5 18v-5a4 4 0 0 1 4-4M13 18v-5a4 4 0 0 1 4-4" /><path d="M5 13h4v5H5zM13 13h4v5h-4z" /></>,
  Cta: <><rect x="3" y="7" width="18" height="10" rx="5" /><path d="M9 12h6M13 10l2 2-2 2" /></>,
  LogoCloud: <><circle cx="6" cy="8" r="2.5" /><circle cx="18" cy="8" r="2.5" /><circle cx="12" cy="16" r="2.5" /></>,
  Stats: <path d="M5 20V10M12 20V4M19 20v-7" />,
  Faq: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01" /></>,
  Spacer: <path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4" />,
  Gallery: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.5" /><path d="m21 16-5-5-8 8" /></>,
  PricingTable: <><path d="M12 3v18M16 7.5c-.5-1-1.7-1.5-3.5-1.5-2 0-3.5 1-3.5 2.5S10.5 11 12 11.3s3 .9 3 2.4S13.5 16 12 16c-1.8 0-3-.5-3.5-1.5" /></>,
  TeamGrid: <><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0" /><circle cx="17" cy="9" r="2.3" /><path d="M16 14.2A5 5 0 0 1 21 19" /></>,
  ContactForm: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  VideoEmbed: <><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m10 9 5 3-5 3z" /></>,
};

const FALLBACK = <rect x="4" y="4" width="16" height="16" rx="3" />;

/**
 * A block in the left-hand picker: its icon above its name, in a grid (see the `.editor-puck` rules).
 * Puck hands over its own row (name and drag handle) as `children`; the tile draws its own, from the block's label.
 */
export function BlockDrawerItem({ name }: { name: string; children: ReactNode }) {
  const label = (config.components as Record<string, { label?: string }>)[name]?.label ?? name;
  return (
    <span className="block-tile">
      <svg className="block-tile-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {PATHS[name as keyof EditorComponents] ?? FALLBACK}
      </svg>
      <span className="block-tile-name">{label}</span>
    </span>
  );
}
