/**
 * Natural Language Processing module for skill extraction
 * 
 * This module handles parsing job descriptions and extracting
 * skills, requirements, and other relevant information using
 * client-side NLP processing with compromise.js.
 */

import nlp from 'compromise';
import type { ExtractedSkill, JobPosting } from './types';
import { SkillCategory } from './types';

interface SkillDefinition {
  name: string;
  category: SkillCategory;
  synonyms: string[];
  patterns: string[];
}

export class SkillExtractionEngine {
  private static instance: SkillExtractionEngine;
  private skillDatabase: Map<string, SkillDefinition> = new Map();
  private synonymMap: Map<string, string> = new Map();
  private initialized = false;

  private constructor() {
    // Private constructor for singleton pattern
  }

  public static getInstance(): SkillExtractionEngine {
    if (!SkillExtractionEngine.instance) {
      SkillExtractionEngine.instance = new SkillExtractionEngine();
    }
    return SkillExtractionEngine.instance;
  }

  /**
   * Initialize the NLP engine with skill databases
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.buildSkillDatabase();
    this.buildSynonymMap();
    this.initialized = true;
  }

  /**
   * Extract skills from job description text
   */
  async extractSkills(jobDescription: string): Promise<ExtractedSkill[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    const normalizedText = this.normalizeText(jobDescription);

    // Process text with compromise.js
    const doc = nlp(normalizedText);

    // Extract skills using multiple strategies
    const foundSkills = new Map<string, ExtractedSkill>();

    // Strategy 1: Direct skill matching
    this.extractDirectMatches(normalizedText, foundSkills);

    // Strategy 2: Pattern-based extraction
    this.extractPatternMatches(doc, foundSkills);

    // Strategy 3: Context-based extraction
    this.extractContextualSkills(doc, foundSkills);

    return Array.from(foundSkills.values());
  }

  /**
   * Parse a complete job posting
   */
  async parseJobPosting(jobElement: Element): Promise<Partial<JobPosting>> {
    const textContent = jobElement.textContent || '';
    const extractedSkills = await this.extractSkills(textContent);

    return {
      description: textContent,
      extractedSkills
    };
  }

  /**
   * Classify a skill into appropriate category
   */
  classifySkill(skillName: string): SkillCategory {
    const normalizedSkill = this.normalizeSkillName(skillName);
    const skillDef = this.skillDatabase.get(normalizedSkill);

    if (skillDef) {
      return skillDef.category;
    }

    // Fallback classification based on patterns
    return this.classifyByPattern(skillName);
  }

  /**
   * Find synonyms for a given skill
   */
  findSynonyms(skillName: string): string[] {
    const normalizedSkill = this.normalizeSkillName(skillName);
    const skillDef = this.skillDatabase.get(normalizedSkill);

    return skillDef ? skillDef.synonyms : [];
  }

  /**
   * Build comprehensive skill database
   */
  private buildSkillDatabase(): void {
    const skills: SkillDefinition[] = [
      // Programming Languages
      { name: 'javascript', category: SkillCategory.TECHNICAL, synonyms: ['js', 'ecmascript', 'node.js', 'nodejs'], patterns: ['javascript', 'js', 'node'] },
      { name: 'typescript', category: SkillCategory.TECHNICAL, synonyms: ['ts'], patterns: ['typescript', 'ts'] },
      { name: 'python', category: SkillCategory.TECHNICAL, synonyms: ['py'], patterns: ['python', 'py'] },
      { name: 'java', category: SkillCategory.TECHNICAL, synonyms: [], patterns: ['java'] },
      { name: 'c#', category: SkillCategory.TECHNICAL, synonyms: ['csharp', 'c-sharp'], patterns: ['c#', 'csharp'] },
      { name: 'c++', category: SkillCategory.TECHNICAL, synonyms: ['cpp'], patterns: ['c++', 'cpp'] },
      { name: 'go', category: SkillCategory.TECHNICAL, synonyms: ['golang'], patterns: ['golang', 'go'] },
      { name: 'rust', category: SkillCategory.TECHNICAL, synonyms: [], patterns: ['rust'] },
      { name: 'php', category: SkillCategory.TECHNICAL, synonyms: [], patterns: ['php'] },
      { name: 'ruby', category: SkillCategory.TECHNICAL, synonyms: [], patterns: ['ruby'] },
      { name: 'swift', category: SkillCategory.TECHNICAL, synonyms: [], patterns: ['swift'] },
      { name: 'kotlin', category: SkillCategory.TECHNICAL, synonyms: [], patterns: ['kotlin'] },
      { name: 'scala', category: SkillCategory.TECHNICAL, synonyms: [], patterns: ['scala'] },

      // Frameworks & Libraries
      { name: 'react', category: SkillCategory.FRAMEWORKS, synonyms: ['reactjs', 'react.js'], patterns: ['react', 'reactjs'] },
      { name: 'angular', category: SkillCategory.FRAMEWORKS, synonyms: ['angularjs'], patterns: ['angular', 'angularjs'] },
      { name: 'vue', category: SkillCategory.FRAMEWORKS, synonyms: ['vuejs', 'vue.js'], patterns: ['vue', 'vuejs'] },
      { name: 'express', category: SkillCategory.FRAMEWORKS, synonyms: ['expressjs', 'express.js'], patterns: ['express', 'expressjs'] },
      { name: 'django', category: SkillCategory.FRAMEWORKS, synonyms: [], patterns: ['django'] },
      { name: 'flask', category: SkillCategory.FRAMEWORKS, synonyms: [], patterns: ['flask'] },
      { name: 'spring', category: SkillCategory.FRAMEWORKS, synonyms: ['spring boot', 'springboot'], patterns: ['spring', 'spring boot'] },
      { name: 'laravel', category: SkillCategory.FRAMEWORKS, synonyms: [], patterns: ['laravel'] },
      { name: 'rails', category: SkillCategory.FRAMEWORKS, synonyms: ['ruby on rails'], patterns: ['rails', 'ruby on rails'] },

      // Databases
      { name: 'mysql', category: SkillCategory.TECHNICAL, synonyms: [], patterns: ['mysql'] },
      { name: 'postgresql', category: SkillCategory.TECHNICAL, synonyms: ['postgres'], patterns: ['postgresql', 'postgres'] },
      { name: 'mongodb', category: SkillCategory.TECHNICAL, synonyms: ['mongo'], patterns: ['mongodb', 'mongo'] },
      { name: 'redis', category: SkillCategory.TECHNICAL, synonyms: [], patterns: ['redis'] },
      { name: 'elasticsearch', category: SkillCategory.TECHNICAL, synonyms: ['elastic search'], patterns: ['elasticsearch', 'elastic'] },
      { name: 'sql', category: SkillCategory.TECHNICAL, synonyms: [], patterns: ['sql'] },
      { name: 'nosql', category: SkillCategory.TECHNICAL, synonyms: [], patterns: ['nosql'] },

      // Cloud & DevOps
      { name: 'aws', category: SkillCategory.TOOLS, synonyms: ['amazon web services'], patterns: ['aws', 'amazon web services'] },
      { name: 'azure', category: SkillCategory.TOOLS, synonyms: ['microsoft azure'], patterns: ['azure', 'microsoft azure'] },
      { name: 'gcp', category: SkillCategory.TOOLS, synonyms: ['google cloud', 'google cloud platform'], patterns: ['gcp', 'google cloud'] },
      { name: 'docker', category: SkillCategory.TOOLS, synonyms: [], patterns: ['docker'] },
      { name: 'kubernetes', category: SkillCategory.TOOLS, synonyms: ['k8s'], patterns: ['kubernetes', 'k8s'] },
      { name: 'jenkins', category: SkillCategory.TOOLS, synonyms: [], patterns: ['jenkins'] },
      { name: 'terraform', category: SkillCategory.TOOLS, synonyms: [], patterns: ['terraform'] },
      { name: 'ansible', category: SkillCategory.TOOLS, synonyms: [], patterns: ['ansible'] },

      // Soft Skills
      { name: 'communication', category: SkillCategory.SOFT_SKILLS, synonyms: ['verbal communication', 'written communication'], patterns: ['communication', 'communicate'] },
      { name: 'leadership', category: SkillCategory.SOFT_SKILLS, synonyms: ['team leadership', 'leading teams'], patterns: ['leadership', 'lead', 'leading'] },
      { name: 'problem solving', category: SkillCategory.SOFT_SKILLS, synonyms: ['problem-solving', 'analytical thinking'], patterns: ['problem solving', 'analytical'] },
      { name: 'teamwork', category: SkillCategory.SOFT_SKILLS, synonyms: ['collaboration', 'team collaboration'], patterns: ['teamwork', 'collaboration'] },
      { name: 'project management', category: SkillCategory.SOFT_SKILLS, synonyms: ['project planning'], patterns: ['project management', 'project planning'] },

      // Methodologies
      { name: 'agile', category: SkillCategory.METHODOLOGIES, synonyms: ['agile development'], patterns: ['agile', 'scrum'] },
      { name: 'scrum', category: SkillCategory.METHODOLOGIES, synonyms: [], patterns: ['scrum'] },
      { name: 'kanban', category: SkillCategory.METHODOLOGIES, synonyms: [], patterns: ['kanban'] },
      { name: 'devops', category: SkillCategory.METHODOLOGIES, synonyms: [], patterns: ['devops'] },
      { name: 'ci/cd', category: SkillCategory.METHODOLOGIES, synonyms: ['continuous integration', 'continuous deployment', 'ci cd'], patterns: ['ci/cd', 'ci cd', 'continuous integration', 'continuous deployment'] },

      // Tools
      { name: 'git', category: SkillCategory.TOOLS, synonyms: ['version control'], patterns: ['git', 'github', 'gitlab'] },
      { name: 'jira', category: SkillCategory.TOOLS, synonyms: [], patterns: ['jira'] },
      { name: 'confluence', category: SkillCategory.TOOLS, synonyms: [], patterns: ['confluence'] },
      { name: 'slack', category: SkillCategory.TOOLS, synonyms: [], patterns: ['slack'] },
      { name: 'figma', category: SkillCategory.TOOLS, synonyms: [], patterns: ['figma'] },
      { name: 'adobe creative suite', category: SkillCategory.TOOLS, synonyms: ['photoshop', 'illustrator'], patterns: ['adobe', 'photoshop'] },

      // Certifications
      { name: 'aws certified', category: SkillCategory.CERTIFICATIONS, synonyms: ['aws certification'], patterns: ['aws certified', 'aws certification'] },
      { name: 'pmp', category: SkillCategory.CERTIFICATIONS, synonyms: ['project management professional'], patterns: ['pmp', 'project management professional'] },
      { name: 'cissp', category: SkillCategory.CERTIFICATIONS, synonyms: [], patterns: ['cissp'] },
    ];

    skills.forEach(skill => {
      this.skillDatabase.set(skill.name, skill);
      // Also add synonyms as keys pointing to the main skill
      skill.synonyms.forEach(synonym => {
        this.skillDatabase.set(this.normalizeSkillName(synonym), skill);
      });
    });
  }

  /**
   * Build synonym mapping for quick lookups
   */
  private buildSynonymMap(): void {
    this.skillDatabase.forEach((skillDef, key) => {
      skillDef.synonyms.forEach(synonym => {
        this.synonymMap.set(this.normalizeSkillName(synonym), key);
      });
    });
  }

  /**
   * Normalize text for processing
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      // Preserve important special characters for skills like C++, C#, CI/CD
      .replace(/[^\w\s\-\.#\+\/]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Normalize skill name for consistent matching
   */
  private normalizeSkillName(skillName: string): string {
    return skillName
      .toLowerCase()
      .replace(/[^\w\s\-\.#\+]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Extract skills using direct string matching
   */
  private extractDirectMatches(text: string, foundSkills: Map<string, ExtractedSkill>): void {
    this.skillDatabase.forEach((skillDef, skillName) => {
      const patterns = [skillName, ...skillDef.synonyms, ...skillDef.patterns];

      patterns.forEach(pattern => {
        // Handle special cases for patterns with special characters
        let regex: RegExp;
        if (pattern.includes('/') || pattern.includes('#') || pattern.includes('+')) {
          // For patterns with special chars, use more flexible matching
          const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          regex = new RegExp(`(?:^|\\s|[^\\w])${escapedPattern}(?=\\s|[^\\w]|$)`, 'gi');
        } else {
          // Standard word boundary matching
          const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          regex = new RegExp(`\\b${escapedPattern}\\b`, 'gi');
        }

        const matches = text.match(regex);

        if (matches) {
          const matchIndex = text.search(regex);
          const contextStart = Math.max(0, matchIndex - 50);
          const contextEnd = Math.min(text.length, matchIndex + matches[0].length + 50);
          const context = text.substring(contextStart, contextEnd);

          const skill: ExtractedSkill = {
            name: skillDef.name,
            category: skillDef.category,
            confidence: this.calculateConfidence(matches[0], context),
            context: context.trim(),
            isRequired: this.isSkillRequired(context),
            synonyms: skillDef.synonyms
          };

          foundSkills.set(skillDef.name, skill);
        }
      });
    });
  }

  /**
   * Extract skills using NLP patterns
   */
  private extractPatternMatches(doc: any, foundSkills: Map<string, ExtractedSkill>): void {
    // Extract nouns that might be skills
    const nouns = doc.nouns().out('array');
    const adjectives = doc.adjectives().out('array');

    [...nouns, ...adjectives].forEach((term: string) => {
      const normalizedTerm = this.normalizeSkillName(term);
      const skillDef = this.skillDatabase.get(normalizedTerm);

      if (skillDef && !foundSkills.has(skillDef.name)) {
        const skill: ExtractedSkill = {
          name: skillDef.name,
          category: skillDef.category,
          confidence: 0.7, // Lower confidence for pattern matches
          context: term,
          isRequired: false,
          synonyms: skillDef.synonyms
        };

        foundSkills.set(skillDef.name, skill);
      }
    });
  }

  /**
   * Extract skills based on context clues
   */
  private extractContextualSkills(doc: any, foundSkills: Map<string, ExtractedSkill>): void {
    // Look for phrases like "experience with", "proficient in", etc.
    const experiencePatterns = [
      'experience with',
      'proficient in',
      'knowledge of',
      'familiar with',
      'expertise in',
      'skilled in'
    ];

    const text = doc.text();
    experiencePatterns.forEach(pattern => {
      const regex = new RegExp(`${pattern}\\s+([\\w\\s,\\.#\\+\\-]+?)(?:\\.|,|;|\\n|$)`, 'gi');
      const matches = text.match(regex);

      if (matches) {
        matches.forEach((match: string) => {
          const skillText = match.replace(new RegExp(pattern, 'i'), '').trim();
          this.extractSkillsFromText(skillText, foundSkills, 0.8);
        });
      }
    });
  }

  /**
   * Extract skills from a specific text segment
   */
  private extractSkillsFromText(text: string, foundSkills: Map<string, ExtractedSkill>, confidence: number): void {
    const words = text.split(/[,\s]+/).filter(word => word.length > 1);

    words.forEach(word => {
      const normalizedWord = this.normalizeSkillName(word);
      const skillDef = this.skillDatabase.get(normalizedWord);

      if (skillDef && !foundSkills.has(skillDef.name)) {
        const skill: ExtractedSkill = {
          name: skillDef.name,
          category: skillDef.category,
          confidence,
          context: text,
          isRequired: this.isSkillRequired(text),
          synonyms: skillDef.synonyms
        };

        foundSkills.set(skillDef.name, skill);
      }
    });
  }

  /**
   * Calculate confidence score for skill extraction
   */
  private calculateConfidence(match: string, context: string): number {
    let confidence = 0.6; // Base confidence

    // Increase confidence for exact matches
    if (this.skillDatabase.has(this.normalizeSkillName(match))) {
      confidence += 0.2;
    }

    // Increase confidence for required skills context
    if (this.isSkillRequired(context)) {
      confidence += 0.1;
    }

    // Increase confidence for experience context
    if (/experience|proficient|skilled|expertise/i.test(context)) {
      confidence += 0.1;
    }

    return Math.min(1.0, confidence);
  }

  /**
   * Determine if a skill is required based on context
   */
  private isSkillRequired(context: string): boolean {
    const requiredPatterns = [
      'required',
      'must have',
      'essential',
      'mandatory',
      'necessary',
      'need',
      'should have'
    ];

    return requiredPatterns.some(pattern =>
      new RegExp(pattern, 'i').test(context)
    );
  }

  /**
   * Classify skill by pattern when not in database
   */
  private classifyByPattern(skillName: string): SkillCategory {
    const name = skillName.toLowerCase();

    // Programming language patterns
    if (/\b(js|py|java|cpp|php|ruby|go|rust|swift|kotlin|scala|c#|typescript|javascript|python)\b/.test(name)) {
      return SkillCategory.TECHNICAL;
    }

    // Framework patterns
    if (/\b(react|angular|vue|django|flask|spring|laravel|rails|express)\b/.test(name)) {
      return SkillCategory.FRAMEWORKS;
    }

    // Tool patterns
    if (/\b(git|docker|kubernetes|jenkins|jira|slack|figma|aws|azure|gcp)\b/.test(name)) {
      return SkillCategory.TOOLS;
    }

    // Certification patterns
    if (/certified|certification|professional|associate|expert/.test(name)) {
      return SkillCategory.CERTIFICATIONS;
    }

    // Methodology patterns
    if (/\b(agile|scrum|kanban|devops|ci\/cd)\b/.test(name)) {
      return SkillCategory.METHODOLOGIES;
    }

    // Default to technical
    return SkillCategory.TECHNICAL;
  }
}