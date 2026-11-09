const app = require("./app");
const connectDatabase = require("./config/db");
const bootstrapAdmin = require("./utils/bootstrapAdmin");
const { seedDemoDoctors } = require("./utils/seedDemoDoctors");
const port = process.env.PORT || 5000;

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function connectWithRetry() {
  if (!process.env.MONGODB_URI) {
    console.error("MongoDB is not configured. Add MONGODB_URI to backend/.env.");
    console.error("The API is running, but database routes return 503 until MongoDB connects.");
    return;
  }

  let retryDelay = 1000;
  while (true) {
    try {
      await connectDatabase();
      const demoDoctorsAdded = await seedDemoDoctors();
      if (demoDoctorsAdded) console.log(`Added ${demoDoctorsAdded} prototype doctors to the directory`);
      await bootstrapAdmin().catch((error) => {
        console.error(`Unable to create the initial administrator account: ${error.message}`);
      });
      return;
    } catch (error) {
      console.error(`MongoDB connection failed: ${error.message}`);
      console.error(`Retrying MongoDB connection in ${Math.round(retryDelay / 1000)} second(s).`);
      await wait(retryDelay);
      retryDelay = Math.min(retryDelay * 2, 30000);
    }
  }
}

const server = app.listen(port, () => {
  console.log(`MediCore dashboard: http://localhost:${port}`);
  connectWithRetry();
});

server.on("error", (error) => {
  console.error(`Unable to start MediCore server: ${error.message}`);
  process.exitCode = 1;
});
