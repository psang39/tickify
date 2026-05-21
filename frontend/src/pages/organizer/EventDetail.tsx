import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axiosClient';
import { ErrorModal } from '@/components/shared/ErrorModal';
import {
    UploadCloud, Search, CheckCircle2, Plus, Trash2, Ticket,
    CalendarClock, Tag, Settings, ListVideo, Save, ArrowLeft,
    Image as ImageIcon, MapPin, Calendar, Info, Edit3, X, EyeOff, Globe, Ban, Move, Mic2, Check
} from 'lucide-react';

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
    const location = useLocation();
    // STATE LƯU THÔNG BÁO LỖI CHO ERROR MODAL
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // ĐIỀU HƯỚNG TABS
    const [activeTab, setActiveTab] = useState<'INFO' | 'SHOWS'>('INFO');

    // ==========================================
    // DATA CỦA TAB 1: THÔNG TIN SỰ KIỆN (EVENT)
    // ==========================================
    const [eventFormData, setEventFormData] = useState({
        name: '', description: '', genre: 'Pop / Concert', artists: '', poster_url: '', banner_url: '', banner_offset_y: 50,
        start_date: '', end_date: ''
    });
    const [currentStatus, setCurrentStatus] = useState<'draft' | 'published' | 'cancelled'>('draft');

    // STATE KÉO THẢ ẢNH BÌA (DRAG & DROP)
    const [isRepositioning, setIsRepositioning] = useState(false);
    const [dragState, setDragState] = useState({ isDragging: false, startY: 0 });

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
                artists: eventData.artists || '',
                poster_url: eventData.poster_url || '',
                banner_url: eventData.banner_url || '',
                banner_offset_y: typeof eventData.banner_offset_y === 'number' ? eventData.banner_offset_y : 50,
                start_date: eventData.start_date ? new Date(eventData.start_date).toISOString().slice(0, 16) : '',
                end_date: eventData.end_date ? new Date(eventData.end_date).toISOString().slice(0, 16) : '',
            });
            setCurrentStatus(eventData.status || 'draft');
        }
    }, [eventData]);

    // LOGIC KÉO THẢ BANNER
    const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isRepositioning) return;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        setDragState({ isDragging: true, startY: clientY });
    };

    const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isRepositioning || !dragState.isDragging) return;

        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        const deltaY = clientY - dragState.startY;

        let newOffset = eventFormData.banner_offset_y - (deltaY * 0.15);
        if (newOffset < 0) newOffset = 0;
        if (newOffset > 100) newOffset = 100;

        setEventFormData(prev => ({ ...prev, banner_offset_y: newOffset }));
        setDragState({ isDragging: true, startY: clientY });
    };

    const handleMouseUp = () => {
        if (!isRepositioning) return;
        setDragState({ isDragging: false, startY: 0 });
    };

    // Hàm upload ảnh từ máy tính (Xử lý Base64 đồng bộ)
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'banner' | 'poster') => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                setErrorMessage("Định dạng tập tin không hợp lệ. Vui lòng chỉ chọn file hình ảnh.");
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result as string;
                if (type === 'banner') {
                    setEventFormData(prev => ({ ...prev, banner_url: base64String, banner_offset_y: 50 }));
                } else {
                    setEventFormData(prev => ({ ...prev, poster_url: base64String }));
                }
            };
            reader.readAsDataURL(file);
        }
    };

    // MUTATION: CẬP NHẬT THÔNG TIN FORM THÔ
    const { mutateAsync: updateEventMutation, isPending: isUpdatingEvent } = useMutation({
        mutationFn: async (updatedData: any) => {
            const response = await api.put(`/organizer/events/${eventId}`, updatedData);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['organizer-event-detail', eventId] });
            alert("Cập nhật thông tin sự kiện thành công.");
        },
        onError: (error: any) => {
            setErrorMessage(error.response?.data?.message || "Lỗi cập nhật sự kiện.");
        }
    });

    // MUTATION: CÔNG KHAI SỰ KIỆN (PUBLISH)
    const { mutateAsync: publishEventMutation, isPending: isPublishingEvent } = useMutation({
        mutationFn: async () => {
            const response = await api.post(`/organizer/events/${eventId}/publish`);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['organizer-event-detail', eventId] });
            alert("Công khai Sự kiện thành công. Các đêm diễn con bên trong đã sẵn sàng mở bán.");
        },
        onError: (error: any) => {
            setErrorMessage(error.response?.data?.message || "Không thể công khai Sự kiện này.");
        }
    });

    // MUTATION: TẠM DỪNG SỰ KIỆN (UNPUBLISH)
    const { mutateAsync: unpublishEventMutation, isPending: isUnpublishingEvent } = useMutation({
        mutationFn: async () => {
            const response = await api.post(`/organizer/events/${eventId}/unpublish`);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['organizer-event-detail', eventId] });
            alert("Đã tạm dừng sự kiện, toàn bộ dữ liệu đêm diễn con chưa phát sinh giao dịch đã được hạ về bản nháp.");
        },
        onError: (error: any) => {
            setErrorMessage(error.response?.data?.message || "Không thể tạm dừng Sự kiện.");
        }
    });

    // MUTATION: HỦY SỰ KIỆN KHẨN CẤP (CANCEL)
    const { mutateAsync: cancelEventMutation, isPending: isCancellingEvent } = useMutation({
        mutationFn: async () => {
            const response = await api.post(`/organizer/events/${eventId}/cancel`);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['organizer-event-detail', eventId] });
            alert("Đã hủy thành công toàn bộ sự kiện và các đêm diễn trực thuộc.");
        },
        onError: (error: any) => {
            setErrorMessage(error.response?.data?.message || "Không thể thực hiện hủy Sự kiện.");
        }
    });

    const handleUpdateEvent = async () => {
        if (!eventFormData.start_date || !eventFormData.end_date) {
            setErrorMessage("Vui lòng chọn ngày bắt đầu và ngày kết thúc cho sự kiện trước khi lưu.");
            return;
        }
        await updateEventMutation(eventFormData);
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
                setErrorMessage("Vui lòng chỉ tải lên file định dạng hình ảnh cấu trúc chuẩn SVG.");
                return;
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
                } catch (err) { console.error("Lỗi khi phân tích sơ đồ SVG:", err); }
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
            alert("Tạo Show và Cấu hình Vé thành công.");
            setShowForm(false);
            queryClient.invalidateQueries({ queryKey: ['event-shows', eventId] });
            setShowData({ name: '', description: '', start_time: '', end_time: '', venue_id: '', sale_start: '', sale_end: '', stadium_map_svg: '' });
            setTicketTypes([]);
            setVenueSearch('');
        } catch (error: any) {
            setErrorMessage(error.response?.data?.message || "Có lỗi xảy ra trong quá trình lưu dữ liệu show!");
        } finally {
            setIsSubmittingShow(false);
        }
    };

    const filteredVenues = venues.filter((v: any) => v.name.toLowerCase().includes(venueSearch.toLowerCase()));

    if (isLoadingEvent) return <div className="p-10 text-center font-medium text-gray-500 animate-pulse">Đang tải thông tin sự kiện...</div>;
    if (!eventData) return <div className="p-10 text-center font-bold text-red-500">Không tìm thấy sự kiện!</div>;

    const isInfoTab = activeTab === 'INFO';
    const isAnyActionPending = isUpdatingEvent || isPublishingEvent || isUnpublishingEvent || isCancellingEvent;

    return (
        <div className="min-h-screen bg-[#F8F9FA] relative pb-24 font-sans w-full overflow-x-hidden">
            {/* THÀNH PHẦN MODAL LỖI TẬP TRUNG CHUNG */}
            <ErrorModal message={errorMessage} onClose={() => setErrorMessage(null)} />

            {/* NÚT QUAY LẠI TÌM VỀ DANH SÁCH SỰ KIỆN */}
            <button
                onClick={() => navigate('/organizer/events')}
                className="absolute top-6 left-6 z-20 bg-black/40 hover:bg-black/70 text-white p-2.5 rounded-full backdrop-blur-md transition-all border border-transparent"
            >
                <ArrowLeft size={24} />
            </button>

            {/* ========================================== */}
            {/* 1. KHU VỰC BANNER TRÀN VIỀN VÀ KÉO THẢ VỊ TRÍ */}
            {/* ========================================== */}
            <div
                className={`relative w-full h-[300px] md:h-[450px] bg-gray-900 overflow-hidden select-none transition-all ${isRepositioning ? (dragState.isDragging ? 'cursor-grabbing' : 'cursor-grab') : (isInfoTab && currentStatus === 'draft' ? 'group' : '')}`}
                onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
                onTouchStart={handleMouseDown} onTouchMove={handleMouseMove} onTouchEnd={handleMouseUp}
            >
                {eventFormData.banner_url ? (
                    <img
                        src={eventFormData.banner_url}
                        alt="Banner"
                        draggable={false}
                        className={`w-full h-full object-cover transition-opacity duration-300 ${isRepositioning ? 'opacity-100 scale-[1.02]' : 'opacity-80'}`}
                        style={{ objectPosition: `50% ${eventFormData.banner_offset_y}%` }}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500"><ImageIcon size={64} /></div>
                )}

                {isRepositioning && (
                    <div className="absolute inset-0 bg-black/30 bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:50px_50px] pointer-events-none"></div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none transition-opacity duration-300" style={{ opacity: isRepositioning ? 0 : 1 }}></div>

                {/* THANH ĐIỀU KHIỂN ĐỔI ẢNH / CĂN CHỈNH BANNER */}
                {isInfoTab && currentStatus === 'draft' && (
                    <div className="absolute top-6 right-6 z-20 flex gap-2">
                        {isRepositioning ? (
                            <div className="flex gap-2 bg-black/60 p-1.5 rounded-lg backdrop-blur-md animate-in fade-in">
                                <span className="flex items-center text-white text-sm font-medium px-3"><Move size={16} className="mr-2" /> Kéo để căn chỉnh</span>
                                <Button size="sm" className="bg-white text-black hover:bg-gray-200" onClick={() => setIsRepositioning(false)}>
                                    <Check size={16} className="mr-1" /> Xong
                                </Button>
                            </div>
                        ) : (
                            <>
                                <Button variant="outline" className="bg-black/50 text-white border-white/30 backdrop-blur-md hover:bg-white hover:text-black transition-all opacity-0 group-hover:opacity-100" onClick={() => setIsRepositioning(true)}>
                                    <Move size={16} className="mr-2" /> Chỉnh vị trí
                                </Button>
                                <label className="inline-flex items-center justify-center px-4 py-2 bg-black/50 text-white border border-white/30 rounded-md backdrop-blur-md hover:bg-white hover:text-black transition-all opacity-0 group-hover:opacity-100 cursor-pointer text-sm font-medium shadow-none">
                                    <UploadCloud size={16} className="mr-2" /> Đổi Banner
                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'banner')} />
                                </label>
                            </>
                        )}
                    </div>
                )}

                {/* TEXT TRÊN BANNER (Mờ đi khi đang Drag định vị) */}
                <div className={`absolute bottom-8 left-0 w-full px-6 lg:px-12 flex justify-center transition-all duration-300 ${isRepositioning ? 'opacity-20 pointer-events-none blur-sm' : 'opacity-100'}`}>
                    <div className="w-full max-w-6xl flex flex-col justify-end gap-2">
                        <div className="flex flex-wrap items-center justify-between gap-4 w-full">
                            <div className={`bg-white/20 backdrop-blur-md text-white px-1 py-0.5 rounded-full font-semibold border border-white/30 flex items-center w-fit focus-within:bg-white/40 transition-all ${isInfoTab && currentStatus === 'draft' ? '' : 'pointer-events-none opacity-90'}`}>
                                <Info size={14} className="ml-2 opacity-80" />
                                <input
                                    disabled={!isInfoTab || currentStatus !== 'draft'}
                                    className="bg-transparent border-none outline-none text-white placeholder-white/70 w-36 px-2 py-1 text-sm font-semibold disabled:cursor-not-allowed"
                                    value={eventFormData.genre} placeholder="Thể loại..." onChange={(e) => setEventFormData({ ...eventFormData, genre: e.target.value })}
                                />
                            </div>

                            {/* BADGE TRẠNG THÁI KHỚP LỆNH MẶT BẰNG */}
                            <div className="flex items-center gap-2 px-3 py-1.5 border border-white/20 rounded-md bg-black/40 text-white backdrop-blur-md text-xs font-bold uppercase tracking-wider select-none">
                                <span>Mặt bằng:</span>
                                {currentStatus === 'draft' && <span className="text-slate-300 flex items-center gap-1"><EyeOff size={12} /> Bản nháp</span>}
                                {currentStatus === 'published' && <span className="text-green-400 flex items-center gap-1"><Globe size={12} /> Công khai</span>}
                                {currentStatus === 'cancelled' && <span className="text-red-400 flex items-center gap-1"><Ban size={12} /> Đã hủy</span>}
                            </div>
                        </div>

                        <div className={`w-full relative ${isInfoTab && currentStatus === 'draft' ? 'group/title' : ''}`}>
                            {isInfoTab && currentStatus === 'draft' && <Edit3 size={20} className="absolute -left-8 top-3 text-white/50 opacity-0 group-hover/title:opacity-100 transition-opacity hidden md:block" />}
                            <textarea
                                rows={2}
                                disabled={!isInfoTab || currentStatus !== 'draft'}
                                className={`w-full bg-transparent border-b-2 border-transparent outline-none text-3xl md:text-4xl lg:text-5xl font-black text-white leading-tight drop-shadow-xl transition-all p-2 -ml-2 rounded-t-lg placeholder-white/50 resize-none overflow-hidden disabled:cursor-not-allowed ${isInfoTab && currentStatus === 'draft' ? 'hover:border-white/30 focus:border-white focus:bg-white/10' : ''}`}
                                value={eventFormData.name} placeholder="Nhập tên sự kiện..." onChange={(e) => setEventFormData({ ...eventFormData, name: e.target.value })}
                            />
                        </div>

                        <div className={`w-full relative ${isInfoTab && currentStatus === 'draft' ? 'group/artist' : ''} mt-[-8px]`}>
                            {isInfoTab && currentStatus === 'draft' && <Mic2 size={16} className="absolute -left-7 top-3 text-white/50 opacity-0 group-hover/artist:opacity-100 transition-opacity hidden md:block" />}
                            <input
                                type="text"
                                disabled={!isInfoTab || currentStatus !== 'draft'}
                                className={`w-full bg-transparent border-b border-transparent outline-none text-lg md:text-xl text-white/90 font-medium drop-shadow-md transition-all p-1 -ml-1 rounded placeholder-white/40 disabled:cursor-not-allowed ${isInfoTab && currentStatus === 'draft' ? 'hover:border-white/20 focus:border-white/50' : ''}`}
                                value={eventFormData.artists} placeholder="Nghệ sĩ biểu diễn (Optional)..." onChange={(e) => setEventFormData({ ...eventFormData, artists: e.target.value })}
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

                {/* TAB 1: THÔNG TIN (Hỗ trợ khóa form an toàn giống CreateEvent) */}
                {activeTab === 'INFO' && (
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-10 animate-in fade-in">
                        <div className="xl:col-span-2 space-y-10">

                            {currentStatus === 'published' && (
                                <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-xl flex items-start gap-2.5 text-sm font-medium">
                                    <Info size={18} className="shrink-0 mt-0.5" />
                                    <span>Sự kiện này hiện đang mở hiển thị công khai trên sàn. Để điều chỉnh thông tin mô tả chi tiết hoặc mốc ngày bế mạc, vui lòng lựa chọn hành động "Tạm dừng sự kiện" bên dưới.</span>
                                </div>
                            )}

                            {/* Description */}
                            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-100 relative group/desc">
                                {currentStatus === 'draft' && <div className="absolute top-6 right-6 text-gray-300 opacity-0 group-hover/desc:opacity-100"><Edit3 size={18} /></div>}
                                <h2 className="text-xl font-bold text-secondary mb-3">Giới thiệu sự kiện</h2>
                                <textarea
                                    disabled={currentStatus !== 'draft'}
                                    className="w-full bg-transparent outline-none border-2 border-transparent hover:border-gray-100 focus:border-primary/30 focus:bg-gray-50 rounded-xl p-3 -ml-3 text-gray-600 leading-relaxed text-base resize-none min-h-[150px] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                                    value={eventFormData.description} placeholder="Viết vài lời giới thiệu hấp dẫn về sự kiện của bạn..."
                                    onChange={(e) => setEventFormData({ ...eventFormData, description: e.target.value })}
                                />
                            </div>

                            {/* DATES */}
                            <div>
                                <h2 className="text-xl font-bold text-secondary mb-3 flex items-center gap-2">
                                    <Calendar className="text-primary" size={20} /> Thiết lập thời gian chung
                                </h2>
                                <div className="bg-white border border-gray-200 rounded-2xl p-6 flex flex-col md:flex-row gap-6 items-center bg-gradient-to-r from-slate-50 to-white">
                                    <div className="flex-1 w-full space-y-1.5">
                                        <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Ngày khai mạc</label>
                                        <input type="datetime-local" disabled={currentStatus !== 'draft'} className="w-full bg-white border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-primary/20 font-medium text-sm text-secondary disabled:opacity-60 disabled:cursor-not-allowed" value={eventFormData.start_date} onChange={(e) => setEventFormData({ ...eventFormData, start_date: e.target.value })} />
                                    </div>
                                    <div className="hidden md:block text-gray-300"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg></div>
                                    <div className="flex-1 w-full space-y-1.5">
                                        <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Ngày bế mạc</label>
                                        <input type="datetime-local" disabled={currentStatus !== 'draft'} className="w-full bg-white border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-primary/20 font-medium text-sm text-secondary disabled:opacity-60 disabled:cursor-not-allowed" value={eventFormData.end_date} onChange={(e) => setEventFormData({ ...eventFormData, end_date: e.target.value })} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Poster */}
                        <div className="space-y-6">
                            <div className="bg-white rounded-2xl p-6 border border-gray-100 flex flex-col h-full">
                                <h3 className="font-bold text-lg mb-1 text-secondary flex items-center gap-2">Ảnh Poster (Dọc)</h3>
                                <p className="text-xs text-gray-500 mb-4">Tỉ lệ chuẩn 3:4. Dùng để hiển thị ở trang danh sách sự kiện.</p>

                                <div className="w-full flex-1 min-h-[300px] bg-slate-50 rounded-xl overflow-hidden relative border-2 border-dashed border-gray-200 transition-colors group">
                                    {eventFormData.poster_url ? (
                                        <img src={eventFormData.poster_url} className="w-full h-full object-cover" alt="Poster" />
                                    ) : (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                                            <ImageIcon size={40} className="mb-2 opacity-50" />
                                            <span className="text-sm font-medium">Chưa có Poster</span>
                                        </div>
                                    )}

                                    {currentStatus === 'draft' && (
                                        <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                            <span className="bg-white text-secondary font-bold text-sm px-4 py-2 rounded-full flex items-center">
                                                <UploadCloud size={16} className="mr-2" /> Chọn Ảnh
                                            </span>
                                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'poster')} />
                                        </label>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 2: QUẢN LÝ SHOWS (UI List & Create) */}
                {activeTab === 'SHOWS' && (
                    <div className="space-y-6 animate-in fade-in">
                        <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">Danh sách Shows</h2>
                                <p className="text-slate-500 text-sm mt-1">Quản lý lịch diễn và cấu hình vé cho sự kiện này.</p>
                            </div>
                            <Button disabled={currentStatus === 'draft'} className="bg-secondary hover:bg-slate-800 text-white rounded-full px-6 disabled:opacity-40 disabled:cursor-not-allowed" onClick={() => setShowForm(!showForm)}>
                                {showForm ? "Đóng Form" : <><Plus size={18} className="mr-2" /> Thêm Show Mới</>}
                            </Button>
                        </div>

                        {currentStatus === 'draft' && (
                            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl flex items-start gap-2.5 text-sm font-medium">
                                <Info size={18} className="shrink-0 mt-0.5" />
                                <span>Vui lòng chọn hành động "Kích hoạt Sự kiện" ở thanh bên dưới trước khi khởi tạo hoặc mở rộng các đêm diễn (Show) bên trong.</span>
                            </div>
                        )}

                        {/* FORM TẠO SHOW */}
                        {showForm && currentStatus !== 'draft' && (
                            <form onSubmit={handleCreateAllShow} className="bg-white p-8 rounded-2xl border border-slate-200 space-y-6 animate-in slide-in-from-top-4">
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
                                            <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg max-h-60 overflow-y-auto">
                                                {filteredVenues.map((venue: any) => (
                                                    <div key={venue._id} className="px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-gray-50"
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
                                    <div className="xl:col-span-4 border-2 border-dashed border-gray-200 bg-slate-50/50 hover:bg-slate-50 p-8 rounded-2xl text-center h-full flex flex-col justify-center">
                                        <UploadCloud size={40} className="mx-auto text-primary mb-3" />
                                        <h3 className="text-base font-bold text-gray-900 mb-1">Sơ đồ ghế (Seat Map)</h3>
                                        <p className="text-sm text-gray-500 mb-6 mx-auto">Tải lên SVG có ID định dạng <code className="bg-white px-1 border rounded">type-VIP</code> để tự động quét Hạng Vé.</p>
                                        <label className="inline-flex items-center justify-center bg-white border border-gray-200 text-slate-700 px-6 py-2.5 rounded-full font-semibold cursor-pointer hover:bg-slate-50 transition-all">
                                            <span>Chọn File SVG</span>
                                            <input type="file" accept=".svg" className="hidden" onChange={handleSVGUpload} />
                                        </label>
                                        {showData.stadium_map_svg && (
                                            <div className="mt-4 inline-flex items-center justify-center gap-2 bg-green-50 text-green-700 px-4 py-2 rounded-lg text-sm font-medium border border-green-100">
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
                                                    <div key={index} className="bg-white p-4 rounded-xl border border-slate-200 relative group">
                                                        <div className="flex items-center gap-2 mb-3 bg-slate-100 px-3 py-2 rounded-lg w-fit border border-slate-200">
                                                            <Tag size={14} className="text-slate-500" />
                                                            <span className="text-xs font-bold text-slate-600 uppercase">Mã Hạng (Tier):</span>
                                                            <span className="text-xs font-black text-primary font-mono bg-white px-2 py-0.5 rounded border border-primary/20">{ticket.target_tier}</span>
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
                                    <Button type="submit" disabled={isSubmittingShow} className="bg-primary text-white px-8 rounded-full">
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
                                            onClick={() => navigate(`/organizer/events/${eventId}/shows/${show._id}`)}
                                            className="bg-white border border-slate-200 rounded-2xl p-6 hover:border-primary/50 cursor-pointer transition-all group"
                                        >
                                            <div className="flex justify-between items-start mb-4">
                                                <h3 className="font-bold text-lg text-slate-800 group-hover:text-primary transition-colors line-clamp-2">{show.name}</h3>
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
            {/* 3. THANH CÔNG CỤ NỔI VỚI NÚT HÀNH ĐỘNG CÁCH 2 */}
            {/* ========================================== */}
            {activeTab === 'INFO' && (
                <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 z-50">
                    <div className="max-w-6xl mx-auto px-6 lg:px-12 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">

                        {/* CỤM ĐIỀU HƯỚNG TRẠNG THÁI EVENT TÁCH BIỆT (CÁCH 2 MÁY TRẠNG THÁI) */}
                        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                            {currentStatus === 'draft' && (
                                <Button
                                    type="button"
                                    disabled={isAnyActionPending}
                                    onClick={async () => {
                                        if (window.confirm("Xác nhận đưa sự kiện này công khai lên sàn? Các show diễn con bên trong lúc này mới đủ điều kiện mở bán.")) {
                                            await publishEventMutation();
                                        }
                                    }}
                                    className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white px-6 rounded-full font-bold text-sm"
                                >
                                    <Globe size={16} className="mr-1.5" /> Kích hoạt Sự kiện
                                </Button>
                            )}

                            {currentStatus === 'published' && (
                                <Button
                                    type="button"
                                    disabled={isAnyActionPending}
                                    onClick={async () => {
                                        if (window.confirm("Xác nhận tạm dừng sự kiện? Toàn bộ các đêm diễn con chưa bán vé sẽ tự động thu hồi trạng thái về dạng Bản nháp.")) {
                                            await unpublishEventMutation();
                                        }
                                    }}
                                    className="w-full sm:w-auto bg-slate-600 hover:bg-slate-700 text-white px-6 rounded-full font-bold text-sm"
                                >
                                    <EyeOff size={16} className="mr-1.5" /> Tạm dừng sự kiện
                                </Button>
                            )}

                            {currentStatus !== 'cancelled' && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={isAnyActionPending}
                                    onClick={async () => {
                                        if (window.confirm("CẢNH BÁO NGUY HIỂM: Xác nhận HỦY VĨNH VIỄN sự kiện này? Toàn bộ lịch trình bán vé các đêm diễn con sẽ dừng hoạt động ngay lập tức.")) {
                                            await cancelEventMutation();
                                        }
                                    }}
                                    className="w-full sm:w-auto border-red-200 text-red-600 hover:bg-red-50 px-6 rounded-full font-bold text-sm"
                                >
                                    <Ban size={16} className="mr-1.5" /> Hủy bỏ Sự kiện
                                </Button>
                            )}
                        </div>

                        {/* CỤM NÚT TƯƠNG TÁC BIỂU MẪU (FORM ACTIONS) */}
                        <div className="flex gap-3 w-full sm:w-auto justify-end">
                            <Button variant="outline" className="flex-1 sm:flex-none border-gray-300 px-6 rounded-full font-bold text-sm" onClick={() => navigate('/organizer/events')}>
                                <X size={16} className="mr-1.5" /> Thoát
                            </Button>

                            <Button
                                onClick={handleUpdateEvent}
                                disabled={isAnyActionPending || currentStatus !== 'draft'}
                                className="flex-1 sm:flex-none bg-primary hover:bg-primary/90 text-white px-8 rounded-full font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Save size={16} className="mr-1.5" /> {isUpdatingEvent ? "Đang lưu..." : "Lưu Thay Đổi"}
                            </Button>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}