import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/axiosClient';
import { useAuthStore } from '@/store/useAuthStore';
import { LoadingOverlay } from '@/components/shared/LoadingOverlay';
import { useFeedbackStore } from '@/store/useFeedbackStore';

const authBg = 'https://images.unsplash.com/photo-1508973379184-7517410fb0bc?auto=format&fit=crop&w=1200&q=80';

export default function LoginPage() {
    const navigate = useNavigate();
    const { login } = useAuthStore();
    const { showSuccess, showError } = useFeedbackStore();
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [customError, setCustomError] = useState('');

    const loginMutation = useMutation({
        mutationFn: async (loginData: typeof formData) => {
            const response = await api.post('/auth/login', loginData);
            return response.data;
        },
        onSuccess: (data) => {
            const userData = data.user;
            login(userData);
            showSuccess('Đăng nhập thành công!');

            if (userData.role === 'organizer' || userData.role === 'Organizer') {
                navigate('/organizer/dashboard');
            } else if (userData.role === 'admin' || userData.role === 'Admin') {
                navigate('/admin');
            } else {
                navigate('/');
            }
        },
        onError: (err: any) => {
            const message = err.response?.data?.message || err.response?.data?.error || 'Đăng nhập thất bại. Vui lòng thử lại.';
            setCustomError(message);
            showError(message);
        }
    });

    const isDisabled = loginMutation.isPending || !formData.email || !formData.password;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setCustomError('');
        loginMutation.mutate(formData);
    };

    return (
        <div className="grid min-h-screen grid-cols-1 bg-white dark:bg-slate-900/90 font-sans lg:grid-cols-2">
            <LoadingOverlay isVisible={loginMutation.isPending} message="Đang xác thực đăng nhập..." />
            <section className="relative hidden overflow-hidden bg-slate-950 lg:block">
                <img src={authBg} alt="Concert" className="h-full w-full object-cover opacity-55" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-black/80" />
                <div className="absolute left-20 top-24 max-w-xl text-white">
                    <Link to="/" className="text-3xl font-black tracking-wide text-[#FF0082]">Tickify</Link>
                    <h1 className="mt-16 text-4xl font-black leading-tight tracking-wide text-[#FF0082]">Chào mừng<br />trở lại</h1>
                    <p className="mt-8 max-w-md text-base leading-7 text-white/90">
                        Khám phá hàng triệu concert, nhận thông báo từ nghệ sĩ yêu thích và đặt vé an toàn, nhanh chóng.
                    </p>
                    <div className="mt-8 h-1 w-44 rounded-full bg-[#FF0082]" />
                </div>
            </section>

            <section className="flex items-center justify-center px-6 py-12 lg:px-16">
                <div className="w-full max-w-lg">
                    <Link to="/" className="mb-8 block text-2xl font-black tracking-wide text-[#FF0082] lg:hidden">Tickify</Link>
                    <h2 className="text-3xl font-black tracking-tight text-slate-800 dark:text-slate-100">Đăng nhập</h2>
                    <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
                        <div>
                            <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Email</label>
                            <input
                                type="email"
                                required
                                disabled={loginMutation.isPending}
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="h-12 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-800 dark:text-slate-100 outline-none transition focus:border-[#FF0082] focus:ring-4 focus:ring-pink-100 disabled:opacity-60"
                                placeholder="Nhập email của bạn"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Mật khẩu</label>
                            <input
                                type="password"
                                required
                                disabled={loginMutation.isPending}
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                className="h-12 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-800 dark:text-slate-100 outline-none transition focus:border-[#FF0082] focus:ring-4 focus:ring-pink-100 disabled:opacity-60"
                                placeholder="Nhập mật khẩu"
                            />
                            <button type="button" className="mt-3 text-sm font-medium text-slate-400 hover:text-[#FF0082]">Quên mật khẩu?</button>
                        </div>

                        {customError && (
                            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-center text-sm font-semibold text-red-500">
                                {customError}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isDisabled}
                            className="h-12 w-full rounded-xl bg-[#FF0082] text-sm font-bold text-white transition hover:bg-pink-700 disabled:bg-slate-200 disabled:text-slate-400"
                        >
                            {loginMutation.isPending ? 'Đang đăng nhập...' : 'Đăng nhập'}
                        </button>
                    </form>

                    <p className="mt-6 text-center text-sm text-slate-400">
                        Chưa có tài khoản? <Link to="/register" className="font-bold text-[#FF0082] hover:text-pink-700">Tạo tài khoản</Link>
                    </p>
                </div>
            </section>
        </div>
    );
}
