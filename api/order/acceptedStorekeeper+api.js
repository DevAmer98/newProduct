/*
import { Pool } from 'pg';

// Create a connection pool instead of new client for each request
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

const withTimeout = (promise: Promise<any>, timeout: number) => {
  const timeoutPromise = new Promise<any>((_, reject) =>
    setTimeout(() => reject(new Error('Database query timed out')), timeout)
  );
  return Promise.race([promise, timeoutPromise]);
};

export async function GET(request: Request) {
  const client = await pool.connect();
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "10", 10);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const query = url.searchParams.get("query") || "";
    const status = url.searchParams.get("status") || "all";
    const offset = (page - 1) * limit;

    let filterCondition = "orders.storekeeperaccept = 'accepted'";
    const baseQueryParams = [limit, offset, `%${query}%`];

    if (status !== "all") {
      filterCondition += ` AND orders.status = $4`;
      baseQueryParams.push(status);  // Ensure status is included if not 'all'
    }

    const baseQuery = `
      SELECT 
        orders.*, 
        clients.client_name AS client_name,
        clients.phone_number AS client_phone,
        clients.company_name AS client_company,
        clients.branch_number AS client_branch,
        clients.tax_number AS client_tax,
        clients.latitude AS client_latitude,
        clients.longitude AS client_longitude,
        clients.street AS client_street,
        clients.city AS client_city,
        clients.region AS client_region,
        orders.status,
        orders.storekeeperaccept,
        orders.supervisorAccept,
        orders.actual_delivery_date,
        orders.total_price 
      FROM orders
      JOIN clients ON orders.client_id = clients.id
      WHERE (clients.client_name ILIKE $3 OR clients.company_name ILIKE $3)
      AND ${filterCondition}
      ORDER BY orders.delivery_date DESC
      LIMIT $1 OFFSET $2
    `;

    console.log("Executing SQL Query:", baseQuery);
    console.log("With Parameters:", baseQueryParams);

    const ordersResult = await client.query(baseQuery, baseQueryParams);
    const totalCount = ordersResult.rowCount;

    const hasMore = page * limit < totalCount;

    return new Response(
      JSON.stringify({
        orders: ordersResult.rows,
        hasMore,
        totalCount,
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error fetching orders:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Error fetching orders",
        details: process.env.NODE_ENV === "development" ? error.stack : undefined,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  } finally {
    client.release();
  }
}

*/

import express from 'express';
import pkg from 'pg'; // New
const { Pool } = pkg; // Destructure Pool

const router = express.Router();


// Create a connection pool instead of new client for each request
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

router.use(express.json());

const withTimeout = (promise, timeout) => {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Database query timed out')), timeout)
  );
  return Promise.race([promise, timeoutPromise]);
};

router.get('/orders/storekeeperaccept', async (req, res) => {
  const client = await pool.connect();
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const query = url.searchParams.get('query') || '';
    const status = url.searchParams.get('status') || 'all';
    const offset = (page - 1) * limit;

    let filterCondition = "orders.storekeeperaccept = 'accepted'";
    const baseQueryParams = [limit, offset, `%${query}%`];

    if (status !== 'all') {
      filterCondition += ` AND orders.status = $4`;
      baseQueryParams.push(status); // Ensure status is included if not 'all'
    }

    const baseQuery = `
      SELECT 
        orders.*, 
        clients.client_name AS client_name,
        clients.phone_number AS client_phone,
        clients.company_name AS client_company,
        clients.branch_number AS client_branch,
        clients.tax_number AS client_tax,
        clients.latitude AS client_latitude,
        clients.longitude AS client_longitude,
        clients.street AS client_street,
        clients.city AS client_city,
        clients.region AS client_region,
        orders.status,
        orders.storekeeperaccept,
        orders.supervisorAccept,
        orders.actual_delivery_date,
        orders.total_price 
      FROM orders
      JOIN clients ON orders.client_id = clients.id
      WHERE (clients.client_name ILIKE $3 OR clients.company_name ILIKE $3)
      AND ${filterCondition}
      ORDER BY orders.delivery_date DESC
      LIMIT $1 OFFSET $2
    `;

    console.log('Executing SQL Query:', baseQuery);
    console.log('With Parameters:', baseQueryParams);

    const ordersResult = await client.query(baseQuery, baseQueryParams);
    const totalCount = ordersResult.rowCount;

    const hasMore = page * limit < totalCount;

    res.status(200).json({
      orders: ordersResult.rows,
      hasMore,
      totalCount,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      error: error.message || 'Error fetching orders',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  } finally {
    client.release();
  }
});


export default router;
