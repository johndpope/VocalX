import { connectMongoose } from "@/lib/mongo";
import {
  ApiKeyModel,
  FileModel,
  ProcessedFileModel,
  ProcessingJobModel,
  SubscriptionModel,
  UserModel,
  UserUsageModel,
} from "@/models";

async function main() {
  if (!process.env.MONGO_URL) {
    throw new Error("MONGO_URL is required to initialize indexes");
  }

  await connectMongoose();

  // Ensure all indexes exist (unique, etc.)
  await Promise.all([
    UserModel.syncIndexes(),
    FileModel.syncIndexes(),
    ProcessingJobModel.syncIndexes(),
    ProcessedFileModel.syncIndexes(),
    UserUsageModel.syncIndexes(),
    SubscriptionModel.syncIndexes(),
    ApiKeyModel.syncIndexes(),
  ]);

  // eslint-disable-next-line no-console
  console.log("Webapp MongoDB indexes synced");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err?.stack || err);
    process.exit(1);
  });
