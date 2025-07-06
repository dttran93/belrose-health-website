import { useState, useEffect } from 'react'

/**
 * Custom hook for media queries
 * @param {string} query - CSS media query string (e.g., "(min-width: 1024px)")
 * @returns {boolean} - Whether the media query matches
 */

function useMediaQuery(query) {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const media = window.matchMedia(query)
    if (media.matches !== matches) {
      setMatches(media.matches)
    }
    const listener = () => setMatches(media.matches)
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [matches, query])

  return matches
}

export default useMediaQuery