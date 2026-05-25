import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axiosClient';
import { FileEdit, Globe, Lock, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingOverlay } from '@/components/shared/LoadingOverlay';
import { useFeedbackStore } from '@/store/useFeedbackStore';

export default function EventManagement() {
    const navigate = useNavigate();
    const { showError } = useFeedbackStore();
    const [currentPage, setCurrentPage] = useState(1);

    const { data, isLoading, isError } = useQuery({
        queryKey: ['organizer-events', currentPage],
        queryFn: async () => {
            const response = await api.get(`/organizer/events?page=${currentPage}&limit=10`);
            return response.data;
        }
    });

    useEffect(() => {
        if (isError) {
            showError('Có lỗi xảy ra khi tải danh sách sự kiện. Vui lòng thử lại.');
        }
    }, [isError, showError]);

    const events = data?.data || [];
    const pagination = data?.pagination;

    const getVisibilityIcon = (status: string) => {
        switch (status) {
            case 'published':
                return <Globe size={16} className="text-success" />;
            case 'private':
                return <Lock size={16} className="text-neutral-base/60" />;
            case 'draft':
                return <FileEdit size={16} className="text-neutral-base/60" />;
            default:
                return <Globe size={16} className="text-primary" />;
        }
    };

    return (
        <div className="min-h-screen bg-white text-neutral-dark font-sans pb-10 w-full overflow-x-hidden">
            <LoadingOverlay isVisible={isLoading} message="Đang tải danh sách sự kiện..." />

            <div className="px-8 pt-8 pb-6 border-b border-neutral-base/10 bg-white">
                <div className="flex justify-between items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-secondary">Quản lý sự kiện</h1>
                        <p className="text-sm text-neutral-base/70 mt-1">
                            Theo dõi các sự kiện đã tạo và đi tới phần quản lý show của từng sự kiện.
                        </p>
                    </div>
                    <Button
                        onClick={() => navigate('/organizer/events/create')}
                        className="bg-primary hover:bg-primary/90 text-white font-medium flex items-center gap-2 px-6 py-2 rounded-full shadow-none"
                    >
                        <Plus size={20} />
                        <span>Tạo sự kiện</span>
                    </Button>
                </div>
            </div>

            <div className="w-full overflow-x-auto bg-white">
                {!isLoading && !isError && (
                    <table className="w-full text-left border-collapse min-w-[980px]">
                        <thead>
                            <tr className="border-b border-neutral-base/10 text-neutral-base/60 text-xs font-semibold uppercase tracking-wider bg-neutral-base/[0.03]">
                                <th className="px-8 py-4 w-[50%]">Sự kiện</th>
                                <th className="px-4 py-4 w-[15%]">Trạng thái</th>
                                <th className="px-4 py-4 w-[18%]">Thời gian</th>
                                <th className="px-4 py-4 text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-neutral-base/10">
                            {events.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="text-center py-16 text-neutral-base/70">
                                        Bạn chưa tạo sự kiện nào. Hãy tạo sự kiện đầu tiên nhé!
                                    </td>
                                </tr>
                            ) : events.map((event: any) => (
                                <tr key={event._id} className="hover:bg-neutral-base/[0.03] group">
                                    <td className="px-8 py-4">
                                        <div className="flex gap-4">
                                            <div
                                                className="w-[160px] h-[90px] rounded-lg overflow-hidden shrink-0 bg-neutral-base/[0.04] relative border border-neutral-base/10 cursor-pointer"
                                                onClick={() => navigate(`/organizer/events/${event._id}`)}
                                            >
                                                <img
                                                    src={event.poster_url || event.banner_url || 'https://via.placeholder.com/150'}
                                                    alt="thumb"
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>

                                            <div className="flex flex-col justify-start py-0.5">
                                                <button
                                                    type="button"
                                                    onClick={() => navigate(`/organizer/events/${event._id}`)}
                                                    className="text-left text-secondary font-bold text-base line-clamp-1 pr-4 hover:text-primary hover:underline"
                                                >
                                                    {event.name}
                                                </button>
                                                <div className="text-neutral-base/70 text-xs line-clamp-2 mt-1.5 pr-4 leading-relaxed">
                                                    {event.description || 'Chưa có mô tả sự kiện.'}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 align-top">
                                        <div className="flex items-center gap-2 mt-1">
                                            {getVisibilityIcon(event.status)}
                                            <span className="font-medium text-neutral-base capitalize">{event.status || 'draft'}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 align-top text-neutral-base/80">
                                        <div className="mt-1 flex flex-col">
                                            <span>{new Date(event.start_date).toLocaleDateString('vi-VN')}</span>
                                            <span className="text-xs text-neutral-base/50">
                                                Đến: {new Date(event.end_date).toLocaleDateString('vi-VN')}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 align-top text-right">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => navigate(`/organizer/events/${event._id}`)}
                                            className="mt-1 text-primary border-primary hover:bg-primary hover:text-white"
                                        >
                                            Quản lý show
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                {!isLoading && !isError && pagination && pagination.totalPages > 1 && (
                    <div className="flex justify-center gap-2 py-6 bg-white border-t border-neutral-base/10">
                        <Button
                            variant="outline"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage((page) => page - 1)}
                        >
                            Trang trước
                        </Button>
                        <div className="flex items-center px-4 font-medium text-neutral-base/80">
                            {currentPage} / {pagination.totalPages}
                        </div>
                        <Button
                            variant="outline"
                            disabled={currentPage === pagination.totalPages}
                            onClick={() => setCurrentPage((page) => page + 1)}
                        >
                            Trang sau
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
