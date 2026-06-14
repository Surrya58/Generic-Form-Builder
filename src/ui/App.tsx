import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { RepositoryProvider } from './persistence'
import {
  BuilderScreen,
  FillScreen,
  InstancesListScreen,
  NotFoundScreen,
  TemplatesListScreen,
} from './screens'

export function App() {
  return (
    <RepositoryProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<TemplatesListScreen />} />
          <Route path="/builder/:templateId" element={<BuilderScreen />} />
          <Route path="/fill/:templateId/:instanceId" element={<FillScreen />} />
          <Route path="/templates/:templateId/instances" element={<InstancesListScreen />} />
          <Route path="*" element={<NotFoundScreen />} />
        </Routes>
      </BrowserRouter>
    </RepositoryProvider>
  )
}
