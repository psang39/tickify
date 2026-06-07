import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LogoutConfirmDialog } from '@/components/shared/LogoutConfirmDialog';
import {
    AlertTriangle,
    Building2,
    LayoutDashboard,
    LogOut,
    Menu,
    ShieldCheck,
    Users,
} from 'lucide-react';

export default function AdminLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const currentPath = location.pathname;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950/70 dark:bg-slate-900/80 font-sans text-slate-900 dark:text-slate-50">
            <div className="flex min-h-screen">
                <aside className="hidden w-64 shrink-0 border-r border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/90 lg:block">
                    <div className="sticky top-0 flex h-screen flex-col justify-between">
                        <div className="px-5 py-5">
                            <button
                                type="button"
                                onClick={() => navigate('/admin')}
                                className="mb-8 flex w-full items-center gap-3 text-left"
                            >
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-lg font-black text-white shadow-sm">
                                    T
                                </div>
                                <div className="leading-tight">
                                    <p className="text-base font-black tracking-tight text-slate-900 dark:text-slate-50">Tickify</p>
                                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Trang quản trị</p>
                                </div>
                            </button>

                            <nav className="space-y-1">
                                <SidebarLink
                                    icon={<LayoutDashboard size={18} />}
                                    label="Tổng quan"
                                    active={currentPath === '/admin'}
                                    onClick={() => navigate('/admin')}
                                />
                                <SidebarLink
                                    icon={<Building2 size={18} />}
                                    label="Duyệt nhà tổ chức"
                                    active={currentPath.startsWith('/admin/organizers')}
                                    onClick={() => navigate('/admin/organizers')}
                                />
                                <SidebarLink
                                    icon={<Users size={18} />}
                                    label="Người dùng"
                                    active={currentPath.startsWith('/admin/users')}
                                    onClick={() => navigate('/admin/users')}
                                />
                                <SidebarLink
                                    icon={<AlertTriangle size={18} />}
                                    label="Báo cáo vi phạm"
                                    active={currentPath.startsWith('/admin/reports')}
                                    onClick={() => navigate('/admin/reports')}
                                />
                            </nav>
                        </div>

                        <div className="border-t border-slate-100 dark:border-white/10 p-5">
                            <LogoutConfirmDialog className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-500 dark:text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10">
                                <LogOut size={18} />
                                <span>Đăng xuất</span>
                            </LogoutConfirmDialog>
                        </div>
                    </div>
                </aside>

                <div className="flex min-w-0 flex-1 flex-col">
                    <header className="sticky top-0 z-20 border-b border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-950/90 px-4 py-3 backdrop-blur lg:px-8">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <button className="rounded-lg border border-slate-200 dark:border-white/10 p-2 text-slate-600 dark:text-slate-300 lg:hidden" type="button">
                                    <Menu size={18} />
                                </button>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Quản trị hệ thống</p>
                                    <h1 className="text-lg font-bold text-slate-900 dark:text-slate-50 md:text-xl">Bảng điều khiển Admin</h1>
                                </div>
                            </div>
                            <div className="hidden items-center gap-2 rounded-full border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950/70 dark:bg-slate-900/80 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 sm:flex">
                                <ShieldCheck size={15} className="text-primary" />
                                Quyền quản trị
                            </div>
                        </div>
                    </header>

                    <main className="flex-1 px-4 py-6 md:px-8 lg:px-10">
                        <Outlet />
                    </main>
                </div>
            </div>
        </div>
    );
}

function SidebarLink({
    icon,
    label,
    active = false,
    onClick,
}: {
    icon: React.ReactNode;
    label: string;
    active?: boolean;
    onClick?: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-all ${active
                ? 'bg-primary/10 text-primary shadow-sm'
                : 'text-slate-500 hover:bg-slate-950/70 dark:hover:bg-slate-800 hover:text-slate-50'
                }`}
        >
            <span className={active ? 'text-primary' : 'text-slate-400'}>{icon}</span>
            <span>{label}</span>
        </button>
    );
}
