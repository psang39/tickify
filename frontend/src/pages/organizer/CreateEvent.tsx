import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { useAuthStore } from '@/store/useAuthStore';
import { Image as ImageIcon, Calendar, Info, Edit3, Save, X, UploadCloud, Mic2, Move, Check, ArrowLeft } from 'lucide-react';
import { useCreateEvent } from '@/hooks/useEventQueries';
import { LoadingOverlay } from '@/components/shared/LoadingOverlay';
import { useFeedbackStore } from '@/store/useFeedbackStore';

export default function CreateEvent() {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const { mutateAsync: createEvent, isPending } = useCreateEvent();
    const { showSuccess, showError } = useFeedbackStore();

    const [formData, setFormData] = useState({
        name: 'Tên sự kiện của bạn',
        artists: 'Người biểu diễn/diễn giả',
        description: 'Nhấp vào đây để chỉnh sửa mô tả chi tiết về sự kiện của bạn...',
        genre: 'Thể loại sự kiện',
        start_date: '',
        end_date: '',
        poster_url: '',
        banner_url: '',
        banner_offset_y: 50,
        status: 'draft',
    });

    const [bannerFile, setBannerFile] = useState<File | null>(null);
    const [posterFile, setPosterFile] = useState<File | null>(null);

    const [isRepositioning, setIsRepositioning] = useState(false);
    const [dragState, setDragState] = useState({ isDragging: false, startY: 0 });

    const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isRepositioning) return;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        setDragState({ isDragging: true, startY: clientY });
    };

    const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isRepositioning || !dragState.isDragging) return;

        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        const deltaY = clientY - dragState.startY;

        let newOffset = formData.banner_offset_y - (deltaY * 0.15);
        if (newOffset < 0) newOffset = 0;
        if (newOffset > 100) newOffset = 100;

        setFormData(prev => ({ ...prev, banner_offset_y: newOffset }));
        setDragState({ isDragging: true, startY: clientY });
    };

    const handleMouseUp = () => {
        if (!isRepositioning) return;
        setDragState({ isDragging: false, startY: 0 });
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'banner' | 'poster') => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            showError("Vui lòng chỉ chọn file hình ảnh!");
            return;
        }

        const previewUrl = URL.createObjectURL(file);
        if (type === 'banner') {
            if (formData.banner_url.startsWith('blob:')) URL.revokeObjectURL(formData.banner_url);
            setBannerFile(file);
            setFormData(prev => ({ ...prev, banner_url: previewUrl, banner_offset_y: 50 }));
        } else {
            if (formData.poster_url.startsWith('blob:')) URL.revokeObjectURL(formData.poster_url);
            setPosterFile(file);
            setFormData(prev => ({ ...prev, poster_url: previewUrl }));
        }
    };

    const handleSubmit = async () => {
        const organizer_id = user?.id || user?._id as string;
        if (!organizer_id) { showError("Bạn chưa đăng nhập!"); return; }
        if (!formData.start_date || !formData.end_date) { showError("Vui lòng thiết lập mốc ngày khai mạc và bế mạc sự kiện!"); return; }

        try {
            const payload = new FormData();
            payload.append('name', formData.name);
            payload.append('artists', formData.artists);
            payload.append('description', formData.description);
            payload.append('genre', formData.genre);
            payload.append('start_date', formData.start_date);
            payload.append('end_date', formData.end_date);
            payload.append('banner_offset_y', String(formData.banner_offset_y));
            payload.append('status', formData.status);
            payload.append('organizer_id', organizer_id);

            if (posterFile) payload.append('poster', posterFile);
            if (bannerFile) payload.append('banner', bannerFile);

            await createEvent(payload);
            showSuccess("Tạo sự kiện bản nháp thành công.");
            navigate('/organizer/events');
        } catch (error) {
            console.error("Lỗi khi lưu sự kiện:", error);
        }
    };

    return (
        <div className="min-h-screen  relative pb-24 font-sans w-full overflow-x-hidden">
            <LoadingOverlay isVisible={isPending} message="Đang tạo sự kiện..." />

            {/* NÚT BACK GÓC TRÁI QUAY LẠI DANH SÁCH THEO THIẾT KẾ TRANG DETAIL */}
            <button
                onClick={() => navigate('/organizer/events')}
                className="absolute top-6 left-6 z-20 bg-black/40 hover:bg-black/70 text-white p-2.5 rounded-full backdrop-blur-md transition-all border border-transparent"
            >
                <ArrowLeft size={24} />
            </button>

            <div
                className={`relative w-full h-[300px] md:h-[400px] bg-gray-900 overflow-hidden select-none transition-all ${isRepositioning ? (dragState.isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'group'}`}
                onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
                onTouchStart={handleMouseDown} onTouchMove={handleMouseMove} onTouchEnd={handleMouseUp}
            >
                {formData.banner_url ? (
                    <img
                        src={formData.banner_url}
                        alt="Banner"
                        draggable={false}
                        className={`w-full h-full object-cover transition-opacity duration-300 ${isRepositioning ? 'opacity-100 scale-[1.02]' : 'opacity-80'}`}
                        style={{ objectPosition: `50% ${formData.banner_offset_y}%` }}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500 dark:text-slate-400"><ImageIcon size={64} /></div>
                )}

                {isRepositioning && (
                    <div className="absolute inset-0 bg-black/30 bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:50px_50px] pointer-events-none"></div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none transition-opacity duration-300" style={{ opacity: isRepositioning ? 0 : 1 }}></div>

                <div className="absolute top-6 right-6 z-20 flex gap-2">
                    {isRepositioning ? (
                        <div className="flex gap-2 bg-black/60 p-1.5 rounded-lg backdrop-blur-md animate-in fade-in">
                            <span className="flex items-center text-white text-sm font-medium px-3"><Move size={16} className="mr-2" /> Kéo để căn chỉnh</span>
                            <Button size="sm" className="bg-white dark:bg-slate-900/90 text-black hover:bg-gray-200" onClick={() => setIsRepositioning(false)}>
                                <Check size={16} className="mr-1" /> Xong
                            </Button>
                        </div>
                    ) : (
                        <>
                            <Button variant="outline" className="bg-black/50 text-white border-white/30 backdrop-blur-md hover:bg-white dark:hover:bg-slate-800 hover:text-black transition-all opacity-0 group-hover:opacity-100" onClick={() => setIsRepositioning(true)}>
                                <Move size={16} className="mr-2" /> Chỉnh vị trí
                            </Button>
                            <label className="inline-flex items-center justify-center px-4 py-2 bg-black/50 text-white border border-white/30 rounded-md backdrop-blur-md hover:bg-white dark:hover:bg-slate-800 hover:text-black transition-all opacity-0 group-hover:opacity-100 cursor-pointer text-sm font-medium">
                                <UploadCloud size={16} className="mr-2" /> Đổi Banner
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'banner')} />
                            </label>
                        </>
                    )}
                </div>

                <div className={`absolute bottom-8 left-0 w-full px-6 lg:px-12 flex justify-center transition-all duration-300 ${isRepositioning ? 'opacity-20 pointer-events-none blur-sm' : 'opacity-100'}`}>
                    <div className="w-full max-w-6xl flex flex-col justify-end gap-2">
                        <div className="bg-white/20 backdrop-blur-md text-white px-1 py-0.5 rounded-full font-semibold border border-white/30 flex items-center w-fit focus-within:bg-white/40 transition-all">
                            <Info size={14} className="ml-2 opacity-80" />
                            <div
  contentEditable
  suppressContentEditableWarning
  spellCheck={false}
  onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
  onBlur={(e) => setFormData({ ...formData, genre: (e.currentTarget.textContent || '').trim() })}
  className="tickify-hero-pill inline-flex min-h-[2rem] max-w-full cursor-text items-center rounded-full border border-white/15 bg-black/35 px-4 py-1.5 text-sm font-bold text-white !text-white outline-none backdrop-blur-md transition-colors"
>
  {formData.genre || 'Thể loại sự kiện'}
</div> setFormData({ ...formData, genre: e.target.value })}
                            />
                        </div>
                        <div className="w-full relative group/title">
                            <Edit3 size={20} className="absolute -left-8 top-3 text-white/50 opacity-0 group-hover/title:opacity-100 transition-opacity hidden md:block" />
                            <h1
  contentEditable
  suppressContentEditableWarning
  spellCheck={false}
  onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
  onBlur={(e) => setFormData({ ...formData, name: (e.currentTarget.textContent || '').trim() })}
  className="tickify-hero-title min-h-[1.1em] max-w-5xl cursor-text outline-none text-2xl md:text-3xl lg:text-4xl font-black leading-tight text-white !text-white transition-colors"
>
  {formData.name || 'Tên sự kiện'}
</h1> setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                        <div className="w-full relative group/artist mt-[-8px]">
                            <Mic2 size={16} className="absolute -left-7 top-3 text-white/50 opacity-0 group-hover/artist:opacity-100 transition-opacity hidden md:block" />
                            <div
  contentEditable
  suppressContentEditableWarning
  spellCheck={false}
  onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
  onBlur={(e) => setFormData({ ...formData, artists: (e.currentTarget.textContent || '').trim() })}
  className="tickify-hero-subtitle min-h-[1.75rem] max-w-4xl cursor-text outline-none text-base md:text-lg font-medium text-white/90 !text-white transition-colors"
>
  {formData.artists || 'Người biểu diễn/diễn giả (Optional)...'}
</div> setFormData({ ...formData, artists: e.target.value })}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="w-full max-w-6xl mx-auto px-6 lg:px-12 mt-10 grid grid-cols-1 xl:grid-cols-3 gap-8">
                <div className="xl:col-span-2 space-y-8">
                    <div className="bg-white dark:bg-slate-900/90 rounded-2xl p-6 sm:p-8 border border-gray-100 dark:border-white/10 relative group/desc">
                        <div className="absolute top-6 right-6 text-gray-300 opacity-0 group-hover/desc:opacity-100"><Edit3 size={18} /></div>
                        <h2 className="text-xl font-bold text-secondary mb-3">Giới thiệu sự kiện</h2>
                        <textarea
                            className="w-full bg-transparent outline-none border-2 border-transparent hover:border-gray-100 focus:border-primary/30 focus:bg-slate-950/70 rounded-xl p-3 -ml-3 text-gray-600 dark:text-slate-300 leading-relaxed text-base resize-none min-h-[150px] transition-all"
                            value={formData.description} placeholder="Viết vài lời giới thiệu hấp dẫn về sự kiện của bạn..."
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-secondary mb-3 flex items-center gap-2">
                            <Calendar className="text-primary" size={20} /> Thiết lập thời gian chung
                        </h2>
                        <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-white/10 rounded-2xl p-6 flex flex-col md:flex-row gap-6 items-center bg-gradient-to-r from-slate-50 to-white">
                            <div className="flex-1 w-full space-y-1.5">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide">Ngày khai mạc</label>
                                <input type="date" className="w-full bg-white dark:bg-slate-900/90 border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-primary/20 font-medium text-sm text-secondary" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} />
                            </div>
                            <div className="hidden md:block text-gray-300"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg></div>
                            <div className="flex-1 w-full space-y-1.5">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide">Ngày bế mạc</label>
                                <input type="date" className="w-full bg-white dark:bg-slate-900/90 border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-primary/20 font-medium text-sm text-secondary" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-white dark:bg-slate-900/90 rounded-2xl p-6 border border-gray-100 dark:border-white/10 flex flex-col h-full">
                        <h3 className="font-bold text-lg mb-1 text-secondary flex items-center gap-2">Ảnh Poster (Dọc)</h3>
                        <p className="text-xs text-gray-500 dark:text-slate-400 mb-4">Tỉ lệ chuẩn 3:4. Dùng để hiển thị ở trang danh sách sự kiện.</p>

                        <div className="w-full flex-1 min-h-[300px] bg-slate-50 dark:bg-slate-950/70 dark:bg-slate-900/80 rounded-xl overflow-hidden relative border-2 border-dashed border-slate-200 dark:border-white/10 transition-colors group">
                            {formData.poster_url ? (
                                <img src={formData.poster_url} className="w-full h-full object-cover" alt="Poster" />
                            ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                                    <ImageIcon size={40} className="mb-2 opacity-50" />
                                    <span className="text-sm font-medium">Chưa có Poster</span>
                                </div>
                            )}

                            <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                <span className="bg-white dark:bg-slate-900/90 text-secondary font-bold text-sm px-4 py-2 rounded-full flex items-center">
                                    <UploadCloud size={16} className="mr-2" /> Chọn Ảnh
                                </span>
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'poster')} />
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            <div className="fixed bottom-0 left-0 w-full bg-white dark:bg-slate-900/90 border-t border-slate-200 dark:border-white/10 z-50">
                <div className="max-w-6xl mx-auto px-6 lg:px-12 py-4 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Chế độ khởi tạo</p>
                        <p className="text-sm font-medium text-slate-400 mt-0.5">Sự kiện mới mặc định sẽ được lưu ở dạng Bản nháp.</p>
                    </div>

                    <div className="flex gap-3 w-full sm:w-auto justify-end">
                        <Button variant="outline" className="flex-1 sm:flex-none border-gray-300 px-6 rounded-full font-bold text-sm" onClick={() => navigate('/organizer/events')}>
                            <X size={16} className="mr-1.5" /> Hủy
                        </Button>
                        <Button onClick={handleSubmit} disabled={isPending} className="flex-1 sm:flex-none bg-primary hover:bg-primary/90 text-white px-8 rounded-full font-bold text-sm">
                            <Save size={16} className="mr-1.5" /> {isPending ? "Đang xử lý..." : "Lưu Sự kiện"}
                        </Button>
                    </div>
                </div>
            </div>

        </div>
    );
}