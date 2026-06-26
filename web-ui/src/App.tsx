import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Dashboard from './routes/Dashboard';
import WorkoutDetail from './routes/WorkoutDetail';
import Calendar from './routes/Calendar';
import LibraryAdd from './routes/LibraryAdd';
import Activities from './routes/Activities';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/workout/:id" element={<WorkoutDetail />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/library" element={<LibraryAdd />} />
          <Route path="/activities" element={<Activities />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
