import { Call, CallDirection, CallStatus, PrismaClient } from '@prisma/client';

export class CallRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: {
    externalId: string;
    tenantId: string;
    phoneNumberId: string;
    callerId: string;
    direction: CallDirection;
    status: CallStatus;
  }): Promise<Call> {
    return this.prisma.call.create({
      data: {
        externalId: data.externalId,
        tenantId: data.tenantId,
        phoneNumberId: data.phoneNumberId,
        callerId: data.callerId,
        direction: data.direction,
        status: data.status,
      },
    });
  }

  async findById(id: string): Promise<Call | null> {
    return this.prisma.call.findUnique({
      where: { id },
      include: {
        caller: true,
        transcripts: true,
        extractions: true,
      },
    });
  }

  async findByExternalId(externalId: string): Promise<Call | null> {
    return this.prisma.call.findUnique({
      where: { externalId },
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
        status: status as CallStatus,
        ...(data?.durationSecs && { durationSecs: data.durationSecs }),
        ...(data?.endedAt && { endedAt: data.endedAt }),
        ...(status === 'COMPLETED' && { endedAt: new Date() }),
        ...(status === 'IN_PROGRESS' && { answeredAt: new Date() }),
      },
    });
  }

  async findByTenant(
    tenantId: string,
    options?: {
      limit?: number;
      offset?: number;
      status?: string;
    },
  ): Promise<Call[]> {
    return this.prisma.call.findMany({
      where: {
        tenantId,
        ...(options?.status && { status: options.status as CallStatus }),
      },
      take: options?.limit,
      skip: options?.offset,
      orderBy: { startedAt: 'desc' },
      include: {
        caller: {
          select: {
            id: true,
            phoneNumber: true,
            name: true,
          },
        },
      },
    });
  }
}
