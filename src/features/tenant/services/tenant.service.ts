import { Tenant } from '@prisma/client';

import { CreateTenantInput, UpdateTenantInput } from '../schemas/tenant.schema';
import { TenantRepository } from '../repositories/tenant.repository';

export class TenantService {
  constructor(private tenantRepository: TenantRepository) {}

  async createTenant(
    data: CreateTenantInput,
  ): Promise<{ success: boolean; data?: Tenant; error?: string }> {
    try {
      // Check if slug already exists
      const existing = await this.tenantRepository.findBySlug(data.slug);
      if (existing) {
        return {
          success: false,
          error: 'Tenant with this slug already exists',
        };
      }

      const tenant = await this.tenantRepository.create(data);

      return {
        success: true,
        data: tenant,
      };
    } catch (error) {
      console.error('Error creating tenant:', error);
      return {
        success: false,
        error: 'Failed to create tenant',
      };
    }
  }

  async getTenantById(id: string): Promise<{ success: boolean; data?: Tenant; error?: string }> {
    try {
      const tenant = await this.tenantRepository.findById(id);

      if (!tenant) {
        return {
          success: false,
          error: 'Tenant not found',
        };
      }

      return {
        success: true,
        data: tenant,
      };
    } catch (error) {
      console.error('Error fetching tenant:', error);
      return {
        success: false,
        error: 'Failed to fetch tenant',
      };
    }
  }

  async getAllTenants(options?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<{ success: boolean; data?: Tenant[]; total?: number; error?: string }> {
    try {
      const skip = options?.page && options?.limit ? (options.page - 1) * options.limit : undefined;

      const [tenants, total] = await Promise.all([
        this.tenantRepository.findAll({
          skip,
          take: options?.limit,
          status: options?.status,
        }),
        this.tenantRepository.count(),
      ]);

      return {
        success: true,
        data: tenants,
        total,
      };
    } catch (error) {
      console.error('Error fetching tenants:', error);
      return {
        success: false,
        error: 'Failed to fetch tenants',
      };
    }
  }

  async updateTenant(
    id: string,
    data: UpdateTenantInput,
  ): Promise<{ success: boolean; data?: Tenant; error?: string }> {
    try {
      const existing = await this.tenantRepository.findById(id);

      if (!existing) {
        return {
          success: false,
          error: 'Tenant not found',
        };
      }

      const tenant = await this.tenantRepository.update(id, data);

      return {
        success: true,
        data: tenant,
      };
    } catch (error) {
      console.error('Error updating tenant:', error);
      return {
        success: false,
        error: 'Failed to update tenant',
      };
    }
  }

  async deleteTenant(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const existing = await this.tenantRepository.findById(id);

      if (!existing) {
        return {
          success: false,
          error: 'Tenant not found',
        };
      }

      await this.tenantRepository.deactivate(id);

      return {
        success: true,
      };
    } catch (error) {
      console.error('Error deleting tenant:', error);
      return {
        success: false,
        error: 'Failed to delete tenant',
      };
    }
  }
}
