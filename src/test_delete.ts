import { pool } from './db.js';

async function test() {
    try {
        const userId = '7a1e333b-1a03-49ac-b310-704fd7f61304'; // From my check scripts
        // Insert dummy github
        const insert = await pool.query(
            "INSERT INTO integrations (user_id, service, name) VALUES ($1, 'github', 'Test GitHub') RETURNING id",
            [userId]
        );
        const id = insert.rows[0].id;
        console.log(`Inserted dummy GitHub with ID: ${id}`);

        // Try to delete via pool query (what the route does)
        const del = await pool.query('DELETE FROM integrations WHERE id = $1 RETURNING *', [id]);
        console.log(`Deleted result rowCount: ${del.rowCount}`);
        if (del.rowCount === 1) {
            console.log('SUCCESS: Internal deletion logic works.');
        } else {
            console.log('FAILURE: Internal deletion logic failed.');
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

test();
