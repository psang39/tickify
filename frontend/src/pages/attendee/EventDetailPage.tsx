import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, ImageIcon, MapPin, Music2, Ticket } from 'lucide-react';
import { usePublicEventDetail, usePublicEventShows, usePublicEvents } from '@/hooks/usePublicEventQueries';
import PublicEventCard from '@/components/public/PublicEventCard';

const fallbackBanner = 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=1400&q=80';

const formatDate = (value?: string) => {
    if (!value) return 'Đang cập nhật';
    return new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' });
};

const formatTime = (value?: string) => {
    if (!value) return 'Đang cập nhật';
    return new Date(value).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
};

const getStatusLabel = (status?: string) => {
    if (status === 'published') return 'Đang mở bán';
    if (status === 'cancelled') return 'Đã hủy';
    return 'Sắp công bố';
};

export default function EventDetailPage() {
    const { eventId } = useParams();
    const navigate = useNavigate();
    const [page, setPage] = useState(1);
    const { data: event, isLoading } = usePublicEventDetail(eventId);
    const { data: showsResponse, isLoading: isShowsLoading } = usePublicEventShows(eventId, page, 4);
    const { data: suggestions = [] } = usePublicEvents({ limit: 4, sort: 'upcoming' });

    const shows = showsResponse?.docs || showsResponse?.data || [];
    const totalPages = showsResponse?.totalPages || showsResponse?.pagination?.totalPages || 1;
    const banner = event?.banner_url || event?.poster_url || fallbackBanner;

    if (isLoading) {
        return <div className="mx-auto max-w-7xl px-6 py-14"><div className="h-96 animate-pulse rounded-3xl bg-slate-100 dark:bg-slate-800/80" /></div>;
    }

    if (!event) {
        return (
            <div className="mx-auto max-w-7xl px-6 py-20 text-center">
                <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Không tìm thấy sự kiện</h1>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Sự kiện có thể đã bị ẩn hoặc không còn tồn tại.</p>
                <Link to="/" className="mt-6 inline-flex rounded-xl bg-[#FF0082] px-6 py-3 text-sm font-bold text-white">Về trang chủ</Link>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-slate-900/90 font-sans text-slate-900 dark:text-slate-50">
            <section className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
                <button onClick={() => navigate(-1)} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-[#FF0082]">
                    <ChevronLeft size={18} /> Quay lại
                </button>

                <div className="relative overflow-hidden rounded-[28px] bg-slate-900">
                    <img src={banner} alt={event.name} className="h-[260px] w-full object-cover md:h-[360px]" style={{ objectPosition: `center ${event.banner_offset_y || 50}%` }} />
                    <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 max-w-3xl p-7 text-white md:p-10">
                        <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-xs font-bold backdrop-blur">
                            <Music2 size={14} /> {event.genre || 'Concert'}
                        </span>
                        <h1 className="mt-4 text-3xl font-black leading-tight md:text-5xl">{event.name}</h1>
                        <p className="mt-3 line-clamp-2 text-sm leading-6 text-white/80">{event.description}</p>
                    </div>
                </div>
            </section>

            <section className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-6 pb-8 lg:grid-cols-3 lg:px-8">
                <main className="lg:col-span-2">
                    <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/90 p-6">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">Thông tin sự kiện</h2>
                        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="rounded-2xl bg-slate-50 dark:bg-slate-900/80 p-4">
                                <p className="text-xs font-bold uppercase text-slate-400">Thời gian</p>
                                <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200"><CalendarDays size={16} />{formatDate(event.start_date)} - {formatDate(event.end_date)}</p>
                            </div>
                            <div className="rounded-2xl bg-slate-50 dark:bg-slate-900/80 p-4">
                                <p className="text-xs font-bold uppercase text-slate-400">Trạng thái</p>
                                <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-[#00A878]"><Ticket size={16} />{getStatusLabel(event.status)}</p>
                            </div>
                            <div className="rounded-2xl bg-slate-50 dark:bg-slate-900/80 p-4 sm:col-span-2">
                                <p className="text-xs font-bold uppercase text-slate-400">Nghệ sĩ</p>
                                <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                                    {Array.isArray(event.artists) && event.artists.length > 0 ? event.artists.join(', ') : 'Đang cập nhật'}
                                </p>
                            </div>
                        </div>
                        <div className="mt-6 border-t border-slate-100 dark:border-white/10 pt-6">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50">Mô tả</h3>
                            <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600 dark:text-slate-300">{event.description || 'Thông tin chi tiết sự kiện sẽ được cập nhật trong thời gian tới.'}</p>
                        </div>
                    </div>

                    <div className="mt-8 rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/90 p-6">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">Danh sách show</h2>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Chọn một show để xem sơ đồ ghế và đặt vé.</p>
                            </div>
                            {totalPages > 1 && (
                                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                                    Trang {page}/{totalPages}
                                    <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-full border border-slate-200 dark:border-white/10 p-2 disabled:opacity-40"><ChevronLeft size={16} /></button>
                                    <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="rounded-full border border-slate-200 dark:border-white/10 p-2 disabled:opacity-40"><ChevronRight size={16} /></button>
                                </div>
                            )}
                        </div>

                        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                            {isShowsLoading ? (
                                [1, 2, 3, 4].map((item) => <div key={item} className="h-36 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/80" />)
                            ) : shows.length === 0 ? (
                                <div className="rounded-2xl bg-slate-50 dark:bg-slate-900/80 p-8 text-center text-sm font-medium text-slate-400 md:col-span-2">Hiện chưa có show nào đang mở bán công khai.</div>
                            ) : shows.map((show: any) => {
                                const venue = show.venue_id || show.venue_info;
                                const isBookable = show.status === 'published';
                                return (
                                    <article key={show._id} className="overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/90">
                                        <div className="flex">
                                            <div className={`flex w-24 shrink-0 flex-col items-center justify-center ${isBookable ? 'bg-[#262880] text-white' : 'bg-slate-200 text-slate-500'}`}>
                                                <span className="text-2xl font-black">{new Date(show.start_time).toLocaleDateString('vi-VN', { day: '2-digit' })}</span>
                                                <span className="text-xs font-bold">Tháng {new Date(show.start_time).getMonth() + 1}</span>
                                            </div>
                                            <div className="flex flex-1 flex-col gap-2 p-4">
                                                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50">{show.name}</h3>
                                                <p className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400"><Clock size={14} />{formatTime(show.start_time)}</p>
                                                <p className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400"><MapPin size={14} />{venue?.name || 'Địa điểm đang cập nhật'}{venue?.city ? `, ${venue.city}` : ''}</p>
                                                <button
                                                    disabled={!isBookable}
                                                    onClick={() => navigate(`/shows/${show._id}/booking`)}
                                                    className="mt-2 self-end rounded-xl bg-[#FF0082] px-5 py-2 text-xs font-bold text-white transition hover:bg-pink-700 disabled:bg-slate-200 disabled:text-slate-400"
                                                >
                                                    {isBookable ? 'Xem vé' : 'Chưa mở'}
                                                </button>
                                            </div>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    </div>
                </main>

                <aside className="space-y-5">
                    <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/90 p-5">
                        <h3 className="text-base font-bold text-slate-900 dark:text-slate-50">Poster sự kiện</h3>
                        <div className="mt-4 aspect-[3/4] overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-800/80">
                            {event.poster_url ? <img src={event.poster_url} alt={event.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-slate-300"><ImageIcon size={36} /></div>}
                        </div>
                    </div>
                    <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/90 p-5">
                        <h3 className="text-base font-bold text-slate-900 dark:text-slate-50">Lưu ý đặt vé</h3>
                        <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">Bạn nên kiểm tra kỹ thời gian, địa điểm và trạng thái mở bán của từng show trước khi đặt vé. Vé sau khi thanh toán sẽ được lưu trong lịch sử đặt vé.</p>
                    </div>
                </aside>
            </section>

            <section className="mx-auto max-w-7xl px-6 pb-14 lg:px-8">
                <div className="mb-5 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">Gợi ý cho bạn</h2>
                    <Link to="/search" className="text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-[#FF0082]">Xem thêm</Link>
                </div>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                    {suggestions.filter((item: any) => item._id !== eventId).slice(0, 4).map((item: any) => <PublicEventCard key={item._id} event={item} />)}
                </div>
            </section>
        </div>
    );
}
