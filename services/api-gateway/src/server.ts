import { app } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./logger.js";

app.listen(env.PORT, () => {
  logger.info(`api-gateway démarré sur http://localhost:${env.PORT}`);
});
