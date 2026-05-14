import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';

interface ProtectedRouteProps {
    allowedRoles: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
    const { user, isAuthenticated, isLoading } = useAuthStore();

    // 1. Nếu hệ thống đang check token (lúc vừa F5 trang), hiện loading để không bị đá văng nhầm
    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-primary font-bold animate-pulse">Đang kiểm tra quyền truy cập...</div>
            </div>
        );
    }

    // 2. Nếu chưa đăng nhập -> Đá về trang Login
    if (!isAuthenticated || !user) {
        return <Navigate to="/login" replace />;
    }

    // 3. Nếu đã đăng nhập nhưng KHÔNG ĐÚNG ROLE -> Đá về trang chủ (hoặc trang báo lỗi 403)
    if (!allowedRoles.includes(user.role)) {
        alert("Bạn không có quyền truy cập vào khu vực này!");
        return <Navigate to="/" replace />;
    }

    // 4. Nếu qua hết các vòng kiểm tra trên -> Cho phép đi tiếp vào các Route con (<Outlet />)
    return <Outlet />;
};