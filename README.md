# 🎯 Skill Gap Analyzer Chrome Extension

A privacy-first Chrome extension that helps job seekers identify skill gaps between their qualifications and job requirements in real-time. Analyze job postings on LinkedIn, Indeed, Glassdoor, and Google Jobs to get personalized learning recommendations.

## ✨ Features

- **🔍 Real-time Job Analysis**: Automatically extract skills and requirements from job postings
- **📊 Skill Gap Identification**: Compare your skills with job requirements
- **🎓 Personalized Recommendations**: Get tailored learning suggestions
- **🔒 Privacy-First**: All data processed locally - nothing sent to external servers
- **🌐 Multi-Platform Support**: Works on LinkedIn, Indeed, Glassdoor, and Google Jobs
- **📱 Clean Interface**: Modern, intuitive popup interface

## 🚀 Development Setup

### Prerequisites
- **Node.js** (v16 or higher)
- **npm** or **yarn**
- **Chrome** browser for testing

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd skill-gap-analyzer

# Install dependencies
npm install
```

### Development Commands
```bash
# Build for development with watch mode
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Type checking
npm run type-check

# Linting
npm run lint

# Run all checks
npm run lint && npm run type-check && npm test
```

### 🔧 Loading the Extension in Chrome
1. Build the extension: `npm run build`
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked" and select the project directory
5. The extension icon should appear in your toolbar

## 📁 Project Structure

```
skill-gap-analyzer/
├── src/
│   ├── background/         # Background service worker
│   │   └── index.ts       # Main background script
│   ├── content/           # Content scripts for job sites
│   │   └── index.ts       # Main content script
│   ├── popup/             # Extension popup interface
│   │   └── index.ts       # Popup logic and UI handling
│   ├── core/              # Core business logic
│   │   ├── types.ts       # TypeScript type definitions
│   │   ├── storage.ts     # Encrypted data storage
│   │   ├── nlp.ts         # Natural language processing
│   │   ├── matching.ts    # Skill matching algorithms
│   │   └── index.ts       # Core module exports
│   └── utils/             # Utility functions
│       ├── dom.ts         # DOM manipulation helpers
│       ├── crypto.ts      # Encryption utilities
│       ├── validation.ts  # Data validation
│       └── index.ts       # Utility exports
├── dist/                  # Built extension files
├── popup.html            # Extension popup HTML
├── manifest.json         # Chrome extension manifest
├── webpack.config.js     # Webpack build configuration
├── tsconfig.json         # TypeScript configuration
├── jest.config.js        # Jest testing configuration
└── package.json          # Project dependencies and scripts
```

## 🏗️ Architecture

### Core Components

- **Background Script**: Manages extension lifecycle, storage, and communication
- **Content Scripts**: Inject into job site pages to extract job data
- **Popup Interface**: Provides user interaction and displays analysis results
- **NLP Engine**: Processes job descriptions to extract skills and requirements
- **Matching Engine**: Compares user skills with job requirements
- **Storage Manager**: Handles encrypted local data storage

### Data Flow

1. **Content Script** detects job posting page
2. **NLP Engine** extracts skills from job description
3. **Background Script** receives extracted data
4. **Matching Engine** compares with user profile
5. **Popup** displays analysis results and recommendations

## 🔒 Privacy & Security

- **Local Processing**: All analysis happens in your browser
- **No External Servers**: No data sent to third parties
- **Encrypted Storage**: User data encrypted with AES-GCM
- **Minimal Permissions**: Only requests necessary Chrome permissions
- **Open Source**: Full transparency in data handling

## 🧪 Testing

The project includes comprehensive testing setup:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

### Test Structure
- **Unit Tests**: Test individual functions and classes
- **Integration Tests**: Test component interactions
- **Mock APIs**: Chrome extension APIs are mocked for testing

## 🛠️ Development Guidelines

### Code Style
- **TypeScript**: Strict type checking enabled
- **ESLint**: Code quality and consistency
- **Prettier**: Code formatting (via IDE)
- **Modular Architecture**: Clean separation of concerns

### Adding New Features
1. Define types in `src/core/types.ts`
2. Implement core logic in appropriate `src/core/` module
3. Add utility functions to `src/utils/` if needed
4. Update content/background/popup scripts as required
5. Add tests for new functionality
6. Update documentation

## 📋 Supported Job Sites

- **LinkedIn** (`linkedin.com/jobs/*`)
- **Indeed** (`indeed.com/viewjob*`)
- **Glassdoor** (`glassdoor.com/job-listing/*`)
- **Google Jobs** (`jobs.google.com/jobs*`)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Ensure all tests pass: `npm test`
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you encounter any issues or have questions:

1. Check the [Issues](../../issues) page for existing problems
2. Create a new issue with detailed information
3. Include browser version, extension version, and steps to reproduce

---

**Made with ❤️ for job seekers everywhere**