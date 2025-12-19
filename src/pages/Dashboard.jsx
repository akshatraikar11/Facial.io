import React, { useState, useEffect } from 'react';
import {
    LayoutDashboard,
    Users,
    Scan,
    Settings,
    Download,
    RotateCcw,
    Search,
    MoreVertical,
    Calendar as CalendarIcon,
    Clock,
    CheckCircle2,
    XCircle
} from 'lucide-react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Kiosk from '../components/Kiosk';
import { getAttendance, getUsers, deleteUser, updateUser } from '../utils/storage';
import { exportTodayAttendance, exportWeekAttendance, exportMonthAttendance } from '../utils/export';

const Dashboard = () => {
    const [currentView, setCurrentView] = useState('monitor'); // 'monitor' | 'people'
    const [showKiosk, setShowKiosk] = useState(false);

    // Data State
    const [users, setUsers] = useState([]);
    const [attendance, setAttendance] = useState([]);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // User Edit State
    const [editingUser, setEditingUser] = useState(null);
    const [editName, setEditName] = useState('');

    // Load Data
    useEffect(() => {
        const load = async () => {
            setUsers(await getUsers());
            setAttendance(await getAttendance());
        };
        load();
    }, [refreshTrigger, showKiosk]); // Reload when kiosk closes or trigger happens

    const refreshData = () => setRefreshTrigger(prev => prev + 1);

    // Stats
    const today = new Date().toISOString().slice(0, 10);
    const todaysLogs = attendance.filter((l) => l.date === today);
    const uniquePresentToday = new Set(todaysLogs.map((l) => l.userId)).size;
    const totalUsers = users.length;
    const attendanceRate = totalUsers > 0 ? Math.round((uniquePresentToday / totalUsers) * 100) : 0;

    // Handlers (Legacy)
    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this profile?')) {
            await deleteUser(id);
            setUsers(await getUsers());
        }
    };



    const saveEdit = async (userId) => {
        if (!editName.trim()) return;
        await updateUser(userId, { name: editName.trim() });
        setUsers(await getUsers());
        setEditingUser(null);
    };

    // Views
    const renderSidebar = () => (
        <aside style={{
            width: '240px',
            borderRight: '1px solid var(--md-sys-color-outline-variant)',
            display: 'flex',
            flexDirection: 'column',
            padding: '16px',
            background: 'var(--md-sys-color-surface)'
        }}>
            <div style={{ marginBottom: '32px', paddingLeft: '12px' }}>
                <h1 style={{ fontSize: '18px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '24px', height: '24px', background: 'var(--md-sys-color-primary)', borderRadius: '6px' }} />
                    Facial.io
                </h1>
            </div>

            <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <NavItem
                    icon={LayoutDashboard}
                    label="Monitor"
                    active={currentView === 'monitor'}
                    onClick={() => setCurrentView('monitor')}
                />
                <NavItem
                    icon={Users}
                    label="People"
                    active={currentView === 'people'}
                    onClick={() => setCurrentView('people')}
                />
                <NavItem
                    icon={Scan}
                    label="Kiosk Mode"
                    onClick={() => setShowKiosk(true)}
                />
            </nav>

            <div style={{ marginTop: 'auto' }}>
                <NavItem icon={Settings} label="Settings" />
            </div>
        </aside>
    );

    const renderMonitor = () => (
        <div className="animate-fade-in">
            <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '8px' }}>Monitor</h2>
                    <p style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>Real-time activity and system overview.</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <Button variant="outline" size="sm" onClick={refreshData}>Refresh</Button>
                    <ExportDropdown attendance={attendance} />
                </div>
            </header>

            {/* Stats Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
                <StatCard label="Present Today" value={uniquePresentToday} total={totalUsers} />
                <StatCard label="Attendance Rate" value={`${attendanceRate}%`} sub="Daily average" />
                <StatCard label="Total Faces" value={totalUsers} sub="Registered profiles" />
            </div>

            {/* Recent Activity Feed */}
            <Card variant="surface" className="overflow-hidden">
                <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--md-sys-color-outline-variant)', display: 'flex', justifyContent: 'space-between' }}>
                    <h3 style={{ fontWeight: 600 }}>Recent Check-ins</h3>
                    <Badge variant="soft">{todaysLogs.length} today</Badge>
                </div>
                {attendance.length === 0 ? (
                    <div style={{ padding: '48px', textAlign: 'center', color: 'var(--md-sys-color-on-surface-variant)' }}>
                        <Clock size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
                        <p>No activity recorded yet.</p>
                    </div>
                ) : (
                    <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                        <table className="w-full text-left" style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead style={{ background: 'var(--md-sys-color-surface-container-low)', position: 'sticky', top: 0 }}>
                                <tr>
                                    <th style={{ padding: '12px 24px', fontSize: '13px', color: 'var(--md-sys-color-on-surface-variant)' }}>Name</th>
                                    <th style={{ padding: '12px 24px', fontSize: '13px', color: 'var(--md-sys-color-on-surface-variant)' }}>Time</th>
                                    <th style={{ padding: '12px 24px', fontSize: '13px', color: 'var(--md-sys-color-on-surface-variant)' }}>Date</th>
                                    <th style={{ padding: '12px 24px', fontSize: '13px', color: 'var(--md-sys-color-on-surface-variant)' }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[...attendance].reverse().map((log) => (
                                    <tr key={log.id} style={{ borderBottom: '1px solid var(--md-sys-color-outline-variant)' }}>
                                        <td style={{ padding: '12px 24px', fontWeight: 500 }}>{log.userName || 'Unknown'}</td>
                                        <td style={{ padding: '12px 24px' }}>{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                        <td style={{ padding: '12px 24px' }}>{log.date}</td>
                                        <td style={{ padding: '12px 24px' }}>
                                            <Badge variant="success" size="sm">Confirmed</Badge>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    );

    const renderPeople = () => (
        <div className="animate-fade-in">
            <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between' }}>
                <div>
                    <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '8px' }}>People</h2>
                    <p style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>Manage registered faces and profiles.</p>
                </div>
            </header>

            <Card variant="surface">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--md-sys-color-outline-variant)' }}>
                            <th style={{ padding: '16px', textAlign: 'left', width: '40%' }}>Name</th>
                            <th style={{ padding: '16px', textAlign: 'left' }}>ID</th>
                            <th style={{ padding: '16px', textAlign: 'left' }}>Registered</th>
                            <th style={{ padding: '16px', textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(user => (
                            <tr key={user.id} style={{ borderBottom: '1px solid var(--md-sys-color-outline-variant)' }}>
                                <td style={{ padding: '16px' }}>
                                    {editingUser === user.id ? (
                                        <input
                                            autoFocus
                                            value={editName}
                                            onChange={e => setEditName(e.target.value)}
                                            onBlur={() => saveEdit(user.id)}
                                            onKeyDown={e => e.key === 'Enter' && saveEdit(user.id)}
                                            className="input-field"
                                        />
                                    ) : (
                                        <span style={{ fontWeight: 500 }}>{user.name}</span>
                                    )}
                                </td>
                                <td style={{ padding: '16px', fontSize: '14px', fontFamily: 'monospace', color: 'var(--md-sys-color-on-surface-variant)' }}>
                                    {user.id.slice(0, 8)}
                                </td>
                                <td style={{ padding: '16px', fontSize: '14px' }}>
                                    {new Date(user.createdAt).toLocaleDateString()}
                                </td>
                                <td style={{ padding: '16px', textAlign: 'right' }}>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                        <Button size="sm" variant="ghost" onClick={() => { setEditingUser(user.id); setEditName(user.name); }}>Edit</Button>
                                        <Button size="sm" variant="ghost" style={{ color: 'var(--md-sys-color-error)' }} onClick={() => handleDelete(user.id)}>Delete</Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {users.length === 0 && (
                            <tr>
                                <td colSpan={4} style={{ padding: '32px', textAlign: 'center', opacity: 0.6 }}>
                                    No users found. Monitor activity in Kiosk mode to register (mock) or use Register page.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </Card>
        </div>
    );

    return (
        <div style={{ display: 'flex', height: '100vh', padding: '20px', boxSizing: 'border-box', overflow: 'hidden' }}>
            <div style={{
                display: 'flex',
                flex: 1,
                borderRadius: '28px',
                overflow: 'hidden',
                background: 'var(--md-sys-color-surface)',
                boxShadow: 'var(--md-sys-elevation-2)',
                border: '1px solid var(--md-sys-color-outline-variant)',
                position: 'relative'
            }}>
                {renderSidebar()}
                <main style={{ flex: 1, padding: '32px', overflowY: 'auto', background: 'var(--md-sys-color-background)' }}>
                    {currentView === 'monitor' && renderMonitor()}
                    {currentView === 'people' && renderPeople()}
                </main>
            </div>

            {showKiosk && (
                <Kiosk onClose={() => { setShowKiosk(false); refreshData(); }} />
            )}
        </div>
    );
};

// Subcomponents
// eslint-disable-next-line no-unused-vars
const NavItem = ({ icon: Icon, label, active, onClick }) => (
    <button
        onClick={onClick}
        style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px',
            width: '100%',
            borderRadius: '16px',
            background: active ? 'var(--md-sys-color-secondary-container)' : 'transparent',
            color: active ? 'var(--md-sys-color-on-secondary-container)' : 'var(--md-sys-color-on-surface)',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            fontWeight: 500,
            fontSize: '14px'
        }}
    >
        <Icon size={18} />
        {label}
    </button>
);

const StatCard = ({ label, value, sub, total }) => (
    <Card variant="surface" style={{ padding: '20px' }}>
        <p style={{ fontSize: '13px', color: 'var(--md-sys-color-on-surface-variant)', fontWeight: 500, marginBottom: '8px' }}>{label}</p>
        <div style={{ fontSize: '32px', fontWeight: 600, letterSpacing: '-1px', lineHeight: 1 }}>
            {value}
            {total !== undefined && <span style={{ fontSize: '16px', color: 'var(--md-sys-color-on-surface-variant)', marginLeft: '4px', fontWeight: 400 }}>/ {total}</span>}
        </div>
        {sub && <p style={{ fontSize: '13px', color: 'var(--md-sys-color-on-surface-variant)', marginTop: '8px' }}>{sub}</p>}
    </Card>
);

const ExportDropdown = ({ attendance }) => (
    <div className="pill-action-btn" style={{ padding: '0', overflow: 'hidden', display: 'flex' }}>
        <button
            onClick={() => {
                const range = document.getElementById('export-range-dash').value;
                if (range === 'week') exportWeekAttendance(attendance);
                else if (range === 'month') exportMonthAttendance(attendance);
                else exportTodayAttendance(attendance);
            }}
            style={{ background: 'transparent', border: 'none', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'inherit', height: '100%' }}
        >
            <Download size={16} />
            <span className="pill-label">Export</span>
        </button>
        <div style={{ borderLeft: '1px solid rgba(11, 87, 208, 0.2)', padding: '0 8px', display: 'flex', alignItems: 'center' }}>
            <select
                id="export-range-dash"
                style={{ background: 'transparent', border: 'none', fontSize: '12px', fontWeight: 500, cursor: 'pointer', outline: 'none' }}
            >
                <option value="today">Today</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
            </select>
        </div>
    </div>
);

export default Dashboard;
