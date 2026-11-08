import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";

const ASPECT = 16 / 9;

/** Drag-to-reposition + zoom cropper. Returns a JPEG File at 16:9. */
export function ImageCropDialog({ file, onCancel, onDone }: { file: File | null; onCancel: () => void; onDone: (f: File) => void }) {
  const [src, setSrc] = useState<string | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setSrc(url); setZoom(1); setPos({ x: 0, y: 0 });
    const i = new Image(); i.onload = () => setImg(i); i.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Base scale so image covers the frame
  function geom() {
    const w = boxRef.current?.clientWidth ?? 0, h = w / ASPECT;
    if (!img || !w) return null;
    const base = Math.max(w / img.width, h / img.height);
    const s = base * zoom;
    return { w, h, s, iw: img.width * s, ih: img.height * s };
  }
  function clamp(p: { x: number; y: number }) {
    const g = geom(); if (!g) return p;
    const mx = (g.iw - g.w) / 2, my = (g.ih - g.h) / 2;
    return { x: Math.min(mx, Math.max(-mx, p.x)), y: Math.min(my, Math.max(-my, p.y)) };
  }
  useEffect(() => { setPos((p) => clamp(p)); }, [zoom, img]); // eslint-disable-line react-hooks/exhaustive-deps

  function save() {
    const g = geom(); if (!g || !img || !file) return;
    const outW = Math.min(1920, Math.round(g.w / g.s));
    const scale = outW / g.w;
    const c = document.createElement("canvas");
    c.width = outW; c.height = Math.round(outW / ASPECT);
    const ctx = c.getContext("2d")!;
    const left = (g.w - g.iw) / 2 + pos.x, top = (g.h - g.ih) / 2 + pos.y;
    ctx.drawImage(img, left * scale, top * scale, g.iw * scale, g.ih * scale);
    c.toBlob((b) => {
      if (!b) return;
      onDone(new File([b], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }));
    }, "image/jpeg", 0.9);
  }

  const g = geom();
  return (
    <Dialog open={!!file} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle className="font-serif text-2xl">Position your photo</DialogTitle></DialogHeader>
        <div
          ref={boxRef}
          className="relative aspect-[16/9] w-full cursor-grab touch-none select-none overflow-hidden rounded-2xl bg-accent/60 active:cursor-grabbing"
          onPointerDown={(e) => { (e.target as Element).setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y }; }}
          onPointerMove={(e) => { const d = drag.current; if (d) setPos(clamp({ x: d.px + e.clientX - d.x, y: d.py + e.clientY - d.y })); }}
          onPointerUp={() => { drag.current = null; }}
        >
          {src && g && (
            <img src={src} alt="" draggable={false} className="pointer-events-none absolute max-w-none"
              style={{ width: g.iw, height: g.ih, left: (g.w - g.iw) / 2 + pos.x, top: (g.h - g.ih) / 2 + pos.y }} />
          )}
        </div>
        <p className="text-sm text-muted-foreground">Drag to reposition. Use the slider to zoom.</p>
        <Slider min={1} max={3} step={0.01} value={[zoom]} onValueChange={(v) => setZoom(v[0] ?? 1)} aria-label="Zoom" />
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" className="rounded-full" onClick={onCancel}>Cancel</Button>
          <Button type="button" className="rounded-full" onClick={save} disabled={!img}>Save photo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
