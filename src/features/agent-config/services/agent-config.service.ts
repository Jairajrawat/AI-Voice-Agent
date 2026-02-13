import { AgentConfig } from '@prisma/client';

import { AgentConfigRepository } from '../repositories/agent-config.repository';
import { CreateAgentConfigInput, UpdateAgentConfigInput } from '../schemas/agent-config.schema';

export class AgentConfigService {
  constructor(private agentConfigRepository: AgentConfigRepository) {}

  async createConfig(
    data: CreateAgentConfigInput,
  ): Promise<{ success: boolean; data?: AgentConfig; error?: string }> {
    try {
      // Check if config already exists for this tenant
      const existing = await this.agentConfigRepository.findByTenantId(data.tenantId);
      if (existing) {
        return {
          success: false,
          error: 'Agent config already exists for this tenant. Use update instead.',
        };
      }

      const config = await this.agentConfigRepository.create(data);

      return {
        success: true,
        data: config,
      };
    } catch (error) {
      console.error('Error creating agent config:', error);
      return {
        success: false,
        error: 'Failed to create agent config',
      };
    }
  }

  async getConfigByTenantId(
    tenantId: string,
  ): Promise<{
    success: boolean;
    data?: AgentConfig;
    decryptedKeys?: Record<string, string> | null;
    error?: string;
  }> {
    try {
      const config = await this.agentConfigRepository.findByTenantId(tenantId);

      if (!config) {
        return {
          success: false,
          error: 'Agent config not found',
        };
      }

      // Decrypt API keys
      const decryptedKeys = this.agentConfigRepository.decryptApiKeys(config.providerApiKeys);

      return {
        success: true,
        data: config,
        decryptedKeys,
      };
    } catch (error) {
      console.error('Error fetching agent config:', error);
      return {
        success: false,
        error: 'Failed to fetch agent config',
      };
    }
  }

  async updateConfig(
    tenantId: string,
    data: UpdateAgentConfigInput,
  ): Promise<{ success: boolean; data?: AgentConfig; error?: string }> {
    try {
      const existing = await this.agentConfigRepository.findByTenantId(tenantId);

      if (!existing) {
        return {
          success: false,
          error: 'Agent config not found',
        };
      }

      const config = await this.agentConfigRepository.update(tenantId, data);

      return {
        success: true,
        data: config,
      };
    } catch (error) {
      console.error('Error updating agent config:', error);
      return {
        success: false,
        error: 'Failed to update agent config',
      };
    }
  }

  async deleteConfig(tenantId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const existing = await this.agentConfigRepository.findByTenantId(tenantId);

      if (!existing) {
        return {
          success: false,
          error: 'Agent config not found',
        };
      }

      await this.agentConfigRepository.delete(tenantId);

      return {
        success: true,
      };
    } catch (error) {
      console.error('Error deleting agent config:', error);
      return {
        success: false,
        error: 'Failed to delete agent config',
      };
    }
  }
}
