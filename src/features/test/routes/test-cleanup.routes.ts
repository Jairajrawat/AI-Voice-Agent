import { Router } from 'express';

import { dataCleanupJob } from '../../../jobs/data-cleanup.job';

const router = Router();

/**
 * Test routes for Data Cleanup - No validation, for development only
 */

// Preview what would be deleted
router.get('/cleanup/preview', async (req, res) => {
  try {
    const result = await dataCleanupJob.preview();
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Run cleanup job
router.post('/cleanup/run', async (req, res) => {
  try {
    const result = await dataCleanupJob.run();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;
