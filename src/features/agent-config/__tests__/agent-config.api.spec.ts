import request from 'supertest';
import { afterAll,beforeAll, describe, expect, it } from 'vitest';

import { shouldRunIntegrationTests } from '../../../__tests__/integration-gate';
import { app } from '../../../app';
import { PrismaService } from '../../../config/prisma.config';

const prisma = PrismaService.getInstance().client;

const describeIfIntegration = shouldRunIntegrationTests ? describe : describe.skip;

describeIfIntegration('Agent Config API Integration Tests', () => {
  let tenantId: string;

  beforeAll(async () => {
    // Create a test tenant
    const tenant = await prisma.tenant.create({
      data: {
        name: 'Test Tenant for Agent Config',
        slug: `test-agent-config-${Date.now()}`,
        industry: 'HEALTHCARE',
      },
    });
    tenantId = tenant.id;
  });

  afterAll(async () => {
    // Clean up
    await prisma.agentConfig.deleteMany({
      where: { tenantId },
    });
    await prisma.tenant
      .delete({
        where: { id: tenantId },
      })
      .catch(() => {});
  });

  describe('POST /v1/tenants/:tenantId/agent-config', () => {
    it('should create agent config', async () => {
      const response = await request(app).post(`/v1/tenants/${tenantId}/agent-config`).send({
        tenantId,
        systemPrompt: 'You are a helpful medical receptionist.',
        voiceId: 'elevenlabs-123',
        language: 'en-IN',
        sttProvider: 'DEEPGRAM',
        ttsProvider: 'ELEVEN_LABS',
        llmProvider: 'OPENAI',
        telephonyProvider: 'EXOTEL',
        maxCallDuration: 300,
        greeting: 'Hello, how can I help you today?',
        enableMemory: true,
        enableExtraction: true,
        enableRecording: false,
      });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.systemPrompt).toBe('You are a helpful medical receptionist.');
      expect(response.body.data.sttProvider).toBe('DEEPGRAM');
    });

    it('should reject duplicate config for same tenant', async () => {
      const response = await request(app).post(`/v1/tenants/${tenantId}/agent-config`).send({
        tenantId,
        systemPrompt: 'Another prompt',
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /v1/tenants/:tenantId/agent-config', () => {
    it('should get agent config', async () => {
      const response = await request(app).get(`/v1/tenants/${tenantId}/agent-config`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.tenantId).toBe(tenantId);
    });

    it('should return 404 if config not found', async () => {
      const response = await request(app).get('/v1/tenants/non-existent-id/agent-config');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /v1/tenants/:tenantId/agent-config', () => {
    it('should update agent config', async () => {
      const response = await request(app).put(`/v1/tenants/${tenantId}/agent-config`).send({
        systemPrompt: 'Updated prompt for the AI.',
        voiceId: 'new-voice-456',
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.systemPrompt).toBe('Updated prompt for the AI.');
      expect(response.body.data.voiceId).toBe('new-voice-456');
    });
  });

  describe('DELETE /v1/tenants/:tenantId/agent-config', () => {
    it('should delete agent config', async () => {
      // Create a new tenant and config for deletion test
      const newTenant = await prisma.tenant.create({
        data: {
          name: 'Delete Test Tenant',
          slug: `delete-test-${Date.now()}`,
          industry: 'SERVICES',
        },
      });

      await prisma.agentConfig.create({
        data: {
          tenantId: newTenant.id,
          systemPrompt: 'Test prompt',
          sttProvider: 'DEEPGRAM',
          ttsProvider: 'ELEVEN_LABS',
          llmProvider: 'OPENAI',
          telephonyProvider: 'EXOTEL',
        },
      });

      const response = await request(app).delete(`/v1/tenants/${newTenant.id}/agent-config`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Clean up
      await prisma.tenant.delete({ where: { id: newTenant.id } });
    });
  });
});
