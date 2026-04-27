export type CursorPage<T> = {
  next: string | null
  previous: string | null
  results: T[]
}
