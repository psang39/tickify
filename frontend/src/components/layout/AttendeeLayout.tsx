import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { api } from '@/lib/axiosClient';
import { User, ShoppingBag, Gift, Settings, HelpCircle, LogOut } from 'lucide-react';
import { LoadingOverlay } from '@/components/shared/LoadingOverlay';
import { ErrorModal } from '@/components/shared/ErrorModal';

export default function AttendeeLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Fetch thông tin người dùng tập trung tại Layout để tránh duplicate query
    const { data: userData, isLoading, isError } = useQuery({
        queryKey: ['userProfile'],
        queryFn: async () => {
            const response = await api.get('/user/profile');
            return response.data?.data || response.data;
        }
    });

    useEffect(() => {
        if (isError) {
            setErrorMessage("Không thể tải thông tin hồ sơ tài khoản.");
        }
    }, [isError]);

    // Tự động kiểm tra route hiện tại để kích hoạt trạng thái active cho sidebar
    const currentPath = location.pathname;

    return (
        <div className="min-h-screen  font-sans text-slate-900 dark:text-slate-50 py-12">
            <LoadingOverlay isVisible={isLoading} />
            <ErrorModal message={errorMessage} onClose={() => setErrorMessage(null)} />

            <div className="max-w-7xl mx-auto px-6 flex gap-8">
                {/* SIDEBAR TRÁI DÙNG CHUNG */}
                <aside className="w-64 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-white/10 rounded-2xl flex flex-col justify-between shrink-0 h-[calc(100vh-140px)] sticky top-24 p-6">
                    <div>
                        {/* Khu vực Avatar & Tên tài khoản */}
                        <div className="flex flex-col items-center text-center mb-10 pb-6 border-b border-slate-100 dark:border-white/10">
                            <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-slate-100 dark:border-white/10 mb-3 bg-slate-50 dark:bg-slate-950/70 dark:bg-slate-900/80">
                                <img
                                    src={userData?.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=Sylvie"}
                                    alt="Avatar"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <h2 className="font-bold text-[15px] text-slate-800 dark:text-slate-100">
                                {userData ? `${userData.first_name || ''} ${userData.last_name || ''}` : 'Đang tải...'}
                            </h2>
                        </div>

                        {/* Thanh điều hướng Menu */}
                        <nav className="space-y-1">
                            <SidebarLink
                                icon={<User size={18} />}
                                label="Hồ sơ cá nhân"
                                active={currentPath === '/profile'}
                                onClick={() => navigate('/profile')}
                            />
                            <SidebarLink
                                icon={<ShoppingBag size={18} />}
                                label="Lịch sử đặt vé"
                                active={currentPath.startsWith('/orders') || currentPath.startsWith('/tickets')}
                                onClick={() => navigate('/orders')}
                            />
                            <SidebarLink icon={<Gift size={18} />} label="Thẻ quà tặng" />
                            <SidebarLink icon={<Settings size={18} />} label="Cài đặt" />
                            <SidebarLink icon={<HelpCircle size={18} />} label="Trợ giúp" />
                        </nav>
                    </div>

                    {/* Nút đăng xuất tài khoản */}
                    <button className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:text-red-500 transition-colors font-semibold text-sm">
                        <LogOut size={18} />
                        <span>Đăng xuất</span>
                    </button>
                </aside>

                {/* KHU VỰC CHỨA NỘI DUNG TRANG CON BÊN PHẢI */}
                <main className="flex-1 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-white/10 rounded-2xl p-10">
                    <Outlet context={{ userData }} />
                </main>
            </div>
        </div>
    );
}

interface SidebarLinkProps {
    icon: React.ReactNode;
    label: string;
    active?: boolean;
    onClick?: () => void;
}

function SidebarLink({ icon, label, active = false, onClick }: SidebarLinkProps) {
    return (
        <div
            onClick={onClick}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all font-semibold text-sm
            ${active
                    ? 'bg-slate-950/70 text-primary border border-slate-100'
                    : 'text-slate-500 hover:text-slate-100 hover:bg-slate-950/70/50 border border-transparent'
                }`}
        >
            <span className={active ? "text-primary" : "text-slate-400"}>{icon}</span>
            <span>{label}</span>
        </div>
    );
}