import React, { useState, useEffect } from 'react';
import {
    Filter,
    ChevronDown,
    ChevronUp,
    Search,
    ArrowUpDown,
} from 'lucide-react';
import {
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
} from 'recharts';
import api from '../services/api';
import { formatInCrores } from '../utils/formatUtils';

const AccountantOverview = () => {
    const [dashboardData, setDashboardData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [funnelFilter, setFunnelFilter] = useState('monthly'); // 'weekly', 'monthly', 'yearly'
    const [filtersOpen, setFiltersOpen] = useState(false); // Start with filters collapsed
    const [agents, setAgents] = useState([]);
    const [agentsLoading, setAgentsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

    useEffect(() => {
        fetchDashboard();
        fetchAgents();
    }, [funnelFilter]);

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

    const fetchAgents = async () => {
        try {
            setAgentsLoading(true);
            const response = await api.agents.getAll();
            const agentsData = response.data || response || [];
            setAgents(Array.isArray(agentsData) ? agentsData : []);
        } catch (error) {
            console.error('Error fetching agents:', error);
            setAgents([]);
        } finally {
            setAgentsLoading(false);
        }
    };

    const getAssociatedName = (agent) => {
        if (!agent) return 'N/A';
        if (agent.managedByModel === 'RelationshipManager') {
            return agent.managedBy?.name || 'N/A';
        }
        if (agent.managedByModel === 'Franchise') {
            return agent.managedBy?.name || 'N/A';
        }
        if (agent.managedBy && typeof agent.managedBy === 'object' && agent.managedBy.name) {
            return agent.managedBy.name;
        }
        if (agent.franchise && (agent.franchise.name || agent.franchise._id || agent.franchise.id)) {
            return agent.franchise?.name || 'N/A';
        }
        return 'N/A';
    };

    const getAssociatedDisplay = (agent) => {
        const name = getAssociatedName(agent);
        if (name === 'N/A') return 'N/A';
        // Return abbreviation: first 2 characters if it's a franchise, or first 2 chars + number if RM
        if (agent.managedByModel === 'Franchise') {
            return name.substring(0, 2).toUpperCase();
        }
        if (agent.managedByModel === 'RelationshipManager') {
            return name.toLowerCase().replace(/\d+/g, '').substring(0, 2) + (name.match(/\d+/) ? name.match(/\d+/)[0] : '');
        }
        return name.substring(0, 2).toUpperCase();
    };

    const handleSort = (key) => {
        setSortConfig(prevConfig => {
            if (prevConfig.key === key) {
                return {
                    key,
                    direction: prevConfig.direction === 'asc' ? 'desc' : 'asc'
                };
            }
            return { key, direction: 'asc' };
        });
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) {
            return <ArrowUpDown className="w-3 h-3 text-gray-400" />;
        }
        return sortConfig.direction === 'asc' 
            ? <ArrowUpDown className="w-3 h-3 text-primary-900" />
            : <ArrowUpDown className="w-3 h-3 text-primary-900 rotate-180" />;
    };

    // Filter and sort agents
    const filteredAndSortedAgents = React.useMemo(() => {
        let filtered = agents.filter(agent => {
            if (!agent) return false;
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch = 
                (agent.name && agent.name.toLowerCase().includes(searchLower)) ||
                (agent.email && agent.email.toLowerCase().includes(searchLower)) ||
                (agent.mobile && agent.mobile.includes(searchTerm));
            return matchesSearch;
        });

        if (sortConfig.key) {
            filtered.sort((a, b) => {
                let aVal, bVal;
                if (sortConfig.key === 'name') {
                    aVal = a.name || '';
                    bVal = b.name || '';
                } else {
                    aVal = a[sortConfig.key] || '';
                    bVal = b[sortConfig.key] || '';
                }
                if (sortConfig.direction === 'asc') {
                    return aVal > bVal ? 1 : -1;
                } else {
                    return aVal < bVal ? 1 : -1;
                }
            });
        }

        return filtered;
    }, [agents, searchTerm, sortConfig]);

    if (loading || !dashboardData) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-900"></div>
            </div>
        );
    }

    const {
        totalLeads = 0,
        verifiedLeads = 0,
        disbursedCases = 0,
        activeAgents = 0,
        totalFranchises = 0,
        activeRelationshipManagers = 0,
        totalInvoices = 0,
        totalRevenue = 0,
        totalLoanAmount = 0,
        loanDistribution = [],
        funnelData = [],
        recentLeads = [],
        recentAgents = []
    } = dashboardData;

    const totalLoanAmountForChart = Array.isArray(loanDistribution)
        ? loanDistribution.reduce((sum, item) => sum + (item.totalAmount || 0), 0)
        : 0;

    return (
        <div className="space-y-6 w-full max-w-full overflow-x-hidden">
            {/* Breadcrumbs */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>Dashboard</span>
                <span>/</span>
                <span>Home</span>
                <span>/</span>
                <span className="text-gray-900 font-medium">Analytics</span>
            </div>

            {/* Filter Section */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
                <button
                    onClick={() => setFiltersOpen(!filtersOpen)}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <Filter className="w-5 h-5 text-gray-600" />
                        <span className="text-sm font-medium text-gray-900">Filter options</span>
                    </div>
                    {filtersOpen ? (
                        <ChevronUp className="w-5 h-5 text-gray-600" />
                    ) : (
                        <ChevronDown className="w-5 h-5 text-gray-600" />
                    )}
                </button>
                {filtersOpen && (
                    <div className="px-4 pb-4 border-t border-gray-100">
                        <div className="pt-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Search by name, email, or mobile..."
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Agents List */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th
                                        className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('name')}
                                    >
                                        <div className="flex items-center gap-2">
                                            NAME
                                            {getSortIcon('name')}
                                        </div>
                                    </th>
                                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        CONTACT
                                    </th>
                                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        ASSO
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {agentsLoading ? (
                                    <tr>
                                        <td colSpan="3" className="px-6 py-8 text-center text-gray-500">
                                            Loading...
                                        </td>
                                    </tr>
                                ) : filteredAndSortedAgents.length === 0 ? (
                                    <tr>
                                        <td colSpan="3" className="px-6 py-8 text-center text-gray-500">
                                            No agents found
                                        </td>
                                    </tr>
                                ) : (
                                    filteredAndSortedAgents.map((agent, index) => {
                                        const agentId = agent.id || agent._id;
                                        return (
                                            <tr key={agentId || `agent-${index}`} className="hover:bg-gray-50">
                                                <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-medium text-gray-900">{agent.name || 'N/A'}</div>
                                                </td>
                                                <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900">{agent.email || 'N/A'}</div>
                                                    {agent.mobile && (
                                                        <div className="text-xs text-gray-500">{agent.mobile}</div>
                                                    )}
                                                </td>
                                                <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900">{getAssociatedDisplay(agent)}</div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                    {!agentsLoading && filteredAndSortedAgents.length > 0 && (
                        <div className="px-4 sm:px-6 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
                            Showing {filteredAndSortedAgents.length} of {agents.length} agents
                        </div>
                    )}
                </div>

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

                {/* Lead Conversion Funnel */}
                <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-gray-900">Lead Conversion Funnel</h3>
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

            {/* Bottom Section: Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Recent Leads Table */}
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
                    <div className="p-6 flex items-center justify-between border-b border-gray-100">
                        <h3 className="text-lg font-bold text-gray-900">Recent Leads</h3>
                        <button className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">View All</button>
                    </div>
                    <div className="overflow-x-auto">
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
                                        <td colSpan="2" className="px-6 py-8 text-center text-gray-500">No recent leads found</td>
                                    </tr>
                                ) : (
                                    recentLeads.map((lead) => (
                                        <tr key={lead.id} className="group hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-sm text-gray-900">{lead.name}</div>
                                                <div className="text-xs text-gray-500 truncate max-w-[150px]">{lead.id} • {lead.date}</div>
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
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Recent Agents */}
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
                    <div className="p-6 flex items-center justify-between border-b border-gray-100">
                        <h3 className="text-lg font-bold text-gray-900">Recent Agents</h3>
                        <button className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">View All</button>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        <div className="divide-y divide-gray-50">
                            {recentAgents.length === 0 ? (
                                <div className="p-10 text-center text-gray-500">No agents found</div>
                            ) : (
                                recentAgents.map((agent, idx) => (
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
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AccountantOverview;
