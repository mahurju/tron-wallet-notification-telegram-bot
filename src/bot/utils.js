const crypto = require('crypto');
const fs = require('fs');
const nconf = require('nconf');
const yaml = require('js-yaml');
const path = require('path');

/* eslint-disable no-restricted-globals */
const numberformat = (value) => {
  if (typeof value === 'number') {
    if (value === 0) return 0;
    const reg = /(^[+-]?\d+)(\d{3})/;
    let n = `${value} `;
    while (reg.test(n)) {
      n = n.replace(reg, '$1,$2');
    }
    return n.trim();
  } 
  
  if (typeof value === 'string') {
    const num = parseFloat(value);
    if (isNaN(num)) return '0';
    return numberformat(num);
  }
  return 0;
};

const encrypt = (pw) => {
  const password = `${nconf.get('tron:password')}${pw}`;
  const cipher = crypto.createCipher('aes-256-cbc', password);
  const { accounts } = yaml.safeLoad(fs.readFileSync(path.join(__dirname, '..', '..', '.data', 'private-keys.yml'), 'utf8'));
  const encrypted = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(accounts), 'utf8')), cipher.final()]);
  fs.writeFileSync(path.join(__dirname, '..', '..', '.data', 'safe.dat'), encrypted);
};

const decrypt = (pw) => {
  const password = `${nconf.get('tron:password')}${pw}`;
  const data = fs.readFileSync(path.join(__dirname, '..', '..', '.data', 'safe.dat'));
  const decipher = crypto.createDecipher('aes-256-cbc', password);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  const accounts = JSON.parse(decrypted.toString());
  return accounts;
};


exports.numberformat = numberformat;
exports.encrypt = encrypt;
exports.decrypt = decrypt;
