import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/axiosClient';
import { LoadingOverlay } from '@/components/shared/LoadingOverlay';
import { useFeedbackStore } from '@/store/useFeedbackStore';

const authBg = 'https://images.unsplash.com/photo-1508973379184-7517410fb0bc?auto=format&fit=crop&w=1200&q=80';

type RegisterRole = 'attendee' | 'organizer';

export default function RegisterPage() {
    const navigate = useNavigate();
    const { showSuccess, showError } = useFeedbackStore();

    const [registerRole, setRegisterRole] = useState<RegisterRole>('attendee');
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        username: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: '',
        company_name: '',
        tax_id: ''
    });
    const [customError, setCustomError] = useState('');

    const registerMutation = useMutation({
        mutationFn: async () => {
            const basePayload = {
                first_name: formData.first_name.trim(),
                last_name: formData.last_name.trim(),
                username: formData.username.trim() || formData.email.split('@')[0],
                email: formData.email.trim(),
                phone: formData.phone.trim(),
                password: formData.password,
                role: registerRole
            };

            const payload =
                registerRole === 'organizer'
                    ? {
                        ...basePayload,
                        company_name: formData.company_name.trim(),
                        tax_id: formData.tax_id.trim(),
                        is_verified: false
                    }
                    : basePayload;

            const response = await api.post('/auth/register', payload);
            return response.data;
        },
        onSuccess: () => {
            const message =
                registerRole === 'organizer'
                    ? 'Đăng ký organizer thành công. Tài khoản của bạn sẽ cần được xác minh trước khi sử dụng đầy đủ chức năng.'
                    : 'Tạo tài khoản thành công. Bạn có thể đăng nhập ngay bây giờ!';

            showSuccess(message);
            navigate('/login');
        },
        onError: (err: any) => {
            const message = err.response?.data?.message || err.response?.data?.error || 'Đăng ký thất bại. Vui lòng thử lại.';
            setCustomError(message);
            showError(message);
        }
    });

    const handleRoleChange = (role: RegisterRole) => {
        setRegisterRole(role);
        setCustomError('');
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setCustomError('');

        if (formData.password !== formData.confirmPassword) {
            setCustomError('Mật khẩu nhập lại không khớp.');
            return;
        }

        if (registerRole === 'organizer') {
            if (!formData.company_name.trim()) {
                setCustomError('Vui lòng nhập tên công ty hoặc đơn vị tổ chức.');
                return;
            }

            if (!formData.tax_id.trim()) {
                setCustomError('Vui lòng nhập mã số thuế.');
                return;
            }
        }

        registerMutation.mutate();
    };

    return (
        <div className="grid min-h-screen grid-cols-1 bg-white dark:bg-slate-900/90 font-sans lg:grid-cols-2">
            <LoadingOverlay isVisible={registerMutation.isPending} message="Đang tạo tài khoản..." />

            <section className="relative hidden overflow-hidden bg-slate-950 lg:block">
                <img src={authBg} alt="Concert" className="h-full w-full object-cover opacity-55" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-black/80" />
                <div className="absolute left-20 top-24 max-w-xl text-white">
                    <Link to="/" className="text-3xl font-black tracking-wide text-[#FF0082]">Tickify</Link>
                    <h1 className="mt-16 text-4xl font-black leading-tight tracking-wide text-[#FF0082]">
                        Tạo tài khoản<br />mới
                    </h1>
                    <p className="mt-8 max-w-md text-base leading-7 text-white/90">
                        Lưu vé, theo dõi lịch diễn hoặc đăng ký tài khoản organizer để quản lý sự kiện trên Tickify.
                    </p>
                    <div className="mt-8 h-1 w-44 rounded-full bg-[#FF0082]" />
                </div>
            </section>

            <section className="flex items-center justify-center px-6 py-12 lg:px-16">
                <div className="w-full max-w-md">
                    <Link to="/" className="mb-8 block text-2xl font-black tracking-wide text-[#FF0082] lg:hidden">Tickify</Link>

                    <h2 className="text-3xl font-black tracking-tight text-slate-800 dark:text-slate-100">Tạo tài khoản</h2>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                        Chọn loại tài khoản phù hợp với nhu cầu sử dụng của bạn.
                    </p>

                    <div className="mt-6 grid grid-cols-2 rounded-2xl bg-slate-100 dark:bg-slate-800/80 p-1">
                        <button
                            type="button"
                            onClick={() => handleRoleChange('attendee')}
                            className={`h-11 rounded-xl text-sm font-bold transition ${
                                registerRole === 'attendee'
                                    ? 'bg-white text-[#FF0082] shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            Người tham dự
                        </button>
                        <button
                            type="button"
                            onClick={() => handleRoleChange('organizer')}
                            className={`h-11 rounded-xl text-sm font-bold transition ${
                                registerRole === 'organizer'
                                    ? 'bg-white text-[#FF0082] shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            Organizer
                        </button>
                    </div>

                    {registerRole === 'organizer' && (
                        <div className="mt-4 rounded-2xl border border-pink-100 bg-pink-50 px-4 py-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                            Tài khoản organizer sẽ được tạo với trạng thái <span className="font-bold text-slate-800 dark:text-slate-100">chưa xác minh</span>. Admin có thể duyệt sau trong hệ thống.
                        </div>
                    )}

                    <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Họ</label>
                                <input
                                    value={formData.last_name}
                                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                                    required
                                    className="h-11 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-[#FF0082] focus:ring-4 focus:ring-pink-100"
                                    placeholder="Nguyễn"
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Tên</label>
                                <input
                                    value={formData.first_name}
                                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                                    required
                                    className="h-11 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-[#FF0082] focus:ring-4 focus:ring-pink-100"
                                    placeholder="Sang"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Email</label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                required
                                className="h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-[#FF0082] focus:ring-4 focus:ring-pink-100"
                                placeholder="Nhập email của bạn"
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Tên hiển thị</label>
                                <input
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    className="h-11 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-[#FF0082] focus:ring-4 focus:ring-pink-100"
                                    placeholder="Có thể bỏ trống"
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Số điện thoại</label>
                                <input
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    required
                                    className="h-11 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-[#FF0082] focus:ring-4 focus:ring-pink-100"
                                    placeholder="0900000000"
                                />
                            </div>
                        </div>

                        {registerRole === 'organizer' && (
                            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/80 p-4">
                                <h3 className="mb-4 text-sm font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">Thông tin organizer</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Tên công ty / đơn vị tổ chức</label>
                                        <input
                                            value={formData.company_name}
                                            onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                                            required={registerRole === 'organizer'}
                                            className="h-11 w-full rounded-xl border border-slate-300 bg-white dark:bg-slate-900/90 px-4 text-sm outline-none focus:border-[#FF0082] focus:ring-4 focus:ring-pink-100"
                                            placeholder="Tickify Entertainment"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Mã số thuế</label>
                                        <input
                                            value={formData.tax_id}
                                            onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                                            required={registerRole === 'organizer'}
                                            className="h-11 w-full rounded-xl border border-slate-300 bg-white dark:bg-slate-900/90 px-4 text-sm outline-none focus:border-[#FF0082] focus:ring-4 focus:ring-pink-100"
                                            placeholder="0312345678"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Mật khẩu</label>
                            <input
                                type="password"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                required
                                className="h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-[#FF0082] focus:ring-4 focus:ring-pink-100"
                                placeholder="Tối thiểu 6 ký tự"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Nhập lại mật khẩu</label>
                            <input
                                type="password"
                                value={formData.confirmPassword}
                                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                required
                                className="h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-[#FF0082] focus:ring-4 focus:ring-pink-100"
                                placeholder="Nhập lại mật khẩu"
                            />
                        </div>

                        {customError && (
                            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-center text-sm font-semibold text-red-500">
                                {customError}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={registerMutation.isPending}
                            className="h-12 w-full rounded-xl bg-[#FF0082] text-sm font-bold text-white transition hover:bg-pink-700 disabled:bg-slate-200 disabled:text-slate-400"
                        >
                            {registerMutation.isPending
                                ? 'Đang tạo tài khoản...'
                                : registerRole === 'organizer'
                                    ? 'Đăng ký organizer'
                                    : 'Tạo tài khoản'}
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
