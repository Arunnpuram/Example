/**
 * Content script entry point for Skill Gap Analyzer Chrome Extension
 * 
 * This script runs on job site pages to extract job information
 * and provide skill gap analysis functionality.
 */

import { PerformanceMonitor, PerformanceErrorBoundary } from '@/utils/performance';
import { JobPageInfo, ApiResponse, SkillGapAnalysis } from '@/core/types';
import { ChromeAnalyticsClient, PerformanceTracker, ErrorTracker } from '@/utils/analytics-client';
import { JobPageDetector } from './job-detector';
import { JobContentExtractor } from './job-extractor';
import { AnalysisWorkflowManager, AnalysisProgress } from './analysis-workflow';

console.log('🔍 Skill Gap Analyzer content script loaded on:', window.location.href);

// Global state
let detector: any = null;
let extractor: any = null;
let workflowManager: any = null;
let currentJobInfo: JobPageInfo | null = null;
let isInitialized = false;
let initializationPromise: Promise<void> | null = null;

// Analytics utilities
const analyticsClient = ChromeAnalyticsClient.getInstance();
const performanceTracker = new PerformanceTracker(analyticsClient);
const errorTracker = new ErrorTracker(analyticsClient);

/**
 * Initialize content script based on document ready state
 */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  // Use setTimeout to ensure DOM is fully ready
  setTimeout(initialize, 100);
}

/**
 * Main initialization function with error handling and retry logic
 */
async function initialize(): Promise<void> {
  // Prevent multiple initialization attempts
  if (isInitialized || initializationPromise) {
    return initializationPromise || Promise.resolve();
  }

  initializationPromise = performInitialization();
  return initializationPromise;
}

/**
 * Perform the actual initialization with performance optimization
 */
async function performInitialization(): Promise<void> {
  console.log('🚀 Content script initializing on:', window.location.href);
  
  const result: void | null = await PerformanceErrorBoundary.executeWithBoundary(
    'content_script_initialization',
    async () => {
      // Track initialization performance
      PerformanceMonitor.startMeasurement('content_script_init');
      performanceTracker.start('content_script_initialization');
      
      // Track initialization event
      await analyticsClient.trackEvent('content_script_initializing', {
        url: window.location.href,
        userAgent: navigator.userAgent
      });
      
      // Initialize modules directly (no dynamic imports)
      
      // Initialize detector and extractor
      detector = new JobPageDetector();
      extractor = new JobContentExtractor();
      
      // Initialize detector
      detector.initialize();
      
      // Initialize workflow manager
      workflowManager = AnalysisWorkflowManager.getInstance(detector, extractor);
      
      // Set up progress monitoring
      setupProgressMonitoring();
      
      // Check if current page is a job posting
      currentJobInfo = detector.detectCurrentPage();
      
      if (currentJobInfo) {
        console.log('🎯 Job page detected:', currentJobInfo);
        await analyticsClient.trackEvent('job_page_detected', {
          site: currentJobInfo.site,
          title: currentJobInfo.title,
          company: currentJobInfo.company,
          url: currentJobInfo.url
        });
        
        // Lazy load and handle job page detection
        await handleJobPageDetected(currentJobInfo);
      } else {
        console.log('ℹ️ Not on a job posting page');
        await analyticsClient.trackEvent('non_job_page_visited', {
          url: window.location.href
        });
      }
      
      // Set up event listeners for navigation changes
      setupNavigationListeners();
      
      // Notify background script of successful initialization
      await notifyBackgroundScript('CONTENT_SCRIPT_READY', {
        url: window.location.href,
        isJobPage: !!currentJobInfo,
        jobInfo: currentJobInfo
      });
      
      // Track successful initialization
      const initDuration = PerformanceMonitor.endMeasurement('content_script_init');
      await performanceTracker.end('content_script_initialization', {
        isJobPage: !!currentJobInfo,
        site: currentJobInfo?.site,
        initDuration
      });
      
      await analyticsClient.trackEvent('content_script_initialized', {
        url: window.location.href,
        isJobPage: !!currentJobInfo,
        site: currentJobInfo?.site,
        initDuration
      });
      
      isInitialized = true;
      console.log('✅ Content script initialization complete');
    },
    () => {
      // Fallback initialization
      console.warn('⚠️ Using fallback initialization');
      isInitialized = false;
      // Retry initialization after a delay
      setTimeout(() => {
        initializationPromise = null;
        initialize();
      }, 2000);
    }
  );
  
  if (result === null) {
    throw new Error('Content script initialization failed');
  }
}

/**
 * Handle job page detection
 */
async function handleJobPageDetected(jobInfo: JobPageInfo): Promise<void> {
  console.log('🔍 Processing job page:', jobInfo.title);
  
  try {
    // Track job processing start
    performanceTracker.start('job_page_processing');
    
    await analyticsClient.trackEvent('job_processing_started', {
      site: jobInfo.site,
      title: jobInfo.title,
      company: jobInfo.company
    });
    
    // Start real-time analysis workflow
    if (workflowManager) {
      const analysis: SkillGapAnalysis | null = await performanceTracker.measure(
        'job_analysis_workflow',
        () => workflowManager!.analyzeCurrentJob(),
        {
          site: jobInfo.site,
          title: jobInfo.title,
          company: jobInfo.company
        }
      );
      
      if (analysis) {
        console.log('✅ Job analysis completed');
        
        // Track successful analysis
        await performanceTracker.end('job_page_processing', {
          success: true,
          matchScore: analysis.overallMatch || 0,
          skillsFound: analysis.matchingSkills?.length || 0,
          skillsMissing: analysis.missingSkills?.length || 0
        });
        
        await analyticsClient.trackEvent('job_analysis_success', {
          site: jobInfo.site,
          title: jobInfo.title,
          company: jobInfo.company,
          matchScore: analysis.overallMatch || 0,
          skillsMatched: analysis.matchingSkills?.length || 0,
          skillsMissing: analysis.missingSkills?.length || 0
        });
        
        // Notify background script about the completed analysis
        await notifyBackgroundScript('JOB_ANALYSIS_COMPLETE', {
          jobInfo,
          analysis
        });
      } else {
        console.warn('⚠️ Job analysis failed or returned no results');
        
        await analyticsClient.trackEvent('job_analysis_failed', {
          site: jobInfo.site,
          title: jobInfo.title,
          company: jobInfo.company,
          reason: 'no_results'
        });
      }
    } else {
      console.error('❌ Workflow manager not initialized');
      
      await analyticsClient.trackEvent('job_analysis_failed', {
        site: jobInfo.site,
        title: jobInfo.title,
        company: jobInfo.company,
        reason: 'workflow_manager_not_initialized'
      });
    }
    
  } catch (error) {
    console.error('❌ Error processing job page:', error);
    
    // Track error
    await errorTracker.trackError(error as Error, 'job_page_processing', {
      site: jobInfo.site,
      title: jobInfo.title,
      company: jobInfo.company
    });
    
    // Notify background script of the error
    await notifyBackgroundScript('JOB_ANALYSIS_ERROR', {
      error: error instanceof Error ? error.message : 'Unknown error',
      url: window.location.href
    });
  }
}

/**
 * Set up navigation listeners for SPA changes
 */
function setupNavigationListeners(): void {
  console.log('👀 Setting up navigation listeners');
  
  // Listen for job page detection events from the detector
  window.addEventListener('jobPageDetected', async (event: Event) => {
    const customEvent = event as CustomEvent;
    const jobInfo = customEvent.detail as JobPageInfo;
    currentJobInfo = jobInfo;
    console.log('🎯 Navigation detected - new job page:', jobInfo.title);
    
    // Track navigation to job page
    await analyticsClient.trackEvent('job_page_navigation', {
      site: jobInfo.site,
      title: jobInfo.title,
      company: jobInfo.company,
      navigationType: 'spa_navigation'
    });
    
    await handleJobPageDetected(jobInfo);
  });
  
  // Listen for leaving job pages
  window.addEventListener('jobPageLeft', async () => {
    const previousJobInfo = currentJobInfo;
    currentJobInfo = null;
    console.log('👋 Left job page');
    
    // Track leaving job page
    if (previousJobInfo) {
      await analyticsClient.trackEvent('job_page_left', {
        site: previousJobInfo.site,
        title: previousJobInfo.title,
        company: previousJobInfo.company
      });
    }
    
    // Notify background script
    notifyBackgroundScript('JOB_PAGE_LEFT', {
      url: window.location.href
    });
  });
}

/**
 * Set up progress monitoring for analysis workflow
 */
function setupProgressMonitoring(): void {
  if (!workflowManager) return;
  
  workflowManager.onProgress((progress: AnalysisProgress) => {
    console.log(`📊 Analysis Progress: ${progress.stage} (${progress.progress}%) - ${progress.message}`);
    
    // Notify background script of progress updates
    notifyBackgroundScript('ANALYSIS_PROGRESS', {
      progress,
      url: window.location.href
    });
  });
}

/**
 * Safely notify background script with error handling
 */
async function notifyBackgroundScript(type: string, data: any): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({
      type,
      data,
      timestamp: Date.now()
    });
    
    if (!response?.success) {
      console.warn('⚠️ Background script notification failed:', response?.error);
    }
  } catch (error) {
    // Handle extension context invalidation gracefully
    if (error instanceof Error && error.message?.includes('Extension context invalidated')) {
      console.warn('⚠️ Extension context invalidated - please reload the page');
      return;
    }
    console.error('❌ Failed to communicate with background script:', error);
  }
}

/**
 * Handle messages from background script or popup
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('📨 Content script received message:', message);
  
  // Ensure content script is initialized before handling messages
  if (!isInitialized && message.type !== 'PING') {
    initialize().then(() => {
      handleMessage(message, sendResponse);
    }).catch((error) => {
      console.error('❌ Failed to initialize before handling message:', error);
      sendResponse({ 
        success: false, 
        error: 'Content script initialization failed' 
      });
    });
    return true; // Keep message channel open for async response
  }
  
  handleMessage(message, sendResponse);
  return true; // Keep message channel open for async response
});

/**
 * Handle individual messages with proper error handling
 */
function handleMessage(message: any, sendResponse: (response: ApiResponse<any>) => void): void {
  try {
    switch (message.type) {
      case 'PING':
        sendResponse({
          success: true,
          data: { status: 'alive', initialized: isInitialized },
          timestamp: Date.now()
        });
        break;
        
      case 'GET_PAGE_INFO':
        sendResponse({
          success: true,
          data: {
            url: window.location.href,
            isJobPage: !!currentJobInfo,
            jobInfo: currentJobInfo,
            initialized: isInitialized
          },
          timestamp: Date.now()
        });
        break;
        
      case 'EXTRACT_JOB_CONTENT':
        handleExtractJobContent(sendResponse);
        break;
        
      case 'FORCE_REDETECT':
        handleForceRedetect(sendResponse);
        break;
        
      case 'GET_EXTRACTION_STATUS':
        sendResponse({
          success: true,
          data: {
            hasJobInfo: !!currentJobInfo,
            canExtract: !!currentJobInfo && !!extractor,
            canAnalyze: !!currentJobInfo && !!workflowManager,
            isAnalyzing: workflowManager?.isAnalyzing() || false,
            cacheStats: workflowManager?.getCacheStats(),
            lastDetection: currentJobInfo ? new Date().toISOString() : null
          },
          timestamp: Date.now()
        });
        break;
        
      case 'START_ANALYSIS':
        handleStartAnalysis(message.data, sendResponse);
        break;
        
      case 'GET_ANALYSIS_STATUS':
        sendResponse({
          success: true,
          data: {
            isAnalyzing: workflowManager?.isAnalyzing() || false,
            hasJobInfo: !!currentJobInfo,
            cacheStats: workflowManager?.getCacheStats()
          },
          timestamp: Date.now()
        });
        break;
        
      case 'CLEAR_ANALYSIS_CACHE':
        handleClearCache(sendResponse);
        break;
        
      default:
        console.warn('⚠️ Unknown message type:', message.type);
        sendResponse({ 
          success: false, 
          error: `Unknown message type: ${message.type}`,
          timestamp: Date.now()
        });
    }
  } catch (error) {
    console.error('❌ Error handling message:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now()
    });
  }
}

/**
 * Handle job content extraction request
 */
async function handleExtractJobContent(sendResponse: (response: ApiResponse<any>) => void): Promise<void> {
  try {
    if (!currentJobInfo) {
      sendResponse({
        success: false,
        error: 'No job page detected',
        timestamp: Date.now()
      });
      return;
    }
    
    if (!extractor) {
      sendResponse({
        success: false,
        error: 'Job extractor not initialized',
        timestamp: Date.now()
      });
      return;
    }
    
    const jobContent = extractor.extractJobContent(currentJobInfo);
    
    if (!jobContent || !extractor.validateJobContent(jobContent)) {
      sendResponse({
        success: false,
        error: 'Failed to extract valid job content',
        timestamp: Date.now()
      });
      return;
    }
    
    const structuredInfo = extractor.extractStructuredInfo(jobContent);
    
    sendResponse({
      success: true,
      data: {
        jobContent,
        structuredInfo,
        jobInfo: currentJobInfo
      },
      timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('❌ Error extracting job content:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Extraction failed',
      timestamp: Date.now()
    });
  }
}

/**
 * Handle force re-detection request
 */
async function handleForceRedetect(sendResponse: (response: ApiResponse<any>) => void): Promise<void> {
  try {
    if (!detector) {
      sendResponse({
        success: false,
        error: 'Detector not initialized',
        timestamp: Date.now()
      });
      return;
    }
    
    // Force re-detection
    const newJobInfo = detector.detectCurrentPage();
    
    if (newJobInfo) {
      currentJobInfo = newJobInfo;
      await handleJobPageDetected(newJobInfo);
      
      sendResponse({
        success: true,
        data: {
          jobInfo: newJobInfo,
          message: 'Re-detection successful'
        },
        timestamp: Date.now()
      });
    } else {
      currentJobInfo = null;
      sendResponse({
        success: true,
        data: {
          jobInfo: null,
          message: 'No job page detected'
        },
        timestamp: Date.now()
      });
    }
    
  } catch (error) {
    console.error('❌ Error during force re-detection:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Re-detection failed',
      timestamp: Date.now()
    });
  }
}

/**
 * Handle start analysis request
 */
async function handleStartAnalysis(data: any, sendResponse: (response: ApiResponse<any>) => void): Promise<void> {
  try {
    if (!workflowManager) {
      sendResponse({
        success: false,
        error: 'Analysis workflow not initialized',
        timestamp: Date.now()
      });
      return;
    }
    
    if (!currentJobInfo) {
      sendResponse({
        success: false,
        error: 'No job page detected',
        timestamp: Date.now()
      });
      return;
    }
    
    const forceRefresh = data?.forceRefresh || false;
    const analysis = await workflowManager.analyzeCurrentJob(forceRefresh);
    
    if (analysis) {
      sendResponse({
        success: true,
        data: {
          analysis,
          jobInfo: currentJobInfo,
          fromCache: !forceRefresh
        },
        timestamp: Date.now()
      });
    } else {
      sendResponse({
        success: false,
        error: 'Analysis failed to complete',
        timestamp: Date.now()
      });
    }
    
  } catch (error) {
    console.error('❌ Error starting analysis:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Analysis failed',
      timestamp: Date.now()
    });
  }
}

/**
 * Handle clear cache request
 */
function handleClearCache(sendResponse: (response: ApiResponse<any>) => void): void {
  try {
    if (workflowManager) {
      workflowManager.clearCache();
      sendResponse({
        success: true,
        data: { message: 'Analysis cache cleared' },
        timestamp: Date.now()
      });
    } else {
      sendResponse({
        success: false,
        error: 'Workflow manager not initialized',
        timestamp: Date.now()
      });
    }
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to clear cache',
      timestamp: Date.now()
    });
  }
}

/**
 * Cleanup function for when the content script is unloaded
 */
window.addEventListener('beforeunload', () => {
  if (detector) {
    detector.destroy();
  }
  if (workflowManager) {
    workflowManager.destroy();
  }
});

// Export empty object to make this a module
export {};