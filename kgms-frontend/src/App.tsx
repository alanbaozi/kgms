import { useState } from 'react'

import { AppShell, type AppPage } from './components/AppShell'
import { DocumentsPage } from './pages/DocumentsPage'
import { DomainConfigPage } from './pages/DomainConfigPage'
import { KnowledgeGraphPage } from './pages/KnowledgeGraphPage'
import { RetrievalPage } from './pages/RetrievalPage'
import { SystemConfigPage } from './pages/SystemConfigPage'

export default function App() {
  const [activePage, setActivePage] = useState<AppPage>('documents')

  return (
    <AppShell activePage={activePage} onNavigate={setActivePage}>
      {activePage === 'documents' ? <DocumentsPage /> : null}
      {activePage === 'retrieval' ? <RetrievalPage /> : null}
      {activePage === 'knowledgeGraph' ? <KnowledgeGraphPage /> : null}
      {activePage === 'system' ? <SystemConfigPage /> : null}
      {activePage === 'domain' ? <DomainConfigPage /> : null}
    </AppShell>
  )
}
