// Grading Documentation and Monthly Tracking System
const fs = require('fs').promises;
const path = require('path');

class GradingDocumentationService {
  constructor() {
    this.documentationPath = path.join(__dirname, '../data/grading_records');
    this.ensureDirectoryExists();
  }

  async ensureDirectoryExists() {
    try {
      await fs.mkdir(this.documentationPath, { recursive: true });
    } catch (error) {
      console.warn('⚠️ Could not create grading records directory:', error);
    }
  }

  async recordTicketGrade(ticketData, gradeData, technicianEmail) {
    try {
      const today = new Date();
      const monthYear = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}`;
      
      const gradeRecord = {
        timestamp: today.toISOString(),
        date: today.toLocaleDateString(),
        time: today.toLocaleTimeString(),
        ticketId: ticketData.IssueID,
        technician: ticketData.Tech_Assigned_Clean,
        technicianEmail: technicianEmail,
        customer: ticketData.Customer_Name,
        subject: ticketData.Subject,
        priority: ticketData.Priority,
        status: ticketData.Status,
        created: ticketData.Create_Date,
        lastUpdate: ticketData.Last_Update,
        grade: {
          letter: gradeData.grade,
          score: gradeData.score,
          strengths: gradeData.strengths,
          improvements: gradeData.improvements,
          recommendations: gradeData.recommendations,
          summary: gradeData.summary
        },
        metadata: {
          monthYear: monthYear,
          weekNumber: this.getWeekNumber(today),
          dayOfWeek: today.getDay(),
          isBusinessHours: this.isBusinessHours(today)
        }
      };

      // Save individual grade record
      const filename = `grade_${ticketData.IssueID}_${today.toISOString().split('T')[0]}.json`;
      const filepath = path.join(this.documentationPath, filename);
      await fs.writeFile(filepath, JSON.stringify(gradeRecord, null, 2));

      // Update monthly summary
      await this.updateMonthlySummary(monthYear, gradeRecord);
      
      // Update technician performance tracking
      await this.updateTechnicianTracking(ticketData.Tech_Assigned_Clean, gradeRecord);

      console.log(`📝 Grade recorded: Ticket ${ticketData.IssueID} - ${gradeData.grade} (${gradeData.score}%)`);
      
      return gradeRecord;

    } catch (error) {
      console.error('❌ Failed to record ticket grade:', error);
      throw error;
    }
  }

  async updateMonthlySummary(monthYear, gradeRecord) {
    try {
      const summaryFile = path.join(this.documentationPath, `monthly_summary_${monthYear}.json`);
      
      let summary = {
        month: monthYear,
        totalReviews: 0,
        gradeDistribution: { A: 0, B: 0, C: 0, D: 0, F: 0 },
        averageScore: 0,
        technicianStats: {},
        commonStrengths: {},
        commonImprovements: {},
        reviewsByWeek: {},
        lastUpdated: new Date().toISOString()
      };

      try {
        const existing = await fs.readFile(summaryFile, 'utf8');
        summary = JSON.parse(existing);
      } catch (error) {
        // File doesn't exist yet, use default
      }

      // Update totals
      summary.totalReviews++;
      summary.lastUpdated = new Date().toISOString();

      // Update grade distribution
      const gradeLetter = gradeRecord.grade.letter.replace(/[+-]/, ''); // Convert B+ to B
      if (summary.gradeDistribution[gradeLetter] !== undefined) {
        summary.gradeDistribution[gradeLetter]++;
      }

      // Update technician stats
      const tech = gradeRecord.technician;
      if (!summary.technicianStats[tech]) {
        summary.technicianStats[tech] = {
          reviewCount: 0,
          totalScore: 0,
          averageScore: 0,
          grades: [],
          lastReview: gradeRecord.timestamp
        };
      }

      summary.technicianStats[tech].reviewCount++;
      summary.technicianStats[tech].totalScore += gradeRecord.grade.score;
      summary.technicianStats[tech].averageScore = Math.round(
        summary.technicianStats[tech].totalScore / summary.technicianStats[tech].reviewCount
      );
      summary.technicianStats[tech].grades.push({
        ticketId: gradeRecord.ticketId,
        grade: gradeRecord.grade.letter,
        score: gradeRecord.grade.score,
        date: gradeRecord.date
      });
      summary.technicianStats[tech].lastReview = gradeRecord.timestamp;

      // Track common strengths and improvements
      gradeRecord.grade.strengths.forEach(strength => {
        summary.commonStrengths[strength] = (summary.commonStrengths[strength] || 0) + 1;
      });

      gradeRecord.grade.improvements.forEach(improvement => {
        summary.commonImprovements[improvement] = (summary.commonImprovements[improvement] || 0) + 1;
      });

      // Track reviews by week
      const week = `Week ${gradeRecord.metadata.weekNumber}`;
      if (!summary.reviewsByWeek[week]) {
        summary.reviewsByWeek[week] = 0;
      }
      summary.reviewsByWeek[week]++;

      // Calculate overall average
      let totalScore = 0;
      let totalReviews = 0;
      Object.values(summary.technicianStats).forEach(tech => {
        totalScore += tech.totalScore;
        totalReviews += tech.reviewCount;
      });
      summary.averageScore = totalReviews > 0 ? Math.round(totalScore / totalReviews) : 0;

      await fs.writeFile(summaryFile, JSON.stringify(summary, null, 2));
      
    } catch (error) {
      console.error('❌ Failed to update monthly summary:', error);
    }
  }

  async updateTechnicianTracking(technician, gradeRecord) {
    try {
      const techFile = path.join(this.documentationPath, `technician_${technician.replace(/[\\\/]/g, '_')}.json`);
      
      let techData = {
        technician: technician,
        email: gradeRecord.technicianEmail,
        totalReviews: 0,
        averageScore: 0,
        gradeHistory: [],
        performanceTrends: {},
        strengths: {},
        improvements: {},
        lastReview: gradeRecord.timestamp,
        created: new Date().toISOString()
      };

      try {
        const existing = await fs.readFile(techFile, 'utf8');
        techData = JSON.parse(existing);
      } catch (error) {
        // File doesn't exist yet, use default
      }

      // Add new grade to history
      techData.gradeHistory.push({
        ticketId: gradeRecord.ticketId,
        date: gradeRecord.date,
        grade: gradeRecord.grade.letter,
        score: gradeRecord.grade.score,
        customer: gradeRecord.customer,
        subject: gradeRecord.subject,
        strengths: gradeRecord.grade.strengths,
        improvements: gradeRecord.grade.improvements,
        recommendations: gradeRecord.grade.recommendations
      });

      // Update totals
      techData.totalReviews++;
      techData.lastReview = gradeRecord.timestamp;
      
      // Calculate average score
      const totalScore = techData.gradeHistory.reduce((sum, grade) => sum + grade.score, 0);
      techData.averageScore = Math.round(totalScore / techData.totalReviews);

      // Track performance trends (last 5 reviews)
      const recentGrades = techData.gradeHistory.slice(-5);
      if (recentGrades.length >= 2) {
        const recentAvg = recentGrades.reduce((sum, grade) => sum + grade.score, 0) / recentGrades.length;
        const olderGrades = techData.gradeHistory.slice(-10, -5);
        const olderAvg = olderGrades.length > 0 ? 
          olderGrades.reduce((sum, grade) => sum + grade.score, 0) / olderGrades.length : recentAvg;
        
        techData.performanceTrends = {
          recentAverage: Math.round(recentAvg),
          previousAverage: Math.round(olderAvg),
          trend: recentAvg > olderAvg ? 'improving' : recentAvg < olderAvg ? 'declining' : 'stable',
          trendPercentage: Math.round(((recentAvg - olderAvg) / olderAvg) * 100)
        };
      }

      // Update strength and improvement frequencies
      gradeRecord.grade.strengths.forEach(strength => {
        techData.strengths[strength] = (techData.strengths[strength] || 0) + 1;
      });

      gradeRecord.grade.improvements.forEach(improvement => {
        techData.improvements[improvement] = (techData.improvements[improvement] || 0) + 1;
      });

      await fs.writeFile(techFile, JSON.stringify(techData, null, 2));
      
    } catch (error) {
      console.error('❌ Failed to update technician tracking:', error);
    }
  }

  async generateMonthlyReport(monthYear) {
    try {
      const summaryFile = path.join(this.documentationPath, `monthly_summary_${monthYear}.json`);
      const summary = JSON.parse(await fs.readFile(summaryFile, 'utf8'));

      const report = {
        title: `Monthly Performance Report - ${monthYear}`,
        generated: new Date().toISOString(),
        summary: {
          totalReviews: summary.totalReviews,
          averageScore: summary.averageScore,
          topPerformer: this.getTopPerformer(summary.technicianStats),
          improvementOpportunity: this.getImprovementOpportunity(summary.technicianStats)
        },
        gradeDistribution: summary.gradeDistribution,
        technicianPerformance: summary.technicianStats,
        insights: {
          mostCommonStrengths: this.getTopItems(summary.commonStrengths, 5),
          mostCommonImprovements: this.getTopItems(summary.commonImprovements, 5),
          weeklyDistribution: summary.reviewsByWeek
        },
        recommendations: this.generateRecommendations(summary)
      };

      const reportFile = path.join(this.documentationPath, `report_${monthYear}.json`);
      await fs.writeFile(reportFile, JSON.stringify(report, null, 2));

      return report;
      
    } catch (error) {
      console.error('❌ Failed to generate monthly report:', error);
      throw error;
    }
  }

  getTopPerformer(techStats) {
    let topTech = null;
    let highestScore = 0;

    Object.entries(techStats).forEach(([tech, stats]) => {
      if (stats.averageScore > highestScore && stats.reviewCount >= 2) {
        highestScore = stats.averageScore;
        topTech = { name: tech, score: stats.averageScore, reviews: stats.reviewCount };
      }
    });

    return topTech;
  }

  getImprovementOpportunity(techStats) {
    let improvementTech = null;
    let lowestScore = 100;

    Object.entries(techStats).forEach(([tech, stats]) => {
      if (stats.averageScore < lowestScore && stats.reviewCount >= 2) {
        lowestScore = stats.averageScore;
        improvementTech = { name: tech, score: stats.averageScore, reviews: stats.reviewCount };
      }
    });

    return improvementTech;
  }

  getTopItems(items, count = 5) {
    return Object.entries(items)
      .sort(([,a], [,b]) => b - a)
      .slice(0, count)
      .map(([item, frequency]) => ({ item, frequency }));
  }

  generateRecommendations(summary) {
    const recommendations = [];

    // Check if any tech needs more reviews
    Object.entries(summary.technicianStats).forEach(([tech, stats]) => {
      if (stats.reviewCount < 2) {
        recommendations.push(`Increase review frequency for ${tech} (only ${stats.reviewCount} reviews this month)`);
      }
      if (stats.averageScore < 70) {
        recommendations.push(`Focus on improvement plan for ${tech} (average score: ${stats.averageScore}%)`);
      }
    });

    // Check grade distribution
    const totalGrades = Object.values(summary.gradeDistribution).reduce((sum, count) => sum + count, 0);
    const lowGrades = (summary.gradeDistribution.D + summary.gradeDistribution.F) / totalGrades;
    if (lowGrades > 0.2) {
      recommendations.push(`High percentage of D/F grades (${Math.round(lowGrades * 100)}%) - review training needs`);
    }

    // Review frequency recommendations
    if (summary.totalReviews < 20) {
      recommendations.push(`Consider increasing review frequency (only ${summary.totalReviews} reviews this month)`);
    }

    return recommendations;
  }

  getWeekNumber(date) {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  isBusinessHours(date) {
    const hour = date.getHours();
    const day = date.getDay();
    return day >= 1 && day <= 5 && hour >= 9 && hour <= 16; // Monday-Friday, 9AM-4PM
  }
}

module.exports = GradingDocumentationService;