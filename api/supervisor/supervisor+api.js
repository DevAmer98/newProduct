import { Router } from 'express';
import pg from 'pg';
import sgMail from '@sendgrid/mail';

const { Pool } = pg;

const router = Router();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

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

// Function to send welcome email via SendGrid
async function sendWelcomeEmail(email, name, temporaryPassword, role) {
  try {
    const emailContent = `
      <h2>Welcome ${name}!</h2>
      <p>Your ${role} account has been created successfully.</p>
      <p>Here are your login credentials:</p>
      <p>Email: ${email}</p>
      <p>Temporary Password: ${temporaryPassword}</p>
      <p>Please change your password after your first login.</p>
      <a href="${process.env.BASE_URL || 'http://192.168.1.103:8081'}/sign-in" style="
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

// POST /api/supervisors
router.post('/supervisors', async (req, res) => {
  try {
    const { name, email, phone, clerkId, role = 'supervisor', fcmToken = null } = req.body;

    console.log('Received data:', { name, email, phone, clerkId, role });

    // Validate required fields
    if (!name || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format',
      });
    }

    // Phone validation
    const phoneRegex = /^\+?[\d\s-]{8,}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format',
      });
    }

    const client = await pool.connect();

    // Check for existing supervisor
    const checkQuery = 'SELECT * FROM supervisors WHERE email = $1';
    const checkResult = await client.query(checkQuery, [email]);

    if (checkResult.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Supervisor with this email already exists',
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

    // Insert supervisor into database
    const insertQuery = `
      INSERT INTO supervisors (name, email, phone, clerk_id, role, created_at, fcm_token)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6)
      RETURNING id, name, email, phone, role
    `;

    const result = await client.query(insertQuery, [name, email, phone, userId, role, fcmToken]);
    console.log('Supervisor inserted into database');

    res.status(200).json({
      success: true,
      message: 'Supervisor registered successfully',
      supervisor: result.rows[0],
    });
  } catch (error) {
    console.error('Error in POST handler:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error registering supervisor',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

// GET /api/supervisors
router.get('/supervisors', async (req, res) => {
  const client = await pool.connect();
  try {
    const limit = Math.min(parseInt(req.query.limit || '10', 10), 50);
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const nameQuery = req.query.query || '';

    const offset = (page - 1) * limit;

    const baseQuery = `
      SELECT *
      FROM supervisors
      WHERE name ILIKE $3
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;

    console.log('Executing SQL Query:', baseQuery);
    console.log('With Parameters:', [limit, offset, `%${nameQuery}%`]);

    const supervisorsResult = await client.query(baseQuery, [limit, offset, `%${nameQuery}%`]);
    if (!supervisorsResult) {
      console.error('No result from the query.');
      throw new Error('No result from the query.');
    }

    const supervisors = supervisorsResult.rows;
    const totalCount = supervisors.length;

    res.status(200).json({
      supervisors,
      totalCount,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (error) {
    console.error('Error fetching supervisors:', error);
    res.status(500).json({
      error: error.message || 'Error fetching supervisors',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  } finally {
    client.release();
  }
});

export default router;