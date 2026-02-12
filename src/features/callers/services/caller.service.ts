import { PrismaService } from '../../../config/prisma.config';
import { UpdateCallerInput } from '../schemas/caller.schema';

export class CallerService {
  private prisma = PrismaService.getInstance().client;

  async findById(id: string, tenantId: string) {
    return this.prisma.caller.findFirst({
      where: { id, tenantId },
      include: {
        calls: {
          orderBy: { startedAt: 'desc' },
          take: 10,
          select: {
            id: true,
            startedAt: true,
            durationSecs: true,
            status: true,
            summary: true,
            sentiment: true,
          },
        },
        _count: {
          select: { calls: true },
        },
      },
    });
  }

  async findByTenant(
    tenantId: string,
    options: {
      page?: number;
      limit?: number;
      isSaved?: boolean;
      search?: string;
    },
  ) {
    const where: any = { tenantId };

    if (options.isSaved !== undefined) {
      where.isSaved = options.isSaved;
    }

    if (options.search) {
      where.OR = [
        { phoneNumber: { contains: options.search } },
        { name: { contains: options.search, mode: 'insensitive' } },
        { email: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const [callers, total] = await Promise.all([
      this.prisma.caller.findMany({
        where,
        skip: options.page && options.limit ? (options.page - 1) * options.limit : undefined,
        take: options.limit,
        orderBy: { lastCallAt: 'desc' },
        include: {
          _count: {
            select: { calls: true },
          },
        },
      }),
      this.prisma.caller.count({ where }),
    ]);

    return { callers, total };
  }

  async update(id: string, tenantId: string, data: UpdateCallerInput) {
    return this.prisma.caller.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.email && { email: data.email }),
        ...(data.preferences && { preferences: data.preferences }),
        ...(data.metadata && { metadata: data.metadata }),
      },
    });
  }

  async saveCaller(id: string, tenantId: string) {
    return this.prisma.caller.update({
      where: { id },
      data: {
        isSaved: true,
        expiresAt: null, // Remove expiry for saved callers
      },
    });
  }

  async unsaveCaller(id: string, tenantId: string) {
    // Get tenant to calculate new expiry
    const caller = await this.prisma.caller.findFirst({
      where: { id },
      include: { tenant: true },
    });

    if (!caller) {
      throw new Error('Caller not found');
    }

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + (caller.tenant.dataRetentionDays || 15));

    return this.prisma.caller.update({
      where: { id },
      data: {
        isSaved: false,
        expiresAt: expiryDate,
      },
    });
  }

  async delete(id: string, tenantId: string) {
    return this.prisma.caller.delete({
      where: { id },
    });
  }
}
