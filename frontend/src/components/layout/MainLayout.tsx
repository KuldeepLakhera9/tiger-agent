import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function MainLayout() { return <div className="flex h-screen overflow-hidden bg-brand-dark"><Sidebar /><div className="flex min-w-0 flex-1 flex-col"><Topbar /><main className="min-h-0 flex-1 overflow-y-auto"><Outlet /></main></div></div>; }