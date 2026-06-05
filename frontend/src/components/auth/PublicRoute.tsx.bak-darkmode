import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';

export const PublicRoute: React.FC = () => {
    const { isAuthenticated, isLoading, user } = useAuthStore();

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-primary font-bold animate-pulse">Đang tải...</div>
            </div>
        );
    }
    if (isAuthenticated && user) {
        const redirectPath = user.role === 'organizer' ? '/organizer/events' : '/';
        return <Navigate to={redirectPath} replace />;
    }
    return <Outlet />;
};