import { fixupConfigRules, fixupPluginRules } from '@eslint/compat'
import typescriptEslint from '@typescript-eslint/eslint-plugin'
import _import from 'eslint-plugin-import'
import cdk from 'eslint-plugin-cdk'
import jsdoc from 'eslint-plugin-jsdoc'
import globals from 'globals'
import tsParser from '@typescript-eslint/parser'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import js from '@eslint/js'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
})

export default [
  {
    ignores: [
      '**/*.js',
      'lambdas/**/lambda_handler.d.ts',
      'lambdas/**/lambda_handler.js',
      '**/node_modules/**/*',
      '**/coverage/**/*',
      '**/coverage-ts/**/*',
      '**/cdk.out/**/*',
      'eslint.config.mjs',
      '**/dist/**/*'
    ]
  },
  ...fixupConfigRules(
    compat.extends(
      'eslint:recommended',
      'plugin:@typescript-eslint/recommended',
      'plugin:import/typescript',
      'prettier'
    )
  ),
  {
    plugins: {
      '@typescript-eslint': fixupPluginRules(typescriptEslint),
      import: fixupPluginRules(_import),
      cdk,
      jsdoc: fixupPluginRules(jsdoc)
    },
    languageOptions: {
      globals: {
        ...globals.jest,
        ...globals.node
      },
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        projectService: './tsconfig.json'
      }
    },
    settings: {
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx']
      },
      'import/resolver': {
        node: {},
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json'
        }
      }
    },
    rules: {
      '@typescript-eslint/no-require-imports': ['error'],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: false,
          argsIgnorePattern: '^_'
        }
      ],
      quotes: [
        'error',
        'single',
        {
          avoidEscape: true
        }
      ],
      'comma-spacing': [
        'error',
        {
          before: false,
          after: true
        }
      ],
      'no-multi-spaces': [
        'error',
        {
          ignoreEOLComments: false
        }
      ],
      'array-bracket-spacing': ['error', 'never'],
      'array-bracket-newline': ['error', 'consistent'],
      'object-curly-spacing': ['error', 'always'],
      'object-curly-newline': [
        'error',
        {
          multiline: true,
          consistent: true
        }
      ],
      'object-property-newline': [
        'error',
        {
          allowAllPropertiesOnSameLine: true
        }
      ],
      'keyword-spacing': ['error'],
      'brace-style': [
        'error',
        '1tbs',
        {
          allowSingleLine: true
        }
      ],
      'space-in-parens': ['error', 'never'],
      'space-before-blocks': ['error'],
      curly: ['error', 'multi-line', 'consistent'],
      'import/order': [
        'warn',
        {
          groups: ['builtin', 'external'],
          alphabetize: {
            order: 'asc',
            caseInsensitive: true
          }
        }
      ],
      'no-duplicate-imports': ['error'],
      'no-shadow': ['off'],
      '@typescript-eslint/no-shadow': ['error'],
      'key-spacing': ['error'],
      semi: ['error', 'never'],
      'quote-props': ['error', 'consistent-as-needed'],
      'no-multiple-empty-lines': ['error'],
      '@typescript-eslint/no-floating-promises': ['error'],
      'no-return-await': ['off'],
      '@typescript-eslint/return-await': ['error'],
      'no-trailing-spaces': ['error'],
      'dot-notation': ['error'],
      'no-bitwise': ['error'],
      'no-console': ['error'],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/member-ordering': [
        'error',
        {
          default: [
            'public-static-field',
            'public-static-method',
            'protected-static-field',
            'protected-static-method',
            'private-static-field',
            'private-static-method',
            'field',
            'constructor',
            'method'
          ]
        }
      ],
      'jsdoc/require-jsdoc': [
        'error',
        {
          require: {
            FunctionDeclaration: true,
            ClassDeclaration: true,
            MethodDefinition: true,
            ArrowFunctionExpression: true,
            FunctionExpression: true
          }
        }
      ]
    }
  }
]
