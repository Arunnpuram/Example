/**
 * Learning Resource Suggestion System
 * Provides personalized learning recommendations based on skill gaps
 */

import {
  LearningRecommendation,
  LearningResource,
  ExtractedSkill,
  UserSkillProfile,
  SkillCategory,
  ResourceType,
  DifficultyLevel,
  Priority,
  UserPreferences
} from './types';

export interface LearningResourceDatabase {
  [skillName: string]: LearningResource[];
}

export interface TimeEstimationFactors {
  baseHours: number;
  difficultyMultiplier: number;
  experienceMultiplier: number;
  learningStyleMultiplier: number;
}

export class RecommendationEngine {
  private resourceDatabase: LearningResourceDatabase;
  private timeEstimationRules: Map<SkillCategory, TimeEstimationFactors>;

  constructor() {
    this.resourceDatabase = this.initializeResourceDatabase();
    this.timeEstimationRules = this.initializeTimeEstimationRules();
  }

  /**
   * Generate learning recommendations for missing skills
   */
  public generateRecommendations(
    missingSkills: ExtractedSkill[],
    userProfile: UserSkillProfile
  ): LearningRecommendation[] {
    const recommendations: LearningRecommendation[] = [];

    for (const skill of missingSkills) {
      const recommendation = this.createRecommendationForSkill(skill, userProfile);
      if (recommendation) {
        recommendations.push(recommendation);
      }
    }

    // Sort by priority and estimated time
    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.estimatedTimeToLearn - b.estimatedTimeToLearn;
    });
  }

  /**
   * Create a recommendation for a specific skill
   */
  private createRecommendationForSkill(
    skill: ExtractedSkill,
    userProfile: UserSkillProfile
  ): LearningRecommendation | null {
    const resources = this.findResourcesForSkill(skill, userProfile.preferences);
    if (resources.length === 0) return null;

    const priority = this.calculateSkillPriority(skill, userProfile);
    const estimatedTime = this.estimateTimeToLearn(skill, userProfile);
    const prerequisites = this.identifyPrerequisites(skill, userProfile);

    return {
      skill,
      priority,
      estimatedTimeToLearn: estimatedTime,
      resources: resources.slice(0, 5), // Limit to top 5 resources
      prerequisites
    };
  }

  /**
   * Find learning resources for a specific skill
   */
  private findResourcesForSkill(
    skill: ExtractedSkill,
    preferences: UserPreferences
  ): LearningResource[] {
    const skillName = skill.name.toLowerCase();
    let resources: LearningResource[] = [];

    // Direct match
    if (this.resourceDatabase[skillName]) {
      resources = [...this.resourceDatabase[skillName]];
    }

    // Check synonyms
    for (const synonym of skill.synonyms) {
      const synonymLower = synonym.toLowerCase();
      if (this.resourceDatabase[synonymLower]) {
        resources.push(...this.resourceDatabase[synonymLower]);
      }
    }

    // Filter and sort based on user preferences
    return this.filterAndSortResources(resources, preferences);
  }

  /**
   * Filter and sort resources based on user preferences
   */
  private filterAndSortResources(
    resources: LearningResource[],
    preferences: UserPreferences
  ): LearningResource[] {
    // Remove duplicates
    const uniqueResources = resources.filter((resource, index, self) =>
      index === self.findIndex(r => r.url === resource.url)
    );

    // Filter by time commitment if specified
    const timeFilteredResources = preferences.timeCommitment > 0
      ? uniqueResources.filter(r => !r.duration || r.duration <= preferences.timeCommitment * 4) // 4 weeks worth
      : uniqueResources;

    // Sort by rating, cost (free first), and difficulty
    return timeFilteredResources.sort((a, b) => {
      // Free resources first
      const aCost = a.cost || 0;
      const bCost = b.cost || 0;
      if (aCost === 0 && bCost > 0) return -1;
      if (bCost === 0 && aCost > 0) return 1;

      // Then by rating
      const aRating = a.rating || 0;
      const bRating = b.rating || 0;
      if (bRating !== aRating) return bRating - aRating;

      // Then by difficulty (easier first for beginners)
      const difficultyOrder = { beginner: 1, intermediate: 2, advanced: 3 };
      return difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty];
    });
  }

  /**
   * Calculate priority for learning a skill
   */
  private calculateSkillPriority(
    skill: ExtractedSkill,
    userProfile: UserSkillProfile
  ): Priority {
    let score = 0;

    // Base score from skill confidence (how important it is in the job)
    score += skill.confidence * 40;

    // Required skills get higher priority
    if (skill.isRequired) {
      score += 30;
    }

    // Skills in user's focus areas get higher priority
    if (userProfile.preferences.focusAreas.includes(skill.category)) {
      score += 20;
    }

    // Technical skills often have higher priority
    if (skill.category === SkillCategory.TECHNICAL || skill.category === SkillCategory.TOOLS) {
      score += 10;
    }

    // Convert score to priority
    if (score >= 80) return Priority.CRITICAL;
    if (score >= 60) return Priority.HIGH;
    if (score >= 40) return Priority.MEDIUM;
    return Priority.LOW;
  }

  /**
   * Estimate time to learn a skill
   */
  private estimateTimeToLearn(
    skill: ExtractedSkill,
    userProfile: UserSkillProfile
  ): number {
    const factors = this.timeEstimationRules.get(skill.category) || {
      baseHours: 40,
      difficultyMultiplier: 1,
      experienceMultiplier: 1,
      learningStyleMultiplier: 1
    };

    let estimatedHours = factors.baseHours;

    // Adjust for user's overall experience level
    const experienceMultipliers = {
      entry: 1.5,
      mid: 1.2,
      senior: 1.0,
      lead: 0.8,
      executive: 0.9
    };
    estimatedHours *= experienceMultipliers[userProfile.experience.level];

    // Adjust for related skills the user already has
    const relatedSkillsCount = this.countRelatedSkills(skill, userProfile.skills);
    const relatedSkillsMultiplier = Math.max(0.5, 1 - (relatedSkillsCount * 0.1));
    estimatedHours *= relatedSkillsMultiplier;

    // Adjust for time commitment (more time = faster learning)
    const timeCommitmentMultiplier = Math.max(0.6, 1 - (userProfile.preferences.timeCommitment / 40));
    estimatedHours *= timeCommitmentMultiplier;

    return Math.round(estimatedHours);
  }

  /**
   * Count related skills user already has
   */
  private countRelatedSkills(skill: ExtractedSkill, userSkills: any[]): number {
    const skillName = skill.name.toLowerCase();
    let count = 0;

    for (const userSkill of userSkills) {
      // Same category
      if (userSkill.category === skill.category) {
        count += 0.5;
      }

      // Check for related technologies
      if (this.areSkillsRelated(skillName, userSkill.name.toLowerCase())) {
        count += 1;
      }
    }

    return count;
  }

  /**
   * Check if two skills are related
   */
  private areSkillsRelated(skill1: string, skill2: string): boolean {
    const relatedGroups = [
      ['javascript', 'typescript', 'node.js', 'react', 'vue', 'angular'],
      ['python', 'django', 'flask', 'fastapi'],
      ['java', 'spring', 'hibernate'],
      ['c#', '.net', 'asp.net'],
      ['aws', 'azure', 'gcp', 'docker', 'kubernetes'],
      ['sql', 'mysql', 'postgresql', 'mongodb'],
      ['git', 'github', 'gitlab', 'bitbucket']
    ];

    for (const group of relatedGroups) {
      if (group.includes(skill1) && group.includes(skill2)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Identify prerequisites for a skill
   */
  private identifyPrerequisites(
    skill: ExtractedSkill,
    userProfile: UserSkillProfile
  ): string[] | undefined {
    const skillName = skill.name.toLowerCase();
    const prerequisites: { [key: string]: string[] } = {
      'react': ['javascript', 'html', 'css'],
      'angular': ['typescript', 'javascript', 'html', 'css'],
      'vue': ['javascript', 'html', 'css'],
      'node.js': ['javascript'],
      'express': ['javascript', 'node.js'],
      'django': ['python'],
      'flask': ['python'],
      'spring': ['java'],
      'asp.net': ['c#'],
      'kubernetes': ['docker', 'containerization'],
      'terraform': ['cloud computing', 'infrastructure'],
      'machine learning': ['python', 'statistics', 'mathematics']
    };

    const requiredPrereqs = prerequisites[skillName];
    if (!requiredPrereqs) return undefined;

    // Filter out prerequisites the user already has
    const userSkillNames = userProfile.skills.map(s => s.name.toLowerCase());
    const missingPrereqs = requiredPrereqs.filter(prereq => 
      !userSkillNames.includes(prereq)
    );

    return missingPrereqs.length > 0 ? missingPrereqs : undefined;
  }
 
 /**
   * Initialize the learning resource database
   */
  private initializeResourceDatabase(): LearningResourceDatabase {
    return {
      // Programming Languages
      'javascript': [
        {
          title: 'JavaScript Fundamentals',
          type: ResourceType.COURSE,
          url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide',
          provider: 'MDN Web Docs',
          rating: 4.8,
          duration: 20,
          cost: 0,
          difficulty: DifficultyLevel.BEGINNER
        },
        {
          title: 'JavaScript: The Complete Guide',
          type: ResourceType.COURSE,
          url: 'https://www.udemy.com/course/javascript-the-complete-guide-2020-beginner-advanced/',
          provider: 'Udemy',
          rating: 4.6,
          duration: 52,
          cost: 89.99,
          difficulty: DifficultyLevel.INTERMEDIATE
        },
        {
          title: 'You Don\'t Know JS',
          type: ResourceType.BOOK,
          url: 'https://github.com/getify/You-Dont-Know-JS',
          provider: 'GitHub',
          rating: 4.9,
          duration: 40,
          cost: 0,
          difficulty: DifficultyLevel.ADVANCED
        }
      ],
      'python': [
        {
          title: 'Python for Everybody',
          type: ResourceType.COURSE,
          url: 'https://www.coursera.org/specializations/python',
          provider: 'Coursera',
          rating: 4.8,
          duration: 32,
          cost: 0,
          difficulty: DifficultyLevel.BEGINNER
        },
        {
          title: 'Automate the Boring Stuff with Python',
          type: ResourceType.BOOK,
          url: 'https://automatetheboringstuff.com/',
          provider: 'Al Sweigart',
          rating: 4.7,
          duration: 25,
          cost: 0,
          difficulty: DifficultyLevel.BEGINNER
        },
        {
          title: 'Python Crash Course',
          type: ResourceType.BOOK,
          url: 'https://nostarch.com/pythoncrashcourse2e',
          provider: 'No Starch Press',
          rating: 4.6,
          duration: 30,
          cost: 39.95,
          difficulty: DifficultyLevel.INTERMEDIATE
        }
      ],
      'react': [
        {
          title: 'React Official Tutorial',
          type: ResourceType.TUTORIAL,
          url: 'https://reactjs.org/tutorial/tutorial.html',
          provider: 'React Team',
          rating: 4.7,
          duration: 8,
          cost: 0,
          difficulty: DifficultyLevel.BEGINNER
        },
        {
          title: 'The Complete React Developer Course',
          type: ResourceType.COURSE,
          url: 'https://www.udemy.com/course/react-2nd-edition/',
          provider: 'Udemy',
          rating: 4.7,
          duration: 39,
          cost: 94.99,
          difficulty: DifficultyLevel.INTERMEDIATE
        },
        {
          title: 'React Hooks in Action',
          type: ResourceType.BOOK,
          url: 'https://www.manning.com/books/react-hooks-in-action',
          provider: 'Manning',
          rating: 4.5,
          duration: 25,
          cost: 44.99,
          difficulty: DifficultyLevel.ADVANCED
        }
      ],
      'node.js': [
        {
          title: 'Node.js Tutorial for Beginners',
          type: ResourceType.VIDEO,
          url: 'https://www.youtube.com/watch?v=TlB_eWDSMt4',
          provider: 'Programming with Mosh',
          rating: 4.8,
          duration: 6,
          cost: 0,
          difficulty: DifficultyLevel.BEGINNER
        },
        {
          title: 'The Complete Node.js Developer Course',
          type: ResourceType.COURSE,
          url: 'https://www.udemy.com/course/the-complete-nodejs-developer-course-2/',
          provider: 'Udemy',
          rating: 4.7,
          duration: 35,
          cost: 84.99,
          difficulty: DifficultyLevel.INTERMEDIATE
        }
      ],
      // Cloud & DevOps
      'aws': [
        {
          title: 'AWS Cloud Practitioner Essentials',
          type: ResourceType.COURSE,
          url: 'https://aws.amazon.com/training/course-descriptions/cloud-practitioner-essentials/',
          provider: 'AWS Training',
          rating: 4.6,
          duration: 6,
          cost: 0,
          difficulty: DifficultyLevel.BEGINNER
        },
        {
          title: 'AWS Certified Solutions Architect',
          type: ResourceType.CERTIFICATION,
          url: 'https://aws.amazon.com/certification/certified-solutions-architect-associate/',
          provider: 'AWS',
          rating: 4.8,
          duration: 80,
          cost: 150,
          difficulty: DifficultyLevel.INTERMEDIATE
        }
      ],
      'docker': [
        {
          title: 'Docker for Beginners',
          type: ResourceType.COURSE,
          url: 'https://www.docker.com/101-tutorial',
          provider: 'Docker',
          rating: 4.7,
          duration: 4,
          cost: 0,
          difficulty: DifficultyLevel.BEGINNER
        },
        {
          title: 'Docker Deep Dive',
          type: ResourceType.BOOK,
          url: 'https://www.amazon.com/Docker-Deep-Dive-Nigel-Poulton/dp/1521822808',
          provider: 'Nigel Poulton',
          rating: 4.6,
          duration: 20,
          cost: 29.99,
          difficulty: DifficultyLevel.INTERMEDIATE
        }
      ],
      'kubernetes': [
        {
          title: 'Kubernetes Basics',
          type: ResourceType.COURSE,
          url: 'https://kubernetes.io/docs/tutorials/kubernetes-basics/',
          provider: 'Kubernetes',
          rating: 4.5,
          duration: 8,
          cost: 0,
          difficulty: DifficultyLevel.INTERMEDIATE
        },
        {
          title: 'Certified Kubernetes Administrator (CKA)',
          type: ResourceType.CERTIFICATION,
          url: 'https://www.cncf.io/certification/cka/',
          provider: 'CNCF',
          rating: 4.7,
          duration: 120,
          cost: 375,
          difficulty: DifficultyLevel.ADVANCED
        }
      ],
      // Databases
      'sql': [
        {
          title: 'SQL Tutorial',
          type: ResourceType.TUTORIAL,
          url: 'https://www.w3schools.com/sql/',
          provider: 'W3Schools',
          rating: 4.4,
          duration: 10,
          cost: 0,
          difficulty: DifficultyLevel.BEGINNER
        },
        {
          title: 'The Complete SQL Bootcamp',
          type: ResourceType.COURSE,
          url: 'https://www.udemy.com/course/the-complete-sql-bootcamp/',
          provider: 'Udemy',
          rating: 4.6,
          duration: 9,
          cost: 84.99,
          difficulty: DifficultyLevel.INTERMEDIATE
        }
      ],
      'mongodb': [
        {
          title: 'MongoDB University',
          type: ResourceType.COURSE,
          url: 'https://university.mongodb.com/',
          provider: 'MongoDB',
          rating: 4.7,
          duration: 15,
          cost: 0,
          difficulty: DifficultyLevel.BEGINNER
        }
      ],
      // Version Control
      'git': [
        {
          title: 'Git Handbook',
          type: ResourceType.DOCUMENTATION,
          url: 'https://guides.github.com/introduction/git-handbook/',
          provider: 'GitHub',
          rating: 4.6,
          duration: 3,
          cost: 0,
          difficulty: DifficultyLevel.BEGINNER
        },
        {
          title: 'Pro Git Book',
          type: ResourceType.BOOK,
          url: 'https://git-scm.com/book',
          provider: 'Scott Chacon',
          rating: 4.8,
          duration: 15,
          cost: 0,
          difficulty: DifficultyLevel.INTERMEDIATE
        }
      ],
      // Soft Skills
      'communication': [
        {
          title: 'Effective Communication Skills',
          type: ResourceType.COURSE,
          url: 'https://www.coursera.org/learn/wharton-communication-skills',
          provider: 'Coursera',
          rating: 4.6,
          duration: 12,
          cost: 0,
          difficulty: DifficultyLevel.BEGINNER
        }
      ],
      'leadership': [
        {
          title: 'Leadership Principles',
          type: ResourceType.COURSE,
          url: 'https://www.coursera.org/learn/leadership-principles',
          provider: 'Coursera',
          rating: 4.5,
          duration: 16,
          cost: 0,
          difficulty: DifficultyLevel.INTERMEDIATE
        }
      ],
      'project management': [
        {
          title: 'Project Management Basics',
          type: ResourceType.COURSE,
          url: 'https://www.coursera.org/learn/project-management',
          provider: 'Coursera',
          rating: 4.7,
          duration: 20,
          cost: 0,
          difficulty: DifficultyLevel.BEGINNER
        },
        {
          title: 'PMP Certification',
          type: ResourceType.CERTIFICATION,
          url: 'https://www.pmi.org/certifications/project-management-pmp',
          provider: 'PMI',
          rating: 4.8,
          duration: 100,
          cost: 555,
          difficulty: DifficultyLevel.ADVANCED
        }
      ]
    };
  }

  /**
   * Initialize time estimation rules for different skill categories
   */
  private initializeTimeEstimationRules(): Map<SkillCategory, TimeEstimationFactors> {
    const rules = new Map<SkillCategory, TimeEstimationFactors>();

    rules.set(SkillCategory.TECHNICAL, {
      baseHours: 50,
      difficultyMultiplier: 1.2,
      experienceMultiplier: 1.0,
      learningStyleMultiplier: 1.0
    });

    rules.set(SkillCategory.TOOLS, {
      baseHours: 25,
      difficultyMultiplier: 0.8,
      experienceMultiplier: 0.9,
      learningStyleMultiplier: 1.0
    });

    rules.set(SkillCategory.FRAMEWORKS, {
      baseHours: 40,
      difficultyMultiplier: 1.1,
      experienceMultiplier: 0.8,
      learningStyleMultiplier: 1.0
    });

    rules.set(SkillCategory.LANGUAGES, {
      baseHours: 60,
      difficultyMultiplier: 1.3,
      experienceMultiplier: 1.1,
      learningStyleMultiplier: 1.2
    });

    rules.set(SkillCategory.CERTIFICATIONS, {
      baseHours: 80,
      difficultyMultiplier: 1.0,
      experienceMultiplier: 0.9,
      learningStyleMultiplier: 0.8
    });

    rules.set(SkillCategory.SOFT_SKILLS, {
      baseHours: 30,
      difficultyMultiplier: 0.9,
      experienceMultiplier: 1.2,
      learningStyleMultiplier: 1.3
    });

    rules.set(SkillCategory.METHODOLOGIES, {
      baseHours: 35,
      difficultyMultiplier: 1.0,
      experienceMultiplier: 0.8,
      learningStyleMultiplier: 1.1
    });

    return rules;
  }
}