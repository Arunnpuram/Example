import { JobSite, JobPageInfo } from '../core/types';

/**
 * JobContentExtractor - Extracts job description content from various job sites
 * Handles site-specific selectors and fallback strategies
 */
export class JobContentExtractor {
  private static readonly CONTENT_SELECTORS = {
    [JobSite.LINKEDIN]: {
      description: [
        '.description__text',
        '.jobs-description-content__text',
        '.jobs-box__html-content',
        '[data-job-id] .description'
      ],
      requirements: [
        '.jobs-description__container',
        '.jobs-description-content'
      ],
      fallback: [
        '[class*="description"]',
        '[class*="job-description"]'
      ]
    },
    [JobSite.INDEED]: {
      description: [
        '#jobDescriptionText',
        '.jobsearch-jobDescriptionText',
        '[data-testid="job-description"]',
        '.jobsearch-JobComponent-description'
      ],
      requirements: [
        '.jobsearch-JobComponent-description',
        '#jobDescriptionText'
      ],
      fallback: [
        '[class*="description"]',
        '[class*="job-description"]'
      ]
    },
    [JobSite.GLASSDOOR]: {
      description: [
        '#JobDescriptionContainer',
        '.jobDescriptionContent',
        '[data-test="job-description"]',
        '.desc'
      ],
      requirements: [
        '.jobDescriptionContent',
        '#JobDescriptionContainer'
      ],
      fallback: [
        '[class*="description"]',
        '[class*="job-description"]'
      ]
    }
  };

  /**
   * Extract job description content from the current page
   */
  public extractJobContent(jobInfo: JobPageInfo): ExtractedJobContent | null {
    if (!jobInfo || !jobInfo.site) {
      return null;
    }

    const selectors = JobContentExtractor.CONTENT_SELECTORS[jobInfo.site];
    if (!selectors) {
      return this.extractWithFallback();
    }

    const description = this.extractDescription(selectors);
    const requirements = this.extractRequirements(selectors);
    
    if (!description) {
      return null;
    }

    return {
      site: jobInfo.site,
      url: jobInfo.url,
      title: jobInfo.title,
      company: jobInfo.company,
      description: this.normalizeContent(description),
      requirements: requirements ? this.normalizeContent(requirements) : '',
      extractedAt: new Date()
    };
  }

  /**
   * Extract description content using site-specific selectors
   */
  private extractDescription(selectors: any): string | null {
    // Try primary description selectors
    for (const selector of selectors.description) {
      const element = document.querySelector(selector);
      if (element && element.textContent?.trim()) {
        return element.textContent.trim();
      }
    }

    // Try fallback selectors
    for (const selector of selectors.fallback) {
      const element = document.querySelector(selector);
      if (element && element.textContent?.trim()) {
        return element.textContent.trim();
      }
    }

    return null;
  }

  /**
   * Extract requirements content using site-specific selectors
   */
  private extractRequirements(selectors: any): string | null {
    for (const selector of selectors.requirements) {
      const element = document.querySelector(selector);
      if (element && element.textContent?.trim()) {
        return element.textContent.trim();
      }
    }
    return null;
  }

  /**
   * Fallback extraction for unknown site layouts
   */
  private extractWithFallback(): ExtractedJobContent | null {
    const fallbackSelectors = [
      '[class*="job-description"]',
      '[class*="description"]',
      '[id*="description"]',
      '[data-testid*="description"]',
      'main',
      '.content',
      '#content'
    ];

    for (const selector of fallbackSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent?.trim()) {
        const content = element.textContent.trim();
        if (content.length > 100) { // Ensure it's substantial content
          return {
            site: 'unknown' as JobSite,
            url: window.location.href,
            title: this.extractTitleFallback(),
            company: this.extractCompanyFallback(),
            description: this.normalizeContent(content),
            requirements: '',
            extractedAt: new Date()
          };
        }
      }
    }

    return null;
  }

  /**
   * Extract title using fallback selectors
   */
  private extractTitleFallback(): string {
    const titleSelectors = [
      'h1',
      '[class*="title"]',
      '[class*="job-title"]',
      'title'
    ];

    for (const selector of titleSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent?.trim()) {
        return element.textContent.trim();
      }
    }

    return document.title || 'Unknown Job';
  }

  /**
   * Extract company using fallback selectors
   */
  private extractCompanyFallback(): string {
    const companySelectors = [
      '[class*="company"]',
      '[class*="employer"]',
      '[data-testid*="company"]'
    ];

    for (const selector of companySelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent?.trim()) {
        return element.textContent.trim();
      }
    }

    return 'Unknown Company';
  }

  /**
   * Normalize and clean extracted content
   */
  private normalizeContent(content: string): string {
    return content
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Remove special characters that might interfere with processing
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      // Trim and ensure single spaces
      .trim()
      // Remove common job site artifacts
      .replace(/^(Job Description|Description|About this job|Job Summary):?\s*/i, '')
      .replace(/Apply now!?|Apply for this job!?|Submit application!?/gi, '')
      .trim();
  }

  /**
   * Check if the extracted content appears to be valid job content
   */
  public validateJobContent(content: ExtractedJobContent): boolean {
    if (!content || !content.description) {
      return false;
    }

    const description = content.description.toLowerCase();
    
    // Check for common job-related keywords
    const jobKeywords = [
      'experience', 'skills', 'requirements', 'responsibilities',
      'qualifications', 'education', 'degree', 'years',
      'work', 'team', 'role', 'position', 'job', 'career'
    ];

    const keywordCount = jobKeywords.filter(keyword => 
      description.includes(keyword)
    ).length;

    // Content should be substantial and contain job-related terms
    return content.description.length > 50 && keywordCount >= 2;
  }

  /**
   * Extract structured job information from content
   */
  public extractStructuredInfo(content: ExtractedJobContent): StructuredJobInfo {
    const description = content.description.toLowerCase();
    
    return {
      experienceLevel: this.extractExperienceLevel(description),
      requiredSkills: this.extractSkillsFromText(description),
      educationRequirements: this.extractEducationRequirements(description),
      workType: this.extractWorkType(description),
      benefits: this.extractBenefits(description)
    };
  }

  /**
   * Extract experience level from job description
   */
  private extractExperienceLevel(description: string): string {
    if (description.includes('entry level') || description.includes('0-1 year') || description.includes('new grad')) {
      return 'entry';
    }
    if (description.includes('senior') || description.includes('5+ year') || description.includes('lead')) {
      return 'senior';
    }
    if (description.includes('mid-level') || description.includes('2-4 year') || description.includes('intermediate')) {
      return 'mid';
    }
    return 'unknown';
  }

  /**
   * Extract skills mentioned in the job description
   */
  private extractSkillsFromText(description: string): string[] {
    const commonSkills = [
      'javascript', 'python', 'java', 'react', 'node.js', 'sql', 'aws',
      'docker', 'kubernetes', 'git', 'agile', 'scrum', 'typescript',
      'angular', 'vue', 'mongodb', 'postgresql', 'redis', 'elasticsearch'
    ];

    return commonSkills.filter(skill => 
      description.includes(skill.toLowerCase())
    );
  }

  /**
   * Extract education requirements
   */
  private extractEducationRequirements(description: string): string {
    if (description.includes('bachelor') || description.includes('bs ') || description.includes('b.s.')) {
      return 'bachelor';
    }
    if (description.includes('master') || description.includes('ms ') || description.includes('m.s.')) {
      return 'master';
    }
    if (description.includes('phd') || description.includes('doctorate')) {
      return 'phd';
    }
    return 'none';
  }

  /**
   * Extract work type (remote, hybrid, onsite)
   */
  private extractWorkType(description: string): string {
    if (description.includes('remote') || description.includes('work from home')) {
      return 'remote';
    }
    if (description.includes('hybrid')) {
      return 'hybrid';
    }
    return 'onsite';
  }

  /**
   * Extract benefits mentioned in the job description
   */
  private extractBenefits(description: string): string[] {
    const commonBenefits = [
      'health insurance', 'dental', 'vision', '401k', 'pto', 'vacation',
      'sick leave', 'parental leave', 'stock options', 'bonus'
    ];

    return commonBenefits.filter(benefit => 
      description.includes(benefit.toLowerCase())
    );
  }
}

/**
 * Extracted job content interface
 */
export interface ExtractedJobContent {
  site: JobSite | 'unknown';
  url: string;
  title: string;
  company: string;
  description: string;
  requirements: string;
  extractedAt: Date;
}

/**
 * Structured job information interface
 */
export interface StructuredJobInfo {
  experienceLevel: string;
  requiredSkills: string[];
  educationRequirements: string;
  workType: string;
  benefits: string[];
}