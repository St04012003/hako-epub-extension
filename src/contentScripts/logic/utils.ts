export function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

export function isLocalUrl(url: string): boolean {
  return url.startsWith(location.origin) || url.startsWith("/")
}

/**
 * `#cors` is an extension-internal marker used by the DNR rule. It must not
 * become part of the URL stored in an EPUB, because epub-gen-memory infers an
 * image's extension and MIME type from that stored URL.
 */
export function stripCorsMarker(url: string): string {
  return url.endsWith("#cors") ? url.slice(0, -"#cors".length) : url
}

function isFetchableResourceUrl(url: string): boolean {
  return !/^(?:data|blob|javascript):/i.test(url)
}

export function getFetchUrl(url: string): string {
  const resourceUrl = stripCorsMarker(url)
  if (!isFetchableResourceUrl(resourceUrl) || isLocalUrl(resourceUrl)) return resourceUrl

  return `${resourceUrl}#cors`
}

export function getFetchCredentials(url: string): RequestCredentials {
  return isLocalUrl(stripCorsMarker(url)) ? "include" : "same-origin"
}
