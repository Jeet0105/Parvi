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

/**
 * React Flow measures its container through browser APIs jsdom lacks.
 *
 * These stubs let the canvas mount so the surrounding page can be tested.
 * They report zero-size geometry, so nothing here asserts real positioning --
 * layout maths is covered directly in treeLayout.test.js instead.
 */
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (typeof globalThis.DOMMatrixReadOnly === 'undefined') {
  globalThis.DOMMatrixReadOnly = class DOMMatrixReadOnly {
    constructor(transform) {
      const [a = 1, b = 0, c = 0, d = 1, e = 0, f = 0] =
        typeof transform === 'string'
          ? (transform.match(/-?\d*\.?\d+/g) || []).map(Number)
          : [];
      Object.assign(this, { m22: d, a, b, c, d, e, f });
    }
  };
}

if (typeof globalThis.matchMedia === 'undefined') {
  globalThis.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  });
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});
