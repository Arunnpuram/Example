/**
 * StorageManager - Handles encrypted local storage for user data
 * 
 * This module provides secure storage capabilities using Web Crypto API
 * for client-side encryption of sensitive user data.
 */

import { CryptoUtils } from '@/utils/crypto';
import type { EncryptedData, StorageMetadata } from '@/core/types';

export interface StorageOptions {
  encryptionEnabled?: boolean;
  passphrase?: string;
}

export interface StorageResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export class StorageManager {
  private static instance: StorageManager;
  private cryptoUtils: CryptoUtils;
  private encryptionKey: CryptoKey | null = null;
  private salt: Uint8Array | null = null;
  private isInitialized = false;

  private constructor() {
    this.cryptoUtils = CryptoUtils.getInstance();
  }

  public static getInstance(): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager();
    }
    return StorageManager.instance;
  }

  /**
   * Initialize the storage manager with encryption settings
   */
  async initialize(options: StorageOptions = {}): Promise<StorageResult<void>> {
    try {
      const { encryptionEnabled = true, passphrase } = options;

      if (encryptionEnabled && passphrase) {
        // Check if salt exists in storage, if not create one
        const existingSalt = await this.getStoredSalt();
        this.salt = existingSalt || this.cryptoUtils.generateSalt();
        
        // Store salt if it's new
        if (!existingSalt) {
          await this.storeSalt(this.salt);
        }

        // Derive encryption key from passphrase
        this.encryptionKey = await this.cryptoUtils.deriveKeyFromPassphrase(
          passphrase,
          this.salt
        );
      }

      // Initialize metadata
      await this.initializeMetadata(encryptionEnabled);
      this.isInitialized = true;

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to initialize storage: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Store data with optional encryption
   */
  async store<T>(key: string, data: T): Promise<StorageResult<void>> {
    try {
      if (!this.isInitialized) {
        throw new Error('StorageManager not initialized');
      }

      const serializedData = JSON.stringify(data);
      let storageData: string | EncryptedData;

      if (this.encryptionKey) {
        // Encrypt the data
        storageData = await this.cryptoUtils.encrypt(serializedData, this.encryptionKey);
      } else {
        // Store as plain text
        storageData = serializedData;
      }

      // Store in Chrome extension storage
      await chrome.storage.local.set({ [key]: storageData });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to store data: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Retrieve and decrypt data
   */
  async retrieve<T>(key: string): Promise<StorageResult<T>> {
    try {
      if (!this.isInitialized) {
        throw new Error('StorageManager not initialized');
      }

      // Get data from Chrome extension storage
      const result = await chrome.storage.local.get([key]);
      const storageData = result[key];

      if (!storageData) {
        return {
          success: false,
          error: 'Data not found'
        };
      }

      let serializedData: string;

      if (this.encryptionKey && typeof storageData === 'object' && 'data' in storageData) {
        // Decrypt the data
        serializedData = await this.cryptoUtils.decrypt(
          storageData as EncryptedData,
          this.encryptionKey
        );
      } else {
        // Data is stored as plain text
        serializedData = storageData as string;
      }

      const data = JSON.parse(serializedData) as T;
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: `Failed to retrieve data: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Remove data from storage
   */
  async remove(key: string): Promise<StorageResult<void>> {
    try {
      await chrome.storage.local.remove([key]);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to remove data: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Clear all stored data
   */
  async clear(): Promise<StorageResult<void>> {
    try {
      await chrome.storage.local.clear();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to clear storage: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get all stored keys
   */
  async getKeys(): Promise<StorageResult<string[]>> {
    try {
      const result = await chrome.storage.local.get(null);
      const keys = Object.keys(result);
      return { success: true, data: keys };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get keys: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get storage usage information
   */
  async getStorageInfo(): Promise<StorageResult<{ bytesInUse: number; quota: number }>> {
    try {
      const bytesInUse = await chrome.storage.local.getBytesInUse();
      const quota = chrome.storage.local.QUOTA_BYTES;
      
      return {
        success: true,
        data: { bytesInUse, quota }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get storage info: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Export all data for backup
   */
  async exportData(): Promise<StorageResult<Record<string, any>>> {
    try {
      const result = await chrome.storage.local.get(null);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: `Failed to export data: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Import data from backup
   */
  async importData(data: Record<string, any>): Promise<StorageResult<void>> {
    try {
      await chrome.storage.local.set(data);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to import data: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Change encryption passphrase
   */
  async changePassphrase(oldPassphrase: string, newPassphrase: string): Promise<StorageResult<void>> {
    try {
      if (!this.salt) {
        throw new Error('No salt found for encryption');
      }

      // Verify old passphrase by deriving key and testing decryption
      const oldKey = await this.cryptoUtils.deriveKeyFromPassphrase(oldPassphrase, this.salt);
      
      // Test decryption with old key (use metadata as test)
      const metadataResult = await chrome.storage.local.get(['_metadata']);
      if (metadataResult._metadata && typeof metadataResult._metadata === 'object') {
        try {
          await this.cryptoUtils.decrypt(metadataResult._metadata as EncryptedData, oldKey);
        } catch {
          throw new Error('Invalid old passphrase');
        }
      }

      // Get all encrypted data
      const allData = await chrome.storage.local.get(null);
      const decryptedData: Record<string, any> = {};

      // Decrypt all data with old key
      for (const [key, value] of Object.entries(allData)) {
        if (key.startsWith('_')) continue; // Skip internal keys
        
        if (typeof value === 'object' && 'data' in value) {
          const decrypted = await this.cryptoUtils.decrypt(value as EncryptedData, oldKey);
          decryptedData[key] = JSON.parse(decrypted);
        } else {
          decryptedData[key] = value;
        }
      }

      // Generate new key from new passphrase
      const newKey = await this.cryptoUtils.deriveKeyFromPassphrase(newPassphrase, this.salt);

      // Re-encrypt all data with new key
      for (const [key, value] of Object.entries(decryptedData)) {
        const serialized = JSON.stringify(value);
        const encrypted = await this.cryptoUtils.encrypt(serialized, newKey);
        await chrome.storage.local.set({ [key]: encrypted });
      }

      // Update encryption key
      this.encryptionKey = newKey;

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to change passphrase: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Check if storage is encrypted
   */
  isEncrypted(): boolean {
    return this.encryptionKey !== null;
  }

  /**
   * Get stored salt
   */
  private async getStoredSalt(): Promise<Uint8Array | null> {
    try {
      const result = await chrome.storage.local.get(['_salt']);
      if (result._salt) {
        return this.cryptoUtils.base64ToArrayBuffer(result._salt);
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Store salt
   */
  private async storeSalt(salt: Uint8Array): Promise<void> {
    const saltBase64 = this.cryptoUtils.arrayBufferToBase64(salt.buffer as ArrayBuffer);
    await chrome.storage.local.set({ _salt: saltBase64 });
  }

  /**
   * Initialize storage metadata
   */
  private async initializeMetadata(encryptionEnabled: boolean): Promise<void> {
    const metadata: StorageMetadata = {
      version: '1.0.0',
      encryptionEnabled,
      lastBackup: undefined
    };

    if (this.encryptionKey) {
      const encryptedMetadata = await this.cryptoUtils.encrypt(
        JSON.stringify(metadata),
        this.encryptionKey
      );
      await chrome.storage.local.set({ _metadata: encryptedMetadata });
    } else {
      await chrome.storage.local.set({ _metadata: metadata });
    }
  }
}