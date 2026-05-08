export function resolveRouterBasename(base: string | undefined): string | undefined {
  const trimmed = (base || '').trim()

  if (!trimmed || trimmed === '/') {
    return undefined
  }

  const withoutEdgeSlashes = trimmed.replace(/^\/+|\/+$/g, '')

  return withoutEdgeSlashes ? `/${withoutEdgeSlashes}` : undefined
}
