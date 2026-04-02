interface Props {
  url: string;
}

function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com')) {
      return u.searchParams.get('v');
    }
    if (u.hostname === 'youtu.be') {
      return u.pathname.slice(1);
    }
  } catch {
    // ignore
  }
  return null;
}

export default function YouTubeEmbed({ url }: Props) {
  const videoId = extractVideoId(url);

  if (!videoId) {
    return (
      <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center text-gray-500">
        Invalid YouTube URL
      </div>
    );
  }

  return (
    <div className="aspect-video">
      <iframe
        className="w-full h-full rounded-lg"
        src={`https://www.youtube.com/embed/${videoId}`}
        title="YouTube video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}
