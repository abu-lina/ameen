export function anonymizeDua<T extends { author_id?: string }>(dua: T): Omit<T, 'author_id'> {
  const { author_id, ...rest } = dua
  return rest
}
