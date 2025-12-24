import mongoose from 'mongoose';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // eslint-disable-next-line no-var
  var _mongoosePromise: Promise<typeof mongoose> | undefined;
}

if (!global._mongoosePromise) {
  // initialized lazily in connectMongoose()
}

export async function connectMongoose() {
  if (!global._mongoosePromise) {
    const mongoUrl = process.env.MONGO_URL;
    if (!mongoUrl) {
      throw new Error('MONGO_URL environment variable is required');
    }
    global._mongoosePromise = mongoose
      .connect(mongoUrl, { dbName: process.env.MONGO_DB_NAME })
      .then(() => mongoose);
  }
  return global._mongoosePromise;
}

export default mongoose;
