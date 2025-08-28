/**
 * Core module exports for the Skill Gap Analyzer Chrome Extension
 * 
 * This module provides the main business logic and data structures
 * for skill analysis, job parsing, and user profile management.
 */

// Type definitions
export * from './types';

// Core services (to be implemented in later tasks)
export * from './storage';
export * from './nlp';
export * from './matching';

// Re-export commonly used types for convenience
export type {
  UserSkillProfile,
  JobPosting,
  SkillGapAnalysis,
  LearningRecommendation,
  ExtractedSkill,
  Skill
} from './types';