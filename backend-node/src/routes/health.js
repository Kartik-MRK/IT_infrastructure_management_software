import { Router } from 'express';

const router = Router();

export const healthCheckHandler = (_req, res) => {
  return res.status(200).json({
    status: 'healthy',
    message: 'API is running',
    service: 'ITIMS Backend',
  });
};

router.get('/health', healthCheckHandler);
router.get('/api/health', healthCheckHandler);

export default router;
