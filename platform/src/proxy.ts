import createIntlMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/auth/callback",
  "/api/subtitles",
  "/search",
  "/channel",
  "/subtitles",
  "/privacy",
  "/terms",
];

function pathnameWithoutLocale(pathname: string): string {
  const locale = routing.locales.find(
    (l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`
  );
  if (!locale) return pathname;
  return pathname.slice(locale.length + 1) || "/";
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Run i18n middleware first
  const i18nResponse = intlMiddleware(request);

  // If i18n produced a redirect (locale detection), return it immediately
  if (i18nResponse.headers.get("location")) {
    return i18nResponse;
  }

  // i18nResponse를 베이스로 사용 — locale 헤더가 서버 컴포넌트까지 전달됨
  // 새 NextResponse.next()를 만들면 intlMiddleware가 설정한 locale 정보가 사라짐
  const response = i18nResponse;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // response를 재생성하지 않고 i18nResponse에 쿠키만 추가
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const stripped = pathnameWithoutLocale(pathname);
  const locale =
    routing.locales.find((l) => pathname.startsWith(`/${l}`)) ??
    routing.defaultLocale;

  const isPublic =
    PUBLIC_PATHS.some(
      (p) => stripped === p || stripped.startsWith(p + "/")
    ) || pathname.startsWith("/api/");

  if (!user && !isPublic) {
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && stripped === "/login") {
    return NextResponse.redirect(new URL(`/${locale}`, request.url));
  }

  return response;
}

export const config = {
  matcher: [
    // auth/, api/ 경로는 locale 처리 없이 직접 통과
    "/((?!_next/static|_next/image|favicon.ico|api/|auth/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

// Next.js 16 호환: proxy 가 기본 export로도 인식되도록
export default proxy;
