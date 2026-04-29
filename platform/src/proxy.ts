import createIntlMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

const PUBLIC_PATHS = ["/", "/login", "/auth/callback", "/api/subtitles", "/search", "/channel", "/subtitles"];

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

  // Set up Supabase auth check
  let response = NextResponse.next({ request: { headers: request.headers } });

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
          response = NextResponse.next({ request });
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

  // Merge i18n headers into response
  i18nResponse.headers.forEach((value, key) => {
    if (!response.headers.has(key)) {
      response.headers.set(key, value);
    }
  });

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

// Next.js 16 호환: proxy 가 기본 export로도 인식되도록
export default proxy;
