// Conventional Commits, with the types and scopes of CONVENTIONS.md section 6.2.
// The changelog is generated from these, so the vocabulary is closed on purpose.
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'test', 'refactor', 'perf', 'chore', 'ci'],
    ],
    'scope-enum': [
      2,
      'always',
      ['core', 'models', 'contracts', 'api', 'web', 'report', 'ci'],
    ],
    'subject-case': [2, 'always', 'lower-case'],
    'subject-full-stop': [2, 'never', '.'],
  },
}
