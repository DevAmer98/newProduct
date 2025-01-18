/*import { Pool } from 'pg';

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


    

  


export async function POST(request: Request) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN'); // Start transaction
    const body = await request.json();
    const {
      client_id, username, delivery_date, delivery_type, products,
      notes, status = "not Delivered",  supervisoraccept = 'pending',
      storekeeperaccept = 'pending' // Default to 'pending' unless specified
    } = body;

    if (!client_id || !delivery_date || !delivery_type || !products || products.length === 0) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let formattedDate = delivery_date;
    if (typeof delivery_date === 'string') {
      const date = new Date(delivery_date);
      formattedDate = date.toISOString().slice(0, 19).replace('T', ' ');
    }

    // Execute the order insertion query and wait for the result
    const orderPromise = client.query(
      `INSERT INTO orders (client_id, delivery_date, delivery_type, notes, status, storekeeperaccept, supervisoraccept, actual_delivery_date, total_price)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [client_id, formattedDate, delivery_type, notes || null, status, storekeeperaccept,supervisoraccept,  null, 0]
    );

    const orderResult = await withTimeout(orderPromise, 10000); 
    const orderId = orderResult.rows[0].id;

    let totalPrice = 0;

    for (const product of products) {
      const { section, type, description, quantity, price } = product;

      if (!section || !type || !quantity || !price) {
        await client.query('ROLLBACK');
        return new Response(JSON.stringify({ error: "Missing product details or price" }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Convert price to a number to ensure correct addition
      const numericPrice = parseFloat(price);

      if (isNaN(numericPrice)) {
        await client.query('ROLLBACK');
        return new Response(JSON.stringify({ error: "Invalid price format" }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      totalPrice += numericPrice; // Correct numeric addition

      // Insert into order_products
      await client.query(
        `INSERT INTO order_products (order_id, section, type, description, quantity, price) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [orderId, section, type, description, quantity, numericPrice]
      );
    }

    // Update the total price in the orders table
    await client.query(
      `UPDATE orders SET total_price = $1 WHERE id = $2`,
      [totalPrice, orderId]
    );

    await client.query('COMMIT');

    return new Response(JSON.stringify({ orderId, status: 'success', totalPrice }), { 
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating order:', error);
    return new Response(JSON.stringify({ error: error.message || "Error creating order" }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  } finally {
    client.release();
  }
}



 
export async function GET(request: Request) {
  const client = await pool.connect();
  try {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "10", 10), 50);
    const page = Math.max(parseInt(url.searchParams.get("page") || "1", 10), 1);
    const query = url.searchParams.get("query") || "";
    const status = url.searchParams.get("status") || "all";
    const offset = (page - 1) * limit;

    let filterCondition = "TRUE";
    const baseQueryParams = [limit, offset, `%${query}%`];

    if (status !== "all") {
      filterCondition = `(orders.status = $4 OR orders.supervisoraccept = $4)`;
      baseQueryParams.push(status);  // Ensure you have this status variable available and it’s not undefined.
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
        clients.region AS client_region
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
    if (!ordersResult) {
      console.error("No result from the query.");
      throw new Error("No result from the query.");
    }

    const orders = ordersResult.rows;
    const totalCount = orders.length;

    return new Response(
      JSON.stringify({
        orders,
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

/*
import express from 'express';
import pkg from 'pg'; // Import the default export
const { Pool } = pkg; // Destructure Pool from the default export

const router = express.Router();

// Create a connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});


router.use(express.json()); // Middleware to parse JSON bodies

const withTimeout = (promise, timeout) => {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Database query timed out')), timeout)
  );
  return Promise.race([promise, timeoutPromise]);
};

// POST endpoint to create an order
router.post('/orders', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN'); // Start transaction
    const {
      client_id,
      username,
      delivery_date,
      delivery_type,
      products,
      notes,
      status = 'not Delivered',
      supervisoraccept = 'pending',
      storekeeperaccept = 'pending', // Default to 'pending' unless specified
    } = req.body;

    if (!client_id || !delivery_date || !delivery_type || !products || products.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    let formattedDate = delivery_date;
    if (typeof delivery_date === 'string') {
      const date = new Date(delivery_date);
      formattedDate = date.toISOString().slice(0, 19).replace('T', ' ');
    }

    // Execute the order insertion query and wait for the result
    const orderPromise = client.query(
      `INSERT INTO orders (client_id, delivery_date, delivery_type, notes, status, storekeeperaccept, supervisoraccept, actual_delivery_date, total_price)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [
        client_id,
        formattedDate,
        delivery_type,
        notes || null,
        status,
        storekeeperaccept,
        supervisoraccept,
        null,
        0,
      ]
    );

    const orderResult = await withTimeout(orderPromise, 10000);
    const orderId = orderResult.rows[0].id;

    let totalPrice = 0;

    for (const product of products) {
      const { section, type, description, quantity, price } = product;

      if (!section || !type || !quantity || !price) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Missing product details or price' });
      }

      // Convert price to a number to ensure correct addition
      const numericPrice = parseFloat(price);

      if (isNaN(numericPrice)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Invalid price format' });
      }

      totalPrice += numericPrice; // Correct numeric addition

      // Insert into order_products
      await client.query(
        `INSERT INTO order_products (order_id, section, type, description, quantity, price) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [orderId, section, type, description, quantity, numericPrice]
      );
    }

    // Update the total price in the orders table
    await client.query(`UPDATE orders SET total_price = $1 WHERE id = $2`, [totalPrice, orderId]);

    await client.query('COMMIT');

    return res.status(201).json({ orderId, status: 'success', totalPrice });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating order:', error);
    return res.status(500).json({ error: error.message || 'Error creating order' });
  } finally {
    client.release();
  }
});

// GET endpoint to fetch orders
router.get('/orders', async (req, res) => {
  const client = await pool.connect();
  try {
    const limit = Math.min(parseInt(req.query.limit || '10', 10), 50);
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const query = req.query.query || '';
    const status = req.query.status || 'all';
    const offset = (page - 1) * limit;

    let filterCondition = 'TRUE';
    const baseQueryParams = [limit, offset, `%${query}%`];

    if (status !== 'all') {
      filterCondition = `(orders.status = $4 OR orders.supervisoraccept = $4)`;
      baseQueryParams.push(status); // Ensure you have this status variable available and it’s not undefined.
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
        clients.region AS client_region
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
    if (!ordersResult) {
      console.error('No result from the query.');
      throw new Error('No result from the query.');
    }

    const orders = ordersResult.rows;
    const totalCount = orders.length;

    return res.status(200).json({
      orders,
      totalCount,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return res.status(500).json({
      error: error.message || 'Error fetching orders',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  } finally {
    client.release();
  }
});


export default router;
*/

import express from 'express';
import pkg from 'pg';
const { Pool } = pkg;

const router = express.Router();

// Create a connection pool
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

const executeWithRetry = async (fn, retries = 3, delay = 1000) => {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return executeWithRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
};

// POST endpoint to create an order
router.post('/orders', async (req, res) => {
  const client = await pool.connect();
  try {
    await executeWithRetry(async () => {
      await client.query('BEGIN');
      const {
        client_id,
        username,
        delivery_date,
        delivery_type,
        products,
        notes,
        status = 'not Delivered',
        supervisoraccept = 'pending',
        storekeeperaccept = 'pending',
      } = req.body;

      if (!client_id || !delivery_date || !delivery_type || !products || products.length === 0) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      let formattedDate = delivery_date;
      if (typeof delivery_date === 'string') {
        const date = new Date(delivery_date);
        formattedDate = date.toISOString().slice(0, 19).replace('T', ' ');
      }

      const orderPromise = client.query(
        `INSERT INTO orders (client_id, delivery_date, delivery_type, notes, status, storekeeperaccept, supervisoraccept, actual_delivery_date, total_price)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [
          client_id,
          formattedDate,
          delivery_type,
          notes || null,
          status,
          storekeeperaccept,
          supervisoraccept,
          null,
          0,
        ]
      );

      const orderResult = await withTimeout(orderPromise, 10000);
      const orderId = orderResult.rows[0].id;

      let totalPrice = 0;

      for (const product of products) {
        const { section, type, description, quantity, price } = product;

        if (!section || !type || !quantity || !price) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Missing product details or price' });
        }

        const numericPrice = parseFloat(price);

        if (isNaN(numericPrice)) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Invalid price format' });
        }

        totalPrice += numericPrice;

        await client.query(
          `INSERT INTO order_products (order_id, section, type, description, quantity, price) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [orderId, section, type, description, quantity, numericPrice]
        );
      }

      await client.query(`UPDATE orders SET total_price = $1 WHERE id = $2`, [totalPrice, orderId]);
      await client.query('COMMIT');
      return res.status(201).json({ orderId, status: 'success', totalPrice });
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating order:', error);
    return res.status(500).json({ error: error.message || 'Error creating order' });
  } finally {
    client.release();
  }
});

// GET endpoint to fetch orders
router.get('/orders', async (req, res) => {
  const client = await pool.connect();
  try {
    const limit = Math.min(parseInt(req.query.limit || '10', 10), 50);
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const query = req.query.query || '';
    const status = req.query.status || 'all';
    const offset = (page - 1) * limit;

    let filterCondition = 'TRUE';
    const baseQueryParams = [limit, offset, `%${query}%`];

    if (status !== 'all') {
      filterCondition = `(orders.status = $4 OR orders.supervisoraccept = $4)`;
      baseQueryParams.push(status);
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
        clients.region AS client_region
      FROM orders
      JOIN clients ON orders.client_id = clients.id
      WHERE (clients.client_name ILIKE $3 OR clients.company_name ILIKE $3)
      AND ${filterCondition}
      ORDER BY orders.delivery_date DESC
      LIMIT $1 OFFSET $2
    `;

    const ordersResult = await executeWithRetry(async () => {
      return await client.query(baseQuery, baseQueryParams);
    });

    const orders = ordersResult.rows;
    const totalCount = orders.length;

    return res.status(200).json({
      orders,
      totalCount,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return res.status(500).json({
      error: error.message || 'Error fetching orders',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  } finally {
    client.release();
  }
});

export default router;