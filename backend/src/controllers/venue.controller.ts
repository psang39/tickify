import Venue from '../models/venue.model';
import { Request, Response } from 'express';

export const createVenue = async (req: Request, res: Response) => {
    try {
        const { name, address, city, capacity, latitude, longtitude } = req.body;
        if (!name || !address || !city || !capacity) {
            return res.status(400).json({ message: "Name, address, city, and capacity are required" });
        }
        const venue = new Venue({ name, address, city, capacity, latitude, longtitude });
        await venue.save();
        res.status(201).json(venue);
    }
    catch (error) {
        res.status(500).json({ message: "Error creating venue", error });
    }
};

export const getVenues = async (req: Request, res: Response) => {
    try {
        const venues = await Venue.find();
        res.status(200).json(venues);
    } catch (error) {
        res.status(500).json({ message: "Error fetching venues", error });
    }
};