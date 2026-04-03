import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { Sidebar } from "@/components/sidebar"

async function AuthGate({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/sign-in")
  return <>{children}</>
}

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Loading...</div>}>
      <AuthGate>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </AuthGate>
    </Suspense>
  )
}
