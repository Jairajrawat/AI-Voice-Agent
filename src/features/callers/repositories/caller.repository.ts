import { Caller, PrismaClient } from '@prisma/client';

export class CallerRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: {
    tenantId: string;
    phoneNumber: string;
    name?: string;
    email?: string;
    expiresAt?: Date;
  }): Promise<Caller> {
    return this.prisma.caller.create({
      data: {
        tenantId: data.tenantId,
        phoneNumber: data.phoneNumber,
        name: data.name,
        email: data.email,
        expiresAt: data.expiresAt,
        isSaved: false,
        totalCalls: 1,
      },
    });
  }

  async findById(id: string): Promise<Caller | null> {
    return this.prisma.caller.findUnique({
      where: { id },
    });
  }

  async findByPhoneNumber(phoneNumber: string, tenantId: string): Promise<Caller | null> {
    return this.prisma.caller.findUnique({
      where: {
        tenantId_phoneNumber: {
          tenantId,
          phoneNumber,
        },
      },
    });
  }

  async updateLastCall(id: string): Promise<Caller> {
    return this.prisma.caller.update({
      where: { id },
      data: {
        lastCallAt: new Date(),
        totalCalls: {
          increment: 1,
        },
      },
    });
  }

  async saveCaller(id: string): Promise<Caller> {
    return this.prisma.caller.update({
      where: { id },
      data: {
        isSaved: true,
        expiresAt: null, // Remove expiry for saved callers
      },
    });
  }

  async unsaveCaller(id: string, retentionDays: number): Promise<Caller> {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + retentionDays);

    return this.prisma.caller.update({
      where: { id },
      data: {
        isSaved: false,
        expiresAt: expiryDate,
      },
    });
  }
}
