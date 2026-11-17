/** Only recognized YouTube hosts and video IDs can become embed URLs. */
export function youtubeVideoId(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    if (!['https:', 'http:'].includes(url.protocol)) return null;
    const host = url.hostname.toLowerCase().replace(/^(www\.|m\.|music\.)/, '');
    const parts = url.pathname.split('/').filter(Boolean);
    let id: string | null | undefined;
    if (host === 'youtu.be') id = parts[0];
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      id = parts[0] === 'watch' ? url.searchParams.get('v') : ['embed', 'shorts', 'live'].includes(parts[0] ?? '') ? parts[1] : null;
    }
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch { return null; }
}

/** Legacy private non-YouTube links still work; teasers never join a call. */
export function eventMeetingLink(location: { meeting_link?: string | null; video_link?: string | null } | null | undefined): string | null {
  return location?.meeting_link || (location?.video_link && !youtubeVideoId(location.video_link) ? location.video_link : null);
}