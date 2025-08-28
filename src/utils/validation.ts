/**
 * Data validation utility functions
 * 
 * This module provides validation functions for user input,
 * API responses, and data integrity checks.
 */

import type { UserSkillProfile, JobPosting, ExtractedSkill } from '@/core/types';

/**
 * Validate user skill profile data structure
 */
export function validateSkillProfile(profile: any): profile is UserSkillProfile {
  if (!profile || typeof profile !== 'object') {
    return false;
  }
  
  // Check required fields exist
  const requiredFields = ['id', 'skills', 'experience', 'preferences', 'createdAt', 'updatedAt'];
  if (!requiredFields.every(field => field in profile)) {
    return false;
  }

  // Validate ID
  if (typeof profile.id !== 'string' || profile.id.trim().length === 0) {
    return false;
  }

  // Validate skills array
  if (!Array.isArray(profile.skills)) {
    return false;
  }

  // Validate each skill
  for (const skill of profile.skills) {
    if (!validateSkill(skill)) {
      return false;
    }
  }

  // Validate experience
  if (!validateExperienceLevel(profile.experience)) {
    return false;
  }

  // Validate preferences
  if (!validateUserPreferences(profile.preferences)) {
    return false;
  }

  // Validate dates
  if (!(profile.createdAt instanceof Date) || !(profile.updatedAt instanceof Date)) {
    return false;
  }

  return true;
}

/**
 * Validate individual skill object
 */
export function validateSkill(skill: any): boolean {
  if (!skill || typeof skill !== 'object') {
    return false;
  }

  // Required fields
  if (typeof skill.name !== 'string' || skill.name.trim().length === 0) {
    return false;
  }

  if (!skill.category || typeof skill.category !== 'string') {
    return false;
  }

  if (!skill.proficiency || typeof skill.proficiency !== 'string') {
    return false;
  }

  // Optional fields validation
  if (skill.yearsOfExperience !== undefined && 
      (typeof skill.yearsOfExperience !== 'number' || skill.yearsOfExperience < 0)) {
    return false;
  }

  if (skill.certifications !== undefined && !Array.isArray(skill.certifications)) {
    return false;
  }

  if (!Array.isArray(skill.synonyms)) {
    return false;
  }

  return true;
}

/**
 * Validate experience level object
 */
export function validateExperienceLevel(experience: any): boolean {
  if (!experience || typeof experience !== 'object') {
    return false;
  }

  if (typeof experience.totalYears !== 'number' || experience.totalYears < 0) {
    return false;
  }

  if (!experience.level || typeof experience.level !== 'string') {
    return false;
  }

  return true;
}

/**
 * Validate user preferences object
 */
export function validateUserPreferences(preferences: any): boolean {
  if (!preferences || typeof preferences !== 'object') {
    return false;
  }

  // Validate preferredLearningStyle
  if (!Array.isArray(preferences.preferredLearningStyle)) {
    return false;
  }

  // Validate timeCommitment
  if (typeof preferences.timeCommitment !== 'number' || preferences.timeCommitment < 0) {
    return false;
  }

  // Validate focusAreas
  if (!Array.isArray(preferences.focusAreas)) {
    return false;
  }

  // Validate notificationSettings
  if (!preferences.notificationSettings || typeof preferences.notificationSettings !== 'object') {
    return false;
  }

  return true;
}

/**
 * Validate job posting data structure
 * To be implemented in later tasks
 */
export function validateJobPosting(job: any): job is JobPosting {
  // Implementation placeholder
  console.log('Validation: Validate job posting called');
  
  if (!job || typeof job !== 'object') {
    return false;
  }
  
  const requiredFields = ['id', 'title', 'company', 'description', 'source'];
  return requiredFields.every(field => field in job);
}

/**
 * Validate extracted skill data
 * To be implemented in later tasks
 */
export function validateExtractedSkill(skill: any): skill is ExtractedSkill {
  // Implementation placeholder
  console.log('Validation: Validate extracted skill called');
  
  if (!skill || typeof skill !== 'object') {
    return false;
  }
  
  return 'name' in skill && 'category' in skill && 'confidence' in skill;
}

/**
 * Sanitize user input to prevent XSS
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  // Remove HTML tags, script content, and dangerous characters
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
}

/**
 * Sanitize skill name
 */
export function sanitizeSkillName(name: string): string {
  const sanitized = sanitizeInput(name);
  // Additional validation for skill names - allow alphanumeric, spaces, hyphens, plus, dots
  // Remove # and other special characters except those commonly used in tech names
  return sanitized.replace(/[^\w\s\-\+\.]/g, '').trim();
}

/**
 * Validate URL format
 * To be implemented in later tasks
 */
export function isValidUrl(url: string): boolean {
  // Implementation placeholder
  console.log('Validation: Is valid URL called');
  
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate email format
 * To be implemented in later tasks
 */
export function isValidEmail(email: string): boolean {
  // Implementation placeholder
  console.log('Validation: Is valid email called');
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}