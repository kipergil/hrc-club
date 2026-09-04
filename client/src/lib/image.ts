/**
 * Getting a photograph of a card small enough to arrive.
 *
 * A card is photographed on a phone, and a modern phone takes a 12-megapixel
 * picture: four to eight megabytes of JPEG, which base64 inflates by a third
 * again before it is put in a JSON body. The platform this runs on refuses a
 * request body over 4.5MB, and refuses it at the edge — the server never sees
 * it, so there is no error to report and nothing in any log. What the captain
 * sees is the upload stopping for no stated reason, which is exactly the
 * "sometimes it gets cancelled" this exists to end.
 *
 * So the picture is re-drawn at a sane size before it goes anywhere. 1800px on
 * the long edge is comfortably enough to read a biro'd 11-8 — the card is a
 * single A4 sheet of large handwriting, not a document scan — and takes a
 * typical photograph from six megabytes to about three hundred kilobytes.
 * That is under the cap with room to spare, and it reaches the model faster,
 * which shortens the wait as well as removing the failure.
 */

/** The long edge of the image that is actually sent. */
export const MAX_EDGE = 1800;

/** JPEG quality. High enough for pen on paper, low enough to be worth doing. */
export const JPEG_QUALITY = 0.85;

export interface PreparedImage {
  /** Base64, without the `data:` prefix the API does not want. */
  data: string;
  mediaType: string;
  width: number;
  height: number;
  /** Decoded size in bytes, for reporting what the shrinking achieved. */
  bytes: number;
}

/**
 * The size to draw at: never enlarged, only ever reduced.
 *
 * Scaling a small photograph up would cost bytes and add nothing — a card
 * photographed at 900px is a card photographed at 900px, and interpolating it
 * to 1800 invents detail the model would then read as if it were there.
 */
export function fitWithin(
  width: number,
  height: number,
  maxEdge = MAX_EDGE,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge || longest === 0) return { width, height };

  const scale = maxEdge / longest;
  return {
    // `max(1, …)` so a pathologically thin image cannot round to a zero
    // dimension, which throws on canvas rather than producing a small image.
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Bytes a base64 string decodes to, without decoding it. */
export function base64Bytes(data: string): number {
  const padding = data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((data.length * 3) / 4) - padding);
}

function toBase64(dataUrl: string): string {
  const comma = dataUrl.indexOf(",");
  return comma === -1 ? dataUrl : dataUrl.slice(comma + 1);
}

/** Reads a file as base64, unchanged. The fallback when redrawing is not on. */
export function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("That file could not be read."));
    reader.onload = () => resolve(toBase64(String(reader.result)));
    reader.readAsDataURL(file);
  });
}

/**
 * A photograph, redrawn small enough to send.
 *
 * `imageOrientation: "from-image"` matters more than it looks: a phone held
 * sideways writes the picture in the sensor's orientation and an EXIF tag
 * saying which way up it goes. Decoded without honouring that tag, the card
 * arrives at the model rotated ninety degrees — which it will gamely try to
 * read, and get wrong in ways that look like bad handwriting rather than like
 * a bug.
 *
 * Every failure here falls back to sending the file as it is. A card that is
 * too big to send is a bad outcome; a card that cannot be sent because the
 * shrinking failed is a worse one, and the server still accepts up to 8MB.
 */
export async function prepareCardImage(file: File): Promise<PreparedImage> {
  const original = async (): Promise<PreparedImage> => {
    const data = await readAsBase64(file);
    return { data, mediaType: file.type, width: 0, height: 0, bytes: base64Bytes(data) };
  };

  if (typeof createImageBitmap !== "function" || typeof document === "undefined") {
    return original();
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return original();
  }

  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) return original();
    context.drawImage(bitmap, 0, 0, width, height);

    const data = toBase64(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
    if (!data) return original();

    return { data, mediaType: "image/jpeg", width, height, bytes: base64Bytes(data) };
  } catch {
    return original();
  } finally {
    bitmap.close();
  }
}
