/**
 * What stops a page going live (CNT-12): anything a visitor would see as
 * broken or empty. Errors block publishing; warnings never do.
 *
 * The one place these rules live — `admin` shows the API's result rather than
 * running its own copy. `api` doesn't import `cms-blocks` (no cross-repo
 * imports), so the block shapes below are hand-written against
 * `cms-blocks/src/types.ts`; `publish-checks.spec.ts` fails if a block type
 * is added there without a rule here. See DECISIONS.md D-036.
 */

export type PublishProblem = {
  /** 0-based position in `content.blocks`; `null` for a page-level problem. */
  blockIndex: number | null;
  blockType: string | null;
  /** Human name of the block, e.g. "Call to action". */
  blockLabel: string | null;
  /** Dotted path to the field, e.g. `items.1.answer`. */
  field: string | null;
  /** What to do about it, in the editor's voice. */
  message: string;
};

export type PublishChecks = {
  errors: PublishProblem[];
  warnings: PublishProblem[];
};

type Fields = Record<string, unknown>;

export const BLOCK_LABELS = {
  hero: 'Hero',
  richText: 'Rich text',
  imageText: 'Image and text',
  featureGrid: 'Feature grid',
  testimonial: 'Testimonial',
  cta: 'Call to action',
  logoCloud: 'Logo cloud',
  stats: 'Stats',
  faq: 'FAQ',
  spacer: 'Spacer',
  gallery: 'Gallery',
  pricingTable: 'Pricing table',
  teamGrid: 'Team grid',
  contactForm: 'Contact form',
} as const;

export type KnownBlockType = keyof typeof BLOCK_LABELS;

function isBlank(value: unknown): boolean {
  return typeof value !== 'string' || value.trim() === '';
}

function asFields(value: unknown): Fields | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Fields)
    : null;
}

/** Collects the problems of one block, so each rule reads as a list of requirements. */
class BlockCheck {
  constructor(
    private readonly out: PublishChecks,
    private readonly index: number,
    private readonly type: string,
    private readonly label: string,
  ) {}

  private push(list: PublishProblem[], field: string, message: string) {
    list.push({
      blockIndex: this.index,
      blockType: this.type,
      blockLabel: this.label,
      field,
      message,
    });
  }

  error(field: string, message: string) {
    this.push(this.out.errors, field, message);
  }

  text(fields: Fields, key: string, path: string, message: string) {
    if (isBlank(fields[key])) this.error(path, message);
  }

  /**
   * A button. An optional one left completely empty counts as absent: the
   * editor stores `{ label: '', href: '' }` once a field has been typed in
   * and cleared, and the renderers skip it (`hasLink` in cms-blocks).
   * Half-filled is always an error, because it renders as a broken button.
   */
  link(
    fields: Fields,
    key: string,
    path: string,
    name: string,
    required: boolean,
  ) {
    const link = asFields(fields[key]);
    const noLabel = isBlank(link?.label);
    const noHref = isBlank(link?.href);
    if (noLabel && noHref) {
      if (required) this.error(path, `Add text and a link to ${name}`);
      return;
    }
    if (noLabel) this.error(`${path}.label`, `Add text to ${name}`);
    if (noHref) this.error(`${path}.href`, `Add a link to ${name}`);
  }

  /**
   * An image. Optional and empty counts as absent, like `link` (`hasImage` in
   * cms-blocks; TeamGrid's default photo is `{ src: '' }`). Missing alt text only warns.
   */
  image(
    fields: Fields,
    key: string,
    path: string,
    name: string,
    required: boolean,
  ) {
    const image = asFields(fields[key]);
    if (isBlank(image?.src)) {
      if (required) this.error(`${path}.src`, `Choose ${name}`);
      return;
    }
    if (isBlank(image?.alt)) {
      this.push(
        this.out.warnings,
        `${path}.alt`,
        `Describe ${name} for people using screen readers`,
      );
    }
  }

  /** A list of items, checked one by one; `min` items required. */
  list(
    fields: Fields,
    key: string,
    empty: string,
    min: number,
    each?: (item: Fields, path: string, n: number) => void,
  ) {
    const items = Array.isArray(fields[key]) ? (fields[key] as unknown[]) : [];
    if (items.length < min) this.error(key, empty);
    items.forEach((item, i) =>
      each?.(asFields(item) ?? {}, `${key}.${i}`, i + 1),
    );
  }
}

type Rule = (check: BlockCheck, block: Fields) => void;

// Exhaustive by block type: a type without a rule is a compile error here,
// and a type in cms-blocks without an entry here fails publish-checks.spec.ts.
const RULES: Record<KnownBlockType, Rule> = {
  hero(c, b) {
    c.text(b, 'headline', 'headline', 'Add a headline');
    c.link(b, 'primaryAction', 'primaryAction', 'the main button', false);
    c.link(b, 'secondaryAction', 'secondaryAction', 'the second button', false);
    c.image(b, 'image', 'image', 'the image', false);
    c.list(b, 'facts', '', 0, (fact, path, n) => {
      c.text(fact, 'label', `${path}.label`, `Add a label to fact ${n}`);
      c.text(fact, 'value', `${path}.value`, `Add a value to fact ${n}`);
    });
  },
  richText(c, b) {
    const text =
      typeof b.html === 'string'
        ? b.html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ')
        : '';
    if (isBlank(text)) c.error('html', 'Add some text');
  },
  imageText(c, b) {
    c.text(b, 'heading', 'heading', 'Add a heading');
    c.text(b, 'body', 'body', 'Add the body text');
    c.image(b, 'image', 'image', 'the image', true);
    c.link(b, 'action', 'action', 'the button', false);
  },
  featureGrid(c, b) {
    c.list(b, 'items', 'Add at least one feature', 1, (item, path, n) => {
      c.text(item, 'title', `${path}.title`, `Add a title to feature ${n}`);
      c.text(item, 'body', `${path}.body`, `Add a description to feature ${n}`);
    });
  },
  testimonial(c, b) {
    c.text(b, 'quote', 'quote', 'Add the quote');
    c.text(b, 'attribution', 'attribution', 'Add who said it');
  },
  cta(c, b) {
    c.text(b, 'heading', 'heading', 'Add a heading');
    c.link(b, 'action', 'action', 'the button', true);
  },
  logoCloud(c, b) {
    c.list(b, 'logos', 'Add at least one logo', 1, (logo, path, n) => {
      c.image({ logo }, 'logo', path, `logo ${n}`, true);
    });
  },
  stats(c, b) {
    c.list(b, 'items', 'Add at least one stat', 1, (item, path, n) => {
      c.text(item, 'label', `${path}.label`, `Add a label to stat ${n}`);
      c.text(item, 'value', `${path}.value`, `Add a value to stat ${n}`);
    });
  },
  faq(c, b) {
    c.list(b, 'items', 'Add at least one question', 1, (item, path, n) => {
      c.text(item, 'question', `${path}.question`, `Write question ${n}`);
      c.text(item, 'answer', `${path}.answer`, `Answer question ${n}`);
    });
  },
  spacer() {},
  gallery(c, b) {
    c.list(b, 'images', 'Add at least one image', 1, (image, path, n) => {
      c.image({ image }, 'image', path, `image ${n}`, true);
    });
  },
  pricingTable(c, b) {
    c.list(b, 'plans', 'Add at least one plan', 1, (plan, path, n) => {
      c.text(plan, 'name', `${path}.name`, `Name plan ${n}`);
      c.text(plan, 'price', `${path}.price`, `Add a price to plan ${n}`);
      c.link(plan, 'action', `${path}.action`, `the button of plan ${n}`, true);
      const features = Array.isArray(plan.features) ? plan.features : [];
      features.forEach((feature, i) => {
        if (isBlank(feature))
          c.error(
            `${path}.features.${i}`,
            `Add text to feature ${i + 1} of plan ${n}`,
          );
      });
    });
  },
  teamGrid(c, b) {
    c.list(b, 'members', 'Add at least one person', 1, (member, path, n) => {
      c.text(member, 'name', `${path}.name`, `Add person ${n}'s name`);
      c.text(member, 'role', `${path}.role`, `Add person ${n}'s role`);
      c.image(
        member,
        'photo',
        `${path}.photo`,
        `the photo of person ${n}`,
        false,
      );
    });
  },
  contactForm(c, b) {
    c.text(b, 'submitLabel', 'submitLabel', 'Add the send button text');
    c.list(b, 'fields', 'Add at least one form field', 1, (field, path, n) => {
      c.text(field, 'label', `${path}.label`, `Add a label to field ${n}`);
      c.text(field, 'name', `${path}.name`, `Add a name to field ${n}`);
    });
    // Two fields with one name would overwrite each other's answer.
    const names = (Array.isArray(b.fields) ? b.fields : []).map(
      (f) => asFields(f)?.name,
    );
    names.forEach((name, i) => {
      const first = names.indexOf(name);
      if (typeof name === 'string' && name.trim() && first < i) {
        c.error(
          `fields.${i}.name`,
          `Give field ${i + 1} a different name from field ${first + 1}`,
        );
      }
    });
  },
};

function isKnownType(type: string): type is KnownBlockType {
  return Object.hasOwn(RULES, type);
}

export function checkPublishable(blocks: unknown): PublishChecks {
  const out: PublishChecks = { errors: [], warnings: [] };
  const list = Array.isArray(blocks) ? blocks : [];

  if (list.length === 0) {
    out.errors.push({
      blockIndex: null,
      blockType: null,
      blockLabel: null,
      field: null,
      message: 'Add at least one block',
    });
    return out;
  }

  list.forEach((raw, index) => {
    const block = asFields(raw) ?? {};
    const type = typeof block.type === 'string' ? block.type : '';
    if (!isKnownType(type)) {
      out.errors.push({
        blockIndex: index,
        blockType: type || null,
        blockLabel: null,
        field: null,
        message: 'This block type no longer exists. Remove the block',
      });
      return;
    }
    RULES[type](new BlockCheck(out, index, type, BLOCK_LABELS[type]), block);
  });

  return out;
}
