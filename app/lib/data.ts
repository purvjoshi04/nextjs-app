
import { formatCurrency } from './utils';
import { neon } from '@neondatabase/serverless';
import { Revenue, LatestInvoice } from './definitions';
const sql = neon(process.env.DATABASE_URL || '');
const ITEMS_PER_PAGE = 6;

// Fetch revenue data
export async function fetchRevenue(): Promise<Revenue[]> {
  try {
    const data = await sql`SELECT month, revenue FROM revenue`;

    // Ensure that the data conforms to the Revenue type
    const formattedData: Revenue[] = data.map(row => ({
      month: row.month,
      revenue: Number(row.revenue), // Ensure revenue is a number
    }));

    return formattedData;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch revenue data.');
  }
}


// Fetch the latest invoices
export async function fetchLatestInvoices(): Promise<LatestInvoice[]> {
  try {
    const data = await sql` SELECT invoices.amount, customers.name, customers.image_url, customers.email, invoices.id
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      ORDER BY invoices.date DESC
      LIMIT 5`;
    return data.map(invoice => ({
      id: invoice.id,
      date: invoice.date,
      image_url: invoice.image_url,
      email: invoice.email,
      amount: invoice.amount,
      name:invoice.name
    }));
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch latest invoices data.');
  }
}

// Fetch card data (e.g., total invoices, total customers)
export async function fetchCardData() {
  try {
    const [invoiceCount, customerCount, invoiceStatus] = await Promise.all([
      sql`SELECT COUNT(*) FROM invoices`,
      sql`SELECT COUNT(*) FROM customers`,
      sql`
        SELECT
          SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS "paid",
          SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS "pending"
        FROM invoices
      `,
    ]);

    return {
      numberOfInvoices: Number(invoiceCount[0].count),
      numberOfCustomers: Number(customerCount[0].count),
      totalPaidInvoices: formatCurrency(invoiceStatus[0].paid),
      totalPendingInvoices: formatCurrency(invoiceStatus[0].pending),
    };
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch card data.');
  }
}

// Fetch filtered invoices with pagination
export async function fetchFilteredInvoices(query: string, currentPage: number) {
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  try {
    const invoices = await sql`
      SELECT
        invoices.id,
        invoices.amount,
        invoices.date,
        invoices.status,
        customers.name,
        customers.email,
        customers.image_url
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      WHERE
        customers.name ILIKE ${`%${query}%`} OR
        customers.email ILIKE ${`%${query}%`} OR
        invoices.amount::text ILIKE ${`%${query}%`} OR
        invoices.date::text ILIKE ${`%${query}%`} OR
        invoices.status ILIKE ${`%${query}%`}
      ORDER BY invoices.date DESC
      LIMIT ${ITEMS_PER_PAGE} OFFSET ${offset}
    `;

    return invoices;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoices.');
  }
}

// Fetch total number of pages for filtered invoices
export async function fetchInvoicesPages(query: string) {
  try {
    const count = await sql`
      SELECT COUNT(*)
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      WHERE
        customers.name ILIKE ${`%${query}%`} OR
        customers.email ILIKE ${`%${query}%`} OR
        invoices.amount::text ILIKE ${`%${query}%`} OR
        invoices.date::text ILIKE ${`%${query}%`} OR
        invoices.status ILIKE ${`%${query}%`}
    `;

    return Math.ceil(Number(count[0].count) / ITEMS_PER_PAGE);
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch total number of invoices.');
  }
}

// Fetch a single invoice by its ID
export async function fetchInvoiceById(id: string) {
  try {
    const data = await sql`
      SELECT
        invoices.id,
        invoices.customer_id,
        invoices.amount,
        invoices.status
      FROM invoices
      WHERE invoices.id = ${id};
    `;

    return data.map((invoice) => ({
      ...invoice,
      // Convert amount from cents to dollars
      amount: invoice.amount / 100,
    }))[0];
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoice.');
  }
}

// Fetch all customers, ordered by name
export async function fetchCustomers() {
  try {
    const data = await sql`
      SELECT id, name
      FROM customers
      ORDER BY name ASC
    `;

    return data;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch all customers.');
  }
}

// Fetch filtered customers with invoice data
export async function fetchFilteredCustomers(query: string) {
  try {
    const data = await sql`
      SELECT
        customers.id,
        customers.name,
        customers.email,
        customers.image_url,
        COUNT(invoices.id) AS total_invoices,
        SUM(CASE WHEN invoices.status = 'pending' THEN invoices.amount ELSE 0 END) AS total_pending,
        SUM(CASE WHEN invoices.status = 'paid' THEN invoices.amount ELSE 0 END) AS total_paid
      FROM customers
      LEFT JOIN invoices ON customers.id = invoices.customer_id
      WHERE
        customers.name ILIKE ${`%${query}%`} OR
        customers.email ILIKE ${`%${query}%`}
      GROUP BY customers.id, customers.name, customers.email, customers.image_url
      ORDER BY customers.name ASC
    `;

    return data.map((customer) => ({
      ...customer,
      total_pending: formatCurrency(customer.total_pending),
      total_paid: formatCurrency(customer.total_paid),
    }));
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch customer table.');
  }
}
