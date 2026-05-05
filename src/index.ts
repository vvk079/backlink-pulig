import { createApp } from './app.js';
import { config } from './config.js';

const app = createApp();

app.listen(config.port, () => {
  console.log(`🚀 Backlink Exchange API running on http://localhost:${config.port}`);
  console.log(`   Environment: ${config.nodeEnv}`);
});