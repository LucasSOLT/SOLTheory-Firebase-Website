import { renderHeroCta } from './hero-cta';
import type { HeroCtaData } from './hero-cta';
import { renderNewsletter } from './newsletter';
import type { NewsletterData, NewsletterSection } from './newsletter';
import { renderProductShowcase } from './product-showcase';
import type { ProductShowcaseData, ProductItem } from './product-showcase';
import { renderAnnouncement } from './announcement';
import type { AnnouncementData } from './announcement';
import { renderMinimalBranded } from './minimal-branded';
import type { MinimalBrandedData } from './minimal-branded';
import { renderImageForward } from './image-forward';
import type { ImageForwardData } from './image-forward';

// Re-export all types
export type {
  HeroCtaData,
  NewsletterData,
  NewsletterSection,
  ProductShowcaseData,
  ProductItem,
  AnnouncementData,
  MinimalBrandedData,
  ImageForwardData,
};

// Re-export all render functions
export {
  renderHeroCta,
  renderNewsletter,
  renderProductShowcase,
  renderAnnouncement,
  renderMinimalBranded,
  renderImageForward,
};

/**
 * Metadata descriptor for a skeleton template.
 */
export interface SkeletonMeta {
  id: string;
  name: string;
  description: string;
  category: string;
  slots: string[];
  optionalSlots: string[];
  render: (data: any) => string;
}

/**
 * Registry of all available email skeleton templates.
 */
export const SKELETON_REGISTRY: SkeletonMeta[] = [
  {
    id: 'hero-cta',
    name: 'Hero CTA',
    description:
      'Full-width hero image at the top, bold headline, body text, and a prominent call-to-action button. Perfect for product launches, event invitations, and marketing campaigns.',
    category: 'marketing',
    slots: ['heroImage', 'headline', 'bodyText', 'ctaText', 'ctaUrl'],
    optionalSlots: ['brandColor', 'preheaderText', 'footerText'],
    render: renderHeroCta,
  },
  {
    id: 'newsletter',
    name: 'Newsletter',
    description:
      'Multi-section newsletter with a branded header bar, optional logo, and up to 6 alternating image/text sections with read-more links. Ideal for recurring digests and curated content.',
    category: 'newsletter',
    slots: ['headerTitle', 'sections'],
    optionalSlots: ['logoImage', 'brandColor', 'preheaderText', 'footerText'],
    render: renderNewsletter,
  },
  {
    id: 'product-showcase',
    name: 'Product Showcase',
    description:
      'A 2-column product grid showcasing 2–4 items with images, names, prices, and descriptions. Falls back to a single column for one product. Great for e-commerce and catalog emails.',
    category: 'ecommerce',
    slots: ['headerText', 'products'],
    optionalSlots: ['brandColor', 'preheaderText', 'footerText', 'ctaText', 'ctaUrl'],
    render: renderProductShowcase,
  },
  {
    id: 'announcement',
    name: 'Announcement',
    description:
      'Clean, centered announcement layout with an optional accent image, large headline, body text, and optional CTA. Designed for maximum impact with minimal distraction.',
    category: 'transactional',
    slots: ['headline', 'bodyText'],
    optionalSlots: ['accentImage', 'brandColor', 'preheaderText', 'ctaText', 'ctaUrl', 'footerText'],
    render: renderAnnouncement,
  },
  {
    id: 'minimal-branded',
    name: 'Minimal Branded',
    description:
      'The most versatile skeleton: a thin brand header with optional logo, a freeform HTML content area for any content, and a professional footer with sender details. Use for custom or transactional emails.',
    category: 'transactional',
    slots: ['bodyHtml'],
    optionalSlots: [
      'logoImage',
      'brandColor',
      'preheaderText',
      'senderName',
      'senderTitle',
      'senderEmail',
      'senderPhone',
      'companyWebsite',
    ],
    render: renderMinimalBranded,
  },
  {
    id: 'image-forward',
    name: 'Image Forward',
    description:
      'One big beautiful image takes center stage with minimal text below. Designed for the Canva use case — when the image IS the email. Optional CTA and sender info.',
    category: 'marketing',
    slots: ['heroImage'],
    optionalSlots: [
      'bodyText',
      'ctaText',
      'ctaUrl',
      'brandColor',
      'preheaderText',
      'footerText',
      'senderName',
      'senderEmail',
    ],
    render: renderImageForward,
  },
];

/**
 * Look up skeleton metadata by ID.
 */
export function getSkeletonMeta(id: string): SkeletonMeta | undefined {
  return SKELETON_REGISTRY.find((s) => s.id === id);
}

/**
 * Render a skeleton by its registry ID with the given data.
 * Throws if the skeleton ID is not found.
 */
export function renderSkeleton(id: string, data: any): string {
  const meta = getSkeletonMeta(id);
  if (!meta) {
    throw new Error(`Unknown email skeleton id: "${id}". Available: ${SKELETON_REGISTRY.map((s) => s.id).join(', ')}`);
  }
  return meta.render(data);
}
