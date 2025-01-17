/*import { ExpoRequest, ExpoResponse } from "expo-router/server";
import { Client } from "pg";

// Initialize PostgreSQL client
const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

// Connect to the database
async function connectToDatabase() {
  try {
    if (!client._connected) {
      await client.connect();
      console.log("Database connected");
    }
  } catch (err) {
    console.error("Failed to connect to database:", err);
    throw new Error("Database connection failed");
  }
}

export async function GET(request: ExpoRequest): Promise<ExpoResponse> {
  try {
    // Extract the 'id' parameter from the URL
    const url = new URL(request.url);
    const id = url.pathname.split("/").pop();

    if (!id) {
      return new ExpoResponse(
        JSON.stringify({ success: false, message: "SalesRep ID is required" }),
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Query the driver by ID
    const query = "SELECT * FROM salesreps WHERE id = $1";
    const result = await client.query(query, [id]);

    if (result.rows.length === 0) {
      return new ExpoResponse(
        JSON.stringify({ success: false, message: "SalesRep not found" }),
        { status: 404 }
      );
    }

    return new ExpoResponse(
      JSON.stringify({ success: true, salesRep: result.rows[0] }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching SalesRep:", error);
    return new ExpoResponse(
      JSON.stringify({
        success: false,
        message: error.message || "Error fetching salesRep details",
      }),
      { status: 500 }
    );
  }
}


async function deleteClerkUser(clerkId: string) {
  try {
    const response = await fetch(`https://api.clerk.dev/v1/users/${clerkId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
        "Clerk-Backend-API-Version": "2023-05-12",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to delete user from Clerk.");
    }
  } catch (error) {
    console.error("Error deleting Clerk user:", error);
    throw error;
  }
}

export async function DELETE(request: ExpoRequest): Promise<ExpoResponse> {
  try {
    const url = new URL(request.url);
    const id = url.pathname.split("/").pop();

    if (!id) {
      return new ExpoResponse(
        JSON.stringify({ success: false, message: "SalesRep ID is required" }),
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Fetch the Clerk ID before deletion
    const salesRepQuery = "SELECT clerk_id FROM salesreps WHERE id = $1";
    const salesRepResult = await client.query(salesRepQuery, [id]);

    if (salesRepResult.rows.length === 0) {
      return new ExpoResponse(
        JSON.stringify({ success: false, message: "SalesRep not found" }),
        { status: 404 }
      );
    }

    const { clerk_id } = salesRepResult.rows[0];

    // Delete the driver from the database
    const deleteQuery = "DELETE FROM salesreps WHERE id = $1";
    await client.query(deleteQuery, [id]);

    // Delete the driver from Clerk
    await deleteClerkUser(clerk_id);

    return new ExpoResponse(
      JSON.stringify({ success: true, message: "SalesRep deleted successfully" }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting salesRep:", error);
    return new ExpoResponse(
      JSON.stringify({ success: false, message: error.message }),
      { status: 500 }
    );
  }
}


export async function PUT(request: ExpoRequest): Promise<ExpoResponse> {
  try {
    const url = new URL(request.url);
    const id = url.pathname.split("/").pop();
 
    if (!id) {
      return new ExpoResponse(
        JSON.stringify({ success: false, message: "SalesRep ID is required" }),
        { status: 400 }
      );
    }

    const { name, email, phone, role } = await request.json();

    if (!name || !email || !phone || !role) {
      return new ExpoResponse(
        JSON.stringify({ success: false, message: "Missing required fields" }),
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Fetch the Clerk ID from the database
    const fetchClerkIdQuery = "SELECT clerk_id FROM salesreps WHERE id = $1";
    const fetchResult = await client.query(fetchClerkIdQuery, [id]);

    if (fetchResult.rows.length === 0) {
      return new ExpoResponse(
        JSON.stringify({ success: false, message: "SalesRep not found" }),
        { status: 404 }
      );
    }

    const { clerk_id } = fetchResult.rows[0];

    // Update Clerk user
    const clerkUpdateResponse = await fetch(
      `https://api.clerk.dev/v1/users/${clerk_id}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
          "Content-Type": "application/json",
          "Clerk-Backend-API-Version": "2023-05-12",
        },
        body: JSON.stringify({
          first_name: name,
          email_addresses: [{ email_address: email }],
          public_metadata: { phone, role },
        }),
      }
    );

    if (!clerkUpdateResponse.ok) {
      const errorData = await clerkUpdateResponse.json();
      console.error("Error updating Clerk user:", errorData);
      throw new Error("Failed to update salesRep in Clerk");
    }

    // Update driver in the database
    const updateQuery = `
      UPDATE salesreps
      SET name = $1, email = $2, phone = $3, role = $4
      WHERE id = $5
      RETURNING id, name, email, phone, role
    `;
    const result = await client.query(updateQuery, [name, email, phone, role, id]);

    if (result.rows.length === 0) {
      return new ExpoResponse(
        JSON.stringify({ success: false, message: "SalesRep not found" }),
        { status: 404 }
      );
    }

    return new ExpoResponse(
      JSON.stringify({
        success: true,
        message: "SalesRep updated successfully in both Clerk and database",
        salesRep: result.rows[0],
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating SalesRep:", error);
    return new ExpoResponse(
      JSON.stringify({ success: false, message: error.message }),
      { status: 500 }
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

// Connect to the database
async function connectToDatabase() {
  try {
    const client = await pool.connect();
    console.log('Database connected');
    return client;
  } catch (err) {
    console.error('Failed to connect to database:', err);
    throw new Error('Database connection failed');
  }
}

// Function to delete a Clerk user
async function deleteClerkUser(clerkId) {
  try {
    const response = await fetch(`https://api.clerk.dev/v1/users/${clerkId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
        'Clerk-Backend-API-Version': '2023-05-12',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to delete user from Clerk.');
    }
  } catch (error) {
    console.error('Error deleting Clerk user:', error);
    throw error;
  }
}

// GET /api/salesreps/:id
router.get('/salesreps/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ success: false, message: 'SalesRep ID is required' });
    }

    const client = await connectToDatabase();

    // Query the salesRep by ID
    const query = 'SELECT * FROM salesreps WHERE id = $1';
    const result = await client.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'SalesRep not found' });
    }

    return res.status(200).json({ success: true, salesRep: result.rows[0] });
  } catch (error) {
    console.error('Error fetching SalesRep:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Error fetching salesRep details',
    });
  }
});

// DELETE /api/salesreps/:id
router.delete('/salesreps/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ success: false, message: 'SalesRep ID is required' });
    }

    const client = await connectToDatabase();

    // Fetch the Clerk ID before deletion
    const salesRepQuery = 'SELECT clerk_id FROM salesreps WHERE id = $1';
    const salesRepResult = await client.query(salesRepQuery, [id]);

    if (salesRepResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'SalesRep not found' });
    }

    const { clerk_id } = salesRepResult.rows[0];

    // Delete the salesRep from the database
    const deleteQuery = 'DELETE FROM salesreps WHERE id = $1';
    await client.query(deleteQuery, [id]);

    // Delete the salesRep from Clerk
    await deleteClerkUser(clerk_id);

    return res.status(200).json({ success: true, message: 'SalesRep deleted successfully' });
  } catch (error) {
    console.error('Error deleting SalesRep:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/salesreps/:id
router.put('/salesreps/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, role } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, message: 'SalesRep ID is required' });
    }

    if (!name || !email || !phone || !role) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const client = await connectToDatabase();

    // Fetch the Clerk ID from the database
    const fetchClerkIdQuery = 'SELECT clerk_id FROM salesreps WHERE id = $1';
    const fetchResult = await client.query(fetchClerkIdQuery, [id]);

    if (fetchResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'SalesRep not found' });
    }

    const { clerk_id } = fetchResult.rows[0];

    // Update Clerk user
    const clerkUpdateResponse = await fetch(
      `https://api.clerk.dev/v1/users/${clerk_id}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
          'Content-Type': 'application/json',
          'Clerk-Backend-API-Version': '2023-05-12',
        },
        body: JSON.stringify({
          first_name: name,
          email_addresses: [{ email_address: email }],
          public_metadata: { phone, role },
        }),
      }
    );

    if (!clerkUpdateResponse.ok) {
      const errorData = await clerkUpdateResponse.json();
      console.error('Error updating Clerk user:', errorData);
      throw new Error('Failed to update salesRep in Clerk');
    }

    // Update salesRep in the database
    const updateQuery = `
      UPDATE salesreps
      SET name = $1, email = $2, phone = $3, role = $4
      WHERE id = $5
      RETURNING id, name, email, phone, role
    `;
    const result = await client.query(updateQuery, [name, email, phone, role, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'SalesRep not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'SalesRep updated successfully in both Clerk and database',
      salesRep: result.rows[0],
    });
  } catch (error) {
    console.error('Error updating SalesRep:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;