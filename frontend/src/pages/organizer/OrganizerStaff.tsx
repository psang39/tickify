import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from 'lucide-react';
import { api } from '@/lib/axiosClient';

export default function OrganizerStaff() {
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Form state quản lý thông tin staff mới
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        email: '',
        password: '',
        phone: ''
    });
    const [error, setError] = useState('');

    // 1. FETCH DANH SÁCH STAFFS VỚI TANSTACK QUERY
    const { data: staffData, isLoading, isError } = useQuery({
        queryKey: ['organizerStaffs', page],
        queryFn: async () => {
            // axiosClient tự động đính kèm Token từ Interceptor phía sau
            const res = await api.get(`/organizer/staffs`, {
                params: { page, limit: 5 }
            });
            return res.data;
        },
        placeholderData: (previousData) => previousData, // Giữ mượt UI khi chuyển trang
    });

    // Extract dữ liệu từ cấu hình phân trang của Backend
    const staffs = staffData?.docs || [];
    const totalPages = staffData?.totalPages || 1;

    // 2. TẠO TÀI KHOẢN STAFF VỚI MUTATION
    const createStaffMutation = useMutation({
        mutationFn: async (newStaffData: typeof formData) => {
            return await api.post('/organizer/staff', newStaffData);
        },
        onSuccess: () => {
            setIsModalOpen(false);
            setFormData({ first_name: '', last_name: '', email: '', password: '', phone: '' });
            setError('');
            queryClient.invalidateQueries({ queryKey: ['organizerStaffs'] });
        },
        onError: (err: any) => {
            setError(err.response?.data?.message || 'Có lỗi xảy ra khi tạo nhân viên');
        }
    });

    const handleCreateStaff = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        createStaffMutation.mutate(formData);
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6 p-4">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Đội ngũ nhân sự</h1>
                    <p className="text-slate-500 text-sm">Cấp tài khoản và quản lý nhân viên kiểm soát vé tại hiện trường</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-primary hover:opacity-90 text-white px-4 py-2 rounded-xl font-medium transition-all"
                >
                    <Plus size={18} /> Thêm nhân viên
                </button>
            </div>

            {/* Bảng danh sách Staff */}
            <Card className="border-slate-200">
                <CardHeader className="border-b border-slate-100 pb-4">
                    <CardTitle className="text-base font-bold text-slate-700">Danh sách tài khoản hoạt động</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 text-slate-400 font-bold text-xs uppercase tracking-wider border-b border-slate-100">
                                    <th className="py-4 px-6">Nhân viên</th>
                                    <th className="py-4 px-6">Email hệ thống</th>
                                    <th className="py-4 px-6">Số show đã gán</th>
                                    <th className="py-4 px-6">Trạng thái</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-sm text-slate-600">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={4} className="text-center py-8 text-slate-400 font-medium">Đang tải danh sách nhân viên...</td>
                                    </tr>
                                ) : isError ? (
                                    <tr>
                                        <td colSpan={4} className="text-center py-8 text-rose-600 font-medium">Không thể tải dữ liệu nhân sự. Vui lòng thử lại.</td>
                                    </tr>
                                ) : staffs.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="text-center py-8 text-slate-400 font-medium">Chưa có nhân viên nào dưới quyền quản lý.</td>
                                    </tr>
                                ) : (
                                    staffs.map((staff: any) => (
                                        <tr key={staff._id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="py-4 px-6 font-semibold text-slate-800">
                                                {staff.first_name} {staff.last_name}
                                            </td>
                                            <td className="py-4 px-6 font-mono text-xs">{staff.email}</td>
                                            <td className="py-4 px-6">
                                                <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full text-xs font-bold">
                                                    {staff.assigned_show_ids?.length || 0} ca làm việc
                                                </span>
                                            </td>
                                            <td className="py-4 px-6">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${staff.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                                                    {staff.status === 'active' ? 'Đang hoạt động' : 'Tạm khóa'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Điều hướng Phân trang */}
                    {!isLoading && totalPages > 1 && (
                        <div className="flex justify-end gap-2 p-4 border-t border-slate-100">
                            <button
                                disabled={page === 1}
                                onClick={() => setPage(prev => prev - 1)}
                                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold disabled:opacity-50 hover:bg-slate-50"
                            >
                                Trước
                            </button>
                            <span className="text-xs font-medium text-slate-500 self-center">Trang {page} / {totalPages}</span>
                            <button
                                disabled={page === totalPages}
                                onClick={() => setPage(prev => prev + 1)}
                                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold disabled:opacity-50 hover:bg-slate-50"
                            >
                                Sau
                            </button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* MODAL TẠO TÀI KHOẢN STAFF */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <Card className="w-full max-w-md animate-in fade-in-50 zoom-in-95 duration-150">
                        <CardHeader>
                            <CardTitle className="text-lg font-bold text-slate-800">Cấp tài khoản Staff mới</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleCreateStaff} className="space-y-4">
                                {error && <p className="text-xs font-bold text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-100">{error}</p>}

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Họ</label>
                                        <input
                                            type="text" required
                                            value={formData.last_name}
                                            onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                                            className="w-full border border-slate-200 px-3 py-2 rounded-xl text-sm focus:outline-primary"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Tên</label>
                                        <input
                                            type="text" required
                                            value={formData.first_name}
                                            onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                                            className="w-full border border-slate-200 px-3 py-2 rounded-xl text-sm focus:outline-primary"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Email đăng nhập</label>
                                    <input
                                        type="email" required
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full border border-slate-200 px-3 py-2 rounded-xl text-sm focus:outline-primary"
                                        placeholder="nhanvien@domain.com"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Số điện thoại</label>
                                    <input
                                        type="tel" required
                                        value={formData.phone}
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                        className="w-full border border-slate-200 px-3 py-2 rounded-xl text-sm focus:outline-primary"
                                        placeholder="0123456789"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Mật khẩu ban đầu</label>
                                    <input
                                        type="password" required
                                        value={formData.password}
                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                        className="w-full border border-slate-200 px-3 py-2 rounded-xl text-sm focus:outline-primary"
                                        placeholder="••••••••"
                                    />
                                </div>

                                <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                                    <button
                                        type="button"
                                        disabled={createStaffMutation.isPending}
                                        onClick={() => setIsModalOpen(false)}
                                        className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-100 transition-colors"
                                    >
                                        Hủy
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={createStaffMutation.isPending}
                                        className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                                    >
                                        {createStaffMutation.isPending ? 'Đang kích hoạt...' : 'Kích hoạt tài khoản'}
                                    </button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}