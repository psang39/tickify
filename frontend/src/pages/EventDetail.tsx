import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axiosClient';
import { UploadCloud, Search, CheckCircle2, Plus, Trash2, Ticket, CalendarClock, Tag } from 'lucide-react';

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
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [ticketTypes, setTicketTypes] = useState<TicketTypeForm[]>([]);
    const [showData, setShowData] = useState({
        name: '', description: '', start_time: '', end_time: '',
        venue_id: '', sale_start: '', sale_end: '', stadium_map_svg: ''
    });

    const [venueSearch, setVenueSearch] = useState('');
    const [isVenueDropdownOpen, setIsVenueDropdownOpen] = useState(false);

    const { data: eventData, isLoading: isLoadingEvent } = useQuery({
        queryKey: ['organizer-event-detail', eventId],
        queryFn: async () => {
            const response = await api.get(`/organizer/events/${eventId}`);
            return response.data?.data || response.data;
        },
        enabled: !!eventId
    });

    const { data: shows = [], isLoading: isLoadingShows } = useQuery({
        queryKey: ['event-shows', eventId],
        queryFn: async () => {
            const response = await api.get(`/organizer/events/${eventId}/shows`);
            return response.data?.data || response.data || [];
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

    const { mutateAsync: createShow, isPending: isCreatingShow } = useMutation({
        mutationFn: async (newShowData: any) => {
            const response = await api.post(`/events/${eventId}/shows`, newShowData);
            return response.data;
        }
    });

    const { mutateAsync: createTicketType } = useMutation({
        mutationFn: async (newTicketData: any) => {
            const response = await api.post(`/organizer/events/${eventId}/ticket-types`, newTicketData);
            return response.data;
        }
    });

    const [isSubmitting, setIsSubmitting] = useState(false);

    // 🔥 LOGIC MỚI: TÌM "type-XYZ" TRONG SVG
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

                    // Tìm tất cả các element có chứa chuỗi "type-" trong ID hoặc Class
                    const elements = doc.querySelectorAll('[id*="Type-"], [class*="Type-"], [data-type]');
                    const foundTiers = new Set<string>();

                    elements.forEach(el => {
                        const id = el.id || '';
                        const cls = el.getAttribute('class') || '';

                        // Dùng Regex bóc tách chữ XYZ đằng sau "type-"
                        const matchId = id.match(/type-([a-zA-Z0-9]+)/i);
                        const matchCls = cls.match(/type-([a-zA-Z0-9]+)/i);

                        if (matchId) foundTiers.add(matchId[1].toUpperCase());
                        else if (matchCls) foundTiers.add(matchCls[1].toUpperCase());
                    });

                    if (foundTiers.size > 0) {
                        const newTicketTypes: TicketTypeForm[] = Array.from(foundTiers).map(tier => ({
                            name: `Vé ${tier}`,
                            target_tier: tier, // Khóa cứng tier ở đây
                            description: `Quyền lợi vé ${tier}`,
                            price: '',
                            is_limited_promo: false,
                            total_quantity: '',
                            sale_start: showData.sale_start || '',
                            sale_end: showData.sale_end || ''
                        }));
                        setTicketTypes(newTicketTypes);
                    } else {
                        // Nếu không tìm thấy, cho phép nhập tay 1 vé mặc định
                        setTicketTypes([{ name: '', target_tier: 'DEFAULT', description: '', price: '', is_limited_promo: false, total_quantity: '', sale_start: showData.sale_start, sale_end: showData.sale_end }]);
                    }
                } catch (err) {
                    console.error("Lỗi khi phân tích SVG:", err);
                }
            };
            reader.readAsText(file);
        }
    };

    const handleCreateAll = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!showData.venue_id || !showData.stadium_map_svg) {
            alert("Vui lòng chọn địa điểm và upload sơ đồ ghế!"); return;
        }
        if (ticketTypes.length === 0 || ticketTypes.some(t => !t.target_tier || !t.name || t.price === '')) {
            alert("Vui lòng nhập đầy đủ Tên, Hạng và Giá cho các loại vé!"); return;
        }

        setIsSubmitting(true);
        try {
            await createShow({
                name: showData.name,
                description: showData.description,
                start_time: showData.start_time,
                end_time: showData.end_time,
                venue_id: showData.venue_id,
                sale_start: showData.sale_start,
                sale_end: showData.sale_end,
                stadium_map_svg: showData.stadium_map_svg
            });

            const ticketPromises = ticketTypes.map(tt => {
                const payload = {
                    ...tt,
                    price: Number(tt.price),
                    total_quantity: tt.total_quantity !== '' ? Number(tt.total_quantity) : null
                };
                return createTicketType(payload);
            });
            await Promise.all(ticketPromises);

            alert("Tạo Show và Cấu hình các Loại Vé thành công!");
            setShowForm(false);
            queryClient.invalidateQueries({ queryKey: ['event-shows', eventId] });
            setShowData({ name: '', description: '', start_time: '', end_time: '', venue_id: '', sale_start: '', sale_end: '', stadium_map_svg: '' });
            setTicketTypes([]);
            setVenueSearch('');

        } catch (error: any) {
            console.error("Lỗi Submit:", error);
            alert(error.response?.data?.message || "Có lỗi xảy ra trong quá trình lưu dữ liệu!");
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredVenues = venues.filter((v: any) => v.name.toLowerCase().includes(venueSearch.toLowerCase()));

    if (isLoadingEvent) return <div className="p-10 text-center font-medium text-gray-500">Đang tải thông tin sự kiện...</div>;
    if (!eventData) return <div className="p-10 text-center font-bold text-red-500">Không tìm thấy sự kiện!</div>;

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-6 bg-background min-h-screen">
            <div className="flex justify-between items-center bg-secondary text-white p-6 rounded-xl shadow-md">
                <div>
                    <h1 className="text-3xl font-bold">{eventData.name}</h1>
                    <p className="opacity-80">Quản lý Show biểu diễn và cấu hình vé</p>
                </div>
                <Button className="bg-primary hover:bg-pink-600 text-white shadow-lg" onClick={() => setShowForm(!showForm)}>
                    {showForm ? "Đóng Form" : "+ Thêm Show Mới"}
                </Button>
            </div>

            {showForm && (
                <form onSubmit={handleCreateAll} className="bg-white p-6 rounded-xl border border-primary/20 space-y-6 shadow-sm animate-in fade-in slide-in-from-top-4">
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
                        {/* CỘT TRÁI: UPLOAD SVG */}
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

                        {/* CỘT PHẢI: FORM NHẬP TICKET TYPES */}
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

                                            {/* THIẾT KẾ MỚI: Badge hiển thị Mã Hạng Vé Cứng */}
                                            <div className="flex items-center gap-2 mb-3 bg-slate-100 px-3 py-2 rounded-lg w-fit border border-slate-200">
                                                <Tag size={14} className="text-slate-500" />
                                                <span className="text-xs font-bold text-slate-600 uppercase">Mã Hạng (Tier):</span>
                                                <span className="text-xs font-black text-primary font-mono bg-white px-2 py-0.5 rounded shadow-sm border border-primary/20">
                                                    {ticket.target_tier}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-12 gap-4 mb-3">
                                                <div className="col-span-12">
                                                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Tên hiển thị vé (Khách hàng sẽ thấy tên này)</label>
                                                    <input required type="text" placeholder="VD: Vé VIP Khu Vực A" className="w-full text-sm border border-slate-200 rounded p-2 outline-none focus:border-primary bg-slate-50 font-bold text-slate-800"
                                                        value={ticket.name}
                                                        onChange={e => { const arr = [...ticketTypes]; arr[index].name = e.target.value; setTicketTypes(arr); }} />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-12 gap-4 mb-3">
                                                <div className="col-span-5">
                                                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Giá vé (VNĐ)</label>
                                                    <input required type="number" min="0" placeholder="0" className="w-full text-sm border border-slate-200 rounded p-2 outline-none focus:border-primary font-bold text-orange-600 bg-slate-50"
                                                        value={ticket.price}
                                                        onChange={e => { const arr = [...ticketTypes]; arr[index].price = e.target.value ? Number(e.target.value) : ''; setTicketTypes(arr); }} />
                                                </div>
                                                <div className="col-span-4">
                                                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">SL Giới hạn (Bỏ trống = Null)</label>
                                                    <input type="number" min="1" placeholder="Theo số ghế" className="w-full text-sm border border-slate-200 rounded p-2 outline-none focus:border-primary bg-slate-50"
                                                        value={ticket.total_quantity}
                                                        onChange={e => { const arr = [...ticketTypes]; arr[index].total_quantity = e.target.value ? Number(e.target.value) : ''; setTicketTypes(arr); }} />
                                                </div>
                                                <div className="col-span-3 flex items-center pt-5">
                                                    <label className="flex items-center gap-2 text-sm font-medium cursor-pointer text-slate-600 hover:text-primary transition-colors">
                                                        <input type="checkbox" className="w-4 h-4 rounded text-primary focus:ring-primary"
                                                            checked={ticket.is_limited_promo}
                                                            onChange={e => { const arr = [...ticketTypes]; arr[index].is_limited_promo = e.target.checked; setTicketTypes(arr); }} />
                                                        Vé Promo
                                                    </label>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 mb-3">
                                                <div>
                                                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 flex items-center gap-1"><CalendarClock size={10} /> Mở bán</label>
                                                    <input required type="datetime-local" className="w-full text-xs border border-slate-200 rounded p-2 outline-none focus:border-primary bg-slate-50"
                                                        value={ticket.sale_start}
                                                        onChange={e => { const arr = [...ticketTypes]; arr[index].sale_start = e.target.value; setTicketTypes(arr); }} />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 flex items-center gap-1"><CalendarClock size={10} /> Đóng bán</label>
                                                    <input required type="datetime-local" className="w-full text-xs border border-slate-200 rounded p-2 outline-none focus:border-primary bg-slate-50"
                                                        value={ticket.sale_end}
                                                        onChange={e => { const arr = [...ticketTypes]; arr[index].sale_end = e.target.value; setTicketTypes(arr); }} />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Mô tả thêm</label>
                                                <input type="text" placeholder="Nhập các quyền lợi đi kèm..." className="w-full text-xs border border-slate-200 rounded p-2 outline-none focus:border-primary bg-slate-50"
                                                    value={ticket.description}
                                                    onChange={e => { const arr = [...ticketTypes]; arr[index].description = e.target.value; setTicketTypes(arr); }} />
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
                        <Button type="submit" disabled={isSubmitting} className="bg-secondary text-white px-8 rounded-full shadow-lg">
                            {isSubmitting ? "Đang xử lý..." : "Lưu Show & Cấu hình Vé"}
                        </Button>
                    </div>
                </form>
            )}

            {/* Danh sách các Show */}
            <div className="mt-8">
                <h2 className="text-xl font-bold mb-4 text-secondary">Danh sách các Show</h2>
                {isLoadingShows ? (
                    <p className="text-gray-500 animate-pulse">Đang tải danh sách show...</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {shows.length === 0 ? (
                            <p className="text-gray-500 col-span-2 bg-white p-8 text-center rounded-xl border border-dashed">
                                Chưa có show nào được tạo cho sự kiện này. Bấm "+ Thêm Show Mới" để bắt đầu!
                            </p>
                        ) : (
                            shows.map((show: any) => (
                                <div key={show._id} className="border bg-white rounded-xl p-6 hover:border-primary cursor-pointer transition-all shadow-sm hover:shadow-md">
                                    <h3 className="font-bold text-lg text-secondary mb-1">{show.name}</h3>
                                    <p className="text-sm text-gray-500 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                        Bắt đầu: {new Date(show.start_time).toLocaleString('vi-VN')}
                                    </p>
                                    <div className="mt-4 flex gap-2">
                                        <span className="bg-gray-100 text-gray-700 text-xs px-3 py-1.5 rounded-md font-medium border">
                                            Zone đã được thiết lập
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}