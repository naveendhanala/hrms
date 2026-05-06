import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { ensureInit } from './db';
import app from './app';

const PORT = process.env.PORT ?? 4000;

ensureInit()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`HRMS server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialise database:', err);
    process.exit(1);
  });
