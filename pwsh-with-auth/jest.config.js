module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  automock: false,
  clearMocks: true,
  globals: {
    DOCKER_CONFIG: 'stanislaw'
  }
};