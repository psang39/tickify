import type { ReactNode } from 'react';
import { LogOut } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogMedia,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface LogoutConfirmDialogProps {
    children: ReactNode;
    className?: string;
    title?: string;
}

export const LogoutConfirmDialog = ({ children, className, title = 'Đăng xuất' }: LogoutConfirmDialogProps) => {
    const logout = useAuthStore((state) => state.logout);

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <button type="button" className={className} title={title}>
                    {children}
                </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="border border-slate-200 bg-white text-slate-900 shadow-xl dark:border-white/10 dark:bg-slate-900 dark:text-slate-50">
                <AlertDialogHeader>
                    <AlertDialogMedia className="bg-red-50 text-red-500 dark:bg-red-500/10">
                        <LogOut size={22} />
                    </AlertDialogMedia>
                    <AlertDialogTitle>Xác nhận đăng xuất?</AlertDialogTitle>
                    <AlertDialogDescription className="text-slate-500 dark:text-slate-400">
                        Bạn sẽ rời khỏi phiên làm việc hiện tại và cần đăng nhập lại để tiếp tục sử dụng hệ thống.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="border-slate-100 bg-slate-50 dark:border-white/10 dark:bg-slate-950/70">
                    <AlertDialogCancel>Ở lại</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={() => logout()}>
                        Đăng xuất
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};
