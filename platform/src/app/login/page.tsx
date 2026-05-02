"use client";

import { createClient } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  function sanitizeNextPath(next: string | null): string | null {
    if (!next) return null;
    if (!next.startsWith("/") || next.startsWith("//")) return null;
    return next;
  }

  async function handleGoogleLogin() {
    const supabase = createClient();
    const callbackUrl = new URL("/auth/callback", location.origin);
    const next = sanitizeNextPath(searchParams.get("next"));
    if (next) {
      callbackUrl.searchParams.set("next", next);
    }

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl.toString(),
      },
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-8 flex flex-col gap-6">
        {/* 로고 */}
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            LST
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Live Stream Translator
          </p>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-center">
            로그인 중 오류가 발생했습니다. 다시 시도해 주세요.
          </div>
        )}

        {/* Google 로그인 버튼 */}
        <button
          onClick={handleGoogleLogin}
          className="flex items-center justify-center gap-3 w-full px-4 py-3 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
            <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Google로 계속하기
        </button>

        <p className="text-xs text-center text-zinc-400 dark:text-zinc-500">
          계속하면{" "}
          <Link href="/terms" className="underline underline-offset-2 hover:text-zinc-600">
            이용약관
          </Link>
          {" "}및{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-zinc-600">
            개인정보처리방침
          </Link>
          에 동의하는 것으로 간주됩니다.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
