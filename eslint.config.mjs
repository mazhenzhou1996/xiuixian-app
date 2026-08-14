import { globalIgnores } from 'eslint/config'

export default [
  globalIgnores(['dist', 'node_modules', '**/components/ui/**']),
  {
    rules: {
      'no-unused-vars': 'warn',
      'no-explicit-any': 'off',
    },
  },
]
