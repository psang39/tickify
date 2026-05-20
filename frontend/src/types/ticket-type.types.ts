
export interface ITicketType extends Document {
    _id: string,
    name: string,
    price: number,
    total_quantity: number,
    sold_quantity: number,
    event_id: string,
    show_id: string,
    zone_id: string,
    sale_start: Date,
    sale_end: Date,
}