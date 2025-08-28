/**
 * Storage coordination functionality for background script
 */

import { StorageManager } from '@/core/storage';
import type { ExtensionState, StorageMetadata } from '@/core/types';

export class StorageCoordinator {
  private storageManager: StorageManager;
  private extensionState: ExtensionState = {
    isActive: true,
    analysisInProgress: false
  };
  private activeTabs = new Map<number, { url: string; lastActivity: number }>();

  constructor() {
    this.storageManager = StorageManager.getInstance();
  }

  /**
   * Initialize storage coordinator
   */
  async initialize(): Promise<void> {
    await this.storageManager.initialize();
  }

  /**
   * Handle first-time installation
   */
  async handleFirstInstall(): Promise<void> {
    console.log('🎉 First time installation - setting up defaults');
    
    try {
      // Create default extension state
      const defaultState: ExtensionState = {
        isActive: true,
        analysisInProgress: false,
        lastAnalysis: undefined
      };
      
      await this.storageManager.store('extension_state', defaultState);
      this.extensionState = defaultState;
      
      // Initialize metadata with current version
      const metadata: StorageMetadata = {
        version: chrome.runtime.getManifest().version,
        encryptionEnabled: false, // Will be enabled when user sets up profile
        lastBackup: undefined
      };
      
      await this.storageManager.store('_metadata', metadata);
      
      console.log('✅ Default settings initialized');
    } catch (error) {
      console.error('❌ Error setting up defaults:', error);
      throw error;
    }
  }

  /**
   * Handle extension updates and data migration
   */
  async handleExtensionUpdate(previousVersion?: string): Promise<void> {
    console.log('🔄 Extension update detected, previous version:', previousVersion);
    
    try {
      // Get current metadata
      const metadataResult = await this.storageManager.retrieve<StorageMetadata>('_metadata');
      
      if (metadataResult.success && metadataResult.data) {
        const currentVersion = chrome.runtime.getManifest().version;
        const storedVersion = metadataResult.data.version;
        
        console.log(`📊 Migrating from version ${storedVersion} to ${currentVersion}`);
        
        // Perform version-specific migrations
        await this.performDataMigration(storedVersion, currentVersion);
        
        // Update metadata with new version
        const updatedMetadata: StorageMetadata = {
          ...metadataResult.data,
          version: currentVersion
        };
        
        await this.storageManager.store('_metadata', updatedMetadata);
        
        console.log('✅ Data migration completed');
      } else {
        console.log('⚠️ No existing metadata found, treating as fresh install');
        await this.handleFirstInstall();
      }
    } catch (error) {
      console.error('❌ Error during extension update:', error);
      throw error;
    }
  }

  /**
   * Perform data migration between versions
   */
  private async performDataMigration(fromVersion: string, toVersion: string): Promise<void> {
    console.log(`🔄 Performing data migration: ${fromVersion} → ${toVersion}`);
    
    // Version-specific migration logic
    const migrations = [
      { from: '1.0.0', to: '1.1.0', migrate: () => this.migrateToV1_1_0() },
      // Add more migrations as needed
    ];
    
    for (const migration of migrations) {
      if (this.shouldRunMigration(fromVersion, migration.from, toVersion, migration.to)) {
        console.log(`🔧 Running migration: ${migration.from} → ${migration.to}`);
        await migration.migrate();
      }
    }
  }

  /**
   * Check if a migration should run
   */
  private shouldRunMigration(currentVersion: string, migrationFrom: string, targetVersion: string, migrationTo: string): boolean {
    return this.compareVersions(currentVersion, migrationFrom) >= 0 && 
           this.compareVersions(targetVersion, migrationTo) >= 0;
  }

  /**
   * Simple version comparison
   */
  private compareVersions(a: string, b: string): number {
    const aParts = a.split('.').map(Number);
    const bParts = b.split('.').map(Number);
    
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aPart = aParts[i] || 0;
      const bPart = bParts[i] || 0;
      
      if (aPart > bPart) return 1;
      if (aPart < bPart) return -1;
    }
    
    return 0;
  }

  /**
   * Migration function for v1.1.0
   */
  private async migrateToV1_1_0(): Promise<void> {
    console.log('🔧 Migrating to v1.1.0');
    
    const profileResult = await this.storageManager.retrieve('user_profile');
    if (profileResult.success && profileResult.data) {
      const profile = profileResult.data as any;
      
      if (!profile.preferences) {
        profile.preferences = {
          preferredLearningStyle: ['visual'],
          timeCommitment: 5,
          focusAreas: ['technical'],
          notificationSettings: {
            enableAnalysisComplete: true,
            enableNewRecommendations: true,
            enableWeeklyProgress: false,
            quietHours: {
              enabled: false,
              start: '22:00',
              end: '08:00'
            }
          }
        };
        
        await this.storageManager.store('user_profile', profile);
        console.log('✅ User profile migrated to v1.1.0');
      }
    }
  }

  /**
   * Perform storage cleanup and maintenance
   */
  async performStorageCleanup(): Promise<void> {
    console.log('🧹 Performing storage cleanup');
    
    try {
      // Clean up old analysis history (keep last 100 entries)
      await this.cleanupAnalysisHistory();
      
      // Clean up inactive tab tracking
      this.cleanupInactiveTabs();
      
      // Check storage usage and warn if approaching limits
      await this.checkStorageUsage();
      
      console.log('✅ Storage cleanup completed');
    } catch (error) {
      console.error('❌ Error during storage cleanup:', error);
      throw error;
    }
  }

  /**
   * Clean up old analysis history entries
   */
  private async cleanupAnalysisHistory(): Promise<void> {
    const historyResult = await this.storageManager.retrieve<any[]>('analysis_history');
    
    if (historyResult.success && historyResult.data) {
      const history = historyResult.data;
      const MAX_HISTORY_ENTRIES = 100;
      
      if (history.length > MAX_HISTORY_ENTRIES) {
        // Sort by timestamp and keep the most recent entries
        const sortedHistory = history.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        
        const trimmedHistory = sortedHistory.slice(0, MAX_HISTORY_ENTRIES);
        await this.storageManager.store('analysis_history', trimmedHistory);
        
        console.log(`🗑️ Cleaned up ${history.length - MAX_HISTORY_ENTRIES} old analysis entries`);
      }
    }
  }

  /**
   * Clean up inactive tab tracking
   */
  private cleanupInactiveTabs(): void {
    const now = Date.now();
    const INACTIVE_THRESHOLD = 30 * 60 * 1000; // 30 minutes
    
    for (const [tabId, tabInfo] of this.activeTabs.entries()) {
      if (now - tabInfo.lastActivity > INACTIVE_THRESHOLD) {
        this.activeTabs.delete(tabId);
        console.log(`🗑️ Cleaned up inactive tab: ${tabId}`);
      }
    }
  }

  /**
   * Check storage usage and warn if approaching limits
   */
  private async checkStorageUsage(): Promise<void> {
    const storageInfo = await this.storageManager.getStorageInfo();
    
    if (storageInfo.success && storageInfo.data) {
      const { bytesInUse, quota } = storageInfo.data;
      const usagePercentage = (bytesInUse / quota) * 100;
      
      if (usagePercentage > 80) {
        console.warn(`⚠️ Storage usage high: ${usagePercentage.toFixed(1)}% (${bytesInUse}/${quota} bytes)`);
        
        if (usagePercentage > 90) {
          console.error('🚨 Storage almost full! Consider cleaning up old data.');
        }
      }
    }
  }

  /**
   * Handle storage synchronization requests
   */
  async handleStorageSyncRequest(keys: string[]): Promise<Record<string, any>> {
    console.log('🔄 Storage sync request:', keys);
    
    const syncData: Record<string, any> = {};
    
    for (const key of keys) {
      const result = await this.storageManager.retrieve(key);
      if (result.success) {
        syncData[key] = result.data;
      }
    }
    
    return syncData;
  }

  /**
   * Handle cross-tab broadcast messages
   */
  async handleCrossTabBroadcast(data: any, senderTabId?: number): Promise<number> {
    console.log('📡 Broadcasting message to all tabs:', data.type);
    
    let broadcastCount = 0;
    
    for (const [tabId] of this.activeTabs.entries()) {
      if (tabId !== senderTabId) {
        try {
          await chrome.tabs.sendMessage(tabId, {
            type: 'CROSS_TAB_MESSAGE',
            data: data,
            sender: senderTabId
          });
          broadcastCount++;
        } catch (error) {
          // Tab might be closed or not responsive, remove from tracking
          this.activeTabs.delete(tabId);
        }
      }
    }
    
    return broadcastCount;
  }

  /**
   * Get extension state
   */
  async getExtensionState(): Promise<ExtensionState> {
    const stateResult = await this.storageManager.retrieve<ExtensionState>('extension_state');
    
    if (stateResult.success && stateResult.data) {
      this.extensionState = stateResult.data;
    }
    
    return this.extensionState;
  }

  /**
   * Update extension state
   */
  async updateExtensionState(updates: Partial<ExtensionState>): Promise<ExtensionState> {
    this.extensionState = { ...this.extensionState, ...updates };
    await this.storageManager.store('extension_state', this.extensionState);
    
    // Broadcast state change to all tabs
    await this.handleCrossTabBroadcast({
      type: 'EXTENSION_STATE_CHANGED',
      state: this.extensionState
    });
    
    return this.extensionState;
  }

  /**
   * Export all data
   */
  async exportData(): Promise<any> {
    const exportResult = await this.storageManager.exportData();
    
    if (exportResult.success) {
      return {
        version: chrome.runtime.getManifest().version,
        exportDate: new Date().toISOString(),
        data: exportResult.data
      };
    } else {
      throw new Error(exportResult.error);
    }
  }

  /**
   * Import data
   */
  async importData(importData: any): Promise<void> {
    if (!importData.data || !importData.version) {
      throw new Error('Invalid import data format');
    }
    
    if (importData.version !== chrome.runtime.getManifest().version) {
      console.log('🔄 Import data version mismatch, performing migration');
    }
    
    const importResult = await this.storageManager.importData(importData.data);
    
    if (!importResult.success) {
      throw new Error(importResult.error);
    }
    
    // Refresh extension state
    await this.getExtensionState();
  }

  /**
   * Clear all data
   */
  async clearAllData(): Promise<void> {
    const clearResult = await this.storageManager.clear();
    
    if (!clearResult.success) {
      throw new Error(clearResult.error);
    }
    
    // Reset extension state
    this.extensionState = {
      isActive: true,
      analysisInProgress: false
    };
    
    // Reinitialize with defaults
    await this.handleFirstInstall();
  }

  /**
   * Get storage info
   */
  async getStorageInfo(): Promise<any> {
    const storageInfo = await this.storageManager.getStorageInfo();
    
    if (!storageInfo.success) {
      throw new Error(storageInfo.error);
    }
    
    const { bytesInUse, quota } = storageInfo.data!;
    const usagePercentage = (bytesInUse / quota) * 100;
    
    return {
      bytesInUse,
      quota,
      usagePercentage: Math.round(usagePercentage * 100) / 100,
      activeTabs: this.activeTabs.size
    };
  }

  /**
   * Register tab for cross-tab communication
   */
  registerTab(tabId: number, url: string): void {
    this.activeTabs.set(tabId, {
      url,
      lastActivity: Date.now()
    });
    console.log(`📝 Tab ${tabId} registered for cross-tab communication`);
  }

  /**
   * Update tab activity
   */
  updateTabActivity(tabId: number): void {
    const tabInfo = this.activeTabs.get(tabId);
    if (tabInfo) {
      tabInfo.lastActivity = Date.now();
    }
  }

  /**
   * Remove tab from tracking
   */
  removeTab(tabId: number): void {
    this.activeTabs.delete(tabId);
    console.log(`🗑️ Tab ${tabId} removed from tracking`);
  }

  /**
   * Get current extension state (without storage access)
   */
  getCurrentExtensionState(): ExtensionState {
    return this.extensionState;
  }

  /**
   * Get active tabs count
   */
  getActiveTabsCount(): number {
    return this.activeTabs.size;
  }
}