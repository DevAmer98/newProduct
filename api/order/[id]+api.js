/*import { Pool } from 'pg';
import admin from 'firebase-admin'; // Ensure Firebase Admin is initialized


// Firebase Admin Initialization (if not already initialized)
if (admin.apps.length === 0) {
  const serviceAccount = require("../../../secrets/new-product-28188-firebase-adminsdk-519rh-4906ca32b7.json");
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}


const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function testConnection() {
  try {
    const res = await pool.query('SELECT 1 AS test');
    console.log('Database connection successful:', res.rows);
  } catch (error) {
    console.error('Database connection error:', error);
  }
}

testConnection();


export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.pathname.split('/').pop();

  if (!id) {
    return new Response(
      JSON.stringify({ error: "Missing order ID" }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const orderQuery = `
    SELECT o.*, c.company_name, c.client_name, c.phone_number, 
           c.tax_number, c.branch_number, c.latitude, c.longitude, 
           c.street, c.city, c.region, o.storekeeper_notes
    FROM orders o
    JOIN clients c ON o.client_id = c.id
    WHERE o.id = $1
  `;
  
    const orderResult = await pool.query(orderQuery, [id]);

    if (orderResult.rows.length === 0) {
      return new Response(
        JSON.stringify({ error: "Order not found" }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const productsQuery = `
      SELECT * FROM order_products
      WHERE order_id = $1
    `;
    const productsResult = await pool.query(productsQuery, [id]);

    

    const orderData = {
      ...orderResult.rows[0],
      products: productsResult.rows
    };

    return new Response(
      JSON.stringify(orderData),
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





export async function PUT(request: Request) {
  const url = new URL(request.url);
  const id = url.pathname.split('/').pop();
  const body = await request.json();

  if (!id) {
    return new Response(
      JSON.stringify({ error: "Missing order ID" }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const {
      client_id,
      delivery_date,
      delivery_type,
      notes,
      products,
      status = 'not Delivered',
      storekeeperaccept = 'pending',
      supervisoraccept= 'pending',
    } = body;

    // Set `actual_delivery_date` if the status is "delivered"
    const actualDeliveryDate = status === 'delivered' ? new Date().toISOString() : null;

    const updateOrderQuery = `
      UPDATE orders 
      SET client_id = $1,
          delivery_date = $2,
          delivery_type = $3,
          notes = $4,
          status = $5,
          storekeeperaccept = $6,
          supervisoraccept = $7,
          updated_at = CURRENT_TIMESTAMP,
          actual_delivery_date = COALESCE($8, actual_delivery_date),
                storekeeper_notes = $9
      WHERE id = $10
    `;

    await pool.query(updateOrderQuery, [
      client_id,
      delivery_date,
      delivery_type,
      notes || null,
      status,
      storekeeperaccept,
      supervisoraccept,
      actualDeliveryDate,  
      body.storekeeper_notes || null,
      id,
    ]);

   



    if (products && products.length > 0) {
      const deleteProductsQuery = `DELETE FROM order_products WHERE order_id = $1`;
      await pool.query(deleteProductsQuery, [id]);

      for (const product of products) {
        const { section, type,quantity, description } = product;
        await pool.query(
          `INSERT INTO order_products (order_id, section, type,description, quantity) 
           VALUES ($1, $2, $3, $4, $5)`,
          [id, section, type, description , quantity]
        );
      }
    }

    return new Response(
      JSON.stringify({ message: "Order and products updated successfully" }),
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




export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const id = url.pathname.split('/').pop();

  if (!id) {
    return new Response(
      JSON.stringify({ error: "Missing order ID" }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const deleteProductsQuery = `DELETE FROM order_products WHERE order_id = $1`;
    await pool.query(deleteProductsQuery, [id]);

    const deleteOrderQuery = `DELETE FROM orders WHERE id = $1`;
    const deleteOrderResult = await pool.query(deleteOrderQuery, [id]);

    if (deleteOrderResult.rowCount === 0) {
      return new Response(
        JSON.stringify({ error: "Order not found" }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ message: "Order and associated products deleted successfully" }),
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
import admin from 'firebase-admin';
import { createRequire } from 'module'; // Use createRequire to load JSON

const router = express.Router();

// Firebase Admin Initialization (if not already initialized)
if (admin.apps.length === 0) {
  // Use createRequire to load the JSON file
  const require = createRequire(import.meta.url);
  const serviceAccount = require('../../../secrets/new-product-28188-firebase-adminsdk-519rh-4906ca32b7.json');

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// Create a connection pool
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

// GET /api/orders/:id
router.get('/orders/:id', async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'Missing order ID' });
  }

  try {
    const orderQuery = `
      SELECT o.*, c.company_name, c.client_name, c.phone_number, 
             c.tax_number, c.branch_number, c.latitude, c.longitude, 
             c.street, c.city, c.region, o.storekeeper_notes
      FROM orders o
      JOIN clients c ON o.client_id = c.id
      WHERE o.id = $1
    `;

    const orderResult = await pool.query(orderQuery, [id]);

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const productsQuery = `
      SELECT * FROM order_products
      WHERE order_id = $1
    `;
    const productsResult = await pool.query(productsQuery, [id]);

    const orderData = {
      ...orderResult.rows[0],
      products: productsResult.rows,
    };

    return res.status(200).json(orderData);
  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      details: error.message,
    });
  }
});

// PUT /api/orders/:id
router.put('/orders/:id', async (req, res) => {
  const { id } = req.params;
  const body = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Missing order ID' });
  }

  try {
    const {
      client_id,
      delivery_date,
      delivery_type,
      notes,
      products,
      status = 'not Delivered',
      storekeeperaccept = 'pending',
      supervisoraccept = 'pending',
    } = body;

    // Set `actual_delivery_date` if the status is "delivered"
    const actualDeliveryDate = status === 'delivered' ? new Date().toISOString() : null;

    const updateOrderQuery = `
      UPDATE orders 
      SET client_id = $1,
          delivery_date = $2,
          delivery_type = $3,
          notes = $4,
          status = $5,
          storekeeperaccept = $6,
          supervisoraccept = $7,
          updated_at = CURRENT_TIMESTAMP,
          actual_delivery_date = COALESCE($8, actual_delivery_date),
          storekeeper_notes = $9
      WHERE id = $10
    `;

    await pool.query(updateOrderQuery, [
      client_id,
      delivery_date,
      delivery_type,
      notes || null,
      status,
      storekeeperaccept,
      supervisoraccept,
      actualDeliveryDate,
      body.storekeeper_notes || null,
      id,
    ]);

    if (products && products.length > 0) {
      const deleteProductsQuery = `DELETE FROM order_products WHERE order_id = $1`;
      await pool.query(deleteProductsQuery, [id]);

      for (const product of products) {
        const { section, type, quantity, description } = product;
        await pool.query(
          `INSERT INTO order_products (order_id, section, type, description, quantity) 
           VALUES ($1, $2, $3, $4, $5)`,
          [id, section, type, description, quantity]
        );
      }
    }

    return res.status(200).json({ message: 'Order and products updated successfully' });
  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      details: error.message,
    });
  }
});

// DELETE /api/orders/:id
router.delete('/orders/:id', async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'Missing order ID' });
  }

  try {
    const deleteProductsQuery = `DELETE FROM order_products WHERE order_id = $1`;
    await pool.query(deleteProductsQuery, [id]);

    const deleteOrderQuery = `DELETE FROM orders WHERE id = $1`;
    const deleteOrderResult = await pool.query(deleteOrderQuery, [id]);

    if (deleteOrderResult.rowCount === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    return res.status(200).json({ message: 'Order and associated products deleted successfully' });
  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      details: error.message,
    });
  }
});

export default router;