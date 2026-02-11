import { Router } from 'express';

import { PrismaService } from '../../../config/prisma.config';
import { TenantRepository } from '../../tenant/repositories/tenant.repository';
import { TenantService } from '../../tenant/services/tenant.service';

const router = Router();
const prisma = PrismaService.getInstance().client;
const tenantRepository = new TenantRepository(prisma);
const tenantService = new TenantService(tenantRepository);

/**
 * Testing routes for Tenant - No validation, for development only
 */

// Quick create tenant without validation
router.post('/tenants', async (req, res) => {
  try {
    const result = await tenantService.createTenant({
      name: req.body.name || 'Test Business',
      slug: req.body.slug || `test-${Date.now()}`,
      industry: req.body.industry || 'OTHER',
      dataRetentionDays: req.body.dataRetentionDays || 15,
      saveCallRecordings: req.body.saveCallRecordings || false,
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// List all tenants (no pagination)
router.get('/tenants', async (req, res) => {
  try {
    const result = await tenantService.getAllTenants();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Delete tenant completely (not just deactivate)
router.delete('/tenants/:id', async (req, res) => {
  try {
    await prisma.tenant.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Tenant deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;
