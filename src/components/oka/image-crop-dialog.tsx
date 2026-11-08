import { useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

type Props = { file: File | null; aspect?: number; onCancel: () => void; onDone: (file: File) => void };

async function cropToFile(src: string, area: Area, name: string): Promise<File> {
  const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const scale = Math.min(1, 1920 / area.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(area.width * scale);
  canvas.height = Math.round(area.height * scale);
  canvas.getContext("2d")!.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("crop failed"))), "image/jpeg", 0.9));
  return new File([blob], name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
}

export function ImageCropDialog({ file, aspect = 16 / 9, onCancel, onDone }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!file) return setSrc(null);
    const url = URL.createObjectURL(file);
    setSrc(url); setCrop({ x: 0, y: 0 }); setZoom(1);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  async function apply() {
    if (!src || !area || !file) return;
    setBusy(true);
    try { onDone(await cropToFile(src, area, file.name)); } finally { setBusy(false); }
  }
  return (
    <Dialog open={!!file} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-2xl rounded-2xl">
        <DialogHeader><DialogTitle className="font-display text-2xl">Crop your photo</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Drag to move the photo, scroll or use the slider to zoom.</p>
        <div className="relative h-72 w-full overflow-hidden rounded-2xl bg-muted sm:h-96">
          {src && <Cropper image={src} crop={crop} zoom={zoom} aspect={aspect} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={(_, px) => setArea(px)} />}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Zoom</span>
          <Slider min={1} max={3} step={0.01} value={[zoom]} onValueChange={(v) => setZoom(v[0]!)} />
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" className="rounded-full" onClick={onCancel}>Cancel</Button>
          <Button type="button" className="rounded-full" disabled={busy || !area} onClick={apply}>Apply crop</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
