import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, Mail, Phone, Plus, ShieldCheck, Trash2, UserCog, Users } from 'lucide-react';
import { api } from '@/lib/axiosClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const emptyForm = { first_name: '', last_name: '', email: '', phone: '', password: '' };
const formatDateTime = (value?: string) => value ? new Date(value).toLocaleString('vi-VN') : '-';

export default function OrganizerStaff() {
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState(emptyForm);
    const [selectedStaffId, setSelectedStaffId] = useState('');
    const [selectedEventId, setSelectedEventId] = useState('');
    const [selectedShowId, setSelectedShowId] = useState('');
    const [error, setError] = useState('');

    const { data: staffData, isLoading, isError } = useQuery({
        queryKey: ['organizer-staffs', page],
        queryFn: async () => {
            const res = await api.get('/organizer/staffs', { params: { page, limit: 10 } });
            return res.data;
        },
    });

    const { data: eventsData } = useQuery({
        queryKey: ['organizer-events-for-staff'],
        queryFn: async () => {
            const res = await api.get('/organizer/events', { params: { page: 1, limit: 100 } });
            return res.data?.data || [];
        },
    });

    const { data: showsData } = useQuery({
        queryKey: ['organizer-shows-for-staff', selectedEventId],
        enabled: Boolean(selectedEventId),
        queryFn: async () => {
            const res = await api.get(`/organizer/events/${selectedEventId}/shows`, { params: { page: 1, limit: 100 } });
            return res.data?.docs || res.data?.data || [];
        },
    });

    const staffs = staffData?.docs || [];
    const totalPages = staffData?.totalPages || 1;
    const events = eventsData || [];
    const shows = showsData || [];
    const selectedStaff = useMemo(() => staffs.find((staff: any) => staff._id === selectedStaffId), [staffs, selectedStaffId]);

    const createStaffMutation = useMutation({
        mutationFn: async () => api.post('/organizer/staff', formData),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['organizer-staffs'] });
            setFormData(emptyForm);
            setError('');
            setIsModalOpen(false);
        },
        onError: (err: any) => setError(err.response?.data?.message || 'Không thể tạo nhân viên.'),
    });

    const assignMutation = useMutation({
        mutationFn: async () => api.post(`/organizer/shows/${selectedShowId}/assign-staff`, { staff_id: selectedStaffId, show_id: selectedShowId }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['organizer-staffs'] });
            setSelectedShowId('');
        },
    });

    const removeMutation = useMutation({
        mutationFn: async ({ staffId, showId }: { staffId: string; showId: string }) => api.post(`/organizer/shows/${showId}/remove-staff`, { staff_id: staffId, show_id: showId }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['organizer-staffs'] }),
    });

    const handleCreateStaff = (e: FormEvent) => {
        e.preventDefault();
        setError('');
        createStaffMutation.mutate();
    };

    const handleAssign = () => {
        if (!selectedStaffId || !selectedShowId) return;
        assignMutation.mutate();
    };

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3"><UserCog className="text-primary" /> Quản lý staff scanner</h1>
                    <p className="text-slate-500 mt-1 font-medium">
                        Cấp tài khoản nhân viên, phân công show được phép quét và theo dõi phạm vi làm việc của từng staff.
                    </p>
                </div>
                <Button onClick={() => setIsModalOpen(true)} className="gap-2 bg-primary text-white hover:bg-primary/90"><Plus size={18} /> Tạo nhân viên</Button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <Card className="xl:col-span-2 border-slate-200 rounded-2xl shadow-none overflow-hidden">
                    <CardHeader className="border-b border-slate-100 flex flex-row items-center justify-between">
                        <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2"><Users size={18} /> Danh sách nhân viên</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[880px] text-sm">
                                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-100">
                                    <tr>
                                        <th className="text-left px-6 py-4">Nhân viên</th>
                                        <th className="text-left px-6 py-4">Liên hệ</th>
                                        <th className="text-left px-6 py-4">Số show được gán</th>
                                        <th className="text-left px-6 py-4">Ngày tạo</th>
                                        <th className="text-right px-6 py-4">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {isLoading ? (
                                        <tr><td colSpan={5} className="py-10 text-center text-slate-400">Đang tải danh sách nhân viên...</td></tr>
                                    ) : isError ? (
                                        <tr><td colSpan={5} className="py-10 text-center text-rose-600 font-semibold">Không thể tải nhân viên.</td></tr>
                                    ) : staffs.length === 0 ? (
                                        <tr><td colSpan={5} className="py-10 text-center text-slate-400">Chưa có staff scanner nào.</td></tr>
                                    ) : staffs.map((staff: any) => (
                                        <tr key={staff._id} className={`hover:bg-slate-50/70 ${selectedStaffId === staff._id ? 'bg-primary/5' : ''}`}>
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-slate-800">{staff.last_name} {staff.first_name}</div>
                                                <div className="text-xs text-slate-500 flex items-center gap-1 mt-1"><ShieldCheck size={13} /> Staff scanner</div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">
                                                <div className="flex items-center gap-2"><Mail size={14} /> {staff.email}</div>
                                                <div className="flex items-center gap-2 mt-1 text-xs text-slate-500"><Phone size={13} /> {staff.phone || '-'}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">{staff.assigned_show_ids?.length || 0} show</span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-500">{formatDateTime(staff.created_at || staff.createdAt)}</td>
                                            <td className="px-6 py-4 text-right">
                                                <Button variant="outline" size="sm" onClick={() => setSelectedStaffId(staff._id)}>Phân công</Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="flex justify-end gap-2 p-4 border-t border-slate-100">
                            <Button variant="outline" disabled={page <= 1} onClick={() => setPage((prev) => prev - 1)}>Trước</Button>
                            <div className="px-3 py-2 text-sm font-medium text-slate-500">Trang {page} / {totalPages}</div>
                            <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((prev) => prev + 1)}>Sau</Button>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 rounded-2xl shadow-none h-fit">
                    <CardHeader className="border-b border-slate-100">
                        <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2"><CalendarPlus size={18} /> Phân công show</CardTitle>
                    </CardHeader>
                    <CardContent className="p-5 space-y-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Nhân viên</label>
                            <select value={selectedStaffId} onChange={(e) => setSelectedStaffId(e.target.value)} className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-primary">
                                <option value="">Chọn nhân viên</option>
                                {staffs.map((staff: any) => <option key={staff._id} value={staff._id}>{staff.last_name} {staff.first_name} </option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Sự kiện</label>
                            <select value={selectedEventId} onChange={(e) => { setSelectedEventId(e.target.value); setSelectedShowId(''); }} className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-primary">
                                <option value="">Chọn sự kiện</option>
                                {events.map((event: any) => <option key={event._id} value={event._id}>{event.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Show</label>
                            <select value={selectedShowId} onChange={(e) => setSelectedShowId(e.target.value)} disabled={!selectedEventId} className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-primary disabled:bg-slate-50">
                                <option value="">Chọn show</option>
                                {shows.map((show: any) => <option key={show._id} value={show._id}>{show.name} - {formatDateTime(show.start_time)}</option>)}
                            </select>
                        </div>
                        <Button onClick={handleAssign} disabled={!selectedStaffId || !selectedShowId || assignMutation.isPending} className="w-full bg-primary text-white hover:bg-primary/90">
                            {assignMutation.isPending ? 'Đang gán...' : 'Gán staff vào show'}
                        </Button>

                        {selectedStaff && (
                            <div className="pt-4 border-t border-slate-100">
                                <div className="text-xs font-bold text-slate-500 uppercase mb-2">Show đã gán</div>
                                <div className="space-y-2 max-h-[260px] overflow-auto pr-1">
                                    {(selectedStaff.assigned_show_ids || []).length === 0 ? (
                                        <p className="text-sm text-slate-400">Nhân viên này chưa được phân công show.</p>
                                    ) : selectedStaff.assigned_show_ids.map((show: any) => {
                                        const showId = typeof show === 'string' ? show : show._id;
                                        const showName = typeof show === 'string' ? show : show.name;
                                        return (
                                            <div key={showId} className="flex items-center justify-between gap-2 border border-slate-100 rounded-xl p-2">
                                                <div className="text-sm font-medium text-slate-700 truncate">{showName}</div>
                                                <button onClick={() => removeMutation.mutate({ staffId: selectedStaff._id, showId })} className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600" title="Rút khỏi show">
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <Card className="w-full max-w-md rounded-2xl shadow-xl">
                        <CardHeader><CardTitle className="text-lg font-bold text-slate-800">Cấp tài khoản Staff mới</CardTitle></CardHeader>
                        <CardContent>
                            <form onSubmit={handleCreateStaff} className="space-y-4">
                                {error && <p className="text-xs font-bold text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-100">{error}</p>}
                                <div className="grid grid-cols-2 gap-3">
                                    <input required placeholder="Họ" value={formData.last_name} onChange={e => setFormData({ ...formData, last_name: e.target.value })} className="border border-slate-200 px-3 py-2 rounded-xl text-sm focus:outline-primary" />
                                    <input required placeholder="Tên" value={formData.first_name} onChange={e => setFormData({ ...formData, first_name: e.target.value })} className="border border-slate-200 px-3 py-2 rounded-xl text-sm focus:outline-primary" />
                                </div>
                                <input required type="email" placeholder="Email đăng nhập" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full border border-slate-200 px-3 py-2 rounded-xl text-sm focus:outline-primary" />
                                <input required type="tel" placeholder="Số điện thoại" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full border border-slate-200 px-3 py-2 rounded-xl text-sm focus:outline-primary" />
                                <input required type="password" placeholder="Mật khẩu ban đầu" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} className="w-full border border-slate-200 px-3 py-2 rounded-xl text-sm focus:outline-primary" />
                                <div className="flex justify-end gap-2 pt-2">
                                    <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Hủy</Button>
                                    <Button type="submit" disabled={createStaffMutation.isPending} className="bg-primary text-white hover:bg-primary/90">{createStaffMutation.isPending ? 'Đang tạo...' : 'Tạo tài khoản'}</Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
