const StatCard = ({ title, value, icon: Icon, color = 'blue' }) => {
  const colorClasses = {
    blue: 'bg-blue-500',
    orange: 'bg-orange-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    red: 'bg-red-500',
    indigo: 'bg-indigo-500',
    teal: 'bg-teal-500',
    gray: 'bg-gray-500',
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 md:p-4 w-full h-full min-h-[78px]">
      <div className="flex items-center justify-between h-full gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] md:text-xs font-medium text-gray-600 leading-tight">
            {title}
          </p>
          <p className="text-lg md:text-xl font-bold text-gray-900 mt-1 leading-snug break-words">
            {value}
          </p>
        </div>

        <div
          className={`${colorClasses[color] || colorClasses.blue} w-9 h-9 md:w-10 md:h-10 rounded-lg flex items-center justify-center flex-shrink-0`}
        >
          {Icon && <Icon className="w-4 h-4 md:w-5 md:h-5 text-white" />}
        </div>
      </div>
    </div>
  )
}

export default StatCard
