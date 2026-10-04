import { useCallback, useEffect, useState } from "react";

/**
 * Shows a long list a page at a time. Putting hundreds of product tiles or table rows on the screen at
 * once costs Safari (and any slower device) thousands of elements to build, style and lay out on every
 * keystroke; this renders the first page and adds the next as the person scrolls near the end.
 *
 * `resetKey` is anything that changes the list (a search, a filter): the list starts again from the top.
 * Attach `sentinelRef` to the "Show more" button after the list: it loads the next page when scrolled
 * into view, and works as a plain button for anyone who prefers to click.
 */
export function useProgressiveList<T>(items: readonly T[], pageSize: number, resetKey: unknown) {
  const [state, setState] = useState({ key: resetKey, count: pageSize });
  const count = Object.is(state.key, resetKey) ? state.count : pageSize;
  const [sentinel, setSentinel] = useState<HTMLElement | null>(null);

  const showMore = useCallback(() => setState({ key: resetKey, count: count + pageSize }), [resetKey, count, pageSize]);

  useEffect(() => {
    if (!sentinel || count >= items.length || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) showMore();
    }, { rootMargin: "800px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinel, count, items.length, showMore]);

  return {
    visible: count >= items.length ? items : items.slice(0, count),
    remaining: Math.max(0, items.length - count),
    sentinelRef: setSentinel,
    showMore,
  };
}
