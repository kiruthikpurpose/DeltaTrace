import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/shell/AppShell';
import { Benchmarks, Console, Demo, HowItWorks, Incidents, NotFound, Overview, Settings, Trust, Tuner, Writeback } from './routes';

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Overview />} />
        <Route path="console" element={<Console />} />
        <Route path="incidents" element={<Incidents />} />
        <Route path="trust" element={<Trust />} />
        <Route path="tuner" element={<Tuner />} />
        <Route path="writeback" element={<Writeback />} />
        <Route path="benchmarks" element={<Benchmarks />} />
        <Route path="demo" element={<Demo />} />
        <Route path="how-it-works" element={<HowItWorks />} />
        <Route path="settings" element={<Settings />} />
        <Route path="home" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
