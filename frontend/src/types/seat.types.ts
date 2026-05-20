
export interface ISeat extends Document {
    id: string,
    _id: string,
    seat_number: string,
    x: number,
    y: number,
    zone_id: string,
    event_id: string,
    show_id: string,
    status: string | number,
    row: string,
    col_index: number,
    tier: string,
    price: number,
    ticket_type_id: string
}