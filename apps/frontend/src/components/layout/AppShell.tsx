'use client'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background px-3 py-3 sm:px-4 sm:py-4">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden pl-3 sm:pl-4">
        <TopBar />
        <main className="panel-surface mt-3 flex-1 overflow-y-auto rounded-[28px] p-5 sm:p-6">
          <div className="mx-auto w-full max-w-screen-xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
