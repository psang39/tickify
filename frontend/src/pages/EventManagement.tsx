import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query'; // 1. Import TanStack Query
import { api } from '@/lib/axiosClient';
import { Globe, Lock, FileEdit, BarChart2, Filter, Plus } from 'lucide-react';
import { Button } from "@/components/ui/button";

export default function EventManagement() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('Events');
    const [currentPage, setCurrentPage] = useState(1);

    const { data, isLoading, isError } = useQuery({
        queryKey: ['organizer-events', currentPage],
        queryFn: async () => {
            const response = await api.get(`/organizer/events?page=${currentPage}&limit=10`);
            return response.data;
        }
    });

    const events = data?.data || [];
    const pagination = data?.pagination;

    const getVisibilityIcon = (status: string) => {
        switch (status) {
            case 'published': return <Globe size={16} className="text-green-600" />;
            case 'private': return <Lock size={16} className="text-gray-500" />;
            case 'draft': return <FileEdit size={16} className="text-gray-500" />;
            default: return <Globe size={16} className="text-primary" />;
        }
    };

    return (
        // Thêm w-full để đảm bảo tràn viền màn hình (responsive)
        <div className="min-h-screen bg-background text-foreground font-sans pb-10 w-full overflow-x-hidden">

            {/* HEADER SECTION (Theme Sáng) */}
            <div className="px-8 pt-8 pb-4 border-b border-gray-200 bg-white">

                {/* FIX LỖI OVERLAP: Dùng Flexbox bọc Title và Button lại, đẩy sang 2 bên */}
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold text-secondary">Quản lý Sự kiện</h1>

                    {/* Nút Tạo sự kiện nay đã nằm ngoan ngoãn trong Header */}
                    <Button
                        onClick={() => navigate('/organizer/events/create')}
                        className="bg-primary hover:bg-pink-700 text-white font-medium flex items-center gap-2 px-6 py-2 rounded-full shadow-sm"
                    >
                        <Plus size={20} />
                        <span>Tạo Sự Kiện</span>
                    </Button>
                </div>

                <div className="flex gap-8 text-sm font-medium text-gray-500">
                    {['Events', 'Shows', 'Analytics', 'Promotions'].map(tab => (
                        <div
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`pb-3 cursor-pointer transition-colors hover:text-secondary ${activeTab === tab ? 'text-secondary border-b-2 border-primary font-bold' : ''
                                }`}
                        >
                            {tab}
                        </div>
                    ))}
                </div>
            </div>

            <div className="px-8 py-3 border-b border-gray-200 bg-white flex items-center gap-4 text-sm text-gray-500 hover:text-secondary cursor-pointer transition-colors">
                <Filter size={18} />
                <span>Bộ lọc</span>
            </div>

            {/* Bảng dữ liệu */}
            <div className="w-full overflow-x-auto bg-white">
                {/* TanStack Query cung cấp sẵn isLoading và isError cực tiện */}
                {isLoading ? (
                    <div className="p-10 text-center text-primary font-medium animate-pulse">Đang tải dữ liệu từ Backend...</div>
                ) : isError ? (
                    <div className="p-10 text-center text-red-500 font-medium">Có lỗi xảy ra khi tải dữ liệu! Vui lòng thử lại.</div>
                ) : (
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                        <thead>
                            <tr className="border-b border-gray-200 text-gray-500 text-xs font-semibold uppercase tracking-wider bg-gray-50">
                                <th className="px-8 py-4 w-10"><input type="checkbox" className="rounded border-gray-300" /></th>
                                <th className="px-4 py-4 w-[40%]">Sự kiện</th>
                                <th className="px-4 py-4 w-[15%]">Trạng thái</th>
                                <th className="px-4 py-4 w-[15%]">Thời gian</th>
                                <th className="px-4 py-4 text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-gray-100">
                            {/* Render từ mảng events (đã được fallback là mảng rỗng nếu chưa có) */}
                            {events.length === 0 ? (
                                <tr><td colSpan={5} className="text-center py-16 text-gray-500">Bạn chưa tạo sự kiện nào. Hãy tạo sự kiện đầu tiên nhé!</td></tr>
                            ) : events.map((event: any) => (
                                <tr key={event._id} className="hover:bg-gray-50 transition-colors group">
                                    <td className="px-8 py-4 align-top"><input type="checkbox" className="mt-1 rounded border-gray-300" /></td>
                                    <td className="px-4 py-4">
                                        <div className="flex gap-4">
                                            <div className="w-[120px] h-[68px] rounded overflow-hidden shrink-0 bg-gray-200 relative border border-gray-100">
                                                <img src={event.poster_url || event.banner_url || "https://via.placeholder.com/150"} alt="thumb" className="w-full h-full object-cover" />
                                            </div>
                                            <div className="flex flex-col justify-between py-0.5">
                                                <div>
                                                    <div className="text-secondary font-bold line-clamp-1 pr-4">{event.name}</div>
                                                    <div className="text-gray-500 text-xs line-clamp-2 mt-1 pr-4 leading-relaxed">
                                                        {event.description}
                                                    </div>
                                                </div>
                                                <div className="flex gap-4 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => navigate(`/organizer/events/${event._id}`)} className="text-gray-400 hover:text-primary transition-colors">
                                                        <FileEdit size={18} />
                                                    </button>
                                                    <button className="text-gray-400 hover:text-secondary transition-colors"><BarChart2 size={18} /></button>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 align-top">
                                        <div className="flex items-center gap-2 mt-1">
                                            {getVisibilityIcon(event.status)}
                                            <span className="font-medium text-gray-700 capitalize">{event.status || 'draft'}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 align-top text-gray-600">
                                        <div className="mt-1 flex flex-col">
                                            <span>{new Date(event.start_date).toLocaleDateString('vi-VN')}</span>
                                            <span className="text-xs text-gray-400">Đến: {new Date(event.end_date).toLocaleDateString('vi-VN')}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 align-top text-right">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => navigate(`/organizer/events/${event._id}`)}
                                            className="mt-1 text-primary border-primary hover:bg-primary hover:text-white transition-colors"
                                        >
                                            Quản lý Show
                                        </Button>
                                        {!isLoading && pagination && pagination.totalPages > 1 && (
                                            <div className="flex justify-center gap-2 py-6 bg-white border-t">
                                                <Button
                                                    variant="outline"
                                                    disabled={currentPage === 1}
                                                    onClick={() => setCurrentPage(p => p - 1)}
                                                >
                                                    Trang trước
                                                </Button>

                                                <div className="flex items-center px-4 font-medium text-gray-600">
                                                    {currentPage} / {pagination.totalPages}
                                                </div>

                                                <Button
                                                    variant="outline"
                                                    disabled={currentPage === pagination.totalPages}
                                                    onClick={() => setCurrentPage(p => p + 1)}
                                                >
                                                    Trang sau
                                                </Button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}