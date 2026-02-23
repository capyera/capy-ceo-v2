import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'member';
  workspaces: string[];
}

interface AuthContextType {
  user: User | null;
  users: User[];
  login: (email: string, password: string) => boolean;
  logout: () => void;
  addUser: (user: Omit<User, 'id'> & { password: string }) => void;
  currentWorkspace: string;
  setCurrentWorkspace: (workspace: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Default users with passwords stored separately
const DEFAULT_USERS: (User & { password: string })[] = [
  { id: '1', email: 'james@capy-era.com', password: 'CapyBoss2026!', name: 'James', role: 'admin', workspaces: ['operations', 'content'] },
  { id: '2', email: 'chiayee@capy-era.com', password: 'CapyAdmin2026!', name: 'Chia Yee', role: 'admin', workspaces: ['operations', 'content'] },
  { id: '3', email: 'ops@capy-era.com', password: 'CapyOps2026!', name: 'Ops Team', role: 'member', workspaces: ['operations'] },
];

const STORAGE_KEYS = {
  USER: 'capy-current-user',
  USERS: 'capy-users',
  WORKSPACE: 'capy-current-workspace',
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<(User & { password: string })[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState('operations');
  const [isLoading, setIsLoading] = useState(true);

  // Initialize on mount
  useEffect(() => {
    // Load users from localStorage or use defaults
    const storedUsers = localStorage.getItem(STORAGE_KEYS.USERS);
    if (storedUsers) {
      setUsers(JSON.parse(storedUsers));
    } else {
      setUsers(DEFAULT_USERS);
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(DEFAULT_USERS));
    }

    // Load current user
    const storedUser = localStorage.getItem(STORAGE_KEYS.USER);
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }

    // Load workspace
    const storedWorkspace = localStorage.getItem(STORAGE_KEYS.WORKSPACE);
    if (storedWorkspace) {
      setCurrentWorkspace(storedWorkspace);
    }

    setIsLoading(false);
  }, []);

  const login = (email: string, password: string): boolean => {
    const foundUser = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    if (foundUser) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _, ...userWithoutPassword } = foundUser;
      setUser(userWithoutPassword);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userWithoutPassword));
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEYS.USER);
  };

  const addUser = (newUser: Omit<User, 'id'> & { password: string }) => {
    const userWithId = {
      ...newUser,
      id: Date.now().toString(),
    };
    const updatedUsers = [...users, userWithId];
    setUsers(updatedUsers);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updatedUsers));
  };

  const handleSetWorkspace = (workspace: string) => {
    setCurrentWorkspace(workspace);
    localStorage.setItem(STORAGE_KEYS.WORKSPACE, workspace);
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  // Return users without passwords for the context
  const usersWithoutPasswords: User[] = users.map(({ password: _, ...user }) => user);

  return (
    <AuthContext.Provider value={{ 
      user, 
      users: usersWithoutPasswords, 
      login, 
      logout, 
      addUser,
      currentWorkspace,
      setCurrentWorkspace: handleSetWorkspace,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
