export function swipeAction(x: number, y: number, threshold = 80) {
  if (Math.max(Math.abs(x), -y) < threshold) return null
  if (-y > Math.abs(x)) return 'save'
  return x > 0 ? 'resonate' : 'pass'
}
