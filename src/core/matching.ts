/**
 * Skill matching and gap analysis module
 * 
 * This module compares user skills with job requirements
 * and generates personalized learning recommendations.
 */

import type { 
  UserSkillProfile, 
  JobPosting, 
  SkillGapAnalysis, 
  SkillMatch,
  LearningRecommendation,
  ExtractedSkill,
  Skill
} from './types';

import {
  SkillCategory,
  ProficiencyLevel,
  Priority,
  ResourceType,
  DifficultyLevel
} from './types';

interface SkillImportanceWeights {
  [SkillCategory.TECHNICAL]: number;
  [SkillCategory.FRAMEWORKS]: number;
  [SkillCategory.TOOLS]: number;
  [SkillCategory.METHODOLOGIES]: number;
  [SkillCategory.CERTIFICATIONS]: number;
  [SkillCategory.LANGUAGES]: number;
  [SkillCategory.SOFT_SKILLS]: number;
}

interface ProficiencyScores {
  [ProficiencyLevel.BEGINNER]: number;
  [ProficiencyLevel.INTERMEDIATE]: number;
  [ProficiencyLevel.ADVANCED]: number;
  [ProficiencyLevel.EXPERT]: number;
}

export class SkillMatchingEngine {
  private static instance: SkillMatchingEngine;
  
  // Importance weights for different skill categories
  private readonly categoryWeights: SkillImportanceWeights = {
    [SkillCategory.TECHNICAL]: 1.0,
    [SkillCategory.FRAMEWORKS]: 0.9,
    [SkillCategory.TOOLS]: 0.8,
    [SkillCategory.METHODOLOGIES]: 0.7,
    [SkillCategory.CERTIFICATIONS]: 0.9,
    [SkillCategory.LANGUAGES]: 0.6,
    [SkillCategory.SOFT_SKILLS]: 0.5
  };

  // Proficiency level numeric scores
  private readonly proficiencyScores: ProficiencyScores = {
    [ProficiencyLevel.BEGINNER]: 0.25,
    [ProficiencyLevel.INTERMEDIATE]: 0.5,
    [ProficiencyLevel.ADVANCED]: 0.75,
    [ProficiencyLevel.EXPERT]: 1.0
  };

  private constructor() {
    // Private constructor for singleton pattern
  }

  public static getInstance(): SkillMatchingEngine {
    if (!SkillMatchingEngine.instance) {
      SkillMatchingEngine.instance = new SkillMatchingEngine();
    }
    return SkillMatchingEngine.instance;
  }

  /**
   * Analyze skill gaps between user profile and job requirements
   */
  async analyzeSkillGap(
    userProfile: UserSkillProfile, 
    jobPosting: JobPosting
  ): Promise<SkillGapAnalysis> {
    const matchingSkills: SkillMatch[] = [];
    const missingSkills: ExtractedSkill[] = [];
    
    // Create a map of user skills for quick lookup
    const userSkillMap = new Map<string, Skill>();
    userProfile.skills.forEach(skill => {
      userSkillMap.set(skill.name.toLowerCase(), skill);
      // Also map synonyms
      skill.synonyms.forEach(synonym => {
        userSkillMap.set(synonym.toLowerCase(), skill);
      });
    });

    // Analyze each job requirement
    for (const jobSkill of jobPosting.extractedSkills) {
      const matchedUserSkill = this.findMatchingUserSkill(jobSkill, userSkillMap);
      
      if (matchedUserSkill) {
        const skillMatch = this.calculateSkillMatch(matchedUserSkill, jobSkill);
        matchingSkills.push(skillMatch);
      } else {
        missingSkills.push(jobSkill);
      }
    }

    // Calculate overall match score
    const overallMatch = this.calculateOverallMatch(matchingSkills, jobPosting.extractedSkills);

    // Generate recommendations for missing skills
    const recommendations = await this.generateRecommendations(missingSkills, userProfile);

    return {
      jobId: jobPosting.id,
      userId: userProfile.id,
      matchingSkills,
      missingSkills,
      overallMatch,
      recommendations,
      analysisDate: new Date()
    };
  }

  /**
   * Calculate match score between user skill and job requirement
   */
  calculateSkillMatch(userSkill: Skill, jobSkill: ExtractedSkill): SkillMatch {
    // Base match score starts at 1.0 for exact skill match
    let matchScore = 1.0;

    // Adjust based on proficiency level vs job requirements
    const userProficiencyScore = this.proficiencyScores[userSkill.proficiency];
    const requiredProficiencyScore = this.estimateRequiredProficiency(jobSkill);
    
    // Calculate proficiency gap
    const proficiencyGap = Math.max(0, requiredProficiencyScore - userProficiencyScore);
    
    // Reduce match score based on proficiency gap
    matchScore -= proficiencyGap * 0.3;

    // Adjust based on job skill confidence
    matchScore *= jobSkill.confidence;

    // Adjust based on skill category importance
    const categoryWeight = this.categoryWeights[jobSkill.category];
    matchScore *= categoryWeight;

    // Boost score if skill is required
    if (jobSkill.isRequired) {
      matchScore *= 1.1;
    }

    // Ensure score is between 0 and 1
    matchScore = Math.max(0, Math.min(1, matchScore));

    return {
      userSkill,
      jobSkill,
      matchScore,
      proficiencyGap: proficiencyGap > 0 ? proficiencyGap : undefined
    };
  }

  /**
   * Generate learning recommendations for missing skills
   */
  async generateRecommendations(
    missingSkills: ExtractedSkill[],
    userProfile: UserSkillProfile
  ): Promise<LearningRecommendation[]> {
    const recommendations: LearningRecommendation[] = [];

    for (const skill of missingSkills) {
      const priority = this.calculateSkillPriority(skill);
      const estimatedTime = this.estimateLearningTime(skill, userProfile);
      const resources = this.generateLearningResources(skill);
      const prerequisites = this.identifyPrerequisites(skill, userProfile);

      recommendations.push({
        skill,
        priority,
        estimatedTimeToLearn: estimatedTime,
        resources,
        prerequisites
      });
    }

    // Sort by priority and importance
    recommendations.sort((a, b) => {
      const priorityOrder = { 
        [Priority.CRITICAL]: 4, 
        [Priority.HIGH]: 3, 
        [Priority.MEDIUM]: 2, 
        [Priority.LOW]: 1 
      };
      
      const aPriorityScore = priorityOrder[a.priority];
      const bPriorityScore = priorityOrder[b.priority];
      
      if (aPriorityScore !== bPriorityScore) {
        return bPriorityScore - aPriorityScore;
      }
      
      // Secondary sort by category weight
      const aWeight = this.categoryWeights[a.skill.category];
      const bWeight = this.categoryWeights[b.skill.category];
      return bWeight - aWeight;
    });

    return recommendations;
  }

  /**
   * Calculate overall job match percentage
   */
  calculateOverallMatch(matchingSkills: SkillMatch[], allJobSkills: ExtractedSkill[]): number {
    if (allJobSkills.length === 0) return 1.0;

    let totalWeightedScore = 0;
    let totalWeight = 0;

    // Calculate weighted score for matching skills
    matchingSkills.forEach(match => {
      const weight = this.getSkillWeight(match.jobSkill);
      totalWeightedScore += match.matchScore * weight;
      totalWeight += weight;
    });

    // Add penalty for missing skills
    const missingSkillsCount = allJobSkills.length - matchingSkills.length;
    const missingSkillsPenalty = missingSkillsCount * 0.1; // 10% penalty per missing skill

    // Calculate base match percentage
    const baseMatch = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
    
    // Apply missing skills penalty
    const finalMatch = Math.max(0, baseMatch - missingSkillsPenalty);

    return Math.min(1.0, finalMatch);
  }

  /**
   * Find matching user skill for a job requirement
   */
  private findMatchingUserSkill(jobSkill: ExtractedSkill, userSkillMap: Map<string, Skill>): Skill | null {
    // Direct name match
    let userSkill = userSkillMap.get(jobSkill.name.toLowerCase());
    if (userSkill) return userSkill;

    // Check synonyms
    for (const synonym of jobSkill.synonyms) {
      userSkill = userSkillMap.get(synonym.toLowerCase());
      if (userSkill) return userSkill;
    }

    // Fuzzy matching for similar skills
    const jobSkillName = jobSkill.name.toLowerCase();
    for (const [userSkillName, skill] of userSkillMap) {
      if (this.isSimilarSkill(jobSkillName, userSkillName)) {
        return skill;
      }
    }

    return null;
  }

  /**
   * Check if two skills are similar (fuzzy matching)
   */
  private isSimilarSkill(skill1: string, skill2: string): boolean {
    // Simple similarity check - can be enhanced with more sophisticated algorithms
    const similarity = this.calculateStringSimilarity(skill1, skill2);
    return similarity > 0.8;
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    
    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;

    const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(null));

    for (let i = 0; i <= len1; i++) matrix[0][i] = i;
    for (let j = 0; j <= len2; j++) matrix[j][0] = j;

    for (let j = 1; j <= len2; j++) {
      for (let i = 1; i <= len1; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j - 1][i] + 1,     // deletion
          matrix[j][i - 1] + 1,     // insertion
          matrix[j - 1][i - 1] + cost // substitution
        );
      }
    }

    const maxLen = Math.max(len1, len2);
    return (maxLen - matrix[len2][len1]) / maxLen;
  }

  /**
   * Estimate required proficiency level for a job skill
   */
  private estimateRequiredProficiency(jobSkill: ExtractedSkill): number {
    let requiredLevel = 0.5; // Default to intermediate

    // Adjust based on context clues
    const context = jobSkill.context.toLowerCase();
    
    if (/expert|senior|lead|architect|principal/i.test(context)) {
      requiredLevel = 0.9; // Expert level
    } else if (/advanced|proficient|strong|extensive/i.test(context)) {
      requiredLevel = 0.75; // Advanced level
    } else if (/experience|familiar|knowledge/i.test(context)) {
      requiredLevel = 0.5; // Intermediate level
    } else if (/basic|entry|junior|beginner/i.test(context)) {
      requiredLevel = 0.25; // Beginner level
    }

    // Adjust based on whether skill is required
    if (jobSkill.isRequired) {
      requiredLevel = Math.max(requiredLevel, 0.5);
    }

    return requiredLevel;
  }

  /**
   * Calculate priority for learning a missing skill
   */
  private calculateSkillPriority(skill: ExtractedSkill): Priority {
    let priorityScore = 0;

    // Base priority on category importance
    priorityScore += this.categoryWeights[skill.category] * 40;

    // Increase priority for required skills
    if (skill.isRequired) {
      priorityScore += 30;
    }

    // Increase priority based on confidence
    priorityScore += skill.confidence * 20;

    // Increase priority for technical skills
    if (skill.category === SkillCategory.TECHNICAL || skill.category === SkillCategory.FRAMEWORKS) {
      priorityScore += 10;
    }

    // Convert score to priority level
    if (priorityScore >= 80) return Priority.CRITICAL;
    if (priorityScore >= 60) return Priority.HIGH;
    if (priorityScore >= 40) return Priority.MEDIUM;
    return Priority.LOW;
  }

  /**
   * Estimate time needed to learn a skill
   */
  private estimateLearningTime(skill: ExtractedSkill, userProfile: UserSkillProfile): number {
    let baseHours = 40; // Default 40 hours

    // Adjust based on skill category
    switch (skill.category) {
      case SkillCategory.TECHNICAL:
        baseHours = 80;
        break;
      case SkillCategory.FRAMEWORKS:
        baseHours = 60;
        break;
      case SkillCategory.TOOLS:
        baseHours = 30;
        break;
      case SkillCategory.METHODOLOGIES:
        baseHours = 20;
        break;
      case SkillCategory.SOFT_SKILLS:
        baseHours = 50;
        break;
      case SkillCategory.CERTIFICATIONS:
        baseHours = 100;
        break;
      case SkillCategory.LANGUAGES:
        baseHours = 200;
        break;
    }

    // Adjust based on user's experience level
    const experienceMultiplier = userProfile.experience.totalYears > 5 ? 0.8 : 1.2;
    baseHours *= experienceMultiplier;

    // Adjust based on related skills user already has
    const relatedSkillsCount = this.countRelatedSkills(skill, userProfile.skills);
    const relatedSkillsMultiplier = Math.max(0.5, 1 - (relatedSkillsCount * 0.1));
    baseHours *= relatedSkillsMultiplier;

    return Math.round(baseHours);
  }

  /**
   * Generate learning resources for a skill
   */
  private generateLearningResources(skill: ExtractedSkill) {
    // This is a simplified implementation - in a real system, this would
    // connect to a database of learning resources
    const resources = [];

    // Add course recommendation
    resources.push({
      title: `Complete ${skill.name} Course`,
      type: ResourceType.COURSE,
      url: `https://example.com/courses/${skill.name.toLowerCase()}`,
      provider: 'Online Learning Platform',
      rating: 4.5,
      duration: 20,
      cost: 49.99,
      difficulty: DifficultyLevel.INTERMEDIATE
    });

    // Add documentation
    resources.push({
      title: `${skill.name} Official Documentation`,
      type: ResourceType.DOCUMENTATION,
      url: `https://docs.${skill.name.toLowerCase()}.com`,
      provider: 'Official',
      duration: 5,
      cost: 0,
      difficulty: DifficultyLevel.INTERMEDIATE
    });

    // Add practice resource
    resources.push({
      title: `${skill.name} Practice Exercises`,
      type: ResourceType.PRACTICE,
      url: `https://practice.com/${skill.name.toLowerCase()}`,
      provider: 'Practice Platform',
      rating: 4.2,
      duration: 10,
      cost: 0,
      difficulty: DifficultyLevel.BEGINNER
    });

    return resources;
  }

  /**
   * Identify prerequisites for learning a skill
   */
  private identifyPrerequisites(skill: ExtractedSkill, userProfile: UserSkillProfile): string[] {
    const prerequisites: string[] = [];
    const userSkillNames = userProfile.skills.map(s => s.name.toLowerCase());

    // Define common prerequisites
    const prerequisiteMap: Record<string, string[]> = {
      'react': ['javascript', 'html', 'css'],
      'angular': ['javascript', 'typescript', 'html', 'css'],
      'vue': ['javascript', 'html', 'css'],
      'node.js': ['javascript'],
      'express': ['javascript', 'node.js'],
      'django': ['python'],
      'flask': ['python'],
      'spring': ['java'],
      'kubernetes': ['docker'],
      'terraform': ['cloud computing'],
      'jenkins': ['ci/cd basics']
    };

    const skillPrereqs = prerequisiteMap[skill.name.toLowerCase()] || [];
    
    // Add prerequisites that user doesn't have
    skillPrereqs.forEach(prereq => {
      if (!userSkillNames.includes(prereq.toLowerCase())) {
        prerequisites.push(prereq);
      }
    });

    return prerequisites;
  }

  /**
   * Count related skills user already has
   */
  private countRelatedSkills(targetSkill: ExtractedSkill, userSkills: Skill[]): number {
    let count = 0;
    
    userSkills.forEach(userSkill => {
      if (userSkill.category === targetSkill.category) {
        count++;
      }
    });

    return count;
  }

  /**
   * Get weight for a skill based on its properties
   */
  private getSkillWeight(skill: ExtractedSkill): number {
    let weight = this.categoryWeights[skill.category];
    
    // Increase weight for required skills
    if (skill.isRequired) {
      weight *= 1.5;
    }
    
    // Adjust by confidence
    weight *= skill.confidence;
    
    return weight;
  }
}