import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axiosClient';
import { ChevronLeft, ChevronRight, Search, ShieldCheck, User as UserIcon } from 'lucide-react';
import { LoadingOverlay } from '@/components/shared/LoadingOverlay';

export default function ManageUsersPage() {
    const [page, setPage] = useState(0);
    const limit = 10;

    const { data, isLoading } = useQuery({
        queryKey: ['allUsers', page],
        queryFn: async () => {
            const res = await api.get(`/admin/users?page=${page}&limit=${limit}`);
            return res.data;
        }
    });

    const users = data?.data || [];
    const hasMore = data?.hasMore || false;
    const total = data?.total || 0;
    const renderRoleBadge = (role: string) => {
        const lowerRole = role?.toLowerCase();

        if (lowerRole === 'organizer') {
            return (
                <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-600 px-2.5 py-1 rounded-md text-[11px] font-black tracking-widest uppercase border border-blue-100">
                    <ShieldCheck size={12} /> Organizer
                </span>
            );
        }

        if (lowerRole === 'attendee') {
            return (
                <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md text-[11px] font-black tracking-widest uppercase border border-slate-200">
                    <UserIcon size={12} /> Attendee
                </span>
            );
        }
        if (lowerRole === 'staff') {
            return (
                <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md text-[11px] font-black tracking-widest uppercase border border-slate-200">
                    <UserIcon size={12} /> Staff
                </span>
            );
        }

        return null;
    };


    return (
        <div className="w-full max-w-6xl animate-in fade-in duration-300">
            <LoadingOverlay isVisible={isLoading} />

            <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 mb-2">Quản lý Tài khoản</h1>
                    <p className="text-slate-500 text-sm">Hệ thống ghi nhận tổng cộng <span className="font-bold text-primary">{total}</span> tài khoản đăng ký.</p>
                </div>

                <div className="relative w-full md:w-72">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Tìm kiếm email..."
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
                    />
                </div>
            </header>

            <div className="bg-white border border-slate-200 rounded-[24px] overflow-hidden shadow-none">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400 font-bold bg-slate-50/50">
                                <th className="px-6 py-4">Tài khoản</th>
                                <th className="px-6 py-4">Vai trò (Role)</th>
                                <th className="px-6 py-4">Trạng thái</th>
                                <th className="px-6 py-4">Ngày tham gia</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.length === 0 && !isLoading ? (
                                <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-500">Không có dữ liệu.</td></tr>
                            ) : (
                                users.map((user: any) => (
                                    <tr key={user._id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-800 text-sm">{user.first_name} {user.last_name}</span>
                                                <span className="text-xs text-slate-500 font-medium">{user.email}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {renderRoleBadge(user.role)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm font-medium text-emerald-600">Đang hoạt động</span>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium text-slate-500">
                                            {new Date(user.createdAt || Date.now()).toLocaleDateString('vi-VN')}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* TRÌNH PHÂN TRANG (PAGINATION) */}
                <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/30 flex items-center justify-between">
                    <span className="text-sm text-slate-500 font-medium">
                        Trang <span className="font-bold text-slate-800">{page + 1}</span>
                    </span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(0, p - 1))}
                            disabled={page === 0}
                            className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-white hover:text-primary disabled:opacity-50 disabled:hover:bg-transparent transition-colors bg-white"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <button
                            onClick={() => setPage(p => p + 1)}
                            disabled={!hasMore}
                            className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-white hover:text-primary disabled:opacity-50 disabled:hover:bg-transparent transition-colors bg-white"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}