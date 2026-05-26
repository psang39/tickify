import { Request, Response } from "express";
import TicketType from "../models/ticket-type.model";
import Show from "../models/show.model";
import redisClient from "../utils/redisClient";
import { hasBlockingOrdersForShow, rebuildShowRedisCache } from "../services/seatmap-cache.service";

const normalizeOptionalDate = (value: unknown) => {
    if (value === undefined) return undefined;
    if (value === null || value === "") return null;
    return new Date(value as string);
};

const clearTicketTypeCache = async (showId: string) => {
    await redisClient.del(`show:${showId}:ticket_types`);
};

export const getTicketTypesByShow = async (req: Request, res: Response) => {
    try {
        const { show_id } = req.params;

        const ticketTypesCacheKey = `show:${show_id}:ticket_types`;
        const cachedTicketTypes = await redisClient.get(ticketTypesCacheKey);
        if (cachedTicketTypes) {
            return res.status(200).json(JSON.parse(cachedTicketTypes));
        }

        const ticketTypes = await TicketType.find({ show_id }).sort({ price: 1, name: 1 }).lean();

        await redisClient.set(ticketTypesCacheKey, JSON.stringify(ticketTypes), {
            EX: 3600
        });

        return res.status(200).json(ticketTypes);
    } catch (error) {
        console.error("Error fetching ticket types:", error);
        return res.status(500).json({ message: "Error fetching ticket types", error });
    }
};

export const getTicketTypesByEvent = async (req: Request, res: Response) => {
    try {
        const { event_id, show_id } = req.params;
        const filter: any = { event_id };
        if (show_id) filter.show_id = show_id;

        const ticketTypes = await TicketType.find(filter).sort({ price: 1, name: 1 }).lean();

        return res.status(200).json(ticketTypes);
    } catch (error) {
        return res.status(500).json({ message: "Error fetching ticket types", error });
    }
};

export const getTicketTypeById = async (req: Request, res: Response) => {
    try {
        const { ticketTypeId } = req.params;
        const ticketType = await TicketType.findById(ticketTypeId).lean();

        if (!ticketType) {
            return res.status(404).json({ message: "Ticket type not found" });
        }

        return res.status(200).json(ticketType);
    } catch (error) {
        return res.status(500).json({ message: "Error fetching ticket type", error });
    }
};

/**
 * Không tạo ticket-type thủ công ở controller này.
 * Ticket-type được sinh/đồng bộ khi create/update show và parse SVG trong show.controller/seatmap service.
 * Endpoint này chỉ dùng để chỉnh thông tin bán vé của ticket-type đã tồn tại:
 * name, price, target_tier, total_quantity, is_limited_promo, sale_start, sale_end.
 */
export const updateTicketType = async (req: Request, res: Response) => {
    try {
        const show_id = req.params.show_id as string;
        const ticketTypeId = req.params.ticketTypeId as String;
        const organizer_id = req.user!.id;

        const show = await Show.findOne({ _id: show_id, organizer_id });
        if (!show) {
            return res.status(403).json({ message: "Show không tồn tại hoặc bạn không có quyền chỉnh show này." });
        }

        if (show.status === "published" || show.status === "cancelled") {
            return res.status(400).json({
                message: "Không thể chỉnh loại vé khi show đang mở bán hoặc đã hủy. Hãy tạm dừng bán trước khi thay đổi cấu hình."
            });
        }

        const hasBlockingOrders = await hasBlockingOrdersForShow(show_id);
        if (hasBlockingOrders) {
            return res.status(400).json({
                message: "Show đã có đơn pending/confirmed nên không thể chỉnh loại vé để tránh sai lệch giá và tồn kho."
            });
        }

        const ticketType = await TicketType.findOne({ _id: ticketTypeId, show_id }) as any;
        if (!ticketType) {
            return res.status(404).json({ message: "Ticket type không tồn tại trong show này." });
        }

        const {
            name,
            price,
            target_tier,
            total_quantity,
            is_limited_promo,
            sale_start,
            sale_end
        } = req.body;

        if (name !== undefined) {
            if (!String(name).trim()) {
                return res.status(400).json({ message: "Tên loại vé không được để trống." });
            }
            ticketType.name = String(name).trim();
        }

        if (price !== undefined) {
            const numericPrice = Number(price);
            if (!Number.isFinite(numericPrice) || numericPrice < 0) {
                return res.status(400).json({ message: "Giá vé không hợp lệ." });
            }
            ticketType.price = numericPrice;
        }

        if (target_tier !== undefined) {
            ticketType.target_tier = target_tier === "" || target_tier === null ? undefined : String(target_tier).trim();
        }

        if (total_quantity !== undefined) {
            if (total_quantity === "" || total_quantity === null) {
                ticketType.total_quantity = null;
            } else {
                const numericQuantity = Number(total_quantity);
                if (!Number.isInteger(numericQuantity) || numericQuantity < 0) {
                    return res.status(400).json({ message: "Số lượng giới hạn phải là số nguyên không âm." });
                }
                if ((ticketType.sold_quantity || 0) > numericQuantity) {
                    return res.status(400).json({ message: "Số lượng giới hạn không thể nhỏ hơn số vé đã bán." });
                }
                ticketType.total_quantity = numericQuantity;
            }
        }

        if (is_limited_promo !== undefined) {
            ticketType.is_limited_promo = Boolean(is_limited_promo);
        }

        const normalizedSaleStart = normalizeOptionalDate(sale_start);
        const normalizedSaleEnd = normalizeOptionalDate(sale_end);

        if (normalizedSaleStart !== undefined) ticketType.sale_start = normalizedSaleStart as any;
        if (normalizedSaleEnd !== undefined) ticketType.sale_end = normalizedSaleEnd as any;

        const finalSaleStart = ticketType.sale_start ? new Date(ticketType.sale_start) : null;
        const finalSaleEnd = ticketType.sale_end ? new Date(ticketType.sale_end) : null;
        if (finalSaleStart && finalSaleEnd && finalSaleStart > finalSaleEnd) {
            return res.status(400).json({ message: "Thời điểm đóng bán riêng phải sau thời điểm mở bán riêng." });
        }

        await ticketType.save();

        await clearTicketTypeCache(show_id);
        await rebuildShowRedisCache(show_id);

        return res.status(200).json({
            message: "Cập nhật loại vé thành công.",
            data: ticketType
        });
    } catch (error) {
        console.error("Error updating ticket type:", error);
        return res.status(500).json({ message: "Error updating ticket type", error });
    }
};

/**
 * Không nên xóa ticket-type thủ công vì Zone/Seatmap có thể đang tham chiếu ticket_type_id.
 * Muốn thay đổi cấu trúc loại vé/zone, hãy upload lại SVG hoặc regenerate seatmap qua show.controller.
 */
export const deleteTicketType = async (_req: Request, res: Response) => {
    return res.status(405).json({
        message: "Ticket-type được sinh từ SVG/show controller nên không hỗ trợ xóa thủ công. Hãy upload lại SVG hoặc regenerate seatmap nếu cần thay đổi cấu trúc loại vé."
    });
};

export const initializeTicketInventory = async (req: Request, res: Response) => {
    try {
        const { event_id, zone_id, show_id } = req.body;
        const totalSeats = parseInt(req.body.totalSeats);

        await TicketType.findOneAndUpdate(
            { event_id, zone_id, show_id },
            { total_seats: totalSeats },
            { upsert: true, new: true }
        );

        const inventoryKey = `show:${show_id}:zone:${zone_id}:available`;
        await redisClient.set(inventoryKey, totalSeats);

        return res.status(200).json({
            message: "Đã nạp kho vé lên Redis thành công! Sẵn sàng mở bán.",
            zone: zone_id,
            available: totalSeats
        });
    } catch (error) {
        console.error("Lỗi khi nạp kho vé:", error);
        return res.status(500).json({ error: "Lỗi hệ thống" });
    }
};
