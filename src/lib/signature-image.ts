// ============================================================================
// lib/signature-image.ts — Signature Suite, Phase A
//
// Browser helpers that turn a drawn pad, a typed name, or an uploaded photo
// into ONE format: a transparent PNG data URL cropped to the ink. Everything
// downstream (sign-step, pdf-form/process, pdf-form-engine.embedPng) only
// accepts PNG, so every capture mode must end here.
//
// DOM-only functions are safe to import on the server; they're only called
// from event handlers in client components.
// ============================================================================

/** Saved/applied signatures must be PNG data URLs (the server rejects anything else). */
export const SIGNATURE_PNG_RE = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/;
/** Max length of a saved signature data URL (~370 KB PNG). Real signatures are 5–60 KB. */
export const MAX_SAVED_SIGNATURE_CHARS = 500_000;
/** Max upload accepted before processing (the result is always re-encoded much smaller). */
export const MAX_SIGNATURE_UPLOAD_BYTES = 8 * 1024 * 1024;
/** Longest edge of any produced signature image, in pixels. Keeps PNGs small. */
const MAX_EDGE = 1000;

export type SignatureMethod = 'draw' | 'type' | 'upload';

export function isValidSignaturePng(v: unknown): v is string {
  return typeof v === 'string' && v.length <= MAX_SAVED_SIGNATURE_CHARS && SIGNATURE_PNG_RE.test(v);
}

/**
 * Crops a canvas to the bounding box of its non-transparent pixels (+ padding)
 * and downsizes so the longest edge is ≤ MAX_EDGE. Returns null if empty.
 */
export function cropCanvasToInk(canvas: HTMLCanvasElement, padding = 6): string | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const { width, height } = canvas;
  if (!width || !height) return null;
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null; // nothing there
  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(width - 1, maxX + padding);
  maxY = Math.min(height - 1, maxY + padding);
  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  const scale = Math.min(1, MAX_EDGE / Math.max(cw, ch));
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(cw * scale));
  out.height = Math.max(1, Math.round(ch * scale));
  const octx = out.getContext('2d');
  if (!octx) return null;
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(canvas, minX, minY, cw, ch, 0, 0, out.width, out.height);
  return out.toDataURL('image/png');
}

/**
 * Renders a typed name in a script font. `fontFamily` must be a CSS family
 * string (e.g. next/font's `font.style.fontFamily`). Waits for the font so the
 * canvas never silently falls back to a plain sans-serif.
 */
export async function renderTypedSignature(name: string, fontFamily: string): Promise<string | null> {
  const text = name.trim().slice(0, 80);
  if (!text) return null;
  const size = 96;
  const font = `${size}px ${fontFamily}`;
  try {
    await document.fonts.load(font, text);
  } catch {
    /* fall through — draw with whatever is available */
  }
  const measure = document.createElement('canvas').getContext('2d');
  if (!measure) return null;
  measure.font = font;
  const textWidth = Math.ceil(measure.measureText(text).width);
  const canvas = document.createElement('canvas');
  // Script fonts have big swashes; leave generous room, cropToInk trims it.
  canvas.width = Math.min(4000, textWidth + size * 2);
  canvas.height = Math.round(size * 2.4);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.font = font;
  ctx.fillStyle = '#111111'; // signatures are always dark ink, regardless of theme
  ctx.textBaseline = 'middle';
  ctx.fillText(text, size, canvas.height / 2);
  return cropCanvasToInk(canvas, 8);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('That image could not be opened.'));
    img.src = src;
  });
}

/**
 * Turns a photo/scan of a signature into a transparent, ink-cropped PNG:
 * light (paper) pixels become transparent, dark pixels become ink.
 */
export async function processUploadedSignature(file: File): Promise<string> {
  if (!/^image\/(png|jpe?g|webp|gif|bmp)$/i.test(file.type)) {
    throw new Error('Please choose a PNG, JPG or WEBP image.');
  }
  if (file.size > MAX_SIGNATURE_UPLOAD_BYTES) {
    throw new Error('That image is too large (8 MB max).');
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Your browser could not process that image.');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = frame.data;
    for (let i = 0; i < px.length; i += 4) {
      const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      const srcAlpha = px[i + 3] / 255;
      // ≥ 200 luminance → paper (transparent); ≤ 120 → full ink; smooth ramp between.
      const ink = lum >= 200 ? 0 : lum <= 120 ? 1 : (200 - lum) / 80;
      const alpha = Math.round(255 * ink * srcAlpha);
      // Keep the original hue (blue ink stays blue) but darken it slightly for print.
      px[i] = Math.round(px[i] * 0.6);
      px[i + 1] = Math.round(px[i + 1] * 0.6);
      px[i + 2] = Math.round(px[i + 2] * 0.6);
      px[i + 3] = alpha;
    }
    ctx.putImageData(frame, 0, 0);
    const out = cropCanvasToInk(canvas, 8);
    if (!out) throw new Error('No signature was found in that image. Try a darker pen on white paper.');
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}
