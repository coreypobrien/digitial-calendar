import "@testing-library/jest-dom";
import { configure } from "@testing-library/react";
import { vi } from "vitest";

configure({
  getElementError: (message) => {
    return new Error(message);
  },
});

// Mock Canvas API for Confetti component
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  clearRect: vi.fn(),
  beginPath: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  fillRect: vi.fn(),
  fillStyle: "",
}));

class MockResizeObserver {
  observe() {}
  disconnect() {}
  unobserve() {}
}

globalThis.ResizeObserver = MockResizeObserver;
