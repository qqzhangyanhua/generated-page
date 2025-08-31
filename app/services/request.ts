export const getInstance = (baseURL: string = "/api") => {
  return async (url: string, options: RequestInit = {}) => {
    try {
      // Get JWT token from localStorage
      const accessToken = localStorage.getItem('accessToken')
      
      // Add the Authorization header to the request
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(options.headers as Record<string, string>),
      }
      
      // Add Bearer token if available
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`
      }

      const response = await fetch(baseURL + url, { 
        ...options, 
        headers 
      })

      // Check the HTTP status code
      if (!response.ok) {
        return responseError(response)
      }

      // Parse the JSON response
      return await response
    } catch (error) {
      console.log("error->", "Request error", error)
      return responseError(error as Response)
    }
  }
}

export default getInstance

/**
 * Response error handler
 */
async function responseError(response: Response) {
  console.log("error->", "Request error", response)

  if (!response) {
    return Promise.reject({ message: "Unknown error" })
  }

  const data = await response.json()

  // Handle 401 status code
  if (response?.status === 401) {
    // Clear auth data and redirect to login
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('user')
    window.location.replace("/login")
    return Promise.reject({ message: "Unauthorized, redirecting..." })
  }
  if (data) {
    return Promise.reject(data)
  }
  return Promise.reject(response)
}
