import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axiosClient';
import { Search, MapPin, SlidersHorizontal, Calendar, Tags, ArrowUpDown, ImageIcon, ChevronLeft, ChevronRight } from 'lucide-react';

const toPositiveNumber = (value: string | null, fallback = 1) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const formatShortDate = (value?: string) => {
    if (!value) return 'Đang cập nhật';
    return new Date(value).toLocaleDateString('vi-VN');
};

export default function SearchPage() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const queryKeyword = searchParams.get('q') || '';
    const queryCity = searchParams.get('city') || '';
    const queryGenre = searchParams.get('genre') || '';
    const queryDate = searchParams.get('date') || '';
    const queryDateFrom = searchParams.get('dateFrom') || '';
    const queryDateTo = searchParams.get('dateTo') || '';
    const querySort = searchParams.get('sort') || 'newest';
    const queryPage = toPositiveNumber(searchParams.get('page'), 1);

    const [searchInput, setSearchInput] = useState(queryKeyword);
    const [selectedCity, setSelectedCity] = useState(queryCity);
    const [selectedGenre, setSelectedGenre] = useState(queryGenre);
    const [selectedDate, setSelectedDate] = useState(queryDate);
    const [sortBy, setSortBy] = useState(querySort);

    useEffect(() => {
        setSearchInput(queryKeyword);
        setSelectedCity(queryCity);
        setSelectedGenre(queryGenre);
        setSelectedDate(queryDate);
        setSortBy(querySort);
    }, [queryKeyword, queryCity, queryGenre, queryDate, querySort]);

    const applyFilters = (page = 1) => {
        const params: Record<string, string> = {};
        if (searchInput.trim()) params.q = searchInput.trim();
        if (selectedCity) params.city = selectedCity;
        if (selectedGenre) params.genre = selectedGenre;
        if (selectedDate) params.date = selectedDate;
        else {
            if (queryDateFrom) params.dateFrom = queryDateFrom;
            if (queryDateTo) params.dateTo = queryDateTo;
        }
        if (sortBy) params.sort = sortBy;
        if (page > 1) params.page = String(page);
        setSearchParams(params);
    };

    const { data: filtersResponse } = useQuery({
        queryKey: ['publicEventFilters'],
        queryFn: async () => {
            const res = await api.get('/events/filters');
            return res.data?.data || res.data || { cities: [], genres: [] };
        }
    });

    const { data: searchResponse, isLoading } = useQuery({
        queryKey: ['eventsSearch', queryKeyword, queryCity, queryGenre, queryDate, queryDateFrom, queryDateTo, querySort, queryPage],
        queryFn: async () => {
            const res = await api.get('/events/search', {
                params: {
                    q: queryKeyword,
                    city: queryCity,
                    genre: queryGenre,
                    date: queryDate,
                    dateFrom: queryDate ? undefined : queryDateFrom,
                    dateTo: queryDate ? undefined : queryDateTo,
                    sort: querySort,
                    page: queryPage,
                    limit: 12
                }
            });

            return res.data || { data: [], pagination: null };
        }
    });

    const eventsList = Array.isArray(searchResponse)
        ? searchResponse
        : (Array.isArray(searchResponse?.data)
            ? searchResponse.data
            : (searchResponse?.data?.docs || searchResponse?.docs || []));

    const pagination = searchResponse?.pagination || searchResponse?.data?.pagination || {
        totalElements: eventsList.length,
        totalPages: eventsList.length ? 1 : 0,
        currentPage: queryPage,
        limit: 12,
        hasNextPage: false,
        hasPrevPage: false,
    };

    const cities = Array.isArray(filtersResponse?.cities) ? filtersResponse.cities : [];
    const genres = Array.isArray(filtersResponse?.genres) ? filtersResponse.genres : [];
    const cityOptions = selectedCity && !cities.includes(selectedCity) ? [selectedCity, ...cities] : cities;
    const genreOptions = selectedGenre && !genres.includes(selectedGenre) ? [selectedGenre, ...genres] : genres;
    const totalResults = pagination?.totalElements ?? eventsList.length;
    const hasRangeDateFilter = !selectedDate && Boolean(queryDateFrom || queryDateTo);

    const clearRangeDateFilter = () => {
        const params = new URLSearchParams(searchParams);
        params.delete('dateFrom');
        params.delete('dateTo');
        params.delete('page');
        setSearchParams(params);
    };

    return (
        <div className="w-full min-h-screen font-sans pb-20">
            <div className="bg-white dark:bg-slate-900/90 border-b border-gray-100 dark:border-white/10 py-10 px-8">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Tìm kiếm sự kiện</h1>
                        <p className="text-xs font-medium text-slate-400 mt-1">
                            Tìm thấy {totalResults} sự kiện phù hợp với từ khóa <span className="text-[#4C4DCC] font-bold">&quot;{queryKeyword || 'Tất cả'}&quot;</span>
                        </p>
                    </div>

                    <div className="w-full md:max-w-md relative">
                        <input
                            type="text"
                            placeholder="Tìm tên sự kiện, diễn giả/nghệ sĩ, thành phố hoặc địa điểm..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && applyFilters(1)}
                            className="w-full bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 rounded-full py-2.5 pl-4 pr-12 text-xs font-medium outline-none focus:border-primary focus:bg-white dark:focus:bg-slate-900 transition-all text-slate-700 dark:text-slate-200"
                        />
                        <button onClick={() => applyFilters(1)} className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-[#4C4DCC] text-white p-1.5 rounded-full border-none cursor-pointer hover:opacity-90">
                            <Search size={14} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-8 mt-10 grid grid-cols-1 lg:grid-cols-4 gap-8">
                <aside className="lg:col-span-1 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-white/10 rounded-2xl p-5 h-fit space-y-6">
                    <div className="flex items-center gap-2 border-b border-slate-50 dark:border-white/10 pb-3">
                        <SlidersHorizontal size={16} className="text-slate-500 dark:text-slate-400" />
                        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">Bộ lọc sự kiện</h2>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1"><MapPin size={12} /> Thành phố</label>
                        <select
                            value={selectedCity}
                            onChange={(e) => setSelectedCity(e.target.value)}
                            className="w-full border border-slate-200 dark:border-white/10 rounded-xl p-2.5 text-xs font-semibold bg-slate-50 dark:bg-slate-900/80 text-slate-700 dark:text-slate-200 outline-none focus:border-primary"
                        >
                            <option value="">Tất cả thành phố</option>
                            {cityOptions.map((city: string) => (
                                <option key={city} value={city}>{city}</option>
                            ))}
                        </select>
                        <p className="text-[11px] leading-5 text-slate-400">Danh sách lấy từ city của venue có show đang công khai.</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1"><Tags size={12} /> Thể loại</label>
                        <select
                            value={selectedGenre}
                            onChange={(e) => setSelectedGenre(e.target.value)}
                            className="w-full border border-slate-200 dark:border-white/10 rounded-xl p-2.5 text-xs font-semibold bg-slate-50 dark:bg-slate-900/80 text-slate-700 dark:text-slate-200 outline-none focus:border-primary"
                        >
                            <option value="">Tất cả thể loại</option>
                            {genreOptions.map((genre: string) => (
                                <option key={genre} value={genre}>{genre}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1"><Calendar size={12} /> Thời gian diễn ra</label>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="w-full border border-slate-200 dark:border-white/10 rounded-xl p-2.5 text-xs font-semibold bg-slate-50 dark:bg-slate-900/80 text-slate-700 dark:text-slate-200 outline-none focus:border-primary"
                        />
                        {selectedDate && (
                            <button onClick={() => setSelectedDate('')} className="text-[11px] font-semibold text-slate-400 hover:text-[#FF0082]">Xóa ngày đã chọn</button>
                        )}
                        {hasRangeDateFilter && (
                            <div className="rounded-xl bg-slate-50 dark:bg-slate-950/70 px-3 py-2 text-[11px] leading-5 text-slate-500 dark:text-slate-400">
                                Đang lọc khoảng {queryDateFrom || '...'} đến {queryDateTo || '...'}
                                <button onClick={clearRangeDateFilter} className="ml-2 font-bold text-[#FF0082]">Xóa</button>
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1"><ArrowUpDown size={12} /> Sắp xếp</label>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="w-full border border-slate-200 dark:border-white/10 rounded-xl p-2.5 text-xs font-semibold bg-slate-50 dark:bg-slate-900/80 text-slate-700 dark:text-slate-200 outline-none focus:border-primary"
                        >
                            <option value="newest">Mới nhất</option>
                            <option value="upcoming">Gần diễn ra nhất</option>
                        </select>
                    </div>

                    <button
                        onClick={() => applyFilters(1)}
                        className="w-full bg-[#4C4DCC] text-white font-bold text-xs py-2.5 rounded-xl border-none cursor-pointer transition-opacity hover:opacity-90 block text-center"
                    >
                        Tìm sự kiện
                    </button>
                </aside>

                <main className="lg:col-span-3">
                    {isLoading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 animate-pulse">
                            {[1, 2, 3, 4, 5, 6].map((n) => (
                                <div key={n} className="bg-gray-200 dark:bg-slate-700/70 h-80 rounded-2xl"></div>
                            ))}
                        </div>
                    ) : eventsList.length === 0 ? (
                        <div className="w-full bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-white/10 rounded-2xl p-12 text-center text-slate-400 font-medium italic text-sm">
                            Chưa có sự kiện nào khớp với bộ lọc hiện tại. Thử đổi từ khóa, thành phố, thể loại hoặc ngày diễn ra khác.
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 animate-in fade-in duration-200">
                                {eventsList.map((event: any) => {
                                    const artistsText = Array.isArray(event.artists) ? event.artists.join(', ') : event.artists;
                                    return (
                                        <div
                                            key={event._id}
                                            onClick={() => navigate(`/events/${event._id}`)}
                                            className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-white/10 rounded-[24px] overflow-hidden hover:border-[#FF0082]/40 cursor-pointer transition-all flex flex-col group concert-poster-card"
                                        >
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
                                                <span className="absolute top-3 left-3 bg-white/90 dark:bg-slate-950/90 backdrop-blur-sm text-slate-800 dark:text-slate-100 text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-100 dark:border-white/10">
                                                    {event.genre || 'Sự kiện'}
                                                </span>
                                            </div>

                                            <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                                                <div className="space-y-1">
                                                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm leading-snug group-hover:text-[#FF0082] transition-colors line-clamp-2">
                                                        {event.name}
                                                    </h3>
                                                    {artistsText && (
                                                        <p className="text-[11px] font-medium text-slate-400 truncate">
                                                            Nghệ sĩ/diễn giả: {artistsText}
                                                        </p>
                                                    )}
                                                </div>

                                                <div className="pt-2.5 border-t border-slate-50 dark:border-white/10 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                                    <div className="flex items-center gap-1">
                                                        <Calendar size={13} className="text-slate-400" />
                                                        <span>{formatShortDate(event.next_show_start_time || event.start_date)}</span>
                                                    </div>
                                                    <div className="flex items-center gap-0.5 text-[#4C4DCC] font-bold">
                                                        <MapPin size={12} />
                                                        <span>{event.venue_info?.city || 'Việt Nam'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {pagination.totalPages > 1 && (
                                <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-xs font-bold text-slate-500 dark:text-slate-400">
                                    <button
                                        disabled={!pagination.hasPrevPage}
                                        onClick={() => applyFilters(Math.max(1, pagination.currentPage - 1))}
                                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/90 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-40 hover:border-[#FF0082]"
                                    >
                                        <ChevronLeft size={14} /> Trước
                                    </button>
                                    <span>Trang {pagination.currentPage}/{pagination.totalPages}</span>
                                    <button
                                        disabled={!pagination.hasNextPage}
                                        onClick={() => applyFilters(pagination.currentPage + 1)}
                                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/90 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-40 hover:border-[#FF0082]"
                                    >
                                        Sau <ChevronRight size={14} />
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </main>
            </div>
        </div>
    );
}
