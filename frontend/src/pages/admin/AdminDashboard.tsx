import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axiosClient';
import { Users, Ticket, CalendarClock, DollarSign, CheckCircle, XCircle, MapPin, ChevronLeft, ChevronRight, PlusCircle, Trash2, Edit3 } from 'lucide-react';
import { LoadingOverlay } from '@/components/shared/LoadingOverlay';
import { useFeedbackStore } from '@/store/useFeedbackStore';

export default function AdminDashboard() {
    const queryClient = useQueryClient();
    const { showSuccess, showError } = useFeedbackStore();

    const [orgPage, setOrgPage] = useState(1);
    const [venuePage, setVenuePage] = useState(1);
    const LIMIT = 5;

    const [isVenueFormOpen, setIsVenueFormOpen] = useState(false);
    const [editingVenueId, setEditingVenueId] = useState<string | null>(null);
    const [venueForm, setVenueForm] = useState({
        name: '',
        address: '',
        city: '',
        latitude: '',
        longitude: ''
    });

    const { data: statsData, isLoading: isStatsLoading } = useQuery({
        queryKey: ['adminDashboardStats'],
        queryFn: async () => {
            const res = await api.get('/admin/dashboard');
            return res.data?.data;
        }
    });

    const { data: orgsResponse, isLoading: isOrgLoading } = useQuery({
        queryKey: ['pendingOrganizers', orgPage],
        queryFn: async () => {
            const res = await api.get('/admin/organizers/pending', {
                params: { page: orgPage, limit: LIMIT }
            });
            return res.data;
        }
    });
    const pendingOrganizers = orgsResponse?.data || [];
    const orgPagination = orgsResponse?.pagination;

    const { data: venuesResponse, isLoading: isVenueLoading } = useQuery({
        queryKey: ['adminAllVenues', venuePage],
        queryFn: async () => {
            const res = await api.get('/admin/venues', {
                params: { page: venuePage, limit: LIMIT }
            });
            return res.data;
        }
    });
    const allVenues = venuesResponse?.data || [];
    const venuePagination = venuesResponse?.pagination;

    const saveVenueMutation = useMutation({
        mutationFn: async (formDataPayload: typeof venueForm) => {
            const payload = {
                name: formDataPayload.name.trim(),
                address: formDataPayload.address.trim(),
                city: formDataPayload.city.trim(),
                latitude: formDataPayload.latitude ? Number(formDataPayload.latitude) : undefined,
                longitude: formDataPayload.longitude ? Number(formDataPayload.longitude) : undefined
            };

            if (editingVenueId) {
                return await api.put(`/admin/venues/${editingVenueId}`, payload);
            } else {
                return await api.post('/venues', payload);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['adminAllVenues'] });
            queryClient.invalidateQueries({ queryKey: ['adminDashboardStats'] });
            setEditingVenueId(null);
            setIsVenueFormOpen(false);
            setVenueForm({ name: '', address: '', latitude: '', longitude: '', city: '' });
            showSuccess(editingVenueId ? "Cập nhật thông tin địa điểm thành công!" : "Khởi tạo địa điểm hệ thống dùng chung thành công!");
        },
        onError: (err: any) => {
            showError(err.response?.data?.message || "Thao tác thất bại. Vui lòng kiểm tra lại dữ liệu.");
        }
    });


    const deleteVenueMutation = useMutation({
        mutationFn: async (venueId: string) => api.delete(`/admin/venues/${venueId}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['adminAllVenues'] });
            queryClient.invalidateQueries({ queryKey: ['adminDashboardStats'] });
            showSuccess("Đã xóa vĩnh viễn địa điểm khỏi hệ thống.");
        },
        onError: (err: any) => showError(err.response?.data?.message || "Không thể xóa địa điểm này!")
    });


    const verifyVenueMutation = useMutation({
        mutationFn: async (venueId: string) => api.put(`/admin/venues/${venueId}/verify`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminAllVenues'] })
    });


    const verifyOrgMutation = useMutation({
        mutationFn: async (userId: string) => api.put(`/admin/organizers/${userId}/verify`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pendingOrganizers'] })
    });
    const rejectOrgMutation = useMutation({
        mutationFn: async (userId: string) => api.delete(`/admin/organizers/${userId}/reject`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pendingOrganizers'] })
    });


    const handleStartEdit = (venue: any) => {
        setEditingVenueId(venue._id);
        setIsVenueFormOpen(true);
        setVenueForm({
            name: venue.name || '',
            address: venue.address || '',
            latitude: venue.latitude?.toString() || '',
            longitude: venue.longitude?.toString() || '',
            city: venue.city || ''
        });
        window.scrollTo({ top: 150, behavior: 'smooth' });
    };

    const handleCancelEdit = () => {
        setEditingVenueId(null);
        setIsVenueFormOpen(false);
        setVenueForm({ name: '', address: '', latitude: '', longitude: '', city: '' });
    };

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!venueForm.name.trim() || !venueForm.address.trim()) {
            showError("Vui lòng điền đầy đủ Tên và Địa chỉ.");
            return;
        }
        saveVenueMutation.mutate(venueForm);
    };

    const isGlobalLoading = isStatsLoading || isOrgLoading || isVenueLoading || saveVenueMutation.isPending || deleteVenueMutation.isPending;

    return (
        <div className="w-full max-w-6xl animate-in fade-in duration-300 space-y-12 pb-16">
            <LoadingOverlay isVisible={isGlobalLoading} />

            <header>
                <h1 className="text-3xl font-black text-slate-800 tracking-tight">Tổng quan hệ thống</h1>
                <p className="text-slate-500 mt-1 font-medium">Cập nhật hệ thống: {new Date().toLocaleTimeString('vi-VN')}</p>
            </header>


            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Tổng Tài khoản" value={statsData?.totalUsers?.toLocaleString() || 0} icon={<Users size={24} className="text-blue-500" />} bg="bg-blue-50" />
                <StatCard title="Sự kiện Active" value={statsData?.totalActiveEvents?.toLocaleString() || 0} icon={<Ticket size={24} className="text-emerald-500" />} bg="bg-emerald-50" />
                <StatCard title="Sự kiện chờ duyệt" value={statsData?.totalPendingEvents?.toLocaleString() || 0} icon={<CalendarClock size={24} className="text-amber-500" />} bg="bg-amber-50" />
                <StatCard title="Tổng Doanh thu" value={new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(statsData?.totalSystemRevenue || 0)} icon={<DollarSign size={24} className="text-primary" />} bg="bg-pink-50" />
            </div>


            {(isVenueFormOpen || editingVenueId) && (
                <section className={`bg-white border rounded-[24px] p-6 transition-all duration-300 ${editingVenueId ? 'border-primary ring-2 ring-primary/5' : 'border-slate-200'} animate-in slide-in-from-top duration-200`}>
                    <div className="border-b border-slate-100 pb-4 mb-5">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            {editingVenueId ? <Edit3 size={20} className="text-primary" /> : <PlusCircle size={20} className="text-primary" />}
                            {editingVenueId ? `Đang chỉnh sửa địa điểm: ${venueForm.name}` : "Khởi tạo Địa điểm (Venue) Hệ thống"}
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5 font-medium">
                            {editingVenueId ? "Thay đổi thông tin kĩ thuật tọa độ hoặc vị trí" : "Thêm địa điểm chính quy vào danh mục dùng chung toàn hệ thống"}
                        </p>
                    </div>

                    <form onSubmit={handleFormSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col">
                                <label className="text-[11px] uppercase font-bold text-slate-400 mb-1.5 ml-1 tracking-wide">Tên địa điểm *</label>
                                <input
                                    type="text"
                                    placeholder="VD: Nhà thi đấu Phú Thọ"
                                    value={venueForm.name}
                                    onChange={(e) => setVenueForm({ ...venueForm, name: e.target.value })}
                                    className="border border-slate-200 rounded-xl p-3 bg-slate-50 text-sm font-medium focus:outline-none focus:border-primary focus:bg-white transition-all text-slate-700"
                                />
                            </div>

                            <div className="flex flex-col">
                                <label className="text-[11px] uppercase font-bold text-slate-400 mb-1.5 ml-1 tracking-wide">Địa chỉ chi tiết *</label>
                                <input
                                    type="text"
                                    placeholder="VD: 1 Lữ Gia, Phường 15, Quận 11, TP. HCM"
                                    value={venueForm.address}
                                    onChange={(e) => setVenueForm({ ...venueForm, address: e.target.value })}
                                    className="border border-slate-200 rounded-xl p-3 bg-slate-50 text-sm font-medium focus:outline-none focus:border-primary focus:bg-white transition-all text-slate-700"
                                />
                            </div>

                            <div className="flex flex-col">
                                <label className="text-[11px] uppercase font-bold text-slate-400 mb-1.5 ml-1 tracking-wide">Thành phố / Tỉnh *</label>
                                <input
                                    type="text"
                                    placeholder="VD: Hồ Chí Minh hoặc Hà Nội"
                                    value={venueForm.city}
                                    onChange={(e) => setVenueForm({ ...venueForm, city: e.target.value })}
                                    className="border border-slate-200 rounded-xl p-3 bg-slate-50 text-sm font-medium focus:outline-none focus:border-primary focus:bg-white transition-all text-slate-700"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                            <div className="flex flex-col md:col-span-1">
                                <label className="text-[11px] uppercase font-bold text-slate-400 mb-1.5 ml-1 tracking-wide">Vĩ độ (Latitude)</label>
                                <input
                                    type="number"
                                    step="any"
                                    placeholder="VD: 10.771"
                                    value={venueForm.latitude}
                                    onChange={(e) => setVenueForm({ ...venueForm, latitude: e.target.value })}
                                    className="border border-slate-200 rounded-xl p-3 bg-slate-50 text-sm font-medium focus:outline-none focus:border-primary focus:bg-white transition-all font-mono text-slate-700"
                                />
                            </div>

                            <div className="flex flex-col md:col-span-1">
                                <label className="text-[11px] uppercase font-bold text-slate-400 mb-1.5 ml-1 tracking-wide">Kinh độ (Longitude)</label>
                                <input
                                    type="number"
                                    step="any"
                                    placeholder="VD: 106.657"
                                    value={venueForm.longitude}
                                    onChange={(e) => setVenueForm({ ...venueForm, longitude: e.target.value })}
                                    className="border border-slate-200 rounded-xl p-3 bg-slate-50 text-sm font-medium focus:outline-none focus:border-primary focus:bg-white transition-all font-mono text-slate-700"
                                />
                            </div>

                            <div className="flex gap-2 md:col-span-2 w-full">
                                <button
                                    type="button"
                                    onClick={handleCancelEdit}
                                    className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-sm h-[46px] rounded-xl transition-all border-none cursor-pointer"
                                >
                                    Hủy bỏ
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 text-white bg-primary hover:opacity-90 font-bold text-sm h-[46px] rounded-xl transition-all border-none cursor-pointer"
                                >
                                    {editingVenueId ? "Lưu cập nhật" : "Thành công & Tạo ngay"}
                                </button>
                            </div>
                        </div>
                    </form>
                </section>
            )}

            {/* BẢNG XỂU DUYỆT TÀI KHOẢN ORGANIZER */}
            <section className="bg-white border border-slate-200 rounded-[24px] overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
                    <h2 className="text-lg font-bold text-slate-800">Yêu cầu mở tài khoản Ban Tổ Chức</h2>
                    <span className="bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1 rounded-md">{orgPagination?.totalDocs || 0} đang chờ</span>
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
                                <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic font-medium">Không có yêu cầu tài khoản nào đang chờ xử lý.</td></tr>
                            ) : (
                                pendingOrganizers.map((org: any) => (
                                    <tr key={org._id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4 font-bold text-slate-800">{org.first_name} {org.last_name}</td>
                                        <td className="px-6 py-4 text-sm font-medium text-slate-600">{org.email}</td>
                                        <td className="px-6 py-4 text-sm font-medium text-slate-500">{new Date(org.createdAt || org.created_at || Date.now()).toLocaleDateString('vi-VN')}</td>
                                        <td className="px-6 py-4 flex justify-end gap-2">
                                            <button onClick={() => { if (window.confirm('Từ chối và xóa tài khoản này?')) rejectOrgMutation.mutate(org._id); }} className="px-3 py-2 text-red-500 hover:bg-red-50 font-bold text-xs rounded-lg transition-colors border-none bg-transparent cursor-pointer"><XCircle size={15} /> Từ chối</button>
                                            <button onClick={() => { if (window.confirm('Cấp quyền Organizer cho tài khoản này?')) verifyOrgMutation.mutate(org._id); }} className="px-3 py-2 text-emerald-600 hover:bg-emerald-50 font-bold text-xs rounded-lg transition-colors border-none bg-transparent cursor-pointer"><CheckCircle size={15} /> Phê duyệt</button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {orgPagination && orgPagination.totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/20">
                        <span className="text-xs text-slate-400 font-medium">Trang {orgPagination.page} / {orgPagination.totalPages}</span>
                        <div className="flex items-center gap-1">
                            <button onClick={() => setOrgPage(p => Math.max(p - 1, 1))} disabled={!orgPagination.hasPrevPage} className="p-1.5 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors cursor-pointer"><ChevronLeft size={16} /></button>
                            <button onClick={() => setOrgPage(p => Math.min(p + 1, orgPagination.totalPages))} disabled={!orgPagination.hasNextPage} className="p-1.5 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors cursor-pointer"><ChevronRight size={16} /></button>
                        </div>
                    </div>
                )}
            </section>

            {/* BẢNG TỔNG QUAN DANH SÁCH ĐỊA ĐIỂM */}
            <section className="bg-white border border-slate-200 rounded-[24px] overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">Quản lý danh sách Địa điểm (Venues)</h2>
                        <p className="text-xs text-slate-400 mt-0.5 font-medium">Danh mục toàn bộ các sân bãi, nhà thi đấu, trung tâm hội nghị khả dụng</p>
                    </div>

                    {/* 🌟 CỤM ĐIỀU KHIỂN: GỒM BADGE SỐ LƯỢNG VÀ NÚT TẠO MỚI PHẲNG MỊN */}
                    <div className="flex items-center gap-4">
                        <span className="bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1 rounded-md">{venuePagination?.totalDocs || 0} tổng số</span>
                        <button
                            type="button"
                            onClick={() => {
                                setEditingVenueId(null);
                                setVenueForm({ name: '', address: '', latitude: '', longitude: '', city: '' });
                                setIsVenueFormOpen(true);
                            }}
                            className="bg-primary hover:opacity-90 text-white font-bold text-xs h-9 px-4 rounded-xl transition-all border-none flex items-center gap-1.5 cursor-pointer"
                        >
                            <PlusCircle size={14} /> Thêm địa điểm mới
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400 font-bold bg-slate-50/30">
                                <th className="px-6 py-4">Tên Địa Điểm</th>
                                <th className="px-6 py-4">Địa Chỉ Chi Tiết</th>
                                <th className="px-6 py-4">Trạng thái</th>
                                <th className="px-6 py-4 text-right">Hành Động</th>
                            </tr>
                        </thead>
                        <tbody>
                            {allVenues.length === 0 ? (
                                <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic font-medium">Hệ thống chưa ghi nhận bất kỳ địa điểm nào.</td></tr>
                            ) : (
                                allVenues.map((venue: any) => (
                                    <tr key={venue._id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4 font-bold text-slate-800 flex items-center gap-2">
                                            <MapPin size={15} className="text-primary/70 shrink-0" /> {venue.name}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium text-slate-600 max-w-xs truncate">{venue.address}</td>
                                        <td className="px-6 py-4 text-xs font-bold">
                                            {venue.is_verified ? (
                                                <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded">Hệ thống</span>
                                            ) : (
                                                <span className="text-amber-600 bg-amber-50 px-2 py-1 rounded">Đối tác đề xuất</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 flex justify-end gap-3">
                                            {!venue.is_verified && (
                                                <button
                                                    onClick={() => { if (window.confirm(`Xác nhận duyệt địa điểm "${venue.name}"?`)) verifyVenueMutation.mutate(venue._id); }}
                                                    className="text-emerald-600 hover:bg-emerald-50 p-1.5 rounded-lg border-none bg-transparent cursor-pointer transition-colors"
                                                    title="Duyệt địa điểm"
                                                >
                                                    <CheckCircle size={16} />
                                                </button>
                                            )}

                                            <button
                                                onClick={() => handleStartEdit(venue)}
                                                className="text-blue-500 hover:bg-blue-50 p-1.5 rounded-lg border-none bg-transparent cursor-pointer transition-colors"
                                                title="Sửa địa điểm"
                                            >
                                                <Edit3 size={16} />
                                            </button>

                                            <button
                                                onClick={() => {
                                                    if (window.confirm(`Bạn có chắc chắn muốn XÓA VĨNH VIỄN địa điểm "${venue.name}"?`)) {
                                                        deleteVenueMutation.mutate(venue._id);
                                                    }
                                                }}
                                                className="text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg border-none bg-transparent cursor-pointer transition-colors"
                                                title="Xóa địa điểm"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {venuePagination && venuePagination.totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/20">
                        <span className="text-xs text-slate-400 font-medium">Trang {venuePagination.page} / {venuePagination.totalPages}</span>
                        <div className="flex items-center gap-1">
                            <button onClick={() => setVenuePage(p => Math.max(p - 1, 1))} disabled={!venuePagination.hasPrevPage} className="p-1.5 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors cursor-pointer"><ChevronLeft size={16} /></button>
                            <button onClick={() => setVenuePage(p => Math.min(p + 1, venuePagination.totalPages))} disabled={!venuePagination.hasNextPage} className="p-1.5 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors cursor-pointer"><ChevronRight size={16} /></button>
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
}

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