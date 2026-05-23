import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Building2, AlertTriangle, LogOut } from 'lucide-react';

export default function AdminLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const currentPath = location.pathname;

    return (
        <div className="min-h-screen bg-[#F8F9FA] font-sans text-slate-900 flex">
            <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between fixed h-screen top-0 left-0">
                <div className="p-6">
                    {/* Logo */}
                    <div className="mb-10 flex items-center gap-2">
                        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-black text-xl">T</div>
                        <span className="font-black text-xl tracking-tight text-slate-800">Tickify <span className="text-primary">Admin</span></span>
                    </div>

                    {/* Navigation */}
                    <nav className="space-y-1">
                        <SidebarLink icon={<LayoutDashboard size={18} />} label="Tổng quan" active={currentPath === '/admin'} onClick={() => navigate('/admin')} />
                        <SidebarLink icon={<Building2 size={18} />} label="Duyệt Organizer" active={currentPath.startsWith('/admin/organizers')} onClick={() => navigate('/admin/organizers')} />
                        <SidebarLink icon={<Users size={18} />} label="Quản lý Users" active={currentPath.startsWith('/admin/users')} onClick={() => navigate('/admin/users')} />
                        <SidebarLink icon={<AlertTriangle size={18} />} label="Báo cáo vi phạm" active={currentPath.startsWith('/admin/reports')} onClick={() => navigate('/admin/reports')} />
                    </nav>
                </div>

                <div className="p-6 border-t border-slate-100">
                    <button className="flex items-center gap-3 w-full px-4 py-3 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors font-semibold text-sm">
                        <LogOut size={18} />
                        <span>Đăng xuất</span>
                    </button>
                </div>
            </aside>
            <main className="flex-1 ml-64 p-10">
                <Outlet />
            </main>
        </div>
    );
}

function SidebarLink({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) {
    return (
        <div onClick={onClick} className={`flex items-center gap-3 px-4 py-3.5 rounded-xl cursor-pointer transition-all font-semibold text-sm
            ${active ? 'bg-primary/10 text-primary' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}>
            <span className={active ? "text-primary" : "text-slate-400"}>{icon}</span>
            <span>{label}</span>
        </div>
    );
}