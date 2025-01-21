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

// POST endpoint to create an order
router.post('/quotations', async (req, res) => {
  const client = await pool.connect();
  try {
    await executeWithRetry(async () => {
      await client.query('BEGIN'); // Start transaction

      const {
        client_id,
        delivery_date,
        delivery_type,
        products,
        notes,
        status = 'not Delivered',
        storekeeperaccept = 'pending',
        supervisoraccept = 'pending',
        manageraccept = 'pending',
      } = req.body;

      // Validate required fields
      if (!client_id || !delivery_date || !delivery_type || !products || products.length === 0) {
        await client.query('ROLLBACK'); // Rollback if validation fails
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Insert quotation
      const quotationResult = await client.query(
        `INSERT INTO quotations (client_id, delivery_date, delivery_type, notes, status, storekeeperaccept, supervisoraccept, manageraccept, actual_delivery_date, total_price)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [
          client_id,
          delivery_date,
          delivery_type,
          notes || null,
          status,
          storekeeperaccept,
          supervisoraccept,
          manageraccept,
          null, // actual_delivery_date
          0, // total_price (initial value)
        ]
      );

      const quotationId = quotationResult.rows[0].id;
      let totalPrice = 0;

      // Insert products
      for (const product of products) {
        const { section, type, description, quantity, price } = product;

        // Validate product fields
        if (!section || !type || !quantity || !price) {
          await client.query('ROLLBACK'); // Rollback if product validation fails
          return res.status(400).json({ error: 'Missing product details or price' });
        }

        const numericPrice = parseFloat(price);
        if (isNaN(numericPrice)) {
          await client.query('ROLLBACK'); // Rollback if price is invalid
          return res.status(400).json({ error: 'Invalid price format' });
        }

        totalPrice += numericPrice;

        await client.query(
          `INSERT INTO quotation_products (quotation_id, section, type, description, quantity, price)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [quotationId, section, type, description, quantity, numericPrice]
        );
      }

      // Update total price
      await client.query(`UPDATE quotations SET total_price = $1 WHERE id = $2`, [totalPrice, quotationId]);

      await client.query('COMMIT'); // Commit transaction
      return res.status(201).json({ quotationId, status: 'success', totalPrice });
    });
  } catch (error) {
    await client.query('ROLLBACK'); // Rollback on any error
    console.error('Error creating quotation:', error);
    return res.status(500).json({ error: error.message || 'Error creating quotation' });
  } finally {
    client.release(); // Release the client back to the pool
  }
});

// GET endpoint to fetch orders
router.get('/quotations', async (req, res) => {
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
      filterCondition = `(quotations.status = $4 OR quotations.supervisoraccept = $4)`;
      baseQueryParams.push(status);
    }

    const baseQuery = `
      SELECT 
        quotations.*, 
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
      FROM quotations
      JOIN clients ON quotations.client_id = clients.id
      WHERE (clients.client_name ILIKE $3 OR clients.company_name ILIKE $3)
      AND ${filterCondition}
      ORDER BY quotations.delivery_date DESC
      LIMIT $1 OFFSET $2
    `;

    const quotationResult = await executeWithRetry(async () => {
      return await client.query(baseQuery, baseQueryParams);
    });

    const orders = quotationResult.rows;
    const totalCount = orders.length;

    return res.status(200).json({
      orders,
      totalCount,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (error) {
    console.error('Error fetching quotations:', error);
    return res.status(500).json({
      error: error.message || 'Error fetching quotations',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  } finally {
    client.release();
  }
});

export default router;