/**
 * Core type definitions for the Skill Gap Analyzer Chrome Extension
 */

// ============================================================================
// User Profile Types
// ============================================================================

export interface UserSkillProfile {
  id: string;
  skills: Skill[];
  experience: ExperienceLevel;
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
}

export interface Skill {
  name: string;
  category: SkillCategory;
  proficiency: ProficiencyLevel;
  yearsOfExperience?: number;
  certifications?: string[];
  synonyms: string[];
}

export interface ExperienceLevel {
  totalYears: number;
  level: ExperienceLevelType;
}

export interface UserPreferences {
  preferredLearningStyle: LearningStyle[];
  timeCommitment: number; // hours per week
  focusAreas: SkillCategory[];
  notificationSettings: NotificationSettings;
}

// ============================================================================
// Job Analysis Types
// ============================================================================

export interface JobPosting {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
  requirements: string[];
  extractedSkills: ExtractedSkill[];
  salaryRange?: SalaryRange;
  jobType: JobType;
  experienceLevel: ExperienceLevelType;
  postedDate: Date;
  source: JobSource;
}

export interface ExtractedSkill {
  name: string;
  category: SkillCategory;
  confidence: number; // 0-1
  context: string; // surrounding text
  isRequired: boolean;
  synonyms: string[];
}

export interface SkillGapAnalysis {
  jobId: string;
  userId: string;
  matchingSkills: SkillMatch[];
  missingSkills: ExtractedSkill[];
  overallMatch: number; // 0-1
  recommendations: LearningRecommendation[];
  analysisDate: Date;
}

export interface SkillMatch {
  userSkill: Skill;
  jobSkill: ExtractedSkill;
  matchScore: number; // 0-1
  proficiencyGap?: number; // difference in proficiency levels
}

// ============================================================================
// Learning & Recommendations Types
// ============================================================================

export interface LearningRecommendation {
  skill: ExtractedSkill;
  priority: Priority;
  estimatedTimeToLearn: number; // hours
  resources: LearningResource[];
  prerequisites?: string[];
}

export interface LearningResource {
  title: string;
  type: ResourceType;
  url: string;
  provider: string;
  rating?: number;
  duration?: number; // hours
  cost?: number; // USD
  difficulty: DifficultyLevel;
}

// ============================================================================
// Storage & Privacy Types
// ============================================================================

export interface EncryptedData {
  data: string; // encrypted JSON
  iv: string; // initialization vector
  timestamp: number;
}

export interface StorageMetadata {
  version: string;
  lastBackup?: Date;
  encryptionEnabled: boolean;
}

// ============================================================================
// UI & Extension Types
// ============================================================================

export interface ExtensionState {
  isActive: boolean;
  currentJobSite?: JobSource;
  analysisInProgress: boolean;
  lastAnalysis?: Date;
}

export interface NotificationSettings {
  enableAnalysisComplete: boolean;
  enableNewRecommendations: boolean;
  enableWeeklyProgress: boolean;
  quietHours: {
    enabled: boolean;
    start: string; // HH:MM
    end: string; // HH:MM
  };
}

// ============================================================================
// Enums
// ============================================================================

export enum SkillCategory {
  TECHNICAL = 'technical',
  SOFT_SKILLS = 'soft_skills',
  TOOLS = 'tools',
  CERTIFICATIONS = 'certifications',
  LANGUAGES = 'languages',
  FRAMEWORKS = 'frameworks',
  METHODOLOGIES = 'methodologies'
}

export enum ProficiencyLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert'
}

export enum ExperienceLevelType {
  ENTRY = 'entry',
  MID = 'mid',
  SENIOR = 'senior',
  LEAD = 'lead',
  EXECUTIVE = 'executive'
}

export enum JobType {
  FULL_TIME = 'full_time',
  PART_TIME = 'part_time',
  CONTRACT = 'contract',
  FREELANCE = 'freelance',
  INTERNSHIP = 'internship'
}

export enum JobSource {
  LINKEDIN = 'linkedin',
  INDEED = 'indeed',
  GLASSDOOR = 'glassdoor',
  GOOGLE_JOBS = 'google_jobs'
}

export enum JobSite {
  LINKEDIN = 'linkedin',
  INDEED = 'indeed',
  GLASSDOOR = 'glassdoor'
}

export enum LearningStyle {
  VISUAL = 'visual',
  AUDITORY = 'auditory',
  KINESTHETIC = 'kinesthetic',
  READING = 'reading'
}

export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ResourceType {
  COURSE = 'course',
  TUTORIAL = 'tutorial',
  DOCUMENTATION = 'documentation',
  BOOK = 'book',
  VIDEO = 'video',
  PRACTICE = 'practice',
  CERTIFICATION = 'certification'
}

export enum DifficultyLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced'
}

// ============================================================================
// Job Detection Types
// ============================================================================

export interface JobPageInfo {
  site: JobSite;
  url: string;
  title: string;
  company: string;
  hasJobDescription: boolean;
  selectors: JobSiteSelectors;
}

export interface JobSiteSelectors {
  jobTitle: string;
  company: string;
  description: string;
}

// ============================================================================
// Utility Types
// ============================================================================

export interface SalaryRange {
  min: number;
  max: number;
  currency: string;
  period: 'hourly' | 'monthly' | 'yearly';
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

// ============================================================================
// History and Analysis Types
// ============================================================================

export interface AnalysisHistoryEntry {
  id: string;
  jobPosting: JobPosting;
  analysis: SkillGapAnalysis;
  timestamp: Date;
  userProfileSnapshot: UserSkillProfile;
}

export interface ComparisonResult {
  jobs: AnalysisHistoryEntry[];
  commonSkills: ExtractedSkill[];
  uniqueSkills: Map<string, ExtractedSkill[]>; // jobId -> unique skills
  matchScoreComparison: Map<string, number>; // jobId -> match score
  trendAnalysis: SkillTrendData[];
}

export interface SkillTrendData {
  skillName: string;
  frequency: number; // how often this skill appears across jobs
  averageImportance: number; // average confidence/importance score
  jobIds: string[]; // which jobs require this skill
}

export interface HistorySearchOptions {
  company?: string;
  skillName?: string;
  minMatchScore?: number;
  maxMatchScore?: number;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
}