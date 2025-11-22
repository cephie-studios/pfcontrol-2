import { Star, Shield, Wrench, Award, Crown, Trophy, Zap, Target, Heart, Sparkles, Flame, TrendingUp, FlaskConical, TowerControl } from 'lucide-react';

export const AVAILABLE_PERMISSIONS = [
    {
        key: 'admin',
        label: 'Admin Dashboard',
        description: 'Access to admin overview',
    },
    {
        key: 'users',
        label: 'User Management',
        description: 'View and manage users',
    },
    {
        key: 'sessions',
        label: 'Session Management',
        description: 'View and manage sessions',
    },
    {
        key: 'audit',
        label: 'Audit Logs / API Logs',
        description: 'View audit & API logs and security events',
    },
    {
        key: 'bans',
        label: 'Ban Management',
        description: 'Ban and unban users',
    },
    {
        key: 'testers',
        label: 'Tester Management',
        description: 'Manage beta testers',
    },
    {
        key: 'notifications',
        label: 'Notifications',
        description: 'Manage system notifications',
    },
    {
        key: 'roles',
        label: 'Role Management',
        description: 'Create and manage roles (admin only)',
    },
    {
        key: 'chat_reports',
        label: 'Chat Reports',
        description: 'View and manage chat reports',
    },
    {
        key: 'feedback',
        label: 'Feedback',
        description: 'View and manage user feedback',
    },
    {
        key: 'api_logs',
        label: 'API Logs',
        description: 'View recent API requests and metrics (alias - audit entitlements)',
    },
    {
        key: 'flight_logs',
        label: 'Flight Archive',
        description: 'View archived flight logs',
    },
    {
        key: 'update_modals',
        label: 'Update Modals',
        description: 'Manage update modals and announcements',
    },
    {
        key: 'event_controller',
        label: 'Event Controller',
        description: 'Edit flights across all PFATC sessions during events',
    }
];

export const AVAILABLE_ICONS = [
    { value: 'Star', label: 'Star', icon: Star },
    { value: 'Shield', label: 'Shield', icon: Shield },
    { value: 'Wrench', label: 'Wrench', icon: Wrench },
    { value: 'Award', label: 'Award', icon: Award },
    { value: 'Crown', label: 'Crown', icon: Crown },
    { value: 'Trophy', label: 'Trophy', icon: Trophy },
    { value: 'Zap', label: 'Lightning', icon: Zap },
    { value: 'Target', label: 'Target', icon: Target },
    { value: 'Heart', label: 'Heart', icon: Heart },
    { value: 'Sparkles', label: 'Sparkles', icon: Sparkles },
    { value: 'Flame', label: 'Flame', icon: Flame },
    { value: 'TrendingUp', label: 'Trending Up', icon: TrendingUp },
    { value: 'FlaskConical', label: 'Flask', icon: FlaskConical },
    { value: 'TowerControl', label: 'Tower Control', icon: TowerControl },
];

export const PRESET_COLORS = [
    '#EF4444',
    '#F59E0B',
    '#10B981',
    '#3B82F6',
    '#6366F1',
    '#8B5CF6',
    '#EC4899',
    '#14B8A6',
    '#F97316',
    '#84CC16',
];

export const getIconComponent = (iconName: string) => {
    const iconOption = AVAILABLE_ICONS.find((i) => i.value === iconName);
    return iconOption?.icon || Star;
};