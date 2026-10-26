import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { PreferencesProvider } from "@/hooks/usePreferences";
import { ButterflyCursor } from "@/components/effects/ButterflyCursor";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";
import NotFound from "./pages/NotFound.tsx";
import TeacherDashboard from "./pages/teacher/TeacherDashboard.tsx";
import TeacherCourseDetail from "./pages/teacher/TeacherCourseDetail.tsx";
import StudentDashboard from "./pages/student/StudentDashboard.tsx";
import StudentCourseDetail from "./pages/student/StudentCourseDetail.tsx";
import StudentChat from "./pages/student/StudentChat.tsx";
import JoinCourse from "./pages/student/JoinCourse.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <PreferencesProvider>
        <ButterflyCursor />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/teacher" element={<ProtectedRoute requireRole="teacher"><TeacherDashboard /></ProtectedRoute>} />
              <Route path="/teacher/courses/:courseId" element={<ProtectedRoute requireRole="teacher"><TeacherCourseDetail /></ProtectedRoute>} />
              <Route path="/teacher/courses" element={<ProtectedRoute requireRole="teacher"><TeacherDashboard /></ProtectedRoute>} />
              <Route path="/student" element={<ProtectedRoute requireRole="student"><StudentDashboard /></ProtectedRoute>} />
              <Route path="/student/join" element={<ProtectedRoute requireRole="student"><JoinCourse /></ProtectedRoute>} />
              <Route path="/student/courses/:courseId" element={<ProtectedRoute requireRole="student"><StudentCourseDetail /></ProtectedRoute>} />
              <Route path="/student/chat" element={<ProtectedRoute requireRole="student"><StudentChat /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </PreferencesProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
