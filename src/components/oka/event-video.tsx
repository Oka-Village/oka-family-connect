import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { youtubeVideoId } from '@/lib/event-video';

export function EventVideo({ url }: { url: string | null | undefined }) {
  const id = youtubeVideoId(url);
  if (!id) return null;
  return (
    <section aria-label="Event video" className="mt-10 min-w-0">
      <p className="section-label">Video</p>
      <iframe
        title="Event YouTube video"
        src={`https://www.youtube-nocookie.com/embed/${id}`}
        className="mt-3 aspect-video w-full rounded-2xl border-0 bg-secondary"
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
      <Button asChild variant="link" className="mt-2 h-auto px-0">
        <a href={`https://www.youtube.com/watch?v=${id}`} target="_blank" rel="noopener noreferrer">
          Watch on YouTube <ExternalLink className="size-4" strokeWidth={1.5} />
        </a>
      </Button>
    </section>
  );
}