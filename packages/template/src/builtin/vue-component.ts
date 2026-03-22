/**
 * Vue 3 component template
 */

import type { BuiltinTemplate } from '../types.js';

export const vueComponent: BuiltinTemplate = {
  id: 'vue-component',
  aliases: ['vue', 'vue3'],
  template: {
    name: 'vue-component',
    version: '1.0.0',
    description: 'Vue 3 component with Composition API',
    author: 'Spazzatura',
    tags: ['vue', 'vue3', 'typescript', 'component'],
    category: 'frontend',
    variables: [
      {
        name: 'componentName',
        type: 'string',
        description: 'Name of the component (PascalCase)',
        required: true,
        validation: {
          pattern: '^[A-Z][a-zA-Z0-9]*$',
          message: 'Component name must be PascalCase (e.g., MyComponent)',
        },
      },
      {
        name: 'style',
        type: 'select',
        description: 'Styling approach',
        default: 'scoped',
        required: true,
        options: [
          { label: 'Scoped CSS', value: 'scoped' },
          { label: 'SCSS', value: 'scss' },
          { label: 'Tailwind', value: 'tailwind' },
        ],
      },
      {
        name: 'scriptSetup',
        type: 'boolean',
        description: 'Use script setup syntax',
        default: true,
        required: false,
      },
    ],
    files: [
      {
        path: 'src/components/{{componentName}}/{{componentName}}.vue',
        content: `<template>
  <div class="{{kebabCase componentName}}">
    <!-- Add content here -->
    <slot />
  </div>
</template>

{{#if scriptSetup}}<script setup lang="ts">
// Props
interface Props {
  // Add props here
}

// Emits
const emit = defineEmits<{
  // (e: 'update', value: string): void
}>();

// Reactive state
// const state = ref('');
</script>{{/if}}{{#unless scriptSetup}}<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
  name: '{{componentName}}',
  props: {
    // Add props here
  },
  emits: {
    // Add emits here
  },
  setup(props, { emit }) {
    // Add setup logic here
    return {};
  },
});
</script>{{/unless}}

{{#if (eq style 'scoped')}}<style scoped>
.{{kebabCase componentName}} {
  /* Add styles here */
}
</style>{{/if}}{{#if (eq style 'scss')}}<style lang="scss" scoped>
.{{kebabCase componentName}} {
  /* Add styles here */
}
</style>{{/if}}{{#if (eq style 'tailwind')}}<!-- Tailwind classes applied directly in template -->{{/if}}
`,
      },
      {
        path: 'src/components/{{componentName}}/index.ts',
        content: `export { default as {{componentName}} } from './{{componentName}}.vue';
`,
      },
    ],
  },
};
