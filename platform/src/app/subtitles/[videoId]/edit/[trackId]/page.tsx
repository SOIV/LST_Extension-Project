import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import EditorClient from "./EditorClient";

function getLanguageName(languageCode: string): string {
  try {
    const displayNames = new Intl.DisplayNames(["en"], { type: "language" });
    return displayNames.of(languageCode) ?? languageCode;
  } catch {
    return languageCode;
  }
}

export default async function EditPage({
  params,
}: {
  params: Promise<{ videoId: string; trackId: string }>;
}) {
  const { videoId, trackId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: track } = await supabase
    .from("subtitle_tracks")
    .select(
      "id, language_code, subtitle_revisions(id, storage_path, format, is_current)"
    )
    .eq("id", trackId)
    .single();

  if (!track) notFound();

  const revisions = track.subtitle_revisions as {
    id: string;
    storage_path: string;
    format: string;
    is_current: boolean;
  }[];

  const currentRev = revisions?.find((r) => r.is_current);

  let initialContent = "";
  let format: "srt" | "vtt" = "srt";

  if (currentRev) {
    format = currentRev.format as "srt" | "vtt";
    const r2Url = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${currentRev.storage_path}`;
    try {
      const res = await fetch(r2Url, { cache: "no-store" });
      if (res.ok) initialContent = await res.text();
    } catch {
      /* R2 fetch failed — start with empty content */
    }
  }

  return (
    <EditorClient
      videoId={videoId}
      trackId={trackId}
      languageName={getLanguageName(track.language_code)}
      format={format}
      initialContent={initialContent}
    />
  );
}
