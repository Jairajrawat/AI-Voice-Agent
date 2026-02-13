import request from 'supertest';
import { afterAll,beforeAll, describe, expect, it } from 'vitest';

import { shouldRunIntegrationTests } from '../../../__tests__/integration-gate';
import { app } from '../../../app';
import { PrismaService } from '../../../config/prisma.config';

const prisma = PrismaService.getInstance().client;

const describeIfIntegration = shouldRunIntegrationTests ? describe : describe.skip;

describeIfIntegration('Tenant API Integration Tests', () => {
  let createdTenantId: string;

  // Clean up before tests
  beforeAll(async () => {
    // Delete test tenants if they exist
    await prisma.tenant.deleteMany({
      where: {
        slug: {
          contains: 'test-',
        },
      },
    });
  });

  // Clean up after tests
  afterAll(async () => {
    if (createdTenantId) {
      await prisma.tenant
        .delete({
          where: { id: createdTenantId },
        })
        .catch(() => {});
    }
  });

  describe('POST /v1/tenants', () => {
    it('should create a new tenant', async () => {
      const response = await request(app)
        .post('/v1/tenants')
        .send({
          name: 'Test Medical Clinic',
          slug: `test-clinic-${Date.now()}`,
          industry: 'HEALTHCARE',
          dataRetentionDays: 15,
          saveCallRecordings: false,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.name).toBe('Test Medical Clinic');
      expect(response.body.data.industry).toBe('HEALTHCARE');

      createdTenantId = response.body.data.id;
    });

    it('should reject duplicate slug', async () => {
      const slug = `test-duplicate-${Date.now()}`;

      // Create first tenant
      await request(app).post('/v1/tenants').send({
        name: 'First Tenant',
        slug,
        industry: 'SERVICES',
      });

      // Try to create second with same slug
      const response = await request(app).post('/v1/tenants').send({
        name: 'Second Tenant',
        slug,
        industry: 'RESTAURANT',
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should validate required fields', async () => {
      const response = await request(app).post('/v1/tenants').send({
        name: '',
        slug: 'test',
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /v1/tenants', () => {
    it('should list all tenants', async () => {
      const response = await request(app).get('/v1/tenants');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('GET /v1/tenants/:id', () => {
    it('should get tenant by id', async () => {
      const response = await request(app).get(`/v1/tenants/${createdTenantId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(createdTenantId);
    });

    it('should return 404 for non-existent tenant', async () => {
      const response = await request(app).get('/v1/tenants/non-existent-id');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /v1/tenants/:id', () => {
    it('should update tenant', async () => {
      const response = await request(app).put(`/v1/tenants/${createdTenantId}`).send({
        name: 'Updated Clinic Name',
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Clinic Name');
    });
  });

  describe('DELETE /v1/tenants/:id', () => {
    it('should deactivate tenant', async () => {
      // Create a tenant to delete
      const createResponse = await request(app)
        .post('/v1/tenants')
        .send({
          name: 'Tenant To Delete',
          slug: `test-delete-${Date.now()}`,
          industry: 'RETAIL',
        });

      const tenantId = createResponse.body.data.id;

      const response = await request(app).delete(`/v1/tenants/${tenantId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
