import { describe, expect, it } from 'vitest';
import { eventMeetingLink, youtubeVideoId } from './event-video';

describe('public event YouTube videos', () => {
  it.each(['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://youtu.be/dQw4w9WgXcQ?t=15', 'https://youtube.com/shorts/dQw4w9WgXcQ', 'https://youtube.com/live/dQw4w9WgXcQ', 'https://youtube-nocookie.com/embed/dQw4w9WgXcQ'])('accepts %s', (url) => {
    expect(youtubeVideoId(url)).toBe('dQw4w9WgXcQ');
  });
  it.each(['https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ', 'javascript:alert(1)', 'https://youtube.com/watch?v=bad', 'https://zoom.us/j/123'])('rejects unsafe or non-video URL %s', (url) => {
    expect(youtubeVideoId(url)).toBeNull();
  });
  it('does not treat a public teaser as a meeting', () => {
    expect(eventMeetingLink({ video_link: 'https://youtu.be/dQw4w9WgXcQ' })).toBeNull();
  });
  it('preserves private meetings and legacy non-YouTube links', () => {
    expect(eventMeetingLink({ meeting_link: 'https://meet.google.com/abc', video_link: 'https://youtu.be/dQw4w9WgXcQ' })).toBe('https://meet.google.com/abc');
    expect(eventMeetingLink({ video_link: 'https://zoom.us/j/123' })).toBe('https://zoom.us/j/123');
  });
});