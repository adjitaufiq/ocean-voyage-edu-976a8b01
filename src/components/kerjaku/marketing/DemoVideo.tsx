/** Optional demo video block. Renders nothing when no video is provided. */
export function DemoVideo({
  video,
}: {
  video?: { src: string; poster?: string; caption: string };
}) {
  if (!video) return null;
  return (
    <figure className="mt-10">
      <video
        className="w-full rounded-[1.75rem] glass-panel"
        src={video.src}
        poster={video.poster}
        controls
        muted
        playsInline
        preload="none"
        aria-label={video.caption}
      />
      <figcaption className="mt-3 text-xs text-muted-foreground">{video.caption}</figcaption>
    </figure>
  );
}
