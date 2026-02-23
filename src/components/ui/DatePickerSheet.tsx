import { useState } from 'react';
import { Calendar, ChevronRight, ChevronLeft, Check, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './Button';

interface DatePreset {
  label: string;
  getValue: () => { start: Date; end: Date };
}

interface DatePickerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPreset: string;
  dateRange: { start: Date; end: Date };
  presets: DatePreset[];
  onPresetSelect: (preset: DatePreset) => void;
  onCustomRangeSelect: (start: Date, end: Date) => void;
}

export function DatePickerSheet({
  isOpen,
  onClose,
  selectedPreset,
  dateRange,
  presets,
  onPresetSelect,
  onCustomRangeSelect,
}: DatePickerSheetProps) {
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [tempStart, setTempStart] = useState<Date | null>(null);
  const [tempEnd, setTempEnd] = useState<Date | null>(null);

  if (!isOpen) return null;

  const formatDateRange = () => {
    const formatDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${formatDate(dateRange.start)} - ${formatDate(dateRange.end)}`;
  };

  const handlePresetClick = (preset: DatePreset) => {
    onPresetSelect(preset);
    onClose();
  };

  const handleDayClick = (date: Date) => {
    if (!tempStart || (tempStart && tempEnd)) {
      setTempStart(date);
      setTempEnd(null);
    } else {
      if (date < tempStart) {
        setTempEnd(tempStart);
        setTempStart(date);
      } else {
        setTempEnd(date);
      }
    }
  };

  const applyCustomRange = () => {
    if (tempStart && tempEnd) {
      onCustomRangeSelect(tempStart, tempEnd);
      onClose();
    }
  };

  const renderCalendar = () => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days = [];
    
    // Padding for days before month starts
    for (let i = 0; i < startPadding; i++) {
      days.push(<div key={`pad-${i}`} className="h-10" />);
    }

    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const isStart = tempStart && date.toDateString() === tempStart.toDateString();
      const isEnd = tempEnd && date.toDateString() === tempEnd.toDateString();
      const isInRange = tempStart && tempEnd && date > tempStart && date < tempEnd;
      const isFuture = date > today;
      const isToday = date.toDateString() === today.toDateString();

      days.push(
        <button
          key={day}
          onClick={() => !isFuture && handleDayClick(date)}
          disabled={isFuture}
          className={cn(
            "h-10 text-sm font-medium transition-colors relative",
            // Selected endpoints - dark background
            (isStart || isEnd) && "bg-gray-800 text-white",
            // Start has rounded left
            isStart && "rounded-l-lg",
            // End has rounded right  
            isEnd && "rounded-r-lg",
            // In range - light background
            isInRange && "bg-gray-200",
            // Single day selection (start without end)
            isStart && !tempEnd && "rounded-lg",
            // Future dates - grayed out
            isFuture && "text-gray-300 cursor-not-allowed",
            // Today indicator
            !isStart && !isEnd && !isInRange && isToday && "font-bold text-amber-600",
            // Default hover
            !isStart && !isEnd && !isInRange && !isFuture && "hover:bg-gray-100 rounded-lg"
          )}
        >
          {day}
        </button>
      );
    }

    return days;
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />
      
      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl max-h-[85vh] overflow-hidden flex flex-col animate-slide-up">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3 border-b border-gray-100">
          <h2 className="text-lg font-semibold">Date range</h2>
          <button onClick={onClose} className="p-2 -mr-2 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {!showCalendar ? (
            <>
              {/* Fixed dates option */}
              <button
                onClick={() => {
                  setShowCalendar(true);
                  setTempStart(dateRange.start);
                  setTempEnd(dateRange.end);
                }}
                className="w-full flex items-center justify-between px-4 py-4 hover:bg-gray-50 border-b border-gray-100"
              >
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <div className="text-left">
                    <div className="font-medium">Fixed dates</div>
                    <div className="text-sm text-gray-500">{formatDateRange()}</div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>
              
              {/* Presets */}
              <div className="py-2">
                {presets.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => handlePresetClick(preset)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                  >
                    <span className={cn(
                      "text-base",
                      selectedPreset === preset.label ? "font-medium" : ""
                    )}>
                      {preset.label}
                    </span>
                    {selectedPreset === preset.label && (
                      <Check className="w-5 h-5 text-amber-500" />
                    )}
                  </button>
                ))}
              </div>
            </>
          ) : (
            /* Calendar View - Shopify Style */
            <div className="p-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Custom date range</h3>
                <button onClick={() => setShowCalendar(false)} className="p-1 hover:bg-gray-100 rounded-full">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              
              {/* Date Input Fields */}
              <div className="flex items-center gap-2 mb-4">
                <div className="flex-1 flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-sm">
                    {tempStart ? tempStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Start date'}
                  </span>
                </div>
                <span className="text-gray-400">→</span>
                <div className="flex-1 flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-sm">
                    {tempEnd ? tempEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'End date'}
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
                {renderCalendar()}
              </div>
              
              {/* Apply Button */}
              <Button 
                className="w-full mt-6 bg-gray-900 hover:bg-gray-800"
                onClick={applyCustomRange}
                disabled={!tempStart || !tempEnd}
              >
                Apply
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
