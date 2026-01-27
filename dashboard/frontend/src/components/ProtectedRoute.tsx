import { Navigate, Outlet } from 'react-router-dom'
import { useDashboardStore } from '../store'

export function ProtectedRoute() {
    const isAuthenticated = useDashboardStore(state => state.isAuthenticated)

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />
    }

    return <Outlet />
}
