import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './AppShell'
import { PagePlaceholder } from './PagePlaceholder'
import { NAV_ITEMS } from './nav'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/today" replace />} />
        {NAV_ITEMS.map((item) => (
          <Route key={item.id} path={item.id} element={<PagePlaceholder item={item} />} />
        ))}
        <Route path="*" element={<Navigate to="/today" replace />} />
      </Route>
    </Routes>
  )
}
