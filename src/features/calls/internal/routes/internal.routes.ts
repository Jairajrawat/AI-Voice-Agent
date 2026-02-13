import { Router } from 'express';

import { requireInternalApiSecret } from '../../../../middleware/internal-auth.middleware';
import { validateRequest } from '../../../../middleware/validation.middleware';
import { InternalCallController } from '../controllers/internal.controller';
import {
  completeCallSchema,
  saveExtractionSchema,
  saveTranscriptSchema,
  transferCallSchema,
} from '../schemas/internal.schema';

const router = Router({ mergeParams: true });
const internalController = new InternalCallController();

router.use(requireInternalApiSecret);

// Internal routes - called by Vocode service
// POST /api/internal/calls/:callId/transcript
router.post(
  '/transcript',
  validateRequest(saveTranscriptSchema),
  internalController.saveTranscript,
);

// POST /api/internal/calls/:callId/extraction
router.post(
  '/extraction',
  validateRequest(saveExtractionSchema),
  internalController.saveExtraction,
);

// POST /api/internal/calls/:callId/complete
router.post('/complete', validateRequest(completeCallSchema), internalController.completeCall);

// POST /api/internal/calls/:callId/transfer
router.post('/transfer', validateRequest(transferCallSchema), internalController.transferCall);

export default router;
