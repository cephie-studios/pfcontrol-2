import pg from 'pg';
import dotenv from 'dotenv';
import chalk from 'chalk';

const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
dotenv.config({ path: envFile });

const { Pool } = pg;

const chatsPool = new Pool({
  connectionString: process.env.POSTGRES_DB_URL_CHATS,
  ssl: {
    rejectUnauthorized: false,
    require: true
  }
});

(async () => {
  try {
    await chatsPool.query('SELECT 1');
    console.log(chalk.blue('Chats DB connected'));
  } catch (err) {
    console.error('Error connecting to Chats DB:', err);
  }
})();

export default chatsPool;