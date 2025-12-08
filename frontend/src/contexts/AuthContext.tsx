import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { apiService } from '../services/api';
import { User } from '../types';
import toast from 'react-hot-toast';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (userData: { username: string; email: string; password: string; profile?: any }) => Promise<void>;
  joinAsGuest: (username: string) => Promise<void>;
  logout: () => void;
  updateProfile: (profileData: any) => Promise<void>;
}

type AuthAction =
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS'; payload: { user: User; token: string } }
  | { type: 'AUTH_FAILURE' }
  | { type: 'LOGOUT' }
  | { type: 'UPDATE_USER'; payload: User };

const initialState: AuthState = {
  user: null,
  token: localStorage.getItem('token'),
  isLoading: true,
  isAuthenticated: false,
};

const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  console.log('AuthReducer - Current state:', state);
  console.log('AuthReducer - Action:', action);
  
  switch (action.type) {
    case 'AUTH_START':
      return {
        ...state,
        isLoading: true,
      };
    case 'AUTH_SUCCESS':
      console.log('AuthReducer - AUTH_SUCCESS, setting isAuthenticated to true');
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isLoading: false,
        isAuthenticated: true,
      };
    case 'AUTH_FAILURE':
      console.log('AuthReducer - AUTH_FAILURE, setting isAuthenticated to false');
      return {
        ...state,
        user: null,
        token: null,
        isLoading: false,
        isAuthenticated: false,
      };
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        token: null,
        isLoading: false,
        isAuthenticated: false,
      };
    case 'UPDATE_USER':
      return {
        ...state,
        user: action.payload,
      };
    default:
      return state;
  }
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token');
      const userStr = localStorage.getItem('user');

      console.log('initAuth - Found token:', !!token, 'Found user:', !!userStr);

      if (token && userStr) {
        try {
          const user = JSON.parse(userStr);
          console.log('initAuth - Dispatching AUTH_SUCCESS with stored data');
          dispatch({ type: 'AUTH_SUCCESS', payload: { user, token } });
          
          // Verify token with server
          console.log('initAuth - Verifying token with server...');
          const response = await apiService.getCurrentUser();
          console.log('initAuth - Token verification response:', response);
          
          if (response.success && response.data) {
            dispatch({ type: 'UPDATE_USER', payload: response.data.user });
            localStorage.setItem('user', JSON.stringify(response.data.user));
          } else {
            throw new Error('Token verification failed');
          }
        } catch (error) {
          console.error('Token validation failed:', error);
          console.log('initAuth - Clearing invalid tokens and setting AUTH_FAILURE');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          dispatch({ type: 'AUTH_FAILURE' });
        }
      } else {
        console.log('initAuth - No tokens found, setting AUTH_FAILURE');
        dispatch({ type: 'AUTH_FAILURE' });
      }
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    console.log('Login attempt started for:', email);
    dispatch({ type: 'AUTH_START' });
    try {
      const response = await apiService.login({ email, password });
      console.log('Login API response:', response);
      
      if (response.success && response.data) {
        const { user, token } = response.data;
        
        console.log('Storing token and user in localStorage');
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        
        console.log('Dispatching AUTH_SUCCESS');
        dispatch({ type: 'AUTH_SUCCESS', payload: { user, token } });
        toast.success('Login successful!');
      } else {
        throw new Error(response.message || 'Login failed');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      dispatch({ type: 'AUTH_FAILURE' });
      const message = error.response?.data?.message || error.message || 'Login failed';
      toast.error(message);
      throw error;
    }
  };

  const register = async (userData: {
    username: string;
    email: string;
    password: string;
    profile?: any;
  }): Promise<void> => {
    console.log('Register attempt started for:', userData.email);
    dispatch({ type: 'AUTH_START' });
    try {
      const response = await apiService.register(userData);
      console.log('Register API response:', response);
      
      if (response.success && response.data) {
        const { user, token } = response.data;
        
        console.log('Register - Storing token and user in localStorage');
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        
        console.log('Register - Dispatching AUTH_SUCCESS');
        dispatch({ type: 'AUTH_SUCCESS', payload: { user, token } });
        toast.success('Registration successful!');
      } else {
        throw new Error(response.message || 'Registration failed');
      }
    } catch (error: any) {
      console.error('Register error:', error);
      dispatch({ type: 'AUTH_FAILURE' });
      const message = error.response?.data?.message || error.message || 'Registration failed';
      toast.error(message);
      throw error;
    }
  };

  const joinAsGuest = async (username: string): Promise<void> => {
    dispatch({ type: 'AUTH_START' });
    try {
      const response = await apiService.joinAsGuest(username);
      
      if (response.success && response.data) {
        const { user, token } = response.data;
        
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        
        dispatch({ type: 'AUTH_SUCCESS', payload: { user, token } });
        toast.success('Joined as guest!');
      } else {
        throw new Error(response.message || 'Failed to join as guest');
      }
    } catch (error: any) {
      dispatch({ type: 'AUTH_FAILURE' });
      const message = error.response?.data?.message || error.message || 'Failed to join as guest';
      toast.error(message);
      throw error;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await apiService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      dispatch({ type: 'LOGOUT' });
      toast.success('Logged out successfully');
    }
  };

  const updateProfile = async (profileData: any): Promise<void> => {
    try {
      const response = await apiService.updateProfile(profileData);
      
      if (response.success && response.data) {
        const updatedUser = response.data.user;
        
        localStorage.setItem('user', JSON.stringify(updatedUser));
        dispatch({ type: 'UPDATE_USER', payload: updatedUser });
        toast.success('Profile updated successfully!');
      } else {
        throw new Error(response.message || 'Failed to update profile');
      }
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Failed to update profile';
      toast.error(message);
      throw error;
    }
  };

  const value: AuthContextType = {
    ...state,
    login,
    register,
    joinAsGuest,
    logout,
    updateProfile,
  };

  console.log('AuthProvider - Current state being provided:', state);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
