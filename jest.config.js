module.exports = {
  preset: 'jest-puppeteer',
  testMatch: [
    '**/tests/e2e/**/*.test.ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  testEnvironment: 'node',
  setupFilesAfterEnv: ['./jest.setup.js'],
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.jest.json'
    }
  }
}; 