import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';

interface LayoutContextType {
    userData: any;
}

export default function ProfilePage() {
    const { userData } = useOutletContext<LayoutContextType>();
    const [showPassword, setShowPassword] = useState(false);

    return (
        <div className="w-full max-w-4xl animate-in fade-in duration-300">
            <header className="mb-10">
                <h1 className="text-2xl font-bold text-slate-800 mb-2">
                    Xin chào {userData ? `${userData.first_name} ${userData.last_name}` : 'bạn'},
                </h1>
                <p className="text-slate-500 text-sm">Tại đây bạn có thể quản lý và cập nhật toàn bộ thông tin tài khoản của mình.</p>
            </header>

            {/* PHẦN 1: CHỈNH SỬA THÔNG TIN CƠ BẢN */}
            <section className="mb-12">
                <h3 className="text-lg font-bold text-primary mb-6">Chỉnh sửa hồ sơ cá nhân</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <InputGroup label="Tên (First name)" defaultValue={userData?.first_name || ''} />
                    <InputGroup label="Họ (Last name)" defaultValue={userData?.last_name || ''} />
                    <InputGroup label="Địa chỉ Email" defaultValue={userData?.email || ''} type="email" readOnly />
                    <InputGroup label="Tên đường" defaultValue={userData?.street || ''} />
                    <InputGroup label="Số điện thoại" defaultValue={userData?.phone || ''} />
                    <InputGroup label="Ngày sinh" defaultValue={userData?.date_of_birth || ''} type="text" />
                </div>

                <div className="mt-8 flex justify-end">
                    <button className="bg-primary hover:bg-primary/90 text-white px-10 py-3 rounded-full font-bold text-sm transition-all active:scale-95 shadow-none">
                        Lưu thay đổi
                    </button>
                </div>
            </section>

            {/* PHẦN 2: TÀI KHOẢN & MẬT KHẨU */}
            <section className="pt-8 border-t border-slate-100">
                <h3 className="text-lg font-bold text-primary mb-6">Tài khoản và mật khẩu bảo mật</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <InputGroup label="Tên đăng nhập (Username)" defaultValue={userData?.username || ''} />

                    <div className="relative">
                        <InputGroup label="Mật khẩu" defaultValue={userData?.password || '••••••••'} type={showPassword ? "text" : "password"} />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 bottom-4 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                </div>
            </section>
        </div>
    );
}

function InputGroup({ label, defaultValue, type = "text", readOnly = false }: { label: string, defaultValue: string, type?: string, readOnly?: boolean }) {
    return (
        <div className="flex flex-col">
            <label className="text-[11px] uppercase font-bold text-slate-400 mb-1.5 ml-1 tracking-wide">
                {label}
            </label>
            <input
                type={type}
                defaultValue={defaultValue}
                readOnly={readOnly}
                className={`border border-slate-200 rounded-xl p-3.5 bg-slate-50 text-sm font-medium focus:outline-none ${readOnly ? 'cursor-not-allowed text-slate-400 bg-slate-100/60' : 'focus:border-primary focus:bg-white'} transition-all text-slate-700 shadow-none`}
            />
        </div>
    );
}