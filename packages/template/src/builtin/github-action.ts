/**
 * GitHub Actions workflow template
 */

import type { BuiltinTemplate } from '../types.js';

export const githubAction: BuiltinTemplate = {
  id: 'github-action',
  aliases: ['gh-action', 'workflow', 'ci'],
  template: {
    name: 'github-action',
    version: '1.0.0',
    description: 'GitHub Actions workflow configuration',
    author: 'Spazzatura',
    tags: ['github', 'actions', 'ci', 'cd', 'workflow'],
    category: 'devops',
    variables: [
      {
        name: 'workflowName',
        type: 'string',
        description: 'Name of the workflow',
        required: true,
        default: 'CI',
      },
      {
        name: 'workflowType',
        type: 'select',
        description: 'Type of workflow',
        required: true,
        default: 'ci',
        options: [
          { label: 'CI (Build & Test)', value: 'ci' },
          { label: 'CD (Deploy)', value: 'cd' },
          { label: 'Release', value: 'release' },
          { label: 'Custom', value: 'custom' },
        ],
      },
      {
        name: 'nodeVersion',
        type: 'string',
        description: 'Node.js version(s) to test (comma-separated)',
        required: false,
        default: '18, 20',
      },
      {
        name: 'packageManager',
        type: 'select',
        description: 'Package manager',
        required: true,
        default: 'npm',
        options: [
          { label: 'npm', value: 'npm' },
          { label: 'yarn', value: 'yarn' },
          { label: 'pnpm', value: 'pnpm' },
          { label: 'bun', value: 'bun' },
        ],
      },
      {
        name: 'includeLint',
        type: 'boolean',
        description: 'Include linting step',
        required: false,
        default: true,
      },
      {
        name: 'includeTest',
        type: 'boolean',
        description: 'Include test step',
        required: false,
        default: true,
      },
      {
        name: 'includeBuild',
        type: 'boolean',
        description: 'Include build step',
        required: false,
        default: true,
      },
      {
        name: 'includeCoverage',
        type: 'boolean',
        description: 'Include coverage report',
        required: false,
        default: false,
      },
      {
        name: 'deployTarget',
        type: 'select',
        description: 'Deployment target (for CD)',
        required: false,
        default: 'none',
        options: [
          { label: 'None', value: 'none' },
          { label: 'GitHub Pages', value: 'gh-pages' },
          { label: 'AWS', value: 'aws' },
          { label: 'Vercel', value: 'vercel' },
          { label: 'Netlify', value: 'netlify' },
          { label: 'Docker', value: 'docker' },
        ],
      },
      {
        name: 'triggerBranch',
        type: 'string',
        description: 'Branch to trigger on',
        required: false,
        default: 'main',
      },
      {
        name: 'includeRelease',
        type: 'boolean',
        description: 'Include automatic release on tag',
        required: false,
        default: false,
      },
    ],
    files: [
      {
        path: '.github/workflows/{{kebabCase workflowName}}.yml',
        content: `name: {{workflowName}}

on:
  push:
    branches:
      - {{triggerBranch}}
{{#if (eq workflowType "ci")}}
  pull_request:
    branches:
      - {{triggerBranch}}
{{/if}}
{{#if includeRelease}}
  release:
    types: [published]
{{/if}}

jobs:
{{#if (eq workflowType "ci")}}
  build:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [{{#each (split nodeVersion ",")}}{{#if @index}}, {{/if}}{{trim this}}{{/each}}]
    
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
      
      - name: Setup Node.js \${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: \${{ matrix.node-version }}
{{#if (eq packageManager "pnpm")}}
          cache: 'pnpm'
{{else if (eq packageManager "yarn")}}
          cache: 'yarn'
{{else if (eq packageManager "npm")}}
          cache: 'npm'
{{/if}}
      
{{#if (eq packageManager "pnpm")}}
      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8
      
{{/if}}
      - name: Install dependencies
        run: |
{{#if (eq packageManager "npm")}}          npm ci
{{else if (eq packageManager "yarn")}}          yarn install --frozen-lockfile
{{else if (eq packageManager "pnpm")}}          pnpm install --frozen-lockfile
{{else if (eq packageManager "bun")}}          bun install --frozen-lockfile
{{/if}}
{{#if includeLint}}
      
      - name: Lint
        run: |
{{#if (eq packageManager "npm")}}          npm run lint
{{else if (eq packageManager "yarn")}}          yarn lint
{{else if (eq packageManager "pnpm")}}          pnpm lint
{{else if (eq packageManager "bun")}}          bun run lint
{{/if}}
{{/if}}
{{#if includeTest}}
      
      - name: Test
        run: |
{{#if (eq packageManager "npm")}}          npm test
{{else if (eq packageManager "yarn")}}          yarn test
{{else if (eq packageManager "pnpm")}}          pnpm test
{{else if (eq packageManager "bun")}}          bun test
{{/if}}
{{#if includeCoverage}}
        env:
          CI: true
{{/if}}
{{/if}}
{{#if includeCoverage}}
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          token: \${{ secrets.CODECOV_TOKEN }}
          fail_ci_if_error: true
{{/if}}
{{#if includeBuild}}
      
      - name: Build
        run: |
{{#if (eq packageManager "npm")}}          npm run build
{{else if (eq packageManager "yarn")}}          yarn build
{{else if (eq packageManager "pnpm")}}          pnpm build
{{else if (eq packageManager "bun")}}          bun run build
{{/if}}
{{/if}}
{{/if}}
{{#if (eq workflowType "cd")}}
{{#if (eq deployTarget "gh-pages")}}
  deploy:
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/{{triggerBranch}}'
    
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
      
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: \${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
{{/if}}
{{#if (eq deployTarget "vercel")}}
  deploy:
    runs-on: ubuntu-latest
    needs: build
    
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: \${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: \${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: \${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
{{/if}}
{{#if (eq deployTarget "netlify")}}
  deploy:
    runs-on: ubuntu-latest
    needs: build
    
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
      
      - name: Deploy to Netlify
        uses: nwtgck/actions-netlify@v2.0.0
        with:
          publish-dir: './dist'
          production-branch: {{triggerBranch}}
          github-token: \${{ secrets.GITHUB_TOKEN }}
          deploy-message: "Deploy from GitHub Actions"
        env:
          NETLIFY_AUTH_TOKEN: \${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: \${{ secrets.NETLIFY_SITE_ID }}
{{/if}}
{{#if (eq deployTarget "docker")}}
  docker:
    runs-on: ubuntu-latest
    needs: build
    
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Login to Docker Hub
        uses: docker/login-action@v3
        with:
          username: \${{ secrets.DOCKER_USERNAME }}
          password: \${{ secrets.DOCKER_PASSWORD }}
      
      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: \${{ secrets.DOCKER_USERNAME }}/{{projectName}}:latest
{{/if}}
{{/if}}
{{#if (eq workflowType "release")}}
  release:
    runs-on: ubuntu-latest
    if: startsWith(github.ref, 'refs/tags/')
    
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
      
      - name: Publish to npm
        run: npm publish
        env:
          NODE_AUTH_TOKEN: \${{ secrets.NPM_TOKEN }}
      
      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          generate_release_notes: true
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
{{/if}}
{{#if (eq workflowType "custom")}}
  main:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      # Add your custom steps here
      
      - name: Run custom script
        run: echo "Add your custom workflow steps here"
{{/if}}
`,
      },
    ],
  },
};

export default githubAction;
