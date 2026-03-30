const fs = require('fs');
const code = fs.readFileSync('src/index.js', 'utf8');
const startIndex = code.indexOf('<!DOCTYPE html>');
const endIndex = code.lastIndexOf('</html>') + 7;
if (startIndex !== -1 && endIndex !== -1) {
    fs.writeFileSync('index.html', code.substring(startIndex, endIndex));
    console.log("Extracted HTML successfully.");
} else {
    console.log("Failed to find HTML");
}
