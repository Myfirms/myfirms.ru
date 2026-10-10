/** Enforced breakpoint scale (mirrors spacing.css). Media queries hardcode
 * the same literals; JS/React must import from here, never restate numbers. */
export const breakpoints = {
  mobile: 640,
  tablet: 768,
  nav: 1024,
  desktop: 1200,
} as const;

export type Breakpoint = keyof typeof breakpoints;

export const mediaQuery = (bp: Breakpoint) => `(min-width: ${breakpoints[bp]}px)`;
