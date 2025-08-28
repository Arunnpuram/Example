/**
 * Real-time job analysis workflow manager
 * Handles the complete pipeline from job content extraction to skill gap analysis
 */

import { JobPageDetector } from './job-detector';
import { JobContentExtractor, ExtractedJobContent } from './job-extractor';
import { SkillExtractionEngine } from '@/core/nlp';
import { SkillMatchingEngine } from '@/core/matching';
import { JobPageInfo, SkillGapAnalysis, JobPosting } from '@/core/types';
import { ChromeAnalyticsClient, PerformanceTracker, ErrorTracker } from '@/utils/analytics-client';

export interface AnalysisProgress {
  stage: AnalysisStage;
  progress: number; // 0-100
  message: string;
  timestamp: Date;
}

export enum AnalysisStage {
  INITIALIZING = 'initializing',
  EXTRACTING_CONTENT = 'extracting_content',
  EXTRACTING_SKILLS = 'extracting_skills',
  MATCHING_SKILLS = 'matching_skills',
  GENERATING_RECOMMENDATIONS = 'generating_recommendations',
  COMPLETE = 'complete',
  ERROR = 'error'
}

export interface CachedAnalysis {
  jobUrl: string;
  contentHash: string;
  analysis: SkillGapAnalysis;
  extractedAt: Date;
  expiresAt: Date;
}

/**
 * Manages the real-time job analysis workflow
 */
export class AnalysisWorkflowManager {
  private static instance: AnalysisWorkflowManager | null = null;
  
  private detector: JobPageDetector;
  private extractor: JobContentExtractor;
  private skillExtractor: SkillExtractionEngine | null = null;
  private skillMatcher: SkillMatchingEngine | null = null;
  
  private analysisCache = new Map<string, CachedAnalysis>();
  private currentAnalysis: Promise<SkillGapAnalysis | null> | null = null;
  private progressCallbacks: ((progress: AnalysisProgress) => void)[] = [];
  
  // Analytics utilities
  private analyticsClient = ChromeAnalyticsClient.getInstance();
  private performanceTracker = new PerformanceTracker();
  private errorTracker = new ErrorTracker();
  
  // Configuration
  private readonly CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes
  private readonly MAX_CACHE_SIZE = 50;

  private constructor(detector: JobPageDetector, extractor: JobContentExtractor) {
    this.detector = detector;
    this.extractor = extractor;
  }

  /**
   * Get or create singleton instance
   */
  public static getInstance(detector?: JobPageDetector, extractor?: JobContentExtractor): AnalysisWorkflowManager {
    if (!AnalysisWorkflowManager.instance) {
      if (!detector || !extractor) {
        throw new Error('Detector and extractor required for first initialization');
      }
      AnalysisWorkflowManager.instance = new AnalysisWorkflowManager(detector, extractor);
    }
    return AnalysisWorkflowManager.instance;
  }

  /**
   * Initialize the analysis engines
   */
  public async initialize(): Promise<void> {
    try {
      this.updateProgress(AnalysisStage.INITIALIZING, 0, 'Initializing analysis engines...');
      
      // Track initialization performance
      this.performanceTracker.start('analysis_engines_initialization');
      
      // Initialize skill extraction engine
      this.skillExtractor = SkillExtractionEngine.getInstance();
      await this.skillExtractor.initialize();
      
      this.updateProgress(AnalysisStage.INITIALIZING, 50, 'Skill extraction engine ready');
      
      // Initialize skill matching engine
      this.skillMatcher = SkillMatchingEngine.getInstance();
      
      this.updateProgress(AnalysisStage.INITIALIZING, 100, 'Analysis engines initialized');
      
      // Track successful initialization
      await this.performanceTracker.end('analysis_engines_initialization');
      
      await this.analyticsClient.trackEvent('analysis_engines_initialized', {
        url: window.location.href
      });
      
    } catch (error) {
      this.updateProgress(AnalysisStage.ERROR, 0, `Initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Track initialization error
      await this.errorTracker.trackError(error as Error, 'analysis_engines_initialization');
      
      throw error;
    }
  }

  /**
   * Analyze current job page
   */
  public async analyzeCurrentJob(forceRefresh = false): Promise<SkillGapAnalysis | null> {
    // Prevent concurrent analysis
    if (this.currentAnalysis && !forceRefresh) {
      return this.currentAnalysis;
    }

    this.currentAnalysis = this.performAnalysis(forceRefresh);
    return this.currentAnalysis;
  }

  /**
   * Perform the complete analysis workflow
   */
  private async performAnalysis(forceRefresh: boolean): Promise<SkillGapAnalysis | null> {
    try {
      // Step 1: Detect current job page
      this.updateProgress(AnalysisStage.EXTRACTING_CONTENT, 0, 'Detecting job page...');
      
      const jobInfo = this.detector.detectCurrentPage();
      if (!jobInfo) {
        this.updateProgress(AnalysisStage.ERROR, 0, 'No job page detected');
        return null;
      }

      // Step 2: Extract job content
      this.updateProgress(AnalysisStage.EXTRACTING_CONTENT, 25, 'Extracting job content...');
      
      const jobContent = this.extractor.extractJobContent(jobInfo);
      if (!jobContent || !this.extractor.validateJobContent(jobContent)) {
        this.updateProgress(AnalysisStage.ERROR, 0, 'Failed to extract valid job content');
        return null;
      }

      // Step 3: Check cache
      const contentHash = this.generateContentHash(jobContent);
      const cacheKey = this.generateCacheKey(jobInfo.url, contentHash);
      
      if (!forceRefresh) {
        const cachedAnalysis = this.getCachedAnalysis(cacheKey);
        if (cachedAnalysis) {
          this.updateProgress(AnalysisStage.COMPLETE, 100, 'Analysis loaded from cache');
          
          // Track cache hit
          await this.analyticsClient.trackEvent('analysis_cache_hit', {
            site: jobInfo.site,
            title: jobInfo.title,
            company: jobInfo.company
          });
          
          return cachedAnalysis.analysis;
        }
      }

      // Step 4: Extract skills from job content
      this.updateProgress(AnalysisStage.EXTRACTING_SKILLS, 50, 'Extracting required skills...');
      
      if (!this.skillExtractor) {
        throw new Error('Skill extraction engine not initialized');
      }

      const extractedSkills = await this.performanceTracker.measure(
        'skill_extraction_duration',
        () => this.skillExtractor!.extractSkills(jobContent.description),
        {
          contentLength: jobContent.description.length,
          site: jobInfo.site
        }
      );
      
      this.updateProgress(AnalysisStage.EXTRACTING_SKILLS, 75, `Found ${extractedSkills.length} skills`);

      // Step 5: Get user profile for matching
      this.updateProgress(AnalysisStage.MATCHING_SKILLS, 80, 'Loading user profile...');
      
      const userProfile = await this.getUserProfile();
      if (!userProfile) {
        this.updateProgress(AnalysisStage.ERROR, 0, 'User profile not found');
        return null;
      }

      // Step 6: Perform skill matching
      this.updateProgress(AnalysisStage.MATCHING_SKILLS, 90, 'Analyzing skill gaps...');
      
      if (!this.skillMatcher) {
        throw new Error('Skill matching engine not initialized');
      }

      // Create JobPosting object for analysis
      const jobPosting: JobPosting = {
        id: this.generateJobId(jobInfo),
        title: jobInfo.title,
        company: jobInfo.company,
        location: '', // Not available from job info
        url: jobInfo.url,
        description: jobContent.description,
        requirements: jobContent.requirements ? [jobContent.requirements] : [],
        extractedSkills: extractedSkills,
        jobType: 'full_time' as any, // Default assumption
        experienceLevel: 'mid' as any, // Default assumption
        postedDate: new Date(),
        source: jobInfo.site as any
      };

      const analysis = await this.performanceTracker.measure(
        'skill_matching_duration',
        () => this.skillMatcher!.analyzeSkillGap(userProfile, jobPosting),
        {
          userSkillCount: userProfile.skills?.length || 0,
          jobSkillCount: extractedSkills.length,
          site: jobInfo.site
        }
      );

      // Step 7: Cache the analysis
      this.cacheAnalysis(cacheKey, jobInfo.url, contentHash, analysis);

      this.updateProgress(AnalysisStage.COMPLETE, 100, 'Analysis complete');
      
      // Track successful analysis completion
      await this.analyticsClient.trackEvent('skill_gap_analysis_completed', {
        site: jobInfo.site,
        title: jobInfo.title,
        company: jobInfo.company,
        overallMatch: analysis.overallMatch,
        skillsMatched: analysis.matchingSkills?.length || 0,
        skillsMissing: analysis.missingSkills?.length || 0,
        fromCache: false
      });
      
      return analysis;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.updateProgress(AnalysisStage.ERROR, 0, `Analysis failed: ${errorMessage}`);
      console.error('❌ Analysis workflow error:', error);
      
      // Track analysis error
      await this.errorTracker.trackError(error as Error, 'skill_gap_analysis', {
        stage: 'analysis_workflow',
        url: window.location.href
      });
      
      return null;
    } finally {
      this.currentAnalysis = null;
    }
  }

  /**
   * Get user profile from background script
   */
  private async getUserProfile(): Promise<any> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_USER_PROFILE',
        timestamp: Date.now()
      });

      if (response.success && response.data) {
        return response.data;
      }

      return null;
    } catch (error) {
      console.error('❌ Failed to get user profile:', error);
      return null;
    }
  }

  /**
   * Generate content hash for caching
   */
  private generateContentHash(content: ExtractedJobContent): string {
    const hashInput = `${content.title}|${content.company}|${content.description}|${content.requirements}`;
    
    // Simple hash function (in production, use a proper hash library)
    let hash = 0;
    for (let i = 0; i < hashInput.length; i++) {
      const char = hashInput.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(36);
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(url: string, contentHash: string): string {
    return `${url}:${contentHash}`;
  }

  /**
   * Generate job ID
   */
  private generateJobId(jobInfo: JobPageInfo): string {
    return `${jobInfo.site}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get cached analysis if valid
   */
  private getCachedAnalysis(cacheKey: string): CachedAnalysis | null {
    const cached = this.analysisCache.get(cacheKey);
    
    if (!cached) {
      return null;
    }

    // Check if cache is expired
    if (new Date() > cached.expiresAt) {
      this.analysisCache.delete(cacheKey);
      return null;
    }

    return cached;
  }

  /**
   * Cache analysis result
   */
  private cacheAnalysis(cacheKey: string, jobUrl: string, contentHash: string, analysis: SkillGapAnalysis): void {
    // Clean up old cache entries if at capacity
    if (this.analysisCache.size >= this.MAX_CACHE_SIZE) {
      this.cleanupCache();
    }

    const cached: CachedAnalysis = {
      jobUrl,
      contentHash,
      analysis,
      extractedAt: new Date(),
      expiresAt: new Date(Date.now() + this.CACHE_DURATION_MS)
    };

    this.analysisCache.set(cacheKey, cached);
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = new Date();
    const toDelete: string[] = [];

    for (const [key, cached] of this.analysisCache.entries()) {
      if (now > cached.expiresAt) {
        toDelete.push(key);
      }
    }

    // If no expired entries, remove oldest entries
    if (toDelete.length === 0) {
      const entries = Array.from(this.analysisCache.entries());
      entries.sort((a, b) => a[1].extractedAt.getTime() - b[1].extractedAt.getTime());
      
      const removeCount = Math.floor(this.MAX_CACHE_SIZE * 0.2); // Remove 20%
      for (let i = 0; i < removeCount && i < entries.length; i++) {
        toDelete.push(entries[i][0]);
      }
    }

    toDelete.forEach(key => this.analysisCache.delete(key));
  }

  /**
   * Add progress callback
   */
  public onProgress(callback: (progress: AnalysisProgress) => void): void {
    this.progressCallbacks.push(callback);
  }

  /**
   * Remove progress callback
   */
  public removeProgressCallback(callback: (progress: AnalysisProgress) => void): void {
    const index = this.progressCallbacks.indexOf(callback);
    if (index > -1) {
      this.progressCallbacks.splice(index, 1);
    }
  }

  /**
   * Update progress and notify callbacks
   */
  private updateProgress(stage: AnalysisStage, progress: number, message: string): void {
    const progressUpdate: AnalysisProgress = {
      stage,
      progress,
      message,
      timestamp: new Date()
    };

    console.log(`🔄 Analysis Progress: ${stage} (${progress}%) - ${message}`);

    this.progressCallbacks.forEach(callback => {
      try {
        callback(progressUpdate);
      } catch (error) {
        console.error('❌ Error in progress callback:', error);
      }
    });
  }

  /**
   * Get current analysis status
   */
  public isAnalyzing(): boolean {
    return this.currentAnalysis !== null;
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { size: number; maxSize: number; hitRate?: number } {
    return {
      size: this.analysisCache.size,
      maxSize: this.MAX_CACHE_SIZE
    };
  }

  /**
   * Clear all cached analyses
   */
  public clearCache(): void {
    this.analysisCache.clear();
  }

  /**
   * Destroy the workflow manager
   */
  public destroy(): void {
    this.progressCallbacks = [];
    this.analysisCache.clear();
    this.currentAnalysis = null;
    AnalysisWorkflowManager.instance = null;
  }
}