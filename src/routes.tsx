import { lazy } from 'react';
import { Activity, BarChart3, BookOpen, Gauge, GitMerge, LayoutDashboard, ListChecks, PlayCircle, ScrollText, Settings as SettingsIcon, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';

export const Overview = lazy(() => import('./pages/Overview'));
export const Console = lazy(() => import('./pages/Console'));
export const Incidents = lazy(() => import('./pages/Incidents'));
export const Trust = lazy(() => import('./pages/Trust'));
export const Tuner = lazy(() => import('./pages/Tuner'));
export const Writeback = lazy(() => import('./pages/Writeback'));
export const Benchmarks = lazy(() => import('./pages/Benchmarks'));
export const Demo = lazy(() => import('./pages/Demo'));
export const HowItWorks = lazy(() => import('./pages/HowItWorks'));
export const Settings = lazy(() => import('./pages/Settings'));
export const NotFound = lazy(() => import('./pages/NotFound'));

export interface NavItem {
  path: string;
  title: string;
  icon: ReactNode;
  group: string;
}
export const NAV: NavItem[] = [
  { path: '/', title: 'Overview', icon: <LayoutDashboard size={18} />, group: 'Operate' },
  { path: '/console', title: 'Live Console', icon: <Activity size={18} />, group: 'Operate' },
  { path: '/incidents', title: 'Incidents', icon: <GitMerge size={18} />, group: 'Operate' },
  { path: '/trust', title: 'Trust Center', icon: <ShieldCheck size={18} />, group: 'Operate' },
  { path: '/tuner', title: 'Alarm Tuner', icon: <SlidersHorizontal size={18} />, group: 'Optimise' },
  { path: '/writeback', title: 'Write-back & Audit', icon: <ScrollText size={18} />, group: 'Optimise' },
  { path: '/benchmarks', title: 'Benchmarks', icon: <BarChart3 size={18} />, group: 'Prove' },
  { path: '/demo', title: 'Guided Demo', icon: <PlayCircle size={18} />, group: 'Prove' },
  { path: '/how-it-works', title: 'How It Works', icon: <BookOpen size={18} />, group: 'Learn' },
  { path: '/settings', title: 'Settings', icon: <SettingsIcon size={18} />, group: 'Learn' },
];
export { Gauge, ListChecks };
