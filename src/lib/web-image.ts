/** Shared browser-side upload preparation; keep animation and small images intact. */
export function isHeic(file: File): boolean {
  return /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

export function imageDimensions(width: number, height: number, maxEdge = 1400) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

const TARGET_BYTES = 250_000;

export async function toWebImage(file: File): Promise<File> {
  if (typeof window === "undefined" || file.type === "image/gif" || file.type === "image/svg+xml") return file;
  let source: Blob = file;
  try {
    if (isHeic(file)) {
      const { default: heic2any } = await import("heic2any");
      const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.85 });
      const blob = Array.isArray(out) ? out[0] : out;
      if (!blob) return file;
      source = blob;
    } else if (file.size <= TARGET_BYTES) {
      return file;
    }

    const url = URL.createObjectURL(source);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) return file;
      let result: Blob | null = null;
      // WebP preserves transparency. Limit work for unusually detailed photos.
      for (const edge of [1400, 1200, 1000, 800]) {
        const size = imageDimensions(image.naturalWidth, image.naturalHeight, edge);
        canvas.width = size.width;
        canvas.height = size.height;
        context.drawImage(image, 0, 0, size.width, size.height);
        result = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
        if (result && result.size <= TARGET_BYTES) break;
      }
      if (!result || (!isHeic(file) && result.size >= file.size)) return file;
      const extension = result.type === "image/webp" ? "webp" : "png";
      return new File([result], file.name.replace(/\.[^.]+$/, "") + "." + extension, { type: result.type });
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return file;
  }
}
