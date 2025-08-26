const { differenceInBusinessDays, isWeekend, addBusinessDays, format } = require('date-fns');

class BusinessDayCalculator {
  constructor() {
    // US Federal Holidays (you can customize this)
    this.holidays = [
      '2025-01-01', // New Year's Day
      '2025-01-20', // MLK Day
      '2025-02-17', // Presidents Day
      '2025-05-26', // Memorial Day
      '2025-07-04', // Independence Day
      '2025-09-01', // Labor Day
      '2025-10-13', // Columbus Day
      '2025-11-11', // Veterans Day
      '2025-11-27', // Thanksgiving
      '2025-12-25', // Christmas
    ];
  }

  isBusinessDay(date) {
    if (isWeekend(date)) {
      return false;
    }
    
    const dateStr = date.toISOString().split('T')[0];
    return !this.holidays.includes(dateStr);
  }

  getBusinessDaysSince(startDate, endDate = new Date()) {
    if (!startDate) return 0;
    
    // Use date-fns business day calculation
    const businessDays = differenceInBusinessDays(endDate, startDate);
    
    // Subtract any holidays that fall within the range
    let holidayCount = 0;
    for (const holiday of this.holidays) {
      const holidayDate = new Date(holiday);
      if (holidayDate > startDate && holidayDate <= endDate && !isWeekend(holidayDate)) {
        holidayCount++;
      }
    }
    
    return Math.max(0, businessDays - holidayCount);
  }

  getBusinessDaysUntil(targetDate, fromDate = new Date()) {
    return this.getBusinessDaysSince(fromDate, targetDate);
  }

  addBusinessDays(date, days) {
    return addBusinessDays(date, days);
  }

  getNextBusinessDay(date = new Date()) {
    let nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    
    while (!this.isBusinessDay(nextDay)) {
      nextDay.setDate(nextDay.getDate() + 1);
    }
    
    return nextDay;
  }

  getLastUpdateCategory(lastUpdateDate, currentStatus) {
    if (!lastUpdateDate) {
      return { category: 'never_updated', businessDays: null, severity: 'critical' };
    }

    const businessDaysSince = this.getBusinessDaysSince(lastUpdateDate);
    
    // Adjust thresholds based on status
    const isWaitingStatus = this.isWaitingStatus(currentStatus);
    const threshold = isWaitingStatus ? 2 : 1; // 2 days for waiting, 1 day for active work
    
    let category, severity;
    
    if (businessDaysSince === 0) {
      category = 'updated_today';
      severity = 'good';
    } else if (businessDaysSince === 1 && !isWaitingStatus) {
      category = 'due_for_update';
      severity = 'warning';
    } else if (businessDaysSince <= threshold) {
      category = 'within_sla';
      severity = 'good';
    } else if (businessDaysSince <= threshold + 1) {
      category = 'overdue';
      severity = 'warning';
    } else {
      category = 'severely_overdue';
      severity = 'critical';
    }
    
    return { category, businessDays: businessDaysSince, severity, isWaitingStatus };
  }

  isWaitingStatus(status) {
    if (!status) return false;
    const waitingStatuses = [
      'awaiting customer response',
      'awaiting delivery', 
      'shipped-pending delivery',
      'waiting for parts',
      'scheduled'
    ];
    return waitingStatuses.some(waitingStatus => 
      status.toLowerCase().includes(waitingStatus.toLowerCase())
    );
  }
}

module.exports = BusinessDayCalculator;