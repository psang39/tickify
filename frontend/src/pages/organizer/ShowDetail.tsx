import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, API_BASE_URL } from '@/lib/axiosClient';
import { ErrorModal } from '@/components/shared/ErrorModal';
import { LoadingOverlay } from '@/components/shared/LoadingOverlay';
import { useFeedbackStore } from '@/store/useFeedbackStore';
import {
    ArrowLeft, Save, X, MapPin, Calendar, CheckCircle2,
    UploadCloud, EyeOff, Globe, Ban, Info, Clock, Ticket,
    Users, Radio, Activity, Pencil, Loader2
} from 'lucide-react';

type TicketTypeForm = {
    name: string;
    price: string;
    target_tier: string;
    total_quantity: string;
    is_limited_promo: boolean;
    sale_start: string;
    sale_end: string;
};

const emptyTicketTypeForm: TicketTypeForm = {
    name: '',
    price: '',
    target_tier: '',
    total_quantity: '',
    is_limited_promo: false,
    sale_start: '',
    sale_end: ''
};

export default function ShowDetail() {
    const { eventId, showId } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [activeTab, setActiveTab] = useState<'CONFIG' | 'LIVE'>('CONFIG'); 
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const { showSuccess, showError } = useFeedbackStore();
    const [selectedStaffId, setSelectedStaffId] = useState<string>(''); 
    const [ticketTypeForm, setTicketTypeForm] = useState<TicketTypeForm>(emptyTicketTypeForm);
    const [editingTicketTypeId, setEditingTicketTypeId] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        start_time: '',
        end_time: '',
        sale_start: '',
        sale_end: '',
        venue_id: '',
        stadium_map_svg: ''
    });

    const [currentStatus, setCurrentStatus] = useState<'draft' | 'published' | 'cancelled'>('draft');
    const [venueSearch, setVenueSearch] = useState('');
    const [isVenueDropdownOpen, setIsVenueDropdownOpen] = useState(false);

    const [isCreatingNewVenue, setIsCreatingNewVenue] = useState(false);
    const [newVenueForm, setNewVenueForm] = useState({
        name: '',
        address: '',
        latitude: '',
        longitude: ''
    });

    
    const [liveMonitor, setLiveMonitor] = useState({
        activeUsers: 0,
        holdingSeats: 0,
        totalRevenue: 0,
        ticketsSoldLastMinute: 0,
        status: 'Đang kết nối...'
    });

    useEffect(() => {
        if (!showId || activeTab !== 'LIVE') return;

        const eventSource = new EventSource(`${API_BASE_URL}/organizer/sse/dashboard/${showId}`,
            { withCredentials: true }
        );

        eventSource.onopen = () => {
            setLiveMonitor(prev => ({ ...prev, status: 'Live' }));
        };

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                setLiveMonitor(prev => ({
                    ...prev,
                    activeUsers: data.activeUsers ?? data.active_viewers ?? prev.activeUsers,
                    holdingSeats: data.holdingCount ?? data.holding_seats ?? prev.holdingSeats,
                    totalRevenue: data.totalRevenue ?? data.total_revenue ?? prev.totalRevenue,
                    ticketsSoldLastMinute: data.soldCount ?? data.tickets_sold ?? prev.ticketsSoldLastMinute,
                    status: data.timestamp
                        ? `Live • ${new Date(data.timestamp).toLocaleTimeString('vi-VN')}`
                        : 'Live'
                }));
            } catch (error) {
                console.error("Lỗi phân tích dữ liệu SSE:", error);
            }
        };

        eventSource.onerror = () => {
            setLiveMonitor(prev => ({ ...prev, status: 'Mất kết nối ⚪' }));
        };

        return () => {
            eventSource.close();
        };
    }, [showId, activeTab]);

    const { data: showData, isLoading: isLoadingShow } = useQuery({
        queryKey: ['organizer-show-detail', showId],
        queryFn: async () => {
            const response = await api.get(`/organizer/shows/${showId}`);
            return response.data?.data || response.data;
        },
        enabled: !!showId
    });

    const { data: ticketTypesData = [], isLoading: isLoadingTicketTypes } = useQuery({
        queryKey: ['organizer-show-ticket-types', showId],
        queryFn: async () => {
            const response = await api.get(`/organizer/shows/${showId}/ticket-types`);
            return response.data?.data || response.data || [];
        },
        enabled: !!showId
    });
    const ticketTypes = Array.isArray(ticketTypesData) ? ticketTypesData : [];

    const { data: venuesData = [] } = useQuery({
        queryKey: ['venues', venueSearch],
        queryFn: async () => {
            if (isCreatingNewVenue) return [];

            const response = await api.get(`/venues`, {
                params: {
                    search: venueSearch,
                    limit: 20
                }
            });
            return response.data?.data || response.data || [];
        }
    });
    const venues = Array.isArray(venuesData) ? venuesData : [];

    const { data: staffListData } = useQuery({
        queryKey: ['organizer-staffs-list'],
        queryFn: async () => {
            const response = await api.get('/organizer/staffs', { params: { limit: 100 } });
            return response.data?.docs || response.data || [];
        }
    });

    
    const staffList = Array.isArray(staffListData) ? staffListData : [];
    const assignedStaff = staffList.filter((s: any) => s.assigned_show_ids?.includes(showId));
    const availableStaff = staffList.filter((s: any) => !s.assigned_show_ids?.includes(showId));

    const formatDateTimeLocal = (isoString?: string) => {
        if (!isoString) return '';
        return new Date(isoString).toISOString().slice(0, 16);
    };

    useEffect(() => {
        if (showData && showData.show_info) {
            const info = showData.show_info;
            setFormData({
                name: info.name || '',
                description: info.description || '',
                start_time: formatDateTimeLocal(info.start_time),
                end_time: formatDateTimeLocal(info.end_time),
                sale_start: formatDateTimeLocal(info.sale_start),
                sale_end: formatDateTimeLocal(info.sale_end),
                venue_id: info.venue_id?._id || info.venue_id || '',
                stadium_map_svg: info.stadium_map_svg || ''
            });
            setCurrentStatus(info.status || 'draft');
            if (info.venue_id?.name) setVenueSearch(info.venue_id.name);
        }
    }, [showData]);

    
    const { mutateAsync: suggestVenueMutation, isPending: isSuggestingVenue } = useMutation({
        mutationFn: async (newVenueData: any) => {
            const response = await api.post('/venues', newVenueData);
            return response.data?.data || response.data;
        },
        onSuccess: (newVenue) => {
            queryClient.invalidateQueries({ queryKey: ['venues'] });
            setFormData(prev => ({ ...prev, venue_id: newVenue._id }));
            setVenueSearch(newVenue.name);
            setIsCreatingNewVenue(false);
            setNewVenueForm({ name: '', address: '', latitude: '', longitude: '' });
            showSuccess(`Đã gửi đề xuất địa điểm "${newVenue.name}". Bạn có thể tiếp tục cấu hình thông tin Show.`);
        },
        onError: (error: any) => {
            setErrorMessage(error.response?.data?.message || "Không thể khởi tạo đề xuất địa điểm.");
        }
    });

    const { mutateAsync: updateShowMutation, isPending: isUpdating } = useMutation({
        mutationFn: async (updatedData: any) => { return (await api.put(`/organizer/shows/${showId}`, updatedData)).data; },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['organizer-show-detail', showId] });
            showSuccess("Cập nhật thông tin Show thành công.");
        },
        onError: (err: any) => setErrorMessage(err.response?.data?.message || "Lỗi cập nhật Show.")
    });

    const { mutateAsync: publishShowMutation, isPending: isPublishing } = useMutation({
        mutationFn: async () => { return (await api.post(`/organizer/shows/${showId}/publish`)).data; },
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['organizer-show-detail', showId] }); showSuccess("Mở bán thành công."); },
        onError: (err: any) => setErrorMessage(err.response?.data?.message || "Lỗi kích hoạt show.")
    });

    const { mutateAsync: unpublishShowMutation, isPending: isUnpublishing } = useMutation({
        mutationFn: async () => { return (await api.post(`/organizer/shows/${showId}/unpublish`)).data; },
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['organizer-show-detail', showId] }); showSuccess("Đã tạm dừng bán vé."); },
        onError: (err: any) => setErrorMessage(err.response?.data?.message || "Lỗi tạm dừng.")
    });

    const { mutateAsync: cancelShowMutation, isPending: isCancelling } = useMutation({
        mutationFn: async () => { return (await api.post(`/organizer/shows/${showId}/cancel`)).data; },
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['organizer-show-detail', showId] }); showSuccess("Đã hủy đêm diễn."); },
        onError: (err: any) => setErrorMessage(err.response?.data?.message || "Lỗi hủy show.")
    });

    const { mutateAsync: assignStaffMutation } = useMutation({
        mutationFn: async (staffId: string) => { return await api.post(`organizer/shows/${showId}/assign-staff`, { staff_id: staffId, show_id: showId }); },
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['organizer-staffs-list'] }); setSelectedStaffId(''); },
        onError: (err: any) => setErrorMessage(err.response?.data?.message || "Không thể gán nhân viên.")
    });

    const { mutateAsync: removeStaffMutation } = useMutation({
        mutationFn: async (staffId: string) => { return await api.post(`/organizer/shows/${showId}/remove-staff`, { staff_id: staffId, show_id: showId }); },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['organizer-staffs-list'] }),
        onError: (err: any) => setErrorMessage(err.response?.data?.message || "Không thể rút nhân viên.")
    });

    const invalidateTicketTypes = () => {
        queryClient.invalidateQueries({ queryKey: ['organizer-show-ticket-types', showId] });
        queryClient.invalidateQueries({ queryKey: ['organizer-show-detail', showId] });
    };

    const resetTicketTypeForm = () => {
        setTicketTypeForm(emptyTicketTypeForm);
        setEditingTicketTypeId(null);
    };

    const buildTicketTypePayload = () => ({
        name: ticketTypeForm.name.trim(),
        price: Number(ticketTypeForm.price),
        target_tier: ticketTypeForm.target_tier.trim() || undefined,
        total_quantity: ticketTypeForm.total_quantity === '' ? null : Number(ticketTypeForm.total_quantity),
        is_limited_promo: ticketTypeForm.is_limited_promo,
        sale_start: ticketTypeForm.sale_start || undefined,
        sale_end: ticketTypeForm.sale_end || undefined
    });

    const { mutateAsync: updateTicketTypeMutation, isPending: isUpdatingTicketType } = useMutation({
        mutationFn: async ({ ticketTypeId, payload }: { ticketTypeId: string; payload: any }) => (
            await api.put(`/organizer/shows/${showId}/ticket-types/${ticketTypeId}`, payload)
        ).data,
        onSuccess: () => {
            invalidateTicketTypes();
            resetTicketTypeForm();
            showSuccess('Đã cập nhật loại vé.');
        },
        onError: (err: any) => setErrorMessage(err.response?.data?.message || 'Không thể cập nhật loại vé.')
    });

    const handleSubmitTicketType = async () => {
        if (currentStatus === 'published' || currentStatus === 'cancelled') {
            setErrorMessage('Vui lòng tạm dừng bán vé trước khi chỉnh loại vé.');
            return;
        }
        if (!ticketTypeForm.name.trim() || Number(ticketTypeForm.price) <= 0) {
            setErrorMessage('Tên loại vé và giá vé phải hợp lệ.');
            return;
        }
        if (ticketTypeForm.total_quantity && Number(ticketTypeForm.total_quantity) < 0) {
            setErrorMessage('Số lượng giới hạn không được âm.');
            return;
        }
        if (!editingTicketTypeId) {
            setErrorMessage('Loại vé được sinh từ SVG/show controller. Vui lòng chọn một loại vé trong danh sách để chỉnh sửa.');
            return;
        }
        const payload = buildTicketTypePayload();
        await updateTicketTypeMutation({ ticketTypeId: editingTicketTypeId, payload });
    };

    const startEditTicketType = (ticketType: any) => {
        setEditingTicketTypeId(ticketType._id);
        setTicketTypeForm({
            name: ticketType.name || '',
            price: ticketType.price?.toString() || '',
            target_tier: ticketType.target_tier || '',
            total_quantity: ticketType.total_quantity === null || ticketType.total_quantity === undefined ? '' : ticketType.total_quantity.toString(),
            is_limited_promo: Boolean(ticketType.is_limited_promo),
            sale_start: formatDateTimeLocal(ticketType.sale_start),
            sale_end: formatDateTimeLocal(ticketType.sale_end)
        });
    };

    const handleUpdateShow = async () => {
        if (!formData.start_time || !formData.end_time || !formData.sale_start || !formData.sale_end || !formData.venue_id) {
            setErrorMessage("Vui lòng điền đầy đủ thông tin và địa điểm.");
            return;
        }
        await updateShowMutation(formData);
    };

    const handleSVGUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file?.type === "image/svg+xml" || file?.name.endsWith('.svg')) {
            const reader = new FileReader();
            reader.onload = (ev) => setFormData(prev => ({ ...prev, stadium_map_svg: ev.target?.result as string }));
            reader.readAsText(file);
        } else {
            setErrorMessage("Vui lòng tải lên file định dạng .svg");
        }
    };

    const filteredVenues = venues.filter((v: any) => v.name.toLowerCase().includes(venueSearch.toLowerCase()));
    const isTicketTypePending = isUpdatingTicketType;
    const isTicketTypeLocked = currentStatus === 'published' || currentStatus === 'cancelled';
    const isAnyActionPending = isUpdating || isPublishing || isUnpublishing || isCancelling || isSuggestingVenue || isTicketTypePending;

    if (isLoadingShow) return <LoadingOverlay isVisible={true} message="Đang tải cấu hình Show..." />;
    if (!showData) return <div className="min-h-screen flex items-center justify-center font-bold text-red-500">Không tìm thấy dữ liệu đêm diễn!</div>;

    const currentVenueData = venues.find((v: any) => v._id === formData.venue_id);
    const isVenueVerified = currentVenueData ? currentVenueData.is_verified : true;

    return (
        <div className="min-h-screen bg-[#F8F9FA] relative pb-24 font-sans w-full overflow-x-hidden">
            <LoadingOverlay isVisible={isAnyActionPending} message="Đang xử lý thao tác..." />
            <ErrorModal message={errorMessage} onClose={() => setErrorMessage(null)} />

            
            <div className="bg-white border-b border-gray-200 px-6 lg:px-12 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-40">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate(`/organizer/events/${eventId}`, { state: { activeTab: 'SHOWS' } })}
                        className="p-2.5 rounded-full hover:bg-slate-100 text-slate-500 transition-colors border border-slate-200"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">{formData.name || 'Đang cập nhật...'}</h1>
                        <p className="text-sm text-slate-500 mt-0.5">ID Đêm diễn: <span className="font-mono font-bold text-xs bg-slate-100 px-1.5 py-0.5 rounded">{showId}</span></p>
                    </div>
                </div>

                
                <div className="flex bg-slate-100 p-1 rounded-xl self-start md:self-center border border-slate-200">
                    <button
                        onClick={() => setActiveTab('CONFIG')}
                        className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'CONFIG' ? 'bg-white text-primary' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                        <Info size={14} /> Cấu hình, Vé & Nhân sự
                    </button>
                    <button
                        onClick={() => setActiveTab('LIVE')}
                        className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'LIVE' ? 'bg-white text-primary' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                        <Radio size={14} className={activeTab === 'LIVE' && liveMonitor.status.includes('Live') ? "animate-pulse" : ""} /> Giám sát thời gian thực
                    </button>
                </div>

                
                <div className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-lg bg-slate-50 text-xs font-bold self-start md:self-center">
                    <span className="text-gray-400 uppercase">Trạng thái:</span>
                    {currentStatus === 'draft' && <span className="text-slate-600 flex items-center gap-1"><EyeOff size={13} /> Bản nháp</span>}
                    {currentStatus === 'published' && <span className="text-green-600 flex items-center gap-1"><Globe size={13} /> Đang mở bán</span>}
                    {currentStatus === 'cancelled' && <span className="text-red-600 flex items-center gap-1"><Ban size={13} /> Đã hủy</span>}
                </div>
            </div>

            
            
            
            {activeTab === 'CONFIG' && (
                <div className="w-full max-w-6xl mx-auto px-6 lg:px-12 mt-8 grid grid-cols-1 xl:grid-cols-3 gap-8 animate-in fade-in duration-150">

                    
                    <div className="xl:col-span-2 space-y-8">
                        {currentStatus === 'published' && (
                            <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-xl flex items-start gap-2.5 text-xs font-medium">
                                <Info size={16} className="shrink-0 mt-0.5" />
                                <span>Đêm diễn đang mở bán công khai. Để điều chỉnh thông số hoặc sơ đồ ghế, vui lòng click nút "Tạm dừng bán vé" dưới thanh công cụ.</span>
                            </div>
                        )}

                        {currentStatus === 'draft' && formData.venue_id && isVenueVerified === false && (
                            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl flex items-start gap-2.5 text-xs font-medium animate-in fade-in">
                                <Info size={16} className="shrink-0 mt-0.5 text-amber-600" />
                                <div className="space-y-1">
                                    <p className="font-bold">Địa điểm đề xuất chưa được xét duyệt!</p>
                                    <p>Địa điểm tổ chức này hiện tại đang trong trạng thái chờ Ban quản trị (Admin) kiểm định kỹ thuật sơ đồ ghế. Tính năng "Kích hoạt mở bán" dưới thanh công cụ sẽ bị khóa cho đến khi địa điểm được phê duyệt chính thức.</p>
                                </div>
                            </div>
                        )}

                        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-100">
                            <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2 border-b border-slate-50 pb-3"><Info className="text-primary" size={18} /> Thông tin cơ bản</h2>
                            <div className="space-y-5">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Tên Show diễn</label>
                                    <input type="text" disabled={currentStatus === 'published' || currentStatus === 'cancelled'} className="w-full bg-slate-50 border border-gray-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary font-medium text-slate-800 disabled:opacity-60" value={formData.name} placeholder="VD: Đêm diễn 1 - Hà Nội" onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Ghi chú đêm diễn (Tùy chọn)</label>
                                    <textarea rows={3} disabled={currentStatus === 'published' || currentStatus === 'cancelled'} className="w-full bg-slate-50 border border-gray-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary font-medium text-slate-600 resize-none disabled:opacity-60" value={formData.description} placeholder="Yêu cầu cổng soát vé hoặc ghi chú riêng..." onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-100">
                            <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2 border-b border-slate-50 pb-3"><Clock className="text-primary" size={18} /> Mốc lịch trình mở khóa</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-orange-50/40 border border-orange-100 p-4 rounded-xl space-y-4">
                                    <h3 className="font-bold text-orange-800 text-xs flex items-center gap-1.5"><Ticket size={14} /> Chiến dịch Bán vé</h3>
                                    <div>
                                        <label className="block text-[10px] font-bold text-orange-600 uppercase mb-1">Mở cổng thanh toán lúc</label>
                                        <input type="datetime-local" disabled={currentStatus === 'published' || currentStatus === 'cancelled'} className="w-full bg-white border border-orange-200 rounded-md p-2 text-xs font-medium disabled:opacity-60" value={formData.sale_start} onChange={(e) => setFormData({ ...formData, sale_start: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-orange-600 uppercase mb-1">Đóng cổng bán vé lúc</label>
                                        <input type="datetime-local" disabled={currentStatus === 'published' || currentStatus === 'cancelled'} className="w-full bg-white border border-orange-200 rounded-md p-2 text-xs font-medium disabled:opacity-60" value={formData.sale_end} onChange={(e) => setFormData({ ...formData, sale_end: e.target.value })} />
                                    </div>
                                </div>
                                <div className="bg-blue-50/40 border border-blue-100 p-4 rounded-xl space-y-4">
                                    <h3 className="font-bold text-blue-800 text-xs flex items-center gap-1.5"><Calendar size={14} /> Thời gian Tổ chức</h3>
                                    <div>
                                        <label className="block text-[10px] font-bold text-blue-600 uppercase mb-1">Thời gian Mở cổng sân</label>
                                        <input type="datetime-local" disabled={currentStatus === 'published' || currentStatus === 'cancelled'} className="w-full bg-white border border-blue-200 rounded-md p-2 text-xs font-medium disabled:opacity-60" value={formData.start_time} onChange={(e) => setFormData({ ...formData, start_time: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-blue-600 uppercase mb-1">Thời gian Bế mạc Show</label>
                                        <input type="datetime-local" disabled={currentStatus === 'published' || currentStatus === 'cancelled'} className="w-full bg-white border border-blue-200 rounded-md p-2 text-xs font-medium disabled:opacity-60" value={formData.end_time} onChange={(e) => setFormData({ ...formData, end_time: e.target.value })} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-100">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 border-b border-slate-50 pb-3">
                                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Ticket className="text-primary" size={18} /> Loại vé & giá bán</h2>
                                <div className="text-[11px] font-medium text-slate-400">
                                    {ticketTypes.length} loại vé đang cấu hình
                                </div>
                            </div>

                            {isTicketTypeLocked && (
                                <div className="mb-4 bg-slate-50 border border-slate-200 text-slate-600 p-3 rounded-xl flex items-start gap-2 text-xs font-medium">
                                    <Info size={15} className="shrink-0 mt-0.5" />
                                    <span>Show đang mở bán hoặc đã hủy nên không thể chỉnh giá vé. Hãy tạm dừng bán trước khi thay đổi cấu hình vé.</span>
                                </div>
                            )}

                            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
                                <div className="lg:col-span-2 bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                                            {editingTicketTypeId ? 'Chỉnh loại vé' : 'Thêm loại vé'}
                                        </h3>
                                        {editingTicketTypeId && (
                                            <button type="button" onClick={resetTicketTypeForm} className="text-[11px] font-bold text-slate-400 hover:text-slate-700">
                                                Hủy sửa
                                            </button>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tên loại vé *</label>
                                        <input
                                            type="text"
                                            disabled={isTicketTypeLocked}
                                            className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-medium outline-none focus:border-primary disabled:opacity-60"
                                            placeholder="VD: Vé thường, VIP, Early Bird"
                                            value={ticketTypeForm.name}
                                            onChange={(e) => setTicketTypeForm({ ...ticketTypeForm, name: e.target.value })}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Giá vé *</label>
                                            <input
                                                type="number"
                                                min={0}
                                                disabled={isTicketTypeLocked}
                                                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-medium outline-none focus:border-primary disabled:opacity-60"
                                                placeholder="500000"
                                                value={ticketTypeForm.price}
                                                onChange={(e) => setTicketTypeForm({ ...ticketTypeForm, price: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Hạng zone</label>
                                            <input
                                                type="text"
                                                disabled={isTicketTypeLocked}
                                                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-medium outline-none focus:border-primary disabled:opacity-60"
                                                placeholder="VIP/A/B"
                                                value={ticketTypeForm.target_tier}
                                                onChange={(e) => setTicketTypeForm({ ...ticketTypeForm, target_tier: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Số lượng giới hạn</label>
                                        <input
                                            type="number"
                                            min={0}
                                            disabled={isTicketTypeLocked}
                                            className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-medium outline-none focus:border-primary disabled:opacity-60"
                                            placeholder="Để trống nếu lấy theo sức chứa zone"
                                            value={ticketTypeForm.total_quantity}
                                            onChange={(e) => setTicketTypeForm({ ...ticketTypeForm, total_quantity: e.target.value })}
                                        />
                                    </div>

                                    <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            disabled={isTicketTypeLocked}
                                            checked={ticketTypeForm.is_limited_promo}
                                            onChange={(e) => setTicketTypeForm({ ...ticketTypeForm, is_limited_promo: e.target.checked })}
                                        />
                                        Vé khuyến mãi / mở bán giới hạn
                                    </label>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Mở bán riêng</label>
                                            <input
                                                type="datetime-local"
                                                disabled={isTicketTypeLocked}
                                                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-[11px] font-medium outline-none focus:border-primary disabled:opacity-60"
                                                value={ticketTypeForm.sale_start}
                                                onChange={(e) => setTicketTypeForm({ ...ticketTypeForm, sale_start: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Đóng bán riêng</label>
                                            <input
                                                type="datetime-local"
                                                disabled={isTicketTypeLocked}
                                                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-[11px] font-medium outline-none focus:border-primary disabled:opacity-60"
                                                value={ticketTypeForm.sale_end}
                                                onChange={(e) => setTicketTypeForm({ ...ticketTypeForm, sale_end: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <Button
                                        type="button"
                                        disabled={isTicketTypeLocked || isTicketTypePending}
                                        onClick={handleSubmitTicketType}
                                        className="w-full bg-primary hover:opacity-90 text-white font-bold text-xs rounded-lg border-none"
                                    >
                                        {isTicketTypePending ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Save size={14} className="mr-1" />}
                                        {editingTicketTypeId ? 'Lưu loại vé' : 'Chọn loại vé để chỉnh'}
                                    </Button>
                                </div>

                                <div className="lg:col-span-3 space-y-3">
                                    {isLoadingTicketTypes ? (
                                        <div className="p-6 border border-dashed border-slate-200 rounded-xl text-center text-xs font-bold text-slate-400">Đang tải loại vé...</div>
                                    ) : ticketTypes.length === 0 ? (
                                        <div className="p-6 border border-dashed border-slate-200 rounded-xl text-center text-xs font-bold text-slate-400">Chưa có loại vé nào. Hãy upload SVG/tạo show để hệ thống sinh loại vé tương ứng.</div>
                                    ) : (
                                        ticketTypes.map((ticketType: any) => (
                                            <div key={ticketType._id} className="border border-slate-100 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-primary/20 transition-colors">
                                                <div className="space-y-1 min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <h4 className="font-bold text-sm text-slate-800 truncate">{ticketType.name}</h4>
                                                        {ticketType.is_limited_promo && <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100 text-[10px] font-bold">Promo</span>}
                                                        {ticketType.target_tier && <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold">Tier {ticketType.target_tier}</span>}
                                                    </div>
                                                    <div className="text-xs text-slate-500 font-medium">
                                                        <span className="font-bold text-primary">{Number(ticketType.price || 0).toLocaleString('vi-VN')}đ</span>
                                                        <span className="mx-2 text-slate-300">•</span>
                                                        SL: {ticketType.total_quantity ?? 'Theo zone'}
                                                        <span className="mx-2 text-slate-300">•</span>
                                                        Đã bán: {ticketType.sold_quantity || 0}
                                                    </div>
                                                    {(ticketType.sale_start || ticketType.sale_end) && (
                                                        <div className="text-[11px] text-slate-400">
                                                            Khung bán riêng: {ticketType.sale_start ? new Date(ticketType.sale_start).toLocaleString('vi-VN') : 'Không giới hạn'} → {ticketType.sale_end ? new Date(ticketType.sale_end).toLocaleString('vi-VN') : 'Không giới hạn'}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-2 shrink-0">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        disabled={isTicketTypeLocked || isTicketTypePending}
                                                        onClick={() => startEditTicketType(ticketType)}
                                                        className="h-8 px-3 rounded-full text-xs font-bold border-slate-200"
                                                    >
                                                        <Pencil size={13} className="mr-1" /> Sửa
                                                    </Button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    
                    <div className="space-y-6">

                        
                        <div className="bg-white rounded-2xl p-6 border border-gray-100">
                            <h3 className="font-bold text-sm mb-3 text-slate-800 flex items-center gap-2">
                                <MapPin size={16} className="text-primary" /> Nơi tổ chức
                            </h3>

                            {!isCreatingNewVenue ? (
                                
                                <div className="space-y-4">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            disabled={currentStatus === 'published' || currentStatus === 'cancelled'}
                                            className="w-full border border-gray-200 rounded-lg py-2 px-3 outline-none focus:border-primary text-xs font-medium bg-slate-50 focus:bg-white disabled:opacity-60 transition-colors"
                                            placeholder="Lọc tìm kiếm Venue..."
                                            value={venueSearch}
                                            onChange={e => { setVenueSearch(e.target.value); setFormData({ ...formData, venue_id: '' }); setIsVenueDropdownOpen(true); }}
                                            onFocus={() => setIsVenueDropdownOpen(true)}
                                            onBlur={() => setTimeout(() => setIsVenueDropdownOpen(false), 200)}
                                        />
                                        {isVenueDropdownOpen && !['published', 'cancelled'].includes(currentStatus) && (
                                            <div className="absolute z-30 w-full mt-1 bg-white border border-slate-200 rounded-lg max-h-48 overflow-y-auto bg-white">
                                                {filteredVenues.map((venue: any) => (
                                                    <div key={venue._id} className="px-3 py-2.5 hover:bg-slate-50 cursor-pointer border-b border-gray-50 text-xs" onMouseDown={() => { setFormData({ ...formData, venue_id: venue._id }); setVenueSearch(venue.name); setIsVenueDropdownOpen(false); }}>
                                                        <div className="font-semibold text-gray-800">{venue.name} ({venue.city || 'Chưa rõ thành phố'})</div>
                                                        <div className="text-[10px] text-gray-400 mt-0.5 truncate">{venue.address}</div>
                                                    </div>
                                                ))}

                                                
                                                <div
                                                    className="px-3 py-2.5 hover:bg-slate-100 cursor-pointer border-t border-slate-100 text-[11px] font-bold text-primary text-center bg-slate-50/50 sticky bottom-0 z-10 transition-colors"
                                                    onMouseDown={() => setIsCreatingNewVenue(true)}
                                                >
                                                    Không thấy Venue bạn muốn? Hãy tạo ngay!
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    {formData.venue_id && (
                                        <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-start gap-2 text-slate-600 animate-in fade-in">
                                            <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-primary" />
                                            <span className="text-[11px] font-medium leading-relaxed">
                                                {isVenueVerified === false ? (
                                                    <span className="text-amber-600 font-bold">Địa điểm do bạn tự đề xuất đang chờ duyệt. Đêm diễn tạm thời khóa mở bán.</span>
                                                ) : (
                                                    <span className="text-slate-500">Đã chốt địa điểm chính quy hệ thống. Sơ đồ ghế sẽ đồng bộ theo hạ tầng cơ sở này.</span>
                                                )}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-4 animate-in fade-in duration-200">
                                    <div className="flex justify-between items-center border-b border-slate-50 pb-1.5">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Đề xuất địa điểm mới</span>
                                        <button
                                            type="button"
                                            onClick={() => setIsCreatingNewVenue(false)}
                                            className="text-[11px] font-bold text-primary hover:opacity-80 transition-opacity underline bg-transparent border-none p-0 cursor-pointer"
                                        >
                                            Chọn địa điểm có sẵn?
                                        </button>
                                    </div>

                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1 block">Tên địa điểm *</label>
                                            <input
                                                type="text"
                                                placeholder="VD: Hội trường Trung tâm Văn hóa"
                                                value={newVenueForm.name}
                                                onChange={(e) => setNewVenueForm({ ...newVenueForm, name: e.target.value })}
                                                className="w-full border border-gray-200 rounded-lg py-1.5 px-3 outline-none focus:border-primary text-xs font-medium bg-slate-50 focus:bg-white transition-all text-slate-700"
                                            />
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1 block">Địa chỉ chi tiết *</label>
                                            <input
                                                type="text"
                                                placeholder="VD: 123 Đường Ba Tháng Hai, Quận 10"
                                                value={newVenueForm.address}
                                                onChange={(e) => setNewVenueForm({ ...newVenueForm, address: e.target.value })}
                                                className="w-full border border-gray-200 rounded-lg py-1.5 px-3 outline-none focus:border-primary text-xs font-medium bg-slate-50 focus:bg-white transition-all text-slate-700"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-2.5">
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1 block">Vĩ độ (Latitude)</label>
                                                <input
                                                    type="number"
                                                    step="any"
                                                    placeholder="10.777"
                                                    value={newVenueForm.latitude}
                                                    onChange={(e) => setNewVenueForm({ ...newVenueForm, latitude: e.target.value })}
                                                    className="w-full border border-gray-200 rounded-lg py-1.5 px-3 outline-none focus:border-primary text-xs font-medium bg-slate-50 focus:bg-white font-mono text-slate-700"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1 block">Kinh độ (Longitude)</label>
                                                <input
                                                    type="number"
                                                    step="any"
                                                    placeholder="106.695"
                                                    value={newVenueForm.longitude}
                                                    onChange={(e) => setNewVenueForm({ ...newVenueForm, longitude: e.target.value })}
                                                    className="w-full border border-gray-200 rounded-lg py-1.5 px-3 outline-none focus:border-primary text-xs font-medium bg-slate-50 focus:bg-white font-mono text-slate-700"
                                                />
                                            </div>
                                        </div>

                                        <Button
                                            type="button"
                                            disabled={isSuggestingVenue}
                                            onClick={async () => {
                                                if (!newVenueForm.name.trim() || !newVenueForm.address.trim()) {
                                                    showError("Vui lòng điền đầy đủ Tên và Địa chỉ của địa điểm.");
                                                    return;
                                                }
                                                await suggestVenueMutation({
                                                    name: newVenueForm.name.trim(),
                                                    address: newVenueForm.address.trim(),
                                                    latitude: newVenueForm.latitude ? Number(newVenueForm.latitude) : undefined,
                                                    longitude: newVenueForm.longitude ? Number(newVenueForm.longitude) : undefined
                                                });
                                            }}
                                            className="w-full bg-primary hover:opacity-90 text-white font-bold text-xs py-2 rounded-lg border-none transition-all mt-1"
                                        >
                                            {isSuggestingVenue ? "Đang xử lý đề xuất..." : "Tạo & Áp dụng ngay"}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="bg-white rounded-2xl p-6 border border-gray-100">
                            <h3 className="font-bold text-sm mb-3 text-slate-800">Sơ đồ ghế (SVG Map)</h3>
                            <div className="w-full bg-slate-50 border-2 border-dashed border-gray-200 rounded-xl p-4 text-center">
                                {formData.stadium_map_svg ? (
                                    <div className="flex flex-col items-center py-2">
                                        <CheckCircle2 size={20} className="text-emerald-600 mb-1" />
                                        <span className="text-xs font-bold text-slate-700">Đã nhận diện file SVG</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center py-2 opacity-50">
                                        <UploadCloud size={24} className="mb-1 text-slate-400" />
                                        <span className="text-xs font-medium text-slate-400">Trống sơ đồ</span>
                                    </div>
                                )}
                                {!['published', 'cancelled'].includes(currentStatus) && (
                                    <label className="mt-2 inline-flex items-center justify-center px-3 py-1.5 bg-white border border-gray-300 rounded-md text-[11px] font-bold text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors">
                                        Nạp File SVG <input type="file" accept=".svg" className="hidden" onChange={handleSVGUpload} />
                                    </label>
                                )}
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl p-6 border border-gray-100 space-y-4">
                            <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2"><img src="" alt="" /><Users size={16} className="text-primary" /> Nhân viên điều phối ca</h3>

                            {currentStatus !== 'cancelled' && (
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Bổ sung nhân sự trực cổng</label>
                                    <div className="flex gap-1.5">
                                        <select
                                            value={selectedStaffId}
                                            onChange={(e) => setSelectedStaffId(e.target.value)}
                                            className="flex-1 bg-white border border-gray-200 rounded-lg p-2 text-xs font-medium outline-none focus:border-primary"
                                        >
                                            <option value="" disabled>-- Chọn nhân viên trống --</option>
                                            {availableStaff.map((s: any) => (
                                                <option key={s._id} value={s._id}>{s.first_name} {s.last_name} ({s.email.split('@')[0]})</option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                if (selectedStaffId) {
                                                    await assignStaffMutation(selectedStaffId);
                                                } else {
                                                    showError("Vui lòng chọn tài khoản từ danh sách thả xuống.");
                                                }
                                            }}
                                            className="bg-primary hover:opacity-90 text-white px-3 py-2 rounded-lg text-xs font-bold transition-opacity"
                                        >
                                            Gán lịch
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Đang trực đêm này ({assignedStaff.length})</label>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {assignedStaff.length === 0 ? (
                                        <div className="text-center py-4 border border-dashed border-gray-100 rounded-xl bg-slate-50/50 text-xs text-gray-400 font-medium">Chưa có nhân sự trực ca.</div>
                                    ) : (
                                        assignedStaff.map((s: any) => (
                                            <div key={s._id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-gray-100 text-xs">
                                                <div className="min-w-0 flex-1 pr-2">
                                                    <div className="font-bold text-slate-800 truncate">{s.first_name} {s.last_name}</div>
                                                    <div className="text-[10px] text-slate-400 font-mono truncate">{s.email}</div>
                                                </div>
                                                {currentStatus !== 'cancelled' && (
                                                    <button
                                                        type="button"
                                                        onClick={async () => {
                                                            if (window.confirm(`Hủy lịch trực của nhân viên ${s.first_name}?`)) {
                                                                await removeStaffMutation(s._id);
                                                            }
                                                        }}
                                                        className="text-rose-600 bg-rose-50 hover:bg-rose-100 px-2 py-1 rounded-md text-[10px] font-bold transition-colors"
                                                    >
                                                        Rút ca
                                                    </button>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            )}

            {activeTab === 'LIVE' && (
                <div className="w-full max-w-4xl mx-auto px-6 lg:px-12 mt-8 space-y-6 animate-in fade-in duration-150">

                    
                    <div className="flex justify-between items-center bg-white border border-gray-200 px-5 py-4 rounded-xl">
                        <div className="space-y-0.5">
                            <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                                <Activity size={16} className="text-primary" /> Hạ tầng kênh thông tin
                            </h3>
                            <p className="text-xs text-slate-400">Đang lắng nghe dữ liệu phân tán Redis Pub/Sub thời gian thực</p>
                        </div>
                        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-full text-xs font-bold">
                            <span className={`w-2 h-2 rounded-full ${liveMonitor.status.includes('Live') ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`}></span>
                            <span className={liveMonitor.status.includes('Live') ? 'text-green-600' : 'text-slate-500'}>{liveMonitor.status}</span>
                        </div>
                    </div>

                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        
                        <div className="bg-slate-800 text-white rounded-2xl p-6 flex flex-col justify-between min-h-[140px]">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Khán giả đang giữ phòng vé</span>
                            <div className="text-5xl font-mono font-bold tracking-tight mt-4">
                                {liveMonitor.holdingSeats.toLocaleString()}
                            </div>
                            <span className="text-[10px] text-slate-500 font-medium mt-2">* Cập nhật liên tục mỗi 3 giây</span>
                        </div>

                        
                        <div className="bg-white border-2 border-primary/20 rounded-2xl p-6 flex flex-col justify-between min-h-[140px] bg-gradient-to-br from-primary/5 to-white">
                            <span className="text-xs font-bold uppercase tracking-wider text-primary">Doanh thu hiện tại</span>
                            <div className="text-5xl font-mono font-bold tracking-tight text-primary mt-4">
                                +{liveMonitor.totalRevenue.toLocaleString()}
                            </div>
                            <span className="text-[10px] text-primary/60 font-medium mt-2">* Đo lường dựa trên giao dịch thành công</span>
                        </div>

                    </div>

                    
                    <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-4 flex items-start gap-2.5 text-xs text-amber-800 font-medium">
                        <Info size={16} className="shrink-0 mt-0.5 text-amber-600" />
                        <div className="space-y-1">
                            <p className="font-bold">Lưu ý phân tích:</p>
                            <p>Số liệu Giám sát Live chỉ phản ánh tiến độ trong các khung giờ cao điểm (Ticket Drop). Mọi dữ liệu tài chính chính xác vui lòng đối soát tại tab "Doanh thu" ngoài bảng quản trị vĩ mô.</p>
                        </div>
                    </div>

                </div>
            )}

            <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 z-50">
                <div className="max-w-6xl mx-auto px-6 lg:px-12 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">

                    <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                        {currentStatus === 'draft' && (
                            <Button
                                type="button"
                                disabled={isAnyActionPending || !formData.venue_id || isVenueVerified === false}
                                onClick={async () => {
                                    if (window.confirm("Xác nhận mở bán công khai show diễn này? Hệ thống sẽ kích hoạt phân tán dữ liệu thời gian thực.")) {
                                        await publishShowMutation();
                                    }
                                }}
                                className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white px-5 rounded-full font-bold text-xs border-none disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <Globe size={14} className="mr-1" /> Kích hoạt Mở bán
                            </Button>
                        )}

                        {currentStatus === 'published' && (
                            <Button
                                type="button"
                                disabled={isAnyActionPending}
                                onClick={async () => {
                                    if (window.confirm("Xác nhận tạm dừng bán vé? Hệ thống sẽ thu hồi bộ nhớ đệm nếu chưa ghi nhận giao dịch.")) {
                                        await unpublishShowMutation();
                                    }
                                }}
                                className="w-full sm:w-auto bg-slate-600 hover:bg-slate-700 text-white px-5 rounded-full font-bold text-xs border-none"
                            >
                                <EyeOff size={14} className="mr-1" /> Tạm dừng bán vé
                            </Button>
                        )}

                        {currentStatus !== 'cancelled' && (
                            <Button
                                type="button"
                                variant="outline"
                                disabled={isAnyActionPending}
                                onClick={async () => {
                                    if (window.confirm("CẢNH BÁO: Bạn có chắc chắn muốn HỦY vĩnh viễn đêm diễn này? Toàn bộ sơ đồ bán vé sẽ đóng ngay lập tức.")) {
                                        await cancelShowMutation();
                                    }
                                }}
                                className="w-full sm:w-auto border-red-200 text-red-600 hover:bg-red-50 px-5 rounded-full font-bold text-xs"
                            >
                                <Ban size={14} className="mr-1" /> Hủy đêm diễn
                            </Button>
                        )}
                    </div>

                    
                    <div className="flex gap-3 w-full sm:w-auto justify-end">
                        <Button
                            variant="outline"
                            className="flex-1 sm:flex-none border-gray-300 px-5 rounded-full font-bold text-xs"
                            onClick={() => navigate(`/organizer/events/${eventId}`)}
                        >
                            <X size={14} className="mr-1" /> Thoát
                        </Button>

                        <Button
                            onClick={handleUpdateShow}
                            disabled={isAnyActionPending || currentStatus === 'published' || currentStatus === 'cancelled'}
                            className="flex-1 sm:flex-none bg-primary hover:opacity-90 text-white px-6 rounded-full font-bold text-xs disabled:opacity-50 disabled:cursor-not-allowed border-none"
                        >
                            <Save size={14} className="mr-1" /> {isUpdating ? "Đang lưu..." : "Lưu thay đổi"}
                        </Button>
                    </div>

                </div>
            </div>
        </div>
    );
}
