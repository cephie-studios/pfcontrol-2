import pg from 'pg';
import dotenv from 'dotenv';
import chalk from 'chalk';

const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
dotenv.config({ path: envFile });

const { Pool } = pg;

const flightsPool = new Pool({
  connectionString: process.env.POSTGRES_DB_URL_FLIGHTS,
  ssl: {
    rejectUnauthorized: false,
    require: true
  }
});

(async () => {
  try {
    await flightsPool.query('SELECT 1');
    console.log(chalk.blue('Flights DB connected'));
  } catch (err) {
    console.error('Error connecting to Flights DB:', err);
  }
})();

export default flightsPool;