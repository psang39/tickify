import React, { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { LoadingOverlay } from '@/components/shared/LoadingOverlay';
import { useAuthStore } from '@/store/useAuthStore';
import { useFeedbackStore } from '@/store/useFeedbackStore';

interface ProtectedRouteProps {
    allowedRoles: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
    const { user, isAuthenticated, isLoading } = useAuthStore();
    const showError = useFeedbackStore((state) => state.showError);
    const isUnauthorized = Boolean(isAuthenticated && user && !allowedRoles.includes(user.role));

    useEffect(() => {
        if (isUnauthorized) {
            showError("Bạn không có quyền truy cập vào khu vực này!");
        }
    }, [isUnauthorized, showError]);

    if (isLoading) {
        return <LoadingOverlay isVisible={true} message="Đang kiểm tra quyền truy cập..." />;
    }

    if (!isAuthenticated || !user) {
        return <Navigate to="/login" replace />;
    }

    if (isUnauthorized) {
        return <Navigate to="/" replace />;
    }

    return <Outlet />;
};
