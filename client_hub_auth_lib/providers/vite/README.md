## ClientHubAuthProvider

The React context provider that manages authentication state.

Props:

- children (React.ReactNode): The child components to wrap

## useClientHubAuth()

React hook that provides access to authentication state and methods.

**Returns:**

```typescript
{
  accessToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: () => void
  logout: () => void
  user: User | null
  setAccessToken: (token: string | null) => void
  getAccessTokenSilently: () => Promise<string | null>
}
```

**User Interface:**

```typescript
interface User {
  name: string
  email: string
  picture?: string
}
```

## Usage

#### 1. Wrap Your App with AuthProvider

```tsx
// App.tsx
import { ClientHubAuthProvider } from "client-hub-auth-lib/provider/vite"

function App() {
  return (
    <ClientHubAuthProvider>
      <YourApp />
    </ClientHubAuthProvider>
  )
}
```

#### 2. Configure Authentication Settings

If your app is configured with Doppler, add the secrets to Doppler.

Otherwise, add the secrets to your environment variables. Example below:

```bash
# Required
VITE_JWT_ISSUER=https://identity.inv.tech
VITE_REDIRECT_URI=https://nextgen-awesome-app.inv.tech
```

#### 3. Use Authentication Hook

```tsx
// components/LoginButton.tsx
import { useClientHubAuth } from "client-hub-auth-lib/provider/vite"

function LoginButton() {
  const { login, logout, isAuthenticated, user } = useClientHubAuth()

  if (isAuthenticated) {
    return (
      <div>
        <p>Welcome, {user?.name}!</p>
        <button onClick={logout}>Logout</button>
      </div>
    )
  }

  return <button onClick={login}>Login</button>
}
```

#### 4. Protected Routes

```tsx
// components/ProtectedRoute.tsx
import { useClientHubAuth } from "client-hub-auth-lib/provider/vite"

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useClientHubAuth()

  if (!isAuthenticated) {
    return <div>Please log in to access this page.</div>
  }

  return <>{children}</>
}
```

#### 5. API Calls with Authentication

```tsx
// services/api.ts
import { useClientHubAuth } from "client-hub-auth-lib/provider/vite"

export function useAuthenticatedApi() {
  const { getAccessTokenSilently } = useClientHubAuth()

  const makeAuthenticatedRequest = async (url: string) => {
    const token = await getAccessTokenSilently()

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })

    return response.json()
  }

  return { makeAuthenticatedRequest }
}
```

## Authentication Flow

1. **Login**: User clicks login → Redirected to auth server
2. **Callback**: Auth server redirects back with authorization code
3. **Token Exchange**: Code is exchanged for access and refresh tokens
4. **User Info**: User information is fetched using the access token
5. **Token Refresh**: Access tokens are automatically refreshed when needed
