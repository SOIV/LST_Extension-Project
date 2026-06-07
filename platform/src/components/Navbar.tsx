"use client";

import { usePathname, useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type { User } from "@supabase/supabase-js";

type SearchHistoryEntry = {
  term: string;
  count: number;
  lastSearchedAt: number;
};

const SEARCH_HISTORY_KEY = "lst.searchHistory";
const MAX_SEARCH_HISTORY = 20;
const MAX_SEARCH_SUGGESTIONS = 6;

function normalizeSearchTerm(term: string) {
  return term.trim().replace(/\s+/g, " ");
}

function parseSearchHistory(raw: string | null): SearchHistoryEntry[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (entry): entry is SearchHistoryEntry =>
          typeof entry?.term === "string" &&
          typeof entry?.count === "number" &&
          typeof entry?.lastSearchedAt === "number"
      )
      .map((entry) => ({
        term: normalizeSearchTerm(entry.term),
        count: Math.max(1, entry.count),
        lastSearchedAt: entry.lastSearchedAt,
      }))
      .filter((entry) => entry.term.length > 0);
  } catch {
    return [];
  }
}

function scoreSearchSuggestion(entry: SearchHistoryEntry, value: string) {
  const term = entry.term.toLocaleLowerCase();
  const input = value.toLocaleLowerCase();
  const inputTokens = input.split(" ").filter(Boolean);
  const termTokens = term.split(" ");
  const recencyScore = entry.lastSearchedAt / 1_000_000_000_000;
  const frequencyScore = Math.min(entry.count, 8) * 2;

  if (!input) return recencyScore + frequencyScore;

  let matchScore = 0;
  if (term === input) matchScore += 80;
  if (term.startsWith(input)) matchScore += 70;
  else if (term.includes(input)) matchScore += 45;

  for (const token of inputTokens) {
    if (termTokens.some((termToken) => termToken.startsWith(token))) {
      matchScore += 12;
    } else if (term.includes(token)) {
      matchScore += 6;
    }
  }

  return matchScore + frequencyScore + recencyScore;
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("Navbar");
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<{ username: string | null } | null>(null);
  const [searchState, setSearchState] = useState({
    syncedQuery: query,
    value: query,
  });
  const [searchHistory, setSearchHistory] = useState<SearchHistoryEntry[]>(() => {
    if (typeof window === "undefined") return [];
    return parseSearchHistory(window.localStorage.getItem(SEARCH_HISTORY_KEY));
  });
  const [isSuggestOpen, setIsSuggestOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const searchValue = searchState.syncedQuery === query ? searchState.value : query;

  if (searchState.syncedQuery !== query) {
    setSearchState({
      syncedQuery: query,
      value: query,
    });
  }

  const suggestions = useMemo(() => {
    const value = normalizeSearchTerm(searchValue);
    const loweredValue = value.toLocaleLowerCase();

    return searchHistory
      .filter((entry) => {
        if (!value) return true;
        return entry.term.toLocaleLowerCase().includes(loweredValue);
      })
      .map((entry) => ({
        term: entry.term,
        score: scoreSearchSuggestion(entry, value),
      }))
      .filter((suggestion) => suggestion.score > 0)
      .sort((a, b) => b.score - a.score || a.term.localeCompare(b.term))
      .slice(0, MAX_SEARCH_SUGGESTIONS);
  }, [searchHistory, searchValue]);

  useEffect(() => {
    const supabase = createClient();

    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
      if (data.user) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", data.user.id)
          .single();
        setProfile(profileData ?? { username: null });
      }
    }

    loadUser();

    const { data: listener } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setProfile(null);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  function saveSearchTerm(term: string) {
    const normalizedTerm = normalizeSearchTerm(term);
    if (!normalizedTerm) return;

    setSearchHistory((current) => {
      const now = Date.now();
      const lowerTerm = normalizedTerm.toLocaleLowerCase();
      const previous = current.find(
        (entry) => entry.term.toLocaleLowerCase() === lowerTerm
      );
      const next = [
        {
          term: normalizedTerm,
          count: (previous?.count ?? 0) + 1,
          lastSearchedAt: now,
        },
        ...current.filter((entry) => entry.term.toLocaleLowerCase() !== lowerTerm),
      ].slice(0, MAX_SEARCH_HISTORY);

      try {
        window.localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next));
      } catch {
        // 저장소 사용이 막힌 환경에서도 검색 동작은 유지한다.
      }
      return next;
    });
  }

  function runSearch(term: string) {
    const q = normalizeSearchTerm(term);
    if (!q) return;
    saveSearchTerm(q);
    setSearchState({
      syncedQuery: query,
      value: q,
    });
    setIsSuggestOpen(false);
    setActiveSuggestionIndex(-1);
    router.push(`/search?q=${encodeURIComponent(q)}`);
    inputRef.current?.blur();
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const activeSuggestion = suggestions[activeSuggestionIndex];
    runSearch(activeSuggestion?.term ?? searchValue);
  }

  function handleSuggestionSelect(term: string) {
    runSearch(term);
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isSuggestOpen || suggestions.length === 0) {
      if (e.key === "ArrowDown" && suggestions.length > 0) {
        e.preventDefault();
        setIsSuggestOpen(true);
        setActiveSuggestionIndex(0);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveSuggestionIndex((current) => (current + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveSuggestionIndex((current) =>
        current <= 0 ? suggestions.length - 1 : current - 1
      );
    } else if (e.key === "Escape") {
      setIsSuggestOpen(false);
      setActiveSuggestionIndex(-1);
    }
  }

  const displayName = profile?.username ?? user?.email?.split("@")[0] ?? "";

  // 로그인 페이지에서는 Navbar 숨김
  if (pathname === "/login") return null;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">

        {/* 로고 */}
        <Link
          href="/"
          className="text-base font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex-shrink-0"
        >
          LST Project
        </Link>

        {/* 검색바 */}
        <form onSubmit={handleSearch} className="flex-1 min-w-0 max-w-sm">
          <div className="relative">
            <input
              ref={inputRef}
              name="q"
              type="search"
              value={searchValue}
              onChange={(e) => {
                setSearchState({
                  syncedQuery: query,
                  value: e.target.value,
                });
                setIsSuggestOpen(true);
                setActiveSuggestionIndex(-1);
              }}
              onFocus={() => setIsSuggestOpen(true)}
              onBlur={() => {
                window.setTimeout(() => {
                  setIsSuggestOpen(false);
                  setActiveSuggestionIndex(-1);
                }, 120);
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder={t("searchPlaceholder")}
              role="combobox"
              aria-expanded={isSuggestOpen && suggestions.length > 0}
              aria-controls="navbar-search-suggestions"
              aria-autocomplete="list"
              className="w-full h-8 pl-3 pr-8 rounded-lg text-sm bg-zinc-100 dark:bg-zinc-800 border border-transparent focus:border-zinc-300 dark:focus:border-zinc-600 focus:outline-none text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 transition-colors"
            />
            <button
              type="submit"
              aria-label="search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>
            {isSuggestOpen && suggestions.length > 0 && (
              <div
                id="navbar-search-suggestions"
                role="listbox"
                className="absolute left-0 right-0 top-full mt-2 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg shadow-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/30"
              >
                {suggestions.map((suggestion, index) => (
                  <button
                    key={suggestion.term}
                    type="button"
                    role="option"
                    aria-selected={index === activeSuggestionIndex}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSuggestionSelect(suggestion.term);
                    }}
                    onMouseEnter={() => setActiveSuggestionIndex(index)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                      index === activeSuggestionIndex
                        ? "bg-zinc-100 text-zinc-950 dark:bg-zinc-800 dark:text-zinc-50"
                        : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="flex-shrink-0 text-zinc-400"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span className="min-w-0 flex-1 truncate">{suggestion.term}</span>
                    <span className="flex-shrink-0 text-[11px] text-zinc-400">
                      {t("searchSuggestion")}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </form>

        {/* 네비게이션 */}
        <nav className="flex items-center gap-2.5 flex-shrink-0 ml-auto">
          <Link
            href="/upload"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            {t("upload")}
          </Link>

          {user ? (
            <div ref={userMenuRef} className="relative">
              <button
                onClick={() => setIsUserMenuOpen((v) => !v)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <span className="max-w-[7rem] truncate">
                  {t("userGreeting", { name: displayName })}
                </span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`flex-shrink-0 transition-transform duration-150 ${isUserMenuOpen ? "rotate-180" : ""}`}
                  aria-hidden="true"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 top-full mt-1 min-w-[10rem] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg shadow-zinc-900/10 dark:shadow-black/30 overflow-hidden py-1 z-50">
                  <Link
                    href="/profile"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center gap-2.5 w-full px-3.5 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-zinc-400" aria-hidden="true">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                    </svg>
                    {t("userMenuProfile")}
                  </Link>
                  <Link
                    href="/settings"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center gap-2.5 w-full px-3.5 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-zinc-400" aria-hidden="true">
                      <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                    </svg>
                    {t("userMenuSettings")}
                  </Link>
                  <Link
                    href="/dashboard"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center gap-2.5 w-full px-3.5 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-zinc-400" aria-hidden="true">
                      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                    </svg>
                    {t("userMenuDashboard")}
                  </Link>
                  <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2.5 w-full px-3.5 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-zinc-400" aria-hidden="true">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                    {t("userMenuLogout")}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors"
            >
              {t("login")}
            </Link>
          )}
        </nav>

      </div>
    </header>
  );
}
