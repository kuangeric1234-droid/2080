import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './AppShell'
import { GatesPage } from './GatesPage'
import { AuditPage } from './AuditPage'
import { InboxPage } from './InboxPage'
import { TodayPage } from './TodayPage'
import { NotificationsPage } from './NotificationsPage'
import { ReviewPage } from './ReviewPage'
import { ReviewDetailPage } from './ReviewDetailPage'
import { SeoPage } from './SeoPage'
import { SiteHealthPage } from './SiteHealthPage'
import { ClientsPage } from './ClientsPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/review" replace />} />

        {/* the rail */}
        <Route path="review" element={<ReviewPage />} />
        <Route path="review/:id" element={<ReviewDetailPage />} />

        {/* built but off-rail — parked in backlog/PARKED-MODULES.md, still reachable
            by URL so the work and its tests stay live */}
        <Route path="today" element={<TodayPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="inbox" element={<InboxPage />} />
        <Route path="audit" element={<AuditPage />} />
        <Route path="seo" element={<SeoPage />} />
        <Route path="sitehealth" element={<SiteHealthPage />} />

        {/* reached via the topbar bell */}
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="gates" element={<GatesPage />} />

        <Route path="*" element={<Navigate to="/review" replace />} />
      </Route>
    </Routes>
  )
}
