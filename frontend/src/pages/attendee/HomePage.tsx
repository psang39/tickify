import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Music2, Search, Sparkles } from 'lucide-react';
import PublicEventCard from '@/components/public/PublicEventCard';
import { usePublicEvents } from '@/hooks/usePublicEventQueries';

const heroImage = 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1200&q=80';

const formatDate = (value?: string) => {
    if (!value) return 'Đang cập nhật';
    return new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' });
};

const getEventVenueText = (event: any) => {
    const venue = event?.venue_id || event?.venue;
    if (!venue) return 'Địa điểm đang cập nhật';

    if (typeof venue === 'string') return venue;

    return venue.name || venue.venue_name || venue.address || 'Địa điểm đang cập nhật';
};

const SkeletonLine = ({ className = '' }: { className?: string }) => (
    <div className={`animate-pulse rounded-full bg-slate-200 dark:bg-slate-700/70 ${className}`} />
);

const EventCardSkeleton = () => (
    <div className="overflow-hidden rounded-2xl border border-slate-100 dark:border-white/10 bg-white dark:bg-slate-900/90 shadow-sm">
        <div className="h-40 animate-pulse bg-slate-200 dark:bg-slate-700/70" />
        <div className="space-y-3 p-4">
            <SkeletonLine className="h-3 w-20" />
            <SkeletonLine className="h-4 w-4/5" />
            <SkeletonLine className="h-3 w-full" />
            <SkeletonLine className="h-3 w-2/3" />
        </div>
    </div>
);

const GenreSkeleton = () => (
    <div className="rounded-2xl border border-slate-100 dark:border-white/10 bg-white dark:bg-slate-900/90 px-5 py-6">
        <SkeletonLine className="h-3 w-20" />
        <SkeletonLine className="mt-3 h-6 w-28" />
    </div>
);

export default function HomePage() {
    const navigate = useNavigate();
    const [keyword, setKeyword] = useState('');
    const { data: newestEvents = [], isLoading: isNewestLoading } = usePublicEvents({ limit: 8, sort: 'newest' });
    const { data: upcomingEvents = [], isLoading: isUpcomingLoading } = usePublicEvents({ limit: 8, sort: 'upcoming' });

    const isPageLoading = isNewestLoading || isUpcomingLoading;
    const visibleUpcomingEvents = upcomingEvents;
    const heroEvent = useMemo(() => visibleUpcomingEvents?.[0] || newestEvents?.[0], [newestEvents, visibleUpcomingEvents]);
    const featureImage = heroEvent?.banner_url || heroEvent?.poster_url || heroImage;

    const genres = useMemo(() => {
        const values = [...newestEvents, ...upcomingEvents]
            .map((event: any) => event?.genre)
            .filter((genre: any): genre is string => Boolean(genre));

        return Array.from(new Set<string>(values)).slice(0, 5);
    }, [newestEvents, upcomingEvents]);

    const goSearch = () => {
        const q = keyword.trim();
        navigate(q ? `/search?q=${encodeURIComponent(q)}` : '/search');
    };

    return (
        <div className="bg-white dark:bg-slate-900/90 font-sans text-slate-900 dark:text-slate-50">
            <section className="relative overflow-hidden bg-[#F7F7FA] dark:bg-[#070A18] text-slate-900 dark:text-slate-50 concert-page-shell dark:bg-[#050510]">
                <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-8 px-6 py-10 lg:grid-cols-2 lg:px-8 lg:py-8">
                    <div className="space-y-6 lg:pr-8">
                        <span className="inline-flex items-center gap-2 rounded-full bg-pink-50 px-4 py-2 text-xs font-bold text-[#FF0082]">
                            <Sparkles size={15} /> Sự kiện mới nhất trên Tickify
                        </span>

                        <div>
                            {isPageLoading ? (
                                <div className="space-y-4">
                                    <SkeletonLine className="h-11 w-full max-w-xl md:h-14" />
                                    <SkeletonLine className="h-11 w-4/5 max-w-lg md:h-14" />
                                    <div className="space-y-2 pt-2">
                                        <SkeletonLine className="h-4 w-full max-w-lg" />
                                        <SkeletonLine className="h-4 w-5/6 max-w-md" />
                                        <SkeletonLine className="h-4 w-2/3 max-w-sm" />
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <h1 className="max-w-xl text-4xl font-black leading-tight tracking-tight text-slate-900 dark:text-slate-50 md:text-5xl">
                                        {heroEvent?.name || 'Khám phá sự kiện bạn yêu thích'}
                                    </h1>
                                    <p className="mt-4 max-w-lg text-sm leading-7 text-slate-500 dark:text-slate-400">
                                        {heroEvent?.description || 'Khám phá sự kiện đang mở bán, xem lịch tổ chức, chọn hạng vé và đặt vé nhanh chóng trên Tickify.'}
                                    </p>
                                </>
                            )}
                        </div>

                        {isPageLoading ? (
                            <div className="flex flex-wrap gap-3">
                                <SkeletonLine className="h-10 w-36 bg-white dark:bg-slate-900/90" />
                                <SkeletonLine className="h-10 w-44 bg-white dark:bg-slate-900/90" />
                                <SkeletonLine className="h-10 w-28 bg-white dark:bg-slate-900/90" />
                            </div>
                        ) : heroEvent ? (
                            <div className="flex flex-wrap gap-3 text-sm text-slate-600 dark:text-slate-300">
                                <span className="inline-flex items-center gap-2 rounded-full bg-white dark:bg-slate-900/90 px-4 py-2 font-semibold shadow-sm">
                                    <Calendar size={16} className="text-[#FF0082]" /> {formatDate(heroEvent.next_show_start_time || heroEvent.start_date)}
                                </span>
                                <span className="inline-flex items-center gap-2 rounded-full bg-white dark:bg-slate-900/90 px-4 py-2 font-semibold shadow-sm">
                                    <MapPin size={16} className="text-[#4C4DCC]" /> {getEventVenueText(heroEvent)}
                                </span>
                                {heroEvent.genre && (
                                    <span className="inline-flex items-center gap-2 rounded-full bg-white dark:bg-slate-900/90 px-4 py-2 font-semibold shadow-sm">
                                        <Music2 size={16} className="text-[#FF0082]" /> {heroEvent.genre}
                                    </span>
                                )}
                            </div>
                        ) : null}

                        <div className="flex flex-wrap items-center gap-3">
                            <button
                                onClick={() => heroEvent ? navigate(`/events/${heroEvent._id}`) : navigate('/search')}
                                disabled={isPageLoading}
                                className="rounded-xl bg-[#FF0082] px-7 py-3 text-sm font-bold text-white transition hover:bg-pink-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                            >
                                Xem chi tiết
                            </button>
                            <button
                                onClick={() => navigate('/search')}
                                disabled={isPageLoading}
                                className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/90 px-7 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 transition hover:border-[#FF0082] hover:text-[#FF0082] disabled:cursor-not-allowed disabled:text-slate-300 dark:border-white/15 dark:bg-white/10 dark:text-slate-100 dark:hover:border-pink-400 dark:hover:text-pink-200"
                            >
                                Xem thêm sự kiện
                            </button>
                        </div>
                    </div>

                    <div className="relative h-[360px] overflow-hidden rounded-[28px] bg-slate-200 dark:bg-slate-700/70 lg:h-[440px]">
                        {isPageLoading ? (
                            <div className="h-full w-full animate-pulse bg-slate-300" />
                        ) : (
                            <img src={featureImage} alt={heroEvent?.name || 'Sự kiện Tickify'} className="h-full w-full object-cover" />
                        )}

                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-6 text-white">
                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-pink-200">Sự kiện nổi bật</p>

                            {isPageLoading ? (
                                <div className="mt-3 space-y-3">
                                    <SkeletonLine className="h-7 w-3/4 bg-white/30" />
                                    <div className="flex gap-4">
                                        <SkeletonLine className="h-4 w-28 bg-white/25" />
                                        <SkeletonLine className="h-4 w-24 bg-white/25" />
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <h2 className="mt-2 text-2xl font-black">{heroEvent?.name || 'Tickify Event'}</h2>
                                    <div className="mt-3 flex flex-wrap gap-4 text-xs font-semibold text-white/90">
                                        <span className="flex items-center gap-1"><Calendar size={14} />{formatDate(heroEvent?.next_show_start_time || heroEvent?.start_date)}</span>
                                        {heroEvent?.genre && <span className="flex items-center gap-1"><Music2 size={14} />{heroEvent.genre}</span>}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="bg-[#3B3B49] py-8">
                    <div className="mx-auto max-w-7xl px-6 lg:px-8">
                        <p className="mb-4 text-sm font-semibold text-white/90">Tìm sự kiện phù hợp với lịch của bạn</p>
                        <div className="flex max-w-xl items-center gap-2 rounded-xl bg-white/20 p-2 backdrop-blur">
                            <Search className="ml-2 text-white/70" size={18} />
                            <input
                                value={keyword}
                                onChange={(e) => setKeyword(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && goSearch()}
                                placeholder="Tìm tên sự kiện, người biểu diễn/diễn giả, thể loại hoặc địa điểm..."
                                className="flex-1 bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-white/60 tickify-home-search-input appearance-none"
                            />
                            <button onClick={goSearch} className="rounded-lg bg-[#FF0082] px-4 py-2 text-xs font-bold text-white">Tìm kiếm</button>
                        </div>
                    </div>
                </div>
            </section>

            <section className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
                <div className="mb-5 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">Sự kiện sắp diễn ra</h2>
                    <Link to="/search?sort=upcoming" className="text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-[#FF0082]">Xem tất cả</Link>
                </div>

                {isPageLoading ? (
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                        {Array.from({ length: 4 }).map((_, index) => <EventCardSkeleton key={index} />)}
                    </div>
                ) : visibleUpcomingEvents.length ? (
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                        {visibleUpcomingEvents.slice(0, 4).map((event: any) => <PublicEventCard key={event._id} event={event} />)}
                    </div>
                ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950/70 dark:bg-slate-900/80 px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                        Hiện chưa có sự kiện nào được hiển thị.
                    </div>
                )}
            </section>

            {(isPageLoading || genres.length > 0) && (
                <section className="mx-auto max-w-7xl px-6 pb-10 lg:px-8">
                    <div className="mb-5 flex items-center justify-between">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">Khám phá theo thể loại</h2>
                        <Link to="/search" className="text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-[#FF0082]">Xem thêm</Link>
                    </div>

                    {isPageLoading ? (
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                            {Array.from({ length: 5 }).map((_, index) => <GenreSkeleton key={index} />)}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                            {genres.map((genre) => (
                                <button
                                    key={genre}
                                    onClick={() => navigate(`/search?genre=${encodeURIComponent(genre)}`)}
                                    className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/90 px-5 py-6 text-left transition hover:border-[#FF0082] hover:shadow-md dark:bg-slate-900/80 dark:text-slate-100 dark:hover:border-pink-400 dark:hover:shadow-pink-500/10"
                                >
                                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Thể loại</span>
                                    <span className="mt-2 block text-lg font-black text-slate-900 dark:text-slate-50">{genre}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </section>
            )}

            {(isPageLoading || newestEvents.length > 0) && (
                <section className="bg-[#23232D] py-12 text-white">
                    <div className="mx-auto max-w-7xl px-6 lg:px-8">
                        <div className="mb-6 flex items-end justify-between">
                            <div>
                                <h2 className="text-xl font-bold">Vừa mở bán trên Tickify</h2>
                                <p className="mt-1 text-sm text-white/60">Các sự kiện mới được mở bán và cập nhật trực tiếp từ hệ thống.</p>
                            </div>
                            <Link to="/search" className="text-xs font-bold text-white/70 hover:text-white">Xem tất cả sự kiện</Link>
                        </div>

                        {isPageLoading ? (
                            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                                {Array.from({ length: 3 }).map((_, index) => (
                                    <article key={index} className="overflow-hidden rounded-2xl bg-white dark:bg-slate-900/90 text-slate-900 dark:text-slate-50">
                                        <div className="h-40 animate-pulse bg-slate-300" />
                                        <div className="space-y-3 p-4">
                                            <SkeletonLine className="h-3 w-20" />
                                            <SkeletonLine className="h-4 w-4/5" />
                                            <SkeletonLine className="h-3 w-full" />
                                            <SkeletonLine className="h-3 w-2/3" />
                                        </div>
                                    </article>
                                ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                                {newestEvents.slice(0, 3).map((event: any) => (
                                    <article key={event._id} onClick={() => navigate(`/events/${event._id}`)} className="ticket-card cursor-pointer overflow-hidden rounded-2xl bg-white dark:bg-slate-900/90 text-slate-900 dark:text-slate-50 dark:border dark:border-white/10 dark:bg-slate-900/85 dark:text-slate-100 concert-ticket-card">
                                        <img src={event.banner_url || event.poster_url || heroImage} alt={event.name} className="h-40 w-full object-cover" />
                                        <div className="p-4">
                                            <p className="text-[11px] font-semibold text-slate-400">{event.genre || 'Sự kiện'}</p>
                                            <h3 className="mt-1 line-clamp-2 text-sm font-bold">{event.name}</h3>
                                            <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{event.description || 'Thông tin sự kiện sẽ được cập nhật trong thời gian tới.'}</p>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </div>
                </section>
            )}
        </div>
    );
}
