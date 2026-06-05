import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '@/lib/axiosClient';
import { LoadingOverlay } from '@/components/shared/LoadingOverlay';
import { useFeedbackStore } from '@/store/useFeedbackStore';
import { Eye, EyeOff, LockKeyhole } from 'lucide-react';

interface LayoutContextType {
    userData: any;
}

interface PasswordFormState {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
}

const initialPasswordForm: PasswordFormState = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
};

export default function ProfilePage() {
    const { userData } = useOutletContext<LayoutContextType>();
    const { showSuccess, showError } = useFeedbackStore();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPasswords, setShowPasswords] = useState(false);
    const [passwordForm, setPasswordForm] = useState<PasswordFormState>(initialPasswordForm);

    const fullName = [userData?.first_name, userData?.last_name].filter(Boolean).join(' ');
    const joinedDate = userData?.created_at
        ? new Date(userData.created_at).toLocaleDateString('vi-VN')
        : 'Chưa có dữ liệu';

    const handlePasswordChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = event.target;
        setPasswordForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmitPassword = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
            showError('Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới.');
            return;
        }

        if (passwordForm.newPassword.length < 6) {
            showError('Mật khẩu mới phải có ít nhất 6 ký tự.');
            return;
        }

        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            showError('Mật khẩu xác nhận không khớp.');
            return;
        }

        try {
            setIsSubmitting(true);
            const response = await api.patch('/user/profile/password', passwordForm);
            showSuccess(response.data?.message || 'Đổi mật khẩu thành công.');
            setPasswordForm(initialPasswordForm);
        } catch (error: any) {
            showError(error.response?.data?.message || error.response?.data?.error || 'Không thể đổi mật khẩu. Vui lòng thử lại.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="w-full max-w-4xl animate-in fade-in duration-300">
            <LoadingOverlay isVisible={isSubmitting} message="Đang cập nhật mật khẩu..." />

            <header className="mb-10">
                <h1 className="text-2xl font-bold text-neutral-dark mb-2">
                    Xin chào {fullName || 'bạn'},
                </h1>
                <p className="text-neutral-base/70 text-sm">
                    Tại đây bạn có thể xem thông tin tài khoản và cập nhật mật khẩu đăng nhập.
                </p>
            </header>

            <section className="mb-12">
                <h3 className="text-lg font-bold text-primary mb-6">Thông tin hồ sơ</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <ReadOnlyField label="Tên" value={userData?.first_name} />
                    <ReadOnlyField label="Họ" value={userData?.last_name} />
                    <ReadOnlyField label="Email" value={userData?.email} />
                    <ReadOnlyField label="Số điện thoại" value={userData?.phone} />
                    <ReadOnlyField label="Loại tài khoản" value="Attendee" />
                    <ReadOnlyField label="Ngày tạo tài khoản" value={joinedDate} />
                </div>
            </section>

            <section className="pt-8 border-t border-neutral-base/10">
                <div className="flex items-center justify-between gap-4 mb-6">
                    <div>
                        <h3 className="text-lg font-bold text-primary">Đổi mật khẩu</h3>
                        <p className="text-sm text-neutral-base/70 mt-1">
                            Nhập mật khẩu hiện tại, sau đó nhập mật khẩu mới 2 lần để xác nhận.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowPasswords((prev) => !prev)}
                        className="inline-flex items-center gap-2 rounded-full border border-neutral-base/15 px-4 py-2 text-sm font-semibold text-neutral-base hover:border-primary hover:text-primary"
                    >
                        {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
                        {showPasswords ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    </button>
                </div>

                <form onSubmit={handleSubmitPassword} className="space-y-5">
                    <PasswordField
                        label="Mật khẩu hiện tại"
                        name="currentPassword"
                        value={passwordForm.currentPassword}
                        visible={showPasswords}
                        onChange={handlePasswordChange}
                    />
                    <PasswordField
                        label="Mật khẩu mới"
                        name="newPassword"
                        value={passwordForm.newPassword}
                        visible={showPasswords}
                        onChange={handlePasswordChange}
                    />
                    <PasswordField
                        label="Nhập lại mật khẩu mới"
                        name="confirmPassword"
                        value={passwordForm.confirmPassword}
                        visible={showPasswords}
                        onChange={handlePasswordChange}
                    />

                    <div className="flex justify-end pt-2">
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-white px-8 py-3 rounded-full font-bold text-sm active:scale-95"
                        >
                            <LockKeyhole size={16} />
                            Đổi mật khẩu
                        </button>
                    </div>
                </form>
            </section>
        </div>
    );
}

function ReadOnlyField({ label, value }: { label: string; value?: string }) {
    return (
        <div className="flex flex-col">
            <label className="text-[11px] uppercase font-bold text-neutral-base/50 mb-1.5 ml-1 tracking-wide">
                {label}
            </label>
            <div className="border border-neutral-base/10 rounded-xl p-3.5 bg-neutral-base/[0.03] text-sm font-medium text-neutral-dark min-h-[48px]">
                {value || 'Chưa có dữ liệu'}
            </div>
        </div>
    );
}

function PasswordField({
    label,
    name,
    value,
    visible,
    onChange
}: {
    label: string;
    name: keyof PasswordFormState;
    value: string;
    visible: boolean;
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
    return (
        <div className="flex flex-col">
            <label className="text-[11px] uppercase font-bold text-neutral-base/50 mb-1.5 ml-1 tracking-wide">
                {label}
            </label>
            <input
                name={name}
                type={visible ? 'text' : 'password'}
                value={value}
                onChange={onChange}
                autoComplete="new-password"
                className="border border-neutral-base/10 rounded-xl p-3.5 bg-white dark:bg-slate-900/90 text-sm font-medium focus:outline-none focus:border-primary text-neutral-dark"
            />
        </div>
    );
}
