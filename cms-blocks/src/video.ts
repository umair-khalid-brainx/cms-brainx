/**
 * Video URL parsing for the `videoEmbed` block (DECISIONS.md D-033).
 *
 * The block never renders a stored URL. It renders from `provider` +
 * `videoId`, and only after `videoEmbedSrc` has checked the ID's format, so a
 * tampered `blocks` row can't point the iframe anywhere but the two players
 * below. `api` only checks that a block has a `type`, which is why that check
 * lives here, at render, rather than being trusted from write.
 */

export type VideoProvider = 'youtube' | 'vimeo';

export type ParsedVideo = { provider: VideoProvider; videoId: string };

const ID_FORMAT: Record<VideoProvider, RegExp> = {
  youtube: /^[A-Za-z0-9_-]{11}$/,
  vimeo: /^\d{1,12}$/,
};

const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com']);
const VIMEO_HOSTS = new Set(['vimeo.com', 'www.vimeo.com', 'player.vimeo.com']);

/** YouTube paths that carry the ID as their second segment: /embed/ID, /shorts/ID, /live/ID. */
const YOUTUBE_ID_PATHS = new Set(['embed', 'shorts', 'live']);

function toUrl(input: string): URL | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    // People paste `youtu.be/abc` without a scheme; give it one.
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null;
  } catch {
    return null;
  }
}

function checked(provider: VideoProvider, videoId: string | null | undefined): ParsedVideo | null {
  return videoId && ID_FORMAT[provider].test(videoId) ? { provider, videoId } : null;
}

/** Returns the provider and ID for a supported YouTube or Vimeo link, else null. */
export function parseVideoUrl(input: string | undefined): ParsedVideo | null {
  const url = input ? toUrl(input) : null;
  if (!url) return null;

  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split('/').filter(Boolean);

  if (host === 'youtu.be') return checked('youtube', segments[0]);
  if (YOUTUBE_HOSTS.has(host)) {
    if (segments[0] === 'watch') return checked('youtube', url.searchParams.get('v'));
    if (YOUTUBE_ID_PATHS.has(segments[0])) return checked('youtube', segments[1]);
    return null;
  }

  if (host === 'player.vimeo.com') return segments[0] === 'video' ? checked('vimeo', segments[1]) : null;
  if (VIMEO_HOSTS.has(host)) return checked('vimeo', segments[0]);

  return null;
}

/** The iframe `src` for a stored video, or null when the stored values aren't a valid video. */
export function videoEmbedSrc(provider: string | undefined, videoId: string | undefined): string | null {
  if (provider !== 'youtube' && provider !== 'vimeo') return null;
  const video = checked(provider, videoId);
  if (!video) return null;
  return video.provider === 'youtube'
    ? `https://www.youtube-nocookie.com/embed/${video.videoId}`
    : `https://player.vimeo.com/video/${video.videoId}`;
}
