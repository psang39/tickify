import { useState, useEffect } from 'react'
// import reactLogo from './assets/react.svg'
// import viteLogo from './assets/vite.svg'
// import heroImg from './assets/hero.png'
import MainLayout from "@/components/layout/MainLayout";
import { BrowserRouter, Routes, Route } from 'react-router-dom'
// import Home from './Home'
import TicketBookingPage from './pages/attendee/TicketBookingPage'
import CreateEvent from './pages/organizer/CreateEvent'
import EventDetail from './pages/organizer/EventDetail'
import OrganizerDashboard from './pages/organizer/OrganizerDashboard'
import EventManagement from './pages/organizer/EventManagement'
import { useAuthStore } from "@/store/useAuthStore";
import LoginPage from "@/pages/attendee/LoginPage";
import MockGatewayPage from './pages/attendee/MockGatewayPage';
import TicketDetailPage from './pages/attendee/TicketDetailPage';
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { WaitingRoomPage } from './pages/attendee/WaitingRoomPage';
import OrganizerLayout from './components/layout/OrganizerLayout';
import ShowDetail from './pages/organizer/ShowDetail';
import ProfilePage from './pages/attendee/ProfilePage';
import OrderHistory from './pages/attendee/OrderHistory';
import OrderDetailPage from './pages/attendee/OrderDetailPage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminLayout from './components/layout/AdminLayout';
import ManageUsersPage from './pages/admin/ManageUsersPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import './App.css'
import { PublicRoute } from './components/auth/PublicRoute';
import AttendeeLayout from './components/layout/AttendeeLayout';
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
            <Route element={<ProtectedRoute allowedRoles={['admin', 'Admin']} />}>
              <Route element={<AdminLayout />}>
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/users" element={<ManageUsersPage />} />
              </Route>
            </Route>
            <Route element={<ProtectedRoute allowedRoles={['attendee', 'organizer', 'admin', 'Attendee', 'Organizer', 'Admin']} />}>
              <Route element={<AttendeeLayout />}>
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/orders" element={<OrderHistory />} />
                <Route path="/orders/detail" element={<OrderDetailPage />} />
                <Route path="/tickets/:ticketId" element={<TicketDetailPage />} />

              </Route>
            </Route>

            <Route
              element={<ProtectedRoute allowedRoles={['Organizer', 'Admin', 'organizer', 'admin']} />}
            >
              <Route element={<OrganizerLayout />}>

                <Route path="/organizer/dashboard" element={<OrganizerDashboard />} />
                <Route path="/organizer/events" element={<EventManagement />} />
                <Route path="/organizer/events/create" element={<CreateEvent />} />

                <Route path="/organizer/events/:eventId" element={<EventDetail />} /> {/* Nơi chứa nút tạo Show */}
                <Route path="/organizer/events/:eventId/shows/:showId" element={<ShowDetail />} />
              </Route>
            </Route>
          </Route>
          <Route element={<ProtectedRoute allowedRoles={['attendee', 'organizer', 'admin', 'Attendee', 'Organizer', 'Admin']} />} />
          <Route path="/queue/:showId" element={<WaitingRoomPage />} />
          <Route path="/shows/:showId/booking" element={<TicketBookingPage />} />
          <Route path="/mock-gateway" element={<MockGatewayPage />} />
          {/* Đường dẫn 404 nếu nhập sai URL */}
          <Route path="*" element={<div className="p-10 text-center">404 - Không tìm thấy trang</div>} />
        </Routes>

      </BrowserRouter >
    </QueryClientProvider>
  )
}

export default App
