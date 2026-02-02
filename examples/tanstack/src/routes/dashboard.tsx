import { createFileRoute } from '@tanstack/react-router'
import { authMiddleware } from '@/middleware/auth'
import DashboardContent from '@/components/dashboard/DashboardContent'

export const Route = createFileRoute('/dashboard')({
  component: DashboardPage,
  server: {
    middleware: [authMiddleware],
  },
})

function DashboardPage() {
  const { session } = Route.useRouteContext()
  return <DashboardContent session={session as any} />
}
