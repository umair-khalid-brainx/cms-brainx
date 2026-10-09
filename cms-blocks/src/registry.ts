import type { ComponentType } from 'react';
import type { Block, BlockOfType, BlockType } from './types';
import { ContactForm } from './ContactForm';
import { Cta } from './Cta';
import { Faq } from './Faq';
import { FeatureGrid } from './FeatureGrid';
import { Gallery } from './Gallery';
import { Hero } from './Hero';
import { ImageText } from './ImageText';
import { LogoCloud } from './LogoCloud';
import { PricingTable } from './PricingTable';
import { RichText } from './RichText';
import { Spacer } from './Spacer';
import { Stats } from './Stats';
import { TeamGrid } from './TeamGrid';
import { Testimonial } from './Testimonial';
import { VideoEmbed } from './VideoEmbed';

// `index` is the block's position on the page. Only ContactForm uses it, to
// tell the API which form was submitted (D-034).
export type BlockComponent<T extends BlockType> = ComponentType<{ block: BlockOfType<T>; index?: number }>;

type Registry = { [T in BlockType]: BlockDefinition<T> };

export type BlockDefinition<T extends BlockType> = {
  /** Shown in the editor's block picker. */
  name: string;
  component: BlockComponent<T>;
};

/**
 * The single source of truth for which blocks exist. Adding a block type to
 * `Block` without registering it here is a compile error, and vice versa.
 */
export const blockRegistry: Registry = {
  hero: { name: 'Hero', component: Hero },
  richText: { name: 'Rich text', component: RichText },
  imageText: { name: 'Image and text', component: ImageText },
  featureGrid: { name: 'Feature grid', component: FeatureGrid },
  testimonial: { name: 'Testimonial', component: Testimonial },
  cta: { name: 'Call to action', component: Cta },
  logoCloud: { name: 'Logo cloud', component: LogoCloud },
  stats: { name: 'Stats', component: Stats },
  faq: { name: 'FAQ', component: Faq },
  spacer: { name: 'Spacer', component: Spacer },
  gallery: { name: 'Gallery', component: Gallery },
  pricingTable: { name: 'Pricing table', component: PricingTable },
  teamGrid: { name: 'Team grid', component: TeamGrid },
  contactForm: { name: 'Contact form', component: ContactForm },
  videoEmbed: { name: 'Video', component: VideoEmbed },
};

export const blockTypes = Object.keys(blockRegistry) as BlockType[];

/**
 * Undefined for a type this build doesn't know — stored JSON can be newer than
 * the running code (a block added in `admin` before `web` is redeployed).
 */
export function getBlockComponent(block: Block): BlockComponent<BlockType> | undefined {
  return blockRegistry[block.type]?.component as BlockComponent<BlockType> | undefined;
}
