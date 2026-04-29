import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean
}

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetriableRequestConfig | undefined
    const requestUrl = originalRequest?.url ?? ''

    const canRefresh =
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !requestUrl.includes('/auth/login/') &&
      !requestUrl.includes('/auth/refresh/')

    if (!canRefresh) {
      return Promise.reject(error)
    }

    originalRequest._retry = true

    try {
      await http.post('/auth/refresh/', {})
      return http(originalRequest)
    } catch (refreshError) {
      return Promise.reject(refreshError)
    }
  },
)
