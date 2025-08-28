/**
 * HistoryManager - Manages job analysis history and comparison features
 * 
 * This module provides functionality to store, retrieve, and compare
 * job analysis results over time.
 */

import { StorageManager, type StorageResult } from './storage';
import { validateSkillProfile } from '@/utils/validation';
import type { 
  JobPosting, 
  SkillGapAnalysis, 
  UserSkillProfile,
  ExtractedSkill,
  AnalysisHistoryEntry,
  ComparisonResult,
  SkillTrendData,
  HistorySearchOptions
} from '@/core/types';

export class HistoryManager {
  private static instance: HistoryManager;
  private storageManager: StorageManager;
  private readonly HISTORY_STORAGE_KEY = 'analysis_history';
  private readonly MAX_HISTORY_ENTRIES = 100; // Limit to prevent storage bloat

  private constructor() {
    this.storageManager = StorageManager.getInstance();
  }

  public static getInstance(): HistoryManager {
    if (!HistoryManager.instance) {
      HistoryManager.instance = new HistoryManager();
    }
    return HistoryManager.instance;
  }

  /**
   * Save a job analysis to history
   */
  async saveAnalysis(
    jobPosting: JobPosting,
    analysis: SkillGapAnalysis,
    userProfile: UserSkillProfile
  ): Promise<StorageResult<AnalysisHistoryEntry>> {
    try {
      // Validate inputs
      if (!validateSkillProfile(userProfile)) {
        return {
          success: false,
          error: 'Invalid user profile'
        };
      }

      const historyEntry: AnalysisHistoryEntry = {
        id: this.generateHistoryId(),
        jobPosting,
        analysis,
        timestamp: new Date(),
        userProfileSnapshot: { ...userProfile } // Create snapshot
      };

      // Get existing history
      const existingHistory = await this.getHistory();
      let historyEntries: AnalysisHistoryEntry[] = [];
      
      if (existingHistory.success && existingHistory.data) {
        historyEntries = existingHistory.data;
      }

      // Add new entry at the beginning
      historyEntries.unshift(historyEntry);

      // Limit history size
      if (historyEntries.length > this.MAX_HISTORY_ENTRIES) {
        historyEntries = historyEntries.slice(0, this.MAX_HISTORY_ENTRIES);
      }

      // Save updated history
      const saveResult = await this.storageManager.store(this.HISTORY_STORAGE_KEY, historyEntries);
      
      if (!saveResult.success) {
        return {
          success: false,
          error: saveResult.error
        };
      }

      return { success: true, data: historyEntry };
    } catch (error) {
      return {
        success: false,
        error: `Failed to save analysis: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get all analysis history
   */
  async getHistory(): Promise<StorageResult<AnalysisHistoryEntry[]>> {
    try {
      const result = await this.storageManager.retrieve<AnalysisHistoryEntry[]>(this.HISTORY_STORAGE_KEY);
      
      if (!result.success) {
        return result;
      }

      if (!result.data) {
        return { success: true, data: [] };
      }

      // Convert date strings back to Date objects
      const historyEntries = result.data.map(entry => ({
        ...entry,
        timestamp: typeof entry.timestamp === 'string' ? new Date(entry.timestamp) : entry.timestamp,
        jobPosting: {
          ...entry.jobPosting,
          postedDate: typeof entry.jobPosting.postedDate === 'string' 
            ? new Date(entry.jobPosting.postedDate) 
            : entry.jobPosting.postedDate
        },
        analysis: {
          ...entry.analysis,
          analysisDate: typeof entry.analysis.analysisDate === 'string'
            ? new Date(entry.analysis.analysisDate)
            : entry.analysis.analysisDate
        },
        userProfileSnapshot: {
          ...entry.userProfileSnapshot,
          createdAt: typeof entry.userProfileSnapshot.createdAt === 'string'
            ? new Date(entry.userProfileSnapshot.createdAt)
            : entry.userProfileSnapshot.createdAt,
          updatedAt: typeof entry.userProfileSnapshot.updatedAt === 'string'
            ? new Date(entry.userProfileSnapshot.updatedAt)
            : entry.userProfileSnapshot.updatedAt
        }
      }));

      return { success: true, data: historyEntries };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get history: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Search history with filters
   */
  async searchHistory(options: HistorySearchOptions): Promise<StorageResult<AnalysisHistoryEntry[]>> {
    try {
      const historyResult = await this.getHistory();
      
      if (!historyResult.success || !historyResult.data) {
        return historyResult;
      }

      let filteredEntries = historyResult.data;

      // Apply filters
      if (options.company) {
        const companyLower = options.company.toLowerCase();
        filteredEntries = filteredEntries.filter(entry =>
          entry.jobPosting.company.toLowerCase().includes(companyLower)
        );
      }

      if (options.skillName) {
        const skillLower = options.skillName.toLowerCase();
        filteredEntries = filteredEntries.filter(entry =>
          entry.jobPosting.extractedSkills.some(skill =>
            skill.name.toLowerCase().includes(skillLower) ||
            skill.synonyms.some(synonym => synonym.toLowerCase().includes(skillLower))
          )
        );
      }

      if (options.minMatchScore !== undefined) {
        filteredEntries = filteredEntries.filter(entry =>
          entry.analysis.overallMatch >= options.minMatchScore!
        );
      }

      if (options.maxMatchScore !== undefined) {
        filteredEntries = filteredEntries.filter(entry =>
          entry.analysis.overallMatch <= options.maxMatchScore!
        );
      }

      if (options.dateFrom) {
        filteredEntries = filteredEntries.filter(entry =>
          entry.timestamp >= options.dateFrom!
        );
      }

      if (options.dateTo) {
        filteredEntries = filteredEntries.filter(entry =>
          entry.timestamp <= options.dateTo!
        );
      }

      // Apply limit
      if (options.limit && options.limit > 0) {
        filteredEntries = filteredEntries.slice(0, options.limit);
      }

      return { success: true, data: filteredEntries };
    } catch (error) {
      return {
        success: false,
        error: `Failed to search history: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Compare multiple job analyses
   */
  async compareJobs(jobIds: string[]): Promise<StorageResult<ComparisonResult>> {
    try {
      if (jobIds.length < 2) {
        return {
          success: false,
          error: 'At least 2 jobs are required for comparison'
        };
      }

      const historyResult = await this.getHistory();
      
      if (!historyResult.success || !historyResult.data) {
        return {
          success: false,
          error: 'No history data available'
        };
      }

      // Find the requested jobs
      const selectedJobs = historyResult.data.filter(entry =>
        jobIds.includes(entry.id)
      );

      if (selectedJobs.length !== jobIds.length) {
        return {
          success: false,
          error: 'Some requested jobs were not found in history'
        };
      }

      // Analyze common and unique skills
      const allSkills = new Map<string, ExtractedSkill[]>();
      const matchScores = new Map<string, number>();

      selectedJobs.forEach(job => {
        job.jobPosting.extractedSkills.forEach(skill => {
          const skillKey = skill.name.toLowerCase();
          if (!allSkills.has(skillKey)) {
            allSkills.set(skillKey, []);
          }
          allSkills.get(skillKey)!.push(skill);
        });

        matchScores.set(job.id, job.analysis.overallMatch);
      });

      // Find common skills (appear in all jobs)
      const commonSkills: ExtractedSkill[] = [];
      const uniqueSkills = new Map<string, ExtractedSkill[]>();

      allSkills.forEach((skillInstances) => {
        if (skillInstances.length === selectedJobs.length) {
          // Common skill - take the first instance as representative
          commonSkills.push(skillInstances[0]);
        } else {
          // Unique skills - group by job
          skillInstances.forEach(skill => {
            const jobEntry = selectedJobs.find(job =>
              job.jobPosting.extractedSkills.includes(skill)
            );
            if (jobEntry) {
              if (!uniqueSkills.has(jobEntry.id)) {
                uniqueSkills.set(jobEntry.id, []);
              }
              uniqueSkills.get(jobEntry.id)!.push(skill);
            }
          });
        }
      });

      // Generate trend analysis
      const trendAnalysis = this.generateTrendAnalysis(selectedJobs);

      const comparisonResult: ComparisonResult = {
        jobs: selectedJobs,
        commonSkills,
        uniqueSkills,
        matchScoreComparison: matchScores,
        trendAnalysis
      };

      return { success: true, data: comparisonResult };
    } catch (error) {
      return {
        success: false,
        error: `Failed to compare jobs: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get skill trend analysis across all history
   */
  async getSkillTrends(limit: number = 20): Promise<StorageResult<SkillTrendData[]>> {
    try {
      const historyResult = await this.getHistory();
      
      if (!historyResult.success || !historyResult.data) {
        return {
          success: false,
          error: 'No history data available'
        };
      }

      const trendData = this.generateTrendAnalysis(historyResult.data);
      
      // Sort by frequency and limit results
      const sortedTrends = trendData
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, limit);

      return { success: true, data: sortedTrends };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get skill trends: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Delete a history entry
   */
  async deleteHistoryEntry(entryId: string): Promise<StorageResult<void>> {
    try {
      const historyResult = await this.getHistory();
      
      if (!historyResult.success || !historyResult.data) {
        return {
          success: false,
          error: 'No history data available'
        };
      }

      const updatedHistory = historyResult.data.filter(entry => entry.id !== entryId);
      
      const saveResult = await this.storageManager.store(this.HISTORY_STORAGE_KEY, updatedHistory);
      
      return saveResult;
    } catch (error) {
      return {
        success: false,
        error: `Failed to delete history entry: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Clear all history
   */
  async clearHistory(): Promise<StorageResult<void>> {
    try {
      return await this.storageManager.remove(this.HISTORY_STORAGE_KEY);
    } catch (error) {
      return {
        success: false,
        error: `Failed to clear history: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Generate unique history entry ID
   */
  private generateHistoryId(): string {
    return `history_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Generate trend analysis from job entries
   */
  private generateTrendAnalysis(jobs: AnalysisHistoryEntry[]): SkillTrendData[] {
    const skillMap = new Map<string, {
      count: number;
      totalConfidence: number;
      jobIds: Set<string>;
    }>();

    jobs.forEach(job => {
      job.jobPosting.extractedSkills.forEach(skill => {
        const skillKey = skill.name.toLowerCase();
        
        if (!skillMap.has(skillKey)) {
          skillMap.set(skillKey, {
            count: 0,
            totalConfidence: 0,
            jobIds: new Set()
          });
        }

        const skillData = skillMap.get(skillKey)!;
        skillData.count++;
        skillData.totalConfidence += skill.confidence;
        skillData.jobIds.add(job.id);
      });
    });

    const trendData: SkillTrendData[] = [];
    
    skillMap.forEach((data, skillName) => {
      trendData.push({
        skillName,
        frequency: data.count,
        averageImportance: data.totalConfidence / data.count,
        jobIds: Array.from(data.jobIds)
      });
    });

    return trendData;
  }
}