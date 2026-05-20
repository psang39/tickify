import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axiosClient';
import { UploadCloud, Search, CheckCircle2, Plus, Trash2, Ticket, CalendarClock, Tag, Settings, ListVideo, Save, ArrowLeft, Image as ImageIcon, MapPin, Calendar, Info, Edit3, X } from 'lucide-react';

interface TicketTypeForm {
    name: string;
    target_tier: string;
    description: string;
    price: number | '';
    is_limited_promo: boolean;
    total_quantity: number | '';
    sale_start: string;
    sale_end: string;
}

export default function EventDetail() {
    const { eventId } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    // ĐIỀU HƯỚNG TABS
    const [activeTab, setActiveTab] = useState<'INFO' | 'SHOWS'>('INFO');

    // ==========================================
    // DATA CỦA TAB 1: THÔNG TIN SỰ KIỆN (EVENT)
    // ==========================================
    const [eventFormData, setEventFormData] = useState({
        name: '', description: '', genre: 'Pop / Concert', poster_url: '', start_date: '', end_date: ''
    });
    const [isEditingBanner, setIsEditingBanner] = useState(false);

    const { data: eventData, isLoading: isLoadingEvent } = useQuery({
        queryKey: ['organizer-event-detail', eventId],
        queryFn: async () => {
            const response = await api.get(`/organizer/events/${eventId}`);
            return response.data?.data || response.data;
        },
        enabled: !!eventId
    });

    // Điền dữ liệu vào form khi load xong Event
    useEffect(() => {
        if (eventData) {
            setEventFormData({
                name: eventData.name || '',
                description: eventData.description || '',
                genre: eventData.genre || 'Pop / Concert',
                poster_url: eventData.poster_url || eventData.banner_url || '',
                start_date: eventData.start_date ? new Date(eventData.start_date).toISOString().slice(0, 16) : '',
                end_date: eventData.end_date ? new Date(eventData.end_date).toISOString().slice(0, 16) : ''
            });
        }
    }, [eventData]);

    const { mutateAsync: updateEvent, isPending: isUpdatingEvent } = useMutation({
        mutationFn: async (updatedData: any) => {
            const response = await api.put(`/organizer/events/${eventId}`, updatedData);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['organizer-event-detail', eventId] });
            alert("✅ Cập nhật thông tin sự kiện thành công!");
        },
        onError: (error: any) => {
            alert(error.response?.data?.message || "Lỗi cập nhật sự kiện.");
        }
    });

    const handleUpdateEvent = async () => {
        if (!eventFormData.start_date || !eventFormData.end_date) {
            alert("Vui lòng chọn ngày bắt đầu và ngày kết thúc cho sự kiện!");
            return;
        }
        await updateEvent(eventFormData);
    };

    // ==========================================
    // DATA CỦA TAB 2: QUẢN LÝ SHOWS
    // ==========================================
    const [showForm, setShowForm] = useState(false);
    const [ticketTypes, setTicketTypes] = useState<TicketTypeForm[]>([]);
    const [showData, setShowData] = useState({
        name: '', description: '', start_time: '', end_time: '',
        venue_id: '', sale_start: '', sale_end: '', stadium_map_svg: ''
    });

    const [venueSearch, setVenueSearch] = useState('');
    const [isVenueDropdownOpen, setIsVenueDropdownOpen] = useState(false);

    const { data: shows = [], isLoading: isLoadingShows } = useQuery({
        queryKey: ['event-shows', eventId],
        queryFn: async () => {
            const response = await api.get(`/organizer/events/${eventId}/shows`);
            return response.data?.docs || response.data?.data || response.data || [];
        },
        enabled: !!eventId
    });

    const { data: venues = [] } = useQuery({
        queryKey: ['venues'],
        queryFn: async () => {
            const response = await api.get(`/venues`);
            return response.data?.data || response.data || [];
        }
    });

    const { mutateAsync: createShow } = useMutation({
        mutationFn: async (newShowData: any) => {
            const response = await api.post(`/events/${eventId}/shows`, newShowData);
            return response.data;
        }
    });

    const [isSubmittingShow, setIsSubmittingShow] = useState(false);

    const handleSVGUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.type !== "image/svg+xml" && !file.name.endsWith('.svg')) {
                alert("Vui lòng chỉ upload file định dạng SVG!"); return;
            }
            const reader = new FileReader();
            reader.onload = (event) => {
                const svgString = event.target?.result as string;
                setShowData(prev => ({ ...prev, stadium_map_svg: svgString }));
                try {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(svgString, "image/svg+xml");
                    const elements = doc.querySelectorAll('[id*="Type-"], [class*="Type-"], [data-type]');
                    const foundTiers = new Set<string>();
                    elements.forEach(el => {
                        const matchId = (el.id || '').match(/type-([a-zA-Z0-9]+)/i);
                        const matchCls = (el.getAttribute('class') || '').match(/type-([a-zA-Z0-9]+)/i);
                        if (matchId) foundTiers.add(matchId[1].toUpperCase());
                        else if (matchCls) foundTiers.add(matchCls[1].toUpperCase());
                    });
                    if (foundTiers.size > 0) {
                        const newTicketTypes: TicketTypeForm[] = Array.from(foundTiers).map(tier => ({
                            name: `Vé ${tier}`, target_tier: tier, description: `Quyền lợi vé ${tier}`, price: '', is_limited_promo: false, total_quantity: '', sale_start: showData.sale_start || '', sale_end: showData.sale_end || ''
                        }));
                        setTicketTypes(newTicketTypes);
                    } else {
                        setTicketTypes([{ name: '', target_tier: 'DEFAULT', description: '', price: '', is_limited_promo: false, total_quantity: '', sale_start: showData.sale_start, sale_end: showData.sale_end }]);
                    }
                } catch (err) { console.error("Lỗi khi phân tích SVG:", err); }
            };
            reader.readAsText(file);
        }
    };

    const handleCreateAllShow = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmittingShow(true);
        try {
            const finalPayload = {
                name: showData.name, description: showData.description, start_time: showData.start_time, end_time: showData.end_time, venue_id: showData.venue_id, sale_start: showData.sale_start, sale_end: showData.sale_end, stadium_map_svg: showData.stadium_map_svg,
                ticket_types: ticketTypes.map(tt => ({ ...tt, price: Number(tt.price), total_quantity: tt.total_quantity !== '' ? Number(tt.total_quantity) : null }))
            };
            await createShow(finalPayload);
            alert("Tạo Show và Cấu hình Vé thành công tuyệt đối!");
            setShowForm(false);
            queryClient.invalidateQueries({ queryKey: ['event-shows', eventId] });
            setShowData({ name: '', description: '', start_time: '', end_time: '', venue_id: '', sale_start: '', sale_end: '', stadium_map_svg: '' });
            setTicketTypes([]);
            setVenueSearch('');
        } catch (error: any) { alert(error.response?.data?.message || "Có lỗi xảy ra trong quá trình lưu dữ liệu!"); }
        finally { setIsSubmittingShow(false); }
    };

    const filteredVenues = venues.filter((v: any) => v.name.toLowerCase().includes(venueSearch.toLowerCase()));

    if (isLoadingEvent) return <div className="p-10 text-center font-medium text-gray-500 animate-pulse">Đang tải thông tin sự kiện...</div>;
    if (!eventData) return <div className="p-10 text-center font-bold text-red-500">Không tìm thấy sự kiện!</div>;

    const isInfoTab = activeTab === 'INFO';

    return (
        <div className="min-h-screen bg-[#F8F9FA] relative pb-24 font-sans w-full overflow-x-hidden">

            {/* NÚT QUAY LẠI TÌM VỀ DANH SÁCH SỰ KIỆN */}
            <button
                onClick={() => navigate('/organizer/events')}
                className="absolute top-6 left-6 z-20 bg-black/40 hover:bg-black/70 text-white p-2.5 rounded-full backdrop-blur-md transition-all"
            >
                <ArrowLeft size={24} />
            </button>

            {/* ========================================== */}
            {/* 1. KHU VỰC BANNER TRÀN VIỀN (FULL-BLEED)   */}
            {/* ========================================== */}
            <div className="relative w-full h-[400px] md:h-[500px] bg-gray-900 group">
                {eventFormData.poster_url ? (
                    <img src={eventFormData.poster_url} alt="Banner" className="w-full h-full object-cover opacity-80" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500"><ImageIcon size={64} /></div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent pointer-events-none"></div>

                {/* Nút Đổi ảnh bìa (Chỉ cho phép đổi khi ở Tab INFO) */}
                {isInfoTab && (
                    <div className="absolute top-6 right-6 z-10">
                        {isEditingBanner ? (
                            <div className="bg-white p-2 rounded-lg shadow-xl flex items-center gap-2 w-80 animate-in fade-in zoom-in duration-200">
                                <input
                                    type="text" placeholder="Dán link ảnh (URL) vào đây..."
                                    className="flex-1 text-sm p-2 outline-none"
                                    value={eventFormData.poster_url}
                                    onChange={(e) => setEventFormData({ ...eventFormData, poster_url: e.target.value })}
                                    autoFocus
                                />
                                <Button size="icon" variant="ghost" onClick={() => setIsEditingBanner(false)}><Save size={18} className="text-primary" /></Button>
                            </div>
                        ) : (
                            <Button
                                variant="outline"
                                className="bg-black/50 text-white border-white/30 backdrop-blur-md hover:bg-white hover:text-black transition-all opacity-0 group-hover:opacity-100"
                                onClick={() => setIsEditingBanner(true)}
                            >
                                <ImageIcon size={18} className="mr-2" /> Đổi ảnh bìa
                            </Button>
                        )}
                    </div>
                )}

                <div className="absolute bottom-10 left-0 w-full px-6 lg:px-12 flex justify-center">
                    <div className="w-full max-w-6xl flex flex-col md:flex-row justify-between items-start md:items-end gap-6">

                        {/* INLINE EDIT: Tên sự kiện */}
                        <div className={`flex-1 w-full relative ${isInfoTab ? 'group/title' : ''}`}>
                            {isInfoTab && <Edit3 size={24} className="absolute -left-8 top-4 text-white/50 opacity-0 group-hover/title:opacity-100 transition-opacity hidden md:block" />}
                            <textarea
                                rows={2}
                                disabled={!isInfoTab}
                                className={`w-full bg-transparent outline-none text-4xl md:text-5xl lg:text-7xl font-black text-white leading-tight drop-shadow-2xl transition-all p-2 -ml-2 rounded-t-lg resize-none overflow-hidden ${isInfoTab ? 'border-b-2 border-transparent hover:border-white/30 focus:border-white focus:bg-white/10 placeholder-white/50' : ''}`}
                                value={eventFormData.name}
                                placeholder="Nhập tên sự kiện..."
                                onChange={(e) => setEventFormData({ ...eventFormData, name: e.target.value })}
                            />
                        </div>

                        {/* INLINE EDIT: Thể loại */}
                        <div className={`bg-white/20 backdrop-blur-md text-white px-2 py-1 rounded-full font-bold border border-white/30 flex items-center shadow-xl transition-all ${isInfoTab ? 'group/genre focus-within:bg-white/40' : ''}`}>
                            <Info size={18} className="ml-2" />
                            <input
                                disabled={!isInfoTab}
                                className="bg-transparent border-none outline-none text-white placeholder-white/70 w-32 md:w-40 px-3 py-2 font-bold disabled:opacity-100"
                                value={eventFormData.genre}
                                placeholder="Thể loại..."
                                onChange={(e) => setEventFormData({ ...eventFormData, genre: e.target.value })}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* TAB NAVIGATION */}
            <div className="w-full max-w-6xl mx-auto px-6 lg:px-12 mt-8">
                <div className="flex gap-4 border-b border-gray-200">
                    <button
                        onClick={() => setActiveTab('INFO')}
                        className={`flex items-center gap-2 px-6 py-4 font-semibold text-base transition-colors border-b-2 ${activeTab === 'INFO' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
                    >
                        <Settings size={18} /> Chỉnh sửa Thông tin
                    </button>
                    <button
                        onClick={() => setActiveTab('SHOWS')}
                        className={`flex items-center gap-2 px-6 py-4 font-semibold text-base transition-colors border-b-2 ${activeTab === 'SHOWS' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
                    >
                        <ListVideo size={18} /> Quản lý Shows
                    </button>
                </div>
            </div>


            <div className="w-full max-w-6xl mx-auto px-6 lg:px-12 mt-8">

                {/* TAB 1: THÔNG TIN (UI giống hệt CreateEvent) */}
                {activeTab === 'INFO' && (
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-10 animate-in fade-in">
                        <div className="xl:col-span-2 space-y-10">

                            {/* INLINE EDIT: Description */}
                            <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 relative group/desc hover:shadow-md transition-all">
                                <div className="absolute top-8 right-8 text-gray-300 opacity-0 group-hover/desc:opacity-100"><Edit3 size={20} /></div>
                                <h2 className="text-2xl font-bold text-secondary mb-4">Giới thiệu sự kiện</h2>
                                <textarea
                                    className="w-full bg-transparent outline-none border-2 border-transparent hover:border-gray-100 focus:border-primary/30 focus:bg-gray-50 rounded-xl p-4 -ml-4 text-gray-600 leading-relaxed text-lg resize-none min-h-[200px] transition-all"
                                    value={eventFormData.description}
                                    placeholder="Viết vài lời giới thiệu hấp dẫn về sự kiện của bạn..."
                                    onChange={(e) => setEventFormData({ ...eventFormData, description: e.target.value })}
                                />
                            </div>

                            {/* DATES */}
                            <div>
                                <h2 className="text-2xl font-bold text-secondary mb-4 flex items-center gap-2">
                                    <Calendar className="text-primary" /> Thiết lập thời gian chung
                                </h2>
                                <div className="bg-white border border-primary/20 rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row gap-8 items-center bg-gradient-to-r from-pink-50/50 to-white">
                                    <div className="flex-1 w-full space-y-2">
                                        <label className="text-sm font-bold text-gray-700">Ngày khai mạc</label>
                                        <input
                                            type="datetime-local"
                                            className="w-full bg-white border border-gray-300 rounded-xl p-4 outline-none focus:ring-2 focus:ring-primary/20 font-medium text-secondary shadow-sm"
                                            value={eventFormData.start_date}
                                            onChange={(e) => setEventFormData({ ...eventFormData, start_date: e.target.value })}
                                        />
                                    </div>
                                    <div className="hidden md:block text-gray-300"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg></div>
                                    <div className="flex-1 w-full space-y-2">
                                        <label className="text-sm font-bold text-gray-700">Ngày bế mạc</label>
                                        <input
                                            type="datetime-local"
                                            className="w-full bg-white border border-gray-300 rounded-xl p-4 outline-none focus:ring-2 focus:ring-primary/20 font-medium text-secondary shadow-sm"
                                            value={eventFormData.end_date}
                                            onChange={(e) => setEventFormData({ ...eventFormData, end_date: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
                                <h3 className="font-bold text-lg mb-4 text-secondary flex items-center gap-2"><MapPin size={20} className="text-primary" /> Bản đồ tổng quan</h3>
                                <div className="w-full h-[250px] bg-gray-100 rounded-2xl overflow-hidden relative border border-gray-200">
                                    <img src="https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=800&auto=format&fit=crop" className="w-full h-full object-cover opacity-50 grayscale" alt="map" />
                                    <div className="absolute inset-0 flex items-center justify-center flex-col gap-2">
                                        <span className="bg-white px-6 py-3 rounded-full font-bold text-sm text-secondary shadow-lg text-center">Bản đồ tự động kích hoạt</span>
                                        <span className="text-xs text-gray-500 font-medium bg-white/80 px-3 py-1 rounded-full">Dựa trên Show biểu diễn</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 2: QUẢN LÝ SHOWS (UI List & Create) */}
                {activeTab === 'SHOWS' && (
                    <div className="space-y-6 animate-in fade-in">
                        <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">Danh sách Shows</h2>
                                <p className="text-slate-500 text-sm mt-1">Quản lý lịch diễn và cấu hình vé cho sự kiện này.</p>
                            </div>
                            <Button className="bg-secondary hover:bg-slate-800 text-white shadow-md rounded-full px-6" onClick={() => setShowForm(!showForm)}>
                                {showForm ? "Đóng Form" : <><Plus size={18} className="mr-2" /> Thêm Show Mới</>}
                            </Button>
                        </div>

                        {/* FORM TẠO SHOW (Toàn bộ logic form giữ nguyên như bạn đã viết) */}
                        {showForm && (
                            <form onSubmit={handleCreateAllShow} className="bg-white p-8 rounded-2xl border-2 border-primary/20 space-y-6 shadow-xl animate-in slide-in-from-top-4">
                                <h2 className="text-xl font-bold text-secondary border-b pb-3">Thông tin Show mới</h2>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Tên Show</label>
                                        <input required type="text" className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:border-primary"
                                            value={showData.name} onChange={e => setShowData({ ...showData, name: e.target.value })} />
                                    </div>
                                    <div className="relative">
                                        <label className="block text-sm font-medium mb-1">Nơi tổ chức</label>
                                        <div className="relative">
                                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                            <input type="text" className="w-full border border-gray-300 rounded-lg py-2.5 pl-10 pr-4 outline-none focus:border-primary"
                                                placeholder="Tìm địa điểm..." value={venueSearch}
                                                onChange={e => { setVenueSearch(e.target.value); setShowData({ ...showData, venue_id: '' }); setIsVenueDropdownOpen(true); }}
                                                onFocus={() => setIsVenueDropdownOpen(true)}
                                                onBlur={() => setTimeout(() => setIsVenueDropdownOpen(false), 200)} />
                                        </div>
                                        {isVenueDropdownOpen && (
                                            <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                                {filteredVenues.map((venue: any) => (
                                                    <div key={venue._id} className="px-4 py-3 hover:bg-pink-50 cursor-pointer border-b border-gray-50"
                                                        onMouseDown={() => { setShowData({ ...showData, venue_id: venue._id }); setVenueSearch(venue.name); setIsVenueDropdownOpen(false); }}>
                                                        <div className="font-medium text-gray-900">{venue.name}</div>
                                                        <div className="text-xs text-gray-500 mt-0.5">{venue.address}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Bắt đầu Show</label>
                                        <input required type="datetime-local" className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:border-primary"
                                            value={showData.start_time} onChange={e => setShowData({ ...showData, start_time: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Kết thúc Show</label>
                                        <input required type="datetime-local" className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:border-primary"
                                            value={showData.end_time} onChange={e => setShowData({ ...showData, end_time: e.target.value })} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Mở bán vé lúc</label>
                                        <input required type="datetime-local" className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:border-primary"
                                            value={showData.sale_start} onChange={e => setShowData({ ...showData, sale_start: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Đóng bán vé lúc</label>
                                        <input required type="datetime-local" className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:border-primary"
                                            value={showData.sale_end} onChange={e => setShowData({ ...showData, sale_end: e.target.value })} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start pt-4 border-t border-slate-100">
                                    <div className="xl:col-span-4 border-2 border-dashed border-primary/40 bg-pink-50/50 hover:bg-pink-50 p-8 rounded-2xl text-center h-full flex flex-col justify-center">
                                        <UploadCloud size={40} className="mx-auto text-primary mb-3" />
                                        <h3 className="text-base font-bold text-gray-900 mb-1">Sơ đồ ghế (Seat Map)</h3>
                                        <p className="text-sm text-gray-500 mb-6 mx-auto">Tải lên SVG có ID định dạng <code className="bg-white px-1 border rounded">type-VIP</code> để tự động quét Hạng Vé.</p>
                                        <label className="inline-flex items-center justify-center bg-white border border-primary text-primary px-6 py-2.5 rounded-full font-semibold cursor-pointer hover:bg-primary hover:text-white transition-all shadow-sm">
                                            <span>Chọn File SVG</span>
                                            <input type="file" accept=".svg" className="hidden" onChange={handleSVGUpload} />
                                        </label>
                                        {showData.stadium_map_svg && (
                                            <div className="mt-4 inline-flex items-center justify-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-lg text-sm font-medium">
                                                <CheckCircle2 size={18} /> Đã nạp SVG thành công!
                                            </div>
                                        )}
                                    </div>

                                    <div className="xl:col-span-8 bg-slate-50 border border-slate-200 rounded-2xl p-6 h-full">
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                                <Ticket size={20} className="text-primary" /> Cấu hình Loại Vé
                                            </h3>
                                            <Button type="button" variant="outline" size="sm" className="h-8 text-xs font-bold bg-white"
                                                onClick={() => setTicketTypes([...ticketTypes, { name: '', target_tier: 'NEW', description: '', price: '', is_limited_promo: false, total_quantity: '', sale_start: showData.sale_start, sale_end: showData.sale_end }])}>
                                                <Plus size={14} className="mr-1" /> Thêm vé thủ công
                                            </Button>
                                        </div>

                                        {ticketTypes.length === 0 ? (
                                            <div className="text-center py-10 text-sm text-slate-400 bg-white rounded-xl border border-dashed border-slate-300">
                                                Vui lòng upload Sơ đồ SVG hoặc bấm "Thêm vé" để thiết lập giá vé.
                                            </div>
                                        ) : (
                                            <div className="space-y-4 max-h-[450px] overflow-y-auto pr-2">
                                                {ticketTypes.map((ticket, index) => (
                                                    <div key={index} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative group">
                                                        <div className="flex items-center gap-2 mb-3 bg-slate-100 px-3 py-2 rounded-lg w-fit border border-slate-200">
                                                            <Tag size={14} className="text-slate-500" />
                                                            <span className="text-xs font-bold text-slate-600 uppercase">Mã Hạng (Tier):</span>
                                                            <span className="text-xs font-black text-primary font-mono bg-white px-2 py-0.5 rounded shadow-sm border border-primary/20">{ticket.target_tier}</span>
                                                        </div>

                                                        <div className="grid grid-cols-12 gap-4 mb-3">
                                                            <div className="col-span-12">
                                                                <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Tên hiển thị vé</label>
                                                                <input required type="text" placeholder="VD: Vé VIP Khu Vực A" className="w-full text-sm border border-slate-200 rounded p-2 outline-none focus:border-primary bg-slate-50 font-bold text-slate-800"
                                                                    value={ticket.name} onChange={e => { const arr = [...ticketTypes]; arr[index].name = e.target.value; setTicketTypes(arr); }} />
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-12 gap-4 mb-3">
                                                            <div className="col-span-5">
                                                                <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Giá vé (VNĐ)</label>
                                                                <input required type="number" min="0" placeholder="0" className="w-full text-sm border border-slate-200 rounded p-2 outline-none focus:border-primary font-bold text-orange-600 bg-slate-50"
                                                                    value={ticket.price} onChange={e => { const arr = [...ticketTypes]; arr[index].price = e.target.value ? Number(e.target.value) : ''; setTicketTypes(arr); }} />
                                                            </div>
                                                            <div className="col-span-4">
                                                                <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">SL Giới hạn</label>
                                                                <input type="number" min="1" placeholder="Theo số ghế" className="w-full text-sm border border-slate-200 rounded p-2 outline-none focus:border-primary bg-slate-50"
                                                                    value={ticket.total_quantity} onChange={e => { const arr = [...ticketTypes]; arr[index].total_quantity = e.target.value ? Number(e.target.value) : ''; setTicketTypes(arr); }} />
                                                            </div>
                                                            <div className="col-span-3 flex items-center pt-5">
                                                                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer text-slate-600 hover:text-primary transition-colors">
                                                                    <input type="checkbox" className="w-4 h-4 rounded text-primary focus:ring-primary"
                                                                        checked={ticket.is_limited_promo} onChange={e => { const arr = [...ticketTypes]; arr[index].is_limited_promo = e.target.checked; setTicketTypes(arr); }} />
                                                                    Vé Promo
                                                                </label>
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-2 gap-4 mb-3">
                                                            <div>
                                                                <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 flex items-center gap-1"><CalendarClock size={10} /> Mở bán</label>
                                                                <input required type="datetime-local" className="w-full text-xs border border-slate-200 rounded p-2 outline-none focus:border-primary bg-slate-50"
                                                                    value={ticket.sale_start} onChange={e => { const arr = [...ticketTypes]; arr[index].sale_start = e.target.value; setTicketTypes(arr); }} />
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 flex items-center gap-1"><CalendarClock size={10} /> Đóng bán</label>
                                                                <input required type="datetime-local" className="w-full text-xs border border-slate-200 rounded p-2 outline-none focus:border-primary bg-slate-50"
                                                                    value={ticket.sale_end} onChange={e => { const arr = [...ticketTypes]; arr[index].sale_end = e.target.value; setTicketTypes(arr); }} />
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Mô tả thêm</label>
                                                            <input type="text" placeholder="Nhập các quyền lợi đi kèm..." className="w-full text-xs border border-slate-200 rounded p-2 outline-none focus:border-primary bg-slate-50"
                                                                value={ticket.description} onChange={e => { const arr = [...ticketTypes]; arr[index].description = e.target.value; setTicketTypes(arr); }} />
                                                        </div>

                                                        <button type="button" className="absolute top-2 right-2 text-slate-400 hover:text-white hover:bg-red-500 bg-slate-100 rounded-md p-1.5 transition-all opacity-0 group-hover:opacity-100"
                                                            onClick={() => setTicketTypes(ticketTypes.filter((_, i) => i !== index))}>
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="pt-2 flex justify-end gap-3 border-t border-slate-100 mt-6">
                                    <Button type="button" variant="outline" className="px-6 rounded-full" onClick={() => setShowForm(false)}>Hủy</Button>
                                    <Button type="submit" disabled={isSubmittingShow} className="bg-primary text-white px-8 rounded-full shadow-lg">
                                        {isSubmittingShow ? "Đang xử lý..." : "Lưu Show & Cấu hình Vé"}
                                    </Button>
                                </div>
                            </form>
                        )}

                        {/* Danh sách các Show */}
                        {isLoadingShows ? (
                            <p className="text-gray-500 animate-pulse text-center py-10">Đang tải danh sách show...</p>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {shows.length === 0 ? (
                                    <p className="text-gray-500 col-span-full bg-white p-12 text-center rounded-2xl border border-dashed border-slate-300">
                                        Chưa có show nào được tạo cho sự kiện này.<br />Bấm "+ Thêm Show Mới" để bắt đầu!
                                    </p>
                                ) : (
                                    shows.map((show: any) => (
                                        <div
                                            key={show._id}
                                            // 🔥 THÊM SỰ KIỆN onClick VÀO THẺ DIV GỐC CỦA CARD
                                            onClick={() => navigate(`/organizer/events/${eventId}/shows/${show._id}`)}
                                            className="bg-white border border-slate-200 rounded-2xl p-6 hover:border-primary/50 cursor-pointer transition-all shadow-sm hover:shadow-lg group"
                                        >
                                            <div className="flex justify-between items-start mb-4">
                                                <h3 className="font-bold text-lg text-slate-800 group-hover:text-primary transition-colors line-clamp-2">{show.name}</h3>
                                                {/* Hiển thị badge tùy theo status của show */}
                                                <span className={`shrink-0 text-[10px] font-black uppercase px-2 py-1 rounded-md ${show.status === 'published' ? 'bg-green-100 text-green-700' :
                                                    show.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                                                    }`}>
                                                    {show.status || 'Draft'}
                                                </span>
                                            </div>

                                            <div className="space-y-2 mb-6">
                                                <p className="text-sm text-slate-500 flex items-center gap-2">
                                                    <CalendarClock size={16} className="text-slate-400" />
                                                    {new Date(show.start_time).toLocaleString('vi-VN')}
                                                </p>
                                            </div>

                                            <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                                                <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg">
                                                    Đã thiết lập Zone
                                                </span>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-primary hover:bg-primary/10 hover:text-primary"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigate(`/organizer/events/${eventId}/shows/${show._id}`);
                                                    }}
                                                >
                                                    Chi tiết
                                                </Button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ========================================== */}
            {/* 3. THANH CÔNG CỤ NỔI (Chỉ xuất hiện ở Tab INFO) */}
            {/* ========================================== */}
            {activeTab === 'INFO' && (
                <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-50 animate-in slide-in-from-bottom-10">
                    <div className="max-w-6xl mx-auto px-6 lg:px-12 py-4 flex items-center justify-between">
                        <div className="hidden sm:block">
                            <p className="font-bold text-secondary text-lg">Bạn đang ở chế độ: Page Builder</p>
                            <p className="text-sm text-gray-500">Mọi thay đổi thông tin Sự kiện sẽ được lưu lại.</p>
                        </div>

                        <div className="flex gap-4 w-full sm:w-auto">
                            <Button variant="outline" className="flex-1 sm:flex-none border-gray-300 px-8 rounded-full font-bold" onClick={() => navigate('/organizer/events')}>
                                <X size={18} className="mr-2" /> Hủy
                            </Button>

                            <Button
                                onClick={handleUpdateEvent}
                                disabled={isUpdatingEvent}
                                className="flex-1 sm:flex-none bg-primary hover:bg-pink-700 text-white px-10 rounded-full font-bold shadow-lg shadow-pink-200 transition-transform hover:-translate-y-1"
                            >
                                <Save size={18} className="mr-2" /> {isUpdatingEvent ? "Đang lưu..." : "Lưu Thay Đổi Sự Kiện"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}