import { createClient } from "@/lib/supabase/server";
import { routing } from "@/i18n/routing";
import { NextRequest, NextResponse } from "next/server";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const YOUTUBE_SCOPE = "https://www.googleapis.com/auth/youtube.force-ssl";

function detectLocale(request: NextRequest): string {
  const param = request.nextUrl.searchParams.get("locale");
  if (param && (routing.locales as readonly string[]).includes(param)) return param;
  const accept = request.headers.get("accept-language") ?? "";
  for (const part of accept.split(",")) {
    const lang = part.split(";")[0].trim().slice(0, 2).toLowerCase();
    if ((routing.locales as readonly string[]).includes(lang)) return lang;
  }
  return routing.defaultLocale;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const clientId = process.env.YOUTUBE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "YouTube OAuth is not configured on this server." },
      { status: 503 }
    );
  }

  const locale = detectLocale(request);
  const state = crypto.randomUUID();
  const origin = request.nextUrl.origin;
  const redirectUri = `${origin}/api/creator/oauth/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: YOUTUBE_SCOPE,
    access_type: "offline",
    include_granted_scopes: "true",
    state,
    // Force consent so refresh_token issuance is reliable across reconnects.
    prompt: "consent select_account",
  });

  const response = NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params}`);
  // Pack state + locale into one cookie so callback can redirect to the right locale
  response.cookies.set("yt_oauth_state", `${state}:${locale}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    sameSite: "lax",
    path: "/",
  });

  return response;
}
