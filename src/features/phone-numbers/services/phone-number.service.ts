import { PhoneNumber } from '@prisma/client';

import { PhoneNumberRepository } from '../repositories/phone-number.repository';
import { CreatePhoneNumberInput, UpdatePhoneNumberInput } from '../schemas/phone-number.schema';

export class PhoneNumberService {
  constructor(private phoneNumberRepository: PhoneNumberRepository) {}

  async createPhoneNumber(
    data: CreatePhoneNumberInput,
  ): Promise<{ success: boolean; data?: PhoneNumber; error?: string }> {
    try {
      // Check if phone number already exists
      const existing = await this.phoneNumberRepository.findByNumber(data.number);
      if (existing) {
        return {
          success: false,
          error: 'Phone number already exists in system',
        };
      }

      const phoneNumber = await this.phoneNumberRepository.create(data);

      return {
        success: true,
        data: phoneNumber,
      };
    } catch (error) {
      console.error('Error creating phone number:', error);
      return {
        success: false,
        error: 'Failed to create phone number',
      };
    }
  }

  async getPhoneNumberById(
    id: string,
  ): Promise<{ success: boolean; data?: PhoneNumber; error?: string }> {
    try {
      const phoneNumber = await this.phoneNumberRepository.findById(id);

      if (!phoneNumber) {
        return {
          success: false,
          error: 'Phone number not found',
        };
      }

      return {
        success: true,
        data: phoneNumber,
      };
    } catch (error) {
      console.error('Error fetching phone number:', error);
      return {
        success: false,
        error: 'Failed to fetch phone number',
      };
    }
  }

  async getPhoneNumbersByTenant(
    tenantId: string,
  ): Promise<{ success: boolean; data?: PhoneNumber[]; error?: string }> {
    try {
      const phoneNumbers = await this.phoneNumberRepository.findByTenant(tenantId);

      return {
        success: true,
        data: phoneNumbers,
      };
    } catch (error) {
      console.error('Error fetching phone numbers:', error);
      return {
        success: false,
        error: 'Failed to fetch phone numbers',
      };
    }
  }

  async updatePhoneNumber(
    id: string,
    data: UpdatePhoneNumberInput,
  ): Promise<{ success: boolean; data?: PhoneNumber; error?: string }> {
    try {
      const existing = await this.phoneNumberRepository.findById(id);

      if (!existing) {
        return {
          success: false,
          error: 'Phone number not found',
        };
      }

      const phoneNumber = await this.phoneNumberRepository.update(id, data);

      return {
        success: true,
        data: phoneNumber,
      };
    } catch (error) {
      console.error('Error updating phone number:', error);
      return {
        success: false,
        error: 'Failed to update phone number',
      };
    }
  }

  async deletePhoneNumber(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const existing = await this.phoneNumberRepository.findById(id);

      if (!existing) {
        return {
          success: false,
          error: 'Phone number not found',
        };
      }

      await this.phoneNumberRepository.delete(id);

      return {
        success: true,
      };
    } catch (error) {
      console.error('Error deleting phone number:', error);
      return {
        success: false,
        error: 'Failed to delete phone number',
      };
    }
  }
}
