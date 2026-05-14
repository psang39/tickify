import {validationResult} from 'express-validator';

export const Validate = (req: any, res: any, next: any) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        const error: any = {};
        errors.array().forEach((err: any) => {
            error[err.param] = err.msg;
        });

        return res.status(422).json({ error });
    }
    next();
};