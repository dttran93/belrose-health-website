import { useState, useEffect } from 'react';

/**
 * Custom hook for media queries with TypeScript support
 * @param query - CSS media query string (e.g., "(min-width: 1024px)")
 * @returns Whether the media query matches
 */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(false);

  useEffect(() => {
    // Create the media query list
    const media: MediaQueryList = window.matchMedia(query);
    
    // Update state if current match status is different
    if (media.matches !== matches) {
      setMatches(media.matches);
    }

    // Create listener function with proper typing
    const listener = (event: MediaQueryListEvent): void => {
      setMatches(event.matches);
    };

    // Add event listener
    media.addEventListener('change', listener);

    // Cleanup function to remove listener
    return (): void => {
      media.removeEventListener('change', listener);
    };
  }, [matches, query]);

  return matches;
}

export default useMediaQuery;

// ============================================================================
// ADDITIONAL TYPE-SAFE UTILITIES
// ============================================================================

/**
 * Common breakpoints as typed constants
 * These match your Tailwind CSS breakpoints
 */
export const BREAKPOINTS = {
  // Mobile first approach
  SM: '(min-width: 640px)',   // Small devices
  MD: '(min-width: 768px)',   // Medium devices  
  LG: '(min-width: 1024px)',  // Large devices
  XL: '(min-width: 1280px)',  // Extra large devices
  '2XL': '(min-width: 1536px)', // 2X large devices
  
  // Max-width queries (desktop first)
  MAX_SM: '(max-width: 639px)',
  MAX_MD: '(max-width: 767px)', 
  MAX_LG: '(max-width: 1023px)',
  MAX_XL: '(max-width: 1279px)',
  
  // Specific use cases
  MOBILE: '(max-width: 767px)',
  TABLET: '(min-width: 768px) and (max-width: 1023px)',
  DESKTOP: '(min-width: 1024px)',
  
  // Orientation
  PORTRAIT: '(orientation: portrait)',
  LANDSCAPE: '(orientation: landscape)',
  
  // Reduced motion for accessibility
  PREFERS_REDUCED_MOTION: '(prefers-reduced-motion: reduce)',
  
  // Dark mode support
  PREFERS_DARK: '(prefers-color-scheme: dark)',
  PREFERS_LIGHT: '(prefers-color-scheme: light)',
} as const;

/**
 * Type for valid breakpoint keys
 */
export type BreakpointKey = keyof typeof BREAKPOINTS;

/**
 * Type-safe hook for common breakpoints
 * @param breakpoint - A key from the BREAKPOINTS object
 * @returns Whether the breakpoint matches
 */
export function useBreakpoint(breakpoint: BreakpointKey): boolean {
  return useMediaQuery(BREAKPOINTS[breakpoint]);
}

/**
 * Hook that returns the current breakpoint name
 * Useful for conditional rendering based on screen size
 * @returns The name of the current breakpoint or 'XS' for smaller screens
 */
export function useCurrentBreakpoint(): 'XS' | 'SM' | 'MD' | 'LG' | 'XL' | '2XL' {
  const isSm = useMediaQuery(BREAKPOINTS.SM);
  const isMd = useMediaQuery(BREAKPOINTS.MD);
  const isLg = useMediaQuery(BREAKPOINTS.LG);
  const isXl = useMediaQuery(BREAKPOINTS.XL);
  const is2Xl = useMediaQuery(BREAKPOINTS['2XL']);

  if (is2Xl) return '2XL';
  if (isXl) return 'XL';
  if (isLg) return 'LG';
  if (isMd) return 'MD';
  if (isSm) return 'SM';
  return 'XS';
}

/**
 * Convenience hooks for common use cases
 */
export const useIsMobile = (): boolean => useMediaQuery(BREAKPOINTS.MOBILE);
export const useIsTablet = (): boolean => useMediaQuery(BREAKPOINTS.TABLET);
export const useIsDesktop = (): boolean => useMediaQuery(BREAKPOINTS.DESKTOP);

/**
 * Accessibility-focused hooks
 */
export const usePrefersReducedMotion = (): boolean => 
  useMediaQuery(BREAKPOINTS.PREFERS_REDUCED_MOTION);

export const usePrefersDark = (): boolean => 
  useMediaQuery(BREAKPOINTS.PREFERS_DARK);

/**
 * Hook for custom min-width queries with TypeScript safety
 * @param minWidth - Minimum width in pixels
 * @returns Whether the screen is wider than the specified width
 */
export function useMinWidth(minWidth: number): boolean {
  return useMediaQuery(`(min-width: ${minWidth}px)`);
}

/**
 * Hook for custom max-width queries with TypeScript safety
 * @param maxWidth - Maximum width in pixels  
 * @returns Whether the screen is narrower than the specified width
 */
export function useMaxWidth(maxWidth: number): boolean {
  return useMediaQuery(`(max-width: ${maxWidth}px)`);
}

/**
 * Hook for width range queries
 * @param minWidth - Minimum width in pixels
 * @param maxWidth - Maximum width in pixels
 * @returns Whether the screen width is within the specified range
 */
export function useWidthRange(minWidth: number, maxWidth: number): boolean {
  return useMediaQuery(`(min-width: ${minWidth}px) and (max-width: ${maxWidth}px)`);
}