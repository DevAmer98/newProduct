/*import { ExpoRequest, ExpoResponse } from 'expo-router/server';
import { Client, Pool } from 'pg';
import { neon } from '@neondatabase/serverless';


// Create a connection pool instead of new client for each request
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});




// Initialize PostgreSQL client
const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

// Connect to the database
async function connectToDatabase() {
  try {
    if (!client._connected) {
      await client.connect();
      console.log('Database connected');
    }
  } catch (err) {
    console.error('Failed to connect to database:', err);
    throw new Error('Database connection failed');
  }
}

const BASE_URL = process.env.BASE_URL || 'http://192.168.1.103:8081';
const getDeepLink = (path: string) => `${BASE_URL}${path}`;

function generateStrongPassword(): string {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'; 
  const numbers = '0123456789';
  const special = '!@#$%^&*';

  const requiredChars = [
    lowercase[Math.floor(Math.random() * lowercase.length)],
    uppercase[Math.floor(Math.random() * uppercase.length)],
    numbers[Math.floor(Math.random() * numbers.length)],
    special[Math.floor(Math.random() * special.length)],
  ];

  const remainingLength = 8 - requiredChars.length;
  const allChars = lowercase + uppercase + numbers + special;
  const remainingChars = Array.from({ length: remainingLength }, () =>
    allChars[Math.floor(Math.random() * allChars.length)]
  );

  return [...requiredChars, ...remainingChars]
    .sort(() => Math.random() - 0.5)
    .join('');
}

// Clerk user creation function with role
async function createClerkUser(email: string, password: string, name: string, role: string) {
  try {
    const requestBody = {
      email_address: [email],
      password,
      first_name: name,
      public_metadata: { role }, // Add role to public metadata
      skip_password_checks: true,
      skip_password_requirement: true,
    };

    const response = await fetch('https://api.clerk.com/v1/users', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json',
        'Clerk-Backend-API-Version': '2023-05-12',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Clerk API error: ${JSON.stringify(errorData)}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Clerk user creation error:', error);
    throw error;
  }
}

export async function POST(request: ExpoRequest): Promise<ExpoResponse> {
  try {
    const { name, email, phone, clerkId, role = 'driver' } = await request.json();

    // Validate required fields
    if (!name || !email || !phone) { 
      return new ExpoResponse(
        JSON.stringify({
          success: false,
          message: 'Missing required fields',
        }),
        { status: 400 }
      );
    }

    // Validate role
    const validRoles = ['driver', 'admin', 'dispatcher'];
    if (!validRoles.includes(role)) {
      return new ExpoResponse(
        JSON.stringify({
          success: false,
          message: 'Invalid role specified',
        }),
        { status: 400 }
      );
    }

    // Email and phone validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\+?[\d\s-]{8,}$/;
    if (!emailRegex.test(email) || !phoneRegex.test(phone)) {
      return new ExpoResponse(
        JSON.stringify({
          success: false,
          message: 'Invalid email or phone number format',
        }),
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Check for existing driver
    const checkQuery = 'SELECT * FROM drivers WHERE email = $1';
    const checkResult = await client.query(checkQuery, [email]);

    if (checkResult.rows.length > 0) {
      return new ExpoResponse(
        JSON.stringify({
          success: false,
          message: 'Driver with this email already exists',
        }),
        { status: 400 }
      );
    }

    let userId = clerkId;

    // If no clerkId provided, create a new Clerk user
    if (!clerkId) {
      const temporaryPassword = generateStrongPassword();
      const clerkUser = await createClerkUser(email, temporaryPassword, name, role);
      userId = clerkUser.id;
    }

    // Insert driver into database with role
    const insertQuery = ` 
      INSERT INTO drivers (name, email, phone, clerk_id, role, created_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP) 
      RETURNING id, name, email, phone, role
    `;

    const result = await client.query(insertQuery, [name, email, phone, userId, role]);
    console.log('Driver inserted into database');

    return new ExpoResponse(
      JSON.stringify({
        success: true,
        message: 'Driver registered successfully',
        driver: result.rows[0],
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in POST handler:', error);

    return new ExpoResponse(
      JSON.stringify({
        success: false,
        message: error.message || 'Error registering driver',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      }),
      { status: 500 }
    );
  }
}

/*export async function GET() {
  try {
    const sql = neon(`${process.env.DATABASE_URL}`);
    
    const drivers = await sql`
      SELECT * FROM drivers;
    `;

    return new Response(JSON.stringify(drivers), {
      status: 200,
    });
  } catch (error) {
    console.error("Error fetching drivers:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
    });
  }
}



export async function GET(request: Request) {
  const client = await pool.connect();
  try {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "10", 10), 50);
    const page = Math.max(parseInt(url.searchParams.get("page") || "1", 10), 1);
    const nameQuery = url.searchParams.get("query") || ""; // Parameter to search by name

    const offset = (page - 1) * limit;

    const baseQuery = `
      SELECT *
      FROM drivers
      WHERE name ILIKE $3
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;

    console.log("Executing SQL Query:", baseQuery);
    console.log("With Parameters:", [limit, offset, `%${nameQuery}%`]);

    const driversResult = await client.query(baseQuery, [limit, offset, `%${nameQuery}%`]);
    if (!driversResult) {
      console.error("No result from the query.");
      throw new Error("No result from the query.");
    }

    const drivers = driversResult.rows;
    const totalCount = drivers.length;

    return new Response(
      JSON.stringify({
        drivers,
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
    console.error("Error fetching drivers:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Error fetching drivers",
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
import sgMail from '@sendgrid/mail';

const router = express.Router();

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Create a connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});


// Helper function to generate a strong password
function generateStrongPassword() {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const special = '!@#$%^&*';

  const requiredChars = [
    lowercase[Math.floor(Math.random() * lowercase.length)],
    uppercase[Math.floor(Math.random() * uppercase.length)],
    numbers[Math.floor(Math.random() * numbers.length)],
    special[Math.floor(Math.random() * special.length)],
  ];

  const remainingLength = 8 - requiredChars.length;
  const allChars = lowercase + uppercase + numbers + special;
  const remainingChars = Array.from({ length: remainingLength }, () =>
    allChars[Math.floor(Math.random() * allChars.length)]
  );

  return [...requiredChars, ...remainingChars]
    .sort(() => Math.random() - 0.5)
    .join('');
}

// Clerk user creation function with role
async function createClerkUser(email, password, name, role) {
  try {
    const requestBody = {
      email_address: [email],
      password,
      first_name: name,
      public_metadata: { role }, // Add role to public metadata
      skip_password_checks: true,
      skip_password_requirement: true,
    };

    const response = await fetch('https://api.clerk.com/v1/users', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json',
        'Clerk-Backend-API-Version': '2023-05-12',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Clerk API error: ${JSON.stringify(errorData)}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Clerk user creation error:', error);
    throw error;
  }
}

// Function to send a welcome email via SendGrid
async function sendWelcomeEmail(email, name, temporaryPassword, role) {
  try {
    const emailContent = `
      <h2>Welcome ${name}!</h2>
      <p>Your ${role} account has been created successfully.</p>
      <p>Here are your login credentials:</p>
      <p>Email: ${email}</p>
      <p>Temporary Password: ${temporaryPassword}</p>
      <p>Please change your password after your first login.</p>
      <a href="${process.env.BASE_URL || 'http://localhost:3000'}/sign-in" style="
        background-color: #4CAF50;
        border: none;
        color: white;
        padding: 15px 32px;
        text-align: center;
        text-decoration: none;
        display: inline-block;
        font-size: 16px;
        margin: 4px 2px;
        cursor: pointer;
        border-radius: 4px;">
        Open New Product App
      </a>
    `;

    const msg = {
      to: email,
      from: process.env.SENDGRID_FROM_EMAIL,
      subject: 'Welcome to New Product App',
      html: emailContent,
    };

    await sgMail.send(msg);
    console.log('Welcome email sent successfully via SendGrid');
  } catch (error) {
    console.error('Error sending welcome email via SendGrid:', error.response ? error.response.body : error);
    throw new Error('Failed to send welcome email');
  }
}

// POST /api/drivers
router.post('/drivers', async (req, res) => {
  try {
    const { name, email, phone, clerkId, role = 'driver' } = req.body;

    // Validate required fields
    if (!name || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
      });
    }

    // Validate role
    const validRoles = ['driver', 'admin', 'dispatcher'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role specified',
      });
    }

    // Email and phone validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\+?[\d\s-]{8,}$/;
    if (!emailRegex.test(email) || !phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email or phone number format',
      });
    }

    const client = await pool.connect();

    // Check for existing driver
    const checkQuery = 'SELECT * FROM drivers WHERE email = $1';
    const checkResult = await client.query(checkQuery, [email]);

    if (checkResult.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Driver with this email already exists',
      });
    }

    let userId = clerkId;

    // If no clerkId provided, create a new Clerk user
    if (!clerkId) {
      const temporaryPassword = generateStrongPassword();
      const clerkUser = await createClerkUser(email, temporaryPassword, name, role);
      userId = clerkUser.id;

      // Send welcome email with credentials
      await sendWelcomeEmail(email, name, temporaryPassword, role);
    }

    // Insert driver into database with role
    const insertQuery = `
      INSERT INTO drivers (name, email, phone, clerk_id, role, created_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      RETURNING id, name, email, phone, role
    `;

    const result = await client.query(insertQuery, [name, email, phone, userId, role]);
    console.log('Driver inserted into database');

    return res.status(200).json({
      success: true,
      message: 'Driver registered successfully',
      driver: result.rows[0],
    });
  } catch (error) {
    console.error('Error in POST handler:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Error registering driver',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

// GET /api/drivers
router.get('/drivers', async (req, res) => {
  const client = await pool.connect();
  try {
    const limit = Math.min(parseInt(req.query.limit || '10', 10), 50);
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const nameQuery = req.query.query || ''; // Parameter to search by name

    const offset = (page - 1) * limit;

    const baseQuery = `
      SELECT *
      FROM drivers
      WHERE name ILIKE $3
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;

    console.log('Executing SQL Query:', baseQuery);
    console.log('With Parameters:', [limit, offset, `%${nameQuery}%`]);

    const driversResult = await client.query(baseQuery, [limit, offset, `%${nameQuery}%`]);
    if (!driversResult) {
      console.error('No result from the query.');
      throw new Error('No result from the query.');
    }

    const drivers = driversResult.rows;
    const totalCount = drivers.length;

    return res.status(200).json({
      drivers,
      totalCount,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (error) {
    console.error('Error fetching drivers:', error);
    return res.status(500).json({
      error: error.message || 'Error fetching drivers',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  } finally {
    client.release();
  }
});

export default router;
*/



import express from 'express';
import pkg from 'pg'; // Import the default export
const { Pool } = pkg; // Destructure Pool from the default export
import sgMail from '@sendgrid/mail';

const router = express.Router();

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Create a connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Utility function to retry database operations
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

// Utility function to add timeout to database queries
const withTimeout = (promise, timeout) => {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Database query timed out')), timeout)
  );
  return Promise.race([promise, timeoutPromise]);
};

// Helper function to generate a strong password
function generateStrongPassword() {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const special = '!@#$%^&*';

  const requiredChars = [
    lowercase[Math.floor(Math.random() * lowercase.length)],
    uppercase[Math.floor(Math.random() * uppercase.length)],
    numbers[Math.floor(Math.random() * numbers.length)],
    special[Math.floor(Math.random() * special.length)],
  ];

  const remainingLength = 8 - requiredChars.length;
  const allChars = lowercase + uppercase + numbers + special;
  const remainingChars = Array.from({ length: remainingLength }, () =>
    allChars[Math.floor(Math.random() * allChars.length)]
  );

  return [...requiredChars, ...remainingChars]
    .sort(() => Math.random() - 0.5)
    .join('');
}

// Clerk user creation function with role
async function createClerkUser(email, password, name, role) {
  try {
    const requestBody = {
      email_address: [email],
      password,
      first_name: name,
      public_metadata: { role }, // Add role to public metadata
      skip_password_checks: true,
      skip_password_requirement: true,
    };

    const response = await executeWithRetry(async () => {
      return await withTimeout(
        fetch('https://api.clerk.com/v1/users', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
            'Content-Type': 'application/json',
            'Clerk-Backend-API-Version': '2023-05-12',
          },
          body: JSON.stringify(requestBody),
        }),
        10000 // 10-second timeout
      );
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Clerk API error: ${JSON.stringify(errorData)}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Clerk user creation error:', error);
    throw error;
  }
}

// Function to send a welcome email via SendGrid
async function sendWelcomeEmail(email, name, temporaryPassword, role) {
  try {
    const emailContent = `
      <h2>مرحبًا ${name}!</h2>
      <p>لقد تم إنشاء حسابك ${role} بنجاح.</p>
      <p>إليك بيانات تسجيل الدخول الخاصة بك:</p>
      <p>البريد الإلكتروني: ${email}</p>
      <p>كلمة المرور المؤقتة: ${temporaryPassword}</p>
      <p>يرجى تغيير كلمة المرور الخاصة بك بعد تسجيل الدخول الأول.</p>
      <a href="${process.env.BASE_URL || 'http://localhost:3000'}/sign-in" style="
        background-color: #4CAF50;
        border: none;
        color: white;
        padding: 15px 32px;
        text-align: center;
        text-decoration: none;
        display: inline-block;
        font-size: 16px;
        margin: 4px 2px;
        cursor: pointer;
        border-radius: 4px;">
        فتح تطبيق المنتج الجديد
      </a>
    `;


    const msg = {
      to: email,
      from: process.env.SENDGRID_FROM_EMAIL,
      subject: 'Welcome to New Product App',
      html: emailContent,
    };

    await executeWithRetry(async () => {
      return await withTimeout(sgMail.send(msg), 10000); // 10-second timeout
    });
    console.log('Welcome email sent successfully via SendGrid');
  } catch (error) {
    console.error('Error sending welcome email via SendGrid:', error.response ? error.response.body : error);
    throw new Error('Failed to send welcome email');
  }
}

// POST /api/drivers
router.post('/drivers', async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, email, phone, clerkId, role = 'driver' } = req.body;

    // Validate required fields
    if (!name || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
      });
    }

    // Validate role
    const validRoles = ['driver', 'admin', 'dispatcher'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role specified',
      });
    }

    // Email and phone validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\+?[\d\s-]{8,}$/;
    if (!emailRegex.test(email) || !phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email or phone number format',
      });
    }

    // Check for existing driver
    const checkQuery = 'SELECT * FROM drivers WHERE email = $1';
    const checkResult = await executeWithRetry(async () => {
      return await withTimeout(client.query(checkQuery, [email]), 10000); // 10-second timeout
    });

    if (checkResult.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Driver with this email already exists',
      });
    }

    let userId = clerkId;

    // If no clerkId provided, create a new Clerk user
    if (!clerkId) {
      const temporaryPassword = generateStrongPassword();
      const clerkUser = await createClerkUser(email, temporaryPassword, name, role);
      userId = clerkUser.id;

      // Send welcome email with credentials
      await sendWelcomeEmail(email, name, temporaryPassword, role);
    }

    // Insert driver into database with role
    const insertQuery = `
      INSERT INTO drivers (name, email, phone, clerk_id, role, created_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      RETURNING id, name, email, phone, role
    `;

    const result = await executeWithRetry(async () => {
      return await withTimeout(client.query(insertQuery, [name, email, phone, userId, role]), 10000); // 10-second timeout
    });
    console.log('Driver inserted into database');

    return res.status(200).json({
      success: true,
      message: 'Driver registered successfully',
      driver: result.rows[0],
    });
  } catch (error) {
    console.error('Error in POST handler:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Error registering driver',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  } finally {
    client.release();
  }
});

// GET /api/drivers
router.get('/drivers', async (req, res) => {
  const client = await pool.connect();
  try {
    const limit = Math.min(parseInt(req.query.limit || '10', 10), 50);
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const nameQuery = req.query.query || ''; // Parameter to search by name

    const offset = (page - 1) * limit;

    const baseQuery = `
      SELECT *
      FROM drivers
      WHERE name ILIKE $3
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;

    console.log('Executing SQL Query:', baseQuery);
    console.log('With Parameters:', [limit, offset, `%${nameQuery}%`]);

    const driversResult = await executeWithRetry(async () => {
      return await withTimeout(client.query(baseQuery, [limit, offset, `%${nameQuery}%`]), 10000); // 10-second timeout
    });

    if (!driversResult) {
      console.error('No result from the query.');
      throw new Error('No result from the query.');
    }

    const drivers = driversResult.rows;
    const totalCount = drivers.length;

    return res.status(200).json({
      drivers,
      totalCount,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (error) {
    console.error('Error fetching drivers:', error);
    return res.status(500).json({
      error: error.message || 'Error fetching drivers',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  } finally {
    client.release();
  }
});

export default router;