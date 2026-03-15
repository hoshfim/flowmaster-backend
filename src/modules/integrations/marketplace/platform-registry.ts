/**
 * Platform Registry
 *
 * Single source of truth for all supported marketplace integrations.
 * To add a new marketplace: define its entry here + add a sync adapter.
 *
 * The `fields` array drives the dynamic credential form in the dashboard.
 */

export interface CredentialField {
  key: string;          // JSON key name stored in encrypted credentials
  label: string;        // Human-readable label shown in dashboard form
  placeholder: string;  // Placeholder text
  type: "text" | "password" | "url";
  required: boolean;
  helpText?: string;    // Optional tooltip / help text
}

export interface PlatformDefinition {
  id: string;           // Matches Platform enum in schema
  name: string;         // Display name
  description: string;  // Short description shown on card
  color: string;        // CSS hex/var for theming
  icon: string;         // Emoji or short letter for the icon cell
  scopes: string[];     // OAuth/API scopes required
  docsUrl: string;      // Link to official API docs
  fields: CredentialField[];
  syncEnabled: boolean; // Whether a sync adapter exists
}

export const PLATFORM_REGISTRY: PlatformDefinition[] = [
  {
    id: "shopify",
    name: "Shopify",
    description:
      "Pull orders, refunds, fees, and payout history from your Shopify store via the Admin REST API.",
    color: "#96bf47",
    icon: "S",
    scopes: ["read_orders", "read_finances", "read_products"],
    docsUrl: "https://shopify.dev/docs/api/admin-rest",
    syncEnabled: true,
    fields: [
      {
        key: "storeDomain",
        label: "Store Domain",
        placeholder: "your-store.myshopify.com",
        type: "url",
        required: true,
        helpText: "Your Shopify store subdomain, e.g. my-shop.myshopify.com",
      },
      {
        key: "accessToken",
        label: "Admin API Access Token",
        placeholder: "shpat_xxxxxxxxxxxxxxxxxxxx",
        type: "password",
        required: true,
        helpText: "Generate in Shopify Admin → Apps → Develop apps → API credentials",
      },
      {
        key: "apiKey",
        label: "API Key (optional)",
        placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        type: "text",
        required: false,
        helpText: "Only required for public app authentication",
      },
      {
        key: "apiSecret",
        label: "API Secret (optional)",
        placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        type: "password",
        required: false,
        helpText: "Only required for public app authentication",
      },
    ],
  },

  {
    id: "tiktok",
    name: "TikTok Shop",
    description:
      "Pull order settlements, payouts, and reserve balances from TikTok Shop Seller API. Uses Finance API scopes.",
    color: "#ff0050",
    icon: "♪",
    scopes: ["finance.payout", "finance.order.settlement", "finance.settlement"],
    docsUrl: "https://partner.tiktokshop.com/doc/page/introduction",
    syncEnabled: true,
    fields: [
      {
        key: "appKey",
        label: "App Key",
        placeholder: "xxxxxxxxxxxxxxxx",
        type: "text",
        required: true,
        helpText: "Found in TikTok Shop Partner Center → My Apps",
      },
      {
        key: "appSecret",
        label: "App Secret",
        placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        type: "password",
        required: true,
        helpText: "Keep this secret. Regenerate in Partner Center if compromised.",
      },
      {
        key: "accessToken",
        label: "Access Token",
        placeholder: "xxxx-xxxx-xxxx-xxxx",
        type: "password",
        required: true,
        helpText: "OAuth 2.0 access token from the seller authorization flow",
      },
      {
        key: "shopId",
        label: "Shop ID (optional)",
        placeholder: "7xxxxxxxxxxxxxxxxx",
        type: "text",
        required: false,
        helpText: "Required for multi-shop accounts",
      },
    ],
  },

  {
    id: "amazon",
    name: "Amazon Seller",
    description:
      "Connect your Amazon Seller Central account via SP-API to pull settlements, disbursements, and fees.",
    color: "#ff9900",
    icon: "A",
    scopes: ["Finances", "Reports", "Orders"],
    docsUrl: "https://developer-docs.amazon.com/sp-api/docs",
    syncEnabled: false, // adapter coming soon
    fields: [
      {
        key: "sellerId",
        label: "Seller ID (Merchant Token)",
        placeholder: "AXXXXXXXXXXXXXXXXX",
        type: "text",
        required: true,
        helpText: "Found in Seller Central → Account Info → Merchant Token",
      },
      {
        key: "mwsAuthToken",
        label: "LWA Client ID",
        placeholder: "amzn1.application-oa2-client.xxxxx",
        type: "text",
        required: true,
        helpText: "Login with Amazon OAuth client ID from SP-API developer console",
      },
      {
        key: "clientSecret",
        label: "LWA Client Secret",
        placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        type: "password",
        required: true,
      },
      {
        key: "refreshToken",
        label: "Refresh Token",
        placeholder: "Atzr|xxxxxxxxxx…",
        type: "password",
        required: true,
        helpText: "Obtained after completing the SP-API OAuth authorization flow",
      },
      {
        key: "region",
        label: "Marketplace Region",
        placeholder: "us-east-1",
        type: "text",
        required: true,
        helpText: "AWS region for your marketplace: us-east-1, eu-west-1, us-west-2",
      },
    ],
  },

  {
    id: "woocommerce",
    name: "WooCommerce",
    description:
      "Connect your WooCommerce store via REST API to track orders, refunds, and revenue.",
    color: "#7f54b3",
    icon: "W",
    scopes: ["read_orders", "read_reports"],
    docsUrl: "https://woocommerce.github.io/woocommerce-rest-api-docs",
    syncEnabled: false,
    fields: [
      {
        key: "storeUrl",
        label: "Store URL",
        placeholder: "https://your-store.com",
        type: "url",
        required: true,
      },
      {
        key: "consumerKey",
        label: "Consumer Key",
        placeholder: "ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        type: "text",
        required: true,
        helpText: "Generate in WooCommerce → Settings → Advanced → REST API",
      },
      {
        key: "consumerSecret",
        label: "Consumer Secret",
        placeholder: "cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        type: "password",
        required: true,
      },
    ],
  },

  {
    id: "lazada",
    name: "Lazada",
    description:
      "Sync Lazada seller financials including orders, settlements, and disbursements across SEA markets.",
    color: "#0f146d",
    icon: "L",
    scopes: ["finance", "orders", "seller"],
    docsUrl: "https://open.lazada.com/apps/doc/doc.htm",
    syncEnabled: false,
    fields: [
      {
        key: "appKey",
        label: "App Key",
        placeholder: "123456",
        type: "text",
        required: true,
        helpText: "From Lazada Open Platform → App Management",
      },
      {
        key: "appSecret",
        label: "App Secret",
        placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        type: "password",
        required: true,
      },
      {
        key: "accessToken",
        label: "Access Token",
        placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        type: "password",
        required: true,
        helpText: "Generated via OAuth 2.0 authorization flow",
      },
      {
        key: "region",
        label: "Region",
        placeholder: "SG",
        type: "text",
        required: true,
        helpText: "SG, MY, TH, PH, ID, or VN",
      },
    ],
  },
];

/**
 * Look up a platform definition by its ID.
 */
export function getPlatformDef(platformId: string): PlatformDefinition | undefined {
  return PLATFORM_REGISTRY.find((p) => p.id === platformId);
}

/**
 * Get all platform IDs (for use in Zod enums, validation, etc.)
 */
export const SUPPORTED_PLATFORM_IDS = PLATFORM_REGISTRY.map((p) => p.id);
