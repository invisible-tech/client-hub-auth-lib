import React, {
  createContext,
  useEffect,
  useState,
  useContext,
  useCallback,
} from "react"
import { jwtDecode } from "jwt-decode"
import { toast } from "sonner"

const JWT_ISSUER = import.meta.env.VITE_JWT_ISSUER
const REDIRECT_URI = import.meta.env.VITE_REDIRECT_URI

interface User {
  name: string
  email: string
  picture?: string
}

type AuthContextType = {
  accessToken: string | null
  isAuthenticated: boolean
  login: () => void
  logout: () => void
  user: User | null
  setAccessToken: (token: string | null) => void
  getAccessTokenSilently: () => Promise<string | null>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useClientHubAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useClientHubAuth must be used within an AuthProvider")
  }
  return context
}

const exchangeCodeWithTokens = async (code: string) => {
  const response = await fetch(`${JWT_ISSUER}/token/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ code }),
  })

  if (!response.ok) {
    throw new Error("Failed to exchange code for tokens")
  }

  const data = await response.json()
  return data
}

export function ClientHubAuthProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [accessToken, setAccessTokenState] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const isCallbackRoute = window.location.pathname === "/auth/callback"

    if (!isCallbackRoute) return

    const params = new URLSearchParams(window.location.search)

    const code = params.get("code")
    if (!code) {
      toast.error("No code found in callback URL!")
      return
    }
    exchangeCodeWithTokens(code)
      .then((data) => {
        const { access_token: accessToken, refresh_token: refreshToken } = data
        if (accessToken) {
          setAccessToken(accessToken)
        }

        if (refreshToken) {
          localStorage.setItem("refresh_token", refreshToken)
        }
        window.location.assign("/")
      })
      .catch(() => {
        toast.error("Failed to exchange code for tokens")
      })
  }, [])

  useEffect(() => {
    const getUser = async (): Promise<User | null> => {
      try {
        const response = await fetch(`${JWT_ISSUER}/api/user`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        })

        if (!response.ok) {
          console.error("Failed to fetch user info")
          return null
        }

        const data = await response.json()
        return {
          name: data.name,
          email: data.email,
          picture: data.picture,
        }
      } catch (error) {
        console.error("Error fetching user info:", error)
        return null
      }
    }

    getUser().then((data) => {
      setUser(data)
    })
  }, [accessToken])

  const setAccessToken = useCallback((token: string | null) => {
    setAccessTokenState(token)
  }, [])

  const getAccessTokenSilently = async () => {
    if (!accessToken || aboutToExpire(accessToken)) {
      const token = await fetchRefreshToken()
      return token
    } else {
      return accessToken
    }
  }

  const aboutToExpire = (token: string, expirationBuffer = 10) => {
    const decoded = jwtDecode(token)
    if (decoded) {
      return ((decoded.exp || 0) + expirationBuffer) * 1000 < Date.now()
    } else {
      return false
    }
  }

  const fetchRefreshToken = async () => {
    const refreshToken = localStorage.getItem("refresh_token")
    if (!refreshToken) {
      return null
    }

    try {
      const response = await fetch(`${JWT_ISSUER}/refresh/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      })

      if (!response.ok) {
        console.error("Failed to fetch new access token")
        return null
      }

      const data = await response.json()
      setAccessToken(data.access_token)
      localStorage.setItem("refresh_token", data.refresh_token)
      return data.access_token
    } catch (error) {
      console.error("Error fetching new access token:", error)
      return null
    }
  }

  const value: AuthContextType = {
    accessToken,
    isAuthenticated: !!accessToken,
    login: () => {
      window.location.assign(
        `${JWT_ISSUER}/login/?redirect_uri=${REDIRECT_URI}`
      )
    },
    logout: () => {
      localStorage.removeItem("refresh_token")
      setAccessToken(null)
      window.location.assign("/")
    },
    user,
    setAccessToken,
    getAccessTokenSilently,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
