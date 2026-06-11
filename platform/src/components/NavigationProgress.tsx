"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Phase = "idle" | "loading" | "done";

export default function NavigationProgress() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>("idle");
  const navigatingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (navigatingRef.current) {
      navigatingRef.current = false;
      clearTimeout(timerRef.current);
      setPhase("done");
      timerRef.current = setTimeout(() => setPhase("idle"), 500);
    }
  }, [pathname]);

  useEffect(() => {
    function onLinkClick(e: MouseEvent) {
      const anchor = (e.target as Element).closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href") ?? "";
      if (
        !href ||
        href.startsWith("http") ||
        href.startsWith("//") ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:")
      )
        return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      // 동일 경로에서 검색 파라미터만 바뀌는 경우 (탭 전환 등) 무시
      try {
        const target = new URL(href, window.location.origin);
        if (target.pathname === window.location.pathname) return;
      } catch {
        return;
      }

      clearTimeout(timerRef.current);
      navigatingRef.current = true;
      setPhase("loading");
    }

    document.addEventListener("click", onLinkClick, true);
    return () => document.removeEventListener("click", onLinkClick, true);
  }, []);

  if (phase === "idle") return null;

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 z-[9999] h-[2px] pointer-events-none"
    >
      <div
        className={`h-full ${
          phase === "loading"
            ? "nav-progress-indeterminate"
            : "nav-progress-done"
        }`}
      />
    </div>
  );
}
