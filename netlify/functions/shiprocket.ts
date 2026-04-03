import { Handler } from '@netlify/functions';
import axios from 'axios';

const SHIPROCKET_EMAIL = process.env.SHIPROCKET_EMAIL;
const SHIPROCKET_PASSWORD = process.env.SHIPROCKET_PASSWORD;

let cachedToken: string | null = null;
let tokenExpiry: number | null = null;

async function getShiprocketToken(): Promise<string | any> {
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  if (!SHIPROCKET_EMAIL || !SHIPROCKET_PASSWORD) {
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Configuration Error', 
        details: 'SHIPROCKET_EMAIL or SHIPROCKET_PASSWORD not set in Netlify environment variables. Please add them in Site Settings > Environment variables.' 
      })
    };
  }

  try {
    const response = await axios.post('https://apiv2.shiprocket.in/v1/external/auth/login', {
      email: SHIPROCKET_EMAIL,
      password: SHIPROCKET_PASSWORD
    });

    cachedToken = response.data.token;
    // Token is usually valid for 10 days, let's cache for 9
    tokenExpiry = Date.now() + (9 * 24 * 60 * 60 * 1000);
    return cachedToken;
  } catch (error: any) {
    console.error('Shiprocket Auth Error:', error.response?.data || error.message);
    throw new Error('Shiprocket Authentication Failed: ' + (error.response?.data?.message || error.message));
  }
}

export const handler: Handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const orderData = JSON.parse(event.body || '{}');
    const tokenOrResponse = await getShiprocketToken();

    if (typeof tokenOrResponse !== 'string') {
      return tokenOrResponse; // Return the error response from getShiprocketToken
    }

    const token = tokenOrResponse;

    // Map frontend order data to Shiprocket format
    const shiprocketPayload = {
      order_id: orderData.id,
      order_date: new Date().toISOString().split('T')[0],
      pickup_location: "Primary", // This must match a location name in Shiprocket dashboard
      billing_customer_name: orderData.customerName,
      billing_last_name: "",
      billing_address: orderData.customerAddress,
      billing_city: orderData.customerCity,
      billing_pincode: orderData.customerPincode,
      billing_state: orderData.customerState,
      billing_country: "India",
      billing_email: orderData.customerEmail,
      billing_phone: orderData.customerPhone,
      shipping_is_billing: true,
      order_items: orderData.items.map((item: any) => ({
        name: item.name,
        sku: item.productId,
        units: item.quantity,
        selling_price: item.price,
        discount: 0,
        tax: 0,
        hsn: ""
      })),
      payment_method: "Prepaid",
      sub_total: orderData.total,
      length: 10,
      width: 10,
      height: 10,
      weight: 0.5
    };

    const response = await axios.post(
      'https://apiv2.shiprocket.in/v1/external/orders/create/adhoc',
      shiprocketPayload,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      statusCode: 200,
      body: JSON.stringify(response.data)
    };
  } catch (error: any) {
    console.error('Shiprocket API Error:', error.response?.data || error.message);
    return {
      statusCode: error.response?.status || 500,
      body: JSON.stringify({
        error: error.message,
        details: error.response?.data || 'No additional details'
      })
    };
  }
};
