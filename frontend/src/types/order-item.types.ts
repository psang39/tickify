
export interface IOrderItem extends Document {
        order_id: string,
        seat_id: string,
        price: number,
        quantity: number,
        ticket_type: string
}