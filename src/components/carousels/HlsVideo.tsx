'use client';

// Plays a Frame.io stream. Frame.io hands out HLS playlists (a list of short
// video chunks). Safari plays those natively; Chrome needs hls.js, which
// fetches the chunks and feeds them to the <video> element. Loaded lazily so
// the editor's first paint doesn't wait for it.

import { useEffect, useRef } from 'react';

type Props = {
  src: string | null;
  poster?: string | null;
  playing?: boolean;
  className?: string;
  loop?: boolean;
};

export default function HlsVideo({ src, poster, playing = true, className, loop = true }: Props) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video || !src) return;
    let destroy: (() => void) | undefined;
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
    } else {
      import('hls.js').then(({ default: Hls }) => {
        if (!Hls.isSupported()) return;
        const hls = new Hls({ maxBufferLength: 10 });
        hls.loadSource(src);
        hls.attachMedia(video);
        destroy = () => hls.destroy();
      });
    }
    return () => {
      destroy?.();
      video.removeAttribute('src');
      video.load();
    };
  }, [src]);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (playing) video.play().catch(() => {});
    else video.pause();
  }, [playing, src]);

  return (
    <video
      ref={ref}
      poster={poster ?? undefined}
      muted
      playsInline
      loop={loop}
      className={className}
    />
  );
}
