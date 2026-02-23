import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, Check, X } from 'lucide-react';
import { Button } from './Button';

export type DateRangePreset = 'today' | 'yesterday' | 'wtd' | 'mtd' | 'qtd' | 'ytd' | 'custom';

interface DateRange {
  start: Date;
  end: Date;
}

interface DateRangePickerProps {
  value: DateRangePreset;
  customRange?: DateRange;
  onChange: (preset: DateRangePreset, range: DateRange) => void;
}

const PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'wtd', label: 'Week to date' },
  { value: 'mtd', label: 'Month to date' },
  { value: 'qtd', label: 'Quarter to date' },
  { value: 'ytd', label: 'Year to date' },
  { value: 'custom', label: 'Custom' },
];

// Get current date in PST (America/Los_Angeles)
// Uses proper timezone conversion - works regardless of user's local timezone
function getPSTDate(): Date {
  const now = new Date();
  // Format the current time in PST timezone
  const pstString = now.toLocaleString('en-US', { 
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  // Parse "MM/DD/YYYY" format
  const [month, day, year] = pstString.split('/').map(Number);
  // Return a date object representing that PST date
  // Note: This is intentionally in local timezone for display purposes
  return new Date(year, month - 1, day);
}

function getPresetRange(preset: DateRangePreset): DateRange {
  // Use PST for all date calculations
  const today = getPSTDate();
  
  switch (preset) {
    case 'today':
      return { start: today, end: today };
    case 'yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { start: yesterday, end: yesterday };
    }
    case 'wtd': {
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday
      return { start: startOfWeek, end: today };
    }
    case 'mtd': {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: startOfMonth, end: today };
    }
    case 'qtd': {
      const quarter = Math.floor(today.getMonth() / 3);
      const startOfQuarter = new Date(today.getFullYear(), quarter * 3, 1);
      return { start: startOfQuarter, end: today };
    }
    case 'ytd': {
      const startOfYear = new Date(today.getFullYear(), 0, 1);
      return { start: startOfYear, end: today };
    }
    default:
      return { start: today, end: today };
  }
}

function formatDateRange(range: DateRange): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  const start = range.start.toLocaleDateString('en-US', opts);
  const end = range.end.toLocaleDateString('en-US', opts);
  
  if (start === end) return start;
  return `${start} – ${end}`;
}

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function DateRangePicker({ value, customRange, onChange }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [tempRange, setTempRange] = useState<DateRange | null>(null);
  const [selectingStart, setSelectingStart] = useState(true);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [showMobileSheet, setShowMobileSheet] = useState(false);
  const [mobileShowCalendar, setMobileShowCalendar] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentRange = value === 'custom' && customRange ? customRange : getPresetRange(value);
  const currentPreset = PRESETS.find(p => p.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowCalendar(false);
        setTempRange(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePresetClick = (preset: DateRangePreset) => {
    if (preset === 'custom') {
      setShowCalendar(true);
      setTempRange(currentRange);
      setSelectingStart(true);
    } else {
      onChange(preset, getPresetRange(preset));
      setIsOpen(false);
      setShowCalendar(false);
    }
  };

  const handleDayClick = (date: Date) => {
    if (!tempRange) return;
    
    if (selectingStart) {
      setTempRange({ start: date, end: date });
      setSelectingStart(false);
    } else {
      const newRange = date < tempRange.start 
        ? { start: date, end: tempRange.start }
        : { start: tempRange.start, end: date };
      setTempRange(newRange);
    }
  };

  const handleApply = () => {
    if (tempRange) {
      onChange('custom', tempRange);
    }
    setIsOpen(false);
    setShowCalendar(false);
  };

  const handleCancel = () => {
    setIsOpen(false);
    setShowCalendar(false);
    setTempRange(null);
  };

  // Generate calendar days
  const generateCalendarDays = (monthDate: Date) => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay();
    const days: (Date | null)[] = [];

    // Padding for previous month
    for (let i = 0; i < startPad; i++) {
      days.push(null);
    }
    // Days of month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d));
    }
    return days;
  };

  const prevMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1);
  const nextMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isInRange = (date: Date) => {
    if (!tempRange) return false;
    const d = date.getTime();
    return d >= tempRange.start.getTime() && d <= tempRange.end.getTime();
  };

  const isRangeStart = (date: Date) => tempRange && date.getTime() === tempRange.start.getTime();
  const isRangeEnd = (date: Date) => tempRange && date.getTime() === tempRange.end.getTime();

  // Mobile preset click handler
  const handleMobilePresetClick = (preset: DateRangePreset) => {
    if (preset === 'custom') {
      setMobileShowCalendar(true);
      setTempRange(currentRange);
      setSelectingStart(true);
    } else {
      onChange(preset, getPresetRange(preset));
      setShowMobileSheet(false);
      setMobileShowCalendar(false);
    }
  };

  // Mobile apply custom range
  const handleMobileApply = () => {
    if (tempRange) {
      onChange('custom', tempRange);
    }
    setShowMobileSheet(false);
    setMobileShowCalendar(false);
    setTempRange(null);
  };

  // Render mobile calendar days
  const renderMobileCalendarDays = () => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    const days = [];
    
    for (let i = 0; i < startPadding; i++) {
      days.push(<div key={`pad-${i}`} className="h-10" />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const isStart = tempRange && date.toDateString() === tempRange.start.toDateString();
      const isEnd = tempRange && date.toDateString() === tempRange.end.toDateString();
      const inRange = tempRange && date > tempRange.start && date < tempRange.end;
      const isFuture = date > todayDate;

      days.push(
        <button
          key={day}
          onClick={() => !isFuture && handleDayClick(date)}
          disabled={isFuture}
          className={`h-10 text-sm font-medium transition-colors ${
            (isStart || isEnd) ? 'bg-gray-800 text-white' : ''
          } ${isStart ? 'rounded-l-lg' : ''} ${isEnd ? 'rounded-r-lg' : ''} ${
            inRange ? 'bg-gray-200' : ''
          } ${isStart && !tempRange?.end ? 'rounded-lg' : ''} ${
            isFuture ? 'text-gray-300 cursor-not-allowed' : ''
          } ${!isStart && !isEnd && !inRange && !isFuture ? 'hover:bg-gray-100 rounded-lg' : ''}`}
        >
          {day}
        </button>
      );
    }
    return days;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Mobile Trigger */}
      <button
        onClick={() => setShowMobileSheet(true)}
        className="sm:hidden flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700"
      >
        <Calendar className="w-4 h-4 text-gray-500" />
        <span>{currentPreset?.label}</span>
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </button>
      
      {/* Desktop Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="hidden sm:flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <Calendar className="w-4 h-4 text-gray-500" />
        <span>{currentPreset?.label}</span>
        <span className="text-gray-400">|</span>
        <span className="text-gray-600">{formatDateRange(currentRange)}</span>
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </button>
      
      {/* Mobile Bottom Sheet */}
      {showMobileSheet && (
        <>
          <div 
            className="sm:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => {
              setShowMobileSheet(false);
              setMobileShowCalendar(false);
              setTempRange(null);
            }}
          />
          <div className="sm:hidden fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl max-h-[85vh] overflow-hidden flex flex-col animate-slide-up">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>
            
            {/* Header */}
            <div className="flex items-center justify-between px-4 pb-3 border-b border-gray-100">
              <h2 className="text-lg font-semibold">Date range</h2>
              <button 
                onClick={() => {
                  setShowMobileSheet(false);
                  setMobileShowCalendar(false);
                  setTempRange(null);
                }} 
                className="p-2 -mr-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {!mobileShowCalendar ? (
                <>
                  {/* Fixed dates option */}
                  <button
                    onClick={() => {
                      setMobileShowCalendar(true);
                      setTempRange(currentRange);
                      setSelectingStart(true);
                    }}
                    className="w-full flex items-center justify-between px-4 py-4 hover:bg-gray-50 border-b border-gray-100"
                  >
                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-gray-400" />
                      <div className="text-left">
                        <div className="font-medium">Fixed dates</div>
                        <div className="text-sm text-gray-500">{formatDateRange(currentRange)}</div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </button>
                  
                  {/* Presets */}
                  <div className="py-2">
                    {PRESETS.filter(p => p.value !== 'custom').map((preset) => (
                      <button
                        key={preset.value}
                        onClick={() => handleMobilePresetClick(preset.value)}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                      >
                        <span className={`text-base ${value === preset.value ? 'font-medium' : ''}`}>
                          {preset.label}
                        </span>
                        {value === preset.value && (
                          <Check className="w-5 h-5 text-amber-500" />
                        )}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                /* Mobile Calendar View */
                <div className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">Custom date range</h3>
                    <button 
                      onClick={() => setMobileShowCalendar(false)} 
                      className="p-1 hover:bg-gray-100 rounded-full"
                    >
                      <X className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>
                  
                  {/* Date Input Fields */}
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex-1 flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">
                        {tempRange ? tempRange.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Start'}
                      </span>
                    </div>
                    <span className="text-gray-400">→</span>
                    <div className="flex-1 flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">
                        {tempRange ? tempRange.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'End'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Month Navigation */}
                  <div className="flex items-center justify-between mb-4">
                    <button
                      onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1))}
                      className="p-2 hover:bg-gray-100 rounded-full"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="font-semibold">
                      {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </span>
                    <button
                      onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1))}
                      className="p-2 hover:bg-gray-100 rounded-full"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                  
                  {/* Day Headers */}
                  <div className="grid grid-cols-7 mb-1">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                      <div key={day} className="h-8 flex items-center justify-center text-xs text-gray-500 font-medium">
                        {day}
                      </div>
                    ))}
                  </div>
                  
                  {/* Calendar Grid */}
                  <div className="grid grid-cols-7">
                    {renderMobileCalendarDays()}
                  </div>
                  
                  {/* Apply Button */}
                  <Button 
                    className="w-full mt-6 bg-gray-900 hover:bg-gray-800"
                    onClick={handleMobileApply}
                    disabled={!tempRange}
                  >
                    Apply
                  </Button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
          <div className="flex">
            {/* Presets */}
            <div className="w-44 border-r border-gray-200 py-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => handlePresetClick(preset.value)}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between ${
                    value === preset.value ? 'text-gray-900 font-medium bg-gray-50' : 'text-gray-600'
                  }`}
                >
                  {preset.label}
                  {value === preset.value && !showCalendar && (
                    <span className="text-green-600">✓</span>
                  )}
                </button>
              ))}
            </div>

            {/* Calendar (shown for Custom) */}
            {showCalendar && (
              <div className="p-4 min-w-[580px]">
                {/* Date inputs */}
                <div className="flex items-center gap-3 mb-4">
                  <input
                    type="text"
                    readOnly
                    value={tempRange ? tempRange.start.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="Start date"
                  />
                  <span className="text-gray-400">→</span>
                  <input
                    type="text"
                    readOnly
                    value={tempRange ? tempRange.end.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="End date"
                  />
                </div>

                {/* Calendar grids */}
                <div className="flex gap-6">
                  {/* Previous month */}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-3">
                      <button
                        onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-sm font-medium">{formatMonthYear(prevMonth)}</span>
                      <div className="w-6" />
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 mb-1">
                      {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                        <div key={d} className="py-1">{d}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {generateCalendarDays(prevMonth).map((date, i) => (
                        <button
                          key={i}
                          disabled={!date || date > today}
                          onClick={() => date && handleDayClick(date)}
                          className={`py-1.5 text-sm rounded-md transition-colors ${
                            !date ? '' :
                            date > today ? 'text-gray-300 cursor-not-allowed' :
                            isRangeStart(date) || isRangeEnd(date) ? 'bg-gray-900 text-white' :
                            isInRange(date) ? 'bg-gray-100' :
                            'hover:bg-gray-100'
                          }`}
                        >
                          {date?.getDate() || ''}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Current month */}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-6" />
                      <span className="text-sm font-medium">{formatMonthYear(calendarMonth)}</span>
                      <button
                        onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 mb-1">
                      {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                        <div key={d} className="py-1">{d}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {generateCalendarDays(calendarMonth).map((date, i) => (
                        <button
                          key={i}
                          disabled={!date || date > today}
                          onClick={() => date && handleDayClick(date)}
                          className={`py-1.5 text-sm rounded-md transition-colors ${
                            !date ? '' :
                            date > today ? 'text-gray-300 cursor-not-allowed' :
                            isRangeStart(date) || isRangeEnd(date) ? 'bg-gray-900 text-white' :
                            isInRange(date) ? 'bg-gray-100' :
                            'hover:bg-gray-100'
                          }`}
                        >
                          {date?.getDate() || ''}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleApply}
                    className="px-4 py-2 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export { getPresetRange, getPSTDate };
