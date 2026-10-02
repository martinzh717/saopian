/** Mixkit Free Music — files live on the public site only (not in portable zip). */
export const BGM_TRACKS = [
  { id: "serene-view", title: "Serene View", path: "/bgm/serene-view.mp3" },
  { id: "piano-reflections", title: "Piano Reflections", path: "/bgm/piano-reflections.mp3" },
  { id: "beautiful-dream", title: "Beautiful Dream", path: "/bgm/beautiful-dream.mp3" },
  { id: "relaxation-05", title: "Relaxation 05", path: "/bgm/relaxation-05.mp3" },
  { id: "sleepy-cat", title: "Sleepy Cat", path: "/bgm/sleepy-cat.mp3" },
  { id: "relaxing-country", title: "Relaxing Country", path: "/bgm/relaxing-country.mp3" },
  { id: "walking-in-the-park", title: "Walking in the Park", path: "/bgm/walking-in-the-park.mp3" },
  { id: "wind-leaves", title: "Wind Leaves", path: "/bgm/wind-leaves.mp3" },
  { id: "old-letter", title: "Old Letter", path: "/bgm/old-letter.mp3" },
] as const;

export type BgmTrack = (typeof BGM_TRACKS)[number];

/** Play directly from the published public site. */
export function bgmSrc(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `https://jishuba.cn/app/saopian${normalized}`;
}

/** Pick a random track; avoid repeating the last one when more than one exists. */
export function pickRandomBgmTrack(exceptId?: string): BgmTrack {
  const pool = exceptId
    ? BGM_TRACKS.filter((track) => track.id !== exceptId)
    : [...BGM_TRACKS];
  const choices = pool.length > 0 ? pool : BGM_TRACKS;
  return choices[Math.floor(Math.random() * choices.length)]!;
}
