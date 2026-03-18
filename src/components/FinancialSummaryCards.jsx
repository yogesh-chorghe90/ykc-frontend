import React from 'react';
import { TrendingUp, DollarSign, CreditCard, PieChart, Wallet } from 'lucide-react';
import { formatCurrency } from '../utils/formatUtils';

const FinancialSummaryCards = ({ lead }) => {
    const loanAmount = lead.loanAmount || lead.amount || 0;
    const disbursedAmount = lead.disbursedAmount || 0;
    const remainingAmount = loanAmount - disbursedAmount;
    const commissionAmount = lead.commissionAmount || 0;
    const commissionPercentage = lead.commissionPercentage || 0;
    const gstAmount = lead.gst || 0;
    const netCommission = commissionAmount - gstAmount;
    const progressPercentage = loanAmount > 0 ? (disbursedAmount / loanAmount) * 100 : 0;

    const cards = [
        {
            title: "Approved Amount",
            value: formatCurrency(loanAmount),
            subtitle: "Fixed Sanctioned Limit",
            icon: CreditCard,
            color: "primary",
            bgColor: "bg-primary-50",
            textColor: "text-primary-600",
            iconColor: "text-primary-500"
        },
        {
            title: "Total Disbursed",
            value: formatCurrency(disbursedAmount),
            subtitle: "Amount Released",
            icon: DollarSign,
            color: "emerald",
            bgColor: "bg-emerald-50",
            textColor: "text-emerald-600",
            iconColor: "text-emerald-500"
        },
        {
            title: "Remaining Amount",
            value: formatCurrency(remainingAmount),
            subtitle: "Pending Disbursement",
            icon: TrendingUp,
            color: "orange",
            bgColor: "bg-orange-50",
            textColor: "text-orange-600",
            iconColor: "text-orange-500"
        },
        {
            title: "Total Commission",
            value: formatCurrency(commissionAmount),
            subtitle: "Earned So Far",
            icon: Wallet,
            color: "blue",
            bgColor: "bg-blue-50",
            textColor: "text-blue-600",
            iconColor: "text-blue-500"
        }
    ];

    return (
        <div className="flex flex-wrap gap-3 mb-6">
            {cards.map((card, index) => {
                const Icon = card.icon;
                return (
                    <div 
                        key={index}
                        className="bg-red-50 p-3 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all duration-300 flex-1 min-w-[120px] max-w-[200px]"
                    >
                        {/* Decorative Background Element */}
                        <div className={`absolute right-0 top-0 w-12 h-12 ${card.bgColor} rounded-bl-full -mr-2 -mt-2 transition-transform group-hover:scale-110 duration-300`}></div>
                        
                        <div className="relative">
                            {/* Icon */}
                            <div className={`w-6 h-6 rounded-full ${card.bgColor} flex items-center justify-center mb-1`}>
                                <Icon size={12} className={card.iconColor} />
                            </div>
                            
                            {/* Title */}
                            <p className={`text-[8px] font-bold ${card.textColor} uppercase tracking-wide mb-0.5`}>
                                {card.title}
                            </p>
                            
                            {/* Value */}
                            <p className="text-base font-bold text-gray-900 mb-0.5 truncate">
                                {card.value}
                            </p>
                            
                            {/* Subtitle */}
                            <p className={`text-[7px] ${card.textColor} opacity-70 truncate`}>
                                {card.subtitle}
                            </p>
                            
                            {/* Progress Bar (for disbursed and remaining cards) */}
                            {index === 1 && (
                                <div className="w-full bg-gray-100 rounded-full h-1 mt-1 overflow-hidden">
                                    <div 
                                        className="bg-emerald-500 h-1 rounded-full transition-all duration-700 ease-out"
                                        style={{ width: `${progressPercentage}%` }}
                                    ></div>
                                </div>
                            )}
                            
                            {index === 2 && (
                                <div className="w-full bg-gray-100 rounded-full h-1 mt-1 overflow-hidden">
                                    <div 
                                        className="bg-orange-500 h-1 rounded-full transition-all duration-700 ease-out"
                                        style={{ width: `${100 - progressPercentage}%` }}
                                    ></div>
                                </div>
                            )}
                            
                            {/* Status Badge (for remaining amount) */}
                            {index === 2 && remainingAmount === 0 && (
                                <span className="inline-block mt-1 px-1 py-0.5 bg-green-100 text-green-700 text-[7px] font-bold rounded">
                                    Completed
                                </span>
                            )}
                            
                            {/* Commission Percentage (for commission card) */}
                            {index === 3 && (
                                <div className="mt-1 flex items-center gap-0.5">
                                    <span className="text-[7px] text-gray-500">Rate:</span>
                                    <span className="text-[7px] font-bold text-blue-600">{commissionPercentage}%</span>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
            
            {/* Additional Net Commission Card - Narrower Width */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-3 rounded-xl border border-green-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all duration-300 flex-1 min-w-[120px] max-w-[200px]">
                <div className="absolute right-0 top-0 w-12 h-12 bg-green-100 rounded-bl-full -mr-2 -mt-2 transition-transform group-hover:scale-110 duration-300"></div>
                <div className="relative">
                    <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center mb-1">
                        <PieChart size={12} className="text-green-600" />
                    </div>
                    <p className="text-[8px] font-bold text-green-600 uppercase tracking-wide mb-0.5">
                        Net Commission
                    </p>
                    <p className="text-base font-bold text-gray-900 mb-0.5 truncate">
                        {formatCurrency(netCommission)}
                    </p>
                    <p className="text-[7px] text-green-600 opacity-70 truncate">
                        After GST Deduction
                    </p>
                    <div className="mt-1 flex items-center gap-0.5">
                        <span className="text-[7px] text-gray-500">GST:</span>
                        <span className="text-[7px] font-bold text-orange-600">{formatCurrency(gstAmount)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FinancialSummaryCards;