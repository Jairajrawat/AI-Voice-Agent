import { Router } from 'express';

import { validateRequest } from '../../../middleware/validation.middleware';
import { CallController } from '../controllers/call.controller';
import { listCallsQuerySchema, updateCallSchema } from '../schemas/call.schema';

const router = Router({ mergeParams: true });
const callController = new CallController();

// Routes for /v1/tenants/:tenantId/calls
router.get('/', callController.getAll);
router.get('/:callId', callController.getById);
router.put('/:callId', validateRequest(updateCallSchema), callController.update);
router.delete('/:callId', callController.delete);
router.post('/outbound', callController.triggerOutbound);

export default router;
