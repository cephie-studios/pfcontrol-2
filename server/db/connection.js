// db/connection.js
import pg from 'pg';
import dotenv from 'dotenv';

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
        console.log('\x1b[34m%s\x1b[0m', 'PFControl DB connected');
    } catch (err) {
        console.error('Error connecting to PFControl DB:', err);
    }
})();

export default pool;