// Code-quality rules for `npm run quality` (scripts/quality-check.mjs), which reports them
// only on lines a pull request adds or changes. Not a style linter: these are the
// maintainability and correctness rules SonarCloud used to apply, without its line limit.
// ESLint stays on 9: eslint-plugin-sonarjs 3 does not support ESLint 10 yet.
import tsParser from '@typescript-eslint/parser';
import sonarjs from 'eslint-plugin-sonarjs';

export default [
  {
    ignores: ['dist/**', 'build/**', 'coverage/**', 'node_modules/**', '**/*.d.ts',
      '**/*.test.*', '**/*.spec.*', '**/__tests__/**', 'src/test/**', '.tmp-*/**']
  },
  {
    files: ['**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } }
    },
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    plugins: { sonarjs },
    rules: {
      // Blocking: hard to maintain or likely wrong.
      'sonarjs/cognitive-complexity': ['error', 15],
      'sonarjs/slow-regex': 'error',
      'sonarjs/no-identical-functions': 'error',
      'sonarjs/no-identical-conditions': 'error',
      'sonarjs/no-identical-expressions': 'error',
      'sonarjs/no-all-duplicated-branches': 'error',
      // Native dialogs leave text fields unable to take typing in the Windows desktop app.
      // Use useInAppDialog (src/shared/components/InAppDialog.tsx) or an inline confirm step.
      'no-restricted-globals': ['error',
        { name: 'confirm', message: 'Use useInAppDialog; native dialogs freeze typing in the desktop app.' },
        { name: 'alert', message: 'Use a toast or useInAppDialog; native dialogs freeze typing in the desktop app.' },
        { name: 'prompt', message: 'Use useInAppDialog; native dialogs freeze typing in the desktop app.' }],
      'no-restricted-properties': ['error',
        { object: 'window', property: 'confirm', message: 'Use useInAppDialog; native dialogs freeze typing in the desktop app.' },
        { object: 'window', property: 'alert', message: 'Use a toast or useInAppDialog; native dialogs freeze typing in the desktop app.' },
        { object: 'window', property: 'prompt', message: 'Use useInAppDialog; native dialogs freeze typing in the desktop app.' }],
      // Reported, not blocking.
      'sonarjs/no-nested-conditional': 'warn',
      'sonarjs/no-nested-template-literals': 'warn',
      'sonarjs/regex-complexity': 'warn',
      'sonarjs/pseudo-random': 'warn'
    }
  }
];
