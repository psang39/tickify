// tailwind.config.js
import { COLORS } from './src/constants/colors.ts';

/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: [
        './pages/**/*.{ts,tsx}',
        './components/**/*.{ts,tsx}',
        './app/**/*.{ts,tsx}',
        './src/**/*.{ts,tsx}',
    ],
    prefix: "",
    theme: {
        extend: {
            // Đưa toàn bộ hệ màu của Figma vào Tailwind
            colors: {
                primary: COLORS.primary,
                secondary: COLORS.secondary,
                info: COLORS.info,
                success: COLORS.success,
                warning: COLORS.warning,
                error: COLORS.error,
                white: COLORS.white,
                neutral: {
                    dark: COLORS.neutral.dark,
                    base: COLORS.neutral.base,
                }
            },
            // Bạn có thể setup thêm Font chữ ở đây nếu Figma có dùng font riêng
            fontFamily: {
                sans: ['Inter', 'sans-serif'], // Thay 'Inter' bằng font từ thiết kế
            }
        },
    },
    plugins: [],
}