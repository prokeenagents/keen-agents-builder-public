// Defaults for the fictional ShopApi service (api.shop.example.com). Code, not configuration: never a key here.
// The agent's Json Settings (read by the tools, plain values only): "shop_available" (the switch — off unless true),
// "shop_title" (the name the replies use; DEFAULT_TITLE), "shop_api_url" (overrides BASE_URL).
// The tools read the agent's Secret SHOP_API_KEY and the site's cookie named in CUSTOMER_COOKIE.

export const BASE_URL = 'https://api.shop.example.com';
export const PRODUCTS_PATH = '/v1/products';
export const CART_PATH = '/v1/cart';
export const CART_ITEMS_PATH = '/v1/cart/items';

export const CUSTOMER_COOKIE = 'shop_session';
export const DEFAULT_TITLE = 'The shop';

export const DEFAULT_LIMIT = 5;
export const MAX_LIMIT = 10;
export const MAX_QUANTITY = 20;

export const QUERY_MAX_CHARS = 200;
export const NAME_MAX_CHARS = 120;
export const API_MESSAGE_MAX_CHARS = 200;
