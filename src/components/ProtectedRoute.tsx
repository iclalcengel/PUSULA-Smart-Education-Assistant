import { Navigate } from "react-router-dom";
import { useAuth, AppRole } from "@/hooks/useAuth";
import { ReactNode } from "react";

export const ProtectedRoute = ({ children, requireRole }: { children: ReactNode; requireRole?: AppRole }) => {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-gradient-soft">
        <div className="w-12 h-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (requireRole && role && role !== requireRole) {
    return <Navigate to={role === "teacher" ? "/teacher" : "/student"} replace />;
  }
  return <>{children}</>;
};
