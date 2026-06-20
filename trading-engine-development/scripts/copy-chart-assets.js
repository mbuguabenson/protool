const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const targetDir = path.join(rootDir, 'public', 'assets');
const sourceDir = path.join(rootDir, 'node_modules', '@deriv-com', 'smartcharts-champion', 'dist');

if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
}

function copyRecursiveSync(src, dest) {
    const exists = fs.existsSync(src);
    const stats = exists && fs.statSync(src);
    const isDirectory = exists && stats.isDirectory();
    if (isDirectory) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest);
        }
        fs.readdirSync(src).forEach(childItemName => {
            copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
        });
    } else {
        fs.copyFileSync(src, dest);
    }
}

try {
    console.log(`Copying assets from ${sourceDir} to ${targetDir}...`);
    if (fs.existsSync(sourceDir)) {
        copyRecursiveSync(sourceDir, targetDir);

        // Also check for nested assets
        const nestedAssets = path.join(sourceDir, 'chart', 'assets');
        if (fs.existsSync(nestedAssets)) {
            console.log(`Copying nested assets from ${nestedAssets}...`);
            copyRecursiveSync(nestedAssets, targetDir);
        }
        console.log('Successfully copied SmartCharts assets.');
    } else {
        console.error('Source directory for SmartCharts champion not found.');
    }
} catch (err) {
    console.error('Error copying SmartCharts assets:', err);
}
