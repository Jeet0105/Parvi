import { useEffect, useRef } from 'react';

/**
 * Dialog built on <dialog>, so the browser supplies focus trapping, Escape
 * handling and inertness of the page behind it rather than reimplementing them.
 */
export default function Modal({ open, onClose, title, children }) {
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    // Fires for Escape as well as an explicit close().
    const handleClose = () => onClose?.();
    node.addEventListener('close', handleClose);
    return () => node.removeEventListener('close', handleClose);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      className="w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-slate-200 p-0 backdrop:bg-slate-900/40"
      onCancel={(event) => {
        event.preventDefault();
        onClose?.();
      }}
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <svg viewBox="0 0 20 20" className="size-4" fill="currentColor" aria-hidden="true">
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        </button>
      </div>

      <div className="px-5 py-4">{open ? children : null}</div>
    </dialog>
  );
}
