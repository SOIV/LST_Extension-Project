import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const cookieValue = request.cookies.get("yt_oauth_state")?.value ?? "";
  const [storedState, locale = "en"] = cookieValue.split(":");

  const origin = request.nextUrl.origin;

  function redirect(path: string) {
    const response = NextResponse.redirect(`${origin}/${locale}${path}`);
    response.cookies.delete("yt_oauth_state");
    return response;
  }

  if (!code || !state || state !== storedState) {
    return redirect("/dashboard?error=oauth_failed");
  }

  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return redirect("/dashboard?error=oauth_failed");
  }

  const redirectUri = `${origin}/api/creator/oauth/callback`;

  // Exchange authorization code for access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    return redirect("/dashboard?error=oauth_failed");
  }

  const { access_token } = (await tokenRes.json()) as { access_token?: string };
  if (!access_token) {
    return redirect("/dashboard?error=oauth_failed");
  }

  // Fetch the authenticated user's YouTube channel
  const channelRes = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
    { headers: { Authorization: `Bearer ${access_token}` } }
  );

  if (!channelRes.ok) {
    return redirect("/dashboard?error=oauth_failed");
  }

  const channelData = await channelRes.json();
  const channel = channelData.items?.[0];
  if (!channel) {
    return redirect("/dashboard?error=oauth_failed");
  }

  const youtubeChannelId: string = channel.id;
  // customUrl is the @handle — strip @ and non-ASCII chars for use as LST handle
  const rawHandle: string = (channel.snippet?.customUrl ?? "").replace(/^@/, "");
  const candidateHandle = rawHandle.replace(/[^a-zA-Z0-9_]/g, "");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return redirect("/login");
  }

  // Insert channel connection — check for existing ownership conflict
  const { error: insertError } = await supabase
    .from("connected_creators")
    .insert({ youtube_channel_id: youtubeChannelId, user_id: user.id });

  if (insertError) {
    if (insertError.code === "23505") {
      // Unique violation — check if it's already this user's channel
      const { data: existing } = await supabase
        .from("connected_creators")
        .select("user_id")
        .eq("youtube_channel_id", youtubeChannelId)
        .single();

      if (existing && existing.user_id !== user.id) {
        return redirect("/dashboard?error=channel_taken");
      }
      // Already connected by this user — treat as success and fall through
    } else {
      return redirect("/dashboard?error=oauth_failed");
    }
  }

  // Auto-import handle from YouTube if user doesn't have one yet
  if (candidateHandle.length >= 3) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("handle")
      .eq("id", user.id)
      .single();

    if (!profile?.handle) {
      // Silently ignore if handle is taken by another user
      await supabase
        .from("profiles")
        .update({ handle: candidateHandle })
        .eq("id", user.id);
    }
  }

  return redirect("/dashboard?connected=1");
}
