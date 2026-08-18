import { Router } from 'express';
import { getPerformanceDiagnostics } from '../controllers/performance.controller';

const performanceRouter = Router();

// Local-baseline diagnostics only. The controller returns 404 unless explicitly enabled.
performanceRouter.get('/diagnostics', getPerformanceDiagnostics);

export default performanceRouter;
