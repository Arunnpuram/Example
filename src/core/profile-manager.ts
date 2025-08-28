/**
 * ProfileManager - Manages user skill profiles with encryption
 * 
 * This module provides CRUD operations for user skill profiles
 * with data validation, sanitization, and encrypted storage.
 */

import { StorageManager, type StorageResult } from './storage';
import { validateSkillProfile, validateSkill, sanitizeInput, sanitizeSkillName } from '@/utils/validation';
import type { 
  UserSkillProfile, 
  Skill, 
  ExperienceLevel,
  UserPreferences
} from '@/core/types';
import { 
  SkillCategory, 
  ProficiencyLevel, 
  LearningStyle,
  ExperienceLevelType
} from '@/core/types';

export interface ProfileCreateOptions {
  skills?: Skill[];
  experience?: ExperienceLevel;
  preferences?: Partial<UserPreferences>;
}

export interface ProfileUpdateOptions {
  skills?: Skill[];
  experience?: ExperienceLevel;
  preferences?: Partial<UserPreferences>;
}

export interface SkillImportResult {
  success: boolean;
  importedSkills: Skill[];
  errors: string[];
}

export class ProfileManager {
  private static instance: ProfileManager;
  private storageManager: StorageManager;
  private currentProfile: UserSkillProfile | null = null;
  private readonly PROFILE_STORAGE_KEY = 'user_skill_profile';

  private constructor() {
    this.storageManager = StorageManager.getInstance();
  }

  public static getInstance(): ProfileManager {
    if (!ProfileManager.instance) {
      ProfileManager.instance = new ProfileManager();
    }
    return ProfileManager.instance;
  }

  /**
   * Create a new user skill profile
   */
  async createProfile(options: ProfileCreateOptions = {}): Promise<StorageResult<UserSkillProfile>> {
    try {
      const now = new Date();
      const profileId = this.generateProfileId();

      const defaultPreferences: UserPreferences = {
        preferredLearningStyle: [LearningStyle.VISUAL],
        timeCommitment: 5, // 5 hours per week default
        focusAreas: [],
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

      const defaultExperience: ExperienceLevel = {
        totalYears: 0,
        level: ExperienceLevelType.ENTRY
      };

      const profile: UserSkillProfile = {
        id: profileId,
        skills: options.skills ? this.sanitizeSkills(options.skills) : [],
        experience: options.experience || defaultExperience,
        preferences: { ...defaultPreferences, ...options.preferences },
        createdAt: now,
        updatedAt: now
      };

      // Validate the profile
      if (!validateSkillProfile(profile)) {
        return {
          success: false,
          error: 'Invalid profile data'
        };
      }

      // Store the profile
      const storeResult = await this.storageManager.store(this.PROFILE_STORAGE_KEY, profile);
      if (!storeResult.success) {
        return {
          success: false,
          error: storeResult.error
        };
      }

      this.currentProfile = profile;
      return { success: true, data: profile };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create profile: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Load existing user profile
   */
  async loadProfile(): Promise<StorageResult<UserSkillProfile>> {
    try {
      const result = await this.storageManager.retrieve<UserSkillProfile>(this.PROFILE_STORAGE_KEY);
      
      if (!result.success || !result.data) {
        return result;
      }

      // Convert date strings back to Date objects if needed
      if (typeof result.data.createdAt === 'string') {
        result.data.createdAt = new Date(result.data.createdAt);
      }
      if (typeof result.data.updatedAt === 'string') {
        result.data.updatedAt = new Date(result.data.updatedAt);
      }

      // Validate loaded profile after date conversion
      if (!validateSkillProfile(result.data)) {
        return {
          success: false,
          error: 'Loaded profile data is invalid'
        };
      }

      this.currentProfile = result.data;
      return { success: true, data: result.data };
    } catch (error) {
      return {
        success: false,
        error: `Failed to load profile: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Update existing profile
   */
  async updateProfile(updates: ProfileUpdateOptions): Promise<StorageResult<UserSkillProfile>> {
    try {
      if (!this.currentProfile) {
        const loadResult = await this.loadProfile();
        if (!loadResult.success) {
          return {
            success: false,
            error: 'No profile found to update'
          };
        }
      }

      const updatedProfile: UserSkillProfile = {
        ...this.currentProfile!,
        skills: updates.skills ? this.sanitizeSkills(updates.skills) : this.currentProfile!.skills,
        experience: updates.experience || this.currentProfile!.experience,
        preferences: updates.preferences ? { ...this.currentProfile!.preferences, ...updates.preferences } : this.currentProfile!.preferences,
        updatedAt: new Date()
      };

      // Validate updated profile
      if (!validateSkillProfile(updatedProfile)) {
        return {
          success: false,
          error: 'Invalid profile update data'
        };
      }

      // Store updated profile
      const storeResult = await this.storageManager.store(this.PROFILE_STORAGE_KEY, updatedProfile);
      if (!storeResult.success) {
        return {
          success: false,
          error: storeResult.error
        };
      }

      this.currentProfile = updatedProfile;
      return { success: true, data: updatedProfile };
    } catch (error) {
      return {
        success: false,
        error: `Failed to update profile: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Add a skill to the profile
   */
  async addSkill(skill: Skill): Promise<StorageResult<UserSkillProfile>> {
    try {
      if (!this.currentProfile) {
        const loadResult = await this.loadProfile();
        if (!loadResult.success) {
          return {
            success: false,
            error: 'No profile found'
          };
        }
      }

      const sanitizedSkill = this.sanitizeSkill(skill);
      
      if (!validateSkill(sanitizedSkill)) {
        return {
          success: false,
          error: 'Invalid skill data'
        };
      }

      // Check if skill already exists
      const existingSkillIndex = this.currentProfile!.skills.findIndex(
        s => s.name.toLowerCase() === sanitizedSkill.name.toLowerCase()
      );

      if (existingSkillIndex >= 0) {
        // Update existing skill
        this.currentProfile!.skills[existingSkillIndex] = sanitizedSkill;
      } else {
        // Add new skill
        this.currentProfile!.skills.push(sanitizedSkill);
      }

      return await this.updateProfile({ skills: this.currentProfile!.skills });
    } catch (error) {
      return {
        success: false,
        error: `Failed to add skill: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Remove a skill from the profile
   */
  async removeSkill(skillName: string): Promise<StorageResult<UserSkillProfile>> {
    try {
      if (!this.currentProfile) {
        const loadResult = await this.loadProfile();
        if (!loadResult.success) {
          return {
            success: false,
            error: 'No profile found'
          };
        }
      }

      const sanitizedName = sanitizeSkillName(skillName);
      const updatedSkills = this.currentProfile!.skills.filter(
        skill => skill.name.toLowerCase() !== sanitizedName.toLowerCase()
      );

      return await this.updateProfile({ skills: updatedSkills });
    } catch (error) {
      return {
        success: false,
        error: `Failed to remove skill: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get current profile
   */
  getCurrentProfile(): UserSkillProfile | null {
    return this.currentProfile;
  }

  /**
   * Check if profile exists
   */
  async hasProfile(): Promise<boolean> {
    const result = await this.storageManager.retrieve(this.PROFILE_STORAGE_KEY);
    return result.success && !!result.data;
  }

  /**
   * Delete profile
   */
  async deleteProfile(): Promise<StorageResult<void>> {
    try {
      const result = await this.storageManager.remove(this.PROFILE_STORAGE_KEY);
      if (result.success) {
        this.currentProfile = null;
      }
      return result;
    } catch (error) {
      return {
        success: false,
        error: `Failed to delete profile: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Import skills from resume text
   */
  async importSkillsFromText(resumeText: string): Promise<SkillImportResult> {
    try {
      const sanitizedText = sanitizeInput(resumeText);
      const extractedSkills = this.extractSkillsFromText(sanitizedText);
      
      const importedSkills: Skill[] = [];
      const errors: string[] = [];

      for (const skillName of extractedSkills) {
        try {
          const skill: Skill = {
            name: skillName,
            category: this.categorizeSkill(skillName),
            proficiency: ProficiencyLevel.INTERMEDIATE, // Default proficiency
            synonyms: [skillName.toLowerCase()]
          };

          if (validateSkill(skill)) {
            importedSkills.push(skill);
          } else {
            errors.push(`Invalid skill: ${skillName}`);
          }
        } catch (error) {
          errors.push(`Error processing skill "${skillName}": ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      return {
        success: true,
        importedSkills,
        errors
      };
    } catch (error) {
      return {
        success: false,
        importedSkills: [],
        errors: [`Failed to import skills: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Export profile data
   */
  async exportProfile(): Promise<StorageResult<string>> {
    try {
      if (!this.currentProfile) {
        const loadResult = await this.loadProfile();
        if (!loadResult.success) {
          return {
            success: false,
            error: 'No profile found to export'
          };
        }
      }

      const exportData = JSON.stringify(this.currentProfile, null, 2);
      return { success: true, data: exportData };
    } catch (error) {
      return {
        success: false,
        error: `Failed to export profile: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get skills by category
   */
  getSkillsByCategory(category: SkillCategory): Skill[] {
    if (!this.currentProfile) {
      return [];
    }
    return this.currentProfile.skills.filter(skill => skill.category === category);
  }

  /**
   * Search skills by name
   */
  searchSkills(query: string): Skill[] {
    if (!this.currentProfile) {
      return [];
    }

    const sanitizedQuery = sanitizeInput(query).toLowerCase();
    return this.currentProfile.skills.filter(skill => 
      skill.name.toLowerCase().includes(sanitizedQuery) ||
      skill.synonyms.some(synonym => synonym.toLowerCase().includes(sanitizedQuery))
    );
  }

  /**
   * Generate unique profile ID
   */
  private generateProfileId(): string {
    return `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sanitize array of skills
   */
  private sanitizeSkills(skills: Skill[]): Skill[] {
    return skills.map(skill => this.sanitizeSkill(skill));
  }

  /**
   * Sanitize individual skill
   */
  private sanitizeSkill(skill: Skill): Skill {
    return {
      ...skill,
      name: sanitizeSkillName(skill.name),
      synonyms: skill.synonyms.map(synonym => sanitizeSkillName(synonym)),
      certifications: skill.certifications?.map(cert => sanitizeInput(cert))
    };
  }

  /**
   * Extract skills from resume text using basic pattern matching
   */
  private extractSkillsFromText(text: string): string[] {
    // Common technical skills patterns
    const skillPatterns = [
      // Programming languages
      /\b(JavaScript|TypeScript|Python|Java|C\+\+|C#|PHP|Ruby|Go|Rust|Swift|Kotlin)\b/gi,
      // Frameworks and libraries
      /\b(React|Angular|Vue|Node\.js|Express|Django|Flask|Spring|Laravel|Rails)\b/gi,
      // Databases
      /\b(MySQL|PostgreSQL|MongoDB|Redis|SQLite|Oracle|SQL Server)\b/gi,
      // Cloud platforms
      /\b(AWS|Azure|Google Cloud|GCP|Docker|Kubernetes|Terraform)\b/gi,
      // Tools
      /\b(Git|GitHub|GitLab|Jenkins|Jira|Confluence|Slack|Figma|Photoshop)\b/gi
    ];

    const extractedSkills = new Set<string>();

    for (const pattern of skillPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => extractedSkills.add(match.trim()));
      }
    }

    return Array.from(extractedSkills);
  }

  /**
   * Categorize skill based on name
   */
  private categorizeSkill(skillName: string): SkillCategory {
    const name = skillName.toLowerCase();
    
    // Programming languages
    if (/\b(javascript|typescript|python|java|c\+\+|c#|php|ruby|go|rust|swift|kotlin)\b/.test(name)) {
      return SkillCategory.TECHNICAL;
    }
    
    // Frameworks
    if (/\b(react|angular|vue|node|express|django|flask|spring|laravel|rails)\b/.test(name)) {
      return SkillCategory.FRAMEWORKS;
    }
    
    // Tools
    if (/\b(git|github|gitlab|jenkins|jira|confluence|slack|figma|photoshop|docker|kubernetes)\b/.test(name)) {
      return SkillCategory.TOOLS;
    }
    
    // Certifications
    if (/\b(aws|azure|google cloud|gcp|certified|certification)\b/.test(name)) {
      return SkillCategory.CERTIFICATIONS;
    }
    
    // Default to technical
    return SkillCategory.TECHNICAL;
  }
}