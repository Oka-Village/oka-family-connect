/** Browsers other than Safari can't show iPhone HEIC/HEIF photos, so convert them to JPEG before upload. */
export function isHeic(file: File): boolean {
  return /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

export async function toWebImage(file: File): Promise<File> {
  if (typeof window === "undefined" || !isHeic(file)) return file;
  try {
    const { default: heic2any } = await import("heic2any");
    const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.85 });
    const blob = Array.isArray(out) ? out[0]! : out;
    return new File([blob], file.name.replace(/\.hei[cf]$/i, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}
