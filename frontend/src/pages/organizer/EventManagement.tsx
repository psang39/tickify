import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, FileEdit, Globe, Lock, Plus, Search } from 'lucide-react';
import { api } from '@/lib/axiosClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingOverlay } from '@/components/shared/LoadingOverlay';
import { useFeedbackStore } from '@/store/useFeedbackStore';

const formatDate = (value?: string) => value ? new Date(value).toLocaleDateString('vi-VN') : '-';

const statusLabel: Record<string, string> = {
    published: 'Đã xuất bản',
    private: 'Riêng tư',
    draft: 'Bản nháp',
};

function SummaryCard({ title, value, icon, hint }: { title: string; value: string | number; icon: ReactNode; hint?: string }) {
    return (
        <Card className="border-slate-200 rounded-2xl shadow-none">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">{title}</CardTitle>
                <div className="p-2 rounded-xl bg-slate-100 text-primary">{icon}</div>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-slate-900">{value}</div>
                {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
            </CardContent>
        </Card>
    );
}

export default function EventManagement() {
    const navigate = useNavigate();
    const { showError } = useFeedbackStore();
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');

    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ['organizer-events', currentPage],
        queryFn: async () => {
            const response = await api.get(`/organizer/events?page=${currentPage}&limit=10`);
            return response.data;
        },
    });

    useEffect(() => {
        if (isError) {
            showError('Có lỗi xảy ra khi tải danh sách sự kiện. Vui lòng thử lại.');
        }
    }, [isError, showError]);

    const events = data?.data || [];
    const pagination = data?.pagination;
    const totalPages = pagination?.totalPages || 1;

    const filteredEvents = useMemo(() => {
        const keyword = searchTerm.trim().toLowerCase();
        if (!keyword) return events;

        return events.filter((event: any) => [
            event.name,
            event.description,
            event.status,
        ].some((value) => String(value || '').toLowerCase().includes(keyword)));
    }, [events, searchTerm]);

    const summary = useMemo(() => {
        const total = pagination?.totalItems || pagination?.total || events.length;
        const published = events.filter((event: any) => event.status === 'published').length;
        const draft = events.filter((event: any) => !event.status || event.status === 'draft').length;
        const privateEvents = events.filter((event: any) => event.status === 'private').length;

        return { total, published, draft, privateEvents };
    }, [events, pagination]);

    const getStatusMeta = (status?: string) => {
        switch (status) {
            case 'published':
                return {
                    icon: <Globe size={14} />,
                    label: statusLabel.published,
                    className: 'bg-emerald-50 text-emerald-700 border-emerald-100',
                };
            case 'private':
                return {
                    icon: <Lock size={14} />,
                    label: statusLabel.private,
                    className: 'bg-slate-100 text-slate-700 border-slate-200',
                };
            case 'draft':
            default:
                return {
                    icon: <FileEdit size={14} />,
                    label: statusLabel.draft,
                    className: 'bg-amber-50 text-amber-700 border-amber-100',
                };
        }
    };

    if (isError) {
        return (
            <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 text-center">
                <p className="font-bold text-rose-600">Không thể tải danh sách sự kiện.</p>
                <Button onClick={() => refetch()} variant="outline">Thử lại</Button>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6 p-4 md:p-8">
            <LoadingOverlay isVisible={isLoading} message="Đang tải danh sách sự kiện..." />

            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Quản lý sự kiện</h1>
                    <p className="text-slate-500 mt-1 font-medium">
                        Theo dõi các sự kiện đã tạo, trạng thái xuất bản và truy cập nhanh vào phần quản lý show.
                    </p>
                </div>

                <Button
                    onClick={() => navigate('/organizer/events/create')}
                    className="bg-primary text-white hover:bg-primary/90 rounded-xl font-bold flex items-center gap-2"
                >
                    <Plus size={18} />
                    Tạo sự kiện
                </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <SummaryCard title="Tổng sự kiện" value={summary.total} icon={<CalendarDays size={20} />} hint="Tổng số sự kiện đã tạo" />
                <SummaryCard title="Đã xuất bản" value={summary.published} icon={<Globe size={20} />} hint="Đang hiển thị cho người dùng" />
                <SummaryCard title="Bản nháp" value={summary.draft} icon={<FileEdit size={20} />} hint="Chưa mở bán hoặc chưa hoàn thiện" />
                <SummaryCard title="Riêng tư" value={summary.privateEvents} icon={<Lock size={20} />} hint="Chỉ dùng nội bộ hoặc tạm ẩn" />
            </div>

            <Card className="border-slate-200 rounded-2xl shadow-none overflow-hidden">
                <CardHeader className="border-b border-slate-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                        <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                            Danh sách sự kiện
                        </CardTitle>
                        <p className="text-sm text-slate-500 mt-1">
                            Chọn một sự kiện để quản lý show, sơ đồ ghế, publish/unpublish và các cấu hình bán vé.
                        </p>
                    </div>

                    <div className="relative w-full lg:w-[320px]">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            placeholder="Tìm theo tên, mô tả, trạng thái..."
                            className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm bg-white focus:outline-primary"
                        />
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-[980px]">
                            <thead className="text-xs uppercase text-slate-400 border-b border-slate-100 bg-slate-50/80">
                                <tr>
                                    <th className="text-left px-6 py-4 w-[46%]">Sự kiện</th>
                                    <th className="text-left px-6 py-4 w-[16%]">Trạng thái</th>
                                    <th className="text-left px-6 py-4 w-[22%]">Thời gian</th>
                                    <th className="text-right px-6 py-4">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredEvents.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="py-14 text-center text-slate-400">
                                            {searchTerm ? 'Không tìm thấy sự kiện phù hợp.' : 'Bạn chưa tạo sự kiện nào. Hãy tạo sự kiện đầu tiên nhé!'}
                                        </td>
                                    </tr>
                                ) : filteredEvents.map((event: any) => {
                                    const statusMeta = getStatusMeta(event.status);

                                    return (
                                        <tr key={event._id} className="hover:bg-slate-50/70">
                                            <td className="px-6 py-4">
                                                <div className="flex gap-4">
                                                    <button
                                                        type="button"
                                                        className="w-[152px] h-[86px] rounded-xl overflow-hidden shrink-0 bg-slate-100 relative border border-slate-200 text-left"
                                                        onClick={() => navigate(`/organizer/events/${event._id}`)}
                                                    >
                                                        <img
                                                            src={event.poster_url || event.banner_url || 'https://via.placeholder.com/300x180?text=Tickify'}
                                                            alt={event.name || 'event thumbnail'}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </button>

                                                    <div className="min-w-0 py-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => navigate(`/organizer/events/${event._id}`)}
                                                            className="text-left text-slate-900 font-bold text-base line-clamp-1 hover:text-primary hover:underline"
                                                        >
                                                            {event.name}
                                                        </button>
                                                        <p className="text-slate-500 text-xs line-clamp-2 mt-1.5 leading-relaxed">
                                                            {event.description || 'Chưa có mô tả sự kiện.'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 align-top">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold ${statusMeta.className}`}>
                                                    {statusMeta.icon}
                                                    {statusMeta.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 align-top text-slate-600">
                                                <div className="flex flex-col gap-1">
                                                    <span className="font-semibold text-slate-700">{formatDate(event.start_date)}</span>
                                                    <span className="text-xs text-slate-500">Đến: {formatDate(event.end_date)}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 align-top text-right">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => navigate(`/organizer/events/${event._id}`)}
                                                    className="rounded-xl"
                                                >
                                                    Quản lý show
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {pagination && totalPages > 1 && (
                        <div className="flex justify-end gap-2 p-4 border-t border-slate-100">
                            <Button
                                variant="outline"
                                disabled={currentPage <= 1}
                                onClick={() => setCurrentPage((page) => page - 1)}
                            >
                                Trước
                            </Button>
                            <div className="px-3 py-2 text-sm font-medium text-slate-500">
                                Trang {currentPage} / {totalPages}
                            </div>
                            <Button
                                variant="outline"
                                disabled={currentPage >= totalPages}
                                onClick={() => setCurrentPage((page) => page + 1)}
                            >
                                Sau
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
