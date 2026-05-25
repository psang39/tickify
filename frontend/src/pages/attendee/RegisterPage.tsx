import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/axiosClient';
import { LoadingOverlay } from '@/components/shared/LoadingOverlay';
import { useFeedbackStore } from '@/store/useFeedbackStore';

const authBg = 'https://images.unsplash.com/photo-1508973379184-7517410fb0bc?auto=format&fit=crop&w=1200&q=80';

export default function RegisterPage() {
    const navigate = useNavigate();
    const { showSuccess, showError } = useFeedbackStore();
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        username: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: ''
    });
    const [customError, setCustomError] = useState('');

    const registerMutation = useMutation({
        mutationFn: async () => {
            const payload = {
                first_name: formData.first_name,
                last_name: formData.last_name,
                username: formData.username || formData.email.split('@')[0],
                email: formData.email,
                phone: formData.phone,
                password: formData.password,
                role: 'attendee'
            };
            const response = await api.post('/auth/register', payload);
            return response.data;
        },
        onSuccess: () => {
            showSuccess('Tạo tài khoản thành công. Bạn có thể đăng nhập ngay bây giờ!');
            navigate('/login');
        },
        onError: (err: any) => {
            const message = err.response?.data?.message || err.response?.data?.error || 'Đăng ký thất bại. Vui lòng thử lại.';
            setCustomError(message);
            showError(message);
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setCustomError('');

        if (formData.password !== formData.confirmPassword) {
            setCustomError('Mật khẩu nhập lại không khớp.');
            return;
        }

        registerMutation.mutate();
    };

    return (
        <div className="grid min-h-screen grid-cols-1 bg-white font-sans lg:grid-cols-2">
            <LoadingOverlay isVisible={registerMutation.isPending} message="Đang tạo tài khoản..." />
            <section className="relative hidden overflow-hidden bg-slate-950 lg:block">
                <img src={authBg} alt="Concert" className="h-full w-full object-cover opacity-55" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-black/80" />
                <div className="absolute left-20 top-24 max-w-xl text-white">
                    <Link to="/" className="text-3xl font-black tracking-wide text-[#FF0082]">Tickify</Link>
                    <h1 className="mt-16 text-4xl font-black leading-tight tracking-wide text-[#FF0082]">Tạo tài khoản<br />mới</h1>
                    <p className="mt-8 max-w-md text-base leading-7 text-white/90">
                        Lưu vé, theo dõi lịch diễn và nhận thông báo về những sự kiện âm nhạc phù hợp với bạn.
                    </p>
                    <div className="mt-8 h-1 w-44 rounded-full bg-[#FF0082]" />
                </div>
            </section>

            <section className="flex items-center justify-center px-6 py-12 lg:px-16">
                <div className="w-full max-w-md">
                    <Link to="/" className="mb-8 block text-2xl font-black tracking-wide text-[#FF0082] lg:hidden">Tickify</Link>
                    <h2 className="text-3xl font-black tracking-tight text-slate-800">Tạo tài khoản</h2>
                    <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <label className="mb-2 block text-sm font-semibold text-slate-700">Họ</label>
                                <input value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} required className="h-11 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-[#FF0082] focus:ring-4 focus:ring-pink-100" placeholder="Nguyễn" />
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-semibold text-slate-700">Tên</label>
                                <input value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} required className="h-11 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-[#FF0082] focus:ring-4 focus:ring-pink-100" placeholder="Sang" />
                            </div>
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-semibold text-slate-700">Email</label>
                            <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required className="h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-[#FF0082] focus:ring-4 focus:ring-pink-100" placeholder="Nhập email của bạn" />
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <label className="mb-2 block text-sm font-semibold text-slate-700">Tên hiển thị</label>
                                <input value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} className="h-11 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-[#FF0082] focus:ring-4 focus:ring-pink-100" placeholder="Có thể bỏ trống" />
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-semibold text-slate-700">Số điện thoại</label>
                                <input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} required className="h-11 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-[#FF0082] focus:ring-4 focus:ring-pink-100" placeholder="0900000000" />
                            </div>
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-semibold text-slate-700">Mật khẩu</label>
                            <input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required className="h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-[#FF0082] focus:ring-4 focus:ring-pink-100" placeholder="Tối thiểu 6 ký tự" />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-semibold text-slate-700">Nhập lại mật khẩu</label>
                            <input type="password" value={formData.confirmPassword} onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })} required className="h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-[#FF0082] focus:ring-4 focus:ring-pink-100" placeholder="Nhập lại mật khẩu" />
                        </div>

                        {customError && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-center text-sm font-semibold text-red-500">{customError}</div>}

                        <button type="submit" disabled={registerMutation.isPending} className="h-12 w-full rounded-xl bg-[#FF0082] text-sm font-bold text-white transition hover:bg-pink-700 disabled:bg-slate-200 disabled:text-slate-400">
                            {registerMutation.isPending ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'}
                        </button>
                    </form>

                    <p className="mt-6 text-center text-sm text-slate-400">
                        Đã có tài khoản? <Link to="/login" className="font-bold text-[#FF0082] hover:text-pink-700">Đăng nhập</Link>
                    </p>
                </div>
            </section>
        </div>
    );
}
