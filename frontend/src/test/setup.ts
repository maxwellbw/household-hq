import 'temporal-polyfill/global'
import '@testing-library/jest-dom/vitest'

// jsdom doesn't implement matchMedia — needed by any component that reads
// viewport-based media queries (e.g. CalendarHome's mobile/desktop switch).
if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}
