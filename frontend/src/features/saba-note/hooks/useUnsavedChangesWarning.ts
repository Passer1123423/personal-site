import { useEffect, useRef } from "react";

const LEAVE_MESSAGE =
  "这条推导还有未保存到后端的修改。确定离开吗？本地恢复草稿仍会保留。";

export default function useUnsavedChangesWarning(isDirty: boolean) {
  const allowNavigationRef = useRef(false);
  const restoringHistoryRef = useRef(false);

  useEffect(() => {
    if (!isDirty) {
      allowNavigationRef.current = false;
      return;
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (allowNavigationRef.current) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    }

    function handleDocumentClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      const anchor =
        target instanceof Element ? target.closest<HTMLAnchorElement>("a[href]") : null;
      if (
        !anchor ||
        anchor.download ||
        (anchor.target && anchor.target !== "_self")
      ) {
        return;
      }

      const destination = new URL(anchor.href, window.location.href);
      const current = new URL(window.location.href);
      if (
        destination.origin === current.origin &&
        destination.pathname === current.pathname &&
        destination.search === current.search
      ) {
        return;
      }

      if (!window.confirm(LEAVE_MESSAGE)) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      allowNavigationRef.current = true;
      window.setTimeout(() => {
        allowNavigationRef.current = false;
      }, 1000);
    }

    const currentHistoryIndex = window.history.state?.idx;

    function handlePopState(event: PopStateEvent) {
      if (restoringHistoryRef.current) {
        restoringHistoryRef.current = false;
        return;
      }

      if (window.confirm(LEAVE_MESSAGE)) {
        return;
      }

      event.stopImmediatePropagation();
      const nextHistoryIndex = event.state?.idx;
      const restoreDelta =
        typeof currentHistoryIndex === "number" &&
        typeof nextHistoryIndex === "number"
          ? currentHistoryIndex - nextHistoryIndex
          : 1;

      restoringHistoryRef.current = true;
      window.history.go(restoreDelta || 1);
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState, true);
    document.addEventListener("click", handleDocumentClick, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState, true);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [isDirty]);
}
