module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended'
  ],
  plugins: ['@typescript-eslint'],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module'
  },
  env: {
    browser: true,
    es6: true,
    node: true,
    jest: true,
    webextensions: true
  },
  rules: {
    '@typescript-eslint/no-unused-vars': 'error',
    'no-console': 'off'
  },
  ignorePatterns: ['dist/', 'node_modules/', '*.js']
};