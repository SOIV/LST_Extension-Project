import { createClient } from "@/lib/supabase/server";
import { routing } from "@/i18n/routing";
import { NextRequest, NextResponse } from "next/server";

function sanitizeNextPath(next: string | null): string {
  if (!next) return "/";
  if (!next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

/** Accept-Language 헤더에서 지원 locale 감지 */
function detectLocale(request: NextRequest): string {
  const accept = request.headers.get("accept-language") ?? "";
  for (const part of accept.split(",")) {
    const lang = part.split(";")[0].trim().slice(0, 2).toLowerCase();
    if ((routing.locales as readonly string[]).includes(lang)) return lang;
  }
  return routing.defaultLocale;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = sanitizeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // 핸들 미설정 시 프로필 설정 페이지로 소프트 유도
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("handle")
          .eq("id", user.id)
          .single();

        if (!profile?.handle) {
          const locale = detectLocale(request);
          return NextResponse.redirect(`${origin}/${locale}/profile?onboarding=1`);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
