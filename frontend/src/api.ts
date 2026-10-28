const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, '') ?? ''

export function apiUrl(path: string): string {
  const normalizedPath = `/${path.replace(/^\/+/, '')}`
  if (!configuredBaseUrl) return normalizedPath

  if (configuredBaseUrl.endsWith('/api') && normalizedPath.startsWith('/api/')) {
    return `${configuredBaseUrl}${normalizedPath.slice('/api'.length)}`
  }

  return `${configuredBaseUrl}${normalizedPath}`
}
