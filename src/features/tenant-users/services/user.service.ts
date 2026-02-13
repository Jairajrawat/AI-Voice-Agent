import { User } from '@prisma/client';

import { UserRepository } from '../repositories/user.repository';
import { CreateUserInput, UpdateUserInput } from '../schemas/user.schema';

export class UserService {
  constructor(private userRepository: UserRepository) {}

  async createUser(
    data: CreateUserInput,
    clerkId: string,
  ): Promise<{ success: boolean; data?: User; error?: string }> {
    try {
      // Check if user already exists in this tenant
      const existing = await this.userRepository.findByEmail(data.email, data.tenantId);
      if (existing) {
        return {
          success: false,
          error: 'User with this email already exists in this tenant',
        };
      }

      const user = await this.userRepository.create({ ...data, clerkId });

      return {
        success: true,
        data: user,
      };
    } catch (error) {
      console.error('Error creating user:', error);
      return {
        success: false,
        error: 'Failed to create user',
      };
    }
  }

  async getUserById(id: string): Promise<{ success: boolean; data?: User; error?: string }> {
    try {
      const user = await this.userRepository.findById(id);

      if (!user) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      return {
        success: true,
        data: user,
      };
    } catch (error) {
      console.error('Error fetching user:', error);
      return {
        success: false,
        error: 'Failed to fetch user',
      };
    }
  }

  async getUsersByTenant(
    tenantId: string,
  ): Promise<{ success: boolean; data?: User[]; error?: string }> {
    try {
      const users = await this.userRepository.findByTenant(tenantId);

      return {
        success: true,
        data: users,
      };
    } catch (error) {
      console.error('Error fetching users:', error);
      return {
        success: false,
        error: 'Failed to fetch users',
      };
    }
  }

  async updateUser(
    id: string,
    data: UpdateUserInput,
  ): Promise<{ success: boolean; data?: User; error?: string }> {
    try {
      const existing = await this.userRepository.findById(id);

      if (!existing) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      const user = await this.userRepository.update(id, data);

      return {
        success: true,
        data: user,
      };
    } catch (error) {
      console.error('Error updating user:', error);
      return {
        success: false,
        error: 'Failed to update user',
      };
    }
  }

  async deleteUser(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const existing = await this.userRepository.findById(id);

      if (!existing) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      await this.userRepository.delete(id);

      return {
        success: true,
      };
    } catch (error) {
      console.error('Error deleting user:', error);
      return {
        success: false,
        error: 'Failed to delete user',
      };
    }
  }
}
