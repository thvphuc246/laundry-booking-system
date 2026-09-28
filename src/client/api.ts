export class ApiError extends Error {}

export class ApiClient {
  private static instance: ApiClient | undefined

  private constructor() {}

  static getInstance(): ApiClient {
    ApiClient.instance ??= new ApiClient()
    return ApiClient.instance
  }

  async request<T = unknown>(path: string, method = 'GET', body?: unknown): Promise<T> {
    const res = await fetch(`/api${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new ApiError(data.error ?? 'server_error')
    return data as T
  }
}
