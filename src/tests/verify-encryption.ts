import { encrypt, decrypt } from '../db.js';

function testEncryption() {
  console.log('--- Testing Encryption ---');
  const original = 'this-is-a-secret-refresh-token-123';
  
  const encrypted = encrypt(original);
  console.log('Encrypted:', encrypted);
  
  const decrypted = decrypt(encrypted);
  console.log('Decrypted:', decrypted);
  
  if (original === decrypted) {
    console.log('✅ Encryption/Decryption project success!');
  } else {
    console.error('❌ Encryption/Decryption failed!');
    process.exit(1);
  }
}

try {
  testEncryption();
} catch (err: any) {
  console.error('Verification script failed:', err.message);
}
