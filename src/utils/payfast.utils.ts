import crypto from 'crypto';

// Replicates PHP's urlencode() function exactly
const phpUrlEncode = (str: string): string => {
  return encodeURIComponent(str)
    .replace(/%20/g, '+')
    .replace(/[!'()*~]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
};

export const generatePayFastSignature = (
  data: Record<string, any>,
  passphrase?: string
): string => {
  // PayFast requires a specific order for the fields.
  // This is the standard order from their documentation.
  const orderedKeys = [
    'merchant_id',
    'merchant_key',
    'return_url',
    'cancel_url',
    'notify_url',
    'name_first',
    'name_last',
    'email_address',
    'cell_number',
    'm_payment_id',
    'amount',
    'item_name',
    'item_description',
    'custom_str1',
    'custom_str2',
    'custom_str3',
    'custom_str4',
    'custom_str5',
    'email_confirmation',
    'confirmation_address',
    'subscription_type',
    'recurring_amount',
    'frequency',
    'cycles',
  ];

  let pfOutput = '';

  // Iterate over the keys in the specified order
  for (const key of orderedKeys) {
    if (data[key] !== undefined && data[key] !== null && data[key] !== '') {
      pfOutput += `${key}=${phpUrlEncode(String(data[key]).trim())}&`;
    }
  }

  // Remove the trailing ampersand
  let getString = pfOutput.slice(0, -1);

  // Append the passphrase if it exists
  if (passphrase) {
    getString += `&passphrase=${phpUrlEncode(passphrase.trim())}`;
  }

  // Generate the MD5 hash
  return crypto.createHash('md5').update(getString).digest('hex');
};