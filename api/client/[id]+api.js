/*import { Client } from 'pg';

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function testConnection() {
  try {
    await client.connect();
    const res = await client.query('SELECT 1 AS test');
    console.log('Database connection successful:', res.rows);
  } catch (error) {
    console.error('Database connection error:', error);
  } finally {
    await client.end();
  }
}

testConnection();

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.pathname.split('/').pop(); // Extract the `id` directly from the URL path

  console.log("Extracted client ID:", id); // Debugging line

  if (!id) {
    return new Response(
      JSON.stringify({ error: "Missing client ID" }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const clientQuery = `SELECT * FROM clients WHERE id = $1`;
    const clientResult = await client.query(clientQuery, [id]);

    console.log('SQL query result:', clientResult.rows);

    if (clientResult.rows.length === 0) {
      return new Response(
        JSON.stringify({ error: "Client not found", id }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(clientResult.rows[0]),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("Database error:", error);
    return new Response(
      JSON.stringify({ error: "Internal Server Error", details: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Update Client
export async function PUT(request: Request) {
  const url = new URL(request.url);
  const id = url.pathname.split('/').pop(); // Extract the `id` directly from the URL path
  const body = await request.json(); // Get the JSON body of the request

  if (!id) {
    return new Response(
      JSON.stringify({ error: "Missing client ID" }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const updateQuery = `
      UPDATE clients 
      SET 
        company_name = $1,
        client_name = $2,
        phone_number = $3,
        tax_number = $4,
        branch_number = $5,
        latitude = $6,
        longitude = $7,
        street = $8,
        city = $9,
        region = $10,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $11
    `;

    const values = [
      body.company_name,
      body.client_name,
      body.phone_number,
      body.tax_number,
      body.branch_number,
      body.latitude,
      body.longitude,
      body.street,
      body.city,
      body.region,
      id
    ];

    const updateResult = await client.query(updateQuery, values);

    if (updateResult.rowCount === 0) {
      return new Response(
        JSON.stringify({ error: "Client not found or no changes made" }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ message: "Client updated successfully" }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("Database error:", error);
    return new Response(
      JSON.stringify({ error: "Internal Server Error", details: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Delete Client
export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const id = url.pathname.split('/').pop(); // Extract the `id` directly from the URL path

  if (!id) {
    return new Response(
      JSON.stringify({ error: "Missing client ID" }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const deleteQuery = `DELETE FROM clients WHERE id = $1`;
    const deleteResult = await client.query(deleteQuery, [id]);

    if (deleteResult.rowCount === 0) {
      return new Response(
        JSON.stringify({ error: "Client not found" }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ message: "Client deleted successfully" }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("Database error:", error);
    return new Response(
      JSON.stringify({ error: "Internal Server Error", details: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
*/


import express from 'express';
import pkg from 'pg'; // Import the default export
const { Pool } = pkg; // Destructure Pool from the default export

const router = express.Router();

// Initialize PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Test database connection
async function testConnection() {
  try {
    const res = await pool.query('SELECT 1 AS test');
    console.log('Database connection successful:', res.rows);
  } catch (error) {
    console.error('Database connection error:', error);
  }
}

testConnection();

// GET /api/clients/:id
router.get('/clients/:id', async (req, res) => {
  const { id } = req.params;

  console.log('Extracted client ID:', id); // Debugging line

  if (!id) {
    return res.status(400).json({ error: 'Missing client ID' });
  }

  try {
    const clientQuery = 'SELECT * FROM clients WHERE id = $1';
    const clientResult = await pool.query(clientQuery, [id]);

    console.log('SQL query result:', clientResult.rows);

    if (clientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found', id });
    }

    return res.status(200).json(clientResult.rows[0]);
  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      details: error.message,
    });
  }
});

// PUT /api/clients/:id
router.put('/clients/:id', async (req, res) => {
  const { id } = req.params;
  const body = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Missing client ID' });
  }

  try {
    const updateQuery = `
      UPDATE clients 
      SET 
        company_name = $1,
        client_name = $2,
        phone_number = $3,
        tax_number = $4,
        branch_number = $5,
        latitude = $6,
        longitude = $7,
        street = $8,
        city = $9,
        region = $10,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $11
    `;

    const values = [
      body.company_name,
      body.client_name,
      body.phone_number,
      body.tax_number,
      body.branch_number,
      body.latitude,
      body.longitude,
      body.street,
      body.city,
      body.region,
      id,
    ];

    const updateResult = await pool.query(updateQuery, values);

    if (updateResult.rowCount === 0) {
      return res.status(404).json({ error: 'Client not found or no changes made' });
    }

    return res.status(200).json({ message: 'Client updated successfully' });
  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      details: error.message,
    });
  }
});

// DELETE /api/clients/:id
router.delete('/clients/:id', async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'Missing client ID' });
  }

  try {
    const deleteQuery = 'DELETE FROM clients WHERE id = $1';
    const deleteResult = await pool.query(deleteQuery, [id]);

    if (deleteResult.rowCount === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    return res.status(200).json({ message: 'Client deleted successfully' });
  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      details: error.message,
    });
  }
});

export default router;