import { app } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./logger.js";

app.listen(env.PORT, () => {
  logger.info(`auth-service démarré sur http://localhost:${env.PORT}`);
});
