/**
 * Thin browser-only helpers to turn the attendance-card SVG string into a PNG
 * and hand it to the OS share sheet (mobile) or a download (desktop). Kept out
 * of the pure domain layer because they touch Image/canvas/navigator; the
 * card's markup and data are tested in domain/attendanceCard.test.ts.
 */

export function svgToBlob(svg: string): Blob {
  return new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
}

/** Rasterize an SVG string to a PNG Blob at 2× for crisp output. */
export async function svgToPngBlob(svg: string, width: number, height: number): Promise<Blob> {
  const url = URL.createObjectURL(svgToBlob(svg));
  try {
    const img = new Image();
    img.width = width;
    img.height = height;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('svg image load failed'));
      img.src = url;
    });
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d context unavailable');
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export type ShareResult = 'shared' | 'cancelled' | 'unsupported' | 'failed';

/**
 * Hand the PNG to the OS share sheet, from which the user picks WhatsApp.
 *
 * Deliberately has no download fallback. It used to fall back, and that made
 * every failure look like a silent "it saved the file instead" — including a
 * plain user cancel. The four outcomes are reported separately so the screen
 * can stay quiet on a cancel and say something useful otherwise.
 *
 * Must be called straight from the click handler with the blob already built:
 * `navigator.share` only runs while the browser still considers the tap
 * recent, and awaiting the canvas rasterization first burns that window.
 */
export async function sharePng(blob: Blob, filename: string, title: string): Promise<ShareResult> {
  const file = new File([blob], filename, { type: 'image/png' });
  const nav = navigator as Navigator & {
    canShare?: (data: unknown) => boolean;
    share?: (data: unknown) => Promise<void>;
  };
  if (!nav.share || !nav.canShare || !nav.canShare({ files: [file] })) return 'unsupported';
  try {
    await nav.share({ files: [file], title });
    return 'shared';
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return 'cancelled';
    return 'failed';
  }
}
