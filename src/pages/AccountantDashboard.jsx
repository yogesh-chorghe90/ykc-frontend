import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import {
    LayoutDashboard,
    Users,
    FileText,
    ArrowUpRight,
    Search,
    Bell,
    Plus,
    TrendingUp,
    DollarSign,
    UserPlus,
    UserCheck,
    MoreVertical,
    CheckCircle2,
    Clock,
    AlertCircle,
    Settings,
    BarChart3,
    Briefcase
} from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
    Legend
} from 'recharts';
import StatCard from '../components/StatCard';
import NotificationDropdown from '../components/NotificationDropdown';
import AccountantLeads from './AccountantLeads';
import AccountantInvoices from './AccountantInvoices';
import { formatInCrores } from '../utils/formatUtils';

const AccountantDashboard = () => {
    const [activeTab, setActiveTab] = useState('Overview');
    const [dashboardData, setDashboardData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isNotificationOpen, setIsNotificationOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const notificationRef = useRef(null);

    const [funnelFilter, setFunnelFilter] = useState('monthly'); // 'weekly', 'monthly', 'yearly'

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                setLoading(true);
                const params = {
                    funnelPeriod: funnelFilter,
                };
                const response = await api.dashboard.getAccountsDashboard(params);
                setDashboardData(response.data || response);
            } catch (error) {
                console.error('Error fetching accountant dashboard:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchDashboard();
    }, [funnelFilter]);

    const {
        totalLeads = 0,
        verifiedLeads = 0,
        disbursedCases = 0,
        activeAgents = 0,
        totalInvoices = 0,
        totalRevenue = 0,
        totalLoanAmount = 0,
        loanDistribution = [],
        funnelData = [],
        recentLeads = [],
        recentAgents = []
    } = dashboardData || {};

    const totalLoanAmountForChart = Array.isArray(loanDistribution)
        ? loanDistribution.reduce((sum, item) => sum + (item.totalAmount || 0), 0)
        : 0;

    const navItems = [
        { name: 'Overview', icon: LayoutDashboard },
        { name: 'Customers', icon: Users },
        { name: 'Invoices', icon: FileText, badge: 3 },
        { name: 'Agents', icon: Briefcase },
        { name: 'Reports', icon: BarChart3 },
        { name: 'Settings', icon: Settings },
    ];

    // Close notification dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (notificationRef.current && !notificationRef.current.contains(event.target)) {
                setIsNotificationOpen(false);
            }
        };

        if (isNotificationOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isNotificationOpen]);

    return (
        <div className="flex min-h-screen bg-slate-50 text-slate-900 font-sans">
            {/* Sidebar Navigation */}
            <aside className="w-64 bg-white border-r border-slate-200 text-slate-600 flex flex-col fixed inset-y-0 left-0 z-50 transition-all duration-300">
                <div className="p-2 flex items-center border-b border-slate-100">
                    <img src="/logo.webp" alt="YKC Logo" className="w-48 h-20 object-contain" />
                </div>

                <nav className="flex-1 px-4 space-y-2 mt-6">
                    {navItems.map((item) => (
                        <button
                            key={item.name}
                            onClick={() => setActiveTab(item.name)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${activeTab === item.name
                                ? 'bg-blue-50 text-blue-700 font-bold shadow-sm ring-1 ring-blue-100'
                                : 'hover:bg-slate-50 hover:text-slate-900 text-slate-500 font-medium'
                                }`}
                        >
                            <item.icon size={20} className={activeTab === item.name ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600 transition-colors'} />
                            <span className="text-sm">{item.name}</span>
                            {item.badge && (
                                <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-bold ${activeTab === item.name ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                                    {item.badge}
                                </span>
                            )}
                        </button>
                    ))}
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 ml-64 p-8 space-y-6 bg-slate-50">
                {/* Top Header Section */}
                <div className="sticky top-0 z-20 bg-slate-50 pb-4 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">Accountant Dashboard</h1>
                        <div className="flex items-center gap-2 mt-2 text-sm text-slate-500">
                            <span className="hover:text-blue-600 cursor-pointer transition-colors">Dashboard</span>
                            <span>/</span>
                            <span className="hover:text-blue-600 cursor-pointer transition-colors">Home</span>
                            <span>/</span>
                            <span className="text-slate-700 font-medium">Analytics</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {/* Notification Bell */}
                        <div className="relative z-[110]" ref={notificationRef}>
                            <button
                                onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                                className="relative w-10 h-10 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-300 transition-all"
                                title="Notifications"
                            >
                                <Bell size={20} />
                                {unreadCount > 0 && (
                                    <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center transform translate-x-1 -translate-y-1">
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </span>
                                )}
                            </button>
                            <NotificationDropdown
                                isOpen={isNotificationOpen}
                                onClose={() => setIsNotificationOpen(false)}
                                unreadCount={unreadCount}
                                setUnreadCount={setUnreadCount}
                            />
                        </div>
                        <div className="relative cursor-pointer group">
                            <img
                                src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=150"
                                alt="Profile"
                                className="w-10 h-10 rounded-lg object-cover ring-2 ring-white shadow-sm"
                            />
                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                        </div>
                    </div>
                </div>
                {loading ? (
                    <div className="flex items-center justify-center min-h-[400px]">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                ) : activeTab === 'Overview' && (
                    <>
                        {/* Stats Grid */}
                        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                            <StatCard
                                title="Total Customers"
                                value={totalLeads.toString()}
                                icon={TrendingUp}
                                color="blue"
                            />
                            <StatCard
                                title="Active Agents"
                                value={activeAgents.toString()}
                                icon={UserCheck}
                                color="green"
                            />
                            <StatCard
                                title="Total Invoices"
                                value={totalInvoices.toString()}
                                icon={FileText}
                                color="orange"
                            />
                            <StatCard
                                title="Total Amount"
                                value={formatInCrores(totalLoanAmount || 0)}
                                icon={DollarSign}
                                color="purple"
                            />
                        </section>

                        {/* Middle Section: Chart and Activity */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            {/* Loan Distribution Chart */}
                            <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                                <h3 className="text-lg font-bold text-gray-900 mb-4">Loan Distribution</h3>
                                {loanDistribution.length > 0 ? (
                                    <div className="flex flex-col sm:flex-row items-center gap-4">
                                        <div className="w-full sm:w-48 h-48 relative flex-shrink-0 [&_svg]:outline-none [&_*]:outline-none">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart style={{ outline: 'none' }}>
                                                    <Pie
                                                        data={loanDistribution}
                                                        dataKey="value"
                                                        nameKey="name"
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius="55%"
                                                        outerRadius="85%"
                                                        paddingAngle={1}
                                                        stroke="none"
                                                        style={{ cursor: 'pointer', outline: 'none' }}
                                                    >
                                                        {loanDistribution.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                                        ))}
                                                    </Pie>
                                                </PieChart>
                                            </ResponsiveContainer>
                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                <span className="text-lg font-bold text-gray-700 text-center px-2">
                                                    {formatInCrores(totalLoanAmountForChart || totalLoanAmount || 0)}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <ul className="space-y-2">
                                                {loanDistribution.map((item, idx) => (
                                                    <li
                                                        key={idx}
                                                        className="flex items-center gap-2 text-sm rounded px-1 py-0.5 -mx-1"
                                                    >
                                                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                                                        <span className="text-gray-700 truncate">
                                                            {item.name} ({item.count || 0})
                                                        </span>
                                                        <span className="font-medium text-gray-900 ml-auto">
                                                            {formatInCrores(item.totalAmount || 0)}
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500 text-center py-8">No loan distribution data</p>
                                )}
                            </div>

                            {/* Customer Conversion Funnel */}
                            <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-lg font-bold text-gray-900">Customer Conversion Funnel</h3>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setFunnelFilter('weekly')}
                                            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                                                funnelFilter === 'weekly'
                                                    ? 'bg-primary-900 text-white'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                            }`}
                                        >
                                            Weekly
                                        </button>
                                        <button
                                            onClick={() => setFunnelFilter('monthly')}
                                            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                                                funnelFilter === 'monthly'
                                                    ? 'bg-primary-900 text-white'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                            }`}
                                        >
                                            Monthly
                                        </button>
                                        <button
                                            onClick={() => setFunnelFilter('yearly')}
                                            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                                                funnelFilter === 'yearly'
                                                    ? 'bg-primary-900 text-white'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                            }`}
                                        >
                                            Yearly
                                        </button>
                                    </div>
                                </div>
                                <div className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            layout="vertical"
                                            data={funnelData}
                                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                                            <XAxis type="number" hide />
                                            <YAxis
                                                dataKey="name"
                                                type="category"
                                                tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }}
                                                width={80}
                                                axisLine={false}
                                                tickLine={false}
                                            />
                                            <Tooltip
                                                cursor={{ fill: '#f8fafc' }}
                                                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                                                formatter={(value) => formatInCrores(value)}
                                                labelFormatter={(label) => label}
                                            />
                                            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={32}>
                                                {funnelData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        {/* Recent Customers Table */}
                        <div className="lg:col-span-1 bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-6 flex items-center justify-between border-b border-gray-100">
                                <h3 className="text-lg font-bold text-gray-900">Recent Customers</h3>
                                <button className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">View All</button>
                            </div>
                            <div className="p-0">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 border-b border-gray-100">
                                        <tr>
                                            <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name/ID</th>
                                            <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {recentLeads.length === 0 ? (
                                            <tr>
                                                <td colSpan="2" className="px-6 py-8 text-center text-gray-500">No leads found</td>
                                            </tr>
                                        ) : recentLeads.map((lead) => (
                                            <tr key={lead.id} className="group hover:bg-gray-50/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-sm text-gray-900">{lead.name}</div>
                                                    <div className="text-xs text-gray-500">{lead.id} • {lead.date}</div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="text-sm font-bold text-gray-900">{lead.amount}</div>
                                                    <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${['Logged', 'logged'].includes(lead.status) ? 'bg-orange-100 text-orange-700' :
                                                        ['Sanctioned', 'sanctioned'].includes(lead.status) ? 'bg-lime-100 text-lime-700' :
                                                            ['Disbursed', 'disbursed', 'Partial_disbursed', 'partial_disbursed'].includes(lead.status) ? 'bg-blue-100 text-blue-700' :
                                                                ['Completed', 'completed'].includes(lead.status) ? 'bg-green-100 text-green-700' :
                                                                    'bg-red-100 text-red-700'
                                                        }`}>
                                                        {lead.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Recent Agents */}
                        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                            <div className="p-6 flex items-center justify-between border-b border-gray-100">
                                <h3 className="text-lg font-bold text-gray-900">Recent Agents</h3>
                                <button className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">View All</button>
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                <div className="divide-y divide-gray-50">
                                    {recentAgents.length === 0 ? (
                                        <div className="p-10 text-center text-gray-500">No agents found</div>
                                    ) : recentAgents.map((agent, idx) => (
                                        <div key={idx} className="p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors">
                                            <img src={agent.avatar} alt={agent.name} className="w-10 h-10 rounded-full object-cover ring-2 ring-white shadow-sm" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-bold text-gray-900 truncate">{agent.name}</div>
                                                <div className="text-xs text-gray-500 truncate">{agent.email}</div>
                                            </div>
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${['active', 'Active'].includes(agent.status) ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                                                }`}>
                                                {agent.status}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {!loading && activeTab === 'Customers' && (
                    <div className="w-full">
                        <AccountantLeads />
                    </div>
                )}

                {!loading && activeTab === 'Invoices' && (
                    <div className="w-full">
                        <AccountantInvoices />
                    </div>
                )}
            </main>
        </div>
    );
};

export default AccountantDashboard;
