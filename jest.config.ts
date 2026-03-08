import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({
  // Path to Next.js app (so jest can load next.config.js and .env files)
  dir: './',
});

const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jest-environment-jsdom',

  // Setup file to add custom matchers
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

  // Module name mapper for @/ path alias
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
  ],

  // Coverage collection
  collectCoverageFrom: [
    'src/lib/**/*.ts',
    'src/components/**/*.tsx',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],

  // Ignore
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],

};

export default createJestConfig(config);
