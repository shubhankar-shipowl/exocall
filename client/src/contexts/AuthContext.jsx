import { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'react-toastify';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  // Debug user state changes
  useEffect(() => {
    console.log('User state changed:', user);
  }, [user]);

  // Debug token state changes
  useEffect(() => {
    console.log('Token state changed:', token);
  }, [token]);

  // Check if user is authenticated
  useEffect(() => {
    let isMounted = true;
    let timeoutId = null;
    let abortController = null;

    const checkAuth = async () => {
      // Prevent multiple simultaneous requests
      if (!isMounted) return;

      console.log('AuthContext checkAuth - token:', token, 'user:', user);

      // Skip auth check if we already have a user (just logged in)
      if (user) {
        console.log('User already set, skipping auth check');
        if (isMounted) setIsLoading(false);
        return;
      }

      if (token) {
        // Cancel any previous request
        if (abortController) {
          abortController.abort();
        }
        abortController = new AbortController();

        try {
          const response = await fetch('/api/auth/profile', {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            signal: abortController.signal,
          });

          if (!isMounted) return;

          if (response.ok) {
            const data = await response.json();
            if (isMounted) {
              setUser(data.user);
              setIsLoading(false);
            }
          } else if (response.status === 401) {
            // Token is invalid or expired
            if (isMounted) {
              localStorage.removeItem('token');
              setToken(null);
              setUser(null);
              setIsLoading(false);
            }
          } else {
            // Other error - don't clear token on network/server errors, just stop loading
            console.error('Auth check failed with status:', response.status);
            if (isMounted) {
              setIsLoading(false);
            }
          }
        } catch (error) {
          // Ignore abort errors
          if (error.name === 'AbortError') return;

          // Network error - don't clear token, just stop loading
          console.error('Auth check failed:', error);
          if (isMounted) {
            setIsLoading(false);
          }
        }
      } else {
        console.log('No token found, user not authenticated');
        if (isMounted) setIsLoading(false);
      }
    };

    // Debounce to prevent rapid-fire requests
    timeoutId = setTimeout(() => {
      checkAuth();
    }, 100);

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      if (abortController) abortController.abort();
    };
  }, [token]); // Only depend on token, not user

  const login = async (email, password) => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      console.log('Login response:', response.status, data);

      if (response.ok) {
        console.log('Login successful, setting user:', data.user);
        localStorage.setItem('token', data.token);

        // Update both states together with callbacks
        setToken(data.token);
        setUser(data.user);

        // Force a re-render by updating loading state
        setIsLoading(false);

        toast.success('Login successful!');
        console.log('User state after login:', {
          user: data.user,
          token: data.token,
        });

        // Force a re-render by updating a dummy state
        setTimeout(() => {
          console.log('Forcing re-render after login');
        }, 100);

        return { success: true };
      } else {
        const errorMessage = data.error || data.message || 'Login failed';
        console.log('Login failed, returning error:', errorMessage);
        toast.error(errorMessage); // Show toast notification
        return { success: false, error: errorMessage };
      }
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = error.message || 'Network error. Please try again.';
      toast.error(errorMessage); // Show toast notification
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData) => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      const data = await response.json();

      if (response.ok) {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('token', data.token);
        toast.success('Registration successful!');
        return { success: true };
      } else {
        const errorMessage =
          data.error || data.message || 'Registration failed';
        toast.error(errorMessage);
        return { success: false, error: errorMessage };
      }
    } catch (error) {
      console.error('Registration error:', error);
      const errorMessage = error.message || 'Network error. Please try again.';
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    toast.success('Logged out successfully!');
  };

  // Token refresh function
  const refreshToken = async () => {
    if (!token) return false;

    try {
      const response = await fetch('/api/auth/profile', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        return true;
      } else {
        logout();
        return false;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      logout();
      return false;
    }
  };

  const updateProfile = async (profileData) => {
    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(profileData),
      });

      const data = await response.json();

      if (response.ok) {
        setUser(data.user);
        toast.success('Profile updated successfully!');
        return { success: true };
      } else {
        toast.error(data.error || 'Failed to update profile');
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error('Update profile error:', error);
      toast.error('Network error. Please try again.');
      return { success: false, error: 'Network error' };
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Password changed successfully!');
        return { success: true };
      } else {
        toast.error(data.error || 'Failed to change password');
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error('Change password error:', error);
      toast.error('Network error. Please try again.');
      return { success: false, error: 'Network error' };
    }
  };

  const isAuthenticated = !!user && !!token;

  console.log('AuthContext value calculation:', {
    user,
    token,
    isAuthenticated,
    userType: typeof user,
    tokenType: typeof token,
  });

  const value = {
    user,
    token,
    isLoading,
    login,
    register,
    logout,
    refreshToken,
    updateProfile,
    changePassword,
    isAuthenticated,
    isAdmin: user?.role === 'admin',
    isAgent: user?.role === 'agent',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
