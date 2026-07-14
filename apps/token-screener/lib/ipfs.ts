const GATEWAY = "https://ipfs.io/ipfs/";

/**
 * Resolves an ipfs:// URI (or a bare CID/path) to an HTTP gateway URL.
 * Returns null for empty/missing values so callers can render a fallback.
 */
export function resolveIpfsUri(uri: string | null | undefined): string | null {
  if (!uri) return null;
  if (uri.startsWith("http://") || uri.startsWith("https://")) return uri;
  if (uri.startsWith("ipfs://")) {
    return GATEWAY + uri.slice("ipfs://".length);
  }
  return GATEWAY + uri;
}
