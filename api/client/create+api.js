/*import { neon } from "@neondatabase/serverless";

export async function POST(request: Request) {
  try {
    const sql = neon(`${process.env.DATABASE_URL}`);
    const { company_name, client_name, client_type, phone_number, tax_number, branch_number, location } = await request.json();

    // Validate required fields
    if (!company_name || !client_name || !client_type || !phone_number || !branch_number || !location || !location.latitude || !location.longitude) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
      });
    }

    // Enforce tax_number validation based on client_type
   // Ensure the `tax_number` is only required for certain client types
if (client_type !== 'One-time cash client' && !tax_number) {
  return new Response(JSON.stringify({ error: "Missing required field: tax_number" }), {
    status: 400,
  });
}

// Use null for `tax_number` if it's optional
const response = await sql`
  INSERT INTO clients (
    company_name, 
    client_name,
    client_type,
    phone_number, 
    tax_number,
    branch_number,
    latitude, 
    longitude,
    street,
    city,
    region
  ) 
  VALUES (
    ${company_name}, 
    ${client_name},
    ${client_type},
    ${phone_number},
    ${tax_number || null},  -- Allow null for optional tax_number
    ${branch_number},
    ${location.latitude},
    ${location.longitude},
    ${location.street || null},
    ${location.city || null},
    ${location.region || null}
  );
`;

    return new Response(JSON.stringify({ data: response }), {
      status: 201,
    });
  } catch (error) {
    console.error("Error creating clients:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
    });
  }
}



export async function GET(request: Request) {
  try {
    const sql = neon(`${process.env.DATABASE_URL}`);
    
    // Parse query parameters from the request URL
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '10', 10); // Default limit is 10
    const page = parseInt(url.searchParams.get('page') || '1', 10); // Default page is 1
    const searchQuery = url.searchParams.get('search') || ''; // Default to empty string for no search

    // Calculate the offset for pagination
    const offset = (page - 1) * limit;

    // Fetch filtered and paginated clients
    const clients = await sql`
      SELECT * FROM clients
      WHERE client_name ILIKE ${'%' + searchQuery + '%'}
      ORDER BY client_name
      LIMIT ${limit}
      OFFSET ${offset};
    `;

    // Fetch the total count of clients for pagination metadata
    const totalClients = await sql`
      SELECT COUNT(*) AS count FROM clients
      WHERE client_name ILIKE ${'%' + searchQuery + '%'};
    `;

    const total = parseInt(totalClients[0]?.count || '0', 10);
    const totalPages = Math.ceil(total / limit);

    return new Response(
      JSON.stringify({
        clients,
        total,
        page,
        totalPages,
        limit,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error fetching clients:', error);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error', details: error.message }),
      { status: 500 }
    );
  }
}

*/


import express from 'express';
import { neon } from '@neondatabase/serverless';

const router = express.Router();

// POST /api/clients
router.post('/clients', async (req, res) => {
  try {
    const sql = neon(`${process.env.DATABASE_URL}`);
    const {
      company_name,
      client_name,
      client_type,
      phone_number,
      tax_number,
      branch_number,
      location,
    } = req.body;

    // Validate required fields
    if (
      !company_name ||
      !client_name ||
      !client_type ||
      !phone_number ||
      !branch_number ||
      !location ||
      !location.latitude ||
      !location.longitude
    ) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Enforce tax_number validation based on client_type
    if (client_type !== 'One-time cash client' && !tax_number) {
      return res.status(400).json({ error: 'Missing required field: tax_number' });
    }

    // Use null for `tax_number` if it's optional
    const response = await sql`
      INSERT INTO clients (
        company_name, 
        client_name,
        client_type,
        phone_number, 
        tax_number,
        branch_number,
        latitude, 
        longitude,
        street,
        city,
        region
      ) 
      VALUES (
        ${company_name}, 
        ${client_name},
        ${client_type},
        ${phone_number},
        ${tax_number || null},  -- Allow null for optional tax_number
        ${branch_number},
        ${location.latitude},
        ${location.longitude},
        ${location.street || null},
        ${location.city || null},
        ${location.region || null}
      );
    `;

    return res.status(201).json({ data: response });
  } catch (error) {
    console.error('Error creating clients:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/clients
router.get('/clients', async (req, res) => {
  try {
    const sql = neon(`${process.env.DATABASE_URL}`);

    // Parse query parameters from the request URL
    const limit = parseInt(req.query.limit || '10', 10); // Default limit is 10
    const page = parseInt(req.query.page || '1', 10); // Default page is 1
    const searchQuery = req.query.search || ''; // Default to empty string for no search

    // Calculate the offset for pagination
    const offset = (page - 1) * limit;

    // Fetch filtered and paginated clients
    const clients = await sql`
      SELECT * FROM clients
      WHERE client_name ILIKE ${'%' + searchQuery + '%'}
      ORDER BY client_name
      LIMIT ${limit}
      OFFSET ${offset};
    `;

    // Fetch the total count of clients for pagination metadata
    const totalClients = await sql`
      SELECT COUNT(*) AS count FROM clients
      WHERE client_name ILIKE ${'%' + searchQuery + '%'};
    `;

    const total = parseInt(totalClients[0]?.count || '0', 10);
    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      clients,
      total,
      page,
      totalPages,
      limit,
    });
  } catch (error) {
    console.error('Error fetching clients:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      details: error.message,
    });
  }
});

export default router;
