


export interface IEvent extends Document {
    _id: string,
    name: string,
    description: string,
    genre: string,
    artists: string[],
    poster_url: string,
    banner_url: string,
    sale_start: string,
    sale_end: string,
    start_date: string,
    end_date: string,
    status: "active" | "inactive" | "draft",
    organizer_id: string,
    attendees: string,
    staff: string,
    venue_id: string,
    created_at: string,
    updated_at: string
}