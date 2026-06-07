import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const ScrollToTop = () => {
    const { pathname, search } = useLocation();

    useEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });

        // Một số layout có <main> riêng hoặc scroll container nội bộ.
        // Reset thêm các vùng này để tránh chuyển route nhưng vẫn nằm ở cuối trang.
        document.querySelectorAll('main').forEach((element) => {
            element.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        });
    }, [pathname, search]);

    return null;
};
