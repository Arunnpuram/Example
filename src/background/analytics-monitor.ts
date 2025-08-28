/**
 * Analytics and performance monitoring for the Skill Gap Analyzer extension
 * 
 * This module provides local analytics tracking and performance monitoring
 * without compromising user privacy.
 */

import { StorageManager } from '@/core/storage';

export interface AnalyticsEvent {
  type: string;
  timestamp: number;
  data?: Record<string, any>;
  sessionId: string;
}

export interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  context?: Record<string, any>;
}

export interface UsagePattern {
  feature: string;
  usageCount: number;
  lastUsed: number;
  averageSessionDuration?: number;
}

export interface ErrorReport {
  error: string;
  stack?: string;
  timestamp: number;
  context?: Record<string, any>;
  sessionId: string;
}

export interface AnalyticsSummary {
  totalSessions: number;
  totalEvents: number;
  averageSessionDuration: number;
  mostUsedFeatures: UsagePattern[];
  performanceMetrics: PerformanceMetric[];
  errorCount: number;
  lastActive: number;
}

export class AnalyticsMonitor {
  private storageManager: StorageManager;
  private sessionId: string;
  private sessionStartTime: number;
  private events: AnalyticsEvent[] = [];
  private performanceMetrics: PerformanceMetric[] = [];
  private errorReports: ErrorReport[] = [];
  private usagePatterns: Map<string, UsagePattern> = new Map();
  
  // Configuration
  private readonly MAX_EVENTS_IN_MEMORY = 100;
  private readonly MAX_STORED_EVENTS = 1000;
  private readonly MAX_PERFORMANCE_METRICS = 500;
  private readonly MAX_ERROR_REPORTS = 100;
  private readonly FLUSH_INTERVAL = 5 * 60 * 1000; // 5 minutes
  
  private flushTimer?: number;

  constructor() {
    this.storageManager = StorageManager.getInstance();
    this.sessionId = this.generateSessionId();
    this.sessionStartTime = Date.now();
    
    this.startPeriodicFlush();
  }

  /**
   * Initialize analytics monitor
   */
  async initialize(): Promise<void> {
    try {
      // Load existing usage patterns
      const patternsResult = await this.storageManager.retrieve<Record<string, UsagePattern>>('usage_patterns');
      if (patternsResult.success && patternsResult.data) {
        this.usagePatterns = new Map(Object.entries(patternsResult.data));
      }

      // Track session start
      await this.trackEvent('session_start', {
        timestamp: this.sessionStartTime,
        userAgent: navigator.userAgent,
        extensionVersion: chrome.runtime.getManifest().version
      });

      console.log('📊 Analytics monitor initialized');
    } catch (error) {
      console.error('❌ Error initializing analytics monitor:', error);
    }
  }

  /**
   * Track an analytics event
   */
  async trackEvent(type: string, data?: Record<string, any>): Promise<void> {
    try {
      const event: AnalyticsEvent = {
        type,
        timestamp: Date.now(),
        data,
        sessionId: this.sessionId
      };

      this.events.push(event);
      
      // Update usage patterns
      this.updateUsagePattern(type);

      // Flush if we have too many events in memory
      if (this.events.length >= this.MAX_EVENTS_IN_MEMORY) {
        await this.flushEvents();
      }

      console.log(`📈 Event tracked: ${type}`, data);
    } catch (error) {
      console.error('❌ Error tracking event:', error);
    }
  }

  /**
   * Track performance metric
   */
  async trackPerformance(name: string, value: number, context?: Record<string, any>): Promise<void> {
    try {
      const metric: PerformanceMetric = {
        name,
        value,
        timestamp: Date.now(),
        context
      };

      this.performanceMetrics.push(metric);

      // Keep only recent metrics in memory
      if (this.performanceMetrics.length > this.MAX_PERFORMANCE_METRICS) {
        this.performanceMetrics = this.performanceMetrics.slice(-this.MAX_PERFORMANCE_METRICS);
      }

      console.log(`⚡ Performance metric: ${name} = ${value}ms`, context);
    } catch (error) {
      console.error('❌ Error tracking performance:', error);
    }
  }

  /**
   * Track error report
   */
  async trackError(error: Error | string, context?: Record<string, any>): Promise<void> {
    try {
      const errorReport: ErrorReport = {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: Date.now(),
        context,
        sessionId: this.sessionId
      };

      this.errorReports.push(errorReport);

      // Keep only recent errors in memory
      if (this.errorReports.length > this.MAX_ERROR_REPORTS) {
        this.errorReports = this.errorReports.slice(-this.MAX_ERROR_REPORTS);
      }

      // Also track as an event
      await this.trackEvent('error_occurred', {
        error: errorReport.error,
        context
      });

      console.error(`🚨 Error tracked: ${errorReport.error}`, context);
    } catch (trackingError) {
      console.error('❌ Error tracking error:', trackingError);
    }
  }

  /**
   * Get analytics summary
   */
  async getAnalyticsSummary(): Promise<AnalyticsSummary> {
    try {
      // Load stored events for comprehensive summary
      const eventsResult = await this.storageManager.retrieve<AnalyticsEvent[]>('analytics_events');
      const storedEvents = eventsResult.success ? eventsResult.data || [] : [];
      
      const allEvents = [...storedEvents, ...this.events];
      
      // Calculate session statistics
      const sessions = new Set(allEvents.map(e => e.sessionId));
      const totalSessions = sessions.size;
      
      // Calculate average session duration
      const sessionDurations = this.calculateSessionDurations(allEvents);
      const averageSessionDuration = sessionDurations.length > 0 
        ? sessionDurations.reduce((sum, duration) => sum + duration, 0) / sessionDurations.length
        : 0;

      // Get most used features
      const mostUsedFeatures = Array.from(this.usagePatterns.values())
        .sort((a, b) => b.usageCount - a.usageCount)
        .slice(0, 10);

      // Get recent performance metrics
      const recentMetrics = this.performanceMetrics.slice(-50);

      return {
        totalSessions,
        totalEvents: allEvents.length,
        averageSessionDuration,
        mostUsedFeatures,
        performanceMetrics: recentMetrics,
        errorCount: this.errorReports.length,
        lastActive: Date.now()
      };
    } catch (error) {
      console.error('❌ Error getting analytics summary:', error);
      throw error;
    }
  }

  /**
   * Get performance insights
   */
  getPerformanceInsights(): Record<string, any> {
    const insights: Record<string, any> = {};

    // Analyze analysis speed
    const analysisMetrics = this.performanceMetrics.filter(m => m.name === 'job_analysis_duration');
    if (analysisMetrics.length > 0) {
      const durations = analysisMetrics.map(m => m.value);
      insights.analysisSpeed = {
        average: durations.reduce((sum, d) => sum + d, 0) / durations.length,
        min: Math.min(...durations),
        max: Math.max(...durations),
        count: durations.length
      };
    }

    // Analyze skill extraction performance
    const extractionMetrics = this.performanceMetrics.filter(m => m.name === 'skill_extraction_duration');
    if (extractionMetrics.length > 0) {
      const durations = extractionMetrics.map(m => m.value);
      insights.extractionSpeed = {
        average: durations.reduce((sum, d) => sum + d, 0) / durations.length,
        min: Math.min(...durations),
        max: Math.max(...durations),
        count: durations.length
      };
    }

    // Analyze storage performance
    const storageMetrics = this.performanceMetrics.filter(m => m.name.includes('storage'));
    if (storageMetrics.length > 0) {
      const durations = storageMetrics.map(m => m.value);
      insights.storageSpeed = {
        average: durations.reduce((sum, d) => sum + d, 0) / durations.length,
        operations: storageMetrics.length
      };
    }

    return insights;
  }

  /**
   * Get error insights
   */
  getErrorInsights(): Record<string, any> {
    const insights: Record<string, any> = {};

    // Group errors by type
    const errorsByType: Record<string, number> = {};
    this.errorReports.forEach(report => {
      const errorType = this.categorizeError(report.error);
      errorsByType[errorType] = (errorsByType[errorType] || 0) + 1;
    });

    insights.errorsByType = errorsByType;
    insights.totalErrors = this.errorReports.length;
    insights.errorRate = this.events.length > 0 ? this.errorReports.length / this.events.length : 0;

    // Recent errors
    insights.recentErrors = this.errorReports
      .slice(-10)
      .map(report => ({
        error: report.error,
        timestamp: report.timestamp,
        context: report.context
      }));

    return insights;
  }

  /**
   * Clear analytics data
   */
  async clearAnalytics(): Promise<void> {
    try {
      // Clear in-memory data
      this.events = [];
      this.performanceMetrics = [];
      this.errorReports = [];
      this.usagePatterns.clear();

      // Clear stored data
      await this.storageManager.remove('analytics_events');
      await this.storageManager.remove('performance_metrics');
      await this.storageManager.remove('error_reports');
      await this.storageManager.remove('usage_patterns');

      console.log('🗑️ Analytics data cleared');
    } catch (error) {
      console.error('❌ Error clearing analytics:', error);
      throw error;
    }
  }

  /**
   * Export analytics data
   */
  async exportAnalytics(): Promise<Record<string, any>> {
    try {
      const summary = await this.getAnalyticsSummary();
      const performanceInsights = this.getPerformanceInsights();
      const errorInsights = this.getErrorInsights();

      return {
        summary,
        performanceInsights,
        errorInsights,
        exportedAt: new Date().toISOString(),
        sessionId: this.sessionId
      };
    } catch (error) {
      console.error('❌ Error exporting analytics:', error);
      throw error;
    }
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    try {
      // Track session end
      await this.trackEvent('session_end', {
        sessionDuration: Date.now() - this.sessionStartTime
      });

      // Flush remaining data
      await this.flushAll();

      // Clear timer
      if (this.flushTimer) {
        clearInterval(this.flushTimer);
      }

      console.log('📊 Analytics monitor shutdown completed');
    } catch (error) {
      console.error('❌ Error during analytics shutdown:', error);
    }
  }

  /**
   * Private methods
   */

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(async () => {
      await this.flushAll();
    }, this.FLUSH_INTERVAL) as unknown as number;
  }

  private async flushAll(): Promise<void> {
    await Promise.all([
      this.flushEvents(),
      this.flushPerformanceMetrics(),
      this.flushErrorReports(),
      this.flushUsagePatterns()
    ]);
  }

  private async flushEvents(): Promise<void> {
    if (this.events.length === 0) return;

    try {
      // Load existing events
      const existingResult = await this.storageManager.retrieve<AnalyticsEvent[]>('analytics_events');
      const existingEvents = existingResult.success ? existingResult.data || [] : [];

      // Merge and limit
      const allEvents = [...existingEvents, ...this.events];
      const limitedEvents = allEvents.slice(-this.MAX_STORED_EVENTS);

      // Store
      await this.storageManager.store('analytics_events', limitedEvents);

      // Clear memory
      this.events = [];

      console.log(`💾 Flushed ${allEvents.length - existingEvents.length} events to storage`);
    } catch (error) {
      console.error('❌ Error flushing events:', error);
    }
  }

  private async flushPerformanceMetrics(): Promise<void> {
    if (this.performanceMetrics.length === 0) return;

    try {
      const existingResult = await this.storageManager.retrieve<PerformanceMetric[]>('performance_metrics');
      const existingMetrics = existingResult.success ? existingResult.data || [] : [];

      const allMetrics = [...existingMetrics, ...this.performanceMetrics];
      const limitedMetrics = allMetrics.slice(-this.MAX_PERFORMANCE_METRICS);

      await this.storageManager.store('performance_metrics', limitedMetrics);
      this.performanceMetrics = [];

      console.log(`💾 Flushed ${allMetrics.length - existingMetrics.length} performance metrics to storage`);
    } catch (error) {
      console.error('❌ Error flushing performance metrics:', error);
    }
  }

  private async flushErrorReports(): Promise<void> {
    if (this.errorReports.length === 0) return;

    try {
      const existingResult = await this.storageManager.retrieve<ErrorReport[]>('error_reports');
      const existingReports = existingResult.success ? existingResult.data || [] : [];

      const allReports = [...existingReports, ...this.errorReports];
      const limitedReports = allReports.slice(-this.MAX_ERROR_REPORTS);

      await this.storageManager.store('error_reports', limitedReports);
      this.errorReports = [];

      console.log(`💾 Flushed ${allReports.length - existingReports.length} error reports to storage`);
    } catch (error) {
      console.error('❌ Error flushing error reports:', error);
    }
  }

  private async flushUsagePatterns(): Promise<void> {
    if (this.usagePatterns.size === 0) return;

    try {
      const patternsObject = Object.fromEntries(this.usagePatterns);
      await this.storageManager.store('usage_patterns', patternsObject);

      console.log(`💾 Flushed ${this.usagePatterns.size} usage patterns to storage`);
    } catch (error) {
      console.error('❌ Error flushing usage patterns:', error);
    }
  }

  private updateUsagePattern(eventType: string): void {
    const existing = this.usagePatterns.get(eventType);
    
    if (existing) {
      existing.usageCount++;
      existing.lastUsed = Date.now();
    } else {
      this.usagePatterns.set(eventType, {
        feature: eventType,
        usageCount: 1,
        lastUsed: Date.now()
      });
    }
  }

  private calculateSessionDurations(events: AnalyticsEvent[]): number[] {
    const sessionStarts = new Map<string, number>();
    const sessionEnds = new Map<string, number>();

    events.forEach(event => {
      if (event.type === 'session_start') {
        sessionStarts.set(event.sessionId, event.timestamp);
      } else if (event.type === 'session_end') {
        sessionEnds.set(event.sessionId, event.timestamp);
      }
    });

    const durations: number[] = [];
    sessionStarts.forEach((startTime, sessionId) => {
      const endTime = sessionEnds.get(sessionId);
      if (endTime) {
        durations.push(endTime - startTime);
      }
    });

    return durations;
  }

  private categorizeError(errorMessage: string): string {
    if (errorMessage.includes('storage') || errorMessage.includes('Storage')) {
      return 'storage_error';
    } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      return 'network_error';
    } else if (errorMessage.includes('parsing') || errorMessage.includes('JSON')) {
      return 'parsing_error';
    } else if (errorMessage.includes('permission') || errorMessage.includes('Permission')) {
      return 'permission_error';
    } else if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
      return 'timeout_error';
    } else {
      return 'unknown_error';
    }
  }
}