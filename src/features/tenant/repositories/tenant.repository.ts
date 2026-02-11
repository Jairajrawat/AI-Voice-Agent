import { PrismaClient, Tenant, Prisma } from '@prisma/client';

import { CreateTenantInput, UpdateTenantInput } from '../schemas/tenant.schema';

export class TenantRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateTenantInput): Promise<Tenant> {
    return this.prisma.tenant.create({
      data: {
        name: data.name,
        slug: data.slug,
        industry: data.industry,
        dataRetentionDays: data.dataRetentionDays,
        saveCallRecordings: data.saveCallRecordings,
        status: 'ACTIVE',
        plan: 'STARTER',
      },
    });
  }

  async findById(id: string): Promise<Tenant | null> {
    return this.prisma.tenant.findUnique({
      where: { id },
      include: {
        users: true,
        phoneNumbers: true,
        agentConfig: true,
      },
    });
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    return this.prisma.tenant.findUnique({
      where: { slug },
    });
  }

  async findAll(options?: { skip?: number; take?: number; status?: string }): Promise<Tenant[]> {
    const where: Prisma.TenantWhereInput = {};

    if (options?.status) {
      where.status = options.status as any;
    }

    return this.prisma.tenant.findMany({
      where,
      skip: options?.skip,
      take: options?.take,
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, data: UpdateTenantInput): Promise<Tenant> {
    return this.prisma.tenant.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.industry && { industry: data.industry }),
        ...(data.status && { status: data.status }),
        ...(data.plan && { plan: data.plan }),
        ...(data.dataRetentionDays && { dataRetentionDays: data.dataRetentionDays }),
        ...(data.saveCallRecordings !== undefined && {
          saveCallRecordings: data.saveCallRecordings,
        }),
      },
    });
  }

  async delete(id: string): Promise<Tenant> {
    return this.prisma.tenant.delete({
      where: { id },
    });
  }

  async deactivate(id: string): Promise<Tenant> {
    return this.prisma.tenant.update({
      where: { id },
      data: { status: 'SUSPENDED' },
    });
  }

  async count(): Promise<number> {
    return this.prisma.tenant.count();
  }
}
