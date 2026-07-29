import mongoose from "mongoose";

const BlacklistSchema = new mongoose.Schema({
    token: { type: String, required: true }
});
const Blacklist = (mongoose.models.Blacklist as mongoose.Model<any> | undefined) ?? mongoose.model('Blacklist', BlacklistSchema);
export default Blacklist;