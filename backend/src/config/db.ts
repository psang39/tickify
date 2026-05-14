import mongoose from "mongoose";
import {URI} from "./index"


const connectDB = async () => {
    try {
        await mongoose.connect(URI as string);
        console.log("MongoDB connected");
    }
    catch(error) {
console.error(error);
process.exit(1);
    }
};
export default connectDB;