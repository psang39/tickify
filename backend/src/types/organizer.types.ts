import { IUser } from "./user.types";

export interface IOrganizer extends IUser {
    company_name: string,
    tax_id: string,
    is_verified: boolean
}
