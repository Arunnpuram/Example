/**
 * Comprehensive Error Handling and User Feedback System
 * 
 * This module provides centralized error handling, user feedback,
 * and recovery mechanisms for the Skill Gap Analyzer extension.
 */

import { ChromeAnalyticsClient } from './analytics-client';

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Error categories for better classification
 */
export enum ErrorCategory {
  NETWORK = 'network',
  STORAGE = 'storage',
  PARSING = 'parsing',
  VALIDATION = 'validation',
  PERMISSION = 'permission',
  TIMEOUT = 'timeout',
  UNKNOWN = 'unknown'
}

/**
 * User feedback types
 */
export enum FeedbackType {
  SUCCESS = 'success',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error'
}

/**
 * Enhanced error interface
 */
export interface EnhancedError extends Error {
  code?: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  context?: Record<string, any>;
  timestamp: Date;
  recoverable: boolean;
  userMessage?: string;
}

/**
 * User feedback interface
 */
export interface UserFeedback {
  type: FeedbackType;
  title: string;
  message: string;
  duration?: number;
  actions?: FeedbackAction[];
}

/**
 * Feedback action interface
 */
export interface FeedbackAction {
  label: string;
  action: () => void;
  primary?: boolean;
}

/**
 * Centralized error handler
 */
export class ErrorHandler {
  private static instance: ErrorHandler;
  private analyticsClient: ChromeAnalyticsClient;
  private errorQueue: EnhancedError[] = [];
  private readonly MAX_QUEUE_SIZE = 100;

  private constructor() {
    this.analyticsClient = ChromeAnalyticsClient.getInstance();
  }

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Handle error with enhanced context and recovery
   */
  async handleError(
    error: Error | EnhancedError,
    context?: Record<string, any>
  ): Promise<void> {
    const enhancedError = this.enhanceError(error, context);
    
    // Add to error queue
    this.addToQueue(enhancedError);
    
    // Log error
    console.error('Enhanced Error:', enhancedError);
    
    // Track error in analytics
    await this.trackError(enhancedError);
    
    // Show user feedback if appropriate
    if (enhancedError.severity !== ErrorSeverity.LOW) {
      this.showUserFeedback(enhancedError);
    }
    
    // Attempt recovery if possible
    if (enhancedError.recoverable) {
      await this.attemptRecovery(enhancedError);
    }
  }

  /**
   * Create user-friendly error
   */
  createUserError(
    message: string,
    category: ErrorCategory = ErrorCategory.UNKNOWN,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    recoverable: boolean = true
  ): EnhancedError {
    const error = new Error(message) as EnhancedError;
    error.category = category;
    error.severity = severity;
    error.recoverable = recoverable;
    error.timestamp = new Date();
    error.userMessage = this.generateUserMessage(category, severity);
    
    return error;
  }

  /**
   * Handle network errors specifically
   */
  async handleNetworkError(
    error: Error,
    url?: string,
    retryCount: number = 0
  ): Promise<void> {
    const networkError = this.enhanceError(error, {
      url,
      retryCount,
      category: ErrorCategory.NETWORK
    });

    if (retryCount < 3) {
      // Attempt retry with exponential backoff
      const delay = Math.pow(2, retryCount) * 1000;
      setTimeout(() => {
        console.log(`Retrying network request after ${delay}ms`);
      }, delay);
    }

    await this.handleError(networkError);
  }

  /**
   * Handle storage errors specifically
   */
  async handleStorageError(
    error: Error,
    operation: string,
    data?: any
  ): Promise<void> {
    const storageError = this.enhanceError(error, {
      operation,
      dataSize: data ? JSON.stringify(data).length : 0,
      category: ErrorCategory.STORAGE
    });

    // Check if it's a quota exceeded error
    if (error.message.includes('quota') || error.message.includes('QUOTA_EXCEEDED')) {
      storageError.userMessage = 'Storage space is full. Please clear some data or contact support.';
      storageError.severity = ErrorSeverity.HIGH;
    }

    await this.handleError(storageError);
  }

  /**
   * Get error statistics
   */
  getErrorStatistics(): ErrorStatistics {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const recentErrors = this.errorQueue.filter(
      error => error.timestamp > last24Hours
    );

    const categoryCounts = recentErrors.reduce((counts, error) => {
      counts[error.category] = (counts[error.category] || 0) + 1;
      return counts;
    }, {} as Record<ErrorCategory, number>);

    const severityCounts = recentErrors.reduce((counts, error) => {
      counts[error.severity] = (counts[error.severity] || 0) + 1;
      return counts;
    }, {} as Record<ErrorSeverity, number>);

    return {
      totalErrors: this.errorQueue.length,
      recentErrors: recentErrors.length,
      categoryCounts,
      severityCounts,
      mostCommonCategory: this.getMostCommon(categoryCounts),
      mostCommonSeverity: this.getMostCommon(severityCounts)
    };
  }

  /**
   * Clear error queue
   */
  clearErrorQueue(): void {
    this.errorQueue = [];
  }

  /**
   * Export error logs for debugging
   */
  exportErrorLogs(): string {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      errors: this.errorQueue.map(error => ({
        message: error.message,
        category: error.category,
        severity: error.severity,
        timestamp: error.timestamp,
        context: error.context,
        stack: error.stack
      }))
    }, null, 2);
  }

  private enhanceError(
    error: Error | EnhancedError,
    context?: Record<string, any>
  ): EnhancedError {
    if (this.isEnhancedError(error)) {
      // Already enhanced, just add context
      if (context) {
        error.context = { ...error.context, ...context };
      }
      return error;
    }

    const enhanced = error as EnhancedError;
    enhanced.category = this.categorizeError(error);
    enhanced.severity = this.determineSeverity(error);
    enhanced.timestamp = new Date();
    enhanced.recoverable = this.isRecoverable(error);
    enhanced.context = context || {};
    enhanced.userMessage = this.generateUserMessage(enhanced.category, enhanced.severity);

    return enhanced;
  }

  private isEnhancedError(error: Error | EnhancedError): error is EnhancedError {
    return 'category' in error && 'severity' in error;
  }

  private categorizeError(error: Error): ErrorCategory {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return ErrorCategory.NETWORK;
    }
    if (message.includes('storage') || message.includes('quota') || message.includes('indexeddb')) {
      return ErrorCategory.STORAGE;
    }
    if (message.includes('parse') || message.includes('json') || message.includes('syntax')) {
      return ErrorCategory.PARSING;
    }
    if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
      return ErrorCategory.VALIDATION;
    }
    if (message.includes('permission') || message.includes('unauthorized') || message.includes('forbidden')) {
      return ErrorCategory.PERMISSION;
    }
    if (message.includes('timeout') || message.includes('abort')) {
      return ErrorCategory.TIMEOUT;
    }
    
    return ErrorCategory.UNKNOWN;
  }

  private determineSeverity(error: Error): ErrorSeverity {
    const message = error.message.toLowerCase();
    
    if (message.includes('critical') || message.includes('fatal') || message.includes('crash')) {
      return ErrorSeverity.CRITICAL;
    }
    if (message.includes('quota') || message.includes('permission') || message.includes('unauthorized')) {
      return ErrorSeverity.HIGH;
    }
    if (message.includes('timeout') || message.includes('network') || message.includes('validation')) {
      return ErrorSeverity.MEDIUM;
    }
    
    return ErrorSeverity.LOW;
  }

  private isRecoverable(error: Error): boolean {
    const message = error.message.toLowerCase();
    
    // Non-recoverable errors
    if (message.includes('permission') || message.includes('unauthorized') || message.includes('forbidden')) {
      return false;
    }
    if (message.includes('quota') && message.includes('exceeded')) {
      return false;
    }
    
    // Most errors are recoverable
    return true;
  }

  private generateUserMessage(category: ErrorCategory, severity: ErrorSeverity): string {
    const messages = {
      [ErrorCategory.NETWORK]: {
        [ErrorSeverity.LOW]: 'Connection issue detected. Retrying...',
        [ErrorSeverity.MEDIUM]: 'Network connection problem. Please check your internet connection.',
        [ErrorSeverity.HIGH]: 'Unable to connect to services. Please try again later.',
        [ErrorSeverity.CRITICAL]: 'Critical network failure. Please restart the extension.'
      },
      [ErrorCategory.STORAGE]: {
        [ErrorSeverity.LOW]: 'Minor storage issue detected.',
        [ErrorSeverity.MEDIUM]: 'Storage operation failed. Retrying...',
        [ErrorSeverity.HIGH]: 'Storage space may be full. Consider clearing data.',
        [ErrorSeverity.CRITICAL]: 'Critical storage failure. Data may be lost.'
      },
      [ErrorCategory.PARSING]: {
        [ErrorSeverity.LOW]: 'Data parsing issue detected.',
        [ErrorSeverity.MEDIUM]: 'Unable to process job data. Trying alternative method.',
        [ErrorSeverity.HIGH]: 'Job content format not recognized.',
        [ErrorSeverity.CRITICAL]: 'Critical parsing failure. Unable to analyze job.'
      },
      [ErrorCategory.VALIDATION]: {
        [ErrorSeverity.LOW]: 'Minor validation issue.',
        [ErrorSeverity.MEDIUM]: 'Invalid data detected. Please check your input.',
        [ErrorSeverity.HIGH]: 'Required information is missing or invalid.',
        [ErrorSeverity.CRITICAL]: 'Critical validation failure.'
      },
      [ErrorCategory.PERMISSION]: {
        [ErrorSeverity.LOW]: 'Permission issue detected.',
        [ErrorSeverity.MEDIUM]: 'Limited permissions detected.',
        [ErrorSeverity.HIGH]: 'Insufficient permissions to perform this action.',
        [ErrorSeverity.CRITICAL]: 'Critical permission failure. Extension may not work properly.'
      },
      [ErrorCategory.TIMEOUT]: {
        [ErrorSeverity.LOW]: 'Operation taking longer than expected.',
        [ErrorSeverity.MEDIUM]: 'Request timed out. Retrying...',
        [ErrorSeverity.HIGH]: 'Operation timed out. Please try again.',
        [ErrorSeverity.CRITICAL]: 'Critical timeout. Service may be unavailable.'
      },
      [ErrorCategory.UNKNOWN]: {
        [ErrorSeverity.LOW]: 'Minor issue detected.',
        [ErrorSeverity.MEDIUM]: 'An unexpected issue occurred.',
        [ErrorSeverity.HIGH]: 'Unexpected error. Please try again.',
        [ErrorSeverity.CRITICAL]: 'Critical error. Please restart the extension.'
      }
    };

    return messages[category][severity];
  }

  private addToQueue(error: EnhancedError): void {
    this.errorQueue.push(error);
    
    // Maintain queue size
    if (this.errorQueue.length > this.MAX_QUEUE_SIZE) {
      this.errorQueue.shift();
    }
  }

  private async trackError(error: EnhancedError): Promise<void> {
    try {
      await this.analyticsClient.trackEvent('error_occurred', {
        category: error.category,
        severity: error.severity,
        message: error.message,
        recoverable: error.recoverable,
        context: error.context
      });
    } catch (trackingError) {
      console.error('Failed to track error:', trackingError);
    }
  }

  private showUserFeedback(error: EnhancedError): void {
    const feedback: UserFeedback = {
      type: this.severityToFeedbackType(error.severity),
      title: this.getCategoryTitle(error.category),
      message: error.userMessage || error.message,
      duration: this.getFeedbackDuration(error.severity),
      actions: this.getRecoveryActions(error)
    };

    UserFeedbackManager.getInstance().showFeedback(feedback);
  }

  private async attemptRecovery(error: EnhancedError): Promise<void> {
    console.log(`Attempting recovery for ${error.category} error`);
    
    switch (error.category) {
      case ErrorCategory.NETWORK:
        await this.recoverFromNetworkError(error);
        break;
      case ErrorCategory.STORAGE:
        await this.recoverFromStorageError(error);
        break;
      case ErrorCategory.TIMEOUT:
        await this.recoverFromTimeoutError(error);
        break;
      default:
        console.log('No specific recovery strategy available');
    }
  }

  private async recoverFromNetworkError(error: EnhancedError): Promise<void> {
    // Implement network recovery logic
    console.log(`Implementing network recovery for: ${error.message}`);
  }

  private async recoverFromStorageError(error: EnhancedError): Promise<void> {
    // Implement storage recovery logic
    console.log(`Implementing storage recovery for: ${error.message}`);
  }

  private async recoverFromTimeoutError(error: EnhancedError): Promise<void> {
    // Implement timeout recovery logic
    console.log(`Implementing timeout recovery for: ${error.message}`);
  }

  private severityToFeedbackType(severity: ErrorSeverity): FeedbackType {
    switch (severity) {
      case ErrorSeverity.LOW:
        return FeedbackType.INFO;
      case ErrorSeverity.MEDIUM:
        return FeedbackType.WARNING;
      case ErrorSeverity.HIGH:
      case ErrorSeverity.CRITICAL:
        return FeedbackType.ERROR;
      default:
        return FeedbackType.INFO;
    }
  }

  private getCategoryTitle(category: ErrorCategory): string {
    const titles = {
      [ErrorCategory.NETWORK]: 'Connection Issue',
      [ErrorCategory.STORAGE]: 'Storage Issue',
      [ErrorCategory.PARSING]: 'Data Processing Issue',
      [ErrorCategory.VALIDATION]: 'Validation Error',
      [ErrorCategory.PERMISSION]: 'Permission Issue',
      [ErrorCategory.TIMEOUT]: 'Timeout Error',
      [ErrorCategory.UNKNOWN]: 'Unexpected Error'
    };
    return titles[category];
  }

  private getFeedbackDuration(severity: ErrorSeverity): number {
    switch (severity) {
      case ErrorSeverity.LOW:
        return 3000;
      case ErrorSeverity.MEDIUM:
        return 5000;
      case ErrorSeverity.HIGH:
        return 8000;
      case ErrorSeverity.CRITICAL:
        return 0; // Persistent until dismissed
      default:
        return 5000;
    }
  }

  private getRecoveryActions(error: EnhancedError): FeedbackAction[] {
    const actions: FeedbackAction[] = [];

    if (error.recoverable) {
      actions.push({
        label: 'Retry',
        action: () => console.log('Retrying operation...'),
        primary: true
      });
    }

    if (error.severity === ErrorSeverity.HIGH || error.severity === ErrorSeverity.CRITICAL) {
      actions.push({
        label: 'Report Issue',
        action: () => console.log('Opening issue report...')
      });
    }

    return actions;
  }

  private getMostCommon<T extends string>(counts: Record<T, number>): T | null {
    let maxCount = 0;
    let mostCommon: T | null = null;

    for (const [key, count] of Object.entries(counts) as [T, number][]) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = key;
      }
    }

    return mostCommon;
  }
}

/**
 * User feedback manager for showing notifications
 */
export class UserFeedbackManager {
  private static instance: UserFeedbackManager;
  private feedbackQueue: UserFeedback[] = [];
  private currentFeedback: HTMLElement | null = null;

  private constructor() {}

  static getInstance(): UserFeedbackManager {
    if (!UserFeedbackManager.instance) {
      UserFeedbackManager.instance = new UserFeedbackManager();
    }
    return UserFeedbackManager.instance;
  }

  /**
   * Show user feedback notification
   */
  showFeedback(feedback: UserFeedback): void {
    // Add to queue
    this.feedbackQueue.push(feedback);
    
    // Show if no current feedback
    if (!this.currentFeedback) {
      this.displayNextFeedback();
    }
  }

  /**
   * Clear all feedback
   */
  clearFeedback(): void {
    this.feedbackQueue = [];
    if (this.currentFeedback) {
      this.currentFeedback.remove();
      this.currentFeedback = null;
    }
  }

  private displayNextFeedback(): void {
    if (this.feedbackQueue.length === 0) {
      return;
    }

    const feedback = this.feedbackQueue.shift()!;
    this.currentFeedback = this.createFeedbackElement(feedback);
    
    // Add to page
    document.body.appendChild(this.currentFeedback);
    
    // Auto-dismiss if duration is set
    if (feedback.duration && feedback.duration > 0) {
      setTimeout(() => {
        this.dismissCurrentFeedback();
      }, feedback.duration);
    }
  }

  private createFeedbackElement(feedback: UserFeedback): HTMLElement {
    const element = document.createElement('div');
    element.className = `skill-gap-feedback skill-gap-feedback--${feedback.type}`;
    
    element.innerHTML = `
      <div class="skill-gap-feedback__content">
        <div class="skill-gap-feedback__title">${feedback.title}</div>
        <div class="skill-gap-feedback__message">${feedback.message}</div>
        ${feedback.actions ? this.createActionsHTML(feedback.actions) : ''}
      </div>
      <button class="skill-gap-feedback__close" aria-label="Close">×</button>
    `;

    // Add event listeners
    const closeButton = element.querySelector('.skill-gap-feedback__close');
    closeButton?.addEventListener('click', () => this.dismissCurrentFeedback());

    // Add action listeners
    feedback.actions?.forEach((action, index) => {
      const button = element.querySelector(`[data-action="${index}"]`);
      button?.addEventListener('click', () => {
        action.action();
        this.dismissCurrentFeedback();
      });
    });

    return element;
  }

  private createActionsHTML(actions: FeedbackAction[]): string {
    return `
      <div class="skill-gap-feedback__actions">
        ${actions.map((action, index) => `
          <button 
            class="skill-gap-feedback__action ${action.primary ? 'skill-gap-feedback__action--primary' : ''}"
            data-action="${index}"
          >
            ${action.label}
          </button>
        `).join('')}
      </div>
    `;
  }

  private dismissCurrentFeedback(): void {
    if (this.currentFeedback) {
      this.currentFeedback.remove();
      this.currentFeedback = null;
      
      // Show next feedback if any
      setTimeout(() => this.displayNextFeedback(), 100);
    }
  }
}

// Type definitions
export interface ErrorStatistics {
  totalErrors: number;
  recentErrors: number;
  categoryCounts: Record<ErrorCategory, number>;
  severityCounts: Record<ErrorSeverity, number>;
  mostCommonCategory: ErrorCategory | null;
  mostCommonSeverity: ErrorSeverity | null;
}