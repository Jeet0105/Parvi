import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

/**
 * jsdom does not implement the <dialog> methods, so a component calling
 * showModal() throws in tests while working correctly in every real browser.
 *
 * This shim gives the minimum behaviour the tests rely on: toggling the `open`
 * attribute (which is what makes the dialog queryable by its ARIA role) and
 * firing a `close` event. It does not emulate focus trapping or the top layer,
 * so those remain the browser's responsibility rather than something asserted
 * here.
 */
if (typeof HTMLDialogElement !== 'undefined') {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.open = true;
    };
  }
  if (!HTMLDialogElement.prototype.show) {
    HTMLDialogElement.prototype.show = function show() {
      this.open = true;
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function close(returnValue) {
      this.open = false;
      if (returnValue !== undefined) this.returnValue = returnValue;
      this.dispatchEvent(new Event('close'));
    };
  }
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});
