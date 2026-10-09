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
  VideoEmbed,
  SiteThemeRoot,
  parseVideoUrl,
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
  type VideoEmbedBlock,
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

// VideoEmbed edits only the pasted link; `provider` + `videoId` are derived
// from it on save (contentApi.ts) and in render() below, never typed by hand.
type VideoEmbedFields = Omit<VideoEmbedBlock, 'type' | 'provider' | 'videoId'>;

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
  VideoEmbed: VideoEmbedFields;
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

// Every field carries a human `label` — client staff use this panel directly
// (D-014), and without one Puck shows the raw prop key (`primaryAction`).
const linkField = (label: string) => ({
  type: 'object' as const,
  label,
  objectFields: {
    label: { type: 'text' as const, label: 'Button text' },
    href: { type: 'text' as const, label: 'Link (URL or /path)' },
  },
});

// `src` gets the upload-capable custom field everywhere an image is edited —
// pasting a URL still works, this just adds a side-by-side "Upload" option
// backed by POST /media (media.service.ts on the api side).
const imageSrcField = { type: 'custom' as const, label: 'Image', render: ImageUploadField };
const altField = { type: 'text' as const, label: 'Alt text (describe the image)' };
const captionField = { type: 'text' as const, label: 'Caption' };

const imageField = (label: string) => ({
  type: 'object' as const,
  label,
  objectFields: { src: imageSrcField, alt: altField, caption: captionField },
});

// Collapsed array items show this instead of Puck's default "Item 1, Item 2".
const summary = (text: string | undefined, fallback: string, index?: number) =>
  text?.trim() || `${fallback} ${(index ?? 0) + 1}`;

export const config: Config<EditorComponents> = {
  root: {
    // `min-h-screen` as in web's SiteChrome: the site's paper fills the canvas
    // below the last block, instead of admin's own (dark-mode) page background.
    render: ({ children }) => (
      <SiteThemeRoot theme={corrickTheme} className="min-h-screen">
        {children}
      </SiteThemeRoot>
    ),
  },
  components: {
    Hero: {
      label: 'Hero',
      fields: {
        eyebrow: { type: 'text', label: 'Eyebrow (small text above the headline)' },
        headline: { type: 'text', label: 'Headline' },
        body: { type: 'textarea', label: 'Body' },
        primaryAction: linkField('Primary button'),
        secondaryAction: linkField('Secondary button'),
        image: imageField('Image'),
        facts: {
          type: 'array',
          label: 'Key facts',
          arrayFields: {
            label: { type: 'text', label: 'Label' },
            value: { type: 'text', label: 'Value' },
          },
          defaultItemProps: { label: '', value: '' },
          getItemSummary: (item, i) => summary(item.label, 'Fact', i),
        },
      },
      defaultProps: { headline: 'New headline', facts: [] },
      render: ({ eyebrow, headline, body, primaryAction, secondaryAction, image, facts }) => (
        <Hero block={{ type: 'hero', eyebrow, headline, body, primaryAction, secondaryAction, image, facts }} />
      ),
    },
    RichText: {
      label: 'Rich text',
      fields: {
        heading: { type: 'text', label: 'Heading' },
        // Plain textarea for now — TipTap + sanitize-on-write is BLK-05.
        html: { type: 'textarea', label: 'Content (HTML)' },
      },
      defaultProps: { html: '<p>New paragraph.</p>' },
      render: ({ heading, html }) => <RichText block={{ type: 'richText', heading, html }} />,
    },
    ImageText: {
      label: 'Image and text',
      fields: {
        heading: { type: 'text', label: 'Heading' },
        body: { type: 'textarea', label: 'Body' },
        image: imageField('Image'),
        imagePosition: {
          type: 'radio',
          label: 'Image position',
          options: [
            { label: 'Left', value: 'left' },
            { label: 'Right', value: 'right' },
          ],
        },
        action: linkField('Button'),
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
      label: 'Feature grid',
      fields: {
        heading: { type: 'text', label: 'Heading' },
        intro: { type: 'textarea', label: 'Intro' },
        ordered: {
          type: 'radio',
          label: 'Numbering',
          options: [
            { label: 'Unordered', value: false },
            { label: 'Numbered', value: true },
          ],
        },
        items: {
          type: 'array',
          label: 'Features',
          arrayFields: {
            label: { type: 'text', label: 'Label (small text above the title)' },
            title: { type: 'text', label: 'Title' },
            body: { type: 'textarea', label: 'Body' },
          },
          defaultItemProps: { label: '', title: '', body: '' },
          getItemSummary: (item, i) => summary(item.title, 'Feature', i),
        },
      },
      defaultProps: { items: [] },
      render: ({ heading, intro, ordered, items }) => (
        <FeatureGrid block={{ type: 'featureGrid', heading, intro, ordered, items }} />
      ),
    },
    Testimonial: {
      label: 'Testimonial',
      fields: {
        quote: { type: 'textarea', label: 'Quote' },
        attribution: { type: 'text', label: 'Name' },
        role: { type: 'text', label: 'Role or company' },
      },
      defaultProps: { quote: '', attribution: '' },
      render: ({ quote, attribution, role }) => (
        <Testimonial block={{ type: 'testimonial', quote, attribution, role }} />
      ),
    },
    Cta: {
      label: 'Call to action',
      fields: {
        heading: { type: 'text', label: 'Heading' },
        body: { type: 'textarea', label: 'Body' },
        action: linkField('Button'),
        note: { type: 'text', label: 'Note (small text under the button)' },
      },
      defaultProps: { heading: 'Heading', action: { label: '', href: '' } },
      render: ({ heading, body, action, note }) => (
        <Cta block={{ type: 'cta', heading, body, action, note }} />
      ),
    },
    LogoCloud: {
      label: 'Logo cloud',
      fields: {
        heading: { type: 'text', label: 'Heading' },
        logos: {
          type: 'array',
          label: 'Logos',
          arrayFields: { src: imageSrcField, alt: { type: 'text', label: 'Company name (alt text)' } },
          defaultItemProps: { src: '', alt: '' },
          getItemSummary: (item, i) => summary(item.alt, 'Logo', i),
        },
      },
      defaultProps: { logos: [] },
      render: ({ heading, logos }) => <LogoCloud block={{ type: 'logoCloud', heading, logos }} />,
    },
    Stats: {
      label: 'Stats',
      fields: {
        heading: { type: 'text', label: 'Heading' },
        items: {
          type: 'array',
          label: 'Stats',
          arrayFields: {
            label: { type: 'text', label: 'Label' },
            value: { type: 'text', label: 'Value' },
          },
          defaultItemProps: { label: '', value: '' },
          getItemSummary: (item, i) => summary(item.label, 'Stat', i),
        },
      },
      defaultProps: { items: [] },
      render: ({ heading, items }) => <Stats block={{ type: 'stats', heading, items }} />,
    },
    Faq: {
      label: 'FAQ',
      fields: {
        heading: { type: 'text', label: 'Heading' },
        intro: { type: 'textarea', label: 'Intro' },
        items: {
          type: 'array',
          label: 'Questions',
          arrayFields: {
            question: { type: 'text', label: 'Question' },
            answer: { type: 'textarea', label: 'Answer' },
          },
          defaultItemProps: { question: '', answer: '' },
          getItemSummary: (item, i) => summary(item.question, 'Question', i),
        },
      },
      defaultProps: { items: [] },
      render: ({ heading, intro, items }) => <Faq block={{ type: 'faq', heading, intro, items }} />,
    },
    Spacer: {
      label: 'Spacer',
      fields: {
        size: {
          type: 'radio',
          label: 'Size',
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
      label: 'Gallery',
      fields: {
        heading: { type: 'text', label: 'Heading' },
        images: {
          type: 'array',
          label: 'Images',
          arrayFields: { src: imageSrcField, alt: altField, caption: captionField },
          defaultItemProps: { src: '', alt: '', caption: '' },
          getItemSummary: (item, i) => summary(item.caption || item.alt, 'Image', i),
        },
      },
      defaultProps: { images: [] },
      render: ({ heading, images }) => <Gallery block={{ type: 'gallery', heading, images }} />,
    },
    PricingTable: {
      label: 'Pricing table',
      fields: {
        heading: { type: 'text', label: 'Heading' },
        intro: { type: 'textarea', label: 'Intro' },
        plans: {
          type: 'array',
          label: 'Plans',
          arrayFields: {
            name: { type: 'text', label: 'Plan name' },
            price: { type: 'text', label: 'Price' },
            period: { type: 'text', label: 'Billing period (e.g. per month)' },
            features: {
              type: 'array',
              label: 'Features',
              arrayFields: { text: { type: 'text', label: 'Feature' } },
              defaultItemProps: { text: '' },
              getItemSummary: (item, i) => summary(item.text, 'Feature', i),
            },
            action: linkField('Button'),
            highlighted: {
              type: 'radio',
              label: 'Highlight this plan',
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
          getItemSummary: (item, i) => summary(item.name, 'Plan', i),
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
      label: 'Team grid',
      fields: {
        heading: { type: 'text', label: 'Heading' },
        intro: { type: 'textarea', label: 'Intro' },
        members: {
          type: 'array',
          label: 'Team members',
          arrayFields: {
            name: { type: 'text', label: 'Name' },
            role: { type: 'text', label: 'Role' },
            bio: { type: 'textarea', label: 'Bio' },
            photo: imageField('Photo'),
          },
          defaultItemProps: { name: '', role: '', photo: { src: '', alt: '', caption: '' } },
          getItemSummary: (item, i) => summary(item.name, 'Member', i),
        },
      },
      defaultProps: { members: [] },
      render: ({ heading, intro, members }) => (
        <TeamGrid block={{ type: 'teamGrid', heading, intro, members }} />
      ),
    },
    ContactForm: {
      label: 'Contact form',
      fields: {
        heading: { type: 'text', label: 'Heading' },
        intro: { type: 'textarea', label: 'Intro' },
        submitLabel: { type: 'text', label: 'Submit button text' },
        fields: {
          type: 'array',
          label: 'Form fields',
          arrayFields: {
            label: { type: 'text', label: 'Label shown to visitors' },
            name: {
              type: 'text',
              label: 'Field key (optional, no spaces)',
              placeholder: 'Made from the label if left empty',
            },
            fieldType: {
              type: 'radio',
              label: 'Input type',
              options: [
                { label: 'Text', value: 'text' },
                { label: 'Email', value: 'email' },
                { label: 'Textarea', value: 'textarea' },
              ],
            },
            required: {
              type: 'radio',
              label: 'Required',
              options: [
                { label: 'No', value: false },
                { label: 'Yes', value: true },
              ],
            },
          },
          defaultItemProps: { name: '', label: '', fieldType: 'text', required: false },
          getItemSummary: (item, i) => summary(item.label || item.name, 'Field', i),
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
    VideoEmbed: {
      label: 'Video',
      fields: {
        heading: { type: 'text', label: 'Heading' },
        url: { type: 'text', label: 'YouTube or Vimeo link' },
        caption: { type: 'text', label: 'Caption' },
      },
      defaultProps: { url: '' },
      render: ({ heading, url, caption }) => {
        const video = parseVideoUrl(url);
        // Editor-only placeholder: the block itself renders nothing without a
        // valid video (right for the public site, but an invisible block
        // can't be selected on the canvas).
        if (!video) {
          return (
            <div className="mx-6 my-8 rounded-[var(--site-radius-md)] border border-dashed border-[var(--site-line)] p-10 text-center font-[family-name:var(--site-font-utility)] text-sm text-[var(--site-muted)] sm:mx-10">
              {url.trim() ? 'That link isn’t a YouTube or Vimeo video.' : 'Paste a YouTube or Vimeo link in the sidebar.'}
            </div>
          );
        }
        return <VideoEmbed block={{ type: 'videoEmbed', heading, url, caption, ...video }} />;
      },
    },
  },
};
