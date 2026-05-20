import { useState, useEffect } from 'react'
// import reactLogo from './assets/react.svg'
// import viteLogo from './assets/vite.svg'
// import heroImg from './assets/hero.png'
import MainLayout from "@/components/layout/MainLayout";
import { BrowserRouter, Routes, Route } from 'react-router-dom'
// import Home from './Home'
import TicketBookingPage from './pages/TicketBookingPage'
import CreateEvent from './pages/CreateEvent'
import EventDetail from './pages/EventDetail'
import OrganizerDashboard from './pages/OrganizerDashboard'
import EventManagement from './pages/EventManagement'
import { useAuthStore } from "@/store/useAuthStore";
import LoginPage from "@/pages/LoginPage";
import MockGatewayPage from './pages/MockGatewayPage';
import TicketDetailPage from './pages/TicketDetailPage';
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { WaitingRoomPage } from './pages/WaitingRoomPage';
import OrganizerLayout from './components/layout/OrganizerLayout';
import ShowDetail from './pages/ShowDetail';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './App.css'
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Tùy chọn: Không tự động gọi lại API khi user chuyển tab trình duyệt
      retry: 1, // Tùy chọn: Nếu API lỗi, thử gọi lại 1 lần trước khi báo lỗi đỏ
    },
  },
});

function App() {
  const { checkAuth } = useAuthStore();
  const [count, setCount] = useState(0)
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {/* Các thành phần nằm ngoài Routes sẽ luôn hiện diện trên mọi trang (VD: Header, Navigation Bar) */}

        <Routes>
          {/* Đường dẫn mặc định (Trang chủ) */}
          {/* <Route path="/" element={<Home />} /> */}

          {/* Đường dẫn tới trang đặt vé */}
          <Route element={<MainLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<OrganizerLayout />}>
              <Route
                element={<ProtectedRoute allowedRoles={['Organizer', 'Admin', 'organizer', 'admin']} />}
              >
                <Route path="/shows/:showId/booking" element={<TicketBookingPage />} />
                <Route path="/organizer/dashboard" element={<OrganizerDashboard />} />
                <Route path="/organizer/events" element={<EventManagement />} />
                <Route path="/organizer/events/create" element={<CreateEvent />} />

                <Route path="/organizer/events/:eventId" element={<EventDetail />} /> {/* Nơi chứa nút tạo Show */}
                <Route path="/organizer/events/:eventId/shows/:showId" element={<ShowDetail />} />
              </Route>
            </Route>
          </Route>
          <Route path="/tickets/:ticketId" element={<TicketDetailPage />} />
          <Route path="/queue/:showId" element={<WaitingRoomPage />} />
          <Route path="/mock-gateway" element={<MockGatewayPage />} />
          {/* Đường dẫn 404 nếu nhập sai URL */}
          <Route path="*" element={<div className="p-10 text-center">404 - Không tìm thấy trang</div>} />
        </Routes>

      </BrowserRouter >
    </QueryClientProvider>
  )
}

export default App
