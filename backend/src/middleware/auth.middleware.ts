import User from "../models/user.model";
import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { SECRET_ACCESS_TOKEN, JWT_SECRET } from "../config/index";

// Helper để xác thực JWT dạng Promise cho sạch code
const verifyJwt = (token: string, secret: string) => {
    return new Promise((resolve, reject) => {
        jwt.verify(token, secret, (err, decoded) => {
            if (err) reject(err);
            resolve(decoded);
        });
    });
};

const Verify = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const cookieToken = req.cookies?.SessionID;
        const authHeader = req.headers.authorization;
        const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;
        const token = cookieToken || bearerToken;

        if (!token) {
            return res.status(401).json({ message: "Không tìm thấy quyền truy cập hợp lệ!" });
        }

        const decoded: any = await verifyJwt(token, SECRET_ACCESS_TOKEN as string);

        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(404).json({ error: "User not found." });
        }

        (req as any).user = {
            ...user.toObject(),
            id: user._id.toString()
        };

        next();
    } catch (error: any) {
        console.error("Lỗi Verify Token:", error.message);
        return res.status(401).json({ error: "Invalid or expired token." });
    }
};

const verifyRoles = (allowedRoles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = (req as any).user;
        if (!user || !allowedRoles.includes(user.role as string)) {
            return res.status(403).json({ error: "You don't have permission to perform this action" });
        }
        next();
    };
};

const verifyCheckoutToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const token = req.headers["x-checkout-token"] as string;

        if (!token) {
            return res.status(403).json({ error: "Access denied. Bạn chưa tham gia phòng chờ." });
        }

        const decoded: any = await verifyJwt(token, JWT_SECRET as string);

        if (decoded.purpose !== 'checkout') {
            return res.status(403).json({ error: "Token không hợp lệ cho hành động này." });
        }

        if (req.params.show_id && decoded.show_id !== req.params.show_id) {
            return res.status(403).json({ error: "Phiếu qua cửa này không dành cho buổi diễn bạn đang mua." });
        }

        (req as any).checkoutData = decoded;

        next();
    } catch (error: any) {
        console.error("Lỗi Checkout Token:", error.message);
        return res.status(401).json({ error: "Phiếu qua cửa đã hết hạn hoặc không hợp lệ. Vui lòng xếp hàng lại." });
    }
};

export { Verify, verifyRoles, verifyCheckoutToken };