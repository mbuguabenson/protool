const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../node_modules/@deriv-com/smartcharts-champion/dist/smartcharts.js');

if (!fs.existsSync(filePath)) {
    console.error('smartcharts.js not found at', filePath);
    process.exit(1);
}

let content = fs.readFileSync(filePath, 'utf8');

console.log('Applying comprehensive React 19 compatibility patch to smartcharts.js...');

// 1. Fix ReactCurrentOwner access (Handles React 19 renaming to .owner)
// --------------------------------------------------------------------
const secretInternalsPattern =
    /([a-zA-Z0-9_$]+)\.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED\.ReactCurrentOwner/g;
const internalsReplacement =
    '(($1.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED||$1.__CLIENT_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED||{}).ReactCurrentOwner||($1.__CLIENT_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED||{}).owner||{current:null})';

if (secretInternalsPattern.test(content)) {
    content = content.replace(secretInternalsPattern, internalsReplacement);
    console.log('- Patched ReactCurrentOwner access.');
}

// 2. Fix Manual JSX Factory (Handles React 19 "Element from older version" error)
// ----------------------------------------------------------------------------
// The library creates elements as plain objects. React 19 rejects these.
// We redirect the local 'c' function to use the host's modern 'i.jsx' factory.
const jsxFactoryPattern = /function\s+c\(t,e,r\)\{var\s+i,s=\{\},c=null,h=null;.*?return\{[^}]+_owner:o\.current\}\}/;
const jsxFactoryReplacement =
    'function c(t,e,r){ return (i.jsx ? i.jsx(t,e,r) : i.createElement(t, e, r !== undefined ? Object.assign({}, e, {key: r}) : e)); }';

if (jsxFactoryPattern.test(content)) {
    content = content.replace(jsxFactoryPattern, jsxFactoryReplacement);
    console.log('- Patched manual JSX factory to use modern runtime.');
} else {
    // Try a more flexible match if the first one fails
    const alternativePattern = /function\s+c\(t,e,r\)\{.*?return\{[^}]*\$\$typeof:a[^}]*\}\}/;
    if (alternativePattern.test(content)) {
        content = content.replace(alternativePattern, jsxFactoryReplacement);
        console.log('- Patched manual JSX factory using alternative pattern.');
    } else if (content.includes('e.jsx=c,e.jsxs=c')) {
        console.log(
            '- Manual JSX factory pattern not found, but JSX assignments present. Checking for existing patch...'
        );
    }
}

// 3. Ensure __SECRET_INTERNALS fallback for other accesses
// --------------------------------------------------------
const internalsOnlyPattern =
    /([a-zA-Z0-9_$]+)\.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED(?!(\.ReactCurrentOwner))/g;
if (internalsOnlyPattern.test(content)) {
    content = content.replace(
        internalsOnlyPattern,
        '($1.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED||$1.__CLIENT_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED||{})'
    );
    console.log('- Applied generic internals fallback patch.');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('SmartCharts compatibility patch applied successfully.');
