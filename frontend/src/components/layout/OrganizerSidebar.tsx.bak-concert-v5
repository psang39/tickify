import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CalendarDays, LayoutDashboard, ChevronLeft, ChevronRight, Users, History } from 'lucide-react';

export default function OrganizerSidebar() {
    const navigate = useNavigate();
    const location = useLocation();

    const [isCollapsed, setIsCollapsed] = useState(() => {
        const saved = localStorage.getItem('organizer_sidebar_collapsed');
        return saved === 'true';
    });

    useEffect(() => {
        localStorage.setItem('organizer_sidebar_collapsed', String(isCollapsed));
    }, [isCollapsed]);

    const menuItems = [
        { title: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/organizer/dashboard' },
        { title: 'Sự kiện của tôi', icon: <CalendarDays size={20} />, path: '/organizer/events' },
        { title: 'Quản lý nhân viên', icon: <Users size={20} />, path: '/organizer/staff' },
        { title: 'Lịch sử check-in', icon: <History size={20} />, path: '/organizer/check-ins' },
    ];

    return (
        <aside
            className={`bg-white dark:bg-slate-900/90 border-r border-slate-200 dark:border-white/10 hidden md:flex flex-col shadow-sm z-10 transition-all duration-300 relative ${isCollapsed ? 'w-20' : 'w-64'
                }`}
        >
            {/* Header của Sidebar */}
            <div className={`p-6 border-b border-slate-100 dark:border-white/10 mb-4 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
                {!isCollapsed && (
                    <div>
                        <h2 className="text-2xl font-bold text-primary">Tickify</h2>
                        <p className="text-xs text-slate-400 uppercase tracking-widest mt-1 font-bold">Organizer</p>
                    </div>
                )}

                {/* Nút Toggle Đóng/Mở */}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/10 transition-colors"
                >
                    {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                </button>
            </div>

            {/* Danh sách Menu */}
            <nav className="flex-1 px-3 space-y-2">
                {menuItems.map((item) => {
                    const isActive = location.pathname.includes(item.path);
                    return (
                        <button
                            key={item.path}
                            onClick={() => navigate(item.path)}
                            title={isCollapsed ? item.title : undefined} // Hiện tooltip khi thu gọn
                            className={`w-full flex items-center py-3 rounded-xl transition-all duration-200 ${isCollapsed ? 'justify-center px-0' : 'px-4 gap-3'
                                } ${isActive
                                    ? 'bg-primary text-white shadow-md shadow-primary/20'
                                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900'
                                }`}
                        >
                            <div className="flex items-center justify-center min-w-[20px]">
                                {item.icon}
                            </div>
                            {!isCollapsed && <span className="font-semibold text-sm">{item.title}</span>}
                        </button>
                    );
                })}
            </nav>
        </aside>
    );
}