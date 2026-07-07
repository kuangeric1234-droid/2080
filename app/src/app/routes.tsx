import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './AppShell'
import { GatesPage } from './GatesPage'
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
        {/* dev preview until the Today approval queue lands (step 1.6) */}
        <Route path="gates" element={<GatesPage />} />
        <Route path="*" element={<Navigate to="/today" replace />} />
      </Route>
    </Routes>
  )
}
