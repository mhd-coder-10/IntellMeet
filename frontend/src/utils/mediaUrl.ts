// Utility to resolve media URLs across Cloudinary, blob URLs, and local backend static uploads

export const getMediaUrl = (url?: string | null): string => {
  if (!url) return "";

  // Return external URLs, data URLs, or blob URLs directly
  if (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("blob:") ||
    url.startsWith("data:")
  ) {
    return url;
  }

  // Local backend uploads (e.g. /uploads/recordings/...)
  const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5100/api";
  const backendOrigin = apiBase.replace(/\/api\/?$/, "");
  const normalizedPath = url.startsWith("/") ? url : `/${url}`;

  return `${backendOrigin}${normalizedPath}`;
};
