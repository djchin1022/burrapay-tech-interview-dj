// Test setup file for Vitest
import { vi } from 'vitest';

// Mock the Node.js diagnostics_channel module to fix Fastify v5 compatibility
// This prevents the "diagnostics.tracingChannel is not a function" error
vi.mock('node:diagnostics_channel', () => ({
  default: {
    tracingChannel: vi.fn(() => ({
      start: vi.fn(),
      end: vi.fn(),
      asyncStart: vi.fn(),
      asyncEnd: vi.fn(),
      error: vi.fn(),
      hasSubscribers: false,
    })),
  },
  tracingChannel: vi.fn(() => ({
    start: vi.fn(),
    end: vi.fn(),
    asyncStart: vi.fn(),
    asyncEnd: vi.fn(),
    error: vi.fn(),
    hasSubscribers: false,
  })),
}));

// Set test environment variables
process.env.NODE_ENV = 'test';
