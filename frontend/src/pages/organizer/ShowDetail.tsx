import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axiosClient';
import { ErrorModal } from '@/components/shared/ErrorModal';
import {
    ArrowLeft, Save, X, MapPin, Calendar, CheckCircle2,
    UploadCloud, EyeOff, Globe, Ban, Info, Clock, Ticket
} from 'lucide-react';

export default function ShowDetail() {
    const { eventId, showId } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    // STATE LƯU THÔNG BÁO LỖI CHO ERROR MODAL
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // ==========================================
    // 1. STATE & FETCH DATA
    // ==========================================
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

    // Fetch thông tin Show
    const { data: showData, isLoading: isLoadingShow } = useQuery({
        queryKey: ['organizer-show-detail', showId],
        queryFn: async () => {
            const response = await api.get(`/organizer/shows/${showId}`);
            return response.data?.data || response.data;
        },
        enabled: !!showId
    });

    // Fetch danh sách Venues (Địa điểm)
    const { data: venues = [] } = useQuery({
        queryKey: ['venues'],
        queryFn: async () => {
            const response = await api.get(`/venues`);
            return response.data?.data || response.data || [];
        }
    });

    const formatDateTimeLocal = (isoString?: string) => {
        if (!isoString) return '';
        return new Date(isoString).toISOString().slice(0, 16);
    };

    // Đổ dữ liệu vào form khi API trả về
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

            if (info.venue_id && info.venue_id.name) {
                setVenueSearch(info.venue_id.name);
            }
        }
    }, [showData]);

    // ==========================================
    // 2. MUTATIONS (CẬP NHẬT FORM & ĐIỀU HƯỚNG TRẠNG THÁI)
    // ==========================================

    // Mutation 1: Cập nhật thông tin form thô
    const { mutateAsync: updateShowMutation, isPending: isUpdating } = useMutation({
        mutationFn: async (updatedData: any) => {
            const response = await api.put(`/organizer/shows/${showId}`, updatedData);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['organizer-show-detail', showId] });
            queryClient.invalidateQueries({ queryKey: ['event-shows', eventId] });
            alert("Cập nhật thông tin Show thành công.");
        },
        onError: (error: any) => {
            setErrorMessage(error.response?.data?.message || "Lỗi hệ thống khi cập nhật Show.");
        }
    });

    // Mutation 2: Kích hoạt mở bán công khai (Publish)
    const { mutateAsync: publishShowMutation, isPending: isPublishing } = useMutation({
        mutationFn: async () => {
            const response = await api.post(`/organizer/shows/${showId}/publish`);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['organizer-show-detail', showId] });
            alert("Mở bán công khai Show thành công.");
        },
        onError: (error: any) => {
            setErrorMessage(error.response?.data?.message || "Không thể công khai Show diễn.");
        }
    });

    // Mutation 3: Tạm dừng bán (Unpublish -> Draft)
    const { mutateAsync: unpublishShowMutation, isPending: isUnpublishing } = useMutation({
        mutationFn: async () => {
            const response = await api.post(`/organizer/shows/${showId}/unpublish`);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['organizer-show-detail', showId] });
            alert("Đã tạm dừng bán, Show đã quay về trạng thái bản nháp.");
        },
        onError: (error: any) => {
            setErrorMessage(error.response?.data?.message || "Không thể hạ trạng thái Show diễn.");
        }
    });

    // Mutation 4: Hủy Show khẩn cấp (Cancel)
    const { mutateAsync: cancelShowMutation, isPending: isCancelling } = useMutation({
        mutationFn: async () => {
            const response = await api.post(`/organizer/shows/${showId}/cancel`);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['organizer-show-detail', showId] });
            alert("Đã hủy thành công show diễn này.");
        },
        onError: (error: any) => {
            setErrorMessage(error.response?.data?.message || "Không thể thực hiện hủy Show diễn.");
        }
    });

    // Điều phối hành động cập nhật Form
    const handleUpdateShow = async () => {
        if (!formData.start_time || !formData.end_time || !formData.sale_start || !formData.sale_end) {
            setErrorMessage("Vui lòng điền đầy đủ các mốc thời gian trước khi lưu.");
            return;
        }
        if (!formData.venue_id) {
            setErrorMessage("Vui lòng lựa chọn địa điểm tổ chức (Venue).");
            return;
        }
        await updateShowMutation(formData);
    };

    const handleSVGUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.type !== "image/svg+xml" && !file.name.endsWith('.svg')) {
                setErrorMessage("Định dạng file không hợp lệ. Vui lòng chỉ tải lên file SVG.");
                return;
            }
            const reader = new FileReader();
            reader.onload = (event) => {
                const svgString = event.target?.result as string;
                setFormData(prev => ({ ...prev, stadium_map_svg: svgString }));
            };
            reader.readAsText(file);
        }
    };

    const filteredVenues = venues.filter((v: any) => v.name.toLowerCase().includes(venueSearch.toLowerCase()));
    const isAnyActionPending = isUpdating || isPublishing || isUnpublishing || isCancelling;

    if (isLoadingShow) return <div className="min-h-screen flex items-center justify-center font-medium text-gray-500 animate-pulse">Đang tải thông tin Show...</div>;
    if (!showData) return <div className="min-h-screen flex items-center justify-center font-bold text-red-500">Không tìm thấy Show!</div>;

    return (
        <div className="min-h-screen bg-[#F8F9FA] relative pb-24 font-sans w-full overflow-x-hidden">

            <ErrorModal message={errorMessage} onClose={() => setErrorMessage(null)} />


            <div className="bg-white border-b border-gray-200 px-6 lg:px-12 py-6 flex items-center justify-between sticky top-0 z-40">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate(`/organizer/events/${eventId}`, { state: { activeTab: 'SHOWS' } })}
                        className="p-2.5 rounded-full hover:bg-slate-100 text-slate-500 transition-colors border border-slate-200"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">{formData.name || 'Đang cập nhật tên Show...'}</h1>
                        <div className="flex items-center gap-3 mt-1 text-sm">
                            <span className="text-slate-500 font-medium">Show ID: {showId}</span>
                            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                            <span className="text-primary font-bold">Thuộc Event: {showData.event_id?.name || eventId}</span>
                        </div>
                    </div>
                </div>

                {/* BADGE THỂ HIỆN TRẠNG THÁI HIỆN TẠI CHỈ ĐỌC (TÁCH BIỆT UI CÁCH 2) */}
                <div className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg bg-slate-50">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Trạng thái:</span>
                    {currentStatus === 'draft' && <span className="text-sm font-bold text-slate-600 flex items-center gap-1.5"><EyeOff size={14} /> Bản nháp</span>}
                    {currentStatus === 'published' && <span className="text-sm font-bold text-green-600 flex items-center gap-1.5"><Globe size={14} /> Đang mở bán</span>}
                    {currentStatus === 'cancelled' && <span className="text-sm font-bold text-red-600 flex items-center gap-1.5"><Ban size={14} /> Đã hủy show</span>}
                </div>
            </div>

            <div className="w-full max-w-6xl mx-auto px-6 lg:px-12 mt-8 grid grid-cols-1 xl:grid-cols-3 gap-8">

                {/* CỘT TRÁI - FORM CHỈNH SỬA */}
                <div className="xl:col-span-2 space-y-8">
                    {currentStatus === 'published' && (
                        <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-xl flex items-start gap-2.5 text-sm font-medium">
                            <Info size={18} className="shrink-0 mt-0.5" />
                            <span>Show diễn này đang ở trạng thái công khai. Để chỉnh sửa các mốc thời gian hoặc sơ đồ, vui lòng chọn hành động "Tạm dừng bán" ở thanh công cụ phía dưới.</span>
                        </div>
                    )}

                    {/* Thông tin cơ bản */}
                    <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-100 relative">
                        <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <Info className="text-primary" size={20} /> Thông tin cơ bản
                        </h2>

                        <div className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Tên Show diễn</label>
                                <input
                                    type="text"
                                    disabled={currentStatus === 'published' || currentStatus === 'cancelled'}
                                    className="w-full bg-slate-50 border border-gray-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-primary/10 focus:bg-white font-medium text-slate-800 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                                    value={formData.name}
                                    placeholder="VD: Đêm 1 - TP.HCM"
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Mô tả thêm (Tùy chọn)</label>
                                <textarea
                                    rows={3}
                                    disabled={currentStatus === 'published' || currentStatus === 'cancelled'}
                                    className="w-full bg-slate-50 border border-gray-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-primary/10 focus:bg-white font-medium text-slate-600 transition-all resize-none disabled:opacity-60 disabled:cursor-not-allowed"
                                    value={formData.description}
                                    placeholder="Lưu ý riêng cho đêm diễn này..."
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Mốc thời gian */}
                    <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-100">
                        <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <Clock className="text-primary" size={20} /> Mốc thời gian quan trọng
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="bg-orange-50/50 border border-orange-100 p-5 rounded-xl space-y-4">
                                <h3 className="font-bold text-orange-800 text-sm flex items-center gap-1.5"><Ticket size={16} /> Thời gian Bán vé</h3>
                                <div>
                                    <label className="block text-[11px] font-bold text-orange-600 uppercase mb-1.5">Mở bán lúc</label>
                                    <input type="datetime-local" disabled={currentStatus === 'published' || currentStatus === 'cancelled'} className="w-full bg-white border border-orange-200 rounded-md p-2.5 outline-none focus:border-orange-400 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed" value={formData.sale_start} onChange={(e) => setFormData({ ...formData, sale_start: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-orange-600 uppercase mb-1.5">Đóng bán lúc</label>
                                    <input type="datetime-local" disabled={currentStatus === 'published' || currentStatus === 'cancelled'} className="w-full bg-white border border-orange-200 rounded-md p-2.5 outline-none focus:border-orange-400 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed" value={formData.sale_end} onChange={(e) => setFormData({ ...formData, sale_end: e.target.value })} />
                                </div>
                            </div>

                            <div className="bg-blue-50/50 border border-blue-100 p-5 rounded-xl space-y-4">
                                <h3 className="font-bold text-blue-800 text-sm flex items-center gap-1.5"><Calendar size={16} /> Thời gian Biểu diễn</h3>
                                <div>
                                    <label className="block text-[11px] font-bold text-blue-600 uppercase mb-1.5">Bắt đầu Show</label>
                                    <input type="datetime-local" disabled={currentStatus === 'published' || currentStatus === 'cancelled'} className="w-full bg-white border border-blue-200 rounded-md p-2.5 outline-none focus:border-blue-400 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed" value={formData.start_time} onChange={(e) => setFormData({ ...formData, start_time: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-blue-600 uppercase mb-1.5">Kết thúc Show</label>
                                    <input type="datetime-local" disabled={currentStatus === 'published' || currentStatus === 'cancelled'} className="w-full bg-white border border-blue-200 rounded-md p-2.5 outline-none focus:border-blue-400 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed" value={formData.end_time} onChange={(e) => setFormData({ ...formData, end_time: e.target.value })} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* CỘT PHẢI - CẤU HÌNH SƠ ĐỒ ĐỊA ĐIỂM */}
                <div className="space-y-6">
                    {/* Địa điểm (Venue) */}
                    <div className="bg-white rounded-2xl p-6 border border-gray-100">
                        <h3 className="font-bold text-lg mb-4 text-slate-800 flex items-center gap-2"><MapPin size={18} className="text-primary" /> Nơi tổ chức</h3>
                        <div className="relative">
                            <input
                                type="text"
                                disabled={currentStatus === 'published' || currentStatus === 'cancelled'}
                                className="w-full border border-gray-200 rounded-lg py-2.5 px-4 outline-none focus:border-primary text-sm font-medium bg-slate-50 focus:bg-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                placeholder="Tìm địa điểm (Venue)..."
                                value={venueSearch}
                                onChange={e => { setVenueSearch(e.target.value); setFormData({ ...formData, venue_id: '' }); setIsVenueDropdownOpen(true); }}
                                onFocus={() => setIsVenueDropdownOpen(true)}
                                onBlur={() => setTimeout(() => setIsVenueDropdownOpen(false), 200)}
                            />
                            {isVenueDropdownOpen && !['published', 'cancelled'].includes(currentStatus) && (
                                <div className="absolute z-30 w-full mt-1 bg-white border border-gray-200 rounded-lg max-h-60 overflow-y-auto">
                                    {filteredVenues.map((venue: any) => (
                                        <div key={venue._id} className="px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-gray-50"
                                            onMouseDown={() => { setFormData({ ...formData, venue_id: venue._id }); setVenueSearch(venue.name); setIsVenueDropdownOpen(false); }}>
                                            <div className="font-medium text-gray-900 text-sm">{venue.name}</div>
                                            <div className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">{venue.address}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        {formData.venue_id && (
                            <div className="mt-3 p-3 bg-green-50 border border-green-100 rounded-lg flex items-start gap-2 text-green-700">
                                <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                                <span className="text-xs font-medium">Đã chốt địa điểm. Sơ đồ ghế tĩnh sẽ chạy dựa theo hạ tầng cơ sở này.</span>
                            </div>
                        )}
                    </div>

                    {/* Sơ đồ Map (SVG) */}
                    <div className="bg-white rounded-2xl p-6 border border-gray-100">
                        <h3 className="font-bold text-lg mb-2 text-slate-800 flex items-center gap-2">Sơ đồ ghế (SVG Map)</h3>
                        <p className="text-xs text-gray-500 mb-4">Cung cấp tập tin SVG tiêu chuẩn để đồng bộ thông tin mặt bằng.</p>

                        <div className="w-full bg-slate-50 border-2 border-dashed border-gray-200 rounded-xl p-6 text-center">
                            {formData.stadium_map_svg ? (
                                <div className="flex flex-col items-center">
                                    <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-2"><CheckCircle2 size={24} /></div>
                                    <span className="text-sm font-bold text-slate-700">Đã nạp sơ đồ hệ thống</span>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center opacity-60">
                                    <UploadCloud size={32} className="mb-2 text-slate-500" />
                                    <span className="text-sm font-medium text-slate-500">Chưa tải dữ liệu bản đồ</span>
                                </div>
                            )}

                            {!['published', 'cancelled'].includes(currentStatus) && (
                                <label className="mt-4 inline-flex items-center justify-center px-4 py-2 bg-white border border-gray-300 rounded-md text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer">
                                    {formData.stadium_map_svg ? "Thay đổi tập tin" : "Chọn File SVG"}
                                    <input type="file" accept=".svg" className="hidden" onChange={handleSVGUpload} />
                                </label>
                            )}
                        </div>
                    </div>
                </div>
            </div>


            <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 z-50">
                <div className="max-w-6xl mx-auto px-6 lg:px-12 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">

                    {/* KHU VỰC CÁC NÚT ĐIỀU HƯỚNG TRẠNG THÁI CHUYÊN BIỆT */}
                    <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                        {/* 1. Nếu Show đang ở dạng NHÁP: Cung cấp nút Mở bán công khai */}
                        {currentStatus === 'draft' && (
                            <Button
                                type="button"
                                disabled={isAnyActionPending}
                                onClick={async () => {
                                    if (window.confirm("Xác nhận mở bán công khai show diễn này? Hệ thống sẽ kích hoạt phân tán dữ liệu thời gian thực.")) {
                                        await publishShowMutation();
                                    }
                                }}
                                className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white px-6 rounded-full font-bold text-sm"
                            >
                                <Globe size={16} className="mr-1.5" /> Kích hoạt Mở bán
                            </Button>
                        )}

                        {/* 2. Nếu Show ĐANG MỞ BÁN: Cung cấp nút Tạm dừng để hạ về Draft để sửa form */}
                        {currentStatus === 'published' && (
                            <Button
                                type="button"
                                disabled={isAnyActionPending}
                                onClick={async () => {
                                    if (window.confirm("Xác nhận tạm dừng bán vé? Hệ thống sẽ thu hồi bộ nhớ đệm nếu chưa ghi nhận giao dịch.")) {
                                        await unpublishShowMutation();
                                    }
                                }}
                                className="w-full sm:w-auto bg-slate-600 hover:bg-slate-700 text-white px-6 rounded-full font-bold text-sm"
                            >
                                <EyeOff size={16} className="mr-1.5" /> Tạm dừng bán vé
                            </Button>
                        )}

                        {/* 3. Nút hủy show khẩn cấp (Chỉ xuất hiện khi chưa bị hủy vĩnh viễn) */}
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
                                className="w-full sm:w-auto border-red-200 text-red-600 hover:bg-red-50 px-6 rounded-full font-bold text-sm"
                            >
                                <Ban size={16} className="mr-1.5" /> Hủy đêm diễn
                            </Button>
                        )}
                    </div>

                    {/* KHU VỰC QUẢN LÝ BIỂU MẪU (FORM ACTIONS) */}
                    <div className="flex gap-3 w-full sm:w-auto justify-end">
                        <Button
                            variant="outline"
                            className="flex-1 sm:flex-none border-gray-300 px-6 rounded-full font-bold text-sm"
                            onClick={() => navigate(`/organizer/events/${eventId}`)}
                        >
                            <X size={16} className="mr-1.5" /> Thoát
                        </Button>

                        <Button
                            onClick={handleUpdateShow}
                            disabled={isAnyActionPending || currentStatus === 'published' || currentStatus === 'cancelled'}
                            className="flex-1 sm:flex-none bg-primary hover:bg-pink-700 text-white px-8 rounded-full font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Save size={16} className="mr-1.5" /> {isUpdating ? "Đang lưu..." : "Lưu thay đổi"}
                        </Button>
                    </div>

                </div>
            </div>
        </div>
    );
}