import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// jsdom doesn't implement scrollIntoView; Schedule's auto-scroll-to-today effect calls
// it unconditionally, which would otherwise throw "not implemented" in every test.
Element.prototype.scrollIntoView = vi.fn();
