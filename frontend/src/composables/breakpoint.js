import { ref, onMounted, onUnmounted } from 'vue'

// Reactive matchMedia helper. Defaults to false until mounted, then tracks
// the media query and updates on change (e.g. rotating the device).
export function useMediaQuery(query) {
  const matches = ref(false)
  let mql = null
  const update = () => { matches.value = mql.matches }
  onMounted(() => {
    mql = window.matchMedia(query)
    update()
    mql.addEventListener('change', update)
  })
  onUnmounted(() => { mql?.removeEventListener('change', update) })
  return matches
}

// Tailwind's `md` breakpoint is 768px, so "mobile" is anything below it.
export function useIsMobile() {
  return useMediaQuery('(max-width: 767px)')
}
