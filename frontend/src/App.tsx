import { Routes, Route, Navigate } from 'react-router-dom'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<div>Login (Keycloak redirect)</div>} />
      <Route path="/student/*" element={<div>Student UI</div>} />
      <Route path="/methodist/*" element={<div>Methodist UI</div>} />
      <Route path="/instructor/*" element={<div>Instructor UI</div>} />
      <Route path="/admin/*" element={<div>Admin UI</div>} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
