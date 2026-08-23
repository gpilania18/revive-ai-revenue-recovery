import { app } from "./app";
import { verifyMongoConnection } from "./db/mongo";


const port = Number(process.env.PORT) || 4000;

app.listen(port, () => {
  console.log(`Revive AI API listening on port ${port}`);
});

void verifyMongoConnection()
  .then(() => {
    console.log("MongoDB connection successful");
  })
  .catch(() => {
    console.error("MongoDB connection failed");
  });
