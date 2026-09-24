import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { Alerts } from './pages/Alerts';
import { Analytics } from './pages/Analytics';
import { GraphExplorer } from './pages/GraphExplorer';
import { HistoricalCases } from './pages/HistoricalCases';
import { InvestigationWorkspace } from './pages/InvestigationWorkspace';
import { Investigations } from './pages/Investigations';
import { LandingPage } from './pages/LandingPage';
import { Overview } from './pages/Overview';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route element={<MainLayout />}>
          <Route path="/overview" element={<Overview />} />
          <Route path="/investigations" element={<Investigations />} />
          <Route path="/workspace/:id" element={<InvestigationWorkspace />} />
          <Route path="/graph" element={<GraphExplorer />} />
          <Route path="/historical" element={<HistoricalCases />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/alerts" element={<Alerts />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
