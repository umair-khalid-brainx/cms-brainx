import type { Config } from '@puckeditor/core';
import {
  Hero,
  RichText,
  ImageText,
  FeatureGrid,
  Testimonial,
  Cta,
  LogoCloud,
  Stats,
  Faq,
  Spacer,
  Gallery,
  PricingTable,
  TeamGrid,
  ContactForm,
  SiteThemeRoot,
  type HeroBlock,
  type RichTextBlock,
  type ImageTextBlock,
  type FeatureGridBlock,
  type TestimonialBlock,
  type CtaBlock,
  type LogoCloudBlock,
  type StatsBlock,
  type FaqBlock,
  type SpacerBlock,
  type GalleryBlock,
  type TeamGridBlock,
  type ContactFormBlock,
  type LinkRef,
  type SiteTheme,
} from 'cms-blocks';
import { ImageUploadField } from '../components/ImageUploadField';

// Field shapes mirror cms-blocks/src/types.ts exactly. Puck hands `render` the
// field values flat; each block component wants them nested under `block`, so
// each render() below is the entire translation needed (see DECISIONS.md D-015
// — this same shape, minus Puck's own `id`, is what gets saved to the API).

// PricingTable is the one block whose editor-facing shape isn't a straight
// `Omit<Block, 'type'>`: Puck's `array` field has no "array of plain strings"
// mode, so each feature is edited as an { text } object and flattened back to
// a string in render() below (same translation-at-the-boundary pattern as D-015).
type PricingTableFields = {
  heading?: string;
  intro?: string;
  plans: {
    name: string;
    price: string;
    period?: string;
    features: { text: string }[];
    action: LinkRef;
    highlighted?: boolean;
  }[];
};

export type EditorComponents = {
  Hero: Omit<HeroBlock, 'type'>;
  RichText: Omit<RichTextBlock, 'type'>;
  ImageText: Omit<ImageTextBlock, 'type'>;
  FeatureGrid: Omit<FeatureGridBlock, 'type'>;
  Testimonial: Omit<TestimonialBlock, 'type'>;
  Cta: Omit<CtaBlock, 'type'>;
  LogoCloud: Omit<LogoCloudBlock, 'type'>;
  Stats: Omit<StatsBlock, 'type'>;
  Faq: Omit<FaqBlock, 'type'>;
  Spacer: Omit<SpacerBlock, 'type'>;
  Gallery: Omit<GalleryBlock, 'type'>;
  PricingTable: PricingTableFields;
  TeamGrid: Omit<TeamGridBlock, 'type'>;
  ContactForm: Omit<ContactFormBlock, 'type'>;
};

// Corrick Oyster Co.'s real theme — same values as `web/src/fixtures/corrick.ts`.
// Duplicated, not imported: `admin` cannot import from `web` (CLAUDE.md — no
// cross-repo imports except the published `cms-blocks` package), and content
// data isn't part of that package. Once a real content API exists this comes
// from `site.themeJson` instead of living in either repo's source.
export const corrickTheme: SiteTheme = {
  typeSet: 'editorial',
  shape: 'soft',
  density: 'comfortable',
  texture: 'grain',
  palette: {
    paper: '#D9E0D8',
    surface: '#F1F4EF',
    ink: '#13201C',
    muted: '#556258',
    line: '#B6C2B5',
    brand: '#2E4A3E',
    onBrand: '#F1F4EF',
    accent: '#C8863C',
  },
};

const linkField = {
  type: 'object' as const,
  objectFields: {
    label: { type: 'text' as const },
    href: { type: 'text' as const },
  },
};

// `src` gets the upload-capable custom field everywhere an image is edited —
// pasting a URL still works, this just adds a side-by-side "Upload" option
// backed by POST /media (media.service.ts on the api side).
const imageSrcField = { type: 'custom' as const, render: ImageUploadField };

const imageField = {
  type: 'object' as const,
  objectFields: {
    src: imageSrcField,
    alt: { type: 'text' as const },
    caption: { type: 'text' as const },
  },
};

export const config: Config<EditorComponents> = {
  root: {
    render: ({ children }) => <SiteThemeRoot theme={corrickTheme}>{children}</SiteThemeRoot>,
  },
  components: {
    Hero: {
      fields: {
        eyebrow: { type: 'text' },
        headline: { type: 'text' },
        body: { type: 'textarea' },
        primaryAction: linkField,
        secondaryAction: linkField,
        image: imageField,
        facts: {
          type: 'array',
          arrayFields: { label: { type: 'text' }, value: { type: 'text' } },
          defaultItemProps: { label: '', value: '' },
        },
      },
      defaultProps: { headline: 'New headline', facts: [] },
      render: ({ eyebrow, headline, body, primaryAction, secondaryAction, image, facts }) => (
        <Hero block={{ type: 'hero', eyebrow, headline, body, primaryAction, secondaryAction, image, facts }} />
      ),
    },
    RichText: {
      fields: {
        heading: { type: 'text' },
        // Plain textarea for now — TipTap + sanitize-on-write is BLK-05.
        html: { type: 'textarea' },
      },
      defaultProps: { html: '<p>New paragraph.</p>' },
      render: ({ heading, html }) => <RichText block={{ type: 'richText', heading, html }} />,
    },
    ImageText: {
      fields: {
        heading: { type: 'text' },
        body: { type: 'textarea' },
        image: imageField,
        imagePosition: {
          type: 'radio',
          options: [
            { label: 'Left', value: 'left' },
            { label: 'Right', value: 'right' },
          ],
        },
        action: linkField,
      },
      defaultProps: {
        heading: 'Heading',
        body: '',
        image: { src: '', alt: '', caption: '' },
        imagePosition: 'left',
      },
      render: ({ heading, body, image, imagePosition, action }) => (
        <ImageText block={{ type: 'imageText', heading, body, image, imagePosition, action }} />
      ),
    },
    FeatureGrid: {
      fields: {
        heading: { type: 'text' },
        intro: { type: 'textarea' },
        ordered: {
          type: 'radio',
          options: [
            { label: 'Unordered', value: false },
            { label: 'Numbered', value: true },
          ],
        },
        items: {
          type: 'array',
          arrayFields: {
            label: { type: 'text' },
            title: { type: 'text' },
            body: { type: 'textarea' },
          },
          defaultItemProps: { label: '', title: '', body: '' },
        },
      },
      defaultProps: { items: [] },
      render: ({ heading, intro, ordered, items }) => (
        <FeatureGrid block={{ type: 'featureGrid', heading, intro, ordered, items }} />
      ),
    },
    Testimonial: {
      fields: {
        quote: { type: 'textarea' },
        attribution: { type: 'text' },
        role: { type: 'text' },
      },
      defaultProps: { quote: '', attribution: '' },
      render: ({ quote, attribution, role }) => (
        <Testimonial block={{ type: 'testimonial', quote, attribution, role }} />
      ),
    },
    Cta: {
      fields: {
        heading: { type: 'text' },
        body: { type: 'textarea' },
        action: linkField,
        note: { type: 'text' },
      },
      defaultProps: { heading: 'Heading', action: { label: '', href: '' } },
      render: ({ heading, body, action, note }) => (
        <Cta block={{ type: 'cta', heading, body, action, note }} />
      ),
    },
    LogoCloud: {
      fields: {
        heading: { type: 'text' },
        logos: {
          type: 'array',
          arrayFields: { src: imageSrcField, alt: { type: 'text' } },
          defaultItemProps: { src: '', alt: '' },
        },
      },
      defaultProps: { logos: [] },
      render: ({ heading, logos }) => <LogoCloud block={{ type: 'logoCloud', heading, logos }} />,
    },
    Stats: {
      fields: {
        heading: { type: 'text' },
        items: {
          type: 'array',
          arrayFields: { label: { type: 'text' }, value: { type: 'text' } },
          defaultItemProps: { label: '', value: '' },
        },
      },
      defaultProps: { items: [] },
      render: ({ heading, items }) => <Stats block={{ type: 'stats', heading, items }} />,
    },
    Faq: {
      fields: {
        heading: { type: 'text' },
        intro: { type: 'textarea' },
        items: {
          type: 'array',
          arrayFields: { question: { type: 'text' }, answer: { type: 'textarea' } },
          defaultItemProps: { question: '', answer: '' },
        },
      },
      defaultProps: { items: [] },
      render: ({ heading, intro, items }) => <Faq block={{ type: 'faq', heading, intro, items }} />,
    },
    Spacer: {
      fields: {
        size: {
          type: 'radio',
          options: [
            { label: 'Small', value: 'sm' },
            { label: 'Medium', value: 'md' },
            { label: 'Large', value: 'lg' },
          ],
        },
      },
      defaultProps: { size: 'md' },
      render: ({ size }) => <Spacer block={{ type: 'spacer', size }} />,
    },
    Gallery: {
      fields: {
        heading: { type: 'text' },
        images: {
          type: 'array',
          arrayFields: { src: imageSrcField, alt: { type: 'text' }, caption: { type: 'text' } },
          defaultItemProps: { src: '', alt: '', caption: '' },
        },
      },
      defaultProps: { images: [] },
      render: ({ heading, images }) => <Gallery block={{ type: 'gallery', heading, images }} />,
    },
    PricingTable: {
      fields: {
        heading: { type: 'text' },
        intro: { type: 'textarea' },
        plans: {
          type: 'array',
          arrayFields: {
            name: { type: 'text' },
            price: { type: 'text' },
            period: { type: 'text' },
            features: {
              type: 'array',
              arrayFields: { text: { type: 'text' } },
              defaultItemProps: { text: '' },
            },
            action: linkField,
            highlighted: {
              type: 'radio',
              options: [
                { label: 'No', value: false },
                { label: 'Yes', value: true },
              ],
            },
          },
          defaultItemProps: {
            name: '',
            price: '',
            features: [],
            action: { label: '', href: '' },
            highlighted: false,
          },
        },
      },
      defaultProps: { plans: [] },
      render: ({ heading, intro, plans }) => (
        <PricingTable
          block={{
            type: 'pricingTable',
            heading,
            intro,
            plans: plans.map((plan) => ({ ...plan, features: plan.features.map((f) => f.text) })),
          }}
        />
      ),
    },
    TeamGrid: {
      fields: {
        heading: { type: 'text' },
        intro: { type: 'textarea' },
        members: {
          type: 'array',
          arrayFields: {
            name: { type: 'text' },
            role: { type: 'text' },
            bio: { type: 'textarea' },
            photo: imageField,
          },
          defaultItemProps: { name: '', role: '', photo: { src: '', alt: '', caption: '' } },
        },
      },
      defaultProps: { members: [] },
      render: ({ heading, intro, members }) => (
        <TeamGrid block={{ type: 'teamGrid', heading, intro, members }} />
      ),
    },
    ContactForm: {
      fields: {
        heading: { type: 'text' },
        intro: { type: 'textarea' },
        submitLabel: { type: 'text' },
        fields: {
          type: 'array',
          arrayFields: {
            name: { type: 'text' },
            label: { type: 'text' },
            fieldType: {
              type: 'radio',
              options: [
                { label: 'Text', value: 'text' },
                { label: 'Email', value: 'email' },
                { label: 'Textarea', value: 'textarea' },
              ],
            },
            required: {
              type: 'radio',
              options: [
                { label: 'No', value: false },
                { label: 'Yes', value: true },
              ],
            },
          },
          defaultItemProps: { name: '', label: '', fieldType: 'text', required: false },
        },
      },
      defaultProps: {
        submitLabel: 'Send',
        fields: [
          { name: 'name', label: 'Name', fieldType: 'text', required: true },
          { name: 'email', label: 'Email', fieldType: 'email', required: true },
          { name: 'message', label: 'Message', fieldType: 'textarea', required: true },
        ],
      },
      render: ({ heading, intro, submitLabel, fields }) => (
        <ContactForm block={{ type: 'contactForm', heading, intro, submitLabel, fields }} />
      ),
    },
  },
};
