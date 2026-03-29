import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Login from '@/pages/Login'
import ProtectedLayout from '@/layouts/ProtectedLayout'
import Dashboard from '@/pages/Dashboard'
import Schedule from '@/pages/Schedule'
import Preferences from '@/pages/Preferences'
import Profile from '@/pages/Profile'
import Residents from '@/pages/Residents'
import Zones from '@/pages/Zones'
import Swaps from '@/pages/Swaps'
import Clinics from '@/pages/Clinics'
import JoinClinic from '@/pages/JoinClinic'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={null} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/preferences" element={<Preferences />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/residents" element={<Residents />} />
          <Route path="/zones" element={<Zones />} />
          <Route path="/swaps" element={<Swaps />} />
          <Route path="/clinics" element={<Clinics />} />
          <Route path="/join-clinic" element={<JoinClinic />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
