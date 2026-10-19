// Centralized axios instance with HttpOnly cookies, credentials support, and singleton refresh
// Multiple 401s share a single refresh call to avoid race conditions

import axios from "axios";
import { useAuthStore } from "@/store/authStore";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5100/api",
  headers: { "Content-Type": "application/json" },
  withCredentials: true, // Automatically sends and receives HttpOnly cookies
  timeout: 25000, // Prevent hanging requests indefinitely
});

// Attach memory access token if present as dual-compatibility fallback
api.interceptors.request.use((config) => {
  config.withCredentials = true;

  const memoryToken = useAuthStore.getState().accessToken;
  if (memoryToken) {
    config.headers.Authorization = `Bearer ${memoryToken}`;
  }

  return config;
});

// Singleton refresh promise - shared across concurrent 401s
let refreshPromise: Promise<string> | null = null;

const performRefresh = async (): Promise<string> => {
  const baseURL = import.meta.env.VITE_API_URL || "http://localhost:5100/api";
  const currentRefreshToken = useAuthStore.getState().refreshToken;

  const res = await axios.post(
    `${baseURL}/auth/refresh`,
    { refreshToken: currentRefreshToken },
    { withCredentials: true }
  );

  const newAccessToken = res.data?.data?.accessToken || "";
  const newRefreshToken = res.data?.data?.refreshToken || currentRefreshToken;

  if (newAccessToken) {
    useAuthStore.getState().setAccessToken(newAccessToken);
    const currentUser = useAuthStore.getState().user;
    if (currentUser && newRefreshToken) {
      useAuthStore.getState().setAuth(currentUser, newAccessToken, newRefreshToken);
    }
  }
  return newAccessToken;
};

const clearAuthAndRedirect = () => {
  useAuthStore.getState().clearAuth();

  // Only redirect if not already on login or register
  if (
    window.location.pathname !== "/login" &&
    window.location.pathname !== "/register"
  ) {
    window.location.href = "/login";
  }
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    const isAuthEndpoint =
      originalRequest.url?.includes("/auth/login") ||
      originalRequest.url?.includes("/auth/refresh") ||
      originalRequest.url?.includes("/auth/signup");

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isAuthEndpoint
    ) {
      originalRequest._retry = true;

      try {
        // Reuse existing refresh if in-flight
        if (!refreshPromise) {
          refreshPromise = performRefresh().finally(() => {
            refreshPromise = null;
          });
        }

        const newAccessToken = await refreshPromise;
        if (newAccessToken) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }

        return api(originalRequest);
      } catch (refreshError) {
        clearAuthAndRedirect();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;