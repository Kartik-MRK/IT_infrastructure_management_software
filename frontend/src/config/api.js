// Centralized API configuration for ITIMS Frontend
// In dev: defaults to '/api' (proxied by Vite to http://localhost:5000) or VITE_API_URL
// In production: defaults to '/api' (proxied by Nginx to the backend container)
export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Intercept legacy hardcoded http://localhost:5000/api calls to prevent HTTPS mixed-content errors in production
if (typeof window !== 'undefined' && window.fetch) {
  const originalFetch = window.fetch;
  window.fetch = function (input, init) {
    if (typeof input === 'string' && input.includes('localhost:5000/api')) {
      input = input.replace(/http:\/\/localhost:5000\/api/g, API_BASE_URL);
    } else if (input instanceof Request && input.url && input.url.includes('localhost:5000/api')) {
      const newUrl = input.url.replace(/http:\/\/localhost:5000\/api/g, API_BASE_URL);
      input = new Request(newUrl, input);
    }
    return originalFetch.call(this, input, init);
  };
}
