import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './AppShell'
import { GatesPage } from './GatesPage'
import { InboxPage } from './InboxPage'
import { TodayPage } from './TodayPage'
import { PagePlaceholder } from './PagePlaceholder'
import { NAV_ITEMS } from './nav'

const BUILT: Record<string, () => React.ReactElement> = {
  today: () => <TodayPage />,
  inbox: () => <InboxPage />,
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/today" replace />} />
        {NAV_ITEMS.map((item) => (
          <Route
            key={item.id}
            path={item.id}
            element={BUILT[item.id] ? BUILT[item.id]() : <PagePlaceholder item={item} />}
          />
        ))}
        {/* dev preview until the Today approval queue lands (step 1.6) */}
        <Route path="gates" element={<GatesPage />} />
        <Route path="*" element={<Navigate to="/today" replace />} />
      </Route>
    </Routes>
  )
}
