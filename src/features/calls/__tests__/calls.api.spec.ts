import request from 'supertest';
import { afterAll,beforeAll, describe, expect, it } from 'vitest';

import { shouldRunIntegrationTests } from '../../../__tests__/integration-gate';
import { app } from '../../../app';
import { PrismaService } from '../../../config/prisma.config';

const prisma = PrismaService.getInstance().client;

const describeIfIntegration = shouldRunIntegrationTests ? describe : describe.skip;

describeIfIntegration('Calls API Integration Tests', () => {
  let tenantId: string;
  let phoneNumberId: string;
  let callerId: string;
  let callId: string;

  beforeAll(async () => {
    // Create test tenant
    const tenant = await prisma.tenant.create({
      data: {
        name: 'Test Tenant for Calls',
        slug: `test-calls-${Date.now()}`,
        industry: 'HEALTHCARE',
      },
    });
    tenantId = tenant.id;

    // Create test phone number
    const phoneNumber = await prisma.phoneNumber.create({
      data: {
        number: `+919876543210`,
        provider: 'EXOTEL',
        tenantId,
        label: 'Main Line',
      },
    });
    phoneNumberId = phoneNumber.id;

    // Create test caller
    const caller = await prisma.caller.create({
      data: {
        tenantId,
        phoneNumber: '+919876543211',
        expiresAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      },
    });
    callerId = caller.id;
  });

  afterAll(async () => {
    // Clean up
    await prisma.transcript.deleteMany({
      where: { call: { tenantId } },
    });
    await prisma.extraction.deleteMany({
      where: { call: { tenantId } },
    });
    await prisma.call.deleteMany({
      where: { tenantId },
    });
    await prisma.caller.deleteMany({
      where: { tenantId },
    });
    await prisma.phoneNumber.deleteMany({
      where: { tenantId },
    });
    await prisma.tenant
      .delete({
        where: { id: tenantId },
      })
      .catch(() => {});
  });

  describe('Call Creation', () => {
    it('should create a call record', async () => {
      const response = await request(app).post(`/v1/tenants/${tenantId}/calls/outbound`).send({
        phoneNumberId,
        toNumber: '+919876543212',
      });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.call).toHaveProperty('id');
      expect(response.body.call.direction).toBe('OUTBOUND');

      callId = response.body.call.id;
    });
  });

  describe('GET /v1/tenants/:tenantId/calls', () => {
    it('should list calls with pagination', async () => {
      const response = await request(app)
        .get(`/v1/tenants/${tenantId}/calls`)
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination).toBeDefined();
    });

    it('should filter calls by status', async () => {
      const response = await request(app)
        .get(`/v1/tenants/${tenantId}/calls`)
        .query({ status: 'RINGING' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /v1/tenants/:tenantId/calls/:callId', () => {
    it('should get call details', async () => {
      const response = await request(app).get(`/v1/tenants/${tenantId}/calls/${callId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(callId);
    });

    it('should return 404 for non-existent call', async () => {
      const response = await request(app).get(`/v1/tenants/${tenantId}/calls/non-existent-id`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /v1/tenants/:tenantId/calls/:callId', () => {
    it('should update call status', async () => {
      const response = await request(app).put(`/v1/tenants/${tenantId}/calls/${callId}`).send({
        status: 'COMPLETED',
        summary: 'Customer booked appointment for tomorrow.',
        sentiment: 'POSITIVE',
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('COMPLETED');
      expect(response.body.data.summary).toBe('Customer booked appointment for tomorrow.');
    });
  });

  describe('Internal APIs - Transcripts', () => {
    it('should save transcript chunk', async () => {
      const response = await request(app).post(`/api/internal/calls/${callId}/transcript`).send({
        role: 'CALLER',
        content: 'Hello, I need to book an appointment.',
        confidence: 0.95,
      });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.role).toBe('CALLER');
    });

    it('should save multiple transcript chunks', async () => {
      const response1 = await request(app).post(`/api/internal/calls/${callId}/transcript`).send({
        role: 'AGENT',
        content: 'Sure, what time works for you?',
      });

      expect(response1.status).toBe(201);

      const response2 = await request(app).post(`/api/internal/calls/${callId}/transcript`).send({
        role: 'CALLER',
        content: 'How about 3 PM tomorrow?',
      });

      expect(response2.status).toBe(201);
    });
  });

  describe('Internal APIs - Extractions', () => {
    it('should save extraction data', async () => {
      const response = await request(app)
        .post(`/api/internal/calls/${callId}/extraction`)
        .send({
          type: 'appointment',
          data: {
            date: '2026-02-13',
            time: '15:00',
            patientName: 'John Doe',
            reason: 'Regular checkup',
          },
          confidence: 0.92,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.type).toBe('appointment');
    });
  });

  describe('Internal APIs - Complete Call', () => {
    it('should mark call as completed', async () => {
      const response = await request(app).post(`/api/internal/calls/${callId}/complete`).send({
        summary: 'Appointment booked successfully.',
        sentiment: 'POSITIVE',
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('DELETE /v1/tenants/:tenantId/calls/:callId', () => {
    it('should delete call', async () => {
      // Create a new call to delete
      const createResponse = await request(app)
        .post(`/v1/tenants/${tenantId}/calls/outbound`)
        .send({
          phoneNumberId,
          toNumber: '+919876543213',
        });

      const newCallId = createResponse.body.call.id;

      const response = await request(app).delete(`/v1/tenants/${tenantId}/calls/${newCallId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
