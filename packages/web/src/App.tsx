import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { TimelinePage } from './pages/TimelinePage';
import { SettingsPage } from './pages/SettingsPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { CalendarPage } from './pages/CalendarPage';
import { ReportsPage } from './pages/ReportsPage';

import { SocketProvider } from './context/SocketContext';

function App() {
  return (
    <BrowserRouter>
      <SocketProvider>
          <Layout>
            <Routes>
              <Route path="/" element={<TimelinePage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </Layout>
      </SocketProvider>
    </BrowserRouter>
  );
}

export default App;
