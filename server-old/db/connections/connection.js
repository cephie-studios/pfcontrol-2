import pg from 'pg';
import dotenv from 'dotenv';
import chalk from 'chalk';

const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
dotenv.config({ path: envFile });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_DB_URL,
  ssl: {
    rejectUnauthorized: false,
    require: true
  }
});

(async () => {
  try {
    await pool.query('SELECT 1');
    console.log(chalk.blue('PFControl DB connected'));
  } catch (err) {
    console.error('Error connecting to PFControl DB:', err);
  }
})();

export default pool;