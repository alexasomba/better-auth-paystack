import { createFileRoute, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { auth } from '@/lib/auth'
import DashboardContent from '@/components/dashboard/DashboardContent'

const getSession = createServerFn({ method: 'GET' }).handler(async () => {
    const headers = getRequestHeaders()
    const session = await auth.api.getSession({ headers })
    return session
})

export const Route = createFileRoute('/dashboard')({
  component: DashboardPage,
  loader: async () => {
    const session = await getSession()
    
    if (!session) {
        throw redirect({ to: '/' })
    }

    return {
      session,
    }
  },
})

function DashboardPage() {
  const { session } = Route.useLoaderData()
  return <DashboardContent session={session as any} />
}
