process.env.NODE_ENV = 'test';
process.env.URI = process.env.TEST_MONGODB_URI
    || 'mongodb://127.0.0.1:27018/tickify_test?replicaSet=rs0&retryWrites=true&w=majority';
process.env.REDIS_HOST = process.env.TEST_REDIS_HOST || '127.0.0.1';
process.env.REDIS_PORT = process.env.TEST_REDIS_PORT || '6380';
process.env.REDIS_URL = process.env.TEST_REDIS_URL || 'redis://127.0.0.1:6380/1';
process.env.SECRET_ACCESS_TOKEN = process.env.SECRET_ACCESS_TOKEN || 'tickify-test-access-secret';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'tickify-test-checkout-secret';
process.env.MOCK_PAYMENT_SECRET = process.env.MOCK_PAYMENT_SECRET || 'tickify-test-payment-secret';
process.env.ENCRYPTION_MASTER_KEY = process.env.ENCRYPTION_MASTER_KEY
    || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.RSA_PRIVATE_KEY = process.env.RSA_PRIVATE_KEY || 'test-only-placeholder';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
process.env.BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
process.env.PORT = process.env.PORT || '3000';
