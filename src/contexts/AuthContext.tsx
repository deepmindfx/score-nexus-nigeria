
import React, { createContext, useState, useEffect, useMemo, useContext } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from 'react-router-dom';
import { toast } from '@/components/ui/use-toast';
import { UserRole } from '@/types/user';

export type SchoolData = {
  schoolName: string;
  fullName: string;
};

interface AuthContextType {
  user: any;
  userRole: UserRole | null;
  loading: boolean;
  isSuperAdmin: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; data?: any; }>;
  signup: (email: string, password: string, schoolData: SchoolData) => Promise<{ success: boolean; error?: string; data?: any; }>;
  logout: () => Promise<{ success: boolean; error?: string; }>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserRole = async (userId: string) => {
      try {
        const { data, error } = await supabase.rpc('get_user_role', { user_id_param: userId });
        if (error) {
          console.error('Error fetching user role:', error);
          setUserRole(null);
        } else if (data) {
          setUserRole(data as UserRole);
        }
      } catch (error) {
        console.error('Error in fetchUserRole:', error);
        setUserRole(null);
      }
    };

    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user || null);
        if (session?.user) {
          await fetchUserRole(session.user.id);
        }
      } catch (error) {
        console.error('Error getting session:', error);
      } finally {
        setLoading(false);
      }
    };
    getInitialSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user || null);
        if (session?.user) {
          fetchUserRole(session.user.id);
        } else {
          setUserRole(null);
        }
        if (event !== 'INITIAL_SESSION') {
          setLoading(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const isSuperAdmin = useMemo(() => {
    if (!user) return false;
    const superAdminEmails = ['deepmindfx01@gmail.com', 'aleeyuwada01@gmail.com', 'superadmin@scoredesk.com'];
    const isSuperAdminByEmail = user.email && superAdminEmails.includes(user.email);
    const isSuperAdminByFlag = user.user_metadata?.is_super_admin === true;
    return isSuperAdminByEmail || isSuperAdminByFlag;
  }, [user]);

  const login = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast({
          title: "Login failed",
          description: error.message,
          variant: "destructive",
        });
        return { success: false, error: error.message };
      }
      
      toast({
        title: "Login successful",
        description: "Welcome back to ScoreDesk!",
      });
      return { success: true, data };
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
      return { success: false, error: error.message };
    }
  };

  const signup = async (email: string, password: string, schoolData: SchoolData) => {
    try {
      let isSuperAdmin = window.location.pathname === '/signup';
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: schoolData.fullName,
            school_name: schoolData.schoolName,
            is_super_admin: isSuperAdmin,
          },
        },
      });

      if (error) {
        toast({
          title: "Signup failed",
          description: error.message,
          variant: "destructive",
        });
        return { success: false, error: error.message };
      }

      toast({
        title: "Account created",
        description: isSuperAdmin 
          ? "Welcome to ScoreDesk! You have been granted Super Admin privileges."
          : "Welcome to ScoreDesk!",
      });
      return { success: true, data };
    } catch (error: any) {
      toast({
        title: "Signup failed",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        toast({
          title: "Logout failed",
          description: error.message,
          variant: "destructive",
        });
        return { success: false, error: error.message };
      }
      
      setUser(null);
      setUserRole(null);
      navigate('/login');
      toast({
        title: "Logged out",
        description: "You've been successfully logged out",
      });
      return { success: true };
    } catch (error: any) {
      toast({
        title: "Logout failed",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
      return { success: false, error: error.message };
    }
  };

  const value = { user, userRole, loading, isSuperAdmin, login, signup, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
