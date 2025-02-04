/*import express from 'express';
import pkg from 'pg';
const { Pool } = pkg;

const router = express.Router();

// Create a connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // Increased timeout
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
        manageraccept = 'pending',
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
        `INSERT INTO orders (client_id, delivery_date, delivery_type, notes, status, storekeeperaccept, supervisoraccept,manageracceptو actual_delivery_date, total_price)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [
          client_id,
          formattedDate,
          delivery_type,
          notes || null,
          status,
          storekeeperaccept,
          supervisoraccept,
          manageraccept,
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
  connectionTimeoutMillis: 10000, // Increased timeout
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

// Function to generate custom ID
const generateCustomId = async (client) => {
  const year = new Date().getFullYear();
  const result = await client.query(
    `SELECT MAX(SUBSTRING(custom_id FROM 10)::int) AS last_id 
     FROM orders 
     WHERE custom_id LIKE $1`,
    [`NPO-${year}-%`]
  );
  const lastId = result.rows[0].last_id || 0;
  const newId = `NPO-${year}-${String(lastId + 1).padStart(5, '0')}`;
  return newId;
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
        manageraccept = 'pending',
      } = req.body;

      if (!client_id || !delivery_date || !delivery_type || !products || products.length === 0) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      let formattedDate = delivery_date;
      if (typeof delivery_date === 'string') {
        const date = new Date(delivery_date);
        formattedDate = date.toISOString().slice(0, 19).replace('T', ' ');
      }

      // Generate custom ID
      const customId = await generateCustomId(client);

      const orderPromise = client.query(
        `INSERT INTO orders (client_id, delivery_date, delivery_type, notes, status, storekeeperaccept, supervisoraccept, manageraccept, actual_delivery_date, total_price, custom_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
        [
          client_id,
          formattedDate,
          delivery_type,
          notes || null,
          status,
          storekeeperaccept,
          supervisoraccept,
          manageraccept,
          null,
          0,
          customId,
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
      return res.status(201).json({ orderId, customId, status: 'success', totalPrice });
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