import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
// Đã xóa import useEventStore
import { useAuthStore } from '@/store/useAuthStore';
import { Image as ImageIcon, MapPin, Calendar, Info, Edit3, Save, X } from 'lucide-react';
import { useCreateEvent } from '@/hooks/useEventQueries';

export default function CreateEvent() {
    const navigate = useNavigate();
    const { user } = useAuthStore();

    // 1. Kích hoạt TanStack Query Hook
    // isPending là biến tương đương với isLoading khi dùng Mutation
    const { mutateAsync: createEvent, isPending } = useCreateEvent();

    const [formData, setFormData] = useState({
        name: 'Taylor Swift - The Eras Tour',
        description: 'Nhấp vào đây để chỉnh sửa mô tả chi tiết về sự kiện của bạn. Bạn có thể giới thiệu về nghệ sĩ, không khí đêm diễn, và những lưu ý quan trọng dành cho khán giả...',
        genre: 'Pop / Concert',
        start_date: '',
        end_date: '',
        poster_url: '',
        banner_url: 'https://images.unsplash.com/photo-1540039155733-56f1c327262c?q=80&w=1920&auto=format&fit=crop',
        artists: '',
        status: 'draft',
        organizer_id: user?.id || ''
    });

    const [isEditingBanner, setIsEditingBanner] = useState(false);

    const handleSubmit = async () => {
        if (!formData.organizer_id) {
            alert("Bạn chưa đăng nhập!");
            return;
        }
        // Validate cơ bản
        if (!formData.start_date || !formData.end_date) {
            alert("Vui lòng chọn ngày bắt đầu và ngày kết thúc cho sự kiện!");
            return;
        }

        // 2. Dùng try...catch cho hàm mutateAsync của TanStack
        try {
            await createEvent(formData);
            alert("Xuất bản sự kiện thành công! Cùng tạo Show biểu diễn nào.");
            navigate('/organizer/events');
        } catch (error) {
            // Lỗi (nếu có) đã được file hook tự động xử lý và hiện alert,
            // Ở đây chỉ cần bắt để code không bị crash.
            console.error("Lỗi khi xuất bản sự kiện:", error);
        }
    };

    return (
        // 3. FIX RESPONSIVE: Thêm w-full và overflow-x-hidden để chống vỡ khung ngang
        <div className="min-h-screen bg-[#F8F9FA] relative pb-24 font-sans w-full overflow-x-hidden">

            {/* ========================================== */}
            {/* 1. KHU VỰC BANNER TRÀN VIỀN (FULL-BLEED)   */}
            {/* ========================================== */}
            <div className="relative w-full h-[400px] md:h-[500px] bg-gray-900 group">
                {formData.banner_url ? (
                    <img src={formData.banner_url} alt="Banner" className="w-full h-full object-cover opacity-80" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500"><ImageIcon size={64} /></div>
                )}

                {/* Lớp phủ Gradient mờ ảo */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent pointer-events-none"></div>

                {/* Nút Đổi ảnh bìa (Chỉ hiện khi hover chuột vào banner) */}
                <div className="absolute top-6 right-6 z-10">
                    {isEditingBanner ? (
                        <div className="bg-white p-2 rounded-lg shadow-xl flex items-center gap-2 w-80 animate-in fade-in zoom-in duration-200">
                            <input
                                type="text"
                                placeholder="Dán link ảnh (URL) vào đây..."
                                className="flex-1 text-sm p-2 outline-none"
                                value={formData.banner_url}
                                onChange={(e) => setFormData({ ...formData, banner_url: e.target.value })}
                                autoFocus
                            />
                            <Button size="icon" variant="ghost" onClick={() => setIsEditingBanner(false)}><Save size={18} className="text-primary" /></Button>
                        </div>
                    ) : (
                        <Button
                            variant="outline"
                            className="bg-black/50 text-white border-white/30 backdrop-blur-md hover:bg-white hover:text-black transition-all opacity-0 group-hover:opacity-100"
                            onClick={() => setIsEditingBanner(true)}
                        >
                            <ImageIcon size={18} className="mr-2" /> Đổi ảnh bìa
                        </Button>
                    )}
                </div>

                {/* Text Overlay (Canh giữa nội dung theo container) */}
                <div className="absolute bottom-10 left-0 w-full px-6 lg:px-12 flex justify-center">
                    <div className="w-full max-w-6xl flex flex-col md:flex-row justify-between items-start md:items-end gap-6">

                        {/* 4. FIX RESPONSIVE: Đổi thẻ input thành textarea để tên tự động rớt dòng */}
                        <div className="flex-1 w-full relative group/title">
                            <Edit3 size={24} className="absolute -left-8 top-4 text-white/50 opacity-0 group-hover/title:opacity-100 transition-opacity hidden md:block" />
                            <textarea
                                rows={2}
                                className="w-full bg-transparent border-b-2 border-transparent hover:border-white/30 focus:border-white focus:bg-white/10 outline-none text-4xl md:text-5xl lg:text-7xl font-black text-white leading-tight drop-shadow-2xl transition-all p-2 -ml-2 rounded-t-lg placeholder-white/50 resize-none overflow-hidden"
                                value={formData.name}
                                placeholder="Nhập tên sự kiện..."
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>

                        {/* INLINE EDIT: Thể loại */}
                        <div className="bg-white/20 backdrop-blur-md text-white px-2 py-1 rounded-full font-bold border border-white/30 flex items-center shadow-xl group/genre transition-all focus-within:bg-white/40">
                            <Info size={18} className="ml-2" />
                            <input
                                className="bg-transparent border-none outline-none text-white placeholder-white/70 w-32 md:w-40 px-3 py-2 font-bold"
                                value={formData.genre}
                                placeholder="Thể loại..."
                                onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* ========================================== */}
            {/* 2. KHU VỰC NỘI DUNG (Responsive Container) */}
            {/* ========================================== */}
            <div className="w-full max-w-6xl mx-auto px-6 lg:px-12 mt-12 grid grid-cols-1 xl:grid-cols-3 gap-10">

                {/* Cột Trái (Chiếm 2 phần) */}
                <div className="xl:col-span-2 space-y-10">

                    {/* INLINE EDIT: Description */}
                    <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 relative group/desc hover:shadow-md transition-all">
                        <div className="absolute top-8 right-8 text-gray-300 opacity-0 group-hover/desc:opacity-100"><Edit3 size={20} /></div>
                        <h2 className="text-2xl font-bold text-secondary mb-4">Giới thiệu sự kiện</h2>
                        <textarea
                            className="w-full bg-transparent outline-none border-2 border-transparent hover:border-gray-100 focus:border-primary/30 focus:bg-gray-50 rounded-xl p-4 -ml-4 text-gray-600 leading-relaxed text-lg resize-none min-h-[200px] transition-all"
                            value={formData.description}
                            placeholder="Viết vài lời giới thiệu hấp dẫn về sự kiện của bạn..."
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>

                    {/* Configuration: Thời gian (Giả lập giao diện mua vé) */}
                    <div>
                        <h2 className="text-2xl font-bold text-secondary mb-4 flex items-center gap-2">
                            <Calendar className="text-primary" /> Thiết lập thời gian
                        </h2>
                        <div className="bg-white border border-primary/20 rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row gap-8 items-center bg-gradient-to-r from-pink-50/50 to-white">

                            <div className="flex-1 w-full space-y-2">
                                <label className="text-sm font-bold text-gray-700">Ngày khai mạc</label>
                                <input
                                    type="date"
                                    className="w-full bg-white border border-gray-300 rounded-xl p-4 outline-none focus:ring-2 focus:ring-primary/20 font-medium text-secondary shadow-sm"
                                    value={formData.start_date}
                                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                />
                            </div>

                            <div className="hidden md:block text-gray-300">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                            </div>

                            <div className="flex-1 w-full space-y-2">
                                <label className="text-sm font-bold text-gray-700">Ngày bế mạc</label>
                                <input
                                    type="date"
                                    className="w-full bg-white border border-gray-300 rounded-xl p-4 outline-none focus:ring-2 focus:ring-primary/20 font-medium text-secondary shadow-sm"
                                    value={formData.end_date}
                                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                                />
                            </div>

                        </div>
                    </div>
                </div>

                {/* Cột Phải (Chiếm 1 phần) */}
                <div className="space-y-6">
                    <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
                        <h3 className="font-bold text-lg mb-4 text-secondary flex items-center gap-2"><MapPin size={20} className="text-primary" /> Vị trí tổ chức</h3>
                        <div className="w-full h-[250px] bg-gray-100 rounded-2xl overflow-hidden relative border border-gray-200">
                            <img src="https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=800&auto=format&fit=crop" className="w-full h-full object-cover opacity-50 grayscale" alt="map" />
                            <div className="absolute inset-0 flex items-center justify-center flex-col gap-2">
                                <span className="bg-white px-6 py-3 rounded-full font-bold text-sm text-secondary shadow-lg text-center">
                                    Bản đồ sẽ tự động kích hoạt
                                </span>
                                <span className="text-xs text-gray-500 font-medium bg-white/80 px-3 py-1 rounded-full">Sau khi bạn tạo Show</span>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {/* ========================================== */}
            {/* 3. THANG CÔNG CỤ NỔI (FLOATING ACTION BAR) */}
            {/* ========================================== */}
            <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-50 animate-in slide-in-from-bottom-10">
                <div className="max-w-6xl mx-auto px-6 lg:px-12 py-4 flex items-center justify-between">
                    <div className="hidden sm:block">
                        <p className="font-bold text-secondary text-lg">Bạn đang ở chế độ: Page Builder</p>
                        <p className="text-sm text-gray-500">Mọi thay đổi trên màn hình sẽ được lưu lại.</p>
                    </div>

                    <div className="flex gap-4 w-full sm:w-auto">
                        <Button variant="outline" className="flex-1 sm:flex-none border-gray-300 px-8 rounded-full font-bold" onClick={() => navigate(-1)}>
                            <X size={18} className="mr-2" /> Hủy
                        </Button>

                        {/* 5. Cập nhật dùng isPending thay cho isLoading */}
                        <Button
                            onClick={handleSubmit}
                            disabled={isPending}
                            className="flex-1 sm:flex-none bg-primary hover:bg-pink-700 text-white px-10 rounded-full font-bold shadow-lg shadow-pink-200 transition-transform hover:-translate-y-1"
                        >
                            <Save size={18} className="mr-2" /> {isPending ? "Đang lưu..." : "Xuất bản Sự kiện"}
                        </Button>
                    </div>
                </div>
            </div>

        </div>
    );
}