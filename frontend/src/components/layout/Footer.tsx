import { Apple, Play } from 'lucide-react';

export default function Footer() {
    return (
        <footer className="w-full bg-zinc-900 px-5 py-10 font-sans text-white md:px-8">
            <div className="mx-auto max-w-7xl">
                <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-5">
                    <div className="space-y-4 lg:col-span-2">
                        <div>
                            <h3 className="mb-2 text-xl font-bold">Luôn kết nối với Tickify</h3>
                            <p className="max-w-md text-sm leading-relaxed text-zinc-400">
                                Nhận thông tin sự kiện mới, ưu đãi vé và các cập nhật dành cho người tham dự.
                            </p>
                        </div>

                        <div className="relative max-w-md">
                            <input
                                type="email"
                                placeholder="Nhập email của bạn"
                                className="w-full rounded-full px-5 py-3 pr-32 text-sm text-zinc-900 dark:text-slate-50 outline-none"
                            />
                            <button className="absolute bottom-1 right-1 top-1 rounded-full bg-primary px-5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary/90">
                                Đăng ký
                            </button>
                        </div>

                        <p className="text-xs text-zinc-500">
                            Khi đăng ký, bạn đồng ý nhận thông tin từ Tickify theo chính sách bảo mật của hệ thống.
                        </p>

                        <div className="flex flex-wrap gap-3 pt-1">
                            <button className="flex items-center gap-2 rounded-full bg-white dark:bg-slate-900/90 px-4 py-2 text-black transition-colors hover:bg-zinc-100">
                                <Play size={18} className="text-primary" />
                                <div className="flex flex-col text-left">
                                    <span className="text-[10px] leading-none text-zinc-600">Tải trên</span>
                                    <span className="text-xs font-bold leading-tight">Google Play</span>
                                </div>
                            </button>
                            <button className="flex items-center gap-2 rounded-full bg-white dark:bg-slate-900/90 px-4 py-2 text-black transition-colors hover:bg-zinc-100">
                                <Apple size={18} className="text-primary" />
                                <div className="flex flex-col text-left">
                                    <span className="text-[10px] leading-none text-zinc-600">Tải trên</span>
                                    <span className="text-xs font-bold leading-tight">App Store</span>
                                </div>
                            </button>
                        </div>
                    </div>

                    <FooterColumn
                        title="Về Tickify"
                        items={['Giới thiệu', 'Dành cho nhà tổ chức', 'Tin tức', 'Chính sách bảo mật']}
                    />
                    <FooterColumn
                        title="Hỗ trợ"
                        items={['Câu hỏi thường gặp', 'Trung tâm trợ giúp', 'Liên hệ', 'Điều khoản sử dụng']}
                    />
                    <FooterColumn
                        title="Sự kiện"
                        items={['Sự kiện nổi bật', 'Sự kiện đã hủy', 'Sự kiện đổi lịch', 'Hướng dẫn mua vé']}
                    />
                </div>

                <div className="mt-8 flex flex-col items-center justify-center gap-2 border-t border-zinc-700/60 pt-6 text-sm text-zinc-400 md:flex-row">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full border border-zinc-500 text-[10px]">C</span>
                    <span>Tickify. Đã đăng ký mọi quyền.</span>
                </div>
            </div>
        </footer>
    );
}

function FooterColumn({ title, items }: { title: string; items: string[] }) {
    return (
        <div>
            <h4 className="mb-4 text-base font-semibold text-zinc-100">{title}</h4>
            <ul className="space-y-3 text-sm text-zinc-400">
                {items.map((item) => (
                    <li key={item}>
                        <a href="#" className="transition-colors hover:text-white">
                            {item}
                        </a>
                    </li>
                ))}
            </ul>
        </div>
    );
}
