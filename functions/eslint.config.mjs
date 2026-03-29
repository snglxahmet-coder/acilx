import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        require:  'readonly',
        module:   'readonly',
        exports:  'readonly',
        process:  'readonly',
        __dirname:'readonly',
        console:  'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef':       'error',
    },
  },
];
