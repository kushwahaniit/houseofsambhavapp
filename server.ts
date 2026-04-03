import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Shiprocket Auth Token Cache
  let shiprocketToken: string | null = null;
  let tokenExpiry: number | null = null;

  async function getShiprocketToken() {
    if (shiprocketToken && tokenExpiry && Date.now() < tokenExpiry) {
      return shiprocketToken;
    }

    const email = process.env.SHIPROCKET_EMAIL;
    const password = process.env.SHIPROCKET_PASSWORD;

    if (!email || !password) {
      const missing = [];
      if (!email) missing.push("SHIPROCKET_EMAIL");
      if (!password) missing.push("SHIPROCKET_PASSWORD");
      console.error(`Shiprocket Error: Missing environment variables: ${missing.join(", ")}`);
      throw new Error(`Shiprocket credentials not configured in AI Studio Secrets. Missing: ${missing.join(", ")}`);
    }

    if (email.trim() === "" || password.trim() === "") {
      throw new Error("Shiprocket credentials are empty strings. Please check your Secrets configuration.");
    }

    try {
      console.log(`Shiprocket: Attempting login for email: ${email.substring(0, 3)}...`);
      const response = await fetch("https://apiv2.shiprocket.in/v1/external/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({ email, password }),
      });

      const responseStatus = response.status;
      const data = await response.json() as any;
      
      if (response.ok && data.token) {
        shiprocketToken = data.token;
        tokenExpiry = Date.now() + 9 * 24 * 60 * 60 * 1000;
        console.log("Shiprocket: Successfully authenticated.");
        return shiprocketToken;
      } else {
        console.error(`Shiprocket Auth Failed (Status ${responseStatus}):`, data);
        let errorMessage = data.message || data.error || JSON.stringify(data);
        
        if (responseStatus === 403) {
          errorMessage = "Access Forbidden. Please ensure you have created an API User in your Shiprocket Dashboard (Settings -> API -> Configure) and are using those credentials. Also, ensure your account is verified and active.";
        }
        
        throw new Error(`Shiprocket Auth Failed (Status ${responseStatus}): ${errorMessage}`);
      }
    } catch (error: any) {
      console.error("Shiprocket Connection Error:", error);
      throw new Error(error.message.includes("Shiprocket Auth Failed") ? error.message : `Failed to connect to Shiprocket: ${error.message}`);
    }
  }

  // API routes
  app.post("/api/shiprocket/order", async (req, res) => {
    try {
      const token = await getShiprocketToken();
      const orderData = req.body;

      // Validate address length (Shiprocket requirement: min 10 chars)
      const address = orderData.customerAddress || "";
      const validatedAddress = address.length < 10 ? `${address} (Address for shipping)`.padEnd(10, ' ') : address;

      // Map our order data to Shiprocket format
      const shiprocketOrder = {
        order_id: orderData.id,
        order_date: new Date().toISOString().split('T')[0],
        pickup_location: orderData.pickup_location_override || "Primary", // Use override if provided
        billing_customer_name: orderData.customerName,
        billing_last_name: "",
        billing_address: validatedAddress,
        billing_city: orderData.customerCity || "City required",
        billing_pincode: orderData.customerPincode || "Pincode required",
        billing_state: orderData.customerState || "State required",
        billing_country: "India",
        billing_email: orderData.customerEmail,
        billing_phone: orderData.customerPhone,
        shipping_is_billing: true,
        order_items: orderData.items.map((item: any) => ({
          name: item.name,
          sku: item.productId || item.sku || "SKU",
          units: item.quantity,
          selling_price: item.price,
          discount: 0,
          tax: 0,
          hsn: "",
        })),
        payment_method: "Prepaid",
        sub_total: orderData.total,
        length: 10,
        breadth: 10,
        height: 10,
        weight: 0.5,
      };

      // Try to fetch pickup locations and use the first one if "Primary" is not found and no override is set
      if (!orderData.pickup_location_override) {
        try {
          console.log("Shiprocket: Fetching pickup locations...");
          const pickupResponse = await fetch("https://apiv2.shiprocket.in/v1/external/settings/get/pickup", {
            method: "GET",
            headers: { 
              Authorization: `Bearer ${token}`,
              "Accept": "application/json"
            },
          });
          
          if (pickupResponse.ok) {
            const pickupData = await pickupResponse.json();
            console.log("Shiprocket: Pickup locations response:", JSON.stringify(pickupData));
            
            // Try multiple common paths for pickup locations
            let locations = [];
            if (pickupData.data?.shipping_address && Array.isArray(pickupData.data.shipping_address)) {
              locations = pickupData.data.shipping_address;
            } else if (pickupData.shipping_address && Array.isArray(pickupData.shipping_address)) {
              locations = pickupData.shipping_address;
            } else if (Array.isArray(pickupData.data)) {
              locations = pickupData.data;
            } else if (Array.isArray(pickupData)) {
              locations = pickupData;
            }

            if (locations.length > 0) {
              const hasPrimary = locations.some((l: any) => l.pickup_location === "Primary");
              if (!hasPrimary) {
                shiprocketOrder.pickup_location = locations[0].pickup_location;
                console.log(`Shiprocket: "Primary" pickup location not found. Using "${shiprocketOrder.pickup_location}" instead.`);
              }
            } else {
              console.warn("Shiprocket: No pickup locations found in account.");
            }
          } else {
            const errorText = await pickupResponse.text();
            console.error(`Shiprocket: Failed to fetch pickup locations. Status: ${pickupResponse.status}, Body: ${errorText}`);
          }
        } catch (e) {
          console.error("Shiprocket: Failed to fetch pickup locations for order, using default 'Primary'.", e);
        }
      }

      console.log("Sending to Shiprocket:", JSON.stringify(shiprocketOrder, null, 2));

      const response = await fetch("https://apiv2.shiprocket.in/v1/external/orders/create/adhoc", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(shiprocketOrder),
      });

      const responseStatus = response.status;
      const data = await response.json();
      
      if (!response.ok) {
        if (responseStatus === 422) {
          return res.status(422).json({ 
            error: "Shiprocket validation failed", 
            details: data.errors || data
          });
        }
        return res.status(responseStatus).json({
          error: `Shiprocket API Error (Status ${responseStatus})`,
          details: data
        });
      }

      res.json(data);
    } catch (error: any) {
      console.error("Shiprocket Order Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
