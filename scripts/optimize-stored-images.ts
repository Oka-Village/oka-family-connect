/** One-time photo maintenance. Dry run by default; --apply verifies a private
 * original copy before updating each referenced display file. No row/RLS edits. */
import { createClient } from "@supabase/supabase-js";

const url = process.env["SUPABASE_URL"];
const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
if (!url || !key) throw new Error("Server storage credentials are required.");
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const apply = process.argv.includes("--apply");
const references = new Map<string, { bucket: string; path: string; width: number }>();
const tables = [
  { table: "profiles", column: "photo_url", bucket: "avatars", width: 640 },
  { table: "skills", column: "photo_url", bucket: "avatars", width: 1400 },
  { table: "houses", column: "photos", bucket: "avatars", width: 1400 },
  { table: "events", column: "photo_url", bucket: "avatars", width: 1400 },
  { table: "themes", column: "image_path", bucket: "theme-images", width: 1400 },
];
for (const config of tables) {
  const { data, error } = await client.from(config.table).select(config.column);
  if (error) throw new Error("Could not read photo references; no photos changed.");
  for (const row of data ?? []) {
    const value = (row as unknown as Record<string, unknown>)[config.column];
    for (const path of Array.isArray(value) ? value : [value]) {
      if (typeof path !== "string" || !path || path.startsWith("http") || path.includes("..")) continue;
      const id = `${config.bucket}/${path}`;
      const existing = references.get(id);
      references.set(id, { bucket: config.bucket, path, width: Math.max(existing?.width ?? 0, config.width) });
    }
  }
}

const listings = new Map<string, Map<string, { size: number; mime: string }>>();
const candidates: Array<{ bucket: string; path: string; width: number }> = [];
for (const reference of references.values()) {
  const slash = reference.path.lastIndexOf("/");
  const directory = slash < 0 ? "" : reference.path.slice(0, slash);
  const name = reference.path.slice(slash + 1);
  const id = `${reference.bucket}/${directory}`;
  let files = listings.get(id);
  if (!files) {
    const { data, error } = await client.storage.from(reference.bucket).list(directory, { limit: 1000 });
    if (error) throw new Error("Could not inspect storage; no photos changed.");
    files = new Map((data ?? []).map((file) => [file.name, { size: Number(file.metadata?.size ?? 0), mime: String(file.metadata?.mimetype ?? "") }]));
    listings.set(id, files);
  }
  const metadata = files.get(name);
  if (metadata && metadata.size > 250_000 && /^image\/(jpeg|png|webp)$/.test(metadata.mime)) candidates.push(reference);
}
console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", referencedPhotos: references.size, candidates: candidates.length }));
if (!apply) process.exit(0);

const digest = async (blob: Blob) => Buffer.from(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer())).toString("hex");
let optimized = 0;
let skipped = 0;
let failed = 0;
let beforeBytes = 0;
let afterBytes = 0;
let cursor = 0;
async function worker() {
  while (cursor < candidates.length) {
    const reference = candidates[cursor++];
    if (!reference) continue;
    const bucket = client.storage.from(reference.bucket);
    try {
      const { data: source, error: sourceError } = await bucket.download(reference.path);
      if (!source || sourceError) throw new Error("Original download failed");
      const { data: signed, error: signError } = await bucket.createSignedUrl(reference.path, 120, {
        transform: { width: reference.width, quality: 80, resize: "contain" },
      });
      if (!signed || signError) throw new Error("Preview signing failed");
      const response = await fetch(signed.signedUrl, { headers: { Accept: "image/webp,image/*" } });
      if (!response.ok) throw new Error("Preview generation failed");
      const preview = await response.blob();
      if (!preview.type.startsWith("image/") || preview.size >= source.size * 0.75) { skipped++; continue; }
      const slash = reference.path.lastIndexOf("/");
      const directory = slash < 0 ? "" : reference.path.slice(0, slash + 1);
      const name = reference.path.slice(slash + 1);
      const backupPath = `${directory}originals/${name}`;
      // Never replace an existing original on later runs.
      let { data: backup } = await bucket.download(backupPath);
      if (!backup) {
        const { error } = await bucket.copy(reference.path, backupPath);
        if (error) throw new Error("Original backup failed");
        backup = (await bucket.download(backupPath)).data;
      }
      if (!backup || await digest(backup) !== await digest(source)) { skipped++; continue; }
      const { error: updateError } = await bucket.update(reference.path, preview, { contentType: preview.type, cacheControl: "3600" });
      if (updateError) throw new Error("Display photo update failed");
      const { data: saved } = await bucket.download(reference.path);
      if (!saved || await digest(saved) !== await digest(preview)) throw new Error("Display photo verification failed");
      optimized++;
      beforeBytes += source.size;
      afterBytes += preview.size;
    } catch {
      failed++;
    }
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
console.log(JSON.stringify({ optimized, skipped, failed, beforeBytes, afterBytes, originalsVerified: optimized }));
if (failed) process.exitCode = 1;