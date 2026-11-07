export function getTextSizeClass(textLength: number): string {
  if (textLength <= 50) return 'text-3xl'
  if (textLength <= 150) return 'text-2xl'
  if (textLength <= 300) return 'text-xl'
  return 'text-lg'
}
