import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ErrorBoundary } from './ErrorBoundary'
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
          <Route
            path="/builder/:templateId"
            element={
              <ErrorBoundary>
                <BuilderScreen />
              </ErrorBoundary>
            }
          />
          <Route
            path="/fill/:templateId/:instanceId"
            element={
              <ErrorBoundary>
                <FillScreen />
              </ErrorBoundary>
            }
          />
          <Route path="/templates/:templateId/instances" element={<InstancesListScreen />} />
          <Route path="*" element={<NotFoundScreen />} />
        </Routes>
      </BrowserRouter>
    </RepositoryProvider>
  )
}
