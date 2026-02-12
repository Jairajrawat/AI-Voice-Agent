import { Router } from 'express';

import { validateRequest } from '../../../middleware/validation.middleware';
import { CallerController } from '../controllers/caller.controller';
import { updateCallerSchema } from '../schemas/caller.schema';

const router = Router({ mergeParams: true });
const callerController = new CallerController();

// Routes for /v1/tenants/:tenantId/callers
router.get('/', callerController.getAll);
router.get('/:callerId', callerController.getById);
router.put('/:callerId', validateRequest(updateCallerSchema), callerController.update);
router.post('/:callerId/save', callerController.saveCaller);
router.post('/:callerId/unsave', callerController.unsaveCaller);
router.delete('/:callerId', callerController.delete);

export default router;
