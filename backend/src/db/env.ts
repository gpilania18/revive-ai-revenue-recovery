export function getMongoConfig(): { uri: string; dbName: string } {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.DB_NAME || process.env.MONGODB_DB_NAME;

  if (!uri || !dbName) {
    throw new Error("MongoDB is not configured");
  }

  return { uri, dbName };
}