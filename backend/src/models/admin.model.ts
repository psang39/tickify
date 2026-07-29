import User from './user.model';
import Mongoose from 'mongoose';

const AdminSchema = new Mongoose.Schema({});

export const Admin = (
    User.discriminators?.Admin
    ?? User.discriminator('Admin', AdminSchema)
);