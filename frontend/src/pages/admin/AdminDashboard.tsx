import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axiosClient';
import { Users, Ticket, CalendarClock, DollarSign, CheckCircle, XCircle } from 'lucide-react';
import { LoadingOverlay } from '@/components/shared/LoadingOverlay';

export default function AdminDashboard() {
    const queryClient = useQueryClient();

    // 1. Fetch Thống kê tổng quan
    const { data: statsData, isLoading: isStatsLoading } = useQuery({
        queryKey: ['adminDashboardStats'],
        queryFn: async () => {
            const res = await api.get('/admin/dashboard');
            return res.data?.data;
        }
    });

    // 2. Fetch danh sách Ban tổ chức chờ duyệt
    const { data: pendingOrganizers = [], isLoading: isOrgLoading } = useQuery({
        queryKey: ['pendingOrganizers'],
        queryFn: async () => {
            const res = await api.get('/admin/organizers/pending');
            return res.data?.data || [];
        }
    });

    // 3. Mutation: Duyệt Organizer
    const verifyMutation = useMutation({
        mutationFn: async (userId: string) => api.put(`/admin/organizers/${userId}/verify`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pendingOrganizers'] })
    });

    // 4. Mutation: Từ chối Organizer
    const rejectMutation = useMutation({
        mutationFn: async (userId: string) => api.delete(`/admin/organizers/${userId}/reject`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pendingOrganizers'] })
    });

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
    };

    return (
        <div className="w-full max-w-6xl animate-in fade-in duration-300">
            <LoadingOverlay isVisible={isStatsLoading || isOrgLoading} />

            <header className="mb-10">
                <h1 className="text-3xl font-black text-slate-800 tracking-tight">Tổng quan hệ thống</h1>
                <p className="text-slate-500 mt-1">Cập nhật lúc {new Date().toLocaleTimeString('vi-VN')}</p>
            </header>

            {/* CARD THỐNG KÊ (Từ getSystemDashboard) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                <StatCard title="Tổng Tài khoản" value={statsData?.totalUsers?.toLocaleString() || 0} icon={<Users size={24} className="text-blue-500" />} bg="bg-blue-50" />
                <StatCard title="Sự kiện Active" value={statsData?.totalActiveEvents?.toLocaleString() || 0} icon={<Ticket size={24} className="text-emerald-500" />} bg="bg-emerald-50" />
                <StatCard title="Sự kiện chờ duyệt" value={statsData?.totalPendingEvents?.toLocaleString() || 0} icon={<CalendarClock size={24} className="text-amber-500" />} bg="bg-amber-50" />
                <StatCard title="Tổng Doanh thu" value={formatCurrency(statsData?.totalSystemRevenue)} icon={<DollarSign size={24} className="text-primary" />} bg="bg-pink-50" />
            </div>

            {/* BẢNG XÉT DUYỆT NHANH (Từ getPendingOrganizers) */}
            <section className="bg-white border border-slate-200 rounded-[24px] overflow-hidden shadow-none">
                <div className="px-6 py-5 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
                    <h2 className="text-lg font-bold text-slate-800">Yêu cầu mở tài khoản Ban Tổ Chức</h2>
                    <span className="bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1 rounded-md">{pendingOrganizers.length} yêu cầu chờ</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400 font-bold bg-slate-50/30">
                                <th className="px-6 py-4">Tên Tổ Chức / Họ Tên</th>
                                <th className="px-6 py-4">Email Liên Hệ</th>
                                <th className="px-6 py-4">Ngày Đăng Ký</th>
                                <th className="px-6 py-4 text-right">Hành Động</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pendingOrganizers.length === 0 ? (
                                <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-500 italic">Không có yêu cầu nào đang chờ xử lý.</td></tr>
                            ) : (
                                pendingOrganizers.map((org: any) => (
                                    <tr key={org._id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 font-bold text-slate-800">{org.first_name} {org.last_name}</td>
                                        <td className="px-6 py-4 text-sm text-slate-600">{org.email}</td>
                                        <td className="px-6 py-4 text-sm font-medium text-slate-500">{new Date(org.createdAt || Date.now()).toLocaleDateString('vi-VN')}</td>
                                        <td className="px-6 py-4 flex justify-end gap-2">
                                            <button
                                                onClick={() => {
                                                    if (window.confirm('Từ chối và xóa tài khoản này?')) rejectMutation.mutate(org._id);
                                                }}
                                                disabled={rejectMutation.isPending || verifyMutation.isPending}
                                                className="px-3 py-2 text-red-500 hover:bg-red-50 font-bold text-xs rounded-lg transition-colors border border-transparent hover:border-red-200 flex items-center gap-1.5"
                                            >
                                                <XCircle size={16} /> Từ chối
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (window.confirm('Cấp quyền Organizer cho tài khoản này?')) verifyMutation.mutate(org._id);
                                                }}
                                                disabled={rejectMutation.isPending || verifyMutation.isPending}
                                                className="px-3 py-2 text-emerald-600 hover:bg-emerald-50 font-bold text-xs rounded-lg transition-colors border border-transparent hover:border-emerald-200 flex items-center gap-1.5"
                                            >
                                                <CheckCircle size={16} /> Phê duyệt
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}

// Sub-component cho thẻ thống kê
function StatCard({ title, value, icon, bg }: { title: string, value: string | number, icon: React.ReactNode, bg: string }) {
    return (
        <div className="bg-white border border-slate-200 p-6 rounded-2xl flex items-center gap-5 shadow-none">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${bg}`}>
                {icon}
            </div>
            <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{title}</p>
                <p className="text-2xl font-black text-slate-800">{value}</p>
            </div>
        </div>
    );
}