/**
 * Resume Optimization Suggestions System
 * Provides keyword suggestions and resume improvement recommendations
 */

import {
  ExtractedSkill,
  UserSkillProfile,
  JobPosting,
  AnalysisHistoryEntry,
  SkillCategory,
  Priority
} from './types';

export interface KeywordSuggestion {
  keyword: string;
  category: SkillCategory;
  frequency: number; // How often it appears across saved jobs
  importance: number; // 0-1 based on job requirements
  currentlyInProfile: boolean;
  synonyms: string[];
  contextExamples: string[];
}

export interface ResumeOptimizationSuggestion {
  type: OptimizationType;
  priority: Priority;
  title: string;
  description: string;
  keywords?: string[];
  examples?: string[];
  impact: string; // Expected impact on job matching
}

export interface SkillGapTrend {
  skillName: string;
  category: SkillCategory;
  trendDirection: 'increasing' | 'stable' | 'decreasing';
  frequency: number;
  averageImportance: number;
  jobCount: number;
}

export enum OptimizationType {
  KEYWORD_ADDITION = 'keyword_addition',
  SKILL_EMPHASIS = 'skill_emphasis',
  EXPERIENCE_HIGHLIGHT = 'experience_highlight',
  CERTIFICATION_SUGGESTION = 'certification_suggestion',
  SOFT_SKILL_ADDITION = 'soft_skill_addition'
}

export class ResumeOptimizer {
  /**
   * Generate keyword suggestions based on job requirements
   */
  public generateKeywordSuggestions(
    jobPostings: JobPosting[],
    userProfile: UserSkillProfile
  ): KeywordSuggestion[] {
    const keywordFrequency = this.analyzeKeywordFrequency(jobPostings);
    const userSkillNames = userProfile.skills.map(s => s.name.toLowerCase());
    
    const suggestions: KeywordSuggestion[] = [];

    for (const [keyword, data] of keywordFrequency.entries()) {
      const suggestion: KeywordSuggestion = {
        keyword: data.skill.name,
        category: data.skill.category,
        frequency: data.frequency,
        importance: data.averageImportance,
        currentlyInProfile: userSkillNames.includes(keyword),
        synonyms: data.skill.synonyms,
        contextExamples: data.contexts.slice(0, 3) // Top 3 examples
      };

      suggestions.push(suggestion);
    }

    // Sort by importance and frequency, prioritizing missing skills
    return suggestions.sort((a, b) => {
      // Missing skills first
      if (!a.currentlyInProfile && b.currentlyInProfile) return -1;
      if (a.currentlyInProfile && !b.currentlyInProfile) return 1;

      // Then by importance
      const importanceDiff = b.importance - a.importance;
      if (Math.abs(importanceDiff) > 0.1) return importanceDiff;

      // Then by frequency
      return b.frequency - a.frequency;
    });
  }

  /**
   * Create resume improvement recommendations
   */
  public generateResumeOptimizations(
    jobPostings: JobPosting[],
    userProfile: UserSkillProfile,
    analysisHistory: AnalysisHistoryEntry[]
  ): ResumeOptimizationSuggestion[] {
    const suggestions: ResumeOptimizationSuggestion[] = [];
    const keywordSuggestions = this.generateKeywordSuggestions(jobPostings, userProfile);
    const trendAnalysis = this.analyzeSkillTrends(analysisHistory);

    // Keyword addition suggestions
    const missingKeywords = keywordSuggestions
      .filter(k => !k.currentlyInProfile && k.importance > 0.6)
      .slice(0, 5);

    if (missingKeywords.length > 0) {
      suggestions.push({
        type: OptimizationType.KEYWORD_ADDITION,
        priority: Priority.HIGH,
        title: 'Add Missing High-Impact Keywords',
        description: `Add these frequently requested skills to your resume: ${missingKeywords.map(k => k.keyword).join(', ')}`,
        keywords: missingKeywords.map(k => k.keyword),
        examples: missingKeywords.flatMap(k => k.contextExamples).slice(0, 3),
        impact: `Could improve job matching by ${Math.round(missingKeywords.length * 15)}%`
      });
    }

    // Skill emphasis suggestions
    const underemphasizedSkills = this.identifyUnderemphasizedSkills(keywordSuggestions);
    if (underemphasizedSkills.length > 0) {
      suggestions.push({
        type: OptimizationType.SKILL_EMPHASIS,
        priority: Priority.MEDIUM,
        title: 'Emphasize Existing Skills',
        description: `Highlight these skills more prominently: ${underemphasizedSkills.join(', ')}`,
        keywords: underemphasizedSkills,
        impact: 'Better alignment with job requirements'
      });
    }

    // Trending skills suggestions
    const trendingSkills = trendAnalysis
      .filter(t => t.trendDirection === 'increasing' && t.frequency >= 3)
      .slice(0, 3);

    if (trendingSkills.length > 0) {
      suggestions.push({
        type: OptimizationType.SKILL_EMPHASIS,
        priority: Priority.MEDIUM,
        title: 'Focus on Trending Skills',
        description: `These skills are increasingly in demand: ${trendingSkills.map(t => t.skillName).join(', ')}`,
        keywords: trendingSkills.map(t => t.skillName),
        impact: 'Stay ahead of market trends'
      });
    }

    // Certification suggestions
    const certificationSuggestions = this.suggestCertifications(keywordSuggestions, userProfile);
    if (certificationSuggestions.length > 0) {
      suggestions.push({
        type: OptimizationType.CERTIFICATION_SUGGESTION,
        priority: Priority.LOW,
        title: 'Consider Relevant Certifications',
        description: `These certifications could strengthen your profile: ${certificationSuggestions.join(', ')}`,
        keywords: certificationSuggestions,
        impact: 'Demonstrate expertise and commitment'
      });
    }

    // Soft skills suggestions
    const softSkillSuggestions = this.suggestSoftSkills(keywordSuggestions);
    if (softSkillSuggestions.length > 0) {
      suggestions.push({
        type: OptimizationType.SOFT_SKILL_ADDITION,
        priority: Priority.MEDIUM,
        title: 'Add Important Soft Skills',
        description: `Include these soft skills: ${softSkillSuggestions.join(', ')}`,
        keywords: softSkillSuggestions,
        impact: 'Better match for leadership and team roles'
      });
    }

    return suggestions.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Analyze skill trends across saved jobs
   */
  public analyzeSkillTrends(analysisHistory: AnalysisHistoryEntry[]): SkillGapTrend[] {
    if (analysisHistory.length < 3) {
      return []; // Need at least 3 jobs for trend analysis
    }

    const skillFrequencyByTime = new Map<string, { timestamps: Date[], importances: number[] }>();

    // Collect skill data over time
    for (const entry of analysisHistory) {
      for (const skill of entry.jobPosting.extractedSkills) {
        const skillName = skill.name.toLowerCase();
        if (!skillFrequencyByTime.has(skillName)) {
          skillFrequencyByTime.set(skillName, { timestamps: [], importances: [] });
        }
        
        const data = skillFrequencyByTime.get(skillName)!;
        data.timestamps.push(entry.timestamp);
        data.importances.push(skill.confidence);
      }
    }

    const trends: SkillGapTrend[] = [];

    for (const [skillName, data] of skillFrequencyByTime.entries()) {
      if (data.timestamps.length < 2) continue;

      // Calculate trend direction
      const sortedData = data.timestamps
        .map((timestamp, index) => ({ timestamp, importance: data.importances[index] }))
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      const firstHalf = sortedData.slice(0, Math.floor(sortedData.length / 2));
      const secondHalf = sortedData.slice(Math.floor(sortedData.length / 2));

      const firstHalfAvg = firstHalf.reduce((sum, item) => sum + item.importance, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((sum, item) => sum + item.importance, 0) / secondHalf.length;

      let trendDirection: 'increasing' | 'stable' | 'decreasing';
      const difference = secondHalfAvg - firstHalfAvg;
      
      if (difference > 0.1) {
        trendDirection = 'increasing';
      } else if (difference < -0.1) {
        trendDirection = 'decreasing';
      } else {
        trendDirection = 'stable';
      }

      // Find the skill category from the most recent entry
      const recentEntry = analysisHistory
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
      const skillInfo = recentEntry.jobPosting.extractedSkills
        .find(s => s.name.toLowerCase() === skillName);

      if (skillInfo) {
        trends.push({
          skillName: skillInfo.name,
          category: skillInfo.category,
          trendDirection,
          frequency: data.timestamps.length,
          averageImportance: data.importances.reduce((sum, imp) => sum + imp, 0) / data.importances.length,
          jobCount: data.timestamps.length
        });
      }
    }

    return trends.sort((a, b) => {
      // Prioritize increasing trends
      if (a.trendDirection === 'increasing' && b.trendDirection !== 'increasing') return -1;
      if (b.trendDirection === 'increasing' && a.trendDirection !== 'increasing') return 1;
      
      // Then by frequency
      return b.frequency - a.frequency;
    });
  }

  /**
   * Analyze keyword frequency across job postings
   */
  private analyzeKeywordFrequency(jobPostings: JobPosting[]): Map<string, {
    skill: ExtractedSkill;
    frequency: number;
    averageImportance: number;
    contexts: string[];
  }> {
    const keywordData = new Map<string, {
      skill: ExtractedSkill;
      frequency: number;
      totalImportance: number;
      contexts: string[];
    }>();

    for (const job of jobPostings) {
      for (const skill of job.extractedSkills) {
        const skillName = skill.name.toLowerCase();
        
        if (!keywordData.has(skillName)) {
          keywordData.set(skillName, {
            skill,
            frequency: 0,
            totalImportance: 0,
            contexts: []
          });
        }

        const data = keywordData.get(skillName)!;
        data.frequency++;
        data.totalImportance += skill.confidence;
        data.contexts.push(skill.context);
      }
    }

    // Convert to final format with average importance
    const result = new Map<string, {
      skill: ExtractedSkill;
      frequency: number;
      averageImportance: number;
      contexts: string[];
    }>();

    for (const [skillName, data] of keywordData.entries()) {
      result.set(skillName, {
        skill: data.skill,
        frequency: data.frequency,
        averageImportance: data.totalImportance / data.frequency,
        contexts: data.contexts
      });
    }

    return result;
  }

  /**
   * Identify skills that user has but are underemphasized
   */
  private identifyUnderemphasizedSkills(
    keywordSuggestions: KeywordSuggestion[]
  ): string[] {
    return keywordSuggestions
      .filter(k => k.currentlyInProfile && k.importance > 0.7 && k.frequency >= 3)
      .map(k => k.keyword)
      .slice(0, 3);
  }

  /**
   * Suggest relevant certifications
   */
  private suggestCertifications(
    keywordSuggestions: KeywordSuggestion[],
    userProfile: UserSkillProfile
  ): string[] {
    const certificationMap: { [key: string]: string } = {
      'aws': 'AWS Certified Solutions Architect',
      'azure': 'Microsoft Azure Fundamentals',
      'gcp': 'Google Cloud Professional',
      'kubernetes': 'Certified Kubernetes Administrator (CKA)',
      'docker': 'Docker Certified Associate',
      'project management': 'PMP Certification',
      'scrum': 'Certified ScrumMaster (CSM)',
      'security': 'CompTIA Security+',
      'data analysis': 'Google Data Analytics Certificate'
    };

    const suggestions: string[] = [];
    const userSkillNames = userProfile.skills.map(s => s.name.toLowerCase());

    for (const keyword of keywordSuggestions) {
      if (keyword.importance > 0.6 && keyword.frequency >= 2) {
        const skillName = keyword.keyword.toLowerCase();
        
        // Check if user has the skill or related skills
        const hasRelatedSkill = userSkillNames.some(userSkill => 
          userSkill.includes(skillName) || skillName.includes(userSkill)
        );

        if (hasRelatedSkill && certificationMap[skillName]) {
          suggestions.push(certificationMap[skillName]);
        }
      }
    }

    return [...new Set(suggestions)].slice(0, 3); // Remove duplicates and limit
  }

  /**
   * Suggest important soft skills
   */
  private suggestSoftSkills(
    keywordSuggestions: KeywordSuggestion[]
  ): string[] {
    const softSkillKeywords = keywordSuggestions
      .filter(k => k.category === SkillCategory.SOFT_SKILLS && !k.currentlyInProfile)
      .filter(k => k.importance > 0.5 && k.frequency >= 2)
      .map(k => k.keyword)
      .slice(0, 3);

    return softSkillKeywords;
  }
}