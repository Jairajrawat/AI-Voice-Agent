import { Call, PrismaClient } from '@prisma/client';

import { PrismaService } from '../../../config/prisma.config';
import { CreateCallInput, UpdateCallInput } from '../schemas/call.schema';

export class CallService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = PrismaService.getInstance().client;
  }

  async create(data: CreateCallInput): Promise<Call> {
    return this.prisma.call.create({
      data: {
        externalId: data.externalId,
        tenantId: data.tenantId,
        phoneNumberId: data.phoneNumberId,
        callerId: data.callerId,
        direction: data.direction,
        status: data.status,
      },
      include: {
        caller: {
          select: {
            id: true,
            phoneNumber: true,
            name: true,
          },
        },
        phoneNumber: {
          select: {
            id: true,
            number: true,
            label: true,
          },
        },
      },
    });
  }

  async findById(id: string, tenantId: string): Promise<Call | null> {
    return this.prisma.call.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        caller: true,
        transcripts: {
          orderBy: {
            timestamp: 'asc',
          },
        },
        extractions: true,
        recordings: true,
        phoneNumber: {
          select: {
            id: true,
            number: true,
            label: true,
          },
        },
      },
    });
  }

  async findByExternalId(externalId: string): Promise<Call | null> {
    return this.prisma.call.findUnique({
      where: { externalId },
      include: {
        caller: true,
        tenant: true,
      },
    });
  }

  async findByTenant(
    tenantId: string,
    options: {
      page?: number;
      limit?: number;
      status?: string;
      from?: Date;
      to?: Date;
    },
  ): Promise<{ calls: Call[]; total: number }> {
    const where: any = { tenantId };

    if (options.status) {
      where.status = options.status;
    }

    if (options.from || options.to) {
      where.startedAt = {};
      if (options.from) {
        where.startedAt.gte = options.from;
      }
      if (options.to) {
        where.startedAt.lte = options.to;
      }
    }

    const [calls, total] = await Promise.all([
      this.prisma.call.findMany({
        where,
        skip: options.page && options.limit ? (options.page - 1) * options.limit : undefined,
        take: options.limit,
        orderBy: { startedAt: 'desc' },
        include: {
          caller: {
            select: {
              id: true,
              phoneNumber: true,
              name: true,
            },
          },
          phoneNumber: {
            select: {
              id: true,
              number: true,
              label: true,
            },
          },
          _count: {
            select: {
              transcripts: true,
              extractions: true,
            },
          },
        },
      }),
      this.prisma.call.count({ where }),
    ]);

    return { calls, total };
  }

  async update(id: string, tenantId: string, data: UpdateCallInput): Promise<Call> {
    return this.prisma.call.update({
      where: {
        id,
      },
      data: {
        ...(data.status && { status: data.status }),
        ...(data.summary && { summary: data.summary }),
        ...(data.sentiment && { sentiment: data.sentiment }),
        ...(data.status === 'COMPLETED' && { endedAt: new Date() }),
        ...(data.status === 'IN_PROGRESS' && { answeredAt: new Date() }),
      },
    });
  }

  async updateStatus(
    id: string,
    status: string,
    data?: { durationSecs?: number; endedAt?: Date },
  ): Promise<Call> {
    return this.prisma.call.update({
      where: { id },
      data: {
        status: status as any,
        ...(data?.durationSecs && { durationSecs: data.durationSecs }),
        ...(data?.endedAt && { endedAt: data.endedAt }),
        ...(status === 'COMPLETED' && { endedAt: new Date() }),
        ...(status === 'IN_PROGRESS' && { answeredAt: new Date() }),
      },
    });
  }

  async delete(id: string, tenantId: string): Promise<Call> {
    return this.prisma.call.delete({
      where: {
        id,
      },
    });
  }

  async triggerOutboundCall(
    tenantId: string,
    phoneNumberId: string,
    toNumber: string,
  ): Promise<{ success: boolean; call?: Call; error?: string }> {
    try {
      // Get phone number
      const phoneNumber = await this.prisma.phoneNumber.findFirst({
        where: {
          id: phoneNumberId,
          tenantId,
        },
      });

      if (!phoneNumber) {
        return { success: false, error: 'Phone number not found' };
      }

      // Find or create caller
      let caller = await this.prisma.caller.findUnique({
        where: {
          tenantId_phoneNumber: {
            tenantId,
            phoneNumber: toNumber,
          },
        },
      });

      if (!caller) {
        const tenant = await this.prisma.tenant.findUnique({
          where: { id: tenantId },
        });

        caller = await this.prisma.caller.create({
          data: {
            tenantId,
            phoneNumber: toNumber,
            expiresAt: new Date(
              Date.now() + (tenant?.dataRetentionDays || 15) * 24 * 60 * 60 * 1000,
            ),
          },
        });
      }

      // Create call record
      const call = await this.create({
        externalId: `outbound-${Date.now()}`,
        tenantId,
        phoneNumberId,
        callerId: caller.id,
        direction: 'OUTBOUND',
        status: 'RINGING',
      });

      return { success: true, call };
    } catch (error) {
      console.error('Error triggering outbound call:', error);
      return { success: false, error: 'Failed to trigger outbound call' };
    }
  }
}
