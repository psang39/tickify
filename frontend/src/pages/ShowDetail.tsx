import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axiosClient';
import {
    ArrowLeft, Save, X, MapPin, Calendar, Edit3,
    UploadCloud, CheckCircle2, EyeOff, Globe, Ban, Info, Clock, Ticket
} from 'lucide-react';

export default function ShowDetail() {
    const { eventId, showId } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

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
        stadium_map_svg: '',
        status: 'draft'
    });

    const [venueSearch, setVenueSearch] = useState('');
    const [isVenueDropdownOpen, setIsVenueDropdownOpen] = useState(false);

    // Fetch thông tin Show
    const { data: showData, isLoading: isLoadingShow } = useQuery({
        queryKey: ['organizer-show-detail', showId],
        queryFn: async () => {
            const response = await api.get(`/organizer/shows/${showId}`);
            // Lấy thẳng data (Object chứa show_info và zones)
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

    // Hàm tiện ích cắt chuỗi ISO chuẩn cho ô input datetime-local
    const formatDateTimeLocal = (isoString?: string) => {
        if (!isoString) return '';
        return new Date(isoString).toISOString().slice(0, 16);
    };

    // Đổ dữ liệu vào form khi API trả về
    useEffect(() => {
        // Kiểm tra chắc chắn showData và show_info đã tồn tại
        if (showData && showData.show_info) {
            const info = showData.show_info; // Bóc tách show_info ra cho code ngắn gọn

            setFormData({
                name: info.name || '',
                description: info.description || '',
                start_time: formatDateTimeLocal(info.start_time),
                end_time: formatDateTimeLocal(info.end_time),
                sale_start: formatDateTimeLocal(info.sale_start),
                sale_end: formatDateTimeLocal(info.sale_end),

                // Trỏ chuẩn vào info.venue_id
                venue_id: info.venue_id?._id || info.venue_id || '',
                stadium_map_svg: info.stadium_map_svg || '',
                status: info.status || 'draft'
            });

            // Lấy tên venue để gán vào ô tìm kiếm
            if (info.venue_id && info.venue_id.name) {
                setVenueSearch(info.venue_id.name);
            }
        }
    }, [showData]);
    // ==========================================
    // 2. MUTATION: CẬP NHẬT SHOW
    // ==========================================
    const { mutateAsync: updateShow, isPending: isUpdating } = useMutation({
        mutationFn: async (updatedData: any) => {
            // Giả định API cập nhật show của bạn nằm ở endpoint này
            const response = await api.put(`/organizer/shows/${showId}`, updatedData);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['organizer-show-detail', showId] });
            queryClient.invalidateQueries({ queryKey: ['event-shows', eventId] }); // Bắn tín hiệu làm mới list show ở trang EventDetail
            alert("✅ Cập nhật Show thành công!");
        },
        onError: (error: any) => {
            alert(error.response?.data?.message || "Lỗi cập nhật Show.");
        }
    });

    const handleUpdateShow = async () => {
        if (!formData.start_time || !formData.end_time || !formData.sale_start || !formData.sale_end) {
            alert("Vui lòng điền đầy đủ các mốc thời gian!"); return;
        }
        if (!formData.venue_id) {
            alert("Vui lòng chọn địa điểm tổ chức (Venue)!"); return;
        }
        await updateShow(formData);
    };

    // Xử lý nạp lại sơ đồ SVG
    const handleSVGUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.type !== "image/svg+xml" && !file.name.endsWith('.svg')) {
                alert("Vui lòng chỉ upload file định dạng SVG!"); return;
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

    if (isLoadingShow) return <div className="min-h-screen flex items-center justify-center font-medium text-gray-500 animate-pulse">Đang tải thông tin Show...</div>;
    if (!showData) return <div className="min-h-screen flex items-center justify-center font-bold text-red-500">Không tìm thấy Show!</div>;

    return (
        <div className="min-h-screen bg-[#F8F9FA] relative pb-24 font-sans w-full overflow-x-hidden">

            {/* ========================================== */}
            {/* HEADER ĐIỀU HƯỚNG                           */}
            {/* ========================================== */}
            <div className="bg-white border-b border-gray-200 px-6 lg:px-12 py-6 flex items-center gap-4 sticky top-0 z-40">
                <button
                    onClick={() => navigate(`/organizer/events/${eventId}`)}
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

            {/* ========================================== */}
            {/* NỘI DUNG CHÍNH                             */}
            {/* ========================================== */}
            <div className="w-full max-w-6xl mx-auto px-6 lg:px-12 mt-8 grid grid-cols-1 xl:grid-cols-3 gap-8">

                {/* CỘT TRÁI (Chiếm 2 phần) */}
                <div className="xl:col-span-2 space-y-8">

                    {/* Thông tin cơ bản */}
                    <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 relative group/info hover:shadow-md transition-all">
                        <h2 className="text-xl font-bold text-secondary mb-6 flex items-center gap-2">
                            <Info className="text-primary" size={20} /> Thông tin cơ bản
                        </h2>

                        <div className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Tên Show diễn</label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-50 border border-gray-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white font-medium text-slate-800 transition-all"
                                    value={formData.name}
                                    placeholder="VD: Đêm 1 - TP.HCM"
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Mô tả thêm (Tùy chọn)</label>
                                <textarea
                                    rows={3}
                                    className="w-full bg-slate-50 border border-gray-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white font-medium text-slate-600 transition-all resize-none"
                                    value={formData.description}
                                    placeholder="Lưu ý riêng cho đêm diễn này..."
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Mốc thời gian */}
                    <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100">
                        <h2 className="text-xl font-bold text-secondary mb-6 flex items-center gap-2">
                            <Clock className="text-primary" size={20} /> Mốc thời gian quan trọng
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Thời gian mở bán */}
                            <div className="bg-orange-50/50 border border-orange-100 p-5 rounded-xl space-y-4">
                                <h3 className="font-bold text-orange-800 text-sm flex items-center gap-1.5"><Ticket size={16} /> Thời gian Bán vé</h3>
                                <div>
                                    <label className="block text-[11px] font-bold text-orange-600 uppercase mb-1.5">Mở bán lúc</label>
                                    <input type="datetime-local" className="w-full bg-white border border-orange-200 rounded-md p-2.5 outline-none focus:border-orange-400 text-sm font-medium" value={formData.sale_start} onChange={(e) => setFormData({ ...formData, sale_start: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-orange-600 uppercase mb-1.5">Đóng bán lúc</label>
                                    <input type="datetime-local" className="w-full bg-white border border-orange-200 rounded-md p-2.5 outline-none focus:border-orange-400 text-sm font-medium" value={formData.sale_end} onChange={(e) => setFormData({ ...formData, sale_end: e.target.value })} />
                                </div>
                            </div>

                            {/* Thời gian diễn ra */}
                            <div className="bg-blue-50/50 border border-blue-100 p-5 rounded-xl space-y-4">
                                <h3 className="font-bold text-blue-800 text-sm flex items-center gap-1.5"><Calendar size={16} /> Thời gian Biểu diễn</h3>
                                <div>
                                    <label className="block text-[11px] font-bold text-blue-600 uppercase mb-1.5">Bắt đầu Show</label>
                                    <input type="datetime-local" className="w-full bg-white border border-blue-200 rounded-md p-2.5 outline-none focus:border-blue-400 text-sm font-medium" value={formData.start_time} onChange={(e) => setFormData({ ...formData, start_time: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-blue-600 uppercase mb-1.5">Kết thúc Show</label>
                                    <input type="datetime-local" className="w-full bg-white border border-blue-200 rounded-md p-2.5 outline-none focus:border-blue-400 text-sm font-medium" value={formData.end_time} onChange={(e) => setFormData({ ...formData, end_time: e.target.value })} />
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                {/* CỘT PHẢI (Chiếm 1 phần) */}
                <div className="space-y-6">

                    {/* Địa điểm (Venue) */}
                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm relative">
                        <h3 className="font-bold text-lg mb-4 text-secondary flex items-center gap-2"><MapPin size={18} className="text-primary" /> Nơi tổ chức</h3>
                        <div className="relative">
                            <input
                                type="text"
                                className="w-full border border-gray-200 rounded-lg py-2.5 px-4 outline-none focus:border-primary text-sm font-medium bg-slate-50 focus:bg-white transition-colors"
                                placeholder="Tìm địa điểm (Venue)..."
                                value={venueSearch}
                                onChange={e => { setVenueSearch(e.target.value); setFormData({ ...formData, venue_id: '' }); setIsVenueDropdownOpen(true); }}
                                onFocus={() => setIsVenueDropdownOpen(true)}
                                onBlur={() => setTimeout(() => setIsVenueDropdownOpen(false), 200)}
                            />
                            {isVenueDropdownOpen && (
                                <div className="absolute z-30 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                    {filteredVenues.map((venue: any) => (
                                        <div key={venue._id} className="px-4 py-3 hover:bg-pink-50 cursor-pointer border-b border-gray-50"
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
                                <span className="text-xs font-medium">Đã chốt địa điểm. Sơ đồ ghế sẽ được tải theo địa điểm này.</span>
                            </div>
                        )}
                    </div>

                    {/* Sơ đồ Map (SVG) */}
                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                        <h3 className="font-bold text-lg mb-2 text-secondary flex items-center gap-2">Sơ đồ ghế (SVG Map)</h3>
                        <p className="text-xs text-gray-500 mb-4">Upload file SVG định dạng chuẩn để ánh xạ hạng vé.</p>

                        <div className="w-full bg-slate-50 border-2 border-dashed border-gray-200 hover:border-primary/50 rounded-xl p-6 text-center transition-colors">
                            {formData.stadium_map_svg ? (
                                <div className="flex flex-col items-center">
                                    <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-2"><CheckCircle2 size={24} /></div>
                                    <span className="text-sm font-bold text-slate-700">Đã nạp bản đồ SVG</span>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center opacity-60">
                                    <UploadCloud size={32} className="mb-2 text-slate-500" />
                                    <span className="text-sm font-medium text-slate-500">Chưa có dữ liệu map</span>
                                </div>
                            )}

                            <label className="mt-4 inline-flex items-center justify-center px-4 py-2 bg-white border border-gray-300 rounded-md text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-sm">
                                {formData.stadium_map_svg ? "Tải lại file khác" : "Chọn File SVG"}
                                <input type="file" accept=".svg" className="hidden" onChange={handleSVGUpload} />
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            {/* ========================================== */}
            {/* FLOATING ACTION BAR & TRẠNG THÁI SHOW      */}
            {/* ========================================== */}
            <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-50 animate-in slide-in-from-bottom-10">
                <div className="max-w-6xl mx-auto px-6 lg:px-12 py-3 md:py-4 flex flex-col sm:flex-row items-center justify-between gap-4">

                    {/* TRẠNG THÁI SHOW (SEGMENTED CONTROL CÓ HỦY) */}
                    <div className="flex items-center w-full sm:w-auto bg-slate-100 p-1.5 rounded-lg border border-slate-200">
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, status: 'draft' })}
                            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${formData.status === 'draft' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <EyeOff size={16} /> Nháp
                        </button>
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, status: 'published' })}
                            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${formData.status === 'published' ? 'bg-green-500 text-white shadow-sm shadow-green-500/30' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <Globe size={16} /> Công khai
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                const confirm = window.confirm("Bạn có chắc chắn muốn HỦY show này? Khán giả sẽ được thông báo hoàn tiền.");
                                if (confirm) setFormData({ ...formData, status: 'cancelled' });
                            }}
                            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${formData.status === 'cancelled' ? 'bg-red-500 text-white shadow-sm shadow-red-500/30' : 'text-slate-500 hover:text-red-500'}`}
                        >
                            <Ban size={16} /> Hủy Show
                        </button>
                    </div>

                    <div className="flex gap-3 w-full sm:w-auto">
                        <Button variant="outline" className="flex-1 sm:flex-none border-gray-300 px-6 rounded-full font-bold text-sm" onClick={() => navigate(-1)}>
                            <X size={16} className="mr-1.5" /> Thoát
                        </Button>

                        <Button
                            onClick={handleUpdateShow}
                            disabled={isUpdating}
                            className="flex-1 sm:flex-none bg-primary hover:bg-pink-700 text-white px-8 rounded-full font-bold shadow-md shadow-pink-200 text-sm"
                        >
                            <Save size={16} className="mr-1.5" /> {isUpdating ? "Đang lưu..." : "Lưu thay đổi"}
                        </Button>
                    </div>
                </div>
            </div>

        </div>
    );
}