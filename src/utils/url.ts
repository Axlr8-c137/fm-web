/**
 * Dynamically rewrites local/development IPs in URLs to match the current backend server host IP.
 * This ensures that media uploaded from different devices/IPs loads correctly on the current client.
 */
export const normalizeUrl = (url: string | undefined | null): string => {
  if (!url) return '';
  try {
    const parsedUrl = new URL(url);
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
    
    // Extract hostname from VITE_API_BASE_URL or default to window.location.hostname
    let currentHost = '';
    if (apiBaseUrl.startsWith('http')) {
      currentHost = new URL(apiBaseUrl).hostname;
    } else {
      currentHost = window.location.hostname;
    }
    
    // If the URL host is localhost, 127.0.0.1, or a local network IP starting with 10., 192., or 172.
    const isLocal = 
      parsedUrl.hostname === 'localhost' || 
      parsedUrl.hostname === '127.0.0.1' || 
      parsedUrl.hostname.startsWith('192.168.') || 
      parsedUrl.hostname.startsWith('10.') || 
      /^172\.(1[6-9]|2\d|3[01])\./.test(parsedUrl.hostname);
      
    if (isLocal && currentHost) {
      parsedUrl.hostname = currentHost;
      return parsedUrl.toString();
    }
  } catch (e) {
    // Return original url if parsing fails
  }
  return url || '';
};
