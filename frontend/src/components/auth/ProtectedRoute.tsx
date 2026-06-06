import React, { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { LoadingOverlay } from '@/components/shared/LoadingOverlay';
import { useAuthStore } from '@/store/useAuthStore';
import { useFeedbackStore } from '@/store/useFeedbackStore';
import { Lock } from 'lucide-react';

interface ProtectedRouteProps {
    allowedRoles: string[];
    requireVerifiedOrganizer?: boolean;
}


const OrganizerPendingApprovalGate: React.FC = () => {
    const { user } = useAuthStore();

    return (
        <main className="min-h-[calc(100vh-80px)] bg-slate-50 dark:bg-slate-950/70 dark:bg-slate-900/80 px-4 py-10">
            <section className="mx-auto flex max-w-3xl flex-col items-center rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/90 px-6 py-12 text-center shadow-sm">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-3xl">
                    <Lock size={24} className="text-amber-600" />
                </div>

                <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-amber-600">
                    Tài khoản đang chờ duyệt
                </p>

                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 md:text-3xl">
                    Dashboard Organizer hiện đang bị khóa
                </h1>

                <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300 md:text-base">
                    Tài khoản của bạn cần được quản trị viên phê duyệt để sử dụng các
                    tính năng quản lý sự kiện, show, vé, nhân viên và báo cáo.
                </p>

                <div className="mt-7 w-full max-w-xl rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950/70 dark:bg-slate-900/80 p-4 text-left">
                    <div className="grid gap-3 text-sm text-slate-700 dark:text-slate-200 md:grid-cols-2">
                        <div>
                            <p className="text-xs font-medium uppercase text-slate-400">Công ty</p>
                            <p className="mt-1 font-semibold text-slate-800 dark:text-slate-100">
                                {user?.company_name || 'Chưa có thông tin'}
                            </p>
                        </div>

                        <div>
                            <p className="text-xs font-medium uppercase text-slate-400">Trạng thái</p>
                            <p className="mt-1 font-semibold text-amber-600">Chưa được duyệt</p>
                        </div>
                    </div>
                </div>

                <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
                    Bạn có thể quay lại sau khi tài khoản được duyệt. Nếu cần cập nhật thông tin công ty,
                    hãy liên hệ quản trị viên hệ thống.
                </p>
            </section>
        </main>
    );
};

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
    allowedRoles,
    requireVerifiedOrganizer = false,
}) => {
    const { user, isAuthenticated, isLoading } = useAuthStore();
    const showError = useFeedbackStore((state) => state.showError);
    const location = useLocation();

    const isUnauthorized = Boolean(isAuthenticated && user && !allowedRoles.includes(user.role));

    const shouldCheckOrganizerVerification =
        requireVerifiedOrganizer &&
        isAuthenticated &&
        user?.role === 'Organizer';


    const isOrganizerNotVerified =
        shouldCheckOrganizerVerification && user?.is_verified === false;

    useEffect(() => {
        if (isUnauthorized) {
            showError('Bạn không có quyền truy cập vào khu vực này!');
        }
    }, [isUnauthorized, showError]);

    useEffect(() => {
        if (isOrganizerNotVerified) {
            showError('Tài khoản Organizer của bạn chưa được quản trị viên phê duyệt.');
        }
    }, [isOrganizerNotVerified, showError]);

    if (isLoading) {
        return <LoadingOverlay isVisible={true} message="Đang kiểm tra quyền truy cập..." />;
    }

    if (!isAuthenticated || !user) {
        return <Navigate to="/login" replace state={{ from: location }} />;
    }

    if (isUnauthorized) {
        return <Navigate to="/" replace />;
    }

    if (isOrganizerNotVerified) {
        return <OrganizerPendingApprovalGate />;
    }

    return <Outlet />;
};
