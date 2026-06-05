import { Calendar, ImageIcon, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const formatDate = (value?: string) => {
    if (!value) return 'Chưa cập nhật';
    return new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export default function PublicEventCard({ event }: { event: any }) {
    const navigate = useNavigate();

    return (
        <article
            onClick={() => navigate(`/events/${event._id}`)}
            className="group overflow-hidden rounded-2xl border border-white/10 dark:border-white/10 bg-white dark:bg-slate-900/90 transition-all hover:-translate-y-1 hover:border-[#FF0082]/40 hover:shadow-lg cursor-pointer"
        >
            <div className="relative aspect-[4/3] overflow-hidden bg-slate-100 dark:bg-slate-800/80">
                {event.poster_url || event.banner_url ? (
                    <img
                        src={event.poster_url || event.banner_url}
                        alt={event.name}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-300">
                        <ImageIcon size={34} />
                    </div>
                )}
                {event.genre && (
                    <span className="absolute left-3 top-3 rounded-full bg-white/90 dark:bg-slate-950/90 px-3 py-1 text-[11px] font-bold text-slate-200 dark:text-slate-200 backdrop-blur">
                        {event.genre}
                    </span>
                )}
            </div>
            <div className="space-y-2 p-4">
                <h3 className="line-clamp-2 text-sm font-bold text-slate-100 dark:text-slate-100 group-hover:text-[#FF0082]">
                    {event.name}
                </h3>
                <p className="line-clamp-1 text-xs font-medium text-slate-400">
                    {Array.isArray(event.artists) ? event.artists.join(', ') : event.artists || 'Nhiều nghệ sĩ'}
                </p>
                <div className="flex items-center justify-between border-t border-slate-100 dark:border-white/10 pt-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1"><Calendar size={13} />{formatDate(event.start_date)}</span>
                    <span className="flex items-center gap-1 text-[#4C4DCC]"><MapPin size={13} />{event.venue_info?.city || 'Việt Nam'}</span>
                </div>
            </div>
        </article>
    );
}
