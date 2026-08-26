import "@testing-library/jest-dom/vitest";

// jsdom has no ResizeObserver. @radix-ui/react-use-size (used by Checkbox's
// indicator sizing, among others) calls it unconditionally on mount, so any
// test rendering a Radix Checkbox throws "ResizeObserver is not defined"
// without this stub.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
