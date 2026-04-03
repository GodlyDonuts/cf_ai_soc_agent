import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
});

// Mock scrollTo as it's not implemented in JSDOM
HTMLElement.prototype.scrollTo = vi.fn();
