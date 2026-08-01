const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  globalIgnores(['.expo/**', 'dist/**', 'node_modules/**', '.audit-*/**']),
  expoConfig,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': 'error',
      'react-hooks/exhaustive-deps': 'error'
    }
  }
]);
