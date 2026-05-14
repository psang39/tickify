import User from './user.model';
import Mongoose, { Schema } from 'mongoose';

export const Admin = User.discriminator('Admin', new Mongoose.Schema({
}));