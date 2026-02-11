import { PhoneNumber, PrismaClient } from '@prisma/client';

import { CreatePhoneNumberInput, UpdatePhoneNumberInput } from '../schemas/phone-number.schema';

export class PhoneNumberRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreatePhoneNumberInput): Promise<PhoneNumber> {
    return this.prisma.phoneNumber.create({
      data: {
        number: data.number,
        provider: data.provider,
        label: data.label,
        tenantId: data.tenantId,
        isActive: true,
      },
    });
  }

  async findById(id: string): Promise<PhoneNumber | null> {
    return this.prisma.phoneNumber.findUnique({
      where: { id },
    });
  }

  async findByNumber(number: string): Promise<PhoneNumber | null> {
    return this.prisma.phoneNumber.findUnique({
      where: { number },
    });
  }

  async findByTenant(tenantId: string): Promise<PhoneNumber[]> {
    return this.prisma.phoneNumber.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, data: UpdatePhoneNumberInput): Promise<PhoneNumber> {
    return this.prisma.phoneNumber.update({
      where: { id },
      data: {
        ...(data.label !== undefined && { label: data.label }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
  }

  async delete(id: string): Promise<PhoneNumber> {
    return this.prisma.phoneNumber.delete({
      where: { id },
    });
  }

  async countByTenant(tenantId: string): Promise<number> {
    return this.prisma.phoneNumber.count({
      where: { tenantId },
    });
  }
}
