"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function isModifiedClick(event: MouseEvent): boolean {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

export function NavigationFeedback() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = useMemo(
    () => `${pathname}?${searchParams.toString()}`,
    [pathname, searchParams]
  );
  const [active, setActive] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setActive(false);
    document.documentElement.classList.remove("is-navigating");
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [routeKey]);

  useEffect(() => {
    const begin = () => {
      setActive(true);
      document.documentElement.classList.add("is-navigating");

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setActive(false);
        document.documentElement.classList.remove("is-navigating");
      }, 12_000);
    };

    const onClick = (event: MouseEvent) => {
      if (isModifiedClick(event)) return;

      const target = event.target as Element | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      if (destination.href === window.location.href) return;
      if (destination.hash && destination.pathname === window.location.pathname &&
          destination.search === window.location.search) return;

      begin();
    };

    const onSubmit = (event: SubmitEvent) => {
      const form = event.target as HTMLFormElement | null;
      if (!form) return;
      if (form.target === "_blank") return;
      begin();
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);

    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      document.documentElement.classList.remove("is-navigating");
    };
  }, []);

  return (
    <div className={active ? "navigation-feedback active" : "navigation-feedback"} aria-live="polite">
      <div className="navigation-progress" />
      <div className="navigation-pill">
        <span className="navigation-spinner" aria-hidden="true" />
        <span>Оновлюю звіт…</span>
      </div>
    </div>
  );
}
