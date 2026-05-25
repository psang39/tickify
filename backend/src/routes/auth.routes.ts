import Express from 'express';
import { check } from 'express-validator';
import { Validate } from '../middleware/validation.middleware';
import { login, register, logout } from '../controllers/auth.controller';

const router = Express.Router();
router.post('/register', [
    check('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters long'),
    check('first_name').not().isEmpty().withMessage('First name is required'),
    check('last_name').not().isEmpty().withMessage('Last name is required'),
    check('email').isEmail().withMessage('Please provide a valid email'),
    check('phone').isMobilePhone('any').withMessage('Please provide a valid phone number'),
    check('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    check('role').isIn(['admin', 'organizer', 'attendee']).withMessage('Role must be either admin, organizer, or attendee')
], Validate, register);
router.post('/login', [
    check('email').isEmail().withMessage('Please provide a valid email').toLowerCase().trim(),
    check('password').not().isEmpty().withMessage('Password is required')
], Validate, login);
router.get('/logout', logout);
router.post('/logout', logout);

const authRoutes = router;
export default authRoutes;