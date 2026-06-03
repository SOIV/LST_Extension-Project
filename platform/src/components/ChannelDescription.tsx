"use client";

import { useState, useRef, useEffect } from "react";

export default function ChannelDescription({
  description,
  labelShowMore,
  labelClose,
}: {
  description: string;
  labelShowMore: string;
  labelClose: string;
}) {
  const [isTruncated, setIsTruncated] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const pRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = pRef.current;
    if (el) setIsTruncated(el.scrollHeight > el.clientHeight);
  }, [description]);

  return (
    <>
      <div className="text-xs text-zinc-400 dark:text-zinc-500">
        <p ref={pRef} className="line-clamp-2 whitespace-pre-line">
          {description}
        </p>
        {isTruncated && (
          <button
            onClick={() => setIsOpen(true)}
            className="mt-0.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
          >
            {labelShowMore}
          </button>
        )}
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="relative w-full max-w-lg mx-4 bg-white dark:bg-zinc-900 rounded-xl shadow-xl p-6 max-h-[70vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
              aria-label={labelClose}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-line overflow-y-auto leading-relaxed pr-2">
              {description}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
