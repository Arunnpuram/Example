/**
 * Background script entry point for Skill Gap Analyzer Chrome Extension
 * 
 * This service worker handles extension lifecycle events, storage management,
 * cross-tab communication, and data migration.
 */

import { StorageCoordinator } from './storage-coordinator';
import { AnalyticsMonitor } from './analytics-monitor';

console.log('🚀 Skill Gap Analyzer background script loaded');

// Initialize coordinators
let storageCoordinator: StorageCoordinator;
let analyticsMonitor: AnalyticsMonitor;

// Storage cleanup interval (run every 30 minutes)
const CLEANUP_INTERVAL = 30 * 60 * 1000;
let cleanupTimer: NodeJS.Timeout;

/**
 * Extension installation handler
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('📦 Extension installed/updated:', details.reason);
  
  try {
    // Initialize storage coordinator
    storageCoordinator = new StorageCoordinator();
    await storageCoordinator.initialize();
    
    // Initialize analytics monitor
    analyticsMonitor = new AnalyticsMonitor();
    await analyticsMonitor.initialize();
    
    // Handle different installation scenarios
    switch (details.reason) {
      case 'install':
        await storageCoordinator.handleFirstInstall();
        await analyticsMonitor.trackEvent('extension_installed', {
          version: chrome.runtime.getManifest().version,
          reason: details.reason
        });
        break;
      case 'update':
        await storageCoordinator.handleExtensionUpdate(details.previousVersion);
        await analyticsMonitor.trackEvent('extension_updated', {
          fromVersion: details.previousVersion,
          toVersion: chrome.runtime.getManifest().version
        });
        break;
      case 'chrome_update':
      case 'shared_module_update':
        console.log('🔄 Chrome/module update detected');
        await analyticsMonitor.trackEvent('browser_updated', {
          reason: details.reason
        });
        break;
    }
    
    // Start periodic cleanup
    startPeriodicCleanup();
    
  } catch (error) {
    console.error('❌ Error during extension initialization:', error);
    if (analyticsMonitor) {
      await analyticsMonitor.trackError(error as Error, {
        context: 'extension_initialization',
        reason: details.reason
      });
    }
  }
});

/**
 * Start periodic storage cleanup
 */
function startPeriodicCleanup(): void {
  // Clear any existing timer
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
  }
  
  // Start new cleanup timer
  cleanupTimer = setInterval(async () => {
    if (storageCoordinator) {
      await storageCoordinator.performStorageCleanup();
    }
  }, CLEANUP_INTERVAL);
  
  console.log('🧹 Periodic storage cleanup started');
}

/**
 * Tab management for cross-tab communication
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && storageCoordinator) {
    storageCoordinator.registerTab(tabId, tab.url);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (storageCoordinator) {
    storageCoordinator.removeTab(tabId);
  }
});

/**
 * Message handler for communication with content scripts and popup
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Message received:', message.type, 'from:', sender.tab?.url || 'popup');
  
  // Update tab activity if message is from a tab
  if (sender.tab?.id && storageCoordinator) {
    storageCoordinator.updateTabActivity(sender.tab.id);
  }
  
  // Handle different message types
  switch (message.type) {
    // Storage coordination messages
    case 'STORAGE_SYNC_REQUEST':
      handleStorageSyncRequest(message.data, sender, sendResponse);
      return true;
      
    case 'CROSS_TAB_BROADCAST':
      handleCrossTabBroadcast(message.data, sender, sendResponse);
      return true;
      
    case 'GET_EXTENSION_STATE':
      handleGetExtensionState(sendResponse);
      return true;
      
    case 'UPDATE_EXTENSION_STATE':
      handleUpdateExtensionState(message.data, sendResponse);
      return true;
      
    // Content script lifecycle messages
    case 'CONTENT_SCRIPT_READY':
      handleContentScriptReady(message.data, sender, sendResponse);
      break;
      
    case 'JOB_CONTENT_EXTRACTED':
      handleJobContentExtracted(message.data, sender, sendResponse);
      return true; // Keep message channel open for async response
      
    case 'JOB_EXTRACTION_ERROR':
      handleJobExtractionError(message.data, sender, sendResponse);
      break;
      
    case 'JOB_PAGE_LEFT':
      handleJobPageLeft(message.data, sender, sendResponse);
      break;
      
    // Analysis workflow messages
    case 'JOB_ANALYSIS_COMPLETE':
      handleJobAnalysisComplete(message.data, sender, sendResponse);
      return true;
      
    case 'JOB_ANALYSIS_ERROR':
      handleJobAnalysisError(message.data, sender, sendResponse);
      break;
      
    case 'ANALYSIS_PROGRESS':
      handleAnalysisProgress(message.data, sender, sendResponse);
      break;
      
    // Analysis and processing messages
    case 'ANALYZE_JOB':
      handleJobAnalysis(message.data, sendResponse);
      return true; // Keep message channel open for async response
      
    // Profile management messages
    case 'GET_USER_PROFILE':
      handleGetUserProfile(sendResponse);
      return true;
      
    case 'UPDATE_USER_PROFILE':
      handleUpdateUserProfile(message.data, sendResponse);
      return true;
      
    // Storage management messages
    case 'EXPORT_DATA':
      handleExportData(sendResponse);
      return true;
      
    case 'IMPORT_DATA':
      handleImportData(message.data, sendResponse);
      return true;
      
    case 'CLEAR_ALL_DATA':
      handleClearAllData(sendResponse);
      return true;
      
    case 'GET_STORAGE_INFO':
      handleGetStorageInfo(sendResponse);
      return true;
      
    // Analytics and monitoring messages
    case 'TRACK_EVENT':
      handleTrackEvent(message.data, sendResponse);
      return true;
      
    case 'TRACK_PERFORMANCE':
      handleTrackPerformance(message.data, sendResponse);
      return true;
      
    case 'TRACK_ERROR':
      handleTrackError(message.data, sendResponse);
      return true;
      
    case 'GET_ANALYTICS_SUMMARY':
      handleGetAnalyticsSummary(sendResponse);
      return true;
      
    case 'GET_PERFORMANCE_INSIGHTS':
      handleGetPerformanceInsights(sendResponse);
      return true;
      
    case 'CLEAR_ANALYTICS':
      handleClearAnalytics(sendResponse);
      return true;
      
    case 'EXPORT_ANALYTICS':
      handleExportAnalytics(sendResponse);
      return true;
      
    // Utility messages
    case 'PING':
      sendResponse({ 
        success: true, 
        data: { 
          status: 'alive',
          activeTabs: storageCoordinator?.getActiveTabsCount() || 0,
          extensionState: storageCoordinator?.getCurrentExtensionState()
        },
        timestamp: Date.now()
      });
      break;
      
    default:
      console.warn('⚠️ Unknown message type:', message.type);
      sendResponse({ 
        success: false, 
        error: `Unknown message type: ${message.type}`,
        timestamp: Date.now()
      });
  }
});

/**
 * Handle storage synchronization requests
 */
async function handleStorageSyncRequest(data: any, _sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) {
  try {
    const syncData = await storageCoordinator.handleStorageSyncRequest(data.keys);
    
    sendResponse({
      success: true,
      data: syncData,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('❌ Error in storage sync:', error);
    sendResponse({
      success: false,
      error: 'Storage sync failed',
      timestamp: Date.now()
    });
  }
}

/**
 * Handle cross-tab broadcast messages
 */
async function handleCrossTabBroadcast(data: any, sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) {
  try {
    const broadcastCount = await storageCoordinator.handleCrossTabBroadcast(data, sender.tab?.id);
    
    sendResponse({
      success: true,
      data: { broadcastCount },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('❌ Error in cross-tab broadcast:', error);
    sendResponse({
      success: false,
      error: 'Broadcast failed',
      timestamp: Date.now()
    });
  }
}

/**
 * Handle extension state requests
 */
async function handleGetExtensionState(sendResponse: (response: any) => void) {
  try {
    const state = await storageCoordinator.getExtensionState();
    
    sendResponse({
      success: true,
      data: state,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('❌ Error getting extension state:', error);
    sendResponse({
      success: false,
      error: 'Failed to get extension state',
      timestamp: Date.now()
    });
  }
}

/**
 * Handle extension state updates
 */
async function handleUpdateExtensionState(data: any, sendResponse: (response: any) => void) {
  try {
    const updatedState = await storageCoordinator.updateExtensionState(data);
    
    sendResponse({
      success: true,
      data: updatedState,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('❌ Error updating extension state:', error);
    sendResponse({
      success: false,
      error: 'Failed to update extension state',
      timestamp: Date.now()
    });
  }
}

/**
 * Handle data export requests
 */
async function handleExportData(sendResponse: (response: any) => void) {
  try {
    const exportData = await storageCoordinator.exportData();
    
    sendResponse({
      success: true,
      data: exportData,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('❌ Error exporting data:', error);
    sendResponse({
      success: false,
      error: 'Data export failed',
      timestamp: Date.now()
    });
  }
}

/**
 * Handle data import requests
 */
async function handleImportData(importData: any, sendResponse: (response: any) => void) {
  try {
    await storageCoordinator.importData(importData);
    
    sendResponse({
      success: true,
      data: { message: 'Data imported successfully' },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('❌ Error importing data:', error);
    sendResponse({
      success: false,
      error: 'Data import failed',
      timestamp: Date.now()
    });
  }
}

/**
 * Handle clear all data requests
 */
async function handleClearAllData(sendResponse: (response: any) => void) {
  try {
    await storageCoordinator.clearAllData();
    
    sendResponse({
      success: true,
      data: { message: 'All data cleared successfully' },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('❌ Error clearing data:', error);
    sendResponse({
      success: false,
      error: 'Failed to clear data',
      timestamp: Date.now()
    });
  }
}

/**
 * Handle storage info requests
 */
async function handleGetStorageInfo(sendResponse: (response: any) => void) {
  try {
    const storageInfo = await storageCoordinator.getStorageInfo();
    
    sendResponse({
      success: true,
      data: storageInfo,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('❌ Error getting storage info:', error);
    sendResponse({
      success: false,
      error: 'Failed to get storage info',
      timestamp: Date.now()
    });
  }
}

/**
 * Handle analytics event tracking
 */
async function handleTrackEvent(data: any, sendResponse: (response: any) => void) {
  try {
    if (analyticsMonitor) {
      await analyticsMonitor.trackEvent(data.type, data.data);
    }
    
    sendResponse({
      success: true,
      data: { message: 'Event tracked successfully' },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('❌ Error tracking event:', error);
    sendResponse({
      success: false,
      error: 'Failed to track event',
      timestamp: Date.now()
    });
  }
}

/**
 * Handle performance metric tracking
 */
async function handleTrackPerformance(data: any, sendResponse: (response: any) => void) {
  try {
    if (analyticsMonitor) {
      await analyticsMonitor.trackPerformance(data.name, data.value, data.context);
    }
    
    sendResponse({
      success: true,
      data: { message: 'Performance metric tracked successfully' },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('❌ Error tracking performance:', error);
    sendResponse({
      success: false,
      error: 'Failed to track performance metric',
      timestamp: Date.now()
    });
  }
}

/**
 * Handle error tracking
 */
async function handleTrackError(data: any, sendResponse: (response: any) => void) {
  try {
    if (analyticsMonitor) {
      await analyticsMonitor.trackError(data.error, data.context);
    }
    
    sendResponse({
      success: true,
      data: { message: 'Error tracked successfully' },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('❌ Error tracking error:', error);
    sendResponse({
      success: false,
      error: 'Failed to track error',
      timestamp: Date.now()
    });
  }
}

/**
 * Handle analytics summary request
 */
async function handleGetAnalyticsSummary(sendResponse: (response: any) => void) {
  try {
    if (!analyticsMonitor) {
      throw new Error('Analytics monitor not initialized');
    }
    
    const summary = await analyticsMonitor.getAnalyticsSummary();
    
    sendResponse({
      success: true,
      data: summary,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('❌ Error getting analytics summary:', error);
    sendResponse({
      success: false,
      error: 'Failed to get analytics summary',
      timestamp: Date.now()
    });
  }
}

/**
 * Handle performance insights request
 */
async function handleGetPerformanceInsights(sendResponse: (response: any) => void) {
  try {
    if (!analyticsMonitor) {
      throw new Error('Analytics monitor not initialized');
    }
    
    const insights = analyticsMonitor.getPerformanceInsights();
    
    sendResponse({
      success: true,
      data: insights,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('❌ Error getting performance insights:', error);
    sendResponse({
      success: false,
      error: 'Failed to get performance insights',
      timestamp: Date.now()
    });
  }
}

/**
 * Handle clear analytics request
 */
async function handleClearAnalytics(sendResponse: (response: any) => void) {
  try {
    if (analyticsMonitor) {
      await analyticsMonitor.clearAnalytics();
    }
    
    sendResponse({
      success: true,
      data: { message: 'Analytics data cleared successfully' },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('❌ Error clearing analytics:', error);
    sendResponse({
      success: false,
      error: 'Failed to clear analytics data',
      timestamp: Date.now()
    });
  }
}

/**
 * Handle export analytics request
 */
async function handleExportAnalytics(sendResponse: (response: any) => void) {
  try {
    if (!analyticsMonitor) {
      throw new Error('Analytics monitor not initialized');
    }
    
    const analyticsData = await analyticsMonitor.exportAnalytics();
    
    sendResponse({
      success: true,
      data: analyticsData,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('❌ Error exporting analytics:', error);
    sendResponse({
      success: false,
      error: 'Failed to export analytics data',
      timestamp: Date.now()
    });
  }
}

/**
 * Handle content script ready notification
 */
function handleContentScriptReady(data: any, _sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) {
  console.log('✅ Content script ready on:', data.url);
  
  // Store tab information for future communication
  if (_sender.tab?.id && storageCoordinator) {
    storageCoordinator.registerTab(_sender.tab.id, data.url);
  }
  
  // Track content script initialization
  if (analyticsMonitor) {
    analyticsMonitor.trackEvent('content_script_ready', {
      url: data.url,
      tabId: _sender.tab?.id
    });
  }
  
  sendResponse({ 
    success: true, 
    data: { 
      message: 'Background script acknowledged',
      extensionState: storageCoordinator?.getCurrentExtensionState()
    },
    timestamp: Date.now()
  });
}

/**
 * Handle job content extraction notification
 */
async function handleJobContentExtracted(data: any, _sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) {
  console.log('🔍 Job content extracted:', data.jobInfo?.title);
  
  try {
    // Track job content extraction
    if (analyticsMonitor) {
      await analyticsMonitor.trackEvent('job_content_extracted', {
        jobTitle: data.jobInfo?.title,
        company: data.jobInfo?.company,
        url: data.url,
        contentLength: data.content?.length
      });
    }
    
    // Store the extracted job content for analysis
    // This will be implemented in later tasks when we have the analysis engine
    
    // For now, just acknowledge receipt
    sendResponse({ 
      success: true, 
      data: { 
        message: 'Job content received',
        jobTitle: data.jobInfo?.title,
        extractedAt: new Date().toISOString()
      },
      timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('❌ Error handling job content:', error);
    if (analyticsMonitor) {
      await analyticsMonitor.trackError(error as Error, {
        context: 'job_content_extraction',
        jobTitle: data.jobInfo?.title
      });
    }
    sendResponse({ 
      success: false, 
      error: 'Failed to process job content',
      timestamp: Date.now()
    });
  }
}

/**
 * Handle job extraction error notification
 */
function handleJobExtractionError(data: any, _sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) {
  console.error('❌ Job extraction error on:', data.url, 'Error:', data.error);
  
  // Log error for debugging (in production, this might go to analytics)
  // Error handling and reporting will be implemented in later tasks
  
  sendResponse({ 
    success: true, 
    data: { message: 'Error logged' },
    timestamp: Date.now()
  });
}

/**
 * Handle job page left notification
 */
function handleJobPageLeft(data: any, _sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) {
  console.log('👋 User left job page:', data.url);
  
  // Clean up any tab-specific data
  // Cleanup logic will be implemented in later tasks
  
  sendResponse({ 
    success: true, 
    data: { message: 'Page exit acknowledged' },
    timestamp: Date.now()
  });
}

/**
 * Handle job analysis request
 * To be implemented in later tasks
 */
async function handleJobAnalysis(_jobData: any, sendResponse: (response: any) => void) {
  console.log('🔍 Handling job analysis request');
  
  try {
    // Job analysis logic will be implemented in later tasks
    sendResponse({ 
      success: true, 
      data: { message: 'Job analysis placeholder' },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('❌ Error in job analysis:', error);
    sendResponse({ 
      success: false, 
      error: 'Job analysis failed',
      timestamp: Date.now()
    });
  }
}

/**
 * Handle get user profile request
 * To be implemented in later tasks
 */
async function handleGetUserProfile(sendResponse: (response: any) => void) {
  console.log('👤 Handling get user profile request');
  
  try {
    // Profile loading will be implemented when ProfileManager is available
    sendResponse({ 
      success: true, 
      data: { message: 'Profile loading placeholder' },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('❌ Error loading user profile:', error);
    sendResponse({ 
      success: false, 
      error: 'Failed to load user profile',
      timestamp: Date.now()
    });
  }
}

/**
 * Handle update user profile request
 * To be implemented in later tasks
 */
async function handleUpdateUserProfile(_profileData: any, sendResponse: (response: any) => void) {
  console.log('💾 Handling update user profile request');
  
  try {
    // Profile saving will be implemented when ProfileManager is available
    sendResponse({ 
      success: true, 
      data: { message: 'Profile update placeholder' },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('❌ Error updating user profile:', error);
    sendResponse({ 
      success: false, 
      error: 'Failed to update user profile',
      timestamp: Date.now()
    });
  }
}

/**
 * Handle job analysis completion
 */
async function handleJobAnalysisComplete(data: any, _sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) {
  console.log('🎉 Job analysis completed:', data.jobInfo?.title);
  
  try {
    // Track job analysis completion
    if (analyticsMonitor) {
      await analyticsMonitor.trackEvent('job_analysis_completed', {
        jobTitle: data.jobInfo?.title,
        company: data.jobInfo?.company,
        matchScore: data.analysis?.overallMatch,
        skillsMatched: data.analysis?.matchingSkills?.length,
        skillsMissing: data.analysis?.missingSkills?.length,
        analysisTime: data.analysis?.processingTime
      });
      
      // Track performance metric for analysis duration
      if (data.analysis?.processingTime) {
        await analyticsMonitor.trackPerformance('job_analysis_duration', data.analysis.processingTime, {
          jobTitle: data.jobInfo?.title,
          skillCount: (data.analysis?.matchingSkills?.length || 0) + (data.analysis?.missingSkills?.length || 0)
        });
      }
    }
    
    // Store the analysis result for future use
    // This will be implemented when we have persistent storage
    
    // For now, just acknowledge receipt
    sendResponse({
      success: true,
      data: {
        message: 'Analysis result received',
        jobTitle: data.jobInfo?.title,
        matchScore: data.analysis?.overallMatch,
        completedAt: new Date().toISOString()
      },
      timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('❌ Error handling analysis completion:', error);
    if (analyticsMonitor) {
      await analyticsMonitor.trackError(error as Error, {
        context: 'job_analysis_completion',
        jobTitle: data.jobInfo?.title
      });
    }
    sendResponse({
      success: false,
      error: 'Failed to process analysis result',
      timestamp: Date.now()
    });
  }
}

/**
 * Handle job analysis error
 */
function handleJobAnalysisError(data: any, _sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) {
  console.error('❌ Job analysis error on:', data.url, 'Error:', data.error);
  
  // Log error for debugging (in production, this might go to analytics)
  // Error handling and reporting will be implemented in later tasks
  
  sendResponse({
    success: true,
    data: { message: 'Analysis error logged' },
    timestamp: Date.now()
  });
}

/**
 * Handle analysis progress updates
 */
function handleAnalysisProgress(data: any, _sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) {
  const progress = data.progress;
  console.log(`📊 Analysis Progress: ${progress.stage} (${progress.progress}%) - ${progress.message}`);
  
  // Forward progress to popup if it's open
  // This will be implemented when we have popup communication
  
  sendResponse({
    success: true,
    data: { message: 'Progress update received' },
    timestamp: Date.now()
  });
}

/**
 * Extension shutdown handler
 */
chrome.runtime.onSuspend?.addListener(async () => {
  console.log('💤 Extension suspending, performing cleanup');
  
  try {
    // Shutdown analytics monitor
    if (analyticsMonitor) {
      await analyticsMonitor.shutdown();
    }
    
    // Clear cleanup timer
    if (cleanupTimer) {
      clearInterval(cleanupTimer);
    }
    
    console.log('✅ Cleanup completed');
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
  }
});

/**
 * Handle extension startup
 */
chrome.runtime.onStartup?.addListener(async () => {
  console.log('🌅 Extension starting up');
  
  try {
    // Initialize storage coordinator if not already done
    if (!storageCoordinator) {
      storageCoordinator = new StorageCoordinator();
      await storageCoordinator.initialize();
    }
    
    // Initialize analytics monitor if not already done
    if (!analyticsMonitor) {
      analyticsMonitor = new AnalyticsMonitor();
      await analyticsMonitor.initialize();
    }
    
    // Load extension state
    await storageCoordinator.getExtensionState();
    
    // Track startup
    await analyticsMonitor.trackEvent('extension_startup', {
      version: chrome.runtime.getManifest().version
    });
    
    // Start periodic cleanup
    startPeriodicCleanup();
    
    console.log('✅ Extension startup completed');
  } catch (error) {
    console.error('❌ Error during extension startup:', error);
    if (analyticsMonitor) {
      await analyticsMonitor.trackError(error as Error, {
        context: 'extension_startup'
      });
    }
  }
});

// Export empty object to make this a module
export {};