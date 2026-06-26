import { createClient } from "@/lib/supabase/server";
import { getFromR2 } from "@/lib/r2";
import { type NextRequest } from "next/server";

export type DiffLine =
  | { type: "equal"; content: string }
  | { type: "added"; content: string }
  | { type: "removed"; content: string };

function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");

  // Myers diff algorithm (simplified LCS-based)
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0)
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const result: DiffLine[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.push({ type: "equal", content: oldLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({ type: "added", content: newLines[j - 1] });
      j--;
    } else {
      result.push({ type: "removed", content: oldLines[i - 1] });
      i--;
    }
  }

  return result.reverse();
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ trackId: string }> }
) {
  const { trackId } = await params;
  const { searchParams } = new URL(request.url);
  const fromId = searchParams.get("from");
  const toId = searchParams.get("to");

  if (!fromId || !toId) {
    return Response.json(
      { error: "from과 to 파라미터가 필요합니다." },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const { data: revisions } = await supabase
    .from("subtitle_revisions")
    .select("id, revision_number, storage_path, format")
    .eq("track_id", trackId)
    .in("id", [fromId, toId]);

  if (!revisions || revisions.length !== 2) {
    return Response.json(
      { error: "리비전을 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  const fromRev = revisions.find((r) => r.id === fromId)!;
  const toRev = revisions.find((r) => r.id === toId)!;

  let fromContent: string;
  let toContent: string;

  try {
    [fromContent, toContent] = await Promise.all([
      getFromR2(fromRev.storage_path),
      getFromR2(toRev.storage_path),
    ]);
  } catch {
    return Response.json({ error: "파일을 불러올 수 없습니다." }, { status: 500 });
  }

  const diff = computeDiff(fromContent, toContent);

  return Response.json({
    from: { id: fromRev.id, revision_number: fromRev.revision_number, format: fromRev.format },
    to: { id: toRev.id, revision_number: toRev.revision_number, format: toRev.format },
    diff,
  });
}
