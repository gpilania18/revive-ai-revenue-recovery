import dns from "node:dns";
import { MongoClient } from "mongodb";

import { getMongoConfig } from "./env";
import { publicMongoErrorMessage } from "./safe-error";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

let client: MongoClient | null = null;
let connectPromise: Promise<MongoClient> | null = null;

function getClient(): MongoClient {

  const { uri } = getMongoConfig();

  if (!client) {
    client = new MongoClient(uri);
  }

  return client;
}

export async function getMongoClient(): Promise<MongoClient> {
  const mongoClient = getClient();

  if (!connectPromise) {
    connectPromise = mongoClient.connect().catch((error: unknown) => {
      connectPromise = null;
     
      
      throw new Error(publicMongoErrorMessage(error));
    });
  }

  return connectPromise;
}

export async function verifyMongoConnection(): Promise<void> {
  try {
    const { dbName } = getMongoConfig();
    const mongoClient = await getMongoClient();
    await mongoClient.db(dbName).command({ ping: 1 });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "MongoDB is not configured") {
      throw error;
    }
    throw new Error(publicMongoErrorMessage(error));
  }
}

export async function closeMongoClient(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    connectPromise = null;
  }
}
