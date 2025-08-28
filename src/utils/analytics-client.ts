/**
 * Analytics client utility for content scripts and popup
 * Provides easy interface to send analytics data to background script
 */

export interface AnalyticsClient {
  trackEvent(type: string, data?: Record<string, any>): Promise<void>;
  trackPerformance(name: string, value: number, context?: Record<string, any>): Promise<void>;
  trackError(error: Error | string, context?: Record<string, any>): Promise<void>;
  getAnalyticsSummary(): Promise<any>;
  getPerformanceInsights(): Promise<any>;
  clearAnalytics(): Promise<void>;
  exportAnalytics(): Promise<any>;
}

/**
 * Analytics client implementation for Chrome extension
 */
export class ChromeAnalyticsClient implements AnalyticsClient {
  private static instance: ChromeAnalyticsClient | null = null;

  public static getInstance(): ChromeAnalyticsClient {
    if (!ChromeAnalyticsClient.instance) {
      ChromeAnalyticsClient.instance = new ChromeAnalyticsClient();
    }
    return ChromeAnalyticsClient.instance;
  }

  /**
   * Helper method to handle chrome.runtime.sendMessage with context invalidation handling
   */
  private async sendMessage(message: any): Promise<any> {
    try {
      return await chrome.runtime.sendMessage(message);
    } catch (error) {
      // Handle extension context invalidation gracefully
      if (error instanceof Error && error.message?.includes('Extension context invalidated')) {
        return { success: false, error: 'Extension context invalidated' };
      }
      throw error;
    }
  }

  /**
   * Track an analytics event
   */
  async trackEvent(type: string, data?: Record<string, any>): Promise<void> {
    try {
      const response = await this.sendMessage({
        type: 'TRACK_EVENT',
        data: { type, data },
        timestamp: Date.now()
      });

      if (!response?.success) {
        // Silently ignore context invalidation errors
        if (response?.error !== 'Extension context invalidated') {
          console.warn('⚠️ Failed to track event:', response?.error);
        }
      }
    } catch (error) {
      console.error('❌ Error tracking event:', error);
    }
  }

  /**
   * Track a performance metric
   */
  async trackPerformance(name: string, value: number, context?: Record<string, any>): Promise<void> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'TRACK_PERFORMANCE',
        data: { name, value, context },
        timestamp: Date.now()
      });

      if (!response?.success) {
        console.warn('⚠️ Failed to track performance:', response?.error);
      }
    } catch (error) {
      console.error('❌ Error tracking performance:', error);
    }
  }

  /**
   * Track an error
   */
  async trackError(error: Error | string, context?: Record<string, any>): Promise<void> {
    try {
      const errorData = error instanceof Error ? error.message : error;
      
      const response = await chrome.runtime.sendMessage({
        type: 'TRACK_ERROR',
        data: { error: errorData, context },
        timestamp: Date.now()
      });

      if (!response?.success) {
        console.warn('⚠️ Failed to track error:', response?.error);
      }
    } catch (trackingError) {
      console.error('❌ Error tracking error:', trackingError);
    }
  }

  /**
   * Get analytics summary
   */
  async getAnalyticsSummary(): Promise<any> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_ANALYTICS_SUMMARY',
        timestamp: Date.now()
      });

      if (response?.success) {
        return response.data;
      } else {
        throw new Error(response?.error || 'Failed to get analytics summary');
      }
    } catch (error) {
      console.error('❌ Error getting analytics summary:', error);
      throw error;
    }
  }

  /**
   * Get performance insights
   */
  async getPerformanceInsights(): Promise<any> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_PERFORMANCE_INSIGHTS',
        timestamp: Date.now()
      });

      if (response?.success) {
        return response.data;
      } else {
        throw new Error(response?.error || 'Failed to get performance insights');
      }
    } catch (error) {
      console.error('❌ Error getting performance insights:', error);
      throw error;
    }
  }

  /**
   * Clear analytics data
   */
  async clearAnalytics(): Promise<void> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'CLEAR_ANALYTICS',
        timestamp: Date.now()
      });

      if (!response?.success) {
        throw new Error(response?.error || 'Failed to clear analytics');
      }
    } catch (error) {
      console.error('❌ Error clearing analytics:', error);
      throw error;
    }
  }

  /**
   * Export analytics data
   */
  async exportAnalytics(): Promise<any> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'EXPORT_ANALYTICS',
        timestamp: Date.now()
      });

      if (response?.success) {
        return response.data;
      } else {
        throw new Error(response?.error || 'Failed to export analytics');
      }
    } catch (error) {
      console.error('❌ Error exporting analytics:', error);
      throw error;
    }
  }
}

/**
 * Performance measurement utility
 */
export class PerformanceTracker {
  private startTimes = new Map<string, number>();
  private analyticsClient: AnalyticsClient;
  private performanceNow: () => number;

  constructor(analyticsClient?: AnalyticsClient, performanceNow?: () => number) {
    this.analyticsClient = analyticsClient || ChromeAnalyticsClient.getInstance();
    this.performanceNow = performanceNow || (() => performance.now());
  }

  /**
   * Start measuring performance for an operation
   */
  start(operationName: string): void {
    this.startTimes.set(operationName, this.performanceNow());
  }

  /**
   * End measurement and track the performance metric
   */
  async end(operationName: string, context?: Record<string, any>): Promise<number> {
    const startTime = this.startTimes.get(operationName);
    
    if (startTime === undefined) {
      console.warn(`⚠️ No start time found for operation: ${operationName}`);
      const duration = 0;
      // Still track the metric even if no start time
      await this.analyticsClient.trackPerformance(operationName, duration, context);
      return duration;
    }

    const duration = this.performanceNow() - startTime;
    this.startTimes.delete(operationName);

    // Track the performance metric
    await this.analyticsClient.trackPerformance(operationName, duration, context);

    return duration;
  }

  /**
   * Measure and track an async operation
   */
  async measure<T>(
    operationName: string, 
    operation: () => Promise<T>, 
    context?: Record<string, any>
  ): Promise<T> {
    this.start(operationName);
    
    try {
      const result = await operation();
      await this.end(operationName, context);
      return result;
    } catch (error) {
      await this.end(operationName, { ...context, error: true });
      throw error;
    }
  }

  /**
   * Measure and track a synchronous operation
   */
  async measureSync<T>(
    operationName: string, 
    operation: () => T, 
    context?: Record<string, any>
  ): Promise<T> {
    this.start(operationName);
    
    try {
      const result = operation();
      await this.end(operationName, context);
      return result;
    } catch (error) {
      await this.end(operationName, { ...context, error: true });
      throw error;
    }
  }
}

/**
 * Error tracking utility with context
 */
export class ErrorTracker {
  private analyticsClient: AnalyticsClient;

  constructor(analyticsClient?: AnalyticsClient) {
    this.analyticsClient = analyticsClient || ChromeAnalyticsClient.getInstance();
  }

  /**
   * Track an error with automatic context collection
   */
  async trackError(
    error: Error | string, 
    operation?: string, 
    additionalContext?: Record<string, any>
  ): Promise<void> {
    const context = {
      operation,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      ...additionalContext
    };

    await this.analyticsClient.trackError(error, context);
  }

  /**
   * Wrap an async function with error tracking
   */
  wrapAsync<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    operationName: string
  ): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
      try {
        return await fn(...args);
      } catch (error) {
        await this.trackError(error as Error, operationName, {
          arguments: args.length
        });
        throw error;
      }
    };
  }

  /**
   * Wrap a sync function with error tracking
   */
  wrapSync<T extends any[], R>(
    fn: (...args: T) => R,
    operationName: string
  ): (...args: T) => R {
    return (...args: T): R => {
      try {
        return fn(...args);
      } catch (error) {
        // Track error asynchronously without blocking
        this.trackError(error as Error, operationName, {
          arguments: args.length
        }).catch(console.error);
        throw error;
      }
    };
  }
}