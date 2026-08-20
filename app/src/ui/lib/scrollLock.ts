import { useEffect } from "react";

// Reference-counted body scroll lock shared by every overlay (sheets, dialogs,
// the track menu). Using a counter means opening a second overlay while one is
// already open won't unlock the page when only one of them closes.
let lockCount = 0;
let savedScrollY = 0;

function lock(): void {
  lockCount += 1;
  if (lockCount > 1) return;
  savedScrollY = window.scrollY;
  // Pin the body in place so iOS Safari can't scroll the page behind the
  // overlay. The negative top preserves the visual scroll position; `overflow`
  // and `position` are applied via the .modal-open class in global.css.
  document.body.style.top = `-${savedScrollY}px`;
  document.body.classList.add("modal-open");
}

function unlock(): void {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount > 0) return;
  document.body.classList.remove("modal-open");
  document.body.style.top = "";
  window.scrollTo(0, savedScrollY);
}

/**
 * Lock page scrolling while `active` is true. Automatically releases on cleanup
 * so it is safe to call from any overlay component's render.
 */
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    lock();
    return unlock;
  }, [active]);
}
