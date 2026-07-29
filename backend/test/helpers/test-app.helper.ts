import '../setup-env';

export const createTestApp = async () => {
    const [{ default: express }, { default: orderRouter }, { default: webhookRouter }, { default: staffRouter }] = await Promise.all([
        import('express'),
        import('../../src/routes/order.routes'),
        import('../../src/routes/webhook.routes'),
        import('../../src/routes/staff.routes'),
    ]);

    const app = express();
    app.use(express.json());
    app.use('/api/v1/orders', orderRouter);
    app.use('/api/v1/webhooks', webhookRouter);
    app.use('/api/v1/staff', staffRouter);
    return app;
};
