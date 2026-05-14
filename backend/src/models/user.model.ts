import Mongoose, { Schema, Document } from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { IUser } from '../types/user.types';
import { SECRET_ACCESS_TOKEN } from '../config';

const UserSchema = new Mongoose.Schema<IUser>({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    first_name: { type: String, required: true },
    last_name: { type: String, required: true },
    phone: { type: String, required: true },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
},
    {
        discriminatorKey: 'role',
    })

UserSchema.methods.generateAccessJWT = function () {
    const payload = {
        id: this._id,
        role: this.role
    };
    return jwt.sign(payload, SECRET_ACCESS_TOKEN as string, { expiresIn: '1h' });
}


UserSchema.pre("save", async function () {
    // const user = this;

    if (!this.isModified("password")) return;
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password as string, salt);
});

const User = Mongoose.model('User', UserSchema);

export default User;
