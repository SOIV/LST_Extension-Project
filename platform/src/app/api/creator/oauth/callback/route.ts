import { createClient } from "@/lib/supabase/server";
import {
  encryptYoutubeToken,
  isYoutubeTokenEncryptionConfigured,
} from "@/lib/youtubeTokenCrypto";
import { NextRequest, NextResponse } from "next/server";

const YOUTUBE_SCOPE = "https://www.googleapis.com/auth/youtube.force-ssl";

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  expires_in?: number;
};

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

  const {
    access_token,
    refresh_token,
    scope,
    token_type,
    expires_in,
  } = (await tokenRes.json()) as GoogleTokenResponse;
  if (!access_token) {
    return redirect("/dashboard?error=oauth_failed");
  }
  if (!scope?.split(" ").includes(YOUTUBE_SCOPE)) {
    return redirect("/dashboard?error=oauth_scope_missing");
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

  if (!isYoutubeTokenEncryptionConfigured()) {
    return redirect("/dashboard?error=oauth_config_missing");
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

  const { data: existingTokenRow, error: tokenFetchError } = await supabase
    .from("creator_youtube_tokens")
    .select("refresh_token_encrypted")
    .eq("youtube_channel_id", youtubeChannelId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (tokenFetchError) {
    return redirect("/dashboard?error=oauth_failed");
  }

  const refreshTokenEncrypted =
    refresh_token && refresh_token.length > 0
      ? encryptYoutubeToken(refresh_token)
      : existingTokenRow?.refresh_token_encrypted ?? null;

  if (!refreshTokenEncrypted) {
    // A refresh token is mandatory for long-term channel operations.
    return redirect("/dashboard?error=oauth_refresh_missing");
  }

  const expiresAt =
    typeof expires_in === "number" && Number.isFinite(expires_in)
      ? new Date(Date.now() + expires_in * 1000).toISOString()
      : null;

  const { error: tokenUpsertError } = await supabase
    .from("creator_youtube_tokens")
    .upsert(
      {
        user_id: user.id,
        youtube_channel_id: youtubeChannelId,
        access_token_encrypted: encryptYoutubeToken(access_token),
        refresh_token_encrypted: refreshTokenEncrypted,
        scope: scope ?? YOUTUBE_SCOPE,
        token_type: token_type ?? "Bearer",
        expires_at: expiresAt,
      },
      { onConflict: "youtube_channel_id" }
    );

  if (tokenUpsertError) {
    return redirect("/dashboard?error=oauth_token_store_failed");
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
