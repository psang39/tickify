import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
interface ProtectedRouteProps {
    allowedRoles: string[];
}
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
    const { user, isAuthenticated, isLoading } = useAuthStore();
    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-primary font-bold animate-pulse">Đang kiểm tra quyền truy cập...</div>
            </div>
        );
    }
    if (!isAuthenticated || !user) {
        return <Navigate to="/login" replace />;
    }
    if (!allowedRoles.includes(user.role)) {
        alert("Bạn không có quyền truy cập vào khu vực này!");
        return <Navigate to="/" replace />;
    }
    return <Outlet />;
};