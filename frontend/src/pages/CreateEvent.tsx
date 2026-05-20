import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { useAuthStore } from '@/store/useAuthStore';
import { Image as ImageIcon, Calendar, Info, Edit3, Save, X, UploadCloud, Mic2, EyeOff, Globe, Move, Check } from 'lucide-react';
import { useCreateEvent } from '@/hooks/useEventQueries';

export default function CreateEvent() {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const { mutateAsync: createEvent, isPending } = useCreateEvent();

    const [formData, setFormData] = useState({
        name: 'Taylor Swift - The Eras Tour',
        artists: 'Taylor Swift, Paramore',
        description: 'Nhấp vào đây để chỉnh sửa mô tả chi tiết về sự kiện của bạn...',
        genre: 'Pop / Concert',
        start_date: '',
        end_date: '',
        poster_url: '',
        banner_url: 'https://images.unsplash.com/photo-1540039155733-56f1c327262c?q=80&w=1920&auto=format&fit=crop',
        banner_offset_y: 50, // 🔥 MỚI: Mặc định là 50% (Căn giữa)
        status: 'draft',
        organizer_id: user?.id || ''
    });

    // ==========================================
    // LOGIC KÉO THẢ ẢNH BÌA (DRAG & DROP)
    // ==========================================
    const [isRepositioning, setIsRepositioning] = useState(false);
    const [dragState, setDragState] = useState({ isDragging: false, startY: 0 });

    const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isRepositioning) return;
        // Hỗ trợ cả Touch (Mobile) và Mouse (PC)
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        setDragState({ isDragging: true, startY: clientY });
    };

    const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isRepositioning || !dragState.isDragging) return;

        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        const deltaY = clientY - dragState.startY;

        // Công thức: 1px rê chuột sẽ thay đổi ~0.15%. Kéo xuống (-) sẽ làm giảm %.
        let newOffset = formData.banner_offset_y - (deltaY * 0.15);
        if (newOffset < 0) newOffset = 0;
        if (newOffset > 100) newOffset = 100;

        setFormData(prev => ({ ...prev, banner_offset_y: newOffset }));
        setDragState({ isDragging: true, startY: clientY }); // Reset lại điểm bám
    };

    const handleMouseUp = () => {
        if (!isRepositioning) return;
        setDragState({ isDragging: false, startY: 0 });
    };

    // Hàm upload ảnh
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'banner' | 'poster') => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                alert("Vui lòng chỉ chọn file hình ảnh!"); return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result as string;
                if (type === 'banner') {
                    setFormData({ ...formData, banner_url: base64String, banner_offset_y: 50 }); // Load ảnh mới thì reset về giữa
                } else {
                    setFormData({ ...formData, poster_url: base64String });
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async () => {
        if (!formData.organizer_id) { alert("Bạn chưa đăng nhập!"); return; }
        if (!formData.start_date || !formData.end_date) { alert("Vui lòng chọn ngày bắt đầu và kết thúc!"); return; }

        try {
            await createEvent(formData);
            alert("Lưu sự kiện thành công!");
            navigate('/organizer/events');
        } catch (error) { console.error("Lỗi khi lưu sự kiện:", error); }
    };

    return (
        <div className="min-h-screen bg-[#F8F9FA] relative pb-24 font-sans w-full overflow-x-hidden">

            {/* ========================================== */}
            {/* 1. KHU VỰC BANNER TRÀN VIỀN (FULL-BLEED)    */}
            {/* ========================================== */}
            <div
                className={`relative w-full h-[300px] md:h-[400px] bg-gray-900 overflow-hidden select-none transition-all ${isRepositioning ? (dragState.isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'group'}`}
                // Gắn sự kiện lắng nghe rê chuột/chạm
                onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
                onTouchStart={handleMouseDown} onTouchMove={handleMouseMove} onTouchEnd={handleMouseUp}
            >
                {formData.banner_url ? (
                    <img
                        src={formData.banner_url}
                        alt="Banner"
                        draggable={false} // Chống trình duyệt tự kéo ảnh đi nơi khác
                        className={`w-full h-full object-cover transition-opacity duration-300 ${isRepositioning ? 'opacity-100 scale-[1.02]' : 'opacity-80'}`}
                        // 🔥 ĐÂY LÀ CHÌA KHÓA: Điều chỉnh vị trí Focus của ảnh
                        style={{ objectPosition: `50% ${formData.banner_offset_y}%` }}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500"><ImageIcon size={64} /></div>
                )}

                {/* Nếu đang chỉnh vị trí thì làm tối ảnh lại và hiện Grid ảo (Đẹp như Facebook) */}
                {isRepositioning && (
                    <div className="absolute inset-0 bg-black/30 bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:50px_50px] pointer-events-none"></div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none transition-opacity duration-300" style={{ opacity: isRepositioning ? 0 : 1 }}></div>

                {/* THANH ĐIỀU KHIỂN BANNER */}
                <div className="absolute top-6 right-6 z-20 flex gap-2">
                    {isRepositioning ? (
                        <div className="flex gap-2 bg-black/60 p-1.5 rounded-lg backdrop-blur-md animate-in fade-in">
                            <span className="flex items-center text-white text-sm font-medium px-3"><Move size={16} className="mr-2" /> Kéo để căn chỉnh</span>
                            <Button size="sm" className="bg-white text-black hover:bg-gray-200" onClick={() => setIsRepositioning(false)}>
                                <Check size={16} className="mr-1" /> Xong
                            </Button>
                        </div>
                    ) : (
                        <>
                            <Button variant="outline" className="bg-black/50 text-white border-white/30 backdrop-blur-md hover:bg-white hover:text-black transition-all opacity-0 group-hover:opacity-100" onClick={() => setIsRepositioning(true)}>
                                <Move size={16} className="mr-2" /> Chỉnh vị trí
                            </Button>
                            <label className="inline-flex items-center justify-center px-4 py-2 bg-black/50 text-white border border-white/30 rounded-md backdrop-blur-md hover:bg-white hover:text-black transition-all opacity-0 group-hover:opacity-100 cursor-pointer text-sm font-medium shadow-lg">
                                <UploadCloud size={16} className="mr-2" /> Đổi Banner
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'banner')} />
                            </label>
                        </>
                    )}
                </div>

                {/* TEXT TRÊN BANNER (Mờ đi khi đang Drag) */}
                <div className={`absolute bottom-8 left-0 w-full px-6 lg:px-12 flex justify-center transition-all duration-300 ${isRepositioning ? 'opacity-20 pointer-events-none blur-sm' : 'opacity-100'}`}>
                    <div className="w-full max-w-6xl flex flex-col justify-end gap-2">
                        <div className="bg-white/20 backdrop-blur-md text-white px-1 py-0.5 rounded-full font-semibold border border-white/30 flex items-center w-fit focus-within:bg-white/40 transition-all">
                            <Info size={14} className="ml-2 opacity-80" />
                            <input
                                className="bg-transparent border-none outline-none text-white placeholder-white/70 w-32 px-2 py-1 text-sm font-semibold"
                                value={formData.genre} placeholder="Thể loại..." onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                            />
                        </div>
                        <div className="w-full relative group/title">
                            <Edit3 size={20} className="absolute -left-8 top-3 text-white/50 opacity-0 group-hover/title:opacity-100 transition-opacity hidden md:block" />
                            <textarea
                                rows={2}
                                className="w-full bg-transparent border-b-2 border-transparent hover:border-white/30 focus:border-white focus:bg-white/10 outline-none text-3xl md:text-4xl lg:text-5xl font-black text-white leading-tight drop-shadow-xl transition-all p-2 -ml-2 rounded-t-lg placeholder-white/50 resize-none overflow-hidden"
                                value={formData.name} placeholder="Nhập tên sự kiện..." onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                        <div className="w-full relative group/artist mt-[-8px]">
                            <Mic2 size={16} className="absolute -left-7 top-3 text-white/50 opacity-0 group-hover/artist:opacity-100 transition-opacity hidden md:block" />
                            <input
                                type="text" className="w-full bg-transparent border-b border-transparent hover:border-white/20 focus:border-white/50 outline-none text-lg md:text-xl text-white/90 font-medium drop-shadow-md transition-all p-1 -ml-1 rounded placeholder-white/40"
                                value={formData.artists} placeholder="Nghệ sĩ biểu diễn (Optional)..." onChange={(e) => setFormData({ ...formData, artists: e.target.value })}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* CÁC PHẦN DƯỚI (Description, Thời gian, Poster) GIỮ NGUYÊN NHƯ CODE TRƯỚC */}
            <div className="w-full max-w-6xl mx-auto px-6 lg:px-12 mt-10 grid grid-cols-1 xl:grid-cols-3 gap-8">
                <div className="xl:col-span-2 space-y-8">
                    {/* Description */}
                    <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 relative group/desc hover:shadow-md transition-all">
                        <div className="absolute top-6 right-6 text-gray-300 opacity-0 group-hover/desc:opacity-100"><Edit3 size={18} /></div>
                        <h2 className="text-xl font-bold text-secondary mb-3">Giới thiệu sự kiện</h2>
                        <textarea
                            className="w-full bg-transparent outline-none border-2 border-transparent hover:border-gray-100 focus:border-primary/30 focus:bg-gray-50 rounded-xl p-3 -ml-3 text-gray-600 leading-relaxed text-base resize-none min-h-[150px] transition-all"
                            value={formData.description} placeholder="Viết vài lời giới thiệu hấp dẫn về sự kiện của bạn..."
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>

                    {/* Thời gian */}
                    <div>
                        <h2 className="text-xl font-bold text-secondary mb-3 flex items-center gap-2">
                            <Calendar className="text-primary" size={20} /> Thiết lập thời gian chung
                        </h2>
                        <div className="bg-white border border-primary/20 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row gap-6 items-center bg-gradient-to-r from-pink-50/50 to-white">
                            <div className="flex-1 w-full space-y-1.5">
                                <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Ngày khai mạc</label>
                                <input type="date" className="w-full bg-white border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-primary/20 font-medium text-sm text-secondary shadow-sm" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} />
                            </div>
                            <div className="hidden md:block text-gray-300"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg></div>
                            <div className="flex-1 w-full space-y-1.5">
                                <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Ngày bế mạc</label>
                                <input type="date" className="w-full bg-white border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-primary/20 font-medium text-sm text-secondary shadow-sm" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Poster */}
                <div className="space-y-6">
                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col h-full">
                        <h3 className="font-bold text-lg mb-1 text-secondary flex items-center gap-2">Ảnh Poster (Dọc)</h3>
                        <p className="text-xs text-gray-500 mb-4">Tỉ lệ chuẩn 3:4. Dùng để hiển thị ở trang danh sách sự kiện.</p>

                        <div className="w-full flex-1 min-h-[300px] bg-slate-50 rounded-xl overflow-hidden relative border-2 border-dashed border-gray-300 hover:border-primary/50 transition-colors group">
                            {formData.poster_url ? (
                                <img src={formData.poster_url} className="w-full h-full object-cover" alt="Poster" />
                            ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                                    <ImageIcon size={40} className="mb-2 opacity-50" />
                                    <span className="text-sm font-medium">Chưa có Poster</span>
                                </div>
                            )}

                            <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                <span className="bg-white text-secondary font-bold text-sm px-4 py-2 rounded-full shadow-lg flex items-center">
                                    <UploadCloud size={16} className="mr-2" /> Chọn Ảnh
                                </span>
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'poster')} />
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            {/* ========================================== */}
            {/* 3. THANH CÔNG CỤ NỔI */}
            {/* ========================================== */}
            <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-50 animate-in slide-in-from-bottom-10">
                <div className="max-w-6xl mx-auto px-6 lg:px-12 py-3 md:py-4 flex flex-col sm:flex-row items-center justify-between gap-4">

                    <div className="flex items-center gap-3 w-full sm:w-auto bg-slate-100 p-1.5 rounded-lg border border-slate-200">
                        <button type="button" onClick={() => setFormData({ ...formData, status: 'draft' })} className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${formData.status === 'draft' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                            <EyeOff size={16} /> Bản nháp
                        </button>
                        <button type="button" onClick={() => setFormData({ ...formData, status: 'published' })} className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${formData.status === 'published' ? 'bg-green-500 text-white shadow-sm shadow-green-500/30' : 'text-slate-500 hover:text-slate-700'}`}>
                            <Globe size={16} /> Công khai
                        </button>
                    </div>

                    <div className="flex gap-3 w-full sm:w-auto">
                        <Button variant="outline" className="flex-1 sm:flex-none border-gray-300 px-6 rounded-full font-bold text-sm" onClick={() => navigate(-1)}>
                            <X size={16} className="mr-1.5" /> Hủy
                        </Button>
                        <Button onClick={handleSubmit} disabled={isPending} className="flex-1 sm:flex-none bg-primary hover:bg-pink-700 text-white px-8 rounded-full font-bold shadow-md shadow-pink-200 text-sm">
                            <Save size={16} className="mr-1.5" /> {isPending ? "Đang lưu..." : "Lưu Sự kiện"}
                        </Button>
                    </div>
                </div>
            </div>

        </div>
    );
}