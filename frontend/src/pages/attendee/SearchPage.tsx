import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axiosClient';
import { Search, MapPin, SlidersHorizontal, Calendar, Music, ArrowUpDown, ImageIcon } from 'lucide-react';

export default function SearchPage() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const queryKeyword = searchParams.get('q') || '';

    const [searchInput, setSearchInput] = useState(queryKeyword);
    const [selectedCity, setSelectedCity] = useState(searchParams.get('city') || '');
    const [selectedGenre, setSelectedGenre] = useState(searchParams.get('genre') || '');
    const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'newest');

    useEffect(() => {
        setSearchInput(queryKeyword);
    }, [queryKeyword]);

    const applyFilters = () => {
        const params: any = {};
        if (searchInput.trim()) params.q = searchInput.trim();
        if (selectedCity) params.city = selectedCity;
        if (selectedGenre) params.genre = selectedGenre;
        if (sortBy) params.sort = sortBy;
        setSearchParams(params);
    };

    const { data: searchResponse, isLoading } = useQuery({
        queryKey: ['eventsSearch', queryKeyword, selectedCity, selectedGenre, sortBy],
        queryFn: async () => {
            const res = await api.get('/events/search', {
                params: {
                    q: queryKeyword,
                    city: selectedCity,
                    genre: selectedGenre,
                    sort: sortBy,
                    limit: 24
                }
            });

            return res.data || []; // Trả về mảng sự kiện hoặc mảng rỗng nếu không có data
        }
    });

    const eventsList = Array.isArray(searchResponse)
        ? searchResponse
        : (searchResponse?.data?.docs || searchResponse?.data || searchResponse?.docs || []);

    return (
        <div className="w-full min-h-screen  font-sans pb-20">
            {/* KHU VỰC TIÊU ĐỀ TRANG TÌM KIẾM */}
            <div className="bg-white dark:bg-slate-900/90 border-b border-gray-100 dark:border-white/10 py-10 px-8">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Tìm vé concert</h1>
                        <p className="text-xs font-medium text-slate-400 mt-1">
                            Tìm thấy {eventsList.length} show phù hợp với từ khóa <span className="text-[#4C4DCC] font-bold">"{queryKeyword || 'Tất cả'}"</span>
                        </p>
                    </div>

                    {/* Thanh tìm kiếm dập nổi tại trang */}
                    <div className="w-full md:max-w-md relative">
                        <input
                            type="text"
                            placeholder="Thay đổi từ khóa tìm kiếm..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                            className="w-full bg-slate-50 dark:bg-slate-950/70 dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 rounded-full py-2.5 pl-4 pr-12 text-xs font-medium outline-none focus:border-primary focus:bg-white transition-all text-slate-700 dark:text-slate-200"
                        />
                        <button onClick={applyFilters} className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-[#4C4DCC] text-white p-1.5 rounded-full border-none cursor-pointer hover:opacity-90">
                            <Search size={14} />
                        </button>
                    </div>
                </div>
            </div>

            {/* BỐ CỤC LƯỚI CHÍNH */}
            <div className="max-w-7xl mx-auto px-8 mt-10 grid grid-cols-1 lg:grid-cols-4 gap-8">

                {/* 1. CỘT TRÁI: BỘ LỌC PHẲNG (FLAT SIDEBAR) */}
                <aside className="lg:col-span-1 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-white/10 rounded-2xl p-5 h-fit space-y-6">
                    <div className="flex items-center gap-2 border-b border-slate-50 dark:border-white/10 pb-3">
                        <SlidersHorizontal size={16} className="text-slate-500 dark:text-slate-400" />
                        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">Lọc show diễn</h2>
                    </div>

                    {/* Bộ lọc: Khu vực Thành phố */}
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1"><MapPin size={12} /> Thành phố / venue</label>
                        <select
                            value={selectedCity}
                            onChange={(e) => { setSelectedCity(e.target.value); setTimeout(applyFilters, 0); }}
                            className="w-full border border-slate-200 dark:border-white/10 rounded-xl p-2.5 text-xs font-semibold bg-slate-50 dark:bg-slate-950/70 dark:bg-slate-900/80 text-slate-700 dark:text-slate-200 outline-none focus:border-primary"
                        >
                            <option value="">Tất cả thành phố</option>
                            <option value="Hồ Chí Minh">TP. Hồ Chí Minh</option>
                            <option value="Hà Nội">Hà Nội</option>
                            <option value="Đà Nẵng">Đà Nẵng</option>
                        </select>
                    </div>

                    {/* Bộ lọc: Dòng nhạc nhạc */}
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1"><Music size={12} /> Dòng nhạc</label>
                        <select
                            value={selectedGenre}
                            onChange={(e) => { setSelectedGenre(e.target.value); setTimeout(applyFilters, 0); }}
                            className="w-full border border-slate-200 dark:border-white/10 rounded-xl p-2.5 text-xs font-semibold bg-slate-50 dark:bg-slate-950/70 dark:bg-slate-900/80 text-slate-700 dark:text-slate-200 outline-none focus:border-primary"
                        >
                            <option value="">Tất cả dòng nhạc</option>
                            <option value="Pop / Concert">Pop / Concert</option>
                            <option value="Rock">Rock</option>
                            <option value="Jazz">Jazz</option>
                            <option value="Classic">Classic</option>
                        </select>
                    </div>

                    {/* Bộ lọc: Thứ tự sắp xếp */}
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1"><ArrowUpDown size={12} /> Sắp xếp show</label>
                        <select
                            value={sortBy}
                            onChange={(e) => { setSortBy(e.target.value); setTimeout(applyFilters, 0); }}
                            className="w-full border border-slate-200 dark:border-white/10 rounded-xl p-2.5 text-xs font-semibold bg-slate-50 dark:bg-slate-950/70 dark:bg-slate-900/80 text-slate-700 dark:text-slate-200 outline-none focus:border-primary"
                        >
                            <option value="newest">Mới nhất</option>
                            <option value="upcoming">Gần diễn ra nhất</option>
                        </select>
                    </div>

                    <button
                        onClick={applyFilters}
                        className="w-full bg-[#4C4DCC] text-white font-bold text-xs py-2.5 rounded-xl border-none cursor-pointer transition-opacity hover:opacity-90 block text-center"
                    >
                        Tìm vé
                    </button>
                </aside>

                {/* 2. CỘT PHẢI: LƯỚI THẺ SỰ KIỆN POSTER 3:4 ĐÚNG STYLE TRANG CHỦ */}
                <main className="lg:col-span-3">
                    {isLoading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 animate-pulse">
                            {[1, 2, 3].map((n) => (
                                <div key={n} className="bg-gray-200 dark:bg-slate-700/70 h-80 rounded-2xl"></div>
                            ))}
                        </div>
                    ) : eventsList.length === 0 ? (
                        <div className="w-full bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-white/10 rounded-2xl p-12 text-center text-slate-400 font-medium italic text-sm">
                            Chưa có show nào khớp với bộ lọc hiện tại. Thử đổi từ khóa, thành phố hoặc dòng nhạc khác.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 animate-in fade-in duration-200">
                            {eventsList.map((event: any) => (
                                <div
                                    key={event._id}
                                    onClick={() => navigate(`/events/${event._id}`)}
                                    className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-white/10 rounded-[24px] overflow-hidden hover:border-[#FF0082]/40 cursor-pointer transition-all flex flex-col group concert-poster-card"
                                >
                                    {/* KHU VỰC KHUNG ẢNH BANNER POSTER 3:4 NGHIÊM NGẶT */}
                                    <div className="w-full aspect-[3/4] bg-slate-100 dark:bg-slate-800/80 overflow-hidden relative">
                                        {event.poster_url ? (
                                            <img
                                                src={event.poster_url}
                                                alt={event.name}
                                                className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-600 dark:text-slate-300"><ImageIcon size={32} /></div>
                                        )}
                                        {/* Tag thể loại góc trên ảnh */}
                                        <span className="absolute top-3 left-3 bg-white/90 dark:bg-slate-950/90 backdrop-blur-sm text-slate-800 dark:text-slate-100 text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-100 dark:border-white/10">
                                            {event.genre}
                                        </span>
                                    </div>

                                    {/* NỘI DUNG CHỮ DƯỚI CHÂN CARD */}
                                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                                        <div className="space-y-1">
                                            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm leading-snug group-hover:text-[#FF0082] transition-colors line-clamp-2">
                                                {event.name}
                                            </h3>
                                            {event.artists && (
                                                <p className="text-[11px] font-medium text-slate-400 truncate">
                                                    Nghệ sĩ: {event.artists}
                                                </p>
                                            )}
                                        </div>

                                        {/* Mốc thời gian và Vùng thành phố tổ chức */}
                                        <div className="pt-2.5 border-t border-slate-50 dark:border-white/10 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                            <div className="flex items-center gap-1">
                                                <Calendar size={13} className="text-slate-400" />
                                                <span>{new Date(event.start_date).toLocaleDateString('vi-VN')}</span>
                                            </div>
                                            {/* Sẽ hiển thị Thành phố nếu đã kết nối Populate sang bảng Venue */}
                                            <div className="flex items-center gap-0.5 text-[#4C4DCC] font-bold">
                                                <MapPin size={12} />
                                                <span>{event.venue_info?.city || 'Việt Nam'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}