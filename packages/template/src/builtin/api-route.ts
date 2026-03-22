/**
 * API route template
 */

import type { BuiltinTemplate } from '../types.js';

export const apiRoute: BuiltinTemplate = {
  id: 'api-route',
  aliases: ['api', 'route', 'endpoint'],
  template: {
    name: 'api-route',
    version: '1.0.0',
    description: 'API route handler for Express/Fastify',
    author: 'Spazzatura',
    tags: ['api', 'route', 'express', 'fastify', 'backend'],
    category: 'backend',
    variables: [
      {
        name: 'routeName',
        type: 'string',
        description: 'Name of the route (e.g., users, products)',
        required: true,
        validation: {
          pattern: '^[a-z][a-z0-9-]*$',
          message: 'Route name must be lowercase with hyphens (e.g., my-route)',
        },
      },
      {
        name: 'framework',
        type: 'select',
        description: 'Web framework',
        default: 'express',
        required: true,
        options: [
          { label: 'Express', value: 'express' },
          { label: 'Fastify', value: 'fastify' },
        ],
      },
      {
        name: 'methods',
        type: 'multiselect',
        description: 'HTTP methods to support',
        default: ['GET', 'POST'],
        required: true,
        options: [
          { label: 'GET', value: 'GET' },
          { label: 'POST', value: 'POST' },
          { label: 'PUT', value: 'PUT' },
          { label: 'PATCH', value: 'PATCH' },
          { label: 'DELETE', value: 'DELETE' },
        ],
      },
      {
        name: 'includeValidation',
        type: 'boolean',
        description: 'Include request validation',
        default: true,
        required: false,
      },
      {
        name: 'includeTests',
        type: 'boolean',
        description: 'Include test file',
        default: true,
        required: false,
      },
    ],
    files: [
      {
        path: 'src/routes/{{routeName}}.ts',
        content: `{{#if (eq framework 'express')}}import { Router, Request, Response, NextFunction } from 'express';
{{/if}}{{#if (eq framework 'fastify')}}import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
{{/if}}
{{#if includeValidation}}import { validateRequest } from '../middleware/validation';
import { {{pascalCase routeName}}Schema } from '../schemas/{{routeName}}.schema';
{{/if}}

/**
 * {{pascalCase routeName}} route handler
 */
{{#if (eq framework 'express')}}const router = Router();

/**
 * GET /{{routeName}}
 * List all {{routeName}}
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // TODO: Implement list logic
    res.json({ data: [] });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /{{routeName}}/:id
 * Get a single {{routeName}} by ID
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    // TODO: Implement get by ID logic
    res.json({ data: { id } });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /{{routeName}}
 * Create a new {{routeName}}
 */
router.post('/', {{#if includeValidation}}validateRequest({{pascalCase routeName}}Schema), {{/if}}async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = req.body;
    // TODO: Implement create logic
    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /{{routeName}}/:id
 * Update a {{routeName}} by ID
 */
router.put('/:id', {{#if includeValidation}}validateRequest({{pascalCase routeName}}Schema), {{/if}}async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const data = req.body;
    // TODO: Implement update logic
    res.json({ data: { id, ...data } });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /{{routeName}}/:id
 * Delete a {{routeName}} by ID
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    // TODO: Implement delete logic
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;{{/if}}{{#if (eq framework 'fastify')}}export default async function {{pascalCase routeName}}Routes(fastify: FastifyInstance) {
  /**
   * GET /{{routeName}}
   * List all {{routeName}}
   */
  fastify.get('/{{routeName}}', async (request: FastifyRequest, reply: FastifyReply) => {
    // TODO: Implement list logic
    return { data: [] };
  });

  /**
   * GET /{{routeName}}/:id
   * Get a single {{routeName}} by ID
   */
  fastify.get<{ Params: { id: string } }>('/{{routeName}}/:id', async (request, reply) => {
    const { id } = request.params;
    // TODO: Implement get by ID logic
    return { data: { id } };
  });

  /**
   * POST /{{routeName}}
   * Create a new {{routeName}}
   */
  fastify.post<{ Body: unknown }>('/{{routeName}}'{{#if includeValidation}}, { schema: {{pascalCase routeName}}Schema }{{/if}}, async (request, reply) => {
    const data = request.body;
    // TODO: Implement create logic
    reply.code(201);
    return { data };
  });

  /**
   * PUT /{{routeName}}/:id
   * Update a {{routeName}} by ID
   */
  fastify.put<{ Params: { id: string }; Body: unknown }>('/{{routeName}}/:id'{{#if includeValidation}}, { schema: {{pascalCase routeName}}Schema }{{/if}}, async (request, reply) => {
    const { id } = request.params;
    const data = request.body;
    // TODO: Implement update logic
    return { data: { id, ...data } };
  });

  /**
   * DELETE /{{routeName}}/:id
   * Delete a {{routeName}} by ID
   */
  fastify.delete<{ Params: { id: string } }>('/{{routeName}}/:id', async (request, reply) => {
    const { id } = request.params;
    // TODO: Implement delete logic
    reply.code(204);
    return '';
  });
}{{/if}}
`,
      },
      {
        path: 'src/schemas/{{routeName}}.schema.ts',
        content: `{{#if (eq framework 'express')}}import { z } from 'zod';

export const {{pascalCase routeName}}Schema = z.object({
  // TODO: Define schema fields
  name: z.string().min(1).max(100),
  description: z.string().optional(),
});

export type {{pascalCase routeName}}Input = z.infer<typeof {{pascalCase routeName}}Schema>;
{{/if}}{{#if (eq framework 'fastify')}}export const {{pascalCase routeName}}Schema = {
  body: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 100 },
      description: { type: 'string' },
    },
  },
};
{{/if}}
`,
        condition: '{{includeValidation}}',
      },
      {
        path: 'src/routes/__tests__/{{routeName}}.test.ts',
        content: `{{#if (eq framework 'express')}}import request from 'supertest';
import app from '../app';
import {{routeName}}Router from '../routes/{{routeName}}';

describe('{{pascalCase routeName}} Routes', () => {
  describe('GET /{{routeName}}', () => {
    it('should return a list of {{routeName}}', async () => {
      const response = await request(app).get('/{{routeName}}');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
    });
  });

  describe('POST /{{routeName}}', () => {
    it('should create a new {{routeName}}', async () => {
      const response = await request(app)
        .post('/{{routeName}}')
        .send({ name: 'Test' });
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('data');
    });
  });
});
{{/if}}{{#if (eq framework 'fastify')}}import { build } from '../app';
import {{pascalCase routeName}}Routes from '../routes/{{routeName}}';

describe('{{pascalCase routeName}} Routes', () => {
  const app = build();

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /{{routeName}}', () => {
    it('should return a list of {{routeName}}', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/{{routeName}}',
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toHaveProperty('data');
    });
  });

  describe('POST /{{routeName}}', () => {
    it('should create a new {{routeName}}', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/{{routeName}}',
        payload: { name: 'Test' },
      });
      expect(response.statusCode).toBe(201);
      expect(response.json()).toHaveProperty('data');
    });
  });
});
{{/if}}
`,
        condition: '{{includeTests}}',
      },
    ],
  },
};
